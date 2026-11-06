import { useEffect, useState } from 'react'
import Head from 'next/head'
import { supabase } from '../../lib/supabase'
import AdminLayout from '../../components/layout/AdminLayout'
import StatusBadge from '../../components/ui/StatusBadge'

const fmtDate = d => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

const PRIORITY_COLORS = { urgent: '#ef4444', high: '#f97316', normal: '#fbbf24', low: '#22c55e' }

function TicketModal({ ticket, onClose, onReply, onClose2 }) {
  const [reply, setReply] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submitReply() {
    if (!reply.trim()) return
    setSaving(true); setError('')
    const result = await onReply(ticket.id, reply)
    if (result?.error) { setError(result.error); setSaving(false) }
    else { setReply('') }
    setSaving(false)
  }

  async function closeTicket() {
    setSaving(true)
    await onClose2(ticket.id)
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={onClose}>
      <div style={{ background: '#0e1a2e', border: '1px solid rgba(251,191,36,.3)', borderRadius: 20, padding: 32, width: '100%', maxWidth: 580, maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontFamily: "'Cinzel',serif", fontSize: 18, fontWeight: 700, color: '#fff' }}>Support Ticket</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.5)', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ background: 'rgba(251,191,36,.08)', border: '1px solid rgba(251,191,36,.2)', borderRadius: 12, padding: '12px 16px', marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 4 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{ticket.subject}</div>
            <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 99, background: (PRIORITY_COLORS[ticket.priority] || '#fbbf24') + '22', color: PRIORITY_COLORS[ticket.priority] || '#fbbf24', textTransform: 'uppercase' }}>{ticket.priority}</span>
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.5)' }}>{ticket.profiles?.full_name} · {ticket.profiles?.email}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', marginTop: 2 }}>Category: {ticket.category?.replace(/_/g, ' ')}</div>
        </div>

        <div style={{ background: 'rgba(255,255,255,.03)', borderRadius: 12, padding: '14px 16px', marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', marginBottom: 6 }}>{fmtDate(ticket.created_at)}</div>
          <p style={{ fontSize: 13, color: '#fff', lineHeight: 1.6, margin: 0 }}>{ticket.message}</p>
        </div>

        {ticket.status !== 'closed' && (
          <>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.45)', marginBottom: 6 }}>Reply</label>
              <textarea value={reply} onChange={e => setReply(e.target.value)} rows={3} placeholder="Type your reply…"
                style={{ width: '100%', padding: '11px 14px', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 10, color: '#fff', fontSize: 13, fontFamily: "'Outfit',sans-serif", outline: 'none', resize: 'none', boxSizing: 'border-box' }} />
            </div>
            {error && <div style={{ marginBottom: 14, padding: '10px 14px', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 10, color: '#f87171', fontSize: 13 }}>⚠ {error}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={submitReply} disabled={saving || !reply.trim()} style={{ flex: 1, padding: '11px', background: 'linear-gradient(135deg,#fbbf24,#f59e0b)', border: 'none', borderRadius: 10, color: '#050505', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>Send Reply</button>
              <button onClick={closeTicket} disabled={saving} style={{ padding: '11px 16px', background: 'rgba(34,197,94,.15)', border: '1px solid rgba(34,197,94,.3)', borderRadius: 10, color: '#22c55e', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>Close Ticket</button>
              <button onClick={onClose} style={{ padding: '11px 16px', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, color: 'rgba(255,255,255,.4)', fontSize: 13, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function AdminSupport() {
  const [rows, setRows] = useState([])
  const [filter, setFilter] = useState('open')
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
      const params = new URLSearchParams({ status: filter !== 'all' ? filter : '', limit: '100' })
      const res = await fetch(`/api/admin/support/list?${params}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const d = await res.json()
      setRows(d.rows || [])
    } catch (e) { console.error('Failed to load support tickets', e); setRows([]) }
    setLoading(false)
  }

  async function handleReply(id, message) {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/admin/support/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ ticket_id: id, message, close: false }),
    })
    const d = await res.json()
    if (!res.ok) return { error: d.error }
    showToast('Reply sent')
    return {}
  }

  async function handleClose(id) {
    const { data: { session } } = await supabase.auth.getSession()
    await fetch('/api/admin/support/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ ticket_id: id, message: 'Ticket closed by admin.', close: true }),
    })
    showToast('Ticket closed')
    load()
  }

  const filtered = rows.filter(r => {
    if (!search) return true
    const s = search.toLowerCase()
    return r.profiles?.full_name?.toLowerCase().includes(s) || r.profiles?.email?.toLowerCase().includes(s) || r.subject?.toLowerCase().includes(s)
  })

  return (
    <AdminLayout>
      <Head><title>Support — Admin</title></Head>
      {toast && <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, background: toast.type === 'error' ? 'rgba(239,68,68,.95)' : 'rgba(34,197,94,.95)', borderRadius: 12, padding: '12px 24px', color: '#fff', fontSize: 14, fontWeight: 600, fontFamily: "'Outfit',sans-serif", whiteSpace: 'nowrap', boxShadow: '0 8px 32px rgba(0,0,0,.5)' }}>{toast.msg}</div>}
      {selected && <TicketModal ticket={selected} onClose={() => { setSelected(null); load() }} onReply={handleReply} onClose2={handleClose} />}

      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: "'Cinzel',serif", fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 4 }}>Support Tickets</h1>
        <p style={{ color: 'rgba(255,255,255,.35)', fontSize: 13 }}>Manage player support requests</p>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,.04)', padding: 4, borderRadius: 10 }}>
          {['all', 'open', 'in_progress', 'closed'].map(s => (
            <button key={s} onClick={() => setFilter(s)} style={{ padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: "'Outfit',sans-serif", fontSize: 12, fontWeight: 700, background: filter === s ? 'rgba(251,191,36,.7)' : 'transparent', color: filter === s ? '#fff' : 'rgba(255,255,255,.4)', textTransform: 'capitalize', transition: 'all .15s' }}>{s.replace(/_/g, ' ')}</button>
          ))}
        </div>
        <input type="text" placeholder="Search player, email, subject…" value={search} onChange={e => setSearch(e.target.value)}
          style={{ padding: '9px 14px', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, color: '#fff', fontSize: 13, fontFamily: "'Outfit',sans-serif", outline: 'none', minWidth: 240 }} />
      </div>

      <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,.04)' }}>
                {['Player', 'Subject', 'Category', 'Priority', 'Status', 'Date', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 10, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.35)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,.3)' }}>Loading…</td></tr>
              : filtered.length === 0 ? <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,.3)' }}>{filter === 'open' ? '✅ No open tickets!' : 'No tickets found'}</td></tr>
              : filtered.map(r => (
                <tr key={r.id} style={{ borderTop: '1px solid rgba(255,255,255,.04)', cursor: 'pointer' }}
                  onClick={() => setSelected(r)}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.02)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{r.profiles?.full_name}</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,.4)' }}>{r.profiles?.email}</div>
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 13, color: '#fff', maxWidth: 200 }}><div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.subject}</div></td>
                  <td style={{ padding: '12px 14px', fontSize: 11, color: '#a855f7', textTransform: 'capitalize' }}>{r.category?.replace(/_/g, ' ')}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 99, background: (PRIORITY_COLORS[r.priority] || '#fbbf24') + '22', color: PRIORITY_COLORS[r.priority] || '#fbbf24', textTransform: 'uppercase' }}>{r.priority}</span>
                  </td>
                  <td style={{ padding: '12px 14px' }}><StatusBadge status={r.status} size="xs" /></td>
                  <td style={{ padding: '12px 14px', fontSize: 11, color: 'rgba(255,255,255,.35)', whiteSpace: 'nowrap' }}>{fmtDate(r.created_at)}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <button onClick={e => { e.stopPropagation(); setSelected(r) }} style={{ padding: '6px 12px', background: 'linear-gradient(135deg,#fbbf24,#f59e0b)', border: 'none', borderRadius: 8, color: '#050505', fontSize: 11, fontWeight: 800, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>Open</button>
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
