/**
 * /admin/adjustments
 *
 * Admin — Wallet Adjustments log
 * Read-only audit of all manual balance adjustments (credit/debit) by staff.
 * Adjustments are made from the player detail page; this is the full log.
 * Roles: super_admin, admin, finance
 */
import { useEffect, useState } from 'react'
import Head from 'next/head'
import { supabase } from '../../lib/supabase'
import AdminLayout from '../../components/layout/AdminLayout'
import DateRange, { inDateRange } from '../../components/ui/DateRange'

const fmt     = cents => `$${((cents || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
const fmtDate = d => d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

const TYPE_STYLE = {
  credit: { color: '#22c55e', prefix: '+' },
  debit:  { color: '#f87171', prefix: '-' },
}

export default function AdminAdjustments() {
  const [items,   setItems]   = useState([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')
  const [dates,   setDates]   = useState({ from: '', to: '' })
  const [toast,   setToast]   = useState(null)
  const [page,    setPage]    = useState(0)
  const PAGE_SIZE = 50

  useEffect(() => { load() }, [page])

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  async function load() {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setLoading(false); return }

    // Auth check
    const { data: actor } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
    if (!actor || !['super_admin', 'admin', 'finance'].includes(actor.role)) {
      showToast('Access denied', 'error')
      setLoading(false)
      return
    }

    // Through the guarded route: read from the browser, this showed every
    // casino's adjustments to every casino's staff. It also asked for an
    // actor_id key that does not exist, so it never loaded at all.
    const res = await fetch(`/api/admin/adjustments/list?page=${page + 1}&limit=${PAGE_SIZE}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    const d = await res.json()

    if (!res.ok) { showToast(d.error || 'Could not load adjustments', 'error'); setLoading(false); return }
    setItems(d.rows || [])
    setLoading(false)
  }

  const filtered = items.filter(item => {
    if (!inDateRange(item.created_at, dates.from, dates.to)) return false
    if (!search) return true
    const q = search.toLowerCase()
    return (
      item.profiles?.username?.toLowerCase().includes(q) ||
      item.reference_id?.toLowerCase().includes(q) ||
      item.reason?.toLowerCase().includes(q)
    )
  })

  return (
    <AdminLayout>
      <Head><title>Adjustments — Admin</title></Head>

      {toast && (
        <div style={{ position:'fixed', top:16, left:'50%', transform:'translateX(-50%)', zIndex:9999,
          background: toast.type==='error' ? 'rgba(239,68,68,.95)' : 'rgba(34,197,94,.95)',
          borderRadius:12, padding:'12px 24px', color:'#fff', fontSize:14, fontWeight:600,
          fontFamily:"'Outfit',sans-serif", whiteSpace:'nowrap', boxShadow:'0 8px 32px rgba(0,0,0,.5)' }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontFamily:"'Cinzel',serif", fontSize:22, fontWeight:700, color:'#fff', margin:0 }}>Adjustments</h1>
          <p style={{ color:'rgba(255,255,255,.35)', fontSize:13, marginTop:4 }}>Audit log of all manual wallet adjustments</p>
        </div>
        <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
          <DateRange from={dates.from} to={dates.to} onChange={setDates} />
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search player, ref, reason…"
            style={{ padding:'9px 14px', background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.1)', borderRadius:10, color:'#fff', fontSize:13, fontFamily:"'Outfit',sans-serif", outline:'none', width:240 }}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ padding:60, textAlign:'center', color:'rgba(255,255,255,.3)' }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding:60, textAlign:'center', color:'rgba(255,255,255,.3)', fontSize:14 }}>No adjustments found</div>
      ) : (
        <>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {filtered.map(item => {
              const ts = TYPE_STYLE[item.direction] || TYPE_STYLE.credit
              const bucketColor = item.wallet_bucket === 'cash' ? '#22c55e' : '#818cf8'
              return (
                <div key={item.id} style={{ background:'rgba(255,255,255,.02)', border:'1px solid rgba(255,255,255,.06)', borderRadius:12, padding:'14px 18px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:14, minWidth:0 }}>
                    {/* Direction indicator */}
                    <div style={{
                      width:36, height:36, borderRadius:'50%', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:900,
                      background: item.direction==='credit' ? 'rgba(34,197,94,.12)' : 'rgba(239,68,68,.12)',
                      color: ts.color,
                    }}>
                      {ts.prefix}
                    </div>
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:700, color:'#fff' }}>
                        {item.profiles?.full_name || '—'}
                        <span style={{ marginLeft:8, padding:'2px 6px', borderRadius:10, fontSize:10, fontWeight:700, background:`${bucketColor}22`, color:bucketColor }}>
                          {item.wallet_bucket}
                        </span>
                      </div>
                      <div style={{ fontSize:11, color:'rgba(255,255,255,.4)', marginTop:2 }}>
                        {item.reason}
                      </div>
                      <div style={{ fontSize:10, color:'rgba(255,255,255,.25)', marginTop:2 }}>
                        {item.reference_id} · {fmtDate(item.created_at)} · by {item.actor?.full_name || '—'}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:18, fontWeight:900, color:ts.color }}>
                      {ts.prefix}{fmt(item.amount_cents)}
                    </div>
                    {item.case_reference && (
                      <div style={{ fontSize:11, color:'rgba(255,255,255,.3)', marginTop:4, maxWidth:200, textAlign:'right' }}>
                        {item.case_reference}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Pagination */}
          <div style={{ display:'flex', gap:10, justifyContent:'center', marginTop:20 }}>
            {page > 0 && (
              <button onClick={() => setPage(p => p - 1)} style={{ padding:'8px 18px', background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.1)', borderRadius:8, color:'rgba(255,255,255,.6)', fontSize:13, cursor:'pointer', fontFamily:"'Outfit',sans-serif" }}>
                ← Prev
              </button>
            )}
            {items.length === PAGE_SIZE && (
              <button onClick={() => setPage(p => p + 1)} style={{ padding:'8px 18px', background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.1)', borderRadius:8, color:'rgba(255,255,255,.6)', fontSize:13, cursor:'pointer', fontFamily:"'Outfit',sans-serif" }}>
                Next →
              </button>
            )}
          </div>
        </>
      )}
    </AdminLayout>
  )
}
