/**
 * RefundBanner.tsx
 * Shows a refund claim banner only when:
 * - Campaign deadline has passed
 * - Goal was NOT met
 * - Connected wallet has donated to this campaign
 */
import { useState, useEffect } from 'react'
import { AlertCircle, Loader2, ExternalLink, RotateCcw } from 'lucide-react'
import * as StellarService from '../stellar'
import type { Campaign } from '../stellar'

interface Props {
  campaign: Campaign
  ledger: number
  walletAddress: string
  onRefresh: () => void
}

export default function RefundBanner({ campaign, ledger, walletAddress, onRefresh }: Props) {
  const [contribution, setContribution] = useState<number>(0)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [claimed, setClaimed] = useState(false)

  const isExpired  = ledger > campaign.deadline
  const goalNotMet = campaign.raised < campaign.goal

  useEffect(() => {
    if (!walletAddress || !isExpired || !goalNotMet) {
      setChecking(false)
      return
    }

    StellarService.getDonorContribution(campaign.id, walletAddress)
      .then(amt => setContribution(amt))
      .catch(() => setContribution(0))
      .finally(() => setChecking(false))
  }, [campaign.id, walletAddress, isExpired, goalNotMet])

  // Don't render if: not expired, goal met, or no contribution, or already claimed
  if (!isExpired || !goalNotMet || claimed) return null
  if (checking) return (
    <div style={{
      background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)',
      borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10,
      fontSize: 13, color: '#fbbf24'
    }}>
      <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
      Checking refund eligibility…
    </div>
  )

  if (contribution <= 0) return null

  async function handleClaim() {
    setError(null)
    setLoading(true)
    try {
      const { txHash: hash } = await StellarService.claimRefund(campaign.id)
      setTxHash(hash)
      setClaimed(true)
      onRefresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Refund claim failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(251,191,36,0.08), rgba(245,158,11,0.04))',
      border: '1px solid rgba(251,191,36,0.35)',
      borderRadius: 14, padding: '18px 20px', marginBottom: 16
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{
          width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
          background: 'rgba(251,191,36,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <AlertCircle size={20} color="#fbbf24" />
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#fbbf24', marginBottom: 4 }}>
            Refund Available
          </div>
          <div style={{ fontSize: 13, color: '#d1d5db', marginBottom: 12, lineHeight: 1.5 }}>
            This campaign expired without reaching its goal. You donated&nbsp;
            <strong style={{ color: '#fbbf24' }}>{contribution} XLM</strong>
            &nbsp;and are eligible for a full refund.
          </div>

          {error && (
            <div style={{
              fontSize: 12, color: '#f87171', marginBottom: 10,
              background: 'rgba(239,68,68,0.1)', padding: '6px 10px', borderRadius: 7
            }}>
              ⚠️ {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={handleClaim}
              disabled={loading}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '9px 18px', borderRadius: 9, border: 'none',
                background: 'linear-gradient(135deg,#f59e0b,#d97706)',
                color: '#fff', fontSize: 13, fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                boxShadow: '0 4px 14px rgba(245,158,11,0.25)'
              }}
            >
              {loading
                ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Claiming…</>
                : <><RotateCcw size={14} /> Claim {contribution} XLM Refund</>
              }
            </button>

            {txHash && (
              <a
                href={StellarService.explorerTxUrl(txHash)}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '9px 14px', borderRadius: 9,
                  border: '1px solid rgba(251,191,36,0.3)',
                  color: '#fbbf24', fontSize: 12, textDecoration: 'none',
                  background: 'rgba(251,191,36,0.06)'
                }}
              >
                <ExternalLink size={12} /> View on Stellar Explorer
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
