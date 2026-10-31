/**
 * Local skin thumbnails.
 *
 * Every finish gets its own painted preview rendered from the same palette and
 * pattern generator the 3D guns use, so the vault never falls back to ten
 * identical grey silhouettes when Valve's CDN renders cannot be fetched.
 */
import { WEAPON_SHAPE, WEAPON_SVG_SHAPES } from '../game/weapons.js';
import { paletteFor, skinPatternTexture } from '../game/skins.js';

const cache = new Map();

function shapeSVG(weaponId) {
  const key = WEAPON_SHAPE[weaponId] || 'vandal';
  return WEAPON_SVG_SHAPES[key] || WEAPON_SVG_SHAPES.vandal || '';
}

function svgDataURL(weaponId, { stroke = '#ffffff', fill = '#ffffff' } = {}) {
  const body = shapeSVG(weaponId);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 48">`
    + `<g fill="${fill}" stroke="${stroke}" stroke-width="0.6">${body}</g></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * Paint one skin card image.
 * @returns {Promise<string|null>} data-url, or null when canvas is unavailable
 */
export function skinThumbnail(skin, weaponId, { width = 300, height = 168 } = {}) {
  if (!skin) return Promise.resolve(null);
  const key = `${weaponId}:${skin.id || skin.full}`;
  if (cache.has(key)) return Promise.resolve(cache.get(key));

  let canvas;
  let ctx;
  try {
    canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    ctx = canvas.getContext('2d');
  } catch { return Promise.resolve(null); }
  if (!ctx) return Promise.resolve(null);

  const pal = paletteFor(skin);
  const rarity = skin.color || pal.accent;

  // backdrop: rarity tint fading into black, plus a floor reflection
  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, 'rgba(255,255,255,0.05)');
  bg.addColorStop(0.55, 'rgba(0,0,0,0.25)');
  bg.addColorStop(1, 'rgba(0,0,0,0.65)');
  ctx.fillStyle = pal.body;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(width * 0.5, height * 0.45, 4, width * 0.5, height * 0.45, width * 0.62);
  glow.addColorStop(0, `${rarity}55`);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      // gun body: pattern texture clipped to the silhouette
      const body = document.createElement('canvas');
      body.width = width;
      body.height = height;
      const bctx = body.getContext('2d');
      if (!bctx) return resolve(null);
      const pad = 18;
      const scale = Math.min((width - pad * 2) / 120, (height - pad * 2) / 48) * 1.05;
      const ox = (width - 120 * scale) / 2;
      const oy = (height - 48 * scale) / 2;
      bctx.drawImage(img, ox, oy, 120 * scale, 48 * scale);
      bctx.globalCompositeOperation = 'source-in';
      const pat = skinPatternTexture(skin);
      if (pat) {
        const fill = bctx.createPattern(pat, 'repeat');
        bctx.save();
        bctx.translate(ox, oy);
        bctx.scale(scale * 0.5, scale * 0.5);
        bctx.fillStyle = fill || pal.body;
        bctx.fillRect(-40, -40, 400, 260);
        bctx.restore();
      } else {
        bctx.fillStyle = pal.body;
        bctx.fillRect(0, 0, width, height);
      }
      // subtle top light + accent trim line
      const sheen = bctx.createLinearGradient(0, oy, 0, oy + 48 * scale);
      sheen.addColorStop(0, 'rgba(255,255,255,0.28)');
      sheen.addColorStop(0.4, 'rgba(255,255,255,0.02)');
      sheen.addColorStop(1, 'rgba(0,0,0,0.35)');
      bctx.fillStyle = sheen;
      bctx.fillRect(0, 0, width, height);

      // faint reflection under the gun
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.translate(0, height * 1.06);
      ctx.scale(1, -1);
      ctx.drawImage(body, 0, 0);
      ctx.restore();

      ctx.drawImage(body, 0, 0);

      // rarity bar in the corner
      ctx.fillStyle = rarity;
      ctx.fillRect(0, height - 5, width, 5);

      let out = null;
      try { out = canvas.toDataURL('image/png'); } catch { out = null; }
      if (out) cache.set(key, out);
      resolve(out);
    };
    img.onerror = () => resolve(null);
    img.src = svgDataURL(weaponId, { fill: '#ffffff', stroke: '#ffffff' });
  });
}

/** Clear cached thumbnails (used by the dev tools). */
export function clearThumbnailCache() {
  cache.clear();
}
