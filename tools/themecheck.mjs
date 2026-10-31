/** Builds the arena once per cosmetic theme and checks nothing is broken. */
import * as THREE from 'three';
const gradient = { addColorStop() {} };
const makeCtx = () => new Proxy({ canvas: { width: 512, height: 512 }, createLinearGradient: () => gradient, createRadialGradient: () => gradient, getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(4, w * h * 4)), width: w, height: h }), measureText: () => ({ width: 10 }) }, { get: (t, p) => (p in t ? t[p] : () => {}), set: (t, p, v) => { t[p] = v; return true; } });
const makeCanvas = (w = 512, h = 512) => ({ width: w, height: h, style: {}, getContext: () => makeCtx() });
globalThis.window = { innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1, addEventListener() {}, removeEventListener() {}, AudioContext: undefined, requestAnimationFrame: () => 0, cancelAnimationFrame() {}, matchMedia: () => ({ matches: false, addListener() {}, removeListener() {} }) };
globalThis.document = {
  createElement: (t) => (t === 'canvas' ? makeCanvas() : { style: {}, classList: { add() {}, remove() {}, toggle() {} }, appendChild() {}, addEventListener() {} }),
  getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, removeEventListener() {},
  exitPointerLock() {}, pointerLockElement: null, body: { classList: { add() {}, remove() {}, toggle() {} } }, documentElement: { style: { setProperty() {} } }, activeElement: null,
};
const { THEMES } = await import('../src/world/mapLayout.js');
const { GameMap } = await import('../src/world/map.js');

const rows = [];
for (const id of Object.keys(THEMES)) {
  const scene = new THREE.Scene();
  const map = new GameMap(scene, 'low', id);
  let meshes = 0;
  scene.traverse((o) => { if (o.isMesh) meshes++; });
  const sun = map.sun?.color.getHexString();
  let sky = null;
  scene.traverse((o) => { if (!sky && o.isMesh && o.material?.map && o.material.side === THREE.BackSide) sky = o.material.map; });
  rows.push({ theme: id, label: THEMES[id].label, meshes, sun, skyOK: !!sky, nodes: map.navNodes.length });
}
console.table(rows);
const ok = rows.every((r) => r.meshes > 300 && r.nodes === 70 && r.skyOK);
console.log(ok ? '✓ all themes build' : '✗ theme build problem');
process.exit(ok ? 0 : 1);
