/**
 * Real Counter-Strike asset plumbing.
 *
 *  • SKINS       — the official finishes of every classic weapon (names,
 *                  rarity colours and Valve's own render URLs).
 *  • MAP_ART     — the official CS2 radars of the playable arenas.
 *  • loadImage   — one shared loader with a deadline, so a blocked CDN can
 *                  never stall the game; everything degrades gracefully.
 */
import { SKINS } from './csgoSkins.js';
import { MAPS } from '../world/mapLayout.js';

export const WEAPON_SKINS = SKINS;
export { MAPS };

export const MAP_ART = MAPS.map((m) => ({
  id: m.id,
  name: m.name,
  desc: m.theme.toUpperCase(),
  radar: m.radar,
  sites: m.sites,
}));

/** Valve's economy-image CDN render of a finish. */
export const skinImageUrl = (skin) => (typeof skin === 'string' ? skin : skin?.image || '');

/* ------------------------------------------------------------------ */
/* image loading                                                      */
/* ------------------------------------------------------------------ */
const imageCache = new Map();
let cdnState = 'unknown';

export function loadImage(url, { timeout = 9000, crossCache = false } = {}) {
  if (!url) return Promise.resolve(null);
  const key = crossCache ? `x:${url}` : url;
  if (imageCache.has(key)) return imageCache.get(key);
  const p = new Promise((resolve) => {
    if (typeof Image === 'undefined') { resolve(null); return; }
    let done = false;
    const img = new Image();
    const finish = (val) => {
      if (done) return;
      done = true;
      resolve(val);
    };
    const timer = setTimeout(() => finish(null), timeout);
    img.onload = () => { clearTimeout(timer); finish(img); };
    img.onerror = () => { clearTimeout(timer); finish(null); };
    try {
      img.crossOrigin = 'anonymous';
      img.src = url;
    } catch {
      clearTimeout(timer);
      finish(null);
    }
  });
  imageCache.set(key, p);
  return p;
}

export function loadImagePlain(url, opts) {
  return loadImage(url, { ...opts, crossCache: true });
}

/** Probe the CDN once; used for the "online / offline" badge in the vault. */
export function detectCdn() {
  if (cdnState !== 'unknown') return Promise.resolve(cdnState);
  const probe = Object.values(SKINS)[0]?.[0]?.image;
  if (!probe) { cdnState = 'offline'; return Promise.resolve(cdnState); }
  return loadImage(probe, { timeout: 4500 }).then((img) => {
    cdnState = img ? 'online' : 'offline';
    return cdnState;
  });
}

export const cdnStatus = () => cdnState;
