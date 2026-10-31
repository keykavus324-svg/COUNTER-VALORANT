// Small math / collision / helper utilities shared by the whole game.

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (v - a) / (b - a);
export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const choice = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const chance = (p) => Math.random() < p;
export const deg = (d) => (d * Math.PI) / 180;
export const rad2deg = (r) => (r * 180) / Math.PI;
export const TAU = Math.PI * 2;

/** frame-rate independent exponential smoothing */
export function damp(current, target, lambda, dt) {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

export function moveTowards(current, target, maxDelta) {
  if (Math.abs(target - current) <= maxDelta) return target;
  return current + Math.sign(target - current) * maxDelta;
}

export function angleDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

export function fmtTime(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function seededRandom(seed = 1) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ------------------------------------------------------------------ */
/* Axis aligned bounding box helpers. Boxes are {min:{x,y,z}, max:{...}} */
/* ------------------------------------------------------------------ */

export function boxFromCenter(cx, cy, cz, w, h, d) {
  return {
    min: { x: cx - w / 2, y: cy - h / 2, z: cz - d / 2 },
    max: { x: cx + w / 2, y: cy + h / 2, z: cz + d / 2 },
  };
}

export function expandBox(box, pad) {
  return {
    min: { x: box.min.x - pad, y: box.min.y - pad, z: box.min.z - pad },
    max: { x: box.max.x + pad, y: box.max.y + pad, z: box.max.z + pad },
  };
}

export function pointInBox(p, box) {
  return (
    p.x >= box.min.x && p.x <= box.max.x &&
    p.y >= box.min.y && p.y <= box.max.y &&
    p.z >= box.min.z && p.z <= box.max.z
  );
}

/** Slab method — returns {t, normal} or null. dir must be normalised for t in metres. */
export function rayBox(origin, dir, box, maxDist = Infinity) {
  let tmin = 0;
  let tmax = maxDist;
  let normalAxis = -1;
  let normalSign = 0;

  for (const axis of ['x', 'y', 'z']) {
    const o = origin[axis];
    const d = dir[axis];
    const mn = box.min[axis];
    const mx = box.max[axis];
    if (Math.abs(d) < 1e-8) {
      if (o < mn || o > mx) return null;
    } else {
      const inv = 1 / d;
      let t1 = (mn - o) * inv;
      let t2 = (mx - o) * inv;
      let sign = -1;
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; sign = 1; }
      if (t1 > tmin) { tmin = t1; normalAxis = axis; normalSign = sign; }
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return null;
    }
  }
  if (normalAxis === -1) return null;
  const normal = { x: 0, y: 0, z: 0, ...{} };
  normal[normalAxis] = normalSign;
  return { t: tmin, normal };
}

/** Ray vs a set of boxes, returns closest hit {t, normal, box, point} */
export function rayBoxes(origin, dir, boxes, maxDist = Infinity) {
  let best = null;
  for (const box of boxes) {
    const hit = rayBox(origin, dir, box, maxDist);
    if (hit && hit.t <= maxDist && (!best || hit.t < best.t)) {
      best = { t: hit.t, normal: hit.normal, box };
    }
  }
  if (!best) return null;
  best.point = {
    x: origin.x + dir.x * best.t,
    y: origin.y + dir.y * best.t,
    z: origin.z + dir.z * best.t,
  };
  return best;
}

/** 2D segment vs AABB (XZ plane), used for line-of-sight checks. */
export function segmentBox2D(x1, z1, x2, z2, box) {
  let t0 = 0;
  let t1 = 1;
  const dx = x2 - x1;
  const dz = z2 - z1;

  if (Math.abs(dx) < 1e-9) {
    if (x1 < box.min.x || x1 > box.max.x) return false;
  } else {
    let a = (box.min.x - x1) / dx;
    let b = (box.max.x - x1) / dx;
    if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a);
    t1 = Math.min(t1, b);
    if (t0 > t1) return false;
  }
  if (Math.abs(dz) < 1e-9) {
    if (z1 < box.min.z || z1 > box.max.z) return false;
  } else {
    let a = (box.min.z - z1) / dz;
    let b = (box.max.z - z1) / dz;
    if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a);
    t1 = Math.min(t1, b);
    if (t0 > t1) return false;
  }
  return true;
}

/** Circle (player) vs AABB in XZ, resolves outward. Mutates pos. */
export function resolveCircleBoxXZ(pos, radius, box, height, baseY) {
  // only collide when vertical ranges overlap
  if (pos.y + height <= box.min.y + 0.02 || pos.y >= box.max.y - 0.02) return;
  const cx = clamp(pos.x, box.min.x, box.max.x);
  const cz = clamp(pos.z, box.min.z, box.max.z);
  const dx = pos.x - cx;
  const dz = pos.z - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= radius * radius) return;

  if (d2 > 1e-8) {
    const d = Math.sqrt(d2);
    const push = radius - d;
    pos.x += (dx / d) * push;
    pos.z += (dz / d) * push;
  } else {
    // centre inside: push out along the shallowest axis
    const left = Math.abs(pos.x - box.min.x);
    const right = Math.abs(box.max.x - pos.x);
    const back = Math.abs(pos.z - box.min.z);
    const front = Math.abs(box.max.z - pos.z);
    const m = Math.min(left, right, back, front);
    if (m === left) pos.x = box.min.x - radius;
    else if (m === right) pos.x = box.max.x + radius;
    else if (m === back) pos.z = box.min.z - radius;
    else pos.z = box.max.z + radius;
  }
}

export function formatCredits(n) {
  return n >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : `${n}`;
}

export function distance2D(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

export function lerpAngle(a, b, t) {
  return a + angleDiff(a, b) * t;
}
