import { createPagesServerClient } from '../../../../lib/supabaseServer';
import crypto from 'crypto';

const ALGO = 'aes-256-gcm';

function encrypt(text) {
  const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted.toString('hex');
}

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
  if (!staff || !['super_admin','game_ops'].includes(staff.role)) return res.status(403).json({ error: 'Forbidden' });

  const { game_id, name, provider, game_url, credentials_json, status } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name required' });

  const payload = { name: name.trim(), provider: provider?.trim()||null, game_url: game_url?.trim()||null, status: status||'active', updated_at: new Date().toISOString() };

  if (credentials_json?.trim()) {
    try { JSON.parse(credentials_json); }
    catch { return res.status(400).json({ error: 'Credentials must be valid JSON' }); }
    payload.encrypted_credentials = encrypt(credentials_json.trim());
  }

  if (game_id) {
    const { error } = await svc.from('games').update(payload).eq('id', game_id);
    if (error) return res.status(500).json({ error: error.message });
    await svc.from('audit_logs').insert({ action: 'game_update', performed_by: session.user.id, target_type: 'game', target_id: game_id, details: { name, status } });
  } else {
    const { data, error } = await svc.from('games').insert({ ...payload, created_at: new Date().toISOString() }).select('id').single();
    if (error) return res.status(500).json({ error: error.message });
    await svc.from('audit_logs').insert({ action: 'game_create', performed_by: session.user.id, target_type: 'game', target_id: data.id, details: { name } });
  }

  return res.status(200).json({ success: true });
}
