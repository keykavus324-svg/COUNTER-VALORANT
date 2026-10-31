/**
 * Thrown grenades.
 *
 * Counter-Strike grenades are projectiles with honest physics: they leave the
 * hand at ~18 m/s (or a slower lob), fall under gravity, bounce off walls and
 * the floor with energy loss and detonate on a fuse. That is what this module
 * implements — the ability system only needs to say "player X threw a flash at
 * point P" and the effects layer handles the rest when the fuse runs out.
 */
import * as THREE from 'three';

export const GRAVITY = 15.5;
const RADIUS = 0.11;

/** Per grenade tuning: fuse, bounce, throw speed and how it reacts to impact. */
export const GRENADE_TUNING = {
  flash: { fuse: 1.55, friction: 0.44, speed: 19, color: 0xd8d8c8, emissive: 0xfff3c0 },
  smoke: { fuse: 1.65, friction: 0.4, speed: 18, color: 0x9aa6ad, emissive: 0xdfe8ee },
  firewall: { fuse: 1.1, friction: 0.5, speed: 17, color: 0xc2552a, emissive: 0xff7a2c, impact: true },
  shock: { fuse: 1.6, friction: 0.42, speed: 19, color: 0x5c6b3f, emissive: 0x9fe8ff },
  decoy: { fuse: 1.6, friction: 0.42, speed: 18, color: 0x6d6f4a, emissive: 0x66d0ff },
};

let uidCounter = 0;

export class Grenade {
  /**
   * @param {object} opts
   * @param {THREE.Scene} opts.scene
   * @param {string} opts.type      grenade id (flash / smoke / firewall / shock)
   * @param {THREE.Vector3} opts.origin  release position (eye)
   * @param {THREE.Vector3} opts.dir     normalized throw direction
   * @param {number} [opts.power]       0..1, 1 = full power throw
   * @param {object} opts.owner         actor that threw it
   */
  constructor({ scene, type, origin, dir, power = 1, owner }) {
    this.id = ++uidCounter;
    this.scene = scene;
    this.type = type;
    this.owner = owner;
    this.team = owner?.team || null;
    this.tuning = GRENADE_TUNING[type] || GRENADE_TUNING.shock;
    this.pos = origin.clone();
    this.vel = dir.clone().multiplyScalar(this.tuning.speed * (0.55 + 0.45 * power));
    this.vel.y += 1.6 + 2.4 * power;         // a little natural arc
    this.fuse = this.tuning.fuse + (power < 0.35 ? 0.35 : 0);
    this.bounces = 0;
    this.detonated = false;
    this.dead = false;
    this.age = 0;
    this.spin = new THREE.Vector3(Math.random() * 8 - 4, Math.random() * 8 - 4, Math.random() * 8 - 4);

    const geo = new THREE.SphereGeometry(RADIUS, 10, 8);
    this.material = new THREE.MeshStandardMaterial({
      color: this.tuning.color,
      emissive: new THREE.Color(this.tuning.emissive).multiplyScalar(0.25),
      roughness: 0.55,
      metalness: 0.25,
    });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.position.copy(this.pos);
    this.mesh.castShadow = false;
    scene.add(this.mesh);

    // a soft trail dot so the throw is readable in flight
    const glowMat = new THREE.SpriteMaterial({
      map: Grenade._glowTexture(),
      color: this.tuning.emissive,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.glow = new THREE.Sprite(glowMat);
    this.glow.scale.setScalar(0.85);
    scene.add(this.glow);
  }

  static _glowTexture() {
    if (Grenade._glow) return Grenade._glow;
    try {
      const c = document.createElement('canvas');
      c.width = 64; c.height = 64;
      const ctx = c.getContext('2d');
      const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.45, 'rgba(255,255,255,0.35)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 64, 64);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      Grenade._glow = tex;
    } catch {
      Grenade._glow = null;
    }
    return Grenade._glow;
  }

  /**
   * Advance the projectile.
   * @param {number} dt
   * @param {{boxes:Array, heightAt?:(x:number,z:number)=>number}} world
   * @param {object} hooks  { onBounce(pos, speed), onDetonate(grenade) }
   */
  update(dt, world, hooks = {}) {
    if (this.dead) return;
    this.age += dt;
    this.fuse -= dt;

    const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
    const sub = dt / steps;
    for (let i = 0; i < steps; i++) {
      this.vel.y -= GRAVITY * sub;
      const nx = this.pos.x + this.vel.x * sub;
      const ny = this.pos.y + this.vel.y * sub;
      const nz = this.pos.z + this.vel.z * sub;

      // floor
      const groundY = world.heightAt ? world.heightAt(nx, nz) : 0;
      if (ny - RADIUS <= groundY) {
        this.pos.set(nx, groundY + RADIUS, nz);
        if (Math.abs(this.vel.y) > 1.2) {
          hooks.onBounce?.(this.pos.clone(), Math.abs(this.vel.y));
          this.vel.y = -this.vel.y * this.tuning.friction;
          // the impact grenade (molotov/fire bomb) bursts on contact
          if (this.tuning.impact && this.bounces === 0 && Math.abs(this.vel.y) > 2.2) {
            this.detonate(hooks);
            return;
          }
          this.bounces++;
        } else {
          this.vel.y = 0;
          this.vel.x *= 0.82;
          this.vel.z *= 0.82;
        }
      } else {
        this.pos.set(nx, ny, nz);
      }

      // walls: cheap axis resolution against the map's collision boxes
      if (world.boxes) {
        for (const b of world.boxes) {
          const min = b.min || b, max = b.max || b;
          if (this.pos.y > max.y || this.pos.y < min.y - 0.2) continue;
          if (this.pos.x < min.x - RADIUS || this.pos.x > max.x + RADIUS) continue;
          if (this.pos.z < min.z - RADIUS || this.pos.z > max.z + RADIUS) continue;
          // find the shallowest penetration axis and bounce along it
          const dxl = Math.abs(this.pos.x - (min.x - RADIUS));
          const dxr = Math.abs((max.x + RADIUS) - this.pos.x);
          const dzl = Math.abs(this.pos.z - (min.z - RADIUS));
          const dzr = Math.abs((max.z + RADIUS) - this.pos.z);
          const m = Math.min(dxl, dxr, dzl, dzr);
          if (m === dxl) { this.pos.x = min.x - RADIUS; this.vel.x = -Math.abs(this.vel.x) * this.tuning.friction; }
          else if (m === dxr) { this.pos.x = max.x + RADIUS; this.vel.x = Math.abs(this.vel.x) * this.tuning.friction; }
          else if (m === dzl) { this.pos.z = min.z - RADIUS; this.vel.z = -Math.abs(this.vel.z) * this.tuning.friction; }
          else { this.pos.z = max.z + RADIUS; this.vel.z = Math.abs(this.vel.z) * this.tuning.friction; }
          this.bounces++;
          this.vel.multiplyScalar(0.86);
          hooks.onBounce?.(this.pos.clone(), this.vel.length());
        }
      }
    }

    // roll along the ground
    if (this.pos.y - RADIUS <= (world.heightAt ? world.heightAt(this.pos.x, this.pos.z) : 0) + 0.02) {
      const damp = Math.pow(0.12, sub);
      this.vel.x *= damp;
      this.vel.z *= damp;
    }

    this.mesh.position.copy(this.pos);
    this.mesh.rotation.x += this.spin.x * dt;
    this.mesh.rotation.y += this.spin.y * dt;
    this.mesh.rotation.z += this.spin.z * dt;
    this.glow.position.copy(this.pos);
    // pulse the glow faster as the fuse burns down
    const t = Math.max(0, this.fuse);
    this.glow.material.opacity = 0.18 + 0.4 * (1 - Math.min(1, t / this.tuning.fuse));

    if (this.fuse <= 0) this.detonate(hooks);
  }

  detonate(hooks = {}) {
    if (this.detonated) return;
    this.detonated = true;
    this.dead = true;
    hooks.onDetonate?.(this);
    this.dispose();
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.scene.remove(this.mesh);
    this.scene.remove(this.glow);
    this.glow.material.dispose();
  }
}
