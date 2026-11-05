import { createPagesServerClient } from '../../../../lib/supabaseServer';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const supabase = createPagesServerClient({ req, res });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  const svc = createPagesServerClient({ req, res }, { supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY, supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL });
  const { data: staff } = await svc.from('staff_profiles').select('role').eq('user_id', session.user.id).single();
  if (!staff || !['super_admin','risk'].includes(staff.role)) return res.status(403).json({ error: 'Forbidden' });

  const { action, player_id, reason, note, flag_id } = req.body;

  if (action === 'flag') {
    if (!player_id || !reason?.trim()) return res.status(400).json({ error: 'player_id and reason required' });
    const { error } = await svc.from('risk_flags').insert({ player_id, reason: reason.trim(), note: note?.trim()||null, status: 'active', flagged_by: session.user.id });
    if (error) return res.status(500).json({ error: error.message });
    await svc.from('audit_logs').insert({ action: 'risk_flag', performed_by: session.user.id, target_type: 'player', target_id: player_id, details: { reason, note } });
    return res.status(200).json({ success: true });
  }

  if (action === 'unflag') {
    if (!flag_id) return res.status(400).json({ error: 'flag_id required' });
    const { data: flag } = await svc.from('risk_flags').select('player_id').eq('id', flag_id).single();
    const { error } = await svc.from('risk_flags').update({ status: 'resolved', resolved_by: session.user.id, resolved_at: new Date().toISOString(), note: note?.trim()||null }).eq('id', flag_id);
    if (error) return res.status(500).json({ error: error.message });
    await svc.from('audit_logs').insert({ action: 'risk_unflag', performed_by: session.user.id, target_type: 'risk_flag', target_id: flag_id, details: { player_id: flag?.player_id, note } });
    return res.status(200).json({ success: true });
  }

  return res.status(400).json({ error: 'Unknown action' });
}
