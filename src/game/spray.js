/**
 * Counter-Strike style spray patterns.
 *
 * Every automatic weapon kicks the camera along a fixed, learnable path:
 * the muzzle climbs for the first shots, then drifts sideways while the
 * player drags the mouse back down. The tables below are stored in degrees
 * and scaled by the weapon's own `patternScale`, so an AK-47 feels harsher
 * than an M4A4 without needing two hand-written tables.
 */

const AK = [
  [0, 0.00], [0, 0.95], [0, 1.75], [0, 2.35], [0.1, 2.80], [-0.15, 3.10], [0.35, 3.25],
  [0.85, 3.30], [1.35, 3.28], [1.75, 3.20], [2.05, 3.10], [2.20, 3.00], [2.05, 2.92],
  [1.65, 2.85], [1.10, 2.80], [0.45, 2.75], [-0.25, 2.70], [-0.95, 2.66], [-1.6, 2.62],
  [-2.15, 2.58], [-2.55, 2.54], [-2.75, 2.50], [-2.70, 2.48], [-2.45, 2.46], [-2.05, 2.44],
  [-1.55, 2.42], [-1.0, 2.40], [-0.45, 2.38], [0.05, 2.36], [0.5, 2.34],
];

const M4 = [
  [0, 0.00], [0, 0.72], [0.05, 1.30], [0.1, 1.78], [0.2, 2.12], [0.4, 2.38], [0.7, 2.56],
  [1.05, 2.66], [1.35, 2.72], [1.5, 2.74], [1.45, 2.74], [1.25, 2.72], [0.95, 2.70],
  [0.6, 2.68], [0.25, 2.66], [-0.1, 2.64], [-0.4, 2.62], [-0.65, 2.60], [-0.85, 2.58],
  [-0.95, 2.56], [-0.95, 2.54], [-0.85, 2.52], [-0.65, 2.50], [-0.4, 2.48], [-0.15, 2.46],
  [0.1, 2.44], [0.3, 2.42], [0.45, 2.40], [0.55, 2.38], [0.6, 2.36],
];

const SMG = [
  [0, 0.00], [0, 0.42], [0.05, 0.78], [0.15, 1.05], [0.35, 1.25], [0.65, 1.38],
  [0.95, 1.46], [1.15, 1.50], [1.2, 1.52], [1.1, 1.52], [0.9, 1.50], [0.6, 1.48],
  [0.3, 1.46], [0.05, 1.44], [-0.2, 1.42], [-0.35, 1.40], [-0.4, 1.38], [-0.35, 1.36],
  [-0.2, 1.34], [0, 1.32], [0.15, 1.30], [0.25, 1.28], [0.3, 1.26], [0.3, 1.24],
  [0.25, 1.22], [0.15, 1.20], [0.05, 1.18], [0, 1.16], [0, 1.14], [0, 1.12],
];

const PISTOL = [
  [0, 0.00], [0, 0.5], [0, 0.85], [0.05, 1.1], [0.15, 1.25], [0.3, 1.35],
  [0.4, 1.4], [0.4, 1.4], [0.3, 1.4], [0.2, 1.4], [0.1, 1.4], [0, 1.4],
  [0, 1.4], [0, 1.4], [0, 1.4], [0, 1.4], [0, 1.4], [0, 1.4], [0, 1.4], [0, 1.4],
];

const HEAVY = [
  [0, 0.00], [0, 0.55], [0, 0.95], [0.1, 1.25], [0.3, 1.45], [0.55, 1.6],
  [0.8, 1.7], [1.0, 1.76], [1.1, 1.8], [1.1, 1.82], [1.0, 1.82], [0.8, 1.8],
  [0.6, 1.78], [0.4, 1.76], [0.2, 1.74], [0, 1.72], [-0.15, 1.7], [-0.25, 1.68],
  [-0.3, 1.66], [-0.3, 1.64], [-0.25, 1.62], [-0.15, 1.6], [0, 1.58], [0.1, 1.56],
  [0.15, 1.54], [0.15, 1.52], [0.1, 1.50], [0.05, 1.48], [0, 1.46], [0, 1.44],
];

const SNIPER = [[0, 0.00], [0, 2.2], [0, 2.4]];

const PATTERNS = {
  rifle: AK,
  m4: M4,
  smg: SMG,
  pistol: PISTOL,
  heavy: HEAVY,
  sniper: SNIPER,
};

/** Which table a weapon uses. */
export function patternKind(weapon) {
  if (!weapon) return PISTOL;
  if (weapon.scope) return PATTERNS.sniper;
  switch (weapon.type) {
    case 'TÜFEK': return weapon.id === 'm4a4' || weapon.id === 'famas' || weapon.id === 'aug'
      ? PATTERNS.m4 : PATTERNS.rifle;
    case 'HAFİF MAKİNELİ': return PATTERNS.smg;
    case 'AV TÜFEĞİ': return PATTERNS.heavy;
    case 'MİNİGUN': return PATTERNS.heavy;
    case 'KESKİN NİŞANCI': return PATTERNS.sniper;
    default: return PATTERNS.pistol;
  }
}

/**
 * Recoil offset (degrees) for a given bullet index.
 * @returns {{x:number,y:number}} horizontal / vertical kick
 */
export function sprayOffset(weapon, shotIndex) {
  const table = patternKind(weapon);
  const scale = weapon?.patternScale ?? 1;
  const i = Math.max(0, Math.min(table.length - 1, shotIndex | 0));
  const [x, y] = table[i];
  return { x: x * scale, y: y * scale };
}

/** How hard the first bullet is affected by standing still (1 = perfect). */
export function firstShotAccuracy(weapon, actor) {
  const speed = Math.hypot(actor?.vel?.x || 0, actor?.vel?.z || 0);
  if (!weapon) return 0;
  if (weapon.scope && actor?.adsAmount > 0.85) return 0;
  const base = weapon.spread * 0.28;
  const move = Math.min(speed / 5.4, 1) * (weapon.spread * 1.5);
  const air = actor?.grounded === false ? weapon.spread * 1.8 : 0;
  const crouch = actor?.crouch ? 0.6 : 1;
  return (base + move + air) * crouch;
}

/** Human readable pattern preview used by the buy menu tooltip. */
export function patternPreview(weapon, shots = 12) {
  const out = [];
  for (let i = 0; i < shots; i++) out.push(sprayOffset(weapon, i));
  return out;
}
