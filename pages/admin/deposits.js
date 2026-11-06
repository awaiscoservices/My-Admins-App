import { useEffect, useState } from 'react'
import Head from 'next/head'
import { supabase } from '../../lib/supabase'
import AdminLayout from '../../components/layout/AdminLayout'
import StatusBadge from '../../components/ui/StatusBadge'

const fmt = c => '$' + (c / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

function ReviewModal({ deposit, onClose, onAction }) {
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(action) {
    setSaving(true); setError('')
    const result = await onAction(deposit.id, action, notes)
    if (result?.error) { setError(result.error); setSaving(false) }
    else onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={onClose}>
      <div style={{ background: '#0e1a2e', border: '1px solid rgba(251,191,36,.3)', borderRadius: 20, padding: 32, width: '100%', maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontFamily: "'Cinzel',serif", fontSize: 18, fontWeight: 700, color: '#fff' }}>Review Deposit</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.5)', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ background: 'rgba(251,191,36,.08)', border: '1px solid rgba(251,191,36,.2)', borderRadius: 12, padding: '12px 16px', marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{deposit.profiles?.full_name}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.5)' }}>{deposit.profiles?.email}</div>
          <div style={{ fontSize: 13, color: '#22c55e', fontWeight: 700, marginTop: 8 }}>{fmt(deposit.amount_cents)}</div>
          {deposit.bonus_cents > 0 && (
            <div style={{ fontSize: 11, color: '#fbbf24', marginTop: 2 }}>+{fmt(deposit.bonus_cents)} bonus</div>
          )}
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', marginTop: 2 }}>Ref: {deposit.reference_id}</div>
          {deposit.player_reference && <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', marginTop: 2 }}>Player ref: {deposit.player_reference}</div>}
          {deposit.screenshot_url && <a href={deposit.screenshot_url} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 8, fontSize: 12, color: '#fbbf24' }}>View Proof ↗</a>}
          {deposit.player_notes && <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', marginTop: 4 }}>Note: {deposit.player_notes}</div>}
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.45)', marginBottom: 6 }}>Notes (optional)</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Internal note or rejection reason…"
            style={{ width: '100%', padding: '11px 14px', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 10, color: '#fff', fontSize: 13, fontFamily: "'Outfit',sans-serif", outline: 'none', resize: 'none', boxSizing: 'border-box' }} />
        </div>
        {error && <div style={{ marginBottom: 14, padding: '10px 14px', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 10, color: '#f87171', fontSize: 13 }}>⚠ {error}</div>}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => submit('approve')} disabled={saving} style={{ flex: 1, padding: '11px', background: 'linear-gradient(135deg,#22c55e,#16a34a)', border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>✅ Approve</button>
          <button onClick={() => submit('reject')} disabled={saving} style={{ flex: 1, padding: '11px', background: 'rgba(239,68,68,.15)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 10, color: '#f87171', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>❌ Reject</button>
          <button onClick={onClose} style={{ padding: '11px 16px', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, color: 'rgba(255,255,255,.4)', fontSize: 13, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

export default function AdminDeposits() {
  const [deposits, setDeposits] = useState([])
  const [filter, setFilter] = useState('pending')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [toast, setToast] = useState(null)

  useEffect(() => { load() }, [filter])

  function showToast(msg, type = 'success') { setToast({ msg, type }); setTimeout(() => setToast(null), 4000) }

  async function load() {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setDeposits([]); setLoading(false); return }
      const params = new URLSearchParams({ status: filter })
      const res = await fetch(`/api/admin/deposits/list?${params}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const d = await res.json()
      if (!res.ok) { showToast(d.error || 'Failed to load deposits', 'error'); setDeposits([]); }
      else setDeposits(d.deposits || [])
    } catch (e) {
      console.error('Failed to load deposits', e)
      setDeposits([])
    }
    setLoading(false)
  }

  async function handleAction(id, action, notes) {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/admin/deposits/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ deposit_id: id, action, notes }),
    })
    const d = await res.json()
    if (!res.ok) return { error: d.error }
    showToast(`Deposit ${action}d`)
    load()
    return {}
  }

  const rows = deposits.filter(r => {
    if (!search) return true
    const s = search.toLowerCase()
    return r.profiles?.full_name?.toLowerCase().includes(s) ||
      r.profiles?.email?.toLowerCase().includes(s) ||
      r.reference_id?.toLowerCase().includes(s)
  })

  return (
    <AdminLayout>
      <Head><title>Deposits — Admin</title></Head>
      {toast && <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, background: toast.type === 'error' ? 'rgba(239,68,68,.95)' : 'rgba(34,197,94,.95)', borderRadius: 12, padding: '12px 24px', color: '#fff', fontSize: 14, fontWeight: 600, fontFamily: "'Outfit',sans-serif", whiteSpace: 'nowrap', boxShadow: '0 8px 32px rgba(0,0,0,.5)' }}>{toast.msg}</div>}
      {selected && <ReviewModal deposit={selected} onClose={() => setSelected(null)} onAction={handleAction} />}

      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: "'Cinzel',serif", fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 4 }}>Deposits</h1>
        <p style={{ color: 'rgba(255,255,255,.35)', fontSize: 13 }}>Review and approve player deposit requests</p>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,.04)', padding: 4, borderRadius: 10 }}>
          {['all', 'pending', 'approved', 'rejected'].map(s => (
            <button key={s} onClick={() => setFilter(s)} style={{ padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: "'Outfit',sans-serif", fontSize: 12, fontWeight: 700, background: filter === s ? 'rgba(251,191,36,.7)' : 'transparent', color: filter === s ? '#fff' : 'rgba(255,255,255,.4)', textTransform: 'capitalize', transition: 'all .15s' }}>{s}</button>
          ))}
        </div>
        <input type="text" placeholder="Search player, email, reference…" value={search} onChange={e => setSearch(e.target.value)}
          style={{ padding: '9px 14px', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, color: '#fff', fontSize: 13, fontFamily: "'Outfit',sans-serif", outline: 'none', minWidth: 240 }} />
      </div>

      <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,.04)' }}>
                {['Reference', 'Player', 'Amount', 'Bonus', 'Status', 'Date', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 10, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.35)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'rgba(255,255,255,.3)' }}>Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'rgba(255,255,255,.3)' }}>
                  {filter === 'pending' ? '✅ No pending deposits!' : 'No deposits found'}
                </td></tr>
              ) : rows.map(d => (
                <tr key={d.id} style={{ borderTop: '1px solid rgba(255,255,255,.04)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.02)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#fbbf24', fontFamily: 'monospace' }}>{d.reference_id}</div>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{d.profiles?.full_name || '—'}</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,.4)' }}>{d.profiles?.email}</div>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#22c55e' }}>{fmt(d.amount_cents)}</div>
                    {d.total_credit_cents > d.amount_cents && (
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,.35)' }}>Total: {fmt(d.total_credit_cents)}</div>
                    )}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 12, color: d.bonus_cents > 0 ? '#fbbf24' : 'rgba(255,255,255,.25)' }}>
                    {d.bonus_cents > 0 ? fmt(d.bonus_cents) : '—'}
                  </td>
                  <td style={{ padding: '12px 14px' }}><StatusBadge status={d.status} size="xs" /></td>
                  <td style={{ padding: '12px 14px', fontSize: 11, color: 'rgba(255,255,255,.3)', whiteSpace: 'nowrap' }}>{fmtDate(d.created_at)}</td>
                  <td style={{ padding: '12px 14px' }}>
                    {d.status === 'pending' ? (
                      <button onClick={() => setSelected(d)} style={{ padding: '6px 14px', background: 'linear-gradient(135deg,#fbbf24,#f59e0b)', border: 'none', borderRadius: 8, color: '#050505', fontSize: 11, fontWeight: 800, cursor: 'pointer', fontFamily: "'Outfit',sans-serif", whiteSpace: 'nowrap' }}>
                        ⚡ Review
                      </button>
                    ) : (
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,.25)' }}>{d.rejection_reason ? 'Rejected' : 'Done'}</span>
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
