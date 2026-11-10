import { guardAdmin, scopeToTenant, PERMS } from '../../../../lib/adminGuard'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const gate = await guardAdmin(req, res, { allow: PERMS.NOTIFY_BROADCAST })
  if (!gate) return
  const supabaseAdmin = gate.db
  const user = gate.actor

  const { title, message, target } = req.body // target: 'all' | 'active'
  if (!title?.trim() || !message?.trim()) return res.status(400).json({ error: 'Title and message required' })

  // Get target players
  // Scoped, or a broadcast from one casino reaches every player on the
  // platform — including other operators' customers.
  let q = supabaseAdmin.from('profiles').select('id').eq('role', 'player')
  q = scopeToTenant(q, gate)
  if (target === 'active') q = q.eq('status', 'active')
  const { data: players } = await q

  if (!players?.length) return res.status(200).json({ message: 'No players found', sent: 0 })

  // Batch insert notifications
  const rows = players.map(p => ({ tenant_id: gate.tenantId, user_id: p.id, type: 'broadcast', title: title.trim(), message: message.trim() }))
  const BATCH = 100
  let sent = 0
  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await supabaseAdmin.from('notifications').insert(rows.slice(i, i + BATCH))
    if (!error) sent += Math.min(BATCH, rows.length - i)
  }

  await supabaseAdmin.from('audit_logs').insert({ tenant_id: gate.tenantId, actor_id: user.id, action: 'broadcast_sent', target_type: 'notifications', details: { title, target, sent } }).then(() => {}, () => {})
  return res.status(200).json({ message: 'Broadcast sent', sent })
}
