/**
 * pages/api/superadmin/_guard.js
 * Shared auth guard for all Super Admin API routes.
 * Returns { admin } on success, or sends 401/403 and returns null.
 */
import { createClient } from '@supabase/supabase-js'

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

/**
 * @returns {Promise<{id,role,full_name,email}|null>}
 */
export async function guardSuperAdmin(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) { res.status(401).json({ error: 'Unauthorized' }); return null }

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !user) { res.status(401).json({ error: 'Unauthorized' }); return null }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id, role, full_name, email')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'super_admin') {
    res.status(403).json({ error: 'Super admin access required' })
    return null
  }

  return profile
}
