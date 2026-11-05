import { useState, useEffect } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import { supabase } from '../../lib/supabase';

const emptyForm = { name: '', provider: '', game_url: '', credentials_json: '', status: 'active' };

export default function AdminGames() {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | 'add' | {game}
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  const fetchGames = async () => {
    setLoading(true);
    const { data } = await supabase.from('games').select('id, name, provider, game_url, status, created_at').order('name');
    setGames(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchGames(); }, []);

  const showToast = (msg, t='success') => { setToast({ msg, type: t }); setTimeout(() => setToast(null), 4000); };
  const openAdd = () => { setForm(emptyForm); setModal('add'); };
  const openEdit = (g) => { setForm({ name: g.name, provider: g.provider||'', game_url: g.game_url||'', credentials_json: '', status: g.status }); setModal(g); };
  const closeModal = () => setModal(null);

  const handleSave = async () => {
    if (!form.name.trim()) { showToast('Name required', 'error'); return; }
    setSubmitting(true);
    try {
      const body = { ...form, game_id: typeof modal === 'object' && modal !== null && modal.id ? modal.id : null };
      const res = await fetch('/api/admin/games/upsert', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed');
      showToast(body.game_id ? 'Game updated' : 'Game added');
      closeModal(); fetchGames();
    } catch (e) { showToast(e.message, 'error'); }
    finally { setSubmitting(false); }
  };

  const toggleStatus = async (game) => {
    const newStatus = game.status === 'active' ? 'inactive' : 'active';
    const res = await fetch('/api/admin/games/upsert', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ game_id: game.id, name: game.name, provider: game.provider, game_url: game.game_url, status: newStatus, credentials_json: '' }) });
    if (res.ok) { showToast(`Game ${newStatus}`); fetchGames(); }
  };

  const inp = (field, placeholder, type='text') => (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', color: '#94a3b8', fontSize: 13, marginBottom: 6, textTransform: 'capitalize' }}>{field.replace(/_/g,' ')}</label>
      <input type={type} value={form[field]} onChange={e=>setForm(f=>({...f,[field]:e.target.value}))} placeholder={placeholder} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#e2e8f0', fontSize: 14, boxSizing: 'border-box' }} />
    </div>
  );

  return (
    <AdminLayout>
      <div style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h1 style={{ fontFamily: 'Cinzel,serif', fontSize: 26, color: '#fbbf24', margin: 0 }}>Game Catalog</h1>
          <button onClick={openAdd} style={{ padding: '9px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', background: '#fbbf24', color: '#0f172a', fontWeight: 700 }}>+ Add Game</button>
        </div>

        {loading ? <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>Loading…</div>
        : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
            {games.map(g => (
              <div key={g.id} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: `1px solid ${g.status==='active'?'rgba(74,222,128,0.15)':'rgba(255,255,255,0.06)'}`, padding: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 15 }}>{g.name}</div>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: g.status==='active'?'rgba(74,222,128,0.15)':'rgba(255,255,255,0.06)', color: g.status==='active'?'#4ade80':'#64748b' }}>{g.status}</span>
                </div>
                <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 14 }}>{g.provider||'No provider'}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => openEdit(g)} style={{ flex: 1, padding: '7px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#e2e8f0', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Edit</button>
                  <button onClick={() => toggleStatus(g)} style={{ flex: 1, padding: '7px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: g.status==='active'?'rgba(248,113,113,0.15)':'rgba(74,222,128,0.15)', color: g.status==='active'?'#f87171':'#4ade80' }}>{g.status==='active'?'Disable':'Enable'}</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modal !== null && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#1e293b', borderRadius: 16, padding: 32, width: 460, border: '1px solid rgba(251,191,36,0.2)', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontFamily: 'Cinzel,serif', color: '#fbbf24', margin: '0 0 20px', fontSize: 20 }}>{modal === 'add' ? 'Add Game' : 'Edit Game'}</h2>
            {inp('name','Game name (e.g. Lucky Slots)')}
            {inp('provider','Provider / platform')}
            {inp('game_url','Game URL')}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: 13, marginBottom: 6 }}>Credentials JSON (encrypted on save)</label>
              <textarea value={form.credentials_json} onChange={e=>setForm(f=>({...f,credentials_json:e.target.value}))} rows={4} placeholder='{"api_key":"...","secret":"..."}' style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#e2e8f0', fontSize: 13, fontFamily: 'monospace', resize: 'vertical', boxSizing: 'border-box' }} />
              <div style={{ color: '#64748b', fontSize: 11, marginTop: 4 }}>Leave blank to keep existing credentials</div>
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: 13, marginBottom: 6 }}>Status</label>
              <select value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: '#1e293b', color: '#e2e8f0', fontSize: 14 }}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button onClick={closeModal} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
              <button onClick={handleSave} disabled={submitting} style={{ padding: '10px 24px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, background: '#fbbf24', color: '#0f172a', opacity: submitting?0.7:1 }}>{submitting?'Saving…':'Save'}</button>
            </div>
          </div>
        </div>
      )}
      {toast && <div style={{ position: 'fixed', bottom: 24, right: 24, padding: '12px 20px', borderRadius: 10, fontWeight: 600, fontSize: 14, zIndex: 2000, background: toast.type==='error'?'#f87171':'#4ade80', color: '#0f172a' }}>{toast.msg}</div>}
    </AdminLayout>
  );
}
