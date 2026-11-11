/**
 * pages/superadmin/admins.js — Super Admins
 *
 * Who can reach this portal, and how to add another.
 *
 * Until this page there was exactly one super admin and no way to make a
 * second: staff invites refuse the role on purpose. Losing that one login
 * meant losing the platform portal with no way back in.
 */
import { useEffect, useState, useCallback } from 'react'
import Head from 'next/head'
import SuperAdminLayout from '../../components/layout/SuperAdminLayout'
import { supabase } from '../../lib/supabase'

const G    = '#fbbf24'
const DIM  = 'rgba(255,255,255,.45)'
const DIM2 = 'rgba(255,255,255,.3)'
const CARD = 'rgba(255,255,255,.03)'
const BDR  = '1px solid rgba(255,255,255,.08)'

async function freshToken() {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token || null
}

const input = {
  width: '100%', padding: '10px 13px', background: 'rgba(255,255,255,.06)',
  border: '1px solid rgba(255,255,255,.12)', borderRadius: 10, color: '#fff',
  fontSize: 13, fontFamily: "'Outfit',sans-serif", outline: 'none', boxSizing: 'border-box',
}
const label = {
  display: 'block', fontSize: 10, fontWeight: 800, letterSpacing: '.09em',
  textTransform: 'uppercase', color: DIM, marginBottom: 6,
}

export default function SuperAdmins() {
  const [admins, setAdmins] = useState([])
  const [you, setYou]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [form, setForm]     = useState({ username: '', full_name: '', password: '' })
  const [toast, setToast]   = useState(null)

  function showToast(msg, type = 'success') { setToast({ msg, type }); setTimeout(() => setToast(null), 6000) }

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/superadmin/admins', { headers: { Authorization: `Bearer ${await freshToken()}` } })
    const d = await res.json()
    if (!res.ok) showToast(d.error || 'Could not load super admins', 'error')
    setAdmins(d.admins || [])
    setYou(d.you || null)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function create(e) {
    e.preventDefault()
    setSaving(true)
    const res = await fetch('/api/superadmin/admins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await freshToken()}` },
      body: JSON.stringify(form),
    })
    const d = await res.json()
    setSaving(false)
    if (!res.ok) { showToast(d.error || 'Could not create', 'error'); return }
    showToast(`Super admin "${d.admin.username || d.admin.email}" created. Sign in with that username and the password you just set.`)
    setForm({ username: '', full_name: '', password: '' })
    load()
  }

  return (
    <SuperAdminLayout>
      <Head><title>Super Admins — Super Admin</title></Head>

      {toast && (
        <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, maxWidth: '90vw',
          background: toast.type === 'error' ? 'rgba(239,68,68,.95)' : 'rgba(34,197,94,.95)', borderRadius: 12,
          padding: '12px 24px', color: '#fff', fontSize: 14, fontWeight: 600, fontFamily: "'Outfit',sans-serif",
          boxShadow: '0 8px 32px rgba(0,0,0,.5)' }}>{toast.msg}</div>
      )}

      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: "'Cinzel',serif", fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 4 }}>Super Admins</h1>
        <p style={{ color: DIM2, fontSize: 13, margin: 0 }}>
          Accounts that can reach this portal and every casino on the platform.
        </p>
      </div>

      {admins.length === 1 && !loading && (
        <div style={{ marginBottom: 18, padding: '14px 18px', background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.3)', borderRadius: 12, fontSize: 13, color: '#f59e0b', lineHeight: 1.6 }}>
          There is only one super admin. If you lose this login, nobody can reach this portal —
          staff invites cannot create one. Add a second account you keep somewhere safe.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 340px', gap: 18, alignItems: 'start' }} className="sa-grid">
        {/* Existing */}
        <div style={{ background: CARD, border: BDR, borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: BDR, fontSize: 13, fontWeight: 700, color: '#fff' }}>
            {loading ? 'Loading…' : `${admins.length} super admin${admins.length === 1 ? '' : 's'}`}
          </div>
          {!loading && admins.map(a => (
            <div key={a.id} style={{ padding: '14px 18px', borderTop: '1px solid rgba(255,255,255,.04)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: '#fff' }}>
                  {a.full_name || '—'}
                  {a.id === you && <span style={{ marginLeft: 8, fontSize: 9.5, fontWeight: 800, color: G, letterSpacing: '.08em' }}>YOU</span>}
                </div>
                <div style={{ fontSize: 11.5, color: DIM2, wordBreak: 'break-all', fontFamily: 'monospace', marginTop: 2 }}>
                  {a.username ? `@${a.username}` : a.email}
                </div>
              </div>
              <span style={{ fontSize: 9.5, fontWeight: 800, padding: '3px 9px', borderRadius: 99, whiteSpace: 'nowrap',
                background: a.status === 'active' ? 'rgba(34,197,94,.15)' : 'rgba(255,255,255,.08)',
                color: a.status === 'active' ? '#22c55e' : DIM }}>
                {(a.status || 'active').toUpperCase()}
              </span>
            </div>
          ))}
        </div>

        {/* Add */}
        <form onSubmit={create} style={{ background: CARD, border: BDR, borderRadius: 14, padding: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 4 }}>Add a super admin</div>
          <div style={{ fontSize: 11.5, color: DIM2, marginBottom: 14, lineHeight: 1.6 }}>
            A username is enough — no email needed. The account can see and change every casino,
            so keep the password somewhere safe.
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={label}>Username</label>
            <input style={input} value={form.username} autoComplete="off"
              onChange={e => setForm(p => ({ ...p, username: e.target.value }))} placeholder="e.g. backup.admin" />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={label}>Full name (optional)</label>
            <input style={input} value={form.full_name}
              onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} placeholder="e.g. Backup Admin" />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={label}>Password</label>
            <input style={input} type="password" value={form.password} autoComplete="new-password"
              onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder="At least 12 characters" />
          </div>

          <button type="submit" disabled={saving}
            style={{ width: '100%', padding: '11px', background: 'linear-gradient(135deg,#fbbf24,#f59e0b)', border: 'none', borderRadius: 10, color: '#050505', fontSize: 13, fontWeight: 800, cursor: saving ? 'default' : 'pointer', fontFamily: "'Outfit',sans-serif", opacity: saving ? .7 : 1 }}>
            {saving ? 'Creating…' : 'Create super admin'}
          </button>
        </form>
      </div>

      <style>{`
        @media (max-width: 900px) { .sa-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </SuperAdminLayout>
  )
}
