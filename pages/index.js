import { useState, useRef } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import SiteNav from '../components/site/SiteNav'
import SiteFooter from '../components/site/SiteFooter'
import Reveal from '../components/site/Reveal'
import Ico from '../components/ui/Icons'
import { GAME_CATALOG } from '../lib/gameCatalog'
import { FAQS } from '../lib/siteContent'

const GAMES = GAME_CATALOG   // the 23 games live in lib/gameCatalog.js

// ═══════════════════════════════════════════════════════════════════
//  EDIT HERE. Only put things in this block that are TRUE for your business.
//  Anything left empty ('' / null / []) is simply hidden on the page.
// ═══════════════════════════════════════════════════════════════════
const SITE = {
  signupBonus: '',      // e.g. '100% first-deposit bonus'  → replaces the small line above the headline
  playersOnline: null,  // a REAL number, e.g. 312            → shows a slim bar at the very top
  contactEmail: '',     // your support email. Fills the Contact form (opens the visitor's email app).
                        // Left empty, the form is replaced by a "create an account and use Support" box.
  reviews: [],          // REAL player reviews, e.g. [{ name:'Jay G.', tag:'Fire Kirin', stars:5, text:'…' }]
                        // (the Reviews section is hidden while this is empty)
}

const FONTS = 'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,700;1,9..144,500;1,9..144,700&family=Cinzel:wght@600;700&family=Outfit:wght@300;400;500;600;700;800&display=swap'
const byName = (n) => GAMES.find(g => g.name === n)
const tint = (g) => `linear-gradient(165deg,${g.tint[0]},${g.tint[1]})`

// hero collage: name, left %, top %, rotation, parallax depth, stack order, scale, float seconds
const STAGE = [
  ['Fire Kirin', 22, 0, -6, 30, 3, 1.0, 7],
  ['Orion Stars', 66, 1, 7, 18, 2, .9, 8],
  ['Milky Way', 1, 29, -11, 14, 1, .84, 9],
  ['Ultra Thunder', 38, 43, 4, 38, 4, 1.04, 6.5],
  ['Dragon Fury', 71, 52, -5, 22, 2, .88, 8.5],
  ['Royal Treasure', 10, 62, 8, 26, 3, .92, 7.5],
]

const STEPS = [
  ['01', 'user', 'Register', 'Create your free account. Your wallet is set up for you automatically.'],
  ['02', 'card', 'Add money', 'Pick a payment method and upload your payment proof. Our team reviews it and adds the funds.'],
  ['03', 'gamepad', 'Load & play', 'Request an account in any game room, then load credits from your wallet and play.'],
  ['04', 'out', 'Redeem & withdraw', 'Redeem winnings back to your wallet, then withdraw once your identity is verified.'],
]

/* ───────────────────────── HERO ───────────────────────── */
function Hero() {
  const stage = useRef(null)
  const raf = useRef(0)
  const move = (e) => {
    const el = stage.current
    if (!el || window.innerWidth < 900) return
    const r = el.getBoundingClientRect()
    const mx = (e.clientX - (r.left + r.width / 2)) / r.width, my = (e.clientY - (r.top + r.height / 2)) / r.height
    cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(() => { el.style.setProperty('--mx', mx.toFixed(3)); el.style.setProperty('--my', my.toFixed(3)) })
  }
  const leave = () => { const el = stage.current; if (el) { el.style.setProperty('--mx', 0); el.style.setProperty('--my', 0) } }

  return (
    <section className="hero" onMouseMove={move} onMouseLeave={leave}>
      <div className="hero-in">
        <div className="hero-copy">
          <div className="eyebrow"><i className="pulse" />{SITE.signupBonus || `${GAMES.length} game rooms · one wallet`}</div>
          <h1 className="hero-h1">
            <span className="ml"><span>Every game room.</span></span>
            <span className="ml"><span className="goldtxt">One wallet.</span></span>
          </h1>
          <p className="hero-p">Add money once, request an account in any of our {GAMES.length} game rooms, load credits and play. Deposits, loads, redemptions and withdrawals all live in one dashboard.</p>
          <div className="hero-cta">
            <Link href="/auth/register" className="btn-gold">Create free account <Ico name="arrow" size={18} stroke={2.3} /></Link>
            <a href="#games" className="btn-link">Browse the games <Ico name="arrow" size={16} stroke={2} /></a>
          </div>
          <ul className="facts">
            <li><Ico name="card" size={18} />Team-reviewed deposits</li>
            <li><Ico name="shield" size={18} />Identity-verified withdrawals</li>
            <li><Ico name="device" size={18} />Works on any device</li>
          </ul>
        </div>

        <div className="stage" ref={stage} aria-hidden="true">
          <svg className="rings" viewBox="0 0 600 600"><g fill="none" stroke="#fbbf24"><circle cx="300" cy="300" r="170" opacity=".16" /><circle cx="300" cy="300" r="240" opacity=".1" strokeDasharray="2 9" /><circle cx="300" cy="300" r="295" opacity=".07" /></g></svg>
          {STAGE.map(([n, x, y, r, d, z, s, t], i) => {
            const g = byName(n)
            return (
              <div key={n} className="hc" style={{ left: `${x}%`, top: `${y}%`, zIndex: z, '--d': d, '--r': `${r}deg`, '--s': s }}>
                <div className="hc-a" style={{ animationDelay: `${0.35 + i * 0.12}s` }}>
                  <div className="hc-in" style={{ background: tint(g), animationDuration: `${t}s`, animationDelay: `${i * -1.3}s` }}>
                    <img src={g.src} alt="" /><span>{g.name}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

/* ───────────────────────── LOGO MARQUEE ───────────────────────── */
function Marquee() {
  const row = (items, reverse, dur) => (
    <div className="mq-row">
      <div className="mq" style={{ animationDirection: reverse ? 'reverse' : 'normal', animationDuration: dur }}>
        {[...items, ...items].map((g, i) => <div key={i} className="mq-i" style={{ background: tint(g) }}><img src={g.src} alt="" loading="lazy" /></div>)}
      </div>
    </div>
  )
  return <div className="mqw" aria-hidden="true">{row(GAMES, false, '70s')}{row([...GAMES].reverse(), true, '85s')}</div>
}

/* ───────────────────────── GAME TILE ───────────────────────── */
function GameCard({ game }) {
  const [failed, setFailed] = useState(false)
  return (
    <Link href="/auth/register" className="gtile" aria-label={`${game.name}: join to play`} style={{ '--g1': game.tint[0], '--g2': game.tint[1], '--accent': game.accent, '--glow': game.accent + '66' }}>
      {game.bonus > 0 && <span className="gtile-badge gtile-bonus">{game.bonus}%</span>}
      {game.hot && <span className="gtile-badge gtile-hot">HOT</span>}
      <div className="gtile-art">
        {failed ? <span style={{ fontSize: 42 }}>🎮</span> : <img src={game.src} alt={game.name} loading="lazy" onError={() => setFailed(true)} />}
      </div>
      <div className="gtile-bar"><span className="gtile-play">▶</span><span className="gtile-name">{game.name}</span></div>
    </Link>
  )
}

/* ───────────────────────── FEATURE TILE (cursor spotlight) ───────────────────────── */
function Bento({ cls = '', icon, title, desc, children, delay = 0 }) {
  const spot = (e) => { const r = e.currentTarget.getBoundingClientRect(); e.currentTarget.style.setProperty('--sx', `${e.clientX - r.left}px`); e.currentTarget.style.setProperty('--sy', `${e.clientY - r.top}px`) }
  return (
    <Reveal delay={delay} className={`bt ${cls}`} onMouseMove={spot}>
      <div className="bt-ico"><Ico name={icon} size={20} /></div>
      <h3>{title}</h3>
      <p>{desc}</p>
      <div className="bt-art">{children}</div>
    </Reveal>
  )
}

/* ───────────────────────── CONTACT ───────────────────────── */
function ContactForm() {
  const [f, setF] = useState({ first: '', last: '', email: '', msg: '' })
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  if (!SITE.contactEmail) return (
    <div className="panel">
      <p style={{ color: 'rgba(255,255,255,.65)', fontSize: 15, lineHeight: 1.8, margin: '0 0 18px' }}>The fastest way to reach us is from your dashboard: create a free account, open Support and send a message. Our reply shows up right on your ticket. You can also check the FAQ first.</p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Link href="/auth/register" className="btn-gold sm">Create free account</Link>
        <Link href="/faq" className="btn-line">Read the FAQ</Link>
      </div>
    </div>
  )
  const send = () => {
    if (!/^\S+@\S+\.\S+$/.test(f.email)) return setErr('Please enter a valid email address')
    if (f.msg.trim().length < 5) return setErr('Please write your message')
    setErr('')
    const name = `${f.first} ${f.last}`.trim() || 'Website visitor'
    window.location.href = `mailto:${SITE.contactEmail}?subject=${encodeURIComponent('Message from ' + name)}&body=${encodeURIComponent(`${f.msg.trim()}\n\n${name}\n${f.email}`)}`
  }
  return (
    <div className="panel" style={{ display: 'grid', gap: 12 }}>
      <div className="two"><input className="fld" placeholder="First name" value={f.first} onChange={set('first')} /><input className="fld" placeholder="Last name" value={f.last} onChange={set('last')} /></div>
      <input className="fld" type="email" placeholder="Email" value={f.email} onChange={set('email')} />
      <textarea className="fld" rows={4} placeholder="How can we help?" value={f.msg} onChange={set('msg')} style={{ resize: 'vertical' }} />
      {err && <div style={{ color: '#f87171', fontSize: 13, fontWeight: 600 }}>{err}</div>}
      <button className="btn-gold sm" onClick={send} style={{ justifySelf: 'start' }}>Send message <Ico name="arrow" size={16} stroke={2.2} /></button>
    </div>
  )
}

function Faq() {
  const [open, setOpen] = useState(0)
  return (
    <div>
      {FAQS.map((f, i) => (
        <div key={f.q} className={`fq${open === i ? ' on' : ''}`}>
          <button onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i}><span>{f.q}</span><i>{open === i ? '−' : '+'}</i></button>
          <div className="fq-a" style={{ gridTemplateRows: open === i ? '1fr' : '0fr' }}><div><p>{f.a}</p></div></div>
        </div>
      ))}
    </div>
  )
}

/* ───────────────────────── PAGE ───────────────────────── */
export default function Home() {
  const n = GAMES.length
  const deck = ['Fire Kirin', 'Orion Stars', 'Royal Treasure'].map(byName)
  const mini = ['Ultra Thunder', 'Dragon Fury', 'Milky Way', 'Yolo 777'].map(byName)

  return (
    <div className="lp">
      <Head>
        <title>Casinoze Room — Every game room. One wallet.</title>
        <meta name="description" content="One account and one wallet for every game room. Add money, load credits and play." />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href={FONTS} rel="stylesheet" />
        <style>{CSS}</style>
        <noscript><style>{'.rv{opacity:1!important;transform:none!important}.ml>span{transform:none!important;animation:none!important}'}</style></noscript>
      </Head>

      {SITE.playersOnline && <div className="topbar"><i className="pulse" />{Number(SITE.playersOnline).toLocaleString()} players online right now</div>}
      <SiteNav landing />
      <Hero />
      <Marquee />

      {/* GAMES */}
      <section id="games" className="sec">
        <div className="wrap">
          <Reveal className="shead">
            <div><div className="lab">The lineup</div><h2>{n} game rooms,<br /><em>one account.</em></h2></div>
            <p>Request an account in any room. Once it's set up, load credits from your wallet and start playing.</p>
          </Reveal>
          <div className="game-grid">
            {GAMES.map((g, i) => <Reveal key={g.name} delay={(i % 6) * 60} y={30}><GameCard game={g} /></Reveal>)}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="sec">
        <div className="wrap">
          <Reveal className="shead">
            <div><div className="lab">How it works</div><h2>From sign-up to<br /><em>first spin</em> in four steps.</h2></div>
          </Reveal>
          <div className="steps">
            {STEPS.map(([num, icon, title, desc], i) => (
              <Reveal key={num} delay={i * 110} className="step">
                <div className="step-top"><span className="step-num">{num}</span>{i < STEPS.length - 1 && <span className="step-rule" style={{ transitionDelay: `${0.4 + i * 0.2}s` }} />}</div>
                <div className="step-ico"><Ico name={icon} size={22} /></div>
                <h3>{title}</h3>
                <p>{desc}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="sec">
        <div className="wrap">
          <Reveal className="shead">
            <div><div className="lab">Your dashboard</div><h2>Everything in<br /><em>one place.</em></h2></div>
            <p>No spreadsheets, no chasing messages. Every request has a status, and you get a notification when it changes.</p>
          </Reveal>
          <div className="bento">
            <Bento cls="b-wide" icon="wallet" title="One wallet, two balances" desc="Cash and bonus credits are kept separate, so you always know what you can withdraw." delay={0}>
              <div className="bars"><div><b>Cash</b><span><i style={{ '--w': '78%' }} /></span></div><div><b>Bonus</b><span><i className="alt" style={{ '--w': '34%' }} /></span></div></div>
            </Bento>
            <Bento cls="b-wide" icon="gamepad" title={`${n} game rooms`} desc="Request an account in any room. Your logins and status are always one tap away." delay={90}>
              <div className="stack">{mini.map((g, i) => <div key={g.name} style={{ background: tint(g), zIndex: 9 - i }}><img src={g.src} alt="" loading="lazy" /></div>)}</div>
            </Bento>
            <Bento cls="b-third" icon="swap" title="Loads & redemptions" desc="Move money to a game and winnings back to your wallet." delay={0}>
              <div className="flow"><span /><span /><span /></div>
            </Bento>
            <Bento cls="b-third" icon="shield" title="Safe withdrawals" desc="Verify your ID once, then withdraw. Each request is reviewed by our team." delay={90}>
              <div className="chip"><Ico name="check" size={14} stroke={2.6} />ID verified</div>
            </Bento>
            <Bento cls="b-third" icon="star" title="Levels & referrals" desc="Earn XP as you play and share your referral code with friends." delay={180}>
              <div className="xp"><span><i /></span><b>Level up</b></div>
            </Bento>
          </div>
        </div>
      </section>

      {/* WHY */}
      <section id="about" className="sec">
        <div className="wrap why">
          <Reveal className="why-copy">
            <div className="lab">Why Casinoze Room</div>
            <h2>You always know<br /><em>where your money is.</em></h2>
            <p>Every deposit, load, redemption and withdrawal is reviewed by our team, and you can see its status in your dashboard at any time.</p>
            <ul className="ticks">
              {['One account and one wallet for every game room', 'A status and a notification for every request', 'Identity verification protects your withdrawals', 'Built for phones as much as desktops'].map(t => <li key={t}><span><Ico name="check" size={14} stroke={2.8} /></span>{t}</li>)}
            </ul>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 28 }}>
              <Link href="/auth/register" className="btn-gold sm">Get started <Ico name="arrow" size={16} stroke={2.2} /></Link>
              <Link href="/about" className="btn-line">About us</Link>
            </div>
          </Reveal>
          <Reveal delay={150} className="deck" aria-hidden="true">
            {deck.map((g, i) => <div key={g.name} className={`dk dk${i}`} style={{ background: tint(g) }}><img src={g.src} alt="" loading="lazy" /><span>{g.name}</span></div>)}
          </Reveal>
        </div>
      </section>

      {/* REVIEWS: only with real reviews */}
      {SITE.reviews.length > 0 && (
        <section className="sec"><div className="wrap">
          <Reveal className="shead"><div><div className="lab">Players</div><h2>What players <em>say.</em></h2></div></Reveal>
          <div className="revs">{SITE.reviews.map((r, i) => (
            <Reveal key={i} delay={i * 90} className="panel"><div style={{ color: '#fbbf24', letterSpacing: 2, marginBottom: 10 }}>{'★'.repeat(r.stars || 5)}</div><p style={{ color: 'rgba(255,255,255,.75)', lineHeight: 1.8, margin: '0 0 16px' }}>{r.text}</p><b>{r.name}</b>{r.tag && <span style={{ color: 'rgba(255,255,255,.4)', fontSize: 13 }}> · {r.tag}</span>}</Reveal>))}
          </div>
        </div></section>
      )}

      {/* FAQ + CONTACT */}
      <section id="faq" className="sec">
        <div className="wrap faqwrap">
          <Reveal><div className="lab">FAQ</div><h2 style={{ marginBottom: 26 }}>Questions,<br /><em>answered.</em></h2><Faq /></Reveal>
          <Reveal delay={120}><div className="lab">Contact</div><h2 style={{ marginBottom: 26 }}>Still need<br /><em>a hand?</em></h2><ContactForm /></Reveal>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="sec" style={{ paddingTop: 20 }}>
        <div className="wrap">
          <Reveal className="cta">
            <div className="cta-in">
              <div className="cta-float c1" style={{ background: tint(byName('Fire Kirin')) }}><img src={byName('Fire Kirin').src} alt="" /></div>
              <div className="cta-float c2" style={{ background: tint(byName('Yolo 777')) }}><img src={byName('Yolo 777').src} alt="" /></div>
              <div className="cta-float c3" style={{ background: tint(byName('Orion Stars')) }}><img src={byName('Orion Stars').src} alt="" /></div>
              <div className="lab" style={{ justifyContent: 'center' }}>Ready when you are</div>
              <h2>Pick a room.<br /><em>Start playing.</em></h2>
              <p>Create your free account in a minute and request your first game room.</p>
              <Link href="/auth/register" className="btn-gold">Create free account <Ico name="arrow" size={18} stroke={2.3} /></Link>
            </div>
          </Reveal>
        </div>
      </section>

      <SiteFooter />
    </div>
  )
}

/* ───────────────────────── STYLES ───────────────────────── */
const CSS = `
  *,*::before,*::after{box-sizing:border-box}
  html{scroll-behavior:smooth}
  body{margin:0;background:var(--bg-gradient);background-attachment:fixed;color:#fff;font-family:'Outfit',sans-serif;-webkit-font-smoothing:antialiased;overflow-x:hidden}
  .lp{position:relative}
  .lp h1,.lp h2{font-family:'Fraunces',serif;font-weight:700;letter-spacing:-.015em;margin:0}
  .lp h2{font-size:clamp(34px,4.6vw,58px);line-height:1.04}
  .lp h2 em,.goldtxt{font-style:italic;font-weight:500;background:linear-gradient(100deg,#fde68a,#fbbf24 45%,#f59e0b);-webkit-background-clip:text;background-clip:text;color:transparent}
  .wrap{max-width:1240px;margin:0 auto;padding:0 24px}
  .sec{padding:110px 0 30px;scroll-margin-top:60px}
  .lab{display:flex;align-items:center;gap:12px;color:#fbbf24;font-size:12px;font-weight:800;letter-spacing:.2em;text-transform:uppercase;margin-bottom:18px}
  .lab::before{content:'';width:30px;height:1px;background:#fbbf24}
  .shead{display:flex;justify-content:space-between;align-items:flex-end;gap:40px;margin-bottom:46px}
  .shead p{max-width:380px;color:rgba(255,255,255,.55);font-size:16px;line-height:1.75;margin:0}
  .pulse{display:inline-block;width:8px;height:8px;border-radius:50%;background:#34d399;box-shadow:0 0 0 0 rgba(52,211,153,.6);animation:pulse 2s infinite}
  .topbar{text-align:center;padding:8px 12px;font-size:12px;font-weight:700;letter-spacing:.06em;color:#34d399;background:rgba(4,7,13,.7);border-bottom:1px solid rgba(255,255,255,.05);display:flex;align-items:center;justify-content:center;gap:10px}

  /* buttons */
  .btn-gold{position:relative;overflow:hidden;display:inline-flex;align-items:center;gap:10px;padding:16px 30px;border-radius:14px;background:linear-gradient(135deg,#fbbf24,#f59e0b);color:#0a0a0a;font-weight:800;font-size:16px;text-decoration:none;border:0;cursor:pointer;font-family:inherit;box-shadow:0 10px 30px rgba(251,191,36,.22);transition:transform .25s,box-shadow .25s}
  .btn-gold.sm{padding:12px 22px;font-size:14px;border-radius:12px}
  .btn-gold::after{content:'';position:absolute;top:0;left:-60%;width:40%;height:100%;background:linear-gradient(105deg,transparent,rgba(255,255,255,.55),transparent);transform:skewX(-20deg);transition:left .6s}
  .btn-gold:hover{transform:translateY(-3px);box-shadow:0 18px 40px rgba(251,191,36,.38)}
  .btn-gold:hover::after{left:130%}
  .btn-gold svg{transition:transform .25s}.btn-gold:hover svg{transform:translateX(4px)}
  .btn-line{display:inline-flex;align-items:center;gap:8px;padding:12px 22px;border-radius:12px;border:1px solid rgba(251,191,36,.4);color:#fbbf24;font-weight:700;font-size:14px;text-decoration:none;transition:background .25s,border-color .25s}
  .btn-line:hover{background:rgba(251,191,36,.08);border-color:#fbbf24}
  .btn-link{display:inline-flex;align-items:center;gap:8px;color:rgba(255,255,255,.8);font-weight:600;font-size:15px;text-decoration:none;padding:16px 6px;border-bottom:1px solid transparent;transition:color .2s,gap .25s}
  .btn-link:hover{color:#fbbf24;gap:13px}

  /* hero */
  .hero{position:relative;overflow:hidden}
  .hero::before{content:'';position:absolute;right:-12%;top:-10%;width:70%;height:120%;background:radial-gradient(closest-side,rgba(251,191,36,.16),transparent 72%);pointer-events:none}
  .hero::after{content:'';position:absolute;inset:0;pointer-events:none;opacity:.045;mix-blend-mode:overlay;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")}
  .hero-in{position:relative;z-index:1;max-width:1240px;margin:0 auto;padding:40px 24px 70px;display:grid;grid-template-columns:1.02fr .98fr;gap:30px;align-items:center;min-height:calc(100vh - 70px)}
  .eyebrow{display:inline-flex;align-items:center;gap:11px;font-size:13px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.7);margin-bottom:26px}
  .lp .hero-h1{font-size:clamp(42px,5.2vw,80px);line-height:1;margin-bottom:30px}
  .ml{display:block;overflow:hidden;padding:.04em .1em .12em 0}
  .ml>span{display:inline-block;transform:translateY(112%);animation:maskUp 1.05s cubic-bezier(.2,.85,.2,1) .15s both}
  .ml+.ml>span{animation-delay:.32s}
  .hero-p{max-width:520px;font-size:18px;line-height:1.75;color:rgba(255,255,255,.62);margin:0 0 34px;animation:fadeUp .9s .55s both}
  .hero-cta{display:flex;align-items:center;gap:18px;flex-wrap:wrap;margin-bottom:44px;animation:fadeUp .9s .7s both}
  .facts{display:flex;gap:14px 24px;flex-wrap:wrap;list-style:none;margin:0;padding:22px 0 0;border-top:1px solid rgba(255,255,255,.09);max-width:640px;animation:fadeUp .9s .85s both}
  .facts li{display:flex;align-items:center;gap:9px;font-size:13px;font-weight:600;color:rgba(255,255,255,.6)}
  .facts svg{color:#fbbf24}
  .stage{position:relative;width:100%;max-width:560px;height:620px;margin-left:auto;--mx:0;--my:0}
  .rings{position:absolute;left:50%;top:50%;width:112%;transform:translate(-50%,-50%);animation:spin 80s linear infinite}
  .hc{position:absolute;width:calc(190px*var(--s));transform:translate3d(calc(var(--mx)*var(--d)*1px),calc(var(--my)*var(--d)*1px),0) rotate(var(--r));transition:transform .3s ease-out}
  .hc-a{animation:cardIn 1s cubic-bezier(.2,.85,.2,1) both}
  .hc-in{border-radius:22px;padding:16px 14px 13px;border:1px solid rgba(255,255,255,.15);box-shadow:0 34px 60px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.2);animation:hfloat 7s ease-in-out infinite}
  .hc-in img{display:block;width:100%;aspect-ratio:1;object-fit:contain;filter:drop-shadow(0 10px 14px rgba(0,0,0,.5))}
  .hc-in span{display:block;margin-top:8px;font-size:11px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:rgba(255,255,255,.85)}

  /* marquee */
  .mqw{position:relative;padding:26px 0 8px;display:grid;gap:14px;-webkit-mask-image:linear-gradient(90deg,transparent,#000 9%,#000 91%,transparent);mask-image:linear-gradient(90deg,transparent,#000 9%,#000 91%,transparent)}
  .mq-row{overflow:hidden}
  .mq{display:flex;gap:14px;width:max-content;animation:mq 70s linear infinite}
  .mq-row:hover .mq{animation-play-state:paused}
  .mq-i{width:92px;height:92px;border-radius:20px;padding:12px;border:1px solid rgba(255,255,255,.1);flex-shrink:0}
  .mq-i img{width:100%;height:100%;object-fit:contain}

  /* games */
  .game-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(190px,46%),1fr));gap:18px;padding-top:14px}
  .gtile{position:relative;display:block;text-decoration:none;color:#fff;border-radius:18px;overflow:hidden;cursor:pointer;background:linear-gradient(165deg,var(--g1) 0%,var(--g2) 62%,#0a1222 100%);border:1px solid rgba(255,255,255,.09);box-shadow:0 6px 20px rgba(0,0,0,.4);transition:transform .3s cubic-bezier(.2,.9,.3,1.35),box-shadow .3s,border-color .3s;will-change:transform;-webkit-tap-highlight-color:transparent}
  .gtile::after{content:'';position:absolute;top:0;left:-70%;width:45%;height:100%;pointer-events:none;background:linear-gradient(105deg,transparent,rgba(255,255,255,.26),transparent);transform:skewX(-18deg);transition:left .75s ease}
  .gtile-art{aspect-ratio:1/1.02;display:flex;align-items:center;justify-content:center;padding:20px 16px 8px}
  .gtile-art img{width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 10px 16px rgba(0,0,0,.55))}
  .gtile-bar{display:flex;align-items:center;gap:8px;padding:13px 14px;background:linear-gradient(180deg,rgba(0,0,0,.12),rgba(0,0,0,.62));border-top:1px solid rgba(255,255,255,.08);font-size:12px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:rgba(255,255,255,.85)}
  .gtile-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .gtile-play{font-size:9px;color:var(--accent);transition:transform .3s;flex-shrink:0}
  .gtile-badge{position:absolute;top:0;z-index:2;font-size:10px;font-weight:800;padding:4px 9px;color:#fff}
  .gtile-bonus{right:0;background:#e5484d;border-bottom-left-radius:10px}
  .gtile-hot{left:0;background:linear-gradient(135deg,#ef4444,#f97316);border-bottom-right-radius:10px}
  .gtile:hover,.gtile:focus-visible,.gtile:active{transform:translateY(-12px) scale(1.07);z-index:5;border-color:var(--accent);outline:none;box-shadow:0 28px 50px rgba(0,0,0,.65),0 0 0 1px var(--accent),0 0 40px var(--glow)}
  .gtile:hover::after,.gtile:focus-visible::after,.gtile:active::after{left:135%}
  .gtile:hover .gtile-art img,.gtile:focus-visible .gtile-art img,.gtile:active .gtile-art img{animation:gfloat 2.2s ease-in-out infinite}
  .gtile:hover .gtile-play{transform:translateX(3px)}

  /* steps */
  .steps{display:grid;grid-template-columns:repeat(4,1fr);gap:30px}
  .step-top{display:flex;align-items:center;gap:16px;margin-bottom:26px;height:64px}
  .step-num{font-family:'Fraunces',serif;font-size:64px;font-weight:700;line-height:1;color:transparent;-webkit-text-stroke:1.5px rgba(251,191,36,.7);flex-shrink:0}
  .step-rule{flex:1;height:1px;background:linear-gradient(90deg,rgba(251,191,36,.6),rgba(251,191,36,.05));transform:scaleX(0);transform-origin:left;transition:transform 1.2s cubic-bezier(.3,.7,.2,1)}
  .rv.in .step-rule{transform:scaleX(1)}
  .step-ico{width:46px;height:46px;border-radius:14px;display:flex;align-items:center;justify-content:center;color:#fbbf24;background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.22);margin-bottom:18px;transition:transform .35s,background .35s}
  .step:hover .step-ico{transform:translateY(-4px) rotate(-6deg);background:rgba(251,191,36,.16)}
  .step h3{font-size:21px;font-weight:700;margin:0 0 8px}
  .step p{margin:0;color:rgba(255,255,255,.55);font-size:15px;line-height:1.75;max-width:280px}

  /* bento */
  .bento{display:grid;grid-template-columns:repeat(6,1fr);gap:18px}
  .b-wide{grid-column:span 3}.b-third{grid-column:span 2}
  .bt{position:relative;overflow:hidden;border-radius:24px;padding:28px;background:rgba(255,255,255,.035);border:1px solid rgba(251,191,36,.14);transition:border-color .3s}
  .bt::before{content:'';position:absolute;inset:0;background:radial-gradient(380px circle at var(--sx,50%) var(--sy,0%),rgba(251,191,36,.15),transparent 58%);opacity:0;transition:opacity .35s;pointer-events:none}
  .bt:hover{border-color:rgba(251,191,36,.38)}.bt:hover::before{opacity:1}
  .bt-ico{width:42px;height:42px;border-radius:12px;display:flex;align-items:center;justify-content:center;color:#fbbf24;background:rgba(251,191,36,.1);margin-bottom:18px}
  .bt h3{font-size:20px;font-weight:700;margin:0 0 8px}
  .bt p{margin:0;color:rgba(255,255,255,.55);font-size:14.5px;line-height:1.7;max-width:380px}
  .bt-art{margin-top:24px;min-height:62px}
  .bars{display:grid;gap:14px}.bars div{display:flex;align-items:center;gap:14px}.bars b{width:50px;font-size:12px;color:rgba(255,255,255,.55);font-weight:700}
  .bars span{flex:1;height:10px;border-radius:99px;background:rgba(255,255,255,.07);overflow:hidden}
  .bars i{display:block;height:100%;width:0;border-radius:99px;background:linear-gradient(90deg,#34d399,#10b981);transition:width 1.4s cubic-bezier(.2,.8,.2,1) .4s}.bars i.alt{background:linear-gradient(90deg,#fde68a,#f59e0b)}
  .rv.in .bars i{width:var(--w)}
  .stack{display:flex}.stack div{width:62px;height:62px;border-radius:16px;padding:8px;border:1px solid rgba(255,255,255,.14);margin-left:-14px;box-shadow:0 8px 18px rgba(0,0,0,.4);transition:transform .35s}
  .stack div:first-child{margin-left:0}.stack img{width:100%;height:100%;object-fit:contain}.stack div:hover{transform:translateY(-8px)}
  .flow{display:flex;gap:8px;align-items:center}.flow span{height:6px;flex:1;border-radius:99px;background:linear-gradient(90deg,rgba(251,191,36,.12),#fbbf24,rgba(251,191,36,.12));background-size:200% 100%;animation:flow 2.2s linear infinite}
  .flow span:nth-child(2){animation-delay:-.7s}.flow span:nth-child(3){animation-delay:-1.4s}
  .chip{display:inline-flex;align-items:center;gap:8px;padding:9px 16px;border-radius:99px;font-size:13px;font-weight:700;color:#34d399;background:rgba(52,211,153,.1);border:1px solid rgba(52,211,153,.3)}
  .xp{display:flex;align-items:center;gap:14px}.xp span{flex:1;height:10px;border-radius:99px;background:rgba(255,255,255,.07);overflow:hidden}
  .xp i{display:block;height:100%;width:0;border-radius:99px;background:linear-gradient(90deg,#fbbf24,#f59e0b);transition:width 1.6s cubic-bezier(.2,.8,.2,1) .5s}.rv.in .xp i{width:68%}
  .xp b{font-size:12px;color:#fbbf24;font-weight:800;letter-spacing:.06em;text-transform:uppercase}

  /* why */
  .why{display:grid;grid-template-columns:1.05fr .95fr;gap:60px;align-items:center}
  .why-copy p{color:rgba(255,255,255,.6);font-size:17px;line-height:1.8;margin:22px 0 26px;max-width:520px}
  .ticks{list-style:none;margin:0;padding:0;display:grid;gap:14px}
  .ticks li{display:flex;align-items:center;gap:13px;font-size:15.5px;color:rgba(255,255,255,.82)}
  .ticks li span{width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#0a0a0a;background:#fbbf24;flex-shrink:0}
  .deck{position:relative;height:460px}
  .dk{position:absolute;width:230px;border-radius:24px;padding:20px 18px 14px;border:1px solid rgba(255,255,255,.15);box-shadow:0 30px 60px rgba(0,0,0,.5);transition:transform .6s cubic-bezier(.2,.8,.2,1)}
  .dk img{display:block;width:100%;aspect-ratio:1;object-fit:contain;filter:drop-shadow(0 10px 14px rgba(0,0,0,.5))}
  .dk span{display:block;margin-top:8px;font-size:12px;font-weight:800;letter-spacing:.09em;text-transform:uppercase}
  .dk0{left:8%;top:8%;transform:rotate(-9deg);z-index:1}.dk1{left:38%;top:0;transform:rotate(6deg);z-index:2}.dk2{left:22%;top:34%;transform:rotate(-2deg);z-index:3}
  .deck:hover .dk0{transform:rotate(-15deg) translate(-26px,6px)}.deck:hover .dk1{transform:rotate(12deg) translate(30px,-6px)}.deck:hover .dk2{transform:rotate(0) translateY(14px) scale(1.04)}

  /* faq + contact */
  .faqwrap{display:grid;grid-template-columns:1.1fr .9fr;gap:70px;align-items:start}
  .fq{border-bottom:1px solid rgba(255,255,255,.09)}
  .fq button{width:100%;display:flex;justify-content:space-between;align-items:center;gap:16px;padding:20px 0;background:none;border:0;color:#fff;font:600 17px 'Outfit',sans-serif;text-align:left;cursor:pointer;transition:color .2s}
  .fq button:hover,.fq.on button{color:#fbbf24}.fq i{font-style:normal;font-size:24px;color:#fbbf24;width:26px;text-align:center;flex-shrink:0}
  .fq-a{display:grid;transition:grid-template-rows .4s cubic-bezier(.2,.8,.2,1)}.fq-a>div{overflow:hidden}
  .fq-a p{margin:0;padding:0 36px 22px 0;color:rgba(255,255,255,.58);font-size:15.5px;line-height:1.8}
  .panel{background:rgba(255,255,255,.035);border:1px solid rgba(251,191,36,.14);border-radius:22px;padding:26px}
  .two{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .fld{width:100%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:14px 16px;color:#fff;font:15px 'Outfit',sans-serif;outline:none;transition:border-color .2s,background .2s}
  .fld:focus{border-color:#fbbf24;background:rgba(251,191,36,.05)}
  .revs{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(300px,100%),1fr));gap:18px}

  /* final cta */
  .cta{padding:1.5px;border-radius:32px;background:conic-gradient(from var(--a),rgba(251,191,36,.1) 0 55%,#fbbf24 80%,rgba(251,191,36,.1) 100%);animation:rot 7s linear infinite}
  .cta-in{position:relative;overflow:hidden;border-radius:31px;background:#0a101d;text-align:center;padding:90px 24px}
  .cta-in::before{content:'';position:absolute;left:50%;top:-40%;width:80%;height:100%;transform:translateX(-50%);background:radial-gradient(closest-side,rgba(251,191,36,.16),transparent 70%)}
  .cta-in>*{position:relative}.cta h2{font-size:clamp(36px,5.4vw,70px);margin-bottom:18px}
  .cta p{color:rgba(255,255,255,.6);font-size:18px;margin:0 auto 34px;max-width:460px}
  .cta-float{position:absolute!important;width:96px;height:108px;border-radius:20px;padding:12px;border:1px solid rgba(255,255,255,.14);box-shadow:0 20px 40px rgba(0,0,0,.45);animation:hfloat 7s ease-in-out infinite}
  .cta-float img{width:100%;height:100%;object-fit:contain}
  .c1{left:7%;top:16%;transform:rotate(-10deg)}.c2{right:8%;top:12%;transform:rotate(9deg);animation-delay:-2s}.c3{right:17%;bottom:10%;transform:rotate(-5deg);animation-delay:-4s;width:80px;height:92px}

  /* keyframes */
  @property --a{syntax:'<angle>';initial-value:0deg;inherits:false}
  @keyframes rot{to{--a:360deg}}
  @keyframes maskUp{to{transform:translateY(0)}}
  @keyframes fadeUp{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:none}}
  @keyframes cardIn{from{opacity:0;transform:translateY(70px) scale(.9)}to{opacity:1;transform:none}}
  @keyframes hfloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-14px)}}
  @keyframes gfloat{0%,100%{transform:scale(1.13) translateY(0) rotate(-1deg)}50%{transform:scale(1.17) translateY(-6px) rotate(1deg)}}
  @keyframes spin{to{transform:translate(-50%,-50%) rotate(360deg)}}
  @keyframes mq{to{transform:translateX(-50%)}}
  @keyframes flow{to{background-position:-200% 0}}
  @keyframes pulse{0%{box-shadow:0 0 0 0 rgba(52,211,153,.55)}70%{box-shadow:0 0 0 9px rgba(52,211,153,0)}100%{box-shadow:0 0 0 0 rgba(52,211,153,0)}}

  /* responsive */
  @media(max-width:1020px){
    .hero-in{grid-template-columns:1fr;min-height:0;padding-top:24px}.stage{margin:10px auto 0;height:520px}
    .steps{grid-template-columns:1fr 1fr;gap:42px 28px}.b-wide,.b-third{grid-column:span 3}.b-third:last-child{grid-column:span 6}
    .why{grid-template-columns:1fr;gap:30px}.deck{height:400px;max-width:480px;margin:0 auto;width:100%}
    .faqwrap{grid-template-columns:1fr;gap:50px}.shead{flex-direction:column;align-items:flex-start;gap:16px}
  }
  @media(max-width:640px){
    .sec{padding-top:78px}.stage{height:400px}.hc{width:calc(128px*var(--s))}.hc-in{padding:10px 9px 9px;border-radius:16px}.hc-in span{font-size:9px}
    .steps{grid-template-columns:1fr}.step-rule{display:none}.step-top{height:auto;margin-bottom:14px}.step-num{font-size:52px}
    .bento{grid-template-columns:1fr}.b-wide,.b-third,.b-third:last-child{grid-column:auto}
    .game-grid{grid-template-columns:repeat(2,1fr);gap:12px}.gtile-bar{font-size:11px;padding:11px 10px}
    .mq-i{width:74px;height:74px;border-radius:16px;padding:10px}.two{grid-template-columns:1fr}
    .dk{width:170px}.deck{height:340px}.cta-in{padding:70px 20px}.cta-float{display:none}
    .hero-cta{gap:8px}.facts{gap:14px 20px}
  }
  @media(prefers-reduced-motion:reduce){
    html{scroll-behavior:auto}.ml>span,.hero-p,.hero-cta,.facts,.hc-a{animation:none;transform:none;opacity:1}
    .hc-in,.rings,.mq,.cta,.cta-float,.flow span,.pulse{animation:none}.gtile:hover,.gtile:active{transform:none}
  }
`
