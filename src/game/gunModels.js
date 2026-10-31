/**
 * Modelled weapons.
 *
 * Each gun is built the way it would be modelled by hand: a sketch of the side
 * silhouette extruded and bevelled (receiver), revolved profiles (barrels,
 * suppressors, scope tubes), lofted cross-sections (stocks, grips, handguards)
 * and a cross-section swept along a curve (banana magazines). No part is an
 * axis-aligned box unless the real thing is one.
 *
 * Coordinates: −Z is forward (muzzle), +Y up, +X right; the origin sits at the
 * trigger hand, roughly where the grip meets the receiver.
 */
import * as THREE from 'three';
import {
  extrudeProfile, lathe, loft, ring, sweep, bezierPath, roundedBox, meshOf, mergeGeometries,
} from './meshkit.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

/** Side profile authored in (forward, up) then turned so +forward becomes −Z. */
function side(profile, width, opts) {
  return extrudeProfile(profile, width, opts).rotateY(Math.PI / 2);
}

/** Revolved part authored as [radius, length] and pointing forward. */
function tube(profile, segments = 16) {
  return lathe(profile, segments, { along: 'z' });
}

/**
 * Revolved part pointed forward. The profile is authored as [radius, length]
 * with *negative* lengths, so the geometry runs from the receiver towards −Z
 * and the caller only has to place it.
 */
function tubeAt(profile, segments = 16) {
  return tube(profile, segments);
}

/* ------------------------------------------------------------------ */
/* shared sub-assemblies                                               */
/* ------------------------------------------------------------------ */

/** Trigger + guard, used by every firearm. */
function triggerGroup(M, z = 0.02, y = -0.045, scale = 1) {
  const guardGeo = side([
    [-0.052, 0.0], [-0.052, -0.028], [-0.02, -0.052], [0.036, -0.05],
    [0.05, -0.03], [0.05, 0.0], [0.038, 0.0], [0.038, -0.026],
    [0.006, -0.04], [-0.024, -0.038], [-0.038, -0.02], [-0.038, 0.0],
  ], 0.012 * scale, { bevel: 0.003, segments: 2 });
  const guard = meshOf(guardGeo, M.metal, { pos: [0, y, z] });
  const trigger = meshOf(
    side([[-0.008, 0.0], [0.008, 0.0], [0.004, -0.03], [-0.012, -0.032]], 0.009, { bevel: 0.002 }),
    M.metalDark, { pos: [0, y, z], rot: [0, 0, 0] },
  );
  return [guard, trigger];
}

/** Iron sights: a rear notch block and a front post on a small tower. */
function ironSights(M, rearZ, frontZ, y) {
  const rear = meshOf(
    side([[-0.012, 0], [0.012, 0], [0.012, 0.018], [0.004, 0.022], [-0.004, 0.022], [-0.012, 0.018]], 0.03, { bevel: 0.003 }),
    M.metalDark, { pos: [0, y, rearZ] },
  );
  const tower = meshOf(
    side([[-0.02, 0], [0.02, 0], [0.016, 0.03], [-0.016, 0.03]], 0.028, { bevel: 0.003 }),
    M.metalDark, { pos: [0, y, frontZ] },
  );
  const post = meshOf(roundedBox(0.006, 0.016, 0.006, 0.002), M.metal, { pos: [0, y + 0.036, frontZ] });
  return [rear, tower, post];
}

/** Curved magazine: a rounded cross-section swept along a banana curve. */
function bananaMag(M, { z = -0.03, y = -0.05, length = 0.26, curve = -0.13, w = 0.03, d = 0.075 }) {
  const path = bezierPath(
    V3(0, y, z),
    V3(0, y - length * 0.55, z + curve * 0.16),
    V3(0, y - length, z + curve),
    7,
  );
  const geo = sweep(ring(w, d, Math.min(w, d) * 0.32, 12), path, {
    up: V3(1, 0, 0),
    scale: (t) => 1 - t * 0.06,
  });
  const mag = new THREE.Mesh(geo, M.metalDark);
  mag.castShadow = true;
  return mag;
}

/**
 * Stock sections are authored with positive Z for readability, but a rifle
 * stock belongs behind the receiver (negative Z in weapon space), so the loft
 * is mirrored once here instead of in every call site.
 */
function stock(M, sections, material) {
  const rings = sections.map(({ w, h, r }) => ring(w, h, r, 12));
  const positions = [];
  const indices = [];
  const n = rings[0].length;
  sections.forEach((s, si) => {
    rings[si].forEach(([x, y]) => positions.push(x, y + s.y, -s.z));
  });
  for (let s = 0; s < sections.length - 1; s++) {
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const a = s * n + i;
      const b = s * n + j;
      const c = (s + 1) * n + j;
      const d = (s + 1) * n + i;
      indices.push(a, b, c, a, c, d);
    }
  }
  // flat caps at both ends: a fan around the ring centroid is watertight here
  const cap = (startIdx, flip) => {
    const cz = sections[startIdx].z;
    const cy = sections[startIdx].y;
    const cen = positions.length / 3;
    positions.push(0, cy, -cz);
    for (let i = 0; i < n; i++) {
      const a = startIdx * n + i;
      const b = startIdx * n + ((i + 1) % n);
      if (flip) indices.push(cen, b, a);
      else indices.push(cen, a, b);
    }
  };
  cap(0, false);
  cap(sections.length - 1, true);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  return mesh;
}

/** Pistol grip: a lofted, raked handle. */
function pistolGrip(M, { z = 0.06, top = -0.02, len = 0.15, rake = 0.055, w = 0.036, d = 0.055 }, material) {
  const mk = (t) => {
    const h = w * (1 - t * 0.12);
    const dd = d * (1 - t * 0.05);
    return ring(h, dd, Math.min(h, dd) * 0.3, 10).map(([x, y]) => [x, y, z + rake * t]);
  };
  const secs = [mk(0), mk(0.35), mk(0.7), mk(1)].map((sec, i, arr) => {
    const t = i / (arr.length - 1);
    return sec.map(([x, y, zz]) => [x, y + top - len * t, zz]);
  });
  const geo = loft(secs);
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  return mesh;
}

/** Slim rail with cut slots along the top of a receiver. */
function rail(M, z0, z1, y, width = 0.024) {
  const parts = [];
  const len = z1 - z0;
  const base = meshOf(roundedBox(width, 0.008, len, 0.002), M.metalDark, { pos: [0, y, z0 + len / 2] });
  parts.push(base);
  const slots = Math.max(2, Math.round(len / 0.028));
  for (let i = 0; i < slots; i++) {
    const z = z0 + (i + 0.5) * (len / slots);
    parts.push(meshOf(roundedBox(width * 0.9, 0.005, len / slots * 0.45, 0.0015), M.metal, { pos: [0, y + 0.005, z] }));
  }
  return parts;
}

/* ------------------------------------------------------------------ */
/* rifles                                                              */
/* ------------------------------------------------------------------ */

function buildAK(M) {
  const root = new THREE.Group();
  const mag = bananaMag(M, { z: -0.035, y: -0.045, length: 0.255, curve: -0.115, w: 0.031, d: 0.078 });

  // receiver: stamped steel box with the AK's sloped rear and dust cover
  const receiver = meshOf(side([
    [0.2, -0.05], [0.215, -0.03], [0.215, 0.055], [0.15, 0.072],
    [-0.1, 0.072], [-0.145, 0.05], [-0.145, -0.05],
  ], 0.046, { bevel: 0.005, segments: 2 }), M.metal);
  const dustCover = meshOf(side([
    [-0.095, 0.07], [0.145, 0.07], [0.135, 0.092], [-0.085, 0.092],
  ], 0.044, { bevel: 0.008, segments: 3 }), M.metalDark);
  root.add(receiver, dustCover);

  // wooden handguard + the upper wooden cover over the gas tube
  const handguard = new THREE.Mesh(loft([
    ring(0.048, 0.082, 0.016, 12).map(([x, y]) => [x, y + 0.012, -0.145]),
    ring(0.05, 0.08, 0.017, 12).map(([x, y]) => [x, y + 0.01, -0.24]),
    ring(0.046, 0.072, 0.015, 12).map(([x, y]) => [x, y + 0.008, -0.355]),
  ]), M.wood);
  const upper = meshOf(side([
    [0.2, 0.078], [0.36, 0.086], [0.362, 0.112], [0.2, 0.108],
  ], 0.04, { bevel: 0.009, segments: 3 }), M.woodDark);
  root.add(handguard, upper);

  // barrel, gas block, front sight, muzzle device
  root.add(meshOf(tubeAt([[0.0135, 0], [0.011, -0.3], [0.0105, -0.42]], 14), M.metalDark, { pos: [0, 0.024, -0.145] }));
  root.add(meshOf(tubeAt([[0.009, 0], [0.008, -0.24]], 12), M.metal, { pos: [0, 0.062, -0.2] }));
  root.add(meshOf(side([
    [0.36, 0.02], [0.395, 0.02], [0.395, 0.105], [0.36, 0.105],
  ], 0.042, { bevel: 0.005 }), M.metalDark));
  root.add(meshOf(side([
    [0.4, 0.012], [0.44, 0.014], [0.438, 0.03], [0.402, 0.028],
  ], 0.03, { bevel: 0.004 }), M.metalDark));
  // front sight tower, seated on the barrel
  root.add(meshOf(side([
    [0.4, 0.022], [0.43, 0.024], [0.428, 0.098], [0.404, 0.096],
  ], 0.026, { bevel: 0.004 }), M.metalDark));
  root.add(meshOf(tubeAt([[0.016, 0], [0.017, -0.03], [0.014, -0.055]], 14), M.metalDark, { pos: [0, 0.028, -0.56] }));

  // furniture
  root.add(pistolGrip(M, { z: -0.075, top: -0.03, len: 0.16, rake: -0.05 }, M.woodDark));
  root.add(stock(M, [
    { z: 0.16, y: 0.0, w: 0.048, h: 0.1, r: 0.014 },
    { z: 0.28, y: -0.012, w: 0.045, h: 0.088, r: 0.012 },
    { z: 0.46, y: -0.03, w: 0.042, h: 0.082, r: 0.012 },
    { z: 0.54, y: -0.038, w: 0.05, h: 0.1, r: 0.016 },
  ], M.wood));
  // butt plate
  root.add(meshOf(roundedBox(0.05, 0.1, 0.012, 0.004), M.metalDark, { pos: [0, -0.038, -0.542] }));

  root.add(mag);
  triggerGroup(M, 0.03, -0.045).forEach((p) => root.add(p));
  ironSights(M, -0.06, -0.455, 0.092).forEach((p) => root.add(p));
  // charging handle + selector
  root.add(meshOf(roundedBox(0.012, 0.012, 0.05, 0.003), M.metal, { pos: [0.03, 0.055, 0.02], rot: [0, 0.2, 0] }));
  root.add(meshOf(roundedBox(0.008, 0.03, 0.06, 0.003), M.metalDark, { pos: [0.026, 0.03, 0.06] }));

  return { root, mag, muzzle: V3(0, 0.028, -0.6), eject: V3(0.03, 0.05, -0.02) };
}

function buildM4(M) {
  const root = new THREE.Group();
  const mag = bananaMag(M, { z: -0.02, y: -0.05, length: 0.235, curve: -0.045, w: 0.028, d: 0.072 });

  // upper + lower receiver as one milled silhouette, plus the carry-handle hump
  const lower = meshOf(side([
    [0.16, -0.055], [0.175, -0.03], [0.175, 0.045], [-0.1, 0.048],
    [-0.15, 0.03], [-0.15, -0.03], [-0.09, -0.055],
  ], 0.044, { bevel: 0.006, segments: 2 }), M.polymer);
  const upper = meshOf(side([
    [-0.155, 0.045], [0.16, 0.045], [0.16, 0.088], [-0.145, 0.088],
  ], 0.045, { bevel: 0.007, segments: 3 }), M.metal);
  root.add(lower, upper);

  // free-float handguard: octagonal loft with vent slots
  const hgSecs = [
    ring(0.056, 0.062, 0.018, 8).map(([x, y]) => [x, y + 0.005, -0.175]),
    ring(0.052, 0.058, 0.017, 8).map(([x, y]) => [x, y + 0.004, -0.3]),
    ring(0.05, 0.055, 0.016, 8).map(([x, y]) => [x, y + 0.003, -0.4]),
    ring(0.046, 0.05, 0.015, 8).map(([x, y]) => [x, y + 0.002, -0.45]),
  ];
  const hg = new THREE.Mesh(loft(hgSecs), M.metalDark);
  root.add(hg);
  rail(M, -0.45, -0.17, 0.055).forEach((p) => root.add(p));

  // barrel + muzzle device
  root.add(meshOf(tubeAt([[0.011, 0], [0.0095, -0.2]], 14), M.metalDark, { pos: [0, 0.03, -0.3] }));
  root.add(meshOf(tubeAt([[0.014, 0], [0.015, -0.05], [0.013, -0.07]], 14), M.metal, { pos: [0, 0.03, -0.55] }));

  // buffer tube + collapsible stock
  root.add(meshOf(tubeAt([[0.017, 0], [0.017, -0.24]], 14), M.metalDark, { pos: [0, 0.03, -0.16] }));
  root.add(stock(M, [
    { z: 0.25, y: 0.0, w: 0.05, h: 0.09, r: 0.016 },
    { z: 0.35, y: -0.004, w: 0.052, h: 0.095, r: 0.017 },
    { z: 0.45, y: -0.008, w: 0.05, h: 0.1, r: 0.018 },
  ], M.polymer));

  root.add(pistolGrip(M, { z: -0.075, top: -0.03, len: 0.145, rake: -0.05 }, M.polymer));
  root.add(mag);
  triggerGroup(M, 0.05, -0.05).forEach((p) => root.add(p));
  ironSights(M, -0.02, -0.44, 0.092).forEach((p) => root.add(p));
  // charging handle + ejection port cover
  root.add(meshOf(roundedBox(0.05, 0.014, 0.026, 0.004), M.metalDark, { pos: [0, 0.098, 0.115] }));
  root.add(meshOf(roundedBox(0.006, 0.03, 0.07, 0.002), M.metal, { pos: [0.024, 0.055, -0.03] }));

  return { root, mag, muzzle: V3(0, 0.03, -0.62), eject: V3(0.028, 0.055, 0.0) };
}

function buildAWP(M) {
  const root = new THREE.Group();
  const mag = meshOf(roundedBox(0.03, 0.05, 0.07, 0.006), M.metalDark, { pos: [0, -0.05, -0.02] });

  // long, slim receiver with the distinctive thumbhole/cheek riser
  const body = meshOf(side([
    [0.2, -0.05], [0.21, -0.02], [0.21, 0.05], [0.12, 0.06],
    [-0.16, 0.055], [-0.2, 0.02], [-0.2, -0.04], [-0.05, -0.05], [0.05, -0.055],
  ], 0.048, { bevel: 0.007, segments: 2 }), M.metalDark);
  root.add(body);

  // barrel: thick, long, with a fluted taper and a brake at the muzzle
  root.add(meshOf(tubeAt([[0.0165, 0], [0.0145, -0.4], [0.012, -0.62]], 18), M.metal, { pos: [0, 0.025, -0.2] }));
  root.add(meshOf(tubeAt([[0.021, 0], [0.022, -0.03], [0.019, -0.075]], 16), M.metalDark, { pos: [0, 0.025, -0.84] }));

  // scope: tube, bells, turrets, rings
  const scopeZ = -0.12;
  root.add(meshOf(tubeAt([
    [0.021, 0], [0.024, 0.02], [0.024, 0.24], [0.021, 0.3], [0.023, 0.32], [0.024, 0.36], [0.02, 0.38],
  ], 20), M.metalDark, { pos: [0, 0.135, scopeZ] }));
  root.add(meshOf(tubeAt([[0.026, 0], [0.027, 0.012], [0.026, 0.02]], 20), M.metal, { pos: [0, 0.135, scopeZ - 0.02] }));
  root.add(meshOf(tubeAt([[0.03, 0], [0.031, 0.018], [0.03, 0.034]], 20), M.metalDark, { pos: [0, 0.135, scopeZ + 0.36] }));
  root.add(meshOf(tubeAt([[0.028, 0], [0.028, 0.004]], 20), M.glass, { pos: [0, 0.135, scopeZ + 0.395] }));
  root.add(meshOf(tubeAt([[0.026, 0], [0.026, 0.004]], 20).rotateY(Math.PI), M.glass, { pos: [0, 0.135, scopeZ - 0.024] }));
  // turrets
  root.add(meshOf(tubeAt([[0.012, 0], [0.013, 0.018]], 12).rotateZ(Math.PI / 2), M.metal, { pos: [0.03, 0.135, scopeZ + 0.12] }));
  root.add(meshOf(tubeAt([[0.012, 0], [0.014, 0.022]], 12), M.metal, { pos: [0, 0.166, scopeZ + 0.12] }));
  // scope rings
  for (const z of [scopeZ + 0.04, scopeZ + 0.28]) {
    root.add(meshOf(tubeAt([[0.03, 0], [0.03, 0.016]], 16).rotateX(Math.PI / 2), M.metal, { pos: [0, 0.135, z - 0.008] }));
    root.add(meshOf(roundedBox(0.02, 0.05, 0.016, 0.003), M.metal, { pos: [0, 0.1, z] }));
  }

  // bolt handle with ball end
  root.add(meshOf(tubeAt([[0.007, 0], [0.006, 0.06]], 10).rotateZ(-Math.PI / 2.6), M.metal, { pos: [0.02, 0.035, 0.02] }));
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.017, 12, 8), M.metalDark);
  knob.position.set(0.075, 0.075, 0.02);
  root.add(knob);

  // stock: thumbhole silhouette, cheek riser, adjustable butt pad
  root.add(stock(M, [
    { z: 0.21, y: 0.0, w: 0.05, h: 0.11, r: 0.018 },
    { z: 0.35, y: -0.012, w: 0.052, h: 0.115, r: 0.02 },
    { z: 0.49, y: -0.03, w: 0.05, h: 0.12, r: 0.02 },
  ], M.polymer));
  root.add(meshOf(roundedBox(0.055, 0.12, 0.014, 0.005), M.metalDark, { pos: [0, -0.03, -0.495] }));
  root.add(pistolGrip(M, { z: -0.075, top: -0.035, len: 0.15, rake: -0.055 }, M.polymer));
  root.add(mag);
  triggerGroup(M, 0.045, -0.055).forEach((p) => root.add(p));
  return { root, mag, muzzle: V3(0, 0.025, -0.93), eject: V3(0.03, 0.045, 0.0) };
}

function buildSMG(M) {
  const root = new THREE.Group();
  const mag = bananaMag(M, { z: -0.03, y: -0.045, length: 0.17, curve: -0.02, w: 0.026, d: 0.062 });

  const body = meshOf(side([
    [0.14, -0.05], [0.15, -0.025], [0.15, 0.04], [0.05, 0.058],
    [-0.1, 0.055], [-0.14, 0.03], [-0.14, -0.03], [-0.05, -0.05],
  ], 0.05, { bevel: 0.008, segments: 2 }), M.polymer);
  root.add(body);
  // perforated barrel shroud
  root.add(meshOf(tubeAt([[0.021, 0], [0.021, -0.16], [0.018, -0.2]], 16), M.metalDark, { pos: [0, 0.02, -0.14] }));
  for (let i = 0; i < 5; i++) {
    root.add(meshOf(tubeAt([[0.0225, 0], [0.0225, 0.008]], 16), M.metal, { pos: [0, 0.02, -0.16 - i * 0.032] }));
  }
  // folding stock: two thin rods + pad
  for (const x of [-0.018, 0.018]) {
    root.add(meshOf(roundedBox(0.008, 0.008, 0.26, 0.003), M.metalDark, { pos: [x, 0.025, -0.25] }));
  }
  root.add(meshOf(roundedBox(0.05, 0.085, 0.014, 0.005), M.polymer, { pos: [0, 0.02, -0.38] }));
  root.add(pistolGrip(M, { z: -0.06, top: -0.03, len: 0.14, rake: -0.05 }, M.polymer));
  root.add(mag);
  triggerGroup(M, 0.03, -0.045, 0.9).forEach((p) => root.add(p));
  ironSights(M, -0.02, -0.32, 0.062).forEach((p) => root.add(p));
  root.add(meshOf(roundedBox(0.045, 0.012, 0.16, 0.004), M.metal, { pos: [0, 0.068, -0.03] }));
  return { root, mag, muzzle: V3(0, 0.02, -0.36), eject: V3(0.028, 0.04, 0.0) };
}

function buildShotgun(M) {
  const root = new THREE.Group();
  const body = meshOf(side([
    [0.16, -0.05], [0.17, -0.02], [0.17, 0.045], [0.02, 0.06],
    [-0.12, 0.05], [-0.16, 0.02], [-0.16, -0.04], [-0.02, -0.05],
  ], 0.05, { bevel: 0.008, segments: 2 }), M.metalDark);
  root.add(body);
  // fat barrel + tube magazine underneath
  root.add(meshOf(tubeAt([[0.019, 0], [0.0185, -0.5]], 18), M.metal, { pos: [0, 0.03, -0.18] }));
  root.add(meshOf(tubeAt([[0.014, 0], [0.014, -0.44]], 14), M.metalDark, { pos: [0, -0.005, -0.18] }));
  // pump grip with ribs
  const pump = new THREE.Mesh(loft([
    ring(0.052, 0.06, 0.02, 12).map(([x, y]) => [x, y + 0.008, -0.3]),
    ring(0.054, 0.062, 0.021, 12).map(([x, y]) => [x, y + 0.006, -0.38]),
    ring(0.05, 0.058, 0.019, 12).map(([x, y]) => [x, y + 0.004, -0.46]),
  ]), M.woodDark);
  root.add(pump);
  // stock + grip
  root.add(stock(M, [
    { z: 0.18, y: 0.0, w: 0.05, h: 0.1, r: 0.016 },
    { z: 0.32, y: -0.02, w: 0.048, h: 0.095, r: 0.015 },
    { z: 0.48, y: -0.045, w: 0.052, h: 0.11, r: 0.018 },
  ], M.wood));
  root.add(pistolGrip(M, { z: -0.08, top: -0.03, len: 0.13, rake: -0.045 }, M.woodDark));
  triggerGroup(M, 0.05, -0.05).forEach((p) => root.add(p));
  ironSights(M, -0.02, -0.52, 0.055).forEach((p) => root.add(p));
  return { root, mag: null, muzzle: V3(0, 0.03, -0.69), eject: V3(0.03, 0.045, 0.0) };
}

/* ------------------------------------------------------------------ */
/* pistols + knife                                                     */
/* ------------------------------------------------------------------ */

function buildPistol(M, variant = 'classic') {
  const root = new THREE.Group();
  const long = variant === 'ghost' || variant === 'silenced';
  const revolver = variant === 'sheriff';
  const slideLen = revolver ? 0.15 : long ? 0.19 : 0.16;

  // slide: extruded side silhouette with the classic chamfered nose
  const slide = meshOf(side([
    [slideLen, -0.022], [slideLen + 0.01, -0.012], [slideLen + 0.01, 0.008],
    [0.02, 0.018], [-0.03, 0.018], [-0.03, -0.022],
  ], 0.03, { bevel: 0.004, segments: 2 }), M.metal);
  root.add(slide);
  // frame + trigger guard + grip
  root.add(meshOf(side([
    [0.05, -0.05], [0.07, -0.03], [0.08, 0.0], [-0.03, 0.0], [-0.03, -0.05],
  ], 0.028, { bevel: 0.004 }), M.polymer));
  root.add(pistolGrip(M, { z: -0.03, top: -0.03, len: 0.115, rake: -0.028, w: 0.03, d: 0.05 }, M.polymer));
  triggerGroup(M, 0.0, -0.045, 0.85).forEach((p) => root.add(p));
  // barrel / muzzle
  root.add(meshOf(tubeAt([[0.009, 0], [0.009, -0.03]], 12), M.metalDark, { pos: [0, 0.0, -slideLen - 0.01] }));
  if (long) {
    root.add(meshOf(tubeAt([[0.019, 0], [0.019, -0.14], [0.017, -0.16]], 18), M.metalDark, { pos: [0, 0.0, -slideLen - 0.02] }));
  }
  if (revolver) {
    // cylinder with visible chambers
    root.add(meshOf(tubeAt([[0.032, 0], [0.032, 0.05]], 16).rotateX(Math.PI / 2), M.metal, { pos: [0, 0.0, -0.07] }));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      root.add(meshOf(tubeAt([[0.006, 0], [0.006, 0.052]], 8).rotateX(Math.PI / 2), M.metalDark, {
        pos: [Math.cos(a) * 0.019, Math.sin(a) * 0.019, -0.07],
      }));
    }
    root.add(meshOf(tubeAt([[0.013, 0], [0.012, -0.13]], 14), M.metal, { pos: [0, 0.0, -0.1] }));
    root.add(meshOf(roundedBox(0.02, 0.03, 0.02, 0.004), M.metalDark, { pos: [0, 0.036, 0.01] }));
  }
  // sights
  root.add(meshOf(roundedBox(0.012, 0.007, 0.008, 0.002), M.metalDark, { pos: [0, 0.021, -0.005] }));
  root.add(meshOf(roundedBox(0.006, 0.007, 0.006, 0.002), M.metal, { pos: [0, 0.021, -slideLen - 0.002] }));
  // magazine base plate
  // base plate hangs off the *bottom* of the raked grip, not under the trigger
  root.add(meshOf(roundedBox(0.032, 0.01, 0.052, 0.002), M.metalDark, { pos: [0, -0.147, -0.058] }));

  return {
    root,
    mag: null,
    muzzle: V3(0, 0, long ? -slideLen - 0.2 : -slideLen - 0.045),
    eject: V3(0.02, 0.03, 0.0),
  };
}

function buildKnife(M) {
  const root = new THREE.Group();
  // blade: profile with the clip point, bevelled with a real edge taper
  const blade = meshOf(side([
    [-0.02, -0.012], [0.12, -0.014], [0.23, 0.004], [0.28, 0.02],
    [0.23, 0.028], [0.1, 0.028], [-0.02, 0.02],
  ], 0.012, { bevel: 0.004, segments: 2 }), M.steel);
  // grind: a second, thinner wedge so the edge catches light
  const edge = meshOf(side([
    [0.0, -0.0135], [0.12, -0.0155], [0.23, 0.002], [0.26, 0.012],
    [0.23, 0.008], [0.12, -0.004], [0.0, -0.004],
  ], 0.008, { bevel: 0.0015, segments: 1 }), M.metal);
  root.add(blade, edge);
  // guard, handle, pommel, wrap rings
  root.add(meshOf(roundedBox(0.032, 0.052, 0.014, 0.006), M.metalDark, { pos: [0, 0.004, 0.028] }));
  root.add(stock(M, [
    { z: -0.04, y: 0.0, w: 0.026, h: 0.05, r: 0.01 },
    { z: -0.11, y: 0.0, w: 0.03, h: 0.055, r: 0.012 },
    { z: -0.17, y: 0.0, w: 0.028, h: 0.05, r: 0.01 },
  ], M.polymer));
  for (let i = 0; i < 5; i++) {
    root.add(meshOf(tubeAt([[0.016, 0], [0.016, -0.008]], 12), M.metalDark, {
      pos: [0, 0, 0.05 + i * 0.026],
    }));
  }
  root.add(meshOf(roundedBox(0.034, 0.052, 0.014, 0.005), M.metalDark, { pos: [0, 0, 0.178] }));
  return { root, mag: null, muzzle: V3(0, 0.01, -0.3), eject: V3(0, 0, 0) };
}

/* ------------------------------------------------------------------ */
/* entry point                                                         */
/* ------------------------------------------------------------------ */

const BUILDERS = {
  vandal: buildAK,
  phantom: buildM4,
  operator: buildAWP,
  spectre: buildSMG,
  judge: buildShotgun,
  classic: (M) => buildPistol(M, 'classic'),
  ghost: (M) => buildPistol(M, 'silenced'),
  sheriff: (M) => buildPistol(M, 'sheriff'),
  knife: buildKnife,
};

/**
 * @param {string} shape key from WEAPON_SHAPE
 * @param {object} M material palette
 * @returns {{root: THREE.Group, mag: THREE.Mesh|null, muzzle: THREE.Vector3, eject: THREE.Vector3}}
 */
export function buildGunModel(shape, M) {
  const builder = BUILDERS[shape] || BUILDERS.vandal;
  const built = builder(M);
  built.root.name = `gun-${shape}`;
  built.root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = false;
    }
  });
  return built;
}
