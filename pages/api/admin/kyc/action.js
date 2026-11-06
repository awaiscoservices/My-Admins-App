/**
 * POST /api/admin/kyc/action
 *
 * Body: { kyc_id, action: 'approve'|'reject', rejection_reason? }
 *
 * approve: sets kyc_records.status='approved', profiles.kyc_verified=true
 * reject:  sets kyc_records.status='rejected' + rejection_reason
 *
 * Roles: super_admin, admin
 */
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const ALLOWED_ROLES = ['super_admin', 'admin']

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' })

  const { data: actor } = await supabaseAdmin
    .from('profiles').select('role').eq('id', user.id).single()
  if (!actor || !ALLOWED_ROLES.includes(actor.role))
    return res.status(403).json({ error: 'Forbidden' })

  const { kyc_id, action, rejection_reason } = req.body
  if (!kyc_id || !['approve', 'reject'].includes(action))
    return res.status(400).json({ error: 'kyc_id and action (approve|reject) required' })
  if (action === 'reject' && !rejection_reason?.trim())
    return res.status(400).json({ error: 'rejection_reason required when rejecting' })

  // Fetch KYC record
  const { data: kyc, error: kycErr } = await supabaseAdmin
    .from('kyc_records').select('id, user_id, status').eq('id', kyc_id).single()
  if (kycErr || !kyc) return res.status(404).json({ error: 'KYC record not found' })
  if (kyc.status !== 'pending') return res.status(409).json({ error: `Already ${kyc.status}` })

  const now = new Date().toISOString()

  if (action === 'approve') {
    // Update KYC record
    await supabaseAdmin.from('kyc_records').update({
      status: 'approved',
      reviewed_at: now,
      reviewed_by: user.id,
    }).eq('id', kyc_id)

    // Mark profile verified
    await supabaseAdmin.from('profiles').update({
      kyc_verified: true,
    }).eq('id', kyc.user_id)

  } else {
    await supabaseAdmin.from('kyc_records').update({
      status: 'rejected',
      reviewed_at: now,
      reviewed_by: user.id,
      rejection_reason: rejection_reason.trim(),
    }).eq('id', kyc_id)
  }

  // Audit log
  await supabaseAdmin.from('audit_logs').insert({
    actor_id:    user.id,
    actor_role:  actor.role,
    action:      'kyc_reviewed',
    target_type: 'kyc_record',
    target_id:   String(kyc_id),
    description: `KYC ${action}d for user ${kyc.user_id}${action==='reject'?' — '+rejection_reason:''}`,
  })

  return res.status(200).json({ ok: true, action, kyc_id })
}
