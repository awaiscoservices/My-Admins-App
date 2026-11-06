import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' })
  const { data: caller } = await supabaseAdmin.from('profiles').select('id, role').eq('id', user.id).single()
  if (!caller || caller.role !== 'super_admin') return res.status(403).json({ error: 'Forbidden — super_admin only' })

  const { action, email, role, target_user_id, active } = req.body

  if (action === 'invite') {
    if (!email?.trim() || !role) return res.status(400).json({ error: 'email and role required' })
    const { data: invited, error: invErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(email.trim())
    if (invErr) return res.status(500).json({ error: invErr.message })
    await supabaseAdmin.from('profiles').update({ role }).eq('id', invited.user.id)
    await supabaseAdmin.from('audit_logs').insert({
      action: 'staff_invite', performed_by: caller.id,
      target_type: 'profile', target_id: invited.user.id,
      details: { email, role }
    })
    return res.status(200).json({ success: true })
  }

  if (action === 'update_role') {
    if (!target_user_id || !role) return res.status(400).json({ error: 'target_user_id and role required' })
    const { error } = await supabaseAdmin.from('profiles').update({ role, updated_at: new Date().toISOString() }).eq('id', target_user_id)
    if (error) return res.status(500).json({ error: error.message })
    await supabaseAdmin.from('audit_logs').insert({
      action: 'staff_role_change', performed_by: caller.id,
      target_type: 'profile', target_id: target_user_id,
      details: { new_role: role }
    })
    return res.status(200).json({ success: true })
  }

  if (action === 'toggle_active') {
    if (!target_user_id) return res.status(400).json({ error: 'target_user_id required' })
    const { error } = await supabaseAdmin.from('profiles').update({ is_active: !!active, updated_at: new Date().toISOString() }).eq('id', target_user_id)
    if (error) return res.status(500).json({ error: error.message })
    await supabaseAdmin.from('audit_logs').insert({
      action: active ? 'staff_activate' : 'staff_deactivate',
      performed_by: caller.id, target_type: 'profile', target_id: target_user_id
    })
    return res.status(200).json({ success: true })
  }

  return res.status(400).json({ error: 'Unknown action' })
}
