# THE UNMAKING — Build Plan for Sonnet

Eleven milestones, each small enough for one session, each ending in a
working, committed state. Do them **in order**: later milestones assume
earlier ones exist.

---

## How to work (read before M0)

- **Branch:** `feature/story-mode`. Commit at the end of every milestone,
  ending the message with the attribution line your session gives you.
  Push after each milestone.
- **Read first, every session:** this file, then the doc(s) the milestone
  names. `02-technical-spec.md` §1 (ground rules) every time.
- **Don't invent story text.** Every line is in `story-data.js`. If you need
  a line that doesn't exist, add it there and say so in the commit message.
- **Keep `game.js` changes to the hooks in `02-technical-spec.md` §3.** If
  you find yourself writing more than ~3 lines in `game.js` for one hook,
  move the logic into `story.js`.
- **Syntax-check** every JS file you touch: `node --check <file>`.
- **Test in a real headless browser.** This machine has Playwright at
  `/Users/kuldip/.npm/_npx/e41f203b7505f1fb/node_modules/playwright`
  (require it by that path). Serve the app with
  `python3 -m http.server 8765` from the repo root, and kill it after
  (`pkill -f "http.server 8765"`). Block Supabase to test offline:
  `page.route('**/*.supabase.co/**', r => r.abort())`. Skip the help sheet
  with `addInitScript(() => localStorage.setItem('pancake_seen_help', '1'))`.
  Collect `pageerror` events — zero is the bar.
- **Look at it.** Take screenshots at 390×800 (phone) for every new screen,
  in dark *and* light (`page.emulateMedia({ colorScheme })`), and read them.
- **Regression check after every milestone** (script it once, reuse it):
  play one Classic game to a win and one to a loss, open the Daily, open
  Stats, open the leaderboard — no page errors, and `loadStore().games`
  contains only `daily|classic|endless` modes.
- **Bump `CACHE` in `sw.js`** whenever you change or add a cached file, and
  add new files to `SHELL`.
- **Ask the user** before anything outward-facing: running SQL against
  Supabase is the user's job (give them the file to paste), as is deploying.

---

## M0 — Orientation (no code)

Read `01-game-design.md`, `02-technical-spec.md`, `03-animation-audio.md`.
Skim `game.js` (functions named in spec §3), `store.js`, `scoring.js`.
Write down any contradiction you find between the docs and the code and
resolve it in favour of the code's reality; note it in the M1 commit.

## M1 — Data, store, and the Story screen (no gameplay)

**Do:** copy `resources/story-data.js` and `resources/home-country.js` to the
repo root. Create `story.js` with: the progress store (spec §4: load, save,
defaults, `isUnlocked`), `Story.init()`, `Story.open()`,
`Story.renderHomeCard()`. Add the home Story card and `#story-screen` (chapter
select, spec §11) to `index.html`; create `story.css` with the tokens from
`03-animation-audio.md` §1–2 and basic styles. Wire `chooseMode('story')` and
`boot()` → `Story.init()`. Script order per spec §2. Update `sw.js`.

**Accept:** home shows the Story card (NEW badge) above Daily; tapping it
opens the chapter list; chapters 1–3 available, 4–7 locked with redacted
titles and a countdown; Back returns home; refresh keeps state; offline works;
regression check passes.

## M2 — Playable chapter 1, plain

**Do:** add `resetRound()` and `startStoryRound()` to `game.js` and every hook
from spec §3 except the drawing ones. In `story.js`: start a chapter
(`startStoryRound(country)`), `onGuess` (record misses, persist the run),
`onFound` (mark done, stars from a placeholder 100%, back to the chapter
list), `chipLabel`, `renderHud` (show guesses for now), `arrowBearing`
(normal), resume an in-progress run on reopen.

**Accept:** chapter 1 can be played to the end with normal Pancake feedback;
quitting mid-run and reopening resumes with the same guesses; finishing marks
it done with stars; no story game appears in `loadStore().games` or in the
Supabase `games` upload; regression check passes.

## M3 — The ink and World saved

**Do:** spec §6–7: area precompute, victim selection (incl. the pity bleed),
`hiddenGeos`, `drawUnder` with the ink pattern, erase/restore alpha
animation and drips (`03-animation-audio.md` §5.1), `isAnimating`, the
`🌍 %` HUD chip, trivia restore. Real stars from `chapter.stars`.

**Accept:** each wrong guess in chapter 1 visibly inks ~2% of land, never
near New Zealand before the pity threshold, and only its neighbours after;
World saved drops accordingly and is right after a refresh; a trivia win
restores the last inked country; the globe stops redrawing when idle (check
with a counter on `drawGlobe` calls); 60 fps-ish on the Playwright trace.

## M4 — Dialogue, barks, Varka, cold open, chapter card

**Do:** spec §9 and `03-animation-audio.md` §3–4: inline Needle SVG (twice,
ids prefixed for the small one), mood CSS, comms panel with typewriter +
skip, barks with no-repeat-last-3, Varka handwriting overlay, token filling,
chapter title card, the cold open (incl. the `burn-first-stain` action — for
now a simple tap-to-burn on one stain), username gate (spec §12),
`story_*` analytics from spec §13 that apply so far.

**Accept:** first open plays the cold open once (skippable); chapter 1 plays
intro → hunt with a bark on every guess and Varka at miss 3 → outro →
cliffhanger; no line repeats among the last three barks; `{name}`, `{time}`,
`{games}` fill correctly; every sequence is skippable; reduced motion shows
lines instantly.

## M5 — The Blot, hold to burn, postcard, chapter complete, share

**Do:** `03-animation-audio.md` §5.2–5.7 and spec §14: Blot creature, camera
zoom, HOLD TO BURN component (pointer + keyboard, cancel), the full burn
timeline, restoration wave, postcard (with foil chance, seal letter), the
chapter-complete screen, share text + image. Replace the cold open's
temporary tap with the real burn component.

**Accept:** finding the country → Blot rises → hold 1.2 s burns it (release
early cancels and logs `story_burn_cancel`) → flash/embers/shockwave/shake →
ink drains outward from the Blot → postcard → stars + % → share produces
spoiler-free text (no country name) and an image. Screenshot each beat and
look at them. Reduced motion: no shake/particles.

## M6 — Chapters 2–6 modifiers

**Do:** spec §8 `jump`, `fog`, `riddles`, `clock`, `mirror` as strategy
objects, plus each chapter's hints/Varka scheduling (miss- and time-based)
and Blot traits (§5.2).

**Accept, per chapter:**
- 2: guessing Algeria (adjacent to Libya) triggers the jump; all rows re-heat
  against Egypt; a refresh after the jump starts against Egypt; guessing
  Egypt as the trigger finds it immediately with the `jumpIntoGuess` lines.
- 3: only land near guesses is visible; the equator glows; fog lifts on burn.
- 4: riddles appear at misses 2/5/8 and stay pinned.
- 5: the clock inks every 8 s, pauses for dialogue, trivia and a hidden tab
  (verify with `document.hidden` emulation), resumes from `run.elapsed` after
  refresh; wrong guesses add no ink.
- 6: the globe is mirrored; dragging still feels natural; reversed lines flip
  on tap; arrows are true.

## M7 — Chapter 7, the choice, endings, the scar, the secret

**Do:** copy `home-country.js` usage (`detectHomeCountry(loadStore().games)`,
cached in progress), the `liar` modifier, glitch barks, the reveal, the
choice UI, both endings with their actions (`globe-spin`, `needle-shatter`,
`scar-appears`, `eye-opens-point-nemo`), credits, post-credits condition,
`drawScar` in every mode with the hide toggle, the tiny Needle on the home
card for "keep", the Map Journal with the N-E-E-D-L-E seal secret.

**Accept:** chapter 7's target is the detected home country (test with a
forced time zone: `browser.newContext({ timezoneId: 'Asia/Kolkata' })` → India,
`'Europe/Oslo'` → Norway); every arrow points the opposite way; heat is true;
both endings play fully; "keep" leaves the scar at Point Nemo in Classic and
Daily too, and the toggle hides it; replaying chapter 7 can change the
ending; the seal sequence opens the secret letter and nothing in the UI
hints at it; the home country never appears in any `track()` call (grep the
network posts).

## M8 — Audio, haptics, polish

**Do:** `story-audio.js` per `03-animation-audio.md` §6, the sound opt-in
prompt, wire every SFX, haptics table §7, the small touches §5.8, the
optional ambience. Respect reduced motion everywhere.

**Accept:** with sound off nothing makes a sound and the AudioContext is
never created; turning it on in the prompt plays sounds from then on and the
choice persists; no console errors on Safari-like `webkitAudioContext`
absence (guard it).

## M9 — Unlock cadence, server, analytics, dashboard

**Do:** the daily unlock rule with the Daily bypass (spec §5), copy
`resources/007_story.sql` to `supabase/007_story.sql`, `submit_story_choice`
+ `story_choice_stats` in the endings, story progress upload/merge
(spec §4 merge rules) via a `cloud.js`-style best-effort sync, all remaining
analytics events, the dashboard Story tab (spec §13).

**Ask the user** to run `supabase/007_story.sql` in the SQL editor before you
test the server parts. Until then, everything must degrade gracefully (no
split line, no sync, no errors).

**Accept:** chapter 4 unlocks the next UTC day, or right after finishing the
Daily (`story_unlock_daily` fires); the choice split shows a real % after the
SQL is applied; progress made on one browser profile appears on another
signed into the same Google account; the dashboard Story tab renders in
`npm run demo` and against the live database.

## M10 — Final QA and handoff

Run the full checklist below, fix what fails, update `README.md` (modes,
project structure, the new SQL file), bump `CACHE`, commit, push, and write
the user a summary: what works, what's untested (e.g. real iOS Safari, real
Android haptics), and anything you changed from the docs and why.

---

## QA checklist

- [ ] Cold open plays once, skippable, ends in chapter 1
- [ ] Every chapter playable start to finish, in order, on a 390×800 viewport
- [ ] Refresh mid-chapter resumes exactly (guesses, ink, jump state, clock)
- [ ] World saved % matches the inked area and survives refresh
- [ ] Pity bleed starts at the configured miss count
- [ ] No story game in `loadStore().games` or the Supabase `games` table
- [ ] Daily / Classic / Endless unchanged (regression script)
- [ ] Offline (Supabase blocked): everything playable, no errors
- [ ] Light and dark themes both screenshot-checked for every story screen
- [ ] Reduced motion: no shake, particles, spin; text instant
- [ ] Sound off by default; on/off persists
- [ ] Chapter 7 home detection: India, Norway, a fallback case
- [ ] Both endings; scar in all modes for "keep"; hide toggle works
- [ ] Secret letter via N-E-E-D-L-E seals only
- [ ] Shares never contain a chapter's country name
- [ ] No personal data in any `track()` payload
- [ ] `sw.js` lists every new file; `CACHE` bumped
- [ ] Dashboard Story tab: demo and live

---

## Kickoff prompt (paste into Sonnet for each milestone)

> You're building story mode ("The Unmaking") for the Pancake geography game
> at /Users/kuldip/Desktop/Games/Pancake, on the git branch
> `feature/story-mode`. The design, script and specs are in
> `docs/story-mode/`. Start by reading `docs/story-mode/04-build-plan.md`
> ("How to work"), then do **milestone M<N> only**, following the docs it
> names. Don't write new story text — use `story-data.js`. Test in headless
> Playwright as the plan describes, look at your screenshots, run the
> regression check, then commit and push. Finish by telling me what you
> built, what you verified, and anything you had to change from the docs.

Replace `M<N>` with the milestone. For M9, run the SQL yourself in the
Supabase SQL editor when Sonnet asks.
