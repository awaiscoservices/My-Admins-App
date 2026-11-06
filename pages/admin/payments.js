import { useEffect, useState } from 'react'
import Head from 'next/head'
import { supabase } from '../../lib/supabase'
import AdminLayout from '../../components/layout/AdminLayout'
import StatusBadge from '../../components/ui/StatusBadge'

const fmt = c => c != null ? '$' + (c / 100).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '—'

function MethodModal({ method, onClose, onSave }) {
  const isNew = !method
  const [form, setForm] = useState({
    name: method?.name || '',
    type: method?.type || 'bank_transfer',
    min_amount_cents: method?.min_amount_cents ? (method.min_amount_cents / 100).toFixed(2) : '',
    max_amount_cents: method?.max_amount_cents ? (method.max_amount_cents / 100).toFixed(2) : '',
    fee_percent: method?.fee_percent || '',
    fee_fixed_cents: method?.fee_fixed_cents ? (method.fee_fixed_cents / 100).toFixed(2) : '',
    processing_time: method?.processing_time || '',
    is_active: method?.is_active ?? true,
    supports_deposit: method?.supports_deposit ?? true,
    supports_withdrawal: method?.supports_withdrawal ?? true,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    if (!form.name.trim()) { setError('Method name is required'); return }
    setSaving(true); setError('')
    const body = {
      ...form,
      min_amount_cents: form.min_amount_cents ? Math.round(parseFloat(form.min_amount_cents) * 100) : null,
      max_amount_cents: form.max_amount_cents ? Math.round(parseFloat(form.max_amount_cents) * 100) : null,
      fee_percent: form.fee_percent ? parseFloat(form.fee_percent) : 0,
      fee_fixed_cents: form.fee_fixed_cents ? Math.round(parseFloat(form.fee_fixed_cents) * 100) : 0,
    }
    const result = await onSave(method?.id, body)
    if (result?.error) { setError(result.error); setSaving(false) }
    else onClose()
  }

  const Toggle = ({ field, label }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <button onClick={() => setForm(p => ({ ...p, [field]: !p[field] }))} style={{ width: 40, height: 22, borderRadius: 99, border: 'none', cursor: 'pointer', background: form[field] ? '#22c55e' : 'rgba(255,255,255,.15)', position: 'relative', transition: 'background .2s' }}>
        <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: form[field] ? 21 : 3, transition: 'left .2s' }} />
      </button>
      <span style={{ fontSize: 13, color: form[field] ? '#22c55e' : 'rgba(255,255,255,.35)' }}>{label}</span>
    </div>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={onClose}>
      <div style={{ background: '#0e1a2e', border: '1px solid rgba(251,191,36,.3)', borderRadius: 20, padding: 32, width: '100%', maxWidth: 520, maxHeight: '88vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h2 style={{ fontFamily: "'Cinzel',serif", fontSize: 18, fontWeight: 700, color: '#fff' }}>{isNew ? 'Add Payment Method' : 'Edit Payment Method'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.5)', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div style={{ gridColumn: '1/-1' }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.45)', marginBottom: 6 }}>Method Name</label>
            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Bank Transfer"
              style={{ width: '100%', padding: '11px 14px', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 10, color: '#fff', fontSize: 13, fontFamily: "'Outfit',sans-serif", outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.45)', marginBottom: 6 }}>Type</label>
            <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
              style={{ width: '100%', padding: '11px 14px', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 10, color: '#fff', fontSize: 13, fontFamily: "'Outfit',sans-serif", outline: 'none' }}>
              {['bank_transfer', 'crypto', 'card', 'ewallet', 'cash'].map(t => <option key={t} value={t} style={{ background: '#0e1a2e' }}>{t.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          {[['min_amount_cents', 'Min Amount ($)'], ['max_amount_cents', 'Max Amount ($)'], ['fee_percent', 'Fee %'], ['fee_fixed_cents', 'Fixed Fee ($)']].map(([key, label]) => (
            <div key={key}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.45)', marginBottom: 6 }}>{label}</label>
              <input type="number" min="0" step="0.01" value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} placeholder="0"
                style={{ width: '100%', padding: '11px 14px', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 10, color: '#fff', fontSize: 13, fontFamily: "'Outfit',sans-serif", outline: 'none', boxSizing: 'border-box' }} />
            </div>
          ))}
          <div style={{ gridColumn: '1/-1' }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.45)', marginBottom: 6 }}>Processing Time</label>
            <input value={form.processing_time} onChange={e => setForm(p => ({ ...p, processing_time: e.target.value }))} placeholder="e.g. 1-3 business days"
              style={{ width: '100%', padding: '11px 14px', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 10, color: '#fff', fontSize: 13, fontFamily: "'Outfit',sans-serif", outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <Toggle field="is_active" label="Active" />
          <Toggle field="supports_deposit" label="Deposits" />
          <Toggle field="supports_withdrawal" label="Withdrawals" />
        </div>
        {error && <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 10, color: '#f87171', fontSize: 13 }}>⚠ {error}</div>}
        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <button onClick={submit} disabled={saving} style={{ flex: 1, padding: '11px', background: 'linear-gradient(135deg,#fbbf24,#f59e0b)', border: 'none', borderRadius: 10, color: '#050505', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>{saving ? 'Saving…' : isNew ? 'Add Method' : 'Save'}</button>
          <button onClick={onClose} style={{ padding: '11px 16px', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, color: 'rgba(255,255,255,.4)', fontSize: 13, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

export default function AdminPayments() {
  const [rows, setRows] = useState([])
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(undefined)
  const [toast, setToast] = useState(null)

  useEffect(() => { load() }, [filter])

  function showToast(msg, type = 'success') { setToast({ msg, type }); setTimeout(() => setToast(null), 4000) }

  async function load() {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const params = new URLSearchParams({ is_active: filter === 'active' ? 'true' : filter === 'inactive' ? 'false' : '' })
      const res = await fetch(`/api/admin/payments/list?${params}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const d = await res.json()
      setRows(d.rows || d.methods || [])
    } catch (e) { console.error('Failed to load payment methods', e); setRows([]) }
    setLoading(false)
  }

  async function handleSave(id, form) {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/admin/payments/' + (id ? 'update' : 'create'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify(id ? { method_id: id, ...form } : form),
    })
    const d = await res.json()
    if (!res.ok) return { error: d.error }
    showToast(id ? 'Method updated' : 'Method added')
    load()
    return {}
  }

  const TYPE_COLOR = { bank_transfer: '#06b6d4', crypto: '#a855f7', card: '#fbbf24', ewallet: '#22c55e', cash: '#f97316' }

  const filtered = rows.filter(r => {
    if (filter === 'deposits') return r.supports_deposit
    if (filter === 'withdrawals') return r.supports_withdrawal
    const s = search.toLowerCase()
    return !search || r.name?.toLowerCase().includes(s) || r.type?.toLowerCase().includes(s)
  })

  return (
    <AdminLayout>
      <Head><title>Payment Methods — Admin</title></Head>
      {toast && <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, background: toast.type === 'error' ? 'rgba(239,68,68,.95)' : 'rgba(34,197,94,.95)', borderRadius: 12, padding: '12px 24px', color: '#fff', fontSize: 14, fontWeight: 600, fontFamily: "'Outfit',sans-serif", whiteSpace: 'nowrap', boxShadow: '0 8px 32px rgba(0,0,0,.5)' }}>{toast.msg}</div>}
      {selected !== undefined && <MethodModal method={selected || null} onClose={() => setSelected(undefined)} onSave={handleSave} />}

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: "'Cinzel',serif", fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 4 }}>Payment Methods</h1>
          <p style={{ color: 'rgba(255,255,255,.35)', fontSize: 13 }}>Manage deposit and withdrawal channels</p>
        </div>
        <button onClick={() => setSelected(null)} style={{ padding: '10px 20px', background: 'linear-gradient(135deg,#fbbf24,#f59e0b)', border: 'none', borderRadius: 10, color: '#050505', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>+ Add Method</button>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,.04)', padding: 4, borderRadius: 10 }}>
          {['all', 'active', 'inactive', 'deposits', 'withdrawals'].map(s => (
            <button key={s} onClick={() => setFilter(s)} style={{ padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: "'Outfit',sans-serif", fontSize: 12, fontWeight: 700, background: filter === s ? 'rgba(251,191,36,.7)' : 'transparent', color: filter === s ? '#fff' : 'rgba(255,255,255,.4)', textTransform: 'capitalize', transition: 'all .15s' }}>{s}</button>
          ))}
        </div>
        <input type="text" placeholder="Search method…" value={search} onChange={e => setSearch(e.target.value)}
          style={{ padding: '9px 14px', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, color: '#fff', fontSize: 13, fontFamily: "'Outfit',sans-serif", outline: 'none', minWidth: 220 }} />
      </div>

      <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,.04)' }}>
                {['Method', 'Type', 'Min / Max', 'Fee', 'Processing', 'Channels', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 10, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.35)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,.3)' }}>Loading…</td></tr>
              : filtered.length === 0 ? <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,.3)' }}>No methods found</td></tr>
              : filtered.map(r => {
                const tc = TYPE_COLOR[r.type] || '#fbbf24'
                return (
                  <tr key={r.id} style={{ borderTop: '1px solid rgba(255,255,255,.04)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.02)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: '#fff' }}>{r.name}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 99, background: tc + '22', color: tc, textTransform: 'capitalize' }}>{r.type?.replace(/_/g, ' ')}</span>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 11, color: 'rgba(255,255,255,.5)', whiteSpace: 'nowrap' }}>{fmt(r.min_amount_cents)} — {r.max_amount_cents ? fmt(r.max_amount_cents) : '∞'}</td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: '#fbbf24' }}>{r.fee_percent ? r.fee_percent + '%' : ''}{r.fee_percent && r.fee_fixed_cents ? ' + ' : ''}{r.fee_fixed_cents ? fmt(r.fee_fixed_cents) : ''}{!r.fee_percent && !r.fee_fixed_cents ? 'Free' : ''}</td>
                    <td style={{ padding: '12px 14px', fontSize: 11, color: 'rgba(255,255,255,.4)' }}>{r.processing_time || '—'}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {r.supports_deposit && <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 99, background: 'rgba(34,197,94,.15)', color: '#22c55e' }}>DEP</span>}
                        {r.supports_withdrawal && <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 99, background: 'rgba(168,85,247,.15)', color: '#a855f7' }}>WD</span>}
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px' }}><StatusBadge status={r.is_active ? 'active' : 'inactive'} size="xs" /></td>
                    <td style={{ padding: '12px 14px' }}>
                      <button onClick={() => setSelected(r)} style={{ padding: '6px 12px', background: 'rgba(251,191,36,.15)', border: '1px solid rgba(251,191,36,.3)', borderRadius: 8, color: '#fbbf24', fontSize: 11, fontWeight: 800, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>Edit</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  )
}
