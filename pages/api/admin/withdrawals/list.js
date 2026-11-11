/**
 * GET /api/admin/withdrawals/list?status=pending
 * Returns withdrawals for the caller's own casino.
 * Super admins see withdrawals across all casinos.
 * Uses explicit FK hints to avoid "more than one relationship" error.
 */
import { guardAdmin, scopeToTenant, PERMS } from '../../../../lib/adminGuard'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const gate = await guardAdmin(req, res, { allow: PERMS.WITHDRAWALS_READ })
  if (!gate) return

  const { status = 'all' } = req.query

  // Explicit FK hints resolve "more than one relationship" error:
  //   withdrawals_user_id_fkey      → the player
  //   withdrawals_processed_by_fkey → the reviewer (not embedded here)
  let q = gate.db
    .from('withdrawals')
    .select(`
      id, reference_id, amount_cents, status, created_at, admin_notes, reviewed_at,
      payment_method_id, user_id, method, destination, payout_label,
      profiles!withdrawals_user_id_fkey ( id, full_name, email ),
      player_levels ( name, daily_withdrawal_limit_cents )
    `)
    .order('created_at', { ascending: false })
    .limit(100)

  q = scopeToTenant(q, gate)

  if (status !== 'all') q = q.eq('status', status)

  const { data, error } = await q
  if (error) return res.status(400).json({ error: error.message })

  return res.status(200).json({ data })
}
