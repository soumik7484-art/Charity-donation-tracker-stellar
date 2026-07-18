/**
 * api.ts
 * Connects to the CharityChain Express backend (port 5001).
 * Falls back gracefully when backend is not running.
 */

const BASE = 'http://localhost:5001/api'

async function get<T>(path: string, fallback: T): Promise<T> {
  try {
    const r = await fetch(`${BASE}${path}`)
    if (!r.ok) throw new Error(`${r.status}`)
    return r.json()
  } catch { return fallback }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  return r.json()
}

// ── Campaigns ─────────────────────────────────────────────────────────────────
export async function apiGetCampaigns() {
  return get('/campaigns', [])
}

export async function apiCreateCampaign(data: Record<string, unknown>) {
  return post('/campaigns', data)
}

export async function apiApproveMilestone(campaignId: number, milestoneIndex: number) {
  return post(`/campaigns/${campaignId}/milestones/${milestoneIndex}/approve`, {})
}

export async function apiClaimMilestone(campaignId: number, milestoneIndex: number) {
  return post(`/campaigns/${campaignId}/milestones/${milestoneIndex}/claim`, {})
}

export async function apiUploadUtilization(campaignId: number, data: {amount: number; category: string; details: string}) {
  return post(`/campaigns/${campaignId}/utilization`, data)
}

// ── Donations ─────────────────────────────────────────────────────────────────
export async function apiRecordDonation(data: Record<string, unknown>) {
  return post('/donations', data)
}

export async function apiGetDonations(): Promise<Donation[]> {
  return get('/donations', [])
}

// ── Analytics & Fraud ─────────────────────────────────────────────────────────
export async function apiGetAnalytics(): Promise<AnalyticsData> {
  return get('/analytics', {
    totalDonated: 0, campaignsSupported: 0, impactScore: 0,
    alertsCount: 0, criticalAlerts: 0, categoryBreakdown: {}, monthlyTimeline: []
  })
}

export async function apiGetFraudAlerts(): Promise<FraudAlert[]> {
  return get('/admin/fraud', [])
}

// ── NGOs ──────────────────────────────────────────────────────────────────────
export async function apiGetNGOs(): Promise<NGO[]> {
  return get('/ngos', [])
}

// ── Notifications ─────────────────────────────────────────────────────────────
export async function apiGetNotifications(): Promise<Notification[]> {
  return get('/notifications', [])
}

// ── Admin ─────────────────────────────────────────────────────────────────────
export async function apiFreezeAccount(walletAddress: string) {
  return post('/admin/freeze', { walletAddress })
}

// ── Types ─────────────────────────────────────────────────────────────────────
export interface Donation {
  txHash: string
  blockNumber: number
  timestamp: string
  amount: number
  sender: string
  receiver: string
  campaignId: number
  status: string
  anonymous: boolean
}

export interface FraudAlert {
  id: string
  txHash: string
  sender: string
  amount: number
  fraudScore: number
  riskLevel: 'Low' | 'Medium' | 'Critical'
  explanation: string
  recommendedAction: string
  timestamp: string
}

export interface NGO {
  id: string
  address: string
  name: string
  verified: boolean
  documents: string[]
  successRate: number
  transparencyLevel: string
  trustScore: number
  reviewsCount: number
  description: string
}

export interface Notification {
  id: string
  type: string
  text: string
  time: string
  read: boolean
}

export interface AnalyticsData {
  totalDonated: number
  campaignsSupported: number
  impactScore: number
  alertsCount: number
  criticalAlerts: number
  categoryBreakdown: Record<string, number>
  monthlyTimeline: { name: string; amount: number }[]
}
