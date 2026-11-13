/**
 * /admin/redemptions  (sidebar label: Redeems)
 * Design matches Deposits page exactly.
 */
import { useEffect, useState } from 'react'
import Head from 'next/head'
import { supabase } from '../../lib/supabase'
import AdminLayout from '../../components/layout/AdminLayout'
import StatusBadge from '../../components/ui/StatusBadge'
import PlayerWalletModal from '../../components/PlayerWalletModal'
import Icon from '../../components/ui/Icon'

const fmt     = c => '$' + ((c || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

// Cash / Bonus wallet pill — which balance the winnings came from.
function BucketPill({ bucket }) {
  const isBonus = bucket === 'bonus'
  return <span style={{ fontSize:10, fontWeight:800, padding:'2px 8px', borderRadius:99, textTransform:'capitalize', background: isBonus ? 'rgba(168,85,247,.15)' : 'rgba(255,255,255,.08)', color: isBonus ? '#a855f7' : 'rgba(255,255,255,.4)' }}>{bucket || 'cash'}</span>
}

function ReviewModal({ item, onClose, onAction }) {
  const [notes, setNotes]       = useState('')
  const [approvedAmt, setApprovedAmt] = useState(String((item.amount_cents || 0) / 100))
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  async function submit(action) {
    if (action === 'reject' && !notes.trim()) { setError('Please enter a reason the player will see.'); return }
    setSaving(true); setError('')
    const approved_cents = action === 'approve' ? Math.round(parseFloat(approvedAmt || 0) * 100) : undefined
    const result = await onAction(item.id, action, notes, approved_cents)
    if (result?.error) { setError(result.error); setSaving(false) }
    else onClose()
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.8)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }} onClick={onClose}>
      <div style={{ background:'#0e1a2e', border:'1px solid rgba(251,191,36,.3)', borderRadius:20, padding:32, width:'100%', maxWidth:480 }} onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <h2 style={{ fontFamily:"'Cinzel',serif", fontSize:18, fontWeight:700, color:'#fff' }}>Review Redeem</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'rgba(255,255,255,.5)', cursor:'pointer', display:'inline-flex' }}><Icon name="x" size={18} /></button>
        </div>
        <div style={{ background:'rgba(251,191,36,.08)', border:'1px solid rgba(251,191,36,.2)', borderRadius:12, padding:'12px 16px', marginBottom:20 }}>
          <div style={{ fontSize:13, fontWeight:700, color:'#fff', marginBottom:4, fontFamily:'monospace' }}>{item.profiles?.username || item.profiles?.full_name}</div>
          {item.source_bucket === 'bonus' ? (
            <div style={{ marginTop:8 }}>
              <div style={{ fontSize:13, color:'#fff', fontWeight:700 }}>Winnings entered: {fmt(item.qualifying_load_cents)} <span style={{ fontSize:10, fontWeight:800, padding:'1px 7px', borderRadius:99, background:'rgba(168,85,247,.15)', color:'#a855f7', marginLeft:4 }}>bonus</span></div>
              <div style={{ fontSize:13, color:'#fbbf24', fontWeight:700, marginTop:3 }}>Pays player: {fmt(item.amount_cents)}</div>
            </div>
          ) : (
            <div style={{ fontSize:13, color:'#f59e0b', fontWeight:700, marginTop:8 }}>Requested: {fmt(item.amount_cents)} <span style={{ fontSize:10, fontWeight:800, padding:'1px 7px', borderRadius:99, background:'rgba(255,255,255,.08)', color:'rgba(255,255,255,.4)', marginLeft:4 }}>cash</span></div>
          )}
          <div style={{ fontSize:11, color:'rgba(255,255,255,.4)', marginTop:4 }}>
            Game: {item.game_accounts?.game_panels?.name} · Account: {item.game_accounts?.game_username}
          </div>
          <div style={{ fontSize:11, color:'rgba(255,255,255,.35)', marginTop:2 }}>Ref: {item.reference_id}</div>
        </div>
        <div style={{ marginBottom:16 }}>
          <label style={{ display:'block', fontSize:11, fontWeight:700, letterSpacing:'.08em', textTransform:'uppercase', color:'rgba(255,255,255,.45)', marginBottom:6 }}>Approved Amount ($)</label>
          <input type="number" value={approvedAmt} onChange={e => setApprovedAmt(e.target.value)} step="0.01" min="0"
            style={{ width:'100%', padding:'11px 14px', background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.12)', borderRadius:10, color:'#fff', fontSize:13, fontFamily:"'Outfit',sans-serif", outline:'none', boxSizing:'border-box' }} />
        </div>
        <div style={{ marginBottom:20 }}>
          <label style={{ display:'block', fontSize:11, fontWeight:700, letterSpacing:'.08em', textTransform:'uppercase', color:'rgba(255,255,255,.45)', marginBottom:6 }}>Reason / note <span style={{ textTransform:'none', fontWeight:400, color:'rgba(255,255,255,.3)' }}>(required to reject — player sees it)</span></label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Reason the player will see if rejected…"
            style={{ width:'100%', padding:'11px 14px', background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.12)', borderRadius:10, color:'#fff', fontSize:13, fontFamily:"'Outfit',sans-serif", outline:'none', resize:'none', boxSizing:'border-box' }} />
        </div>
        {error && <div style={{ marginBottom:14, padding:'10px 14px', background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.3)', borderRadius:10, color:'#f87171', fontSize:13 }}><Icon name="alert" size={14} style={{ verticalAlign: '-2px', marginRight: 4 }} /> {error}</div>}
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={() => submit('approve')} disabled={saving} style={{ flex:1, padding:'11px', background:'linear-gradient(135deg,#22c55e,#16a34a)', border:'none', borderRadius:10, color:'#fff', fontSize:13, fontWeight:800, cursor:'pointer', fontFamily:"'Outfit',sans-serif" }}><Icon name="check" size={14} stroke={2.6} style={{ verticalAlign: '-2px', marginRight: 5 }} /> Approve</button>
          <button onClick={() => submit('reject')}  disabled={saving} style={{ flex:1, padding:'11px', background:'rgba(239,68,68,.15)', border:'1px solid rgba(239,68,68,.3)', borderRadius:10, color:'#f87171', fontSize:13, fontWeight:800, cursor:'pointer', fontFamily:"'Outfit',sans-serif" }}><Icon name="x" size={14} stroke={2.6} style={{ verticalAlign: '-2px', marginRight: 5 }} /> Reject</button>
          <button onClick={onClose} style={{ padding:'11px 16px', background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.1)', borderRadius:10, color:'rgba(255,255,255,.4)', fontSize:13, cursor:'pointer', fontFamily:"'Outfit',sans-serif" }}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

export default function AdminRedemptions() {
  const [items,    setItems]    = useState([])
  const [filter,   setFilter]   = useState('pending')
  const [search,   setSearch]   = useState('')
  const [loading,  setLoading]  = useState(true)
  const [selected, setSelected] = useState(null)
  const [walletFor, setWalletFor] = useState(null)
  const [toast,    setToast]    = useState(null)

  useEffect(() => { load() }, [filter])

  // Live refresh: silently re-fetch every 8s so new requests appear without
  // a hard refresh (no spinner flash).
  useEffect(() => {
    const t = setInterval(() => load(true), 8000)
    return () => clearInterval(t)
  }, [filter])

  function showToast(msg, type = 'success') { setToast({ msg, type }); setTimeout(() => setToast(null), 4000) }

  async function load(silent = false) {
    if (!silent) setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setItems([]); setLoading(false); return }
      const res = await fetch(`/api/admin/redemptions/list?status=${filter}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: 'no-store',
      })
      const d = await res.json()
      if (!res.ok) { showToast(d.error || 'Failed to load redemptions', 'error'); setItems([]) }
      else setItems(d.data || [])
    } catch (e) { console.error(e); setItems([]) }
    setLoading(false)
  }

  async function handleAction(id, action, notes, approved_cents) {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/admin/redemptions/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ redemption_id: id, action, notes, approved_cents }),
    })
    const d = await res.json()
    if (!res.ok) return { error: d.error }
    showToast(`Redeem ${action}d`)
    load()
    return {}
  }

  const rows = items.filter(r => {
    if (!search) return true
    const s = search.toLowerCase()
    return r.profiles?.username?.toLowerCase().includes(s) ||
      r.reference_id?.toLowerCase().includes(s) ||
      r.game_accounts?.game_username?.toLowerCase().includes(s)
  })

  return (
    <AdminLayout>
      <Head><title>Redeem — Admin</title></Head>
      {toast && <div style={{ position:'fixed', top:16, left:'50%', transform:'translateX(-50%)', zIndex:9999, background: toast.type==='error' ? 'rgba(239,68,68,.95)' : 'rgba(34,197,94,.95)', borderRadius:12, padding:'12px 24px', color:'#fff', fontSize:14, fontWeight:600, fontFamily:"'Outfit',sans-serif", whiteSpace:'nowrap', boxShadow:'0 8px 32px rgba(0,0,0,.5)' }}>{toast.msg}</div>}
      {selected && <ReviewModal item={selected} onClose={() => setSelected(null)} onAction={handleAction} />}

      {/* The same player panel the Players page uses. Deciding a request
          without seeing what the player has deposited, played and taken out
          means deciding on a name and an amount. */}
      {walletFor && (
        <PlayerWalletModal
          playerId={walletFor.user_id || walletFor.profiles?.id}
          playerName={walletFor.profiles?.full_name}
          onClose={() => setWalletFor(null)}
        />
      )}

      <div style={{ marginBottom:20 }}>
        <h1 style={{ fontFamily:"'Cinzel',serif", fontSize:22, fontWeight:700, color:'#fff', marginBottom:4 }}>Redeem</h1>
        <p style={{ color:'rgba(255,255,255,.35)', fontSize:13 }}>Review and approve player redemption requests</p>
      </div>

      <div style={{ display:'flex', gap:12, marginBottom:20, flexWrap:'wrap', alignItems:'center' }}>
        <div style={{ display:'flex', gap:4, background:'rgba(255,255,255,.04)', padding:4, borderRadius:10 }}>
          {/* Redeem has three states only: pending → completed → rejected.
              'completed', not 'approved' — redemptions cannot hold that value. */}
          {['all','pending','completed','rejected'].map(s => (
            <button key={s} onClick={() => setFilter(s)} style={{ padding:'7px 16px', borderRadius:8, border:'none', cursor:'pointer', fontFamily:"'Outfit',sans-serif", fontSize:12, fontWeight:700, background: filter===s ? 'rgba(251,191,36,.7)' : 'transparent', color: filter===s ? '#fff' : 'rgba(255,255,255,.4)', textTransform:'capitalize', transition:'all .15s' }}>{s}</button>
          ))}
        </div>
        <input type="text" placeholder="Search username, reference, account…" value={search} onChange={e => setSearch(e.target.value)}
          style={{ padding:'9px 14px', background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.1)', borderRadius:10, color:'#fff', fontSize:13, fontFamily:"'Outfit',sans-serif", outline:'none', minWidth:260 }} />
      </div>

      <div style={{ background:'rgba(255,255,255,.02)', border:'1px solid rgba(255,255,255,.07)', borderRadius:16, overflow:'hidden' }}>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:'rgba(255,255,255,.04)' }}>
                {['Reference','Player','Game Account','Wallet','Requested','Approved','Status','Date','Actions'].map(h => (
                  <th key={h} style={{ padding:'11px 14px', textAlign:'left', fontSize:10, fontWeight:800, letterSpacing:'.1em', textTransform:'uppercase', color:'rgba(255,255,255,.35)', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} style={{ padding:'40px', textAlign:'center', color:'rgba(255,255,255,.3)' }}>Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={9} style={{ padding:'40px', textAlign:'center', color:'rgba(255,255,255,.3)' }}>
                  {filter === 'pending' ? 'No pending redeems' : 'No redemptions found'}
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
                    <div style={{ fontSize:13, fontWeight:600, color:'#fff' }}>{r.game_accounts?.game_panels?.name || '—'}</div>
                    <div style={{ fontSize:10, color:'rgba(255,255,255,.4)' }}>{r.game_accounts?.game_username}</div>
                  </td>
                  <td style={{ padding:'12px 14px' }}><BucketPill bucket={r.source_bucket} /></td>
                  <td style={{ padding:'12px 14px' }}>
                    {r.source_bucket === 'bonus' ? (<>
                      {/* Admin sees the full winnings the player entered; the
                          player only ever sees the payout. */}
                      <div style={{ fontSize:13, fontWeight:700, color:'#fff' }}>{fmt(r.qualifying_load_cents)}</div>
                      <div style={{ fontSize:10, color:'#fbbf24', fontWeight:700 }}>pays {fmt(r.amount_cents)}</div>
                    </>) : (
                      <div style={{ fontSize:13, fontWeight:700, color:'#f59e0b' }}>{fmt(r.amount_cents)}</div>
                    )}
                  </td>
                  <td style={{ padding:'12px 14px', fontSize:13, color: r.approved_cents > 0 ? '#22c55e' : 'rgba(255,255,255,.25)', fontWeight:700 }}>
                    {r.approved_cents > 0 ? fmt(r.approved_cents) : '—'}
                  </td>
                  <td style={{ padding:'12px 14px' }}><StatusBadge status={r.status} size="xs" /></td>
                  <td style={{ padding:'12px 14px', fontSize:11, color:'rgba(255,255,255,.3)', whiteSpace:'nowrap' }}>{fmtDate(r.created_at)}</td>
                  <td style={{ padding:'12px 14px' }}>
                    <div style={{ display:'flex', gap:6, justifyContent:'flex-end' }}>
                      <button onClick={() => setWalletFor(r)}
                        title="See this player's balances and history"
                        style={{ padding:'6px 12px', background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.14)', borderRadius:8, color:'rgba(255,255,255,.75)', fontSize:11, fontWeight:800, cursor:'pointer', fontFamily:"'Outfit',sans-serif", whiteSpace:'nowrap' }}>
                        Wallet
                      </button>
                      {r.status === 'pending' ? (
                        <button onClick={() => setSelected(r)} style={{ padding:'6px 14px', background:'linear-gradient(135deg,#fbbf24,#f59e0b)', border:'none', borderRadius:8, color:'#050505', fontSize:11, fontWeight:800, cursor:'pointer', fontFamily:"'Outfit',sans-serif", whiteSpace:'nowrap' }}>
                          Review
                        </button>
                      ) : r.status === 'rejected' && r.rejection_reason ? (
                        <button onClick={() => showToast(`Reason: ${r.rejection_reason}`, 'error')} title={r.rejection_reason} style={{ padding:'6px 12px', background:'rgba(239,68,68,.12)', border:'1px solid rgba(239,68,68,.3)', borderRadius:8, color:'#f87171', fontSize:11, fontWeight:800, cursor:'pointer', fontFamily:"'Outfit',sans-serif", whiteSpace:'nowrap' }}>
                          Reason
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
