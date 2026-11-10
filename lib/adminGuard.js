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
  PLAYERS_READ:     ['super_admin', 'admin', 'finance', 'support', 'risk', 'kyc_agent', 'game_ops'],
  DEPOSITS_READ:    ['super_admin', 'admin', 'finance'],
  WITHDRAWALS_READ: ['super_admin', 'admin', 'finance'],
  WALLETS_READ:     ['super_admin', 'finance', 'support', 'risk', 'reporting'],
  TRANSACTIONS_READ:['super_admin', 'finance', 'reporting', 'support'],
  KYC_READ:         ['super_admin', 'admin', 'kyc_agent', 'risk'],
  REDEMPTIONS_READ: ['super_admin', 'admin', 'finance', 'game_ops'],
  GAME_LOADS_READ:  ['super_admin', 'admin', 'game_ops'],
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
    .select('id, role, tenant_id, status')
    .eq('id', user.id)
    .single()

  if (profileErr || !actor) {
    res.status(403).json({ error: 'Forbidden' })
    return null
  }

  // A suspended account keeps a valid login token until it expires, so check.
  if (actor.status === 'suspended') {
    res.status(403).json({ error: 'This account is suspended' })
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
