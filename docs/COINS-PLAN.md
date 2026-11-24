# Coins: in-game economy plan

Status: proposal, nothing built. Coins are earned by playing and spent in an in-game shop. There is no real-money purchase anywhere in this plan.

## 1. Ground rules

1. **No real money.** Coins can't be bought, sold, traded or cashed out.
2. **Coins never touch the leaderboard.** Daily scores, ranks and room leagues stay exactly as they are. Nothing bought changes a Daily result.
3. **The Daily is always free and equal.** Nobody can pay coins for an edge in the Daily. Shop items there are cosmetic, plus the streak freeze.
4. **The server is the bank.** The balance lives in Supabase, not `localStorage`, because local data is easy to edit. The app only shows what the server says.
5. **Early earnings feel generous.** A new player should afford their first item within a few days.

## 2. Earning coins

Amounts are starting values. Keep them in one server-side table so they can be tuned without a release.

| Event | Coins | Notes |
|---|---|---|
| Play today's Daily (win or lose) | 10 | Rewards showing up |
| Win the Daily | +20 | |
| Win in few guesses | +5 for each guess under 10 | One guess pays +45 |
| Daily streak bonus | +2 per streak day, capped at +30 | Day 15 onward pays the cap |
| New country in the passport | +10 | First win in that country only |
| Badge unlocked | 25 / 50 / 100 / 250 / 500 | By badge tier, paid once |
| Classic win | 3 | Capped at 30 a day |
| Weekly challenge done | 100 | See section 5 |
| Room game night, top 3 | 30 / 20 / 10 | Phase 3 |

**Expected pace:** a regular Daily player who wins most days earns roughly 40 to 70 coins a day.

## 3. Spending coins

| Item | Price | Kind | Notes |
|---|---|---|---|
| Streak freeze | 150 | Consumable | Covers one missed day automatically. Hold at most 2 |
| Streak repair | 400 | Consumable | Restores a streak broken in the last 2 days |
| Classic: reveal continent | 20 | Consumable | Classic only |
| Classic: reveal a neighbour | 40 | Consumable | Classic only |
| Classic: retry a trivia question | 15 | Consumable | Classic only |
| Globe theme (night, vintage paper, neon, ocean) | 300 to 800 | Cosmetic | Changes the globe's look |
| Guess marker style | 150 to 400 | Cosmetic | Shape or animation of guess pins |
| Share card frame | 200 to 500 | Cosmetic | Shows on the shared image, so it also advertises the shop |
| Name flair | 250 | Cosmetic | An emoji next to your name on leaderboards |
| Profile title | 300 | Cosmetic | For example "Cartographer", shown on the profile |
| Needle skin (story mode) | 500 | Cosmetic | Phase 3, once story mode is out of beta |

**Prices against earnings:** a streak freeze costs about 3 days of play, and a mid-priced theme about 2 weeks. That keeps both feeling reachable.

**Not for sale:** extra Daily guesses, Daily hints, Daily score boosts and leaderboard placement.

## 4. How it works technically

### Tables (new SQL file, `010_coins.sql`)

- `coin_ledger`: one row per earning or spending. Columns: `user_id`, `delta` (positive or negative), `reason` (for example `daily_win` or `buy:theme_neon`), `ref` (the day, badge id or item), `created_at`. A unique key on (`user_id`, `reason`, `ref`) means the same reward can never be paid twice, even if the app retries.
- `wallets`: `user_id`, `balance`. Updated only in the same transaction as the ledger row, so the two always agree.
- `shop_items`: `key`, `price`, `kind` (consumable or cosmetic), `max_held`, `active`. Prices change here, not in the app.
- `inventory`: `user_id`, `item_key`, `qty`, `equipped`.
- `coin_rules`: the earn amounts from section 2.

Row-level security is on, with read-only policies for a player's own rows. Nothing can be written directly.

### Server functions (all `security definer`, like `submit_daily`)

- `claim_daily_coins(day)`: reads the already verified row in `daily_scores` and pays the Daily, win, guess and streak amounts. It uses the same today-or-yesterday window as `submit_daily`, so offline games still count.
- `claim_badge_coins(badge_id)`: pays a badge once. Only badges the server can check from its own data pay full value (Daily, streak and passport-from-Daily badges). Badges based on Classic or local time pay a small fixed amount, because the server can't verify them.
- `claim_classic_coins(game_id)`: pays a Classic win, capped per day. Classic games aren't verified on the server, so the cap is what keeps farming pointless.
- `buy_item(item_key)`: locks the wallet row, checks the balance and `max_held`, writes the ledger row and the inventory row together. One call, all or nothing.
- `use_item(item_key, ref)`: spends a consumable, such as a freeze for a given day.
- `my_wallet()`: returns the balance, inventory and today's earnings for the app.

### Accounts

- Every visitor already has an anonymous Supabase user, so guests get a wallet with no sign-up.
- "Continue with Google" links Google to that same user, so the wallet carries over.
- If the Google account already belongs to another player (`identity_already_exists`), the app switches to that player and the guest wallet is left behind. Decide whether to merge it (see section 7).

### Streaks and freezes

The streak is worked out locally today. Freezes need the server to know the streak, so it should be computed from the days in `daily_scores` plus the days covered by used freezes. The app then shows the server's streak.

### App side

- `wallet.js`: loads `my_wallet()`, claims rewards after each game, and queues claims while offline.
- A coin counter in the header.
- A shop sheet with tabs for boosts and looks, and an inventory where cosmetics are equipped.
- Hide all of it behind a new `coins` feature switch from `008_roles.sql`. Turn it on for admin and tester first, then for everyone.

## 5. Making it lively

- **Coins on the result card.** After a Daily, show "+45 coins" counting up, with each line of the breakdown appearing in turn (played, won, fast find, streak).
- **Big moments.** A short burst of falling coins for a one-guess win, a new badge or a new passport stamp. Skip it for reduced-motion users.
- **Weekly challenges.** Three goals a week, such as "Find 3 countries in Africa", "Win a Daily in 4 guesses or fewer" or "Get 5 trivia answers right". Each pays 100, and all three add a bonus chest.
- **Rotating shop.** Two featured cosmetics each week, with a countdown, so there is a reason to check in.
- **Streak freeze nudge.** At a streak of 5 or more, suggest buying a freeze. This fits with the 7PM notification work.
- **Shared looks.** The share card frame and name flair are seen by friends, which advertises the shop without ads.

## 6. Guarding against abuse

- **Farming Classic:** earnings are capped per day.
- **Many guest accounts:** coins can't be traded or gifted, so extra accounts gain nothing useful.
- **Edited local data:** the server recomputes or caps every reward, and the app never sends a coin amount.
- **Repeated claims:** the unique key on the ledger blocks double payment.
- **Watching the economy:** log earn and spend events with the existing `track()` analytics, and add a coins tab to `tools/dashboard` showing coins earned against coins spent per day. If coins pile up unspent, add items. If players run dry, raise earnings.

## 7. Decisions needed before building

1. **Currency name.** "Coins" is fine. A themed name such as "Miles" or "Compass points" would fit Borderline better.
2. **Guest wallet on account switch.** Merge it into the existing account, or let it go. Merging is friendlier but needs a server function that moves the ledger rows.
3. **Existing players.** Give a one-time welcome grant, back-pay for past badges and passport stamps, or start everyone at zero.
4. **Rooms.** Whether game night prizes pay coins, and whether coins could ever be spent on room features.

## 8. Build order

| Phase | Scope | Roughly |
|---|---|---|
| 1. Foundation | Ledger, wallet, `my_wallet`, Daily earnings, coin counter, result card animation, streak freeze | First release, behind the `coins` switch |
| 2. Shop | Cosmetics, inventory and equipping, badge and passport payouts, Classic boosts | Once phase 1 numbers look right |
| 3. Engagement | Weekly challenges, rotating shop, room prizes, story skins | After the shop is in use |

Real-money purchases are deliberately out of scope. If that ever changes, it brings payment processing, app-store rules, refunds, tax and consumer law, and it should be its own plan.
