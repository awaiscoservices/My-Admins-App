import { useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'
import AdminLayout from '../../components/layout/AdminLayout'
import MoneyDisplay from '../../components/ui/MoneyDisplay'
import StatusBadge from '../../components/ui/StatusBadge'

export default function AdminPlayers() {
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [kycFilter, setKycFilter] = useState('all')
  const [toast, setToast] = useState(null)
  const [actionLoading, setActionLoading] = useState(null)

  useEffect(() => { loadPlayers() }, [statusFilter, kycFilter])

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  async function loadPlayers() {
    setLoading(true)
    let query = supabase
      .from('profiles')
      .select('*, wallets(cash_balance_cents, bonus_balance_cents, total_deposited_cents)')
      .eq('role', 'player')
      .order('created_at', { ascending: false })
      .limit(100)

    if (statusFilter !== 'all') query = query.eq('status', statusFilter)
    if (kycFilter !== 'all') query = query.eq('kyc_status', kycFilter)

    const { data } = await query
    setPlayers(data || [])
    setLoading(false)
  }

  async function handleStatusChange(playerId, newStatus) {
    const reason = newStatus !== 'active' ? prompt(`Reason for ${newStatus}:`) : null
    if (newStatus !== 'active' && !reason) return

    setActionLoading(playerId)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/admin/players/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ player_id: playerId, status: newStatus, reason }),
    })
    const data = await res.json()
    if (res.ok) {
      showToast(`Player ${newStatus} successfully`)
      loadPlayers()
    } else {
      showToast(data.error || 'Action failed', 'error')
    }
    setActionLoading(null)
  }

  const filtered = players.filter(p => {
    if (!search) return true
    const s = search.toLowerCase()
    return p.full_name?.toLowerCase().includes(s) ||
      p.email?.toLowerCase().includes(s) ||
      p.referral_code?.toLowerCase().includes(s)
  })

  const levelColors = { 1: '#6b7280', 2: '#10b981', 3: '#3b82f6', 4: '#fbbf24', 5: '#f59e0b', 6: '#ef4444' }

  return (
    <AdminLayout>
      <Head><title>Players — Admin</title></Head>

      {toast && (
        <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, background: toast.type === 'error' ? 'rgba(239,68,68,.95)' : 'rgba(16,185,129,.95)', borderRadius: 12, padding: '12px 24px', color: '#fff', fontSize: 14, fontWeight: 600, fontFamily: "'Outfit',sans-serif", whiteSpace: 'nowrap', boxShadow: '0 8px 32px rgba(0,0,0,.5)' }}>
          {toast.type === 'error' ? '⚠ ' : '✓ '}{toast.msg}
        </div>
      )}

      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: "'Cinzel',serif", fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 4 }}>Players</h1>
        <p style={{ color: 'rgba(255,255,255,.35)', fontSize: 13 }}>Manage all registered players</p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Search by name, email, referral code…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ padding: '9px 14px', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, color: '#fff', fontSize: 13, fontFamily: "'Outfit',sans-serif", outline: 'none', minWidth: 260 }}
        />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          style={{ padding: '9px 14px', background: '#0e1a2e', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, color: '#fff', fontSize: 13, fontFamily: "'Outfit',sans-serif", outline: 'none' }}>
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="banned">Banned</option>
        </select>
        <select value={kycFilter} onChange={e => setKycFilter(e.target.value)}
          style={{ padding: '9px 14px', background: '#0e1a2e', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, color: '#fff', fontSize: 13, fontFamily: "'Outfit',sans-serif", outline: 'none' }}>
          <option value="all">All KYC</option>
          <option value="not_started">Not Started</option>
          <option value="pending">Pending</option>
          <option value="verified">Verified</option>
          <option value="rejected">Rejected</option>
        </select>
        <div style={{ marginLeft: 'auto', fontSize: 12, color: 'rgba(255,255,255,.35)', fontWeight: 600 }}>
          {filtered.length} players
        </div>
      </div>

      {/* Table */}
      <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,.04)' }}>
                {['Player', 'Cash Balance', 'Total Deposited', 'Level', 'KYC', 'Status', 'Joined', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 10, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.35)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: 'rgba(255,255,255,.3)' }}>Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: 'rgba(255,255,255,.3)' }}>No players found</td></tr>
              ) : filtered.map(p => (
                <tr key={p.id} style={{ borderTop: '1px solid rgba(255,255,255,.04)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.02)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '12px 14px' }}>
                    <Link href={`/admin/players/${p.id}`} style={{ textDecoration: 'none' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{p.full_name || '—'}</div>
                      <div style={{ fontSize: 11, color: '#fbbf24' }}>{p.email}</div>
                      {p.is_flagged && <div style={{ fontSize: 10, color: '#ef4444', fontWeight: 700, marginTop: 2 }}>⚠️ Flagged</div>}
                    </Link>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <MoneyDisplay cents={p.wallets?.cash_balance_cents || 0} size="sm" color="#10b981" />
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <MoneyDisplay cents={p.wallets?.total_deposited_cents || 0} size="sm" color="rgba(255,255,255,.6)" />
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: levelColors[p.player_level_id || 1] }}>
                      Lv.{p.player_level_id || 1}
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <StatusBadge status={p.kyc_status || 'not_started'} size="xs" />
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <StatusBadge status={p.status} size="xs" />
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 11, color: 'rgba(255,255,255,.3)', whiteSpace: 'nowrap' }}>
                    {new Date(p.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                      <Link href={`/admin/players/${p.id}`} style={{ padding: '5px 10px', background: 'rgba(251,191,36,.15)', border: '1px solid rgba(251,191,36,.3)', borderRadius: 7, color: '#fbbf24', fontSize: 11, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                        View
                      </Link>
                      {p.status === 'active' ? (
                        <button onClick={() => handleStatusChange(p.id, 'suspended')} disabled={actionLoading === p.id}
                          style={{ padding: '5px 10px', background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.3)', borderRadius: 7, color: '#f59e0b', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: "'Outfit',sans-serif", whiteSpace: 'nowrap' }}>
                          Suspend
                        </button>
                      ) : (
                        <button onClick={() => handleStatusChange(p.id, 'active')} disabled={actionLoading === p.id}
                          style={{ padding: '5px 10px', background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.3)', borderRadius: 7, color: '#10b981', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: "'Outfit',sans-serif', whiteSpace: 'nowrap'" }}>
                          Reactivate
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
