/**
 * Fully procedural audio engine (Web Audio API).
 * No audio files: every gunshot, footstep, ui blip and the ambient music bed
 * is synthesised at runtime, keeping the whole game a single lightweight bundle.
 */

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.masterGain = null;
    this.sfxGain = null;
    this.musicGain = null;
    this.ambientGain = null;
    this.volume = 0.7;
    this.musicVolume = 0.35;
    this.listener = { x: 0, z: 0, yaw: 0 };
    this.noiseBuffer = null;
    this.musicTimer = null;
    this.ambientNodes = null;
    this._musicStep = 0;
  }

  init() {
    if (this.ready) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    try {
      this.ctx = new Ctx();
    } catch {
      return;
    }
    const ctx = this.ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 22;
    comp.ratio.value = 5;
    comp.attack.value = 0.003;
    comp.release.value = 0.22;

    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = this.volume;
    this.sfxGain = ctx.createGain();
    this.sfxGain.gain.value = 1;
    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = this.musicVolume * 0.5;
    this.ambientGain = ctx.createGain();
    this.ambientGain.gain.value = 0.16;

    this.sfxGain.connect(comp);
    this.musicGain.connect(comp);
    this.ambientGain.connect(comp);
    comp.connect(this.masterGain);
    this.masterGain.connect(ctx.destination);

    // shared 2s noise buffer
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buf;

    this.ready = true;
    this._startAmbient();
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  setVolume(v) {
    this.volume = v;
    if (this.masterGain) this.masterGain.gain.value = v;
  }

  setMusicVolume(v) {
    this.musicVolume = v;
    if (this.musicGain) this.musicGain.gain.value = v * 0.5;
  }

  setListener(x, z, yaw) {
    this.listener.x = x;
    this.listener.z = z;
    this.listener.yaw = yaw;
  }

  /* ------------------------------------------------------------ */
  _noise(dur, { type = 'lowpass', freq = 1800, q = 1, gain = 0.5, attack = 0.002, decay = null, dest = null, detune = 0 } = {}) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.playbackRate.value = 1 + detune;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(g).connect(dest || this.sfxGain);
    src.start(t);
    src.stop(t + dur + 0.02);
    return { src, filter, gain: g };
  }

  _tone(freq, dur, { type = 'sine', gain = 0.2, attack = 0.005, slideTo = null, dest = null, destGain = null } = {}) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest || this.sfxGain);
    if (destGain) g.connect(destGain);
    o.start(t);
    o.stop(t + dur + 0.02);
    return { o, g };
  }

  /** spatialise a shot relative to the camera/listener */
  _spatial(pos) {
    if (!pos) return { pan: 0, dist: 0, gain: 1 };
    const dx = pos.x - this.listener.x;
    const dz = pos.z - this.listener.z;
    const dist = Math.hypot(dx, dz);
    // rotate into listener space
    const sin = Math.sin(-this.listener.yaw);
    const cos = Math.cos(-this.listener.yaw);
    const right = dx * cos - dz * sin;
    const pan = Math.max(-1, Math.min(1, right / Math.max(4, dist)));
    const gain = Math.max(0.05, 1 / (1 + dist * 0.12));
    return { pan, dist, gain };
  }

  play(name, { pos = null, volume = 1, pitch = 1 } = {}) {
    if (!this.ready || this.ctx.state === 'suspended') return;
    const ctx = this.ctx;
    const sp = this._spatial(pos);
    const out = ctx.createGain();
    out.gain.value = volume * sp.gain;
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (panner) {
      panner.pan.value = sp.pan;
      out.connect(panner).connect(this.sfxGain);
    } else {
      out.connect(this.sfxGain);
    }
    const dest = out;
    const far = sp.dist > 22;

    switch (name) {
      case 'shot_pistol':
      case 'shot_smg':
      case 'shot_rifle':
      case 'shot_shotgun':
      case 'shot_sniper':
      case 'shot_heavy': {
        const heavy = name === 'shot_sniper' || name === 'shot_heavy';
        const rifle = name === 'shot_rifle';
        const shot = name === 'shot_shotgun';
        this._noise(heavy ? 0.5 : shot ? 0.42 : 0.22, {
          type: 'lowpass', freq: (far ? 900 : heavy ? 4200 : shot ? 3400 : 5200) * (far ? 0.35 : 1),
          q: 0.8, gain: 0.75, dest, detune: far ? -0.3 : 0,
        });
        this._noise(0.09, { type: 'highpass', freq: 2600, gain: 0.35, dest });
        this._tone(heavy ? 92 : shot ? 130 : rifle ? 160 : 190, heavy ? 0.32 : 0.16, {
          type: 'sine', gain: heavy ? 0.5 : 0.32, slideTo: heavy ? 42 : 60, dest,
        });
        if (heavy) this._tone(58, 0.55, { type: 'triangle', gain: 0.28, slideTo: 34, dest });
        break;
      }
      case 'shot_knife':
        this._noise(0.12, { type: 'bandpass', freq: 2800, q: 1.4, gain: 0.25, dest });
        break;
      case 'dryfire':
        this._noise(0.05, { type: 'highpass', freq: 3000, gain: 0.18, dest });
        break;
      case 'reload':
        this._noise(0.05, { type: 'bandpass', freq: 1800, q: 2, gain: 0.3, dest });
        setTimeout(() => {
          if (this.ready) this._noise(0.06, { type: 'bandpass', freq: 900, q: 2.4, gain: 0.34, dest });
        }, 220);
        setTimeout(() => {
          if (this.ready) this._noise(0.08, { type: 'bandpass', freq: 2600, q: 1.6, gain: 0.3, dest });
        }, 520);
        break;
      case 'reload_done':
        this._tone(880, 0.06, { type: 'square', gain: 0.06, dest });
        this._noise(0.07, { type: 'bandpass', freq: 3200, q: 1.4, gain: 0.22, dest });
        break;
      case 'footstep':
        this._noise(0.09, { type: 'lowpass', freq: 420 + Math.random() * 200, gain: 0.22, dest });
        this._noise(0.04, { type: 'bandpass', freq: 1800, gain: 0.05, dest });
        break;
      case 'jump':
        this._tone(300, 0.1, { type: 'sine', gain: 0.1, slideTo: 520, dest });
        break;
      case 'land':
        this._noise(0.14, { type: 'lowpass', freq: 300, gain: 0.34, dest });
        break;
      case 'hit':
        this._tone(1600 + Math.random() * 300, 0.05, { type: 'square', gain: 0.09, dest });
        break;
      case 'headshot':
        this._tone(2400, 0.09, { type: 'sine', gain: 0.16, dest });
        this._tone(1500, 0.14, { type: 'triangle', gain: 0.12, slideTo: 2400, dest });
        break;
      case 'hitmarker':
        this._tone(1200, 0.04, { type: 'square', gain: 0.05, dest });
        break;
      case 'kill':
        this._tone(1200, 0.12, { type: 'sine', gain: 0.16, dest });
        this._tone(1800, 0.24, { type: 'sine', gain: 0.12, dest });
        this._noise(0.2, { type: 'bandpass', freq: 2400, q: 0.8, gain: 0.14, dest });
        break;
      case 'death':
        this._noise(0.5, { type: 'lowpass', freq: 700, gain: 0.5, dest });
        this._tone(140, 0.6, { type: 'sawtooth', gain: 0.16, slideTo: 50, dest });
        break;
      case 'impact':
        this._noise(0.06, { type: 'bandpass', freq: 2200 + Math.random() * 1200, q: 2, gain: 0.14, dest });
        break;
      case 'spike_beep':
        this._tone(1450, 0.07, { type: 'square', gain: 0.18, dest });
        break;
      case 'spike_plant':
        this._noise(0.2, { type: 'bandpass', freq: 500, q: 1, gain: 0.3, dest });
        this._tone(180, 0.1, { type: 'square', gain: 0.12, dest });
        break;
      case 'spike_planted':
        this._tone(110, 0.3, { type: 'sawtooth', gain: 0.1, dest });
        this._tone(60, 0.9, { type: 'sine', gain: 0.35, slideTo: 40, dest });
        break;
      case 'defuse_start':
        this._tone(520, 0.3, { type: 'sine', gain: 0.12, dest });
        break;
      case 'defused':
        this._tone(660, 0.2, { type: 'sine', gain: 0.2, dest });
        setTimeout(() => this.ready && this._tone(990, 0.4, { type: 'sine', gain: 0.2 }), 160);
        break;
      case 'explosion':
        this._noise(1.4, { type: 'lowpass', freq: 900, gain: 0.9, dest });
        this._noise(0.35, { type: 'highpass', freq: 1600, gain: 0.4, dest });
        this._tone(70, 1.3, { type: 'sine', gain: 0.6, slideTo: 28, dest });
        break;
      case 'flash':
        this._noise(0.35, { type: 'highpass', freq: 1200, gain: 0.5, dest });
        this._tone(3200, 1.5, { type: 'sine', gain: 0.1, slideTo: 500, dest });
        break;
      case 'smoke_pop':
        this._noise(1.1, { type: 'lowpass', freq: 1600, gain: 0.32, dest });
        this._tone(260, 0.5, { type: 'sine', gain: 0.1, slideTo: 120, dest });
        break;
      case 'fire_whoosh':
        this._noise(0.9, { type: 'bandpass', freq: 900, q: 0.6, gain: 0.35, dest });
        break;
      case 'ability':
        this._tone(420, 0.16, { type: 'triangle', gain: 0.14, slideTo: 840, dest });
        this._noise(0.14, { type: 'bandpass', freq: 1800, q: 1.2, gain: 0.14, dest });
        break;
      case 'ultimate':
        this._tone(120, 1.4, { type: 'sawtooth', gain: 0.2, slideTo: 420, dest });
        this._tone(240, 1.6, { type: 'sine', gain: 0.16, slideTo: 120, dest });
        this._noise(1.2, { type: 'bandpass', freq: 1200, q: 0.4, gain: 0.2, dest });
        break;
      case 'heal':
        this._tone(520, 0.3, { type: 'sine', gain: 0.12, slideTo: 780, dest });
        setTimeout(() => this.ready && this._tone(880, 0.3, { type: 'sine', gain: 0.1 }), 120);
        break;
      case 'ui_click':
        this._tone(720, 0.05, { type: 'square', gain: 0.05, dest });
        break;
      case 'ui_hover':
        this._tone(1100, 0.03, { type: 'sine', gain: 0.028, dest });
        break;
      case 'buy':
        this._tone(880, 0.08, { type: 'square', gain: 0.07, dest });
        setTimeout(() => this.ready && this._tone(1320, 0.12, { type: 'square', gain: 0.06 }), 70);
        break;
      case 'round_start':
        this._tone(220, 0.9, { type: 'sawtooth', gain: 0.1, slideTo: 440, dest });
        this._noise(0.8, { type: 'lowpass', freq: 800, gain: 0.1, dest });
        break;
      case 'win':
        this._tone(392, 0.4, { type: 'triangle', gain: 0.16, dest });
        setTimeout(() => this.ready && this._tone(523, 0.4, { type: 'triangle', gain: 0.16 }), 180);
        setTimeout(() => this.ready && this._tone(659, 0.7, { type: 'triangle', gain: 0.18 }), 360);
        break;
      case 'lose':
        this._tone(330, 0.5, { type: 'triangle', gain: 0.14, dest });
        setTimeout(() => this.ready && this._tone(247, 0.6, { type: 'triangle', gain: 0.14 }), 220);
        setTimeout(() => this.ready && this._tone(196, 0.9, { type: 'triangle', gain: 0.16 }), 460);
        break;
      default:
        break;
    }
  }

  /* ------------------------------------------------------------ */
  _startAmbient() {
    if (!this.ready || this.ambientNodes) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    lp.Q.value = 0.6;
    const g = ctx.createGain();
    g.gain.value = 0.4;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 180;
    lfo.connect(lfoGain).connect(lp.frequency);
    src.connect(lp).connect(g).connect(this.ambientGain);
    src.start();
    lfo.start();
    this.ambientNodes = { src, lfo, g, lp };
  }

  /** slow ambient music bed (menu + match) built from a chord progression */
  startMusic(kind = 'menu') {
    if (!this.ready) return;
    this.stopMusic();
    const ctx = this.ctx;
    const scales = {
      menu: [55, 82.5, 110, 130.81, 164.81, 196, 220],
      match: [49, 73.42, 98, 116.54, 146.83, 174.61, 196],
    };
    const roots = kind === 'menu' ? [110, 130.81, 98, 87.31] : [98, 116.54, 87.31, 73.42];
    const notes = scales[kind] || scales.menu;
    let step = 0;

    const playPad = () => {
      if (!this.ready) return;
      const t = ctx.currentTime;
      const root = roots[step % roots.length];
      const chord = [root, root * 1.2, root * 1.5, root * 2];
      for (let i = 0; i < chord.length; i++) {
        const o = ctx.createOscillator();
        o.type = i === 0 ? 'sine' : 'triangle';
        o.frequency.value = chord[i] * (i === 3 ? 1.001 : 1);
        const g = ctx.createGain();
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 900 + i * 260;
        const dur = 6.2;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.085 / (i + 1), t + 1.8);
        g.gain.linearRampToValueAtTime(0.0001, t + dur);
        o.connect(lp).connect(g).connect(this.musicGain);
        o.start(t);
        o.stop(t + dur + 0.1);
      }
      // sparse melody
      if (step % 2 === 0) {
        const n = notes[Math.floor(Math.random() * notes.length)] * 4;
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = n;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t + 0.6);
        g.gain.linearRampToValueAtTime(0.04, t + 1.0);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 3.4);
        o.connect(g).connect(this.musicGain);
        o.start(t + 0.6);
        o.stop(t + 3.6);
      }
      step++;
    };
    playPad();
    this.musicTimer = setInterval(playPad, 6000);
    this._musicStep = step;
  }

  stopMusic() {
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }
}

export const audio = new AudioEngine();
