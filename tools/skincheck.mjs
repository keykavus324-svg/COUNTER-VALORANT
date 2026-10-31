/** Headless check that every weapon really changes when a skin is equipped. */
const gradient = { addColorStop() {} };
const makeCtx = () => {
  const t = {
    createLinearGradient: () => gradient, createRadialGradient: () => gradient,
    measureText: () => ({ width: 10 }), getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(4, w * h * 4)), width: w, height: h }),
  };
  return new Proxy(t, { get: (o, p) => (p in o ? o[p] : () => {}), set: (o, p, v) => { o[p] = v; return true; } });
};
const makeCanvas = (w = 256, h = 256) => ({ width: w, height: h, style: {}, getContext: () => makeCtx() });
globalThis.window = { innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1, addEventListener() {}, removeEventListener() {} };
globalThis.document = {
  createElement: (t) => (t === 'canvas' ? makeCanvas() : { style: {}, classList: { add() {}, remove() {} }, appendChild() {}, addEventListener() {} }),
  getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, removeEventListener() {},
  body: { classList: { add() {}, remove() {} } },
};

const THREE = await import('three');
const { buildWeaponModel } = await import('../src/game/weapons.js');
const { WEAPON_SKINS } = await import('../src/game/csgoAssets.js');
const { applySkinDecal } = await import('../src/game/skins.js');

const fakeTex = { userData: { aspect: 3.2 }, colorSpace: '', wrapS: 0, wrapT: 0, repeat: { set() {} }, clone() { return this; } };
const rows = [];
let bad = 0;
for (const id of Object.keys(WEAPON_SKINS)) {
  const base = buildWeaponModel(id, true, undefined);
  const skinned = buildWeaponModel(id, true, { [id]: WEAPON_SKINS[id][0].id });
  const colours = new Set();
  skinned.traverse((o) => { if (o.isMesh && o.material?.color) colours.add(o.material.color.getHexString()); });
  const maps = [];
  skinned.traverse((o) => { if (o.isMesh && o.material?.map) maps.push(o.material.map); });
  const baseColours = new Set();
  base.traverse((o) => { if (o.isMesh && o.material?.color) baseColours.add(o.material.color.getHexString()); });

  // Measure the bare hull BEFORE the artwork exists, then require the decal to
  // sit outside it. (Measuring afterwards would include the decal itself and
  // the assertion would be circular.)
  const s0 = skinned.scale.clone();
  skinned.scale.setScalar(1);
  skinned.updateMatrixWorld(true);
  const hull = new THREE.Box3().setFromObject(skinned);
  skinned.scale.copy(s0);
  const hullHalf = hull.getSize(new THREE.Vector3()).x / 2;

  const ok = applySkinDecal(skinned, { id: 'x', name: 'AK-47 | Redline' }, { texture: fakeTex });
  let decalOk = ok;
  if (ok) {
    const art = skinned.userData.cvSkinDecal[0];
    const flank = art.children[0];
    // just proud of the hull, but not floating a hand away from it
    decalOk = ok && Math.abs(flank.position.x) >= hullHalf * 0.98
      && Math.abs(flank.position.x) <= hullHalf * 1.25 + 0.02;
  }
  const changed = maps.length > 0
    || colours.size !== baseColours.size
    || [...colours].some((c) => !baseColours.has(c));
  rows.push({ weapon: id, colourChanged: changed, paletteSwatches: colours.size, textured: maps.length, decal: ok, decalOutside: decalOk });
  if (!changed || !maps.length || !decalOk) bad++;
}
console.table(rows);
console.log(bad ? `✗ ${bad} weapon(s) still look identical` : '✓ every weapon gets palette + pattern + decal when a skin is equipped');
process.exit(bad ? 1 : 0);
