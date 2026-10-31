import { AGENT_LIST, AGENTS, agentPortraitSVG } from '../game/agents.js';
import {
  MAP_ART, WEAPON_SKINS, skinImageUrl, loadImagePlain, detectCdn,
} from '../game/csgoAssets.js';
import { THEMES, MAPS, MAP_BY_ID, CURRENT_MAP, applyMap, worldToRadar } from '../world/mapLayout.js';
import { BUY_ORDER, BUY_GROUPS, WEAPONS, weaponIconSVG } from '../game/weapons.js';
import { WALLS, PROPS, SITES, SPAWNS, MAP_BOUNDS } from '../world/mapLayout.js';
import { WeaponPreview } from './weaponPreview.js';
import { skinFloat, wearLabel } from '../game/skins.js';
import { skinThumbnail } from './skinThumb.js';
import { audio } from '../core/audio.js';
import { profileSummary, loadProfile, resetProfile, statTrakCount } from '../game/profile.js';
import { WEAPONS as CS_WEAPONS } from '../game/weapons.js';
import { clamp, fmtTime, distance2D } from '../core/utils.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const DEFAULT_SETTINGS = {
  sens: 0.45,
  fov: 90,
  volume: 0.7,
  music: 0.35,
  quality: 'medium',
  chColor: '#5dff9a',
  chDotColor: '#ffffff',
  chGap: 6,
  botDifficulty: 'normal',
  chThick: 2,
  chOutline: true,
  chDynamic: true,
  chLen: 7,
  chDot: true,
  agentId: 'phoenix',
  map: 'de_dust2',
  botDifficulty: 'normal',
  theme: 'dune',
  skins: {},
};

export class UI {
  constructor({ onStartMatch, onExitToMenu, settings }) {
    this.onStartMatch = onStartMatch;
    this.onExitToMenu = onExitToMenu;
    this.settings = Object.assign({}, DEFAULT_SETTINGS, settings || {});
    this.game = null;
    this.selectedAgent = this.settings.agentId || 'phoenix';
    this.agentCardEls = new Map();
    this.killfeedEntries = [];
    this.hudAcc = 0;
    this.minimapAcc = 0;
    this.toastTimer = null;
    this.bannerTimer = null;
    this.killBannerTimer = null;
    this.eventTimer = null;
    this.flashLevel = 0;
    this.damageLevel = 0;
    this.blurLevel = 0;
    this.pausedScreen = false;
    this.vaultWeapon = 'ak47';
    this.menuSlide = 0;
    this.menuSlideTimer = null;
    this.cdn = 'unknown';

    this._cacheEls();
    this._initMenus();
    this._initSettings();
    this._initCrosshair();
    this.initMinimap();
    this._initAuthenticArt();
  }

  /* ================================================================ */
  _cacheEls() {
    this.el = {
      loading: $('#loading'), loadFill: $('#load-fill'), loadText: $('#load-text'),
      mainMenu: $('#main-menu'), agentSelect: $('#agent-select'), howto: $('#howto'),
      settings: $('#settings'), hud: $('#hud'), buyMenu: $('#buy-menu'), pause: $('#pause-menu'),
      scoreboard: $('#scoreboard'), matchEnd: $('#match-end'), clickToPlay: $('#click-to-play'),
      hpFill: $('#hp-fill'), hpText: $('#hp-text'), armorFill: $('#armor-fill'), armorText: $('#armor-text'),
      credits: $('#credits'), ammoMag: $('#ammo-mag'), ammoReserve: $('#ammo-reserve'),
      ammoPanel: $('#ammo-panel'), weaponName: $('#weapon-name'), weaponSkin: $('#weapon-skin'), weaponSlots: $('#weapon-slots'),
      scoreAlly: $('#score-ally'), scoreEnemy: $('#score-enemy'), timer: $('#timer'),
      phaseLabel: $('#phase-label'), roundPips: $('#round-pips'), killfeed: $('#killfeed'),
      eventFeed: $('#event-feed'), banner: $('#round-banner'), bannerSub: $('#round-banner .rb-sub'),
      bannerTitle: $('#round-banner .rb-title'), toast: $('#center-toast'),
      plantProgress: $('#plant-progress'), defuseProgress: $('#defuse-progress'),
      spectate: $('#spectate-note'), interact: $('#interact-hint'), killBanner: $('#kill-banner'),
      minimap: $('#minimap'), spikeMini: $('#spike-mini'), abilities: $('#abilities'),
      scope: $('#scope-overlay'), crosshair: $('#crosshair'), hitmarker: $('#hitmarker'),
      damageVignette: $('#damage-vignette'), flashOverlay: $('#flash-overlay'),
      buyWeapons: $('#buy-weapons'), buyGear: $('#buy-gear'), buyCredits: $('#buy-credits'),
      buySummary: $('#buy-summary'),
      weaponStatTrak: $('#weapon-stattrak'),
      careerPanel: $('#career-panel'), careerBody: $('#career-body'), meCareer: $('#me-career'),
      sbAllies: $('#sb-allies'), sbEnemies: $('#sb-enemies'), sbScore: $('#sb-score'),
      agentGrid: $('#agent-grid'), adName: $('#ad-name'), adRole: $('#ad-role'), adDesc: $('#ad-desc'),
      adAbilities: $('#ad-abilities'), adArt: $('#ad-art'), adDmg: $('#ad-stat-dmg'),
      adMob: $('#ad-stat-mob'), adSup: $('#ad-stat-sup'), asSide: $('#as-side'),
      portraitMini: $('#agent-portrait-mini'),
      meTitle: $('#me-title'), meScore: $('#me-score'), meStats: $('#me-stats'), meEyebrow: $('#me-eyebrow'),
      canvas: $('#game-canvas'),
      // authentic art
      menuArt: $('#menu-art'), loadArt: $('#load-art'), adArtImg: $('#ad-art-img'),
      skinVault: $('#skin-vault'), svWeapons: $('#sv-weapons'), svSkins: $('#sv-skins'),
      svCanvas: $('#sv-canvas'), svStageSkin: $('#sv-stage-skin'), svStageWeapon: $('#sv-stage-weapon'),
      svHint: $('#sv-hint'), vaultStatus: $('#vault-status'),
      mapsGallery: $('#maps-gallery'), mapsGrid: $('#maps-grid'),
      btnSkins: $('#btn-skins'), btnMaps: $('#btn-maps'), btnCareer: $('#btn-career'),
      btnVaultBack: $('#btn-vault-back'),
      btnVaultNone: $('#btn-vault-none'), btnMapsClose: $('#btn-maps-close'),
    };
    this.mm = this.el.minimap?.getContext('2d');
  }

  isTyping() {
    const el = document.activeElement;
    return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT');
  }

  isMenuOpen() {
    return (!this.el.mainMenu.classList.contains('hidden')) ||
      (!this.el.agentSelect.classList.contains('hidden')) ||
      (!this.el.loading.classList.contains('hidden')) ||
      !!this.el.skinVault && !this.el.skinVault.classList.contains('hidden');
  }

  isOverlayOpen() {
    return !this.el.howto.classList.contains('hidden') ||
      !this.el.settings.classList.contains('hidden') ||
      !this.el.matchEnd.classList.contains('hidden') ||
      this.isMenuOpen();
  }

  /* ================================================================ */
  /* loading                                                           */
  /* ================================================================ */
  setLoading(progress, text) {
    if (this.el.loadFill) this.el.loadFill.style.width = `${Math.round(progress * 100)}%`;
    if (text && this.el.loadText) this.el.loadText.textContent = text;
  }

  hideLoading() {
    const el = this.el.loading;
    if (!el) return;
    el.classList.add('fade');
    setTimeout(() => el.classList.add('hidden'), 460);
  }

  showMenu() {
    this.el.mainMenu.classList.remove('hidden');
    this.el.agentSelect.classList.add('hidden');
    this.el.hud.classList.add('hidden');
    this.el.matchEnd.classList.add('hidden');
    this.el.pause.classList.add('hidden');
    this.el.buyMenu.classList.add('hidden');
    this.el.scoreboard.classList.add('hidden');
    this.el.skinVault?.classList.add('hidden');
    this.el.mapsGallery?.classList.add('hidden');
    this.stage?.stop();
    document.body.classList.remove('playing');
    this.setMenuStats();
    if (this.stats) {
      $('#stat-agents').textContent = AGENT_LIST.length;
      $('#stat-weapons').textContent = BUY_ORDER.length + 2;
    }
  }

  setMenuStats() {
    $('#stat-agents').textContent = AGENT_LIST.length;
    $('#stat-weapons').textContent = BUY_ORDER.length + 2;
  }

  /* ================================================================ */
  /* menu wiring                                                       */
  /* ================================================================ */
  _initMenus() {
    const el = this.el;

    const openHowto = () => { el.howto.classList.remove('hidden'); audio.play('ui_click'); };
    const closeHowto = () => { el.howto.classList.add('hidden'); audio.play('ui_click'); };
    const openSettings = () => { el.settings.classList.remove('hidden'); audio.play('ui_click'); };
    const closeSettings = () => { el.settings.classList.add('hidden'); audio.play('ui_click'); };

    $('#btn-play').addEventListener('click', () => {
      audio.play('ui_click');
      this.showAgentSelect();
    });
    $('#btn-howto').addEventListener('click', openHowto);
    $('#btn-howto-foot').addEventListener('click', openHowto);
    $('#btn-howto-close').addEventListener('click', closeHowto);
    $('#btn-menu-settings').addEventListener('click', openSettings);
    $('#btn-settings-foot').addEventListener('click', openSettings);
    $('#btn-settings-close').addEventListener('click', () => {
      closeSettings();
      this.applySettingsToGame();
    });
    $('#btn-pause-settings').addEventListener('click', openSettings);
    $('#btn-resume').addEventListener('click', () => this.game?.togglePause(false));
    $('#btn-leave').addEventListener('click', () => this.game?.leaveMatch());
    $('#buy-close').addEventListener('click', () => this.game?.toggleBuyMenu(false));
    $('#btn-rematch').addEventListener('click', () => {
      el.matchEnd.classList.add('hidden');
      this.game?.restartMatch();
    });
    $('#btn-exit').addEventListener('click', () => {
      el.matchEnd.classList.add('hidden');
      this.game?.leaveMatch();
    });
    $('#btn-lock').addEventListener('click', () => {
      audio.play('ui_click');
      this.startMatch();
    });
    el.clickToPlay.addEventListener('click', () => {
      el.clickToPlay.classList.add('hidden');
      this.game?.requestLock();
    });

    // hover sounds
    for (const btn of $$('button')) {
      btn.addEventListener('mouseenter', () => audio.play('ui_hover'));
    }

    this._buildAgentCards();
    this.showAgentDetail(this.selectedAgent);

    this.el.hud.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('click', () => audio.init(), { once: true });
    document.addEventListener('keydown', () => audio.init(), { once: true });
    document.addEventListener('pointerdown', () => audio.resume(), { once: true });
  }

  /* ---------------------------------------------------------------- */
  _buildAgentCards() {
    const grid = this.el.agentGrid;
    grid.innerHTML = '';
    AGENT_LIST.forEach((agent, i) => {
      const card = document.createElement('button');
      card.className = 'agent-card' + (agent.id === this.selectedAgent ? ' selected' : '');
      card.innerHTML = `
        ${this.agentArtHTML(agent.id)}
        <div class="ac-scrim"></div>
        <div class="ac-key">0${i + 1}</div>
        <div class="ac-check">✓</div>
        <div class="ac-role">${agent.role}</div>
        <div class="ac-name">${agent.name}</div>
      `;
      card.addEventListener('click', () => {
        this.selectedAgent = agent.id;
        audio.play('ui_click');
        this.agentCardEls.forEach((c, id) => c.classList.toggle('selected', id === agent.id));
        this.showAgentDetail(agent.id);
      });
      card.addEventListener('mouseenter', () => audio.play('ui_hover'));
      grid.appendChild(card);
      this.agentCardEls.set(agent.id, card);
    });
  }

  showAgentDetail(agentId) {
    const agent = AGENTS[agentId];
    if (!agent) return;
    this.el.adArt.innerHTML = agentPortraitSVG(agentId, 260);
    this.el.adRole.textContent = agent.role;
    this.el.adName.textContent = agent.name;
    this.el.adDesc.textContent = agent.desc;
    this.el.adAbilities.innerHTML = agent.abilities.map((ab) => `
      <div class="ad-ab">
        <div class="k">${ab.key}</div>
        <div>
          <div class="ab-n">${ab.icon} ${ab.name}${ab.ultimate ? ' <span style="color:var(--gold)">[ULT]</span>' : ''}</div>
          <div class="ab-d">${ab.desc}</div>
        </div>
      </div>
    `).join('');
    this.el.adDmg.style.width = `${agent.stats.dmg}%`;
    this.el.adMob.style.width = `${agent.stats.mob}%`;
    this.el.adSup.style.width = `${agent.stats.sup}%`;
  }

  showAgentSelect() {
    this.el.mainMenu.classList.add('hidden');
    this.el.agentSelect.classList.remove('hidden');
    this.showAgentDetail(this.selectedAgent);
    const map = MAP_BY_ID[this.settings.map] || MAPS[0];
    const side = (AGENTS[this.selectedAgent]?.team === 'CT') ? 'CT' : 'T';
    this.el.asSide.innerHTML = `TARAF: <b>${side}</b> · HARİTA: <b>${map.name}</b>`;
  }

  /* ================================================================ */
  /* settings                                                          */
  /* ================================================================ */
  _initSettings() {
    const s = this.settings;
    const set = (id, val) => { const e = $(id); if (e) e.value = val; };
    const out = (id, val) => { const e = $(id); if (e) e.textContent = val; };

    set('#set-sens', s.sens); out('#out-sens', s.sens.toFixed(2));
    set('#set-fov', s.fov); out('#out-fov', s.fov);
    set('#set-vol', s.volume); out('#out-vol', s.volume.toFixed(2));
    set('#set-music', s.music); out('#out-music', s.music.toFixed(2));
    set('#set-quality', s.quality);
    set('#set-bots', s.botDifficulty || 'normal');
    set('#set-ch-color', s.chColor);
    set('#set-dot-color', s.chDotColor);
    set('#set-ch-gap', s.chGap); out('#out-ch-gap', s.chGap);
    set('#set-ch-len', s.chLen); out('#out-ch-len', s.chLen);
    set('#set-ch-thick', s.chThick || 2); out('#out-ch-thick', s.chThick || 2);
    $('#set-ch-dot').checked = s.chDot;
    $('#set-ch-outline').checked = s.chOutline !== false;
    $('#set-ch-dynamic').checked = s.chDynamic !== false;

    $('#set-sens').addEventListener('input', (e) => {
      s.sens = parseFloat(e.target.value);
      out('#out-sens', s.sens.toFixed(2));
      this.applySettingsToGame();
      this.save();
    });
    $('#set-fov').addEventListener('input', (e) => {
      s.fov = parseInt(e.target.value, 10);
      out('#out-fov', s.fov);
      this.applySettingsToGame();
      this.save();
    });
    $('#set-vol').addEventListener('input', (e) => {
      s.volume = parseFloat(e.target.value);
      out('#out-vol', s.volume.toFixed(2));
      audio.setVolume(s.volume);
      this.save();
    });
    $('#set-music').addEventListener('input', (e) => {
      s.music = parseFloat(e.target.value);
      out('#out-music', s.music.toFixed(2));
      audio.setMusicVolume(s.music);
      this.save();
    });
    $('#set-bots').addEventListener('change', (e) => {
      s.botDifficulty = e.target.value;
      this.game?.setBotDifficulty?.(s.botDifficulty);
      this.save();
      this.toast(`Bot zorluğu: ${e.target.selectedOptions[0]?.textContent || s.botDifficulty}`, 2.2);
    });
    $('#set-quality').addEventListener('change', (e) => {
      s.quality = e.target.value;
      this.save();
      if (this.game) this.toast('Grafik kalitesi bir sonraki maçta uygulanacak', 2.4);
    });
    $('#set-ch-color').addEventListener('input', (e) => { s.chColor = e.target.value; this._initCrosshair(); this.save(); });
    $('#set-dot-color').addEventListener('input', (e) => { s.chDotColor = e.target.value; this._initCrosshair(); this.save(); });
    $('#set-ch-gap').addEventListener('input', (e) => {
      s.chGap = parseInt(e.target.value, 10); out('#out-ch-gap', s.chGap); this._initCrosshair(); this.save();
    });
    $('#set-ch-len').addEventListener('input', (e) => {
      s.chLen = parseInt(e.target.value, 10); out('#out-ch-len', s.chLen); this._initCrosshair(); this.save();
    });
    $('#set-ch-dot').addEventListener('change', (e) => {
      s.chDot = e.target.checked; this._initCrosshair(); this.save();
    });
    $('#set-ch-thick').addEventListener('input', (e) => {
      s.chThick = parseInt(e.target.value, 10); out('#out-ch-thick', s.chThick); this._initCrosshair(); this.save();
    });
    $('#set-ch-outline').addEventListener('change', (e) => {
      s.chOutline = e.target.checked; this._initCrosshair(); this.save();
    });
    $('#set-ch-dynamic').addEventListener('change', (e) => {
      s.chDynamic = e.target.checked;
      if (!s.chDynamic) document.documentElement.style.setProperty('--ch-gap', `${s.chGap}px`);
      this.save();
    });

    this.load();
    // sync UI from loaded values
    set('#set-sens', this.settings.sens); out('#out-sens', this.settings.sens.toFixed(2));
    set('#set-fov', this.settings.fov); out('#out-fov', this.settings.fov);
    set('#set-vol', this.settings.volume); out('#out-vol', this.settings.volume.toFixed(2));
    set('#set-music', this.settings.music); out('#out-music', this.settings.music.toFixed(2));
    set('#set-quality', this.settings.quality);
    set('#set-bots', this.settings.botDifficulty || 'normal');
    set('#set-ch-color', this.settings.chColor);
    set('#set-dot-color', this.settings.chDotColor);
    set('#set-ch-gap', this.settings.chGap); out('#out-ch-gap', this.settings.chGap);
    set('#set-ch-len', this.settings.chLen); out('#out-ch-len', this.settings.chLen);
    $('#set-ch-dot').checked = this.settings.chDot;
    set('#set-ch-thick', this.settings.chThick || 2); out('#out-ch-thick', this.settings.chThick || 2);
    $('#set-ch-outline').checked = this.settings.chOutline !== false;
    $('#set-ch-dynamic').checked = this.settings.chDynamic !== false;
    this._initCrosshair();
    this.selectedAgent = this.settings.agentId || 'phoenix';
  }

  load() {
    try {
      const raw = localStorage.getItem('cv-settings-v1');
      if (raw) Object.assign(this.settings, JSON.parse(raw));
    } catch { /* ignore */ }
    // settings saved by an older build may point at content that no longer exists
    if (!AGENTS[this.settings.agentId]) this.settings.agentId = 'phoenix';
    if (!MAPS.some((m) => m.id === this.settings.map)) this.settings.map = MAPS[0].id;
    if (!this.settings.skins || typeof this.settings.skins !== 'object') this.settings.skins = {};
    this.selectedAgent = this.settings.agentId;
  }

  save() {
    try {
      localStorage.setItem('cv-settings-v1', JSON.stringify(this.settings));
    } catch { /* ignore */ }
  }

  applySettingsToGame() {
    if (!this.game) return;
    this.game.player.sensitivity = this.settings.sens;
    this.game.player.fovBase = this.settings.fov;
    audio.setVolume(this.settings.volume);
    audio.setMusicVolume(this.settings.music);
  }

  _initCrosshair() {
    const s = this.settings;
    const root = document.documentElement.style;
    root.setProperty('--ch-color', s.chColor);
    root.setProperty('--ch-dot', s.chDotColor);
    root.setProperty('--ch-gap', `${s.chGap}px`);
    root.setProperty('--ch-len', `${s.chLen}px`);
    root.setProperty('--ch-thick', `${s.chThick || 2}px`);
    root.setProperty('--ch-dot-size', `${s.chDotSize || 2}px`);
    const pv = $('#ch-preview');
    if (this.el.crosshair) {
      this.el.crosshair.classList.toggle('no-dot', !s.chDot);
      this.el.crosshair.classList.toggle('outline', !!s.chOutline);
    }
    if (pv) {
      pv.classList.toggle('no-dot', !s.chDot);
      pv.classList.toggle('outline', !!s.chOutline);
    }
    this._baseGap = s.chGap;
  }

  /**
   * CS style dynamic crosshair: the gap opens while moving, firing or airborne
   * so the player can read their own inaccuracy without a debug overlay.
   */
  updateCrosshairDynamics(player) {
    if (!this.settings.chDynamic || !this.el.crosshair) return;
    const speed = Math.hypot(player.vel.x, player.vel.z);
    const shots = Math.min(6, player.shotIndex || 0);
    const air = player.grounded ? 0 : 2.5;
    const target = (this._baseGap || 6) + speed * 1.35 + shots * 1.1 + air;
    this._chGapShown = this._chGapShown ?? (this._baseGap || 6);
    this._chGapShown += (target - this._chGapShown) * 0.25;
    document.documentElement.style.setProperty('--ch-gap', `${this._chGapShown.toFixed(1)}px`);
  }

  /* ================================================================ */
  /* match start                                                       */
  /* ================================================================ */
  startMatch() {
    this.settings.agentId = this.selectedAgent;
    this.el.canvas = $('#game-canvas') || this.el.canvas;
    this.save();
    audio.init();
    audio.resume();
    this.el.agentSelect.classList.add('hidden');
    this.el.mainMenu.classList.add('hidden');
    this.el.howto.classList.add('hidden');
    this.el.settings.classList.add('hidden');
    this.el.matchEnd.classList.add('hidden');
    document.body.classList.add('playing');
    this.el.hud.classList.remove('hidden');
    this.el.portraitMini.style.backgroundImage = `url("${agentPortraitSVG(this.selectedAgent, { name: false })}")`;
    this.setHudPortrait(this.selectedAgent);
    this.resetHUD();
    this.onStartMatch?.(this.selectedAgent, this.settings);
  }

  bindGame(game) {
    this.game = game;
    this.playerTeam = game.player.team;
    this.buildAbilitySlots(game.player);
    this.setWeaponName(game.player.activeWeapon?.name || 'CLASSIC');
    this.updateWeapon(game.player);
    this.buildWeaponSlots(game.player);
  }

  resetHUD() {
    this.killfeedEntries = [];
    this.el.killfeed.innerHTML = '';
    this.el.eventFeed.innerHTML = '';
    this.el.banner.classList.add('hidden');
    this.el.toast.innerHTML = '';
    this.el.killBanner.classList.add('hidden');
    this.el.spectate.classList.add('hidden');
    this.el.interact.classList.add('hidden');
    this.el.plantProgress.classList.add('hidden');
    this.el.defuseProgress.classList.add('hidden');
    this.el.scope.classList.add('hidden');
    this.el.buyMenu.classList.add('hidden');
    this.el.pause.classList.add('hidden');
    this.el.scoreboard.classList.add('hidden');
    this.el.matchEnd.classList.add('hidden');
    this.flashLevel = 0;
    this.damageLevel = 0;
    this.el.flashOverlay.style.opacity = '0';
    this.el.damageVignette.style.opacity = '0';
    this.el.canvas.style.filter = '';
  }

  /* ================================================================ */
  /* HUD                                                               */
  /* ================================================================ */
  showHUD(on) {
    this.el.hud.classList.toggle('hidden', !on);
    document.body.classList.toggle('playing', on);
  }

  setMapName(name) {
    const el = document.querySelector('#map-label');
    if (el) el.textContent = name;
  }

  setHUDPhase(phase) {
    this.currentPhase = phase;
  }

  setScore(ally, enemy, history = [], round = 1) {
    this.el.scoreAlly.textContent = ally;
    this.el.scoreEnemy.textContent = enemy;
    const pips = [];
    for (let i = 0; i < 5; i++) {
      const h = history[i];
      pips.push(`<i class="${h ? (h.winner === 'ally' ? 'won' : 'lost') : ''}"></i>`);
    }
    this.el.roundPips.innerHTML = pips.join('');
    this.setWeaponName(this.el.weaponName.textContent);
  }

  setCredits(n) {
    this.el.credits.textContent = n;
    if (this.el.buyCredits) this.el.buyCredits.textContent = n;
  }

  setTimer(seconds, label, urgent) {
    const s = Math.max(0, Number(seconds) || 0);
    this.el.timer.textContent = (label === 'BOMBA' || label === 'TUR SONU')
      ? String(Math.ceil(s))
      : fmtTime(s);
    this.el.phaseLabel.textContent = label;
    this.el.timer.classList.toggle('urgent', !!urgent);
  }

  setWeaponName(name) {
    if (name) this.el.weaponName.textContent = name;
  }

  updateWeapon(player) {
    const w = player.activeWeapon;
    if (!w) return;
    const a = player.ammo[w.id];
    this.el.weaponName.textContent = w.name;
    if (this.el.weaponSkin) {
      const skins = WEAPON_SKINS[w.id] || [];
      const eq = (this.settings.skins || {})[w.id];
      const skin = eq === 'none' ? null : (skins.find((s) => (s.id || s.uuid) === eq) || skins[0] || null);
      this.el.weaponSkin.textContent = skin ? skin.full.toUpperCase() : '';
      this.el.weaponSkin.style.opacity = skin ? '1' : '0';
      this.updateStatTrak(skin);
    }
    if (w.type === 'MELEE') {
      this.el.ammoMag.textContent = '—';
      this.el.ammoReserve.textContent = '—';
    } else {
      this.el.ammoMag.textContent = a ? a.mag : 0;
      this.el.ammoReserve.textContent = a ? a.reserve : 0;
    }
    this.el.ammoPanel.classList.toggle('low', a ? a.mag <= Math.ceil(w.mag * 0.25) : false);
    this.buildWeaponSlots(player);
  }

  /** StatTrak counter + wear tag for the equipped finish. */
  updateStatTrak(skin) {
    const el = this.el.weaponStatTrak;
    if (!el) return;
    const count = skin ? statTrakCount(skin.id) : 0;
    if (!skin || !count) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    const wear = wearLabel(skinFloat(skin));
    el.textContent = `${count} · ${wear.short}`;
  }

  setStatTrak(total) {
    const el = this.el.weaponStatTrak;
    if (!el) return;
    el.textContent = String(total);
    el.classList.remove('hidden');
  }

  buildWeaponSlots(player) {
    const labels = { 1: 'ANA', 2: 'YAN', 3: 'BIÇAK' };
    this.el.weaponSlots.innerHTML = [1, 2, 3].map((slot) => {
      const id = player.slots[slot];
      const w = id ? WEAPONS[id] : null;
      return `<span class="wslot ${player.currentSlot === slot ? 'active' : ''}">${labels[slot]}${w ? ' · ' + w.name : ''}</span>`;
    }).join('');
  }

  buildAbilitySlots(player) {
    const agent = player.agent;
    this.el.abilities.innerHTML = '';
    for (const ab of agent.abilities) {
      const st = player.abilityState[ab.id];
      const div = document.createElement('div');
      div.className = 'ab-slot' + (ab.ultimate ? ' ult' : '');
      div.dataset.id = ab.id;
      div.innerHTML = `
        <span class="ab-key">${ab.key}</span>
        <span class="ab-glyph">${ab.icon}</span>
        <span class="ab-count">${ab.ultimate ? '0/6' : st.charges}</span>
        <div class="ab-cd"></div>
        ${ab.ultimate ? '<div class="ab-ult-bar"></div>' : ''}
      `;
      if (ab.ultimate) {
        div.title = `ULTİMATE: ${ab.name}`;
        div.style.cursor = 'default';
      } else {
        div.title = `${ab.name} — ${ab.price}$`;
      }
      this.el.abilities.appendChild(div);
    }
    this.updateAbilities(player);
  }

  updateAbilities(player) {
    if (!this.el.abilities || !player) return;
    for (const ab of player.agent.abilities) {
      const el = this.el.abilities.querySelector(`.ab-slot[data-id="${ab.id}"]`);
      if (!el) continue;
      const st = player.abilityState[ab.id];
      const cd = el.querySelector('.ab-cd');
      const count = el.querySelector('.ab-count');
      if (ab.ultimate) {
        const k = st.ultPoints / player.ultCost;
        el.classList.toggle('ready', k >= 1);
        el.classList.toggle('empty', k < 1 && !(player.alive));
        count.textContent = `${st.ultPoints}/${player.ultCost}`;
        const bar = el.querySelector('.ab-ult-bar');
        if (bar) bar.style.width = `${k * 100}%`;
        cd.style.transform = 'scaleY(0)';
      } else {
        const onCd = st.cooldown > 0;
        el.classList.toggle('ready', st.charges > 0 && !onCd);
        el.classList.toggle('empty', st.charges <= 0);
        count.textContent = st.charges;
        cd.style.transform = onCd ? `scaleY(${st.cooldown / Math.max(0.01, st.cooldownMax)})` : 'scaleY(0)';
      }
    }
  }

  flashAbility(id) {
    const el = this.el.abilities?.querySelector(`.ab-slot[data-id="${id}"]`);
    if (!el) return;
    el.style.transform = 'scale(1.08)';
    setTimeout(() => { el.style.transform = ''; }, 140);
  }

  hitmarker(kill, headshot) {
    const hm = this.el.hitmarker;
    hm.classList.add('show');
    hm.classList.toggle('kill', !!kill);
    if (headshot && !kill) hm.style.filter = 'drop-shadow(0 0 4px #ffcc55)';
    else hm.style.filter = '';
    clearTimeout(this._hitTimer);
    const dur = kill ? 320 : 110;
    this._hitTimer = setTimeout(() => hm.classList.remove('show'), dur);
  }

  damageVignette(amount) {
    this.damageLevel = Math.max(this.damageLevel, amount);
  }

  flash(amount) {
    this.flashLevel = Math.max(this.flashLevel, clamp(amount, 0, 1.4));
  }

  blur(amount) {
    this.blurLevel = Math.max(this.blurLevel, amount);
  }

  banner(title, sub, duration = 2.4) {
    const el = this.el.banner;
    el.classList.remove('hidden');
    this.el.bannerTitle.textContent = title;
    this.el.bannerSub.textContent = sub || '';
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = 'rbIn .35s ease';
    clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => el.classList.add('hidden'), duration * 1000);
  }

  toast(html, duration = 1.6) {
    this.el.toast.innerHTML = html;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { this.el.toast.innerHTML = ''; }, duration * 1000);
  }

  event(text, duration = 3) {
    const row = document.createElement('div');
    row.className = 'ev-row';
    row.textContent = text;
    this.el.eventFeed.appendChild(row);
    setTimeout(() => {
      row.style.opacity = '0';
      row.style.transition = 'opacity .4s';
      setTimeout(() => row.remove(), 400);
    }, duration * 1000);
    while (this.el.eventFeed.children.length > 4) this.el.eventFeed.firstChild.remove();
  }

  killBanner(label, victim, headshot) {
    if (!label) return;
    const el = this.el.killBanner;
    el.classList.remove('hidden');
    el.innerHTML = `${label}${headshot ? ' <span style="color:#ffd166">· KAFA</span>' : ''}<span>${victim}</span>`;
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = 'rbIn .2s ease';
    clearTimeout(this.killBannerTimer);
    this.killBannerTimer = setTimeout(() => el.classList.add('hidden'), 1500);
  }

  addKillfeed(entry) {
    const row = document.createElement('div');
    row.className = 'kf-row ' + (entry.attackerTeam === 'ally' ? 'ally' : 'enemy');
    row.innerHTML = `
      <span class="kf-name">${entry.attacker}</span>
      <span class="kf-weapon">${entry.weapon}</span>
      ${entry.headshot ? '<span class="kf-hs">✸</span>' : ''}
      <span class="kf-name victim">${entry.victim}</span>
    `;
    this.el.killfeed.appendChild(row);
    setTimeout(() => {
      row.style.transition = 'opacity .4s, transform .4s';
      row.style.opacity = '0';
      row.style.transform = 'translateX(12px)';
      setTimeout(() => row.remove(), 400);
    }, 6000);
    while (this.el.killfeed.children.length > 5) this.el.killfeed.firstChild.remove();
  }

  setPlayerDead(dead, killerName) {
    if (dead) {
      this.el.spectate.classList.remove('hidden');
      this.el.spectate.innerHTML = `ELİMİNE EDİLDİN${killerName ? ` · <b>${killerName}</b>` : ''}`;
      this.el.scope.classList.add('hidden');
    } else {
      this.el.spectate.classList.add('hidden');
    }
  }

  setSpectate(html) {
    this.el.spectate.classList.remove('hidden');
    this.el.spectate.innerHTML = html;
  }

  setScope(on) {
    this.el.scope.classList.toggle('hidden', !on);
    this.el.crosshair.style.opacity = on ? '0' : '1';
  }

  interactHint(text) {
    if (!text) {
      this.el.interact.classList.add('hidden');
      return;
    }
    this.el.interact.classList.remove('hidden');
    this.el.interact.innerHTML = text.replace(/\[F\]/g, '<b>F</b>');
  }

  plantProgress(p) {
    if (p === null || p === undefined) {
      this.el.plantProgress.classList.add('hidden');
      return;
    }
    this.el.plantProgress.classList.remove('hidden');
    this.el.plantProgress.querySelector('span').textContent = `BOMBA KURULUYOR ${Math.round(p * 100)}%`;
  }

  defuseProgress(p) {
    if (p === null || p === undefined) {
      this.el.defuseProgress.classList.add('hidden');
      return;
    }
    this.el.defuseProgress.classList.remove('hidden');
    this.el.defuseProgress.querySelector('span').textContent = `BOMBA ÇÖZÜLÜYOR ${Math.round(p * 100)}%`;
  }

  showClickToPlay(on) {
    this.el.clickToPlay.classList.toggle('hidden', !on);
  }

  showPause(on) {
    this.el.pause.classList.toggle('hidden', !on);
    if (on) document.body.classList.remove('playing');
    else document.body.classList.add('playing');
  }

  /* ---------------------------------------------------------------- */
  updateHUDTick(dt, game) {
    const p = game.player;

    // vitals
    const hp = Math.max(0, Math.ceil(p.health));
    this.el.hpText.textContent = hp;
    this.el.hpFill.style.transform = `scaleX(${clamp(p.health / 100, 0, 1)})`;
    this.el.hpFill.style.background = p.health < 35
      ? 'linear-gradient(90deg,#ff4655,#ff7a6a)' : 'linear-gradient(90deg,#2fd8a6,#46e9c3)';
    this.el.armorText.textContent = Math.ceil(p.armor + (p.shieldHp || 0));
    this.el.armorFill.style.transform = `scaleX(${clamp((p.armor + (p.shieldHp || 0)) / 100, 0, 1)})`;
    this.el.credits.textContent = p.credits;

    // ammo / abilities at 10hz
    this.hudAcc += dt;
    if (this.hudAcc > 0.08) {
      this.hudAcc = 0;
      this.updateWeapon(p);
      this.updateAbilities(p);
      this.setCredits(p.credits);
    }

    // damage vignette decay
    if (this.damageLevel > 0) {
      this.damageLevel = Math.max(0, this.damageLevel - dt * 1.5);
      this.el.damageVignette.style.opacity = String(this.damageLevel);
    }
    // flash
    if (p.flashTimer > 0) {
      this.flashLevel = clamp(p.flashTimer * 0.9, 0, 1);
      this.el.flashOverlay.style.opacity = String(this.flashLevel);
      this.el.flashOverlay.style.background = `rgba(255,255,255,${clamp(this.flashLevel, 0, 1)})`;
    } else if (this.flashLevel > 0) {
      this.flashLevel = Math.max(0, this.flashLevel - dt * 1.6);
      this.el.flashOverlay.style.opacity = String(this.flashLevel);
    }
    // stun blur
    if (p.stunned > 0) {
      this.blurLevel = Math.max(this.blurLevel, 0.9);
    }
    if (this.blurLevel > 0) {
      this.blurLevel = Math.max(0, this.blurLevel - dt * 0.9);
      const b = this.blurLevel * 4;
      this.el.canvas.style.filter = b > 0.05 ? `blur(${b.toFixed(1)}px) saturate(${1 - this.blurLevel * 0.3})` : '';
    }

    // minimap 20hz
    this.minimapAcc += dt;
    if (this.minimapAcc > 0.05) {
      this.minimapAcc = 0;
      this.drawMinimap(game);
    }
  }

  /* ================================================================ */
  /* minimap                                                           */
  /* ================================================================ */
  initMinimap() {
    const c = this.el.minimap;
    if (!c) return;
    this.mapScale = 3;
    this._radarImg = null;
    this._radarFor = null;
    this._loadRadar();
  }

  /** the radar of the selected map, cached across frames */
  _loadRadar() {
    const map = CURRENT_MAP;
    if (this._radarFor === map.id && this._radarImg) return this._radarImg;
    this._radarFor = map.id;
    const img = new Image();
    img.src = map.radar;
    this._radarImg = img;
    return img;
  }

  drawMinimap(game) {
    const ctx = this.mm;
    const c = this.el.minimap;
    if (!ctx) return;
    const map = CURRENT_MAP;
    const W = c.width;
    const K = W / 1024;                       // radar pixels → canvas pixels
    const pxOf = (x, z) => worldToRadar(map, x, z);
    const toX = (x) => pxOf(x, 0).px * K;
    const toY = (z) => pxOf(0, z).py * K;
    const S = K / (map.meta.scale * 0.0254);  // canvas px per metre
    this.mapScale = S;

    ctx.clearRect(0, 0, W, W);
    ctx.fillStyle = '#0b1218';
    ctx.fillRect(0, 0, W, W);

    const img = this._loadRadar();
    if (img && img.complete && img.naturalWidth) {
      ctx.globalAlpha = 0.92;
      ctx.drawImage(img, 0, 0, W, W);
      ctx.globalAlpha = 1;
    } else {
      // radar still downloading: sketch the collision boxes so the HUD is useful
      for (const [x, z, w, d] of WALLS) {
        ctx.fillStyle = 'rgba(190,200,210,0.35)';
        ctx.fillRect(toX(x - w / 2), toY(z - d / 2), Math.max(1, w * S), Math.max(1, d * S));
      }
    }

    // sites
    for (const key of ['A', 'B']) {
      const site = SITES[key];
      ctx.beginPath();
      ctx.arc(toX(site.center.x), toY(site.center.z), site.radius * S, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,70,85,0.10)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,70,85,0.55)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,120,130,0.9)';
      ctx.font = `bold ${Math.round(W * 0.075)}px Impact, Arial Black, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(key, toX(site.center.x), toY(site.center.z));
    }

    // spawn zones
    const spawnTeam = game.attackingTeam;
    ctx.fillStyle = spawnTeam === game.player.team ? 'rgba(255,140,80,0.22)' : 'rgba(80,160,255,0.2)';
    ctx.beginPath();
    ctx.arc(toX(SPAWNS.attacker[0].x), toY(SPAWNS.attacker[0].z), 3.6 * Math.max(S, 1.2), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = spawnTeam === game.player.team ? 'rgba(120,200,255,0.22)' : 'rgba(255,120,120,0.2)';
    ctx.beginPath();
    ctx.arc(toX(SPAWNS.defender[0].x), toY(SPAWNS.defender[0].z), 3.6 * Math.max(S, 1.2), 0, Math.PI * 2);
    ctx.fill();

    // smoke clouds
    for (const z of game.effects.zones) {
      if (z.type === 'smoke') {
        ctx.beginPath();
        ctx.arc(toX(z.pos.x), toY(z.pos.z), z.radius * S, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(220,225,230,0.28)';
        ctx.fill();
      } else if (z.type === 'fire') {
        ctx.beginPath();
        ctx.arc(toX(z.pos.x), toY(z.pos.z), z.radius * S, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,120,60,0.3)';
        ctx.fill();
      }
    }

    // spike
    if (game.spike.state === 'planted' || game.spike.state === 'dropped') {
      const s = game.spike.pos;
      this.el.spikeMini.classList.remove('hidden');
      const wrap = this.el.minimap.parentElement;
      this.el.spikeMini.style.left = `${6 + (toX(s.x) / W) * (wrap.clientWidth - 12)}px`;
      this.el.spikeMini.style.top = `${6 + (toY(s.z) / W) * (wrap.clientHeight - 12)}px`;
      this.el.spikeMini.style.background = game.spike.state === 'planted' ? '#ff4655' : '#f5c86b';
    } else {
      this.el.spikeMini.classList.add('hidden');
    }

    // actors
    for (const a of game.actors) {
      if (!a.alive) continue;
      const isAlly = a.team === game.player.team;
      if (!isAlly && a.revealed <= 0 && !this._teammateCanSee(game, a)) continue;
      const px = toX(a.pos.x);
      const py = toY(a.pos.z);
      if (a === game.player) {
        // player arrow + view cone
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(-game.player.yaw + Math.PI);
        ctx.fillStyle = 'rgba(255,255,255,0.16)';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, 12 * S, -Math.PI / 2 - 0.55, -Math.PI / 2 + 0.55);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(0, -4.6 * S);
        ctx.lineTo(3.4 * S, 3.4 * S);
        ctx.lineTo(0, 1.8 * S);
        ctx.lineTo(-3.4 * S, 3.4 * S);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(px, py, 2.7 * S, 0, Math.PI * 2);
        ctx.fillStyle = isAlly ? '#35e8c0' : '#ff4655';
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        ctx.lineWidth = 1;
        ctx.stroke();
        if (isAlly) {
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(-a.yaw + Math.PI);
          ctx.fillStyle = 'rgba(53,232,192,0.8)';
          ctx.beginPath();
          ctx.moveTo(0, -5 * S);
          ctx.lineTo(2 * S, -2 * S);
          ctx.lineTo(-2 * S, -2 * S);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      }
    }
  }

  _teammateCanSee(game, enemy) {
    for (const a of game.actors) {
      if (!a.alive || a.team !== game.player.team || a === game.player) continue;
      if (distance2D(a.pos, enemy.pos) < 26 && game.hasClearSight(a.getEye(), enemy.getEye())) return true;
    }
    return false;
  }

  /* ================================================================ */
  /* BUY MENU                                                          */
  /* ================================================================ */
  showBuyMenu(open, data) {
    this.el.buyMenu.classList.toggle('hidden', !open);
    if (open && data) this.renderBuy(data);
  }

  renderBuy(data) {
    const credits = data.credits ?? 0;
    this.el.buyCredits.textContent = credits;
    const p = data.weapons;
    const groups = data.groups || BUY_GROUPS;

    // ---- weapons, grouped the way the CS shop groups them ----
    this.el.buyWeapons.innerHTML = groups.map((g) => {
      const cards = g.items.map((id) => {
        const w = WEAPONS[id];
        if (!w) return '';
        const owned = p.slots[1] === w.id || p.slots[2] === w.id;
        const can = credits >= w.price;
        return `<button class="buy-item ${owned ? 'owned' : ''} ${!can && !owned ? 'cant' : ''}" data-weapon="${w.id}">
          <div class="bi-icon">${this.buyWeaponArt(w.id)}</div>
          <div class="bi-name">${w.name}</div>
          <div class="bi-type">${w.type} · ${w.damage} hasar</div>
          ${owned ? '<div class="bi-own">SAHİPSİN</div>' : `<div class="bi-price">$${w.price}</div>`}
        </button>`;
      }).join('');
      return `<div class="buy-group" data-group="${g.id}">
        <div class="bg-title">${g.label}</div>
        <div class="bg-grid">${cards}</div>
      </div>`;
    }).join('');

    this._bindWeaponArtFallbacks(this.el.buyWeapons);
    this.el.buyWeapons.querySelectorAll('[data-weapon]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.weapon;
        if (!this.game?.buyWeapon(id)) audio.play('dryfire', { volume: 0.4 });
      });
    });

    // ---- armour + utility ----
    const gear = [];
    gear.push({
      id: 'kevlar', name: 'KEVLAR', desc: `Çelik yelek · ${Math.round(data.armor || 0)}%`,
      price: 650, owned: (data.armor || 0) >= 100, icon: '🦺',
    });
    gear.push({
      id: 'helmet', name: 'KEVLAR + KASK', desc: data.helmet ? 'Kask takılı — kafa vuruşu yarıya iner' : 'Kask yok — kafadan tek mermi ölüm',
      price: (data.armor || 0) > 0 ? 350 : 1000, owned: !!data.helmet, icon: '⛑',
    });
    if (data.canBuyKit) {
      gear.push({
        id: 'kit', name: 'DEFUSE KIT', desc: data.kit ? 'Bomba çözme 5 saniye' : 'Bomba çözme 10 → 5 saniye',
        price: 400, owned: !!data.kit, icon: '🔧',
      });
    }
    for (const g of data.grenades || []) {
      const st = g.state || { charges: 0, maxCharges: g.charges || 1 };
      const max = st.maxCharges ?? g.charges ?? 1;
      gear.push({
        id: `ab:${g.id}`, name: `${g.name}`, desc: `${g.key} tuşu · ${st.charges}/${max} adet`,
        price: g.price, owned: st.charges >= max, icon: g.icon,
      });
    }

    this.el.buyGear.innerHTML = gear.map((row) => {
      const can = credits >= row.price;
      return `<button class="buy-line ${row.owned ? 'owned' : ''} ${!can && !row.owned ? 'cant' : ''}" data-gear="${row.id}">
        <span class="bl-icon">${row.icon || '•'}</span>
        <span class="bl-text">
          <span class="bl-n">${row.name}</span>
          <span class="bl-d">${row.desc}</span>
        </span>
        <span class="bl-c">${row.owned ? '✓' : `$${row.price}`}</span>
      </button>`;
    }).join('');

    this.el.buyGear.querySelectorAll('[data-gear]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.gear;
        if (id === 'kevlar' || id === 'helmet') this.game?.buyArmor(id);
        else if (id === 'kit') this.game?.buyKit?.();
        else if (id.startsWith('ab:')) this.game?.buyAbility(id.slice(3));
      });
    });

    // ---- header summary ----
    const prim = data.primary ? data.primary.name : 'YOK';
    const sec = data.secondary ? data.secondary.name : 'YOK';
    if (this.el.buySummary) {
      this.el.buySummary.textContent = `BİRİNCİL: ${prim} · İKİNCİL: ${sec} · ${data.timeLeft ?? 0}s`;
    }
  }

  /* ================================================================ */
  /* SCOREBOARD                                                        */
  /* ================================================================ */
  showScoreboard(open, data) {
    this.el.scoreboard.classList.toggle('hidden', !open);
    if (open && data) this.renderScoreboard(data);
  }

  renderScoreboard(data) {
    this.el.sbScore.textContent = `${data.allyScore} — ${data.enemyScore}`;
    const head = `<div class="sb-row head"><span>OPERATÖR / OYUNCU</span><span>K</span><span>Ö</span><span>HASAR</span><span>KREDİ</span></div>`;
    const team = (rows, cls) => head + rows.map((r) => `
      <div class="sb-row ${cls} ${r.me ? 'me' : ''} ${r.alive ? '' : 'dead'}">
        <span class="sb-name"><i class="sb-dot"></i>${r.agent} · ${r.name}</span>
        <span>${r.kills}</span>
        <span>${r.deaths}</span>
        <span>${r.damage}</span>
        <span>${r.credits}</span>
      </div>`).join('');
    this.el.sbAllies.innerHTML = team(data.ally, '');
    this.el.sbEnemies.innerHTML = team(data.enemy, 'enemy');
    document.querySelector('#scoreboard .sb-mode').textContent =
      `TAKTİK / 5v5 — BOMBA · ROUND ${data.round}`;
  }

  /* ================================================================ */
  /* MATCH END                                                         */
  /* ================================================================ */
  showMatchEnd(data) {
    if (!data) {
      this.el.matchEnd.classList.add('hidden');
      return;
    }
    this.el.matchEnd.classList.remove('hidden');
    this.el.meTitle.textContent = data.win ? 'ZAFER' : 'YENİLGİ';
    this.el.meTitle.className = data.win ? 'win' : 'lose';
    this.el.meEyebrow.textContent = data.win ? 'TAKIMIN MAÇI KAZANDI' : 'TAKIMIN MAÇI KAYBETTİ';
    this.el.meScore.textContent = `${data.allyScore} — ${data.enemyScore}`;
    const p = data.player;
    this.el.meStats.innerHTML = `
      <div><b>${p.kills}</b><span>ÖLDÜRME</span></div>
      <div><b>${p.deaths}</b><span>ÖLÜM</span></div>
      <div><b>${Math.round(p.damageDealt)}</b><span>HASAR</span></div>
      <div><b>${p.kills}/${Math.max(1, p.deaths)}</b><span>K/D</span></div>
    `;
    if (data.career && this.el.meCareer) {
      const c = data.career;
      this.el.meCareer.innerHTML = `
        <span>KARİYER</span>
        <b>${c.matches}</b> maç
        <b>${c.winRate.toFixed(0)}%</b> kazanma
        <b>${c.kd.toFixed(2)}</b> K/D
        <b>${c.hsPercent.toFixed(0)}%</b> HS
        <b>${c.rating.toFixed(2)}</b> rating
        <b>+${p.kills}</b> kill bu maç`;
    }
    this.showHUD(false);
    document.body.classList.remove('playing');
    audio.play(data.win ? 'win' : 'lose', { volume: 1 });
  }

  /* ================================================================ */
  /* AUTHENTIC COUNTER-STRIKE ART                                      */
  /* ================================================================ */
  _initAuthenticArt() {
    this.agentArtKeys = {};

    // buttons
    this.el.btnSkins?.addEventListener('click', () => { audio.play('ui_click'); this.showSkinVault(true); });
    this.el.btnMaps?.addEventListener('click', () => { audio.play('ui_click'); this.showMapsGallery(true); });
    this.el.btnCareer?.addEventListener('click', () => this.showCareer(true));
    $('#career-close')?.addEventListener('click', () => this.showCareer(false));
    $('#career-ok')?.addEventListener('click', () => this.showCareer(false));
    $('#career-reset')?.addEventListener('click', () => {
      resetProfile();
      this.renderCareer(profileSummary(loadProfile()));
      this.toast('Kariyer profili sıfırlandı', 2.2);
    });
    this.el.btnVaultBack?.addEventListener('click', () => { audio.play('ui_click'); this.showSkinVault(false); });
    this.el.btnMapsClose?.addEventListener('click', () => { audio.play('ui_click'); this.showMapsGallery(false); });
    this.el.btnVaultNone?.addEventListener('click', () => {
      audio.play('ui_click');
      if (!this.settings.skins) this.settings.skins = {};
      this.settings.skins[this.vaultWeapon] = 'none';
      this.save();
      this.renderVaultSkins(this.vaultWeapon);
      this._refreshStage();
    });

    // is the CDN reachable? (offline → procedural art stays, cards show a warning)
    detectCdn().then((state) => {
      this.cdn = state;
      if (this.el.vaultStatus) {
        this.el.vaultStatus.textContent = state === 'online'
          ? 'orijinal kaplamalar · valve cdn'
          : 'çevrimdışı — kaplama görselleri yüklenemedi';
        this.el.vaultStatus.classList.toggle('online', state === 'online');
        this.el.vaultStatus.classList.toggle('offline', state !== 'online');
      }
      this._buildWeaponArt();
      this.renderMaps();
      if (state === 'online') this._startMenuSlideshow();
    });

    this.renderVaultWeapons();
    this.renderVaultSkins(this.vaultWeapon);
    this._buildWeaponArt();
    this._pickHeroArt();
  }

  /** the mapping between our original agents and the art we display */
  artKey(agentId) {
    return AGENTS[agentId]?.artKey || this.agentArtKeys?.[agentId] || agentId;
  }

  /** real portrait <img> for an agent card / detail panel */
  agentArtHTML(agentId, cls = 'ac-art') {
    return `<div class="${cls}">${agentPortraitSVG(agentId, 180)}</div>`;
  }

  /** weapon skin render (falls back to the procedural SVG icon) */
  weaponArtURL(weaponId) {
    const skinMap = this.settings.skins || {};
    const listed = WEAPON_SKINS[weaponId] || [];
    if (!listed.length) return null;
    const chosen = listed.find((s) => (s.id || s.uuid) === skinMap[weaponId]) || listed[0];
    return skinImageUrl(chosen);
  }

  _buildWeaponArt() {
    // swapped by renderBuy() at runtime, kept here so the buy menu can use it
    this._weaponArt = {};
    for (const id of Object.keys(WEAPON_SKINS)) this._weaponArt[id] = this.weaponArtURL(id);
  }

  /* ---------------- career / stats ---------------- */
  showCareer(open) {
    this.el.careerPanel?.classList.toggle('hidden', !open);
    if (open) {
      this.renderCareer(profileSummary(loadProfile()));
      audio.play('ui_click');
    }
  }

  renderCareer(sum) {
    if (!this.el.careerBody) return;
    const n = (v, d = 0) => (Number.isFinite(v) ? v.toFixed(d) : '0');
    const kpis = [
      { k: 'MAÇ', v: sum.matches },
      { k: 'KAZANMA', v: `${n(sum.winRate, 1)}%` },
      { k: 'K/D', v: n(sum.kd, 2) },
      { k: 'İSABET', v: `${n(sum.accuracy, 1)}%` },
      { k: 'HS', v: `${n(sum.hsPercent, 1)}%` },
      { k: 'ADR', v: n(sum.adr, 1) },
      { k: 'RATING', v: n(sum.rating, 2) },
      { k: 'MVP', v: sum.mvps },
    ];
    const weaponRows = (sum.topWeapons || []).map((w) => {
      const name = CS_WEAPONS[w.id]?.name || w.id.toUpperCase();
      const max = sum.topWeapons[0]?.kills || 1;
      return `<li><span class="cw-name">${name}</span>
        <span class="cw-bar"><i style="width:${Math.round((w.kills / max) * 100)}%"></i></span>
        <b>${w.kills}</b></li>`;
    }).join('') || '<li class="empty">Henüz kill yok — bir maç oyna.</li>';

    const mapRows = Object.entries(sum.maps || {}).map(([id, row]) => {
      const rate = row.played ? (row.won / row.played) * 100 : 0;
      return `<tr><td>${id.replace('de_', '').toUpperCase()}</td><td>${row.played}</td>
        <td>${row.won}</td><td>${rate.toFixed(0)}%</td><td>${row.kills}</td><td>${row.deaths}</td></tr>`;
    }).join('') || '<tr><td colspan="6" class="empty">Henüz harita kaydı yok.</td></tr>';

    const histRows = (sum.history || []).map((h) => {
      const d = new Date(h.at || Date.now());
      const label = h.draw ? 'BERABERE' : (h.win ? 'GALİBİYET' : 'MAĞLUBİYET');
      const cls = h.draw ? 'draw' : (h.win ? 'win' : 'loss');
      return `<li class="${cls}"><span>${h.map.replace('de_', '').toUpperCase()}</span>
        <span>${h.ally} : ${h.enemy}</span>
        <span>${h.kills}/${h.deaths}</span>
        <span>${d.toLocaleDateString('tr-TR')}</span>
        <b>${label}</b></li>`;
    }).join('') || '<li class="empty">Kayıtlı maç yok.</li>';

    this.el.careerBody.innerHTML = `
      <div class="career-kpis">${kpis.map((x) => `<div class="ck"><b>${x.v}</b><span>${x.k}</span></div>`).join('')}</div>
      <div class="career-cols">
        <section><h3>EN ÇOK KULLANILAN SİLAHLAR</h3><ul class="cw-list">${weaponRows}</ul></section>
        <section><h3>HARİTA PERFORMANSI</h3>
          <table class="cm-table"><thead><tr><th>HARİTA</th><th>M</th><th>G</th><th>%</th><th>K</th><th>D</th></tr></thead>
          <tbody>${mapRows}</tbody></table>
        </section>
      </div>
      <section class="career-history"><h3>SON MAÇLAR</h3><ul>${histRows}</ul></section>
      <p class="career-foot">Toplam ${sum.kills} kill · ${sum.deaths} ölüm · ${sum.rounds} round ·
        ${sum.plants} bomba kurulumu · ${sum.defuses} çözüm · ${sum.aces} ace</p>`;
  }

  /* ---------------- hero / slideshow art ---------------- */
  _pickHeroArt() {
    const pick = MAP_BY_ID[this.settings.map] || MAPS[0];
    this.setHeroArt(pick, { credits: true });
  }

  setHeroArt(map, { credits = false } = {}) {
    const url = map.radar;
    if (this.el.menuArt) {
      this.el.menuArt.classList.add('swap');
      loadImagePlain(url).then((img) => {
        if (img) this.el.menuArt.src = url;
        this.el.menuArt.classList.remove('swap');
      });
    }
    if (this.el.loadArt) {
      loadImagePlain(url).then((img) => { if (img && this.el.loadArt) this.el.loadArt.src = url; });
    }
    if (credits && !this._artCredit && this.el.mainMenu) {
      const tag = document.createElement('div');
      tag.className = 'menu-art-credit';
      tag.textContent = `${map.name} — resmî CS2 radarı`;
      this.el.mainMenu.appendChild(tag);
      this._artCredit = tag;
    } else if (this._artCredit) {
      this._artCredit.textContent = `${map.name} — resmî CS2 radarı`;
    }
  }

  setMenuThemeLabel() {
    const map = MAP_BY_ID[this.settings.map] || MAPS[0];
    const label = document.querySelector('#as-side b');
    if (label) label.textContent = map.name;
    const foot = document.querySelector('.as-map b');
    if (foot) foot.textContent = map.name;
  }

  _startMenuSlideshow() {
    clearInterval(this.menuSlideTimer);
    const maps = MAPS;
    if (!maps.length) return;
    this.menuSlideTimer = setInterval(() => {
      if (!this.el.mainMenu || this.el.mainMenu.classList.contains('hidden')) return;
      this.menuSlide = (this.menuSlide + 1) % maps.length;
      this.setHeroArt(maps[this.menuSlide], { credits: true });
    }, 9000);
  }

  /* ---------------- skin vault ---------------- */
  showSkinVault(open) {
    this.el.skinVault.classList.toggle('hidden', !open);
    if (open) {
      this.renderVaultWeapons();
      this.renderVaultSkins(this.vaultWeapon);
      this._startStage();
      this._refreshStage();
    } else {
      this.stage?.stop();
    }
    if (open) this.el.mainMenu.classList.add('hidden');
    else this.el.mainMenu.classList.remove('hidden');
  }

  /** lazily spin up the 3D turntable (one extra WebGL context, only in the vault) */
  _startStage() {
    if (!this.el.svCanvas || this.stage) { this.stage?.start(); return; }
    // no WebGL (headless tests, very old GPU) → keep the vault fully usable
    if (typeof window.WebGLRenderingContext === 'undefined') return;
    const ctx = this.el.svCanvas.getContext?.('webgl2') || this.el.svCanvas.getContext?.('webgl');
    if (!ctx) return;
    try {
      this.stage = new WeaponPreview(this.el.svCanvas);
      this.stage.start();
    } catch (err) {
      console.warn('[vault] 3D önizleme başlatılamadı', err);
      this.stage = null;
    }
  }

  /** push the current weapon + skin into the turntable */
  _refreshStage() {
    if (!this.stage) return;
    const weaponId = this.vaultWeapon;
    const skins = WEAPON_SKINS[weaponId] || [];
    const equipped = (this.settings.skins || {})[weaponId];
    const activeUuid = equipped === 'none' ? null : (equipped || skins[0]?.id);
    const skin = skins.find((s) => s.id === activeUuid) || null;
    this.stage.setWeapon(weaponId, this.settings.skins || {});
    if (this.el.svStageWeapon) this.el.svStageWeapon.textContent = weaponId.toUpperCase();
    if (this.el.svStageSkin) this.el.svStageSkin.textContent = skin ? skin.full : 'VARSAYILAN KAPLAMA';
  }

  renderVaultWeapons() {
    if (!this.el.svWeapons) return;
    const order = ['ak47', 'm4a4', 'awp', 'ssg08', 'deagle', 'usp_s', 'glock', 'p250', 'mp9', 'mac10', 'knife'];
    this.el.svWeapons.innerHTML = order.map((id) => {
      const count = (WEAPON_SKINS[id] || []).length;
      return `<button class="vault-wpn ${id === this.vaultWeapon ? 'active' : ''}" data-wpn="${id}">
        <span>${id.toUpperCase()}</span><small>${count}</small>
      </button>`;
    }).join('');
    this.el.svWeapons.querySelectorAll('[data-wpn]').forEach((btn) => {
      btn.addEventListener('click', () => {
        audio.play('ui_click');
        this.vaultWeapon = btn.dataset.wpn;
        this.renderVaultWeapons();
        this.renderVaultSkins(this.vaultWeapon);
        this._refreshStage();
      });
    });
  }

  renderVaultSkins(weaponId) {
    if (!this.el.svSkins) return;
    const skins = WEAPON_SKINS[weaponId] || [];
    const equipped = (this.settings.skins || {})[weaponId];
    const activeUuid = equipped === 'none' ? null : (equipped || skins[0]?.id);
    this.el.svSkins.innerHTML = skins.map((skin) => {
      const isOn = skin.id === activeUuid;
      return `<button class="skin-card ${isOn ? 'equipped' : ''}" data-skin="${skin.id}" style="--rarity:${skin.color}">
        <div class="skin-badge">KUŞANILDI</div>
        <div class="skin-art skin-loading">${weaponIconSVG(weaponId)}</div>
        <div class="skin-name">${skin.full.toUpperCase()}<small>${skin.rarity.toUpperCase()}</small></div>
        <div class="skin-meta"><span>${wearLabel(skinFloat(skin)).short} · ${skinFloat(skin).toFixed(3)}</span>${statTrakCount(skin.id) ? `<span class="st">${statTrakCount(skin.id)} ST</span>` : ''}</div>
      </button>`;
    }).join('');

    // 1) paint a unique local preview immediately — works with no network
    this.el.svSkins.querySelectorAll('.skin-card').forEach((card) => {
      const id = card.dataset.skin;
      const slot = card.querySelector('.skin-art');
      const skin = skins.find((s) => s.id === id);
      skinThumbnail(skin, weaponId).then((url) => {
        if (!url || !slot.isConnected) return;
        slot.classList.remove('skin-loading');
        slot.innerHTML = `<img src="${url}" alt="" />`;
      });
      // 2) upgrade to Valve's real render when the CDN answers
      loadImagePlain(skinImageUrl(skin)).then((img) => {
        if (!img || !slot.isConnected) return;
        slot.classList.remove('skin-loading');
        slot.innerHTML = `<img src="${img.src}" alt="" />`;
      });
      card.addEventListener('click', () => {
        audio.play('ui_click');
        if (!this.settings.skins) this.settings.skins = {};
        this.settings.skins[weaponId] = id;
        this.save();
        if (this.el.svHint) {
          const picked = skins.find((s) => s.id === id);
          this.el.svHint.textContent = `${picked?.full || 'Kaplama'} kuşanıldı — ${weaponId.toUpperCase()} elinde olduğunda görünür.`;
        }
        this.renderVaultSkins(weaponId);
        this._refreshStage();
        // apply the new paint job live if a match is running
        this.game?.refreshSkins?.();
      });
    });
  }

  /* ---------------- map gallery ---------------- */
  showMapsGallery(open) {
    this.el.mapsGallery.classList.toggle('hidden', !open);
    if (open) this.renderMaps();
  }

  renderMaps() {
    if (!this.el.mapsGrid) return;
    const activeId = this.settings.map || MAPS[0].id;
    this.el.mapsGrid.innerHTML = MAP_ART.map((m) => `
      <div class="map-card ${m.id === activeId ? 'active' : ''}" data-mapid="${m.id}" title="${m.name} haritasında oyna">
        <div class="map-fallback">${m.name}</div>
        <img src="${m.radar}" alt="${m.name}" loading="lazy" />
        <div class="map-tag">${m.name}<small>${m.desc} · ${m.sites.A.center.x.toFixed(0)},${m.sites.A.center.z.toFixed(0)}</small></div>
      </div>`).join('');

    this.el.mapsGrid.querySelectorAll('[data-mapid]').forEach((card) => {
      card.addEventListener('click', () => {
        const id = card.dataset.mapid;
        if (!MAP_BY_ID[id]) return;
        this.settings.map = id;
        this.save();
        applyMap(id);
        audio.play('ui_click');
        this.showMapsGallery(false);
        this.toast(`<b>${MAP_BY_ID[id].name}</b> seçildi — maç bu haritada oynanacak`, 2.6);
        this._pickHeroArt();
        this.setMenuThemeLabel();
        this.renderMaps();
      });
    });
  }

  /** buy menu thumbnail: real CS finish render, SVG fallback if the CDN is down */
  buyWeaponArt(weaponId) {
    const url = this.weaponArtURL(weaponId);
    if (!url) return weaponIconSVG(weaponId);
    return `<img src="${url}" alt="" data-fallback="${weaponId}" loading="lazy" />`;
  }

  /** wire the SVG fallback onto every buy-menu render that failed to load */
  _bindWeaponArtFallbacks(root) {
    root?.querySelectorAll('img[data-fallback]').forEach((img) => {
      img.addEventListener('error', () => {
        const id = img.dataset.fallback;
        const holder = img.parentElement;
        if (holder) holder.innerHTML = weaponIconSVG(id);
      }, { once: true });
    });
  }

  /** HUD portrait: the agent's real bust instead of the placeholder block */
  setHudPortrait(agentId) {
    if (!this.el.portraitMini) return;
    this.el.portraitMini.innerHTML = agentPortraitSVG(agentId, 64);
  }
}

export { DEFAULT_SETTINGS };
