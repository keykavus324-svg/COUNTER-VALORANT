/**
 * ASCII silhouette renderer: projects every triangle of a model onto a 2D grid
 * with a simple orthographic front view. Lets us sanity check character and
 * weapon shapes from the terminal, without a GPU.
 *
 *   node tools/silhouette.mjs character blaze
 *   node tools/silhouette.mjs weapon vandal
 */
import * as THREE from 'three';

globalThis.window = globalThis.window || { innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1, addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false, addListener() {}, removeListener() {} }) };
const gradient = { addColorStop() {} };
globalThis.document = globalThis.document || {
  createElement: () => ({
    width: 128, height: 128, style: {},
    getContext: () => new Proxy(
      { canvas: { width: 128, height: 128 }, createLinearGradient: () => gradient, createRadialGradient: () => gradient, getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(4, w * h * 4)), width: w, height: h }), measureText: () => ({ width: 10 }) },
      { get: (t, p) => (p in t ? t[p] : () => {}), set: (t, p, v) => { t[p] = v; return true; } }
    ),
    classList: { add() {}, remove() {} },
  }),
  getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
  addEventListener() {}, removeEventListener() {},
  body: { classList: { add() {}, remove() {} } },
};

const { Character } = await import('../src/game/characters.js');
const { buildWeaponModel } = await import('../src/game/weapons.js');
const { Viewmodel } = await import('../src/game/Viewmodel.js');

const mode = process.argv[2] || 'character';
const id = process.argv[3] || 'blaze';

let root;
let camPos;
let camTarget;
let presetCamera = null;
if (mode === 'viewmodel') {
  const vm = new Viewmodel({ render: () => {}, setSize() {} }, 'medium');
  vm.setWeapon(id === 'blaze' ? 'vandal' : id);
  vm.setAgent('blaze');
  if (process.env.VM_YAW !== undefined) {
    const orig = vm.update.bind(vm);
    vm.update = (dt, state) => { orig(dt, state); vm.weaponHolder.rotation.y = Number(process.env.VM_YAW) * (Math.PI / 180); };
  }
  for (let i = 0; i < 40; i++) {
    vm.update(1 / 60, { speed: 0, grounded: true, adsTarget: 0, reloadProgress: -1, scoped: false, crouch: 0, mouseDX: 0, mouseDY: 0 });
  }
  root = vm.scene;
  root.updateMatrixWorld(true);
  presetCamera = vm.camera;
  presetCamera.aspect = 16 / 9;
  presetCamera.updateProjectionMatrix();
} else if (mode === 'character') {
  const c = new Character({ agentId: id, team: 'ally', name: 'TEST' });
  c.setWeapon?.('vandal');
  root = c.root;
  root.updateMatrixWorld(true);
  camPos = new THREE.Vector3(2.6, 1.2, 3.4);
  camTarget = new THREE.Vector3(0, 1.0, 0);
} else {
  root = buildWeaponModel(id);
  root.updateMatrixWorld(true);
  camPos = new THREE.Vector3(0.9, 0.5, 1.2);
  camTarget = new THREE.Vector3(0, 0, -0.3);
}

const camera = presetCamera || new THREE.PerspectiveCamera(35, 1, 0.05, 60);
if (!presetCamera) {
  camera.position.copy(camPos);
  camera.lookAt(camTarget);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();
}

const W = 60;
const H = 34;
const grid = Array.from({ length: H }, () => new Array(W).fill(' '));
const shade = ['#', '%', 'x', '+', '=', '-', ':', '.'];

const v = new THREE.Vector3();
let tris = 0;
root.traverse((o) => {
  if (!o.isMesh || !o.geometry) return;
  const g = o.geometry;
  const pos = g.attributes.position;
  if (!pos) return;
  const idx = g.index;
  const count = idx ? idx.count : pos.count;
  for (let i = 0; i < count; i += 3) {
    const pts = [];
    for (let k = 0; k < 3; k++) {
      const vi = idx ? idx.getX(i + k) : i + k;
      v.fromBufferAttribute(pos, vi).applyMatrix4(o.matrixWorld);
      v.project(camera);
      pts.push({ x: (v.x * 0.5 + 0.5) * (W - 1), y: (0.5 - v.y * 0.5) * (H - 1), z: v.z });
    }
    if (pts.some((p) => p.z < -1 || p.z > 1)) continue;
    tris++;
    // fill triangle with a coarse barycentric scan
    const minX = Math.max(0, Math.floor(Math.min(...pts.map((p) => p.x))));
    const maxX = Math.min(W - 1, Math.ceil(Math.max(...pts.map((p) => p.x))));
    const minY = Math.max(0, Math.floor(Math.min(...pts.map((p) => p.y))));
    const maxY = Math.min(H - 1, Math.ceil(Math.max(...pts.map((p) => p.y))));
    const [a, b, c] = pts;
    const d = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
    if (Math.abs(d) < 1e-6) continue;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const l1 = ((b.y - c.y) * (x - c.x) + (c.x - b.x) * (y - c.y)) / d;
        const l2 = ((c.y - a.y) * (x - c.x) + (a.x - c.x) * (y - c.y)) / d;
        const l3 = 1 - l1 - l2;
        if (l1 < 0 || l2 < 0 || l3 < 0) continue;
        const depth = l1 * a.z + l2 * b.z + l3 * c.z;
        const ch = shade[Math.min(shade.length - 1, Math.max(0, Math.round((depth + 1) * 0.5 * (shade.length - 1))))];
        const prev = grid[y][x];
        const prevDepth = prev === ' ' ? 2 : shade.indexOf(prev) / (shade.length - 1) * 2 - 1;
        if (prev === ' ' || depth < prevDepth) grid[y][x] = ch;
      }
    }
  }
});

console.log(`\n${mode} ${id} — ${tris} visible triangles\n`);
for (const row of grid) console.log(row.join(''));
console.log('');

const box = new THREE.Box3().setFromObject(root);
let meshes = 0, hidden = 0;
root.traverse((o) => { if (o.isMesh) { meshes++; if (!o.visible) hidden++; } });
console.log('meshes:', meshes, 'hidden:', hidden, 'visibleRoot:', root.visible, 'bbox:', box.min.toArray().map((n) => +n.toFixed(2)), box.max.toArray().map((n) => +n.toFixed(2)));
