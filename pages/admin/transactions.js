import { useEffect, useState } from 'react'
import Head from 'next/head'
import { supabase } from '../../lib/supabase'
import AdminLayout from '../../components/layout/AdminLayout'
import DateRange, { inDateRange } from '../../components/ui/DateRange'
import { CATEGORIES, categoryTypes, typeLabel, typeColor } from '../../lib/txMeta'

const fmt = c => {
  if (c === null || c === undefined) return '—'
  const abs = Math.abs(c)
  const str = '$' + (abs / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })
  return c < 0 ? '−' + str : '+' + str
}
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

export default function AdminTransactions() {
  const [rows, setRows] = useState([])
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [dates, setDates] = useState({ from: '', to: '' })
  const [loading, setLoading] = useState(true)

  // Fetch everything once (newest 500) and filter type/search/date on the
  // client. That is what lets the type tabs be driven by the real data.
  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setRows([]); return }

      const res = await fetch(`/api/admin/transactions/list?limit=500`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const d = await res.json()
      setRows(res.ok ? (d.rows || []) : [])
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  // Unified category tabs — same set and sequence used in the player wallet
  // modal and the player app (All, Deposits, Withdraws, Scores, Redeems,
  // Bonuses, Adjustments). Shared from lib/txMeta.
  const tabs = CATEGORIES

  const filtered = rows.filter(r => {
    if (filter !== 'all') {
      const types = categoryTypes(filter)
      if (types && !types.includes(r.type)) return false
    }
    if (!inDateRange(r.created_at, dates.from, dates.to)) return false
    if (!search) return true
    const s = search.toLowerCase()
    return r.profiles?.username?.toLowerCase().includes(s) || r.reference_id?.toLowerCase().includes(s)
  })

  return (
    <AdminLayout>
      <Head><title>Transactions — Admin</title></Head>

      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: "'Cinzel',serif", fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 4 }}>Transactions</h1>
        <p style={{ color: 'rgba(255,255,255,.35)', fontSize: 13 }}>Full ledger — append-only financial history</p>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,.04)', padding: 4, borderRadius: 10, flexWrap: 'wrap' }}>
          {tabs.map(c => (
            <button key={c.key} onClick={() => setFilter(c.key)} style={{ padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: "'Outfit',sans-serif", fontSize: 11, fontWeight: 700, background: filter === c.key ? 'rgba(251,191,36,.7)' : 'transparent', color: filter === c.key ? '#fff' : 'rgba(255,255,255,.4)', transition: 'all .15s', whiteSpace: 'nowrap' }}>{c.label}</button>
          ))}
        </div>
        <input type="text" placeholder="Search username or reference…" value={search} onChange={e => setSearch(e.target.value)}
          style={{ padding: '9px 14px', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, color: '#fff', fontSize: 13, fontFamily: "'Outfit',sans-serif", outline: 'none', minWidth: 240 }} />
        <DateRange from={dates.from} to={dates.to} onChange={setDates} />
      </div>

      <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,.04)' }}>
                {['Reference', 'Player', 'Type', 'Amount', 'Wallet', 'Balance After', 'Date'].map(h => (
                  <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 10, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.35)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,.3)' }}>Loading…</td></tr>
              : filtered.length === 0 ? <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,.3)' }}>No transactions found</td></tr>
              : filtered.map(r => {
                const color = typeColor(r.type)
                const isCredit = r.amount_cents >= 0
                return (
                  <tr key={r.id} style={{ borderTop: '1px solid rgba(255,255,255,.04)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.02)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '12px 14px' }}><span style={{ fontSize: 11, fontWeight: 800, color: '#fbbf24', fontFamily: 'monospace' }}>{r.reference_id || '—'}</span></td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', fontFamily: 'monospace' }}>{r.profiles?.username || r.profiles?.full_name}</div>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 9px', borderRadius: 99, background: color + '22', color, textTransform: 'uppercase', letterSpacing: '.05em', whiteSpace: 'nowrap' }}>{typeLabel(r.type)}</span>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 800, color: isCredit ? '#22c55e' : '#ef4444' }}>{fmt(r.amount_cents)}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 99, background: r.wallet_bucket === 'bonus' ? 'rgba(168,85,247,.15)' : 'rgba(255,255,255,.08)', color: r.wallet_bucket === 'bonus' ? '#a855f7' : 'rgba(255,255,255,.4)', textTransform: 'capitalize' }}>{r.wallet_bucket || 'cash'}</span>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: 'rgba(255,255,255,.5)', fontFamily: 'monospace' }}>{r.balance_after_cents != null ? '$' + (r.balance_after_cents / 100).toFixed(2) : '—'}</td>
                    <td style={{ padding: '12px 14px', fontSize: 11, color: 'rgba(255,255,255,.35)', whiteSpace: 'nowrap' }}>{fmtDate(r.created_at)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  )
}
