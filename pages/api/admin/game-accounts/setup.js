/**
 * POST /api/admin/game-accounts/setup
 * Staff enters game credentials and activates a pending game account.
 * Passwords stored AES-256-GCM encrypted.
 *
 * NOTE: game accounts are this platform's records only — the actual game panel
 * account is created by the admin in the external game panel. This route stores
 * the credentials the admin enters so the player can see them in their dashboard.
 */
import crypto from 'crypto'
import { guardAdmin, loadOwnedRow, tenantOf, PERMS } from '../../../../lib/adminGuard'

/**
 * Encrypt a game password with AES-256-GCM.
 *
 * Throws if ENCRYPTION_KEY is absent or malformed. The caller must let that
 * throw reach the client: storing the password unencrypted instead would be
 * worse than refusing to store it at all.
 *
 * The key must be exactly 64 hex characters (32 bytes). The old check only
 * tested length, so a 64-character non-hex string passed it and then produced
 * a short buffer, which createCipheriv rejects.
 */
function encryptPassword(plaintext) {
  const key = process.env.ENCRYPTION_KEY
  if (!key || !/^[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error('ENCRYPTION_KEY must be exactly 64 hex characters')
  }
  const keyBuffer = Buffer.from(key, 'hex')
  const iv = crypto.randomBytes(12)   // 12 bytes is the correct IV size for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const gate = await guardAdmin(req, res, { allow: PERMS.GAME_ACCOUNTS_SETUP })
  if (!gate) return
  const supabaseAdmin = gate.db
  const actor = gate.actor
  const admin = gate.actor

  const { account_id, game_username, game_password, game_id, admin_notes, action } = req.body
  if (!account_id) return res.status(400).json({ error: 'account_id required' })

  // Load account, scoped to the caller's casino.
  const { row: account, error: accountErr } = await loadOwnedRow(
    gate, 'game_accounts', account_id,
    'id, user_id, status, reference_id, game_panel_id, game_username, tenant_id'
  )

  if (accountErr) {
    console.error('game-accounts setup - account lookup error:', accountErr)
    return res.status(500).json({ error: 'Database error looking up game account', detail: accountErr.message })
  }
  if (!account) return res.status(404).json({ error: 'Game account not found' })
  const tenantId = tenantOf(account, gate)

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
    // Saving a password answers an outstanding request, so clear the flag.
    // Without this the row would sit under Password requests for ever.
    updates.password_change_requested = false
    updates.password_change_requested_at = null

    // No fallback. This used to store `UNENCRYPTED:<password>` when the key was
    // missing, which looked like success while writing the password in clear
    // text. Refusing the save is the safe outcome.
    try {
      updates.game_password_enc = encryptPassword(game_password.trim())
    } catch (encErr) {
      console.error('[game-accounts/setup] encryption unavailable:', encErr.message)
      return res.status(500).json({
        error: 'Cannot store the game password because encryption is not configured on the server. Nothing was saved. Ask a super admin to set ENCRYPTION_KEY.',
      })
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

  // Notify player.
  //
  // tenant_id was missing here, which left the row NULL and invisible to
  // every scoped read — the player was never told their account was ready.
  //
  // An account that was already active and has just had its password
  // replaced is a different message: nothing was "set up".
  const wasPasswordChange = account.status === 'active' && !!account.game_username

  await supabaseAdmin.from('notifications').insert({
    tenant_id:    tenantId,
    user_id:      account.user_id,
    type:         'game_account_created',
    title:        wasPasswordChange ? `New ${panel?.name || 'game'} password ready` : `${panel?.name || 'Game'} account ready`,
    message:      wasPasswordChange
      ? `Your ${panel?.name || 'game'} password has been changed. Open Games → My Games to see it.`
      : `Your ${panel?.name || 'game'} account has been set up. Username: ${game_username.trim()}. You can now load credits and start playing.`,
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
