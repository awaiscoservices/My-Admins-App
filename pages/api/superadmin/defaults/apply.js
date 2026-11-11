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
import { applyDefaultsToTenant, pushDefaultsToTenant } from '../../../../lib/platformDefaults'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const admin = await guardSuperAdmin(req, res)
  if (!admin) return

  // 'fill' gives a casino a kind only when it has none of it — the catch-up
  // for casinos made before the defaults existed. 'push' compares row by row,
  // so a game added to the defaults today reaches casinos that already have
  // the others. Neither ever changes a row a casino already holds.
  const { tenant_id, mode } = req.body || {}
  const push = mode === 'push'

  let query = supabaseAdmin.from('tenants').select('id, name').order('created_at')
  if (tenant_id) query = query.eq('id', tenant_id)

  const { data: tenants, error } = await query
  if (error) return res.status(500).json({ error: error.message })
  if (!tenants?.length) return res.status(404).json({ error: 'No casino found' })

  const results = []
  for (const t of tenants) {
    const applied = push
      ? await pushDefaultsToTenant(supabaseAdmin, t.id)
      : await applyDefaultsToTenant(supabaseAdmin, t.id)
    const added = Object.values(applied).reduce((sum, r) => sum + (r.added || 0), 0)

    // A kind that added nothing because something went wrong is worth seeing,
    // rather than reading as "nothing was missing".
    const failed = Object.entries(applied)
      .filter(([, r]) => r.reason && !String(r.reason).startsWith('already has'))
      .map(([k, r]) => `${k}: ${r.reason}`)

    results.push({ tenant: t.name, added, failed, detail: applied })
  }

  await supabaseAdmin.from('audit_logs').insert({
    actor_id: admin.id, actor_role: admin.role,
    action: push ? 'platform_defaults_pushed' : 'platform_defaults_applied',
    target_type: 'tenants', target_id: tenant_id || 'all',
    description: `Defaults ${push ? 'pushed' : 'applied'} to ${results.length} casino${results.length === 1 ? '' : 's'}`,
  }).then(() => {}, () => {})

  return res.status(200).json({ ok: true, results })
}
