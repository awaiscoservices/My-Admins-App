/**
 * /player/dashboard
 *
 * Player-facing dashboard — shows level widget, wallet, game accounts, recent activity.
 * Uses /api/player/dashboard endpoint.
 */
import { useEffect, useState } from 'react'
import Head from 'next/head'
import { supabase } from '../../lib/supabase'
import LevelWidget from '../../components/player/LevelWidget'
import EligibilityCard from '../../components/player/EligibilityCard'

const fmt  = cents => `$${((cents || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
const fmtDate = d => d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

export default function PlayerDashboard() {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setError('Not logged in'); setLoading(false); return }
    const res = await fetch('/api/player/dashboard', {
      headers: { Authorization: `Bearer ${session.access_token}` }
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error); setLoading(false); return }
    setData(json)
    setLoading(false)
  }

  if (loading) return (
    <div style={pageStyle}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', color:'rgba(255,255,255,.3)', fontSize:14 }}>Loading…</div>
    </div>
  )
  if (error || !data) return (
    <div style={pageStyle}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', color:'#f87171', fontSize:14 }}>Error: {error}</div>
    </div>
  )

  const { profile, level, xp, wallet, withdrawal_today, game_accounts, recent_transactions } = data

  return (
    <div style={pageStyle}>
      <Head><title>Dashboard — {profile.name}</title></Head>

      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily:"'Cinzel',serif", fontSize: 22, fontWeight: 700, color: '#fff', margin: 0 }}>
          Welcome, {profile.name?.split(' ')[0]}
        </h1>
        <p style={{ color: 'rgba(255,255,255,.35)', fontSize: 13, marginTop: 4 }}>
          Your account overview
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, marginBottom: 24 }}>
        {/* Level widget */}
        <LevelWidget level={level} xp={xp} />

        {/* Wallet card */}
        <div style={{ background:'rgba(255,255,255,.03)', border:'1px solid rgba(255,255,255,.07)', borderRadius:20, padding:24 }}>
          <div style={{ fontSize:10, fontWeight:800, letterSpacing:'.1em', textTransform:'uppercase', color:'rgba(255,255,255,.35)', marginBottom:16 }}>Wallet</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <BalanceBox label="Cash Balance"  value={fmt(wallet.cash_balance_cents)}  color="#22c55e" />
            <BalanceBox label="Bonus Balance" value={fmt(wallet.bonus_balance_cents)} color="#6366f1" />
          </div>
          <div style={{ marginTop:16, paddingTop:14, borderTop:'1px solid rgba(255,255,255,.06)', display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            <StatRow label="Total Deposited"  value={fmt(wallet.total_deposited_cents)} />
            <StatRow label="Total Withdrawn"  value={fmt(wallet.total_withdrawn_cents)} />
            <StatRow label="Total Loaded"     value={fmt(wallet.total_loaded_cents)} />
            <StatRow label="Total Redeemed"   value={fmt(wallet.total_redeemed_cents)} />
          </div>
        </div>
      </div>

      {/* Daily withdrawal summary */}
      {withdrawal_today && (
        <div style={{ marginBottom: 24 }}>
          <SectionTitle>Today's Withdrawals</SectionTitle>
          <WithdrawSummaryInline w={withdrawal_today} level={level} />
        </div>
      )}

      {/* Game account eligibility */}
      {game_accounts.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <SectionTitle>My Game Accounts</SectionTitle>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:14 }}>
            {game_accounts.map(ga => (
              <EligibilityCard key={ga.id} account={ga} />
            ))}
          </div>
        </div>
      )}

      {/* Recent activity */}
      {recent_transactions.length > 0 && (
        <div>
          <SectionTitle>Recent Activity</SectionTitle>
          <div style={{ background:'rgba(255,255,255,.02)', border:'1px solid rgba(255,255,255,.06)', borderRadius:16, overflow:'hidden' }}>
            {recent_transactions.map((tx, i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', borderTop: i===0?'none':'1px solid rgba(255,255,255,.04)' }}>
                <div>
                  <div style={{ fontSize:13, color:'#fff', fontWeight:600, textTransform:'capitalize' }}>{tx.type?.replace(/_/g,' ')}</div>
                  <div style={{ fontSize:11, color:'rgba(255,255,255,.35)', marginTop:2 }}>{fmtDate(tx.created_at)}</div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:14, fontWeight:800, color: tx.direction==='credit' ? '#22c55e' : '#f87171' }}>
                    {tx.direction==='credit' ? '+' : '-'}{fmt(tx.amount_cents)}
                  </div>
                  <div style={{ fontSize:10, color:'rgba(255,255,255,.3)', marginTop:2, textTransform:'uppercase' }}>{tx.wallet_bucket}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────
function BalanceBox({ label, value, color }) {
  return (
    <div style={{ background:'rgba(255,255,255,.04)', borderRadius:12, padding:'14px 14px' }}>
      <div style={{ fontSize:9, fontWeight:800, letterSpacing:'.1em', textTransform:'uppercase', color:'rgba(255,255,255,.3)', marginBottom:6 }}>{label}</div>
      <div style={{ fontSize:20, fontWeight:900, color }}>{value}</div>
    </div>
  )
}

function StatRow({ label, value }) {
  return (
    <div>
      <div style={{ fontSize:10, color:'rgba(255,255,255,.3)' }}>{label}</div>
      <div style={{ fontSize:13, fontWeight:700, color:'rgba(255,255,255,.7)', marginTop:2 }}>{value}</div>
    </div>
  )
}

function SectionTitle({ children }) {
  return <h2 style={{ fontFamily:"'Cinzel',serif", fontSize:14, fontWeight:700, color:'rgba(255,255,255,.6)', letterSpacing:'.08em', textTransform:'uppercase', marginBottom:12, marginTop:0 }}>{children}</h2>
}

function WithdrawSummaryInline({ w, level }) {
  const fmt = c => `$${((c||0)/100).toLocaleString('en-US',{minimumFractionDigits:2})}`
  const color = w.pct_used >= 100 ? '#ef4444' : w.pct_used >= 80 ? '#f59e0b' : '#22c55e'
  return (
    <div style={{ background:'rgba(255,255,255,.03)', border:'1px solid rgba(255,255,255,.07)', borderRadius:14, padding:16 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
        <div style={{ fontSize:12, color:'rgba(255,255,255,.5)' }}>
          {level?.name || ''} · {fmt(w.withdrawn_cents)} used of {fmt(w.limit_cents)}
        </div>
        <div style={{ fontSize:16, fontWeight:800, color }}>{fmt(w.remaining_cents)} left</div>
      </div>
      <div style={{ height:6, borderRadius:99, background:'rgba(255,255,255,.07)', overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${Math.min(100,w.pct_used)}%`, borderRadius:99, background:`linear-gradient(90deg,${color}88,${color})`, transition:'width .4s' }} />
      </div>
      {w.pct_used >= 100 && (
        <div style={{ marginTop:10, fontSize:12, color:'#f87171', fontWeight:600, textAlign:'center' }}>⛔ Daily limit reached — resets within 24 hours</div>
      )}
    </div>
  )
}

const pageStyle = {
  minHeight:  '100vh',
  background: '#07111f',
  padding:    '32px 20px',
  maxWidth:   900,
  margin:     '0 auto',
  fontFamily: "'Outfit',sans-serif",
  color:      '#fff',
}
