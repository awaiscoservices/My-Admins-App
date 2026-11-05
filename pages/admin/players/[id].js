import { useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { supabase } from '../../../lib/supabase'
import AdminLayout from '../../../components/layout/AdminLayout'
import MoneyDisplay from '../../../components/ui/MoneyDisplay'
import StatusBadge from '../../../components/ui/StatusBadge'

// ─── TAB BUTTON ─────────────────────────────────────────────
function Tab({ label, active, onClick, badge }) {
  return (
    <button onClick={onClick} style={{
      padding: '9px 18px', borderRadius: 9, border: 'none', cursor: 'pointer',
      fontFamily: "'Outfit',sans-serif", fontSize: 13, fontWeight: 700,
      background: active ? 'rgba(251,191,36,.2)' : 'transparent',
      color: active ? '#fff' : 'rgba(255,255,255,.4)',
      borderBottom: active ? '2px solid #fbbf24' : '2px solid transparent',
      transition: 'all .15s', display: 'flex', alignItems: 'center', gap: 6,
    }}>
      {label}
      {badge > 0 && <span style={{ background: '#fbbf24', color: '#050505', fontSize: 9, fontWeight: 800, padding: '1px 6px', borderRadius: 99 }}>{badge}</span>}
    </button>
  )
}

// ─── INFO ROW ────────────────────────────────────────────────
function InfoRow({ label, value, mono }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
      <span style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 13, color: '#fff', fontWeight: 700, fontFamily: mono ? 'monospace' : 'inherit' }}>{value || '—'}</span>
    </div>
  )
}

// ─── ADJUSTMENT MODAL ────────────────────────────────────────
function AdjustmentModal({ playerId, onClose, onSave }) {
  const [form, setForm] = useState({ direction: 'credit', wallet_bucket: 'cash', amount: '', reason: '', case_reference: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    if (!form.amount || parseFloat(form.amount) <= 0) { setError('Valid amount required'); return }
    if (!form.reason.trim()) { setError('Reason is required'); return }
    setSaving(true)
    const result = await onSave({
      ...form,
      amount_cents: Math.round(parseFloat(form.amount) * 100),
    })
    if (result?.error) { setError(result.error); setSaving(false) }
    else onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={onClose}>
      <div style={{ background: '#0e1a2e', border: '1px solid rgba(251,191,36,.3)', borderRadius: 20, padding: 28, width: '100%', maxWidth: 440 }} onClick={e => e.stopPropagation()}>
        <h3 style={{ fontFamily: "'Cinzel',serif", fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 20 }}>⚖️ Wallet Adjustment</h3>

        <div style={{ background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.2)', borderRadius: 10, padding: '10px 14px', marginBottom: 18, fontSize: 12, color: '#f59e0b', lineHeight: 1.5 }}>
          ⚠️ All adjustments are logged in the audit trail and cannot be deleted.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            {['credit', 'debit'].map(d => (
              <button key={d} onClick={() => setForm(p => ({ ...p, direction: d }))}
                style={{ flex: 1, padding: '10px', borderRadius: 10, border: `1px solid ${form.direction === d ? (d === 'credit' ? '#10b981' : '#ef4444') : 'rgba(255,255,255,.1)'}`, background: form.direction === d ? (d === 'credit' ? 'rgba(16,185,129,.15)' : 'rgba(239,68,68,.15)') : 'transparent', color: form.direction === d ? (d === 'credit' ? '#10b981' : '#f87171') : 'rgba(255,255,255,.4)', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: "'Outfit',sans-serif", textTransform: 'capitalize' }}>
                {d === 'credit' ? '+ Credit' : '- Debit'}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            {['cash', 'bonus'].map(b => (
              <button key={b} onClick={() => setForm(p => ({ ...p, wallet_bucket: b }))}
                style={{ flex: 1, padding: '9px', borderRadius: 10, border: `1px solid ${form.wallet_bucket === b ? '#fbbf24' : 'rgba(255,255,255,.1)'}`, background: form.wallet_bucket === b ? 'rgba(251,191,36,.15)' : 'transparent', color: form.wallet_bucket === b ? '#fbbf24' : 'rgba(255,255,255,.4)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'Outfit',sans-serif", textTransform: 'capitalize' }}>
                {b} wallet
              </button>
            ))}
          </div>

          {[
            { key: 'amount', label: 'Amount (USD)', placeholder: '0.00', type: 'number' },
            { key: 'reason', label: 'Reason *', placeholder: 'e.g. Customer compensation, correction', type: 'text' },
            { key: 'case_reference', label: 'Case Reference (optional)', placeholder: 'e.g. CASE-10291', type: 'text' },
          ].map(f => (
            <div key={f.key}>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.4)', marginBottom: 5 }}>{f.label}</label>
              <input type={f.type} placeholder={f.placeholder} value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 10, color: '#fff', fontSize: 13, fontFamily: "'Outfit',sans-serif", outline: 'none', boxSizing: 'border-box' }}
                onFocus={e => e.target.style.borderColor = '#fbbf24'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,.12)'}
              />
            </div>
          ))}
        </div>

        {error && <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 10, color: '#f87171', fontSize: 12 }}>⚠ {error}</div>}

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '11px', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, color: 'rgba(255,255,255,.5)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: '11px', background: saving ? 'rgba(251,191,36,.4)' : 'linear-gradient(135deg,#fbbf24,#f59e0b)', border: 'none', borderRadius: 10, color: '#050505', fontSize: 13, fontWeight: 800, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: "'Outfit',sans-serif" }}>
            {saving ? '⏳ Processing…' : '⚖️ Apply Adjustment'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── MAIN PAGE ───────────────────────────────────────────────
export default function AdminPlayerDetail() {
  const router = useRouter()
  const { id } = router.query

  const [player, setPlayer] = useState(null)
  const [wallet, setWallet] = useState(null)
  const [deposits, setDeposits] = useState([])
  const [gameAccounts, setGameAccounts] = useState([])
  const [transactions, setTransactions] = useState([])
  const [kyc, setKyc] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [showAdjModal, setShowAdjModal] = useState(false)
  const [toast, setToast] = useState(null)

  useEffect(() => { if (id) loadPlayer() }, [id])

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  async function loadPlayer() {
    setLoading(true)
    const [
      { data: prof },
      { data: wal },
      { data: deps },
      { data: gas },
      { data: txs },
      { data: kycRec },
    ] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', id).single(),
      supabase.from('wallets').select('*').eq('user_id', id).single(),
      supabase.from('deposits').select('*, payment_methods(name)').eq('user_id', id).order('created_at', { ascending: false }).limit(20),
      supabase.from('game_accounts').select('*, game_panels(name, accent_color)').eq('user_id', id).order('created_at', { ascending: false }),
      supabase.from('ledger').select('*').eq('user_id', id).order('created_at', { ascending: false }).limit(30),
      supabase.from('kyc_records').select('*').eq('user_id', id).single(),
    ])

    setPlayer(prof)
    setWallet(wal)
    setDeposits(deps || [])
    setGameAccounts(gas || [])
    setTransactions(txs || [])
    setKyc(kycRec)
    setLoading(false)
  }

  async function handleAdjustment(form) {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/admin/players/adjust-wallet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ player_id: id, ...form }),
    })
    const data = await res.json()
    if (!res.ok) return { error: data.error }
    showToast('Wallet adjustment applied')
    loadPlayer()
    return {}
  }

  async function handleStatusChange(newStatus) {
    const reason = newStatus !== 'active' ? prompt(`Reason for ${newStatus}:`) : 'Reactivated by admin'
    if (!reason) return
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/admin/players/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ player_id: id, status: newStatus, reason }),
    })
    const data = await res.json()
    if (res.ok) { showToast(`Player ${newStatus}`); loadPlayer() }
    else showToast(data.error || 'Failed', 'error')
  }

  if (loading) return (
    <AdminLayout>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
        <div style={{ color: 'rgba(255,255,255,.4)', fontSize: 14 }}>Loading player…</div>
      </div>
    </AdminLayout>
  )

  if (!player) return (
    <AdminLayout>
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
        <div style={{ color: 'rgba(255,255,255,.5)', fontSize: 16 }}>Player not found</div>
        <Link href="/admin/players" style={{ display: 'inline-block', marginTop: 16, color: '#fbbf24', textDecoration: 'none', fontSize: 14, fontWeight: 700 }}>← Back to Players</Link>
      </div>
    </AdminLayout>
  )

  const txTypeColor = (type) => ['deposit','deposit_bonus','redeem','referral_bonus','level_bonus','adjustment_credit','promotion_credit','refund'].includes(type) ? '#10b981' : '#f87171'

  return (
    <AdminLayout>
      <Head><title>{player.full_name} — Admin</title></Head>

      {toast && (
        <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, background: toast.type === 'error' ? 'rgba(239,68,68,.95)' : 'rgba(16,185,129,.95)', borderRadius: 12, padding: '12px 24px', color: '#fff', fontSize: 14, fontWeight: 600, fontFamily: "'Outfit',sans-serif", whiteSpace: 'nowrap', boxShadow: '0 8px 32px rgba(0,0,0,.5)' }}>
          {toast.type === 'error' ? '⚠ ' : '✓ '}{toast.msg}
        </div>
      )}

      {showAdjModal && <AdjustmentModal playerId={id} onClose={() => setShowAdjModal(false)} onSave={handleAdjustment} />}

      {/* Back + header */}
      <div style={{ marginBottom: 20 }}>
        <Link href="/admin/players" style={{ color: '#fbbf24', textDecoration: 'none', fontSize: 13, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>← Players</Link>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: 'linear-gradient(135deg,#f59e0b,#fbbf24)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 900, color: '#050505' }}>
              {(player.full_name || 'U')[0].toUpperCase()}
            </div>
            <div>
              <h1 style={{ fontFamily: "'Cinzel',serif", fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{player.full_name}</h1>
              <div style={{ fontSize: 13, color: '#fbbf24' }}>{player.email}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', marginTop: 2 }}>ID: {player.id}</div>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => setShowAdjModal(true)} style={{ padding: '9px 16px', background: 'rgba(251,191,36,.15)', border: '1px solid rgba(251,191,36,.3)', borderRadius: 10, color: '#fbbf24', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>
              ⚖️ Adjust Wallet
            </button>
            {player.status === 'active' ? (
              <>
                <button onClick={() => handleStatusChange('suspended')} style={{ padding: '9px 16px', background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.3)', borderRadius: 10, color: '#f59e0b', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>
                  ⏸ Suspend
                </button>
                <button onClick={() => handleStatusChange('banned')} style={{ padding: '9px 16px', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 10, color: '#f87171', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>
                  🚫 Ban
                </button>
              </>
            ) : (
              <button onClick={() => handleStatusChange('active')} style={{ padding: '9px 16px', background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.3)', borderRadius: 10, color: '#10b981', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>
                ✓ Reactivate
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Status chips */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <StatusBadge status={player.status} />
        <StatusBadge status={player.kyc_status || 'not_started'} />
        {player.is_flagged && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 99, background: 'rgba(239,68,68,.15)', fontSize: 11, fontWeight: 800, color: '#f87171', letterSpacing: '.04em', textTransform: 'uppercase' }}>⚠️ Flagged</span>}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 99, background: 'rgba(251,191,36,.12)', fontSize: 11, fontWeight: 800, color: '#fbbf24', letterSpacing: '.04em', textTransform: 'uppercase' }}>Level {player.player_level_id || 1}</span>
      </div>

      {/* Wallet summary bar */}
      {wallet && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(150px,100%),1fr))', gap: 10, marginBottom: 20 }}>
          {[
            { label: 'Cash',        cents: wallet.cash_balance_cents,    color: '#10b981' },
            { label: 'Bonus',       cents: wallet.bonus_balance_cents,   color: '#f59e0b' },
            { label: 'Reserved',    cents: wallet.reserved_cents,        color: '#94a3b8' },
            { label: 'Withdrawable',cents: wallet.withdrawable_cents,    color: '#fbbf24' },
            { label: 'Total Deposited', cents: wallet.total_deposited_cents, color: 'rgba(255,255,255,.5)' },
          ].map(b => (
            <div key={b.label} style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.35)', marginBottom: 6 }}>{b.label}</div>
              <MoneyDisplay cents={b.cents || 0} size="lg" color={b.color} />
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid rgba(255,255,255,.08)', marginBottom: 20, overflowX: 'auto' }}>
        {[
          { key: 'overview',      label: 'Overview' },
          { key: 'deposits',      label: 'Deposits',      badge: deposits.filter(d => d.status === 'pending').length },
          { key: 'game-accounts', label: 'Game Accounts', badge: gameAccounts.filter(g => g.status === 'pending').length },
          { key: 'transactions',  label: 'Transactions' },
          { key: 'kyc',           label: 'KYC' },
        ].map(t => <Tab key={t.key} label={t.label} active={activeTab === t.key} onClick={() => setActiveTab(t.key)} badge={t.badge} />)}
      </div>

      {/* ── TAB: OVERVIEW ── */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 16, padding: '20px' }}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.3)', marginBottom: 14 }}>Account Info</div>
            <InfoRow label="Full Name"      value={player.full_name} />
            <InfoRow label="Email"          value={player.email} />
            <InfoRow label="Phone"          value={player.phone} />
            <InfoRow label="Referral Code"  value={player.referral_code} mono />
            <InfoRow label="Total XP"       value={`${player.total_xp || 0} XP`} />
            <InfoRow label="Risk Score"     value={player.risk_score || 0} />
            <InfoRow label="Last Login"     value={player.last_login_at ? new Date(player.last_login_at).toLocaleString() : '—'} />
            <InfoRow label="Joined"         value={new Date(player.created_at).toLocaleString()} />
          </div>
          <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 16, padding: '20px' }}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.3)', marginBottom: 14 }}>Wallet Stats</div>
            <InfoRow label="Cash Balance"       value={<MoneyDisplay cents={wallet?.cash_balance_cents || 0} size="sm" color="#10b981" />} />
            <InfoRow label="Bonus Balance"      value={<MoneyDisplay cents={wallet?.bonus_balance_cents || 0} size="sm" color="#f59e0b" />} />
            <InfoRow label="Total Deposited"    value={<MoneyDisplay cents={wallet?.total_deposited_cents || 0} size="sm" color="#fff" />} />
            <InfoRow label="Total Bonus"        value={<MoneyDisplay cents={wallet?.total_bonus_cents || 0} size="sm" color="#fff" />} />
            <InfoRow label="Total Loaded"       value={<MoneyDisplay cents={wallet?.total_loaded_cents || 0} size="sm" color="#fff" />} />
            <InfoRow label="Total Redeemed"     value={<MoneyDisplay cents={wallet?.total_redeemed_cents || 0} size="sm" color="#fff" />} />
            <InfoRow label="Total Withdrawn"    value={<MoneyDisplay cents={wallet?.total_withdrawn_cents || 0} size="sm" color="#fff" />} />
          </div>
        </div>
      )}

      {/* ── TAB: DEPOSITS ── */}
      {activeTab === 'deposits' && (
        <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 16, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,.04)' }}>
                {['Reference', 'Method', 'Amount', 'Bonus', 'Total Credit', 'Status', 'Date'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.35)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {deposits.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: '30px', textAlign: 'center', color: 'rgba(255,255,255,.3)' }}>No deposits yet</td></tr>
              ) : deposits.map(d => (
                <tr key={d.id} style={{ borderTop: '1px solid rgba(255,255,255,.04)' }}>
                  <td style={{ padding: '11px 14px', fontSize: 11, fontWeight: 800, color: '#fbbf24', fontFamily: 'monospace' }}>{d.reference_id}</td>
                  <td style={{ padding: '11px 14px', fontSize: 12, color: 'rgba(255,255,255,.6)' }}>{d.payment_methods?.name}</td>
                  <td style={{ padding: '11px 14px' }}><MoneyDisplay cents={d.amount_cents} size="sm" color="#fff" /></td>
                  <td style={{ padding: '11px 14px' }}><MoneyDisplay cents={d.bonus_cents} size="sm" color="#10b981" /></td>
                  <td style={{ padding: '11px 14px' }}><MoneyDisplay cents={d.total_credit_cents} size="sm" color="#f59e0b" /></td>
                  <td style={{ padding: '11px 14px' }}><StatusBadge status={d.status} size="xs" /></td>
                  <td style={{ padding: '11px 14px', fontSize: 11, color: 'rgba(255,255,255,.3)' }}>{new Date(d.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── TAB: GAME ACCOUNTS ── */}
      {activeTab === 'game-accounts' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(280px,100%),1fr))', gap: 12 }}>
          {gameAccounts.length === 0 ? (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,.3)' }}>No game accounts</div>
          ) : gameAccounts.map(ga => (
            <div key={ga.id} style={{ background: 'rgba(255,255,255,.03)', border: `1px solid ${ga.game_panels?.accent_color || '#fbbf24'}33`, borderRadius: 14, padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{ga.game_panels?.name}</div>
                <StatusBadge status={ga.status} size="xs" />
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', fontFamily: 'monospace', marginBottom: 4 }}>Ref: {ga.reference_id}</div>
              {ga.game_username && <div style={{ fontSize: 12, color: '#10b981', fontWeight: 700 }}>@{ga.game_username}</div>}
              {ga.game_id && <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)' }}>ID: {ga.game_id}</div>}
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,.25)', marginTop: 8 }}>Created {new Date(ga.created_at).toLocaleDateString()}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── TAB: TRANSACTIONS ── */}
      {activeTab === 'transactions' && (
        <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 16, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,.04)' }}>
                {['Reference', 'Type', 'Bucket', 'Amount', 'Direction', 'Balance After', 'Date'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.35)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: '30px', textAlign: 'center', color: 'rgba(255,255,255,.3)' }}>No transactions yet</td></tr>
              ) : transactions.map(tx => (
                <tr key={tx.id} style={{ borderTop: '1px solid rgba(255,255,255,.04)' }}>
                  <td style={{ padding: '11px 14px', fontSize: 10, fontWeight: 800, color: '#fbbf24', fontFamily: 'monospace' }}>{tx.reference_id}</td>
                  <td style={{ padding: '11px 14px', fontSize: 11, color: 'rgba(255,255,255,.6)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{tx.type?.replace(/_/g, ' ')}</td>
                  <td style={{ padding: '11px 14px', fontSize: 11, color: 'rgba(255,255,255,.4)', textTransform: 'capitalize' }}>{tx.wallet_bucket}</td>
                  <td style={{ padding: '11px 14px' }}><MoneyDisplay cents={tx.amount_cents} size="sm" color={txTypeColor(tx.type)} /></td>
                  <td style={{ padding: '11px 14px' }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: tx.direction === 'credit' ? '#10b981' : '#f87171', textTransform: 'uppercase' }}>
                      {tx.direction === 'credit' ? '▲' : '▼'} {tx.direction}
                    </span>
                  </td>
                  <td style={{ padding: '11px 14px' }}><MoneyDisplay cents={tx.balance_after_cents} size="sm" color="rgba(255,255,255,.5)" /></td>
                  <td style={{ padding: '11px 14px', fontSize: 11, color: 'rgba(255,255,255,.3)', whiteSpace: 'nowrap' }}>{new Date(tx.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── TAB: KYC ── */}
      {activeTab === 'kyc' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 16, padding: '20px' }}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.3)', marginBottom: 14 }}>KYC Record</div>
            {kyc ? (
              <>
                <InfoRow label="Status"        value={<StatusBadge status={kyc.status} size="xs" />} />
                <InfoRow label="Document Type" value={kyc.doc_type?.replace('_', ' ')} />
                <InfoRow label="Legal Name"    value={kyc.full_legal_name} />
                <InfoRow label="Date of Birth" value={kyc.date_of_birth} />
                <InfoRow label="Address"       value={kyc.address} />
                <InfoRow label="Submitted"     value={kyc.submitted_at ? new Date(kyc.submitted_at).toLocaleString() : '—'} />
                <InfoRow label="Verified"      value={kyc.verified_at ? new Date(kyc.verified_at).toLocaleString() : '—'} />
                {kyc.rejection_reason && (
                  <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 10, fontSize: 12, color: '#f87171' }}>
                    Rejection: {kyc.rejection_reason}
                  </div>
                )}
                {kyc.status === 'pending' && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                    <Link href={`/admin/kyc`} style={{ flex: 1, padding: '10px', background: 'linear-gradient(135deg,#10b981,#059669)', borderRadius: 10, color: '#fff', fontSize: 12, fontWeight: 800, textDecoration: 'none', textAlign: 'center' }}>
                      Review KYC →
                    </Link>
                  </div>
                )}
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px 0', color: 'rgba(255,255,255,.3)' }}>No KYC record found</div>
            )}
          </div>
          <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 16, padding: '20px' }}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.3)', marginBottom: 14 }}>AI Verification</div>
            {kyc?.ai_result && Object.keys(kyc.ai_result).length > 0 ? (
              <pre style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', background: 'rgba(255,255,255,.04)', padding: 14, borderRadius: 10, overflowX: 'auto', lineHeight: 1.6 }}>
                {JSON.stringify(kyc.ai_result, null, 2)}
              </pre>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px 0', color: 'rgba(255,255,255,.3)' }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>🤖</div>
                <div style={{ fontSize: 13 }}>AI verification not yet run</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,.2)', marginTop: 6 }}>Coming in Phase 9 — KYC module</div>
              </div>
            )}
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
