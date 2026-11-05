import Head from 'next/head'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import Logo from '../components/ui/Logo'
import { FAQS } from '../lib/siteContent'

// ─── GAME DATA with real brand colors & SVG logos ──────────────────────────
const GAMES = [
  {
    name: 'Orion Stars',
    hot: true, bonus: 15,
    bg: 'linear-gradient(135deg,#0d0d2b,#1a1a4e)',
    accent: '#00d4ff',
    logo: `<svg viewBox="0 0 200 80" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="og1" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#00d4ff"/><stop offset="100%" stop-color="#7b2fff"/></linearGradient></defs>
      <text x="100" y="38" text-anchor="middle" font-family="Arial Black,sans-serif" font-size="22" font-weight="900" fill="url(#og1)">ORION</text>
      <text x="100" y="62" text-anchor="middle" font-family="Arial Black,sans-serif" font-size="18" font-weight="900" fill="#ffffff">STARS</text>
      <polygon points="100,4 104,14 115,14 106,20 109,31 100,25 91,31 94,20 85,14 96,14" fill="#00d4ff" opacity="0.9"/>
    </svg>`,
  },
  {
    name: 'Fire Kirin',
    hot: true, bonus: 10,
    bg: 'linear-gradient(135deg,#1a0500,#3d0f00)',
    accent: '#ff6b00',
    logo: `<svg viewBox="0 0 200 80" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="fk1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#ff9500"/><stop offset="100%" stop-color="#ff2d00"/></linearGradient></defs>
      <text x="100" y="36" text-anchor="middle" font-family="Arial Black,sans-serif" font-size="20" font-weight="900" fill="url(#fk1)">FIRE</text>
      <text x="100" y="62" text-anchor="middle" font-family="Arial Black,sans-serif" font-size="20" font-weight="900" fill="#ffcc00">KIRIN</text>
      <path d="M90,8 Q100,2 110,8 Q105,18 100,14 Q95,18 90,8Z" fill="#ff6b00"/>
      <path d="M95,10 Q100,5 105,10 Q102,17 100,15 Q98,17 95,10Z" fill="#ffcc00"/>
    </svg>`,
  },
  {
    name: 'Milky Way',
    hot: false, bonus: 10,
    bg: 'linear-gradient(135deg,#0a001f,#1a0050)',
    accent: '#fcd34d',
    logo: `<svg viewBox="0 0 200 80" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="mw1" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#e879f9"/><stop offset="50%" stop-color="#fcd34d"/><stop offset="100%" stop-color="#94a3b8"/></linearGradient></defs>
      <ellipse cx="100" cy="42" rx="80" ry="18" fill="url(#mw1)" opacity="0.15"/>
      <text x="100" y="36" text-anchor="middle" font-family="Arial Black,sans-serif" font-size="19" font-weight="900" fill="url(#mw1)">MILKY</text>
      <text x="100" y="62" text-anchor="middle" font-family="Arial Black,sans-serif" font-size="19" font-weight="900" fill="#ffffff">WAYS</text>
    </svg>`,
  },
  {
    name: 'Ultra Panda',
    hot: true, bonus: 10,
    bg: 'linear-gradient(135deg,#001a00,#003300)',
    accent: '#00ff88',
    logo: `<svg viewBox="0 0 200 80" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="up1" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#00ff88"/><stop offset="100%" stop-color="#00ccff"/></linearGradient></defs>
      <circle cx="75" cy="38" r="12" fill="#111" stroke="#fff" stroke-width="2"/>
      <circle cx="125" cy="38" r="12" fill="#111" stroke="#fff" stroke-width="2"/>
      <circle cx="75" cy="38" r="5" fill="#fff"/>
      <circle cx="125" cy="38" r="5" fill="#fff"/>
      <text x="100" y="68" text-anchor="middle" font-family="Arial Black,sans-serif" font-size="13" font-weight="900" fill="url(#up1)">ULTRA PANDA</text>
    </svg>`,
  },
  {
    name: 'VBLink',
    hot: true, bonus: 10,
    bg: 'linear-gradient(135deg,#0d001a,#2d0050)',
    accent: '#bf00ff',
    logo: `<svg viewBox="0 0 200 80" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="vb1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#bf00ff"/><stop offset="100%" stop-color="#6600cc"/></linearGradient></defs>
      <rect x="20" y="15" width="160" height="50" rx="10" fill="url(#vb1)" opacity="0.2"/>
      <text x="100" y="50" text-anchor="middle" font-family="Arial Black,sans-serif" font-size="32" font-weight="900" fill="url(#vb1)" letter-spacing="2">VBLink</text>
    </svg>`,
  },
  {
    name: 'Egame',
    hot: false, bonus: 16,
    bg: 'linear-gradient(135deg,#001428,#002856)',
    accent: '#ffd700',
    logo: `<svg viewBox="0 0 200 80" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="eg1" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#ffd700"/><stop offset="100%" stop-color="#ff8c00"/></linearGradient></defs>
      <polygon points="100,8 120,35 108,35 108,72 92,72 92,35 80,35" fill="url(#eg1)" opacity="0.9"/>
      <text x="100" y="75" text-anchor="middle" font-family="Arial Black,sans-serif" font-size="14" font-weight="900" fill="#ffd700">EGAME</text>
    </svg>`,
  },
  {
    name: 'Juwa',
    hot: true, bonus: 10,
    bg: 'linear-gradient(135deg,#1a0a00,#3d2000)',
    accent: '#ffaa00',
    logo: `<svg viewBox="0 0 200 80" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="jw1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#ffaa00"/><stop offset="100%" stop-color="#ff6600"/></linearGradient></defs>
      <text x="100" y="56" text-anchor="middle" font-family="Arial Black,sans-serif" font-size="42" font-weight="900" fill="url(#jw1)" letter-spacing="4">JUWA</text>
      <rect x="30" y="62" width="140" height="3" rx="1.5" fill="url(#jw1)" opacity="0.6"/>
    </svg>`,
  },
  {
    name: 'Game Vault',
    hot: true, bonus: 10,
    bg: 'linear-gradient(135deg,#0d0d00,#1a1a00)',
    accent: '#ffd700',
    logo: `<svg viewBox="0 0 200 80" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="gv1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#ffd700"/><stop offset="100%" stop-color="#b8860b"/></linearGradient></defs>
      <rect x="70" y="10" width="60" height="45" rx="6" fill="none" stroke="url(#gv1)" stroke-width="3"/>
      <circle cx="100" cy="32" r="10" fill="none" stroke="url(#gv1)" stroke-width="2.5"/>
      <circle cx="100" cy="32" r="4" fill="url(#gv1)"/>
      <text x="100" y="72" text-anchor="middle" font-family="Arial Black,sans-serif" font-size="13" font-weight="900" fill="url(#gv1)">GAME VAULT</text>
    </svg>`,
  },
  {
    name: 'Vegas Sweeps',
    hot: true, bonus: 10,
    bg: 'linear-gradient(135deg,#1a0000,#3d0000)',
    accent: '#ff4444',
    logo: `<svg viewBox="0 0 200 80" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="vs1" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#ff4444"/><stop offset="50%" stop-color="#ff8800"/><stop offset="100%" stop-color="#ffcc00"/></linearGradient></defs>
      <text x="100" y="36" text-anchor="middle" font-family="Arial Black,sans-serif" font-size="18" font-weight="900" fill="url(#vs1)">VEGAS</text>
      <text x="100" y="62" text-anchor="middle" font-family="Arial Black,sans-serif" font-size="14" font-weight="900" fill="#ffffff" opacity="0.85">SWEEPS</text>
    </svg>`,
  },
  {
    name: 'Yolo777',
    hot: false, bonus: 10,
    bg: 'linear-gradient(135deg,#0d001a,#1a0033)',
    accent: '#ff00ff',
    logo: `<svg viewBox="0 0 200 80" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="yl1" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#ff00ff"/><stop offset="100%" stop-color="#aa00ff"/></linearGradient></defs>
      <text x="100" y="38" text-anchor="middle" font-family="Arial Black,sans-serif" font-size="24" font-weight="900" fill="url(#yl1)">YOLO</text>
      <text x="100" y="64" text-anchor="middle" font-family="Arial Black,sans-serif" font-size="20" font-weight="900" fill="#ffcc00" letter-spacing="6">777</text>
    </svg>`,
  },
  {
    name: 'Game Room',
    hot: true, bonus: 10,
    bg: 'linear-gradient(135deg,#001400,#002800)',
    accent: '#00cc44',
    logo: `<svg viewBox="0 0 200 80" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="gr1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#00cc44"/><stop offset="100%" stop-color="#007722"/></linearGradient></defs>
      <rect x="25" y="20" width="150" height="45" rx="8" fill="none" stroke="url(#gr1)" stroke-width="2.5"/>
      <circle cx="60" cy="42" r="8" fill="none" stroke="url(#gr1)" stroke-width="2"/>
      <rect x="80" y="38" width="5" height="12" rx="2" fill="url(#gr1)"/>
      <rect x="90" y="34" width="5" height="16" rx="2" fill="url(#gr1)"/>
      <rect x="100" y="30" width="5" height="20" rx="2" fill="url(#gr1)"/>
      <text x="100" y="76" text-anchor="middle" font-family="Arial Black,sans-serif" font-size="11" font-weight="900" fill="url(#gr1)">GAME ROOM</text>
    </svg>`,
  },
  {
    name: 'Blue Dragon',
    hot: false, bonus: 10,
    bg: 'linear-gradient(135deg,#001428,#002856)',
    accent: '#00aaff',
    logo: `<svg viewBox="0 0 200 80" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="bd1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#00aaff"/><stop offset="100%" stop-color="#0044cc"/></linearGradient></defs>
      <path d="M50,55 Q70,20 100,15 Q130,20 150,55 Q130,45 100,48 Q70,45 50,55Z" fill="url(#bd1)" opacity="0.8"/>
      <path d="M100,15 L110,30 L100,28 L90,30 Z" fill="#00ddff"/>
      <text x="100" y="74" text-anchor="middle" font-family="Arial Black,sans-serif" font-size="13" font-weight="900" fill="url(#bd1)">BLUE DRAGON</text>
    </svg>`,
  },
  {
    name: 'Mr All In One',
    hot: true, bonus: 10,
    bg: 'linear-gradient(135deg,#0a0a0a,#1a1a00)',
    accent: '#ffdd00',
    logo: `<svg viewBox="0 0 200 80" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="ma1" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#ffdd00"/><stop offset="100%" stop-color="#ff8800"/></linearGradient></defs>
      <text x="100" y="30" text-anchor="middle" font-family="Arial Black,sans-serif" font-size="12" font-weight="900" fill="url(#ma1)">MR. ALL</text>
      <text x="100" y="50" text-anchor="middle" font-family="Arial Black,sans-serif" font-size="12" font-weight="900" fill="#ffffff">IN ONE</text>
      <text x="100" y="70" text-anchor="middle" font-family="Arial Black,sans-serif" font-size="9" font-weight="700" fill="url(#ma1)" opacity="0.7">ONLINE</text>
    </svg>`,
  },
  {
    name: 'Golden Treasure',
    hot: false, bonus: 10,
    bg: 'linear-gradient(135deg,#1a1000,#332200)',
    accent: '#ffd700',
    logo: `<svg viewBox="0 0 200 80" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="gt1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#ffd700"/><stop offset="50%" stop-color="#ffaa00"/><stop offset="100%" stop-color="#cc8800"/></linearGradient></defs>
      <polygon points="100,5 108,28 132,28 114,43 121,66 100,52 79,66 86,43 68,28 92,28" fill="url(#gt1)" opacity="0.9"/>
      <text x="100" y="78" text-anchor="middle" font-family="Arial Black,sans-serif" font-size="10" font-weight="900" fill="url(#gt1)">GOLDEN TREASURE</text>
    </svg>`,
  },
  {
    name: 'Cash Machine',
    hot: false, bonus: 10,
    bg: 'linear-gradient(135deg,#001a00,#004400)',
    accent: '#00ff44',
    logo: `<svg viewBox="0 0 200 80" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="cm1" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#00ff44"/><stop offset="100%" stop-color="#00aa22"/></linearGradient></defs>
      <text x="100" y="36" text-anchor="middle" font-family="Arial Black,sans-serif" font-size="16" font-weight="900" fill="url(#cm1)">CASH</text>
      <text x="100" y="60" text-anchor="middle" font-family="Arial Black,sans-serif" font-size="14" font-weight="900" fill="#ffffff">MACHINE</text>
      <text x="100" y="4" text-anchor="middle" font-family="Arial Black,sans-serif" font-size="10" font-weight="900" fill="#00ff44" opacity="0.7">$$$</text>
    </svg>`,
  },
  {
    name: 'River Sweep',
    hot: false, bonus: 10,
    bg: 'linear-gradient(135deg,#001428,#003366)',
    accent: '#00ccff',
    logo: `<svg viewBox="0 0 200 80" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="rs1" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#00ccff"/><stop offset="100%" stop-color="#0088cc"/></linearGradient></defs>
      <path d="M20,50 Q50,30 80,45 Q110,60 140,40 Q165,25 180,35" fill="none" stroke="url(#rs1)" stroke-width="4" opacity="0.7"/>
      <text x="100" y="30" text-anchor="middle" font-family="Arial Black,sans-serif" font-size="14" font-weight="900" fill="url(#rs1)">RIVER</text>
      <text x="100" y="72" text-anchor="middle" font-family="Arial Black,sans-serif" font-size="14" font-weight="900" fill="#ffffff">SWEEP</text>
    </svg>`,
  },
  {
    name: 'Panda Master',
    hot: false, bonus: 10,
    bg: 'linear-gradient(135deg,#001a00,#003300)',
    accent: '#66ff88',
    logo: `<svg viewBox="0 0 200 80" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="pm1" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#66ff88"/><stop offset="100%" stop-color="#00cc44"/></linearGradient></defs>
      <circle cx="100" cy="32" r="22" fill="#111" stroke="url(#pm1)" stroke-width="2.5"/>
      <circle cx="88" cy="26" r="8" fill="#333"/>
      <circle cx="112" cy="26" r="8" fill="#333"/>
      <circle cx="92" cy="34" r="5" fill="#fff"/>
      <circle cx="108" cy="34" r="5" fill="#fff"/>
      <text x="100" y="72" text-anchor="middle" font-family="Arial Black,sans-serif" font-size="12" font-weight="900" fill="url(#pm1)">PANDA MASTER</text>
    </svg>`,
  },
  {
    name: 'Cash Vault',
    hot: false, bonus: 10,
    bg: 'linear-gradient(135deg,#0d1a00,#1a3300)',
    accent: '#88ff00',
    logo: `<svg viewBox="0 0 200 80" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="cv1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#88ff00"/><stop offset="100%" stop-color="#44aa00"/></linearGradient></defs>
      <rect x="65" y="10" width="70" height="55" rx="8" fill="none" stroke="url(#cv1)" stroke-width="3"/>
      <circle cx="100" cy="37" r="12" fill="none" stroke="url(#cv1)" stroke-width="2.5"/>
      <text x="100" y="42" text-anchor="middle" font-family="Arial Black,sans-serif" font-size="12" font-weight="900" fill="url(#cv1)">$</text>
      <text x="100" y="76" text-anchor="middle" font-family="Arial Black,sans-serif" font-size="11" font-weight="900" fill="url(#cv1)">CASH VAULT</text>
    </svg>`,
  },
  {
    name: 'Lucky Stars',
    hot: false, bonus: 10,
    bg: 'linear-gradient(135deg,#0d0d1a,#1a1a3d)',
    accent: '#ffdd00',
    logo: `<svg viewBox="0 0 200 80" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="ls1" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#ffdd00"/><stop offset="100%" stop-color="#ff8800"/></linearGradient></defs>
      <polygon points="55,42 58,33 65,33 59,38 62,48 55,42" fill="#ffdd00"/>
      <polygon points="100,8 104,20 117,20 107,27 111,39 100,32 89,39 93,27 83,20 96,20" fill="url(#ls1)"/>
      <polygon points="145,42 142,33 135,33 141,38 138,48 145,42" fill="#ffdd00"/>
      <text x="100" y="62" text-anchor="middle" font-family="Arial Black,sans-serif" font-size="13" font-weight="900" fill="url(#ls1)">LUCKY STARS</text>
    </svg>`,
  },
  {
    name: 'Mafia City',
    hot: false, bonus: 10,
    bg: 'linear-gradient(135deg,#0d0000,#1a0000)',
    accent: '#cc0000',
    logo: `<svg viewBox="0 0 200 80" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="mc1" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#cc0000"/><stop offset="100%" stop-color="#880000"/></linearGradient></defs>
      <text x="100" y="36" text-anchor="middle" font-family="Arial Black,sans-serif" font-size="20" font-weight="900" fill="url(#mc1)">MAFIA</text>
      <text x="100" y="62" text-anchor="middle" font-family="Arial Black,sans-serif" font-size="20" font-weight="900" fill="#ffffff">CITY</text>
    </svg>`,
  },
  {
    name: 'Royal Casino',
    hot: false, bonus: 10,
    bg: 'linear-gradient(135deg,#1a1400,#332a00)',
    accent: '#daa520',
    logo: `<svg viewBox="0 0 200 80" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="rc1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#ffd700"/><stop offset="100%" stop-color="#daa520"/></linearGradient></defs>
      <polygon points="100,5 107,18 121,18 110,27 114,40 100,32 86,40 90,27 79,18 93,18" fill="url(#rc1)"/>
      <text x="100" y="58" text-anchor="middle" font-family="Arial Black,sans-serif" font-size="13" font-weight="900" fill="url(#rc1)">ROYAL</text>
      <text x="100" y="74" text-anchor="middle" font-family="Arial Black,sans-serif" font-size="11" font-weight="900" fill="#ffffff" opacity="0.8">CASINO</text>
    </svg>`,
  },
  {
    name: 'Big Winner',
    hot: false, bonus: 10,
    bg: 'linear-gradient(135deg,#001400,#002800)',
    accent: '#00ff88',
    logo: `<svg viewBox="0 0 200 80" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="bw1" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#00ff88"/><stop offset="100%" stop-color="#00ccff"/></linearGradient></defs>
      <text x="100" y="35" text-anchor="middle" font-family="Arial Black,sans-serif" font-size="18" font-weight="900" fill="url(#bw1)">BIG</text>
      <text x="100" y="62" text-anchor="middle" font-family="Arial Black,sans-serif" font-size="18" font-weight="900" fill="#ffffff">WINNER</text>
      <path d="M60,20 L70,8 L80,20 Z" fill="#ffdd00"/>
      <path d="M100,20 L110,8 L120,20 Z" fill="#ffdd00"/>
      <path d="M120,20 L130,8 L140,20 Z" fill="#ffdd00"/>
    </svg>`,
  },
  {
    name: 'Cash Frenzy',
    hot: false, bonus: 10,
    bg: 'linear-gradient(135deg,#001a00,#003300)',
    accent: '#00ff44',
    logo: `<svg viewBox="0 0 200 80" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="cf1" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#00ff44"/><stop offset="100%" stop-color="#ffcc00"/></linearGradient></defs>
      <text x="100" y="36" text-anchor="middle" font-family="Arial Black,sans-serif" font-size="18" font-weight="900" fill="url(#cf1)">CASH</text>
      <text x="100" y="62" text-anchor="middle" font-family="Arial Black,sans-serif" font-size="16" font-weight="900" fill="#ffffff">FRENZY</text>
    </svg>`,
  },
  {
    name: 'Winstar',
    hot: false, bonus: 10,
    bg: 'linear-gradient(135deg,#0d0d28,#1a1a50)',
    accent: '#6677ff',
    logo: `<svg viewBox="0 0 200 80" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="ws1" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#6677ff"/><stop offset="100%" stop-color="#aa44ff"/></linearGradient></defs>
      <polygon points="100,6 104,18 117,18 107,26 111,38 100,30 89,38 93,26 83,18 96,18" fill="url(#ws1)" opacity="0.9"/>
      <text x="100" y="62" text-anchor="middle" font-family="Arial Black,sans-serif" font-size="18" font-weight="900" fill="url(#ws1)">WINSTAR</text>
    </svg>`,
  },
  {
    name: 'Vegas Luck',
    hot: false, bonus: 10,
    bg: 'linear-gradient(135deg,#1a0000,#330000)',
    accent: '#ff6644',
    logo: `<svg viewBox="0 0 200 80" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="vl1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#ff6644"/><stop offset="100%" stop-color="#ffaa00"/></linearGradient></defs>
      <text x="100" y="36" text-anchor="middle" font-family="Arial Black,sans-serif" font-size="18" font-weight="900" fill="url(#vl1)">VEGAS</text>
      <text x="100" y="62" text-anchor="middle" font-family="Arial Black,sans-serif" font-size="18" font-weight="900" fill="#ffffff">LUCK</text>
    </svg>`,
  },
  {
    name: 'Gem Slots',
    hot: false, bonus: 10,
    bg: 'linear-gradient(135deg,#001428,#002856)',
    accent: '#00eeff',
    logo: `<svg viewBox="0 0 200 80" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="gs1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#00eeff"/><stop offset="100%" stop-color="#aa00ff"/></linearGradient></defs>
      <polygon points="100,8 118,22 118,48 100,62 82,48 82,22" fill="none" stroke="url(#gs1)" stroke-width="2.5"/>
      <polygon points="100,16 112,26 112,44 100,54 88,44 88,26" fill="url(#gs1)" opacity="0.3"/>
      <text x="100" y="76" text-anchor="middle" font-family="Arial Black,sans-serif" font-size="12" font-weight="900" fill="url(#gs1)">GEM SLOTS</text>
    </svg>`,
  },
  {
    name: 'Ace',
    hot: false, bonus: 10,
    bg: 'linear-gradient(135deg,#0d0d0d,#1a1a1a)',
    accent: '#ffffff',
    logo: `<svg viewBox="0 0 200 80" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="ac1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#ffffff"/><stop offset="100%" stop-color="#aaaaaa"/></linearGradient></defs>
      <rect x="65" y="8" width="70" height="58" rx="8" fill="none" stroke="url(#ac1)" stroke-width="2.5"/>
      <text x="100" y="52" text-anchor="middle" font-family="Georgia,serif" font-size="38" font-weight="900" fill="url(#ac1)">A</text>
      <text x="74" y="26" text-anchor="middle" font-family="Georgia,serif" font-size="14" fill="#cc0000">♠</text>
    </svg>`,
  },
  {
    name: 'Juwa 2.0',
    hot: true, bonus: 10,
    bg: 'linear-gradient(135deg,#1a0a00,#3d2000)',
    accent: '#ff8800',
    logo: `<svg viewBox="0 0 200 80" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="j2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#ffaa00"/><stop offset="100%" stop-color="#ff4400"/></linearGradient></defs>
      <text x="90" y="50" text-anchor="middle" font-family="Arial Black,sans-serif" font-size="32" font-weight="900" fill="url(#j2)">JUWA</text>
      <text x="160" y="35" text-anchor="middle" font-family="Arial Black,sans-serif" font-size="18" font-weight="900" fill="#00eeff">2.0</text>
    </svg>`,
  },
]

// ═══════════════════════════════════════════════════════════════════
//  EDIT HERE. Only put things in this block that are TRUE for your business.
//  Anything left empty ('' / null / []) is simply hidden on the page.
// ═══════════════════════════════════════════════════════════════════
const SITE = {
  signupBonus: '',      // e.g. '100% first-deposit bonus'  → shows in the top bar and the hero badge
  playersOnline: null,  // a REAL number, e.g. 312            → shows "312 PLAYERS ONLINE" in the top bar
  heroBanner: '',       // e.g. '/images/banners/hero.jpg'  (file in public/images/banners/) — '' keeps the default background
  gameImages: [],       // game logos you uploaded to public/images/games/, by lowercase name without spaces,
                        // e.g. ['firekirin','orionstars','milkyway']  →  uses /images/games/firekirin.png etc.
  reviews: [],          // REAL player reviews, e.g. [{ name:'Jay G.', tag:'Fire Kirin', stars:5, text:'…' }]
                        // (the Reviews section and its menu link are hidden while this is empty)
}

const STEPS = [
  { num:'01', icon:'👤', title:'Register Free',  sub:'Create Account', desc:'Create your account. Your wallet is set up for you.', color:'#fbbf24' },
  { num:'02', icon:'💳', title:'Add Money',      sub:'Upload & Review', desc:'Choose a payment method and upload your payment proof. Our team reviews it and adds the funds to your wallet.', color:'#f59e0b' },
  { num:'03', icon:'🎮', title:'Load & Play',    sub:'Enjoy the Game', desc:'Load credits from your wallet into your game room. Our team processes the load, then you play.', color:'#10b981' },
]

// Only facts that come from this page itself
const STATS = [
  { val:GAMES.length, suffix:'', label:'Game Rooms' },
  { val:1,            suffix:'', label:'Wallet for Every Game' },
]

const TESTIMONIALS = SITE.reviews

const PARTICLES = Array.from({length:30},(_,i)=>({
  id:i, symbol:['♠','♥','♦','♣','🎰','💎','🃏','⭐','🎲','👑'][i%10],
  x:Math.random()*100, dur:10+Math.random()*16, delay:Math.random()*12,
  size:12+Math.random()*18, opacity:0.03+Math.random()*0.08,
}))

// ─── HOOKS ─────────────────────────────────────────────────────────────────
function useCountUp(target,duration=2000){
  const [count,setCount]=useState(0)
  const [started,setStarted]=useState(false)
  const ref=useRef()
  useEffect(()=>{
    const obs=new IntersectionObserver(([e])=>{if(e.isIntersecting)setStarted(true)},{threshold:.4})
    if(ref.current)obs.observe(ref.current)
    return()=>obs.disconnect()
  },[])
  useEffect(()=>{
    if(!started)return
    const num=parseInt(target)||0
    const steps=60,interval=duration/steps,inc=num/steps
    let cur=0
    const t=setInterval(()=>{cur+=inc;if(cur>=num){setCount(num);clearInterval(t)}else setCount(Math.floor(cur))},interval)
    return()=>clearInterval(t)
  },[started,target,duration])
  return[count,ref]
}

// ─── SMALL COMPONENTS ──────────────────────────────────────────────────────
function StatCard({val,suffix,label}){
  const[count,ref]=useCountUp(val)
  return(
    <div ref={ref} style={{textAlign:'center',padding:'28px 36px',borderRight:'1px solid rgba(255,255,255,.06)',flex:1,minWidth:120}}>
      <div style={{fontFamily:"'Cinzel Decorative',serif",fontSize:36,fontWeight:900,background:'linear-gradient(135deg,#f59e0b,#fbbf24)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',lineHeight:1,marginBottom:8}}>{count}{suffix}</div>
      <div style={{fontSize:11,letterSpacing:'.12em',textTransform:'uppercase',color:'rgba(255,255,255,.35)',fontWeight:700}}>{label}</div>
    </div>
  )
}

function LiveBar(){
  const items=[
    SITE.playersOnline ? ['#10b981',`🟢 ${Number(SITE.playersOnline).toLocaleString()} PLAYERS ONLINE`] : null,
    SITE.signupBonus   ? ['#fbbf24',`💎 ${String(SITE.signupBonus).toUpperCase()}`] : null,
    ['#fbbf24',`🎮 ${GAMES.length} GAME ROOMS`],
    ['#10b981','👛 ONE WALLET FOR EVERY GAME'],
    ['rgba(255,255,255,.6)','18+ · PLAY RESPONSIBLY'],
  ].filter(Boolean)
  return(
    <div style={{background:'rgba(5,5,5,.97)',borderBottom:'1px solid rgba(251,191,36,.2)',height:36,display:'flex',alignItems:'center',overflow:'hidden',position:'fixed',top:0,left:0,right:0,zIndex:101}}>
      <div style={{display:'flex',alignItems:'center',gap:40,animation:'marquee 30s linear infinite',whiteSpace:'nowrap',width:'max-content'}}>
        {[...Array(3)].map((_,rep)=>(
          <span key={rep} style={{display:'inline-flex',alignItems:'center',gap:32}}>
            {items.map(([c,t],i)=>(
              <span key={i} style={{display:'inline-flex',alignItems:'center',gap:32}}>
                <span style={{color:c,fontSize:12,fontWeight:800,letterSpacing:'.06em'}}>{t}</span>
                <span style={{color:'rgba(255,255,255,.2)',fontSize:12}}>✦</span>
              </span>
            ))}
          </span>
        ))}
      </div>
    </div>
  )
}

const gameSlug=(name)=>name.toLowerCase().replace(/[^a-z0-9]/g,'')

function GameLogo({game}){
  const slug=gameSlug(game.name)
  const[failed,setFailed]=useState(false)
  if(SITE.gameImages.includes(slug)&&!failed){
    return <img src={`/images/games/${slug}.png`} alt={game.name} onError={()=>setFailed(true)} style={{width:'85%',height:100,objectFit:'contain',position:'relative',zIndex:1,filter:'drop-shadow(0 4px 12px rgba(0,0,0,.5))'}}/>
  }
  return <div style={{width:'85%',height:80,position:'relative',zIndex:1}} dangerouslySetInnerHTML={{__html:game.logo}}/>
}

function GameCard({game,index}){
  const[hov,setHov]=useState(false)
  return(
    <div onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} style={{
      position:'relative',
      background:hov?game.bg.replace('135deg','150deg'):'rgba(255,255,255,.03)',
      border:`1px solid ${hov?game.accent+'99':'rgba(255,255,255,.08)'}`,
      borderRadius:18,overflow:'hidden',cursor:'pointer',
      transition:'all .25s ease',
      transform:hov?'translateY(-8px) scale(1.03)':'none',
      boxShadow:hov?`0 24px 60px rgba(0,0,0,.6), 0 0 40px ${game.accent}33`:'0 4px 16px rgba(0,0,0,.3)',
    }}>
      {/* Bonus badge */}
      <div style={{position:'absolute',top:10,left:10,background:'rgba(16,185,129,.9)',color:'#fff',fontSize:9,fontWeight:800,letterSpacing:'.06em',padding:'3px 8px',borderRadius:99,zIndex:2}}>
        {game.bonus}% BONUS
      </div>
      {/* Hot badge */}
      {game.hot&&<div style={{position:'absolute',top:10,right:10,background:'linear-gradient(135deg,#ef4444,#f97316)',color:'#fff',fontSize:9,fontWeight:800,padding:'3px 8px',borderRadius:99,zIndex:2}}>🔥 HOT</div>}

      {/* Game background */}
      <div style={{height:140,background:game.bg,position:'relative',display:'flex',alignItems:'center',justifyContent:'center'}}>
        {/* Glow orb behind logo */}
        <div style={{position:'absolute',inset:0,background:`radial-gradient(ellipse at 50% 50%, ${game.accent}22 0%, transparent 70%)`,transition:'opacity .25s',opacity:hov?1:.5}}/>
        <GameLogo game={game}/>
      </div>

      {/* Name bar */}
      <div style={{padding:'12px 14px',background:'rgba(0,0,0,.4)',borderTop:`1px solid ${game.accent}33`,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <span style={{fontSize:11,fontWeight:800,letterSpacing:'.08em',textTransform:'uppercase',color:hov?'#fff':'rgba(255,255,255,.7)',transition:'color .2s'}}>{game.name}</span>
        {hov&&<span style={{fontSize:10,color:game.accent,fontWeight:700}}>PLAY →</span>}
      </div>
    </div>
  )
}

function TestiCard({t}){
  const[hov,setHov]=useState(false)
  return(
    <div onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} style={{
      background:'rgba(255,255,255,.03)',border:`1px solid rgba(251,191,36,${hov?.5:.15})`,
      borderRadius:20,padding:'28px 24px',backdropFilter:'blur(10px)',
      transition:'all .3s',transform:hov?'translateY(-4px)':'none',
      boxShadow:hov?'0 16px 48px rgba(251,191,36,.15)':'none',
    }}>
      <div style={{color:'#f59e0b',fontSize:14,marginBottom:12}}>{'★'.repeat(t.stars)}</div>
      <p style={{color:'rgba(255,255,255,.6)',fontSize:14,lineHeight:1.8,marginBottom:20,fontStyle:'italic'}}>"{t.text}"</p>
      <div style={{display:'flex',alignItems:'center',gap:12}}>
        <div style={{width:40,height:40,borderRadius:'50%',background:'linear-gradient(135deg,#f59e0b,#fbbf24)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,fontWeight:900,color:'#fff'}}>{t.name[0]}</div>
        <div>
          <div style={{fontWeight:700,fontSize:14,color:'#fff'}}>{t.name}</div>
          <div style={{fontSize:11,color:'#fbbf24',fontWeight:600,letterSpacing:'.06em',textTransform:'uppercase'}}>{t.tag}</div>
        </div>
      </div>
    </div>
  )
}

function FaqItem({q,a}){
  const[open,setOpen]=useState(false)
  return(
    <div style={{borderBottom:'1px solid rgba(255,255,255,.07)'}}>
      <button onClick={()=>setOpen(p=>!p)} style={{width:'100%',display:'flex',justifyContent:'space-between',alignItems:'center',padding:'20px 0',background:'none',border:'none',cursor:'pointer',color:'#fff',textAlign:'left'}}>
        <span style={{fontSize:15,fontWeight:600}}>{q}</span>
        <span style={{color:'#fbbf24',fontSize:22,fontWeight:300,transform:open?'rotate(45deg)':'none',transition:'transform .2s',flexShrink:0,marginLeft:16}}>+</span>
      </button>
      {open&&<div style={{color:'rgba(255,255,255,.5)',fontSize:14,lineHeight:1.8,paddingBottom:20}}>{a}</div>}
    </div>
  )
}

// ─── MAIN PAGE ──────────────────────────────────────────────────────────────
export default function Home(){
  const[scrollY,setScrollY]=useState(0)
  const[mousePos,setMousePos]=useState({x:0,y:0})
  const[gameFilter,setGameFilter]=useState('all')

  useEffect(()=>{
    const onScroll=()=>setScrollY(window.scrollY)
    const onMouse=e=>setMousePos({x:e.clientX/window.innerWidth,y:e.clientY/window.innerHeight})
    window.addEventListener('scroll',onScroll,{passive:true})
    window.addEventListener('mousemove',onMouse,{passive:true})
    return()=>{window.removeEventListener('scroll',onScroll);window.removeEventListener('mousemove',onMouse)}
  },[])

  const px=(mousePos.x-.5)*28, py=(mousePos.y-.5)*28
  const filteredGames=gameFilter==='hot'?GAMES.filter(g=>g.hot):GAMES

  return(
    <>
      <Head>
        <title>Casinoze Room — #1 Fish Game Room Platform</title>
        <meta name="viewport" content="width=device-width,initial-scale=1"/>
        <meta name="description" content="One account and one wallet for every game room. Add money, load credits and play."/>
        <link href="https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@700;900&family=Cinzel:wght@400;600;700&family=Outfit:wght@300;400;500;600;700;800&display=swap" rel="stylesheet"/>
        <style>{`
          *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
          html{scroll-behavior:smooth}
          body{background:var(--bg-gradient);background-attachment:fixed;color:#fff;font-family:'Outfit',sans-serif;overflow-x:hidden}
          ::-webkit-scrollbar{width:4px}
          ::-webkit-scrollbar-track{background:#0b1220}
          ::-webkit-scrollbar-thumb{background:linear-gradient(#f59e0b,#f59e0b);border-radius:2px}
          #cz-cur{position:fixed;width:10px;height:10px;background:#f59e0b;border-radius:50%;pointer-events:none;z-index:9999;transform:translate(-50%,-50%);mix-blend-mode:screen}
          #cz-ring{position:fixed;width:32px;height:32px;border:1.5px solid rgba(251,191,36,.55);border-radius:50%;pointer-events:none;z-index:9998;transform:translate(-50%,-50%)}
          @keyframes marquee{0%{transform:translateX(0)}100%{transform:translateX(-33.333%)}}
          @keyframes floatUp{0%{transform:translateY(110vh) rotate(0deg);opacity:0}5%{opacity:1}95%{opacity:1}100%{transform:translateY(-15vh) rotate(540deg);opacity:0}}
          @keyframes shimmer{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
          @keyframes glow{0%,100%{box-shadow:0 0 20px rgba(251,191,36,.35),0 0 60px rgba(251,191,36,.1)}50%{box-shadow:0 0 40px rgba(251,191,36,.65),0 0 100px rgba(251,191,36,.25)}}
          @keyframes logoNeon{0%,100%{text-shadow:0 0 8px #fbbf24,0 0 24px #f59e0b}50%{text-shadow:0 0 18px #fcd34d,0 0 50px #fbbf24,0 0 80px #d97706}}
          @keyframes fadeUp{from{opacity:0;transform:translateY(36px)}to{opacity:1;transform:translateY(0)}}
          @keyframes pulseDot{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.5);opacity:.5}}
          @keyframes heroFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}
          @keyframes scanline{0%{transform:translateY(-100%)}100%{transform:translateY(100vh)}}
          .fade1{animation:fadeUp .8s .1s both}
          .fade2{animation:fadeUp .8s .25s both}
          .fade3{animation:fadeUp .8s .4s both}
          .fade4{animation:fadeUp .8s .55s both}
          .fade5{animation:fadeUp .8s .7s both}
          .btn-gold{display:inline-flex;align-items:center;gap:8px;padding:15px 40px;background:linear-gradient(135deg,#f59e0b,#fbbf24,#fcd34d);color:#050505;font-family:'Outfit',sans-serif;font-size:15px;font-weight:800;border-radius:14px;text-decoration:none;letter-spacing:.04em;border:none;cursor:pointer;transition:transform .2s,box-shadow .2s;box-shadow:0 0 28px rgba(245,158,11,.4),0 4px 16px rgba(0,0,0,.4);position:relative;overflow:hidden}
          .btn-gold::after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,.35),transparent);transform:translateX(-100%);transition:transform .45s}
          .btn-gold:hover::after{transform:translateX(100%)}
          .btn-gold:hover{transform:translateY(-3px) scale(1.02);box-shadow:0 0 50px rgba(245,158,11,.6),0 8px 28px rgba(0,0,0,.5)}
          .btn-outline{display:inline-flex;align-items:center;gap:8px;padding:14px 36px;background:rgba(255,255,255,.04);border:1.5px solid rgba(251,191,36,.45);color:#fff;font-family:'Outfit',sans-serif;font-size:15px;font-weight:700;border-radius:14px;text-decoration:none;letter-spacing:.04em;cursor:pointer;transition:all .2s;backdrop-filter:blur(12px)}
          .btn-outline:hover{background:rgba(251,191,36,.18);border-color:rgba(251,191,36,.85);transform:translateY(-3px);box-shadow:0 0 28px rgba(251,191,36,.3)}
          .section-tag{display:inline-block;font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;padding:5px 16px;border-radius:99px;margin-bottom:16px}
          .game-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(170px,100%),1fr));gap:16px}
          @media(max-width:768px){
            .game-grid{grid-template-columns:repeat(auto-fill,minmax(min(140px,100%),1fr));gap:12px}
            .hero-btns{flex-direction:column;align-items:center}
            .stats-bar>div{border-right:none!important;border-bottom:1px solid rgba(255,255,255,.06)}
            .about-grid{grid-template-columns:1fr!important}
            .contact-grid{grid-template-columns:1fr!important}
            .nav-anchors{display:none!important}
            .site-nav{padding:8px 14px!important}
            .nav-links{gap:0!important}
            .nav-logo .logo-mark{height:40px!important;width:40px!important}
            .nav-logo .logo-text>span:first-child{font-size:16px!important}
            .nav-logo .logo-text>span:last-child{font-size:11px!important}
            .nav-btns{gap:8px!important}
            .nav-btns a{padding:8px 14px!important;font-size:12px!important}
            .about-grid{padding:56px 20px!important;gap:32px!important}
            .contact-grid{gap:32px!important}
          }
          @media(max-width:420px){
            .nav-logo .logo-text{display:none}
          }
        `}</style>
      </Head>

      {/* Custom cursor */}
      <div id="cz-cur"/>
      <div id="cz-ring"/>
      <script dangerouslySetInnerHTML={{__html:`const C=document.getElementById('cz-cur'),R=document.getElementById('cz-ring');let mx=0,my=0,rx=0,ry=0;document.addEventListener('mousemove',e=>{mx=e.clientX;my=e.clientY;C.style.left=mx+'px';C.style.top=my+'px'});(function loop(){rx+=(mx-rx)*.1;ry+=(my-ry)*.1;R.style.left=rx+'px';R.style.top=ry+'px';requestAnimationFrame(loop)})()`}}/>

      {/* Floating particles */}
      <div style={{position:'fixed',inset:0,pointerEvents:'none',zIndex:0,overflow:'hidden'}}>
        {PARTICLES.map(p=>(
          <div key={p.id} style={{position:'absolute',left:`${p.x}%`,bottom:'-10%',fontSize:p.size,opacity:p.opacity,userSelect:'none',animation:`floatUp ${p.dur}s ${p.delay}s infinite linear`}}>{p.symbol}</div>
        ))}
      </div>

      {/* Parallax BG orbs */}
      <div style={{position:'fixed',inset:0,pointerEvents:'none',zIndex:0}}>
        <div style={{position:'absolute',top:`calc(15% + ${py*1.4}px)`,left:`calc(10% + ${px*1.4}px)`,width:600,height:600,borderRadius:'50%',background:'radial-gradient(circle,rgba(245,158,11,.16) 0%,transparent 70%)',filter:'blur(50px)',transition:'top .15s,left .15s'}}/>
        <div style={{position:'absolute',top:`calc(55% + ${py*-.9}px)`,right:`calc(8% + ${px*-.9}px)`,width:450,height:450,borderRadius:'50%',background:'radial-gradient(circle,rgba(245,158,11,.09) 0%,transparent 70%)',filter:'blur(60px)',transition:'top .15s,right .15s'}}/>
        <div style={{position:'absolute',bottom:'20%',left:'40%',width:350,height:350,borderRadius:'50%',background:'radial-gradient(circle,rgba(236,72,153,.07) 0%,transparent 70%)',filter:'blur(55px)'}}/>
      </div>

      {/* ── LIVE TICKER ── */}
      <LiveBar/>

      {/* ── NAV ── */}
      <nav className="site-nav" style={{position:'fixed',top:36,left:0,right:0,zIndex:100,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 48px',background:scrollY>40?'rgba(5,5,5,.94)':'transparent',backdropFilter:scrollY>40?'blur(24px)':'none',borderBottom:scrollY>40?'1px solid rgba(251,191,36,.18)':'none',transition:'all .4s'}}>
        <div className="nav-logo" style={{display:'flex',alignItems:'center',gap:12}}>
          <Logo variant="full" height={66} />
        </div>
        <div className="nav-links" style={{display:'flex',alignItems:'center',gap:32}}>
          <div className="nav-anchors" style={{display:'flex',gap:28}}>
            {[['Games','#games'],['How It Works','#how'],...(TESTIMONIALS.length?[['Reviews','#reviews']]:[]),['FAQ','#faq']].map(([label,href])=>(
              <a key={label} href={href} style={{color:'rgba(255,255,255,.6)',textDecoration:'none',fontSize:14,fontWeight:600,letterSpacing:'.03em',transition:'color .2s'}} onMouseEnter={e=>e.target.style.color='#fff'} onMouseLeave={e=>e.target.style.color='rgba(255,255,255,.6)'}>{label}</a>
            ))}
          </div>
          <div className="nav-btns" style={{display:'flex',gap:10}}>
            <Link href="/auth/login" className="btn-outline" style={{padding:'9px 22px',fontSize:13}}>Login</Link>
            <Link href="/auth/register" className="btn-gold" style={{padding:'9px 22px',fontSize:13}}>🎲 Join Free</Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'160px 24px 100px',textAlign:'center',position:'relative',zIndex:2,overflow:'hidden'}}>
        {/* Hero background image — dark fantasy wizard/dragon from Pixabay (free) */}
        <div style={{position:'absolute',inset:0,zIndex:0}}>
          <img
            src={SITE.heroBanner||"https://cdn.pixabay.com/photo/2023/09/11/08/15/ai-generated-8246488_1280.jpg"}
            alt=""
            style={{width:'100%',height:'100%',objectFit:'cover',objectPosition:'center top',opacity:SITE.heroBanner?.5:.18,filter:SITE.heroBanner?'none':'saturate(1.4) hue-rotate(210deg)'}}
            onError={e=>e.target.style.display='none'}
          />
          <div style={{position:'absolute',inset:0,background:'linear-gradient(to bottom,rgba(7,9,15,.4) 0%,rgba(7,9,15,.3) 40%,rgba(7,9,15,.9) 80%,#050505 100%)'}}/>
          {/* Teal/purple scanline glow like highrollers */}
          <div style={{position:'absolute',bottom:0,left:0,right:0,height:180,background:'linear-gradient(to top,rgba(0,200,200,.08),transparent)'}}/>
        </div>

        {/* Content */}
        <div style={{position:'relative',zIndex:1}}>
          {SITE.signupBonus && (
          <div className="fade1" style={{display:'inline-flex',alignItems:'center',gap:8,background:'rgba(245,158,11,.12)',border:'1px solid rgba(245,158,11,.35)',borderRadius:99,padding:'6px 20px',fontSize:12,fontWeight:800,color:'#fbbf24',letterSpacing:'.1em',textTransform:'uppercase',marginBottom:20}}>
            <span style={{width:7,height:7,borderRadius:'50%',background:'#10b981',display:'inline-block',animation:'pulseDot 1.5s infinite'}}/>
            🎁 {SITE.signupBonus}
          </div>
          )}

          <h1 className="fade2" style={{fontFamily:"'Cinzel Decorative',serif",fontSize:'clamp(34px,7vw,90px)',fontWeight:900,lineHeight:1.05,marginBottom:12,letterSpacing:'-.01em'}}>
            Play Smart.
          </h1>
          <h1 className="fade3" style={{fontFamily:"'Cinzel Decorative',serif",fontSize:'clamp(34px,7vw,90px)',fontWeight:900,lineHeight:1.05,marginBottom:32,background:'linear-gradient(90deg,#fbbf24,#ec4899,#f59e0b,#fbbf24)',backgroundSize:'300% auto',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',animation:'shimmer 4s linear infinite'}}>
            Win Bigger.
          </h1>

          <p className="fade4" style={{color:'rgba(255,255,255,.55)',fontSize:18,maxWidth:560,margin:'0 auto 48px',lineHeight:1.85,fontWeight:400}}>
            One account and one wallet unlock <strong style={{color:'#fff',fontWeight:700}}>{GAMES.length} game rooms</strong>. Add money, load credits into your game, and play.
          </p>

          <div className="fade5 hero-btns" style={{display:'flex',gap:14,justifyContent:'center',flexWrap:'wrap',marginBottom:80}}>
            <Link href="/auth/register" className="btn-gold" style={{fontSize:16,padding:'17px 52px'}}>🎲 Start Playing — Free</Link>
            <Link href="/auth/login" className="btn-outline" style={{fontSize:16,padding:'16px 44px'}}>Login to Account</Link>
          </div>

          {/* Stats bar */}
          <div className="stats-bar" style={{display:'flex',flexWrap:'wrap',justifyContent:'center',background:'rgba(255,255,255,.03)',border:'1px solid rgba(255,255,255,.07)',borderRadius:22,overflow:'hidden',animation:'glow 5s infinite',backdropFilter:'blur(12px)'}}>
            {STATS.map((s,i)=><StatCard key={i} {...s}/>)}
          </div>
        </div>
      </section>

      {/* ── DIVIDER ── */}
      <div style={{height:1,background:'linear-gradient(90deg,transparent,rgba(0,200,200,.5),rgba(251,191,36,.4),transparent)',margin:'0 8%'}}/>

      {/* ── TRENDING GAMES STRIP ── */}
      <div style={{padding:'28px 0',overflow:'hidden',background:'rgba(0,0,0,.3)',borderTop:'1px solid rgba(255,255,255,.04)',borderBottom:'1px solid rgba(255,255,255,.04)',position:'relative',zIndex:2}}>
        <div style={{fontSize:13,fontWeight:800,letterSpacing:'.12em',textTransform:'uppercase',color:'rgba(255,255,255,.4)',textAlign:'center',marginBottom:16}}>
          🔥 Trending Social Games Right Now
        </div>
        <div style={{display:'flex',gap:14,animation:'marquee 20s linear infinite',whiteSpace:'nowrap',width:'max-content',paddingLeft:24}}>
          {[...GAMES,...GAMES].map((g,i)=>(
            <div key={i} style={{display:'inline-flex',alignItems:'center',gap:8,padding:'8px 20px',borderRadius:99,background:`rgba(0,0,0,.5)`,border:`1px solid ${g.accent}44`,cursor:'pointer',transition:'all .2s',flexShrink:0}}>
              <span style={{fontSize:10,fontWeight:800,letterSpacing:'.08em',textTransform:'uppercase',color:g.accent}}>{g.name}</span>
              {g.hot&&<span style={{fontSize:9,background:'#ef4444',color:'#fff',padding:'1px 5px',borderRadius:99,fontWeight:700}}>HOT</span>}
            </div>
          ))}
        </div>
      </div>

      {/* ── GAMES SECTION ── */}
      <section id="games" style={{padding:'100px 24px',position:'relative',zIndex:2}}>
        <div style={{maxWidth:1260,margin:'0 auto'}}>
          <div style={{textAlign:'center',marginBottom:56}}>
            <div className="section-tag" style={{background:'rgba(245,158,11,.12)',color:'#f59e0b',border:'1px solid rgba(245,158,11,.3)'}}>Epic Arcade Games</div>
            <h2 style={{fontFamily:"'Cinzel',serif",fontSize:'clamp(26px,4.5vw,54px)',fontWeight:700,marginBottom:14}}>Play & Level Up Gaming</h2>
            <p style={{color:'rgba(255,255,255,.4)',fontSize:16,marginBottom:32,fontWeight:400}}>One wallet. Every game. Credits delivered automatically after deposit approval.</p>
            <div style={{display:'inline-flex',gap:0,background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.1)',borderRadius:12,padding:4}}>
              {[['all','All Games'],['hot','🔥 Hot Games']].map(([key,label])=>(
                <button key={key} onClick={()=>setGameFilter(key)} style={{padding:'9px 28px',borderRadius:9,border:'none',cursor:'pointer',fontFamily:"'Outfit',sans-serif",fontSize:13,fontWeight:700,background:gameFilter===key?'linear-gradient(135deg,#f59e0b,#fbbf24)':'transparent',color:gameFilter===key?'#fff':'rgba(255,255,255,.5)',transition:'all .2s'}}>{label}</button>
              ))}
            </div>
          </div>
          <div className="game-grid">
            {filteredGames.map((g,i)=><GameCard key={g.name} game={g} index={i}/>)}
          </div>
        </div>
      </section>

      {/* ── DIVIDER ── */}
      <div style={{height:1,background:'linear-gradient(90deg,transparent,rgba(245,158,11,.3),rgba(251,191,36,.5),transparent)',margin:'0 8%'}}/>

      {/* ── HOW IT WORKS ── */}
      <section id="how" style={{padding:'100px 24px',position:'relative',zIndex:2,background:'radial-gradient(ellipse 70% 50% at 50% 50%,rgba(245,158,11,.07) 0%,transparent 70%)'}}>
        <div style={{maxWidth:1100,margin:'0 auto'}}>
          <div style={{textAlign:'center',marginBottom:64}}>
            <div className="section-tag" style={{background:'rgba(251,191,36,.12)',color:'#fbbf24',border:'1px solid rgba(251,191,36,.3)'}}>How It Works</div>
            <h2 style={{fontFamily:"'Cinzel',serif",fontSize:'clamp(24px,4.5vw,52px)',fontWeight:700,marginBottom:14}}>Create Your Free Account &<br/>Start Your Adventure!</h2>
            <p style={{color:'rgba(255,255,255,.4)',fontSize:16}}>Three simple steps. That's all it takes to start playing.</p>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(280px,100%),1fr))',gap:24,position:'relative'}}>
            <div style={{position:'absolute',top:56,left:'16%',right:'16%',height:1,background:'linear-gradient(90deg,rgba(251,191,36,.5),rgba(245,158,11,.5),rgba(16,185,129,.5))',zIndex:0}}/>
            {STEPS.map((s,i)=>(
              <div key={i} style={{position:'relative',zIndex:1,background:'rgba(255,255,255,.03)',border:`1px solid ${s.color}33`,borderRadius:24,padding:'44px 28px 32px',textAlign:'center',transition:'all .3s'}}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=s.color+'99';e.currentTarget.style.transform='translateY(-8px)';e.currentTarget.style.boxShadow=`0 24px 60px rgba(0,0,0,.4),0 0 40px ${s.color}22`}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor=s.color+'33';e.currentTarget.style.transform='none';e.currentTarget.style.boxShadow='none'}}
              >
                <div style={{position:'absolute',top:-22,left:'50%',transform:'translateX(-50%)',width:44,height:44,borderRadius:'50%',background:`linear-gradient(135deg,${s.color},${s.color}bb)`,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Cinzel',serif",fontSize:16,fontWeight:700,color:'#fff',boxShadow:`0 0 20px ${s.color}55`}}>{i+1}</div>
                <div style={{width:72,height:72,borderRadius:20,margin:'0 auto 20px',background:`linear-gradient(135deg,${s.color}22,${s.color}0a)`,border:`1px solid ${s.color}44`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:32}}>{s.icon}</div>
                <div style={{fontSize:10,fontWeight:800,letterSpacing:'.12em',textTransform:'uppercase',color:s.color,marginBottom:8}}>{s.sub}</div>
                <h3 style={{fontFamily:"'Cinzel',serif",fontSize:20,fontWeight:700,marginBottom:14,color:'#fff'}}>{s.title}</h3>
                <p style={{color:'rgba(255,255,255,.45)',fontSize:14,lineHeight:1.8}}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ABOUT SECTION with real image ── */}
      <section style={{position:'relative',zIndex:2,overflow:'hidden',background:'linear-gradient(135deg,rgba(245,158,11,.1),rgba(245,158,11,.04))',borderTop:'1px solid rgba(251,191,36,.12)',borderBottom:'1px solid rgba(251,191,36,.12)'}}>
        <div className="about-grid" style={{maxWidth:1100,margin:'0 auto',padding:'90px 24px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:60,alignItems:'center'}}>
          {/* Left: image */}
          <div style={{position:'relative',borderRadius:24,overflow:'hidden',boxShadow:'0 32px 80px rgba(0,0,0,.7)',border:'1px solid rgba(251,191,36,.25)'}}>
            <img
              src="https://cdn.pixabay.com/photo/2023/07/25/10/09/wizard-8149654_1280.jpg"
              alt="Elite Gaming"
              style={{width:'100%',height:380,objectFit:'cover',objectPosition:'center',filter:'saturate(1.3) hue-rotate(200deg) brightness(.85)'}}
              onError={e=>{e.target.parentElement.style.background='linear-gradient(135deg,#1a0050,#0a0030)';e.target.style.display='none'}}
            />
            <div style={{position:'absolute',inset:0,background:'linear-gradient(to bottom,transparent 40%,rgba(7,9,15,.8) 100%)'}}/>
            {/* Stats overlay */}
            <div style={{position:'absolute',bottom:24,left:24,right:24,display:'flex',gap:24}}>
              <div style={{background:'rgba(0,0,0,.7)',backdropFilter:'blur(12px)',border:'1px solid rgba(251,191,36,.3)',borderRadius:14,padding:'14px 20px',flex:1,textAlign:'center'}}>
                <div style={{fontFamily:"'Cinzel Decorative',serif",fontSize:28,fontWeight:900,color:'#fbbf24',lineHeight:1}}>{GAMES.length}</div>
                <div style={{fontSize:10,color:'rgba(255,255,255,.45)',fontWeight:700,letterSpacing:'.1em',textTransform:'uppercase',marginTop:4}}>Game Rooms</div>
              </div>
            </div>
          </div>
          {/* Right: text */}
          <div>
            <div className="section-tag" style={{background:'rgba(251,191,36,.1)',color:'#fbbf24',border:'1px solid rgba(251,191,36,.3)'}}>About Casinoze Room</div>
            <h2 style={{fontFamily:"'Cinzel',serif",fontSize:'clamp(22px,3.5vw,42px)',fontWeight:700,marginBottom:20,lineHeight:1.3}}>Forging Legends in<br/>the Gaming Universe</h2>
            <p style={{color:'rgba(255,255,255,.5)',fontSize:15,lineHeight:1.9,marginBottom:16}}>
              <strong style={{color:'#fbbf24'}}>Casinoze Room</strong> gives you one account and one wallet for a whole range of game rooms. Add money, load credits into the game you choose, and manage everything from one dashboard.
            </p>
            <p style={{color:'rgba(255,255,255,.4)',fontSize:14,lineHeight:1.9,marginBottom:28}}>
              From classic fish games to modern sweepstakes rooms, everything is managed from your dashboard: deposits, game accounts, loads, redemptions and withdrawals.
            </p>
            <div style={{display:'flex',gap:16}}>
              <Link href="/auth/register" className="btn-gold" style={{fontSize:14,padding:'13px 32px'}}>🎲 Get Started</Link>
              <Link href="#games" className="btn-outline" style={{fontSize:14,padding:'12px 28px'}}>Browse Games</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA BANNER with background image ── */}
      <section style={{position:'relative',zIndex:2,overflow:'hidden',minHeight:320,display:'flex',alignItems:'center',justifyContent:'center'}}>
        {/* Background image */}
        <img
          src="https://cdn.pixabay.com/photo/2023/09/04/05/19/ai-generated-8232508_1280.jpg"
          alt=""
          style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',objectPosition:'center',opacity:.22,filter:'saturate(1.5) hue-rotate(220deg)'}}
          onError={e=>e.target.style.display='none'}
        />
        <div style={{position:'absolute',inset:0,background:'linear-gradient(to bottom,rgba(7,9,15,.7),rgba(7,9,15,.5),rgba(7,9,15,.7))'}}/>
        <div style={{position:'relative',zIndex:1,textAlign:'center',padding:'80px 24px',maxWidth:700}}>
          <h2 style={{fontFamily:"'Cinzel',serif",fontSize:'clamp(24px,4vw,50px)',fontWeight:700,marginBottom:16,lineHeight:1.3}}>
            Join Our Elite Community<br/>of Players & Achievers!
          </h2>
          <p style={{color:'rgba(255,255,255,.55)',fontSize:16,marginBottom:40,lineHeight:1.8}}>
            To create the ultimate game room experience, we've packed in features that keep every session thrilling and seamless.
          </p>
          <div style={{display:'flex',gap:14,justifyContent:'center',flexWrap:'wrap'}}>
            <Link href="/auth/register" className="btn-gold" style={{fontSize:16,padding:'17px 52px'}}>🎲 Play Game Now</Link>
            <Link href="#games" className="btn-outline" style={{fontSize:16,padding:'16px 44px'}}>Browse Games</Link>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS (only shown when SITE.reviews has real reviews) ── */}
      {TESTIMONIALS.length>0 && (
      <section id="reviews" style={{padding:'90px 24px',position:'relative',zIndex:2}}>
        <div style={{maxWidth:1100,margin:'0 auto'}}>
          <div style={{textAlign:'center',marginBottom:56}}>
            <div className="section-tag" style={{background:'rgba(245,158,11,.1)',color:'#f59e0b',border:'1px solid rgba(245,158,11,.3)'}}>★ Customer Feedback</div>
            <h2 style={{fontFamily:"'Cinzel',serif",fontSize:'clamp(24px,4vw,48px)',fontWeight:700,marginBottom:12}}>What Players Say</h2>
            <p style={{color:'rgba(255,255,255,.4)',fontSize:15}}>Feedback from our players.</p>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(240px,100%),1fr))',gap:20}}>
            {TESTIMONIALS.map((t,i)=><TestiCard key={i} t={t}/>)}
          </div>
        </div>
      </section>
      )}

      {/* ── CONTACT + FAQ ── */}
      <section id="faq" style={{padding:'80px 24px 100px',position:'relative',zIndex:2,borderTop:'1px solid rgba(255,255,255,.05)'}}>
        <div style={{maxWidth:1100,margin:'0 auto'}}>
          <div className="contact-grid" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:60}}>
            {/* Contact */}
            <div>
              <div className="section-tag" style={{background:'rgba(16,185,129,.1)',color:'#10b981',border:'1px solid rgba(16,185,129,.3)'}}>Contact Us</div>
              <h2 style={{fontFamily:"'Cinzel',serif",fontSize:'clamp(22px,3vw,38px)',fontWeight:700,marginBottom:12}}>Get in Touch</h2>
              <p style={{color:'rgba(255,255,255,.4)',fontSize:14,lineHeight:1.8,marginBottom:28}}>Have questions or need support? Our team is here anytime. Just send us a message.</p>
              <div style={{display:'flex',flexDirection:'column',gap:12}}>
                {[['First Name','text'],['Last Name','text'],['Email','email'],['Phone','tel']].map(([label,type])=>(
                  <input key={label} type={type} placeholder={label} style={{background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.12)',borderRadius:12,padding:'13px 18px',color:'#fff',fontFamily:"'Outfit',sans-serif",fontSize:14,outline:'none',transition:'border-color .2s'}} onFocus={e=>e.target.style.borderColor='rgba(251,191,36,.6)'} onBlur={e=>e.target.style.borderColor='rgba(255,255,255,.12)'}/>
                ))}
                <textarea placeholder="Your message..." rows={4} style={{background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.12)',borderRadius:12,padding:'13px 18px',color:'#fff',fontFamily:"'Outfit',sans-serif",fontSize:14,outline:'none',resize:'vertical',transition:'border-color .2s'}} onFocus={e=>e.target.style.borderColor='rgba(251,191,36,.6)'} onBlur={e=>e.target.style.borderColor='rgba(255,255,255,.12)'}/>
                <button className="btn-gold" style={{width:'100%',justifyContent:'center',padding:'14px',fontSize:15}}>Send Message</button>
              </div>
            </div>
            {/* FAQ */}
            <div>
              <div className="section-tag" style={{background:'rgba(251,191,36,.1)',color:'#fbbf24',border:'1px solid rgba(251,191,36,.3)'}}>FAQ</div>
              <h2 style={{fontFamily:"'Cinzel',serif",fontSize:'clamp(22px,3vw,38px)',fontWeight:700,marginBottom:12}}>Frequently Asked Questions</h2>
              <p style={{color:'rgba(255,255,255,.4)',fontSize:14,lineHeight:1.8,marginBottom:28}}>Everything you need to know about Casinoze Room.</p>
              {FAQS.map((f,i)=><FaqItem key={i} q={f.q} a={f.a}/>)}
            </div>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section style={{padding:'80px 24px',textAlign:'center',position:'relative',zIndex:2,background:'linear-gradient(180deg,transparent,rgba(245,158,11,.08),transparent)'}}>
        <h2 style={{fontFamily:"'Cinzel',serif",fontSize:'clamp(22px,4vw,46px)',fontWeight:700,marginBottom:16}}>
          Start Your Journey by Creating<br/>Your Free Account Today!
        </h2>
        <p style={{color:'rgba(255,255,255,.4)',fontSize:16,maxWidth:480,margin:'0 auto 36px',lineHeight:1.8}}>Create your free account and pick your game room.</p>
        <Link href="/auth/register" className="btn-gold" style={{fontSize:17,padding:'18px 64px'}}>🎰 Play Game Now</Link>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{borderTop:'1px solid rgba(255,255,255,.06)',padding:'44px 48px 28px',position:'relative',zIndex:2}}>
        <div style={{maxWidth:1100,margin:'0 auto'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:32,marginBottom:32}}>
            <div>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
                <Logo variant="full" height={52} />
              </div>
              <p style={{color:'rgba(255,255,255,.25)',fontSize:13,maxWidth:260,lineHeight:1.7}}>One wallet. {GAMES.length} game rooms.</p>
            </div>
            <div style={{display:'flex',gap:60}}>
              <div>
                <div style={{fontSize:11,fontWeight:800,letterSpacing:'.12em',color:'rgba(255,255,255,.3)',textTransform:'uppercase',marginBottom:16}}>Platform</div>
                {[['Games','#games'],['How It Works','#how'],['Register','/auth/register'],['Login','/auth/login']].map(([l,h])=>(<div key={l} style={{marginBottom:10}}><a href={h} style={{color:'rgba(255,255,255,.4)',fontSize:14,textDecoration:'none',fontWeight:500,transition:'color .2s'}} onMouseEnter={e=>e.target.style.color='#fbbf24'} onMouseLeave={e=>e.target.style.color='rgba(255,255,255,.4)'}>{l}</a></div>))}
              </div>
              <div>
                <div style={{fontSize:11,fontWeight:800,letterSpacing:'.12em',color:'rgba(255,255,255,.3)',textTransform:'uppercase',marginBottom:16}}>Legal</div>
                {[['Terms of Service','/terms'],['Privacy Policy','/privacy'],['FAQ','/faq'],['About','/about'],['Support','/dashboard/support']].map(([l,h])=>(<div key={l} style={{marginBottom:10}}><a href={h} style={{color:'rgba(255,255,255,.4)',fontSize:14,textDecoration:'none',fontWeight:500,transition:'color .2s'}} onMouseEnter={e=>e.target.style.color='#f59e0b'} onMouseLeave={e=>e.target.style.color='rgba(255,255,255,.4)'}>{l}</a></div>))}
              </div>
            </div>
          </div>
          <div style={{borderTop:'1px solid rgba(255,255,255,.06)',paddingTop:20,display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:12}}>
            <div style={{color:'rgba(255,255,255,.18)',fontSize:12}}>© {new Date().getFullYear()} Casinoze Room. All rights reserved.</div>
            <div style={{color:'rgba(255,255,255,.18)',fontSize:12}}>Play responsibly. 18+</div>
          </div>
        </div>
      </footer>
    </>
  )
}
