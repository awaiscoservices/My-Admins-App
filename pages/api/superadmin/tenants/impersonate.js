/**
 * POST /api/superadmin/tenants/impersonate
 * Generates a short-lived impersonation token for the target tenant's
 * primary admin user. ALWAYS writes an audit log.
 * Body: { tenant_id }
 *
 * Returns: { token, user_id, expires_at }
 * The token is a signed JWT (via Supabase admin.auth.admin.generateLink
 * magic link approach) that lets the super admin log in as that tenant's
 * admin without knowing their password.
 *
 * Security:
 *  - Logged to audit_logs with actor + target
 *  - Token expires in 15 minutes
 *  - Only super_admin can call this endpoint
 *  - Cannot impersonate another super_admin
 */
import { guardSuperAdmin, supabaseAdmin } from '../_guard'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const admin = await guardSuperAdmin(req, res)
  if (!admin) return

  const { tenant_id } = req.body
  if (!tenant_id) return res.status(400).json({ error: 'tenant_id is required' })

  // Find the primary admin for this tenant
  const { data: targetProfile } = await supabaseAdmin
    .from('profiles')
    .select('id, role, email, full_name')
    .eq('tenant_id', tenant_id)
    .in('role', ['admin', 'finance'])
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!targetProfile) return res.status(404).json({ error: 'No admin user found for this tenant' })
  if (targetProfile.role === 'super_admin') return res.status(403).json({ error: 'Cannot impersonate a super_admin' })

  // Generate a magic link (OTP link) for password-less sign-in
  const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
    type:  'magiclink',
    email: targetProfile.email,
    options: { expiresIn: 900 }, // 15 minutes
  })

  if (linkErr || !linkData) return res.status(500).json({ error: 'Failed to generate impersonation link' })

  // Extract the token from the magic link hashed_token
  const hashed_token = linkData.properties?.hashed_token
  const expires_at   = new Date(Date.now() + 15 * 60 * 1000).toISOString()

  // Mandatory audit log — impersonation must always be traceable
  await supabaseAdmin.from('audit_logs').insert({
    actor_id:    admin.id,
    actor_role:  admin.role,
    action:      'tenant_impersonated',
    target_type: 'tenant',
    target_id:   tenant_id,
    after_state: {
      target_user_id:    targetProfile.id,
      target_user_email: targetProfile.email,
      expires_at,
    },
  })

  return res.status(200).json({
    token:      hashed_token,
    user_id:    targetProfile.id,
    email:      targetProfile.email,
    expires_at,
  })
}
