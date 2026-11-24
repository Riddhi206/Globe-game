// hints.js — hints about the mystery country, won by answering trivia right.
//
// Built from the mystery country's own trivia (data.js TRIVIA). Each hint is the
// trivia question itself with the country's name hidden ("this country", "local")
// and its answer: "🦁 What animal is considered sacred in this country's majority
// religion? Cow". Ordered from subtle to specific. Giveaways are dropped: capitals, currencies, flag colours,
// yes/no questions, "only" questions, and any answer that is a country or
// would still name it. The continent is the last hint.

// Nationality words that don't start like the country's name
const HINT_DEMONYMS = {
  'France': ['French'], 'Netherlands': ['Dutch', 'Holland'], 'Spain': ['Spanish', 'Spaniard'],
  'Greece': ['Greek'], 'Switzerland': ['Swiss'], 'Ireland': ['Irish'],
  'United Kingdom': ['British', 'Britain', 'English', 'England', 'Scottish', 'Scotland', 'Welsh', 'Wales', 'UK'],
  'United States': ['American', 'America', 'USA', 'U.S.', 'US'], 'Denmark': ['Danish', 'Dane'],
  'Sweden': ['Swedish', 'Swede'], 'Finland': ['Finnish', 'Finn'], 'Norway': ['Norwegian'],
  'Poland': ['Polish', 'Pole'], 'Turkey': ['Turkish', 'Türkiye', 'Turk'], 'Thailand': ['Thai'],
  'Philippines': ['Filipino', 'Filipina', 'Philippine'], 'Iceland': ['Icelandic'], 'Portugal': ['Portuguese'],
  'China': ['Chinese'], 'Vietnam': ['Vietnamese'], 'Lebanon': ['Lebanese'], 'Sudan': ['Sudanese'],
  'South Sudan': ['Sudanese'], 'Senegal': ['Senegalese'], 'Nepal': ['Nepali', 'Nepalese'],
  'Bangladesh': ['Bangladeshi', 'Bengali'], 'Pakistan': ['Pakistani'], 'Afghanistan': ['Afghan'],
  'Iraq': ['Iraqi'], 'Israel': ['Israeli'], 'Kuwait': ['Kuwaiti'], 'Qatar': ['Qatari'],
  'Saudi Arabia': ['Saudi'], 'Yemen': ['Yemeni'], 'Oman': ['Omani'], 'Madagascar': ['Malagasy'],
  'Cyprus': ['Cypriot'], 'Malta': ['Maltese'], 'Monaco': ['Monegasque', 'Monégasque'],
  'Croatia': ['Croat'], 'Serbia': ['Serb'], 'New Zealand': ['Kiwi', 'Zealander'],
  'Uzbekistan': ['Uzbek'], 'Kazakhstan': ['Kazakh'], 'Tajikistan': ['Tajik'], 'Turkmenistan': ['Turkmen'],
  'Kyrgyzstan': ['Kyrgyz'], 'Myanmar': ['Burmese', 'Burma'], 'Laos': ['Lao', 'Laotian'],
  'Czech Republic': ['Czech', 'Czechia'], 'Slovakia': ['Slovak'], 'Slovenia': ['Slovene'],
  'Ivory Coast': ['Ivorian', "Côte d'Ivoire", "Cote d'Ivoire"], 'Japan': ['Japanese'],
  'Taiwan': ['Taiwanese'], 'Togo': ['Togolese'], 'Gabon': ['Gabonese'], 'Benin': ['Beninese'],
  'Congo': ['Congolese'], 'DR Congo': ['Congolese'], 'Guyana': ['Guyanese'], 'Suriname': ['Surinamese'],
  'Bhutan': ['Bhutanese'], 'Malaysia': ['Malay'], 'Wales': ['Welsh'], 'Peru': ['Peruvian'],
  'Belize': ['Belizean'], 'Haiti': ['Haitian'], 'Chile': ['Chilean'], 'Bahamas': ['Bahamian'],
  'Barbados': ['Bajan', 'Barbadian'], 'Comoros': ['Comorian'], 'Mauritius': ['Mauritian'],
  'Cameroon': ['Cameroonian'], 'Somalia': ['Somali'], 'Djibouti': ['Djiboutian'],
  'Eswatini': ['Swazi', 'Swaziland'], 'Lesotho': ['Basotho', 'Mosotho', 'Sotho'], 'Botswana': ['Batswana', 'Motswana', 'Tswana'],
  'Timor-Leste': ['Timorese', 'East Timor'], 'North Macedonia': ['Macedonian', 'Macedonia'], 'Kosovo': ['Kosovar'],
  'Vatican City': ['Vatican', 'Holy See'], 'San Marino': ['Sammarinese'], 'Liechtenstein': ['Liechtensteiner'],
  'Iran': ['Persian', 'Persia'], 'Andorra': ['Andorran'], 'Luxembourg': ['Luxembourgish', 'Luxembourger'], 'Belgium': ['Belgian'],
  'Argentina': ['Argentine', 'Argentinian'], 'Cape Verde': ['Cabo Verde', 'Cape Verdean'],
};

// Words too generic to hide on their own (from multi-word names)
const HINT_SKIP_WORDS = new Set(['united', 'republic', 'democratic', 'central', 'south', 'north', 'east', 'west',
  'saint', 'islands', 'island', 'and', 'the', 'of', 'new', 'city', 'kingdom', 'states', 'coast', 'african', 'africa',
  'guinea', 'sudan', 'equatorial', 'arab', 'emirates', 'federated', 'papua', 'marino', 'leone', 'lucia', 'vincent',
  'grenadines', 'kitts', 'nevis', 'tome', 'principe', 'and', 'herzegovina', 'tobago', 'barbuda']);

// Entries above that are names of the place, not nationality words
const HINT_PLACE_NAMES = new Set(['Holland', 'Britain', 'England', 'Scotland', 'Wales', 'America', 'Burma', 'Persia',
  'Czechia', 'Türkiye', 'Swaziland', 'East Timor', 'Macedonia', 'Vatican', 'Holy See', 'Cabo Verde', "Côte d'Ivoire", "Cote d'Ivoire"]);

function hintEscRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// Patterns that would name the country: its name (and each distinctive word
// of it), word-starts of its name ("Austri…" catches Austrian), and the
// irregular nationality words above.
function hintNamePatterns(country) {
  const pats = [];
  const full = country.name;
  pats.push({ re: new RegExp(`\\b(the\\s+)?${hintEscRe(full)}\\b`, 'gi'), as: 'this country' });
  for (const w of full.split(/[\s-]+/)) {
    if (w.length < 4 || HINT_SKIP_WORDS.has(w.toLowerCase())) continue;
    // stem: drop up to 3 trailing letters but keep at least 4 (Belgium -> Belgi-, Japan -> Japa-)
    const stem = w.slice(0, Math.max(4, w.length - 3));
    pats.push({ re: new RegExp(`\\b${hintEscRe(w)}\\b`, 'gi'), as: 'this country' });
    pats.push({ re: new RegExp(`\\b${hintEscRe(stem)}[\\p{L}'’]*`, 'giu'), as: 'local' });
  }
  for (const d of HINT_DEMONYMS[full] || []) {
    const adjective = !HINT_PLACE_NAMES.has(d);   // "Dutch growers" -> "local growers"; "Holland" -> "this country"
    pats.push({ re: new RegExp(`\\b${hintEscRe(d)}\\b`, 'g'), as: adjective ? 'local' : 'this country' });
  }
  return pats;
}

// Would this still give the country away?
function hintLeaks(text, pats) { return pats.some(p => { p.re.lastIndex = 0; return p.re.test(text); }); }

// Subtle first, most identifying last (the continent is always last)
const HINT_KIND_ORDER = ['number', 'water', 'mountain', 'desert', 'animal', 'plant', 'food', 'sport', 'music',
  'material', 'language', 'person', 'city', 'landmark'];
const HINT_KIND_ICON = { number: '🔢', water: '🌊', mountain: '⛰️', desert: '🏜️', animal: '🦁', plant: '🌿', food: '🍽️',
  sport: '🏅', music: '🎶', material: '💎', language: '🗣️', person: '🧑', city: '🏙️', landmark: '🏛️' };
const HINT_DROP_KINDS = new Set(['yesno', 'country', 'capital', 'currency', 'continent', 'colour', 'city']);

// Instant giveaways: world-famous landmarks, people, cities and US states.
// Any hint mentioning one (or the capital) is dropped.
const HINT_GIVEAWAYS = /eiffel|taj mahal|big ben|statue of liberty|great wall|colosseum|machu picchu|christ the redeemer|opera house|giza|sphinx|\bpetra\b|angkor|kremlin|red square|\bfuji|acropolis|parthenon|\bpisa\b|sagrada|stonehenge|golden gate|hollywood|bollywood|kilimanjaro|mandela|gandhi|napoleon|buckingham|westminster|louvre|venice|great barrier reef|uluru|niagara|panama canal|suez|table mountain|burj|\bmecca\b|jerusalem|sydney|new york|rio de janeiro|istanbul|mumbai|cape town|barcelona|shanghai|dubai|toronto|petersburg|kyoto|yosemite|yellowstone|grand canyon|rushmore|everest|alaska|arizona|wyoming|california|texas|florida|hawaii|south dakota|montana|salisbury|thames|vatican|chichen itza|yucat/i;

// The topic word a hint is shown under ("river : Darling"). First match wins.
const HINT_TOPICS = [
  [/\briver|\bdelta\b|\bestuary/i, 'river'], [/\blake\b/i, 'lake'],
  [/\bdesert|\bsteppe|\bdunes?\b/i, 'desert'], [/\bmountain|\bpeak\b|\bvolcano|\bhighest\b|\bridge\b/i, 'mountain'],
  [/\bisland|\barchipelago/i, 'island'], [/\bsea\b|\bocean|\bgulf\b|\bcoast|\bstrait|\bbay\b/i, 'sea'],
  [/\bbird|\bfish|\bmammal|\bsnake|\bbeast|\bantelope|\bparrot|\bmonkey|\bape\b|\bdeer|\bfox\b|\bwhale|\bspider|\binsect|\bgoat|\bbutterfly|\breptile/i, 'animal'],
  [/\btree|\bflower|\bfruit|\bcrop|\bherb|\bgrass|\bplant\b|\bpalm\b|\bseed/i, 'plant'],
  [/\bdish|\bdrink|\bcheese|\bbread|\bpastry|\bsoup|\bsnack|\bspice|\bdessert|\bmeal|\bcuisine|\bcoffee|\btea\b|\bbeer|\bwine/i, 'food'],
  [/\bsport|\bgame\b|\bgames\b|\bfootball|\bcricket|\bcycling|\bmartial/i, 'sport'],
  [/\bmusic|\bdance|\bsong|\binstrument|\bsinger|\bcomposer|\bsamba|\btango/i, 'music'],
  [/\blanguage|\balphabet|\bscript\b|\bdialect/i, 'language'],
  [/\bfestival|\bceremony|\bholiday|\btradition|\britual|\bcustom/i, 'tradition'],
  [/\bmineral|\bgem|\bmetal|\bmined|\bmine\b|\bore\b/i, 'mineral'],
  [/\bruler|\bking\b|\bqueen|\bsultan|\bemperor|\bleader|\bdynasty|\bempire|\bprince|\bduke/i, 'ruler'],
  [/\bwar\b|\bbattle|\brevolution|\binvasion|\bindependence|\bcolonial|\bcolonized|\bcolonised|\btreaty/i, 'history'],
  [/\bpoet|\bwriter|\bnovel|\bpainter|\bartist|\bscientist|\binventor|\bexplorer|\bscholar|\bphilosopher/i, 'person'],
  [/\barchitect|\bcathedral|\bchurch|\bmosque|\btemple|\bcastle|\bpalace|\bfort\b|\bruins?\b|\bmonument|\bbridge\b|\bmonastery/i, 'landmark'],
  [/\bclimate|\brainfall|\btemperature|\bweather|\bmonsoon/i, 'climate'],
  [/\breligio|\bbuddh|\bhindu|\bmuslim|\bchristian|\borthodox|\bsaint/i, 'religion'],
  [/\bgeograph|\bborder|\bneighbo|\blandlocked|\bplateau|\bbasin|\bforest|\brainforest|\bsavanna/i, 'geography'],
];
function hintTopic(question) {
  const hit = HINT_TOPICS.find(([re]) => re.test(question));
  return hit ? hit[1] : null;
}

const _hintCache = new Map();

// The question with the country (and its nationality words) hidden
function hintRedact(text, pats) {
  let out = text;
  for (const p of pats) { p.re.lastIndex = 0; out = out.replace(p.re, p.as); }
  return out
    .replace(/\b(north|south|east|west|central|north-?east|north-?west|south-?east|south-?west)(ern)? this country\b/gi, (m, d) => `the ${d.toLowerCase()}${d.toLowerCase() === 'central' ? '' : 'ern'} part of this country`)
    .replace(/\bin ancient this country\b/gi, 'in this country in ancient times')
    .replace(/\bmodern(-day)? this country\b/gi, 'this country today')
    .replace(/\bthis country local\b/gi, 'local')
    .replace(/\bwhich this country (\w+)/gi, 'which $1 in this country')
    .replace(/\bthis country (writer|poet|painter|artist|composer|scientist|inventor|singer|band|author|novelist|director|footballer|athlete|citizenship|parents)\b/gi, 'local $1')
    .replace(/\bthis country (rainforests?|coast(line)?|government|people|cuisine|culture|flag|army|military|economy|islands?|highlands|jungles?|countryside|villages?|towns?|cities|waters|beaches|mountains|forests?|food|music|wildlife|parliament|president|king|queen)\b/gi, "this country's $1")
    .replace(/^this country\b/, 'This country').replace(/^local\b/, 'Local');
}
// A place named after the country ("Lake Chad", "the Gulf of Mexico") can't be hidden cleanly
const HINT_NAMED_AFTER = /\b(lake|mount|gulf of|bay of|sea of|river|basin|desert|islands?)\s+this country\b|\bthis country\s+(river|sea|lake|desert|basin|gulf|canal|islands?|highlands|plateau|empire|kingdom|republic)\b|\bname this country\b/i;

// One fact per answer: "Great Migration" and "Great Wildebeest Migration" are the same thing
function hintSameAnswer(a, b) {
  const words = s => s.toLowerCase().split(/[^\p{L}\d]+/u).filter(w => w.length > 2);
  const x = words(a), y = words(b);
  if (!x.length || !y.length) return a.toLowerCase() === b.toLowerCase();
  const [small, big] = x.length <= y.length ? [x, y] : [y, x];
  return small.every(w => big.includes(w));
}

// [{ icon, q, a }] for this country, subtle to specific: shown as "q a" with the answer bold
function mysteryHints(country) {
  if (_hintCache.has(country.name)) return _hintCache.get(country.name);
  const pats = hintNamePatterns(country);
  const hints = [];
  const continent = typeof COUNTRY_CONTINENT !== 'undefined' && COUNTRY_CONTINENT[country.code];
  if (continent) hints.push({ icon: '🌍', q: 'It’s in', a: continent, rank: 99 });

  const capital = (typeof countryFacts === 'function' && (countryFacts(country.name) || {}).capital) || '';
  // Skip when the capital carries the country's own name (Mexico City, Monaco): the
  // redaction already hides it. Match as a word-start, so "Viennese" counts as Vienna.
  const capWord = capital.split(/[\s(]/)[0];
  const capitalRe = capWord && !country.name.toLowerCase().includes(capWord.toLowerCase())
    ? new RegExp(`\\b${hintEscRe(capWord.slice(0, Math.max(4, capWord.length - 1)))}`, 'i') : null;
  const seen = new Set();
  (TRIVIA[country.name] || []).forEach((q, i) => {
    const kind = triviaKind(q);
    if (HINT_DROP_KINDS.has(kind)) return;
    if (/flag|formerly (known|called)|old name|used to be called/i.test(q.q)) return;
    if (HINT_GIVEAWAYS.test(q.q) || HINT_GIVEAWAYS.test(q.a)) return;
    if (capitalRe && (capitalRe.test(q.q) || capitalRe.test(q.a))) return;  // e.g. "flows through Vienna", "London"
    if (hintLeaks(q.a, pats)) return;                           // the answer itself names it
    if (/\bonly\b/i.test(q.q)) return;                          // "This country is the only…" says nothing useful
    if ([...seen].some(prev => hintSameAnswer(prev, q.a))) return;   // the same answer twice
    seen.add(q.a);
    const shown = hintRedact(q.q, pats);
    if (hintLeaks(shown, pats) || HINT_NAMED_AFTER.test(shown)) return;   // couldn't hide it cleanly
    const rank = HINT_KIND_ORDER.indexOf(kind);
    hints.push({ icon: HINT_KIND_ICON[kind] || '✨', q: shown, a: q.a, rank: rank < 0 ? 6 : rank, i });
  });
  hints.sort((a, b) => a.rank - b.rank || (a.i || 0) - (b.i || 0));
  const out = hints.map(({ icon, q, a }) => ({ icon, q, a }));
  _hintCache.set(country.name, out);
  return out;
}
