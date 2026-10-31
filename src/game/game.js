import * as THREE from 'three';
import { GameMap } from '../world/map.js';
import { Effects } from './effects.js';
import { Viewmodel } from './Viewmodel.js';
import { Player } from './player.js';
import { Bot } from './bot.js';
import { Actor, ACTOR_RADIUS, ACTOR_HEIGHT } from './actor.js';
import { getWeapon, WEAPONS, BUY_ORDER, BUY_GROUPS } from './weapons.js';
import { AGENTS, AGENT_LIST } from './agents.js';
import { audio } from '../core/audio.js';
import { recordMatch, loadProfile, profileSummary } from './profile.js';
import { clamp, rand, choice, shuffle, rayBoxes, boxFromCenter, resolveCircleBoxXZ, distance2D, angleDiff } from '../core/utils.js';
import { PLANT_SPOTS, HOLD_SPOTS, SPAWNS, SITES, MAP_BOUNDS, ATTACK_PATHS, CURRENT_MAP } from '../world/mapLayout.js';

const BUY_TIME = 20;
const LIVE_TIME = 100;
const SPIKE_TIME = 45;
const PLANT_TIME = 3.2;
const DEFUSE_TIME = 10;      // sans kit
const DEFUSE_TIME_KIT = 5;   // defuse kit ile
const ROUND_END_TIME = 5.5;
const ROUNDS_TO_WIN = 13;
const MAX_ROUNDS = 24;

const PHASE_LABEL = {
  buy: 'SATIN ALMA',
  live: 'TUR BAŞLADI',
  planted: 'BOMBA KURULU',
  roundEnd: 'TUR SONU',
  matchEnd: 'MAÇ SONU',
  freeze: 'HAZIRLAN',
};

export class Game {
  constructor({ canvas, ui, settings = {}, agentId = 'phoenix', onExit, headless = false }) {
    this.headless = headless;
    this.canvas = canvas;
    this.ui = ui;
    this.settings = settings;
    this.agentId = agentId;
    this.onExit = onExit;

    this.time = 0;
    this.phase = 'buy';
    this.phaseTimer = BUY_TIME;
    this.roundNumber = 0;
    this.lossStreak = { ally: 0, enemy: 0 };
    this.weaponKills = {};
    this.halfStart = 13;
    this.playerInBuyZone = true;
    this.weaponKills = {};
    this.lossStreak = { ally: 0, enemy: 0 };
    this.aceCount = 0;
    this.scores = { ally: 0, enemy: 0 };
    this.attackingTeam = 'ally';
    this.attackSite = 'A';
    this.roundHistory = [];
    this.paused = false;
    this.running = false;
    this.matchOver = false;

    this.actors = [];
    this.sites = SITES;
    this.spawns = SPAWNS;
    this.projectiles = [];
    this.fireTimers = [];
    this.killLog = [];
    this.lastKillTime = -99;
    this.multiKill = 0;

    this.spike = {
      state: 'carried', pos: new THREE.Vector3(), carrier: null,
      timer: SPIKE_TIME, beepTimer: 1, site: 'A', plantProgress: 0, defuseProgress: 0,
      defuserId: null, dropTime: 0,
      // convenience flags used all over the AI/UI code
      get planted() { return this.state === 'planted'; },
      get dropped() { return this.state === 'dropped'; },
      get carried() { return this.state === 'carried'; },
    };
    this.currentPlantSpot = { x: 21, z: -22 };
    this.spectateTarget = null;
    this.buyMenuOpen = false;
    this.scoreboardOpen = false;

    this.input = {
      forward: false, back: false, left: false, right: false,
      jump: false, crouch: false, walk: false,
      fireHeld: false, firePressed: false, ads: false, interact: false,
    };
    this.mouse = { dx: 0, dy: 0 };
    this.locked = false;
    this._boundHandlers = [];
    this.barriers = [];
    this.spawnBarrierActive = true;
  }

  /* ================================================================ */
  /* setup                                                             */
  /* ================================================================ */
  init() {
    const quality = this.settings.quality || 'medium';
    let renderer;
    if (this.headless) {
      renderer = {
        setSize() {}, setPixelRatio() {}, clear() {}, clearDepth() {}, render() {},
        dispose() {}, autoClear: false,
        shadowMap: { enabled: false, type: 0 },
        outputColorSpace: '', toneMapping: 0, toneMappingExposure: 1,
      };
    } else {
      renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: quality !== 'low',
        powerPreference: 'high-performance',
        alpha: false,
      });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality === 'high' ? 2 : 1.5));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      renderer.shadowMap.enabled = quality !== 'low';
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.autoClear = false;
    }
    this.renderer = renderer;

    this.scene = new THREE.Scene();
    const aspect = (window.innerWidth || 1280) / (window.innerHeight || 720);
    this.camera = new THREE.PerspectiveCamera(this.settings.fov || 90, aspect, 0.05, 420);
    this.camera.rotation.order = 'YXZ';

    this.map = new GameMap(this.scene, quality, this.settings.map || 'de_dust2');
    this.effects = new Effects(this.scene, quality);
    this.viewmodel = new Viewmodel(renderer, quality);

    // player
    this.player = new Player(this, { agentId: this.agentId, name: this.settings.playerName || 'SEN' });
    this.player.sensitivity = this.settings.sens ?? 0.45;
    this.player.fovBase = this.settings.fov ?? 90;
    this.player.team = 'ally';
    this.actors.push(this.player);
    this.scene.add(this.player.character.root);
    this.player.character.root.visible = false;
    this.viewmodel.setAgent(this.agentId);
    this.viewmodel.setSkinMap(this.settings.skins || null);

    // bot team roster
    const usedAgents = [this.agentId];
    const pickAgent = () => {
      const pool = AGENT_LIST.filter((a) => !usedAgents.includes(a.id));
      const a = pool.length ? choice(pool) : choice(AGENT_LIST);
      usedAgents.push(a.id);
      if (usedAgents.length > 3) usedAgents.shift();
      return a.id;
    };

    const allyNames = ['KARTAL', 'DENİZ', 'MİRA', 'SARP'];
    for (let i = 0; i < 4; i++) {
      const bot = new Bot(this, { team: 'ally', agentId: pickAgent(), name: allyNames[i], difficulty: this.settings.botDifficulty || 'normal' });
      this.actors.push(bot);
      this.scene.add(bot.character.root);
    }
    const enemyNames = ['VIPER', 'ROOK', 'NYX', 'KROW', 'SABLE'];
    for (let i = 0; i < 5; i++) {
      const bot = new Bot(this, { team: 'enemy', agentId: pickAgent(), name: enemyNames[i], difficulty: this.settings.botDifficulty || 'normal' });
      this.actors.push(bot);
      this.scene.add(bot.character.root);
    }

    this._buildSpikeVisual();
    this._buildSpawnBarriers();
    if (!this.headless) {
      this._bindInput();
      this._bindResize();
    }

    // initial round
    this.roundNumber = 0;
    this.lossStreak = { ally: 0, enemy: 0 };
    this.weaponKills = {};
    this.halfStart = 13;
    this.playerInBuyZone = true;
    this.startRound(true);

    this.ui.setMapName?.(this.map.map?.name || 'DUST II');
    return this;
  }

  _buildSpikeVisual() {
    // C4 charge: plated housing, folding prongs and a
    // glowing core that pulses faster as the timer runs down.
    const g = new THREE.Group();
    const shellMat = new THREE.MeshStandardMaterial({ color: 0x1d2329, metalness: 0.85, roughness: 0.34 });
    const plateMat = new THREE.MeshStandardMaterial({ color: 0x39424b, metalness: 0.7, roughness: 0.45 });
    const glowMat = new THREE.MeshStandardMaterial({
      color: 0xffe9a8, emissive: 0xffb43c, emissiveIntensity: 2.6, roughness: 0.25, metalness: 0.2,
    });
    this.spikeGlowMat = glowMat;

    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.09, 6), shellMat);
    base.position.y = 0.05;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.22, 0.42, 6), plateMat);
    body.position.y = 0.3;
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.022, 6, 14), shellMat);
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 0.5;
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.3, 8), glowMat);
    core.position.y = 0.66;

    // three prongs folding over the core
    const prongs = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + Math.PI / 6;
      const prong = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.34, 0.05), plateMat);
      prong.position.set(Math.cos(a) * 0.16, 0.72, Math.sin(a) * 0.16);
      prong.rotation.z = -Math.cos(a) * 0.35;
      prong.rotation.x = Math.sin(a) * 0.35;
      prongs.add(prong);
    }
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 6), glowMat);
    tip.position.y = 0.92;

    const light = new THREE.PointLight(0xffb43c, 2.4, 9, 2);
    light.position.y = 0.7;
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(0.3, 0.014, 5, 20),
      new THREE.MeshBasicMaterial({ color: 0xffc46a, transparent: true, opacity: 0.72, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    halo.rotation.x = Math.PI / 2;
    halo.position.y = 0.02;
    this.spikeHalo = halo;

    g.add(base, body, collar, core, prongs, tip, light, halo);
    g.visible = false;
    this.scene.add(g);
    this.spikeMesh = g;
    this.spikeLight = light;
    this.spikeCore = core;
  }

  _buildSpawnBarriers() {
    // one long invisible barrier keeping everyone in spawn during buy phase
    const mkBarrier = (x, z, w, d) => {
      const tex = this._barrierTexture();
      const mat = new THREE.MeshBasicMaterial({
        map: tex, transparent: true, opacity: 0.55, side: THREE.DoubleSide,
        depthWrite: false, blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, 4.2), mat);
      mesh.position.set(x, 2.1, z);
      this.scene.add(mesh);
      const box = boxFromCenter(x, 2.1, z, w, 4.2, d);
      return { mesh, mat, box, w, d, x, z };
    };
    this.barriers.push(mkBarrier(0, 20.5, 66, 0.5));   // attacker side
    this.barriers.push(mkBarrier(0, -24, 6.2, 0.5));   // defender spawn door
  }

  _barrierTexture() {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 64;
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgba(255,70,85,0.06)';
    ctx.fillRect(0, 0, 128, 64);
    ctx.strokeStyle = 'rgba(255,90,100,0.55)';
    ctx.lineWidth = 2;
    for (let x = -64; x < 128; x += 16) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 64, 64);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,140,150,0.35)';
    ctx.strokeRect(1, 1, 126, 62);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(8, 1);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  /* ================================================================ */
  /* input                                                             */
  /* ================================================================ */
  _on(target, event, fn, opts) {
    target.addEventListener(event, fn, opts);
    this._boundHandlers.push([target, event, fn, opts]);
  }

  _bindResize() {
    this._on(window, 'resize', () => {
      const w = window.innerWidth || 1280;
      const h = window.innerHeight || 720;
      this.renderer.setSize(w, h);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    });
  }

  _bindInput() {
    const canvas = this.canvas;

    this._on(document, 'pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      if (!this.locked && this.running && !this.buyMenuOpen && !this.scoreboardOpen && !this.matchOver && !this.ui.isMenuOpen()) {
        this.ui.showClickToPlay(true);
      } else {
        this.ui.showClickToPlay(false);
      }
    });

    // some browsers refuse pointer lock without a fresh gesture: fall back to the
    // "click to play" prompt instead of leaving the player without mouse look
    this._on(document, 'pointerlockerror', () => {
      if (this.running && !this.matchOver && !this.buyMenuOpen) this.ui.showClickToPlay(true);
    });

    this._on(canvas, 'mousedown', (e) => {
      if (!this.locked) {
        if (!this.buyMenuOpen && !this.paused && !this.matchOver) this.requestLock();
        return;
      }
      if (e.button === 0) {
        this.input.fireHeld = true;
        this.input.firePressed = true;
        this.player.attemptFire();
      } else if (e.button === 2) {
        this.player.adsHeld = true;
      }
    });
    this._on(window, 'mouseup', (e) => {
      if (e.button === 0) this.input.fireHeld = false;
      if (e.button === 2) this.player.adsHeld = false;
    });
    this._on(canvas, 'contextmenu', (e) => e.preventDefault());
    this._on(document, 'mousemove', (e) => {
      if (!this.locked || this.paused) return;
      this.player.look(e.movementX || 0, e.movementY || 0, this.player.sensitivity);
    });
    this._on(document, 'wheel', (e) => {
      if (!this.locked) return;
      this.player.cycleSlot(e.deltaY > 0 ? 1 : -1);
    }, { passive: true });

    this._on(window, 'keydown', (e) => this._onKeyDown(e));
    this._on(window, 'keyup', (e) => this._onKeyUp(e));
    this._on(window, 'blur', () => this._resetInput());
  }

  _resetInput() {
    this.input.forward = this.input.back = this.input.left = this.input.right = false;
    this.input.jump = this.input.crouch = this.input.walk = false;
    this.input.fireHeld = false;
    this.input.interact = false;
    this.player.adsHeld = false;
  }

  _onKeyDown(e) {
    if (this.ui.isTyping?.()) return;
    const code = e.code;
    const menuOpen = this.buyMenuOpen || this.scoreboardOpen || this.paused || this.matchOver || this.ui.isOverlayOpen();
    const p = this.player;

    // global keys
    if (code === 'Tab') {
      e.preventDefault();
      if (this.ui.isOverlayOpen() && !this.scoreboardOpen) return;
      this.scoreboardOpen = true;
      this.ui.showScoreboard(true, this.scoreboardData());
      return;
    }
    if (code === 'KeyB') {
      e.preventDefault();
      if (this.phase === 'buy' && !this.scoreboardOpen) this.toggleBuyMenu();
      return;
    }
    if (code === 'Escape') {
      if (this.buyMenuOpen) { this.toggleBuyMenu(false); return; }
      if (this.scoreboardOpen) { this.scoreboardOpen = false; this.ui.showScoreboard(false); return; }
      if (!this.matchOver) this.togglePause(!this.paused);
      return;
    }
    if (menuOpen) return;
    if (!this.locked && !this.matchOver) {
      // pointer lock lost: clicking restores it, keys are ignored
      return;
    }

    switch (code) {
      case 'KeyW': this.input.forward = true; break;
      case 'KeyS': this.input.back = true; break;
      case 'KeyA': this.input.left = true; break;
      case 'KeyD': this.input.right = true; break;
      case 'Space': e.preventDefault(); this.input.jump = true; break;
      case 'ShiftLeft': case 'ShiftRight': this.input.walk = true; break;
      case 'ControlLeft': case 'ControlRight': this.input.crouch = true; break;
      case 'KeyR': p.startReload(); break;
      case 'Digit1': p.switchSlot(1); break;
      case 'Digit2': p.switchSlot(2); break;
      case 'Digit3': p.switchSlot(3); break;
      case 'KeyF': this.input.interact = true; break;
      case 'KeyQ': p.castAbility('Q'); break;
      case 'KeyE': p.castAbility('E'); break;
      case 'KeyC': p.castAbility('C'); break;
      case 'KeyX': p.castAbility('X'); break;
      default: break;
    }
  }

  _onKeyUp(e) {
    switch (e.code) {
      case 'KeyW': this.input.forward = false; break;
      case 'KeyS': this.input.back = false; break;
      case 'KeyA': this.input.left = false; break;
      case 'KeyD': this.input.right = false; break;
      case 'Space': this.input.jump = false; break;
      case 'ShiftLeft': case 'ShiftRight': this.input.walk = false; break;
      case 'ControlLeft': case 'ControlRight': this.input.crouch = false; break;
      case 'KeyF': this.input.interact = false; break;
      case 'Tab':
        this.scoreboardOpen = false;
        this.ui.showScoreboard(false);
        break;
      default: break;
    }
  }

  requestLock() {
    const p = this.canvas.requestPointerLock?.();
    if (p && p.catch) p.catch(() => {});
  }

  toggleBuyMenu(force) {
    if (this.matchOver) return;
    if (this.headless) return;
    const open = force === undefined ? !this.buyMenuOpen : force;
    if (open && this.phase !== 'buy') return;
    this.buyMenuOpen = open;
    this.ui.showBuyMenu(open, this.buyData());
    if (open) {
      document.exitPointerLock?.();
      this._resetInput();
    } else if (this.running && !this.matchOver) {
      this.requestLock();
    }
  }

  togglePause(on) {
    this.paused = on;
    this.ui.showPause(on);
    if (on) {
      document.exitPointerLock?.();
      this._resetInput();
      audio.setMusicVolume(this.settings.music * 0.25);
    } else {
      this.requestLock();
      audio.setMusicVolume(this.settings.music);
    }
  }

  leaveMatch() {
    this.stop();
    this.ui.hideHUD();
    this.ui.showPause(false);
    this.ui.showBuyMenu(false);
    this.ui.showScoreboard(false);
    this.onExit?.();
  }

  /* ================================================================ */
  /* round flow                                                        */
  /* ================================================================ */
  startRound(first = false) {
    this.roundNumber++;
    if (this.roundNumber === this.halfStart && this.roundNumber > 1) {
      this.attackingTeam = this.attackingTeam === 'ally' ? 'enemy' : 'ally';
      this.ui.event(this.attackingTeam === 'ally' ? 'TARAF DEĞİŞTİ — SALDIRI' : 'TARAF DEĞİŞTİ — DEFANS', 4);
    }
    this.phase = 'buy';
    this.phaseTimer = BUY_TIME;
    this.spikeTimerRunning = false;
    this.spawnBarrierActive = true;
    this.attackSite = Math.random() < 0.5 ? 'A' : 'B';
    this.currentPlantSpot = choice(PLANT_SPOTS[this.attackSite]);
    this.spectateTarget = null;
    this.matchOver = false;

    // reset spike
    this.spike.state = 'carried';
    this.spike.timer = SPIKE_TIME;
    this.spike.beepTimer = 1;
    this.spike.plantProgress = 0;
    this.spike.defuseProgress = 0;
    this.spike.defuserId = null;
    this.spike.site = this.attackSite;
    this.spikeMesh.visible = false;

    // reset actors
    const allySpawns = shuffle(SPAWNS.attacker).slice();
    const enemySpawns = shuffle(SPAWNS.defender).slice();
    const allySpawn = this.attackingTeam === 'ally' ? SPAWNS.attacker : SPAWNS.defender;
    const enemySpawn = this.attackingTeam === 'ally' ? SPAWNS.defender : SPAWNS.attacker;
    const allySpawnList = shuffle(allySpawn);
    const enemySpawnList = shuffle(enemySpawn);
    let ai = 0;
    let ei = 0;

    const attackers = this.actors.filter((a) => a.team === this.attackingTeam);
    const defenders = this.actors.filter((a) => a.team !== this.attackingTeam);

    // spike carrier: player sometimes, otherwise a random attacker bot
    const playerIsAttacker = this.player.team === this.attackingTeam;
    let carrier = null;
    if (playerIsAttacker && Math.random() < 0.5) carrier = this.player;
    else carrier = choice(attackers);
    if (!carrier) carrier = choice(attackers);
    this.spike.carrier = carrier;

    const attackSpots = shuffle([...HOLD_SPOTS[this.attackSite]]);
    const defendSpotsA = shuffle([...HOLD_SPOTS.A]);
    const defendSpotsB = shuffle([...HOLD_SPOTS.B]);
    const defendSpotsMid = shuffle([...HOLD_SPOTS.mid]);

    // when the human carries the spike, one bot sticks with them as cover
    this.escortBot = null;
    if (carrier === this.player) {
      const mates = this.actors.filter((a) => !a.isPlayer && a.team === this.attackingTeam);
      this.escortBot = mates[0] || null;
    }

    let attackSpotIdx = 0;
    let defA = 0;
    let defB = 0;
    let defMid = 0;

    for (const actor of this.actors) {
      const isPlayer = actor === this.player;
      const spawnList = actor.team === 'ally' ? allySpawnList : enemySpawnList;
      const idx = actor.team === 'ally' ? ai++ : ei++;
      const spawn = spawnList[idx % spawnList.length];

      actor.spikeCarrier = actor === carrier;
      actor.roundKills = 0;
      actor.armor = Math.min(actor.armor, 100);

      const isAttacker = actor.team === this.attackingTeam;
      let route = null;
      if (isAttacker && !isPlayer) {
        const laneNames = ['main', 'main', 'conn', 'mid', 'conn'];
        const lane = laneNames[(idx + this.roundNumber) % laneNames.length];
        route = ATTACK_PATHS[this.attackSite]?.[lane] || null;
        if (actor === carrier) route = ATTACK_PATHS[this.attackSite]?.main || null;
      }
      if (isPlayer) {
        this.player.resetForRound(spawn);
        this.player.spikeCarrier = actor === carrier;
        continue;
      }

      let holdSpot = null;
      if (isAttacker) {
        const spot = attackSpots[attackSpotIdx % attackSpots.length];
        attackSpotIdx++;
        holdSpot = { x: spot.x + rand(-0.6, 0.6), z: spot.z + rand(-0.6, 0.6), look: spot.look, site: this.attackSite };
      } else {
        const roll = (actor.id + this.roundNumber) % 5;
        if (roll < 2) {
          const s = defendSpotsA[defA++ % defendSpotsA.length];
          holdSpot = { x: s.x, z: s.z, look: s.look, site: 'A' };
        } else if (roll < 4) {
          const s = defendSpotsB[defB++ % defendSpotsB.length];
          holdSpot = { x: s.x, z: s.z, look: s.look, site: 'B' };
        } else {
          const s = defendSpotsMid[defMid++ % defendSpotsMid.length];
          holdSpot = { x: s.x, z: s.z, look: s.look, site: 'mid' };
        }
      }

      actor.resetForRound(spawn, { goal: { site: this.attackSite }, holdSpot, carrier: actor === carrier, route });

      // abilities reset each round (must be re-purchased)
      for (const ab of actor.agent.abilities) {
        const st = actor.abilityState[ab.id];
        if (ab.ultimate) continue;
        st.charges = 0;
        st.cooldown = 0;
      }
    }

    // reset player abilities charges as well
    for (const ab of this.player.agent.abilities) {
      if (ab.ultimate) continue;
      this.player.abilityState[ab.id].charges = 0;
      this.player.abilityState[ab.id].cooldown = 0;
    }

    // weapons persist across rounds, only the C4 changes hands
    this.player.currentSlot = this.player.slots[1] ? 1 : 2;
    this.player.character.setWeapon(this.player.slots[this.player.currentSlot], this.settings.skins);
    this.player.syncViewmodel();
    this.player.equipTimer = 0.3;
    this.player.credits = Math.max(this.player.credits, 0);
    this.player.ultPoints = this.player.abilityState[Object.keys(this.player.abilityState)[0]]?.ultPoints || 0;

    // bots auto-buy after a beat
    this.botBuyTimer = 0.8;

    // HUD
    this.ui.setHUDPhase('buy');
    this.ui.setScore(this.scores.ally, this.scores.enemy, this.roundHistory, this.roundNumber);
    this.ui.setCredits(this.player.credits);
    this.ui.banner(`ROUND ${this.roundNumber}`, this.attackingTeam === 'ally' ? 'SALDIRI' : 'DEFANS', 2.2);
    this.ui.updateAbilities(this.player);
    this.ui.setWeaponName(this.player.activeWeapon?.name || 'CLASSIC');
    this.ui.updateWeapon(this.player);

    // open buy menu for the player
    if (!this.headless) {
      setTimeout(() => {
        if (this.running && this.phase === 'buy' && !this.matchOver) this.toggleBuyMenu(true);
      }, 450);
    }

    this.spikeRetriever = null;
    if (!this.spike.carrier?.isPlayer) {
      this.spikeMesh.visible = false;
    }
    audio.play('round_start', { volume: 0.5 });
  }

  beginLive() {
    this.phase = 'live';
    this.phaseTimer = LIVE_TIME;
    this.spawnBarrierActive = false;
    for (const b of this.barriers) b.mesh.visible = false;
    this.ui.setHUDPhase('live');
    this.ui.banner('BAŞLA', this.attackingTeam === 'ally' ? 'C4\'Ü KUR' : 'BOMBA ALANINI TUT', 1.6);
    this.ui.event(`PLAN: ${this.attackSite} BÖLGESİ`, 3);
    if (this.buyMenuOpen) this.toggleBuyMenu(false);
    audio.play('round_start', { volume: 0.65 });
  }

  plantSpike(actor) {
    const spot = this.currentPlantSpot;
    this.spike.state = 'planted';
    this.spike.pos.set(spot.x, 0, spot.z);
    this.spike.timer = SPIKE_TIME;
    this.spike.beepTimer = 0.6;
    this.spike.plantProgress = 0;
    this.spike.defuseProgress = 0;
    this.spike.carrier = null;
    actor.spikeCarrier = false;
    this.spike.planterId = actor.id;
    actor.stats.plants++;
    actor.credits += 300;
    actor.addUltPoints(2);
    this.phase = 'planted';
    this.phaseTimer = SPIKE_TIME;
    this.spikeMesh.visible = true;
    this.spikeMesh.position.set(spot.x, 0.02, spot.z);
    this.ui.setHUDPhase('planted');
    this.ui.banner('BOMBA KURULDU', actor.name + ' · 45 SANİYE', 2.4);
    this.ui.event(`${actor.name} spike'ı ${this.spike.site} bölgesine kurdu`, 4);
    audio.play('spike_planted', { volume: 0.9 });
    this.effects.reconRing(this.spike.pos.clone(), 5);
    this.updatePlantProgressUI(null);
    this.ui.updateAbilities?.(this.player);
  }

  defuseSpike(actor) {
    actor.credits = Math.min(16000, actor.credits + 300);
    this.spike.state = 'defused';
    actor.stats.defuses++;
    actor.credits += 300;
    actor.addUltPoints(2);
    this.effects.explosion(this.spike.pos.clone(), 0.5);
    this.spikeMesh.visible = false;
    audio.play('defused', { volume: 0.9 });
    this.endRound('ally' === this.attackingTeam ? 'enemy' : 'ally', 'defuse');
  }

  explodeSpike() {
    this.spike.state = 'exploded';
    const pos = this.spike.pos.clone();
    this.effects.explosion(pos.clone().setY(0.6), 2.6);
    this.effects.smokeCloud(pos.clone().setY(2.4), 9, 8);
    this.spikeMesh.visible = false;
    audio.play('explosion', { volume: 1 });
    this.cameraShake(1.6);
    // lethal for anyone near
    for (const a of this.actors) {
      if (!a.alive) continue;
      const d = distance2D(a.pos, pos);
      if (d < 10) {
        a.takeDamage(150 * (1 - d / 10) + 12, { attacker: null, weaponId: 'spike' });
      }
    }
    this.endRound(this.attackingTeam, 'explode');
  }

  endRound(winnerTeam, reason) {
    if (this.phase === 'roundEnd' || this.phase === 'matchEnd') return;
    this.phase = 'roundEnd';
    this.phaseTimer = ROUND_END_TIME;
    this.roundWinner = winnerTeam;
    this.scores[winnerTeam]++;
    this.roundHistory.push({ winner: winnerTeam, reason });
    const playerWon = winnerTeam === this.player.team;
    this.ui.setScore(this.scores.ally, this.scores.enemy, this.roundHistory, this.roundNumber);
    this.ui.banner(playerWon ? 'ROUND KAZANILDI' : 'ROUND KAYBEDİLDİ', this.roundReasonText(reason), 3.2);
    this.ui.setHUDPhase('roundEnd');
    audio.play(playerWon ? 'win' : 'lose', { volume: 0.8 });
    this.updatePlantProgressUI(null);
    this.updateDefuseProgressUI(null);

    // economy: CS loss-bonus ladder 1400 → 1700 → 2000 → 2300 → 2600 → 2900
    const loserTeam = winnerTeam === 'ally' ? 'enemy' : 'ally';
    this.lossStreak[loserTeam] = Math.min(5, (this.lossStreak[loserTeam] || 0) + 1);
    this.lossStreak[winnerTeam] = 0;
    const lossBonus = 1400 + 300 * this.lossStreak[loserTeam];
    for (const a of this.actors) {
      if (a.team === winnerTeam) a.credits += 3250;
      else a.credits += lossBonus;
      a.credits = Math.min(a.credits, 16000);
      if (a.team === winnerTeam) a.addUltPoints(1);
    }
    this.lastLossBonus = lossBonus;
    this.ui.setCredits(this.player.credits);
    this.ui.updateAbilities(this.player);

    if (this.scores.ally >= ROUNDS_TO_WIN || this.scores.enemy >= ROUNDS_TO_WIN
      || this.roundNumber >= MAX_ROUNDS) {
      this.matchOver = true;
      this.phaseTimer = 999;
    }
  }

  roundReasonText(reason) {
    switch (reason) {
      case 'eliminate': return 'TÜM RAKİPLER ELİMİNE EDİLDİ';
      case 'time': return 'SÜRE DOLDU';
      case 'explode': return 'BOMBA PATLADI';
      case 'defuse': return 'BOMBA ÇÖZÜLDÜ';
      default: return '';
    }
  }

  nextRoundOrEnd() {
    if (this.scores.ally >= ROUNDS_TO_WIN || this.scores.enemy >= ROUNDS_TO_WIN
      || this.roundNumber >= MAX_ROUNDS) {
      this.phase = 'matchEnd';
      const career = this.recordCareer();
      this.ui.showMatchEnd({
        career,
        win: this.scores.ally > this.scores.enemy,
        allyScore: this.scores.ally,
        enemyScore: this.scores.enemy,
        player: this.player,
        actors: this.actors,
      });
      document.exitPointerLock?.();
      this.ui.hideHUD();
      return;
    }
    this.startRound();
  }

  /* ================================================================ */
  /* physics helpers                                                   */
  /* ================================================================ */
  tryJump(actor) {
    if (!actor.grounded) return;
    actor.vel.y = 7.4;
    actor.grounded = false;
    audio.play('jump', { pos: actor.isPlayer ? null : actor.pos, volume: 0.35 });
  }

  applyMovement(actor, wishDir, speed, dt, { crouch = false } = {}) {
    const ground = actor.grounded;
    const accel = ground ? 62 : 14;
    const targetVX = wishDir.x * speed;
    const targetVZ = wishDir.z * speed;

    actor.vel.x += clamp(targetVX - actor.vel.x, -accel * dt, accel * dt);
    actor.vel.z += clamp(targetVZ - actor.vel.z, -accel * dt, accel * dt);

    if (wishDir.lengthSq() < 0.01 && ground) {
      const friction = 12;
      actor.vel.x -= actor.vel.x * Math.min(1, friction * dt);
      actor.vel.z -= actor.vel.z * Math.min(1, friction * dt);
    }

    const beforeY = actor.pos.y;
    actor.vel.y -= 22 * dt;

    const newX = actor.pos.x + actor.vel.x * dt;
    const newZ = actor.pos.z + actor.vel.z * dt;
    actor.pos.x = newX;
    actor.pos.z = newZ;

    // horizontal collisions
    const height = crouch ? 1.35 : ACTOR_HEIGHT;
    const boxes = this.map.boxes;
    for (const box of boxes) {
      if (box.max.y < actor.pos.y + 0.28) continue;
      if (box.min.y > actor.pos.y + height) continue;
      resolveCircleBoxXZ(actor.pos, ACTOR_RADIUS, box, height, actor.pos.y);
    }
    // spawn barriers
    if (this.spawnBarrierActive) {
      for (const b of this.barriers) {
        if (b.box.min.y > actor.pos.y + height) continue;
        resolveCircleBoxXZ(actor.pos, ACTOR_RADIUS, b.box, height, actor.pos.y);
      }
    }
    // map bounds safety
    actor.pos.x = clamp(actor.pos.x, MAP_BOUNDS.minX + 1, MAP_BOUNDS.maxX - 1);
    actor.pos.z = clamp(actor.pos.z, MAP_BOUNDS.minZ + 1, MAP_BOUNDS.maxZ - 1);

    // vertical
    actor.pos.y += actor.vel.y * dt;
    const support = this.map.supportHeight(actor.pos.x, actor.pos.z, Math.max(beforeY, actor.pos.y));
    if (actor.pos.y <= support + 0.001) {
      if (actor.vel.y < -6 && !actor.grounded && actor.isPlayer) {
        actor.landDip = Math.min(1.2, Math.abs(actor.vel.y) / 9);
        audio.play('land', { volume: 0.4 });
      } else if (actor.vel.y < -6 && actor.isBot) {
        audio.play('land', { pos: actor.pos, volume: 0.25 });
      }
      actor.pos.y = support;
      actor.vel.y = 0;
      actor.grounded = true;
    } else {
      actor.grounded = false;
    }

    if (actor.pos.y < 0) {
      actor.pos.y = 0;
      actor.vel.y = 0;
      actor.grounded = true;
    }
  }

  /** can a bot walk in a straight line between two points without hitting cover */
  isWalkableSegment(a, b) {
    const steps = Math.ceil(distance2D(a, b) / 0.5);
    if (steps <= 0) return true;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    for (let i = 0; i <= steps; i++) {
      const x = a.x + (dx * i) / steps;
      const z = a.z + (dz * i) / steps;
      for (const box of this.map.navBlockers) {
        if (box.max.y < 0.4) continue;
        if (x > box.min.x - 0.4 && x < box.max.x + 0.4 && z > box.min.z - 0.4 && z < box.max.z + 0.4) return false;
      }
    }
    return true;
  }

  hasClearSight(eyeA, eyeB) {
    if (!this.map.hasLineOfSight(eyeA, eyeB, eyeA.y, eyeB.y)) return false;
    return !this.effects.segmentBlockedByZone(eyeA, eyeB);
  }

  cameraShake(amount) {
    this.player.shake = Math.max(this.player.shake, amount);
  }

  /* ================================================================ */
  /* shooting                                                          */
  /* ================================================================ */
  aimGroundPoint(maxDist = 40) {
    const origin = this.camera.position.clone();
    const dir = this.player.getAimDirection(new THREE.Vector3());
    const hit = this.map.raycast(origin, dir, maxDist);
    const dist = hit ? Math.min(hit.distance, maxDist) : maxDist;
    const point = origin.clone().addScaledVector(dir, dist);
    if (point.y < 0.05) point.y = 0.02;
    return point;
  }

  resolveShot(shooter, origin, dir, weapon) {
    const maxDist = weapon.range === 2.3 ? 3 : Math.max(60, weapon.range * 1.8);
    const worldHit = this.map.raycast(origin, dir, maxDist);

    let bestActor = null;
    let bestActorDist = Infinity;
    let bestZone = null;
    let bestZoneDist = Infinity;

    // barriers (agent walls) block bullets
    for (const z of this.effects.zones) {
      if (z.type !== 'wall') continue;
      const inv = z.quaternion.clone().invert();
      const localOrigin = origin.clone().sub(z.pos).applyQuaternion(inv);
      const localDir = dir.clone().applyQuaternion(inv);
      if (Math.abs(localDir.z) > 1e-5) {
        const t = -localOrigin.z / localDir.z;
        if (t > 0) {
          const lx = localOrigin.x + localDir.x * t;
          const ly = localOrigin.y + localDir.y * t + z.pos.y;
          if (Math.abs(lx) < z.width / 2 && t < bestZoneDist) {
            bestZoneDist = t;
            bestZone = { distance: t, point: origin.clone().addScaledVector(dir, t) };
          }
        }
      }
    }

    for (const target of this.actors) {
      if (target === shooter || !target.alive || target.team === shooter.team) continue;
      target.updateHitBoxes();
      for (const zone of ['head', 'body', 'legs']) {
        const box = target.hitBoxes[zone];
        if (!box) continue;
        const hit = rayBoxes(origin, dir, [box], Math.min(maxDist, bestActorDist));
        if (hit && hit.t < bestActorDist) {
          // make sure a wall isn't closer
          if (worldHit && worldHit.distance < hit.t) continue;
          if (bestZone && bestZoneDist < hit.t) continue;
          bestActorDist = hit.t;
          bestActor = { actor: target, zone, point: hit.point, normal: hit.normal };
        }
      }
    }

    let endPoint;
    if (bestActor) {
      endPoint = new THREE.Vector3(bestActor.point.x, bestActor.point.y, bestActor.point.z);
      const dist = bestActorDist;
      const w = weapon;
      let dmg = w.damage;
      if (bestActor.zone === 'head') dmg *= w.headMult;
      else if (bestActor.zone === 'legs') dmg *= 0.78;
      // damage falloff with distance
      const falloffStart = w.range * 0.35;
      const falloff = clamp(1 - Math.max(0, dist - falloffStart) / (w.range * 1.4), 0.55, 1);
      dmg *= falloff;

      const hitPoint = new THREE.Vector3(bestActor.point.x, bestActor.point.y, bestActor.point.z);
      bestActor.actor.takeDamage(dmg, {
        attacker: shooter,
        weaponId: w.id,
        headshot: bestActor.zone === 'head',
        point: hitPoint,
      });

      if (shooter.isPlayer) {
        this.ui.hitmarker(bestActor.actor.health <= 0, bestActor.zone === 'head');
        audio.play(bestActor.zone === 'head' ? 'headshot' : 'hitmarker', { volume: 0.5 });
      }
      this.effects.bloodHit(hitPoint, dir.clone().multiplyScalar(-0.3));
      audio.play('impact', { volume: 0.25 });
      this.effects.tracer(this._tracerOrigin(shooter), endPoint);
      return { hit: 'actor', target: bestActor.actor, zone: bestActor.zone, point: hitPoint };
    }

    if (bestZone && (!worldHit || worldHit.distance > bestZoneDist)) {
      this.effects.impact(bestZone.point, { x: 0, y: 0, z: 1 }, 'metal');
      this.effects.tracer(this._tracerOrigin(shooter), bestZone.point);
      const wall = this.effects.zones.find((z) => z.type === 'wall');
      if (wall) wall.life = Math.max(0.4, wall.life - 0.3);
      return { hit: 'wall', point: bestZone.point };
    }

    if (worldHit) {
      endPoint = worldHit.point;
      const n = new THREE.Vector3(worldHit.normal.x, worldHit.normal.y, worldHit.normal.z);
      this.effects.impact(endPoint, worldHit.normal, worldHit.material);
      audio.play('impact', { pos: endPoint, volume: 0.28 });
      this.effects.tracer(this._tracerOrigin(shooter), endPoint);
      return { hit: 'world', point: endPoint, material: worldHit.material };
    }

    endPoint = origin.clone().addScaledVector(dir, maxDist);
    this.effects.tracer(this._tracerOrigin(shooter), endPoint);
    return { hit: 'none', point: endPoint };
  }

  _tracerOrigin(shooter) {
    if (shooter.isPlayer) {
      const p = this.camera.position.clone();
      const right = new THREE.Vector3(Math.cos(shooter.yaw), 0, -Math.sin(shooter.yaw));
      const fwd = shooter.getAimDirection(new THREE.Vector3());
      return p.addScaledVector(right, 0.18).addScaledVector(fwd, 0.5).add(new THREE.Vector3(0, -0.12, 0));
    }
    return shooter.getMuzzlePos(new THREE.Vector3());
  }

  findMeleeTarget(shooter, origin, dir, range) {
    let best = null;
    let bestT = range;
    for (const target of this.actors) {
      if (target === shooter || !target.alive || target.team === shooter.team) continue;
      target.updateHitBoxes();
      for (const zone of ['head', 'body', 'legs']) {
        const hit = rayBoxes(origin, dir, [target.hitBoxes[zone]], range);
        if (hit && hit.t < bestT) {
          bestT = hit.t;
          best = target;
        }
      }
    }
    return best;
  }

  /* ================================================================ */
  /* kills                                                             */
  /* ================================================================ */
  onKill(victim, attacker, weaponId, headshot) {
    const weapon = getWeapon(weaponId);
    const feedEntry = {
      attacker: attacker ? attacker.name : 'C4',
      attackerTeam: attacker ? attacker.team : null,
      victim: victim.name,
      victimTeam: victim.team,
      weapon: weapon.name,
      headshot,
      time: this.time,
    };
    this.killLog.push(feedEntry);
    if (this.killLog.length > 8) this.killLog.shift();
    this.ui.addKillfeed(feedEntry);

    if (attacker && attacker !== victim) {
      attacker.kills++;
      attacker.roundKills++;
      if (attacker.isPlayer) this.weaponKills[weaponId] = (this.weaponKills[weaponId] || 0) + 1;
      attacker.credits = Math.min(16000, attacker.credits + 300);
      attacker.addUltPoints(1);
      if (attacker.isPlayer) {
        this.ui.setCredits(this.player.credits);
        this.player.addUltPoints(0); // no-op keeps HUD in sync below
        this.ui.updateAbilities(this.player);
        this.multiKill = this.time - this.lastKillTime < 4.5 ? this.multiKill + 1 : 1;
        this.lastKillTime = this.time;
        const labels = ['', 'ÖLDÜRME', 'ÇİFT ÖLDÜRME', 'ÜÇLÜ ÖLDÜRME', 'DÖRTLÜ ÖLDÜRME', 'ACE!'];
        this.ui.killBanner(labels[Math.min(this.multiKill, 5)], victim.name, headshot);
        audio.play('kill', { volume: 0.8 });
        this.ui.hitmarker(true, headshot);
      }
    }

    // drop the spike
    if (victim.spikeCarrier) {
      victim.spikeCarrier = false;
      this.spike.carrier = null;
      this.spike.state = 'dropped';
      this.spike.pos.copy(victim.pos);
      this.spike.dropTime = this.time;
      this.spikeMesh.visible = true;
      this.spikeMesh.position.set(victim.pos.x, 0.02, victim.pos.z);
      this.ui.event('BOMBA DÜŞTÜ', 2.5);
    }

    if (attacker && attacker.isPlayer && victim.isPlayer) {
      // impossible but safe
    }
    if (victim.isPlayer) this.onPlayerDeath(attacker);
  }

  onPlayerDeath(attacker) {
    this.player.alive = false;
    this.player.character.alive = false;
    this.player.ads = false;
    this.player.adsHeld = false;
    this.input.fireHeld = false;
    this.player.character.root.visible = false;
    const allies = this.actors.filter((a) => a.team === this.player.team && a.alive && a !== this.player);
    this.spectateTarget = attacker && attacker.alive && attacker.team === this.player.team ? attacker : (allies[0] || null);
    this.ui.setPlayerDead(true, attacker ? attacker.name : '');
    this.ui.updateAbilities(this.player);
    if (this.buyMenuOpen) this.toggleBuyMenu(false);
  }

  recentAttacker(victim) {
    let best = null;
    let bestTime = -99;
    for (const a of this.actors) {
      if (a.lastTargetVictim === victim && a.lastShotAt > bestTime) {
        bestTime = a.lastShotAt;
        best = a;
      }
    }
    return best;
  }

  onPlayerShot(weapon) {
    // immediate HUD feedback; viewmodel recoil is applied by Viewmodel.onShoot
    this.ui.updateWeapon(this.player);
    this.player.shake = Math.min(this.player.shake + 0.05, 0.12);
  }

  /* ================================================================ */
  /* abilities                                                         */
  /* ================================================================ */
  castAbility(actor, ability, targetPoint) {
    const team = actor.team;
    const point = targetPoint ? targetPoint.clone() : null;

    switch (ability.id) {
      case 'firewall':
      case 'flash':
      case 'smoke':
      case 'blackout':
      case 'radar':
      case 'shock':
      case 'inferno2':
        if (point) this.spawnAbilityProjectile(actor, ability, point);
        break;

      case 'dash': {
        const dir = new THREE.Vector3(-Math.sin(actor.yaw), 0, -Math.cos(actor.yaw));
        actor.vel.x = dir.x * 17;
        actor.vel.z = dir.z * 17;
        actor.speedBoost = 2.4;
        this.effects.dust.spawn({
          pos: actor.pos.clone().add(new THREE.Vector3(0, 0.2, 0)), vel: new THREE.Vector3(0, 0.5, 0),
          life: 0.5, size: 1.1, grow: 2, color: 0xffb080, opacity: 0.5, blending: THREE.NormalBlending,
        });
        break;
      }

      case 'veilwall':
      case 'barrier': {
        const dir = new THREE.Vector3(-Math.sin(actor.yaw), 0, -Math.cos(actor.yaw));
        const pos = actor.pos.clone().addScaledVector(dir, 3.4);
        pos.y = 0;
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, actor.yaw, 0));
        const width = ability.id === 'veilwall' ? 7.5 : 5.5;
        const height = ability.id === 'veilwall' ? 3.6 : 2.6;
        const zone = this.effects.barrierWall(pos, q, width, height, 15);
        zone.ownerTeam = team;
        zone.blocksVision = true;
        break;
      }

      case 'recon': {
        this.effects.reconRing(actor.pos.clone(), 20);
        for (const e of this.actors) {
          if (!e.alive || e.team === team) continue;
          if (distance2D(e.pos, actor.pos) <= 20) e.revealed = Math.max(e.revealed, 5);
        }
        if (actor.team !== this.player.team) this.ui.toast('DÜŞMAN TARAMASI TESPİT EDİLDİ', 1.6);
        break;
      }

      case 'stun': {
        for (const e of this.actors) {
          if (!e.alive || e.team === team) continue;
          if (distance2D(e.pos, actor.pos) <= 12 && this.hasClearSight(actor.getEye(new THREE.Vector3()), e.getEye(new THREE.Vector3()))) {
            e.stunned = 3;
            e.slowTimer = Math.max(e.slowTimer, 2.5);
            if (e.isPlayer) { this.ui.toast('SERSEMLEDİN!', 2); this.ui.blur(1); }
          }
        }
        this.effects.reconRing(actor.pos.clone(), 12);
        break;
      }

      case 'emp': {
        for (const e of this.actors) {
          if (!e.alive || e.team === team) continue;
          e.revealed = Math.max(e.revealed, 8);
          if (distance2D(e.pos, actor.pos) < 26) {
            e.slowTimer = Math.max(e.slowTimer, 5);
            e.stunned = Math.max(e.stunned, 1.2);
          }
        }
        this.effects.reconRing(actor.pos.clone(), 30);
        this.ui.event('NABIZ DALGASI — DÜŞMANLAR İŞARETLENDİ', 3);
        break;
      }

      case 'heal': {
        // heal self or closest wounded ally in front
        let target = actor;
        const eye = actor.getEye(new THREE.Vector3());
        const dir = new THREE.Vector3(-Math.sin(actor.yaw) * Math.cos(actor.pitch), Math.sin(actor.pitch), -Math.cos(actor.yaw) * Math.cos(actor.pitch));
        let bestScore = Infinity;
        for (const a of this.actors) {
          if (!a.alive || a.team !== team) continue;
          const to = a.getEye(new THREE.Vector3()).sub(eye);
          const dist = to.length();
          if (dist > 18) continue;
          const dot = to.clone().normalize().dot(dir);
          if (dist > 2 && dot < 0.75) continue;
          const score = dist * (a === actor ? 0.5 : 1);
          if (a.health < a.maxHealth && score < bestScore) { bestScore = score; target = a; }
        }
        target.health = Math.min(target.maxHealth, target.health + 50);
        this.effects.healBurst(target.pos.clone().add(new THREE.Vector3(0, 1, 0)));
        if (target.isPlayer) this.ui.toast('+50 CAN', 1.2);
        break;
      }

      case 'shield': {
        actor.shieldHp = Math.max(actor.shieldHp, 50);
        this.effects.healBurst(actor.pos.clone().add(new THREE.Vector3(0, 1, 0)));
        break;
      }

      case 'sanctuary': {
        for (const a of this.actors) {
          if (!a.alive || a.team !== team) continue;
          if (distance2D(a.pos, actor.pos) < 14) {
            a.health = a.maxHealth;
            a.shieldHp = Math.max(a.shieldHp, 50);
            this.effects.healBurst(a.pos.clone().add(new THREE.Vector3(0, 1, 0)));
          }
        }
        this.effects.reconRing(actor.pos.clone(), 14);
        this.ui.event('KUTSAL ALAN — TAKIM YENİLENDİ', 3);
        break;
      }

      case 'inferno': {
        this.effects.explosion(actor.pos.clone().setY(1), 2);
        this.cameraShake(0.9);
        const zone = this.effects.fireZone(actor.pos.clone(), 6.5, 6);
        zone.ownerTeam = team;
        zone.damageTeam = team;
        for (const e of this.actors) {
          if (!e.alive || e.team === team) continue;
          if (distance2D(e.pos, actor.pos) < 7) {
            e.takeDamage(80, { attacker: actor, weaponId: 'ability' });
            e.slowTimer = 3;
          }
        }
        this.ui.event('CEHENNEM!', 2.5);
        break;
      }

      default:
        if (point) this.spawnAbilityProjectile(actor, ability, point);
        break;
    }
  }

  spawnAbilityProjectile(actor, ability, targetPoint) {
    const start = actor.getEye(new THREE.Vector3());
    const colors = {
      firewall: 0xff5a2c, flash: 0xfff0c0, smoke: 0xb8c4cc, blackout: 0x8f6bff,
      radar: 0x30f3c8, shock: 0x9fe8ff, inferno2: 0xff8a3c,
    };
    const geo = new THREE.SphereGeometry(0.16, 8, 8);
    const mat = new THREE.MeshBasicMaterial({ color: colors[ability.id] || 0xffffff });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(start);
    this.scene.add(mesh);
    const travelTime = ability.id === 'radar' ? 0.5 : clamp(start.distanceTo(targetPoint) / 26, 0.28, 1.0);
    this.projectiles.push({
      mesh, start: start.clone(), target: targetPoint.clone(), t: 0, travelTime,
      actor, ability, color: colors[ability.id] || 0xffffff,
    });
  }

  _resolveProjectile(p) {
    const { actor, ability } = p;
    const point = p.target;
    const team = actor.team;
    switch (ability.id) {
      case 'firewall': {
        const zone = this.effects.fireZone(point.clone().setY(0.05), 3.8, 6.5);
        zone.ownerTeam = team;
        this.effects.fireZoneDamage = true;
        audio.play('fire_whoosh', { pos: point, volume: 0.7 });
        // initial burst damage
        for (const e of this.actors) {
          if (!e.alive || e.team === team) continue;
          if (distance2D(e.pos, point) < 4) e.takeDamage(28, { attacker: actor, weaponId: 'ability' });
        }
        break;
      }
      case 'flash': {
        this.effects.flashBurst(point.clone().setY(1.2));
        audio.play('flash', { pos: point, volume: 0.9 });
        for (const e of this.actors) {
          if (!e.alive || e.team === team) continue;
          const eye = e.getEye(new THREE.Vector3());
          const dist = eye.distanceTo(point);
          if (dist > 26) continue;
          if (!this.hasClearSight(eye, point.clone().setY(1.2))) continue;
          // facing check
          const forward = new THREE.Vector3(-Math.sin(e.yaw), 0, -Math.cos(e.yaw));
          const to = point.clone().setY(1.2).sub(eye).normalize();
          const facing = forward.dot(to);
          if (facing > -0.2) {
            const power = clamp(1.6 - dist / 22, 0.35, 1.5) * (facing > 0.4 ? 1.2 : 0.7);
            e.flashTimer = Math.max(e.flashTimer, power);
            if (e.isPlayer) {
              this.ui.flash(power);
              audio.play('flash', { volume: 1 });
            }
          }
        }
        break;
      }
      case 'smoke':
      case 'blackout': {
        const big = ability.id === 'blackout';
        const zone = this.effects.smokeCloud(point.clone().setY(big ? 1.6 : 1.2), big ? 9 : 4.6, big ? 24 : 15);
        zone.ownerTeam = team;
        audio.play('smoke_pop', { pos: point, volume: 0.8 });
        break;
      }
      case 'radar': {
        this.effects.reconRing(point.clone(), 24);
        for (const e of this.actors) {
          if (!e.alive || e.team === team) continue;
          if (distance2D(e.pos, point) <= 24) e.revealed = Math.max(e.revealed, 5);
        }
        audio.play('ability', { pos: point, volume: 0.6 });
        break;
      }
      case 'shock': {
        this.effects.explosion(point.clone().setY(0.5), 1.2);
        this.effects.reconRing(point.clone(), 7);
        audio.play('explosion', { pos: point, volume: 0.6 });
        for (const e of this.actors) {
          if (!e.alive) continue;
          const d = distance2D(e.pos, point);
          if (d < 5.5) {
            const dmg = e.team === team ? 20 : 65 * (1 - d / 7);
            e.takeDamage(dmg, { attacker: actor, weaponId: 'ability' });
            e.slowTimer = Math.max(e.slowTimer, 2);
          }
        }
        if (distance2D(this.player.pos, point) < 8) this.cameraShake(0.6);
        break;
      }
      default: {
        this.effects.impact(point, { x: 0, y: 1, z: 0 }, 'concrete');
        break;
      }
    }
  }

  /* ================================================================ */
  /* spike interaction                                                 */
  /* ================================================================ */
  botTryPlant(bot, dt) {
    if (bot.team !== this.attackingTeam || !bot.spikeCarrier) return;
    const site = this.map.siteAt(bot.pos.x, bot.pos.z);
    if (!site || site.id !== this.attackSite || this.spike.state === 'planted') return;
    // planting is only interrupted by real pressure: taking fire, or a defender
    // close enough to trade. Distant defenders no longer stall the objective.
    const sinceHit = this.time - (bot.lastDamageTime ?? -99);
    const closeThreat = sinceHit < 1.5
      || this.actors.some((e) => e.alive && e.team !== bot.team && distance2D(bot.pos, e.pos) < 5.5 && bot.canSee(e));
    if (closeThreat) return;
    bot.plantTimer += dt;
    if (bot.plantTimer > PLANT_TIME) {
      bot.plantTimer = 0;
      this.plantSpike(bot);
    }
  }

  botTryDefuse(bot, dt) {
    if (bot.team === this.attackingTeam || !this.spike.state || this.spike.state !== 'planted') return;
    if (distance2D(bot.pos, this.spike.pos) > 1.7) {
      if (this.spike.defuserId === bot.id) {
        this.spike.defuserId = null;
        this.spike.defuseProgress = 0;
        this.updateDefuseProgressUI(null);
      }
      return;
    }
    // shoot first if an enemy is very close
    if (bot.state === 'engage' && bot.target && distance2D(bot.pos, bot.target.pos) < 6) return;
    if (this.spike.defuserId !== bot.id) {
      this.spike.defuserId = bot.id;
      this.spike.defuseProgress = 0;
      audio.play('defuse_start', { pos: bot.pos, volume: 0.6 });
    }
    this.spike.defuseProgress += dt;
    const defuseTime = this.defuseDuration(bot);
    this.updateDefuseProgressUI(this.spike.defuseProgress / defuseTime);
    if (this.spike.defuseProgress >= defuseTime) {
      this.spike.defuseProgress = 0;
      this.spike.defuserId = null;
      this.defuseSpike(bot);
    }
  }

  updatePlayerInteract(dt) {
    const p = this.player;
    if (!p.alive) {
      this.updatePlantProgressUI(null);
      this.updateDefuseProgressUI(null);
      this.ui.interactHint(null);
      return;
    }
    const holding = this.input.interact;

    // ----- planting -----
    if (this.attackingTeam === p.team && p.spikeCarrier && (this.spike.state === 'carried' || this.spike.state === 'dropped' && this.spike.carrier === p)) {
      const site = this.map.siteAt(p.pos.x, p.pos.z);
      if (site && site.id === this.attackSite) {
        if (holding) {
          this.spike.plantProgress += dt;
          this.updatePlantProgressUI(this.spike.plantProgress / PLANT_TIME);
          if (this.spike.plantProgress >= PLANT_TIME) {
            this.spike.plantProgress = 0;
            this.updatePlantProgressUI(null);
            this.plantSpike(p);
          }
        } else if (this.spike.plantProgress > 0) {
          this.spike.plantProgress = 0;
          this.updatePlantProgressUI(null);
        }
        if (this.spike.plantProgress === 0) this.ui.interactHint('[F] SPIKE\'I KUR');
        return;
      } else {
        this.ui.interactHint('C4\'Ü KURMAK İÇİN BÖLGEYE GİT');
      }
      this.updatePlantProgressUI(null);
    } else {
      this.updatePlantProgressUI(null);
    }

    // ----- defusing -----
    if (this.spike.state === 'planted' && this.attackingTeam !== p.team) {
      const dist = distance2D(p.pos, this.spike.pos);
      if (dist < 1.8) {
        if (holding) {
          if (this.spike.defuserId !== p.id) {
            this.spike.defuserId = p.id;
            this.spike.defuseProgress = 0;
            audio.play('defuse_start', { volume: 0.7 });
          }
          this.spike.defuseProgress += dt;
          const dur = this.defuseDuration(this.player);
          this.updateDefuseProgressUI(this.spike.defuseProgress / dur);
          if (this.spike.defuseProgress >= dur) {
            this.spike.defuseProgress = 0;
            this.spike.defuserId = null;
            this.updateDefuseProgressUI(null);
            this.defuseSpike(p);
          }
        } else {
          if (this.spike.defuserId === p.id) {
            this.spike.defuserId = null;
            this.spike.defuseProgress = 0;
            this.updateDefuseProgressUI(null);
          }
          this.ui.interactHint(`[F] BOMBAYI ÇÖZ — ${this.defuseDuration(this.player)} SANİYE${this.player.kit ? ' (KIT)' : ''}`);
        }
        return;
      } else {
        this.ui.interactHint(null);
        if (this.spike.defuserId === p.id) {
          this.spike.defuserId = null;
          this.spike.defuseProgress = 0;
          this.updateDefuseProgressUI(null);
        }
      }
    } else {
      this.ui.interactHint(null);
      this.updateDefuseProgressUI(null);
    }
  }

  updatePlantProgressUI(p) { this.ui.plantProgress(p); }
  updateDefuseProgressUI(p) { this.ui.defuseProgress(p); }

  /* ================================================================ */
  /* bot helpers                                                       */
  /* ================================================================ */
  attackPointForBot(bot) {
    if (bot.holdSpot) return bot.holdSpot;
    const site = this.sites[this.attackSite];
    return { x: site.center.x + rand(-4, 4), z: site.center.z + rand(-4, 4) };
  }

  assignHoldSpot(bot) {
    const siteId = this.attackSite;
    const spots = [...(HOLD_SPOTS[siteId] || []), ...HOLD_SPOTS.mid];
    const spot = choice(spots);
    return { x: spot.x, z: spot.z, look: spot.look, site: siteId };
  }

  /* ================================================================ */
  /* main loop                                                         */
  /* ================================================================ */
  start() {
    if (this.running) return;
    this.running = true;
    this.lastFrame = performance.now();
    this.ui.showHUD(true);
    this.ui.setMapName?.('DUNE');
    const loop = (now) => {
      if (!this.running) return;
      let dt = (now - this.lastFrame) / 1000;
      this.lastFrame = now;
      dt = Math.min(dt, 0.06);
      this.lastDt = dt;
      if (!this.paused) this.update(dt);
      this.render();
      this._raf = requestAnimationFrame(loop);
    };
    if (this.headless) return;
    this._raf = requestAnimationFrame(loop);
    audio.startMusic('match');
  }

  stop() {
    if (!this.running) return;
    this.running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    for (const [target, event, fn, opts] of this._boundHandlers) {
      target.removeEventListener(event, fn, opts);
    }
    this._boundHandlers = [];
    document.exitPointerLock?.();
    audio.stopMusic();
    this.effects?.clearZones();
    this.renderer?.dispose();
  }

  update(dt) {
    this.time += dt;
    if (this.player?.alive) this.ui?.updateCrosshairDynamics?.(this.player);
    this.playerInBuyZone = this.inBuyZone(this.player);

    // buy-phase timer
    if (this.phase === 'buy') {
      this.phaseTimer -= dt;
      this.botBuyTimer -= dt;
      if (this.botBuyTimer <= 0) {
        this.botBuyTimer = 999;
        for (const a of this.actors) {
          if (a.isBot) a.autoBuy(this.roundNumber);
        }
      }
      if (this.phaseTimer <= 0) this.beginLive();
    } else if (this.phase === 'live') {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) {
        this.endRound(this.attackingTeam === 'ally' ? 'enemy' : 'ally', 'time');
      }
    } else if (this.phase === 'planted') {
      this.phaseTimer -= dt;
      this.spike.timer = this.phaseTimer;
      this.spike.beepTimer -= dt;
      if (this.spike.beepTimer <= 0) {
        const urgency = clamp(1 - this.phaseTimer / SPIKE_TIME, 0, 1);
        this.spike.beepTimer = 0.18 + (1 - urgency) * 0.95;
        audio.play('spike_beep', { pos: this.spike.pos, volume: 0.8 });
        const s = 1 + (1 - urgency) * 0.6;
        this.spikeCore.scale.setScalar(s);
      }
      this.spikeLight.intensity = 1.6 + Math.sin(this.time * 8) * 1.2;
      if (this.spikeHalo) {
        const u = clamp(1 - this.phaseTimer / SPIKE_TIME, 0, 1);
        this.spikeHalo.scale.setScalar(1 + Math.sin(this.time * (3 + u * 9)) * 0.12 + u * 0.22);
        this.spikeHalo.material.opacity = 0.45 + u * 0.45;
      }
      if (this.spikeGlowMat) {
        const u = clamp(1 - this.phaseTimer / SPIKE_TIME, 0, 1);
        this.spikeGlowMat.emissiveIntensity = 1.8 + u * 3.4;
      }
      if (this.phaseTimer <= 0) this.explodeSpike();
    } else if (this.phase === 'roundEnd') {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0 && this.matchOver) {
        this.nextRoundOrEnd();
      } else if (this.phaseTimer <= 0) {
        this.nextRoundOrEnd();
      }
    }

    // actors
    for (const actor of this.actors) {
      if (actor.isPlayer) {
        actor.update(dt, this.input);
      } else {
        actor.update(dt);
        actor.character.update(dt, this.camera, this);
      }
      actor.updateHitBoxes();
    }
    this.player.character.update(dt, this.camera, this);
    this.player.character.root.visible = false;

    // projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.t += dt;
      const k = clamp(p.t / p.travelTime, 0, 1);
      const pos = p.start.clone().lerp(p.target, k);
      pos.y += Math.sin(k * Math.PI) * clamp(p.start.distanceTo(p.target) * 0.18, 0.4, 5);
      p.mesh.position.copy(pos);
      p.mesh.rotation.y += dt * 6;
      const col = new THREE.Color(p.color);
      this.effects.glow.spawn({
        pos: pos.clone(), vel: new THREE.Vector3(0, 0, 0), life: 0.18,
        size: 0.22, color: col.getHex(), opacity: 0.7,
      });
      if (k >= 1) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
        this._resolveProjectile(p);
        this.projectiles.splice(i, 1);
      }
    }

    // fire zone damage ticks
    for (const z of this.effects.zones) {
      if (z.type !== 'fire') continue;
      z.tick = (z.tick || 0) - dt;
      if (z.tick <= 0) {
        z.tick = 0.45;
        for (const a of this.actors) {
          if (!a.alive || a.team === z.ownerTeam) continue;
          if (distance2D(a.pos, z.pos) < z.radius) {
            a.takeDamage(9, { attacker: null, weaponId: 'fire' });
            a.slowTimer = Math.max(a.slowTimer, 0.7);
          }
        }
      }
    }

    // smoke zone regen / expiry handled in effects.update
    this.effects.update(dt);

    // spike retrieval assignment (bots walk to a dropped spike)
    if (this.spike.state === 'dropped' && !this.spike.carrier) {
      let best = null;
      let bestD = Infinity;
      for (const a of this.actors) {
        if (!a.alive || a.team !== this.attackingTeam) continue;
        const d = distance2D(a.pos, this.spike.pos);
        if (d < bestD) { bestD = d; best = a; }
      }
      this.spikeRetriever = best;
    } else {
      this.spikeRetriever = null;
    }

    // spike pickup
    if ((this.spike.state === 'carried' || this.spike.state === 'dropped') && this.spike.carrier === null) {
      for (const a of this.actors) {
        if (!a.alive || a.team !== this.attackingTeam) continue;
        if (distance2D(a.pos, this.spike.pos) < 1.9) {
          a.spikeCarrier = true;
          this.spike.carrier = a;
          this.spike.state = 'carried';
          this.spikeMesh.visible = false;
          this.ui.event(`${a.name} spike'ı aldı`, 2.4);
          if (a.isPlayer) this.ui.toast('SPIKE SENDE — BÖLGEYE GİT', 2);
          else this.ui.event(`${a.name} spike'ı geri aldı`, 2.4);
          break;
        }
      }
    }

    // carried spike follows the carrier
    if (this.spike.state === 'carried' && this.spike.carrier) {
      const c = this.spike.carrier;
      this.spike.pos.copy(c.pos);
      if (c.isPlayer) {
        // show a subtle marker hint
      }
    }

    // player interaction (plant / defuse)
    this.updatePlayerInteract(dt);

    // round end checks
    if (this.phase === 'live' || this.phase === 'planted') {
      const attackers = this.actors.filter((a) => a.team === this.attackingTeam);
      const defenders = this.actors.filter((a) => a.team !== this.attackingTeam);
      const attackersAlive = attackers.filter((a) => a.alive).length;
      const defendersAlive = defenders.filter((a) => a.alive).length;
      if (defendersAlive === 0) {
        this.endRound(this.attackingTeam, 'eliminate');
      } else if (attackersAlive === 0 && this.phase === 'live') {
        const defenderTeam = this.attackingTeam === 'ally' ? 'enemy' : 'ally';
        this.endRound(defenderTeam, 'eliminate');
      }
    }

    // spawn barriers are only solid + visible during the buy phase
    for (const b of this.barriers) {
      b.mesh.visible = this.spawnBarrierActive;
      b.mat.opacity = 0.45 + Math.sin(this.time * 3) * 0.1;
    }

    // shop / HUD ticks
    if (this.phase === 'buy' || this.phase === 'live') {
      this.ui.setTimer(Math.ceil(this.phaseTimer), PHASE_LABEL[this.phase], this.phaseTimer <= 10);
    } else if (this.phase === 'planted') {
      this.ui.setTimer(Math.ceil(this.phaseTimer), 'SPIKE', true);
    } else if (this.phase === 'roundEnd') {
      this.ui.setTimer(Math.max(0, Math.ceil(this.phaseTimer)), 'TUR SONU', false);
    }

    this.ui.updateHUDTick(dt, this);

    // spectator camera follow
    if (!this.player.alive && this.phase !== 'matchEnd') {
      const allies = this.actors.filter((a) => a.team === this.player.team && a.alive && a !== this.player);
      if (this.spectateTarget && !this.spectateTarget.alive) this.spectateTarget = null;
      if (!this.spectateTarget && allies.length) this.spectateTarget = allies[0];
    }

    // camera
    this.updateCamera(dt);
    this.map.update(dt, this.camera);
    audio.setListener(this.camera.position.x, this.camera.position.z, this.player.yaw);
  }

  updateCamera(dt) {
    const p = this.player;
    if (p.alive) {
      p.updateCamera(this.camera, dt);
      this.ui.setScope(p.scoped);
    } else {
      const target = this.spectateTarget;
      if (target) {
        const eye = target.getEye(new THREE.Vector3());
        this.camera.position.lerp(eye, 1 - Math.pow(0.001, dt));
        this.camera.rotation.set(p.getCameraPitch(), p.yaw, 0, 'YXZ');
        this.ui.setSpectate(`İZLENİYOR: <b>${target.name}</b> · ${target.agent.name}`);
      } else {
        const eye = new THREE.Vector3(this.spike.pos.x, 3.2, this.spike.pos.z);
        this.camera.position.lerp(eye, 1 - Math.pow(0.6, dt));
        this.camera.rotation.set(-0.35, p.yaw, 0, 'YXZ');
        this.ui.setSpectate('TAKIM ELİMİNE EDİLDİ');
      }
      this.ui.setScope(false);
      this.camera.fov = 90;
      this.camera.updateProjectionMatrix();
    }
  }

  render() {
    const r = this.renderer;
    r.clear();
    r.render(this.scene, this.camera);
    if (this.player.alive && !this.player.scoped && !this.matchOver) {
      this.viewmodel.update(this.lastDt || 1 / 60, this.player.viewmodelState());
      this.viewmodel.render(r, this.camera.aspect);
    }
  }

  /* ================================================================ */
  /* data for UI                                                       */
  /* ================================================================ */
  /** CS buy zone: only the spawn area of your own side lets you shop. */
  inBuyZone(actor = this.player) {
    if (!actor || !actor.alive) return false;
    const spawnList = actor.team === 'ally'
      ? (this.attackingTeam === 'ally' ? SPAWNS.attacker : SPAWNS.defender)
      : (this.attackingTeam === 'ally' ? SPAWNS.defender : SPAWNS.attacker);
    const maxD = (CURRENT_MAP?.buyZoneRadius || 9) ** 2;
    for (const sp of spawnList) {
      const dx = actor.pos.x - sp.x;
      const dz = actor.pos.z - sp.z;
      if (dx * dx + dz * dz < maxD) return true;
    }
    return false;
  }

  /** defuse time depends on the kit, exactly like CS */
  defuseDuration(actor) {
    return actor?.kit ? DEFUSE_TIME_KIT : DEFUSE_TIME;
  }

  isPistolRound() {
    return this.roundNumber === 1 || this.roundNumber === this.halfStart;
  }

  buyData() {
    const p = this.player;
    const inBuyZone = this.phase === 'buy' || (this.playerInBuyZone && this.player.alive);
    return {
      credits: p.credits,
      weapons: p,
      groups: BUY_GROUPS,
      grenades: p.agent.abilities.map((ab) => ({
        ...ab,
        state: p.abilityState[ab.id],
        owned: p.abilityState[ab.id].charges,
        max: p.abilityState[ab.id].maxCharges,
      })),
      armor: p.armor,
      helmet: p.helmet,
      kit: !!p.kit,
      canBuyKit: p.team !== this.attackingTeam,
      slot: p.currentSlot,
      canBuy: inBuyZone,
      timeLeft: Math.max(0, Math.ceil(this.phaseTimer)),
      grenadeCount: p.grenadeCount?.() ?? 0,
      primary: p.slots[1] ? getWeapon(p.slots[1]) : null,
      secondary: p.slots[2] ? getWeapon(p.slots[2]) : null,
      pistolRound: this.isPistolRound?.() ?? false,
    };
  }

  /** CS shop: a weapon can only be bought while standing in the buy zone. */
  buyWeapon(id) {
    const p = this.player;
    const w = getWeapon(id);
    if (!w || !w.buyable) return false;
    if (this.phase !== 'buy' && !this.playerInBuyZone) return false;
    if (p.credits < w.price) return false;
    if (p.slots[1] === id || p.slots[2] === id) return false;
    p.credits -= w.price;
    p.giveWeapon(id);
    audio.play('buy', { volume: 0.6 });
    this.ui.setCredits(p.credits);
    this.ui.setWeaponName(p.activeWeapon.name);
    this.ui.updateWeapon(p);
    this.ui.showBuyMenu(true, this.buyData());
    return true;
  }

  /** Kevlar 650 · Kevlar + Helmet 1000 — CS pricing, refills partial armour. */
  buyArmor(type) {
    const p = this.player;
    if (type === 'helmet') {
      // CS pricing: assault suit 1000, or just the 350 helmet upgrade over kevlar
      const price = p.armor > 0 ? 350 : 1000;
      if (p.armor >= 100 && p.helmet) return false;
      if (p.credits < price) return false;
      p.credits -= price;
      p.armor = 100;
      p.helmet = true;
    } else {
      if (p.armor >= 100) return false;
      if (p.credits < 650) return false;
      p.credits -= 650;
      p.armor = 100;
    }
    audio.play('buy', { volume: 0.6 });
    this.ui.setCredits(p.credits);
    this.ui.showBuyMenu(true, this.buyData());
    return true;
  }

  /** Defuse kit — 400$, halves the defuse time (CT only, like CS). */
  buyKit() {
    const p = this.player;
    if (p.kit) return false;
    if (p.credits < 400) return false;
    if (p.team === this.attackingTeam) return false;
    p.credits -= 400;
    p.kit = true;
    audio.play('buy', { volume: 0.6 });
    this.ui.setCredits(p.credits);
    this.ui.showBuyMenu(true, this.buyData());
    return true;
  }

  buyAbility(id) {
    const p = this.player;
    if (p.buyAbility(id)) {
      audio.play('buy', { volume: 0.6 });
      this.ui.setCredits(p.credits);
      this.ui.updateAbilities(p);
      this.ui.showBuyMenu(true, this.buyData());
      return true;
    }
    audio.play('dryfire', { volume: 0.35 });
    return false;
  }

  /** Re-apply equipped skins to the viewmodel and every visible actor. */
  refreshSkins() {
    const map = this.settings?.skins || {};
    this.viewmodel?.setSkinMap?.(map);
    if (this.player?.activeWeapon) this.viewmodel?.setWeapon?.(this.player.activeWeapon.id);
    for (const a of this.actors) a.refreshSkin?.(map);
  }

  /** Fold the finished match into the persistent career profile. */
  recordCareer() {
    const p = this.player;
    const draw = this.scores.ally === this.scores.enemy;
    const profile = recordMatch({
      map: CURRENT_MAP?.id || 'de_dust2',
      win: this.scores.ally > this.scores.enemy,
      draw,
      allyScore: this.scores.ally,
      enemyScore: this.scores.enemy,
      rounds: this.roundNumber,
      roundsWon: this.scores.ally,
      weapons: this.weaponKills,
      aces: this.aceCount,
      mvp: this.scores.ally > this.scores.enemy && p.kills >= Math.max(10, this.roundNumber),
      player: {
        kills: p.kills,
        deaths: p.deaths,
        assists: p.assists || 0,
        headshots: p.shotStats.headshots,
        shots: p.shotStats.shots,
        hits: p.shotStats.hits,
        damage: Math.round(p.damageDealt),
        plants: p.stats.plants,
        defuses: p.stats.defuses,
      },
    });
    this.lastCareer = profileSummary(profile);
    return this.lastCareer;
  }

  scoreboardData() {
    const rows = (team) => this.actors
      .filter((a) => a.team === team)
      .sort((a, b) => b.kills - a.kills)
      .map((a) => ({
        name: a.name,
        agent: a.agent.name,
        kills: a.kills,
        deaths: a.deaths,
        damage: Math.round(a.damageDealt),
        alive: a.alive,
        me: a.isPlayer,
        credits: a.credits,
      }));
    return {
      ally: rows('ally'),
      enemy: rows('enemy'),
      allyScore: this.scores.ally,
      enemyScore: this.scores.enemy,
      round: this.roundNumber,
      attackingTeam: this.attackingTeam,
    };
  }

  restartMatch() {
    this.scores = { ally: 0, enemy: 0 };
    this.roundNumber = 0;
    this.lossStreak = { ally: 0, enemy: 0 };
    this.weaponKills = {};
    this.halfStart = 13;
    this.playerInBuyZone = true;
    this.roundHistory = [];
    this.matchOver = false;
    this.attackingTeam = 'ally';
    this.spectateTarget = null;
    this.paused = false;
    this.ui.showMatchEnd(null);
    this.ui.showHUD(true);
    for (const a of this.actors) {
      a.credits = 800;
      a.kills = 0;
      a.deaths = 0;
      a.damageDealt = 0;
      a.armor = 0;
      a.slots = { 1: null, 2: 'glock', 3: 'knife' };
      a.ammo = { glock: { mag: WEAPONS.glock.mag, reserve: WEAPONS.glock.reserve } };
      a.currentSlot = 2;
      for (const ab of a.agent.abilities) {
        const st = a.abilityState[ab.id];
        st.charges = 0;
        st.ultPoints = 0;
        st.cooldown = 0;
      }
      a.character.setWeapon('glock');
    }
    this.startRound();
    this.start();
  }
}
