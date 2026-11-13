/**
 * components/TwoFactorSetup.js
 *
 * Set up, confirm or remove authenticator-app 2FA for the signed-in account,
 * using Supabase's built-in TOTP. Opened from the account menu, and shown on
 * its own (dismiss hidden) when a casino requires 2FA and the staff member
 * has not set it up.
 *
 * Needs TOTP MFA turned on for the project in the Supabase dashboard
 * (Authentication → Multi-Factor). Without it, enroll() returns an error,
 * which is shown rather than swallowed.
 */
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Icon from './ui/Icon'

export default function TwoFactorSetup({ onClose, onChange, forced = false }) {
  const [factors, setFactors] = useState(null)   // null = loading
  const [enroll, setEnroll]   = useState(null)    // { factorId, qr, secret }
  const [code, setCode]       = useState('')
  const [busy, setBusy]       = useState(false)
  const [err, setErr]         = useState('')

  async function refresh() {
    const { data, error } = await supabase.auth.mfa.listFactors()
    if (error) { setErr(error.message); setFactors([]); return }
    setFactors((data?.totp || []).filter(f => f.status === 'verified'))
  }
  useEffect(() => { refresh() }, [])

  async function startEnroll() {
    setBusy(true); setErr('')
    // A half-finished factor from a previous attempt blocks a new one, so
    // clear any unverified factor first.
    const { data: list } = await supabase.auth.mfa.listFactors()
    for (const f of (list?.all || []).filter(f => f.status !== 'verified')) {
      await supabase.auth.mfa.unenroll({ factorId: f.id })
    }
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `admin-${Date.now()}` })
    setBusy(false)
    if (error) { setErr(error.message); return }
    setEnroll({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret })
  }

  async function confirm() {
    if (code.trim().length < 6) { setErr('Enter the 6-digit code from your app'); return }
    setBusy(true); setErr('')
    const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId: enroll.factorId })
    if (chErr) { setErr(chErr.message); setBusy(false); return }
    const { error } = await supabase.auth.mfa.verify({ factorId: enroll.factorId, challengeId: ch.id, code: code.trim() })
    setBusy(false)
    if (error) { setErr('That code did not match. Try the current one.'); return }
    setEnroll(null); setCode(''); await refresh(); onChange && onChange()
  }

  async function remove(id) {
    if (!window.confirm('Remove two-factor authentication from your account?')) return
    setBusy(true)
    await supabase.auth.mfa.unenroll({ factorId: id })
    setBusy(false); await refresh(); onChange && onChange()
  }

  const hasFactor = factors && factors.length > 0

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.8)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={forced ? undefined : onClose}>
      <div style={{ background: '#0b1626', border: '1px solid rgba(251,191,36,.3)', borderRadius: 18, padding: 28, width: '100%', maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <h2 style={{ fontFamily: "'Cinzel',serif", fontSize: 18, fontWeight: 700, color: '#fff', margin: 0 }}>Two-Factor Authentication</h2>
          {!forced && <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.5)', cursor: 'pointer', display:'inline-flex' }}><Icon name="x" size={18} /></button>}
        </div>

        {forced && !hasFactor && (
          <p style={{ fontSize: 12.5, color: '#f59e0b', margin: '0 0 16px', lineHeight: 1.6 }}>
            This casino requires two-factor authentication. Set it up to continue.
          </p>
        )}

        {factors === null ? (
          <p style={{ color: 'rgba(255,255,255,.4)', fontSize: 13 }}>Loading…</p>
        ) : enroll ? (
          <>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,.55)', lineHeight: 1.6, margin: '0 0 14px' }}>
              Scan this with Google Authenticator, Authy or any authenticator app, then enter the 6-digit code it shows.
            </p>
            <div style={{ background: '#fff', borderRadius: 12, padding: 12, display: 'flex', justifyContent: 'center', marginBottom: 12 }}
              dangerouslySetInnerHTML={{ __html: enroll.qr }} />
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', textAlign: 'center', margin: '0 0 14px', fontFamily: 'monospace', wordBreak: 'break-all' }}>
              Can’t scan? Key: {enroll.secret}
            </p>
            <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric"
              placeholder="123456" style={{ width: '100%', padding: '12px 14px', textAlign: 'center', letterSpacing: 6, fontSize: 20, fontFamily: 'monospace', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 10, color: '#fff', outline: 'none', boxSizing: 'border-box', marginBottom: 14 }} />
            <button onClick={confirm} disabled={busy} style={{ width: '100%', padding: '12px', background: 'linear-gradient(135deg,#fbbf24,#f59e0b)', border: 'none', borderRadius: 10, color: '#050505', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
              {busy ? 'Confirming…' : 'Confirm & turn on'}
            </button>
          </>
        ) : hasFactor ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', background: 'rgba(34,197,94,.1)', border: '1px solid rgba(34,197,94,.25)', borderRadius: 12, marginBottom: 16 }}>
              <span style={{ color: '#22c55e', fontWeight: 800, fontSize: 13 }}><Icon name="check" size={13} stroke={2.6} style={{ verticalAlign: '-2px', marginRight: 5 }} /> Two-factor is on</span>
              <span style={{ color: 'rgba(255,255,255,.4)', fontSize: 12 }}>You’ll enter a code each time you sign in.</span>
            </div>
            {!forced && (
              <button onClick={() => remove(factors[0].id)} disabled={busy} style={{ width: '100%', padding: '11px', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 10, color: '#f87171', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                Turn off 2FA
              </button>
            )}
          </>
        ) : (
          <>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,.55)', lineHeight: 1.6, margin: '0 0 16px' }}>
              Add a second step at sign-in with an authenticator app, so a stolen password is not enough on its own.
            </p>
            <button onClick={startEnroll} disabled={busy} style={{ width: '100%', padding: '12px', background: 'linear-gradient(135deg,#fbbf24,#f59e0b)', border: 'none', borderRadius: 10, color: '#050505', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
              {busy ? 'Starting…' : 'Set up 2FA'}
            </button>
          </>
        )}

        {err && <p style={{ color: '#f87171', fontSize: 12.5, marginTop: 14, textAlign: 'center' }}><Icon name="alert" size={14} style={{ verticalAlign: '-2px', marginRight: 4 }} /> {err}</p>}
      </div>
    </div>
  )
}
