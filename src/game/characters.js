import * as THREE from 'three';
import { AGENTS } from './agents.js';
import { buildWeaponModel, getWeapon } from './weapons.js';
import { clamp, damp } from '../core/utils.js';

/**
 * Third-person agent models: low-poly tactical operators with procedural
 * walk / aim / death animation. Used for bots and for the player's avatar.
 */

/**
 * Shared geometry. Everything organic is a capsule or a sphere instead of a
 * box: boxes are what made the operators read as Lego figures. Only hard gear
 * (mag pouches, boots, weapon) stays boxy, which is correct for those parts.
 */
const capsule = (r, len, cap = 5, rad = 12) => new THREE.CapsuleGeometry(r, len, cap, rad);
const scaled = (geo, x, y, z) => { geo.scale(x, y, z); return geo; };

const sharedGeo = {
  torso: scaled(capsule(0.225, 0.32, 6, 16), 1.0, 1.0, 0.66),
  chest: scaled(capsule(0.205, 0.24, 5, 14), 1.0, 1.0, 0.78),
  hips: scaled(capsule(0.2, 0.1, 4, 12), 1.0, 1.0, 0.74),
  head: scaled(new THREE.SphereGeometry(0.115, 16, 12), 0.94, 1.12, 1.0),
  helmet: new THREE.SphereGeometry(0.126, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.52),
  helmetRim: new THREE.TorusGeometry(0.118, 0.016, 6, 20),
  mask: scaled(new THREE.SphereGeometry(0.1, 14, 10, 0, Math.PI * 2, Math.PI * 0.42, Math.PI * 0.34), 1.0, 1.0, 1.02),
  goggles: new THREE.TorusGeometry(0.088, 0.017, 6, 16),
  visor: new THREE.BoxGeometry(0.19, 0.055, 0.05),
  neck: new THREE.CylinderGeometry(0.058, 0.07, 0.1, 10),
  upperArm: capsule(0.058, 0.22, 4, 10),
  lowerArm: capsule(0.05, 0.2, 4, 10),
  hand: new THREE.BoxGeometry(0.085, 0.1, 0.095),
  thigh: capsule(0.082, 0.3, 4, 10),
  shin: capsule(0.068, 0.28, 4, 10),
  boot: new THREE.BoxGeometry(0.155, 0.115, 0.27),
  kneePad: new THREE.SphereGeometry(0.072, 10, 8),
  rig: scaled(new THREE.BoxGeometry(0.44, 0.28, 0.3), 1, 1, 1),
  pouch: new THREE.BoxGeometry(0.1, 0.12, 0.07),
  pad: scaled(new THREE.SphereGeometry(0.105, 12, 8), 1.15, 0.72, 1.0),
  pack: new THREE.BoxGeometry(0.3, 0.32, 0.16),
  strap: new THREE.BoxGeometry(0.055, 0.34, 0.02),
};

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0.08, ...opts });
}

export class Character {
  /**
   * Two-bone IK for a shoulder→elbow→hand chain.
   *
   * Hand-tuning Euler angles per weapon always ended up with the arms splayed
   * out like wings, because the pose has to satisfy a reach constraint. This
   * solves the elbow angle for a target instead, so any weapon can specify
   * where the hands go and the arms follow correctly.
   */
  _poseArm(side, target, roll = 0) {
    const arm = side > 0 ? this.armR : this.armL;
    const elbow = side > 0 ? this.elbowR : this.elbowL;
    if (!arm || !elbow) return;
    const L1 = 0.34;          // shoulder → elbow
    const L2 = 0.34;          // elbow → hand
    const shoulder = arm.position;
    const toTarget = new THREE.Vector3().subVectors(target, shoulder);
    let d = toTarget.length();
    const min = Math.abs(L1 - L2) + 0.02;
    const max = L1 + L2 - 0.01;
    d = clamp(d, min, max);
    const dir = toTarget.normalize();
    // bend plane: elbows swing outwards and down, away from the chest
    const hint = new THREE.Vector3(side * 0.85, -0.5, -0.15).normalize();
    const axis = new THREE.Vector3().crossVectors(dir, hint);
    if (axis.lengthSq() < 1e-5) axis.set(0, 1, 0);
    axis.normalize();
    const cosElbow = (L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2);
    const elbowAngle = Math.PI - Math.acos(clamp(cosElbow, -1, 1));
    // the arm group's local -Y is the limb; aim it at the target…
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
    // …then roll the whole chain so the bend points outwards
    const rollQ = new THREE.Quaternion().setFromAxisAngle(dir, roll);
    arm.quaternion.copy(rollQ.multiply(q));
    // …and bend the elbow by the solved interior angle
    elbow.rotation.set(elbowAngle, 0, 0);
    this._armIK = true;
  }

  /**
   * Solve both arms so the palms sit on the gun: right hand on the pistol grip,
   * left hand on the handguard (or supporting the pistol grip hand).
   */
  _poseHandsOnWeapon(weaponId) {
    const w = getWeapon(weaponId);
    const melee = w.type === 'MELEE';
    const pistol = w.type === 'TABANCALAR';
    const model = this.weaponModel;
    if (!model) return;
    this.root.updateWorldMatrix(true, true);
    model.updateWorldMatrix(true, true);

    // anchors in the gun's own space (see gunModels.js), scaled by the model
    const scale = model.getWorldScale(new THREE.Vector3()).x;
    const gripLocal = new THREE.Vector3(0, -0.055, -0.02);
    const foreLocal = new THREE.Vector3(0, 0.0, melee ? -0.05 : pistol ? -0.02 : -0.3);
    const toUpper = (v) => {
      const world = model.localToWorld(v.clone().multiplyScalar(scale / (model.scale.x || 1)));
      return this.upper.worldToLocal(world);
    };
    const grip = toUpper(gripLocal);
    const fore = toUpper(foreLocal);
    // supporting hand: on the handguard for long guns, cupping for pistols
    const leftTarget = pistol
      ? fore.clone().add(new THREE.Vector3(-0.055, -0.03, 0.02))
      : fore.clone().add(new THREE.Vector3(-0.03, -0.045, 0.02));

    this._poseArm(1, grip, melee ? 0.4 : 0.9);
    if (melee) {
      this.armL.visible = false;
    } else {
      this.armL.visible = true;
      this._poseArm(-1, leftTarget, -0.9);
    }
  }

  /** Where the hands should be for the current weapon, in upper-body space. */
  _handTargets(weaponId) {
    const w = getWeapon(weaponId);
    const melee = w.type === 'MELEE';
    if (melee) {
      return {
        right: new THREE.Vector3(0.1, 0.16, 0.34),
        left: new THREE.Vector3(-0.05, 0.02, 0.2),
        rollR: 0.5, rollL: -0.4,
      };
    }
    const pistol = w.type === 'TABANCALAR' || w.type === 'YAKIN DÖVÜŞ';
    if (pistol) {
      return {
        right: new THREE.Vector3(0.06, 0.16, 0.4),
        left: new THREE.Vector3(-0.04, 0.12, 0.36),
        rollR: 0.75, rollL: -0.75,
      };
    }
    return {
      right: new THREE.Vector3(0.08, 0.14, 0.3),
      left: new THREE.Vector3(-0.02, 0.18, 0.52),
      rollR: 0.85, rollL: -0.85,
    };
  }

  constructor({ agentId = 'phoenix', team = 'ally', name = 'BOT', isPlayer = false }) {
    this.agentId = agentId;
    this.agent = AGENTS[agentId] || AGENTS.phoenix;
    this.team = team;
    this.name = name;
    this.isPlayer = isPlayer;

    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.health = 100;
    this.armor = 0;
    this.alive = true;
    this.revealed = 0;
    this.walkPhase = Math.random() * 10;
    this.crouch = 0;
    this.deathTime = 0;
    this.hitFlash = 0;
    this.isBot = !isPlayer;

    this._build();

    // collision / hit boxes (world space, refreshed every frame)
    this.hitBoxes = { head: null, body: null, legs: null };
  }

  _build() {
    const c = this.agent.colors;
    const teamColor = this.team === 'ally' ? 0x35e8c0 : 0xff4655;
    this.teamColor = teamColor;

    const skin = mat(0xc9926f, { roughness: 0.85 });
    this.fabricMat = mat(new THREE.Color(c.fabric), { roughness: 0.9 });
    const primaryMat = mat(new THREE.Color(c.primary), { roughness: 0.55, metalness: 0.25 });
    const secondaryMat = mat(new THREE.Color(c.secondary), { roughness: 0.5, metalness: 0.3 });
    this.darkMat = mat(new THREE.Color(c.dark), { roughness: 0.8 });
    const gearMat = mat(0x2a3138, { roughness: 0.85 });
    this.armorMat = mat(0x3a4249, { roughness: 0.6, metalness: 0.25 });
    this.glowMat = new THREE.MeshStandardMaterial({
      color: teamColor, emissive: teamColor, emissiveIntensity: 1.6, roughness: 0.3,
    });
    this.mats = [skin, this.fabricMat, primaryMat, secondaryMat, this.darkMat, gearMat, this.armorMat];

    const root = new THREE.Group();
    // the model is authored a bit larger than the collision capsule: scale it so
    // the visible head sits inside the head hitbox (ACTOR_HEIGHT) and shots line up
    this.baseScale = 0.88;
    root.scale.setScalar(this.baseScale);
    this.root = root;

    // ---- legs ----
    const legR = new THREE.Group();
    legR.position.set(0.135, 0.88, 0);
    const thighR = new THREE.Mesh(sharedGeo.thigh, this.fabricMat);
    thighR.position.y = -0.22;
    const shinR = new THREE.Mesh(sharedGeo.shin, this.fabricMat);
    shinR.position.y = -0.62;
    const bootR = new THREE.Mesh(sharedGeo.boot, gearMat);
    bootR.position.set(0, -0.84, 0.05);
    const kneeR = new THREE.Mesh(sharedGeo.kneePad, gearMat);
    kneeR.position.set(0, -0.46, 0.05);
    kneeR.scale.set(1, 0.9, 0.75);
    legR.add(thighR, shinR, bootR, kneeR);
    const legL = legR.clone();
    legL.position.x = -0.135;
    root.add(legR, legL);
    this.legR = legR;
    this.legL = legL;

    // ---- torso ----
    const upper = new THREE.Group();
    upper.position.set(0, 0.9, 0);
    this.upper = upper;
    const hips = new THREE.Mesh(sharedGeo.hips, this.fabricMat);
    hips.position.y = 0.02;
    const torso = new THREE.Mesh(sharedGeo.torso, this.fabricMat);
    torso.position.y = 0.36;
    const chest = new THREE.Mesh(sharedGeo.chest, this.armorMat);
    chest.position.y = 0.43;
    const rig = new THREE.Mesh(sharedGeo.rig, gearMat);
    rig.position.set(0, 0.4, 0.03);
    rig.scale.set(1.02, 0.9, 0.9);
    const pack = new THREE.Mesh(sharedGeo.pack, this.darkMat);
    pack.position.set(0, 0.42, -0.23);
    // magazine pouches across the chest rig
    for (let i = 0; i < 3; i++) {
      const pouch = new THREE.Mesh(sharedGeo.pouch, gearMat);
      pouch.position.set(-0.13 + i * 0.13, 0.18, 0.15);
      pouch.rotation.x = -0.06;
      upper.add(pouch);
    }
    // sling straps over the shoulders
    for (const sx of [-1, 1]) {
      const strap = new THREE.Mesh(sharedGeo.strap, this.darkMat);
      strap.position.set(sx * 0.16, 0.42, 0.14);
      strap.rotation.set(0.12, 0, sx * 0.16);
      upper.add(strap);
    }
    const collar = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.1, 0.26), primaryMat);
    collar.position.y = 0.68;
    const teamStripe = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.24, 0.02), this.glowMat);
    teamStripe.position.set(0.12, 0.46, 0.19);
    const shoulderPadL = new THREE.Mesh(sharedGeo.pad, primaryMat);
    shoulderPadL.position.set(-0.245, 0.585, 0.005);
    shoulderPadL.rotation.z = 0.32;
    shoulderPadL.scale.set(0.86, 0.5, 0.92);
    const shoulderPadR = shoulderPadL.clone();
    shoulderPadR.position.x = 0.245;
    shoulderPadR.rotation.z = -0.32;
    upper.add(hips, torso, chest, rig, pack, collar, teamStripe, shoulderPadL, shoulderPadR);

    // ---- head ----
    const headGroup = new THREE.Group();
    headGroup.position.y = 0.86;
    this.headGroup = headGroup;
    const neck = new THREE.Mesh(sharedGeo.neck, skin);
    neck.position.y = -0.03;
    const head = new THREE.Mesh(sharedGeo.head, skin);
    head.position.y = 0.12;
    const helmet = new THREE.Mesh(sharedGeo.helmet, primaryMat);
    helmet.position.y = 0.145;
    helmet.scale.set(1.08, 1.0, 1.1);
    helmet.rotation.x = -0.12;
    const rim = new THREE.Mesh(sharedGeo.helmetRim, this.darkMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.148;
    rim.scale.set(1.02, 1.04, 1);
    headGroup.add(rim);
    // goggles sit on the helmet brim, not across the eyes
    const goggles = new THREE.Mesh(sharedGeo.goggles, this.darkMat);
    goggles.position.set(0, 0.205, 0.005);
    goggles.rotation.x = 1.42;
    goggles.scale.setScalar(0.92);
    // lower-face mask: the read that says "operator" instead of "mannequin"
    const mask = new THREE.Mesh(sharedGeo.mask, this.darkMat);
    mask.position.set(0, 0.105, -0.005);
    headGroup.add(goggles, mask);
    const visor = new THREE.Mesh(sharedGeo.visor, this.glowMat);
    visor.position.set(0, 0.13, 0.115);
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.09, 0.2), this.darkMat);
    jaw.position.set(0, 0.04, 0.02);
    headGroup.add(neck, head, helmet, visor, jaw);
    // agent accents
    if (this.agentId === 'phoenix') {
      const fin = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.2, 4), secondaryMat);
      fin.position.set(0, 0.27, -0.02);
      headGroup.add(fin);
    } else if (this.agentId === 'veil') {
      const hood = new THREE.Mesh(new THREE.SphereGeometry(0.21, 10, 8), this.fabricMat);
      hood.scale.set(1, 1.05, 1.1);
      hood.position.y = 0.14;
      const face = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.15, 0.04), this.glowMat);
      face.position.set(0, 0.12, 0.15);
      hood.add(face);
      headGroup.add(hood);
    } else if (this.agentId === 'pulse') {
      const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.28, 5), secondaryMat);
      antenna.position.set(0.12, 0.34, 0);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 6), this.glowMat);
      tip.position.set(0.12, 0.48, 0);
      headGroup.add(antenna, tip);
    } else if (this.agentId === 'oath') {
      const halo = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.016, 6, 20), secondaryMat);
      halo.rotation.x = Math.PI / 2;
      halo.position.y = 0.3;
      headGroup.add(halo);
    }
    upper.add(headGroup);

    // ---- arms ----
    const makeArm = (side) => {
      const arm = new THREE.Group();
      arm.position.set(0.255 * side, 0.6, 0.01);
      const upperArm = new THREE.Mesh(sharedGeo.upperArm, this.fabricMat);
      upperArm.position.y = -0.17;
      const elbow = new THREE.Group();
      elbow.position.y = -0.34;
      const lowerArm = new THREE.Mesh(sharedGeo.lowerArm, this.fabricMat);
      lowerArm.position.y = -0.16;
      const hand = new THREE.Mesh(sharedGeo.hand, this.darkMat);
      hand.position.y = -0.34;
      elbow.add(lowerArm, hand);
      arm.add(upperArm, elbow);
      return { arm, elbow, hand };
    };
    const R = makeArm(1);
    const L = makeArm(-1);
    this.armR = R.arm;
    this.armL = L.arm;
    this.elbowR = R.elbow;
    this.elbowL = L.elbow;
    upper.add(R.arm, L.arm);

    // ---- weapon holder ----
    const weaponMount = new THREE.Group();
    weaponMount.position.set(-0.02, 0.42, 0.26);
    weaponMount.rotation.y = Math.PI - 0.1;
    weaponMount.rotation.set(0, 0, 0);
    this.weaponMount = weaponMount;
    upper.add(weaponMount);

    // the whole upper body (torso, head, arms, weapon) hangs off the upper group
    root.add(upper);

    root.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    this.setWeapon('glock');

    // ---- name tag ----
    this._buildNameTag();
  }

  _buildNameTag() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    this.tagCanvas = canvas;
    this.tagCtx = canvas.getContext('2d');
    this.tagTexture = new THREE.CanvasTexture(canvas);
    this.tagTexture.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({
      map: this.tagTexture, transparent: true, depthTest: false, depthWrite: false, opacity: 0.95,
    });
    this.tag = new THREE.Sprite(mat);
    this.tag.scale.set(1.5, 0.375, 1);
    this.tag.position.y = 2.15;
    this.tag.renderOrder = 20;
    this.tag.visible = false;
    this.root.add(this.tag);
    this._lastTagKey = '';
    this._drawTag();
  }

  _drawTag() {
    const key = `${Math.ceil(this.health)}-${this.team}-${this.revealed > 0}`;
    if (key === this._lastTagKey) return;
    this._lastTagKey = key;
    const ctx = this.tagCtx;
    ctx.clearRect(0, 0, 256, 64);
    ctx.font = 'bold 22px Arial Narrow, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = this.team === 'ally' ? '#8ff5dd' : '#ff8b95';
    ctx.shadowColor = 'rgba(0,0,0,.9)';
    ctx.shadowBlur = 6;
    ctx.fillText(this.name.toUpperCase(), 128, 26);
    // health bar
    const w = 150;
    const h = 8;
    const x = (256 - w) / 2;
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(0,0,0,.65)';
    ctx.fillRect(x - 2, 36, w + 4, h + 4);
    ctx.fillStyle = this.team === 'ally' ? '#35e8c0' : '#ff4655';
    ctx.fillRect(x, 38, (w * clamp(this.health, 0, 100)) / 100, h);
    this.tagTexture.needsUpdate = true;
  }

  setWeapon(id, skinMap = null) {
    this.weaponId = id;
    this.skinMap = skinMap;
    if (this.weaponModel) {
      this.weaponMount.remove(this.weaponModel);
      this.weaponModel.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
    }
    const model = buildWeaponModel(id, false, skinMap);
    model.rotation.set(0, 0, 0);
    model.position.set(0, 0, 0);
    model.scale.setScalar(0.78);
    this.weaponModel = model;
    this.muzzle = model.userData.muzzle;
    this.weaponMount.add(model);
    // arms hold the gun: solve IK towards the weapon's *actual* grip and
    // handguard anchors, converted into upper-body space, so the hands always
    // land on the model no matter how the gun is authored or scaled.
    this._poseHandsOnWeapon(id);
  }

  /** world-space muzzle position */
  getMuzzleWorld(target = new THREE.Vector3()) {
    if (this.muzzle) {
      this.muzzle.getWorldPosition(target);
    } else {
      target.copy(this.pos).add(new THREE.Vector3(0, 1.4, 0));
    }
    return target;
  }

  setPosition(x, y, z) {
    this.pos.set(x, y, z);
    this.root.position.copy(this.pos);
  }

  /** update visuals; called every frame */
  update(dt, camera, game) {
    this.root.position.copy(this.pos);
    this.root.rotation.y = this.yaw;

    if (!this.alive) {
      this.deathTime += dt;
      const t = Math.min(1, this.deathTime * 2.2);
      // fall over backwards
      this.root.rotation.x = -t * Math.PI * 0.46;
      this.root.position.y = this.pos.y - t * 0.06;
      this.tag.visible = false;
      this.hitFlash = 0;
      return;
    }

    const speed = Math.hypot(this.vel.x, this.vel.z);
    this.walkPhase += dt * (3.2 + speed * 2.2);
    const swing = Math.min(1, speed / 5.2);

    const crouchTarget = this.crouch > 0 ? 1 : 0;
    this.upper.position.y = 0.9 - crouchTarget * 0.28 + Math.sin(this.walkPhase * 2) * 0.012 * swing;
    if (this.crouch > 0) {
      this.legR.rotation.x = 0.45;
      this.legL.rotation.x = -0.2;
      this.root.scale.y = this.baseScale * 0.9;
    } else {
      this.root.scale.y = this.baseScale;
      this.legR.rotation.x = Math.sin(this.walkPhase) * 0.62 * swing;
      this.legL.rotation.x = -Math.sin(this.walkPhase) * 0.62 * swing;
    }

    // a subtle sway on top of the IK pose: rotate the shoulder groups a hair
    this.armR.rotateZ(Math.sin(this.walkPhase) * 0.03 * swing);
    this.armL.rotateZ(Math.sin(this.walkPhase + 1) * 0.025 * swing);
    // aim pitch
    this.upper.rotation.x = clamp(-this.pitch * 0.55, -0.55, 0.55);

    // hit flash decay
    if (this.hitFlash > 0) {
      this.hitFlash = Math.max(0, this.hitFlash - dt * 4);
      const k = this.hitFlash;
      for (const m of this.mats) {
        if (!m.userData.baseEmissive) m.userData.baseEmissive = m.emissive ? m.emissive.getHex() : 0;
        if (m.emissive) m.emissive.setRGB(k * 0.9, k * 0.12, k * 0.12);
      }
    }

    this._drawTag();

    // tag visibility: allies always within range, enemies when revealed/close
    let show = false;
    if (camera) {
      const dist = camera.position.distanceTo(this.pos);
      if (this.team === 'ally') show = dist < 45;
      else show = this.revealed > 0 && dist < 70;
    }
    this.tag.visible = show;
    if (show) {
      this.tag.position.y = this.crouch > 0 ? 1.95 : 2.15;
    }
    if (this.revealed > 0) this.revealed -= dt;
  }

  /** refresh axis aligned hit boxes for the given world position */
  updateHitBoxes() {
    const p = this.pos;
    const crouch = this.crouch > 0 ? 0.28 : 0;
    const top = p.y + 1.9 - crouch;
    this.hitBoxes.head = {
      min: { x: p.x - 0.19, y: top - 0.34, z: p.z - 0.19 },
      max: { x: p.x + 0.19, y: top, z: p.z + 0.19 },
    };
    this.hitBoxes.body = {
      min: { x: p.x - 0.32, y: p.y + 0.82, z: p.z - 0.28 },
      max: { x: p.x + 0.32, y: top - 0.34, z: p.z + 0.28 },
    };
    this.hitBoxes.legs = {
      min: { x: p.x - 0.28, y: p.y, z: p.z - 0.24 },
      max: { x: p.x + 0.28, y: p.y + 0.82, z: p.z + 0.24 },
    };
  }

  dispose() {
    this.root.parent?.remove(this.root);
    this.root.traverse((o) => {
      if (o.isMesh) {
        if (o.geometry && !Object.values(sharedGeo).includes(o.geometry)) o.geometry.dispose();
      }
    });
    this.tagTexture.dispose();
  }
}

/** round-robin roster used to fill 5v5 teams */
export const BOT_NAMES = {
  ally: ['Ateş', 'Kılıç', 'Deniz', 'Sarp', 'Yıldız', 'Kaan', 'Mira', 'Ege'],
  enemy: ['Viper', 'Rook', 'Nyx', 'Krow', 'Jinx', 'Sable', 'Vex', 'Onyx'],
};
