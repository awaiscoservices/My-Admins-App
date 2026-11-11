/**
 * components/levels/LevelDrawer.js
 *
 * The one form for editing a player level.
 *
 * It was written inside pages/admin/levels.js, and the Super Admin defaults
 * page had a cut-down copy with five of its fourteen fields — so the levels a
 * new casino started with could not be given redeem rules or withdraw limits
 * at all. Both pages use this now, which is the only way the two stay the
 * same.
 *
 * The caller decides what saving means:
 *   onSave(body) → undefined | { error }   (async)
 * Admin posts it to the API; Super Admin puts it in the defaults list. The
 * body carries only the fields below, so a caller holding a level with other
 * columns on it must merge: { ...original, ...body }.
 */
import { useState } from 'react'

export const c2d  = cents => cents != null ? (cents / 100).toFixed(2) : ''
export const d2c  = str   => str !== '' && str != null ? Math.round(parseFloat(str) * 100) : null
export const fmtD = cents => cents != null ? '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '—'
export const fmtX = v     => v    != null ? v + 'X' : '—'

export function Section({ title, subtitle, color = '#fbbf24', children, mt = 0 }) {
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

export function Row2({ children }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>{children}</div>
}

export function Field({ label, hint, col, children }) {
  return (
    <div style={{ gridColumn: col || 'auto' }}>
      <label style={{ display: 'block', fontSize: 10, fontWeight: 800, letterSpacing: '.09em', textTransform: 'uppercase', color: 'rgba(255,255,255,.4)', marginBottom: 6 }}>{label}</label>
      {children}
      {hint && <p style={{ margin: '5px 0 0', fontSize: 10.5, color: 'rgba(255,255,255,.25)' }}>{hint}</p>}
    </div>
  )
}

export function Toggle({ label, value, onChange }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
      <div onClick={() => onChange(!value)} style={{ width: 36, height: 20, borderRadius: 999, background: value ? '#fbbf24' : 'rgba(255,255,255,.12)', position: 'relative', transition: 'background .2s', cursor: 'pointer', flexShrink: 0 }}>
        <div style={{ position: 'absolute', top: 2, left: value ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: value ? '#050505' : 'rgba(255,255,255,.5)', transition: 'left .2s' }} />
      </div>
      <span style={{ fontSize: 12, color: 'rgba(255,255,255,.55)' }}>{label}</span>
    </label>
  )
}

export default function LevelDrawer({ level, onClose, onSave, subtitle }) {
  const isNew = !level || (!level.id && !level.name)

  const [form, setForm] = useState({
    name:                  level?.name                  || '',
    sort_order:            level?.sort_order            ?? '',
    xp_required:           level?.xp_required           ?? '',
    accent_color:          level?.accent_color          || '#fbbf24',
    badge_icon:            level?.badge_icon            || '',
    description:           level?.description           || '',
    kyc_required:          level?.kyc_required          ?? false,
    is_active:             level?.is_active             ?? true,
    // Redeem
    max_redeem_cap_cents:  c2d(level?.max_redeem_cap_cents),
    min_redeem_multiplier: level?.min_redeem_multiplier ?? '1.00',
    max_redeem_multiplier: level?.max_redeem_multiplier ?? '5.00',
    // Withdraw
    min_withdrawal_cents:  c2d(level?.min_withdrawal_cents),
    max_withdrawal_cents:  c2d(level?.max_withdrawal_cents),
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  async function submit() {
    if (!form.name.trim()) { setErr('Level name is required'); return }
    setSaving(true); setErr('')

    const body = {
      name:                  form.name.trim(),
      sort_order:            form.sort_order  !== '' ? parseInt(form.sort_order, 10)  : 0,
      xp_required:           form.xp_required !== '' ? parseInt(form.xp_required, 10) : 0,
      accent_color:          form.accent_color,
      badge_icon:            form.badge_icon || null,
      description:           form.description || null,
      kyc_required:          form.kyc_required,
      is_active:             form.is_active,
      max_redeem_cap_cents:  d2c(form.max_redeem_cap_cents) ?? 50000,
      min_redeem_multiplier: parseFloat(form.min_redeem_multiplier) || 1,
      max_redeem_multiplier: parseFloat(form.max_redeem_multiplier) || 5,
      min_withdrawal_cents:  d2c(form.min_withdrawal_cents) ?? 0,
      max_withdrawal_cents:  d2c(form.max_withdrawal_cents),
    }

    const result = await onSave(body)
    if (result?.error) { setErr(result.error); setSaving(false); return }
    setSaving(false)
  }

  const inp = { width: '100%', padding: '10px 13px', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 10, color: '#fff', fontSize: 13, fontFamily: "'Outfit',sans-serif", outline: 'none', boxSizing: 'border-box' }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 1100 }} />
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '100%', maxWidth: 480, background: '#0b1626', borderLeft: '1px solid rgba(251,191,36,.2)', zIndex: 1200, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>

        <div style={{ padding: '22px 24px 18px', borderBottom: '1px solid rgba(255,255,255,.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <h2 style={{ fontFamily: "'Cinzel',serif", fontSize: 17, fontWeight: 700, color: '#fff', margin: 0 }}>{isNew ? 'Create Level' : 'Edit Level'}</h2>
            {subtitle
              ? <p style={{ margin: '3px 0 0', fontSize: 12, color: 'rgba(255,255,255,.35)' }}>{subtitle}</p>
              : (level?.id ? <p style={{ margin: '3px 0 0', fontSize: 12, color: 'rgba(255,255,255,.35)' }}>ID: {level.id}</p> : null)}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.4)', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>

        <div style={{ flex: 1, padding: '24px 24px 32px', overflowY: 'auto' }}>

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

          <Section title="Redeem Rules" subtitle="Redeems link to game balance" color="#a78bfa" mt={20}>
            <Row2>
              <Field label="Max Redeem Limit ($)" hint="Hard ceiling per game per day">
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,.4)', fontSize: 13 }}>$</span>
                  <input style={{ ...inp, paddingLeft: 22 }} type="number" min="0" step="0.01" value={form.max_redeem_cap_cents} onChange={e => set('max_redeem_cap_cents', e.target.value)} placeholder="500.00" />
                </div>
              </Field>
              <div />
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
