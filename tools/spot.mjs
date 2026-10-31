import { WALLS, PROPS, PLANT_SPOTS } from '../src/world/mapLayout.js';
const [x, z] = [Number(process.argv[2]), Number(process.argv[3])];
const r = Number(process.argv[4] || 2.5);
for (const [bx, bz, w, d, h, kind] of WALLS) {
  const dx = Math.max(Math.abs(x - bx) - w / 2, 0), dz = Math.max(Math.abs(z - bz) - d / 2, 0);
  if (Math.hypot(dx, dz) < r) console.log('WALL', bx, bz, w, d, h, kind, 'gap', Math.hypot(dx, dz).toFixed(2));
}
for (const [bx, bz, w, d, h, kind] of PROPS) {
  const dx = Math.max(Math.abs(x - bx) - w / 2, 0), dz = Math.max(Math.abs(z - bz) - d / 2, 0);
  if (Math.hypot(dx, dz) < r) console.log('PROP', bx, bz, w, d, h, kind, 'gap', Math.hypot(dx, dz).toFixed(2));
}
console.log('---');
