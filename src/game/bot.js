import * as THREE from 'three';
import { Actor } from './actor.js';
import { getWeapon } from './weapons.js';
import { clamp, damp, rand, angleDiff, distance2D } from '../core/utils.js';
import { audio } from '../core/audio.js';

const SKILLS = {
  easy: { reaction: 0.62, turn: 3.2, error: 0.07, burst: 0.55, headBias: 0.05, strafe: 0.35, visionRange: 42 },
  normal: { reaction: 0.36, turn: 5.4, error: 0.04, burst: 0.75, headBias: 0.16, strafe: 0.6, visionRange: 52 },
  hard: { reaction: 0.24, turn: 7.6, error: 0.024, burst: 0.9, headBias: 0.34, strafe: 0.8, visionRange: 60 },
};

let botUid = 0;

export class Bot extends Actor {
  constructor(game, { team = 'enemy', agentId = 'phoenix', name = 'BOT', difficulty = 'normal' } = {}) {
    super(game, { team, agentId, name, isPlayer: false });
    this.isBot = true;
    this.skill = SKILLS[difficulty] || SKILLS.normal;
    this.difficulty = difficulty;

    this.state = 'idle';
    this.goal = null;
    this.path = null;
    this.pathIndex = 0;
    this.pathTimer = 0;
    this.repathTimer = 0;
    this.target = null;
    this.lastSeen = new THREE.Vector3();
    this.lastSeenTime = -99;
    this.reactionTimer = 0;
    this.aimJitterSeed = Math.random() * 100;
    this.strafeDir = Math.random() < 0.5 ? -1 : 1;
    this.strafeTimer = rand(0.4, 1.1);
    this.stuckTimer = 0;
    this.lastPos = new THREE.Vector3();
    this.wantMove = false;
    this.moveSpeedScale = 1;
    this.plantTimer = 0;
    this.defuseTimer = 0;
    this.jumpCooldown = 0;
    this.peekTimer = 0;
    this.holdSpot = null;
    this.abilityTimer = rand(3, 10);
    this.aimOffset = new THREE.Vector3();
    this.aimOffsetTimer = 0;
    this.aggression = rand(0.65, 1.1);
    this.lookAtPoint = null;
    this.footstepTimer = 0;
    this.crouchHold = false;
    this.deadEye = false;
    this.route = null;
    this.routeIndex = 0;
  }

  /* -------------------------------------------------------------- */
  resetForRound(spawnPos, { goal, holdSpot, carrier = false, route = null } = {}) {
    this.respawn(spawnPos);
    this.yaw = goal && goal.site ? Math.atan2(-(goal.x - spawnPos.x), -(goal.z - spawnPos.z)) : Math.PI;
    this.pitch = 0;
    this.state = 'move';
    this.path = null;
    this.pathIndex = 0;
    this.target = null;
    this.lastSeenTime = -99;
    this.reactionTimer = 0;
    this.plantTimer = 0;
    this.defuseTimer = 0;
    this.goal = goal;
    this.holdSpot = holdSpot;
    this.spikeCarrier = carrier;
    this.abilityTimer = rand(4, 14);
    this.roundKills = 0;
    this.stuckTimer = 0;
    this.lastPos.copy(this.pos);
    this.deadEye = false;
    this.route = route ? route.map((p) => ({ x: p[0], z: p[1] })) : null;
    this.routeIndex = 0;
  }

  /** advance along the hand authored lane route; returns true while following */
  followRoute(dt) {
    if (!this.route) return false;
    while (this.routeIndex < this.route.length && distance2D(this.pos, this.route[this.routeIndex]) < 2.0) {
      this.routeIndex++;
    }
    if (this.routeIndex >= this.route.length) {
      this.route = null;
      return false;
    }
    const wp = this.route[this.routeIndex];
    // hand authored lanes are straight corridors: steer directly, no re-pathing
    const dx = wp.x - this.pos.x;
    const dz = wp.z - this.pos.z;
    const d = Math.hypot(dx, dz);
    this.wantMove = true;
    this.moveSpeedScale = 1.06;
    this.moveTarget = new THREE.Vector3(wp.x, 0, wp.z);
    // route waypoint blocked by a prop -> fall back to A*
    if (this.stuckTimer > 0.3) {
      this.stuckTimer = 0;
      this.gotoPoint(wp, dt, { speed: 1.05 });
    }
    return true;
  }

  /* -------------------------------------------------------------- */
  get isEnemyOfPlayer() {
    return this.team !== this.game.player.team;
  }

  canSee(target, { ignoreFov = false, maxDist = null } = {}) {
    if (!target || !target.alive) return false;
    const eye = this.getEye(new THREE.Vector3());
    const tEye = target.getEye(new THREE.Vector3());
    const dx = tEye.x - eye.x;
    const dy = tEye.y - eye.y;
    const dz = tEye.z - eye.z;
    const dist = Math.hypot(dx, dz);
    const range = maxDist || this.skill.visionRange;
    if (dist > range) return false;
    if (!ignoreFov) {
      const forwardYaw = Math.atan2(-dx, -dz);
      const diff = Math.abs(angleDiff(this.yaw, forwardYaw));
      if (diff > 1.15 && dist > 3.5) return false;
    }
    if (this.flashTimer > 0) return false;
    return this.game.hasClearSight(eye, tEye);
  }

  /* -------------------------------------------------------------- */
  perception(dt) {
    const enemies = this.game.actors.filter((a) => a.alive && a.team !== this.team);
    let best = null;
    let bestScore = Infinity;
    for (const e of enemies) {
      if (!this.canSee(e)) continue;
      const d = distance2D(this.pos, e.pos);
      // prefer the closest visible enemy, slightly biased to the one we're aiming at
      const aimOff = Math.abs(angleDiff(this.yaw, Math.atan2(-(e.pos.x - this.pos.x), -(e.pos.z - this.pos.z))));
      const score = d + aimOff * 6;
      if (score < bestScore) {
        bestScore = score;
        best = e;
      }
    }

    if (best) {
      if (this.target !== best) {
        this.reactionTimer = this.skill.reaction * rand(0.8, 1.3);
        this.target = best;
        this.state = 'engage';
      }
      this.lastSeen.copy(best.pos);
      this.lastSeenTime = this.game.time;
      if (this.reactionTimer > 0) this.reactionTimer -= dt;
    } else {
      if (this.target && this.game.time - this.lastSeenTime > 2.6) this.target = null;
      if (this.target) this.state = 'engage'; // keep aiming at last known spot
    }

    // react to damage from unseen attackers
    if (this.lastDamageTime && this.game.time - this.lastDamageTime < 0.35 && this.state !== 'engage') {
      this.state = 'investigate';
      this.lastSeenTime = this.game.time;
      if (!this.target) {
        // look towards where the damage came from (approximated by recent attacker)
        const atk = this.game.recentAttacker(this);
        if (atk) {
          this.lastSeen.copy(atk.pos);
          this.yaw = Math.atan2(-(atk.pos.x - this.pos.x), -(atk.pos.z - this.pos.z));
        } else if (this.lastAttackerPos) {
          this.lastSeen.copy(this.lastAttackerPos);
          this.yaw = Math.atan2(-(this.lastAttackerPos.x - this.pos.x), -(this.lastAttackerPos.z - this.pos.z));
        }
      }
      this.lastDamageTime = 0;
    }
  }

  /* -------------------------------------------------------------- */
  update(dt) {
    if (!this.alive) {
      this.character.alive = false;
      this.updateCommon(dt);
      return;
    }
    if (this.game.phase === 'matchEnd') {
      this.updateCommon(dt);
      return;
    }
    if (this.game.phase === 'buy' || this.game.phase === 'roundEnd') {
      // hold position, look around, no shooting during buy / round end
      this.wantMove = false;
      this.vel.x *= 0.9;
      this.vel.z *= 0.9;
      if (this.game.phase === 'buy') this.lookAround(dt);
      this.updateWeapon(dt);
      this.game.applyMovement(this, new THREE.Vector3(), 0, dt, {});
      this.updateCommon(dt);
      return;
    }

    this.perception(dt);

    // ---------- objective / movement decisions ----------
    if (this.state === 'investigate') {
      // push towards where the shots came from
      this.gotoPoint({ x: this.lastSeen.x, z: this.lastSeen.z }, dt, { speed: 1.15 });
      if (this.game.time - this.lastSeenTime > 7) {
        this.state = 'move';
        this.path = null;
      }
    } else {
      this.objective(dt);
    }

    // ---------- combat ----------
    if (this.state === 'engage' || this.state === 'investigate') this.combat(dt);

    // ---------- weapons ----------
    this.updateWeapon(dt, { firing: this.state === 'engage' });
    if (this.activeWeapon && this.activeWeapon.type !== 'MELEE') {
      const a = this.ammo[this.activeWeapon.id];
      if (a && a.mag === 0 && this.reloadTimer <= 0) this.startReload();
    }

    // ---------- abilities ----------
    this.abilityTimer -= dt;
    if (this.abilityTimer <= 0) {
      this.abilityTimer = rand(6, 13);
      this.tryAbilities();
    }

    // ---------- physics ----------
    let wish = new THREE.Vector3();
    if (this.wantMove && this.moveTarget) {
      const dx = this.moveTarget.x - this.pos.x;
      const dz = this.moveTarget.z - this.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.35) wish.set(dx / d, 0, dz / d);
    }
    // strafing while fighting
    if (this.state === 'engage' && this.target && this.canSee(this.target) && !this.crouchHold) {
      const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
      wish.addScaledVector(right, this.strafeDir * this.skill.strafe);
    }
    // keep a little separation from teammates
    for (const a of this.game.actors) {
      if (a === this || !a.alive || a.team !== this.team) continue;
      const dx = this.pos.x - a.pos.x;
      const dz = this.pos.z - a.pos.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < 0.9 && d2 > 0.0001) {
        const d = Math.sqrt(d2);
        wish.x += (dx / d) * 0.8;
        wish.z += (dz / d) * 0.8;
      }
    }
    if (wish.lengthSq() > 1) wish.normalize();

    let speed = this.crouchHold ? 2.5 : 5.0;
    speed *= this.moveSpeedScale;
    if (this.state === 'engage') speed *= 0.82;
    if (this.slowTimer > 0) speed *= 0.5;

    this.crouch = !!this.crouchHold && this.state === 'engage' && this.grounded;
    if (this.jumpCooldown > 0) this.jumpCooldown -= dt;
    this.game.applyMovement(this, wish, speed, dt, { crouch: this.crouch });

    // stuck detection & recovery
    if (this.wantMove && this.state !== 'engage') {
      if (this.pos.distanceTo(this.lastPos) < 0.06) {
        this.stuckTimer += dt;
        if (this.stuckTimer > 0.9) {
          this.stuckTimer = 0;
          this.path = null;
          this.repathTimer = 0;
          this.jumpCooldown = 0.2;
          this.strafeDir *= -1;
        }
      } else {
        this.stuckTimer = 0;
        this.lastPos.copy(this.pos);
      }
    }

    // footsteps
    const hspeed = Math.hypot(this.vel.x, this.vel.z);
    if (hspeed > 1.2 && this.grounded) {
      this.footstepTimer -= dt * hspeed;
      if (this.footstepTimer <= 0) {
        this.footstepTimer = 3.4;
        audio.play('footstep', { pos: this.pos, volume: 0.5 });
      }
    }

    this.updateCommon(dt);
  }

  /* -------------------------------------------------------------- */
  objective(dt) {
    const game = this.game;
    const spike = game.spike;
    if (this.state === 'investigate') return;

    // spike is planted → everybody converges / defends / defuses
    if (spike.state === 'planted') {
      const defenders = this.team !== game.attackingTeam;
      if (defenders) {
        if (this.state === 'engage') return;
        const dist = distance2D(this.pos, spike.pos);
        if (dist < 1.55) {
          this.stopMoving();
          this.facePoint(spike.pos, dt, 6);
          game.botTryDefuse(this, dt);
          return;
        }
        game.botTryDefuse(this, 0); // cancel if walked away
        this.gotoPoint(spike.pos, dt, { speed: 1.15 });
      } else {
        // attackers defend the spike
        if (this.state === 'engage') return;
        if (!this.holdSpot || this.holdSpot.forSpike !== spike.pos.x + spike.pos.z) {
          const spots = game.map.postPlantSpots?.[game.spike.site] || game.map.holdSpots[game.spike.site] || [];
          const spot = spots[Math.floor(Math.random() * spots.length)];
          this.holdSpot = { x: spot.x, z: spot.z, forSpike: spike.pos.x + spike.pos.z };
        }
        this.gotoPoint(this.holdSpot, dt, { speed: 0.9, hold: true });
        if (this.state !== 'engage' && this.holdSpot && distance2D(this.pos, this.holdSpot) < 1.2) {
          this.stopMoving();
          this.lookAround(dt);
        }
      }
      return;
    }

    if (this.team === game.attackingTeam) {
      // -------- attackers --------
      if (this.state === 'engage') return;
      // follow the assigned lane until we're near the site
      if (this.route) {
        const site = game.sites[game.attackSite];
        if (distance2D(this.pos, site.center) > 14) {
          this.followRoute(dt);
          return;
        }
        this.route = null;
      }
      // escort the human carrier so the plant is actually covered
      if (!this.spikeCarrier && game.escortBot === this && game.player.alive && game.player.spikeCarrier) {
        const d = distance2D(this.pos, game.player.pos);
        if (d > 7) {
          this.gotoPoint({ x: game.player.pos.x, z: game.player.pos.z }, dt, { speed: 1.02 });
          this.lookAround(dt);
          return;
        }
        if (d > 3.2) {
          this.stopMoving();
          this.facePoint(game.player.pos, dt, 3);
          this.lookAround(dt);
          return;
        }
      }

      // dropped spike nearby? go pick it up
      if (game.spike.state === 'dropped' && !game.spike.carrier) {
        if (game.spikeRetriever === this || distance2D(this.pos, game.spike.pos) < 16) {
          this.gotoPoint({ x: game.spike.pos.x, z: game.spike.pos.z }, dt, { speed: 1.15 });
          return;
        }
      }
      if (this.spikeCarrier) {
        const site = game.sites[game.attackSite];
        const plantSpot = game.currentPlantSpot;
        const dist = distance2D(this.pos, plantSpot);
        if (dist < 1.4) {
          if (this.state === 'engage') return;
          this.stopMoving();
          this.facePoint(plantSpot, dt, 5);
          game.botTryPlant(this, dt);
          return;
        }
        this.gotoPoint(plantSpot, dt, { speed: 1.05 });
      } else {
        if (this.state === 'engage') return;
        const site = game.sites[game.attackSite];
        const targetPoint = this.holdSpot && this.holdSpot.site === game.attackSite
          ? this.holdSpot
          : game.attackPointForBot(this);
        if (targetPoint) {
          const reached = distance2D(this.pos, targetPoint) < 1.4;
          this.gotoPoint(targetPoint, dt, { speed: 1.0, hold: reached });
          if (reached) {
            this.stopMoving();
            this.lookAround(dt);
          }
        }
      }
    } else {
      // -------- defenders --------
      if (this.state === 'engage') return;
      if (!this.holdSpot) {
        this.holdSpot = game.assignHoldSpot(this);
      }
      if (this.holdSpot) {
        const reached = distance2D(this.pos, this.holdSpot) < 1.1;
        if (!reached) this.gotoPoint(this.holdSpot, dt, { speed: 1.0 });
        else {
          this.stopMoving();
          this.lookAround(dt);
          if (this.holdSpot.crouch) this.crouchHold = true;
        }
      }
    }
  }

  attackTargetPoint() {
    return this.holdSpot;
  }

  lookAround(dt) {
    // scan a cone towards the likely entry direction
    this.scanTimer = (this.scanTimer || 0) + dt;
    const base = this.holdSpot?.look
      ? Math.atan2(-this.holdSpot.look.x, -this.holdSpot.look.z)
      : Math.atan2(-(0 - this.pos.x), -(-12 - this.pos.z));
    const sweep = Math.sin(this.scanTimer * 0.55 + this.aimJitterSeed) * 0.55;
    const desired = base + sweep;
    this.yaw += angleDiff(this.yaw, desired) * Math.min(1, dt * 2.2);
    this.pitch += (Math.sin(this.scanTimer * 0.8) * 0.05 - this.pitch) * Math.min(1, dt * 2);
  }

  facePoint(point, dt, speed = 5) {
    const eye = this.getEye(new THREE.Vector3());
    const dx = point.x - eye.x;
    const dz = point.z - eye.z;
    const dy = (point.y || 0) + 1.1 - eye.y;
    const desiredYaw = Math.atan2(-dx, -dz);
    const desiredPitch = Math.asin(clamp(dy / Math.max(0.4, Math.hypot(dx, dy, dz)), -1, 1));
    this.yaw += angleDiff(this.yaw, desiredYaw) * Math.min(1, dt * speed);
    this.pitch += (desiredPitch - this.pitch) * Math.min(1, dt * speed);
  }

  stopMoving() {
    this.wantMove = false;
    this.moveTarget = null;
    this.vel.x *= 0.82;
    this.vel.z *= 0.82;
  }

  /* -------------------------------------------------------------- */
  gotoPoint(point, dt, { speed = 1, hold = false } = {}) {
    if (!point) return;
    const game = this.game;
    this.repathTimer -= dt;
    this.pathTimer -= dt;
    this.moveSpeedScale = speed;

    const straightDist = distance2D(this.pos, point);
    // straight line is fine when the corridor between us and the goal is clear
    const canGoStraight = straightDist < 1.5 || game.isWalkableSegment(this.pos, point);

    if (!this.path || this.repathTimer <= 0) {
      if (!canGoStraight) {
        const startNode = game.map.nearestNode(this.pos.x, this.pos.z);
        const endNode = game.map.nearestNode(point.x, point.z);
        const ids = game.map.findPath(startNode, endNode) || [];
        this.path = ids
          .map((i) => game.map.navNodes[i])
          .filter(Boolean)
          .map((n) => ({ x: n.x, z: n.z }));
        // always finish on the real goal, not just the closest nav node
        this.path.push({ x: point.x, z: point.z });
        this.pathIndex = 0;
        this.repathTimer = rand(2.5, 4.5);
      } else {
        this.path = null;
      }
    }

    let target = point;
    if (this.path && this.pathIndex < this.path.length) {
      // advance past waypoints we've reached (or can beeline to the next one)
      while (this.pathIndex < this.path.length - 1) {
        const node = this.path[this.pathIndex];
        const next = this.path[this.pathIndex + 1];
        if (distance2D(this.pos, node) < 1.4 || game.isWalkableSegment(this.pos, next)) this.pathIndex++;
        else break;
      }
      if (distance2D(this.pos, this.path[this.path.length - 1]) < 0.9) {
        this.path = null;
      } else {
        target = this.path[Math.min(this.pathIndex, this.path.length - 1)];
      }
    }

    if (straightDist < 1.0 && hold) {
      this.stopMoving();
      return;
    }
    this.wantMove = true;
    this.moveTarget = target;
    // auto jump over small ledges when close to the goal
    if (this.jumpCooldown <= 0 && straightDist < 3 && Math.random() < 0.02) {
      this.jumpCooldown = 1.2;
      game.tryJump(this);
    }
  }

  /* -------------------------------------------------------------- */
  combat(dt) {
    const game = this.game;
    let aimPoint = null;

    if (this.target && this.target.alive && this.canSee(this.target)) {
      this.lastSeen.copy(this.target.pos);
      this.lastSeenTime = game.time;
      const dist = distance2D(this.pos, this.target.pos);
      // aim high at distance for the head, else centre mass
      const headBias = this.skill.headBias * (dist < 30 ? 1 : 0.6);
      const targetEye = this.target.getEye(new THREE.Vector3());
      const bodyY = this.target.pos.y + (this.target.crouch ? 0.95 : 1.2);
      aimPoint = new THREE.Vector3(
        this.target.pos.x,
        bodyY + (targetEye.y - bodyY) * headBias,
        this.target.pos.z
      );
      // lead moving targets slightly
      aimPoint.x += this.target.vel.x * 0.05 * clamp(dist / 20, 0, 1);
      aimPoint.z += this.target.vel.z * 0.05 * clamp(dist / 20, 0, 1);

      // strafing decisions
      this.strafeTimer -= dt;
      if (this.strafeTimer <= 0) {
        this.strafeTimer = rand(0.35, 1.0);
        this.strafeDir *= Math.random() < 0.7 ? -1 : 1;
        this.crouchHold = dist > 14 && Math.random() < 0.25;
      }
      // back off when too close with a sniper
      if (this.activeWeapon?.scope && dist < 8) {
        const back = new THREE.Vector3(this.pos.x - this.target.pos.x, 0, this.pos.z - this.target.pos.z).normalize();
        this.moveTarget = new THREE.Vector3(this.pos.x + back.x * 3, 0, this.pos.z + back.z * 3);
        this.wantMove = true;
      }
    } else if (game.time - this.lastSeenTime < 4.5) {
      aimPoint = new THREE.Vector3(this.lastSeen.x, this.pos.y + 1.4, this.lastSeen.z);
    }

    if (!aimPoint) {
      this.state = this.state === 'investigate' ? 'move' : this.state;
      return;
    }

    // aim smoothing towards the target with human-like error
    this.aimOffsetTimer -= dt;
    if (this.aimOffsetTimer <= 0) {
      this.aimOffsetTimer = rand(0.18, 0.45);
      const err = this.skill.error * (1 + Math.hypot(this.vel.x, this.vel.z) * 0.09);
      this.aimOffset.set(rand(-err, err), rand(-err * 0.7, err * 0.7), rand(-err, err));
    }

    const eye = this.getEye(new THREE.Vector3());
    const jittered = aimPoint.clone().add(this.aimOffset);
    const dx = jittered.x - eye.x;
    const dy = jittered.y - eye.y;
    const dz = jittered.z - eye.z;
    const desiredYaw = Math.atan2(-dx, -dz);
    const desiredPitch = Math.atan2(dy, Math.hypot(dx, dz));

    const turnSpeed = this.skill.turn * (this.state === 'investigate' ? 0.7 : 1);
    this.yaw += angleDiff(this.yaw, desiredYaw) * Math.min(1, dt * turnSpeed);
    this.pitch += (desiredPitch - this.pitch) * Math.min(1, dt * turnSpeed);

    // fire when roughly on target
    const aimErrorNow = Math.abs(angleDiff(this.yaw, desiredYaw));
    const visible = this.target && this.target.alive && this.canSee(this.target);
    if (visible && this.reactionTimer <= 0 && aimErrorNow < 0.12 && this.equipTimer <= 0) {
      const w = this.activeWeapon;
      if (w && w.type !== 'MELEE') {
        const a = this.ammo[w.id];
        if (a && a.mag > 0 && this.reloadTimer <= 0) {
          const dir = new THREE.Vector3(
            -Math.sin(this.yaw) * Math.cos(this.pitch),
            Math.sin(this.pitch),
            -Math.cos(this.yaw) * Math.cos(this.pitch)
          );
          // burst discipline: pause between bursts with automatic weapons
          const canShoot = !w.auto || this.burstTimer === undefined || this.burstTimer > 0;
          if (canShoot) {
            const fired = this.fire(eye, dir);
            if (fired && w.auto) {
              if (this.burstShots === undefined) this.burstShots = 0;
              this.burstShots++;
              const burstLen = 3 + Math.floor(this.skill.burst * 6);
              if (this.burstShots >= burstLen) {
                this.burstShots = 0;
                this.burstTimer = rand(0.18, 0.5) / this.skill.burst;
              }
            }
          }
        }
      }
    }
    if (this.burstTimer !== undefined) {
      this.burstTimer -= dt;
      if (this.burstTimer < -1.2) this.burstTimer = 0;
    }
  }

  /* -------------------------------------------------------------- */
  tryAbilities() {
    const game = this.game;
    const enemy = this.target;
    const agent = this.agentId;
    const has = (id) => this.abilityReady(id);

    if (agent === 'veil') {
      if (has('smoke') && (this.state === 'move' || this.state === 'idle') && Math.random() < 0.5) {
        const site = this.team === game.attackingTeam ? game.sites[game.attackSite] : null;
        const point = site
          ? new THREE.Vector3(site.center.x, 0, site.center.z)
          : new THREE.Vector3(this.pos.x + Math.sin(this.yaw) * -12, 0, this.pos.z + Math.cos(this.yaw) * -12);
        this.useAbility('smoke', point);
      } else if (has('recon') && !enemy && Math.random() < 0.25) {
        this.useAbility('recon');
      }
    } else if (agent === 'phoenix') {
      if (has('flash') && enemy && distance2D(this.pos, enemy.pos) > 6 && Math.random() < 0.5) {
        this.useAbility('flash', new THREE.Vector3(enemy.pos.x, 1.2, enemy.pos.z));
      } else if (has('firewall') && Math.random() < 0.25) {
        const p = new THREE.Vector3(
          this.pos.x - Math.sin(this.yaw) * 14,
          0,
          this.pos.z - Math.cos(this.yaw) * 14
        );
        this.useAbility('firewall', p);
      } else if (has('dash') && this.state === 'engage' && Math.random() < 0.2) {
        this.useAbility('dash');
      }
    } else if (agent === 'pulse') {
      if (has('radar') && !enemy && Math.random() < 0.55) this.useAbility('radar');
      else if (has('shock') && enemy && Math.random() < 0.4) {
        this.useAbility('shock', new THREE.Vector3(enemy.pos.x, 0, enemy.pos.z));
      } else if (has('stun') && enemy && distance2D(this.pos, enemy.pos) < 14 && Math.random() < 0.4) {
        this.useAbility('stun');
      }
    } else if (agent === 'oath') {
      if (has('heal') && this.health < 60) this.useAbility('heal');
      else if (has('shield') && Math.random() < 0.4) this.useAbility('shield');
      else if (has('barrier') && enemy && Math.random() < 0.3) this.useAbility('barrier');
    }

    // ultimates
    for (const ab of this.agent.abilities) {
      if (!ab.ultimate) continue;
      if (!this.abilityReady(ab.id)) continue;
      const st = this.abilityState[ab.id];
      if (st.ultPoints < this.ultCost) continue;
      if (Math.random() > 0.35) continue;
      if (ab.id === 'sanctuary') {
        if (this.health < 70) this.useAbility(ab.id);
      } else if (ab.id === 'inferno') {
        if (this.state === 'engage' && enemy && distance2D(this.pos, enemy.pos) < 12) this.useAbility(ab.id);
      } else if (ab.id === 'emp') {
        if (enemy || Math.random() < 0.4) this.useAbility(ab.id);
      } else if (ab.id === 'blackout') {
        this.useAbility(ab.id, new THREE.Vector3(this.pos.x + Math.sin(this.yaw) * -16, 0, this.pos.z + Math.cos(this.yaw) * -16));
      }
    }
  }

  /* -------------------------------------------------------------- */
  autoBuy(roundNumber) {
    const cred = this.credits;
    const loadout = this.agent.loadout || { primary: 'ak47', secondary: 'usp_s' };
    let primary = null;

    // Counter-Strike economy: full buy when the money is there, eco otherwise
    const roll = Math.random();
    // CS buy tiers: full buy → force buy → eco
    if (cred >= 4750 && roll < 0.18) primary = 'awp';
    else if (cred >= 3100) primary = roll < 0.5 ? loadout.primary : (Math.random() < 0.5 ? 'ak47' : 'm4a4');
    else if (cred >= 2700) primary = 'ak47';
    else if (cred >= 2000) primary = roll < 0.5 ? 'galil' : 'famas';
    else if (cred >= 1700) primary = roll < 0.5 ? 'ssg08' : 'ump45';
    else if (cred >= 1250) primary = 'mp9';
    else if (cred >= 1050) primary = 'mac10';
    else if (cred >= 700) primary = null;

    if (primary && getWeapon(primary).price <= cred) {
      this.credits -= getWeapon(primary).price;
      this.giveWeapon(primary);
    } else if (cred >= 500) {
      const sec = loadout.secondary;
      const price = getWeapon(sec).price;
      if (price <= this.credits) {
        this.credits -= price;
        this.giveWeapon(sec);
      }
    }
    // armour
    if (this.credits >= 1000 && Math.random() < 0.75) {
      this.credits -= 1000;
      this.armor = 100;
    } else if (this.credits >= 400) {
      this.credits -= 400;
      this.armor = Math.max(this.armor, 50);
    }
    // ability charges
    for (const ab of this.agent.abilities) {
      if (ab.ultimate) continue;
      const st = this.abilityState[ab.id];
      if (st.charges < st.maxCharges && (ab.price || 0) <= this.credits && Math.random() < 0.6) {
        this.credits -= ab.price;
        st.charges++;
      }
    }
    this.credits = Math.max(0, this.credits);
  }
}
