# Backlog

Ideas agreed for later. Not started.

## Gamification (after passport and badges)

- **Streak protection.** One free miss per week, or one repair of a broken Daily streak.
- **Friend challenges.** A "beat my score" link that opens the same Daily with the sender's result shown.
- **Trivia combo.** Each correct trivia answer in a row adds to the trivia bonus.
- **Rank titles.** Titles that rise with level (Map Rookie, Cartographer, Globetrotter), shown on the profile and in share text.
- **Room movement.** "▲3 since yesterday" next to names on the room league.
- **Celebration moments.** Confetti on a win, a short vibration where supported, and an optional sound.
- **Story rewards.** A badge for each story chapter and ending, shown on the passport.
- **Passport polish.** Show a country's first-found date, and a "rarest country found" callout.

## Coins and commerce (later)

The full plan is in [COINS-PLAN.md](COINS-PLAN.md). The notes below are the earlier summary.

Plan so far: coins are the spend side, and badges and the passport are the earn side.

- **Earn.** Each badge in `progress.js` has a `goal`. Coins get paid out when a badge unlocks. The `announceNewBadges()` call after each game is the natural place to pay them. Pay out once per badge, recorded in the store.
- **Balance.** Keep the coin balance and its transactions in their own store section, not mixed into `games`. Coins need to survive a sync from another device, so decide early whether they're server-side (Supabase) or local-with-sync. Server-side is safer once money is involved.
- **Spend.** Ideas: streak freezes, hints bought with coins, cosmetic themes for the globe. Each spend should be a single checked action so it can't be double-counted.
- **Before building.** Decide the coin rules, whether purchases are real money, and how refunds and cheating are handled. Those choices change the design a lot.

## Launch readiness and security (review of 5 October 2026)

What's already solid: row-level security on every table, server-checked scores (Daily, challenges,
game nights), no secrets in the app, sensitive files not served, user text escaped, fast load
(556 KB, first paint 0.9 s on a throttled phone), offline support, Sentry and analytics.

Suggested order: 1 → 2 → 3 → 4 → 5 → 7 → 9 → 10 and 11, with 6 planned before coins.

### Before a public launch

1. **Release hygiene.** Push the unpushed commits and commit the analytics work. `main` is 58 commits
   behind (last updated 27 September): merge into `main`, deploy from `main`, and tag a release.
2. **Google sign-in.** The OAuth app was in "Testing" (only listed test users can sign in), and the
   "Access blocked" error from the Google button was never resolved. Publish the app and confirm
   sign-in works for a non-test account.
3. **Guest sign-up limit.** Supabase allows 30 guest sign-ups per hour per network by default; at an
   office, college or game night on one Wi-Fi, newcomers drop to offline mode (no leaderboard or rooms).
   Raise the limit and turn on Supabase's CAPTCHA (Cloudflare Turnstile) for anonymous sign-ins.
4. **Link previews.** No `og:image` or Twitter card tags, so shared links show no picture. Add a
   1200×630 preview image and the tags.
5. **Account deletion.** No way to delete an account (GDPR, India's DPDP Act, Google verification).
   Add "Delete my account" backed by one server function; deleting the auth user cascades to the rest.

### Integrity (cheating)

6. **Answers reach the browser.** The Daily answer is computed in the browser (`COUNTRIES[dailyIndex()]`),
   and challenge and game-night countries are sent when a round starts, so anyone can read them in the
   console and post one-guess wins. Real fix: check guesses on the server (it returns each guess's
   distance and colour; the answer never leaves it). Needed before coins or prizes.
7. **Event flooding.** Any client can insert unlimited analytics events. Add a database rule capping
   events per player per hour.
8. **Device-trusted progress.** Stats, passport and badges come from client-written games, and the
   Founding Player badge trusts the device clock. Cosmetic today; coins are planned server-side.

### Hardening

9. **Security headers.** Add a `_headers` file (supported by Cloudflare static hosting): `nosniff`,
   frame protection, `Referrer-Policy`, `Permissions-Policy`, HSTS; a Content-Security-Policy in
   report-only mode first (allow jsdelivr, accounts.google.com, Cloudflare Insights, Sentry, Supabase,
   Google Fonts), then enforce.
10. **Pin `supabase-js`.** It loads as `@supabase/supabase-js@2` from a CDN with no integrity hash, so
    any new 2.x release goes straight to production. Pin an exact version and add `integrity`.
11. **README is public.** Add `README.md` to `.assetsignore`.
12. **Moderation.** No word filter on usernames or room names, and no admin rename or ban. Add a basic
    filter and admin SQL snippets.
13. **Supabase settings.** Run the Security Advisor and Performance Advisor, turn off unused sign-in
    methods, remove the old Netlify redirect URLs, and confirm production matches the repo:
    ```sql
    -- tables without row-level security (should return no rows)
    select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
    -- functions guests (anon) can call (should be only my_access and has_feature)
    select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute');
    ```

### Polish and operations

- **Terms of service** page (Google's branding form asks for one).
- **Backups.** Check what the Supabase plan includes; add a weekly scheduled database dump.
- **Consent.** Analytics tied to a player id usually needs consent in the EU and UK; decide whether
  those players are in scope.
- **Accessibility audit**, and tidy the loose hint labels.
- **Sentry release name** still says `pancake@`.
