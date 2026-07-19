/**
 * AdminPanel.tsx
 * Wallet-gated admin panel for managing verified charity creators.
 * Only visible to the contract admin (ALICE_ADDRESS).
 */
import { useState } from 'react'
import { Shield, CheckCircle, XCircle, Loader2, ExternalLink, Plus, Trash2, AlertCircle } from 'lucide-react'
import * as StellarService from '../stellar'
import type { Campaign } from '../stellar'

interface Props {
  walletAddress: string
  campaigns: Campaign[]
  onRefresh: () => void
}

export default function AdminPanel({ walletAddress, campaigns, onRefresh }: Props) {
  const isAdmin = walletAddress === StellarService.ALICE_ADDRESS

  const [newAddress, setNewAddress] = useState('')
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [txLinks, setTxLinks] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Build list of all known creator addresses from campaigns
  const knownCreators = Array.from(new Set(campaigns.map(c => c.creator)))
  const verifiedFromCampaigns = campaigns.filter(c => c.verified).map(c => c.creator)
  const verifiedSet = new Set(verifiedFromCampaigns)

  function flash(msg: string) {
    setSuccess(msg)
    setTimeout(() => setSuccess(null), 3000)
  }

  async function handleVerify(address: string) {
    setError(null)
    setLoading(p => ({ ...p, [address]: true }))
    try {
      const { txHash } = await StellarService.addVerifiedCreator(address)
      setTxLinks(p => ({ ...p, [address]: txHash }))
      flash(`✅ ${address.slice(0, 8)}… verified successfully`)
      onRefresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Verification failed')
    } finally {
      setLoading(p => ({ ...p, [address]: false }))
    }
  }

  async function handleRevoke(address: string) {
    setError(null)
    setLoading(p => ({ ...p, [`revoke_${address}`]: true }))
    try {
      const { txHash } = await StellarService.removeVerifiedCreator(address)
      setTxLinks(p => ({ ...p, [`revoke_${address}`]: txHash }))
      flash(`Revoked verification for ${address.slice(0, 8)}…`)
      onRefresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Revoke failed')
    } finally {
      setLoading(p => ({ ...p, [`revoke_${address}`]: false }))
    }
  }

  async function handleAddNew() {
    if (!newAddress.trim()) return
    await handleVerify(newAddress.trim())
    setNewAddress('')
  }

  if (!isAdmin) {
    return (
      <div style={{
        textAlign: 'center', padding: '60px 20px',
        background: 'rgba(239,68,68,0.05)',
        border: '1px solid rgba(239,68,68,0.15)',
        borderRadius: 16
      }}>
        <Shield size={48} style={{ opacity: 0.2, color: '#ef4444', marginBottom: 16 }} />
        <div style={{ fontSize: 16, fontWeight: 700, color: '#f87171', marginBottom: 8 }}>
          Access Restricted
        </div>
        <div style={{ fontSize: 13, color: '#6b7280' }}>
          This panel is only accessible to the contract administrator.
        </div>
        <div style={{ fontSize: 11, color: '#4b5563', marginTop: 8 }}>
          Connected: {walletAddress.slice(0, 12)}…
        </div>
      </div>
    )
  }

  return (
    <div style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24,
        padding: '16px 20px',
        background: 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(0,229,160,0.04))',
        border: '1px solid rgba(16,185,129,0.2)', borderRadius: 14
      }}>
        <div style={{
          width: 42, height: 42, borderRadius: '50%',
          background: 'rgba(16,185,129,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <Shield size={22} color="#10b981" />
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9' }}>Charity Verification Panel</div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>Manage verified creator allowlist · Admin: {walletAddress.slice(0, 10)}…</div>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div style={{
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 10, padding: '10px 14px', marginBottom: 14,
          color: '#f87171', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8
        }}>
          <AlertCircle size={14} /> {error}
        </div>
      )}
      {success && (
        <div style={{
          background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
          borderRadius: 10, padding: '10px 14px', marginBottom: 14,
          color: '#10b981', fontSize: 13
        }}>
          {success}
        </div>
      )}

      {/* Add new creator */}
      <div style={{
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 14, padding: '18px 20px', marginBottom: 20
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#9ca3af', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
          Verify New Creator
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            value={newAddress}
            onChange={e => setNewAddress(e.target.value)}
            placeholder="Paste Stellar wallet address (G…)"
            style={{
              flex: 1, background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)', borderRadius: 9,
              padding: '10px 14px', color: '#f1f5f9', fontSize: 13, outline: 'none',
              fontFamily: 'monospace'
            }}
          />
          <button
            onClick={handleAddNew}
            disabled={!newAddress.trim() || loading[newAddress]}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '10px 18px', borderRadius: 9, border: 'none',
              background: 'linear-gradient(135deg,#10b981,#059669)',
              color: '#fff', fontSize: 13, fontWeight: 700,
              cursor: !newAddress.trim() || loading[newAddress] ? 'not-allowed' : 'pointer',
              opacity: !newAddress.trim() ? 0.5 : 1
            }}
          >
            <Plus size={15} /> Verify
          </button>
        </div>
      </div>

      {/* Creator table */}
      <div style={{ fontSize: 13, fontWeight: 600, color: '#9ca3af', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
        Campaign Creators ({knownCreators.length})
      </div>

      {knownCreators.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#6b7280', padding: '30px 0', fontSize: 13 }}>
          No campaigns created yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {knownCreators.map(address => {
            const isVerified     = verifiedSet.has(address)
            const creatorCamps   = campaigns.filter(c => c.creator === address)
            const txKey          = isVerified ? `revoke_${address}` : address
            const isLoading      = loading[address] || loading[`revoke_${address}`]

            return (
              <div
                key={address}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 18px',
                  background: isVerified
                    ? 'rgba(16,185,129,0.06)'
                    : 'rgba(255,255,255,0.03)',
                  border: isVerified
                    ? '1px solid rgba(16,185,129,0.2)'
                    : '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 12
                }}
              >
                {/* Status icon */}
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                  background: isVerified ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.05)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  {isVerified
                    ? <CheckCircle size={18} color="#10b981" />
                    : <XCircle size={18} color="#6b7280" />
                  }
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, fontWeight: 600, color: '#f1f5f9',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    fontFamily: 'monospace'
                  }}>
                    {address}
                  </div>
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                    {creatorCamps.length} campaign{creatorCamps.length !== 1 ? 's' : ''}
                    {isVerified && <span style={{ color: '#10b981', marginLeft: 8 }}>✅ Verified Charity</span>}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  {txLinks[txKey] && (
                    <a
                      href={StellarService.explorerTxUrl(txLinks[txKey])}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        padding: '6px 10px', borderRadius: 7,
                        border: '1px solid rgba(0,196,255,0.25)',
                        color: '#00c4ff', fontSize: 11, textDecoration: 'none'
                      }}
                    >
                      <ExternalLink size={11} /> Tx
                    </a>
                  )}

                  {isVerified ? (
                    <button
                      onClick={() => handleRevoke(address)}
                      disabled={isLoading}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '7px 14px', borderRadius: 8, border: 'none',
                        background: 'rgba(239,68,68,0.15)', color: '#f87171',
                        fontSize: 12, fontWeight: 600,
                        cursor: isLoading ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {isLoading
                        ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
                        : <Trash2 size={13} />
                      }
                      Revoke
                    </button>
                  ) : (
                    <button
                      onClick={() => handleVerify(address)}
                      disabled={isLoading}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '7px 14px', borderRadius: 8, border: 'none',
                        background: 'rgba(16,185,129,0.15)', color: '#10b981',
                        fontSize: 12, fontWeight: 600,
                        cursor: isLoading ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {isLoading
                        ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
                        : <CheckCircle size={13} />
                      }
                      Verify
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
