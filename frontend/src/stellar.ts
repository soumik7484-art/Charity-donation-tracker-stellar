/**
 * stellar.ts
 * Real Stellar / Soroban blockchain service layer.
 * Talks to the Stellar Testnet RPC and submits real transactions.
 */

import {
  Contract,
  Keypair,
  Networks,
  TransactionBuilder,
  BASE_FEE,
  Account,
  nativeToScVal,
  scValToNative,
  xdr,
} from '@stellar/stellar-sdk'
import { Server, Api } from '@stellar/stellar-sdk/rpc'

// ─── Config ───────────────────────────────────────────────────────────────────
export const RPC_URL           = 'https://soroban-testnet.stellar.org'
export const NETWORK_PASSPHRASE = Networks.TESTNET
export const EXPLORER_BASE     = 'https://stellar.expert/explorer/testnet'

// The deployed charity-tracker contract ID — updated after deploy
export let CONTRACT_ID = 'CBNOEZI2KQW2LT3PMYQLULE73YQ2RQMTMQNBQ5OJFYGUM2YGZ33QXXX6'

// Demo keypair (alice) — testnet only, no real funds
const ALICE_SECRET  = 'SBAE77WAY5ZVM3IRAS3SM7I44R565EWRZV3NKP5QXI6XWCWQTDSDXJBZ'
export const aliceKeypair  = Keypair.fromSecret(ALICE_SECRET)
export const ALICE_ADDRESS = aliceKeypair.publicKey()

// ─── RPC Server ───────────────────────────────────────────────────────────────
const server = new Server(RPC_URL)

// ─── Campaign type ────────────────────────────────────────────────────────────
export interface Campaign {
  id: number
  creator: string
  title: string
  goal: number     // XLM
  raised: number   // XLM
  deadline: number // ledger sequence
  claimed: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build, simulate, and optionally submit a transaction */
async function invoke(
  method: string,
  args: xdr.ScVal[],
  sign = false
): Promise<{ result: unknown; txHash?: string }> {
  const contract = new Contract(CONTRACT_ID)

  // Need a real account to get the sequence number
  const accountData = await server.getAccount(ALICE_ADDRESS)
  const account = new Account(ALICE_ADDRESS, accountData.sequenceNumber())

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build()

  // Always simulate first
  const sim = await server.simulateTransaction(tx)
  if (Api.isSimulationError(sim)) {
    throw new Error(`Simulation failed: ${sim.error}`)
  }

  // Read-only call — return simulated result without submitting
  if (!sign) {
    const retval = (sim as Api.SimulateTransactionSuccessResponse).result?.retval
    return { result: retval ? scValToNative(retval) : undefined }
  }

  // Write call — prepare, sign, submit
  const prepared = await server.prepareTransaction(tx)
  prepared.sign(aliceKeypair)

  const sendResult = await server.sendTransaction(prepared)
  if (sendResult.status === 'ERROR') {
    throw new Error(`Submit failed: ${sendResult.errorResult}`)
  }

  // Poll for confirmation
  let getResult = await server.getTransaction(sendResult.hash)
  let attempts = 0
  while (getResult.status === 'NOT_FOUND' && attempts < 30) {
    await new Promise(r => setTimeout(r, 1000))
    getResult = await server.getTransaction(sendResult.hash)
    attempts++
  }

  if (getResult.status === 'FAILED') {
    throw new Error(`Transaction failed on ledger`)
  }

  const retval = getResult.status === 'SUCCESS'
    ? (getResult as Api.GetSuccessfulTransactionResponse).returnValue
    : undefined

  return {
    result: retval ? scValToNative(retval) : undefined,
    txHash: sendResult.hash,
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Read total number of campaigns from chain */
export async function getCount(): Promise<number> {
  const { result } = await invoke('get_count', [])
  return Number(result ?? 0)
}

/** Read a single campaign from chain */
export async function getCampaign(id: number): Promise<Campaign> {
  const { result } = await invoke('get_campaign', [
    nativeToScVal(id, { type: 'u32' }),
  ])
  return parseCampaign(result as Record<string, unknown>)
}

/** Read all campaigns from chain */
export async function getAllCampaigns(): Promise<Campaign[]> {
  const { result } = await invoke('get_all', [])
  if (!Array.isArray(result)) return []
  return (result as Record<string, unknown>[]).map(parseCampaign)
}

/** Create a new campaign on-chain */
export async function createCampaign(
  title: string,
  goalXlm: number,
  durationDays: number
): Promise<{ id: number; txHash: string }> {
  const durationLedgers = durationDays * 14_400 // ~6s per ledger

  const { result, txHash } = await invoke(
    'create_campaign',
    [
      nativeToScVal(ALICE_ADDRESS, { type: 'address' }),
      nativeToScVal(title, { type: 'string' }),
      nativeToScVal(BigInt(goalXlm), { type: 'i128' }),
      nativeToScVal(durationLedgers, { type: 'u32' }),
    ],
    true // sign & submit
  )

  return { id: Number(result), txHash: txHash! }
}

/** Record a donation on-chain */
export async function donate(
  campaignId: number,
  amountXlm: number
): Promise<{ txHash: string }> {
  const { txHash } = await invoke(
    'donate',
    [
      nativeToScVal(campaignId, { type: 'u32' }),
      nativeToScVal(BigInt(amountXlm), { type: 'i128' }),
    ],
    true // sign & submit
  )
  return { txHash: txHash! }
}

/** Claim a completed campaign on-chain */
export async function claimCampaign(
  campaignId: number
): Promise<{ txHash: string }> {
  const { txHash } = await invoke(
    'claim',
    [nativeToScVal(campaignId, { type: 'u32' })],
    true
  )
  return { txHash: txHash! }
}

/** Current ledger sequence number */
export async function getLedger(): Promise<number> {
  const info = await server.getLatestLedger()
  return info.sequence
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function parseCampaign(raw: Record<string, unknown>): Campaign {
  return {
    id:       Number(raw.id       ?? 0),
    creator:  String(raw.creator  ?? ''),
    title:    String(raw.title    ?? ''),
    goal:     Number(raw.goal     ?? 0),
    raised:   Number(raw.raised   ?? 0),
    deadline: Number(raw.deadline ?? 0),
    claimed:  Boolean(raw.claimed ?? false),
  }
}

export function explorerTxUrl(hash: string) {
  return `${EXPLORER_BASE}/tx/${hash}`
}

export function explorerContractUrl() {
  return `${EXPLORER_BASE}/contract/${CONTRACT_ID}`
}
