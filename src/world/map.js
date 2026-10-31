import * as THREE from 'three';
import {
  WALLS, PROPS, SITES, SPAWNS, NAV_NODES, NAV_EDGES, MAP_BOUNDS,
  PLANT_SPOTS, HOLD_SPOTS, POST_PLANT_SPOTS, THEMES, CURRENT_MAP, MAP_BY_ID, applyMap,
} from './mapLayout.js';
import {
  wallPanel, sandGround, crateTexture, siteDecalTexture, skyTexture, glowTexture,
} from './Textures.js';
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
  constructor(scene, quality = 'medium', mapId = null) {
    const id = mapId || CURRENT_MAP.id;
    applyMap(id);

    this.scene = scene;
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
    const hemi = new THREE.HemisphereLight(theme.hemi[0], theme.hemi[1], 1.0);
    scene.add(hemi);
    scene.add(new THREE.AmbientLight(0xffffff, 0.26));

    const sun = new THREE.DirectionalLight(theme.sun, 2.5);
    sun.position.set(52, 66, 38);
    sun.target.position.set(0, 0, 0);
    scene.add(sun.target);
    sun.castShadow = this.quality !== 'low';
    if (sun.castShadow) {
      const size = this.quality === 'high' ? 2048 : 1024;
      sun.shadow.mapSize.set(size, size);
      const cam = sun.shadow.camera;
      const span = Math.max(
        MAP_BOUNDS.maxX - MAP_BOUNDS.minX,
        MAP_BOUNDS.maxZ - MAP_BOUNDS.minZ,
      ) * 0.55;
      cam.left = -span; cam.right = span; cam.top = span; cam.bottom = -span;
      cam.near = 1; cam.far = span * 4;
      sun.shadow.bias = -0.0007;
      sun.shadow.normalBias = 0.04;
      sun.shadow.camera.updateProjectionMatrix();
    }
    this.sun = sun;
    scene.add(sun);

    scene.fog = new THREE.FogExp2(_c.set(theme.sky[1]).getHex(), 0.0065);
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
    const tex = wallPanel(`#${theme.wall.toString(16)}`, `#${theme.wallDark.toString(16)}`, 7);
    if (tex) {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(3, 2);
    }
    const mat = cached(`wall-${this.themeId}`, () => new THREE.MeshStandardMaterial({
      map: tex || null,
      color: tex ? 0xffffff : theme.wall,
      roughness: 0.93,
      metalness: 0.02,
    }));

    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mesh = new THREE.InstancedMesh(geo, mat, WALLS.length);
    mesh.castShadow = this.quality !== 'low';
    mesh.receiveShadow = true;
    mesh.name = 'walls';

    const m = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();
    const quat = new THREE.Quaternion();

    WALLS.forEach(([x, z, w, d, h, kind], i) => {
      pos.set(x, h / 2, z);
      scl.set(w, h, d);
      m.compose(pos, quat, scl);
      mesh.setMatrixAt(i, m);

      const box = new THREE.Box3(
        new THREE.Vector3(x - w / 2, 0, z - d / 2),
        new THREE.Vector3(x + w / 2, h, z + d / 2),
      );
      this.boxes.push(box);
      this.bulletBoxes.push({ box, material: kind === 'metal' ? 'metal' : 'concrete' });
      this.navBlockers.push(box);
      if (h > 0.95) this.sightBlockers.push(box);
    });
    mesh.instanceMatrix.needsUpdate = true;
    this.group.add(mesh);
    this.wallMesh = mesh;
  }

  _buildProps() {
    if (!PROPS.length) return;
    const tex = crateTexture(11, `#${this.theme.crate.toString(16)}`);
    const mat = cached(`crate-${this.themeId}`, () => new THREE.MeshStandardMaterial({
      map: tex || null,
      color: tex ? 0xffffff : this.theme.crate,
      roughness: 0.88,
    }));
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mesh = new THREE.InstancedMesh(geo, mat, PROPS.length);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const m = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();
    const quat = new THREE.Quaternion();

    PROPS.forEach(([x, z, w, d, h, type], i) => {
      pos.set(x, h / 2, z);
      scl.set(w, h, d);
      m.compose(pos, quat, scl);
      mesh.setMatrixAt(i, m);
      const box = new THREE.Box3(
        new THREE.Vector3(x - w / 2, 0, z - d / 2),
        new THREE.Vector3(x + w / 2, h, z + d / 2),
      );
      this.boxes.push(box);
      this.bulletBoxes.push({ box, material: type === 'sandbag' ? 'sand' : 'wood' });
      this.navBlockers.push(box);
      if (h > 0.95) this.sightBlockers.push(box);
    });
    mesh.instanceMatrix.needsUpdate = true;
    this.group.add(mesh);
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

  update(dt) {
    this.time += dt;
    for (const a of this.animated) {
      if (a.kind === 'siteBeam') {
        a.mesh.material.opacity = 0.07 + Math.sin(this.time * 1.4) * 0.03;
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
