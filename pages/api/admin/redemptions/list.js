/**
 * GET /api/admin/redemptions/list?status=pending
 * Returns redemptions for the caller's own casino.
 * Super admins see redemptions across all casinos.
 * Uses explicit FK hint to avoid "more than one relationship" error.
 */
import { guardAdmin, scopeToTenant, PERMS } from '../../../../lib/adminGuard'
import { maskPlayer } from '../../../../lib/playerLabel'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const gate = await guardAdmin(req, res, { allow: PERMS.REDEMPTIONS_READ })
  if (!gate) return

  const { status = 'all' } = req.query

  // Explicit FK hint resolves "more than one relationship" error:
  //   redemptions_user_id_fkey      → the player
  //   redemptions_processed_by_fkey → the reviewer (not embedded here)
  let q = gate.db
    .from('redemptions')
    .select(`
      id, reference_id, amount_cents, approved_cents, status, created_at, admin_notes, reviewed_at, user_id,
      game_accounts ( id, game_username, game_panels ( name ) ),
      profiles!redemptions_user_id_fkey ( id, username )
    `)
    .order('created_at', { ascending: false })
    .limit(100)

  q = scopeToTenant(q, gate)

  if (status !== 'all') q = q.eq('status', status)

  const { data, error } = await q
  if (error) return res.status(400).json({ error: error.message })

  return res.status(200).json({ data: (data || []).map(r => ({ ...r, profiles: maskPlayer(r.profiles) })) })
}
