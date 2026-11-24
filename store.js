// store.js — local persistence for the current player.
// The device is the source of truth; cloud.js uploads games to Supabase
// and merges in games played on other devices.

const APP_NAME     = 'Borderline';
const STORE_KEY    = 'pancake_store_v2';
const CURRENT_KEY  = 'pancake_current_v2';
const THEME_KEY    = 'pancake_theme';
const SEEN_HELP_KEY = 'pancake_seen_help';
const DAILY_EPOCH  = '2026-09-27'; // Daily #1

// ============================================================
// Dates — everything keyed by UTC day so every player worldwide
// gets the same Daily and it resets at the same moment.
// ============================================================
function utcDay(d = new Date()) {
  return d.toISOString().slice(0, 10); // "YYYY-MM-DD"
}

// Whole days from a → b ("YYYY-MM-DD" strings parse as UTC midnight)
function dayDiff(a, b) {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
}

function dailyNumber(day = utcDay()) {
  return dayDiff(DAILY_EPOCH, day) + 1;
}

function nextDailyAt() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
}

function formatCountdown(ms) {
  const mins = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// Deterministic Daily pick. Days run through a seeded shuffle of COUNTRIES,
// one cycle after another, so every country comes up once before any repeats,
// and at least DAILY_MIN_GAP days pass before a country is the answer again
// (even across the seam between two cycles).
// The server keeps a copy of this schedule — after changing it or countries.js,
// re-run supabase/gen-daily-answers.js.
function seededRandom(seed) {
  return () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), seed | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DAILY_MIN_GAP = 40;
const _cycles = new Map();
function dailyCycle(cycle) {
  if (!_cycles.has(cycle)) {
    const order = COUNTRIES.map((_, i) => i);
    const rand  = seededRandom(cycle * 7919 + 17);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    // Countries from the end of the previous cycle can't open this one:
    // move them past the first DAILY_MIN_GAP days (order otherwise kept)
    if (cycle > 0) {
      const recent = new Set(dailyCycle(cycle - 1).slice(-DAILY_MIN_GAP));
      const head   = order.filter(i => !recent.has(i)).slice(0, DAILY_MIN_GAP);
      const inHead = new Set(head);
      order.splice(0, order.length, ...head, ...order.filter(i => !inHead.has(i)));
    }
    _cycles.set(cycle, order);
  }
  return _cycles.get(cycle);
}

function dailyIndex(day = utcDay()) {
  const n   = Math.max(0, dayDiff(DAILY_EPOCH, day));
  const len = COUNTRIES.length;
  return dailyCycle(Math.floor(n / len))[n % len];
}

// ============================================================
// Storage helpers — localStorage can throw (private mode, quota)
// ============================================================
function readJSON(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}
function writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

function uuid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// ============================================================
// Player store
// { version, profile: { id, createdAt },
//   games: [{ id, ts, day, mode, mystery, won, guessCount, temps, score, triviaCorrect }],
//   daily: { lastDay, streak, bestStreak } }
// ============================================================
function defaultStore() {
  return {
    version: 2,
    profile: { id: uuid(), createdAt: new Date().toISOString() },
    games:   [],
    daily:   { lastDay: null, streak: 0, bestStreak: 0 },
  };
}

let _store = null;

function loadStore() {
  if (_store) return _store;
  const s = readJSON(STORE_KEY);
  if (s && s.version === 2 && s.profile && Array.isArray(s.games)) {
    if (!s.daily) s.daily = { lastDay: null, streak: 0, bestStreak: 0 };
    _store = s;
  } else {
    _store = defaultStore();
    writeJSON(STORE_KEY, _store);
  }
  return _store;
}

function saveStore() {
  writeJSON(STORE_KEY, loadStore());
}

// Streak = consecutive UTC days on which the Daily was played.
// Alive if the last Daily was today or yesterday.
function currentDailyStreak() {
  const d = loadStore().daily;
  if (!d.lastDay) return 0;
  return dayDiff(d.lastDay, utcDay()) <= 1 ? d.streak : 0;
}

function recordGame(game) {
  const s   = loadStore();
  const day = game.day || utcDay();
  s.games.push({ id: uuid(), ts: Date.now(), ...game, day });

  if (game.mode === 'daily' && s.daily.lastDay !== day) {
    s.daily.streak     = s.daily.lastDay && dayDiff(s.daily.lastDay, day) === 1 ? s.daily.streak + 1 : 1;
    s.daily.lastDay    = day;
    s.daily.bestStreak = Math.max(s.daily.bestStreak, s.daily.streak);
  }
  saveStore();
}

// Rebuild the Daily streak from the game list (after merging games from the server)
function recomputeDaily() {
  const s    = loadStore();
  const days = [...new Set(s.games.filter(g => g.mode === 'daily').map(g => g.day))].sort();
  const d    = { lastDay: null, streak: 0, bestStreak: 0 };
  for (const day of days) {
    d.streak     = d.lastDay && dayDiff(d.lastDay, day) === 1 ? d.streak + 1 : 1;
    d.lastDay    = day;
    d.bestStreak = Math.max(d.bestStreak, d.streak);
  }
  s.daily = d;
}

// Add games from another device; returns how many were new
function mergeGames(incoming) {
  const s     = loadStore();
  const known = new Set(s.games.map(g => g.id));
  const fresh = incoming.filter(g => !known.has(g.id));
  if (!fresh.length) return 0;
  s.games.push(...fresh);
  s.games.sort((a, b) => a.ts - b.ts);
  recomputeDaily();
  saveStore();
  return fresh.length;
}

// ============================================================
// Cloud sync bookkeeping — which account the local games were
// last uploaded to, and which of them are already there.
// ============================================================
function getSyncState() {
  const s = loadStore();
  if (!s.sync) s.sync = { userId: null, uploaded: [] };
  return s.sync;
}

function setSyncState(sync) {
  loadStore().sync = sync;
  saveStore();
}

// After signing out: this device starts over as a new guest
function resetLocalData() {
  _store = defaultStore();
  saveStore();
  writeJSON(CURRENT_KEY, {});
}

function getDailyResult(day = utcDay()) {
  return loadStore().games.find(g => g.mode === 'daily' && g.day === day) || null;
}

// Mysteries from recent games, so random picks don't repeat too soon
function recentMysteries(n = 25) {
  return loadStore().games.slice(-n).map(g => g.mystery);
}

// ============================================================
// Random modes (Classic, Endless) deal from a shuffled deck of every
// country, kept per player: all of them come up, in random order, before
// any repeats. A fresh deck puts recently played countries at the back.
// ============================================================
const DECK_KEY = 'pancake_deck_v1';

function randomInt(n) {
  if (window.crypto && crypto.getRandomValues) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] % n;
  }
  return Math.floor(Math.random() * n);
}

function freshDeck() {
  const deck = COUNTRIES.map(c => c.name);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  const recent = new Set(recentMysteries());
  return [...deck.filter(n => !recent.has(n)), ...deck.filter(n => recent.has(n))];
}

// Next country name from the deck, skipping (but keeping) any in `skip`
function dealCountry(skip = new Set()) {
  const known = new Set(COUNTRIES.map(c => c.name));
  let deck = (readJSON(DECK_KEY) || []).filter(n => known.has(n));
  let i = deck.findIndex(n => !skip.has(n));
  if (i < 0) {
    deck = freshDeck();
    i = deck.findIndex(n => !skip.has(n));
  }
  const [name] = deck.splice(i, 1);
  writeJSON(DECK_KEY, deck);
  return name;
}

// ============================================================
// Stats for the stats sheet
// ============================================================
function computeStats(mode = 'all') {
  // Endless was merged into Classic; old Endless games count as Classic
  const games = loadStore().games.filter(g => mode === 'all' || g.mode === mode || (mode === 'classic' && g.mode === 'endless'));
  const wins  = games.filter(g => g.won);

  // Guess distribution: 1…9, "10+" (Classic is unlimited), and "X" for losses
  const dist = Array(10).fill(0);
  let losses = 0;
  for (const g of games) {
    if (!g.won) { losses++; continue; }
    dist[Math.min(g.guessCount, 10) - 1]++;
  }

  return {
    played:     games.length,
    wins:       wins.length,
    winRate:    games.length ? Math.round(wins.length / games.length * 100) : 0,
    avgGuesses: wins.length ? (wins.reduce((a, g) => a + g.guessCount, 0) / wins.length).toFixed(1) : '—',
    bestScore:  games.reduce((m, g) => Math.max(m, g.score || 0), 0),
    totalScore: games.reduce((a, g) => a + (g.score || 0), 0),
    streak:     currentDailyStreak(),
    bestStreak: loadStore().daily.bestStreak,
    dist,
    losses,
  };
}

// ============================================================
// In-progress games, one slot per mode — survive a refresh, and
// stop the Daily being re-rolled by reloading after a bad start.
// { daily|classic|endless: { mode, day, mystery, guesses: [names], triviaCorrect, flagHint } }
// ============================================================
function saveCurrentGame(state) {
  const all = readJSON(CURRENT_KEY) || {};
  all[state.mode] = state;
  writeJSON(CURRENT_KEY, all);
}

function clearCurrentGame(mode) {
  const all = readJSON(CURRENT_KEY) || {};
  delete all[mode];
  writeJSON(CURRENT_KEY, all);
}

// Endless was merged into Classic (now unlimited): carry an in-progress
// Endless game over, unless there's already a Classic one to resume.
(function migrateEndless() {
  const all = readJSON(CURRENT_KEY);
  if (!all || !all.endless) return;
  if (!all.classic) all.classic = { ...all.endless, mode: 'classic' };
  delete all.endless;
  writeJSON(CURRENT_KEY, all);
})();

function loadCurrentGame(mode) {
  const c = (readJSON(CURRENT_KEY) || {})[mode];
  if (!c || !c.mystery || !Array.isArray(c.guesses)) return null;
  // A Daily from a previous day can't be continued
  if (mode === 'daily' && c.day !== utcDay()) { clearCurrentGame(mode); return null; }
  return c;
}
