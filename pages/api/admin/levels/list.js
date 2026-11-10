/**
 * GET /api/admin/levels/list
 * Returns all player levels ordered by sort_order.
 */
import { guardAdmin, scopeToTenant, loadOwnedRow, PERMS } from '../../../../lib/adminGuard'

const ALLOWED_ROLES = ['super_admin', 'admin', 'support', 'finance', 'risk', 'reporting', 'marketing', 'kyc_agent']

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const gate = await guardAdmin(req, res, { allow: PERMS.LEVELS_READ })
  if (!gate) return
  const supabaseAdmin = gate.db

  const { data, error } = await scopeToTenant(
    supabaseAdmin
    .from('player_levels')
    .select([
      'id', 'name', 'sort_order', 'xp_required',
      'accent_color', 'badge_color', 'badge_icon',
      'kyc_required', 'is_active', 'description',
      'max_redeem_cap_cents', 'min_redeem_multiplier', 'max_redeem_multiplier',
      'min_withdrawal_cents', 'max_withdrawal_cents',
      'created_at',
    ].join(', '))
    .order('sort_order', { ascending: true }),
    gate,
  )

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ levels: data || [] })
}
