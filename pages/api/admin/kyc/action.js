/**
 * POST /api/admin/kyc/action
 *
 * Body: { kyc_id, action: 'approve'|'reject', rejection_reason? }
 *
 * approve: sets kyc_records.status='verified' and profiles.kyc_status='verified'
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
  // A record waiting on staff can be in any of these. Only 'pending' was
  // accepted, so anything moved to under review, or sent back for more
  // information, could never be decided afterwards.
  const DECIDABLE = ['pending', 'under_review', 'more_info_required']
  if (!DECIDABLE.includes(kyc.status)) {
    return res.status(409).json({ error: `This verification is ${kyc.status} and cannot be changed.` })
  }

  const now = new Date().toISOString()

  if (action === 'approve') {
    // 'verified', not 'approved'. The column's check constraint allows
    // not_started, pending, under_review, verified, rejected,
    // more_info_required and expired — so this write was rejected every
    // time. Nothing checked the error, so approving looked like it worked
    // while the record stayed pending and only the profile moved.
    const { error: recordErr } = await supabaseAdmin.from('kyc_records').update({
      status: 'verified',
      reviewed_at: now,
      reviewed_by: actor.id,
    }).eq('id', kyc_id)

    if (recordErr) {
      console.error('[kyc/action] approve failed:', recordErr)
      return res.status(500).json({ error: `Could not approve: ${recordErr.message}` })
    }

    // profiles has kyc_status, not kyc_verified. 'verified' is the value the
    // withdraw page and the withdrawal route both check before a payout.
    const { error: profileErr } = await supabaseAdmin.from('profiles').update({
      kyc_status: 'verified',
    }).eq('id', kyc.user_id)

    if (profileErr) {
      console.error('[kyc/action] profile update failed:', profileErr)
      return res.status(500).json({ error: 'KYC approved, but the player is still blocked from withdrawing. Tell a developer.' })
    }

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

  // Notify the player of the decision. Without this a verification silently
  // flipped and the player never knew they could now withdraw (or why they
  // still cannot). Non-critical: never blocks the decision.
  await supabaseAdmin.from('notifications').insert(
    action === 'approve'
      ? {
          tenant_id: tenantId,
          user_id:   kyc.user_id,
          type:      'kyc_approved',
          title:     'Identity Verified ✅',
          message:   'Your identity verification was approved. You can now request withdrawals.',
        }
      : {
          tenant_id: tenantId,
          user_id:   kyc.user_id,
          type:      'kyc_rejected',
          title:     'Verification Needs Attention',
          message:   `Your identity verification was rejected. Reason: ${rejection_reason.trim()}. Please re-submit your documents.`,
        }
  ).then(() => {}, () => {})

  return res.status(200).json({ ok: true, action, kyc_id })
}
