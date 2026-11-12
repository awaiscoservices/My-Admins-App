/**
 * /admin/withdrawals
 * Design matches Deposits page exactly.
 */
import { useEffect, useState } from 'react'
import Head from 'next/head'
import { supabase } from '../../lib/supabase'
import AdminLayout from '../../components/layout/AdminLayout'
import StatusBadge from '../../components/ui/StatusBadge'
import PlayerWalletModal from '../../components/PlayerWalletModal'

const fmt     = c => '$' + ((c || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

function ReviewModal({ item, onClose, onAction }) {
  const [notes, setNotes]   = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  async function submit(action) {
    setSaving(true); setError('')
    const result = await onAction(item.id, action, notes)
    if (result?.error) { setError(result.error); setSaving(false) }
    else onClose()
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.8)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }} onClick={onClose}>
      <div style={{ background:'#0e1a2e', border:'1px solid rgba(251,191,36,.3)', borderRadius:20, padding:32, width:'100%', maxWidth:480 }} onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <h2 style={{ fontFamily:"'Cinzel',serif", fontSize:18, fontWeight:700, color:'#fff' }}>Review Withdrawal</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'rgba(255,255,255,.5)', fontSize:20, cursor:'pointer' }}>✕</button>
        </div>
        <div style={{ background:'rgba(251,191,36,.08)', border:'1px solid rgba(251,191,36,.2)', borderRadius:12, padding:'12px 16px', marginBottom:20 }}>
          <div style={{ fontSize:13, fontWeight:700, color:'#fff', marginBottom:4, fontFamily:'monospace' }}>{item.profiles?.username || item.profiles?.full_name}</div>
          <div style={{ fontSize:13, color:'#3b82f6', fontWeight:700, marginTop:8 }}>{fmt(item.amount_cents)}</div>
          {item.player_levels && (
            <div style={{ fontSize:11, color:'rgba(255,255,255,.4)', marginTop:4 }}>
              Level: {item.player_levels.name} · Daily limit: {fmt(item.player_levels.daily_withdrawal_limit_cents)}
            </div>
          )}
          <div style={{ fontSize:11, color:'rgba(255,255,255,.35)', marginTop:2 }}>Ref: {item.reference_id}</div>
        </div>
        <div style={{ marginBottom:20 }}>
          <label style={{ display:'block', fontSize:11, fontWeight:700, letterSpacing:'.08em', textTransform:'uppercase', color:'rgba(255,255,255,.45)', marginBottom:6 }}>Notes (optional)</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Internal note or rejection reason…"
            style={{ width:'100%', padding:'11px 14px', background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.12)', borderRadius:10, color:'#fff', fontSize:13, fontFamily:"'Outfit',sans-serif", outline:'none', resize:'none', boxSizing:'border-box' }} />
        </div>
        {error && <div style={{ marginBottom:14, padding:'10px 14px', background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.3)', borderRadius:10, color:'#f87171', fontSize:13 }}>⚠ {error}</div>}
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={() => submit('approve')} disabled={saving} style={{ flex:1, padding:'11px', background:'linear-gradient(135deg,#22c55e,#16a34a)', border:'none', borderRadius:10, color:'#fff', fontSize:13, fontWeight:800, cursor:'pointer', fontFamily:"'Outfit',sans-serif" }}>✅ Approve</button>
          <button onClick={() => submit('reject')}  disabled={saving} style={{ flex:1, padding:'11px', background:'rgba(239,68,68,.15)', border:'1px solid rgba(239,68,68,.3)', borderRadius:10, color:'#f87171', fontSize:13, fontWeight:800, cursor:'pointer', fontFamily:"'Outfit',sans-serif" }}>❌ Reject</button>
          <button onClick={onClose} style={{ padding:'11px 16px', background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.1)', borderRadius:10, color:'rgba(255,255,255,.4)', fontSize:13, cursor:'pointer', fontFamily:"'Outfit',sans-serif" }}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

export default function AdminWithdrawals() {
  const [items,    setItems]    = useState([])
  const [filter,   setFilter]   = useState('pending')
  const [search,   setSearch]   = useState('')
  const [loading,  setLoading]  = useState(true)
  const [selected, setSelected] = useState(null)
  const [walletFor, setWalletFor] = useState(null)
  const [toast,    setToast]    = useState(null)

  useEffect(() => { load() }, [filter])

  function showToast(msg, type = 'success') { setToast({ msg, type }); setTimeout(() => setToast(null), 4000) }

  async function load() {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setItems([]); setLoading(false); return }
      const res = await fetch(`/api/admin/withdrawals/list?status=${filter}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const d = await res.json()
      if (!res.ok) { showToast(d.error || 'Failed to load withdrawals', 'error'); setItems([]) }
      else setItems(d.data || [])
    } catch (e) { console.error(e); setItems([]) }
    setLoading(false)
  }

  async function handleAction(id, action, notes) {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/admin/withdrawals/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ withdrawal_id: id, action, notes }),
    })
    const d = await res.json()
    if (!res.ok) return { error: d.error }
    showToast(`Withdrawal ${action}d`)
    load()
    return {}
  }

  const rows = items.filter(r => {
    if (!search) return true
    const s = search.toLowerCase()
    return r.profiles?.username?.toLowerCase().includes(s) ||
      r.reference_id?.toLowerCase().includes(s)
  })

  return (
    <AdminLayout>
      <Head><title>Withdraw — Admin</title></Head>
      {toast && <div style={{ position:'fixed', top:16, left:'50%', transform:'translateX(-50%)', zIndex:9999, background: toast.type==='error' ? 'rgba(239,68,68,.95)' : 'rgba(34,197,94,.95)', borderRadius:12, padding:'12px 24px', color:'#fff', fontSize:14, fontWeight:600, fontFamily:"'Outfit',sans-serif", whiteSpace:'nowrap', boxShadow:'0 8px 32px rgba(0,0,0,.5)' }}>{toast.msg}</div>}
      {selected && <ReviewModal item={selected} onClose={() => setSelected(null)} onAction={handleAction} />}

      {/* Staff deciding a payout need to see what is behind it: what the
          player has deposited, played and already taken out. That lived two
          pages away, so the decision was made on a name and an amount. */}
      {walletFor && (
        <PlayerWalletModal
          playerId={walletFor.user_id || walletFor.profiles?.id}
          playerName={walletFor.profiles?.full_name}
          onClose={() => setWalletFor(null)}
        />
      )}

      <div style={{ marginBottom:20 }}>
        <h1 style={{ fontFamily:"'Cinzel',serif", fontSize:22, fontWeight:700, color:'#fff', marginBottom:4 }}>Withdraw</h1>
        <p style={{ color:'rgba(255,255,255,.35)', fontSize:13 }}>Review and approve player withdrawal requests</p>
      </div>

      <div style={{ display:'flex', gap:12, marginBottom:20, flexWrap:'wrap', alignItems:'center' }}>
        <div style={{ display:'flex', gap:4, background:'rgba(255,255,255,.04)', padding:4, borderRadius:10 }}>
          {/* 'paid', not 'approved' — no withdrawal can hold that status, so the
              tab matched nothing. */}
          {['all','pending','paid','rejected'].map(s => (
            <button key={s} onClick={() => setFilter(s)} style={{ padding:'7px 16px', borderRadius:8, border:'none', cursor:'pointer', fontFamily:"'Outfit',sans-serif", fontSize:12, fontWeight:700, background: filter===s ? 'rgba(251,191,36,.7)' : 'transparent', color: filter===s ? '#fff' : 'rgba(255,255,255,.4)', textTransform:'capitalize', transition:'all .15s' }}>{s}</button>
          ))}
        </div>
        <input type="text" placeholder="Search username or reference…" value={search} onChange={e => setSearch(e.target.value)}
          style={{ padding:'9px 14px', background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.1)', borderRadius:10, color:'#fff', fontSize:13, fontFamily:"'Outfit',sans-serif", outline:'none', minWidth:240 }} />
      </div>

      <div style={{ background:'rgba(255,255,255,.02)', border:'1px solid rgba(255,255,255,.07)', borderRadius:16, overflow:'hidden' }}>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:'rgba(255,255,255,.04)' }}>
                {['Reference','Player','Amount','Level','Status','Date','Actions'].map(h => (
                  <th key={h} style={{ padding:'11px 14px', textAlign:'left', fontSize:10, fontWeight:800, letterSpacing:'.1em', textTransform:'uppercase', color:'rgba(255,255,255,.35)', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ padding:'40px', textAlign:'center', color:'rgba(255,255,255,.3)' }}>Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} style={{ padding:'40px', textAlign:'center', color:'rgba(255,255,255,.3)' }}>
                  {filter === 'pending' ? '✅ No pending withdrawals!' : 'No withdrawals found'}
                </td></tr>
              ) : rows.map(r => (
                <tr key={r.id} style={{ borderTop:'1px solid rgba(255,255,255,.04)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.02)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding:'12px 14px' }}>
                    <div style={{ fontSize:11, fontWeight:800, color:'#fbbf24', fontFamily:'monospace' }}>{r.reference_id}</div>
                  </td>
                  <td style={{ padding:'12px 14px' }}>
                    <div style={{ fontSize:13, fontWeight:700, color:'#fff', fontFamily:'monospace' }}>{r.profiles?.username || r.profiles?.full_name || '—'}</div>
                  </td>
                  <td style={{ padding:'12px 14px' }}>
                    <div style={{ fontSize:13, fontWeight:700, color:'#3b82f6' }}>{fmt(r.amount_cents)}</div>
                  </td>
                  <td style={{ padding:'12px 14px', fontSize:12, color:'rgba(255,255,255,.4)' }}>
                    {r.player_levels?.name || '—'}
                  </td>
                  <td style={{ padding:'12px 14px' }}><StatusBadge status={r.status} size="xs" /></td>
                  <td style={{ padding:'12px 14px', fontSize:11, color:'rgba(255,255,255,.3)', whiteSpace:'nowrap' }}>{fmtDate(r.created_at)}</td>
                  <td style={{ padding:'12px 14px' }}>
                    <div style={{ display:'flex', gap:6, justifyContent:'flex-end' }}>
                      {/* Available on every row, not just pending ones: the
                          question "what has this player been doing" comes up
                          just as often after a payout as before one. */}
                      <button onClick={() => setWalletFor(r)}
                        title="See this player's balances and history"
                        style={{ padding:'6px 12px', background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.14)', borderRadius:8, color:'rgba(255,255,255,.75)', fontSize:11, fontWeight:800, cursor:'pointer', fontFamily:"'Outfit',sans-serif", whiteSpace:'nowrap' }}>
                        Wallet
                      </button>
                      {r.status === 'pending' ? (
                        <button onClick={() => setSelected(r)} style={{ padding:'6px 14px', background:'linear-gradient(135deg,#fbbf24,#f59e0b)', border:'none', borderRadius:8, color:'#050505', fontSize:11, fontWeight:800, cursor:'pointer', fontFamily:"'Outfit',sans-serif", whiteSpace:'nowrap' }}>
                          ⚡ Review
                        </button>
                      ) : (
                        <span style={{ fontSize:11, color:'rgba(255,255,255,.25)', alignSelf:'center' }}>Done</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  )
}
