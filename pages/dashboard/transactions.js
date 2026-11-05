import { useEffect, useState } from 'react'
import Head from 'next/head'
import { supabase } from '../../lib/supabase'
import PlayerLayout from '../../components/layout/PlayerLayout'
import MoneyDisplay from '../../components/ui/MoneyDisplay'
import { txTypeLabel, txTypeColor } from '../../lib/wallet'
import { useUser, Title, card, Btn, Empty, fmtDate, G } from '../../components/ui/kit'

const FILTERS = [['All', null], ['Deposits', 'deposit%'], ['Game Loads', 'game_load%'], ['Redeems', 'redeem%'], ['Withdrawals', 'withdrawal%'], ['Bonuses', '%bonus%']]
const PAGE = 20

export default function Transactions() {
  const user = useUser()
  const [filter, setFilter] = useState(0)
  const [rows, setRows] = useState([])
  const [more, setMore] = useState(false)
  const [loading, setLoading] = useState(true)

  async function load(reset) {
    setLoading(true)
    const offset = reset ? 0 : rows.length
    let q = supabase.from('ledger').select('*').eq('user_id', user.id)
      .order('created_at', { ascending: false }).range(offset, offset + PAGE - 1)
    if (FILTERS[filter][1]) q = q.like('type', FILTERS[filter][1])
    const { data } = await q
    setRows(reset ? data || [] : [...rows, ...(data || [])])
    setMore((data || []).length === PAGE)
    setLoading(false)
  }
  useEffect(() => { if (user) load(true) }, [user, filter])

  return (
    <PlayerLayout>
      <Head><title>Transactions — Casinoze Room</title></Head>
      <Title sub="Every credit and debit on your account">Transactions</Title>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
        {FILTERS.map(([name], i) => (
          <button key={name} onClick={() => setFilter(i)} style={{ padding: '8px 16px', borderRadius: 99, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${i === filter ? G : 'rgba(255,255,255,.12)'}`, background: i === filter ? G : 'transparent', color: i === filter ? '#050505' : 'rgba(255,255,255,.7)' }}>{name}</button>
        ))}
      </div>
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        {!loading && rows.length === 0 ? <Empty icon="📋" text="No transactions found" /> : rows.map((tx, i) => (
          <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: i < rows.length - 1 ? '1px solid rgba(255,255,255,.05)' : 'none' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{txTypeLabel(tx.type)}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)' }}>{fmtDate(tx.created_at)}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 800, color: txTypeColor(tx.type) }}>{tx.direction === 'credit' ? '+' : '-'}<MoneyDisplay cents={tx.amount_cents} size="sm" color={txTypeColor(tx.type)} /></div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,.3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{tx.wallet_bucket}</div>
            </div>
          </div>
        ))}
      </div>
      {more && <div style={{ textAlign: 'center', marginTop: 18 }}><Btn ghost onClick={() => load(false)} disabled={loading}>{loading ? 'Loading…' : 'Load more'}</Btn></div>}
    </PlayerLayout>
  )
}
