import { guardAdmin, scopeToTenant, loadOwnedRow, PERMS } from '../../../../lib/adminGuard'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const gate = await guardAdmin(req, res, { allow: PERMS.RISK_READ })
  if (!gate) return
  const supabaseAdmin = gate.db

  const { page = 0, limit = 25, search = '' } = req.query
  const offset = parseInt(page) * parseInt(limit)

  let q = supabaseAdmin.from('risk_flags')
    .select('id, flag_type, severity, description, resolved, resolved_at, created_at, profiles!risk_flags_user_id_fkey(full_name, email)', { count: 'exact' })
  q = scopeToTenant(q, gate)
    .order('created_at', { ascending: false })
    .range(offset, offset + parseInt(limit) - 1)

  if (search) q = q.ilike('flag_type', `%${search}%`)

  const { data, count, error } = await q
  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ rows: data || [], total: count || 0 })
}
