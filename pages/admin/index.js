import { useState, useEffect } from 'react'
import Head from 'next/head'
import AdminLayout from '../../components/layout/AdminLayout'
import DateRange from '../../components/ui/DateRange'
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
  pie:        'M21.2 15.9A10 10 0 118.1 2.8M22 12A10 10 0 0012 2v10z',
  line:       'M3 3v18h18M7 14l4-4 3 3 5-6',
}

function Icon({ name, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, display: 'block' }}>
      <path d={ICONS[name] || ICONS.bars} />
    </svg>
  )
}

function StatCard({ label, value, sub, color = gold, icon, live }) {
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
      minHeight: 132,
    }}>
      <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:`linear-gradient(90deg,${color}00,${color}80,${color}00)`, borderRadius:'16px 16px 0 0' }} />
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
        <span style={{
          width:38, height:38, borderRadius:11, flexShrink:0,
          background:`${color}1a`, border:`1px solid ${color}40`, color,
          display:'flex', alignItems:'center', justifyContent:'center',
        }}>
          <Icon name={icon} size={18} />
        </span>
        <span style={{ fontSize:11.5, fontWeight:800, letterSpacing:'.1em', textTransform:'uppercase', color:'rgba(255,255,255,.75)', lineHeight:1.3 }}>{label}</span>
        {live && <span title="Live — not affected by the date filter" style={{ marginLeft:'auto', fontSize:8.5, fontWeight:800, letterSpacing:'.08em', color:'rgba(255,255,255,.4)', border:'1px solid rgba(255,255,255,.14)', borderRadius:99, padding:'2px 6px' }}>LIVE</span>}
      </div>
      <div style={{ fontSize:30, fontWeight:800, color, fontFamily:"'Outfit',sans-serif", letterSpacing:'-.5px' }}>{value}</div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:'auto', paddingTop:8 }}>
        {sub && <div style={{ fontSize:12, color:'rgba(255,255,255,.35)' }}>{sub}</div>}
      </div>
    </div>
  )
}

function BarChart({ data, color = gold, height = 120 }) {
  if (!data?.length) return (
    <div style={{ height, display:'flex', alignItems:'center', justifyContent:'center', color:'rgba(255,255,255,.2)', fontSize:13 }}>No data</div>
  )
  const max = Math.max(...data.map(d => d.value), 1)
  // With long ranges there are too many day-labels to read; show about 8.
  const step = Math.ceil(data.length / 8)
  return (
    <div style={{ display:'flex', alignItems:'flex-end', gap: data.length > 40 ? 1 : 4, height, padding:'0 2px' }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3, height:'100%', justifyContent:'flex-end', minWidth:0 }}>
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
          <span style={{ fontSize:9, color:'rgba(255,255,255,.3)', whiteSpace:'nowrap', overflow:'hidden', maxWidth:'100%', textAlign:'center', height:12 }}>
            {i % step === 0 ? d.label : ''}
          </span>
        </div>
      ))}
    </div>
  )
}

// Multi-series line chart over the range (deposits, withdrawals, net).
function LineChart({ series, labels, height = 180, fmtVal = v => v }) {
  const all = series.flatMap(s => s.values)
  if (!all.length) return <div style={{ height, display:'flex', alignItems:'center', justifyContent:'center', color:'rgba(255,255,255,.2)', fontSize:13 }}>No data</div>
  const max = Math.max(...all, 1)
  const min = Math.min(...all, 0)
  const range = max - min || 1
  const w = 100, h = height
  const n = labels.length
  const step = Math.ceil(n / 8)
  const toPts = (vals) => vals.map((v, i) => {
    const x = n === 1 ? 0 : (i / (n - 1)) * w
    const y = h - ((v - min) / range) * (h - 10) - 5
    return `${x},${y}`
  }).join(' ')
  // y where value 0 sits, for a baseline
  const zeroY = h - ((0 - min) / range) * (h - 10) - 5
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width:'100%', height }}>
        <line x1="0" y1={zeroY} x2={w} y2={zeroY} stroke="rgba(255,255,255,.12)" strokeWidth="0.5" />
        {series.map((s, si) => (
          <g key={si}>
            <polyline points={toPts(s.values)} fill="none" stroke={s.color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </g>
        ))}
      </svg>
      <div style={{ display:'flex', justifyContent:'space-between', marginTop:6 }}>
        {labels.map((l, i) => (
          <span key={i} style={{ fontSize:9, color:'rgba(255,255,255,.3)', flex:1, textAlign:'center', overflow:'hidden', whiteSpace:'nowrap' }}>{i % step === 0 ? l : ''}</span>
        ))}
      </div>
      <div style={{ display:'flex', gap:16, marginTop:10, flexWrap:'wrap' }}>
        {series.map((s, i) => (
          <span key={i} style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:'rgba(255,255,255,.55)' }}>
            <span style={{ width:10, height:3, borderRadius:2, background:s.color }} /> {s.label}
          </span>
        ))}
      </div>
    </div>
  )
}

// Donut / pie. segments: [{ label, value, color }]
function Donut({ segments, size = 160, thickness = 26, centerLabel, centerSub }) {
  const total = segments.reduce((s, x) => s + x.value, 0)
  const r = (size - thickness) / 2
  const C = 2 * Math.PI * r
  let offset = 0
  return (
    <div style={{ display:'flex', alignItems:'center', gap:22, flexWrap:'wrap' }}>
      <div style={{ position:'relative', width:size, height:size, flexShrink:0 }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
            {total === 0 ? (
              <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth={thickness} />
            ) : segments.map((s, i) => {
              const len = (s.value / total) * C
              const el = (
                <circle key={i} cx={size/2} cy={size/2} r={r} fill="none" stroke={s.color} strokeWidth={thickness}
                  strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset}
                  style={{ transition:'stroke-dasharray .4s ease' }} />
              )
              offset += len
              return el
            })}
          </g>
        </svg>
        <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', textAlign:'center' }}>
          {centerLabel && <div style={{ fontSize:17, fontWeight:800, color:'#fff' }}>{centerLabel}</div>}
          {centerSub && <div style={{ fontSize:10, color:'rgba(255,255,255,.4)', marginTop:2 }}>{centerSub}</div>}
        </div>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:8, minWidth:120 }}>
        {segments.map((s, i) => {
          const pct = total ? Math.round((s.value / total) * 100) : 0
          return (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:8, fontSize:12 }}>
              <span style={{ width:10, height:10, borderRadius:3, background:s.color, flexShrink:0 }} />
              <span style={{ color:'rgba(255,255,255,.6)', flex:1 }}>{s.label}</span>
              <span style={{ color:'#fff', fontWeight:700 }}>{s.display != null ? s.display : s.value}</span>
              <span style={{ color:'rgba(255,255,255,.3)', width:34, textAlign:'right' }}>{pct}%</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Panel({ title, color = gold, icon, right, children }) {
  return (
    <div style={{ background:'rgba(255,255,255,.025)', border:'1px solid rgba(255,255,255,.07)', borderRadius:16, padding:'20px 20px 16px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <h3 style={{ fontSize:13, fontWeight:700, color, margin:0, textTransform:'uppercase', letterSpacing:'.06em', display:'flex', alignItems:'center', gap:8 }}>
          {icon && <Icon name={icon} size={15} />}{title}
        </h3>
        {right}
      </div>
      {children}
    </div>
  )
}

function fmt(cents) {
  return `$${((cents || 0) / 100).toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 })}`
}
function fmtShort(cents) {
  const v = (cents || 0) / 100
  if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(1)}k`
  return `$${v.toFixed(0)}`
}
function fmtNum(n) { return Number(n || 0).toLocaleString() }

// Local 'YYYY-MM-DD' (no UTC shift), matching the DateRange control.
const isoDay = (d) => { const z = new Date(d); z.setMinutes(z.getMinutes() - z.getTimezoneOffset()); return z.toISOString().slice(0, 10) }

export default function AdminDashboard() {
  const [stats,   setStats]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [dates,   setDates]   = useState(() => {
    const to = new Date(); const from = new Date(); from.setDate(to.getDate() - 29)
    return { from: isoDay(from), to: isoDay(to) }
  })

  useEffect(() => { fetchStats() }, [dates])

  async function fetchStats() {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) { setLoading(false); return }
    try {
      const params = new URLSearchParams()
      if (dates.from) params.set('from', dates.from)
      if (dates.to)   params.set('to', dates.to)
      const res = await fetch(`/api/admin/analytics?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) setStats(await res.json())
    } catch (e) { console.error('Analytics fetch error', e) }
    setLoading(false)
  }

  const s = stats || {}

  // ── derived ──
  const totalRevenue = (s.total_deposits_cents || 0) - (s.total_withdrawals_cents || 0)
  const avgDeposit   = s.deposits_count ? Math.round((s.total_deposits_cents || 0) / s.deposits_count) : 0
  const avgWithdraw  = s.withdrawals_count ? Math.round((s.total_withdrawals_cents || 0) / s.withdrawals_count) : 0
  const approvalRate = s.deposits_count
    ? Math.round(((s.deposits_count) / (s.deposits_count + (s.pending_deposits || 0))) * 100)
    : 0

  const depDays = s.deposits_by_day || []
  const wdDays  = s.withdrawals_by_day || []
  const labels  = depDays.map(d => d.label)
  const netDays = depDays.map((d, i) => (d.value || 0) - (wdDays[i]?.value || 0))

  const rangeLabel = `${dates.from || '—'} → ${dates.to || 'now'}`

  return (
    <AdminLayout>
      <Head><title>Dashboard — Casinoze Admin</title></Head>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        .stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
        @media (max-width: 1180px) { .stat-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 620px)  { .stat-grid { grid-template-columns: 1fr; } }
        .chart-row { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        @media (max-width: 900px) { .chart-row { grid-template-columns: 1fr; } }
      `}</style>

      <div style={{ fontFamily:"'Outfit',sans-serif", color:'#fff' }}>

        {/* ── Header + the one date filter that drives everything ── */}
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:22, flexWrap:'wrap', gap:14 }}>
          <div>
            <h1 style={{ fontSize:24, fontWeight:800, color:gold, margin:0, fontFamily:"'Cinzel',serif" }}>Platform Overview</h1>
            <p style={{ fontSize:13, color:'rgba(255,255,255,.4)', marginTop:4 }}>
              Showing {rangeLabel}
            </p>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
            <DateRange from={dates.from} to={dates.to} onChange={setDates} />
            <button onClick={fetchStats} style={{ padding:'9px 18px', background:'rgba(251,191,36,.1)', border:'1px solid rgba(251,191,36,.35)', borderRadius:10, color:gold, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:7 }}>
              <Icon name="refresh" size={14} /> Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign:'center', padding:'80px 0', color:'rgba(255,255,255,.3)', fontSize:14 }}>
            <div style={{ width:34, height:34, border:`3px solid rgba(251,191,36,.2)`, borderTopColor:gold, borderRadius:'50%', animation:'spin .8s linear infinite', margin:'0 auto 16px' }} />
            Loading analytics…
          </div>
        ) : (
          <>
            {/* ══ Stat cards — all follow the date filter, except the LIVE queues ══ */}
            <div className="stat-grid" style={{ marginBottom:28 }}>
              {/* Money & volume in range */}
              <StatCard icon="dollar"   label="Deposits"         value={fmt(s.total_deposits_cents)}    sub={`${fmtNum(s.deposits_count)} in range`}        color={green}  />
              <StatCard icon="upload"   label="Withdrawals"      value={fmt(s.total_withdrawals_cents)} sub={`${fmtNum(s.withdrawals_count)} in range`}     color={red}    />
              <StatCard icon="trendUp"  label="Net Revenue"      value={fmt(totalRevenue)}              sub="Deposits minus withdrawals"                   color={gold}   />
              <StatCard icon="userPlus" label="New Players"      value={fmtNum(s.new_players_range)}    sub="Registered in range"                          color={blue}   />

              <StatCard icon="card"     label="Avg Deposit"      value={fmt(avgDeposit)}                sub="Per transaction"                              color={cyan}   />
              <StatCard icon="bars"     label="Avg Withdrawal"   value={fmt(avgWithdraw)}               sub="Per transaction"                              color={orange} />
              <StatCard icon="trophy"   label="Score Loads"      value={fmtNum(s.game_loads_range)}     sub="In range"                                     color={gold}   />
              <StatCard icon="gift"     label="Redemptions"      value={fmtNum(s.redemptions_range)}    sub="In range"                                     color={pink}   />

              {/* Live queues — current state, not date-bound */}
              <StatCard icon="users"    label="Total Players"      value={fmtNum(s.total_players)}        sub="All time"                     color={blue}   live />
              <StatCard icon="clock"    label="Pending Deposits"   value={fmtNum(s.pending_deposits)}     sub="Awaiting approval"            color={orange} live />
              <StatCard icon="clock"    label="Pending Withdraw"   value={fmtNum(s.pending_withdrawals)}  sub="Awaiting approval"            color={orange} live />
              <StatCard icon="id"       label="KYC Pending"        value={fmtNum(s.pending_kyc)}          sub="Needs review"                 color={pink}   live />

              <StatCard icon="gamepad"  label="Active Game Accts"  value={fmtNum(s.active_game_accounts)} sub={`${fmtNum(s.pending_game_accounts)} pending setup`} color={purple} live />
              <StatCard icon="clock"    label="Pending Scores"     value={fmtNum(s.pending_game_loads)}   sub="Awaiting"                     color={gold}   live />
              <StatCard icon="clock"    label="Pending Redeems"    value={fmtNum(s.pending_redemptions)}  sub="Awaiting"                     color={pink}   live />
              <StatCard icon="ticket"   label="Open Tickets"       value={fmtNum(s.open_tickets)}         sub="Support queue"                color={cyan}   live />
            </div>

            {/* ══ Cash-flow trend (line) + split (donut) ══ */}
            <div className="chart-row" style={{ marginBottom:20 }}>
              <Panel title="Cash Flow Trend" color={gold} icon="line"
                right={<span style={{ fontSize:13, fontWeight:800, color: totalRevenue >= 0 ? green : red }}>{fmt(totalRevenue)} net</span>}>
                <LineChart
                  height={190}
                  labels={labels}
                  series={[
                    { label:'Deposits',    color:green, values: depDays.map(d => d.value) },
                    { label:'Withdrawals', color:red,   values: wdDays.map(d => d.value) },
                    { label:'Net',         color:gold,  values: netDays },
                  ]}
                />
              </Panel>

              <Panel title="Deposits vs Withdrawals" color={cyan} icon="pie">
                <Donut
                  size={150} thickness={24}
                  centerLabel={fmtShort((s.total_deposits_cents || 0) + (s.total_withdrawals_cents || 0))}
                  centerSub="total flow"
                  segments={[
                    { label:'Deposits',    value: s.total_deposits_cents || 0,    color:green, display: fmt(s.total_deposits_cents) },
                    { label:'Withdrawals', value: s.total_withdrawals_cents || 0, color:red,   display: fmt(s.total_withdrawals_cents) },
                  ]}
                />
              </Panel>
            </div>

            {/* ══ Daily bars ══ */}
            <div className="chart-row" style={{ marginBottom:20 }}>
              <Panel title="Deposits by Day" color={green}
                right={<span style={{ fontSize:18, fontWeight:800, color:green }}>{fmt(s.total_deposits_cents)}</span>}>
                <BarChart color={green} height={120}
                  data={depDays.map(d => ({ ...d, display: fmt(d.value) }))} />
              </Panel>
              <Panel title="Withdrawals by Day" color={red}
                right={<span style={{ fontSize:18, fontWeight:800, color:red }}>{fmt(s.total_withdrawals_cents)}</span>}>
                <BarChart color={red} height={120}
                  data={wdDays.map(d => ({ ...d, display: fmt(d.value) }))} />
              </Panel>
            </div>

            {/* ══ Signups bars + pending-queue donut ══ */}
            <div className="chart-row" style={{ marginBottom:24 }}>
              <Panel title="New Players by Day" color={blue}
                right={<span style={{ fontSize:18, fontWeight:800, color:blue }}>{fmtNum(s.new_players_range)}</span>}>
                <BarChart color={blue} height={120}
                  data={(s.signups_by_day || []).map(d => ({ ...d, display: `${d.value}` }))} />
              </Panel>

              <Panel title="Pending Queues" color={orange} icon="pie"
                right={<span style={{ fontSize:9, fontWeight:800, letterSpacing:'.08em', color:'rgba(255,255,255,.4)', border:'1px solid rgba(255,255,255,.14)', borderRadius:99, padding:'2px 6px' }}>LIVE</span>}>
                <Donut
                  size={150} thickness={24}
                  centerLabel={fmtNum((s.pending_deposits||0)+(s.pending_withdrawals||0)+(s.pending_kyc||0)+(s.pending_game_loads||0)+(s.pending_redemptions||0))}
                  centerSub="awaiting"
                  segments={[
                    { label:'Deposits',    value: s.pending_deposits || 0,    color:green  },
                    { label:'Withdrawals', value: s.pending_withdrawals || 0, color:red    },
                    { label:'KYC',         value: s.pending_kyc || 0,         color:pink   },
                    { label:'Scores',      value: s.pending_game_loads || 0,  color:gold   },
                    { label:'Redeems',     value: s.pending_redemptions || 0, color:purple },
                  ]}
                />
              </Panel>
            </div>

            {/* ══ Recent Transactions ══ */}
            <div style={{ background:'rgba(255,255,255,.025)', border:'1px solid rgba(255,255,255,.07)', borderRadius:16, overflow:'hidden' }}>
              <div style={{ padding:'16px 22px', borderBottom:'1px solid rgba(255,255,255,.07)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <h3 style={{ fontSize:13, fontWeight:700, color:gold, margin:0, textTransform:'uppercase', letterSpacing:'.06em' }}>Recent Transactions</h3>
                <span style={{ fontSize:11, color:'rgba(255,255,255,.3)' }}>Latest 20 in range</span>
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
                      <tr><td colSpan={6} style={{ padding:'32px', textAlign:'center', color:'rgba(255,255,255,.2)', fontSize:13 }}>No transactions in this range</td></tr>
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
