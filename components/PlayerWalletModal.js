/**
 * PlayerWalletModal — 8-tab wallet deep-dive for any player.
 *
 * Usage:
 *   <PlayerWalletModal playerId={id} playerName={name} onClose={() => setWalletOpen(false)} />
 *
 * Tabs: Summary | Deposits | Withdrawals | Scores | Redeems | Transactions | Player Level | Bonuses
 *
 * Fix notes:
 *  - r.notes → r.description in Transactions and Bonuses tabs (ledger col renamed)
 *  - Modal is now full-screen overlay, responsive on all devices
 *  - Tab bar scrolls horizontally on mobile
 *  - Tab content fills available viewport height
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import StatusBadge from './ui/StatusBadge'

// ─── helpers ────────────────────────────────────────────────────────────────
const fmt   = c => '$' + ((c || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })
const fmtN  = n => (n || 0).toLocaleString('en-US')
const fmtDt = d => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
const fmtTs = d => d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'

async function apiFetch(path) {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(path, { headers: { Authorization: `Bearer ${session.access_token}` } })
  if (!res.ok) { const j = await res.json(); throw new Error(j.error || 'Request failed') }
  return res.json()
}

// ─── stat tile ───────────────────────────────────────────────────────────────
function Tile({ label, value, sub, color = '#fbbf24' }) {
  return (
    <div style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: '14px 16px', minWidth: 130, flex: '1 1 130px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color, fontFamily: "'Outfit',sans-serif" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', marginTop: 3 }}>{sub}</div>}
    </div>
  )
}

// ─── pending badge ────────────────────────────────────────────────────────────
function Pending({ count, label, color }) {
  if (!count) return null
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: `${color}18`, border: `1px solid ${color}44`, borderRadius: 8, padding: '5px 10px' }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, display: 'inline-block' }} />
      <span style={{ fontSize: 12, fontWeight: 700, color }}>{count} pending {label}</span>
    </div>
  )
}

// ─── pagination ───────────────────────────────────────────────────────────────
function Pager({ page, pages, total, onPage }) {
  if (pages <= 1) return <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', padding: '8px 0' }}>{total} record{total !== 1 ? 's' : ''}</div>
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 0' }}>
      <button onClick={() => onPage(page - 1)} disabled={page <= 1} style={pagerBtn(page <= 1)}>← Prev</button>
      <span style={{ fontSize: 12, color: 'rgba(255,255,255,.4)' }}>Page {page} of {pages} ({total} total)</span>
      <button onClick={() => onPage(page + 1)} disabled={page >= pages} style={pagerBtn(page >= pages)}>Next →</button>
    </div>
  )
}
const pagerBtn = dis => ({ padding: '5px 12px', fontSize: 12, fontWeight: 700, background: dis ? 'rgba(255,255,255,.04)' : 'rgba(251,191,36,.15)', border: `1px solid ${dis ? 'rgba(255,255,255,.08)' : 'rgba(251,191,36,.3)'}`, borderRadius: 8, color: dis ? 'rgba(255,255,255,.2)' : '#fbbf24', cursor: dis ? 'default' : 'pointer', fontFamily: "'Outfit',sans-serif" })

// ─── empty state ──────────────────────────────────────────────────────────────
function Empty({ msg }) {
  return <div style={{ padding: '40px 0', textAlign: 'center', color: 'rgba(255,255,255,.25)', fontSize: 13 }}>{msg}</div>
}

// ─── data table ───────────────────────────────────────────────────────────────
function DataTable({ headers, rows }) {
  return (
    <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,.04)' }}>
              {headers.map(h => <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.35)', whiteSpace: 'nowrap' }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>{rows}</tbody>
        </table>
      </div>
    </div>
  )
}

const tdS = { padding: '11px 14px', borderTop: '1px solid rgba(255,255,255,.04)' }

// ─── status filter bar ────────────────────────────────────────────────────────
function FilterBar({ value, onChange, options = ['all','pending','approved','rejected'] }) {
  return (
    <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,.04)', padding: 4, borderRadius: 10, marginBottom: 14, flexWrap: 'wrap' }}>
      {options.map(s => (
        <button key={s} onClick={() => onChange(s)} style={{ padding: '5px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: "'Outfit',sans-serif", fontSize: 12, fontWeight: 700, background: value === s ? 'rgba(251,191,36,.7)' : 'transparent', color: value === s ? '#fff' : 'rgba(255,255,255,.4)', textTransform: 'capitalize', transition: 'all .15s' }}>{s}</button>
      ))}
    </div>
  )
}

// ─── XP progress bar ──────────────────────────────────────────────────────────
function XpBar({ pct, color = '#fbbf24' }) {
  return (
    <div style={{ height: 8, background: 'rgba(255,255,255,.08)', borderRadius: 99, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, background: `linear-gradient(90deg, ${color}, ${color}cc)`, borderRadius: 99, transition: 'width .4s ease' }} />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
//  TAB CONTENTS
// ═══════════════════════════════════════════════════════════════════════════════

function TabSummary({ playerId }) {
  const [data, setData] = useState(null)
  const [err, setErr] = useState(null)

  useEffect(() => {
    apiFetch(`/api/admin/players/wallet-summary?player_id=${playerId}&tab=summary`)
      .then(d => setData(d.summary))
      .catch(e => setErr(e.message))
  }, [playerId])

  if (err) return <div style={{ color: '#f87171', padding: 16 }}>⚠ {err}</div>
  if (!data) return <div style={{ color: 'rgba(255,255,255,.3)', padding: 16 }}>Loading…</div>

  const s = data
  const levelColor = s.current_level?.color || '#fbbf24'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Pending alerts */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <Pending count={s.pending_deposit_count}  label="deposits"  color="#3b82f6" />
        <Pending count={s.pending_withdraw_count} label="withdrawals" color="#f59e0b" />
        <Pending count={s.pending_scores_count}   label="scores"    color="#a855f7" />
        <Pending count={s.pending_redeem_count}   label="redeems"   color="#22c55e" />
      </div>

      {/* Balance tiles */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>Current Balances</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <Tile label="Cash Balance"    value={fmt(s.cash_balance_cents)}    color="#22c55e" />
          <Tile label="Bonus Balance"   value={fmt(s.bonus_balance_cents)}   color="#a855f7" />
          <Tile label="Withdrawable"    value={fmt(s.withdrawable_cents)}    color="#3b82f6" />
          <Tile label="Reserved"        value={fmt(s.reserved_cents)}        color="#f59e0b" />
        </div>
      </div>

      {/* Lifetime activity */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>Lifetime Activity</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {(() => {
            const dep    = s.total_deposit_cents  || 0
            const with_  = s.total_withdraw_cents || 0
            const scr    = s.total_scores_cents   || 0
            const red    = s.total_redeem_cents   || 0
            const profit  = dep - with_
            const balance = scr - red
            return <>
              <Tile label="Total Deposit"  value={fmt(dep)}     color="#3b82f6" />
              <Tile label="Total Withdraw" value={fmt(with_)}   color="#f59e0b" />
              <Tile label="Total Profit"   value={fmt(profit)}  color={profit  >= 0 ? '#10b981' : '#f87171'} />
              <Tile label="Total Scores"   value={fmt(scr)}     color="#a855f7" />
              <Tile label="Total Redeem"   value={fmt(red)}     color="#22c55e" />
              <Tile label="Total Balance"  value={fmt(balance)} color={balance >= 0 ? '#10b981' : '#f87171'} />
            </>
          })()}
        </div>
      </div>

      {/* Level & XP */}
      <div style={{ background: 'rgba(255,255,255,.03)', border: `1px solid ${levelColor}33`, borderRadius: 14, padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>Player Level</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: levelColor }}>{s.current_level?.name || 'Unranked'}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#fbbf24' }}>{fmtN(s.current_xp)}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)' }}>Total XP</div>
          </div>
        </div>
        {s.next_level && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,.35)', marginBottom: 5 }}>
              <span>Progress to {s.next_level.name}</span>
              <span>{s.xp_progress_pct}%</span>
            </div>
            <XpBar pct={s.xp_progress_pct} color={levelColor} />
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.25)', marginTop: 4 }}>
              {fmtN(s.next_level.min_xp - s.current_xp)} XP needed (next threshold: {fmtN(s.next_level.min_xp)})
            </div>
          </div>
        )}
        {(!s.next_level) && <div style={{ fontSize: 12, color: 'rgba(255,255,255,.3)' }}>Max level reached 🏆</div>}

        {/* Recent level changes */}
        {s.recent_level_changes?.length > 0 && (
          <div style={{ marginTop: 12, borderTop: '1px solid rgba(255,255,255,.06)', paddingTop: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.25)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>Recent Level Changes</div>
            {s.recent_level_changes.map(h => (
              <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, fontSize: 12 }}>
                <span style={{ color: h.from_level?.accent_color || 'rgba(255,255,255,.4)' }}>{h.from_level?.name || '—'}</span>
                <span style={{ color: 'rgba(255,255,255,.25)' }}>→</span>
                <span style={{ color: h.to_level?.accent_color || '#fbbf24', fontWeight: 700 }}>{h.to_level?.name || '—'}</span>
                <span style={{ color: 'rgba(255,255,255,.25)', marginLeft: 'auto' }}>{fmtDt(h.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}

// ─── Generic transaction list tab ─────────────────────────────────────────────
function TabTransactionList({ playerId, tabKey, columns, renderRow, emptyMsg = 'No records found' }) {
  const [rows, setRows]     = useState([])
  const [total, setTotal]   = useState(0)
  const [pages, setPages]   = useState(1)
  const [page, setPage]     = useState(1)
  const [status, setStatus] = useState('all')
  const [loading, setLoading] = useState(true)
  const [err, setErr]       = useState(null)

  const load = useCallback(async (p = 1, st = status) => {
    setLoading(true); setErr(null)
    try {
      const d = await apiFetch(`/api/admin/players/wallet-summary?player_id=${playerId}&tab=${tabKey}&page=${p}&limit=25&status=${st !== 'all' ? st : ''}`)
      setRows(d.rows || []); setTotal(d.total || 0); setPages(d.pages || 1); setPage(p)
    } catch(e) { setErr(e.message) }
    setLoading(false)
  }, [playerId, tabKey, status])

  useEffect(() => { load(1, status) }, [playerId, tabKey]) // eslint-disable-line

  function onStatusChange(s) { setStatus(s); load(1, s) }
  function onPage(p) { load(p) }

  return (
    <div>
      <FilterBar value={status} onChange={onStatusChange} />
      {err && <div style={{ color: '#f87171', marginBottom: 10 }}>⚠ {err}</div>}
      {loading ? <div style={{ color: 'rgba(255,255,255,.3)', padding: 20 }}>Loading…</div> : (
        <>
          {rows.length === 0 ? <Empty msg={emptyMsg} /> : (
            <DataTable headers={columns} rows={rows.map((r, i) => renderRow(r, i))} />
          )}
          <Pager page={page} pages={pages} total={total} onPage={onPage} />
        </>
      )}
    </div>
  )
}

// ─── Deposits tab ─────────────────────────────────────────────────────────────
function TabDeposits({ playerId }) {
  return (
    <TabTransactionList
      playerId={playerId} tabKey="deposits"
      emptyMsg="No deposits found"
      columns={['Reference', 'Amount', 'Method', 'Status', 'Date', 'Reviewed By']}
      renderRow={(r, i) => (
        <tr key={r.id || i} style={{ borderTop: '1px solid rgba(255,255,255,.04)' }}>
          <td style={tdS}><span style={{ fontSize: 11, fontWeight: 800, color: '#fbbf24', fontFamily: 'monospace' }}>{r.reference_id}</span></td>
          <td style={tdS}><span style={{ fontSize: 13, fontWeight: 700, color: '#3b82f6' }}>+{fmt(r.amount_cents)}</span></td>
          <td style={tdS}><span style={{ fontSize: 12, color: 'rgba(255,255,255,.5)' }}>{r.payment_methods?.name || '—'}</span></td>
          <td style={tdS}><StatusBadge status={r.status} size="xs" /></td>
          <td style={{ ...tdS, fontSize: 11, color: 'rgba(255,255,255,.35)', whiteSpace: 'nowrap' }}>{fmtDt(r.created_at)}</td>
          <td style={{ ...tdS, fontSize: 12, color: 'rgba(255,255,255,.4)' }}>{r.profiles?.full_name || '—'}</td>
        </tr>
      )}
    />
  )
}

// ─── Withdrawals tab ──────────────────────────────────────────────────────────
function TabWithdrawals({ playerId }) {
  return (
    <TabTransactionList
      playerId={playerId} tabKey="withdrawals"
      emptyMsg="No withdrawals found"
      columns={['Reference', 'Amount', 'Method', 'Status', 'Date', 'Reviewed By']}
      renderRow={(r, i) => (
        <tr key={r.id || i} style={{ borderTop: '1px solid rgba(255,255,255,.04)' }}>
          <td style={tdS}><span style={{ fontSize: 11, fontWeight: 800, color: '#fbbf24', fontFamily: 'monospace' }}>{r.reference_id}</span></td>
          <td style={tdS}><span style={{ fontSize: 13, fontWeight: 700, color: '#f59e0b' }}>−{fmt(r.amount_cents)}</span></td>
          <td style={tdS}><span style={{ fontSize: 12, color: 'rgba(255,255,255,.5)' }}>{r.method || '—'}</span></td>
          <td style={tdS}><StatusBadge status={r.status} size="xs" /></td>
          <td style={{ ...tdS, fontSize: 11, color: 'rgba(255,255,255,.35)', whiteSpace: 'nowrap' }}>{fmtDt(r.created_at)}</td>
          <td style={{ ...tdS, fontSize: 12, color: 'rgba(255,255,255,.4)' }}>{r.profiles?.full_name || '—'}</td>
        </tr>
      )}
    />
  )
}

// ─── Scores tab ───────────────────────────────────────────────────────────────
function TabScores({ playerId }) {
  return (
    <TabTransactionList
      playerId={playerId} tabKey="scores"
      emptyMsg="No score requests found"
      columns={['Reference', 'Amount', 'Bucket', 'Game', 'Account', 'Status', 'Date']}
      renderRow={(r, i) => (
        <tr key={r.id || i} style={{ borderTop: '1px solid rgba(255,255,255,.04)' }}>
          <td style={tdS}><span style={{ fontSize: 11, fontWeight: 800, color: '#fbbf24', fontFamily: 'monospace' }}>{r.reference_id}</span></td>
          <td style={tdS}><span style={{ fontSize: 13, fontWeight: 700, color: '#ef4444' }}>−{fmt(r.amount_cents)}</span></td>
          <td style={tdS}><span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 99, background: r.wallet_bucket === 'bonus' ? 'rgba(168,85,247,.15)' : 'rgba(255,255,255,.08)', color: r.wallet_bucket === 'bonus' ? '#a855f7' : 'rgba(255,255,255,.4)' }}>{r.wallet_bucket || 'cash'}</span></td>
          <td style={{ ...tdS, fontSize: 12, color: '#a855f7', fontWeight: 600 }}>{r.game_panel_name || '—'}</td>
          <td style={{ ...tdS, fontSize: 12, color: '#fbbf24', fontFamily: 'monospace' }}>{r.game_account_username || '—'}</td>
          <td style={tdS}><StatusBadge status={r.status} size="xs" /></td>
          <td style={{ ...tdS, fontSize: 11, color: 'rgba(255,255,255,.35)', whiteSpace: 'nowrap' }}>{fmtDt(r.created_at)}</td>
        </tr>
      )}
    />
  )
}

// ─── Redeems tab ──────────────────────────────────────────────────────────────
function TabRedeems({ playerId }) {
  return (
    <TabTransactionList
      playerId={playerId} tabKey="redeems"
      emptyMsg="No redeem requests found"
      columns={['Reference', 'Requested', 'Excess', 'Game', 'Account', 'Status', 'Date']}
      renderRow={(r, i) => (
        <tr key={r.id || i} style={{ borderTop: '1px solid rgba(255,255,255,.04)' }}>
          <td style={tdS}><span style={{ fontSize: 11, fontWeight: 800, color: '#fbbf24', fontFamily: 'monospace' }}>{r.reference_id}</span></td>
          <td style={tdS}><span style={{ fontSize: 13, fontWeight: 700, color: '#22c55e' }}>+{fmt(r.amount_cents)}</span></td>
          <td style={tdS}><span style={{ fontSize: 12, color: '#fbbf24' }}>{r.excess_cents ? fmt(r.excess_cents) : '—'}</span></td>
          <td style={{ ...tdS, fontSize: 12, color: '#a855f7', fontWeight: 600 }}>{r.game_panel_name || '—'}</td>
          <td style={{ ...tdS, fontSize: 12, color: '#fbbf24', fontFamily: 'monospace' }}>{r.game_account_username || '—'}</td>
          <td style={tdS}><StatusBadge status={r.status} size="xs" /></td>
          <td style={{ ...tdS, fontSize: 11, color: 'rgba(255,255,255,.35)', whiteSpace: 'nowrap' }}>{fmtDt(r.created_at)}</td>
        </tr>
      )}
    />
  )
}

// ─── Transactions tab ─────────────────────────────────────────────────────────
const TX_COLORS = { deposit: '#3b82f6', withdrawal: '#f59e0b', bonus: '#a855f7', adjustment: '#fbbf24', game_load: '#ef4444', redemption: '#22c55e' }
function txColor(type) { for (const [k, c] of Object.entries(TX_COLORS)) { if (type?.includes(k)) return c } return 'rgba(255,255,255,.5)' }

function TabTransactions({ playerId }) {
  const [rows, setRows]     = useState([])
  const [total, setTotal]   = useState(0)
  const [pages, setPages]   = useState(1)
  const [page, setPage]     = useState(1)
  const [type, setType]     = useState('')
  const [loading, setLoading] = useState(true)
  const [err, setErr]       = useState(null)

  const load = useCallback(async (p = 1, t = type) => {
    setLoading(true); setErr(null)
    try {
      const qs = new URLSearchParams({ player_id: playerId, tab: 'transactions', page: p, limit: 25 })
      if (t) qs.set('type', t)
      const d = await apiFetch(`/api/admin/players/wallet-summary?${qs}`)
      setRows(d.rows || []); setTotal(d.total || 0); setPages(d.pages || 1); setPage(p)
    } catch(e) { setErr(e.message) }
    setLoading(false)
  }, [playerId, type])

  useEffect(() => { load(1, '') }, [playerId]) // eslint-disable-line

  return (
    <div>
      <div style={{ marginBottom: 14, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={type} onChange={e => { setType(e.target.value); load(1, e.target.value) }}
          style={{ padding: '6px 12px', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 8, color: '#fff', fontSize: 12, fontFamily: "'Outfit',sans-serif", outline: 'none' }}>
          <option value="">All Types</option>
          <option value="deposit">Deposits</option>
          <option value="withdrawal">Withdrawals</option>
          <option value="game_load">Game Loads</option>
          <option value="redemption">Redemptions</option>
          <option value="bonus">Bonuses</option>
          <option value="adjustment">Adjustments</option>
        </select>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,.3)' }}>{total} transactions</span>
      </div>
      {err && <div style={{ color: '#f87171', marginBottom: 10 }}>⚠ {err}</div>}
      {loading ? <div style={{ color: 'rgba(255,255,255,.3)', padding: 20 }}>Loading…</div> : (
        <>
          {rows.length === 0 ? <Empty msg="No transactions found" /> : (
            <DataTable
              headers={['Type', 'Amount', 'Balance After', 'Reference', 'Description', 'Date']}
              rows={rows.map((r, i) => (
                <tr key={r.id || i} style={{ borderTop: '1px solid rgba(255,255,255,.04)' }}>
                  <td style={tdS}><span style={{ fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 99, background: `${txColor(r.type)}22`, color: txColor(r.type), textTransform: 'capitalize' }}>{(r.type || '').replace(/_/g, ' ')}</span></td>
                  <td style={tdS}><span style={{ fontSize: 13, fontWeight: 700, color: r.amount_cents >= 0 ? '#22c55e' : '#ef4444' }}>{r.amount_cents >= 0 ? '+' : ''}{fmt(r.amount_cents)}</span></td>
                  <td style={{ ...tdS, fontSize: 13, fontWeight: 600, color: '#fbbf24' }}>{fmt(r.balance_after_cents)}</td>
                  <td style={tdS}><span style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', fontFamily: 'monospace' }}>{r.reference_id || '—'}</span></td>
                  {/* FIX: was r.notes — ledger column is `description` */}
                  <td style={{ ...tdS, fontSize: 12, color: 'rgba(255,255,255,.35)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.description || '—'}</td>
                  <td style={{ ...tdS, fontSize: 11, color: 'rgba(255,255,255,.35)', whiteSpace: 'nowrap' }}>{fmtTs(r.created_at)}</td>
                </tr>
              ))}
            />
          )}
          <Pager page={page} pages={pages} total={total} onPage={p => load(p)} />
        </>
      )}
    </div>
  )
}

// ─── Player Level tab ─────────────────────────────────────────────────────────
function TabPlayerLevel({ playerId }) {
  const [data, setData]     = useState(null)
  const [page, setPage]     = useState(1)
  const [sub, setSub]       = useState('history') // history | xp
  const [loading, setLoading] = useState(true)
  const [err, setErr]       = useState(null)

  const load = useCallback(async (p = 1) => {
    setLoading(true); setErr(null)
    try {
      const d = await apiFetch(`/api/admin/players/wallet-summary?player_id=${playerId}&tab=player_level&page=${p}&limit=25`)
      setData(d); setPage(p)
    } catch(e) { setErr(e.message) }
    setLoading(false)
  }, [playerId])

  useEffect(() => { load(1) }, [playerId]) // eslint-disable-line

  if (err)    return <div style={{ color: '#f87171', padding: 16 }}>⚠ {err}</div>
  if (loading) return <div style={{ color: 'rgba(255,255,255,.3)', padding: 20 }}>Loading…</div>
  if (!data)  return null

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,.04)', padding: 4, borderRadius: 10, marginBottom: 14, width: 'fit-content' }}>
        {['history', 'xp'].map(s => (
          <button key={s} onClick={() => setSub(s)} style={{ padding: '5px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: "'Outfit',sans-serif", fontSize: 12, fontWeight: 700, background: sub === s ? 'rgba(251,191,36,.7)' : 'transparent', color: sub === s ? '#fff' : 'rgba(255,255,255,.4)', textTransform: 'capitalize' }}>{s === 'xp' ? 'XP Log' : 'Level History'}</button>
        ))}
      </div>

      {sub === 'history' && (
        <>
          {data.history.length === 0 ? <Empty msg="No level changes recorded yet" /> : (
            <DataTable
              headers={['From', 'To', 'Trigger', 'Date', 'By']}
              rows={data.history.map((h, i) => (
                <tr key={h.id || i} style={{ borderTop: '1px solid rgba(255,255,255,.04)' }}>
                  <td style={tdS}><span style={{ fontWeight: 700, color: h.from_level?.accent_color || 'rgba(255,255,255,.4)' }}>{h.from_level?.name || '—'}</span></td>
                  <td style={tdS}><span style={{ fontWeight: 700, color: h.to_level?.accent_color || '#fbbf24' }}>{h.to_level?.name || '—'}</span></td>
                  <td style={tdS}><span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: 'rgba(251,191,36,.1)', color: '#fbbf24', textTransform: 'capitalize' }}>{(h.trigger || '').replace(/_/g, ' ')}</span></td>
                  <td style={{ ...tdS, fontSize: 11, color: 'rgba(255,255,255,.35)', whiteSpace: 'nowrap' }}>{fmtTs(h.created_at)}</td>
                  <td style={{ ...tdS, fontSize: 12, color: 'rgba(255,255,255,.4)' }}>{h.triggered_by_profile?.full_name || '—'}</td>
                </tr>
              ))}
            />
          )}
          <Pager page={page} pages={data.pages} total={data.history_total} onPage={p => load(p)} />
        </>
      )}

      {sub === 'xp' && (
        <>
          {data.xp_log.length === 0 ? <Empty msg="No XP transactions yet" /> : (
            <DataTable
              headers={['XP', 'Source', 'Reference', 'Notes', 'Date']}
              rows={data.xp_log.map((x, i) => (
                <tr key={x.id || i} style={{ borderTop: '1px solid rgba(255,255,255,.04)' }}>
                  <td style={tdS}><span style={{ fontSize: 14, fontWeight: 800, color: x.xp_amount >= 0 ? '#fbbf24' : '#ef4444' }}>{x.xp_amount >= 0 ? '+' : ''}{fmtN(x.xp_amount)}</span></td>
                  <td style={tdS}><span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: 'rgba(168,85,247,.12)', color: '#a855f7', textTransform: 'capitalize' }}>{(x.source || '').replace(/_/g, ' ')}</span></td>
                  <td style={tdS}><span style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', fontFamily: 'monospace' }}>{x.reference_id || '—'}</span></td>
                  <td style={{ ...tdS, fontSize: 12, color: 'rgba(255,255,255,.35)' }}>{x.notes || '—'}</td>
                  <td style={{ ...tdS, fontSize: 11, color: 'rgba(255,255,255,.35)', whiteSpace: 'nowrap' }}>{fmtTs(x.created_at)}</td>
                </tr>
              ))}
            />
          )}
          <Pager page={page} pages={data.pages} total={data.xp_total} onPage={p => load(p)} />
        </>
      )}
    </div>
  )
}

// ─── Bonuses tab ──────────────────────────────────────────────────────────────
function TabBonuses({ playerId }) {
  const [rows, setRows]     = useState([])
  const [total, setTotal]   = useState(0)
  const [pages, setPages]   = useState(1)
  const [page, setPage]     = useState(1)
  const [loading, setLoading] = useState(true)
  const [err, setErr]       = useState(null)

  const load = useCallback(async (p = 1) => {
    setLoading(true); setErr(null)
    try {
      const d = await apiFetch(`/api/admin/players/wallet-summary?player_id=${playerId}&tab=bonuses&page=${p}&limit=25`)
      setRows(d.rows || []); setTotal(d.total || 0); setPages(d.pages || 1); setPage(p)
    } catch(e) { setErr(e.message) }
    setLoading(false)
  }, [playerId])

  useEffect(() => { load(1) }, [playerId]) // eslint-disable-line

  return (
    <div>
      {err && <div style={{ color: '#f87171', marginBottom: 10 }}>⚠ {err}</div>}
      {loading ? <div style={{ color: 'rgba(255,255,255,.3)', padding: 20 }}>Loading…</div> : (
        <>
          {rows.length === 0 ? <Empty msg="No bonus transactions" /> : (
            <DataTable
              headers={['Type', 'Amount', 'Balance After', 'Reference', 'Description', 'Date']}
              rows={rows.map((r, i) => (
                <tr key={r.id || i} style={{ borderTop: '1px solid rgba(255,255,255,.04)' }}>
                  <td style={tdS}><span style={{ fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 99, background: 'rgba(168,85,247,.15)', color: '#a855f7', textTransform: 'capitalize' }}>{(r.type || '').replace(/_/g, ' ')}</span></td>
                  <td style={tdS}><span style={{ fontSize: 13, fontWeight: 700, color: r.amount_cents >= 0 ? '#a855f7' : '#ef4444' }}>{r.amount_cents >= 0 ? '+' : ''}{fmt(r.amount_cents)}</span></td>
                  <td style={{ ...tdS, fontSize: 13, fontWeight: 600, color: '#fbbf24' }}>{fmt(r.balance_after_cents)}</td>
                  <td style={tdS}><span style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', fontFamily: 'monospace' }}>{r.reference_id || '—'}</span></td>
                  {/* FIX: was r.notes — ledger column is `description` */}
                  <td style={{ ...tdS, fontSize: 12, color: 'rgba(255,255,255,.35)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.description || '—'}</td>
                  <td style={{ ...tdS, fontSize: 11, color: 'rgba(255,255,255,.35)', whiteSpace: 'nowrap' }}>{fmtTs(r.created_at)}</td>
                </tr>
              ))}
            />
          )}
          <Pager page={page} pages={pages} total={total} onPage={p => load(p)} />
        </>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MAIN MODAL  —  full-screen, responsive
// ═══════════════════════════════════════════════════════════════════════════════

const TABS = [
  { key: 'summary',      label: '📊 Summary'     },
  { key: 'deposits',     label: '💵 Deposits'    },
  { key: 'withdrawals',  label: '🏦 Withdrawals' },
  { key: 'scores',       label: '🎮 Scores'      },
  { key: 'redeems',      label: '💰 Redeems'     },
  { key: 'transactions', label: '📋 Transactions' },
  { key: 'player_level', label: '⭐ Level'       },
  { key: 'bonuses',      label: '🎁 Bonuses'     },
]

export default function PlayerWalletModal({ playerId, playerName, onClose }) {
  const [activeTab, setActiveTab] = useState('summary')
  const overlayRef = useRef(null)

  // Close on overlay click
  function onOverlayClick(e) { if (e.target === overlayRef.current) onClose() }

  // Close on Escape
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    // Lock body scroll while open
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <>
      {/* Inject responsive CSS once — avoids inline style limitations */}
      <style>{`
        .wallet-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,.88);
          z-index: 2000;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding: 0;
          overflow: hidden;
        }
        .wallet-modal-box {
          background: #0a1628;
          border: 1px solid rgba(251,191,36,.22);
          border-radius: 0;
          width: 100%;
          height: 100dvh;
          height: 100vh;
          max-width: 100%;
          box-shadow: none;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        @media (min-width: 700px) {
          .wallet-modal-overlay {
            padding: 20px 16px;
            align-items: flex-start;
            overflow-y: auto;
          }
          .wallet-modal-box {
            border-radius: 20px;
            height: auto;
            min-height: calc(100vh - 40px);
            max-width: 980px;
            box-shadow: 0 32px 80px rgba(0,0,0,.7);
          }
        }
        .wallet-tab-bar {
          display: flex;
          gap: 0;
          padding: 0 16px;
          overflow-x: auto;
          border-bottom: 1px solid rgba(255,255,255,.07);
          scrollbar-width: none;
          -ms-overflow-style: none;
          flex-shrink: 0;
        }
        .wallet-tab-bar::-webkit-scrollbar { display: none; }
        @media (min-width: 700px) {
          .wallet-tab-bar { padding: 0 24px; }
        }
        .wallet-tab-content {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          -webkit-overflow-scrolling: touch;
        }
        @media (min-width: 700px) {
          .wallet-tab-content { padding: 20px 24px; }
        }
        .wallet-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 16px 0;
          border-bottom: 1px solid rgba(255,255,255,.07);
          flex-shrink: 0;
        }
        @media (min-width: 700px) {
          .wallet-header { padding: 20px 24px 0; }
        }
      `}</style>

      <div
        ref={overlayRef}
        className="wallet-modal-overlay"
        onClick={onOverlayClick}
      >
        <div
          className="wallet-modal-box"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="wallet-header">
            <div style={{ paddingBottom: 14 }}>
              <h2 style={{ fontFamily: "'Cinzel',serif", fontSize: 18, fontWeight: 700, color: '#fff', margin: 0 }}>
                💳 Wallet Overview
              </h2>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,.4)', marginTop: 2 }}>{playerName}</div>
            </div>
            <button
              onClick={onClose}
              style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, color: 'rgba(255,255,255,.5)', fontSize: 18, cursor: 'pointer', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, fontFamily: 'sans-serif', flexShrink: 0, marginBottom: 14 }}
            >✕</button>
          </div>

          {/* Tab bar */}
          <div className="wallet-tab-bar">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                style={{
                  padding: '12px 14px',
                  border: 'none',
                  borderBottom: activeTab === t.key ? '2px solid #fbbf24' : '2px solid transparent',
                  background: 'transparent',
                  color: activeTab === t.key ? '#fbbf24' : 'rgba(255,255,255,.35)',
                  fontSize: 11,
                  fontWeight: 700,
                  fontFamily: "'Outfit',sans-serif",
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'color .15s',
                }}
              >{t.label}</button>
            ))}
          </div>

          {/* Tab content — scrollable */}
          <div className="wallet-tab-content">
            {activeTab === 'summary'      && <TabSummary      playerId={playerId} />}
            {activeTab === 'deposits'     && <TabDeposits     playerId={playerId} />}
            {activeTab === 'withdrawals'  && <TabWithdrawals  playerId={playerId} />}
            {activeTab === 'scores'       && <TabScores       playerId={playerId} />}
            {activeTab === 'redeems'      && <TabRedeems      playerId={playerId} />}
            {activeTab === 'transactions' && <TabTransactions playerId={playerId} />}
            {activeTab === 'player_level' && <TabPlayerLevel  playerId={playerId} />}
            {activeTab === 'bonuses'      && <TabBonuses      playerId={playerId} />}
          </div>

        </div>
      </div>
    </>
  )
}