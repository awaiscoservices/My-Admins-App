/**
 * components/ForcePasswordChange.js
 *
 * Non-dismissable screen shown when the signed-in staff member is still on the
 * temporary password an admin set (profiles.must_change_password = true). They
 * cannot use the panel until they pick their own password — which the admin
 * never learns. Posts to /api/admin/account/set-password, which changes the
 * password and clears the flag.
 */
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import Icon from './ui/Icon'

export default function ForcePasswordChange({ onDone }) {
  const [pw, setPw]   = useState('')
  const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr]   = useState('')

  async function submit(e) {
    e?.preventDefault?.()
    if (pw.length < 8) { setErr('Use at least 8 characters'); return }
    if (pw !== pw2)    { setErr('The two passwords do not match'); return }
    setBusy(true); setErr('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin/account/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ password: pw }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setErr(j.error || 'Could not set the password'); setBusy(false); return }
      onDone && onDone()
    } catch {
      setErr('Could not set the password'); setBusy(false)
    }
  }

  const input = {
    width: '100%', padding: '12px 14px', fontSize: 15,
    background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.12)',
    borderRadius: 10, color: '#fff', outline: 'none', boxSizing: 'border-box', marginBottom: 12,
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', zIndex: 2100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <form onSubmit={submit} style={{ background: '#0b1626', border: '1px solid rgba(251,191,36,.3)', borderRadius: 18, padding: 28, width: '100%', maxWidth: 420 }}>
        <h2 style={{ fontFamily: "'Cinzel',serif", fontSize: 18, fontWeight: 700, color: '#fff', margin: '0 0 6px' }}>Set a new password</h2>
        <p style={{ fontSize: 12.5, color: '#f59e0b', margin: '0 0 18px', lineHeight: 1.6 }}>
          Your account was created with a temporary password. Choose your own before you continue — no one else will know it.
        </p>
        <input type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="New password" autoComplete="new-password" autoFocus style={input} />
        <input type="password" value={pw2} onChange={e => setPw2(e.target.value)} placeholder="Confirm new password" autoComplete="new-password" style={input} />
        <button type="submit" disabled={busy} style={{ width: '100%', padding: 12, background: 'linear-gradient(135deg,#fbbf24,#f59e0b)', border: 'none', borderRadius: 10, color: '#050505', fontSize: 13, fontWeight: 800, cursor: busy ? 'not-allowed' : 'pointer', marginTop: 2 }}>
          {busy ? 'Saving…' : 'Save & continue'}
        </button>
        {err && <p style={{ color: '#f87171', fontSize: 12.5, marginTop: 14, textAlign: 'center' }}><Icon name="alert" size={14} style={{ verticalAlign: '-2px', marginRight: 4 }} /> {err}</p>}
      </form>
    </div>
  )
}
