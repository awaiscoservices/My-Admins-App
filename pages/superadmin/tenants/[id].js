/**
 * pages/superadmin/tenants/[id].js
 * Tenant detail — view, edit, suspend/activate, impersonate
 */
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import SuperAdminLayout from '../../../components/layout/SuperAdminLayout'
import { supabase } from '../../../lib/supabase'
import Icon from '../../../components/ui/Icon'

/**
 * A fresh access token for every request.
 *
 * These pages used to read the token once on mount and reuse it. Supabase
 * access tokens expire after about an hour, so a page left open long enough
 * started getting "Unauthorized" on every action. getSession() refreshes the
 * token when it is close to expiring, so asking per request avoids that.
 */
async function freshToken() {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token || null
}


const G = '#fbbf24'

export default function TenantDetail() {
  const router = useRouter()
  const { id } = router.query

  const [tenant,  setTenant]  = useState(null)
  const [form,    setForm]    = useState({})
  const [token,   setToken]   = useState(null)
  const [saving,  setSaving]  = useState(false)
  const [msg,     setMsg]     = useState('')
  const [err,     setErr]     = useState('')
  const [loading, setLoading] = useState(true)
  const [tab,     setTab]     = useState('details')

  useEffect(() => {
    // Shared cookie-based client; a local createClient() reads localStorage
    // and never finds the session.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setToken(session.access_token)
    })
  }, [])

  useEffect(() => {
    if (!token || !id) return
    ;(async () => {
      const t = await freshToken()
      fetch(`/api/superadmin/tenants/${id}`, { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.json())
      .then(data => {
        if (data.error) { setErr(data.error); setLoading(false); return }
        setTenant(data.tenant)
        setForm({
          name: data.tenant.name || '',
          plan: data.tenant.plan || 'free',
          owner_email:    data.tenant.owner_email || '',
          brand_name:     data.tenant.brand_name || '',
          primary_domain: data.tenant.primary_domain || '',
        })
        setLoading(false)
      })
    })()
  }, [token, id])

  const save = async () => {
    setSaving(true); setMsg(''); setErr('')
    const r = await fetch(`/api/superadmin/tenants/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await freshToken()}` },
      body: JSON.stringify({ tenant_id: id, ...form }),
    })
    const data = await r.json()
    if (!r.ok) { setErr(data.error); setSaving(false); return }
    setMsg('Saved'); setTenant(t => ({ ...t, ...form })); setSaving(false)
    setTimeout(() => setMsg(''), 3000)
  }

  const suspend = async () => {
    if (!confirm(`Suspend tenant "${tenant.name}"? Their admin access will be blocked.`)) return
    setSaving(true)
    const r = await fetch('/api/superadmin/tenants/suspend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await freshToken()}` },
      body: JSON.stringify({ tenant_id: id, action: tenant.status === 'suspended' ? 'activate' : 'suspend' }),
    })
    const data = await r.json()
    if (!r.ok) { setErr(data.error); setSaving(false); return }
    setTenant(t => ({ ...t, status: data.status }))
    setMsg(`Tenant ${data.status}`); setSaving(false)
    setTimeout(() => setMsg(''), 3000)
  }

  const impersonate = async () => {
    if (!confirm(`Impersonate admin of "${tenant.name}"? This action is logged.`)) return
    const r = await fetch('/api/superadmin/tenants/impersonate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await freshToken()}` },
      body: JSON.stringify({ tenant_id: id }),
    })
    const data = await r.json()
    if (!r.ok) { setErr(data.error); return }
    // Open admin panel in new tab with impersonation token
    const url = `/admin?impersonation_token=${data.token}&tenant=${id}`
    window.open(url, '_blank')
  }

  const statusColor = s => s === 'active' ? '#22c55e' : s === 'suspended' ? '#ef4444' : '#f59e0b'

  if (loading) return <SuperAdminLayout title="Tenant Detail"><div style={{ padding: 32, color: 'rgba(255,255,255,.4)', fontSize: 14 }}>Loading…</div></SuperAdminLayout>
  if (!tenant) return <SuperAdminLayout title="Tenant Detail"><div style={{ padding: 32, color: '#ef4444', fontSize: 14 }}>{err || 'Not found'}</div></SuperAdminLayout>

  return (
    <SuperAdminLayout title={`Tenant: ${tenant.name}`}>
      <div>

        {/* Header row */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
              <h2 style={{ color: '#fff', margin: 0, fontSize: 20 }}>{tenant.name}</h2>
              <span style={{ background: `${statusColor(tenant.status)}18`, color: statusColor(tenant.status), padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                {tenant.status}
              </span>
            </div>
            <div style={{ color: 'rgba(255,255,255,.35)', fontSize: 13 }}>
              ID: <code style={{ color: 'rgba(255,255,255,.5)', fontSize: 11 }}>{tenant.id}</code>
              {' · '}Created {new Date(tenant.created_at).toLocaleDateString()}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={impersonate} style={{ ...outlineBtn, color: G, borderColor: G }}>
              <Icon name="user" size={15} style={{ verticalAlign: '-2px', marginRight: 5 }} /> Impersonate
            </button>
            <button onClick={suspend} disabled={saving} style={{
              ...outlineBtn,
              color: tenant.status === 'suspended' ? '#22c55e' : '#ef4444',
              borderColor: tenant.status === 'suspended' ? '#22c55e' : '#ef4444',
            }}>
              {tenant.status === 'suspended' ? 'Activate' : 'Suspend'}
            </button>
          </div>
        </div>

        {/* Flash messages */}
        {msg && <div style={{ background: '#22c55e18', border: '1px solid #22c55e30', color: '#22c55e', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>{msg}</div>}
        {err && <div style={{ background: '#ef444418', border: '1px solid #ef444430', color: '#ef4444', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>{err}</div>}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid rgba(255,255,255,.07)', paddingBottom: 0 }}>
          {['details', 'domains', 'audit'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: '10px 16px',
              color: tab === t ? G : 'rgba(255,255,255,.45)', fontWeight: tab === t ? 600 : 400,
              fontSize: 13, textTransform: 'capitalize', fontFamily: "'Outfit',sans-serif",
              borderBottom: tab === t ? `2px solid ${G}` : '2px solid transparent',
              marginBottom: -1,
            }}>{t}</button>
          ))}
        </div>

        {/* Details tab */}
        {tab === 'details' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: '0 24px', alignItems: 'start' }}>
            {[
              { key: 'name',          label: 'Tenant Name' },
              { key: 'owner_email',    label: 'Owner Email' },
              { key: 'brand_name',     label: 'Brand Name' },
              { key: 'primary_domain', label: 'Primary Domain' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 16 }}>
                <label style={labelStyle}>{f.label}</label>
                <input value={form[f.key] || ''} onChange={e => setForm(x => ({ ...x, [f.key]: e.target.value }))}
                  style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
              </div>
            ))}
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Plan</label>
              <select value={form.plan || 'free'} onChange={e => setForm(x => ({ ...x, plan: e.target.value }))}
                style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}>
                <option value="free">Free</option>
                <option value="starter">Starter</option>
                <option value="pro">Pro</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
            <button onClick={save} disabled={saving} style={{ ...goldBtn, opacity: saving ? .6 : 1, gridColumn: '1 / -1', justifySelf: 'start' }}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        )}

        {/* Domains tab */}
        {tab === 'domains' && <DomainsTab tenantId={id} token={token} />}

        {/* Audit tab */}
        {tab === 'audit' && <AuditTab tenantId={id} token={token} />}

      </div>
    </SuperAdminLayout>
  )
}

function DomainsTab({ tenantId, token }) {
  const [domains, setDomains] = useState([])
  const [loading, setLoading] = useState(true)
  const [newDomain, setNewDomain] = useState('')
  const [adding, setAdding] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!token) return
    ;(async () => {
      const t = await freshToken()
      await fetch(`/api/superadmin/tenants/domains?tenant_id=${tenantId}`, { headers: { Authorization: `Bearer ${t}` } })
        .then(r => r.json()).then(d => { setDomains(d.domains || []); setLoading(false) })
    })()
  }, [token, tenantId])

  const addDomain = async () => {
    if (!newDomain.trim()) return
    setAdding(true); setErr('')
    const r = await fetch('/api/superadmin/tenants/domains', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await freshToken()}` },
      body: JSON.stringify({ tenant_id: tenantId, domain: newDomain.trim() }),
    })
    const data = await r.json()
    if (!r.ok) { setErr(data.error); setAdding(false); return }
    setDomains(d => [...d, data.domain])
    setNewDomain(''); setAdding(false)
  }

  if (loading) return <div style={{ color: 'rgba(255,255,255,.4)', fontSize: 13 }}>Loading…</div>

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: '0 24px', alignItems: 'start' }}>
      {err && <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{err}</div>}
      <div style={{ marginBottom: 20 }}>
        {domains.length === 0 && <div style={{ color: 'rgba(255,255,255,.3)', fontSize: 13 }}>No custom domains configured.</div>}
        {domains.map(d => (
          <div key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
            <code style={{ color: '#fff', fontSize: 13 }}>{d.domain}</code>
            <span style={{ fontSize: 11, color: d.is_verified ? '#22c55e' : '#f59e0b' }}>{d.is_verified ? 'Verified' : 'Pending'}</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={newDomain} onChange={e => setNewDomain(e.target.value)} placeholder="casino.example.com"
          style={{ ...inputStyle, flex: 1 }} onKeyDown={e => e.key === 'Enter' && addDomain()} />
        <button onClick={addDomain} disabled={adding} style={{ ...goldBtn, opacity: adding ? .6 : 1 }}>Add</button>
      </div>
    </div>
  )
}

function AuditTab({ tenantId, token }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) return
    ;(async () => {
      const t = await freshToken()
      await fetch(`/api/superadmin/audit?tenant_id=${tenantId}&limit=50`, { headers: { Authorization: `Bearer ${t}` } })
        .then(r => r.json()).then(d => { setLogs(d.logs || []); setLoading(false) })
    })()
  }, [token, tenantId])

  if (loading) return <div style={{ color: 'rgba(255,255,255,.4)', fontSize: 13 }}>Loading…</div>

  return (
    <div>
      {logs.length === 0 && <div style={{ color: 'rgba(255,255,255,.3)', fontSize: 13 }}>No audit logs yet.</div>}
      {logs.map(l => (
        <div key={l.id} style={{ display: 'flex', gap: 16, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,.04)', fontSize: 13 }}>
          <div style={{ color: 'rgba(255,255,255,.3)', whiteSpace: 'nowrap', fontSize: 11 }}>{new Date(l.created_at).toLocaleString()}</div>
          <div>
            <span style={{ color: G, fontWeight: 600 }}>{l.action}</span>
            {' — '}
            <span style={{ color: 'rgba(255,255,255,.6)' }}>{l.actor_email || l.actor_id}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

const inputStyle  = { background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, padding: '9px 12px', color: '#fff', fontSize: 13, outline: 'none', fontFamily: "'Outfit',sans-serif" }
const goldBtn     = { background: 'linear-gradient(135deg,#fbbf24,#f59e0b)', color: '#000', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }
const outlineBtn  = { background: 'transparent', border: '1px solid', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }
const labelStyle  = { color: 'rgba(255,255,255,.5)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 6 }
