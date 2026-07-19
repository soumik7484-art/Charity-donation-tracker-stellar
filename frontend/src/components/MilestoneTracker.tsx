/**
 * MilestoneTracker.tsx
 * Vertical milestone timeline per campaign with:
 * - IPFS proof upload (Pinata)
 * - Admin approve
 * - Creator release funds
 * - Stellar tx explorer links
 */
import { useState, useRef } from 'react'
import { CheckCircle, Clock, Upload, Loader2, ExternalLink, Lock, Unlock, FileText } from 'lucide-react'
import * as StellarService from '../stellar'
import type { Campaign, Milestone } from '../stellar'
import { uploadToIPFS, ipfsUrl } from '../ipfs'

interface Props {
  campaign: Campaign
  ledger: number
  onRefresh: () => void
  isOwner: boolean
  isAdmin: boolean
}

type StepState = Record<string, boolean>

export default function MilestoneTracker({ campaign, onRefresh, isOwner, isAdmin }: Props) {
  const [loading, setLoading]   = useState<StepState>({})
  const [txLinks, setTxLinks]   = useState<Record<number, string>>({})
  const [error, setError]       = useState<string | null>(null)
  const [uploadPct, setUploadPct] = useState<Record<number, number>>({})
  const fileRefs = useRef<Record<number, HTMLInputElement | null>>({})

  const setLoad = (key: string, v: boolean) =>
    setLoading(p => ({ ...p, [key]: v }))

  const milestoneStatus = (m: Milestone) => {
    if (m.claimed)          return 'released'
    if (m.approved)         return 'approved'
    if (m.proof_submitted)  return 'proof_pending'
    return 'pending'
  }

  const statusConfig = {
    pending:       { label: 'Awaiting Proof',    color: '#6b7280', bg: 'rgba(107,114,128,0.12)', icon: <Lock size={14}/> },
    proof_pending: { label: 'Proof Under Review', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', icon: <Clock size={14}/> },
    approved:      { label: 'Approved ✓',         color: '#10b981', bg: 'rgba(16,185,129,0.12)', icon: <Unlock size={14}/> },
    released:      { label: 'Funds Released',     color: '#00e5a0', bg: 'rgba(0,229,160,0.12)', icon: <CheckCircle size={14}/> },
  }

  async function handleUploadProof(milestone: Milestone, file: File) {
    setError(null)
    setUploadPct(p => ({ ...p, [milestone.index]: 10 }))
    try {
      setUploadPct(p => ({ ...p, [milestone.index]: 30 }))
      const cid = await uploadToIPFS(file, `proof_campaign${campaign.id}_ms${milestone.index}`)
      setUploadPct(p => ({ ...p, [milestone.index]: 70 }))

      setLoad(`proof_${milestone.index}`, true)
      const { txHash } = await StellarService.submitProof(campaign.id, milestone.index, cid)
      setUploadPct(p => ({ ...p, [milestone.index]: 100 }))
      setTxLinks(p => ({ ...p, [milestone.index]: txHash }))
      onRefresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setLoad(`proof_${milestone.index}`, false)
      setTimeout(() => setUploadPct(p => ({ ...p, [milestone.index]: 0 })), 1500)
    }
  }

  async function handleApprove(milestone: Milestone) {
    setError(null)
    setLoad(`approve_${milestone.index}`, true)
    try {
      const { txHash } = await StellarService.approveMilestone(campaign.id, milestone.index)
      setTxLinks(p => ({ ...p, [milestone.index]: txHash }))
      onRefresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Approval failed')
    } finally {
      setLoad(`approve_${milestone.index}`, false)
    }
  }

  async function handleRelease(milestone: Milestone) {
    setError(null)
    setLoad(`release_${milestone.index}`, true)
    try {
      const { txHash } = await StellarService.claimMilestone(campaign.id, milestone.index)
      setTxLinks(p => ({ ...p, [milestone.index]: txHash }))
      onRefresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Release failed')
    } finally {
      setLoad(`release_${milestone.index}`, false)
    }
  }

  const pct = campaign.goal > 0 ? Math.min(100, (campaign.raised / campaign.goal) * 100) : 0

  return (
    <div style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 13, color: '#9ca3af' }}>
            Total Raised: <strong style={{ color: '#00e5a0' }}>{campaign.raised} XLM</strong>
            {' '}/ {campaign.goal} XLM
          </span>
          <span style={{ fontSize: 12, color: '#6b7280' }}>{pct.toFixed(1)}% funded</span>
        </div>
        <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 99 }}>
          <div style={{
            height: '100%', borderRadius: 99,
            background: 'linear-gradient(90deg, #00e5a0, #00c4ff)',
            width: `${pct}%`, transition: 'width 0.4s ease'
          }} />
        </div>
      </div>

      {error && (
        <div style={{
          background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 10, padding: '10px 14px', marginBottom: 14,
          color: '#f87171', fontSize: 13
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Milestones */}
      {campaign.milestones.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#6b7280', padding: '32px 0', fontSize: 14 }}>
          No milestones added yet. Campaign creator can add milestones.
        </div>
      ) : (
        <div style={{ position: 'relative' }}>
          {/* Vertical line */}
          <div style={{
            position: 'absolute', left: 18, top: 10, bottom: 10,
            width: 2, background: 'rgba(255,255,255,0.06)', borderRadius: 2
          }} />

          {campaign.milestones.map((m) => {
            const status = milestoneStatus(m)
            const cfg    = statusConfig[status]
            const pctMs  = campaign.goal > 0 ? ((m.amount / campaign.goal) * 100).toFixed(0) : '0'

            return (
              <div key={m.index} style={{ display: 'flex', gap: 16, marginBottom: 28, position: 'relative' }}>
                {/* Timeline dot */}
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                  background: cfg.bg, border: `2px solid ${cfg.color}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: cfg.color, zIndex: 1
                }}>
                  {cfg.icon}
                </div>

                {/* Content */}
                <div style={{
                  flex: 1, background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 12, padding: '14px 16px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9', marginBottom: 2 }}>
                        Milestone {m.index + 1}: {m.title}
                      </div>
                      <div style={{ fontSize: 12, color: '#94a3b8' }}>
                        {m.amount} XLM ({pctMs}% of goal)
                      </div>
                    </div>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '3px 10px',
                      borderRadius: 99, background: cfg.bg, color: cfg.color,
                      border: `1px solid ${cfg.color}33`
                    }}>
                      {cfg.label}
                    </span>
                  </div>

                  {/* Proof display */}
                  {m.proof_submitted && m.proof_cid && (
                    <div style={{
                      background: 'rgba(0,229,160,0.06)', borderRadius: 8,
                      padding: '8px 12px', marginBottom: 10,
                      display: 'flex', alignItems: 'center', gap: 8
                    }}>
                      <FileText size={14} color="#00e5a0" />
                      <span style={{ fontSize: 12, color: '#94a3b8', flex: 1 }}>
                        IPFS Proof: <code style={{ fontSize: 11, color: '#00e5a0' }}>
                          {m.proof_cid.slice(0, 20)}…
                        </code>
                      </span>
                      <a href={ipfsUrl(m.proof_cid)} target="_blank" rel="noreferrer"
                        style={{ color: '#00c4ff', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                        View <ExternalLink size={11} />
                      </a>
                    </div>
                  )}

                  {/* Upload progress */}
                  {(uploadPct[m.index] || 0) > 0 && (uploadPct[m.index] || 0) < 100 && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', borderRadius: 99,
                          background: 'linear-gradient(90deg,#00e5a0,#00c4ff)',
                          width: `${uploadPct[m.index]}%`, transition: 'width 0.3s'
                        }} />
                      </div>
                      <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
                        Uploading to IPFS… {uploadPct[m.index]}%
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>

                    {/* Creator: Upload proof */}
                    {isOwner && !m.proof_submitted && !m.approved && (
                      <>
                        <input
                          ref={el => { fileRefs.current[m.index] = el }}
                          type="file"
                          accept="image/*,application/pdf,.doc,.docx"
                          style={{ display: 'none' }}
                          onChange={async e => {
                            const f = e.target.files?.[0]
                            if (f) await handleUploadProof(m, f)
                          }}
                        />
                        <button
                          onClick={() => fileRefs.current[m.index]?.click()}
                          disabled={loading[`proof_${m.index}`]}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '7px 14px', borderRadius: 8, border: 'none',
                            background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                            color: '#fff', fontSize: 12, fontWeight: 600,
                            cursor: loading[`proof_${m.index}`] ? 'not-allowed' : 'pointer',
                            opacity: loading[`proof_${m.index}`] ? 0.6 : 1
                          }}
                        >
                          {loading[`proof_${m.index}`]
                            ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Uploading…</>
                            : <><Upload size={13} /> Upload Proof</>
                          }
                        </button>
                      </>
                    )}

                    {/* Admin: Approve proof */}
                    {isAdmin && m.proof_submitted && !m.approved && (
                      <button
                        onClick={() => handleApprove(m)}
                        disabled={loading[`approve_${m.index}`]}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          padding: '7px 14px', borderRadius: 8, border: 'none',
                          background: 'linear-gradient(135deg,#10b981,#059669)',
                          color: '#fff', fontSize: 12, fontWeight: 600,
                          cursor: loading[`approve_${m.index}`] ? 'not-allowed' : 'pointer',
                          opacity: loading[`approve_${m.index}`] ? 0.6 : 1
                        }}
                      >
                        {loading[`approve_${m.index}`]
                          ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Approving…</>
                          : <><CheckCircle size={13} /> Approve Proof</>
                        }
                      </button>
                    )}

                    {/* Creator: Release funds */}
                    {isOwner && m.approved && !m.claimed && (
                      <button
                        onClick={() => handleRelease(m)}
                        disabled={loading[`release_${m.index}`]}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          padding: '7px 14px', borderRadius: 8, border: 'none',
                          background: 'linear-gradient(135deg,#00e5a0,#00c4ff)',
                          color: '#0a1628', fontSize: 12, fontWeight: 700,
                          cursor: loading[`release_${m.index}`] ? 'not-allowed' : 'pointer',
                          opacity: loading[`release_${m.index}`] ? 0.6 : 1
                        }}
                      >
                        {loading[`release_${m.index}`]
                          ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Releasing…</>
                          : <><Unlock size={13} /> Release Funds</>
                        }
                      </button>
                    )}

                    {/* Tx explorer link */}
                    {txLinks[m.index] && (
                      <a
                        href={StellarService.explorerTxUrl(txLinks[m.index])}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          display: 'flex', alignItems: 'center', gap: 5,
                          padding: '7px 12px', borderRadius: 8,
                          border: '1px solid rgba(0,196,255,0.3)',
                          color: '#00c4ff', fontSize: 12, textDecoration: 'none',
                          background: 'rgba(0,196,255,0.06)'
                        }}
                      >
                        <ExternalLink size={12} /> View Tx
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
