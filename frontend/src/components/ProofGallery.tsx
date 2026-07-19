/**
 * ProofGallery.tsx
 * Grid gallery of IPFS proof documents per campaign milestone.
 * Shows thumbnails for images, icons for PDFs/docs, with gateway links.
 */
import { useState } from 'react'
import { FileText, ExternalLink, Eye, X } from 'lucide-react'
import type { Campaign } from '../stellar'
import { ipfsUrl, ipfsPublicUrl } from '../ipfs'

interface Props {
  campaign: Campaign
}

export default function ProofGallery({ campaign }: Props) {
  const [lightbox, setLightbox] = useState<string | null>(null)

  const proofMilestones = campaign.milestones.filter(m => m.proof_submitted && m.proof_cid)

  if (proofMilestones.length === 0) {
    return (
      <div style={{
        textAlign: 'center', padding: '36px 0', color: '#6b7280', fontSize: 14
      }}>
        <FileText size={36} style={{ opacity: 0.3, marginBottom: 10 }} />
        <p>No proof documents uploaded yet.</p>
        <p style={{ fontSize: 12, marginTop: 4 }}>
          Campaign creator submits receipts / photos per milestone.
        </p>
      </div>
    )
  }

  return (
    <>
      {/* Lightbox */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, cursor: 'zoom-out'
          }}
        >
          <button
            onClick={() => setLightbox(null)}
            style={{
              position: 'absolute', top: 20, right: 24,
              background: 'rgba(255,255,255,0.1)', border: 'none',
              borderRadius: '50%', width: 40, height: 40,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: '#fff'
            }}
          >
            <X size={20} />
          </button>
          <img
            src={lightbox}
            alt="Proof"
            style={{
              maxWidth: '90vw', maxHeight: '85vh',
              borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.6)'
            }}
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: 16
      }}>
        {proofMilestones.map((m) => {
          const gatewayUrl    = ipfsUrl(m.proof_cid)
          const publicGateway = ipfsPublicUrl(m.proof_cid)

          // Determine file type from CID prefix or fallback
          const looksLikeImage = m.proof_cid.startsWith('bafybeig') || m.proof_cid.startsWith('Qm')

          return (
            <div
              key={m.index}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 14, overflow: 'hidden',
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'
                ;(e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 24px rgba(0,229,160,0.1)'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.transform = 'none'
                ;(e.currentTarget as HTMLDivElement).style.boxShadow = 'none'
              }}
            >
              {/* Preview area */}
              <div
                style={{
                  height: 140, background: 'rgba(0,0,0,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: looksLikeImage ? 'zoom-in' : 'default',
                  position: 'relative', overflow: 'hidden'
                }}
                onClick={() => looksLikeImage && setLightbox(gatewayUrl)}
              >
                {looksLikeImage ? (
                  <img
                    src={gatewayUrl}
                    alt="Proof"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={e => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none'
                    }}
                  />
                ) : (
                  <div style={{ textAlign: 'center', color: '#6b7280' }}>
                    <FileText size={40} style={{ opacity: 0.5 }} />
                    <div style={{ fontSize: 11, marginTop: 6 }}>Document</div>
                  </div>
                )}

                {looksLikeImage && (
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: 'rgba(0,0,0,0)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    opacity: 0, transition: 'opacity 0.2s'
                  }}
                    className="proof-hover-overlay"
                  >
                    <Eye size={24} color="#fff" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div style={{ padding: '12px 14px' }}>
                <div style={{
                  fontSize: 13, fontWeight: 600, color: '#f1f5f9', marginBottom: 4,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                }}>
                  Milestone {m.index + 1}: {m.title}
                </div>

                <div style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  fontSize: 11, color: '#6b7280', marginBottom: 10
                }}>
                  <span>CID:</span>
                  <code style={{ color: '#00e5a0', fontSize: 10 }}>
                    {m.proof_cid.slice(0, 16)}…
                  </code>
                </div>

                {/* Status badge */}
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                    ...(m.approved
                      ? { background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }
                      : { background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }
                    )
                  }}>
                    {m.approved ? '✓ Admin Verified' : '⏳ Pending Review'}
                  </span>

                  {m.claimed && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                      background: 'rgba(0,229,160,0.12)', color: '#00e5a0',
                      border: '1px solid rgba(0,229,160,0.25)'
                    }}>
                      💸 Released
                    </span>
                  )}
                </div>

                {/* Links */}
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <a
                    href={publicGateway}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      gap: 5, padding: '6px 0', borderRadius: 7,
                      background: 'rgba(0,229,160,0.1)', border: '1px solid rgba(0,229,160,0.2)',
                      color: '#00e5a0', fontSize: 11, fontWeight: 600, textDecoration: 'none'
                    }}
                  >
                    <ExternalLink size={11} /> IPFS.io
                  </a>
                  <a
                    href={gatewayUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      gap: 5, padding: '6px 0', borderRadius: 7,
                      background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.2)',
                      color: '#a78bfa', fontSize: 11, fontWeight: 600, textDecoration: 'none'
                    }}
                  >
                    <ExternalLink size={11} /> Pinata
                  </a>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
