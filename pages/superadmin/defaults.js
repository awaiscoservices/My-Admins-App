/**
 * pages/superadmin/defaults.js — New Casino Defaults
 *
 * What every new casino is created with. Held on the platform, not on any
 * casino, so no casino is secretly the template and deleting one changes
 * nothing about onboarding.
 *
 * Editing here does not touch casinos that already exist: they keep the
 * levels they have. This is the starting point for the next one.
 */
import { useEffect, useState, useCallback } from 'react'
import Head from 'next/head'
import SuperAdminLayout from '../../components/layout/SuperAdminLayout'
import { supabase } from '../../lib/supabase'

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

// The fields worth editing here. Every other column a level carries is kept
// exactly as it is, so this page never has to know the whole table.
const FIELDS = [
  { key: 'name',         label: 'Name',      type: 'text',   width: 150 },
  { key: 'sort_order',   label: 'Order',     type: 'number', width: 70  },
  { key: 'xp_required',  label: 'XP needed', type: 'number', width: 100 },
  { key: 'accent_color', label: 'Colour',    type: 'color',  width: 80  },
  { key: 'badge_icon',   label: 'Badge',     type: 'text',   width: 70  },
]

const inputStyle = {
  width: '100%', padding: '8px 10px', background: 'rgba(255,255,255,.06)',
  border: '1px solid rgba(255,255,255,.12)', borderRadius: 8, color: '#fff',
  fontSize: 13, fontFamily: "'Outfit',sans-serif", outline: 'none', boxSizing: 'border-box',
}

export default function SuperAdminDefaults() {
  const [levels, setLevels]   = useState([])
  const [tenants, setTenants] = useState([])
  const [importFrom, setImportFrom] = useState('')
  const [updatedAt, setUpdatedAt]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [dirty, setDirty]     = useState(false)
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
    setDirty(false)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function setField(index, key, value) {
    setLevels(prev => prev.map((l, i) => i === index ? { ...l, [key]: value } : l))
    setDirty(true)
  }

  function addLevel() {
    const nextOrder = levels.reduce((m, l) => Math.max(m, Number(l.sort_order) || 0), 0) + 1
    setLevels(prev => [...prev, {
      name: '', sort_order: nextOrder, xp_required: 0,
      accent_color: '#fbbf24', badge_icon: '', is_active: true,
    }])
    setDirty(true)
  }

  function removeLevel(index) {
    setLevels(prev => prev.filter((_, i) => i !== index))
    setDirty(true)
  }

  async function save() {
    if (levels.some(l => !String(l.name || '').trim())) { showToast('Every level needs a name', 'error'); return }
    setSaving(true)
    const res = await fetch('/api/superadmin/defaults/levels', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await freshToken()}` },
      body: JSON.stringify({ levels }),
    })
    const d = await res.json()
    setSaving(false)
    if (!res.ok) { showToast(d.error || 'Could not save', 'error'); return }
    setDirty(false)
    showToast(`Saved — new casinos start with ${d.levels.length} level${d.levels.length === 1 ? '' : 's'}`)
  }

  async function runImport() {
    if (!importFrom) { showToast('Pick a casino first', 'error'); return }
    setSaving(true)
    const res = await fetch('/api/superadmin/defaults/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await freshToken()}` },
      body: JSON.stringify({ tenant_id: importFrom }),
    })
    const d = await res.json()
    setSaving(false)
    if (!res.ok) { showToast(d.error || 'Could not copy', 'error'); return }
    setLevels(d.levels)
    setDirty(false)
    showToast(`Copied ${d.levels.length} levels and ${d.settings_copied || 0} settings from ${d.from}`)
  }

  return (
    <SuperAdminLayout>
      <Head><title>New Casino Defaults — Super Admin</title></Head>

      {toast && (
        <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 9999,
          background: toast.type === 'error' ? 'rgba(239,68,68,.95)' : 'rgba(34,197,94,.95)', borderRadius: 12,
          padding: '12px 24px', color: '#fff', fontSize: 14, fontWeight: 600, fontFamily: "'Outfit',sans-serif",
          boxShadow: '0 8px 32px rgba(0,0,0,.5)' }}>{toast.msg}</div>
      )}

      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: "'Cinzel',serif", fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
          New Casino Defaults
        </h1>
        <p style={{ color: DIM2, fontSize: 13, margin: 0 }}>
          What every new casino is created with. Held on the platform, so no casino is the template —
          deleting a casino never changes this.
        </p>
      </div>

      {/* Copy from an existing casino */}
      <div style={{ background: CARD, border: BDR, borderRadius: 14, padding: 18, marginBottom: 18 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 4 }}>Copy from a casino</div>
        <div style={{ fontSize: 12, color: DIM2, marginBottom: 12 }}>
          Fills the list below from a casino that is already set up the way you want. A one-time copy —
          that casino is not linked afterwards.
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <select value={importFrom} onChange={e => setImportFrom(e.target.value)}
            style={{ ...inputStyle, width: 'auto', minWidth: 220 }}>
            <option value="" style={{ background: '#0e1a2e' }}>Choose a casino…</option>
            {tenants.map(t => <option key={t.id} value={t.id} style={{ background: '#0e1a2e' }}>{t.name}</option>)}
          </select>
          <button onClick={runImport} disabled={saving || !importFrom}
            style={{ padding: '9px 18px', background: 'rgba(251,191,36,.15)', border: '1px solid rgba(251,191,36,.35)',
              borderRadius: 9, color: G, fontSize: 13, fontWeight: 700, cursor: saving || !importFrom ? 'default' : 'pointer',
              opacity: saving || !importFrom ? .5 : 1, fontFamily: "'Outfit',sans-serif" }}>
            Copy levels
          </button>
        </div>
      </div>

      {/* The levels */}
      <div style={{ background: CARD, border: BDR, borderRadius: 14, padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Default player levels</div>
            <div style={{ fontSize: 12, color: DIM2 }}>
              {loading ? 'Loading…'
                : levels.length === 0 ? 'None set — new casinos are created with no levels.'
                : `${levels.length} level${levels.length === 1 ? '' : 's'}${updatedAt ? ` · last changed ${new Date(updatedAt).toLocaleDateString()}` : ''}`}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={addLevel} disabled={loading}
              style={{ padding: '9px 16px', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.12)',
                borderRadius: 9, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>
              + Add level
            </button>
            <button onClick={save} disabled={saving || loading || !dirty}
              style={{ padding: '9px 20px', background: dirty ? 'linear-gradient(135deg,#fbbf24,#f59e0b)' : 'rgba(255,255,255,.06)',
                border: 'none', borderRadius: 9, color: dirty ? '#050505' : DIM, fontSize: 13, fontWeight: 800,
                cursor: saving || !dirty ? 'default' : 'pointer', fontFamily: "'Outfit',sans-serif" }}>
              {saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 30, textAlign: 'center', color: DIM2, fontSize: 13 }}>Loading…</div>
        ) : levels.length === 0 ? (
          <div style={{ padding: 30, textAlign: 'center', color: DIM2, fontSize: 13 }}>
            No default levels yet. Copy them from a casino above, or add them one at a time.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 620 }}>
              <thead>
                <tr>
                  {FIELDS.map(f => (
                    <th key={f.key} style={{ padding: '8px 8px 10px', textAlign: 'left', fontSize: 10, fontWeight: 800,
                      letterSpacing: '.09em', textTransform: 'uppercase', color: DIM2, width: f.width }}>{f.label}</th>
                  ))}
                  <th style={{ width: 44 }} />
                </tr>
              </thead>
              <tbody>
                {levels.map((level, i) => (
                  <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,.05)' }}>
                    {FIELDS.map(f => (
                      <td key={f.key} style={{ padding: '7px 8px' }}>
                        {f.type === 'color' ? (
                          <input type="color" value={level.accent_color || '#fbbf24'}
                            onChange={e => setField(i, 'accent_color', e.target.value)}
                            style={{ width: 44, height: 34, borderRadius: 8, border: '1px solid rgba(255,255,255,.12)', background: 'none', cursor: 'pointer', padding: 3 }} />
                        ) : (
                          <input type={f.type} value={level[f.key] ?? ''}
                            onChange={e => setField(i, f.key, f.type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)}
                            style={inputStyle} />
                        )}
                      </td>
                    ))}
                    <td style={{ padding: '7px 8px', textAlign: 'right' }}>
                      <button onClick={() => removeLevel(i)} title="Remove this level"
                        style={{ background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 8,
                          color: '#f87171', fontSize: 12, fontWeight: 800, cursor: 'pointer', padding: '6px 10px' }}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ marginTop: 14, fontSize: 12, color: DIM2 }}>
          Changing this does not affect casinos that already exist — they keep the levels they have.
          Any column a level carries beyond the five shown here is kept as it is.
        </div>
      </div>
    </SuperAdminLayout>
  )
}
