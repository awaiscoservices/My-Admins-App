import { createPagesServerClient } from '../../../../lib/supabaseServer';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const supabase = createPagesServerClient({ req, res });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  const svc = createPagesServerClient({ req, res }, { supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY, supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL });
  const { data: staff } = await svc.from('staff_profiles').select('role').eq('user_id', session.user.id).single();
  if (!staff || staff.role !== 'super_admin') return res.status(403).json({ error: 'Forbidden' });
  const { updates } = req.body;
  if (!Array.isArray(updates)) return res.status(400).json({ error: 'updates array required' });
  for (const { key, value } of updates) {
    await svc.from('platform_settings').upsert({ key, value, updated_at: new Date().toISOString(), updated_by: session.user.id }, { onConflict: 'key' });
  }
  await svc.from('audit_logs').insert({ action: 'setting_update', performed_by: session.user.id, target_type: 'settings', target_id: null, details: { keys: updates.map(u=>u.key) } });
  return res.status(200).json({ success: true });
}
