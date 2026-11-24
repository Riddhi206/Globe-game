// analytics.js — product events, visitor stats and error reports.
//
//   track(name, props)  → public.events in Supabase (see 005_events.sql)
//   Cloudflare Web Analytics → page views, countries, devices, referrers (cookie-free)
//   Sentry → JavaScript errors with browser/device details
//
// Privacy: no names, emails or IP addresses are stored by us; the user id is
// the random Supabase id. Everything here is best-effort and never blocks play.

const APP_VERSION = '2026.10.07';   // bump on each release (with CACHE in sw.js): Sentry groups errors by it

// Fill these in to switch the services on; empty = off
const CLOUDFLARE_BEACON_TOKEN = '2060393c24c545d3883f2b7f5c43105c';
const SENTRY_DSN              = 'https://111563c20a1d8f934a22bfc8449718a8@o4512170231201792.ingest.us.sentry.io/4512170238017536';

// ============================================================
// Context sent with every event — coarse on purpose
// ============================================================
const SESSION_ID = uuid();

function deviceContext() {
  const ua = navigator.userAgent;
  const os = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ? 'ios'
           : /android/i.test(ua) ? 'android'
           : /windows/i.test(ua) ? 'windows'
           : /mac os/i.test(ua) ? 'macos'
           : /cros/i.test(ua) ? 'chromeos'
           : /linux/i.test(ua) ? 'linux' : 'other';
  const browser = /samsungbrowser/i.test(ua) ? 'samsung'
                : /edg\//i.test(ua) ? 'edge'
                : /firefox|fxios/i.test(ua) ? 'firefox'
                : /crios|chrome/i.test(ua) ? 'chrome'
                : /safari/i.test(ua) ? 'safari' : 'other';
  const w = Math.min(screen.width, screen.height);
  return {
    v:       APP_VERSION,
    os,
    browser,
    device:  !matchMedia('(pointer: coarse)').matches ? 'desktop' : w >= 600 ? 'tablet' : 'phone',
    screen:  `${screen.width}x${screen.height}`,
    lang:    (navigator.language || '').slice(0, 5),
    app:     matchMedia('(display-mode: standalone)').matches || navigator.standalone === true,
    theme:   document.documentElement.dataset.theme || 'system',
    tz:      (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch { return ''; } })(),
  };
}

// ============================================================
// Attribution — where this visit came from. Share links carry
// ?s=<surface>&r=<referral code>; campaigns can use utm_*.
// Read once at load (before invites are handled), then the tags
// are removed from the address bar so a reload doesn't count twice.
// The referral code is the first 8 characters of the sharer's random
// player id: enough to count invites, never a name or email.
// ============================================================
const LANDING = (() => {
  const out = {};
  try {
    const q = new URLSearchParams(location.search);
    const pick = (k, max = 40) => (q.get(k) || '').replace(/[^\w.\-]/g, '').slice(0, max);
    out.src      = pick('s') || pick('utm_source');
    out.ref      = pick('r', 8);
    out.medium   = pick('utm_medium');
    out.campaign = pick('utm_campaign');
    out.content  = pick('utm_content');     // which cafe, on printed QRs
    out.push     = pick('n', 20);            // which notification was tapped (with s=push)
    out.kind     = q.has('ch') ? 'challenge' : q.has('room') ? 'room' : q.has('friend') ? 'friend' : q.has('tv') ? 'tv' : '';
    for (const k of ['s', 'r', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) q.delete(k);
    const qs = q.toString();
    if (qs !== location.search.replace(/^\?/, '')) history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
  } catch {}
  for (const k of Object.keys(out)) if (!out[k]) delete out[k];
  return out;
})();

// The current player's referral code, for links they share
function shareRef() {
  return typeof cloudUser !== 'undefined' && cloudUser && cloudUser.id ? cloudUser.id.replace(/-/g, '').slice(0, 8) : '';
}

// Adds the share tags to a link: where it was shared from, and by whom
function tagLink(url, surface) {
  if (!url || !surface) return url;
  try {
    const u = new URL(url);
    u.searchParams.set('s', surface);
    const r = shareRef();
    if (r) u.searchParams.set('r', r);
    return u.toString();
  } catch { return url; }
}

// ============================================================
// Event queue — batched, flushed every few seconds and when the
// page is hidden. Waits for the anonymous sign-in; kept in memory only.
// ============================================================
const EVENT_QUEUE_MAX = 200;
const _eventQueue = [];
let _context = null;
let _flushing = false;

function track(name, props = {}) {
  try {
    if (!_context) _context = deviceContext();
    if (_eventQueue.length >= EVENT_QUEUE_MAX) _eventQueue.shift();
    _eventQueue.push({ name, props, at: new Date().toISOString() });
  } catch (e) {
    console.warn('track failed', e);
  }
}

async function flushEvents() {
  if (_flushing || !_eventQueue.length || !sb || !cloudUser) return;
  _flushing = true;
  const batch = _eventQueue.splice(0, 50);
  const rows = batch.map(e => ({
    user_id:    cloudUser.id,
    session_id: SESSION_ID,
    name:       e.name,
    props:      e.props,
    context:    _context,
    created_at: e.at,
  }));
  try {
    const { error } = await sb.from('events').insert(rows);
    if (error && !error.code) throw error;          // network: retry later
    if (error) console.warn('events rejected:', error.message);
  } catch {
    _eventQueue.unshift(...batch);                  // keep for the next try
  } finally {
    _flushing = false;
  }
}

// Time actually spent with the game on screen, sent each time it's hidden
let _visibleSince = document.hidden ? null : performance.now();
function noteSessionTime() {
  if (_visibleSince == null) return;
  const seconds = Math.round((performance.now() - _visibleSince) / 1000);
  _visibleSince = null;
  if (seconds >= 1) track('session_time', { seconds: Math.min(seconds, 4 * 3600) });
}

setInterval(flushEvents, 8000);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { noteSessionTime(); flushEvents(); }
  else _visibleSince = performance.now();
});
window.addEventListener('pagehide', () => { noteSessionTime(); flushEvents(); });

// ============================================================
// Cloudflare Web Analytics + Sentry (only when configured)
// ============================================================
function loadScript(src, attrs = {}) {
  const s = document.createElement('script');
  s.src = src;
  s.defer = true;
  s.crossOrigin = 'anonymous';
  for (const [k, v] of Object.entries(attrs)) s.setAttribute(k, v);
  document.head.appendChild(s);
  return s;
}

function initMonitoring() {
  const live = /^https?:$/.test(location.protocol) && location.hostname !== 'localhost';
  if (!live) return;

  if (CLOUDFLARE_BEACON_TOKEN) {
    loadScript('https://static.cloudflareinsights.com/beacon.min.js',
      { 'data-cf-beacon': JSON.stringify({ token: CLOUDFLARE_BEACON_TOKEN }) });
  }

  // Sentry's loader script is keyed by the DSN's public key
  const sentryKey = (SENTRY_DSN.match(/^https:\/\/([0-9a-f]+)@/) || [])[1];
  if (sentryKey) {
    window.sentryOnLoad = () => {
      Sentry.init({
        dsn: SENTRY_DSN,
        release: `pancake@${APP_VERSION}`,
        sendDefaultPii: false,
        tracesSampleRate: 0,
        // "Script error." is a crash inside another site's script (Google sign-in, a CDN):
        // the browser hides every detail, so there's nothing to act on
        ignoreErrors: [/^Script error\.?$/],
      });
      Sentry.setContext('app', deviceContext());
      // Which service-worker cache served this page: tells an old cached build from the latest
      if (window.caches) caches.keys().then(k => { const v = k.find(x => x.startsWith('pancake-')); if (v) Sentry.setTag('sw_cache', v); }).catch(() => {});
      if (sessionStorage.getItem(HEAL_KEY)) Sentry.setTag('healed', 'yes');
      if (cloudUser) Sentry.setUser({ id: cloudUser.id });
    };
    loadScript(`https://js.sentry-cdn.com/${sentryKey}.min.js`);
  }
}

// Tag errors with the player's random id once known
onCloudChange(() => {
  if (cloudUser && window.Sentry && Sentry.setUser) Sentry.setUser({ id: cloudUser.id });
  flushEvents();
});

initMonitoring();

// Self-heal: if our own code crashes while the page is still loading (a page and
// its scripts from two different releases), reload once. The fixed service worker
// then serves a matching set. Once per tab, so a real bug can't cause a reload loop.
const HEAL_KEY = 'borderline_healed';
window.addEventListener('error', e => {
  try {
    if (performance.now() > 15000 || sessionStorage.getItem(HEAL_KEY)) return;
    if (!e.filename || !e.filename.startsWith(location.origin)) return;
    if (!/before initialization|is not defined|null is not an object|Cannot read properties of null|is null/i.test(e.message || '')) return;
    sessionStorage.setItem(HEAL_KEY, String(Date.now()));
    track('app_self_heal', { error: String(e.message).slice(0, 120), file: e.filename.split('/').pop() });
    flushEvents().catch(() => {}).finally(() => location.reload());
  } catch {}
});
