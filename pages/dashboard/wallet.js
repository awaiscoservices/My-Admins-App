/**
 * pages/dashboard/wallet.js
 * Wallet is the single hub for all player financial activity.
 * - 4 balance cards (Cash, Bonus, Reserved, Withdrawable)
 * - 4 action buttons: Deposit, Withdraw, Scores, Redeem
 * - Withdraw opens an inline method picker (filtered by allow_withdraw=true)
 * - Full transaction history with filters
 */
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
  { key: 'all',           label: 'All'        },
  { key: 'deposit',       label: 'Deposits'   },
  { key: 'deposit_bonus', label: 'Bonuses'    },
  { key: 'game_load',     label: 'Scores'     },
  { key: 'redeem',        label: 'Redeems'    },
  { key: 'withdrawal',    label: 'Withdrawals'},
]

// ─── Balance card ─────────────────────────────────────────────────────────────
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

// ─── Withdraw method picker (inline modal) ────────────────────────────────────
function WithdrawMethodPicker({ onClose }) {
  const [methods, setMethods] = useState([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    supabase
      .from('payment_methods')
      .select('id, name, type, icon')
      .eq('is_active', true)
      .eq('allow_withdraw', true)
      .order('sort_order', { ascending: true })
      .then(({ data }) => { setMethods(data || []); setLoading(false) })
  }, [])

  const METHOD_ICONS = {
    cashapp: '💚', zelle: '⚡', venmo: '💙', chime: '💳',
    paypal: '🅿️', bank_transfer: '🏦', crypto: '₿', other: '💵',
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }} onClick={onClose}>
      <div style={{
        background: 'linear-gradient(135deg,rgba(10,22,40,.98),rgba(5,10,20,.98))',
        border: '1px solid rgba(251,191,36,.2)', borderRadius: 20,
        padding: 28, width: '100%', maxWidth: 420,
        boxShadow: '0 20px 60px rgba(0,0,0,.8)',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', fontFamily: "'Cinzel',serif" }}>Withdraw Funds</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', marginTop: 2 }}>Choose your withdrawal method</div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 10, width: 36, height: 36, cursor: 'pointer', color: 'rgba(255,255,255,.6)', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'rgba(255,255,255,.3)', fontSize: 13 }}>Loading…</div>
        ) : methods.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'rgba(255,255,255,.3)', fontSize: 13 }}>No withdrawal methods available</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {methods.map(m => (
              <button key={m.id} onClick={() => router.push(`/dashboard/withdraw?method=${m.id}`)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 16px', borderRadius: 14,
                  background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.1)',
                  cursor: 'pointer', textAlign: 'left', transition: 'all .15s',
                  fontFamily: "'Outfit',sans-serif", color: '#fff',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(251,191,36,.08)'; e.currentTarget.style.borderColor = 'rgba(251,191,36,.3)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,.1)' }}
              >
                <span style={{ fontSize: 24 }}>{METHOD_ICONS[m.type] || '💵'}</span>
                <span style={{ fontSize: 15, fontWeight: 700 }}>{m.name}</span>
                <span style={{ marginLeft: 'auto', fontSize: 18, color: 'rgba(255,255,255,.3)' }}>→</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function WalletPage() {
  const router = useRouter()
  const [wallet, setWallet]           = useState(null)
  const [transactions, setTransactions] = useState([])
  const [filter, setFilter]           = useState('all')
  const [loading, setLoading]         = useState(true)
  const [txLoading, setTxLoading]     = useState(false)
  const [page, setPage]               = useState(0)
  const [hasMore, setHasMore]         = useState(true)
  const [showWithdraw, setShowWithdraw] = useState(false)
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
        limit: LIMIT, offset: pageNum * LIMIT,
        type: filter === 'all' ? undefined : filter,
      })
      if (pageNum === 0) setTransactions(txs)
      else setTransactions(p => [...p, ...txs])
      setHasMore(txs.length === LIMIT)
      setPage(pageNum)
    } finally { setTxLoading(false) }
  }

  if (loading) return (
    <PlayerLayout>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
        <div style={{ color: 'rgba(255,255,255,.4)', fontSize: 14 }}>Loading wallet…</div>
      </div>
    </PlayerLayout>
  )

  // 4 action buttons — Withdraw opens inline picker
  const ACTIONS = [
    {
      label: '➕ Deposit',
      bg: 'linear-gradient(135deg,#10b981,#059669)',
      color: '#fff',
      onClick: () => router.push('/dashboard/deposit'),
    },
    {
      label: '💸 Withdraw',
      bg: 'linear-gradient(135deg,#3b82f6,#2563eb)',
      color: '#fff',
      onClick: () => setShowWithdraw(true),
    },
    {
      label: '🎮 Scores',
      bg: 'linear-gradient(135deg,#fbbf24,#f59e0b)',
      color: '#050505',
      onClick: () => router.push('/dashboard/games'),
    },
    {
      label: '🏆 Redeem',
      bg: 'linear-gradient(135deg,#f59e0b,#d97706)',
      color: '#050505',
      onClick: () => router.push('/dashboard/redeem'),
    },
  ]

  return (
    <PlayerLayout>
      <Head><title>Wallet — Casinoze Room</title></Head>

      {showWithdraw && <WithdrawMethodPicker onClose={() => setShowWithdraw(false)} />}

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: "'Cinzel', serif", fontSize: 'clamp(20px,3vw,28px)', fontWeight: 700, color: '#fff', marginBottom: 4 }}>My Wallet</h1>
        <p style={{ color: 'rgba(255,255,255,.4)', fontSize: 14 }}>All your balances and transaction history</p>
      </div>

      {/* 4 Balance cards */}
      {wallet && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(160px,100%),1fr))', gap: 12, marginBottom: 20 }}>
          <BucketCard label="Cash"         cents={wallet.cash_balance_cents}   color="#10b981" icon="💵" desc="Available to load or withdraw" />
          <BucketCard label="Bonus"        cents={wallet.bonus_balance_cents}  color="#f59e0b" icon="🎁" desc="Bonus credits" />
          <BucketCard label="Reserved"     cents={wallet.reserved_cents}       color="#94a3b8" icon="🔒" desc="Held for pending requests" />
          <BucketCard label="Withdrawable" cents={wallet.withdrawable_cents}   color="#fbbf24" icon="💸" desc="Ready to withdraw" />
        </div>
      )}

      {/* 4 Action buttons */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 28, flexWrap: 'wrap' }}>
        {ACTIONS.map(a => (
          <button key={a.label} onClick={a.onClick} style={{
            display: 'inline-flex', alignItems: 'center', padding: '11px 22px', borderRadius: 12,
            background: a.bg, color: a.color, fontSize: 13, fontWeight: 700, border: 'none',
            cursor: 'pointer', letterSpacing: '.02em', fontFamily: "'Outfit',sans-serif",
            boxShadow: '0 2px 12px rgba(0,0,0,.3)', transition: 'opacity .15s',
          }}
            onMouseEnter={e => e.currentTarget.style.opacity = '.85'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            {a.label}
          </button>
        ))}
      </div>

      {/* Transaction history */}
      <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 18, overflow: 'hidden' }}>
        <div style={{ padding: '18px 20px', borderBottom: '1px solid rgba(255,255,255,.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Transaction History</span>
          <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,.05)', padding: 4, borderRadius: 10, flexWrap: 'wrap' }}>
            {TX_FILTERS.map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)} style={{
                padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontFamily: "'Outfit',sans-serif", fontSize: 12, fontWeight: 700,
                background: filter === f.key ? 'rgba(251,191,36,.8)' : 'transparent',
                color: filter === f.key ? '#fff' : 'rgba(255,255,255,.4)', transition: 'all .15s',
              }}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {transactions.length === 0 && !txLoading ? (
          <div style={{ padding: '48px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
            <div style={{ color: 'rgba(255,255,255,.3)', fontSize: 14 }}>No transactions found</div>
          </div>
        ) : (
          <>
            {transactions.map(tx => (
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
