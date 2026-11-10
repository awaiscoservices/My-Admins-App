import { guardAdmin, scopeToTenant, loadOwnedRow, PERMS } from '../../../../lib/adminGuard'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const gate = await guardAdmin(req, res, { allow: PERMS.LEVELS_WRITE })
  if (!gate) return
  const supabaseAdmin = gate.db

  const { id, name, min_xp, color, icon, perks } = req.body
  if (!name?.trim()) return res.status(400).json({ error: 'Name required' })
  if (min_xp == null) return res.status(400).json({ error: 'Min XP required' })

  const payload = {
    tenant_id: gate.tenantId, name: name.trim(), min_xp: parseInt(min_xp), color: color || '#fbbf24', icon: icon || '⭐', perks: perks || null }

  let data, error
  if (id) {
    ({ data, error } = await supabaseAdmin.from('player_levels').update(payload).eq('id', id).select().single())
  } else {
    ({ data, error } = await supabaseAdmin.from('player_levels').insert(payload).select().single())
  }
  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ message: 'Saved', level: data })
}
