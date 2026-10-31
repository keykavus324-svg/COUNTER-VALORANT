/**
 * Agent roster. Each agent has four abilities (Q / E / C / X) that mirror the
 * familiar hero-shooter toolkit: utility, mobility, info and an ultimate.
 */

export const AGENTS = {
  blaze: {
    id: 'blaze',
    name: 'PHOENIX',
    realName: 'Phoenix',
    role: 'DUELİST',
    country: 'TR',
    tagline: 'Ateşle oynama.',
    artKey: 'phoenix',
    colors: { primary: '#ff5a3c', secondary: '#ffc14a', dark: '#3a1710', fabric: '#c0442c' },
    desc: 'Saldırının önündeki isim. Alevle koridor açar, hızla girer ve çıkar. Yakın dövüşte rakibine nefes aldırmaz.',
    stats: { dmg: 92, mob: 78, sup: 34 },
    abilities: [
      {
        id: 'firewall', key: 'Q', name: 'BLAZE', icon: '🔥', price: 250, charges: 1,
        desc: 'Baktığın noktaya yanan bir alan fırlatır. İçindeki düşmanlar yanar ve yavaşlar.',
        cast: 'projectile', cooldown: 0,
      },
      {
        id: 'dash', key: 'E', name: 'CURVEBALL', icon: '💨', price: 0, charges: 1,
        desc: 'Baktığın yöne doğru hızla atıl. Kısa süreliğine hızın artar.',
        cast: 'dash', cooldown: 22,
      },
      {
        id: 'flash', key: 'C', name: 'HOT HANDS', icon: '✨', price: 150, charges: 1,
        desc: 'Kör edici bir parlama fırlatır. Bakış açısı parlamaya yakınsa rakip kör olur.',
        cast: 'projectile', cooldown: 0, flash: true,
      },
      {
        id: 'inferno', key: 'X', name: 'RUN IT BACK', icon: '☄️', price: 0, charges: 1, ultCost: 6,
        desc: 'ULTİMATE — Etrafında dev bir ateş patlaması yaratır. Yakındaki tüm düşmanlar ağır hasar alır.',
        cast: 'self', cooldown: 0, ultimate: true,
      },
    ],
    loadout: { primary: 'vandal', secondary: 'ghost' },
  },

  veil: {
    id: 'veil',
    name: 'OMEN',
    realName: 'Omen',
    role: 'KONTROLCÜ',
    country: 'TR',
    tagline: 'Görmediğin şey seni öldürür.',
    artKey: 'omen',
    colors: { primary: '#4aa8ff', secondary: '#8f6bff', dark: '#101b33', fabric: '#2f4f7d' },
    desc: 'Görüş hattını yönetir. Dumanları ve duvarıyla düşmanın nişan açısını yok eder, takımına güvenli geçiş açar.',
    stats: { dmg: 52, mob: 55, sup: 94 },
    abilities: [
      {
        id: 'smoke', key: 'Q', name: 'DARK COVER', icon: '🌫️', price: 200, charges: 2,
        desc: 'Baktığın noktaya kalın bir duman bulutu bırakır. İçinden kimse göremez.',
        cast: 'projectile', cooldown: 0,
      },
      {
        id: 'veilwall', key: 'E', name: 'PARANOIA', icon: '🧱', price: 0, charges: 1,
        desc: 'Önüne görüş kesen bir enerji duvarı kurar. Mermileri de durdurur.',
        cast: 'wall', cooldown: 28,
      },
      {
        id: 'recon', key: 'C', name: 'SHROUDED STEP', icon: '📡', price: 150, charges: 1,
        desc: 'Kısa menzilli bir tarama atar; yakındaki düşmanları kısa süre işaretler.',
        cast: 'self', cooldown: 18,
      },
      {
        id: 'blackout', key: 'X', name: 'FROM THE SHADOWS', icon: '🌑', price: 0, charges: 1, ultCost: 6,
        desc: 'ULTİMATE — Haritanın büyük bir kısmını kaplayan dev duman duvarı. Düşmanın gözü kapanır.',
        cast: 'projectile', cooldown: 0, ultimate: true,
      },
    ],
    loadout: { primary: 'phantom', secondary: 'classic' },
  },

  pulse: {
    id: 'pulse',
    name: 'SOVA',
    realName: 'Sova',
    role: 'BAŞLATICI',
    country: 'TR',
    tagline: 'Nabzını duyuyorum.',
    artKey: 'sova',
    colors: { primary: '#30f3c8', secondary: '#5ad1ff', dark: '#0c2a28', fabric: '#20695e' },
    desc: 'Bilgi toplar ve bozar. Radar atışı ile düşmanın yerini açar, şok dalgası ile savunmayı kırar.',
    stats: { dmg: 66, mob: 62, sup: 80 },
    abilities: [
      {
        id: 'radar', key: 'Q', name: 'RECON BOLT', icon: '📶', price: 200, charges: 2,
        desc: 'Baktığın yöne radar dalgası yollar. Menzildeki düşmanlar 5 saniye duvarların ardından görünür.',
        cast: 'projectile', cooldown: 0,
      },
      {
        id: 'shock', key: 'E', name: 'SHOCK BOLT', icon: '⚡', price: 0, charges: 1,
        desc: 'Baktığın noktada patlar. Alandaki düşmanlar hasar alır ve ağırlaşır.',
        cast: 'projectile', cooldown: 15,
      },
      {
        id: 'stun', key: 'C', name: 'OWL DRONE', icon: '🌀', price: 150, charges: 1,
        desc: 'Yakın alandaki düşmanları sersemletir; nişan almaları zorlaşır.',
        cast: 'self', cooldown: 20,
      },
      {
        id: 'emp', key: 'X', name: "HUNTER'S FURY", icon: '💥', price: 0, charges: 1, ultCost: 6,
        desc: 'ULTİMATE — Tüm düşmanları işaretler ve yakındakileri ağır yavaşlatır.',
        cast: 'self', cooldown: 0, ultimate: true,
      },
    ],
    loadout: { primary: 'bulldog', secondary: 'sheriff' },
  },

  oath: {
    id: 'oath',
    name: 'SAGE',
    realName: 'Sage',
    role: 'NÖBETÇİ',
    country: 'TR',
    tagline: 'Kimse geride kalmaz.',
    artKey: 'sage',
    colors: { primary: '#f5c86b', secondary: '#ffe9b0', dark: '#241c0c', fabric: '#8a6a34' },
    desc: 'Takımı ayakta tutar. Onarım ve kalkan yetenekleriyle round\'u çevirir, kritik anda kutsal alan açar.',
    stats: { dmg: 44, mob: 50, sup: 100 },
    abilities: [
      {
        id: 'heal', key: 'Q', name: 'HEALING ORB', icon: '💚', price: 200, charges: 2,
        desc: 'Kendini veya nişan aldığın takım arkadaşını iyileştirir.',
        cast: 'heal', cooldown: 0,
      },
      {
        id: 'shield', key: 'E', name: 'BARRIER ORB', icon: '🛡️', price: 0, charges: 1,
        desc: 'Kendine 50 geçici kalkan verir. Kalkan kırılmadan hasar almazsın.',
        cast: 'self', cooldown: 24,
      },
      {
        id: 'barrier', key: 'C', name: 'SLOW ORB', icon: '🧱', price: 150, charges: 1,
        desc: 'Önüne kısa bir siper duvarı kurar. Mermileri durdurur.',
        cast: 'wall', cooldown: 26,
      },
      {
        id: 'sanctuary', key: 'X', name: 'RESURRECTION', icon: '🌟', price: 0, charges: 1, ultCost: 6,
        desc: 'ULTİMATE — Alandaki tüm takım arkadaşlarını tamamen iyileştirir ve kalkan verir.',
        cast: 'self', cooldown: 0, ultimate: true,
      },
    ],
    loadout: { primary: 'phantom', secondary: 'ghost' },
  },
};

export const AGENT_LIST = Object.values(AGENTS);
export const ULT_COST = 6;

export function agentAbilities(agentId) {
  return AGENTS[agentId].abilities;
}

/* ------------------------------------------------------------------ */
/* Procedural SVG portraits (used in the agent select screen + HUD).    */
/* Each agent gets a distinct flat-vector hero portrait.               */
/* ------------------------------------------------------------------ */

const gradientFor = (agent) => `
  <defs>
    <linearGradient id="bg-${agent.id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${agent.colors.dark}"/>
      <stop offset="1" stop-color="#0a1016"/>
    </linearGradient>
    <linearGradient id="rim-${agent.id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${agent.colors.primary}"/>
      <stop offset="1" stop-color="${agent.colors.secondary}"/>
    </linearGradient>
  </defs>
`;

const portraitArt = (agent) => {
  const p = agent.colors.primary;
  const s = agent.colors.secondary;
  const d = agent.colors.dark;
  const f = agent.colors.fabric;
  const base = `
    <path d="M100 448 L100 330 Q100 285 140 270 L260 270 Q300 285 300 330 L300 448 Z" fill="${f}"/>
    <path d="M200 270 L200 330 L160 300 Z" fill="${d}" opacity=".8"/>
    <rect x="150" y="205" width="100" height="80" rx="26" fill="#c9926f"/>
    <path d="M150 245 Q200 290 250 245 L250 285 L150 285 Z" fill="${p}" opacity=".25"/>
  `;
  const head = `
    <path d="M148 196 Q150 132 200 128 Q250 132 252 196 Q252 226 232 248 L168 248 Q148 226 148 196 Z" fill="#d8a37e"/>
    <path d="M148 196 Q150 132 200 128 Q250 132 252 196 Q236 168 200 166 Q166 166 148 196 Z" fill="#2a2320"/>
  `;
  switch (agent.id) {
    case 'blaze':
      return `${base}${head}
        <path d="M146 188 L170 148 L200 168 L232 142 L254 188 L240 176 Q222 190 200 176 Q178 192 160 176 Z" fill="#221a16"/>
        <path d="M168 176 L232 176 L226 196 Q200 208 174 196 Z" fill="#0d1014" opacity=".92"/>
        <rect x="176" y="182" width="48" height="9" rx="4" fill="${p}"/>
        <path d="M200 128 L212 96 L188 108 L200 74 L176 104 L200 128" fill="${s}" opacity=".9"/>
        <path d="M150 300 L134 240 L156 232 L172 292 Z" fill="${f}"/>
        <path d="M250 300 L266 240 L244 232 L228 292 Z" fill="${f}"/>
        <path d="M160 330 L240 330 L246 420 L204 448 L154 420 Z" fill="${d}" opacity=".55"/>
        <path d="M148 360 Q200 386 252 360" stroke="${p}" stroke-width="7" fill="none" opacity=".9"/>
        <circle cx="200" cy="386" r="13" fill="${p}"/>
        <circle cx="200" cy="386" r="6" fill="${s}"/>`;
    case 'veil':
      return `${base}${head}
        <path d="M142 200 Q146 126 200 122 Q254 126 258 200 L244 236 L228 200 L210 232 L194 200 L176 230 L164 198 Z" fill="${d}"/>
        <path d="M166 182 Q200 172 234 182 L232 202 Q200 214 168 202 Z" fill="#0a1622"/>
        <path d="M170 190 Q200 198 230 190" stroke="${p}" stroke-width="5" fill="none"/>
        <path d="M156 300 Q200 340 244 300 L252 420 L200 452 L148 420 Z" fill="${f}" opacity=".9"/>
        <path d="M176 280 L224 280 L214 340 L186 340 Z" fill="${p}" opacity=".22"/>
        <path d="M200 300 L200 430" stroke="${p}" stroke-width="2" opacity=".5"/>
        <circle cx="200" cy="352" r="10" fill="${p}"/>
        <path d="M262 220 Q300 260 280 330 Q266 300 258 264 Z" fill="${f}" opacity=".9"/>
        <path d="M138 220 Q100 260 120 330 Q134 300 142 264 Z" fill="${f}" opacity=".9"/>`;
    case 'pulse':
      return `${base}${head}
        <path d="M148 190 Q152 140 200 136 Q248 140 252 190 L246 176 Q200 156 154 176 Z" fill="#1d2a2a"/>
        <rect x="158" y="182" width="84" height="26" rx="12" fill="#0b1416"/>
        <circle cx="180" cy="195" r="7" fill="${p}"/><circle cx="220" cy="195" r="7" fill="${p}"/>
        <circle cx="180" cy="195" r="15" fill="none" stroke="${p}" stroke-width="2" opacity=".55"/>
        <circle cx="220" cy="195" r="15" fill="none" stroke="${p}" stroke-width="2" opacity=".55"/>
        <path d="M260 250 L286 214 L270 258 L296 244 L264 300 L272 264 Z" fill="${s}" opacity=".8"/>
        <path d="M160 300 L240 300 L232 380 L200 400 L168 380 Z" fill="${d}" opacity=".5"/>
        <path d="M176 324 L224 324" stroke="${p}" stroke-width="4"/>
        <circle cx="200" cy="352" r="16" fill="none" stroke="${p}" stroke-width="3"/>
        <circle cx="200" cy="352" r="5" fill="${p}"/>
        <path d="M150 290 L136 340" stroke="${f}" stroke-width="16" stroke-linecap="round"/>
        <path d="M250 290 L266 340" stroke="${f}" stroke-width="16" stroke-linecap="round"/>`;
    case 'oath':
    default:
      return `${base}${head}
        <path d="M144 192 Q148 126 200 122 Q252 126 256 192 L248 210 L236 184 L224 204 L200 176 L176 204 L164 184 L152 210 Z" fill="${s}" opacity=".95"/>
        <path d="M148 196 Q150 138 200 132 Q250 138 252 196 L246 182 Q200 158 154 182 Z" fill="${f}"/>
        <path d="M168 186 Q200 178 232 186 L228 200 Q200 210 172 200 Z" fill="#12100a"/>
        <path d="M176 300 L224 300 L236 400 L200 430 L164 400 Z" fill="#f3e6c8" opacity=".92"/>
        <path d="M200 300 L200 424" stroke="${d}" stroke-width="3" opacity=".6"/>
        <path d="M200 316 L212 344 L242 348 L220 368 L226 398 L200 382 L174 398 L180 368 L158 348 L188 344 Z" fill="${p}"/>
        <path d="M136 300 Q112 260 128 222 Q140 260 152 286 Z" fill="${s}" opacity=".7"/>
        <path d="M264 300 Q288 260 272 222 Q260 260 248 286 Z" fill="${s}" opacity=".7"/>`;
  }
};

export function agentPortraitSVG(agentId, { width = 320, height = 448, name = true } = {}) {
  const agent = AGENTS[agentId];
  const art = portraitArt(agent);
  const label = name
    ? `<text x="24" y="${height - 26}" font-family="Impact, Arial Black, sans-serif" font-size="34" fill="#ece8de" letter-spacing="2">${agent.name}</text>
       <text x="26" y="${height - 48}" font-family="Arial Narrow, sans-serif" font-size="12" fill="${agent.colors.primary}" letter-spacing="4">${agent.role}</text>`
    : '';
  return `data:image/svg+xml;utf8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 400 448">
      ${gradientFor(agent)}
      <rect width="400" height="448" fill="url(#bg-${agent.id})"/>
      <g opacity=".22">
        <path d="M0 400 L400 260 L400 448 L0 448 Z" fill="${agent.colors.primary}"/>
        <path d="M40 0 L120 0 L20 448 L-40 448 Z" fill="#ffffff" opacity=".06"/>
      </g>
      <g>${art}</g>
      <rect x="0" y="0" width="400" height="448" fill="none" stroke="${agent.colors.primary}" stroke-opacity=".35" stroke-width="3"/>
      ${label}
    </svg>
  `)}`;
}
