import { guardAdmin, scopeToTenant, loadOwnedRow, PERMS } from '../../../../lib/adminGuard'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const gate = await guardAdmin(req, res, { allow: PERMS.SUPPORT_READ })
  if (!gate) return
  const supabaseAdmin = gate.db

  const { page = 0, limit = 25, search = '', status = '' } = req.query
  const offset = parseInt(page) * parseInt(limit)

  let q = supabaseAdmin.from('support_tickets')
    .select('id, subject, status, priority, category, created_at, updated_at, profiles!support_tickets_user_id_fkey(full_name, email)', { count: 'exact' })
    .order('updated_at', { ascending: false })
    .range(offset, offset + parseInt(limit) - 1)

  q = scopeToTenant(q, gate)

  if (status) q = q.eq('status', status)
  if (search) q = q.ilike('subject', `%${search}%`)

  const { data, count, error } = await q
  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ rows: data || [], total: count || 0 })
}
