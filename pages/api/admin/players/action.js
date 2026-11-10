/**
 * POST /api/admin/players/action
 * Suspend, activate, or ban a player.
 */
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const ALLOWED_ROLES = ['super_admin', 'admin', 'support', 'risk']

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' })

  const { data: actor } = await supabaseAdmin.from('profiles').select('role, full_name').eq('id', user.id).single()
  if (!actor || !ALLOWED_ROLES.includes(actor.role)) return res.status(403).json({ error: 'Forbidden' })

  // The caller's own casino, used to scope the target lookup below.
  const { data: me } = await supabaseAdmin.from('profiles').select('tenant_id').eq('id', user.id).single()
  const isSuper = actor.role === 'super_admin'

  const { user_id, action, notes } = req.body
  if (!user_id || !action) return res.status(400).json({ error: 'user_id and action required' })

  const VALID_ACTIONS = ['activate', 'suspend', 'ban']
  if (!VALID_ACTIONS.includes(action)) return res.status(400).json({ error: `action must be one of: ${VALID_ACTIONS.join(', ')}` })

  const STATUS_MAP = { activate: 'active', suspend: 'suspended', ban: 'banned' }
  const newStatus = STATUS_MAP[action]

  let tq = supabaseAdmin.from('profiles').select('id, full_name, status, role, tenant_id').eq('id', user_id)
  if (!isSuper) tq = tq.eq('tenant_id', me?.tenant_id)
  const { data: target } = await tq.maybeSingle()
  if (!target) return res.status(404).json({ error: 'Player not found' })
  if (target.role !== 'player') return res.status(400).json({ error: 'Can only action player accounts' })

  await supabaseAdmin.from('profiles').update({ status: newStatus }).eq('id', user_id)

  // Notify player
  const messages = {
    activate: 'Your account has been reactivated. Welcome back!',
    suspend: `Your account has been suspended.${notes ? ' Reason: ' + notes : ' Please contact support.'}`,
    ban: `Your account has been permanently closed.${notes ? ' Reason: ' + notes : ''}`,
  }
  await supabaseAdmin.from('notifications').insert({
    tenant_id: target.tenant_id,
    user_id,
    type: 'account_status',
    title: `Account ${action.charAt(0).toUpperCase() + action.slice(1)}d`,
    message: messages[action],
  }).then(() => {}, () => {})

  await supabaseAdmin.from('audit_logs').insert({
    actor_id: user.id, actor_role: actor.role,
    action: `player_${action}d`,
    target_type: 'profile', target_id: user_id,
    before_state: { status: target.status },
    after_state: { status: newStatus, notes, by: actor.full_name },
  }).then(() => {}, () => {})

  return res.status(200).json({ success: true, status: newStatus })
}
