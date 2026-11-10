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

/**
 * Service-role client. Bypasses Row Level Security, so every query made with
 * it MUST be scoped by hand — that is what scopeToTenant() is for.
 * Server-side only. Never import this file from a page or component.
 */
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

/** Every staff role that exists, for validation. */
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

/**
 * Who may do what — the single source of truth.
 *
 * These lists were copied verbatim from the routes as they behave today, so
 * moving a route onto the guard changes NOTHING about who can reach it. Tighten
 * them later, deliberately, in this one place.
 *
 * super_admin is listed explicitly rather than special-cased, so each entry
 * reads as the complete answer.
 */
export const PERMS = {
  // reads
  PLAYERS_READ:     ['super_admin', 'admin', 'finance', 'support', 'risk', 'kyc_agent', 'game_ops'],
  DEPOSITS_READ:    ['super_admin', 'admin', 'finance'],
  WITHDRAWALS_READ: ['super_admin', 'admin', 'finance'],
  WALLETS_READ:     ['super_admin', 'finance', 'support', 'risk', 'reporting'],
  TRANSACTIONS_READ:['super_admin', 'finance', 'reporting', 'support'],
  KYC_READ:         ['super_admin', 'admin', 'kyc_agent', 'risk'],
  REDEMPTIONS_READ: ['super_admin', 'admin', 'finance', 'game_ops'],
  GAME_LOADS_READ:  ['super_admin', 'admin', 'game_ops'],

  // writes — copied verbatim from each route's own list
  DEPOSITS_ACTION:    ['super_admin', 'finance'],
  WITHDRAWALS_ACTION: ['super_admin', 'admin', 'finance'],
  REDEMPTIONS_ACTION: ['super_admin', 'admin', 'finance', 'game_ops'],
  GAME_LOADS_ACTION:  ['super_admin', 'admin', 'finance', 'game_ops'],
  WALLETS_ADJUST:     ['super_admin', 'finance'],
  PLAYER_WALLET_ADJUST: ['super_admin', 'admin', 'finance'],
  ADJUSTMENTS_CREATE: ['super_admin', 'finance'],
  GAME_ACCOUNTS_SETUP: ['super_admin', 'admin', 'game_ops'],
  KYC_ACTION:          ['super_admin', 'admin'],
  PLAYER_STATUS:       ['super_admin', 'admin', 'support', 'risk'],
  PLAYER_DETAIL:       ['super_admin', 'admin', 'finance', 'support', 'kyc_agent', 'risk'],
  ANALYTICS:           ['super_admin', 'admin', 'finance', 'game_ops', 'support', 'kyc_agent', 'risk', 'reporting', 'marketing'],
  PENDING_COUNTS:      ['super_admin', 'admin', 'finance', 'game_ops', 'support', 'kyc_agent', 'risk', 'reporting', 'marketing'],
  NOTIFY_BROADCAST:    ['super_admin', 'marketing', 'support'],
  NOTIFY_SEND:         ['super_admin', 'marketing'],
  NOTIFY_READ:         ['super_admin', 'admin', 'support', 'finance', 'risk', 'kyc_agent', 'game_ops'],
  WALLET_SUMMARY:      ['super_admin', 'admin', 'finance', 'support', 'kyc_agent', 'risk', 'reporting', 'marketing'],
  SUPPORT_READ:        ['super_admin', 'support', 'finance', 'game_ops'],
  SUPPORT_ACTION:      ['super_admin', 'support'],
  RISK_READ:           ['super_admin', 'risk', 'finance'],
  RISK_ACTION:         ['super_admin', 'admin', 'risk'],
  PLAYERS_ACTION:      ['super_admin', 'admin', 'support', 'risk'],
  GAME_ACCOUNTS_READ:  ['super_admin', 'admin', 'game_ops', 'support', 'finance'],
  LEVEL_CHECK:         ['super_admin', 'support', 'finance'],
  ADJUSTMENTS_READ:    ['super_admin', 'finance'],
  BONUSES_READ:        ['super_admin', 'admin', 'marketing', 'finance'],
  BONUSES_WRITE:       ['super_admin', 'admin', 'marketing'],
  AUDIT_READ:          ['super_admin', 'risk', 'reporting'],
  GAMES_READ:          ['super_admin', 'game_ops'],
  GAMES_WRITE:         ['super_admin', 'admin', 'game_ops'],
  LEVELS_READ:         ['super_admin', 'admin', 'support', 'finance', 'risk', 'reporting', 'marketing', 'kyc_agent'],
  LEVELS_WRITE:        ['super_admin', 'admin', 'marketing'],
  PROMOS_READ:         ['super_admin', 'marketing', 'finance'],
  PROMOS_WRITE:        ['super_admin', 'admin', 'marketing'],
  PAYMENTS_READ:       ['super_admin', 'finance'],
  PAYMENTS_WRITE:      ['super_admin', 'admin', 'finance'],
  STAFF_MANAGE:        ['super_admin', 'admin'],
  SETTINGS_READ:       ['super_admin', 'admin', 'finance', 'game_ops'],
  SETTINGS_WRITE:      ['super_admin', 'admin'],
}

/**
 * Strip characters that act as separators inside a PostgREST `.or()` filter.
 * Without this, a search term containing a comma or bracket could change what
 * the filter means.
 */
export function safeSearchTerm(raw) {
  return String(raw ?? '').replace(/[,()."%\\]/g, '').trim()
}

/**
 * Verify the caller, check their role, and resolve their casino.
 *
 * On failure it sends the HTTP response itself and returns null, so a route
 * only needs: `if (!gate) return`.
 *
 * @returns {Promise<null | {
 *   db: import('@supabase/supabase-js').SupabaseClient,
 *   actor: { id: string, role: string, tenant_id: string|null },
 *   tenantId: string|null,
 *   isSuperAdmin: boolean,
 * }>}
 */
export async function guardAdmin(req, res, { allow } = {}) {
  if (!Array.isArray(allow) || allow.length === 0) {
    // A bug in the calling route, not something a request can trigger.
    res.status(500).json({ error: 'Route misconfigured: no allowed roles given' })
    return null
  }

  // 1. Who is this?
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

  // 2. Are they allowed here?
  const { data: actor, error: profileErr } = await supabaseAdmin
    .from('profiles')
    .select('id, role, tenant_id, status, full_name, email')
    .eq('id', user.id)
    .single()

  if (profileErr || !actor) {
    res.status(403).json({ error: 'Forbidden' })
    return null
  }

  // A disabled account keeps a valid login token until it expires, so this is
  // checked on every request rather than only at sign-in.
  //
  // profiles has no is_active column — selecting it made every guarded route
  // fail. status is the single source of truth for whether an account works.
  if (actor.status === 'suspended' || actor.status === 'banned') {
    res.status(403).json({ error: 'This account has been deactivated' })
    return null
  }

  if (!allow.includes(actor.role)) {
    res.status(403).json({ error: 'Forbidden' })
    return null
  }

  const isSuperAdmin = actor.role === 'super_admin'

  // 3. Which casino are they?
  // A super admin works across all casinos, so no tenant is required.
  // Everyone else MUST belong to one, or we cannot safely scope their queries.
  if (!isSuperAdmin && !actor.tenant_id) {
    res.status(403).json({
      error: 'Your staff account is not linked to a casino. Ask a super admin to set this up.',
    })
    return null
  }

  return {
    db: supabaseAdmin,
    actor,
    tenantId: actor.tenant_id ?? null,
    isSuperAdmin,
  }
}

/**
 * Limit a query to the caller's own casino.
 *
 * Super admins are returned the query untouched, so they still see everything.
 *
 * @param query  a Supabase query builder
 * @param gate   the object returned by guardAdmin()
 * @param column the tenant column on this table (defaults to 'tenant_id')
 */
export function scopeToTenant(query, gate, column = 'tenant_id') {
  if (!gate) throw new Error('scopeToTenant called without a guard result')
  if (gate.isSuperAdmin) return query
  return query.eq(column, gate.tenantId)
}

/**
 * The tenant_id to stamp on a row the caller is creating.
 *
 * A super admin may act for a specific casino by passing one explicitly;
 * anyone else always writes into their own.
 */
export function tenantForInsert(gate, explicitTenantId = null) {
  if (!gate) throw new Error('tenantForInsert called without a guard result')
  if (gate.isSuperAdmin) return explicitTenantId ?? null
  return gate.tenantId
}

/**
 * Load one row by id, but only if it belongs to the caller's casino.
 *
 * This is the whole fix for a write route. Every action route loads its target
 * first and then works from that object, so filtering here means another
 * casino's record is simply "not found" and nothing downstream can touch it.
 *
 * Returning 404 rather than 403 is deliberate: a 403 would confirm the record
 * exists, which tells one operator something about another's data.
 *
 * Super admins are not filtered.
 *
 * @returns {Promise<{ row: object|null, error: any }>}
 */
export async function loadOwnedRow(gate, table, id, columns = '*') {
  if (!gate) throw new Error('loadOwnedRow called without a guard result')
  if (!id) return { row: null, error: null }

  let q = gate.db.from(table).select(columns).eq('id', id)
  if (!gate.isSuperAdmin) q = q.eq('tenant_id', gate.tenantId)

  const { data, error } = await q.maybeSingle()
  return { row: data ?? null, error }
}

/**
 * The tenant_id that a row created *because of* an existing record should
 * carry — a ledger entry for a deposit, a notification about a withdrawal.
 *
 * Several routes insert into tenant-scoped tables without setting tenant_id,
 * which leaves those rows with NULL and invisible to any scoped read. Pass the
 * parent row and this returns the value to stamp on the child.
 */
export function tenantOf(parentRow, gate = null) {
  return parentRow?.tenant_id ?? gate?.tenantId ?? null
}
