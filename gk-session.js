// gk-session.js — one Supabase sign-in for every GameKatta site.
//
// supabase-js keeps its session in localStorage, which each subdomain has to itself, so
// borderline.gamekatta.com and tatva.gamekatta.com used to be two different players. On
// *.gamekatta.com this keeps the session in cookies on .gamekatta.com instead, which every
// subdomain reads: sign in (or get a guest account) once, be the same player everywhere.
// Elsewhere (localhost, workers.dev previews) it is plain localStorage, as before.
//
//   window.supabase.createClient(URL, KEY, { auth: gkSession.auth })
//
// A session is a few KB of JSON (tokens and the user), more than one cookie holds, so it is
// split across <key>.0, <key>.1, ... Same file in both repos: gamekatta/shared/gk-session.js and
// Pancake/gk-session.js. Keep them identical.
(() => {
  const KEY = 'sb-ojhhqixgrmyeejwktebj-auth-token';
  const shared = /(^|\.)gamekatta\.com$/.test(location.hostname);
  const CHUNK = 3000;           // characters per cookie, well under the 4 KB limit
  const AGE = 400 * 86400;      // the longest browsers allow
  const attrs = `; Path=/; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}${shared ? '; Domain=.gamekatta.com' : ''}`;

  const jar = () => {
    const out = {};
    try { document.cookie.split('; ').forEach(c => { const i = c.indexOf('='); if (i > 0) out[c.slice(0, i)] = c.slice(i + 1); }); } catch {}
    return out;
  };
  const put = (name, value, age = AGE) => { try { document.cookie = `${name}=${value}; Max-Age=${age}${attrs}`; } catch {} };

  const read = key => {
    const c = jar();
    if (!(key + '.0' in c)) return null;
    let s = '';
    for (let i = 0; key + '.' + i in c; i++) s += c[key + '.' + i];
    try { return decodeURIComponent(s); } catch { return null; }
  };
  const write = (key, value) => {
    const enc = encodeURIComponent(value);
    const parts = enc.match(new RegExp(`.{1,${CHUNK}}`, 'g')) || [''];
    parts.forEach((p, i) => put(`${key}.${i}`, p));
    // A shorter session than last time leaves old chunks behind: clear them
    const c = jar();
    for (let i = parts.length; key + '.' + i in c; i++) put(`${key}.${i}`, '', 0);
  };
  const remove = key => {
    const c = jar();
    for (let i = 0; key + '.' + i in c; i++) put(`${key}.${i}`, '', 0);
  };

  // Another tab on another subdomain may be halfway through writing the chunks. A torn read
  // would look like "signed out" and supabase-js would throw the session away, so a value
  // that isn't valid JSON is read again a moment later before it's believed.
  const valid = v => { try { JSON.parse(v); return true; } catch { return false; } };
  const cookieStorage = {
    async getItem(key) {
      for (let i = 0; i < 5; i++) {
        const v = read(key);
        if (v == null || valid(v)) return v;
        await new Promise(r => setTimeout(r, 40));
      }
      return null;
    },
    setItem(key, value) { write(key, value); },
    removeItem(key) { remove(key); },
  };

  // Borderline's players already have a session in its localStorage. Move it into the cookie,
  // once: it holds their games, story and rooms, so it wins over a guest made elsewhere.
  // Only removed from localStorage after the cookie reads back the same.
  const adoptLocal = () => {
    if (!shared) return false;
    let local = null;
    try { local = localStorage.getItem(KEY); } catch {}
    if (!local || !valid(local)) return false;
    if (read(KEY) !== local) write(KEY, local);
    if (read(KEY) !== local) return false;   // cookies blocked: keep using what we have
    try { localStorage.removeItem(KEY); } catch {}
    return true;
  };

  let storage = shared ? cookieStorage : null;
  try { if (!storage) { localStorage.setItem('gk:probe', '1'); localStorage.removeItem('gk:probe'); storage = localStorage; } }
  catch { storage = undefined; }   // no storage at all: supabase-js keeps it in memory

  window.gkSession = {
    KEY,
    shared,
    adoptLocal,
    has: () => (shared ? read(KEY) : (() => { try { return localStorage.getItem(KEY); } catch { return null; } })()) != null,
    // Pass as createClient's `auth` option. detectSessionInUrl stays on for Borderline's Google redirect.
    auth: { storage, storageKey: KEY, persistSession: true, autoRefreshToken: true },
  };
})();
