/**
 * /admin/settings
 *
 * Admin — Platform Settings
 * View and edit platform_settings table key/value pairs.
 * Groups settings into sections. super_admin only.
 */
import { useEffect, useState } from 'react'
import Head from 'next/head'
import { supabase } from '../../lib/supabase'
import AdminLayout from '../../components/layout/AdminLayout'

// Define known settings with labels and types
const SETTING_META = {
  withdrawal_daily_limit_enabled:  { label: 'Daily Withdrawal Limit Enabled', type: 'boolean', section: 'Withdrawals', desc: 'Enforce per-level daily withdrawal limits on approvals' },
  min_withdrawal_cents:            { label: 'Global Min Withdrawal ($)',       type: 'cents',   section: 'Withdrawals', desc: 'Minimum withdrawal amount for all players' },
  max_withdrawal_cents:            { label: 'Global Max Withdrawal ($)',       type: 'cents',   section: 'Withdrawals', desc: 'Maximum single withdrawal (0 = no cap)' },
  deposit_bonus_enabled:           { label: 'Deposit Bonus Enabled',           type: 'boolean', section: 'Deposits',    desc: 'Apply deposit bonus rules when deposits are approved' },
  referral_bonus_enabled:          { label: 'Referral Bonus Enabled',          type: 'boolean', section: 'Referrals',   desc: 'Award referral bonuses when referred players deposit' },
  kyc_required_global:             { label: 'KYC Required Globally',           type: 'boolean', section: 'KYC',         desc: 'Force KYC on all players regardless of level setting' },
  maintenance_mode:                { label: 'Maintenance Mode',                type: 'boolean', section: 'System',      desc: 'Block all player-facing pages with a maintenance message' },
  support_email:                   { label: 'Support Email',                   type: 'text',    section: 'System',      desc: 'Contact email shown to players' },
  platform_name:                   { label: 'Platform Name',                   type: 'text',    section: 'System',      desc: 'Display name used in emails and UI' },
}

const SECTIONS = [...new Set(Object.values(SETTING_META).map(m => m.section))]

export default function AdminSettings() {
  const [settings, setSettings] = useState({})   // { key: value }
  const [drafts,   setDrafts]   = useState({})   // keys being edited
  const [editing,  setEditing]  = useState({})   // { key: true }
  const [saving,   setSaving]   = useState({})
  const [loading,  setLoading]  = useState(true)
  const [toast,    setToast]    = useState(null)
  const [role,     setRole]     = useState('')

  useEffect(() => { load() }, [])

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  async function load() {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setLoading(false); return }

    const { data: p } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
    setRole(p?.role || '')

    const { data, error } = await supabase.from('platform_settings').select('key, value')
    if (error) { showToast(error.message, 'error'); setLoading(false); return }

    const map = {}
    for (const row of data || []) map[row.key] = row.value
    setSettings(map)
    setLoading(false)
  }

  function startEdit(key) {
    const meta = SETTING_META[key]
    let val = settings[key] ?? ''
    if (meta?.type === 'cents') val = ((parseInt(val) || 0) / 100).toFixed(2)
    if (meta?.type === 'boolean') val = String(val) === 'true' ? 'true' : 'false'
    setDrafts(d => ({ ...d, [key]: val }))
    setEditing(e => ({ ...e, [key]: true }))
  }

  function cancelEdit(key) {
    setEditing(e => { const n = {...e}; delete n[key]; return n })
    setDrafts(d => { const n = {...d}; delete n[key]; return n })
  }

  async function saveSetting(key) {
    const meta = SETTING_META[key]
    let value = drafts[key]
    if (meta?.type === 'cents') value = String(Math.round(parseFloat(value) * 100) || 0)
    if (meta?.type === 'boolean') value = value === 'true' ? 'true' : 'false'

    setSaving(s => ({ ...s, [key]: true }))
    const { data: { session } } = await supabase.auth.getSession()

    const res = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ key, value }),
    })
    const json = await res.json()
    setSaving(s => { const n = {...s}; delete n[key]; return n })

    if (!res.ok) { showToast(json.error || 'Save failed', 'error'); return }
    showToast(`${SETTING_META[key]?.label || key} updated`)
    setSettings(s => ({ ...s, [key]: value }))
    cancelEdit(key)
  }

  const isSuperAdmin = role === 'super_admin'

  return (
    <AdminLayout>
      <Head><title>Settings — Admin</title></Head>

      {toast && (
        <div style={{ position:'fixed', top:16, left:'50%', transform:'translateX(-50%)', zIndex:9999,
          background: toast.type==='error' ? 'rgba(239,68,68,.95)' : 'rgba(34,197,94,.95)',
          borderRadius:12, padding:'12px 24px', color:'#fff', fontSize:14, fontWeight:600,
          fontFamily:"'Outfit',sans-serif", whiteSpace:'nowrap', boxShadow:'0 8px 32px rgba(0,0,0,.5)' }}>
          {toast.msg}
        </div>
      )}

      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontFamily:"'Cinzel',serif", fontSize:22, fontWeight:700, color:'#fff', margin:0 }}>Platform Settings</h1>
        <p style={{ color:'rgba(255,255,255,.35)', fontSize:13, marginTop:4 }}>
          Global configuration stored in DB — changes take effect immediately
          {!isSuperAdmin && ' · View only (super_admin required to edit)'}
        </p>
      </div>

      {loading ? (
        <div style={{ padding:60, textAlign:'center', color:'rgba(255,255,255,.3)' }}>Loading…</div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:24 }}>
          {SECTIONS.map(section => {
            const keys = Object.entries(SETTING_META).filter(([,m]) => m.section === section).map(([k]) => k)
            return (
              <div key={section}>
                <div style={{ fontSize:10, fontWeight:800, letterSpacing:'.15em', textTransform:'uppercase', color:'rgba(255,255,255,.3)', marginBottom:10 }}>
                  {section}
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {keys.map(key => {
                    const meta = SETTING_META[key]
                    const raw  = settings[key]
                    const isEdit = editing[key]

                    // Display value
                    let display = raw ?? '—'
                    if (meta.type === 'boolean') display = raw === 'true' ? '✅ Enabled' : '❌ Disabled'
                    if (meta.type === 'cents' && raw !== undefined) display = `$${((parseInt(raw)||0)/100).toLocaleString('en-US',{minimumFractionDigits:2})}`

                    return (
                      <div key={key} style={{ background:'rgba(255,255,255,.025)', border:'1px solid rgba(255,255,255,.07)', borderRadius:12, padding:'14px 18px' }}>
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
                          <div>
                            <div style={{ fontSize:14, fontWeight:700, color:'#fff' }}>{meta.label}</div>
                            <div style={{ fontSize:11, color:'rgba(255,255,255,.35)', marginTop:2 }}>{meta.desc}</div>
                          </div>
                          {!isEdit ? (
                            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                              <div style={{ fontSize:14, fontWeight:700, color: meta.type==='boolean' ? (raw==='true'?'#22c55e':'#f87171') : '#fbbf24' }}>
                                {display}
                              </div>
                              {isSuperAdmin && (
                                <button onClick={() => startEdit(key)} style={{ padding:'6px 14px', background:'rgba(251,191,36,.1)', border:'1px solid rgba(251,191,36,.25)', borderRadius:8, color:'#fbbf24', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:"'Outfit',sans-serif" }}>
                                  Edit
                                </button>
                              )}
                            </div>
                          ) : (
                            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                              {meta.type === 'boolean' ? (
                                <div style={{ display:'flex', gap:6 }}>
                                  {['true','false'].map(v => (
                                    <button key={v} onClick={() => setDrafts(d => ({...d,[key]:v}))} style={{
                                      padding:'7px 14px', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:"'Outfit',sans-serif",
                                      background: drafts[key]===v ? (v==='true'?'rgba(34,197,94,.2)':'rgba(239,68,68,.2)') : 'rgba(255,255,255,.05)',
                                      border: drafts[key]===v ? (v==='true'?'1px solid rgba(34,197,94,.5)':'1px solid rgba(239,68,68,.5)') : '1px solid rgba(255,255,255,.1)',
                                      color: drafts[key]===v ? (v==='true'?'#22c55e':'#f87171') : 'rgba(255,255,255,.4)',
                                    }}>{v === 'true' ? 'Enabled' : 'Disabled'}</button>
                                  ))}
                                </div>
                              ) : (
                                <input
                                  type={meta.type === 'cents' ? 'number' : 'text'}
                                  step={meta.type === 'cents' ? '0.01' : undefined}
                                  value={drafts[key] ?? ''}
                                  onChange={e => setDrafts(d => ({...d,[key]:e.target.value}))}
                                  style={{ padding:'8px 12px', background:'rgba(255,255,255,.07)', border:'1px solid rgba(255,255,255,.15)', borderRadius:8, color:'#fff', fontSize:14, fontFamily:"'Outfit',sans-serif", outline:'none', width:160 }}
                                />
                              )}
                              <button onClick={() => saveSetting(key)} disabled={saving[key]} style={{ padding:'8px 14px', background:'rgba(34,197,94,.15)', border:'1px solid rgba(34,197,94,.35)', borderRadius:8, color:'#22c55e', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:"'Outfit',sans-serif" }}>
                                {saving[key] ? '…' : 'Save'}
                              </button>
                              <button onClick={() => cancelEdit(key)} style={{ padding:'8px 10px', background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.1)', borderRadius:8, color:'rgba(255,255,255,.4)', fontSize:12, cursor:'pointer', fontFamily:"'Outfit',sans-serif" }}>
                                ✕
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </AdminLayout>
  )
}
