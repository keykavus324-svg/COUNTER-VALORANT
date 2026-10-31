/**
 * Headless simulation harness.
 * Stubs out the DOM + WebGL so the complete game loop (map, bots, rounds,
 * abilities, spike logic) can be exercised in Node without a browser.
 *
 *   node tools/headless-sim.mjs [seconds]
 */
const TOTAL_SECONDS = Number(process.argv[2] || 240);

/* ----------------------------- DOM stubs ----------------------------- */
const gradient = { addColorStop() {} };
function makeCtx() {
  const ctx = {
    canvas: { width: 512, height: 512 },
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    createPattern: () => ({}),
    getImageData: (x, y, w, h) => ({
      data: new Uint8ClampedArray(Math.max(4, w * h * 4)),
      width: w, height: h,
    }),
    putImageData() {},
    measureText: () => ({ width: 10 }),
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
  };
  return new Proxy(ctx, {
    get(target, prop) {
      if (prop in target) return target[prop];
      return () => {};
    },
    set(target, prop, value) { target[prop] = value; return true; },
  });
}

function makeCanvas(w = 512, h = 512) {
  const c = { width: w, height: h, style: {}, getContext: () => makeCtx() };
  return c;
}

const listeners = {};
globalThis.window = {
  innerWidth: 1280,
  innerHeight: 720,
  devicePixelRatio: 1,
  addEventListener: (t, f) => { (listeners[t] ||= []).push(f); },
  removeEventListener() {},
  AudioContext: undefined,
  requestAnimationFrame: (cb) => setTimeout(() => cb(performance.now()), 0),
  cancelAnimationFrame: (id) => clearTimeout(id),
  matchMedia: () => ({ matches: false, addListener() {}, removeListener() {} }),
};
globalThis.requestAnimationFrame = window.requestAnimationFrame;
globalThis.cancelAnimationFrame = window.cancelAnimationFrame;
globalThis.document = {
  createElement: (tag) => (tag === 'canvas' ? makeCanvas() : { style: {}, classList: { add() {}, remove() {}, toggle() {} }, appendChild() {}, addEventListener() {} }),
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener() {},
  removeEventListener() {},
  exitPointerLock() {},
  pointerLockElement: null,
  body: { classList: { add() {}, remove() {}, toggle() {} } },
  documentElement: { style: { setProperty() {} } },
  activeElement: null,
};
// navigator exists in node

/* ----------------------------- imports ------------------------------ */
const { Game } = await import('../src/game/game.js');
const THREE = await import('three');

/* ----------------------------- UI stub ------------------------------ */
const noop = () => {};
const ui = new Proxy({}, {
  get(target, prop) {
    if (prop === 'isOverlayOpen' || prop === 'isMenuOpen' || prop === 'isTyping') return () => false;
    return () => {};
  },
});

/* ----------------------------- run --------------------------------- */
let errors = 0;
const origError = console.error;
console.error = (...args) => { errors++; origError('[runtime]', ...args); };

const game = new Game({
  canvas: makeCanvas(1280, 720),
  ui,
  settings: { quality: 'low', sens: 0.45, fov: 90, music: 0, volume: 0 },
  agentId: process.argv[3] || 'blaze',
  headless: true,
  onExit: noop,
});
game.init();
game.start();

const dt = 1 / 60;
const steps = Math.round(TOTAL_SECONDS / dt);
let frames = 0;
let lastPhase = game.phase;
const phaseTally = {};
const roundLog = [];
const player = game.player;

// very simple "auto player": walks forward, aims at visible enemies and fires
let aiTimer = 0;
let lastRound = -1;
function autoPlay(dt) {
  game.input.forward = true;
  game.input.fireHeld = false;
  game.input.firePressed = false;
  aiTimer -= dt;
  // find target
  let best = null;
  let bestD = Infinity;
  for (const a of game.actors) {
    if (!a.alive || a.team === player.team) continue;
    const eye = player.getEye(new THREE.Vector3());
    const tEye = a.getEye(new THREE.Vector3());
    if (!game.hasClearSight(eye, tEye)) continue;
    const d = eye.distanceTo(tEye);
    if (d < bestD) { bestD = d; best = a; }
  }
  if (best) {
    const eye = player.getEye(new THREE.Vector3());
    const tEye = best.getEye(new THREE.Vector3());
    const dx = tEye.x - eye.x;
    const dy = tEye.y - eye.y;
    const dz = tEye.z - eye.z;
    player.yaw = Math.atan2(-dx, -dz);
    player.pitch = Math.atan2(dy, Math.hypot(dx, dz));
    if (aiTimer <= 0) {
      aiTimer = 0.4;
      game.input.firePressed = true;
      game.input.fireHeld = true;
      player.attemptFire();
    }
  } else {
    // wander towards the objective
    const target = player.team === game.attackingTeam ? game.currentPlantSpot : { x: 0, z: -20 };
    const dx = target.x - player.pos.x;
    const dz = target.z - player.pos.z;
    player.yaw = Math.atan2(-dx, -dz);
    player.pitch = 0;
    game.input.forward = Math.hypot(dx, dz) > 2;
  }
  // ability usage
  if (Math.random() < dt * 0.25) {
    const abs = player.agent.abilities;
    const ab = abs[Math.floor(Math.random() * abs.length)];
    player.castAbility(ab.key);
  }
  // plant / defuse
  game.input.interact = game.spike.state === 'planted' || player.spikeCarrier;
}

const origOnKill = game.onKill.bind(game);
game.onKill = (victim, attacker, weaponId, headshot) => {
  if (process.env.VERBOSE) {
    console.log(`  KILL t=${game.time.toFixed(1)} ${attacker?.name || '?'} -> ${victim.name} (${weaponId}${headshot ? ' HS' : ''}) at ${victim.pos.x.toFixed(1)},${victim.pos.z.toFixed(1)} phase=${game.phase}`);
  }
  origOnKill(victim, attacker, weaponId, headshot);
};

for (let i = 0; i < steps; i++) {
  if (game.roundNumber !== lastRound) {
    lastRound = game.roundNumber;
    if (player.spikeCarrier) {
      player.spikeCarrier = false;
      const bot = game.actors.find((a) => a.team === game.attackingTeam && !a.isPlayer && a.alive);
      if (bot) { bot.spikeCarrier = true; game.spike.carrier = bot; }
    }
  }
  autoPlay(dt);
  try {
    game.update(dt);
  } catch (err) {
    errors++;
    origError('[update error]', err?.stack || err);
    if (errors > 28) break;
  }
  frames++;
  if (game.phase !== lastPhase) {
    phaseTally[game.phase] = (phaseTally[game.phase] || 0) + 1;
    if (game.phase === 'roundEnd' || game.phase === 'matchEnd') {
      roundLog.push(`${game.roundNumber}: ${game.scores.ally}-${game.scores.enemy} (${game.roundWinner || '-'})`);
    }
    lastPhase = game.phase;
  }
  if (game.matchOver && game.phase === 'matchEnd') break;
  if (process.env.VERBOSE && i % 300 === 0) {
    const alive = game.actors.filter((a) => a.alive).length;
    console.log(`\nt=${(i * dt).toFixed(0)}s phase=${game.phase} t=${game.phaseTimer.toFixed(0)} round=${game.roundNumber} score=${game.scores.ally}-${game.scores.enemy} alive=${alive} spike=${game.spike.state}@${game.spike.pos.x.toFixed(0)},${game.spike.pos.z.toFixed(0)} carrier=${game.spike.carrier?.name} site=${game.attackSite} plant=${game.currentPlantSpot.x},${game.currentPlantSpot.z}`);
    for (const a of game.actors) {
      if (a.isPlayer) continue;
      console.log(`   ${a.name.padEnd(6)} ${a.team.padEnd(6)} pos=${a.pos.x.toFixed(1)},${a.pos.z.toFixed(1)} state=${a.state} goal=${a.holdSpot ? a.holdSpot.x.toFixed(0)+','+a.holdSpot.z.toFixed(0) : '-'} tgt=${a.moveTarget ? a.moveTarget.x.toFixed(0)+','+a.moveTarget.z.toFixed(0) : '-'} path=${a.path ? a.path.length : 'n'} plantT=${(a.plantTimer||0).toFixed(1)} carrier=${a.spikeCarrier}`);
    }
  }
}

console.log('\n===== RESULT =====');
console.log('simulated seconds:', (frames * dt).toFixed(1));
console.log('rounds:', roundLog.join(' | '));
console.log('final score:', game.scores.ally, '-', game.scores.enemy, 'phase:', game.phase);
const alive = game.actors.map((a) => `${a.name}(${a.team},${a.agentId}) hp=${Math.round(a.health)}${a.alive ? '' : ' DEAD'}`);
console.log('actors:', alive.join(', '));
console.log('player K/D:', player.kills, player.deaths, 'damage:', Math.round(player.damageDealt));
console.log('phase tally:', phaseTally);
console.log('runtime errors:', errors);
process.exit(errors ? 1 : 0);
