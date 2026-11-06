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
  if (!admin || !['super_admin', 'marketing'].includes(admin.role)) return res.status(403).json({ error: 'Forbidden' })

  const { title, message, target } = req.body
  if (!title?.trim() || !message?.trim()) return res.status(400).json({ error: 'title and message required' })

  // Get target players
  let query = supabaseAdmin.from('profiles').select('id').not('role', 'in', '(super_admin,finance,game_ops,support,kyc_agent,risk,reporting,marketing)')
  const { data: players } = await query
  if (!players?.length) return res.status(200).json({ success: true, sent_count: 0 })

  const now = new Date().toISOString()
  const notifs = players.map(p => ({
    user_id: p.id, type: 'broadcast',
    title: title.trim(), message: message.trim(),
    read: false, created_at: now
  }))

  // Insert in chunks of 500
  const CHUNK = 500
  for (let i = 0; i < notifs.length; i += CHUNK) {
    await supabaseAdmin.from('notifications').insert(notifs.slice(i, i + CHUNK))
  }

  await supabaseAdmin.from('audit_logs').insert({
    action: 'notification_broadcast', performed_by: admin.id,
    target_type: 'broadcast', target_id: null,
    details: { title, target, sent_count: players.length }
  })

  return res.status(200).json({ success: true, sent_count: players.length })
}
