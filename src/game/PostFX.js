/**
 * Post-processing stack.
 *
 * Two things make a render read as "game footage" instead of "untextured
 * boxes": highlights that bloom into the lens, and a graded, slightly grainy
 * image with a vignette. Both are done here with a small custom composer:
 *
 *   RenderPass ─▶ Bloom (quality gated) ─▶ Grade/Grain/Vignette ─▶ OutputPass
 *
 * The stack is quality aware and can be disabled entirely; when it is off the
 * renderer draws straight to the canvas exactly like before.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

/** Vignette + film grain + a gentle warm/cool split grade (linear space). */
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uVignette: { value: 0.9 },
    uGrain: { value: 0.045 },
    uSaturation: { value: 1.08 },
    uWarm: { value: 1.0 },
    uResolution: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uVignette;
    uniform float uGrain;
    uniform float uSaturation;
    uniform float uWarm;
    uniform vec2 uResolution;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }

    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;

      // split tone: cool shadows, warm highlights
      float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
      vec3 shadowTint = vec3(0.92, 0.97, 1.06);
      vec3 highTint = vec3(1.06, 1.02, 0.95);
      vec3 tint = mix(shadowTint, highTint, smoothstep(0.05, 0.85, luma));
      c *= mix(vec3(1.0), tint, uWarm);

      // saturation
      c = mix(vec3(luma), c, uSaturation);

      // vignette
      vec2 d = vUv - 0.5;
      float vig = 1.0 - dot(d, d) * uVignette;
      c *= clamp(vig, 0.0, 1.0);

      // animated grain, scaled down in bright areas so skies stay clean
      float n = hash(vUv * uResolution + uTime * 60.0) - 0.5;
      c += n * uGrain * (1.0 - smoothstep(0.55, 1.0, luma));

      gl_FragColor = vec4(max(c, 0.0), 1.0);
    }
  `,
};

export class PostFX {
  constructor(renderer, scene, camera, quality = 'medium') {
    this.renderer = renderer;
    this.quality = quality;
    this.enabled = false;
    if (!renderer || !renderer.isWebGLRenderer || quality === 'low') return;

    try {
      const size = renderer.getSize(new THREE.Vector2());
      const pr = renderer.getPixelRatio();
      const w = Math.max(2, Math.floor(size.x * pr));
      const h = Math.max(2, Math.floor(size.y * pr));

      this.composer = new EffectComposer(renderer);
      this.composer.setPixelRatio(1);
      this.composer.setSize(w, h);
      this.composer.addPass(new RenderPass(scene, camera));

      const bloomScale = quality === 'high' ? 1 : 0.5;
      this.bloom = new UnrealBloomPass(new THREE.Vector2(w * bloomScale, h * bloomScale), 0.42, 0.75, 0.82);
      this.composer.addPass(this.bloom);

      this.grade = new ShaderPass(GradeShader);
      this.grade.uniforms.uResolution.value.set(w, h);
      this.composer.addPass(this.grade);

      this.composer.addPass(new OutputPass());
      this.enabled = true;
    } catch (err) {
      console.warn('postfx disabled', err?.message || err);
      this.enabled = false;
    }
  }

  setSize(width, height, pixelRatio = 1) {
    if (!this.enabled) return;
    const w = Math.max(2, Math.floor(width * pixelRatio));
    const h = Math.max(2, Math.floor(height * pixelRatio));
    this.composer.setSize(w, h);
    this.bloom?.setSize(w * (this.quality === 'high' ? 1 : 0.5), h * (this.quality === 'high' ? 1 : 0.5));
    this.grade?.uniforms.uResolution.value.set(w, h);
  }

  render(dt) {
    if (!this.enabled) return false;
    this.grade.uniforms.uTime.value = (this.grade.uniforms.uTime.value + (dt || 0.016)) % 10;
    this.composer.render(dt || 0.016);
    return true;
  }

  dispose() {
    this.composer?.dispose?.();
    this.bloom?.dispose?.();
    this.enabled = false;
  }
}
