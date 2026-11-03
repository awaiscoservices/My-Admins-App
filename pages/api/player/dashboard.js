/**
 * GET /api/player/dashboard
 *
 * Returns everything the player dashboard needs in one call:
 * - wallet balances
 * - current level + XP progress to next level
 * - game accounts with eligibility snapshots
 * - daily withdrawal used / remaining
 * - recent transactions (last 10 ledger rows)
 */
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' })

  const uid = user.id

  // Fetch all in parallel
  const [profileRes, walletRes, gameAccountsRes, ledgerRes, dailyRes] = await Promise.all([
    supabaseAdmin
      .from('profiles')
      .select('*, player_levels(*)')
      .eq('id', uid)
      .single(),

    supabaseAdmin
      .from('wallets')
      .select('cash_balance_cents, bonus_balance_cents, total_deposited_cents, total_loaded_cents, total_redeemed_cents, total_withdrawn_cents')
      .eq('user_id', uid)
      .single(),

    supabaseAdmin
      .from('game_accounts')
      .select('id, game_username, game_id, status, game_panels(name), game_redemption_eligibility(eligible_cents, remaining_cents, total_loaded_cents, total_redeemed_cents, multiplier_used)')
      .eq('user_id', uid)
      .eq('status', 'active'),

    supabaseAdmin
      .from('ledger')
      .select('type, amount_cents, direction, wallet_bucket, description, created_at')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(10),

    supabaseAdmin.rpc('get_daily_withdrawn_cents', { p_user_id: uid }),
  ])

  if (profileRes.error) return res.status(500).json({ error: 'Profile fetch failed' })

  const profile = profileRes.data
  const level   = profile.player_levels
  const wallet  = walletRes.data || {}

  // XP progress to next level
  let nextLevel     = null
  let xpToNext      = null
  let xpProgress    = 100  // % — default 100 if at max level

  if (level) {
    const { data: levels } = await supabaseAdmin
      .from('player_levels')
      .select('id, name, min_xp, accent_color')
      .eq('is_active', true)
      .order('min_xp', { ascending: true })

    if (levels) {
      const idx = levels.findIndex(l => l.id === level.id)
      if (idx >= 0 && idx < levels.length - 1) {
        nextLevel  = levels[idx + 1]
        xpToNext   = nextLevel.min_xp - profile.total_xp
        const span = nextLevel.min_xp - level.min_xp
        xpProgress = span > 0 ? Math.min(100, Math.round(((profile.total_xp - level.min_xp) / span) * 100)) : 100
      }
    }
  }

  // Daily withdrawal
  const dailyWithdrawn = dailyRes.data || 0
  const dailyLimit     = level?.daily_withdrawal_limit_cents || 50000
  const dailyRemaining = Math.max(0, dailyLimit - dailyWithdrawn)

  // Game accounts with eligibility
  const gameAccounts = (gameAccountsRes.data || []).map(ga => {
    const elig = ga.game_redemption_eligibility?.[0] || ga.game_redemption_eligibility || null
    return {
      id:           ga.id,
      username:     ga.game_username,
      game_id:      ga.game_id,
      panel_name:   ga.game_panels?.name || null,
      status:       ga.status,
      eligibility: elig ? {
        eligible_cents:     elig.eligible_cents,
        remaining_cents:    elig.remaining_cents,
        total_loaded_cents: elig.total_loaded_cents,
        total_redeemed_cents: elig.total_redeemed_cents,
        multiplier_used:    elig.multiplier_used,
      } : null,
    }
  })

  return res.status(200).json({
    profile: {
      id:       uid,
      name:     profile.full_name,
      email:    profile.email,
      kyc_status: profile.kyc_status,
      total_xp: profile.total_xp,
    },
    level: level ? {
      id:            level.id,
      name:          level.name,
      accent_color:  level.accent_color,
      min_xp:        level.min_xp,
      deposit_bonus_pct: level.deposit_bonus_pct,
      bonus_to_cash_pct: level.bonus_to_cash_pct,
      daily_withdrawal_limit_cents: level.daily_withdrawal_limit_cents,
    } : null,
    xp: {
      current:     profile.total_xp,
      progress_pct: xpProgress,
      to_next:     xpToNext,
      next_level:  nextLevel ? { id: nextLevel.id, name: nextLevel.name, min_xp: nextLevel.min_xp } : null,
    },
    wallet: {
      cash_balance_cents:    wallet.cash_balance_cents    || 0,
      bonus_balance_cents:   wallet.bonus_balance_cents   || 0,
      total_deposited_cents: wallet.total_deposited_cents || 0,
      total_loaded_cents:    wallet.total_loaded_cents    || 0,
      total_redeemed_cents:  wallet.total_redeemed_cents  || 0,
      total_withdrawn_cents: wallet.total_withdrawn_cents || 0,
    },
    withdrawal_today: {
      withdrawn_cents: dailyWithdrawn,
      limit_cents:     dailyLimit,
      remaining_cents: dailyRemaining,
      pct_used:        dailyLimit > 0 ? Math.round((dailyWithdrawn / dailyLimit) * 100) : 0,
    },
    game_accounts: gameAccounts,
    recent_transactions: ledgerRes.data || [],
  })
}
