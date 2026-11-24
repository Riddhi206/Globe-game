# THE UNMAKING — Story Mode Game Design

> Pancake's first story campaign. Seven chapters, one compass, one villain,
> one choice everybody will argue about.

---

## 1. The pitch (one paragraph)

The world map is being erased. A disgraced cartographer called **Varka Thorne,
the Unmaker**, poured himself into ink and split it into seven pieces that are
eating countries from the inside. You carry **the Lamp**; your guide is
**Needle**, a sarcastic brass compass who is cursed to never find north. Each
chapter, you hunt one ink creature — a **Blot** — hidden in one country, using
Pancake's existing heat-colour guessing. Every wrong guess, a real country on
the globe goes dark. Find it, **hold to burn it**, and watch the ink drain off
the whole planet in a wave. Six Blots in, you learn the truth: the seventh
piece has been in your hand the whole time. It's Needle. You have to choose.

## 2. Why people will talk about it

These are the moments designed to be screenshotted, retold, and argued about.
Every one of them is built from mechanics the game already has.

| Talk-trigger | What happens | Why it spreads |
|---|---|---|
| **The world goes dark** | Wrong guesses visibly erase real countries on the globe, live | Stakes you can *see*; "it ate Australia" is a sentence people say out loud |
| **Hold to burn** | The finding moment is a deliberate, physical, 1.2-second hold with haptics, flash, embers, shockwave, and a restoration wave rippling round the globe | Peak moment; it *feels* like something, unlike tapping "OK" |
| **The floor moved** (Ch 2) | The Blot hears you coming and jumps to a neighbouring country — every colour on your guess list re-heats at once | "Wait, it MOVED?" — first surprise that breaks the rules |
| **The mirror world** (Ch 6) | The whole globe is flipped east–west; the villain's creature talks backwards | Disorienting, memorable, very clippable |
| **The compass lies** (Ch 7) | The guess-list arrows players have trusted the entire game point the wrong way, and the hidden target is *their own home country* | A meta twist that turns the game's own UI against you |
| **NEEDLE** | The six chapter countries' initials spell **N-E-E-D-L-E**. It was the answer from chapter one | The "it was in front of us the whole time" reveal people rewatch for |
| **The choice** | Break the Needle (lose your friend, save the world) or keep her (the world keeps a scar) | Moral choice + live global split: "61% broke her. Monsters." |
| **The scar** | Keep her, and a small ink scar sits at Point Nemo on *every* globe you ever see again, in every mode | Permanent consequence; people compare globes |
| **It knows me** | The villain quotes your real local time, your game count, your name | Harmless, local-only, genuinely unsettling in a fun way |
| **The flat-earth compass** | Needle insists the world is a pancake for six chapters. Her last words, if you break her, are seeing it's round | A running joke that pays off as the most emotional line in the game |

## 3. Tone

Dark-fantasy stakes, written with dry, warm humour — the same register as the
rest of Pancake. Needle is funny so that losing her hurts. Varka is quiet,
reasonable, and a little sad, which is scarier than shouting. Blots are
creepy-cute and petulant ("nooo, it was so quiet down here"). Nothing is gory,
nothing is political, no real conflict or real person is ever referenced.
Varka's lair is **Point Nemo**, the most remote point in the ocean — a real
place that belongs to no country, so the scar insults nobody.

## 4. Cast

- **You — the Lampbearer.** Addressed by your Pancake username. Story mode
  asks for one before chapter 1 (reuses the existing username picker).
- **Needle.** A pocket compass with one big expressive eye on her glass face.
  Her needle spins when nervous (always). Sarcastic, loyal, secretly scared.
  Running gag: she's a flat-earther ("The world is a pancake. I've seen the map.")
  because a flat map is all Varka ever let her see. Art: `resources/needle.svg`.
- **Varka Thorne, the Unmaker.** Once drew every border on every map. Decided
  each line he drew started a quarrel, so the only perfect map is an empty one.
  Never seen — he *writes* onto the screen in old ink handwriting.
- **The Blots.** Wobbling ink puddles with two white eyes, drawn procedurally
  on the canvas. One per chapter, each with a personality: Sulk, Skitter, Murk,
  Echo, Tick, the Mirrorling.
- **The Lamp.** What you hold. Burns Blots. Its glow (amber) is the only new
  colour story mode adds to Pancake's monochrome + heat palette.

## 5. Core loop (per chapter)

1. **Chapter card** — title, cliffhanger recap, redacted location ("somewhere ███").
2. **Briefing** — 3–5 lines of dialogue (typewriter, tap to advance, skippable).
3. **Hunt** — normal Pancake guessing, plus:
   - **Ink spreads** on every wrong guess (Ch 5: on a timer instead). Real
     countries turn to ink on the globe. A **🌍 World saved %** chip replaces
     the guess counter and ticks down.
   - **Needle barks** a short reaction to each guess (pools by heat band, never
     repeating the last 3).
   - **Varka intrudes** at scripted miss counts, writing across the screen.
   - **Trivia** every 3rd guess is reframed as "the locals know something": a
     right answer restores one erased country.
   - **Chapter modifier** — each chapter adds exactly one new rule (see §6).
   - **Pity bleed** — after N misses, the ink starts draining *toward* the Blot
     (erasing its neighbours), a visible clue so nobody gets stuck and quits.
4. **Found** — camera flies and zooms in; the Blot rises out of the country
   with a last line; a big amber **HOLD TO BURN** button appears.
5. **Burn** — hold 1.2 s → flash, embers, shockwave, screen shake, the Blot's
   scream, then the ink recedes from every erased country in a ripple outward
   from the Blot, with a rising chime.
6. **Postcard** — a collectible card flips in: flag, country, capital,
   population (from `country-facts.js`), a one-line lore note, and a wax seal
   bearing a single letter (the acrostic, unremarked until the finale).
7. **Chapter complete** — stars, World saved %, share button, Varka's
   cliffhanger line, Continue.

**You cannot lose a chapter.** There's no guess limit in story mode. You can
only lose *the world* — the % score. This keeps everyone moving forward (no
frustration wall) while giving replay value and bragging rights.

## 6. The seven chapters

The chapter countries are fixed (curated, not random) so the acrostic and the
writing work. Six continents, one each, escalating difficulty.

| # | Title | Country (letter) | Blot | New rule | Pity after |
|---|---|---|---|---|---|
| 1 | The Spill | New Zealand (**N**) | Sulk | Tutorial: ink spreads per miss | 6 misses |
| 2 | The Flinch | Egypt (**E**) | Skitter | Starts in **Libya**; the first guess that is hot, adjacent, or Libya itself makes it **jump to Egypt** and every past guess re-heats | 7 |
| 3 | Murk | Ecuador (**E**) | Murk | **Fog**: land is only visible near your guesses; the equator glows faintly | 7 |
| 4 | Echo | Dominican Republic (**D**) | Echo | **Riddles**: Echo leaks 3 riddles at misses 2, 5, 8 (each more direct) | 8 |
| 5 | Tick | Laos (**L**) | Tick | **Clock**: ink spreads every 8 s on its own (paused during dialogue, trivia, hidden tab); heartbeat audio | time-based hints at 30 s, 60 s |
| 6 | The Mirrorling | Estonia (**E**) | Mirrorling | **Mirror**: globe flipped east–west, dragging inverted, the Blot speaks backwards | 8 |
| 7 | Needle | **Your home country** | — | **Lying compass**: every guess-list arrow points the opposite way to the truth (Needle is steering you away from herself); only the heat colours tell the truth. Needle glitches progressively. | heat-only; Varka names your home at miss 4 |

Chapter 7's country is detected on-device (`resources/home-country.js`):
browser language region → time zone → the country you guess most → India as
a last resort. It never leaves the device; analytics never record it.

### Chapter 7 → the choice

Guessing your home country doesn't reveal a Blot. The ink rises from Needle
herself. Varka offers the choice; Needle thanks you either way. Two buttons,
no timer:

- **BREAK THE NEEDLE** (hold to burn): glass cracks, shards, light. Needle's
  last line: *"Hey. Is the world round?"* — and for the first time in the whole
  app, the globe spins on its own. *"...Huh. It is. It's beautiful."* Credits.
  If your average World saved ≥ 85%, a post-credits tease for Chapter II.
- **KEEP HER**: Varka laughs softly. A small, permanent ink scar appears at
  Point Nemo on every globe in every mode (toggle in settings to hide). Needle
  becomes a tiny companion icon on the home screen. *"Nobody's ever kept me.
  I'll find my north. And then we go get him."* Post-credits: an eye opens at
  Point Nemo. *"See you soon, {name}."*

Both endings show the live global split: *"You and 58% of players chose this."*
Players can replay chapter 7 to change their choice (the split only counts the
first choice).

### The secret

After the finale, the Map Journal shows the six postcards; their seals light
up N-E-E-D-L-E. Tapping the six seals in that order unlocks **Varka's Last
Letter** — a lore page explaining why he erased the borders and setting up
Chapter II. Nobody is told this exists. It is meant to be found and shared.

## 7. Scoring

- **World saved %** per chapter = 1 − erased land area ÷ total land area, at
  the moment you find the Blot (before the ink recedes). Area is precomputed
  from `borders.js`, so big countries cost more.
- **Stars**: ★★★ ≥ 90%, ★★ ≥ 75%, ★ otherwise (thresholds are per-chapter
  config, so later chapters can be harsher). 21 stars total.
- **Story score** = average World saved across completed chapters. Shown on
  the home card ("Chapter 4 of 7 · 87% of the world saved") and the share.
- **New Game+ ("Ink Mode")**, unlocked after the finale: replay any chapter
  with compass arrows hidden entirely. Separate star track.

## 8. Progression and pacing

- **Chapters 1–3 unlock immediately** — the binge hook. A new player can get
  three chapters, three burns and three postcards in their first sitting.
- **Chapters 4–7 unlock one per UTC day**, *or immediately when you finish
  today's Daily*. In-fiction: *"the Lamp burns on what you know — solve
  today's map and it's lit again."* This ties the story to the Daily habit
  without ever charging money. It also means friends on the same chapter
  this week can talk about it together.
- Locked chapters show their title partly redacted ("Chapter 5: T██k") and a
  countdown — an open loop that pulls people back.

## 9. Psychology: what we use, and the lines we don't cross

What the design deliberately uses, and where:

| Principle | Where it lives |
|---|---|
| Cold open (in medias res) | First launch: the map is already bleeding, Needle is already panicking, and you burn your first stain within 10 seconds |
| Agency / embodiment | Hold-to-burn instead of tap; the choice ending |
| Peak–end rule | The burn sequence; the ending's globe spin; the restoration wave |
| Zeigarnik (open loops) | Every chapter ends on a Varka cliffhanger; redacted titles; the countdown |
| Loss aversion, not punishment | World saved % ticks down, but you can never fail a chapter |
| Variable reward | Needle's reaction pool; 1-in-20 postcards come out **foil** |
| Collection / completion | Six postcards, 21 stars, the secret letter |
| Mastery | Stars, World saved %, Ink Mode |
| Personalisation | Your name in dialogue; your home country; your local time |
| Commitment | Choosing a username before chapter 1 |
| Anti-frustration (pity timer) | Ink bleeds toward the Blot after N misses; Needle nudges |
| Social currency + curiosity gap | Spoiler-free share cards; cryptic ending share ("I kept her. 🧭🤍"); global choice split; the hidden letter |
| Habit loop | Daily → Lamp lit → next chapter |

Lines we don't cross — these are product rules, not suggestions:

- No paywall on any chapter, no paid skips, no paid "lamp oil". (If Chapter II
  is ever monetised, it is announced as a separate product, never a cliffhanger
  that charges to continue.)
- No fake urgency outside the fiction. The Chapter 5 clock is a game rule
  with clear UI; real-world countdowns only ever describe a real unlock.
- No loot boxes. Foil postcards are cosmetic, random, and free.
- Nothing personal leaves the device. "It knows me" moments use local data
  only (name, local clock, local game count, detected home country).
- Every animation respects `prefers-reduced-motion`. Sound is off until the
  player turns it on. All dialogue is skippable.

## 10. What story mode does not change

Daily, Classic, Endless, the leaderboard, friends, stats, sync, and scoring are
untouched. Story games are never written to the `games` table or the local
games list (the table only allows `daily | classic | endless`, and story stats
would distort the existing ones). Story has its own progress store and its own
optional sync table.

## 11. Future (not in this build)

- Chapter II: *The Unmapped* (Point Nemo, Varka's lair).
- Per-chapter global leaderboards for World saved %.
- Needle cosmetic skins.
- Hindi / Marathi script translations (all lines are already data, not code).
