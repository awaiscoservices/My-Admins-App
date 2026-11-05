import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { signUpWithEmail, signInWithGoogle } from '../../lib/auth';
import Logo from '../../components/ui/Logo'

const PARTICLES = ['♠', '♥', '♦', '♣'];

function Particle({ symbol, style }) {
  return (
    <div style={{ position: 'fixed', fontSize: style.size, color: style.color, left: style.left, top: style.top, opacity: style.opacity, animation: `floatUp ${style.duration}s linear ${style.delay}s infinite`, pointerEvents: 'none', zIndex: 0, userSelect: 'none', filter: style.glow ? `drop-shadow(0 0 6px ${style.color})` : 'none' }}>{symbol}</div>
  );
}

export default function Register() {
  const router = useRouter();
  const [form, setForm] = useState({ fullName: '', email: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [particles, setParticles] = useState([]);
  const [toast, setToast] = useState(null);
  const [success, setSuccess] = useState(false);
  useEffect(() => { try { const r = new URLSearchParams(window.location.search).get('ref'); if (r) localStorage.setItem('cz_ref', r.trim().slice(0, 32)) } catch {} }, []);

  useEffect(() => {
    const generated = Array.from({ length: 22 }, (_, i) => ({
      id: i, symbol: PARTICLES[Math.floor(Math.random() * 4)],
      style: { left: `${Math.random() * 100}%`, top: `${100 + Math.random() * 20}%`, size: `${Math.random() * 18 + 10}px`, opacity: Math.random() * 0.18 + 0.04, duration: Math.random() * 14 + 10, delay: -(Math.random() * 20), color: Math.random() > 0.5 ? '#fbbf24' : '#f59e0b', glow: Math.random() > 0.65 },
    }));
    setParticles(generated);
  }, []);

  const showToast = (msg, type = 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 5000);
  };

  const setField = (key, value) => {
    setForm(p => ({ ...p, [key]: value }));
    if (errors[key]) setErrors(p => ({ ...p, [key]: '' }));
  };

  const validate = () => {
    const e = {};
    if (!form.fullName.trim()) e.fullName = 'Full name is required';
    else if (form.fullName.trim().length < 2) e.fullName = 'Name must be at least 2 characters';
    if (!form.email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter a valid email address';
    if (!form.password) e.password = 'Password is required';
    else if (form.password.length < 8) e.password = 'Password must be at least 8 characters';
    if (!form.confirmPassword) e.confirmPassword = 'Please confirm your password';
    else if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match';
    return e;
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({});
    setLoading(true);
    try {
      await signUpWithEmail({ fullName: form.fullName, email: form.email, password: form.password });
      setSuccess(true);
      showToast('Account created! Check your email to confirm.', 'success');
      setTimeout(() => router.push('/auth/login'), 3000);
    } catch (err) {
      showToast(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      showToast(err.message || 'Google sign up failed');
      setGoogleLoading(false);
    }
  };

  const strengthLevel = (pwd) => {
    if (!pwd) return 0;
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    return score;
  };
  const strength = strengthLevel(form.password);
  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const strengthColor = ['', '#ef4444', '#f59e0b', '#84cc16', '#22c55e'];

  const inputStyle = (field) => ({
    width: '100%', padding: '14px 16px', background: 'rgba(255,255,255,0.05)',
    border: `1.5px solid ${focusedField === field ? errors[field] ? '#ef4444' : '#fbbf24' : errors[field] ? 'rgba(239,68,68,0.5)' : 'rgba(251,191,36,0.2)'}`,
    borderRadius: 10, color: '#fff', fontSize: 15, fontFamily: 'Outfit, sans-serif',
    outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.25s, box-shadow 0.25s',
    boxShadow: focusedField === field ? errors[field] ? '0 0 0 3px rgba(239,68,68,0.15)' : '0 0 0 3px rgba(251,191,36,0.15), 0 0 20px rgba(251,191,36,0.1)' : 'none',
    caretColor: '#fbbf24',
  });

  return (
    <>
      <Head>
        <title>Create Account — Casinoze Room</title>
        <link href="https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700;900&family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
        <style>{`
          *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
          body{background:var(--bg-gradient);background-attachment:fixed;overflow-x:hidden}
          input:-webkit-autofill,input:-webkit-autofill:hover,input:-webkit-autofill:focus{-webkit-box-shadow:0 0 0 1000px rgba(10,4,30,1) inset!important;-webkit-text-fill-color:#ffffff!important;caret-color:#fbbf24!important}
          @keyframes floatUp{0%{transform:translateY(0) rotate(0deg);opacity:0}10%{opacity:1}90%{opacity:1}100%{transform:translateY(-110vh) rotate(360deg);opacity:0}}
          @keyframes fadeSlideUp{from{opacity:0;transform:translateY(28px)}to{opacity:1;transform:translateY(0)}}
          @keyframes shimmer{0%{background-position:-200% center}100%{background-position:200% center}}
          @keyframes pulse-glow{0%,100%{box-shadow:0 0 20px rgba(251,191,36,0.15)}50%{box-shadow:0 0 40px rgba(251,191,36,0.35)}}
          @keyframes spin{to{transform:rotate(360deg)}}
          @keyframes orb-float{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-30px) scale(1.06)}}
          @keyframes toastIn{from{opacity:0;transform:translateY(-16px)}to{opacity:1;transform:translateY(0)}}
          @keyframes successPop{0%{transform:scale(0.8);opacity:0}100%{transform:scale(1);opacity:1}}
        `}</style>
      </Head>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, animation: 'toastIn .3s ease', background: toast.type === 'error' ? 'rgba(239,68,68,0.95)' : 'rgba(16,185,129,0.95)', border: `1px solid ${toast.type === 'error' ? '#ef4444' : '#10b981'}`, borderRadius: 12, padding: '12px 24px', color: '#fff', fontSize: 14, fontWeight: 600, fontFamily: 'Outfit, sans-serif', backdropFilter: 'blur(12px)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)', whiteSpace: 'nowrap' }}>
          {toast.type === 'error' ? '⚠ ' : '✓ '}{toast.msg}
        </div>
      )}

      {/* Background */}
      <div style={{ position: 'fixed', inset: 0, background: 'var(--bg-gradient)', overflow: 'hidden', zIndex: 0 }}>
        <div style={{ position: 'absolute', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(251,191,36,0.12) 0%, transparent 70%)', top: -200, right: -200, animation: 'orb-float 9s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(245,158,11,0.09) 0%, transparent 70%)', bottom: -150, left: -100, animation: 'orb-float 12s ease-in-out infinite reverse' }} />
        <div style={{ position: 'absolute', inset: 0, backgroundImage: `linear-gradient(rgba(251,191,36,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(251,191,36,0.04) 1px, transparent 1px)`, backgroundSize: '60px 60px' }} />
      </div>

      {particles.map(p => <Particle key={p.id} symbol={p.symbol} style={p.style} />)}

      <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 16px', fontFamily: 'Outfit, sans-serif' }}>

        {/* Logo */}
        <div style={{ animation: 'fadeSlideUp 0.6s ease both', marginBottom: 32, textAlign: 'center' }}>
          <Logo variant="full" stack height={88} />
          <div style={{ marginTop: 6, fontSize: 11, letterSpacing: 4, color: 'rgba(251,191,36,0.7)', textTransform: 'uppercase', fontWeight: 500 }}>Premium Fish Game Platform</div>
        </div>

        {/* Success state */}
        {success ? (
          <div style={{ width: '100%', maxWidth: 460, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.4)', borderRadius: 20, padding: 48, textAlign: 'center', animation: 'successPop .4s ease' }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
            <h2 style={{ fontFamily: 'Cinzel Decorative, serif', fontSize: 22, color: '#10b981', marginBottom: 12 }}>Account Created!</h2>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15, lineHeight: 1.7 }}>Check your email to confirm your account. Redirecting to login…</p>
          </div>
        ) : (
          <div style={{ width: '100%', maxWidth: 460, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 20, padding: 'clamp(28px, 5vw, 44px)', backdropFilter: 'blur(20px)', animation: 'fadeSlideUp 0.7s ease 0.1s both, pulse-glow 4s ease-in-out infinite', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: '10%', right: '10%', height: 1, background: 'linear-gradient(90deg, transparent, #f59e0b, #fbbf24, #f59e0b, transparent)' }} />

            <h2 style={{ fontFamily: 'Cinzel Decorative, serif', fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 6, textAlign: 'center' }}>Join the Table</h2>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, textAlign: 'center', marginBottom: 28 }}>Create your Casinoze account and start playing</p>

            <form onSubmit={handleSubmit} noValidate>
              {/* Full Name */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.65)', letterSpacing: 0.5 }}>Full Name</label>
                <input type="text" value={form.fullName} onChange={e => setField('fullName', e.target.value)} onFocus={() => setFocusedField('fullName')} onBlur={() => setFocusedField(null)} placeholder="John Doe" style={inputStyle('fullName')} autoComplete="name" />
                {errors.fullName && <p style={{ color: '#f87171', fontSize: 12, marginTop: 6, fontWeight: 500 }}>⚠ {errors.fullName}</p>}
              </div>

              {/* Email */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.65)', letterSpacing: 0.5 }}>Email Address</label>
                <input type="email" value={form.email} onChange={e => setField('email', e.target.value)} onFocus={() => setFocusedField('email')} onBlur={() => setFocusedField(null)} placeholder="you@example.com" style={inputStyle('email')} autoComplete="email" />
                {errors.email && <p style={{ color: '#f87171', fontSize: 12, marginTop: 6, fontWeight: 500 }}>⚠ {errors.email}</p>}
              </div>

              {/* Password */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.65)', letterSpacing: 0.5 }}>Password</label>
                <input type="password" value={form.password} onChange={e => setField('password', e.target.value)} onFocus={() => setFocusedField('password')} onBlur={() => setFocusedField(null)} placeholder="Min. 8 characters" style={inputStyle('password')} autoComplete="new-password" />
                {form.password && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                      {[1, 2, 3, 4].map(i => <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= strength ? strengthColor[strength] : 'rgba(255,255,255,0.1)', transition: 'background 0.3s' }} />)}
                    </div>
                    <p style={{ fontSize: 11, color: strengthColor[strength], fontWeight: 600 }}>{strengthLabel[strength]} password</p>
                  </div>
                )}
                {errors.password && <p style={{ color: '#f87171', fontSize: 12, marginTop: 6, fontWeight: 500 }}>⚠ {errors.password}</p>}
              </div>

              {/* Confirm Password */}
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.65)', letterSpacing: 0.5 }}>Confirm Password</label>
                <input type="password" value={form.confirmPassword} onChange={e => setField('confirmPassword', e.target.value)} onFocus={() => setFocusedField('confirmPassword')} onBlur={() => setFocusedField(null)} placeholder="••••••••"
                  style={{ ...inputStyle('confirmPassword'), ...(form.confirmPassword && form.password === form.confirmPassword ? { borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.12)' } : {}) }}
                  autoComplete="new-password" />
                {form.confirmPassword && form.password === form.confirmPassword && <p style={{ color: '#22c55e', fontSize: 12, marginTop: 6, fontWeight: 500 }}>✓ Passwords match</p>}
                {errors.confirmPassword && <p style={{ color: '#f87171', fontSize: 12, marginTop: 6, fontWeight: 500 }}>⚠ {errors.confirmPassword}</p>}
              </div>

              <button type="submit" disabled={loading} style={{ width: '100%', padding: 15, background: loading ? 'rgba(245,158,11,0.4)' : 'linear-gradient(135deg, #f59e0b, #fbbf24)', border: 'none', borderRadius: 10, color: '#0a0410', fontSize: 15, fontWeight: 700, fontFamily: 'Outfit, sans-serif', letterSpacing: 0.5, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: loading ? 'none' : '0 4px 24px rgba(245,158,11,0.35)' }}
                onMouseEnter={e => { if (!loading) e.currentTarget.style.transform = 'scale(1.02)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}>
                {loading ? (<><span style={{ width: 18, height: 18, border: '2px solid rgba(0,0,0,0.3)', borderTopColor: '#0a0410', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />Creating Account…</>) : '♠ Create My Account'}
              </button>
            </form>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
              <div style={{ flex: 1, height: 1, background: 'rgba(251,191,36,0.2)' }} />
              <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, letterSpacing: 1 }}>OR</span>
              <div style={{ flex: 1, height: 1, background: 'rgba(251,191,36,0.2)' }} />
            </div>

            <button onClick={handleGoogle} disabled={googleLoading} style={{ width: '100%', padding: 13, background: 'rgba(255,255,255,0.04)', border: '1.5px solid rgba(251,191,36,0.25)', borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 500, fontFamily: 'Outfit, sans-serif', cursor: googleLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, transition: 'border-color 0.2s, background 0.2s', opacity: googleLoading ? 0.6 : 1 }}
              onMouseEnter={e => { if (!googleLoading) { e.currentTarget.style.borderColor = '#fbbf24'; e.currentTarget.style.background = 'rgba(251,191,36,0.08)'; } }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(251,191,36,0.25)'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}>
              {googleLoading ? <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.2)', borderTopColor: '#fbbf24', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} /> : <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/><path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 6.293C4.672 4.166 6.656 3.58 9 3.58z"/></svg>}
              {googleLoading ? 'Connecting…' : 'Sign up with Google'}
            </button>

            <p style={{ textAlign: 'center', marginTop: 22, color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
              Already have an account?{' '}
              <Link href="/auth/login" style={{ color: '#fbbf24', fontWeight: 600, textDecoration: 'none', borderBottom: '1px solid rgba(251,191,36,0.3)', paddingBottom: 1 }}>Sign in →</Link>
            </p>
          </div>
        )}

        <p style={{ marginTop: 28, color: 'rgba(255,255,255,0.18)', fontSize: 11, letterSpacing: 1, textAlign: 'center', animation: 'fadeSlideUp 0.7s ease 0.3s both' }}>♠ ♥ CASINOZE ROOM · PLAY RESPONSIBLY ♦ ♣</p>
      </div>
    </>
  );
}
