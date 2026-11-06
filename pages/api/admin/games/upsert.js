import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const ALGO = 'aes-256-gcm'
function encrypt(text) {
  const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex')
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGO, key, iv)
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted.toString('hex')
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' })
  const { data: admin } = await supabaseAdmin.from('profiles').select('id, role').eq('id', user.id).single()
  if (!admin || !['super_admin', 'game_ops'].includes(admin.role)) return res.status(403).json({ error: 'Forbidden' })

  const { id, name, code, description, is_active, credentials_json } = req.body
  if (!name?.trim()) return res.status(400).json({ error: 'Name required' })

  const payload = {
    name: name.trim(), code: code?.trim() || null, description: description?.trim() || null,
    is_active: is_active !== false, updated_at: new Date().toISOString()
  }

  if (credentials_json?.trim()) {
    try { JSON.parse(credentials_json) }
    catch { return res.status(400).json({ error: 'Credentials must be valid JSON' }) }
    if (process.env.ENCRYPTION_KEY) payload.encrypted_credentials = encrypt(credentials_json.trim())
  }

  if (id) {
    const { error } = await supabaseAdmin.from('game_panels').update(payload).eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    await supabaseAdmin.from('audit_logs').insert({ action: 'game_update', performed_by: admin.id, target_type: 'game_panel', target_id: id, details: { name } })
  } else {
    const { data, error } = await supabaseAdmin.from('game_panels').insert({ ...payload, created_at: new Date().toISOString() }).select('id').single()
    if (error) return res.status(500).json({ error: error.message })
    await supabaseAdmin.from('audit_logs').insert({ action: 'game_create', performed_by: admin.id, target_type: 'game_panel', target_id: data.id, details: { name } })
  }

  return res.status(200).json({ success: true })
}
