/**
 * GET /api/admin/game-loads/list?status=pending
 * Returns game loads for the caller's own casino.
 * Super admins see loads across all casinos.
 * Uses explicit FK hint to avoid "more than one relationship" error.
 */
import { guardAdmin, scopeToTenant, PERMS } from '../../../../lib/adminGuard'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const gate = await guardAdmin(req, res, { allow: PERMS.GAME_LOADS_READ })
  if (!gate) return

  const { status = 'all' } = req.query

  // Explicit FK hint resolves "more than one relationship" error:
  //   game_loads_user_id_fkey      → the player
  //   game_loads_processed_by_fkey → the reviewer (not embedded here)
  let q = gate.db
    .from('game_loads')
    .select(`
      id, reference_id, amount_cents, status, created_at, admin_notes, reviewed_at,
      wallet_bucket, game_account_username, game_panel_name,
      game_accounts ( id, game_username, game_panels ( name ) ),
      profiles!game_loads_user_id_fkey ( id, full_name, email )
    `)
    .order('created_at', { ascending: false })
    .limit(100)

  q = scopeToTenant(q, gate)

  if (status !== 'all') q = q.eq('status', status)

  const { data, error } = await q
  if (error) return res.status(400).json({ error: error.message })

  return res.status(200).json({ data })
}
