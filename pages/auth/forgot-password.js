import { useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'
import { Label, Btn, Notice, card, input } from '../../components/ui/kit'
import AuthBackdrop from '../../components/site/AuthBackdrop'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  async function submit(e) {
    e.preventDefault(); setMsg(null); setBusy(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/auth/reset-password` })
    setBusy(false)
    setMsg(error ? { kind: 'error', text: error.message } : { kind: 'success', text: 'If that email has an account, a reset link is on its way.' })
  }
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-gradient)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: "'Outfit', sans-serif" }}>
      <Head><title>Forgot password — Casinoze Room</title><link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,700;1,9..144,500;1,9..144,700&family=Cinzel:wght@600;700&family=Outfit:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" /></Head>
      <AuthBackdrop />
      <form onSubmit={submit} style={{ ...card, width: '100%', maxWidth: 420, position: 'relative', zIndex: 1, background: 'rgba(10,16,30,.78)', backdropFilter: 'blur(14px)', borderRadius: 22, padding: 30 }}>
        <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 30, fontWeight: 700, marginBottom: 6 }}>Reset your password</h1>
        <p style={{ color: 'rgba(255,255,255,.5)', fontSize: 14, marginBottom: 20 }}>Enter your email and we'll send you a reset link.</p>
        <Notice kind={msg?.kind}>{msg?.text}</Notice>
        <div style={{ marginBottom: 20 }}><Label>Email</Label><input type="email" required value={email} onChange={e => setEmail(e.target.value)} style={input} /></div>
        <Btn type="submit" disabled={busy} style={{ width: '100%' }}>{busy ? 'Sending…' : 'Send reset link'}</Btn>
        <div style={{ textAlign: 'center', marginTop: 16 }}><Link href="/auth/login" style={{ color: '#fbbf24', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>← Back to sign in</Link></div>
      </form>
    </div>
  )
}
