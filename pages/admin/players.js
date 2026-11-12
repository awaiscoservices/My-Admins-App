import { useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'
import AdminLayout from '../../components/layout/AdminLayout'
import StatusBadge from '../../components/ui/StatusBadge'
import PlayerWalletModal from '../../components/PlayerWalletModal'

const fmtDate = d => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

function PlayerModal({ player, onClose, onAction, onWallet }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function toggle(action) {
    setSaving(true); setError('')
    const result = await onAction(player.id, action)
    if (result?.error) { setError(result.error); setSaving(false) }
    else onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={onClose}>
      <div style={{ background: '#0e1a2e', border: '1px solid rgba(251,191,36,.3)', borderRadius: 20, padding: 32, width: '100%', maxWidth: 460 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontFamily: "'Cinzel',serif", fontSize: 18, fontWeight: 700, color: '#fff' }}>Player Details</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.5)', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ background: 'rgba(251,191,36,.08)', border: '1px solid rgba(251,191,36,.2)', borderRadius: 12, padding: '16px', marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 8, fontFamily: 'monospace' }}>{player.username || player.full_name}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div><div style={{ fontSize: 10, color: 'rgba(255,255,255,.35)' }}>STATUS</div><div style={{ marginTop: 4 }}><StatusBadge status={player.status} size="xs" /></div></div>
            <div><div style={{ fontSize: 10, color: 'rgba(255,255,255,.35)' }}>KYC</div><div style={{ fontSize: 12, color: '#fbbf24', fontWeight: 700, marginTop: 4, textTransform: 'uppercase' }}>{player.kyc_status}</div></div>
            <div><div style={{ fontSize: 10, color: 'rgba(255,255,255,.35)' }}>PHONE</div><div style={{ fontSize: 12, color: 'rgba(255,255,255,.6)', marginTop: 4 }}>{player.phone || '—'}</div></div>
            <div><div style={{ fontSize: 10, color: 'rgba(255,255,255,.35)' }}>JOINED</div><div style={{ fontSize: 12, color: 'rgba(255,255,255,.6)', marginTop: 4 }}>{fmtDate(player.created_at)}</div></div>
          </div>
        </div>
        {error && <div style={{ marginBottom: 14, padding: '10px 14px', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 10, color: '#f87171', fontSize: 13 }}>⚠ {error}</div>}

        {/* Wallet + Profile links */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button
            onClick={() => { onClose(); onWallet(player) }}
            style={{ flex: 1, padding: '10px', background: 'linear-gradient(135deg,rgba(59,130,246,.2),rgba(99,102,241,.2))', border: '1px solid rgba(99,102,241,.4)', borderRadius: 10, color: '#818cf8', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>
            💳 Wallet Overview
          </button>
          <Link href={`/admin/players/${player.id}`} style={{ flex: 1, padding: '10px', background: 'rgba(251,191,36,.1)', border: '1px solid rgba(251,191,36,.3)', borderRadius: 10, color: '#fbbf24', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'Outfit',sans-serif", textDecoration: 'none', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            👤 Full Profile →
          </Link>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          {player.status === 'active'
            ? <button onClick={() => toggle('suspend')} disabled={saving} style={{ flex: 1, padding: '11px', background: 'rgba(239,68,68,.15)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 10, color: '#f87171', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>Suspend Player</button>
            : <button onClick={() => toggle('activate')} disabled={saving} style={{ flex: 1, padding: '11px', background: 'linear-gradient(135deg,#22c55e,#16a34a)', border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>Activate Player</button>
          }
          <button onClick={onClose} style={{ padding: '11px 16px', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, color: 'rgba(255,255,255,.4)', fontSize: 13, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>Close</button>
        </div>
      </div>
    </div>
  )
}

export default function AdminPlayers() {
  const [rows, setRows]           = useState([])
  const [filter, setFilter]       = useState('all')
  const [search, setSearch]       = useState('')
  const [loading, setLoading]     = useState(true)
  const [selected, setSelected]   = useState(null)   // quick-action modal
  const [walletPlayer, setWalletPlayer] = useState(null) // wallet modal
  const [toast, setToast]         = useState(null)

  useEffect(() => { load() }, [filter])

  function showToast(msg, type = 'success') { setToast({ msg, type }); setTimeout(() => setToast(null), 4000) }

  async function load() {
    setLoading(true)
    // Goes through the API rather than querying profiles from the browser.
    // The direct query returned every profile including staff, which is why
    // Super Admin and Tenant Admin appeared in the player list, and it skipped
    // the tenant filter the API route applies.
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setRows([]); return }

      const params = new URLSearchParams({ limit: '100' })
      if (filter !== 'all') params.set('status', filter)

      const res = await fetch(`/api/admin/players/list?${params}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const d = await res.json()
      setRows(res.ok ? (d.rows || []) : [])
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  async function handleAction(id, action) {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/admin/players/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ user_id: id, action }),
    })
    const d = await res.json()
    if (!res.ok) return { error: d.error }
    showToast(`Player ${action}d`)
    load()
    return {}
  }

  const filtered = rows.filter(r => {
    if (!search) return true
    const s = search.toLowerCase()
    return (r.username || r.full_name)?.toLowerCase().includes(s) || r.phone?.toLowerCase().includes(s)
  })

  return (
    <AdminLayout>
      <Head><title>Players — Admin</title></Head>
      {toast && <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, background: toast.type === 'error' ? 'rgba(239,68,68,.95)' : 'rgba(34,197,94,.95)', borderRadius: 12, padding: '12px 24px', color: '#fff', fontSize: 14, fontWeight: 600, fontFamily: "'Outfit',sans-serif", whiteSpace: 'nowrap', boxShadow: '0 8px 32px rgba(0,0,0,.5)' }}>{toast.msg}</div>}

      {selected && (
        <PlayerModal
          player={selected}
          onClose={() => setSelected(null)}
          onAction={handleAction}
          onWallet={p => setWalletPlayer(p)}
        />
      )}

      {/* Wallet modal — opens on top of everything */}
      {walletPlayer && (
        <PlayerWalletModal
          playerId={walletPlayer.id}
          playerName={walletPlayer.full_name}
          onClose={() => setWalletPlayer(null)}
        />
      )}

      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: "'Cinzel',serif", fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 4 }}>Players</h1>
        <p style={{ color: 'rgba(255,255,255,.35)', fontSize: 13 }}>Manage player accounts</p>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,.04)', padding: 4, borderRadius: 10 }}>
          {['all', 'active', 'suspended', 'pending'].map(s => (
            <button key={s} onClick={() => setFilter(s)} style={{ padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: "'Outfit',sans-serif", fontSize: 12, fontWeight: 700, background: filter === s ? 'rgba(251,191,36,.7)' : 'transparent', color: filter === s ? '#fff' : 'rgba(255,255,255,.4)', textTransform: 'capitalize', transition: 'all .15s' }}>{s}</button>
          ))}
        </div>
        <input type="text" placeholder="Search username or phone…" value={search} onChange={e => setSearch(e.target.value)}
          style={{ padding: '9px 14px', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, color: '#fff', fontSize: 13, fontFamily: "'Outfit',sans-serif", outline: 'none', minWidth: 240 }} />
      </div>

      <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,.04)' }}>
                {['Player', 'Phone', 'KYC', 'Status', 'Joined', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 10, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.35)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,.3)' }}>Loading…</td></tr>
              : filtered.length === 0 ? <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,.3)' }}>No players found</td></tr>
              : filtered.map(r => (
                <tr key={r.id} style={{ borderTop: '1px solid rgba(255,255,255,.04)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.02)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', fontFamily: 'monospace' }}>{r.username || r.full_name}</div>
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 12, color: 'rgba(255,255,255,.5)' }}>{r.phone || '—'}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 99, textTransform: 'uppercase', background: r.kyc_status === 'verified' ? 'rgba(34,197,94,.15)' : r.kyc_status === 'pending' ? 'rgba(251,191,36,.15)' : 'rgba(239,68,68,.15)', color: r.kyc_status === 'verified' ? '#22c55e' : r.kyc_status === 'pending' ? '#fbbf24' : '#ef4444' }}>{r.kyc_status || 'none'}</span>
                  </td>
                  <td style={{ padding: '12px 14px' }}><StatusBadge status={r.status} size="xs" /></td>
                  <td style={{ padding: '12px 14px', fontSize: 11, color: 'rgba(255,255,255,.35)', whiteSpace: 'nowrap' }}>{fmtDate(r.created_at)}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {/* Wallet icon button */}
                      <button
                        onClick={() => setWalletPlayer(r)}
                        title="Wallet Overview"
                        style={{ padding: '6px 10px', background: 'rgba(99,102,241,.15)', border: '1px solid rgba(99,102,241,.3)', borderRadius: 8, color: '#818cf8', fontSize: 14, cursor: 'pointer', lineHeight: 1 }}>
                        💳
                      </button>
                      <button
                        onClick={() => setSelected(r)}
                        style={{ padding: '6px 12px', background: 'rgba(251,191,36,.15)', border: '1px solid rgba(251,191,36,.3)', borderRadius: 8, color: '#fbbf24', fontSize: 11, fontWeight: 800, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>
                        View
                      </button>
                      <Link
                        href={`/admin/players/${r.id}`}
                        style={{ padding: '6px 12px', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, color: 'rgba(255,255,255,.5)', fontSize: 11, fontWeight: 800, cursor: 'pointer', fontFamily: "'Outfit',sans-serif", textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
                        →
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  )
}
