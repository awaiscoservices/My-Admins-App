/**
 * GET  /api/admin/chat/canned  → this casino's saved chat replies
 * PUT  /api/admin/chat/canned  → replace them  { replies: [{ key, text }] }
 *
 * Saved (draft) replies staff can drop into a chat by typing a short key.
 * Held per casino in platform_settings under 'chat_canned_responses', so one
 * casino's replies never show in another's panel — no new table needed.
 */
import { guardAdmin, scopeToTenant, PERMS } from '../../../../lib/adminGuard'

const KEY = 'chat_canned_responses'

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const gate = await guardAdmin(req, res, { allow: PERMS.CHAT_READ })
    if (!gate) return
    const { data } = await scopeToTenant(
      gate.db.from('platform_settings').select('value').eq('key', KEY), gate,
    ).maybeSingle()
    const replies = Array.isArray(data?.value) ? data.value : []
    return res.status(200).json({ replies })
  }

  if (req.method === 'PUT') {
    const gate = await guardAdmin(req, res, { allow: PERMS.CHAT_SEND })
    if (!gate) return
    if (!gate.tenantId) return res.status(400).json({ error: 'Saved replies belong to a casino.' })

    const { replies } = req.body || {}
    if (!Array.isArray(replies)) return res.status(400).json({ error: 'replies must be an array' })
    if (replies.length > 100) return res.status(400).json({ error: 'That is more saved replies than a casino can use' })

    // Keep only well-formed rows: a short key and the text it expands to.
    const clean = replies
      .map(r => ({ key: String(r.key || '').trim().toLowerCase().replace(/\s+/g, ''), text: String(r.text || '').trim() }))
      .filter(r => r.key && r.text && r.text.length <= 2000)
      .slice(0, 100)

    const { error } = await gate.db.from('platform_settings').upsert({
      tenant_id:  gate.tenantId,
      key:        KEY,
      value:      clean,
      updated_at: new Date().toISOString(),
      updated_by: gate.actor.id,
    }, { onConflict: 'tenant_id,key' })

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true, replies: clean })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
