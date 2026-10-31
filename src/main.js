import { Game } from './game/game.js';
import { UI, DEFAULT_SETTINGS } from './ui/ui.js';
import { audio } from './core/audio.js';

const canvas = document.getElementById('game-canvas');

let game = null;

/** First launch on a modest machine: start at low quality instead of stuttering. */
function firstRunSettings() {
  const settings = { ...DEFAULT_SETTINGS };
  let saved = null;
  try {
    saved = localStorage.getItem('cv-settings-v1');
  } catch { /* storage blocked */ }
  if (saved) return settings;
  const cores = navigator.hardwareConcurrency || 4;
  const small = Math.min(window.innerWidth, window.innerHeight) < 720;
  if (cores <= 4 || small) settings.quality = 'low';
  else if (cores >= 12) settings.quality = 'high';
  return settings;
}

const ui = new UI({
  settings: firstRunSettings(),
  onStartMatch: (agentId, settings) => {
    startMatch(agentId, settings);
  },
  onExitToMenu: () => {
    returnToMenu();
  },
});

function startMatch(agentId, settings) {
  if (game) {
    game.stop();
    game = null;
  }
  // A fresh canvas per match guarantees a clean WebGL context.
  const oldCanvas = document.getElementById('game-canvas');
  const freshCanvas = oldCanvas.cloneNode(false);
  freshCanvas.id = 'game-canvas';
  oldCanvas.replaceWith(freshCanvas);
  const loadingEl = document.getElementById('loading');
  loadingEl.classList.remove('hidden', 'fade');
  ui.setLoading(0.15, 'DUNE HARİTASI DERLENİYOR…');

  // let the loading screen paint before the heavy scene build
  requestAnimationFrame(() => {
    setTimeout(() => {
      try {
        ui.setLoading(0.4, 'IŞIKLAR VE DOKULAR HAZIRLANIYOR…');
        game = new Game({ canvas: freshCanvas, ui, settings, agentId, onExit: returnToMenu });
        game.init();
        ui.el.canvas = freshCanvas;
        ui.bindGame(game);
        ui.setLoading(0.82, 'OPERATÖRLER KONUMLANDIRILIYOR…');
        game.start();
        ui.setLoading(1, 'HAZIR');
        setTimeout(() => {
          loadingEl.classList.add('fade');
          setTimeout(() => loadingEl.classList.add('hidden'), 420);
          game?.requestLock();
        }, 320);
      } catch (err) {
        console.error(err);
        const gl = !!document.createElement('canvas').getContext('webgl2')
          || !!document.createElement('canvas').getContext('webgl');
        ui.setLoading(
          1,
          gl
            ? 'HATA: ' + (err?.message || err)
            : 'WebGL kapalı görünüyor — tarayıcı ayarlarından donanım hızlandırmayı (hardware acceleration) açıp sayfayı yenile.'
        );
        ui.showClickToPlay(false);
      }
    }, 120);
  });
}

function returnToMenu() {
  if (game) {
    game.stop();
    game = null;
  }
  document.getElementById('loading').classList.add('hidden');
  ui.showMenu();
  ui.showHUD(false);
  audio.startMusic('menu');
  document.body.classList.remove('playing');
}

/* ------------------------------------------------------------------ */
/* boot                                                               */
/* ------------------------------------------------------------------ */
async function boot() {
  const loading = document.getElementById('loading');
  loading.classList.remove('hidden', 'fade');
  ui.setLoading(0.08, 'BAŞLATILIYOR…');

  // warm up audio on the first user interaction
  const unlock = () => {
    audio.init();
    audio.resume();
    audio.startMusic('menu');
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);

  ui.setLoading(0.35, 'ARAYÜZ YÜKLENİYOR…');
  await new Promise((r) => setTimeout(r, 240));
  ui.setLoading(0.68, 'OPERATÖRLER HAZIRLANIYOR…');
  await new Promise((r) => setTimeout(r, 240));
  ui.setLoading(0.94, 'SUNUCUYA BAĞLANILIYOR…');
  await new Promise((r) => setTimeout(r, 220));
  ui.setLoading(1, 'HAZIR');

  await new Promise((r) => setTimeout(r, 260));
  ui.hideLoading();
  ui.showMenu();
  ui.setMenuStats();

  // keyboard shortcut on menu: enter starts match select
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Enter' && ui.isMenuOpen() && !game) {
      ui.showAgentSelect();
    }
  });
}

boot();

window.addEventListener('error', (e) => {
  console.error('Runtime error:', e.error);
});

// expose for debugging in the console
window.__cv = { get game() { return game; }, ui };
