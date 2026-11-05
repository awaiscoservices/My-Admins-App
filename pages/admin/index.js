import { useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'
import AdminLayout from '../../components/layout/AdminLayout'
import MoneyDisplay from '../../components/ui/MoneyDisplay'

function StatCard({ label, value, sub, color, icon, href }) {
  const [hov, setHov] = useState(false)
  const inner = (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} style={{
      padding: '20px', borderRadius: 16,
      background: hov ? `${color}12` : 'rgba(255,255,255,.03)',
      border: `1px solid ${hov ? color + '40' : 'rgba(255,255,255,.07)'}`,
      transition: 'all .2s', cursor: href ? 'pointer' : 'default',
      transform: hov && href ? 'translateY(-2px)' : 'none',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.4)' }}>{label}</span>
        <span style={{ fontSize: 20 }}>{icon}</span>
      </div>
      <div style={{ fontFamily: "'Cinzel Decorative',serif", fontSize: 28, fontWeight: 900, color, lineHeight: 1, marginBottom: 6 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', fontWeight: 500 }}>{sub}</div>}
    </div>
  )
  return href ? <Link href={href} style={{ textDecoration: 'none' }}>{inner}</Link> : inner
}

function PendingRow({ label, count, href, color }) {
  if (!count) return null
  return (
    <Link href={href} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderRadius: 12, background: `${color}0d`, border: `1px solid ${color}25`, marginBottom: 8, transition: 'all .15s' }}
      onMouseEnter={e => e.currentTarget.style.background = `${color}18`}
      onMouseLeave={e => e.currentTarget.style.background = `${color}0d`}>
      <span style={{ fontSize: 13, color: 'rgba(255,255,255,.7)', fontWeight: 600 }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ background: color, color: '#fff', fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 99 }}>{count} pending</span>
        <span style={{ color, fontSize: 14 }}>→</span>
      </div>
    </Link>
  )
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null)
  const [recentDeposits, setRecentDeposits] = useState([])
  const [recentPlayers, setRecentPlayers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadStats() }, [])

  async function loadStats() {
    const [
      { count: totalPlayers },
      { count: verifiedPlayers },
      { count: pendingDeposits },
      { count: pendingGameAccounts },
      { count: pendingRedemptions },
      { count: pendingWithdrawals },
      { count: pendingKyc },
      { count: openTickets },
      { data: depositStats },
      { data: deposits },
      { data: players },
    ] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'player'),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'player').eq('kyc_status', 'verified'),
      supabase.from('deposits').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('game_accounts').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('redemptions').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('withdrawals').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('kyc_records').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('support_tickets').select('*', { count: 'exact', head: true }).eq('status', 'open'),
      supabase.from('deposits').select('amount_cents, bonus_cents').eq('status', 'approved'),
      supabase.from('deposits').select('*, profiles(full_name, email), payment_methods(name)').order('created_at', { ascending: false }).limit(6),
      supabase.from('profiles').select('*').eq('role', 'player').order('created_at', { ascending: false }).limit(5),
    ])

    const totalDeposited = (depositStats || []).reduce((s, d) => s + (d.amount_cents || 0), 0)
    const totalBonus = (depositStats || []).reduce((s, d) => s + (d.bonus_cents || 0), 0)

    setStats({
      totalPlayers: totalPlayers || 0,
      verifiedPlayers: verifiedPlayers || 0,
      pendingDeposits: pendingDeposits || 0,
      pendingGameAccounts: pendingGameAccounts || 0,
      pendingRedemptions: pendingRedemptions || 0,
      pendingWithdrawals: pendingWithdrawals || 0,
      pendingKyc: pendingKyc || 0,
      openTickets: openTickets || 0,
      totalDeposited,
      totalBonus,
      totalPending: (pendingDeposits || 0) + (pendingGameAccounts || 0) + (pendingRedemptions || 0) + (pendingWithdrawals || 0),
    })
    setRecentDeposits(deposits || [])
    setRecentPlayers(players || [])
    setLoading(false)
  }

  if (loading) return (
    <AdminLayout>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
        <div style={{ color: 'rgba(255,255,255,.4)', fontSize: 14 }}>Loading dashboard…</div>
      </div>
    </AdminLayout>
  )

  return (
    <AdminLayout>
      <Head><title>Admin Dashboard — Casinoze Room</title></Head>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: "'Cinzel',serif", fontSize: 24, fontWeight: 700, color: '#fff', marginBottom: 4 }}>Operations Dashboard</h1>
        <p style={{ color: 'rgba(255,255,255,.35)', fontSize: 13 }}>{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>

      {/* ── STAT CARDS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(180px,100%),1fr))', gap: 12, marginBottom: 24 }}>
        <StatCard label="Total Players"     value={stats.totalPlayers}      icon="👥" color="#fbbf24" href="/admin/players" sub={`${stats.verifiedPlayers} verified`} />
        <StatCard label="Total Deposited"   value={<MoneyDisplay cents={stats.totalDeposited} size="lg" color="#10b981" />} icon="💳" color="#10b981" href="/admin/deposits" sub="All time approved" />
        <StatCard label="Total Bonus Paid"  value={<MoneyDisplay cents={stats.totalBonus} size="lg" color="#f59e0b" />}     icon="🎁" color="#f59e0b" sub="All time bonus credits" />
        <StatCard label="Pending Actions"   value={stats.totalPending}      icon="⏳" color="#ef4444" sub="Needs attention" />
        <StatCard label="KYC Pending"       value={stats.pendingKyc}        icon="🔐" color="#ec4899" href="/admin/kyc" sub="Awaiting review" />
        <StatCard label="Open Tickets"      value={stats.openTickets}       icon="💬" color="#6366f1" href="/admin/support" sub="Support requests" />
      </div>

      {/* ── PENDING ACTIONS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 18, padding: '20px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            ⏳ Pending Actions
            {stats.totalPending > 0 && <span style={{ background: '#ef4444', color: '#fff', fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 99 }}>{stats.totalPending}</span>}
          </div>
          <PendingRow label="Deposits to Approve"     count={stats.pendingDeposits}      href="/admin/deposits"      color="#10b981" />
          <PendingRow label="Game Accounts to Setup"  count={stats.pendingGameAccounts}   href="/admin/game-accounts" color="#fbbf24" />
          <PendingRow label="Redemptions to Process"  count={stats.pendingRedemptions}    href="/admin/redemptions"   color="#f59e0b" />
          <PendingRow label="Withdrawals to Pay"      count={stats.pendingWithdrawals}    href="/admin/withdrawals"   color="#3b82f6" />
          {stats.totalPending === 0 && (
            <div style={{ textAlign: 'center', padding: '20px 0', color: 'rgba(255,255,255,.3)', fontSize: 13 }}>✅ All caught up!</div>
          )}
        </div>

        {/* Recent deposits */}
        <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 18, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Recent Deposits</span>
            <Link href="/admin/deposits" style={{ fontSize: 11, color: '#fbbf24', fontWeight: 600, textDecoration: 'none' }}>View All →</Link>
          </div>
          {recentDeposits.map((d, i) => (
            <div key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 18px', borderBottom: i < recentDeposits.length - 1 ? '1px solid rgba(255,255,255,.04)' : 'none' }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{d.profiles?.full_name || d.profiles?.email}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,.3)', marginTop: 1 }}>{d.reference_id} · {d.payment_methods?.name}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <MoneyDisplay cents={d.amount_cents} size="sm" color="#fff" />
                <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 99, background: d.status === 'pending' ? 'rgba(245,158,11,.2)' : d.status === 'approved' ? 'rgba(16,185,129,.2)' : 'rgba(239,68,68,.2)', color: d.status === 'pending' ? '#f59e0b' : d.status === 'approved' ? '#10b981' : '#f87171', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                  {d.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent players */}
      <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 18, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Recent Signups</span>
          <Link href="/admin/players" style={{ fontSize: 11, color: '#fbbf24', fontWeight: 600, textDecoration: 'none' }}>View All →</Link>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,.03)' }}>
                {['Player', 'Email', 'KYC', 'Status', 'Joined'].map(h => (
                  <th key={h} style={{ padding: '10px 18px', textAlign: 'left', fontSize: 10, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.3)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentPlayers.map((p, i) => (
                <tr key={p.id} style={{ borderTop: '1px solid rgba(255,255,255,.04)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.02)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '12px 18px' }}>
                    <Link href={`/admin/players/${p.id}`} style={{ fontSize: 13, fontWeight: 700, color: '#fff', textDecoration: 'none' }}>
                      {p.full_name || '—'}
                    </Link>
                  </td>
                  <td style={{ padding: '12px 18px', fontSize: 12, color: 'rgba(255,255,255,.5)' }}>{p.email}</td>
                  <td style={{ padding: '12px 18px' }}>
                    <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 99, textTransform: 'uppercase', letterSpacing: '.06em', background: p.kyc_status === 'verified' ? 'rgba(16,185,129,.15)' : 'rgba(245,158,11,.15)', color: p.kyc_status === 'verified' ? '#10b981' : '#f59e0b' }}>
                      {p.kyc_status?.replace('_', ' ')}
                    </span>
                  </td>
                  <td style={{ padding: '12px 18px' }}>
                    <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 99, textTransform: 'uppercase', background: p.status === 'active' ? 'rgba(16,185,129,.15)' : 'rgba(239,68,68,.15)', color: p.status === 'active' ? '#10b981' : '#f87171' }}>
                      {p.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 18px', fontSize: 11, color: 'rgba(255,255,255,.3)', whiteSpace: 'nowrap' }}>
                    {new Date(p.created_at).toLocaleDateString()}
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
