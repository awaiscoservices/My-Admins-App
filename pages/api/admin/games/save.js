import { guardAdmin, scopeToTenant, loadOwnedRow, PERMS } from '../../../../lib/adminGuard'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const gate = await guardAdmin(req, res, { allow: PERMS.GAMES_WRITE })
  if (!gate) return
  const supabaseAdmin = gate.db
  const user = gate.actor

  const { id, name, description, logo_url, is_active, min_load_cents, max_load_cents } = req.body
  if (!name?.trim()) return res.status(400).json({ error: 'Name required' })

  const payload = {
    tenant_id: gate.tenantId, name: name.trim(), description: description?.trim() || null, logo_url: logo_url?.trim() || null, is_active: !!is_active, min_load_cents: min_load_cents || 100, max_load_cents: max_load_cents || 500000 }

  let data, error
  if (id) {
    ({ data, error } = await supabaseAdmin.from('game_panels').update(payload).eq('id', id).select().single())
  } else {
    ({ data, error } = await supabaseAdmin.from('game_panels').insert(payload).select().single())
  }
  if (error) return res.status(500).json({ error: error.message })

  await supabaseAdmin.from('audit_logs').insert({ actor_id: user.id, action: id ? 'game_updated' : 'game_created', target_type: 'game_panels', target_id: data.id, details: payload }).then(() => {}, () => {})
  return res.status(200).json({ message: 'Saved', game: data })
}
