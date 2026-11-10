/**
 * POST /api/superadmin/tenants/create
 * Creates a new tenant. Optionally invites an admin user.
 * Body: { name, slug, plan?, contact_email?, admin_email? }
 */
import { guardSuperAdmin, supabaseAdmin } from '../_guard'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const admin = await guardSuperAdmin(req, res)
  if (!admin) return

  const { name, slug, plan = 'free', contact_email, admin_email, notes } = req.body

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
      contact_email: contact_email?.trim() || null,
      notes: notes?.trim() || null,
      status: 'active',
      created_by: admin.id,
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
      const { data: invited, error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: { invited_role: 'admin', is_staff: true, tenant_id: tenant.id },
      })

      if (inviteErr) {
        admin_invite = { ok: false, error: `Casino created, but the invite failed: ${inviteErr.message}` }
      } else {
        // Pre-create the profile so the role and casino are right on first
        // login. Without tenant_id, adminGuard locks the account out.
        const { error: profileErr } = await supabaseAdmin.from('profiles').upsert({
          id:        invited.user.id,
          email,
          role:      'admin',
          tenant_id: tenant.id,
        }, { onConflict: 'id', ignoreDuplicates: false })

        admin_invite = profileErr
          ? { ok: false, error: `Invite sent, but the profile could not be created: ${profileErr.message}` }
          : { ok: true, email }

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
