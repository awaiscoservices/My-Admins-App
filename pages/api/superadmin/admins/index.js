/**
 * GET  /api/superadmin/admins  → every super admin on the platform
 * POST /api/superadmin/admins  → create another one
 *
 * There was no way to make a second super admin. staff/invite deliberately
 * refuses the role, so the platform had exactly one account that could reach
 * the Super Admin portal and no way to make another — losing that login meant
 * losing the portal.
 *
 * What makes someone a super admin is the role, not the casino: adminGuard
 * reads role === 'super_admin' and stops scoping their queries.
 */
import { guardSuperAdmin, supabaseAdmin } from '../_guard'

// Username-only accounts need an address because Supabase Auth requires one.
// Nothing is ever sent to it.
const INTERNAL_EMAIL_DOMAIN = 'staff.casinoze.local'

function nameFromLogin(login) {
  const local = String(login).split('@')[0] || 'Super Admin'
  const words = local.replace(/[._-]+/g, ' ').trim().split(/\s+/)
  return words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') || 'Super Admin'
}

/** An auth user may already exist from a half-finished attempt. */
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

export default async function handler(req, res) {
  const admin = await guardSuperAdmin(req, res)
  if (!admin) return

  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email, username, status, created_at')
      .eq('role', 'super_admin')
      .order('created_at', { ascending: true })

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ admins: data || [], you: admin.id })
  }

  if (req.method === 'POST') {
    const { username, email, password, full_name } = req.body || {}

    const typed = String(username || '').trim().toLowerCase()
    const typedIsEmail = typed.includes('@')
    const handle = typedIsEmail ? null : (typed || null)
    const address = String(email || '').trim().toLowerCase() || (typedIsEmail ? typed : null)

    if (!handle && !address) return res.status(400).json({ error: 'Give a username or an email address' })
    if (handle && !/^[a-z0-9._-]{3,32}$/.test(handle)) {
      return res.status(400).json({ error: 'The username must be 3-32 characters: letters, numbers, dot, dash or underscore.' })
    }
    if (!password || password.length < 12) {
      // Longer than the 8 asked of casino staff: this account can reach every
      // casino on the platform.
      return res.status(400).json({ error: 'A super admin password must be at least 12 characters.' })
    }

    const loginEmail = address || `${handle}@${INTERNAL_EMAIL_DOMAIN}`

    if (handle) {
      const { data: taken } = await supabaseAdmin
        .from('profiles').select('id').ilike('username', handle).maybeSingle()
      if (taken) return res.status(409).json({ error: 'That username is already taken.' })
    }

    const existing = await findUserByEmail(supabaseAdmin, loginEmail)
    let userId = existing?.id || null
    let authErr = null

    if (existing) {
      const r = await supabaseAdmin.auth.admin.updateUserById(existing.id, { password })
      authErr = r.error
    } else {
      const r = await supabaseAdmin.auth.admin.createUser({
        email: loginEmail,
        password,
        email_confirm: true,
        user_metadata: { is_staff: true, username: handle },
      })
      authErr = r.error
      userId = r.data?.user?.id || null
    }

    if (authErr || !userId) {
      return res.status(500).json({ error: `Could not create the account: ${authErr?.message || 'unknown error'}` })
    }

    const { error: profileErr } = await supabaseAdmin.from('profiles').upsert({
      id:        userId,
      email:     loginEmail,
      username:  handle,
      full_name: String(full_name || '').trim() || nameFromLogin(handle || loginEmail),
      role:      'super_admin',
      status:    'active',
      // tenant_id is deliberately not set. The column is NOT NULL with a
      // default of the first casino, so passing null fails outright — which
      // is why the existing super admin carries that casino's id too. It
      // makes no difference: adminGuard decides from the role, and
      // scopeToTenant never filters a super admin's queries.
    }, { onConflict: 'id', ignoreDuplicates: false })

    if (profileErr) {
      return res.status(500).json({ error: `The login was created but its profile failed: ${profileErr.message}` })
    }

    await supabaseAdmin.from('audit_logs').insert({
      actor_id:    admin.id,
      actor_role:  admin.role,
      action:      'super_admin_created',
      target_type: 'profile',
      target_id:   userId,
      description: `Created super admin ${handle || loginEmail}`,
    }).then(() => {}, () => {})

    return res.status(201).json({
      ok: true,
      admin: { id: userId, username: handle, email: loginEmail, reused: !!existing },
    })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
