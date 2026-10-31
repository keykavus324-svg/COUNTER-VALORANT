// Layout validator: BFS over a grid to prove the map is fully connected.
// Usage: node tools/check-layout.mjs
import { WALLS, PROPS, SITES, SPAWNS, MAP_BOUNDS, NAV_NODES, PLANT_SPOTS } from '../src/world/mapLayout.js';

const CELL = 0.75;
const R = 0.62; // player radius inflation
const minX = MAP_BOUNDS.minX, maxX = MAP_BOUNDS.maxX;
const minZ = MAP_BOUNDS.minZ, maxZ = MAP_BOUNDS.maxZ;
const cols = Math.round((maxX - minX) / CELL);
const rows = Math.round((maxZ - minZ) / CELL);

const boxes = [];
for (const [x, z, w, d, h] of WALLS) boxes.push({ x, z, w, d, h });
for (const [x, z, w, d, h] of PROPS) boxes.push({ x, z, w, d, h });

const grid = new Uint8Array(cols * rows); // 0 free, 1 blocked
const cellCenter = (i) => ({ x: minX + (i % cols) * CELL + CELL / 2, z: minZ + Math.floor(i / cols) * CELL + CELL / 2 });

for (let i = 0; i < grid.length; i++) {
  const { x, z } = cellCenter(i);
  for (const b of boxes) {
    if (b.h < 0.5) continue;
    if (x > b.x - b.w / 2 - R && x < b.x + b.w / 2 + R && z > b.z - b.d / 2 - R && z < b.z + b.d / 2 + R) {
      grid[i] = 1;
      break;
    }
  }
}

const idxOf = (x, z) => {
  const c = Math.floor((x - minX) / CELL);
  const r = Math.floor((z - minZ) / CELL);
  return r * cols + c;
};

// nearest free cell
function nearestFree(x, z) {
  let best = -1, bestD = Infinity;
  for (let i = 0; i < grid.length; i++) {
    if (grid[i]) continue;
    const c = cellCenter(i);
    const d = (c.x - x) ** 2 + (c.z - z) ** 2;
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

function bfs(start) {
  const dist = new Int32Array(grid.length).fill(-1);
  const q = new Int32Array(grid.length);
  let head = 0, tail = 0;
  dist[start] = 0;
  q[tail++] = start;
  while (head < tail) {
    const cur = q[head++];
    const cx = cur % cols, cz = Math.floor(cur / cols);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, nz = cz + dz;
      if (nx < 0 || nz < 0 || nx >= cols || nz >= rows) continue;
      const ni = nz * cols + nx;
      if (grid[ni] || dist[ni] !== -1) continue;
      // no diagonal corner cutting needed (4-neighbour)
      dist[ni] = dist[cur] + 1;
      q[tail++] = ni;
    }
  }
  return dist;
}

const start = nearestFree(SPAWNS.attacker[0].x, SPAWNS.attacker[0].z);
const dist = bfs(start);

const checks = [
  ['site A center', SITES.A.center.x, SITES.A.center.z],
  ['site B center', SITES.B.center.x, SITES.B.center.z],
  ['defender spawn', SPAWNS.defender[0].x, SPAWNS.defender[0].z],
  ['A plant spots', ...Object.values(PLANT_SPOTS.A).map((_, i) => [PLANT_SPOTS.A[i].x, PLANT_SPOTS.A[i].z]).flat()],
];
let failed = 0;
const reach = (x, z) => {
  const i = nearestFree(x, z);
  const c = cellCenter(i);
  const d = (c.x - x) ** 2 + (c.z - z) ** 2;
  return { d: dist[i], off: Math.sqrt(d) };
};

const targets = [
  ['site A', SITES.A.center.x, SITES.A.center.z],
  ['site B', SITES.B.center.x, SITES.B.center.z],
  ['def spawn', SPAWNS.defender[0].x, SPAWNS.defender[0].z],
];
for (const s of PLANT_SPOTS.A) targets.push(['plantA', s.x, s.z]);
for (const s of PLANT_SPOTS.B) targets.push(['plantB', s.x, s.z]);
for (const n of NAV_NODES) targets.push([`nav:${n.tag}`, n.x, n.z]);

const seen = new Set();
for (const [name, x, z] of targets) {
  const r = reach(x, z);
  const key = `${name}@${x},${z}`;
  if (seen.has(key)) continue;
  seen.add(key);
  if (r.d < 0) { console.log(`✗ UNREACHABLE ${name} (${x}, ${z})`); failed++; }
  else if (r.off > 1.2) { console.log(`! ${name} blocked, nearest free cell ${r.off.toFixed(2)}m away`); failed++; }
}
console.log(failed === 0 ? `✓ all ${seen.size} targets reachable` : `✗ ${failed} problems`);

// ASCII plan (each char ~1.5m)
const STEP = 2;
let out = '';
for (let z = minZ; z < maxZ; z += STEP) {
  let line = '';
  for (let x = minX; x < maxX; x += STEP) {
    const i = idxOf(x + STEP / 2, z + STEP / 2);
    let ch = grid[i] ? '#' : '.';
    if (!grid[i]) {
      if (Math.hypot(x - SITES.A.center.x, z - SITES.A.center.z) < SITES.A.radius) ch = 'a';
      if (Math.hypot(x - SITES.B.center.x, z - SITES.B.center.z) < SITES.B.radius) ch = 'b';
      if (Math.hypot(x - SPAWNS.attacker[0].x, z - SPAWNS.attacker[0].z) < 3.4) ch = 'S';
      if (Math.hypot(x - SPAWNS.defender[0].x, z - SPAWNS.defender[0].z) < 3.4) ch = 'D';
    }
    line += ch;
  }
  out += line + '\n';
}
console.log(out);
if (failed) process.exitCode = 1;
