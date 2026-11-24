// cloud.js — Supabase auth + game sync.
// Best-effort only: the game plays fully offline, and nothing here blocks play.
//
// Every visitor is signed in anonymously on first load. "Continue with Google"
// links Google to that same user, so games played as a guest are kept.

const SUPABASE_URL = 'https://ojhhqixgrmyeejwktebj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_l12lf-FgNk9Q0kJpqAghxg_IKaBdp6F'; // publishable: safe in the browser, RLS guards the data

// Read before supabase-js tidies the URL after an OAuth redirect
const REDIRECT_PARAMS = new URLSearchParams(location.search.slice(1) + '&' + location.hash.slice(1));

// The session lives in a cookie shared by every *.gamekatta.com site (gk-session.js), so a player is
// the same player in Tatva and the other GameKatta games. A session already in this browser's
// localStorage moves into the cookie first, once.
if (window.gkSession) gkSession.adoptLocal();
const sb = window.supabase
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, window.gkSession ? { auth: gkSession.auth } : undefined)
  : null;

let cloudUser     = null;
let cloudUsername = null;
let cloudFriends  = [];   // [{ id, username, status: 'friend' | 'incoming' | 'outgoing' }]
let friendChannel = null; // Realtime subscription: new requests + new friendships
let cloudStatus = sb ? 'connecting' : 'offline'; // 'connecting' | 'ready' | 'offline'

const cloudListeners = [];
function onCloudChange(fn) { cloudListeners.push(fn); }
function emitCloud() { cloudListeners.forEach(fn => fn()); }

function isGuest() { return !cloudUser || cloudUser.is_anonymous; }

function cloudEmail() {
  if (!cloudUser) return '';
  const google = (cloudUser.identities || []).find(i => i.provider === 'google');
  return cloudUser.email || google?.identity_data?.email || '';
}

function redirectUrl() {
  return location.origin + location.pathname;
}

// ============================================================
// Row mapping — store.js game record ⇄ public.games
// ============================================================
function toRow(g, userId) {
  return {
    user_id:        userId,
    id:             g.id,
    mode:           g.mode,
    day:            g.day,
    mystery:        g.mystery,
    won:            g.won,
    guess_count:    g.guessCount,
    temps:          g.temps || [],
    score:          g.score || 0,
    trivia_correct: g.triviaCorrect || 0,
    first_guess:    g.firstGuess || null,
    guesses:        g.guesses || null,
    played_at:      new Date(g.ts).toISOString(),
  };
}

function fromRow(r) {
  return {
    id:            r.id,
    ts:            Date.parse(r.played_at),
    mode:          r.mode,
    day:           r.day,
    mystery:       r.mystery,
    won:           r.won,
    guessCount:    r.guess_count,
    temps:         r.temps || [],
    score:         r.score,
    triviaCorrect: r.trivia_correct,
    firstGuess:    r.first_guess || '',
    guesses:       r.guesses || undefined,
  };
}

// ============================================================
// Sync — upload local games the account doesn't have yet, and
// (for Google accounts) pull in games played on other devices.
// Calls are chained so two syncs never overlap.
// ============================================================
let syncChain = Promise.resolve();

function syncGames({ pull = false } = {}) {
  const run = syncChain.catch(() => {}).then(() => doSync(pull));
  syncChain = run;
  return run;
}

async function doSync(pull) {
  if (!sb || !cloudUser) return;
  const userId = cloudUser.id;

  const prev = getSyncState();
  const done = new Set(prev.userId === userId ? prev.uploaded : []);

  const pending = loadStore().games.filter(g => !done.has(g.id) && g.guessCount >= 1);
  if (pending.length) {
    const { error } = await sb.from('games')
      .upsert(pending.map(g => toRow(g, userId)), { onConflict: 'user_id,id', ignoreDuplicates: true });
    if (error) throw error;
    pending.forEach(g => done.add(g.id));
  }

  if (pull && !cloudUser.is_anonymous) {
    const { data, error } = await sb.from('games')
      .select('*').order('played_at', { ascending: false }).limit(1000);
    if (error) throw error;
    const added = mergeGames(data.map(fromRow));
    data.forEach(r => done.add(r.id));
    if (added) emitCloud();
  }

  const submitted = new Set(prev.userId === userId ? prev.submitted || [] : []);
  await submitDailies(submitted);

  setSyncState({ userId, uploaded: [...done], submitted: [...submitted] });
}

// Send finished Dailies to the leaderboard. The server re-checks each one
// (see submit_daily in 002_leaderboard.sql); a rejected game is not retried,
// a network failure is.
async function submitDailies(submitted) {
  const yesterday = utcDay(new Date(Date.now() - 86400000));
  const pending = loadStore().games.filter(g =>
    g.mode === 'daily' && g.day >= yesterday && g.guesses?.length && !submitted.has(g.id));

  for (const g of pending) {
    const { error } = await sb.rpc('submit_daily', { p_day: g.day, p_guesses: g.guesses, p_score: g.score || 0 });
    if (error && !error.code) throw error;
    if (error) console.warn('Daily rejected:', error.message);
    submitted.add(g.id);
  }
}

// ============================================================
// Username + leaderboard
// ============================================================
// ============================================================
// Roles and feature switches (supabase/008_roles.sql)
// Fetched once per sign-in and cached, so the last known access works
// offline. Anything risky must also be checked on the server
// (has_feature()) — this only decides what the app shows.
// ============================================================
const ACCESS_KEY = 'pancake_access';
let cloudRole     = 'player';      // 'admin' | 'manager' | 'tester' | 'player'
let cloudFeatures = new Set();     // feature keys switched on for this player

(function loadCachedAccess() {
  const a = readJSON(ACCESS_KEY);
  if (a && Array.isArray(a.features)) { cloudRole = a.role || 'player'; cloudFeatures = new Set(a.features); }
})();

function hasFeature(key) { return cloudFeatures.has(key); }

async function loadAccess() {
  const { data, error } = await sb.rpc('my_access');
  if (error) throw error;
  cloudRole     = (data && data.role) || 'player';
  cloudFeatures = new Set((data && data.features) || []);
  writeJSON(ACCESS_KEY, { role: cloudRole, features: [...cloudFeatures] });
}

function clearAccess() {
  cloudRole = 'player';
  cloudFeatures = new Set();
  writeJSON(ACCESS_KEY, { role: 'player', features: [] });
}

async function loadUsername() {
  const { data, error } = await sb.from('profiles').select('username').eq('id', cloudUser.id).maybeSingle();
  if (error) throw error;
  cloudUsername = data?.username || null;
}

const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;

// Returns null on success, or a message for the player
async function setUsername(name) {
  if (!USERNAME_RE.test(name)) return '3–20 letters, numbers or _';
  if (!sb || !cloudUser) return 'You’re offline — try again later';
  const { data, error } = await sb.from('profiles')
    .update({ username: name }).eq('id', cloudUser.id).select('username');
  if (error?.code === '23505') return 'That name is taken';
  if (error || !data?.length) { console.warn(error); return 'Couldn’t save — try again'; }
  cloudUsername = data[0].username;
  emitCloud();
  return null;
}

// Top players for a UTC day (everyone, or you + your friends), plus your own row
async function fetchDailyLeaderboard(day = utcDay(), friendsOnly = false) {
  if (!sb || !cloudUser) throw new Error('offline');
  await syncChain.catch(() => {}); // make sure our own Daily has been submitted
  const { data, error } = await sb.rpc('daily_leaderboard', { p_day: day, p_limit: 50, p_friends: friendsOnly });
  if (error) throw error;
  return data;
}

// Everyone's Daily at once (027_daily_stats.sql): { players, beat, dist[11] } for the result screen
async function fetchDailyStats(day = utcDay()) {
  if (!sb || !cloudUser) throw new Error('offline');
  await syncChain.catch(() => {}); // our own Daily has to be in before we're compared
  const { data, error } = await sb.rpc('daily_stats', { p_day: day });
  if (error) throw error;
  return data && data[0];
}

// Yesterday's top named player of the Daily, for home (028_yesterday_best.sql); null when nobody played
async function fetchYesterdayBest() {
  if (!sb || !cloudUser) throw new Error('offline');
  const { data, error } = await sb.rpc('gk_yesterday_best', { p_site: 'borderline' });
  if (error) throw error;
  return (data && data[0]) || null;
}

// Classic's weekly board (022_classic_leaderboard.sql): best 10 finds per player, Monday–Monday UTC
async function fetchClassicLeaderboard(week, friendsOnly = false) {
  if (!sb || !cloudUser) throw new Error('offline');
  await syncChain.catch(() => {}); // make sure our own Classic games have been uploaded
  const { data, error } = await sb.rpc('classic_leaderboard', { p_week: week, p_limit: 50, p_friends: friendsOnly });
  if (error) throw error;
  return data;
}

// How many named players have already played today's Daily — cheap, for
// nudging players toward the leaderboard. Returns null when unavailable.
async function fetchDailyPlayerCount(day = utcDay()) {
  if (!sb || !cloudUser) return null;
  const { data, error } = await sb.rpc('daily_player_count', { p_day: day });
  if (error) { console.warn(error); return null; }
  return data;
}

// ============================================================
// Friends — all changes go through functions in 004_friends.sql.
// Their error messages are written for players, so show them as-is.
// ============================================================
function friendError(error) {
  if (error.code === 'P0001') return error.message;
  console.warn(error);
  return 'Something went wrong — try again';
}

async function loadFriends() {
  if (!sb || !cloudUser) return cloudFriends;
  const { data, error } = await sb.rpc('my_friends');
  if (error) throw error;
  cloudFriends = data;
  emitCloud();
  return cloudFriends;
}

function incomingRequestCount() {
  return cloudFriends.filter(f => f.status === 'incoming').length;
}

// ============================================================
// Realtime: toast + badge the moment a request or acceptance arrives,
// without waiting for the player to reopen the Friends sheet.
// fn is called with { type: 'request' | 'accepted', username }.
// ============================================================
const friendEventListeners = [];
function onFriendEvent(fn) { friendEventListeners.push(fn); }

async function refreshFriendsAndDiff() {
  const before = new Map(cloudFriends.map(f => [f.id, f.status]));
  const after  = await loadFriends();
  for (const f of after) {
    const was = before.get(f.id);
    if (f.status === 'incoming' && was !== 'incoming') {
      friendEventListeners.forEach(fn => fn({ type: 'request', username: f.username }));
    } else if (f.status === 'friend' && was !== 'friend') {
      friendEventListeners.forEach(fn => fn({ type: 'accepted', username: f.username }));
    }
  }
}

function subscribeFriendEvents() {
  if (!sb || !cloudUser) return;
  if (friendChannel) { sb.removeChannel(friendChannel); friendChannel = null; }
  friendChannel = sb.channel(`friends:${cloudUser.id}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'friend_requests', filter: `to_id=eq.${cloudUser.id}` },
        () => refreshFriendsAndDiff().catch(() => {}))
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'friendships', filter: `user_id=eq.${cloudUser.id}` },
        () => refreshFriendsAndDiff().catch(() => {}))
    .subscribe();
}

// Returns { status: 'sent' | 'friends' } or { error: message }
async function addFriend(username) {
  if (!sb || !cloudUser) return { error: 'You’re offline — try again later' };
  const { data, error } = await sb.rpc('send_friend_request', { p_username: username });
  if (error) return { error: friendError(error) };
  await loadFriends().catch(() => {});
  return { status: data };
}

// Returns null on success, or a message
async function acceptFriend(id) {
  const { error } = await sb.rpc('accept_friend_request', { p_from: id });
  if (error) return friendError(error);
  await loadFriends().catch(() => {});
  return null;
}

// Decline, cancel or unfriend
async function removeFriend(id) {
  const { error } = await sb.rpc('remove_friend', { p_other: id });
  if (error) return friendError(error);
  await loadFriends().catch(() => {});
  return null;
}

function inviteUrl() {
  const url = cloudUsername ? `${redirectUrl()}?friend=${encodeURIComponent(cloudUsername)}` : redirectUrl();
  return typeof tagLink === 'function' ? tagLink(url, 'friend') : url;
}

// ============================================================
// Auth
// ============================================================
async function initCloud() {
  if (!sb) return;

  // Linking failed because this Google account already has a player → switch to it
  if (REDIRECT_PARAMS.get('error_code') === 'identity_already_exists') {
    history.replaceState(null, '', location.pathname);
    await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectUrl() } });
    return;
  }

  try {
    const { data } = await sb.auth.getSession();
    let user = data.session?.user || null;
    if (!user) {
      const res = await sb.auth.signInAnonymously();
      if (res.error) throw res.error;
      user = res.data.user;
    }
    cloudUser   = user;
    cloudStatus = 'ready';
    await loadUsername().catch(e => console.warn('Profile unavailable:', e));
    await loadAccess().catch(e => console.warn('Access unavailable:', e));
    emitCloud();
    loadFriends().catch(e => console.warn('Friends unavailable:', e));
    subscribeFriendEvents();

    // Don't call supabase inside this callback (it can deadlock) — just record the user
    sb.auth.onAuthStateChange((_event, session) => {
      if (!session) return;
      const switchedIdentity = cloudUser && session.user.id !== cloudUser.id;
      cloudUser = session.user;
      emitCloud();
      // Linking/switching can resolve without a full page reload in some
      // browsers — if the signed-in id changed, our cached profile and
      // friends belong to the old one, so pull the new ones in.
      if (switchedIdentity) {
        loadUsername().then(emitCloud).catch(() => {});
        loadAccess().then(emitCloud).catch(() => {});
        loadFriends().catch(() => {});
        subscribeFriendEvents();
      }
    });

    await syncGames({ pull: true });
  } catch (e) {
    console.warn('Cloud unavailable:', e);
    if (!cloudUser) cloudStatus = 'offline';
    emitCloud();
  }
}

// Guests link Google to their current user; otherwise a normal sign-in.
// Both redirect away to Google and come back to this page.
async function signInWithGoogle() {
  if (!sb) throw new Error('offline');
  const opts = { provider: 'google', options: { redirectTo: redirectUrl() } };
  const { error } = cloudUser?.is_anonymous
    ? await sb.auth.linkIdentity(opts)
    : await sb.auth.signInWithOAuth(opts);
  if (error) throw error;
}

// Sign-in with Google's own button (Google Identity Services). The consent
// screen then belongs to this site, not the Supabase project's address.
// Google hands us an ID token; Supabase checks it against GOOGLE_CLIENT_ID,
// which must be in the Google provider's "Client IDs" in Supabase.
const GOOGLE_CLIENT_ID = '9012555802-vmh4cdl613aqpub8emsblgn4i5iopon5.apps.googleusercontent.com';

// A fresh nonce per sign-in: Google gets the SHA-256 hash, Supabase the raw value
async function googleNonce() {
  const raw = crypto.randomUUID();
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  return { raw, hashed: [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('') };
}

// Guests link Google to their current user. If that Google account already
// has a player, switch to it (same as the redirect flow's identity_already_exists).
async function signInWithGoogleToken(token, nonce) {
  if (!sb) throw new Error('offline');
  const creds = { provider: 'google', token, nonce };
  if (cloudUser?.is_anonymous) {
    const { error } = await sb.auth.linkIdentity(creds);
    if (!error) return;
    if (error.code !== 'identity_already_exists' && !/already/i.test(error.message)) throw error;
  }
  const { error } = await sb.auth.signInWithIdToken(creds);
  if (error) throw error;
}

// Games belong to the account, so they leave the device with it.
// Only clear once everything is safely uploaded.
async function signOutCloud() {
  await syncGames();
  await Story.flushSync().catch(() => {});
  const { error } = await sb.auth.signOut();
  if (error) throw error;
  resetLocalData();
  Story.resetLocal();
  clearAccess();

  if (friendChannel) { sb.removeChannel(friendChannel); friendChannel = null; }
  cloudUser     = null;
  cloudUsername = null;
  cloudFriends  = [];
  const res = await sb.auth.signInAnonymously();
  cloudUser = res.data?.user || null;
  if (!cloudUser) cloudStatus = 'offline';
  else await loadAccess().catch(() => {});
  emitCloud();
}
