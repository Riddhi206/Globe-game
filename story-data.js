// story-data.js — THE UNMAKING. Every line and every rule of story mode, as data.
//
// Copy this file to the repo root as /story-data.js (see 04-build-plan.md, M1).
// Code reads it; nothing here runs on its own. Writers can edit lines here
// without touching story.js.
//
// Line shape:  { who, text, mood? }
//   who:  'needle' | 'varka' | 'blot' | 'echo' | 'lamp'
//   mood: Needle only — 'neutral' | 'smug' | 'worried' | 'excited' | 'sad' | 'glitch'
//
// Tokens replaced at runtime (story.js → fillTokens):
//   {name}     player's username (fallback "Lampbearer")
//   {guess}    the country just guessed
//   {erased}   the country the ink just took
//   {restored} the country a trivia answer just brought back
//   {time}     player's local time, e.g. "2:13 AM"
//   {home}     detected home country (chapter 7 only)
//   {games}    number of games in the local store (all modes)
//   {saved}    current World saved %, e.g. "87%"
//   {blot}     this chapter's Shadow name

const STORY = {
  id: 'unmaking',
  title: 'The Unmaking',
  subtitle: 'Seven Shadows. One compass. One choice.',

  // ------------------------------------------------------------------
  // First launch only. The map is already bleeding; you act within 10 s.
  // `action: 'burn-first-stain'` means: show the HOLD TO BURN button over
  // the single stain spreading on the globe; continue when it's burned.
  // ------------------------------------------------------------------
  coldOpen: [
    { who: 'lamp',   text: "The map is bleeding." },
    { who: 'needle', mood: 'worried', text: "Oh thank goodness. A human. You have hands. Quick question — is the world round?" },
    { who: 'needle', mood: 'worried', text: "Doesn’t matter. That stain on the map is eating a country. Pick up the Lamp. Hold it over the ink. NOW." },
    { action: 'burn-first-stain' },
    { who: 'needle', mood: 'excited', text: "YES. Look at that. Look at it sizzle. You’re a natural, {name}, or extremely lucky, and I don’t care which." },
    { who: 'needle', mood: 'neutral', text: "I’m Needle. Compass. Cursed. Long story, short needle. I can’t find north, but I can find trouble." },
    { who: 'needle', mood: 'worried', text: "And there’s a lot of trouble. Somebody’s erasing the whole world, one country at a time." },
    { who: 'varka',  text: "Not erasing. Correcting." },
    { who: 'needle', mood: 'worried', text: "...That was him. Kaelor. The Unmaker. We should go. Now. Before he corrects you." },
    { action: 'title-slam' },
  ],

  // ------------------------------------------------------------------
  // Needle's reactions during the hunt. Picked at random per event, never
  // repeating any of the last 3 lines shown. Chapters can override or add
  // keys in chapter.barks (chapter lines are tried first).
  // ------------------------------------------------------------------
  barks: {
    first: [
      { who: 'needle', mood: 'neutral', text: "First guess. Bold. Let’s see what the colours think." },
      { who: 'needle', mood: 'neutral', text: "Alright, {name}. Throw a dart at the planet." },
    ],
    cold: [
      { who: 'needle', mood: 'smug',    text: "Cold. Like, tea-left-on-the-windowsill cold." },
      { who: 'needle', mood: 'smug',    text: "{guess}? Bold. Wrong, but bold." },
      { who: 'needle', mood: 'neutral', text: "Nope. That’s the opposite of where I’d hide an evil ink monster." },
      { who: 'needle', mood: 'smug',    text: "If it were any further away it’d be on the back of the pancake." },
      { who: 'needle', mood: 'neutral', text: "Blue means freezing. We are, scientifically speaking, freezing." },
    ],
    cool: [
      { who: 'needle', mood: 'neutral', text: "Lukewarm. Like a pancake left on the counter." },
      { who: 'needle', mood: 'neutral', text: "Getting somewhere. Somewhere is a direction, right?" },
      { who: 'needle', mood: 'neutral', text: "Closer. Keep going, {name}." },
    ],
    warm: [
      { who: 'needle', mood: 'excited', text: "Warm! I’m spinning. I’m always spinning. But happily." },
      { who: 'needle', mood: 'excited', text: "Ooh. The ink twitched. It knows you’re coming." },
      { who: 'needle', mood: 'excited', text: "Warm. Don’t celebrate yet. Celebrate a little." },
    ],
    hot: [
      { who: 'needle', mood: 'excited', text: "HOT. It’s right there. I can hear it sulking." },
      { who: 'needle', mood: 'excited', text: "You’re breathing down its neck. Do Shadows have necks?" },
      { who: 'needle', mood: 'excited', text: "Burning. One good guess, {name}. One." },
    ],
    adjacent: [
      { who: 'needle', mood: 'excited', text: "Purple! Next door! It’s hiding in the neighbour’s house!" },
      { who: 'needle', mood: 'neutral', text: "{guess} shares a border with it. Borders. Kaelor hated those." },
      { who: 'needle', mood: 'excited', text: "One fence away. Hop the fence, {name}." },
    ],
    warmer: [
      { who: 'needle', mood: 'excited', text: "Warmer! Whatever you just did, do it again." },
      { who: 'needle', mood: 'neutral', text: "Better. Much better." },
    ],
    colder: [
      { who: 'needle', mood: 'worried', text: "Colder. That was the opposite of the thing." },
      { who: 'needle', mood: 'worried', text: "We were closer a moment ago. Just saying. Gently." },
    ],
    erase: [
      { who: 'needle', mood: 'worried', text: "The ink just took {erased}. Sorry, {erased}." },
      { who: 'needle', mood: 'worried', text: "{erased} went dark. Focus, {name}." },
      { who: 'needle', mood: 'worried', text: "{erased} is gone. Temporarily! Probably. Let’s say temporarily." },
      { who: 'needle', mood: 'worried', text: "World’s at {saved}. I’d like it to stay a world." },
    ],
    triviaIntro: [
      { who: 'needle', mood: 'neutral', text: "The locals know something. Answer right and the ink backs off." },
    ],
    triviaRight: [
      { who: 'needle', mood: 'excited', text: "Ha! The ink flinched. {restored} is back. Nice one, {name}." },
      { who: 'needle', mood: 'excited', text: "Knowledge burns. {restored} lives again." },
    ],
    triviaWrong: [
      { who: 'needle', mood: 'worried', text: "It’s fine. It’s fine. It’s a little bit not fine." },
      { who: 'needle', mood: 'neutral', text: "Can’t know everything. I don’t even know where north is." },
    ],
    pity: [
      { who: 'needle', mood: 'worried', text: "Wait — look. The ink’s running back toward something. Follow the drips, {name}." },
    ],
    repeatGuess: [
      { who: 'needle', mood: 'smug', text: "You already tried {guess}. I remember. I’m very small, but I remember." },
    ],
  },

  // Found in 1–2 guesses: Kaelor notices, so fast players still get story
  fastFind: [
    { who: 'varka', text: "Two guesses. Somebody’s been practising, {name}." },
    { who: 'varka', text: "Lucky. Luck runs out." },
    { who: 'varka', text: "Fast. I’ll make the next one harder." },
  ],

  // Generic Kaelor intrusions, used when a chapter has none scheduled for that
  // miss count. Written across the screen in ink handwriting.
  varkaPool: [
    { who: 'varka', text: "You think you’re saving the world, {name}. You’re redrawing my mistakes." },
    { who: 'varka', text: "Every wrong answer is a country I get to keep." },
    { who: 'varka', text: "It’s {time} where you are, {name}. Time zones were my idea, you know." },
    { who: 'varka', text: "Every line on that globe was a quarrel I settled. Every quarrel I settled started two more." },
    { who: 'varka', text: "{games} games on my map, {name}. You do love to look at it." },
  ],

  // ------------------------------------------------------------------
  // The chapters. country 'HOME' = detected home country (home-country.js).
  // inkPerMiss: fraction of total land AREA erased per wrong guess.
  // stars: [three-star %, two-star %].
  // ------------------------------------------------------------------
  chapters: [
    {
      n: 1, id: 'spill', title: 'The Spill', blot: 'Sulk',
      country: 'New Zealand', letter: 'N',
      inkPerMiss: 0.04, pityAfter: 6, stars: [91, 80],
      modifier: { type: 'none' },
      // The first guess within 5,000 km (or next door) gets eaten: inked over, row and all
      eats: true,
      eaten: [
        { who: 'blot',   text: "mine now." },
        { who: 'needle', mood: 'worried', text: "It ATE {guess}! It knows you’re close. That’s… actually good news." },
      ],
      // A split second of something wrong with Needle (pays off in ch 6–7)
      flicker: { afterMisses: 2, line: { who: 'needle', mood: 'glitch', text: "Wh— sorry. Something itched. In my… everything. Carry on." } },
      recap: "The map is bleeding. Somewhere, a Shadow is sulking.",
      intro: [
        { who: 'needle', mood: 'neutral', text: "Right. Lamp: check. {name}: check-ish." },
        { who: 'needle', mood: 'neutral', text: "Somewhere out there is a Shadow — a scrap of Kaelor’s ink, chewing a country from the inside." },
        { who: 'needle', mood: 'neutral', text: "Guess a country. The colours say how close you are. Blue is freezing. Red is burning. Purple means next door." },
        { who: 'needle', mood: 'worried', text: "Every wrong guess, the ink spreads. You can’t lose. But the world can." },
        { who: 'needle', mood: 'smug',    text: "No pressure. Lots of pressure. Go." },
      ],
      hints: [
        { afterMisses: 4, who: 'needle', mood: 'neutral', text: "This one sulks somewhere far south. Near a lot of sheep. Don’t ask how I know. I’ve met the sheep." },
        { afterMisses: 7, who: 'needle', mood: 'worried', text: "Two big islands, bottom of the world, more sheep than people. Come ON." },
      ],
      varka: [
        { afterMisses: 1, who: 'varka', text: "Oh, a new Lampbearer. How… optimistic." },
        { afterMisses: 3, who: 'varka', text: "Cute compass, {name}. Where did you find her?" },
      ],
      found: [
        { who: 'blot', text: "nooo. i was having a nice time. it was so quiet down here." },
      ],
      burnPrompt: { who: 'needle', mood: 'excited', text: "Hold the Lamp. Hold it. Don’t let go—" },
      afterBurn: [
        { who: 'needle', mood: 'excited', text: "The ink’s pulling back! Look at the map breathe!" },
      ],
      postcard: { lore: "The Shadow hid among two islands and a few million sheep. It found them disappointingly calm." },
      outro: [
        { who: 'needle', mood: 'smug', text: "One down, {name}. Six to go. I think. I’m a compass, not an accountant." },
      ],
      cliffhanger: { who: 'varka', text: "Six left, {name}. And the next one has legs." },
    },

    {
      n: 2, id: 'flinch', title: 'The Flinch', blot: 'Skitter',
      country: 'Egypt', letter: 'E',
      inkPerMiss: 0.045, pityAfter: 7, stars: [90, 78],
      // One arrow points the wrong way for a moment (pays off in ch 7)
      flicker: { afterMisses: 2, arrowTwitch: true, line: { who: 'needle', mood: 'glitch', text: "Huh. My arrow twitched. Ignore that. I always point true." } },
      // The Shadow starts in startCountry. The first guess that is hot (<1500 km),
      // adjacent to it, or IS it makes the Shadow jump to `country`; every past
      // guess is re-scored against the new location (rows flash "re-heat").
      // If the triggering guess is Egypt itself, Skitter jumps straight into it
      // and is found ("it panicked right into your guess").
      modifier: { type: 'jump', startCountry: 'Libya' },
      recap: "Six Shadows left. The next one has legs.",
      intro: [
        { who: 'needle', mood: 'worried', text: "Bad news. This one’s twitchy. If it hears you coming, it’ll run." },
        { who: 'needle', mood: 'neutral', text: "Not far — Shadows hate swimming. But it will run." },
        { who: 'needle', mood: 'worried', text: "If all the colours suddenly change, don’t panic. That’s just the floor moving." },
      ],
      jump: [
        { who: 'blot',   text: "nope nope nope nope nope—" },
        { who: 'needle', mood: 'worried', text: "IT MOVED. Everything just shifted. Look at the colours!" },
      ],
      jumpIntoGuess: [
        { who: 'blot',   text: "nope nope n— oh no." },
        { who: 'needle', mood: 'smug', text: "It panicked and jumped straight into your guess. Idiot Shadow." },
      ],
      hints: [
        { afterMisses: 5, who: 'needle', mood: 'neutral', text: "It ran somewhere old. Older than borders. There’s a river there that ignores all of them." },
        { afterMisses: 8, who: 'needle', mood: 'worried', text: "Pyramids, {name}. Big pointy ones. You’ve definitely heard of them." },
      ],
      varka: [
        { afterMisses: 1, who: 'varka', text: "Ask her why she never points north, {name}." },
        { afterMisses: 4, who: 'varka', text: "Skitter was always my favourite. Cowards survive." },
      ],
      found: [
        { who: 'blot', text: "okay okay okay you win, please don’t— is that a LAMP—" },
      ],
      burnPrompt: { who: 'needle', mood: 'excited', text: "Don’t let it run again. HOLD." },
      afterBurn: [
        { who: 'needle', mood: 'excited', text: "Gone! And it didn’t even get to run. Very satisfying. Do it again, {name}." },
      ],
      postcard: { lore: "Skitter hid in the shadow of something ancient, which, honestly, was a good choice." },
      outro: [
        { who: 'needle', mood: 'neutral', text: "Two. You’re getting good at this. Don’t let it go to your head." },
      ],
      cliffhanger: { who: 'varka', text: "You’re quick, {name}. Let’s see how you do in the dark." },
    },

    {
      n: 3, id: 'murk', title: 'Murk', blot: 'Murk',
      country: 'Ecuador', letter: 'E',
      inkPerMiss: 0.045, pityAfter: 7, stars: [88, 75],
      flicker: { afterMisses: 2, line: { who: 'needle', mood: 'glitch', text: "Funny. The fog’s thinner around me. Probably nothing. Definitely nothing." } },
      // Unguessed land is drawn as fog except within revealKm of any guess.
      // A faint amber line is drawn along the equator (lat 0) as the in-world clue.
      modifier: { type: 'fog', revealKm: 1800, equatorGlow: true },
      recap: "Kaelor wants to see how you do in the dark.",
      intro: [
        { who: 'needle', mood: 'worried', text: "Okay. I don’t love this. Murk eats light." },
        { who: 'needle', mood: 'neutral', text: "You’ll only see land near your guesses. Everything else is fog." },
        { who: 'needle', mood: 'smug',    text: "Murk has one weakness: it hates being in the middle of things. Which is ironic, given where it lives." },
      ],
      hints: [
        { afterMisses: 5, who: 'needle', mood: 'neutral', text: "There’s a line that splits the world in half. Murk’s sitting right on it, smug as anything." },
        { afterMisses: 8, who: 'needle', mood: 'worried', text: "Volcanoes. Giant tortoises. A country literally named after that line. Come ON, {name}." },
      ],
      varka: [
        { afterMisses: 1, who: 'varka', text: "Can’t see? Now you know how the map felt, before me." },
        { afterMisses: 4, who: 'varka', text: "She’s leading you somewhere, {name}. Just not where you think." },
      ],
      found: [
        { who: 'blot', text: "...too bright. it was supposed to stay dark." },
      ],
      burnPrompt: { who: 'needle', mood: 'excited', text: "Light it up. Hold." },
      afterBurn: [
        { who: 'needle', mood: 'excited', text: "And the fog’s gone with it. Hello, world. Missed you. You too, {name}." },
      ],
      postcard: { lore: "Named for the line that splits the world — Murk thought nobody would look right down the middle." },
      outro: [
        { who: 'needle', mood: 'neutral', text: "Three. Halfway-ish. I’m bad at halves. I’m a circle." },
      ],
      cliffhanger: { who: 'needle', mood: 'worried', text: "Wait. Did you hear that? Something’s repeating everything I say." },
      cliffhangerEcho: { who: 'echo', text: "...everything I say." },
    },

    {
      n: 4, id: 'echo', title: 'Echo', blot: 'Echo',
      country: 'Dominican Republic', letter: 'D',
      inkPerMiss: 0.026, pityAfter: 8, stars: [88, 72],
      // Riddles appear as Echo lines at the given miss counts, then stay pinned
      // in a "Riddles" strip above the input so the player can reread them.
      modifier: {
        type: 'riddles',
        riddles: [
          { afterMisses: 2, text: "I share my bed with a neighbour I never speak to." },
          { afterMisses: 5, text: "The first city of the new world still sleeps on my southern shore." },
          { afterMisses: 8, text: "Merengue in my veins, sugar on my coast, Haiti to my west." },
        ],
      },
      recap: "Something is repeating everything Needle says.",
      intro: [
        { who: 'needle', mood: 'worried', text: "This one’s called Echo. It copies things. Voices. Shapes. Me." },
        { who: 'echo',   text: "...me." },
        { who: 'needle', mood: 'smug',    text: "Stop that. — It talks in riddles. Riddles are just clues with a superiority complex." },
      ],
      hints: [],
      varka: [
        { afterMisses: 4, who: 'varka', text: "Echo learned everything from me. Repeat the same mistake until it sounds like truth." },
      ],
      found: [
        { who: 'echo', text: "found... found... found..." },
      ],
      burnPrompt: { who: 'needle', mood: 'excited', text: "Hold. And don’t let it have the last word." },
      afterBurn: [
        { who: 'needle', mood: 'smug', text: "Ha. Last word: mine." },
        { who: 'echo',   text: "...mine." },
        { who: 'needle', mood: 'worried', text: "...Okay that was creepy. Moving on." },
      ],
      postcard: { lore: "Echo hid on half an island and copied the sound of the waves until no one could tell them apart." },
      outro: [
        { who: 'needle', mood: 'neutral', text: "Four. The ink’s getting desperate, {name}. I can feel it in my spring." },
      ],
      cliffhanger: { who: 'varka', text: "Tick, tock, {name}. Next time, you won’t get to think." },
    },

    {
      n: 5, id: 'tick', title: 'Tick', blot: 'Tick',
      country: 'Laos', letter: 'L',
      inkPerMiss: 0.0, pityAfter: 99, stars: [85, 68],
      // Ink spreads every `everySeconds` regardless of guesses. Paused while any
      // dialogue, trivia or dialog is open, or the tab is hidden.
      // Wrong guesses do NOT add ink here — the clock is the pressure.
      modifier: { type: 'clock', everySeconds: 8, inkPerTick: 0.012 },
      recap: "Tick, tock.",
      intro: [
        { who: 'needle', mood: 'worried', text: "Oh no. I know this one. Tick doesn’t wait for you to guess." },
        { who: 'needle', mood: 'worried', text: "It spreads every few seconds. On its own. So: think fast. Guess faster. Panic… moderately." },
        { who: 'needle', mood: 'neutral', text: "I’ll pause the clock while we talk. I’m not a monster. Kaelor is." },
      ],
      hints: [
        { afterSeconds: 30, who: 'needle', mood: 'worried', text: "It’s somewhere with no coast at all. Land on every side." },
        { afterSeconds: 60, who: 'needle', mood: 'worried', text: "A great river runs through it. Temples. Sticky rice. They used to call it the land of a million elephants." },
      ],
      varka: [
        { afterSeconds: 45, who: 'varka', text: "Every second you think, I erase. Do keep thinking." },
      ],
      found: [
        { who: 'blot', text: "time’s... up... for... me..." },
      ],
      burnPrompt: { who: 'needle', mood: 'excited', text: "NOW. HOLD. Before it ticks again!" },
      afterBurn: [
        { who: 'needle', mood: 'excited', text: "The ticking stopped. I didn’t realise how loud it was until it stopped. Thank you, {name}." },
      ],
      postcard: { lore: "Landlocked, river-bound, and once called the Land of a Million Elephants. Tick never saw them coming." },
      outro: [
        { who: 'needle', mood: 'neutral', text: "Five. Two to go. Wait — two? I thought one. Never mind. Counting is hard." },
      ],
      cliffhanger: { who: 'needle', mood: 'worried', text: "Something’s wrong with the map, {name}. It looks… backwards." },
    },

    {
      n: 6, id: 'mirror', title: 'The Mirrorling', blot: 'Mirrorling',
      country: 'Estonia', letter: 'E',
      inkPerMiss: 0.026, pityAfter: 8, stars: [85, 68],
      // Projection is mirrored east–west (x → −x) and drag direction inverted.
      // Bearing arrows on guess rows stay TRUE (real-world) — Needle brags about
      // it. Lines with reversed: true render the text reversed; tap to flip.
      modifier: { type: 'mirror' },
      recap: "The map looks backwards.",
      intro: [
        { who: 'needle', mood: 'worried', text: "Okay. Okay. Don’t drag too fast. Everything’s flipped. East is west. West is… also confusing." },
        { who: 'needle', mood: 'smug',    text: "Good thing I still point true. I always point true, {name}. Always." },
        { who: 'blot',   reversed: true,  text: "!uoy dnif ll’I" },
      ],
      hints: [
        { afterMisses: 5, who: 'needle', mood: 'neutral', text: "It’s hiding by a cold sea, in the smallest of three sisters." },
        { afterMisses: 8, who: 'needle', mood: 'worried', text: "Saunas. A medieval old town. The first country to vote online. North-east Europe, {name}." },
      ],
      varka: [
        { afterMisses: 4, who: 'varka', text: "Strange, isn’t it? How quickly you trust a needle." },
      ],
      found: [
        { who: 'blot', reversed: true, text: ".em dnif t’ndluoc uoy thguoht I" },
      ],
      burnPrompt: { who: 'needle', mood: 'excited', text: "Hold. Flip it back where it came from." },
      afterBurn: [
        { who: 'needle', mood: 'excited', text: "The map’s the right way round again, {name}. My spring feels better already." },
      ],
      postcard: { lore: "The smallest of the Baltic sisters, and the first to vote online. The Mirrorling couldn’t stand how forward-looking it was." },
      outro: [
        { who: 'needle', mood: 'excited', text: "That’s six. Six Shadows. That’s all of them! We did it!" },
        { who: 'needle', mood: 'worried', text: "...{name}? Why is the Lamp still lit?" },
      ],
      cliffhanger: { who: 'varka', text: "Because you’re not done. You’re holding the last one." },
    },

    {
      n: 7, id: 'needle', title: 'Needle', blot: 'Needle',
      country: 'HOME', letter: '',
      inkPerMiss: 0.02, pityAfter: 99, stars: [85, 68],
      // The target is the player's HOME country. Every guess row's arrow
      // points the OPPOSITE way to the true bearing (Needle is steering you
      // away from the truth). Heat colours stay true. Needle's barks get
      // progressively glitchier (glitch line i is used for miss i, then the
      // last one repeats). No Shadow appears on find: the ink rises from
      // Needle herself → the choice.
      modifier: { type: 'liar' },
      recap: "The Lamp is still lit.",
      intro: [
        { who: 'needle', mood: 'worried', text: "That’s not funny, Kaelor." },
        { who: 'varka',  text: "It isn’t meant to be. Ask her where north is, {name}." },
        { who: 'needle', mood: 'worried', text: "I— my needle spins because I’m cursed. That’s all. That’s ALL." },
        { who: 'varka',  text: "She spins because she’s mine. The seventh piece. I hid it where no Lampbearer would ever look. In their hand." },
        { who: 'needle', mood: 'glitch',  text: "Don’t listen to him. Just guess. Follow my arrows. Please." },
      ],
      glitch: [
        { who: 'needle', mood: 'glitch', text: "Th̷is way. Tr̸ust me." },
        { who: 'needle', mood: 'glitch', text: "Why do the colours disagree with me?" },
        { who: 'needle', mood: 'glitch', text: "I’m pointing true. I’m pointing true. I’m p̵o̶i̷n̴t̸i̷n̵g̶—" },
        { who: 'needle', mood: 'glitch', text: "{name}, I don’t think it’s out there. I think it’s… close. Really close." },
      ],
      varka: [
        { afterMisses: 2, who: 'varka', text: "Look at her arrows, {name}. She’s pointing you away from it. Of course she is. Nobody wants to find themselves." },
        { afterMisses: 4, who: 'varka', text: "It’s {time} in {home}, {name}. Everyone you know is on this map." },
        { afterMisses: 6, who: 'varka', text: "Trust the colours, not the needle. I’m telling you the truth. I always have. That was the problem." },
      ],
      reveal: [
        { who: 'needle', mood: 'sad',    text: "...oh." },
        { who: 'needle', mood: 'sad',    text: "It’s me. Isn’t it. The ink’s coming from me." },
        { who: 'varka',  text: "Burn her, and I am gone. Every border comes back. Every quarrel too." },
        { who: 'varka',  text: "Keep her, and I keep a little corner of your world. A small price. She’s good company." },
        { who: 'needle', mood: 'sad',    text: "{name}. Whatever you choose… thanks for carrying me." },
      ],
      postcard: null,
      cliffhanger: null,
    },
  ],

  // ------------------------------------------------------------------
  // The choice and the two endings
  // ------------------------------------------------------------------
  choice: {
    breakLabel: "Break the Needle",
    breakHint:  "Hold to burn",
    keepLabel:  "Keep her",
  },

  endings: {
    break: {
      lines: [
        { who: 'needle', mood: 'sad',  text: "Hey. {name}." },
        { who: 'needle', mood: 'sad',  text: "Is the world round?" },
        { action: 'globe-spin' },                       // first idle spin in the whole app
        { who: 'needle', mood: 'excited', text: "...Huh. It is." },
        { who: 'needle', mood: 'excited', text: "It’s beautiful." },
        { action: 'needle-shatter' },
        { who: 'lamp', text: "The world is whole. Somewhere, a compass points north." },
      ],
      share: "I broke it. 🧭💔",
      postCredits: [
        { who: 'lamp',  text: "On a table at the bottom of the world, a new needle twitches." },
        { who: 'lamp',  text: "Chapter II — The Unmapped." },
      ],
      // Shown before the last post-credits line when the average World saved % is high
      postCreditsIf: 85,
      postCreditsBonus: { who: 'lamp', text: "It turns, very slowly, and points at {name}." },
    },
    keep: {
      lines: [
        { who: 'varka',  text: "Sentimental. I’d hoped so." },
        { action: 'scar-appears' },                     // small ink scar at Point Nemo, every mode, forever
        { who: 'needle', mood: 'sad',     text: "You kept me, {name}." },
        { who: 'needle', mood: 'sad',     text: "Nobody’s ever kept me." },
        { who: 'needle', mood: 'excited', text: "I’ll find my north. I promise. And when I do, we go and get him." },
      ],
      share: "I kept her. 🧭🤍",
      postCredits: [
        { action: 'eye-opens-point-nemo' },
        { who: 'varka', text: "See you soon, {name}." },
      ],
    },
  },

  // Shown in both endings, under the choice split
  splitLine: "You and {pct}% of players made the same choice.",

  credits: [
    "THE UNMAKING",
    "A GlobeGame story",
    "Starring Needle, as herself",
    "And you, {name}, as the Lampbearer",
    "No countries were permanently harmed.",
    "Except, possibly, Point Nemo.",
  ],

  // ------------------------------------------------------------------
  // The secret: tap the six postcard seals N-E-E-D-L-E in order
  // ------------------------------------------------------------------
  secretLetter: {
    title: "Kaelor’s Last Letter",
    body: [
      "To whoever carries the Lamp —",
      "I drew my first border when I was nine. Two farmers had been arguing over a well. I drew a line between them and they stopped arguing. I thought I had made peace.",
      "By the time I was old, I had drawn ten thousand lines. And every one of them had someone standing on each side, shouting.",
      "So I stopped drawing. Then I started erasing.",
      "You’ll tell yourself you saved the world. Perhaps you did. But look closely at that map you love, at all those neat little lines, and ask who drew them, and why.",
      "I am not gone. I am somewhere no border has ever reached.",
      "— K.",
    ],
    signoff: "Point Nemo · 48°52′S 123°23′W",
  },

  // Point Nemo — the oceanic pole of inaccessibility; Kaelor's lair and the scar
  pointNemo: { lat: -48.8767, lon: -123.3933 },

  ui: {
    modeCardTitle:   "Story mode",
    modeCardNew:     "NEW · Story",
    holdToBurn:      "HOLD TO BURN",
    keepHolding:     "KEEP HOLDING…",
    burnHint:        "Keep holding until the ring closes",
    worldSaved:      "World saved",
    chapterComplete: "Shadow burned",
    continue:        "Continue",
    lockedDaily:     "Unlocks in {countdown} — or finish today’s Daily to light the Lamp now.",
    usernameReason:  "Needle needs to know what to call you.",
    soundPrompt:     "Story mode has sound. Turn it on?",
    soundYes:        "Sound on",
    soundNo:         "Not now",
    journal:         "Map Journal",
    inkMode:         "Ink Mode — no arrows, only heat",
  },
};
