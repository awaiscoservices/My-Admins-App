import { guardAdmin, scopeToTenant, loadOwnedRow, PERMS } from '../../../../lib/adminGuard'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const gate = await guardAdmin(req, res, { allow: PERMS.ADJUSTMENTS_READ })
  if (!gate) return
  const supabaseAdmin = gate.db

  const { page = 0, limit = 25, search = '' } = req.query
  const offset = parseInt(page) * parseInt(limit)

  let q = scopeToTenant(supabaseAdmin.from('wallet_adjustments')
    .select('id, amount_cents, direction, reason, reference_id, created_at, profiles!wallet_adjustments_user_id_fkey(full_name, email), staff:profiles!wallet_adjustments_admin_id_fkey(full_name)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + parseInt(limit) - 1), gate)


  if (search) q = q.ilike('reason', `%${search}%`)

  const { data, count, error } = await q
  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ rows: data || [], total: count || 0 })
}
