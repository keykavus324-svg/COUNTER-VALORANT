/**
 * Persistent career profile.
 *
 * Everything the player has ever done in COUNTER-STRIKE: BROWSER OPS is kept in
 * localStorage: match history, per map win rates, per weapon kills, accuracy,
 * headshot ratio and the usual CS career numbers. The UI reads it through the
 * helpers below so the menu, the match end screen and the stats panel always
 * agree on what a number means.
 */

const KEY = 'csbo.profile.v2';
const HISTORY_LIMIT = 20;

export const EMPTY_PROFILE = Object.freeze({
  version: 2,
  createdAt: 0,
  matches: 0,
  wins: 0,
  losses: 0,
  draws: 0,
  rounds: 0,
  kills: 0,
  deaths: 0,
  assists: 0,
  headshotKills: 0,
  shots: 0,
  hits: 0,
  damage: 0,
  plants: 0,
  defuses: 0,
  roundsWon: 0,
  mvps: 0,
  aces: 0,
  bestRating: 0,
  clutchWins: 0,
  maps: {},
  weapons: {},
  stattrak: {},
  history: [],
});

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function sanitise(raw) {
  const base = { ...EMPTY_PROFILE };
  if (!raw || typeof raw !== 'object') return base;
  for (const key of Object.keys(EMPTY_PROFILE)) {
    if (['maps', 'weapons', 'stattrak', 'history', 'createdAt', 'version'].includes(key)) continue;
    base[key] = num(raw[key]);
  }
  base.maps = raw.maps && typeof raw.maps === 'object' ? raw.maps : {};
  base.weapons = raw.weapons && typeof raw.weapons === 'object' ? raw.weapons : {};
  base.stattrak = raw.stattrak && typeof raw.stattrak === 'object' ? raw.stattrak : {};
  base.history = Array.isArray(raw.history) ? raw.history.slice(0, HISTORY_LIMIT) : [];
  base.createdAt = num(raw.createdAt) || Date.now();
  base.version = 2;
  return base;
}

let cached = null;

export function loadProfile() {
  if (cached) return cached;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    cached = sanitise(raw);
  } catch {
    cached = sanitise(null);
  }
  return cached;
}

export function saveProfile(p = cached) {
  if (!p) return;
  cached = p;
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch { /* private mode / quota — the profile stays in memory */ }
}

export function resetProfile() {
  cached = sanitise(null);
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  return cached;
}

/* ------------------------------------------------------------------ */
/* derived numbers                                                    */
/* ------------------------------------------------------------------ */
export const kdRatio = (p) => (p.deaths ? p.kills / p.deaths : p.kills);
export const accuracy = (p) => (p.shots ? (p.hits / p.shots) * 100 : 0);
export const hsPercent = (p) => (p.kills ? (p.headshotKills / p.kills) * 100 : 0);
export const winRate = (p) => {
  const played = p.wins + p.losses + p.draws;
  return played ? (p.wins / played) * 100 : 0;
};
export const adr = (p) => (p.rounds ? p.damage / p.rounds : 0);
/** CS style 0 – 2 rating, weighted towards K/D and impact. */
export const rating = (p) => {
  if (!p.rounds) return 0;
  const kpr = p.kills / p.rounds;
  const dpr = p.deaths / p.rounds;
  const impact = (p.headshotKills * 1.1 + p.plants * 0.5 + p.defuses * 0.6) / p.rounds;
  const raw = (kpr - dpr) * 0.85 + 0.95 + impact * 0.22;
  return Math.max(0, Math.min(2.6, raw));
};

export function mapStats(p, mapId) {
  const row = p.maps?.[mapId];
  if (!row) return { played: 0, won: 0, rate: 0, kills: 0, deaths: 0 };
  const played = num(row.played);
  const won = num(row.won);
  return { played, won, rate: played ? (won / played) * 100 : 0, kills: num(row.kills), deaths: num(row.deaths) };
}

export function topWeapons(p, limit = 5) {
  return Object.entries(p.weapons || {})
    .map(([id, kills]) => ({ id, kills: num(kills) }))
    .sort((a, b) => b.kills - a.kills)
    .slice(0, limit);
}

/* ------------------------------------------------------------------ */
/* recording                                                          */
/* ------------------------------------------------------------------ */
/**
 * Fold one finished match into the career profile.
 * @param {{map:string, win:boolean, draw?:boolean, allyScore:number, enemyScore:number,
 *          player:{kills:number,deaths:number,assists?:number,headshots?:number,shots?:number,
 *                  hits?:number,damage?:number,plants?:number,defuses?:number},
 *          weapons?:Record<string,number>, rounds?:number, mvp?:boolean, aces?:number}} m
 */
export function recordMatch(m) {
  const p = loadProfile();
  if (!m) return p;
  const player = m.player || {};
  const win = !!m.win;
  const draw = !!m.draw;
  p.matches += 1;
  if (draw) p.draws += 1;
  else if (win) p.wins += 1;
  else p.losses += 1;
  p.kills += num(player.kills);
  p.deaths += num(player.deaths);
  p.assists += num(player.assists);
  p.headshotKills += num(player.headshots);
  p.shots += num(player.shots);
  p.hits += num(player.hits);
  p.damage += num(player.damage);
  p.plants += num(player.plants);
  p.defuses += num(player.defuses);
  p.rounds += num(m.rounds);
  p.roundsWon += num(m.roundsWon);
  p.aces += num(m.aces);
  if (m.mvp) p.mvps += 1;
  if (m.clutch) p.clutchWins += 1;

  const mapId = m.map || 'unknown';
  const row = p.maps[mapId] || { played: 0, won: 0, kills: 0, deaths: 0 };
  row.played += 1;
  if (win && !draw) row.won += 1;
  row.kills += num(player.kills);
  row.deaths += num(player.deaths);
  p.maps[mapId] = row;

  for (const [wid, kills] of Object.entries(m.weapons || {})) {
    p.weapons[wid] = num(p.weapons[wid]) + num(kills);
  }

  const r = rating(p);
  p.bestRating = Math.max(p.bestRating, r);
  p.history.unshift({
    map: mapId,
    win,
    draw,
    ally: num(m.allyScore),
    enemy: num(m.enemyScore),
    kills: num(player.kills),
    deaths: num(player.deaths),
    at: Date.now(),
  });
  p.history = p.history.slice(0, HISTORY_LIMIT);
  saveProfile(p);
  return p;
}

/** Shape the profile for the stats panel. */
export function profileSummary(p = loadProfile()) {
  return {
    matches: p.matches,
    wins: p.wins,
    losses: p.losses,
    draws: p.draws,
    winRate: winRate(p),
    kd: kdRatio(p),
    accuracy: accuracy(p),
    hsPercent: hsPercent(p),
    adr: adr(p),
    rating: rating(p),
    kills: p.kills,
    deaths: p.deaths,
    assists: p.assists,
    rounds: p.rounds,
    plants: p.plants,
    defuses: p.defuses,
    aces: p.aces,
    mvps: p.mvps,
    bestRating: p.bestRating,
    topWeapons: topWeapons(p),
    history: p.history,
    maps: p.maps,
  };
}

/* ------------------------------------------------------------------ */
/* StatTrak                                                           */
/* ------------------------------------------------------------------ */
/** Increase the kill counter of one finish (StatTrak™ style). */
export function bumpStatTrak(skinId, by = 1) {
  if (!skinId) return 0;
  const p = loadProfile();
  p.stattrak[skinId] = num(p.stattrak[skinId]) + by;
  saveProfile(p);
  return p.stattrak[skinId];
}

export function statTrakCount(skinId) {
  if (!skinId) return 0;
  return num(loadProfile().stattrak[skinId]);
}
