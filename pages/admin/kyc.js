/**
 * /admin/kyc  (sidebar label: KYC Review)
 * Design matches Deposits page exactly.
 * DB columns: doc_type, doc_front_url, doc_back_url, selfie_url, admin_notes
 * profiles: kyc_status (not kyc_verified)
 */
import { useEffect, useState } from 'react'
import Head from 'next/head'
import { supabase } from '../../lib/supabase'
import AdminLayout from '../../components/layout/AdminLayout'
import StatusBadge from '../../components/ui/StatusBadge'

const fmtDate = d => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

const DOC_LABELS = {
  passport: 'Passport',
  national_id: 'National ID',
  drivers_license: "Driver's License",
  utility_bill: 'Utility Bill',
}

function ReviewModal({ item, onClose, onAction }) {
  const [reason, setReason]   = useState('')
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

  async function submit(action) {
    if (action === 'reject' && !reason.trim()) { setError('Rejection reason is required'); return }
    setSaving(true); setError('')
    const result = await onAction(item.id, action, reason)
    if (result?.error) { setError(result.error); setSaving(false) }
    else onClose()
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.8)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }} onClick={onClose}>
      <div style={{ background:'#0e1a2e', border:'1px solid rgba(251,191,36,.3)', borderRadius:20, padding:32, width:'100%', maxWidth:500 }} onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <h2 style={{ fontFamily:"'Cinzel',serif", fontSize:18, fontWeight:700, color:'#fff' }}>Review KYC</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'rgba(255,255,255,.5)', fontSize:20, cursor:'pointer' }}>✕</button>
        </div>
        <div style={{ background:'rgba(251,191,36,.08)', border:'1px solid rgba(251,191,36,.2)', borderRadius:12, padding:'12px 16px', marginBottom:20 }}>
          <div style={{ fontSize:13, fontWeight:700, color:'#fff', marginBottom:4 }}>{item.profiles?.full_name}</div>
          <div style={{ fontSize:11, color:'rgba(255,255,255,.5)' }}>{item.profiles?.email}</div>
          <div style={{ fontSize:12, color:'rgba(255,255,255,.5)', marginTop:6 }}>
            Document: {DOC_LABELS[item.doc_type] || item.doc_type}
          </div>
          <div style={{ display:'flex', gap:12, marginTop:8, flexWrap:'wrap' }}>
            {item.doc_front_url && (
              <a href={item.doc_front_url} target="_blank" rel="noreferrer"
                style={{ fontSize:12, color:'#fbbf24', textDecoration:'none' }}>Front ↗</a>
            )}
            {item.doc_back_url && (
              <a href={item.doc_back_url} target="_blank" rel="noreferrer"
                style={{ fontSize:12, color:'#fbbf24', textDecoration:'none' }}>Back ↗</a>
            )}
            {item.selfie_url && (
              <a href={item.selfie_url} target="_blank" rel="noreferrer"
                style={{ fontSize:12, color:'#fbbf24', textDecoration:'none' }}>Selfie ↗</a>
            )}
          </div>
        </div>
        <div style={{ marginBottom:20 }}>
          <label style={{ display:'block', fontSize:11, fontWeight:700, letterSpacing:'.08em', textTransform:'uppercase', color:'rgba(255,255,255,.45)', marginBottom:6 }}>Rejection Reason (required if rejecting)</label>
          <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} placeholder="State reason if rejecting…"
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

export default function AdminKYC() {
  const [items,    setItems]    = useState([])
  const [filter,   setFilter]   = useState('pending')
  const [search,   setSearch]   = useState('')
  const [loading,  setLoading]  = useState(true)
  const [selected, setSelected] = useState(null)
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
      const res = await fetch(`/api/admin/kyc/list?status=${filter}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: 'no-store',
      })
      const d = await res.json()
      if (!res.ok) { showToast(d.error || 'Failed to load KYC records', 'error'); setItems([]) }
      else setItems(d.data || [])
    } catch (e) { console.error(e); setItems([]) }
    setLoading(false)
  }

  async function handleAction(id, action, rejection_reason) {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/admin/kyc/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ kyc_id: id, action, rejection_reason }),
    })
    const d = await res.json()
    if (!res.ok) return { error: d.error }
    showToast(`KYC ${action}d`)
    load()
    return {}
  }

  const rows = items.filter(r => {
    if (!search) return true
    const s = search.toLowerCase()
    return r.profiles?.full_name?.toLowerCase().includes(s) ||
      r.profiles?.email?.toLowerCase().includes(s) ||
      r.doc_type?.toLowerCase().includes(s)
  })

  return (
    <AdminLayout>
      <Head><title>KYC Review — Admin</title></Head>
      {toast && <div style={{ position:'fixed', top:16, left:'50%', transform:'translateX(-50%)', zIndex:9999, background: toast.type==='error' ? 'rgba(239,68,68,.95)' : 'rgba(34,197,94,.95)', borderRadius:12, padding:'12px 24px', color:'#fff', fontSize:14, fontWeight:600, fontFamily:"'Outfit',sans-serif", whiteSpace:'nowrap', boxShadow:'0 8px 32px rgba(0,0,0,.5)' }}>{toast.msg}</div>}
      {selected && <ReviewModal item={selected} onClose={() => setSelected(null)} onAction={handleAction} />}

      <div style={{ marginBottom:20 }}>
        <h1 style={{ fontFamily:"'Cinzel',serif", fontSize:22, fontWeight:700, color:'#fff', marginBottom:4 }}>KYC Review</h1>
        <p style={{ color:'rgba(255,255,255,.35)', fontSize:13 }}>Review and verify player identity documents</p>
      </div>

      <div style={{ display:'flex', gap:12, marginBottom:20, flexWrap:'wrap', alignItems:'center' }}>
        <div style={{ display:'flex', gap:4, background:'rgba(255,255,255,.04)', padding:4, borderRadius:10 }}>
          {/* 'verified', not 'approved' — no record can ever hold that
              value, so the tab matched nothing. */}
          {['all','pending','verified','rejected'].map(s => (
            <button key={s} onClick={() => setFilter(s)} style={{ padding:'7px 16px', borderRadius:8, border:'none', cursor:'pointer', fontFamily:"'Outfit',sans-serif", fontSize:12, fontWeight:700, background: filter===s ? 'rgba(251,191,36,.7)' : 'transparent', color: filter===s ? '#fff' : 'rgba(255,255,255,.4)', textTransform:'capitalize', transition:'all .15s' }}>{s}</button>
          ))}
        </div>
        <input type="text" placeholder="Search player, email, document type…" value={search} onChange={e => setSearch(e.target.value)}
          style={{ padding:'9px 14px', background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.1)', borderRadius:10, color:'#fff', fontSize:13, fontFamily:"'Outfit',sans-serif", outline:'none', minWidth:260 }} />
      </div>

      <div style={{ background:'rgba(255,255,255,.02)', border:'1px solid rgba(255,255,255,.07)', borderRadius:16, overflow:'hidden' }}>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:'rgba(255,255,255,.04)' }}>
                {['Player','Document','KYC Status','Status','Submitted','Actions'].map(h => (
                  <th key={h} style={{ padding:'11px 14px', textAlign:'left', fontSize:10, fontWeight:800, letterSpacing:'.1em', textTransform:'uppercase', color:'rgba(255,255,255,.35)', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ padding:'40px', textAlign:'center', color:'rgba(255,255,255,.3)' }}>Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} style={{ padding:'40px', textAlign:'center', color:'rgba(255,255,255,.3)' }}>
                  {filter === 'pending' ? '✅ No pending KYC!' : 'No KYC records found'}
                </td></tr>
              ) : rows.map(r => (
                <tr key={r.id} style={{ borderTop:'1px solid rgba(255,255,255,.04)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.02)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding:'12px 14px' }}>
                    <div style={{ fontSize:13, fontWeight:700, color:'#fff' }}>{r.profiles?.full_name || '—'}</div>
                    <div style={{ fontSize:10, color:'rgba(255,255,255,.4)' }}>{r.profiles?.email}</div>
                  </td>
                  <td style={{ padding:'12px 14px' }}>
                    <div style={{ fontSize:13, color:'#fff' }}>{DOC_LABELS[r.doc_type] || r.doc_type || '—'}</div>
                    <div style={{ display:'flex', gap:8, marginTop:2 }}>
                      {r.doc_front_url && <a href={r.doc_front_url} target="_blank" rel="noreferrer" style={{ fontSize:10, color:'#fbbf24', textDecoration:'none' }}>Front ↗</a>}
                      {r.doc_back_url  && <a href={r.doc_back_url}  target="_blank" rel="noreferrer" style={{ fontSize:10, color:'#fbbf24', textDecoration:'none' }}>Back ↗</a>}
                      {r.selfie_url    && <a href={r.selfie_url}    target="_blank" rel="noreferrer" style={{ fontSize:10, color:'#fbbf24', textDecoration:'none' }}>Selfie ↗</a>}
                    </div>
                  </td>
                  <td style={{ padding:'12px 14px' }}>
                    <span style={{ fontSize:11, fontWeight:700, color: r.profiles?.kyc_status === 'verified' ? '#22c55e' : 'rgba(255,255,255,.3)' }}>
                      {r.profiles?.kyc_status === 'verified' ? '✅ Verified' : r.profiles?.kyc_status || '—'}
                    </span>
                  </td>
                  <td style={{ padding:'12px 14px' }}><StatusBadge status={r.status} size="xs" /></td>
                  <td style={{ padding:'12px 14px', fontSize:11, color:'rgba(255,255,255,.3)', whiteSpace:'nowrap' }}>{fmtDate(r.submitted_at)}</td>
                  <td style={{ padding:'12px 14px' }}>
                    {r.status === 'pending' ? (
                      <button onClick={() => setSelected(r)} style={{ padding:'6px 14px', background:'linear-gradient(135deg,#fbbf24,#f59e0b)', border:'none', borderRadius:8, color:'#050505', fontSize:11, fontWeight:800, cursor:'pointer', fontFamily:"'Outfit',sans-serif", whiteSpace:'nowrap' }}>
                        ⚡ Review
                      </button>
                    ) : (
                      <span style={{ fontSize:11, color:'rgba(255,255,255,.25)' }}>{r.rejection_reason ? 'Rejected' : 'Done'}</span>
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
