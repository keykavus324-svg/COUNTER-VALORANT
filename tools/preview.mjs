/**
 * Offline preview renderer.
 *
 * The sandbox has no GPU and no browser, so this tool rasterises the real
 * GameMap in plain JavaScript and writes a PNG. It is not a beauty shot (no
 * textures, no shadows, no post) but it shows geometry, scale, silhouette,
 * lighting direction and colour balance — exactly the things that were being
 * guessed at before.
 *
 *   node tools/preview.mjs [mapId] [out.png] [mode]
 *     mode: fov (default) | top | side
 */
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { PNG } from 'pngjs';

/* ---------------- DOM stub (textures become no-ops) ---------------- */
const gradient = { addColorStop() {} };
const makeCtx = () => new Proxy(
  {
    canvas: { width: 256, height: 256 },
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    createPattern: () => ({}),
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(4, w * h * 4)), width: w, height: h }),
    measureText: () => ({ width: 10 }),
  },
  { get: (t, p) => (p in t ? t[p] : () => {}), set: (t, p, v) => { t[p] = v; return true; } },
);
const makeCanvas = (w = 256, h = 256) => ({ width: w, height: h, style: {}, getContext: () => makeCtx() });
globalThis.window = { innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1, addEventListener() {}, removeEventListener() {} };
globalThis.document = {
  createElement: (t) => (t === 'canvas' ? makeCanvas() : { style: {}, classList: { add() {}, remove() {} } }),
  getElementById: () => null,
  body: { classList: { add() {}, remove() {} } },
};

const SUBJECT = process.env.PREVIEW_SUBJECT || '';   // 'weapon:<id>' | 'actor:<agent>'
const mapId = process.argv[2] || 'de_dust2';
const outFile = process.argv[3] || `preview-${mapId}.png`;
const mode = process.argv[4] || 'fov';

const { ensureMap, MAPS, SPAWNS, SITES, MAP_BOUNDS, THEMES } = await import('../src/world/mapLayout.js');
await ensureMap(mapId);
const { GameMap } = await import('../src/world/map.js');

const scene = new THREE.Scene();
const gameMap = new GameMap(scene, 'medium', mapId, null);
const theme = THEMES[gameMap.themeId] || THEMES.sand;

/* ---------------- optional close-up subject ---------------- */
let subjectBounds = null;
if (SUBJECT.startsWith('weapon:')) {
  const { buildWeaponModel } = await import('../src/game/weapons.js');
  const model = buildWeaponModel(SUBJECT.slice(7), false, undefined);
  model.position.set(0, 1.2, 0);
  model.rotation.y = Math.PI * 0.82;
  scene.add(model);
  subjectBounds = new THREE.Box3().setFromObject(model);
  if (process.env.PREVIEW_DEBUG) {
    let n = 0;
    model.traverse((o) => { if (o.isMesh && n++ < 4) console.log('mesh', o.name, o.material?.color?.getHexString?.()); });
  }
} else if (SUBJECT.startsWith('actor:')) {
  const { Character } = await import('../src/game/characters.js');
  const ch = new Character({ agentId: SUBJECT.slice(6), team: 'ally', name: 'TEST' });
  ch.root.position.set(0, 0, 0);
  ch.root.rotation.y = Math.PI * 0.85;
  scene.add(ch.root);
  subjectBounds = new THREE.Box3().setFromObject(ch.root);
}
if (subjectBounds) {
  // hide the map: this is a studio shot of the model
  gameMap.group.visible = false;
  gameMap.group.traverse((o) => { o.visible = false; });
}

const W = 960;
const H = 540;
const colorBuf = new Float32Array(W * H * 3);
const depthBuf = new Float32Array(W * H).fill(Infinity);

/* ---------------- sky background ---------------- */
const stops = (theme.sky || [0xd8e6f2]).map((hex) => new THREE.Color(hex));
while (stops.length < 2) stops.push(stops[0]);
const skyAt = (t) => {
  const scaled = t * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(scaled));
  return stops[i].clone().lerp(stops[i + 1], scaled - i);
};
for (let y = 0; y < H; y++) {
  const c = skyAt(y / H);
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 3;
    colorBuf[i] = c.r; colorBuf[i + 1] = c.g; colorBuf[i + 2] = c.b;
  }
}

/* ---------------- camera ---------------- */
const camera = new THREE.PerspectiveCamera(74, W / H, 0.1, 900);

const spawn = SPAWNS.attacker[0] || { x: 0, z: 0 };
const target = SITES.A.center;
if (subjectBounds) {
  const centre = subjectBounds.getCenter(new THREE.Vector3());
  const size = subjectBounds.getSize(new THREE.Vector3());
  const dist = Math.max(size.x, size.y, size.z) * 1.9 + 0.6;
  camera.position.set(centre.x + dist * 0.5, centre.y + dist * 0.35, centre.z + dist * 0.85);
  camera.lookAt(centre);
  camera.fov = 34;
  camera.updateProjectionMatrix();
} else if (mode === 'top') {
  const span = Math.max(MAP_BOUNDS.maxX - MAP_BOUNDS.minX, MAP_BOUNDS.maxZ - MAP_BOUNDS.minZ);
  camera.position.set((MAP_BOUNDS.minX + MAP_BOUNDS.maxX) / 2, span * 1.1, (MAP_BOUNDS.minZ + MAP_BOUNDS.maxZ) / 2 + 0.01);
  camera.up.set(0, 0, -1);
  camera.lookAt((MAP_BOUNDS.minX + MAP_BOUNDS.maxX) / 2, 0, (MAP_BOUNDS.minZ + MAP_BOUNDS.maxZ) / 2);
  camera.fov = 50;
  camera.updateProjectionMatrix();
} else if (mode === 'side') {
  camera.position.set(spawn.x, 26, spawn.z + 46);
  camera.lookAt(target.x, 2, target.z);
} else {
  camera.position.set(spawn.x, 1.68, spawn.z);
  camera.lookAt(target.x, 1.6, target.z);
}
camera.updateMatrixWorld(true);

const viewProj = new THREE.Matrix4().multiplyMatrices(
  camera.projectionMatrix,
  camera.matrixWorldInverse,
);

/* ---------------- collect triangles ---------------- */
if (subjectBounds) {
  for (let i = 0; i < W * H * 3; i += 3) {
    colorBuf[i] = 0.16; colorBuf[i + 1] = 0.17; colorBuf[i + 2] = 0.19;
  }
}
const sunDir = new THREE.Vector3(52, 66, 38).normalize();
const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();
const tmpC = new THREE.Vector3();
const nrm = new THREE.Vector3();
const world = new THREE.Matrix4();
const inst = new THREE.Matrix4();

const NAME_COLOR = {
  walls: new THREE.Color(theme.wall),
  'wall-caps': new THREE.Color(theme.wallDark),
  props: new THREE.Color(theme.crate),
  'clutter-solids': new THREE.Color(theme.crate),
  'clutter-barrels': new THREE.Color(0x7a5a44),
  'clutter-flat': new THREE.Color(0x6b5236),
  ground: new THREE.Color(theme.ground).multiplyScalar(0.92),
  horizon: new THREE.Color(theme.sky[4] || theme.sky[2]),
  'wall-trim': new THREE.Color(theme.wallDark).multiplyScalar(1.08),
  'wall-openings': new THREE.Color(0x0b0e11),
};

let drawn = 0;
const project = (p, out) => {
  const v = new THREE.Vector4(p.x, p.y, p.z, 1).applyMatrix4(viewProj);
  if (v.w <= 0.0001) return false;
  out.x = (v.x / v.w * 0.5 + 0.5) * W;
  out.y = (1 - (v.y / v.w * 0.5 + 0.5)) * H;
  out.z = v.w;
  return true;
};
const P0 = { x: 0, y: 0, z: 0 };
const P1 = { x: 0, y: 0, z: 0 };
const P2 = { x: 0, y: 0, z: 0 };

function shade(baseColor, n, pos) {
  const ndl = Math.max(0, n.dot(sunDir));
  const amb = 0.20;
  const fill = Math.max(0, n.clone().multiplyScalar(-1).dot(new THREE.Vector3(-0.62, 0.35, -0.5).normalize())) * 0.16;
  const lum = amb + ndl * 1.15 + fill;
  const fogD = camera.position.distanceTo(pos);
  const fog = subjectBounds ? 0 : 1 - Math.exp(-fogD * 0.003 * 2.1);
  const c = baseColor;
  return {
    r: c.r * lum * (1 - fog) + (theme.sky[2] ? new THREE.Color(theme.sky[2]).r : 0.8) * fog,
    g: c.g * lum * (1 - fog) + (theme.sky[2] ? new THREE.Color(theme.sky[2]).g : 0.8) * fog,
    b: c.b * lum * (1 - fog) + (theme.sky[2] ? new THREE.Color(theme.sky[2]).b : 0.8) * fog,
  };
}

/**
 * Clip a world-space triangle against the camera near plane, then project.
 * Without this, any triangle that straddles the camera (the huge ground plane,
 * the sky dome) has a vertex behind the eye and used to be dropped entirely.
 */
function drawWorldTri(a, b, c, colour) {
  const near = 0.08;
  const pts = [];
  const e = new THREE.Vector3();
  const push = (v) => pts.push(v.clone());
  const dist = (v) => {
    e.copy(v).applyMatrix4(camera.matrixWorldInverse);
    return -e.z - near;                 // >0 in front
  };
  const da = dist(a), db = dist(b), dc = dist(c);
  const verts = [[a, da], [b, db], [c, dc]];
  for (let i = 0; i < 3; i++) {
    const [cur, dCur] = verts[i];
    const [nxt, dNxt] = verts[(i + 1) % 3];
    if (dCur >= 0) push(cur);
    if ((dCur >= 0) !== (dNxt >= 0)) {
      const t = dCur / (dCur - dNxt);
      push(new THREE.Vector3().lerpVectors(cur, nxt, t));
    }
  }
  if (pts.length < 3) return;
  if (!project(pts[0], P0)) return;
  for (let i = 1; i < pts.length - 1; i++) {
    if (!project(pts[i], P1) || !project(pts[i + 1], P2)) continue;
    rasterTri(P0, P1, P2, colour, colour, colour);
  }
}

function rasterTri(a, b, c, ca, cb, cc) {
  const minX = Math.max(0, Math.floor(Math.min(a.x, b.x, c.x)));
  const maxX = Math.min(W - 1, Math.ceil(Math.max(a.x, b.x, c.x)));
  const minY = Math.max(0, Math.floor(Math.min(a.y, b.y, c.y)));
  const maxY = Math.min(H - 1, Math.ceil(Math.max(a.y, b.y, c.y)));
  if (minX > maxX || minY > maxY) return;
  const area = (b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y);
  if (Math.abs(area) < 1e-6) return;
  const inv = 1 / area;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      let w0 = ((b.x - a.x) * (py - a.y) - (px - a.x) * (b.y - a.y)) * inv;
      let w1 = ((px - a.x) * (c.y - a.y) - (c.x - a.x) * (py - a.y)) * inv;
      const w2 = 1 - w0 - w1;
      if (w0 < 0 || w1 < 0 || w2 < 0) continue;
      // perspective-correct depth via 1/w interpolation
      const z = 1 / (w2 / a.z + w1 / b.z + w0 / c.z);
      const idx = y * W + x;
      if (z >= depthBuf[idx]) continue;
      depthBuf[idx] = z;
      const i3 = idx * 3;
      colorBuf[i3] = ca.r * w2 + cb.r * w1 + cc.r * w0;
      colorBuf[i3 + 1] = ca.g * w2 + cb.g * w1 + cc.g * w0;
      colorBuf[i3 + 2] = ca.b * w2 + cb.b * w1 + cc.b * w0;
    }
  }
}

scene.updateMatrixWorld(true);
scene.traverse((obj) => {
  if (!obj.isMesh || obj.name === 'horizon' || obj.name === 'sky') return;
  if (obj.visible === false) return;
  let p = obj.parent;
  while (p) { if (p.visible === false) return; p = p.parent; }
  if (obj.material?.transparent) return;          // decals, splats, beams
  const geo = obj.geometry;
  const posAttr = geo?.attributes?.position;
  if (!posAttr) return;
  const colAttr = geo.attributes.color;
  const index = geo.index;
  const matColor = Array.isArray(obj.material) ? obj.material[0]?.color : obj.material?.color;
  const baseColor = NAME_COLOR[obj.name] || matColor || new THREE.Color(0x888888);
  const count = obj.isInstancedMesh ? obj.count : 1;
  for (let i = 0; i < count; i++) {
    if (obj.isInstancedMesh) {
      obj.getMatrixAt(i, inst);
      world.multiplyMatrices(obj.matrixWorld, inst);
    } else {
      world.copy(obj.matrixWorld);
    }
    const triCount = index ? index.count / 3 : posAttr.count / 3;
    for (let t = 0; t < triCount; t++) {
      const ia = index ? index.getX(t * 3) : t * 3;
      const ib = index ? index.getX(t * 3 + 1) : t * 3 + 1;
      const ic = index ? index.getX(t * 3 + 2) : t * 3 + 2;
      tmpA.fromBufferAttribute(posAttr, ia).applyMatrix4(world);
      tmpB.fromBufferAttribute(posAttr, ib).applyMatrix4(world);
      tmpC.fromBufferAttribute(posAttr, ic).applyMatrix4(world);
      nrm.subVectors(tmpB, tmpA).cross(tmpC.clone().sub(tmpA)).normalize();
      const centroid = tmpA.clone().add(tmpB).add(tmpC).multiplyScalar(1 / 3);
      if (nrm.dot(camera.position.clone().sub(centroid)) < 0) nrm.multiplyScalar(-1); // double sided
      // vertex colour (AO) if the geometry has one
      let tint = 1;
      if (colAttr) tint = (colAttr.getX(ia) + colAttr.getX(ib) + colAttr.getX(ic)) / 3;
      const col = baseColor.clone().multiplyScalar(tint);
      const s = shade(col, nrm, centroid);
      drawWorldTri(tmpA, tmpB, tmpC, s);
      drawn++;
    }
  }
});

/* ---------------- tonemap + write ---------------- */
const png = new PNG({ width: W, height: H });
const toSrgb = (v) => Math.max(0, Math.min(255, Math.round(Math.pow(Math.max(0, v), 1 / 2.2) * 255)));
for (let i = 0; i < W * H; i++) {
  const exposure = 1.05;
  const x = colorBuf[i * 3] * exposure;
  const y = colorBuf[i * 3 + 1] * exposure;
  const z = colorBuf[i * 3 + 2] * exposure;
  // ACES-ish curve
  const aces = (v) => (v * (2.51 * v + 0.03)) / (v * (2.43 * v + 0.59) + 0.14);
  png.data[i * 4] = toSrgb(aces(x));
  png.data[i * 4 + 1] = toSrgb(aces(y));
  png.data[i * 4 + 2] = toSrgb(aces(z));
  png.data[i * 4 + 3] = 255;
}
if (process.env.PREVIEW_DEBUG) {
  const px = (x, y) => {
    const i = (y * W + x) * 3;
    return [colorBuf[i], colorBuf[i + 1], colorBuf[i + 2]].map((v) => +v.toFixed(3));
  };
  console.log('bottom-centre', px(W >> 1, H - 20), 'top', px(W >> 1, 10));
  const names = new Map();
  scene.traverse((o) => { if (o.isMesh) names.set(o.name || o.type, (names.get(o.name || o.type) || 0) + 1); });
  console.log([...names.entries()].map((e) => e.join(':')).join(' '));
  console.log('ground color', new THREE.Color(theme.ground).getHexString(), 'sky', (theme.sky||[]).map(h=>h.toString(16)));
}
const outPath = path.resolve(outFile);
fs.writeFileSync(outPath, PNG.sync.write(png));
console.log(`${mapId} [${mode}] → ${outPath} (${drawn} triangles, ${MAPS.length} maps loaded)`);
