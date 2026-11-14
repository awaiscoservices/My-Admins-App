/**
 * GET /api/admin/analytics?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Returns platform-wide KPIs and chart data for the admin dashboard.
 *
 * Every volume/flow metric (deposits, withdrawals, new players, scores,
 * redemptions, the charts) is computed over the [from, to] window the
 * dashboard's single date filter sends. When no range is given it defaults
 * to the last 30 days. The live queue counts (pending approvals, active
 * game accounts) are current-state, not date-bound, so they ignore the
 * range — there is no "pending as of last month".
 *
 * Accessible to all staff roles.
 */
import { guardAdmin, scopeToTenant, PERMS } from '../../../lib/adminGuard'
import { SETTLED } from '../../../lib/statuses'

const MS_DAY = 86400000

// Resolve the window. `from`/`to` are 'YYYY-MM-DD' (local calendar days);
// default is the last 30 days ending today.
function resolveRange(req) {
  const { from, to } = req.query
  const end = to ? new Date(to + 'T23:59:59.999') : new Date()
  let start
  if (from) {
    start = new Date(from + 'T00:00:00')
  } else {
    start = new Date(end)
    start.setDate(start.getDate() - 29)
    start.setHours(0, 0, 0, 0)
  }
  return { start, end, startISO: start.toISOString(), endISO: end.toISOString() }
}

// Bucket rows into one slot per calendar day across the range. Capped at 92
// days so a huge range cannot produce a thousand bars.
function bucketByDay(rows, start, end, field) {
  const s0 = new Date(start); s0.setHours(0, 0, 0, 0)
  const e0 = new Date(end);   e0.setHours(0, 0, 0, 0)
  const n = Math.min(Math.floor((e0 - s0) / MS_DAY) + 1, 92)
  const buckets = Array(n).fill(0)
  ;(rows || []).forEach(r => {
    const idx = Math.floor((new Date(r.created_at) - s0) / MS_DAY)
    if (idx >= 0 && idx < n) buckets[idx] += field ? (r[field] || 0) : 1
  })
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(s0.getTime() + i * MS_DAY)
    return { label: `${d.getMonth() + 1}/${d.getDate()}`, value: buckets[i] }
  })
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const gate = await guardAdmin(req, res, { allow: PERMS.ANALYTICS })
  if (!gate) return

  // Every count below is scoped, or the dashboard reports the whole platform's
  // numbers to a single casino's staff — which is what it used to do.
  const q = (table, select, opts) => scopeToTenant(gate.db.from(table).select(select, opts), gate)

  const { start, end, startISO, endISO } = resolveRange(req)
  const inRange = (query) => query.gte('created_at', startISO).lte('created_at', endISO)

  const [
    playersRes,          // all-time total
    newPlayersRes,       // registered in range (rows, for count + sparkline)
    depositsRes,         // settled deposits in range (rows, for total + by-day)
    withdrawalsRes,      // settled withdrawals in range
    gameLoadsRes,        // score loads in range
    redemptionsRes,      // redemptions in range
    pendingDepRes,
    pendingWdRes,
    pendingKycRes,
    pendingGameLoadsRes,
    pendingRedemptionsRes,
    openTicketsRes,
    activeGARes,
    pendingGARes,
    recentTxRes,
  ] = await Promise.all([
    q('profiles', 'id', { count: 'exact', head: true }).eq('role', 'player'),
    inRange(q('profiles', 'created_at').eq('role', 'player')).order('created_at'),

    inRange(q('deposits', 'amount_cents, created_at').in('status', SETTLED.deposits)),
    inRange(q('withdrawals', 'amount_cents, created_at').in('status', SETTLED.withdrawals)),

    inRange(q('game_loads', 'id', { count: 'exact', head: true })),
    inRange(q('redemptions', 'id', { count: 'exact', head: true })),

    // Live queues — current state, not date-bound.
    q('deposits', 'id', { count: 'exact', head: true }).eq('status', 'pending'),
    q('withdrawals', 'id', { count: 'exact', head: true }).eq('status', 'pending'),
    q('kyc_records', 'id', { count: 'exact', head: true }).eq('status', 'pending'),
    q('game_loads', 'id', { count: 'exact', head: true }).eq('status', 'pending'),
    q('redemptions', 'id', { count: 'exact', head: true }).eq('status', 'pending'),
    q('support_tickets', 'id', { count: 'exact', head: true }).eq('status', 'open'),

    q('game_accounts', 'id', { count: 'exact', head: true }).eq('status', 'active'),
    q('game_accounts', 'id', { count: 'exact', head: true }).eq('status', 'pending'),

    // Recent ledger transactions within the range.
    inRange(q('ledger', 'reference_id, user_id, type, amount_cents, direction, created_at, profiles!user_id(username)')
      .in('type', ['deposit', 'withdrawal']))
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  const sum = (rows) => (rows || []).reduce((s, r) => s + (r.amount_cents || 0), 0)
  const totalDepositsCents    = sum(depositsRes.data)
  const totalWithdrawalsCents = sum(withdrawalsRes.data)
  const depositsCount    = depositsRes.data?.length || 0
  const withdrawalsCount = withdrawalsRes.data?.length || 0
  const newPlayersCount  = newPlayersRes.data?.length || 0

  const recentTransactions = (recentTxRes.data || []).map(tx => ({
    reference_id: tx.reference_id,
    player_name:  tx.profiles?.username || `player${String(tx.user_id || '').replace(/-/g, '').slice(0, 8)}`,
    type:         tx.direction === 'credit' ? 'deposit' : 'withdrawal',
    amount_cents: tx.amount_cents,
    status:       'approved',
    created_at:   tx.created_at,
  }))

  return res.status(200).json({
    // Echo the resolved window so the UI can show it.
    range: { from: startISO, to: endISO },

    // Players
    total_players:     playersRes.count || 0,
    new_players_range: newPlayersCount,
    signups_by_day:    bucketByDay(newPlayersRes.data, start, end),

    // Financials (within range)
    total_deposits_cents:    totalDepositsCents,
    deposits_count:          depositsCount,
    total_withdrawals_cents: totalWithdrawalsCents,
    withdrawals_count:       withdrawalsCount,
    deposits_by_day:         bucketByDay(depositsRes.data, start, end, 'amount_cents'),
    withdrawals_by_day:      bucketByDay(withdrawalsRes.data, start, end, 'amount_cents'),

    // Scores / redemptions (within range)
    game_loads_range:   gameLoadsRes.count   || 0,
    redemptions_range:  redemptionsRes.count || 0,

    // Live queues (current state)
    pending_deposits:    pendingDepRes.count         || 0,
    pending_withdrawals: pendingWdRes.count          || 0,
    pending_kyc:         pendingKycRes.count          || 0,
    pending_game_loads:  pendingGameLoadsRes.count    || 0,
    pending_redemptions: pendingRedemptionsRes.count  || 0,
    open_tickets:        openTicketsRes.count         || 0,
    active_game_accounts:  activeGARes.count  || 0,
    pending_game_accounts: pendingGARes.count || 0,

    // Recent
    recent_transactions: recentTransactions,
  })
}
