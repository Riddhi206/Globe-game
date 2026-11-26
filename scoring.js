// scoring.js — score formula and result sharing (text + image)

// ============================================================
// Security: safely escape text before inserting into innerHTML
// ============================================================
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ============================================================
// Opener rarity
// Rough guess at how often each country is picked as a first guess
// (0–1). Hand-tuned, not measured. Only the Bold Opener badge uses it
// now; it no longer counts toward the score.
// ============================================================
const OPENER_FREQUENCY = {
  'United States':   0.92,
  'China':           0.85,
  'Russia':          0.80,
  'India':           0.78,
  'Brazil':          0.55,
  'Australia':       0.52,
  'France':          0.45,
  'Germany':         0.44,
  'United Kingdom':  0.42,
  'Canada':          0.40,
  'Japan':           0.38,
  'Mexico':          0.35,
  'Argentina':       0.28,
  'South Africa':    0.26,
  'Nigeria':         0.24,
  'Indonesia':       0.22,
  'Spain':           0.20,
  'Italy':           0.20,
  'Saudi Arabia':    0.18,
  'Turkey':          0.18,
  'Egypt':           0.17,
  'Iran':            0.16,
  'Pakistan':        0.15,
  'Ukraine':         0.14,
  'Sweden':          0.13,
  'Norway':          0.12,
  'Poland':          0.12,
  'South Korea':     0.11,
  'Thailand':        0.10,
};

function getOpenerFrequency(name) {
  return OPENER_FREQUENCY[name] ?? 0.03; // anything not listed ≈ very rare
}

// ============================================================
// Score formula: the number IS the rank
//   Found in 1 guess:  1000
//   Found in n:        (11 − n) × 100  +  aim (0–99)   → 2 = 900–999 … 10 = 100–199
//   Not found:         aim from the closest guess (0–99)
// Aim: how close the guesses before the answer landed, on average
// (centre to centre). 99 at 0 km, falling to 0 at AIM_ZERO_KM.
// So fewer guesses always wins, and among equal guesses the sharper
// navigator wins, never the luckier opener.
//
// The server works out the same number from the guess list
// (daily_points in supabase/021_scoring.sql) and keeps that one, so
// keep the two in step: integer km, integer maths.
// ============================================================
const AIM_ZERO_KM = 10000;

const _centres = new Map();
function countryCentre(name) {
  if (!_centres.size) for (const c of COUNTRIES) _centres.set(c.name, c);
  return _centres.get(name);
}

// Whole km between two countries' centres; unknown names count as far
function centreKm(a, b) {
  const p = countryCentre(a), q = countryCentre(b);
  return p && q ? Math.round(haversine(p.lat, p.lon, q.lat, q.lon)) : AIM_ZERO_KM;
}

// 0–99 from a list of whole-km distances
function aimPoints(kms) {
  if (!kms.length) return 0;
  const z = AIM_ZERO_KM * kms.length;
  const sum = kms.reduce((a, b) => a + b, 0);
  return Math.max(0, Math.floor(99 * (z - sum) / z));
}

function calcScore({ won, guessNames, answer }) {
  const n = guessNames.length;
  if (won) {
    if (n <= 1) return { total: 1000, breakdown: [{ label: t('First guess. Legendary.'), value: '1,000', highlight: true }] };
    const kms  = guessNames.slice(0, -1).map(g => centreKm(g, answer));
    const aim  = aimPoints(kms);
    const band = Math.max(1, 11 - n) * 100;
    const avg  = Math.round(kms.reduce((a, b) => a + b, 0) / kms.length);
    return { total: band + aim, breakdown: [
      { label: t('Found in {n} guesses', { n }), value: `${band}` },
      { label: t('Aim: {km} km off on average', { km: avg.toLocaleString() }), value: `+${aim}`, highlight: aim >= 80 },
    ] };
  }
  const best = n ? Math.min(...guessNames.map(g => centreKm(g, answer))) : AIM_ZERO_KM;
  const aim  = aimPoints([best]);
  return { total: aim, breakdown: [
    { label: t('Not found'), value: '0' },
    { label: t('Closest guess: {km} km', { km: best.toLocaleString() }), value: `+${aim}` },
  ] };
}

// Dailies played before this formula get re-scored once, from their guess list
// (the server re-scores its copies in 021_scoring.sql)
const RESCORE_KEY = 'pancake_rescored_v2';
function rescoreOldGames() {
  try { if (localStorage.getItem(RESCORE_KEY)) return; } catch { return; }
  const s = loadStore();
  let changed = 0;
  for (const g of s.games) {
    if (!g.guesses || !g.guesses.length || !g.mystery || !['daily', 'classic', 'endless'].includes(g.mode)) continue;
    const r = calcScore({ won: g.won, guessNames: g.guesses, answer: g.mystery });
    if (r.total !== g.score) { g.score = r.total; g.breakdown = r.breakdown; changed++; }
  }
  if (changed) saveStore();
  try { localStorage.setItem(RESCORE_KEY, '1'); } catch {}
}

// ============================================================
// Sharing
// A result object: { mode, day, won, guessCount, temps[], score,
//                    mysteryName, mysteryFlag }
// Daily shares never reveal the answer (no spoilers).
// ============================================================
const SHARE_COLORS = {
  correct: '#22c55e', adjacent: '#a855f7', hot: '#ef4444',
  warm: '#f97316', cool: '#eab308', cold: '#3b82f6',
};

// The game's link; with a surface, tagged so a visit from it can be attributed (analytics.js)
function shareUrl(surface = null) {
  const base = /^https?:$/.test(location.protocol) ? location.origin + location.pathname : '';
  return surface && typeof tagLink === 'function' ? tagLink(base, surface) : base;
}

function resultTitle(r) {
  if (r.mode === 'daily') return `${APP_NAME} ${t('Daily #{n}', { n: dailyNumber(r.day) })}`;
  return `${APP_NAME} · ${r.mode === 'endless' ? 'Endless' : t('Classic')}`;
}

function resultLine(r) {
  const limit = r.mode === 'endless' ? '' : `/${MAX_GUESSES}`;
  if (!r.won) return `X${limit}`;
  return `${r.guessCount}${limit}`;
}

// Click-bait hooks, picked at random per share. {n} is the guess count.
// Never reveal the Daily answer in these lines.
const SHARE_HOOKS = {
  lost: [
    'The globe beat me today. Think you could find the mystery country? 🌍',
    'I gave up on today’s mystery country. Prove me wrong 😏',
    'Ten guesses and nothing. The mystery country is still laughing at me 🌍',
    'My map is blank and my pride is not. Your turn to fail 🫠',
    'Somewhere out there, a country is smirking at me. Go avenge me 🌏',
    'Ten guesses, zero clues, one bruised ego. Can you do better? 🧭',
    'I lost to a country the size of a fingernail. Help me 😭',
    'The globe has spoken, and it said “nope.” Try your luck 🗺️',
  ],
  one: [
    'One guess. ONE. Nobody believes me 🤯 Beat that',
    'Called it on the first try. Is this genius or cheating? 👀',
    'First guess, bullseye. I’m not even sorry 😎 Your move',
    'In one guess. My friends think I hacked it. Prove me wrong 🎯',
  ],
  fast: [
    'Found it in {n} guesses. Nobody believes me 🤯 Beat that',
    'Only {n} guesses. Is this luck or genius? Try to beat me 👀',
    'Called it in {n}. Your friends are going to hate this 😤',
    '{n} guesses. I’m not bragging. I’m just really, really good 😏',
    'Found it in {n} and I’m insufferable about it. Your turn 🏆',
    '{n} guesses. The globe didn’t stand a chance 🌍',
  ],
  good: [
    'Found today’s mystery country in {n} guesses. Beat my score 😤',
    '{n} guesses and a lot of smugness. Your turn 🏆',
    'Cracked it in {n}. I dare you to do better 👀',
    '{n} guesses, one perfect hunch, zero regrets. Beat it 🧠',
    'The mystery country tried to hide in {n} guesses. It failed 🕵️',
    'Solved in {n}. My brain did a little victory dance 💃 Your turn',
  ],
  slow: [
    'Took me {n} guesses and I’m still sweating 😅 Beat my score',
    'Barely made it in {n}. Think you’d do better? Go on 💀',
    '{n} guesses, zero shame. Show me how it’s done 🗺️',
    'It took {n} guesses, three panic attacks and a snack. Beat that 😬',
    'Survived today’s mystery country in {n} guesses. Your turn to suffer 🫣',
    '{n} guesses. The globe owes me an apology. Go make it pay 🌍',
  ],
};

const pickRandom = arr => arr[Math.floor(Math.random() * arr.length)];

function shareHook(r) {
  const H = SHARE_HOOKS;
  if (!r.won) return pickRandom(H.lost);
  const pool = r.guessCount === 1 ? H.one
             : r.guessCount <= 2 ? H.fast
             : r.guessCount <= 5 ? H.good
             : H.slow;
  return pickRandom(pool).replace('{n}', r.guessCount);
}

function buildShareText(r) {
  const answer = r.mode !== 'daily' && r.mysteryName ? ` ${r.mysteryFlag || ''} ${cname(r.mysteryName)}`.trimEnd() : '';
  const emoji  = r.temps.map(t => TEMP_ICON[t] || '⬜');
  const rows   = [];
  for (let i = 0; i < emoji.length; i += 5) rows.push(emoji.slice(i, i + 5).join(''));
  return [
    `🌍 ${resultTitle(r)} — ${resultLine(r)}${answer}`,
    shareHook(r),
    '',
    ...rows,
    '',
    r.won ? t('{n} pts. Beat that 🏆', { n: r.score.toLocaleString() }) : t('Your turn. Can you do better? 🏆'),
    shareUrl('result'),
  ].join('\n').trim();
}

// ============================================================
// The hunt radar: how a game closed in on the answer, with no map.
// The mystery country is the bullseye; each guess is a numbered dot at its real
// distance and compass direction from it (north up), on rings at the heat bands.
// Spoiler-free: without a map, positions relative to an unknown point say nothing.
// ============================================================
const RADAR_RINGS = [[1500, 0.3], [4000, 0.52], [8000, 0.76], [20000, 1]];
function radarRadius(km) {
  let prev = [0, 0];
  for (const ring of RADAR_RINGS) {
    if (km <= ring[0]) return prev[1] + (ring[1] - prev[1]) * (km - prev[0]) / (ring[0] - prev[0]);
    prev = ring;
  }
  return 1;
}
// Map heading (rhumb line, like compassBearing) in degrees, 0 = north
function radarHeading(fromLat, fromLon, toLat, toLon) {
  let dLon = toLon - fromLon;
  if (dLon > 180) dLon -= 360;
  if (dLon < -180) dLon += 360;
  const clamp = l => Math.max(-89.5, Math.min(89.5, l));
  const mercY = l => Math.log(Math.tan(Math.PI / 4 + toRad(clamp(l)) / 2));
  return (toDeg(Math.atan2(toRad(dLon), mercY(toLat) - mercY(fromLat))) + 360) % 360;
}
// [{ x, y, temp, n }] in units of the radar radius, or null without the guess list
function radarPoints(r) {
  const answer = r.guesses && COUNTRIES.find(c => c.name === r.mysteryName);
  if (!answer) return null;
  return r.guesses.map((name, i) => {
    const c = COUNTRIES.find(x => x.name === name);
    if (!c) return null;
    if (name === answer.name) return { x: 0, y: 0, temp: 'correct', n: i + 1 };
    const km = haversine(answer.lat, answer.lon, c.lat, c.lon);
    const a = toRad(radarHeading(answer.lat, answer.lon, c.lat, c.lon));
    const rr = radarRadius(km);
    return { x: Math.sin(a) * rr, y: -Math.cos(a) * rr, temp: r.temps[i] || 'cold', n: i + 1 };
  }).filter(Boolean);
}
// Draws the radar centred at (cx, cy) with radius R on a 2D context
function drawRadar(g, cx, cy, R, r, { dark = true, scale = 1 } = {}) {
  const pts = radarPoints(r);
  if (!pts) return false;
  const ink = dark ? '255,255,255' : '17,17,18';
  g.save();
  // Rings, faint fill toward the centre in the heat colours
  [...RADAR_RINGS].reverse().forEach(([km, f], i) => {
    g.beginPath(); g.arc(cx, cy, R * f, 0, Math.PI * 2);
    g.fillStyle = [`rgba(59,130,246,0.07)`, `rgba(234,179,8,0.08)`, `rgba(249,115,22,0.09)`, `rgba(239,68,68,0.11)`][i];
    g.fill();
    g.lineWidth = 1.5 * scale; g.strokeStyle = `rgba(${ink},0.16)`; g.stroke();
  });
  g.beginPath(); g.moveTo(cx - R, cy); g.lineTo(cx + R, cy); g.moveTo(cx, cy - R); g.lineTo(cx, cy + R);
  g.strokeStyle = `rgba(${ink},0.07)`; g.lineWidth = 1 * scale; g.stroke();
  g.fillStyle = `rgba(${ink},0.45)`;
  g.font = `800 ${15 * scale}px Outfit, system-ui, sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'bottom';
  g.fillText('N', cx, cy - R - 4 * scale);
  g.textBaseline = 'middle';
  if (scale >= 1.5) {   // ring distances on the big image only
    g.font = `600 ${11 * scale}px Outfit, system-ui, sans-serif`;
    g.fillStyle = `rgba(${ink},0.35)`;
    for (const [km, f] of RADAR_RINGS.slice(0, 3)) g.fillText(`${km.toLocaleString()} km`, cx + R * f * 0.71 + 4 * scale, cy + R * f * 0.71 + 8 * scale);
  }
  // The path, guess to guess
  const P = p => [cx + p.x * R, cy + p.y * R];
  g.setLineDash([7 * scale, 7 * scale]); g.lineWidth = 2.5 * scale; g.strokeStyle = `rgba(${ink},0.45)`;
  g.beginPath(); pts.forEach((p, i) => { const [x, y] = P(p); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
  g.setLineDash([]);
  // The bullseye: found it, or still a question mark
  const won = r.won;
  g.beginPath(); g.arc(cx, cy, 14 * scale, 0, Math.PI * 2);
  g.fillStyle = won ? SHARE_COLORS.correct : `rgba(${ink},0.18)`; g.fill();
  g.lineWidth = 3 * scale; g.strokeStyle = dark ? '#0c0c0d' : '#ffffff'; g.stroke();
  if (!won) { g.fillStyle = `rgba(${ink},0.8)`; g.font = `900 ${16 * scale}px Outfit, system-ui, sans-serif`; g.fillText('?', cx, cy + 1 * scale); }
  // Guesses, numbered (the found one sits on the bullseye)
  for (const p of pts) {
    if (p.temp === 'correct') continue;
    const [x, y] = P(p), d = 12 * scale;
    g.beginPath(); g.arc(x, y, d, 0, Math.PI * 2);
    g.fillStyle = SHARE_COLORS[p.temp] || '#3a3a3e'; g.fill();
    g.lineWidth = 2.5 * scale; g.strokeStyle = dark ? '#0c0c0d' : '#ffffff'; g.stroke();
    g.fillStyle = p.temp === 'cool' ? '#1a1400' : '#ffffff';
    g.font = `800 ${12 * scale}px Outfit, system-ui, sans-serif`;
    g.fillText(String(p.n), x, y + 0.5 * scale);
  }
  g.restore();
  return true;
}

// An image for the canvas, or null if it can't load (offline, blocked)
function loadImage(src) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// Square 1080×1080 result card, drawn on a canvas
async function buildShareImage(r) {
  if (document.fonts && document.fonts.ready) await document.fonts.ready;
  const S = 1080;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const font = (w, px) => `${w} ${px}px Outfit, system-ui, sans-serif`;

  g.fillStyle = '#0c0c0d';
  g.fillRect(0, 0, S, S);

  // Title with the logo mark in front of it; just the title if the mark can't load
  g.fillStyle = '#f2f2f2';
  g.font = font(800, 56);
  const title = resultTitle(r);
  const mark = await loadImage('icons/mark-dark.svg');
  const markPx = 72, markGap = 18;
  const titleW = g.measureText(title).width;
  const left = (S - titleW - (mark ? markPx + markGap : 0)) / 2;
  if (mark) g.drawImage(mark, left, 150 - markPx * 0.78, markPx, markPx);
  g.textAlign = 'left';
  g.fillText(title, left + (mark ? markPx + markGap : 0), 150);
  g.textAlign = 'center';

  g.font = font(900, 220);
  g.fillText(resultLine(r), S / 2, 430);

  g.fillStyle = '#9a9aa0';
  g.font = font(600, 44);
  const sub = r.won
    ? `Found in ${r.guessCount} guess${r.guessCount === 1 ? '' : 'es'}`
    : 'Not found this time';
  g.fillText(sub, S / 2, 510);

  // The hunt radar (spoiler-free); the old squares when the guess list isn't known
  if (radarPoints(r)) return finishRadarImage(c, g, r, font);   // replaces the big line and the squares
  const size = 96, gap = 20, perRow = 5;
  const rowsN = Math.ceil(r.temps.length / perRow) || 1;
  const top   = 580;
  r.temps.forEach((t, i) => {
    const row = Math.floor(i / perRow), col = i % perRow;
    const inRow = Math.min(perRow, r.temps.length - row * perRow);
    const x0 = (S - (inRow * size + (inRow - 1) * gap)) / 2;
    g.fillStyle = SHARE_COLORS[t] || '#3a3a3e';
    g.beginPath();
    g.roundRect(x0 + col * (size + gap), top + row * (size + gap), size, size, 20);
    g.fill();
  });

  const afterGrid = top + rowsN * (size + gap) + 70;
  g.fillStyle = '#f2f2f2';
  g.font = font(800, 60);
  const scoreY = Math.min(afterGrid, 960);
  g.fillText(`${r.score.toLocaleString()} ${t('pts')}`, S / 2, scoreY);

  // The click-bait line, shrunk until it fits on one line
  const hook = shareHook(r);
  g.fillStyle = '#c9c9cf';
  let hookPx = 44;
  do { g.font = font(700, hookPx); hookPx -= 2; } while (g.measureText(hook).width > 980 && hookPx > 24);
  g.fillText(hook, S / 2, scoreY + 80);

  const url = shareUrl().replace(/^https?:\/\//, '').replace(/\/$/, '') || 'globegame';
  g.fillStyle = '#6a6a70';
  g.font = font(600, 36);
  g.fillText(url, S / 2, 1030);

  return new Promise(resolve => c.toBlob(resolve, 'image/png'));
}

// The radar version of the share image: title (already drawn), radar, result, hook, link
function finishRadarImage(c, g, r, font) {
  const S = c.width;
  // Clear the big score line the classic layout drew under the title
  g.fillStyle = '#0c0c0d'; g.fillRect(0, 190, S, S - 190);
  drawRadar(g, S / 2, 520, 300, r, { dark: true, scale: 2.2 });
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.fillStyle = '#f2f2f2';
  g.font = font(800, 54);
  const line = r.won ? t(r.guessCount === 1 ? 'Found in {n} guess' : 'Found in {n} guesses', { n: r.guessCount }) : t('Not found this time');
  g.fillText(`${line} · ${r.score.toLocaleString()} ${t('pts')}`, S / 2, 900);
  const hook = shareHook(r);
  g.fillStyle = '#c9c9cf';
  let px = 40;
  do { g.font = font(700, px); px -= 2; } while (g.measureText(hook).width > 980 && px > 24);
  g.fillText(hook, S / 2, 960);
  const url = shareUrl().replace(/^https?:\/\//, '').replace(/\/$/, '') || 'globegame';
  g.fillStyle = '#6a6a70'; g.font = font(600, 34); g.fillText(url, S / 2, 1035);
  return new Promise(resolve => c.toBlob(resolve, 'image/png'));
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(t('Copied to clipboard'));
  } catch {
    // No clipboard API (a plain-http page, older browsers): the old select-and-copy way
    showToast(legacyCopy(text) ? t('Copied to clipboard') : t('Could not copy — long-press to select instead'));
  }
}

function legacyCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;font-size:16px';   // 16px: no iOS zoom
  document.body.appendChild(ta);
  ta.select();
  ta.setSelectionRange(0, text.length);
  let ok = false;
  try { ok = document.execCommand('copy'); } catch {}
  ta.remove();
  return ok;
}

// how: 'native' | 'copy' | 'whatsapp' | 'x' | 'image'
async function shareResult(r, how) {
  const text = buildShareText(r);

  if (how === 'copy') return copyText(text);

  if (how === 'whatsapp') {
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    return;
  }
  if (how === 'x') {
    window.open(`https://x.com/intent/post?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    return;
  }

  if (how === 'image') {
    const blob = await buildShareImage(r);
    if (!blob) return showToast(t('Could not create image'));
    const file = new File([blob], `globegame-${r.mode}.png`, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], text }); return; }
      catch (err) { if (err.name === 'AbortError') return; }
    }
    // Fallback: download the PNG
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    return;
  }

  // native
  if (navigator.share) {
    try { await navigator.share({ text }); return; }
    catch (err) { if (err.name === 'AbortError') return; }
  }
  copyText(text);
}
