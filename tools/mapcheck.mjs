/**
 * Every arena must be playable: real CS2 geometry, spawns on walkable ground,
 * A and B reachable, plant spots inside the sites.
 */
import * as THREE from 'three';
import {
  MAPS, applyMap, ensureMap, WALLS, NAV_NODES, NAV_EDGES, SPAWNS, SITES, PLANT_SPOTS, HOLD_SPOTS,
} from '../src/world/mapLayout.js';
import { decodeMask } from '../src/world/gridLayout.js';

const insideWall = (x, z, pad = 0.2) => WALLS.some(([wx, wz, w, d]) =>
  x > wx - w / 2 - pad && x < wx + w / 2 + pad && z > wz - d / 2 - pad && z < wz + d / 2 + pad);

const reachableFrom = (startIdx) => {
  const seen = new Set([startIdx]);
  const q = [startIdx];
  while (q.length) {
    const i = q.pop();
    for (const e of NAV_EDGES[i] || []) {
      if (!seen.has(e.to)) { seen.add(e.to); q.push(e.to); }
    }
  }
  return seen;
};

const nearest = (x, z) => {
  let best = -1;
  let bd = Infinity;
  NAV_NODES.forEach((n, i) => {
    const d = (n.x - x) ** 2 + (n.z - z) ** 2;
    if (d < bd) { bd = d; best = i; }
  });
  return { i: best, d: Math.sqrt(bd) };
};

const rows = [];
let bad = 0;
for (const map of MAPS) {
  await ensureMap(map.id);
  const cells = decodeMask(map);
  const walkCells = cells.reduce((a, b) => a + b, 0);
  const start = nearest(SPAWNS.attacker[0].x, SPAWNS.attacker[0].z);
  const reach = reachableFrom(start.i);
  const siteReachable = (key) => NAV_NODES.some((n, i) => reach.has(i) &&
    Math.hypot(n.x - SITES[key].center.x, n.z - SITES[key].center.z) <= SITES[key].radius + 3);
  const siteA = { i: -1 };
  const siteB = { i: -1 };
  const spawnT = insideWall(SPAWNS.attacker[0].x, SPAWNS.attacker[0].z);
  const spawnCT = insideWall(SPAWNS.defender[0].x, SPAWNS.defender[0].z);
  const plantsInside = PLAINT_OK();
  function PLAINT_OK() {
    return ['A', 'B'].every((k) => PLANT_SPOTS[k].every((p) =>
      Math.hypot(p.x - SITES[k].center.x, p.z - SITES[k].center.z) <= SITES[k].radius + 1.2));
  }
  const reachA = siteReachable('A');
  const reachB = siteReachable('B');
  const ok = reachA && reachB && !spawnT && !spawnCT && plantsInside
    && NAV_NODES.length > 400 && WALLS.length > 100;
  if (!ok) bad++;
  rows.push({
    map: map.name,
    cells: walkCells,
    walls: WALLS.length,
    nav: NAV_NODES.length,
    'T→A': reachA,
    'T→B': reachB,
    spawnOK: !spawnT && !spawnCT,
    plants: plantsInside,
    ok,
  });
}
console.table(rows);
console.log(bad ? `✗ ${bad} map(s) not playable` : `✓ all ${MAPS.length} real maps are playable`);
process.exit(bad ? 1 : 0);
