/**
 * /admin/kyc
 *
 * Admin — KYC Review
 * List submitted KYC records. Approve / Reject with reason.
 * On approve: sets kyc_verified=true on profiles.
 * Roles: super_admin, admin
 */
import { useEffect, useState } from 'react'
import Head from 'next/head'
import { supabase } from '../../lib/supabase'
import AdminLayout from '../../components/layout/AdminLayout'

const STATUS_OPTS = ['all', 'pending', 'approved', 'rejected']
const fmtDate = d => d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

const STATUS_STYLE = {
  pending:  { bg: 'rgba(251,191,36,.1)',  border: 'rgba(251,191,36,.3)',  color: '#fbbf24' },
  approved: { bg: 'rgba(34,197,94,.1)',   border: 'rgba(34,197,94,.3)',   color: '#22c55e' },
  rejected: { bg: 'rgba(239,68,68,.1)',   border: 'rgba(239,68,68,.3)',   color: '#f87171' },
}

export default function AdminKYC() {
  const [items,   setItems]   = useState([])
  const [status,  setStatus]  = useState('pending')
  const [loading, setLoading] = useState(true)
  const [modal,   setModal]   = useState(null)   // { item, action }
  const [reason,  setReason]  = useState('')
  const [acting,  setActing]  = useState(null)
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

    const { data: p } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
    setRole(p?.role || '')

    let q = supabase
      .from('kyc_records')
      .select(`
        id, status, document_type, document_url, submitted_at, reviewed_at, rejection_reason,
        profiles ( id, full_name, email, kyc_verified )
      `)
      .order('submitted_at', { ascending: false })
      .limit(100)

    if (status !== 'all') q = q.eq('status', status)

    const { data, error } = await q
    if (error) { showToast(error.message, 'error'); setLoading(false); return }
    setItems(data || [])
    setLoading(false)
  }

  async function confirmAction() {
    if (!modal) return
    const { item, action } = modal
    if (action === 'reject' && !reason.trim()) {
      showToast('Rejection reason is required', 'error'); return
    }
    setActing(item.id)
    setModal(null)

    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/admin/kyc/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ kyc_id: item.id, action, rejection_reason: reason }),
    })
    const json = await res.json()
    setActing(null)

    if (!res.ok) { showToast(json.error || 'Action failed', 'error'); return }
    showToast(action === 'approve' ? `KYC approved for ${item.profiles?.full_name}` : `KYC rejected`)
    load()
  }

  const canAct = ['super_admin', 'admin'].includes(role)

  return (
    <AdminLayout>
      <Head><title>KYC Review — Admin</title></Head>

      {toast && (
        <div style={{ position:'fixed', top:16, left:'50%', transform:'translateX(-50%)', zIndex:9999,
          background: toast.type==='error' ? 'rgba(239,68,68,.95)' : 'rgba(34,197,94,.95)',
          borderRadius:12, padding:'12px 24px', color:'#fff', fontSize:14, fontWeight:600,
          fontFamily:"'Outfit',sans-serif", whiteSpace:'nowrap', boxShadow:'0 8px 32px rgba(0,0,0,.5)' }}>
          {toast.msg}
        </div>
      )}

      {modal && (
        <div style={{ position:'fixed', inset:0, zIndex:9998, background:'rgba(0,0,0,.7)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:'#0d1f35', border:'1px solid rgba(255,255,255,.1)', borderRadius:20, padding:28, maxWidth:440, width:'100%' }}>
            <div style={{ fontSize:16, fontWeight:800, color:'#fff', marginBottom:8, fontFamily:"'Cinzel',serif" }}>
              {modal.action === 'approve' ? '✅ Approve KYC' : '❌ Reject KYC'}
            </div>
            <div style={{ fontSize:13, color:'rgba(255,255,255,.5)', marginBottom:16 }}>
              {modal.item.profiles?.full_name} · {modal.item.document_type}
            </div>
            {modal.action === 'reject' && (
              <div style={{ marginBottom:16 }}>
                <label style={{ display:'block', fontSize:10, fontWeight:800, letterSpacing:'.1em', textTransform:'uppercase', color:'rgba(255,255,255,.35)', marginBottom:6 }}>
                  Rejection Reason *
                </label>
                <textarea
                  value={reason} onChange={e => setReason(e.target.value)}
                  rows={3}
                  style={{ width:'100%', padding:'9px 12px', background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.1)', borderRadius:8, color:'#fff', fontSize:13, fontFamily:"'Outfit',sans-serif", resize:'vertical', boxSizing:'border-box' }}
                  placeholder="Explain why the document was rejected…"
                />
              </div>
            )}
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={confirmAction} style={{
                flex:1, padding:'10px 0', border:'none', borderRadius:10, fontSize:13, fontWeight:800, cursor:'pointer', fontFamily:"'Outfit',sans-serif",
                background: modal.action==='approve' ? 'linear-gradient(135deg,#22c55e,#16a34a)' : 'linear-gradient(135deg,#ef4444,#dc2626)',
                color:'#fff',
              }}>
                {modal.action === 'approve' ? 'Approve' : 'Reject'}
              </button>
              <button onClick={() => setModal(null)} style={{ padding:'10px 18px', background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.1)', borderRadius:10, color:'rgba(255,255,255,.5)', fontSize:13, cursor:'pointer', fontFamily:"'Outfit',sans-serif" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontFamily:"'Cinzel',serif", fontSize:22, fontWeight:700, color:'#fff', margin:0 }}>KYC Review</h1>
          <p style={{ color:'rgba(255,255,255,.35)', fontSize:13, marginTop:4 }}>Verify identity documents submitted by players</p>
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
        <div style={{ padding:60, textAlign:'center', color:'rgba(255,255,255,.3)', fontSize:14 }}>No {status === 'all' ? '' : status} KYC submissions</div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {items.map(item => {
            const st = STATUS_STYLE[item.status] || STATUS_STYLE.pending
            return (
              <div key={item.id} style={{ background:'rgba(255,255,255,.02)', border:'1px solid rgba(255,255,255,.07)', borderRadius:14, padding:'16px 20px' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                    <div style={{ padding:'4px 10px', borderRadius:20, fontSize:10, fontWeight:800, letterSpacing:'.08em', textTransform:'uppercase', background:st.bg, border:`1px solid ${st.border}`, color:st.color }}>
                      {item.status}
                    </div>
                    <div>
                      <div style={{ fontSize:14, fontWeight:700, color:'#fff' }}>{item.profiles?.full_name || '—'}</div>
                      <div style={{ fontSize:11, color:'rgba(255,255,255,.35)', marginTop:2 }}>
                        {item.profiles?.email} · {item.document_type} · Submitted {fmtDate(item.submitted_at)}
                      </div>
                      {item.rejection_reason && (
                        <div style={{ fontSize:11, color:'#f87171', marginTop:4 }}>Reason: {item.rejection_reason}</div>
                      )}
                    </div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    {item.document_url && (
                      <a href={item.document_url} target="_blank" rel="noopener noreferrer" style={{ padding:'8px 14px', background:'rgba(99,102,241,.1)', border:'1px solid rgba(99,102,241,.3)', borderRadius:8, color:'#818cf8', fontSize:12, fontWeight:700, textDecoration:'none', fontFamily:"'Outfit',sans-serif" }}>
                        View Doc ↗
                      </a>
                    )}
                    {canAct && item.status === 'pending' && (
                      <>
                        <button onClick={() => { setModal({ item, action:'approve' }); setReason('') }} disabled={acting===item.id} style={{ padding:'8px 16px', background:'rgba(34,197,94,.12)', border:'1px solid rgba(34,197,94,.3)', borderRadius:8, color:'#22c55e', fontSize:12, fontWeight:800, cursor:'pointer', fontFamily:"'Outfit',sans-serif" }}>
                          Approve
                        </button>
                        <button onClick={() => { setModal({ item, action:'reject' }); setReason('') }} disabled={acting===item.id} style={{ padding:'8px 16px', background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.25)', borderRadius:8, color:'#f87171', fontSize:12, fontWeight:800, cursor:'pointer', fontFamily:"'Outfit',sans-serif" }}>
                          Reject
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </AdminLayout>
  )
}
