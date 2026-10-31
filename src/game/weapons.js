import * as THREE from 'three';
import { decorateWeaponModel } from './skins.js';
import { buildGunModel } from './gunModels.js';

/**
 * Weapon catalogue + procedural low-poly weapon models.
 * Damage values are body-shot; headshot multipliers are applied separately.
 */

export const WEAPONS = {
  knife: {
    id: 'knife', name: 'BIÇAK', type: 'MELEE', price: 0, slot: 2,
    damage: 55, headMult: 1, rpm: 90, mag: 0, reserve: 0,
    auto: false, spread: 0, recoil: 0, range: 2.3, reload: 0,
    moveMult: 1.12, ads: 0, buyable: false, color: '#c9ced4',
    desc: 'Sessiz ve ölümcül. Sırtına giren bıçak iki kat hasar verir.',
  },
  glock: {
    id: 'glock', name: 'GLOCK-18', type: 'TABANCA', price: 0, slot: 1,
    damage: 28, headMult: 4.0, rpm: 400, mag: 20, reserve: 120,
    auto: false, spread: 1.15, recoil: 0.9, range: 55, reload: 1.4,
    moveMult: 1.06, ads: 1.12, buyable: false, color: '#4a4f55',
    desc: 'Teröristlerin ücretsiz başlangıç tabancası. 20 mermi, hızlı ateş.',
  },
  usp_s: {
    id: 'usp_s', name: 'USP-S', type: 'TABANCA', price: 0, slot: 1,
    damage: 35, headMult: 4.0, rpm: 352, mag: 12, reserve: 24,
    auto: false, spread: 0.7, recoil: 1.0, range: 65, reload: 1.6,
    moveMult: 1.05, ads: 1.08, buyable: false, color: '#3f4750',
    desc: 'Anti-teröristlerin susturuculu tabancası. Sessiz ve isabetli.',
  },
  p250: {
    id: 'p250', name: 'P250', type: 'TABANCA', price: 300, slot: 1,
    damage: 38, headMult: 3.6, rpm: 400, mag: 13, reserve: 26,
    auto: false, spread: 0.95, recoil: 1.3, range: 60, reload: 1.7,
    moveMult: 1.05, ads: 1.1, buyable: true, color: '#5b6470',
    desc: 'Ucuz ve güçlü. Eko turlarında zırh delen tabanca.',
  },
  deagle: {
    id: 'deagle', name: 'DESERT EAGLE', type: 'TABANCA', price: 700, slot: 1,
    damage: 63, headMult: 3.2, rpm: 267, mag: 7, reserve: 35,
    auto: false, spread: 0.55, recoil: 2.6, range: 80, reload: 2.2,
    moveMult: 1.04, ads: 1.05, buyable: true, color: '#c8a45c',
    desc: 'Altı patlar, tek kurşun öldürür. Ama geri tepmesi acımasız.',
  },
  mac10: {
    id: 'mac10', name: 'MAC-10', type: 'HAFİF MAKİNELİ', price: 1050, slot: 1,
    damage: 29, headMult: 3.1, rpm: 800, mag: 30, reserve: 100,
    auto: true, spread: 1.8, recoil: 0.8, range: 42, reload: 1.9,
    moveMult: 1.03, ads: 1.2, buyable: true, color: '#4a4a46',
    desc: 'Ucuz SMG. Yakın mesafede seri ateş ve yüksek mobilite.',
  },
  mp9: {
    id: 'mp9', name: 'MP9', type: 'HAFİF MAKİNELİ', price: 1250, slot: 1,
    damage: 26, headMult: 3.1, rpm: 857, mag: 30, reserve: 120,
    auto: true, spread: 1.45, recoil: 0.75, range: 48, reload: 2.1,
    moveMult: 1.02, ads: 1.18, buyable: true, color: '#414a52',
    desc: 'Hızlı ve isabetli SMG. Anti-teröristlerin favorisi.',
  },
  ssg08: {
    id: 'ssg08', name: 'SSG 08', type: 'KESKİN NİŞANCI', price: 1700, slot: 1,
    damage: 88, headMult: 2.2, rpm: 48, mag: 10, reserve: 90,
    auto: false, spread: 0.35, recoil: 3.4, range: 200, reload: 2.9,
    moveMult: 0.94, ads: 3.4, scope: true, buyable: true, color: '#4d5a4f',
    desc: 'Ucuz nişancı. Gövdeye iki isabet ya da tek kafa yeter.',
  },
  ak47: {
    id: 'ak47', name: 'AK-47', type: 'TÜFEK', price: 2700, slot: 1,
    damage: 36, headMult: 4.2, rpm: 600, mag: 30, reserve: 90,
    auto: true, spread: 1.0, recoil: 2.0, range: 120, reload: 2.4,
    moveMult: 0.96, ads: 1.25, buyable: true, color: '#8a5a30',
    desc: 'Tek kafa atışında öldürür. Recoil desenini öğrenen kral olur.',
  },
  m4a4: {
    id: 'm4a4', name: 'M4A4', type: 'TÜFEK', price: 3100, slot: 1,
    damage: 33, headMult: 3.8, rpm: 666, mag: 30, reserve: 90,
    auto: true, spread: 0.9, recoil: 1.75, range: 110, reload: 2.5,
    moveMult: 0.97, ads: 1.22, buyable: true, color: '#3e4a54',
    desc: 'Dengeli tüfek. AK-47 kadar sert değil ama kontrolü kolay.',
  },
  awp: {
    id: 'awp', name: 'AWP', type: 'KESKİN NİŞANCI', price: 4750, slot: 1,
    damage: 115, headMult: 1.6, rpm: 41, mag: 10, reserve: 30,
    auto: false, spread: 0.4, recoil: 6.0, range: 250, reload: 3.6,
    moveMult: 0.82, ads: 4.6, scope: true, buyable: true, color: '#38424a',
    desc: 'Gövdeye tek isabet, tek ölüm. Her mermi bir servet.',
  },
  nova: {
    id: 'nova', name: 'NOVA', type: 'AV TÜFEĞİ', price: 1050, slot: 1,
    damage: 16, pellets: 9, headMult: 2.6, rpm: 68, mag: 8, reserve: 32,
    auto: false, spread: 4.8, recoil: 3.1, range: 24, reload: 0.55, reloadShell: true,
    moveMult: 1.0, ads: 1.0, buyable: true, color: '#5a4636',
    desc: 'Ucuz pompalı. Yakın mesafede tek isabette öldürür, uzakta işe yaramaz.',
  },
  xm1014: {
    id: 'xm1014', name: 'XM1014', type: 'AV TÜFEĞİ', price: 2000, slot: 1,
    damage: 14, pellets: 8, headMult: 2.4, rpm: 240, mag: 7, reserve: 32,
    auto: true, spread: 4.2, recoil: 2.4, range: 26, reload: 0.6, reloadShell: true,
    moveMult: 1.0, ads: 1.0, buyable: true, color: '#46423a',
    desc: 'Yarı otomatik pompalı. Site girişlerinde seri temizlik.',
  },
  ump45: {
    id: 'ump45', name: 'UMP-45', type: 'HAFİF MAKİNELİ', price: 1200, slot: 1,
    damage: 35, headMult: 3.2, rpm: 666, mag: 25, reserve: 100,
    auto: true, spread: 1.35, recoil: 1.05, range: 50, reload: 2.2,
    moveMult: 1.02, ads: 1.2, buyable: true, color: '#4a4740',
    desc: 'Yavaş ama sert SMG. Eko turunda zırh deler.',
  },
  mp7: {
    id: 'mp7', name: 'MP7', type: 'HAFİF MAKİNELİ', price: 1500, slot: 1,
    damage: 29, headMult: 3.0, rpm: 750, mag: 30, reserve: 120,
    auto: true, spread: 1.5, recoil: 0.9, range: 46, reload: 2.0,
    moveMult: 1.02, ads: 1.18, buyable: true, color: '#3f4348',
    desc: 'Dengeli SMG. Yakın-orta mesafede güvenli seçim.',
  },
  galil: {
    id: 'galil', name: 'GALIL AR', type: 'TÜFEK', price: 1800, slot: 1,
    damage: 30, headMult: 3.6, rpm: 666, mag: 35, reserve: 90,
    auto: true, spread: 1.2, recoil: 1.8, range: 100, reload: 2.4,
    moveMult: 0.97, ads: 1.22, buyable: true, color: '#4a4436',
    desc: 'Ucuz tüfek. AK alamadığın turda iş görür.',
  },
  famas: {
    id: 'famas', name: 'FAMAS', type: 'TÜFEK', price: 2050, slot: 1,
    damage: 30, headMult: 3.4, rpm: 666, mag: 25, reserve: 90,
    auto: true, spread: 1.1, recoil: 1.7, range: 100, reload: 2.3,
    moveMult: 0.97, ads: 1.24, buyable: true, color: '#3c4148',
    desc: 'CT eko tüfeği. Şarjörü küçük, kontrolü kolay.',
  },
  aug: {
    id: 'aug', name: 'AUG', type: 'TÜFEK', price: 3300, slot: 1,
    damage: 32, headMult: 3.9, rpm: 620, mag: 30, reserve: 90,
    auto: true, spread: 0.8, recoil: 1.65, range: 115, reload: 2.6,
    moveMult: 0.95, ads: 2.2, scope: true, buyable: true, color: '#3d4450',
    desc: 'Dürbünlü tüfek. Yakın mesafede dürbünü kapat, uzakta aç.',
  },
  sg553: {
    id: 'sg553', name: 'SG 553', type: 'TÜFEK', price: 3000, slot: 1,
    damage: 34, headMult: 4.0, rpm: 545, mag: 30, reserve: 90,
    auto: true, spread: 0.85, recoil: 2.05, range: 120, reload: 2.5,
    moveMult: 0.95, ads: 2.2, scope: true, buyable: true, color: '#4a4336',
    desc: 'AK muadili dürbünlü tüfek. Tek kafa, hızlı re-take.',
  },
  m249: {
    id: 'm249', name: 'M249', type: 'MİNİGUN', price: 5200, slot: 1,
    damage: 32, headMult: 2.6, rpm: 750, mag: 100, reserve: 200,
    auto: true, spread: 1.8, recoil: 1.6, range: 100, reload: 5.7,
    moveMult: 0.86, ads: 1.3, buyable: true, color: '#3a4038',
    desc: 'Ağır makineli. 100 mermi, cehennem gibi baskı — ama pahalı.',
  },
};

export const BUY_ORDER = [
  'p250', 'deagle', 'mac10', 'mp9', 'ump45', 'mp7',
  'nova', 'xm1014', 'galil', 'famas', 'ak47', 'm4a4', 'aug', 'sg553',
  'ssg08', 'awp', 'm249',
];

/** Buy menu categories (CS style columns). */
export const BUY_GROUPS = [
  { id: 'pistol', label: 'TABANCALAR', items: ['p250', 'deagle'] },
  { id: 'smg', label: 'HAFİF MAKİNELİ', items: ['mac10', 'mp9', 'ump45', 'mp7'] },
  { id: 'shotgun', label: 'AV TÜFEKLERİ', items: ['nova', 'xm1014'] },
  { id: 'rifle', label: 'TÜFEKLER', items: ['galil', 'famas', 'ak47', 'm4a4', 'aug', 'sg553'] },
  { id: 'sniper', label: 'KESKİN NİŞANCILAR', items: ['ssg08', 'awp'] },
  { id: 'heavy', label: 'AĞIR', items: ['m249'] },
];

/** Every weapon id renders with one of the procedural models below. */
export const WEAPON_SHAPE = {
  knife: 'knife', glock: 'classic', usp_s: 'ghost', p250: 'classic', deagle: 'sheriff',
  mac10: 'spectre', mp9: 'spectre', ump45: 'spectre', mp7: 'spectre',
  nova: 'judge', xm1014: 'judge',
  galil: 'bulldog', famas: 'bulldog', ak47: 'vandal', m4a4: 'phantom',
  aug: 'phantom', sg553: 'vandal',
  ssg08: 'operator', awp: 'operator', m249: 'odin',
};

/** Icon silhouettes are keyed by shape, so new weapons reuse them. */
export function weaponIconKey(id) {
  return WEAPON_SHAPE[id] || id;
}

export function getWeapon(id) {
  return WEAPONS[id] || WEAPONS.glock;
}

/* ------------------------------------------------------------------ */
/* Procedural weapon models                                            */
/* ------------------------------------------------------------------ */

const M = {
  metal: new THREE.MeshStandardMaterial({ color: 0x2f3439, metalness: 0.85, roughness: 0.42 }),
  metalDark: new THREE.MeshStandardMaterial({ color: 0x1b1f23, metalness: 0.8, roughness: 0.5 }),
  steel: new THREE.MeshStandardMaterial({ color: 0x8d949b, metalness: 0.9, roughness: 0.3 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x7a4c2a, metalness: 0.05, roughness: 0.75 }),
  woodDark: new THREE.MeshStandardMaterial({ color: 0x4d2f1a, metalness: 0.05, roughness: 0.8 }),
  polymer: new THREE.MeshStandardMaterial({ color: 0x333a33, metalness: 0.1, roughness: 0.85 }),
  tan: new THREE.MeshStandardMaterial({ color: 0x9a8868, metalness: 0.1, roughness: 0.85 }),
  accent: new THREE.MeshStandardMaterial({ color: 0xff4655, metalness: 0.3, roughness: 0.4, emissive: 0x3a0508 }),
  accentBlue: new THREE.MeshStandardMaterial({ color: 0x30f3c8, metalness: 0.3, roughness: 0.4, emissive: 0x043a30 }),
  gold: new THREE.MeshStandardMaterial({ color: 0xd9b26a, metalness: 0.95, roughness: 0.28 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x0a1a22, metalness: 0.4, roughness: 0.1, transparent: true, opacity: 0.75 }),
};

function box(w, h, d, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  return m;
}

function cyl(rt, rb, h, mat, x = 0, y = 0, z = 0, rx = Math.PI / 2, seg = 12) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.position.set(x, y, z);
  m.rotation.x = rx;
  m.castShadow = true;
  return m;
}


/** Trigger guard — every real firearm has one, and its absence reads as "toy". */
function triggerGuard(mat, x = 0, y = -0.075, z = 0.005, r = 0.045) {
  const m = new THREE.Mesh(new THREE.TorusGeometry(r, 0.0075, 5, 14, Math.PI * 1.15), mat);
  m.position.set(x, y, z);
  m.rotation.z = Math.PI * 0.06;
  return m;
}

/**
 * Curved magazine: four tapered segments swept along an arc. The AK banana mag
 * is the single most recognisable silhouette in the game; a straight box
 * instantly looks wrong.
 */
function curvedMag(w, d, h, mat, x, y, z, curve = 0.3, segs = 4) {
  const group = new THREE.Group();
  const segH = h / segs;
  for (let i = 0; i < segs; i++) {
    const t = (i + 0.5) / segs;
    // overlap the segments so the sweep reads as one solid magazine
    const seg = new THREE.Mesh(new THREE.BoxGeometry(w, segH * 1.3, d * (1 - t * 0.12)), mat);
    const bend = curve * (t * t);
    seg.position.set(0, -i * segH * 0.92, -bend * h * 0.5);
    seg.rotation.x = bend * 0.55;
    group.add(seg);
  }
  group.position.set(x, y, z);
  return group;
}

/** Short rail with visible slots, used on the flat-top guns. */
function railSlots(mat, x, y, z, length, count = 5) {
  const group = new THREE.Group();
  const step = length / count;
  for (let i = 0; i < count; i++) {
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.008, step * 0.55), mat);
    slot.position.set(0, 0, -length / 2 + step * (i + 0.5));
    group.add(slot);
  }
  group.position.set(x, y, z);
  return group;
}

/**
 * Builds a weapon. Model faces -Z (muzzle direction), origin at the grip.
 * viewmodel=true uses slightly exaggerated proportions for the first person view.
 */
export function buildWeaponModel(id, viewmodel = true, skinMap = null) {
  const g = new THREE.Group();
  const shape = WEAPON_SHAPE[id] || id;

  const built = buildGunModel(shape, M);
  built.root.position.set(0, 0, 0);
  g.add(built.root);
  g.userData.mag = built.mag || null;
  g.userData.weaponId = id;
  g.userData.shape = shape;

  // muzzle / shell anchors are Object3D markers so gameplay code can query them
  const muzzle = new THREE.Object3D();
  muzzle.position.copy(built.muzzle);
  const shellEject = new THREE.Object3D();
  shellEject.position.copy(built.eject);
  g.add(muzzle, shellEject);
  g.userData.muzzle = muzzle;
  g.userData.shellEject = shellEject;

  if (viewmodel) {
    g.scale.setScalar(0.92);
    g.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = false;
        o.receiveShadow = false;
        o.frustumCulled = false;
        o.renderOrder = 5;
      }
    });
  }
  if (skinMap !== undefined) decorateWeaponModel(g, id, skinMap);
  return g;
}

/** Tiny SVG silhouettes for the buy menu. */
const SVG_SHAPES = {
    knife: '<path d="M18 34 L60 12 L66 16 L30 38 Z"/><rect x="62" y="14" width="26" height="6" transform="rotate(-20 62 14)"/><rect x="86" y="8" width="14" height="4" transform="rotate(-20 86 8)"/>',
    classic: '<rect x="34" y="20" width="46" height="9" rx="2"/><path d="M40 29 L50 29 L46 42 L36 42 Z"/><rect x="78" y="21" width="10" height="5"/><rect x="52" y="16" width="8" height="4"/>',
    ghost: '<rect x="30" y="20" width="58" height="8" rx="2"/><rect x="88" y="21" width="16" height="6"/><path d="M36 28 L48 28 L44 42 L32 42 Z"/><rect x="50" y="16" width="10" height="4"/>',
    sheriff: '<rect x="34" y="21" width="34" height="8" rx="2"/><circle cx="46" cy="25" r="7"/><rect x="66" y="22" width="28" height="6"/><path d="M36 29 L48 29 L44 42 L32 42 Z"/><rect x="60" y="16" width="6" height="5"/>',
    spectre: '<rect x="26" y="18" width="62" height="11" rx="2"/><rect x="84" y="20" width="14" height="6"/><path d="M34 29 L44 29 L40 40 L30 40 Z"/><rect x="50" y="29" width="9" height="13"/><rect x="18" y="18" width="12" height="7"/><rect x="46" y="13" width="20" height="4"/>',
    judge: '<rect x="30" y="20" width="54" height="9" rx="2"/><rect x="80" y="19" width="24" height="6"/><rect x="58" y="28" width="22" height="6"/><path d="M22 20 L34 20 L28 31 L18 31 Z"/><path d="M34 29 L40 29 L36 38 L30 38 Z"/>',
    bulldog: '<rect x="28" y="18" width="54" height="14" rx="3"/><rect x="78" y="20" width="26" height="6"/><rect x="12" y="18" width="18" height="8"/><path d="M40 32 L48 32 L44 44 L36 44 Z"/><rect x="52" y="32" width="9" height="12"/><rect x="54" y="12" width="20" height="5"/>',
    vandal: '<rect x="26" y="18" width="50" height="13" rx="2"/><rect x="72" y="20" width="30" height="5"/><rect x="6" y="18" width="22" height="9"/><path d="M34 31 L44 31 L39 44 L29 44 Z"/><rect x="48" y="31" width="10" height="13" transform="rotate(8 48 31)"/><rect x="52" y="12" width="8" height="6"/>',
    phantom: '<rect x="24" y="18" width="54" height="13" rx="2"/><rect x="76" y="21" width="24" height="7" rx="3"/><rect x="100" y="22" width="12" height="5"/><rect x="6" y="18" width="22" height="9"/><path d="M32 31 L42 31 L37 44 L27 44 Z"/><rect x="46" y="31" width="10" height="12"/><rect x="50" y="12" width="22" height="5"/>',
    operator: '<rect x="20" y="20" width="62" height="10" rx="2"/><rect x="80" y="21" width="34" height="5"/><rect x="114" y="19" width="6" height="9"/><rect x="46" y="10" width="34" height="7" rx="3"/><rect x="0" y="18" width="22" height="10"/><path d="M30 30 L40 30 L35 42 L25 42 Z"/><rect x="86" y="26" width="2" height="12"/><rect x="92" y="26" width="2" height="12"/>',
    odin: '<rect x="24" y="16" width="56" height="16" rx="3"/><circle cx="46" cy="34" r="11"/><rect x="78" y="20" width="30" height="6"/><rect x="104" y="18" width="8" height="9"/><rect x="8" y="18" width="18" height="10"/><path d="M60 32 L68 32 L64 44 L56 44 Z"/>',
};

/** shape key -> inline svg children, shared by icons and skin thumbnails */
export const WEAPON_SVG_SHAPES = SVG_SHAPES;

export function weaponIconSVG(id) {
  const key = WEAPON_SHAPE[id] || id;
  return `<svg viewBox="0 0 120 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" fill="currentColor">${SVG_SHAPES[key] || SVG_SHAPES.classic}</svg>`;
}
