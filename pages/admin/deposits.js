import { useEffect, useState } from 'react'
import Head from 'next/head'
import { supabase } from '../../lib/supabase'
import AdminLayout from '../../components/layout/AdminLayout'
import MoneyDisplay from '../../components/ui/MoneyDisplay'
import StatusBadge from '../../components/ui/StatusBadge'

const STATUS_FILTERS = ['all', 'pending', 'approved', 'rejected', 'under_review']

function DepositRow({ deposit, onAction }) {
  const [expanded, setExpanded] = useState(false)
  const [actionLoading, setActionLoading] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectInput, setShowRejectInput] = useState(false)

  async function handleAction(action) {
    if (action === 'rejected' && !rejectReason.trim()) {
      setShowRejectInput(true)
      return
    }
    setActionLoading(action)
    await onAction(deposit.id, action, rejectReason)
    setActionLoading(null)
    setShowRejectInput(false)
    setRejectReason('')
  }

  const isPending = deposit.status === 'pending' || deposit.status === 'under_review'

  return (
    <>
      <tr style={{ borderTop: '1px solid rgba(255,255,255,.04)', cursor: 'pointer' }}
        onClick={() => setExpanded(p => !p)}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.02)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
        <td style={{ padding: '13px 16px' }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#fbbf24', fontFamily: 'monospace' }}>{deposit.reference_id}</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,.3)', marginTop: 2 }}>{new Date(deposit.created_at).toLocaleString()}</div>
        </td>
        <td style={{ padding: '13px 16px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{deposit.profiles?.full_name || '—'}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)' }}>{deposit.profiles?.email}</div>
        </td>
        <td style={{ padding: '13px 16px', fontSize: 12, color: 'rgba(255,255,255,.6)' }}>{deposit.payment_methods?.name}</td>
        <td style={{ padding: '13px 16px' }}>
          <MoneyDisplay cents={deposit.amount_cents} size="sm" color="#fff" />
        </td>
        <td style={{ padding: '13px 16px' }}>
          {deposit.bonus_cents > 0 && <MoneyDisplay cents={deposit.bonus_cents} size="sm" color="#10b981" />}
        </td>
        <td style={{ padding: '13px 16px' }}>
          <MoneyDisplay cents={deposit.total_credit_cents} size="sm" color="#f59e0b" />
        </td>
        <td style={{ padding: '13px 16px' }}><StatusBadge status={deposit.status} size="xs" /></td>
        <td style={{ padding: '13px 16px', fontSize: 11, color: 'rgba(255,255,255,.3)' }}>{expanded ? '▲' : '▼'}</td>
      </tr>

      {expanded && (
        <tr style={{ background: 'rgba(251,191,36,.04)', borderTop: '1px solid rgba(251,191,36,.1)' }}>
          <td colSpan={8} style={{ padding: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
              {/* Player info */}
              <div style={{ background: 'rgba(255,255,255,.04)', borderRadius: 12, padding: '14px' }}>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.3)', marginBottom: 10 }}>Player Info</div>
                {[
                  ['KYC Status', deposit.profiles?.kyc_status || '—'],
                  ['Account Status', deposit.profiles?.status || '—'],
                  ['Player Level', `Level ${deposit.profiles?.player_level_id || 1}`],
                  ['Reference', deposit.player_reference || '—'],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', fontWeight: 600 }}>{k}</span>
                    <span style={{ fontSize: 11, color: '#fff', fontWeight: 700 }}>{v}</span>
                  </div>
                ))}
              </div>

              {/* Deposit details */}
              <div style={{ background: 'rgba(255,255,255,.04)', borderRadius: 12, padding: '14px' }}>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.3)', marginBottom: 10 }}>Deposit Details</div>
                {[
                  ['Amount', `$${(deposit.amount_cents / 100).toFixed(2)}`],
                  ['Bonus %', `${deposit.bonus_pct_applied}%`],
                  ['Bonus Amount', `$${(deposit.bonus_cents / 100).toFixed(2)}`],
                  ['Total Credit', `$${(deposit.total_credit_cents / 100).toFixed(2)}`],
                  ['Method', deposit.payment_methods?.name || '—'],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', fontWeight: 600 }}>{k}</span>
                    <span style={{ fontSize: 11, color: '#fff', fontWeight: 700 }}>{v}</span>
                  </div>
                ))}
              </div>

              {/* Screenshot / notes */}
              <div style={{ background: 'rgba(255,255,255,.04)', borderRadius: 12, padding: '14px' }}>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.3)', marginBottom: 10 }}>Proof & Notes</div>
                {deposit.screenshot_url ? (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', marginBottom: 6 }}>Screenshot uploaded ✓</div>
                    <button
                      onClick={async (e) => {
                        e.stopPropagation()
                        const { data } = await supabase.storage.from('deposits').createSignedUrl(deposit.screenshot_url, 300)
                        if (data?.signedUrl) window.open(data.signedUrl, '_blank')
                      }}
                      style={{ padding: '6px 14px', background: 'rgba(251,191,36,.15)', border: '1px solid rgba(251,191,36,.3)', borderRadius: 8, color: '#fbbf24', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>
                      📷 View Screenshot
                    </button>
                  </div>
                ) : (
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', marginBottom: 10 }}>No screenshot uploaded</div>
                )}
                {deposit.player_notes && (
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', background: 'rgba(255,255,255,.05)', padding: '8px 10px', borderRadius: 8, lineHeight: 1.5 }}>
                    <strong style={{ color: 'rgba(255,255,255,.7)' }}>Player note:</strong> {deposit.player_notes}
                  </div>
                )}
              </div>
            </div>

            {/* Reject reason input */}
            {showRejectInput && (
              <div style={{ marginBottom: 12 }}>
                <input
                  type="text"
                  placeholder="Reason for rejection (required)…"
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  onClick={e => e.stopPropagation()}
                  style={{ width: '100%', padding: '10px 14px', background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 10, color: '#fff', fontSize: 13, fontFamily: "'Outfit',sans-serif", outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            )}

            {/* Action buttons */}
            {isPending && (
              <div style={{ display: 'flex', gap: 10 }} onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => handleAction('approved')}
                  disabled={!!actionLoading}
                  style={{ padding: '10px 24px', background: actionLoading === 'approved' ? 'rgba(16,185,129,.4)' : 'linear-gradient(135deg,#10b981,#059669)', border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>
                  {actionLoading === 'approved' ? '⏳ Approving…' : '✓ Approve Deposit'}
                </button>
                <button
                  onClick={() => handleAction('rejected')}
                  disabled={!!actionLoading}
                  style={{ padding: '10px 24px', background: actionLoading === 'rejected' ? 'rgba(239,68,68,.4)' : 'rgba(239,68,68,.15)', border: '1px solid rgba(239,68,68,.4)', borderRadius: 10, color: '#f87171', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>
                  {actionLoading === 'rejected' ? '⏳ Rejecting…' : '✕ Reject'}
                </button>
                <button
                  onClick={() => handleAction('under_review')}
                  disabled={!!actionLoading}
                  style={{ padding: '10px 24px', background: 'rgba(99,102,241,.12)', border: '1px solid rgba(99,102,241,.3)', borderRadius: 10, color: '#94a3b8', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>
                  🔍 Mark Under Review
                </button>
              </div>
            )}
            {deposit.rejection_reason && (
              <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 8, fontSize: 12, color: '#f87171' }}>
                Rejection reason: {deposit.rejection_reason}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  )
}

export default function AdminDeposits() {
  const [deposits, setDeposits] = useState([])
  const [filter, setFilter] = useState('pending')
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)
  const [search, setSearch] = useState('')

  useEffect(() => { loadDeposits() }, [filter])

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  async function loadDeposits() {
    setLoading(true)
    let query = supabase
      .from('deposits')
      .select('*, profiles(full_name, email, kyc_status, status, player_level_id), payment_methods(name, type)')
      .order('created_at', { ascending: false })
      .limit(50)

    if (filter !== 'all') query = query.eq('status', filter)

    const { data } = await query
    setDeposits(data || [])
    setLoading(false)
  }

  async function handleAction(depositId, action, rejectionReason) {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/admin/deposits/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ deposit_id: depositId, action, rejection_reason: rejectionReason }),
    })
    const data = await res.json()
    if (res.ok) {
      showToast(`Deposit ${action} successfully`)
      loadDeposits()
    } else {
      showToast(data.error || 'Action failed', 'error')
    }
  }

  const filtered = deposits.filter(d => {
    if (!search) return true
    const s = search.toLowerCase()
    return d.reference_id?.toLowerCase().includes(s) ||
      d.profiles?.full_name?.toLowerCase().includes(s) ||
      d.profiles?.email?.toLowerCase().includes(s)
  })

  return (
    <AdminLayout>
      <Head><title>Deposits — Admin</title></Head>

      {toast && (
        <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, background: toast.type === 'error' ? 'rgba(239,68,68,.95)' : 'rgba(16,185,129,.95)', borderRadius: 12, padding: '12px 24px', color: '#fff', fontSize: 14, fontWeight: 600, fontFamily: "'Outfit',sans-serif", whiteSpace: 'nowrap', boxShadow: '0 8px 32px rgba(0,0,0,.5)' }}>
          {toast.type === 'error' ? '⚠ ' : '✓ '}{toast.msg}
        </div>
      )}

      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: "'Cinzel',serif", fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 4 }}>Deposits</h1>
        <p style={{ color: 'rgba(255,255,255,.35)', fontSize: 13 }}>Review and approve player deposit requests</p>
      </div>

      {/* Filters + search */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,.04)', padding: 4, borderRadius: 10 }}>
          {STATUS_FILTERS.map(s => (
            <button key={s} onClick={() => setFilter(s)} style={{ padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: "'Outfit',sans-serif", fontSize: 12, fontWeight: 700, background: filter === s ? 'rgba(251,191,36,.7)' : 'transparent', color: filter === s ? '#fff' : 'rgba(255,255,255,.4)', textTransform: 'capitalize', transition: 'all .15s' }}>
              {s === 'all' ? 'All' : s.replace('_', ' ')}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Search by name, email, reference…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ padding: '9px 14px', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, color: '#fff', fontSize: 13, fontFamily: "'Outfit',sans-serif", outline: 'none', minWidth: 260 }}
        />
        <button onClick={loadDeposits} style={{ padding: '9px 16px', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, color: 'rgba(255,255,255,.6)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>
          🔄 Refresh
        </button>
      </div>

      {/* Table */}
      <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,.04)' }}>
                {['Reference', 'Player', 'Method', 'Amount', 'Bonus', 'Total Credit', 'Status', ''].map(h => (
                  <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 10, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.35)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: 'rgba(255,255,255,.3)', fontSize: 14 }}>Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: 'rgba(255,255,255,.3)', fontSize: 14 }}>No deposits found</td></tr>
              ) : (
                filtered.map(d => <DepositRow key={d.id} deposit={d} onAction={handleAction} />)
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  )
}
