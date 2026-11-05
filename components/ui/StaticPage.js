import Head from 'next/head'
import Link from 'next/link'
import Logo from './Logo'

const G = '#fbbf24'
const links = [['Home', '/'], ['About', '/about'], ['FAQ', '/faq']]

// Public page shell (no login needed): top bar, content card, footer
export default function StaticPage({ title, subtitle, children }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-gradient)', backgroundAttachment: 'fixed', color: '#fff', fontFamily: "'Outfit', sans-serif", display: 'flex', flexDirection: 'column' }}>
      <Head>
        <title>{title} — Casinoze Room</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&family=Outfit:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      </Head>

      <header style={{ position: 'sticky', top: 0, zIndex: 20, background: 'var(--panel-gradient)', backdropFilter: 'blur(10px)', borderBottom: '1px solid rgba(251,191,36,.18)' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <Link href="/" style={{ textDecoration: 'none' }}><Logo variant="full" height={44} /></Link>
          <nav style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <span className="sp-links" style={{ display: 'flex', gap: 18 }}>
              {links.map(([l, h]) => <Link key={h} href={h} style={{ color: 'rgba(255,255,255,.65)', textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>{l}</Link>)}
            </span>
            <Link href="/auth/login" style={{ padding: '8px 16px', borderRadius: 10, border: '1px solid rgba(251,191,36,.4)', color: G, textDecoration: 'none', fontSize: 13, fontWeight: 700 }}>Login</Link>
          </nav>
        </div>
      </header>

      <main style={{ flex: 1, width: '100%', maxWidth: 800, margin: '0 auto', padding: '40px 20px 56px' }}>
        <h1 style={{ fontFamily: "'Cinzel', serif", fontSize: 'clamp(26px,5vw,40px)', fontWeight: 700, marginBottom: 8 }}>{title}</h1>
        {subtitle && <p style={{ color: 'rgba(255,255,255,.5)', fontSize: 15, marginBottom: 28 }}>{subtitle}</p>}
        {children}
      </main>

      <footer style={{ borderTop: '1px solid rgba(255,255,255,.06)', padding: '24px 20px', textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,.4)' }}>
        <div style={{ display: 'flex', gap: 20, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
          {[['Terms', '/terms'], ['Privacy', '/privacy'], ['FAQ', '/faq'], ['About', '/about']].map(([l, h]) => <Link key={h} href={h} style={{ color: 'rgba(255,255,255,.55)', textDecoration: 'none' }}>{l}</Link>)}
        </div>
        © {new Date().getFullYear()} Casinoze Room · 18+ · Play responsibly
      </footer>
      <style>{`@media (max-width: 520px) { .sp-links { display: none !important; } }`}</style>
    </div>
  )
}

export const panel = { background: 'rgba(255,255,255,.03)', border: '1px solid rgba(251,191,36,.14)', borderRadius: 18, padding: 24 }
