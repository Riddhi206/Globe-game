# Story mode — "The Unmaking"

Everything needed to build Pancake's story campaign. Nothing here is wired
into the app yet; the build happens milestone by milestone.

**Start here:** [04-build-plan.md](04-build-plan.md) — how to work, the
milestones in order, the QA checklist, and the prompt to paste into Sonnet.

| Doc | What's in it |
|---|---|
| [01-game-design.md](01-game-design.md) | Premise, cast, the 7 chapters, the twist, the choice, scoring, pacing, and the engagement principles (and the lines not to cross) |
| [02-technical-spec.md](02-technical-spec.md) | Every hook into `game.js`, the progress store, unlock rules, the ink and scoring algorithms, chapter modifiers, dialogue system, finale, analytics, sharing |
| [03-animation-audio.md](03-animation-audio.md) | Visual identity, motion tokens, Needle's moods, dialogue animation, globe VFX, the burn timeline, endings, synthesised audio, haptics |
| [04-build-plan.md](04-build-plan.md) | Milestones M0–M10 with acceptance checks, QA checklist, kickoff prompt |

## Resources

| File | Goes to | What it is |
|---|---|---|
| [resources/story-data.js](resources/story-data.js) | `/story-data.js` | Every line of the script and every chapter rule, as data |
| [resources/home-country.js](resources/home-country.js) | `/home-country.js` | On-device home country detection for chapter 7 |
| [resources/needle.svg](resources/needle.svg) | inlined into `index.html` | Needle, with named parts for moods and spin |
| [resources/007_story.sql](resources/007_story.sql) | `/supabase/007_story.sql` | Ending-choice split + cross-device story progress |

## The one-line version

Seven chapters. Each hides an ink Blot in one country; wrong guesses erase
real countries from the globe; find it and hold to burn it. The six chapter
countries spell N-E-E-D-L-E. In chapter 7 the compass lies, the target is
your home, and the last Blot is your guide. Break her or keep her.
