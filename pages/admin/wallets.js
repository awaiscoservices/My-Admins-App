/**
 * /admin/wallets
 *
 * Admin — Wallet overview
 * Browse player wallets: balances, lifetime totals, search by name/email.
 * Links to player detail page for adjustments.
 * Roles: super_admin, admin, finance
 */
import { useEffect, useState, useCallback } from 'react'
import Head from 'next/head'
import { supabase } from '../../lib/supabase'
import AdminLayout from '../../components/layout/AdminLayout'

const fmt = cents => `$${((cents || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`

export default function AdminWallets() {
  const [wallets,  setWallets]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [search,   setSearch]   = useState('')
  const [toast,    setToast]    = useState(null)
  const [role,     setRole]     = useState('')
  const [page,     setPage]     = useState(0)
  const PAGE_SIZE = 50

  useEffect(() => { load() }, [page])

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

    // Through the API, not straight from the table.
    //
    // This page used to query `wallets` from the browser, so the only thing
    // deciding what you saw was row-level security — which lets any staff
    // member read any wallet. A casino's admin was shown every other
    // casino's players, and staff accounts' empty wallets along with them.
    // The route checks the role, pins the query to the caller's own casino
    // and returns players only.
    const res = await fetch(`/api/admin/wallets/list?page=${page + 1}&limit=${PAGE_SIZE}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    const d = await res.json()

    if (!res.ok) { showToast(d.error || 'Could not load wallets', 'error'); setLoading(false); return }
    setWallets(d.rows || [])
    setLoading(false)
  }

  const filtered = wallets.filter(w => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      w.profiles?.full_name?.toLowerCase().includes(q) ||
      w.profiles?.email?.toLowerCase().includes(q)
    )
  })

  const canAdjust = ['super_admin', 'admin'].includes(role)

  return (
    <AdminLayout>
      <Head><title>Wallets — Admin</title></Head>

      {toast && (
        <div style={{ position:'fixed', top:16, left:'50%', transform:'translateX(-50%)', zIndex:9999,
          background: toast.type==='error' ? 'rgba(239,68,68,.95)' : 'rgba(34,197,94,.95)',
          borderRadius:12, padding:'12px 24px', color:'#fff', fontSize:14, fontWeight:600,
          fontFamily:"'Outfit',sans-serif", whiteSpace:'nowrap', boxShadow:'0 8px 32px rgba(0,0,0,.5)' }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontFamily:"'Cinzel',serif", fontSize:22, fontWeight:700, color:'#fff', margin:0 }}>Wallets</h1>
          <p style={{ color:'rgba(255,255,255,.35)', fontSize:13, marginTop:4 }}>Player balance overview — adjust via player profile</p>
        </div>
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search name or email…"
          style={{ padding:'9px 14px', background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.1)', borderRadius:10, color:'#fff', fontSize:13, fontFamily:"'Outfit',sans-serif", outline:'none', width:220 }}
        />
      </div>

      {loading ? (
        <div style={{ padding:60, textAlign:'center', color:'rgba(255,255,255,.3)' }}>Loading…</div>
      ) : (
        <>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr style={{ borderBottom:'1px solid rgba(255,255,255,.08)' }}>
                  {['Player', 'Level', 'Cash Balance', 'Bonus Balance', 'Total Deposited', 'Total Withdrawn', 'Total Loaded', 'Total Redeemed', ''].map(h => (
                    <th key={h} style={{ padding:'10px 12px', textAlign: h === '' ? 'center' : 'left', fontSize:10, fontWeight:800, letterSpacing:'.1em', textTransform:'uppercase', color:'rgba(255,255,255,.35)', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(w => {
                  const accent = w.profiles?.player_levels?.accent_color || '#fbbf24'
                  return (
                    <tr key={w.id} style={{ borderBottom:'1px solid rgba(255,255,255,.04)', transition:'background .15s' }}
                      onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,.025)'}
                      onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                      <td style={{ padding:'12px 12px' }}>
                        <div style={{ fontSize:13, fontWeight:700, color:'#fff' }}>{w.profiles?.full_name || '—'}</div>
                        <div style={{ fontSize:11, color:'rgba(255,255,255,.35)', marginTop:2 }}>{w.profiles?.email}</div>
                      </td>
                      <td style={{ padding:'12px 12px' }}>
                        {w.profiles?.player_levels ? (
                          <span style={{ padding:'3px 8px', borderRadius:20, fontSize:11, fontWeight:700, background:`${accent}22`, color:accent }}>
                            {w.profiles.player_levels.name}
                          </span>
                        ) : '—'}
                      </td>
                      <td style={{ padding:'12px 12px', fontWeight:800, color:'#22c55e' }}>{fmt(w.cash_balance_cents)}</td>
                      <td style={{ padding:'12px 12px', fontWeight:700, color:'#818cf8' }}>{fmt(w.bonus_balance_cents)}</td>
                      <td style={{ padding:'12px 12px', color:'rgba(255,255,255,.6)' }}>{fmt(w.total_deposited_cents)}</td>
                      <td style={{ padding:'12px 12px', color:'rgba(255,255,255,.6)' }}>{fmt(w.total_withdrawn_cents)}</td>
                      <td style={{ padding:'12px 12px', color:'rgba(255,255,255,.6)' }}>{fmt(w.total_loaded_cents)}</td>
                      <td style={{ padding:'12px 12px', color:'rgba(255,255,255,.6)' }}>{fmt(w.total_redeemed_cents)}</td>
                      <td style={{ padding:'12px 12px', textAlign:'center' }}>
                        {canAdjust && (
                          <a href={`/admin/players/${w.user_id}`} style={{ padding:'6px 12px', background:'rgba(251,191,36,.1)', border:'1px solid rgba(251,191,36,.25)', borderRadius:7, color:'#fbbf24', fontSize:11, fontWeight:800, cursor:'pointer', fontFamily:"'Outfit',sans-serif", textDecoration:'none', whiteSpace:'nowrap' }}>
                            View / Adjust
                          </a>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div style={{ display:'flex', gap:10, justifyContent:'center', marginTop:20 }}>
            {page > 0 && (
              <button onClick={() => setPage(p => p - 1)} style={{ padding:'8px 18px', background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.1)', borderRadius:8, color:'rgba(255,255,255,.6)', fontSize:13, cursor:'pointer', fontFamily:"'Outfit',sans-serif" }}>
                ← Prev
              </button>
            )}
            {wallets.length === PAGE_SIZE && (
              <button onClick={() => setPage(p => p + 1)} style={{ padding:'8px 18px', background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.1)', borderRadius:8, color:'rgba(255,255,255,.6)', fontSize:13, cursor:'pointer', fontFamily:"'Outfit',sans-serif" }}>
                Next →
              </button>
            )}
          </div>
        </>
      )}
    </AdminLayout>
  )
}
