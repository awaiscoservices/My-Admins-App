/**
 * GET /api/superadmin/dashboard
 * Platform-wide stats for the super admin overview page.
 */
import { guardSuperAdmin, supabaseAdmin } from './_guard'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const admin = await guardSuperAdmin(req, res)
  if (!admin) return

  // All counts in parallel
  const [
    { count: total },
    { count: active },
    { count: suspended },
    { count: domains },
    { count: players },
  ] = await Promise.all([
    supabaseAdmin.from('tenants').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('tenants').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabaseAdmin.from('tenants').select('id', { count: 'exact', head: true }).eq('status', 'suspended'),
    supabaseAdmin.from('tenant_domains').select('id', { count: 'exact', head: true }),
    // Platform-wide, every casino's players together — the one number that
    // says how big the whole thing is, which the tenant counts do not.
    supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'player'),
  ])

  // New this month
  const monthStart = new Date()
  monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)
  const { count: new_month } = await supabaseAdmin
    .from('tenants')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', monthStart.toISOString())

  // Recent 10 tenants
  const { data: recent } = await supabaseAdmin
    .from('tenants')
    .select('id, name, slug, status, created_at')
    .order('created_at', { ascending: false })
    .limit(10)

  return res.status(200).json({
    stats: { total, active, suspended, domains, players, new_month },
    recent: recent || [],
  })
}
