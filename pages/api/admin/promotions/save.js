import { guardAdmin, scopeToTenant, loadOwnedRow, PERMS } from '../../../../lib/adminGuard'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const gate = await guardAdmin(req, res, { allow: PERMS.PROMOS_WRITE })
  if (!gate) return
  const supabaseAdmin = gate.db

  const { id, name, description, bonus_pct, bonus_flat_cents, min_deposit_cents, max_bonus_cents, is_active, starts_at, ends_at } = req.body
  if (!name?.trim()) return res.status(400).json({ error: 'Name required' })

  const payload = {
    tenant_id: gate.tenantId, name: name.trim(), description: description?.trim() || null, bonus_pct: bonus_pct || 0, bonus_flat_cents: bonus_flat_cents || 0, min_deposit_cents: min_deposit_cents || 0, max_bonus_cents: max_bonus_cents || null, is_active: !!is_active, starts_at: starts_at || null, ends_at: ends_at || null }

  let data, error
  if (id) {
    ({ data, error } = await supabaseAdmin.from('promotions').update(payload).eq('id', id).select().single())
  } else {
    ({ data, error } = await supabaseAdmin.from('promotions').insert(payload).select().single())
  }
  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ message: 'Saved', promotion: data })
}
