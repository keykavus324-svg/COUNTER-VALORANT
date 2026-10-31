/**
 * Weapon skin system.
 *
 * Real Valorant skin renders (transparent PNGs from media.valorant-api.com) are
 * projected onto the flanks of every gun model — first person viewmodel, the
 * third person models of the bots and the buy menu / vault thumbnails. If the
 * CDN is unreachable the models simply keep their procedural materials.
 */
import * as THREE from 'three';
import { WEAPON_SKINS, skinIconUrl, agentArtUrl, loadImage, cdnStatus } from './valoAssets.js';

const textureCache = new Map();   // uuid -> THREE.Texture | null (failed)
const pending = new Map();        // uuid -> Promise<THREE.Texture|null>
/** every live model that wants a skin, so late textures can be applied */
const listeners = new Set();

const DECAL_FLAG = 'cvSkinDecal';

export function skinList(weaponId) {
  return WEAPON_SKINS[weaponId] || [];
}

export function skinById(weaponId, uuid) {
  return skinList(weaponId).find((s) => s.uuid === uuid) || null;
}

export function defaultSkin(weaponId) {
  // the first entry of every list is the flagship skin of that weapon
  return skinList(weaponId)[0] || null;
}

/** Resolve the skin a weapon should currently use. */
export function resolveSkin(weaponId, skinMap) {
  const wanted = skinMap?.[weaponId];
  if (wanted === 'none') return null;
  if (wanted) {
    const found = skinById(weaponId, wanted);
    if (found) return found;
  }
  return defaultSkin(weaponId);
}

/* ------------------------------------------------------------------ */
/* textures                                                            */
/* ------------------------------------------------------------------ */
export function getSkinTexture(uuid) {
  if (!uuid) return null;
  if (textureCache.has(uuid)) return textureCache.get(uuid);
  if (!pending.has(uuid)) {
    const p = loadImage(skinIconUrl(uuid), { timeout: 12000 })
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
    for (const s of skinList(w)) { getSkinTexture(s.uuid); n++; }
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
  { match: /prime/i, body: '#f0ece2', accent: '#d9b768', trim: '#1d2530' },
  { match: /reaver/i, body: '#231a2e', accent: '#8b45ff', trim: '#0d0a12' },
  { match: /glitchpop/i, body: '#141018', accent: '#ff2f9e', trim: '#22e0ff' },
  { match: /elderflame/i, body: '#1b1a1f', accent: '#ff7a1a', trim: '#ffd24a' },
  { match: /gaia/i, body: '#1d3524', accent: '#7ce07a', trim: '#f2e6c9' },
  { match: /oni/i, body: '#1a1a20', accent: '#c8202c', trim: '#e9dcc4' },
  { match: /spectrum/i, body: '#101014', accent: '#ff2e88', trim: '#3ce0ff' },
  { match: /magepunk/i, body: '#1b2a3a', accent: '#38e0ff', trim: '#c9a35a' },
  { match: /sovereign/i, body: '#e6e2da', accent: '#4a8bd8', trim: '#c9a35a' },
  { match: /ruination/i, body: '#16241a', accent: '#5ce07a', trim: '#d8c78a' },
  { match: /sentinels/i, body: '#12121a', accent: '#c9a3ff', trim: '#ffffff' },
  { match: /ion/i, body: '#0f1620', accent: '#4fd8ff', trim: '#e8f6ff' },
  { match: /spline/i, body: '#1a1a24', accent: '#8a7bff', trim: '#3be0c0' },
  { match: /origin/i, body: '#101010', accent: '#ff5a2a', trim: '#8f8f96' },
  { match: /champions/i, body: '#141418', accent: '#ffd24a', trim: '#c0c6cc' },
  { match: /prelude|chaos/i, body: '#181014', accent: '#ff2f3e', trim: '#7a1fff' },
  { match: /forsaken/i, body: '#1b2430', accent: '#6fd6c6', trim: '#d9c48a' },
  { match: /xenohunter/i, body: '#151a16', accent: '#b6ff3c', trim: '#2b3a2b' },
  { match: /rgx/i, body: '#0d0f14', accent: '#ff2f6e', trim: '#ffd24a' },
  { match: /piedra|sol/i, body: '#2a1d16', accent: '#e8a13a', trim: '#7ac0b0' },
  { match: /neptune/i, body: '#0f2a33', accent: '#31e0d0', trim: '#f0f4f5' },
  { match: /endeavour/i, body: '#1c1f26', accent: '#ff8a3d', trim: '#dfe6ec' },
  { match: /aristo/i, body: '#241a2c', accent: '#d9b768', trim: '#7a2bff' },
];
const DEFAULT_PALETTE = { body: '#2b3038', accent: '#ff4655', trim: '#cfd6dc' };

export function paletteFor(skinName) {
  if (!skinName) return DEFAULT_PALETTE;
  const hit = SKIN_PALETTES.find((p) => p.match.test(skinName));
  return hit || DEFAULT_PALETTE;
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
 * weapons still look like painted Valorant skins instead of grey boxes.
 */
export function skinPatternTexture(skin) {
  if (!skin) return null;
  const key = `${skin.name}|${skin.uuid}`;
  if (patternCache.has(key)) return patternCache.get(key);

  const size = 256;
  let c;
  try {
    c = document.createElement('canvas');
    c.width = size; c.height = size;
  } catch { patternCache.set(key, null); return null; }
  const ctx = c.getContext?.('2d');
  if (!ctx) { patternCache.set(key, null); return null; }

  const pal = paletteFor(skin.name);
  const seed = skinSeed(skin.name);
  const motif = seed % 6;

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
  const tex = texture || getSkinTexture(skin.uuid);
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

/** Load any Valorant artwork as a THREE texture (null when unavailable). */
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

export { agentArtUrl };
