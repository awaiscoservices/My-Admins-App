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
import { guardAdmin, loadOwnedRow, tenantOf, PERMS } from '../../../../lib/adminGuard'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const gate = await guardAdmin(req, res, { allow: PERMS.KYC_ACTION })
  if (!gate) return
  const supabaseAdmin = gate.db
  const actor = gate.actor

  const { kyc_id, action, rejection_reason } = req.body
  if (!kyc_id || !['approve', 'reject'].includes(action))
    return res.status(400).json({ error: 'kyc_id and action (approve|reject) required' })
  if (action === 'reject' && !rejection_reason?.trim())
    return res.status(400).json({ error: 'rejection_reason required when rejecting' })

  // Fetch KYC record
  // Scoped: another casino's KYC record is not found, so it cannot be reviewed.
  const { row: kyc, error: kycErr } = await loadOwnedRow(
    gate, 'kyc_records', kyc_id, 'id, user_id, status, tenant_id'
  )
  if (kycErr || !kyc) return res.status(404).json({ error: 'KYC record not found' })
  const tenantId = tenantOf(kyc, gate)
  if (kyc.status !== 'pending') return res.status(409).json({ error: `Already ${kyc.status}` })

  const now = new Date().toISOString()

  if (action === 'approve') {
    // Update KYC record
    await supabaseAdmin.from('kyc_records').update({
      status: 'approved',
      reviewed_at: now,
      reviewed_by: actor.id,
    }).eq('id', kyc_id)

    // profiles has kyc_status, not kyc_verified. 'verified' is the value
    // request_withdrawal() checks before allowing a payout.
    await supabaseAdmin.from('profiles').update({
      kyc_status: 'verified',
    }).eq('id', kyc.user_id)

  } else {
    await supabaseAdmin.from('kyc_records').update({
      status: 'rejected',
      reviewed_at: now,
      reviewed_by: actor.id,
      rejection_reason: rejection_reason.trim(),
    }).eq('id', kyc_id)
  }

  // Audit log
  await supabaseAdmin.from('audit_logs').insert({
    tenant_id:   tenantId,
    actor_id:    actor.id,
    actor_role:  actor.role,
    action:      'kyc_reviewed',
    target_type: 'kyc_record',
    target_id:   String(kyc_id),
    description: `KYC ${action}d for user ${kyc.user_id}${action==='reject'?' — '+rejection_reason:''}`,
  })

  return res.status(200).json({ ok: true, action, kyc_id })
}
