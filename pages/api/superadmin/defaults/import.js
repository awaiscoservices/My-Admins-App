/**
 * POST /api/superadmin/defaults/import  { tenant_id }
 *
 * Copies one casino's player levels into the platform defaults, so the
 * defaults can be filled from a casino that is already set up the way you
 * want without typing nine levels by hand.
 *
 * It is a one-time copy, not a link: changing that casino afterwards does
 * not change the defaults, and deleting it does not empty them.
 */
import { guardSuperAdmin, supabaseAdmin } from '../_guard'
import { DEFAULTS_KEY, SETTINGS_KEY, stripRow } from './levels'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const admin = await guardSuperAdmin(req, res)
  if (!admin) return

  const { tenant_id } = req.body || {}
  if (!tenant_id) return res.status(400).json({ error: 'Pick a casino to copy from' })

  const { data: tenant } = await supabaseAdmin
    .from('tenants').select('id, name').eq('id', tenant_id).maybeSingle()
  if (!tenant) return res.status(404).json({ error: 'That casino does not exist' })

  const { data: rows, error } = await supabaseAdmin
    .from('player_levels')
    .select('*')
    .eq('tenant_id', tenant_id)
    .order('sort_order', { ascending: true })

  if (error) return res.status(500).json({ error: error.message })
  if (!rows?.length) return res.status(400).json({ error: `${tenant.name} has no player levels to copy` })

  const clean = rows.map(stripRow)

  const { error: saveErr } = await supabaseAdmin.from('platform_defaults').upsert({
    key:        DEFAULTS_KEY,
    value:      clean,
    updated_at: new Date().toISOString(),
    updated_by: admin.id,
  }, { onConflict: 'key' })

  if (saveErr) return res.status(500).json({ error: saveErr.message })

  // Settings come along for the ride. They had the same problem — copied
  // from the first casino at creation — and the withdrawal approval path
  // reads one of them, so a casino without them is not safe to run.
  let settings_copied = 0
  const { data: settingRows } = await supabaseAdmin
    .from('platform_settings')
    .select('key, value, description')
    .eq('tenant_id', tenant_id)

  if (settingRows?.length) {
    const { error: setErr } = await supabaseAdmin.from('platform_defaults').upsert({
      key:        SETTINGS_KEY,
      value:      settingRows,
      updated_at: new Date().toISOString(),
      updated_by: admin.id,
    }, { onConflict: 'key' })
    if (!setErr) settings_copied = settingRows.length
    else console.error('[defaults/import] settings copy failed:', setErr)
  }

  await supabaseAdmin.from('audit_logs').insert({
    actor_id:    admin.id,
    actor_role:  admin.role,
    action:      'default_levels_imported',
    target_type: 'platform_defaults',
    target_id:   DEFAULTS_KEY,
    description: `Default player levels copied from ${tenant.name} (${clean.length})`,
  }).then(() => {}, () => {})

  return res.status(200).json({ ok: true, levels: clean, settings_copied, from: tenant.name })
}
