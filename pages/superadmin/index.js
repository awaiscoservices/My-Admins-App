/**
 * pages/superadmin/index.js
 * Super Admin Dashboard — platform-wide overview
 */
import { useEffect, useState } from 'react'
import SuperAdminLayout from '../../components/layout/SuperAdminLayout'

const G  = '#fbbf24'
const G2 = '#f59e0b'

function StatCard({ icon, label, value, sub, color }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)',
      borderRadius: 12, padding: '20px 24px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <span style={{ fontSize: 22 }}>{icon}</span>
        <span style={{ color: 'rgba(255,255,255,.45)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '.08em' }}>{label}</span>
      </div>
      <div style={{ color: color || '#fff', fontSize: 28, fontWeight: 700, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ color: 'rgba(255,255,255,.35)', fontSize: 12, marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState(null)
  const [recent, setRecent] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const { createClient } = require('@supabase/supabase-js')
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    )
    sb.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return
      const token = session.access_token
      const r = await fetch('/api/superadmin/dashboard', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await r.json()
      if (!r.ok) { setError(data.error); setLoading(false); return }
      setStats(data.stats)
      setRecent(data.recent || [])
      setLoading(false)
    })
  }, [])

  const statusColor = s => s === 'active' ? '#22c55e' : s === 'suspended' ? '#ef4444' : '#f59e0b'

  return (
    <SuperAdminLayout title="Platform Dashboard">
      <div style={{ padding: 32 }}>
        {loading && <div style={{ color: 'rgba(255,255,255,.4)', fontSize: 14 }}>Loading…</div>}
        {error  && <div style={{ color: '#ef4444', fontSize: 14 }}>{error}</div>}

        {stats && (
          <>
            {/* Stat cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 16, marginBottom: 32 }}>
              <StatCard icon="🏢" label="Total Tenants"    value={stats.total}     sub="All time"           color={G} />
              <StatCard icon="✅" label="Active"           value={stats.active}    sub="Operational"        color="#22c55e" />
              <StatCard icon="⏸️"  label="Suspended"       value={stats.suspended} sub="Access blocked"     color="#ef4444" />
              <StatCard icon="🌐" label="Total Domains"    value={stats.domains}   sub="Custom + sub"       />
              <StatCard icon="📅" label="New This Month"   value={stats.new_month} sub="Last 30 days"       color={G} />
            </div>

            {/* Recent tenants */}
            <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 12 }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>Recent Tenants</span>
                <a href="/superadmin/tenants" style={{ color: G, fontSize: 12, textDecoration: 'none' }}>View all →</a>
              </div>
              <div style={{ padding: '0 20px' }}>
                {recent.length === 0 && <div style={{ color: 'rgba(255,255,255,.3)', fontSize: 13, padding: '16px 0' }}>No tenants yet.</div>}
                {recent.map((t, i) => (
                  <div key={t.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 0',
                    borderBottom: i < recent.length - 1 ? '1px solid rgba(255,255,255,.04)' : 'none',
                  }}>
                    <div>
                      <div style={{ color: '#fff', fontSize: 14, fontWeight: 500 }}>{t.name}</div>
                      <div style={{ color: 'rgba(255,255,255,.35)', fontSize: 12 }}>{t.slug} · {new Date(t.created_at).toLocaleDateString()}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: statusColor(t.status),
                        background: `${statusColor(t.status)}18`, padding: '3px 8px', borderRadius: 20 }}>
                        {t.status}
                      </span>
                      <a href={`/superadmin/tenants/${t.id}`} style={{ color: G, fontSize: 12, textDecoration: 'none' }}>Detail →</a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </SuperAdminLayout>
  )
}
