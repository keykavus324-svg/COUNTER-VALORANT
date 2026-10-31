import * as THREE from 'three';
import { decorateWeaponModel } from './skins.js';

/**
 * Weapon catalogue + procedural low-poly weapon models.
 * Damage values are body-shot; headshot multipliers are applied separately.
 */

export const WEAPONS = {
  knife: {
    id: 'knife', name: 'BIÇAK', type: 'MELEE', price: 0, slot: 2,
    damage: 62, headMult: 1, rpm: 90, mag: 0, reserve: 0,
    auto: false, spread: 0, recoil: 0, range: 2.3, reload: 0,
    moveMult: 1.12, ads: 0, buyable: false, color: '#c9ced4',
    desc: 'Sessiz ve ölümcül. Sırtına giren bıçak iki kat hasar verir.',
  },
  classic: {
    id: 'classic', name: 'CLASSIC', type: 'TABANCA', price: 0, slot: 1,
    damage: 26, headMult: 3.4, rpm: 360, mag: 12, reserve: 48,
    auto: false, spread: 1.1, recoil: 1.05, range: 60, reload: 1.35,
    moveMult: 1.05, ads: 1.15, buyable: false, color: '#b9c2c9',
    desc: 'Ücretsiz başlangıç tabancası. Yakın mesafede iş görür.',
  },
  ghost: {
    id: 'ghost', name: 'GHOST', type: 'TABANCA', price: 500, slot: 1,
    damage: 34, headMult: 3.4, rpm: 420, mag: 15, reserve: 60,
    auto: false, spread: 0.85, recoil: 1.15, range: 70, reload: 1.5,
    moveMult: 1.05, ads: 1.1, buyable: true, color: '#6f8fa8',
    desc: 'Susturuculu tabanca. Kafaya iki isabet yeter.',
  },
  sheriff: {
    id: 'sheriff', name: 'SHERIFF', type: 'TABANCA', price: 800, slot: 1,
    damage: 62, headMult: 2.9, rpm: 240, mag: 6, reserve: 30,
    auto: false, spread: 0.7, recoil: 2.4, range: 70, reload: 2.1,
    moveMult: 1.05, ads: 1.05, buyable: true, color: '#c8a45c',
    desc: 'Altı patlar, altı öldürür. Yakın mesafenin kralı.',
  },
  spectre: {
    id: 'spectre', name: 'SPECTRE', type: 'HAFİF MAKİNELİ', price: 1600, slot: 1,
    damage: 25, headMult: 2.7, rpm: 820, mag: 30, reserve: 90,
    auto: true, spread: 1.35, recoil: 0.85, range: 55, reload: 2.1,
    moveMult: 1.02, ads: 1.25, buyable: true, color: '#7d8f6d',
    desc: 'Hızlı ateş eden hafif makineli. Yakın dövüşte çok güçlü.',
  },
  judge: {
    id: 'judge', name: 'JUDGE', type: 'AV TÜFEĞİ', price: 1850, slot: 1,
    damage: 18, pellets: 9, headMult: 1.3, rpm: 220, mag: 7, reserve: 28,
    auto: true, spread: 4.6, recoil: 2.9, range: 22, reload: 2.6,
    moveMult: 1.0, ads: 1.0, buyable: true, color: '#8a5a3a',
    desc: 'Pompalı. Köşe tutanların korkulu rüyası.',
  },
  bulldog: {
    id: 'bulldog', name: 'BULLDOG', type: 'TÜFEK', price: 2100, slot: 1,
    damage: 34, headMult: 3.2, rpm: 620, mag: 24, reserve: 72,
    auto: true, spread: 1.15, recoil: 1.5, range: 80, reload: 2.2,
    moveMult: 0.98, ads: 1.4, buyable: true, color: '#5f6d76',
    desc: 'Ekonomik tüfek. Orta mesafede dengeli.',
  },
  vandal: {
    id: 'vandal', name: 'VANDAL', type: 'TÜFEK', price: 2900, slot: 1,
    damage: 40, headMult: 3.9, rpm: 660, mag: 25, reserve: 75,
    auto: true, spread: 0.95, recoil: 1.9, range: 120, reload: 2.4,
    moveMult: 0.96, ads: 1.25, buyable: true, color: '#b3783f',
    desc: 'Mesafe ne olursa olsun kafaya tek isabet. Klasik tüfek.',
  },
  phantom: {
    id: 'phantom', name: 'PHANTOM', type: 'TÜFEK', price: 2900, slot: 1,
    damage: 37, headMult: 3.7, rpm: 700, mag: 30, reserve: 90,
    auto: true, spread: 0.85, recoil: 1.7, range: 90, reload: 2.5,
    moveMult: 0.97, ads: 1.25, buyable: true, color: '#3e6b86',
    desc: 'Susturuculu tüfek. Duman içinden bile isabet ettirir.',
  },
  operator: {
    id: 'operator', name: 'OPERATOR', type: 'KESKİN NİŞANCI', price: 4700, slot: 1,
    damage: 165, headMult: 1.6, rpm: 52, mag: 5, reserve: 15,
    auto: false, spread: 0.45, recoil: 5.5, range: 200, reload: 3.3,
    moveMult: 0.86, ads: 4.2, scope: true, buyable: true, color: '#4e5a63',
    desc: 'Tek isabet, tek ceset. Ağır ama affetmez.',
  },
  odin: {
    id: 'odin', name: 'ODIN', type: 'MİNİGUN', price: 3200, slot: 1,
    damage: 30, headMult: 2.3, rpm: 780, mag: 60, reserve: 120,
    auto: true, spread: 1.6, recoil: 1.3, range: 100, reload: 4.0,
    moveMult: 0.9, ads: 1.2, buyable: true, color: '#6b6f58',
    desc: 'Ağır makineli. Şarjörü bitene kadar her şeyi deler.',
  },
};

export const BUY_ORDER = ['ghost', 'sheriff', 'spectre', 'judge', 'bulldog', 'vandal', 'phantom', 'operator', 'odin'];

export function getWeapon(id) {
  return WEAPONS[id] || WEAPONS.classic;
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

/**
 * Builds a weapon. Model faces -Z (muzzle direction), origin at the grip.
 * viewmodel=true uses slightly exaggerated proportions for the first person view.
 */
export function buildWeaponModel(id, viewmodel = true, skinMap = null) {
  const g = new THREE.Group();
  const w = getWeapon(id);
  const muzzle = new THREE.Object3D();
  const shellEject = new THREE.Object3D();
  let magMesh = null;

  switch (id) {
    case 'knife': {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.16, 0.42), M.steel);
      blade.position.set(0, 0.06, -0.34);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.16, 4), M.steel);
      tip.rotation.x = -Math.PI / 2;
      tip.position.set(0, 0.1, -0.58);
      const guard = box(0.1, 0.05, 0.06, M.metalDark, 0, 0, -0.09);
      const handle = box(0.055, 0.075, 0.25, M.polymer, 0, 0, 0.05);
      const wrap = box(0.062, 0.082, 0.06, M.accent, 0, 0, -0.01);
      g.add(blade, tip, guard, handle, wrap);
      muzzle.position.set(0, 0.1, -0.62);
      break;
    }
    case 'classic': {
      const slide = box(0.075, 0.085, 0.34, M.metal, 0, 0.045, -0.09);
      const frame = box(0.07, 0.06, 0.24, M.polymer, 0, -0.01, -0.03);
      const grip = box(0.075, 0.24, 0.12, M.polymer, 0, -0.14, 0.07, 0.28);
      const barrel = cyl(0.02, 0.02, 0.12, M.metalDark, 0, 0.05, -0.28);
      const sight = box(0.02, 0.025, 0.04, M.accent, 0, 0.1, -0.24);
      const trigger = box(0.03, 0.05, 0.02, M.metalDark, 0, -0.04, 0.02);
      magMesh = box(0.06, 0.09, 0.05, M.accentBlue, 0, -0.22, 0.09, 0.28);
      g.add(slide, frame, grip, barrel, sight, trigger, magMesh);
      muzzle.position.set(0, 0.05, -0.35);
      shellEject.position.set(0.05, 0.07, -0.06);
      break;
    }
    case 'ghost': {
      const slide = box(0.07, 0.09, 0.42, M.metal, 0, 0.05, -0.13);
      const supp = cyl(0.033, 0.033, 0.22, M.metalDark, 0, 0.05, -0.4);
      const grip = box(0.07, 0.25, 0.11, M.polymer, 0, -0.15, 0.07, 0.26);
      const accent = box(0.074, 0.02, 0.16, M.accentBlue, 0, 0.05, -0.06);
      const guard = box(0.055, 0.02, 0.1, M.metalDark, 0, -0.03, -0.02);
      magMesh = box(0.055, 0.12, 0.05, M.metalDark, 0, -0.22, 0.09, 0.28);
      const sight = box(0.02, 0.03, 0.03, M.steel, 0, 0.105, -0.3);
      g.add(slide, supp, grip, accent, guard, magMesh, sight);
      muzzle.position.set(0, 0.05, -0.52);
      shellEject.position.set(0.05, 0.08, -0.1);
      break;
    }
    case 'sheriff': {
      const barrel = cyl(0.028, 0.028, 0.34, M.metal, 0, 0.055, -0.24);
      const frame = box(0.07, 0.08, 0.2, M.metal, 0, 0.03, -0.06);
      const cylBody = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.12, 8), M.gold);
      cylBody.rotation.z = Math.PI / 2;
      cylBody.rotation.y = 0;
      cylBody.position.set(0, 0.03, -0.1);
      const grip = box(0.075, 0.26, 0.11, M.woodDark, 0, -0.15, 0.07, 0.24);
      const hammer = box(0.03, 0.06, 0.04, M.metalDark, 0, 0.08, 0.06);
      const sight = box(0.015, 0.025, 0.04, M.gold, 0, 0.1, -0.36);
      g.add(barrel, frame, cylBody, grip, hammer, sight);
      muzzle.position.set(0, 0.055, -0.42);
      shellEject.position.set(0.05, 0.06, -0.06);
      break;
    }
    case 'spectre': {
      const body = box(0.09, 0.11, 0.42, M.polymer, 0, 0.02, -0.12);
      const barrelShroud = cyl(0.035, 0.035, 0.2, M.metalDark, 0, 0.03, -0.4);
      const stock = box(0.05, 0.08, 0.22, M.metalDark, 0, 0.02, 0.19);
      const stockEnd = box(0.06, 0.14, 0.05, M.polymer, 0, -0.01, 0.31);
      const grip = box(0.07, 0.2, 0.1, M.polymer, 0, -0.14, 0.02, 0.22);
      magMesh = box(0.06, 0.2, 0.07, M.metalDark, 0, -0.14, -0.14, 0.1);
      const rail = box(0.06, 0.03, 0.2, M.metal, 0, 0.085, -0.14);
      const accent = box(0.095, 0.02, 0.1, M.accentBlue, 0, 0.02, 0.04);
      const sight = box(0.04, 0.05, 0.05, M.metalDark, 0, 0.11, -0.1);
      g.add(body, barrelShroud, stock, stockEnd, grip, magMesh, rail, accent, sight);
      muzzle.position.set(0, 0.03, -0.52);
      shellEject.position.set(0.055, 0.05, -0.06);
      break;
    }
    case 'judge': {
      const body = box(0.09, 0.1, 0.4, M.metal, 0, 0.02, -0.1);
      const tube = cyl(0.03, 0.03, 0.36, M.metalDark, 0, 0.07, -0.32);
      const pump = box(0.075, 0.07, 0.16, M.wood, 0, 0.0, -0.3);
      const stock = box(0.06, 0.12, 0.3, M.wood, 0, -0.03, 0.22, 0.06);
      const grip = box(0.07, 0.16, 0.09, M.woodDark, 0, -0.1, 0.02, 0.2);
      const sight = box(0.02, 0.025, 0.03, M.steel, 0, 0.09, -0.4);
      magMesh = box(0.05, 0.1, 0.06, M.metalDark, 0, -0.08, -0.14);
      g.add(body, tube, pump, stock, grip, sight, magMesh);
      muzzle.position.set(0, 0.05, -0.5);
      shellEject.position.set(0.05, 0.05, 0.0);
      break;
    }
    case 'bulldog': {
      const body = box(0.085, 0.11, 0.46, M.polymer, 0, 0.01, -0.1);
      const barrel = cyl(0.022, 0.022, 0.3, M.metalDark, 0, 0.035, -0.42);
      const handguard = box(0.075, 0.08, 0.22, M.tan, 0, 0.01, -0.32);
      const stock = box(0.055, 0.1, 0.3, M.tan, 0, -0.02, 0.22);
      const grip = box(0.06, 0.18, 0.09, M.polymer, 0, -0.14, 0.03, 0.2);
      magMesh = box(0.06, 0.22, 0.09, M.metalDark, 0, -0.14, -0.16, -0.08);
      const rail = box(0.055, 0.035, 0.3, M.metal, 0, 0.075, -0.16);
      const sight = box(0.04, 0.06, 0.06, M.metalDark, 0, 0.115, -0.12);
      const accent = box(0.09, 0.02, 0.08, M.accentBlue, 0, 0.01, 0.06);
      g.add(body, barrel, handguard, stock, grip, magMesh, rail, sight, accent);
      muzzle.position.set(0, 0.035, -0.58);
      shellEject.position.set(0.055, 0.06, -0.04);
      break;
    }
    case 'vandal': {
      const body = box(0.08, 0.1, 0.5, M.metalDark, 0, 0.02, -0.08);
      const barrel = cyl(0.02, 0.02, 0.42, M.metal, 0, 0.04, -0.47);
      const gasBlock = box(0.05, 0.07, 0.1, M.metal, 0, 0.06, -0.32);
      const handguard = box(0.07, 0.08, 0.26, M.wood, 0, 0.0, -0.28);
      const stock = box(0.055, 0.13, 0.32, M.wood, 0, -0.03, 0.25, 0.03);
      const grip = box(0.06, 0.18, 0.09, M.woodDark, 0, -0.14, 0.04, 0.22);
      magMesh = box(0.07, 0.24, 0.1, M.metalDark, 0, -0.15, -0.14, -0.18);
      const rail = box(0.05, 0.03, 0.2, M.metal, 0, 0.075, -0.12);
      const sight = box(0.035, 0.05, 0.05, M.metalDark, 0, 0.11, -0.1);
      const accent = box(0.085, 0.025, 0.1, M.accent, 0, 0.02, 0.1);
      g.add(body, barrel, gasBlock, handguard, stock, grip, magMesh, rail, sight, accent);
      muzzle.position.set(0, 0.04, -0.7);
      shellEject.position.set(0.055, 0.06, -0.02);
      break;
    }
    case 'phantom': {
      const body = box(0.08, 0.11, 0.5, M.polymer, 0, 0.02, -0.06);
      const supp = cyl(0.032, 0.032, 0.3, M.metalDark, 0, 0.045, -0.5);
      const handguard = box(0.075, 0.085, 0.3, M.polymer, 0, 0.015, -0.3);
      const stock = box(0.055, 0.12, 0.34, M.polymer, 0, -0.02, 0.26);
      const grip = box(0.06, 0.18, 0.09, M.polymer, 0, -0.14, 0.05, 0.2);
      magMesh = box(0.06, 0.22, 0.09, M.metalDark, 0, -0.14, -0.13, -0.1);
      const rail = box(0.05, 0.035, 0.34, M.metal, 0, 0.08, -0.14);
      const sight = box(0.04, 0.055, 0.09, M.metalDark, 0, 0.12, -0.08);
      const accent = box(0.085, 0.025, 0.12, M.accentBlue, 0, 0.02, 0.08);
      g.add(body, supp, handguard, stock, grip, magMesh, rail, sight, accent);
      muzzle.position.set(0, 0.045, -0.68);
      shellEject.position.set(0.055, 0.06, -0.02);
      break;
    }
    case 'operator': {
      const body = box(0.085, 0.12, 0.5, M.metalDark, 0, 0.02, -0.05);
      const barrel = cyl(0.021, 0.021, 0.7, M.metal, 0, 0.045, -0.6);
      const muzzleBrake = cyl(0.036, 0.032, 0.1, M.metalDark, 0, 0.045, -0.95);
      const scopeBody = cyl(0.045, 0.045, 0.34, M.metalDark, 0, 0.155, -0.1, Math.PI / 2, 16);
      const lens = cyl(0.05, 0.05, 0.02, M.glass, 0, 0.155, -0.28, Math.PI / 2, 16);
      const lens2 = cyl(0.05, 0.05, 0.02, M.glass, 0, 0.155, 0.075, Math.PI / 2, 16);
      const scopeMount = box(0.04, 0.08, 0.06, M.metal, 0, 0.1, -0.04);
      const stock = box(0.06, 0.16, 0.36, M.polymer, 0, -0.02, 0.3);
      const cheek = box(0.055, 0.06, 0.2, M.polymer, 0, 0.06, 0.24);
      const grip = box(0.06, 0.19, 0.1, M.polymer, 0, -0.14, 0.06, 0.22);
      magMesh = box(0.065, 0.18, 0.11, M.metalDark, 0, -0.12, -0.12);
      const bipodL = box(0.02, 0.22, 0.02, M.metal, -0.08, -0.16, -0.72, 0, 0, 0.3);
      const bipodR = box(0.02, 0.22, 0.02, M.metal, 0.08, -0.16, -0.72, 0, 0, -0.3);
      const accent = box(0.09, 0.025, 0.14, M.accent, 0, 0.02, 0.14);
      g.add(body, barrel, muzzleBrake, scopeBody, lens, lens2, scopeMount, stock, cheek, grip, magMesh, bipodL, bipodR, accent);
      muzzle.position.set(0, 0.045, -1.0);
      shellEject.position.set(0.055, 0.06, 0.0);
      break;
    }
    case 'odin': {
      const body = box(0.11, 0.13, 0.52, M.metalDark, 0, 0.02, -0.06);
      const drum = cyl(0.13, 0.13, 0.12, M.metal, 0, -0.06, -0.1, Math.PI / 2, 16);
      const barrel = cyl(0.024, 0.024, 0.44, M.metal, 0, 0.04, -0.5);
      const barrels = new THREE.Group();
      for (let i = 0; i < 3; i++) {
        const b = cyl(0.016, 0.016, 0.36, M.metalDark, Math.cos(i * 2.1) * 0.04, 0.04, -0.52);
        barrels.add(b);
      }
      const stock = box(0.06, 0.14, 0.34, M.polymer, 0, -0.02, 0.3);
      const grip = box(0.06, 0.18, 0.1, M.polymer, 0, -0.15, 0.06, 0.2);
      const carry = box(0.04, 0.04, 0.3, M.metal, 0, 0.11, -0.2);
      const accent = box(0.115, 0.025, 0.16, M.accent, 0, 0.02, 0.12);
      g.add(body, drum, barrel, barrels, stock, grip, carry, accent);
      muzzle.position.set(0, 0.04, -0.72);
      shellEject.position.set(0.06, 0.06, -0.02);
      break;
    }
    default: {
      g.add(box(0.08, 0.1, 0.4, M.metal, 0, 0.03, -0.1));
      muzzle.position.set(0, 0.03, -0.3);
    }
  }

  // muzzle flash / shell anchors live in the gun so they follow every animation
  muzzle.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), 0);
  g.add(muzzle, shellEject);
  g.userData.muzzle = muzzle;
  g.userData.shellEject = shellEject;
  g.userData.mag = magMesh;
  g.userData.weaponId = id;

  if (viewmodel) {
    g.scale.setScalar(0.92);
    g.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = false;
        o.receiveShadow = false;
        o.material = o.material;
        o.frustumCulled = false;
        o.renderOrder = 5;
      }
    });
  }
  if (skinMap !== undefined) decorateWeaponModel(g, id, skinMap);
  return g;
}

/** Tiny SVG silhouettes for the buy menu. */
export function weaponIconSVG(id) {
  const common = 'viewBox="0 0 120 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"';
  const shapes = {
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
  return `<svg ${common} fill="currentColor">${shapes[id] || shapes.classic}</svg>`;
}
