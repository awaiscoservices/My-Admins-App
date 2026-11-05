import { useEffect, useState } from 'react'
import Head from 'next/head'
import { supabase } from '../../lib/supabase'
import PlayerLayout from '../../components/layout/PlayerLayout'
import { useUser, Title, card, Btn, Empty, fmtDate, G } from '../../components/ui/kit'

export default function Notifications() {
  const user = useUser()
  const [rows, setRows] = useState([])

  async function load() {
    const { data } = await supabase.from('notifications').select('*').eq('user_id', user.id)
      .order('created_at', { ascending: false }).limit(50)
    setRows(data || [])
  }
  useEffect(() => { if (user) load() }, [user])

  async function markRead(ids) {
    if (!ids.length) return
    await supabase.from('notifications').update({ is_read: true }).in('id', ids)
    setRows(r => r.map(n => ids.includes(n.id) ? { ...n, is_read: true } : n))
  }
  const unread = rows.filter(n => !n.is_read).map(n => n.id)

  return (
    <PlayerLayout>
      <Head><title>Notifications — Casinoze Room</title></Head>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <Title sub="Updates on your deposits, games and withdrawals">Notifications</Title>
        {unread.length > 0 && <Btn ghost onClick={() => markRead(unread)}>Mark all read</Btn>}
      </div>
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        {rows.length === 0 ? <Empty icon="🔔" text="You're all caught up" /> : rows.map((n, i) => (
          <div key={n.id} onClick={() => !n.is_read && markRead([n.id])} style={{ padding: '16px 20px', cursor: n.is_read ? 'default' : 'pointer', borderBottom: i < rows.length - 1 ? '1px solid rgba(255,255,255,.05)' : 'none', background: n.is_read ? 'transparent' : 'rgba(251,191,36,.05)', display: 'flex', gap: 12 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', marginTop: 6, flexShrink: 0, background: n.is_read ? 'transparent' : G }} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{n.title}</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,.6)', margin: '2px 0 4px' }}>{n.message}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)' }}>{fmtDate(n.created_at)}</div>
            </div>
          </div>
        ))}
      </div>
    </PlayerLayout>
  )
}
