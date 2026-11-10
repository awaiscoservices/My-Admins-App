/**
 * GET  /api/admin/manage?kind=game_panels|payment_methods|player_levels   → list
 * POST /api/admin/manage  { kind, op: 'create'|'update', id?, fields }     → save
 */
import { supabaseAdmin, requireStaff, audit } from '../../../lib/adminApi'
import { MANAGE, cleanFields } from '../../../lib/adminSchemas'

export default async function handler(req, res) {
  const body = req.method === 'POST' ? (req.body || {}) : {}
  const kind = req.method === 'POST' ? body.kind : req.query.kind
  const cfg = MANAGE[kind]
  if (!cfg) return res.status(400).json({ error: 'Unknown setting' })
  const admin = await requireStaff(req, res, cfg.roles)
  if (!admin) return

  if (req.method === 'GET') {
    const { data, error } = await admin.scope(supabaseAdmin.from(cfg.table).select('*').order(cfg.sort, { ascending: true }))
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ rows: data || [] })
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { op, id, fields } = body
  if (!['create', 'update'].includes(op)) return res.status(400).json({ error: 'Invalid operation' })
  const { values, error: bad } = cleanFields(kind, fields, { creating: op === 'create' })
  if (bad) return res.status(400).json({ error: bad })
  if (!Object.keys(values).length) return res.status(400).json({ error: 'Nothing to save' })

  if (op === 'create') {
    const payload = admin.isSuperAdmin ? values : { ...values, tenant_id: admin.tenant_id }
    const { data, error } = await supabaseAdmin.from(cfg.table).insert(payload).select().single()
    if (error) return res.status(400).json({ error: error.message })
    await audit(admin, `${kind}_create`, kind, data?.id, null, values)
    return res.status(200).json({ message: 'Created', row: data })
  }

  if (!id) return res.status(400).json({ error: 'id is required' })
  const { data: before } = await admin.scope(supabaseAdmin.from(cfg.table).select('*').eq('id', id)).maybeSingle()
  if (!before) return res.status(404).json({ error: 'Not found' })
  const prev = {}; for (const k of Object.keys(values)) prev[k] = before[k]   // snapshot BEFORE the change
  // Scoped so another casino's row cannot be edited through this route.
  const { error } = await admin.scope(supabaseAdmin.from(cfg.table).update(values).eq('id', id))
  if (error) return res.status(400).json({ error: error.message })
  await audit(admin, `${kind}_update`, kind, id, prev, values)
  return res.status(200).json({ message: 'Saved' })
}
