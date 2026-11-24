// signal.js — THE SIGNAL: a story told in text messages. A missing journalist
// texts you what she can see; you find her on the globe with Pin Drop (pin.js).
//
// The words live in signal-data.js; this file plays them: the chat, typing,
// photos (drawn as SVG, no image files), voice notes, characters, the hunt,
// timed choices, the glitch cliffhanger, the end card and the season menu.
// The whole screen is built here, so index.html only needs the home tile.
//
// Progress stays on the device (localStorage). Choices are also sent to the
// server (015_signal.sql) so the next episode can say how the world chose.
// Episodes unlock one a day: the next 7 PM at least 12 hours after you finish.
// Admins, ?signal=dev and testers' devices skip the wait.

const Signal = (() => {
  const KEY = 'borderline_signal_v2';     // v1 was the pre-release cast (Mira/Tayo); not carried over
  const DEV_KEY = 'borderline_signal_dev';
  const ABORT = { abort: true };
  const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------------------------------------------------------------- saved progress
  // { name, sound, pace, eps: { n: { at, found, pins, km, temps, level } }, choices: { key: id },
  //   trust, hunts, pinMod, ending,
  //   cur: { n, i, log: [entry], hunt: { clue, pins, panel, attempts, result } | null, battery, mood } }
  function fresh(keep = {}) {
    return { name: null, sound: true, pace: 1, eps: {}, choices: {}, trust: 0, hunts: 0, pinMod: 0, ending: null, endingsSeen: [], replay: false, cur: null, ...keep };
  }
  function load() {
    const s = readJSON(KEY) || {};
    return { ...fresh(), ...s, sound: s.sound !== false, eps: s.eps || {}, choices: s.choices || {}, endingsSeen: s.endingsSeen || [] };
  }
  let st = load();
  const save = () => writeJSON(KEY, st);

  // Reading speed: 1× is relaxed (the default), so anyone can keep up; tap the chat to skip a wait
  const PACES = { 1: 1, 2: 0.55, 3: 0.28 };
  const pace = () => PACES[st.pace] || 1;

  // How Meera feels about you: trust per hunt played so far → 'high' | 'mid' | 'low'
  function trustLevel() {
    const avg = st.trust / Math.max(1, st.hunts);
    return avg >= SIGNAL.trust.high ? 'high' : avg >= SIGNAL.trust.mid ? 'mid' : 'low';
  }

  try {
    const q = new URLSearchParams(location.search);
    if (q.get('signal') === 'dev') localStorage.setItem(DEV_KEY, '1');
  } catch {}

  // Pilot: admins and managers only (the `signal` switch, 015_signal.sql). The role check
  // also covers the time before that SQL has been run.
  function enabled() {
    if (typeof cloudRole !== 'undefined' && (cloudRole === 'admin' || cloudRole === 'manager')) return true;
    return typeof hasFeature === 'function' && hasFeature('signal');
  }
  // Skips the wait between episodes: admins always, and anyone with access who opened ?signal=dev
  function devMode() {
    if (typeof cloudRole !== 'undefined' && cloudRole === 'admin') return true;
    try { if (localStorage.getItem(DEV_KEY)) return enabled(); } catch {}
    return false;
  }

  const EPS = SIGNAL.episodes;
  const episode = n => EPS.find(e => e.n === n);

  // When episode n can be played (ms), Infinity while the one before isn't finished
  function unlockAt(n) {
    if (n === 1) return 0;
    const prev = st.eps[n - 1];
    if (!prev) return Infinity;
    if (devMode() || st.replay) return 0;
    const min = prev.at + 12 * 3600e3;
    const d = new Date(min);
    d.setHours(SIGNAL.unlockHour, 0, 0, 0);
    if (d.getTime() < min) d.setDate(d.getDate() + 1);
    return d.getTime();
  }

  // The episode to offer next: { n, state: 'play' | 'resume' | 'wait' | 'done', at }
  function nextUp() {
    if (st.cur && episode(st.cur.n)) return { n: st.cur.n, state: 'resume' };
    for (const e of EPS) {
      if (st.eps[e.n]) continue;
      const at = unlockAt(e.n);
      return { n: e.n, state: at <= Date.now() ? 'play' : 'wait', at };
    }
    return { n: EPS.length, state: 'done' };
  }

  function whenText(at) {
    const ms = at - Date.now();
    if (ms <= 0) return 'now';
    const d = new Date(at), today = new Date();
    const tmr = new Date(); tmr.setDate(tmr.getDate() + 1);
    const t = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    if (d.toDateString() === today.toDateString()) return `today at ${t}`;
    if (d.toDateString() === tmr.toDateString()) return `tomorrow at ${t}`;
    return d.toLocaleDateString([], { weekday: 'long' }) + ` at ${t}`;
  }
  const countdown = at => formatCountdown(Math.max(0, at - Date.now()));

  // ---------------------------------------------------------------- personal tokens
  function playerName() {
    return (typeof cloudUsername !== 'undefined' && cloudUsername) || st.name || null;
  }
  function bestDaily() {
    let best = null;
    for (const g of loadStore().games) {
      if (g.mode !== 'daily' || !g.won || !g.guessCount) continue;
      if (!best || g.guessCount <= best.guessCount) best = g;
    }
    return best;
  }
  function homeName() {
    try { return (typeof homeCountryName === 'function' && homeCountryName()) || 'wherever you are'; } catch { return 'wherever you are'; }
  }
  function fill(text) {
    if (!text) return '';
    const b = bestDaily();
    return text
      .replace(/\{name\}/g, playerName() || 'friend')
      .replace(/\{bestN\}/g, b ? `${b.guessCount} guess${b.guessCount === 1 ? '' : 'es'}` : 'a few guesses')
      .replace(/\{best\}/g, b ? b.mystery : 'the mystery country')
      .replace(/\{time\}/g, new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }))
      .replace(/\{home\}/g, homeName());
  }
  function passes(step) {
    switch (step.if) {
      case 'name':   return !!playerName();
      case 'noName': return !playerName();
      case 'best':   return !!bestDaily();
      case 'noBest': return !bestDaily();
      default:       return true;
    }
  }

  // ---------------------------------------------------------------- sound (WebAudio, synthesised)
  const Sfx = (() => {
    let ac = null, out = null;
    function ctx() {
      if (!st.sound) return null;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      if (!ac) { try { ac = new AC(); out = ac.createGain(); out.gain.value = 0.45; out.connect(ac.destination); } catch { ac = null; return null; } }
      if (ac.state === 'suspended') ac.resume().catch(() => {});
      return ac;
    }
    function tone(f, dur, { type = 'sine', gain = .12, at = 0, to = null } = {}) {
      const a = ctx(); if (!a) return;
      const t = a.currentTime + at, o = a.createOscillator(), g = a.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t);
      if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + .01);
      g.gain.exponentialRampToValueAtTime(.0001, t + dur);
      o.connect(g).connect(out); o.start(t); o.stop(t + dur + .05);
    }
    function noise(dur, { gain = .1, type = 'bandpass', f = 1200, to = null, q = 1, at = 0 } = {}) {
      const a = ctx(); if (!a) return;
      const t = a.currentTime + at, n = Math.ceil(a.sampleRate * dur);
      const buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      const src = a.createBufferSource(); src.buffer = buf;
      const fl = a.createBiquadFilter(); fl.type = type; fl.Q.value = q; fl.frequency.setValueAtTime(f, t);
      if (to) fl.frequency.exponentialRampToValueAtTime(to, t + dur);
      const g = a.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
      src.connect(fl).connect(g).connect(out); src.start(t);
    }
    return {
      recv()    { tone(1046, .09, { gain: .07 }); tone(1568, .14, { gain: .06, at: .07 }); },
      other()   { tone(784, .1, { gain: .06 }); tone(988, .14, { gain: .05, at: .08 }); },
      send()    { noise(.16, { gain: .05, type: 'highpass', f: 2000, to: 6000 }); },
      shutter() { noise(.05, { gain: .18, f: 3000 }); noise(.08, { gain: .12, f: 1500, at: .07 }); },
      glitch()  { noise(1.3, { gain: .2, f: 400, to: 4000, q: 4 }); tone(55, 1.1, { type: 'square', gain: .05, to: 30 }); },
      found()   { [523, 659, 784, 1046].forEach((f, i) => tone(f, .5, { type: 'triangle', gain: .09, at: i * .09 })); },
      lost()    { tone(330, .6, { type: 'triangle', gain: .08, to: 220 }); },
      beat()    { tone(62, .14, { gain: .3 }); tone(55, .16, { gain: .22, at: .18 }); },
      drone()   { tone(73, 3, { type: 'sawtooth', gain: .025 }); tone(110, 3, { gain: .05, at: .2 }); },
      pin()     { tone(660, .08, { gain: .06, to: 880 }); },
      voice(secs) {                                   // a muffled voice: syllables of filtered noise
        for (let t = 0; t < secs; t += .14 + Math.random() * .12) {
          if (Math.random() < .12) continue;
          noise(.12 + Math.random() * .1, { gain: .07, f: 350 + Math.random() * 500, q: 3, at: t });
        }
      },
    };
  })();
  const buzz = p => { try { navigator.vibrate && navigator.vibrate(p); } catch {} };

  // ---------------------------------------------------------------- characters (SVG)
  const LOOKS = {
    meera:   { bg: '#1e3a5f', skin: '#b07a4f', hair: '#140c08', style: 'long',   top: '#9f1239', trim: '#fbbf24', stud: true },
    tara:    { bg: '#6d28d9', skin: '#a8703f', hair: '#140c08', style: 'braids', top: '#0ea5e9', kid: true },
    dele:    { bg: '#334155', skin: '#7a4a2a', hair: '#9ca3af', style: 'short',  top: '#1f2937', glasses: true },
    mei:     { bg: '#0f766e', skin: '#e8c39e', hair: '#111827', style: 'bob',    top: '#f472b6', kid: true },
  };
  const MOODS = {
    calm:   { brow: 'M22 28.5q4-1.5 7 0M35 28.5q3-1.5 7 0', mouth: 'M27 42q5 2.5 10 0' },
    smile:  { brow: 'M22 27.5q4-2.2 7-.6M35 26.9q3-1.6 7 .6', mouth: 'M26 40.5q6 5.5 12 0' },
    scared: { brow: 'M22 28q4-.8 7-3.2M35 24.8q3 2.2 7 3.2', mouth: 'M29.5 42.5q2.5-3 5 0q-2.5 3-5 0', fillMouth: true },
    sad:    { brow: 'M22 28.4q4-.6 7-2.4M35 26q3 1.8 7 2.4', mouth: 'M27.5 43.5q4.5-3 9 0' },
    cry:    { brow: 'M22 28.4q4-.6 7-2.8M35 25.6q3 2.2 7 2.8', mouth: 'M28 44q4-3.5 8 0', tear: true },
    tired:  { brow: 'M22 29.5h7M35 29.5h7', mouth: 'M28.5 42.5h7', sleepy: true },
  };
  // A braid: overlapping ovals from (x1,y1) to (x2,y2)
  function braid(x1, y1, x2, y2, fill, ribbon) {
    let s = '';
    for (let i = 0; i <= 5; i++) {
      const t = i / 5, x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t;
      s += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="3.4" ry="2.6" fill="${fill}" stroke="#000" stroke-opacity=".25" stroke-width=".5"/>`;
    }
    if (ribbon) s += `<path d="M${x2 - 3.5} ${y2 + 2}l3.5 2 3.5-2-1 4-2.5-1.5-2.5 1.5z" fill="${ribbon}"/>`;
    return s;
  }
  function face(who, mood = 'calm') {
    if (who === 'unknown' || !LOOKS[who]) {
      return `<span class="sg-av sg-av-unknown" aria-hidden="true"><svg viewBox="0 0 64 64"><rect width="64" height="64" fill="#374151"/><circle cx="32" cy="27" r="11" fill="#6b7280"/><path d="M10 66c3-13 11-18 22-18s19 5 22 18z" fill="#6b7280"/><text x="32" y="32" text-anchor="middle" font-size="14" font-weight="800" fill="#e5e7eb">?</text></svg></span>`;
    }
    const L = LOOKS[who], M = MOODS[mood] || MOODS.calm;
    const back = {
      long:   `<path d="M13 36c-1-16 7-26 19-26s20 10 19 26l1 20H12z"/>`,
      braids: `<ellipse cx="32" cy="25" rx="17" ry="15"/>`,
      short:  `<ellipse cx="32" cy="22" rx="16" ry="11"/>`,
      bob:    `<path d="M14 40V26c0-11 8-17 18-17s18 6 18 17v14h-6V28H20v12z"/>`,
    }[L.style];
    const fringe = {
      long:   `<path d="M18 30c0-10 6-15.5 14-15.5S46 20 46 30c-2-6-6-9.5-11-10.5-1 1.6-2 2.4-3 2.4s-2-.8-3-2.4c-5 1-9 4.5-11 10.5z"/>`,
      braids: `<path d="M18 28c1-9 7-13.5 14-13.5S45 19 46 28c-3-5-8-7.5-14-7.5S21 23 18 28z"/>`,
      short:  `<path d="M18 27c2-9 8-13 14-13s12 4 14 13c-4-4-9-6-14-6s-10 2-14 6z"/>`,
      bob:    `<path d="M18 28c1-9 7-12 14-12s13 3 14 12c-5-3-9-4-14-4s-9 1-14 4z"/>`,
    }[L.style];
    const over = L.style === 'long' ? braid(19, 41, 16, 60, L.hair)
               : L.style === 'braids' ? braid(16, 36, 13, 52, L.hair, '#ef4444') + braid(48, 36, 51, 52, L.hair, '#ef4444') : '';
    const k = L.kid ? ' sg-kid' : '';
    return `<span class="sg-av${k}" aria-hidden="true"><svg viewBox="0 0 64 64" class="sg-face sg-mood-${mood}">
      <rect width="64" height="64" fill="${L.bg}"/>
      <g fill="${L.hair}">${back}</g>
      <path d="M6 68c2-13 12-18 26-18s24 5 26 18z" fill="${L.top}"/>
      ${L.trim ? `<path d="M27 50.5l5 6.5 5-6.5" stroke="${L.trim}" stroke-width="1.2" fill="none"/>` : ''}
      <rect x="27" y="40" width="10" height="12" rx="3" fill="${L.skin}"/>
      <circle cx="18" cy="33" r="3" fill="${L.skin}"/><circle cx="46" cy="33" r="3" fill="${L.skin}"/>
      ${L.stud ? '<circle cx="18" cy="37.5" r="1.4" fill="#fbbf24"/>' : ''}
      <ellipse cx="32" cy="32" rx="14" ry="16" fill="${L.skin}"/>
      <g fill="${L.hair}">${fringe}</g>
      ${over}
      <path class="sg-brow" d="${M.brow}" stroke="${L.hair === '#9ca3af' ? '#6b7280' : '#140b06'}" stroke-width="1.6" fill="none" stroke-linecap="round"/>
      <g class="sg-eyes${M.sleepy ? ' sg-sleepy' : ''}"><ellipse cx="26" cy="33" rx="2" ry="2.4" fill="#120a06"/><ellipse cx="38" cy="33" rx="2" ry="2.4" fill="#120a06"/>
        <circle cx="26.7" cy="32.2" r=".6" fill="#fff"/><circle cx="38.7" cy="32.2" r=".6" fill="#fff"/></g>
      ${L.glasses ? '<g fill="none" stroke="#111" stroke-width="1.2"><rect x="21.5" y="29.5" width="9" height="7" rx="2"/><rect x="33.5" y="29.5" width="9" height="7" rx="2"/><path d="M30.5 32h3"/></g>' : ''}
      <path d="M31 35.5q1 3 2.4 0" stroke="#5a3214" stroke-width="1" fill="none" opacity=".6"/>
      ${L.stud ? '<circle cx="34.6" cy="37" r=".8" fill="#fde68a"/>' : ''}
      <path class="sg-mouth" d="${M.mouth}" stroke="#3b1d12" stroke-width="1.6" fill="${M.fillMouth ? '#3b1d12' : 'none'}" stroke-linecap="round"/>
      ${M.tear ? '<path class="sg-tear" d="M24 37q-2 3.4 0 4.6q2-1.2 0-4.6z" fill="#7dd3fc"/>' : ''}
    </svg></span>`;
  }

  // ---------------------------------------------------------------- photos (SVG scenes)
  function seedOf(s) { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { let a = seed || 1; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const TIMES = {
    dawn:  { sky: ['#1f2350', '#7c4d8c', '#f19a8a', '#fcd49a'], sun: [250, 128, 14, '#ffd27a'], sil: '#2a1f3d', far: '#6b5577', water: ['#8a6f8f', '#2a2340'], ground: '#3a2a46' },
    day:   { sky: ['#2f78bd', '#6fb0e3', '#cfe8f7'], sun: [252, 40, 12, '#fff7d6'], sil: '#465069', far: '#93a7bf', water: ['#4f8fc2', '#24557f'], ground: '#5b6478' },
    dusk:  { sky: ['#1b1440', '#5b2a86', '#c2477a', '#f59e5b'], sun: [78, 132, 16, '#ff7a45'], sil: '#1f1530', far: '#553765', water: ['#8a466f', '#22152f'], ground: '#2a1c38', lit: true },
    night: { sky: ['#030614', '#0b1430', '#1b2a4a'], moon: [255, 38, 10], sil: '#070b18', far: '#1d2943', water: ['#11224a', '#050913'], ground: '#0b1122', lit: true, stars: true },
    storm: { sky: ['#252b36', '#454e5c', '#6b7280'], sil: '#181d26', far: '#3b4350', water: ['#3f4a58', '#1d232c'], ground: '#232933', lit: true, clouds: true },
  };
  let _uid = 0;
  const R = (x, y, w, h, f, extra = '') => `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="${f}"${extra}/>`;
  function windows(x, y, w, h, r, lit) {
    if (!lit) return '';
    let s = '';
    for (let yy = y + 4; yy < y + h - 4; yy += 6) for (let xx = x + 3; xx < x + w - 3; xx += 5)
      if (r() < .28) s += `<rect x="${xx.toFixed(1)}" y="${yy.toFixed(1)}" width="2" height="3" fill="#ffd98a" opacity="${(.45 + r() * .55).toFixed(2)}"/>`;
    return s;
  }
  function blocks(r, h, f, lit, { from = -4, to = 324, min = 8, max = 30, wmin = 12, wmax = 28 } = {}) {
    let s = '', x = from;
    while (x < to) {
      const w = wmin + r() * (wmax - wmin), hh = min + r() * (max - min);
      s += R(x, h - hh, w, hh + 2, f) + windows(x, h - hh, w, hh, r, lit);
      x += w - 1;
    }
    return s;
  }
  const SKYLINES = {
    domes(r, h, T) {
      let s = blocks(r, h, T.sil, T.lit, { min: 6, max: 20 });
      const mosque = (cx, k) => {
        let m = R(cx - 34 * k, h - 26 * k, 68 * k, 27 * k, T.sil);
        m += `<path d="M${cx - 26 * k} ${h - 26 * k}A${26 * k} ${24 * k} 0 0 1 ${cx + 26 * k} ${h - 26 * k}Z" fill="${T.sil}"/>`;
        m += `<path d="M${cx} ${h - 50 * k}v-${8 * k}" stroke="${T.sil}" stroke-width="${1.5 * k}"/>`;
        for (const d of [-1, 1]) {
          m += `<path d="M${cx + d * 30 * k - 11 * k} ${h - 22 * k}A${11 * k} ${10 * k} 0 0 1 ${cx + d * 30 * k + 11 * k} ${h - 22 * k}Z" fill="${T.sil}"/>`;
          for (const off of [44, 58]) {
            const x = cx + d * off * k;
            m += R(x - 2 * k, h - 74 * k, 4 * k, 75 * k, T.sil);
            m += `<path d="M${x - 2.5 * k} ${h - 74 * k}L${x} ${h - 88 * k}L${x + 2.5 * k} ${h - 74 * k}Z" fill="${T.sil}"/>`;
            m += R(x - 3.5 * k, h - 56 * k, 7 * k, 2 * k, T.sil);
          }
        }
        return m;
      };
      return s + mosque(112, 1) + mosque(250, .62);
    },
    canal(r, h, T) {
      let s = `<rect x="0" y="${h - 4}" width="320" height="${204 - h}" fill="#c9a46a" opacity=".85"/>`;
      s += `<path d="M0 ${h + 8}Q160 ${h + 2} 320 ${h + 8}V${h + 22}Q160 ${h + 16} 0 ${h + 22}Z" fill="${T.water[0]}"/>`;
      [[40, 1], [150, .75], [240, .55]].forEach(([x, k]) => {
        const y = h + 10;
        s += `<path d="M${x} ${y}h${70 * k}l-${6 * k} ${8 * k}h-${58 * k}z" fill="${T.sil}"/>`;
        const cols = ['#b91c1c', '#1d4ed8', '#ca8a04', '#15803d', '#6b21a8'];
        for (let i = 0; i < 6; i++) for (let j = 0; j < 2; j++)
          s += R(x + 6 * k + i * 9 * k, y - (j + 1) * 6 * k, 8.4 * k, 5.6 * k, cols[(i + j * 2 + Math.floor(r() * 5)) % 5], ' opacity=".85"');
        s += R(x + 58 * k, y - 20 * k, 8 * k, 20 * k, '#e5e7eb');
      });
      return s;
    },
    lighthouse(r, h, T) {
      let s = blocks(r, h, T.sil, T.lit, { min: 14, max: 34, to: 200 });
      for (let x = 10; x < 190; x += 26) s += `<path d="M${x} ${h - 12}h18" stroke="#2f6d4f" stroke-width="2"/><path d="M${x} ${h - 22}h18" stroke="#2f6d4f" stroke-width="2"/>`;
      const x = 240;
      s += `<path d="M${x - 8} ${h}L${x - 5} ${h - 80}h10L${x + 8} ${h}Z" fill="#e5e7eb"/>`;
      for (let i = 0; i < 4; i++) s += `<path d="M${x - 7.4 + i * .7} ${h - 10 - i * 20}h${14.8 - i * 1.4}v-8h-${14.8 - i * 1.4}z" fill="#b91c1c" opacity=".85"/>`;
      s += R(x - 7, h - 90, 14, 10, '#1f2937') + `<circle cx="${x}" cy="${h - 85}" r="4" fill="#fde68a"/>`;
      s += `<path class="sg-beam" style="transform-origin:${x}px ${h - 85}px" d="M${x} ${h - 85}L${x + 120} ${h - 105}L${x + 120} ${h - 65}Z" fill="#fde68a" opacity=".25"/>`;
      return s;
    },
    colonial(r, h, T) {
      let s = blocks(r, h, T.sil, T.lit, { min: 10, max: 26 });
      const cx = 160;
      s += R(cx - 90, h - 42, 180, 43, T.sil) + R(cx - 22, h - 70, 44, 71, T.sil);
      s += `<path d="M${cx - 24} ${h - 70}A24 22 0 0 1 ${cx + 24} ${h - 70}Z" fill="${T.sil}"/><path d="M${cx} ${h - 92}v-12" stroke="${T.sil}" stroke-width="2"/>`;
      for (const d of [-1, 1]) {
        s += R(cx + d * 80 - 8, h - 62, 16, 63, T.sil) + `<path d="M${cx + d * 80 - 9} ${h - 62}L${cx + d * 80} ${h - 78}L${cx + d * 80 + 9} ${h - 62}Z" fill="${T.sil}"/>`;
      }
      const win = T.lit ? '#ffd98a' : 'rgba(255,255,255,.18)';
      for (let i = -7; i <= 7; i++) if (Math.abs(i) > 1) s += `<path d="M${cx + i * 11 - 3} ${h - 10}v-14a3 3 0 0 1 6 0v14z" fill="${win}" opacity=".7"/>`;
      return s;
    },
    palms(r, h, T) {
      let s = blocks(r, h, T.sil, T.lit, { min: 6, max: 18 });
      const x = 210;
      s += R(x - 2.5, h - 118, 5, 119, T.sil) + `<ellipse cx="${x}" cy="${h - 112}" rx="9" ry="12" fill="${T.lit ? '#c026d3' : T.sil}"/>` + `<path d="M${x} ${h - 124}v-22" stroke="${T.sil}" stroke-width="2"/>`;
      for (let i = 0; i < 5; i++) {
        const px = 20 + i * 62 + r() * 20, ph = 40 + r() * 26;
        s += `<path d="M${px} ${h + 2}q${4} -${ph / 2} ${-2} -${ph}" stroke="${T.sil}" stroke-width="3" fill="none"/>`;
        for (let a = 0; a < 6; a++) {
          const ang = -Math.PI + a * Math.PI / 5, L = 14 + r() * 5;
          const ex = px - 2 + Math.cos(ang) * L, ey = h - ph + Math.sin(ang) * L * .6 + 6;
          s += `<path d="M${px - 2} ${h - ph}Q${(px - 2 + ex) / 2} ${h - ph - 6} ${ex.toFixed(1)} ${ey.toFixed(1)}" stroke="${T.sil}" stroke-width="2.4" fill="none"/>`;
        }
      }
      return s;
    },
    towers(r, h, T) {
      let s = blocks(r, h, T.far, false, { min: 30, max: 70 });
      let x = -4;
      while (x < 324) {
        const w = 14 + r() * 22, hh = 40 + r() * 80;
        s += R(x, h - hh, w, hh + 2, T.sil) + windows(x, h - hh, w, hh, r, T.lit);
        x += w + r() * 6;
      }
      return s;
    },
    neon(r, h, T) {
      let s = blocks(r, h, T.far, false, { min: 60, max: 110, wmin: 10, wmax: 20 });
      let x = -4;
      const neon = ['#ff2bd6', '#22d3ee', '#facc15', '#f43f5e', '#a3e635'];
      while (x < 324) {
        const w = 12 + r() * 16, hh = 50 + r() * 70;
        s += R(x, h - hh, w, hh + 2, T.sil) + windows(x, h - hh, w, hh, r, true);
        if (r() < .6) s += R(x + 2, h - hh * (.3 + r() * .5), w - 4, 6 + r() * 10, neon[Math.floor(r() * neon.length)], ` class="sg-neon" style="animation-delay:${(r() * 3).toFixed(2)}s"`);
        x += w + 1;
      }
      return s;
    },
    steppe(r, h, T) {
      let s = `<path d="M0 ${h - 30}L40 ${h - 62}L80 ${h - 38}L130 ${h - 78}L180 ${h - 44}L230 ${h - 70}L280 ${h - 40}L320 ${h - 58}V${h}H0Z" fill="${T.far}"/>`;
      s += `<path d="M0 ${h - 8}Q80 ${h - 26} 160 ${h - 10}T320 ${h - 12}V204H0Z" fill="#e8eef5"/>`;
      for (let i = 0; i < 4; i++) {
        const x = 40 + i * 70 + r() * 20, y = h + 6 + r() * 8, k = .8 + r() * .5;
        s += `<path d="M${x - 12 * k} ${y}v-${7 * k}q${12 * k} -${11 * k} ${24 * k} 0v${7 * k}z" fill="#f8fafc" stroke="#94a3b8" stroke-width=".8"/>`;
        s += R(x - 2 * k, y - 6 * k, 4 * k, 6 * k, '#b45309') + R(x - 12 * k, y - 6 * k, 24 * k, 1.6 * k, '#1e40af');
        s += `<circle class="sg-smoke" cx="${x}" cy="${y - 14 * k}" r="${2.4 * k}" fill="#cbd5e1" style="animation-delay:${(r() * 2).toFixed(2)}s"/>`;
      }
      return s;
    },
    port(r, h, T) {
      let s = blocks(r, h, T.sil, T.lit, { min: 8, max: 20 });
      for (let i = 0; i < 3; i++) {
        const x = 40 + i * 100;
        s += `<path d="M${x} ${h}l10 -60l10 60M${x + 3} ${h - 20}h14M${x + 10} ${h - 60}h50M${x + 10} ${h - 60}l-20 4" stroke="${T.sil}" stroke-width="3" fill="none"/>`;
      }
      return s;
    },
  };
  const ON_WATER = new Set(['⛴️', '🚢', '🛳️', '⚓', '🛥️', '⛵']);
  const IN_SKY = new Set(['🕊️', '🦅', '🐦', '✈️']);
  const ON_GROUND = new Set(['🚕', '🚌', '🛺', '🚆', '🐎', '⛺', '🦁', '🏮', '🌴']);

  function photoHTML(p, seedKey) {
    const T = TIMES[p.time] || TIMES.day;
    const r = rng(seedOf(seedKey + (p.skyline || '') + (p.caption || '')));
    const id = 'sg' + (++_uid);
    const h = p.water ? 136 : 158;
    const sky = T.sky.map((c, i) => `<stop offset="${(i / (T.sky.length - 1)).toFixed(2)}" stop-color="${c}"/>`).join('');
    let svg = `<svg class="sg-scene" viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs><linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1">${sky}</linearGradient>
      <linearGradient id="${id}w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${T.water[0]}"/><stop offset="1" stop-color="${T.water[1]}"/></linearGradient>
      <radialGradient id="${id}g"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
      <rect width="320" height="200" fill="url(#${id}s)"/>`;
    if (T.stars) for (let i = 0; i < 40; i++) svg += `<circle class="sg-star" cx="${(r() * 320).toFixed(0)}" cy="${(r() * 110).toFixed(0)}" r="${(.4 + r() * .9).toFixed(1)}" fill="#fff" style="animation-delay:${(r() * 4).toFixed(1)}s"/>`;
    if (T.sun) svg += `<circle cx="${T.sun[0]}" cy="${T.sun[1]}" r="${T.sun[2] * 3}" fill="url(#${id}g)" opacity=".5"/><circle cx="${T.sun[0]}" cy="${T.sun[1]}" r="${T.sun[2]}" fill="${T.sun[3]}"/>`;
    if (T.moon) svg += `<circle cx="${T.moon[0]}" cy="${T.moon[1]}" r="${T.moon[2] * 3}" fill="url(#${id}g)" opacity=".25"/><circle cx="${T.moon[0]}" cy="${T.moon[1]}" r="${T.moon[2]}" fill="#f1f5f9"/><circle cx="${T.moon[0] + 4}" cy="${T.moon[1] - 3}" r="${T.moon[2]}" fill="${T.sky[0]}"/>`;
    if (T.clouds) for (let i = 0; i < 5; i++) svg += `<ellipse class="sg-cloud" cx="${(r() * 320).toFixed(0)}" cy="${(15 + r() * 50).toFixed(0)}" rx="${(40 + r() * 50).toFixed(0)}" ry="${(10 + r() * 10).toFixed(0)}" fill="#1f2530" opacity=".7"/>`;
    if (p.skyline !== 'steppe') svg += blocks(r, h, T.far, false, { min: 16, max: 46, wmin: 10, wmax: 24 }).replace(/<rect /g, '<rect opacity=".55" ');
    svg += (SKYLINES[p.skyline] || SKYLINES.towers)(r, h, T);
    if (p.water && p.skyline !== 'canal') {
      svg += `<rect y="${h}" width="320" height="${200 - h}" fill="url(#${id}w)"/>`;
      for (let i = 0; i < 9; i++) svg += `<path class="sg-shimmer" d="M${(r() * 300).toFixed(0)} ${(h + 6 + r() * 56).toFixed(0)}h${(10 + r() * 26).toFixed(0)}" stroke="#fff" stroke-opacity=".35" stroke-width="1" style="animation-delay:${(r() * 3).toFixed(1)}s"/>`;
    } else if (p.skyline !== 'canal' && p.skyline !== 'steppe') {
      svg += `<rect y="${h}" width="320" height="${200 - h}" fill="${T.ground}"/>`;
      if (p.weather === 'rain' || p.time === 'storm') svg += `<rect y="${h}" width="320" height="${200 - h}" fill="${T.water[0]}" opacity=".35"/>`;
    }
    svg += '</svg>';

    let items = '';
    let foreground = 0;
    const narrow = p.view === 'crack' || p.view === 'hole';   // keep things inside the gap
    for (const e of p.items || []) {
      let x, y, size, cls;
      if (ON_WATER.has(e) && (p.water || p.skyline === 'canal')) { x = 12 + r() * 64; y = 72 + r() * 10; size = 22 + r() * 6; cls = 'sg-bob'; }
      else if (IN_SKY.has(e)) { x = 10 + r() * 70; y = 8 + r() * 26; size = 15 + r() * 5; cls = 'sg-drift'; }
      else if (ON_GROUND.has(e)) { x = 10 + r() * 76; y = 68 + r() * 8; size = 18 + r() * 6; cls = ''; }
      else { x = foreground++ % 2 ? 70 + r() * 12 : 4 + r() * 10; y = 66 + r() * 6; size = 34; cls = 'sg-close'; }
      if (narrow) x = 40 + (x % 20);
      items += `<span class="sg-item ${cls}" style="left:${x.toFixed(0)}%;top:${y.toFixed(0)}%;font-size:${size.toFixed(0)}px;animation-delay:${(r() * 2).toFixed(1)}s">${e}</span>`;
    }
    const sign = p.sign ? `<span class="sg-sign"><b>${esc(p.sign.text)}</b>${p.sign.sub ? `<small>${esc(p.sign.sub)}</small>` : ''}</span>` : '';
    const wx = p.weather ? `<span class="sg-wx sg-wx-${p.weather}"></span>` : '';
    // What she's looking through: she's held captive, so she sees fragments
    const view = p.view ? `<span class="sg-view sg-view-${p.view}">${p.view === 'crack' ? '<i></i><i></i>' : ''}</span>` : '';
    return `<div class="sg-photo${p.view ? ' sg-through-' + p.view : ''}">${svg}${items}${wx}${view}${sign}<span class="sg-dev"></span></div>`;
  }
  function polaroid(p, seedKey, { develop = true, small = false } = {}) {
    const tilt = ((seedOf(seedKey + (p.caption || '')) % 7) - 3) * .8;
    return `<figure class="sg-polaroid${develop ? ' sg-developing' : ''}${small ? ' sg-pol-small' : ''}" style="--tilt:${tilt.toFixed(1)}deg" tabindex="0">
      ${photoHTML(p, seedKey)}${p.caption ? `<figcaption>${esc(p.caption)}</figcaption>` : ''}</figure>`;
  }

  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]); }

  // ---------------------------------------------------------------- the screen
  const root = document.createElement('div');
  root.id = 'signal-screen';
  root.className = 'sg';
  root.hidden = true;
  root.innerHTML = `
    <section class="sg-menu" data-view="menu"></section>
    <section class="sg-chat" data-view="chat" hidden>
      <header class="sg-head">
        <button type="button" class="sg-icon sg-back" aria-label="Episodes"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button>
        <span class="sg-head-av"></span>
        <span class="sg-head-text"><b class="sg-head-name">Meera</b><small class="sg-status">online</small></span>
        <span class="sg-bars" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
        <span class="sg-batt" title="Meera’s battery"><i></i><small></small></span>
        <button type="button" class="sg-icon sg-speed" aria-label="Message speed"></button>
        <button type="button" class="sg-icon sg-sound" aria-label="Sound"></button>
      </header>
      <div class="sg-log" role="log" aria-live="polite"></div>
      <button type="button" class="sg-newpill" hidden>New message ↓</button>
      <div class="sg-foot"></div>
    </section>
    <section class="sg-title" hidden></section>
    <section class="sg-end" hidden></section>
    <div class="sg-static" aria-hidden="true"></div>
    <div class="sg-lightbox" hidden></div>`;
  document.body.appendChild(root);
  const q = sel => root.querySelector(sel);
  const logEl = q('.sg-log'), footEl = q('.sg-foot');

  function showView(v) {
    root.hidden = false;
    for (const s of root.querySelectorAll('[data-view]')) s.hidden = s.dataset.view !== v;
    document.body.classList.add('sg-open');
  }
  function hideRoot() { root.hidden = true; document.body.classList.remove('sg-open'); }

  // Waits that a tap can cut short (tap the chat to read faster)
  const waiters = [];
  function wait(ms) {
    return new Promise(res => {
      const done = () => { clearTimeout(t); const i = waiters.indexOf(done); if (i >= 0) waiters.splice(i, 1); res(); };
      const t = setTimeout(done, ms);
      waiters.push(done);
    });
  }
  const hurry = () => waiters.slice().forEach(f => f());
  logEl.addEventListener('click', e => { if (!e.target.closest('button, figure')) hurry(); });

  // ---------------------------------------------------------------- chat log
  let run = null;   // { n, token } while an episode plays
  const alive = token => run && run.token === token;
  async function step(token, p) { const v = await p; if (!alive(token)) throw ABORT; return v; }

  function setStatus(t) { q('.sg-status').textContent = t; q('.sg-head').classList.toggle('sg-typing', t === 'typing…'); }
  function setMood(m) { q('.sg-head-av').innerHTML = face('meera', m || 'calm'); }
  function setBattery(b) {
    const el = q('.sg-batt');
    el.hidden = b == null;
    if (b == null) return;
    el.querySelector('i').style.width = Math.max(4, b) + '%';
    el.querySelector('small').textContent = b + '%';
    el.classList.toggle('sg-low', b <= 20);
  }
  function setBars(n) { q('.sg-bars').dataset.n = n; }
  // Follow new messages only while the player is at the bottom; if they've scrolled up to
  // re-read, leave them there and show a "New message" button instead.
  const pill = q('.sg-newpill');
  let stuck = true, _progUntil = 0;
  logEl.addEventListener('scroll', () => {
    if (performance.now() < _progUntil) return;          // our own scrolling
    stuck = logEl.scrollHeight - logEl.scrollTop - logEl.clientHeight < 48;
    if (stuck) pill.hidden = true;
  });
  function scrollLog(smooth = true, force = false) {
    if (force) stuck = true;
    if (!stuck) { pill.style.bottom = (footEl.offsetHeight + 12) + 'px'; pill.hidden = false; return; }
    _progUntil = performance.now() + 800;
    pill.hidden = true;
    logEl.scrollTo({ top: logEl.scrollHeight, behavior: smooth && !reduceMotion() ? 'smooth' : 'auto' });
  }
  pill.addEventListener('click', () => scrollLog(true, true));
  // A real finger or wheel on the chat always wins over our own auto-scroll
  for (const ev of ['wheel', 'touchmove', 'keydown']) logEl.addEventListener(ev, () => { _progUntil = 0; }, { passive: true });

  // Time to read what just arrived, before Meera starts typing again
  function readMs(text) {
    const words = String(text || '').split(/\s+/).filter(Boolean).length;
    return Math.min(4200, 900 + words * 240) * pace();
  }

  const WHO_NAME = who => (SIGNAL.characters[who] || {}).name || who;

  // One log entry → a DOM node. Entries are plain data so a resumed episode replays instantly.
  function entryNode(e, { fresh = false, seed = '' } = {}) {
    const d = document.createElement('div');
    d.className = 'sg-row';
    if (fresh) d.classList.add('sg-in');
    const them = (who, inner, mood) => {
      d.classList.add('sg-them', 'sg-' + who);
      d.innerHTML = `${face(who === 'mei' ? 'meera' : who, mood)}<div class="sg-bub">${who !== 'meera' ? `<span class="sg-from">${esc(WHO_NAME(who))}</span>` : ''}${inner}</div>`;
    };
    switch (e.t) {
      case 'sys':  d.className = 'sg-row sg-sys' + (fresh ? ' sg-in' : ''); d.innerHTML = `<span>${esc(e.text)}</span>`; break;
      case 'me':   d.classList.add('sg-me'); d.innerHTML = `<div class="sg-bub">${esc(e.text)}<span class="sg-tick">✓✓</span></div>`; break;
      case 'msg':  them(e.who, esc(e.text), e.mood); break;
      case 'photo': them(e.who, polaroid(e.photo, seed + e.k, { develop: fresh }), 'calm'); d.classList.add('sg-has-photo'); break;
      case 'voice': {
        const bars = Array.from({ length: 28 }, (_, i) => `<i style="height:${(20 + Math.abs(Math.sin(i * 1.7 + e.voice.secs)) * 80).toFixed(0)}%;--d:${(i / 28).toFixed(3)}"></i>`).join('');
        them(e.who, `<div class="sg-voice${e.played ? ' sg-played' : ''}" style="--secs:${e.voice.secs}s"><button type="button" class="sg-play" aria-label="Play voice note">▶</button><span class="sg-wave">${bars}</span><small>0:${String(e.voice.secs).padStart(2, '0')}</small></div><p class="sg-transcript">${esc(e.voice.text)}</p>`, 'calm');
        break;
      }
      case 'result': {
        d.className = 'sg-row sg-sys' + (fresh ? ' sg-in' : '');
        d.innerHTML = `<div class="sg-stamp ${e.found ? 'sg-found' : 'sg-lost'}"><b>${esc(e.city.toUpperCase())}</b><span>${esc(e.country)}</span><em>${e.found ? `FOUND · pin ${e.pins} · ${e.km.toLocaleString()} km` : `MISSED · closest ${e.km.toLocaleString()} km`}</em></div>`;
        break;
      }
      case 'pin': d.className = 'sg-row sg-sys sg-pinline' + (fresh ? ' sg-in' : ''); d.innerHTML = `<span>${esc(e.text)}</span>`; break;
      case 'note': d.className = 'sg-row sg-sys sg-note' + (fresh ? ' sg-in' : ''); d.innerHTML = `<span>${esc(e.text)}</span>`; break;
      case 'effect': d.className = 'sg-row sg-sys sg-effect' + (fresh ? ' sg-in' : ''); d.innerHTML = `<span>${esc(e.text)}</span>`; break;
    }
    return d;
  }
  function addEntry(e, fresh = true) {
    const cur = st.cur;
    e.k = cur.log.length;
    cur.log.push(e);
    save();
    logEl.appendChild(entryNode(e, { fresh, seed: 'ep' + cur.n }));
    scrollLog();
  }
  function renderLog() {
    logEl.innerHTML = '';
    for (const e of st.cur.log) logEl.appendChild(entryNode(e, { seed: 'ep' + st.cur.n }));
    scrollLog(false, true);
  }

  // Voice notes play on tap; photos open large on tap
  logEl.addEventListener('click', e => {
    const play = e.target.closest('.sg-play');
    if (play) {
      const v = play.closest('.sg-voice');
      if (v.classList.contains('sg-playing')) return;
      const secs = parseFloat(v.style.getPropertyValue('--secs')) || 8;
      v.classList.remove('sg-played'); void v.offsetWidth; v.classList.add('sg-playing');
      Sfx.voice(Math.min(secs, 12));
      setTimeout(() => { v.classList.remove('sg-playing'); v.classList.add('sg-played'); }, secs * 1000);
      const row = [...logEl.children].indexOf(v.closest('.sg-row'));
      const entry = st.cur && st.cur.log[row];
      if (entry) { entry.played = true; save(); }
      return;
    }
    const fig = e.target.closest('figure.sg-polaroid');
    if (fig) openLightbox(fig);
  });
  function openLightbox(fig) {
    const lb = q('.sg-lightbox');
    lb.innerHTML = '';
    const c = fig.cloneNode(true);
    c.classList.remove('sg-developing', 'sg-pol-small');
    lb.appendChild(c);
    lb.hidden = false;
    lb.onclick = () => { lb.hidden = true; };
  }

  async function typing(token, who, text) {
    const t = document.createElement('div');
    t.className = 'sg-row sg-them sg-' + who + ' sg-in';
    t.innerHTML = `${face(who === 'mei' ? 'meera' : who, 'calm')}<div class="sg-bub sg-dots"><i></i><i></i><i></i></div>`;
    logEl.appendChild(t);
    scrollLog();
    if (who === 'meera') setStatus('typing…');
    try { await step(token, wait(Math.min(3200, 700 + (text || '').length * 32) * pace())); }
    finally { t.remove(); if (who === 'meera') setStatus('online'); }
  }

  // Footer: buttons, one tap resolves with the index
  function footChoices(labels, { kind = 'reply', prompt = '', seconds = 0 } = {}) {
    return new Promise(res => {
      footEl.innerHTML = `${prompt ? `<p class="sg-prompt">${esc(prompt)}</p>` : ''}${seconds ? '<div class="sg-timer"><i></i></div>' : ''}<div class="sg-opts sg-${kind}"></div>`;
      const box = footEl.querySelector('.sg-opts');
      let beat = null, timer = null, settled = false;
      const done = v => {
        if (settled) return; settled = true;
        clearInterval(beat); clearTimeout(timer);
        root.classList.remove('sg-pressure');
        footEl.innerHTML = '';
        res(v);
      };
      labels.forEach((l, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'sg-opt';
        b.textContent = l;
        b.addEventListener('click', () => done({ i, timedOut: false }));
        box.appendChild(b);
      });
      if (seconds) {
        const bar = footEl.querySelector('.sg-timer i');
        bar.style.animationDuration = seconds + 's';
        root.classList.add('sg-pressure');
        Sfx.beat(); beat = setInterval(() => { Sfx.beat(); buzz(30); }, 1000);
        timer = setTimeout(() => done({ i: Math.floor(Math.random() * labels.length), timedOut: true }), seconds * 1000);
      }
      scrollLog();
    });
  }
  function footButton(label, cls = 'primary') {
    return new Promise(res => {
      footEl.innerHTML = `<button type="button" class="sg-cta ${cls}">${label}</button>`;
      footEl.firstChild.addEventListener('click', () => { footEl.innerHTML = ''; res(); });
      scrollLog();
    });
  }
  function footName() {
    return new Promise(res => {
      footEl.innerHTML = `<form class="sg-name"><input maxlength="20" placeholder="Your name" aria-label="Your name" autocomplete="nickname" /><button class="sg-cta primary">Send</button></form>`;
      const f = footEl.firstChild, inp = f.querySelector('input');
      setTimeout(() => inp.focus(), 50);
      scrollLog();
      f.addEventListener('submit', e => {
        e.preventDefault();
        const v = inp.value.trim().replace(/\s+/g, ' ').slice(0, 20);
        if (!v) { inp.focus(); return; }
        footEl.innerHTML = '';
        res(v);
      });
    });
  }

  // ---------------------------------------------------------------- playing an episode
  async function play(n) {
    const ep = episode(n);
    if (!ep) return;
    const token = {};
    run = { n, token };
    if (!st.cur || st.cur.n !== n) st.cur = { n, i: 0, log: [], hunt: null, battery: null, mood: 'calm' };
    save();
    showView('chat');
    footEl.innerHTML = '';
    setBars(4); setStatus('online'); setMood(st.cur.mood); setBattery(st.cur.battery);
    renderSpeedBtn();
    renderLog();
    try {
      if (st.cur.i === 0 && !st.cur.log.length) {
        track('signal_episode_start', { ep: n });
        await titleCard(token, ep);
      }
      while (st.cur.i < ep.steps.length) {
        const s = ep.steps[st.cur.i];
        if (passes(s)) await runStep(token, s, ep);
        if (!alive(token)) return;
        st.cur.i++;
        save();
      }
    } catch (e) {
      if (e !== ABORT) console.error('Signal:', e);
    }
  }

  async function runStep(token, s, ep) {
    const cur = st.cur;
    if (s.mood) { cur.mood = s.mood; setMood(s.mood); }
    if (s.sys) { await step(token, wait(700 * pace())); addEntry({ t: 'sys', text: fill(s.sys) }); await step(token, wait(600 * pace())); return; }
    if (s.pause) { await step(token, wait(s.pause)); return; }
    if (s.battery != null) { cur.battery = s.battery; setBattery(s.battery); if (s.battery <= 20) buzz([20, 60, 20]); return; }
    if (s.m) {
      const text = fill(s.m);
      await typing(token, 'meera', text);
      addEntry({ t: 'msg', who: 'meera', text, mood: s.mood || cur.mood });
      Sfx.recv(); buzz(8);
      await step(token, wait(readMs(text)));
      return;
    }
    if (s.from) {
      const text = fill(s.text);
      await typing(token, s.from, text);
      addEntry({ t: 'msg', who: s.from, text });
      Sfx.other(); buzz([10, 40, 10]);
      await step(token, wait(readMs(text)));
      return;
    }
    if (s.photo) {
      await typing(token, 'meera', 'photo');
      addEntry({ t: 'photo', who: 'meera', photo: s.photo });
      Sfx.shutter();
      await step(token, wait(2800 * pace()));
      return;
    }
    if (s.voice) {
      await typing(token, 'meera', s.voice.text.slice(0, 30));
      addEntry({ t: 'voice', who: 'meera', voice: s.voice });
      Sfx.recv();
      await step(token, wait(2000 * pace()));
      return;
    }
    if (s.reply) {
      const pick = await step(token, footChoices(s.reply.map(fill)));
      addEntry({ t: 'me', text: fill(s.reply[pick.i]) });
      Sfx.send();
      return;
    }
    if (s.askName) {
      const v = await step(token, footName());
      st.name = v;
      addEntry({ t: 'me', text: v });
      Sfx.send();
      return;
    }
    if (s.hunt) return hunt(token, s.hunt, ep);
    if (s.choice) return choose(token, s.choice, ep);
    if (s.branch) {
      for (const b of (s.paths[st.choices[s.branch]] || [])) if (passes(b)) await runStep(token, b, ep);
      return;
    }
    if (s.byTrust) {
      const lvl = trustLevel();
      if (s.ending) { st.ending = lvl; if (!st.endingsSeen.includes(lvl)) st.endingsSeen.push(lvl); save(); track('signal_ending', { ending: lvl, trust: st.trust }); }
      for (const b of s.byTrust[lvl] || []) if (passes(b)) await runStep(token, b, ep);
      return;
    }
    if (s.glitch) return glitch(token);
    if (s.end) return finish(token, ep, fill(s.end));
  }

  // A clue is one step or a list of them
  async function playClue(token, clue, ep) {
    for (const s of Array.isArray(clue) ? clue : [clue]) await runStep(token, s, ep);
  }

  // ---------------------------------------------------------------- the hunt (Pin Drop)
  async function hunt(token, h, ep) {
    const cur = st.cur;
    if (!cur.hunt) {
      // The last choice can add or take away a pin (power bank, smashed screen…)
      const attempts = Math.max(3, Math.min(5, SIGNAL.basePins + (st.pinMod || 0)));
      cur.hunt = { clue: 0, pins: [], panel: 0, attempts, mod: attempts - SIGNAL.basePins, result: null };
      st.pinMod = 0;
      save();
    }
    const H = cur.hunt;
    if (!H.result) {
      if (H.clue === 0) {
        H.panel = cur.log.length;
        await playClue(token, h.clues[0], ep);
        H.clue = 1; save();
      }
      if (!H.intro) {
        await step(token, wait(400));
        addEntry({ t: 'sys', text: `📍 Find Meera. Drop a pin where you think she is. ${H.attempts} pins.` });
        if (H.mod > 0) addEntry({ t: 'effect', text: '🔌 +1 pin, thanks to the power bank' });
        if (H.mod < 0) addEntry({ t: 'effect', text: '⚠️ −1 pin, because of what happened last time' });
        H.intro = true;
      }
      H.result = await step(token, new Promise(res => {
        footButton(H.pins.length ? '🌍 Back to the globe' : '🌍 Find Meera on the globe').then(() => openGlobe(token, h, ep, res));
      }));
      save();
      addEntry({ t: 'result', city: h.city.name, country: h.city.country, found: H.result.found, pins: H.result.pins, km: H.result.km });
      H.result.found ? (Sfx.found(), buzz([30, 50, 30, 50, 80])) : Sfx.lost();
      track('signal_hunt_done', { ep: ep.n, found: H.result.found, pins: H.result.pins, km: H.result.km });
      await step(token, wait(900));
    }
    for (const s of (H.result.found ? h.found : h.lost)) await runStep(token, s, ep);
  }
  function panelHTML(h) {
    const H = st.cur.hunt;
    const last = H.pins[H.pins.length - 1];
    const entries = st.cur.log.slice(H.panel).filter(e => e.t === 'msg' || e.t === 'photo' || e.t === 'voice');
    const shown = entries.slice(-4);
    const bits = shown.map(e => e.t === 'photo' ? polaroid(e.photo, 'ep' + st.cur.n + e.k, { develop: false, small: true })
      : e.t === 'voice' ? `<p class="sg-pp-voice">🎙️ “${esc(e.voice.text)}”</p>` : `<p>${esc(e.text)}</p>`).join('');
    const where = H.result ? `${H.pins.length} pin${H.pins.length === 1 ? '' : 's'}` : `pin ${H.pins.length + 1} of ${H.attempts}`;
    const head = `<div class="sg-pp-head">${face('meera', st.cur.mood)}<b>Meera</b><span>Clue ${H.clue} of ${h.clues.length} · ${where}</span></div>`;
    const res = H.result ? `<p class="sg-pp-res ${H.result.found ? 'ok' : ''}">${H.result.found ? `📍 Found her! ${H.result.km.toLocaleString()} km off` : `She was in ${esc(h.city.name)}`}</p>`
      : last ? `<p class="sg-pp-res">Pin ${last.n}: ${last.km.toLocaleString()} km away · ${COMPASS_ARROW[last.dir] || ''} try ${last.dir}</p>` : '';
    return `<div class="sg-pp">${head}${res}<div class="sg-pp-clues">${bits}</div></div>`;
  }

  function openGlobe(token, h, ep, resolve) {
    if (!alive(token)) return;
    const H = st.cur.hunt;
    hideRoot();
    footEl.innerHTML = '';
    PinDrop.start({
      target: { name: h.city.name, lat: h.city.lat, lon: h.city.lon },
      chip: `📡 Ep ${ep.n} · Find Meera`,
      lockLabel: '📍 Send pin to Meera',
      attempts: H.attempts,
      panel: el => {
        el.innerHTML = panelHTML(h);
        el.querySelectorAll('figure').forEach(f => f.addEventListener('click', () => { root.hidden = false; openLightbox(f); q('.sg-lightbox').onclick = () => { q('.sg-lightbox').hidden = true; hideRoot(); }; }));
      },
      onBack: () => {
        if (!alive(token)) return;
        showView('chat');
        if (!H.result) footButton('🌍 Back to the globe').then(() => { if (alive(token)) { hideRoot(); PinDrop.render(); } });
      },
      onLock: async r => {
        if (!alive(token)) return { done: true };
        Sfx.pin();
        const dir = compassBearing(r.lat, r.lon, h.city.lat, h.city.lon);
        H.pins.push({ lat: r.lat, lon: r.lon, km: r.km, temp: pinTemp(r.km), n: r.attempt, dir });
        const found = r.km <= h.radiusKm;
        if (found || r.attempt >= H.attempts) {
          const best = Math.min(...H.pins.map(p => p.km));
          const result = { found, pins: r.attempt, attempts: H.attempts, km: found ? r.km : best, temps: H.pins.map(p => found && p === H.pins[H.pins.length - 1] ? 'correct' : p.temp) };
          H.result = result;
          // Finding her fast builds trust; losing her costs it
          st.trust += found ? (r.attempt <= 2 ? 2 : 1) : -1;
          st.hunts++;
          save();
          found ? Sfx.found() : Sfx.lost();
          buzz(found ? [40, 40, 120] : 200);
          setTimeout(() => {
            if (!alive(token)) return;
            PinDrop.stop();
            showScreen('home');
            showView('chat');
            resolve(result);
          }, found ? 3000 : 3600);
          return { done: true, reveal: true };
        }
        addEntry({ t: 'pin', text: `📍 Pin ${r.attempt}: ${r.km.toLocaleString()} km off · ${COMPASS_ARROW[dir] || ''} she’s ${dir} of it` }, false);
        const miss = h.miss[Math.min(r.attempt - 1, h.miss.length - 1)];
        H.panel = st.cur.log.length;
        if (miss) addEntry({ t: 'msg', who: 'meera', text: fill(miss), mood: 'scared' }, false);
        const next = h.clues[H.clue];
        if (next) {
          for (const s of Array.isArray(next) ? next : [next]) {
            if (s.m) addEntry({ t: 'msg', who: 'meera', text: fill(s.m), mood: s.mood || st.cur.mood }, false);
            else if (s.photo) addEntry({ t: 'photo', who: 'meera', photo: s.photo }, false);
            else if (s.voice) addEntry({ t: 'voice', who: 'meera', voice: s.voice }, false);
          }
          H.clue++;
          Sfx.recv(); buzz(8);
        }
        save();
        return { done: false };
      },
    });
    // Pins from before a reload
    PinDrop.pins = H.pins.map(p => ({ lat: p.lat, lon: p.lon, km: p.km, temp: p.temp, n: p.n }));
    PinDrop.render();
  }

  // ---------------------------------------------------------------- the choice
  async function choose(token, c, ep) {
    if (st.choices[c.key]) return;
    await step(token, wait(500));
    const pick = await step(token, footChoices(c.options.map(o => o.label), { kind: 'choice', prompt: c.prompt, seconds: c.seconds }));
    const o = c.options[pick.i];
    st.choices[c.key] = o.id;
    st.trust += pick.timedOut ? -1 : (o.trust || 0);
    st.pinMod = (st.pinMod || 0) + (o.pins || 0);
    save();
    if (pick.timedOut) {
      addEntry({ t: 'sys', text: '⏱ You didn’t answer in time' });
      await typing(token, 'meera', 'x');
      addEntry({ t: 'msg', who: 'meera', text: 'you went quiet. okay. I’ll trust my gut', mood: 'scared' });
    } else {
      addEntry({ t: 'me', text: o.reply });
      Sfx.send();
    }
    await step(token, wait(700 * pace()));
    addEntry({ t: 'note', text: pick.timedOut ? 'Meera will remember you went quiet.' : 'Meera will remember that.' });
    if (o.effect) addEntry({ t: 'effect', text: o.effect });
    await step(token, wait(1200 * pace()));
    track('signal_choice', { ep: ep.n, choice: o.id, timed_out: pick.timedOut });
    if (typeof cloudStatus !== 'undefined' && cloudStatus === 'ready' && typeof sb !== 'undefined' && sb) {
      sb.rpc('signal_choose', { p_key: c.key, p_choice: o.id, p_timed_out: pick.timedOut }).then(({ error }) => {
        if (error) console.warn('signal_choose:', error.message);
      });
    }
  }

  // The world's split for a choice: { ferry: 120, bazaar: 80 } or null
  async function split(key) {
    if (typeof cloudStatus === 'undefined' || cloudStatus !== 'ready' || typeof sb === 'undefined' || !sb) return null;
    try {
      const { data, error } = await Promise.race([sb.rpc('signal_split', { p_key: key }), new Promise(r => setTimeout(() => r({ error: 'timeout' }), 1500))]);
      return error ? null : data;
    } catch { return null; }
  }

  // ---------------------------------------------------------------- title card, glitch, end card
  async function titleCard(token, ep) {
    const el = q('.sg-title');
    let recap = '';
    if (ep.recap) {
      const mine = st.choices[ep.recap.key];
      if (mine && ep.recap[mine]) {
        recap = `<p class="sg-recap">${esc(ep.recap[mine])}</p>`;
        const sp = await split(ep.recap.key);
        const total = sp ? Object.values(sp).reduce((a, b) => a + b, 0) : 0;
        if (total >= 5) recap += `<p class="sg-world"><b>${Math.round(100 * (sp[mine] || 0) / total)}%</b> of players chose the same.</p>`;
      }
    }
    el.innerHTML = `<div class="sg-title-in"><p class="sg-kicker">📡 THE SIGNAL</p><p class="sg-epn">EPISODE ${ep.n}</p><h2 data-text="${esc(ep.title)}">${esc(ep.title)}</h2>${recap ? `<div class="sg-prev"><small>Previously</small>${recap}</div>` : ''}<p class="sg-tap">tap to begin</p></div>`;
    el.hidden = false;
    Sfx.drone();
    await step(token, new Promise(res => {
      const t = setTimeout(go, recap ? 6500 : 4200);
      function go() { clearTimeout(t); el.removeEventListener('click', go); res(); }
      el.addEventListener('click', go);
    }));
    el.classList.add('sg-out');
    await step(token, wait(500));
    el.hidden = true;
    el.classList.remove('sg-out');
  }

  async function glitch(token) {
    await step(token, wait(900));
    setBars(0);
    setStatus('connection lost');
    Sfx.glitch();
    buzz([60, 30, 120, 40, 200]);
    root.classList.add('sg-glitching');
    const stat = q('.sg-static');
    stat.style.backgroundImage = `url(${staticNoise()})`;
    await step(token, wait(reduceMotion() ? 600 : 1600));
    root.classList.remove('sg-glitching');
  }
  function staticNoise() {
    const c = document.createElement('canvas');
    c.width = 160; c.height = 160;
    const x = c.getContext('2d'), img = x.createImageData(160, 160);
    for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
    x.putImageData(img, 0, 0);
    return c.toDataURL();
  }

  const SQUARE = { correct: '🟩', hot: '🟥', warm: '🟧', cool: '🟨', cold: '🟦' };
  function squares(r, attempts = r.attempts || SIGNAL.basePins) {
    const s = (r.temps || []).map(t => SQUARE[t] || '⬛');
    while (s.length < attempts) s.push('▫️');
    return s.join('');
  }

  async function finish(token, ep, text) {
    const H = st.cur.hunt && st.cur.hunt.result;
    const result = H || { found: false, pins: 0, km: 0, temps: [] };
    st.eps[ep.n] = { at: Date.now(), found: result.found, pins: result.pins, attempts: result.attempts, km: result.km, temps: result.temps, level: trustLevel() };
    st.cur = null;
    save();
    track('signal_episode_end', { ep: ep.n, found: result.found, pins: result.pins });
    run = null;
    showEnd(ep, text);
  }

  function showEnd(ep, text) {
    const el = q('.sg-end');
    const r = st.eps[ep.n];
    const next = episode(ep.n + 1);
    const at = next ? unlockAt(next.n) : null;
    const E = !next && st.ending ? SIGNAL.endings[st.ending] : null;
    el.innerHTML = `<div class="sg-end-in">
      <p class="sg-end-text"></p>
      <div class="sg-end-card">
        <p class="sg-kicker">📡 THE SIGNAL · EPISODE ${ep.n}</p>
        <p class="sg-end-score">${r.found ? `Found Meera with pin ${r.pins}` : 'Meera slipped away'}</p>
        <p class="sg-end-sq">${squares(r)}</p>
        ${E ? `<p class="sg-ending">Ending: <b>${esc(E.name)}</b> · ${st.endingsSeen.length} of 3 found</p><p class="sg-ending-line">${esc(E.line)}</p>`
            : r.level ? `<p class="sg-trust sg-trust-${r.level}">${TRUST_LINE[r.level]}</p>` : ''}
      </div>
      ${next ? `<p class="sg-next">Episode ${next.n} · <b>${esc(next.title)}</b><br><span class="sg-next-when">${at <= Date.now() ? 'is ready now' : `arrives ${whenText(at)}`}</span></p>`
             : `<p class="sg-next">Act 2 is being written.<br><span class="sg-next-when">You’ll hear from her again.</span></p>`}
      <div class="sg-end-actions">
        <button type="button" class="sg-cta sg-share">Share</button>
        ${next && at <= Date.now() ? `<button type="button" class="sg-cta primary sg-go">Episode ${next.n} ▶</button>` : `<button type="button" class="sg-cta primary sg-menu-btn">Episodes</button>`}
      </div></div>`;
    el.hidden = false;
    // Type the last line, letter by letter
    const p = el.querySelector('.sg-end-text');
    let i = 0;
    const tick = () => { p.textContent = text.slice(0, ++i); if (i < text.length) setTimeout(tick, 45); };
    setTimeout(tick, 400);
    el.querySelector('.sg-share').addEventListener('click', () => share(ep));
    el.querySelector('.sg-go')?.addEventListener('click', () => { el.hidden = true; play(next.n); });
    el.querySelector('.sg-menu-btn')?.addEventListener('click', () => { el.hidden = true; openMenu(); });
  }

  const TRUST_LINE = {
    high: '💛 Meera trusts you',
    mid:  '🤍 Meera isn’t sure about you yet',
    low:  '🖤 Meera is losing hope in you',
  };

  async function share(ep) {
    const r = st.eps[ep.n];
    const E = !episode(ep.n + 1) && st.ending ? SIGNAL.endings[st.ending] : null;
    const text = `📡 THE SIGNAL · Episode ${ep.n}\n${r.found ? `I found Meera with pin ${r.pins}` : 'Meera slipped away from me'} ${squares(r)}\n${E ? `My ending: ${E.name} (1 of 3). What did you get?` : ep.share || ''}`.trim();
    const url = shareUrl('signal');
    track('signal_share', { ep: ep.n });
    if (navigator.share) {
      try { await navigator.share({ text, url }); return; } catch (e) { if (e.name === 'AbortError') return; }
    }
    copyText(`${text}\n${url}`);
  }

  // ---------------------------------------------------------------- season menu
  function openMenu() {
    run = null;
    hurry();
    const el = q('.sg-menu');
    const up = nextUp();
    const ep = episode(up.n);
    const cta = up.state === 'resume' ? `Continue · Episode ${ep.n}`
              : up.state === 'play' ? `▶ Episode ${ep.n} · ${ep.title}`
              : up.state === 'wait' ? `Episode ${ep.n} in <span class="sg-cd">${countdown(up.at)}</span>`
              : 'Act 2 · coming soon';
    const list = EPS.map(e => {
      const r = st.eps[e.n];
      const isNext = e.n === up.n && up.state !== 'done';
      const state = r ? (r.found ? '✓' : '✗') : isNext ? (up.state === 'wait' ? '⏳' : '●') : '🔒';
      return `<li class="${r ? (r.found ? 'done' : 'done lost') : isNext ? 'next' : 'locked'}"><span class="sg-ep-n">${e.n}</span><span class="sg-ep-t"><b>${r || isNext ? esc(e.title) : '???'}</b><small>${r ? `${esc(e.city)} · ${squares(r)}` : isNext && up.state === 'wait' ? `arrives ${whenText(up.at)}` : isNext ? 'ready' : 'locked'}</small></span><span class="sg-ep-s">${state}</span>${r ? `<button type="button" class="sg-replay" data-n="${e.n}" aria-label="Read episode ${e.n} again">↺</button>` : ''}</li>`;
    }).join('');
    const board = EPS.filter(e => st.eps[e.n]).map(e => {
      const h = e.steps.find(s => s.hunt);
      const firstPhoto = h && h.hunt.clues.flat().find(s => s.photo);
      return `<div class="sg-ev ${st.eps[e.n].found ? '' : 'sg-ev-miss'}">${firstPhoto ? polaroid({ ...firstPhoto.photo, caption: e.city }, 'board' + e.n, { develop: false, small: true }) : ''}</div>`;
    }).join('');
    el.innerHTML = `
      <header class="sg-menu-head"><button type="button" class="sg-icon sg-close" aria-label="Back to home"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button><span></span><button type="button" class="sg-icon sg-sound" aria-label="Sound"></button></header>
      <div class="sg-hero">
        <div class="sg-radar">${face('meera', st.eps[7] ? 'smile' : 'scared')}<i></i><i></i><i></i></div>
        <h1 class="sg-logo" data-text="THE SIGNAL">THE SIGNAL</h1>
        <p class="sg-tag">${esc(SIGNAL.tagline)}</p>
        <button type="button" class="sg-cta primary sg-start" ${up.state === 'wait' || up.state === 'done' ? 'disabled' : ''}>${cta}</button>
        ${up.state === 'wait' ? '<p class="sg-hint">A new episode every evening at 7 PM. Meera needs time to find a signal.</p>' : ''}
      </div>
      ${board ? `<h3 class="sg-h3">Evidence board</h3><div class="sg-board">${board}</div>` : ''}
      ${st.ending ? `<div class="sg-endings"><p>Your ending: <b>${esc(SIGNAL.endings[st.ending].name)}</b></p><p class="sg-endings-dots">${['high', 'mid', 'low'].map(l => `<span class="${st.endingsSeen.includes(l) ? 'on' : ''}" title="${st.endingsSeen.includes(l) ? esc(SIGNAL.endings[l].name) : '???'}">${st.endingsSeen.includes(l) ? esc(SIGNAL.endings[l].name) : '???'}</span>`).join('')}</p><button type="button" class="sg-cta sg-again">↺ Play Act 1 again for another ending</button></div>` : ''}
      <h3 class="sg-h3">Act 1 · The Escape</h3>
      <ol class="sg-eps">${list}</ol>
      <p class="sg-fine">Your name and city stay on this device. Choices are counted anonymously so each episode can show how the world chose.</p>`;
    showView('menu');
    renderSoundBtns();
    el.querySelector('.sg-close').addEventListener('click', close);
    el.querySelector('.sg-start').addEventListener('click', () => play(up.n));
    el.querySelectorAll('.sg-replay').forEach(b => b.addEventListener('click', () => reread(+b.dataset.n)));
    el.querySelector('.sg-again')?.addEventListener('click', () => {
      if (!confirm('Start Act 1 again? Your endings found are kept; this run’s episodes and choices start fresh.')) return;
      track('signal_replay', { endings: st.endingsSeen.length });
      st = fresh({ name: st.name, sound: st.sound, pace: st.pace, endingsSeen: st.endingsSeen, replay: true });
      save();
      openMenu();
    });
    clearInterval(_menuTick);
    if (up.state === 'wait') _menuTick = setInterval(() => {
      if (root.hidden || q('.sg-menu').hidden) { clearInterval(_menuTick); return; }
      if (up.at <= Date.now()) { clearInterval(_menuTick); openMenu(); return; }
      const cd = el.querySelector('.sg-cd'); if (cd) cd.textContent = countdown(up.at);
    }, 1000);
  }
  let _menuTick = null;

  // Read a finished episode again: the story text, no hunt or choice
  function reread(n) {
    const ep = episode(n);
    const log = [];
    const walk = steps => {
      for (const s of steps) {
        if (!passes(s)) continue;
        if (s.m) log.push({ t: 'msg', who: 'meera', text: fill(s.m), mood: s.mood });
        else if (s.from) log.push({ t: 'msg', who: s.from, text: fill(s.text) });
        else if (s.sys) log.push({ t: 'sys', text: fill(s.sys) });
        else if (s.photo) log.push({ t: 'photo', who: 'meera', photo: s.photo });
        else if (s.voice) log.push({ t: 'voice', who: 'meera', voice: s.voice, played: true });
        else if (s.hunt) { walk([].concat(...s.hunt.clues.map(c => [].concat(c)))); walk(st.eps[n].found ? s.hunt.found : s.hunt.lost); }
        else if (s.choice) { const o = s.choice.options.find(o => o.id === st.choices[s.choice.key]); if (o) log.push({ t: 'me', text: o.reply }); }
        else if (s.branch) walk(s.paths[st.choices[s.branch]] || []);
        else if (s.byTrust) walk(s.byTrust[s.ending ? st.ending : (st.eps[n] && st.eps[n].level) || trustLevel()] || []);
        else if (s.reply) continue;
        else if (s.end) log.push({ t: 'sys', text: fill(s.end) });
      }
    };
    walk(ep.steps);
    log.forEach((e, k) => { e.k = k; });
    run = null;
    showView('chat');
    footEl.innerHTML = '';
    setBars(4); setStatus(`episode ${n} · ${ep.title}`); setMood('calm'); setBattery(null);
    logEl.innerHTML = '';
    for (const e of log) logEl.appendChild(entryNode(e, { seed: 'ep' + n }));
    logEl.scrollTop = 0;
    footButton('Back to episodes', '').then(openMenu);
  }

  const PACE_NAME = { 1: 'relaxed', 2: 'normal', 3: 'fast' };
  function renderSpeedBtn() {
    const b = q('.sg-speed');
    b.textContent = `${st.pace || 1}×`;
    b.setAttribute('aria-label', `Message speed: ${PACE_NAME[st.pace || 1]}`);
    b.title = `Message speed: ${PACE_NAME[st.pace || 1]}`;
  }
  q('.sg-speed').addEventListener('click', () => {
    st.pace = (st.pace || 1) % 3 + 1;
    save();
    renderSpeedBtn();
    track('signal_speed', { pace: st.pace });
  });

  function renderSoundBtns() {
    root.querySelectorAll('.sg-sound').forEach(b => {
      b.innerHTML = st.sound ? '<svg viewBox="0 0 24 24"><path d="M11 5 6 9H3v6h3l5 4V5ZM15.5 8.5a5 5 0 0 1 0 7M18.5 6a9 9 0 0 1 0 12"/></svg>'
                             : '<svg viewBox="0 0 24 24"><path d="M11 5 6 9H3v6h3l5 4V5ZM16 9l5 6M21 9l-5 6"/></svg>';
      b.setAttribute('aria-pressed', st.sound ? 'true' : 'false');
    });
  }
  root.addEventListener('click', e => {
    if (e.target.closest('.sg-sound')) { st.sound = !st.sound; save(); renderSoundBtns(); if (st.sound) Sfx.recv(); }
  });
  q('.sg-chat .sg-back').addEventListener('click', () => {
    hurry();
    if (typeof PinDrop !== 'undefined' && PinDrop.active) { PinDrop.stop(); showScreen('home'); }
    openMenu();
  });

  // ---------------------------------------------------------------- open / close / home tile
  function open() {
    track('signal_open', { next: nextUp().n });
    renderSoundBtns();
    q('.sg-end').hidden = true;
    q('.sg-title').hidden = true;
    openMenu();
  }
  function close() {
    run = null;
    hurry();
    clearInterval(_menuTick);
    if (typeof PinDrop !== 'undefined' && PinDrop.active) PinDrop.stop();
    hideRoot();
    showScreen('home');
  }

  function renderHomeCard() {
    const card = document.getElementById('signal-card');
    if (!card) return;
    const started = Object.keys(st.eps).length > 0 || st.cur;
    card.hidden = !enabled() || (!started && typeof settledPlayer === 'function' && !settledPlayer());
    if (card.hidden) return;
    const up = nextUp();
    const desc = card.querySelector('.mode-desc');
    const badge = card.querySelector('.mode-badge-new');
    desc.textContent = !started ? 'A stranger is texting you for help'
      : up.state === 'resume' ? `Episode ${up.n} · Meera is waiting for you`
      : up.state === 'play' ? `Episode ${up.n} is here · she’s back online`
      : up.state === 'wait' ? `Episode ${up.n} in ${countdown(up.at)}`
      : 'Act 2 · coming soon';
    badge.hidden = !(up.state === 'play' || up.state === 'resume' || !started);
    badge.textContent = !started ? 'NEW' : up.state === 'resume' ? '1' : 'NEW';
    card.classList.toggle('sg-card-live', up.state === 'play' || up.state === 'resume' || !started);
  }
  renderHomeCard();

  return {
    open, close, enabled, renderHomeCard,
    // for tests and the dev console
    _state: () => st,
    _reset() { st = fresh({ sound: st.sound, pace: st.pace }); save(); },
    _unlockAt: unlockAt,
  };
})();
