import { guardAdmin, scopeToTenant, loadOwnedRow, PERMS } from '../../../../lib/adminGuard'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const gate = await guardAdmin(req, res, { allow: PERMS.AUDIT_READ })
  if (!gate) return
  const supabaseAdmin = gate.db

  const { page = 0, limit = 25, search = '' } = req.query
  const offset = parseInt(page) * parseInt(limit)

  let q = supabaseAdmin.from('audit_logs')
    .select('id, action, target_type, target_id, details, created_at, profiles!audit_logs_actor_id_fkey(full_name, role)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + parseInt(limit) - 1)

  q = scopeToTenant(q, gate)

  if (search) q = q.ilike('action', `%${search}%`)

  const { data, count, error } = await q
  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ rows: data || [], total: count || 0 })
}
