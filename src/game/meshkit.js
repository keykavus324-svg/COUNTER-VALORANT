/**
 * Mesh modelling toolkit.
 *
 * Everything here mirrors the operations you would use in Blender by hand:
 *
 *   extrudeProfile()  sketch a side profile → extrude → bevel the edges
 *   lathe()           revolve a profile (barrels, suppressors, scope tubes)
 *   loft()            bridge a series of cross-sections (stocks, grips, limbs)
 *   sweep()           drag a cross-section along a curved path (curved mags)
 *   roundedBox()      beveled cube for the parts that really are boxes
 *
 * The output is plain BufferGeometry, so it costs nothing at runtime and can be
 * merged/instanced exactly like the primitives it replaces. The point is that a
 * weapon is now a *shape*, not a pile of axis-aligned cuboids.
 */
import * as THREE from 'three';

const V2 = (x, y) => new THREE.Vector2(x, y);
const EPS = 1e-6;

/* ------------------------------------------------------------------ */
/* 2D helpers                                                          */
/* ------------------------------------------------------------------ */

function polygonArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

function ensureCCW(pts) {
  return polygonArea(pts) < 0 ? pts.slice().reverse() : pts;
}

/**
 * Inset (or outset, with a negative amount) a polygon by moving every vertex
 * along the angle bisector. Good enough for the chamfer rings we need.
 */
export function insetPolygon(pts, amount) {
  const out = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n];
    const cur = pts[i];
    const next = pts[(i + 1) % n];
    const e1 = V2(cur.x - prev.x, cur.y - prev.y).normalize();
    const e2 = V2(next.x - cur.x, next.y - cur.y).normalize();
    // inward normals for a CCW polygon are (-dy, dx)
    const n1 = V2(-e1.y, e1.x);
    const n2 = V2(-e2.y, e2.x);
    const bis = V2(n1.x + n2.x, n1.y + n2.y);
    if (bis.lengthSq() < EPS) { out.push(cur.clone()); continue; }
    bis.normalize();
    const cosHalf = Math.max(0.25, bis.dot(n1));
    out.push(V2(cur.x + bis.x * (amount / cosHalf), cur.y + bis.y * (amount / cosHalf)));
  }
  return out;
}

/** Ear-clipping triangulation for simple polygons (returns index triples). */
export function triangulate(pts) {
  const p = ensureCCW(pts);
  const n = p.length;
  const idx = [];
  const verts = p.map((v, i) => i);
  const area2 = (a, b, c) =>
    (b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y);
  const inside = (a, b, c, q) => {
    const d1 = area2(a, b, q);
    const d2 = area2(b, c, q);
    const d3 = area2(c, a, q);
    return (d1 >= -EPS && d2 >= -EPS && d3 >= -EPS);
  };
  let guard = 0;
  while (verts.length > 3 && guard++ < n * n * 2) {
    let clipped = false;
    for (let i = 0; i < verts.length; i++) {
      const i0 = verts[(i - 1 + verts.length) % verts.length];
      const i1 = verts[i];
      const i2 = verts[(i + 1) % verts.length];
      const a = p[i0], b = p[i1], c = p[i2];
      if (area2(a, b, c) <= EPS) continue;      // reflex / degenerate
      let ok = true;
      for (const j of verts) {
        if (j === i0 || j === i1 || j === i2) continue;
        if (inside(a, b, c, p[j])) { ok = false; break; }
      }
      if (!ok) continue;
      idx.push(i0, i1, i2);
      verts.splice(i, 1);
      clipped = true;
      break;
    }
    if (!clipped) break;                        // self-intersecting: bail out
  }
  if (verts.length === 3) idx.push(verts[0], verts[1], verts[2]);
  return idx;
}

/* ------------------------------------------------------------------ */
/* extrude + bevel                                                     */
/* ------------------------------------------------------------------ */

/**
 * Extrude a 2D side profile (in XY) along Z.
 * @param {Array<[number,number]>|THREE.Vector2[]} profile  side silhouette
 * @param {number} depth   total thickness along Z
 * @param {object} opts    { bevel = 0.004, segments = 3, center = true }
 */
export function extrudeProfile(profile, depth, { bevel = 0.004, segments = 3, center = true } = {}) {
  const pts = ensureCCW(profile.map((p) => (Array.isArray(p) ? V2(p[0], p[1]) : p.clone())));
  const b = Math.min(bevel, depth * 0.45);
  const segs = Math.max(1, segments);
  const half = depth / 2;

  // rings from the back cap to the front cap
  const rings = [];
  const pushRing = (poly, z) => rings.push({ poly, z });
  if (b > 0) {
    // back bevel: from inset cap at -half up to full outline at -half + b
    for (let s = segs; s >= 1; s--) {
      const t = (s / segs);                   // 1 → 0
      const ang = (1 - t) * Math.PI * 0.5;
      const off = b * (1 - Math.cos(ang));
      const z = -half + b * (1 - Math.sin(ang));
      pushRing(insetPolygon(pts, off), z);
    }
  }
  pushRing(pts, -half + (b > 0 ? b : 0));
  pushRing(pts, half - (b > 0 ? b : 0));
  if (b > 0) {
    for (let s = 1; s <= segs; s++) {
      const t = s / segs;
      const ang = (1 - t) * Math.PI * 0.5;
      const off = b * (1 - Math.cos(ang));
      const z = half - b * (1 - Math.sin(ang));
      pushRing(insetPolygon(pts, off), z);
    }
  }

  const n = pts.length;
  const positions = [];
  const indices = [];
  let base = 0;
  for (const ring of rings) {
    for (const v of ring.poly) {
      positions.push(v.x, v.y, ring.z);
    }
  }
  for (let r = 0; r < rings.length - 1; r++) {
    for (let i = 0; i < n; i++) {
      const a = base + r * n + i;
      const bIdx = base + r * n + ((i + 1) % n);
      const c = base + (r + 1) * n + ((i + 1) % n);
      const d = base + (r + 1) * n + i;
      indices.push(a, bIdx, c, a, c, d);
    }
  }
  // caps
  const capBack = rings[0].poly;
  const capFront = rings[rings.length - 1].poly;
  const backTri = triangulate(capBack);
  const frontTri = triangulate(capFront);
  const backBase = 0;
  const frontBase = base + (rings.length - 1) * n;
  // back faces point towards -Z: reverse winding
  for (let i = 0; i < backTri.length; i += 3) {
    indices.push(backBase + backTri[i + 2], backBase + backTri[i + 1], backBase + backTri[i]);
  }
  for (let i = 0; i < frontTri.length; i += 3) {
    indices.push(frontBase + frontTri[i], frontBase + frontTri[i + 1], frontBase + frontTri[i + 2]);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  if (!center) geo.translate(0, 0, depth / 2);
  geo.computeBoundingSphere();
  return geo;
}

/* ------------------------------------------------------------------ */
/* lathe / revolve                                                     */
/* ------------------------------------------------------------------ */

/**
 * Revolve a profile around the Y axis, then re-orient it along Z so a barrel
 * is authored as "radius vs. length" and comes out pointing forward.
 * @param {Array<[number,number]>} profile  [radius, along-axis]
 */
export function lathe(profile, segments = 16, { along = 'z', caps = true } = {}) {
  const pts = profile.map(([r, y]) => V2(Math.max(0.0001, r), y));
  const geo = new THREE.LatheGeometry(pts, segments);
  if (!caps) {
    // strip the lathe's degenerate end fans is unnecessary: LatheGeometry only
    // closes when the profile starts/ends at radius 0, which the profiles do.
  }
  if (along === 'z') geo.rotateX(Math.PI / 2);
  else if (along === 'x') geo.rotateZ(Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

/* ------------------------------------------------------------------ */
/* loft                                                                */
/* ------------------------------------------------------------------ */

/**
 * Bridge a sequence of cross-sections. Every section is a list of
 * [x, y, z] points with the same length; sections are consumed in order.
 */
export function loft(sections, { close = true, cap = true } = {}) {
  const positions = [];
  const indices = [];
  const n = sections[0].length;
  sections.forEach((sec) => {
    sec.forEach((p) => positions.push(p[0], p[1], p[2]));
  });
  for (let s = 0; s < sections.length - 1; s++) {
    const per = close ? n : n - 1;
    for (let i = 0; i < per; i++) {
      const j = (i + 1) % n;
      const a = s * n + i;
      const b = s * n + j;
      const c = (s + 1) * n + j;
      const d = (s + 1) * n + i;
      indices.push(a, b, c, a, c, d);
    }
  }
  if (cap) {
    const tri = triangulate(sections[0].map(([x, y]) => V2(x, y)));
    for (let i = 0; i < tri.length; i += 3) indices.push(tri[i + 2], tri[i + 1], tri[i]);
    const last = sections[sections.length - 1];
    const off = (sections.length - 1) * n;
    const tri2 = triangulate(last.map(([x, y]) => V2(x, y)));
    for (let i = 0; i < tri2.length; i += 3) indices.push(off + tri2[i], off + tri2[i + 1], off + tri2[i + 2]);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

/** Rounded cross-section ring, used by loft(): width, height, corner radius. */
export function ring(w, h, r = 0, steps = 12) {
  const out = [];
  const hw = w / 2;
  const hh = h / 2;
  const rr = Math.min(r, hw * 0.98, hh * 0.98);
  const corners = [
    [hw - rr, hh - rr, 0],
    [-(hw - rr), hh - rr, Math.PI / 2],
    [-(hw - rr), -(hh - rr), Math.PI],
    [hw - rr, -(hh - rr), -Math.PI / 2],
  ];
  const per = Math.max(1, Math.round(steps / 4));
  for (const [cx, cy, a0] of corners) {
    for (let i = 0; i <= per; i++) {
      const a = a0 + (i / per) * (Math.PI / 2);
      out.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* sweep                                                               */
/* ------------------------------------------------------------------ */

/**
 * Sweep a closed 2D cross-section along a 3D path using parallel transport
 * frames. This is how the curved AK magazine gets its shape.
 * @param {Array<[number,number]>} cross   cross-section in (u, v)
 * @param {THREE.Vector3[]} path           spine
 * @param {object} opts { up, scale = (t) => 1, cap = true }
 */
export function sweep(cross, path, { up = new THREE.Vector3(0, 0, 1), scale = null, cap = true } = {}) {
  const sections = [];
  let prevNormal = up.clone().normalize();
  const tangent = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const binormal = new THREE.Vector3();
  for (let i = 0; i < path.length; i++) {
    const prev = path[Math.max(0, i - 1)];
    const next = path[Math.min(path.length - 1, i + 1)];
    tangent.subVectors(next, prev).normalize();
    // parallel transport the previous normal
    normal.copy(prevNormal).sub(tangent.clone().multiplyScalar(prevNormal.dot(tangent))).normalize();
    if (normal.lengthSq() < EPS) normal.set(1, 0, 0);
    binormal.crossVectors(tangent, normal).normalize();
    prevNormal = normal.clone();
    const s = scale ? scale(i / (path.length - 1)) : 1;
    const sec = cross.map(([u, v]) => {
      const p = path[i].clone()
        .add(normal.clone().multiplyScalar(u * s))
        .add(binormal.clone().multiplyScalar(v * s));
      return [p.x, p.y, p.z];
    });
    sections.push(sec);
  }
  return loft(sections, { close: true, cap });
}

/* ------------------------------------------------------------------ */
/* beveled box                                                         */
/* ------------------------------------------------------------------ */

/** A cube with chamfered edges — the "bevel modifier" version of a box. */
export function roundedBox(w, h, d, r = 0.01) {
  const rr = Math.min(r, w * 0.45, h * 0.45, d * 0.45);
  const prof = [];
  const hw = w / 2;
  const hh = h / 2;
  const steps = 3;
  const corner = (cx, cy, a0) => {
    for (let i = 0; i <= steps; i++) {
      const a = a0 + (i / steps) * (Math.PI / 2);
      prof.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
    }
  };
  corner(hw - rr, hh - rr, 0);
  corner(-(hw - rr), hh - rr, Math.PI / 2);
  corner(-(hw - rr), -(hh - rr), Math.PI);
  corner(hw - rr, -(hh - rr), -Math.PI / 2);
  // dedupe the duplicate corner points
  const cleaned = prof.filter((p, i) => {
    const q = prof[(i + prof.length - 1) % prof.length];
    return Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-4;
  });
  return extrudeProfile(cleaned, d, { bevel: rr * 0.8, segments: 2 });
}

/* ------------------------------------------------------------------ */
/* assembly helpers                                                    */
/* ------------------------------------------------------------------ */

/** Merge geometries (positions + normals + uv) into one BufferGeometry. */
export function mergeGeometries(list) {
  const geos = list.filter(Boolean);
  if (!geos.length) return new THREE.BufferGeometry();
  const hasUV = geos.every((g) => g.attributes.uv);
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  let offset = 0;
  for (const g of geos) {
    const nonIndexed = g.index ? g : null;
    const pos = g.attributes.position;
    const nrm = g.attributes.normal;
    for (let i = 0; i < pos.count; i++) {
      positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      if (nrm) normals.push(nrm.getX(i), nrm.getY(i), nrm.getZ(i));
      else normals.push(0, 1, 0);
      if (hasUV) {
        const uv = g.attributes.uv;
        uvs.push(uv.getX(i), uv.getY(i));
      }
    }
    if (g.index) {
      for (let i = 0; i < g.index.count; i++) indices.push(offset + g.index.getX(i));
    } else if (nonIndexed) {
      // already expanded
    } else {
      for (let i = 0; i < pos.count; i++) indices.push(offset + i);
    }
    offset += pos.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  if (hasUV) out.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  out.setIndex(indices);
  out.computeBoundingSphere();
  return out;
}

/** Convenience: a mesh with transform applied to its geometry. */
export function meshOf(geo, material, { pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1] } = {}) {
  const g = geo.clone();
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(...pos),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)),
    new THREE.Vector3(...scale),
  );
  g.applyMatrix4(m);
  const mesh = new THREE.Mesh(g, material);
  mesh.castShadow = true;
  return mesh;
}

/** Bezier path helper for sweeps (curved magazines, straps, straps, slings). */
export function bezierPath(p0, p1, p2, steps = 8) {
  const out = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = p0.clone().lerp(p1, t);
    const b = p1.clone().lerp(p2, t);
    out.push(a.lerp(b, t));
  }
  return out;
}
