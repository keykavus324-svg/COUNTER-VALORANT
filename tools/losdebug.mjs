/** Diagnostic: why do two bots standing next to each other not fight? */
const gradient = { addColorStop() {} };
function makeCtx() {
  return new Proxy({ canvas: { width: 512, height: 512 }, createLinearGradient: () => gradient, createRadialGradient: () => gradient, getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(4, w * h * 4)), width: w, height: h }), measureText: () => ({ width: 10 }) }, {
    get(t, p) { return p in t ? t[p] : () => {}; },
    set(t, p, v) { t[p] = v; return true; },
  });
}
const makeCanvas = (w = 512, h = 512) => ({ width: w, height: h, style: {}, getContext: () => makeCtx() });
globalThis.window = {
  innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1,
  addEventListener() {}, removeEventListener() {},
  AudioContext: undefined, requestAnimationFrame: (cb) => 0, cancelAnimationFrame() {},
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
const THREE = await import('three');

const ui = new Proxy({}, { get: () => () => {} });
const game = new Game({ canvas: makeCanvas(), ui, settings: { quality: 'medium' }, agentId: 'blaze', headless: true });
game.init();
const dt = 1 / 30;
// hand the spike to a bot so we watch AI-vs-AI behaviour
game.player.spikeCarrier = false;
const firstBot = game.actors.find((a) => !a.isPlayer && a.alive);
firstBot.spikeCarrier = true;
game.spike.carrier = firstBot;
for (let i = 0; i < 30 * 90; i++) {
  game.update(dt);
  if (i % 300 === 0) console.log('frame', i, 'phase', game.phase, 'timer', game.phaseTimer.toFixed(1), 'round', game.roundNumber, 'paused', game.paused);
}

const carrier = game.actors.find((a) => a.spikeCarrier && a.alive) || game.actors.find((a) => a.alive && !a.isPlayer);
const nearest = game.actors.filter((a) => a.alive && a.team !== carrier.team)
  .sort((a, b) => a.pos.distanceTo(carrier.pos) - b.pos.distanceTo(carrier.pos))[0];
const eye = carrier.getEye(new THREE.Vector3());
const tEye = nearest.getEye(new THREE.Vector3());
console.log('phase', game.phase, 't', game.time.toFixed(1), 'spike', game.spike.state);
console.log('carrier', carrier.name, carrier.pos.x.toFixed(2), carrier.pos.z.toFixed(2), 'state', carrier.state, 'carry', carrier.spikeCarrier);
console.log('nearest', nearest.name, nearest.pos.x.toFixed(2), nearest.pos.z.toFixed(2), 'dist', carrier.pos.distanceTo(nearest.pos).toFixed(2));
console.log('carrier.canSee(nearest)', carrier.canSee(nearest), 'nearest.canSee(carrier)', nearest.canSee(carrier));
console.log('hasClearSight eyes', game.hasClearSight(eye.clone(), tEye.clone()));
console.log('map.hasLineOfSight', game.map.hasLineOfSight(eye.clone(), tEye.clone(), eye.y, tEye.y));
console.log('walkable seg', game.isWalkableSegment(carrier.pos, nearest.pos));
console.log('nav cell carrier', game.map.isBlockedPoint?.(carrier.pos.x, carrier.pos.z), 'nearestNode', JSON.stringify(game.map.nearestNode(carrier.pos.x, carrier.pos.z)));
console.log('navBlockers near carrier:', game.map.navBlockers.filter((b) => carrier.pos.x > b.min.x - 0.6 && carrier.pos.x < b.max.x + 0.6 && carrier.pos.z > b.min.z - 0.6 && carrier.pos.z < b.max.z + 0.6).map((b) => ({ minY: +b.min.y.toFixed(2), maxY: +b.max.y.toFixed(2), x: [+b.min.x.toFixed(1), +b.max.x.toFixed(1)], z: [+b.min.z.toFixed(1), +b.max.z.toFixed(1)] })));
console.log('carrier plantTimer', carrier.plantTimer, 'target', carrier.target?.name, 'reaction', carrier.reactionTimer?.toFixed(2), 'lastDamage', (game.time - (carrier.lastDamageTime ?? -99)).toFixed(1));
console.log('plant site', game.map.siteAt(carrier.pos.x, carrier.pos.z)?.id, 'attackSite', game.attackSite, 'spot', game.currentPlantSpot);
for (const a of game.actors) {
  console.log(' ', a.name.padEnd(6), a.team, a.state.padEnd(9), a.pos.x.toFixed(1), a.pos.z.toFixed(1), 'tgt', a.target?.name || '-', 'hp', Math.round(a.health), 'carry', a.spikeCarrier);
}
