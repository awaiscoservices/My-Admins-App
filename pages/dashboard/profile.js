import { useEffect, useState } from 'react'
import Head from 'next/head'
import { supabase } from '../../lib/supabase'
import PlayerLayout from '../../components/layout/PlayerLayout'
import StatusBadge from '../../components/ui/StatusBadge'
import { useUser, Title, Label, Btn, Notice, card, input } from '../../components/ui/kit'

export default function Profile() {
  const user = useUser()
  const [p, setP] = useState(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [pw, setPw] = useState('')
  const [msg, setMsg] = useState(null)
  const [pwMsg, setPwMsg] = useState(null)

  useEffect(() => {
    if (!user) return
    supabase.from('profiles').select('*').eq('id', user.id).single().then(({ data }) => {
      setP(data); setName(data?.full_name || ''); setPhone(data?.phone || '')
    })
  }, [user])

  async function save(e) {
    e.preventDefault(); setMsg(null)
    const { error } = await supabase.from('profiles').update({ full_name: name.trim(), phone: phone.trim() || null }).eq('id', user.id)
    setMsg(error ? { kind: 'error', text: error.message } : { kind: 'success', text: 'Profile saved' })
  }
  async function changePw(e) {
    e.preventDefault(); setPwMsg(null)
    if (pw.length < 8) return setPwMsg({ kind: 'error', text: 'Password must be at least 8 characters' })
    const { error } = await supabase.auth.updateUser({ password: pw })
    setPwMsg(error ? { kind: 'error', text: error.message } : { kind: 'success', text: 'Password updated' })
    if (!error) setPw('')
  }

  const row = (k, v) => <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,.05)', fontSize: 13 }}><span style={{ color: 'rgba(255,255,255,.45)' }}>{k}</span><span style={{ fontWeight: 600 }}>{v}</span></div>

  return (
    <PlayerLayout>
      <Head><title>Profile — Casinoze Room</title></Head>
      <Title sub="Manage your personal details and security">My Profile</Title>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(300px,100%),1fr))', gap: 20 }}>
        <form onSubmit={save} style={card}>
          <Notice kind={msg?.kind}>{msg?.text}</Notice>
          <div style={{ marginBottom: 16 }}><Label>Full name</Label><input value={name} onChange={e => setName(e.target.value)} style={input} /></div>
          <div style={{ marginBottom: 16 }}><Label>Email</Label><input value={user?.email || ''} disabled style={{ ...input, opacity: .6 }} /></div>
          <div style={{ marginBottom: 20 }}><Label>Phone</Label><input value={phone} onChange={e => setPhone(e.target.value)} style={input} /></div>
          <Btn type="submit">Save changes</Btn>
        </form>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={card}>
            {row('Level', `Level ${p?.player_level_id || 1}`)}
            {row('Total XP', p?.total_xp || 0)}
            {row('Verification', <StatusBadge status={p?.kyc_status || 'not_started'} size="xs" />)}
            {row('Account status', <StatusBadge status={p?.status || 'active'} size="xs" />)}
          </div>
          <form onSubmit={changePw} style={card}>
            <Notice kind={pwMsg?.kind}>{pwMsg?.text}</Notice>
            <div style={{ marginBottom: 16 }}><Label>New password</Label><input type="password" value={pw} onChange={e => setPw(e.target.value)} style={input} /></div>
            <Btn type="submit" ghost>Update password</Btn>
          </form>
        </div>
      </div>
    </PlayerLayout>
  )
}
