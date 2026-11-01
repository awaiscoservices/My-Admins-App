import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const ALLOWED_ROLES = ['super_admin', 'admin', 'kyc_agent', 'support']

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' })

  const { data: staff, error: staffErr } = await supabaseAdmin
    .from('profiles').select('role, full_name').eq('id', user.id).single()
  if (staffErr || !staff || !ALLOWED_ROLES.includes(staff.role)) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const { kyc_id, action, notes } = req.body
  if (!kyc_id || !['approve', 'reject'].includes(action)) {
    return res.status(400).json({ error: 'kyc_id and action (approve|reject) required' })
  }
  if (action === 'reject' && !notes?.trim()) {
    return res.status(400).json({ error: 'Rejection reason required' })
  }

  const { data: kyc, error: kycErr } = await supabaseAdmin
    .from('kyc_records').select('id, user_id, status').eq('id', kyc_id).single()
  if (kycErr || !kyc) return res.status(404).json({ error: 'KYC record not found' })
  if (!['pending', 'under_review'].includes(kyc.status)) {
    return res.status(400).json({ error: 'KYC is not pending review' })
  }

  const newStatus = action === 'approve' ? 'verified' : 'rejected'

  await supabaseAdmin.from('kyc_records').update({
    status: newStatus,
    reviewed_at: new Date().toISOString(),
    reviewed_by: user.id,
    reviewer_notes: notes?.trim() || null,
  }).eq('id', kyc_id)

  // Sync kyc_status on the player's profile row
  await supabaseAdmin.from('profiles').update({
    kyc_status: newStatus,
  }).eq('id', kyc.user_id)

  await supabaseAdmin.from('notifications').insert({
    user_id: kyc.user_id,
    title: action === 'approve' ? '✅ Identity Verified' : '❌ KYC Rejected',
    message: action === 'approve'
      ? 'Your identity verification has been approved. You can now make withdrawals.'
      : `Your KYC submission was rejected. Reason: ${notes?.trim()}. Please resubmit with clearer documents.`,
  })

  await supabaseAdmin.from('audit_logs').insert({
    actor_id: user.id,
    action: `kyc_${action}`,
    target_type: 'kyc_records',
    target_id: kyc_id,
    details: { notes, reviewed_by: staff.full_name, new_status: newStatus },
  })

  return res.status(200).json({ success: true, status: newStatus })
}
