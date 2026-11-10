import { guardAdmin, scopeToTenant, loadOwnedRow, PERMS } from '../../../../lib/adminGuard'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const gate = await guardAdmin(req, res, { allow: PERMS.PROMOS_WRITE })
  if (!gate) return
  const supabaseAdmin = gate.db
  const admin = gate.actor

  const { id, title, description, type, amount_cents, min_deposit_cents, expires_at, is_active } = req.body
  if (!title?.trim()) return res.status(400).json({ error: 'Title required' })

  const payload = {
    tenant_id: gate.tenantId,
    title: title.trim(), description: description?.trim() || null,
    type: type || 'bonus',
    amount_cents: amount_cents || null,
    min_deposit_cents: min_deposit_cents || null,
    expires_at: expires_at || null,
    is_active: is_active !== false,
    updated_at: new Date().toISOString()
  }

  if (id) {
    const { error } = await supabaseAdmin.from('promotions').update(payload).eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    await supabaseAdmin.from('audit_logs').insert({ action: 'promo_update', performed_by: admin.id, target_type: 'promotion', target_id: id, details: { title } })
  } else {
    const { error } = await supabaseAdmin.from('promotions').insert({ ...payload, created_at: new Date().toISOString() })
    if (error) return res.status(500).json({ error: error.message })
    await supabaseAdmin.from('audit_logs').insert({ action: 'promo_create', performed_by: admin.id, target_type: 'promotion', target_id: null, details: { title } })
  }

  return res.status(200).json({ success: true })
}
