/**
 * lib/platformDefaults.js
 *
 * What a new casino is created with, held on the platform rather than copied
 * from an existing casino.
 *
 * Everything lives in platform_defaults as one row per kind, the value being
 * an array of plain row objects. No column is named anywhere in here: a row
 * is stored whole, minus the columns that tie it to one casino. That way the
 * defaults cannot go stale when a table gains a column — which is how four
 * phantom columns got shipped before this existed.
 *
 * The first casino used to be the template. Nobody could see that, and
 * deleting it would have quietly stopped every future casino getting
 * settings, levels, games, payment methods or referral tiers.
 */

/** The kinds a casino is seeded with, in the order they are applied. */
export const DEFAULT_KINDS = [
  {
    key:    'player_levels',
    table:  'player_levels',
    label:  'Player Levels',
    strip:  ['id', 'tenant_id', 'created_at', 'updated_at'],
    order:  'sort_order',
  },
  {
    key:    'game_panels',
    table:  'game_panels',
    label:  'Games',
    strip:  ['id', 'tenant_id', 'created_at', 'updated_at'],
    order:  'sort_order',
  },
  {
    key:    'payment_methods',
    table:  'payment_methods',
    label:  'Payment Methods',
    strip:  ['id', 'tenant_id', 'created_at', 'updated_at'],
    order:  'sort_order',
  },
  {
    key:    'referral_bonus_tiers',
    table:  'referral_bonus_tiers',
    label:  'Referral Tiers',
    strip:  ['tenant_id', 'updated_at'],
    order:  'deposit_number',
  },
  {
    key:    'platform_settings',
    table:  'platform_settings',
    label:  'Settings',
    strip:  ['tenant_id', 'updated_at', 'updated_by'],
    order:  'key',
  },
]

export const KIND_BY_KEY = Object.fromEntries(DEFAULT_KINDS.map(k => [k.key, k]))

/** A row with the columns that belong to one casino removed. */
export function stripRow(kind, row) {
  const out = { ...row }
  for (const column of kind.strip) delete out[column]
  delete out.__index          // the editor's own row marker, never a column
  return out
}

/** Read one kind's stored defaults. Always an array. */
export async function readDefaults(db, key) {
  const { data } = await db
    .from('platform_defaults')
    .select('value, updated_at')
    .eq('key', key)
    .maybeSingle()

  return {
    rows:       Array.isArray(data?.value) ? data.value : [],
    updated_at: data?.updated_at || null,
  }
}

/** Replace one kind's stored defaults. */
export async function writeDefaults(db, key, rows, actorId) {
  return db.from('platform_defaults').upsert({
    key,
    value:      rows,
    updated_at: new Date().toISOString(),
    updated_by: actorId || null,
  }, { onConflict: 'key' })
}

/**
 * Give a casino everything it is missing.
 *
 * A kind is only applied when that casino has none of it, so this is safe to
 * run twice and never touches a casino that has been set up by hand. Returns
 * what was added and what was skipped, so the caller can say so plainly.
 */
export async function applyDefaultsToTenant(db, tenantId) {
  const applied = {}

  for (const kind of DEFAULT_KINDS) {
    const { rows } = await readDefaults(db, kind.key)
    if (!rows.length) { applied[kind.key] = { added: 0, reason: 'no default set' }; continue }

    const { count } = await db
      .from(kind.table)
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)

    if (count > 0) { applied[kind.key] = { added: 0, reason: `already has ${count}` }; continue }

    const copies = rows.map(r => ({ ...stripRow(kind, r), tenant_id: tenantId }))
    const { error } = await db.from(kind.table).insert(copies)

    applied[kind.key] = error
      ? { added: 0, reason: error.message }
      : { added: copies.length }
  }

  return applied
}
