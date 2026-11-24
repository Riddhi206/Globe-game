// signal-data.js — THE SIGNAL, season 1, act 1. All story content as data;
// signal.js plays it. Edit words here, not in the engine.
//
// Steps (played in order):
//   { m: 'text', mood }              Meera says something (mood: calm smile scared sad cry tired)
//   { from: 'tara', text }           someone else says something (tara, dele, mei, unknown)
//   { photo: {...} }                 a photo; see PHOTO below
//   { voice: { secs, text } }        a voice note (waveform + transcript, blurred until played)
//   { sys: 'text' }                  a small centred line
//   { reply: ['a', 'b'] }            you pick what to send back (flavour, no consequence)
//   { battery: 23 }                  Meera's battery
//   { pause: ms }                    silence
//   { askName: true }                Meera asks what to call you (kept on this device only)
//   { hunt: {...} }                  find her on the globe; see HUNT below
//   { choice: {...} }                a timed choice; see CHOICE below
//   { branch: 'key', paths: { a: [steps], b: [steps] } }   steps that depend on an earlier choice
//   { byTrust: { high: [steps], mid: [steps], low: [steps] }, ending? }
//                                    steps that depend on how much Meera trusts you; with `ending`,
//                                    this is Act 1's ending and the level is recorded
//   { glitch: true }                 the line drops (cliffhanger)
//   { end: 'text' }                  the closing card
// Any step can carry  if: 'name' | 'noName' | 'best' | 'noBest'  to play only for some players.
//
// Tokens in text: {name} your leaderboard name, {best} / {bestN} your best Daily, {time} your local time.
//
// PHOTO: { time: dawn|day|dusk|night|storm, skyline: domes|port|canal|colonial|palms|towers|neon|steppe|lighthouse,
//          water, items: ['⛴️', ...], sign: { text, sub }, weather: rain|snow|haze|fog,
//          view: crack|hole|window|tinted (what she's looking through), caption }
//          Meera is held captive, so first clues are fragments: through a crack, a hole, a dirty window.
// HUNT:  { city: { name, country, lat, lon }, radiusKm, clues: [step | [steps]],
//          miss: ['line', ...], found: [steps], lost: [steps] }
//          Pins: SIGNAL.basePins, plus or minus what the last choice did (3 to 5). Fewer pins = the
//          easiest clues never arrive.
// CHOICE: { key, prompt, seconds, options: [{ id, label, reply, trust, pins, effect }] }
//          trust: +1 / −1 to Meera's trust. pins: change to the next hunt's pins. effect: the line saying so.
//
// TRUST: found on pin 1–2 = +2, found later = +1, lost = −1, no answer to a choice = −1, plus each
// option's `trust`. Level = trust ÷ hunts played: high ≥ trust.high, mid ≥ trust.mid, else low.

const SIGNAL = {
  id: 'signal',
  title: 'THE SIGNAL',
  tagline: 'A missing journalist. Your phone. The whole world.',
  unlockHour: 19,            // next episode: the next 7 PM at least 12 hours after you finish
  basePins: 4,
  trust: { high: 1.75, mid: 0.9 },
  endings: {
    high: { name: 'Never Let Go', line: 'Meera trusts you with her life.' },
    mid:  { name: 'Almost Home',  line: 'Meera is grateful. But she isn’t sure who you are.' },
    low:  { name: 'Static',       line: 'Meera stopped believing you’d find her.' },
  },
  characters: {
    meera:   { name: 'Meera' },
    tara:    { name: 'Tara 🗺️' },
    dele:    { name: 'Dele (editor)' },
    mei:     { name: 'Meera’s phone' },     // Mei writes from Meera's phone
    unknown: { name: 'Unknown number' },
  },

  episodes: [
  // ===================================================================== 1
  {
    n: 1, title: 'Wrong Number', city: 'Istanbul',
    share: '“is this you? please be you”',
    steps: [
      { sys: 'Today · 2:14 AM' },
      { m: 'is this {name}?', mood: 'scared', if: 'name' },
      { m: 'please be {name}', if: 'name' },
      { m: 'hello?? please be the right number', mood: 'scared', if: 'noName' },
      { m: 'my sister only gave me a number. what do I call you?', if: 'noName' },
      { askName: true, if: 'noName' },
      { m: '{name}. okay. hi {name}', if: 'noName' },
      { m: 'sorry. sorry. I know it’s late. I don’t have long' },
      { reply: ['Who is this?', 'Yes, it’s me. Who are you?'] },
      { m: 'My name is Meera Joshi. I’m a journalist in Delhi', mood: 'scared' },
      { m: 'Three days ago two men pushed me into a van outside my flat' },
      { m: 'I don’t know where I am' },
      { m: 'They took my phone. I found this one under the seat. 31% battery' },
      { battery: 31 },
      { m: 'It’s a company phone. HALCYON FREIGHT is stamped on the back' },
      { reply: ['Send me your location!', 'Call the police!'] },
      { m: 'I tried. Location says “disabled by your organisation”. No maps. No browser. No calls', mood: 'sad' },
      { m: 'Only this one chat app works. And the camera' },
      { m: 'Nobody even knows I’m gone' },
      { m: 'My little sister Tara plays Borderline every night. She keeps the best players in a notebook' },
      { m: 'She sent me your number last week. She said “Didi, if you’re ever lost, ask {name}”', mood: 'sad' },
      { m: 'She said you found {best} in {bestN}. She was SO jealous', if: 'best' },
      { m: 'She said you’re the one who never gives up. She was SO jealous', if: 'noBest' },
      { m: 'I’m lost, {name}' },
      { sys: 'The van door slides open' },
      { m: 'they’re pulling me out. hold on', mood: 'scared' },
      { pause: 1600 },
      { m: 'They locked me in a shed by the water. There’s a crack in the door. I can see a little', mood: 'calm' },
      { m: 'I’ll send you everything I can see. Tell me where I am' },
      { hunt: {
          city: { name: 'Istanbul', country: 'Turkey', lat: 41.01, lon: 28.98 }, radiusKm: 300,
          clues: [
            [{ photo: { time: 'dawn', skyline: 'domes', water: true, items: ['⛴️'], view: 'crack', caption: '5:52 AM · through the crack' } },
             { m: 'Water. A ferry. A thin tower like a pencil, sticking up behind a roof' }],
            [{ voice: { secs: 11, text: 'Listen. Singing from the towers, all at once, across the water. Then ferry horns. Seagulls. Everyone’s walking to the boats like it’s a normal day.' } }],
            [{ photo: { time: 'day', skyline: 'domes', items: ['🥯', '🍵'], sign: { text: 'SİMİT', sub: '10 ₺' }, caption: 'a boy left me breakfast' } },
             { m: 'A boy slid a tray under the door. Bread rings with sesame. Tea in a tiny glass shaped like a tulip. The coins say ₺' }],
            [{ photo: { time: 'day', skyline: 'domes', water: true, items: ['⛴️', '🕊️'], sign: { text: 'KARAKÖY İSKELESİ', sub: 'Avrupa ⇄ Asya' }, view: 'crack', caption: 'a sign on the pier' } },
             { m: 'A sign on the pier: Europe ⇄ Asia?? How can one city be on two continents' }],
          ],
          miss: ['That doesn’t feel right… nobody here is wearing a coat, but it isn’t hot either',
                 'Not there. Keep going, please',
                 'One more. I trust you',
                 'Please. Last one'],
          found: [{ m: 'ISTANBUL. Oh my god. You’re right. The boy just whispered “İstanbul” when I asked', mood: 'smile' },
                  { m: 'Tara was right about you' }],
          lost: [{ m: 'The boy whispered it through the door. Istanbul', mood: 'tired' },
                 { m: 'It’s okay. You stayed. That’s more than anyone else did' }],
        } },
      { m: 'He left the door unlocked. I think on purpose' },
      { m: 'I’m out. Two men from the van are by the water, scanning the crowd', mood: 'scared' },
      { battery: 24 },
      { choice: {
          key: 'ep1', prompt: 'What should Meera do?', seconds: 15,
          options: [
            { id: 'ferry', label: '⛴️ Jump on the ferry', reply: 'Get on the ferry. Now.', trust: 1 },
            { id: 'bazaar', label: '🧿 Lose them in the bazaar', reply: 'Lose them in the bazaar.', pins: 1, effect: '🔌 Someone in the bazaar gives her a power bank: +1 pin next episode' },
          ],
        } },
      { branch: 'ep1', paths: {
          ferry: [{ m: 'Running. The gate is closing', mood: 'scared' }, { m: 'I MADE IT. I’m on. The water is so blue it hurts', mood: 'smile' }],
          bazaar: [{ m: 'Going in. Lamps, carpets, a thousand corridors', mood: 'scared' },
                   { m: 'A man at a phone stall looked at me, then pushed a power bank into my hand. Didn’t say a word' },
                   { m: 'I think I lost them', mood: 'calm' }],
        } },
      { m: 'Thank you {name}. I mean it', mood: 'smile' },
      { pause: 1400 },
      { m: 'wait' },
      { m: 'someone just said my name behind me', mood: 'scared' },
      { m: 'nobody here knows my name' },
      { glitch: true },
      { end: 'Meera is offline.' },
    ],
  },

  // ===================================================================== 2
  {
    n: 2, title: 'Salt', city: 'Port Said',
    share: '“If I stop joking I’ll start screaming”',
    recap: { key: 'ep1', ferry: 'You told Meera to jump on the ferry.', bazaar: 'You told Meera to hide in the bazaar.' },
    steps: [
      { sys: 'Meera is online' },
      { byTrust: {
          high: [{ m: 'you came back 🙂', mood: 'tired' }],
          mid:  [{ m: 'are you there?', mood: 'tired' }],
          low:  [{ m: 'are you still there? I wasn’t sure you’d come back', mood: 'sad' }],
        } },
      { reply: ['I’m here. Are you okay?', 'MEERA. What happened?'] },
      { branch: 'ep1', paths: {
          ferry: [{ m: 'The ferry was a good idea. They just waited on the other side' }],
          bazaar: [{ m: 'The bazaar was a good idea. They just waited at every exit' }],
        } },
      { m: 'I woke up in a shipping container. It smells of salt and diesel. There’s a rat', mood: 'tired' },
      { m: 'I’ve named him Dele Jr. after my editor. They both eat my snacks' },
      { reply: ['😂', 'You’re joking? Now?'] },
      { m: 'If I stop joking I’ll start screaming, {name}', mood: 'sad' },
      { m: 'There’s a rusty hole in the wall. I can see out if I squash my face against it' },
      { battery: 19 },
      { hunt: {
          city: { name: 'Port Said', country: 'Egypt', lat: 31.26, lon: 32.30 }, radiusKm: 350,
          clues: [
            [{ photo: { time: 'dawn', skyline: 'canal', items: ['🚢', '🚢'], view: 'hole', caption: 'through the hole' } },
             { m: 'Huge ships in a line, one behind the other. Sand on both sides. Like a river someone drew with a ruler' }],
            [{ m: 'Men shouting “yalla” at each other. The call to prayer again, but it sounds different here' },
             { m: 'A man on the dock is eating rice, lentils and pasta all mixed up in tomato sauce. I would sell my soul for it' }],
            [{ photo: { time: 'day', skyline: 'lighthouse', water: true, items: ['🏮'], view: 'hole', caption: 'old lighthouse' } },
             { m: 'An old lighthouse. Buildings with green wooden balconies. Like Paris got lost in the desert' }],
            [{ photo: { time: 'day', skyline: 'canal', items: ['⚓'], sign: { text: 'هيئة قناة السويس', sub: 'SUEZ CANAL AUTHORITY' }, caption: 'a sign on the dock' } }],
          ],
          miss: ['Hmm. The sun came up behind the ships… does that help?', 'Not there. I think. I don’t know. Sorry', 'Last try before they come back', 'Please'],
          found: [{ m: 'Port Said. Egypt. The top of the Suez Canal', mood: 'smile' }, { m: 'How do you just KNOW things like that' }],
          lost: [{ m: 'A crate outside says PORT SAID. Egypt. The Suez Canal', mood: 'tired' }, { m: 'We’ll get the next one. Together' }],
        } },
      { m: 'A pilot boat is coming alongside. A man in a white uniform', mood: 'scared' },
      { choice: {
          key: 'ep2', prompt: 'Shout for help, or stay hidden?', seconds: 15,
          options: [
            { id: 'shout', label: '📣 Shout to the canal pilot', reply: 'Shout. Make them hear you.', pins: -1, effect: '🔌 The guards hear her and take her charging cable: −1 pin next episode' },
            { id: 'quiet', label: '🤫 Stay quiet till dark', reply: 'Stay quiet. Wait for night.', trust: 1 },
          ],
        } },
      { branch: 'ep2', paths: {
          shout: [{ m: 'I banged and shouted until my hands bled. He looked straight at the container', mood: 'cry' },
                  { m: 'And then he looked away' },
                  { m: 'The guards came. They took my charging cable' }],
          quiet: [{ m: 'Okay. Quiet. Me and Dele Jr. against the world', mood: 'sad' }],
        } },
      { m: 'Can I ask you something, {name}' },
      { m: 'What’s it like where you are right now? It’s {time} there, right?' },
      { reply: ['Quiet. I’m in bed, reading your messages.', 'Normal. Which feels wrong now.'] },
      { m: 'That sounds like heaven', mood: 'smile' },
      { battery: 12 },
      { m: 'The ship is moving' },
      { m: 'We’re going south. Through the canal', mood: 'scared' },
      { m: 'Further from home' },
      { glitch: true },
      { end: 'Meera is offline.' },
    ],
  },

  // ===================================================================== 3
  {
    n: 3, title: 'Monsoon', city: 'Mombasa',
    share: '“Tell Tara I said goodnight. Every night.”',
    recap: { key: 'ep2', shout: 'Meera shouted for help. Nobody came.', quiet: 'Meera stayed hidden as the ship left Egypt.' },
    steps: [
      { sys: '9 days at sea' },
      { byTrust: {
          high: [{ m: 'I knew you’d be here', mood: 'tired' }],
          mid:  [{ m: 'hi. it’s me', mood: 'tired' }],
          low:  [{ m: 'I almost didn’t message you', mood: 'sad' }, { m: 'but there’s nobody else' }],
        } },
      { m: 'found a charging cable in a crew bag. I’m alive. 64%', mood: 'calm' },
      { battery: 64 },
      { m: 'We docked last night. They moved me into a warehouse. The rain on the tin roof sounds like a thousand fingers tapping' },
      { hunt: {
          city: { name: 'Mombasa', country: 'Kenya', lat: -4.04, lon: 39.67 }, radiusKm: 350,
          clues: [
            [{ photo: { time: 'storm', skyline: 'palms', water: true, items: ['⛵', '⛵'], weather: 'rain', view: 'crack', caption: 'through the gap in the door' } },
             { m: 'Wooden boats with one big triangle sail. Palm trees bent in the rain. An old fort wall the colour of sand' }],
            [{ voice: { secs: 15, text: 'Men laughing, shouting “pole pole”. Someone selling hot fried dough. And then an old lady outside the door said “chai piyo, beta”. In GUJARATI. My nani talked like that. What is Gujarati doing here?' } }],
            [{ photo: { time: 'day', skyline: 'palms', items: ['🚌', '🥥'], view: 'tinted', caption: 'they moved me in a minibus' } },
             { m: 'Minibuses painted like graffiti, music blasting. And four giant metal elephant tusks crossing over the road like an arch' }],
            [{ photo: { time: 'day', skyline: 'port', water: true, items: ['⛵'], sign: { text: 'KARIBU', sub: 'Bandari ya Mombasa' }, caption: 'a sign at the port gate' } }],
          ],
          miss: ['The rain is warm. Like bath water. Near the equator, I think', 'Not there… there’s a huge ocean to the east of me', 'Last try. I believe in you', 'Please'],
          found: [{ m: 'Mombasa. Kenya. The old lady told me through the door, very quietly', mood: 'smile' },
                  { m: 'Her great-grandfather sailed here from Gujarat on a boat just like those. The monsoon winds carried them' },
                  { m: 'She passed me a cup of chai through the gap. She didn’t ask anything. She just held my fingers for a second', mood: 'cry' }],
          lost: [{ m: 'Mombasa. Kenya. The old lady whispered it through the door', mood: 'tired' },
                 { m: 'She held my fingers through the gap. For a second it felt like home', mood: 'sad' }],
        } },
      { m: 'I have to tell you something, and I need you not to be nice about it', mood: 'sad' },
      { m: 'I don’t think they’re keeping me alive because I’m useful' },
      { m: 'I think they’re keeping me alive until they decide what to do with me' },
      { voice: { secs: 19, text: 'If this doesn’t work out… tell Tara I’m sorry I missed her school play. Tell her she was right, the world is bigger than the map on her wall. Tell her I said goodnight. Every night. Even the nights I couldn’t.' } },
      { m: 'sorry', mood: 'cry' },
      { choice: {
          key: 'ep3', prompt: 'What do you promise Meera?', seconds: 20,
          options: [
            { id: 'find', label: '🧭 “I’ll find you.”', reply: 'Don’t say goodbye. I’ll find you. Every time.', trust: 1 },
            { id: 'tara', label: '🫶 “Tara won’t be alone.”', reply: 'I promise. Tara won’t be alone.', trust: 1 },
          ],
        } },
      { branch: 'ep3', paths: {
          find: [{ m: 'Every time. Okay. I’m holding you to that', mood: 'smile' }],
          tara: [{ m: 'Thank you. I can breathe again', mood: 'cry' }],
        } },
      { pause: 1600 },
      { m: '{name}' },
      { m: 'Tara just messaged me' },
      { m: 'On THIS number', mood: 'scared' },
      { from: 'tara', text: 'didi?? is this you?? a man sent me this number and said you’d be here' },
      { m: 'nobody has this number except you', mood: 'scared' },
      { glitch: true },
      { end: 'Meera is offline.' },
    ],
  },

  // ===================================================================== 4
  {
    n: 4, title: 'Letters', city: 'Colombo',
    share: '“Don’t let her trust Dele.”',
    recap: { key: 'ep3', find: 'You promised Meera you’d find her. Every time.', tara: 'You promised Meera that Tara won’t be alone.' },
    steps: [
      { byTrust: {
          high: [{ m: 'it’s me. are you okay? I kept thinking about you', mood: 'sad' }],
          mid:  [{ m: 'it’s me', mood: 'sad' }],
          low:  [{ m: 'it’s me. if you’re still reading these', mood: 'sad' }],
        } },
      { m: 'I told Tara to throw her phone in the Yamuna. I hope she did' },
      { m: 'I got out, {name}. A guard fell asleep. I’m hiding in a warehouse by the sea. It smells of tea', mood: 'calm' },
      { battery: 48 },
      { hunt: {
          city: { name: 'Colombo', country: 'Sri Lanka', lat: 6.93, lon: 79.85 }, radiusKm: 300,
          clues: [
            [{ photo: { time: 'day', skyline: 'palms', water: true, items: ['📦'], view: 'window', caption: 'through a dusty window' } },
             { m: 'Palm trees. Turquoise sea. A tall tower that looks like a flower bud. It’s so hot my shoes are melting' }],
            [{ photo: { time: 'day', skyline: 'port', items: ['📦', '🍃'], sign: { text: 'CEYLON', sub: 'PURE TEA' }, caption: 'crates everywhere' } },
             { m: 'Tea crates stamped CEYLON. Thousands of them' }],
            [{ photo: { time: 'dusk', skyline: 'palms', items: ['🛺', '🍳'], view: 'window', caption: 'from the window' } },
             { m: 'Three-wheeler taxis everywhere. A cook chopping flatbread on a hot plate with two blades, clang clang clang, like music' }],
            [{ photo: { time: 'day', skyline: 'palms', items: ['🛺'], sign: { text: 'කොළඹ  கொழும்பு', sub: 'COLOMBO PORT' }, caption: 'three languages on one sign' } }],
          ],
          miss: ['It’s an island, I think. Everyone keeps saying “the island”', 'Not quite. South of where you think, maybe?', 'Last pin. You’ve got this', 'Please'],
          found: [{ m: 'Colombo, Sri Lanka. You found me on an ISLAND, {name}', mood: 'smile' }],
          lost: [{ m: 'Colombo. Sri Lanka. A tiny island and I’m on it. We tried', mood: 'tired' }],
        } },
      { m: 'You need to see what’s in this warehouse' },
      { photo: { time: 'night', skyline: 'port', items: ['✉️', '✉️', '✉️'], caption: 'thousands of them' } },
      { m: 'Letters. Thousands of letters. Old ones. Never delivered' },
      { m: 'Halcyon Freight buys them. Whole post offices. Then they burn them' },
      { m: 'I’m reading one now', mood: 'sad' },
      { voice: { secs: 16, text: '“My dear boy. I planted the mango tree you loved by the gate. When you come home it will be taller than you. Your grandmother.” It’s dated 1994. He never got it.' } },
      { m: 'Why would anyone want to make people disappear from each other', mood: 'cry' },
      { choice: {
          key: 'ep4', prompt: 'The letters are evidence. What does Meera take?', seconds: 15,
          options: [
            { id: 'all', label: '🎒 Fill a bag with them', reply: 'Take as many as you can carry.' },
            { id: 'one', label: '✉️ Only the grandmother’s', reply: 'Take that one. Travel light.' },
          ],
        } },
      { branch: 'ep4', paths: {
          all: [{ m: 'Bag’s heavy. Good. Let them try to explain this' }],
          one: [{ m: 'It’s in my pocket. I’m going to find that boy one day' }],
        } },
      { battery: 41 },
      { from: 'dele', text: 'MEERA. Thank god. It’s Dele. Stay exactly where you are. I’m sending someone to get you.' },
      { m: 'DELE!!! My editor! He found me!', mood: 'smile' },
      { m: 'I’m going home {name}. I’m actually going home' },
      { pause: 1600 },
      { from: 'unknown', text: '{name}. Don’t let her trust Dele.' },
      { glitch: true },
      { end: 'Who sent that?' },
    ],
  },

  // ===================================================================== 5
  {
    n: 5, title: 'Trust', city: 'Singapore',
    share: '“It was always him.”',
    recap: { key: 'ep4', all: 'Meera filled a bag with the stolen letters.', one: 'Meera kept one letter: from a grandmother, to a grandson.' },
    steps: [
      { m: 'Dele’s people put me on a fast boat. Three days. I slept the whole way. They’re being so kind', mood: 'calm' },
      { reply: ['Meera… someone told me not to trust Dele.', 'Where are you now?'] },
      { m: 'Dele has been my editor for six years. He came to Papa’s funeral. He’s my friend', mood: 'calm' },
      { byTrust: {
          high: [{ m: 'But… you’ve never been wrong. Not once. I’ll keep my eyes open. For you' }],
          mid:  [{ m: 'I hear you. But it’s Dele' }],
          low:  [{ m: 'And honestly, {name}? I barely know you' }],
        } },
      { battery: 80 },
      { m: 'They’re driving me to a hotel. Tinted windows. Where am I? Your favourite game', mood: 'smile' },
      { hunt: {
          city: { name: 'Singapore', country: 'Singapore', lat: 1.29, lon: 103.85 }, radiusKm: 300,
          clues: [
            [{ photo: { time: 'day', skyline: 'towers', water: true, weather: 'haze', view: 'tinted', caption: 'from the car' } },
             { m: 'Glass towers in the haze. It’s so humid the car window is sweating on the OUTSIDE' }],
            [{ voice: { secs: 12, text: 'Food hall. Chicken rice, laksa, everyone queueing. Everyone speaks English but with “lah” at the end of everything. It’s so clean I’m scared to drop a napkin.' } }],
            [{ photo: { time: 'storm', skyline: 'towers', water: true, items: ['🦁'], weather: 'rain', caption: '4 PM, every day' } },
             { m: 'A statue: half lion, half fish, spitting water into a bay. Three towers with a whole SHIP balanced on top. It rains at 4 every afternoon like someone booked it' }],
            [{ photo: { time: 'day', skyline: 'towers', items: ['🌴'], sign: { text: 'MARINA BAY', sub: '滨海湾 · Teluk Marina · மரினா பே' }, caption: 'four languages' } }],
          ],
          miss: ['It’s right on the equator. My hair has given up', 'Not quite. The driver said it’s a city AND a country', 'One more!', 'Please'],
          found: [{ m: 'Singapore. You’re scary good at this', mood: 'smile' }],
          lost: [{ m: 'Singapore. A city and a country at once. Next time!', mood: 'calm' }],
        } },
      { m: 'Dele is here. He’s in the lobby', mood: 'smile' },
      { m: 'He’s on the phone. He hasn’t seen me yet' },
      { pause: 1400 },
      { m: '{name}', mood: 'scared' },
      { m: 'he just said “she’s here. bring the car round. she has the letters”' },
      { m: 'he’s not taking me home', mood: 'cry' },
      { m: 'it was always him' },
      { choice: {
          key: 'ep5', prompt: 'Dele doesn’t know she heard him. What now?', seconds: 15,
          options: [
            { id: 'confront', label: '🔥 Confront him', reply: 'Look him in the eye. Make him say it.', pins: -1, effect: '📱 His men smash her phone screen: −1 pin next episode' },
            { id: 'trap', label: '🕸️ Play along. Record him', reply: 'Smile. Play along. Record everything.', trust: 1 },
          ],
        } },
      { branch: 'ep5', paths: {
          confront: [{ m: 'I walked up and said “six years, Dele”. He didn’t even look sorry', mood: 'cry' },
                     { m: 'He said “it was never personal”' },
                     { m: 'One of his men knocked the phone out of my hand. The screen’s cracked. It still works. Just' }],
          trap: [{ m: 'I hugged him. I’m recording. He thinks I’m stupid. Let him', mood: 'scared' }],
        } },
      { m: 'Three men just walked in. One has a tattoo on his wrist', mood: 'scared' },
      { photo: { time: 'night', skyline: 'towers', items: ['🧭'], view: 'tinted', caption: 'a compass with no north' } },
      { m: 'A compass. With no north on it' },
      { glitch: true },
      { end: 'Meera is offline.' },
    ],
  },

  // ===================================================================== 6
  {
    n: 6, title: 'Mei', city: 'Hong Kong',
    share: '“One gap. Two people.”',
    recap: { key: 'ep5', confront: 'Meera confronted Dele. He sold her out.', trap: 'Meera played along and recorded Dele.' },
    steps: [
      { m: 'container again. I’m not alone this time', mood: 'tired' },
      { byTrust: {
          high: [{ m: 'I knew you’d answer. You always do' }],
          mid:  [],
          low:  [{ m: 'I don’t even know why I keep messaging you. Habit, maybe' }],
        } },
      { battery: 22 },
      { m: 'There’s a little girl in here. Her name is Mei. She’s nine. She doesn’t know where her parents are' },
      { m: 'She’s the same age as Tara', mood: 'sad' },
      { m: 'She asked if you’re my friend. I said yes. She says hi' },
      { reply: ['Tell her hi. Tell her she’s brave.', 'Hi Mei 👋'] },
      { m: 'She smiled. First time in two days', mood: 'smile' },
      { m: 'The doors opened for a second. I saw outside' },
      { hunt: {
          city: { name: 'Hong Kong', country: 'China', lat: 22.32, lon: 114.17 }, radiusKm: 300,
          clues: [
            [{ photo: { time: 'night', skyline: 'neon', water: true, items: ['⛴️'], view: 'crack', caption: 'when the doors opened' } },
             { m: 'Mountains of towers. Neon signs everywhere. A little green-and-white ferry crossing a harbour' }],
            [{ voice: { secs: 10, text: 'A siren. Mei says it means a typhoon is coming, signal number eight. People are taping their windows. She speaks Cantonese. She says we’re “home”, but not her home.' } }],
            [{ photo: { time: 'day', skyline: 'neon', items: ['🥟', '🚕'], view: 'hole', caption: 'a dock worker’s breakfast' } },
             { m: 'Red taxis. Bamboo baskets of dumplings stacked like towers' }],
            [{ photo: { time: 'night', skyline: 'neon', water: true, items: ['⛴️'], sign: { text: '天星小輪', sub: 'STAR FERRY' }, caption: 'ferry pier' } }],
          ],
          miss: ['Mei says try further east', 'Not there. Mei is drawing the harbour in the dust for you', 'Last chance. Mei is holding my hand', 'Please'],
          found: [{ m: 'Hong Kong. Mei clapped. Actually clapped', mood: 'smile' }],
          lost: [{ m: 'Hong Kong. Mei told me. It’s okay. We’re together', mood: 'calm' }],
        } },
      { m: 'There’s a gap at the back of the container. Big enough for one person. A small person', mood: 'sad' },
      { m: 'I know what I have to do' },
      { choice: {
          key: 'ep6', prompt: 'One gap. Two people.', seconds: 20,
          options: [
            { id: 'mei', label: '🫶 Mei goes alone', reply: 'Let Mei go. You’ll find another way.', trust: 1 },
            { id: 'both', label: '🔥 Both try, together', reply: 'Both of you. Together. Don’t leave anyone.', trust: 1, pins: -1, effect: '🩹 Meera tears her arm in the gap: −1 pin next episode' },
          ],
        } },
      { branch: 'ep6', paths: {
          mei: [{ m: 'I gave her my phone. Told her to run to the ferry and ask for the police', mood: 'cry' }],
          both: [{ m: 'I pushed her through first. I tried after her. I tore my arm open. I didn’t fit', mood: 'cry' },
                 { m: 'I gave her my phone through the gap' }],
        } },
      { battery: 9 },
      { pause: 1800 },
      { from: 'mei', text: 'this is mei' },
      { from: 'mei', text: 'meera said you know what to do' },
      { from: 'mei', text: 'she said tell {name}: you found me 6 times. find me once more' },
      { from: 'mei', text: 'the men came back. they took her somewhere cold. she said white. everything white' },
      { glitch: true },
      { end: 'The phone has 2% battery.' },
    ],
  },

  // ===================================================================== 7
  {
    n: 7, title: 'White', city: 'Ulaanbaatar',
    share: '“You’re the first person who never let go of me.”',
    recap: { key: 'ep6', mei: 'Meera gave Mei the only way out.', both: 'Meera pushed Mei through first. She didn’t fit.' },
    steps: [
      { sys: 'Unknown number' },
      { m: '{name}. it’s me. new phone. stole it from a guard', mood: 'tired' },
      { m: 'Mei? Is Mei safe?', mood: 'scared' },
      { reply: ['Mei got out. She’s safe.', 'She’s okay. She was so brave.'] },
      { m: 'okay', mood: 'cry' },
      { m: 'okay okay okay' },
      { battery: 37 },
      { m: 'They flew me somewhere. Through the plane window it was white forever. It’s so cold my eyelashes froze' },
      { m: 'Last one, {name}. Then I go home' },
      { hunt: {
          city: { name: 'Ulaanbaatar', country: 'Mongolia', lat: 47.92, lon: 106.92 }, radiusKm: 400,
          clues: [
            [{ photo: { time: 'day', skyline: 'steppe', items: ['🐎'], weather: 'snow', view: 'window', caption: '−27° · from the plane' } },
             { m: 'White, forever. Round white tents with smoke coming out of the top. Horses that don’t seem to care about the cold' }],
            [{ m: 'The letters on the signs look Russian. But the guard says it isn’t Russia' },
             { m: 'There’s a giant silver statue of a man on a horse in the middle of nowhere. Enormous' }],
            [{ photo: { time: 'dusk', skyline: 'towers', items: ['🥟'], weather: 'haze', view: 'tinted', caption: 'the city' } },
             { m: 'A city in a valley, mountains all around. Smoky. Dumplings full of mutton. Everyone in long padded coats' }],
            [{ photo: { time: 'day', skyline: 'steppe', items: ['🐎', '⛺'], sign: { text: 'УЛААНБААТАР', sub: 'Ulaanbaatar' }, caption: 'sign' } }],
          ],
          miss: ['North. Further north, I think. And inland. No sea anywhere', 'Not there. Between two very big countries, the guard said', 'Last pin. Please', 'Please'],
          found: [{ m: 'Ulaanbaatar. Mongolia. The coldest capital in the world', mood: 'smile' }, { m: 'You did it. Seven times' }],
          lost: [{ m: 'Ulaanbaatar. Mongolia. The coldest capital on Earth', mood: 'calm' }, { m: 'You never stopped looking. That’s what matters' }],
        } },
      { m: 'The embassy is sending a car. A real one. I checked this time', mood: 'smile' },
      { m: 'Tara is safe. Mei is safe' },
      { branch: 'ep4', paths: {
          all: [{ m: 'And the letters are going to a newspaper Dele has never heard of. Four thousand families are getting their post. Thirty years late' }],
          one: [{ m: 'And I’m going to find that boy from the letter. The mango tree will be taller than him by now' }],
        } },
      { branch: 'ep5', paths: {
          trap: [{ m: 'My recording of Dele is with the police' }],
          confront: [{ m: 'Dele has disappeared. Nobody can find him. That scares me more than anything', mood: 'scared' }],
        } },
      { branch: 'ep6', paths: {
          mei: [{ m: 'Mei found her mum. She drew you a picture. You’re a stick person holding the whole world', mood: 'smile' }],
          both: [{ m: 'My arm’s in a sling. Mei signed it. In glitter', mood: 'smile' }],
        } },
      { branch: 'ep3', paths: {
          find: [{ m: 'You said you’d find me every time' }],
          tara: [{ m: 'You promised Tara wouldn’t be alone. She wasn’t. She had you in her notebook' }],
        } },
      { ending: true, byTrust: {
          high: [{ m: 'Tara wants to meet you. She’s made you a badge out of cardboard. It says WORLD’S BEST FINDER', mood: 'smile' },
                 { m: 'You’re the first person who never let go of me, {name}', mood: 'cry' },
                 { reply: ['Go home, Meera. Hug Tara.', 'I’ll be here. Always.'] },
                 { m: '❤️' }],
          mid:  [{ m: 'I don’t really know who you are, {name}. But you stayed', mood: 'calm' },
                 { m: 'That’s more than most people do' },
                 { reply: ['Get home safe.', 'I’m glad you’re okay.'] },
                 { m: '🙏' }],
          low:  [{ m: 'I’m sorry I kept losing you. Or you kept losing me. I don’t know anymore', mood: 'sad' },
                 { m: 'I’m going to stop messaging for a while. I need to be somewhere real' },
                 { reply: ['I’m sorry, Meera.', 'Please don’t go.'] },
                 { m: 'Goodbye, {name}', mood: 'tired' }],
        } },
      { sys: 'Meera is offline' },
      { pause: 2400 },
      { sys: 'New message from a new number' },
      { from: 'unknown', text: '{name}' },
      { from: 'unknown', text: 'It’s Meera. The real one' },
      { from: 'unknown', text: 'I’ve been locked in the same container since Delhi. I’ve never been to Istanbul' },
      { from: 'unknown', text: 'Did she ever send you her location? Even once?' },
      { from: 'unknown', text: 'Whoever you’ve been talking to' },
      { from: 'unknown', text: 'isn’t me' },
      { glitch: true },
      { end: 'THE SIGNAL · Act 2: The Other Meera — coming soon' },
    ],
  },
  ],
};
