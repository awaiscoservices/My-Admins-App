/**
 * Single source of truth for ledger transaction display — labels, colors,
 * ordering and the filter categories. Every admin view that shows ledger
 * rows (Transactions page, Player wallet modal, player detail page) imports
 * from here so the categories, labels and sequence never drift. These labels
 * mirror the player app's transactions view (lib/txMeta on that side) so a
 * row reads the same wherever an admin or player looks.
 */

// Ledger type → how it shows. Labels match the player app exactly.
export const TYPE_META = {
  deposit:           { label: 'Deposit',        color: '#22c55e', icon: 'arrowDown' },
  deposit_bonus:     { label: 'Deposit Bonus',  color: '#fbbf24', icon: 'gift' },
  promotion_credit:  { label: 'Promo Bonus',    color: '#fbbf24', icon: 'gift' },
  referral_bonus:    { label: 'Referral Bonus', color: '#a855f7', icon: 'users' },
  level_bonus:       { label: 'Level Bonus',    color: '#fbbf24', icon: 'star' },
  bonus:             { label: 'Bonus',          color: '#fbbf24', icon: 'gift' },
  withdrawal:        { label: 'Withdraw',       color: '#ef4444', icon: 'arrowUp' },
  withdrawal_refund: { label: 'Withdraw Refund',color: '#06b6d4', icon: 'arrowDown' },
  withdrawal_hold:   { label: 'Withdraw',       color: '#ef4444', icon: 'arrowUp' },
  game_load:         { label: 'Scores',         color: '#ef4444', icon: 'gamepad' },
  game_load_refund:  { label: 'Score Refund',   color: '#06b6d4', icon: 'arrowDown' },
  game_load_return:  { label: 'Score Refund',   color: '#06b6d4', icon: 'arrowDown' },
  redeem:            { label: 'Redeem',         color: '#22c55e', icon: 'coins' },
  redemption:        { label: 'Redeem',         color: '#22c55e', icon: 'coins' },
  spin_bet:          { label: 'Spin Bet',       color: '#f97316', icon: 'wheel' },
  spin_win:          { label: 'Spin Win',       color: '#fbbf24', icon: 'wheel' },
  adjustment:        { label: 'Adjustment',     color: '#a855f7', icon: 'gear' },
  adjustment_credit: { label: 'Adjustment',     color: '#22c55e', icon: 'gear' },
  adjustment_debit:  { label: 'Adjustment',     color: '#ef4444', icon: 'gear' },
  refund:            { label: 'Refund',         color: '#06b6d4', icon: 'arrowDown' },
}

// Prettify an unknown type: "some_new_type" → "Some New Type".
export const prettify  = t => (t || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
export const typeLabel = t => TYPE_META[t]?.label || prettify(t) || '—'
export const typeColor = t => TYPE_META[t]?.color || 'rgba(255,255,255,.5)'
export const typeIcon  = t => TYPE_META[t]?.icon  || 'list'

// The ledger types shown under the "Bonuses" filter — every bonus credit plus
// wheel (spin) activity, since the wheel runs on the Bonus balance.
export const BONUS_TYPES = ['deposit_bonus', 'promotion_credit', 'referral_bonus', 'level_bonus', 'bonus', 'spin_win', 'spin_bet']

// Unified filter categories, in display order. Same set and sequence the
// player app uses for its transaction tabs, with Adjustments added for admins.
// `types: null` on "all" means no filter. Each category maps to the concrete
// ledger types it covers, so a filter spanning several types stays in sync.
export const CATEGORIES = [
  { key: 'all',        label: 'All',         types: null },
  { key: 'deposit',    label: 'Deposits',    types: ['deposit'] },
  { key: 'withdrawal', label: 'Withdraws',   types: ['withdrawal', 'withdrawal_refund', 'withdrawal_hold'] },
  { key: 'scores',     label: 'Scores',      types: ['game_load', 'game_load_refund', 'game_load_return'] },
  { key: 'redeem',     label: 'Redeems',     types: ['redeem', 'redemption'] },
  { key: 'bonus',      label: 'Bonuses',     types: BONUS_TYPES },
  { key: 'adjustment', label: 'Adjustments', types: ['adjustment', 'adjustment_credit', 'adjustment_debit'] },
]

// category key → concrete ledger types (for server-side `.in()` filtering).
export const categoryTypes = key => (CATEGORIES.find(c => c.key === key)?.types) || null
