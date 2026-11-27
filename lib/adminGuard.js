/**
 * lib/adminGuard.js
 *
 * ONE security gate for every /api/admin/* route.
 *
 * It answers three questions in one place, so no route has to ask them again:
 *   1. Who is this?            (verify the login token)
 *   2. Are they allowed here?  (check their staff role)
 *   3. Which casino are they?  (read tenant_id, so they only see their own data)
 *
 * Before this existed, ~70 routes each did steps 1 and 2 by hand and nobody
 * did step 3 — which is why every casino's staff could see every other
 * casino's players.
 *
 * It FAILS CLOSED. If we cannot work out which casino a staff member belongs
 * to, the request is refused. Showing nothing is safe; showing everything is
 * not.
 *
 * Usage in a route:
 *
 *   import { guardAdmin, scopeToTenant } from '../../../../lib/adminGuard'
 *
 *   const gate = await guardAdmin(req, res, { allow: PERMS.PLAYERS_READ })
 *   if (!gate) return                       // guard already sent the error
 *
 *   let q = gate.db.from('profiles').select('*').eq('role', 'player')
 *   q = scopeToTenant(q, gate)              // <- the line that fixes the leak
 */
import { createClient } from '@supabase/supabase-js'

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

export const ALL_ROLES = [
  'super_admin',
  'admin',
  'finance',
  'support',
  'risk',
  'kyc_agent',
  'game_ops',
  'reporting',
  'marketing',
]

export const PERMS = {
  // reads
  PLAYERS_READ:     ['super_admin', 'admin', 'finance', 'support', 'risk', 'kyc_agent', 'game_ops'],
  DEPOSITS_READ:    ['super_admin', 'admin', 'finance'],
  WITHDRAWALS_READ: ['super_admin', 'admin', 'finance'],
  WALLETS_READ:     ['super_admin', 'admin', 'finance', 'support', 'risk', 'reporting'],
  TRANSACTIONS_READ:['super_admin', 'admin', 'finance', 'reporting', 'support'],
  KYC_READ:         ['super_admin', 'admin', 'kyc_agent', 'risk'],
  REDEMPTIONS_READ: ['super_admin', 'admin', 'finance', 'game_ops'],
  GAME_LOADS_READ:  ['super_admin', 'admin', 'game_ops'],

  // writes
  DEPOSITS_ACTION:    ['super_admin', 'admin', 'finance'],
  WITHDRAWALS_ACTION: ['super_admin', 'admin', 'finance'],
  REDEMPTIONS_ACTION: ['super_admin', 'admin', 'finance', 'game_ops'],
  GAME_LOADS_ACTION:  ['super_admin', 'admin', 'finance', 'game_ops'],
  WALLETS_ADJUST:     ['super_admin', 'admin', 'finance'],
  PLAYER_WALLET_ADJUST: ['super_admin', 'admin', 'finance'],
  ADJUSTMENTS_CREATE: ['super_admin', 'admin', 'finance'],
  GAME_ACCOUNTS_SETUP: ['super_admin', 'admin', 'game_ops'],
  KYC_ACTION:          ['super_admin', 'admin'],
  PLAYER_STATUS:       ['super_admin', 'admin', 'support', 'risk'],
  PLAYER_DETAIL:       ['super_admin', 'admin', 'finance', 'support', 'kyc_agent', 'risk'],
  ANALYTICS:           ['super_admin', 'admin', 'finance', 'game_ops', 'support', 'kyc_agent', 'risk', 'reporting', 'marketing'],
  PENDING_COUNTS:      ['super_admin', 'admin', 'finance', 'game_ops', 'support', 'kyc_agent', 'risk', 'reporting', 'marketing'],
  NOTIFY_BROADCAST:    ['super_admin', 'admin', 'marketing', 'support'],
  NOTIFY_SEND:         ['super_admin', 'admin', 'marketing'],
  NOTIFY_READ:         ['super_admin', 'admin', 'support', 'finance', 'risk', 'kyc_agent', 'game_ops'],
  WALLET_SUMMARY:      ['super_admin', 'admin', 'finance', 'support', 'kyc_agent', 'risk', 'reporting', 'marketing'],
  SUPPORT_READ:        ['super_admin', 'admin', 'support', 'finance', 'game_ops'],
  SUPPORT_ACTION:      ['super_admin', 'admin', 'support'],
  RISK_READ:           ['super_admin', 'admin', 'risk', 'finance'],
  RISK_ACTION:         ['super_admin', 'admin', 'risk'],
  PLAYERS_ACTION:      ['super_admin', 'admin', 'support', 'risk'],
  GAME_ACCOUNTS_READ:  ['super_admin', 'admin', 'game_ops', 'support', 'finance'],
  LEVEL_CHECK:         ['super_admin', 'admin', 'support', 'finance'],
  ADJUSTMENTS_READ:    ['super_admin', 'admin', 'finance'],
  BONUSES_READ:        ['super_admin', 'admin', 'marketing', 'finance'],
  BONUSES_WRITE:       ['super_admin', 'admin', 'marketing'],
  AUDIT_READ:          ['super_admin', 'admin', 'risk', 'reporting'],
  GAMES_READ:          ['super_admin', 'admin', 'game_ops'],
  GAMES_WRITE:         ['super_admin', 'admin', 'game_ops'],
  LEVELS_READ:         ['super_admin', 'admin', 'support', 'finance', 'risk', 'reporting', 'marketing', 'kyc_agent'],
  LEVELS_WRITE:        ['super_admin', 'admin', 'marketing'],
  PROMOS_READ:         ['super_admin', 'admin', 'marketing', 'finance'],
  PROMOS_WRITE:        ['super_admin', 'admin', 'marketing'],
  PAYMENTS_READ:       ['super_admin', 'admin', 'finance'],
  PAYMENTS_WRITE:      ['super_admin', 'admin', 'finance'],
  STAFF_MANAGE:        ['super_admin', 'admin'],
  SETTINGS_READ:       ['super_admin', 'admin', 'finance', 'game_ops'],
  SETTINGS_WRITE:      ['super_admin', 'admin'],

  // Chat (player ⇄ staff live chat)
  CHAT_READ:           ['super_admin', 'admin', 'support'],
  CHAT_SEND:           ['super_admin', 'admin', 'support'],

  // Internal staff Support (team chat + platform support). Every staff role can
  // use it — it is how staff reach each other and how a tenant reaches the
  // platform owner. Players are not in ALL_ROLES, so they are excluded.
  INTERNAL_CHAT:       ALL_ROLES,
}

export function safeSearchTerm(raw) {
  return String(raw ?? '').replace(/[,()."%\\]/g, '').trim()
}

/**
 * Run a paginated PostgREST query and treat an out-of-range request as empty.
 *
 * PostgREST answers `.range(offset, …)` on an empty (or short) table with a
 * 416 "Requested range not satisfiable" (code PGRST103) instead of an empty
 * list. That surfaced as a red error toast on every list page once its table
 * had no rows. An empty table is not an error — so swallow PGRST103 and hand
 * back an empty page. Every other error passes through untouched.
 */
export async function runPaged(query) {
  const result = await query
  if (result.error && result.error.code === 'PGRST103') {
    return { data: [], count: 0, error: null }
  }
  return result
}

export async function guardAdmin(req, res, { allow } = {}) {
  if (!Array.isArray(allow) || allow.length === 0) {
    res.status(500).json({ error: 'Route misconfigured: no allowed roles given' })
    return null
  }

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' })
    return null
  }

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
  if (authErr || !user) {
    res.status(401).json({ error: 'Unauthorized' })
    return null
  }

  const { data: actor, error: profileErr } = await supabaseAdmin
    .from('profiles')
    .select('id, role, tenant_id, status, full_name, email, must_change_password')
    .eq('id', user.id)
    .single()

  if (profileErr || !actor) {
    res.status(403).json({ error: 'Forbidden' })
    return null
  }

  if (actor.status === 'suspended' || actor.status === 'banned') {
    res.status(403).json({ error: 'This account has been deactivated' })
    return null
  }

  if (!allow.includes(actor.role)) {
    res.status(403).json({ error: 'Forbidden' })
    return null
  }

  const isSuperAdmin = actor.role === 'super_admin'

  if (!isSuperAdmin && !actor.tenant_id) {
    res.status(403).json({
      error: 'Your staff account is not linked to a casino. Ask a super admin to set this up.',
    })
    return null
  }

  let require2fa = false
  if (!isSuperAdmin && actor.tenant_id) {
    const { data: ipRows } = await supabaseAdmin
      .from('platform_settings')
      .select('key, value')
      .eq('tenant_id', actor.tenant_id)
      .in('key', ['ip_whitelist_enabled', 'ip_whitelist', 'two_factor_required'])

    const map = Object.fromEntries((ipRows || []).map(r => [r.key, r.value]))
    const enabled = map.ip_whitelist_enabled === true || map.ip_whitelist_enabled === 'true'
    require2fa = map.two_factor_required === true || map.two_factor_required === 'true'

    let list = map.ip_whitelist
    if (typeof list === 'string') { try { list = JSON.parse(list) } catch { list = [] } }
    if (!Array.isArray(list)) list = []

    if (enabled && list.length) {
      const ip = clientIp(req)
      if (!ip || !list.includes(ip)) {
        res.status(403).json({ error: 'This panel is restricted to approved networks. Your network is not on the list.' })
        return null
      }
    }
  }

  const path = String(req.url || '').split('?')[0]

  // Forced password change: an admin-created account carries a temporary
  // password the admin knows. Until the staff member replaces it, the panel is
  // closed to them (except the routes needed to make the change). This is what
  // stops the admin keeping working knowledge of a staff member's credentials.
  if (actor.must_change_password && !PASSWORD_CHANGE_EXEMPT.includes(path)) {
    res.status(403).json({ error: 'You must set a new password before continuing.', code: 'password_change_required' })
    return null
  }

  // 2FA gate: enrolled staff must be at aal2, and when the casino requires 2FA,
  // an un-enrolled staff member is blocked (bootstrap routes excepted).
  const mfaErr = await mfaSessionError(token, actor.id, {
    require2fa,
    allowEnrollmentBootstrap: BOOTSTRAP_2FA_EXEMPT.includes(path),
  })
  if (mfaErr) {
    res.status(403).json({ error: mfaErr.message, code: mfaErr.code })
    return null
  }

  return {
    db: supabaseAdmin,
    actor,
    tenantId: actor.tenant_id ?? null,
    isSuperAdmin,
  }
}

export function clientIp(req) {
  const fwd = req.headers['x-forwarded-for']
  if (fwd) return String(fwd).split(',')[0].trim()
  return req.socket?.remoteAddress || null
}

// ── Two-factor (MFA) session policy ──────────────────────────────────────────
// Supabase stamps the access token's assurance level in the `aal` claim:
// 'aal1' = password only, 'aal2' = a TOTP code was entered this session.
// guardAdmin has already called getUser(), which verifies the token's
// signature and expiry, so trusting the decoded claim here is safe.
export function tokenAal(token) {
  try {
    const seg = String(token).split('.')[1]
    const json = Buffer.from(seg.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
    return JSON.parse(json).aal || null
  } catch { return null }
}

// Decide whether a request must be refused on 2FA grounds. Returns null when
// the session passes, or { code, message } when it must be blocked.
//   - Anyone who has ENROLLED a factor must be at aal2. Without this the login
//     MFA prompt is cosmetic: a password-only (aal1) token still reaches every
//     API directly, so a stolen password alone is enough.
//   - When the casino requires 2FA, a staff member with NO factor is blocked
//     until they enroll — except on the bootstrap routes the enroll modal needs
//     to read (otherwise the forced-enrollment screen can't load and the staff
//     member is stuck with no way forward).
// FAILS OPEN on a lookup error: a Supabase admin-API blip must never lock every
// staff member out of the panel.
export async function mfaSessionError(token, userId, { require2fa = false, allowEnrollmentBootstrap = false } = {}) {
  if (tokenAal(token) === 'aal2') return null
  let hasVerified = false
  try {
    const { data } = await supabaseAdmin.auth.admin.getUserById(userId)
    hasVerified = (data?.user?.factors || []).some(f => f.status === 'verified')
  } catch {
    return null
  }
  if (hasVerified)
    return { code: 'mfa_required', message: 'Two-factor verification required. Sign in again and enter your code.' }
  if (require2fa && !allowEnrollmentBootstrap)
    return { code: 'mfa_enrollment_required', message: 'This casino requires two-factor authentication. Set it up to continue.' }
  return null
}

// Routes the forced-enrollment modal must be able to read before a factor
// exists, so mandatory-2FA enforcement can't trap a staff member with no path
// to enroll. set-password is here too: a brand-new staff member may have to
// rotate their password before they can enroll. The aal2-if-enrolled rule
// still applies to all of these.
export const BOOTSTRAP_2FA_EXEMPT = ['/api/admin/settings/get', '/api/admin/me', '/api/admin/account/set-password']

// Routes reachable while a forced password change is pending: the layout reads
// `me` to learn who it is, and set-password is how the change is made. Anything
// else is refused until the temporary password the admin set is replaced.
export const PASSWORD_CHANGE_EXEMPT = ['/api/admin/me', '/api/admin/account/set-password']

export function scopeToTenant(query, gate, column = 'tenant_id') {
  if (!gate) throw new Error('scopeToTenant called without a guard result')
  if (gate.isSuperAdmin) return query
  return query.eq(column, gate.tenantId)
}

export function tenantForInsert(gate, explicitTenantId = null) {
  if (!gate) throw new Error('tenantForInsert called without a guard result')
  if (gate.isSuperAdmin) return explicitTenantId ?? null
  return gate.tenantId
}

export async function loadOwnedRow(gate, table, id, columns = '*') {
  if (!gate) throw new Error('loadOwnedRow called without a guard result')
  if (!id) return { row: null, error: null }

  let q = gate.db.from(table).select(columns).eq('id', id)
  if (!gate.isSuperAdmin) q = q.eq('tenant_id', gate.tenantId)

  const { data, error } = await q.maybeSingle()
  return { row: data ?? null, error }
}

export function tenantOf(parentRow, gate = null) {
  return parentRow?.tenant_id ?? gate?.tenantId ?? null
}
