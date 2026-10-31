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

/** Recolour a gun model with the skin palette (no texture needed). */
export function applySkinPalette(model, skin, strength = 0.85) {
  if (!model || !skin) return;
  const pal = paletteFor(skin.name);
  const body = new THREE.Color(pal.body);
  const accent = new THREE.Color(pal.accent);
  const trim = new THREE.Color(pal.trim);
  let i = 0;
  model.traverse((o) => {
    if (!o.isMesh || o.userData.cvSkinDecalMesh) return;
    if (!o.userData.cvOrigMat) {
      o.userData.cvOrigMat = o.material;
      o.material = o.material.clone();
      o.material.userData = { ...(o.material.userData || {}), cvPaletteTarget: true };
    }
    const mat = o.material;
    if (!mat || !mat.color) return;
    const target = i % 5 === 0 ? accent : (i % 3 === 0 ? trim : body);
    const orig = new THREE.Color(o.userData.cvOrigMat.color || 0xffffff);
    const blended = orig.clone().lerp(target, strength);
    mat.color.copy(blended);
    if ('metalness' in mat) mat.metalness = Math.min(1, (mat.metalness ?? 0.4) + 0.15);
    if ('roughness' in mat) mat.roughness = Math.max(0.18, (mat.roughness ?? 0.6) - 0.12);
    if (mat.emissive) {
      const isAccent = i % 5 === 0;
      mat.emissive.copy(isAccent ? accent : new THREE.Color(0x000000));
      mat.emissiveIntensity = isAccent ? 0.55 : 0;
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
  for (const mesh of old) {
    mesh.parent?.remove(mesh);
    mesh.geometry?.dispose();
  }
  model.userData[DECAL_FLAG] = null;
}

/**
 * Stick the flat skin render on both flanks of a gun.
 * The art is scaled to the weapon's own bounding box so the silhouette lines up
 * with the barrel / stock / magazine of the procedural model.
 */
export function applySkinDecal(model, skin, { opacity = 1 } = {}) {
  if (!model || !skin) return false;
  const tex = getSkinTexture(skin.uuid);
  if (!tex) return false;
  clearDecals(model);

  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  if (!Number.isFinite(size.z) || size.z <= 0 || size.y <= 0) return false;

  const aspect = tex.userData.aspect || 3.2;
  // fit inside the gun's silhouette
  let h = size.y * 0.94;
  let w = h * aspect;
  if (w > size.z * 1.04) { w = size.z * 1.04; h = w / aspect; }

  const geo = new THREE.PlaneGeometry(w, h);
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    transparent: true,
    alphaTest: 0.06,
    opacity,
    roughness: 0.45,
    metalness: 0.25,
    emissive: new THREE.Color(0xffffff),
    emissiveMap: tex,
    emissiveIntensity: 0.12,
    side: THREE.FrontSide,
    depthWrite: true,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });

  const meshes = [];
  for (const side of [1, -1]) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(center.x + side * (size.x / 2 + 0.004), center.y, center.z);
    m.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
    // the source art faces left; mirror it on the far flank so both sides read
    if (side < 0) m.scale.x = -1;
    m.renderOrder = 6;
    m.matrixAutoUpdate = true;
    model.add(m);
    meshes.push(m);
  }
  model.userData[DECAL_FLAG] = meshes;
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
