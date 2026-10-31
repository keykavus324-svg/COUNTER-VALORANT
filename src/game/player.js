import * as THREE from 'three';
import { Actor, EYE_HEIGHT, CROUCH_EYE } from './actor.js';
import { clamp, damp, angleDiff } from '../core/utils.js';
import { audio } from '../core/audio.js';

/**
 * Local player: camera, movement input, weapon handling and interaction.
 */
export class Player extends Actor {
  constructor(game, { agentId = 'phoenix', name = 'SEN' } = {}) {
    super(game, { team: 'ally', agentId, name, isPlayer: true });
    this.fovBase = 90;
    this.sensitivity = 0.45;
    this.recoilPitch = 0;
    this.recoilYaw = 0;
    this.viewBobPhase = 0;
    this.landDip = 0;
    this.shake = 0;
    this.stepTimer = 0;
    this.adsHeld = false;
    this.scopeBlend = 0;
    this.dead = false; // set when killed
    this.lastMouseDX = 0;
    this.lastMouseDY = 0;
    this.wantJump = false;
    this.crouchHeld = false;
    this.walkHeld = false;
    this.cameraRoll = 0;
  }

  resetForRound(spawnPos) {
    super.respawn(spawnPos);
    this.pitch = 0;
    this.yaw = this.team === this.game.attackingTeam ? 0 : Math.PI;
    this.recoilPitch = 0;
    this.recoilYaw = 0;
    this.landDip = 0;
    this.shake = 0;
    this.scopeBlend = 0;
    this.adsHeld = false;
    this.ads = false;
    this.crouch = false;
    this.currentSlot = this.slots[1] ? 1 : 2;
    this.character.root.visible = false;
    this.character.setWeapon(this.slots[this.currentSlot] || 'glock', this.game?.settings?.skins);
    this.equipTimer = 0.4;
    this.syncViewmodel?.();
    this.dead = false;
  }

  /* -------------------------------------------------------------- */
  look(dx, dy, sensitivity) {
    if (!this.alive) {
      // allow limited free look while spectating
      this.yaw -= dx * sensitivity * 0.0085;
      this.pitch = clamp(this.pitch - dy * sensitivity * 0.0085, -1.45, 1.45);
      return;
    }
    const zoomScale = 1 / (1 + this.adsAmount * (this.activeWeapon?.scope ? 3.4 : 0.35));
    this.yaw -= dx * sensitivity * 0.0085 * zoomScale;
    this.pitch = clamp(this.pitch - dy * sensitivity * 0.0085 * zoomScale, -1.5, 1.5);
    this.lastMouseDX = dx;
    this.lastMouseDY = dy;
  }

  getAimDirection(target = new THREE.Vector3()) {
    const pitch = this.pitch + this.recoilPitch;
    const yaw = this.yaw + this.recoilYaw;
    target.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
    return target;
  }

  getCameraPitch() {
    return clamp(this.pitch + this.recoilPitch, -1.55, 1.55);
  }

  /* -------------------------------------------------------------- */
  update(dt, input) {
    if (!this.alive) {
      this.updateCommon(dt);
      this.recoilPitch = damp(this.recoilPitch, 0, 10, dt);
      this.recoilYaw = damp(this.recoilYaw, 0, 10, dt);
      return;
    }

    const game = this.game;

    // ---- recoil recovery ----
    this.recoilPitch = damp(this.recoilPitch, 0, 9.5, dt);
    this.recoilYaw = damp(this.recoilYaw, 0, 9.5, dt);

    // ---- ADS ----
    const canAds = !this.crouchBlocked();
    if (this.adsHeld && this.activeWeapon && this.activeWeapon.type !== 'MELEE' && this.reloadTimer <= 0) {
      this.ads = true;
    } else this.ads = false;
    this.adsAmount = damp(this.adsAmount, this.ads ? 1 : 0, 10, dt);
    if (this.activeWeapon?.scope) {
      this.scoped = this.adsAmount > 0.72;
      this.scopeBlend = this.adsAmount;
    } else {
      this.scoped = false;
      this.scopeBlend = this.adsAmount * 0.5;
    }

    // ---- movement ----
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const wish = new THREE.Vector3();
    if (input.forward) wish.add(forward);
    if (input.back) wish.sub(forward);
    if (input.right) wish.add(right);
    if (input.left) wish.sub(right);
    if (wish.lengthSq() > 0) wish.normalize();

    this.crouchHeld = input.crouch;
    this.walkHeld = input.walk;
    const crouchTarget = input.crouch && this.grounded;
    if (crouchTarget !== this.crouch) {
      this.crouch = crouchTarget;
    }

    let speed = 5.6;
    if (this.crouch) speed = 2.5;
    else if (input.walk) speed = 2.9;
    if (this.ads) speed *= 0.72;
    if (this.activeWeapon) speed *= this.activeWeapon.moveMult || 1;
    if (this.speedBoost > 0) speed *= 1.55;
    if (this.slowTimer > 0) speed *= 0.5;
    if (this.stunned > 0) speed *= 0.7;

    if (this.crouch) {
      // crouch-walking is slower but much more accurate
      speed = Math.min(speed, 2.5);
    }

    this.wantJump = input.jump;
    if (input.jump && this.grounded && this.equipTimer <= 0) {
      game.tryJump(this);
      input.jump = false;
    }

    game.applyMovement(this, wish, speed, dt, { crouch: this.crouch });

    // ---- footsteps ----
    const hspeed = Math.hypot(this.vel.x, this.vel.z);
    if (this.grounded && hspeed > 1.4) {
      this.stepTimer -= dt * (hspeed / 5.6);
      if (this.stepTimer <= 0) {
        this.stepTimer = this.walkHeld ? 0.72 : 0.48;
        audio.play('footstep', { volume: this.walkHeld ? 0.18 : 0.42 });
      }
    }

    // ---- weapons ----
    this.updateWeapon(dt, { firing: input.fireHeld });

    if (input.firePressed && this.activeWeapon) {
      const w = this.activeWeapon;
      if (w.type === 'MELEE' || !w.auto) this.attemptFire();
    }
    if (input.fireHeld && this.activeWeapon?.auto) this.attemptFire();

    // ---- camera effects ----
    if (this.landDip > 0) this.landDip = Math.max(0, this.landDip - dt * 3.2);
    this.shake = Math.max(0, this.shake - dt * 2.4);

    this.viewBobPhase += dt * (hspeed * 1.35 + (hspeed > 0.2 ? 1.1 : 0.4));
    this.cameraRoll = damp(this.cameraRoll, -this.vel.dot(right) * 0.006, 6, dt);

    this.updateCommon(dt);
  }

  crouchBlocked() {
    // cannot ADS while sprinting / in the air
    return !this.grounded && Math.hypot(this.vel.x, this.vel.z) > 5.6;
  }

  attemptFire() {
    if (!this.alive || this.game.phase === 'buy' || this.game.phase === 'roundEnd' || this.game.phase === 'matchEnd') return;
    if (this.game.phase === 'freeze') return;
    const w = this.activeWeapon;
    if (!w) return;
    const origin = this.game.camera.position.clone();
    const dir = this.getAimDirection(new THREE.Vector3());
    // when scoped, aim from the camera center exactly
    const fired = this.fire(origin, dir);
    if (fired && w.type !== 'MELEE') {
      this.game.viewmodel.onShoot(w);
      this.game.onPlayerShot(w);
    }
    if (fired) this.triggerHeld = true;
  }

  stopFire() {
    this.triggerHeld = false;
  }

  switchSlot(slot) {
    if (!this.alive) return;
    if (this.equipSlot(slot)) {
      this.game.ui.setWeaponName(this.activeWeapon.name);
    }
  }

  cycleSlot(dir) {
    const order = [1, 2, 3];
    let idx = order.indexOf(this.currentSlot);
    for (let i = 0; i < 3; i++) {
      idx = (idx + (dir > 0 ? 1 : order.length - 1)) % order.length;
      if (this.slots[order[idx]]) {
        this.switchSlot(order[idx]);
        return;
      }
    }
  }

  castAbility(key) {
    if (!this.alive) return;
    const ab = this.agent.abilities.find((a) => a.key === key);
    if (!ab) return;
    const game = this.game;
    let point = null;
    if (ab.cast === 'projectile' || ab.cast === 'wall' || ab.cast === 'heal' && ab.id === 'heal') {
      point = game.aimGroundPoint(38);
    }
    if (this.useAbility(ab.id, point)) {
      game.ui.flashAbility(ab.id);
    }
  }

  /** camera placement */
  updateCamera(camera, dt) {
    const bobAmp = clamp(Math.hypot(this.vel.x, this.vel.z) / 5.6, 0, 1) * (this.grounded ? 1 : 0);
    const bobY = Math.sin(this.viewBobPhase * 2) * 0.022 * bobAmp;
    const bobX = Math.cos(this.viewBobPhase) * 0.016 * bobAmp;
    const eyeY = this.alive
      ? this.pos.y + (this.crouch ? CROUCH_EYE : EYE_HEIGHT) + bobY - this.landDip * 0.09
      : this.pos.y + 1.62;

    camera.position.set(this.pos.x + bobX * 0.4, eyeY, this.pos.z);
    const shakeX = (Math.random() - 0.5) * this.shake * 0.02;
    const shakeY = (Math.random() - 0.5) * this.shake * 0.02;
    camera.rotation.set(this.getCameraPitch() + shakeY, this.yaw + this.recoilYaw + shakeX, this.cameraRoll, 'YXZ');

    let fov = this.fovBase;
    if (this.adsAmount > 0) {
      if (this.activeWeapon?.scope) {
        fov = this.fovBase * (1 - this.adsAmount * 0.72);
      } else {
        fov = this.fovBase * (1 - this.adsAmount * 0.16);
      }
    }
    camera.fov = damp(camera.fov, fov, 18, dt);
    camera.updateProjectionMatrix();
  }

  viewmodelState() {
    return {
      speed: Math.hypot(this.vel.x, this.vel.z),
      grounded: this.grounded,
      adsTarget: this.ads ? 1 : 0,
      reloadProgress: this.reloadTimer > 0 ? 1 - this.reloadTimer / this.reloadDuration : -1,
      scoped: this.scoped,
      crouch: this.crouch,
      mouseDX: this.lastMouseDX,
      mouseDY: this.lastMouseDY,
    };
  }
}
