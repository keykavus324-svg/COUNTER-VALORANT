import * as THREE from 'three';
import { glowTexture, smokePuffTexture, bulletHoleTexture } from '../world/Textures.js';
import { rand } from '../core/utils.js';

/**
 * All particle / VFX systems. Everything is pooled so the game keeps a steady
 * frame-rate without creating garbage every shot.
 */

const SPRITE_BLEND = THREE.AdditiveBlending;

class SpritePool {
  constructor(scene, count, texture, { blending = SPRITE_BLEND, transparent = true } = {}) {
    this.items = [];
    this.texture = texture;
    for (let i = 0; i < count; i++) {
      const mat = new THREE.SpriteMaterial({
        map: texture,
        transparent,
        blending,
        opacity: 0,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.visible = false;
      sprite.frustumCulled = false;
      scene.add(sprite);
      this.items.push({ sprite, mat, life: 0, maxLife: 1, vel: new THREE.Vector3(), gravity: 0, grow: 0, drag: 0, baseScale: 1, spin: 0 });
    }
    this.cursor = 0;
  }

  spawn({ pos, vel, life = 0.5, size = 1, grow = 0, gravity = 0, drag = 0, color = 0xffffff, opacity = 1, blending = null }) {
    const it = this.items[this.cursor];
    this.cursor = (this.cursor + 1) % this.items.length;
    it.sprite.visible = true;
    it.sprite.position.copy(pos);
    it.mat.color.setHex(color);
    it.mat.opacity = opacity;
    it.mat.rotation = Math.random() * Math.PI * 2;
    if (blending !== null) it.mat.blending = blending;
    it.baseScale = size;
    it.sprite.scale.setScalar(size);
    it.vel.copy(vel || new THREE.Vector3());
    it.gravity = gravity;
    it.grow = grow;
    it.drag = drag;
    it.life = life;
    it.maxLife = life;
    it.startOpacity = opacity;
    return it;
  }

  update(dt) {
    for (const it of this.items) {
      if (it.life <= 0) continue;
      it.life -= dt;
      if (it.life <= 0) {
        it.sprite.visible = false;
        it.mat.opacity = 0;
        continue;
      }
      const k = it.life / it.maxLife;
      it.vel.y -= it.gravity * dt;
      if (it.drag) it.vel.multiplyScalar(1 - it.drag * dt);
      it.sprite.position.addScaledVector(it.vel, dt);
      const s = it.baseScale * (1 + (1 - k) * it.grow);
      it.sprite.scale.setScalar(s);
      it.mat.opacity = it.startOpacity * Math.min(1, k * 2.2);
    }
  }
}

export class Effects {
  constructor(scene, quality = 'medium') {
    this.scene = scene;
    this.quality = quality;
    this.time = 0;
    this.zones = []; // smoke / fire / wall zones used by gameplay checks

    const sparkTex = glowTexture('255,196,110', 0.05);
    const smokeTex = smokePuffTexture();
    const redTex = glowTexture('190,20,26', 0.1);
    const whiteTex = glowTexture('255,255,255', 0.02);
    const dustTex = glowTexture('214,196,160', 0.2);

    const q = quality === 'low' ? 0.5 : quality === 'high' ? 1.4 : 1;
    this.sparks = new SpritePool(scene, Math.round(90 * q), sparkTex);
    this.smoke = new SpritePool(scene, Math.round(120 * q), smokeTex, { blending: THREE.NormalBlending });
    this.blood = new SpritePool(scene, Math.round(50 * q), redTex);
    this.glow = new SpritePool(scene, Math.round(40 * q), whiteTex);
    this.dust = new SpritePool(scene, Math.round(50 * q), dustTex);
    this.fire = new SpritePool(scene, Math.round(80 * q), sparkTex);

    this.tracers = [];
    for (let i = 0; i < 24; i++) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      const mat = new THREE.LineBasicMaterial({
        color: 0xffe2a8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const line = new THREE.Line(geo, mat);
      line.frustumCulled = false;
      line.visible = false;
      scene.add(line);
      this.tracers.push({ line, mat, geo, life: 0, maxLife: 0.09 });
    }
    this.tracerCursor = 0;

    // bullet decals
    this.holeTex = bulletHoleTexture();
    this.decals = [];
    this.decalCursor = 0;
    const maxHoles = quality === 'low' ? 50 : 110;
    for (let i = 0; i < maxHoles; i++) {
      const mat = new THREE.MeshBasicMaterial({
        map: this.holeTex, transparent: true, depthWrite: false, opacity: 0.9,
        polygonOffset: true, polygonOffsetFactor: -4,
      });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16), mat);
      m.visible = false;
      scene.add(m);
      this.decals.push(m);
    }

    // muzzle flash light (single, reused)
    this.muzzleLight = new THREE.PointLight(0xffc078, 0, 7, 2);
    scene.add(this.muzzleLight);
    this.muzzleLightLife = 0;

    this.rings = [];
    for (let i = 0; i < 6; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0x30f3c8, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const m = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48), mat);
      m.rotation.x = -Math.PI / 2;
      m.visible = false;
      scene.add(m);
      this.rings.push({ mesh: m, mat, life: 0, maxLife: 1, grow: 10, color: 0x30f3c8 });
    }
    this.ringCursor = 0;
  }

  /* -------------------------------------------------------------- */
  tracer(from, to, color = 0xffe2a8) {
    const t = this.tracers[this.tracerCursor];
    this.tracerCursor = (this.tracerCursor + 1) % this.tracers.length;
    const pos = t.geo.attributes.position.array;
    pos[0] = from.x; pos[1] = from.y; pos[2] = from.z;
    pos[3] = to.x; pos[4] = to.y; pos[5] = to.z;
    t.geo.attributes.position.needsUpdate = true;
    t.mat.color.setHex(color);
    t.mat.opacity = 0.85;
    t.life = 0.075;
    t.line.visible = true;
  }

  muzzleFlash(pos, dir, scale = 1) {
    for (let i = 0; i < 4; i++) {
      const vel = new THREE.Vector3(dir.x, dir.y, dir.z).multiplyScalar(4 + Math.random() * 8);
      vel.x += rand(-1.6, 1.6); vel.y += rand(-0.8, 1.2); vel.z += rand(-1.6, 1.6);
      this.sparks.spawn({
        pos: pos.clone().add(new THREE.Vector3(rand(-0.05, 0.05), rand(-0.05, 0.05), rand(-0.05, 0.05))),
        vel, life: rand(0.04, 0.1), size: 0.34 * scale, grow: 1.4,
        color: i % 2 ? 0xfff0c0 : 0xffa040, opacity: 1,
      });
    }
    this.glow.spawn({
      pos: pos.clone(), vel: new THREE.Vector3(), life: 0.06, size: 0.9 * scale,
      color: 0xffd090, opacity: 0.95,
    });
    this.muzzleLight.position.copy(pos);
    this.muzzleLight.intensity = 5.5 * scale;
    this.muzzleLightLife = 0.05;
  }

  impact(point, normal, material = 'concrete', scale = 1) {
    const n = new THREE.Vector3(normal.x, normal.y, normal.z).normalize();
    const sparkCount = material === 'metal' ? 9 : 5;
    for (let i = 0; i < sparkCount; i++) {
      const vel = n.clone().multiplyScalar(rand(1.5, 5));
      vel.x += rand(-2.4, 2.4); vel.y += rand(-1, 3.4); vel.z += rand(-2.4, 2.4);
      this.sparks.spawn({
        pos: point.clone(), vel, life: rand(0.12, 0.36), size: 0.09 * scale,
        gravity: 9, drag: 1.5, color: material === 'metal' ? 0xfff0b0 : 0xd8b070, opacity: 1,
      });
    }
    for (let i = 0; i < 2; i++) {
      this.dust.spawn({
        pos: point.clone().addScaledVector(n, 0.02),
        vel: n.clone().multiplyScalar(rand(0.4, 1.4)).add(new THREE.Vector3(rand(-0.4, 0.4), rand(0.2, 0.9), rand(-0.4, 0.4))),
        life: rand(0.4, 0.9), size: rand(0.2, 0.45), grow: 2.4, drag: 2.4,
        color: material === 'ground' ? 0xd9c39a : 0xbdae96, opacity: 0.3,
        blending: THREE.NormalBlending,
      });
    }
    if (material !== 'ground' && material !== 'sand') this.decal(point, n);
  }

  decal(point, normal) {
    const d = this.decals[this.decalCursor];
    this.decalCursor = (this.decalCursor + 1) % this.decals.length;
    d.position.copy(point).addScaledVector(normal, 0.012);
    const look = new THREE.Vector3().copy(point).add(normal);
    d.lookAt(look);
    d.rotateZ(Math.random() * Math.PI * 2);
    const s = rand(0.7, 1.25);
    d.scale.set(s, s, s);
    d.visible = true;
    d.material.opacity = rand(0.7, 0.95);
  }

  bloodHit(point, dir) {
    for (let i = 0; i < 7; i++) {
      const vel = new THREE.Vector3(dir.x, dir.y, dir.z).multiplyScalar(rand(0.5, 2.4));
      vel.x += rand(-1.6, 1.6); vel.y += rand(-0.4, 1.8); vel.z += rand(-1.6, 1.6);
      this.blood.spawn({
        pos: point.clone(), vel, life: rand(0.22, 0.5), size: rand(0.08, 0.2),
        gravity: 11, drag: 1.2, color: 0xb01018, opacity: 0.85, blending: THREE.NormalBlending,
      });
    }
  }

  healBurst(point) {
    for (let i = 0; i < 14; i++) {
      const vel = new THREE.Vector3(rand(-1.2, 1.2), rand(0.6, 2.4), rand(-1.2, 1.2));
      this.glow.spawn({
        pos: point.clone().add(new THREE.Vector3(rand(-0.4, 0.4), rand(0, 0.6), rand(-0.4, 0.4))),
        vel, life: rand(0.5, 1.1), size: rand(0.1, 0.22), gravity: -1.2, color: 0x5fffc0, opacity: 0.9,
      });
    }
  }

  explosion(point, scale = 1) {
    for (let i = 0; i < 26; i++) {
      const dir = new THREE.Vector3(rand(-1, 1), rand(-0.2, 1), rand(-1, 1)).normalize();
      this.fire.spawn({
        pos: point.clone(), vel: dir.multiplyScalar(rand(3, 11) * scale),
        life: rand(0.25, 0.6), size: rand(0.3, 0.9) * scale, grow: 2, gravity: 5, drag: 1.8,
        color: i % 3 ? 0xff9a3c : 0xffe08a, opacity: 1,
      });
    }
    for (let i = 0; i < 12; i++) {
      this.smoke.spawn({
        pos: point.clone().add(new THREE.Vector3(rand(-1, 1), rand(0, 1.5), rand(-1, 1))),
        vel: new THREE.Vector3(rand(-2, 2), rand(0.6, 2.4), rand(-2, 2)),
        life: rand(0.9, 1.8), size: rand(0.8, 1.7) * scale, grow: 2.4, drag: 1.2,
        color: 0x3a3a3a, opacity: 0.6, blending: THREE.NormalBlending,
      });
    }
  }

  /* -------------------------------------------------------------- */
  /** big smoke sphere; blocks vision for both players and bots */
  smokeCloud(center, radius = 4.2, life = 14) {
    const group = new THREE.Group();
    group.position.copy(center);
    this.scene.add(group);
    const sprites = [];
    const tex = smokePuffTexture();
    const count = this.quality === 'low' ? 16 : 30;
    for (let i = 0; i < count; i++) {
      const mat = new THREE.SpriteMaterial({
        map: tex, transparent: true, opacity: 0, depthWrite: false, color: 0xf2f2f2,
      });
      const s = new THREE.Sprite(mat);
      const phi = Math.random() * Math.PI * 2;
      const r = Math.pow(Math.random(), 0.6) * radius * 0.85;
      const y = rand(0.5, radius * 1.05);
      s.position.set(Math.cos(phi) * r, y, Math.sin(phi) * r);
      const sc = rand(1.8, 3.4) * (radius / 4);
      s.scale.setScalar(sc);
      group.add(s);
      sprites.push({ sprite: s, mat, phase: Math.random() * 6.28, base: sc, target: rand(0.2, 0.34) });
    }
    const zone = {
      type: 'smoke', pos: center.clone(), radius, life, maxLife: life, group,
      sprites, blocksVision: true,
    };
    this.zones.push(zone);
    return zone;
  }

  /** incendiary area — damaging fire zone */
  fireZone(center, radius = 3.6, life = 7) {
    const group = new THREE.Group();
    group.position.copy(center);
    this.scene.add(group);
    const light = new THREE.PointLight(0xff7a2a, 3.2, 14, 2);
    light.position.y = 1.2;
    group.add(light);
    const zone = {
      type: 'fire', pos: center.clone(), radius, life, maxLife: life, group, light,
      blocksVision: false, sprites: [], emitTimer: 0,
    };
    this.zones.push(zone);
    return zone;
  }

  /** flash effect visible in the world */
  flashBurst(point) {
    this.glow.spawn({ pos: point.clone(), vel: new THREE.Vector3(), life: 0.12, size: 9, color: 0xffffff, opacity: 1 });
    for (let i = 0; i < 10; i++) {
      this.glow.spawn({
        pos: point.clone(), vel: new THREE.Vector3(rand(-3, 3), rand(-1, 3), rand(-3, 3)),
        life: rand(0.15, 0.35), size: rand(0.3, 0.7), color: 0xffffff, opacity: 0.8,
      });
    }
  }

  reconRing(point, radius = 14) {
    const r = this.rings[this.ringCursor];
    this.ringCursor = (this.ringCursor + 1) % this.rings.length;
    r.mesh.position.copy(point);
    r.mesh.position.y = 0.08;
    r.mesh.scale.setScalar(0.5);
    r.mesh.visible = true;
    r.life = 1.2;
    r.maxLife = 1.2;
    r.grow = radius;
    r.mat.opacity = 0.75;
    r.mat.color.setHex(0x30f3c8);
  }

  /** agent wall / barrier ability (visual + vision blocker) */
  barrierWall(position, quaternion, width = 7, height = 3.2, life = 16) {
    const geo = new THREE.BoxGeometry(width, height, 0.35);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xff4655, emissive: 0x64101a, emissiveIntensity: 1.2,
      transparent: true, opacity: 0.82, roughness: 0.4, metalness: 0.2,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(position);
    mesh.position.y = height / 2;
    mesh.quaternion.copy(quaternion);
    this.scene.add(mesh);
    const zone = {
      type: 'wall', pos: position.clone(), radius: width / 2, life, maxLife: life, mesh, mat,
      blocksVision: true, blocksMovement: true, width, height, quaternion: quaternion.clone(),
    };
    this.zones.push(zone);
    // spawn flash
    for (let i = 0; i < 14; i++) {
      this.glow.spawn({
        pos: position.clone().add(new THREE.Vector3(rand(-width / 2, width / 2), rand(0, height), 0)),
        vel: new THREE.Vector3(rand(-1, 1), rand(0.5, 2), rand(-1, 1)),
        life: 0.5, size: 0.5, color: 0xff6a72, opacity: 0.8,
      });
    }
    return zone;
  }

  update(dt) {
    this.time += dt;
    this.sparks.update(dt);
    this.smoke.update(dt);
    this.blood.update(dt);
    this.glow.update(dt);
    this.dust.update(dt);
    this.fire.update(dt);

    if (this.muzzleLightLife > 0) {
      this.muzzleLightLife -= dt;
      this.muzzleLight.intensity *= Math.pow(0.0001, dt);
      if (this.muzzleLightLife <= 0) this.muzzleLight.intensity = 0;
    }

    for (const t of this.tracers) {
      if (t.life > 0) {
        t.life -= dt;
        t.mat.opacity = Math.max(0, (t.life / 0.075) * 0.85);
        if (t.life <= 0) t.line.visible = false;
      }
    }

    for (const r of this.rings) {
      if (r.life > 0) {
        r.life -= dt;
        const k = 1 - r.life / r.maxLife;
        r.mesh.scale.setScalar(0.5 + k * r.grow);
        r.mat.opacity = 0.75 * (1 - k);
        if (r.life <= 0) r.mesh.visible = false;
      }
    }

    // zones
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const z = this.zones[i];
      z.life -= dt;
      if (z.type === 'smoke') {
        const k = 1 - z.life / z.maxLife;
        const fadeIn = Math.min(1, k * 8);
        const fadeOut = Math.min(1, z.life / 1.6);
        for (const s of z.sprites) {
          s.sprite.position.y += Math.sin(this.time * 0.7 + s.phase) * dt * 0.16;
          s.mat.opacity = s.target * fadeIn * fadeOut;
          s.mat.rotation += dt * 0.06 * (s.phase % 2 ? 1 : -1);
        }
      } else if (z.type === 'fire') {
        z.emitTimer -= dt;
        const strength = Math.min(1, z.life / 1.2);
        if (z.emitTimer <= 0) {
          z.emitTimer = 0.035;
          for (let k = 0; k < 2; k++) {
            const phi = Math.random() * Math.PI * 2;
            const r = Math.sqrt(Math.random()) * z.radius;
            const pos = z.pos.clone().add(new THREE.Vector3(Math.cos(phi) * r, rand(0, 0.4), Math.sin(phi) * r));
            this.fire.spawn({
              pos, vel: new THREE.Vector3(rand(-0.3, 0.3), rand(1.4, 3.2), rand(-0.3, 0.3)),
              life: rand(0.35, 0.75), size: rand(0.3, 0.8), grow: -0.6,
              color: Math.random() < 0.5 ? 0xff7a20 : 0xffc44a, opacity: 0.9,
            });
          }
          this.smoke.spawn({
            pos: z.pos.clone().add(new THREE.Vector3(rand(-2, 2), rand(1.2, 3), rand(-2, 2))),
            vel: new THREE.Vector3(rand(-0.4, 0.4), rand(0.8, 1.6), rand(-0.4, 0.4)),
            life: rand(0.8, 1.5), size: rand(0.8, 1.6), grow: 1.8, drag: 0.8,
            color: 0x2a2622, opacity: 0.22, blending: THREE.NormalBlending,
          });
        }
        if (z.light) z.light.intensity = 3.2 * strength * (0.8 + Math.random() * 0.4);
      } else if (z.type === 'wall') {
        z.mat.emissiveIntensity = 0.9 + Math.sin(this.time * 6) * 0.25;
        z.mat.opacity = Math.min(0.82, z.life * 1.5);
      }

      if (z.life <= 0) {
        if (z.group) this.scene.remove(z.group);
        if (z.mesh) {
          this.scene.remove(z.mesh);
          z.mesh.geometry.dispose();
          z.mat.dispose();
        }
        this.zones.splice(i, 1);
      }
    }
  }

  /** does a smoke / wall zone block the segment between two points? */
  segmentBlockedByZone(a, b) {
    for (const z of this.zones) {
      if (!z.blocksVision) continue;
      if (z.type === 'smoke') {
        // 2D segment - circle test
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const fx = a.x - z.pos.x;
        const fz = a.z - z.pos.z;
        const A = dx * dx + dz * dz;
        if (A < 1e-6) continue;
        const B = 2 * (fx * dx + fz * dz);
        const C = fx * fx + fz * fz - z.radius * z.radius;
        let disc = B * B - 4 * A * C;
        if (disc < 0) continue;
        disc = Math.sqrt(disc);
        const t1 = (-B - disc) / (2 * A);
        const t2 = (-B + disc) / (2 * A);
        if ((t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1) || (t1 < 0 && t2 > 1)) return true;
      } else if (z.type === 'wall') {
        const p = new THREE.Vector3(a.x, 1, a.z);
        const q = new THREE.Vector3(b.x, 1, b.z);
        const inv = z.quaternion.clone().invert();
        p.applyQuaternion(inv).add(z.pos.clone().negate().applyQuaternion(inv));
        const local = new THREE.Vector3().copy(a).sub(z.pos).applyQuaternion(inv);
        const local2 = new THREE.Vector3().copy(b).sub(z.pos).applyQuaternion(inv);
        if (Math.abs(local2.x - local.x) > 1e-5) {
          const t = -local.x / (local2.x - local.x);
          if (t >= 0 && t <= 1) {
            const zz = local.z + (local2.z - local.z) * t;
            if (Math.abs(zz) < 0.35) return true;
          }
        }
      }
    }
    return false;
  }

  clearZones() {
    for (const z of this.zones) {
      if (z.group) this.scene.remove(z.group);
      if (z.mesh) { this.scene.remove(z.mesh); z.mesh.geometry.dispose(); z.mat.dispose(); }
    }
    this.zones.length = 0;
  }
}
