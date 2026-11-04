/**
 * POST /api/admin/staff/invite
 *
 * Body: { email, role }
 * Sends a Supabase invite email. On first login the profile role is set.
 * super_admin only.
 */
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const ASSIGNABLE_ROLES = ['admin', 'finance', 'game_ops', 'support']

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' })

  const { data: actor } = await supabaseAdmin
    .from('profiles').select('role').eq('id', user.id).single()
  if (!actor || actor.role !== 'super_admin')
    return res.status(403).json({ error: 'super_admin required' })

  const { email, role } = req.body
  if (!email || !role) return res.status(400).json({ error: 'email and role required' })
  if (!ASSIGNABLE_ROLES.includes(role))
    return res.status(400).json({ error: `role must be one of: ${ASSIGNABLE_ROLES.join(', ')}` })

  // Invite via Supabase Admin API — sends magic link email
  const { data: invited, error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    data: { invited_role: role, is_staff: true },
  })
  if (inviteErr) return res.status(500).json({ error: inviteErr.message })

  // Pre-create profile with correct role so it's set on first login
  if (invited?.user?.id) {
    await supabaseAdmin.from('profiles').upsert({
      id:    invited.user.id,
      email: email,
      role:  role,
    }, { onConflict: 'id', ignoreDuplicates: false })
  }

  await supabaseAdmin.from('audit_logs').insert({
    actor_id: user.id, actor_role: actor.role,
    action: 'staff_invited', target_type: 'profile', target_id: invited?.user?.id || email,
    description: `Invited ${email} as ${role}`,
  })

  return res.status(200).json({ ok: true, email, role })
}
