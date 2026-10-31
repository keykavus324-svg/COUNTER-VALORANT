/**
 * DUNE — the tactical map layout.
 *
 * Pure data (no three.js imports) so that it can be validated with node
 * scripts and reused by the AI navigation graph, the minimap and the 3D
 * builder.
 *
 * Coordinate system: X = east/west, Z = south/north (attackers spawn at +Z,
 * defenders at -Z). Walls are axis aligned boxes: [x, z, width, depth, height].
 *
 * Layout overview
 *   ┌────────────────────────────────────────────────┐
 *   │ [ B SITE ]      [ DEF SPAWN ]      [ A SITE ]  │
 *   │      │   CT  │         │   CT  │         │      │
 *   │  ────┴───────┴──[MID]──┴───────┴───────┴────  │  z=-12
 *   │  [B MAIN]   [B CONN]  [MID]  [A CONN] [A MAIN] │
 *   │                                                │
 *   │            [   ATTACKER YARD   ]               │
 *   │              [ ATTACKER SPAWN ]                │
 *   └────────────────────────────────────────────────┘
 */

export const MAP_BOUNDS = { minX: -33, maxX: 33, minZ: -33, maxZ: 33 };
export const WALL_HEIGHT = 6;
export const BOUND_WALL_HEIGHT = 9;

/** [x, z, w, d, h, kind] */
export const WALLS = [
  // ---------- perimeter ----------
  [0, -33.6, 69, 1.2, BOUND_WALL_HEIGHT, 'perimeter'],
  [0, 33.6, 69, 1.2, BOUND_WALL_HEIGHT, 'perimeter'],
  [-33.6, 0, 1.2, 69, BOUND_WALL_HEIGHT, 'perimeter'],
  [33.6, 0, 1.2, 69, BOUND_WALL_HEIGHT, 'perimeter'],

  // ---------- defender spawn room (x -9..9, z -33..-24) ----------
  [-9.6, -28.6, 1.2, 9.2, WALL_HEIGHT, 'concrete'],
  [9.6, -28.6, 1.2, 9.2, WALL_HEIGHT, 'concrete'],
  [-6.3, -24, 6.6, 1.2, WALL_HEIGHT, 'concrete'],
  [6.3, -24, 6.6, 1.2, WALL_HEIGHT, 'concrete'],
  [-9.6, -33, 6.6, 1.2, WALL_HEIGHT, 'concrete'], // closes SP top with perimeter
  [9.6, -33, 6.6, 1.2, WALL_HEIGHT, 'concrete'],

  // ---------- site A / CT dividing wall (x = 10) ----------
  [10, -26, 1.2, 12, WALL_HEIGHT, 'concrete'],
  [10, -14, 1.2, 4, WALL_HEIGHT, 'concrete'],
  // ---------- site B / CT dividing wall (x = -10) ----------
  [-10, -26, 1.2, 12, WALL_HEIGHT, 'concrete'],
  [-10, -14, 1.2, 4, WALL_HEIGHT, 'concrete'],

  // ---------- the long z = -12 wall (sites / lanes) ----------
  [-29.5, -12, 5, 1.2, WALL_HEIGHT, 'concrete'], // -32 .. -27
  [-19, -12, 6, 1.2, WALL_HEIGHT, 'concrete'],   // -22 .. -16
  [-13, -12, 6, 1.2, WALL_HEIGHT, 'concrete'],   // -16 .. -10 (B site south)
  [-6.5, -12, 7, 1.2, WALL_HEIGHT, 'concrete'],  // -10 .. -3
  [6.5, -12, 7, 1.2, WALL_HEIGHT, 'concrete'],   // 3 .. 10
  [13, -12, 6, 1.2, WALL_HEIGHT, 'concrete'],    // 10 .. 16
  [19, -12, 6, 1.2, WALL_HEIGHT, 'concrete'],    // 16 .. 22
  [29.5, -12, 5, 1.2, WALL_HEIGHT, 'concrete'],  // 27 .. 32

  // ---------- A MAIN west wall (x = 20) with a gap at z -4..0 ----------
  [20, -8, 1.2, 8, WALL_HEIGHT, 'concrete'],
  [20, 7, 1.2, 14, WALL_HEIGHT, 'concrete'],
  // ---------- B MAIN east wall (x = -20) ----------
  [-20, -8, 1.2, 8, WALL_HEIGHT, 'concrete'],
  [-20, 7, 1.2, 14, WALL_HEIGHT, 'concrete'],

  // ---------- MID walls (x = ±8) with a window gap at z 0..6 ----------
  [8, -6, 1.2, 12, WALL_HEIGHT, 'metal'],
  [8, 10, 1.2, 8, WALL_HEIGHT, 'metal'],
  [-8, -6, 1.2, 12, WALL_HEIGHT, 'metal'],
  [-8, 10, 1.2, 8, WALL_HEIGHT, 'metal'],

];

/** Free-standing cover / props. [x, z, w, d, h, type, rotY?] */
export const PROPS = [
  // ---------------- attacker yard ----------------
  [0, 24.5, 2.4, 2.4, 1.7, 'crate'],
  [-4.2, 22.4, 1.4, 3.2, 1.05, 'sandbag'],
  [4.2, 22.4, 1.4, 3.2, 1.05, 'sandbag'],
  [-12, 18.5, 3.2, 2.2, 1.7, 'crate'],
  [12, 18.5, 3.2, 2.2, 1.7, 'crate'],
  [-24, 22, 7, 2.4, 2.6, 'container'],
  [24, 22, 7, 2.4, 2.6, 'container'],
  [-20.5, 26.5, 1.5, 1.5, 2.2, 'barrel'],
  [20.5, 26.5, 1.5, 1.5, 2.2, 'barrel'],
  [-29, 17, 2.6, 2.6, 1.7, 'crate'],
  [29, 17, 2.6, 2.6, 1.7, 'crate'],

  // ---------------- A main ----------------
  [25.5, 9, 2.6, 2.6, 1.7, 'crate'],
  [28.5, 3, 1.6, 5.2, 1.05, 'sandbag'],
  [23.5, -2, 2.2, 2.2, 1.7, 'crate'],
  [30.5, -6, 2.2, 2.2, 2.2, 'barrelStack'],
  // ---------------- B main ----------------
  [-25.5, 9, 2.6, 2.6, 1.7, 'crate'],
  [-28.5, 3, 1.6, 5.2, 1.05, 'sandbag'],
  [-23.5, -2, 2.2, 2.2, 1.7, 'crate'],
  [-30.5, -6, 2.2, 2.2, 2.2, 'barrelStack'],

  // ---------------- A connector ----------------
  [14, 9.5, 2.8, 2.8, 1.7, 'crate'],
  [12.5, 1.5, 2.2, 6, 1.05, 'sandbag'],
  [17, -6.5, 3.4, 2.4, 1.7, 'crate'],
  // ---------------- B connector ----------------
  [-14, 9.5, 2.8, 2.8, 1.7, 'crate'],
  [-12.5, 1.5, 2.2, 6, 1.05, 'sandbag'],
  [-17, -6.5, 3.4, 2.4, 1.7, 'crate'],

  // ---------------- mid ----------------
  [-3.4, 5.5, 3.2, 1.2, 1.0, 'sandbag'],
  [3.4, 5.5, 3.2, 1.2, 1.0, 'sandbag'],
  [0, -1.5, 2.6, 2.6, 1.7, 'crate'],
  [0, -5.5, 1.6, 4.4, 1.05, 'sandbag'],

  // ---------------- CT ----------------
  [-4.6, -14.5, 2.2, 2.2, 1.7, 'crate'],
  [4.6, -14.5, 2.2, 2.2, 1.7, 'crate'],
  [-2.3, -22.2, 2.4, 1.2, 1.05, 'sandbag'],
  [2.3, -22.2, 2.4, 1.2, 1.05, 'sandbag'],

  // ---------------- defender spawn ----------------
  [-6, -29.5, 2.2, 1.6, 1.5, 'crate'],
  [6, -29.5, 2.2, 1.6, 1.5, 'crate'],

  // ---------------- SITE A ----------------
  [14.5, -20.5, 1.6, 4.2, 1.05, 'sandbag'],
  [17.5, -23.5, 2.4, 2.4, 1.7, 'crate'],
  [21, -26.5, 3.2, 1.8, 1.7, 'crate'],
  [25.5, -29, 4.2, 2.4, 1.7, 'crate'],
  [29.5, -22, 2.6, 2.6, 2.2, 'barrelStack'],
  [29.4, -17.5, 2.2, 2.2, 1.05, 'sandbag'],
  [30.5, -27.5, 2.4, 4.2, 1.7, 'crate'],
  [17, -29.5, 2.2, 2.2, 1.7, 'crate'],

  // ---------------- SITE B (mirror) ----------------
  [-14.5, -20.5, 1.6, 4.2, 1.05, 'sandbag'],
  [-17.5, -23.5, 2.4, 2.4, 1.7, 'crate'],
  [-21, -26.5, 3.2, 1.8, 1.7, 'crate'],
  [-25.5, -29, 4.2, 2.4, 1.7, 'crate'],
  [-29.5, -22, 2.6, 2.6, 2.2, 'barrelStack'],
  [-29.4, -17.5, 2.2, 2.2, 1.05, 'sandbag'],
  [-30.5, -27.5, 2.4, 4.2, 1.7, 'crate'],
  [-17, -29.5, 2.2, 2.2, 1.7, 'crate'],

  // decorative barrels near spawns
  [-10.5, -30.5, 1.4, 1.4, 1.9, 'barrel'],
  [10.5, -30.5, 1.4, 1.4, 1.9, 'barrel'],
];

/** Floor rectangles: [x, z, w, d, material] */
export const FLOORS = [
  [0, 0, 68, 68, 'ground'],
  // site A raised tile border
  [21, -22, 22, 20, 'tileA'],
  [-21, -22, 22, 20, 'tileB'],
  [0, -28.5, 18.4, 9.4, 'defspawn'],
  [0, 27.5, 26, 11, 'atkspawn'],
  [0, 1, 16, 26, 'midlane'],
  [25.5, 1, 12, 26, 'laneA'],
  [-25.5, 1, 12, 26, 'laneB'],
  [14, 1, 12, 26, 'connA'],
  [-14, 1, 12, 26, 'connB'],
  [0, -18, 19.2, 12, 'ctfloor'],
];

export const SITES = {
  A: { id: 'A', center: { x: 21, z: -22 }, radius: 8.5, label: 'A' },
  B: { id: 'B', center: { x: -21, z: -22 }, radius: 8.5, label: 'B' },
};

/** Possible spike plant positions per site (must be inside the plant radius). */
export const PLANT_SPOTS = {
  A: [
    { x: 20, z: -21 },
    { x: 23.5, z: -25 },
    { x: 17, z: -25.5 },
    { x: 24, z: -18.5 },
    { x: 27, z: -22.5 },
  ],
  B: [
    { x: -20, z: -21 },
    { x: -23.5, z: -25 },
    { x: -17, z: -25.5 },
    { x: -24, z: -18.5 },
    { x: -27, z: -22.5 },
  ],
};

export const SPAWNS = {
  attacker: [
    { x: -6, z: 28.5 }, { x: -2, z: 28.5 }, { x: 2, z: 28.5 }, { x: 6, z: 28.5 }, { x: 0, z: 30 },
  ],
  defender: [
    { x: -5, z: -29.5 }, { x: -1.5, z: -29.5 }, { x: 1.5, z: -29.5 }, { x: 5, z: -29.5 }, { x: 0, z: -31.5 },
  ],
};

/** Navigation waypoints (x, z) — edges are computed automatically by LOS. */
export const NAV_NODES = [
  // attacker spawn + yard
  { x: 0, z: 28, tag: 'atkSpawn' },
  { x: -7, z: 26, tag: 'atkSpawn' },
  { x: 7, z: 26, tag: 'atkSpawn' },
  { x: -16, z: 22, tag: 'yard' },
  { x: 16, z: 22, tag: 'yard' },
  { x: -9, z: 19, tag: 'yard' },
  { x: 9, z: 19, tag: 'yard' },
  { x: 0, z: 19.5, tag: 'yard' },
  { x: -25, z: 19, tag: 'yard' },
  { x: 25, z: 19, tag: 'yard' },
  // mid lane
  { x: 0, z: 12, tag: 'mid' },
  { x: 0, z: 7, tag: 'mid' },
  { x: 0, z: 3, tag: 'mid' },
  { x: -1.5, z: -4, tag: 'mid' },
  { x: 0, z: -9, tag: 'mid' },
  // A main
  { x: 25.5, z: 12, tag: 'amain' },
  { x: 25.5, z: 7, tag: 'amain' },
  { x: 25.5, z: 1, tag: 'amain' },
  { x: 25.5, z: -5, tag: 'amain' },
  { x: 24.5, z: -9.5, tag: 'amain' },
  // B main
  { x: -25.5, z: 12, tag: 'bmain' },
  { x: -25.5, z: 7, tag: 'bmain' },
  { x: -25.5, z: 1, tag: 'bmain' },
  { x: -25.5, z: -5, tag: 'bmain' },
  { x: -24.5, z: -9.5, tag: 'bmain' },
  // A connector
  { x: 14, z: 12, tag: 'aconn' },
  { x: 14, z: 6, tag: 'aconn' },
  { x: 14.5, z: 2.5, tag: 'aconn' },
  { x: 14, z: -2.5, tag: 'aconn' },
  { x: 11, z: -9.5, tag: 'aconn' },
  { x: 24.5, z: -13.6, tag: 'aconn' },
  // B connector
  { x: -14, z: 12, tag: 'bconn' },
  { x: -14, z: 6, tag: 'bconn' },
  { x: -14.5, z: 2.5, tag: 'bconn' },
  { x: -14.5, z: -2, tag: 'bconn' },
  { x: -11, z: -9.5, tag: 'bconn' },
  { x: -24.5, z: -13.6, tag: 'bconn' },
  // CT / mid-to-CT
  { x: 0, z: -14.5, tag: 'ct' },
  { x: -7, z: -16, tag: 'ct' },
  { x: 7, z: -16, tag: 'ct' },
  { x: 0, z: -19.5, tag: 'ct' },
  { x: -8.5, z: -21.5, tag: 'ct' },
  { x: 8.5, z: -21.5, tag: 'ct' },
  // defender spawn
  { x: 0, z: -26, tag: 'defSpawn' },
  { x: -5, z: -28, tag: 'defSpawn' },
  { x: 4, z: -29, tag: 'defSpawn' },
  // site A
  { x: 13, z: -18, tag: 'siteA' },
  { x: 13, z: -22, tag: 'siteA' },
  { x: 17, z: -20, tag: 'siteA' },
  { x: 20, z: -21, tag: 'siteA' },
  { x: 22.5, z: -17.5, tag: 'siteA' },
  { x: 25, z: -21, tag: 'siteA' },
  { x: 27.5, z: -25, tag: 'siteA' },
  { x: 23.5, z: -27, tag: 'siteA' },
  { x: 18, z: -27.5, tag: 'siteA' },
  { x: 29, z: -30.5, tag: 'siteA' },
  { x: 24, z: -31, tag: 'siteA' },
  { x: 15.5, z: -24, tag: 'siteA' },
  // site B
  { x: -13, z: -18, tag: 'siteB' },
  { x: -13, z: -22, tag: 'siteB' },
  { x: -17, z: -20, tag: 'siteB' },
  { x: -20, z: -21, tag: 'siteB' },
  { x: -22.5, z: -17.5, tag: 'siteB' },
  { x: -25, z: -21, tag: 'siteB' },
  { x: -27.5, z: -25, tag: 'siteB' },
  { x: -23.5, z: -27, tag: 'siteB' },
  { x: -18, z: -27.5, tag: 'siteB' },
  { x: -29, z: -30.5, tag: 'siteB' },
  { x: -24, z: -31, tag: 'siteB' },
  { x: -15.5, z: -24, tag: 'siteB' },
];

/** Named defensive hold positions (used by bots): points + look direction. */
export const HOLD_SPOTS = {
  A: [
    { x: 17, z: -26, look: { x: 0.2, z: 1 } },
    { x: 28, z: -29, look: { x: -0.4, z: 1 } },
    { x: 29, z: -15, look: { x: -0.7, z: 0.6 } },
    { x: 14, z: -16, look: { x: 0.9, z: 0.4 } },
  ],
  B: [
    { x: -17, z: -26, look: { x: -0.2, z: 1 } },
    { x: -28, z: -29, look: { x: 0.4, z: 1 } },
    { x: -29, z: -15, look: { x: 0.7, z: 0.6 } },
    { x: -14, z: -16, look: { x: -0.9, z: 0.4 } },
  ],
  mid: [
    { x: 4, z: -12.5, look: { x: 0, z: 1 } },
    { x: -4, z: -12.5, look: { x: 0, z: 1 } },
    { x: 0, z: -19, look: { x: 0, z: 1 } },
  ],
};

/** Safe crossfire positions the attacking team holds once the spike is down.
 *  Kept well clear of the site so the blast does not wipe the attackers. */
export const POST_PLANT_SPOTS = {
  A: [
    { x: 12.5, z: -15.5, look: { x: 1, z: -0.4 } },
    { x: 28.5, z: -14.5, look: { x: -0.7, z: -0.7 } },
    { x: 29.5, z: -29.5, look: { x: -1, z: 0.7 } },
    { x: 24, z: -16, look: { x: -0.2, z: -1 } },
  ],
  B: [
    { x: -12.5, z: -15.5, look: { x: -1, z: -0.4 } },
    { x: -28.5, z: -14.5, look: { x: 0.7, z: -0.7 } },
    { x: -29.5, z: -29.5, look: { x: 1, z: 0.7 } },
    { x: -24, z: -16, look: { x: 0.2, z: -1 } },
  ],
};

/** Hand authored lane routes so attacking bots spread out instead of all
 *  funnelling through mid. Each entry is a list of [x, z] waypoints. */
export const ATTACK_PATHS = {
  A: {
    main: [[9, 20.5], [14.5, 20.4], [23, 19.9], [23, 14], [21.8, 10], [21.8, 3], [21.8, -6], [24.5, -10]],
    conn: [[9, 20.5], [18, 20.3], [18, 16], [15.9, 13], [15.9, 4], [15.9, -1], [18.5, -2.5], [21.6, -2], [21.6, -7.5], [24.5, -10]],
    mid: [[0, 20.5], [0, 11], [0, 3], [3.0, 1], [3.0, -9], [0, -13], [0, -16], [7, -16.5], [8.6, -18], [12, -19]],
  },
  B: {
    main: [[-9, 20.5], [-14.5, 20.4], [-23, 19.9], [-23, 14], [-21.8, 10], [-21.8, 3], [-21.8, -6], [-24.5, -10]],
    conn: [[-9, 20.5], [-18, 20.3], [-18, 16], [-15.9, 13], [-15.9, 4], [-15.9, -1], [-18.5, -2.5], [-21.6, -2], [-21.6, -7.5], [-24.5, -10]],
    mid: [[0, 20.5], [0, 11], [0, 3], [-3.0, 1], [-3.0, -9], [0, -13], [0, -16], [-7, -16.5], [-8.6, -18], [-12, -19]],
  },
};

export const ATTACK_ROUTES = {
  A: ['yard', 'amain', 'siteA'],
  B: ['yard', 'bmain', 'siteB'],
  mid: ['yard', 'mid', 'ct'],
};
