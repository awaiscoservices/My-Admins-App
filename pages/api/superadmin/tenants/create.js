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

  const { name, slug, plan = 'free', admin_email, brand_name, primary_domain } = req.body

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

  // Invite the first admin, if one was given.
  //
  // This field existed on the form and in this handler's signature but was
  // never used — no account was created, no email sent, and the address was
  // not even stored. A new casino was created with no way into it.
  //
  // The tenant itself is already saved, so a failed invite is reported back
  // rather than failing the whole request: the casino exists either way and
  // an admin can be invited separately from Staff & Roles.
  let admin_invite = null

  if (admin_email?.trim()) {
    const email = admin_email.trim()

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      admin_invite = { ok: false, error: 'Casino created, but the admin email is not a valid address.' }
    } else {
      // Reuse an existing account rather than failing on "already registered".
      const existing = await findUserByEmail(supabaseAdmin, email)

      let invited = existing ? { user: existing } : null
      let inviteErr = null

      if (!existing) {
        const r = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
          data: { invited_role: 'admin', is_staff: true, tenant_id: tenant.id },
        })
        invited = r.data
        inviteErr = r.error
      }

      if (inviteErr) {
        admin_invite = { ok: false, error: `Casino created, but the invite failed: ${inviteErr.message}` }
      } else {
        // Pre-create the profile so the role and casino are right on first
        // login. Without tenant_id, adminGuard locks the account out.
        const { error: profileErr } = await supabaseAdmin.from('profiles').upsert({
          id:        invited.user.id,
          email,
          full_name: nameFromEmail(email),
          role:      'admin',
          tenant_id: tenant.id,
        }, { onConflict: 'id', ignoreDuplicates: false })

        admin_invite = profileErr
          ? { ok: false, error: `Invite sent, but the profile could not be created: ${profileErr.message}` }
          : { ok: true, email, reused: !!existing }

        await supabaseAdmin.from('audit_logs').insert({
          tenant_id:   tenant.id,
          actor_id:    admin.id,
          actor_role:  admin.role,
          action:      'staff_invited',
          target_type: 'profile',
          target_id:   invited.user.id,
          description: `Invited ${email} as admin of ${tenant.name}`,
        }).then(() => {}, () => {})
      }
    }
  }

  return res.status(201).json({ tenant, admin_invite })
}
