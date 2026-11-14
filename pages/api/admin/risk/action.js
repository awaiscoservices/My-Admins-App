import { guardAdmin, scopeToTenant, loadOwnedRow, PERMS } from '../../../../lib/adminGuard'

const ALLOWED_ROLES = ['super_admin', 'admin', 'risk']

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const gate = await guardAdmin(req, res, { allow: PERMS.RISK_ACTION })
  if (!gate) return
  const supabaseAdmin = gate.db
  const admin = gate.actor

  const { action, user_id, reason, note, flag_id } = req.body

  if (action === 'flag') {
    if (!user_id || !reason?.trim()) {
      return res.status(400).json({ error: 'user_id and reason required' })
    }
    const { error } = await supabaseAdmin.from('risk_flags').insert({
      tenant_id: gate.tenantId,
      user_id,
      reason: reason.trim(),
      note: note?.trim() || null,
      status: 'active',
      flagged_by: admin.id,
      created_at: new Date().toISOString(),
    })
    if (error) return res.status(500).json({ error: error.message })

    await supabaseAdmin.from('audit_logs').insert({
      tenant_id: gate.tenantId,
      actor_id: admin.id,
      actor_role: admin.role,
      action: 'risk_flag',
      target_type: 'player',
      target_id: user_id,
      description: `Player flagged — ${reason}${note ? ' ('+note+')' : ''}`,
      metadata: { reason, note },
    })

    return res.status(200).json({ success: true })
  }

  if (action === 'unflag') {
    if (!flag_id) return res.status(400).json({ error: 'flag_id required' })

    // Scoped: another casino's flag is not found, so it cannot be resolved.
    const { row: flag } = await loadOwnedRow(gate, 'risk_flags', flag_id, 'user_id, tenant_id')
    if (!flag) return res.status(404).json({ error: 'Risk flag not found' })

    const { error } = await supabaseAdmin.from('risk_flags').update({
      status: 'resolved',
      resolved_by: admin.id,
      resolved_at: new Date().toISOString(),
      note: note?.trim() || null,
    }).eq('id', flag_id)
    if (error) return res.status(500).json({ error: error.message })

    await supabaseAdmin.from('audit_logs').insert({
      tenant_id: flag.tenant_id,
      actor_id: admin.id,
      actor_role: admin.role,
      action: 'risk_unflag',
      target_type: 'risk_flag',
      target_id: flag_id,
      description: `Risk flag resolved${note ? ' — '+note : ''}`,
      metadata: { user_id: flag?.user_id, note },
    })

    return res.status(200).json({ success: true })
  }

  return res.status(400).json({ error: 'Unknown action. Supported: flag, unflag' })
}
