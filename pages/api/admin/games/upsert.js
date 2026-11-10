import crypto from 'crypto'
import { guardAdmin, scopeToTenant, PERMS } from '../../../../lib/adminGuard'

const ALGO = 'aes-256-gcm'

/**
 * Throws if ENCRYPTION_KEY is absent or malformed, rather than letting
 * Buffer.from(undefined) fail with something unreadable. The caller must let
 * this reach the client: storing a game credential unencrypted would be worse
 * than refusing to store it.
 */
function encrypt(text) {
  const raw = process.env.ENCRYPTION_KEY
  if (!raw || !/^[0-9a-fA-F]{64}$/.test(raw)) {
    throw new Error('ENCRYPTION_KEY must be exactly 64 hex characters')
  }
  const key = Buffer.from(raw, 'hex')
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGO, key, iv)
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted.toString('hex')
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const gate = await guardAdmin(req, res, { allow: PERMS.GAMES_WRITE })
  if (!gate) return
  const supabaseAdmin = gate.db
  const admin = gate.actor

  const { id, name, code, description, is_active, credentials_json } = req.body
  if (!name?.trim()) return res.status(400).json({ error: 'Name required' })

  const payload = {
    tenant_id: gate.tenantId,
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
