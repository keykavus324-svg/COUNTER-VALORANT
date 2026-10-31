// Headless smoke test for the DOM/UI layer: boots index.html inside jsdom and
// drives every public UI call the game makes, so menu regressions fail loudly
// instead of showing up as a blank screen in the browser.
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const dom = new JSDOM(html, { url: 'http://localhost:5173/', pretendToBeVisual: true, runScripts: 'outside-only' });
const { window } = dom;

globalThis.window = window;
globalThis.document = window.document;
globalThis.HTMLElement = window.HTMLElement;
globalThis.HTMLCanvasElement = window.HTMLCanvasElement;
globalThis.localStorage = window.localStorage;
globalThis.requestAnimationFrame = window.requestAnimationFrame?.bind(window) || ((cb) => setTimeout(() => cb(performance.now()), 16));
globalThis.cancelAnimationFrame = window.cancelAnimationFrame?.bind(window) || clearTimeout;
window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));

// ---- minimal 2d canvas context (jsdom has no canvas backend) ----
const gradient = { addColorStop() {} };
const ctx = new Proxy({}, {
  get(target, key) {
    if (key in target) return target[key];
    if (key === 'canvas') return { width: 220, height: 220 };
    if (key === 'measureText') return () => ({ width: 12 });
    if (key === 'createLinearGradient' || key === 'createRadialGradient' || key === 'createPattern') return () => gradient;
    return () => undefined;
  },
  set(target, key, value) { target[key] = value; return true; },
});
window.HTMLCanvasElement.prototype.getContext = function getContext() { return ctx; };

const errors = [];
const trap = (label, fn) => {
  try { fn(); } catch (err) { errors.push(`${label}: ${err?.stack || err}`); }
};

const { UI } = await import('../src/ui/ui.js');
const { AGENTS } = await import('../src/game/agents.js');
const { WEAPONS } = await import('../src/game/weapons.js');

const ui = new UI({ onStartMatch: () => {}, onExitToMenu: () => {}, settings: {} });

// ---- fake player for HUD driven code ----
const agent = Object.values(AGENTS).find((a) => a.abilities);
const fakePlayer = {
  isPlayer: true,
  alive: true,
  health: 87,
  armor: 50,
  shieldHp: 0,
  credits: 2900,
  flashTimer: 0,
  stunned: 0,
  yaw: 0.4,
  pos: { x: 3, y: 0, z: -5 },
  TEAM: 'ally',
  team: 'ally',
  agent,
  slots: { 1: 'vandal', 2: 'classic', 3: 'knife' },
  currentSlot: 1,
  activeWeapon: WEAPONS.vandal,
  ammo: { vandal: { mag: 18, reserve: 55 }, classic: { mag: 12, reserve: 36 } },
  abilityState: {},
  ultCost: 6,
};
for (const ab of agent.abilities) {
  fakePlayer.abilityState[ab.id] = { charges: ab.ultimate ? 0 : 1, maxCharges: ab.ultimate ? 1 : 1, cooldown: 0, cooldownMax: 1, ultPoints: 2 };
}
const fakeEnemy = { ...fakePlayer, isPlayer: false, team: 'enemy', agent: Object.values(AGENTS)[0], alive: true, revealed: 0, getEye: () => ({ x: 0, y: 1.6, z: -12 }) };
fakePlayer.getEye = () => ({ x: 3, y: 1.6, z: -5 });

const fakeGame = {
  player: fakePlayer,
  actors: [fakePlayer, fakeEnemy],
  attackingTeam: 'ally',
  spike: { state: 'planted', pos: { x: 20, z: -21 } },
  effects: { zones: [{ type: 'smoke', pos: { x: 0, z: 0 }, radius: 4 }] },
  hasClearSight: () => false,
};

trap('setMenuStats', () => ui.setMenuStats());
trap('showMenu', () => ui.showMenu());
trap('hideLoading', () => ui.hideLoading());
trap('setLoading', () => ui.setLoading(0.5, 'yükleniyor'));
trap('showAgentSelect', () => ui.showAgentSelect());
for (const id of Object.keys(AGENTS)) trap(`showAgentDetail(${id})`, () => ui.showAgentDetail(id));
trap('isMenuOpen/isTyping', () => { ui.isMenuOpen(); ui.isTyping(); ui.isOverlayOpen(); });
trap('showHUD', () => ui.showHUD(true));
trap('setMapName', () => ui.setMapName('DUNE'));
trap('bindGame', () => ui.bindGame(fakeGame));
trap('resetHUD', () => ui.resetHUD());
trap('buildWeaponSlots', () => ui.buildWeaponSlots(fakePlayer));
trap('updateWeapon', () => ui.updateWeapon(fakePlayer));
trap('buildAbilitySlots', () => ui.buildAbilitySlots(fakePlayer));
trap('updateAbilities', () => ui.updateAbilities(fakePlayer));
trap('flashAbility', () => ui.flashAbility(agent.abilities[0].id));
trap('setScore', () => ui.setScore(3, 2, [{ winner: 'ally' }, { winner: 'enemy' }], 6));
trap('setTimer', () => { ui.setTimer(32, 'CANLI', false); ui.setTimer(9, 'SPIKE', true); });
trap('setHUDPhase', () => { for (const p of ['buy', 'live', 'planted', 'roundEnd', 'matchEnd']) ui.setHUDPhase(p); });
trap('setCredits', () => ui.setCredits(4100));
trap('setWeaponName', () => ui.setWeaponName('VANDAL'));
trap('banner/toast/event', () => { ui.banner('TEST', 'alt başlık', 1); ui.toast('<b>toast</b>'); ui.event('olay'); });
trap('killBanner', () => ui.killBanner('VANDAL', 'VIPER', true));
trap('killfeed', () => ui.addKillfeed({ killer: 'SEN', victim: 'NYX', weapon: 'vandal', headshot: true, ally: true }));
trap('hitmarker', () => { ui.hitmarker(false, false); ui.hitmarker(true, true); });
trap('vignette/flash/blur', () => { ui.damageVignette(0.5); ui.flash(0.6); ui.blur(0.4); });
trap('interactHint', () => ui.interactHint('[F] SPIKE\'I KUR'));
trap('plant/defuse', () => { ui.plantProgress(0.6); ui.defuseProgress(0.3); ui.plantProgress(null); ui.defuseProgress(null); });
trap('scope', () => { ui.setScope(true); ui.setScope(false); });
trap('dead/spectate', () => { ui.setPlayerDead(true, 'VIPER'); ui.setSpectate('İZLENİYOR'); ui.setPlayerDead(false); });
trap('clickToPlay/pause', () => { ui.showClickToPlay(true); ui.showClickToPlay(false); ui.showPause(true); ui.showPause(false); });
trap('updateHUDTick', () => { for (let i = 0; i < 5; i++) ui.updateHUDTick(0.05, fakeGame); });
trap('drawMinimap', () => ui.drawMinimap(fakeGame));
trap('setPlayerDead', () => ui.setPlayerDead(false));

const buyData = {
  credits: 2900,
  weapons: { slots: { 1: null, 2: 'classic' }, armor: 0 },
  abilities: agent.abilities.map((ab) => ({ ...ab, state: { charges: 1, maxCharges: 1 }, price: 200 })),
};
trap('buyMenu', () => { ui.showBuyMenu(true, buyData); ui.showBuyMenu(false); });
trap('scoreboard', () => ui.showScoreboard(true, {
  allyScore: 3, enemyScore: 2, round: 6,
  ally: [{ agent: 'BLAZE', name: 'SEN', kills: 5, deaths: 2, damage: 640, credits: 2900, me: true, alive: true }],
  enemy: [{ agent: 'VIPER', name: 'VIPER', kills: 4, deaths: 3, damage: 520, credits: 2100, alive: false }],
}));
trap('scoreboard close', () => ui.showScoreboard(false));
trap('matchEnd', () => ui.showMatchEnd({ win: true, allyScore: 5, enemyScore: 2, player: { kills: 18, deaths: 9, damageDealt: 2140 } }));
trap('matchEnd close', () => ui.showMatchEnd(null));
trap('settings save/load', () => { ui.save(); ui.load(); ui.applySettingsToGame(); });
trap('startMatch', () => ui.startMatch());
trap('showMenu again', () => { ui.showMenu(); ui.showAgentSelect(); });

// duplicate ids / missing referenced nodes
const ids = [...document.querySelectorAll('[id]')].map((e) => e.id);
const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
if (dupes.length) errors.push(`duplicate ids: ${[...new Set(dupes)].join(', ')}`);

const nullEls = Object.entries(ui.el).filter(([, v]) => !v).map(([k]) => k);
if (nullEls.length) errors.push(`UI cached null elements: ${nullEls.join(', ')}`);

if (errors.length) {
  console.error(`✗ ${errors.length} UI error(s):`);
  for (const e of errors) console.error('  - ' + e.split('\n').slice(0, 3).join('\n    '));
  process.exit(1);
}
console.log(`✓ UI smoke test passed — ${ids.length} unique element ids, ${Object.keys(ui.el).length} cached refs, ${Object.keys(AGENTS).length} agents exercised`);
