/**
 * /admin/transactions
 *
 * Admin — Ledger / Transaction Log
 * Full append-only ledger view. Filter by type and search by player.
 * Roles: super_admin, admin, finance
 */
import { useEffect, useState } from 'react'
import Head from 'next/head'
import { supabase } from '../../lib/supabase'
import AdminLayout from '../../components/layout/AdminLayout'

const fmt     = cents => `$${((cents || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
const fmtDate = d => d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

const TYPE_OPTS = ['all', 'deposit', 'withdrawal', 'game_load', 'redemption', 'bonus', 'adjustment']

const TYPE_COLOR = {
  deposit:    '#22c55e',
  withdrawal: '#f87171',
  game_load:  '#fbbf24',
  redemption: '#a78bfa',
  bonus:      '#6366f1',
  adjustment: '#f59e0b',
}

export default function AdminTransactions() {
  const [items,    setItems]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [typeFilter, setTypeFilter] = useState('all')
  const [search,   setSearch]   = useState('')
  const [toast,    setToast]    = useState(null)
  const [page,     setPage]     = useState(0)
  const PAGE_SIZE = 100

  useEffect(() => { setPage(0) }, [typeFilter])
  useEffect(() => { load() }, [page, typeFilter])

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  async function load() {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setLoading(false); return }

    const { data: actor } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
    if (!actor || !['super_admin', 'admin', 'finance'].includes(actor.role)) {
      showToast('Access denied', 'error'); setLoading(false); return
    }

    let q = supabase
      .from('ledger')
      .select(`
        id, type, direction, amount_cents, wallet_bucket, reference_id, idempotency_key, created_at, notes,
        profiles ( full_name, email )
      `)
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    if (typeFilter !== 'all') q = q.eq('type', typeFilter)

    const { data, error } = await q
    if (error) { showToast(error.message, 'error'); setLoading(false); return }
    setItems(data || [])
    setLoading(false)
  }

  const filtered = items.filter(item => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      item.profiles?.full_name?.toLowerCase().includes(q) ||
      item.profiles?.email?.toLowerCase().includes(q) ||
      item.reference_id?.toLowerCase().includes(q)
    )
  })

  return (
    <AdminLayout>
      <Head><title>Transactions — Admin</title></Head>

      {toast && (
        <div style={{ position:'fixed', top:16, left:'50%', transform:'translateX(-50%)', zIndex:9999,
          background: toast.type==='error' ? 'rgba(239,68,68,.95)' : 'rgba(34,197,94,.95)',
          borderRadius:12, padding:'12px 24px', color:'#fff', fontSize:14, fontWeight:600,
          fontFamily:"'Outfit',sans-serif", whiteSpace:'nowrap', boxShadow:'0 8px 32px rgba(0,0,0,.5)' }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontFamily:"'Cinzel',serif", fontSize:22, fontWeight:700, color:'#fff', margin:0 }}>Transactions</h1>
          <p style={{ color:'rgba(255,255,255,.35)', fontSize:13, marginTop:4 }}>Append-only financial ledger — never edited</p>
        </div>
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search player or ref…"
          style={{ padding:'9px 14px', background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.1)', borderRadius:10, color:'#fff', fontSize:13, fontFamily:"'Outfit',sans-serif", outline:'none', width:220 }}
        />
      </div>

      {/* Type filter */}
      <div style={{ display:'flex', gap:8, marginBottom:20, flexWrap:'wrap' }}>
        {TYPE_OPTS.map(t => (
          <button key={t} onClick={() => setTypeFilter(t)} style={{
            padding:'6px 12px', borderRadius:8, fontSize:11, fontWeight:700, cursor:'pointer',
            textTransform:'capitalize', fontFamily:"'Outfit',sans-serif",
            background: typeFilter===t ? `${TYPE_COLOR[t] || '#fbbf24'}22` : 'rgba(255,255,255,.04)',
            border: typeFilter===t ? `1px solid ${TYPE_COLOR[t] || '#fbbf24'}55` : '1px solid rgba(255,255,255,.08)',
            color: typeFilter===t ? (TYPE_COLOR[t] || '#fbbf24') : 'rgba(255,255,255,.4)',
          }}>{t.replace('_', ' ')}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding:60, textAlign:'center', color:'rgba(255,255,255,.3)' }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding:60, textAlign:'center', color:'rgba(255,255,255,.3)', fontSize:14 }}>No transactions</div>
      ) : (
        <>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr style={{ borderBottom:'1px solid rgba(255,255,255,.08)' }}>
                  {['Time', 'Player', 'Type', 'Bucket', 'Amount', 'Reference', 'Notes'].map(h => (
                    <th key={h} style={{ padding:'10px 12px', textAlign:'left', fontSize:10, fontWeight:800, letterSpacing:'.1em', textTransform:'uppercase', color:'rgba(255,255,255,.35)', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => {
                  const color = TYPE_COLOR[item.type] || '#fbbf24'
                  const amtColor = item.direction === 'credit' ? '#22c55e' : '#f87171'
                  return (
                    <tr key={item.id} style={{ borderBottom:'1px solid rgba(255,255,255,.03)', transition:'background .15s' }}
                      onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,.02)'}
                      onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                      <td style={{ padding:'10px 12px', color:'rgba(255,255,255,.4)', whiteSpace:'nowrap', fontSize:11 }}>{fmtDate(item.created_at)}</td>
                      <td style={{ padding:'10px 12px' }}>
                        <div style={{ fontWeight:600, color:'#fff' }}>{item.profiles?.full_name || '—'}</div>
                        <div style={{ fontSize:10, color:'rgba(255,255,255,.3)' }}>{item.profiles?.email}</div>
                      </td>
                      <td style={{ padding:'10px 12px' }}>
                        <span style={{ padding:'3px 8px', borderRadius:20, fontSize:10, fontWeight:700, background:`${color}22`, color, textTransform:'capitalize' }}>
                          {item.type?.replace(/_/g,' ')}
                        </span>
                      </td>
                      <td style={{ padding:'10px 12px', fontSize:11, color:'rgba(255,255,255,.5)', textTransform:'capitalize' }}>{item.wallet_bucket}</td>
                      <td style={{ padding:'10px 12px', fontWeight:800, color:amtColor, whiteSpace:'nowrap' }}>
                        {item.direction==='credit' ? '+' : '−'}{fmt(item.amount_cents)}
                      </td>
                      <td style={{ padding:'10px 12px', fontSize:11, color:'rgba(255,255,255,.35)', fontFamily:'monospace' }}>{item.reference_id || '—'}</td>
                      <td style={{ padding:'10px 12px', fontSize:11, color:'rgba(255,255,255,.4)', maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.notes || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div style={{ display:'flex', gap:10, justifyContent:'center', marginTop:20 }}>
            {page > 0 && (
              <button onClick={() => setPage(p => p-1)} style={{ padding:'8px 18px', background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.1)', borderRadius:8, color:'rgba(255,255,255,.6)', fontSize:13, cursor:'pointer', fontFamily:"'Outfit',sans-serif" }}>← Prev</button>
            )}
            {items.length === PAGE_SIZE && (
              <button onClick={() => setPage(p => p+1)} style={{ padding:'8px 18px', background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.1)', borderRadius:8, color:'rgba(255,255,255,.6)', fontSize:13, cursor:'pointer', fontFamily:"'Outfit',sans-serif" }}>Next →</button>
            )}
          </div>
        </>
      )}
    </AdminLayout>
  )
}
