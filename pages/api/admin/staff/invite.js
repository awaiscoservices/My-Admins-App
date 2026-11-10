/**
 * POST /api/admin/staff/invite
 *
 * Body: { email, role, tenant_id? }
 * Sends a Supabase invite email and pre-creates the profile with the right
 * role and casino, so the account works the moment they accept.
 * super_admin only.
 */
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const ASSIGNABLE_ROLES = ['admin', 'finance', 'game_ops', 'support']

/**
 * profiles.full_name is NOT NULL, so an invite that does not set it fails
 * after the auth user has already been created. Derive something readable
 * from the address: "lucky.spin@x.com" -> "Lucky Spin".
 */

/**
 * Find an existing auth user by email.
 *
 * An invite that half-failed leaves the auth user created and the profile
 * missing, and inviting the same address again is rejected as already
 * registered — so the account can never be repaired through the UI. Looking
 * first makes a retry fix the profile instead of erroring.
 */
async function findUserByEmail(client, email) {
  const target = String(email).toLowerCase()
  for (let page = 1; page <= 5; page++) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 200 })
    if (error || !data?.users?.length) return null
    const hit = data.users.find(u => (u.email || '').toLowerCase() === target)
    if (hit) return hit
    if (data.users.length < 200) return null
  }
  return null
}

function nameFromEmail(email) {
  const local = String(email).split('@')[0] || 'New User'
  const words = local.replace(/[._-]+/g, ' ').trim().split(/\s+/)
  return words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') || 'New User'
}


export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' })

  const { data: actor } = await supabaseAdmin
    .from('profiles').select('role, tenant_id').eq('id', user.id).single()
  if (!actor || actor.role !== 'super_admin')
    return res.status(403).json({ error: 'super_admin required' })

  const { email, role, tenant_id } = req.body
  if (!email || !role) return res.status(400).json({ error: 'email and role required' })
  if (!ASSIGNABLE_ROLES.includes(role))
    return res.status(400).json({ error: `role must be one of: ${ASSIGNABLE_ROLES.join(', ')}` })

  // Every one of these roles works inside a single casino, and adminGuard
  // refuses a non-super-admin with no tenant_id. Without this the invite
  // succeeded and the new account was locked out of the panel on first login.
  const targetTenant = tenant_id || actor.tenant_id
  if (!targetTenant) {
    return res.status(400).json({
      error: 'No casino to assign this account to. Pass tenant_id, or set one on your own profile.',
    })
  }

  // Confirm the casino exists before inviting, so a typo'd id does not
  // produce an account pointing at nothing.
  const { data: tenant } = await supabaseAdmin
    .from('tenants').select('id').eq('id', targetTenant).maybeSingle()
  if (!tenant) return res.status(400).json({ error: 'That casino does not exist' })

  // Invite via Supabase Admin API — sends a magic link, so the person sets
  // their own password and no temporary one is ever created or transmitted.
  // Reuse an existing account rather than failing on "already registered".
  const existing = await findUserByEmail(supabaseAdmin, email)

  let invited = existing ? { user: existing } : null

  if (!existing) {
    const r = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: { invited_role: role, is_staff: true, tenant_id: targetTenant },
    })
    if (r.error) return res.status(500).json({ error: r.error.message })
    invited = r.data
  }

  if (invited?.user?.id) {
    const { error: profileErr } = await supabaseAdmin.from('profiles').upsert({
      id:        invited.user.id,
      email:     email,
      full_name: nameFromEmail(email),
      role:      role,
      tenant_id: targetTenant,
    }, { onConflict: 'id', ignoreDuplicates: false })

    // The auth user now exists but has no usable profile. Say so rather than
    // reporting success and leaving an account that cannot sign in.
    if (profileErr) {
      return res.status(500).json({
        error: `Invite sent but the profile could not be created: ${profileErr.message}. Fix the profile before they accept.`,
      })
    }
  }

  await supabaseAdmin.from('audit_logs').insert({
    tenant_id:   targetTenant,
    actor_id:    user.id,
    actor_role:  actor.role,
    action:      'staff_invited',
    target_type: 'profile',
    target_id:   invited?.user?.id || email,
    description: `Invited ${email} as ${role}`,
  }).then(() => {}, () => {})

  return res.status(200).json({ ok: true, email, role, tenant_id: targetTenant })
}
