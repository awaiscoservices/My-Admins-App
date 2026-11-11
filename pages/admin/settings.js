import { useEffect, useState } from 'react'
import Head from 'next/head'
import { supabase } from '../../lib/supabase'
import AdminLayout from '../../components/layout/AdminLayout'

const fmt = c => c != null ? '$' + (c / 100).toLocaleString('en-US', { minimumFractionDigits: 2 }) : ''

export default function AdminSettings() {
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)
  const [activeTab, setActiveTab] = useState('general')

  useEffect(() => { load() }, [])

  function showToast(msg, type = 'success') { setToast({ msg, type }); setTimeout(() => setToast(null), 4000) }

  async function load() {
    setLoading(true)
    // platform_settings is key/value, one row per setting per casino — not a
    // single row of columns. Reading it straight from the browser also skipped
    // the tenant filter, so this now goes through the API and is flattened
    // into the shape the fields below expect.
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setLoading(false); return }

      const res = await fetch('/api/admin/settings/get', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const d = await res.json()
      if (res.ok) {
        const flat = {}
        for (const row of d.settings || []) {
          let v = row.value
          if (v === 'true') v = true
          else if (v === 'false') v = false
          else if (v !== '' && v !== null && !isNaN(v)) v = Number(v)
          flat[row.key] = v
        }
        setSettings(flat)
      }
    } catch { /* leave the form empty */ }
    setLoading(false)
  }

  function update(key, val) {
    setSettings(p => ({ ...p, [key]: val }))
  }

  async function save() {
    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/admin/settings/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      // The API takes a list of key/value pairs, not a flat object.
      body: JSON.stringify({
        updates: Object.entries(settings || {}).map(([key, value]) => ({ key, value: String(value) })),
      }),
    })
    const d = await res.json()
    if (!res.ok) { showToast(d.error || 'Failed to save', 'error') }
    else { showToast('Settings saved') }
    setSaving(false)
  }

  // 'limits' and 'kyc' are gone: deposit limits live on Payment Methods,
  // withdrawal and redeem limits on Player Levels (per level), and whether a
  // level needs KYC is set on the level itself. Keeping global copies here
  // meant two places to change one rule, and the copy here changed nothing.
  const TABS = ['general', 'security', 'maintenance']

  const inputStyle = { width: '100%', padding: '11px 14px', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 10, color: '#fff', fontSize: 13, fontFamily: "'Outfit',sans-serif", outline: 'none', boxSizing: 'border-box' }
  const labelStyle = { display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.45)', marginBottom: 6 }
  const sectionStyle = { background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 16, padding: 24, marginBottom: 20 }
  const sectionTitle = { fontFamily: "'Cinzel',serif", fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,.7)', marginBottom: 20, paddingBottom: 12, borderBottom: '1px solid rgba(255,255,255,.07)' }

  const Toggle = ({ field, label, desc }) => (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 2 }}>{label}</div>
        {desc && <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)' }}>{desc}</div>}
      </div>
      <button onClick={() => update(field, !settings?.[field])} style={{ flexShrink: 0, marginLeft: 20, width: 44, height: 24, borderRadius: 99, border: 'none', cursor: 'pointer', background: settings?.[field] ? '#22c55e' : 'rgba(255,255,255,.15)', position: 'relative', transition: 'background .2s' }}>
        <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: settings?.[field] ? 23 : 3, transition: 'left .2s' }} />
      </button>
    </div>
  )

  return (
    <AdminLayout>
      <Head><title>Settings — Admin</title></Head>
      {toast && <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, background: toast.type === 'error' ? 'rgba(239,68,68,.95)' : 'rgba(34,197,94,.95)', borderRadius: 12, padding: '12px 24px', color: '#fff', fontSize: 14, fontWeight: 600, fontFamily: "'Outfit',sans-serif", whiteSpace: 'nowrap', boxShadow: '0 8px 32px rgba(0,0,0,.5)' }}>{toast.msg}</div>}

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: "'Cinzel',serif", fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 4 }}>Platform Settings</h1>
          <p style={{ color: 'rgba(255,255,255,.35)', fontSize: 13 }}>Configure global platform behavior and limits</p>
        </div>
        <button onClick={save} disabled={saving || loading} style={{ padding: '10px 24px', background: 'linear-gradient(135deg,#fbbf24,#f59e0b)', border: 'none', borderRadius: 10, color: '#050505', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>{saving ? 'Saving…' : 'Save Settings'}</button>
      </div>

      <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,.04)', padding: 4, borderRadius: 10, marginBottom: 24, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: "'Outfit',sans-serif", fontSize: 12, fontWeight: 700, background: activeTab === t ? 'rgba(251,191,36,.7)' : 'transparent', color: activeTab === t ? '#fff' : 'rgba(255,255,255,.4)', textTransform: 'capitalize', transition: 'all .15s' }}>{t}</button>
        ))}
      </div>

      {loading ? <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,.3)' }}>Loading settings…</div> : (
        <>
          {activeTab === 'general' && (
            <>
              <div style={sectionStyle}>
                <div style={sectionTitle}>Platform Info</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div style={{ gridColumn: '1/-1' }}>
                    <label style={labelStyle}>Platform Name</label>
                    <input value={settings?.platform_name || ''} onChange={e => update('platform_name', e.target.value)} placeholder="Casinoze Room" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Support Email</label>
                    <input type="email" value={settings?.support_email || ''} onChange={e => update('support_email', e.target.value)} placeholder="support@casinoze.com" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Currency</label>
                    <select value={settings?.currency || 'USD'} onChange={e => update('currency', e.target.value)} style={inputStyle}>
                      {['USD', 'EUR', 'GBP', 'CAD', 'AUD'].map(c => <option key={c} value={c} style={{ background: '#0e1a2e' }}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Timezone</label>
                    <input value={settings?.timezone || 'UTC'} onChange={e => update('timezone', e.target.value)} placeholder="UTC" style={inputStyle} />
                  </div>
                </div>
              </div>
              <div style={sectionStyle}>
                <div style={sectionTitle}>Feature Flags</div>
                <Toggle field="registrations_enabled" label="New Registrations" desc="Allow new players to create accounts" />
                <Toggle field="deposits_enabled" label="Deposits" desc="Allow players to make deposits" />
                <Toggle field="withdrawals_enabled" label="Withdrawals" desc="Allow players to request withdrawals" />
              </div>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', margin: '0 0 20px', lineHeight: 1.6 }}>
                Deposit bonuses and referral rewards are set on <strong style={{ color: '#fbbf24' }}>Player Bonuses</strong>,
                deposit limits on <strong style={{ color: '#fbbf24' }}>Payment Methods</strong>, and withdrawal
                and redeem limits per level on <strong style={{ color: '#fbbf24' }}>Player Levels</strong>.
              </p>
            </>
          )}

          {activeTab === 'security' && (
            <div style={sectionStyle}>
              <div style={sectionTitle}>Security Settings</div>
              <Toggle field="two_factor_required" label="Require 2FA for Staff" desc="All staff members must enable two-factor authentication" />
              <Toggle field="session_timeout_enabled" label="Session Timeout" desc="Automatically log out inactive users" />
              <Toggle field="ip_whitelist_enabled" label="IP Whitelist" desc="Restrict admin access to whitelisted IPs only" />
              <div style={{ marginTop: 16 }}>
                <label style={labelStyle}>Session Timeout (minutes)</label>
                <input type="number" min="5" value={settings?.session_timeout_minutes || 60} onChange={e => update('session_timeout_minutes', parseInt(e.target.value))} style={inputStyle} />
              </div>
              <div style={{ marginTop: 16 }}>
                <label style={labelStyle}>Max Failed Login Attempts</label>
                <input type="number" min="1" max="20" value={settings?.max_login_attempts || 5} onChange={e => update('max_login_attempts', parseInt(e.target.value))} style={inputStyle} />
              </div>
            </div>
          )}

          {activeTab === 'maintenance' && (
            <div style={sectionStyle}>
              <div style={sectionTitle}>Maintenance Mode</div>
              <Toggle field="maintenance_mode" label="Maintenance Mode" desc="Blocks all player access and shows a maintenance page" />
              <div style={{ marginTop: 16 }}>
                <label style={labelStyle}>Maintenance Message</label>
                <textarea value={settings?.maintenance_message || ''} onChange={e => update('maintenance_message', e.target.value)} placeholder="We're currently performing scheduled maintenance. We'll be back shortly." rows={4}
                  style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
              <div style={{ marginTop: 16 }}>
                <label style={labelStyle}>Expected Downtime End</label>
                <input type="datetime-local" value={settings?.maintenance_end_at ? settings.maintenance_end_at.slice(0, 16) : ''} onChange={e => update('maintenance_end_at', e.target.value)}
                  style={inputStyle} />
              </div>
              {settings?.maintenance_mode && (
                <div style={{ marginTop: 16, padding: '14px 16px', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#f87171' }}>⚠ Maintenance mode is ACTIVE</div>
                  <div style={{ fontSize: 12, color: 'rgba(239,68,68,.7)', marginTop: 4 }}>All player-facing pages are currently blocked. Disable to restore access.</div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </AdminLayout>
  )
}
