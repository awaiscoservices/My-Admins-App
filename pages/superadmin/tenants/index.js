/**
 * pages/superadmin/tenants/index.js
 * Tenant list — paginated, searchable, filterable by status
 */
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/router'
import SuperAdminLayout from '../../../components/layout/SuperAdminLayout'
import { supabase } from '../../../lib/supabase'

const G = '#fbbf24'
const PER_PAGE = 20

const statusColor = s => ({
  active:    { bg: '#22c55e18', text: '#22c55e' },
  suspended: { bg: '#ef444418', text: '#ef4444' },
  pending:   { bg: '#f59e0b18', text: '#f59e0b' },
}[s] || { bg: 'rgba(255,255,255,.08)', text: 'rgba(255,255,255,.5)' })

export default function TenantsPage() {
  const router = useRouter()
  const [tenants, setTenants]   = useState([])
  const [total,   setTotal]     = useState(0)
  const [page,    setPage]      = useState(1)
  const [search,  setSearch]    = useState('')
  const [status,  setStatus]    = useState('')
  const [loading, setLoading]   = useState(true)
  const [token,   setToken]     = useState(null)
  const [showCreate, setShowCreate] = useState(false)

  // Get token once
  useEffect(() => {
    // Shared cookie-based client; a local createClient() reads localStorage
    // and never finds the session.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setToken(session.access_token)
    })
  }, [])

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    const params = new URLSearchParams({ page, limit: PER_PAGE })
    if (search) params.set('search', search)
    if (status) params.set('status', status)
    const r = await fetch(`/api/superadmin/tenants/list?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await r.json()
    setTenants(data.tenants || [])
    setTotal(data.total || 0)
    setLoading(false)
  }, [token, page, search, status])

  useEffect(() => { load() }, [load])

  const totalPages = Math.ceil(total / PER_PAGE)

  return (
    <SuperAdminLayout title="Tenants">
      <div>

        {/* Controls */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search by name or slug…"
            style={inputStyle}
          />
          <select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }} style={{ ...inputStyle, width: 160 }}>
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="pending">Pending</option>
          </select>
          <button onClick={() => setShowCreate(true)} style={btnStyle}>
            + New Tenant
          </button>
        </div>

        {/* Table */}
        <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,.07)' }}>
                {['Name', 'Slug', 'Plan', 'Status', 'Created', ''].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: 'rgba(255,255,255,.4)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: 'rgba(255,255,255,.3)' }}>Loading…</td></tr>
              )}
              {!loading && tenants.length === 0 && (
                <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: 'rgba(255,255,255,.3)' }}>No tenants found</td></tr>
              )}
              {tenants.map((t, i) => {
                const sc = statusColor(t.status)
                return (
                  <tr key={t.id} style={{ borderBottom: i < tenants.length - 1 ? '1px solid rgba(255,255,255,.04)' : 'none', transition: 'background .1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.02)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '14px 16px', color: '#fff', fontWeight: 500 }}>{t.name}</td>
                    <td style={{ padding: '14px 16px', color: 'rgba(255,255,255,.5)', fontFamily: 'monospace' }}>{t.slug}</td>
                    <td style={{ padding: '14px 16px', color: 'rgba(255,255,255,.6)' }}>{t.plan || 'free'}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ background: sc.bg, color: sc.text, padding: '3px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                        {t.status}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', color: 'rgba(255,255,255,.4)', fontSize: 12 }}>
                      {new Date(t.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <a href={`/superadmin/tenants/${t.id}`} style={{ color: G, textDecoration: 'none', fontSize: 12 }}>Manage →</a>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'center', alignItems: 'center' }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={pageBtnStyle(page === 1)}>← Prev</button>
            <span style={{ color: 'rgba(255,255,255,.4)', fontSize: 13 }}>Page {page} of {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={pageBtnStyle(page === totalPages)}>Next →</button>
          </div>
        )}

        {/* Create Tenant Modal */}
        {showCreate && <CreateTenantModal token={token} onClose={() => setShowCreate(false)} onCreated={load} />}
      </div>
    </SuperAdminLayout>
  )
}

function CreateTenantModal({ token, onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', slug: '', plan: 'free', admin_email: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const submit = async () => {
    if (!form.name.trim() || !form.slug.trim()) { setError('Name and slug are required'); return }
    setSaving(true); setError('')
    const r = await fetch('/api/superadmin/tenants/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(form),
    })
    const data = await r.json()
    if (!r.ok) { setError(data.error); setSaving(false); return }

      // The casino is saved either way; only the invite can part-fail. Say so
      // rather than closing on a quiet half-success.
      if (data.admin_invite && data.admin_invite.ok === false) {
        setError(data.admin_invite.error)
        setSaving(false)
        onCreated()
        return
      }
    onCreated()
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#0d1420', border: '1px solid rgba(255,255,255,.1)', borderRadius: 16, padding: 32, width: 420, maxWidth: '90vw' }}>
        <h3 style={{ color: '#fff', margin: '0 0 20px', fontFamily: "'Cinzel',serif" }}>Create New Tenant</h3>
        {error && <div style={{ color: '#ef4444', marginBottom: 12, fontSize: 13 }}>{error}</div>}
        {[
          { key: 'name',        label: 'Tenant Name',  placeholder: 'Acme Casino' },
          { key: 'slug',        label: 'Slug',         placeholder: 'acme-casino' },
          { key: 'admin_email', label: 'Admin Email (optional)',  placeholder: 'admin@acme.com' },
        ].map(f => (
          <div key={f.key} style={{ marginBottom: 14 }}>
            <label style={{ color: 'rgba(255,255,255,.5)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 6 }}>{f.label}</label>
            <input value={form[f.key]} onChange={e => setForm(x => ({ ...x, [f.key]: e.target.value }))}
              placeholder={f.placeholder} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
          </div>
        ))}
        <div style={{ marginBottom: 20 }}>
          <label style={{ color: 'rgba(255,255,255,.5)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 6 }}>Plan</label>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', margin: '-6px 0 16px', lineHeight: 1.5 }}>
            An invite email is sent to this address. They set their own password
            from the link and become this casino's admin. Leave it blank to
            invite someone later from Staff &amp; Roles.
          </div>

          <select value={form.plan} onChange={e => setForm(x => ({ ...x, plan: e.target.value }))} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}>
            <option value="free">Free</option>
            <option value="starter">Starter</option>
            <option value="pro">Pro</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ ...btnStyle, background: 'rgba(255,255,255,.06)', color: 'rgba(255,255,255,.6)', flex: 1 }}>Cancel</button>
          <button onClick={submit} disabled={saving} style={{ ...btnStyle, flex: 1, opacity: saving ? .6 : 1 }}>
            {saving ? 'Creating…' : 'Create Tenant'}
          </button>
        </div>
      </div>
    </div>
  )
}

const inputStyle = {
  background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.1)',
  borderRadius: 8, padding: '9px 12px', color: '#fff', fontSize: 13, outline: 'none',
  fontFamily: "'Outfit',sans-serif",
}
const btnStyle = {
  background: 'linear-gradient(135deg,#fbbf24,#f59e0b)', color: '#000',
  border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 700,
  cursor: 'pointer', fontFamily: "'Outfit',sans-serif",
}
const pageBtnStyle = disabled => ({
  ...btnStyle,
  background: disabled ? 'rgba(255,255,255,.05)' : 'rgba(251,191,36,.12)',
  color: disabled ? 'rgba(255,255,255,.2)' : G,
  cursor: disabled ? 'default' : 'pointer',
  opacity: 1,
})
