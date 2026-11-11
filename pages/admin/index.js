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

/**
 * Stroke icons, drawn on a 24×24 box and inheriting the card's colour.
 *
 * These replace the emoji each card used to show. An emoji is a different
 * glyph on every platform — a different shape, a different palette, and on
 * some machines a missing-character box — so the row never looked like one
 * set. These are one weight and one colour each.
 */
const ICONS = {
  users:      'M16 20v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2M9.5 10a4 4 0 100-8 4 4 0 000 8zM21 20v-2a4 4 0 00-3-3.9M16 2.1a4 4 0 010 7.8',
  dollar:     'M12 2v20M17 6.5c0-1.9-2.2-3-5-3s-5 1.1-5 3 2.2 2.8 5 3.3 5 1.4 5 3.4-2.2 3.3-5 3.3-5-1.4-5-3.3',
  upload:     'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M12 3v12M7 8l5-5 5 5',
  trendUp:    'M3 17l6-6 4 4 7-7M17 8h4v4',
  trendDown:  'M3 7l6 6 4-4 7 7M17 16h4v-4',
  clock:      'M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2',
  id:         'M3 5h18a1 1 0 011 1v12a1 1 0 01-1 1H3a1 1 0 01-1-1V6a1 1 0 011-1zM8 12a2 2 0 100-4 2 2 0 000 4zM5 16c.6-1.6 2-2.5 3-2.5s2.4.9 3 2.5M15 10h4M15 14h4',
  ticket:     'M4 8V6a1 1 0 011-1h14a1 1 0 011 1v2a2 2 0 000 4v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4a2 2 0 000-4zM12 7v10',
  gamepad:    'M6 12h4M8 10v4M15 11h.01M18 13h.01M7 18a5 5 0 01-5-5 5 5 0 015-5h10a5 5 0 015 5 5 5 0 01-5 5c-1.5 0-2.6-.7-3.3-1.5h-3.4C9.6 17.3 8.5 18 7 18z',
  trophy:     'M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0V4zM7 6H4v1a3 3 0 003 3M17 6h3v1a3 3 0 01-3 3',
  gift:       'M20 12v9H4v-9M2 7h20v5H2zM12 21V7M12 7H7.5a2.5 2.5 0 110-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 100-5C13 2 12 7 12 7z',
  check:      'M22 11.1V12a10 10 0 11-5.9-9.1M22 4L12 14l-3-3',
  userPlus:   'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM19 8v6M22 11h-6',
  card:       'M3 6h18a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V7a1 1 0 011-1zM2 10h20',
  bars:       'M3 21h18M7 21V11M12 21V5M17 21v-7',
  refresh:    'M21 12a9 9 0 01-15.5 6.2M3 12A9 9 0 0118.5 5.8M18.5 2v4h-4M5.5 22v-4h4',
}

function Icon({ name, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, display: 'block' }}>
      <path d={ICONS[name] || ICONS.bars} />
    </svg>
  )
}

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
      // Cards sit in an auto-filling grid, so a row can hold a different
      // number of them at different widths. A fixed minimum keeps every card
      // the same height whatever lands next to it.
      minHeight: 132,
    }}>
      {/* accent strip at top */}
      <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:`linear-gradient(90deg,${color}00,${color}80,${color}00)`, borderRadius:'16px 16px 0 0' }} />
      {/* Icon badge first, then the label beside it — the same arrangement as
          the player wallet cards, so the two sides of the product read alike. */}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
        <span style={{
          width:38, height:38, borderRadius:11, flexShrink:0,
          background:`${color}1a`, border:`1px solid ${color}40`, color,
          display:'flex', alignItems:'center', justifyContent:'center',
        }}>
          <Icon name={icon} size={18} />
        </span>
        <span style={{ fontSize:11.5, fontWeight:800, letterSpacing:'.1em', textTransform:'uppercase', color:'rgba(255,255,255,.75)', lineHeight:1.3 }}>{label}</span>
      </div>
      <div style={{ fontSize:30, fontWeight:800, color, fontFamily:"'Outfit',sans-serif", letterSpacing:'-.5px' }}>{value}</div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:'auto', paddingTop:8 }}>
        {sub && <div style={{ fontSize:12, color:'rgba(255,255,255,.35)' }}>{sub}</div>}
        {trend != null && (
          <span style={{ display:'flex', alignItems:'center', gap:3, fontSize:11, fontWeight:700, color: trend >= 0 ? green : red }}>
            <Icon name={trend >= 0 ? 'trendUp' : 'trendDown'} size={12} /> {Math.abs(trend)}%
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

        /* Four across. Inline styles cannot carry media queries, which is why
           the breakpoints live here rather than on the element. */
        .stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
        @media (max-width: 1180px) { .stat-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 620px)  { .stat-grid { grid-template-columns: 1fr; } }

        .chart-row { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        @media (max-width: 900px) { .chart-row { grid-template-columns: 1fr; } }
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
          <button onClick={fetchStats} style={{ padding:'9px 20px', background:'rgba(251,191,36,.1)', border:'1px solid rgba(251,191,36,.35)', borderRadius:10, color:gold, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:7 }}>
            <Icon name="refresh" size={14} /> Refresh
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign:'center', padding:'80px 0', color:'rgba(255,255,255,.3)', fontSize:14 }}>
            <div style={{ width:34, height:34, border:`3px solid rgba(251,191,36,.2)`, borderTopColor:gold, borderRadius:'50%', animation:'spin .8s linear infinite', margin:'0 auto 16px' }} />
            Loading analytics…
          </div>
        ) : (
          <>
            {/* ══ Stat cards ══
                Four across, four rows deep. An auto-fitting grid was tried
                here and gave 5/5/5/1 — the sixteen cards are four groups of
                four, so the row length has to be four for the grouping to
                survive. It drops to two columns on a tablet and one on a
                phone, which is the only place a fixed four does not work. */}
            <div className="stat-grid" style={{ marginBottom:28 }}>
              {/* Players & money */}
              <StatCard icon="users"     label="Total Players"        value={fmtNum(s.total_players)}        sub={`${fmtNum(s.new_players_today)} new today`}        color={blue}   />
              <StatCard icon="dollar"    label="Total Deposits"       value={fmt(s.total_deposits_cents)}    sub={`${fmtNum(s.deposits_count)} transactions`}        color={green}  />
              <StatCard icon="upload"    label="Total Withdraw"    value={fmt(s.total_withdrawals_cents)} sub={`${fmtNum(s.withdrawals_count)} paid out`}         color={red}    />
              <StatCard icon="trendUp"   label="Net Revenue"          value={fmt(totalRevenue)}              sub="Deposits minus withdrawals"                        color={gold}   />

              {/* Pending queues */}
              <StatCard icon="clock"     label="Pending Deposits"     value={fmtNum(s.pending_deposits)}     sub="Awaiting approval"                                 color={orange} />
              <StatCard icon="clock"     label="Pending Withdraw"  value={fmtNum(s.pending_withdrawals)}  sub="Awaiting approval"                                 color={orange} />
              <StatCard icon="id"        label="KYC Pending"          value={fmtNum(s.pending_kyc)}          sub="Needs review"                                      color={pink}   />
              <StatCard icon="ticket"    label="Open Tickets"         value={fmtNum(s.open_tickets)}         sub="Support queue"                                     color={cyan}   />

              {/* Games & scores */}
              <StatCard icon="gamepad"   label="Active Game Accounts" value={fmtNum(s.active_game_accounts)} sub={`${fmtNum(s.pending_game_accounts)} pending setup`} color={purple} />
              <StatCard icon="trophy"    label="Score Loads (7d)"     value={fmtNum(s.game_loads_7d)}        sub={`${fmtNum(s.pending_game_loads)} awaiting`}         color={gold}   />
              <StatCard icon="gift"      label="Redeem (7d)"     value={fmtNum(s.redemptions_7d)}       sub={`${fmtNum(s.pending_redemptions)} pending`}         color={pink}   />
              <StatCard icon="check"     label="Deposit Approval %"   value={`${approvalRate}%`}             sub="Approved of total submitted"                       color={green}  />

              {/* Growth & finance */}
              <StatCard icon="userPlus"  label="New Players (7d)"     value={fmtNum(s.new_players_7d)}       sub="Registrations this week"                           color={blue}   />
              <StatCard icon="card"      label="Avg Deposit"          value={fmt(avgDeposit)}                sub="Per transaction"                                   color={cyan}   />
              <StatCard icon="bars"      label="Deposits (7d)"        value={fmt(s.deposits_7d_cents)}       sub="Revenue this week"                                 color={green}  />
              <StatCard icon="trendDown" label="Withdraw (7d)"     value={fmt(s.withdrawals_7d_cents)}    sub="Paid out this week"                                color={red}    />
            </div>

            {/* ══ Charts Row ══ */}
            <div className="chart-row" style={{ marginBottom:24 }}>
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
                  <h3 style={{ fontSize:13, fontWeight:700, color:red, margin:0, textTransform:'uppercase', letterSpacing:'.06em' }}>Withdraw — Last 7 Days</h3>
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
