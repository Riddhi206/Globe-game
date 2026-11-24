// notify.js — push notifications in the app: when to ask, subscribing this
// device, the settings sheet, and where a tapped notification takes you.
// The server side (who gets what, when) is supabase/017_push.sql and
// supabase/functions/push. Overview and platform notes: docs/PUSH.md.
//
// Platforms (state() names each case):
//   Android Chrome / Samsung / Firefox, desktop Chrome / Edge / Firefox / Safari 16+:
//                    work in the browser, installed or not            → 'ask' / 'granted'
//   iPhone / iPad:   only once added to the Home Screen, iOS 16.4+    → 'ios-install' / 'ios-old'
//   In-app browsers (Instagram, Facebook, TikTok, …): no push at all  → 'inapp'
//   Permission refused earlier: only the browser's settings can undo  → 'blocked'
//   Push not set up on the server yet (no VAPID key): hidden          → 'off'
//
// We only ask after a moment that shows the value (a finished Daily, joining
// a room), never on first load, at most 3 times, 4+ days apart. The system
// permission prompt only appears after the player taps "Turn on" in our sheet,
// so a "Not now" never burns the browser's one-time prompt.

const Notify = (() => {
  const ASK_KEY  = 'borderline_push_ask';    // { at, n }
  const SYNC_KEY = 'borderline_push_sync';   // { endpoint, tz, day, uid }
  const PK_KEY   = 'borderline_push_key';    // the server's public VAPID key, cached for offline
  const TIMES    = ['07:00', '08:00', '09:00', '12:00', '17:00', '18:00', '19:00', '20:00', '21:00'];

  const read  = (k, d = null) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

  let publicKey = read(PK_KEY, '');
  let prefs = null;          // from the server, once loaded
  let subscribed = false;    // this device has a live subscription saved

  // ---------------------------------------------------------------- where are we?
  const ua = navigator.userAgent;
  const isAndroid = /android/i.test(ua);
  const inApp = /FBAN|FBAV|FB_IAB|Instagram|Line\/|Snapchat|musical_ly|BytedanceWebview|TikTok|Twitter|LinkedInApp|Pinterest|GSA\/.*Mobile/i.test(ua);
  function iosVersion() {            // 16.4 → 1604; iPadOS reports as a Mac, assume it's new enough
    const m = ua.match(/OS (\d+)_(\d+)/);
    return m && /iphone|ipad|ipod/i.test(ua) ? Number(m[1]) * 100 + Number(m[2]) : null;
  }
  function platform() {
    const pwa = isStandalone();
    if (isIOS) return pwa ? 'ios-pwa' : 'ios-browser';
    if (isAndroid) return pwa ? 'android-pwa' : 'android';
    if (/Macintosh/.test(ua) && /Safari/.test(ua) && !/Chrome|Chromium|Edg|Firefox/.test(ua)) return 'mac-safari';
    return pwa ? 'desktop-pwa' : 'desktop';
  }
  function state() {
    if (!publicKey) return 'off';
    if (inApp) return 'inapp';
    if (isIOS) {
      const v = iosVersion();
      if (v && v < 1604) return 'ios-old';
      if (!isStandalone()) return 'ios-install';
    }
    if (!window.isSecureContext || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported';
    if (Notification.permission === 'denied') return 'blocked';
    return Notification.permission === 'granted' ? 'granted' : 'ask';
  }

  // ---------------------------------------------------------------- subscribing
  const b64 = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0));
  const tz = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; } };

  async function registration() {
    let reg = await navigator.serviceWorker.getRegistration();
    if (!reg) reg = await navigator.serviceWorker.register('sw.js');
    return Promise.race([navigator.serviceWorker.ready, new Promise((_, no) => setTimeout(() => no(new Error('sw timeout')), 10000))]);
  }

  function sameKey(sub) {
    const k = sub.options && sub.options.applicationServerKey;
    if (!k) return true;
    const a = new Uint8Array(k), b = b64(publicKey);
    return a.length === b.length && a.every((x, i) => x === b[i]);
  }

  // The current subscription, made if needed (the permission must already be granted)
  async function subscription(create) {
    const reg = await registration();
    let sub = await reg.pushManager.getSubscription();
    if (sub && !sameKey(sub)) { await sub.unsubscribe().catch(() => {}); sub = null; }   // the server's key changed
    if (!sub && create) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(publicKey) });
    return sub;
  }

  const ready = () => typeof cloudStatus !== 'undefined' && cloudStatus === 'ready' && typeof sb !== 'undefined' && sb;

  async function save(sub, force = false) {
    if (!sub || !ready()) return false;
    const j = sub.toJSON();
    const mark = { endpoint: j.endpoint, tz: tz(), day: utcDay(), uid: cloudUser && cloudUser.id };
    const last = read(SYNC_KEY, {});
    if (!force && last.endpoint === mark.endpoint && last.tz === mark.tz && last.day === mark.day && last.uid === mark.uid) { subscribed = true; return true; }
    const { error } = await sb.rpc('push_save', { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_tz: mark.tz, p_platform: platform() });
    if (error) { console.warn('push_save:', error.message); return false; }
    write(SYNC_KEY, mark);
    subscribed = true;
    return true;
  }

  function errorText(e) {
    if (navigator.brave && /AbortError|NotAllowedError/.test(e && e.name))
      return 'Brave blocks this by default: Settings → Privacy and security → turn on “Use Google services for push messaging”, then try again.';
    if (e && e.name === 'AbortError') return 'Your browser couldn’t reach its notification service. Check your connection and try again.';
    return 'This browser couldn’t turn notifications on. Try Chrome, Safari, Edge or Firefox.';
  }

  // Must run from a tap: browsers (and iPhones always) refuse the prompt otherwise
  async function enable(source) {
    track('push_prompt_accept', { source, platform: platform() });
    let perm = Notification.permission;
    if (perm !== 'granted') {
      try { perm = await Notification.requestPermission(); } catch { perm = Notification.permission; }
    }
    if (perm !== 'granted') {
      track('push_denied', { source, permission: perm, platform: platform() });
      render();
      return false;
    }
    try {
      const sub = await subscription(true);
      if (!ready()) { showToast('Reminders will switch on once you’re online'); return false; }
      if (!(await save(sub, true))) throw new Error('save failed');
      const t = $('push-time') && $('push-time').value;
      if (t) await setPrefs({ remind_at: t });
      track('push_enabled', { source, platform: platform() });
      showToast('Reminders on ✓');
      try { navigator.vibrate && navigator.vibrate(20); } catch {}
      await loadPrefs();
      render();
      return true;
    } catch (e) {
      console.warn('push enable:', e);
      track('push_error', { source, reason: (e && e.name) || 'error', platform: platform() });
      $('push-msg').textContent = errorText(e);
      $('push-msg').hidden = false;
      return false;
    }
  }

  async function disable() {
    try {
      const sub = await subscription(false);
      if (sub) {
        if (ready()) await sb.rpc('push_remove', { p_endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
    } catch (e) { console.warn('push disable:', e); }
    subscribed = false;
    write(SYNC_KEY, {});
    track('push_disabled', { platform: platform() });
    showToast('Notifications off on this device');
    render();
  }

  async function loadPrefs() {
    if (!ready()) return;
    const { data, error } = await sb.rpc('push_prefs_get');
    if (!error) prefs = data;
  }
  async function setPrefs(p) {
    prefs = { ...(prefs || {}), ...p };
    if (!ready()) return;
    const { error } = await sb.rpc('push_prefs_set', { p });
    if (error) showToast('Couldn’t save that. Try again in a moment.');
    else track('push_prefs', p);
  }

  // Every visit: keep the server's copy of this device fresh (subscriptions rotate,
  // phones move time zones, iPhones sometimes drop them), and clear the app badge.
  async function sync() {
    try { if (navigator.clearAppBadge) navigator.clearAppBadge().catch(() => {}); } catch {}
    if (!ready()) return;
    const { data: key } = await sb.rpc('push_public_key');
    if ((key || '') !== publicKey) { publicKey = key || ''; write(PK_KEY, publicKey); }
    if (state() !== 'granted') { subscribed = false; return; }
    try { await save(await subscription(true)); } catch (e) { console.warn('push sync:', e); }
  }

  // ---------------------------------------------------------------- the sheet
  const fmtTime = t => { const [h, m] = t.split(':').map(Number); return new Date(2000, 0, 1, h, m).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); };
  const timeSelect = cur => `<select id="push-time" class="push-time" aria-label="Reminder time">${TIMES.map(t => `<option value="${t}"${t === cur ? ' selected' : ''}>${fmtTime(t)}</option>`).join('')}</select>`;

  function blockedSteps() {
    const p = platform();
    if (p === 'ios-pwa') return ['Open the iPhone <b>Settings</b> app', 'Tap <b>Notifications</b>, then <b>Borderline</b>', 'Turn on <b>Allow Notifications</b>'];
    if (p === 'android-pwa') return ['Long-press the Borderline icon, tap <b>App info</b>', 'Tap <b>Notifications</b> and turn them on'];
    if (p === 'android') return ['Tap the <b>⋮</b> or the icon left of the address bar', 'Tap <b>Permissions</b> (or <b>Site settings</b>) → <b>Notifications</b>', 'Choose <b>Allow</b>, then come back here'];
    if (p === 'mac-safari') return ['Safari menu → <b>Settings</b> → <b>Websites</b> → <b>Notifications</b>', 'Set Borderline to <b>Allow</b>'];
    return ['Click the icon left of the address bar', 'Set <b>Notifications</b> to <b>Allow</b>', 'Reload the page'];
  }

  function render() {
    const d = $('push-dialog');
    if (!d) return;
    const s = state();
    const body = $('push-body'), actions = $('push-actions');
    $('push-msg').hidden = true;
    let html = '', buttons = '';
    const steps = list => `<ol class="help-steps push-steps">${list.map(x => `<li>${x}</li>`).join('')}</ol>`;
    const remind = (prefs && prefs.remind_at) || '19:00';

    if (s === 'granted' && subscribed) {
      $('push-title').textContent = 'Notifications';
      const p = prefs || { daily: true, streak: true, social: true, comeback: true };
      const row = (key, title, sub, extra = '') => `<label class="push-opt"><span class="push-opt-text"><b>${title}</b><small>${sub}</small>${extra}</span>
        <input type="checkbox" class="push-switch" data-key="${key}"${p[key] !== false ? ' checked' : ''} /></label>`;
      html = `<p class="push-on">✓ On for this device${prefs && prefs.devices > 1 ? ` · ${prefs.devices} devices` : ''}</p>
        ${row('daily', 'Daily reminder', 'When there’s a new mystery country and you haven’t played', `<span class="push-at">at ${timeSelect(remind)}</span>`)}
        ${row('streak', 'Streak saver', 'A heads-up before your streak resets')}
        ${row('social', 'Friends & rooms', 'Friend requests, new challenges, game nights')}
        ${row('comeback', 'Come-back nudges', 'If you’ve been away for a few days')}`;
      buttons = `<button type="button" class="btn" id="push-test-btn">Send a test</button><button type="button" class="btn primary" id="push-close-btn">Done</button>`;
    } else if (s === 'ask' || s === 'granted') {
      const room = d.dataset.source === 'room';
      $('push-title').textContent = room ? '🔔 Know when your crew plays' : '⏰ Never miss a Daily';
      html = `<p class="push-lead">${room
        ? 'Get a tap on the shoulder when someone starts a game night or a new challenge, and a daily nudge when the new mystery country drops.'
        : 'One nudge a day when the new mystery country drops, and a heads-up before your streak runs out. Plus friends and rooms, if you like.'} You can change it any time.</p>
        <p class="push-when">Remind me at ${timeSelect(remind)}</p>`;
      buttons = `<button type="button" class="btn ghost" id="push-later-btn">Not now</button><button type="button" class="btn primary" id="push-enable-btn">Turn on reminders</button>`;
    } else if (s === 'ios-install') {
      $('push-title').textContent = 'Reminders on iPhone';
      html = `<p class="push-lead">iPhone only sends notifications to apps on your Home Screen. It takes 10 seconds, and Borderline opens full-screen from then on:</p>
        ${steps(['Tap <b>Share</b> <span class="push-ios-share" aria-hidden="true">⬆︎</span> in Safari’s toolbar', 'Tap <b>Add to Home Screen</b>, then <b>Add</b>', 'Open Borderline from your Home Screen and tap <b>Turn on reminders</b>'])}`;
      buttons = `<button type="button" class="btn primary" id="push-close-btn">Got it</button>`;
    } else if (s === 'ios-old') {
      $('push-title').textContent = 'Reminders on iPhone';
      html = `<p class="push-lead">Notifications for web apps need iOS 16.4 or newer. Update in <b>Settings → General → Software Update</b>, then add Borderline to your Home Screen.</p>`;
      buttons = `<button type="button" class="btn primary" id="push-close-btn">OK</button>`;
    } else if (s === 'inapp') {
      $('push-title').textContent = 'Open in your browser';
      html = `<p class="push-lead">This app’s built-in browser can’t show notifications. Open Borderline in ${isIOS ? 'Safari' : 'Chrome'} (tap <b>⋯</b> → <b>Open in browser</b>), or copy the link.</p>`;
      buttons = `<button type="button" class="btn" id="push-copy-btn">Copy link</button><button type="button" class="btn primary" id="push-close-btn">OK</button>`;
    } else if (s === 'blocked') {
      $('push-title').textContent = 'Notifications are blocked';
      html = `<p class="push-lead">You said no to notifications earlier, and only your ${platform().endsWith('pwa') ? 'phone' : 'browser'}’s settings can change that:</p>${steps(blockedSteps())}`;
      buttons = `<button type="button" class="btn primary" id="push-close-btn">OK</button>`;
    } else {
      $('push-title').textContent = 'Notifications';
      html = `<p class="push-lead">This browser can’t show notifications. Chrome, Safari, Edge and Firefox can.</p>`;
      buttons = `<button type="button" class="btn primary" id="push-close-btn">OK</button>`;
    }
    body.innerHTML = html;
    actions.innerHTML = buttons;
    $('push-off-btn').hidden = !(s === 'granted' && subscribed);

    $('push-enable-btn')?.addEventListener('click', async e => {
      const b = e.currentTarget;
      b.disabled = true; b.textContent = 'Turning on…';      // reaching the push service can take a few seconds
      await enable(d.dataset.source || 'sheet');
      if (b.isConnected) { b.disabled = false; b.textContent = 'Turn on reminders'; }
    });
    $('push-later-btn')?.addEventListener('click', () => { track('push_prompt_dismiss', { source: d.dataset.source }); d.close(); });
    $('push-close-btn')?.addEventListener('click', () => d.close());
    $('push-copy-btn')?.addEventListener('click', () => copyText(shareUrl('inapp')));
    $('push-test-btn')?.addEventListener('click', async e => {
      const b = e.currentTarget; b.disabled = true;
      const { error } = await sb.rpc('push_test');
      showToast(error ? (/slow down/.test(error.message) ? 'One moment, the last one is on its way' : 'Couldn’t send a test') : 'Sent! It should arrive within a minute');
      track('push_test', {});
      setTimeout(() => { b.disabled = false; }, 3000);
    });
    body.querySelectorAll('.push-switch').forEach(x => x.addEventListener('change', () => setPrefs({ [x.dataset.key]: x.checked })));
    const t = $('push-time');
    if (t && s === 'granted' && subscribed) t.addEventListener('change', () => setPrefs({ remind_at: t.value }));
  }

  async function open(source = 'settings') {
    const d = $('push-dialog');
    d.dataset.source = source;
    if (state() === 'granted') { try { subscribed = !!(await subscription(false)); } catch { subscribed = false; } }
    if (subscribed) await loadPrefs();
    render();
    if (!d.open) d.showModal();
    track('push_sheet_open', { source, state: state(), platform: platform() });
  }

  // ---------------------------------------------------------------- when to ask
  function canAsk() {
    const s = state();
    if (s !== 'ask' && s !== 'ios-install') return false;
    const a = read(ASK_KEY, { at: 0, n: 0 });
    const max = s === 'ios-install' ? 2 : 3;
    return a.n < max && Date.now() - a.at > 4 * 86400000;
  }
  // A good moment to offer (after a Daily, after joining a room). Opens our sheet, not the system prompt.
  function suggest(source) {
    if (!canAsk() || document.querySelector('dialog[open]')) return false;
    const a = read(ASK_KEY, { at: 0, n: 0 });
    write(ASK_KEY, { at: Date.now(), n: a.n + 1 });
    track('push_prompt_shown', { source, state: state(), platform: platform() });
    open(source);
    return true;
  }

  // After a Daily: once the result and any badge or name sheets are done
  for (const id of ['result-dialog', 'badge-dialog', 'username-dialog']) {
    $(id)?.addEventListener('close', () => setTimeout(() => {
      const last = loadStore().games.slice(-1)[0];
      if (last && last.mode === 'daily' && last.day === utcDay() && !(loadStore().badgesPending || []).length) suggest('daily_result');
    }, 1400));
  }

  // After joining or making a room: offer once the room sheet is closed
  let roomMoment = false;
  function afterRoom() { roomMoment = true; }
  $('room-dialog')?.addEventListener('close', () => setTimeout(() => {
    if (roomMoment && !document.querySelector('dialog[open]')) { roomMoment = false; suggest('room'); }
  }, 600));

  // Home banner (rotates with the install tip; see renderBanner in game.js)
  if (typeof BANNERS !== 'undefined') {
    BANNERS.push = {
      icon: '⏰', title: 'Never miss a Daily',
      body: 'Get a nudge when the new mystery country drops, and before your streak resets.',
      cta: 'Remind me',
      eligible: () => (state() === 'ask' || state() === 'ios-install') && loadStore().games.length >= 2,
      act: () => open('banner'),
    };
  }

  // Account sheet row
  function renderAccountRow() {
    const row = $('push-row');
    if (!row) return;
    const s = state();
    row.hidden = s === 'off';
    $('push-state').textContent = s === 'granted' ? (subscribed ? 'On' : 'Off') : s === 'blocked' ? 'Blocked' : 'Off';
  }
  $('push-row-btn')?.addEventListener('click', () => { $('account-dialog').close(); open('account'); });
  $('push-off-btn')?.addEventListener('click', async () => { await disable(); $('push-dialog').close(); });

  // ---------------------------------------------------------------- landing from a notification
  // URLs look like ./?s=push&n=daily&go=daily (s is read and removed by analytics.js)
  let pendingGo = null;
  function takeGo(url) {
    try {
      const u = new URL(url, location.href);
      const go = u.searchParams.get('go'), n = u.searchParams.get('n');
      return go || n ? { go: go || '', n } : null;
    } catch { return null; }
  }
  (function readLanding() {
    const g = takeGo(location.href);
    if (!g) return;
    pendingGo = g;
    const q = new URLSearchParams(location.search);
    q.delete('go'); q.delete('n');
    const qs = q.toString();
    history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
  })();

  function route(g) {
    if (!g) return;
    track('push_open', { kind: g.n || '', go: g.go.split(':')[0] });
    const go = g.go;
    if (!go) return;
    document.querySelectorAll('dialog[open]').forEach(x => x.close());
    if (go === 'daily') { if (!homeScreen.hidden) chooseMode('daily'); return; }
    if (go === 'friends') { if (ready()) openFriends(); return; }
    if (go.startsWith('room:')) {
      const id = go.slice(5);
      if (/^[0-9a-f-]{36}$/.test(id) && ready()) Rooms.openRoom(id);
    }
  }
  // Rooms and friends need the cloud; the Daily can go straight away
  function flushPending() {
    if (!pendingGo) return;
    if (pendingGo.go !== 'daily' && !ready()) return;
    const g = pendingGo; pendingGo = null;
    setTimeout(() => route(g), 300);
  }
  // The app was already open: the service worker focuses it and passes the URL on
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', e => {
      if (e.data && e.data.type === 'push-open') { pendingGo = takeGo(e.data.url); flushPending(); }
    });
  }

  onCloudChange(() => { sync().then(renderAccountRow); flushPending(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) sync(); });
  flushPending();
  sync();

  return { state, platform, open, suggest, afterRoom, enable, disable, renderAccountRow, _sync: sync };
})();
