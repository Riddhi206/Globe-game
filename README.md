# GlobeGame 🌍

Find the mystery country on the globe. Every guess lights up with a colour showing how close you are — the warmer, the nearer.

Pure HTML, CSS and JavaScript — no frameworks, no build step.

## Modes

- **Daily** — one country for everyone, 10 guesses. Resets at 00:00 UTC. Results are verified
  server-side and ranked on the Daily leaderboard by points (then earliest). Points *are* the rank:
  found in 1 = 1,000; found in n = (11 − n) × 100 + aim (0–99, how close your guesses before the answer
  landed on average); not found = 0–99 from your closest guess. The server works the points out itself
  from the guess list (`supabase/021_scoring.sql`); the app's own number is only for display.
- **Classic** — a random country, unlimited guesses, scored like the Daily. A weekly global Classic
  leaderboard (Monday 00:00 UTC) ranks the total of each player's best 10 finds that week, scored on the
  server from the synced guess lists (`supabase/022_classic_leaderboard.sql`). No sharing: that's the
  Daily's. (Classic and Endless were merged; old Endless games count as Classic.)
- **The Unmaking** (story mode) — seven chapters. Each hides an ink Shadow in a country; every wrong
  guess lets the ink erase a little more of the map, and the score is the % of the world still
  saved when you find it and hold to burn it. Chapters 2–6 each bend the rules (the Shadow moves,
  fog, riddles, a clock, a mirrored globe); chapter 7 points home and ends in a choice. Chapters
  1–3 are open from the start; each later one opens a day after the previous, or right away once
  you've played that day's Daily. Story games never touch the `games` table or the stats.
- **THE SIGNAL** (pilot, behind the `signal` switch) — a thriller told in text messages. Meera Joshi,
  a Delhi journalist, texts you from a locked-down company phone (no maps, no location) wherever she's
  held; she can only send fragments (through a door crack, a rusty hole, a dirty window). You find her
  by dropping a pin on the globe; each miss unlocks the next clue and a direction. Choices are timed and
  matter: they change her trust in you, give or take a pin in the next hunt, and come back later.
  Trust (found fast = more, lost = less) decides her greeting each episode and which of 3 endings
  Act 1 lands on; Act 1 can be replayed for the others. One episode unlocks at the next 7 PM at least
  12 hours after the last. Messages read at a relaxed pace by default (1× / 2× / 3× in the chat header).
  Admins skip the wait; a manager can too by opening `?signal=dev` once.

**Notifications** (once set up, see `docs/PUSH.md`): a Daily reminder at each player's chosen time, a
streak saver before the 00:00 UTC reset, come-back nudges after 3, 7 and 14 days away, and alerts for
friend requests, room challenges and game nights. Asked for only after a Daily or joining a room, never
on the first visit; works on Android, desktop and iPhones with GlobeGame on the Home Screen (iOS 16.4+).

**Captain Reed** is the game's guide: the worst navigator on the Seven Seas, lost aboard *The Wrong
Way* for 300 years, with Gerald, his deadpan parrot. Every morning his map shows a new mystery land; he
can't read maps, so the player is his navigator. A first visit goes straight into the Daily, with three
**starter picks** (big countries far apart, one tap each) so the first guess needs no typing. He says
nothing before the first guess, then coaches the next few with a face to match (blue = shocked, red =
cheering). When that first game is over, his ship scene plays at sunset: three lines (skippable: come
back tomorrow, beat the world), the last one asking for the player's name (not skippable, pre-filled
with a rolled pirate name, 🎲 for another), which puts that first score on the leaderboard; it's saved
straight away, or held until the cloud is ready. After
that he stays on: a line on every result sheet (with Gerald's retorts) and a greeting on the home screen
that tells a joke or a true geography fact when tapped. He's drawn in SVG with nine moods (`captain.js`);
everything he says is in `captain-data.js`. Players who arrive on a room invite skip the scene.
**Share image: the hunt radar** (`drawRadar` in scoring.js): the mystery country is the bullseye and
each guess a numbered dot at its real distance and compass direction from it, on rings at the heat
bands, joined in order. No map, so nothing is spoiled. It's also on the result sheet. A result reopened
from home has **View globe** too: the finished game is replayed on the globe from its guess list.

**Trivia** picks questions that don't give themselves away (no "…is in which country?" about the
country you just guessed, no answer spelled out in the question), one per answer (some facts were
in data.js twice), ones this device hasn't seen first (`pancake_trivia_seen`), and "What is the
capital of…?" only when nothing else is left. The **hints** a right answer wins are the question
itself with the country's name hidden ("…sacred in this country's majority religion? Cow").

**Atlas and the 🔭 Spyglass** (`spyglass.js`): the 🗺️ in the home screen's top bar opens the Atlas,
the globe with every country named, to explore any time. In a Daily, a 🔭 spyglass shows every name
on the globe for the rest of that Daily. Players earn one for every 5 Dailies in a row and can hold
up to 3; while full, the count toward the next waits until one is spent, and a missed day resets it.
New players start with 2 (a short tip on their 2nd guess explains it); existing players get a one-time
tip when they next open a Daily. The Daily result shows progress (🔭 3/5). Names are drawn by
`drawCountryLabels` in game.js: biggest countries first, overlapping names skipped, so zooming reveals
more. Stored on the device only (`pancake_spyglass`); it doesn't change the score.

Small tips (`Tips` in `coach.js`) point at what isn't obvious the first time: the search bar when the
first game starts, then on the first guess its distance and (Next) its direction arrow, with a mini
compass. Each shows once per device; players with 5+ games skip the guess tips.

Trivia is opt-in: from the 5th guess a **🎁 Win a hint** button sits above the input (and comes back 3
guesses after each question). It asks a timed multiple-choice question about the last guess; a right
answer wins a hint about the mystery country. Story mode still asks every 3rd guess. Trivia never changes the score.

**After every guess** the trend line under the globe says how far (first guess) or warmer/colder, and in
the Daily and Classic which way to head ("Colder · ← head west"). A Daily's result ends with the reason to
come back: tomorrow's country countdown, the streak, spyglass progress, and "You beat N% of today's players"
(from the leaderboard's top 50, so exact while fewer than 50 play, or when you beat all of them).

**New players see the core game only** (`settledPlayer()` in game.js): Story, Rooms, the Signal, the Atlas
and Classic's weekly board appear after 3 different days played (or 15 games). Someone already in a room,
or who has begun the Story or the Signal, keeps seeing them.

## Colours

| Colour | Distance |
|--------|----------|
| 🔴 Hot | < 1,500 km |
| 🟠 Warm | 1,500 – 4,000 km |
| 🟡 Cool | 4,000 – 8,000 km |
| 🔵 Cold | > 8,000 km |
| 🟣 | Shares a border |
| 🟢 | Found it |

## Project structure

```
index.html     markup: home, game screen, dialogs
style.css      monochrome theme (light/dark); heat colours are the only colour
countries.js   country list (name, ISO code, flag, centroid)
borders.js     country polygons for the globe
data.js        adjacency, trivia questions, compass helper
trivia-options.js  multiple-choice options: hand-written wrong answers + generated ones
store.js       local player data: games, stats, Daily streak, in-progress games (UTC days)
cloud.js       Supabase: anonymous-first auth, Google sign-in, game sync
analytics.js   product events (Supabase), Cloudflare Web Analytics + Sentry when configured
scoring.js     score formula, share text + share image
i18n.js        text helpers: visible text goes through t() (English only for now; translations in progress)
spyglass.js    the 🔭 spyglass (earn, hold up to 3, spend in a Daily) and the Atlas switch for country names
coach.js       first-game walkthrough: one tip from the Captain per guess, shown once
captain-data.js  Captain Reed and Gerald: the intro, coaching, result lines, greetings and jokes (edit text here)
captain.js     the Captain: SVG art and moods, the ship, the first-visit scene and name step, the guide bubble,
               result lines, the home greeting
captain.css    the Captain's animations, the sunset scene, his speech bubbles
rooms.js       rooms: room list/screen, invite links, the Daily league, live game nights + TV view
game.js        globe renderer, game loop, UI
story-data.js  story mode: every line of dialogue and every chapter rule, as data (edit text here)
story.js       story mode engine: progress, ink, dialogue, the burn, chapter modifiers, endings, sync
story-audio.js story mode sound, all synthesised with WebAudio (off until the player opts in)
story.css      story mode styles and animations
home-country.js  on-device home-country guess for chapter 7 (time zone → language → history)
pin.js         Pin Drop: drop a pin on the globe, distance scoring, reveal. Mode-agnostic (THE SIGNAL
               today, a daily city mode later): callers pass a target and callbacks
signal-data.js THE SIGNAL: every episode, message, clue, choice and photo, as data (edit text here)
signal.js      THE SIGNAL engine: chat, typing, SVG photos and characters, voice notes, hunts, choices,
               glitch cliffhangers, end card, season menu, unlock timing, sound
signal.css     THE SIGNAL styles and animations, and the Pin Drop panel
feedback.js    the footer's Feedback sheet: bug / idea / other, optional reply email, saved drafts offline
notify.js      push notifications in the app: when to ask, each platform's case (iPhone home screen, in-app
               browsers, blocked…), subscribing, the settings sheet, and where a tapped notification lands
privacy.html   privacy policy
sw.js          service worker: offline support for the installed app
manifest.webmanifest, icons/   installable web app (icons from Noto Emoji, Apache 2.0)
supabase/      SQL to run in order in the Supabase SQL editor: schema.sql, 002_leaderboard.sql,
               003_daily_answers.sql (generated — re-run gen-daily-answers.js if countries.js changes),
               004_friends.sql, 005_events.sql, 006_notifications.sql, 007_story.sql (story mode:
               ending-choice split + cross-device story progress), 008_roles.sql (roles + feature switches),
               009_rooms.sql (rooms + game nights), 010_rooms_keys.sql (repair), 011_rooms_hub.sql (rooms for
               everyone, emoji, challenges, activity feed), 012_country_continents.sql (generated by
               gen-country-continents.js — re-run if countries.js changes), 013_analytics.sql (dashboard indexes), 014_rooms_fixes.sql (any member starts
               a game night, 2-player minimum, no duplicate players, 3-day activity),
               015_signal.sql (THE SIGNAL: choices + "% chose the same", `signal` switch),
               016_night_presence.sql (leave a game night without leaving the room; nights nobody
               is in stop showing LIVE), 017_push.sql (push notifications: subscriptions, settings,
               what's due when), 018_push_cron.sql (runs the push function every minute; edit first);
               functions/push/ is the Edge Function that sends them (setup: docs/PUSH.md);
               019_feedback.sql (the footer's Feedback sheet; read it in the dashboard's Live & players tab);
               020_country_points.sql (generated by gen-country-points.js: country centres for scoring),
               021_scoring.sql (Dailies scored on the server, points = rank, old Dailies re-scored);
               022_classic_leaderboard.sql (the weekly Classic board: best 10 finds, server-scored);
               queries/insights.sql has ready-made reports, queries/roles.sql the role/feature snippets
docs/story-mode/  story mode design, technical spec, animation/audio spec and build plan
tools/push/    vapid-keys.mjs: makes the push keys (once)
tools/dashboard/  local analytics dashboard: acquisition, activation, retention cohorts, social, sharing,
                  player lookup (see its README; `npm run demo` needs no database)
```

Progress is stored in the browser (`localStorage`) first, so the game works offline. Every visitor
gets an anonymous Supabase user; "Continue with Google" links Google to that same user, and games
sync to the `games` table. Supabase setup: run `supabase/schema.sql`, and in Authentication enable
the Google provider, anonymous sign-ins and manual linking.

Story mode keeps its own progress in `localStorage` (`pancake_story_v1`) and, once
`supabase/007_story.sql` has been run, syncs it to `story_progress` (best scores win; the detected
home country and in-progress chapters never leave the device). Before that SQL exists everything
still works — there's just no cross-device sync and no "% of players chose this" line.

## Rooms

"Play with friends" on the home screen opens the hub: create or join rooms, live game nights and
challenges waiting on you, your rooms, a quick duel link, and your friends. Anyone with a leaderboard
name can create up to 3 rooms (admins and managers: 20) and pick its emoji; anyone joins with its
6-letter code or invite link (`?room=CODE`, plus `&ch=ID` to land on a challenge). A Google
account isn't needed. A player can be in 10 rooms; a room holds 50.

- **Challenges** — any member starts one: 5 countries the server picks (World or one region; never
  today's or tomorrow's Daily answer), open 24 hours, played whenever suits. Relaxed: 10 guesses a
  country; Speed: 60 seconds. Each round starts on the server's clock and is scored there (1000 − 100
  per extra guess, + up to 300 for speed). Countries stay hidden until you've played them. Rematch
  starts a fresh one with the same settings. A room has at most 3 open at once.
- **Activity** — the room sheet shows the last 3 days: Daily results, joins, challenges started and
  finished, game night winners.

- **Daily league** — between meetups, the room ranks its members' normal Daily results (the same
  server-checked scores as the global leaderboard): today, this week, all-time, plus streaks.
- **Game nights** — at a meetup the host starts a night (3–10 rounds of 1–3 minutes). Each round the
  server picks a country, everyone hunts it on their phone against the clock, and a live scoreboard
  follows; points for fewer guesses and speed. "Show on a TV" gives a big-screen scoreboard link
  (`?tv=<night>`) that never shows the country before the reveal. Nights are kept in the room's
  history and all-time standings; they never count toward anyone's stats or global ranks.

Any member can start a game night (whoever starts it hosts it; round 1 needs 2 players). Leave on the night board takes you
out of the night and back to the room (your points stay if the game has started; if the host leaves, the
next player hosts; the last one out ends it). Back during a round returns to the night board. A night
counts as live only while someone has it open: one nobody has looked at for 2 minutes is over. The room's creator (or an admin) manages it: rename, new invite link (the old one stops
working), remove members, close the room. Every rule is enforced in `supabase/009_rooms.sql`.

## Roles and feature switches

`supabase/008_roles.sql` adds roles — **admin**, **manager**, **tester**; everyone else is a player —
and named feature switches. A switch is on for the roles listed on it (admin always gets everything),
or for everyone. The app reads the current player's access once per sign-in (`my_access()`) and caches
it for offline; server-side features must also check `has_feature()` in SQL, since the app's check
only decides what's shown.

| Switch | On for | What it gates |
|---|---|---|
| `story` | admin, manager, tester | Story mode (beta) |
| `rooms_create` | admin, manager | More rooms: 20 own rooms instead of 3, no 10-room membership cap |
| `signal` | admin, manager | THE SIGNAL story pilot |

Roles are granted only in the Supabase SQL editor (players can't change their own), and only to
Google-signed-in accounts. Snippets for granting roles, launching a feature to everyone, etc. are in
`supabase/queries/roles.sql`.

## Run locally

Any static server works:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```
