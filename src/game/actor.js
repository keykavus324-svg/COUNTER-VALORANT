import * as THREE from 'three';
import { getWeapon, WEAPONS } from './weapons.js';
import { AGENTS } from './agents.js';
import { Character } from './characters.js';
import { clamp, rand, rayBoxes, TAU } from '../core/utils.js';
import { audio } from '../core/audio.js';

export const EYE_HEIGHT = 1.62;
export const CROUCH_EYE = 1.18;
export const ACTOR_RADIUS = 0.34;
export const ACTOR_HEIGHT = 1.82;

let uid = 0;

/**
 * Shared combatant logic: weapons, damage, abilities, hit boxes.
 * Player and Bot both extend this.
 */
export class Actor {
  constructor(game, { team = 'ally', agentId = 'blaze', name = 'AGENT', isPlayer = false }) {
    this.id = ++uid;
    this.game = game;
    this.team = team;
    this.agentId = agentId;
    this.agent = AGENTS[agentId] || AGENTS.blaze;
    this.name = name;
    this.isPlayer = isPlayer;

    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.health = 100;
    this.maxHealth = 100;
    this.armor = 0;
    this.alive = true;
    this.crouch = false;

    this.kills = 0;
    this.deaths = 0;
    this.assists = 0;
    this.damageDealt = 0;
    this.credits = 800;
    this.roundKills = 0;

    this.character = new Character({ agentId, team, name, isPlayer });
    this.character.pos.copy(this.pos);
    this.character.root.visible = !isPlayer;

    // inventory ---------------------------------------------------------
    this.slots = { 1: null, 2: 'classic', 3: 'knife' };
    this.currentSlot = 2;
    this.ammo = {};
    this.ammo.classic = { mag: WEAPONS.classic.mag, reserve: WEAPONS.classic.reserve };
    this.character.setWeapon('classic');
    this.fireCooldown = 0;
    this.reloadTimer = 0;
    this.reloadDuration = 0;
    this.equipTimer = 0;
    this.shotIndex = 0;
    this.lastShotTime = 0;
    this.ads = false;
    this.adsAmount = 0;
    this.scoped = false;
    this.triggerHeld = false;

    // abilities ---------------------------------------------------------
    this.abilityState = {};
    for (const ab of this.agent.abilities) {
      this.abilityState[ab.id] = {
        charges: 0,
        maxCharges: ab.charges,
        cooldown: 0,
        cooldownMax: ab.cooldown || 0,
        ultPoints: 0,
        bought: 0,
      };
    }
    this.ultCost = 6;
    this.shieldHp = 0;
    this.speedBoost = 0;
    this.slowTimer = 0;
    this.flashTimer = 0;
    this.revealed = 0;
    this.stunned = 0;

    this.spikeCarrier = false;
    this.stats = { plants: 0, defuses: 0 };
    this.hitBoxes = { head: null, body: null, legs: null };
    this.grounded = true;
    this.moveTarget = null;
    this.lastTargetVictim = null;
    this.lastShotAt = -99;
  }

  /* ---------------------------------------------------------------- */
  get activeWeapon() {
    const id = this.slots[this.currentSlot];
    return id ? getWeapon(id) : null;
  }

  get eyeHeight() {
    return EYE_HEIGHT - (this.crouch ? 0.42 : 0);
  }

  getEye(target = new THREE.Vector3()) {
    return target.set(this.pos.x, this.pos.y + this.eyeHeight, this.pos.z);
  }

  getMuzzlePos(target = new THREE.Vector3()) {
    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    return target
      .copy(this.pos)
      .add(new THREE.Vector3(0, this.crouch ? 1.0 : 1.32, 0))
      .addScaledVector(fwd, 0.55)
      .addScaledVector(right, 0.22);
  }

  /* ---------------------------------------------------------------- */
  /* weapons                                                           */
  /* ---------------------------------------------------------------- */
  equipSlot(slot) {
    if (!this.slots[slot] || this.currentSlot === slot || !this.alive) return false;
    this.currentSlot = slot;
    const w = getWeapon(this.slots[slot]);
    this.character.setWeapon(w.id);
    this.equipTimer = Math.min(0.55, 0.24 + (w.type === 'MELEE' ? 0 : 0.1));
    this.reloadTimer = 0;
    this.ads = false;
    this.scoped = false;
    if (this.isPlayer) audio.play('reload', { volume: 0.35 });
    return true;
  }

  giveWeapon(id) {
    const w = getWeapon(id);
    if (w.type === 'MELEE') return;
    if (w.price >= 2600 || id === 'operator' || id === 'odin') {
      this.slots[1] = id;
      this.currentSlot = 1;
    } else {
      this.slots[2] = id;
      this.currentSlot = 2;
    }
    this.ammo[id] = { mag: w.mag, reserve: w.reserve };
    this.character.setWeapon(id);
    this.equipTimer = 0.3;
    this.reloadTimer = 0;
  }

  startReload() {
    const w = this.activeWeapon;
    if (!w || w.type === 'MELEE' || this.reloadTimer > 0 || !this.alive) return false;
    const a = this.ammo[w.id];
    if (!a || a.mag >= w.mag || a.reserve <= 0) return false;
    this.reloadTimer = w.reload;
    this.reloadDuration = w.reload;
    this.reloadingWeaponId = w.id;
    if (this.isPlayer) audio.play('reload', { volume: 0.55 });
    else audio.play('reload', { pos: this.pos, volume: 0.35 });
    return true;
  }

  _completeReload() {
    const w = getWeapon(this.reloadingWeaponId || this.activeWeapon?.id);
    if (!w || !this.ammo[w.id]) return;
    const a = this.ammo[w.id];
    const need = w.mag - a.mag;
    const take = Math.min(need, a.reserve);
    a.mag += take;
    a.reserve -= take;
    if (this.isPlayer) audio.play('reload_done', { volume: 0.4 });
  }

  getSpreadFactor() {
    const w = this.activeWeapon;
    if (!w) return 1;
    const speed = Math.hypot(this.vel.x, this.vel.z);
    let factor = 1;
    factor += Math.min(speed / 5.4, 1) * 2.1;
    if (!this.grounded) factor += 2.6;
    if (this.crouch) factor *= 0.62;
    if (this.adsAmount > 0.5) factor *= 0.45;
    factor += this.shotIndex * 0.16;
    return factor;
  }

  updateWeapon(dt, { firing = false } = {}) {
    if (this.fireCooldown > 0) this.fireCooldown -= dt;
    if (this.equipTimer > 0) this.equipTimer -= dt;
    if (this.reloadTimer > 0) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.reloadTimer = 0;
        this._completeReload();
      }
    }
    if (!firing && this.shotIndex > 0) {
      this.shotIndex = Math.max(0, this.shotIndex - dt * 7);
    }
  }

  /** Fires one trigger pull (or one auto shot). Returns true when a shot happened. */
  fire(origin, dir, { ignoreCooldown = false } = {}) {
    const w = this.activeWeapon;
    if (!w || !this.alive || this.equipTimer > 0) return false;
    if (this.reloadTimer > 0) return false;
    if (!ignoreCooldown && this.fireCooldown > 0) return false;

    if (w.type === 'MELEE') {
      this.meleeAttack(origin, dir);
      this.fireCooldown = 60 / w.rpm;
      return true;
    }
    const a = this.ammo[w.id];
    if (!a) return false;
    if (a.mag <= 0) {
      if (this.isPlayer) {
        audio.play('dryfire', { volume: 0.35 });
        this.fireCooldown = 0.22;
        this.startReload();
      }
      return false;
    }

    a.mag--;
    this.fireCooldown = 60 / w.rpm;
    this.shotIndex = Math.min(14, this.shotIndex + 1);
    this.lastShotTime = performance.now() / 1000;

    const pellets = w.pellets || 1;
    const spreadBase = DEG2RAD(w.spread) * this.getSpreadFactor();
    const muzzle = this.getMuzzlePos(new THREE.Vector3());

    for (let i = 0; i < pellets; i++) {
      const d = dir.clone();
      if (spreadBase > 0) {
        const r = spreadBase * Math.sqrt(Math.random()) * (w.pellets ? 1.4 : 1);
        const theta = Math.random() * TAU;
        const up = new THREE.Vector3(0, 1, 0);
        if (Math.abs(d.y) > 0.98) up.set(0, 0, 1);
        const right = new THREE.Vector3().crossVectors(d, up).normalize();
        const up2 = new THREE.Vector3().crossVectors(right, d).normalize();
        d.addScaledVector(right, Math.cos(theta) * r).addScaledVector(up2, Math.sin(theta) * r).normalize();
      }
      this.game.resolveShot(this, origin, d, w);
    }

    // muzzle vfx + audio
    this.game.effects.muzzleFlash(muzzle, dir, this.isPlayer ? 0.8 : 1.1);
    if (w.type === 'MELEE') return true;
    const soundMap = {
      'TABANCA': 'shot_pistol', 'HAFİF MAKİNELİ': 'shot_smg', 'TÜFEK': 'shot_rifle',
      'AV TÜFEĞİ': 'shot_shotgun', 'KESKİN NİŞANCI': 'shot_sniper', 'MİNİGUN': 'shot_heavy',
    };
    audio.play(soundMap[w.type] || 'shot_rifle', {
      pos: this.isPlayer ? null : this.pos,
      volume: this.isPlayer ? 0.85 : 0.75,
      pitch: 0.98 + Math.random() * 0.05,
    });

    if (this.isPlayer) this.applyRecoil(w);
    if (a.mag === 0) this.startReload();
    return true;
  }

  applyRecoil(w) {
    const rec = w.recoil * (this.adsAmount > 0.6 ? 0.62 : 1);
    this.recoilPitch = (this.recoilPitch || 0) + rec * 0.0072;
    this.recoilYaw = (this.recoilYaw || 0) + (Math.random() - 0.5) * rec * 0.0036;
  }

  meleeAttack(origin, dir) {
    const target = this.game.findMeleeTarget(this, origin, dir, 2.4);
    this.game.effects.muzzleFlash(origin.clone().addScaledVector(dir, 0.4), dir, 0.25);
    audio.play('shot_knife', { pos: this.isPlayer ? null : this.pos, volume: 0.5 });
    if (target) {
      const back = target.pos.clone().sub(this.pos).normalize().dot(new THREE.Vector3(-Math.sin(target.yaw), 0, -Math.cos(target.yaw))) > 0.35;
      const dmg = getWeapon('knife').damage * (back ? 2.4 : 1);
      target.takeDamage(dmg, { attacker: this, weaponId: 'knife', point: target.pos.clone().add(new THREE.Vector3(0, 1.2, 0)) });
      this.game.effects.bloodHit(target.pos.clone().add(new THREE.Vector3(0, 1.2, 0)), new THREE.Vector3(0, 0.4, 0));
    }
  }

  /* ---------------------------------------------------------------- */
  /* damage                                                            */
  /* ---------------------------------------------------------------- */
  takeDamage(amount, { attacker = null, weaponId = 'classic', headshot = false, point = null } = {}) {
    if (!this.alive || this.game.phase === 'matchEnd') return;
    let dmg = amount;
    if (this.armor > 0) {
      const absorbed = Math.min(this.armor, dmg * 0.66);
      this.armor -= absorbed;
      dmg -= absorbed;
    }
    if (this.shieldHp > 0) {
      const absorbed = Math.min(this.shieldHp, dmg);
      this.shieldHp -= absorbed;
      dmg -= absorbed;
    }
    const before = this.health;
    this.health -= dmg;
    if (attacker) this.lastAttackerPos = attacker.pos.clone();
    this.character.hitFlash = 1;
    this.lastDamageTime = this.game.time;

    if (attacker) attacker.damageDealt += Math.min(before, dmg);

    if (point) {
      this.game.effects.bloodHit(point, new THREE.Vector3(rand(-1, 1), rand(-0.3, 1), rand(-1, 1)));
    }

    if (this.isPlayer) {
      this.game.ui.damageVignette(clamp(dmg / 90, 0.12, 0.85));
      this.game.ui.hitDirection?.(attacker);
      audio.play('hit', { volume: 0.5 });
    }

    // reveal the shooter briefly when damaged
    if (attacker) attacker.revealed = Math.max(attacker.revealed, 0.6);

    if (this.health <= 0) {
      this.health = 0;
      this.die(attacker, weaponId, headshot);
    }
  }

  die(attacker, weaponId, headshot) {
    if (!this.alive) return;
    this.alive = false;
    this.health = 0;
    this.character.alive = false;
    this.character.deathTime = 0;
    this.deaths++;
    if (this.isPlayer) {
      this.game.onPlayerDeath(attacker);
      audio.play('death', { volume: 0.9 });
    } else {
      audio.play('death', { pos: this.pos, volume: 0.6 });
    }
    this.game.onKill(this, attacker, weaponId, headshot);
  }

  respawn(spawnPos) {
    this.alive = true;
    this.health = this.maxHealth;
    this.pos.set(spawnPos.x, 0, spawnPos.z);
    this.vel.set(0, 0, 0);
    this.crouch = false;
    this.character.alive = true;
    this.character.deathTime = 0;
    this.character.root.rotation.x = 0;
    this.character.root.visible = !this.isPlayer;
    this.character.pos.copy(this.pos);
    this.ads = false;
    this.scoped = false;
    this.reloadTimer = 0;
    this.fireCooldown = 0;
    this.shotIndex = 0;
    this.slowTimer = 0;
    this.flashTimer = 0;
    this.stunned = 0;
    this.shieldHp = 0;
    // refill magazines
    for (const id of Object.keys(this.ammo)) {
      const w = getWeapon(id);
      this.ammo[id].mag = w.mag;
      this.ammo[id].reserve = w.reserve;
    }
  }

  /** axis aligned hit boxes used by bullet raycasts */
  updateHitBoxes() {
    const p = this.pos;
    const crouch = this.crouch ? 0.28 : 0;
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

  updateCommon(dt) {
    // decay utility state
    if (this.speedBoost > 0) this.speedBoost -= dt;
    if (this.slowTimer > 0) this.slowTimer -= dt;
    if (this.flashTimer > 0) this.flashTimer -= dt;
    if (this.stunned > 0) this.stunned -= dt;
    if (this.revealed > 0) this.revealed -= dt;

    for (const ab of this.agent.abilities) {
      const st = this.abilityState[ab.id];
      if (st.cooldown > 0) st.cooldown = Math.max(0, st.cooldown - dt);
    }

    this.character.pitch = this.pitch;
    this.character.crouch = this.crouch ? 1 : 0;
    this.character.pos.copy(this.pos);
    this.character.vel.copy(this.vel);
    this.character.yaw = this.yaw;
    this.character.health = this.health;
    this.character.revealed = this.revealed;
    this.updateHitBoxes();
  }

  /* ---------------------------------------------------------------- */
  /* abilities                                                         */
  /* ---------------------------------------------------------------- */
  abilityReady(abilityId) {
    const ab = this.agent.abilities.find((a) => a.id === abilityId);
    const st = this.abilityState[abilityId];
    if (!ab || !st) return false;
    if (ab.ultimate) return st.ultPoints >= this.ultCost;
    return st.charges > 0 && st.cooldown <= 0;
  }

  useAbility(abilityId, targetPoint = null) {
    if (!this.alive) return false;
    const ab = this.agent.abilities.find((a) => a.id === abilityId);
    const st = this.abilityState[abilityId];
    if (!ab || !st) return false;
    if (!this.abilityReady(abilityId)) {
      if (this.isPlayer) this.game.ui.toast(`<b>${ab.name}</b> hazır değil`, 1.1);
      return false;
    }
    if (ab.ultimate) st.ultPoints = 0;
    else {
      st.charges--;
      st.cooldown = st.cooldownMax;
    }
    this.game.castAbility(this, ab, targetPoint);
    audio.play(ab.ultimate ? 'ultimate' : 'ability', { pos: this.isPlayer ? null : this.pos, volume: 0.8 });
    return true;
  }

  addUltPoints(n) {
    for (const ab of this.agent.abilities) {
      if (!ab.ultimate) continue;
      const st = this.abilityState[ab.id];
      if (st) st.ultPoints = Math.min(this.ultCost, st.ultPoints + n);
    }
  }

  /** buy an ability charge during the buy phase */
  buyAbility(abilityId) {
    const ab = this.agent.abilities.find((a) => a.id === abilityId);
    const st = this.abilityState[abilityId];
    if (!ab || !st || ab.ultimate) return false;
    if (st.charges >= st.maxCharges) return false;
    const price = ab.price || 0;
    if (this.credits < price) return false;
    this.credits -= price;
    st.charges++;
    return true;
  }

  dispose() {
    this.character.dispose();
  }
}

const DEG2RAD = (d) => (d * Math.PI) / 180;
