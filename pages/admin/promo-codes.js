/**
 * Admin → Configuration → Promo Codes
 *
 * Code-based promo campaigns, per casino. Two kinds:
 *   • Deposit %  — a bonus % applied to a player's deposit (capped, min deposit)
 *   • Wallet amount — a fixed credit the player claims straight to Bonus balance
 * Both land in the player's Bonus balance.
 */
import { useState, useEffect, useCallback } from 'react'
import Head from 'next/head'
import AdminLayout from '../../components/layout/AdminLayout'
import { supabase } from '../../lib/supabase'

const GOLD = '#fbbf24'
const money = c => (c == null ? '—' : '$' + (c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))

const FIELD = { width: '100%', padding: '10px 12px', borderRadius: 9, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.12)', color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }
const LABEL = { display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'rgba(255,255,255,.45)', marginBottom: 6 }

const toCents = v => (v === '' || v == null ? null : Math.round(parseFloat(v) * 100))
const fromCents = c => (c == null ? '' : (c / 100).toString())

function Modal({ promo, onClose, onSaved }) {
  const editing = !!promo?.id
  const [f, setF] = useState(() => ({
    name: promo?.name || '',
    code: promo?.code || '',
    description: promo?.description || '',
    type: promo?.type || 'deposit',
    bonus_value: promo?.bonus_value ?? '',
    reward: fromCents(promo?.reward_cents),
    max_bonus: fromCents(promo?.max_bonus_cents),
    min_deposit: fromCents(promo?.min_deposit_cents),
    max_uses_per_player: promo?.max_uses_per_player ?? '',
    max_uses_total: promo?.max_uses_total ?? '',
    expires_at: promo?.expires_at ? promo.expires_at.slice(0, 10) : '',
    is_active: promo?.is_active !== false,
  }))
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const set = (k, v) => setF(s => ({ ...s, [k]: v }))

  async function save() {
    setSaving(true); setErr('')
    const { data: { session } } = await supabase.auth.getSession()
    const body = {
      id: promo?.id,
      name: f.name, code: f.code, description: f.description, type: f.type,
      bonus_value: f.type === 'deposit' ? f.bonus_value : null,
      reward_cents: f.type === 'wallet' ? toCents(f.reward) : null,
      max_bonus_cents: f.type === 'deposit' ? toCents(f.max_bonus) : null,
      min_deposit_cents: f.type === 'deposit' ? toCents(f.min_deposit) : null,
      max_uses_per_player: f.max_uses_per_player === '' ? null : Number(f.max_uses_per_player),
      max_uses_total: f.max_uses_total === '' ? null : Number(f.max_uses_total),
      expires_at: f.expires_at ? new Date(f.expires_at + 'T23:59:59').toISOString() : null,
      is_active: f.is_active,
    }
    const res = await fetch('/api/admin/promo-codes/upsert', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify(body),
    })
    const d = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) { setErr(d.error || 'Save failed'); return }
    onSaved()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 2000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 20, overflowY: 'auto' }} onClick={onClose}>
      <div style={{ background: '#0b1626', border: '1px solid rgba(251,191,36,.25)', borderRadius: 16, padding: 26, width: '100%', maxWidth: 520, margin: '40px 0' }} onClick={e => e.stopPropagation()}>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: '#fff', margin: '0 0 18px' }}>{editing ? 'Edit Promo' : 'New Promo'}</h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={LABEL}>Campaign Name</label>
            <input style={FIELD} value={f.name} onChange={e => set('name', e.target.value)} placeholder="Weekend Boost" />
          </div>
          <div>
            <label style={LABEL}>Promo Code</label>
            <input style={{ ...FIELD, textTransform: 'uppercase', fontFamily: 'monospace', letterSpacing: '.08em' }} value={f.code} onChange={e => set('code', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} placeholder="WEEKEND50" maxLength={24} />
          </div>
          <div>
            <label style={LABEL}>Type</label>
            <select style={FIELD} value={f.type} onChange={e => set('type', e.target.value)}>
              <option value="deposit">Deposit %</option>
              <option value="wallet">Wallet amount</option>
            </select>
          </div>

          {f.type === 'deposit' ? (
            <>
              <div>
                <label style={LABEL}>Bonus %</label>
                <input style={FIELD} type="number" value={f.bonus_value} onChange={e => set('bonus_value', e.target.value)} placeholder="50" />
              </div>
              <div>
                <label style={LABEL}>Max Bonus ($)</label>
                <input style={FIELD} type="number" value={f.max_bonus} onChange={e => set('max_bonus', e.target.value)} placeholder="optional" />
              </div>
              <div>
                <label style={LABEL}>Min Deposit ($)</label>
                <input style={FIELD} type="number" value={f.min_deposit} onChange={e => set('min_deposit', e.target.value)} placeholder="optional" />
              </div>
            </>
          ) : (
            <div>
              <label style={LABEL}>Reward Amount ($)</label>
              <input style={FIELD} type="number" value={f.reward} onChange={e => set('reward', e.target.value)} placeholder="10" />
            </div>
          )}

          <div>
            <label style={LABEL}>Max Uses / Player</label>
            <input style={FIELD} type="number" value={f.max_uses_per_player} onChange={e => set('max_uses_per_player', e.target.value)} placeholder="unlimited" />
          </div>
          <div>
            <label style={LABEL}>Max Uses Total</label>
            <input style={FIELD} type="number" value={f.max_uses_total} onChange={e => set('max_uses_total', e.target.value)} placeholder="unlimited" />
          </div>
          <div>
            <label style={LABEL}>Expires</label>
            <input style={FIELD} type="date" value={f.expires_at} onChange={e => set('expires_at', e.target.value)} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={LABEL}>Description (optional)</label>
            <input style={FIELD} value={f.description} onChange={e => set('description', e.target.value)} placeholder="Shown to players" />
          </div>
          <label style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 9, fontSize: 14, color: '#fff', cursor: 'pointer' }}>
            <input type="checkbox" checked={f.is_active} onChange={e => set('is_active', e.target.checked)} /> Active
          </label>
        </div>

        {err && <div style={{ color: '#f87171', fontSize: 13, marginTop: 14 }}>{err}</div>}

        <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 12, borderRadius: 10, border: '1px solid rgba(255,255,255,.14)', background: 'transparent', color: 'rgba(255,255,255,.7)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
          <button onClick={save} disabled={saving} style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: `linear-gradient(135deg,${GOLD},#f59e0b)`, color: '#050505', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>{saving ? 'Saving…' : 'Save Promo'}</button>
        </div>
      </div>
    </div>
  )
}

export default function PromoCodesPage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // null | {} | promo

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/admin/promo-codes/list', { headers: { Authorization: `Bearer ${session.access_token}` } })
    const d = await res.json().catch(() => ({}))
    setRows(res.ok ? (d.rows || []) : [])
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  async function toggle(p) {
    const { data: { session } } = await supabase.auth.getSession()
    await fetch('/api/admin/promo-codes/toggle', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ id: p.id, is_active: !p.is_active }),
    })
    load()
  }

  return (
    <AdminLayout>
      <Head><title>Promo Codes — Admin</title></Head>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', margin: 0 }}>Promo Codes</h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,.4)', margin: '4px 0 0' }}>Deposit % and direct-wallet promo campaigns. All credits go to the player's Bonus balance.</p>
        </div>
        <button onClick={() => setModal({})} style={{ padding: '11px 20px', borderRadius: 10, border: 'none', background: `linear-gradient(135deg,${GOLD},#f59e0b)`, color: '#050505', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>+ New Promo</button>
      </div>

      <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 14, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,.35)' }}>Loading…</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,.35)' }}>No promo codes yet. Create your first campaign.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,.03)' }}>
                  {['Code', 'Name', 'Type', 'Reward', 'Uses', 'Status', ''].map((h, i) => (
                    <th key={i} style={{ textAlign: i > 2 ? 'right' : 'left', padding: '12px 16px', fontSize: 11, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'rgba(255,255,255,.4)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(p => (
                  <tr key={p.id} style={{ borderTop: '1px solid rgba(255,255,255,.05)' }}>
                    <td style={{ padding: '14px 16px', fontFamily: 'monospace', fontWeight: 800, color: GOLD, letterSpacing: '.06em' }}>{p.code}</td>
                    <td style={{ padding: '14px 16px', color: '#fff', fontSize: 14 }}>{p.name}</td>
                    <td style={{ padding: '14px 16px', color: 'rgba(255,255,255,.6)', fontSize: 13 }}>{p.type === 'deposit' ? 'Deposit %' : 'Wallet'}</td>
                    <td style={{ padding: '14px 16px', textAlign: 'right', color: '#fff', fontSize: 14, fontWeight: 700 }}>
                      {p.type === 'deposit' ? `${p.bonus_value}%${p.max_bonus_cents ? ` · max ${money(p.max_bonus_cents)}` : ''}` : money(p.reward_cents)}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right', color: 'rgba(255,255,255,.6)', fontSize: 13 }}>
                      {p.current_uses || 0}{p.max_uses_total ? ` / ${p.max_uses_total}` : ''}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      <button onClick={() => toggle(p)} style={{ cursor: 'pointer', border: 'none', borderRadius: 99, padding: '4px 12px', fontSize: 11, fontWeight: 800, background: p.is_active ? 'rgba(34,197,94,.15)' : 'rgba(255,255,255,.08)', color: p.is_active ? '#22c55e' : 'rgba(255,255,255,.5)' }}>{p.is_active ? 'Active' : 'Off'}</button>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      <button onClick={() => setModal(p)} style={{ cursor: 'pointer', border: '1px solid rgba(255,255,255,.14)', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 700, background: 'transparent', color: 'rgba(255,255,255,.75)' }}>Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && <Modal promo={modal.id ? modal : null} onClose={() => setModal(null)} onSaved={() => { setModal(null); load() }} />}
    </AdminLayout>
  )
}
