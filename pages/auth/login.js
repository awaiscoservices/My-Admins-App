// Casinoze Support — Staff Login
// Domain: casinozoesupport.com
// This page is ONLY for Super Admin, Admin, and staff roles.
// Players are directed to their own tenant site (e.g. casinozeroom.com).

import { useState, useEffect } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { signInWithEmail } from '../../lib/auth'
import Icon from '../../components/ui/Icon'

const STAFF_ROLES = ['super_admin', 'admin', 'finance', 'game_ops', 'support', 'kyc_agent', 'risk', 'reporting', 'marketing']

export default function SupportLogin() {
  const router = useRouter()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors]     = useState({})
  const [loading, setLoading]   = useState(false)
  const [toast, setToast]       = useState(null)
  const [focused, setFocused]   = useState(null)
  const [mounted, setMounted]   = useState(false)
  const [mfa, setMfa]           = useState(null)   // { factorId } when a code is needed
  const [mfaCode, setMfaCode]   = useState('')

  useEffect(() => { setMounted(true) }, [])

  const showToast = (msg, type = 'error') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4500)
  }

  const validate = () => {
    const e = {}
    if (!email.trim()) e.email = 'Username or email is required'
    // Only check the shape when it looks like an address; a bare username
    // is resolved server-side instead.
    else if (email.includes('@') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Enter a valid email'
    if (!password) e.password = 'Password is required'
    return e
  }

  // After a full sign-in, send staff to their portal and everyone else away.
  async function routeByRole(sb) {
    const { data: { user } } = await sb.auth.getUser()
    const { data: prof } = await sb.from('profiles').select('role').eq('id', user.id).single()
    if (prof?.role && STAFF_ROLES.includes(prof.role)) {
      router.push(prof.role === 'super_admin' ? '/superadmin' : '/admin')
    } else {
      await sb.auth.signOut()
      showToast('Access denied. This portal is for staff only.')
    }
  }

  async function verifyMfa(ev) {
    ev.preventDefault()
    if (mfaCode.trim().length < 6) { showToast('Enter the 6-digit code from your app'); return }
    setLoading(true)
    try {
      const { supabase: sb } = await import('../../lib/supabase')
      const { data: ch, error: chErr } = await sb.auth.mfa.challenge({ factorId: mfa.factorId })
      if (chErr) throw chErr
      const { error } = await sb.auth.mfa.verify({ factorId: mfa.factorId, challengeId: ch.id, code: mfaCode.trim() })
      if (error) { showToast('That code did not match. Try the current one.'); setLoading(false); return }
      setMfa(null); setMfaCode('')
      await routeByRole(sb)
    } catch (err) {
      showToast(err.message || 'Could not verify the code')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (ev) => {
    ev.preventDefault()
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    setErrors({})
    setLoading(true)
    try {
      // A bare username is turned into the address behind it first; anything
      // with an @ is treated as the address itself.
      let loginEmail = email.trim()
      if (!loginEmail.includes('@')) {
        const r = await fetch('/api/auth/resolve-username', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: loginEmail }),
        })
        const j = await r.json()
        if (!r.ok) { showToast(j.error || 'Invalid username or password'); return }
        loginEmail = j.email
      }

      await signInWithEmail({ email: loginEmail, password })
      const { supabase: sb } = await import('../../lib/supabase')

      // Second step for anyone who has set up 2FA. Supabase signs the
      // password in at aal1; a verified factor raises the required level to
      // aal2, which a code from their app satisfies.
      const { data: aal } = await sb.auth.mfa.getAuthenticatorAssuranceLevel()
      if (aal?.currentLevel === 'aal1' && aal?.nextLevel === 'aal2') {
        const { data: fl } = await sb.auth.mfa.listFactors()
        const factor = (fl?.totp || [])[0]
        if (factor) { setMfa({ factorId: factor.id }); setLoading(false); return }
      }

      await routeByRole(sb)
    } catch (err) {
      showToast(err.message || 'Invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  const inp = (field) => ({
    width: '100%', padding: '13px 16px',
    background: 'rgba(255,255,255,.04)',
    border: `1.5px solid ${focused === field
      ? errors[field] ? '#ef4444' : '#fbbf24'
      : errors[field] ? 'rgba(239,68,68,.5)' : 'rgba(251,191,36,.18)'}`,
    borderRadius: 10, color: '#fff', fontSize: 14,
    fontFamily: "'Outfit', sans-serif", outline: 'none',
    boxSizing: 'border-box', transition: 'border-color .2s, box-shadow .2s',
    boxShadow: focused === field ? '0 0 0 3px rgba(251,191,36,.12)' : 'none',
    caretColor: '#fbbf24',
  })

  return (
    <>
      <Head>
        <title>Casinoze Support — Staff Login</title>
        <meta name="robots" content="noindex,nofollow" />
        <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&family=Outfit:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
        <style>{`
          *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
          body{background:#060b18;min-height:100vh;overflow-x:hidden}
          input:-webkit-autofill,input:-webkit-autofill:hover,input:-webkit-autofill:focus{
            -webkit-box-shadow:0 0 0 1000px #0a1020 inset!important;
            -webkit-text-fill-color:#fff!important;caret-color:#fbbf24!important}
          @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
          @keyframes spin{to{transform:rotate(360deg)}}
          @keyframes toastIn{from{opacity:0;transform:translateY(-12px)}to{opacity:1;transform:translateY(0)}}
          @keyframes gridPulse{0%,100%{opacity:.18}50%{opacity:.28}}
        `}</style>
      </Head>

      {/* Background grid */}
      <div style={{ position: 'fixed', inset: 0, backgroundImage: 'linear-gradient(rgba(251,191,36,.07) 1px,transparent 1px),linear-gradient(90deg,rgba(251,191,36,.07) 1px,transparent 1px)', backgroundSize: '48px 48px', animation: 'gridPulse 6s ease-in-out infinite', pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', inset: 0, background: 'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(251,191,36,.08) 0%, transparent 70%)', pointerEvents: 'none' }} />

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, animation: 'toastIn .3s ease', background: toast.type === 'error' ? 'rgba(239,68,68,.95)' : 'rgba(16,185,129,.95)', border: `1px solid ${toast.type === 'error' ? '#ef4444' : '#10b981'}`, borderRadius: 10, padding: '11px 22px', color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: "'Outfit',sans-serif", backdropFilter: 'blur(12px)', boxShadow: '0 8px 32px rgba(0,0,0,.5)', whiteSpace: 'nowrap' }}>
          <span style={{ display:'inline-flex', alignItems:'center', gap:8 }}><Icon name={toast.type === 'error' ? 'alert' : 'check'} size={16} stroke={2.4} /> {toast.msg}</span>
        </div>
      )}

      <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 16px', fontFamily: "'Outfit', sans-serif" }}>

        {/* Brand header */}
        <div style={{ textAlign: 'center', marginBottom: 40, animation: 'fadeUp .5s ease both' }}>
          {/* Logo mark */}
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56, borderRadius: 14, background: 'linear-gradient(135deg,#fbbf24,#f59e0b)', marginBottom: 16, boxShadow: '0 0 32px rgba(251,191,36,.4)' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#050505" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3zM9 12l2 2 4-4" />
            </svg>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: .5 }}>Casinoze <span style={{ color: '#fbbf24' }}>Support</span></div>
          <div style={{ fontSize: 11, color: 'rgba(251,191,36,.6)', letterSpacing: 3, textTransform: 'uppercase', marginTop: 4 }}>Management Portal</div>
        </div>

        {/* Card */}
        <div style={{ width: '100%', maxWidth: 420, background: 'rgba(255,255,255,.025)', border: '1px solid rgba(251,191,36,.18)', borderRadius: 18, padding: 'clamp(28px,5vw,42px)', backdropFilter: 'blur(20px)', animation: 'fadeUp .5s ease .1s both', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: '15%', right: '15%', height: 1, background: 'linear-gradient(90deg,transparent,#fbbf24,transparent)' }} />

          <h2 style={{ fontFamily: "'Cinzel',serif", fontSize: 18, fontWeight: 700, color: '#fff', textAlign: 'center', marginBottom: 6 }}>Staff Sign In</h2>
          <p style={{ color: 'rgba(255,255,255,.35)', fontSize: 12, textAlign: 'center', marginBottom: 28 }}>Authorised personnel only</p>
          {router.query.reason === 'timeout' && (
            <p style={{ color: '#f59e0b', fontSize: 12, textAlign: 'center', marginBottom: 20, padding: '10px 14px', background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.25)', borderRadius: 10 }}>
              You were signed out after a period of inactivity. Please sign in again.
            </p>
          )}

          {mfa ? (
            <form onSubmit={verifyMfa} noValidate>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,.55)', textAlign: 'center', lineHeight: 1.6, marginBottom: 18 }}>
                Enter the 6-digit code from your authenticator app.
              </p>
              <input value={mfaCode} onChange={e => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoFocus
                placeholder="123456" style={{ width: '100%', padding: '14px', textAlign: 'center', letterSpacing: 8, fontSize: 22, fontFamily: 'monospace', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 10, color: '#fff', outline: 'none', boxSizing: 'border-box', marginBottom: 18 }} />
              <button type="submit" disabled={loading} style={{ width: '100%', padding: 14, background: loading ? 'rgba(245,158,11,.35)' : 'linear-gradient(135deg,#f59e0b,#fbbf24)', border: 'none', borderRadius: 10, color: '#050505', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>
                {loading ? 'Verifying…' : 'Verify & continue'}
              </button>
              <button type="button" onClick={() => { setMfa(null); setMfaCode('') }} style={{ width: '100%', marginTop: 10, padding: 10, background: 'none', border: 'none', color: 'rgba(255,255,255,.4)', fontSize: 12, cursor: 'pointer' }}>
                Back
              </button>
            </form>
          ) : (
          <form onSubmit={handleSubmit} noValidate>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 7, fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,.55)', letterSpacing: .5 }}>Username or Email</label>
              <input type="text" value={email} onChange={e => { setEmail(e.target.value); if (errors.email) setErrors(p => ({ ...p, email: '' })) }} onFocus={() => setFocused('email')} onBlur={() => setFocused(null)} placeholder="username or email" style={inp('email')} autoComplete="username" />
              {errors.email && <p style={{ color: '#f87171', fontSize: 11, marginTop: 5, fontWeight: 500 }}><Icon name="alert" size={14} style={{ verticalAlign: '-2px', marginRight: 4 }} /> {errors.email}</p>}
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', marginBottom: 7, fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,.55)', letterSpacing: .5 }}>Password</label>
              <input type="password" value={password} onChange={e => { setPassword(e.target.value); if (errors.password) setErrors(p => ({ ...p, password: '' })) }} onFocus={() => setFocused('password')} onBlur={() => setFocused(null)} placeholder="••••••••" style={inp('password')} autoComplete="current-password" />
              {errors.password && <p style={{ color: '#f87171', fontSize: 11, marginTop: 5, fontWeight: 500 }}><Icon name="alert" size={14} style={{ verticalAlign: '-2px', marginRight: 4 }} /> {errors.password}</p>}
            </div>

            <button type="submit" disabled={loading} style={{ width: '100%', padding: 14, background: loading ? 'rgba(245,158,11,.35)' : 'linear-gradient(135deg,#f59e0b,#fbbf24)', border: 'none', borderRadius: 10, color: '#050505', fontSize: 14, fontWeight: 800, fontFamily: "'Outfit',sans-serif", letterSpacing: .5, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: loading ? 'none' : '0 4px 20px rgba(245,158,11,.3)', transition: 'transform .15s, box-shadow .15s' }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.transform = 'scale(1.02)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}>
              {loading
                ? <><span style={{ width: 16, height: 16, border: '2px solid rgba(0,0,0,.2)', borderTopColor: '#050505', borderRadius: '50%', animation: 'spin .7s linear infinite', display: 'inline-block' }} /> Signing in…</>
                : 'Sign In to Portal'}
            </button>
          </form>
          )}

          <div style={{ marginTop: 24, padding: '12px 16px', background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 10 }}>
            <p style={{ color: 'rgba(255,255,255,.4)', fontSize: 11, textAlign: 'center', lineHeight: 1.6 }}>
              This portal is restricted to authorised staff.<br />
              Player accounts are managed on tenant websites.
            </p>
          </div>
        </div>

        <p style={{ marginTop: 24, color: 'rgba(255,255,255,.12)', fontSize: 10, letterSpacing: 2, textAlign: 'center' }}>
          CASINOZE SUPPORT · MANAGEMENT PLATFORM · CONFIDENTIAL
        </p>
      </div>
    </>
  )
}
