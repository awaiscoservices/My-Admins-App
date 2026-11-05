import { useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabase'
import PlayerLayout from '../../components/layout/PlayerLayout'
import MoneyDisplay from '../../components/ui/MoneyDisplay'
import StatusBadge from '../../components/ui/StatusBadge'
import { getMyTransactions, txTypeLabel, txTypeColor } from '../../lib/wallet'

const TX_FILTERS = [
  { key: 'all',            label: 'All' },
  { key: 'deposit',        label: 'Deposits' },
  { key: 'deposit_bonus',  label: 'Bonuses' },
  { key: 'game_load',      label: 'Game Loads' },
  { key: 'redeem',         label: 'Redeems' },
  { key: 'withdrawal',     label: 'Withdrawals' },
]

function BucketCard({ label, cents, color, icon, desc }) {
  return (
    <div style={{ padding: '20px', borderRadius: 16, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', flex: 1, minWidth: 150 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.4)' }}>{label}</span>
      </div>
      <MoneyDisplay cents={cents} size="xl" color={color} />
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,.25)', marginTop: 6, lineHeight: 1.5 }}>{desc}</div>
    </div>
  )
}

export default function WalletPage() {
  const router = useRouter()
  const [wallet, setWallet] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [txLoading, setTxLoading] = useState(false)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const LIMIT = 15

  useEffect(() => { loadWallet() }, [])
  useEffect(() => { loadTransactions(0) }, [filter])

  async function loadWallet() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }
    const { data } = await supabase.from('wallets').select('*').eq('user_id', user.id).single()
    setWallet(data)
    setLoading(false)
  }

  async function loadTransactions(pageNum = 0) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setTxLoading(true)
    try {
      const txs = await getMyTransactions(user.id, {
        limit: LIMIT,
        offset: pageNum * LIMIT,
        type: filter === 'all' ? undefined : filter,
      })
      if (pageNum === 0) {
        setTransactions(txs)
      } else {
        setTransactions(p => [...p, ...txs])
      }
      setHasMore(txs.length === LIMIT)
      setPage(pageNum)
    } finally {
      setTxLoading(false)
    }
  }

  if (loading) return (
    <PlayerLayout>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
        <div style={{ color: 'rgba(255,255,255,.4)', fontSize: 14 }}>Loading wallet…</div>
      </div>
    </PlayerLayout>
  )

  return (
    <PlayerLayout>
      <Head><title>Wallet — Casinoze Room</title></Head>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: "'Cinzel', serif", fontSize: 'clamp(20px,3vw,28px)', fontWeight: 700, color: '#fff', marginBottom: 4 }}>My Wallet</h1>
        <p style={{ color: 'rgba(255,255,255,.4)', fontSize: 14 }}>All your balance buckets and transaction history</p>
      </div>

      {/* Balance grid */}
      {wallet && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(160px,100%),1fr))', gap: 12, marginBottom: 12 }}>
            <BucketCard label="Cash"         cents={wallet.cash_balance_cents}    color="#10b981" icon="💵" desc="Available to load or withdraw" />
            <BucketCard label="Bonus"        cents={wallet.bonus_balance_cents}   color="#f59e0b" icon="🎁" desc="Bonus credits" />
            <BucketCard label="Reserved"     cents={wallet.reserved_cents}        color="#94a3b8" icon="🔒" desc="Held for pending requests" />
            <BucketCard label="Withdrawable" cents={wallet.withdrawable_cents}    color="#fbbf24" icon="💸" desc="Ready to withdraw" />
          </div>

          {/* Lifetime stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(160px,100%),1fr))', gap: 12 }}>
            {[
              { label: 'Total Deposited',  cents: wallet.total_deposited_cents,  color: '#10b981' },
              { label: 'Total Bonus',      cents: wallet.total_bonus_cents,      color: '#f59e0b' },
              { label: 'Total Loaded',     cents: wallet.total_loaded_cents,     color: '#fbbf24' },
              { label: 'Total Redeemed',   cents: wallet.total_redeemed_cents,   color: '#3b82f6' },
              { label: 'Total Withdrawn',  cents: wallet.total_withdrawn_cents,  color: '#ec4899' },
            ].map(s => (
              <div key={s.label} style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.05)' }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.3)', marginBottom: 6 }}>{s.label}</div>
                <MoneyDisplay cents={s.cents} size="md" color={s.color} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 28, flexWrap: 'wrap' }}>
        {[
          { href: '/dashboard/deposit',  label: '➕ Add Money',  bg: 'linear-gradient(135deg,#10b981,#059669)', color: '#fff' },
          { href: '/dashboard/games',    label: '🎮 Load Game',  bg: 'linear-gradient(135deg,#fbbf24,#f59e0b)', color: '#050505' },
          { href: '/dashboard/redeem',   label: '🏆 Redeem',     bg: 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#050505' },
          { href: '/dashboard/withdraw', label: '💸 Withdraw',   bg: 'linear-gradient(135deg,#3b82f6,#2563eb)', color: '#fff' },
        ].map(a => (
          <Link key={a.href} href={a.href} style={{ display: 'inline-flex', alignItems: 'center', padding: '10px 20px', borderRadius: 12, background: a.bg, color: a.color, fontSize: 13, fontWeight: 700, textDecoration: 'none', letterSpacing: '.02em' }}>
            {a.label}
          </Link>
        ))}
      </div>

      {/* Transaction history */}
      <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 18, overflow: 'hidden' }}>
        <div style={{ padding: '18px 20px', borderBottom: '1px solid rgba(255,255,255,.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Transaction History</span>

          {/* Filter tabs */}
          <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,.05)', padding: 4, borderRadius: 10, flexWrap: 'wrap' }}>
            {TX_FILTERS.map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: "'Outfit',sans-serif", fontSize: 12, fontWeight: 700, background: filter === f.key ? 'rgba(251,191,36,.8)' : 'transparent', color: filter === f.key ? '#fff' : 'rgba(255,255,255,.4)', transition: 'all .15s' }}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Transaction rows */}
        {transactions.length === 0 && !txLoading ? (
          <div style={{ padding: '48px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
            <div style={{ color: 'rgba(255,255,255,.3)', fontSize: 14 }}>No transactions found</div>
          </div>
        ) : (
          <>
            {transactions.map((tx, i) => (
              <div key={tx.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,.04)', transition: 'background .15s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.02)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: txTypeColor(tx.type) === '#10b981' ? 'rgba(16,185,129,.12)' : 'rgba(248,113,113,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                    {tx.direction === 'credit' ? '⬆️' : '⬇️'}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{txTypeLabel(tx.type)}</div>
                    {tx.description && <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', marginTop: 2 }}>{tx.description}</div>}
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,.25)', marginTop: 2 }}>
                      {new Date(tx.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      {tx.reference_id && <span style={{ marginLeft: 8, color: '#fbbf24' }}>#{tx.reference_id}</span>}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 16 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: txTypeColor(tx.type) }}>
                    {tx.direction === 'credit' ? '+' : '-'}
                    <MoneyDisplay cents={tx.amount_cents} size="md" color={txTypeColor(tx.type)} />
                  </div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,.25)', textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 2 }}>
                    {tx.wallet_bucket} wallet
                  </div>
                  <div style={{ marginTop: 4 }}>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,.2)' }}>
                      After: <MoneyDisplay cents={tx.balance_after_cents} size="xs" color="rgba(255,255,255,.3)" />
                    </span>
                  </div>
                </div>
              </div>
            ))}

            {/* Load more */}
            {hasMore && (
              <div style={{ padding: '16px', textAlign: 'center' }}>
                <button onClick={() => loadTransactions(page + 1)} disabled={txLoading} style={{ padding: '10px 28px', background: 'rgba(251,191,36,.15)', border: '1px solid rgba(251,191,36,.3)', borderRadius: 10, color: '#fbbf24', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>
                  {txLoading ? 'Loading…' : 'Load More'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </PlayerLayout>
  )
}
