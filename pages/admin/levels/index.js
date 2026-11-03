/**
 * /admin/levels
 *
 * Super Admin — Player Levels Config
 * View and edit all 9 tiers: XP threshold, deposit bonus %, daily withdrawal limit, bonus→cash %.
 * Changes go directly to player_levels table via /api/admin/levels API.
 */
import { useEffect, useState } from 'react'
import Head from 'next/head'
import { supabase } from '../../../lib/supabase'
import AdminLayout from '../../../components/layout/AdminLayout'

const COLS = [
  { key: 'name',                       label: 'Level',            type: 'text',   readOnly: true  },
  { key: 'min_xp',                     label: 'Min XP',           type: 'number', readOnly: false },
  { key: 'deposit_bonus_pct',          label: 'Deposit Bonus %',  type: 'number', readOnly: false },
  { key: 'daily_withdrawal_limit_cents', label: 'Daily Withdraw ($)', type: 'cents', readOnly: false },
  { key: 'bonus_to_cash_pct',          label: 'Bonus→Cash %',     type: 'number', readOnly: false },
]

export default function AdminLevels() {
  const [levels,  setLevels]  = useState([])
  const [editing, setEditing] = useState(null)   // level id being edited
  const [draft,   setDraft]   = useState({})
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')
  const [toast,   setToast]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [role,    setRole]    = useState('')

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
    setRole(p?.role || '')
    const res = await fetch('/api/admin/levels', {
      headers: { Authorization: `Bearer ${session.access_token}` }
    })
    const json = await res.json()
    setLevels(json.levels || [])
    setLoading(false)
  }

  function startEdit(level) {
    setEditing(level.id)
    setDraft({
      min_xp:                       level.min_xp,
      deposit_bonus_pct:            parseFloat(level.deposit_bonus_pct),
      daily_withdrawal_limit_cents: level.daily_withdrawal_limit_cents,
      bonus_to_cash_pct:            parseFloat(level.bonus_to_cash_pct),
    })
    setError('')
  }

  function cancelEdit() { setEditing(null); setDraft({}) }

  async function saveEdit(levelId) {
    setSaving(true); setError('')
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/admin/levels', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ id: levelId, ...draft }),
    })
    const json = await res.json()
    setSaving(false)
    if (!res.ok) { setError(json.error); return }
    showToast('Level updated')
    setEditing(null)
    load()
  }

  const isSuperAdmin = ['super_admin'].includes(role)

  return (
    <AdminLayout>
      <Head><title>Player Levels — Admin</title></Head>
      {toast && (
        <div style={{ position:'fixed', top:16, left:'50%', transform:'translateX(-50%)', zIndex:9999, background: toast.type==='error'?'rgba(239,68,68,.95)':'rgba(34,197,94,.95)', borderRadius:12, padding:'12px 24px', color:'#fff', fontSize:14, fontWeight:600, fontFamily:"'Outfit',sans-serif", whiteSpace:'nowrap', boxShadow:'0 8px 32px rgba(0,0,0,.5)' }}>{toast.msg}</div>
      )}

      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontFamily:"'Cinzel',serif", fontSize:22, fontWeight:700, color:'#fff', margin:0 }}>Player Levels</h1>
        <p style={{ color:'rgba(255,255,255,.35)', fontSize:13, marginTop:4 }}>
          Configure XP thresholds, bonuses, and withdrawal limits per tier
          {!isSuperAdmin && ' — view only (super admin required to edit)'}
        </p>
      </div>

      {loading ? (
        <div style={{ padding:60, textAlign:'center', color:'rgba(255,255,255,.3)' }}>Loading…</div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {levels.map(level => {
            const isEdit    = editing === level.id
            const accent    = level.accent_color || '#fbbf24'

            return (
              <div key={level.id} style={{
                background:   'rgba(255,255,255,.02)',
                border:       `1px solid ${isEdit ? accent + '60' : 'rgba(255,255,255,.07)'}`,
                borderRadius: 16,
                padding:      20,
                transition:   'border-color .2s',
              }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: isEdit ? 18 : 0 }}>
                  {/* Level badge + name */}
                  <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                    <div style={{
                      width:36, height:36, borderRadius:'50%',
                      background:`linear-gradient(135deg,${accent},${accent}88)`,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:14, fontWeight:900, color:'#000', flexShrink:0,
                      fontFamily:"'Cinzel',serif",
                    }}>{level.name[0]}</div>
                    <div>
                      <div style={{ fontSize:15, fontWeight:800, color:'#fff', fontFamily:"'Cinzel',serif" }}>{level.name}</div>
                      <div style={{ fontSize:11, color:'rgba(255,255,255,.35)', marginTop:2 }}>Level {level.display_order || level.id}</div>
                    </div>
                  </div>

                  {/* View-mode stats */}
                  {!isEdit && (
                    <div style={{ display:'flex', alignItems:'center', gap:20, flexWrap:'wrap' }}>
                      <Stat label="Min XP"          value={Number(level.min_xp).toLocaleString()} />
                      <Stat label="Deposit Bonus"   value={`${parseFloat(level.deposit_bonus_pct)}%`} />
                      <Stat label="Daily Withdraw"  value={`$${((level.daily_withdrawal_limit_cents||0)/100).toLocaleString()}`} />
                      <Stat label="Bonus→Cash"      value={`${parseFloat(level.bonus_to_cash_pct)}%`} />
                      {isSuperAdmin && (
                        <button onClick={() => startEdit(level)} style={editBtnStyle(accent)}>Edit</button>
                      )}
                    </div>
                  )}
                </div>

                {/* Edit form */}
                {isEdit && (
                  <div>
                    {error && <div style={{ marginBottom:14, padding:'8px 12px', background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.3)', borderRadius:8, color:'#f87171', fontSize:13 }}>⚠ {error}</div>}
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))', gap:12, marginBottom:16 }}>
                      <Field label="Min XP"           value={draft.min_xp}                       onChange={v => setDraft(d => ({...d, min_xp: parseInt(v)||0}))}                     type="number" />
                      <Field label="Deposit Bonus %"  value={draft.deposit_bonus_pct}             onChange={v => setDraft(d => ({...d, deposit_bonus_pct: parseFloat(v)||0}))}        type="number" step="0.5" />
                      <Field label="Daily Limit ($)"  value={((draft.daily_withdrawal_limit_cents||0)/100).toFixed(2)} onChange={v => setDraft(d => ({...d, daily_withdrawal_limit_cents: Math.round((parseFloat(v)||0)*100)}))} type="number" step="10" />
                      <Field label="Bonus→Cash %"     value={draft.bonus_to_cash_pct}             onChange={v => setDraft(d => ({...d, bonus_to_cash_pct: parseFloat(v)||0}))}        type="number" step="0.5" />
                    </div>
                    <div style={{ display:'flex', gap:10 }}>
                      <button onClick={() => saveEdit(level.id)} disabled={saving} style={{ padding:'10px 20px', background:`linear-gradient(135deg,${accent},${accent}cc)`, border:'none', borderRadius:10, color:'#000', fontSize:13, fontWeight:800, cursor:'pointer', fontFamily:"'Outfit',sans-serif" }}>
                        {saving ? 'Saving…' : 'Save Changes'}
                      </button>
                      <button onClick={cancelEdit} style={{ padding:'10px 16px', background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.1)', borderRadius:10, color:'rgba(255,255,255,.5)', fontSize:13, cursor:'pointer', fontFamily:"'Outfit',sans-serif" }}>Cancel</button>
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

function Stat({ label, value }) {
  return (
    <div style={{ textAlign:'center' }}>
      <div style={{ fontSize:9, fontWeight:800, letterSpacing:'.1em', textTransform:'uppercase', color:'rgba(255,255,255,.3)', marginBottom:3 }}>{label}</div>
      <div style={{ fontSize:14, fontWeight:800, color:'rgba(255,255,255,.8)' }}>{value}</div>
    </div>
  )
}

function Field({ label, value, onChange, type='text', step }) {
  return (
    <div>
      <label style={{ display:'block', fontSize:10, fontWeight:800, letterSpacing:'.1em', textTransform:'uppercase', color:'rgba(255,255,255,.35)', marginBottom:6 }}>{label}</label>
      <input
        type={type} step={step} value={value}
        onChange={e => onChange(e.target.value)}
        style={{ width:'100%', padding:'9px 12px', background:'rgba(255,255,255,.07)', border:'1px solid rgba(255,255,255,.12)', borderRadius:8, color:'#fff', fontSize:14, fontFamily:"'Outfit',sans-serif", outline:'none', boxSizing:'border-box' }}
      />
    </div>
  )
}

function editBtnStyle(accent) {
  return {
    padding: '7px 16px',
    background: `${accent}22`,
    border: `1px solid ${accent}55`,
    borderRadius: 8,
    color: accent,
    fontSize: 12,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: "'Outfit',sans-serif",
    whiteSpace: 'nowrap',
  }
}
