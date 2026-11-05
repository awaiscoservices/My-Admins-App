import { useEffect, useState } from 'react'
import Head from 'next/head'
import { supabase } from '../../lib/supabase'
import AdminLayout from '../../components/layout/AdminLayout'
import StatusBadge from '../../components/ui/StatusBadge'

function SetupModal({ account, onClose, onSave }) {
  const [form, setForm] = useState({
    game_username: account.game_username || '',
    game_password: '',
    game_id: account.game_id || '',
    admin_notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    if (!form.game_username.trim()) { setError('Username is required'); return }
    if (!form.game_password.trim() && !account.game_username) { setError('Password is required for new accounts'); return }
    setSaving(true)
    setError('')
    const result = await onSave(account.id, form)
    if (result?.error) setError(result.error)
    else onClose()
    setSaving(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={onClose}>
      <div style={{ background: '#0e1a2e', border: '1px solid rgba(251,191,36,.3)', borderRadius: 20, padding: 32, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontFamily: "'Cinzel',serif", fontSize: 18, fontWeight: 700, color: '#fff' }}>
            Setup Game Account
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.5)', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        {/* Player info */}
        <div style={{ background: 'rgba(251,191,36,.08)', border: '1px solid rgba(251,191,36,.2)', borderRadius: 12, padding: '12px 16px', marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{account.profiles?.full_name}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.5)' }}>{account.profiles?.email}</div>
          <div style={{ fontSize: 11, color: '#fbbf24', marginTop: 4 }}>Game: {account.game_panels?.name}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', marginTop: 2 }}>Request: {account.reference_id}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', marginTop: 2 }}>KYC: {account.profiles?.kyc_status}</div>
        </div>

        {/* Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            { key: 'game_username', label: 'Game Username', placeholder: 'Enter username for this player', type: 'text', required: true },
            { key: 'game_password', label: `Game Password${account.game_username ? ' (leave blank to keep existing)' : ''}`, placeholder: 'Enter password', type: 'password', required: !account.game_username },
            { key: 'game_id', label: 'Game ID (optional)', placeholder: 'External ID in game panel', type: 'text', required: false },
            { key: 'admin_notes', label: 'Admin Notes (optional)', placeholder: 'Any internal notes…', type: 'text', required: false },
          ].map(f => (
            <div key={f.key}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.45)', marginBottom: 6 }}>
                {f.label} {f.required && <span style={{ color: '#ef4444' }}>*</span>}
              </label>
              <input
                type={f.type}
                placeholder={f.placeholder}
                value={form[f.key]}
                onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                style={{ width: '100%', padding: '11px 14px', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 10, color: '#fff', fontSize: 13, fontFamily: "'Outfit',sans-serif", outline: 'none', boxSizing: 'border-box' }}
                onFocus={e => e.target.style.borderColor = '#fbbf24'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,.12)'}
              />
            </div>
          ))}
        </div>

        {error && <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 10, color: '#f87171', fontSize: 13 }}>⚠ {error}</div>}

        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '11px', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, color: 'rgba(255,255,255,.5)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: '11px', background: saving ? 'rgba(16,185,129,.4)' : 'linear-gradient(135deg,#10b981,#059669)', border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 800, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: "'Outfit',sans-serif" }}>
            {saving ? '⏳ Saving…' : '✓ Activate Account'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminGameAccounts() {
  const [accounts, setAccounts] = useState([])
  const [filter, setFilter] = useState('pending')
  const [loading, setLoading] = useState(true)
  const [modalAccount, setModalAccount] = useState(null)
  const [toast, setToast] = useState(null)
  const [search, setSearch] = useState('')

  useEffect(() => { loadAccounts() }, [filter])

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  async function loadAccounts() {
    setLoading(true)
    let query = supabase
      .from('game_accounts')
      .select('*, profiles(full_name, email, kyc_status, status), game_panels(name, accent_color)')
      .order('created_at', { ascending: true }) // oldest first for pending
      .limit(50)

    if (filter !== 'all') query = query.eq('status', filter)
    const { data } = await query
    setAccounts(data || [])
    setLoading(false)
  }

  async function handleSaveAccount(accountId, form) {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/admin/game-accounts/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ account_id: accountId, ...form }),
    })
    const data = await res.json()
    if (!res.ok) return { error: data.error }
    showToast('Game account activated!')
    setModalAccount(null)
    loadAccounts()
    return {}
  }

  async function handleSuspend(accountId) {
    const { data: { session } } = await supabase.auth.getSession()
    await fetch('/api/admin/game-accounts/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ account_id: accountId, action: 'suspend' }),
    })
    showToast('Account suspended')
    loadAccounts()
  }

  const filtered = accounts.filter(a => {
    if (!search) return true
    const s = search.toLowerCase()
    return a.profiles?.full_name?.toLowerCase().includes(s) ||
      a.profiles?.email?.toLowerCase().includes(s) ||
      a.reference_id?.toLowerCase().includes(s) ||
      a.game_panels?.name?.toLowerCase().includes(s)
  })

  return (
    <AdminLayout>
      <Head><title>Game Accounts — Admin</title></Head>

      {toast && (
        <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, background: toast.type === 'error' ? 'rgba(239,68,68,.95)' : 'rgba(16,185,129,.95)', borderRadius: 12, padding: '12px 24px', color: '#fff', fontSize: 14, fontWeight: 600, fontFamily: "'Outfit',sans-serif", whiteSpace: 'nowrap', boxShadow: '0 8px 32px rgba(0,0,0,.5)' }}>
          {toast.type === 'error' ? '⚠ ' : '✓ '}{toast.msg}
        </div>
      )}

      {modalAccount && <SetupModal account={modalAccount} onClose={() => setModalAccount(null)} onSave={handleSaveAccount} />}

      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: "'Cinzel',serif", fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 4 }}>Game Accounts</h1>
        <p style={{ color: 'rgba(255,255,255,.35)', fontSize: 13 }}>Setup player game accounts and enter credentials</p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,.04)', padding: 4, borderRadius: 10 }}>
          {['all', 'pending', 'active', 'suspended'].map(s => (
            <button key={s} onClick={() => setFilter(s)} style={{ padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: "'Outfit',sans-serif", fontSize: 12, fontWeight: 700, background: filter === s ? 'rgba(251,191,36,.7)' : 'transparent', color: filter === s ? '#fff' : 'rgba(255,255,255,.4)', textTransform: 'capitalize', transition: 'all .15s' }}>
              {s}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Search player, game, reference…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ padding: '9px 14px', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, color: '#fff', fontSize: 13, fontFamily: "'Outfit',sans-serif", outline: 'none', minWidth: 240 }}
        />
      </div>

      {/* Table */}
      <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,.04)' }}>
                {['Reference', 'Player', 'Game', 'Username', 'KYC', 'Status', 'Requested', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 10, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.35)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: 'rgba(255,255,255,.3)' }}>Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: 'rgba(255,255,255,.3)' }}>
                  {filter === 'pending' ? '✅ No pending game accounts!' : 'No accounts found'}
                </td></tr>
              ) : filtered.map((a, i) => (
                <tr key={a.id} style={{ borderTop: '1px solid rgba(255,255,255,.04)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.02)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#fbbf24', fontFamily: 'monospace' }}>{a.reference_id}</div>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{a.profiles?.full_name}</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,.4)' }}>{a.profiles?.email}</div>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: a.game_panels?.accent_color || '#fbbf24' }} />
                      <span style={{ fontSize: 13, color: '#fff', fontWeight: 600 }}>{a.game_panels?.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 12, color: a.game_username ? '#10b981' : 'rgba(255,255,255,.3)', fontFamily: 'monospace' }}>
                    {a.game_username || '—'}
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 99, textTransform: 'uppercase', background: a.profiles?.kyc_status === 'verified' ? 'rgba(16,185,129,.15)' : 'rgba(245,158,11,.15)', color: a.profiles?.kyc_status === 'verified' ? '#10b981' : '#f59e0b' }}>
                      {a.profiles?.kyc_status?.replace('_', ' ')}
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px' }}><StatusBadge status={a.status} size="xs" /></td>
                  <td style={{ padding: '12px 14px', fontSize: 11, color: 'rgba(255,255,255,.3)', whiteSpace: 'nowrap' }}>
                    {new Date(a.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => setModalAccount(a)} style={{ padding: '6px 12px', background: a.status === 'pending' ? 'linear-gradient(135deg,#fbbf24,#f59e0b)' : 'rgba(251,191,36,.15)', border: '1px solid rgba(251,191,36,.3)', borderRadius: 8, color: a.status === 'pending' ? '#050505' : '#fff', fontSize: 11, fontWeight: 800, cursor: 'pointer', fontFamily: "'Outfit',sans-serif", whiteSpace: 'nowrap' }}>
                        {a.status === 'pending' ? '⚡ Setup' : '✏️ Edit'}
                      </button>
                      {a.status === 'active' && (
                        <button onClick={() => handleSuspend(a.id)} style={{ padding: '6px 10px', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.25)', borderRadius: 8, color: '#f87171', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>
                          Suspend
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  )
}
