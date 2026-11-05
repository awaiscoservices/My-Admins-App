import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import { supabase } from '../../lib/supabase';

export default function AdminRisk() {
  const [flags, setFlags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // { player_id, action }
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [playerSearch, setPlayerSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);
  const [filter, setFilter] = useState('active');

  const fetchFlags = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('risk_flags')
      .select('id, reason, note, status, created_at, resolved_at, players:player_id(id, display_name, email)')
      .eq('status', filter).order('created_at', { ascending: false }).limit(100);
    setFlags(data || []);
    setLoading(false);
  }, [filter]);

  useEffect(() => { fetchFlags(); }, [fetchFlags]);

  const showToast = (msg, t='success') => { setToast({ msg, type: t }); setTimeout(() => setToast(null), 4000); };

  const searchPlayers = async () => {
    if (!playerSearch.trim()) return;
    const { data } = await supabase.from('players').select('id, display_name, email').or(`email.ilike.%${playerSearch}%,display_name.ilike.%${playerSearch}%`).limit(5);
    setSearchResults(data||[]);
  };

  const openFlag = (player) => { setModal({ player, action: 'flag' }); setReason(''); setNote(''); setSearchResults([]); setPlayerSearch(''); };
  const openUnflag = (flag) => { setModal({ flag, action: 'unflag' }); setNote(''); };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const body = modal.action === 'flag'
        ? { action: 'flag', player_id: modal.player.id, reason, note }
        : { action: 'unflag', flag_id: modal.flag.id, note };
      const res = await fetch('/api/admin/risk/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error||'Failed');
      showToast(modal.action === 'flag' ? 'Player flagged' : 'Flag resolved');
      setModal(null); fetchFlags();
    } catch (e) { showToast(e.message,'error'); }
    finally { setSubmitting(false); }
  };

  const fmtDate = d => d ? new Date(d).toLocaleString() : '—';

  return (
    <AdminLayout>
      <div style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h1 style={{ fontFamily: 'Cinzel,serif', fontSize: 26, color: '#fbbf24', margin: 0 }}>Risk Monitoring</h1>
          <div style={{ display: 'flex', gap: 8 }}>
            {['active','resolved'].map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{ padding: '6px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', background: filter===f?'#fbbf24':'rgba(255,255,255,0.08)', color: filter===f?'#0f172a':'#e2e8f0', fontWeight: 600, textTransform: 'capitalize' }}>{f}</button>
            ))}
            <button onClick={() => setModal({ action: 'flag' })} style={{ padding: '6px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'rgba(248,113,113,0.15)', color: '#f87171', fontWeight: 700 }}>+ Flag Player</button>
            <button onClick={fetchFlags} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(251,191,36,0.3)', background: 'transparent', color: '#fbbf24', cursor: 'pointer', fontWeight: 600 }}>↻</button>
          </div>
        </div>

        {loading ? <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>Loading…</div>
        : flags.length === 0 ? <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>No {filter} flags</div>
        : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead><tr style={{ borderBottom: '1px solid rgba(251,191,36,0.2)' }}>
                {['Player','Reason','Note','Flagged','Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: '#94a3b8', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {flags.map((f,i) => (
                  <tr key={f.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: i%2===0?'rgba(255,255,255,0.02)':'transparent' }}>
                    <td style={{ padding: '10px 12px', color: '#e2e8f0' }}>
                      <div style={{ fontWeight: 600 }}>{f.players?.display_name||'—'}</div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>{f.players?.email}</div>
                    </td>
                    <td style={{ padding: '10px 12px', color: '#f87171', fontSize: 13 }}>{f.reason||'—'}</td>
                    <td style={{ padding: '10px 12px', color: '#94a3b8', fontSize: 13, maxWidth: 200 }}>{f.note||'—'}</td>
                    <td style={{ padding: '10px 12px', color: '#64748b', fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(f.created_at)}</td>
                    <td style={{ padding: '10px 12px' }}>
                      {f.status === 'active' && <button onClick={() => openUnflag(f)} style={{ padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', background: 'rgba(74,222,128,0.15)', color: '#4ade80', fontWeight: 600, fontSize: 12 }}>Resolve</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Flag / unflag modal */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#1e293b', borderRadius: 16, padding: 32, width: 420, border: '1px solid rgba(251,191,36,0.2)' }}>
            <h2 style={{ fontFamily: 'Cinzel,serif', color: '#fbbf24', margin: '0 0 20px', fontSize: 20 }}>{modal.action === 'flag' ? 'Flag Player' : 'Resolve Flag'}</h2>

            {modal.action === 'flag' && !modal.player && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <input value={playerSearch} onChange={e=>setPlayerSearch(e.target.value)} onKeyDown={e=>e.key==='Enter'&&searchPlayers()} placeholder="Search player…" style={{ flex: 1, padding: '9px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#e2e8f0', fontSize: 14, outline: 'none' }} />
                  <button onClick={searchPlayers} style={{ padding: '9px 14px', borderRadius: 8, border: 'none', background: '#fbbf24', color: '#0f172a', cursor: 'pointer', fontWeight: 700 }}>Find</button>
                </div>
                {searchResults.map(p => <div key={p.id} onClick={() => setModal(m=>({...m,player:p}))} style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', cursor: 'pointer', marginBottom: 4, border: '1px solid rgba(255,255,255,0.06)' }}><span style={{ color: '#e2e8f0', fontWeight: 600 }}>{p.display_name}</span><span style={{ color: '#64748b', fontSize: 12, marginLeft: 8 }}>{p.email}</span></div>)}
              </div>
            )}

            {modal.action === 'flag' && modal.player && (
              <div style={{ padding: 12, background: 'rgba(248,113,113,0.08)', borderRadius: 8, border: '1px solid rgba(248,113,113,0.2)', marginBottom: 14 }}>
                <div style={{ color: '#e2e8f0', fontWeight: 600 }}>{modal.player.display_name}</div>
                <div style={{ color: '#64748b', fontSize: 12 }}>{modal.player.email}</div>
              </div>
            )}

            {modal.action === 'unflag' && (
              <div style={{ padding: 12, background: 'rgba(255,255,255,0.05)', borderRadius: 8, marginBottom: 14 }}>
                <div style={{ color: '#f87171', fontSize: 13 }}>{modal.flag?.reason}</div>
                <div style={{ color: '#e2e8f0', fontWeight: 600 }}>{modal.flag?.players?.display_name}</div>
              </div>
            )}

            {modal.action === 'flag' && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: 13, marginBottom: 6 }}>Reason (required)</label>
                <input value={reason} onChange={e=>setReason(e.target.value)} placeholder="e.g. High withdrawal frequency" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#e2e8f0', fontSize: 14, boxSizing: 'border-box' }} />
              </div>
            )}

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: 13, marginBottom: 6 }}>Note (optional)</label>
              <textarea value={note} onChange={e=>setNote(e.target.value)} rows={3} placeholder="Additional context…" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#e2e8f0', fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }} />
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button onClick={() => setModal(null)} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
              <button onClick={handleSubmit} disabled={submitting||(modal.action==='flag'&&!modal.player)} style={{ padding: '10px 24px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, background: modal.action==='flag'?'#f87171':'#4ade80', color: '#0f172a', opacity: submitting?0.7:1 }}>{submitting?'Processing…':modal.action==='flag'?'Flag Player':'Resolve'}</button>
            </div>
          </div>
        </div>
      )}
      {toast && <div style={{ position: 'fixed', bottom: 24, right: 24, padding: '12px 20px', borderRadius: 10, fontWeight: 600, fontSize: 14, zIndex: 2000, background: toast.type==='error'?'#f87171':'#4ade80', color: '#0f172a' }}>{toast.msg}</div>}
    </AdminLayout>
  );
}
