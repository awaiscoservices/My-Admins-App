/**
 * POST /api/superadmin/tenants/create
 * Creates a new tenant. Optionally invites an admin user.
 * Body: { name, slug, plan?, admin_email?, brand_name?, primary_domain? }
 *
 * Columns on `tenants`: id, name, slug, status, owner_email, brand_name,
 * primary_domain, plan, settings, created_at, updated_at. There is no
 * contact_email, notes or created_by — earlier versions wrote all three and
 * the insert failed outright.
 */
import { guardSuperAdmin, supabaseAdmin } from '../_guard'
import { applyDefaultsToTenant } from '../../../../lib/platformDefaults'

// Addresses for username-only staff accounts. Never receives mail; it exists
// because Supabase Auth requires an address.
const INTERNAL_EMAIL_DOMAIN = 'staff.casinoze.local'


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

  const admin = await guardSuperAdmin(req, res)
  if (!admin) return

  const { name, slug, plan = 'free', admin_email, admin_username, admin_password, brand_name, primary_domain } = req.body

  if (!name?.trim())  return res.status(400).json({ error: 'name is required' })
  if (!slug?.trim())  return res.status(400).json({ error: 'slug is required' })

  // Validate slug format: lowercase letters, numbers, hyphens only
  if (!/^[a-z0-9-]+$/.test(slug)) return res.status(400).json({ error: 'slug must be lowercase letters, numbers and hyphens only' })

  // Check slug uniqueness
  const { data: existing } = await supabaseAdmin.from('tenants').select('id').eq('slug', slug).maybeSingle()
  if (existing) return res.status(409).json({ error: 'slug already taken' })

  // Insert tenant
  const { data: tenant, error } = await supabaseAdmin
    .from('tenants')
    .insert({
      name: name.trim(),
      slug: slug.trim(),
      plan,
      status: 'active',
      owner_email:    admin_email?.trim() || null,
      brand_name:     brand_name?.trim() || null,
      primary_domain: primary_domain?.trim() || null,
      settings:       {},   // NOT NULL on this table
    })
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })

  // Log audit
  await supabaseAdmin.from('audit_logs').insert({
    tenant_id:   tenant.id,
    actor_id:    admin.id,
    actor_role:  admin.role,
    action:      'tenant_created',
    target_type: 'tenant',
    target_id:   tenant.id,
    after_state: { name: tenant.name, slug: tenant.slug, plan },
  }).then(() => {}, () => {})

  // Set the casino up from the platform defaults: levels, games, payment
  // methods, referral tiers and settings.
  //
  // Without these a casino exists but cannot operate — no games to request an
  // account in, no way to take a deposit, no levels for the bonus grid, and
  // the withdrawal path reads a setting that would not be there.
  //
  // The defaults belong to the platform, not to a casino. They used to be
  // copied from the first casino, which made that casino a template nobody
  // could see and meant deleting it would quietly stop every future casino
  // getting anything.
  const seeded = await applyDefaultsToTenant(supabaseAdmin, tenant.id)

  // Create the first admin, if credentials were given.
  //
  // Supabase Auth still needs an address, but a username-only account never
  // receives mail, so one is synthesised from the username. profiles.username
  // holds the real username and /api/auth/resolve-username maps it back at
  // sign-in. An admin_email may still be given instead, for an account that
  // should be reachable by email.
  //
  // The tenant is already saved, so a failure here is reported rather than
  // failing the whole request: the casino exists and an admin can be added
  // from Staff & Roles.
  let admin_invite = null

  if (admin_username?.trim() || admin_email?.trim()) {
    // An email typed into the username box is treated as the address, not
    // rejected — people reach for an email out of habit.
    const typed = admin_username?.trim().toLowerCase() || ''
    const typedIsEmail = typed.includes('@')
    const username = typedIsEmail ? null : (typed || null)
    const emailGiven = admin_email?.trim() || (typedIsEmail ? typed : null)
    const password = admin_password

    if (!username && !emailGiven) {
      admin_invite = { ok: false, error: 'Casino created, but no admin username or email was given.' }
    } else if (username && !/^[a-z0-9._-]{3,32}$/.test(username)) {
      admin_invite = { ok: false, error: 'Casino created, but the username must be 3-32 characters: letters, numbers, dot, dash or underscore.' }
    } else if (!password || password.length < 8) {
      admin_invite = { ok: false, error: 'Casino created, but the admin password must be at least 8 characters.' }
    } else {
      // Username-only accounts get an internal address that is never emailed.
      const loginEmail = emailGiven || `${username}@${INTERNAL_EMAIL_DOMAIN}`

      const taken = username
        ? await supabaseAdmin.from('profiles').select('id').ilike('username', username).maybeSingle()
        : { data: null }

      if (taken.data) {
        admin_invite = { ok: false, error: 'Casino created, but that username is already taken.' }
      } else {
        const existing = await findUserByEmail(supabaseAdmin, loginEmail)
        let userId = existing?.id || null
        let createErr = null

        if (existing) {
          // Repair a half-made account from an earlier attempt, and reset the
          // password to what was just typed.
          const r = await supabaseAdmin.auth.admin.updateUserById(existing.id, { password })
          createErr = r.error
        } else {
          const r = await supabaseAdmin.auth.admin.createUser({
            email: loginEmail,
            password,
            email_confirm: true,   // no confirmation mail; these are handed over directly
            user_metadata: { is_staff: true, tenant_id: tenant.id, username },
          })
          createErr = r.error
          userId = r.data?.user?.id || null
        }

        if (createErr || !userId) {
          admin_invite = { ok: false, error: `Casino created, but the admin account failed: ${createErr?.message || 'unknown error'}` }
        } else {
          const { error: profileErr } = await supabaseAdmin.from('profiles').upsert({
            id:        userId,
            email:     loginEmail,
            username,
            full_name: username ? nameFromEmail(username) : nameFromEmail(loginEmail),
            role:      'admin',
            tenant_id: tenant.id,
            status:    'active',
          }, { onConflict: 'id', ignoreDuplicates: false })

          admin_invite = profileErr
            ? { ok: false, error: `Admin account created, but its profile failed: ${profileErr.message}` }
            : { ok: true, username, email: loginEmail, reused: !!existing }

          await supabaseAdmin.from('audit_logs').insert({
            tenant_id:   tenant.id,
            actor_id:    admin.id,
            actor_role:  admin.role,
            action:      'staff_created',
            target_type: 'profile',
            target_id:   userId,
            description: `Created admin ${username || loginEmail} for ${tenant.name}`,
          }).then(() => {}, () => {})
        }
      }
    }
  }

  return res.status(201).json({ tenant, admin_invite, seeded })
}
