/**
 * ipfs.ts
 * Pinata IPFS upload helper for GiveChain proof-of-spend.
 * Uses Pinata API Key + Secret. Falls back to mock CID for demo.
 */

const PINATA_API_KEY    = import.meta.env.VITE_PINATA_API_KEY    || ''
const PINATA_API_SECRET = import.meta.env.VITE_PINATA_API_SECRET || ''
const PINATA_JWT        = import.meta.env.VITE_PINATA_JWT        || ''

export const IPFS_GATEWAY = 'https://gateway.pinata.cloud/ipfs'

/** Returns a working IPFS gateway URL for a given CID */
export function ipfsUrl(cid: string): string {
  if (!cid || cid === '') return ''
  return `${IPFS_GATEWAY}/${cid}`
}

/** Returns a public ipfs.io gateway URL */
export function ipfsPublicUrl(cid: string): string {
  return `https://ipfs.io/ipfs/${cid}`
}

/** Detect file type from MIME */
export function isImage(file: File): boolean {
  return file.type.startsWith('image/')
}

export function isPDF(file: File): boolean {
  return file.type === 'application/pdf'
}

/**
 * Upload a file to IPFS via Pinata.
 * - Uses JWT token if VITE_PINATA_JWT is set (recommended).
 * - Falls back to API Key + Secret if both are set.
 * - Returns a demo mock CID if no credentials are configured.
 */
export async function uploadToIPFS(file: File, name?: string): Promise<string> {
  // Mock fallback for demo when no credentials
  if (!PINATA_JWT && (!PINATA_API_KEY || !PINATA_API_SECRET)) {
    console.warn('[IPFS] No Pinata credentials found — using demo mock CID.')
    return await mockUpload(file)
  }

  const formData = new FormData()
  formData.append('file', file)

  const metadata = JSON.stringify({ name: name || file.name })
  formData.append('pinataMetadata', metadata)

  const options = JSON.stringify({ cidVersion: 1 })
  formData.append('pinataOptions', options)

  const headers: Record<string, string> = {}

  if (PINATA_JWT) {
    headers['Authorization'] = `Bearer ${PINATA_JWT}`
  } else {
    headers['pinata_api_key']    = PINATA_API_KEY
    headers['pinata_secret_api_key'] = PINATA_API_SECRET
  }

  const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
    method: 'POST',
    headers,
    body: formData,
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Pinata upload failed (${response.status}): ${err}`)
  }

  const result = await response.json()
  return result.IpfsHash as string
}

/**
 * Upload JSON metadata to IPFS via Pinata (for campaign proof metadata).
 */
export async function uploadJSONToIPFS(data: Record<string, unknown>, name?: string): Promise<string> {
  if (!PINATA_JWT && (!PINATA_API_KEY || !PINATA_API_SECRET)) {
    return `Qm${Math.random().toString(36).slice(2, 47)}`
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (PINATA_JWT) {
    headers['Authorization'] = `Bearer ${PINATA_JWT}`
  } else {
    headers['pinata_api_key']    = PINATA_API_KEY
    headers['pinata_secret_api_key'] = PINATA_API_SECRET
  }

  const body = JSON.stringify({
    pinataMetadata: { name: name || 'GiveChain Proof' },
    pinataOptions: { cidVersion: 1 },
    pinataContent: data,
  })

  const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
    method: 'POST',
    headers,
    body,
  })

  if (!response.ok) {
    throw new Error(`Pinata JSON upload failed: ${response.status}`)
  }

  const result = await response.json()
  return result.IpfsHash as string
}

/** Mock upload — returns a deterministic fake CID without crypto.subtle */
async function mockUpload(file: File): Promise<string> {
  await new Promise(r => setTimeout(r, 800)) // simulate upload delay
  // Generate a realistic-looking CIDv1 using file name + size + time
  const seed = `${file.name}-${file.size}-${Date.now()}`
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0')
  const rand = Math.random().toString(36).slice(2, 50)
  return `bafybeig${hex}${rand}`.slice(0, 59)
}
