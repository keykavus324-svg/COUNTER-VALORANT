import * as THREE from 'three';
import {
  WALLS, PROPS, FLOORS, SITES, SPAWNS, NAV_NODES, MAP_BOUNDS,
  PLANT_SPOTS, HOLD_SPOTS, POST_PLANT_SPOTS, WALL_HEIGHT, THEMES,
} from './mapLayout.js';
import {
  wallPanel, floorTiles, sandGround, crateTexture, metalPanel, fabric,
  siteDecalTexture, skyTexture, glowTexture,
} from './Textures.js';
import { boxFromCenter, segmentBox2D, pointInBox } from '../core/utils.js';
import { getArtTexture, agentArtUrl, whenArtReady } from '../game/skins.js';

const _rayDir = new THREE.Vector3();

/* ------------------------------------------------------------------ */
/* material helpers                                                    */
/* ------------------------------------------------------------------ */
const matCache = new Map();

function panelMat(tex, w, h, tint = 0xffffff, extra = {}) {
  const rx = Math.min(3, Math.max(1, Math.round(w / 5)));
  const ry = Math.min(3, Math.max(1, Math.round(h / 4)));
  const key = `${tex.uuid}-${rx}-${ry}-${tint}-${JSON.stringify(extra)}`;
  if (matCache.has(key)) return matCache.get(key);
  const map = tex.clone();
  map.needsUpdate = true;
  map.repeat.set(rx, ry);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  const m = new THREE.MeshStandardMaterial({
    map,
    color: tint,
    roughness: 0.92,
    metalness: 0.02,
    ...extra,
  });
  matCache.set(key, m);
  return m;
}

function floorMat(tex, w, d, tint = 0xffffff, extra = {}) {
  const rx = Math.min(4, Math.max(1, Math.round(w / 7)));
  const ry = Math.min(4, Math.max(1, Math.round(d / 7)));
  const key = `${tex.uuid}-f-${w}-${d}-${tint}-${JSON.stringify(extra)}`;
  if (matCache.has(key)) return matCache.get(key);
  const map = tex.clone();
  map.needsUpdate = true;
  map.repeat.set(rx, ry);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  const m = new THREE.MeshStandardMaterial({ map, color: tint, roughness: 0.95, metalness: 0, ...extra });
  matCache.set(key, m);
  return m;
}

/* ------------------------------------------------------------------ */
export class GameMap {
  constructor(scene, quality = 'medium', themeId = 'dune') {
    this.scene = scene;
    this.quality = quality;
    this.themeId = THEMES[themeId] ? themeId : 'dune';
    this.theme = THEMES[this.themeId];
    this.group = new THREE.Group();
    this.group.name = 'map';
    scene.add(this.group);

    /** collision boxes: {min,max} */
    this.boxes = [];
    /** taller-than-knee boxes used for line of sight */
    this.sightBlockers = [];
    this.navBlockers = [];
    /** for bullets: same as boxes but with material name for impact FX */
    this.bulletBoxes = [];
    this.walls = [];
    this.props = [];
    this.animated = [];
    this.time = 0;

    this._buildLights();
    this._buildSky();
    this._buildFloors();
    this._buildWalls();
    this._buildProps();
    this._buildDetails();
    this._buildNav();
    this._buildAgentPosters();

    this.bounds = MAP_BOUNDS;
    this.sites = SITES;
    this.spawns = SPAWNS;
    this.plantSpots = PLANT_SPOTS;
    this.holdSpots = HOLD_SPOTS;
    this.postPlantSpots = POST_PLANT_SPOTS;
  }

  /* ---------------------------------------------------------------- */
  _buildLights() {
    const scene = this.scene;
    const hemi = new THREE.HemisphereLight(this.theme.hemi[0], this.theme.hemi[1], 0.95);
    scene.add(hemi);

    const amb = new THREE.AmbientLight(0xffffff, 0.28);
    scene.add(amb);

    const sun = new THREE.DirectionalLight(this.theme.sun, 2.35);
    sun.position.set(38, 52, 26);
    sun.target.position.set(0, 0, -4);
    scene.add(sun.target);
    sun.castShadow = this.quality !== 'low';
    if (sun.castShadow) {
      const size = this.quality === 'high' ? 2048 : 1024;
      sun.shadow.mapSize.set(size, size);
      const cam = sun.shadow.camera;
      cam.left = -46; cam.right = 46; cam.top = 46; cam.bottom = -46;
      cam.near = 1; cam.far = 160;
      sun.shadow.bias = -0.0006;
      sun.shadow.normalBias = 0.03;
      sun.shadow.camera.updateProjectionMatrix();
    }
    this.sun = sun;
    scene.add(sun);

    // warm bounce fill from the opposite side (very subtle)
    const fill = new THREE.DirectionalLight(0x9ec4e0, 0.34);
    fill.position.set(-30, 22, -34);
    scene.add(fill);

    // cool rim light to make silhouettes pop
    const rim = new THREE.DirectionalLight(0x6f9ec4, 0.22);
    rim.position.set(-14, 10, 40);
    scene.add(rim);

    scene.fog = new THREE.Fog(0xc8b193, 62, 165);
  }

  _buildSky() {
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(260, 32, 20),
      new THREE.MeshBasicMaterial({ map: skyTexture(this.theme.sky), side: THREE.BackSide, fog: false, depthWrite: false })
    );
    sky.rotation.y = 1.1;
    this.group.add(sky);

    // far dunes poking above the perimeter wall
    const duneMat = new THREE.MeshStandardMaterial({ color: 0xbda07a, roughness: 1, metalness: 0 });
    const duneMat2 = new THREE.MeshStandardMaterial({ color: 0xa98e6c, roughness: 1, metalness: 0 });
    const seed = [
      [-70, -95, 46, 13], [10, -120, 70, 18], [80, -100, 52, 15],
      [110, -40, 44, 11], [95, 60, 58, 16], [20, 120, 66, 14],
      [-90, 100, 50, 12], [-120, 20, 56, 15], [-115, -60, 40, 10],
    ];
    for (let i = 0; i < seed.length; i++) {
      const [x, z, r, h] = seed[i];
      const geo = new THREE.SphereGeometry(r, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2);
      const mesh = new THREE.Mesh(geo, i % 2 ? duneMat : duneMat2);
      mesh.position.set(x, -r * 0.55 + h, z);
      mesh.scale.set(1, 0.55, 0.8);
      mesh.rotation.y = i * 1.7;
      mesh.receiveShadow = false;
      this.group.add(mesh);
    }

    // distant watch towers for silhouette interest
    const towerMat = new THREE.MeshStandardMaterial({ color: 0x8e7f6b, roughness: 0.9 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x5b5347, roughness: 0.9 });
    for (const [x, z, s] of [[-52, -58, 1], [58, -62, 1.15], [72, 62, 0.9], [-66, 54, 1]]) {
      const t = new THREE.Group();
      const base = new THREE.Mesh(new THREE.CylinderGeometry(3.2 * s, 4.4 * s, 16 * s, 8), towerMat);
      base.position.y = 8 * s;
      const top = new THREE.Mesh(new THREE.CylinderGeometry(5.4 * s, 4.2 * s, 2.4 * s, 8), darkMat);
      top.position.y = 17 * s;
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 9 * s, 5), darkMat);
      mast.position.y = 22 * s;
      t.add(base, top, mast);
      t.position.set(x, 0, z);
      this.group.add(t);
    }
  }

  _buildFloors() {
    const th = this.theme;
    const groundTex = sandGround(5, th.ground, th.groundTint);
    const tileTex = floorTiles(th.floor);
    const laneTex = floorTiles(th.lane, 33);
    const spawnTex = floorTiles(th.spawn, 51);

    for (const [x, z, w, d, mat] of FLOORS) {
      let tex = groundTex;
      let tint = 0xffffff;
      let y = 0;
      if (mat === 'tileA' || mat === 'tileB') { tex = tileTex; tint = mat === 'tileA' ? 0xd8c9b2 : 0xcabfa9; }
      else if (mat === 'midlane' || mat === 'laneA' || mat === 'laneB' || mat === 'connA' || mat === 'connB') {
        tex = laneTex; tint = 0xffffff;
      } else if (mat === 'ctfloor') { tex = tileTex; tint = 0xbfb49f; }
      else if (mat === 'defspawn' || mat === 'atkspawn') { tex = spawnTex; tint = 0xd7ccb6; }

      const geo = new THREE.PlaneGeometry(w, d);
      geo.rotateX(-Math.PI / 2);
      const mesh = new THREE.Mesh(geo, floorMat(tex, w, d, tint));
      mesh.position.set(x, y + (mat === 'ground' ? 0 : 0.012), z);
      mesh.receiveShadow = true;
      this.group.add(mesh);
    }

    // painted site circles + letters
    for (const key of ['A', 'B']) {
      const site = SITES[key];
      const tex = siteDecalTexture(key, key === 'A' ? '#c8503f' : '#3f7fc8');
      const geo = new THREE.PlaneGeometry(15, 15);
      geo.rotateX(-Math.PI / 2);
      const mat = new THREE.MeshBasicMaterial({
        map: tex, transparent: true, depthWrite: false, opacity: 0.95,
        polygonOffset: true, polygonOffsetFactor: -2,
      });
      const m = new THREE.Mesh(geo, mat);
      m.position.set(site.center.x, 0.03, site.center.z);
      m.rotation.y = key === 'A' ? 0.4 : -0.55;
      this.group.add(m);
    }

    // spawn pads
    for (const [list, color] of [[SPAWNS.attacker, 0xe0663f], [SPAWNS.defender, 0x3f9ae0]]) {
      const cx = list[0].x;
      const cz = list[0].z;
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(3.2, 3.7, 40),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(cx, 0.035, cz);
      this.group.add(ring);
    }

    // shadow catcher plane just below everything
    const shadowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(140, 140),
      new THREE.MeshStandardMaterial({ color: new THREE.Color(th.ground2), roughness: 1 })
    );
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = -0.05;
    shadowPlane.receiveShadow = true;
    this.group.add(shadowPlane);
  }

  _buildWalls() {
    const th = this.theme;
    const concrete = wallPanel(th.wall[0], th.wall[1], 7);
    const concreteDark = wallPanel(th.wallDark[0], th.wallDark[1], 17);
    const metal = metalPanel(3);
    const fabricBlue = fabric('#2f5570', 13);
    const fabricRed = fabric('#7d2f33', 19);

    for (const [x, z, w, d, h, kind] of WALLS) {
      let tex = concrete;
      let tint = 0xffffff;
      if (kind === 'perimeter') { tex = concreteDark; tint = 0xd9cdb8; }
      else if (kind === 'metal') { tex = metal; tint = 0xdfe6ea; }

      const geo = new THREE.BoxGeometry(w, h, d);
      const mesh = new THREE.Mesh(geo, panelMat(tex, Math.max(w, d), h, tint, { roughness: 0.95 }));
      mesh.position.set(x, h / 2, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);
      this.walls.push(mesh);

      const box = boxFromCenter(x, h / 2, z, w, h, d);
      this.boxes.push(box);
      this.bulletBoxes.push({ box, material: kind === 'metal' ? 'metal' : 'concrete' });
      this.navBlockers.push(box);
      if (h > 0.95) this.sightBlockers.push(box);

      // painted fabric banners / advertising boards on some walls
      if (kind !== 'perimeter' && h >= 5 && (Math.abs(x) > 7 || Math.abs(z) > 10)) {
        if (Math.random() < 0.5) {
          const bw = Math.min(w, d) * 0.7;
          const bannerGeo = new THREE.PlaneGeometry(Math.max(1.6, bw), 2.6);
          const bannerMat = new THREE.MeshStandardMaterial({
            map: (Math.random() < 0.5 ? fabricBlue : fabricRed).clone(),
            roughness: 0.95,
            transparent: true,
            opacity: 0.92,
            side: THREE.DoubleSide,
          });
          bannerMat.map.repeat.set(1, 1);
          bannerMat.map.needsUpdate = true;
          const banner = new THREE.Mesh(bannerGeo, bannerMat);
          const y = 3.2;
          if (w > d) {
            banner.position.set(x, y, z + (d / 2 + 0.06) * (z < -15 ? -1 : 1));
            banner.rotation.y = z < -15 ? Math.PI : 0;
          } else {
            banner.position.set(x + (w / 2 + 0.06) * (x < 0 ? 1 : -1), y, z);
            banner.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2;
          }
          this.group.add(banner);
        }
      }

      // warm emissive strip lights near the top of big walls (adds night-time glow feel)
      if (kind !== 'perimeter' && h >= 5 && Math.random() < 0.55) {
        const lw = w > d ? Math.min(w * 0.7, 6) : 0.18;
        const ld = w > d ? 0.18 : Math.min(d * 0.7, 6);
        const strip = new THREE.Mesh(
          new THREE.BoxGeometry(lw, 0.16, ld),
          new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.85 })
        );
        strip.position.set(x, 4.7, z);
        this.group.add(strip);
        const glow = new THREE.PointLight(0xffc27a, 0.9, 12, 2);
        glow.position.set(x, 4.4, z);
        if (this.quality === 'high') this.group.add(glow);
      }
    }
  }

  _buildProps() {
    const crateTex = crateTexture(11, this.theme.crate);
    const bagTex = fabric('#8d7f63', 23);
    const barrelTex = metalPanel(9);

    for (const [x, z, w, d, h, type] of PROPS) {
      const container = new THREE.Group();
      let mesh;
      if (type === 'barrel' || type === 'barrelStack') {
        const r = w / 2;
        mesh = new THREE.Mesh(
          new THREE.CylinderGeometry(r, r, h, 14, 1),
          panelMat(barrelTex, w * 2, h, type === 'barrelStack' ? 0xb06a3a : 0x9a8a52, { metalness: 0.35, roughness: 0.7 })
        );
        mesh.position.set(x, h / 2, z);
        container.add(mesh);
        if (type === 'barrelStack') {
          const b2 = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.9, r * 0.9, h * 0.85, 12), panelMat(barrelTex, w, h, 0x7d5a3a, { metalness: 0.35, roughness: 0.7 }));
          b2.position.set(x + 0.25, h * 0.42 + h * 0.85 * 0.5 * 0.9, z + 0.1);
          b2.rotation.z = 0.06;
          container.add(b2);
        }
      } else if (type === 'sandbag') {
        const rows = Math.max(1, Math.round(h / 0.36));
        const bagH = h / rows;
        const g = new THREE.Group();
        for (let r = 0; r < rows; r++) {
          const count = Math.max(1, Math.round((w * d) / (bagH * bagH * 2.2)));
          const perRow = Math.max(1, Math.round(Math.sqrt(count)));
          for (let i = 0; i < perRow; i++) {
            for (let j = 0; j < Math.max(1, Math.round(count / perRow)); j++) {
              const bw = w / perRow;
              const bd = d / Math.max(1, Math.round(count / perRow));
              const bag = new THREE.Mesh(
                new THREE.BoxGeometry(bw * 0.98, bagH * 0.92, bd * 0.96),
                panelMat(bagTex, bw * 3, bagH * 3, 0xd9caa8, { roughness: 1 })
              );
              bag.position.set(
                -w / 2 + bw * (i + 0.5) + (r % 2 ? bw * 0.12 : 0),
                bagH * (r + 0.5),
                -d / 2 + bd * (j + 0.5)
              );
              bag.rotation.y = (Math.random() - 0.5) * 0.18;
              bag.castShadow = true;
              bag.receiveShadow = true;
              g.add(bag);
            }
          }
        }
        g.position.set(x, 0, z);
        container.add(g);
      } else if (type === 'container') {
        const bodyMat = panelMat(metalPanel(27), w, h, 0x7f8a72, { metalness: 0.45, roughness: 0.62 });
        mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bodyMat);
        mesh.position.set(x, h / 2, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        container.add(mesh);
        // door ridges
        for (let i = -2; i <= 2; i++) {
          const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.12, h * 0.92, 0.12), new THREE.MeshStandardMaterial({ color: 0x5d6752, metalness: 0.5, roughness: 0.6 }));
          ridge.position.set(x + i * (w / 6), h / 2, z + d / 2 + 0.02);
          container.add(ridge);
        }
      } else {
        // crate (possibly wide)
        mesh = new THREE.Mesh(
          new THREE.BoxGeometry(w, h, d),
          panelMat(crateTex, w * 1.4, h * 1.4, 0xffffff, { roughness: 0.88 })
        );
        mesh.position.set(x, h / 2, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        container.add(mesh);
        // metal banding
        const bandMat = new THREE.MeshStandardMaterial({ color: 0x5b6167, metalness: 0.55, roughness: 0.55 });
        const bandH = 0.07;
        for (const yy of [h * 0.16, h * 0.84]) {
          const band = new THREE.Mesh(new THREE.BoxGeometry(w * 1.005, bandH, d * 1.005), bandMat);
          band.position.set(x, yy, z);
          container.add(band);
        }
      }

      this.group.add(container);
      const box = boxFromCenter(x, h / 2, z, w, d, h);
      this.boxes.push(box);
      this.bulletBoxes.push({ box, material: type === 'sandbag' ? 'sand' : 'wood' });
      this.navBlockers.push(box);
      if (h > 0.95) this.sightBlockers.push(box);
      this.props.push(container);
    }
  }

  _buildDetails() {
    // scattered debris + pebbles for visual richness (no collision)
    const pebbleMat = new THREE.MeshStandardMaterial({ color: 0x8a7a63, roughness: 1 });
    const pebbleGeo = new THREE.DodecahedronGeometry(0.16, 0);
    const inst = new THREE.InstancedMesh(pebbleGeo, pebbleMat, 260);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 260; i++) {
      const x = (Math.random() - 0.5) * 62;
      const z = (Math.random() - 0.5) * 62;
      dummy.position.set(x, 0.04, z);
      dummy.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      const s = 0.5 + Math.random() * 1.6;
      dummy.scale.set(s, s * 0.6, s);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    }
    inst.castShadow = false;
    inst.receiveShadow = true;
    this.group.add(inst);

    // dry grass tufts
    const grassMat = new THREE.MeshStandardMaterial({ color: 0x9a8c5f, roughness: 1, side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
    const bladeGeo = new THREE.ConeGeometry(0.09, 0.55, 3);
    const grass = new THREE.InstancedMesh(bladeGeo, grassMat, 420);
    for (let i = 0; i < 420; i++) {
      const x = (Math.random() - 0.5) * 60;
      const z = (Math.random() - 0.5) * 60;
      dummy.position.set(x, 0.26, z);
      dummy.rotation.set(0, Math.random() * 3, (Math.random() - 0.5) * 0.4);
      const s = 0.7 + Math.random();
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      grass.setMatrixAt(i, dummy.matrix);
    }
    this.group.add(grass);

    // site signage on walls (letters facing the site)
    for (const key of ['A', 'B']) {
      const site = SITES[key];
      const tex = siteDecalTexture(key, key === 'A' ? '#f0e6d2' : '#f0e6d2');
      const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(4, 4),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.85, depthWrite: false })
      );
      sign.position.set(site.center.x + (key === 'A' ? 6.5 : -6.5), 3.6, -31.6);
      this.group.add(sign);
    }

    // hanging cables across mid, gives scale/depth
    const cableMat = new THREE.LineBasicMaterial({ color: 0x2a2620, transparent: true, opacity: 0.75 });
    for (let i = 0; i < 5; i++) {
      const z = -6 + i * 5;
      const pts = [];
      for (let t = 0; t <= 14; t++) {
        const p = t / 14;
        const x = -8 + p * 16;
        const y = 5.4 - Math.sin(p * Math.PI) * 0.9;
        pts.push(new THREE.Vector3(x, y, z));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      this.group.add(new THREE.Line(geo, cableMat));
    }

    // floating dust motes (animated)
    const dustCount = 400;
    const pos = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 60;
      pos[i * 3 + 1] = Math.random() * 8;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 60;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
      size: 0.07, color: 0xfff0d0, transparent: true, opacity: 0.45, depthWrite: false, sizeAttenuation: true,
    }));
    this.dust = dust;
    this.group.add(dust);

    // subtle scene "wind" sound anchor / light shafts from the sky
    const shaftTex = glowTexture('255,236,200', 0.4);
    for (let i = 0; i < 6; i++) {
      const s = new THREE.Mesh(
        new THREE.PlaneGeometry(9, 26),
        new THREE.MeshBasicMaterial({ map: shaftTex, transparent: true, opacity: 0.055, depthWrite: false, side: THREE.DoubleSide })
      );
      s.position.set(-24 + i * 9.5, 9, (i % 2 ? 1 : -1) * 8);
      s.rotation.set(0.22, i * 0.7, 0.12);
      this.group.add(s);
    }
  }

  /* ---------------------------------------------------------------- */
  _buildNav() {
    this.navNodes = NAV_NODES.map((n, i) => ({ ...n, i }));
    const nodes = this.navNodes;
    const blockers = this.navBlockers;
    const edges = new Map();
    const NAV_INFLATE = 0.34;
    const clear = (a, b) => {
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const len = Math.hypot(dx, dz);
      const steps = Math.ceil(len / 0.25);
      for (let s = 0; s <= steps; s++) {
        const x = a.x + (dx * s) / steps;
        const z = a.z + (dz * s) / steps;
        for (const box of blockers) {
          if (x > box.min.x - NAV_INFLATE && x < box.max.x + NAV_INFLATE && z > box.min.z - NAV_INFLATE && z < box.max.z + NAV_INFLATE) return false;
        }
      }
      return true;
    };

    for (let i = 0; i < nodes.length; i++) {
      edges.set(i, []);
      for (let j = 0; j < nodes.length; j++) {
        if (i === j) continue;
        const a = nodes[i];
        const b = nodes[j];
        const dist = Math.hypot(a.x - b.x, a.z - b.z);
        if (dist > 26) continue;
        if (!clear(a, b)) continue;
        edges.get(i).push({ to: j, cost: dist });
      }
    }
    this.navEdges = edges;

    // A* path finding over the waypoint graph
    this.findPath = (fromIdx, toIdx) => {
      if (fromIdx === toIdx) return [toIdx];
      const open = [{ i: fromIdx, f: 0, g: 0 }];
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
        for (const e of edges.get(cur.i) || []) {
          if (closed.has(e.to)) continue;
          const g = (gScore.get(cur.i) ?? Infinity) + e.cost;
          if (g < (gScore.get(e.to) ?? Infinity)) {
            gScore.set(e.to, g);
            came.set(e.to, cur.i);
            open.push({ i: e.to, g, f: g + h(e.to) * 1.05 });
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
    // ground plane y = 0
    if (_rayDir.y < -1e-5) {
      const t = -origin.y / _rayDir.y;
      if (t > 0 && t < maxDist && (!best || t < best.distance)) {
        best = { distance: t, normal: { x: 0, y: 1, z: 0 }, material: 'ground' };
      }
    }
    if (best) {
      best.point = origin.clone().addScaledVector(_rayDir, best.distance);
    }
    return best;
  }

  /** True when two points can see each other (tall geometry only). */
  hasLineOfSight(a, b, eyeA = 1.6, eyeB = 1.6) {
    const minEye = Math.min(a.y ?? eyeA, b.y ?? eyeB);
    for (const box of this.sightBlockers) {
      if (box.max.y < minEye + 0.1) continue;
      if (segmentBox2D(a.x, a.z, b.x, b.z, box)) return false;
    }
    return true;
  }

  /** Highest walkable surface below (x, z) that the player can stand on. */
  supportHeight(x, z, feetY) {
    let top = 0;
    for (const box of this.boxes) {
      if (x < box.min.x || x > box.max.x || z < box.min.z || z > box.max.z) continue;
      // you can only stand on a surface you're above (or almost above)
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
    if (this.dust) {
      this.dust.rotation.y += dt * 0.012;
      this.dust.position.y = Math.sin(this.time * 0.15) * 0.2;
    }
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
    });
    for (const m of matCache.values()) {
      if (m.map) m.map.dispose();
      m.dispose();
    }
    matCache.clear();
  }
  /* ---------------------------------------------------------------- */
  /**
   * Wall posters with the real Valorant agent renders. They pop in only once the
   * artwork has actually downloaded; offline the walls simply stay clean.
   */
  _buildAgentPosters() {
    const keys = ['phoenix', 'omen', 'sova', 'sage'];
    const spots = [
      // attacker yard: perimeter wall behind the spawn, facing the players
      { x: 0, z: 32.85, ry: Math.PI, w: 3.4, h: 4.6 },
      { x: -12, z: 32.85, ry: Math.PI, w: 2.6, h: 3.6 },
      { x: 12, z: 32.85, ry: Math.PI, w: 2.6, h: 3.6 },
      // defender spawn room, on the back wall
      { x: 0, z: -32.85, ry: 0, w: 3.2, h: 4.4 },
      // A / B site entrance walls, facing the spike sites
      { x: 21, z: -12.72, ry: Math.PI, w: 2.4, h: 3.4 },
      { x: -21, z: -12.72, ry: Math.PI, w: 2.4, h: 3.4 },
    ];
    const urls = keys.map((k) => agentArtUrl(k, 'fullportrait'));
    const groups = [];
    spots.forEach((spot, i) => {
      const key = keys[i % keys.length];
      const url = agentArtUrl(key, 'fullportrait');
      const g = new THREE.Group();
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(spot.w + 0.16, spot.h + 0.16, 0.1),
        new THREE.MeshStandardMaterial({ color: 0x1c2530, roughness: 0.8, metalness: 0.35 })
      );
      const art = new THREE.Mesh(
        new THREE.PlaneGeometry(spot.w, spot.h),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, toneMapped: false })
      );
      art.position.z = 0.07;
      g.add(frame, art);
      g.position.set(spot.x, spot.h / 2 + 0.6, spot.z);
      g.rotation.y = spot.ry;
      this.group.add(g);
      groups.push({ art, url });
    });

    const paint = () => {
      for (const { art, url } of groups) {
        const tex = getArtTexture(url);
        if (!tex || art.material.map === tex) continue;
        art.material.map = tex;
        art.material.opacity = 0.92;
        art.material.needsUpdate = true;
      }
    };
    paint();
    whenArtReady(urls, paint);
  }

}

/* slab test returning distance + normal */
function rayBoxLocal(origin, dir, box, maxDist) {
  let tmin = 0;
  let tmax = maxDist;
  let axis = null;
  let sign = 0;
  for (const a of ['x', 'y', 'z']) {
    const o = origin[a];
    const d = dir[a];
    if (Math.abs(d) < 1e-8) {
      if (o < box.min[a] || o > box.max[a]) return null;
    } else {
      const inv = 1 / d;
      let t1 = (box.min[a] - o) * inv;
      let t2 = (box.max[a] - o) * inv;
      let s = -1;
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; s = 1; }
      if (t1 > tmin) { tmin = t1; axis = a; sign = s; }
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return null;
    }
  }
  if (!axis) return null;
  const normal = { x: 0, y: 0, z: 0 };
  normal[axis] = sign;
  return { distance: tmin, normal };
}
