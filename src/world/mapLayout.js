/**
 * Map registry + live layout data for COUNTER-STRIKE: BROWSER OPS.
 *
 * Every arena is generated from the official CS2 radar of the real map
 * (see tools/buildmaps.mjs): the walkable mask becomes collision geometry and
 * a navigation graph, so de_dust2's long, tunnels, catwalk and mid are where
 * they are in the real thing.
 *
 * The exported arrays are mutated by applyMap() so every consumer (map builder,
 * bots, UI, radar) always reads the currently selected arena.
 */
import { decodeMask, buildWalls, buildNav, buildSpots, WALL_HEIGHT } from './gridLayout.js';
import { bakedMap, loadBakedMap, preloadBakedMap } from '../data/maps/index.js';

import de_dust2 from './maps/de_dust2.js';
import de_mirage from './maps/de_mirage.js';
import de_inferno from './maps/de_inferno.js';
import de_nuke from './maps/de_nuke.js';
import de_ancient from './maps/de_ancient.js';
import de_anubis from './maps/de_anubis.js';
import de_vertigo from './maps/de_vertigo.js';
import de_train from './maps/de_train.js';
import de_overpass from './maps/de_overpass.js';
import cs_office from './maps/cs_office.js';
import cs_italy from './maps/cs_italy.js';
import cs_agency from './maps/cs_agency.js';
import de_edin from './maps/de_edin.js';
import de_grail from './maps/de_grail.js';
import de_palais from './maps/de_palais.js';
import de_basalt from './maps/de_basalt.js';
import de_brewery from './maps/de_brewery.js';
import de_whistle from './maps/de_whistle.js';
import de_dogtown from './maps/de_dogtown.js';

export { WALL_HEIGHT };
export const BOUND_WALL_HEIGHT = 9;

/** The real map list, dust2 first. */
export const MAPS = [
  de_dust2, de_mirage, de_inferno, de_nuke, de_ancient, de_anubis, de_vertigo, de_train,
  de_overpass, cs_office, cs_italy, cs_agency,
  de_edin, de_grail, de_palais, de_basalt, de_brewery, de_whistle, de_dogtown,
];
export const MAP_BY_ID = Object.fromEntries(MAPS.map((m) => [m.id, m]));

/** Cosmetic palettes per map theme. */
export const THEMES = {
  sand: {
    label: 'SAND', desc: 'Çöl tozu, kireç taşı duvarlar',
    wall: 0xd9bf8c, wallDark: 0x9c7f52, floor: 0x8d7a58, ground: 0x8a7550, groundTint: 0xc0a274,
    crate: 0x9a6c38, sky: [0x3f7fc4, 0x8fbde4, 0xe9dcc0], sun: 0xfff0d2, hemi: [0xdfe8f5, 0x6b5638],
  },
  terracotta: {
    label: 'TERRACOTTA', desc: 'Kızıl kiremit, taş sokaklar',
    wall: 0xc26a45, wallDark: 0x7c3d28, floor: 0x8a6a52, ground: 0x7d5c45, groundTint: 0xb08363,
    crate: 0x8a5a36, sky: [0x4679b8, 0x9dc0d8, 0xf0d8b4], sun: 0xffd6a8, hemi: [0xf0dcc4, 0x5f4230],
  },
  industrial: {
    label: 'INDUSTRIAL', desc: 'Beton, çelik, soğuk ışık',
    wall: 0x939ba3, wallDark: 0x50575e, floor: 0x6c7278, ground: 0x565c62, groundTint: 0x8b9298,
    crate: 0x6b6f56, sky: [0x5b7690, 0x9fb4c6, 0xd8e2ea], sun: 0xe8f0ff, hemi: [0xd6e2ee, 0x42484e],
  },
  jungle: {
    label: 'JUNGLE', desc: 'Yosun, taş, nemli hava',
    wall: 0x8e906f, wallDark: 0x51573c, floor: 0x6d7550, ground: 0x4f5c3c, groundTint: 0x7d8a58,
    crate: 0x6b5533, sky: [0x5d8a86, 0x9fbdb0, 0xdce6d2], sun: 0xe6f2cf, hemi: [0xd8e6d0, 0x3c452e],
  },
  sanctuary: {
    label: 'SANCTUARY', desc: 'Mermer, altın, kutsal ışık',
    wall: 0xd6c9a1, wallDark: 0x8f7f55, floor: 0x94886a, ground: 0x8a7f60, groundTint: 0xc4b791,
    crate: 0x9a8a5f, sky: [0x6f8fb8, 0xa9bfcf, 0xf0e2c0], sun: 0xfff2cc, hemi: [0xf2e8cf, 0x6a5f45],
  },
  concrete: {
    label: 'VERTIGO', desc: 'Yüksek beton, cam cephe',
    wall: 0xb9bcc0, wallDark: 0x8b8f94, floor: 0xa8abaf, ground: 0x8f9297, groundTint: 0xc2c5c9,
    crate: 0x9aa0a4, sky: [0xa8c8e8, 0xd2e2f2, 0xeef4f8], sun: 0xf4f8ff, hemi: [0xdfeaf6, 0x7d838a],
  },
};

/* ------------------------------------------------------------------ */
/* live layout data (mutated by applyMap)                              */
/* ------------------------------------------------------------------ */
export const MAP_BOUNDS = { minX: -45, maxX: 45, minZ: -45, maxZ: 45 };
/** [x, z, w, d, h, kind] */
export const WALLS = [];
/** [x, z, w, d, h, type] */
export const PROPS = [];
/** [x, z, w, d, material] */
export const FLOORS = [];
export const SITES = {
  A: { id: 'A', center: { x: 0, z: 0 }, radius: 8, label: 'A' },
  B: { id: 'B', center: { x: 0, z: 0 }, radius: 8, label: 'B' },
};
export const SPAWNS = { attacker: [{ x: 0, z: 10 }], defender: [{ x: 0, z: -10 }] };
export const NAV_NODES = [];
export const NODE_SCORES = [];
export const NAV_EDGES = [];
export const PLANT_SPOTS = { A: [], B: [] };
export const HOLD_SPOTS = { A: [], B: [], mid: [] };
export const POST_PLANT_SPOTS = { A: [], B: [], mid: [] };
export const ATTACK_PATHS = { A: {}, B: {} };

export let CURRENT_MAP = MAPS[0];
let built = null;

const reset = (arr) => { arr.length = 0; return arr; };

/** Cover score of a spot, looked up from the baked per waypoint table. */
function spotScore(baked, spot) {
  if (!baked?.NODE_SCORES || !baked.NODES) return 0;
  let best = 0;
  let bd = Infinity;
  for (let i = 0; i < baked.NODES.length; i++) {
    const n = baked.NODES[i];
    const d = (n[0] - spot.x) ** 2 + (n[1] - spot.z) ** 2;
    if (d < bd) { bd = d; best = i; }
  }
  return baked.NODE_SCORES[best]?.[2] ?? 0;
}

/**
 * Async variant: makes sure the baked waypoint table of `mapId` has been
 * downloaded (they are code-split per map), then activates it. Used before a
 * match starts and by the map gallery when the player hovers a card.
 */
export async function ensureMap(mapId) {
  const map = MAP_BY_ID[mapId] || MAPS[0];
  await loadBakedMap(map.id);
  return applyMap(map.id);
}

export { preloadBakedMap };

/**
 * Build (once) and activate the layout of a real map.
 * Returns the ready-to-use arena description.
 */
export function applyMap(mapId, { bake = false } = {}) {
  const map = MAP_BY_ID[mapId] || MAPS[0];
  CURRENT_MAP = map;
  const baked = bakedMap(map.id);
  // a metadata-only placeholder (see below) is never a finished build
  if (!built || built.id !== map.id || (baked && !built.nodes.length)) {
    if (baked) {
      // pre-baked at build time by tools/genmaps.mjs: no geometry work on load
      const TAG_NAMES = ['map', 'A', 'B', 'mid', 'spawn'];
      const nodes = baked.NODES.map(([x, z, t]) => ({ x, z, tag: TAG_NAMES[t] || 'map' }));
      const edges = baked.EDGES.map((list) => list.map((to) => ({
        to, cost: Math.hypot(nodes[to].x - 0, nodes[to].z - 0) || 1,
      })));
      // recompute edge costs from the actual node positions
      for (let i = 0; i < edges.length; i++) {
        for (const e of edges[i]) {
          e.cost = Math.hypot(nodes[e.to].x - nodes[i].x, nodes[e.to].z - nodes[i].z);
        }
      }
      const extra = { scores: baked.NODE_SCORES || [], props: baked.PROPS || [] };
      // rank hold spots by how much cover they offer (baked score index 2)
      const rank = (list) => list.slice().sort((a, b) => {
        const sa = spotScore(baked, a);
        const sb = spotScore(baked, b);
        return sb - sa;
      });
      const spots = {
        plantSpots: { A: baked.SPOTS.plant.A, B: baked.SPOTS.plant.B },
        holdSpots: baked.SPOTS.hold,
        attackPaths: {},
      };
      for (const key of ['A', 'B']) {
        const routes = {};
        for (const [lane, pts] of Object.entries(baked.SPOTS.paths?.[key] || {})) {
          routes[lane] = pts;   // [x, z] pairs, as bot.resetForRound expects
        }
        spots.attackPaths[key] = routes;
      }
      built = { id: map.id, walls: baked.WALLS, nodes, edges, spots, theme: THEMES[map.theme] || THEMES.sand, ...extra };
    } else if (!bake) {
      // The baked table for this arena has not been fetched yet (they are code
      // split). Publish the metadata only — the heavy mask bake below is the
      // slow path and must never run at boot; ensureMap() awaits the real data.
      built = {
        id: map.id,
        walls: [],
        nodes: [],
        edges: [],
        spots: { plantSpots: { A: [], B: [] }, holdSpots: { A: [], B: [], mid: [] }, attackPaths: { A: {}, B: {} } },
        theme: THEMES[map.theme] || THEMES.sand,
      };
    } else {
      const cells = decodeMask(map);
      const walls = buildWalls(map, cells);
      const { nodes, edges } = buildNav(map, cells);
      const spots = buildSpots(map, cells, nodes, edges);
      built = { id: map.id, walls, nodes, edges, spots, theme: THEMES[map.theme] || THEMES.sand };
    }
  }

  reset(WALLS).push(...built.walls);

  reset(FLOORS).push([0, 0, 1, 1, 'ground']);

  // cover crates: baked placement first, then a few around the sites
  reset(PROPS);
  if (built.props && built.props.length) {
    PROPS.push(...built.props);
  }
  for (const key of ['A', 'B']) {
    const site = map.sites[key];
    const spots = built.spots.plantSpots[key] || [];
    spots.forEach((p, i) => {
      if (i % 2) return;
      const off = i % 4 === 0 ? 1.9 : -1.9;
      PROPS.push([p.x + off, p.z + off * 0.4, 1.1, 1.1, 1.15, 'crate']);
    });
  }

  for (const key of ['A', 'B']) {
    SITES[key].center.x = map.sites[key].center.x;
    SITES[key].center.z = map.sites[key].center.z;
    SITES[key].radius = map.sites[key].radius;
  }

  reset(SPAWNS.attacker).push(...map.spawns.attacker);
  reset(SPAWNS.defender).push(...map.spawns.defender);

  reset(NAV_NODES);
  for (const n of built.nodes) NAV_NODES.push({ x: n.x, z: n.z, tag: n.tag });
  reset(NAV_EDGES).push(...built.edges);
  reset(NODE_SCORES);
  if (built.scores) NODE_SCORES.push(...built.scores);

  reset(PLANT_SPOTS.A).push(...(built.spots.plantSpots.A || []));
  reset(PLANT_SPOTS.B).push(...(built.spots.plantSpots.B || []));
  for (const key of ['A', 'B', 'mid']) {
    reset(HOLD_SPOTS[key]).push(...(built.spots.holdSpots[key] || []));
    reset(POST_PLANT_SPOTS[key]).push(...(built.spots.holdSpots[key] || []));
  }
  for (const key of ['A', 'B']) {
    ATTACK_PATHS[key] = built.spots.attackPaths[key] || {};
  }

  MAP_BOUNDS.minX = map.bounds.minX;
  MAP_BOUNDS.maxX = map.bounds.maxX;
  MAP_BOUNDS.minZ = map.bounds.minZ;
  MAP_BOUNDS.maxZ = map.bounds.maxZ;

  return { map, theme: built.theme, cells: built.cells };
}

/** World → radar pixel coordinates (for the HUD minimap). */
export function worldToRadar(map, x, z) {
  const { meta } = map;
  const ux = x / 0.0254;             // metres → source units
  const uy = -z / 0.0254;
  return {
    px: (ux - meta.posX) / meta.scale,
    py: (meta.posY - uy) / meta.scale,
  };
}

applyMap(MAPS[0].id);
