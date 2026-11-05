import { createPagesServerClient } from '../../../../lib/supabaseServer';

const ALLOWED_ROLES = ['super_admin', 'kyc_agent'];

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabase = createPagesServerClient({ req, res });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const svc = createPagesServerClient({ req, res }, {
    supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  });

  const { data: staff } = await svc.from('staff_profiles').select('role').eq('user_id', session.user.id).single();
  if (!staff || !ALLOWED_ROLES.includes(staff.role)) return res.status(403).json({ error: 'Forbidden' });

  const { kyc_id, action, reason } = req.body;
  if (!kyc_id || !['approve', 'reject'].includes(action)) return res.status(400).json({ error: 'Invalid params' });
  if (action === 'reject' && !reason?.trim()) return res.status(400).json({ error: 'Reason required' });

  const { data: kyc, error: fetchErr } = await svc.from('kyc_submissions').select('*').eq('id', kyc_id).single();
  if (fetchErr || !kyc) return res.status(404).json({ error: 'Not found' });
  if (kyc.status !== 'pending') return res.status(409).json({ error: 'Already processed' });

  const newStatus = action === 'approve' ? 'approved' : 'rejected';

  const { error: updateErr } = await svc.from('kyc_submissions').update({ status: newStatus, reviewed_by: session.user.id, reviewed_at: new Date().toISOString(), rejection_reason: reason || null }).eq('id', kyc_id);
  if (updateErr) return res.status(500).json({ error: updateErr.message });

  if (action === 'approve') {
    await svc.from('players').update({ kyc_status: 'verified' }).eq('id', kyc.player_id);
  }

  await svc.from('notifications').insert({ player_id: kyc.player_id, type: 'kyc_result', title: action === 'approve' ? 'KYC Approved' : 'KYC Rejected', message: action === 'approve' ? 'Your identity has been verified.' : `KYC rejected: ${reason}`, read: false });

  await svc.from('audit_logs').insert({ action: `kyc_${action}`, performed_by: session.user.id, target_type: 'kyc_submission', target_id: kyc_id, details: { player_id: kyc.player_id, reason: reason || null } });

  return res.status(200).json({ success: true });
}
