/**
 * GET /api/admin/deposits/list
 * Returns deposits for the caller's own casino, with player info.
 * Super admins see deposits across all casinos.
 * Roles: super_admin, admin, finance
 */
import { guardAdmin, scopeToTenant, PERMS } from '../../../../lib/adminGuard'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const gate = await guardAdmin(req, res, { allow: PERMS.DEPOSITS_READ })
  if (!gate) return

  const { status } = req.query

  let q = gate.db
    .from('deposits')
    .select(`
      id, reference_id, amount_cents, bonus_cents, total_credit_cents,
      status, player_reference, screenshot_url, player_notes, admin_notes,
      rejection_reason, created_at, reviewed_at,
      payment_method_id,
      profiles!deposits_user_id_fkey ( id, full_name, email )
    `)
    .order('created_at', { ascending: false })
    .limit(100)

  q = scopeToTenant(q, gate)

  if (status && status !== 'all') q = q.eq('status', status)

  const { data, error } = await q
  if (error) return res.status(500).json({ error: error.message })

  return res.status(200).json({ deposits: data || [] })
}
