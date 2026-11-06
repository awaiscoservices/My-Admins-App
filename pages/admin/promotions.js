import { useState, useEffect, useCallback } from 'react'
import AdminLayout from '../../components/layout/AdminLayout'
import { supabase } from '../../lib/supabase'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const gold = '#fbbf24'
const dim = 'rgba(255,255,255,.45)'
const panelBg = 'rgba(255,255,255,.03)'
const border = '1px solid rgba(255,255,255,.08)'

function fmt(cents) {
  if (cents == null) return '—'
  return '$' + (cents / 100).toFixed(2)
}

function pct(v) {
  if (v == null) return '—'
  return parseFloat(v).toFixed(2) + '%'
}

const emptyForm = {
  name: '', payment_method_id: '', player_level_id: '',
  day_number: 1, min_deposit_cents: '', max_deposit_cents: '',
  bonus_percent: '', bonus_to_cash_percent: '', is_active: true,
}

export default function PlayerBonuses() {
  const [tab, setTab] = useState('deposit')
  const [bonuses, setBonuses] = useState([])
  const [referralTiers, setReferralTiers] = useState([])
  const [paymentMethods, setPaymentMethods] = useState([])
  const [levels, setLevels] = useState([])
  const [loading, setLoading] = useState(true)
  const [drawer, setDrawer] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)
  const [referralForm, setReferralForm] = useState({})
  const [savingReferral, setSavingReferral] = useState(null)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const r = await fetch('/api/admin/bonuses/list', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    const d = await r.json()
    if (!r.ok) { showToast(d.error || 'Load failed', 'error'); setLoading(false); return }
    setBonuses(d.bonuses || [])
    setReferralTiers(d.referralTiers || [])
    setPaymentMethods(d.paymentMethods || [])
    setLevels(d.levels || [])
    const rf = {}
    for (const t of (d.referralTiers || [])) rf[t.deposit_number] = t
    setReferralForm(rf)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const openCreate = () => { setEditing(null); setForm(emptyForm); setDrawer(true) }
  const openEdit = (b) => {
    setEditing(b.id)
    setForm({
      name: b.name,
      payment_method_id: b.payment_method_id || '',
      player_level_id: b.player_level_id || '',
      day_number: b.day_number,
      min_deposit_cents: b.min_deposit_cents != null ? b.min_deposit_cents / 100 : '',
      max_deposit_cents: b.max_deposit_cents != null ? b.max_deposit_cents / 100 : '',
      bonus_percent: b.bonus_percent,
      bonus_to_cash_percent: b.bonus_to_cash_percent,
      is_active: b.is_active,
    })
    setDrawer(true)
  }
  const closeDrawer = () => { setDrawer(false); setEditing(null); setForm(emptyForm) }

  const handleSave = async () => {
    if (!form.name || !form.day_number) return showToast('Name and day are required', 'error')
    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    const payload = {
      ...(editing ? { id: editing } : {}),
      name: form.name,
      payment_method_id: form.payment_method_id || null,
      player_level_id: form.player_level_id ? parseInt(form.player_level_id) : null,
      day_number: parseInt(form.day_number),
      min_deposit_cents: form.min_deposit_cents !== '' ? Math.round(parseFloat(form.min_deposit_cents) * 100) : 0,
      max_deposit_cents: form.max_deposit_cents !== '' ? Math.round(parseFloat(form.max_deposit_cents) * 100) : null,
      bonus_percent: parseFloat(form.bonus_percent) || 0,
      bonus_to_cash_percent: parseFloat(form.bonus_to_cash_percent) || 0,
      is_active: form.is_active,
    }
    const r = await fetch('/api/admin/bonuses/upsert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify(payload),
    })
    const d = await r.json()
    setSaving(false)
    if (!r.ok) return showToast(d.error || 'Save failed', 'error')
    showToast(editing ? 'Bonus tier updated' : 'Bonus tier created')
    closeDrawer()
    load()
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this bonus tier?')) return
    const { data: { session } } = await supabase.auth.getSession()
    const r = await fetch('/api/admin/bonuses/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ id }),
    })
    const d = await r.json()
    if (!r.ok) return showToast(d.error || 'Delete failed', 'error')
    showToast('Deleted')
    load()
  }

  const handleReferralSave = async (depositNumber) => {
    setSavingReferral(depositNumber)
    const { data: { session } } = await supabase.auth.getSession()
    const tier = referralForm[depositNumber] || {}
    const r = await fetch('/api/admin/bonuses/referral-upsert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({
        deposit_number: depositNumber,
        bonus_percent: parseFloat(tier.bonus_percent) || 0,
        is_active: tier.is_active ?? true,
      }),
    })
    const d = await r.json()
    setSavingReferral(null)
    if (!r.ok) return showToast(d.error || 'Save failed', 'error')
    showToast(`Referral deposit ${depositNumber} saved`)
    load()
  }

  const field = (k, label, type = 'text', opts = {}) => (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: dim, marginBottom: 5 }}>{label}</div>
      <input
        type={type}
        value={form[k]}
        onChange={e => setForm(f => ({ ...f, [k]: type === 'checkbox' ? e.target.checked : e.target.value }))}
        style={{ width: '100%', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 8, padding: '9px 12px', color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
        {...opts}
      />
    </div>
  )

  const select = (k, label, options) => (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: dim, marginBottom: 5 }}>{label}</div>
      <select
        value={form[k]}
        onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
        style={{ width: '100%', background: '#1e293b', border: '1px solid rgba(255,255,255,.12)', borderRadius: 8, padding: '9px 12px', color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
      >
        <option value="">— Any —</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )

  return (
    <AdminLayout>
      <div style={{ padding: '28px 24px', maxWidth: 1100, margin: '0 auto' }}>

        {/* Toast */}
        {toast && (
          <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, padding: '12px 20px', borderRadius: 10, background: toast.type === 'error' ? '#dc2626' : '#10b981', color: '#fff', fontWeight: 700, fontSize: 14, boxShadow: '0 4px 20px rgba(0,0,0,.4)' }}>
            {toast.msg}
          </div>
        )}

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: 22, fontWeight: 700, color: gold, margin: 0 }}>Player Bonuses</h1>
            <p style={{ color: dim, fontSize: 13, margin: '4px 0 0' }}>Manage deposit bonus tiers and referral rewards</p>
          </div>
          {tab === 'deposit' && (
            <button onClick={openCreate} style={{ background: gold, color: '#0f172a', border: 'none', borderRadius: 8, padding: '10px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              + Add Bonus Tier
            </button>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid rgba(255,255,255,.08)', marginBottom: 24 }}>
          {[{ key: 'deposit', label: 'Deposit Bonuses' }, { key: 'referral', label: 'Referral Bonuses' }].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{ padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: tab === t.key ? gold : dim, borderBottom: tab === t.key ? `2px solid ${gold}` : '2px solid transparent', marginBottom: -1 }}>
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ color: dim, padding: 40, textAlign: 'center' }}>Loading...</div>
        ) : tab === 'deposit' ? (
          /* ── DEPOSIT BONUSES TAB ── */
          bonuses.length === 0 ? (
            <div style={{ textAlign: 'center', color: dim, padding: 60 }}>No bonus tiers yet. Click "+ Add Bonus Tier" to create one.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,.08)' }}>
                    {['Name', 'Day', 'Level', 'Payment Method', 'Min Deposit', 'Max Deposit', 'Bonus %', 'Cash Conv. %', 'Status', ''].map(h => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: dim, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bonuses.map(b => (
                    <tr key={b.id} style={{ borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                      <td style={{ padding: '12px', color: '#fff', fontWeight: 600 }}>{b.name}</td>
                      <td style={{ padding: '12px', color: gold }}>{DAYS[(b.day_number - 1)]}</td>
                      <td style={{ padding: '12px', color: dim }}>{b.player_levels?.name || '—'}</td>
                      <td style={{ padding: '12px', color: dim }}>{b.payment_methods?.name || '—'}</td>
                      <td style={{ padding: '12px', color: dim }}>{fmt(b.min_deposit_cents)}</td>
                      <td style={{ padding: '12px', color: dim }}>{fmt(b.max_deposit_cents)}</td>
                      <td style={{ padding: '12px', color: '#10b981', fontWeight: 700 }}>{pct(b.bonus_percent)}</td>
                      <td style={{ padding: '12px', color: '#60a5fa', fontWeight: 700 }}>{pct(b.bonus_to_cash_percent)}</td>
                      <td style={{ padding: '12px' }}>
                        <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: b.is_active ? 'rgba(16,185,129,.15)' : 'rgba(100,116,139,.15)', color: b.is_active ? '#10b981' : '#94a3b8' }}>
                          {b.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ padding: '12px', whiteSpace: 'nowrap' }}>
                        <button onClick={() => openEdit(b)} style={{ background: 'rgba(251,191,36,.1)', color: gold, border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', marginRight: 6 }}>Edit</button>
                        <button onClick={() => handleDelete(b.id)} style={{ background: 'rgba(239,68,68,.1)', color: '#f87171', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          /* ── REFERRAL BONUSES TAB ── */
          <div style={{ maxWidth: 500 }}>
            <p style={{ color: dim, fontSize: 13, marginBottom: 20 }}>
              Set the bonus % a referrer receives on their referee's first 3 deposits.
            </p>
            {[1, 2, 3].map(n => {
              const tier = referralForm[n] || {}
              return (
                <div key={n} style={{ background: panelBg, border, borderRadius: 12, padding: '20px', marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <div style={{ fontWeight: 700, color: '#fff', fontSize: 14 }}>Deposit #{n}</div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: dim, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={tier.is_active ?? true}
                        onChange={e => setReferralForm(f => ({ ...f, [n]: { ...f[n], is_active: e.target.checked } }))}
                      />
                      Active
                    </label>
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: dim, marginBottom: 5 }}>Bonus %</div>
                      <input
                        type="number" min="0" max="100" step="0.01"
                        value={tier.bonus_percent ?? 0}
                        onChange={e => setReferralForm(f => ({ ...f, [n]: { ...f[n], bonus_percent: e.target.value } }))}
                        style={{ width: '100%', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 8, padding: '9px 12px', color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>
                    <button
                      onClick={() => handleReferralSave(n)}
                      disabled={savingReferral === n}
                      style={{ background: gold, color: '#0f172a', border: 'none', borderRadius: 8, padding: '10px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >
                      {savingReferral === n ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── SLIDE-IN DRAWER ── */}
      {drawer && (
        <>
          <div onClick={closeDrawer} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 100 }} />
          <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 420, background: '#0f172a', borderLeft: '1px solid rgba(255,255,255,.1)', zIndex: 101, overflowY: 'auto', padding: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontFamily: 'Cinzel, serif', color: gold, fontSize: 18, margin: 0 }}>{editing ? 'Edit Bonus Tier' : 'New Bonus Tier'}</h2>
              <button onClick={closeDrawer} style={{ background: 'none', border: 'none', color: dim, fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>

            {field('name', 'Name')}

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: dim, marginBottom: 5 }}>Day of Week</div>
              <select value={form.day_number} onChange={e => setForm(f => ({ ...f, day_number: e.target.value }))}
                style={{ width: '100%', background: '#1e293b', border: '1px solid rgba(255,255,255,.12)', borderRadius: 8, padding: '9px 12px', color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}>
                {DAYS.map((d, i) => <option key={i + 1} value={i + 1}>{d}</option>)}
              </select>
            </div>

            {select('player_level_id', 'Player Level (optional)', levels.map(l => ({ value: l.id, label: l.name })))}
            {select('payment_method_id', 'Payment Method (optional)', paymentMethods.map(m => ({ value: m.id, label: m.name })))}

            {field('min_deposit_cents', 'Min Deposit ($)', 'number', { min: 0, step: '0.01', placeholder: '0.00' })}
            {field('max_deposit_cents', 'Max Deposit ($) — leave blank for no limit', 'number', { min: 0, step: '0.01', placeholder: 'No limit' })}
            {field('bonus_percent', 'Bonus % (of deposit)', 'number', { min: 0, max: 100, step: '0.01', placeholder: '0.00' })}
            {field('bonus_to_cash_percent', 'Bonus → Cash Conversion % (auto on withdraw)', 'number', { min: 0, max: 100, step: '0.01', placeholder: '0.00' })}

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <input type="checkbox" id="is_active" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
              <label htmlFor="is_active" style={{ color: dim, fontSize: 13, cursor: 'pointer' }}>Active</label>
            </div>

            <button onClick={handleSave} disabled={saving}
              style={{ width: '100%', background: gold, color: '#0f172a', border: 'none', borderRadius: 10, padding: '13px', fontWeight: 800, fontSize: 15, cursor: 'pointer' }}>
              {saving ? 'Saving...' : editing ? 'Update Tier' : 'Create Tier'}
            </button>
          </div>
        </>
      )}
    </AdminLayout>
  )
}
