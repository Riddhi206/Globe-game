# THE UNMAKING — Animation, VFX and Audio

The burn is the moment people remember, so it gets the most care. Everything
else supports it: the ink makes the stakes visible, the dialogue gives it a
voice, the restoration wave is the release.

---

## 1. Visual identity: ink and lamplight

Story mode sets `data-story="on"` on `#app`. It keeps Pancake's monochrome
and the heat colours (the core mechanic must stay readable) and adds exactly
two things:

| Token | Dark | Light | Use |
|---|---|---|---|
| `--ink` | `#0b0a09` | `#17120d` | erased countries, Blots, Varka's handwriting |
| `--lamp` | `#ffb347` | `#c97a12` | the Lamp, burn button, embers, equator glow, highlights |
| `--lamp-glow` | `rgba(255,179,71,.35)` | `rgba(201,122,18,.25)` | radial glows behind the burn button and title cards |
| `--paper` | `#1a1712` | `#f3ecdd` | comms panel, postcards, journal (a faint parchment) |

Parchment texture: an inline SVG `feTurbulence` noise as a data-URI
background on `--paper` surfaces at 6% opacity. Fonts: **IM Fell English**
for chapter titles, Varka, postcard titles; **Outfit** (existing) for
everything else.

Note: `--ink` collides with the existing button token `--ink` in
`style.css`. Name the story tokens `--story-ink`, `--story-lamp`,
`--story-glow`, `--story-paper` to avoid it.

## 2. Motion tokens

```css
:root {
  --ease-out:    cubic-bezier(.16, 1, .3, 1);
  --ease-in-out: cubic-bezier(.65, 0, .35, 1);
  --ease-spring: cubic-bezier(.34, 1.56, .64, 1);   /* overshoot */
  --t-fast: 160ms; --t-med: 320ms; --t-slow: 700ms;
}
@media (prefers-reduced-motion: reduce) {
  :root { --t-fast: 1ms; --t-med: 120ms; --t-slow: 200ms; }
}
```

In JS, check `matchMedia('(prefers-reduced-motion: reduce)').matches` once
into `Story.reduced` and skip particles, shake, spin and typewriter when true.

## 3. Needle (the character)

Inline `resources/needle.svg` into the markup once (comms portrait) and once
small (bark avatar). **The SVG uses fixed ids** (`nd-brass`, `nd-pupil`, …):
when inlining twice, prefix the second copy's ids (e.g. `ndm-`) and its
`url(#…)` references, or the gradients collide.

Mood = class on the root `<svg>`; the comms panel swaps it per line:

```css
.needle-char #nd-lid, .needle-char #nd-brow, .needle-char #nd-pupil,
.needle-char #nd-tear, .needle-char #nd-sparkle, .needle-char #nd-crack {
  transition: transform var(--t-med) var(--ease-out), opacity var(--t-med);
}
.needle-char #nd-brow   { transform-origin: 60px 52px; }
.needle-char #nd-pupil  { transform-origin: 60px 73px; }
.needle-char #nd-needle { transform-origin: 60px 72px; animation: nd-spin 6s linear infinite; }

.mood-smug    #nd-lid   { transform: translateY(9px); }
.mood-smug    #nd-brow  { transform: rotate(-8deg); }
.mood-smug    #nd-pupil { transform: translateX(4px); }
.mood-worried #nd-brow  { transform: translateY(-3px) rotate(10deg); }
.mood-worried #nd-pupil { transform: scale(.7); }
.mood-worried #nd-needle{ animation-duration: .9s; }        /* nervous spin */
.mood-excited #nd-pupil { transform: scale(1.25); }
.mood-excited #nd-sparkle { opacity: 1; }
.mood-excited #nd-brow  { transform: translateY(-4px); }
.mood-sad     #nd-lid   { transform: translateY(7px); }
.mood-sad     #nd-tear  { opacity: 1; }
.mood-sad     #nd-brow  { transform: rotate(-12deg) translateY(2px); }
.mood-sad     #nd-needle{ animation-play-state: paused; }
.mood-glitch            { animation: nd-glitch 1.2s steps(2) infinite; }
.mood-glitch  #nd-crack { opacity: 1; }
.mood-glitch  #nd-needle{ animation: nd-jitter .25s steps(3) infinite; }

@keyframes nd-spin   { to { transform: rotate(360deg); } }
@keyframes nd-jitter { 0% { transform: rotate(0) } 50% { transform: rotate(170deg) } 100% { transform: rotate(-40deg) } }
@keyframes nd-glitch {
  0%, 100% { transform: none; filter: none; }
  20% { transform: translate(-2px, 1px) skewX(4deg); filter: hue-rotate(90deg) saturate(3); }
  22% { transform: translate(2px, -1px); filter: none; }
}
/* Idle bob — on the wrapper, not the svg */
.needle-wrap { animation: nd-bob 3.2s var(--ease-in-out) infinite; }
@keyframes nd-bob { 50% { transform: translateY(-3px) rotate(-2deg); } }
/* Blink every few seconds: JS adds .blink for 140 ms at random 2.5–6 s */
.needle-char.blink #nd-lid { transform: translateY(16px); transition-duration: 70ms; }
```

## 4. Dialogue

**Typewriter** — 28 ms per character, 120 ms extra pause after `. , — ! ?`.
A soft tick sound every 2nd character if sound is on
(`StoryAudio.type()`). Tap: first tap completes the line, second advances.
Reduced motion: whole line at once.

**Comms panel** (`#story-comms`) — slides up from the bottom, 320 ms
`--ease-out`, over the input bar. Portrait on the left (Needle 64 px, or a
glossy ink drop for Blots, or nothing for Varka), name in small caps, text.
Blot lines: lowercase, slightly wobbly (`animation: blot-wobble 2s infinite`
skewing ±1°). Echo lines: 60% opacity with a repeated faded copy offset 6 px.

**Varka** (`#story-varka`) — a full-width line across the middle of the
screen in IM Fell English italic, `--story-ink` text on a soft paper smear in
light mode, `#e8d9c0` text with a red-black shadow in dark mode. Reveal as
handwriting: animate `clip-path: inset(0 100% 0 0)` → `inset(0 0 0 0)` over
`chars × 35ms`, `steps(chars)`, plus a 1 px ink "drip" pseudo-element under
the last revealed letter. Holds 2.5 s, then fades (or tap to dismiss).
A low "pen scratch" sound while writing.

**Barks** (`#story-bark`) — 220 ms pop-in (`scale(.85) → 1`, `--ease-spring`)
beside the mini Needle, which also changes mood. Fade out 240 ms.

**Chapter title card** (`#story-card`) — black letterbox bars slide in from
top and bottom (420 ms). "CHAPTER III" in small tracked caps fades in, then
the title in IM Fell English, letter-spacing animating 0.6em → 0.08em over
900 ms with opacity 0 → 1. The recap line typewrites under it. The redacted
location ("somewhere ███") scrambles random glyphs for 600 ms before settling
on █ blocks. Tap or 3.2 s to continue.

## 5. The globe

All canvas drawing happens inside `drawGlobe()` hooks, in the 420×420
logical space (the existing transform handles device pixels).

### 5.1 Ink erasure

Per erased country, `story.js` keeps `{ geo, start, restoreStart }`. Alpha
eases in over 700 ms (`easeOutCubic`) from the erase time, and out over
500 ms from `restoreStart`.

`drawUnder(ctx, pal)`:
1. Build the ink fill once: a 64×64 offscreen canvas filled with
   `--story-ink` plus 300 random 1–2 px specks at 4–10% lighter, used as
   `ctx.createPattern(noiseCanvas, 'repeat')`.
2. For each erased country: `ctx.beginPath(); traceRing(...)` for its rings;
   `ctx.globalAlpha = a; ctx.fillStyle = inkPattern; ctx.fill();`
   then a 1.2 px stroke in `rgba(0,0,0,.6)` so it reads as a stain, not a hole.
3. **Drips** for 900 ms after erasing: 3 circles at points along the
   country's southern-most visible vertices, radius growing 0 → 3 px and
   moving 4–8 px down-screen, alpha fading — the ink "running".
4. Fog (ch 3): fogged geos drawn with the ocean gradient colour, no stroke,
   so the land simply isn't there.

While any erase/restore/drip animation is running, `isAnimating()` returns
true so `animate()` keeps redrawing.

### 5.2 The Blot creature

Drawn in `drawOver()` at the mystery's screen point (`latLonToXY`) once found.

```js
// radius r ≈ 18 px at zoom 1 (scale with zoomScale, clamp 14–40)
// 12 control points, each at r × (1 + .14·sin(t·2.1 + i·1.7) + .06·sin(t·5.3 + i))
// draw a closed smooth path through the midpoints with quadraticCurveTo,
// fill --story-ink; a 2 px lighter rim on the top-left edge for gloss.
// Eyes: two white ellipses (rx 4, ry 5) 6 px apart, upper third; pupils 2 px,
// drifting toward the screen centre; blink (ry → .5 for 120 ms) every 2–5 s.
```

Entrance: rises out of the country over 520 ms — scale 0 → 1.15 → 1
(`--ease-spring`), with 6 ink droplets flung outward that fall back.
Each Blot can have a tiny trait: Sulk droops (eyes half-lidded), Skitter
jitters ±1 px, Murk is 50% translucent, Echo draws twice (offset ghost),
Tick has a small clock-hand line spinning inside, the Mirrorling's eyes are
mirrored left/right every second.

### 5.3 Camera

On found: `flyTo(mystery)` (existing lerp) and animate `zoomScale` from its
current value to `2.6` over 900 ms `easeInOutCubic` via `setZoom` each frame.
After the burn, ease back to `1.6`.

### 5.4 The burn sequence (the money shot)

**HOLD TO BURN button** (`#story-burn`): a 96 px round amber button rising
from below (520 ms `--ease-spring`), label "HOLD TO BURN", an SVG ring
around it: `stroke-dasharray = circumference`, `stroke-dashoffset` animated
from full to 0 over **1200 ms linear** while held (pointerdown/up/leave/cancel;
also Space/Enter for keyboard). Haptic tick `navigator.vibrate(8)` every
200 ms while holding; a rising hum (`StoryAudio.charge(progress)`). Releasing
early: the ring springs back over 300 ms, the hum drops,
`track('story_burn_cancel')`. The Blot visibly strains as the ring fills
(scale 1 → 0.92, eyes squeezing).

**Timeline after the hold completes** (ms from completion):

| t | Event |
|---|---|
| 0 | Full-screen flash overlay: amber → white → transparent, 260 ms |
| 0 | Shockwave: canvas ring from the Blot, radius 0 → 1.5 × globe R over 700 ms (`easeOutCubic`), 3 px → 0 px line, alpha 0.9 → 0 |
| 0 | Embers: 140 particles from the Blot; velocity random 40–160 px/s, upward bias, slight gravity *upward* (they float); life 900–1600 ms; colour `#fff2c7` → `--story-lamp` → `#c0392b` → grey; size 1.5–3 px |
| 0 | Screen shake on `#globe-wrap`: keyframes ±6 px decaying over 420 ms |
| 0 | `StoryAudio.burn()`; `navigator.vibrate([30, 40, 80])` |
| 150 | Blot's last line in a bark bubble ("nnngh—" style) |
| 600 | Blot pops: scale 1 → 1.3 → 0 over 220 ms, 10 ink droplets that fade |
| 900 | **Restoration wave**: each erased country's `restoreStart = 900 + 1400 × (angle(blot, country) / π)` — the ink drains outward from the Blot across the globe |
| 900 | `StoryAudio.restore()` — rising arpeggio timed to the wave |
| 900 | The World saved chip counts *up* to 100% over 1.6 s (it's the world healing; the score was already captured) |
| 2600 | `afterBurn` lines in the comms panel |
| then | Postcard flips in |

Reduced motion: flash + simple fade-out of the Blot + a single cross-fade
restore, no shake/embers/spin.

### 5.5 Endings

- **`globe-spin`** — for the first time in the app, the globe turns on its
  own: in a story-only rAF, `globeLon += 6 * dt` with `dirty = true`, ease in
  over 1.5 s. It keeps spinning slowly behind the credits.
- **`needle-shatter`** — the comms-panel Needle: crack appears (`#nd-crack`
  opacity 1), 300 ms hold, then the SVG is replaced by 14 CSS "shard"
  triangles (clip-path polygons over copies of the SVG) that fly outward with
  rotation and fade over 900 ms; a burst of light behind (`--story-glow`
  radial expanding). `StoryAudio.shatter()`.
- **`scar-appears`** — the camera flies to Point Nemo (zoom 2), the scar
  bleeds in over 1.2 s like an erase, with a low drone.
- **`eye-opens-point-nemo`** — at the scar, an eye (same drawing as a Blot
  eye but large, 14 px) opens over 900 ms; pupil tracks the screen centre;
  blinks once. Then Varka's line.
- **Credits** — lines fade up and drift up over the spinning globe, 2.4 s
  each; tap to speed up.

### 5.6 Postcard

`#story-postcard`: a 300×200 card (parchment), flips in with
`rotateY(180deg) → 0` over 600 ms `--ease-spring` with
`perspective: 1000px`. Front: flag emoji large, country name (IM Fell
English), "🏙️ capital · 👥 ~population" (from `countryFacts()`), the lore
line, and a wax seal (circle, deep red `#7a1f1f`, embossed letter) in the
bottom-right showing `chapter.letter`. **Foil** (1 in 20, `randomInt(20) === 0`):
an animated diagonal sheen (`linear-gradient` background-position sweep,
2.5 s infinite) and the word "FOIL" in the corner.

### 5.7 Chapter complete

Stars drop in one by one (200 ms apart, `scale(0) rotate(-30deg) → 1`,
`--ease-spring`, a chime per star rising in pitch). World saved counts from 0
to the score over 900 ms. The Varka cliffhanger types in at the bottom in
handwriting. Buttons: **Share**, **Continue**.

### 5.8 Small things that add up

- Wrong-guess `shake()` (existing) also nudges the World saved chip red.
- The "reheat" flash in chapter 2: each history row gets `.reheat` →
  background flashes `--story-lamp` at 30% then fades over 600 ms, staggered
  60 ms per row.
- The home Story card: a slow ink drip down its left edge (CSS pseudo-element
  growing and dropping every 6 s), and the Lamp glow pulsing behind the
  title. `NEW` badge pulses until the cold open is seen.
- Locked chapter tiles: the redacted █ blocks shimmer faintly.

## 6. Audio — `story-audio.js`

All sound is synthesised with WebAudio: no audio files, no licensing, tiny
download. Sound is **off** until the player opts in.

```js
const StoryAudio = (() => {
  let ac = null, master = null, on = false;

  function unlock() {                       // call from a user gesture
    if (!ac) {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.gain.value = 0.5; master.connect(ac.destination);
    }
    if (ac.state === 'suspended') ac.resume();
  }
  function setOn(v) { on = v; if (v) unlock(); }

  // helpers
  function tone(freq, dur, { type = 'sine', gain = .2, attack = .005, glideTo = null, at = 0 } = {}) {
    if (!on || !ac) return;
    const t = ac.currentTime + at, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master); o.start(t); o.stop(t + dur + .02);
  }
  function noise(dur, { gain = .2, filter = 'lowpass', freq = 1200, freqTo = null, q = 1, at = 0 } = {}) {
    if (!on || !ac) return;
    const t = ac.currentTime + at, len = Math.ceil(ac.sampleRate * dur);
    const buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource(); src.buffer = buf;
    const f = ac.createBiquadFilter(); f.type = filter; f.Q.value = q; f.frequency.setValueAtTime(freq, t);
    if (freqTo) f.frequency.exponentialRampToValueAtTime(freqTo, t + dur);
    const g = ac.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(master); src.start(t);
  }

  return {
    unlock, setOn,
    type:     () => tone(1800 + Math.random() * 400, .025, { type: 'square', gain: .02 }),
    drip:     () => tone(700, .14, { glideTo: 140, gain: .18 }),
    erase:    () => { noise(.5, { freq: 400, freqTo: 120, gain: .15 }); tone(90, .5, { type: 'triangle', gain: .12 }); },
    heartbeat:() => { tone(55, .16, { type: 'sine', gain: .35 }); tone(50, .16, { type: 'sine', gain: .28, at: .22 }); },
    charge:   p  => tone(160 + p * 440, .22, { type: 'sawtooth', gain: .03 + p * .04 }),   // call every 200 ms while holding
    burn:     () => { noise(1.2, { filter: 'bandpass', freq: 300, freqTo: 4000, q: .8, gain: .35 }); tone(70, 1.2, { type: 'sawtooth', glideTo: 35, gain: .2 }); },
    restore:  () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, .9, { type: 'triangle', gain: .12, at: i * .14 })),
    star:     i  => tone(880 * Math.pow(1.26, i), .35, { type: 'triangle', gain: .14 }),
    pen:      () => noise(.6, { filter: 'highpass', freq: 3000, gain: .03 }),
    glitch:   () => { for (let i = 0; i < 6; i++) tone(200 + Math.random() * 1800, .04, { type: 'square', gain: .05, at: i * .05 }); },
    shatter:  () => { noise(.8, { filter: 'highpass', freq: 2500, gain: .3 }); [2093, 2637, 3136].forEach((f, i) => tone(f, .6, { gain: .06, at: i * .05 })); },
  };
})();
```

**Ambience** (optional, M8 stretch): per chapter, a quiet drone — two
detuned sawtooth oscillators (55 Hz and 55.4 Hz) → lowpass 400 Hz with a
0.05 Hz LFO on cutoff → gain 0.04. Chapter 5 adds the heartbeat on the
clock; chapter 7's drone slowly detunes as Needle glitches. Fade in/out over
2 s on chapter start/end; stop entirely when the tab is hidden.

## 7. Haptics

`navigator.vibrate` (Android Chrome; silently absent on iOS — fine):

| Moment | Pattern |
|---|---|
| Wrong guess, ink spreads | `15` |
| Holding to burn | `8` every 200 ms |
| Burn complete | `[30, 40, 80]` |
| Blot jumps (ch 2) | `[20, 30, 20, 30, 20]` |
| Clock tick (ch 5) | `10` |
| Needle shatters | `[60, 30, 120]` |

Only when sound is on (treat "sound on" as "effects on"), and never under
reduced motion.
