import { useState, useEffect } from 'react'
import Head from 'next/head'
import AdminLayout from '../../components/layout/AdminLayout'
import { supabase } from '../../lib/supabase'

const gold   = '#fbbf24'
const green  = '#22c55e'
const red    = '#ef4444'
const purple = '#a855f7'
const blue   = '#3b82f6'
const cyan   = '#06b6d4'
const orange = '#f97316'
const pink   = '#ec4899'

function StatCard({ label, value, sub, color = gold, icon, trend }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,.03)',
      border: `1px solid ${color}28`,
      borderRadius: 16,
      padding: '20px 22px',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* subtle glow strip at top */}
      <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:`linear-gradient(90deg,${color}00,${color}80,${color}00)`, borderRadius:'16px 16px 0 0' }} />
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
        <span style={{ fontSize:12, color:'rgba(255,255,255,.45)', letterSpacing:'.05em', textTransform:'uppercase', fontWeight:600 }}>{label}</span>
        <span style={{ fontSize:22, lineHeight:1 }}>{icon}</span>
      </div>
      <div style={{ fontSize:30, fontWeight:800, color, fontFamily:"'Outfit',sans-serif", letterSpacing:'-.5px' }}>{value}</div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        {sub && <div style={{ fontSize:12, color:'rgba(255,255,255,.35)' }}>{sub}</div>}
        {trend != null && (
          <span style={{ fontSize:11, fontWeight:700, color: trend >= 0 ? green : red }}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
        )}
      </div>
    </div>
  )
}

function BarChart({ data, color = gold, height = 110 }) {
  if (!data?.length) return (
    <div style={{ height, display:'flex', alignItems:'center', justifyContent:'center', color:'rgba(255,255,255,.2)', fontSize:13 }}>No data</div>
  )
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div style={{ display:'flex', alignItems:'flex-end', gap:4, height, padding:'0 2px' }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3, height:'100%', justifyContent:'flex-end' }}>
          <div
            title={`${d.label}: ${d.display || d.value}`}
            style={{
              width:'100%',
              height:`${Math.max((d.value / max) * (height - 20), 2)}px`,
              background:`linear-gradient(to top,${color}dd,${color}55)`,
              borderRadius:'4px 4px 0 0',
              transition:'height .4s ease',
              cursor:'default',
            }}
          />
          <span style={{ fontSize:9, color:'rgba(255,255,255,.3)', whiteSpace:'nowrap', overflow:'hidden', maxWidth:'100%', textAlign:'center' }}>
            {d.label}
          </span>
        </div>
      ))}
    </div>
  )
}

function Sparkline({ values, color = gold, height = 44 }) {
  if (!values?.length) return null
  const w = 100, h = height
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const range = max - min || 1
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w
    const y = h - ((v - min) / range) * (h - 4) - 2
    return `${x},${y}`
  }).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width:'100%', height }} >
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={`0,${h} ${pts} ${w},${h}`} fill={`${color}20`} stroke="none" />
    </svg>
  )
}

function fmt(cents) {
  return `$${((cents || 0) / 100).toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 })}`
}
function fmtNum(n) { return Number(n || 0).toLocaleString() }

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
function last7Labels() {
  return Array.from({ length:7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - 6 + i); return DAYS[d.getDay()]
  })
}

export default function AdminDashboard() {
  const [stats,   setStats]   = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchStats() }, [])

  async function fetchStats() {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) { setLoading(false); return }
    try {
      const res = await fetch('/api/admin/analytics', { headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) setStats(await res.json())
    } catch (e) { console.error('Analytics fetch error', e) }
    setLoading(false)
  }

  const s = stats || {}
  const labels7 = last7Labels()

  // ── derived helpers ───────────────────────────────────────────────────────
  const totalRevenue   = (s.total_deposits_cents || 0) - (s.total_withdrawals_cents || 0)
  const avgDeposit     = s.deposits_count ? Math.round((s.total_deposits_cents || 0) / s.deposits_count) : 0
  const approvalRate   = s.deposits_count
    ? Math.round(((s.deposits_count - (s.pending_deposits || 0)) / s.deposits_count) * 100)
    : 0

  return (
    <AdminLayout>
      <Head><title>Dashboard — Casinoze Admin</title></Head>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
      `}</style>

      <div style={{ fontFamily:"'Outfit',sans-serif", color:'#fff' }}>

        {/* ── Header ── */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:28 }}>
          <div>
            <h1 style={{ fontSize:24, fontWeight:800, color:gold, margin:0, fontFamily:"'Cinzel',serif" }}>Platform Overview</h1>
            <p style={{ fontSize:13, color:'rgba(255,255,255,.4)', marginTop:4 }}>
              Live stats · {new Date().toLocaleDateString('en-US',{ weekday:'long', month:'long', day:'numeric' })}
            </p>
          </div>
          <button onClick={fetchStats} style={{ padding:'9px 20px', background:'rgba(251,191,36,.1)', border:'1px solid rgba(251,191,36,.35)', borderRadius:10, color:gold, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:6 }}>
            ↻ Refresh
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign:'center', padding:'80px 0', color:'rgba(255,255,255,.3)', fontSize:14 }}>
            <div style={{ width:34, height:34, border:`3px solid rgba(251,191,36,.2)`, borderTopColor:gold, borderRadius:'50%', animation:'spin .8s linear infinite', margin:'0 auto 16px' }} />
            Loading analytics…
          </div>
        ) : (
          <>
            {/* ══ ROW 1 — Players & Money (4 cards) ══ */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:16 }}>
              <StatCard icon="👥" label="Total Players"        value={fmtNum(s.total_players)}            sub={`${fmtNum(s.new_players_today)} new today`}        color={blue}   />
              <StatCard icon="💰" label="Total Deposits"       value={fmt(s.total_deposits_cents)}         sub={`${fmtNum(s.deposits_count)} transactions`}        color={green}  />
              <StatCard icon="📤" label="Total Withdrawals"    value={fmt(s.total_withdrawals_cents)}      sub={`${fmtNum(s.withdrawals_count)} paid out`}         color={red}    />
              <StatCard icon="📈" label="Net Revenue"          value={fmt(totalRevenue)}                   sub="Deposits minus withdrawals"                        color={gold}   />
            </div>

            {/* ══ ROW 2 — Pending Queues (4 cards) ══ */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:16 }}>
              <StatCard icon="⏳" label="Pending Deposits"     value={fmtNum(s.pending_deposits)}          sub="Awaiting approval"                                 color={orange} />
              <StatCard icon="⏳" label="Pending Withdrawals"  value={fmtNum(s.pending_withdrawals)}       sub="Awaiting approval"                                 color={orange} />
              <StatCard icon="🆔" label="KYC Pending"          value={fmtNum(s.pending_kyc)}               sub="Needs review"                                      color={pink}   />
              <StatCard icon="🎫" label="Open Tickets"         value={fmtNum(s.open_tickets)}              sub="Support queue"                                     color={cyan}   />
            </div>

            {/* ══ ROW 3 — Games & Scores (4 cards) ══ */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:16 }}>
              <StatCard icon="🎮" label="Active Game Accounts" value={fmtNum(s.active_game_accounts)}      sub={`${fmtNum(s.pending_game_accounts)} pending setup`} color={purple} />
              <StatCard icon="🏆" label="Score Loads (7d)"     value={fmtNum(s.game_loads_7d)}             sub={`${fmtNum(s.pending_game_loads)} awaiting`}         color={gold}   />
              <StatCard icon="🎁" label="Redemptions (7d)"     value={fmtNum(s.redemptions_7d)}            sub={`${fmtNum(s.pending_redemptions)} pending`}         color={pink}   />
              <StatCard icon="✅" label="Deposit Approval %"   value={`${approvalRate}%`}                  sub="Approved of total submitted"                       color={green}  />
            </div>

            {/* ══ ROW 4 — Growth & Finance (4 cards) ══ */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:28 }}>
              <StatCard icon="🆕" label="New Players (7d)"     value={fmtNum(s.new_players_7d)}            sub="Registrations this week"                           color={blue}   />
              <StatCard icon="💳" label="Avg Deposit"          value={fmt(avgDeposit)}                     sub="Per transaction"                                   color={cyan}   />
              <StatCard icon="📊" label="Deposits (7d)"        value={fmt(s.deposits_7d_cents)}            sub="Revenue this week"                                 color={green}  />
              <StatCard icon="📉" label="Withdrawals (7d)"     value={fmt(s.withdrawals_7d_cents)}         sub="Paid out this week"                                color={red}    />
            </div>

            {/* ══ Charts Row ══ */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:24 }}>
              {/* Deposits chart */}
              <div style={{ background:'rgba(255,255,255,.025)', border:'1px solid rgba(255,255,255,.07)', borderRadius:16, padding:'20px 20px 16px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
                  <h3 style={{ fontSize:13, fontWeight:700, color:green, margin:0, textTransform:'uppercase', letterSpacing:'.06em' }}>Deposits — Last 7 Days</h3>
                  <span style={{ fontSize:20, fontWeight:800, color:green }}>{fmt(s.deposits_7d_cents)}</span>
                </div>
                <BarChart color={green} height={110}
                  data={(s.deposits_by_day || labels7.map(l => ({ label:l, value:0 }))).map((d, i) => ({
                    ...d, label:labels7[i] || d.label, display:fmt(d.value),
                  }))}
                />
              </div>

              {/* Withdrawals chart */}
              <div style={{ background:'rgba(255,255,255,.025)', border:'1px solid rgba(255,255,255,.07)', borderRadius:16, padding:'20px 20px 16px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
                  <h3 style={{ fontSize:13, fontWeight:700, color:red, margin:0, textTransform:'uppercase', letterSpacing:'.06em' }}>Withdrawals — Last 7 Days</h3>
                  <span style={{ fontSize:20, fontWeight:800, color:red }}>{fmt(s.withdrawals_7d_cents)}</span>
                </div>
                <BarChart color={red} height={110}
                  data={(s.withdrawals_by_day || labels7.map(l => ({ label:l, value:0 }))).map((d, i) => ({
                    ...d, label:labels7[i] || d.label, display:fmt(d.value),
                  }))}
                />
              </div>
            </div>

            {/* ══ Player Growth Sparkline ══ */}
            <div style={{ background:'rgba(255,255,255,.025)', border:'1px solid rgba(255,255,255,.07)', borderRadius:16, padding:'20px 24px', marginBottom:24 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
                <div>
                  <h3 style={{ fontSize:13, fontWeight:700, color:blue, margin:'0 0 3px', textTransform:'uppercase', letterSpacing:'.06em' }}>New Player Signups — Last 14 Days</h3>
                  <p style={{ fontSize:12, color:'rgba(255,255,255,.3)', margin:0 }}>Daily registrations trend</p>
                </div>
                <span style={{ fontSize:22, fontWeight:800, color:blue }}>{fmtNum(s.new_players_14d)}</span>
              </div>
              <Sparkline
                values={(s.signups_by_day || Array(14).fill(0)).map(d => typeof d === 'object' ? d.value : d)}
                color={blue}
                height={56}
              />
            </div>

            {/* ══ Recent Transactions ══ */}
            <div style={{ background:'rgba(255,255,255,.025)', border:'1px solid rgba(255,255,255,.07)', borderRadius:16, overflow:'hidden' }}>
              <div style={{ padding:'16px 22px', borderBottom:'1px solid rgba(255,255,255,.07)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <h3 style={{ fontSize:13, fontWeight:700, color:gold, margin:0, textTransform:'uppercase', letterSpacing:'.06em' }}>Recent Transactions</h3>
                <span style={{ fontSize:11, color:'rgba(255,255,255,.3)' }}>Latest 20</span>
              </div>
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                  <thead>
                    <tr style={{ background:'rgba(255,255,255,.03)' }}>
                      {['Reference','Player','Type','Amount','Status','Time'].map(h => (
                        <th key={h} style={{ padding:'10px 16px', textAlign:'left', color:'rgba(255,255,255,.4)', fontWeight:600, fontSize:10, textTransform:'uppercase', letterSpacing:'.08em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {!(s.recent_transactions?.length) ? (
                      <tr><td colSpan={6} style={{ padding:'32px', textAlign:'center', color:'rgba(255,255,255,.2)', fontSize:13 }}>No transactions yet</td></tr>
                    ) : (s.recent_transactions || []).map((tx, i) => (
                      <tr key={i} style={{ borderTop:'1px solid rgba(255,255,255,.04)' }}
                        onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,.02)'}
                        onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                        <td style={{ padding:'11px 16px', color:'rgba(255,255,255,.55)', fontFamily:'monospace', fontSize:11 }}>{tx.reference_id}</td>
                        <td style={{ padding:'11px 16px', color:'#fff', fontWeight:600 }}>{tx.player_name || '—'}</td>
                        <td style={{ padding:'11px 16px' }}>
                          <span style={{ padding:'3px 9px', borderRadius:5, fontSize:10, fontWeight:800,
                            background: tx.type==='deposit' ? 'rgba(34,197,94,.15)' : 'rgba(239,68,68,.15)',
                            color: tx.type==='deposit' ? green : red }}>
                            {tx.type?.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ padding:'11px 16px', color: tx.type==='deposit' ? green : red, fontWeight:700 }}>
                          {tx.type==='deposit' ? '+' : '−'}{fmt(tx.amount_cents)}
                        </td>
                        <td style={{ padding:'11px 16px' }}>
                          <span style={{ padding:'3px 9px', borderRadius:5, fontSize:10, fontWeight:600,
                            background: tx.status==='approved' ? 'rgba(34,197,94,.1)' : tx.status==='pending' ? 'rgba(251,191,36,.1)' : 'rgba(239,68,68,.1)',
                            color: tx.status==='approved' ? green : tx.status==='pending' ? gold : red }}>
                            {tx.status}
                          </span>
                        </td>
                        <td style={{ padding:'11px 16px', color:'rgba(255,255,255,.3)', fontSize:12 }}>
                          {tx.created_at ? new Date(tx.created_at).toLocaleString('en-US',{ month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </>
        )}
      </div>
    </AdminLayout>
  )
}
