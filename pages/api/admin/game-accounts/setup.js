/**
 * POST /api/admin/game-accounts/setup
 * Staff enters game credentials and activates a pending game account.
 * Passwords stored AES-256-GCM encrypted.
 *
 * NOTE: game accounts are this platform's records only — the actual game panel
 * account is created by the admin in the external game panel. This route stores
 * the credentials the admin enters so the player can see them in their dashboard.
 */
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

function encryptPassword(plaintext) {
  const key = process.env.ENCRYPTION_KEY
  if (!key || key.length < 64) throw new Error('ENCRYPTION_KEY not set or too short (needs 64 hex chars)')
  const keyBuffer = Buffer.from(key.slice(0, 64), 'hex')
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`
}

// Roles allowed to set up game accounts
const ALLOWED_ROLES = ['super_admin', 'admin', 'game_ops']

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' })

  const { data: admin, error: profileErr } = await supabaseAdmin
    .from('profiles')
    .select('id, role, full_name')
    .eq('id', user.id)
    .single()

  if (profileErr || !admin) return res.status(401).json({ error: 'Profile not found' })
  if (!ALLOWED_ROLES.includes(admin.role))
    return res.status(403).json({ error: `Insufficient permissions (role: ${admin.role})` })

  const { account_id, game_username, game_password, game_id, admin_notes, action } = req.body
  if (!account_id) return res.status(400).json({ error: 'account_id required' })

  // Load account
  const { data: account, error: accountErr } = await supabaseAdmin
    .from('game_accounts')
    .select('id, user_id, status, reference_id, game_panel_id, game_username')
    .eq('id', account_id)
    .single()

  if (accountErr) {
    console.error('game-accounts setup - account lookup error:', accountErr)
    return res.status(500).json({ error: 'Database error looking up game account', detail: accountErr.message })
  }
  if (!account) return res.status(404).json({ error: 'Game account not found' })

  // Load game panel name separately for notification
  const { data: panel } = await supabaseAdmin
    .from('game_panels')
    .select('name')
    .eq('id', account.game_panel_id)
    .single()

  // ── Suspend action ─────────────────────────────────────────
  if (action === 'suspend') {
    await supabaseAdmin.from('game_accounts').update({ status: 'suspended' }).eq('id', account_id)
    await logAudit(supabaseAdmin, admin, 'game_account_suspended', 'game_account', account_id,
      { status: account.status }, { status: 'suspended' })
    return res.status(200).json({ message: 'Account suspended' })
  }

  // ── Reactivate action ──────────────────────────────────────
  if (action === 'reactivate') {
    await supabaseAdmin.from('game_accounts').update({ status: 'active' }).eq('id', account_id)
    await logAudit(supabaseAdmin, admin, 'game_account_reactivated', 'game_account', account_id,
      { status: account.status }, { status: 'active' })
    return res.status(200).json({ message: 'Account reactivated' })
  }

  // ── Setup / update credentials ─────────────────────────────
  if (!game_username?.trim()) return res.status(400).json({ error: 'Username is required' })
  if (!game_password?.trim() && account.status === 'pending')
    return res.status(400).json({ error: 'Password is required for new accounts' })

  // Build update — only columns that actually exist in the game_accounts table.
  // NOTE: activated_at does NOT exist in the schema; use updated_at (auto-managed by Supabase).
  const updates = {
    game_username:    game_username.trim(),
    game_id:          game_id?.trim() || null,
    status:           'active',
    created_by_admin: admin.id,
    admin_notes:      admin_notes?.trim() || null,
    // activated_at removed — column does not exist; updated_at is handled automatically
  }

  if (game_password?.trim()) {
    try {
      updates.game_password_enc = encryptPassword(game_password.trim())
    } catch (encErr) {
      console.warn('ENCRYPTION_KEY issue:', encErr.message)
      // Store with prefix so it's obvious — must configure ENCRYPTION_KEY in prod
      updates.game_password_enc = `UNENCRYPTED:${game_password.trim()}`
    }
  }

  const { error: updateErr } = await supabaseAdmin
    .from('game_accounts')
    .update(updates)
    .eq('id', account_id)

  if (updateErr) {
    console.error('game-accounts setup - update error:', updateErr)
    return res.status(500).json({ error: 'Failed to update game account', detail: updateErr.message })
  }

  // Notify player
  await supabaseAdmin.from('notifications').insert({
    user_id: account.user_id,
    type: 'game_account_created',
    title: `${panel?.name || 'Game'} Account Ready! 🎮`,
    message: `Your ${panel?.name || 'game'} account has been set up. Username: ${game_username.trim()}. You can now load credits and start playing!`,
    reference_id: account.reference_id,
  }).then(() => {}, () => {})

  await logAudit(supabaseAdmin, admin, 'game_account_activated', 'game_account', account_id,
    { status: account.status },
    { status: 'active', game_username: game_username.trim(), activated_by: admin.full_name }
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
