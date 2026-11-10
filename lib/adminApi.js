// SERVER-SIDE ONLY (used by /pages/api). Never import this from a page or component.
import { createClient } from '@supabase/supabase-js'

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Which staff roles may work each queue (matches the admin sidebar)
export const QUEUES = {
  game_loads:  { table: 'game_loads',      roles: ['super_admin', 'game_ops'] },
  redemptions: { table: 'redemptions',     roles: ['super_admin', 'game_ops', 'finance'] },
  withdrawals: { table: 'withdrawals',     roles: ['super_admin', 'finance'] },
  kyc:         { table: 'kyc_records',     roles: ['super_admin', 'kyc_agent', 'risk'] },
  support:     { table: 'support_tickets', roles: ['super_admin', 'support'] },
}

// Statuses that still need staff attention, per queue
export const OPEN_STATUSES = {
  game_loads:  ['pending', 'under_review', 'processing'],
  redemptions: ['pending', 'under_review', 'processing'],
  withdrawals: ['pending', 'under_review', 'processing'],
  kyc:         ['pending', 'under_review'],
  support:     ['pending', 'open', 'in_progress', 'waiting_player'],
}

// Supabase query objects only have .then(), not .catch(): this makes a safe "fire and forget"
export const safe = (p) => Promise.resolve(p).then(() => {}, () => {})

// Checks the Bearer token and that the user has one of the allowed staff roles
export async function requireStaff(req, res, allowedRoles) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) { res.status(401).json({ error: 'Unauthorized' }); return null }

  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data?.user) { res.status(401).json({ error: 'Unauthorized' }); return null }

  const { data: admin } = await supabaseAdmin
    .from('profiles').select('id, role, full_name, tenant_id, status').eq('id', data.user.id).single()
  if (!admin || !allowedRoles.includes(admin.role)) {
    res.status(403).json({ error: 'Insufficient permissions' }); return null
  }
  if (admin.status === 'suspended' || admin.status === 'banned') {
    res.status(403).json({ error: 'This account has been deactivated' }); return null
  }

  // Routes using this helper must scope their queries too. Fail closed for a
  // non-super-admin with no casino, same as lib/adminGuard.
  const isSuperAdmin = admin.role === 'super_admin'
  if (!isSuperAdmin && !admin.tenant_id) {
    res.status(403).json({ error: 'Your staff account is not linked to a casino.' }); return null
  }

  admin.isSuperAdmin = isSuperAdmin
  admin.scope = (query, column = 'tenant_id') =>
    isSuperAdmin ? query : query.eq(column, admin.tenant_id)

  return admin
}

export const audit = (admin, action, targetType, targetId, before, after, reason) =>
  safe(supabaseAdmin.from('audit_logs').insert({
    actor_id: admin.id, actor_role: admin.role, action,
    target_type: targetType, target_id: targetId,
    before_state: before, after_state: after, reason: reason || null,
  }))

export const notify = (userId, type, title, message) =>
  safe(supabaseAdmin.from('notifications').insert({ user_id: userId, type, title, message }))

export const usd = (cents) => `$${(Number(cents || 0) / 100).toFixed(2)}`
