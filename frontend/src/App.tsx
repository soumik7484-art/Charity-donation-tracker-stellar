import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  Heart, Plus, Copy, Check, Clock,
  Layers, ExternalLink, Database,
  BarChart2, Home, Bell, Settings, Zap,
  RefreshCw, Loader2, AlertCircle
} from 'lucide-react'
import * as StellarService from './stellar'
import type { Campaign } from './stellar'

// ─── Types ────────────────────────────────────────────────────────────────────
interface LogEntry { ts: string; type: 'sys'|'info'|'success'|'error'; msg: string }
interface ToastState { on: boolean; icon: string; msg: string; txHash?: string }

// ─── Helpers ──────────────────────────────────────────────────────────────────
const EMOJIS  = ['🪸','💧','💻','🌱','🌍','🏥','📚','🐘','🦋','☀️','🦅','🌸']
const THEMES  = ['var(--cb-ocean)','var(--cb-sage)','var(--cb-violet)','var(--cb-peach)','var(--cb-rose)','var(--cb-sky)']
const short   = (s: string) => s ? s.slice(0,4)+'…'+s.slice(-4) : ''
const now     = () => new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'})
const daysLeft = (deadline: number, ledger: number) => {
  const rem = deadline - ledger
  if (rem <= 0) return 0
  return Math.ceil(rem / 14400) // ~14400 ledgers per day
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function App() {
  const [campaigns,   setCampaigns] = useState<Campaign[]>([])
  const [ledger,      setLedger]    = useState(0)
  const [loading,     setLoading]   = useState(true)
  const [refreshing,  setRefreshing]= useState(false)
  const [error,       setError]     = useState<string|null>(null)
  const [logs,        setLogs]      = useState<LogEntry[]>([
    { ts: now(), type:'sys',  msg:`Connecting to Stellar Testnet RPC…` },
    { ts: now(), type:'info', msg:`Contract: ${StellarService.CONTRACT_ID}` },
    { ts: now(), type:'sys',  msg:`Wallet: ${StellarService.ALICE_ADDRESS}` },
  ])
  const [modal,       setModal]     = useState(false)
  const [copied,      setCopied]    = useState(false)
  const [toast,       setToast]     = useState<ToastState>({ on:false, icon:'', msg:'' })
  const [donAmt,      setDonAmt]    = useState<Record<number,string>>({})
  const [txPending,   setTxPending] = useState<Record<string,boolean>>({})

  // Form fields
  const [fTitle, setFTitle] = useState('')
  const [fDesc,  setFDesc]  = useState('')
  const [fGoal,  setFGoal]  = useState('')
  const [fDays,  setFDays]  = useState('')
  const [fEmoji, setFEmoji] = useState('🌱')

  const logRef = useRef<HTMLDivElement>(null)

  // ── Log helper ────────────────────────────────────────────────
  function log(type: LogEntry['type'], msg: string) {
    setLogs(p => [...p.slice(-100), { ts: now(), type, msg }])
  }

  // ── Toast helper ──────────────────────────────────────────────
  function flash(icon: string, msg: string, txHash?: string) {
    setToast({ on: true, icon, msg, txHash })
    setTimeout(() => setToast(t => ({ ...t, on: false })), 4000)
  }

  // ── Scroll terminal ───────────────────────────────────────────
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [logs])

  // ── Load from chain ───────────────────────────────────────────
  const loadFromChain = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
    else setRefreshing(true)
    setError(null)
    try {
      log('sys', 'Fetching ledger height…')
      const l = await StellarService.getLedger()
      setLedger(l)
      log('info', `Ledger #${l.toLocaleString()} · Reading campaigns…`)

      const count = await StellarService.getCount()
      log('info', `Found ${count} campaign(s) on-chain`)

      if (count > 0) {
        const all = await StellarService.getAllCampaigns()
        setCampaigns(all)
        log('success', `Loaded ${all.length} campaigns from blockchain ✓`)
      } else {
        setCampaigns([])
        log('sys', 'No campaigns yet — be the first to create one!')
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      log('error', `Chain read error: ${msg}`)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  // Initial load
  useEffect(() => { loadFromChain() }, [loadFromChain])

  // Poll ledger every 8s
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const l = await StellarService.getLedger()
        setLedger(l)
        log('sys', `Ledger #${l.toLocaleString()} closed`)
      } catch { /* ignore */ }
    }, 8000)
    return () => clearInterval(id)
  }, [])

  // ── Create campaign ───────────────────────────────────────────
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const goal = parseFloat(fGoal), days = parseInt(fDays)
    if (!fTitle || isNaN(goal) || isNaN(days)) return

    setModal(false)
    log('info', `Submitting create_campaign("${fTitle}", goal=${goal} XLM, ${days} days)…`)
    setTxPending(p => ({ ...p, create: true }))

    try {
      const { id, txHash } = await StellarService.createCampaign(fTitle, goal, days)
      log('success', `✓ Campaign #${id} created on-chain! tx: ${txHash.slice(0,8)}…`)
      flash('🚀', `"${fTitle}" is live on Stellar!`, txHash)
      await loadFromChain(true)
      setFTitle(''); setFDesc(''); setFGoal(''); setFDays(''); setFEmoji('🌱')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      log('error', `create_campaign failed: ${msg}`)
      flash('❌', `Error: ${msg.slice(0,60)}`)
    } finally {
      setTxPending(p => ({ ...p, create: false }))
    }
  }

  // ── Donate ────────────────────────────────────────────────────
  const handleDonate = async (id: number) => {
    const amt = parseFloat(donAmt[id] ?? '')
    if (!amt || amt <= 0) return

    log('info', `Submitting donate(campaign=${id}, amount=${amt} XLM)…`)
    setTxPending(p => ({ ...p, [`d${id}`]: true }))

    try {
      const { txHash } = await StellarService.donate(id, amt)
      log('success', `✓ Donated ${amt} XLM to campaign #${id}! tx: ${txHash.slice(0,8)}…`)
      flash('💙', `${amt} XLM donated on-chain!`, txHash)
      setDonAmt(p => ({ ...p, [id]: '' }))
      await loadFromChain(true)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      log('error', `donate failed: ${msg}`)
      flash('❌', `Error: ${msg.slice(0,60)}`)
    } finally {
      setTxPending(p => ({ ...p, [`d${id}`]: false }))
    }
  }

  // ── Claim ─────────────────────────────────────────────────────
  const handleClaim = async (id: number) => {
    log('info', `Submitting claim(campaign=${id})…`)
    setTxPending(p => ({ ...p, [`c${id}`]: true }))
    try {
      const { txHash } = await StellarService.claimCampaign(id)
      log('success', `✓ Campaign #${id} funds claimed! tx: ${txHash.slice(0,8)}…`)
      flash('🎉', 'Funds claimed successfully!', txHash)
      await loadFromChain(true)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      log('error', `claim failed: ${msg}`)
      flash('❌', `Error: ${msg.slice(0,60)}`)
    } finally {
      setTxPending(p => ({ ...p, [`c${id}`]: false }))
    }
  }

  // ── Copy contract address ─────────────────────────────────────
  const copyContract = () => {
    navigator.clipboard.writeText(StellarService.CONTRACT_ID)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    flash('📋', 'Contract address copied!')
  }

  // ── Stats ─────────────────────────────────────────────────────
  const totalRaised  = campaigns.reduce((s,c) => s + c.raised, 0)
  const activeCount  = campaigns.filter(c => !c.claimed && daysLeft(c.deadline, ledger) > 0).length
  const doneCount    = campaigns.filter(c => c.raised >= c.goal).length

  // ── Render ────────────────────────────────────────────────────
  return (
    <>
      <div className="shell">
        {/* ── Sidebar ──────────────────────────────── */}
        <aside className="sidebar">
          <div className="sb-logo">💝</div>
          <div className="sb-icon active" title="Dashboard"><Home size={18}/></div>
          <div className="sb-icon" title="Analytics"><BarChart2 size={18}/></div>
          <div className="sb-sep"/>
          <div className="sb-icon" title="Notifications"><Bell size={17}/></div>
          <div className="sb-icon" title="Settings"><Settings size={17}/></div>
          <div className="sb-avatar" title={StellarService.ALICE_ADDRESS}>
            {StellarService.ALICE_ADDRESS.slice(0,2)}
          </div>
        </aside>

        <div className="content-wrap">
          {/* ── Main ─────────────────────────────────── */}
          <main className="main">
            {/* topbar */}
            <div className="topbar">
              <div className="topbar-brand">
                <span className="topbar-brand-dot"/>
                CharityChain
              </div>
              <div className="topbar-right">
                <div className="pill pill-mono">
                  <Layers size={11}/>
                  #{ledger.toLocaleString()}
                </div>
                <div className="pill pill-green">
                  <span className="pill-dot"/>
                  Live · Testnet
                </div>
                <button
                  className="pill pill-mono pill-btn"
                  onClick={() => loadFromChain(true)}
                  title="Refresh from blockchain"
                >
                  <RefreshCw size={11} className={refreshing ? 'spin' : ''}/>
                  {refreshing ? 'Syncing…' : 'Refresh'}
                </button>
                <button className="btn-launch" onClick={() => setModal(true)} id="btn-new">
                  <Plus size={15}/> New Campaign
                </button>
              </div>
            </div>

            {/* hero */}
            <div className="hero">
              <div className="hero-blob-1"/>
              <div className="hero-blob-2"/>
              <div className="hero-blob-3"/>
              <div className="hero-tag">Live on Stellar Blockchain</div>
              <div className="hero-number">
                {loading ? '—' : totalRaised.toLocaleString()}
                <span className="hero-unit"> XLM</span>
              </div>
              <p className="hero-sub">
                Raised across {campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''} — every transaction permanently recorded on-chain
              </p>
              <div className="hero-stats">
                <div className="hstat">
                  <span className="hstat-n">{activeCount}</span>
                  <span className="hstat-l">Active campaigns</span>
                </div>
                <div className="hstat">
                  <span className="hstat-n">{doneCount}</span>
                  <span className="hstat-l">Goals reached</span>
                </div>
                <div className="hstat">
                  <span className="hstat-n">0%</span>
                  <span className="hstat-l">Platform fee</span>
                </div>
                <div className="hstat">
                  <span className="hstat-n">Testnet</span>
                  <span className="hstat-l">Stellar Network</span>
                </div>
              </div>
            </div>

            {/* error banner */}
            {error && (
              <div style={{
                background:'#fef2f2', border:'1px solid #fecaca', borderRadius:12,
                padding:'1rem 1.25rem', marginBottom:'1.5rem',
                display:'flex', alignItems:'center', gap:'0.75rem',
                color:'#991b1b', fontSize:'0.85rem'
              }}>
                <AlertCircle size={16}/>
                <span><strong>Blockchain connection error:</strong> {error}</span>
                <button
                  onClick={() => loadFromChain()}
                  style={{marginLeft:'auto', background:'#fee2e2', border:'1px solid #fca5a5',
                    borderRadius:6, padding:'0.25rem 0.6rem', cursor:'pointer', color:'#991b1b', fontSize:'0.78rem'}}
                >
                  Retry
                </button>
              </div>
            )}

            {/* campaigns */}
            <div className="section-head">
              <span className="section-label">
                {loading ? 'Loading from blockchain…' : `${campaigns.length} Campaign${campaigns.length !== 1?'s':''} on Chain`}
              </span>
              <a
                href={StellarService.explorerContractUrl()}
                target="_blank" rel="noopener noreferrer"
                style={{display:'flex', alignItems:'center', gap:'0.3rem',
                  fontSize:'0.72rem', color:'var(--t3)', textDecoration:'none'}}
              >
                <ExternalLink size={12}/> View Contract
              </a>
            </div>

            {/* Loading skeleton */}
            {loading && (
              <div style={{display:'flex', flexDirection:'column', gap:'1rem'}}>
                {[1,2,3].map(i => (
                  <div key={i} style={{
                    height:220, background:'var(--card)', border:'1px solid var(--line)',
                    borderRadius:20, animation:'skeleton 1.4s ease infinite',
                    opacity: 1 - (i-1)*0.2
                  }}/>
                ))}
              </div>
            )}

            {/* Campaign grid */}
            {!loading && (
              <div className="camp-grid">
                {campaigns.length === 0 && !error && (
                  <div style={{
                    gridColumn:'1/-1', textAlign:'center', padding:'4rem 2rem',
                    color:'var(--t3)', background:'var(--card)', borderRadius:20,
                    border:'1px dashed var(--line-2)'
                  }}>
                    <div style={{fontSize:'3rem', marginBottom:'1rem'}}>🌱</div>
                    <div style={{fontWeight:600, fontSize:'1rem', color:'var(--t2)', marginBottom:'0.5rem'}}>
                      No campaigns yet
                    </div>
                    <div style={{fontSize:'0.85rem'}}>
                      Be the first to launch a fundraising campaign on Stellar!
                    </div>
                    <button
                      className="btn-launch"
                      style={{marginTop:'1.5rem'}}
                      onClick={() => setModal(true)}
                    >
                      <Plus size={15}/> Create First Campaign
                    </button>
                  </div>
                )}

                {campaigns.map((c, idx) => {
                  const pct      = Math.min((c.raised / c.goal) * 100, 100)
                  const goalMet  = c.raised >= c.goal
                  const dl       = daysLeft(c.deadline, ledger)
                  const expired  = dl === 0 && !goalMet
                  const emoji    = EMOJIS[idx % EMOJIS.length]
                  const theme    = THEMES[idx % THEMES.length]
                  const isPending = txPending[`d${c.id}`] || txPending[`c${c.id}`]

                  return (
                    <div className="camp-card" key={c.id} id={`camp-${c.id}`}>
                      {/* coloured header band */}
                      <div className="camp-band" style={{ background: theme }}>
                        <span className="camp-emoji">{emoji}</span>
                        <div className={`camp-status ${
                          c.claimed ? 'cs-claimed' : goalMet ? 'cs-done' : expired ? 'cs-expired' : 'cs-active'
                        }`}>
                          {c.claimed ? '✓ Claimed' : goalMet ? '✓ Goal Met' : expired ? 'Ended' : '● Active'}
                        </div>
                      </div>

                      <div className="camp-body">
                        <div className="camp-creator">#{c.id} · by {short(c.creator)}</div>
                        <div className="camp-title">{c.title}</div>
                        <p className="camp-desc" style={{color:'var(--t3)', fontSize:'0.8rem'}}>
                          Campaign recorded on Stellar Testnet ledger
                        </p>

                        <div className="camp-prog">
                          <div className="prog-nums">
                            <span className="prog-raised">{c.raised.toLocaleString()} XLM</span>
                            <span className="prog-of">of {c.goal.toLocaleString()} XLM</span>
                          </div>
                          <div className="prog-track">
                            <div
                              className={`prog-fill ${c.claimed ? 'pf-claimed' : goalMet ? 'pf-done' : 'pf-active'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <div className="prog-meta">
                            <span>{pct.toFixed(0)}% funded</span>
                            <span>{dl > 0 ? `${dl}d left` : 'Deadline reached'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="camp-foot">
                        <div className="camp-time">
                          <Clock size={12}/>
                          Ledger #{c.deadline.toLocaleString()}
                        </div>

                        <div className="camp-actions">
                          {isPending && (
                            <span style={{display:'flex', alignItems:'center', gap:'0.35rem',
                              fontSize:'0.75rem', color:'var(--t3)'}}>
                              <Loader2 size={13} className="spin"/>
                              Submitting…
                            </span>
                          )}

                          {!isPending && !c.claimed && !expired && !goalMet && (
                            <>
                              <input
                                id={`inp-${c.id}`}
                                className="amt-input"
                                type="number"
                                placeholder="XLM"
                                value={donAmt[c.id] ?? ''}
                                onChange={e => setDonAmt(p => ({...p, [c.id]: e.target.value}))}
                                min="1"
                              />
                              <button
                                id={`btn-donate-${c.id}`}
                                className="btn-donate"
                                onClick={() => handleDonate(c.id)}
                              >
                                <Heart size={12}/> Donate
                              </button>
                            </>
                          )}

                          {!isPending && goalMet && !c.claimed && (
                            <button
                              id={`btn-claim-${c.id}`}
                              className="btn-claim"
                              onClick={() => handleClaim(c.id)}
                            >
                              <Zap size={12}/> Claim Payout
                            </button>
                          )}

                          {expired && !goalMet && (
                            <span style={{fontSize:'0.72rem', color:'var(--t4)', fontStyle:'italic'}}>
                              Refund eligible
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <footer className="footer">
              <span>CharityChain · Soroban Smart Contracts on Stellar Testnet</span>
              <a href={StellarService.explorerContractUrl()} target="_blank" rel="noopener noreferrer">
                {StellarService.CONTRACT_ID.slice(0,16)}…
              </a>
            </footer>
          </main>

          {/* ── Right Panel ───────────────────────── */}
          <aside className="right-panel">
            {/* Contract */}
            <div className="rp-widget">
              <div className="rp-label"><Database size={11}/> Smart Contract</div>
              <div className="contract-row">
                <span className="contract-addr">{StellarService.CONTRACT_ID}</span>
                <button
                  id="btn-copy"
                  className={`copy-btn${copied?' ok':''}`}
                  onClick={copyContract}
                >
                  {copied ? <Check size={12}/> : <Copy size={12}/>}
                </button>
              </div>
              <div style={{marginTop:'0.65rem', fontSize:'0.68rem', color:'var(--t4)', lineHeight:1.6}}>
                <div>Wallet: <span style={{fontFamily:'var(--f-mono)'}}>{short(StellarService.ALICE_ADDRESS)}</span></div>
                <div>Network: Stellar Testnet</div>
                <div>RPC: soroban-testnet.stellar.org</div>
              </div>
            </div>

            {/* Live Terminal */}
            <div className="rp-widget">
              <div className="rp-label">Soroban RPC Console</div>
              <div className="terminal">
                <div className="term-chrome">
                  <div className="tdots">
                    <span className="tdot td-r"/><span className="tdot td-y"/><span className="tdot td-g"/>
                  </div>
                  <span className="term-label">stellar testnet · live</span>
                </div>
                <div className="term-body" ref={logRef}>
                  {logs.map((l, i) => (
                    <div key={i} className={`log-row log-${l.type}`}>
                      <span className="log-ts">{l.ts}</span>
                      <span className="log-msg">{l.msg}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* On-Chain Storage */}
            <div className="rp-widget">
              <div className="rp-label"><Database size={11}/> Live Contract Storage</div>
              <div className="explorer">
                <div><span className="ex-k">Count</span><span className="ex-op"> = </span><span className="ex-v">{campaigns.length}</span></div>
                {campaigns.map(c => (
                  <div className="ex-c" key={c.id}>
                    <span className="ex-k">C({c.id})</span>
                    <div className="ex-c">
                      <div><span className="ex-k">title</span><span className="ex-op"> → </span><span className="ex-v">"{c.title}"</span></div>
                      <div><span className="ex-k">goal</span><span className="ex-op"> → </span><span className="ex-v">{c.goal} XLM</span></div>
                      <div><span className="ex-k">raised</span><span className="ex-op"> → </span><span className="ex-v">{c.raised} XLM</span></div>
                      <div><span className="ex-k">claimed</span><span className="ex-op"> → </span><span className="ex-v">{String(c.claimed)}</span></div>
                    </div>
                  </div>
                ))}
                {campaigns.length === 0 && <span style={{color:'var(--t4)'}}>No data yet</span>}
              </div>
            </div>

            {/* How it works */}
            <div className="rp-widget">
              <div className="rp-label">How It Works</div>
              <div style={{display:'flex', flexDirection:'column', gap:'0.65rem'}}>
                {[
                  ['🚀','Create', 'Deploys campaign to Stellar Testnet ledger'],
                  ['💙','Donate', 'Submits real signed transaction on-chain'],
                  ['⚡','Claim',  'Creator signs claim transaction on-chain'],
                  ['🔍','Read',   'All data fetched live from blockchain RPC'],
                ].map(([icon, title, desc]) => (
                  <div key={title} style={{display:'flex', gap:'0.65rem', alignItems:'flex-start'}}>
                    <span style={{fontSize:'1rem', flexShrink:0}}>{icon}</span>
                    <div>
                      <div style={{fontSize:'0.78rem', fontWeight:700, color:'var(--t1)'}}>{title}</div>
                      <div style={{fontSize:'0.72rem', color:'var(--t4)', lineHeight:1.5}}>{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* ── Create Campaign Modal ────────────────── */}
      {modal && (
        <div className="modal-mask" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal-box">
            <div className="modal-head">
              <div className="modal-tag">Soroban · create_campaign()</div>
              <h2 className="modal-title">Launch a Campaign</h2>
            </div>
            <form onSubmit={handleCreate}>
              <div className="modal-body">
                <div className="f-group">
                  <span className="f-label">Choose Emoji</span>
                  <div className="emoji-row">
                    {EMOJIS.map(em => (
                      <button key={em} type="button"
                        className={`emoji-btn${fEmoji===em?' selected':''}`}
                        onClick={() => setFEmoji(em)}
                      >{em}</button>
                    ))}
                  </div>
                </div>
                <div className="f-group">
                  <label className="f-label" htmlFor="f-title">Campaign Title</label>
                  <input id="f-title" className="f-input" type="text"
                    placeholder="e.g. Plant 10,000 Trees in Amazon"
                    value={fTitle} onChange={e => setFTitle(e.target.value)} required/>
                </div>
                <div className="f-group">
                  <label className="f-label" htmlFor="f-desc">Description (stored locally)</label>
                  <textarea id="f-desc" className="f-input" rows={2}
                    placeholder="Describe your mission…"
                    value={fDesc} onChange={e => setFDesc(e.target.value)}/>
                </div>
                <div className="f-row">
                  <div className="f-group">
                    <label className="f-label" htmlFor="f-goal">Goal (XLM)</label>
                    <input id="f-goal" className="f-input" type="number"
                      placeholder="e.g. 5000" min="1"
                      value={fGoal} onChange={e => setFGoal(e.target.value)} required/>
                  </div>
                  <div className="f-group">
                    <label className="f-label" htmlFor="f-days">Duration (Days)</label>
                    <input id="f-days" className="f-input" type="number"
                      placeholder="e.g. 30" min="1"
                      value={fDays} onChange={e => setFDays(e.target.value)} required/>
                  </div>
                </div>
                <div style={{
                  background:'var(--g050)', border:'1px solid var(--g200)',
                  borderRadius:10, padding:'0.75rem 1rem',
                  fontSize:'0.75rem', color:'var(--g700)', lineHeight:1.5
                }}>
                  <strong>⚡ Real transaction:</strong> This will submit a signed transaction to Stellar Testnet using the demo wallet (<code style={{fontFamily:'var(--f-mono)'}}>{short(StellarService.ALICE_ADDRESS)}</code>)
                </div>
              </div>
              <div className="modal-foot">
                <button type="button" className="btn-cancel" onClick={() => setModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-launch" id="btn-deploy"
                  disabled={txPending.create}
                >
                  {txPending.create
                    ? <><Loader2 size={14} className="spin"/> Submitting…</>
                    : <><Zap size={14}/> Deploy On-Chain</>
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Toast ──────────────────────────────── */}
      {toast.on && (
        <div className="toast">
          <span>{toast.icon}</span>
          <div style={{flex:1}}>
            <div>{toast.msg}</div>
            {toast.txHash && (
              <a
                href={StellarService.explorerTxUrl(toast.txHash)}
                target="_blank"
                rel="noopener noreferrer"
                style={{fontSize:'0.72rem', color:'#86efac', display:'flex',
                  alignItems:'center', gap:'0.25rem', marginTop:'0.2rem'}}
              >
                <ExternalLink size={10}/> View transaction
              </a>
            )}
          </div>
        </div>
      )}
    </>
  )
}
