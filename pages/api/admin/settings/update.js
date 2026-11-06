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
  const { data: admin } = await supabaseAdmin.from('profiles').select('id, role').eq('id', user.id).single()
  if (!admin || admin.role !== 'super_admin') return res.status(403).json({ error: 'Forbidden' })

  const { updates } = req.body
  if (!Array.isArray(updates) || updates.length === 0) return res.status(400).json({ error: 'updates array required' })

  for (const { key, value } of updates) {
    if (!key) continue
    await supabaseAdmin.from('platform_settings').upsert(
      { key, value, updated_at: new Date().toISOString(), updated_by: admin.id },
      { onConflict: 'key' }
    )
  }

  await supabaseAdmin.from('audit_logs').insert({
    action: 'setting_update', performed_by: admin.id,
    target_type: 'settings', target_id: null,
    details: { keys: updates.map(u => u.key) }
  })

  return res.status(200).json({ success: true })
}
