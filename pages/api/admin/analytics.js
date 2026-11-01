/**
 * GET /api/admin/analytics
 * Returns platform-wide KPIs and chart data for the admin dashboard.
 * Accessible to all staff roles.
 */
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const STAFF_ROLES = ['super_admin', 'admin', 'finance', 'game_ops', 'support', 'kyc_agent', 'risk', 'reporting', 'marketing']

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

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' })

  const { data: admin } = await supabaseAdmin
    .from('profiles').select('id, role').eq('id', user.id).single()

  if (!admin || !STAFF_ROLES.includes(admin.role))
    return res.status(403).json({ error: 'Insufficient permissions' })

  const today = daysAgo(0)
  const ago7  = daysAgo(7)
  const ago14 = daysAgo(14)

  // Run all queries in parallel
  const [
    playersRes,
    newTodayRes,
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
    recentTxRes,
  ] = await Promise.all([
    // Total players
    supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'player'),
    // New today
    supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'player').gte('created_at', today),
    // New last 14d
    supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'player').gte('created_at', ago14),
    // Signups by day (14d) — raw select
    supabaseAdmin.from('profiles').select('created_at').eq('role', 'player').gte('created_at', ago14).order('created_at'),
    // Total deposits (approved/completed)
    supabaseAdmin.from('deposits').select('amount_cents').in('status', ['approved', 'completed']),
    // Total withdrawals (approved/completed)
    supabaseAdmin.from('withdrawals').select('amount_cents').in('status', ['approved', 'completed']),
    // Active game accounts
    supabaseAdmin.from('game_accounts').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    // Pending game accounts
    supabaseAdmin.from('game_accounts').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    // Pending deposits
    supabaseAdmin.from('deposits').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    // Pending withdrawals
    supabaseAdmin.from('withdrawals').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    // Pending KYC
    supabaseAdmin.from('kyc_records').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    // Open support tickets
    supabaseAdmin.from('support_tickets').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    // Deposits last 7 days
    supabaseAdmin.from('deposits').select('amount_cents, created_at').in('status', ['approved', 'completed']).gte('created_at', ago7),
    // Withdrawals last 7 days
    supabaseAdmin.from('withdrawals').select('amount_cents, created_at').in('status', ['approved', 'completed']).gte('created_at', ago7),
    // Recent transactions (last 20)
    supabaseAdmin.from('ledger')
      .select('reference_id, user_id, type, amount_cents, direction, created_at, profiles!user_id(full_name)')
      .in('type', ['deposit', 'withdrawal'])
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  // Calculate totals
  const totalDepositsCents = (depositsRes.data || []).reduce((s, r) => s + (r.amount_cents || 0), 0)
  const totalWithdrawalsCents = (withdrawalsRes.data || []).reduce((s, r) => s + (r.amount_cents || 0), 0)
  const deposits7dCents = (deposits7dRes.data || []).reduce((s, r) => s + (r.amount_cents || 0), 0)
  const withdrawals7dCents = (withdrawals7dRes.data || []).reduce((s, r) => s + (r.amount_cents || 0), 0)

  // Build 7-day bar chart data (bucket by weekday)
  const bucketByDay = (rows, field = 'amount_cents') => {
    const buckets = Array(7).fill(0)
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 6); cutoff.setHours(0,0,0,0)
    ;(rows || []).forEach(r => {
      const d = new Date(r.created_at)
      const idx = Math.floor((d - cutoff) / 86400000)
      if (idx >= 0 && idx < 7) buckets[idx] += (r[field] || 0)
    })
    return last7DayLabels().map((label, i) => ({ label, value: buckets[i] }))
  }

  const depositsByDay    = bucketByDay(deposits7dRes.data)
  const withdrawalsByDay = bucketByDay(withdrawals7dRes.data)

  // Build 14-day signup sparkline
  const signupBuckets = Array(14).fill(0)
  const cutoff14 = new Date(); cutoff14.setDate(cutoff14.getDate() - 13); cutoff14.setHours(0,0,0,0)
  ;(signups14dRes.data || []).forEach(r => {
    const d = new Date(r.created_at)
    const idx = Math.floor((d - cutoff14) / 86400000)
    if (idx >= 0 && idx < 14) signupBuckets[idx]++
  })
  const signupsByDay = signupBuckets.map((value, i) => ({ value }))

  // Format recent transactions
  const recentTransactions = (recentTxRes.data || []).map(tx => ({
    reference_id: tx.reference_id,
    player_name: tx.profiles?.full_name || tx.user_id?.slice(0, 8),
    type: tx.direction === 'credit' ? 'deposit' : 'withdrawal',
    amount_cents: tx.amount_cents,
    status: 'approved',
    created_at: tx.created_at,
  }))

  return res.status(200).json({
    // Players
    total_players: playersRes.count || 0,
    new_players_today: newTodayRes.count || 0,
    new_players_14d: new14dRes.count || 0,
    signups_by_day: signupsByDay,

    // Financials
    total_deposits_cents: totalDepositsCents,
    deposits_count: depositsRes.data?.length || 0,
    total_withdrawals_cents: totalWithdrawalsCents,
    withdrawals_count: withdrawalsRes.data?.length || 0,

    // 7-day
    deposits_7d_cents: deposits7dCents,
    withdrawals_7d_cents: withdrawals7dCents,
    deposits_by_day: depositsByDay,
    withdrawals_by_day: withdrawalsByDay,

    // Queue counts
    pending_deposits: pendingDepRes.count || 0,
    pending_withdrawals: pendingWdRes.count || 0,
    pending_kyc: pendingKycRes.count || 0,
    open_tickets: openTicketsRes.count || 0,
    active_game_accounts: activeGARes.count || 0,
    pending_game_accounts: pendingGARes.count || 0,

    // Recent
    recent_transactions: recentTransactions,
  })
}
