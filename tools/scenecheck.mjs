/**
 * Scene integrity check: builds the real 3D scene (no WebGL needed), then looks
 * for the classic invisible-model bugs — groups that never got attached, NaN
 * transforms, degenerate geometry and characters missing body parts.
 */
import * as THREE from 'three';

const gradient = { addColorStop() {} };
const makeCtx = () => new Proxy(
  { canvas: { width: 512, height: 512 }, createLinearGradient: () => gradient, createRadialGradient: () => gradient, getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(4, w * h * 4)), width: w, height: h }), measureText: () => ({ width: 10 }) },
  { get: (t, p) => (p in t ? t[p] : () => {}), set: (t, p, v) => { t[p] = v; return true; } }
);
const makeCanvas = (w = 512, h = 512) => ({ width: w, height: h, style: {}, getContext: () => makeCtx() });
globalThis.window = {
  innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1,
  addEventListener() {}, removeEventListener() {},
  AudioContext: undefined, requestAnimationFrame: () => 0, cancelAnimationFrame() {},
  matchMedia: () => ({ matches: false, addListener() {}, removeListener() {} }),
};
globalThis.document = {
  createElement: (tag) => (tag === 'canvas' ? makeCanvas() : { style: {}, classList: { add() {}, remove() {}, toggle() {} }, appendChild() {}, addEventListener() {} }),
  getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
  addEventListener() {}, removeEventListener() {}, exitPointerLock() {}, pointerLockElement: null,
  body: { classList: { add() {}, remove() {}, toggle() {} } },
  documentElement: { style: { setProperty() {} } }, activeElement: null,
};

const { Game } = await import('../src/game/game.js');
const ui = new Proxy({}, { get: () => () => {} });
const game = new Game({ canvas: makeCanvas(), ui, settings: { quality: 'medium' }, agentId: 'blaze', headless: true }).init();

const problems = [];
let meshes = 0;
let lights = 0;
const badMatrix = new Set();
const degenerate = new Set();

game.scene.traverse((o) => {
  if (o.isLight) lights++;
  if (!o.isMesh) return;
  meshes++;
  const e = o.matrixWorld.elements;
  if (e.some((n) => !Number.isFinite(n))) badMatrix.add(o.name || o.type);
  if (o.geometry) {
    o.geometry.computeBoundingBox?.();
    const bb = o.geometry.boundingBox;
    if (bb && (!Number.isFinite(bb.max.x) || bb.max.x - bb.min.x < 0.001 && bb.max.y - bb.min.y < 0.001 && bb.max.z - bb.min.z < 0.001)) {
      degenerate.add(o.geometry.type);
    }
  }
});

// every actor must actually have a full body attached to its render root
const bodyReport = [];
for (const a of game.actors) {
  let n = 0;
  a.character.root.traverse((o) => { if (o.isMesh) n++; });
  bodyReport.push(`${a.name}:${n}`);
  if (n < 20) problems.push(`${a.name} character only has ${n} meshes — body parts are not attached`);
  if (!a.character.root.parent) problems.push(`${a.name} character root is not in the scene`);
  if (!a.character.weaponModel) problems.push(`${a.name} has no weapon model`);
}

// head hitbox must line up with the visible head, otherwise headshots become luck
const sample = game.actors.find((a) => !a.isPlayer);
sample.pos.set(0, 0, 0);
sample.crouch = 0;
sample.updateHitBoxes();
sample.character.root.updateMatrixWorld(true);
const headMesh = sample.character.headGroup.children.find((c) => c.isMesh && c.geometry.type === 'BoxGeometry');
if (headMesh) {
  const bb = new THREE.Box3().setFromObject(headMesh);
  const hb = sample.hitBoxes.head;
  const visual = { min: bb.min.y, max: bb.max.y };
  const hit = { min: hb.min.y, max: hb.max.y };
  const overlap = Math.min(visual.max, hit.max) - Math.max(visual.min, hit.min);
  const coverage = overlap / (visual.max - visual.min);
  if (coverage < 0.85) {
    problems.push(`head hitbox covers only ${(coverage * 100).toFixed(0)}% of the visible head (visual ${visual.min.toFixed(2)}..${visual.max.toFixed(2)} vs hitbox ${hit.min.toFixed(2)}..${hit.max.toFixed(2)})`);
  }
  if (visual.min < sample.hitBoxes.body.min.y) problems.push('visible head dips into the leg hitbox');
  console.log(`head: visual ${visual.min.toFixed(2)}..${visual.max.toFixed(2)}  hitbox ${hit.min.toFixed(2)}..${hit.max.toFixed(2)}  coverage ${(coverage * 100).toFixed(0)}%`);
}

if (meshes < 150) problems.push(`scene only has ${meshes} meshes — the map probably failed to build`);
if (lights < 3) problems.push(`scene only has ${lights} lights`);
if (badMatrix.size) problems.push(`NaN transforms on: ${[...badMatrix].join(', ')}`);
if (degenerate.size) problems.push(`degenerate geometry: ${[...degenerate].join(', ')}`);

// spike + barrier visuals must be reachable
if (!game.spikeMesh) problems.push('spike mesh missing');
if (!game.barriers?.length) problems.push('spawn barriers missing');
if (!game.viewmodel?.weaponHolder?.children.length) problems.push('first person viewmodel has no weapon');

console.log(`scene: ${meshes} meshes, ${lights} lights, ${game.map.navNodes.length} nav nodes`);
console.log(`bodies: ${bodyReport.join(' ')}`);
if (problems.length) {
  console.error(`✗ ${problems.length} scene problem(s):`);
  for (const p of problems) console.error('  - ' + p);
  process.exit(1);
}
console.log('✓ scene integrity ok');
