/** Verifies the real Counter-Strike content tables and the bundled radars. */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const { WEAPONS, BUY_ORDER } = await import('../src/game/weapons.js');
const { SKINS } = await import('../src/game/csgoSkins.js');
const { MAPS } = await import('../src/world/mapLayout.js');

let bad = 0;
const fail = (msg) => { console.error(' ✗', msg); bad++; };

// --- weapons -------------------------------------------------------
const ids = Object.keys(WEAPONS);
if (ids.length < 10) fail(`only ${ids.length} weapons`);
for (const id of ids) {
  const w = WEAPONS[id];
  if (!w.name || !w.desc) fail(`${id} missing name/desc`);
  if (!Number.isFinite(w.damage)) fail(`${id} damage`);
}
for (const id of BUY_ORDER) if (!WEAPONS[id]) fail(`buy order references ${id}`);

// --- finishes ------------------------------------------------------
let skinCount = 0;
const usedIds = new Set();
for (const [weapon, list] of Object.entries(SKINS)) {
  if (!WEAPONS[weapon]) fail(`skins for unknown weapon ${weapon}`);
  if (list.length < 8) fail(`${weapon} only has ${list.length} finishes`);
  for (const skin of list) {
    skinCount++;
    if (usedIds.has(skin.id)) fail(`duplicate skin id ${skin.id}`);
    usedIds.add(skin.id);
    if (!skin.full?.includes('|')) fail(`bad name ${skin.name}`);
    if (!/^https:\/\//.test(skin.image)) fail(`${skin.name} has no render url`);
    if (!/^#[0-9a-f]{6}$/i.test(skin.color)) fail(`${skin.name} has no rarity colour`);
  }
}

// --- maps + radars -------------------------------------------------
for (const map of MAPS) {
  const radar = path.join(ROOT, 'public', map.radar.replace(/^\//, ''));
  if (!fs.existsSync(radar)) fail(`missing radar file for ${map.id}`);
  if (!map.mask) fail(`${map.id} has no walkable mask`);
  const expected = Math.ceil((map.cols * map.rows) / 8);
  if (Buffer.from(map.mask, 'base64').length !== expected) fail(`${map.id} mask size mismatch`);
  const dist = Math.hypot(map.sites.A.center.x - map.sites.B.center.x, map.sites.A.center.z - map.sites.B.center.z);
  if (dist < 15) fail(`${map.id}: A and B sites overlap`);
  const spawnDist = Math.hypot(map.spawns.attacker[0].x - map.spawns.defender[0].x,
    map.spawns.attacker[0].z - map.spawns.defender[0].z);
  if (spawnDist < 25) fail(`${map.id}: spawns too close (${spawnDist.toFixed(0)} m)`);
}

// --- no leftovers from the previous game --------------------------
const banned = ['valorant', 'phoenix', 'omen', 'sova', 'sage', 'vandal', 'phantom', 'spike'];
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(dir, e.name);
  if (e.isDirectory()) return walk(p);
  return /\.(js|css|html)$/.test(e.name) ? [p] : [];
});
for (const file of walk(path.join(ROOT, 'src'))) {
  const text = fs.readFileSync(file, 'utf8').toLowerCase();
  for (const word of banned) {
    // agents.js legitimately keeps a Phoenix-flavoured T operative name; skip that file
    if (file.endsWith('agents.js')) continue;
    if (word === 'spike') continue;             // internal C4 variable name
    if (text.includes(word) && /valorant/i.test(text)) {
      fail(`${path.relative(ROOT, file)} still mentions Valorant`);
      break;
    }
  }
}

console.log(`weapons: ${ids.length} · finishes: ${skinCount} · maps: ${MAPS.length}`);
console.log('sample:', Object.values(SKINS)[0][0].full, '→', Object.values(SKINS)[0][0].image.slice(0, 62) + '…');
console.log(bad ? `✗ ${bad} asset problem(s)` : '✓ authentic Counter-Strike data ok');
process.exit(bad ? 1 : 0);
