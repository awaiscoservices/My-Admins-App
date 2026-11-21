import { guardAdmin, loadOwnedRow, PERMS } from '../../../../lib/adminGuard'

/**
 * POST /api/admin/games/upsert
 *   create: { name, panel_url, accent_color, description, is_active }
 *   update: { game_id, ...same fields }
 *
 * Backs the Panels Management Add/Edit modal. Persists only columns that exist
 * on game_panels and that the form edits. (The old version wrote a `code`
 * column that doesn't exist — so every save failed — read `id` while the page
 * posts `game_id`, and dropped panel_url/accent_color.)
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const gate = await guardAdmin(req, res, { allow: PERMS.GAMES_WRITE })
  if (!gate) return
  const supabaseAdmin = gate.db
  const admin = gate.actor

  const { id, game_id, name, panel_url, accent_color, description, is_active } = req.body
  const panelId = game_id || id
  if (!name?.trim()) return res.status(400).json({ error: 'Name required' })

  const payload = {
    tenant_id: gate.tenantId,
    name: name.trim(),
    panel_url: panel_url?.trim() || null,
    accent_color: accent_color || null,
    description: description?.trim() || null,
    is_active: is_active !== false,
    updated_at: new Date().toISOString(),
  }

  if (panelId) {
    // Tenant-scoped: an admin can only edit a panel in their own casino.
    const { row: existing } = await loadOwnedRow(gate, 'game_panels', panelId, 'id')
    if (!existing) return res.status(404).json({ error: 'Game not found' })
    const { error } = await supabaseAdmin.from('game_panels').update(payload).eq('id', panelId)
    if (error) return res.status(500).json({ error: error.message })
    await supabaseAdmin.from('audit_logs').insert({ tenant_id: gate.tenantId, actor_id: admin.id, actor_role: admin.role, action: 'game_update', target_type: 'game_panel', target_id: panelId, description: `Game panel updated: ${payload.name}`, metadata: { name: payload.name } }).then(() => {}, () => {})
    return res.status(200).json({ success: true, id: panelId })
  }

  const { data, error } = await supabaseAdmin.from('game_panels').insert({ ...payload, created_at: new Date().toISOString() }).select('id').single()
  if (error) return res.status(500).json({ error: error.message })
  await supabaseAdmin.from('audit_logs').insert({ tenant_id: gate.tenantId, actor_id: admin.id, actor_role: admin.role, action: 'game_create', target_type: 'game_panel', target_id: data.id, description: `Game panel created: ${payload.name}`, metadata: { name: payload.name } }).then(() => {}, () => {})
  return res.status(200).json({ success: true, id: data.id })
}
