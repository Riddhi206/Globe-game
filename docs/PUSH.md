# Push notifications

Borderline sends Web Push notifications to bring players back: a Daily reminder, a streak saver,
come-back nudges, and alerts for friend requests, room challenges and game nights. This page covers
what gets sent and when, which devices can receive it, and how to switch it on.

## What gets sent, and when

Times are each player's own, from their device's time zone.

| Kind | When | Example |
|---|---|---|
| Daily reminder | At the player's reminder time (7 PM unless they pick another), if they haven't played today's Daily and have played in the last 3 days | **🔥 4-day streak · Daily #12 is live** · A new mystery country is waiting. |
| Streak saver | Players with a streak of 2+ days who haven't played. 3 hours before the Daily resets (00:00 UTC) when that's daytime for them, otherwise at 9 PM the evening before | **🔥 Your 4-day streak ends in 3 hours** |
| Come-back nudge | 3, 7 and 14 days after they last played, at their reminder time. Nothing after that | **The globe misses you 🌍** · Today's mystery country is in Asia. |
| Friend request | When someone sends one | **riddhi wants to be friends 👋** |
| New challenge | When a room member starts one | **⚔️ New challenge in Office** · amy picked 5 countries in Europe. |
| Game night | When a room member starts one (live, any hour) | **🔴 Game night in Family** · kuldip just started one. |

Guard rails:
- Nothing is sent until the player turns it on, and each kind can be switched off in Account → Notifications.
- At most one reminder (daily, streak or come-back) per device per run. Daily and come-back nudges go out once per local day; the streak saver goes out once per Daily.
- Friend and challenge alerts don't go out between 22:00 and 08:00 local time. They wait until morning while still relevant: friend requests for 24 hours, challenges for 12.
- A newer notification of the same kind replaces an older one still on screen.
- Tapping a notification opens the right place: today's Daily, the friends sheet, or the room. Taps are counted (`push_open`) on the dashboard's **Notifications** tab.

## Which devices can get them

| Device and browser | Works? | What the player sees |
|---|---|---|
| Android: Chrome, Samsung Internet, Edge, Firefox | ✅ In the browser, installed or not | Our sheet → **Turn on reminders** → the browser's Allow prompt |
| Android, installed app (added to the home screen) | ✅ | Same. Notifications are listed under the app in Android settings |
| iPhone / iPad, Safari, **added to the Home Screen**, iOS 16.4+ | ✅ | Same, inside the home-screen app |
| iPhone / iPad in Safari or Chrome, **not** added to the Home Screen | ❌ Apple doesn't allow it | Steps to add Borderline to the Home Screen (Share → Add to Home Screen → open it from there) |
| iPhone / iPad older than iOS 16.4 | ❌ | "Update iOS to 16.4 or newer" |
| Desktop: Chrome, Edge, Firefox, Opera | ✅ | Our sheet → the browser's prompt |
| Mac Safari 16+ (macOS Ventura and later) | ✅ | Same |
| Brave | ⚠️ Off by default | If it fails, how to turn on "Use Google services for push messaging" |
| In-app browsers (Instagram, Facebook, TikTok, Snapchat, LinkedIn, Google app) | ❌ | "Open in Chrome / Safari", with a Copy link button |
| Permission refused earlier | ❌ until changed in settings | Step-by-step for their platform (Android site settings, Android app info, iPhone Settings → Notifications, Mac Safari, desktop browsers) |

Things that can still delay or hide a notification, outside our control:
- Android battery savers on some phones (Xiaomi, Oppo, Vivo, OnePlus) can hold notifications back while the phone is asleep. The streak saver is sent as "high" urgency for this reason.
- Focus or Do Not Disturb modes on iPhone and Android.
- iPhones drop a home-screen app's subscription now and then. The app quietly re-subscribes on the next open.

### When we ask

We never ask on the first visit, and never with the browser's own prompt straight away. The prompt
only appears after the player taps **Turn on reminders** in our sheet. A "Not now" therefore doesn't
use up the browser's one-time prompt. Our sheet appears:

- right after a Daily, once the result, badge and name sheets are done;
- after joining or creating a room ("Know when your crew plays");
- from the home banner (players with 2+ games);
- any time, from Account → Notifications.

It shows at most 3 times (twice for the iPhone add-to-Home-Screen steps), at least 4 days apart.

## How it works

```
device ── push_save ──▶ push_subscriptions / push_prefs        (017_push.sql)
triggers (friend request, challenge, game night) ──▶ push_queue
pg_cron, every minute ──▶ Edge Function `push`                 (018_push_cron.sql)
        push_due()  → what to send now, claimed so it's never sent twice
        Web Push    → encrypted (RFC 8291), signed (VAPID, RFC 8292), to Google / Apple / Mozilla / Microsoft
        push_report → log it; forget devices the push service says are gone (404/410) or that fail 5 times
service worker (sw.js) ── shows it, puts a dot on the app icon, opens the app where the notification points
```

The Edge Function has no dependencies. Its encryption matches the RFC 8291 test vector byte for byte,
and it was tested end to end through Google's push service.

## Setting it up (once)

1. **Run the SQL.** In the Supabase SQL editor, run `supabase/017_push.sql`. It's safe to re-run.
2. **Make the keys.** On your computer, run:
   ```
   node tools/push/vapid-keys.mjs
   ```
   It prints four secrets and one SQL line. Keep the private key and the cron secret out of git and chat.
3. **Add the secrets.** Supabase → Edge Functions → Secrets → add `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
   `VAPID_SUBJECT` (`mailto:` plus your email) and `PUSH_CRON_SECRET`.
4. **Save the public key.** Run the printed `insert into public.push_config …` line in the SQL editor.
   The app reads the key from there; until it exists, the app hides everything about notifications.
5. **Deploy the function.** Supabase → Edge Functions → Deploy a new function → Via editor. Name it `push`,
   paste `supabase/functions/push/index.ts`, and turn **Verify JWT off**: the cron secret protects it.
   With the CLI instead: `supabase functions deploy push --no-verify-jwt`.
6. **Schedule it.** Turn on the `pg_cron` and `pg_net` extensions (Database → Extensions). In
   `supabase/018_push_cron.sql`, replace `YOUR-PROJECT-REF` and `YOUR-CRON-SECRET`, then run it.
7. **Check.** Open the game, go to Account → Notifications → **Turn on reminders**, then **Send a test**.
   It should arrive within a minute. If not, see below.

## Checking and troubleshooting

- **Did the cron call the function?**
  `select status_code, content, created from net._http_response order by created desc limit 5;`
  You want `200` with `{"due":…,"sent":…}`. A `403` means the cron secret differs between Vault and the function secrets.
- **Function logs:** Supabase → Edge Functions → push → Logs.
- **What was sent:** `select kind, platform, ok, status, created_at from public.push_log order by id desc limit 20;`
  - `201`: delivered to the push service.
  - `410` / `404`: the device unsubscribed; we forget it.
  - `403` / `400`: the VAPID keys don't match. The public key in `push_config` must be the pair of `VAPID_PRIVATE_KEY`.
- **Who has it on:** `select platform, count(*) from public.push_subscriptions group by 1;`
- **Making new keys** invalidates every existing subscription. The app re-subscribes each device on its next visit,
  but players who don't come back stop getting reminders. Make them once.
- **Pause everything:** `select cron.unschedule('borderline-push');`. Run `018_push_cron.sql` again to resume.

## Not built yet

- THE SIGNAL episode alerts ("Meera is back online" at 7 PM). That needs episode progress on the server.
- A "friend accepted" alert.
- Results alerts ("riddhi beat your Daily", "challenge results are in").
- Rich notifications: images and action buttons. Android and desktop support them; iPhone doesn't.
