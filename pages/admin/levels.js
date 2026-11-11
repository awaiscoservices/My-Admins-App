/**
 * Admin → Player Levels
 *
 * Simplified schema (no bonus fields, no game-load limits):
 *   • Max Redeem Limit ($) — hard ceiling per game per day, overrides multiplier
 *   • Min Redeem Multiplier (X) — lowest multiplier for this tier
 *   • Max Redeem Multiplier (X) — highest multiplier for this tier
 *   • Min Withdraw ($) — minimum withdrawal amount
 *   • Max Withdraw ($) — maximum withdrawal amount (blank = unlimited)
 *
 * "Scores" is the renamed label for game loads throughout this page.
 */
import { useState, useEffect, useCallback } from 'react'
import Head from 'next/head'
import AdminLayout from '../../components/layout/AdminLayout'
import { supabase } from '../../lib/supabase'
import SharedLevelDrawer, { fmtD, fmtX } from '../../components/levels/LevelDrawer'

// ─── helpers ────────────────────────────────────────────────────────────────

// The level form lives in components/levels/LevelDrawer so that this page and
// Super Admin → Levels cannot drift apart. The defaults page used to carry a
// cut-down copy with five of these fourteen fields.
function LevelDrawer({ level, onClose, onSaved }) {
  async function handleSave(body) {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/admin/levels/upsert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      // `id`, not `level_id`: upsert.js reads id, so an edit sent as level_id
      // was treated as a new level and created a duplicate.
      body: JSON.stringify(level?.id ? { id: level.id, ...body } : body),
    })
    const d = await res.json()
    if (!res.ok) return { error: d.error || 'Save failed' }
    onSaved()
  }

  return <SharedLevelDrawer level={level} onClose={onClose} onSave={handleSave} />
}


// ─── Main page ───────────────────────────────────────────────────────────────
export default function AdminLevels() {
  const [levels, setLevels]   = useState([])
  const [loading, setLoading] = useState(true)
  const [drawer, setDrawer]   = useState(null)   // null = closed, false = new, object = edit
  const [toast, setToast]     = useState(null)
  const [search, setSearch]   = useState('')

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 4000)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const r = await fetch('/api/admin/levels/list', { headers: { Authorization: `Bearer ${session.access_token}` } })
      const d = await r.json()
      setLevels(d.levels || [])
    } catch { setLevels([]) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function handleSaved() {
    setDrawer(null)
    showToast(drawer ? 'Level updated' : 'Level created')
    load()
  }

  const filtered = levels.filter(l => !search || l.name?.toLowerCase().includes(search.toLowerCase()))

  const TH = ({ children }) => (
    <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.3)', whiteSpace: 'nowrap' }}>{children}</th>
  )

  return (
    <AdminLayout>
      <Head><title>Player Levels — Admin</title></Head>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, background: toast.type === 'error' ? 'rgba(239,68,68,.95)' : 'rgba(34,197,94,.95)', borderRadius: 12, padding: '12px 24px', color: '#fff', fontSize: 14, fontWeight: 600, fontFamily: "'Outfit',sans-serif", whiteSpace: 'nowrap', boxShadow: '0 8px 32px rgba(0,0,0,.5)', pointerEvents: 'none' }}>
          {toast.msg}
        </div>
      )}

      {/* Drawer */}
      {drawer !== null && (
        <LevelDrawer
          level={drawer || null}
          onClose={() => setDrawer(null)}
          onSaved={handleSaved}
        />
      )}

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: "'Cinzel',serif", fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 4 }}>Player Levels</h1>
          <p style={{ color: 'rgba(255,255,255,.35)', fontSize: 13 }}>Configure tier redeem caps, multipliers & withdrawal limits</p>
        </div>
        <button onClick={() => setDrawer(false)} style={{ padding: '10px 20px', background: 'linear-gradient(135deg,#fbbf24,#f59e0b)', border: 'none', borderRadius: 10, color: '#050505', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>
          + Create Level
        </button>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 18 }}>
        <input
          type="text"
          placeholder="Search levels…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ padding: '9px 14px', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, color: '#fff', fontSize: 13, fontFamily: "'Outfit',sans-serif", outline: 'none', minWidth: 220 }}
        />
      </div>

      {/* Legend pills */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { dot: '#a78bfa', label: 'Redeem Limit & Multipliers — link to game balance' },
          { dot: '#34d399', label: 'Withdraw Limits — link to wallet balance' },
        ].map(({ dot, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'rgba(255,255,255,.4)' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: dot, flexShrink: 0 }} />
            {label}
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,.04)' }}>
                <TH>#</TH>
                <TH>Level</TH>
                <TH>XP Req.</TH>
                <TH>Max Redeem Limit</TH>
                <TH>Min Mult.</TH>
                <TH>Max Mult.</TH>
                <TH>Min Withdraw</TH>
                <TH>Max Withdraw</TH>
                <TH>Status</TH>
                <TH>Actions</TH>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} style={{ padding: 48, textAlign: 'center', color: 'rgba(255,255,255,.25)', fontSize: 14 }}>Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={10} style={{ padding: 48, textAlign: 'center', color: 'rgba(255,255,255,.25)', fontSize: 14 }}>No levels found</td></tr>
              ) : filtered.map(r => (
                <tr
                  key={r.id}
                  style={{ borderTop: '1px solid rgba(255,255,255,.04)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.025)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  {/* Sort order */}
                  <td style={{ padding: '13px 14px', fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,.3)' }}>
                    {r.sort_order ?? '—'}
                  </td>

                  {/* Level name + badge */}
                  <td style={{ padding: '13px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: r.accent_color || '#fbbf24', flexShrink: 0, boxShadow: `0 0 6px ${r.accent_color || '#fbbf24'}88` }} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 5 }}>
                          {r.badge_icon && <span>{r.badge_icon}</span>}
                          {r.name}
                        </div>
                        {r.description && <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', marginTop: 1 }}>{r.description}</div>}
                      </div>
                    </div>
                  </td>

                  {/* XP */}
                  <td style={{ padding: '13px 14px', fontSize: 12, color: 'rgba(255,255,255,.5)' }}>
                    {r.xp_required ? r.xp_required.toLocaleString() : '—'}
                  </td>

                  {/* Redeem Cap */}
                  <td style={{ padding: '13px 14px', fontSize: 12, fontWeight: 700, color: '#a78bfa' }}>
                    {fmtD(r.max_redeem_cap_cents)}
                  </td>

                  {/* Min Multiplier */}
                  <td style={{ padding: '13px 14px' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#c4b5fd', background: 'rgba(167,139,250,.12)', border: '1px solid rgba(167,139,250,.25)', borderRadius: 6, padding: '3px 8px' }}>
                      {fmtX(r.min_redeem_multiplier)}
                    </span>
                  </td>

                  {/* Max Multiplier */}
                  <td style={{ padding: '13px 14px' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#a78bfa', background: 'rgba(167,139,250,.15)', border: '1px solid rgba(167,139,250,.3)', borderRadius: 6, padding: '3px 8px' }}>
                      {fmtX(r.max_redeem_multiplier)}
                    </span>
                  </td>

                  {/* Min Withdraw */}
                  <td style={{ padding: '13px 14px', fontSize: 12, fontWeight: 600, color: '#34d399' }}>
                    {r.min_withdrawal_cents ? fmtD(r.min_withdrawal_cents) : '—'}
                  </td>

                  {/* Max Withdraw */}
                  <td style={{ padding: '13px 14px', fontSize: 12, color: '#34d399' }}>
                    {r.max_withdrawal_cents ? fmtD(r.max_withdrawal_cents) : <span style={{ color: 'rgba(255,255,255,.25)', fontStyle: 'italic' }}>Unlimited</span>}
                  </td>

                  {/* Status */}
                  <td style={{ padding: '13px 14px' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      fontSize: 10, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase',
                      padding: '3px 10px', borderRadius: 20,
                      background: r.is_active ? 'rgba(34,197,94,.12)' : 'rgba(255,255,255,.06)',
                      color:      r.is_active ? '#4ade80'              : 'rgba(255,255,255,.3)',
                      border:     `1px solid ${r.is_active ? 'rgba(34,197,94,.25)' : 'rgba(255,255,255,.1)'}`,
                    }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }} />
                      {r.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>

                  {/* Actions */}
                  <td style={{ padding: '13px 14px' }}>
                    <button
                      onClick={() => setDrawer(r)}
                      style={{ padding: '6px 14px', background: 'rgba(251,191,36,.12)', border: '1px solid rgba(251,191,36,.25)', borderRadius: 8, color: '#fbbf24', fontSize: 11, fontWeight: 800, cursor: 'pointer', fontFamily: "'Outfit',sans-serif', letterSpacing: '.03em" }}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* note: Scores renamed from Game Load */}
      <p style={{ marginTop: 14, fontSize: 11, color: 'rgba(255,255,255,.2)', fontStyle: 'italic' }}>
        Scores (formerly Game Load) have no load limits — amount is capped only by wallet balance. Redeem and Withdraw rules above apply per tier.
      </p>
    </AdminLayout>
  )
}
