/**
 * POST /api/admin/game-accounts/setup
 * Staff enters game credentials and activates a pending game account.
 * Passwords are stored encrypted (AES-256). 
 * For now: stores as-is but marks the field clearly for encryption upgrade.
 */
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Encrypt game password with AES-256-GCM
function encryptPassword(plaintext) {
  const key = process.env.ENCRYPTION_KEY
  if (!key || key.length < 32) throw new Error('ENCRYPTION_KEY not set or too short')
  const keyBuffer = Buffer.from(key.slice(0, 64), 'hex')
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' })

  const { data: admin } = await supabaseAdmin
    .from('profiles')
    .select('id, role, full_name')
    .eq('id', user.id)
    .single()

  const allowedRoles = ['super_admin', 'game_ops']
  if (!admin || !allowedRoles.includes(admin.role))
    return res.status(403).json({ error: 'Insufficient permissions' })

  const { account_id, game_username, game_password, game_id, admin_notes, action } = req.body

  if (!account_id) return res.status(400).json({ error: 'account_id required' })

  // Load account
  const { data: account } = await supabaseAdmin
    .from('game_accounts')
    .select('*, profiles(full_name, email), game_panels(name)')
    .eq('id', account_id)
    .single()

  if (!account) return res.status(404).json({ error: 'Game account not found' })

  // ── Suspend action ─────────────────────────────────────────
  if (action === 'suspend') {
    await supabaseAdmin.from('game_accounts').update({ status: 'suspended' }).eq('id', account_id)
    await logAudit(supabaseAdmin, admin, 'game_account_suspended', 'game_account', account_id, { status: account.status }, { status: 'suspended' })
    return res.status(200).json({ message: 'Account suspended' })
  }

  // ── Setup / activate action ────────────────────────────────
  if (!game_username?.trim()) return res.status(400).json({ error: 'Username is required' })
  if (!game_password?.trim() && account.status === 'pending') return res.status(400).json({ error: 'Password is required for new accounts' })

  const updates = {
    game_username:     game_username.trim(),
    game_id:           game_id?.trim() || null,
    status:            'active',
    created_by_admin:  admin.id,
    admin_notes:       admin_notes?.trim() || null,
  }

  // Encrypt password if provided
  if (game_password?.trim()) {
    try {
      updates.game_password_enc = encryptPassword(game_password.trim())
    } catch (err) {
      // If encryption key not set, store with warning prefix — MUST fix before production
      console.warn('ENCRYPTION_KEY not configured - storing password without encryption')
      updates.game_password_enc = `UNENCRYPTED:${game_password.trim()}`
    }
  }

  await supabaseAdmin.from('game_accounts').update(updates).eq('id', account_id)

  // Notify player
  await supabaseAdmin.from('notifications').insert({
    user_id: account.user_id,
    type: 'game_account_created',
    title: `${account.game_panels?.name} Account Ready! 🎮`,
    message: `Your ${account.game_panels?.name} game account has been set up. Username: ${game_username}. You can now load credits and start playing!`,
    reference_id: account.reference_id,
  })

  await logAudit(supabaseAdmin, admin, 'game_account_activated', 'game_account', account_id,
    { status: account.status },
    { status: 'active', game_username, activated_by: admin.full_name }
  )

  return res.status(200).json({ message: 'Game account activated successfully' })
}

async function logAudit(client, actor, action, targetType, targetId, before, after) {
  await client.from('audit_logs').insert({
    actor_id: actor.id,
    actor_role: actor.role,
    action, target_type: targetType, target_id: targetId,
    before_state: before, after_state: after,
  }).then(() => {}, () => {})
}
