import * as THREE from 'three';
import { seededRandom } from '../core/utils.js';

/**
 * Every surface texture in the game is painted procedurally on a <canvas>,
 * so the whole project runs from a single JS bundle with zero asset downloads.
 */
const cache = new Map();

function makeCanvas(size = 512) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  return c;
}

function toTexture(canvas, repeat = 1, { srgb = true } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

function grain(ctx, size, rng, amount = 0.07, dark = true) {
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rng() - 0.5) * 255 * amount;
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);
  if (dark) {
    for (let i = 0; i < 26; i++) {
      const x = rng() * size;
      const y = rng() * size;
      const r = 10 + rng() * 70;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(0,0,0,${0.03 + rng() * 0.05})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }
}

/** Large concrete panels with bevels — the classic tactical-shooter wall. */
export function wallPanel(base = '#b9b2a4', accent = '#9a9284', seed = 7) {
  const key = `wall-${base}-${accent}-${seed}`;
  if (cache.has(key)) return cache.get(key);
  const size = 512;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const rng = seededRandom(seed);

  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  // soft vertical light gradient
  const vg = ctx.createLinearGradient(0, 0, 0, size);
  vg.addColorStop(0, 'rgba(255,255,255,.09)');
  vg.addColorStop(0.5, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,.20)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, size, size);

  // panels
  const cols = 2;
  const rows = 3;
  const pad = 7;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const w = size / cols;
      const h = size / rows;
      ctx.fillStyle = accent;
      ctx.globalAlpha = 0.35 + rng() * 0.4;
      ctx.fillRect(x * w + pad, y * h + pad, w - pad * 2, h - pad * 2);
      ctx.globalAlpha = 1;
      // highlight + shadow bevel
      ctx.strokeStyle = 'rgba(255,255,255,.16)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x * w + pad, y * h + h - pad);
      ctx.lineTo(x * w + pad, y * h + pad);
      ctx.lineTo(x * w + w - pad, y * h + pad);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,.34)';
      ctx.beginPath();
      ctx.moveTo(x * w + w - pad, y * h + pad);
      ctx.lineTo(x * w + w - pad, y * h + h - pad);
      ctx.lineTo(x * w + pad, y * h + h - pad);
      ctx.stroke();
    }
  }

  // stains
  for (let i = 0; i < 12; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const r = 20 + rng() * 90;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(60,52,42,${0.05 + rng() * 0.09})`);
    g.addColorStop(1, 'rgba(60,52,42,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  grain(ctx, size, rng, 0.075);

  const t = toTexture(c, 1);
  cache.set(key, t);
  return t;
}

export function floorTiles(base = '#a7a08f', seed = 21) {
  const key = `floor-${base}-${seed}`;
  if (cache.has(key)) return cache.get(key);
  const size = 512;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const rng = seededRandom(seed);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  const n = 4;
  const s = size / n;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const shade = 0.86 + rng() * 0.24;
      ctx.fillStyle = `rgba(${Math.floor(255 * shade)},${Math.floor(250 * shade)},${Math.floor(236 * shade)},.5)`;
      ctx.fillRect(x * s + 2, y * s + 2, s - 4, s - 4);
      if (rng() > 0.72) {
        ctx.fillStyle = 'rgba(0,0,0,.08)';
        ctx.fillRect(x * s + 6, y * s + 6, s - 12, s - 12);
      }
    }
  }
  ctx.strokeStyle = 'rgba(30,26,20,.35)';
  ctx.lineWidth = 3;
  for (let i = 0; i <= n; i++) {
    ctx.beginPath(); ctx.moveTo(i * s, 0); ctx.lineTo(i * s, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i * s); ctx.lineTo(size, i * s); ctx.stroke();
  }
  grain(ctx, size, rng, 0.06);
  const t = toTexture(c, 1);
  cache.set(key, t);
  return t;
}

export function sandGround(seed = 5, base = '#c8b28d', tint = [150, 130, 95]) {
  const key = `sand-${seed}-${base}-${tint.join('_')}`;
  if (cache.has(key)) return cache.get(key);
  const size = 512;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const rng = seededRandom(seed);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 900; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const r = 1 + rng() * 5;
    ctx.fillStyle = `rgba(${tint[0] + rng() * 70},${tint[1] + rng() * 60},${tint[2] + rng() * 50},${0.12 + rng() * 0.2})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // wind ripples
  ctx.strokeStyle = 'rgba(255,245,220,.1)';
  for (let i = 0; i < 40; i++) {
    ctx.lineWidth = 1 + rng() * 2;
    ctx.beginPath();
    const y = rng() * size;
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(size * 0.3, y + 12, size * 0.6, y - 12, size, y + 5);
    ctx.stroke();
  }
  grain(ctx, size, rng, 0.05, false);
  const t = toTexture(c, 1);
  cache.set(key, t);
  return t;
}

export function crateTexture(seed = 11, base = '#8a6a45') {
  const key = `crate-${seed}-${base}`;
  if (cache.has(key)) return cache.get(key);
  const size = 256;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const rng = seededRandom(seed);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 8; i++) {
    const y = (i * size) / 8;
    ctx.fillStyle = `rgba(${100 + rng() * 40},${74 + rng() * 30},${45 + rng() * 20},.9)`;
    ctx.fillRect(0, y + 2, size, size / 8 - 4);
    ctx.strokeStyle = 'rgba(0,0,0,.3)';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, y + 2, size, size / 8 - 4);
  }
  // metal corners
  ctx.fillStyle = '#6d7378';
  const cs = 26;
  ctx.fillRect(0, 0, cs, cs);
  ctx.fillRect(size - cs, 0, cs, cs);
  ctx.fillRect(0, size - cs, cs, cs);
  ctx.fillRect(size - cs, size - cs, cs, cs);
  ctx.strokeStyle = 'rgba(255,255,255,.2)';
  ctx.strokeRect(3, 3, cs - 6, cs - 6);
  grain(ctx, size, rng, 0.08);
  const t = toTexture(c, 1);
  cache.set(key, t);
  return t;
}

export function metalPanel(seed = 3) {
  const key = `metal-${seed}`;
  if (cache.has(key)) return cache.get(key);
  const size = 256;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const rng = seededRandom(seed);
  ctx.fillStyle = '#59626a';
  ctx.fillRect(0, 0, size, size);
  const g = ctx.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, 'rgba(255,255,255,.16)');
  g.addColorStop(0.45, 'rgba(255,255,255,0)');
  g.addColorStop(1, 'rgba(0,0,0,.25)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  // rivets
  ctx.fillStyle = 'rgba(220,220,220,.5)';
  for (let x = 12; x < size; x += 32) {
    for (let y = 12; y < size; y += 32) {
      ctx.beginPath();
      ctx.arc(x, y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // diagonal hazard stripes bottom
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.translate(0, size * 0.8);
  for (let i = -size; i < size; i += 34) {
    ctx.fillStyle = '#d8b23c';
    ctx.beginPath();
    ctx.moveTo(i, 0); ctx.lineTo(i + 18, 0); ctx.lineTo(i + 18 + 22, size * 0.2); ctx.lineTo(i + 22, size * 0.2);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  grain(ctx, size, rng, 0.07);
  const t = toTexture(c, 1);
  cache.set(key, t);
  return t;
}

export function fabric(color = '#2f6d8f', seed = 13) {
  const key = `fabric-${color}-${seed}`;
  if (cache.has(key)) return cache.get(key);
  const size = 128;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const rng = seededRandom(seed);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, size, size);
  ctx.globalAlpha = 0.12;
  for (let i = 0; i < size; i += 3) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(i, 0, 1, size);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, i, size, 1);
  }
  ctx.globalAlpha = 1;
  grain(ctx, size, rng, 0.05, false);
  const t = toTexture(c, 1);
  cache.set(key, t);
  return t;
}

/** Big painted site letter (A / B) for the bomb sites. */
export function siteDecalTexture(letter = 'A', color = '#d9443f') {
  const key = `site-${letter}-${color}`;
  if (cache.has(key)) return cache.get(key);
  const size = 512;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = 16;
  ctx.beginPath();
  ctx.arc(0, 0, 190, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(0, 0, 214, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = color;
  ctx.font = 'bold 250px Impact, Arial Black, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(letter, 6, 12);
  ctx.restore();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  cache.set(key, t);
  return t;
}

export function skyTexture(stops = null) {
  const key = stops ? `sky-${stops.join('')}` : 'sky';
  if (cache.has(key)) return cache.get(key);
  const w = 1024;
  const h = 512;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, h);
  const st = stops || ['#20364a', '#4a6a80', '#a8a191', '#e3c9a1', '#d8b38a', '#8f7f6f'];
  g.addColorStop(0, st[0]);
  g.addColorStop(0.28, st[1]);
  g.addColorStop(0.52, st[2]);
  g.addColorStop(0.62, st[3]);
  g.addColorStop(0.7, st[4]);
  g.addColorStop(1, st[5]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // sun glow
  const sg = ctx.createRadialGradient(w * 0.7, h * 0.46, 0, w * 0.7, h * 0.46, w * 0.34);
  sg.addColorStop(0, 'rgba(255,236,196,.95)');
  sg.addColorStop(0.25, 'rgba(255,214,160,.35)');
  sg.addColorStop(1, 'rgba(255,200,140,0)');
  ctx.fillStyle = sg;
  ctx.fillRect(0, 0, w, h);
  // soft clouds
  const rng = seededRandom(99);
  for (let i = 0; i < 70; i++) {
    const x = rng() * w;
    const y = h * (0.1 + rng() * 0.36);
    const rx = 40 + rng() * 180;
    const ry = 8 + rng() * 26;
    const cg = ctx.createRadialGradient(x, y, 0, x, y, rx);
    cg.addColorStop(0, `rgba(255,248,236,${0.06 + rng() * 0.12})`);
    cg.addColorStop(1, 'rgba(255,248,236,0)');
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, ry / rx);
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.mapping = THREE.EquirectangularReflectionMapping;
  t.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, t);
  return t;
}

/** Soft radial sprite used for smoke, flashes, glows. */
export function glowTexture(color = '255,255,255', hardness = 0.15) {
  const key = `glow-${color}-${hardness}`;
  if (cache.has(key)) return cache.get(key);
  const size = 128;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, size * hardness, size / 2, size / 2, size / 2);
  g.addColorStop(0, `rgba(${color},1)`);
  g.addColorStop(0.4, `rgba(${color},.55)`);
  g.addColorStop(1, `rgba(${color},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, t);
  return t;
}

export function smokePuffTexture() {
  if (cache.has('smoke')) return cache.get('smoke');
  const size = 256;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const rng = seededRandom(42);
  for (let i = 0; i < 46; i++) {
    const x = size / 2 + (rng() - 0.5) * size * 0.62;
    const y = size / 2 + (rng() - 0.5) * size * 0.62;
    const r = 18 + rng() * 60;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const a = 0.10 + rng() * 0.16;
    g.addColorStop(0, `rgba(240,242,242,${a})`);
    g.addColorStop(0.6, `rgba(215,220,222,${a * 0.6})`);
    g.addColorStop(1, 'rgba(200,205,208,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  cache.set('smoke', t);
  return t;
}

export function bulletHoleTexture() {
  if (cache.has('hole')) return cache.get('hole');
  const size = 64;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 26);
  g.addColorStop(0, 'rgba(8,6,5,.95)');
  g.addColorStop(0.45, 'rgba(20,16,12,.7)');
  g.addColorStop(1, 'rgba(30,24,18,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(0,0,0,.35)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 7; i++) {
    const a = Math.random() * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(32 + Math.cos(a) * 4, 32 + Math.sin(a) * 4);
    ctx.lineTo(32 + Math.cos(a) * (10 + Math.random() * 12), 32 + Math.sin(a) * (10 + Math.random() * 12));
    ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  cache.set('hole', t);
  return t;
}

/** Agent portrait card background gradients — used behind the SVG portraits. */
export function cardGradient(colorA, colorB) {
  const key = `card-${colorA}-${colorB}`;
  if (cache.has(key)) return cache.get(key);
  const size = 256;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, colorA);
  g.addColorStop(1, colorB);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const rng = seededRandom(8);
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = `rgba(255,255,255,${rng() * 0.05})`;
    ctx.fillRect(0, rng() * size, size, 1 + rng() * 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, t);
  return t;
}

export function disposeTextureCache() {
  for (const t of cache.values()) t.dispose();
  cache.clear();
}

/* ================================================================== */
/* PBR helpers — normal maps, roughness, grunge overlays               */
/* ================================================================== */

/**
 * Derive a tangent-space normal map from the luminance of a canvas.
 * Every material in the game gets one, which is the single biggest
 * difference between "flat painted box" and "wall you can read the
 * surface of". Sobel on the alpha/luma, wrapped at the edges.
 */
export function normalMapFrom(canvas, strength = 2.4, size = 256) {
  const key = `nrm-${canvas.__cvKey || 'anon'}-${strength}-${size}`;
  if (cache.has(key)) return cache.get(key);
  let src;
  try {
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');
    ctx.drawImage(canvas, 0, 0, size, size);
    src = ctx.getImageData(0, 0, size, size).data;
  } catch {
    return null;
  }
  const lum = new Float32Array(size * size);
  for (let i = 0; i < size * size; i++) {
    const j = i * 4;
    lum[i] = (src[j] * 0.299 + src[j + 1] * 0.587 + src[j + 2] * 0.114) / 255;
  }
  const out = new Uint8Array(size * size * 4);
  const at = (x, y) => lum[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const tl = at(x - 1, y - 1), t = at(x, y - 1), tr = at(x + 1, y - 1);
      const l = at(x - 1, y), r = at(x + 1, y);
      const bl = at(x - 1, y + 1), b = at(x, y + 1), br = at(x + 1, y + 1);
      const dx = (tr + 2 * r + br) - (tl + 2 * l + bl);
      const dy = (bl + 2 * b + br) - (tl + 2 * t + tr);
      let nx = -dx * strength;
      let ny = -dy * strength;
      let nz = 1;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len; ny /= len; nz /= len;
      const i = (y * size + x) * 4;
      out[i] = (nx * 0.5 + 0.5) * 255;
      out[i + 1] = (ny * 0.5 + 0.5) * 255;
      out[i + 2] = (nz * 0.5 + 0.5) * 255;
      out[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(out, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  cache.set(key, tex);
  return tex;
}

/** Cache key helper so normalMapFrom can memoise per source canvas. */
export function tagTexture(tex, key) {
  if (tex && tex.image) tex.image.__cvKey = key;
  return tex;
}

/** Ground splash: broad dirt / sand drifts that break up the flat plane. */
export function groundSplat(seed = 3) {
  const key = `splat-${seed}`;
  if (cache.has(key)) return cache.get(key);
  const size = 1024;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const rng = seededRandom(seed);
  ctx.clearRect(0, 0, size, size);
  for (let i = 0; i < 220; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const rx = 30 + rng() * 190;
    const ry = rx * (0.35 + rng() * 0.9);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    const dark = rng() > 0.42;
    g.addColorStop(0, dark ? `rgba(28,24,18,${0.10 + rng() * 0.16})` : `rgba(226,214,186,${0.08 + rng() * 0.14})`);
    g.addColorStop(0.65, dark ? 'rgba(28,24,18,.05)' : 'rgba(226,214,186,.04)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rng() * Math.PI);
    ctx.scale(1, ry / rx);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // hairline cracks
  ctx.strokeStyle = 'rgba(24,20,16,.22)';
  for (let i = 0; i < 26; i++) {
    let x = rng() * size;
    let y = rng() * size;
    ctx.lineWidth = 0.6 + rng() * 1.4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < 14; s++) {
      x += (rng() - 0.5) * 60;
      y += (rng() - 0.5) * 60;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  cache.set(key, t);
  return t;
}

/** Stencilled markings: arrows, numbers, hazard paint on the concrete. */
export function stencilTexture(kind = 'arrow', color = '#e2b33c') {
  const key = `stencil-${kind}-${color}`;
  if (cache.has(key)) return cache.get(key);
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = 'round';
  if (kind === 'arrow') {
    ctx.lineWidth = 26;
    ctx.beginPath();
    ctx.moveTo(size * 0.5, size * 0.82);
    ctx.lineTo(size * 0.5, size * 0.26);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(size * 0.24, size * 0.44);
    ctx.lineTo(size * 0.5, size * 0.16);
    ctx.lineTo(size * 0.76, size * 0.44);
    ctx.stroke();
  } else if (kind === 'hazard') {
    for (let i = -size; i < size; i += 46) {
      ctx.beginPath();
      ctx.moveTo(i, size);
      ctx.lineTo(i + 24, size);
      ctx.lineTo(i + 24 + size * 0.5, 0);
      ctx.lineTo(i + size * 0.5, 0);
      ctx.closePath();
      ctx.fill();
    }
  } else if (kind === 'ring') {
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size * 0.36, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size * 0.44, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.font = 'bold 190px Impact, Arial Black, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(kind, size / 2, size / 2 + 8);
  }
  // weathered: punch holes through the paint
  ctx.globalCompositeOperation = 'destination-out';
  const rng = seededRandom(kind.length * 31 + 7);
  for (let i = 0; i < 90; i++) {
    ctx.globalAlpha = 0.25 + rng() * 0.6;
    ctx.beginPath();
    ctx.arc(rng() * size, rng() * size, 1 + rng() * 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  cache.set(key, t);
  return t;
}

/** Wall art: torn posters, graffiti tags and vents stuck on the panels. */
export function wallDecal(kind = 'poster', seed = 1) {
  const key = `decal-${kind}-${seed}`;
  if (cache.has(key)) return cache.get(key);
  const w = 256;
  const h = kind === 'poster' ? 320 : 256;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  const rng = seededRandom(seed * 17 + kind.length);
  ctx.clearRect(0, 0, w, h);
  if (kind === 'poster') {
    ctx.fillStyle = `hsl(${Math.floor(rng() * 360)}, 42%, 46%)`;
    ctx.fillRect(10, 10, w - 20, h - 20);
    ctx.fillStyle = 'rgba(0,0,0,.5)';
    ctx.fillRect(10, 10, w - 20, 46);
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.font = 'bold 30px Arial';
    ctx.fillText(['DANGER', 'KEEP OUT', 'SECTOR 7', 'NO ENTRY', 'RESTRICTED'][Math.floor(rng() * 5)], 22, 44);
    ctx.fillStyle = 'rgba(255,255,255,.7)';
    for (let i = 0; i < 5; i++) ctx.fillRect(22, 80 + i * 16, (w - 60) * (0.4 + rng() * 0.6), 6);
    // tears
    ctx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 22; i++) {
      ctx.beginPath();
      ctx.ellipse(rng() * w, rng() * h, 2 + rng() * 9, 2 + rng() * 6, rng() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  } else if (kind === 'graffiti') {
    ctx.strokeStyle = `hsla(${Math.floor(rng() * 360)}, 70%, 60%, .85)`;
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(22, h * 0.7);
    for (let x = 22; x < w - 22; x += 12) {
      ctx.lineTo(x, h * 0.5 + Math.sin(x * 0.09 + seed) * 34 + (rng() - 0.5) * 10);
    }
    ctx.stroke();
    ctx.strokeStyle = `hsla(${Math.floor(rng() * 360)}, 80%, 68%, .7)`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(30, h * 0.35);
    ctx.bezierCurveTo(w * 0.4, h * 0.1, w * 0.6, h * 0.6, w - 30, h * 0.3);
    ctx.stroke();
  } else if (kind === 'vent') {
    ctx.fillStyle = '#4a5157';
    ctx.fillRect(24, 60, w - 48, h - 120);
    ctx.fillStyle = 'rgba(0,0,0,.55)';
    for (let y = 72; y < h - 72; y += 12) ctx.fillRect(36, y, w - 72, 5);
    ctx.strokeStyle = 'rgba(255,255,255,.18)';
    ctx.lineWidth = 3;
    ctx.strokeRect(24, 60, w - 48, h - 120);
  } else if (kind === 'stain') {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(26,22,16,.55)');
    g.addColorStop(0.6, 'rgba(30,26,20,.22)');
    g.addColorStop(1, 'rgba(30,26,20,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  cache.set(key, t);
  return t;
}

/** Distant skyline ring so the world does not end at an empty horizon. */
export function horizonTexture(theme = 'sand') {
  const key = `horizon-${theme}`;
  if (cache.has(key)) return cache.get(key);
  const w = 2048;
  const h = 256;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  const rng = seededRandom(theme.length * 97 + 13);
  ctx.clearRect(0, 0, w, h);
  const palette = {
    sand: ['#9d8b6d', '#b7a281', '#7d6e55'],
    terracotta: ['#8d6350', '#a8785f', '#6b4638'],
    industrial: ['#6a7178', '#828b92', '#4d545a'],
    jungle: ['#5f6f52', '#768862', '#45523c'],
    concrete: ['#7b8288', '#8f979d', '#5c6367'],
    sanctuary: ['#a89a72', '#c0b18a', '#877a58'],
  }[theme] || ['#9d8b6d', '#b7a281', '#7d6e55'];

  // two layers of buildings for parallax depth
  for (let layer = 0; layer < 2; layer++) {
    const baseY = h - (layer === 0 ? 0 : 26);
    ctx.fillStyle = layer === 0 ? palette[2] : palette[0];
    ctx.globalAlpha = layer === 0 ? 0.85 : 1;
    let x = 0;
    while (x < w) {
      const bw = 24 + rng() * 90;
      const bh = (layer === 0 ? 40 : 62) + rng() * (layer === 0 ? 70 : 110);
      ctx.fillRect(x, baseY - bh, bw, bh);
      // windows
      ctx.fillStyle = `rgba(255,226,170,${0.05 + rng() * 0.12})`;
      for (let wy = baseY - bh + 10; wy < baseY - 8; wy += 14) {
        for (let wx = x + 6; wx < x + bw - 6; wx += 12) {
          if (rng() > 0.55) ctx.fillRect(wx, wy, 5, 7);
        }
      }
      ctx.fillStyle = layer === 0 ? palette[2] : palette[0];
      x += bw + rng() * 26;
    }
  }
  ctx.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.anisotropy = 4;
  cache.set(key, t);
  return t;
}

/** Painted wooden board / pallet texture for the clutter props. */
export function palletTexture(base = '#8a6a45', seed = 23) {
  const key = `pallet-${base}-${seed}`;
  if (cache.has(key)) return cache.get(key);
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const rng = seededRandom(seed);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 5; i++) {
    const y = (i * size) / 5;
    ctx.fillStyle = `rgba(${120 + rng() * 50},${88 + rng() * 40},${52 + rng() * 30},.85)`;
    ctx.fillRect(0, y + 3, size, size / 5 - 6);
    ctx.strokeStyle = 'rgba(0,0,0,.28)';
    ctx.strokeRect(0, y + 3, size, size / 5 - 6);
    // grain
    ctx.strokeStyle = 'rgba(60,40,24,.18)';
    ctx.lineWidth = 1;
    for (let k = 0; k < 9; k++) {
      const gy = y + 6 + rng() * (size / 5 - 12);
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.bezierCurveTo(size * 0.3, gy + 2, size * 0.6, gy - 2, size, gy + 1);
      ctx.stroke();
    }
  }
  grain(ctx, size, rng, 0.07);
  const t = toTexture(c, 1);
  cache.set(key, t);
  return t;
}

/**
 * Tiny "photo studio" equirect for the first-person weapon rig: dark floor,
 * bright sky, two softboxes. Pre-filtered with PMREM it gives metal and painted
 * guns proper specular streaks instead of the old flat grey sheen.
 */
export function studioEnvTexture() {
  if (cache.has('studio')) return cache.get('studio');
  const w = 512;
  const h = 256;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#8fa6bd');
  g.addColorStop(0.45, '#6d7f92');
  g.addColorStop(0.55, '#2a2f36');
  g.addColorStop(1, '#14171a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // softboxes
  const soft = (x, y, r, alpha, color) => {
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, `rgba(${color},${alpha})`);
    rg.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = rg;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  };
  soft(w * 0.28, h * 0.3, 110, 0.95, '255,248,236');
  soft(w * 0.74, h * 0.36, 78, 0.7, '210,228,255');
  soft(w * 0.5, h * 0.14, 150, 0.5, '255,255,255');
  const t = new THREE.CanvasTexture(c);
  t.mapping = THREE.EquirectangularReflectionMapping;
  t.colorSpace = THREE.SRGBColorSpace;
  cache.set('studio', t);
  return t;
}
