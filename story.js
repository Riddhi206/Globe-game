// story.js — THE UNMAKING. The story-mode engine.
//
// M1 (this milestone): progress store, the home Story card, and the chapter
// select screen ("the map table"). No gameplay yet — see
// docs/story-mode/04-build-plan.md for what each later milestone adds.
//
// Reads STORY from story-data.js and shares game.js's/store.js's top-level
// scope (readJSON, writeJSON, utcDay, nextDailyAt, formatCountdown,
// getDailyResult, track, showScreen, showToast — all defined elsewhere,
// loaded before this file per the script order in index.html).

const STORY_PROGRESS_KEY = 'pancake_story_v1';

// ============================================================
// Progress store (spec §4)
// ============================================================
function defaultStoryProgress() {
  const chapters = {};
  for (const ch of STORY.chapters) {
    chapters[ch.n] = {
      status:      ch.n <= 3 ? 'available' : 'locked',
      bestSaved:   null,
      stars:       0,
      inkStars:    0,
      completedAt: null,
      run:         null,
    };
  }
  return {
    version: 1,
    seenColdOpen: false,
    soundOn: false,
    soundAsked: false,                // the opt-in prompt has been answered
    chapters,
    postcards: [],
    choice: null,
    choiceSubmitted: false,
    secretFound: false,
    scarHidden: false,
    homeCountry: null,
    dailyUnlockDay: null,
  };
}

let _storyProgress = null;

function loadStoryProgress() {
  if (_storyProgress) return _storyProgress;
  const saved = readJSON(STORY_PROGRESS_KEY);
  // Must have every chapter this build knows about, or a stale/corrupt save
  // (e.g. from before a chapter was added) falls back to fresh defaults.
  const valid = saved && saved.version === 1 && saved.chapters &&
    STORY.chapters.every(ch => saved.chapters[ch.n]);
  _storyProgress = valid ? saved : defaultStoryProgress();
  return _storyProgress;
}

function saveStoryProgress() {
  writeJSON(STORY_PROGRESS_KEY, loadStoryProgress());
  queueStorySync();
}

// Chapters 1–3 are always open. Chapter n (4–7) opens once n-1 is done AND
// either a new UTC day has started since, or today's Daily has been played
// since n-1 finished (spec §5).
function isChapterUnlocked(n, p) {
  if (n <= 3) return true;
  const prev = p.chapters[n - 1];
  if (!prev || prev.status !== 'done') return false;
  const doneDay = utcDay(new Date(prev.completedAt));
  if (doneDay < utcDay()) return true;
  const daily = getDailyResult();
  return !!(daily && daily.ts > prev.completedAt);
}

// Promote any 'locked' chapter whose unlock condition now holds. Called on
// init and every time the chapter list is about to be shown, since a UTC
// day can turn over, or a Daily can be finished, while the player is away.
function refreshStoryUnlocks(p) {
  let changed = false;
  for (const ch of STORY.chapters) {
    const c = p.chapters[ch.n];
    if (c.status === 'locked' && isChapterUnlocked(ch.n, p)) {
      c.status = 'available';
      changed = true;
      // Same UTC day as the previous chapter's finish => it was the Daily that lit the Lamp
      const prev = p.chapters[ch.n - 1];
      if (prev && prev.completedAt && utcDay(new Date(prev.completedAt)) >= utcDay()) {
        p.dailyUnlockDay = utcDay();
        track('story_unlock_daily', { chapter: ch.n });
      }
    }
  }
  return changed;
}

function highestUnlockedChapter(p) {
  let n = 0;
  for (const ch of STORY.chapters) if (p.chapters[ch.n].status !== 'locked') n = ch.n;
  return n;
}

function storyChaptersDone(p) {
  return STORY.chapters.filter(ch => p.chapters[ch.n].status === 'done').length;
}

function storyAverageSaved(p) {
  const vals = STORY.chapters.map(ch => p.chapters[ch.n].bestSaved).filter(v => v != null);
  if (!vals.length) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

// Minimal token filler for now — just what the locked-chapter countdown
// line needs. M4 adds the full {name}/{time}/{games}/{saved}/{home} set for
// dialogue on top of this same function (same signature, spec §9).
function fillTokens(text, extra = {}) {
  return text.replace(/\{(\w+)\}/g, (m, key) => (key in extra ? extra[key] : m));
}

// "Tick" -> "T██k": first and last character kept, everything between
// blocked — one block per character, matching the example in the design doc.
function redactTitle(title) {
  if (title.length <= 2) return title;
  return title[0] + '█'.repeat(title.length - 2) + title[title.length - 1];
}

function starsText(n) {
  return '★'.repeat(n) + '☆'.repeat(3 - n);
}

// Full token set for dialogue (spec §9) — the locked-chapter countdown line
// only ever needs {countdown}, so it goes through fillTokens() directly.
function storyTokens(extra = {}) {
  const chapter = activeChapterDef();
  return {
    name:  (typeof cloudUsername !== 'undefined' && cloudUsername) || 'Lampbearer',
    time:  new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
    games: loadStore().games.length,
    saved: currentWorldSaved() + '%',
    blot:  chapter ? chapter.blot : '',
    home:  loadStoryProgress().homeCountry || '',
    ...extra,
  };
}

// ============================================================
// Home Story card
// ============================================================
function renderStoryHomeCard() {
  const badge = document.getElementById('story-badge');
  const desc  = document.getElementById('story-desc');
  if (!badge || !desc) return; // card not in the DOM yet (shouldn't happen)
  // Beta: only roles with the 'story' switch see it (008_roles.sql)
  const p = loadStoryProgress();
  // …and, like Rooms, not for a new player until they've settled in (game.js settledPlayer), unless they've begun it
  document.getElementById('story-card').hidden = !hasFeature('story') || (!p.seenColdOpen && typeof settledPlayer === 'function' && !settledPlayer());

  badge.hidden = p.seenColdOpen;
  const mini = document.getElementById('story-needle-mini');
  if (mini) mini.hidden = p.choice !== 'keep';

  const done = storyChaptersDone(p);
  if (done === 0) {
    desc.textContent = STORY.subtitle;
  } else {
    const avg = storyAverageSaved(p);
    const next = Math.min(done + 1, STORY.chapters.length);
    desc.textContent = `Chapter ${next} of ${STORY.chapters.length}` +
      (avg != null ? ` · ${avg}% of the world saved` : '');
  }
}

// ============================================================
// Chapter select screen
// ============================================================
function renderStoryChapterList() {
  const list = document.getElementById('story-chapters-list');
  if (!list) return;
  const p = loadStoryProgress();
  list.innerHTML = '';
  const journalBtn = document.getElementById('story-journal-btn');
  if (journalBtn) journalBtn.hidden = p.postcards.length === 0;

  for (const ch of STORY.chapters) {
    const c = p.chapters[ch.n];
    const locked = c.status === 'locked';

    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'story-chapter-tile';
    btn.disabled = locked;
    btn.dataset.chapter = ch.n;

    const num = document.createElement('span');
    num.className = 'sct-num';
    num.textContent = ch.n;
    num.setAttribute('aria-hidden', 'true');

    const body = document.createElement('span');
    body.className = 'sct-body';

    const title = document.createElement('span');
    title.className = 'sct-title';
    title.textContent = locked ? `Chapter ${ch.n}: ${redactTitle(ch.title)}` : `Chapter ${ch.n}: ${ch.title}`;

    const sub = document.createElement('span');
    sub.className = 'sct-sub';
    if (locked && p.chapters[ch.n - 1]?.status !== 'done') {
      sub.textContent = `Finish chapter ${ch.n - 1} to unlock`;
    } else if (locked) {
      const countdown = formatCountdown(nextDailyAt() - Date.now());
      sub.textContent = fillTokens(STORY.ui.lockedDaily, { countdown });
    } else if (c.status === 'done') {
      sub.textContent = `${c.bestSaved}% of the world saved`;
    } else if (c.status === 'in_progress' && c.run) {
      const n = c.run.guesses.length;
      sub.textContent = `In progress · ${n} guess${n === 1 ? '' : 'es'}`;
    } else {
      sub.textContent = ch.recap;
    }

    body.append(title, sub);

    const stars = document.createElement('span');
    stars.className = 'sct-stars';
    stars.setAttribute('aria-label', `${c.stars} of 3 stars`);
    // Built as separate spans (not one ★☆☆ string) so filled and empty
    // stars can get genuinely different colors — at this size, an outline
    // ☆ in the same amber as a filled ★ barely reads as "empty".
    for (let i = 0; i < 3; i++) {
      const star = document.createElement('span');
      star.className = i < c.stars ? 'sct-star on' : 'sct-star off';
      star.textContent = '★';
      star.setAttribute('aria-hidden', 'true');
      stars.appendChild(star);
    }

    btn.append(num, body, stars);
    btn.addEventListener('click', () => { if (!locked) startStoryChapter(ch.n); });

    li.appendChild(btn);
    list.appendChild(li);
  }
}

// ============================================================
// Area precompute (spec §6) — once, in Story.init(). A planar shoelace
// area on raw [lon, lat] rings, shrinking longitude toward the poles so
// high-latitude countries aren't overweighted. Not literally equal-area,
// but plenty accurate for a percentage.
// ============================================================
let AREA = null;        // Map<countryName, area>
let TOTAL_AREA = 0;

function ringArea(ring) {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x1, y1] = ring[j], [x2, y2] = ring[i];
    const k = Math.cos(((y1 + y2) / 2) * Math.PI / 180);
    a += (x1 * k) * y2 - (x2 * k) * y1;
  }
  return Math.abs(a / 2);
}

function computeStoryAreas() {
  if (AREA) return;
  AREA = new Map();
  TOTAL_AREA = 0;
  for (const c of COUNTRIES) {
    if (c.name === 'Antarctica') continue; // not in COUNTRIES, but guard anyway — never the dominant slice
    const rings = getCountryRings(c.name);
    if (!rings) continue;                   // e.g. Tuvalu currently has no shape; negligible real-world area
    const a = rings.reduce((sum, ring) => sum + ringArea(ring), 0);
    AREA.set(c.name, a);
    TOTAL_AREA += a;
  }
}

// ============================================================
// The ink (spec §7, 03-animation-audio.md §5.1)
// ============================================================
const INK_ERASE_MS   = 700;
const INK_RESTORE_MS = 500;
const INK_DRIP_MS     = 900;
const PITY_LEAK_KM    = 3000;

let erasedMap     = new Map(); // countryName -> { start, restoreStart: ms|null }
let _lastWorldSaved = 100;

function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

function erasedAreaSum() {
  computeStoryAreas();
  let sum = 0;
  // the guess the Shadow ate (ch 1) is a story beat, not a penalty
  for (const name of erasedMap.keys()) if (name !== _eaten) sum += AREA.get(name) || 0;
  return sum;
}

// Rounded to one decimal, per spec §6
function currentWorldSaved() {
  if (!TOTAL_AREA) return 100;
  return Math.round((1 - erasedAreaSum() / TOTAL_AREA) * 1000) / 10;
}

function activeChapterDef() {
  return STORY.chapters.find(ch => ch.n === _activeChapterN) || null;
}

// There's only ever one correct guess (the last one) — so "misses so far"
// is simply every guess made while the chapter is still unsolved.
function missesSoFar() { return guesses.length; }

function pickErasureVictims(targetArea) {
  computeStoryAreas();
  const chapter = activeChapterDef();
  if (!chapter) return [];
  const guessedNames = new Set(guesses.map(g => g.country.name));
  const neighbours   = ADJACENCY[mystery.name] || [];
  const protect      = new Set([mystery.name, ...neighbours]);
  const inPity        = missesSoFar() >= chapter.pityAfter;

  let pool;
  if (inPity) {
    // The ink bleeds toward its source: only the mystery's neighbours —
    // or, for an island mystery with none (e.g. New Zealand), the nearest
    // countries by distance instead.
    pool = neighbours.filter(n => AREA.has(n));
    if (!pool.length) {
      pool = COUNTRIES
        .filter(c => c.name !== mystery.name && AREA.has(c.name))
        .sort((a, b) => haversine(mystery.lat, mystery.lon, a.lat, a.lon) - haversine(mystery.lat, mystery.lon, b.lat, b.lon))
        .slice(0, 6)
        .map(c => c.name);
    }
  } else {
    // Before the pity threshold the ink must not leak the mystery's
    // location: never its neighbours, never anything close to it.
    pool = COUNTRIES
      .filter(c => AREA.has(c.name) && !protect.has(c.name) &&
                   haversine(mystery.lat, mystery.lon, c.lat, c.lon) > PITY_LEAK_KM)
      .map(c => c.name);
  }

  pool = pool.filter(n => !erasedMap.has(n) && !guessedNames.has(n));
  if (!pool.length) return [];

  // Prefer candidates currently facing the camera, so the player sees it
  // happen rather than finding out from the % alone.
  const visible = pool.filter(n => { const geo = getCountryGeo(n); return geo && maybeVisible(geo); });
  const ordered = (visible.length ? visible : pool).slice();
  for (let i = ordered.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
  }

  // Fill up to the target without overshooting it much: skip a country that
  // would take the total past 125% (a random Russia would otherwise cost one
  // miss 11% of the world). Stop once within 90%. If every candidate is
  // bigger than that, take the smallest one.
  const picked = [];
  let acc = 0;
  for (const name of ordered) {
    const a = AREA.get(name) || 0;
    if (acc + a > targetArea * 1.25) continue;
    picked.push(name);
    acc += a;
    if (acc >= targetArea * 0.9) break;
  }
  if (!picked.length) picked.push(ordered.reduce((m, n) => ((AREA.get(n) || 0) < (AREA.get(m) || 0) ? n : m), ordered[0]));
  return picked;
}

function eraseCountries(names) {
  if (!names.length) return;
  const now = performance.now();
  for (const name of names) if (!erasedMap.has(name)) erasedMap.set(name, { start: now, restoreStart: null });
  dirty = true;
}

// A correct trivia answer restores whichever still-erased country was
// inked most recently (spec §7).
function restoreMostRecentErased() {
  let name = null, latest = -Infinity;
  for (const [n, e] of erasedMap) {
    if (!e.restoreStart && e.start > latest) { latest = e.start; name = n; }
  }
  if (!name) return null;
  erasedMap.get(name).restoreStart = performance.now();
  dirty = true;
  return name;
}

function resetErasure() {
  erasedMap = new Map();
  _lastWorldSaved = 100;
}

// Resuming: show previously-erased countries already fully settled (no
// re-fading-in), not replayed from scratch — erasure picks are random, so
// replaying the guesses again would erase different countries than before.
function restoreErasureFromRun(names) {
  computeStoryAreas();   // normally done in Story.init; a no-op after the first call
  erasedMap = new Map();
  const settled = performance.now() - INK_ERASE_MS - INK_DRIP_MS - 1;
  for (const name of names || []) if (AREA.has(name)) erasedMap.set(name, { start: settled, restoreStart: null });
  _lastWorldSaved = currentWorldSaved();
}

// --- drawing (called from game.js's drawAllLand/drawGlobe hooks) ---

let _inkPattern = null, _inkPatternKey = '';
function getInkPattern() {
  const inkColor = getComputedStyle(document.documentElement).getPropertyValue('--story-ink').trim();
  if (_inkPattern && _inkPatternKey === inkColor) return _inkPattern;
  _inkPatternKey = inkColor;
  const size = 64;
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = inkColor; g.fillRect(0, 0, size, size);
  const n = parseInt(inkColor.replace('#', ''), 16);
  const [r0, g0, b0] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  for (let i = 0; i < 300; i++) {
    const amt = 0.04 + Math.random() * 0.06;
    const r = Math.min(255, Math.round(r0 + (255 - r0) * amt));
    const gg = Math.min(255, Math.round(g0 + (255 - g0) * amt));
    const b = Math.min(255, Math.round(b0 + (255 - b0) * amt));
    g.beginPath();
    g.arc(Math.random() * size, Math.random() * size, 0.5 + Math.random() * 1, 0, Math.PI * 2);
    g.fillStyle = `rgb(${r},${gg},${b})`;
    g.fill();
  }
  _inkPattern = ctx.createPattern(c, 'repeat');
  return _inkPattern;
}

// Small deterministic "random" per country+index, so drips don't reshuffle
// every single frame (no Math.random() in the per-frame draw path).
function dripHash(name, i) {
  let h = i * 7919;
  for (let k = 0; k < name.length; k++) h = (h * 31 + name.charCodeAt(k)) | 0;
  return Math.abs(h);
}

function drawStoryInk(ctxArg, pal) {
  if (!erasedMap.size) return;
  const now = performance.now();
  const pattern = getInkPattern();
  const fogged  = new Set(fogHiddenGeos());
  for (const [name, e] of [...erasedMap]) {
    if (name === _eaten) continue;          // drawn on top of its guess colour, in drawEatenInk()
    drawInkOne(ctxArg, name, e, now, pattern, fogged);
  }
}

// ch 1: the guess the Shadow ate is inked over its own heat colour
function drawEatenInk(ctxArg) {
  if (!_eaten || !erasedMap.has(_eaten)) return;
  drawInkOne(ctxArg, _eaten, erasedMap.get(_eaten), performance.now(), getInkPattern(), new Set(fogHiddenGeos()));
}

function drawInkOne(ctxArg, name, e, now, pattern, fogged) {
  {
    const geo = getCountryGeo(name);
    if (!geo) { erasedMap.delete(name); return; }

    let alpha;
    if (e.restoreStart != null) {
      // restoreStart can be a few ms in the FUTURE (the burn's restoration
      // wave staggers it per-country), so t is clamped at 0 too — otherwise
      // a negative t would push the eased alpha outside [0,1].
      const t = Math.max(0, (now - e.restoreStart) / INK_RESTORE_MS);
      if (t >= 1) { erasedMap.delete(name); return; }
      alpha = 1 - easeOutCubic(t);
    } else {
      alpha = easeOutCubic(Math.min(1, (now - e.start) / INK_ERASE_MS));
    }

    if (!maybeVisible(geo) || fogged.has(geo)) return; // still tracked, just not drawn this frame

    ctxArg.beginPath();
    let any = false;
    for (const ring of geo.rings) any = traceRing(ctxArg, ring) || any;
    if (!any) return;
    ctxArg.globalAlpha = alpha;
    ctxArg.fillStyle = pattern;
    ctxArg.fill();
    ctxArg.globalAlpha = 1;
    ctxArg.strokeStyle = 'rgba(0,0,0,.6)';
    ctxArg.lineWidth = 1.2;
    ctxArg.stroke();

    // Drips: a few dark dots near the country, growing and falling for a
    // moment right after it's erased (simplified from the full per-vertex
    // spec — see the M3 commit notes).
    if (e.restoreStart == null) {
      const age = now - e.start;
      if (age < INK_DRIP_MS) {
        const c = COUNTRIES.find(x => x.name === name);
        const pt = c && latLonToXY(c.lat, c.lon);
        if (pt) {
          const t = age / INK_DRIP_MS;
          for (let i = 0; i < 3; i++) {
            const seed = dripHash(name, i);
            const dx = (seed % 20) - 10;
            const dy = t * (4 + (seed % 4));
            ctxArg.beginPath();
            ctxArg.arc(pt.x + dx, pt.y + dy, Math.max(0.3, t * 3), 0, Math.PI * 2);
            ctxArg.fillStyle = `rgba(0,0,0,${(0.5 * (1 - t)).toFixed(3)})`;
            ctxArg.fill();
          }
        }
      }
    }
  }
}

function isStoryAnimating() {
  if (_blot || _burnFX || scarAnimating()) return true;
  // ch 3's equator breathes, so that chapter's hunt redraws continuously
  if (_activeChapterN && !gameOver && !_modLifted && !Story.reduced && chapterMod().type === 'fog') return true;
  if (!erasedMap.size) return false;
  const now = performance.now();
  for (const e of erasedMap.values()) {
    if (e.restoreStart != null) { if (now - e.restoreStart < INK_RESTORE_MS) return true; }
    else if (now - e.start < Math.max(INK_ERASE_MS, INK_DRIP_MS)) return true;
  }
  return false;
}

// ============================================================
// The Blot creature and the burn ceremony
// (03-animation-audio.md §5.2-5.7, spec §14)
// ============================================================
let _blot = null;    // { bornAt, poppedAt, squeeze, trait }
let _burnFX = null;  // { start, cx, cy, embers }

function spawnBlot(chapter) {
  _blot = { bornAt: performance.now(), poppedAt: null, squeeze: 0, trait: chapter.blot };
  dirty = true;
}
function popBlot() { if (_blot) _blot.poppedAt = performance.now(); dirty = true; }

function drawBlot(ctxArg) {
  if (!_blot) return;
  const pt = latLonToXY(mystery.lat, mystery.lon);
  if (!pt) return;
  const now = performance.now();

  let scale;
  if (_blot.poppedAt != null) {
    // 1 -> 1.3 -> 0 over 220ms; reduced motion just fades out in place.
    const t = (now - _blot.poppedAt) / 220;
    if (t >= 1) { _blot = null; return; }
    scale = Story.reduced ? 1 : (t < 0.5 ? 1 + 0.6 * (t / 0.5) : 1.3 * (1 - (t - 0.5) / 0.5));
  } else {
    const t = Math.min(1, (now - _blot.bornAt) / 520);
    scale = t < 0.75 ? easeOutCubic(t / 0.75) * 1.15 : 1.15 - 0.15 * ((t - 0.75) / 0.25);
  }
  scale *= 1 - _blot.squeeze * 0.08; // strains as the burn ring fills

  let { x, y } = pt;
  if (_blot.trait === 'Skitter' && _blot.poppedAt == null) {
    x += Math.sin(now / 90) * 1.2;
    y += Math.cos(now / 130) * 1.2;
  }

  const baseR = Math.max(14, Math.min(40, 18 * zoomScale)) * scale;
  const tsec  = now / 1000;
  const ink   = getComputedStyle(document.documentElement).getPropertyValue('--story-ink').trim();
  const popAlpha = _blot.poppedAt != null ? 1 - (now - _blot.poppedAt) / 220 : 1;

  // 12-point wobbling blob, per spec §5.2 — drawn with straight segments
  // rather than the literal quadraticCurveTo-through-midpoints construction
  // (visually indistinguishable at this radius, noticeably simpler code).
  const paintBody = (cx, cy, alpha) => {
    ctxArg.beginPath();
    const N = 12;
    for (let i = 0; i <= N; i++) {
      const ang = (i / N) * Math.PI * 2;
      const wob = 1 + 0.14 * Math.sin(tsec * 2.1 + i * 1.7) + 0.06 * Math.sin(tsec * 5.3 + i);
      const px = cx + Math.cos(ang) * baseR * wob;
      const py = cy + Math.sin(ang) * baseR * wob * 0.92;
      if (i === 0) ctxArg.moveTo(px, py); else ctxArg.lineTo(px, py);
    }
    ctxArg.closePath();
    ctxArg.globalAlpha = alpha;
    ctxArg.fillStyle = ink;
    ctxArg.fill();
    ctxArg.globalAlpha = 1;
  };

  if (_blot.trait === 'Echo' && _blot.poppedAt == null) paintBody(x + 4, y - 3, 0.3 * popAlpha);
  paintBody(x, y, (_blot.trait === 'Murk' ? 0.5 : 1) * popAlpha);

  if (_blot.poppedAt == null) {
    const blink = Math.sin(tsec * 1.3) > 0.985 ? 0.3 : 1;
    const mirrored = _blot.trait === 'Mirrorling' && Math.floor(tsec) % 2 === 0;
    const dx = baseR * 0.22 * (mirrored ? -1 : 1);
    const eyeY = (_blot.trait === 'Sulk') ? y - baseR * 0.08 : y - baseR * 0.18; // Sulk: droopy, half-lidded
    for (const side of [-1, 1]) {
      const ex = x + side * dx;
      ctxArg.beginPath();
      ctxArg.ellipse(ex, eyeY, 2.2, 2.6 * blink * (_blot.trait === 'Sulk' ? 0.6 : 1), 0, 0, Math.PI * 2);
      ctxArg.fillStyle = '#fff';
      ctxArg.fill();
      ctxArg.beginPath();
      ctxArg.arc(ex, eyeY, 1, 0, Math.PI * 2);
      ctxArg.fillStyle = '#000';
      ctxArg.fill();
    }
    if (_blot.trait === 'Tick') {
      const ang = tsec * 2;
      ctxArg.beginPath();
      ctxArg.moveTo(x, y + baseR * 0.3);
      ctxArg.lineTo(x + Math.cos(ang) * baseR * 0.25, y + baseR * 0.3 + Math.sin(ang) * baseR * 0.25);
      ctxArg.strokeStyle = '#fff';
      ctxArg.lineWidth = 1;
      ctxArg.stroke();
    }
  }
  dirty = true; // the Blot wobbles/blinks every frame while it's alive
}

function startBurnFX(cx, cy) {
  // 60 embers rather than the spec's 140 — plenty at this canvas size
  // (420x420 logical px) and a fraction of the per-frame cost.
  const embers = [];
  const N = 60;
  for (let i = 0; i < N; i++) {
    const ang = Math.random() * Math.PI * 2;
    const speed = 40 + Math.random() * 120;
    embers.push({
      vx: Math.cos(ang) * speed / 60,
      vy: Math.sin(ang) * speed / 60 - 1.5,
      life: 900 + Math.random() * 700,
      born: performance.now(),
      size: 1.5 + Math.random() * 1.5,
    });
  }
  _burnFX = { start: performance.now(), cx, cy, embers };
  dirty = true;
}

function emberColor(t) {
  if (t < 0.33) return '#fff2c7';
  if (t < 0.66) return getComputedStyle(document.documentElement).getPropertyValue('--story-lamp').trim();
  return '#6a6a6a';
}

function drawBurnFX(ctxArg) {
  if (!_burnFX) return;
  const now = performance.now();
  const age = now - _burnFX.start;

  if (age < 700) {
    const t = age / 700;
    const rad = easeOutCubic(t) * (view.R || 0) * 1.5;
    ctxArg.beginPath();
    ctxArg.arc(_burnFX.cx, _burnFX.cy, rad, 0, Math.PI * 2);
    ctxArg.strokeStyle = `rgba(255,179,71,${(0.9 * (1 - t)).toFixed(3)})`;
    ctxArg.lineWidth = 3 * (1 - t);
    ctxArg.stroke();
  }

  let alive = false;
  for (const e of _burnFX.embers) {
    const et = now - e.born;
    if (et > e.life) continue;
    alive = true;
    const t  = et / e.life;
    const x  = _burnFX.cx + e.vx * et / 16;
    const y  = _burnFX.cy + e.vy * et / 16 - t * 8;
    ctxArg.beginPath();
    ctxArg.arc(x, y, e.size * (1 - t * 0.4), 0, Math.PI * 2);
    ctxArg.globalAlpha = 1 - t;
    ctxArg.fillStyle = emberColor(t);
    ctxArg.fill();
    ctxArg.globalAlpha = 1;
  }

  if (age > 700 && !alive) _burnFX = null;
  dirty = true;
}

function easeInOutCubic(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

// Animates zoomScale toward `to`, driven by its own rAF loop (independent
// of animate()'s dirty-flag gate, since the zoom itself is what should keep
// forcing redraws here).
function animateZoom(to, ms) {
  const from = zoomScale, start = performance.now();
  (function step() {
    const t = Math.min(1, (performance.now() - start) / ms);
    setZoom(from + (to - from) * easeInOutCubic(t));
    dirty = true;
    if (t < 1) requestAnimationFrame(step);
  })();
}

// The ink drains outward from the Blot: each still-erased country's
// restoreStart is staggered by its screen-space angle from the Blot
// (03-animation-audio.md §5.4's "900 + 1400 × angle/π" — the 900 is simply
// *when* this function is called relative to the hold completing; the
// stagger itself is the 1400 × angle/π applied here).
function startRestorationWave(cx, cy) {
  const now = performance.now();
  const R = view.R || 1;
  for (const [name, e] of erasedMap) {
    if (e.restoreStart != null) continue;
    const c  = COUNTRIES.find(x => x.name === name);
    const pt = c && latLonToXY(c.lat, c.lon);
    let angle = Math.PI / 2; // off-screen countries restore at the midpoint
    if (pt) angle = Math.min(Math.PI, (Math.hypot(pt.x - cx, pt.y - cy) / R) * (Math.PI / 2));
    e.restoreStart = now + 1400 * (angle / Math.PI);
  }
  dirty = true;
}

// --- HOLD TO BURN (§5.4) ---
const BURN_HOLD_MS = 900;
let _burnActive = false, _burnHapticTimer = null, _burnCompleteTimer = null, _burnOnComplete = null;
let _burnTimers = []; // every setTimeout the ceremony schedules, so backing out mid-ceremony can cancel them all

function showBurnButton(onComplete) {
  _burnOnComplete = onComplete;
  const wrap = document.getElementById('story-burn');
  if (wrap) wrap.hidden = false;
}
function hideBurnButton() {
  const wrap = document.getElementById('story-burn');
  if (wrap) wrap.hidden = true;
}

function startHold() {
  if (_burnActive) return;
  _burnActive = true;
  const btn  = document.getElementById('story-burn-btn');
  const ring = document.querySelector('.story-burn-ring-fg');
  btn?.classList.add('holding');
  ring?.classList.add('charging');
  if (ring) ring.style.strokeDashoffset = '0';
  if (_blot) _blot.squeeze = 1;
  const label = document.querySelector('.story-burn-label');
  if (label && btn) { btn.dataset.idle = label.textContent; label.textContent = STORY.ui.keepHolding; }
  const hint = document.getElementById('story-burn-hint');
  if (hint) hint.hidden = true;
  const holdStart = performance.now();
  _burnHapticTimer = setInterval(() => {
    haptic(8);
    StoryAudio.charge(Math.min(1, (performance.now() - holdStart) / BURN_HOLD_MS));
  }, 200);
  StoryAudio.charge(0);
  clearTimeout(_burnCompleteTimer);
  _burnCompleteTimer = setTimeout(completeHold, BURN_HOLD_MS);
}

// Back to idle: ring empty, label back to what it said before the hold
function resetBurnButton() {
  const btn   = document.getElementById('story-burn-btn');
  const ring  = document.querySelector('.story-burn-ring-fg');
  const label = document.querySelector('.story-burn-label');
  btn?.classList.remove('holding');
  ring?.classList.remove('charging');
  if (ring) ring.style.strokeDashoffset = '289';
  if (label && btn && btn.dataset.idle) label.textContent = btn.dataset.idle;
  if (_blot) _blot.squeeze = 0;
}
function cancelHoldIfIncomplete() {
  if (!_burnActive) return;
  _burnActive = false;
  clearTimeout(_burnCompleteTimer);
  clearInterval(_burnHapticTimer);
  resetBurnButton();
  const hint = document.getElementById('story-burn-hint');
  if (hint) {
    hint.textContent = STORY.ui.burnHint;
    hint.hidden = false;
    clearTimeout(hint._t);
    hint._t = setTimeout(() => { hint.hidden = true; }, 2600);
  }
  track('story_burn_cancel', { chapter: _activeChapterN });
}
function completeHold() {
  _burnActive = false;
  clearInterval(_burnHapticTimer);
  hideBurnButton();
  resetBurnButton();   // ready for the next time it appears (next chapter, the ch 7 choice)
  const cb = _burnOnComplete;
  _burnOnComplete = null;
  if (cb) cb();
}

document.getElementById('story-burn-btn')?.addEventListener('pointerdown', e => { e.preventDefault(); startHold(); });
document.getElementById('story-burn-btn')?.addEventListener('pointerup', cancelHoldIfIncomplete);
document.getElementById('story-burn-btn')?.addEventListener('pointerleave', cancelHoldIfIncomplete);
document.getElementById('story-burn-btn')?.addEventListener('pointercancel', cancelHoldIfIncomplete);
document.getElementById('story-burn-btn')?.addEventListener('keydown', e => {
  if ((e.key === ' ' || e.key === 'Enter') && !_burnActive) { e.preventDefault(); startHold(); }
});
document.getElementById('story-burn-btn')?.addEventListener('keyup', e => {
  if (e.key === ' ' || e.key === 'Enter') cancelHoldIfIncomplete();
});

function cancelBurnSequence() {
  for (const t of _burnTimers) clearTimeout(t);
  _burnTimers = [];
  _blot = null;
  _burnFX = null;
  cancelHoldIfIncomplete();
  stopSpin();
  _scarBornAt = null;
  _eyeBornAt = null;
  restoreNeedlePortrait();
  for (const id of ['story-burn', 'story-flash', 'story-postcard', 'story-complete', 'story-choice', 'story-credits', 'story-end']) {
    const el = document.getElementById(id);
    if (el) el.hidden = true;
  }
  document.getElementById('globe-wrap')?.classList.remove('story-shake');
}

// The timeline in 03-animation-audio.md §5.4, ms from the hold completing.
function runBurnSequence(chapter, saved, stars, finish) {
  const blotPt = latLonToXY(mystery.lat, mystery.lon) || { x: CX, y: CY };
  const globeWrap = document.getElementById('globe-wrap');

  const flash = document.getElementById('story-flash');
  if (flash) {
    flash.hidden = false;
    _burnTimers.push(setTimeout(() => { flash.hidden = true; }, Story.reduced ? 200 : 300));
  }
  if (!Story.reduced) {
    startBurnFX(blotPt.x, blotPt.y);
    globeWrap?.classList.remove('story-shake');
    void globeWrap?.offsetWidth;
    globeWrap?.classList.add('story-shake');
  }
  haptic([30, 40, 80]);
  StoryAudio.burn();

  if (chapter.found && chapter.found[0]) {
    _burnTimers.push(setTimeout(() => showBark(chapter.found[0], storyTokens()), 150));
  }

  _burnTimers.push(setTimeout(popBlot, 600));

  _burnTimers.push(setTimeout(() => {
    startRestorationWave(blotPt.x, blotPt.y);
    StoryAudio.restore();
    animateZoom(1.6, 900);
    _modLifted = true; // ch 3's fog lifts, ch 6's map turns the right way round
    _fogCache = { key: null, geos: [] };
  }, 900));

  _burnTimers.push(setTimeout(() => {
    const lines = [...(chapter.afterBurn || []), ...(chapter.outro || [])];
    playLines(lines, { where: 'outro', onDone: () => {
      showPostcard(chapter, () => showChapterComplete(chapter, saved, stars, finish));
    }});
  }, 2600));
}

// --- Postcard (§5.6) ---
function showPostcard(chapter, onNext) {
  const country = resolveChapterCountry(chapter);
  const wrap   = document.getElementById('story-postcard');
  const flagEl = document.getElementById('story-postcard-flag');
  const nameEl = document.getElementById('story-postcard-name');
  const factsEl= document.getElementById('story-postcard-facts');
  const loreEl = document.getElementById('story-postcard-lore');
  const sealEl = document.getElementById('story-postcard-seal');
  const foilEl = document.getElementById('story-postcard-foil');
  if (!wrap) { onNext(); return; }

  flagEl.innerHTML = country ? flagHtml(country, 64) : '';
  nameEl.textContent = country?.name || '';
  const facts = (typeof countryFacts === 'function' && country) ? countryFacts(country.name) : null;
  factsEl.textContent = facts ? `🏙️ ${facts.capital || '—'} · 👥 ~${facts.population || '—'}` : '';
  loreEl.textContent = chapter.postcard?.lore || '';
  sealEl.textContent = chapter.letter || '';

  const foil = randomInt(20) === 0;
  foilEl.hidden = !foil;

  const p = loadStoryProgress();
  const existing = p.postcards.find(pc => pc.n === chapter.n);
  if (existing) existing.foil = existing.foil || foil;
  else p.postcards.push({ n: chapter.n, country: country?.name, foil });
  saveStoryProgress();

  wrap.hidden = false;
  const nextBtn = document.getElementById('story-postcard-next-btn');
  const handler = () => { wrap.hidden = true; nextBtn.removeEventListener('click', handler); onNext(); };
  nextBtn.addEventListener('click', handler);
}

// --- Chapter complete (§5.7) ---
function showChapterComplete(chapter, saved, stars, finish) {
  const el       = document.getElementById('story-complete');
  const starsWrap= document.getElementById('story-complete-stars');
  const savedEl  = document.getElementById('story-complete-saved');
  const titleEl  = document.getElementById('story-complete-title');
  const cliffEl  = document.getElementById('story-complete-cliffhanger');
  if (!el) { finish(); return; }

  el.hidden = false;
  const starEls = [...starsWrap.querySelectorAll('.story-star')];
  starEls.forEach(s => s.classList.remove('on', 'drop'));
  savedEl.textContent = '0% of the world saved';
  titleEl.textContent = `Chapter ${chapter.n}: ${chapter.title} — Shadow burned`;
  cliffEl.textContent = '';

  starEls.forEach((s, i) => {
    _burnTimers.push(setTimeout(() => {
      if (i < stars) s.classList.add('on');
      s.classList.add('drop');
      if (i < stars) StoryAudio.star(i);
    }, Story.reduced ? 0 : i * 200));
  });

  const countMs = Story.reduced ? 1 : 900;
  const start = performance.now();
  (function tick() {
    const t = Math.min(1, (performance.now() - start) / countMs);
    savedEl.textContent = `${Math.round(saved * t * 10) / 10}% of the world saved`;
    if (t < 1) requestAnimationFrame(tick);
  })();

  // ch 3 ends on a second, ghostly line: something repeating Needle
  const echoEl = document.getElementById('story-complete-echo');
  echoEl.hidden = true;
  const showEcho = () => {
    if (!chapter.cliffhangerEcho) return;
    _burnTimers.push(setTimeout(() => {
      echoEl.textContent = fillTokens(chapter.cliffhangerEcho.text, storyTokens());
      echoEl.hidden = false;
    }, Story.reduced ? 0 : 900));
  };
  if (chapter.cliffhanger) typeLine(cliffEl, fillTokens(chapter.cliffhanger.text, storyTokens()), { onDone: showEcho });

  const shareBtn    = document.getElementById('story-complete-share-btn');
  const continueBtn = document.getElementById('story-complete-continue-btn');
  const nextBtn     = document.getElementById('story-complete-next-btn');
  const nextEl      = document.getElementById('story-complete-next');

  // What's next (the cliffhanger is the craving; this is where it goes):
  //   next chapter open       -> "Chapter N →" straight in
  //   locked, Daily unplayed  -> when it opens + "Play today's Daily" (which opens it early)
  //   locked, Daily done      -> just when it opens
  const nextN = chapter.n + 1;
  const nextCh = STORY.chapters.find(c => c.n === nextN);
  const nextStatus = nextCh ? loadStoryProgress().chapters[nextN].status : null;
  let nextAction = null;
  nextEl.hidden = true;
  if (nextCh && nextStatus !== 'locked') {
    nextAction = 'next';
    nextBtn.textContent = `Chapter ${nextN} →`;
  } else if (nextCh) {
    const countdown = formatCountdown(nextDailyAt() - Date.now());
    if (!getDailyResult()) {
      nextAction = 'daily';
      nextBtn.textContent = 'Play today’s Daily';
      nextEl.textContent = `Chapter ${nextN}: ` + fillTokens(STORY.ui.lockedDaily, { countdown });
    } else {
      nextEl.textContent = `Chapter ${nextN} opens in ${countdown}.`;
    }
    nextEl.hidden = false;
  }
  nextBtn.hidden = !nextAction;
  continueBtn.textContent = nextAction ? 'Later' : STORY.ui.continue;
  continueBtn.classList.toggle('primary', !nextAction);

  const cleanup = () => {
    shareBtn.removeEventListener('click', onShare);
    continueBtn.removeEventListener('click', onContinue);
    nextBtn.removeEventListener('click', onNext);
    el.hidden = true;
  };
  const onShare = () => { track('story_share', { kind: 'chapter', chapter: chapter.n }); shareStoryChapter(chapter, saved, stars); };
  const onContinue = () => {
    cleanup();
    track('story_next', { chapter: chapter.n, action: 'later' });
    finish();
  };
  const onNext = () => {
    cleanup();
    track('story_next', { chapter: chapter.n, action: nextAction });
    finish();
    if (nextAction === 'next') startStoryChapter(nextN);
    else { Story.close(); chooseMode('daily'); }
  };
  shareBtn.addEventListener('click', onShare);
  continueBtn.addEventListener('click', onContinue);
  nextBtn.addEventListener('click', onNext);
}

// --- Sharing (spec §14) — spoiler-free: never the country name ---
function buildStoryShareText(chapter, saved, stars) {
  const squares = guesses.filter(g => !g.correct)
    .map(g => (typeof TEMP_ICON !== 'undefined' && TEMP_ICON[g.temp]) || '⬛').join('') + '🔥';
  return [
    `🗺️ THE UNMAKING · Chapter ${chapter.n} — ${chapter.title}`,
    `🌍 ${saved}% of the world saved · ${starsText(stars)}`,
    squares,
    'Can you burn it faster?',
    (typeof shareUrl === 'function') ? shareUrl('story') : '',
  ].filter(Boolean).join('\n');
}

async function buildStoryShareImage(chapter, saved, stars) {
  if (document.fonts && document.fonts.ready) await document.fonts.ready;
  const S = 1080;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const font = (w, px, family) => `${w} ${px}px ${family || 'Outfit, system-ui, sans-serif'}`;

  g.fillStyle = '#0b0a09';
  g.fillRect(0, 0, S, S);
  const glow = g.createRadialGradient(S / 2, S * 0.4, 50, S / 2, S * 0.4, S * 0.6);
  glow.addColorStop(0, 'rgba(255,179,71,.25)');
  glow.addColorStop(1, 'rgba(255,179,71,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, S, S);

  g.textAlign = 'center';
  g.fillStyle = '#ffb347';
  g.font = font(700, 40);
  g.fillText('THE UNMAKING', S / 2, 220);

  g.fillStyle = '#f3ecdd';
  g.font = font(400, 80, "'IM Fell English', Georgia, serif");
  g.fillText(`Chapter ${chapter.n} — ${chapter.title}`, S / 2, 340);

  g.font = font(800, 140);
  g.fillText(`${saved}%`, S / 2, 560);
  g.fillStyle = '#cbbfa8';
  g.font = font(600, 40);
  g.fillText('of the world saved', S / 2, 620);

  g.font = '72px sans-serif';
  g.fillText(starsText(stars), S / 2, 740);

  const url = (typeof shareUrl === 'function') ? shareUrl().replace(/^https?:\/\//, '').replace(/\/$/, '') : '';
  if (url) {
    g.fillStyle = '#6a6a70';
    g.font = font(600, 36);
    g.fillText(url, S / 2, 1000);
  }

  return new Promise(resolve => c.toBlob(resolve, 'image/png'));
}

async function shareStoryChapter(chapter, saved, stars) {
  const text = buildStoryShareText(chapter, saved, stars);
  if (navigator.share) {
    try {
      const blob = await buildStoryShareImage(chapter, saved, stars);
      const file = blob && new File([blob], `unmaking-ch${chapter.n}.png`, { type: 'image/png' });
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], text });
      else await navigator.share({ text });
      return;
    } catch (err) { if (err.name === 'AbortError') return; }
  }
  try { await navigator.clipboard.writeText(text); showToast('Copied to clipboard'); }
  catch { showToast('Could not copy — long-press to select instead'); }
}

// ============================================================
// Chapter modifiers (spec §8) — per-run state, persisted in run
// ============================================================
let _jumped = false;        // ch 2: the Blot has moved to its real country
let _elapsed = 0;           // ch 5: seconds on the clock
let _riddlesShown = 0;      // ch 4
let _modLifted = false;     // ch 3 fog / ch 6 mirror end when the Blot burns
let _fogCache = { key: null, geos: [] };
let EQUATOR = null;

function chapterMod() {
  const ch = activeChapterDef();
  return (ch && ch.modifier) || { type: 'none' };
}

// §7: haptics only when sound ("effects") is on, and never under reduced motion
function haptic(pattern) {
  if (!navigator.vibrate || Story.reduced || !loadStoryProgress().soundOn) return;
  navigator.vibrate(pattern);
}

// --- jump (ch 2) ---
function shouldJump(country) {
  const m = chapterMod();
  if (m.type !== 'jump' || _jumped) return false;
  const start = COUNTRIES.find(c => c.name === m.startCountry);
  if (!start) return false;
  return country.name === start.name ||
    (ADJACENCY[start.name] || []).includes(country.name) ||
    haversine(start.lat, start.lon, country.lat, country.lon) < 1500;
}

// Moves the mystery and re-scores every guess against it (spec §8).
function doJump(chapter) {
  _jumped = true;
  mystery = COUNTRIES.find(c => c.name === chapter.country);
  historyEl.innerHTML = '';
  prevDistKm = null;
  guesses.forEach((g, i) => {
    g.distKm  = haversine(mystery.lat, mystery.lon, g.country.lat, g.country.lon);
    g.correct = g.country.name === mystery.name;
    g.temp    = g.correct ? 'correct' : classify(Math.round(g.distKm), g.country.name);
    addHistoryItem(g, i + 1);
    if (!g.correct && g.temp !== 'adjacent') prevDistKm = g.distKm;
  });
  // addHistoryItem prepends, so the newest row is first; stagger from the top
  [...historyEl.children].forEach((li, i) => {
    li.style.animationDelay = `${i * 60}ms`;
    li.classList.add('reheat');
  });
  trendEl.hidden = true;
  _sortCacheSize = -1;
  dirty = true;
  haptic([20, 30, 20, 30, 20]);
  track('story_jump', { chapter: chapter.n, guesses: guesses.length });
}

// --- fog (ch 3) ---
function unitVec(lat, lon) {
  const phi = lat * Math.PI / 180, lam = lon * Math.PI / 180, c = Math.cos(phi);
  return [c * Math.cos(lam), c * Math.sin(lam), Math.sin(phi)];
}

function fogHiddenGeos() {
  const m = chapterMod();
  if (m.type !== 'fog' || _modLifted) return [];
  const key = guesses.map(g => g.country.name).join('|');
  if (_fogCache.key === key) return _fogCache.geos;
  const cosR = Math.cos(m.revealKm / 6371);
  const pts = guesses.map(g => unitVec(g.country.lat, g.country.lon));
  const out = [];
  for (const geo of GEO.values()) {
    if (!pts.some(p => geo.cx * p[0] + geo.cy * p[1] + geo.cz * p[2] >= cosR)) out.push(geo);
  }
  _fogCache = { key, geos: out };
  return out;
}

function drawEquator(ctxArg) {
  const m = chapterMod();
  if (m.type !== 'fog' || !m.equatorGlow || _modLifted) return;
  if (!EQUATOR) {
    const pts = [];
    for (let lon = -180; lon <= 180; lon += 2) pts.push([lon, 0]);
    EQUATOR = toUnitVectors(pts);
  }
  const breathe = Story.reduced ? 0.38 : 0.25 + 0.25 * (0.5 + 0.5 * Math.sin(performance.now() / 700));
  ctxArg.beginPath();
  traceOpenLine(ctxArg, EQUATOR);
  ctxArg.globalAlpha = breathe;
  ctxArg.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--story-lamp').trim();
  ctxArg.lineWidth = 2;
  ctxArg.stroke();
  ctxArg.globalAlpha = 1;
}

// --- riddles (ch 4) ---
function maybeRiddle() {
  const m = chapterMod();
  if (m.type !== 'riddles') return false;
  const r = m.riddles[_riddlesShown];
  if (!r || missesSoFar() < r.afterMisses) return false;
  _riddlesShown++;
  showBark({ who: 'echo', text: r.text }, storyTokens());
  renderRiddles();
  return true;
}

function renderRiddles() {
  const wrap = document.getElementById('story-riddles');
  const list = document.getElementById('story-riddles-list');
  if (!wrap || !list) return;
  const m = chapterMod();
  const shown = (m.type === 'riddles' && _activeChapterN) ? m.riddles.slice(0, _riddlesShown) : [];
  list.innerHTML = '';
  for (const r of shown) {
    const li = document.createElement('li');
    li.textContent = r.text;
    list.appendChild(li);
  }
  wrap.hidden = shown.length === 0;
}

// --- clock (ch 5) ---
let _clockTimer = null, _clockLast = 0, _clockTicks = 0;

function clockRunning() {
  if (!_activeChapterN || gameOver || _blot) return false;
  if (document.getElementById('game-screen').hidden || document.hidden) return false;
  if (_comms) return false;
  if (!document.getElementById('story-varka').hidden) return false;
  if (document.querySelector('dialog[open]')) return false; // trivia, username, …
  return true;
}

function startClock() {
  stopClock();
  const m = chapterMod();
  if (m.type !== 'clock') return;
  _clockTicks = Math.floor(_elapsed / m.everySeconds);
  _clockLast = performance.now();
  guessChip.classList.add('story-clock');
  _clockTimer = setInterval(clockTick, 250);
}

function stopClock() {
  clearInterval(_clockTimer);
  _clockTimer = null;
  guessChip.classList.remove('story-clock');
}

function clockTick() {
  const now = performance.now();
  const dt = (now - _clockLast) / 1000;
  _clockLast = now;
  if (!clockRunning()) return;
  const m = chapterMod(), chapter = activeChapterDef();
  _elapsed += dt;
  guessChip.style.setProperty('--clock', ((_elapsed % m.everySeconds) / m.everySeconds).toFixed(3));

  const ticks = Math.floor(_elapsed / m.everySeconds);
  if (ticks > _clockTicks) {
    _clockTicks = ticks;
    eraseCountries(pickErasureVictims(m.inkPerTick * TOTAL_AREA));
    haptic(10);
    StoryAudio.heartbeat();
    Story.persist();
  }

  // Time-based hints and Varka lines (afterSeconds), keyed 's<seconds>'
  const v = (chapter.varka || []).find(l => l.afterSeconds && _elapsed >= l.afterSeconds && !_varkaShown.includes('s' + l.afterSeconds));
  if (v) { _varkaShown.push('s' + v.afterSeconds); varka(v, storyTokens()); return; }
  const h = (chapter.hints || []).find(l => l.afterSeconds && _elapsed >= l.afterSeconds && !_hintsShown.includes('s' + l.afterSeconds));
  if (h) { _hintsShown.push('s' + h.afterSeconds); showBark(h, storyTokens()); }
}

// ============================================================
// Chapter 7, the choice, the endings, the scar, the journal
// (spec §8 liar, §10; 03-animation-audio.md §5.5)
// ============================================================
const OPPOSITE = { N: 'S', NE: 'SW', E: 'W', SE: 'NW', S: 'N', SW: 'NE', W: 'E', NW: 'SE' };

// Detected once on-device and cached; used for dialogue and the target only,
// never sent anywhere (spec §1 rule 3).
function homeCountryName() {
  const p = loadStoryProgress();
  if (p.homeCountry && COUNTRIES.some(c => c.name === p.homeCountry)) return p.homeCountry;
  const r = detectHomeCountry(loadStore().games);
  p.homeCountry = (r && r.country && r.country.name) || null;
  saveStoryProgress();
  return p.homeCountry;
}

// --- globe-spin: the first time the globe turns on its own ---
let _spinning = false;
function startSpin() {
  if (Story.reduced || _spinning) return;
  _spinning = true;
  lerpActive = false;
  const t0 = performance.now();
  let last = t0;
  (function step(now) {
    if (!_spinning) return;
    const dt = (now - last) / 1000;
    last = now;
    const ease = Math.min(1, (now - t0) / 1500);
    globeLon = (globeLon + 6 * dt * ease) % 360;
    dirty = true;
    requestAnimationFrame(step);
  })(t0);
}
function stopSpin() { _spinning = false; }

// --- needle-shatter: the portrait cracks, then flies apart in 14 shards ---
function shatterNeedle(onDone) {
  const portrait = document.getElementById('story-comms-portrait');
  const svg = document.getElementById('story-comms-needle-svg');
  if (!portrait || !svg) { onDone(); return; }
  setNeedleMood(svg, 'glitch');
  haptic([60, 30, 120]);
  StoryAudio.glitch();
  if (Story.reduced) {
    svg.style.transition = 'opacity 300ms';
    svg.style.opacity = '0';
    setTimeout(onDone, 400);
    return;
  }
  setTimeout(() => {
    const N = 14;
    const glow = document.createElement('div');
    glow.className = 'story-shatter-glow';
    portrait.appendChild(glow);
    for (let i = 0; i < N; i++) {
      const a0 = (i / N) * Math.PI * 2, a1 = ((i + 1) / N) * Math.PI * 2;
      const pt = a => `${50 + 75 * Math.cos(a)}% ${50 + 75 * Math.sin(a)}%`;
      const shard = document.createElement('div');
      shard.className = 'story-shard';
      shard.style.clipPath = `polygon(50% 50%, ${pt(a0)}, ${pt(a1)})`;
      const copy = svg.cloneNode(true);
      copy.removeAttribute('id');
      shard.appendChild(copy);
      portrait.appendChild(shard);
      const mid = (a0 + a1) / 2, dist = 50 + Math.random() * 60;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        shard.style.transform = `translate(${Math.cos(mid) * dist}px, ${Math.sin(mid) * dist}px) rotate(${(Math.random() - 0.5) * 240}deg)`;
        shard.style.opacity = '0';
      }));
    }
    svg.style.visibility = 'hidden';
    StoryAudio.shatter();
    setTimeout(() => {
      portrait.querySelectorAll('.story-shard, .story-shatter-glow').forEach(el => el.remove());
      onDone();
    }, 950);
  }, 300);
}

function restoreNeedlePortrait() {
  const svg = document.getElementById('story-comms-needle-svg');
  if (svg) { svg.style.visibility = ''; svg.style.opacity = ''; svg.style.transition = ''; }
  document.querySelectorAll('.story-shard, .story-shatter-glow').forEach(el => el.remove());
}

// --- the scar at Point Nemo ("keep"), drawn in every mode ---
let _scarBornAt = null; // bleed-in start, only during the ending
let _eyeBornAt  = null; // eye-opens-point-nemo

function drawScar(ctxArg) {
  const p = loadStoryProgress();
  if (p.choice !== 'keep' || p.scarHidden) return;
  const pt = latLonToXY(STORY.pointNemo.lat, STORY.pointNemo.lon);
  if (!pt) return;
  const now = performance.now();
  const alpha = _scarBornAt ? Math.min(1, (now - _scarBornAt) / 1200) : 1;
  const r = 5 * zoomScale;
  ctxArg.beginPath();
  const lobes = 6, steps = 36;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const rr = r * (1 + 0.3 * Math.sin(a * lobes + 1.3) + 0.12 * Math.sin(a * 3 + 0.4));
    const x = pt.x + Math.cos(a) * rr, y = pt.y + Math.sin(a) * rr;
    if (i === 0) ctxArg.moveTo(x, y); else ctxArg.lineTo(x, y);
  }
  ctxArg.closePath();
  ctxArg.globalAlpha = alpha;
  ctxArg.fillStyle = '#0b0a09';
  ctxArg.fill();
  ctxArg.strokeStyle = 'rgba(255,179,71,.45)';
  ctxArg.lineWidth = 1;
  ctxArg.stroke();
  ctxArg.globalAlpha = 1;

  if (_eyeBornAt) {
    const t = now - _eyeBornAt;
    const open = Math.min(1, t / 900);
    const blink = (t > 2200 && t < 2340) ? 0.1 : 1;
    const ry = 9 * easeOutCubic(open) * blink;
    ctxArg.beginPath();
    ctxArg.ellipse(pt.x, pt.y, 14, Math.max(0.5, ry), 0, 0, Math.PI * 2);
    ctxArg.fillStyle = '#f3ecdd';
    ctxArg.fill();
    // pupil drifts toward the centre of the screen — toward the player
    const dx = CX - pt.x, dy = CY - pt.y, d = Math.hypot(dx, dy) || 1;
    ctxArg.beginPath();
    ctxArg.arc(pt.x + (dx / d) * 5, pt.y + (dy / d) * Math.min(3, ry / 3), Math.min(4, ry * 0.6), 0, Math.PI * 2);
    ctxArg.fillStyle = '#7a1f1f';
    ctxArg.fill();
  }
}

function scarAnimating() {
  const now = performance.now();
  return !!_eyeBornAt || (_scarBornAt != null && now - _scarBornAt < 1200);
}

// --- the choice ---
function showChoice(onChoose) {
  const panel = document.getElementById('story-choice');
  const hint  = document.getElementById('story-choice-hint');
  const keep  = document.getElementById('story-keep-btn');
  const burnWrap = document.getElementById('story-burn');
  const label = document.querySelector('.story-burn-label');
  hint.textContent = `${STORY.choice.breakLabel} — ${STORY.choice.breakHint.toLowerCase()}`;
  keep.textContent = STORY.choice.keepLabel;
  label.textContent = STORY.choice.breakLabel;
  burnWrap.classList.add('choice');
  panel.hidden = false;
  const done = choice => {
    keep.removeEventListener('click', onKeep);
    panel.hidden = true;
    burnWrap.classList.remove('choice');
    label.textContent = STORY.ui.holdToBurn;
    onChoose(choice);
  };
  const onKeep = () => { _burnOnComplete = null; cancelHoldIfIncomplete(); hideBurnButton(); done('keep'); };
  keep.addEventListener('click', onKeep);
  showBurnButton(() => done('break'));
}

// --- credits: one line at a time, tap to move on ---
function rollCredits(onDone) {
  const el = document.getElementById('story-credits');
  const lineEl = document.getElementById('story-credits-line');
  const lines = STORY.credits.map(l => fillTokens(l, storyTokens()));
  let i = -1, timer = null;
  const next = () => {
    clearTimeout(timer);
    i++;
    if (i >= lines.length) {
      el.removeEventListener('click', next);
      el.hidden = true;
      onDone();
      return;
    }
    lineEl.classList.remove('roll');
    void lineEl.offsetWidth;
    lineEl.textContent = lines[i];
    lineEl.classList.add('roll');
    timer = setTimeout(next, Story.reduced ? 1600 : 2400);
    _burnTimers.push(timer);
  };
  el.hidden = false;
  el.addEventListener('click', next);
  next();
}

// --- the ending sequence ---
function runEnding(choice, finish) {
  const p = loadStoryProgress();
  const first = !p.choiceSubmitted;
  p.choice = choice;
  saveStoryProgress();
  track('story_choice', { choice, first });
  // Submit first so this player's own vote is in the split they see
  const split = submitStoryChoice(choice).then(() => fetchChoiceSplit(choice));

  const ending = STORY.endings[choice];
  playLines(ending.lines, { where: 'ending', onDone: () => {
    rollCredits(() => {
      const avg = storyAverageSaved(loadStoryProgress()) || 0;
      // Everyone gets the sequel tease; a high average adds a line just for them
      const post = [...ending.postCredits];
      if (ending.postCreditsBonus && avg >= ending.postCreditsIf) post.splice(post.length - 1, 0, ending.postCreditsBonus);
      playLines(post, { where: 'ending', onDone: () => showEnd(choice, finish, split) });
    });
  }});
}

function endingShareText(choice) {
  const avg = storyAverageSaved(loadStoryProgress());
  return [
    STORY.endings[choice].share,
    `🗺️ THE UNMAKING${avg != null ? ` · ${avg}% of the world saved` : ''}`,
    (typeof shareUrl === 'function') ? shareUrl('story') : '',
  ].filter(Boolean).join('\n');
}

function showEnd(choice, finish, split = Promise.resolve(null)) {
  const el = document.getElementById('story-end');
  const splitEl = document.getElementById('story-end-split');
  splitEl.hidden = true;
  split.then(pct => {
    if (pct == null) return; // offline, or the SQL isn't there yet: no line at all
    splitEl.textContent = fillTokens(STORY.splitLine, { pct });
    splitEl.hidden = false;
  });
  const avg = storyAverageSaved(loadStoryProgress());
  document.getElementById('story-end-title').textContent = STORY.title;
  document.getElementById('story-end-share').textContent = STORY.endings[choice].share;
  document.getElementById('story-end-score').textContent = avg != null ? `${avg}% of the world saved, across seven chapters` : '';
  el.hidden = false;
  const shareBtn = document.getElementById('story-end-share-btn');
  const contBtn  = document.getElementById('story-end-continue-btn');
  const onShare = async () => {
    track('story_share', { kind: 'ending', chapter: 7 });
    const text = endingShareText(choice);
    if (navigator.share) {
      try { await navigator.share({ text }); return; } catch (err) { if (err.name === 'AbortError') return; }
    }
    try { await navigator.clipboard.writeText(text); showToast('Copied to clipboard'); }
    catch { showToast('Could not copy — long-press to select instead'); }
  };
  const onCont = () => {
    shareBtn.removeEventListener('click', onShare);
    contBtn.removeEventListener('click', onCont);
    el.hidden = true;
    finish();
  };
  shareBtn.addEventListener('click', onShare);
  contBtn.addEventListener('click', onCont);
}

// --- Map Journal and the N-E-E-D-L-E secret ---
const SECRET_SEQUENCE = 'NEEDLE';
let _sealTaps = '';

function openJournal() {
  const dlg  = document.getElementById('story-journal');
  const grid = document.getElementById('story-journal-grid');
  const p = loadStoryProgress();
  const sealsLive = p.choice != null; // seal letters appear only after the finale
  _sealTaps = '';
  grid.innerHTML = '';
  const cards = [...p.postcards].sort((a, b) => a.n - b.n);
  for (const pc of cards) {
    const ch = STORY.chapters.find(c => c.n === pc.n);
    const country = COUNTRIES.find(c => c.name === pc.country);
    const li = document.createElement('li');
    li.className = 'story-journal-card' + (pc.foil ? ' foil' : '');
    const flag = document.createElement('div'); flag.className = 'story-journal-flag'; flag.innerHTML = country ? flagHtml(country, 32) : '';
    const name = document.createElement('div'); name.className = 'story-journal-name'; name.textContent = pc.country || '';
    const chEl = document.createElement('div'); chEl.className = 'story-journal-ch'; chEl.textContent = ch ? `Chapter ${ch.n} · ${ch.title}` : '';
    const seal = document.createElement('button');
    seal.type = 'button';
    seal.className = 'story-journal-seal';
    seal.setAttribute('aria-label', 'Wax seal');
    if (sealsLive && ch) {
      seal.textContent = ch.letter;
      seal.addEventListener('click', () => onSealTap(ch.letter, seal));
    } else {
      seal.disabled = true;
    }
    li.append(flag, name, chEl, seal);
    grid.appendChild(li);
  }
  document.getElementById('story-journal-empty').hidden = cards.length > 0;
  renderSecret(p.secretFound);
  if (!dlg.open) dlg.showModal();
}

function onSealTap(letter, seal) {
  seal.classList.add('pressed');
  setTimeout(() => seal.classList.remove('pressed'), 120);
  if (letter === SECRET_SEQUENCE[_sealTaps.length]) _sealTaps += letter;
  else _sealTaps = letter === SECRET_SEQUENCE[0] ? letter : '';
  if (_sealTaps === SECRET_SEQUENCE) {
    _sealTaps = '';
    const p = loadStoryProgress();
    const firstTime = !p.secretFound;
    p.secretFound = true;
    saveStoryProgress();
    if (firstTime) track('story_secret_found', {});
    renderSecret(true);
    document.getElementById('story-secret').scrollIntoView({ behavior: Story.reduced ? 'auto' : 'smooth' });
  }
}

function renderSecret(show) {
  const box = document.getElementById('story-secret');
  if (!box) return;
  box.hidden = !show;
  if (!show) return;
  document.getElementById('story-secret-title').textContent = STORY.secretLetter.title;
  const body = document.getElementById('story-secret-body');
  body.innerHTML = '';
  for (const para of STORY.secretLetter.body) {
    const el = document.createElement('p');
    el.textContent = para;
    body.appendChild(el);
  }
  document.getElementById('story-secret-signoff').textContent = STORY.secretLetter.signoff;
}

document.getElementById('story-journal-btn')?.addEventListener('click', openJournal);
document.getElementById('story-journal-close-btn')?.addEventListener('click', () => document.getElementById('story-journal').close());

// --- "Hide the scar" in the account sheet ---
function renderScarRow() {
  const row = document.getElementById('scar-row');
  if (!row) return;
  const p = loadStoryProgress();
  row.hidden = p.choice !== 'keep';
  document.getElementById('scar-state').textContent = p.scarHidden ? 'Hidden' : 'Shown';
  document.getElementById('scar-toggle-btn').textContent = p.scarHidden ? 'Show' : 'Hide';
}
document.getElementById('account-btn')?.addEventListener('click', renderScarRow);
document.getElementById('scar-toggle-btn')?.addEventListener('click', () => {
  const p = loadStoryProgress();
  p.scarHidden = !p.scarHidden;
  saveStoryProgress();
  renderScarRow();
  dirty = true;
});

// ============================================================
// Dialogue (spec §9, 03-animation-audio.md §4)
// ============================================================
// Typewriter — 28 ms/char, +120 ms pause after sentence punctuation. Returns
// a function that jumps straight to the finished line (first tap), or null
// if the line was already shown whole (reduced motion).
// One typewriter per element: starting a new line (or skipping a sequence)
// stops the old one, or its leftover timer interleaves letters into the next.
const _typing = new WeakMap(); // el -> stop()
function stopTyping(el) {
  const stop = el && _typing.get(el);
  if (stop) { stop(); _typing.delete(el); }
}

function typeLine(el, text, { onDone, sound = false } = {}) {
  stopTyping(el);
  el.textContent = '';
  if (Story.reduced) { el.textContent = text; if (onDone) onDone(); return null; }
  let i = 0, timer = null, finished = false;
  _typing.set(el, () => { clearTimeout(timer); finished = true; });
  function step() {
    if (i >= text.length) { finished = true; timer = null; if (onDone) onDone(); return; }
    el.textContent += text[i];
    const ch = text[i]; i++;
    if (sound && i % 2 === 0) StoryAudio.type();
    timer = setTimeout(step, /[.,—!?]/.test(ch) ? 28 + 120 : 28);
  }
  step();
  return () => {
    if (finished) return;
    clearTimeout(timer); timer = null;
    el.textContent = text; finished = true;
    if (onDone) onDone();
  };
}

function setNeedleMood(svg, mood) {
  if (!svg) return;
  for (const c of [...svg.classList]) if (c.startsWith('mood-')) svg.classList.remove(c);
  svg.classList.add('mood-' + (mood || 'neutral'));
}

let _needleBlinkStarted = false;
function startNeedleBlink() {
  if (_needleBlinkStarted) return;
  _needleBlinkStarted = true;
  (function schedule() {
    setTimeout(() => {
      if (!Story.reduced) {
        document.querySelectorAll('.needle-char').forEach(svg => {
          if (svg.closest('[hidden]')) return;
          svg.classList.add('blink');
          setTimeout(() => svg.classList.remove('blink'), 140);
        });
      }
      schedule();
    }, 2500 + Math.random() * 3500);
  })();
}

// --- Barks: small bubble, top-left of the globe, auto-dismiss ---
let recentBarks = []; // texts of the last 3 shown, across all keys
let _barkTimer = null;

function showBark(line, tokens) {
  if (!line) return;
  const bubble = document.getElementById('story-bark');
  const textEl = document.getElementById('story-bark-text');
  const svg    = document.getElementById('story-bark-needle-svg');
  if (!bubble || !textEl) return;
  setNeedleMood(svg, line.mood || 'neutral');
  const text = fillTokens(line.text, tokens || storyTokens());
  textEl.textContent = text;
  bubble.hidden = false;
  startNeedleBlink();
  clearTimeout(_barkTimer);
  // Long enough to read while the eye sits over the globe: about 70 ms a character, 3.5 s minimum
  const dur = Story.reduced ? 3500 : Math.max(3500, 70 * text.length);
  _barkTimer = setTimeout(() => { bubble.hidden = true; }, dur);
}

function pickBarkLine(key) {
  const chapter = activeChapterDef();
  const pool = (chapter && chapter.barks && chapter.barks[key]) || STORY.barks[key] || [];
  if (!pool.length) return null;
  let candidates = pool.filter(l => !recentBarks.includes(l.text));
  if (!candidates.length) candidates = pool;
  const line = candidates[randomInt(candidates.length)];
  recentBarks.push(line.text);
  if (recentBarks.length > 3) recentBarks.shift();
  return line;
}

function bark(key, tokens) {
  showBark(pickBarkLine(key), tokens);
}

// --- Varka: full-width handwriting intrusion, tap or ~2.5s to dismiss ---
function varka(line, tokens, onDismiss) {
  if (!line) { if (onDismiss) onDismiss(); return; }
  const el     = document.getElementById('story-varka');
  const textEl = document.getElementById('story-varka-text');
  if (!el || !textEl) { if (onDismiss) onDismiss(); return; }
  const text = fillTokens(line.text, tokens || storyTokens());
  textEl.textContent = text;
  el.hidden = false;
  requestAnimationFrame(() => el.classList.add('show'));
  StoryAudio.pen();
  let done = false, timer;
  const dismiss = () => {
    if (done) return;
    done = true;
    el.classList.remove('show');
    clearTimeout(timer);
    el.removeEventListener('click', dismiss);
    setTimeout(() => { el.hidden = true; }, Story.reduced ? 120 : 300);
    if (onDismiss) onDismiss();
  };
  el.addEventListener('click', dismiss);
  timer = setTimeout(dismiss, Story.reduced ? 1200 : 2500 + Math.min(text.length * 20, 2000));
}

// --- Comms panel: a sequence of lines/actions (spec §9's playLines) ---
let _comms = null; // { lines, i, onDone, where, finishTyping }

function runStoryAction(action, onDone) {
  if (action === 'burn-first-stain') {
    const el  = document.getElementById('story-stain');
    const btn = document.getElementById('story-stain-btn');
    if (!el || !btn) { onDone(); return; }
    // The stain is just the target now; the real HOLD TO BURN does the burning.
    el.hidden = false;
    showBurnButton(() => {
      const flash = document.getElementById('story-flash');
      if (flash) { flash.hidden = false; setTimeout(() => { flash.hidden = true; }, 300); }
      haptic([30, 40, 80]);
      StoryAudio.burn();
      btn.classList.add('burnt');
      setTimeout(() => { el.hidden = true; btn.classList.remove('burnt'); onDone(); }, 320);
    });
    return;
  }
  if (action === 'title-slam') {
    showStoryCard({ title: STORY.title, recap: STORY.subtitle, isMain: true }, onDone);
    return;
  }
  if (action === 'globe-spin') { startSpin(); setTimeout(onDone, Story.reduced ? 200 : 1500); return; }
  if (action === 'needle-shatter') { shatterNeedle(onDone); return; }
  if (action === 'scar-appears') {
    const panel = document.getElementById('story-comms');
    if (panel) panel.hidden = true; // let the player watch the scar arrive
    flyTo(STORY.pointNemo);
    animateZoom(2, 900);
    _scarBornAt = performance.now();
    StoryAudio.erase();
    setTimeout(() => { if (panel && _comms) panel.hidden = false; onDone(); }, 1600);
    return;
  }
  if (action === 'eye-opens-point-nemo') {
    flyTo(STORY.pointNemo);
    _eyeBornAt = performance.now();
    dirty = true;
    setTimeout(onDone, 1500);
    return;
  }
  onDone();
}

function playLines(lines, opts = {}) {
  const seq = (lines || []).filter(Boolean);
  if (!seq.length) { if (opts.onDone) opts.onDone(false); return; }
  const panel = document.getElementById('story-comms');
  if (panel) panel.hidden = false;
  _comms = { lines: seq, i: -1, onDone: opts.onDone || null, where: opts.where || 'intro' };
  advanceComms();
}

function advanceComms() {
  const st = _comms;
  if (!st) return;
  st.i++;
  if (st.i >= st.lines.length) { endComms(false); return; }
  const line = st.lines[st.i];
  if (line.action) { runStoryAction(line.action, advanceComms); return; }
  renderCommsLine(line);
}

function renderCommsLine(line) {
  const nameEl    = document.getElementById('story-comms-name');
  const textEl    = document.getElementById('story-comms-text');
  const portrait  = document.getElementById('story-comms-portrait');
  const svg       = document.getElementById('story-comms-needle-svg');
  const isVarka = line.who === 'varka', isBlot = line.who === 'blot', isEcho = line.who === 'echo', isLamp = line.who === 'lamp';
  if (portrait) portrait.hidden = isVarka || isLamp;
  if (!isVarka) setNeedleMood(svg, line.mood || 'neutral');
  if (nameEl) nameEl.textContent = isVarka ? 'Kaelor' : isBlot ? '???' : isEcho ? '...' : isLamp ? '' : 'Needle';
  if (textEl) {
    textEl.className = 'story-comms-text' + (isVarka ? ' varka-style' : '') + (isBlot ? ' blot-style' : '') + (isEcho ? ' echo-style' : '') + (line.reversed ? ' mirrored' : '');
    const text = fillTokens(line.text, storyTokens());
    // ch 6: reversed lines show as written (backwards); one tap flips them readable
    _comms.flip = line.reversed ? [...text].reverse().join('') : null;
    _comms.finishTyping = typeLine(textEl, text, { sound: true, onDone: () => { if (_comms) _comms.finishTyping = null; } });
  }
  startNeedleBlink();
}

function endComms(skipped) {
  const panel = document.getElementById('story-comms');
  if (panel) panel.hidden = true;
  stopTyping(document.getElementById('story-comms-text'));
  const st = _comms;
  _comms = null;
  if (skipped && st) track('story_dialogue_skip', { chapter: _activeChapterN || 0, where: st.where });
  if (st && st.onDone) st.onDone(skipped);
}

document.getElementById('story-comms')?.addEventListener('click', e => {
  if (e.target.closest('#story-comms-skip')) return;
  const st = _comms;
  if (!st) return;
  if (st.finishTyping) st.finishTyping();
  else if (st.flip) {
    const textEl = document.getElementById('story-comms-text');
    textEl.textContent = st.flip;
    textEl.classList.add('flipped');
    st.flip = null;
  } else advanceComms();
});
document.getElementById('story-comms-skip')?.addEventListener('click', () => endComms(true));

// --- Chapter title card / main title card (spec §11, §4) ---
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
let _cardHideTimer = null;   // the one <div id="story-titlecard"> is reused; a
                              // stale hide-timeout from the previous card must
                              // never fire after a new one has been shown.

function showStoryCard({ n, title, recap, isMain }, onDone) {
  const card   = document.getElementById('story-titlecard');
  const numEl  = document.getElementById('story-titlecard-num');
  const titleEl= document.getElementById('story-titlecard-title');
  const recapEl= document.getElementById('story-titlecard-recap');
  if (!card) { onDone(); return; }
  clearTimeout(_cardHideTimer);
  numEl.textContent   = isMain ? '' : `CHAPTER ${ROMAN[n]}`;
  titleEl.textContent = isMain ? STORY.title : title;
  recapEl.textContent = '';
  card.hidden = false;
  card.classList.remove('show');
  requestAnimationFrame(() => card.classList.add('show'));
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    card.removeEventListener('click', finish);
    clearTimeout(timer);
    card.classList.remove('show');
    _cardHideTimer = setTimeout(() => { card.hidden = true; }, Story.reduced ? 1 : 420);
    onDone();
  };
  card.addEventListener('click', finish);
  const timer = setTimeout(finish, Story.reduced ? 800 : 3200);
  typeLine(recapEl, recap || '');
}

// --- Sound (spec §12): asked once, the first time chapter 1 starts ---
function setStorySound(on) {
  const p = loadStoryProgress();
  p.soundOn = !!on;
  p.soundAsked = true;
  saveStoryProgress();
  StoryAudio.setOn(on);   // called from the tap, so the AudioContext may start
  track('story_sound', { on: !!on });
  renderSoundButton();
}

function askSound(onDone) {
  if (loadStoryProgress().soundAsked) { onDone(); return; }
  const panel   = document.getElementById('story-comms');
  const choices = document.getElementById('story-comms-choices');
  const skip    = document.getElementById('story-comms-skip');
  const yes = document.getElementById('story-sound-yes');
  const no  = document.getElementById('story-sound-no');
  if (!panel || !choices) { onDone(); return; }
  _comms = null; // taps on the panel itself do nothing here — only the buttons answer
  document.getElementById('story-comms-portrait').hidden = false;
  setNeedleMood(document.getElementById('story-comms-needle-svg'), 'neutral');
  document.getElementById('story-comms-name').textContent = 'Needle';
  const textEl = document.getElementById('story-comms-text');
  textEl.className = 'story-comms-text';
  typeLine(textEl, STORY.ui.soundPrompt);
  yes.textContent = STORY.ui.soundYes;
  no.textContent  = STORY.ui.soundNo;
  choices.hidden = false;
  skip.hidden = true;
  panel.hidden = false;
  const answer = on => {
    yes.removeEventListener('click', onYes);
    no.removeEventListener('click', onNo);
    choices.hidden = true;
    skip.hidden = false;
    panel.hidden = true;
    setStorySound(on);
    onDone();
  };
  const onYes = e => { e.stopPropagation(); answer(true); };
  const onNo  = e => { e.stopPropagation(); answer(false); };
  yes.addEventListener('click', onYes);
  no.addEventListener('click', onNo);
}

function renderSoundButton() {
  const btn = document.getElementById('story-sound-btn');
  if (!btn) return;
  const on = loadStoryProgress().soundOn;
  btn.hidden = false;
  btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  btn.setAttribute('aria-label', on ? 'Sound on — tap to mute' : 'Sound off — tap to turn on');
  btn.title = on ? 'Sound on' : 'Sound off';
  btn.classList.toggle('off', !on);
}
document.getElementById('story-sound-btn')?.addEventListener('click', () => setStorySound(!loadStoryProgress().soundOn));

// Ambience stops entirely while the tab is hidden (§6)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) StoryAudio.stopAmbience();
  else if (_activeChapterN && !gameOver && !document.getElementById('game-screen').hidden) StoryAudio.startAmbience();
});

// ============================================================
// Playing a chapter
// ============================================================
let _activeChapterN = null;
let _huntStartedAt = null; // ms; null for a resumed run (its earlier time isn't known)

// Chapter 7's country is the sentinel 'HOME', resolved by the `liar`
// modifier in M7 (detectHomeCountry). Guard here even though chapter 7
// can't be unlocked yet, so a future bug can't crash instead of warn.
function resolveChapterCountry(chapter) {
  if (chapter.country === 'HOME') {
    const name = homeCountryName();
    return COUNTRIES.find(c => c.name === name) || null;
  }
  return COUNTRIES.find(c => c.name === chapter.country) || null;
}

// Which bark/hint/Varka line fires for a miss (spec §9/§7). Scheduled hints
// and Varka lines win over the heat/warmer-cooler bark for that guess.
let _hintsShown = [];
let _varkaShown = [];
let _pityPlayed = false;
let _eaten = null;        // ch 1: the guess the Shadow ate (country name), persisted in run.eaten
let _flickered = false;   // ch 1-3: Needle's glitch has happened this run

function markEatenRow() {
  if (!_eaten) return;
  const li = [...historyEl.children].find(x => x.querySelector('.gi-name')?.textContent === _eaten);
  if (li) li.classList.add('eaten');
}

// ch 1-3: a split second of something wrong with Needle (pays off in ch 6-7)
function maybeFlicker(chapter) {
  const f = chapter.flicker;
  if (!f || _flickered || missesSoFar() !== f.afterMisses) return false;
  _flickered = true;
  showBark(f.line, storyTokens());
  StoryAudio.glitch();
  if (f.arrowTwitch) {
    // the newest row's arrow points the wrong way, then corrects itself
    const g = guesses[guesses.length - 1];
    const arrow = historyEl.firstElementChild?.querySelector('.gi-arrow');
    const b = g && compassBearing(g.country.lat, g.country.lon, mystery.lat, mystery.lon);
    if (arrow && arrow.textContent && b) {
      const real = arrow.textContent;
      arrow.textContent = ARROWS[OPPOSITE[b]];
      arrow.classList.add('twitch');
      setTimeout(() => { arrow.textContent = real; arrow.classList.remove('twitch'); }, 1400);
    }
  }
  return true;
}

function maybeScheduledLine(chapter) {
  const misses = missesSoFar();
  const v = chapter.varka && chapter.varka.find(l => l.afterMisses === misses);
  if (v && !_varkaShown.includes(misses)) {
    _varkaShown.push(misses);
    varka(v, storyTokens());
    return true;
  }
  const h = chapter.hints && chapter.hints.find(l => l.afterMisses === misses);
  if (h && !_hintsShown.includes(misses)) {
    _hintsShown.push(misses);
    showBark(h, storyTokens());
    return true;
  }
  return false;
}

function startStoryChapter(n) {
  const chapter = STORY.chapters.find(ch => ch.n === n);
  const country = resolveChapterCountry(chapter);
  if (!country) return;

  const p = loadStoryProgress();
  const c = p.chapters[n];
  const resumed    = !!(c.run && c.run.guesses && c.run.guesses.length);
  const savedNames = resumed ? c.run.guesses : null;

  _activeChapterN = n;
  _jumped       = resumed ? !!c.run.jumped : false;
  _elapsed      = resumed ? (c.run.elapsed || 0) : 0;
  _riddlesShown = resumed ? (c.run.riddlesShown || 0) : 0;
  _modLifted    = false;
  _fogCache     = { key: null, geos: [] };
  // ch 2 starts at its decoy country until the Blot has jumped
  const startCountry = (chapter.modifier.type === 'jump' && !_jumped)
    ? COUNTRIES.find(x => x.name === chapter.modifier.startCountry) : country;
  _hintsShown = resumed ? [...(c.run.hintsShown || [])] : [];
  _varkaShown = resumed ? [...(c.run.varkaShown || [])] : [];
  _pityPlayed = resumed && missesSoFarFromNames(savedNames) >= chapter.pityAfter;
  _eaten     = resumed ? (c.run.eaten || null) : null;
  _flickered = resumed && chapter.flicker ? missesSoFarFromNames(savedNames) >= chapter.flicker.afterMisses : false;
  if (resumed) restoreErasureFromRun(c.run.erased);
  else resetErasure();

  track('story_chapter_start', { chapter: n, mode: 'normal', resumed });

  const begin = () => {
    document.getElementById('story-screen').hidden = true;   // showScreen() doesn't know about this screen
    startStoryRound(startCountry, savedNames);
    markEatenRow();
    _huntStartedAt = resumed ? null : Date.now();
    renderRiddles();
    startClock();
    StoryAudio.startAmbience();
  };

  // Resuming skips the title card and intro — the player has already seen
  // them; replaying on every reopen would be a hostile amount of dialogue.
  if (resumed) { begin(); return; }

  const card = () => showStoryCard({ n, title: chapter.title, recap: chapter.recap }, () => {
    playLines(chapter.intro, { where: 'intro', onDone: () => begin() });
  });
  if (n === 1) askSound(card); else card();
}

function missesSoFarFromNames(names) { return names ? names.length : 0; }

// ============================================================
// Server: the choice split and progress sync (M9; spec §4, §10;
// supabase/007_story.sql). Best-effort like cloud.js: never blocks play,
// and goes quiet when offline or before the SQL has been run.
// ============================================================
let _storyServer = true;        // false once we learn 007's tables/functions aren't there
let _storySyncTimer = null;
let _storySyncChain = Promise.resolve();
let _storyLastUpload = null;    // JSON of the last uploaded payload, to skip no-op uploads
let _storySyncedUser = null;

function storyServerReady() {
  return _storyServer && typeof sb !== 'undefined' && !!sb &&
         typeof cloudUser !== 'undefined' && !!cloudUser && cloudStatus === 'ready';
}

function storyServerError(error) {
  // undefined table / function, or PostgREST can't find it in its schema cache
  const code = (error && error.code) || '';
  if (['42P01', '42883', 'PGRST202', 'PGRST205'].includes(code) || (error && error.status === 404)) {
    if (_storyServer) console.info('Story sync is off until supabase/007_story.sql is run.');
    _storyServer = false;
  } else {
    console.warn('Story sync:', (error && error.message) || error);
  }
}

// What leaves the device: no home country (spec §1 rule 3), no in-progress
// runs (§4), no per-device settings.
function storyProgressForUpload(p) {
  const out = JSON.parse(JSON.stringify(p));
  delete out.homeCountry;
  delete out.soundOn;
  delete out.soundAsked;
  delete out.scarHidden;
  delete out.dailyUnlockDay;
  for (const n of Object.keys(out.chapters)) out.chapters[n].run = null;
  return out;
}

// Spec §4: per chapter the max stars/inkStars and best %, the earlier
// completedAt, and 'done' beats anything; postcards union by n (foil wins).
// The ending choice stays local unless this device has none yet.
function mergeStoryProgress(local, remote) {
  if (!remote || remote.version !== 1 || !remote.chapters) return false;
  const before = JSON.stringify(local);
  for (const ch of STORY.chapters) {
    const l = local.chapters[ch.n], r = remote.chapters[ch.n];
    if (!l || !r) continue;
    l.stars    = Math.max(l.stars || 0, +r.stars || 0);
    l.inkStars = Math.max(l.inkStars || 0, +r.inkStars || 0);
    if (typeof r.bestSaved === 'number') l.bestSaved = l.bestSaved == null ? r.bestSaved : Math.max(l.bestSaved, r.bestSaved);
    if (typeof r.completedAt === 'number') l.completedAt = l.completedAt ? Math.min(l.completedAt, r.completedAt) : r.completedAt;
    if (r.status === 'done') l.status = 'done';
    else if (l.status === 'locked' && (r.status === 'available' || r.status === 'in_progress')) l.status = 'available';
  }
  for (const pc of Array.isArray(remote.postcards) ? remote.postcards : []) {
    if (!STORY.chapters.some(c => c.n === pc.n)) continue;
    const mine = local.postcards.find(x => x.n === pc.n);
    if (mine) mine.foil = mine.foil || !!pc.foil;
    else local.postcards.push({ n: pc.n, country: String(pc.country || ''), foil: !!pc.foil });
  }
  if (local.choice == null && (remote.choice === 'break' || remote.choice === 'keep')) local.choice = remote.choice;
  local.choiceSubmitted = local.choiceSubmitted || !!remote.choiceSubmitted;
  local.secretFound     = local.secretFound || !!remote.secretFound;
  local.seenColdOpen    = local.seenColdOpen || !!remote.seenColdOpen;
  return JSON.stringify(local) !== before;
}

function syncStory({ pull = false } = {}) {
  const run = _storySyncChain.catch(() => {}).then(() => doStorySync(pull));
  _storySyncChain = run;
  return run;
}

async function doStorySync(pull) {
  if (!storyServerReady()) return;
  const p = loadStoryProgress();
  if (pull) {
    const { data, error } = await sb.from('story_progress').select('progress').eq('user_id', cloudUser.id).maybeSingle();
    if (error) { storyServerError(error); return; }
    if (data && mergeStoryProgress(p, data.progress)) {
      refreshStoryUnlocks(p);
      writeJSON(STORY_PROGRESS_KEY, p);
      renderStoryHomeCard();
      if (!document.getElementById('story-screen').hidden) renderStoryChapterList();
      dirty = true; // a merged "keep" draws the scar
    }
  }
  const payload = JSON.stringify(storyProgressForUpload(p));
  if (payload === _storyLastUpload) return;
  const { error } = await sb.from('story_progress')
    .upsert({ user_id: cloudUser.id, progress: JSON.parse(payload), updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) { storyServerError(error); return; }
  _storyLastUpload = payload;
}

function queueStorySync() {
  clearTimeout(_storySyncTimer);
  _storySyncTimer = setTimeout(() => { syncStory().catch(() => {}); }, 3000);
}

function submitStoryChoice(choice) {
  if (loadStoryProgress().choiceSubmitted || !storyServerReady()) return Promise.resolve();
  return sb.rpc('submit_story_choice', { p_choice: choice }).then(({ error }) => {
    if (error) { storyServerError(error); return; }
    loadStoryProgress().choiceSubmitted = true;
    saveStoryProgress();
  }).catch(() => {});
}

async function fetchChoiceSplit(choice) {
  if (!storyServerReady()) return null;
  try {
    const { data, error } = await sb.rpc('story_choice_stats');
    if (error) { storyServerError(error); return null; }
    const row = Array.isArray(data) ? data[0] : data;
    const b = +(row && row.break_count) || 0, k = +(row && row.keep_count) || 0;
    if (b + k === 0) return null;
    return Math.round(100 * (choice === 'break' ? b : k) / (b + k));
  } catch { return null; }
}

// Pull + merge whenever the cloud becomes ready or the signed-in identity
// changes (e.g. signing into the same Google account on another device).
// Deferred a tick: cloud.js emits from inside onAuthStateChange, where
// calling Supabase can deadlock.
function onStoryCloudChange() {
  if (typeof cloudStatus === 'undefined' || cloudStatus !== 'ready' || !cloudUser) return;
  if (cloudUser.id === _storySyncedUser) return;
  _storySyncedUser = cloudUser.id;
  _storyLastUpload = null;
  setTimeout(() => { syncStory({ pull: true }).catch(() => {}); }, 0);
}

// ============================================================
// Public entry points (called from game.js hooks)
// ============================================================
const Story = {
  reduced: false,

  init() {
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (loadStoryProgress().soundOn) StoryAudio.setOn(true, { fromGesture: false });
    renderSoundButton();
    computeStoryAreas();
    startNeedleBlink();
    const p = loadStoryProgress();
    refreshStoryUnlocks(p);
    saveStoryProgress();
    renderStoryHomeCard();
    if (typeof onCloudChange === 'function') { onCloudChange(onStoryCloudChange); onCloudChange(renderStoryHomeCard); }
  },

  // cloud.js signOutCloud(): upload before the account leaves the device...
  flushSync() {
    clearTimeout(_storySyncTimer);
    return syncStory();
  },
  // ...then forget it, like the games list (resetLocalData). Sound
  // settings belong to the device, so they stay.
  resetLocal() {
    const old = loadStoryProgress();
    _storyProgress = defaultStoryProgress();
    _storyProgress.soundOn    = old.soundOn;
    _storyProgress.soundAsked = old.soundAsked;
    _storySyncedUser = null;
    _storyLastUpload = null;
    writeJSON(STORY_PROGRESS_KEY, _storyProgress);
    renderStoryHomeCard();
    dirty = true;
  },

  renderHomeCard() {
    renderStoryHomeCard();
  },

  // skipGate: internal re-entry flag, set once the username gate has been
  // satisfied (or explicitly skipped), so this doesn't prompt in a loop.
  open(skipGate) {
    if (!hasFeature('story')) return;
    if (!skipGate && typeof cloudStatus !== 'undefined' && cloudStatus === 'ready' && !cloudUsername) {
      openUsername(() => Story.open(), {
        forced: true, reason: 'story', skipLabel: 'Skip for now',
        onSkip: () => Story.open(true),
      });
      return;
    }

    const p = loadStoryProgress();
    refreshStoryUnlocks(p);
    saveStoryProgress();
    track('story_open', { chapter_available: highestUnlockedChapter(p) });

    if (!p.seenColdOpen) {
      document.getElementById('home-screen').hidden = true;
      document.getElementById('story-screen').hidden = false;
      renderStoryChapterList();
      playLines(STORY.coldOpen, { where: 'cold_open', onDone: skipped => {
        const prog = loadStoryProgress();
        prog.seenColdOpen = true;
        saveStoryProgress();
        track('story_cold_open_done', { skipped: !!skipped });
        renderStoryHomeCard();
        startStoryChapter(1);
      }});
      return;
    }

    document.getElementById('home-screen').hidden = true;
    document.getElementById('story-screen').hidden = false;
    renderStoryChapterList();
  },

  close() {
    closeStoryOverlays();
    document.getElementById('story-screen').hidden = true;
    showScreen('home');
  },

  // --- gameplay hooks, called from game.js (spec §3) ---

  chipLabel() {
    const chapter = STORY.chapters.find(ch => ch.n === _activeChapterN);
    return chapter ? `Chapter ${chapter.n}` : 'The Unmaking';
  },

  renderHud() {
    const saved = currentWorldSaved();
    guessChip.textContent = `🌍 ${saved}%`;
    if (saved < _lastWorldSaved) {
      guessChip.classList.remove('story-pulse');
      void guessChip.offsetWidth; // restart the animation
      guessChip.classList.add('story-pulse');
    }
    _lastWorldSaved = saved;
  },

  // drawAllLand()/drawGlobe() hooks (spec §3) — fog (M6) will make
  // hiddenGeos() return something; the ink paints over normal land, so it
  // doesn't need anything hidden.
  hiddenGeos() { return fogHiddenGeos(); },
  mirrored() { return !!_activeChapterN && !_modLifted && chapterMod().type === 'mirror'; },
  drawUnder(ctxArg, pal) { drawStoryInk(ctxArg, pal); },
  drawOver(ctxArg) { drawEatenInk(ctxArg); drawEquator(ctxArg); drawBlot(ctxArg); drawBurnFX(ctxArg); },
  drawScar(ctxArg) { drawScar(ctxArg); },
  isAnimating() { return isStoryAnimating(); },

  // M2: the true bearing, same as every other mode. M7's `liar` modifier
  // will override this (inverted, toward the player's own home country).
  arrowBearing(country) {
    const b = compassBearing(country.lat, country.lon, mystery.lat, mystery.lon);
    return (b && chapterMod().type === 'liar') ? OPPOSITE[b] : b; // ch 7: Needle steers you away
  },

  persist() {
    if (gameOver || !_activeChapterN) return;
    const p = loadStoryProgress();
    const c = p.chapters[_activeChapterN];
    if (c.status !== 'done') c.status = 'in_progress';
    // Merge rather than overwrite — later milestones add fields (erased,
    // jumped, elapsed, …) this function shouldn't know about or clobber.
    c.run = {
      mode:         c.run?.mode || 'normal',
      guesses:      guesses.map(g => g.country.name),
      erased:       [...erasedMap.keys()],
      jumped:       _jumped,
      elapsed:      Math.round(_elapsed * 10) / 10,
      riddlesShown: _riddlesShown,
      varkaShown:   [..._varkaShown],
      hintsShown:   [..._hintsShown],
      eaten:        _eaten,
    };
    saveStoryProgress();
  },

  onGuess(entry, restoring) {
    if (restoring) return;
    const chapter = activeChapterDef();
    if (!chapter) return;

    if (shouldJump(entry.country)) {
      doJump(chapter);
      // Guessing the real country as the trigger: it panicked straight into it
      if (entry.correct) { playLines(chapter.jumpIntoGuess, { where: 'jump' }); return; }
      if (chapter.inkPerMiss > 0) eraseCountries(pickErasureVictims(chapter.inkPerMiss * TOTAL_AREA));
      playLines(chapter.jump, { where: 'jump' });
      return;
    }
    if (entry.correct) return;

    // submitGuess() already calls persistCurrent() -> this.persist() right
    // after this, which now serializes the live erasedMap — nothing to
    // persist from here directly.
    let erased = false;
    if (chapter.inkPerMiss > 0) {
      const victims = pickErasureVictims(chapter.inkPerMiss * TOTAL_AREA);
      if (victims.length) {
        eraseCountries(victims);
        erased = true;
        StoryAudio.erase();
        setTimeout(StoryAudio.drip, 350);
        haptic(15);
      }
    }

    const tokens = storyTokens({ guess: entry.country.name });

    // ch 1: the first close guess gets eaten: inked over, row struck through
    // "close" = within 5,000 km or next door: New Zealand has almost no warm neighbours
    if (chapter.eats && !_eaten && (entry.temp === 'adjacent' || entry.distKm < 5000)) {
      _eaten = entry.country.name;
      eraseCountries([_eaten]);
      markEatenRow();
      StoryAudio.erase();
      haptic([20, 40, 20]);
      showBark(chapter.eaten[0], tokens);
      setTimeout(() => showBark(chapter.eaten[1], tokens), 1600);
      track('story_eaten', { chapter: chapter.n });
      return;
    }

    let beat = true;   // a story beat this guess: don't talk over it with the erase bark
    if (missesSoFar() >= chapter.pityAfter && !_pityPlayed) {
      _pityPlayed = true;
      track('story_pity', { chapter: chapter.n, misses: missesSoFar() });
      bark('pity', tokens);
    } else if (!maybeRiddle() && !maybeScheduledLine(chapter) && !maybeFlicker(chapter)) {
      beat = false;
      if (chapterMod().type === 'liar') {
        const g = chapter.glitch;
        showBark(g[Math.min(missesSoFar() - 1, g.length - 1)], tokens);
        StoryAudio.glitch();
        StoryAudio.detune(Math.min(60, missesSoFar() * 10));
        return;
      }
      let key;
      if (missesSoFar() === 1) key = 'first';
      else if (entry.temp === 'adjacent') key = 'adjacent';
      else if (!trendEl.hidden && Math.random() < 0.5) key = trendEl.classList.contains('warmer') ? 'warmer' : 'colder';
      else key = entry.temp;
      bark(key, tokens);
    }

    if (erased && !beat) {
      const erasedName = [...erasedMap.keys()].pop();
      setTimeout(() => bark('erase', storyTokens({ erased: erasedName })), 1200);
    }
  },

  onTrivia(isCorrect) {
    if (isCorrect) {
      const restored = restoreMostRecentErased(); // sets dirty; drawGlobe()'s story hook keeps the chip in sync as it fades
      bark('triviaRight', storyTokens({ restored: restored || '' }));
    } else {
      bark('triviaWrong', storyTokens());
    }
  },

  onFound() {
    const n = _activeChapterN;
    const chapter = STORY.chapters.find(ch => ch.n === n);
    const p = loadStoryProgress();
    const c = p.chapters[n];

    // Captured now, before the burn/restore ceremony touches the ink.
    const saved = currentWorldSaved();
    const stars = saved >= chapter.stars[0] ? 3 : saved >= chapter.stars[1] ? 2 : 1;

    c.status      = 'done';
    c.bestSaved   = c.bestSaved == null ? saved : Math.max(c.bestSaved, saved);
    c.stars       = Math.max(c.stars, stars);
    c.completedAt = c.completedAt || Date.now();
    c.run         = null;
    refreshStoryUnlocks(p);
    saveStoryProgress();

    const seconds = _huntStartedAt ? Math.round((Date.now() - _huntStartedAt) / 1000) : null;
    track('story_found', { chapter: n, guesses: guesses.length, saved, seconds });
    track('story_chapter_done', { chapter: n, saved, stars, guesses: guesses.length, mode: 'normal' });

    const finish = () => {
      stopSpin();
      _scarBornAt = null;
      _eyeBornAt = null;
      restoreNeedlePortrait();
      resetErasure();
      document.getElementById('game-screen').hidden = true;
      document.getElementById('story-screen').hidden = false;
      renderStoryChapterList();
      renderStoryHomeCard();
      _activeChapterN = null;
      renderRiddles();
    };

    // Chapter 7 has no Blot and no burn — M7 replaces this branch with the
    // reveal and the choice. It isn't reachable yet (still locked), so this
    // is just a safe placeholder until then.
    stopClock();
    StoryAudio.stopAmbience();
    if (chapter.modifier.type === 'liar') {
      // No Blot, no burn: the ink is coming from Needle (spec §8, §10)
      const svg = document.getElementById('story-bark-needle-svg');
      setNeedleMood(svg, 'sad');
      animateZoom(2, 900);
      playLines(chapter.reveal, { where: 'ending', onDone: () => showChoice(choice => runEnding(choice, finish)) });
      return;
    }
    if (!chapter.found) { finish(); return; }

    const ceremony = () => {
      animateZoom(2.6, 900);
      spawnBlot(chapter);
      if (guesses.length <= 2 && STORY.fastFind && STORY.fastFind.length) {
        varka(STORY.fastFind[randomInt(STORY.fastFind.length)], storyTokens());
      }
      if (chapter.burnPrompt) showBark(chapter.burnPrompt, storyTokens());
      showBurnButton(() => runBurnSequence(chapter, saved, stars, finish));
    };
    if (_comms) {
      const prev = _comms.onDone;
      _comms.onDone = skipped => { if (prev) prev(skipped); ceremony(); };
    } else {
      ceremony();
    }
  },

  onLeave() {
    this.persist();
    closeStoryOverlays();
    _activeChapterN = null;
  },
};

// Hides every story overlay and cancels any in-flight dialogue — used when
// the player backs out of a chapter mid-sequence, so nothing is left
// floating over the home/chapter-select screens.
function closeStoryOverlays() {
  _comms = null;
  stopTyping(document.getElementById('story-comms-text'));
  for (const id of ['story-comms', 'story-bark', 'story-varka', 'story-titlecard', 'story-stain']) {
    const el = document.getElementById(id);
    if (el) { el.hidden = true; el.classList.remove('show'); }
  }
  clearTimeout(_barkTimer);
  cancelBurnSequence();
  stopClock();
  StoryAudio.stopAmbience();
  const riddles = document.getElementById('story-riddles');
  if (riddles) riddles.hidden = true;
}

document.getElementById('story-back-btn')?.addEventListener('click', () => Story.close());
