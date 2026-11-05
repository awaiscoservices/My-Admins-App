import { createPagesServerClient } from '../../../../lib/supabaseServer';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const supabase = createPagesServerClient({ req, res });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  const svc = createPagesServerClient({ req, res }, { supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY, supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL });
  const { data: caller } = await svc.from('staff_profiles').select('role').eq('user_id', session.user.id).single();
  if (!caller || caller.role !== 'super_admin') return res.status(403).json({ error: 'Forbidden — super_admin only' });

  const { action, email, role, staff_id, active } = req.body;

  if (action === 'invite') {
    if (!email?.trim() || !role) return res.status(400).json({ error: 'email and role required' });
    const { data: invited, error: invErr } = await svc.auth.admin.inviteUserByEmail(email.trim(), { data: { role: 'staff' } });
    if (invErr) return res.status(500).json({ error: invErr.message });
    await svc.from('staff_profiles').insert({ user_id: invited.user.id, role, active: true });
    await svc.from('audit_logs').insert({ action: 'staff_invite', performed_by: session.user.id, target_type: 'staff', target_id: invited.user.id, details: { email, role } });
    return res.status(200).json({ success: true });
  }

  if (action === 'update_role') {
    if (!staff_id || !role) return res.status(400).json({ error: 'staff_id and role required' });
    const { error } = await svc.from('staff_profiles').update({ role, updated_at: new Date().toISOString() }).eq('id', staff_id);
    if (error) return res.status(500).json({ error: error.message });
    await svc.from('audit_logs').insert({ action: 'staff_role_change', performed_by: session.user.id, target_type: 'staff', target_id: staff_id, details: { new_role: role } });
    return res.status(200).json({ success: true });
  }

  if (action === 'toggle_active') {
    if (!staff_id) return res.status(400).json({ error: 'staff_id required' });
    const { error } = await svc.from('staff_profiles').update({ active: !!active, updated_at: new Date().toISOString() }).eq('id', staff_id);
    if (error) return res.status(500).json({ error: error.message });
    await svc.from('audit_logs').insert({ action: active ? 'staff_activate' : 'staff_deactivate', performed_by: session.user.id, target_type: 'staff', target_id: staff_id });
    return res.status(200).json({ success: true });
  }

  return res.status(400).json({ error: 'Unknown action' });
}
