/**
 * Counter-Strike operatives.
 *
 * Unlike hero shooters, every CS player has the same kit: a rifle, a pistol,
 * a knife and up to four grenades. The "agent" record therefore only carries
 * cosmetics (voice tag, palette, model flavour) plus the shared grenade list —
 * no character specific powers, no ultimate economy.
 */

/** The four CS2 grenades, in the classic Q / E / C / X slots. */
const GRENADES = [
  {
    id: 'flash', key: 'Q', name: 'FLASHBANG', icon: '⚡',
    price: 200, charges: 1, cast: 'projectile', cooldown: 0,
    desc: 'Karşındakinin gözünü 3 saniyeye kadar kör eder. Duvara çarpıp patlar.',
  },
  {
    id: 'smoke', key: 'E', name: 'SMOKE', icon: '🌫️',
    price: 300, charges: 1, cast: 'projectile', cooldown: 0,
    desc: '18 saniyelik duman perdesi. Nişangâh çizgisini böler, botlar içinden geçemez.',
  },
  {
    id: 'firewall', key: 'C', name: 'MOLOTOV', icon: '🔥',
    price: 400, charges: 1, cast: 'projectile', cooldown: 0,
    desc: 'Yanarak yayılan yangın alanı. Bir köşeyi temizler, girişi kapatır.',
  },
  {
    id: 'shock', key: 'X', name: 'HE GRENADE', icon: '💥',
    price: 300, charges: 1, cast: 'projectile', cooldown: 0,
    desc: 'El bombası. Merkezde 65, kenarda daha az hasar; takım arkadaşını da yaralar.',
  },
];

const base = {
  role: 'OPERATÖR',
  abilities: GRENADES,
  stats: { aim: 80, movement: 80, utility: 70 },
  loadout: { primary: 'ak47', secondary: 'glock' },
};

export const AGENTS = {
  /* ---------------- Terrorists ---------------- */
  phoenix: {
    ...base,
    id: 'phoenix', name: 'PHOENIX', realName: 'Phoenix', country: 'TR', side: 'T',
    team: 'T', tagline: 'Önce gir, sonra sor.',
    colors: { primary: '#e2683c', secondary: '#ffc14a', dark: '#2a1710', fabric: '#b4552f' },
    desc: 'Elite Crew adına vuran operatör. Hızlı giriş, agresif angle alımı.',
    loadout: { primary: 'ak47', secondary: 'glock' },
  },
  veil: {
    ...base,
    id: 'veil', name: 'VEIL', realName: 'Veil', country: 'TR', side: 'T',
    team: 'T', tagline: 'Sesi değil, sonucu duyarlar.',
    colors: { primary: '#7a5ad8', secondary: '#c9a3ff', dark: '#171228', fabric: '#4b3a86' },
    desc: 'Sessiz girişler, temiz plant. T tarafında en soğukkanlı isim.',
    loadout: { primary: 'ak47', secondary: 'glock' },
  },

  /* ---------------- Counter-Terrorists ---------------- */
  pulse: {
    ...base,
    id: 'pulse', name: 'PULSE', realName: 'Pulse', country: 'TR', side: 'CT',
    team: 'CT', tagline: 'Geleni gör, geçeni durdur.',
    colors: { primary: '#3fc8e0', secondary: '#a8f0ff', dark: '#0d1c22', fabric: '#2b7286' },
    desc: 'SEAL Team 6 keskin nişancısı. Uzun koridorları kapatır.',
    loadout: { primary: 'm4a4', secondary: 'usp_s' },
  },
  oath: {
    ...base,
    id: 'oath', name: 'OATH', realName: 'Oath', country: 'TR', side: 'CT',
    team: 'CT', tagline: 'Burada kimse geçemez.',
    colors: { primary: '#8ce05a', secondary: '#d8ffb0', dark: '#101c0d', fabric: '#4b8438' },
    desc: 'SAS bombacısı. Bölgeyi tutar, kit ile 5 saniyede bomba çözer.',
    loadout: { primary: 'm4a4', secondary: 'usp_s' },
  },
};

export const AGENT_LIST = Object.values(AGENTS);

/** Operatives a given side can pick (T attackers, CT defenders). */
export function agentsForSide(side) {
  const list = AGENT_LIST.filter((a) => a.side === side);
  return list.length ? list : AGENT_LIST;
}

/** The grenade list every player carries — handy for the HUD + buy menu. */
export function grenadeList() {
  return GRENADES;
}

export function findGrenade(id) {
  return GRENADES.find((g) => g.id === id) || null;
}

/**
 * Minimal operator crest used by the agent cards and the HUD.
 * Kept as inline SVG so it renders before any texture loads.
 */
export function agentPortraitSVG(agentId, size = 96) {
  const a = AGENTS[agentId] || AGENT_LIST[0];
  const c = a.colors;
  const uid = `p-${a.id}-${Math.random().toString(36).slice(2, 7)}`;
  return `<svg viewBox="0 0 120 120" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <linearGradient id="${uid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${c.primary}" />
        <stop offset="1" stop-color="${c.dark}" />
      </linearGradient>
    </defs>
    <rect width="120" height="120" fill="${c.dark}" />
    <path d="M60 14 L104 40 L104 84 L60 108 L16 84 L16 40 Z" fill="url(#${uid})" opacity="0.9" />
    <path d="M40 52 L80 52 L80 60 L40 60 Z" fill="${c.secondary}" opacity="0.85" />
    <path d="M52 60 L68 60 L68 92 L52 92 Z" fill="${c.dark}" opacity="0.55" />
    <text x="60" y="36" text-anchor="middle" font-family="Arial, sans-serif" font-size="13"
      letter-spacing="2" fill="${c.secondary}">${a.side}</text>
  </svg>`;
}
