/**
 * GET /api/admin/analytics
 * Returns platform-wide KPIs and chart data for the admin dashboard.
 * Accessible to all staff roles.
 */
import { guardAdmin, scopeToTenant, PERMS } from '../../../lib/adminGuard'

function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function last7DayLabels() {
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - 6 + i); return days[d.getDay()]
  })
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const gate = await guardAdmin(req, res, { allow: PERMS.ANALYTICS })
  if (!gate) return

  // Every count below is scoped, or the dashboard reports the whole platform's
  // numbers to a single casino's staff — which is what it used to do.
  const q = (table, select, opts) => scopeToTenant(gate.db.from(table).select(select, opts), gate)

  const today = daysAgo(0)
  const ago7  = daysAgo(7)
  const ago14 = daysAgo(14)

  // Run all queries in parallel
  const [
    playersRes,
    newTodayRes,
    new7dRes,
    new14dRes,
    signups14dRes,
    depositsRes,
    withdrawalsRes,
    activeGARes,
    pendingGARes,
    pendingDepRes,
    pendingWdRes,
    pendingKycRes,
    openTicketsRes,
    deposits7dRes,
    withdrawals7dRes,
    gameLoads7dRes,
    pendingGameLoadsRes,
    redemptions7dRes,
    pendingRedemptionsRes,
    recentTxRes,
  ] = await Promise.all([
    // Players
    q('profiles', 'id', { count:'exact', head:true }).eq('role','player'),
    q('profiles', 'id', { count:'exact', head:true }).eq('role','player').gte('created_at', today),
    q('profiles', 'id', { count:'exact', head:true }).eq('role','player').gte('created_at', ago7),
    q('profiles', 'id', { count:'exact', head:true }).eq('role','player').gte('created_at', ago14),
    q('profiles', 'created_at').eq('role','player').gte('created_at', ago14).order('created_at'),

    // Financial totals (all time approved)
    q('deposits', 'amount_cents').in('status',['approved','completed']),
    q('withdrawals', 'amount_cents').in('status',['approved','completed']),

    // Game accounts
    q('game_accounts', 'id', { count:'exact', head:true }).eq('status','active'),
    q('game_accounts', 'id', { count:'exact', head:true }).eq('status','pending'),

    // Pending queues
    q('deposits', 'id', { count:'exact', head:true }).eq('status','pending'),
    q('withdrawals', 'id', { count:'exact', head:true }).eq('status','pending'),
    q('kyc_records', 'id', { count:'exact', head:true }).eq('status','pending'),
    q('support_tickets', 'id', { count:'exact', head:true }).eq('status','open'),

    // 7d charts
    q('deposits', 'amount_cents, created_at').in('status',['approved','completed']).gte('created_at', ago7),
    q('withdrawals', 'amount_cents, created_at').in('status',['approved','completed']).gte('created_at', ago7),

    // Game loads (scores) — 7d count + pending
    q('game_loads', 'id', { count:'exact', head:true }).gte('created_at', ago7),
    q('game_loads', 'id', { count:'exact', head:true }).eq('status','pending'),

    // Redemptions — 7d count + pending
    q('redemptions', 'id', { count:'exact', head:true }).gte('created_at', ago7),
    q('redemptions', 'id', { count:'exact', head:true }).eq('status','pending'),

    // Recent ledger transactions
    q('ledger', 'reference_id, user_id, type, amount_cents, direction, created_at, profiles!user_id(full_name)')
      .in('type', ['deposit','withdrawal'])
      .order('created_at', { ascending:false })
      .limit(20),
  ])

  // Totals
  const totalDepositsCents    = (depositsRes.data    || []).reduce((s, r) => s + (r.amount_cents || 0), 0)
  const totalWithdrawalsCents = (withdrawalsRes.data  || []).reduce((s, r) => s + (r.amount_cents || 0), 0)
  const deposits7dCents       = (deposits7dRes.data   || []).reduce((s, r) => s + (r.amount_cents || 0), 0)
  const withdrawals7dCents    = (withdrawals7dRes.data || []).reduce((s, r) => s + (r.amount_cents || 0), 0)

  // 7-day bucket helper
  const bucketByDay = (rows, field = 'amount_cents') => {
    const buckets = Array(7).fill(0)
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 6); cutoff.setHours(0,0,0,0)
    ;(rows || []).forEach(r => {
      const idx = Math.floor((new Date(r.created_at) - cutoff) / 86400000)
      if (idx >= 0 && idx < 7) buckets[idx] += (r[field] || 0)
    })
    return last7DayLabels().map((label, i) => ({ label, value: buckets[i] }))
  }

  // 14-day signup sparkline
  const signupBuckets = Array(14).fill(0)
  const cutoff14 = new Date(); cutoff14.setDate(cutoff14.getDate() - 13); cutoff14.setHours(0,0,0,0)
  ;(signups14dRes.data || []).forEach(r => {
    const idx = Math.floor((new Date(r.created_at) - cutoff14) / 86400000)
    if (idx >= 0 && idx < 14) signupBuckets[idx]++
  })

  // Recent transactions
  const recentTransactions = (recentTxRes.data || []).map(tx => ({
    reference_id: tx.reference_id,
    player_name:  tx.profiles?.full_name || tx.user_id?.slice(0, 8),
    type:         tx.direction === 'credit' ? 'deposit' : 'withdrawal',
    amount_cents: tx.amount_cents,
    status:       'approved',
    created_at:   tx.created_at,
  }))

  return res.status(200).json({
    // Players
    total_players:      playersRes.count  || 0,
    new_players_today:  newTodayRes.count || 0,
    new_players_7d:     new7dRes.count    || 0,
    new_players_14d:    new14dRes.count   || 0,
    signups_by_day:     signupBuckets.map(value => ({ value })),

    // Financials (all time)
    total_deposits_cents:    totalDepositsCents,
    deposits_count:          depositsRes.data?.length || 0,
    total_withdrawals_cents: totalWithdrawalsCents,
    withdrawals_count:       withdrawalsRes.data?.length || 0,

    // 7-day financials
    deposits_7d_cents:    deposits7dCents,
    withdrawals_7d_cents: withdrawals7dCents,
    deposits_by_day:      bucketByDay(deposits7dRes.data),
    withdrawals_by_day:   bucketByDay(withdrawals7dRes.data),

    // Pending queues
    pending_deposits:    pendingDepRes.count  || 0,
    pending_withdrawals: pendingWdRes.count   || 0,
    pending_kyc:         pendingKycRes.count  || 0,
    open_tickets:        openTicketsRes.count || 0,

    // Game accounts
    active_game_accounts:  activeGARes.count  || 0,
    pending_game_accounts: pendingGARes.count  || 0,

    // Scores / Game loads
    game_loads_7d:        gameLoads7dRes.count        || 0,
    pending_game_loads:   pendingGameLoadsRes.count   || 0,

    // Redemptions
    redemptions_7d:       redemptions7dRes.count      || 0,
    pending_redemptions:  pendingRedemptionsRes.count || 0,

    // Recent
    recent_transactions: recentTransactions,
  })
}
