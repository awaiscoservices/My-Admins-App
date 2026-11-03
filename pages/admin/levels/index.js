/**
 * /admin/levels
 *
 * Super Admin — Full Player Levels Config
 * All 9 tiers, all fields, inline edit per tier.
 */
import { useEffect, useState } from 'react'
import Head from 'next/head'
import { supabase } from '../../../lib/supabase'
import AdminLayout from '../../../components/layout/AdminLayout'

// Dollar fields (stored as cents)
const CENT_FIELDS = new Set([
  'min_deposit_cents','max_deposit_cents',
  'min_withdrawal_cents','max_withdrawal_cents',
  'min_game_load_cents','max_game_load_cents',
  'min_redeem_cents','max_redeem_cents',
  'daily_withdrawal_limit_cents','max_daily_withdrawal_cents',
  'referral_bonus_cents','deposit_threshold_cents',
])

// Section groups for edit form
const FIELD_GROUPS = [
  {
    title: 'XP & Progression',
    fields: [
      { key: 'min_xp',               label: 'Min XP',                type: 'number' },
      { key: 'deposit_threshold_cents', label: 'Deposit Threshold ($)', type: 'cents'  },
    ],
  },
  {
    title: 'Deposit',
    fields: [
      { key: 'min_deposit_cents',   label: 'Min Deposit ($)',   type: 'cents'  },
      { key: 'max_deposit_cents',   label: 'Max Deposit ($)',   type: 'cents'  },
      { key: 'deposit_bonus_pct',   label: 'Deposit Bonus %',   type: 'number', step: '0.5' },
    ],
  },
  {
    title: 'Withdrawal',
    fields: [
      { key: 'min_withdrawal_cents',        label: 'Min Withdrawal ($)',      type: 'cents' },
      { key: 'max_withdrawal_cents',        label: 'Max Withdrawal ($)',      type: 'cents' },
      { key: 'daily_withdrawal_limit_cents',label: 'Daily Limit ($)',         type: 'cents' },
    ],
  },
  {
    title: 'Game Load (Scores)',
    fields: [
      { key: 'min_game_load_cents', label: 'Min Load ($)',  type: 'cents' },
      { key: 'max_game_load_cents', label: 'Max Load ($)',  type: 'cents' },
    ],
  },
  {
    title: 'Redeem',
    fields: [
      { key: 'min_redeem_cents',    label: 'Min Redeem ($)',     type: 'cents'  },
      { key: 'max_redeem_cents',    label: 'Max Redeem ($)',     type: 'cents'  },
      { key: 'redeem_multiplier',   label: 'Redeem Multiplier',  type: 'number', step: '0.5' },
    ],
  },
  {
    title: 'Bonuses & Perks',
    fields: [
      { key: 'bonus_to_cash_pct',   label: 'Bonus → Cash %',    type: 'number', step: '0.5' },
      { key: 'referral_bonus_cents',label: 'Referral Bonus ($)', type: 'cents'  },
    ],
  },
  {
    title: 'Requirements & Misc',
    fields: [
      { key: 'kyc_required',   label: 'KYC Required',    type: 'boolean' },
      { key: 'accent_color',   label: 'Accent Color',    type: 'color'   },
      { key: 'description',    label: 'Description',     type: 'text'    },
    ],
  },
]

function centsToDisplay(cents) {
  return ((cents || 0) / 100).toFixed(2)
}
function displayToCents(val) {
  return Math.round((parseFloat(val) || 0) * 100)
}
function fmt(cents) {
  return `$${((cents || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
}

export default function AdminLevels() {
  const [levels,  setLevels]  = useState([])
  const [editing, setEditing] = useState(null)
  const [draft,   setDraft]   = useState({})
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')
  const [toast,   setToast]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [isSA,    setIsSA]    = useState(false)

  useEffect(() => { load() }, [])

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  async function load() {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setLoading(false); return }
    const { data: p } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
    setIsSA(p?.role === 'super_admin')
    const res = await fetch('/api/admin/levels', {
      headers: { Authorization: `Bearer ${session.access_token}` }
    })
    const json = await res.json()
    setLevels(json.levels || [])
    setLoading(false)
  }

  function startEdit(level) {
    // Build draft — convert cents to display dollars where needed
    const d = {}
    for (const [k, v] of Object.entries(level)) {
      if (CENT_FIELDS.has(k)) d[k] = centsToDisplay(v)
      else d[k] = v
    }
    setDraft(d)
    setEditing(level.id)
    setError('')
  }

  function cancelEdit() { setEditing(null); setDraft({}); setError('') }

  function setField(key, val) {
    setDraft(prev => ({ ...prev, [key]: val }))
  }

  async function saveEdit(levelId) {
    setSaving(true); setError('')
    // Convert dollar-display back to cents
    const payload = { id: levelId }
    for (const [k, v] of Object.entries(draft)) {
      if (k === 'id' || k === 'name' || k === 'created_at' || k === 'sort_order') continue
      if (CENT_FIELDS.has(k)) payload[k] = displayToCents(v)
      else if (k === 'min_xp' || k === 'xp_required') payload[k] = parseInt(v) || 0
      else if (k === 'redeem_multiplier' || k === 'deposit_bonus_pct' || k === 'bonus_to_cash_pct') payload[k] = parseFloat(v) || 0
      else payload[k] = v
    }
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/admin/levels', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify(payload),
    })
    const json = await res.json()
    setSaving(false)
    if (!res.ok) { setError(json.error); return }
    showToast(`${json.level.name} updated`)
    setEditing(null)
    load()
  }

  return (
    <AdminLayout>
      <Head><title>Player Levels — Admin</title></Head>

      {toast && (
        <div style={{ position:'fixed', top:16, left:'50%', transform:'translateX(-50%)', zIndex:9999,
          background: toast.type==='error'?'rgba(239,68,68,.95)':'rgba(34,197,94,.95)',
          borderRadius:12, padding:'12px 24px', color:'#fff', fontSize:14, fontWeight:600,
          fontFamily:"'Outfit',sans-serif", whiteSpace:'nowrap', boxShadow:'0 8px 32px rgba(0,0,0,.5)' }}>
          {toast.msg}
        </div>
      )}

      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontFamily:"'Cinzel',serif", fontSize:22, fontWeight:700, color:'#fff', margin:0 }}>Player Levels</h1>
        <p style={{ color:'rgba(255,255,255,.35)', fontSize:13, marginTop:4 }}>
          {isSA ? 'Edit any tier — click a row to expand all fields' : 'View only — super admin required to edit'}
        </p>
      </div>

      {loading ? (
        <div style={{ padding:60, textAlign:'center', color:'rgba(255,255,255,.3)' }}>Loading…</div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {levels.map(level => {
            const isEdit = editing === level.id
            const accent = level.accent_color || '#fbbf24'

            return (
              <div key={level.id} style={{
                background:   'rgba(255,255,255,.02)',
                border:       `1px solid ${isEdit ? accent+'55' : 'rgba(255,255,255,.07)'}`,
                borderRadius: 16,
                overflow:     'hidden',
                transition:   'border-color .2s',
              }}>
                {/* ── Summary row (always visible) ── */}
                <div style={{ display:'flex', alignItems:'center', gap:14, padding:'16px 20px', cursor: isSA ? 'pointer' : 'default' }}
                  onClick={() => isSA && (isEdit ? cancelEdit() : startEdit(level))}>

                  {/* Badge */}
                  <div style={{ width:40, height:40, borderRadius:'50%', flexShrink:0,
                    background:`linear-gradient(135deg,${accent},${accent}77)`,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:15, fontWeight:900, color:'#000', fontFamily:"'Cinzel',serif",
                    boxShadow:`0 0 16px ${accent}40` }}>
                    {level.name[0]}
                  </div>

                  {/* Name + XP */}
                  <div style={{ minWidth:100 }}>
                    <div style={{ fontSize:14, fontWeight:800, color:'#fff', fontFamily:"'Cinzel',serif" }}>{level.name}</div>
                    <div style={{ fontSize:11, color:'rgba(255,255,255,.35)', marginTop:2 }}>{Number(level.min_xp).toLocaleString()} XP</div>
                  </div>

                  {/* Key stats */}
                  <div style={{ display:'flex', gap:16, flex:1, flexWrap:'wrap', justifyContent:'flex-start' }}>
                    <SumStat label="Dep. Bonus"   value={`${parseFloat(level.deposit_bonus_pct)}%`} />
                    <SumStat label="Daily Limit"  value={fmt(level.daily_withdrawal_limit_cents)} />
                    <SumStat label="Multiplier"   value={`${parseFloat(level.redeem_multiplier)}×`} />
                    <SumStat label="Bonus→Cash"   value={`${parseFloat(level.bonus_to_cash_pct)}%`} />
                    <SumStat label="Max Load"     value={fmt(level.max_game_load_cents)} />
                    <SumStat label="Max Redeem"   value={fmt(level.max_redeem_cents)} />
                    <SumStat label="Referral"     value={fmt(level.referral_bonus_cents)} />
                    <SumStat label="KYC"          value={level.kyc_required ? '✓ Yes' : '—'} />
                  </div>

                  {isSA && (
                    <div style={{ padding:'6px 14px', background: isEdit ? `${accent}22` : 'rgba(255,255,255,.05)',
                      border:`1px solid ${isEdit ? accent+'55' : 'rgba(255,255,255,.1)'}`, borderRadius:8,
                      color: isEdit ? accent : 'rgba(255,255,255,.4)', fontSize:12, fontWeight:800,
                      fontFamily:"'Outfit',sans-serif", flexShrink:0 }}>
                      {isEdit ? 'Close ▲' : 'Edit ▼'}
                    </div>
                  )}
                </div>

                {/* ── Full edit form ── */}
                {isEdit && (
                  <div style={{ borderTop:`1px solid rgba(255,255,255,.07)`, padding:'20px 20px 24px' }}>
                    {error && (
                      <div style={{ marginBottom:16, padding:'10px 14px', background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.3)', borderRadius:8, color:'#f87171', fontSize:13 }}>
                        ⚠ {error}
                      </div>
                    )}

                    {FIELD_GROUPS.map(group => (
                      <div key={group.title} style={{ marginBottom:20 }}>
                        <div style={{ fontSize:10, fontWeight:800, letterSpacing:'.12em', textTransform:'uppercase',
                          color: accent, marginBottom:10, paddingBottom:6,
                          borderBottom:`1px solid ${accent}22` }}>
                          {group.title}
                        </div>
                        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(160px, 1fr))', gap:10 }}>
                          {group.fields.map(f => (
                            <EditField
                              key={f.key}
                              label={f.label}
                              type={f.type}
                              step={f.step}
                              value={draft[f.key] ?? ''}
                              onChange={val => setField(f.key, val)}
                            />
                          ))}
                        </div>
                      </div>
                    ))}

                    <div style={{ display:'flex', gap:10, marginTop:4 }}>
                      <button onClick={() => saveEdit(level.id)} disabled={saving}
                        style={{ padding:'11px 24px', background:`linear-gradient(135deg,${accent},${accent}cc)`,
                          border:'none', borderRadius:10, color:'#000', fontSize:13, fontWeight:800,
                          cursor:'pointer', fontFamily:"'Outfit',sans-serif" }}>
                        {saving ? 'Saving…' : `Save ${level.name}`}
                      </button>
                      <button onClick={cancelEdit}
                        style={{ padding:'11px 16px', background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.1)',
                          borderRadius:10, color:'rgba(255,255,255,.4)', fontSize:13, cursor:'pointer',
                          fontFamily:"'Outfit',sans-serif" }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </AdminLayout>
  )
}

function SumStat({ label, value }) {
  return (
    <div>
      <div style={{ fontSize:9, fontWeight:800, letterSpacing:'.08em', textTransform:'uppercase', color:'rgba(255,255,255,.28)', marginBottom:2 }}>{label}</div>
      <div style={{ fontSize:12, fontWeight:700, color:'rgba(255,255,255,.75)' }}>{value}</div>
    </div>
  )
}

function EditField({ label, type, step, value, onChange }) {
  if (type === 'boolean') {
    return (
      <div>
        <label style={{ display:'block', fontSize:10, fontWeight:800, letterSpacing:'.1em', textTransform:'uppercase', color:'rgba(255,255,255,.35)', marginBottom:6 }}>{label}</label>
        <div style={{ display:'flex', gap:8 }}>
          {[true, false].map(v => (
            <button key={String(v)} onClick={() => onChange(v)}
              style={{ flex:1, padding:'8px 0', borderRadius:8, border: value === v ? '1px solid #6366f1' : '1px solid rgba(255,255,255,.1)',
                background: value === v ? 'rgba(99,102,241,.2)' : 'rgba(255,255,255,.04)',
                color: value === v ? '#818cf8' : 'rgba(255,255,255,.4)',
                fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:"'Outfit',sans-serif" }}>
              {v ? 'Yes' : 'No'}
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (type === 'color') {
    return (
      <div>
        <label style={{ display:'block', fontSize:10, fontWeight:800, letterSpacing:'.1em', textTransform:'uppercase', color:'rgba(255,255,255,.35)', marginBottom:6 }}>{label}</label>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <input type="color" value={value || '#fbbf24'} onChange={e => onChange(e.target.value)}
            style={{ width:36, height:36, borderRadius:8, border:'none', cursor:'pointer', padding:2, background:'none' }} />
          <input type="text" value={value || ''} onChange={e => onChange(e.target.value)}
            style={{ flex:1, padding:'8px 10px', background:'rgba(255,255,255,.07)', border:'1px solid rgba(255,255,255,.12)',
              borderRadius:8, color:'#fff', fontSize:12, fontFamily:"'Outfit',sans-serif", outline:'none' }} />
        </div>
      </div>
    )
  }

  return (
    <div>
      <label style={{ display:'block', fontSize:10, fontWeight:800, letterSpacing:'.1em', textTransform:'uppercase', color:'rgba(255,255,255,.35)', marginBottom:6 }}>{label}</label>
      <input
        type={type === 'cents' ? 'number' : type}
        step={step || (type === 'cents' ? '0.01' : '1')}
        min={type === 'cents' || type === 'number' ? '0' : undefined}
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ width:'100%', padding:'9px 12px', background:'rgba(255,255,255,.07)', border:'1px solid rgba(255,255,255,.12)',
          borderRadius:8, color:'#fff', fontSize:13, fontFamily:"'Outfit',sans-serif", outline:'none', boxSizing:'border-box' }}
      />
    </div>
  )
}
