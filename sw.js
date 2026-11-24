// sw.js — offline support for the installed app.
//
// Our own files: network first, so players always get the latest version when
// online; the cache is only a fallback for when they're offline.
// CDN scripts and fonts: served from cache, refreshed in the background.
// Supabase: never cached.

const CACHE = 'pancake-v41';
const SHELL = [
  './', 'index.html', 'style.css', 'story.css', 'signal.css', 'name-step.css', 'privacy.html', 'manifest.webmanifest',
  'i18n.js', 'countries.js', 'borders.js', 'data.js', 'trivia-options.js', 'country-facts.js', 'hints.js',
  'story-data.js', 'home-country.js', 'story-audio.js', 'story.js',
  'store.js', 'gk-session.js', 'cloud.js', 'analytics.js', 'scoring.js', 'name-step.js', 'coach.js', 'spyglass.js', 'rooms.js', 'game.js', 'progress.js', 'notify.js', 'feedback.js', 'signal-data.js', 'pin.js', 'signal.js',
  'icons/icon-192.png', 'icons/badge-96.png', 'icons/favicon.svg', 'icons/logo-dark.svg', 'icons/logo-light.svg', 'icons/mark-dark.svg',
];
const NETWORK_TIMEOUT_MS = 4000;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// One version per page. A page and its scripts must come from the same
// release: a new index.html with an old game.js (or the reverse) crashes the
// app while it loads. So a page that came from the network gets its scripts
// from the network (the cache only if the network fails outright), and a page
// served from the cache (offline, or the network was too slow) gets cached
// scripts too.
const cachedPages = new Set();   // ids of windows whose page came from the cache

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname.endsWith('supabase.co')) return;

  if (url.origin !== self.location.origin) { event.respondWith(staleWhileRevalidate(req)); return; }
  if (req.mode === 'navigate') { event.respondWith(page(event)); return; }
  event.respondWith(cachedPages.has(event.clientId) ? cacheFirst(req) : networkThenCache(req));
});

async function page(event) {
  const res = await networkFirst(event.request);
  if (res.headers.get('x-from-cache') === '1' && event.resultingClientId) cachedPages.add(event.resultingClientId);
  return res;
}

async function networkThenCache(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (e) {
    const hit = await cache.match(req);
    if (hit) return hit;
    throw e;
  }
}

async function cacheFirst(req) {
  const hit = await (await caches.open(CACHE)).match(req);
  return hit || networkThenCache(req);
}

// Marks a cached response so page() knows where it came from
function fromCache(res) {
  const h = new Headers(res.headers);
  h.set('x-from-cache', '1');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await Promise.race([
      fetch(req),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), NETWORK_TIMEOUT_MS)),
    ]);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (e) {
    // Invite links etc. carry a query string — any cached copy of the page will do
    const hit = await cache.match(req, { ignoreSearch: req.mode === 'navigate' });
    if (hit) return fromCache(hit);
    if (req.mode === 'navigate') {
      const page = await cache.match('./');
      if (page) return fromCache(page);
    }
    throw e;
  }
}

async function staleWhileRevalidate(req) {
  const cache   = await caches.open(CACHE);
  const hit     = await cache.match(req);
  const refresh = fetch(req).then(res => {
    if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
    return res;
  });
  if (hit) {
    refresh.catch(() => {});
    return hit;
  }
  return refresh;
}

// ============================================================
// Push notifications (sent by supabase/functions/push; see notify.js)
// ============================================================
// Every push must show a notification: iPhones stop delivering to apps that
// receive pushes silently, and Chrome shows a generic one instead.
self.addEventListener('push', event => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = { body: event.data ? event.data.text() : '' }; }
  const title = d.title || 'Borderline';
  const options = {
    body: d.body || 'A new mystery country is waiting.',
    icon: 'icons/icon-192.png',
    badge: 'icons/badge-96.png',            // Android status bar: white on transparent
    tag: d.tag || d.kind || 'borderline',   // a newer one of the same kind replaces the old
    renotify: !!d.renotify,
    data: { url: d.url || './?s=push', kind: d.kind || '' },
    timestamp: Date.now(),
  };
  event.waitUntil(Promise.all([
    self.registration.showNotification(title, options),
    self.navigator && self.navigator.setAppBadge ? self.navigator.setAppBadge(1).catch(() => {}) : null,   // dot on the home-screen icon
  ]));
});

// Tapping one: bring the app forward (or open it) and let it go where the push points
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || './', self.registration.scope).href;
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const win = wins.find(w => w.url.startsWith(self.registration.scope));
    if (win) {
      await win.focus();
      win.postMessage({ type: 'push-open', url });
      return;
    }
    await self.clients.openWindow(url);
  })());
});

// The browser rotated the subscription: make a new one with the same key. The app
// saves it to the server on its next visit (notify.js sync), and the old one is
// dropped by the server when the push service says it's gone.
self.addEventListener('pushsubscriptionchange', event => {
  const key = event.oldSubscription && event.oldSubscription.options && event.oldSubscription.options.applicationServerKey;
  if (!key) return;
  event.waitUntil(self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }).catch(() => {}));
});
