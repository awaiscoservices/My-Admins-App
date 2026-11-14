import { useEffect, useState } from 'react'
import Head from 'next/head'
import AdminLayout from '../../components/layout/AdminLayout'
import DateRange from '../../components/ui/DateRange'
import StatusBadge from '../../components/ui/StatusBadge'
import { supabase } from '../../lib/supabase'

const gold = '#fbbf24'

const REPORTS = [
  { id: 'overview',     label: 'Overview' },
  { id: 'deposits',     label: 'Deposits' },
  { id: 'withdrawals',  label: 'Withdraw' },
  { id: 'scores',       label: 'Scores' },
  { id: 'redeems',      label: 'Redeem' },
  { id: 'bonuses',      label: 'Bonuses' },
  { id: 'transactions', label: 'Transactions' },
  { id: 'players',      label: 'Players' },
]
const GROUPS = [
  { id: 'day',   label: 'Daily' },
  { id: 'week',  label: 'Weekly' },
  { id: 'month', label: 'Monthly' },
  { id: 'shift', label: 'By Shift' },
]
// The 3 operating shifts, in order, always shown even with zero activity.
const SHIFTS = ['Morning (12–8)', 'Evening (8–4)', 'Night (4–12)']
const SHIFT_COLORS = { 'Morning (12–8)': '#fbbf24', 'Evening (8–4)': '#22c55e', 'Night (4–12)': '#6366f1' }

const fmtMoney = c => '$' + ((c || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtNum   = n => Number(n || 0).toLocaleString()
const fmtDate  = d => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
const isoDay   = (d) => { const z = new Date(d); z.setMinutes(z.getMinutes() - z.getTimezoneOffset()); return z.toISOString().slice(0, 10) }
const pretty   = t => String(t || '—').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

// Bar chart (single series), amount or count.
function BarChart({ labels, data, display, color = gold, height = 180 }) {
  if (!data?.length) return <div style={{ height, display:'flex', alignItems:'center', justifyContent:'center', color:'rgba(255,255,255,.2)', fontSize:13 }}>No data</div>
  const max = Math.max(...data, 1)
  const step = Math.ceil(data.length / 10)
  return (
    <div>
      <div style={{ display:'flex', alignItems:'flex-end', gap: data.length > 40 ? 1 : 4, height }}>
        {data.map((v, i) => (
          <div key={i} style={{ flex:1, display:'flex', alignItems:'flex-end', height:'100%', minWidth:0 }}
            title={`${labels[i]}: ${display ? display[i] : v}`}>
            <div style={{ width:'100%', height:`${Math.max((v / max) * (height - 10), 2)}px`, background:`linear-gradient(to top,${color}dd,${color}55)`, borderRadius:'4px 4px 0 0', transition:'height .4s ease' }} />
          </div>
        ))}
      </div>
      <div style={{ display:'flex', marginTop:6 }}>
        {labels.map((l, i) => (
          <span key={i} style={{ flex:1, textAlign:'center', fontSize:9, color:'rgba(255,255,255,.3)', overflow:'hidden', whiteSpace:'nowrap', minWidth:0 }}>{i % step === 0 ? l : ''}</span>
        ))}
      </div>
    </div>
  )
}

// Multi-series line chart (overview).
function LineChart({ labels, datasets, height = 200, fmtVal = v => v }) {
  const all = datasets.flatMap(s => s.data)
  if (!all.length) return <div style={{ height, display:'flex', alignItems:'center', justifyContent:'center', color:'rgba(255,255,255,.2)', fontSize:13 }}>No data</div>
  const max = Math.max(...all, 1), min = Math.min(...all, 0), range = max - min || 1
  const w = 100, h = height, n = labels.length, step = Math.ceil(n / 10)
  const pts = vals => vals.map((v, i) => `${n === 1 ? 0 : (i / (n - 1)) * w},${h - ((v - min) / range) * (h - 10) - 5}`).join(' ')
  const zeroY = h - ((0 - min) / range) * (h - 10) - 5
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width:'100%', height }}>
        <line x1="0" y1={zeroY} x2={w} y2={zeroY} stroke="rgba(255,255,255,.12)" strokeWidth="0.5" />
        {datasets.map((s, i) => (
          <polyline key={i} points={pts(s.data)} fill="none" stroke={s.color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      <div style={{ display:'flex', marginTop:6 }}>
        {labels.map((l, i) => <span key={i} style={{ flex:1, textAlign:'center', fontSize:9, color:'rgba(255,255,255,.3)', overflow:'hidden', whiteSpace:'nowrap', minWidth:0 }}>{i % step === 0 ? l : ''}</span>)}
      </div>
      <div style={{ display:'flex', gap:16, marginTop:10, flexWrap:'wrap' }}>
        {datasets.map((s, i) => (
          <span key={i} style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:'rgba(255,255,255,.55)' }}>
            <span style={{ width:10, height:3, borderRadius:2, background:s.color }} /> {s.label}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function AdminReports() {
  const [report, setReport] = useState('overview')
  const [group, setGroup]   = useState('day')
  const [metric, setMetric] = useState('amount') // amount | count (bar reports)
  const [dates, setDates]   = useState(() => {
    const to = new Date(); const from = new Date(); from.setDate(to.getDate() - 29)
    return { from: isoDay(from), to: isoDay(to) }
  })
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [report, group, dates])

  async function load() {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setData(null); setLoading(false); return }
      const params = new URLSearchParams({ report, group_by: group })
      if (dates.from) params.set('from', dates.from)
      if (dates.to)   params.set('to', dates.to)
      const res = await fetch(`/api/admin/reports?${params}`, { headers: { Authorization: `Bearer ${session.access_token}` } })
      const d = await res.json()
      setData(res.ok ? d : null)
    } catch { setData(null) }
    setLoading(false)
  }

  const d = data || {}
  const cols = d.columns || []
  const rows = d.rows || []

  function cellValue(row, col) {
    const v = row[col.key]
    if (col.type === 'money') return fmtMoney(v)
    if (col.type === 'date')  return fmtDate(v)
    if (col.type === 'badge') return pretty(v)
    return v ?? '—'
  }

  function exportCsv() {
    if (!rows.length) return
    const header = cols.map(c => c.label)
    const lines = rows.map(r => cols.map(c => {
      const raw = cellValue(r, c)
      return `"${String(raw).replace(/"/g, '""')}"`
    }).join(','))
    const csv = [header.join(','), ...lines].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${report}-${dates.from}_to_${dates.to}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const inputStyle = { padding:'9px 12px', background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.14)', borderRadius:10, color:'#fff', fontSize:13, fontFamily:"'Outfit',sans-serif", outline:'none', colorScheme:'dark', cursor:'pointer' }

  const chart = d.chart
  const bkTotal = (d.breakdown?.items || []).reduce((s, x) => s + (x.amount_cents || 0), 0)

  return (
    <AdminLayout>
      <Head><title>Reports — Admin</title></Head>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        .kpi-grid { display:grid; grid-template-columns:repeat(6,1fr); gap:14px; }
        @media (max-width:1100px){ .kpi-grid{ grid-template-columns:repeat(3,1fr); } }
        @media (max-width:620px){ .kpi-grid{ grid-template-columns:repeat(2,1fr); } }
        .rep-row { display:grid; grid-template-columns:2fr 1fr; gap:20px; }
        @media (max-width:900px){ .rep-row{ grid-template-columns:1fr; } }
      `}</style>

      <div style={{ fontFamily:"'Outfit',sans-serif", color:'#fff' }}>
        <div style={{ marginBottom:18 }}>
          <h1 style={{ fontFamily:"'Cinzel',serif", fontSize:24, fontWeight:800, color:gold, margin:0 }}>Reports</h1>
          <p style={{ fontSize:13, color:'rgba(255,255,255,.4)', marginTop:4 }}>Detailed, filterable data analysis · {dates.from} → {dates.to || 'now'}</p>
        </div>

        {/* ── Report switcher ── */}
        <div style={{ display:'flex', gap:4, background:'rgba(255,255,255,.04)', padding:4, borderRadius:12, flexWrap:'wrap', marginBottom:14 }}>
          {REPORTS.map(r => (
            <button key={r.id} onClick={() => setReport(r.id)} style={{ padding:'8px 16px', borderRadius:8, border:'none', cursor:'pointer', fontFamily:'inherit', fontSize:12.5, fontWeight:700, background: report===r.id ? 'rgba(251,191,36,.75)' : 'transparent', color: report===r.id ? '#111' : 'rgba(255,255,255,.5)', transition:'all .15s' }}>{r.label}</button>
          ))}
        </div>

        {/* ── Filters ── */}
        <div style={{ display:'flex', gap:12, marginBottom:22, flexWrap:'wrap', alignItems:'center' }}>
          <DateRange from={dates.from} to={dates.to} onChange={setDates} />
          <select value={group} onChange={e => setGroup(e.target.value)} style={inputStyle}>
            {GROUPS.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
          </select>
          <button onClick={exportCsv} disabled={!rows.length}
            style={{ marginLeft:'auto', padding:'9px 18px', background: rows.length ? 'rgba(34,197,94,.14)' : 'rgba(255,255,255,.04)', border:'1px solid '+(rows.length ? 'rgba(34,197,94,.4)' : 'rgba(255,255,255,.1)'), borderRadius:10, color: rows.length ? '#22c55e' : 'rgba(255,255,255,.3)', fontSize:13, fontWeight:700, cursor: rows.length ? 'pointer' : 'not-allowed', fontFamily:'inherit' }}>
            ↓ Export CSV
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign:'center', padding:'80px 0', color:'rgba(255,255,255,.3)' }}>
            <div style={{ width:34, height:34, border:'3px solid rgba(251,191,36,.2)', borderTopColor:gold, borderRadius:'50%', animation:'spin .8s linear infinite', margin:'0 auto 16px' }} />
            Building report…
          </div>
        ) : !data ? (
          <div style={{ textAlign:'center', padding:'60px 0', color:'rgba(255,255,255,.3)' }}>Could not load this report.</div>
        ) : (
          <>
            {/* ── KPIs ── */}
            <div className="kpi-grid" style={{ marginBottom:22 }}>
              {(d.kpis || []).map((k, i) => (
                <div key={i} style={{ background:'rgba(255,255,255,.03)', border:'1px solid rgba(255,255,255,.08)', borderRadius:14, padding:'16px 18px' }}>
                  <div style={{ fontSize:10.5, fontWeight:800, letterSpacing:'.08em', textTransform:'uppercase', color:'rgba(255,255,255,.45)' }}>{k.label}</div>
                  <div style={{ fontSize:22, fontWeight:800, color:gold, marginTop:8 }}>{k.money ? fmtMoney(k.value) : fmtNum(k.value)}</div>
                </div>
              ))}
            </div>

            {/* ── Chart + breakdown ── */}
            <div className="rep-row" style={{ marginBottom:22 }}>
              <div style={{ background:'rgba(255,255,255,.025)', border:'1px solid rgba(255,255,255,.07)', borderRadius:16, padding:'20px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
                  <h3 style={{ fontSize:13, fontWeight:700, color:gold, margin:0, textTransform:'uppercase', letterSpacing:'.06em' }}>
                    {REPORTS.find(r => r.id === report)?.label} · {GROUPS.find(g => g.id === group)?.label}
                  </h3>
                  {chart?.type === 'bar' && (
                    <div style={{ display:'flex', gap:4, background:'rgba(255,255,255,.05)', padding:3, borderRadius:8 }}>
                      {['amount','count'].map(m => (
                        <button key={m} onClick={() => setMetric(m)} style={{ padding:'5px 12px', borderRadius:6, border:'none', cursor:'pointer', fontFamily:'inherit', fontSize:11, fontWeight:700, background: metric===m ? 'rgba(251,191,36,.6)' : 'transparent', color: metric===m ? '#111' : 'rgba(255,255,255,.5)', textTransform:'capitalize' }}>{m}</button>
                      ))}
                    </div>
                  )}
                </div>
                {chart?.type === 'line' ? (
                  <LineChart labels={chart.labels} datasets={chart.datasets} />
                ) : chart ? (
                  <BarChart
                    labels={chart.labels}
                    data={metric === 'count' ? (chart.counts || []) : (chart.datasets?.[0]?.data || [])}
                    display={metric === 'count' ? null : (chart.datasets?.[0]?.data || []).map(fmtMoney)}
                  />
                ) : null}
              </div>

              <div style={{ background:'rgba(255,255,255,.025)', border:'1px solid rgba(255,255,255,.07)', borderRadius:16, padding:'20px' }}>
                <h3 style={{ fontSize:13, fontWeight:700, color:'#a855f7', margin:'0 0 16px', textTransform:'uppercase', letterSpacing:'.06em' }}>By {pretty(d.breakdown?.dimension)}</h3>
                {(d.breakdown?.items || []).length === 0 ? (
                  <div style={{ color:'rgba(255,255,255,.3)', fontSize:13 }}>No data</div>
                ) : (d.breakdown.items).map((it, i) => {
                  const pct = bkTotal ? Math.round((it.amount_cents / bkTotal) * 100) : 0
                  return (
                    <div key={i} style={{ marginBottom:12 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4 }}>
                        <span style={{ color:'rgba(255,255,255,.7)', textTransform:'capitalize' }}>{pretty(it.key)} <span style={{ color:'rgba(255,255,255,.3)' }}>({fmtNum(it.count)})</span></span>
                        <span style={{ color:'#fff', fontWeight:700 }}>{fmtMoney(it.amount_cents)}</span>
                      </div>
                      <div style={{ height:6, background:'rgba(255,255,255,.06)', borderRadius:99, overflow:'hidden' }}>
                        <div style={{ width:`${pct}%`, height:'100%', background:'linear-gradient(90deg,#a855f7,#fbbf24)', borderRadius:99 }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* ── By Shift ── */}
            {d.shift_breakdown && (
              <div style={{ background:'rgba(255,255,255,.025)', border:'1px solid rgba(255,255,255,.07)', borderRadius:16, padding:'20px', marginBottom:22 }}>
                <h3 style={{ fontSize:13, fontWeight:700, color:gold, margin:'0 0 16px', textTransform:'uppercase', letterSpacing:'.06em' }}>By Shift</h3>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14 }}>
                  {SHIFTS.map(label => {
                    const it = (d.shift_breakdown.items || []).find(x => x.key === label) || { count: 0, amount_cents: 0 }
                    const c = SHIFT_COLORS[label] || gold
                    return (
                      <div key={label} style={{ background:'rgba(255,255,255,.03)', border:`1px solid ${c}33`, borderRadius:14, padding:'16px 18px' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                          <span style={{ width:9, height:9, borderRadius:'50%', background:c }} />
                          <span style={{ fontSize:11.5, fontWeight:800, letterSpacing:'.05em', textTransform:'uppercase', color:'rgba(255,255,255,.7)' }}>{label}</span>
                        </div>
                        <div style={{ fontSize:22, fontWeight:800, color:c }}>{fmtMoney(it.amount_cents)}</div>
                        <div style={{ fontSize:12, color:'rgba(255,255,255,.4)', marginTop:4 }}>{fmtNum(it.count)} records</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── Detailed table ── */}
            {cols.length > 0 && (
              <div style={{ background:'rgba(255,255,255,.025)', border:'1px solid rgba(255,255,255,.07)', borderRadius:16, overflow:'hidden' }}>
                <div style={{ padding:'14px 20px', borderBottom:'1px solid rgba(255,255,255,.07)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <h3 style={{ fontSize:13, fontWeight:700, color:gold, margin:0, textTransform:'uppercase', letterSpacing:'.06em' }}>Detail</h3>
                  <span style={{ fontSize:11, color:'rgba(255,255,255,.3)' }}>{fmtNum(d.total_count)} rows{d.total_count > rows.length ? ` · showing ${fmtNum(rows.length)}` : ''}</span>
                </div>
                <div style={{ overflowX:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                    <thead>
                      <tr style={{ background:'rgba(255,255,255,.03)' }}>
                        {cols.map(c => (
                          <th key={c.key} style={{ padding:'10px 16px', textAlign:'left', color:'rgba(255,255,255,.4)', fontWeight:700, fontSize:10, textTransform:'uppercase', letterSpacing:'.08em', whiteSpace:'nowrap' }}>{c.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.length === 0 ? (
                        <tr><td colSpan={cols.length} style={{ padding:'32px', textAlign:'center', color:'rgba(255,255,255,.2)' }}>No rows in this range</td></tr>
                      ) : rows.map((r, i) => (
                        <tr key={i} style={{ borderTop:'1px solid rgba(255,255,255,.04)' }}
                          onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,.02)'}
                          onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                          {cols.map(c => (
                            <td key={c.key} style={{ padding:'10px 16px', whiteSpace:'nowrap',
                              color: c.type==='money' ? '#fff' : 'rgba(255,255,255,.6)',
                              fontWeight: c.type==='money' ? 700 : 400,
                              fontFamily: c.type==='ref' ? 'monospace' : 'inherit' }}>
                              {c.type === 'badge'
                                ? <StatusBadge status={r[c.key] || '—'} size="xs" />
                                : c.type === 'ref'
                                  ? <span style={{ color:gold, fontSize:11, fontWeight:800 }}>{r[c.key] || '—'}</span>
                                  : cellValue(r, c)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  )
}
