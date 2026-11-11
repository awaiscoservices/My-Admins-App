/**
 * POST /api/admin/levels/save
 *
 * A second, older level editor. Nothing in the UI calls it — the Player
 * Levels page posts to /api/admin/levels/upsert — but it is a live endpoint,
 * so it is corrected rather than left as a landmine:
 *
 *   - it wrote `color` and `icon`; the real columns are accent_color and
 *     badge_icon, so every call failed
 *   - its update filtered on id alone and carried tenant_id, so one casino's
 *     staff could overwrite another casino's level and move it to their own
 */
import { guardAdmin, loadOwnedRow, PERMS } from '../../../../lib/adminGuard'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const gate = await guardAdmin(req, res, { allow: PERMS.LEVELS_WRITE })
  if (!gate) return
  const supabaseAdmin = gate.db

  const { id, name, min_xp, color, accent_color, icon, badge_icon, perks } = req.body
  if (!name?.trim()) return res.status(400).json({ error: 'Name required' })
  if (min_xp == null) return res.status(400).json({ error: 'Min XP required' })

  const changes = {
    name:         name.trim(),
    min_xp:       parseInt(min_xp, 10),
    accent_color: accent_color || color || '#fbbf24',
    badge_icon:   badge_icon || icon || '⭐',
    perks:        perks || null,
  }

  let data, error
  if (id) {
    const { row: existing } = await loadOwnedRow(gate, 'player_levels', id, 'id')
    if (!existing) return res.status(404).json({ error: 'Level not found' })

    ;({ data, error } = await supabaseAdmin
      .from('player_levels').update(changes).eq('id', id).select().single())
  } else {
    if (!gate.tenantId) {
      return res.status(400).json({ error: 'Levels belong to a casino. Open the casino you want to add one to.' })
    }
    ;({ data, error } = await supabaseAdmin
      .from('player_levels').insert({ ...changes, tenant_id: gate.tenantId }).select().single())
  }

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ message: 'Saved', level: data })
}
