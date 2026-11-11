/**
 * lib/statuses.js
 *
 * What "done" is called, per table.
 *
 * Every table picked a different word, and each one is enforced by a check
 * constraint, so guessing produces either a write the database refuses or a
 * filter that silently matches nothing:
 *
 *   deposits      approved
 *   withdrawals   paid
 *   game_loads    completed
 *   redemptions   completed
 *   kyc_records   verified
 *
 * Both failures have happened. Approving a withdrawal wrote 'approved' and
 * was refused every time. The wallet panel counted game loads and redeems
 * with status 'approved' — a value neither table can hold — so a player who
 * had loaded and redeemed showed zero scores.
 *
 * Import from here instead of typing the word.
 */
export const DONE = {
  deposits:    'approved',
  withdrawals: 'paid',
  game_loads:  'completed',
  redemptions: 'completed',
  kyc_records: 'verified',
}

/**
 * Rows that count as settled for totals. A couple of tables have an
 * in-between state that has already left the player's balance.
 */
export const SETTLED = {
  deposits:    ['approved'],
  withdrawals: ['paid'],
  game_loads:  ['completed', 'processing'],
  redemptions: ['completed', 'processing'],
}
