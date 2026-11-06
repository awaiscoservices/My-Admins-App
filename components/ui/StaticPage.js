import Head from 'next/head'
import SiteNav from '../site/SiteNav'
import SiteFooter from '../site/SiteFooter'
import Reveal from '../site/Reveal'

export const panel = { background: 'rgba(255,255,255,.035)', border: '1px solid rgba(251,191,36,.14)', borderRadius: 20, padding: 26 }

// Public page shell (no login needed): same nav + footer as the landing page.
export default function StaticPage({ title, subtitle, children }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-gradient)', backgroundAttachment: 'fixed', color: '#fff', fontFamily: "'Outfit', sans-serif", display: 'flex', flexDirection: 'column' }}>
      <Head>
        <title>{title} — Casinoze Room</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,700;1,9..144,500;1,9..144,700&family=Cinzel:wght@600;700&family=Outfit:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      </Head>
      <SiteNav />
      <main style={{ flex: 1, width: '100%', maxWidth: 820, margin: '0 auto', padding: '56px 24px 64px' }}>
        <Reveal><div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, color: '#fbbf24', fontSize: 12, fontWeight: 800, letterSpacing: '.18em', textTransform: 'uppercase' }}><span style={{ width: 28, height: 1, background: '#fbbf24' }} />Casinoze Room</div></Reveal>
        <Reveal delay={80}><h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 'clamp(34px,6vw,56px)', fontWeight: 700, lineHeight: 1.05, margin: '0 0 12px', letterSpacing: '-.01em' }}>{title}</h1></Reveal>
        {subtitle && <Reveal delay={140}><p style={{ color: 'rgba(255,255,255,.55)', fontSize: 17, lineHeight: 1.7, margin: '0 0 34px' }}>{subtitle}</p></Reveal>}
        <Reveal delay={200}>{children}</Reveal>
      </main>
      <SiteFooter />
    </div>
  )
}
