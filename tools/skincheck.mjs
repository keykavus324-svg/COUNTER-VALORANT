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
const { WEAPON_SKINS } = await import('../src/game/valoAssets.js');
const { applySkinDecal } = await import('../src/game/skins.js');

const fakeTex = { userData: { aspect: 3.2 }, colorSpace: '', wrapS: 0, wrapT: 0, repeat: { set() {} }, clone() { return this; } };
const rows = [];
let bad = 0;
for (const id of Object.keys(WEAPON_SKINS)) {
  const base = buildWeaponModel(id, true, undefined);
  const skinned = buildWeaponModel(id, true, { [id]: WEAPON_SKINS[id][0].uuid });
  const colours = new Set();
  skinned.traverse((o) => { if (o.isMesh && o.material?.color) colours.add(o.material.color.getHexString()); });
  const maps = [];
  skinned.traverse((o) => { if (o.isMesh && o.material?.map) maps.push(o.material.map); });
  const baseColours = new Set();
  base.traverse((o) => { if (o.isMesh && o.material?.color) baseColours.add(o.material.color.getHexString()); });

  // decal geometry must end up outside the receiver, not buried in it
  const ok = applySkinDecal(skinned, { uuid: 'x', name: 'Prime Vandal' }, { texture: fakeTex });
  let decalOk = ok;
  if (ok) {
    const art = skinned.userData.cvSkinDecal[0];
    // measure the hull without the viewmodel scaling
    const s0 = skinned.scale.clone();
    skinned.scale.setScalar(1);
    skinned.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(skinned);
    skinned.scale.copy(s0);
    const half = box.getSize(new THREE.Vector3()).x / 2;
    const flank = art.children[0];
    decalOk = ok && flank.position.x >= half * 0.99;
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
