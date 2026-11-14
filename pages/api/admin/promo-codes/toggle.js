/**
 * POST /api/admin/promo-codes/toggle
 * Activate / deactivate a promo campaign for the caller's casino.
 */
import { guardAdmin, loadOwnedRow, tenantOf, PERMS } from '../../../../lib/adminGuard'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const gate = await guardAdmin(req, res, { allow: PERMS.PROMOS_WRITE })
  if (!gate) return
  const db = gate.db
  const admin = gate.actor

  const { id, is_active } = req.body
  if (!id) return res.status(400).json({ error: 'id required' })

  const { row, error: loadErr } = await loadOwnedRow(gate, 'promotions', id)
  if (loadErr || !row) return res.status(404).json({ error: 'Promo not found' })

  const { error } = await db.from('promotions').update({ is_active: !!is_active, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) return res.status(500).json({ error: error.message })

  await db.from('audit_logs').insert({
    tenant_id: tenantOf(row, gate), actor_id: admin.id, actor_role: admin.role,
    action: 'promo_code_toggle', target_type: 'promotion', target_id: id,
    description: `Promo ${row.code} ${is_active ? 'activated' : 'deactivated'}`,
    metadata: { code: row.code, is_active: !!is_active },
  }).then(() => {}, () => {})

  return res.status(200).json({ success: true })
}
