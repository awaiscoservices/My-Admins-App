/**
 * POST /api/admin/bonuses/delete
 * Delete a player bonus tier. super_admin only.
 */
import { guardAdmin, scopeToTenant, loadOwnedRow, PERMS } from '../../../../lib/adminGuard'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const gate = await guardAdmin(req, res, { allow: PERMS.BONUSES_WRITE })
  if (!gate) return
  const supabaseAdmin = gate.db
  const user = gate.actor

  const { id } = req.body
  if (!id) return res.status(400).json({ error: 'id is required' })

  const { error } = await supabaseAdmin.from('player_bonuses').delete().eq('id', id)
  if (error) return res.status(500).json({ error: error.message })

  await supabaseAdmin.from('audit_logs').insert({
    action: 'bonus_tier_delete',
    performed_by: user.id,
    target_type: 'player_bonus',
    target_id: id,
    details: {},
  })

  return res.status(200).json({ success: true })
}
