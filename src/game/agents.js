/**
 * Operatives (CS style: no hero abilities — everyone buys the same utility).
 *
 * Q  Flashbang      E  Smoke grenade
 * C  Molotov        X  HE grenade
 *
 * The utility data keeps the shape the game already understands (charge counts,
 * buy prices and projectile behaviour), it is simply the Counter-Strike kit.
 */

const GRENADES = [
  {
    id: 'flash', key: 'Q', name: 'FLASHBANG', icon: '⚡', price: 200, charges: 2,
    desc: 'Bakanı kör eder. Duvar arkasına atıp gir — kendi takımını da kör edebilir.',
    cast: 'projectile', cooldown: 0, flash: true,
  },
  {
    id: 'smoke', key: 'E', name: 'SMOKE GRENADE', icon: '🌫️', price: 300, charges: 1,
    desc: 'Görüş hattını kapatır. Site girişlerini ve AWP açılarını böler.',
    cast: 'projectile', cooldown: 0,
  },
  {
    id: 'firewall', key: 'C', name: 'MOLOTOV', icon: '🔥', price: 400, charges: 1,
    desc: 'Yanan alan bırakır. Sıkıştığın köşeyi temizler, geçişi zorlaştırır.',
    cast: 'projectile', cooldown: 0,
  },
  {
    id: 'shock', key: 'X', name: 'HE GRENADE', icon: '💥', price: 300, charges: 1,
    desc: 'Patlayıcı. 65 hasar verir; sığınağın arkasındaki rakibi zorlar.',
    cast: 'projectile', cooldown: 0,
  },
];

const base = {
  role: 'OPERATÖR',
  abilities: GRENADES,
  stats: { dmg: 80, mob: 80, sup: 60 },
};

export const AGENTS = {
  phoenix: {
    ...base,
    id: 'phoenix', name: 'PHOENIX', realName: 'Phoenix', country: 'TR',
    team: 'T', tagline: 'Önce gir, sonra sor.',
    colors: { primary: '#e2683c', secondary: '#ffc14a', dark: '#2a1710', fabric: '#b4552f' },
    desc: 'Elite Crew adına vuran operatör. Hızlı giriş, agresif angle alımı.',
    loadout: { primary: 'ak47', secondary: 'glock' },
  },
  veil: {
    ...base,
    id: 'veil', name: 'VEIL', realName: 'Veil', country: 'TR',
    team: 'T', tagline: 'Sesi değil, sonucu duyarlar.',
    colors: { primary: '#7a5ad8', secondary: '#c9a3ff', dark: '#171228', fabric: '#4b3a86' },
    desc: 'Sessiz girişler, temiz plant. T tarafında en soğukkanlı isim.',
    loadout: { primary: 'ak47', secondary: 'glock' },
  },
  pulse: {
    ...base,
    id: 'pulse', name: 'PULSE', realName: 'Pulse', country: 'TR',
    team: 'CT', tagline: 'Geleni gör, geçeni durdur.',
    colors: { primary: '#2f7fd8', secondary: '#6fd8ff', dark: '#0f1c2a', fabric: '#2a5d94' },
    desc: 'SEAL Team 6. Açıyı tutar, bilgiyi paylaşır, siteyi kapatır.',
    loadout: { primary: 'm4a4', secondary: 'usp_s' },
  },
  oath: {
    ...base,
    id: 'oath', name: 'OATH', realName: 'Oath', country: 'TR',
    team: 'CT', tagline: 'Retake onun işi.',
    colors: { primary: '#33a88a', secondary: '#8ce8cf', dark: '#0e211c', fabric: '#277a63' },
    desc: 'SAS. Bombayı çözer, retake’te ilk giren olur.',
    loadout: { primary: 'm4a4', secondary: 'usp_s' },
  },
};

export const AGENT_LIST = Object.values(AGENTS);

export function agentTeam(id) {
  return AGENTS[id]?.team || 'T';
}

/** Small procedural portrait cue: initials + team colour (no external art). */
let portraitUid = 0;
export function agentPortraitSVG(agentId, size = 96) {
  const a = AGENTS[agentId] || AGENT_LIST[0];
  const initials = a.name.slice(0, 2).toUpperCase();
  const uid = `p${++portraitUid}`;
  return `<svg viewBox="0 0 120 160" width="${size}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs><linearGradient id="g-${uid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${a.colors.primary}" stop-opacity="0.9"/>
      <stop offset="1" stop-color="${a.colors.dark}" stop-opacity="1"/>
    </linearGradient></defs>
    <rect width="120" height="160" fill="url(#g-${uid})"/>
    <path d="M18 160 L28 96 L60 78 L92 96 L102 160 Z" fill="${a.colors.fabric}" opacity="0.55"/>
    <circle cx="60" cy="54" r="26" fill="${a.colors.secondary}" opacity="0.22"/>
    <circle cx="60" cy="54" r="19" fill="none" stroke="${a.colors.secondary}" stroke-width="2" opacity="0.7"/>
    <text x="60" y="62" text-anchor="middle" font-family="Arial, sans-serif" font-size="20"
      font-weight="800" fill="#eef3f6" letter-spacing="1">${initials}</text>
    <text x="60" y="140" text-anchor="middle" font-family="Arial, sans-serif" font-size="12"
      font-weight="700" fill="${a.colors.secondary}" letter-spacing="3">${a.team}</text>
  </svg>`;
}
