/**
 * Admin → Player Levels
 *
 * Simplified schema (no bonus fields, no game-load limits):
 *   • Max Redeem Cap ($) — hard ceiling per game per day, overrides multiplier
 *   • Min Redeem Multiplier (X) — lowest multiplier for this tier
 *   • Max Redeem Multiplier (X) — highest multiplier for this tier
 *   • Min Withdraw ($) — minimum withdrawal amount
 *   • Max Withdraw ($) — maximum withdrawal amount (blank = unlimited)
 *
 * "Scores" is the renamed label for game loads throughout this page.
 */
import { useState, useEffect, useCallback } from 'react'
import Head from 'next/head'
import AdminLayout from '../../components/layout/AdminLayout'
import { supabase } from '../../lib/supabase'

// ─── helpers ────────────────────────────────────────────────────────────────
const c2d  = cents => cents != null ? (cents / 100).toFixed(2) : ''
const d2c  = str   => str ? Math.round(parseFloat(str) * 100) : null
const fmtD = cents => cents != null ? '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '—'
const fmtX = v     => v    != null ? v + 'X' : '—'

// ─── Drawer (slide-in form) ──────────────────────────────────────────────────
function LevelDrawer({ level, onClose, onSaved }) {
  const isNew = !level?.id
  const [form, setForm] = useState({
    name:                  level?.name                 || '',
    sort_order:            level?.sort_order           ?? '',
    xp_required:           level?.xp_required          ?? '',
    accent_color:          level?.accent_color         || '#fbbf24',
    badge_icon:            level?.badge_icon           || '',
    description:           level?.description         || '',
    kyc_required:          level?.kyc_required        ?? false,
    is_active:             level?.is_active           ?? true,
    // Redeem
    max_redeem_cap_cents:    c2d(level?.max_redeem_cap_cents),
    min_redeem_multiplier:   level?.min_redeem_multiplier  ?? '1.00',
    max_redeem_multiplier:   level?.max_redeem_multiplier  ?? '5.00',
    // Withdraw
    min_withdrawal_cents:    c2d(level?.min_withdrawal_cents),
    max_withdrawal_cents:    c2d(level?.max_withdrawal_cents),
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  async function submit() {
    if (!form.name.trim()) { setErr('Level name is required'); return }
    setSaving(true); setErr('')
    const { data: { session } } = await supabase.auth.getSession()
    const body = {
      level_id: level?.id || undefined,
      name:               form.name.trim(),
      sort_order:         form.sort_order !== '' ? parseInt(form.sort_order) : 0,
      xp_required:        form.xp_required !== '' ? parseInt(form.xp_required) : 0,
      accent_color:       form.accent_color,
      badge_icon:         form.badge_icon || null,
      description:        form.description || null,
      kyc_required:       form.kyc_required,
      is_active:          form.is_active,
      max_redeem_cap_cents:   d2c(form.max_redeem_cap_cents)   ?? 50000,
      min_redeem_multiplier:  parseFloat(form.min_redeem_multiplier) || 1,
      max_redeem_multiplier:  parseFloat(form.max_redeem_multiplier) || 5,
      min_withdrawal_cents:   d2c(form.min_withdrawal_cents) ?? 0,
      max_withdrawal_cents:   d2c(form.max_withdrawal_cents),
    }
    const res = await fetch('/api/admin/levels/upsert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify(body),
    })
    const d = await res.json()
    if (!res.ok) { setErr(d.error || 'Save failed'); setSaving(false); return }
    onSaved()
  }

  // ── input style ────────────────────────────────────────────────────────────
  const inp = { width: '100%', padding: '10px 13px', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 10, color: '#fff', fontSize: 13, fontFamily: "'Outfit',sans-serif", outline: 'none', boxSizing: 'border-box' }
  const lbl = { display: 'block', fontSize: 10, fontWeight: 800, letterSpacing: '.09em', textTransform: 'uppercase', color: 'rgba(255,255,255,.4)', marginBottom: 6 }

  return (
    <>
      {/* backdrop */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 1100 }} />
      {/* panel */}
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '100%', maxWidth: 480, background: '#0b1626', borderLeft: '1px solid rgba(251,191,36,.2)', zIndex: 1200, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>

        {/* header */}
        <div style={{ padding: '22px 24px 18px', borderBottom: '1px solid rgba(255,255,255,.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <h2 style={{ fontFamily: "'Cinzel',serif", fontSize: 17, fontWeight: 700, color: '#fff', margin: 0 }}>{isNew ? 'Create Level' : 'Edit Level'}</h2>
            {!isNew && <p style={{ margin: '3px 0 0', fontSize: 12, color: 'rgba(255,255,255,.35)' }}>ID: {level.id}</p>}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.4)', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>

        {/* body */}
        <div style={{ flex: 1, padding: '24px 24px 32px', overflowY: 'auto' }}>

          {/* Basic info */}
          <Section title="Basic Info" color={form.accent_color}>
            <Row2>
              <Field label="Level Name" col="1/-1">
                <input style={inp} value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Gold" />
              </Field>
              <Field label="Sort Order">
                <input style={inp} type="number" min="0" value={form.sort_order} onChange={e => set('sort_order', e.target.value)} placeholder="1" />
              </Field>
              <Field label="XP Required">
                <input style={inp} type="number" min="0" value={form.xp_required} onChange={e => set('xp_required', e.target.value)} placeholder="0" />
              </Field>
              <Field label="Accent Color">
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <input type="color" value={form.accent_color} onChange={e => set('accent_color', e.target.value)} style={{ width: 44, height: 40, borderRadius: 8, border: '1px solid rgba(255,255,255,.12)', background: 'none', cursor: 'pointer', padding: 3 }} />
                  <span style={{ fontSize: 12, color: '#fff', fontFamily: 'monospace' }}>{form.accent_color}</span>
                </div>
              </Field>
              <Field label="Badge Icon (emoji/text)">
                <input style={inp} value={form.badge_icon} onChange={e => set('badge_icon', e.target.value)} placeholder="⭐ or 🥇" />
              </Field>
            </Row2>
            <div style={{ marginTop: 14 }}>
              <Field label="Description (optional)">
                <textarea rows={2} style={{ ...inp, resize: 'vertical' }} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Short description of this tier…" />
              </Field>
            </div>
            <div style={{ marginTop: 14, display: 'flex', gap: 24 }}>
              <Toggle label="KYC Required" value={form.kyc_required} onChange={v => set('kyc_required', v)} />
              <Toggle label="Active"       value={form.is_active}    onChange={v => set('is_active', v)} />
            </div>
          </Section>

          {/* Redeem Rules */}
          <Section title="Redeem Rules" subtitle="Redeems link to game balance" color="#a78bfa" mt={20}>
            <Row2>
              <Field label="Max Redeem Cap ($)" hint="Hard ceiling per game per day">
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,.4)', fontSize: 13 }}>$</span>
                  <input style={{ ...inp, paddingLeft: 22 }} type="number" min="0" step="0.01" value={form.max_redeem_cap_cents} onChange={e => set('max_redeem_cap_cents', e.target.value)} placeholder="500.00" />
                </div>
              </Field>
              <div /> {/* spacer */}
              <Field label="Min Redeem Multiplier (X)" hint="Floor multiplier for redeems">
                <div style={{ position: 'relative' }}>
                  <input style={{ ...inp, paddingRight: 24 }} type="number" min="0" step="0.1" value={form.min_redeem_multiplier} onChange={e => set('min_redeem_multiplier', e.target.value)} placeholder="1.0" />
                  <span style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,.35)', fontSize: 11, fontWeight: 700 }}>X</span>
                </div>
              </Field>
              <Field label="Max Redeem Multiplier (X)" hint="Ceiling multiplier for redeems">
                <div style={{ position: 'relative' }}>
                  <input style={{ ...inp, paddingRight: 24 }} type="number" min="0" step="0.1" value={form.max_redeem_multiplier} onChange={e => set('max_redeem_multiplier', e.target.value)} placeholder="5.0" />
                  <span style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,.35)', fontSize: 11, fontWeight: 700 }}>X</span>
                </div>
              </Field>
            </Row2>
            <div style={{ marginTop: 10, padding: '10px 12px', background: 'rgba(167,139,250,.07)', border: '1px solid rgba(167,139,250,.18)', borderRadius: 10, fontSize: 11.5, color: 'rgba(255,255,255,.45)', lineHeight: 1.6 }}>
              Example: Score $100 at 5X → Redeem $500. If Cap is $300 → player only receives $300 (remaining $200 consumed).
            </div>
          </Section>

          {/* Withdraw Rules */}
          <Section title="Withdraw Limits" subtitle="Withdrawals link to wallet balance" color="#34d399" mt={20}>
            <Row2>
              <Field label="Min Withdraw ($)">
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,.4)', fontSize: 13 }}>$</span>
                  <input style={{ ...inp, paddingLeft: 22 }} type="number" min="0" step="0.01" value={form.min_withdrawal_cents} onChange={e => set('min_withdrawal_cents', e.target.value)} placeholder="10.00" />
                </div>
              </Field>
              <Field label="Max Withdraw ($)" hint="Leave blank for unlimited">
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,.4)', fontSize: 13 }}>$</span>
                  <input style={{ ...inp, paddingLeft: 22 }} type="number" min="0" step="0.01" value={form.max_withdrawal_cents} onChange={e => set('max_withdrawal_cents', e.target.value)} placeholder="Unlimited" />
                </div>
              </Field>
            </Row2>
          </Section>

          {err && <div style={{ marginTop: 16, padding: '10px 14px', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 10, color: '#f87171', fontSize: 13 }}>⚠ {err}</div>}
        </div>

        {/* footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,.07)', display: 'flex', gap: 10, flexShrink: 0, background: '#0b1626' }}>
          <button onClick={submit} disabled={saving} style={{ flex: 1, padding: '12px', background: 'linear-gradient(135deg,#fbbf24,#f59e0b)', border: 'none', borderRadius: 10, color: '#050505', fontSize: 13, fontWeight: 800, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: "'Outfit',sans-serif", opacity: saving ? .7 : 1 }}>
            {saving ? 'Saving…' : isNew ? 'Create Level' : 'Save Changes'}
          </button>
          <button onClick={onClose} style={{ padding: '12px 18px', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, color: 'rgba(255,255,255,.4)', fontSize: 13, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>Cancel</button>
        </div>
      </div>
    </>
  )
}

// ─── tiny layout helpers ─────────────────────────────────────────────────────
function Section({ title, subtitle, color = '#fbbf24', children, mt = 0 }) {
  return (
    <div style={{ marginTop: mt }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 14 }}>
        <span style={{ width: 3, height: 14, background: color, borderRadius: 2, flexShrink: 0, display: 'inline-block' }} />
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color }}>{title}</span>
        {subtitle && <span style={{ fontSize: 11, color: 'rgba(255,255,255,.3)' }}>— {subtitle}</span>}
      </div>
      {children}
    </div>
  )
}
function Row2({ children }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>{children}</div>
}
function Field({ label, hint, col, children }) {
  return (
    <div style={{ gridColumn: col || 'auto' }}>
      <label style={{ display: 'block', fontSize: 10, fontWeight: 800, letterSpacing: '.09em', textTransform: 'uppercase', color: 'rgba(255,255,255,.4)', marginBottom: 6 }}>{label}</label>
      {children}
      {hint && <p style={{ margin: '5px 0 0', fontSize: 10.5, color: 'rgba(255,255,255,.25)' }}>{hint}</p>}
    </div>
  )
}
function Toggle({ label, value, onChange }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
      <div onClick={() => onChange(!value)} style={{ width: 36, height: 20, borderRadius: 999, background: value ? '#fbbf24' : 'rgba(255,255,255,.12)', position: 'relative', transition: 'background .2s', cursor: 'pointer', flexShrink: 0 }}>
        <div style={{ position: 'absolute', top: 2, left: value ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: value ? '#050505' : 'rgba(255,255,255,.5)', transition: 'left .2s' }} />
      </div>
      <span style={{ fontSize: 12, color: 'rgba(255,255,255,.55)' }}>{label}</span>
    </label>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────
export default function AdminLevels() {
  const [levels, setLevels]   = useState([])
  const [loading, setLoading] = useState(true)
  const [drawer, setDrawer]   = useState(null)   // null = closed, false = new, object = edit
  const [toast, setToast]     = useState(null)
  const [search, setSearch]   = useState('')

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 4000)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const r = await fetch('/api/admin/levels/list', { headers: { Authorization: `Bearer ${session.access_token}` } })
      const d = await r.json()
      setLevels(d.levels || [])
    } catch { setLevels([]) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function handleSaved() {
    setDrawer(null)
    showToast(drawer ? 'Level updated' : 'Level created')
    load()
  }

  const filtered = levels.filter(l => !search || l.name?.toLowerCase().includes(search.toLowerCase()))

  const TH = ({ children }) => (
    <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.3)', whiteSpace: 'nowrap' }}>{children}</th>
  )

  return (
    <AdminLayout>
      <Head><title>Player Levels — Admin</title></Head>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, background: toast.type === 'error' ? 'rgba(239,68,68,.95)' : 'rgba(34,197,94,.95)', borderRadius: 12, padding: '12px 24px', color: '#fff', fontSize: 14, fontWeight: 600, fontFamily: "'Outfit',sans-serif", whiteSpace: 'nowrap', boxShadow: '0 8px 32px rgba(0,0,0,.5)', pointerEvents: 'none' }}>
          {toast.msg}
        </div>
      )}

      {/* Drawer */}
      {drawer !== null && (
        <LevelDrawer
          level={drawer || null}
          onClose={() => setDrawer(null)}
          onSaved={handleSaved}
        />
      )}

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: "'Cinzel',serif", fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 4 }}>Player Levels</h1>
          <p style={{ color: 'rgba(255,255,255,.35)', fontSize: 13 }}>Configure tier redeem caps, multipliers & withdrawal limits</p>
        </div>
        <button onClick={() => setDrawer(false)} style={{ padding: '10px 20px', background: 'linear-gradient(135deg,#fbbf24,#f59e0b)', border: 'none', borderRadius: 10, color: '#050505', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>
          + Create Level
        </button>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 18 }}>
        <input
          type="text"
          placeholder="Search levels…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ padding: '9px 14px', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, color: '#fff', fontSize: 13, fontFamily: "'Outfit',sans-serif", outline: 'none', minWidth: 220 }}
        />
      </div>

      {/* Legend pills */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { dot: '#a78bfa', label: 'Redeem Cap & Multipliers — link to game balance' },
          { dot: '#34d399', label: 'Withdraw Limits — link to wallet balance' },
        ].map(({ dot, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'rgba(255,255,255,.4)' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: dot, flexShrink: 0 }} />
            {label}
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,.04)' }}>
                <TH>#</TH>
                <TH>Level</TH>
                <TH>XP Req.</TH>
                <TH>Max Redeem Cap</TH>
                <TH>Min Mult.</TH>
                <TH>Max Mult.</TH>
                <TH>Min Withdraw</TH>
                <TH>Max Withdraw</TH>
                <TH>Status</TH>
                <TH>Actions</TH>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} style={{ padding: 48, textAlign: 'center', color: 'rgba(255,255,255,.25)', fontSize: 14 }}>Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={10} style={{ padding: 48, textAlign: 'center', color: 'rgba(255,255,255,.25)', fontSize: 14 }}>No levels found</td></tr>
              ) : filtered.map(r => (
                <tr
                  key={r.id}
                  style={{ borderTop: '1px solid rgba(255,255,255,.04)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.025)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  {/* Sort order */}
                  <td style={{ padding: '13px 14px', fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,.3)' }}>
                    {r.sort_order ?? '—'}
                  </td>

                  {/* Level name + badge */}
                  <td style={{ padding: '13px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: r.accent_color || '#fbbf24', flexShrink: 0, boxShadow: `0 0 6px ${r.accent_color || '#fbbf24'}88` }} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 5 }}>
                          {r.badge_icon && <span>{r.badge_icon}</span>}
                          {r.name}
                        </div>
                        {r.description && <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', marginTop: 1 }}>{r.description}</div>}
                      </div>
                    </div>
                  </td>

                  {/* XP */}
                  <td style={{ padding: '13px 14px', fontSize: 12, color: 'rgba(255,255,255,.5)' }}>
                    {r.xp_required ? r.xp_required.toLocaleString() : '—'}
                  </td>

                  {/* Redeem Cap */}
                  <td style={{ padding: '13px 14px', fontSize: 12, fontWeight: 700, color: '#a78bfa' }}>
                    {fmtD(r.max_redeem_cap_cents)}
                  </td>

                  {/* Min Multiplier */}
                  <td style={{ padding: '13px 14px' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#c4b5fd', background: 'rgba(167,139,250,.12)', border: '1px solid rgba(167,139,250,.25)', borderRadius: 6, padding: '3px 8px' }}>
                      {fmtX(r.min_redeem_multiplier)}
                    </span>
                  </td>

                  {/* Max Multiplier */}
                  <td style={{ padding: '13px 14px' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#a78bfa', background: 'rgba(167,139,250,.15)', border: '1px solid rgba(167,139,250,.3)', borderRadius: 6, padding: '3px 8px' }}>
                      {fmtX(r.max_redeem_multiplier)}
                    </span>
                  </td>

                  {/* Min Withdraw */}
                  <td style={{ padding: '13px 14px', fontSize: 12, fontWeight: 600, color: '#34d399' }}>
                    {r.min_withdrawal_cents ? fmtD(r.min_withdrawal_cents) : '—'}
                  </td>

                  {/* Max Withdraw */}
                  <td style={{ padding: '13px 14px', fontSize: 12, color: '#34d399' }}>
                    {r.max_withdrawal_cents ? fmtD(r.max_withdrawal_cents) : <span style={{ color: 'rgba(255,255,255,.25)', fontStyle: 'italic' }}>Unlimited</span>}
                  </td>

                  {/* Status */}
                  <td style={{ padding: '13px 14px' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      fontSize: 10, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase',
                      padding: '3px 10px', borderRadius: 20,
                      background: r.is_active ? 'rgba(34,197,94,.12)' : 'rgba(255,255,255,.06)',
                      color:      r.is_active ? '#4ade80'              : 'rgba(255,255,255,.3)',
                      border:     `1px solid ${r.is_active ? 'rgba(34,197,94,.25)' : 'rgba(255,255,255,.1)'}`,
                    }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }} />
                      {r.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>

                  {/* Actions */}
                  <td style={{ padding: '13px 14px' }}>
                    <button
                      onClick={() => setDrawer(r)}
                      style={{ padding: '6px 14px', background: 'rgba(251,191,36,.12)', border: '1px solid rgba(251,191,36,.25)', borderRadius: 8, color: '#fbbf24', fontSize: 11, fontWeight: 800, cursor: 'pointer', fontFamily: "'Outfit',sans-serif', letterSpacing: '.03em" }}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* note: Scores renamed from Game Load */}
      <p style={{ marginTop: 14, fontSize: 11, color: 'rgba(255,255,255,.2)', fontStyle: 'italic' }}>
        Scores (formerly Game Load) have no load limits — amount is capped only by wallet balance. Redeem and Withdraw rules above apply per tier.
      </p>
    </AdminLayout>
  )
}
