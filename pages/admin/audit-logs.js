/**
 * /admin/audit-logs
 *
 * Admin — Audit Log viewer
 * Append-only log of all staff actions. Search + filter by action type.
 * Roles: super_admin only (sensitive — shows all staff actions)
 */
import { useEffect, useState } from 'react'
import Head from 'next/head'
import { supabase } from '../../lib/supabase'
import AdminLayout from '../../components/layout/AdminLayout'
import DateRange, { inDateRange } from '../../components/ui/DateRange'

const fmtDate = d => d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

const ACTION_COLOR = {
  deposit_approved:      '#22c55e',
  deposit_rejected:      '#f87171',
  withdrawal_approved:   '#22c55e',
  withdrawal_rejected:   '#f87171',
  game_load_approved:    '#fbbf24',
  game_load_rejected:    '#f87171',
  redemption_approved:   '#a78bfa',
  redemption_rejected:   '#f87171',
  wallet_adjustment:     '#f59e0b',
  player_status_changed: '#6366f1',
  game_account_setup:    '#38bdf8',
  level_config_updated:  '#fbbf24',
  kyc_reviewed:          '#10b981',
}

export default function AdminAuditLogs() {
  const [items,    setItems]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [search,   setSearch]   = useState('')
  const [dates,    setDates]    = useState({ from: '', to: '' })
  const [toast,    setToast]    = useState(null)
  const [page,     setPage]     = useState(0)
  const PAGE_SIZE = 100

  useEffect(() => { load() }, [page])

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  async function load() {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setLoading(false); return }

    const { data: actor } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
    if (!actor || actor.role !== 'super_admin') {
      showToast('super_admin only', 'error'); setLoading(false); return
    }

    // Through the guarded route, not the table. Querying from the browser
    // left row-level security as the only thing deciding what you saw, and
    // it lets any staff member read any casino's rows.
    const res = await fetch(`/api/admin/audit-logs/list?page=${page + 1}&limit=${PAGE_SIZE}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    const d = await res.json()

    if (!res.ok) { showToast(d.error || 'Could not load the audit log', 'error'); setLoading(false); return }
    setItems(d.rows || d.logs || [])
    setLoading(false)
  }

  const filtered = items.filter(item => {
    if (!inDateRange(item.created_at, dates.from, dates.to)) return false
    if (!search) return true
    const q = search.toLowerCase()
    return (
      item.actor?.full_name?.toLowerCase().includes(q) ||
      item.actor?.email?.toLowerCase().includes(q) ||
      item.action?.toLowerCase().includes(q) ||
      item.description?.toLowerCase().includes(q) ||
      item.target_id?.toLowerCase().includes(q)
    )
  })

  return (
    <AdminLayout>
      <Head><title>Audit Logs — Admin</title></Head>

      {toast && (
        <div style={{ position:'fixed', top:16, left:'50%', transform:'translateX(-50%)', zIndex:9999,
          background: toast.type==='error' ? 'rgba(239,68,68,.95)' : 'rgba(34,197,94,.95)',
          borderRadius:12, padding:'12px 24px', color:'#fff', fontSize:14, fontWeight:600,
          fontFamily:"'Outfit',sans-serif", whiteSpace:'nowrap', boxShadow:'0 8px 32px rgba(0,0,0,.5)' }}>
          {toast.msg}
        </div>
      )}

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontFamily:"'Cinzel',serif", fontSize:22, fontWeight:700, color:'#fff', margin:0 }}>Audit Logs</h1>
          <p style={{ color:'rgba(255,255,255,.35)', fontSize:13, marginTop:4 }}>Immutable record of all staff actions</p>
        </div>
        <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
          <DateRange from={dates.from} to={dates.to} onChange={setDates} />
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search actor, action, description…"
            style={{ padding:'9px 14px', background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.1)', borderRadius:10, color:'#fff', fontSize:13, fontFamily:"'Outfit',sans-serif", outline:'none', width:260 }}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ padding:60, textAlign:'center', color:'rgba(255,255,255,.3)' }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding:60, textAlign:'center', color:'rgba(255,255,255,.3)', fontSize:14 }}>No audit entries</div>
      ) : (
        <>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {filtered.map(item => {
              const color = ACTION_COLOR[item.action] || '#94a3b8'
              return (
                <div key={item.id} style={{ background:'rgba(255,255,255,.02)', border:'1px solid rgba(255,255,255,.05)', borderRadius:10, padding:'12px 16px', display:'flex', gap:14, alignItems:'flex-start' }}>
                  {/* Color dot */}
                  <div style={{ width:8, height:8, borderRadius:'50%', background:color, marginTop:5, flexShrink:0 }} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
                      <span style={{ padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:800, background:`${color}22`, color, letterSpacing:'.05em' }}>
                        {item.action?.replace(/_/g,' ')}
                      </span>
                      <span style={{ fontSize:11, color:'rgba(255,255,255,.5)' }}>
                        by <strong style={{ color:'rgba(255,255,255,.75)' }}>{item.actor?.full_name || '—'}</strong>
                        <span style={{ marginLeft:6, color:'rgba(255,255,255,.3)' }}>({item.actor_role})</span>
                      </span>
                      <span style={{ fontSize:10, color:'rgba(255,255,255,.25)', marginLeft:'auto' }}>{fmtDate(item.created_at)}</span>
                    </div>
                    <div style={{ fontSize:12, color:'rgba(255,255,255,.45)', marginTop:5, lineHeight:1.5 }}>
                      {item.description}
                    </div>
                    {item.target_id && (
                      <div style={{ fontSize:10, color:'rgba(255,255,255,.2)', marginTop:3 }}>
                        {item.target_type} · {item.target_id}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{ display:'flex', gap:10, justifyContent:'center', marginTop:20 }}>
            {page > 0 && (
              <button onClick={() => setPage(p => p-1)} style={{ padding:'8px 18px', background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.1)', borderRadius:8, color:'rgba(255,255,255,.6)', fontSize:13, cursor:'pointer', fontFamily:"'Outfit',sans-serif" }}>← Prev</button>
            )}
            {items.length === PAGE_SIZE && (
              <button onClick={() => setPage(p => p+1)} style={{ padding:'8px 18px', background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.1)', borderRadius:8, color:'rgba(255,255,255,.6)', fontSize:13, cursor:'pointer', fontFamily:"'Outfit',sans-serif" }}>Next →</button>
            )}
          </div>
        </>
      )}
    </AdminLayout>
  )
}
