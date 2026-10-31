/**
 * Environment art layer.
 *
 * The playable geometry comes from the radar mask: thousands of axis aligned
 * boxes that all used to share one texture with one UV repeat, which is why
 * every wall looked like the same stretched painting. This module turns the
 * raw collision boxes into something that reads as a place:
 *
 *   • merged wall geometry with per-face, world-scaled UVs (no stretching)
 *   • baked vertex AO (dark at the floor, light on top) + per-wall tint noise
 *   • parapet caps, so a wall has a thickness and a top edge
 *   • posters, graffiti, vents, stains, stencils and cracks on real wall faces
 *   • clutter that gives cover: barrels, pallets, tyres, sandbags, pipes
 *   • a distant skyline ring and floating dust so the horizon is not empty
 *
 * Everything here is static, merged or instanced, so a weak GPU pays for a
 * handful of draw calls instead of thousands of meshes.
 */
import * as THREE from 'three';
import {
  wallPanel, crateTexture, metalPanel, palletTexture, groundSplat, stencilTexture,
  wallDecal, horizonTexture, normalMapFrom, glowTexture, tagTexture,
} from './Textures.js';

const _v = new THREE.Vector3();
const _c = new THREE.Color();

/* ------------------------------------------------------------------ */
/* geometry helpers                                                    */
/* ------------------------------------------------------------------ */

/**
 * One merged BufferGeometry for a list of boxes, with UVs measured in world
 * units and a vertex-colour AO ramp. `boxes` items are
 * `{ x, z, w, d, h, y = 0 }`.
 */
export function mergedBoxGeometry(boxes, { tile = 2.6, ao = true, topShade = false } = {}) {
  const count = boxes.length;
  const pos = new Float32Array(count * 24 * 3);
  const nrm = new Float32Array(count * 24 * 3);
  const uv = new Float32Array(count * 24 * 2);
  const col = new Float32Array(count * 24 * 3);
  const idx = new Uint32Array(count * 36);

  let v = 0;
  let ii = 0;
  const faces = [
    // [normal, uAxis, vAxis]
    { n: [0, 0, 1], u: [1, 0, 0], vAxis: [0, 1, 0] },
    { n: [0, 0, -1], u: [-1, 0, 0], vAxis: [0, 1, 0] },
    { n: [1, 0, 0], u: [0, 0, -1], vAxis: [0, 1, 0] },
    { n: [-1, 0, 0], u: [0, 0, 1], vAxis: [0, 1, 0] },
    { n: [0, 1, 0], u: [1, 0, 0], vAxis: [0, 0, -1] },
    { n: [0, -1, 0], u: [1, 0, 0], vAxis: [0, 0, 1] },
  ];

  for (let b = 0; b < count; b++) {
    const box = boxes[b];
    const { x, z, w, d } = box;
    const y0 = box.y || 0;
    const h = box.h;
    const y1 = y0 + h;
    // deterministic per-box variation so neighbouring walls never look cloned
    const seed = Math.abs((x * 7.13 + z * 3.71) | 0);
    const tint = 0.9 + ((seed % 17) / 17) * 0.18;
    const uvOffU = ((seed % 13) / 13) * 3.0;
    const uvOffV = ((seed % 29) / 29) * 3.0;
    const base = v;

    for (let f = 0; f < 6; f++) {
      const face = faces[f];
      // two in-plane axes and their half extents
      const ux = face.u[0], uz = face.u[2];
      const vx = face.vAxis[0], vy = face.vAxis[1], vz = face.vAxis[2];
      const halfU = Math.abs(ux) * w / 2 + Math.abs(uz) * d / 2;
      const halfV = Math.abs(vx) * w / 2 + Math.abs(vy) * h / 2 + Math.abs(vz) * d / 2;
      const nx = face.n[0], ny = face.n[1], nz = face.n[2];
      const cx = x + nx * (nx !== 0 ? (nx > 0 ? w / 2 : -w / 2) : 0);
      const cz = z + nz * (nz !== 0 ? (nz > 0 ? d / 2 : -d / 2) : 0);
      const cyy = (y0 + y1) / 2 + ny * (h / 2);

      const corners = [
        [-1, -1], [1, -1], [1, 1], [-1, 1],
      ];
      for (let k = 0; k < 4; k++) {
        const [su, sv] = corners[k];
        const px = cx + ux * halfU * su + vx * halfV * sv;
        const py = cyy + ny * 0 + vy * halfV * sv;
        const pz = cz + uz * halfU * su + vz * halfV * sv;
        const o = v * 3;
        pos[o] = px; pos[o + 1] = py; pos[o + 2] = pz;
        nrm[o] = nx; nrm[o + 1] = ny; nrm[o + 2] = nz;

        const uo = v * 2;
        const worldU = (halfU * 2) / tile;
        const worldV = (halfV * 2) / tile;
        uv[uo] = (su * 0.5 + 0.5) * worldU + uvOffU;
        uv[uo + 1] = (sv * 0.5 + 0.5) * worldV + uvOffV;

        // AO: contact darkening at the bottom, brighter shoulders up top
        let aoV = 1;
        if (ao) {
          if (ny === 0) {
            const t = Math.min(1, Math.max(0, (py - y0) / Math.max(0.001, h)));
            aoV = 0.52 + Math.pow(t, 0.6) * 0.56;
          } else if (ny < 0) {
            aoV = 0.5;
          } else if (ny > 0) {
            aoV = topShade ? 1.06 : 1;
          }
        }
        const t = aoV * tint;
        col[o] = t; col[o + 1] = t * 0.997; col[o + 2] = t * 0.99;
        v++;
      }
      // two triangles, CCW
      const q = base + f * 4;
      idx[ii++] = q; idx[ii++] = q + 1; idx[ii++] = q + 2;
      idx[ii++] = q; idx[ii++] = q + 2; idx[ii++] = q + 3;
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeBoundingSphere();
  return geo;
}

/** Shared textured + vertex-colour material factory. */
export function surfaceMaterial(canvasTex, { normalScale = 1, roughness = 0.92, metalness = 0.02, key = '' } = {}) {
  const tex = canvasTex;
  if (tex) tagTexture(tex, key || 'surf');
  const normal = tex ? normalMapFrom(tex.image, 2.2) : null;
  const mat = new THREE.MeshStandardMaterial({
    map: tex || null,
    normalMap: normal || null,
    vertexColors: true,
    roughness,
    metalness,
  });
  if (normal) {
    mat.normalScale.set(normalScale, normalScale);
  }
  return mat;
}

/* ------------------------------------------------------------------ */
/* clutter                                                             */
/* ------------------------------------------------------------------ */

const CLUTTER = {
  barrel: { r: 0.34, h: 1.05, cover: true },
  crate: { r: 0.52, h: 0.9, cover: true },
  pallet: { r: 0.6, h: 0.16, cover: false },
  tyre: { r: 0.42, h: 0.3, cover: false },
  sandbag: { r: 0.5, h: 0.5, cover: true },
};

/**
 * Scatters cover clutter next to real wall faces.
 * `isFree(x, z, r)` must return true when the spot is walkable and empty.
 */
export function scatterClutter({ group, theme, themeId, walls, isFree, quality, onBox }) {
  const rng = (i) => {
    const h = Math.sin(i * 127.1 + 311.7) * 43758.5453;
    return h - Math.floor(h);
  };
  const items = [];
  const pick = ['barrel', 'crate', 'pallet', 'tyre', 'sandbag'];
  const budget = quality === 'low' ? 90 : quality === 'high' ? 260 : 170;
  let tries = 0;
  while (items.length < budget && tries < budget * 14) {
    tries++;
    const wall = walls[(rng(tries) * walls.length) | 0];
    if (!wall) continue;
    const [x, z, w, d, h] = wall;
    if (h < 1.2) continue;
    // stand next to one of the four faces
    const side = (rng(tries + 7) * 4) | 0;
    const off = 0.55 + rng(tries + 13) * 0.5;
    let px = x;
    let pz = z;
    if (side === 0) { px = x + (rng(tries + 3) - 0.5) * w; pz = z + d / 2 + off; }
    else if (side === 1) { px = x + (rng(tries + 3) - 0.5) * w; pz = z - d / 2 - off; }
    else if (side === 2) { px = x + w / 2 + off; pz = z + (rng(tries + 3) - 0.5) * d; }
    else { px = x - w / 2 - off; pz = z + (rng(tries + 3) - 0.5) * d; }
    const kind = pick[(rng(tries + 21) * pick.length) | 0];
    const spec = CLUTTER[kind];
    if (!isFree(px, pz, spec.r + 0.45)) continue;
    if (items.some((it) => Math.hypot(it.x - px, it.z - pz) < 1.5)) continue;
    items.push({ x: px, z: pz, kind, rot: rng(tries + 31) * Math.PI * 2, h: spec.h, r: spec.r });
  }

  /* --- solid clutter: instanced boxes that also block movement --------- */
  const solids = items.filter((it) => it.kind === 'crate' || it.kind === 'sandbag');
  if (solids.length) {
    const tex = crateTexture(11, `#${theme.crate.toString(16)}`);
    const mat = surfaceMaterial(tex, { key: `crate-${themeId}`, roughness: 0.86 });
    const geo = mergedBoxGeometry(solids.map((it) => ({
      x: it.x, z: it.z, w: it.r * 2, d: it.r * 2, h: it.h,
    })), { tile: 1.1 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = 'clutter-solids';
    mesh.castShadow = quality !== 'low';
    mesh.receiveShadow = true;
    group.add(mesh);
    for (const it of solids) {
      const box = new THREE.Box3(
        new THREE.Vector3(it.x - it.r, 0, it.z - it.r),
        new THREE.Vector3(it.x + it.r, it.h, it.z + it.r),
      );
      onBox?.(box, it.kind === 'sandbag' ? 'sand' : 'wood');
    }
  }

  /* --- barrels: cylinders with hoops, one instanced draw -------------- */
  const barrels = items.filter((it) => it.kind === 'barrel');
  if (barrels.length) {
    const geoTank = new THREE.CylinderGeometry(0.34, 0.34, 1.05, 14, 1, false);
    const tex = metalPanel(5);
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      normalMap: normalMapFrom(tex.image, 1.6) || null,
      color: new THREE.Color().setHSL(0.06 + rng(3) * 0.08, 0.22, 0.34),
      roughness: 0.55,
      metalness: 0.55,
    });
    const mesh = new THREE.InstancedMesh(geoTank, mat, barrels.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3(1, 1, 1);
    barrels.forEach((it, i) => {
      _v.set(it.x, 0.525, it.z);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), it.rot);
      m.compose(_v, q, s);
      mesh.setMatrixAt(i, m);
      const box = new THREE.Box3(
        new THREE.Vector3(it.x - 0.36, 0, it.z - 0.36),
        new THREE.Vector3(it.x + 0.36, 1.05, it.z + 0.36),
      );
      onBox?.(box, 'metal');
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = quality !== 'low';
    mesh.receiveShadow = true;
    mesh.name = 'clutter-barrels';
    group.add(mesh);
  }

  /* --- flat junk: pallets and tyres, no collision --------------------- */
  const flats = items.filter((it) => it.kind === 'pallet' || it.kind === 'tyre');
  if (flats.length) {
    const tex = palletTexture(`#${theme.crate.toString(16)}`, 33);
    const mat = surfaceMaterial(tex, { key: `pallet-${themeId}` });
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mesh = new THREE.InstancedMesh(geo, mat, flats.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    flats.forEach((it, i) => {
      const tyre = it.kind === 'tyre';
      _v.set(it.x, tyre ? 0.15 : 0.08, it.z);
      q.setFromAxisAngle(up, it.rot);
      m.compose(_v, q, new THREE.Vector3(tyre ? 0.84 : 1.1, tyre ? 0.3 : 0.16, tyre ? 0.84 : 0.8));
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.receiveShadow = true;
    mesh.name = 'clutter-flat';
    group.add(mesh);
  }

  return items;
}

/* ------------------------------------------------------------------ */
/* wall dressing                                                       */
/* ------------------------------------------------------------------ */

/** Posters, graffiti, vents and stains attached to real wall faces. */
export function dressWalls({ group, walls, isFree, quality }) {
  const budget = quality === 'low' ? 40 : quality === 'high' ? 150 : 95;
  const kinds = ['poster', 'graffiti', 'vent', 'stain'];
  const decals = [];
  const rnd = (i) => {
    const h = Math.sin(i * 91.7 + 47.3) * 21374.123;
    return h - Math.floor(h);
  };
  for (let i = 0; i < budget * 3 && decals.length < budget; i++) {
    const wall = walls[(rnd(i) * walls.length) | 0];
    if (!wall) continue;
    const [x, z, w, d, h] = wall;
    if (h < 1.6) continue;
    const face = (rnd(i + 5) * 4) | 0;
    const kind = kinds[(rnd(i + 11) * kinds.length) | 0];
    let px = x;
    let pz = z;
    let rotY = 0;
    const along = rnd(i + 17) - 0.5;
    if (face === 0) { px = x + along * w * 0.8; pz = z + d / 2 + 0.03; rotY = 0; }
    else if (face === 1) { px = x - along * w * 0.8; pz = z - d / 2 - 0.03; rotY = Math.PI; }
    else if (face === 2) { px = x + w / 2 + 0.03; pz = z - along * d * 0.8; rotY = Math.PI / 2; }
    else { px = x - w / 2 - 0.03; pz = z + along * d * 0.8; rotY = -Math.PI / 2; }
    const scale = kind === 'poster' ? 0.9 : kind === 'stain' ? 2.2 : 1.3;
    decals.push({
      x: px, z: pz, rotY, kind, scale,
      y: kind === 'stain' ? 1.2 + rnd(i + 23) * 1.4 : 1.35 + rnd(i + 29) * 0.7,
      seed: 1 + ((rnd(i + 31) * 9) | 0),
    });
  }

  // group by kind so each set is one draw call
  const byKind = new Map();
  for (const d of decals) {
    if (!byKind.has(d.kind)) byKind.set(d.kind, []);
    byKind.get(d.kind).push(d);
  }
  const up = new THREE.Vector3(0, 1, 0);
  for (const [kind, list] of byKind) {
    const tex = wallDecal(kind, 1);
    const mat = new THREE.MeshBasicMaterial({
      map: tex, transparent: true, depthWrite: false, opacity: kind === 'stain' ? 0.55 : 0.92,
      polygonOffset: true, polygonOffsetFactor: -2,
    });
    const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), mat, list.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    list.forEach((d, i) => {
      _v.set(d.x, d.y, d.z);
      q.setFromAxisAngle(up, d.rotY);
      m.compose(_v, q, new THREE.Vector3(d.scale, d.scale * (kind === 'poster' ? 1.25 : 0.8), 1));
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.name = `decal-${kind}`;
    mesh.renderOrder = 3;
    group.add(mesh);
  }
  return decals;
}

/* ------------------------------------------------------------------ */
/* ground dressing                                                     */
/* ------------------------------------------------------------------ */

/** Sand drifts, cracks, site paint and arrows laid over the floor. */
export function dressGround({ group, theme, themeId, bounds, sites, quality, themeKind }) {
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cz = (bounds.minZ + bounds.maxZ) / 2;
  const w = bounds.maxX - bounds.minX;
  const d = bounds.maxZ - bounds.minZ;

  // 1) broad dirt layer: two overlapping splat planes, cheap and huge
  const splat = groundSplat(3);
  if (splat) {
    for (let i = 0; i < 2; i++) {
      const mat = new THREE.MeshBasicMaterial({
        map: splat, transparent: true, depthWrite: false,
        opacity: i === 0 ? 0.85 : 0.35,
        color: i === 0 ? 0xffffff : 0xbfae8a,
      });
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.02, d * 1.02), mat);
      plane.rotation.x = -Math.PI / 2;
      plane.rotation.z = i === 0 ? 0 : Math.PI / 3;
      plane.position.set(cx, 0.012 + i * 0.004, cz);
      plane.renderOrder = 1;
      plane.name = `ground-splat-${i}`;
      group.add(plane);
    }
  }

  // 2) stencils around the bomb sites and the spawn lanes
  const marks = [];
  for (const key of ['A', 'B']) {
    const site = sites[key];
    if (!site) continue;
    const col = key === 'A' ? '#e2b33c' : '#4bb2e2';
    marks.push({ x: site.center.x, z: site.center.z, kind: 'ring', color: col, s: site.radius * 1.9 });
    marks.push({
      x: site.center.x + site.radius * 0.85, z: site.center.z, kind: 'arrow', color: col, s: 1.8,
    });
    marks.push({
      x: site.center.x - site.radius * 0.85, z: site.center.z, kind: key, color: col, s: 1.6,
    });
  }
  const byColor = new Map();
  for (const m of marks) {
    const k = `${m.kind}|${m.color}`;
    if (!byColor.has(k)) byColor.set(k, []);
    byColor.get(k).push(m);
  }
  for (const [k, list] of byColor) {
    const [kind, color] = k.split('|');
    const tex = stencilTexture(kind, color);
    const mat = new THREE.MeshBasicMaterial({
      map: tex, transparent: true, depthWrite: false, opacity: 0.55,
      polygonOffset: true, polygonOffsetFactor: -3,
    });
    for (const m of list) {
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(m.s, m.s), mat);
      plane.rotation.x = -Math.PI / 2;
      plane.position.set(m.x, 0.05, m.z);
      plane.renderOrder = 2;
      group.add(plane);
    }
  }

  // 3) hazard stripes on the spawn edges
  const hazard = stencilTexture('hazard', themeKind === 'industrial' ? '#d8b23c' : '#b9a05a');
  if (hazard) {
    const mat = new THREE.MeshBasicMaterial({
      map: hazard, transparent: true, opacity: 0.22, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -3,
    });
    for (const side of [-1, 1]) {
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.9, 1.4), mat);
      plane.rotation.x = -Math.PI / 2;
      plane.position.set(cx, 0.04, cz + side * d * 0.42);
      plane.renderOrder = 2;
      group.add(plane);
    }
  }
  return marks;
}

/* ------------------------------------------------------------------ */
/* atmosphere                                                          */
/* ------------------------------------------------------------------ */

/** Concrete caps on top of every wall so the boxes read as architecture. */
export function buildWallCaps({ group, walls, theme, themeId, quality }) {
  const caps = walls
    .filter(([, , w, d, h]) => h > 0.9)
    .map(([x, z, w, d, h]) => ({
      x, z, w: w + 0.09, d: d + 0.09, h: 0.16, y: h - 0.02,
    }));
  if (!caps.length) return null;
  const tex = wallPanel(
    `#${(_c.set(theme.wallDark).getHex() | 0x111111).toString(16).padStart(6, '0')}`,
    `#${theme.wall.toString(16).padStart(6, '0')}`,
    19,
  );
  const mat = surfaceMaterial(tex, { key: `cap-${themeId}`, roughness: 0.95 });
  const geo = mergedBoxGeometry(caps, { tile: 1.8, ao: false, topShade: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'wall-caps';
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

/** Distant skyline ring — sells the illusion that the map sits in a city. */
export function buildHorizon({ group, bounds, themeId, quality }) {
  const span = Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ);
  const radius = span * 1.35 + 90;
  const tex = horizonTexture(themeId);
  if (!tex) return null;
  tex.repeat.set(4, 1);
  const geo = new THREE.CylinderGeometry(radius, radius, 70, 48, 1, true);
  const mat = new THREE.MeshBasicMaterial({
    map: tex, transparent: true, side: THREE.BackSide, depthWrite: false, fog: true, opacity: 0.95,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(
    (bounds.minX + bounds.maxX) / 2,
    18,
    (bounds.minZ + bounds.maxZ) / 2,
  );
  mesh.name = 'horizon';
  mesh.renderOrder = -1;
  group.add(mesh);
  return mesh;
}

/** Slow floating dust: one Points object, animated on the CPU-free path. */
export function buildDust({ group, bounds, quality, themeId }) {
  if (quality === 'low') return null;
  const count = quality === 'high' ? 1400 : 700;
  const pos = new Float32Array(count * 3);
  const seed = (i) => {
    const h = Math.sin(i * 12.9898) * 43758.5453;
    return h - Math.floor(h);
  };
  const w = bounds.maxX - bounds.minX;
  const d = bounds.maxZ - bounds.minZ;
  for (let i = 0; i < count; i++) {
    pos[i * 3] = bounds.minX + seed(i * 3) * w;
    pos[i * 3 + 1] = 0.4 + seed(i * 3 + 1) * 7;
    pos[i * 3 + 2] = bounds.minZ + seed(i * 3 + 2) * d;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.06,
    map: glowTexture('255,246,222', 0.05),
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
    fog: false,
  });
  const points = new THREE.Points(geo, mat);
  points.name = `dust-${themeId}`;
  points.frustumCulled = false;
  group.add(points);
  return { points, geo };
}

/** Warm window/lamp glows so vertical surfaces get some life at night maps. */
export function buildLampGlows({ group, walls, quality }) {
  if (quality === 'low') return [];
  const lamps = [];
  const rnd = (i) => {
    const h = Math.sin(i * 77.13 + 13.7) * 9817.31;
    return h - Math.floor(h);
  };
  const count = quality === 'high' ? 26 : 14;
  for (let i = 0; i < count; i++) {
    const wall = walls[(rnd(i) * walls.length) | 0];
    if (!wall) continue;
    const [x, z, w, d, h] = wall;
    const px = x + (rnd(i + 3) - 0.5) * w;
    const pz = z + d / 2 + 0.12;
    const gl = new THREE.SpriteMaterial({
      map: glowTexture('255,206,138', 0.02),
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    });
    const sprite = new THREE.Sprite(gl);
    sprite.position.set(px, Math.min(h - 0.6, 3.6), pz);
    sprite.scale.setScalar(1.6);
    sprite.name = 'lamp-glow';
    group.add(sprite);
    lamps.push(sprite);
  }
  return lamps;
}

/* ------------------------------------------------------------------ */
/* contact shadows                                                     */
/* ------------------------------------------------------------------ */

/** 1D gradient used by the contact-shadow skirts (opaque at the wall). */
function contactTexture() {
  const key = 'contact';
  const c = document.createElement('canvas');
  c.width = 8;
  c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 64);
  g.addColorStop(0, 'rgba(0,0,0,0.55)');
  g.addColorStop(0.35, 'rgba(0,0,0,0.26)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 8, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Fake ambient occlusion where walls meet the floor. Real AO is a post pass
 * (too slow for the target hardware), but a faded skirt costs one merged mesh
 * and instantly makes walls feel planted instead of floating on the plane.
 */
export function buildContactShadows({ group, walls, depth = 0.85 }) {
  if (!walls.length) return null;
  const verts = [];
  const uvs = [];
  const idxs = [];
  let v = 0;
  const push = (x, z, u, vv) => {
    verts.push(x, 0.02, z);
    uvs.push(u, vv);
    return v++;
  };
  for (const [x, z, w, d, h] of walls) {
    if (h < 0.5) continue;
    const hw = w / 2;
    const hd = d / 2;
    const rep = Math.max(1, Math.round(Math.max(w, d) / 2));
    // +Z, -Z, +X, -X skirts
    const a = push(x - hw, z + hd, 0, 0);
    const b = push(x + hw, z + hd, rep, 0);
    const c2 = push(x + hw, z + hd + depth, rep, 1);
    const d2 = push(x - hw, z + hd + depth, 0, 1);
    idxs.push(a, b, c2, a, c2, d2);
    const e = push(x + hw, z - hd, 0, 0);
    const f = push(x - hw, z - hd, rep, 0);
    const g2 = push(x - hw, z - hd - depth, rep, 1);
    const i2 = push(x + hw, z - hd - depth, 0, 1);
    idxs.push(e, f, g2, e, g2, i2);
    const j = push(x + hw, z + hd, 0, 0);
    const k = push(x + hw, z - hd, rep, 0);
    const l = push(x + hw + depth, z - hd, rep, 1);
    const m = push(x + hw + depth, z + hd, 0, 1);
    idxs.push(j, k, l, j, l, m);
    const n = push(x - hw, z - hd, 0, 0);
    const o = push(x - hw, z + hd, rep, 0);
    const p = push(x - hw - depth, z + hd, rep, 1);
    const q = push(x - hw - depth, z - hd, 0, 1);
    idxs.push(n, o, p, n, p, q);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(idxs);
  geo.computeVertexNormals();
  const mat = new THREE.MeshBasicMaterial({
    map: contactTexture(),
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    blending: THREE.NormalBlending,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'contact-ao';
  mesh.renderOrder = 1;
  group.add(mesh);
  return mesh;
}
