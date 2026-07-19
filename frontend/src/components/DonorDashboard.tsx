/**
 * DonorDashboard.tsx
 * "My Donations" page showing:
 * - Every campaign the connected wallet donated to
 * - Amount donated, campaign status, milestone proofs released
 * - Refund eligibility if applicable
 */
import React, { useState, useEffect } from 'react'
import { Heart, ExternalLink, Loader2, AlertCircle, CheckCircle, Clock } from 'lucide-react'
import * as StellarService from '../stellar'
import type { Campaign } from '../stellar'
import type { Donation } from '../api'
import { explorerTxUrl } from '../stellar'

interface Props {
  campaigns: Campaign[]
  donations: Donation[]
  walletAddress: string
  ledger: number
  onRefresh: () => void
}

interface DonorEntry {
  campaign: Campaign
  donations: Donation[]
  totalDonated: number
  contribution: number  // on-chain tracked amount
  refundEligible: boolean
}

export default function DonorDashboard({ campaigns, donations, walletAddress, ledger }: Props) {
  const [entries, setEntries] = useState<DonorEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCampaign, setSelectedCampaign] = useState<number | null>(null)

  useEffect(() => {
    if (!walletAddress || campaigns.length === 0) {
      setLoading(false)
      return
    }
    buildEntries()
  }, [campaigns, donations, walletAddress])

  async function buildEntries() {
    setLoading(true)
    try {
      // Filter off-chain donations by wallet
      const myDonations = donations.filter(d =>
        d.sender.toLowerCase() === walletAddress.toLowerCase()
      )

      // Group by campaign
      const byCampaign: Record<number, Donation[]> = {}
      myDonations.forEach(d => {
        if (!byCampaign[d.campaignId]) byCampaign[d.campaignId] = []
        byCampaign[d.campaignId].push(d)
      })

      // For each campaign the user donated to, fetch on-chain contribution
      const results = await Promise.all(
        Object.entries(byCampaign).map(async ([idStr, dons]): Promise<DonorEntry | null> => {
          const id = Number(idStr)
          const campaign = campaigns.find(c => c.id === id)
          if (!campaign) return null

          const contribution = await StellarService.getDonorContribution(id, walletAddress)
          const refundEligible = ledger > campaign.deadline && campaign.raised < campaign.goal && contribution > 0

          return {
            campaign,
            donations: dons,
            totalDonated: dons.reduce((s, d) => s + d.amount, 0),
            contribution,
            refundEligible,
          } as DonorEntry
        })
      )

      setEntries(results.filter((e): e is DonorEntry => e !== null))
    } finally {
      setLoading(false)
    }
  }

  const totalXlm     = entries.reduce((s, e) => s + e.totalDonated, 0)
  const activeCamps  = entries.filter(e => !e.campaign.claimed && ledger <= e.campaign.deadline).length
  const refundCount  = entries.filter(e => e.refundEligible).length

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
      <Loader2 size={28} color="#00e5a0" style={{ animation: 'spin 1s linear infinite' }} />
    </div>
  )

  if (entries.length === 0) return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: '#6b7280' }}>
      <Heart size={48} style={{ opacity: 0.2, marginBottom: 16 }} />
      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No donations yet</div>
      <div style={{ fontSize: 13 }}>
        Campaigns you donate to will appear here with real-time tracking.
      </div>
    </div>
  )

  return (
    <div style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
        {[
          { label: 'Total Donated', value: `${totalXlm.toFixed(2)} XLM`, color: '#00e5a0', icon: '💰' },
          { label: 'Active Campaigns', value: activeCamps, color: '#00c4ff', icon: '🚀' },
          { label: 'Refunds Available', value: refundCount, color: '#fbbf24', icon: '↩️' },
        ].map(stat => (
          <div key={stat.label} style={{
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 14, padding: '18px 20px', textAlign: 'center'
          }}>
            <div style={{ fontSize: 24, marginBottom: 6 }}>{stat.icon}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: stat.color, marginBottom: 4 }}>
              {stat.value}
            </div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Campaign list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {entries.map(entry => {
          const { campaign, donations: dons, totalDonated, contribution: _contribution, refundEligible } = entry
          const isExpired   = ledger > campaign.deadline
          const pct         = campaign.goal > 0 ? Math.min(100, (campaign.raised / campaign.goal) * 100) : 0
          const releasedMs  = campaign.milestones.filter(m => m.claimed).length
          const totalMs     = campaign.milestones.length
          const isSelected  = selectedCampaign === campaign.id

          return (
            <div
              key={campaign.id}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: refundEligible
                  ? '1px solid rgba(251,191,36,0.35)'
                  : '1px solid rgba(255,255,255,0.08)',
                borderRadius: 14, overflow: 'hidden'
              }}
            >
              {/* Header */}
              <div
                style={{ padding: '16px 20px', cursor: 'pointer' }}
                onClick={() => setSelectedCampaign(isSelected ? null : campaign.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9' }}>
                        {campaign.title}
                      </span>
                      {campaign.verified && (
                        <span style={{
                          fontSize: 10, padding: '2px 8px', borderRadius: 99, fontWeight: 700,
                          background: 'rgba(16,185,129,0.15)', color: '#10b981',
                          border: '1px solid rgba(16,185,129,0.3)'
                        }}>
                          ✅ Verified
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>
                      Campaign #{campaign.id} · {dons.length} donation{dons.length !== 1 ? 's' : ''}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#00e5a0' }}>
                      {totalDonated} XLM
                    </div>
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                      your contribution
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                <div style={{ marginTop: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 11, color: '#6b7280' }}>
                      {campaign.raised} / {campaign.goal} XLM raised
                    </span>
                    <span style={{ fontSize: 11, color: '#6b7280' }}>
                      {releasedMs}/{totalMs} milestones released
                    </span>
                  </div>
                  <div style={{ height: 5, background: 'rgba(255,255,255,0.07)', borderRadius: 99 }}>
                    <div style={{
                      height: '100%', borderRadius: 99,
                      background: 'linear-gradient(90deg,#00e5a0,#00c4ff)',
                      width: `${pct}%`, transition: 'width 0.4s'
                    }} />
                  </div>
                </div>

                {/* Status chips */}
                <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                  {campaign.claimed ? (
                    <StatusChip color="#10b981" icon={<CheckCircle size={10}/>} label="Campaign Complete" />
                  ) : isExpired ? (
                    <StatusChip color="#ef4444" icon={<AlertCircle size={10}/>} label="Expired" />
                  ) : (
                    <StatusChip color="#00c4ff" icon={<Clock size={10}/>} label="Active" />
                  )}

                  {refundEligible && (
                    <StatusChip color="#fbbf24" icon={<>↩️</>} label="Refund Available" />
                  )}
                </div>
              </div>

              {/* Expanded: donation history */}
              {isSelected && (
                <div style={{
                  borderTop: '1px solid rgba(255,255,255,0.06)',
                  padding: '14px 20px', background: 'rgba(0,0,0,0.15)'
                }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#9ca3af', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
                    Donation History
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {dons.map((d, i) => (
                      <div key={i} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '8px 12px', borderRadius: 9,
                        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)'
                      }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>
                            {d.amount} XLM
                          </div>
                          <div style={{ fontSize: 11, color: '#6b7280' }}>
                            {new Date(d.timestamp).toLocaleString()}
                          </div>
                        </div>
                        <a
                          href={explorerTxUrl(d.txHash)}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            display: 'flex', alignItems: 'center', gap: 4,
                            fontSize: 11, color: '#00c4ff', textDecoration: 'none'
                          }}
                        >
                          <ExternalLink size={11} />
                          {d.txHash.slice(0, 8)}…
                        </a>
                      </div>
                    ))}
                  </div>

                  {/* Milestone proof summary */}
                  {campaign.milestones.length > 0 && (
                    <div style={{ marginTop: 14 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#9ca3af', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
                        Milestone Proofs
                      </div>
                      {campaign.milestones.map(m => (
                        <div key={m.index} style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 12
                        }}>
                          <span style={{ color: m.claimed ? '#00e5a0' : m.approved ? '#10b981' : '#6b7280' }}>
                            {m.claimed ? '✅' : m.approved ? '✓' : '⏳'}
                          </span>
                          <span style={{ color: '#d1d5db', flex: 1 }}>
                            M{m.index + 1}: {m.title}
                          </span>
                          {m.proof_submitted && m.proof_cid && (
                            <a
                              href={`https://ipfs.io/ipfs/${m.proof_cid}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{ color: '#a78bfa', fontSize: 11 }}
                            >
                              Proof ↗
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function StatusChip({ color, icon, label }: { color: string; icon: React.ReactNode; label: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 10, fontWeight: 600, padding: '2px 9px', borderRadius: 99,
      background: `${color}18`, color, border: `1px solid ${color}33`
    }}>
      {icon} {label}
    </span>
  )
}
