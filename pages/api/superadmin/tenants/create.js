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
    actor_id:    admin.id,
    actor_role:  admin.role,
    action:      'tenant_created',
    target_type: 'tenant',
    target_id:   tenant.id,
    after_state: { name: tenant.name, slug: tenant.slug, plan },
  }).then(() => {}, () => {})

  return res.status(201).json({ tenant })
}
