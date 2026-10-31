import * as THREE from 'three';
import { buildWeaponModel, getWeapon } from './weapons.js';
import { AGENTS } from './agents.js';
import { glowTexture, studioEnvTexture, fabric, normalMapFrom } from '../world/Textures.js';
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

  /**
   * First-person hands. The old version was three boxes per arm, which is the
   * first thing the eye rejects in an FPS. This one is built from capsules
   * (upper arm, forearm), a rolled cuff, a glove with individual fingers and a
   * thumb, a knuckle plate and a wrist watch — still cheap, but it reads as a
   * human arm at arm's length.
   */
  _buildArms() {
    const g = new THREE.Group();
    const sleeveTex = fabric('#39434c', 5);
    const gloveTex = fabric('#1b2024', 9);
    const sleeveMat = new THREE.MeshStandardMaterial({
      map: sleeveTex || null,
      normalMap: sleeveTex ? normalMapFrom(sleeveTex.image, 0.9) : null,
      color: sleeveTex ? 0xffffff : 0x39424a,
      roughness: 0.95,
      metalness: 0.0,
    });
    const cuffMat = new THREE.MeshStandardMaterial({ color: 0x232a30, roughness: 0.85 });
    const gloveMat = new THREE.MeshStandardMaterial({
      map: gloveTex || null,
      normalMap: gloveTex ? normalMapFrom(gloveTex.image, 1.4) : null,
      color: gloveTex ? 0xffffff : 0x1d2329,
      roughness: 0.72,
      metalness: 0.04,
    });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xc08a63, roughness: 0.78, metalness: 0.0 });
    const plateMat = new THREE.MeshStandardMaterial({ color: 0x2c343b, roughness: 0.5, metalness: 0.55 });
    this.armMats = { sleeveMat, gloveMat, skinMat };

    const makeArm = (side) => {
      // side: +1 right (trigger hand), -1 left (support hand)
      const arm = new THREE.Group();

      // upper arm: capsule running back along +Z from the elbow
      const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.062, 0.26, 4, 10), sleeveMat);
      upper.rotation.x = Math.PI / 2;
      upper.position.set(0, -0.008, 0.34);
      upper.castShadow = false;
      arm.add(upper);

      // elbow pad
      const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.066, 10, 8), cuffMat);
      elbow.position.set(0, -0.004, 0.2);
      elbow.scale.set(1, 1, 1.15);
      arm.add(elbow);

      // forearm: bare skin, slightly tapered
      const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.055, 0.26, 10), skinMat);
      fore.rotation.x = Math.PI / 2;
      fore.position.set(0, 0, 0.07);
      arm.add(fore);

      // rolled-up sleeve end just past the elbow
      const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.058, 0.016, 6, 14), cuffMat);
      cuff.position.set(0, 0, 0.17);
      arm.add(cuff);

      // wrist wrap
      const wrap = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.05, 0.05, 10), gloveMat);
      wrap.rotation.x = Math.PI / 2;
      wrap.position.set(0, 0, -0.055);
      arm.add(wrap);
      if (side < 0) {
        const watch = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.028, 12), plateMat);
        watch.rotation.x = Math.PI / 2;
        watch.position.set(0, 0, -0.03);
        const face = new THREE.Mesh(
          new THREE.CircleGeometry(0.032, 12),
          new THREE.MeshStandardMaterial({ color: 0x0d1216, emissive: 0x2a6f7a, emissiveIntensity: 0.8, roughness: 0.3 }),
        );
        face.position.set(0, 0.052, -0.03);
        face.rotation.x = -Math.PI / 2;
        arm.add(watch, face);
      }

      // glove: palm, knuckle plate, fingers, thumb
      const hand = new THREE.Group();
      hand.position.set(0, -0.004, -0.13);
      const palm = new THREE.Mesh(new THREE.BoxGeometry(0.078, 0.088, 0.1), gloveMat);
      palm.position.set(0, 0, 0);
      hand.add(palm);
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.03, 0.06), plateMat);
      plate.position.set(0, 0.042, 0.01);
      hand.add(plate);
      // four fingers curling around the grip
      for (let i = 0; i < 4; i++) {
        const finger = new THREE.Mesh(new THREE.CapsuleGeometry(0.0125, 0.062, 3, 6), gloveMat);
        finger.rotation.x = Math.PI / 2.05;
        finger.rotation.z = 0.1 * side;
        finger.position.set(-0.028 + i * 0.019, 0.012 - i * 0.004, -0.062);
        hand.add(finger);
      }
      // thumb wraps the other side
      const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.015, 0.05, 3, 6), gloveMat);
      thumb.rotation.set(0.5, 0, 0.9 * side);
      thumb.position.set(0.042 * side, 0.005, -0.03);
      hand.add(thumb);

      arm.add(hand);
      arm.userData.hand = hand;
      return arm;
    };

    const rArm = makeArm(1);
    rArm.position.set(0.25, -0.3, -0.25);
    rArm.rotation.set(0.18, -0.2, 0.1);

    const lArm = makeArm(-1);
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

    // Move the hands onto the *modelled* gun: the right hand wraps the grip,
    // the left one reaches the handguard. Positions follow the real grip and
    // handguard coordinates of gunModels.js instead of a guessed offset.
    if (this.isMelee) {
      this.rArm.visible = true;
      this.lArm.visible = false;
      this.rArm.position.set(0.19, -0.34, -0.2);
      this.rArm.rotation.set(0.35, -0.5, 0.35);
    } else {
      const pistol = /glock|usp_s|p250|deagle/.test(id);
      this.rArm.visible = true;
      this.lArm.visible = true;
      if (pistol) {
        this.rArm.position.set(0.2, -0.3, -0.26);
        this.rArm.rotation.set(0.1, -0.35, 0.15);
        this.lArm.position.set(-0.06, -0.26, -0.3);
        this.lArm.rotation.set(0.35, 0.75, -0.5);
      } else {
        this.rArm.position.set(0.2, -0.3, -0.24);
        this.rArm.rotation.set(0.05, -0.42, 0.12);
        this.lArm.position.set(-0.1, -0.26, -0.52);
        this.lArm.rotation.set(0.12, 0.95, -0.22);
      }
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
