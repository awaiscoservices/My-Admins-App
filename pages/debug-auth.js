import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function DebugAuth() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [out, setOut] = useState('')

  async function run() {
    const lines = []
    lines.push('URL set: ' + !!process.env.NEXT_PUBLIC_SUPABASE_URL)
    lines.push('ANON key set: ' + !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    lines.push('URL host: ' + (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/^https?:\/\//, '').split('.')[0])
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    lines.push('login error: ' + (error ? `${error.status} ${error.message}` : 'none'))
    lines.push('user: ' + (data?.user?.id || 'none'))
    lines.push('email confirmed: ' + (data?.user?.email_confirmed_at || 'NO'))
    lines.push('cookies: ' + document.cookie.split(';').map(c => c.trim().split('=')[0]).join(', '))
    const { data: s } = await supabase.auth.getSession()
    lines.push('session present: ' + !!s.session)
    if (data?.user) {
      const p = await supabase.from('profiles').select('id').eq('id', data.user.id).single()
      const w = await supabase.from('wallets').select('id').eq('user_id', data.user.id).single()
      lines.push('profile row: ' + (p.error ? p.error.message : 'ok'))
      lines.push('wallet row: ' + (w.error ? w.error.message : 'ok'))
    }
    setOut(lines.join('\n'))
  }

  return (
    <div style={{ padding: 24, color: '#fff', background: '#111', minHeight: '100vh' }}>
      <input placeholder="email" value={email} onChange={e => setEmail(e.target.value)} style={{ display: 'block', marginBottom: 8, padding: 8 }} />
      <input placeholder="password" type="password" value={password} onChange={e => setPassword(e.target.value)} style={{ display: 'block', marginBottom: 8, padding: 8 }} />
      <button onClick={run} style={{ padding: 8 }}>Test login</button>
      <pre>{out}</pre>
    </div>
  )
}
