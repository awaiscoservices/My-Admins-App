import { guardAdmin, scopeToTenant, PERMS } from '../../../../lib/adminGuard'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const gate = await guardAdmin(req, res, { allow: PERMS.NOTIFY_SEND })
  if (!gate) return
  const supabaseAdmin = gate.db
  const admin = gate.actor

  const { title, message, target } = req.body
  if (!title?.trim() || !message?.trim()) return res.status(400).json({ error: 'title and message required' })

  // Get target players
  // Was a denylist of staff roles, so a new role would silently start
  // receiving player broadcasts. Ask for players, and only this casino's.
  let query = supabaseAdmin.from('profiles').select('id').eq('role', 'player')
  query = scopeToTenant(query, gate)
  const { data: players } = await query
  if (!players?.length) return res.status(200).json({ success: true, sent_count: 0 })

  const now = new Date().toISOString()
  const notifs = players.map(p => ({
    tenant_id: gate.tenantId,
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
    tenant_id: gate.tenantId,
    action: 'notification_broadcast', performed_by: admin.id,
    target_type: 'broadcast', target_id: null,
    details: { title, target, sent_count: players.length }
  })

  return res.status(200).json({ success: true, sent_count: players.length })
}
