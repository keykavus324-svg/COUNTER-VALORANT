/**
 * Weapon skin system.
 *
 * Real Counter-Strike finish renders (Valve's economy-image CDN) are
 * projected onto the flanks of every gun model — first person viewmodel, the
 * third person models of the bots and the buy menu / vault thumbnails. If the
 * CDN is unreachable the models simply keep their procedural materials.
 */
import * as THREE from 'three';
import { WEAPON_SKINS, skinImageUrl, loadImage, cdnStatus } from './csgoAssets.js';
import { SKIN_RECIPES } from '../data/skinRecipes.js';

const textureCache = new Map();   // uuid -> THREE.Texture | null (failed)
const pending = new Map();        // uuid -> Promise<THREE.Texture|null>
/** every live model that wants a skin, so late textures can be applied */
const listeners = new Set();

const DECAL_FLAG = 'cvSkinDecal';

export function skinList(weaponId) {
  return WEAPON_SKINS[weaponId] || [];
}

export function findSkin(uuid) {
  if (!uuid) return null;
  for (const list of Object.values(WEAPON_SKINS)) {
    const hit = list.find((s) => s.id === uuid || s.uuid === uuid);
    if (hit) return hit;
  }
  return null;
}

export function skinById(weaponId, uuid) {
  return skinList(weaponId).find((s) => s.id === uuid || s.uuid === uuid) || null;
}

export function defaultSkin(weaponId) {
  // the first entry of every list is the flagship skin of that weapon
  return skinList(weaponId)[0] || null;
}

/**
 * Resolve the skin a weapon should currently use.
 *
 * Vanilla is the default: a gun only gets repainted when the player actually
 * equipped a finish in the vault. Auto-applying the "flagship" skin to every
 * weapon used to bleach the base materials (wood, blued steel, polymer) into
 * one flat pale wash — which is exactly what made the viewmodel look plastic.
 */
export function resolveSkin(weaponId, skinMap) {
  const wanted = skinMap?.[weaponId];
  if (!wanted || wanted === 'none') return null;
  return skinById(weaponId, wanted) || null;
}

/** Preview helper: the flagship finish, used by the skin vault thumbnails. */
export function flagshipSkin(weaponId) {
  return defaultSkin(weaponId);
}

/* ------------------------------------------------------------------ */
/* textures                                                            */
/* ------------------------------------------------------------------ */
export function getSkinTexture(uuid) {
  if (!uuid) return null;
  const skin = findSkin(uuid);
  if (!skin) return null;
  if (textureCache.has(uuid)) return textureCache.get(uuid);
  if (!pending.has(uuid)) {
    const p = loadImage(skinImageUrl(skin), { timeout: 10000 })
      .then((img) => {
        if (!img) { textureCache.set(uuid, null); return null; }
        const tex = new THREE.Texture(img);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
        tex.needsUpdate = true;
        tex.userData.aspect = img.naturalWidth / Math.max(1, img.naturalHeight);
        textureCache.set(uuid, tex);
        for (const fn of listeners) fn();
        return tex;
      })
      .catch(() => { textureCache.set(uuid, null); return null; });
    pending.set(uuid, p);
  }
  return textureCache.get(uuid) || null;   // caller treats null as "not ready yet"
}

export function onSkinTexture(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Kick off loading of every skin of one or all weapons (fire and forget). */
export function preloadSkins(weaponIds = null) {
  const ids = weaponIds || Object.keys(WEAPON_SKINS);
  let n = 0;
  for (const w of ids) {
    for (const s of skinList(w)) { getSkinTexture(s.id); n++; }
  }
  return n;
}


/* ------------------------------------------------------------------ */
/* offline palette fallback                                            */
/* ------------------------------------------------------------------ */
/** Recognised skin families → [body, accent, trim] colours. Used to recolour
 *  the procedural gun when the real render cannot be downloaded, so every skin
 *  still reads as a different, coherent paint job. */
const SKIN_PALETTES = [
  { match: /asiimov/i, body: '#e9e7e0', accent: '#f08a1e', trim: '#20242a' },
  { match: /redline/i, body: '#2a2b2f', accent: '#d33a3a', trim: '#efefef' },
  { match: /dragon lore|lore/i, body: '#3e6b3a', accent: '#d8b35a', trim: '#20301e' },
  { match: /hyper beast/i, body: '#1f3f4a', accent: '#ff7a3c', trim: '#7ce8d8' },
  { match: /printstream/i, body: '#f2f2f2', accent: '#1a1a1c', trim: '#b9bec4' },
  { match: /neo-noir/i, body: '#15161a', accent: '#ff3d8a', trim: '#c9c9d2' },
  { match: /fade/i, body: '#f0c24a', accent: '#ff5fb0', trim: '#5a2bbf' },
  { match: /blaze/i, body: '#141414', accent: '#ff6a1e', trim: '#ffd24a' },
  { match: /case hardened|hardened/i, body: '#38508a', accent: '#c8a45c', trim: '#1b2b4d' },
  { match: /doppler/i, body: '#1a1230', accent: '#7a4bff', trim: '#3ce0ff' },
  { match: /tiger tooth/i, body: '#f2e3b8', accent: '#111111', trim: '#e0a93c' },
  { match: /crimson web/i, body: '#1d1013', accent: '#b3122a', trim: '#e8e2e2' },
  { match: /bloodsport/i, body: '#1b1d21', accent: '#d92b2b', trim: '#f0f0f0' },
  { match: /vulcan/i, body: '#e8eaec', accent: '#2b6bd8', trim: '#22262a' },
  { match: /nightwish/i, body: '#101a2c', accent: '#4fc8ff', trim: '#e0b45c' },
  { match: /empress/i, body: '#231b2e', accent: '#c94f6d', trim: '#d9b768' },
  { match: /desolate space/i, body: '#1d2733', accent: '#39c8b4', trim: '#d9d2c2' },
  { match: /wildfire/i, body: '#2a1a10', accent: '#ff7a1a', trim: '#e0c08a' },
  { match: /containment breach/i, body: '#16303a', accent: '#7aff5a', trim: '#243b45' },
  { match: /water elemental|ocean drive|dark water/i, body: '#123a55', accent: '#39c8e8', trim: '#dff4ff' },
  { match: /howl/i, body: '#2b1d12', accent: '#ff5a1e', trim: '#c8a45c' },
  { match: /bullet queen/i, body: '#22141f', accent: '#ff3d9a', trim: '#f0d24a' },
  { match: /neon rider/i, body: '#140f24', accent: '#ff2ea6', trim: '#22e0ff' },
  { match: /starlight/i, body: '#1a1430', accent: '#a06bff', trim: '#ffe9a8' },
  { match: /mecha|cyber|mainframe/i, body: '#20262c', accent: '#2ee0c8', trim: '#cfd6dc' },
  { match: /slaughter/i, body: '#2a0d12', accent: '#e01b32', trim: '#f2f2f2' },
  { match: /marble fade/i, body: '#e8e2ef', accent: '#ff5fa8', trim: '#3ad0c8' },
  { match: /ultraviolet|blue steel/i, body: '#191a20', accent: '#7a5ad8', trim: '#9099a8' },
];

const DEFAULT_PALETTE = { body: '#2b3038', accent: '#ff4655', trim: '#cfd6dc' };

/** Rarity colour → darker body / brighter trim so every finish is distinct. */
function paletteFromRarity(hex) {
  if (!hex || !/^#?[0-9a-f]{6}$/i.test(hex)) return DEFAULT_PALETTE;
  const c = new THREE.Color(hex.startsWith('#') ? hex : `#${hex}`);
  const hsl = {};
  c.getHSL(hsl);
  const body = new THREE.Color().setHSL(hsl.h, Math.min(1, hsl.s * 0.55 + 0.08), Math.max(0.1, hsl.l * 0.34));
  const trim = new THREE.Color().setHSL(hsl.h, Math.min(1, hsl.s * 0.35), Math.min(0.92, hsl.l * 0.92 + 0.24));
  return { body: `#${body.getHexString()}`, accent: `#${c.getHexString()}`, trim: `#${trim.getHexString()}` };
}

/**
 * Every one of the 115 finishes has to read as its own paint job, even when it
 * falls back to the rarity colour. Family palettes keep their identity; the
 * hash only nudges hue / lightness so two Covert reds are never identical.
 */
export function paletteFor(skinOrName) {
  const name = typeof skinOrName === 'string' ? skinOrName : skinOrName?.full || skinOrName?.name;
  const rarity = typeof skinOrName === 'object' ? skinOrName?.color : null;
  const id = typeof skinOrName === 'object' ? skinOrName?.id : null;
  const authored = id ? SKIN_RECIPES[id] : null;
  if (authored) {
    return {
      body: authored.body,
      accent: authored.accent,
      trim: authored.trim,
      family: authored.motif,
      motif: authored.motif,
      recipe: authored,
    };
  }
  if (!name) return DEFAULT_PALETTE;
  const hit = SKIN_PALETTES.find((p) => p.match.test(name));
  const base = hit || paletteFromRarity(rarity) || DEFAULT_PALETTE;
  const k = skinSeed(name);
  const spread = hit ? 9 : 26;                 // family palettes stay recognisable
  const hue = ((k % 41) - 20) / 20 * spread;   // -spread .. +spread degrees
  const lit = (((k >> 6) % 21) - 10) / 10 * 0.07;
  const shift = (hex, dh, dl) => {
    if (!hex || !hex.startsWith('#')) return hex;
    const c = new THREE.Color(hex);
    const hsl = {};
    c.getHSL(hsl);
    c.setHSL((hsl.h + dh / 360 + 1) % 1, hsl.s, Math.min(0.96, Math.max(0.05, hsl.l + dl)));
    return `#${c.getHexString()}`;
  };
  return {
    body: shift(base.body, hue * 0.55, lit),
    accent: shift(base.accent, hue, -lit * 0.5),
    trim: shift(base.trim, -hue * 0.35, lit * 0.6),
    family: hit ? hit.match.source : 'rarity',
    motif: k % 6,
  };
}

/* ------------------------------------------------------------------ */
/* procedural paint jobs (work with zero network)                      */
/* ------------------------------------------------------------------ */
const patternCache = new Map();

/** cheap deterministic hash so each skin family gets its own motif */
function skinSeed(name) {
  let h = 2166136261;
  for (let i = 0; i < (name || '').length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/**
 * Paints a tileable canvas texture for a skin: base colour, family motif and
 * trim. This is what the guns wear when the CDN renders are unavailable, so the
 * weapons still look like painted CS finishes instead of grey boxes.
 */
export function skinPatternTexture(skin) {
  if (!skin) return null;
  const key = `${skin.name}|${skin.id || skin.uuid}`;
  if (patternCache.has(key)) return patternCache.get(key);

  const size = 256;
  let c;
  try {
    c = document.createElement('canvas');
    c.width = size; c.height = size;
  } catch { patternCache.set(key, null); return null; }
  const ctx = c.getContext?.('2d');
  if (!ctx) { patternCache.set(key, null); return null; }

  const pal = paletteFor(skin);
  const seed = skinSeed(skin.full || skin.name);
  const MOTIF_INDEX = {
    hex: 0, racing: 1, flame: 2, glitch: 3, camo: 4, circuit: 0,
    marble: 5, wave: 2, scatter: 4, grid: 1,
  };
  const recipe = SKIN_RECIPES[skin.id];
  const motif = recipe ? (MOTIF_INDEX[recipe.motif] ?? seed % 6) : seed % 6;

  ctx.fillStyle = pal.body;
  ctx.fillRect(0, 0, size, size);

  // soft vertical sheen so flat colours do not look like plastic
  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, 'rgba(255,255,255,0.16)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.02)');
  grad.addColorStop(1, 'rgba(0,0,0,0.30)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = pal.trim;
  ctx.fillStyle = pal.accent;
  ctx.lineWidth = 4;

  if (motif === 0) {
    // hex / tech weave  (Glitchpop, RGX, Ion ...)
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = pal.trim;
    ctx.lineWidth = 2;
    for (let y = 0; y < size + 32; y += 32) {
      for (let x = 0; x < size + 32; x += 36) {
        const ox = (y / 32) % 2 ? 18 : 0;
        ctx.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = (Math.PI / 3) * k;
          const px = x + ox + Math.cos(a) * 17;
          const py = y + Math.sin(a) * 17;
          k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = pal.accent;
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 5; i++) {
      ctx.fillRect(0, 24 + i * 54, size, 3);
    }
    ctx.globalAlpha = 1;
  } else if (motif === 1) {
    // diagonal racing bands (Prime, Sovereign, Aristo ...)
    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.rotate(-Math.PI / 5);
    ctx.globalAlpha = 0.55;
    for (let i = -4; i <= 4; i++) {
      ctx.fillRect(-size, i * 34, size * 2, 9);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = pal.trim;
    for (let i = -4; i <= 4; i++) {
      ctx.fillRect(-size, i * 34 + 11, size * 2, 2);
    }
    ctx.restore();
  } else if (motif === 2) {
    // flame / brush spikes (Elderflame, Ruination ...)
    ctx.globalAlpha = 0.6;
    for (let i = 0; i < 26; i++) {
      const x = (i * 41 + seed % 37) % size;
      const h = 40 + ((i * 53 + seed) % 110);
      ctx.beginPath();
      ctx.moveTo(x, size);
      ctx.quadraticCurveTo(x + 22, size - h * 0.55, x + 10, size - h);
      ctx.quadraticCurveTo(x - 14, size - h * 0.5, x, size);
      ctx.fillStyle = i % 3 ? pal.accent : pal.trim;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  } else if (motif === 3) {
    // pixel glitch (Glitchpop, Spectrum ...)
    for (let i = 0; i < 70; i++) {
      const w = 6 + ((seed + i * 97) % 44);
      const h = 3 + ((seed + i * 31) % 9);
      ctx.fillStyle = i % 2 ? pal.accent : pal.trim;
      ctx.globalAlpha = 0.25 + ((i % 5) * 0.12);
      ctx.fillRect((i * 61 + seed) % size, (i * 37 + seed) % size, w, h);
    }
    ctx.globalAlpha = 1;
  } else if (motif === 4) {
    // camo blobs (Forsaken, Xenohunter, Reeve ...)
    for (let i = 0; i < 30; i++) {
      const x = (i * 71 + seed) % size;
      const y = (i * 113 + seed * 3) % size;
      ctx.beginPath();
      ctx.ellipse(x, y, 18 + (i % 4) * 9, 10 + (i % 3) * 8, (i * 0.7) % Math.PI, 0, Math.PI * 2);
      ctx.fillStyle = i % 2 ? pal.accent : pal.trim;
      ctx.globalAlpha = 0.28;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  } else {
    // oni wave / magepunk circuitry
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 5;
    ctx.strokeStyle = pal.accent;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      for (let x = 0; x <= size; x += 8) {
        const y = size * 0.5 + Math.sin(x * 0.045 + i * 0.9 + seed * 0.001) * 46 + i * 6;
        x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = pal.trim;
    ctx.fillRect(0, 0, size, 6);
    ctx.fillRect(0, size - 6, size, 6);
  }

  // metallic edge shading top / bottom
  const edge = ctx.createLinearGradient(0, 0, 0, 12);
  edge.addColorStop(0, 'rgba(0,0,0,0.55)');
  edge.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, size, 12);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  patternCache.set(key, tex);
  return tex;
}

/** Recolour a gun model with the skin palette and its painted pattern. */
export function applySkinPalette(model, skin, strength = 0.85) {
  if (!model || !skin) return;
  const pal = paletteFor(skin.name);
  const accent = new THREE.Color(pal.accent);
  const trim = new THREE.Color(pal.trim);
  const pattern = skinPatternTexture(skin);
  let i = 0;
  model.traverse((o) => {
    if (!o.isMesh || o.userData.cvSkinDecalMesh) return;
    if (!o.userData.cvOrigMat) {
      o.userData.cvOrigMat = o.material;
      o.material = Array.isArray(o.material) ? o.material.map((m) => m.clone()) : o.material.clone();
      const arr = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of arr) m.userData = { ...(m.userData || {}), cvPaletteTarget: true };
    }
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const wantMap = !o.userData.cvSkipSkinMap && pattern;
    for (const mat of mats) {
      if (!mat) continue;
      const isAccent = i % 5 === 0;
      if (mat.color) {
        if (wantMap) {
          // the canvas already carries the colours; the per-mesh tint keeps
          // receiver / grip / barrel visually distinct instead of one flat wash
          const shade = isAccent ? 1.06 : (i % 3 === 0 ? 0.84 : 1.0);
          mat.color.setRGB(1, 1, 1).multiplyScalar(shade)
            .lerp(isAccent ? accent : trim, isAccent ? 0.22 : 0.06);
        } else {
          const target = isAccent ? accent : (i % 3 === 0 ? trim : new THREE.Color(pal.body));
          const orig = new THREE.Color(o.userData.cvOrigMat?.color || 0xffffff);
          mat.color.copy(orig.clone().lerp(target, strength));
        }
      }
      if (wantMap && !mat.map) {
        // tighter weave on the small parts, broad pattern on the receiver
        const t = i % 4 === 0 ? pattern.clone() : pattern;
        if (t !== pattern) {
          t.needsUpdate = true;
          t.repeat.set(1.6, 1.6);
        }
        mat.map = t;
        mat.needsUpdate = true;
      }
      if ('metalness' in mat) mat.metalness = Math.min(1, (mat.metalness ?? 0.4) + 0.22);
      if ('roughness' in mat) mat.roughness = Math.max(0.2, (mat.roughness ?? 0.6) - 0.14);
      if (mat.emissive) {
        mat.emissive.copy(isAccent ? accent : new THREE.Color(0x000000));
        mat.emissiveIntensity = isAccent ? 1.15 : 0;
      }
    }
    i++;
  });
}

/* ------------------------------------------------------------------ */
/* decal projection                                                    */
/* ------------------------------------------------------------------ */
function clearDecals(model) {
  const old = model.userData[DECAL_FLAG];
  if (!old) return;
  for (const node of old) {
    node.traverse?.((o) => {
      if (o.isMesh) o.geometry?.dispose();
    });
    node.parent?.remove(node);
  }
  model.userData[DECAL_FLAG] = null;
}

/**
 * Stick the flat skin render on both flanks of a gun.
 * The art is scaled to the weapon's own bounding box so the silhouette lines up
 * with the barrel / stock / magazine of the procedural model.
 */
export function applySkinDecal(model, skin, { opacity = 1, texture = null } = {}) {
  if (!model || !skin) return false;
  const tex = texture || getSkinTexture(skin.id || skin.uuid);
  if (!tex) return false;
  clearDecals(model);

  // The box must be measured with the model's own transform removed, otherwise
  // the viewmodel scale (0.9x) shrinks the offsets and buries the artwork
  // inside the receiver — which is exactly why skins used to be invisible.
  const probe = model.clone(true);
  probe.position.set(0, 0, 0);
  probe.quaternion.identity();
  probe.scale.setScalar(1);
  probe.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(probe);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  if (!(size.z > 0.05) || !(size.y > 0.02)) return false;

  const aspect = tex.userData?.aspect || 3.2;
  const art = new THREE.Group();
  art.userData.cvSkinDecal = true;
  let h = size.y * 0.9;
  let w = h * aspect;
  if (w > size.z * 1.02) { w = size.z * 1.02; h = w / aspect; }

  const geo = new THREE.PlaneGeometry(w, h);
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    transparent: true,
    alphaTest: 0.05,
    opacity,
    roughness: 0.4,
    metalness: 0.3,
    emissive: new THREE.Color(0xffffff),
    emissiveMap: tex,
    emissiveIntensity: 0.16,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  });

  const clearance = size.x * 0.04 + 0.006;   // sit just proud of the flank
  const meshes = [];
  for (const side of [1, -1]) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(center.x + side * (size.x / 2 + clearance), center.y, center.z);
    m.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
    if (side < 0) m.scale.x = -1;   // mirror on the far flank
    m.renderOrder = 6;
    m.userData.cvSkinDecalMesh = true;
    art.add(m);
    meshes.push(m);
  }

  // a painted spine along the top so the skin reads from every angle
  const spine = new THREE.Mesh(
    new THREE.PlaneGeometry(Math.max(size.x * 0.5, 0.02), w * 0.96),
    mat,
  );
  spine.rotation.x = -Math.PI / 2;
  spine.position.set(center.x, box.max.y + 0.004, center.z);
  spine.renderOrder = 6;
  spine.userData.cvSkinDecalMesh = true;
  art.add(spine);

  model.add(art);
  model.userData[DECAL_FLAG] = [art];
  return true;
}

/**
 * Apply the correct skin to a freshly built weapon model and make sure it is
 * refreshed once the texture finishes downloading.
 */
export function decorateWeaponModel(model, weaponId, skinMap) {
  if (!model) return;
  const skin = resolveSkin(weaponId, skinMap);
  if (!skin) return;
  model.userData.cvSkinWeaponId = weaponId;
  model.userData.cvSkinMap = skinMap;
  // 1) palette paint job — instant, works offline
  applySkinPalette(model, skin);
  // 2) authentic render on the flanks — arrives asynchronously
  if (!applySkinDecal(model, skin)) {
    const off = onSkinTexture(() => {
      if (!model.parent) { off(); return; }
      if (applySkinDecal(model, skin)) off();
    });
  }
}

export function refreshWeaponModel(model) {
  const weaponId = model?.userData?.cvSkinWeaponId;
  if (!weaponId) return;
  decorateWeaponModel(model, weaponId, model.userData.cvSkinMap);
}

export function skinsOnline() {
  return cdnStatus() === 'online';
}

/* ------------------------------------------------------------------ */
/* generic art textures (posters, banners, wall art)                   */
/* ------------------------------------------------------------------ */
const artTextures = new Map();

/** Load any remote artwork as a THREE texture (null when unavailable). */
export function getArtTexture(url, { timeout = 12000 } = {}) {
  if (!url) return null;
  if (artTextures.has(url)) return artTextures.get(url);
  loadImage(url, { timeout }).then((img) => {
    if (!img) { artTextures.set(url, null); return; }
    const tex = new THREE.Texture(img);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    tex.needsUpdate = true;
    artTextures.set(url, tex);
    for (const fn of listeners) fn();
  }).catch(() => artTextures.set(url, null));
  return artTextures.get(url) || null;
}

/** Wait for a list of urls, then run the callback once they are in cache. */
export function whenArtReady(urls, cb) {
  Promise.all(urls.map((u) => loadImage(u))).then((imgs) => {
    if (imgs.some(Boolean)) cb();
  });
}


/* ------------------------------------------------------------------ */
/* float / wear + StatTrak                                            */
/* ------------------------------------------------------------------ */

const WEAR_BANDS = [
  [0.00, 'FACTORY NEW', 'FN'],
  [0.07, 'MINIMAL WEAR', 'MW'],
  [0.15, 'FIELD-TESTED', 'FT'],
  [0.38, 'WELL-WORN', 'WW'],
  [0.45, 'BATTLE-SCARED', 'BS'],
];

/** Deterministic 0..1 float for a finish, in the same spirit as CS item floats. */
export function skinFloat(skin) {
  if (!skin) return 0;
  let h = 2166136261;
  const key = `${skin.id || ''}|${skin.full || skin.name || ''}`;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // bias towards the middle of the range: most drops are not perfect
  const r = ((h >>> 0) % 10000) / 10000;
  const biased = Math.pow(r, 0.7) * 0.62 + 0.01;
  return Math.round(biased * 10000) / 10000;
}

export function wearLabel(float) {
  const f = Math.max(0, Math.min(1, float ?? 0));
  for (let i = WEAR_BANDS.length - 1; i >= 0; i--) {
    if (f >= WEAR_BANDS[i][0]) return { label: WEAR_BANDS[i][1], short: WEAR_BANDS[i][2] };
  }
  return { label: WEAR_BANDS[0][1], short: WEAR_BANDS[0][2] };
}

/** StatTrak-style kill counter key used by the profile. */
export function statTrakKey(skin) {
  return skin?.id || skin?.uuid || null;
}
