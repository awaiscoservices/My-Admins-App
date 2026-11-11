/**
 * POST /api/superadmin/defaults/apply   { tenant_id? }
 *
 * Gives casinos whatever they are missing from the platform defaults. With a
 * tenant_id it does one casino; without, every casino.
 *
 * Existing casinos were created before the defaults existed, so four of five
 * had no games, no payment methods and no referral tiers — they could not
 * take a deposit or set up a game account. This fills those gaps.
 *
 * A kind is only applied where the casino has none of it, so running this
 * twice changes nothing the second time and a casino configured by hand is
 * never overwritten.
 */
import { guardSuperAdmin, supabaseAdmin } from '../_guard'
import { applyDefaultsToTenant } from '../../../../lib/platformDefaults'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const admin = await guardSuperAdmin(req, res)
  if (!admin) return

  const { tenant_id } = req.body || {}

  let query = supabaseAdmin.from('tenants').select('id, name').order('created_at')
  if (tenant_id) query = query.eq('id', tenant_id)

  const { data: tenants, error } = await query
  if (error) return res.status(500).json({ error: error.message })
  if (!tenants?.length) return res.status(404).json({ error: 'No casino found' })

  const results = []
  for (const t of tenants) {
    const applied = await applyDefaultsToTenant(supabaseAdmin, t.id)
    const added = Object.values(applied).reduce((sum, r) => sum + (r.added || 0), 0)
    results.push({ tenant: t.name, added, detail: applied })
  }

  await supabaseAdmin.from('audit_logs').insert({
    actor_id: admin.id, actor_role: admin.role,
    action: 'platform_defaults_applied', target_type: 'tenants', target_id: tenant_id || 'all',
    description: `Defaults applied to ${results.length} casino${results.length === 1 ? '' : 's'}`,
  }).then(() => {}, () => {})

  return res.status(200).json({ ok: true, results })
}
