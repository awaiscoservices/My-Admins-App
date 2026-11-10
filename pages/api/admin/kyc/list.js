/**
 * GET /api/admin/kyc/list?status=pending
 * Returns KYC records for the caller's own casino.
 * Super admins see records across all casinos.
 * Uses explicit FK hint to avoid "more than one relationship" error.
 */
import { guardAdmin, scopeToTenant, PERMS } from '../../../../lib/adminGuard'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const gate = await guardAdmin(req, res, { allow: PERMS.KYC_READ })
  if (!gate) return

  const { status = 'all' } = req.query

  // Explicit FK hint resolves "more than one relationship" error:
  //   kyc_records_user_id_fkey     → the player
  //   kyc_records_reviewed_by_fkey → the reviewer (not embedded here)
  let q = gate.db
    .from('kyc_records')
    .select(`
      id, status, doc_type, doc_front_url, doc_back_url, selfie_url, submitted_at, reviewed_at, rejection_reason, admin_notes,
      profiles!kyc_records_user_id_fkey ( id, full_name, email, kyc_status )
    `)
    .order('submitted_at', { ascending: false })
    .limit(100)

  q = scopeToTenant(q, gate)

  if (status !== 'all') q = q.eq('status', status)

  const { data, error } = await q
  if (error) return res.status(400).json({ error: error.message })

  return res.status(200).json({ data })
}
