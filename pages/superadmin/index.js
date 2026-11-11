/**
 * pages/superadmin/index.js
 * Super Admin Dashboard — platform-wide overview
 */
import { useEffect, useState } from 'react'
import SuperAdminLayout from '../../components/layout/SuperAdminLayout'
import { supabase } from '../../lib/supabase'

const G  = '#fbbf24'
const G2 = '#f59e0b'

/**
 * Stroke icons on a 24×24 box, matching the admin dashboard and the sidebar.
 * These replace the emoji each card carried: an emoji is a different glyph on
 * every platform, so the row never read as one set.
 */
const ICONS = {
  building: 'M3 21h18M5 21V5a2 2 0 012-2h7a2 2 0 012 2v16M16 10h3a2 2 0 012 2v9M9 7h2M9 11h2M9 15h2',
  check:    'M22 11.1V12a10 10 0 11-5.9-9.1M22 4L12 14l-3-3',
  pause:    'M12 21a9 9 0 100-18 9 9 0 000 18zM10 9v6M14 9v6',
  globe:    'M12 21a9 9 0 100-18 9 9 0 000 18zM3.6 9h16.8M3.6 15h16.8M12 3a14 14 0 000 18 14 14 0 000-18',
  calendar: 'M7 3v4M17 3v4M4 9h16M5 5h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z',
  users:    'M16 20v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2M9.5 10a4 4 0 100-8 4 4 0 000 8zM21 20v-2a4 4 0 00-3-3.9M16 2.1a4 4 0 010 7.8',
}

function Icon({ name, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, display: 'block' }}>
      <path d={ICONS[name] || ICONS.building} />
    </svg>
  )
}

/**
 * The same card as the admin dashboard and the player wallet: accent strip,
 * icon badge, label beside it, the number, then one line of context.
 */
function StatCard({ icon, label, value, sub, color }) {
  const tint = color || '#94a3b8'
  return (
    <div style={{
      background: 'rgba(255,255,255,.03)', border: `1px solid ${tint}28`,
      borderRadius: 16, padding: '20px 22px',
      display: 'flex', flexDirection: 'column', minHeight: 136,
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg,${tint}00,${tint}80,${tint}00)`, borderRadius: '16px 16px 0 0' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <span style={{
          width: 38, height: 38, borderRadius: 11, flexShrink: 0,
          background: `${tint}1a`, border: `1px solid ${tint}40`, color: tint,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name={icon} size={18} />
        </span>
        <span style={{ color: 'rgba(255,255,255,.75)', fontSize: 11.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.1em', lineHeight: 1.3 }}>{label}</span>
      </div>
      <div style={{ color: color || '#fff', fontSize: 30, fontWeight: 800, lineHeight: 1, fontFamily: "'Outfit',sans-serif", letterSpacing: '-.5px' }}>{value}</div>
      {sub && <div style={{ color: 'rgba(255,255,255,.35)', fontSize: 12, marginTop: 'auto', paddingTop: 8 }}>{sub}</div>}
    </div>
  )
}

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState(null)
  const [recent, setRecent] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    // Must be the shared cookie-based client. A client built here with
    // createClient() keeps its session in localStorage, finds nothing, and
    // leaves the page stuck on "Loading…" forever.
    ;(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) { setError('Your session has expired. Please sign in again.'); return }

        const r = await fetch('/api/superadmin/dashboard', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        const data = await r.json()
        if (!r.ok) { setError(data.error || `Request failed (${r.status})`); return }

        setStats(data.stats)
        setRecent(data.recent || [])
      } catch (e) {
        setError(e.message || 'Could not reach the server.')
      } finally {
        setLoading(false)   // always, so the page can never hang
      }
    })()
  }, [])

  const statusColor = s => s === 'active' ? '#22c55e' : s === 'suspended' ? '#ef4444' : '#f59e0b'

  return (
    <SuperAdminLayout title="Platform Dashboard">
      {/* Inline styles cannot carry media queries, so the breakpoints live here. */}
      <style>{`
        .stat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        @media (max-width: 1100px) { .stat-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 620px)  { .stat-grid { grid-template-columns: 1fr; } }
      `}</style>
      <div>
        {loading && <div style={{ color: 'rgba(255,255,255,.4)', fontSize: 14 }}>Loading…</div>}
        {error  && <div style={{ color: '#ef4444', fontSize: 14 }}>{error}</div>}

        {stats && (
          <>
            {/* Stat cards */}
            {/* Six cards as three across, two deep — fixed, not auto-fitting,
                so the rows stay even instead of breaking 4 and 2. */}
            <div className="stat-grid" style={{ marginBottom: 32 }}>
              <StatCard icon="building" label="Total Tenants"  value={stats.total}                  sub="All time"       color={G} />
              <StatCard icon="check"    label="Active"         value={stats.active}                 sub="Operational"    color="#22c55e" />
              <StatCard icon="pause"    label="Suspended"      value={stats.suspended}              sub="Access blocked" color="#ef4444" />
              <StatCard icon="users"    label="Total Players"  value={(stats.players ?? 0).toLocaleString()} sub="Across every casino" color="#3b82f6" />
              <StatCard icon="globe"    label="Total Domains"  value={stats.domains}                sub="Custom + sub"   color="#06b6d4" />
              <StatCard icon="calendar" label="New This Month" value={stats.new_month}              sub="Since the 1st"  color={G} />
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
