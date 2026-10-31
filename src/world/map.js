import * as THREE from 'three';
import {
  WALLS, PROPS, SITES, SPAWNS, NAV_NODES, NAV_EDGES, MAP_BOUNDS,
  PLANT_SPOTS, HOLD_SPOTS, POST_PLANT_SPOTS, THEMES, CURRENT_MAP, MAP_BY_ID, applyMap,
} from './mapLayout.js';
import {
  wallPanel, sandGround, crateTexture, siteDecalTexture, skyTexture, glowTexture,
  normalMapFrom,
} from './Textures.js';
import {
  mergedBoxGeometry, surfaceMaterial, scatterClutter, dressWalls, dressGround,
  buildWallCaps, buildHorizon, buildDust, buildLampGlows, buildContactShadows,
} from './Decor.js';
import { boxFromCenter, segmentBox2D } from '../core/utils.js';

const _rayDir = new THREE.Vector3();
const _c = new THREE.Color();

/* ------------------------------------------------------------------ */
/* material helpers                                                    */
/* ------------------------------------------------------------------ */
const matCache = new Map();
function cached(key, make) {
  if (!matCache.has(key)) matCache.set(key, make());
  return matCache.get(key);
}

/* ------------------------------------------------------------------ */
export class GameMap {
  constructor(scene, quality = 'medium', mapId = null, renderer = null) {
    const id = mapId || CURRENT_MAP.id;
    applyMap(id);

    this.scene = scene;
    this.renderer = renderer;
    this.mapId = id;
    this.map = MAP_BY_ID[id] || CURRENT_MAP;
    this.themeId = this.map.theme;
    this.theme = THEMES[this.themeId] || THEMES.sand;
    this.quality = quality;

    this.group = new THREE.Group();
    this.group.name = 'map';
    scene.add(this.group);

    /** collision boxes: THREE.Box3 */
    this.boxes = [];
    /** taller-than-knee boxes used for line of sight */
    this.sightBlockers = [];
    this.navBlockers = [];
    this.bulletBoxes = [];
    this.animated = [];
    this.time = 0;

    this._buildLights();
    this._buildSky();
    this._buildGround();
    this._buildWalls();
    this._buildProps();
    this._buildDecor();
    this._buildSiteMarkers();
    this._buildSpawnMarkers();
    this._buildNav();

    this.bounds = MAP_BOUNDS;
    this.sites = SITES;
    this.spawns = SPAWNS;
    this.plantSpots = PLANT_SPOTS;
    this.holdSpots = HOLD_SPOTS;
    this.postPlantSpots = POST_PLANT_SPOTS;
  }

  /* ---------------------------------------------------------------- */
  _buildLights() {
    const { theme, scene } = this;
    // sky dome light + a whisper of ambient keeps shadows from going pure black
    const hemi = new THREE.HemisphereLight(theme.hemi[0], theme.hemi[1], 0.85);
    scene.add(hemi);
    scene.add(new THREE.AmbientLight(0xffffff, 0.14));

    const sun = new THREE.DirectionalLight(theme.sun, 2.35);
    sun.position.set(52, 66, 38);
    sun.target.position.set(0, 0, 0);
    scene.add(sun.target);
    sun.castShadow = this.quality !== 'low';
    if (sun.castShadow) {
      const size = this.quality === 'high' ? 2048 : 1024;
      sun.shadow.mapSize.set(size, size);
      const cam = sun.shadow.camera;
      // a tight frustum that follows the player gives ~10x the shadow detail
      // of the old map-wide one, for the same fill rate
      const span = this.quality === 'high' ? 34 : 26;
      cam.left = -span; cam.right = span; cam.top = span; cam.bottom = -span;
      cam.near = 1; cam.far = 190;
      sun.shadow.bias = -0.0007;
      sun.shadow.normalBias = 0.04;
      sun.shadow.camera.updateProjectionMatrix();
    }
    this.sun = sun;
    scene.add(sun);

    // cool bounce light from the opposite side: separates perpendicular walls
    const fill = new THREE.DirectionalLight(0xbcd2e8, 0.5);
    fill.position.set(-60, 34, -48);
    scene.add(fill);
    this.fill = fill;

    scene.fog = new THREE.FogExp2(_c.set(theme.sky[2]).getHex(), 0.0042);

    this._buildEnvironment();
  }

  /**
   * Pre-filter the sky dome into an environment map: the only way PBR metal
   * (barrels, weapons, scopes) picks up real colour instead of flat grey.
   */
  _buildEnvironment() {
    const renderer = this.renderer;
    if (!renderer || !renderer.isWebGLRenderer || typeof THREE.PMREMGenerator !== 'function') return;
    try {
      const tex = skyTexture(this.theme.sky);
      if (!tex) return;
      tex.mapping = THREE.EquirectangularReflectionMapping;
      const pmrem = new THREE.PMREMGenerator(renderer);
      pmrem.compileEquirectangularShader();
      const env = pmrem.fromEquirectangular(tex).texture;
      this.scene.environment = env;
      this.scene.environmentIntensity = 0.55;
      pmrem.dispose();
      this.envMap = env;
    } catch (err) {
      console.warn('environment map skipped', err?.message || err);
    }
  }

  _buildSky() {
    const tex = skyTexture(this.theme.sky);
    if (!tex) return;
    const geo = new THREE.SphereGeometry(480, 24, 16);
    const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, depthWrite: false, fog: false });
    const dome = new THREE.Mesh(geo, mat);
    dome.name = 'sky';
    this.scene.add(dome);
    this.sky = dome;
  }

  _buildGround() {
    const { theme } = this;
    const w = MAP_BOUNDS.maxX - MAP_BOUNDS.minX + 40;
    const d = MAP_BOUNDS.maxZ - MAP_BOUNDS.minZ + 40;
    const tex = sandGround(9, `#${theme.ground.toString(16)}`, [
      (theme.groundTint >> 16) & 255, (theme.groundTint >> 8) & 255, theme.groundTint & 255,
    ]);
    const mat = cached(`ground-${this.themeId}`, () => {
      const m = new THREE.MeshStandardMaterial({
        map: tex || null,
        color: tex ? 0xffffff : theme.ground,
        roughness: 0.96,
        metalness: 0,
      });
      if (tex) {
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(w / 8, d / 8);
        const nrm = normalMapFrom(tex.image, 1.5, 256);
        if (nrm) {
          nrm.wrapS = nrm.wrapT = THREE.RepeatWrapping;
          nrm.repeat.set(w / 8, d / 8);
          m.normalMap = nrm;
          m.normalScale.set(0.65, 0.65);
        }
      }
      return m;
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d, 1, 1), mat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set((MAP_BOUNDS.minX + MAP_BOUNDS.maxX) / 2, 0, (MAP_BOUNDS.minZ + MAP_BOUNDS.maxZ) / 2);
    floor.receiveShadow = true;
    floor.name = 'ground';
    this.group.add(floor);
  }

  /* ---------------------------------------------------------------- */
  _buildWalls() {
    if (!WALLS.length) return;
    const { theme } = this;
    const tex = wallPanel(
      `#${theme.wall.toString(16).padStart(6, '0')}`,
      `#${theme.wallDark.toString(16).padStart(6, '0')}`,
      7,
    );
    // One merged mesh, but every face keeps a constant texel density (tile in
    // metres) instead of the old "same stretch on a 2 m and a 40 m wall".
    const mat = surfaceMaterial(tex, {
      key: `wall-${this.themeId}`,
      roughness: 0.94,
      metalness: 0.02,
      normalScale: 1.15,
    });
    // Height variation: the radar mask gives every block the same extrusion,
    // which reads as a maze of identical slabs. Blocks near the map edge grow
    // into buildings, small blocks stay low cover, middling ones vary.
    const cx = (MAP_BOUNDS.minX + MAP_BOUNDS.maxX) / 2;
    const cz = (MAP_BOUNDS.minZ + MAP_BOUNDS.maxZ) / 2;
    const halfSpan = Math.max(
      (MAP_BOUNDS.maxX - MAP_BOUNDS.minX),
      (MAP_BOUNDS.maxZ - MAP_BOUNDS.minZ),
    ) / 2 || 1;
    // (built into a copy: the baked arrays must stay pristine)
    const scaledWalls = WALLS.map(([x, z, w, d, h, kind]) => {
      const dist = Math.hypot(x - cx, z - cz) / halfSpan;   // 0 centre … 1 edge
      const area = w * d;
      const seed = (Math.abs((x * 13.7 + z * 7.3) | 0) % 100) / 100;
      let mul;
      if (area < 4) mul = 0.55 + seed * 0.25;               // low cover
      else if (area < 26) mul = 0.85 + seed * 0.5 + dist * 0.25;
      else mul = 1.15 + seed * 0.7 + dist * 1.15;            // building block
      return [x, z, w, d, +(Math.min(h * mul, 16)).toFixed(2), kind];
    });
    this.wallList = scaledWalls;

    const geo = mergedBoxGeometry(
      scaledWalls.map(([x, z, w, d, h]) => ({ x, z, w, d, h })),
      { tile: 3.1, topShade: true },
    );
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = this.quality !== 'low';
    mesh.receiveShadow = true;
    mesh.name = 'walls';
    this.group.add(mesh);
    this.wallMesh = mesh;

    scaledWalls.forEach(([x, z, w, d, h, kind]) => {
      const box = new THREE.Box3(
        new THREE.Vector3(x - w / 2, 0, z - d / 2),
        new THREE.Vector3(x + w / 2, h, z + d / 2),
      );
      this.boxes.push(box);
      this.bulletBoxes.push({ box, material: kind === 'metal' ? 'metal' : 'concrete' });
      this.navBlockers.push(box);
      if (h > 0.95) this.sightBlockers.push(box);
    });
  }

  /** true when a circle of radius r at (x,z) is clear of every solid box */
  isFree(x, z, r = 0.4) {
    if (x < MAP_BOUNDS.minX + r || x > MAP_BOUNDS.maxX - r) return false;
    if (z < MAP_BOUNDS.minZ + r || z > MAP_BOUNDS.maxZ - r) return false;
    for (const b of this.boxes) {
      if (x > b.min.x - r && x < b.max.x + r && z > b.min.z - r && z < b.max.z + r) return false;
    }
    return true;
  }

  /**
   * Static art pass: wall caps, posters, clutter, ground paint, skyline, dust.
   * Runs after the collision geometry so every prop can test against it.
   */
  _buildDecor() {
    const { theme } = this;
    const bounds = MAP_BOUNDS;
    const walls = this.wallList || WALLS;
    buildWallCaps({ group: this.group, walls, theme, themeId: this.themeId, quality: this.quality });
    buildContactShadows({ group: this.group, walls });
    dressGround({
      group: this.group,
      theme,
      themeId: this.themeId,
      themeKind: this.themeId,
      bounds,
      sites: SITES,
      quality: this.quality,
    });
    dressWalls({
      group: this.group,
      walls,
      isFree: (x, z, r) => this.isFree(x, z, r),
      quality: this.quality,
    });
    const clutter = scatterClutter({
      group: this.group,
      theme,
      themeId: this.themeId,
      walls,
      isFree: (x, z, r) => this.isFree(x, z, r),
      quality: this.quality,
      onBox: (box, material) => {
        this.boxes.push(box);
        this.bulletBoxes.push({ box, material });
        this.navBlockers.push(box);
        if (box.max.y > 0.95) this.sightBlockers.push(box);
      },
    });
    this.clutter = clutter;
    buildHorizon({ group: this.group, bounds, themeId: this.themeId, quality: this.quality });
    const dust = buildDust({ group: this.group, bounds, quality: this.quality, themeId: this.themeId });
    if (dust) { this.dust = dust; this.animated.push({ mesh: dust.points, kind: 'dust' }); }
    const lamps = buildLampGlows({ group: this.group, walls, quality: this.quality });
    if (lamps.length) this.lamps = lamps;
  }

  _buildProps() {
    if (!PROPS.length) return;
    const tex = crateTexture(11, `#${this.theme.crate.toString(16)}`);
    const mat = surfaceMaterial(tex, {
      key: `crate-${this.themeId}`,
      roughness: 0.88,
      normalScale: 1.0,
    });
    const geo = mergedBoxGeometry(
      PROPS.map(([x, z, w, d, h]) => ({ x, z, w, d, h })),
      { tile: 1.1 },
    );
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = 'props';
    this.group.add(mesh);

    PROPS.forEach(([x, z, w, d, h, type]) => {
      const box = new THREE.Box3(
        new THREE.Vector3(x - w / 2, 0, z - d / 2),
        new THREE.Vector3(x + w / 2, h, z + d / 2),
      );
      this.boxes.push(box);
      this.bulletBoxes.push({ box, material: type === 'sandbag' ? 'sand' : 'wood' });
      this.navBlockers.push(box);
      if (h > 0.95) this.sightBlockers.push(box);
    });
  }

  _buildSiteMarkers() {
    for (const key of ['A', 'B']) {
      const site = SITES[key];
      const tex = siteDecalTexture(key, key === 'A' ? '#e2b33c' : '#4bb2e2');
      if (tex) {
        const mat = new THREE.MeshBasicMaterial({
          map: tex, transparent: true, opacity: 0.5, depthWrite: false,
        });
        const decal = new THREE.Mesh(new THREE.PlaneGeometry(site.radius * 1.7, site.radius * 1.7), mat);
        decal.rotation.x = -Math.PI / 2;
        decal.position.set(site.center.x, 0.03, site.center.z);
        decal.renderOrder = 2;
        this.group.add(decal);
      }
      // light pillar so attackers can see the site from a distance
      const glow = glowTexture(key === 'A' ? '226,179,60' : '75,178,226', 0.2);
      if (glow) {
        const beam = new THREE.Mesh(
          new THREE.CylinderGeometry(site.radius * 0.5, site.radius * 0.62, 14, 18, 1, true),
          new THREE.MeshBasicMaterial({
            map: glow, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false, fog: false,
          }),
        );
        beam.position.set(site.center.x, 7, site.center.z);
        this.group.add(beam);
        this.animated.push({ mesh: beam, kind: 'siteBeam' });
      }
    }
  }

  _buildSpawnMarkers() {
    const list = [
      [SPAWNS.attacker, 0xd98b3a],
      [SPAWNS.defender, 0x3a8bd9],
    ];
    for (const [points, color] of list) {
      for (const p of points || []) {
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(0.55, 0.72, 16),
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, depthWrite: false }),
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(p.x, 0.025, p.z);
        this.group.add(ring);
      }
    }
  }

  /* ---------------------------------------------------------------- */
  _buildNav() {
    this.navNodes = NAV_NODES.map((n, i) => ({ ...n, i }));
    const nodes = this.navNodes;

    // precomputed edges from the radar grid (no runtime LOS sweep)
    this.navEdges = new Map(NAV_EDGES.map((list, i) => [i, list]));

    this.findPath = (fromIdx, toIdx) => {
      if (fromIdx === toIdx) return [toIdx];
      const open = [{ i: fromIdx, f: 0 }];
      const came = new Map();
      const gScore = new Map([[fromIdx, 0]]);
      const closed = new Set();
      const h = (i) => Math.hypot(nodes[i].x - nodes[toIdx].x, nodes[i].z - nodes[toIdx].z);
      while (open.length) {
        open.sort((a, b) => a.f - b.f);
        const cur = open.shift();
        if (cur.i === toIdx) {
          const path = [cur.i];
          let c = cur.i;
          while (came.has(c)) { c = came.get(c); path.unshift(c); }
          return path;
        }
        if (closed.has(cur.i)) continue;
        closed.add(cur.i);
        for (const e of this.navEdges.get(cur.i) || []) {
          if (closed.has(e.to)) continue;
          const g = (gScore.get(cur.i) ?? Infinity) + e.cost;
          if (g < (gScore.get(e.to) ?? Infinity)) {
            gScore.set(e.to, g);
            came.set(e.to, cur.i);
            open.push({ i: e.to, f: g + h(e.to) * 1.02 });
          }
        }
      }
      return null;
    };

    this.nearestNode = (x, z, tagFilter = null) => {
      let best = -1;
      let bd = Infinity;
      for (const n of nodes) {
        if (tagFilter && !tagFilter.includes(n.tag)) continue;
        const d = (n.x - x) ** 2 + (n.z - z) ** 2;
        if (d < bd) { bd = d; best = n.i; }
      }
      return best;
    };

    this.nodesByTag = (tag) => nodes.filter((n) => n.tag === tag);
  }

  /* ---------------------------------------------------------------- */
  /** Raycast against world geometry. Returns {distance, point, normal, material} */
  raycast(origin, dir, maxDist = 200) {
    _rayDir.copy(dir).normalize();
    let best = null;
    for (const entry of this.bulletBoxes) {
      const hit = rayBoxLocal(origin, _rayDir, entry.box, maxDist);
      if (hit && (!best || hit.distance < best.distance)) {
        best = { distance: hit.distance, normal: hit.normal, material: entry.material, box: entry.box };
      }
    }
    if (_rayDir.y < -1e-5) {
      const t = -origin.y / _rayDir.y;
      if (t > 0 && t < maxDist && (!best || t < best.distance)) {
        best = { distance: t, normal: { x: 0, y: 1, z: 0 }, material: 'ground' };
      }
    }
    if (best) best.point = origin.clone().addScaledVector(_rayDir, best.distance);
    return best;
  }

  hasLineOfSight(a, b, eyeA = 1.6, eyeB = 1.6) {
    const minEye = Math.min(a.y ?? eyeA, b.y ?? eyeB);
    for (const box of this.sightBlockers) {
      if (box.max.y < minEye + 0.1) continue;
      if (segmentBox2D(a.x, a.z, b.x, b.z, box)) return false;
    }
    return true;
  }

  supportHeight(x, z, feetY) {
    let top = 0;
    for (const box of this.boxes) {
      if (x < box.min.x || x > box.max.x || z < box.min.z || z > box.max.z) continue;
      if (box.max.y <= feetY + 0.12 && box.max.y > top) top = box.max.y;
    }
    return top;
  }

  siteAt(x, z) {
    for (const key of ['A', 'B']) {
      const s = SITES[key];
      if (Math.hypot(x - s.center.x, z - s.center.z) <= s.radius) return s;
    }
    return null;
  }

  update(dt, camera) {
    this.time += dt;
    if (camera?.position) {
      this._focus = { x: camera.position.x, z: camera.position.z };
    }
    // keep the sun rig centred on the action so shadows stay sharp
    const focus = this._focus;
    if (this.sun && focus && this.sun.castShadow) {
      const dirX = 52, dirY = 66, dirZ = 38;
      const len = Math.hypot(dirX, dirY, dirZ) || 1;
      const dist = 90;
      this.sun.position.set(
        focus.x + (dirX / len) * dist,
        (dirY / len) * dist,
        focus.z + (dirZ / len) * dist,
      );
      this.sun.target.position.set(focus.x, 0, focus.z);
      this.sun.target.updateMatrixWorld();
    }

    for (const a of this.animated) {
      if (a.kind === 'siteBeam') {
        a.mesh.material.opacity = 0.07 + Math.sin(this.time * 1.4) * 0.03;
      } else if (a.kind === 'dust') {
        // lazy drift: rotate the cloud and bob it, no per-particle cost
        a.mesh.rotation.y = this.time * 0.012;
        a.mesh.position.y = Math.sin(this.time * 0.35) * 0.25;
      }
    }
    if (this.sky) this.sky.position.copy(this.scene.getObjectByName('camera')?.position || this.sky.position);
  }
}

/* ray vs box helper (kept local so the module has no extra imports) */
function rayBoxLocal(origin, dir, box, maxDist) {
  let t0 = 0;
  let t1 = maxDist;
  let normal = null;
  for (const axis of ['x', 'y', 'z']) {
    const o = origin[axis];
    const d = dir[axis];
    const min = box.min[axis];
    const max = box.max[axis];
    if (Math.abs(d) < 1e-8) {
      if (o < min || o > max) return null;
      continue;
    }
    let a = (min - o) / d;
    let b = (max - o) / d;
    let sign = -1;
    if (a > b) { const t = a; a = b; b = t; sign = 1; }
    if (a > t0) {
      t0 = a;
      normal = { x: 0, y: 0, z: 0, [axis]: sign };
    }
    if (b < t1) t1 = b;
    if (t0 > t1) return null;
  }
  if (!normal) return null;
  return { distance: t0, normal };
}
