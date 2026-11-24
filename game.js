// game.js — Pancake core: globe renderer, game loop and UI
// Renders real country polygons on a Canvas 2D orthographic globe.

// ============================================================
// Config
// ============================================================
const MAX_GUESSES = 10;

const THRESHOLDS = {
  hot:  1500,   // < 1 500 km
  warm: 4000,   // < 4 000 km
  cool: 8000,   // < 8 000 km
};

// ============================================================
// Name normalization + alias resolution
// ============================================================

// Strip diacritics, emojis/flags, and lowercase — handles São Tomé, Côte d'Ivoire, 🇫🇷 France, etc.
function normalize(str) {
  return str.trim()
    .replace(/[\uD83C-\uDBFF\uDC00-\uDFFF]+/g, '') // strip emoji / regional indicators (flags)
    .replace(/[\u2600-\u27BF]/g, '')               // strip symbols
    .trim()
    .normalize('NFD')                  // decompose accented chars → base + combining mark
    .replace(/[\u0300-\u036f]/g, '')   // strip combining marks
    .replace(/\u093C/g, '').replace(/\u0901/g, '\u0902')   // Hindi: no nukta, chandrabindu = anusvara
    .toLowerCase();
}

// Aliases: normalized input → canonical name matching COUNTRIES list
const ALIASES = {
  // United States
  'usa':                          'United States',
  'us':                           'United States',
  'united states of america':     'United States',
  'america':                      'United States',
  'the united states':            'United States',
  // United Kingdom
  'uk':                           'United Kingdom',
  'britain':                      'United Kingdom',
  'great britain':                'United Kingdom',
  'england':                      'United Kingdom',
  // Palestine
  'state of palestine':           'Palestine',
  'palestinian territories':      'Palestine',
  'west bank':                    'Palestine',
  'gaza':                         'Palestine',
  // United Arab Emirates
  'uae':                          'United Arab Emirates',
  'emirates':                     'United Arab Emirates',
  // South Korea
  'south korea':                  'South Korea',
  'republic of korea':            'South Korea',
  'kor':                          'South Korea',
  // North Korea
  'dprk':                         'North Korea',
  'democratic peoples republic of korea': 'North Korea',
  // Ivory Coast
  'ivory coast':                  'Ivory Coast',
  'cote d\'ivoire':               'Ivory Coast',
  "cote d'ivoire":                'Ivory Coast',
  'cote divoire':                 'Ivory Coast',
  // DR Congo
  'drc':                          'DR Congo',
  'democratic republic of congo': 'DR Congo',
  'democratic republic of the congo': 'DR Congo',
  'congo kinshasa':               'DR Congo',
  'zaire':                        'DR Congo',
  // Congo (Republic)
  'republic of the congo':        'Congo',
  'congo brazzaville':            'Congo',
  // Tanzania
  'united republic of tanzania':  'Tanzania',
  // Russia
  'russian federation':           'Russia',
  // Iran
  'persia':                       'Iran',
  'islamic republic of iran':     'Iran',
  // Syria
  'syrian arab republic':         'Syria',
  // Venezuela
  'bolivarian republic of venezuela': 'Venezuela',
  // Bolivia
  'plurinational state of bolivia': 'Bolivia',
  // Czech Republic
  'czechia':                      'Czech Republic',
  'czech':                        'Czech Republic',
  // Myanmar
  'burma':                        'Myanmar',
  // North Macedonia
  'macedonia':                    'North Macedonia',
  'fyrom':                        'North Macedonia',
  // Serbia
  'republic of serbia':           'Serbia',
  // Eswatini / Swaziland
  'swaziland':                    'Eswatini',
  // Vatican City
  'vatican city':                 'Vatican',
  'the vatican':                  'Vatican',
  'holy see':                     'Vatican',
  // Cape Verde / Cabo Verde
  'cabo verde':                   'Cape Verde',
  // Timor-Leste
  'timor leste':                  'East Timor',
  'east timor':                   'East Timor',
  // St abbreviation aliases
  'st kitts and nevis':           'Saint Kitts and Nevis',
  'st kitts':                     'Saint Kitts and Nevis',
  'st lucia':                     'Saint Lucia',
  'st vincent and the grenadines':'Saint Vincent and the Grenadines',
  'st vincent':                   'Saint Vincent and the Grenadines',
  'sao tome':                     'Sao Tome and Principe',
  'federated states of micronesia':'Micronesia',
  // Kyrgyzstan alternate
  'kyrgyz republic':              'Kyrgyzstan',
  // Laos alternate
  'lao':                          'Laos',
  "lao people's democratic republic": 'Laos',
  // Vietnam alternate
  'viet nam':                     'Vietnam',
  // Moldova alternate
  'republic of moldova':          'Moldova',
  // Trinidad
  'trinidad':                     'Trinidad and Tobago',
  'tobago':                       'Trinidad and Tobago',
  // Dominican Republic shorthand
  'dr':                           'Dominican Republic',
  'dom rep':                      'Dominican Republic',
  // South Africa shorthand
  'rsa':                          'South Africa',
  // Saudi Arabia shorthand
  'ksa':                          'Saudi Arabia',
  // Papua New Guinea shorthand
  'png':                          'Papua New Guinea',
  // New Zealand shorthand
  'nz':                           'New Zealand',
  // Central African Republic shorthand
  'car':                          'Central African Republic',
  // Bosnia
  'bosnia':                       'Bosnia and Herzegovina',
  'herzegovina':                  'Bosnia and Herzegovina',
  // UAE extra alias
  'fujairah':                     'United Arab Emirates',
};

// Pre-build a normalized → canonical map from COUNTRIES list itself
// so "sao tome" matches "São Tomé and Príncipe" etc.
const NORMALIZED_COUNTRY_MAP = {};
for (const c of COUNTRIES) {
  NORMALIZED_COUNTRY_MAP[normalize(c.name)] = c;
}

// Resolve typed input to a COUNTRIES entry, or null
function findCountry(raw) {
  if (!raw) return null;
  const trimmed = raw.trim();
  // 0. Direct match against flag emoji
  const flagMatch = COUNTRIES.find(c => c.flag === trimmed);
  if (flagMatch) return flagMatch;

  const n = normalize(raw);
  // 1. Direct normalized match against country list
  if (NORMALIZED_COUNTRY_MAP[n]) return NORMALIZED_COUNTRY_MAP[n];
  // 2. Alias lookup → then find canonical
  const canonical = ALIASES[n];
  if (canonical) return NORMALIZED_COUNTRY_MAP[normalize(canonical)] || null;
  // 3. A Hindi name (i18n.js), whichever language the game is in
  const hi = countryFromHindi(trimmed);
  if (hi) return NORMALIZED_COUNTRY_MAP[normalize(hi)] || null;
  return null;
}

// ============================================================
// Flag image helper — uses flagcdn.com (works on all platforms
// including Windows where emoji flags render as letter pairs).
// ============================================================
function makeFlagImg(country, size = 20) {
  const img = document.createElement('img');
  const code = (country.code || '').toLowerCase();
  if (code) {
    img.src   = `https://flagcdn.com/w${size}/${code}.png`;
    img.width  = size;
    img.height = Math.round(size * 0.75);
    img.alt    = country.flag || country.code || '';
    img.loading = 'lazy';
    img.onerror = () => { img.style.display = 'none'; }; // hide if fails to load
  }
  return img;
}

// ============================================================
// State
// ============================================================
let mystery     = null;
let guesses     = [];         // { country, distKm, temp, correct }
let revealed    = null;       // mystery shown on the globe after a loss
let prevDistKm  = null;       // distance of the previous guess (for warmer/cooler)
let gameOver    = false;
let gameMode    = 'classic';  // 'daily' (10 guesses) | 'classic' (unlimited practice) | 'story'; old records may say 'endless'
let gameDay     = null;       // UTC day a Daily belongs to
let flagHint    = false;      // old saves only: the flag round is gone, it no longer shows
let lastResult  = null;
let _abandonLogged = false;   // one game_abandoned event per unfinished game
let acIndex     = -1;

const triviaState = {
  correctAnswer:    '',
  country:          null,
  answered:         false,
  isFlagHintTrivia: false,
  correctCount:     0,
  cluesShown:       0,      // hints about the mystery country won so far (hints.js)
  timer:            null,
};

// Globe view. No idle spin: the globe only moves when the player drags it,
// or when it flies to a guess. Starts over the player's own longitude.
let globeLon      = -new Date().getTimezoneOffset() / 4;
let globeLat      = 20;       // pitch (vertical tilt), clamped to [-85, 85]
let dragging      = false;
let dragStartX    = 0;
let dragStartY    = 0;
let dragStartLon  = 0;
let dragStartLat  = 0;

// Smooth fly-to target
let targetGlobeLon = 0;
let targetGlobeLat = 20;
let lerpActive     = false;

// Zoom
let zoomScale  = 1.0;
const ZOOM_MIN  = 0.5;
const ZOOM_MAX  = 12.0;  // deep enough to pick out microstates like Vatican City
const ZOOM_STEP = 0.12;

let dirty = true; // redraw on next frame

// Cached guesses sorted back-to-front (invalidated on new guess)
let _sortedGuesses = [];
let _sortCacheSize = -1;

function getSortedGuesses() {
  if (_sortCacheSize !== guesses.length) {
    _sortedGuesses = [...guesses].sort((a, b) => {
      const pa = latLonToXY(a.country.lat, a.country.lon);
      const pb = latLonToXY(b.country.lat, b.country.lon);
      return ((pa ? pa.z : -1) - (pb ? pb.z : -1));
    });
    _sortCacheSize = guesses.length;
  }
  return _sortedGuesses;
}

// ============================================================
// Theme
// ============================================================
const root        = document.documentElement;
const systemLight = window.matchMedia('(prefers-color-scheme: light)');

function isLightTheme() {
  return root.dataset.theme ? root.dataset.theme === 'light' : systemLight.matches;
}

// ============================================================
// DOM refs
// ============================================================
const $ = id => document.getElementById(id);

const appEl           = $('app');
const homeScreen      = $('home-screen');
const gameScreen      = $('game-screen');
const hubScreen       = $('hub-screen');
const backBtn         = $('back-btn');
const inputEl         = $('guess-input');
const guessForm       = $('guess-form');
const acListEl        = $('autocomplete-list');
const gameoverActions = $('gameover-actions');
const modeChip        = $('mode-chip');
const guessChip       = $('guess-chip');
const trendEl         = $('trend');
const historyEl       = $('history-list');
const historyEmpty    = $('history-empty');
const hintPill        = $('hint-pill');
const toastEl         = $('toast');
const resultDialog    = $('result-dialog');
const statsDialog     = $('stats-dialog');
const helpDialog      = $('help-dialog');
const triviaDialog    = $('trivia-dialog');
const triviaCountryLbl  = $('trivia-country-label');
const triviaQuestionEl  = $('trivia-question');
const triviaOptionsEl   = $('trivia-options');
const triviaContinueBtn = $('trivia-continue-btn');
const triviaFeedback    = $('trivia-feedback');
const triviaTimerBar    = $('trivia-timer-bar');
const triviaTimerText   = $('trivia-timer-text');
const canvas          = $('globe-canvas');
const ctx             = canvas.getContext('2d');

// ============================================================
// Globe geometry — all drawing happens in a fixed 420×420 logical
// space that is scaled to the canvas's real pixel size.
// ============================================================
const W            = 420;
const H            = 420;
const CX           = W / 2;
const CY           = H / 2;
const R_GLOBE_BASE = W * 0.46;  // radius at zoom 1x

function rGlobe() { return R_GLOBE_BASE * zoomScale; }

const toRad = d => d * Math.PI / 180;
const toDeg = r => r * 180 / Math.PI;

// Orthographic projection: full yaw (globeLon) + pitch (globeLat) rotation
function latLonToXY(lat, lon) {
  const phi  = toRad(lat);
  const lam  = toRad(lon - globeLon);
  const tilt = toRad(globeLat);

  const x =  Math.cos(phi) * Math.sin(lam);
  const y =  Math.sin(phi);
  const z =  Math.cos(phi) * Math.cos(lam);

  // Rotate around X-axis by tilt (pitch)
  const y2 =  y * Math.cos(tilt) + z * Math.sin(tilt);
  const z2 = -y * Math.sin(tilt) + z * Math.cos(tilt);

  if (z2 < 0) return null; // behind the globe

  const R = rGlobe();
  return {
    x: CX + view.mx * x * R,
    y: CY - y2 * R,
    z: z2,
  };
}

// ============================================================
// Haversine distance (km)
// ============================================================
function haversine(lat1, lon1, lat2, lon2) {
  const R    = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a    =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ============================================================
// Temperature / adjacency classification
// ============================================================
function classify(km, guessedName) {
  if (km === 0) return 'correct';
  // Check adjacency with the mystery country
  const neighbors = ADJACENCY[mystery.name] || [];
  if (neighbors.includes(guessedName)) return 'adjacent';
  if (km < THRESHOLDS.hot)  return 'hot';
  if (km < THRESHOLDS.warm) return 'warm';
  if (km < THRESHOLDS.cool) return 'cool';
  return 'cold';
}

const TEMP_LABEL = { hot: 'Very close', warm: 'Close', cool: 'Getting there', cold: 'Far away' };   // the first guess's trend line
const TEMP_ICON = { correct: '🟢', adjacent: '🔴', hot: '🔴', warm: '🟠', cool: '🟠', cold: '🔵' };

// Continuous colour from exact distance in km.
// Scale: dark red (0 km) → orange (mid) → blue (8 000+ km).
// Adjacent = dark red. Correct = green. Both handled by tempFill/tempStroke.
const HEAT_STOPS = [
  // [km, hue, saturation, lightness]
  [0,                  0,  85, 32],   // dark red  — closest
  [THRESHOLDS.hot,     8,  90, 42],   // red       — < 1 500 km
  [THRESHOLDS.warm,   28,  92, 52],   // orange    — < 4 000 km
  [THRESHOLDS.cool,   35,  80, 56],   // warm amber — at 8 000 km boundary
];
const COLD_NEAR = [215, 80, 58]; // blue — just past 8 000 km
const COLD_FAR  = [225, 68, 42]; // deep blue — antipode (~20 000 km)

function kmToHsl(km) {
  if (km >= THRESHOLDS.cool) {
    // 8 000 km → blue, deepening with distance
    const t = Math.min(1, (km - THRESHOLDS.cool) / 12000);
    return COLD_NEAR.map((v, i) => v + (COLD_FAR[i] - v) * t);
  }
  for (let i = 0; i < HEAT_STOPS.length - 1; i++) {
    const [k0, ...a] = HEAT_STOPS[i];
    const [k1, ...b] = HEAT_STOPS[i + 1];
    if (km <= k1) {
      const t = (Math.max(km, k0) - k0) / (k1 - k0);
      // Hue needs shortest-path interpolation (wrap around 360°)
      let dh = b[0] - a[0];
      if (dh > 180) dh -= 360;
      if (dh < -180) dh += 360;
      const h = ((a[0] + dh * t) % 360 + 360) % 360;
      return [h, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    }
  }
  return COLD_NEAR;
}

function kmToColor(km, alpha) {
  const [h, s, l] = kmToHsl(km);
  return `hsla(${h.toFixed(1)},${s.toFixed(0)}%,${l.toFixed(0)}%,${alpha})`;
}

function tempFill(temp, distKm) {
  const a = isLightTheme() ? 0.8 : 0.6;
  if (temp === 'correct')  return `rgba(34,197,94,${a})`;
  if (temp === 'adjacent') return `hsla(0,85%,32%,${a})`;   // dark red — same as "very close"
  return kmToColor(distKm ?? 0, a);
}
function tempStroke(temp, distKm) {
  if (temp === 'correct')  return '#22c55e';
  if (temp === 'adjacent') return 'hsl(0,85%,32%)';          // dark red
  return kmToColor(distKm ?? 0, 1);
}

// ============================================================
// Precomputed globe geometry
// ------------------------------------------------------------
// Every border vertex is converted ONCE to a 3-D unit vector
// (X, Y, Z) in a Float32Array. Each frame then only needs a few
// multiplications per point instead of 6+ trig calls, and whole
// countries on the far side of the globe are skipped entirely
// using a bounding-cap test.
// ============================================================

// Aliases to bridge COUNTRIES canonical names with BORDERS keys in borders.js
const BORDER_NAME_ALIASES = {
  'Antigua and Barbuda':     'Antigua and Barb.',
  'Bosnia and Herzegovina': 'Bosnia and Herz.',
  'Cape Verde':             'Cabo Verde',
  'Central African Republic':'Central African Rep.',
  'Czech Republic':          'Czechia',
  'DR Congo':                'Dem. Rep. Congo',
  'Dominican Republic':      'Dominican Rep.',
  'East Timor':              'Timor-Leste',
  'Equatorial Guinea':       'Eq. Guinea',
  'Eswatini':                'eSwatini',
  'Guinea Bissau':           'Guinea-Bissau',
  'Ivory Coast':             "Côte d'Ivoire",
  'Marshall Islands':        'Marshall Is.',
  'Saint Kitts and Nevis':   'St. Kitts and Nevis',
  'Saint Vincent and the Grenadines': 'St. Vin. and Gren.',
  'Sao Tome and Principe':   'São Tomé and Principe',
  'Solomon Islands':         'Solomon Is.',
  'South Sudan':             'S. Sudan',
};

function toUnitVectors(ring) {
  const out = new Float32Array(ring.length * 3);
  for (let i = 0; i < ring.length; i++) {
    const phi = toRad(ring[i][1]);
    const lam = toRad(ring[i][0]);
    const c   = Math.cos(phi);
    out[i * 3]     = c * Math.cos(lam);  // X
    out[i * 3 + 1] = c * Math.sin(lam);  // Y
    out[i * 3 + 2] = Math.sin(phi);      // Z
  }
  return out;
}

// name → { rings: Float32Array[], cx, cy, cz, minDot }
const GEO = new Map();
for (const [name, rings] of Object.entries(BORDERS)) {
  const vecRings = rings.map(toUnitVectors);
  // Bounding cap: normalised mean of all vertices + widest angular spread
  let sx = 0, sy = 0, sz = 0;
  for (const r of vecRings) for (let i = 0; i < r.length; i += 3) { sx += r[i]; sy += r[i + 1]; sz += r[i + 2]; }
  const len = Math.hypot(sx, sy, sz) || 1;
  const cx = sx / len, cy = sy / len, cz = sz / len;
  let minDot = 1;
  for (const r of vecRings) for (let i = 0; i < r.length; i += 3) {
    const d = r[i] * cx + r[i + 1] * cy + r[i + 2] * cz;
    if (d < minDot) minDot = d;
  }
  GEO.set(name, { rings: vecRings, cx, cy, cz, minDot });
}

// Graticule (lat/lon grid) as unit-vector polylines, also precomputed
const GRID_LINES = [];
for (let lat = -60; lat <= 60; lat += 30) {
  const pts = [];
  for (let lon = -180; lon <= 180; lon += 4) pts.push([lon, lat]);
  GRID_LINES.push(toUnitVectors(pts));
}
for (let lon = 0; lon < 360; lon += 30) {
  const pts = [];
  for (let lat = -90; lat <= 90; lat += 4) pts.push([lon, lat]);
  GRID_LINES.push(toUnitVectors(pts));
}

// Per-frame view: rotation terms computed once per draw
const view = { cg: 1, sg: 0, ct: 1, st: 0, R: 1, mx: 1 };
function updateView() {
  const g = toRad(globeLon), t = toRad(globeLat);
  view.cg = Math.cos(g); view.sg = Math.sin(g);
  view.ct = Math.cos(t); view.st = Math.sin(t);
  view.R  = rGlobe();
  view.mx = (gameMode === 'story' && Story.mirrored()) ? -1 : 1;
}

// Depth (z2) of a unit vector under the current view; >0 means facing us
function depthOf(X, Y, Z) {
  const z = X * view.cg + Y * view.sg;
  return -Z * view.st + z * view.ct;
}

// Can any part of this country be on the visible hemisphere?
function maybeVisible(geo) {
  const dc = depthOf(geo.cx, geo.cy, geo.cz);          // cos of angle to view centre
  if (geo.minDot <= 0) return true;                    // spans ≥ 90° — always test points
  // Visible iff angle(centre) - capRadius < 90°  ⇔  dc > -sin(capRadius)
  return dc > -Math.sqrt(1 - geo.minDot * geo.minDot);
}

// Append one ring to the current path (same visibility semantics as before:
// hidden vertices break the line, each ring is closed).
function traceRing(targetCtx, v) {
  const { cg, sg, ct, st, R } = view;
  let hasPoint = false, prevVisible = false;
  for (let i = 0; i < v.length; i += 3) {
    const X = v[i], Y = v[i + 1], Z = v[i + 2];
    const x  = Y * cg - X * sg;
    const z  = X * cg + Y * sg;
    const z2 = -Z * st + z * ct;
    if (z2 < 0) { prevVisible = false; continue; }
    const px = CX + view.mx * x * R;
    const py = CY - (Z * ct + z * st) * R;
    if (prevVisible && hasPoint) targetCtx.lineTo(px, py);
    else targetCtx.moveTo(px, py);
    hasPoint = prevVisible = true;
  }
  if (hasPoint) targetCtx.closePath();
  return hasPoint;
}

function traceOpenLine(targetCtx, v) {
  const { cg, sg, ct, st, R } = view;
  let first = true;
  for (let i = 0; i < v.length; i += 3) {
    const X = v[i], Y = v[i + 1], Z = v[i + 2];
    const x  = Y * cg - X * sg;
    const z  = X * cg + Y * sg;
    if (-Z * st + z * ct < 0) { first = true; continue; }
    const px = CX + view.mx * x * R, py = CY - (Z * ct + z * st) * R;
    first ? targetCtx.moveTo(px, py) : targetCtx.lineTo(px, py);
    first = false;
  }
}

function getCountryGeo(countryName) {
  return GEO.get(countryName) || GEO.get(BORDER_NAME_ALIASES[countryName]) || null;
}

// Kept for any external callers — returns the original [lon,lat] rings
function getCountryRings(countryName) {
  if (BORDERS[countryName]) return BORDERS[countryName];
  const alias = BORDER_NAME_ALIASES[countryName];
  if (alias && BORDERS[alias]) return BORDERS[alias];
  return null;
}

// ============================================================
// Draw a guessed country's polygons filled + outlined (one path)
// ============================================================
function drawCountryPolygons(countryName, temp, distKm) {
  const geo = getCountryGeo(countryName);
  if (!geo || !maybeVisible(geo)) return;

  ctx.beginPath();
  let any = false;
  for (const ring of geo.rings) any = traceRing(ctx, ring) || any;
  if (!any) return;
  ctx.fillStyle   = tempFill(temp, distKm);
  ctx.fill();
  ctx.strokeStyle = tempStroke(temp, distKm);
  ctx.lineWidth   = 1.5;
  ctx.stroke();
}

// Marker for guessed countries (guarantees visibility for all countries including small island nations)
function drawCountryMarker(country, temp, distKm) {
  const pt = latLonToXY(country.lat, country.lon);
  if (!pt) return; // behind the globe

  // Outer ring / halo
  ctx.beginPath();
  ctx.arc(pt.x, pt.y, 6.5, 0, Math.PI * 2);
  ctx.fillStyle   = tempFill(temp, distKm);
  ctx.fill();
  ctx.strokeStyle = tempStroke(temp, distKm);
  ctx.lineWidth   = 1.5;
  ctx.stroke();

  // Bright center core
  ctx.beginPath();
  ctx.arc(pt.x, pt.y, 2.5, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
}

// ============================================================
// End-of-game trail: the route the guesses took, flown in order.
// Each hop is a great-circle arc that lifts off the surface mid-flight,
// coloured like the guess it lands on, with a comet head the camera
// follows. Numbered stops mark each guess; rings pulse on the answer.
// ============================================================
let trail = null;   // { pts: [{ v, temp, dist, n, end }], start, segMs, reduce }

function toVec(lat, lon) {
  const p = toRad(lat), l = toRad(lon), c = Math.cos(p);
  return [c * Math.cos(l), c * Math.sin(l), Math.sin(p)];
}

// Starts the flight; returns how long it takes (ms)
function startTrail() {
  if (!guesses.length) return 0;
  const pts = guesses.map((g, i) => ({ v: toVec(g.country.lat, g.country.lon), temp: g.temp, dist: g.distKm, n: i + 1 }));
  if (revealed) pts.push({ v: toVec(revealed.lat, revealed.lon), temp: 'correct', dist: 0, n: 0, end: true });
  const hops = Math.max(0, pts.length - 1);
  const segMs = hops ? Math.max(260, Math.min(560, 4200 / hops)) : 0;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  trail = { pts, start: performance.now(), segMs, reduce };
  if (reduce || !hops) flyTo(revealed || mystery);
  dirty = true;
  return reduce ? 0 : segMs * hops;
}

function trailProgress() {   // hops flown so far (fractional)
  if (!trail) return 0;
  const hops = trail.pts.length - 1;
  if (trail.reduce || !hops) return hops;
  return Math.min(hops, (performance.now() - trail.start) / trail.segMs);
}

// Point along the great circle a→b at t, with a height that rises mid-hop
function arcPoint(a, b, t) {
  const d = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  const om = Math.acos(d);
  if (om < 1e-6) return [a[0], a[1], a[2], 1];
  const s = Math.sin(om), k1 = Math.sin((1 - t) * om) / s, k2 = Math.sin(t * om) / s;
  return [a[0] * k1 + b[0] * k2, a[1] * k1 + b[1] * k2, a[2] * k1 + b[2] * k2,
          1 + Math.min(0.08, om * 0.05) * Math.sin(Math.PI * t)];
}

// Screen position of a unit vector raised to height h; null when hidden
function projectVec(X, Y, Z, h = 1) {
  const { cg, sg, ct, st, R } = view;
  const x = Y * cg - X * sg, z = X * cg + Y * sg, z2 = -Z * st + z * ct;
  if (z2 < 0) return null;   // only the side facing us, so arcs never float outside the globe
  return { x: CX + view.mx * x * R * h, y: CY - (Z * ct + z * st) * R * h };
}

function drawTrail() {
  if (!trail) return;
  const { pts } = trail;
  const prog = trailProgress(), hops = pts.length - 1;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let i = 0; i < hops; i++) {
    const f = Math.max(0, Math.min(1, prog - i));
    if (f <= 0) break;
    const a = pts[i].v, b = pts[i + 1].v, steps = 48;
    const color = tempStroke(pts[i + 1].temp, pts[i + 1].dist);
    ctx.setLineDash(pts[i + 1].end ? [6, 7] : []);
    for (const [w, alpha] of [[7, 0.16], [2.4, 0.95]]) {   // glow, then the line
      ctx.beginPath();
      let pen = false;
      for (let s = 0; s <= steps * f; s++) {
        const q = arcPoint(a, b, s / steps), p = projectVec(q[0], q[1], q[2], q[3]);
        if (!p) { pen = false; continue; }
        pen ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y);
        pen = true;
      }
      ctx.strokeStyle = color; ctx.globalAlpha = alpha; ctx.lineWidth = w;
      ctx.stroke();
    }
  }
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  // Comet head
  if (prog < hops) {
    const i = Math.floor(prog), q = arcPoint(pts[i].v, pts[i + 1].v, prog - i), p = projectVec(q[0], q[1], q[2], q[3]);
    if (p) {
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 14);
      g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.35, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(p.x, p.y, 14, 0, Math.PI * 2); ctx.fill();
    }
  }

  // Numbered stops, as the flight reaches them
  ctx.font = '800 10px Outfit, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  pts.forEach((pt, i) => {
    if (pt.end || i > prog + 1e-3) return;
    const p = projectVec(pt.v[0], pt.v[1], pt.v[2]);
    if (!p) return;
    ctx.beginPath(); ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
    ctx.fillStyle = tempStroke(pt.temp, pt.dist); ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.fillText(String(pt.n), p.x, p.y + 0.5);
  });

  // Landed: rings pulse out from the answer for a few seconds
  if (prog >= hops) {
    const last = pts[hops], p = projectVec(last.v[0], last.v[1], last.v[2]);
    const t = (performance.now() - trail.start - (trail.reduce ? 0 : trail.segMs * hops)) / 1000;
    if (p && t < 4.5 && !trail.reduce) {
      for (let k = 0; k < 3; k++) {
        const ph = (t * 0.8 - k / 3) % 1;
        if (ph < 0) continue;
        ctx.beginPath(); ctx.arc(p.x, p.y, 8 + 34 * ph, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(34,197,94,${(1 - ph) * 0.85})`; ctx.lineWidth = 2.5 * (1 - ph) + 0.5; ctx.stroke();
      }
    }
  }
  ctx.restore();
}

// While the trail flies, keep the head in view; while it pulses, keep drawing
function aimAt(v) {
  targetGlobeLon = ((toDeg(Math.atan2(v[1], v[0])) % 360) + 360) % 360;
  targetGlobeLat = Math.max(-65, Math.min(65, -toDeg(Math.asin(Math.max(-1, Math.min(1, v[2]))))));
  lerpActive = true;
}
function trailAnimating() {
  if (!trail || trail.reduce) return false;
  const hops = trail.pts.length - 1, prog = trailProgress();
  const steer = trail.steer !== false;   // a drag hands the globe back to the player
  if (prog < hops) {
    if (steer) { const i = Math.floor(prog); aimAt(arcPoint(trail.pts[i].v, trail.pts[i + 1].v, prog - i)); }
    return true;
  }
  if (steer && !trail.landed) { trail.landed = true; aimAt(trail.pts[hops].v); }
  return performance.now() - trail.start - trail.segMs * hops < 4500;
}


// ============================================================
// Globe palette — neutral greys so the heat colours are the only
// colour on screen, and the globe reads clearly against the page.
// ============================================================
const GLOBE_PALETTE = {
  dark: {
    oceanIn: '#2a2c31', oceanOut: '#17181b',
    land: '#4b4f56', landStroke: '#62666e',
    grid: 'rgba(255,255,255,0.05)', rim: 'rgba(255,255,255,0.16)',
  },
  light: {
    oceanIn: '#e6e8eb', oceanOut: '#cfd3d8',
    land: '#fbfbfa', landStroke: '#a9aeb5',
    grid: 'rgba(0,0,0,0.05)', rim: 'rgba(0,0,0,0.14)',
  },
};

// ============================================================
// Draw all unguessed land, skipping the far side of the globe
// ============================================================
function drawAllLand(pal) {
  const skip = new Set();
  for (const g of guesses) skip.add(getCountryGeo(g.country.name));
  if (revealed) skip.add(getCountryGeo(revealed.name));
  if (gameMode === 'story') for (const geo of Story.hiddenGeos()) skip.add(geo);

  ctx.fillStyle   = pal.land;
  ctx.strokeStyle = pal.landStroke;
  ctx.lineWidth   = 0.6;
  for (const geo of GEO.values()) {
    if (skip.has(geo) || !maybeVisible(geo)) continue;
    ctx.beginPath();
    let any = false;
    for (const ring of geo.rings) any = traceRing(ctx, ring) || any;
    if (any) { ctx.fill(); ctx.stroke(); }
  }
}

// Gradients only depend on radius + theme, so build them once per change
let _gradKey = '', _oceanGrad = null, _shineGrad = null;
function getGradients(R, isLight, pal) {
  const key = `${R.toFixed(2)}|${isLight}`;
  if (key !== _gradKey) {
    _gradKey = key;
    _oceanGrad = ctx.createRadialGradient(CX - R * 0.3, CY - R * 0.3, R * 0.05, CX, CY, R);
    _oceanGrad.addColorStop(0, pal.oceanIn);
    _oceanGrad.addColorStop(1, pal.oceanOut);
    _shineGrad = ctx.createRadialGradient(CX - R * 0.3, CY - R * 0.35, 0, CX, CY, R);
    _shineGrad.addColorStop(0,   'rgba(255,255,255,0.08)');
    _shineGrad.addColorStop(0.4, 'rgba(255,255,255,0.02)');
    _shineGrad.addColorStop(1,   'rgba(0,0,0,0)');
  }
  return { ocean: _oceanGrad, shine: _shineGrad };
}

// ============================================================
// Main globe draw
// ============================================================
function drawGlobe() {
  const scale = canvas.width / W;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, W, H);
  updateView();

  const R       = view.R;
  const isLight = isLightTheme();
  const pal     = isLight ? GLOBE_PALETTE.light : GLOBE_PALETTE.dark;
  const { ocean, shine } = getGradients(R, isLight, pal);

  // Ocean
  ctx.beginPath();
  ctx.arc(CX, CY, R, 0, Math.PI * 2);
  ctx.fillStyle = ocean;
  ctx.fill();

  // Clip to the globe circle (only needed when zoomed past the canvas edge)
  const needsClip = R > W / 2;
  if (needsClip) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(CX, CY, R, 0, Math.PI * 2);
    ctx.clip();
  }

  // Grid lines
  ctx.beginPath();
  for (const line of GRID_LINES) traceOpenLine(ctx, line);
  ctx.strokeStyle = pal.grid;
  ctx.lineWidth   = 0.7;
  ctx.stroke();

  drawAllLand(pal);
  // The World-saved % only actually changes at the moment drawUnder()'s
  // per-frame cleanup removes a fully-restored entry — which can land on a
  // frame where isAnimating() has *just* gone false (the two conditions
  // sit on the same threshold), so gating the HUD refresh on isAnimating()
  // leaves it one frame stale. Refreshing on every redraw instead means
  // it's never wrong, at the cost of a few redundant re-renders.
  if (gameMode === 'story') { Story.drawUnder(ctx, pal); Story.renderHud(); }

  // Guessed countries, back-to-front
  for (const g of getSortedGuesses()) drawCountryPolygons(g.country.name, g.temp, g.distKm);
  if (revealed) drawCountryPolygons(revealed.name, 'correct', 0);

  // Markers keep microstates and islands visible
  for (const g of guesses) drawCountryMarker(g.country, g.temp, g.distKm);
  if (revealed) drawCountryMarker(revealed, 'correct', 0);
  drawTrail();
  if (Spyglass.labelsOn()) drawCountryLabels(isLight);
  if (typeof PinDrop !== 'undefined') PinDrop.draw(ctx);

  if (gameMode === 'story') Story.drawOver(ctx);
  Story.drawScar(ctx);   // every mode: no-op unless the player kept Needle

  // Shine
  ctx.beginPath();
  ctx.arc(CX, CY, R, 0, Math.PI * 2);
  ctx.fillStyle = shine;
  ctx.fill();

  if (needsClip) ctx.restore();

  // Rim
  ctx.beginPath();
  ctx.arc(CX, CY, R, 0, Math.PI * 2);
  ctx.strokeStyle = pal.rim;
  ctx.lineWidth   = 1.2;
  ctx.stroke();
}

// ============================================================
// Country names (Atlas, and a Daily after a 🔭 spyglass — spyglass.js)
// Biggest countries (by land area) claim their spot first; a name that would
// overlap one already drawn tries just above or below its point, else it's
// skipped, so zooming in reveals more of them.
// ============================================================
let _labels = null;
const _labelWidth = new Map();
function drawCountryLabels(isLight) {
  if (!_labels) {
    // Rough land area from the border rings (degrees², shrunk by latitude): only used to rank
    const area = name => {
      let a = 0;
      for (const ring of getCountryRings(name) || []) {
        let sum = 0;
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
          const k = Math.cos(toRad((ring[i][1] + ring[j][1]) / 2));
          sum += (ring[j][0] * k) * ring[i][1] - (ring[i][0] * k) * ring[j][1];
        }
        a += Math.abs(sum) / 2;
      }
      return a;
    };
    _labels = COUNTRIES.map(c => ({ name: c.name, v: toVec(c.lat, c.lon), size: area(c.name) }))
      .sort((a, b) => b.size - a.size);
  }
  const placed = [];
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  for (const L of _labels) {
    const s = projectVec(L.v[0], L.v[1], L.v[2]);
    if (!s || s.x < 0 || s.x > W || s.y < 0 || s.y > H) continue;
    const tiny = L.size < 2;                           // islands and microstates (under ~25,000 km²): a dot, name above it
    const fs = L.size > 150 ? 12 : L.size > 25 ? 11 : 10;
    const font = `700 ${fs}px Outfit, system-ui, sans-serif`;
    ctx.font = font;
    const key = font + L.name;
    let w = _labelWidth.get(key);
    if (w == null) { w = ctx.measureText(L.name).width; _labelWidth.set(key, w); }
    // Only names that fit inside the visible circle: the globe, or the round canvas once zoomed past it
    const r2 = (Math.min(view.R, W / 2) - 2) ** 2;
    const fits = box => ![[box[0], box[1]], [box[2], box[1]], [box[0], box[3]], [box[2], box[3]]].some(([x, yy]) => (x - CX) ** 2 + (yy - CY) ** 2 > r2)
      && !placed.some(b => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1]);
    const spots = tiny ? [s.y - fs * 0.9, s.y + fs * 0.9] : [s.y, s.y + fs + 1, s.y - fs - 1];
    let y = null, box = null;
    for (const cy of spots) {
      const b = [s.x - w / 2 - 2, cy - fs / 2 - 1, s.x + w / 2 + 2, cy + fs / 2 + 1];
      if (fits(b)) { y = cy; box = b; break; }
    }
    if (box == null) continue;
    placed.push(box);
    if (tiny) {
      ctx.beginPath(); ctx.arc(s.x, s.y, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = isLight ? '#1f2328' : '#f1f1f4'; ctx.fill();
    }
    ctx.lineWidth = 3;
    ctx.strokeStyle = isLight ? 'rgba(255,255,255,0.92)' : 'rgba(0,0,0,0.78)';
    ctx.strokeText(L.name, s.x, y);
    ctx.fillStyle = isLight ? '#1f2328' : '#f1f1f4';
    ctx.fillText(L.name, s.x, y);
  }
  ctx.restore();
}

// ============================================================
// Animation loop — only redraws when dirty
// ============================================================
function animate() {
  if (lerpActive) {
    let diffLon = targetGlobeLon - globeLon;
    while (diffLon > 180)  diffLon -= 360;
    while (diffLon < -180) diffLon += 360;
    const diffLat = targetGlobeLat - globeLat;
    const doneLon = Math.abs(diffLon) < 0.15;
    const doneLat = Math.abs(diffLat) < 0.15;

    globeLon = doneLon ? targetGlobeLon : (((globeLon + diffLon * 0.08) % 360) + 360) % 360;
    globeLat = doneLat ? targetGlobeLat : globeLat + diffLat * 0.08;
    if (doneLon && doneLat) lerpActive = false;
    dirty = true;
  }

  if (gameMode === 'story' && Story.isAnimating()) dirty = true;
  if (trailAnimating()) dirty = true;
  if (typeof PinDrop !== 'undefined' && PinDrop._anim) dirty = true;

  if (dirty) {
    drawGlobe();
    dirty = false;
  }
  requestAnimationFrame(animate);
}

// Smoothly turn the globe so a country faces the player
function flyTo(country) {
  lerpActive     = true;
  targetGlobeLon = ((country.lon % 360) + 360) % 360;
  targetGlobeLat = Math.max(-65, Math.min(65, -country.lat));
}

function setZoom(z) {
  zoomScale = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
  const zi = document.getElementById('zoom-in'), zo = document.getElementById('zoom-out');
  if (zi) { zi.disabled = zoomScale >= ZOOM_MAX; zo.disabled = zoomScale <= ZOOM_MIN; }
  dirty = true;
}

// ============================================================
// Globe input — mouse, touch, wheel, keyboard
// ============================================================
// A tap (short, barely moved) rather than a drag: Pin Drop places its pin with it
let _downT = 0, _pinched = false;
function isTap(x, y) { return !_pinched && Math.hypot(x - dragStartX, y - dragStartY) < 8 && performance.now() - _downT < 500; }
function pinTap(x, y) { if (typeof PinDrop !== 'undefined' && PinDrop.active && isTap(x, y)) PinDrop.tap(x, y); }

function beginDrag(x, y) {
  _downT       = performance.now();
  dragging     = true;
  lerpActive   = false;
  if (trail) trail.steer = false;
  dragStartX   = x;
  dragStartY   = y;
  dragStartLon = globeLon;
  dragStartLat = globeLat;
}

function moveDrag(x, y) {
  // Drag speed scales down when zoomed in so the land follows the finger
  const k = 0.35 / zoomScale;
  globeLon = dragStartLon - (x - dragStartX) * k * view.mx;
  globeLat = Math.max(-85, Math.min(85, dragStartLat - (y - dragStartY) * k));
  dirty = true;
}

canvas.addEventListener('mousedown', e => {
  beginDrag(e.clientX, e.clientY);
  canvas.style.cursor = 'grabbing';
});
window.addEventListener('mousemove', e => { if (dragging) moveDrag(e.clientX, e.clientY); });
window.addEventListener('mouseup', e => {
  if (dragging) pinTap(e.clientX, e.clientY);
  dragging = false;
  canvas.style.cursor = '';
});

canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const delta = e.deltaMode === 1 ? e.deltaY * 32 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
  setZoom(zoomScale * (1 - Math.sign(delta) * ZOOM_STEP));
}, { passive: false });

let lastTouchDist = null;

canvas.addEventListener('touchstart', e => {
  e.preventDefault(); // stop page scroll starting on the globe
  lerpActive = false;
  if (e.touches.length === 1) {
    _pinched = false;
    beginDrag(e.touches[0].clientX, e.touches[0].clientY);
    lastTouchDist = null;
  } else if (e.touches.length === 2) {
    _pinched = true;
    dragging = false;
    lastTouchDist = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY);
  }
}, { passive: false });

canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  if (e.touches.length === 1 && dragging) {
    moveDrag(e.touches[0].clientX, e.touches[0].clientY);
  } else if (e.touches.length === 2 && lastTouchDist !== null) {
    const dist = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY);
    setZoom(zoomScale * (dist / lastTouchDist));
    lastTouchDist = dist;
  }
}, { passive: false });

canvas.addEventListener('touchend', e => {
  if (e.touches.length === 0) {
    if (dragging && e.changedTouches[0]) pinTap(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
    dragging = false; lastTouchDist = null;
  }
  else if (e.touches.length === 1) {
    // Pinch → one finger: continue as a drag from here
    lastTouchDist = null;
    beginDrag(e.touches[0].clientX, e.touches[0].clientY);
  }
});

canvas.addEventListener('keydown', e => {
  const step = 10 / zoomScale;
  const keys = {
    ArrowLeft:  () => { globeLon -= step; },
    ArrowRight: () => { globeLon += step; },
    ArrowUp:    () => { globeLat = Math.min(85, globeLat + step); },
    ArrowDown:  () => { globeLat = Math.max(-85, globeLat - step); },
    '+':        () => setZoom(zoomScale * 1.2),
    '=':        () => setZoom(zoomScale * 1.2),
    '-':        () => setZoom(zoomScale / 1.2),
  };
  if (!keys[e.key]) return;
  e.preventDefault();
  lerpActive = false;
  keys[e.key]();
  dirty = true;
});

// ============================================================
// Layout — the app is pinned to the *visual* viewport, so the
// input bar always sits directly above the on-screen keyboard.
// The globe is sized once from the full height and does not
// shrink when the keyboard opens.
// ============================================================
let globeSized = false;

function isTyping() {
  const a = document.activeElement;
  return !!a && a.tagName === 'INPUT';
}

function layout() {
  const vv = window.visualViewport;
  const h  = vv ? vv.height : window.innerHeight;
  root.style.setProperty('--app-h', `${h}px`);
  appEl.style.transform = vv && vv.offsetTop ? `translateY(${vv.offsetTop}px)` : '';

  if (!globeSized || !isTyping()) {
    const w    = Math.min(appEl.clientWidth - 32, 460);
    const size = Math.round(Math.max(180, Math.min(w, h * 0.44)));
    root.style.setProperty('--globe-size', `${size}px`);
    globeSized = true;
    sizeCanvas(size);
  }
}

// Back the canvas with real device pixels so the globe stays crisp
function sizeCanvas(cssSize) {
  const px = Math.round(cssSize * Math.min(window.devicePixelRatio || 1, 3));
  if (canvas.width !== px) {
    canvas.width = canvas.height = px;
    _gradKey = ''; // gradients belong to the old context state
    dirty = true;
  }
}

if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', layout);
  window.visualViewport.addEventListener('scroll', layout);
}
window.addEventListener('resize', layout);
window.addEventListener('orientationchange', () => { globeSized = false; setTimeout(layout, 200); });

// ============================================================
// Toast
// ============================================================
let _toastTimer = null;
function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.hidden = false;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { toastEl.hidden = true; }, 2200);
}

// ============================================================
// Screens
// ============================================================
const MODE_LABEL = { daily: t('Daily'), classic: t('Classic'), endless: 'Endless', atlas: t('🗺️ Atlas') };

function showScreen(name) {
  Tips.hide();
  if (_atlasSince != null && name !== 'game') {
    track('atlas_close', { seconds: Math.round((performance.now() - _atlasSince) / 1000), zoom: Math.round(zoomScale * 10) / 10 });
    _atlasSince = null;
  }
  homeScreen.hidden = name !== 'home';
  gameScreen.hidden = name !== 'game';
  hubScreen.hidden  = name !== 'hub';
  backBtn.hidden    = name !== 'game' && name !== 'hub';
  $('atlas-btn').hidden = name !== 'home' || !settledPlayer();   // the game's top bar has no room for it
  if (name === 'home') renderHome();
  else if (name === 'game') { layout(); Spyglass.renderButton(); }
}

// Cached across calls — a count fetch shouldn't block rendering, and the
// same number is reused on the home link and the Daily result button.
let _dailyPlayerCount = null;

function playerCountSuffix() {
  return _dailyPlayerCount ? t(' · 🏆 {n} today', { n: _dailyPlayerCount.toLocaleString() }) : '';
}

// Picks up wherever the cached count landed since the last render
function applyDailyCountTeaser() {
  if ($('daily-desc').dataset.base) $('daily-desc').textContent = $('daily-desc').dataset.base + playerCountSuffix();
}

// A new player sees the core game only: the Daily and Classic. Story, Rooms, the Signal, the
// Atlas and Classic's weekly board show up once they've played on 3 different days (or 15 games).
// Players who arrived on a room invite still get Rooms (rooms.js checks its own list).
function settledPlayer() {
  const games = loadStore().games;
  return games.length >= 15 || new Set(games.map(g => g.day)).size >= 3;
}

// Yesterday's champion under the Daily card: who scored most, and a dare to beat them.
// Asked once per UTC day; hidden offline or when nobody played.
let _champ = null, _champDay = null;
function renderChamp() {
  const card = $('champ-card');
  if (cloudStatus === 'ready' && _champDay !== utcDay()) {
    _champDay = utcDay();
    fetchYesterdayBest().then(c => { _champ = c && c.name ? c : null; renderChamp(); })
                        .catch(() => { _champDay = null; });
  }
  const c = _champ;
  card.hidden = !c;
  if (!c) return;
  const name = c.name, pts = Number(c.score).toLocaleString();
  $('champ-k').textContent = c.players > 1 ? t('Yesterday’s best · {n} played', { n: Number(c.players).toLocaleString() })
                                           : t('Yesterday’s champion');
  $('champ-name').innerHTML = `${escHtml(name)} <span class="champ-pts">${escHtml(t('{n} pts', { n: pts }))}</span>`;
  const how = c.won ? t(c.guesses === 1 ? 'Found it in 1 guess.' : 'Found it in {n} guesses.', { n: c.guesses }) : '';
  const done = getDailyResult();
  const dare = !done           ? t('Can you beat {name} today?', { name })
             : done.score > c.score ? t('You beat yesterday’s best today!')
             :                  t('{name}’s {pts} is still the mark to beat.', { name, pts });
  $('champ-line').textContent = how ? `${how} ${dare}` : dare;
  card.setAttribute('aria-label', t('Yesterday’s champion: {name}, {pts} points. See yesterday’s leaderboard', { name, pts }));
}
$('champ-card').addEventListener('click', () => { track('champ_tap', {}); openLeaderboard('yesterday'); });

function renderHome() {
  const done   = getDailyResult();
  const streak = currentDailyStreak();
  const resetAt = nextDailyAt().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  const dailyDesc = $('daily-desc');
  const dailyCur  = loadCurrentGame('daily');
  const base = done ? `${done.won ? t('Found in {n}', { n: done.guessCount }) : t('Not found')} · ${t('next in {time}', { time: formatCountdown(nextDailyAt() - Date.now()) })}`
             : dailyCur ? t('In progress · {n}/{max} guesses', { n: dailyCur.guesses.length, max: MAX_GUESSES })
             : t('Same country for everyone · new one at {time}', { time: resetAt });
  dailyDesc.dataset.base = base;   // not done yet — see is a teaser worth showing, below
  dailyDesc.textContent  = base + (dailyCur || done ? '' : playerCountSuffix()); // only pre-game, so it reads as an invite, not a spoiler
  $('home-lb-btn').textContent = t('Leaderboard');
  if (cloudStatus === 'ready') {
    fetchDailyPlayerCount().then(n => {
      if (n == null) return;
      _dailyPlayerCount = n;
      if (!homeScreen.hidden && !dailyCur && !done) applyDailyCountTeaser();
    }).catch(() => {});
  }
  renderChamp();
  renderBanner();
  $('daily-title').textContent = t('Daily #{n}', { n: dailyNumber() });
  $('daily-card').classList.toggle('done', !!done);

  const streakEl = $('daily-streak');
  streakEl.hidden = streak === 0;
  streakEl.textContent = `🔥 ${streak}`;
  streakEl.title = t('{n}-day streak', { n: streak });

  const cur = loadCurrentGame('classic');
  $('classic-desc').textContent = cur
    ? t(cur.guesses.length === 1 ? 'In progress · {n} guess' : 'In progress · {n} guesses', { n: cur.guesses.length })
    : t('Random countries · weekly leaderboard');

  Spyglass.renderHomeBadge();
  Story.renderHomeCard();
  Rooms.renderHomeCard();
  if (typeof Signal !== 'undefined') Signal.renderHomeCard();
  Rooms.refresh();
}

document.querySelectorAll('.mode-card[data-mode]').forEach(btn => {   // not the champion card: that opens yesterday's board
  btn.addEventListener('click', () => chooseMode(btn.dataset.mode));
});

// Only when we can actually check/save one — never blocks offline play
function needsUsernameForDaily() {
  return cloudStatus === 'ready' && !cloudUsername;
}

function chooseMode(mode) {
  if (mode === 'story') { Story.open(); return; }
  if (mode === 'rooms') { Rooms.open(); return; }
  if (mode === 'signal') { Signal.open(); return; }
  if (mode === 'daily') {
    const done = getDailyResult();
    if (done) { openResult(resultFromRecord(done)); return; }
    // A name is required for the Daily: it's what puts a player on the
    // leaderboard and in room leagues. "Not now" goes back home. (A brand-new
    // player's very first Daily is the exception: the first visit drops them
    // straight in, and they're asked right after that game.)
    if (needsUsernameForDaily()) {
      track('daily_username_prompt_shown');
      openUsername(() => chooseMode('daily'), {
        forced: true, reason: 'daily', skipLabel: 'Not now',
        onSkip: () => track('daily_username_prompt_skipped'),
      });
      return;
    }
  }
  startGame(mode, loadCurrentGame(mode));
}

$('gk-home').addEventListener('click', () => {
  track('gk_home_click');
  flushEvents().catch(() => {});   // the page is about to unload
});

backBtn.addEventListener('click', () => {
  if (!hubScreen.hidden) { showScreen('home'); return; }
  if (gameMode === 'challenge') { Challenge.onLeaveRound(); return; }
  if (gameMode === 'pin') { if (PinDrop.opts && PinDrop.opts.onBack) PinDrop.opts.onBack(); return; }
  trackAbandon('back_button');
  if (gameMode === 'story') Story.onLeave();
  if (gameMode === 'night') { Rooms.backToNight(); return; }   // still in the night; Leave is on its board
  showScreen('home');
});
$('zoom-in').addEventListener('click',  () => setZoom(zoomScale * 1.6));
$('zoom-out').addEventListener('click', () => setZoom(zoomScale / 1.6));

// ============================================================
// Game lifecycle
// ============================================================
// Classic: next card from the player's shuffled deck,
// never today's Daily answer (that would spoil it)
function pickRandomMystery() {
  const daily = COUNTRIES[dailyIndex()].name;
  const name  = dealCountry(new Set([daily]));
  return COUNTRIES.find(c => c.name === name);
}

// The state-reset + DOM-reset a fresh round always needs, regardless of
// mode — shared by startGame() and story.js's startStoryRound(). Reads the
// mode/day the caller has already set on the globals (gameMode, gameDay).
function resetRound() {
  guesses                  = [];
  revealed                 = null;
  trail                    = null;
  prevDistKm               = null;
  gameOver                 = false;
  flagHint                 = false;
  lastResult               = null;
  triviaState.correctCount = 0;
  triviaState.cluesShown   = 0;
  _sortCacheSize           = -1;
  _abandonLogged            = false;
  triviaAskedAt            = 0;
  starterEl.hidden         = true;
  triviaOfferBtn.hidden    = true;

  historyEl.innerHTML    = '';
  historyEmpty.hidden    = false;
  hintPill.hidden        = true;
  trendEl.hidden         = true;
  guessForm.hidden       = false;
  gameoverActions.hidden = true;
  inputEl.value          = '';
  inputEl.disabled       = false;
  acListEl.innerHTML     = '';
  acIndex                = -1;
  Coach.hide();
  $('pin-panel').hidden   = true;
  $('pin-actions').hidden = true;
  $('atlas-panel').hidden = true;
  guessChip.hidden        = false;
  gameScreen.classList.toggle('atlas', gameMode === 'atlas');
  $('history-list').hidden = false;
  if (typeof PinDrop !== 'undefined' && gameMode !== 'pin') PinDrop.stop();
  modeChip.textContent   = gameMode === 'daily' ? t('Daily #{n}', { n: dailyNumber(gameDay) }) : MODE_LABEL[gameMode];
  setZoom(1);
}

function startGame(mode, saved = null) {
  clearTimeout(_toastTimer); toastEl.hidden = true;   // a copied-to-clipboard toast should not carry into a new game
  gameMode = mode;
  gameDay  = mode === 'daily' ? utcDay() : null;

  mystery = saved ? COUNTRIES.find(c => c.name === saved.mystery)
          : mode === 'daily' ? COUNTRIES[dailyIndex(gameDay)]
          : pickRandomMystery();
  if (!mystery) { clearCurrentGame(mode); return startGame(mode); }

  resetRound();

  showScreen('game');
  track('game_start', { mode, resumed: !!saved });

  if (saved) {
    for (const name of saved.guesses) {
      const c = findCountry(name);
      if (c && !gameOver) applyGuess(c, true);
    }
    triviaState.correctCount = saved.triviaCorrect || 0;
    triviaState.cluesShown   = saved.clues || 0;
    renderHints();
  } else {
    persistCurrent();
  }
  updateHud();
  dirty = true;
  Coach.onStart();
  renderStarter();
  renderTriviaOffer();
  Spyglass.renderButton();
  // Returning players hear about the spyglass when a Daily opens; new ones after their 2nd guess
  if (mode === 'daily' && !Coach.active() && !gameOver) setTimeout(() => { if (gameMode === 'daily' && !Tips.cur) Tips.spyglass(); }, 700);

  // Opening the keyboard unasked is annoying on phones; fine on desktop
  if (window.matchMedia('(pointer: fine)').matches && !gameOver) inputEl.focus();
}

// Story mode's equivalent of startGame() — no Daily/random-mystery logic,
// no guess limit, never persists to the shared games list. `country` is the
// chapter's mystery; `savedNames` (if resuming) is the guess list to replay.
function startStoryRound(country, savedNames = null) {
  gameMode = 'story';
  gameDay  = null;
  mystery  = country;
  resetRound();
  modeChip.textContent = Story.chipLabel();

  showScreen('game');

  if (savedNames && savedNames.length) {
    for (const name of savedNames) {
      const c = findCountry(name);
      if (c && !gameOver) applyGuess(c, true);
    }
  } else {
    persistCurrent();
  }
  updateHud();
  dirty = true;

  if (window.matchMedia('(pointer: fine)').matches && !gameOver) inputEl.focus();
}

// A game-night round: the server's country, unlimited guesses against the clock
function startNightRound(country, savedNames = null) {
  gameMode = 'night';
  gameDay  = null;
  mystery  = country;
  resetRound();
  modeChip.textContent = Rooms.chipLabel();
  showScreen('game');
  for (const name of savedNames || []) {
    const c = findCountry(name);
    if (c && !gameOver) applyGuess(c, true);
  }
  updateHud();
  dirty = true;
  if (window.matchMedia('(pointer: fine)').matches && !gameOver) inputEl.focus();
}

// Pin Drop (pin.js): the globe with a pin instead of the guess list and input.
// Used by THE SIGNAL; built to serve a daily city mode later too.
function startPinMode(chip) {
  gameMode = 'pin';
  gameDay  = null;
  mystery  = null;
  resetRound();
  gameOver = true;               // nothing to abandon or persist
  guessForm.hidden       = true;
  historyEmpty.hidden    = true;
  $('history-list').hidden = true;
  $('pin-panel').hidden   = false;
  $('pin-actions').hidden = false;
  modeChip.textContent   = chip;
  showScreen('game');
}

// A finished game shown again on the globe (its result reopened from home): the
// guesses replayed as they were, the trail flown, nothing playable or recorded
function replayFinished(r) {
  const answer = COUNTRIES.find(c => c.name === r.mysteryName);
  if (!answer) return;
  gameMode = r.mode;
  gameDay  = r.mode === 'daily' ? r.day : null;
  mystery  = answer;
  resetRound();
  showScreen('game');
  for (const name of r.guesses) {
    const c = findCountry(name);
    if (c && !gameOver) applyGuess(c, true);
  }
  if (!gameOver) {                       // a record cut short: show it as finished anyway
    gameOver = true;
    revealed = r.won ? null : mystery;
    guessForm.hidden = true;
    gameoverActions.hidden = false;
  }
  lastResult = r;
  Coach.hide();
  updateHud();
  Spyglass.renderButton();
  startTrail();
  dirty = true;
  track('result_globe_replay', { mode: r.mode });
}

let _atlasSince = null;   // when the Atlas opened, for atlas_close's time spent
// Atlas: the globe with every country named, to explore — no mystery, no input
function startAtlas() {
  gameMode = 'atlas';
  gameDay  = null;
  mystery  = null;
  resetRound();
  gameOver = true;               // nothing to abandon or persist
  guessForm.hidden       = true;
  historyEmpty.hidden    = true;
  $('history-list').hidden = true;
  $('atlas-panel').hidden  = false;
  guessChip.hidden         = true;
  showScreen('game');
  setZoom(1.3);
  _atlasSince = performance.now();
  track('atlas_open');
}

// A room-challenge round: the server's country, 10 guesses (or 60 s in speed mode), no trivia
function startChallengeRound(country, savedNames = null) {
  gameMode = 'challenge';
  gameDay  = null;
  mystery  = country;
  resetRound();
  modeChip.textContent = Challenge.chipLabel();
  showScreen('game');
  for (const name of savedNames || []) {
    const c = findCountry(name);
    if (c && !gameOver) applyGuess(c, true);
  }
  updateHud();
  dirty = true;
  if (window.matchMedia('(pointer: fine)').matches && !gameOver) inputEl.focus();
}

function persistCurrent() {
  if (gameMode === 'story') { Story.persist(); return; }
  if (gameMode === 'night') { Rooms.persist(); return; }
  if (gameMode === 'challenge') { Challenge.persist(); return; }
  if (gameOver) return;
  saveCurrentGame({
    mode:          gameMode,
    day:           gameDay,
    mystery:       mystery.name,
    guesses:       guesses.map(g => g.country.name),
    triviaCorrect: triviaState.correctCount,
    clues:         triviaState.cluesShown,
    flagHint,
  });
}

// Fires once per unfinished game — tells us where in Classic/Daily players
// give up, which "finished" games alone can't show. The game stays resumable
// (persistCurrent already saved it); this only logs that they left it.
function trackAbandon(trigger) {
  if (gameOver || _abandonLogged || !mystery) return;
  _abandonLogged = true;
  track('game_abandoned', { mode: gameMode, guesses: guesses.length, trigger });
  flushEvents().catch(() => {});   // don't wait for the next periodic flush — the tab may be closing
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden && !gameScreen.hidden) trackAbandon('tab_hidden');
});
window.addEventListener('pagehide', () => {
  if (!gameScreen.hidden) trackAbandon('tab_hidden');
});

function guessLimit() {
  if (gameMode === 'story' || gameMode === 'night') return Infinity;
  if (gameMode === 'challenge') return Challenge.limit();
  return gameMode === 'daily' ? MAX_GUESSES : Infinity;   // Classic is unlimited practice
}

function updateHud() {
  if (gameMode === 'story') { Story.renderHud(); historyEmpty.hidden = guesses.length > 0; return; }
  if (gameMode === 'night') { Rooms.renderHud(); historyEmpty.hidden = guesses.length > 0; return; }
  if (gameMode === 'challenge') { Challenge.renderHud(); historyEmpty.hidden = guesses.length > 0; return; }
  if (gameMode === 'pin' || gameMode === 'atlas') return;
  const limit = guessLimit();
  guessChip.textContent = limit === Infinity
    ? t(guesses.length === 1 ? '{n} guess' : '{n} guesses', { n: guesses.length })
    : `${guesses.length} / ${limit}`;
  historyEmpty.hidden = guesses.length > 0;
}

// ============================================================
// Guessing
// ============================================================
guessForm.addEventListener('submit', e => {
  e.preventDefault();
  submitGuess();
});

function submitGuess(tapped = null) {
  if (gameOver || inputEl.disabled) return;
  const country = tapped || findCountry(inputEl.value);
  if (!country) { shake(inputEl); showToast(t('Pick a country from the list')); return; }
  if (guesses.some(g => g.country.name === country.name)) {
    shake(inputEl);
    showToast(t('Already guessed {name}', { name: cname(country.name) }));
    return;
  }

  inputEl.value      = '';
  acListEl.innerHTML = '';
  acIndex            = -1;
  if (!window.matchMedia('(pointer: fine)').matches) inputEl.blur(); // let the list show on phones

  applyGuess(country, false);

  if (!gameOver) {
    persistCurrent();
    if (gameMode === 'story') { if (guesses.length % 3 === 0) showTrivia(country); }   // part of the story's rules
    else renderTriviaOffer();
  }
}

function applyGuess(country, restoring) {
  const distKm  = haversine(mystery.lat, mystery.lon, country.lat, country.lon);
  const correct = country.name === mystery.name;
  const temp    = classify(Math.round(distKm), country.name);

  // Warmer / colder (skipped for adjacent/correct — those speak for themselves). The first guess
  // has nothing to compare with, so it says how far off it is. In the Daily and Classic it also
  // says which way to head, so even a far-off guess feels like progress.
  if (!restoring && !correct && temp !== 'adjacent') {
    const first  = prevDistKm === null;
    const warmer = !first && distKm < prevDistKm;
    const bearing = gameMode === 'daily' ? compassBearing(country.lat, country.lon, mystery.lat, mystery.lon) : null;
    const label = first ? t(TEMP_LABEL[temp]) : warmer ? t('Warmer') : t('Colder');
    trendEl.textContent = bearing ? `${label} · ${ARROWS[bearing]} ${t('head {dir}', { dir: bearingWord(bearing) })}` : label;
    trendEl.className   = `trend ${first ? temp : warmer ? 'warmer' : 'colder'}`;
    trendEl.hidden      = first && !bearing;
  } else {
    trendEl.hidden = true;
  }
  prevDistKm = (correct || temp === 'adjacent') ? null : distKm;

  guesses.push({ country, distKm, temp, correct });
  _sortCacheSize = -1;
  flyTo(country);
  _restoringGuesses = restoring;
  addHistoryItem(guesses[guesses.length - 1], guesses.length);
  _restoringGuesses = false;
  updateHud();
  dirty = true;
  if (gameMode === 'story') Story.onGuess(guesses[guesses.length - 1], restoring);
  else if (!restoring) Coach.onGuess(guesses[guesses.length - 1]);

  // Re-read: a story modifier (ch 2's jump) can re-score this guess in onGuess
  if (guesses[guesses.length - 1].correct) endGame(true, restoring);
  else if (guesses.length >= guessLimit()) endGame(false, restoring);
}

// ============================================================
// Guess list
// ============================================================
const ARROWS = { N: '↑', NE: '↗', E: '→', SE: '↘', S: '↓', SW: '↙', W: '←', NW: '↖' };

function addHistoryItem({ country, distKm, temp, correct }, n) {
  const li = document.createElement('li');
  li.className = `guess-item ${temp}`;
  li.style.setProperty('--c', tempStroke(temp, distKm));

  const num = document.createElement('span');
  num.className = 'gi-num';
  num.textContent = n;

  const flag = document.createElement('span');
  flag.className = 'gi-flag';
  flag.append(makeFlagImg(country, 20));

  const name = document.createElement('span');
  name.className = 'gi-name';
  name.textContent = cname(country.name);

  const dist = document.createElement('span');
  dist.className = 'gi-dist';
  dist.textContent = correct ? t('Found')
                   : temp === 'adjacent' ? t('Borders it')
                   : `${Math.round(distKm).toLocaleString()} km`;

  const arrow = document.createElement('span');
  arrow.className = 'gi-arrow';
  if (!correct && temp !== 'adjacent' && gameMode !== 'classic') {
    const bearing = gameMode === 'story' ? Story.arrowBearing(country)
                                          : compassBearing(country.lat, country.lon, mystery.lat, mystery.lon);
    if (bearing) {
      arrow.textContent = ARROWS[bearing] || '';
      arrow.title = t('The mystery country is {dir} of {name}', { dir: bearingWord(bearing), name: cname(country.name) });
    }
  }

  li.append(num, flag, name, dist, arrow);
  Tips.hide();
  starterEl.hidden = true;
  historyEl.prepend(li);
  historyEl.parentElement.scrollTop = 0;
  if (!correct && gameMode !== 'story' && !_restoringGuesses) Tips.afterGuess({ country, temp, distEl: dist, arrowEl: arrow });
  if (!correct && gameMode === 'daily' && n >= 2 && !_restoringGuesses && !Tips.cur) Tips.spyglass();
}
let _restoringGuesses = false;

// ============================================================
// Starter picks: before the first guess, three big countries far apart
// (the Americas, Europe/Africa, Asia/Oceania) are one tap each, so the
// first guess needs no typing. Only for a player's first few games.
// ============================================================
const STARTERS = [
  ['Brazil', 'United States', 'Mexico', 'Argentina', 'Canada'],
  ['France', 'Germany', 'Egypt', 'Nigeria', 'Kenya', 'South Africa'],
  ['India', 'China', 'Russia', 'Japan', 'Indonesia', 'Australia'],
];
const starterEl = $('starter');

function renderStarter() {
  starterEl.hidden = true;
  if (guesses.length || gameOver || !['daily', 'classic'].includes(gameMode) || Tips.veteran()) return;
  const chips = starterEl.querySelector('.starter-chips');
  chips.innerHTML = '';
  for (const group of STARTERS) {
    const names = group.filter(n => n !== mystery.name);
    const pick  = names[Math.floor(Math.random() * names.length)];
    const c = COUNTRIES.find(x => x.name === pick);
    if (!c) continue;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'starter-chip';
    b.innerHTML = `<span class="flag" aria-hidden="true">${c.flag || ''}</span>${escHtml(cname(c.name))}`;
    b.addEventListener('click', () => {
      track('starter_pick', { mode: gameMode, country: c.name });
      submitGuess(c);
    });
    chips.appendChild(b);
  }
  starterEl.hidden = false;
}

// ============================================================
// The trivia offer: in the Daily and Classic, trivia is a choice, not an
// interruption. From the 5th guess a "Win a hint" button sits above the
// input; after a question it comes back 3 guesses later. (Story asks on
// its own, every 3rd guess; room rounds have none.)
// ============================================================
const TRIVIA_FROM = 5, TRIVIA_EVERY = 3;
const triviaOfferBtn = $('trivia-offer');
let triviaAskedAt = 0;   // guesses made when the last question was asked

function renderTriviaOffer() {
  const n = guesses.length;
  const was = !triviaOfferBtn.hidden;
  triviaOfferBtn.hidden = gameOver || !['daily', 'classic'].includes(gameMode) || n < TRIVIA_FROM
    || (triviaAskedAt && n - triviaAskedAt < TRIVIA_EVERY)
    || triviaState.cluesShown >= mysteryHints(mystery).length;
  if (!triviaOfferBtn.hidden && !was) track('trivia_offer_shown', { mode: gameMode, guess: n });
}
triviaOfferBtn.addEventListener('click', () => {
  if (gameOver || !guesses.length) return;
  triviaAskedAt = guesses.length;
  triviaOfferBtn.hidden = true;
  track('trivia_offer_tap', { mode: gameMode, guess: guesses.length });
  showTrivia(guesses[guesses.length - 1].country);
});


// ============================================================
// End of game + result
// ============================================================
function endGame(won, restoring) {
  if (gameMode === 'night') {   // a game-night round: never recorded as a game
    gameOver = true; inputEl.disabled = true; trendEl.hidden = true; acListEl.innerHTML = ''; guessForm.hidden = true;
    if (!restoring && won) Rooms.onFound();
    return;
  }
  if (gameMode === 'challenge') {   // a room-challenge round: scored on the server, never recorded as a game
    gameOver = true; inputEl.disabled = true; trendEl.hidden = true; acListEl.innerHTML = ''; guessForm.hidden = true;
    if (!restoring) Challenge.onRoundEnd(won);
    return;
  }
  if (gameMode === 'story') {
    gameOver           = true;
    inputEl.disabled   = true;
    trendEl.hidden      = true;
    acListEl.innerHTML = '';
    guessForm.hidden    = true;
    if (!restoring) Story.onFound();
    return;
  }

  gameOver         = true;
  inputEl.disabled = true;
  trendEl.hidden   = true;
  triviaOfferBtn.hidden = true;
  acListEl.innerHTML = '';
  clearCurrentGame(gameMode);
  if (!won) Coach.onEnd();

  if (!won) revealed = mystery;
  dirty = true;

  guessForm.hidden       = true;
  gameoverActions.hidden = false;
  $('gameover-again-btn').textContent = gameMode === 'daily' ? t('Play Classic') : t('Play again');

  if (restoring) { flyTo(mystery); return; } // a finished game is never restored, but be safe

  // Fly the route the guesses took, then show the result ("See result" skips ahead)
  const flight = startTrail();
  const r = finalizeResult(won);
  setTimeout(() => { if (lastResult === r && !resultDialog.open) openResult(r); }, flight + (won ? 1100 : 1500));
}

function finalizeResult(won) {
  const first = guesses[0];
  const guessCount = won ? guesses.length : Math.min(guesses.length, MAX_GUESSES);
  const score = calcScore({ won, guessNames: guesses.map(g => g.country.name), answer: mystery.name });
  const temps = guesses.map(g => g.temp);

  recordGame({
    mode:          gameMode,
    day:           gameDay || utcDay(),
    mystery:       mystery.name,
    won,
    guessCount,
    temps,
    score:         score.total,
    breakdown:     score.breakdown,
    triviaCorrect: triviaState.correctCount,
    firstGuess:    first?.country.name || '',
    guesses:       guesses.map(g => g.country.name),
  });
  if (gameMode === 'daily') Spyglass.onDaily(gameDay || utcDay());
  Spyglass.renderButton();
  announceNewBadges();
  syncGames().catch(e => console.warn('Sync failed:', e));
  track('game_end', { mode: gameMode, won, guesses: guessCount, score: score.total, trivia: triviaState.correctCount, hints: triviaState.cluesShown,
                      spyglass: gameMode === 'daily' && Spyglass.usedOn(gameDay), mystery: mystery.name });

  lastResult = {
    mode:        gameMode,
    day:         gameDay || utcDay(),
    won,
    guessCount,
    temps,
    score:       score.total,
    breakdown:   score.breakdown,
    mysteryName: mystery.name,
    mysteryFlag: mystery.flag,
    guesses:     guesses.map(g => g.country.name),
  };
  return lastResult;
}

function resultFromRecord(g) {
  const c = COUNTRIES.find(x => x.name === g.mystery);
  return {
    mode:        g.mode,
    day:         g.day,
    won:         g.won,
    guessCount:  g.guessCount,
    temps:       g.temps || [],
    score:       g.score,
    breakdown:   g.breakdown || null,
    mysteryName: g.mystery,
    mysteryFlag: c ? c.flag : '',
    guesses:     g.guesses || null,
  };
}

let shownResult = null;
let resultTick = 0;

function openResult(r) {
  shownResult = r;
  const daily  = r.mode === 'daily';
  const name   = cname(r.mysteryName);
  // Classic scores toward its weekly board but isn't shared: the Daily is what people share
  const ranked = daily || r.mode === 'classic';

  $('result-label').textContent   = daily ? t('Daily #{n}', { n: dailyNumber(r.day) }) : MODE_LABEL[r.mode];
  $('result-flag').textContent    = r.mysteryFlag || '🌍';
  const kicker = $('result-kicker');
  kicker.textContent = r.won ? t('You found it') : t('Out of guesses · it was');
  kicker.classList.toggle('won', r.won);
  $('result-country').textContent = name;
  const tries = r.won ? t(r.guessCount === 1 ? '{n} guess' : '{n} guesses', { n: r.guessCount }) : t('{n} guesses', { n: r.guessCount });
  $('result-sub').innerHTML = ranked
    ? `${escHtml(tries)} · <b>${escHtml(t('{n} pts', { n: r.score.toLocaleString() }))}</b>`
    : escHtml(tries);

  renderResultStanding(r);
  renderResultTiles(r);

  resultDialog.querySelector('.result-share').hidden = !daily;
  const lbBtn = $('result-lb-btn');
  lbBtn.hidden = !ranked || (r.mode === 'classic' && !settledPlayer());
  lbBtn.textContent = r.mode === 'classic' ? t('This week’s board') : t('Leaderboard');
  $('result-again-btn').textContent = daily ? t('Play Classic') : t('Play again');

  // From home (a finished Daily or Classic reopened) the globe can be rebuilt from its guesses
  const closeBtn = $('result-close-btn');
  closeBtn.hidden = gameScreen.hidden && !(r.guesses && r.guesses.length);
  closeBtn.textContent = t('View globe');

  const bd = $('result-breakdown'), bdBtn = $('result-bd-btn');
  bdBtn.hidden = !r.breakdown || !ranked;
  bd.hidden = true;
  bdBtn.setAttribute('aria-expanded', 'false');
  bd.innerHTML = (r.breakdown || []).map(b =>
    `<div class="bd-row${b.highlight ? ' highlight' : ''}"><span>${escHtml(b.label)}</span><span>${escHtml(b.value)}</span></div>`
  ).join('');
  $('result-links-dot').hidden = closeBtn.hidden || bdBtn.hidden;
  $('result-links-dot').parentElement.hidden = closeBtn.hidden && bdBtn.hidden;

  if (!resultDialog.open) { resultDialog.showModal(); resultDialog.focus(); }   // not the close button: no ring on open
}

// Where today went against everyone: the percentile card and the guess chart.
// Both come from daily_stats (027); until that SQL has run, the card falls back to
// the leaderboard's top 50 and the chart stays hidden.
function renderResultStanding(r) {
  const card = $('result-pct'), dist = $('result-dist'), early = $('result-early');
  card.hidden = dist.hidden = early.hidden = true;
  if (r.mode !== 'daily' || cloudStatus !== 'ready') return;
  const today = r.day === utcDay();
  const mine  = r.won ? Math.min(r.guessCount, MAX_GUESSES) : MAX_GUESSES + 1;

  fetchDailyStats(r.day).then(st => {
    if (shownResult !== r || !resultDialog.open || !st || st.beat == null) return;
    const players = Number(st.players);
    if (players < 3) {
      early.textContent = t('You’re one of the first to play. Check back later to see where you stand.');
      early.hidden = false;
      return;
    }
    const counts = (st.dist || []).map(Number);
    showPercentile(r, Number(st.beat), players, today, counts);
    showGuessChart(counts, mine, players, r.won);
  }).catch(() => {
    fetchDailyLeaderboard(r.day).then(rows => {
      if (shownResult !== r || !resultDialog.open) return;
      const est = beatFromTop(rows, r.score);
      if (est) showPercentile(r, est.beat, est.players, today, null);
    }).catch(() => {});
  });
}

function showPercentile(r, beat, players, today, counts) {
  const others = Math.max(1, players - 1);
  const pct = Math.round(100 * beat / others);
  const shown = Math.min(99, pct);
  $('result-pct-num').innerHTML = `${shown}<sup>${ordinalSuffix(shown)}</sup>`;
  $('result-pct-head').textContent =
      beat >= others ? t('Best score so far')
    : pct >= 90     ? t('Near the top')
    : pct >= 50     ? t('Better than most')
    : pct >= 25     ? t('Middle of the pack')
    :                 t('A tough one');
  const n = players.toLocaleString();
  let line = pct > 0
    ? t(today ? 'You beat {pct}% of today’s {n} players.' : 'You beat {pct}% of that day’s {n} players.', { pct, n })
    : t(today ? '{n} players took on today’s country.' : '{n} players took on that day’s country.', { n });
  if (counts && counts.length) {
    const top = counts.indexOf(Math.max(...counts));
    line += ' ' + (top === counts.length - 1 ? t('Most players ran out of guesses.')
                                             : t('{n} guesses was the most common finish.', { n: top + 1 }));
  }
  $('result-pct-line').textContent = line;
  const fill = $('result-pct-fill'), dot = $('result-pct-dot');
  fill.style.width = dot.style.left = '0%';
  $('result-pct').hidden = false;
  requestAnimationFrame(() => requestAnimationFrame(() => { fill.style.width = dot.style.left = `${pct}%`; }));
}

function showGuessChart(counts, mine, players, won) {
  if (counts.length !== MAX_GUESSES + 1) return;
  const max = Math.max(1, ...counts);
  const box = $('result-dist-bars');
  box.innerHTML = counts.map((c, i) => {
    const me = i + 1 === mine;
    return `<div class="rd-col${me ? ' me' : ''}">${me ? `<span class="rd-you">${escHtml(t('YOU'))}</span>` : ''}` +
           `<div class="rd-bar" data-h="${c ? Math.max(6, Math.round(88 * c / max)) : 3}"></div>` +
           `<span class="rd-lab">${i === MAX_GUESSES ? 'X' : i + 1}</span></div>`;
  }).join('');
  const top = counts.indexOf(max);
  box.setAttribute('aria-label', t('{common}; {you}', {
    common: top === MAX_GUESSES ? t('Most players ran out of guesses') : t('Most players needed {n} guesses', { n: top + 1 }),
    you:    won ? t('you took {n}', { n: mine }) : t('you ran out'),
  }));
  $('result-dist-n').textContent = t('{n} players', { n: players.toLocaleString() });
  $('result-dist').hidden = false;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    box.querySelectorAll('.rd-bar').forEach(b => { b.style.height = `${b.dataset.h}px`; });
  }));
}

function ordinalSuffix(n) {
  if (n % 100 >= 11 && n % 100 <= 13) return 'th';
  return ['th', 'st', 'nd', 'rd'][n % 10] || 'th';
}

// The old estimate from the top 50 the leaderboard returns, for before 027 has run.
// Exact when everyone else is in that list, or when you scored above all of it
// (then everyone past it scored less); otherwise nothing.
function beatFromTop(rows, score) {
  if (!rows || !rows.length) return null;
  const others = rows.filter(x => !x.is_me);
  const total  = Number(rows[0].players) - (rows.some(x => x.is_me) ? 1 : 0);
  if (total < 2) return null;
  const below  = others.filter(x => x.score < score).length;
  const lowest = others.length ? others[others.length - 1].score : 0;
  const beat   = others.length >= total ? below : score > lowest ? below + (total - others.length) : null;
  return beat == null ? null : { beat, players: total + 1 };
}

// Next country (ticking) and the streak, under a Daily
function renderResultTiles(r) {
  clearInterval(resultTick);
  const tiles = $('result-tiles');
  tiles.hidden = r.mode !== 'daily';
  if (tiles.hidden) return;
  const streak = r.day === utcDay() ? currentDailyStreak() : 0;
  $('result-streak-tile').hidden = !streak;
  $('result-streak').textContent = streak === 1 ? t('Started today') : t('{n} days', { n: streak });
  const next = $('result-next');
  const tick = () => {
    const s = Math.max(0, Math.floor((nextDailyAt() - Date.now()) / 1000));
    next.textContent = [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map(v => String(v).padStart(2, '0')).join(':');
  };
  tick();
  resultTick = setInterval(() => { if (resultDialog.open) tick(); else clearInterval(resultTick); }, 1000);
}

document.querySelectorAll('[data-share]').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!shownResult) return;
    track('share', { method: btn.dataset.share, mode: shownResult.mode, radar: btn.dataset.share === 'image' && !!radarPoints(shownResult) });
    shareResult(shownResult, btn.dataset.share);
  });
});
// "View globe": back to the finished game, replaying its trail
$('result-close-btn').addEventListener('click', () => {
  resultDialog.close();
  if (gameScreen.hidden && shownResult && shownResult.guesses && shownResult.guesses.length) return replayFinished(shownResult);
  if (!gameScreen.hidden) track('result_globe_view', { mode: gameMode });
  if (gameOver && !gameScreen.hidden && guesses.length && !['night', 'challenge', 'story'].includes(gameMode)) startTrail();
});
$('result-x-btn').addEventListener('click', () => resultDialog.close());
$('result-bd-btn').addEventListener('click', e => {
  const bd = $('result-breakdown');
  bd.hidden = !bd.hidden;
  e.currentTarget.setAttribute('aria-expanded', String(!bd.hidden));
  if (!bd.hidden) bd.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
});
$('result-lb-btn').addEventListener('click', () => {
  resultDialog.close();
  if (shownResult && shownResult.mode === 'classic') return openLeaderboard('today', lbScope, 'classic');
  openLeaderboard(shownResult && shownResult.day !== utcDay() ? 'yesterday' : 'today');
});
$('result-again-btn').addEventListener('click', () => {
  resultDialog.close();
  playAgain(shownResult ? shownResult.mode : gameMode);
});
$('gameover-result-btn').addEventListener('click', () => { if (lastResult) openResult(lastResult); });
$('gameover-again-btn').addEventListener('click', () => playAgain(gameMode));

function playAgain(mode) {
  const next = mode === 'daily' ? 'classic' : mode;
  startGame(next, loadCurrentGame(next));
}

// ============================================================
// Stats sheet
// ============================================================
let statsTab = 'all';

// Bar colour by guess count. Heat red means 'close' in the game, so it is not used here:
// quick wins are green, long hunts drift to blue and purple
const DIST_TONE = ['var(--correct)', 'var(--correct)', 'var(--cool)', 'var(--cool)', 'var(--warm)',
                   'var(--warm)', 'var(--cold)', 'var(--cold)', 'var(--cold)', 'var(--adjacent)'];
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Counts a number up from its last shown value; decimals keep one place (avg guesses)
function countUp(el, to, decimals = 0, suffix = '') {
  const from = Number(el.dataset.v) || 0;
  el.dataset.v = to;
  const show = v => (decimals ? v.toFixed(decimals) : Math.round(v).toLocaleString()) + suffix;
  if (reduceMotion() || from === to) { el.textContent = show(to); return; }
  const t0 = performance.now();
  const step = now => {
    const k = Math.min(1, (now - t0) / 700);
    el.textContent = show(from + (to - from) * (1 - Math.pow(1 - k, 3)));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// One line that comments on the stats, most exciting true thing first
function statsBlurb(s) {
  if (!s.played) return '';
  const avg = parseFloat(s.avgGuesses);
  if (s.streak >= 3) return t('🔥 {n} Dailies in a row. Don’t break it.', { n: s.streak });
  if (s.bestStreak >= 5 && s.streak === 0) return t('Your best run was {n} days. Ready to beat it?', { n: s.bestStreak });
  if (s.played >= 5 && s.winRate >= 80) return t('Almost unbeatable. The globe is nervous.');
  if (!isNaN(avg) && avg <= 4) return t('Sharp. Your wins average {n} guesses.', { n: s.avgGuesses });
  if (s.losses > s.played / 2) return t('The globe is winning, for now. One good hunch changes that.');
  return t('Every guess brings you closer. Keep going.');
}

function renderStats() {
  const s = computeStats(statsTab);
  countUp($('st-played'), s.played);
  countUp($('st-win'), s.winRate, 0, '%');
  countUp($('st-wins'), s.wins);
  countUp($('st-streak'), s.streak);
  countUp($('st-best'), s.bestStreak);
  const avg = parseFloat(s.avgGuesses);
  if (isNaN(avg)) $('st-avg').textContent = '—';
  else countUp($('st-avg'), avg, 1);
  countUp($('st-top'), s.bestScore);
  $('st-blurb').textContent = statsBlurb(s);

  // Win ring: fills from empty to the win rate
  const ring = $('st-ring').querySelector('.ring-fg');
  const C = 2 * Math.PI * 52;
  ring.style.strokeDasharray = C;
  ring.style.strokeDashoffset = reduceMotion() ? C * (1 - s.winRate / 100) : C;
  requestAnimationFrame(() => { ring.style.strokeDashoffset = C * (1 - s.winRate / 100); });

  const rows = s.dist.map((n, i) => ({ label: i === 9 ? '10+' : String(i + 1), n, tone: DIST_TONE[i] }));
  rows.push({ label: 'X', n: s.losses, tone: 'var(--muted)' });
  const max = Math.max(1, ...rows.map(r => r.n));
  const topWins = Math.max(...s.dist);
  const peak = topWins > 0 ? s.dist.indexOf(topWins) : -1;   // most common win bucket
  $('st-dist').innerHTML = rows.map((r, i) =>
    `<div class="dist-row${i === peak ? ' peak' : ''}"><span class="dist-label">${r.label}</span>` +
    `<span class="dist-bar" data-w="${r.n ? Math.max(r.n / max * 100, 8) : 0}" style="--tone:${r.tone};width:0">` +
    `<span>${r.n ? r.n + (i === peak ? t(' · most common') : '') : ''}</span></span></div>`
  ).join('');
  // Grow the bars after the first paint so the change is visible
  requestAnimationFrame(() => document.querySelectorAll('#st-dist .dist-bar').forEach(b => { b.style.width = b.dataset.w + '%'; }));
  $('st-empty').hidden = s.played > 0;

  // Re-run the entrance when switching tabs
  const body = statsDialog.querySelector('.stat-grid');
  [body, $('st-dist'), $('st-blurb')].forEach(el => { el.classList.remove('fresh'); void el.offsetWidth; el.classList.add('fresh'); });

  statsDialog.querySelectorAll('.seg-btn').forEach(b => b.setAttribute('aria-pressed', b.dataset.tab === statsTab));
}

statsDialog.querySelectorAll('.seg-btn').forEach(b => {
  b.addEventListener('click', () => { statsTab = b.dataset.tab; renderStats(); });
});
$('stats-btn').addEventListener('click', () => { renderStats(); statsDialog.showModal(); track('stats_open'); });
$('stats-close-btn').addEventListener('click', () => statsDialog.close());

// ============================================================
// Account sheet
// ============================================================
const accountDialog = $('account-dialog');
const googleBtn     = $('google-btn');
const signOutBtn    = $('signout-btn');

function renderAccount() {
  if (typeof Notify !== 'undefined') Notify.renderAccountRow();
  const guest = isGuest();
  const games = loadStore().games.length;

  $('account-dot').hidden = guest;
  $('home-save-btn').hidden = !guest || games === 0 || cloudStatus === 'offline';

  if (cloudStatus === 'offline') {
    $('account-status').textContent = 'Offline';
    $('account-note').textContent   = 'Your games are saved on this device. Sign-in will be available when you’re back online.';
  } else if (guest) {
    $('account-status').textContent = 'Playing as a guest';
    $('account-note').textContent   = 'Your games are saved on this device only. Sign in to keep your stats and streak on every device.';
  } else {
    $('account-status').textContent = cloudEmail() || 'Signed in with Google';
    $('account-note').textContent   = 'Your games are backed up and synced across your devices.';
  }
  // Google's own button when its script has loaded; ours (the redirect flow) otherwise
  const canLink = guest && cloudStatus === 'ready';
  const gis = !!window.google?.accounts?.id;
  $('google-gis').hidden = !canLink || !gis;
  googleBtn.hidden  = !canLink || gis;
  signOutBtn.hidden = guest;

  $('username-row').hidden = cloudStatus !== 'ready';
  $('role-row').hidden = cloudRole === 'player';
  $('role-value').textContent = cloudRole.charAt(0).toUpperCase() + cloudRole.slice(1);
  $('username-value').textContent     = cloudUsername || 'Not set';
  $('username-edit-btn').textContent  = cloudUsername ? 'Change' : 'Set name';
}

function openAccount() {
  renderAccount();
  accountDialog.showModal();
  renderGoogleButton();
}

// Draws Google's button with a fresh nonce. Called when the sheet opens, and
// when Google's script finishes loading while the sheet is already open.
async function renderGoogleButton() {
  const box = $('google-gis');
  if (box.hidden || !window.google?.accounts?.id) return;
  const nonce = await googleNonce();
  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    nonce: nonce.hashed,
    use_fedcm_for_button: true,
    callback: async ({ credential }) => {
      track('signin_click', { via: 'google_button' });
      try {
        await signInWithGoogleToken(credential, nonce.raw);
        await flushEvents();
        location.reload();   // start fresh as the signed-in player, like the redirect flow
      } catch (e) {
        console.warn(e);
        showToast('Couldn’t sign in with Google — try again');
        renderGoogleButton();  // the nonce is single use
      }
    },
  });
  box.innerHTML = '';
  google.accounts.id.renderButton(box, {
    theme: isLightTheme() ? 'outline' : 'filled_black',
    size: 'large', text: 'continue_with', shape: 'pill', logo_alignment: 'center',
    width: Math.min(400, Math.max(200, box.clientWidth || 300)),
  });
}
// Google calls this when its script is ready
window.onGoogleLibraryLoad = () => { if (accountDialog.open) { renderAccount(); renderGoogleButton(); } };

// A signed-in (non-guest) id we've already pushed the username prompt for
// this page load — so it asks once per sign-in, not on every cloud update,
// and doesn't reopen the moment a player taps "Later".
let _usernamePromptedFor = null;

onCloudChange(() => {
  renderAccount();
  if (!homeScreen.hidden) renderHome(); // games from another device may have arrived
  if (lbDialog.open) loadLeaderboard(); // e.g. finished connecting while it was open
  if (friendsDialog.open) renderFriends();

  const incoming = incomingRequestCount();
  $('friends-badge').hidden = incoming === 0;
  $('friends-badge').textContent = incoming;

  // Signed in with Google but never picked a name — push it now rather than
  // leaving it to be found later; a guest keeps playing uninterrupted.
  if (cloudStatus === 'ready' && cloudUser && !cloudUser.is_anonymous && !cloudUsername
      && !usernameDialog.open && _usernamePromptedFor !== cloudUser.id) {
    _usernamePromptedFor = cloudUser.id;
    openUsername(renderAccount, { forced: true });
  }

  // Arrived through someone's invite link
  if (pendingInvite && cloudStatus === 'ready') {
    const name = pendingInvite;
    pendingInvite = null;
    if (name.toLowerCase() !== (cloudUsername || '').toLowerCase()) openFriends(name);
  }
});

$('account-btn').addEventListener('click', openAccount);
$('home-save-btn').addEventListener('click', openAccount);
$('account-close-btn').addEventListener('click', () => accountDialog.close());

googleBtn.addEventListener('click', async () => {
  googleBtn.disabled = true;
  try {
    track('signin_click');
    await flushEvents();       // we're about to leave the page
    await signInWithGoogle(); // navigates away on success
  } catch (e) {
    console.warn(e);
    showToast('Couldn’t reach Google — try again');
    googleBtn.disabled = false;
  }
});

$('username-edit-btn').addEventListener('click', () => openUsername(renderAccount));

// ============================================================
// Username picker
// ============================================================
const usernameDialog   = $('username-dialog');
const usernameInput    = $('username-input');
const usernameError    = $('username-error');
const usernameSubtitle = $('username-subtitle');
const usernameCancelBtn = $('username-cancel-btn');
const USERNAME_SUBTITLE_DEFAULT = usernameSubtitle.textContent;
const USERNAME_SUBTITLE_DAILY   = t('Pick a name to play the Daily. It’s how you show up on the leaderboard and in your rooms. 3–20 letters, numbers or _.');
const USERNAME_SUBTITLE_STORY   = STORY.ui.usernameReason;
const USERNAME_SUBTITLE_ROOM    = t('Your room’s leaderboard shows this name. 3–20 letters, numbers or _.');
const USERNAME_SUBTITLE_FIRST   = t('Nice game! Pick a name to put your score on today’s leaderboard. 3–20 letters, numbers or _.');
const NAME_ASKED_KEY = 'pancake_name_asked';

// A first visit now asks for the name before the first game (boot). These cover players
// who skipped that: an older first visit with the after-game welcome still 'due', or one
// who arrived on a room invite. Once the result and badge cards close, ask once.
const WELCOME_KEY = 'pancake_welcome';   // 'due' from a first visit until the welcome has played

function maybeAskName() {
  if (document.querySelector('dialog[open]') || (loadStore().badgesPending || []).length) return;
  let welcome = false;
  try { welcome = localStorage.getItem(WELCOME_KEY) === 'due'; } catch {}
  if (welcome && loadStore().games.length && !document.querySelector('.name-step')) {
    try { localStorage.removeItem(WELCOME_KEY); localStorage.setItem(NAME_ASKED_KEY, '1'); } catch {}
    if (cloudUsername) return;
    NameStep.ask(renderAccount, { kind: 'welcome' });
    return;
  }
  let asked = false;
  try { asked = !!localStorage.getItem(NAME_ASKED_KEY); } catch {}
  if (asked || cloudStatus !== 'ready' || cloudUsername || !loadStore().games.length) return;
  if (document.querySelector('dialog[open]') || (loadStore().badgesPending || []).length) return;
  try { localStorage.setItem(NAME_ASKED_KEY, '1'); } catch {}
  track('first_game_username_prompt_shown');
  openUsername(renderAccount, {
    forced: true, reason: 'first', skipLabel: 'Later',
    onSkip: () => track('first_game_username_prompt_skipped'),
  });
}
// Each of these can be the last sheet after a game; badge cards follow the result after 250 ms
for (const id of ['result-dialog', 'badge-dialog', 'passport-dialog']) {
  $(id).addEventListener('close', () => setTimeout(maybeAskName, 500));
}
let   usernameSaved   = null;  // callback after a successful save
let   usernameSkipped = null;  // callback when the dialog closes without saving
let   forcingUsername = false;
let   _usernameJustSaved = false; // distinguishes "closed because saved" from Cancel/Escape

// forced: true when opened automatically rather than the player finding the
// picker themselves (after a sign-in with no name yet, or — every time,
// not just once — opening the Daily with no name yet). Still dismissible:
// trapping an offline player, or one who wants to think of a name, is its
// own kind of bad experience — "Later"/skipLabel just says there's a reason.
// onSkip also fires on Escape, not only the Cancel/Later button, via the
// dialog's own 'close' event below — so there's no silent way out of it.
function openUsername(onSaved = null, { forced = false, reason = null, onSkip = null, skipLabel = 'Later' } = {}) {
  usernameSaved     = onSaved;
  usernameSkipped   = onSkip;
  forcingUsername   = forced;
  _usernameJustSaved = false;
  usernameInput.value   = cloudUsername || '';
  usernameError.hidden  = true;
  usernameSubtitle.textContent = reason === 'daily' ? USERNAME_SUBTITLE_DAILY
                                : reason === 'story' ? USERNAME_SUBTITLE_STORY
                                : reason === 'room'  ? USERNAME_SUBTITLE_ROOM
                                : reason === 'first' ? USERNAME_SUBTITLE_FIRST
                                : USERNAME_SUBTITLE_DEFAULT;
  usernameCancelBtn.textContent = forced ? t(skipLabel) : t('Cancel');
  usernameDialog.showModal();
  usernameInput.focus();
}

$('username-form').addEventListener('submit', async e => {
  e.preventDefault();
  const saveBtn = $('username-save-btn');
  saveBtn.disabled = true;
  const problem = await setUsername(usernameInput.value.trim());
  saveBtn.disabled = false;
  if (problem) {
    usernameError.textContent = t(problem);
    usernameError.hidden = false;
    shake(usernameInput);
    return;
  }
  _usernameJustSaved = true;
  usernameDialog.close();
  showToast(t('Name saved'));
  track('username_set');
  if (usernameSaved) usernameSaved();
});
usernameInput.addEventListener('input', () => { usernameError.hidden = true; });
usernameCancelBtn.addEventListener('click', () => usernameDialog.close());
usernameDialog.addEventListener('close', () => {
  if (!_usernameJustSaved && usernameSkipped) usernameSkipped();
});

// ============================================================
// Daily leaderboard
// ============================================================
const lbDialog = $('lb-dialog');
const lbList   = $('lb-list');
const lbSub    = $('lb-sub');
const lbEmpty  = $('lb-empty');
const lbCta    = $('lb-cta');
let lbWhich = 'today';  // 'today' | 'yesterday' (Classic: this week | last week)
let lbScope = 'all';    // 'all' | 'friends'
let lbBoard = 'daily';  // 'daily' | 'classic'
let lbToken = 0;      // ignore responses for a tab the player already left
let lbCtaAction = null;

function lbDayOf(which) {
  return which === 'today' ? utcDay() : utcDay(new Date(Date.now() - 86400000));
}

// Classic's week starts Monday 00:00 UTC (the server's date_trunc('week'))
function classicWeek(which) {
  const d = new Date();
  const back = (d.getUTCDay() + 6) % 7 + (which === 'yesterday' ? 7 : 0);
  return utcDay(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - back)));
}

function openLeaderboard(which = 'today', scope = lbScope, board = 'daily') {
  lbDialog.querySelector('.lb-board').hidden = !settledPlayer();
  if (!settledPlayer()) board = 'daily';
  lbWhich = which;
  lbScope = scope;
  lbBoard = board;
  if (!lbDialog.open) lbDialog.showModal();
  loadLeaderboard();
}

function setLbCta(label, action) {
  lbCta.hidden = !label;
  lbCta.textContent = label || '';
  lbCtaAction = action || null;
}

function lbRow(r) {
  const li = document.createElement('li');
  li.className = `lb-row${r.is_me ? ' me' : ''}`;
  const cells = [
    ['lb-rank',   `${r.rank}`],
    ['lb-name',   r.is_me ? t('{name} (you)', { name: r.username }) : r.username],
    ['lb-result', lbBoard === 'classic' ? t('{n} found', { n: r.games }) : r.won ? `${r.guess_count}/${MAX_GUESSES}` : `X/${MAX_GUESSES}`],
    ['lb-score',  `${r.score.toLocaleString()} ${t('pts')}`],
  ];
  for (const [cls, text] of cells) {
    const span = document.createElement('span');
    span.className = cls;
    span.textContent = text;
    li.appendChild(span);
  }
  return li;
}

async function loadLeaderboard() {
  const token   = ++lbToken;
  const classic = lbBoard === 'classic';
  const day     = lbDayOf(lbWhich);
  const week    = classicWeek(lbWhich);
  const played  = classic
    ? loadStore().games.some(g => g.mode === 'classic' && g.won && g.ts >= Date.parse(week))
    : getDailyResult(day);

  $('lb-title').textContent = classic ? t('Classic · week of {date}', { date: new Date(week + 'T00:00:00Z').toLocaleDateString(LANG === 'hi' ? 'hi-IN' : [], { month: 'short', day: 'numeric', timeZone: 'UTC' }) })
                                      : t('Daily #{n}', { n: dailyNumber(day) });
  const [now, prev] = lbDialog.querySelectorAll('[data-lb]');
  now.textContent  = t(classic ? 'This week' : 'Today');
  prev.textContent = t(classic ? 'Last week' : 'Yesterday');
  lbDialog.querySelectorAll('[data-board]').forEach(b => b.setAttribute('aria-pressed', b.dataset.board === lbBoard));
  lbDialog.querySelectorAll('[data-lb]').forEach(b => b.setAttribute('aria-pressed', b.dataset.lb === lbWhich));
  lbDialog.querySelectorAll('[data-scope]').forEach(b => b.setAttribute('aria-pressed', b.dataset.scope === lbScope));
  lbList.innerHTML = '';
  lbSub.textContent = t('Loading…');
  lbEmpty.hidden = true;
  setLbCta(null);

  if (cloudStatus !== 'ready') {
    lbSub.textContent = '';
    lbEmpty.textContent = cloudStatus === 'connecting' ? t('Connecting…') : t('The leaderboard needs an internet connection.');
    lbEmpty.hidden = false;
    return;
  }

  let rows;
  try {
    track('leaderboard_view', { scope: lbScope, which: lbWhich, board: lbBoard });
    rows = classic ? await fetchClassicLeaderboard(week, lbScope === 'friends')
                   : await fetchDailyLeaderboard(day, lbScope === 'friends');
  } catch (e) {
    console.warn(e);
    if (token !== lbToken) return;
    lbSub.textContent = '';
    lbEmpty.textContent = t('Couldn’t load the leaderboard — try again.');
    lbEmpty.hidden = false;
    return;
  }
  if (token !== lbToken) return;

  const players = rows.length ? Number(rows[0].players) : 0;
  lbSub.textContent = (players ? t(players === 1 ? '{n} player' : '{n} players', { n: players.toLocaleString() }) : '')
                    + (classic ? `${players ? ' · ' : ''}${t('your best 10 finds count')}` : '');

  let prevRank = 0;
  for (const r of rows) {
    const rank = Number(r.rank);
    if (rank > prevRank + 1) {
      const gap = document.createElement('li');
      gap.className = 'lb-gap';
      gap.textContent = '⋯';
      gap.setAttribute('aria-hidden', 'true');
      lbList.appendChild(gap);
    }
    lbList.appendChild(lbRow({ ...r, rank }));
    prevRank = rank;
  }

  const hasFriends = cloudFriends.some(f => f.status === 'friend');
  if (lbScope === 'friends' && !hasFriends) {
    lbEmpty.textContent = t('Add friends to see how you compare.');
    lbEmpty.hidden = false;
  } else if (!rows.length) {
    lbEmpty.textContent = lbScope === 'friends' ? t(classic ? 'None of your friends have played Classic this week yet.' : 'None of your friends have played this Daily yet.')
                        : lbWhich === 'today'   ? t('No one on the board yet — be the first!')
                        : t(classic ? 'No one played Classic that week.' : 'No one played this Daily.');
    lbEmpty.hidden = false;
  }

  if (lbScope === 'friends' && !hasFriends) {
    setLbCta(t('Add friends'), () => { lbDialog.close(); openFriends(); });
  } else if (!played && lbWhich === 'today') {
    classic ? setLbCta(t('Play Classic'), () => { lbDialog.close(); chooseMode('classic'); })
            : setLbCta(t('Play today’s Daily'), () => { lbDialog.close(); chooseMode('daily'); });
  } else if (played && !cloudUsername) {
    setLbCta(t('Pick a name to join the board'), () => openUsername(loadLeaderboard));
  }
}

lbDialog.querySelectorAll('[data-lb]').forEach(b => {
  b.addEventListener('click', () => { lbWhich = b.dataset.lb; loadLeaderboard(); });
});
lbDialog.querySelectorAll('[data-board]').forEach(b => {
  b.addEventListener('click', () => { lbBoard = b.dataset.board; loadLeaderboard(); });
});
lbDialog.querySelectorAll('[data-scope]').forEach(b => {
  b.addEventListener('click', () => { lbScope = b.dataset.scope; loadLeaderboard(); });
});
lbCta.addEventListener('click', () => { if (lbCtaAction) lbCtaAction(); });
$('lb-close-btn').addEventListener('click', () => lbDialog.close());
$('home-lb-btn').addEventListener('click', () => openLeaderboard('today'));

// ============================================================
// Friends
// ============================================================
const friendsDialog = $('friends-dialog');
const friendInput   = $('friend-input');
const friendMsg     = $('friend-msg');
const friendsLists  = $('friends-lists');

// ?friend=<name> from an invite link; handled once the cloud is ready
let pendingInvite = null;
(function readInvite() {
  const params = new URLSearchParams(location.search);
  const name   = params.get('friend');
  if (!name) return;
  pendingInvite = name.slice(0, 20);
  track('invite_open');
  params.delete('friend');
  const rest = params.toString();
  history.replaceState(null, '', location.pathname + (rest ? `?${rest}` : '') + location.hash);
})();

function setFriendMsg(text, isError = false) {
  friendMsg.hidden = !text;
  friendMsg.textContent = text || '';
  friendMsg.classList.toggle('error', isError);
}

function openFriends(prefill = '') {
  friendInput.value = prefill;
  setFriendMsg(prefill ? `Tap Add to send ${prefill} a friend request.` : '');
  renderFriends();
  if (!friendsDialog.open) friendsDialog.showModal();
  if (cloudStatus === 'ready') loadFriends().catch(e => console.warn(e));
}

function friendButton(label, cls, onClick) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = `btn small ${cls}`;
  b.textContent = label;
  b.addEventListener('click', async () => {
    b.disabled = true;
    const problem = await onClick(b);
    if (problem) showToast(problem);
    b.disabled = false;
  });
  return b;
}

// Removing a friend takes two taps
function removeButton(f) {
  return friendButton('Remove', 'ghost', async b => {
    if (!b.dataset.armed) {
      b.dataset.armed = '1';
      b.textContent = 'Sure?';
      setTimeout(() => { delete b.dataset.armed; b.textContent = 'Remove'; }, 3000);
      return null;
    }
    return removeFriend(f.id);
  });
}

function renderFriends() {
  const note    = $('friends-note');
  const nameBtn = $('friends-name-btn');
  const main    = $('friends-main');

  const offline  = cloudStatus !== 'ready';
  const needName = !offline && !cloudUsername;
  note.hidden    = !(offline || needName);
  note.textContent = offline ? (cloudStatus === 'connecting' ? 'Connecting…' : 'Friends need an internet connection.')
                             : 'Pick a leaderboard name first — it’s how friends find you.';
  nameBtn.hidden = !needName;
  main.hidden    = offline || needName;
  if (main.hidden) return;

  $('notify-btn').hidden = !('Notification' in window) || Notification.permission !== 'default';

  friendsLists.innerHTML = '';
  const groups = [
    ['incoming', 'Requests', f => [
      friendButton('Accept', 'primary', () => acceptFriend(f.id)),
      friendButton('Decline', 'ghost', () => removeFriend(f.id)),
    ]],
    ['friend', 'Your friends', f => [removeButton(f)]],
    ['outgoing', 'Sent', f => [friendButton('Cancel', 'ghost', () => removeFriend(f.id))]],
  ];

  for (const [status, title, actions] of groups) {
    const people = cloudFriends.filter(f => f.status === status);
    if (!people.length) continue;
    const h = document.createElement('h3');
    h.className = 'sheet-sub';
    h.textContent = `${title} · ${people.length}`;
    const ul = document.createElement('ul');
    ul.className = 'friend-list';
    for (const f of people) {
      const li = document.createElement('li');
      li.className = 'friend-row';
      const name = document.createElement('span');
      name.className = 'friend-name';
      name.textContent = f.username;
      li.append(name, ...actions(f));
      ul.appendChild(li);
    }
    friendsLists.append(h, ul);
  }

  if (!cloudFriends.length) {
    const p = document.createElement('p');
    p.className = 'muted friends-empty';
    p.textContent = `Add a friend by their leaderboard name, or send them your invite link. You’re “${cloudUsername}”.`;
    friendsLists.appendChild(p);
  }
}

$('friend-form').addEventListener('submit', async e => {
  e.preventDefault();
  const name = friendInput.value.trim();
  if (!name) return;
  const addBtn = $('friend-add-btn');
  addBtn.disabled = true;
  const res = await addFriend(name);
  track('friend_request', { result: res.error ? 'error' : res.status });
  addBtn.disabled = false;
  if (res.error) {
    setFriendMsg(res.error, true);
    shake(friendInput);
    return;
  }
  friendInput.value = '';
  setFriendMsg(res.status === 'friends' ? `You and ${name} are now friends!` : `Request sent to ${name}.`);
});
friendInput.addEventListener('input', () => setFriendMsg(''));

$('invite-btn').addEventListener('click', async () => {
  const url  = inviteUrl();
  const text = `Play ${APP_NAME} with me! I’m ${cloudUsername} — add me as a friend:`;
  if (navigator.share) {
    track('invite_share');
    try { await navigator.share({ title: APP_NAME, text, url }); return; }
    catch (e) { if (e.name === 'AbortError') return; }
  }
  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
    showToast('Invite link copied');
  } catch {
    showToast(url);
  }
});

$('friends-name-btn').addEventListener('click', () => openUsername(renderFriends));
$('friends-close-btn').addEventListener('click', () => friendsDialog.close());

$('notify-btn').addEventListener('click', async () => {
  try { await Notification.requestPermission(); } catch {}
  renderFriends();
  if (Notification.permission === 'granted') showToast('Notifications on');
});

// Live the moment a request arrives or is accepted — no need to reopen
// Friends to find out. A toast always; a system notification too when the
// game isn't the active tab and the player has allowed it.
onFriendEvent(({ type, username }) => {
  const text = type === 'request' ? `${username} wants to be your friend` : `${username} accepted your friend request!`;
  showToast(text);
  track(type === 'request' ? 'friend_request_received' : 'friend_request_accepted_push');
  if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
    try { new Notification(APP_NAME, { body: text, icon: 'icons/icon-192.png', tag: 'pancake-friend' }); } catch {}
  }
});

signOutBtn.addEventListener('click', async () => {
  signOutBtn.disabled = true;
  try {
    track('signout');
    await flushEvents();
    await signOutCloud();
    accountDialog.close();
    showScreen('home');
    showToast('Signed out');
  } catch (e) {
    console.warn(e);
    showToast('Couldn’t save your latest games — try again when online');
  }
  signOutBtn.disabled = false;
});

// ============================================================
// How to play
// ============================================================
function openHelp() { helpDialog.showModal(); track('help_open'); }
$('help-btn').addEventListener('click', openHelp);
$('home-help-btn').addEventListener('click', openHelp);
$('atlas-btn').addEventListener('click', startAtlas);
$('help-close-btn').addEventListener('click', () => helpDialog.close());
helpDialog.addEventListener('close', () => {
  try { localStorage.setItem(SEEN_HELP_KEY, '1'); } catch {}
});

// Click on the backdrop closes a dialog (trivia excluded — it has its own timer)
for (const d of [resultDialog, statsDialog, helpDialog]) {
  d.addEventListener('click', e => { if (e.target === d) d.close(); });
}

// ============================================================
// Trivia (regular trivia and Flag Hint Trivia)
// ============================================================
const TRIVIA_SECONDS = 15;

// A second, more obscure fact for the trivia-correct bonus — landmarks,
// animals, food, and the like, reusing the same vetted questions the
// quiz itself draws from (triviaKind comes from trivia-options.js).
const OBSCURE_FACT_KINDS = new Set(['landmark', 'animal', 'material', 'food', 'plant', 'music', 'person']);
const OBSCURE_FACT_ICON  = { landmark: '🏛️', animal: '🦁', material: '💎', food: '🍽️', plant: '🌿', music: '🎶', person: '🧑‍🎤' };

function obscureFact(countryName, excludeQuestion = null) {
  const qs = TRIVIA[countryName];
  if (!qs) return null;
  const candidates = qs.filter(q => OBSCURE_FACT_KINDS.has(triviaKind(q)) && q.q !== excludeQuestion);
  if (!candidates.length) return null;
  const q = candidates[Math.floor(Math.random() * candidates.length)];
  // The bare answer alone often reads as gibberish out of context (e.g.
  // "Cousins") — keep enough of the question for it to make sense on its own.
  const question = q.q.length > 100 ? q.q.slice(0, 97) + '…' : q.q;
  return { icon: OBSCURE_FACT_ICON[triviaKind(q)] || '✨', question, answer: q.a };
}

// A question about the country just guessed. (There's no flag round: the
// mystery's flag gives the answer away.)
function showTrivia(country) {
  const isFlagRound = false;
  const q = getTriviaQuestion(country.name);
  if (!q) return;
  track('trivia_shown', { mode: gameMode, capital: /\bcapital of\b/i.test(q.q), fresh: q.fresh !== false, guess: guesses.length });

  inputEl.disabled = true;

  triviaState.correctAnswer    = q.a;
  triviaState.country          = country;
  triviaState.answered         = false;
  triviaState.isFlagHintTrivia = isFlagRound;

  const hintsLeft = gameMode !== 'story' && triviaState.cluesShown < mysteryHints(mystery).length;
  $('trivia-badge').textContent = hintsLeft ? t('Quick trivia · win a hint') : t('Quick trivia');
  triviaCountryLbl.textContent  = isFlagRound
    ? 'Answer correctly to unlock the mystery country’s flag.'
    : t('About your guess: {name}', { name: `${country.flag ? country.flag + ' ' : ''}${cname(country.name)}` });
  triviaQuestionEl.textContent  = q.q;
  triviaFeedback.hidden         = true;
  triviaContinueBtn.hidden      = true;
  $('trivia-skip-btn').hidden   = false;

  triviaOptionsEl.innerHTML = '';
  buildChoices(q, isFlagRound ? null : country.name).forEach((text, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'trivia-option';
    b.dataset.answer = text;
    const key = document.createElement('span');
    key.className = 'key';
    key.textContent = i + 1;
    key.setAttribute('aria-hidden', 'true');
    b.append(key, text);
    b.addEventListener('click', () => chooseTriviaOption(b));
    triviaOptionsEl.appendChild(b);
  });
  triviaFeedback.innerHTML      = '';

  // Countdown
  clearInterval(triviaState.timer);
  let timeLeft = TRIVIA_SECONDS;
  triviaTimerText.textContent = `${timeLeft}s`;
  triviaTimerBar.style.transition = 'none';
  triviaTimerBar.style.width = '100%';
  triviaTimerBar.classList.remove('low');
  requestAnimationFrame(() => requestAnimationFrame(() => {
    triviaTimerBar.style.transition = 'width 1s linear';
  }));
  triviaState.timer = setInterval(() => {
    timeLeft--;
    triviaTimerText.textContent = `${timeLeft}s`;
    triviaTimerBar.style.width = `${(timeLeft / TRIVIA_SECONDS) * 100}%`;
    triviaTimerBar.classList.toggle('low', timeLeft <= 5);
    if (timeLeft <= 0) {
      clearInterval(triviaState.timer);
      if (!triviaState.answered) revealTriviaAnswer(false, true);
    }
  }, 1000);

  triviaDialog.showModal();
  triviaOptionsEl.firstElementChild?.focus({ preventScroll: true });
}

function closeTrivia() {
  clearInterval(triviaState.timer);
  if (triviaDialog.open) triviaDialog.close();
  if (!gameOver) {
    inputEl.disabled = false;
    if (window.matchMedia('(pointer: fine)').matches) inputEl.focus();
  }
}

function chooseTriviaOption(btn) {
  if (triviaState.answered) return;
  revealTriviaAnswer(btn.dataset.answer === triviaState.correctAnswer, false, btn);
}

function revealTriviaAnswer(isCorrect, timedOut, chosen = null) {
  clearInterval(triviaState.timer);
  triviaState.answered = true;
  track('trivia_answer', {
    q:       triviaQuestionEl.textContent.slice(0, 160),
    country: triviaState.isFlagHintTrivia ? null : triviaState.country.name,
    flag:    triviaState.isFlagHintTrivia,
    correct: isCorrect,
    timeout: timedOut,
    picked:  chosen ? chosen.dataset.answer.slice(0, 80) : null,
  });

  for (const b of triviaOptionsEl.children) {
    b.disabled = true;
    if (b.dataset.answer === triviaState.correctAnswer) b.classList.add('right');
    else if (b === chosen) b.classList.add('wrong');
  }
  $('trivia-skip-btn').hidden = true;
  triviaContinueBtn.hidden    = false;

  if (gameMode === 'story') Story.onTrivia(isCorrect);

  if (isCorrect) {
    triviaState.correctCount++;
    const c = triviaState.country;
    let html = `<p><strong>${t('Correct!')}</strong></p>`;

    if (gameMode === 'story') {
      // Story keeps its own staged hints: a bonus fact about the guess instead
      const facts = countryFacts(c.name);
      if (facts) html += `<p>🏙️ ${escHtml(facts.capital)} · 👥 ~${escHtml(facts.population)}</p>`;
      const askedQ  = triviaState.isFlagHintTrivia ? null : triviaQuestionEl.textContent;
      const obscure = obscureFact(c.name, askedQ);
      if (obscure) html += `<p>${obscure.icon} ${escHtml(obscure.question)} <strong>${escHtml(obscure.answer)}</strong></p>`;
    } else if (!triviaState.isFlagHintTrivia) {
      // The prize: the next hint about the mystery country, subtle to specific
      const hint = mysteryHints(mystery)[triviaState.cluesShown];
      if (hint) {
        triviaState.cluesShown++;
        html += `<p class="trivia-clue"><span class="trivia-clue-label">${t('🔎 Hint about the mystery country')}</span>${hintHtml(hint)}</p>`;
        renderHints();
      } else {
        html += `<p>${t('You’ve won every hint. The rest is up to you.')}</p>`;
      }
    }

    triviaFeedback.className = 'trivia-feedback good';
    triviaFeedback.innerHTML = html;
    persistCurrent();
  } else {
    triviaFeedback.className = 'trivia-feedback bad';
    triviaFeedback.innerHTML = `<p>${t('{lead} The answer was {answer}.', { lead: t(timedOut ? 'Time’s up.' : 'Not quite.'), answer: `<strong>${escHtml(triviaState.correctAnswer)}</strong>` })}</p>`;
  }
  triviaFeedback.hidden = false;
  triviaContinueBtn.focus();
}

function hintHtml(h) {
  return `${h.icon} ${escHtml(h.q)} <strong>${escHtml(h.a)}</strong>`;
}

// The hint bar above the input: how many hints you've won; tap to read them
function renderHints() {
  const won = gameMode === 'story' ? 0 : triviaState.cluesShown;
  hintPill.hidden = won === 0;
  if (!won) return;
  const latest = mysteryHints(mystery)[won - 1];
  hintPill.innerHTML = `<span class="hint-item">${t(won === 1 ? '🔎 {n} hint' : '🔎 {n} hints', { n: won })}</span>` +
    (latest ? `<span class="hint-latest">${escHtml(latest.a)}</span>` : '');
}

function openHints() {
  const list = $('hints-list');
  list.innerHTML = mysteryHints(mystery).slice(0, triviaState.cluesShown)
    .map(h => `<li>${hintHtml(h)}</li>`).join('');
  $('hints-dialog').showModal();
  track('hints_open', { hints: triviaState.cluesShown });
}
hintPill.addEventListener('click', openHints);
$('hints-close-btn').addEventListener('click', () => $('hints-dialog').close());

triviaContinueBtn.addEventListener('click', closeTrivia);
// Keys 1–4 pick an option on desktop
triviaDialog.addEventListener('keydown', e => {
  if (triviaState.answered || !/^[1-4]$/.test(e.key)) return;
  const b = triviaOptionsEl.children[Number(e.key) - 1];
  if (b) { e.preventDefault(); chooseTriviaOption(b); }
});
$('trivia-skip-btn').addEventListener('click', () => {
  track('trivia_skip', { q: triviaQuestionEl.textContent.slice(0, 160), flag: triviaState.isFlagHintTrivia });
  closeTrivia();
});
triviaDialog.addEventListener('cancel', e => { e.preventDefault(); closeTrivia(); }); // Esc = skip


// ============================================================
// Autocomplete
// ============================================================
inputEl.addEventListener('input', () => {
  const raw = inputEl.value.trim();
  const val = normalize(raw);
  acListEl.innerHTML = '';
  acIndex = -1;
  if (!val) return;

  const seen    = new Set();
  const matches = [];
  for (const c of COUNTRIES) {
    if (normalize(c.name).startsWith(val) && !seen.has(c.name)) {
      seen.add(c.name);
      matches.push(c);
    }
  }
  for (const [alias, canonical] of Object.entries(ALIASES)) {
    if (!alias.startsWith(val)) continue;
    const c = NORMALIZED_COUNTRY_MAP[normalize(canonical)];
    if (c && !seen.has(c.name)) { seen.add(c.name); matches.push(c); }
  }
  // Hindi names (i18n.js): typed in Devanagari, in either language
  for (const en of countriesByHindiPrefix(raw)) {
    const c = NORMALIZED_COUNTRY_MAP[normalize(en)];
    if (c && !seen.has(c.name)) { seen.add(c.name); matches.push(c); }
  }

  const guessed = new Set(guesses.map(g => g.country.name));
  for (const c of matches.slice(0, 8)) {
    const item = document.createElement('div');
    item.className = 'ac-item';
    item.setAttribute('role', 'option');
    item.dataset.name = c.name;
    if (guessed.has(c.name)) item.classList.add('guessed');

    const flag = document.createElement('span');
    flag.className = 'ac-flag';
    flag.append(makeFlagImg(c, 20));
    const name = document.createElement('span');
    name.className = 'ac-name';
    // Bold the typed prefix (only when the name itself matched, not an alias)
    const shown = cname(c.name);
    if (normalize(shown).startsWith(val)) {
      const b = document.createElement('strong');
      b.textContent = shown.slice(0, raw.length);
      name.append(b, shown.slice(raw.length));
    } else {
      name.textContent = shown;
    }
    item.append(flag, name);
    if (shown !== c.name) {                       // Hindi: the English name too, smaller
      const en = document.createElement('span');
      en.className = 'ac-en';
      en.textContent = c.name;
      item.append(en);
    }

    const pick = e => {
      e.preventDefault();
      inputEl.value = c.name;
      acListEl.innerHTML = '';
      submitGuess();
    };
    item.addEventListener('mousedown', pick);
    item.addEventListener('touchend', pick);
    acListEl.appendChild(item);
  }
});

inputEl.addEventListener('keydown', e => {
  const items = acListEl.querySelectorAll('.ac-item');
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    acIndex = e.key === 'ArrowDown'
      ? Math.min(acIndex + 1, items.length - 1)
      : Math.max(acIndex - 1, -1);
    items.forEach((el, i) => el.classList.toggle('active', i === acIndex));
    if (items[acIndex]) inputEl.value = items[acIndex].dataset.name;
  } else if (e.key === 'Escape') {
    acListEl.innerHTML = '';
  }
});

inputEl.addEventListener('blur', () => {
  // Let a tap on a suggestion land first
  setTimeout(() => { acListEl.innerHTML = ''; layout(); }, 150);
});
inputEl.addEventListener('focus', () => setTimeout(layout, 50));

// ============================================================
// Shake animation
// ============================================================
function shake(el) {
  el.classList.remove('shake');
  void el.offsetWidth; // restart the animation
  el.classList.add('shake');
}

// ============================================================
// Theme toggle — follows the system until the player picks one
// ============================================================
function updateThemeChrome() {
  const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
  document.querySelector('meta[name="theme-color"]').setAttribute('content', bg || '#0c0c0d');
  _gradKey = '';
  dirty = true;
}

(function initTheme() {
  let saved = null;
  try { saved = localStorage.getItem(THEME_KEY); } catch {}
  if (saved === 'light' || saved === 'dark') root.dataset.theme = saved;
  updateThemeChrome();
})();

$('theme-btn').addEventListener('click', () => {
  const next = isLightTheme() ? 'dark' : 'light';
  root.dataset.theme = next;
  try { localStorage.setItem(THEME_KEY, next); } catch {}
  updateThemeChrome();
});
systemLight.addEventListener('change', updateThemeChrome);

// ============================================================
// Installable app
// ============================================================
const installBtn = $('home-install-btn');
let installPrompt = null; // Chrome / Edge / Android: the deferred install prompt

const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
              (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  installPrompt = e;
  installBtn.hidden = false;
  if (!homeScreen.hidden) renderBanner();
});
window.addEventListener('appinstalled', () => {
  track('app_installed');
  installPrompt = null;
  installBtn.hidden = true;
  if (!homeScreen.hidden) renderBanner();
});

installBtn.addEventListener('click', async () => {
  if (installPrompt) {
    track('install_click', { prompt: true });
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    track('install_prompt', { outcome });
    if (outcome === 'accepted') installBtn.hidden = true;
    installPrompt = null;
  } else {
    track('install_click', { prompt: false });
    $('install-dialog').showModal();
  }
});
$('install-close-btn').addEventListener('click', () => $('install-dialog').close());

// ============================================================
// Home banner: one tip at a time (rotating by day when there are several), so it never nags.
// Not on a first visit. X hides a banner for 7, then 14, then 21 days;
// after the third X it's gone for good, and nothing replaces it that day.
// ============================================================
const BANNER_KEY = 'pancake_banners';   // { day, id, rest, snooze: {id: ts}, dismissed: {id: n} }
const BANNERS = {
  install: {
    icon: '📲', title: t('Never miss a Daily'),
    body: t('Put Borderline on your home screen. One tap, full screen, works offline.'),
    cta: t('Install'),
    eligible: () => !installBtn.hidden,              // shown only when installing is possible here
    act: () => installBtn.click(),
  },
};

function bannerState() {
  try { return JSON.parse(localStorage.getItem(BANNER_KEY)) || {}; } catch { return {}; }
}
function saveBannerState(st) {
  try { localStorage.setItem(BANNER_KEY, JSON.stringify(st)); } catch {}
}

function renderBanner() {
  const el = $('home-banner');
  const st = bannerState();
  const today = utcDay();
  const now = Date.now();
  const ready = id => !!BANNERS[id] && BANNERS[id].eligible() && !((st.snooze || {})[id] > now);   // skips banners that no longer exist
  let id = null;
  if (loadStore().games.length && st.rest !== today) {               // rest = the day an X was tapped
    if (st.day === today && st.id && ready(st.id)) id = st.id;       // keep today's pick all day
    else {
      // A new day alternates with yesterday's pick; a pick is only saved once one qualifies
      const options = Object.keys(BANNERS).filter(ready);
      id = options.find(x => st.day === today || x !== st.id) || options[0] || null;
      if (id) { Object.assign(st, { day: today, id }); saveBannerState(st); }
    }
  }
  el.hidden = !id;
  if (!id) return;
  const b = BANNERS[id];
  if (el.dataset.id !== id) track('banner_shown', { banner: id });
  el.dataset.id = id;
  $('hb-icon').textContent  = b.icon;
  $('hb-title').textContent = b.title;
  $('hb-body').textContent  = b.body;
  $('hb-cta').textContent   = b.cta;
}

$('hb-cta').addEventListener('click', () => {
  const id = $('home-banner').dataset.id;
  track('banner_click', { banner: id });
  BANNERS[id].act();
});
$('hb-close').addEventListener('click', () => {
  const id = $('home-banner').dataset.id;
  const st = bannerState();
  st.dismissed = { ...st.dismissed, [id]: ((st.dismissed || {})[id] || 0) + 1 };
  const n = st.dismissed[id];
  st.snooze = { ...st.snooze, [id]: n >= 3 ? Number.MAX_SAFE_INTEGER : Date.now() + n * 7 * 86400000 };
  st.rest = utcDay();      // no swap-in today
  saveBannerState(st);
  track('banner_dismiss', { banner: id, times: n });
  $('home-banner').hidden = true;
  delete $('home-banner').dataset.id;
});

// "Dare a friend": today's result when there is one, otherwise an open challenge
async function challengeFriend() {
  const done = getDailyResult();
  const text = done && done.won
    ? `I found today’s ${APP_NAME} mystery country in ${done.guessCount} guess${done.guessCount === 1 ? '' : 'es'}. Bet you can’t beat that 😏`
    : `Bet you can’t find today’s ${APP_NAME} mystery country faster than me 😏`;
  const url = shareUrl('duel');
  if (navigator.share) {
    try { await navigator.share({ text, url }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  copyText(`${text}\n${url}`);
}

function initInstall() {
  const secure = location.protocol === 'https:' || location.hostname === 'localhost';
  if ('serviceWorker' in navigator && secure) {
    navigator.serviceWorker.register('sw.js').catch(e => console.warn('Service worker:', e));
  }
  // Safari has no install prompt; the button shows the steps instead
  if (isIOS && !isStandalone()) installBtn.hidden = false;
}

// ============================================================
// Boot
// ============================================================
function boot() {
  rescoreOldGames();   // once: old Dailies onto the new points
  layout();
  animate();
  showScreen('home');
  Story.init();
  Rooms.init();
  renderAccount();
  initCloud();
  initInstall();

  let seenHelp = false;
  try { seenHelp = !!localStorage.getItem(SEEN_HELP_KEY); } catch {}
  // First visit: a name for the leaderboard first (it can't be skipped; offline it's kept
  // and saved once the cloud is ready), then straight into today's Daily with
  // the starter picks and coached first guesses. "How to play" is one tap away on the ?.
  const tvView = new URLSearchParams(location.search).has('tv');   // the game-night TV scoreboard
  // Someone arriving on a room invite gets no intro; the room asks for a name itself.
  let roomInvite = false;
  try { roomInvite = !!sessionStorage.getItem('pancake_room_invite'); } catch {}
  if (!seenHelp && !tvView) {
    const seen = () => { try { localStorage.setItem(SEEN_HELP_KEY, '1'); } catch {} };
    if (!loadStore().games.length) {
      Coach.begin();
      const play = () => { seen(); startGame('daily', loadCurrentGame('daily')); };
      if (roomInvite) play();
      else {
        try { localStorage.setItem(NAME_ASKED_KEY, '1'); } catch {}   // no second ask after the first game
        NameStep.ask(play, { kind: 'first' });   // a refresh before saving shows it again
      }
    } else seen();
  } else if (Coach.active() && loadCurrentGame('daily')) {
    startGame('daily', loadCurrentGame('daily')); // refreshed mid-walkthrough: straight back in
  }

  let referrer = '';
  try { referrer = document.referrer ? new URL(document.referrer).hostname : ''; } catch {}
  track('app_open', { referrer, first_visit: !seenHelp, games_played: loadStore().games.length,
                       load_ms: Math.round(performance.now()), ...LANDING });

  // Keep the Daily countdown on the home screen fresh
  setInterval(() => { if (!homeScreen.hidden) renderHome(); }, 60000);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
