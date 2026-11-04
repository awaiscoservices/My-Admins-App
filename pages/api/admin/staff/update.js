/**
 * POST /api/admin/staff/update
 *
 * Body: { user_id, action: 'change_role'|'deactivate', role? }
 * super_admin only. Cannot act on another super_admin or self.
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

  const { user_id, action, role } = req.body
  if (!user_id || !['change_role', 'deactivate'].includes(action))
    return res.status(400).json({ error: 'user_id and action required' })
  if (user_id === user.id)
    return res.status(400).json({ error: 'Cannot modify your own account' })

  const { data: target } = await supabaseAdmin
    .from('profiles').select('id, role, full_name').eq('id', user_id).single()
  if (!target) return res.status(404).json({ error: 'Staff member not found' })
  if (target.role === 'super_admin') return res.status(403).json({ error: 'Cannot modify another super_admin' })

  if (action === 'change_role') {
    if (!ASSIGNABLE_ROLES.includes(role))
      return res.status(400).json({ error: `role must be one of: ${ASSIGNABLE_ROLES.join(', ')}` })

    await supabaseAdmin.from('profiles').update({ role }).eq('id', user_id)

    await supabaseAdmin.from('audit_logs').insert({
      actor_id: user.id, actor_role: actor.role,
      action: 'staff_role_changed', target_type: 'profile', target_id: user_id,
      description: `${target.full_name} role changed from ${target.role} to ${role}`,
    })

    return res.status(200).json({ ok: true })
  }

  if (action === 'deactivate') {
    await supabaseAdmin.from('profiles').update({ is_active: false }).eq('id', user_id)

    await supabaseAdmin.from('audit_logs').insert({
      actor_id: user.id, actor_role: actor.role,
      action: 'staff_deactivated', target_type: 'profile', target_id: user_id,
      description: `${target.full_name} (${target.role}) deactivated`,
    })

    return res.status(200).json({ ok: true })
  }
}
