import { useEffect, useState } from 'react'
import Head from 'next/head'
import { supabase } from '../../lib/supabase'
import AdminLayout from '../../components/layout/AdminLayout'
import DateRange, { inDateRange } from '../../components/ui/DateRange'

const fmt = c => {
  if (c === null || c === undefined) return '—'
  const abs = Math.abs(c)
  const str = '$' + (abs / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })
  return c < 0 ? '−' + str : '+' + str
}
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

/**
 * Known ledger types → how they show (label + colour). Every entry the ledger
 * can hold lives here, so adding a wallet entry type means adding one line.
 *
 * The filter tabs are NOT hardcoded from this map, though — they are built
 * from the types actually present in the data (see `typesInData` below), so a
 * brand-new type still appears in the filter the moment it hits the ledger,
 * even before it is listed here (it just shows greyed with a prettified name).
 */
const TYPE_META = {
  deposit:          { label: 'Deposit',        color: '#22c55e' },
  deposit_bonus:    { label: 'Deposit Bonus',  color: '#fbbf24' },
  bonus:            { label: 'Bonus',          color: '#fbbf24' },
  referral_bonus:   { label: 'Referral Bonus', color: '#a855f7' },
  withdrawal:       { label: 'Withdraw',       color: '#ef4444' },
  withdrawal_refund:{ label: 'Withdraw Refund',color: '#06b6d4' },
  game_load:        { label: 'Score',          color: '#ef4444' },
  game_load_refund: { label: 'Score Refund',   color: '#06b6d4' },
  redeem:           { label: 'Redeem',         color: '#22c55e' },
  redemption:       { label: 'Redeem',         color: '#22c55e' },
  spin_bet:         { label: 'Spin Bet',       color: '#f97316' },
  spin_win:         { label: 'Spin Win',       color: '#fbbf24' },
  adjustment:       { label: 'Adjustment',     color: '#a855f7' },
  adjustment_credit:{ label: 'Adj. Credit',    color: '#a855f7' },
  adjustment_debit: { label: 'Adj. Debit',     color: '#f97316' },
  refund:           { label: 'Refund',         color: '#06b6d4' },
}

// Prettify an unknown type: "some_new_type" → "Some New Type".
const prettify = t => (t || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
const typeLabel = t => TYPE_META[t]?.label || prettify(t) || '—'
const typeColor = t => TYPE_META[t]?.color || 'rgba(255,255,255,.5)'

// Order the tabs: known types first in a sensible order, then anything else
// alphabetically. New types land at the end instead of disappearing.
const TYPE_ORDER = [
  'deposit', 'deposit_bonus', 'bonus', 'referral_bonus',
  'withdrawal', 'withdrawal_refund', 'game_load', 'game_load_refund',
  'redeem', 'spin_bet', 'spin_win',
  'adjustment', 'adjustment_credit', 'adjustment_debit', 'refund',
]
function orderTypes(types) {
  return [...types].sort((a, b) => {
    const ia = TYPE_ORDER.indexOf(a), ib = TYPE_ORDER.indexOf(b)
    if (ia !== -1 && ib !== -1) return ia - ib
    if (ia !== -1) return -1
    if (ib !== -1) return 1
    return a.localeCompare(b)
  })
}

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

  // Every type present in the data → the tabs. Any new ledger type appears
  // here automatically; nothing to update per type.
  const typesInData = orderTypes(Array.from(new Set(rows.map(r => r.type).filter(Boolean))))
  const tabs = ['all', ...typesInData]

  const filtered = rows.filter(r => {
    if (filter !== 'all' && r.type !== filter) return false
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
          {tabs.map(s => (
            <button key={s} onClick={() => setFilter(s)} style={{ padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: "'Outfit',sans-serif", fontSize: 11, fontWeight: 700, background: filter === s ? 'rgba(251,191,36,.7)' : 'transparent', color: filter === s ? '#fff' : 'rgba(255,255,255,.4)', transition: 'all .15s', whiteSpace: 'nowrap' }}>{s === 'all' ? 'All' : typeLabel(s)}</button>
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
                {['Reference', 'Player', 'Type', 'Amount', 'Bucket', 'Balance After', 'Date'].map(h => (
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
