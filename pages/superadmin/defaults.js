/**
 * pages/superadmin/defaults.js — Super Admin → Defaults
 *
 * What every new casino is created with: player levels, games, payment
 * methods, referral tiers and settings.
 *
 * These belong to the platform, not to a casino. The first casino used to be
 * the template, which nobody could see and which meant deleting it would have
 * quietly stopped every future casino getting anything.
 *
 * The page also shows which existing casinos are missing which pieces, and
 * fills the gaps — four of five casinos had no games, no payment methods and
 * no referral tiers, so they could not take a deposit or set up a game.
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

async function freshToken() {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token || null
}

/** One line describing a stored row, per kind. */
function describe(key, row) {
  switch (key) {
    case 'player_levels':
      return `${row.name} · ${fmtX(row.max_redeem_multiplier ?? row.redeem_multiplier)} · cap ${fmtD(row.max_redeem_cap_cents)}`
    case 'game_panels':
      return row.name
    case 'payment_methods':
      return `${row.name} · ${String(row.type || '').replace(/_/g, ' ')}`
    case 'referral_bonus_tiers':
      return `Deposit ${row.deposit_number} · ${row.bonus_percent}%`
    case 'platform_settings':
      return `${row.key} = ${row.value}`
    default:
      return JSON.stringify(row).slice(0, 60)
  }
}

export default function SuperAdminDefaults() {
  const [sets, setSets]         = useState({})
  const [kinds, setKinds]       = useState([])
  const [coverage, setCoverage] = useState([])
  const [tab, setTab]           = useState('player_levels')
  const [importFrom, setImportFrom] = useState('')
  const [loading, setLoading]   = useState(true)
  const [busy, setBusy]         = useState(false)
  const [drawer, setDrawer]     = useState(null)
  const [toast, setToast]       = useState(null)

  function showToast(msg, type = 'success') { setToast({ msg, type }); setTimeout(() => setToast(null), 6000) }

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/superadmin/defaults/sets', { headers: { Authorization: `Bearer ${await freshToken()}` } })
    const d = await res.json()
    if (!res.ok) showToast(d.error || 'Could not load defaults', 'error')
    setSets(d.sets || {})
    setKinds(d.kinds || [])
    setCoverage(d.coverage || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function saveRows(key, rows, message) {
    setBusy(true)
    const res = await fetch('/api/superadmin/defaults/sets', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await freshToken()}` },
      body: JSON.stringify({ key, rows }),
    })
    const d = await res.json()
    setBusy(false)
    if (!res.ok) return { error: d.error || 'Could not save' }
    await load()
    if (message) showToast(message)
    return {}
  }

  async function copyFromCasino() {
    if (!importFrom) { showToast('Pick a casino first', 'error'); return }
    setBusy(true)
    const res = await fetch('/api/superadmin/defaults/sets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await freshToken()}` },
      body: JSON.stringify({ from_tenant_id: importFrom }),
    })
    const d = await res.json()
    setBusy(false)
    if (!res.ok) { showToast(d.error || 'Could not copy', 'error'); return }
    const total = Object.values(d.copied || {}).reduce((s, r) => s + (r.count || 0), 0)
    showToast(`Copied ${total} rows from ${d.from}`)
    load()
  }

  async function applyToCasinos(tenantId) {
    setBusy(true)
    const res = await fetch('/api/superadmin/defaults/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await freshToken()}` },
      body: JSON.stringify(tenantId ? { tenant_id: tenantId } : {}),
    })
    const d = await res.json()
    setBusy(false)
    if (!res.ok) { showToast(d.error || 'Could not apply', 'error'); return }
    const added = (d.results || []).reduce((s, r) => s + r.added, 0)
    showToast(added ? `Added ${added} rows across ${d.results.length} casino${d.results.length === 1 ? '' : 's'}` : 'Nothing was missing')
    load()
  }

  // The level editor is the same drawer the per-casino page uses.
  async function saveLevelFromDrawer(body) {
    const rows = sets.player_levels?.rows || []
    const editing = drawer && drawer.__index != null
    const next = editing
      ? rows.map((l, i) => i === drawer.__index ? { ...l, ...body } : l)
      : [...rows, body]
    const sorted = [...next].sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0))
    const result = await saveRows('player_levels', sorted, editing ? 'Level updated' : 'Level added')
    if (result.error) return result
    setDrawer(null)
  }

  async function removeRow(key, index, name) {
    if (!window.confirm(`Remove "${name}" from the defaults? Casinos that already exist keep what they have.`)) return
    const rows = (sets[key]?.rows || []).filter((_, i) => i !== index)
    const r = await saveRows(key, rows, 'Removed')
    if (r.error) showToast(r.error, 'error')
  }

  const current = sets[tab] || { rows: [] }
  const th = { padding: '9px 12px', textAlign: 'left', fontSize: 10, fontWeight: 800, letterSpacing: '.09em', textTransform: 'uppercase', color: DIM2, whiteSpace: 'nowrap' }
  const td = { padding: '10px 12px', fontSize: 12.5, color: 'rgba(255,255,255,.7)' }

  return (
    <SuperAdminLayout>
      <Head><title>Defaults — Super Admin</title></Head>

      {toast && (
        <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, maxWidth: '90vw',
          background: toast.type === 'error' ? 'rgba(239,68,68,.95)' : 'rgba(34,197,94,.95)', borderRadius: 12,
          padding: '12px 24px', color: '#fff', fontSize: 14, fontWeight: 600, fontFamily: "'Outfit',sans-serif",
          boxShadow: '0 8px 32px rgba(0,0,0,.5)' }}>{toast.msg}</div>
      )}

      {drawer && (
        <LevelDrawer level={drawer} subtitle="Default for new casinos"
          onClose={() => setDrawer(null)} onSave={saveLevelFromDrawer} />
      )}

      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: "'Cinzel',serif", fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 4 }}>Defaults</h1>
        <p style={{ color: DIM2, fontSize: 13, margin: 0 }}>
          What every new casino is created with. Held on the platform, so no casino is the template —
          deleting a casino never changes this.
        </p>
      </div>

      {/* Copy everything from one casino */}
      <div style={{ background: CARD, border: BDR, borderRadius: 14, padding: 18, marginBottom: 18 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 4 }}>Copy from a casino</div>
        <div style={{ fontSize: 12, color: DIM2, marginBottom: 12 }}>
          Replaces all five sets below with that casino’s configuration. A one-time copy — the casino
          is not linked afterwards and can be changed or deleted freely.
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <select value={importFrom} onChange={e => setImportFrom(e.target.value)}
            style={{ padding: '9px 12px', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 9, color: '#fff', fontSize: 13, fontFamily: "'Outfit',sans-serif", outline: 'none', minWidth: 220 }}>
            <option value="" style={{ background: '#0e1a2e' }}>Choose a casino…</option>
            {coverage.map(t => <option key={t.id} value={t.id} style={{ background: '#0e1a2e' }}>{t.name}</option>)}
          </select>
          <button onClick={copyFromCasino} disabled={busy || !importFrom}
            style={{ padding: '9px 18px', background: 'rgba(251,191,36,.15)', border: '1px solid rgba(251,191,36,.35)', borderRadius: 9, color: G, fontSize: 13, fontWeight: 700, cursor: busy || !importFrom ? 'default' : 'pointer', opacity: busy || !importFrom ? .5 : 1, fontFamily: "'Outfit',sans-serif" }}>
            Copy everything
          </button>
        </div>
      </div>

      {/* What each casino is missing */}
      <div style={{ background: CARD, border: BDR, borderRadius: 14, overflow: 'hidden', marginBottom: 18 }}>
        <div style={{ padding: '14px 18px', borderBottom: BDR, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>What each casino has</div>
            <div style={{ fontSize: 12, color: DIM2 }}>A zero means that casino cannot use the feature at all.</div>
          </div>
          <button onClick={() => applyToCasinos(null)} disabled={busy || loading}
            style={{ padding: '9px 18px', background: 'linear-gradient(135deg,#fbbf24,#f59e0b)', border: 'none', borderRadius: 9, color: '#050505', fontSize: 13, fontWeight: 800, cursor: busy ? 'default' : 'pointer', fontFamily: "'Outfit',sans-serif" }}>
            Fill every gap
          </button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 620 }}>
            <thead><tr style={{ background: 'rgba(255,255,255,.03)' }}>
              <th style={th}>Casino</th>
              {kinds.map(k => <th key={k.key} style={{ ...th, textAlign: 'center' }}>{k.label}</th>)}
              <th style={th} />
            </tr></thead>
            <tbody>
              {coverage.map(t => (
                <tr key={t.id} style={{ borderTop: '1px solid rgba(255,255,255,.05)' }}>
                  <td style={{ ...td, color: '#fff', fontWeight: 700 }}>{t.name}</td>
                  {kinds.map(k => (
                    <td key={k.key} style={{ ...td, textAlign: 'center', color: t.counts[k.key] ? '#22c55e' : '#ef4444', fontWeight: 800 }}>
                      {t.counts[k.key]}
                    </td>
                  ))}
                  <td style={{ ...td, textAlign: 'right' }}>
                    <button onClick={() => applyToCasinos(t.id)} disabled={busy}
                      style={{ padding: '5px 11px', background: 'rgba(251,191,36,.12)', border: '1px solid rgba(251,191,36,.3)', borderRadius: 8, color: G, fontSize: 11, fontWeight: 800, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>
                      Fill
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* The sets themselves */}
      <div style={{ display: 'flex', gap: 5, background: 'rgba(255,255,255,.04)', padding: 5, borderRadius: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        {kinds.map(k => (
          <button key={k.key} onClick={() => setTab(k.key)}
            style={{ padding: '9px 18px', borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: "'Outfit',sans-serif", fontSize: 13, fontWeight: 700,
              background: tab === k.key ? 'linear-gradient(135deg,#f59e0b,#fbbf24)' : 'transparent',
              color: tab === k.key ? '#050505' : DIM }}>
            {k.label} ({sets[k.key]?.rows?.length || 0})
          </button>
        ))}
      </div>

      <div style={{ background: CARD, border: BDR, borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '13px 18px', borderBottom: BDR, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ fontSize: 12.5, color: DIM }}>
            {loading ? 'Loading…' : `${current.rows.length} row${current.rows.length === 1 ? '' : 's'}`}
          </div>
          {tab === 'player_levels' && (
            <button onClick={() => setDrawer({})}
              style={{ padding: '8px 16px', background: 'rgba(251,191,36,.15)', border: '1px solid rgba(251,191,36,.35)', borderRadius: 9, color: G, fontSize: 12.5, fontWeight: 800, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>
              + Add level
            </button>
          )}
        </div>

        {!loading && current.rows.length === 0 ? (
          <div style={{ padding: 36, textAlign: 'center', color: DIM2, fontSize: 13 }}>
            Nothing set. Use “Copy from a casino” above to fill this in.
          </div>
        ) : (
          current.rows.map((row, i) => (
            <div key={i} style={{ padding: '11px 18px', borderTop: '1px solid rgba(255,255,255,.04)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,.8)' }}>{describe(tab, row)}</span>
              <span style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                {tab === 'player_levels' && (
                  <button onClick={() => setDrawer({ ...row, __index: i })}
                    style={{ padding: '5px 11px', background: 'rgba(251,191,36,.12)', border: '1px solid rgba(251,191,36,.3)', borderRadius: 8, color: G, fontSize: 11, fontWeight: 800, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>
                    Edit
                  </button>
                )}
                <button onClick={() => removeRow(tab, i, describe(tab, row))}
                  style={{ padding: '5px 9px', background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 8, color: '#f87171', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>
                  ✕
                </button>
              </span>
            </div>
          ))
        )}
      </div>

      <p style={{ marginTop: 14, fontSize: 12, color: DIM2 }}>
        Changing a default does not affect casinos that already exist — they keep what they have.
        Use Fill to give a casino only what it is missing.
      </p>
    </SuperAdminLayout>
  )
}
