import { useState } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import { supabase } from '../../lib/supabase';

export default function AdminAdjustments() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [player, setPlayer] = useState(null);
  const [type, setType] = useState('credit');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);
  const [history, setHistory] = useState([]);

  const showToast = (msg, t='success') => { setToast({ msg, type: t }); setTimeout(() => setToast(null), 4000); };

  const search = async () => {
    if (!query.trim()) return;
    const { data } = await supabase.from('players').select('id, display_name, email').or(`email.ilike.%${query}%,display_name.ilike.%${query}%`).limit(10);
    setResults(data || []);
  };

  const selectPlayer = async (p) => {
    setPlayer(p); setResults([]);
    const { data } = await supabase.from('ledger_entries').select('*').eq('player_id', p.id).eq('type','adjustment').order('created_at',{ascending:false}).limit(20);
    setHistory(data || []);
  };

  const handleSubmit = async () => {
    if (!player) { showToast('Select a player', 'error'); return; }
    const amtCents = Math.round(parseFloat(amount) * 100);
    if (!amtCents || amtCents <= 0) { showToast('Invalid amount', 'error'); return; }
    if (!reason.trim()) { showToast('Reason required', 'error'); return; }
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/adjustments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_id: player.id, type, amount_cents: amtCents, reason }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed');
      showToast(`Adjustment applied: ${type} $${(amtCents/100).toFixed(2)}`);
      setAmount(''); setReason(''); setType('credit');
      selectPlayer(player);
    } catch (e) { showToast(e.message, 'error'); }
    finally { setSubmitting(false); }
  };

  const fmt = cents => cents != null ? `$${(cents/100).toFixed(2)}` : '—';

  return (
    <AdminLayout>
      <div style={{ padding: 24 }}>
        <h1 style={{ fontFamily: 'Cinzel,serif', fontSize: 26, color: '#fbbf24', margin: '0 0 24px' }}>Balance Adjustments</h1>
        <div style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 10, padding: '12px 16px', marginBottom: 24, color: '#f87171', fontSize: 13 }}>
          ⚠ Adjustments are permanent ledger entries. Always provide a clear reason for audit compliance.
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Form */}
          <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', padding: 20 }}>
            <div style={{ color: '#e2e8f0', fontWeight: 700, marginBottom: 16 }}>New Adjustment</div>

            {/* Player search */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: 13, marginBottom: 6 }}>Player</label>
              {player ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: 8, background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}>
                  <div>
                    <div style={{ color: '#e2e8f0', fontWeight: 600 }}>{player.display_name}</div>
                    <div style={{ color: '#64748b', fontSize: 12 }}>{player.email}</div>
                  </div>
                  <button onClick={() => { setPlayer(null); setHistory([]); }} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 18 }}>×</button>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==='Enter'&&search()} placeholder="Search player…" style={{ flex: 1, padding: '9px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#e2e8f0', fontSize: 14, outline: 'none' }} />
                    <button onClick={search} style={{ padding: '9px 14px', borderRadius: 8, border: 'none', background: '#fbbf24', color: '#0f172a', cursor: 'pointer', fontWeight: 700 }}>Find</button>
                  </div>
                  {results.map(p => (
                    <div key={p.id} onClick={() => selectPlayer(p)} style={{ marginTop: 4, padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{p.display_name}</span>
                      <span style={{ color: '#64748b', fontSize: 12, marginLeft: 8 }}>{p.email}</span>
                    </div>
                  ))}
                </>
              )}
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: 13, marginBottom: 6 }}>Type</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {['credit','debit'].map(t => (
                  <button key={t} onClick={() => setType(t)} style={{ flex: 1, padding: '9px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, textTransform: 'capitalize', background: type===t?(t==='credit'?'rgba(74,222,128,0.2)':'rgba(248,113,113,0.2)'):'rgba(255,255,255,0.05)', color: type===t?(t==='credit'?'#4ade80':'#f87171'):'#94a3b8' }}>{t}</button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: 13, marginBottom: 6 }}>Amount ($)</label>
              <input type="number" step="0.01" min="0.01" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0.00" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#e2e8f0', fontSize: 14, boxSizing: 'border-box' }} />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: 13, marginBottom: 6 }}>Reason (required)</label>
              <textarea value={reason} onChange={e=>setReason(e.target.value)} rows={3} placeholder="Enter reason for adjustment…" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#e2e8f0', fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }} />
            </div>

            <button onClick={handleSubmit} disabled={submitting||!player} style={{ width: '100%', padding: '12px', borderRadius: 8, border: 'none', cursor: submitting||!player?'not-allowed':'pointer', fontWeight: 700, fontSize: 15, background: player?'#fbbf24':'rgba(255,255,255,0.1)', color: player?'#0f172a':'#475569', opacity: submitting?0.7:1 }}>{submitting?'Applying…':'Apply Adjustment'}</button>
          </div>

          {/* History */}
          <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', padding: 20 }}>
            <div style={{ color: '#e2e8f0', fontWeight: 700, marginBottom: 16 }}>Adjustment History {player && `— ${player.display_name}`}</div>
            {history.length === 0 ? <div style={{ color: '#64748b', textAlign: 'center', padding: 40 }}>{player ? 'No adjustments yet' : 'Select a player'}</div>
            : history.map(h => (
              <div key={h.id} style={{ marginBottom: 10, padding: '10px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderLeft: `3px solid ${h.direction==='credit'?'#4ade80':'#f87171'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: h.direction==='credit'?'#4ade80':'#f87171', fontWeight: 700 }}>{h.direction==='credit'?'+':'-'}{fmt(h.amount_cents)}</span>
                  <span style={{ color: '#64748b', fontSize: 12 }}>{new Date(h.created_at).toLocaleDateString()}</span>
                </div>
                <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>{h.description||h.ref_id}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {toast && <div style={{ position: 'fixed', bottom: 24, right: 24, padding: '12px 20px', borderRadius: 10, fontWeight: 600, fontSize: 14, zIndex: 2000, background: toast.type==='error'?'#f87171':'#4ade80', color: '#0f172a' }}>{toast.msg}</div>}
    </AdminLayout>
  );
}
