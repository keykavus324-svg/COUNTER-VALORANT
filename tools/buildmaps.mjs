/**
 * Builds playable grid layouts from the official CS2 radar images.
 *
 *   assets-src/radar/de_dust2.png  (radar, 1024x1024)
 *   assets-src/radar/de_dust2.txt  (pos_x / pos_y / scale + spawn & bombsite coords)
 *      ↓
 *   src/world/maps/de_dust2.json   (walkable mask + real spawn/site coordinates)
 *   public/art/csgo/maps/de_dust2.png (the radar itself, used by the HUD + gallery)
 *
 * Run with: node tools/buildmaps.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'assets-src', 'radar');
const OUT = path.join(ROOT, 'src', 'world', 'maps');
const ART = path.join(ROOT, 'public', 'art', 'csgo', 'maps');

/** Source engine units → metres */
const UNIT = 0.0254;
/** grid cell size in metres */
const CELL = 0.5;

const MAPS = [
  // --- Active Duty ---
  { id: 'de_dust2', name: 'DUST II', theme: 'sand', kind: 'defuse' },
  { id: 'de_mirage', name: 'MIRAGE', theme: 'sand', kind: 'defuse' },
  { id: 'de_inferno', name: 'INFERNO', theme: 'terracotta', kind: 'defuse' },
  { id: 'de_nuke', name: 'NUKE', theme: 'industrial', kind: 'defuse' },
  { id: 'de_ancient', name: 'ANCIENT', theme: 'jungle', kind: 'defuse' },
  { id: 'de_anubis', name: 'ANUBIS', theme: 'sand', kind: 'defuse' },
  { id: 'de_vertigo', name: 'VERTIGO', theme: 'concrete', kind: 'defuse' },
  { id: 'de_train', name: 'TRAIN', theme: 'industrial', kind: 'defuse' },
  // --- klasikler ---
  { id: 'de_overpass', name: 'OVERPASS', theme: 'jungle', kind: 'defuse' },
  { id: 'cs_office', name: 'OFFICE', theme: 'concrete', kind: 'hostage' },
  { id: 'cs_italy', name: 'ITALY', theme: 'terracotta', kind: 'hostage' },
  { id: 'cs_agency', name: 'AGENCY', theme: 'concrete', kind: 'hostage' },
  // --- yeni haritalar ---
  { id: 'de_edin', name: 'EDIN', theme: 'concrete', kind: 'defuse' },
  { id: 'de_grail', name: 'GRAIL', theme: 'sanctuary', kind: 'defuse' },
  { id: 'de_palais', name: 'PALAIS', theme: 'terracotta', kind: 'defuse' },
  { id: 'de_basalt', name: 'BASALT', theme: 'industrial', kind: 'defuse' },
  { id: 'de_brewery', name: 'BREWERY', theme: 'terracotta', kind: 'defuse' },
  { id: 'de_whistle', name: 'WHISTLE', theme: 'jungle', kind: 'defuse' },
  { id: 'de_dogtown', name: 'DOGTOWN', theme: 'sand', kind: 'defuse' },
];

function parseMeta(txt) {
  const grab = (key) => {
    const m = txt.match(new RegExp(`"${key}"\\s*"?\\s*([-\\d.]+)`));
    return m ? parseFloat(m[1]) : null;
  };
  return {
    posX: grab('pos_x'),
    posY: grab('pos_y'),
    scale: grab('scale'),
    ctSpawn: [grab('CTSpawn_x'), grab('CTSpawn_y')],
    tSpawn: [grab('TSpawn_x'), grab('TSpawn_y')],
    bombA: [grab('bombA_x'), grab('bombA_y')],
    bombB: [grab('bombB_x'), grab('bombB_y')],
  };
}

// Radar colour tricks: everything walkable is tinted (some chroma), while the
// walls / roofs are drawn in neutral grey, and the empty space is transparent
// or black. That holds for every official radar, whatever palette it uses.
const classify = (r, g, b, a) => {
  if (a < 40) return 0;                                   // void
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  if (mx < 26) return 0;                                  // black backdrop
  const chroma = mx - mn;
  if (chroma <= 7) return mx > 55 ? -1 : 0;               // grey wall / dark detail
  return 1;                                               // tinted floor
};

for (const { id, name, theme, kind } of MAPS) {
  const pngPath = path.join(SRC, `${id}.png`);
  if (!fs.existsSync(pngPath)) { console.warn('skip (no radar)', id); continue; }
  const png = PNG.sync.read(fs.readFileSync(pngPath));
  const meta = parseMeta(fs.readFileSync(path.join(SRC, `${id}.txt`), 'utf8'));
  if (meta.posX == null || meta.scale == null) { console.warn('skip (no meta)', id); continue; }

  const { width, height } = png;
  const pxPerCell = CELL / (UNIT * meta.scale);

  // world bounds (metres) covered by the radar image
  const x0 = meta.posX * UNIT;
  const z1 = meta.posY * UNIT;
  const x1 = (meta.posX + width * meta.scale) * UNIT;
  const z0 = (meta.posY - height * meta.scale) * UNIT;
  const cols = Math.floor((x1 - x0) / CELL);
  const rows = Math.floor((z1 - z0) / CELL);

  const grid = new Uint8Array(cols * rows);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      let floor = 0;
      let solid = 0;
      let total = 0;
      const sx = (col * CELL) / (UNIT * meta.scale);
      const sy = (row * CELL) / (UNIT * meta.scale);
      const step = Math.max(1, Math.floor(pxPerCell / 4));
      for (let py = Math.floor(sy); py < sy + pxPerCell; py += step) {
        for (let px = Math.floor(sx); px < sx + pxPerCell; px += step) {
          if (px < 0 || py < 0 || px >= width || py >= height) continue;
          const i = (py * width + px) * 4;
          const r = png.data[i], g = png.data[i + 1], b = png.data[i + 2], a = png.data[i + 3];
          total++;
          const kind = classify(r, g, b, a);
          if (kind === 1) floor++;
          else if (kind === -1) solid++;
        }
      }
      if (!total) continue;
      const f = floor / total;
      const s = solid / total;
      grid[row * cols + col] = f > 0.5 && s < 0.15 ? 1 : 0;
    }
  }

  // --- connectivity: only keep the region the attackers can actually reach --
  const at = (c, r) => (c < 0 || r < 0 || c >= cols || r >= rows ? 0 : grid[r * cols + c]);
  const px2world = (nx, ny) => ({ x: x0 + nx * (x1 - x0), z: z1 - ny * (z1 - z0) });
  const cellOf = (p) => ({
    c: Math.round((p.x - x0) / CELL - 0.5),
    r: Math.round((z1 - p.z) / CELL - 0.5),
  });
  const worldOf = (c, r) => ({ x: x0 + (c + 0.5) * CELL, z: z1 - (r + 0.5) * CELL });

  const hasSpawns = meta.tSpawn[0] != null && meta.ctSpawn[0] != null;
  const hasSites = meta.bombA[0] != null && meta.bombB[0] != null;
  const tGuess = cellOf(px2world(meta.tSpawn[0] ?? 0.5, meta.tSpawn[1] ?? 0.9));
  const ctGuess = cellOf(px2world(meta.ctSpawn[0] ?? 0.5, meta.ctSpawn[1] ?? 0.1));
  const aGuess = cellOf(px2world(meta.bombA[0] ?? 0.8, meta.bombA[1] ?? 0.2));
  const bGuess = cellOf(px2world(meta.bombB[0] ?? 0.2, meta.bombB[1] ?? 0.2));

  const nearestWalkable = (c0, r0, within = 60) => {
    let best = null;
    let bd = Infinity;
    for (let r = r0 - within; r <= r0 + within; r++) {
      for (let c = c0 - within; c <= c0 + within; c++) {
        if (!at(c, r)) continue;
        const d = (c - c0) ** 2 + (r - r0) ** 2;
        if (d < bd) { bd = d; best = { c, r }; }
      }
    }
    return best;
  };

  const flood = (seed) => {
    const seen = new Uint8Array(cols * rows);
    if (!seed) return seen;
    const q = [seed.r * cols + seed.c];
    seen[q[0]] = 1;
    while (q.length) {
      const i = q.pop();
      const c = i % cols;
      const r = (i - c) / cols;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const cc = c + dc, rr = r + dr;
        if (cc < 0 || rr < 0 || cc >= cols || rr >= rows) continue;
        const j = rr * cols + cc;
        if (grid[j] && !seen[j]) { seen[j] = 1; q.push(j); }
      }
    }
    return seen;
  };

  // label connected components and keep only the big playable island
  const label = new Int32Array(cols * rows).fill(-1);
  const comps = [];
  for (let i = 0; i < cols * rows; i++) {
    if (!grid[i] || label[i] >= 0) continue;
    const id2 = comps.length;
    const q = [i];
    label[i] = id2;
    let size = 0;
    let sumC = 0;
    let sumR = 0;
    while (q.length) {
      const j = q.pop();
      size++;
      const c = j % cols;
      const r = (j - c) / cols;
      sumC += c; sumR += r;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const cc = c + dc, rr = r + dr;
        if (cc < 0 || rr < 0 || cc >= cols || rr >= rows) continue;
        const k = rr * cols + cc;
        if (grid[k] && label[k] < 0) { label[k] = id2; q.push(k); }
      }
    }
    comps.push({ id: id2, size, c: sumC / size, r: sumR / size });
  }
  comps.sort((a, b) => b.size - a.size);
  const main = comps[0];
  if (!main) { console.warn('no walkable area on', id); continue; }
  for (let i = 0; i < grid.length; i++) if (grid[i] && label[i] !== main.id) grid[i] = 0;

  const nearestInMain = (c0, r0, within = 120) => {
    let best = null;
    let bd = Infinity;
    for (let r = Math.max(0, r0 - within); r < Math.min(rows, r0 + within); r++) {
      for (let c = Math.max(0, c0 - within); c < Math.min(cols, c0 + within); c++) {
        if (!grid[r * cols + c]) continue;
        const d = (c - c0) ** 2 + (r - r0) ** 2;
        if (d < bd) { bd = d; best = { c, r }; }
      }
    }
    return best || { c: Math.round(main.c), r: Math.round(main.r) };
  };

  /**
   * Community maps ship without spawn / bombsite metadata. Infer them from the
   * walkable island: the two spawns sit at the opposite ends of the longest
   * axis, and the sites are the two pockets furthest from the spawn line.
   */
  const inferLayout = () => {
    const cellsSample = [];
    for (let r = 0; r < rows; r += 2) {
      for (let c = 0; c < cols; c += 2) if (grid[r * cols + c]) cellsSample.push({ c, r });
    }
    if (!cellsSample.length) return null;
    let minC = Infinity; let maxC = -Infinity; let minR = Infinity; let maxR = -Infinity;
    for (const p of cellsSample) {
      minC = Math.min(minC, p.c); maxC = Math.max(maxC, p.c);
      minR = Math.min(minR, p.r); maxR = Math.max(maxR, p.r);
    }
    // double sweep: BFS from an arbitrary cell, then from the farthest cell
    const sweep = (start) => {
      const dist = new Int32Array(cols * rows).fill(-1);
      const q = [start.r * cols + start.c];
      dist[q[0]] = 0;
      let far = start;
      let farD = 0;
      for (let head = 0; head < q.length; head++) {
        const i = q[head];
        const c = i % cols;
        const r = (i - c) / cols;
        const d = dist[i];
        if (d > farD) { farD = d; far = { c, r }; }
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const cc = c + dc; const rr = r + dr;
          if (cc < 0 || rr < 0 || cc >= cols || rr >= rows) continue;
          const j = rr * cols + cc;
          if (!grid[j] || dist[j] >= 0) continue;
          dist[j] = d + 1;
          q.push(j);
        }
      }
      return far;
    };
    const endA = sweep(cellsSample[0]);
    const endB = sweep(endA);
    const t = endA;
    const ctCell = endB;
    const dx = ctCell.c - t.c;
    const dr = ctCell.r - t.r;
    const len = Math.hypot(dx, dr) || 1;
    // sites: the farthest apart pair of cells inside the middle band of the
    // island — that is where a bomb site can realistically sit.
    const band = [];
    for (const p2 of cellsSample) {
      const along = ((p2.c - t.c) * dx + (p2.r - t.r) * dr) / len;
      if (along > len * 0.25 && along < len * 0.9) band.push(p2);
    }
    const pool = band.length > 6 ? band : cellsSample;
    let bestA = pool[0];
    let bestB = pool[pool.length - 1];
    let bestD = -1;
    const step2 = Math.max(1, Math.floor(pool.length / 260));
    for (let i = 0; i < pool.length; i += step2) {
      for (let j = i + step2; j < pool.length; j += step2) {
        const d = (pool[i].c - pool[j].c) ** 2 + (pool[i].r - pool[j].r) ** 2;
        if (d > bestD) { bestD = d; bestA = pool[i]; bestB = pool[j]; }
      }
    }
    return {
      t: t || null,
      ct: ctCell || null,
      a: bestA || null,
      b: bestB || null,
    };
  };

  const inferred = inferLayout();

  const seed = hasSpawns
    ? nearestInMain(tGuess.c, tGuess.r)
    : (inferred?.t || nearestInMain(tGuess.c, tGuess.r));
  const ct = hasSpawns
    ? nearestInMain(ctGuess.c, ctGuess.r)
    : (inferred?.ct || nearestInMain(ctGuess.c, ctGuess.r));
  if (!hasSites && inferred) {
    aGuess.c = inferred.a.c; aGuess.r = inferred.a.r;
    bGuess.c = inferred.b.c; bGuess.r = inferred.b.r;
  }

  const siteFrom = (guess) => {
    const s = nearestInMain(guess.c, guess.r, 40);
    const center = worldOf(s.c, s.r);
    // radius: how far the floor reaches around the site
    let rad = 0;
    for (let ring = 2; ring <= 22; ring++) {
      let ok = 0;
      let n = 0;
      for (let a = 0; a < 24; a++) {
        const ang = (a / 24) * Math.PI * 2;
        const c = Math.round(s.c + Math.cos(ang) * ring);
        const r = Math.round(s.r + Math.sin(ang) * ring);
        n++;
        ok += at(c, r);
      }
      if (ok / n > 0.35) rad = ring * CELL;
    }
    return { center, radius: Math.max(4, Math.min(12, rad + 1.5)), cell: s };
  };

  let siteA = siteFrom(aGuess);
  let siteB = siteFrom(bGuess);

  // --- sanity pass: community maps often ship bogus landmark coordinates ---
  const far = (p, q) => Math.hypot(p.x - q.x, p.z - q.z);
  if (inferred && far(siteA.center, siteB.center) < 18) {
    siteA = siteFrom(inferred.a);
    siteB = siteFrom(inferred.b);
  }
  if (inferred && siteA.cell && siteB.cell
    && Math.abs(siteA.cell.c - siteB.cell.c) + Math.abs(siteA.cell.r - siteB.cell.r) < 20) {
    siteA = siteFrom(inferred.a);
    siteB = siteFrom(inferred.b);
  }
  if (far(worldOf(seed.c, seed.r), worldOf(ct.c, ct.r)) < 25 && inferred) {
    seed.c = inferred.t.c; seed.r = inferred.t.r;
    ct.c = inferred.ct.c; ct.r = inferred.ct.r;
  }

  const cluster = (base, count) => {
    const out = [];
    const free = [];
    for (let r = base.r - 16; r <= base.r + 16; r++) {
      for (let c = base.c - 16; c <= base.c + 16; c++) {
        if (at(c, r)) free.push({ ...worldOf(c, r), d: (c - base.c) ** 2 + (r - base.r) ** 2 });
      }
    }
    free.sort((a, b) => a.d - b.d);
    for (let i = 0; i < count; i++) {
      const p = free[Math.min(free.length - 1, i * 3)] || worldOf(base.c, base.r);
      out.push({ x: +p.x.toFixed(2), z: +p.z.toFixed(2) });
    }
    return out;
  };

  // pack the mask as base64 (1 bit per cell) to keep the bundle small
  const bytes = Buffer.alloc(Math.ceil((cols * rows) / 8));
  for (let i = 0; i < cols * rows; i++) if (grid[i]) bytes[i >> 3] |= 1 << (7 - (i & 7));

  const out = {
    id,
    name,
    theme,
    kind: kind || 'defuse',
    radar: `/art/csgo/maps/${id}.png`,
    cell: CELL,
    cols,
    rows,
    origin: { x: +x0.toFixed(2), z: +z1.toFixed(2) },
    bounds: { minX: x0, maxX: x1, minZ: z0, maxZ: z1 },
    meta: { posX: meta.posX, posY: meta.posY, scale: meta.scale },
    spawns: {
      attacker: cluster(seed, 5),
      defender: cluster(ct, 5),
    },
    sites: {
      A: { center: { x: +siteA.center.x.toFixed(2), z: +siteA.center.z.toFixed(2) }, radius: +siteA.radius.toFixed(2) },
      B: { center: { x: +siteB.center.x.toFixed(2), z: +siteB.center.z.toFixed(2) }, radius: +siteB.radius.toFixed(2) },
    },
    mask: bytes.toString('base64'),
  };

  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(ART, { recursive: true });
  fs.writeFileSync(
    path.join(OUT, `${id}.js`),
    `/** ${name} — generated by tools/buildmaps.mjs from the official CS2 radar. */\nexport default ${JSON.stringify(out)};\n`,
  );
  fs.copyFileSync(pngPath, path.join(ART, `${id}.png`));

  const tW = worldOf(seed.c, seed.r);
  const ctW = worldOf(ct.c, ct.r);
  const dSpawn = Math.hypot(tW.x - ctW.x, tW.z - ctW.z);
  const dSites = Math.hypot(siteA.center.x - siteB.center.x, siteA.center.z - siteB.center.z);
  if (dSpawn < 30 || dSites < 15) {
    console.warn(`  ! ${id}: spawn/site layout suspicious (T↔CT ${dSpawn.toFixed(0)}m, A↔B ${dSites.toFixed(0)}m)`);
  }
  let walk = 0;
  for (let i = 0; i < grid.length; i++) walk += grid[i];
  console.log(
    `${id.padEnd(12)} ${cols}x${rows} cells · ${(walk * CELL * CELL).toFixed(0)} m² walkable · ` +
    `A ${siteA.center.x.toFixed(0)},${siteA.center.z.toFixed(0)} (r${siteA.radius.toFixed(1)}) · ` +
    `B ${siteB.center.x.toFixed(0)},${siteB.center.z.toFixed(0)} (r${siteB.radius.toFixed(1)}) · ` +
    `T ${worldOf(seed.c, seed.r).x.toFixed(0)},${worldOf(seed.c, seed.r).z.toFixed(0)} · ` +
    `CT ${worldOf(ct.c, ct.r).x.toFixed(0)},${worldOf(ct.c, ct.r).z.toFixed(0)}`,
  );
}
