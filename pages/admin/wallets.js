import { useState } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import { supabase } from '../../lib/supabase';

const Tile = ({ label, value, color = '#e2e8f0' }) => (
  <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '16px 20px', border: '1px solid rgba(255,255,255,0.06)' }}>
    <div style={{ color: '#64748b', fontSize: 12, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
    <div style={{ color, fontSize: 22, fontWeight: 700 }}>{value}</div>
  </div>
);

export default function AdminWallets() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type='success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 4000); };

  const search = async () => {
    if (!query.trim()) return;
    setLoading(true);
    const { data } = await supabase.from('players').select('id, display_name, email, kyc_status, created_at').or(`email.ilike.%${query}%,display_name.ilike.%${query}%`).limit(20);
    setResults(data || []);
    setSelected(null); setWallet(null);
    setLoading(false);
  };

  const selectPlayer = async (player) => {
    setSelected(player);
    const { data } = await supabase.from('wallets').select('*').eq('player_id', player.id).single();
    setWallet(data);
  };

  const fmt = cents => cents != null ? `$${(cents/100).toFixed(2)}` : '—';
  const fmtDate = d => d ? new Date(d).toLocaleDateString() : '—';

  return (
    <AdminLayout>
      <div style={{ padding: 24 }}>
        <h1 style={{ fontFamily: 'Cinzel,serif', fontSize: 26, color: '#fbbf24', margin: '0 0 24px' }}>Player Wallets</h1>

        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          <input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==='Enter'&&search()} placeholder="Search by email or display name…" style={{ flex: 1, padding: '10px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#e2e8f0', fontSize: 14, outline: 'none' }} />
          <button onClick={search} disabled={loading} style={{ padding: '10px 24px', borderRadius: 8, border: 'none', cursor: 'pointer', background: '#fbbf24', color: '#0f172a', fontWeight: 700 }}>Search</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: results.length>0?'300px 1fr':'1fr', gap: 20 }}>
          {results.length > 0 && (
            <div>
              {results.map(p => (
                <div key={p.id} onClick={() => selectPlayer(p)} style={{ padding: '12px 14px', marginBottom: 6, borderRadius: 10, border: `1px solid ${selected?.id===p.id?'rgba(251,191,36,0.4)':'rgba(255,255,255,0.06)'}`, background: selected?.id===p.id?'rgba(251,191,36,0.05)':'rgba(255,255,255,0.02)', cursor: 'pointer' }}>
                  <div style={{ color: '#e2e8f0', fontWeight: 600 }}>{p.display_name||'—'}</div>
                  <div style={{ color: '#64748b', fontSize: 12 }}>{p.email}</div>
                  <div style={{ color: p.kyc_status==='verified'?'#4ade80':'#fbbf24', fontSize: 11, marginTop: 4, textTransform: 'uppercase', fontWeight: 700 }}>{p.kyc_status||'unverified'}</div>
                </div>
              ))}
            </div>
          )}

          {selected && wallet && (
            <div>
              <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', padding: 20, marginBottom: 16 }}>
                <div style={{ fontFamily: 'Cinzel,serif', color: '#fbbf24', fontSize: 18, marginBottom: 4 }}>{selected.display_name}</div>
                <div style={{ color: '#64748b', fontSize: 13 }}>{selected.email} · Joined {fmtDate(selected.created_at)}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
                <Tile label="Cash Balance" value={fmt(wallet.cash_balance_cents)} color="#fbbf24" />
                <Tile label="Withdrawable" value={fmt(wallet.withdrawable_cents)} color="#4ade80" />
                <Tile label="Reserved" value={fmt(wallet.reserved_cents)} color="#f87171" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                <Tile label="Bonus" value={fmt(wallet.bonus_cents)} color="#a78bfa" />
                <Tile label="XP Points" value={(wallet.xp_points||0).toLocaleString()} color="#38bdf8" />
                <Tile label="Level" value={wallet.level||1} color="#fb923c" />
              </div>
            </div>
          )}
          {selected && !wallet && <div style={{ color: '#94a3b8', padding: 40, textAlign: 'center' }}>No wallet found for this player</div>}
        </div>
      </div>
      {toast && <div style={{ position: 'fixed', bottom: 24, right: 24, padding: '12px 20px', borderRadius: 10, fontWeight: 600, fontSize: 14, zIndex: 2000, background: toast.type==='error'?'#f87171':'#4ade80', color: '#0f172a' }}>{toast.msg}</div>}
    </AdminLayout>
  );
}
