// demo-db.mjs — `npm run demo`: an in-memory Postgres (PGlite) built from the
// project's own migrations and filled with ~45 days of made-up players, so the
// dashboard's real queries run against realistic data with no database.

import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SQL_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'supabase');
const MIGRATIONS = ['schema.sql', '002_leaderboard.sql', '003_daily_answers.sql', '004_friends.sql', '005_events.sql',
                    '008_roles.sql', '009_rooms.sql', '010_rooms_keys.sql', '011_rooms_hub.sql', '012_country_continents.sql',
                    '013_analytics.sql', '014_rooms_fixes.sql', '016_night_presence.sql', '017_push.sql', '019_feedback.sql'];

// Supabase's auth schema, as far as the migrations need it
const AUTH_STUB = `
  create role anon; create role authenticated; create role service_role;
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}',
                           is_anonymous boolean default true, created_at timestamptz default now());
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create function auth.role() returns text language sql stable as $$ select 'authenticated' $$;
  create function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;`;

// ---------------------------------------------------------------- random helpers
let seed = 20261005;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const pick = arr => arr[Math.floor(rnd() * arr.length)];
const weighted = pairs => { const t = pairs.reduce((a, [, w]) => a + w, 0); let r = rnd() * t; for (const [v, w] of pairs) { if ((r -= w) <= 0) return v; } return pairs[0][0]; };
const uuid = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.floor(rnd() * 16); return (c === 'x' ? r : (r & 3) | 8).toString(16); });
const DAY = 86400000;

const NAMES = ['atlas', 'mapnerd', 'globetrotter', 'kiwi', 'nomad', 'compass', 'meridian', 'pixel', 'riddhi', 'arjun', 'zara', 'leo', 'mira', 'dev', 'ana',
  'tomas', 'priya', 'kai', 'noor', 'sam', 'ivy', 'omar', 'luca', 'yuki', 'ravi', 'emma', 'jay', 'sana', 'felix', 'aria'];
const COUNTRIES = ['Peru', 'Kenya', 'Japan', 'France', 'Chile', 'Nepal', 'Egypt', 'Norway', 'Ghana', 'Vietnam', 'Mexico', 'Iran', 'Spain', 'Brazil', 'Laos'];
const BADGES = ['founding-player', 'first-find', 'bullseye', 'quiz-whiz', 'bold-opener', 'on-a-roll', 'stamped', 'night-owl', 'regular', 'week-warrior'];
const CHANNELS = [
  [{ referrer: '' }, 30], [{ referrer: 'web.whatsapp.com' }, 10], [{ referrer: 'www.google.com' }, 8], [{ referrer: 'l.instagram.com' }, 5],
  [{ referrer: '', src: 'result' }, 12], [{ referrer: '', src: 'challenge', kind: 'challenge' }, 9], [{ referrer: '', src: 'room', kind: 'room' }, 8],
  [{ referrer: '', src: 'friend', kind: 'friend' }, 4], [{ referrer: '', src: 'duel' }, 3], [{ referrer: '', src: 'badge' }, 2],
  [{ referrer: 't.co', src: 'x', campaign: 'launch_week', medium: 'social' }, 4], [{ referrer: 'www.reddit.com' }, 3], [{ referrer: 'news.ycombinator.com' }, 2],
];
const DEVICES = [[{ device: 'phone', os: 'android', browser: 'chrome' }, 46], [{ device: 'phone', os: 'ios', browser: 'safari' }, 24],
  [{ device: 'desktop', os: 'windows', browser: 'chrome' }, 14], [{ device: 'desktop', os: 'macos', browser: 'safari' }, 7],
  [{ device: 'phone', os: 'android', browser: 'samsung' }, 5], [{ device: 'tablet', os: 'ios', browser: 'safari' }, 4]];
const TZS = [['Asia/Kolkata', 62], ['Asia/Dubai', 6], ['Europe/London', 7], ['America/New_York', 8], ['Asia/Singapore', 5], ['Australia/Sydney', 3], ['Europe/Berlin', 4], ['America/Los_Angeles', 5]];
// IST hour weights: lunch and an evening peak
const HOURS = Array.from({ length: 24 }, (_, h) => [h, h < 6 ? 1 : h < 9 ? 4 : h < 12 ? 5 : h < 14 ? 7 : h < 18 ? 5 : h < 21 ? 10 : h < 23 ? 12 : 4]);

// IST midnight, `daysAgo` days back, as a UTC ms timestamp
function istMidnight(daysAgo) {
  const ist = Date.now() + 5.5 * 3600000;
  return Math.floor(ist / DAY) * DAY - 5.5 * 3600000 - daysAgo * DAY;
}

// ---------------------------------------------------------------- build
export async function makeDemoDb() {
  const db = new PGlite();
  await db.exec(AUTH_STUB);
  for (const f of MIGRATIONS) {
    try { await db.exec(fs.readFileSync(path.join(SQL_DIR, f), 'utf8')); }
    catch (e) { throw new Error(`demo database: ${f}: ${e.message}`); }
  }
  await seedDemo(db);
  return db;
}

async function seedDemo(db) {
  const DAYS = 45, now = Date.now();
  const users = [], events = [], games = [], dailies = new Map();
  const ev = (u, session, name, props, ts) => { if (ts <= now) events.push({ user_id: u.id, session_id: session, name, props, context: u.ctx, created_at: new Date(ts).toISOString() }); };

  // Players arrive faster as the game grows
  for (let d = DAYS - 1; d >= 0; d--) {
    const arrivals = Math.round(3 + (DAYS - d) * 0.32 + rnd() * 4);
    for (let i = 0; i < arrivals; i++) {
      const dev = weighted(DEVICES);
      const u = {
        id: uuid(), day0: d, land: weighted(CHANNELS), stick: rnd(),
        named: rnd() < 0.55, google: rnd() < 0.18, story: rnd() < 0.22,
        ctx: { v: weighted([['2026.10.05', 6], ['2026.10.02', 3], ['2026.09.29', 1]]), ...dev, screen: dev.device === 'desktop' ? '1920x1080' : '390x844',
               lang: weighted([['en-IN', 50], ['en-US', 20], ['hi-IN', 10], ['en-GB', 8], ['mr-IN', 4], ['de-DE', 3], ['ja-JP', 2]]),
               app: rnd() < 0.12, theme: rnd() < 0.6 ? 'system' : 'dark', tz: weighted(TZS) },
      };
      u.username = u.named ? `${pick(NAMES)}_${users.length}` : null;
      users.push(u);
    }
  }
  // Viral arrivals point back to an earlier player
  for (const u of users) if (u.land.src && u.land.src !== 'x') {
    const older = users.filter(o => o.day0 > u.day0);
    if (older.length) u.land = { ...u.land, ref: pick(older).id.replace(/-/g, '').slice(0, 8) };
  }

  for (const u of users) {
    let played = 0, firstSession = true;
    for (let d = u.day0; d >= 0; d--) {
      const age = u.day0 - d;
      const active = age === 0 || rnd() < (0.12 + 0.6 * u.stick) * Math.exp(-age / (8 + 30 * u.stick));
      if (!active) continue;
      const sessions = 1 + (rnd() < 0.3 ? 1 : 0) + (rnd() < 0.08 ? 1 : 0);
      for (let s = 0; s < sessions; s++) {
        const session = uuid();
        let t = istMidnight(d) + weighted(HOURS) * 3600000 + rnd() * 3500000;
        const step = () => (t += 15000 + rnd() * 90000);
        ev(u, session, 'app_open', firstSession
          ? { ...u.land, first_visit: true, games_played: 0, load_ms: Math.round(350 + rnd() * (u.ctx.device === 'desktop' ? 600 : 1400)) }
          : { referrer: '', first_visit: false, games_played: played, load_ms: Math.round(300 + rnd() * 900) }, t);
        const dayKey = `${u.id}|${new Date(t).toISOString().slice(0, 10)}`;
        // First visit: Captain Reed's intro, the name, the coached first game
        if (firstSession) {
          ev(u, session, 'captain_intro_start', {}, step());
          if (rnd() < 0.3) ev(u, session, 'captain_intro_skip', { at: Math.floor(rnd() * 2) }, step());
          if (rnd() < 0.86) {
            const rolls = rnd() < 0.3 ? 1 + Math.floor(rnd() * 3) : 0;
            ev(u, session, 'captain_name_set', { kept_rolled: rnd() < 0.62, rolls, seconds: Math.round(6 + rnd() * 30) }, step());
            ev(u, session, 'captain_intro_done', { steps: 3 }, step());
          }
          ev(u, session, 'tip_shown', { tip: 'search' }, step());
          if (rnd() < 0.7) ev(u, session, 'tip_action', { tip: 'search', action: rnd() < 0.6 ? 'typed' : 'ok' }, step());
        }
        // The Daily, once a day
        if (!dailies.has(dayKey) && (firstSession || rnd() < 0.78)) {
          ev(u, session, 'game_start', { mode: 'daily', resumed: false }, step());
          if (firstSession && rnd() < 0.92) {
            ev(u, session, 'tutorial_step', { step: 1, mode: 'daily' }, step());
            for (const tip of ['distance', 'direction']) {
              ev(u, session, 'tip_shown', { tip }, step());
              if (rnd() < (tip === 'distance' ? 0.74 : 0.61)) ev(u, session, 'tip_action', { tip, action: tip === 'distance' ? 'next' : 'ok' }, step());
            }
            ev(u, session, 'tip_shown', { tip: 'spyglass', fresh: true }, step());
            if (rnd() < 0.5) ev(u, session, 'tip_action', { tip: 'spyglass', action: 'ok' }, step());
          }
          const spy = rnd() < (firstSession ? 0.35 : 0.08);
          if (spy) { ev(u, session, 'spyglass_open', { have: 2 }, step()); ev(u, session, 'spyglass_use', { have: 1, guesses: 2 }, step());
                     if (rnd() < 0.15) ev(u, session, 'spyglass_toggle', { hidden: true }, step()); }
          const quit = rnd() < 0.08;
          const won = rnd() < 0.68, guesses = won ? 1 + Math.floor(rnd() * 9) : 10;
          for (let k = 0; k < Math.floor(guesses / 3); k++) {
            ev(u, session, 'trivia_shown', { mode: 'daily', capital: rnd() < 0.07, fresh: rnd() < 0.9, guess: 3 * (k + 1) }, step());
            if (rnd() < 0.1) { ev(u, session, 'trivia_skip', {}, step()); continue; }
            const correct = rnd() < 0.6;
            ev(u, session, 'trivia_answer', { q: pick(['What is the capital of Kazakhstan?', 'Which river flows through Vienna?', 'What is the currency of Kenya?']),
              country: pick(COUNTRIES), correct, picked: correct ? 'right' : pick(['Almaty', 'Rhine', 'Dalasi']), timeout: !correct && rnd() < 0.2 }, step());
          }
          if (quit) ev(u, session, 'game_abandoned', { mode: 'daily', guesses: Math.floor(guesses / 2), trigger: 'tab_hidden' }, step());
          else {
            const won2 = won || (spy && rnd() < 0.5);   // a spyglass helps a little
            const score = won ? 1000 - 80 * (guesses - 1) + Math.round(rnd() * 300) : 0;
            ev(u, session, 'game_end', { mode: 'daily', won: won2, guesses: won2 && !won ? 9 : guesses, score, trivia: Math.floor(guesses / 3), spyglass: spy }, step());
            if (rnd() < 0.3) ev(u, session, 'result_globe_view', { mode: 'daily' }, step());
            games.push({ user_id: u.id, mode: 'daily', won, guess_count: guesses, score, played_at: new Date(t).toISOString(), day: new Date(t).toISOString().slice(0, 10) });
            if (u.named) dailies.set(dayKey, { user_id: u.id, day: new Date(t).toISOString().slice(0, 10), won, guess_count: guesses, score: Math.max(score, 0), created_at: new Date(t).toISOString() });
            played++;
            if (firstSession) { ev(u, session, 'tutorial_done', { reason: 'game_end', guesses, mode: 'daily' }, step()); }
            if (rnd() < 0.16) { const method = weighted([['native', 6], ['whatsapp', 3], ['copy', 2], ['image', 2]]);
              ev(u, session, 'share', { method, mode: 'daily', radar: method === 'image' }, step()); }
            if (!firstSession && (played + 1) % 5 === 0) ev(u, session, 'spyglass_earn', { have: 1, streak: played + 1 }, step());
            if (rnd() < 0.25) ev(u, session, 'badge_card_shown', { badge: firstSession ? 'founding-player' : pick(BADGES) }, step());
          }
        }
        // Classic practice
        for (let c = 0; c < (rnd() < 0.4 ? 1 + Math.floor(rnd() * 3) : 0); c++) {
          ev(u, session, 'game_start', { mode: 'classic', resumed: false }, step());
          if (rnd() < 0.15) { ev(u, session, 'game_abandoned', { mode: 'classic', guesses: 3, trigger: 'back_button' }, step()); continue; }
          const g = 2 + Math.floor(rnd() * 12);
          ev(u, session, 'game_end', { mode: 'classic', won: true, guesses: g, score: 0, trivia: 0 }, step());
          games.push({ user_id: u.id, mode: 'classic', won: true, guess_count: g, score: 0, played_at: new Date(t).toISOString(), day: new Date(t).toISOString().slice(0, 10) });
          played++;
        }
        // Captain Reed on the home screen, the Atlas, a result reopened from home
        if (rnd() < 0.22) for (let k = 0; k < 1 + Math.floor(rnd() * 4); k++) {
          const quiz = k % 3 === 2;
          ev(u, session, quiz ? 'captain_quiz' : 'captain_fact', { n: k }, step());
          if (quiz && rnd() < 0.8) ev(u, session, 'captain_quiz_answer', { n: k }, step());
        }
        if (rnd() < 0.07) { ev(u, session, 'atlas_open', {}, step()); ev(u, session, 'atlas_close', { seconds: Math.round(15 + rnd() * 150), zoom: 1.3 }, step()); }
        if (rnd() < 0.05) ev(u, session, 'result_globe_replay', { mode: 'daily' }, step());
        if (rnd() < 0.06) ev(u, session, 'leaderboard_view', { scope: 'all', which: 'today', board: 'classic' }, step());
        // Everything else people poke at
        const extras = [['leaderboard_view', 0.3], ['stats_open', 0.15], ['passport_open', 0.12], ['badge_viewed', 0.05], ['rooms_open', 0.14],
          ['hints_open', 0.1], ['help_open', 0.05], ['duel_click', 0.02], ['room_invite_share', 0.025], ['challenge_share', 0.03], ['invite_share', 0.015], ['badge_share', 0.02]];
        for (const [name, p] of extras) if (rnd() < p) ev(u, session, name, {}, step());
        if (u.ctx.device !== 'desktop' && !u.ctx.app && rnd() < 0.2) {
          ev(u, session, 'banner_shown', { banner: 'install' }, step());
          if (rnd() < 0.15) ev(u, session, 'banner_click', { banner: 'install' }, step());
          else if (rnd() < 0.3) ev(u, session, 'banner_dismiss', { banner: 'install', times: 1 }, step());
        }
        if (firstSession && u.named) ev(u, session, 'username_set', {}, step());
        if (firstSession && u.land.kind === 'room') ev(u, session, 'room_join', { via: 'link' }, step());
        if (u.story && rnd() < 0.5) {
          ev(u, session, 'story_open', {}, step());
          const ch = 1 + Math.min(6, Math.floor(age / 2));
          ev(u, session, 'story_chapter_start', { chapter: ch }, step());
          if (rnd() < 0.75) ev(u, session, 'story_chapter_done', { chapter: ch, saved: 70 + Math.round(rnd() * 28), guesses: 3 + Math.round(rnd() * 6) }, step());
          if (ch === 7 && rnd() < 0.6) ev(u, session, 'story_choice', { choice: rnd() < 0.55 ? 'keep' : 'break', first: true }, step());
        }
        ev(u, session, 'session_time', { seconds: Math.round(40 + rnd() * (rnd() < 0.2 ? 1500 : 420)) }, step());
        firstSession = false;
      }
    }
  }

  // ---- write players, events, games and Daily scores
  const insertJson = async (sql, rows) => { for (let i = 0; i < rows.length; i += 4000) await db.query(sql, [JSON.stringify(rows.slice(i, i + 4000))]); };
  await insertJson(`insert into auth.users (id, is_anonymous, created_at) select id, is_anonymous, created_at
    from json_to_recordset($1::json) as x(id uuid, is_anonymous boolean, created_at timestamptz)`,
    users.map(u => ({ id: u.id, is_anonymous: !u.google, created_at: new Date(istMidnight(u.day0) + 12 * 3600000).toISOString() })));
  await insertJson(`update public.profiles p set username = x.username from json_to_recordset($1::json) as x(id uuid, username text) where p.id = x.id`,
    users.filter(u => u.username).map(u => ({ id: u.id, username: u.username })));
  await insertJson(`insert into public.events (user_id, session_id, name, props, context, created_at)
    select user_id, session_id, name, props, context, created_at
    from json_to_recordset($1::json) as x(user_id uuid, session_id uuid, name text, props jsonb, context jsonb, created_at timestamptz)`, events);
  await insertJson(`insert into public.games (user_id, id, mode, day, mystery, won, guess_count, temps, score, trivia_correct, played_at)
    select user_id, gen_random_uuid(), mode, day, 'Peru', won, guess_count, '{}', score, 0, played_at
    from json_to_recordset($1::json) as x(user_id uuid, mode text, day date, won boolean, guess_count int, score int, played_at timestamptz)`, games);
  await insertJson(`insert into public.daily_scores (day, user_id, won, guess_count, score, guesses, created_at)
    select day, user_id, won, guess_count, score, '{}', created_at
    from json_to_recordset($1::json) as x(day date, user_id uuid, won boolean, guess_count int, score int, created_at timestamptz)
    on conflict do nothing`, [...dailies.values()]);

  // ---- rooms, challenges, game nights and friendships among named players
  const named = users.filter(u => u.username);
  const rooms = [];
  for (let i = 0; i < Math.min(28, Math.floor(named.length / 4)); i++) {
    const owner = named[i * 3];
    const age = Math.min(owner.day0, Math.floor(rnd() * 40));
    rooms.push({ id: uuid(), owner, created: istMidnight(age) + 15 * 3600000, name: pick(['Family', 'Office', 'Board game club', 'Travel buddies', 'Classmates', 'Gym crew', 'Quiz night']) + ' ' + (i + 1),
                 emoji: pick(['🌍', '🔥', '🎲', '🏆', '🚀', '🍕']), members: [owner, ...Array.from({ length: 1 + Math.floor(rnd() * 12) }, () => pick(named))] });
  }
  for (const r of rooms) {
    await db.query(`insert into public.rooms (id, code, name, owner_id, emoji, created_at) values ($1, public._room_code(), $2, $3, $4, $5)`,
      [r.id, r.name, r.owner.id, r.emoji, new Date(r.created).toISOString()]);
    for (const m of new Set(r.members)) await db.query(`insert into public.room_members (room_id, user_id, joined_at) values ($1, $2, $3) on conflict do nothing`,
      [r.id, m.id, new Date(r.created + rnd() * 3 * DAY).toISOString()]);
    const members = [...new Set(r.members)];
    for (let c = 0; c < Math.floor(rnd() * 4); c++) {
      const at = Math.min(now - 3600000, r.created + rnd() * (now - r.created));
      const theme = weighted([['world', 5], ['europe', 3], ['asia', 2], ['africa', 1], ['americas', 2], ['oceania', 1]]), speed = rnd() < 0.35;
      const cid = uuid();
      await db.query(`insert into public.room_challenges (id, room_id, creator_id, theme, speed, countries, created_at, ends_at)
        values ($1, $2, $3, $4, $5, $6, $7, $7::timestamptz + interval '24 hours')`, [cid, r.id, pick(members).id, theme, speed, COUNTRIES.slice(0, 5), new Date(at).toISOString()]);
      for (const m of members) {
        if (rnd() < 0.35) continue;
        const rounds = rnd() < 0.7 ? 5 : 1 + Math.floor(rnd() * 4);
        for (let k = 1; k <= rounds; k++) {
          const found = rnd() < 0.72, g = found ? 1 + Math.floor(rnd() * 6) : 10, secs = 10 + Math.floor(rnd() * (speed ? 50 : 150));
          await db.query(`insert into public.challenge_results (challenge_id, user_id, round, started_at, submitted_at, found, guess_count, seconds, points)
            values ($1, $2, $3, $4, $4::timestamptz + make_interval(secs => $5), $6, $7, $5, $8)`,
            [cid, m.id, k, new Date(at + k * 120000).toISOString(), secs, found, g, found ? 1000 - 100 * (g - 1) + Math.round(300 * (1 - secs / (speed ? 60 : 180))) : 0]);
        }
      }
    }
    if (rnd() < 0.4) {
      const at = r.created + rnd() * (now - r.created), nid = uuid();
      await db.query(`insert into public.room_nights (id, room_id, host_id, rounds, round_seconds, current_round, status, created_at, ended_at)
        values ($1, $2, $3, 5, 120, 5, 'ended', $4, $4::timestamptz + interval '20 minutes')`, [nid, r.id, r.owner.id, new Date(at).toISOString()]);
      for (const m of members) {
        await db.query(`insert into public.night_players (night_id, user_id) values ($1, $2) on conflict do nothing`, [nid, m.id]);
        for (let k = 1; k <= 5; k++) await db.query(`insert into public.night_results (night_id, round, user_id, found, guess_count, seconds, points)
          values ($1, $2, $3, true, 3, 40, $4) on conflict do nothing`, [nid, k, m.id, 600 + Math.round(rnd() * 600)]);
      }
    }
  }
  for (let i = 0; i < 40 && named.length > 2; i++) {
    const a = pick(named), b = pick(named);
    if (a === b) continue;
    await db.query(`insert into public.friendships (user_id, friend_id) values ($1, $2), ($2, $1) on conflict do nothing`, [a.id, b.id]);
  }
  // ---- notifications: about a third of Daily players turned them on
  await db.exec(`
    insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, platform, created_at)
    select u.id, 'https://push.example/' || u.id, repeat('B', 87), repeat('A', 22),
           (array['android', 'android', 'android-pwa', 'ios-pwa', 'desktop', 'mac-safari'])[1 + floor(random() * 6)::int],
           greatest(u.created_at, now() - interval '20 days') + interval '1 day'
    from auth.users u
    where random() < 0.35 and (select count(*) from public.daily_scores d where d.user_id = u.id) >= 2;
    delete from public.push_subscriptions where created_at > now();
    insert into public.push_log (user_id, kind, platform, ok, status, created_at)
    select s.user_id, k.kind, s.platform, k.r > 0.03, case when k.r > 0.03 then 201 else 410 end,
           d + interval '13 hours 30 minutes' + make_interval(mins => floor(k.r * 50)::int)
    from public.push_subscriptions s
    cross join generate_series(s.created_at::date, (now() - interval '14 hours')::date, '1 day') d
    cross join lateral (select random() + 0 * extract(epoch from d) as r) z
    cross join lateral (select z.r, case when z.r < 0.55 then 'daily' when z.r < 0.66 then 'streak' when z.r < 0.70 then 'comeback'
                                          when z.r < 0.76 then 'challenge' when z.r < 0.79 then 'night' when z.r < 0.81 then 'friend' end as kind) k
    where k.kind is not null;
    insert into public.events (user_id, session_id, name, props, created_at)
    select user_id, gen_random_uuid(), 'push_open', jsonb_build_object('kind', kind, 'go', 'daily'), created_at + interval '6 minutes'
    from public.push_log where ok and random() < case kind when 'streak' then 0.42 when 'night' then 0.5 when 'daily' then 0.24 else 0.18 end
      and created_at + interval '6 minutes' < now();
    insert into public.events (user_id, session_id, name, props, created_at)
    select s.user_id, gen_random_uuid(), x.name, jsonb_build_object('source', x.src, 'platform', s.platform), s.created_at - interval '1 minute'
    from public.push_subscriptions s
    cross join lateral (select (array['daily_result', 'daily_result', 'banner', 'room', 'account'])[1 + floor(random() * 5 + 0 * extract(epoch from s.created_at))::int] as src) w
    cross join lateral (values ('push_prompt_shown', w.src), ('push_prompt_accept', w.src), ('push_enabled', w.src)) x(name, src);
    insert into public.events (user_id, session_id, name, props, created_at)
    select u.id, gen_random_uuid(), x.name, jsonb_build_object('source', 'daily_result'), now() - make_interval(hours => floor(random() * 400)::int)
    from auth.users u
    cross join lateral (select random() + 0 * extract(epoch from u.created_at) as r) z
    cross join lateral (values ('push_prompt_shown'), (case when z.r < 0.25 then 'push_denied' else 'push_prompt_dismiss' end)) x(name)
    where z.r < 0.5 and not exists (select 1 from public.push_subscriptions s where s.user_id = u.id)
      and exists (select 1 from public.daily_scores d where d.user_id = u.id);
  `);
  // ---- a little feedback
  await db.exec(`
    insert into public.feedback (user_id, kind, message, contact, meta, created_at)
    select u.id, x.kind, x.message, x.contact, jsonb_build_object('platform', x.platform, 'viewport', '390x844', 'games', 12), now() - make_interval(hours => x.h)
    from (select id from auth.users order by created_at limit 1) u,
    (values ('bug', 'The globe froze after my 6th guess on Safari, had to reload.', null, 'ios-pwa', 3),
            ('idea', 'Please add a US states mode! My whole office would play it.', 'priya@example.com', 'android', 20),
            ('other', 'Love the game, playing every morning with my dad 🌍', null, 'desktop', 50),
            ('bug', 'Leaderboard shows me twice after signing in with Google.', 'sam@example.com', 'android-pwa', 70),
            ('idea', 'A hint that shows the continent would be nice for beginners.', null, 'mac-safari', 120)) x(kind, message, contact, platform, h);
  `);
  await addGameKatta(db, insertJson);
  return { players: users.length, events: events.length };
}

// ---------------------------------------------------------------- GameKatta (the /gk page)
// gk_* events as shared/gk-track.js sends them: one random player per browser per site.
async function addGameKatta(db, insertJson) {
  const SITES = [['hatke', 34], ['tatva', 26], ['hub', 18], ['pataakha', 8], ['dahi', 6], ['tictacchai', 5], ['cricket', 3]];
  const GK_CH = [[{}, 26], [{ referrer: 'web.whatsapp.com' }, 8], [{ s: 'share' }, 22], [{ utm_source: 'cafe', utm_medium: 'qr', utm_campaign: 'chaayos-koregaon' }, 5],
    [{ utm_source: 'cafe', utm_medium: 'qr', utm_campaign: 'cafe-goodluck' }, 4], [{ referrer: 'gamekatta.com' }, 14], [{ utm_source: 'tatva', utm_medium: 'next' }, 5],
    [{ utm_source: 'hatke', utm_medium: 'next' }, 5], [{ referrer: 'l.instagram.com' }, 4], [{ referrer: 'www.google.com' }, 3], [{ utm_source: 'instagram', utm_campaign: 'diwali_pataakha' }, 4]];
  const PROMPTS = { sweet: ['gulab jamun', 'jalebi', 'rasgulla', 'kaju katli', 'mysore pak', 'chhena poda', 'malpua', 'ghevar'],
    city: ['mumbai', 'delhi', 'pune', 'jaipur', 'indore', 'shillong', 'kohima', 'bhuj'], bollywood: ['sholay', 'ddlj', '3 idiots', 'lagaan', 'andaz apna apna', 'masaan', 'udaan'],
    snack: ['samosa', 'vada pav', 'pani puri', 'dhokla', 'khakhra', 'misal', 'litti'] };
  const TIERS = ['s', 's', 's', 'a', 'a', 't', 't', 'h', 'l'];
  const NOTFOUND = ['sandesh', 'peda', 'imarti', 'pathare prabhu', 'gajak'];
  const users = [], events = [];
  const ev = (u, session, name, props, at) => events.push({ user_id: u.id, session_id: session, name, props: { game: u.site, ...props }, context: u.ctx, created_at: new Date(Math.min(at, Date.now() - 60000)).toISOString() });
  for (let i = 0; i < 650; i++) {
    const site = weighted(SITES), day0 = Math.floor(rnd() * 45);
    const d = weighted(DEVICES);
    const u = { id: crypto.randomUUID(), site, day0, ctx: { site, v: '2026.10.15', ...d, lang: pick(['en-IN', 'en-IN', 'en-US', 'hi-IN']), standalone: rnd() < 0.06 }, stick: rnd() };
    users.push(u);
    let streak = 0;
    for (let ago = day0; ago >= 0; ago--) {
      const first = ago === day0;
      if (!first && rnd() > (u.stick < 0.6 ? 0.07 : u.stick < 0.85 ? 0.35 : 0.75)) { streak = 0; continue; }
      const session = crypto.randomUUID();
      let t = istMidnight(ago) + weighted(HOURS) * 3600000 + rnd() * 3600000;
      const step = () => (t += 4000 + rnd() * 40000);
      ev(u, session, 'gk_open', first ? { first: true, ...weighted(GK_CH) } : { first: false }, t);
      ev(u, session, 'gk_load', { ms: Math.round((d.device === 'desktop' ? 600 : 1300) + rnd() * (site === 'hatke' ? 3500 : 1500)) }, step());
      const n = 60 - ago;
      if (site === 'hatke') {
        if (first && rnd() > 0.7) { /* opened, didn't play */ } else {
        ev(u, session, 'gk_start', { mode: 'daily', n, resumed: false }, step());
        const tiers = [];
        for (let r = 1; r <= 7; r++) {
          const [cat, list] = pick(Object.entries(PROMPTS));
          if (rnd() < 0.3) ev(u, session, 'gk_miss', { mode: 'daily', n, prompt: cat, said: pick(NOTFOUND), zinger: rnd() < 0.2 }, step());
          const miss = rnd() < 0.12 ? pick(['timeout', 'skip']) : null, tier = miss ? null : pick(TIERS);
          tiers.push(tier || '-');
          ev(u, session, 'gk_answer', { mode: 'daily', n, round: r, prompt: cat, said: miss ? '' : (tier === 's' ? list[0] : pick(list)), tier, miss }, step());
        }
        if (rnd() < 0.86) {
          streak++;
          const pts = tiers.reduce((a, x) => a + ({ s: 10, a: 15, t: 30, h: 60, l: 100 }[x] || 0), 0);
          ev(u, session, 'gk_finish', { mode: 'daily', n, pts, ft: pts * 4, tiers: tiers.join(''), streak }, step());
          if (rnd() < 0.3) ev(u, session, 'gk_share', { mode: 'daily', n }, step());
        }
        }
      } else if (site === 'tatva') {
        if (!(first && rnd() > 0.75)) {
        ev(u, session, 'gk_start', { mode: 'daily', n, resumed: false }, step());
        if (rnd() < 0.85) {
          const won = rnd() < 0.78, darts = won ? 2 + Math.floor(rnd() * 8) : 10;
          streak = won ? streak + 1 : 0;
          ev(u, session, 'gk_finish', { mode: 'daily', n, won, darts, lifelines: rnd() < 0.3 ? 'home' : '', streak }, step());
          if (rnd() < 0.28) ev(u, session, 'gk_share', { mode: 'daily', n }, step());
        }
        }
      } else if (site === 'hub') {
        if (rnd() < 0.72) ev(u, session, 'gk_click', { to: pick(['hatke', 'tatva', 'borderline', 'hatke']), from: rnd() < 0.6 ? 'today' : 'card' }, step());
      } else {
        if (site === 'tictacchai' || site === 'cricket') ev(u, session, 'gk_mode', { opp: pick(['room', 'dadi', 'chintu', 'dost']) }, step());
        if (rnd() < 0.5) { ev(u, session, 'gk_room_create', { mode: 'room', room: '' }, step()); ev(u, session, 'gk_start', { mode: 'room', room: 'abc123' }, step()); }
        else if (rnd() < 0.6) ev(u, session, 'gk_room_join', { mode: 'room', room: 'abc123' }, step());
        else ev(u, session, 'gk_start', { mode: 'solo', room: '' }, step());
      }
      if (rnd() < 0.02) ev(u, session, 'gk_error', { msg: pick(["Cannot read properties of null (reading 'focus')", 'ResizeObserver loop limit exceeded']), src: site + '.js', line: 400 + Math.floor(rnd() * 50) }, step());
      ev(u, session, 'gk_time', { seconds: Math.round(30 + rnd() * (site === 'hub' ? 60 : 300)) }, step());
    }
  }
  await insertJson(`insert into auth.users (id, is_anonymous, created_at) select id, true, created_at
    from json_to_recordset($1::json) as x(id uuid, created_at timestamptz)`,
    users.map(u => ({ id: u.id, created_at: new Date(istMidnight(u.day0) + 12 * 3600000).toISOString() })));
  await insertJson(`insert into public.events (user_id, session_id, name, props, context, created_at)
    select user_id, session_id, name, props, context, created_at
    from json_to_recordset($1::json) as x(user_id uuid, session_id uuid, name text, props jsonb, context jsonb, created_at timestamptz)`, events);
}
