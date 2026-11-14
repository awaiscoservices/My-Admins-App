/**
 * POST /api/admin/staff/create
 *
 * Body: { email, password, full_name?, role, tenant_id? }
 *
 * Creates a staff account directly with a password the admin chose — no email
 * invite, no magic link. The account is confirmed immediately, so the staff
 * member signs in on the normal /auth/login page with the email + password the
 * admin hands them.
 *
 * Roles: super_admin, admin (STAFF_MANAGE). An admin can only staff their own
 * casino; a super admin may pass tenant_id to staff another.
 */
import { guardAdmin, PERMS } from '../../../../lib/adminGuard'

const ASSIGNABLE_ROLES = ['admin', 'finance', 'game_ops', 'support']

function nameFromEmail(email) {
  const local = String(email).split('@')[0] || 'New User'
  const words = local.replace(/[._-]+/g, ' ').trim().split(/\s+/)
  return words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') || 'New User'
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const gate = await guardAdmin(req, res, { allow: PERMS.STAFF_MANAGE })
  if (!gate) return
  const db = gate.db
  const actor = gate.actor

  const { email, password, full_name, role, tenant_id } = req.body
  if (!email || !password || !role)
    return res.status(400).json({ error: 'email, password and role are required' })
  if (!ASSIGNABLE_ROLES.includes(role))
    return res.status(400).json({ error: `role must be one of: ${ASSIGNABLE_ROLES.join(', ')}` })
  if (String(password).length < 8)
    return res.status(400).json({ error: 'Password must be at least 8 characters' })

  // Only a super admin may staff a casino other than their own; an admin is
  // pinned to theirs whatever the body asks.
  const targetTenant = actor.role === 'super_admin'
    ? (tenant_id || actor.tenant_id)
    : actor.tenant_id
  if (!targetTenant)
    return res.status(400).json({ error: 'No casino to assign this account to.' })

  const { data: tenant } = await db.from('tenants').select('id').eq('id', targetTenant).maybeSingle()
  if (!tenant) return res.status(400).json({ error: 'That casino does not exist' })

  const fullName = full_name?.trim() || nameFromEmail(email)

  // Create the auth user with the chosen password, already confirmed so they
  // can sign in at once.
  const { data: created, error: createErr } = await db.auth.admin.createUser({
    email: String(email).trim(),
    password: String(password),
    email_confirm: true,
    user_metadata: { is_staff: true, role, tenant_id: targetTenant, full_name: fullName },
  })

  if (createErr) {
    const msg = /already|registered|exists/i.test(createErr.message)
      ? 'An account with that email already exists.'
      : createErr.message
    return res.status(400).json({ error: msg })
  }

  const uid = created.user.id

  // Pre-create / overwrite the profile with the right role and casino. A
  // signup trigger may already have inserted a default row — upsert fixes it.
  const { error: profileErr } = await db.from('profiles').upsert({
    id:        uid,
    email:     String(email).trim(),
    full_name: fullName,
    role,
    tenant_id: targetTenant,
    status:    'active',
  }, { onConflict: 'id', ignoreDuplicates: false })

  if (profileErr) {
    return res.status(500).json({
      error: `Account created but its profile could not be set: ${profileErr.message}`,
    })
  }

  await db.from('audit_logs').insert({
    tenant_id:   targetTenant,
    actor_id:    actor.id,
    actor_role:  actor.role,
    action:      'staff_created',
    target_type: 'profile',
    target_id:   uid,
    description: `Created ${role} account for ${email}`,
  }).then(() => {}, () => {})

  return res.status(200).json({ ok: true, email: String(email).trim(), role, tenant_id: targetTenant })
}
