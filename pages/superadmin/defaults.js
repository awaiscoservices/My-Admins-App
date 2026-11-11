/**
 * pages/superadmin/defaults.js — Super Admin → Levels
 *
 * The player levels every new casino is created with. They are held on the
 * platform, not on any casino, so no casino is secretly the template and
 * deleting one changes nothing about onboarding.
 *
 * The editor is components/levels/LevelDrawer — the same form the per-casino
 * Player Levels page uses, so a default level can be given everything a real
 * level has: redeem rules, withdraw limits, KYC, the lot.
 *
 * Editing here does not touch casinos that already exist. They keep the
 * levels they have.
 */
import { useEffect, useState, useCallback } from 'react'
import Head from 'next/head'
import SuperAdminLayout from '../../components/layout/SuperAdminLayout'
import { supabase } from '../../lib/supabase'
import LevelDrawer, { fmtD, fmtX } from '../../components/levels/LevelDrawer'

const G    = '#fbbf24'
const DIM  = 'rgba(255,255,255,.45)'
const DIM2 = 'rgba(255,255,255,.3)'
const CARD = 'rgba(255,255,255,.03)'
const BDR  = '1px solid rgba(255,255,255,.08)'

// Tokens expire while a page is open, so every request takes a fresh one.
async function freshToken() {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token || null
}

export default function SuperAdminLevels() {
  const [levels, setLevels]   = useState([])
  const [tenants, setTenants] = useState([])
  const [importFrom, setImportFrom] = useState('')
  const [updatedAt, setUpdatedAt]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy]       = useState(false)
  const [drawer, setDrawer]   = useState(null)   // null = closed, {} = new, object = edit
  const [toast, setToast]     = useState(null)

  function showToast(msg, type = 'success') { setToast({ msg, type }); setTimeout(() => setToast(null), 4500) }

  const load = useCallback(async () => {
    setLoading(true)
    const token = await freshToken()
    const [lv, tn] = await Promise.all([
      fetch('/api/superadmin/defaults/levels', { headers: { Authorization: `Bearer ${token}` } }),
      fetch('/api/superadmin/tenants/list?limit=100', { headers: { Authorization: `Bearer ${token}` } }),
    ])
    const lvd = await lv.json()
    const tnd = await tn.json()
    if (!lv.ok) showToast(lvd.error || 'Could not load the defaults', 'error')
    setLevels(Array.isArray(lvd.levels) ? lvd.levels : [])
    setUpdatedAt(lvd.updated_at || null)
    setTenants(tnd.tenants || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  /** Write the whole list back. Returns { error } so the drawer can show it. */
  async function persist(next, message) {
    setBusy(true)
    const res = await fetch('/api/superadmin/defaults/levels', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await freshToken()}` },
      body: JSON.stringify({ levels: next }),
    })
    const d = await res.json()
    setBusy(false)
    if (!res.ok) return { error: d.error || 'Could not save' }
    setLevels(d.levels)
    setUpdatedAt(new Date().toISOString())
    if (message) showToast(message)
    return {}
  }

  // The drawer hands back only the fields it edits, so anything else the
  // level carries is kept by spreading the original first.
  async function saveFromDrawer(body) {
    const editing = drawer && drawer.__index != null
    const next = editing
      ? levels.map((l, i) => i === drawer.__index ? { ...l, ...body } : l)
      : [...levels, body]

    const sorted = [...next].sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0))
    const result = await persist(sorted, editing ? 'Level updated' : 'Level added')
    if (result.error) return result
    setDrawer(null)
  }

  async function removeLevel(index) {
    const name = levels[index]?.name || 'this level'
    if (!window.confirm(`Remove "${name}" from the defaults? Casinos that already exist keep their levels — this only changes what the next new casino starts with.`)) return
    const result = await persist(levels.filter((_, i) => i !== index), 'Level removed')
    if (result.error) showToast(result.error, 'error')
  }

  async function runImport() {
    if (!importFrom) { showToast('Pick a casino first', 'error'); return }
    setBusy(true)
    const res = await fetch('/api/superadmin/defaults/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await freshToken()}` },
      body: JSON.stringify({ tenant_id: importFrom }),
    })
    const d = await res.json()
    setBusy(false)
    if (!res.ok) { showToast(d.error || 'Could not copy', 'error'); return }
    setLevels(d.levels)
    setUpdatedAt(new Date().toISOString())
    showToast(`Copied ${d.levels.length} levels and ${d.settings_copied || 0} settings from ${d.from}`)
  }

  const th = { padding: '10px 12px', textAlign: 'left', fontSize: 10, fontWeight: 800, letterSpacing: '.09em', textTransform: 'uppercase', color: DIM2, whiteSpace: 'nowrap' }
  const td = { padding: '12px', fontSize: 12.5, color: 'rgba(255,255,255,.65)', whiteSpace: 'nowrap' }

  return (
    <SuperAdminLayout>
      <Head><title>Levels — Super Admin</title></Head>

      {toast && (
        <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 9999,
          background: toast.type === 'error' ? 'rgba(239,68,68,.95)' : 'rgba(34,197,94,.95)', borderRadius: 12,
          padding: '12px 24px', color: '#fff', fontSize: 14, fontWeight: 600, fontFamily: "'Outfit',sans-serif",
          boxShadow: '0 8px 32px rgba(0,0,0,.5)' }}>{toast.msg}</div>
      )}

      {drawer && (
        <LevelDrawer
          level={drawer}
          subtitle="Default for new casinos"
          onClose={() => setDrawer(null)}
          onSave={saveFromDrawer}
        />
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: "'Cinzel',serif", fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 4 }}>Levels</h1>
          <p style={{ color: DIM2, fontSize: 13, margin: 0 }}>
            The player levels every new casino is created with. Held on the platform, so no casino is the
            template — deleting a casino never changes this.
          </p>
        </div>
        <button onClick={() => setDrawer({})} disabled={loading}
          style={{ padding: '10px 20px', background: 'linear-gradient(135deg,#fbbf24,#f59e0b)', border: 'none',
            borderRadius: 10, color: '#050505', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>
          + Add Level
        </button>
      </div>

      {/* Copy from an existing casino */}
      <div style={{ background: CARD, border: BDR, borderRadius: 14, padding: 18, marginBottom: 18 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 4 }}>Copy from a casino</div>
        <div style={{ fontSize: 12, color: DIM2, marginBottom: 12 }}>
          Replaces the list below with that casino’s levels, and copies its settings too. A one-time copy —
          the casino is not linked afterwards, so it can be changed or deleted freely.
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <select value={importFrom} onChange={e => setImportFrom(e.target.value)}
            style={{ padding: '9px 12px', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.12)',
              borderRadius: 9, color: '#fff', fontSize: 13, fontFamily: "'Outfit',sans-serif", outline: 'none', minWidth: 220 }}>
            <option value="" style={{ background: '#0e1a2e' }}>Choose a casino…</option>
            {tenants.map(t => <option key={t.id} value={t.id} style={{ background: '#0e1a2e' }}>{t.name}</option>)}
          </select>
          <button onClick={runImport} disabled={busy || !importFrom}
            style={{ padding: '9px 18px', background: 'rgba(251,191,36,.15)', border: '1px solid rgba(251,191,36,.35)',
              borderRadius: 9, color: G, fontSize: 13, fontWeight: 700, cursor: busy || !importFrom ? 'default' : 'pointer',
              opacity: busy || !importFrom ? .5 : 1, fontFamily: "'Outfit',sans-serif" }}>
            Copy levels
          </button>
        </div>
      </div>

      {/* The levels */}
      <div style={{ background: CARD, border: BDR, borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: BDR, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Default player levels</div>
          <div style={{ fontSize: 12, color: DIM2 }}>
            {loading ? 'Loading…'
              : levels.length === 0 ? 'None set — new casinos start with no levels'
              : `${levels.length} level${levels.length === 1 ? '' : 's'}${updatedAt ? ` · last changed ${new Date(updatedAt).toLocaleDateString()}` : ''}`}
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: DIM2, fontSize: 13 }}>Loading…</div>
        ) : levels.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: DIM2, fontSize: 13 }}>
            No default levels yet. Copy them from a casino above, or add them one at a time.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 860 }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,.03)' }}>
                  {['Level', 'Order', 'XP', 'Redeem Cap', 'Multiplier', 'Withdraw', 'KYC', 'Status', ''].map((h, i) => (
                    <th key={i} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {levels.map((l, i) => (
                  <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,.05)' }}>
                    <td style={{ ...td, color: '#fff', fontWeight: 700 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: l.accent_color || G, display: 'inline-block' }} />
                        {l.badge_icon ? `${l.badge_icon} ` : ''}{l.name || <em style={{ color: DIM2 }}>Unnamed</em>}
                      </span>
                    </td>
                    <td style={td}>{l.sort_order ?? '—'}</td>
                    <td style={td}>{l.xp_required ?? 0}</td>
                    <td style={td}>{fmtD(l.max_redeem_cap_cents)}</td>
                    <td style={td}>{fmtX(l.min_redeem_multiplier)} – {fmtX(l.max_redeem_multiplier)}</td>
                    <td style={td}>{fmtD(l.min_withdrawal_cents)} – {l.max_withdrawal_cents != null ? fmtD(l.max_withdrawal_cents) : '∞'}</td>
                    <td style={td}>{l.kyc_required ? 'Required' : '—'}</td>
                    <td style={td}>
                      <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 99,
                        background: l.is_active === false ? 'rgba(255,255,255,.08)' : 'rgba(34,197,94,.15)',
                        color: l.is_active === false ? DIM : '#22c55e' }}>
                        {l.is_active === false ? 'INACTIVE' : 'ACTIVE'}
                      </span>
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <button onClick={() => setDrawer({ ...l, __index: i })}
                        style={{ padding: '6px 12px', background: 'rgba(251,191,36,.15)', border: '1px solid rgba(251,191,36,.3)',
                          borderRadius: 8, color: G, fontSize: 11, fontWeight: 800, cursor: 'pointer', fontFamily: "'Outfit',sans-serif", marginRight: 6 }}>
                        Edit
                      </button>
                      <button onClick={() => removeLevel(i)} title="Remove from the defaults"
                        style={{ padding: '6px 10px', background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.3)',
                          borderRadius: 8, color: '#f87171', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p style={{ marginTop: 14, fontSize: 12, color: DIM2 }}>
        Changing this does not affect casinos that already exist — they keep the levels they have.
      </p>
    </SuperAdminLayout>
  )
}
