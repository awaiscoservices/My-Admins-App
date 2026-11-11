/**
 * GET /api/admin/pending-counts
 * The six pending-queue counts behind the sidebar badges and topbar tabs.
 *
 * These are counts, not payloads, but an unscoped count still tells one
 * casino's staff how much business another is doing — and it showed on every
 * page, so it was the most visible leak in the panel.
 */
import { guardAdmin, scopeToTenant, PERMS } from '../../../lib/adminGuard'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const gate = await guardAdmin(req, res, { allow: PERMS.PENDING_COUNTS })
  if (!gate) return

  const pending = (table) => scopeToTenant(
    gate.db.from(table).select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    gate,
  )

  // A password change leaves the account active on purpose — the old
  // password has to keep working until staff replace it — so it is not a
  // 'pending' row and the Games badge never counted it. It is still work
  // waiting for staff, so it is counted here alongside new accounts.
  const passwordRequests = scopeToTenant(
    gate.db.from('game_accounts').select('*', { count: 'exact', head: true })
      .eq('password_change_requested', true),
    gate,
  )

  const [deposits, withdrawals, scores, redeems, kyc, games, passwords] = await Promise.all([
    pending('deposits'),
    pending('withdrawals'),
    pending('game_loads'),
    pending('redemptions'),
    pending('kyc_records'),
    pending('game_accounts'),
    passwordRequests,
  ])

  return res.status(200).json({
    deposit_requests:  deposits.count    || 0,
    withdraw_requests: withdrawals.count || 0,
    scores_requests:   scores.count      || 0,
    redeem_requests:   redeems.count     || 0,
    kyc_requests:      kyc.count         || 0,
    game_requests:     (games.count || 0) + (passwords.count || 0),
  })
}
