import { useState, useEffect } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import { supabase } from '../../lib/supabase';

const ROLES = ['super_admin','finance','game_ops','support','kyc_agent','risk','reporting','marketing'];

export default function AdminStaff() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | 'invite' | {staff}
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('support');
  const [editRole, setEditRole] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  const fetchStaff = async () => {
    setLoading(true);
    const { data } = await supabase.from('staff_profiles').select('id, user_id, role, active, created_at, users:user_id(email, last_sign_in_at)').order('created_at', { ascending: false });
    setStaff(data || []);
    setLoading(false);
  };
  useEffect(() => { fetchStaff(); }, []);

  const showToast = (msg, t='success') => { setToast({ msg, type: t }); setTimeout(() => setToast(null), 4000); };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) { showToast('Email required','error'); return; }
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/staff/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'invite', email: inviteEmail.trim(), role: inviteRole }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error||'Failed');
      showToast('Invite sent'); setModal(null); setInviteEmail(''); fetchStaff();
    } catch (e) { showToast(e.message,'error'); }
    finally { setSubmitting(false); }
  };

  const handleUpdateRole = async (staffId) => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/staff/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update_role', staff_id: staffId, role: editRole }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error||'Failed');
      showToast('Role updated'); setModal(null); fetchStaff();
    } catch (e) { showToast(e.message,'error'); }
    finally { setSubmitting(false); }
  };

  const handleToggleActive = async (s) => {
    const res = await fetch('/api/admin/staff/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'toggle_active', staff_id: s.id, active: !s.active }) });
    if (res.ok) { showToast(s.active?'Staff deactivated':'Staff activated'); fetchStaff(); }
  };

  const openEdit = (s) => { setEditRole(s.role); setModal(s); };
  const fmtDate = d => d ? new Date(d).toLocaleDateString() : 'Never';
  const roleColor = r => ({ super_admin:'#f87171', finance:'#4ade80', game_ops:'#fbbf24', support:'#38bdf8', kyc_agent:'#a78bfa', risk:'#fb923c', reporting:'#64748b', marketing:'#ec4899' }[r] || '#64748b');

  return (
    <AdminLayout>
      <div style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h1 style={{ fontFamily: 'Cinzel,serif', fontSize: 26, color: '#fbbf24', margin: 0 }}>Staff Accounts</h1>
          <button onClick={() => setModal('invite')} style={{ padding: '9px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', background: '#fbbf24', color: '#0f172a', fontWeight: 700 }}>+ Invite Staff</button>
        </div>

        {loading ? <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>Loading…</div>
        : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead><tr style={{ borderBottom: '1px solid rgba(251,191,36,0.2)' }}>
                {['Email','Role','Status','Last Login','Joined','Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: '#94a3b8', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {staff.map((s,i) => (
                  <tr key={s.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: i%2===0?'rgba(255,255,255,0.02)':'transparent' }}>
                    <td style={{ padding: '10px 12px', color: '#e2e8f0' }}>{s.users?.email||'—'}</td>
                    <td style={{ padding: '10px 12px' }}><span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: 'rgba(255,255,255,0.06)', color: roleColor(s.role) }}>{s.role?.replace(/_/g,' ')}</span></td>
                    <td style={{ padding: '10px 12px' }}><span style={{ color: s.active?'#4ade80':'#f87171', fontWeight: 700 }}>{s.active?'Active':'Inactive'}</span></td>
                    <td style={{ padding: '10px 12px', color: '#64748b', fontSize: 12 }}>{fmtDate(s.users?.last_sign_in_at)}</td>
                    <td style={{ padding: '10px 12px', color: '#64748b', fontSize: 12 }}>{fmtDate(s.created_at)}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => openEdit(s)} style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#e2e8f0', cursor: 'pointer', fontSize: 12 }}>Role</button>
                        <button onClick={() => handleToggleActive(s)} style={{ padding: '5px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: s.active?'rgba(248,113,113,0.15)':'rgba(74,222,128,0.15)', color: s.active?'#f87171':'#4ade80' }}>{s.active?'Deactivate':'Activate'}</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invite modal */}
      {modal === 'invite' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#1e293b', borderRadius: 16, padding: 32, width: 400, border: '1px solid rgba(251,191,36,0.2)' }}>
            <h2 style={{ fontFamily: 'Cinzel,serif', color: '#fbbf24', margin: '0 0 20px', fontSize: 20 }}>Invite Staff</h2>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: 13, marginBottom: 6 }}>Email</label>
              <input value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} type="email" placeholder="staff@example.com" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#e2e8f0', fontSize: 14, boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: 13, marginBottom: 6 }}>Role</label>
              <select value={inviteRole} onChange={e=>setInviteRole(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: '#1e293b', color: '#e2e8f0', fontSize: 14 }}>
                {ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g,' ')}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button onClick={() => setModal(null)} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
              <button onClick={handleInvite} disabled={submitting} style={{ padding: '10px 24px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, background: '#fbbf24', color: '#0f172a' }}>{submitting?'Sending…':'Send Invite'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit role modal */}
      {modal && modal !== 'invite' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#1e293b', borderRadius: 16, padding: 32, width: 360, border: '1px solid rgba(251,191,36,0.2)' }}>
            <h2 style={{ fontFamily: 'Cinzel,serif', color: '#fbbf24', margin: '0 0 20px', fontSize: 20 }}>Change Role</h2>
            <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 14 }}>{modal.users?.email}</div>
            <div style={{ marginBottom: 20 }}>
              <select value={editRole} onChange={e=>setEditRole(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: '#1e293b', color: '#e2e8f0', fontSize: 14 }}>
                {ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g,' ')}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button onClick={() => setModal(null)} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
              <button onClick={() => handleUpdateRole(modal.id)} disabled={submitting} style={{ padding: '10px 24px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, background: '#fbbf24', color: '#0f172a' }}>{submitting?'Saving…':'Save'}</button>
            </div>
          </div>
        </div>
      )}
      {toast && <div style={{ position: 'fixed', bottom: 24, right: 24, padding: '12px 20px', borderRadius: 10, fontWeight: 600, fontSize: 14, zIndex: 2000, background: toast.type==='error'?'#f87171':'#4ade80', color: '#0f172a' }}>{toast.msg}</div>}
    </AdminLayout>
  );
}
