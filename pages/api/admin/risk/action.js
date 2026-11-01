import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const ALLOWED_ROLES = ['super_admin', 'admin', 'risk']

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' })

  const { data: admin, error: adminErr } = await supabaseAdmin
    .from('profiles').select('id, role').eq('id', user.id).single()
  if (adminErr || !admin || !ALLOWED_ROLES.includes(admin.role)) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const { action, user_id, reason, note, flag_id } = req.body

  if (action === 'flag') {
    if (!user_id || !reason?.trim()) {
      return res.status(400).json({ error: 'user_id and reason required' })
    }
    const { error } = await supabaseAdmin.from('risk_flags').insert({
      user_id,
      reason: reason.trim(),
      note: note?.trim() || null,
      status: 'active',
      flagged_by: admin.id,
      created_at: new Date().toISOString(),
    })
    if (error) return res.status(500).json({ error: error.message })

    await supabaseAdmin.from('audit_logs').insert({
      actor_id: admin.id,
      action: 'risk_flag',
      target_type: 'player',
      target_id: user_id,
      details: { reason, note },
    })

    return res.status(200).json({ success: true })
  }

  if (action === 'unflag') {
    if (!flag_id) return res.status(400).json({ error: 'flag_id required' })

    const { data: flag } = await supabaseAdmin
      .from('risk_flags').select('user_id').eq('id', flag_id).single()

    const { error } = await supabaseAdmin.from('risk_flags').update({
      status: 'resolved',
      resolved_by: admin.id,
      resolved_at: new Date().toISOString(),
      note: note?.trim() || null,
    }).eq('id', flag_id)
    if (error) return res.status(500).json({ error: error.message })

    await supabaseAdmin.from('audit_logs').insert({
      actor_id: admin.id,
      action: 'risk_unflag',
      target_type: 'risk_flag',
      target_id: flag_id,
      details: { user_id: flag?.user_id, note },
    })

    return res.status(200).json({ success: true })
  }

  return res.status(400).json({ error: 'Unknown action. Supported: flag, unflag' })
}
