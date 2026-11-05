/**
 * GET /api/admin/players/wallet-summary?player_id=&tab=summary&page=1&limit=25
 *
 * Returns comprehensive wallet data for the 8-tab admin wallet modal.
 * Uses service role to bypass RLS.
 *
 * Tabs: summary | deposits | withdrawals | scores | redeems | transactions | player_level | bonuses
 *
 * Fix notes:
 *  - deposits.notes → player_notes  (column was renamed)
 *  - withdrawals/game_loads/redemptions: removed `notes` col (doesn't exist); explicit FK hint
 *    on profiles join (multiple FKs to profiles → must name the constraint)
 *  - ledger.notes → description  (column was renamed)
 */
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const ALLOWED_ROLES = ['super_admin', 'admin', 'finance', 'support', 'kyc_agent', 'risk', 'reporting', 'marketing']

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' })

  const { data: actor } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single()
  if (!actor || !ALLOWED_ROLES.includes(actor.role)) return res.status(403).json({ error: 'Forbidden' })

  const { player_id, tab = 'summary', page = '1', limit = '25' } = req.query
  if (!player_id) return res.status(400).json({ error: 'player_id required' })

  const pageNum  = Math.max(1, parseInt(page))
  const limitNum = Math.min(100, parseInt(limit))
  const offset   = (pageNum - 1) * limitNum

  // ── SUMMARY tab ─────────────────────────────────────────────────────────────
  if (tab === 'summary') {
    const [
      { data: wallet },
      { data: profile },
      { count: pendingDep },
      { count: pendingWd },
      { count: pendingScores },
      { count: pendingRedeem },
      { data: scores },
      { data: redeems },
      { data: levelHistory },
    ] = await Promise.all([
      supabaseAdmin.from('wallets').select('*').eq('user_id', player_id).single(),
      supabaseAdmin.from('profiles').select('id, player_level_id, current_level_id, player_levels(id,name,accent_color,min_xp,deposit_threshold_cents,display_order)').eq('id', player_id).single(),
      supabaseAdmin.from('deposits').select('*', { count: 'exact', head: true }).eq('user_id', player_id).eq('status', 'pending'),
      supabaseAdmin.from('withdrawals').select('*', { count: 'exact', head: true }).eq('user_id', player_id).eq('status', 'pending'),
      supabaseAdmin.from('game_loads').select('*', { count: 'exact', head: true }).eq('user_id', player_id).eq('status', 'pending'),
      supabaseAdmin.from('redemptions').select('*', { count: 'exact', head: true }).eq('user_id', player_id).eq('status', 'pending'),
      supabaseAdmin.from('game_loads').select('amount_cents').eq('user_id', player_id).eq('status', 'approved'),
      supabaseAdmin.from('redemptions').select('amount_cents,excess_cents').eq('user_id', player_id).eq('status', 'approved'),
      supabaseAdmin.from('player_level_history').select('*, from_level:from_level_id(name,accent_color), to_level:to_level_id(name,accent_color)').eq('user_id', player_id).order('created_at', { ascending: false }).limit(5),
    ])

    const totalScores = (scores || []).reduce((s, r) => s + (r.amount_cents || 0), 0)
    const totalRedeem = (redeems || []).reduce((s, r) => s + (r.amount_cents || 0), 0)
    const totalExcess = (redeems || []).reduce((s, r) => s + (r.excess_cents || 0), 0)

    const w = wallet || {}
    const levelId = profile?.player_level_id || profile?.current_level_id
    const currentLevel = profile?.player_levels || null

    // Next level
    let nextLevel = null
    if (currentLevel?.min_xp != null) {
      const { data: nl } = await supabaseAdmin
        .from('player_levels')
        .select('id, name, accent_color, min_xp, deposit_threshold_cents, display_order')
        .gt('display_order', currentLevel.display_order || 0)
        .order('display_order', { ascending: true })
        .limit(1)
        .maybeSingle()
      nextLevel = nl
    }

    const currentXp  = w.total_xp || 0
    const xpThresh   = nextLevel?.min_xp || currentLevel?.min_xp || 1
    const xpPct      = nextLevel ? Math.min(100, Math.round((currentXp / xpThresh) * 100)) : 100

    return res.status(200).json({
      summary: {
        total_deposit_cents:   w.total_deposited_cents || 0,
        total_withdraw_cents:  w.total_withdrawn_cents || 0,
        total_profit_cents:    (w.total_deposited_cents || 0) - totalRedeem,
        total_scores_cents:    totalScores,
        total_redeem_cents:    totalRedeem,
        total_balance_cents:   totalScores - totalRedeem,
        cash_balance_cents:    w.cash_balance_cents    || 0,
        bonus_balance_cents:   w.bonus_balance_cents   || 0,
        reserved_cents:        w.reserved_cents        || 0,
        withdrawable_cents:    w.withdrawable_cents    || 0,
        excess_scores_cents:   totalExcess,
        pending_deposit_count:  pendingDep   || 0,
        pending_withdraw_count: pendingWd    || 0,
        pending_scores_count:   pendingScores || 0,
        pending_redeem_count:   pendingRedeem || 0,
        current_level:   currentLevel ? { id: levelId, name: currentLevel.name, color: currentLevel.accent_color } : null,
        current_xp:      currentXp,
        next_level:      nextLevel,
        xp_progress_pct: xpPct,
        recent_level_changes: levelHistory || [],
      }
    })
  }

  // ── DEPOSITS tab ─────────────────────────────────────────────────────────────
  // FIX: `notes` → `player_notes` (column was renamed)
  // The reviewed_by FK is unique for deposits, no ambiguity expected.
  if (tab === 'deposits') {
    const { from_date, to_date, status } = req.query
    let q = supabaseAdmin.from('deposits')
      .select(
        'id, reference_id, amount_cents, bonus_cents, total_credit_cents, status, created_at, reviewed_at, player_notes,' +
        'payment_methods(name),' +
        'profiles!deposits_reviewed_by_fkey(full_name)',
        { count: 'exact' }
      )
      .eq('user_id', player_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limitNum - 1)
    if (status) q = q.eq('status', status)
    if (from_date) q = q.gte('created_at', from_date)
    if (to_date)   q = q.lte('created_at', to_date)
    const { data, count, error } = await q
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ rows: data || [], total: count || 0, page: pageNum, pages: Math.ceil((count || 0) / limitNum) })
  }

  // ── WITHDRAWALS tab ───────────────────────────────────────────────────────────
  // FIX: removed `notes` (doesn't exist); explicit FK hint for profiles join
  //      (withdrawals has user_id + reviewed_by + processed_by FKs → all point to profiles)
  if (tab === 'withdrawals') {
    const { from_date, to_date, status } = req.query
    let q = supabaseAdmin.from('withdrawals')
      .select(
        'id, reference_id, amount_cents, status, created_at, processed_at, method, destination,' +
        'profiles!withdrawals_reviewed_by_fkey(full_name)',
        { count: 'exact' }
      )
      .eq('user_id', player_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limitNum - 1)
    if (status) q = q.eq('status', status)
    if (from_date) q = q.gte('created_at', from_date)
    if (to_date)   q = q.lte('created_at', to_date)
    const { data, count, error } = await q
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ rows: data || [], total: count || 0, page: pageNum, pages: Math.ceil((count || 0) / limitNum) })
  }

  // ── SCORES tab ───────────────────────────────────────────────────────────────
  // FIX: removed `notes` (doesn't exist); explicit FK hint for profiles join
  //      (game_loads has user_id + reviewed_by + processed_by FKs → all point to profiles)
  // Note: game_panel_name and game_account_username are denormalized columns — no join needed.
  if (tab === 'scores') {
    const { from_date, to_date, status } = req.query
    let q = supabaseAdmin.from('game_loads')
      .select(
        'id, reference_id, amount_cents, status, wallet_bucket, game_panel_name, game_account_username, created_at, reviewed_at,' +
        'profiles!game_loads_reviewed_by_fkey(full_name)',
        { count: 'exact' }
      )
      .eq('user_id', player_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limitNum - 1)
    if (status) q = q.eq('status', status)
    if (from_date) q = q.gte('created_at', from_date)
    if (to_date)   q = q.lte('created_at', to_date)
    const { data, count, error } = await q
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ rows: data || [], total: count || 0, page: pageNum, pages: Math.ceil((count || 0) / limitNum) })
  }

  // ── REDEEMS tab ───────────────────────────────────────────────────────────────
  // FIX: removed `notes` (doesn't exist); explicit FK hint for profiles join
  //      (redemptions has user_id + reviewed_by + processed_by FKs → all point to profiles)
  // Note: game_panel_name and game_account_username are denormalized columns — no join needed.
  if (tab === 'redeems') {
    const { from_date, to_date, status } = req.query
    let q = supabaseAdmin.from('redemptions')
      .select(
        'id, reference_id, amount_cents, excess_cents, approved_cents, status, game_panel_name, game_account_username, created_at, reviewed_at,' +
        'profiles!redemptions_reviewed_by_fkey(full_name)',
        { count: 'exact' }
      )
      .eq('user_id', player_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limitNum - 1)
    if (status) q = q.eq('status', status)
    if (from_date) q = q.gte('created_at', from_date)
    if (to_date)   q = q.lte('created_at', to_date)
    const { data, count, error } = await q
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ rows: data || [], total: count || 0, page: pageNum, pages: Math.ceil((count || 0) / limitNum) })
  }

  // ── TRANSACTIONS tab ──────────────────────────────────────────────────────────
  // FIX: `notes` → `description` (ledger column was renamed)
  if (tab === 'transactions') {
    const { from_date, to_date, type } = req.query
    let q = supabaseAdmin.from('ledger')
      .select('id, type, wallet_bucket, amount_cents, direction, balance_after_cents, reference_id, description, created_at', { count: 'exact' })
      .eq('user_id', player_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limitNum - 1)
    if (type) q = q.eq('type', type)
    if (from_date) q = q.gte('created_at', from_date)
    if (to_date)   q = q.lte('created_at', to_date)
    const { data, count, error } = await q
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ rows: data || [], total: count || 0, page: pageNum, pages: Math.ceil((count || 0) / limitNum) })
  }

  // ── PLAYER LEVEL tab ──────────────────────────────────────────────────────────
  if (tab === 'player_level') {
    const [
      { data: history, count: hCount },
      { data: xpLog,   count: xCount },
    ] = await Promise.all([
      supabaseAdmin.from('player_level_history')
        .select('id, trigger, created_at, from_level:from_level_id(name,accent_color), to_level:to_level_id(name,accent_color), triggered_by_profile:triggered_by(full_name)', { count: 'exact' })
        .eq('user_id', player_id)
        .order('created_at', { ascending: false })
        .range(offset, offset + limitNum - 1),
      supabaseAdmin.from('player_xp_transactions')
        .select('id, xp_amount, source, reference_id, notes, created_at', { count: 'exact' })
        .eq('user_id', player_id)
        .order('created_at', { ascending: false })
        .range(offset, offset + limitNum - 1),
    ])
    return res.status(200).json({
      history: history || [], history_total: hCount || 0,
      xp_log:  xpLog   || [], xp_total:     xCount || 0,
      page: pageNum, pages: Math.ceil(Math.max(hCount || 0, xCount || 0) / limitNum),
    })
  }

  // ── BONUSES tab ───────────────────────────────────────────────────────────────
  // FIX: `notes` → `description` (ledger column was renamed)
  if (tab === 'bonuses') {
    const { from_date, to_date } = req.query
    let q = supabaseAdmin.from('ledger')
      .select('id, type, wallet_bucket, amount_cents, direction, balance_after_cents, reference_id, description, created_at', { count: 'exact' })
      .eq('user_id', player_id)
      .in('type', ['bonus', 'bonus_deposit', 'bonus_referral', 'bonus_adjustment', 'bonus_conversion'])
      .order('created_at', { ascending: false })
      .range(offset, offset + limitNum - 1)
    if (from_date) q = q.gte('created_at', from_date)
    if (to_date)   q = q.lte('created_at', to_date)
    const { data, count, error } = await q
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ rows: data || [], total: count || 0, page: pageNum, pages: Math.ceil((count || 0) / limitNum) })
  }

  return res.status(400).json({ error: `Unknown tab: ${tab}` })
}
