import { useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabase'
import { Label, Btn, Notice, card, input } from '../../components/ui/kit'

export default function ResetPassword() {
  const router = useRouter()
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  async function submit(e) {
    e.preventDefault(); setMsg(null)
    if (pw.length < 8) return setMsg({ kind: 'error', text: 'Password must be at least 8 characters' })
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password: pw })
    setBusy(false)
    if (error) return setMsg({ kind: 'error', text: error.message.includes('session') ? 'This reset link has expired. Request a new one.' : error.message })
    setMsg({ kind: 'success', text: 'Password updated. Redirecting…' })
    setTimeout(() => router.push('/dashboard'), 1200)
  }
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-gradient)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: "'Outfit', sans-serif" }}>
      <Head><title>New password — Casinoze Room</title><link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;800&display=swap" rel="stylesheet" /></Head>
      <form onSubmit={submit} style={{ ...card, width: '100%', maxWidth: 420 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 20 }}>Choose a new password</h1>
        <Notice kind={msg?.kind}>{msg?.text}</Notice>
        <div style={{ marginBottom: 20 }}><Label>New password</Label><input type="password" required value={pw} onChange={e => setPw(e.target.value)} style={input} /></div>
        <Btn type="submit" disabled={busy} style={{ width: '100%' }}>{busy ? 'Saving…' : 'Update password'}</Btn>
      </form>
    </div>
  )
}
