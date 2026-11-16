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
  // !inner + role = player: a KYC record is created for every account by the
  // signup trigger, staff included, so without this the list showed admins
  // and super admins who never submitted anything. KYC is a player process.
  let q = gate.db
    .from('kyc_records')
    .select(`
      id, status, doc_type, doc_expiry, doc_front_url, doc_back_url, selfie_url,
      first_name, middle_name, last_name, full_legal_name, date_of_birth,
      country, address, city, state, zip_code, ssn,
      submitted_at, reviewed_at, rejection_reason, admin_notes,
      profiles!kyc_records_user_id_fkey!inner ( id, full_name, email, kyc_status, role )
    `)
    .eq('profiles.role', 'player')
    .order('submitted_at', { ascending: false })
    .limit(100)

  q = scopeToTenant(q, gate)

  if (status !== 'all') q = q.eq('status', status)

  const { data, error } = await q
  if (error) return res.status(400).json({ error: error.message })

  // Document images live in the private 'kyc-documents' bucket as storage
  // paths, so hand the reviewer short-lived signed URLs. Legacy rows that
  // already hold a full URL are passed through untouched.
  const signed = await Promise.all((data || []).map(async (r) => {
    const sign = async (val) => {
      if (!val) return null
      if (/^https?:\/\//.test(val)) return val
      const { data: s } = await gate.db.storage.from('kyc-documents').createSignedUrl(val, 600)
      return s?.signedUrl || null
    }
    const [doc_front_url, doc_back_url, selfie_url] = await Promise.all([
      sign(r.doc_front_url), sign(r.doc_back_url), sign(r.selfie_url),
    ])
    return { ...r, doc_front_url, doc_back_url, selfie_url }
  }))

  return res.status(200).json({ data: signed })
}
