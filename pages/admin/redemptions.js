/**
 * /admin/redemptions  (sidebar label: Redeems)
 * Design matches Deposits page exactly.
 */
import { useEffect, useState } from 'react'
import Head from 'next/head'
import { supabase } from '../../lib/supabase'
import AdminLayout from '../../components/layout/AdminLayout'
import StatusBadge from '../../components/ui/StatusBadge'

const fmt     = c => '$' + ((c || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

function ReviewModal({ item, onClose, onAction }) {
  const [notes, setNotes]       = useState('')
  const [approvedAmt, setApprovedAmt] = useState(String((item.amount_cents || 0) / 100))
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  async function submit(action) {
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
          <h2 style={{ fontFamily:"'Cinzel',serif", fontSize:18, fontWeight:700, color:'#fff' }}>Review Redemption</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'rgba(255,255,255,.5)', fontSize:20, cursor:'pointer' }}>✕</button>
        </div>
        <div style={{ background:'rgba(251,191,36,.08)', border:'1px solid rgba(251,191,36,.2)', borderRadius:12, padding:'12px 16px', marginBottom:20 }}>
          <div style={{ fontSize:13, fontWeight:700, color:'#fff', marginBottom:4 }}>{item.profiles?.full_name}</div>
          <div style={{ fontSize:11, color:'rgba(255,255,255,.5)' }}>{item.profiles?.email}</div>
          <div style={{ fontSize:13, color:'#f59e0b', fontWeight:700, marginTop:8 }}>Requested: {fmt(item.amount_cents)}</div>
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

export default function AdminRedemptions() {
  const [items,    setItems]    = useState([])
  const [filter,   setFilter]   = useState('pending')
  const [search,   setSearch]   = useState('')
  const [loading,  setLoading]  = useState(true)
  const [selected, setSelected] = useState(null)
  const [toast,    setToast]    = useState(null)

  useEffect(() => { load() }, [filter])

  function showToast(msg, type = 'success') { setToast({ msg, type }); setTimeout(() => setToast(null), 4000) }

  async function load() {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setItems([]); setLoading(false); return }
      const res = await fetch(`/api/admin/redemptions/list?status=${filter}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
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
    showToast(`Redemption ${action}d`)
    load()
    return {}
  }

  const rows = items.filter(r => {
    if (!search) return true
    const s = search.toLowerCase()
    return r.profiles?.full_name?.toLowerCase().includes(s) ||
      r.profiles?.email?.toLowerCase().includes(s) ||
      r.reference_id?.toLowerCase().includes(s) ||
      r.game_accounts?.game_username?.toLowerCase().includes(s)
  })

  return (
    <AdminLayout>
      <Head><title>Redeems — Admin</title></Head>
      {toast && <div style={{ position:'fixed', top:16, left:'50%', transform:'translateX(-50%)', zIndex:9999, background: toast.type==='error' ? 'rgba(239,68,68,.95)' : 'rgba(34,197,94,.95)', borderRadius:12, padding:'12px 24px', color:'#fff', fontSize:14, fontWeight:600, fontFamily:"'Outfit',sans-serif", whiteSpace:'nowrap', boxShadow:'0 8px 32px rgba(0,0,0,.5)' }}>{toast.msg}</div>}
      {selected && <ReviewModal item={selected} onClose={() => setSelected(null)} onAction={handleAction} />}

      <div style={{ marginBottom:20 }}>
        <h1 style={{ fontFamily:"'Cinzel',serif", fontSize:22, fontWeight:700, color:'#fff', marginBottom:4 }}>Redeems</h1>
        <p style={{ color:'rgba(255,255,255,.35)', fontSize:13 }}>Review and approve player redemption requests</p>
      </div>

      <div style={{ display:'flex', gap:12, marginBottom:20, flexWrap:'wrap', alignItems:'center' }}>
        <div style={{ display:'flex', gap:4, background:'rgba(255,255,255,.04)', padding:4, borderRadius:10 }}>
          {['all','pending','approved','partial','rejected'].map(s => (
            <button key={s} onClick={() => setFilter(s)} style={{ padding:'7px 16px', borderRadius:8, border:'none', cursor:'pointer', fontFamily:"'Outfit',sans-serif", fontSize:12, fontWeight:700, background: filter===s ? 'rgba(251,191,36,.7)' : 'transparent', color: filter===s ? '#fff' : 'rgba(255,255,255,.4)', textTransform:'capitalize', transition:'all .15s' }}>{s}</button>
          ))}
        </div>
        <input type="text" placeholder="Search player, email, reference, account…" value={search} onChange={e => setSearch(e.target.value)}
          style={{ padding:'9px 14px', background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.1)', borderRadius:10, color:'#fff', fontSize:13, fontFamily:"'Outfit',sans-serif", outline:'none', minWidth:260 }} />
      </div>

      <div style={{ background:'rgba(255,255,255,.02)', border:'1px solid rgba(255,255,255,.07)', borderRadius:16, overflow:'hidden' }}>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:'rgba(255,255,255,.04)' }}>
                {['Reference','Player','Game Account','Requested','Approved','Status','Date','Actions'].map(h => (
                  <th key={h} style={{ padding:'11px 14px', textAlign:'left', fontSize:10, fontWeight:800, letterSpacing:'.1em', textTransform:'uppercase', color:'rgba(255,255,255,.35)', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ padding:'40px', textAlign:'center', color:'rgba(255,255,255,.3)' }}>Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={8} style={{ padding:'40px', textAlign:'center', color:'rgba(255,255,255,.3)' }}>
                  {filter === 'pending' ? '✅ No pending redeems!' : 'No redemptions found'}
                </td></tr>
              ) : rows.map(r => (
                <tr key={r.id} style={{ borderTop:'1px solid rgba(255,255,255,.04)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.02)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding:'12px 14px' }}>
                    <div style={{ fontSize:11, fontWeight:800, color:'#fbbf24', fontFamily:'monospace' }}>{r.reference_id}</div>
                  </td>
                  <td style={{ padding:'12px 14px' }}>
                    <div style={{ fontSize:13, fontWeight:700, color:'#fff' }}>{r.profiles?.full_name || '—'}</div>
                    <div style={{ fontSize:10, color:'rgba(255,255,255,.4)' }}>{r.profiles?.email}</div>
                  </td>
                  <td style={{ padding:'12px 14px' }}>
                    <div style={{ fontSize:13, fontWeight:600, color:'#fff' }}>{r.game_accounts?.game_panels?.name || '—'}</div>
                    <div style={{ fontSize:10, color:'rgba(255,255,255,.4)' }}>{r.game_accounts?.game_username}</div>
                  </td>
                  <td style={{ padding:'12px 14px' }}>
                    <div style={{ fontSize:13, fontWeight:700, color:'#f59e0b' }}>{fmt(r.amount_cents)}</div>
                  </td>
                  <td style={{ padding:'12px 14px', fontSize:13, color: r.approved_cents > 0 ? '#22c55e' : 'rgba(255,255,255,.25)', fontWeight:700 }}>
                    {r.approved_cents > 0 ? fmt(r.approved_cents) : '—'}
                  </td>
                  <td style={{ padding:'12px 14px' }}><StatusBadge status={r.status} size="xs" /></td>
                  <td style={{ padding:'12px 14px', fontSize:11, color:'rgba(255,255,255,.3)', whiteSpace:'nowrap' }}>{fmtDate(r.created_at)}</td>
                  <td style={{ padding:'12px 14px' }}>
                    {r.status === 'pending' ? (
                      <button onClick={() => setSelected(r)} style={{ padding:'6px 14px', background:'linear-gradient(135deg,#fbbf24,#f59e0b)', border:'none', borderRadius:8, color:'#050505', fontSize:11, fontWeight:800, cursor:'pointer', fontFamily:"'Outfit',sans-serif", whiteSpace:'nowrap' }}>
                        ⚡ Review
                      </button>
                    ) : (
                      <span style={{ fontSize:11, color:'rgba(255,255,255,.25)' }}>Done</span>
                    )}
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
