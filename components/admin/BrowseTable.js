import { useEffect, useState, useCallback } from 'react'
import Head from 'next/head'
import { adminFetch } from '../../lib/adminFetch'
import AdminLayout from '../layout/AdminLayout'
import StatusBadge from '../ui/StatusBadge'
import { centsToDisplay as m } from '../ui/MoneyDisplay'
import { txTypeLabel } from '../../lib/wallet'

const G = '#fbbf24'
const dim = { color: 'rgba(255,255,255,.4)', fontSize: 12 }
const when = r => new Date(r.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const who = (p, id) => p ? <div><div style={{ fontWeight: 700 }}>{p.name || 'Unnamed'}</div></div> : <span style={dim}>{id ? String(id).slice(0, 8) : '—'}</span>
const signed = (c, dir) => <span style={{ fontWeight: 800, color: dir === 'credit' ? '#10b981' : '#f87171' }}>{dir === 'credit' ? '+' : '−'}{m(c)}</span>
const money = k => r => m(r[k] || 0)

const VIEWS = {
  wallets: { title: 'Wallets', sub: 'Every player’s balances, richest first. Adjust a wallet from the player’s page.', search: 'Search player name or email…', cols: [
    ['Player', r => who(r._player, r.user_id)], ['Cash', money('cash_balance_cents')], ['Bonus', money('bonus_balance_cents')], ['Reserved', money('reserved_cents')], ['Withdrawable', money('withdrawable_cents')],
    ['Deposited', money('total_deposited_cents')], ['Loaded', money('total_loaded_cents')], ['Redeemed', money('total_redeemed_cents')], ['Withdrawn', money('total_withdrawn_cents')]] },
  transactions: { title: 'Transactions', sub: 'The full ledger: every credit and debit on every wallet.', search: 'Search player name or email…', cols: [
    ['Date', when], ['Player', r => who(r._player, r.user_id)], ['Type', r => txTypeLabel(r.type)], ['Wallet', r => r.wallet_bucket], ['Amount', r => signed(r.amount_cents, r.direction)],
    ['Balance after', money('balance_after_cents')], ['Reference', r => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.reference_id || '—'}</span>], ['Note', r => <span style={dim}>{r.description}</span>]] },
  adjustments: { title: 'Adjustments', sub: 'Manual balance changes made by staff.', search: 'Search player name or email…', cols: [
    ['Date', when], ['Reference', r => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.reference_id}</span>], ['Player', r => who(r._player, r.user_id)], ['Wallet', r => r.wallet_bucket],
    ['Amount', r => signed(r.amount_cents, r.direction)], ['Reason', r => r.reason], ['Status', r => <StatusBadge status={r.status} size="xs" />]] },
  audit: { title: 'Audit Logs', sub: 'A record of what staff did, and when. Newest first.', search: 'Search by action, e.g. deposit_approved…', cols: [
    ['Date', when], ['Staff', r => r._actor ? <div><div style={{ fontWeight: 700 }}>{r._actor.name}</div><div style={dim}>{(r.actor_role || '').replace('_', ' ')}</div></div> : <span style={dim}>{(r.actor_role || 'system')}</span>],
    ['Action', r => <span style={{ color: G, fontWeight: 700 }}>{r.action}</span>], ['Target', r => <span style={dim}>{r.target_type} {r.target_id ? String(r.target_id).slice(0, 8) : ''}</span>], ['Reason', r => r.reason || '—']] },
}

export default function BrowseTable({ kind }) {
  const v = VIEWS[kind]
  const [rows, setRows] = useState([])
  const [page, setPage] = useState(0)
  const [q, setQ] = useState('')
  const [term, setTerm] = useState('')
  const [info, setInfo] = useState({ total: 0, hasMore: false })
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setErr('')
    const r = await adminFetch(`/api/admin/browse?kind=${kind}&page=${page}&q=${encodeURIComponent(term)}`)
    if (!r.ok) setErr(r.error); else { setRows(r.data.rows || []); setInfo({ total: r.data.total || 0, hasMore: !!r.data.hasMore }) }
    setLoading(false)
  }, [kind, page, term])
  useEffect(() => { load() }, [load])

  const pill = { padding: '9px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', background: 'transparent', color: G, border: '1px solid rgba(251,191,36,.4)' }
  const from = rows.length ? page * 50 + 1 : 0

  return (
    <AdminLayout>
      <Head><title>{v.title} — Admin</title></Head>
      <h1 style={{ fontSize: 'clamp(22px,3vw,28px)', fontWeight: 800, marginBottom: 4 }}>{v.title}</h1>
      <p style={{ color: 'rgba(255,255,255,.45)', fontSize: 14, marginBottom: 18 }}>{v.sub}</p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { setPage(0); setTerm(q) } }} placeholder={v.search}
          style={{ flex: '1 1 240px', maxWidth: 380, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.14)', borderRadius: 10, padding: '10px 14px', color: '#fff', fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
        <button style={pill} onClick={() => { setPage(0); setTerm(q) }}>Search</button>
        {term && <button style={{ ...pill, color: 'rgba(255,255,255,.6)', borderColor: 'rgba(255,255,255,.2)' }} onClick={() => { setQ(''); setTerm(''); setPage(0) }}>Clear</button>}
      </div>
      {err && <div style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', color: '#f87171', padding: '10px 14px', borderRadius: 10, fontSize: 13, fontWeight: 700, marginBottom: 14 }}>{err}</div>}
      <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(251,191,36,.14)', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 760, borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr>{v.cols.map(([h]) => <th key={h} style={{ textAlign: 'left', padding: '12px 14px', fontSize: 10, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.4)', borderBottom: '1px solid rgba(255,255,255,.08)', whiteSpace: 'nowrap' }}>{h}</th>)}</tr></thead>
            <tbody>
              {rows.map(r => <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,.05)' }}>{v.cols.map(([h, f]) => <td key={h} style={{ padding: '11px 14px', verticalAlign: 'top' }}>{f(r)}</td>)}</tr>)}
            </tbody>
          </table>
        </div>
        {!loading && rows.length === 0 && !err && <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,.35)' }}>Nothing found</div>}
        {loading && <div style={{ padding: 30, textAlign: 'center', color: 'rgba(255,255,255,.4)' }}>Loading…</div>}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, gap: 10, flexWrap: 'wrap' }}>
        <span style={dim}>{rows.length ? `Showing ${from}–${from + rows.length - 1} of ${info.total}` : ''}</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{ ...pill, opacity: page === 0 ? .4 : 1 }} disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Previous</button>
          <button style={{ ...pill, opacity: info.hasMore ? 1 : .4 }} disabled={!info.hasMore} onClick={() => setPage(p => p + 1)}>Next →</button>
        </div>
      </div>
    </AdminLayout>
  )
}
