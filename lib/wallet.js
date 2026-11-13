import { supabase } from './supabase'

/**
 * Get wallet for current user
 */
export async function getMyWallet(userId) {
  const { data, error } = await supabase
    .from('wallets')
    .select('*')
    .eq('user_id', userId)
    .single()
  if (error) throw error
  return data
}

/**
 * Get recent ledger transactions for a user
 */
export async function getMyTransactions(userId, { limit = 20, offset = 0, type } = {}) {
  let query = supabase
    .from('ledger')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (type) query = query.eq('type', type)

  const { data, error } = await query
  if (error) throw error
  return data
}

/**
 * Get recent deposits for a user
 */
export async function getMyDeposits(userId, { limit = 10 } = {}) {
  const { data, error } = await supabase
    .from('deposits')
    .select('*, payment_methods(name, type, icon)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}

/**
 * Get recent game loads for a user
 */
export async function getMyGameLoads(userId, { limit = 10 } = {}) {
  const { data, error } = await supabase
    .from('game_loads')
    .select('*, game_accounts(game_username, game_panels(name, logo_url))')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}

/**
 * Get recent redemptions for a user
 */
export async function getMyRedemptions(userId, { limit = 10 } = {}) {
  const { data, error } = await supabase
    .from('redemptions')
    .select('*, game_accounts(game_username, game_panels(name, logo_url))')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}

/**
 * Get player's game accounts
 */
export async function getMyGameAccounts(userId) {
  const { data, error } = await supabase
    .from('game_accounts')
    .select('*, game_panels(name, logo_url, accent_color, slug)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

/**
 * Get pending counts for dashboard summary
 */
export async function getMyPendingCounts(userId) {
  const [deposits, loads, redeems, withdrawals] = await Promise.all([
    supabase.from('deposits').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'pending'),
    supabase.from('game_loads').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'pending'),
    supabase.from('redemptions').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'pending'),
    supabase.from('withdrawals').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'pending'),
  ])
  return {
    deposits: deposits.count || 0,
    loads: loads.count || 0,
    redeems: redeems.count || 0,
    withdrawals: withdrawals.count || 0,
  }
}

/**
 * Format transaction type to human-readable label
 */
export function txTypeLabel(type) {
  const labels = {
    deposit:                    'Deposit',
    deposit_bonus:              'Deposit Bonus',
    game_load:                  'Game Load',
    game_load_reserve:          'Load Reserved',
    game_load_reserve_release:  'Load Released',
    redeem:                     'Redeem',
    redeem_reserve:             'Redeem Reserved',
    redeem_reserve_release:     'Redeem Released',
    withdrawal:                 'Withdraw',
    withdrawal_reserve:         'Withdraw Reserved',
    withdrawal_reserve_release: 'Withdraw Released',
    referral_bonus:             'Referral Bonus',
    level_bonus:                'Level Bonus',
    adjustment_credit:          'Admin Credit',
    adjustment_debit:           'Admin Debit',
    promotion_credit:           'Promotion Credit',
    refund:                     'Refund',
  }
  return labels[type] || type
}

/**
 * Get color for transaction type
 */
export function txTypeColor(type) {
  const credits = ['deposit','deposit_bonus','redeem','referral_bonus','level_bonus','adjustment_credit','promotion_credit','refund','game_load_reserve_release','redeem_reserve_release','withdrawal_reserve_release']
  return credits.includes(type) ? '#10b981' : '#f87171'
}
