/**
 * Live 3D weapon turntable used by the skin vault.
 *
 * Renders exactly the same model the first person viewmodel uses, with the
 * equipped skin applied, so picking a skin is instantly visible instead of
 * having to start a match to find out what changed.
 */
import * as THREE from 'three';
import { buildWeaponModel } from '../game/weapons.js';

export class WeaponPreview {
  constructor(canvas) {
    this.canvas = canvas;
    this.visible = false;
    this.yaw = -0.55;
    this.pitch = 0.16;
    this.drag = null;
    this.raf = 0;
    this.weaponId = null;

    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.01, 30);
    this.camera.position.set(0, 0.5, 2.5);
    this.camera.lookAt(0, 0, 0);

    const hemi = new THREE.HemisphereLight(0xdfe9f2, 0x1a222b, 1.15);
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(1.6, 2.2, 1.8);
    const rim = new THREE.DirectionalLight(0xff5a68, 1.9);
    rim.position.set(-2.2, 0.4, -1.6);
    const fill = new THREE.DirectionalLight(0x6fd8ff, 0.9);
    fill.position.set(-0.6, -1.4, 1.2);
    this.scene.add(hemi, key, rim, fill);

    this.holder = new THREE.Group();
    this.scene.add(this.holder);
    this.model = null;

    this._onPointerDown = (e) => {
      this.drag = { x: e.clientX, yaw: this.yaw };
      canvas.setPointerCapture?.(e.pointerId);
    };
    this._onPointerMove = (e) => {
      if (!this.drag) return;
      this.yaw = this.drag.yaw + (e.clientX - this.drag.x) * 0.012;
    };
    this._onPointerUp = () => { this.drag = null; };
    canvas.addEventListener('pointerdown', this._onPointerDown);
    canvas.addEventListener('pointermove', this._onPointerMove);
    window.addEventListener('pointerup', this._onPointerUp);
  }

  /** Swap the displayed weapon / skin. */
  setWeapon(weaponId, skinMap) {
    if (!weaponId) return;
    this.weaponId = weaponId;
    if (this.model) {
      this.holder.remove(this.model);
      this.model.traverse((o) => { if (o.isMesh) o.geometry?.dispose(); });
      this.model = null;
    }
    const model = buildWeaponModel(weaponId, true, skinMap || {});
    // frame the gun: scale it to a fixed on-screen size and centre it
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const longest = Math.max(size.z, size.y, size.x) || 1;
    const k = 1.1 / longest;
    const wrap = new THREE.Group();
    model.position.sub(center);
    wrap.add(model);
    wrap.scale.setScalar(k);
    wrap.rotation.set(0, Math.PI, 0);   // muzzle to the left, stock to the right
    this.holder.add(wrap);
    this.model = wrap;
    this.fit();
  }

  fit() {
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(120, Math.round(rect.width || this.canvas.clientWidth || 320));
    const h = Math.max(120, Math.round(rect.height || this.canvas.clientHeight || 220));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  start() {
    if (this.visible) return;
    this.visible = true;
    this.fit();
    let last = performance.now();
    const loop = (now = performance.now()) => {
      if (!this.visible) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      this.update(dt);
      this.renderer.render(this.scene, this.camera);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.visible = false;
    cancelAnimationFrame(this.raf);
  }

  update(dt) {
    if (!this.drag) this.yaw += dt * 0.32;
    this.holder.rotation.y = this.yaw;
    this.holder.rotation.x = this.pitch;
  }

  dispose() {
    this.stop();
    this.canvas.removeEventListener('pointerdown', this._onPointerDown);
    this.canvas.removeEventListener('pointermove', this._onPointerMove);
    window.removeEventListener('pointerup', this._onPointerUp);
    this.renderer.dispose();
  }
}
