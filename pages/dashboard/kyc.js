import { useEffect, useState } from 'react'
import Head from 'next/head'
import { supabase } from '../../lib/supabase'
import PlayerLayout from '../../components/layout/PlayerLayout'
import StatusBadge from '../../components/ui/StatusBadge'
import { useUser, Title, Label, Btn, Notice, card, input, fmtDate } from '../../components/ui/kit'

const ID_TYPES = ["Driver's license", 'Passport', 'National ID card']

export default function KYC() {
  const user = useUser()
  const [latest, setLatest] = useState(undefined)
  const [f, setF] = useState({ name: '', dob: '', address: '', idType: ID_TYPES[0], idNumber: '' })
  const [front, setFront] = useState(null)
  const [back, setBack] = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  async function load() {
    const { data } = await supabase.from('kyc_records').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1)
    setLatest(data?.[0] || null)
  }
  useEffect(() => { if (user) load() }, [user])

  async function upload(file, tag) {
    if (file.size > 8 * 1024 * 1024) throw new Error('Each file must be under 8 MB')
    const ext = file.name.split('.').pop().toLowerCase()
    const path = `${user.id}/${Date.now()}-${tag}.${ext}`
    const { error } = await supabase.storage.from('kyc-documents').upload(path, file)
    if (error) throw error
    return path
  }

  async function submit(e) {
    e.preventDefault(); setMsg(null)
    if (!f.name || !f.dob || !f.address || !f.idNumber || !front) return setMsg({ kind: 'error', text: 'Fill in all fields and upload the front of your ID' })
    setBusy(true)
    try {
      const front_path = await upload(front, 'front')
      const back_path = back ? await upload(back, 'back') : null
      const { error } = await supabase.from('kyc_records').insert({
        user_id: user.id, full_legal_name: f.name.trim(), dob: f.dob, address: f.address.trim(),
        id_type: f.idType, id_number: f.idNumber.trim(), front_path, back_path, status: 'pending',
      })
      if (error) throw error
      load()
    } catch (err) { setMsg({ kind: 'error', text: err.message }) }
    setBusy(false)
  }

  const canResubmit = latest === null || ['rejected', 'more_info_required', 'expired'].includes(latest?.status)
  const field = (label, k, type = 'text') => <div style={{ marginBottom: 16 }}><Label>{label}</Label><input type={type} value={f[k]} onChange={set(k)} style={input} /></div>

  return (
    <PlayerLayout>
      <Head><title>Verification — Casinoze Room</title></Head>
      <Title sub="Verify your identity to unlock withdrawals">Identity Verification</Title>
      {latest && (
        <div style={{ ...card, marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div><div style={{ fontWeight: 700 }}>Latest submission</div><div style={{ fontSize: 12, color: 'rgba(255,255,255,.4)' }}>{fmtDate(latest.created_at)}</div></div>
          <StatusBadge status={latest.status} />
        </div>
      )}
      {latest?.status === 'pending' && <Notice>Your documents are under review. This usually takes a short while.</Notice>}
      {latest?.status === 'verified' && <Notice kind="success">You're verified — withdrawals are unlocked.</Notice>}
      {latest !== undefined && canResubmit && (
        <form onSubmit={submit} style={{ ...card, maxWidth: 560 }}>
          <Notice kind={msg?.kind}>{msg?.text}</Notice>
          {field('Full legal name', 'name')}
          {field('Date of birth', 'dob', 'date')}
          {field('Home address', 'address')}
          <div style={{ marginBottom: 16 }}><Label>ID type</Label><select value={f.idType} onChange={set('idType')} style={input}>{ID_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
          {field('ID number', 'idNumber')}
          <div style={{ marginBottom: 16 }}><Label>ID — front (required)</Label><input type="file" accept="image/*,.pdf" onChange={e => setFront(e.target.files[0])} style={input} /></div>
          <div style={{ marginBottom: 20 }}><Label>ID — back (optional)</Label><input type="file" accept="image/*,.pdf" onChange={e => setBack(e.target.files[0])} style={input} /></div>
          <Btn type="submit" disabled={busy}>{busy ? 'Uploading…' : 'Submit for verification'}</Btn>
        </form>
      )}
    </PlayerLayout>
  )
}
