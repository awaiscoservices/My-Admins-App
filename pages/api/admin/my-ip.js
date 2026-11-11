/**
 * GET /api/admin/my-ip
 *
 * The caller's own IP address, as the server sees it. The IP whitelist editor
 * shows this so an admin can add their current network before turning the
 * restriction on — the single most common way to lock yourself out.
 */
import { guardAdmin, clientIp, PERMS } from '../../../lib/adminGuard'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const gate = await guardAdmin(req, res, { allow: PERMS.SETTINGS_READ })
  if (!gate) return
  return res.status(200).json({ ip: clientIp(req) })
}
