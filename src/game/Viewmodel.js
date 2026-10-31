import * as THREE from 'three';
import { buildWeaponModel, getWeapon } from './weapons.js';
import { AGENTS } from './agents.js';
import { glowTexture, studioEnvTexture } from '../world/Textures.js';
import { clamp, damp } from '../core/utils.js';

/**
 * First-person weapon viewmodel, rendered in its own scene on top of the world
 * so the gun never clips through walls.
 */
export class Viewmodel {
  constructor(renderer, quality = 'medium') {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(58, 1, 0.01, 12);
    this.camera.position.set(0, 0, 0);

    const hemi = new THREE.HemisphereLight(0xd8ecff, 0x40352a, 1.25);
    this.scene.add(hemi);
    const key = new THREE.DirectionalLight(0xfff0d8, 2.4);
    key.position.set(0.6, 1.2, 1.4);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x88bbff, 0.9);
    rim.position.set(-1.4, 0.2, -1.2);
    this.scene.add(rim);
    this.flashLight = new THREE.PointLight(0xffc27a, 0, 3, 2);
    this.flashLight.position.set(0.2, -0.1, -1);
    this.scene.add(this.flashLight);

    this.root = new THREE.Group();
    this.scene.add(this.root);

    this.weaponHolder = new THREE.Group();
    this.root.add(this.weaponHolder);

    this.arms = this._buildArms();
    this.root.add(this.arms);

    // muzzle flash sprite
    const flashMat = new THREE.SpriteMaterial({
      map: glowTexture('255,214,150', 0.05), blending: THREE.AdditiveBlending,
      transparent: true, opacity: 0, depthWrite: false, depthTest: false,
    });
    this.flash = new THREE.Sprite(flashMat);
    this.flash.scale.setScalar(0.5);
    this.flash.position.set(0.24, -0.2, -1.1);
    this.scene.add(this.flash);
    this.flashTime = 0;

    // pre-filtered studio env: the single biggest upgrade for weapon materials
    try {
      const envTex = studioEnvTexture();
      if (envTex && renderer && renderer.isWebGLRenderer && THREE.PMREMGenerator) {
        const pmrem = new THREE.PMREMGenerator(renderer);
        pmrem.compileEquirectangularShader();
        this.scene.environment = pmrem.fromEquirectangular(envTex).texture;
        this.scene.environmentIntensity = 0.85;
        pmrem.dispose();
      }
    } catch (err) {
      console.warn('viewmodel env skipped', err?.message || err);
    }

    this.bobPhase = 0;
    this.swayX = 0;
    this.swayY = 0;
    this.kick = 0;
    this.kickRot = 0;
    this.equipOffset = 0;
    this.adsAmount = 0;
    this.weaponId = null;
    this.agentId = 'phoenix';
    this._weaponModels = new Map();
    this.skinMap = null;

    this.setAgent('phoenix');
  }

  _buildArms() {
    const g = new THREE.Group();
    const sleeveMat = new THREE.MeshStandardMaterial({ color: 0x39424a, roughness: 0.9 });
    const gloveMat = new THREE.MeshStandardMaterial({ color: 0x1d2329, roughness: 0.8 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xc9926f, roughness: 0.85 });
    this.armMats = { sleeveMat, gloveMat, skinMat };

    // right arm (trigger hand) — from bottom right toward grip
    const rArm = new THREE.Group();
    const rSleeve = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.13, 0.55), sleeveMat);
    rSleeve.position.set(0.04, -0.02, 0.12);
    rSleeve.rotation.set(0.28, -0.18, 0);
    const rFore = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.3, 8), skinMat);
    rFore.rotation.x = Math.PI / 2.1;
    rFore.position.set(0.0, -0.02, -0.2);
    const rGlove = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.11, 0.16), gloveMat);
    rGlove.position.set(0.0, -0.01, -0.35);
    rArm.add(rSleeve, rFore, rGlove);
    rArm.position.set(0.25, -0.3, -0.25);
    rArm.rotation.set(0.18, -0.2, 0.1);

    // left arm (support hand) reaches further forward
    const lArm = new THREE.Group();
    const lSleeve = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.6), sleeveMat);
    lSleeve.position.set(-0.02, 0, 0.2);
    lSleeve.rotation.set(0.45, 0.25, 0);
    const lFore = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.26, 8), skinMat);
    lFore.rotation.x = Math.PI / 2.3;
    lFore.position.set(-0.04, -0.02, -0.16);
    const lGlove = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.15), gloveMat);
    lGlove.position.set(-0.05, -0.02, -0.3);
    lArm.add(lSleeve, lFore, lGlove);
    lArm.position.set(-0.16, -0.32, -0.3);
    lArm.rotation.set(0.1, 0.32, -0.12);

    g.add(rArm, lArm);
    this.rArm = rArm;
    this.lArm = lArm;
    return g;
  }

  setAgent(agentId) {
    this.agentId = agentId;
    const agent = AGENTS[agentId] || AGENTS.phoenix;
    if (this.armMats) {
      this.armMats.sleeveMat.color.set(agent.colors.fabric);
      this.armMats.sleeveMat.emissive = new THREE.Color(agent.colors.primary).multiplyScalar(0.12);
      this.armMats.gloveMat.color.set(agent.colors.dark);
    }
  }

  /** re-apply weapon skins (called when the player changes skin in the vault) */
  setSkinMap(skinMap) {
    this.skinMap = skinMap || null;
    if (this.weaponId) {
      const id = this.weaponId;
      this.weaponId = null;
      this.setWeapon(id);
    }
  }

  setWeapon(id) {
    if (this.weaponId === id) return;
    this.weaponId = id;
    this.weaponHolder.clear();
    const model = buildWeaponModel(id, true, this.skinMap);
    model.position.set(0, 0, 0);
    // scale long guns down a touch so they fit the frame
    const w = getWeapon(id);
    const scale = w.type === 'MELEE' ? 1.0 : w.type === 'KESKİN NİŞANCI' ? 0.86 : 0.94;
    model.scale.setScalar(scale);
    this.model = model;
    this.weaponHolder.add(model);
    this.muzzleAnchor = model.userData.muzzle;
    this.equipOffset = 0.32;
    this.isMelee = w.type === 'MELEE';

    // move the hands to the gun
    if (this.isMelee) {
      this.rArm.position.set(0.22, -0.34, -0.18);
      this.lArm.visible = false;
    } else {
      this.rArm.visible = true;
      this.lArm.visible = true;
      this.rArm.position.set(0.25, -0.3, -0.25);
      this.lArm.position.set(-0.16, -0.32, -0.3);
    }
  }

  onShoot(weapon) {
    this.kick = Math.min(2.4, this.kick + 0.65 + (weapon.recoil || 1) * 0.22);
    this.kickRot = Math.min(0.4, this.kickRot + 0.05 + (weapon.recoil || 1) * 0.012);
    this.flashTime = 0.055;
    this.flash.position.set(0.26, -0.16, -0.95);
    this.flash.material.rotation = Math.random() * Math.PI;
    this.flash.scale.setScalar(0.32 + Math.random() * 0.2 + (weapon.recoil || 1) * 0.05);
  }

  update(dt, state) {
    // state: {speed, grounded, adsTarget, reloadProgress (0..1 or -1), scoped, moveBob, mouseDX, mouseDY, crouch}
    this.bobPhase += dt * (state.speed * 1.9 + (state.speed > 0.2 ? 1.4 : 0.5));
    const bobAmp = clamp(state.speed / 5.4, 0, 1) * (state.grounded ? 1 : 0.25);
    this.adsAmount = damp(this.adsAmount, state.adsTarget || 0, 12, dt);

    this.swayX = damp(this.swayX, clamp(-(state.mouseDX || 0) * 0.0008, -0.05, 0.05), 9, dt);
    this.swayY = damp(this.swayY, clamp((state.mouseDY || 0) * 0.0006, -0.04, 0.04), 9, dt);

    this.kick = damp(this.kick, 0, 12, dt);
    this.kickRot = damp(this.kickRot, 0, 11, dt);

    let bobX = Math.sin(this.bobPhase) * 0.012 * bobAmp;
    let bobY = Math.abs(Math.cos(this.bobPhase)) * 0.012 * bobAmp;
    let breatheY = Math.sin(performance.now() * 0.0012) * 0.0035;

    const crouchDrop = state.crouch ? -0.02 : 0;

    // hip position vs ADS position
    const hip = new THREE.Vector3(0.22, -0.245 + crouchDrop, -0.46);
    const ads = new THREE.Vector3(0.0, -0.16, -0.34);
    const target = hip.clone().lerp(ads, this.adsAmount);
    target.x += bobX + this.swayX;
    target.y += bobY + breatheY + this.swayY - this.kick * 0.006;
    target.z += this.kick * 0.012;

    // reload animation
    let reloadRot = 0;
    let reloadY = 0;
    let reloadX = 0;
    if (state.reloadProgress >= 0) {
      const p = state.reloadProgress;
      const curve = Math.sin(Math.PI * clamp(p, 0, 1));
      reloadRot = curve * 0.62;
      reloadY = -curve * 0.13;
      reloadX = curve * 0.05;
    }

    // equip raise
    if (this.equipOffset > 0) {
      this.equipOffset = Math.max(0, this.equipOffset - dt * 1.6);
      target.y -= this.equipOffset * 0.5;
      reloadRot += this.equipOffset * 0.8;
    }

    // CS style "inspect": pull the gun in, roll it and show the finish
    let inspectRoll = 0;
    let inspectYaw = 0;
    let inspectPull = 0;
    if (state.inspect > 0) {
      const t = clamp(state.inspect / 1.9, 0, 1);
      const wave = Math.sin((1 - t) * Math.PI * 2);
      inspectRoll = wave * 1.15;
      inspectYaw = wave * 0.55;
      inspectPull = Math.sin((1 - t) * Math.PI) * 0.085;
      target.z += inspectPull;
      target.y += inspectPull * 0.55;
      target.x -= inspectPull * 0.4;
    }

    this.weaponHolder.position.set(target.x, target.y + reloadY, target.z + reloadX);
    this.weaponHolder.rotation.set(
      -this.kickRot + this.swayY * 1.6 + reloadX * 2,
      this.swayX * 2.2 + inspectYaw,
      reloadRot + this.swayX * 1.4 + inspectRoll
    );

    // hide gun when fully scoped with a sniper
    const hide = state.scoped && this.adsAmount > 0.7;
    this.weaponHolder.visible = !hide;
    this.arms.visible = !hide;

    // muzzle flash
    if (this.flashTime > 0) {
      this.flashTime -= dt;
      this.flash.material.opacity = Math.max(0, this.flashTime / 0.055);
      this.flashLight.intensity = 6;
      if (this.muzzleAnchor) {
        const p = new THREE.Vector3();
        this.muzzleAnchor.getWorldPosition(p);
        this.flash.position.copy(p);
      }
    } else {
      this.flash.material.opacity = 0;
      this.flashLight.intensity = 0;
    }
  }

  render(renderer, aspect) {
    this.camera.aspect = aspect;
    this.camera.fov = 58 - this.adsAmount * 8;
    this.camera.updateProjectionMatrix();
    renderer.clearDepth();
    renderer.render(this.scene, this.camera);
  }
}
