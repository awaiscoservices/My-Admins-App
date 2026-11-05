import { useState, useEffect } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import { supabase } from '../../lib/supabase';

const emptyForm = { name:'', type:'deposit_bonus', bonus_amount_cents:'', min_deposit_cents:'', start_date:'', end_date:'', active: true };

export default function AdminPromotions() {
  const [promos, setPromos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  const fetchPromos = async () => {
    setLoading(true);
    const { data } = await supabase.from('promotions').select('*').order('created_at', { ascending: false });
    setPromos(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchPromos(); }, []);

  const showToast = (msg, t='success') => { setToast({ msg, type: t }); setTimeout(() => setToast(null), 4000); };

  const openAdd = () => { setForm(emptyForm); setModal('add'); };
  const openEdit = (p) => {
    setForm({ name: p.name, type: p.type, bonus_amount_cents: p.bonus_amount_cents ? (p.bonus_amount_cents/100).toFixed(2) : '', min_deposit_cents: p.min_deposit_cents ? (p.min_deposit_cents/100).toFixed(2) : '', start_date: p.start_date?.slice(0,10)||'', end_date: p.end_date?.slice(0,10)||'', active: p.active });
    setModal(p);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { showToast('Name required','error'); return; }
    setSubmitting(true);
    try {
      const body = {
        promo_id: typeof modal === 'object' && modal !== 'add' ? modal.id : null,
        name: form.name.trim(), type: form.type,
        bonus_amount_cents: form.bonus_amount_cents ? Math.round(parseFloat(form.bonus_amount_cents)*100) : null,
        min_deposit_cents: form.min_deposit_cents ? Math.round(parseFloat(form.min_deposit_cents)*100) : null,
        start_date: form.start_date||null, end_date: form.end_date||null, active: form.active,
      };
      const res = await fetch('/api/admin/promotions/upsert', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error||'Failed');
      showToast(body.promo_id ? 'Promotion updated' : 'Promotion created');
      setModal(null); fetchPromos();
    } catch (e) { showToast(e.message,'error'); }
    finally { setSubmitting(false); }
  };

  const fmt = cents => cents != null ? `$${(cents/100).toFixed(2)}` : '—';

  return (
    <AdminLayout>
      <div style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h1 style={{ fontFamily: 'Cinzel,serif', fontSize: 26, color: '#fbbf24', margin: 0 }}>Promotions</h1>
          <button onClick={openAdd} style={{ padding: '9px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', background: '#fbbf24', color: '#0f172a', fontWeight: 700 }}>+ Create Promo</button>
        </div>

        {loading ? <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>Loading…</div>
        : promos.length === 0 ? <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>No promotions yet</div>
        : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead><tr style={{ borderBottom: '1px solid rgba(251,191,36,0.2)' }}>
                {['Name','Type','Bonus','Min Deposit','Dates','Status','Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: '#94a3b8', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {promos.map((p,i) => (
                  <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: i%2===0?'rgba(255,255,255,0.02)':'transparent' }}>
                    <td style={{ padding: '10px 12px', color: '#e2e8f0', fontWeight: 600 }}>{p.name}</td>
                    <td style={{ padding: '10px 12px', color: '#94a3b8', textTransform: 'capitalize' }}>{p.type?.replace(/_/g,' ')}</td>
                    <td style={{ padding: '10px 12px', color: '#fbbf24', fontWeight: 700 }}>{fmt(p.bonus_amount_cents)}</td>
                    <td style={{ padding: '10px 12px', color: '#e2e8f0' }}>{fmt(p.min_deposit_cents)}</td>
                    <td style={{ padding: '10px 12px', color: '#64748b', fontSize: 12 }}>{p.start_date?.slice(0,10)||'—'} → {p.end_date?.slice(0,10)||'—'}</td>
                    <td style={{ padding: '10px 12px' }}><span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: p.active?'rgba(74,222,128,0.15)':'rgba(255,255,255,0.06)', color: p.active?'#4ade80':'#64748b' }}>{p.active?'Active':'Inactive'}</span></td>
                    <td style={{ padding: '10px 12px' }}>
                      <button onClick={() => openEdit(p)} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#e2e8f0', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal !== null && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#1e293b', borderRadius: 16, padding: 32, width: 460, border: '1px solid rgba(251,191,36,0.2)', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontFamily: 'Cinzel,serif', color: '#fbbf24', margin: '0 0 20px', fontSize: 20 }}>{modal==='add'?'Create Promotion':'Edit Promotion'}</h2>
            {[['name','Promo name'],['bonus_amount_cents','Bonus amount ($)'],['min_deposit_cents','Min deposit ($)']].map(([f,lbl]) => (
              <div key={f} style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: 13, marginBottom: 6 }}>{lbl}</label>
                <input value={form[f]} onChange={e=>setForm(ff=>({...ff,[f]:e.target.value}))} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#e2e8f0', fontSize: 14, boxSizing: 'border-box' }} />
              </div>
            ))}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: 13, marginBottom: 6 }}>Type</label>
              <select value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: '#1e293b', color: '#e2e8f0', fontSize: 14 }}>
                {['deposit_bonus','free_spin','cashback','referral','vip_reward'].map(t => <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              {[['start_date','Start date'],['end_date','End date']].map(([f,lbl]) => (
                <div key={f}>
                  <label style={{ display: 'block', color: '#94a3b8', fontSize: 13, marginBottom: 6 }}>{lbl}</label>
                  <input type="date" value={form[f]} onChange={e=>setForm(ff=>({...ff,[f]:e.target.value}))} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: '#1e293b', color: '#e2e8f0', fontSize: 14 }} />
                </div>
              ))}
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.active} onChange={e=>setForm(f=>({...f,active:e.target.checked}))} />
                <span style={{ color: '#e2e8f0', fontSize: 14 }}>Active</span>
              </label>
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button onClick={() => setModal(null)} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
              <button onClick={handleSave} disabled={submitting} style={{ padding: '10px 24px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, background: '#fbbf24', color: '#0f172a', opacity: submitting?0.7:1 }}>{submitting?'Saving…':'Save'}</button>
            </div>
          </div>
        </div>
      )}
      {toast && <div style={{ position: 'fixed', bottom: 24, right: 24, padding: '12px 20px', borderRadius: 10, fontWeight: 600, fontSize: 14, zIndex: 2000, background: toast.type==='error'?'#f87171':'#4ade80', color: '#0f172a' }}>{toast.msg}</div>}
    </AdminLayout>
  );
}
