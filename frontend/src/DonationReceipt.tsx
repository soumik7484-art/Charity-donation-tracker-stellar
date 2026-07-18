/**
 * DonationReceipt.tsx
 * Beautiful donation receipt slip shown after every successful on-chain donation.
 * Supports PDF download via jsPDF + html2canvas.
 */

import { useRef } from 'react'
import { ExternalLink, Download, X, CheckCircle, Shield, Hash, Clock, Wallet, Globe } from 'lucide-react'

export interface ReceiptData {
  txHash: string
  blockNumber: number
  timestamp: string          // ISO string
  amount: number             // XLM
  campaignTitle: string
  campaignId: number
  senderWallet: string
  receiverContract: string
  network: string
  anonymous: boolean
}

interface Props {
  receipt: ReceiptData | null
  onClose: () => void
}

/** Trim wallet/hash for display */
const short = (s: string) => (s ? `${s.slice(0, 6)}…${s.slice(-6)}` : '–')

export default function DonationReceipt({ receipt, onClose }: Props) {
  const slipRef = useRef<HTMLDivElement>(null)

  if (!receipt) return null

  const formattedDate = new Date(receipt.timestamp).toLocaleString([], {
    dateStyle: 'long',
    timeStyle: 'medium',
  })

  const explorerUrl = `https://stellar.expert/explorer/testnet/tx/${receipt.txHash}`

  /** Download the slip as a PDF using jsPDF + html2canvas */
  const downloadPDF = async () => {
    if (!slipRef.current) return
    try {
      // Dynamically import to avoid SSR issues
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import('jspdf'),
        import('html2canvas'),
      ])

      const canvas = await html2canvas(slipRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
      })

      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a5' })

      const pageW = pdf.internal.pageSize.getWidth()
      const pageH = pdf.internal.pageSize.getHeight()
      const imgW = pageW
      const imgH = (canvas.height / canvas.width) * imgW
      const yOffset = imgH < pageH ? (pageH - imgH) / 2 : 0

      pdf.addImage(imgData, 'PNG', 0, yOffset, imgW, imgH)
      pdf.save(`CharityChain_Receipt_${receipt.txHash.slice(0, 8)}.pdf`)
    } catch (err) {
      console.error('PDF generation failed:', err)
      // Fallback: open in new tab for manual save
      window.print()
    }
  }

  return (
    /* ── Modal Backdrop ─────────────────────────────────────────────── */
    <div className="modal-mask" onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-hv)',
        borderRadius: 24,
        width: '100%',
        maxWidth: 480,
        overflow: 'hidden',
        boxShadow: '0 8px 60px rgba(0,229,160,0.12), 0 0 0 1px rgba(0,229,160,0.08)',
        animation: 'slideUp 0.25s ease',
      }}>

        {/* ── Action Bar ─────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '1rem 1.25rem',
          borderBottom: '1px solid var(--border)',
        }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Donation Receipt
          </span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn-launch" onClick={downloadPDF} style={{ padding: '0.4rem 1rem', fontSize: '0.78rem' }}>
              <Download size={13}/> Download PDF
            </button>
            <button onClick={onClose} style={{
              background: 'transparent', border: '1px solid var(--border)',
              borderRadius: 8, color: 'var(--t3)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 32, height: 32,
            }}>
              <X size={15}/>
            </button>
          </div>
        </div>

        {/* ── The Receipt Slip (this is what gets captured into PDF) ─── */}
        <div ref={slipRef} style={{
          background: '#ffffff',
          color: '#111',
          fontFamily: "'Outfit', system-ui, sans-serif",
          padding: '2rem',
        }}>

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 56, height: 56,
              background: 'linear-gradient(135deg,#00e5a0,#00c4ff)',
              borderRadius: 16, fontSize: '1.75rem', marginBottom: '0.75rem',
            }}>💝</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#050810', letterSpacing: '-0.03em' }}>
              CharityChain
            </div>
            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#6b7fa0', textTransform: 'uppercase', letterSpacing: '0.12em', marginTop: '0.15rem' }}>
              Blockchain Donation Receipt
            </div>
          </div>

          {/* Success badge */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
            background: 'linear-gradient(135deg, rgba(0,229,160,0.1), rgba(0,196,255,0.08))',
            border: '1.5px solid rgba(0,229,160,0.35)',
            borderRadius: 999, padding: '0.6rem 1.25rem',
            marginBottom: '1.75rem',
          }}>
            <CheckCircle size={16} color="#00e5a0"/>
            <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#059669' }}>
              Transaction Confirmed on Stellar Blockchain
            </span>
          </div>

          {/* Amount highlight */}
          <div style={{
            textAlign: 'center',
            background: 'linear-gradient(135deg,#050810 0%,#0d1b2a 100%)',
            borderRadius: 16,
            padding: '1.5rem',
            marginBottom: '1.5rem',
          }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#6b7fa0', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.4rem' }}>
              Amount Donated
            </div>
            <div style={{
              fontSize: '3.2rem', fontWeight: 900, lineHeight: 1,
              background: 'linear-gradient(135deg,#00e5a0,#00c4ff)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              letterSpacing: '-0.04em',
            }}>
              {receipt.amount.toLocaleString()}
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#94a3b8', marginTop: '0.2rem' }}>XLM (Stellar Lumens)</div>
            <div style={{ fontSize: '0.7rem', color: '#475569', marginTop: '0.5rem' }}>
              ≈ ${(receipt.amount * 0.11).toFixed(4)} USD · {receipt.anonymous ? '🎭 Anonymous Donor' : ''}
            </div>
          </div>

          {/* Detail rows */}
          {[
            [<Hash size={13} color="#00e5a0"/>, 'Transaction Hash', receipt.txHash.length > 20 ? `${receipt.txHash.slice(0,20)}…${receipt.txHash.slice(-8)}` : receipt.txHash, 'monospace'],
            [<Shield size={13} color="#00c4ff"/>, 'Block Number', `#${receipt.blockNumber.toLocaleString()}`, 'monospace'],
            [<Clock size={13} color="#a78bfa"/>, 'Date & Time', formattedDate, 'normal'],
            [<Wallet size={13} color="#fb923c"/>, 'Donor Wallet', receipt.anonymous ? '🎭 Anonymous' : short(receipt.senderWallet), 'monospace'],
            [<Globe size={13} color="#f43f5e"/>, 'Campaign', `#${receipt.campaignId} — ${receipt.campaignTitle}`, 'normal'],
          ].map(([icon, label, value, fontType]) => (
            <div key={label as string} style={{
              display: 'flex', alignItems: 'flex-start', gap: '0.85rem',
              padding: '0.75rem 0',
              borderBottom: '1px solid #f1f5f9',
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: '#f8fafc',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>{icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.15rem' }}>
                  {label as string}
                </div>
                <div style={{
                  fontSize: fontType === 'monospace' ? '0.72rem' : '0.84rem',
                  fontFamily: fontType === 'monospace' ? 'monospace' : 'inherit',
                  fontWeight: 600, color: '#1e293b',
                  wordBreak: 'break-all', lineHeight: 1.4,
                }}>
                  {value as string}
                </div>
              </div>
            </div>
          ))}

          {/* Network badge */}
          <div style={{
            display: 'flex', gap: '0.5rem', marginTop: '1rem', marginBottom: '1rem', flexWrap: 'wrap',
          }}>
            {[
              { label: 'Network: Stellar Testnet', color: '#00e5a0' },
              { label: 'Status: ✓ Confirmed', color: '#00c4ff' },
              { label: 'Fees: 0.00001 XLM', color: '#a78bfa' },
            ].map(({ label, color }) => (
              <div key={label} style={{
                padding: '0.3rem 0.85rem',
                borderRadius: 999,
                fontSize: '0.7rem', fontWeight: 600, color,
                background: `${color}15`,
                border: `1px solid ${color}40`,
              }}>
                {label}
              </div>
            ))}
          </div>

          {/* Verify on explorer */}
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 12,
            padding: '1rem',
            marginBottom: '1.25rem',
          }}>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem' }}>
              Verify This Transaction
            </div>
            <div style={{ fontSize: '0.68rem', fontFamily: 'monospace', color: '#334155', wordBreak: 'break-all', lineHeight: 1.5 }}>
              {explorerUrl}
            </div>
          </div>

          {/* Footer */}
          <div style={{
            textAlign: 'center',
            paddingTop: '1rem',
            borderTop: '1px dashed #e2e8f0',
          }}>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', lineHeight: 1.6 }}>
              This receipt confirms your donation is permanently recorded on the
              <br/>Stellar blockchain and is publicly verifiable by anyone.
            </div>
            <div style={{ fontSize: '0.65rem', color: '#cbd5e1', marginTop: '0.5rem', fontFamily: 'monospace' }}>
              Generated by CharityChain · {new Date().toLocaleDateString()}
            </div>
          </div>
        </div>

        {/* ── Bottom actions ──────────────────────────────────────────── */}
        <div style={{
          display: 'flex', gap: '0.75rem',
          padding: '1rem 1.25rem',
          borderTop: '1px solid var(--border)',
        }}>
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost"
            style={{ flex: 1, justifyContent: 'center' }}
          >
            <ExternalLink size={13}/> View on Stellar Expert
          </a>
          <button className="btn-launch" onClick={downloadPDF} style={{ flex: 1, justifyContent: 'center' }}>
            <Download size={13}/> Download PDF
          </button>
        </div>
      </div>
    </div>
  )
}
