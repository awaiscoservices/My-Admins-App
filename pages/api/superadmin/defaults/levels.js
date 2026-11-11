/**
 * GET  /api/superadmin/defaults/levels  → the default player levels
 * PUT  /api/superadmin/defaults/levels  → replace them  { levels: [...] }
 *
 * These are the levels every new casino is created with. They live in
 * platform_defaults, which belongs to no casino, so deleting any casino —
 * including the first one — does not change what a new casino gets.
 *
 * A level is stored as the whole row object minus the columns that belong to
 * a particular casino (id, tenant_id, created_at). No column is named here,
 * so the defaults keep working when player_levels changes.
 */
import { guardSuperAdmin, supabaseAdmin } from '../_guard'

export const DEFAULTS_KEY = 'player_levels'
export const SETTINGS_KEY = 'platform_settings'

/** Columns that identify one casino's row and must never be stored. */
const STRIP = ['id', 'tenant_id', 'created_at', 'updated_at']

export function stripRow(row) {
  const out = { ...row }
  for (const k of STRIP) delete out[k]
  return out
}

export async function readDefaultLevels() {
  const { data, error } = await supabaseAdmin
    .from('platform_defaults')
    .select('value, updated_at')
    .eq('key', DEFAULTS_KEY)
    .maybeSingle()

  if (error) return { levels: [], updated_at: null, error }
  const value = data?.value
  return { levels: Array.isArray(value) ? value : [], updated_at: data?.updated_at || null, error: null }
}

/**
 * The settings a new casino starts with. Stored the same way and for the
 * same reason: the withdrawal path reads one of these while approving a
 * payout, and copying them from the first casino meant deleting that casino
 * would leave every new casino without them.
 */
export async function readDefaultSettings() {
  const { data } = await supabaseAdmin
    .from('platform_defaults')
    .select('value')
    .eq('key', SETTINGS_KEY)
    .maybeSingle()

  return Array.isArray(data?.value) ? data.value : []
}

export default async function handler(req, res) {
  const admin = await guardSuperAdmin(req, res)
  if (!admin) return

  if (req.method === 'GET') {
    const { levels, updated_at, error } = await readDefaultLevels()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ levels, updated_at })
  }

  if (req.method === 'PUT') {
    const { levels } = req.body || {}
    if (!Array.isArray(levels)) return res.status(400).json({ error: 'levels must be an array' })
    if (levels.length > 50)     return res.status(400).json({ error: 'That is more levels than a casino can use' })

    for (const [i, l] of levels.entries()) {
      if (!l || typeof l !== 'object') return res.status(400).json({ error: `Level ${i + 1} is not valid` })
      if (!String(l.name || '').trim()) return res.status(400).json({ error: `Level ${i + 1} needs a name` })
    }

    // Keep every other column each level already carries; only the identity
    // columns are dropped.
    const clean = levels.map(stripRow)

    const { error } = await supabaseAdmin.from('platform_defaults').upsert({
      key:        DEFAULTS_KEY,
      value:      clean,
      updated_at: new Date().toISOString(),
      updated_by: admin.id,
    }, { onConflict: 'key' })

    if (error) return res.status(500).json({ error: error.message })

    await supabaseAdmin.from('audit_logs').insert({
      actor_id:    admin.id,
      actor_role:  admin.role,
      action:      'default_levels_updated',
      target_type: 'platform_defaults',
      target_id:   DEFAULTS_KEY,
      description: `Default player levels set to ${clean.length} level${clean.length === 1 ? '' : 's'}`,
    }).then(() => {}, () => {})

    return res.status(200).json({ ok: true, levels: clean })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
