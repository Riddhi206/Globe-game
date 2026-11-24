// i18n.js — text helpers. English only for now: visible text goes through t() so translations
// can be added later without touching the game code (Hindi and Marathi are being proofread on
// the feature/languages branch).
//
//   t(en, vars)     the text with {placeholders} filled
//   cname(name)     a country's name to show
//   bearingWord(d)  'N' … 'NW' as words

const LANG = 'en';

function t(en, vars) {
  return vars ? en.replace(/\{(\w+)\}/g, (m, k) => vars[k] != null ? vars[k] : m) : en;
}

function cname(name) { return name; }

const BEARING_WORDS = { N: 'north', NE: 'north-east', E: 'east', SE: 'south-east', S: 'south', SW: 'south-west', W: 'west', NW: 'north-west' };
function bearingWord(d) { return BEARING_WORDS[d] || d; }

// Typing a country's name in another script (none yet)
function countryFromHindi() { return null; }
function countriesByHindiPrefix() { return []; }
