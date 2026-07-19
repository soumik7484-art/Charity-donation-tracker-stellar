/**
 * stellar.ts
 * Real Stellar / Soroban blockchain service layer.
 * Talks to the Stellar Testnet RPC and submits real transactions.
 * Extended with: proof submission, donor tracking, refunds, verified creator.
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
export const RPC_URL            = 'https://soroban-testnet.stellar.org'
export const NETWORK_PASSPHRASE = Networks.TESTNET
export const EXPLORER_BASE      = 'https://stellar.expert/explorer/testnet'

// The deployed charity-tracker contract ID — updated after deploy
export let CONTRACT_ID = 'CBNOEZI2KQW2LT3PMYQLULE73YQ2RQMTMQNBQ5OJFYGUM2YGZ33QXXX6'

// Demo keypair (alice) — testnet only, no real funds
const ALICE_SECRET  = 'SBAE77WAY5ZVM3IRAS3SM7I44R565EWRZV3NKP5QXI6XWCWQTDSDXJBZ'
export const aliceKeypair  = Keypair.fromSecret(ALICE_SECRET)
export const ALICE_ADDRESS = aliceKeypair.publicKey()

// ─── RPC Server ───────────────────────────────────────────────────────────────
const server = new Server(RPC_URL)

// ─── Types ────────────────────────────────────────────────────────────────────
export interface Milestone {
  index: number
  title: string
  amount: number
  approved: boolean
  claimed: boolean
  proof_cid: string
  proof_submitted: boolean
}

export interface Campaign {
  id: number
  creator: string
  title: string
  goal: number       // XLM
  raised: number     // XLM
  deadline: number   // ledger sequence
  claimed: boolean
  milestones: Milestone[]
  verified: boolean  // ✅ verified charity badge
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build, simulate, and optionally submit a transaction */
async function invoke(
  method: string,
  args: xdr.ScVal[],
  sign = false
): Promise<{ result: unknown; txHash?: string }> {
  const contract = new Contract(CONTRACT_ID)

  const accountData = await server.getAccount(ALICE_ADDRESS)
  const account = new Account(ALICE_ADDRESS, accountData.sequenceNumber())

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build()

  const sim = await server.simulateTransaction(tx)
  if (Api.isSimulationError(sim)) {
    throw new Error(`Simulation failed: ${sim.error}`)
  }

  if (!sign) {
    const retval = (sim as Api.SimulateTransactionSuccessResponse).result?.retval
    return { result: retval ? scValToNative(retval) : undefined }
  }

  const prepared = await server.prepareTransaction(tx)
  prepared.sign(aliceKeypair)

  const sendResult = await server.sendTransaction(prepared)
  if (sendResult.status === 'ERROR') {
    throw new Error(`Submit failed: ${sendResult.errorResult}`)
  }

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

// ─── Read Functions ───────────────────────────────────────────────────────────

export async function getCount(): Promise<number> {
  const { result } = await invoke('get_count', [])
  return Number(result ?? 0)
}

export async function getCampaign(id: number): Promise<Campaign> {
  const { result } = await invoke('get_campaign', [
    nativeToScVal(id, { type: 'u32' }),
  ])
  return parseCampaign(result as Record<string, unknown>)
}

export async function getAllCampaigns(): Promise<Campaign[]> {
  const { result } = await invoke('get_all', [])
  if (!Array.isArray(result)) return []
  return (result as Record<string, unknown>[]).map(parseCampaign)
}

export async function getDonorContribution(campaignId: number, donor: string): Promise<number> {
  try {
    const { result } = await invoke('get_donor_contribution', [
      nativeToScVal(campaignId, { type: 'u32' }),
      nativeToScVal(donor, { type: 'address' }),
    ])
    return Number(result ?? 0)
  } catch { return 0 }
}

export async function isVerifiedCreator(address: string): Promise<boolean> {
  try {
    const { result } = await invoke('is_verified_creator', [
      nativeToScVal(address, { type: 'address' }),
    ])
    return Boolean(result ?? false)
  } catch { return false }
}

// ─── Write Functions ──────────────────────────────────────────────────────────

export async function createCampaign(
  title: string,
  goalXlm: number,
  durationDays: number
): Promise<{ id: number; txHash: string }> {
  const durationLedgers = durationDays * 14_400

  const { result, txHash } = await invoke(
    'create_campaign',
    [
      nativeToScVal(ALICE_ADDRESS, { type: 'address' }),
      nativeToScVal(ALICE_ADDRESS, { type: 'address' }), // admin = alice for demo
      nativeToScVal(title, { type: 'string' }),
      nativeToScVal(BigInt(goalXlm), { type: 'i128' }),
      nativeToScVal(durationLedgers, { type: 'u32' }),
    ],
    true
  )

  return { id: Number(result), txHash: txHash! }
}

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
    true
  )
  return { txHash: txHash! }
}

export async function donateTracked(
  campaignId: number,
  amountXlm: number
): Promise<{ txHash: string }> {
  const { txHash } = await invoke(
    'donate_tracked',
    [
      nativeToScVal(campaignId, { type: 'u32' }),
      nativeToScVal(ALICE_ADDRESS, { type: 'address' }),
      nativeToScVal(BigInt(amountXlm), { type: 'i128' }),
    ],
    true
  )
  return { txHash: txHash! }
}

export async function claimRefund(
  campaignId: number
): Promise<{ txHash: string; amount: number }> {
  const { txHash, result } = await invoke(
    'claim_refund',
    [
      nativeToScVal(campaignId, { type: 'u32' }),
      nativeToScVal(ALICE_ADDRESS, { type: 'address' }),
    ],
    true
  )
  return { txHash: txHash!, amount: Number(result ?? 0) }
}

export async function submitProof(
  campaignId: number,
  milestoneIndex: number,
  cid: string
): Promise<{ txHash: string }> {
  const { txHash } = await invoke(
    'submit_proof',
    [
      nativeToScVal(campaignId, { type: 'u32' }),
      nativeToScVal(milestoneIndex, { type: 'u32' }),
      nativeToScVal(ALICE_ADDRESS, { type: 'address' }),
      nativeToScVal(cid, { type: 'string' }),
    ],
    true
  )
  return { txHash: txHash! }
}

export async function createMilestone(
  campaignId: number,
  title: string,
  amount: number
): Promise<{ txHash: string; index: number }> {
  const { txHash, result } = await invoke(
    'create_milestone',
    [
      nativeToScVal(campaignId, { type: 'u32' }),
      nativeToScVal(title, { type: 'string' }),
      nativeToScVal(BigInt(amount), { type: 'i128' }),
    ],
    true
  )
  return { txHash: txHash!, index: Number(result ?? 0) }
}

export async function approveMilestone(
  campaignId: number,
  milestoneIndex: number
): Promise<{ txHash: string }> {
  const { txHash } = await invoke(
    'approve_milestone',
    [
      nativeToScVal(campaignId, { type: 'u32' }),
      nativeToScVal(milestoneIndex, { type: 'u32' }),
    ],
    true
  )
  return { txHash: txHash! }
}

export async function claimMilestone(
  campaignId: number,
  milestoneIndex: number
): Promise<{ txHash: string }> {
  const { txHash } = await invoke(
    'claim_milestone',
    [
      nativeToScVal(campaignId, { type: 'u32' }),
      nativeToScVal(milestoneIndex, { type: 'u32' }),
    ],
    true
  )
  return { txHash: txHash! }
}

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

export async function addVerifiedCreator(
  creatorAddress: string
): Promise<{ txHash: string }> {
  const { txHash } = await invoke(
    'add_verified_creator',
    [
      nativeToScVal(ALICE_ADDRESS, { type: 'address' }), // admin
      nativeToScVal(creatorAddress, { type: 'address' }),
    ],
    true
  )
  return { txHash: txHash! }
}

export async function removeVerifiedCreator(
  creatorAddress: string
): Promise<{ txHash: string }> {
  const { txHash } = await invoke(
    'remove_verified_creator',
    [
      nativeToScVal(ALICE_ADDRESS, { type: 'address' }), // admin
      nativeToScVal(creatorAddress, { type: 'address' }),
    ],
    true
  )
  return { txHash: txHash! }
}

export async function getLedger(): Promise<number> {
  const info = await server.getLatestLedger()
  return info.sequence
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function parseMilestone(raw: Record<string, unknown>): Milestone {
  return {
    index:          Number(raw.index ?? 0),
    title:          String(raw.title ?? ''),
    amount:         Number(raw.amount ?? 0),
    approved:       Boolean(raw.approved ?? false),
    claimed:        Boolean(raw.claimed ?? false),
    proof_cid:      String(raw.proof_cid ?? ''),
    proof_submitted: Boolean(raw.proof_submitted ?? false),
  }
}

function parseCampaign(raw: Record<string, unknown>): Campaign {
  const milestones = Array.isArray(raw.milestones)
    ? (raw.milestones as Record<string, unknown>[]).map(parseMilestone)
    : []
  return {
    id:       Number(raw.id       ?? 0),
    creator:  String(raw.creator  ?? ''),
    title:    String(raw.title    ?? ''),
    goal:     Number(raw.goal     ?? 0),
    raised:   Number(raw.raised   ?? 0),
    deadline: Number(raw.deadline ?? 0),
    claimed:  Boolean(raw.claimed ?? false),
    milestones,
    verified: Boolean(raw.verified ?? false),
  }
}

export function explorerTxUrl(hash: string) {
  return `${EXPLORER_BASE}/tx/${hash}`
}

export function explorerContractUrl() {
  return `${EXPLORER_BASE}/contract/${CONTRACT_ID}`
}
