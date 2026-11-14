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
  const [modal,    setModal]    = useState(null)   // 'create' | { type:'role'|'deactivate', member }
  const [invite,   setInvite]   = useState({ email:'', full_name:'', password:'', role:'admin', tenant_id:'' })
  const [created,  setCreated]  = useState(null)   // { email, password, role } — shown after a save
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

    // Through the guarded route. Read straight from the browser, this listed
    // every casino's staff to every casino's admin.
    const res = await fetch('/api/admin/staff/list', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    const d = await res.json()

    if (!res.ok) { showToast(d.error || 'Could not load staff', 'error'); setLoading(false); return }
    setStaff(d.staff || d.rows || [])
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

  // Make a strong random password the admin can hand over (or overwrite).
  function genPassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%'
    let p = ''
    const arr = new Uint32Array(14)
    ;(window.crypto || window.msCrypto).getRandomValues(arr)
    for (let i = 0; i < 14; i++) p += chars[arr[i] % chars.length]
    setInvite(i => ({ ...i, password: p }))
  }

  async function createStaff() {
    if (!invite.email.trim()) { showToast('Email required', 'error'); return }
    if (invite.password.length < 8) { showToast('Password must be at least 8 characters', 'error'); return }
    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/admin/staff/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify(
        invite.tenant_id ? invite : { email: invite.email, full_name: invite.full_name, password: invite.password, role: invite.role }
      ),
    })
    const json = await res.json()
    setSaving(false)
    if (!res.ok) { showToast(json.error || 'Could not create staff', 'error'); return }
    // Show the credentials so the admin can copy and send them.
    setCreated({ email: invite.email.trim(), password: invite.password, role: invite.role })
    setModal(null)
    setInvite({ email:'', full_name:'', password:'', role:'admin', tenant_id:'' })
    load()
  }

  const isSuperAdmin = role === 'super_admin'
  // A tenant admin manages their own casino's staff too (the invite/update
  // routes already allow it) — not only the platform super admin.
  const canManage = role === 'admin' || role === 'super_admin'

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

      {/* Credentials shown after a staff account is created */}
      {created && (
        <div style={{ position:'fixed', inset:0, zIndex:9998, background:'rgba(0,0,0,.7)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:'#0d1f35', border:'1px solid rgba(34,197,94,.3)', borderRadius:20, padding:28, maxWidth:420, width:'100%' }}>
            <div style={{ fontSize:16, fontWeight:800, color:'#fff', marginBottom:6, fontFamily:"'Cinzel',serif" }}>Staff account created ✅</div>
            <div style={{ fontSize:13, color:'rgba(255,255,255,.5)', marginBottom:18 }}>Send these login details to the <strong style={{color:'#fbbf24'}}>{created.role}</strong>. They sign in on the normal login page.</div>
            {[['Email', created.email], ['Password', created.password]].map(([k,v]) => (
              <div key={k} style={{ marginBottom:12 }}>
                <label style={{ display:'block', fontSize:10, fontWeight:800, letterSpacing:'.1em', textTransform:'uppercase', color:'rgba(255,255,255,.35)', marginBottom:6 }}>{k}</label>
                <div style={{ display:'flex', gap:8 }}>
                  <div style={{ flex:1, padding:'10px 12px', background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.12)', borderRadius:8, color:'#fff', fontSize:14, fontFamily:'monospace', wordBreak:'break-all' }}>{v}</div>
                  <button onClick={() => { navigator.clipboard?.writeText(v); showToast(`${k} copied`) }} style={{ padding:'0 14px', background:'rgba(251,191,36,.15)', border:'1px solid rgba(251,191,36,.35)', borderRadius:8, color:'#fbbf24', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:"'Outfit',sans-serif" }}>Copy</button>
                </div>
              </div>
            ))}
            <button onClick={() => { navigator.clipboard?.writeText(`Email: ${created.email}\nPassword: ${created.password}`); showToast('Both copied') }}
              style={{ width:'100%', marginTop:6, marginBottom:10, padding:'10px 0', background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.12)', borderRadius:10, color:'rgba(255,255,255,.7)', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:"'Outfit',sans-serif" }}>
              Copy both
            </button>
            <button onClick={() => setCreated(null)} style={{ width:'100%', padding:'10px 0', background:'linear-gradient(135deg,#fbbf24,#f59e0b)', border:'none', borderRadius:10, color:'#000', fontSize:13, fontWeight:800, cursor:'pointer', fontFamily:"'Outfit',sans-serif" }}>
              Done
            </button>
          </div>
        </div>
      )}

      {/* Create staff modal */}
      {modal === 'create' && (
        <div style={{ position:'fixed', inset:0, zIndex:9998, background:'rgba(0,0,0,.7)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:'#0d1f35', border:'1px solid rgba(255,255,255,.1)', borderRadius:20, padding:28, maxWidth:400, width:'100%' }}>
            <div style={{ fontSize:16, fontWeight:800, color:'#fff', marginBottom:20, fontFamily:"'Cinzel',serif" }}>Add Staff Member</div>
            <FieldInput label="Email Address" value={invite.email} onChange={v => setInvite(i => ({...i, email:v}))} type="email" />
            <div style={{ marginTop:14 }}>
              <FieldInput label="Full Name (optional)" value={invite.full_name} onChange={v => setInvite(i => ({...i, full_name:v}))} />
            </div>
            <div style={{ marginTop:14 }}>
              <label style={{ display:'block', fontSize:10, fontWeight:800, letterSpacing:'.1em', textTransform:'uppercase', color:'rgba(255,255,255,.35)', marginBottom:6 }}>Password</label>
              <div style={{ display:'flex', gap:8 }}>
                <input type="text" value={invite.password} onChange={e => setInvite(i => ({...i, password:e.target.value}))} placeholder="Min 8 characters"
                  style={{ flex:1, padding:'9px 12px', background:'rgba(255,255,255,.07)', border:'1px solid rgba(255,255,255,.12)', borderRadius:8, color:'#fff', fontSize:14, fontFamily:'monospace', outline:'none', boxSizing:'border-box' }} />
                <button type="button" onClick={genPassword} style={{ padding:'0 14px', background:'rgba(251,191,36,.15)', border:'1px solid rgba(251,191,36,.35)', borderRadius:8, color:'#fbbf24', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:"'Outfit',sans-serif", whiteSpace:'nowrap' }}>Generate</button>
              </div>
            </div>
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
              <button onClick={createStaff} disabled={saving} style={{ flex:1, padding:'10px 0', background:'linear-gradient(135deg,#fbbf24,#f59e0b)', border:'none', borderRadius:10, color:'#000', fontSize:13, fontWeight:800, cursor:'pointer', fontFamily:"'Outfit',sans-serif" }}>
                {saving ? 'Creating…' : 'Create Account'}
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
        {canManage && (
          <button onClick={() => setModal('create')} style={{ padding:'10px 20px', background:'linear-gradient(135deg,#fbbf24,#f59e0b)', border:'none', borderRadius:10, color:'#000', fontSize:13, fontWeight:800, cursor:'pointer', fontFamily:"'Outfit',sans-serif" }}>
            + Add Staff
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
                  {canManage && !isMe && member.role !== 'super_admin' && member.status !== 'suspended' && (
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
