# GlobeGame analytics dashboard

A local page that reads the Supabase database directly and turns it into growth numbers.
Pick a time range at the top; every headline figure is compared with the period before it (▲▼).

| Tab | What it answers |
|---|---|
| Overview | How many unique players (today, 7 and 30 days, stickiness), new vs returning per day, games, Daily participation, when people play (weekday × hour) |
| Acquisition | Where new players come from (share links, referring sites, campaigns), which channels play and come back, top inviters, viral factor |
| Activation | The new-player funnel: first game, first win, second game, tutorial, name, share, room, Google, back next day |
| Guide & features | Captain Reed's intro funnel (met him → named → first guess → finished → back another day), time to a name, rolled names kept, each tutorial tip shown vs tapped; 🔭 spyglasses earned/used/hidden and win rate with vs without one; Atlas opens and time; taps on his home facts and quiz; radar images shared, View globe, Classic board views, trivia repeats and capital questions |
| Retention | Day 1/3/7/14/30 and weekly cohorts, last week's players kept, players back after 2+ weeks away |
| Notifications | Who has them on (and on which devices), sent and opened per day and per kind, where we asked and what players said, and whether players with them on come back more |
| Engagement | Visit length, visits and games per player, live Daily streaks, everything else players use |
| Games · Daily | Modes, finish and win rates, guesses, how hard each Daily was |
| Social | Rooms, the hub, challenges (by region and pace), game nights, friends, the invite funnel |
| Sharing | What gets shared, how, and which shares actually bring new players |
| Collection | Passport, badges unlocked, trophy cabinet, Founding Players |
| Trivia · Story | Hardest questions; story mode drop-off and choices |
| Tech | Devices, OS, browsers, time zones, languages, app versions, load time, home banners |
| Live & players | Player **feedback** from the game's footer, the latest events, and a **player lookup** (by name or id) with where they came from and their full timeline |

## Where the numbers come from

The game sends events to `public.events` (see `analytics.js`). On top of game events it records:

- **Attribution** — links shared from the game carry `?s=<where>&r=<code>` (where: result, badge, founding,
  challenge, room, friend, duel, story; code: the first 8 characters of the sharer's random player id).
  The first visit's `app_open` keeps these plus the referring site and any `utm_source` / `utm_medium` /
  `utm_campaign`, so campaigns can use ordinary UTM links:
  `https://borderline.gamekatta.com/?utm_source=instagram&utm_campaign=launch_week`
- **Time on screen** (`session_time`), **load time** (`load_ms` on `app_open`) and the device's **time zone**.

Unique players are unique random player ids: one per browser for guests, one per account once someone
signs in with Google (so clearing browser data as a guest counts as a new player).

## First-time setup

1. Install Node.js 18+ (already installed if `node --version` works).
2. In this folder: `npm install`
3. Get the database connection string:
   Supabase → **Connect** (top bar) → **Session pooler** → copy the URI.
   It contains `[YOUR-PASSWORD]` — replace that with your database password
   (forgotten it? Supabase → Project Settings → Database → Reset database password).
4. `cp .env.example .env` and paste the URI after `DATABASE_URL=`.
5. Run `supabase/013_analytics.sql` once in the Supabase SQL editor (indexes that keep the dashboard fast).

## Run

    npm start        # opens http://localhost:4000
    npm run demo     # same dashboard on an in-memory demo database (no setup)

The demo builds a throwaway Postgres in memory from the project's own migrations and fills it with about
45 days of made-up players, so it runs exactly the same queries as the real thing (`queries.mjs`).

## Sending it to someone

**Export** (top right) makes a copy you can send:

- **PDF report**: every tab for the range on screen, one tab per page (A4 landscape, light theme), with
  the date range and when the data was taken at the top. The print dialog opens; pick **Save as PDF**.
- **Interactive HTML**: one `.html` file with the data for all four ranges built in. Whoever opens it
  can switch tabs and ranges and hover the charts, in any browser, offline, without the server or the
  database. It's a snapshot: it shows the numbers as they were when you exported it. It can be printed
  to PDF from there too.

Neither export includes the **Live & players** tab (the raw event log and player lookup). Player names
(top inviters) and room names are replaced with "Player 1", "Room 1"… unless you tick **Include player
and room names**.

The page refreshes itself every 5 minutes. Every query runs in a read-only transaction. Days and hours
are shown in IST.

`.env` holds your database password — it's git-ignored; never share or commit it.

### Passwords with special characters

The password sits inside a URL, so characters like `@ : / ? # % &` must be
encoded. Print the encoded form with:

    node -e "console.log(encodeURIComponent(process.argv[1]))" 'your-password-here'

and paste that into `.env` instead. (Or reset the database password to one
with only letters and numbers.)
