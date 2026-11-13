import { useEffect, useState } from 'react'
import Head from 'next/head'
import { supabase } from '../../lib/supabase'
import AdminLayout from '../../components/layout/AdminLayout'
import StatusBadge from '../../components/ui/StatusBadge'

const fmt = c => c != null ? '$' + (c / 100).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '—'

// payment_methods.type has a CHECK constraint. The old dropdown offered
// 'card', 'ewallet' and 'cash', which are not in it — saving a new method
// failed with payment_methods_type_check. These are the values the rest of
// the system uses: the promotions Payment Methods tab, and the player app's
// deposit, withdraw and payout-method screens.
const TYPES = ['cashapp', 'zelle', 'venmo', 'chime', 'paypal', 'bank_transfer', 'crypto', 'money_order', 'other']

const TYPE_COLOR = {
  cashapp: '#22c55e', zelle: '#a855f7', venmo: '#3b82f6', chime: '#06b6d4',
  paypal: '#0ea5e9', bank_transfer: '#fbbf24', crypto: '#f97316',
  money_order: '#8b5cf6', other: '#94a3b8',
}

function MethodModal({ method, onClose, onSave }) {
  const isNew = !method
  // Every key here is a real column on payment_methods. The old form used
  // min_amount_cents, fee_percent, fee_fixed_cents, processing_time and
  // supports_deposit/withdrawal — none of which exist on the table.
  const [form, setForm] = useState({
    name: method?.name || '',
    type: method?.type || 'cashapp',
    min_deposit_cents: method?.min_deposit_cents != null ? (method.min_deposit_cents / 100).toFixed(2) : '5.00',
    max_deposit_cents: method?.max_deposit_cents != null ? (method.max_deposit_cents / 100).toFixed(2) : '1000.00',
    sort_order: method?.sort_order ?? 0,
    description: method?.description || '',
    instructions: method?.instructions || '',
    // Account details the player sees on deposit step 3: free text + an
    // optional payment QR image. Stored together in the account_details jsonb.
    account_text: method?.account_details?.text || '',
    qr_image_url: method?.account_details?.qr_image_url || '',
    is_active: method?.is_active ?? true,
    is_auto: method?.is_auto ?? false,
    allow_deposit: method?.allow_deposit ?? true,
    allow_withdraw: method?.allow_withdraw ?? true,
    requires_proof: method?.requires_proof ?? true,
    requires_reference: method?.requires_reference ?? true,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [qrUploading, setQrUploading] = useState(false)

  async function uploadQr(file) {
    if (!file) return
    setQrUploading(true); setError('')
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result).split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin/payments/upload-qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ file_base64: base64, file_type: file.type, file_name: file.name }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Upload failed')
      setForm(p => ({ ...p, qr_image_url: d.url }))
    } catch (err) { setError(err.message || 'QR upload failed') }
    finally { setQrUploading(false) }
  }

  async function submit() {
    if (!form.name.trim()) { setError('Method name is required'); return }
    setSaving(true); setError('')
    // min/max are NOT NULL on the table, so fall back to the column defaults
    // rather than sending null.
    const body = {
      ...form,
      min_deposit_cents: form.min_deposit_cents ? Math.round(parseFloat(form.min_deposit_cents) * 100) : 500,
      max_deposit_cents: form.max_deposit_cents ? Math.round(parseFloat(form.max_deposit_cents) * 100) : 100000,
      sort_order: parseInt(form.sort_order, 10) || 0,
      description: form.description.trim() || null,
      instructions: form.instructions.trim() || null,
      // Bundle the player-facing account details into the jsonb column.
      account_details: {
        text: form.account_text.trim() || '',
        ...(form.qr_image_url ? { qr_image_url: form.qr_image_url } : {}),
      },
    }
    delete body.account_text
    delete body.qr_image_url
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
              {TYPES.map(t => <option key={t} value={t} style={{ background: '#0e1a2e' }}>{t.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          {[['min_deposit_cents', 'Min Deposit ($)'], ['max_deposit_cents', 'Max Deposit ($)'], ['sort_order', 'Sort Order']].map(([key, label]) => (
            <div key={key}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.45)', marginBottom: 6 }}>{label}</label>
              <input type="number" min="0" step="0.01" value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} placeholder="0"
                style={{ width: '100%', padding: '11px 14px', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 10, color: '#fff', fontSize: 13, fontFamily: "'Outfit',sans-serif", outline: 'none', boxSizing: 'border-box' }} />
            </div>
          ))}
          <div style={{ gridColumn: '1/-1' }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.45)', marginBottom: 6 }}>Description</label>
            <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Short line players see under the name"
              style={{ width: '100%', padding: '11px 14px', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 10, color: '#fff', fontSize: 13, fontFamily: "'Outfit',sans-serif", outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.45)', marginBottom: 6 }}>Player Instructions</label>
            <textarea rows={3} value={form.instructions} onChange={e => setForm(p => ({ ...p, instructions: e.target.value }))} placeholder="How to pay — where to send it, what to include"
              style={{ width: '100%', padding: '11px 14px', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 10, color: '#fff', fontSize: 13, fontFamily: "'Outfit',sans-serif", outline: 'none', boxSizing: 'border-box', resize: 'vertical' }} />
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.45)', marginBottom: 6 }}>Account Details (shown to player)</label>
            <textarea rows={3} value={form.account_text} onChange={e => setForm(p => ({ ...p, account_text: e.target.value }))} placeholder="e.g. CashApp tag: $YourTag&#10;Name: John Doe"
              style={{ width: '100%', padding: '11px 14px', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 10, color: '#fff', fontSize: 13, fontFamily: "'Outfit',sans-serif", outline: 'none', boxSizing: 'border-box', resize: 'vertical' }} />
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.45)', marginBottom: 6 }}>Payment QR Image (optional)</label>
            <input type="file" accept="image/*" disabled={qrUploading} onChange={e => uploadQr(e.target.files?.[0])}
              style={{ width: '100%', padding: '9px 10px', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 10, color: '#fff', fontSize: 12, fontFamily: "'Outfit',sans-serif", boxSizing: 'border-box' }} />
            {qrUploading && <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', marginTop: 6 }}>Uploading…</div>}
            {form.qr_image_url && !qrUploading && (
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                <img src={form.qr_image_url} alt="QR" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, border: '1px solid rgba(255,255,255,.15)' }} />
                <button type="button" onClick={() => setForm(p => ({ ...p, qr_image_url: '' }))} style={{ background: 'rgba(239,68,68,.15)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 8, color: '#f87171', fontSize: 11, fontWeight: 700, padding: '6px 12px', cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>Remove</button>
              </div>
            )}
          </div>
          <Toggle field="is_active" label="Active" />
          <Toggle field="is_auto" label="Auto-approve" />
          <Toggle field="allow_deposit" label="Deposits" />
          <Toggle field="allow_withdraw" label="Withdraws" />
          <Toggle field="requires_proof" label="Needs proof" />
          <Toggle field="requires_reference" label="Needs reference" />
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
      // A refused request used to leave the table empty, which reads as "this
      // casino has no payment methods" rather than "you were not allowed to
      // see them". Say which it is.
      if (!res.ok) { setRows([]); showToast(d.error || 'Could not load payment methods', 'error'); return }
      setRows(d.rows || d.methods || [])
    } catch (e) { console.error('Failed to load payment methods', e); setRows([]); showToast('Could not load payment methods', 'error') }
    setLoading(false)
  }

  async function handleSave(id, form) {
    const { data: { session } } = await supabase.auth.getSession()
    // One route handles both: /create and /update never existed, so adding a
    // payment method 404'd. save.js inserts when there is no id and updates
    // when there is — and it reads `id`, not `method_id`.
    const res = await fetch('/api/admin/payments/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify(id ? { id, ...form } : form),
    })
    const d = await res.json()
    if (!res.ok) return { error: d.error }
    showToast(id ? 'Method updated' : 'Method added')
    load()
    return {}
  }

  const filtered = rows.filter(r => {
    if (filter === 'deposits') return r.allow_deposit
    if (filter === 'withdrawals') return r.allow_withdraw
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
                {['Method', 'Type', 'Min / Max', 'Requires', 'Channels', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 10, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.35)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,.3)' }}>Loading…</td></tr>
              : filtered.length === 0 ? <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,.3)' }}>No methods found</td></tr>
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
                    <td style={{ padding: '12px 14px', fontSize: 11, color: 'rgba(255,255,255,.5)', whiteSpace: 'nowrap' }}>{fmt(r.min_deposit_cents)} — {r.max_deposit_cents ? fmt(r.max_deposit_cents) : '∞'}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {r.requires_proof && <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 99, background: 'rgba(251,191,36,.15)', color: '#fbbf24' }}>PROOF</span>}
                        {r.requires_reference && <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 99, background: 'rgba(6,182,212,.15)', color: '#06b6d4' }}>REF</span>}
                        {!r.requires_proof && !r.requires_reference && <span style={{ fontSize: 11, color: 'rgba(255,255,255,.3)' }}>—</span>}
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {r.allow_deposit && <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 99, background: 'rgba(34,197,94,.15)', color: '#22c55e' }}>DEP</span>}
                        {r.allow_withdraw && <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 99, background: 'rgba(168,85,247,.15)', color: '#a855f7' }}>WD</span>}
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
