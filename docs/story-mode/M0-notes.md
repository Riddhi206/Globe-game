# M0 — Orientation notes

Verified `02-technical-spec.md` §3 against the real `game.js` on
`feature/story-mode` (commit `adcc5c2`), plus `store.js`, `scoring.js`,
`cloud.js`, `analytics.js`, `data.js`, `country-facts.js`. Every function the
spec names exists with the described shape. **No contradictions found** —
the spec can be followed as written. A few things worth knowing before you
write the hooks:

1. **`compassBearing` lives in `data.js`, not `game.js`.** Spec §2 lists it
   under "shared globals" without saying which file — it's still in the same
   global scope by the time `story.js` runs, so nothing to fix, just know
   where to look when chapter 7's `arrowBearing` needs to invert its N/NE/E/
   SE/S/SW/W/NW output (`02-technical-spec.md` §8, `liar` modifier).

2. **`resetRound()`'s extracted block sets `modeChip.textContent` via
   `MODE_LABEL[mode]`**, which is `{ daily, classic, endless }` only — for
   `gameMode === 'story'` that line evaluates to `undefined`. This is
   harmless exactly as the hook table already shows: `startStoryRound()`
   calls `resetRound()` and then immediately overwrites
   `modeChip.textContent = Story.chipLabel()` before `showScreen('game')`
   paints anything. No fix needed, just don't be surprised by the
   intermediate `undefined` if you log it.

3. **`endGame()`'s story branch returns before `clearCurrentGame`,
   `revealed = mystery`, `flyTo(mystery)` and `dirty = true` run** (real
   `endGame` does those between `guessForm.hidden` isn't reached — the story
   branch returns earlier). That's intentional: story has its own
   persistence (`Story.persist`, not `clearCurrentGame`) and its own camera
   beat. It means **`Story.onFound()` (M5) is fully responsible for its own
   `flyTo` and `dirty = true`** — `03-animation-audio.md` §5.3 already
   specs this (fly + zoom to 2.6), just confirming the real `endGame` won't
   do it for you in story mode.

4. **`view` (in `updateView()`) currently has only `{ cg, sg, ct, st, R }`** —
   no `mx`. Confirms the mirror field in spec §3/§8 is genuinely new for M6,
   not partially there already.

5. **`getDailyResult()` records include `.ts`** (`recordGame` in `store.js`
   sets `ts: Date.now()` on every game), so `isUnlocked()`'s
   `daily.ts > prev.completedAt` check (spec §5) is valid as written.

6. Confirmed present and matching the spec's description: `guessLimit`,
   `updateHud`, `persistCurrent`, `applyGuess`, `addHistoryItem`, `endGame`,
   `drawAllLand`, `drawGlobe`, `updateView`, `latLonToXY`, `traceRing`,
   `traceOpenLine`, `moveDrag`, `animate`, `revealTriviaAnswer`,
   `chooseMode`, `renderHome`, `openUsername` (already takes `{ forced,
   reason, onSkip, skipLabel }` — the `reason === 'story'` case in spec §12
   is a one-line addition to its existing subtitle switch), `boot`,
   `startGame`; `readJSON`/`writeJSON`/`utcDay`/`nextDailyAt`/
   `formatCountdown`/`getDailyResult`/`randomInt`/`dealCountry`/`loadStore`
   in `store.js`; `escHtml`/`buildShareText`/`buildShareImage`/`shareResult`
   in `scoring.js`; `track`/`flushEvents` in `analytics.js`; `countryFacts`
   in `country-facts.js`; `ADJACENCY.Libya` includes `Egypt` (ch2's jump
   trigger) and `ADJACENCY.Egypt` includes `Libya`.

Proceed to M1 as written.
