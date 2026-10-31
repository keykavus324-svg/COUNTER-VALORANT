/**
 * Validates the authentic-art data used by the game: every weapon should have
 * skins, uuids must be well formed, agent/map art must resolve to real URLs and
 * the local menu art must exist. Runs offline (no network needed).
 */
import { readFileSync, existsSync } from 'node:fs';
import { WEAPONS } from '../src/game/weapons.js';
import { AGENTS } from '../src/game/agents.js';
import {
  WEAPON_SKINS, AGENT_ART, MAP_ART, skinIconUrl, agentArtUrl, mapArtUrl,
} from '../src/game/valoAssets.js';

const problems = [];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const gunWeapons = Object.keys(WEAPONS).filter((id) => id !== 'knife');
for (const id of gunWeapons) {
  const skins = WEAPON_SKINS[id];
  if (!skins) { problems.push(`no skins for weapon "${id}"`); continue; }
  if (!skins.length) problems.push(`empty skin list for "${id}"`);
  for (const s of skins) {
    if (!UUID.test(s.uuid)) problems.push(`bad uuid for ${id} / ${s.name}: ${s.uuid}`);
    if (!s.name || s.name.length < 2) problems.push(`bad skin name for ${id}`);
  }
}

for (const [key, art] of Object.entries(AGENT_ART)) {
  if (!UUID.test(art.uuid)) problems.push(`bad agent uuid for ${key}`);
  for (const kind of ['fullportrait', 'icon', 'bust', 'killfeed']) {
    const url = agentArtUrl(key, kind);
    if (!url?.startsWith('https://media.valorant-api.com/agents/')) problems.push(`bad agent art url ${kind}/${key}`);
  }
}

for (const agent of Object.values(AGENTS)) {
  if (!age_key(agent)) problems.push(`agent ${agent.id} has no art key`);
  if (!AGENT_ART[agent.artKey]) problems.push(`agent ${agent.id} → unknown art key "${agent.artKey}"`);
}
function age_key(agent) { return !!(agent.artKey || agent.id); }

for (const m of MAP_ART) {
  if (!UUID.test(m.uuid)) problems.push(`bad map uuid for ${m.name}`);
  if (!m.desc || m.desc.length < 10) problems.push(`map ${m.name} has no description`);
  if (!mapArtUrl(m.uuid, 'splash')?.includes(m.uuid)) problems.push(`bad map url for ${m.name}`);
}

// local assets that must ship with the repo
for (const file of ['public/art/menu-keyart.jpg']) {
  if (!existsSync(new URL(`../${file}`, import.meta.url))) problems.push(`missing local asset ${file}`);
}

const weaponCount = gunWeapons.length;
const skinCount = Object.values(WEAPON_SKINS).reduce((n, l) => n + l.length, 0);
console.log(`weapons with skins: ${weaponCount} · skins: ${skinCount} · agents: ${Object.keys(AGENT_ART).length} · maps: ${MAP_ART.length}`);
console.log(`sample: ${skinIconUrl(WEAPON_SKINS.vandal[0].uuid)}`);

// the html must not reference the deleted image-search folder
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
if (html.includes('image-search')) problems.push('index.html still references image-search');

if (problems.length) {
  console.error(`✗ ${problems.length} asset problem(s):`);
  for (const p of problems) console.error('  - ' + p);
  process.exit(1);
}
console.log('✓ authentic art data ok');
