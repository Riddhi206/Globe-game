# THE UNMAKING — Technical Spec

How story mode plugs into the existing app. Read `01-game-design.md` first.
Line numbers drift; every hook below is identified by **function name**, so
search for the function, not the line.

---

## 1. Ground rules (do not break these)

1. **Daily, Classic and Endless must behave exactly as before.** Every story
   hook in `game.js` is guarded by `gameMode === 'story'` (or a no-op when
   story isn't active). Run the regression checks in `04-build-plan.md` after
   every milestone.
2. **Story never calls `finalizeResult()` or `recordGame()`.** The Supabase
   `games` table has `check (mode in ('daily','classic','endless'))`; one
   story row in a sync batch makes the whole upsert fail and silently blocks
   every other game from syncing. Story has its own store (§4).
3. **Nothing personal leaves the device.** The detected home country, local
   time and game count are used for dialogue only. Never put them in
   `track()` props.
4. **Event names** must match `^[a-z_]{2,40}$` (the `events` table check).
5. **Every new file goes into `sw.js` `SHELL`, and `CACHE` is bumped** on
   every deploy that changes a cached file.
6. **Offline must work.** Story never blocks on the network; Supabase calls
   are best-effort exactly like `cloud.js`.

## 2. Files

New (repo root unless noted):

| File | What it is | Source |
|---|---|---|
| `story-data.js` | All lines and chapter rules (`const STORY`) | copy `resources/story-data.js` |
| `home-country.js` | `detectHomeCountry(games)` | copy `resources/home-country.js` |
| `story-audio.js` | `const StoryAudio` — WebAudio SFX + ambience | write (spec in `03-animation-audio.md` §6) |
| `story.js` | `const Story` — the engine | write (this doc) |
| `story.css` | All story styles and keyframes | write (`03-animation-audio.md`) |
| `supabase/007_story.sql` | choice split + progress sync | copy `resources/007_story.sql` |

Modified: `index.html`, `game.js`, `style.css` (only if needed), `sw.js`,
`tools/dashboard/server.mjs` + `index.html` (Story tab), `README.md`.

### Script order in `index.html`

`game.js`'s `boot()` runs *as soon as game.js executes* (deferred scripts run
with `readyState === 'interactive'`), so anything `boot()` calls must already
be loaded. Load story files **before** `game.js`, and keep them free of
top-level references to `game.js` globals — only touch those inside functions
called after `boot()`:

```html
<script src="countries.js" defer></script>
<script src="borders.js" defer></script>
<script src="data.js" defer></script>
<script src="trivia-options.js" defer></script>
<script src="country-facts.js" defer></script>
<script src="story-data.js" defer></script>      <!-- new -->
<script src="home-country.js" defer></script>    <!-- new -->
<script src="store.js" defer></script>
<script src="cloud.js" defer></script>
<script src="analytics.js" defer></script>
<script src="scoring.js" defer></script>
<script src="story-audio.js" defer></script>     <!-- new -->
<script src="story.js" defer></script>           <!-- new -->
<script src="game.js" defer></script>
```

Add `<link rel="stylesheet" href="story.css">` after `style.css`, and the
display font for chapter cards and Varka's handwriting:
`https://fonts.googleapis.com/css2?family=IM+Fell+English:ital@0;1&display=swap`
(OFL-licensed, free for commercial use).

### Shared globals

Classic scripts share one global lexical scope, so `story.js` can read and
write `game.js`'s top-level `let`s directly: `gameMode`, `mystery`,
`guesses`, `gameOver`, `dirty`, `globeLon`, `globeLat`, `zoomScale`,
`revealed`, `prevDistKm`, plus functions like `flyTo`, `setZoom`,
`haversine`, `classify`, `compassBearing`, `getCountryGeo`, `traceRing`,
`latLonToXY`, `showToast`, `showScreen`, `openUsername`, `track`,
`randomInt`, `loadStore`, `countryFacts`. Only do so inside functions.

## 3. `game.js` hooks — the complete list

Keep each hook to one or two lines. Anything bigger belongs in `story.js`.

| Function | Hook |
|---|---|
| *(new)* `resetRound()` | Extract the state-reset + DOM-reset block from `startGame()` (everything from `guesses = []` through `setZoom(1)`) into this helper. `startGame()` calls it; behaviour unchanged. |
| *(new)* `startStoryRound(country, savedNames)` | `gameMode = 'story'; gameDay = null; mystery = country; resetRound(); modeChip.textContent = Story.chipLabel(); showScreen('game');` then replay `savedNames` through `applyGuess(c, true)`; `updateHud(); dirty = true;` |
| `guessLimit()` | `if (gameMode === 'story') return Infinity;` |
| `updateHud()` | `if (gameMode === 'story') { Story.renderHud(); historyEmpty.hidden = guesses.length > 0; return; }` |
| `persistCurrent()` | `if (gameMode === 'story') { Story.persist(); return; }` |
| `applyGuess()` | After `addHistoryItem(...)`: `if (gameMode === 'story') Story.onGuess(guesses[guesses.length - 1], restoring);` (before the `endGame` checks) |
| `addHistoryItem()` | Bearing: `const bearing = gameMode === 'story' ? Story.arrowBearing(country) : compassBearing(country.lat, country.lon, mystery.lat, mystery.lon);` — `Story.arrowBearing` may return `null` (Ink Mode): then leave the arrow empty. |
| `endGame()` | First line: `if (gameMode === 'story') { gameOver = true; inputEl.disabled = true; trendEl.hidden = true; acListEl.innerHTML = ''; guessForm.hidden = true; if (!restoring) Story.onFound(); return; }` |
| `drawAllLand()` | After building `skip`: `if (gameMode === 'story') for (const geo of Story.hiddenGeos()) skip.add(geo);` |
| `drawGlobe()` | After `drawAllLand(pal)`: `if (gameMode === 'story') Story.drawUnder(ctx, pal);` — after the markers, before the shine: `Story.drawOver(ctx);` — and **in every mode**, also before the shine: `Story.drawScar(ctx);` (no-op unless the player chose "keep") |
| `updateView()` | `view.mx = (gameMode === 'story' && Story.mirrored()) ? -1 : 1;` |
| `latLonToXY()`, `traceRing()`, `traceOpenLine()` | Every `CX + x * R` becomes `CX + view.mx * x * R` (`latLonToXY` needs `updateView()` to have run, which `drawGlobe` guarantees) |
| `moveDrag()` | Multiply the horizontal delta by `view.mx` so dragging still feels natural on a mirrored globe |
| `animate()` | Before the `if (dirty)`: `if (Story.isAnimating()) dirty = true;` |
| `revealTriviaAnswer()` | Correct branch: `if (gameMode === 'story') Story.onTrivia(true);` Wrong branch: `Story.onTrivia(false)` |
| `chooseMode()` | `if (mode === 'story') { Story.open(); return; }` |
| back button handler | `if (gameMode === 'story') Story.onLeave();` before `showScreen('home')` |
| `renderHome()` | Last line: `Story.renderHomeCard();` |
| `openUsername()` | Map `reason === 'story'` to `STORY.ui.usernameReason` for the subtitle |
| `boot()` | After `showScreen('home')`: `Story.init();` |

The gameover row (`#gameover-actions`) stays hidden in story mode; story
drives its own flow after `onFound()`.

## 4. Progress store

`localStorage['pancake_story_v1']`, read/written with `readJSON`/`writeJSON`
from `store.js`:

```js
{
  version: 1,
  seenColdOpen: false,
  soundOn: false,                     // off until the player opts in
  chapters: {
    // one entry per chapter n (1–7)
    1: {
      status: 'available',            // 'locked' | 'available' | 'in_progress' | 'done'
      bestSaved: null,                // best World saved % (0–100, one decimal)
      stars: 0,                       // best stars 0–3
      inkStars: 0,                    // Ink Mode best stars
      completedAt: null,              // ms epoch of first completion
      run: null,                      // in-progress run, see below
    },
  },
  postcards: [ { n: 1, country: 'New Zealand', foil: false } ],
  choice: null,                       // 'break' | 'keep' | null  (latest ending seen)
  choiceSubmitted: false,             // first choice sent to the server
  secretFound: false,
  scarHidden: false,                  // settings toggle for the Point Nemo scar
  homeCountry: null,                  // cached detectHomeCountry() result name
  dailyUnlockDay: null,               // UTC day a Daily was used to unlock a chapter
}
```

An in-progress `run` (so a refresh resumes exactly where you were):

```js
run: {
  mode: 'normal',                     // 'normal' | 'ink'
  guesses: ['Brazil', 'Chile'],       // replayed through applyGuess(c, true)
  erased: ['Australia', 'Mongolia'],  // names currently inked
  jumped: false,                      // ch 2
  elapsed: 0,                         // ch 5, seconds on the clock
  riddlesShown: 0,                    // ch 4
  varkaShown: [3],                    // miss counts whose Varka line already played
  hintsShown: [4],
}
```

**Merging with the server copy** (M9): per chapter, take the max `stars`,
`inkStars`, the higher `bestSaved`, the earlier `completedAt`, and `done`
beats anything; `run` stays local. Postcards: union by `n` (foil wins).
`choice`: keep local.

## 5. Unlocking

```js
// Chapters 1–3 are always available. N (4–7) unlocks when N-1 is done AND
//   a new UTC day has started since N-1 was completed, OR
//   today's Daily has been finished (getDailyResult()) after N-1 was completed.
function isUnlocked(n, p) {
  if (n <= 3) return true;
  const prev = p.chapters[n - 1];
  if (prev.status !== 'done') return false;
  const doneDay = utcDay(new Date(prev.completedAt));
  if (doneDay < utcDay()) return true;
  const daily = getDailyResult();
  return !!(daily && daily.ts > prev.completedAt);
}
```

Locked chapter tiles show the countdown to the next UTC midnight
(`nextDailyAt()` / `formatCountdown()` already exist in `store.js`) and the
line `STORY.ui.lockedDaily`. When a chapter unlocks *because of* the Daily,
`track('story_unlock_daily', { chapter: n })`.

## 6. Area and "World saved"

Precompute once in `Story.init()` — approximate area of every country from
`BORDERS` (planar shoelace on an equal-area-ish projection; plenty accurate
for a percentage):

```js
function ringArea(ring) {                     // ring: [[lon, lat], ...]
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x1, y1] = ring[j], [x2, y2] = ring[i];
    const k = Math.cos(((y1 + y2) / 2) * Math.PI / 180);   // shrink longitude toward the poles
    a += (x1 * k) * y2 - (x2 * k) * y1;
  }
  return Math.abs(a / 2);
}
// AREA: Map<borderName, area>; TOTAL_AREA = sum. Skip 'Antarctica' — it would
// dominate the total and nobody's guessing it.
```

`worldSaved = 100 × (1 − Σ area(erased) ÷ TOTAL_AREA)`, rounded to one
decimal. The HUD chip shows it as `🌍 94%`; it pulses (CSS) when it drops.
Chapter score = `worldSaved` at the moment `onFound()` fires. Stars from
`chapter.stars` thresholds.

## 7. The ink

**Choosing what to erase** on each wrong guess (or clock tick):

```js
// target area this step = chapter.inkPerMiss (or modifier.inkPerTick) × TOTAL_AREA
// candidates = countries that are NOT: the mystery (or ch2's current Blot
//   location), already erased, already guessed, Antarctica.
// Before the pity threshold: also exclude anything within 3000 km of the
//   mystery or in ADJACENCY[mystery] — the ink must not leak the location.
// After `misses >= chapter.pityAfter`: candidates become ONLY the mystery's
//   neighbours (ADJACENCY, then the nearest countries by haversine for
//   islands like New Zealand) — "the ink bleeds toward its source".
//   Play the `pity` bark the first time this happens.
// Prefer candidates currently facing the camera (maybeVisible(geo)) so the
//   player sees it happen. Pick randomly (randomInt from store.js), adding
//   countries until the target area is reached (at least one per step).
```

Erased countries are drawn by `Story.drawUnder()` as ink (see the
animation doc), and returned by `Story.hiddenGeos()` so `drawAllLand()`
skips them. A guessed country is never erased; guessing an erased country
draws it in its heat colour as usual (guessed polygons draw after land).

**Trivia**: a right answer restores the most recently erased country
(animated), plays `triviaRight` with `{restored}`.

**Found**: the burn sequence restores *all* erased countries in a ripple.
The chapter's score was already captured.

## 8. Chapter modifiers

Each is a small strategy object in `story.js` keyed by `modifier.type`, with
optional methods: `start(run)`, `onGuess(entry)`, `tick(dt)`,
`hiddenGeos()`, `drawUnder(ctx)`, `drawOver(ctx)`, `arrowBearing(country)`,
`mirrored()`.

- **`none`** (ch 1) — nothing extra.
- **`jump`** (ch 2) — `startStoryRound` with `mystery = Libya`. In `onGuess`,
  if `!run.jumped` and the guess is Libya, adjacent to Libya, or within
  1500 km of it: set `run.jumped = true`, switch `mystery` to Egypt, play
  `jump` lines, then **re-score every guess**: recompute `distKm`/`temp` for
  each entry in `guesses`, rebuild `#history-list` (clear, re-add in order),
  reset `prevDistKm` to the last non-adjacent guess's distance, add the CSS
  class `reheat` to every row for the flash, and set `dirty = true`.
  If the triggering guess *is* Egypt, it's found immediately — play
  `jumpIntoGuess` instead and call `endGame(true)`. On resume with
  `run.jumped === true`, start directly with `mystery = Egypt`.
- **`fog`** (ch 3) — `hiddenGeos()` returns every geo whose centroid is more
  than `revealKm` from every guessed country (angular test:
  `dot(geoCentroid, guessUnitVector) < Math.cos(revealKm / 6371)`), so it is
  drawn as fog (ocean-coloured, no border) by `drawUnder`. `drawOver` draws
  the equator: `traceOpenLine` on a precomputed lat-0 polyline, amber,
  `globalAlpha` breathing 0.25–0.5.
- **`riddles`** (ch 4) — at each `afterMisses`, play the riddle as an `echo`
  line and append it to a pinned `#story-riddles` strip above the input.
- **`clock`** (ch 5) — `tick(dt)` accumulates `run.elapsed` only while: the
  game screen is visible, the tab is visible, no dialogue/trivia/dialog is
  open, and the chapter isn't found. Every `everySeconds`: erase
  `inkPerTick`, play a heartbeat (`StoryAudio.heartbeat()`), show a draining
  ring on the HUD chip. Time-based hints/Varka use `afterSeconds`. Wrong
  guesses add no ink in this chapter.
- **`mirror`** (ch 6) — `mirrored()` returns true → `view.mx = -1`. Lines
  with `reversed: true` render with the text reversed and the bubble class
  `mirrored`; tapping the bubble flips it (CSS `rotateY` transition) to read
  it the right way round. Arrows stay true.
- **`liar`** (ch 7) — the mystery is the home country (`detectHomeCountry`
  with the local games list, cached in `p.homeCountry`). `arrowBearing`
  returns the **opposite** of the true bearing (`N↔S`, `NE↔SW`, …). Each
  miss plays the next `glitch` line (last one repeats) instead of a heat
  bark, with Needle's `mood-glitch`. On find: no Blot, no burn — play
  `reveal`, then show the choice (§10).

## 9. Dialogue

Two surfaces (markup + styles in the animation doc):

- **Comms panel** — bottom sheet over the input bar, used for briefings,
  found/after-burn lines, the reveal and endings. Typewriter text; tap once
  to finish the line, tap again for the next; a **Skip** button ends the
  whole sequence. Varka lines use the handwriting style instead of a portrait.
- **Barks** — a small bubble beside a mini Needle at the top-left of the
  globe during the hunt. Auto-dismiss after `max(2200, 45ms × chars)`;
  a new bark replaces the old one. Never blocks input.

API inside `story.js`:

```js
playLines(lines, { onDone })   // comms panel sequence; handles {action} entries
bark(key, tokens)              // pick from chapter.barks[key] || STORY.barks[key]
varka(line, tokens)            // full-width handwriting overlay, ~3.5 s, tap to dismiss
fillTokens(text, extra)        // {name}, {time}, {games}, {saved}, {home}, …
```

**Bark selection**: per key, pick randomly from lines not among the last 3
shown (`recentBarks` array of texts); if all are recent, allow any.

**Which bark per guess** (in `onGuess`, not while restoring):
first guess → `first`; adjacent → `adjacent`; otherwise warmer/colder if
the trend element just showed one (50% chance), else the heat band
(`cold | cool | warm | hot`). After the guess, if ink was erased, queue an
`erase` bark 1.2 s later. Scheduled hints and Varka lines win over barks for
that guess.

**Tokens**: `{name}` = `cloudUsername || 'Lampbearer'`; `{time}` =
`new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })`;
`{games}` = `loadStore().games.length`; `{saved}` = current World saved with
`%`; `{home}` = home country name; `{guess}`, `{erased}`, `{restored}`,
`{blot}` from context.

## 10. The finale

`onFound()` in chapter 7: play `reveal`, then show `#story-choice` with two
buttons. **Break** is a hold-to-burn button (same component as the Blot
burn); **Keep** is a plain button. Neither has a timer.

On choice:
1. `p.choice = choice`; if `!p.choiceSubmitted` and online →
   `sb.rpc('submit_story_choice', { p_choice })`, then mark submitted.
2. `track('story_choice', { choice, first: !p.choiceSubmitted })`.
3. Play `STORY.endings[choice].lines` (with their actions, see animation doc).
4. Fetch `story_choice_stats()`; show `STORY.splitLine` with the % for the
   player's side (hide the line if offline or the call fails).
5. Credits (fill `{name}`), then post-credits (`break`: only if the average
   `bestSaved` across chapters ≥ `postCreditsIf`).
6. Share: `STORY.endings[choice].share` + story score + URL.

**Keep → the scar.** `Story.drawScar(ctx)` runs in every mode: if
`p.choice === 'keep' && !p.scarHidden`, draw a small irregular ink blot
(radius 5 px at zoom 1, scaled with zoom, 5–7 lobes) at `STORY.pointNemo`
using `latLonToXY`. It's in the open Pacific, touching no country. Add a
"Hide the scar" toggle in the account sheet. Also show a tiny Needle (24 px)
at the corner of the home Story card for "keep".

**The secret.** In the Map Journal, after the finale, each postcard shows its
seal letter. Tapping seals in the order N-E-E-D-L-E (any wrong tap resets)
opens `STORY.secretLetter` and sets `p.secretFound`;
`track('story_secret_found')`. Do not hint at this anywhere in the UI.

## 11. Screens and components

All markup lives in `index.html`, hidden by default:

- **Home Story card** — first card in `.mode-list`, class `mode-card story`.
  Title `STORY.ui.modeCardTitle`; desc = "Chapter N of 7 · X% of the world
  saved", or `STORY.subtitle` for new players; `NEW` badge until the cold
  open is seen.
- **`#story-screen`** — chapter select ("the map table"): 7 tiles with
  number, title (redacted when locked: keep the first and last letter, █ for
  the rest), stars, best %, lock countdown. Buttons: Map Journal, Sound
  on/off, Back.
- **`#story-card`** — full-screen chapter title card (letterbox).
- **`#story-comms`** — comms panel (portrait slot + text + Skip).
- **`#story-bark`** — bark bubble with mini Needle.
- **`#story-varka`** — full-width handwriting overlay.
- **`#story-burn`** — the HOLD TO BURN button (SVG progress ring).
- **`#story-postcard`** — flip card.
- **`#story-complete`** — stars, World saved, Share, cliffhanger, Continue.
- **`#story-choice`** — the two-button choice.
- **`#story-journal`** — Map Journal (postcards grid, seals, secret letter).
- **`#story-riddles`** — pinned riddle strip (ch 4).

Story mode sets `data-story="on"` on `#app` (and `data-chapter="n"`), which
`story.css` uses for the ink-and-lamplight palette and per-chapter tweaks.

## 12. Username and sound

- Opening story mode with no username (and `cloudStatus === 'ready'`) →
  `openUsername(() => Story.open(), { forced: true, reason: 'story', skipLabel: 'Skip for now', onSkip: () => Story.open(true) })`.
  Story works without a name (`{name}` falls back to "Lampbearer").
- First time entering chapter 1, ask `STORY.ui.soundPrompt` in the comms
  panel with two buttons. The tap that answers is the user gesture that lets
  `StoryAudio.unlock()` resume the AudioContext.

## 13. Analytics

All via the existing `track()` (props must not include home country, local
time or anything personal):

| Event | Props |
|---|---|
| `story_open` | `{ chapter_available }` (highest unlocked) |
| `story_cold_open_done` | `{ skipped }` |
| `story_chapter_start` | `{ chapter, mode: 'normal'\|'ink', resumed }` |
| `story_jump` | `{ chapter: 2, guesses }` |
| `story_pity` | `{ chapter, misses }` |
| `story_found` | `{ chapter, guesses, saved, seconds }` |
| `story_burn_cancel` | `{ chapter }` — let go of the hold early |
| `story_chapter_done` | `{ chapter, saved, stars, guesses, mode }` |
| `story_dialogue_skip` | `{ chapter, where: 'intro'\|'outro'\|'cold_open'\|'ending' }` |
| `story_unlock_daily` | `{ chapter }` |
| `story_choice` | `{ choice, first }` |
| `story_share` | `{ kind: 'chapter'\|'ending', chapter }` |
| `story_secret_found` | `{}` |
| `story_sound` | `{ on }` |

`trackAbandon()` already covers story (it reads `gameMode`).

**Dashboard** (`tools/dashboard`): add a **Story** tab — a funnel bar chart
of `story_chapter_start` vs `story_chapter_done` per chapter (the drop-off
between chapters is *the* number for this feature), average `saved` and
`guesses` per chapter, burn-cancel count, `story_choice` split, dialogue
skip rate, secret-found count. Follow the existing query/tile/table patterns
in `server.mjs` and the demo-data shapes.

## 14. Sharing

Chapter share text (spoiler-free — never the country name):

```
🥞 THE UNMAKING · Chapter 3 — Murk
🌍 92% of the world saved · ★★★
⬛⬛🟡🟠🔴🔥
Can you burn it faster? <url>
```

Squares are the guess temps (reuse `TEMP_ICON`; erased-by-ink steps aren't
shown), ending in 🔥. Also add a 1080×1080 image card in the style of
`buildShareImage()` in `scoring.js`: black, amber Lamp glow, chapter title in
IM Fell English, the %, the stars. Ending share: `endings[choice].share`,
story score, URL.

## 15. Performance and accessibility

- Target 60 fps on a mid-range Android. `drawAllLand` is the expensive call;
  story only forces continuous redraws while something is animating
  (`Story.isAnimating()`), never while idle.
- Embers ≤ 150 particles; no `shadowBlur` on the main canvas (fake glows with
  radial gradients); the ink noise pattern is an offscreen canvas made once.
- `prefers-reduced-motion`: no screen shake, no particles, no globe spin;
  fades only, durations halved. Typewriter becomes instant.
- Sound off by default. Every sequence skippable. Riddles and Varka lines
  stay readable (no auto-dismiss under 3 s; tap to dismiss).
- Colour is never the only signal: the World saved chip has a number; stars
  are shapes.
