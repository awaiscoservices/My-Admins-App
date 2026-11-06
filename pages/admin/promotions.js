/**
 * pages/admin/promotions.js — Player Bonuses
 *
 * Layout:
 *   Tab 1 – Deposit Bonuses
 *     Accordion list of Payment Methods.
 *     Expand one → grid: Rows = Levels, Cols = Mon–Sun (7 days)
 *     Each cell = editable % input.  Blur saves that single cell.
 *
 *   Tab 2 – Referral Bonuses
 *     3 rows (deposit 1/2/3), one % field each.
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import Head from 'next/head'
import AdminLayout from '../../components/layout/AdminLayout'
import { supabase } from '../../lib/supabase'

// ─── theme tokens (matches rest of admin app) ─────────────────────────────────
const G        = '#fbbf24'           // gold
const G2       = '#f59e0b'
const BG_CARD  = 'rgba(255,255,255,.03)'
const BDR      = '1px solid rgba(255,255,255,.08)'
const BDR_GOLD = '1px solid rgba(251,191,36,.25)'
const DIM      = 'rgba(255,255,255,.4)'
const DIM2     = 'rgba(255,255,255,.25)'
const DAYS     = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

// ─── helpers ──────────────────────────────────────────────────────────────────
async function apiFetch(path, opts = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}`, ...(opts.headers || {}) },
  })
  const j = await res.json()
  if (!res.ok) throw new Error(j.error || 'Request failed')
  return j
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ toast }) {
  if (!toast) return null
  return (
    <div style={{
      position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
      zIndex: 9999, background: toast.type === 'error' ? 'rgba(239,68,68,.95)' : 'rgba(34,197,94,.95)',
      borderRadius: 12, padding: '11px 24px', color: '#fff', fontSize: 13,
      fontWeight: 700, fontFamily: "'Outfit',sans-serif", whiteSpace: 'nowrap',
      boxShadow: '0 8px 32px rgba(0,0,0,.5)',
    }}>{toast.msg}</div>
  )
}

// ─── Single bonus cell ────────────────────────────────────────────────────────
function BonusCell({ value, onChange, saving }) {
  const [local, setLocal] = useState(value ?? '')
  const [dirty, setDirty] = useState(false)
  const ref = useRef()

  // sync if parent updates (e.g. after save)
  useEffect(() => { if (!dirty) setLocal(value ?? '') }, [value, dirty])

  function handleBlur() {
    if (!dirty) return
    const parsed = local === '' ? null : parseFloat(local)
    if (local !== '' && (isNaN(parsed) || parsed < 0 || parsed > 100)) {
      setLocal(value ?? '')
      setDirty(false)
      return
    }
    onChange(parsed)
    setDirty(false)
  }

  const isFilled = local !== '' && local !== null && parseFloat(local) > 0

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <input
        ref={ref}
        type="number"
        min="0"
        max="100"
        step="0.5"
        value={local}
        onChange={e => { setLocal(e.target.value); setDirty(true) }}
        onBlur={handleBlur}
        onKeyDown={e => { if (e.key === 'Enter') { e.target.blur() } if (e.key === 'Escape') { setLocal(value ?? ''); setDirty(false) } }}
        placeholder="—"
        disabled={saving}
        style={{
          width: 68, padding: '6px 20px 6px 8px', textAlign: 'center',
          background: isFilled ? 'rgba(251,191,36,.1)' : 'rgba(255,255,255,.04)',
          border: isFilled ? '1px solid rgba(251,191,36,.35)' : '1px solid rgba(255,255,255,.1)',
          borderRadius: 8, color: isFilled ? G : DIM,
          fontSize: 13, fontWeight: isFilled ? 700 : 400,
          fontFamily: "'Outfit',sans-serif", outline: 'none',
          transition: 'all .15s',
          MozAppearance: 'textfield',
        }}
      />
      {isFilled && (
        <span style={{ position: 'absolute', right: 7, fontSize: 10, color: G2, fontWeight: 700, pointerEvents: 'none' }}>%</span>
      )}
    </div>
  )
}

// ─── Payment method accordion row ─────────────────────────────────────────────
function MethodAccordion({ method, levels, bonusMap, onCellSave, savingCell }) {
  const [open, setOpen] = useState(false)

  // bonusMap[levelId][dayNumber] = bonus_percent
  function getValue(levelId, day) {
    return bonusMap?.[method.id]?.[levelId]?.[day] ?? ''
  }

  return (
    <div style={{
      background: BG_CARD,
      border: open ? BDR_GOLD : BDR,
      borderRadius: 14,
      overflow: 'hidden',
      transition: 'border-color .2s',
    }}>
      {/* Header row */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px', background: 'transparent', border: 'none',
          cursor: 'pointer', textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'rgba(251,191,36,.12)', border: '1px solid rgba(251,191,36,.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, flexShrink: 0,
          }}>💳</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', fontFamily: "'Outfit',sans-serif" }}>
              {method.name}
            </div>
            {method.description && (
              <div style={{ fontSize: 11, color: DIM2, marginTop: 1 }}>{method.description}</div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Count of configured cells */}
          {(() => {
            let count = 0
            levels.forEach(l => DAYS.forEach((_, i) => { if (getValue(l.id, i + 1) !== '' && parseFloat(getValue(l.id, i + 1)) > 0) count++ }))
            return count > 0 ? (
              <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99, background: 'rgba(251,191,36,.15)', color: G }}>
                {count} bonus{count !== 1 ? 'es' : ''} set
              </span>
            ) : (
              <span style={{ fontSize: 11, color: DIM2 }}>No bonuses</span>
            )
          })()}
          <span style={{ color: open ? G : DIM, fontSize: 18, lineHeight: 1, transition: 'transform .2s', display: 'inline-block', transform: open ? 'rotate(180deg)' : 'none' }}>⌄</span>
        </div>
      </button>

      {/* Expanded grid */}
      {open && (
        <div style={{ padding: '0 20px 20px' }}>
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 560 }}>
              <thead>
                <tr>
                  <th style={{ padding: '10px 12px 10px 0', textAlign: 'left', fontSize: 10, fontWeight: 800, letterSpacing: '.09em', textTransform: 'uppercase', color: DIM2, whiteSpace: 'nowrap', minWidth: 120 }}>Level</th>
                  {DAYS.map((d, i) => (
                    <th key={d} style={{ padding: '10px 6px', textAlign: 'center', fontSize: 10, fontWeight: 800, letterSpacing: '.09em', textTransform: 'uppercase', color: i >= 5 ? '#f59e0b' : DIM2, whiteSpace: 'nowrap', minWidth: 80 }}>
                      {d}
                      {i >= 5 && <span style={{ fontSize: 8, marginLeft: 3 }}>🔥</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {levels.map((level, li) => (
                  <tr key={level.id} style={{ borderTop: li === 0 ? '1px solid rgba(255,255,255,.07)' : '1px solid rgba(255,255,255,.04)' }}>
                    <td style={{ padding: '10px 12px 10px 0', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {level.accent_color && (
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: level.accent_color, display: 'inline-block', flexShrink: 0 }} />
                        )}
                        <span style={{ fontSize: 13, fontWeight: 700, color: level.accent_color || '#fff', fontFamily: "'Outfit',sans-serif" }}>{level.name}</span>
                      </div>
                    </td>
                    {DAYS.map((_, di) => {
                      const dayNum = di + 1
                      const cellKey = `${method.id}:${level.id}:${dayNum}`
                      return (
                        <td key={dayNum} style={{ padding: '8px 6px', textAlign: 'center' }}>
                          <BonusCell
                            value={getValue(level.id, dayNum)}
                            saving={savingCell === cellKey}
                            onChange={val => onCellSave(method.id, level.id, dayNum, val)}
                          />
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 10, fontSize: 11, color: DIM2 }}>
            Click a cell and type a %, then press Enter or click away to save. Leave blank for no bonus.
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Referral tab ─────────────────────────────────────────────────────────────
function ReferralTab({ tiers, onSave, saving }) {
  const [form, setForm] = useState({})

  useEffect(() => {
    const f = {}
    tiers.forEach(t => { f[t.deposit_number] = { bonus_percent: t.bonus_percent ?? '', is_active: t.is_active ?? true } })
    setForm(f)
  }, [tiers])

  function update(dep, field, val) {
    setForm(f => ({ ...f, [dep]: { ...f[dep], [field]: val } }))
  }

  const DEPOSIT_LABELS = { 1: '1st Deposit', 2: '2nd Deposit', 3: '3rd Deposit' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 13, color: DIM, marginBottom: 6 }}>
        Referrer earns a % of each referee's first 3 deposits as bonus credit.
      </div>
      {[1, 2, 3].map(dep => (
        <div key={dep} style={{
          background: BG_CARD, border: BDR, borderRadius: 14,
          padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
        }}>
          <div style={{ flex: '1 1 140px' }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: G, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 2 }}>
              {DEPOSIT_LABELS[dep]}
            </div>
            <div style={{ fontSize: 11, color: DIM2 }}>Referee's deposit #{dep}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ position: 'relative' }}>
              <input
                type="number" min="0" max="100" step="0.5"
                value={form[dep]?.bonus_percent ?? ''}
                onChange={e => update(dep, 'bonus_percent', e.target.value)}
                placeholder="0"
                style={{
                  width: 90, padding: '8px 24px 8px 10px', borderRadius: 10,
                  background: 'rgba(255,255,255,.05)', border: BDR,
                  color: '#fff', fontSize: 14, fontWeight: 700,
                  fontFamily: "'Outfit',sans-serif", outline: 'none',
                  MozAppearance: 'textfield',
                }}
              />
              <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: G, fontWeight: 700, pointerEvents: 'none' }}>%</span>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form[dep]?.is_active ?? true}
                onChange={e => update(dep, 'is_active', e.target.checked)}
                style={{ width: 16, height: 16, accentColor: G }}
              />
              <span style={{ fontSize: 12, color: DIM, fontFamily: "'Outfit',sans-serif" }}>Active</span>
            </label>
            <button
              onClick={() => onSave(dep, form[dep]?.bonus_percent, form[dep]?.is_active)}
              disabled={saving === dep}
              style={{
                padding: '8px 16px', borderRadius: 10,
                background: saving === dep ? 'rgba(255,255,255,.08)' : 'linear-gradient(135deg,#fbbf24,#f59e0b)',
                border: 'none', color: saving === dep ? DIM : '#000',
                fontSize: 12, fontWeight: 800, cursor: saving === dep ? 'default' : 'pointer',
                fontFamily: "'Outfit',sans-serif",
              }}
            >{saving === dep ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function PlayerBonuses() {
  const [tab, setTab]           = useState('deposit')
  const [paymentMethods, setPaymentMethods] = useState([])
  const [levels, setLevels]     = useState([])
  const [bonusMap, setBonusMap] = useState({})   // { [pmId]: { [levelId]: { [day]: percent } } }
  const [referralTiers, setReferralTiers] = useState([])
  const [loading, setLoading]   = useState(true)
  const [savingCell, setSavingCell] = useState(null)
  const [savingReferral, setSavingReferral] = useState(null)
  const [toast, setToast]       = useState(null)

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await apiFetch('/api/admin/bonuses/list')
      setPaymentMethods(d.paymentMethods || [])
      setLevels(d.levels || [])
      setReferralTiers(d.referralTiers || [])

      // Build bonusMap from flat bonuses array
      const map = {}
      ;(d.bonuses || []).forEach(b => {
        if (!map[b.payment_method_id]) map[b.payment_method_id] = {}
        if (!map[b.payment_method_id][b.player_level_id]) map[b.payment_method_id][b.player_level_id] = {}
        map[b.payment_method_id][b.player_level_id][b.day_number] = b.bonus_percent
      })
      setBonusMap(map)
    } catch (e) { showToast(e.message, 'error') }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleCellSave(pmId, levelId, dayNum, percent) {
    const key = `${pmId}:${levelId}:${dayNum}`
    setSavingCell(key)
    try {
      await apiFetch('/api/admin/bonuses/cell-upsert', {
        method: 'POST',
        body: JSON.stringify({ payment_method_id: pmId, player_level_id: levelId, day_number: dayNum, bonus_percent: percent }),
      })
      // Update local map
      setBonusMap(prev => {
        const next = { ...prev }
        if (!next[pmId]) next[pmId] = {}
        if (!next[pmId][levelId]) next[pmId][levelId] = {}
        if (percent === null) { delete next[pmId][levelId][dayNum] }
        else { next[pmId][levelId][dayNum] = percent }
        return next
      })
      showToast('Saved')
    } catch (e) { showToast(e.message, 'error') }
    setSavingCell(null)
  }

  async function handleReferralSave(dep, percent, isActive) {
    setSavingReferral(dep)
    try {
      await apiFetch('/api/admin/bonuses/referral-upsert', {
        method: 'POST',
        body: JSON.stringify({ deposit_number: dep, bonus_percent: parseFloat(percent) || 0, is_active: isActive }),
      })
      showToast('Referral bonus saved')
    } catch (e) { showToast(e.message, 'error') }
    setSavingReferral(null)
  }

  return (
    <AdminLayout>
      <Head><title>Player Bonuses — Admin</title></Head>
      <Toast toast={toast} />

      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: "'Cinzel',serif", fontSize: 22, fontWeight: 700, color: '#fff', margin: '0 0 4px' }}>
          Player Bonuses
        </h1>
        <p style={{ color: DIM2, fontSize: 13, margin: 0 }}>
          Configure deposit bonus % per payment method, level, and day of week.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,.04)', padding: 4, borderRadius: 12, width: 'fit-content', marginBottom: 24 }}>
        {[['deposit','💰 Deposit Bonuses'], ['referral','🤝 Referral Bonuses']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding: '8px 20px', borderRadius: 10, border: 'none', cursor: 'pointer',
            fontFamily: "'Outfit',sans-serif", fontSize: 13, fontWeight: 700,
            background: tab === key ? 'rgba(251,191,36,.75)' : 'transparent',
            color: tab === key ? '#fff' : DIM,
            transition: 'all .15s',
          }}>{label}</button>
        ))}
      </div>

      {/* ── Deposit Bonuses tab ── */}
      {tab === 'deposit' && (
        <>
          {loading ? (
            <div style={{ color: DIM2, padding: 40, textAlign: 'center' }}>Loading…</div>
          ) : paymentMethods.length === 0 ? (
            <div style={{ color: DIM2, padding: 40, textAlign: 'center', fontSize: 13 }}>
              No payment methods found. Add payment methods first.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {paymentMethods.map(pm => (
                <MethodAccordion
                  key={pm.id}
                  method={pm}
                  levels={levels}
                  bonusMap={bonusMap}
                  onCellSave={handleCellSave}
                  savingCell={savingCell}
                />
              ))}
            </div>
          )}

          {/* Legend */}
          {!loading && paymentMethods.length > 0 && (
            <div style={{ marginTop: 20, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: DIM2 }}>
                <span style={{ width: 12, height: 12, borderRadius: 3, background: 'rgba(251,191,36,.15)', border: '1px solid rgba(251,191,36,.35)', display: 'inline-block' }} />
                Cell with bonus set
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: DIM2 }}>
                <span style={{ width: 12, height: 12, borderRadius: 3, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.1)', display: 'inline-block' }} />
                No bonus (blank)
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#f59e0b' }}>
                🔥 Weekend (Sat / Sun)
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Referral Bonuses tab ── */}
      {tab === 'referral' && (
        loading ? (
          <div style={{ color: DIM2, padding: 40, textAlign: 'center' }}>Loading…</div>
        ) : (
          <ReferralTab
            tiers={referralTiers}
            onSave={handleReferralSave}
            saving={savingReferral}
          />
        )
      )}
    </AdminLayout>
  )
}
