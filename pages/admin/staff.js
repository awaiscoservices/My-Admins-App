/**
 * /admin/staff
 *
 * Admin — Staff Management
 * List all staff accounts. Invite new staff, change roles, deactivate.
 * super_admin only.
 */
import { useEffect, useState } from 'react'
import Head from 'next/head'
import { supabase } from '../../lib/supabase'
import AdminLayout from '../../components/layout/AdminLayout'

const ROLES = ['admin', 'finance', 'game_ops', 'support']
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

const ROLE_COLOR = {
  super_admin: '#f59e0b',
  admin:       '#fbbf24',
  finance:     '#22c55e',
  game_ops:    '#38bdf8',
  support:     '#a78bfa',
}

export default function AdminStaff() {
  const [staff,    setStaff]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [role,     setRole]     = useState('')
  const [toast,    setToast]    = useState(null)
  const [modal,    setModal]    = useState(null)   // 'invite' | { type:'role'|'deactivate', member }
  const [invite,   setInvite]   = useState({ email:'', role:'admin', tenant_id:'' })
  const [tenants,  setTenants]  = useState([])
  const [saving,   setSaving]   = useState(false)
  const [myId,     setMyId]     = useState(null)

  useEffect(() => { load() }, [])

  // Super admins can staff any casino, so they get a picker. Everyone else
  // invites into their own, which the API fills in from their profile.
  useEffect(() => {
    if (role !== 'super_admin') return
    ;(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return
        const res = await fetch('/api/superadmin/tenants/list?limit=100', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (!res.ok) return
        const d = await res.json()
        setTenants(d.tenants || [])
      } catch { /* picker just stays hidden */ }
    })()
  }, [role])

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  async function load() {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setLoading(false); return }
    setMyId(session.user.id)

    const { data: p } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
    setRole(p?.role || '')

    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, status, created_at')
      .in('role', ['super_admin', 'admin', 'finance', 'game_ops', 'support'])
      .order('created_at', { ascending: true })

    if (error) { showToast(error.message, 'error'); setLoading(false); return }
    setStaff(data || [])
    setLoading(false)
  }

  async function changeRole(memberId, newRole) {
    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/admin/staff/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ user_id: memberId, action: 'change_role', role: newRole }),
    })
    const json = await res.json()
    setSaving(false)
    setModal(null)
    if (!res.ok) { showToast(json.error || 'Failed', 'error'); return }
    showToast('Role updated')
    load()
  }

  async function deactivate(memberId) {
    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/admin/staff/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ user_id: memberId, action: 'deactivate' }),
    })
    const json = await res.json()
    setSaving(false)
    setModal(null)
    if (!res.ok) { showToast(json.error || 'Failed', 'error'); return }
    showToast('Staff member deactivated')
    load()
  }

  async function sendInvite() {
    if (!invite.email.trim()) { showToast('Email required', 'error'); return }
    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/admin/staff/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify(
        invite.tenant_id ? invite : { email: invite.email, role: invite.role }
      ),
    })
    const json = await res.json()
    setSaving(false)
    if (!res.ok) { showToast(json.error || 'Invite failed', 'error'); return }
    showToast(`Invite sent to ${invite.email}`)
    setModal(null)
    setInvite({ email:'', role:'admin', tenant_id:'' })
    load()
  }

  const isSuperAdmin = role === 'super_admin'

  return (
    <AdminLayout>
      <Head><title>Staff — Admin</title></Head>

      {toast && (
        <div style={{ position:'fixed', top:16, left:'50%', transform:'translateX(-50%)', zIndex:9999,
          background: toast.type==='error' ? 'rgba(239,68,68,.95)' : 'rgba(34,197,94,.95)',
          borderRadius:12, padding:'12px 24px', color:'#fff', fontSize:14, fontWeight:600,
          fontFamily:"'Outfit',sans-serif", whiteSpace:'nowrap', boxShadow:'0 8px 32px rgba(0,0,0,.5)' }}>
          {toast.msg}
        </div>
      )}

      {/* Invite modal */}
      {modal === 'invite' && (
        <div style={{ position:'fixed', inset:0, zIndex:9998, background:'rgba(0,0,0,.7)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:'#0d1f35', border:'1px solid rgba(255,255,255,.1)', borderRadius:20, padding:28, maxWidth:400, width:'100%' }}>
            <div style={{ fontSize:16, fontWeight:800, color:'#fff', marginBottom:20, fontFamily:"'Cinzel',serif" }}>Invite Staff Member</div>
            <FieldInput label="Email Address" value={invite.email} onChange={v => setInvite(i => ({...i, email:v}))} type="email" />
            <div style={{ marginTop:14, marginBottom:20 }}>
              <label style={{ display:'block', fontSize:10, fontWeight:800, letterSpacing:'.1em', textTransform:'uppercase', color:'rgba(255,255,255,.35)', marginBottom:6 }}>Role</label>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {ROLES.map(r => (
                  <button key={r} onClick={() => setInvite(i => ({...i, role:r}))} style={{
                    padding:'7px 14px', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:"'Outfit',sans-serif",
                    background: invite.role===r ? `${ROLE_COLOR[r]}22` : 'rgba(255,255,255,.05)',
                    border: invite.role===r ? `1px solid ${ROLE_COLOR[r]}55` : '1px solid rgba(255,255,255,.1)',
                    color: invite.role===r ? (ROLE_COLOR[r]||'#fbbf24') : 'rgba(255,255,255,.4)',
                  }}>{r}</button>
                ))}
              </div>
            </div>
            {role === 'super_admin' && tenants.length > 0 && (
              <div style={{ marginBottom:20 }}>
                <label style={{ display:'block', fontSize:10, fontWeight:800, letterSpacing:'.1em', textTransform:'uppercase', color:'rgba(255,255,255,.35)', marginBottom:6 }}>Casino</label>
                <select
                  value={invite.tenant_id}
                  onChange={e => setInvite(i => ({ ...i, tenant_id: e.target.value }))}
                  style={{ width:'100%', padding:'10px 12px', borderRadius:10, background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.12)', color:'#fff', fontSize:13, fontFamily:"'Outfit',sans-serif" }}>
                  <option value="">My own casino</option>
                  {tenants.map(t => (
                    <option key={t.id} value={t.id} style={{ background:'#0d1f35' }}>
                      {t.name}{t.status !== 'active' ? ` (${t.status})` : ''}
                    </option>
                  ))}
                </select>
                <div style={{ fontSize:11, color:'rgba(255,255,255,.3)', marginTop:6 }}>
                  They will only ever see this casino's players and money.
                </div>
              </div>
            )}

            <div style={{ display:'flex', gap:10 }}>
              <button onClick={sendInvite} disabled={saving} style={{ flex:1, padding:'10px 0', background:'linear-gradient(135deg,#fbbf24,#f59e0b)', border:'none', borderRadius:10, color:'#000', fontSize:13, fontWeight:800, cursor:'pointer', fontFamily:"'Outfit',sans-serif" }}>
                {saving ? 'Sending…' : 'Send Invite'}
              </button>
              <button onClick={() => setModal(null)} style={{ padding:'10px 18px', background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.1)', borderRadius:10, color:'rgba(255,255,255,.5)', fontSize:13, cursor:'pointer', fontFamily:"'Outfit',sans-serif" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change role modal */}
      {modal?.type === 'role' && (
        <div style={{ position:'fixed', inset:0, zIndex:9998, background:'rgba(0,0,0,.7)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:'#0d1f35', border:'1px solid rgba(255,255,255,.1)', borderRadius:20, padding:28, maxWidth:360, width:'100%' }}>
            <div style={{ fontSize:16, fontWeight:800, color:'#fff', marginBottom:6, fontFamily:"'Cinzel',serif" }}>Change Role</div>
            <div style={{ fontSize:13, color:'rgba(255,255,255,.5)', marginBottom:20 }}>{modal.member.full_name}</div>
            <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:20 }}>
              {ROLES.map(r => (
                <button key={r} onClick={() => changeRole(modal.member.id, r)} disabled={modal.member.role===r || saving} style={{
                  padding:'10px 16px', borderRadius:10, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:"'Outfit',sans-serif", textAlign:'left',
                  background: modal.member.role===r ? `${ROLE_COLOR[r]}22` : 'rgba(255,255,255,.04)',
                  border: modal.member.role===r ? `1px solid ${ROLE_COLOR[r]}55` : '1px solid rgba(255,255,255,.08)',
                  color: modal.member.role===r ? (ROLE_COLOR[r]||'#fbbf24') : 'rgba(255,255,255,.6)',
                  opacity: modal.member.role===r ? 1 : undefined,
                }}>
                  {r} {modal.member.role===r && '← current'}
                </button>
              ))}
            </div>
            <button onClick={() => setModal(null)} style={{ width:'100%', padding:'10px', background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.1)', borderRadius:10, color:'rgba(255,255,255,.5)', fontSize:13, cursor:'pointer', fontFamily:"'Outfit',sans-serif" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontFamily:"'Cinzel',serif", fontSize:22, fontWeight:700, color:'#fff', margin:0 }}>Staff</h1>
          <p style={{ color:'rgba(255,255,255,.35)', fontSize:13, marginTop:4 }}>Manage admin team members and roles</p>
        </div>
        {isSuperAdmin && (
          <button onClick={() => setModal('invite')} style={{ padding:'10px 20px', background:'linear-gradient(135deg,#fbbf24,#f59e0b)', border:'none', borderRadius:10, color:'#000', fontSize:13, fontWeight:800, cursor:'pointer', fontFamily:"'Outfit',sans-serif" }}>
            + Invite Staff
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ padding:60, textAlign:'center', color:'rgba(255,255,255,.3)' }}>Loading…</div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {staff.map(member => {
            const color = ROLE_COLOR[member.role] || '#94a3b8'
            const isMe = member.id === myId
            return (
              <div key={member.id} style={{ background:'rgba(255,255,255,.025)', border:'1px solid rgba(255,255,255,.07)', borderRadius:14, padding:'16px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12, opacity: member.status==='suspended' ? 0.4 : 1 }}>
                <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                  <div style={{ width:38, height:38, borderRadius:'50%', background:`${color}22`, border:`1px solid ${color}44`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, fontWeight:800, color, flexShrink:0, fontFamily:"'Cinzel',serif" }}>
                    {member.full_name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <div style={{ fontSize:14, fontWeight:700, color:'#fff' }}>
                      {member.full_name || '—'}
                      {isMe && <span style={{ marginLeft:8, fontSize:10, color:'rgba(255,255,255,.3)', fontWeight:400 }}>(you)</span>}
                      {member.status === 'suspended' && <span style={{ marginLeft:8, fontSize:10, color:'#f87171' }}>Deactivated</span>}
                    </div>
                    <div style={{ fontSize:11, color:'rgba(255,255,255,.35)', marginTop:2 }}>
                      {member.email} · Joined {fmtDate(member.created_at)}
                    </div>
                  </div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <span style={{ padding:'4px 10px', borderRadius:20, fontSize:11, fontWeight:800, background:`${color}22`, color }}>
                    {member.role}
                  </span>
                  {isSuperAdmin && !isMe && member.role !== 'super_admin' && member.status !== 'suspended' && (
                    <>
                      <button onClick={() => setModal({ type:'role', member })} style={{ padding:'7px 12px', background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.1)', borderRadius:8, color:'rgba(255,255,255,.5)', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:"'Outfit',sans-serif" }}>
                        Change Role
                      </button>
                      <button onClick={() => { if(window.confirm(`Deactivate ${member.full_name}?`)) deactivate(member.id) }} style={{ padding:'7px 12px', background:'rgba(239,68,68,.08)', border:'1px solid rgba(239,68,68,.2)', borderRadius:8, color:'#f87171', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:"'Outfit',sans-serif" }}>
                        Deactivate
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </AdminLayout>
  )
}

function FieldInput({ label, value, onChange, type='text' }) {
  return (
    <div>
      <label style={{ display:'block', fontSize:10, fontWeight:800, letterSpacing:'.1em', textTransform:'uppercase', color:'rgba(255,255,255,.35)', marginBottom:6 }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        style={{ width:'100%', padding:'9px 12px', background:'rgba(255,255,255,.07)', border:'1px solid rgba(255,255,255,.12)', borderRadius:8, color:'#fff', fontSize:14, fontFamily:"'Outfit',sans-serif", outline:'none', boxSizing:'border-box' }} />
    </div>
  )
}
