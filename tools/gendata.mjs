/**
 * Data generator.
 *
 * The game keeps its hand-written systems small and readable; the long, boring,
 * highly repetitive tables (per weapon ballistics, per weapon spray patterns,
 * per map callout zones) are generated here from the live gameplay data so the
 * numbers can never drift apart from the weapons they describe.
 *
 *   node tools/gendata.mjs
 *
 * Emits:
 *   src/data/ballistics.js      per weapon damage model + inaccuracy buckets
 *   src/data/callouts.js        per map named areas for the HUD / radar
 */
import fs from 'node:fs';
import path from 'node:path';
import { WEAPONS, BUY_ORDER } from '../src/game/weapons.js';
import { WEAPON_SKINS } from '../src/game/csgoAssets.js';
import { MAPS } from '../src/world/mapLayout.js';

const ROOT = path.resolve(import.meta.dirname, '..');

/* ------------------------------------------------------------------ */
/* helpers                                                            */
/* ------------------------------------------------------------------ */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const round = (v, p = 3) => Number(v.toFixed(p));

function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** deterministic 0..1 noise from a seed string */
function noise(seed, i) {
  const h = hash(`${seed}:${i}`);
  return ((h % 10000) / 10000);
}

/* ------------------------------------------------------------------ */
/* ballistics                                                         */
/* ------------------------------------------------------------------ */
const CALIBERS = {
  knife: 'MELEE',
  glock: '9x19mm',
  usp_s: '.45 ACP',
  p250: '.40 S&W',
  deagle: '.50 AE',
  mac10: '.45 ACP',
  mp9: '9x19mm',
  ump45: '.45 ACP',
  mp7: '4.6x30mm',
  nova: '12 Gauge',
  xm1014: '12 Gauge',
  galil: '5.56x45mm',
  famas: '5.56x45mm',
  ak47: '7.62x39mm',
  m4a4: '5.56x45mm',
  aug: '5.56x45mm',
  sg553: '5.56x45mm',
  ssg08: '.308 Win',
  awp: '.338 Lapua',
  m249: '5.56x45mm',
};

/** armour penetration of the round, 0..1 like CS (1 = ignores kevlar) */
const PENETRATION = {
  knife: 0.85,
  glock: 0.47,
  usp_s: 0.5,
  p250: 0.64,
  deagle: 0.93,
  mac10: 0.575,
  mp9: 0.6,
  ump45: 0.65,
  mp7: 0.62,
  nova: 0.45,
  xm1014: 0.45,
  galil: 0.775,
  famas: 0.7,
  ak47: 0.775,
  m4a4: 0.7,
  aug: 0.9,
  sg553: 0.7,
  ssg08: 0.85,
  awp: 0.97,
  m249: 0.8,
};

const HEADSHOT = { knife: 1.0 };
const LEG_MULT = 0.78;
const STOMACH_MULT = 1.25;
const ARM_MULT = 0.86;

/** How much a weapon moves while you move. Bigger = punish. */
function inaccuracyProfile(w) {
  const heavy = ['KESKİN NİŞANCI', 'MİNİGUN'].includes(w.type);
  const shotgun = w.type === 'AV TÜFEĞİ';
  const smg = w.type === 'HAFİF MAKİNELİ';
  const pistol = w.type === 'TABANCA';
  const base = w.scope ? 0.18 : pistol ? 0.9 : smg ? 1.05 : heavy ? 1.5 : 0.95;
  return {
    stand: round(base * 0.24),
    crouch: round(base * 0.15),
    walk: round(base * 0.62),
    run: round(base * 1.15),
    air: round(base * 2.35),
    jump: round(base * 2.9),
    ladder: round(base * 1.7),
    shotgunSpread: shotgun ? w.spread : 0,
    recoveryMs: Math.round(220 + w.recoil * 130),
    firstShotDelay: round(0.06 + w.recoil * 0.012),
  };
}

/** damage over distance, sampled so the runtime can just index it */
function falloffCurve(w) {
  const maxRange = Math.max(20, w.range);
  const points = 9;
  const out = [];
  for (let i = 0; i < points; i++) {
    const m = round((maxRange / (points - 1)) * i, 1);
    let mult;
    if (w.type === 'AV TÜFEĞİ') {
      // shotguns fall off hard but never below 25 %
      mult = clamp(1 - (m / maxRange) * 0.85, 0.25, 1);
    } else if (w.type === 'MELEE') {
      mult = 1;
    } else {
      const start = maxRange * 0.3;
      mult = clamp(1 - Math.max(0, m - start) / (maxRange * 1.6), 0.42, 1);
    }
    out.push({ m, mult: round(mult) });
  }
  return out;
}

/** 30 tick spray table: deterministic per weapon, derived from the family curve */
function sprayTable(w, family) {
  const seed = `${w.id}:${family}`;
  const scale = w.scope ? 1.35 : w.type === 'TABANCA' ? 0.42 : 1;
  const out = [];
  let drift = 0;
  for (let i = 0; i < 30; i++) {
    const t = i / 29;
    const climb = family === 'sniper' ? (i === 0 ? 0 : 2.3) : Math.min(3.1, 0.55 + t * 3.1);
    drift += (noise(seed, i) - 0.5) * 0.55;
    const wave = Math.sin(i * 0.42 + hash(seed) % 7) * 0.6;
    out.push([round((drift + wave) * scale * 0.55), round(climb * scale)]);
  }
  return out;
}

function familyOf(w) {
  if (w.scope) return 'sniper';
  if (w.type === 'TABANCA') return 'pistol';
  if (w.type === 'HAFİF MAKİNELİ') return 'smg';
  if (w.type === 'AV TÜFEĞİ') return 'shotgun';
  if (w.type === 'MİNİGUN') return 'heavy';
  if (w.type === 'MELEE') return 'melee';
  return w.id === 'm4a4' || w.id === 'famas' || w.id === 'aug' ? 'm4' : 'rifle';
}

function buildBallistics() {
  const lines = [];
  lines.push('/**');
  lines.push(' * Per weapon damage model — GENERATED by tools/gendata.mjs, do not edit.');
  lines.push(' *');
  lines.push(' * Every number is derived from the weapon catalogue (damage, rpm, spread,');
  lines.push(' * range) so balance changes only ever happen in one place.');
  lines.push(' */');
  lines.push('');
  lines.push('export const BALLISTICS = {');

  const ids = Object.keys(WEAPONS);
  for (const id of ids) {
    const w = WEAPONS[id];
    const family = familyOf(w);
    const falloff = falloffCurve(w);
    const inacc = inaccuracyProfile(w);
    const spray = sprayTable(w, family);
    lines.push(`  ${id}: {`);
    lines.push(`    id: '${id}',`);
    lines.push(`    name: '${w.name}',`);
    lines.push(`    family: '${family}',`);
    lines.push(`    caliber: '${CALIBERS[id] || 'unknown'}',`);
    lines.push(`    penetration: ${PENETRATION[id] ?? 0.5},`);
    lines.push(`    baseDamage: ${w.damage},`);
    lines.push(`    pellets: ${w.pellets || 1},`);
    lines.push(`    rpm: ${w.rpm},`);
    lines.push(`    magazine: ${w.mag},`);
    lines.push(`    maxRange: ${w.range},`);
    lines.push('    hitbox: {');
    lines.push(`      head: ${w.headMult},`);
    lines.push('      chest: 1,');
    lines.push(`      stomach: ${STOMACH_MULT},`);
    lines.push(`      arm: ${ARM_MULT},`);
    lines.push(`      leg: ${LEG_MULT},`);
    lines.push('    },');
    lines.push('    falloff: [');
    for (const p of falloff) {
      lines.push(`      { m: ${p.m}, mult: ${p.mult} },`);
    }
    lines.push('    ],');
    lines.push('    inaccuracy: {');
    for (const [k, v] of Object.entries(inacc)) {
      lines.push(`      ${k}: ${v},`);
    }
    lines.push('    },');
    lines.push('    spray: [');
    for (const [x, y] of spray) {
      lines.push(`      [${x}, ${y}],`);
    }
    lines.push('    ],');
    lines.push('  },');
  }
  lines.push('};');
  lines.push('');

  // ---------------- runtime helpers ----------------
  lines.push(`/**
 * Damage multiplier for a shot that travelled \`metres\`.
 * Linear interpolation between the sampled points, so a 54 m AK shot reads
 * exactly like a counter-strike long-range tap.
 */
export function falloffAt(weaponId, metres) {
  const b = BALLISTICS[weaponId];
  if (!b) return 1;
  const curve = b.falloff;
  if (metres <= curve[0].m) return curve[0].mult;
  for (let i = 1; i < curve.length; i++) {
    if (metres <= curve[i].m) {
      const a = curve[i - 1];
      const c = curve[i];
      const t = (metres - a.m) / Math.max(0.001, c.m - a.m);
      return a.mult + (c.mult - a.mult) * t;
    }
  }
  return curve[curve.length - 1].mult;
}

/** Hitbox multiplier (head / chest / stomach / arm / leg). */
export function hitboxAt(weaponId, zone) {
  const b = BALLISTICS[weaponId];
  if (!b) return 1;
  return b.hitbox[zone] ?? 1;
}

/** Extra cone angle (degrees) for the current movement state. */
export function inaccuracyAt(weaponId, state = 'stand') {
  const b = BALLISTICS[weaponId];
  if (!b) return 0;
  return b.inaccuracy[state] ?? b.inaccuracy.stand;
}

/** Armour adjusted damage: kevlar eats a share of the round. */
export function armorAdjusted(weaponId, damage, hasArmor) {
  if (!hasArmor) return damage;
  const b = BALLISTICS[weaponId];
  const pen = b ? b.penetration : 0.5;
  return damage * (1 - (1 - pen) * 0.5);
}

/** Number of rounds needed to kill a 100 hp target at a given distance. */
export function shotsToKill(weaponId, metres = 10, zone = 'chest') {
  const b = BALLISTICS[weaponId];
  if (!b) return Infinity;
  const dmg = b.baseDamage * (b.hitbox[zone] ?? 1) * falloffAt(weaponId, metres);
  return Math.max(1, Math.ceil(100 / Math.max(0.1, dmg)));
}

/** Suggested buy tier for the economy HUD. */
export function weaponTier(weaponId) {
  const w = WEAPONS[weaponId];
  if (!w) return 'none';
  if (w.price >= 4000) return 'awp';
  if (w.price >= 2500) return 'full';
  if (w.price >= 1500) return 'force';
  if (w.price >= 900) return 'eco+';
  if (w.price > 0) return 'eco';
  return 'free';
}
`);

  // one helper per weapon so call sites never do string lookups in a hot loop
  lines.push('');
  lines.push('/* Fast per weapon accessors (generated). */');
  for (const id of ids) {
    const safe = id.replace(/[^a-z0-9_]/gi, '_');
    lines.push(`export const ${safe}Ballistics = () => BALLISTICS.${id};`);
  }
  lines.push('');
  return lines.join('\n');
}

/* ------------------------------------------------------------------ */
/* callouts                                                           */
/* ------------------------------------------------------------------ */
const AREA_NAMES = [
  'A SITE', 'B SITE', 'MID', 'T SPAWN', 'CT SPAWN',
  'A SHORT', 'A LONG', 'A RAMP', 'B TUNNEL', 'B PLAT',
  'MID DOORS', 'MID WINDOW', 'CONNECTOR', 'PIT', 'CATHWALK',
  'T RAMP', 'CT RAMP', 'B CONN', 'A CONN', 'OUTSIDE',
];

function buildCallouts() {
  const lines = [];
  lines.push('/**');
  lines.push(' * Named map areas ("callouts") — GENERATED by tools/gendata.mjs.');
  lines.push(' *');
  lines.push(' * Each map is split into a coarse grid; every walkable cell gets the name of');
  lines.push(' * the closest landmark so the HUD can tell the player where they are, the');
  lines.push(' * radar can label zones and bots can talk about positions.');
  lines.push(' */');
  lines.push('');
  lines.push('export const CALLOUTS = {');

  for (const map of MAPS) {
    const b = map.bounds;
    const cols = 10;
    const rows = 10;
    const cw = (b.maxX - b.minX) / cols;
    const ch = (b.maxZ - b.minZ) / rows;
    lines.push(`  ${map.id}: {`);
    lines.push(`    name: '${map.name}',`);
    lines.push('    zones: [');
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x0 = b.minX + c * cw;
        const z0 = b.minZ + r * ch;
        const cx = x0 + cw / 2;
        const cz = z0 + ch / 2;
        // pick the closest landmark: sites, then spawns, then generic names
        const cands = [
          { name: 'A SITE', x: map.sites.A.center.x, z: map.sites.A.center.z, d: 0 },
          { name: 'B SITE', x: map.sites.B.center.x, z: map.sites.B.center.z, d: 0 },
          { name: 'T SPAWN', x: map.spawns.attacker[0].x, z: map.spawns.attacker[0].z, d: 0 },
          { name: 'CT SPAWN', x: map.spawns.defender[0].x, z: map.spawns.defender[0].z, d: 0 },
        ];
        for (const cand of cands) cand.d = Math.hypot(cand.x - cx, cand.z - cz);
        cands.sort((p1, p2) => p1.d - p2.d);
        const nearest = cands[0];
        const mid = { name: 'MID', x: (b.minX + b.maxX) / 2, z: (b.minZ + b.maxZ) / 2, d: 0 };
        mid.d = Math.hypot(mid.x - cx, mid.z - cz);
        const name = mid.d < nearest.d ? 'MID' : nearest.name;
        const extra = AREA_NAMES[(hash(`${map.id}:${r}:${c}`) % AREA_NAMES.length)];
        const isEdge = r === 0 || r === rows - 1 || c === 0 || c === cols - 1;
        const label = name === 'MID' && !isEdge ? extra : name;
        lines.push(`      { x0: ${round(x0, 1)}, z0: ${round(z0, 1)}, x1: ${round(x0 + cw, 1)}, z1: ${round(z0 + ch, 1)}, name: '${label}' },`);
      }
    }
    lines.push('    ],');
    lines.push('  },');
  }
  lines.push('};');
  lines.push('');
  lines.push(`/** Callout name for a world position, or null when outside the map. */
export function calloutAt(mapId, x, z) {
  const map = CALLOUTS[mapId];
  if (!map) return null;
  for (const zone of map.zones) {
    if (x >= zone.x0 && x <= zone.x1 && z >= zone.z0 && z <= zone.z1) return zone.name;
  }
  return null;
}

/** All zones of one map (radar labels, bot chatter). */
export function zonesOf(mapId) {
  return CALLOUTS[mapId]?.zones || [];
}

/** Look up a zone by name — used when a bot announces "going B SITE". */
export function zoneByName(mapId, name) {
  return zonesOf(mapId).find((z) => z.name === name) || null;
}
`);
  return lines.join('\n');
}


/* ------------------------------------------------------------------ */
/* skin recipes                                                       */
/* ------------------------------------------------------------------ */
const RARITY_TINT = {
  Consumer: '#b0c3d9',
  'Industrial Grade': '#5e98d9',
  'Mil-Spec Grade': '#4b69ff',
  Restricted: '#8847ff',
  Classified: '#d32ce6',
  Covert: '#eb4b4b',
  Contraband: '#e4ae39',
  '★': '#000000',
};

const MOTIFS = ['hex', 'racing', 'flame', 'glitch', 'camo', 'circuit', 'marble', 'wave', 'scatter', 'grid'];

const TRIMS = ['double', 'single', 'none', 'angled', 'dots'];

function hslShift(hex, dh, ds, dl) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return hex || '#888888';
  const r = parseInt(m[1].slice(0, 2), 16) / 255;
  const g = parseInt(m[1].slice(2, 4), 16) / 255;
  const b = parseInt(m[1].slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  const l = (max + min) / 2;
  const sat = max === min ? 0 : (l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min));
  if (max !== min) {
    if (max === r) h = ((g - b) / (max - min) + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / (max - min) + 2) / 6;
    else h = ((r - g) / (max - min) + 4) / 6;
  }
  h = (h + dh / 360 + 1) % 1;
  const s2 = clamp(sat + ds, 0, 1);
  const l2 = clamp(l + dl, 0.04, 0.96);
  const hue2rgb = (p, q, t) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  let rr; let gg; let bb;
  if (s2 === 0) { rr = l2; gg = l2; bb = l2; } else {
    const q = l2 < 0.5 ? l2 * (1 + s2) : l2 + s2 - l2 * s2;
    const p = 2 * l2 - q;
    rr = hue2rgb(p, q, h + 1 / 3);
    gg = hue2rgb(p, q, h);
    bb = hue2rgb(p, q, h - 1 / 3);
  }
  const toHex = (v) => Math.round(clamp(v, 0, 1) * 255).toString(16).padStart(2, '0');
  return `#${toHex(rr)}${toHex(gg)}${toHex(bb)}`;
}

function buildSkinRecipes() {
  const lines = [];
  lines.push('/**');
  lines.push(' * Authored paint recipes for every Counter-Strike finish — GENERATED by');
  lines.push(' * tools/gendata.mjs. Each entry drives the procedural painter in skins.js');
  lines.push(' * (palette, motif, trim style, emissive wear and a deterministic float), so');
  lines.push(' * all 115 finishes read as distinct weapons even with no network at all.');
  lines.push(' */');
  lines.push('');
  lines.push('export const SKIN_RECIPES = {');

  let n = 0;
  for (const [weaponId, list] of Object.entries(WEAPON_SKINS)) {
    for (const skin of list) {
      n++;
      const seed = hash(`${weaponId}:${skin.full || skin.name}`);
      const rarity = skin.rarity || 'Consumer';
      const base = RARITY_TINT[rarity] || '#b0c3d9';
      const hue = ((seed % 61) - 30);
      const body = hslShift(base, hue, 0.05, -0.30 + ((seed >> 3) % 11) / 90);
      const accent = hslShift(base, hue + 18, 0.18, 0.06);
      const trim = hslShift(base, hue - 12, -0.12, 0.30);
      const motif = MOTIFS[seed % MOTIFS.length];
      const trimStyle = TRIMS[(seed >> 5) % TRIMS.length];
      const float = round(0.01 + (((seed % 9973) / 9973) ** 0.8) * 0.86, 4);
      lines.push(`  ${JSON.stringify(skin.id)}: {`);
      lines.push(`    weapon: '${weaponId}',`);
      lines.push(`    name: ${JSON.stringify(skin.full || skin.name)},`);
      lines.push(`    rarity: ${JSON.stringify(rarity)},`);
      lines.push(`    body: '${body}',`);
      lines.push(`    accent: '${accent}',`);
      lines.push(`    trim: '${trim}',`);
      lines.push(`    motif: '${motif}',`);
      lines.push(`    trimStyle: '${trimStyle}',`);
      lines.push(`    emissive: ${round(0.05 + (seed % 13) / 100, 3)},`);
      lines.push(`    metalness: ${round(0.25 + (seed % 40) / 100, 3)},`);
      lines.push(`    roughness: ${round(0.28 + (seed % 35) / 100, 3)},`);
      lines.push(`    wear: ${float},`);
      lines.push(`    seed: ${seed},`);
      lines.push('  },');
    }
  }
  lines.push('};');
  lines.push('');
  lines.push(`export const SKIN_RECIPE_COUNT = ${n};`);
  lines.push('');
  lines.push(`/** Recipe for a finish, or null when it is not a known CS skin. */
export function skinRecipe(skinId) {
  return SKIN_RECIPES[skinId] || null;
}

/** Recipe for the skin currently equipped on a weapon. */
export function recipeForWeapon(weaponId, skinMap) {
  const id = skinMap?.[weaponId];
  if (!id) return null;
  return SKIN_RECIPES[id] || null;
}

/** All recipes of one weapon. */
export function recipesOf(weaponId) {
  return Object.values(SKIN_RECIPES).filter((r) => r.weapon === weaponId);
}

/** Paint recipe for a rarity colour, used by unskinned previews. */
export function rarityRecipe(rarity) {
  const base = RARITY_TINT[rarity] || '#b0c3d9';
  return {
    body: hslShift(base, 0, 0.02, -0.28),
    accent: base,
    trim: hslShift(base, 0, -0.2, 0.3),
  };
}
`);
  return lines.join('\n');
}

/* ------------------------------------------------------------------ */
/* spray library: tap / burst / full spray per weapon                  */
/* ------------------------------------------------------------------ */
function buildSprayLibrary() {
  const lines = [];
  lines.push('/**');
  lines.push(' * Spray control tables — GENERATED by tools/gendata.mjs.');
  lines.push(' *');
  lines.push(' * CS sprays are learned patterns, not random recoil. Every weapon ships three');
  lines.push(' * of them: a tap pattern (first 4 bullets), a burst pattern (first 12) and the');
  lines.push(' * full 30 round dump. Values are degrees of camera kick.');
  lines.push(' */');
  lines.push('');
  lines.push('export const SPRAY_LIBRARY = {');

  for (const id of Object.keys(WEAPONS)) {
    const w = WEAPONS[id];
    const family = familyOf(w);
    const scale = w.scope ? 1.3 : w.type === 'TABANCA' ? 0.45 : 1;
    lines.push(`  ${id}: {`);
    for (const mode of ['tap', 'burst', 'spray']) {
      const count = mode === 'tap' ? 4 : mode === 'burst' ? 12 : 30;
      lines.push(`    ${mode}: [`);
      for (let i = 0; i < count; i++) {
        const t = i / Math.max(1, count - 1);
        const climb = family === 'sniper' ? (i === 0 ? 0 : 2.2) : Math.min(3.0, 0.5 + t * 3.0);
        const jitter = (noise(`${id}:${mode}`, i) - 0.5) * 0.35;
        const wave = Math.sin(i * 0.5 + (hash(id) % 9)) * (mode === 'tap' ? 0.12 : 0.55);
        lines.push(`      [${round((wave + jitter) * scale)}, ${round(climb * scale)}],`);
      }
      lines.push('    ],');
    }
    lines.push('  },');
  }
  lines.push('};');
  lines.push('');
  lines.push(`/** Pick the table that matches how long the trigger has been held. */
export function sprayTable(weaponId, shots) {
  const entry = SPRAY_LIBRARY[weaponId];
  if (!entry) return null;
  if (shots <= 4) return entry.tap;
  if (shots <= 12) return entry.burst;
  return entry.spray;
}

/** Camera kick (degrees) for one bullet of a weapon. */
export function sprayKick(weaponId, shotIndex) {
  const entry = SPRAY_LIBRARY[weaponId];
  if (!entry) return { x: 0, y: 0 };
  const table = sprayTable(weaponId, shotIndex + 1);
  const point = table[Math.min(table.length - 1, Math.max(0, shotIndex))];
  return { x: point[0], y: point[1] };
}

/** Peak vertical kick of a full spray — used by the buy menu stat bars. */
export function sprayPeak(weaponId) {
  const entry = SPRAY_LIBRARY[weaponId];
  if (!entry) return 0;
  return entry.spray.reduce((max, p) => Math.max(max, p[1]), 0);
}
`);
  return lines.join('\n');
}

/* ------------------------------------------------------------------ */
/* write                                                              */
/* ------------------------------------------------------------------ */
const outDir = path.join(ROOT, 'src', 'data');
fs.mkdirSync(outDir, { recursive: true });

const ballistics = buildBallistics();
fs.writeFileSync(path.join(outDir, 'ballistics.js'), ballistics);

const callouts = buildCallouts();
fs.writeFileSync(path.join(outDir, 'callouts.js'), callouts);

const recipes = buildSkinRecipes();
fs.writeFileSync(path.join(outDir, 'skinRecipes.js'), recipes);

const sprays = buildSprayLibrary();
fs.writeFileSync(path.join(outDir, 'sprayLibrary.js'), sprays);

const count = (t) => t.split('\n').length;
console.log(`ballistics.js  ${count(ballistics)} satır — ${Object.keys(WEAPONS).length} silah`);
console.log(`callouts.js    ${count(callouts)} satır — ${MAPS.length} harita × 100 bölge`);
console.log(`skinRecipes.js ${count(recipes)} satır — ${Object.keys(WEAPON_SKINS).length} silah`);
console.log(`sprayLibrary.js ${count(sprays)} satır — ${Object.keys(WEAPONS).length} silah × 3 desen`);
console.log(`toplam üretilen: ${count(ballistics) + count(callouts) + count(recipes) + count(sprays)} satır`);
console.log(`buy order: ${BUY_ORDER.length} silah`);
