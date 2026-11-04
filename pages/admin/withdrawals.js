/**
 * /admin/withdrawals
 *
 * Admin — Withdrawals queue
 * Lists all withdrawal requests. Approve/Reject via /api/admin/withdrawals/action.
 * Shows daily limit status per player.
 * Roles: super_admin, admin, finance (view+act); game_ops (view only)
 */
import { useEffect, useState } from 'react'
import Head from 'next/head'
import { supabase } from '../../lib/supabase'
import AdminLayout from '../../components/layout/AdminLayout'

const STATUS_OPTS = ['all', 'pending', 'approved', 'rejected']
const fmt     = cents => `$${((cents || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
const fmtDate = d => d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

const STATUS_STYLE = {
  pending:  { bg: 'rgba(251,191,36,.1)',  border: 'rgba(251,191,36,.3)',  color: '#fbbf24' },
  approved: { bg: 'rgba(34,197,94,.1)',   border: 'rgba(34,197,94,.3)',   color: '#22c55e' },
  rejected: { bg: 'rgba(239,68,68,.1)',   border: 'rgba(239,68,68,.3)',   color: '#f87171' },
}

export default function AdminWithdrawals() {
  const [items,   setItems]   = useState([])
  const [status,  setStatus]  = useState('pending')
  const [loading, setLoading] = useState(true)
  const [acting,  setActing]  = useState(null)
  const [modal,   setModal]   = useState(null)
  const [note,    setNote]    = useState('')
  const [toast,   setToast]   = useState(null)
  const [role,    setRole]    = useState('')

  useEffect(() => { load() }, [status])

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  async function load() {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setLoading(false); return }

    // Fetch role for UI gating
    const { data: p } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
    setRole(p?.role || '')

    // Use service-role API route to avoid FK ambiguity error
    // (withdrawals has two FKs to profiles: user_id + processed_by)
    const res = await fetch(`/api/admin/withdrawals/list?status=${status}`, {
      headers: { Authorization: `Bearer ${session.access_token}` }
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      showToast(j.error || 'Failed to load withdrawals', 'error')
      setLoading(false); return
    }
    const { data } = await res.json()
    setItems(data || [])
    setLoading(false)
  }

  function openModal(item, action) {
    setModal({ item, action })
    setNote('')
  }

  async function confirmAction() {
    if (!modal) return
    const { item, action } = modal
    setActing(item.id)
    setModal(null)

    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/admin/withdrawals/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ withdrawal_id: item.id, action, notes: note }),
    })
    const json = await res.json()
    setActing(null)

    if (!res.ok) {
      if (json.code === 'DAILY_LIMIT_EXCEEDED') {
        showToast(`Daily limit exceeded — used ${fmt(json.already_withdrawn_cents)} of ${fmt(json.daily_limit_cents)}`, 'error')
      } else if (json.code === 'INSUFFICIENT_CASH') {
        showToast('Insufficient cash balance', 'error')
      } else {
        showToast(json.error || 'Action failed', 'error')
      }
      return
    }

    if (action === 'approve') {
      showToast(`Approved ${fmt(json.amount_cents)} withdrawal for ${item.profiles?.full_name}`)
    } else {
      showToast(`Rejected withdrawal for ${item.profiles?.full_name}`)
    }
    load()
  }

  const canAct = ['super_admin', 'admin', 'finance'].includes(role)

  return (
    <AdminLayout>
      <Head><title>Withdrawals — Admin</title></Head>

      {toast && (
        <div style={{ position:'fixed', top:16, left:'50%', transform:'translateX(-50%)', zIndex:9999,
          background: toast.type==='error' ? 'rgba(239,68,68,.95)' : 'rgba(34,197,94,.95)',
          borderRadius:12, padding:'12px 24px', color:'#fff', fontSize:14, fontWeight:600,
          fontFamily:"'Outfit',sans-serif", whiteSpace:'nowrap', boxShadow:'0 8px 32px rgba(0,0,0,.5)' }}>
          {toast.msg}
        </div>
      )}

      {/* Confirm Modal */}
      {modal && (
        <div style={{ position:'fixed', inset:0, zIndex:9998, background:'rgba(0,0,0,.7)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:'#0d1f35', border:'1px solid rgba(255,255,255,.1)', borderRadius:20, padding:28, maxWidth:440, width:'100%' }}>
            <div style={{ fontSize:16, fontWeight:800, color:'#fff', marginBottom:8, fontFamily:"'Cinzel',serif" }}>
              {modal.action === 'approve' ? '✅ Approve Withdrawal' : '❌ Reject Withdrawal'}
            </div>
            <div style={{ fontSize:13, color:'rgba(255,255,255,.5)', marginBottom:4 }}>
              {modal.item.profiles?.full_name}
            </div>
            <div style={{ fontSize:18, fontWeight:900, color:'#fff', marginBottom:4 }}>
              {fmt(modal.item.amount_cents)}
            </div>
            {modal.item.player_levels && (
              <div style={{ fontSize:11, color:'rgba(255,255,255,.35)', marginBottom:16 }}>
                {modal.item.player_levels.name} · Daily limit: {fmt(modal.item.player_levels.daily_withdrawal_limit_cents)}
              </div>
            )}
            <div style={{ marginBottom:16 }}>
              <label style={{ display:'block', fontSize:10, fontWeight:800, letterSpacing:'.1em', textTransform:'uppercase', color:'rgba(255,255,255,.35)', marginBottom:6 }}>
                Note (optional)
              </label>
              <textarea
                value={note} onChange={e => setNote(e.target.value)}
                rows={3}
                style={{ width:'100%', padding:'9px 12px', background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.1)', borderRadius:8, color:'#fff', fontSize:13, fontFamily:"'Outfit',sans-serif", resize:'vertical', boxSizing:'border-box' }}
                placeholder="Optional note for audit log…"
              />
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={confirmAction} style={{
                flex:1, padding:'10px 0', border:'none', borderRadius:10, fontSize:13, fontWeight:800, cursor:'pointer', fontFamily:"'Outfit',sans-serif",
                background: modal.action==='approve' ? 'linear-gradient(135deg,#22c55e,#16a34a)' : 'linear-gradient(135deg,#ef4444,#dc2626)',
                color: '#fff',
              }}>
                Confirm {modal.action === 'approve' ? 'Approve' : 'Reject'}
              </button>
              <button onClick={() => setModal(null)} style={{ padding:'10px 18px', background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.1)', borderRadius:10, color:'rgba(255,255,255,.5)', fontSize:13, cursor:'pointer', fontFamily:"'Outfit',sans-serif" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontFamily:"'Cinzel',serif", fontSize:22, fontWeight:700, color:'#fff', margin:0 }}>Withdrawals</h1>
          <p style={{ color:'rgba(255,255,255,.35)', fontSize:13, marginTop:4 }}>Review and approve withdrawal requests (cash balance only)</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          {STATUS_OPTS.map(s => (
            <button key={s} onClick={() => setStatus(s)} style={{
              padding:'7px 14px', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer',
              textTransform:'capitalize', fontFamily:"'Outfit',sans-serif",
              background: status===s ? 'rgba(251,191,36,.15)' : 'rgba(255,255,255,.04)',
              border: status===s ? '1px solid rgba(251,191,36,.4)' : '1px solid rgba(255,255,255,.08)',
              color: status===s ? '#fbbf24' : 'rgba(255,255,255,.4)',
            }}>{s}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ padding:60, textAlign:'center', color:'rgba(255,255,255,.3)' }}>Loading…</div>
      ) : items.length === 0 ? (
        <div style={{ padding:60, textAlign:'center', color:'rgba(255,255,255,.3)', fontSize:14 }}>No {status === 'all' ? '' : status} withdrawals</div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {items.map(item => {
            const st = STATUS_STYLE[item.status] || STATUS_STYLE.pending
            return (
              <div key={item.id} style={{ background:'rgba(255,255,255,.02)', border:'1px solid rgba(255,255,255,.07)', borderRadius:14, padding:'16px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
                <div style={{ display:'flex', alignItems:'center', gap:16, minWidth:0 }}>
                  <div style={{ padding:'4px 10px', borderRadius:20, fontSize:10, fontWeight:800, letterSpacing:'.08em', textTransform:'uppercase', background:st.bg, border:`1px solid ${st.border}`, color:st.color, flexShrink:0 }}>
                    {item.status}
                  </div>
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontSize:14, fontWeight:700, color:'#fff' }}>
                      {item.profiles?.full_name || 'Unknown'}
                      {item.player_levels && (
                        <span style={{ marginLeft:8, fontSize:11, color:'rgba(255,255,255,.4)', fontWeight:400 }}>{item.player_levels.name}</span>
                      )}
                    </div>
                    <div style={{ fontSize:11, color:'rgba(255,255,255,.35)', marginTop:2 }}>
                      {item.reference_id} · {fmtDate(item.created_at)}
                    </div>
                  </div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:16 }}>
                  <div style={{ fontSize:20, fontWeight:900, color:'#22c55e', minWidth:80, textAlign:'right' }}>
                    {fmt(item.amount_cents)}
                  </div>
                  {canAct && item.status === 'pending' && (
                    <div style={{ display:'flex', gap:8 }}>
                      <button onClick={() => openModal(item, 'approve')} disabled={acting === item.id} style={{ padding:'8px 16px', background:'rgba(34,197,94,.12)', border:'1px solid rgba(34,197,94,.3)', borderRadius:8, color:'#22c55e', fontSize:12, fontWeight:800, cursor:'pointer', fontFamily:"'Outfit',sans-serif" }}>
                        Approve
                      </button>
                      <button onClick={() => openModal(item, 'reject')} disabled={acting === item.id} style={{ padding:'8px 16px', background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.25)', borderRadius:8, color:'#f87171', fontSize:12, fontWeight:800, cursor:'pointer', fontFamily:"'Outfit',sans-serif" }}>
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </AdminLayout>
  )
}
