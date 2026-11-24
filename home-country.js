// home-country.js — best guess at the player's home country, on-device only.
//
// Copy to the repo root as /home-country.js (04-build-plan.md, M7).
// Used by chapter 7 ("the compass points home"). The result is never sent to
// the server or put in analytics — the privacy policy promises no location.
//
// Order of evidence, most to least reliable:
//   1. IANA time zone   — reflects where the device actually is set
//   2. language region  — "hi-IN" → India (weaker: lots of phones say en-US)
//   3. most-guessed country in the local game history
//   4. India (the home market) as a last resort
//
// Returns { country, source } where country is a COUNTRIES entry.

const TZ_TO_ISO2 = {
  // South & Central Asia
  'Asia/Kolkata': 'IN', 'Asia/Calcutta': 'IN', 'Asia/Karachi': 'PK', 'Asia/Dhaka': 'BD',
  'Asia/Kathmandu': 'NP', 'Asia/Katmandu': 'NP', 'Asia/Colombo': 'LK', 'Asia/Thimphu': 'BT',
  'Indian/Maldives': 'MV', 'Asia/Kabul': 'AF', 'Asia/Tashkent': 'UZ', 'Asia/Almaty': 'KZ',
  'Asia/Bishkek': 'KG', 'Asia/Dushanbe': 'TJ', 'Asia/Ashgabat': 'TM',
  // East & South-East Asia
  'Asia/Shanghai': 'CN', 'Asia/Tokyo': 'JP', 'Asia/Seoul': 'KR', 'Asia/Pyongyang': 'KP',
  'Asia/Taipei': 'TW', 'Asia/Ulaanbaatar': 'MN', 'Asia/Singapore': 'SG', 'Asia/Kuala_Lumpur': 'MY',
  'Asia/Jakarta': 'ID', 'Asia/Manila': 'PH', 'Asia/Bangkok': 'TH', 'Asia/Ho_Chi_Minh': 'VN',
  'Asia/Saigon': 'VN', 'Asia/Phnom_Penh': 'KH', 'Asia/Vientiane': 'LA', 'Asia/Yangon': 'MM',
  'Asia/Rangoon': 'MM', 'Asia/Brunei': 'BN', 'Asia/Dili': 'TL',
  // Middle East
  'Asia/Dubai': 'AE', 'Asia/Riyadh': 'SA', 'Asia/Qatar': 'QA', 'Asia/Bahrain': 'BH',
  'Asia/Kuwait': 'KW', 'Asia/Muscat': 'OM', 'Asia/Tehran': 'IR', 'Asia/Baghdad': 'IQ',
  'Asia/Jerusalem': 'IL', 'Asia/Tel_Aviv': 'IL', 'Asia/Gaza': 'PS', 'Asia/Hebron': 'PS',
  'Asia/Amman': 'JO', 'Asia/Beirut': 'LB', 'Asia/Damascus': 'SY', 'Asia/Aden': 'YE',
  'Europe/Istanbul': 'TR', 'Asia/Baku': 'AZ', 'Asia/Tbilisi': 'GE', 'Asia/Yerevan': 'AM',
  // Europe
  'Europe/London': 'GB', 'Europe/Dublin': 'IE', 'Europe/Paris': 'FR', 'Europe/Berlin': 'DE',
  'Europe/Madrid': 'ES', 'Europe/Lisbon': 'PT', 'Europe/Rome': 'IT', 'Europe/Amsterdam': 'NL',
  'Europe/Brussels': 'BE', 'Europe/Zurich': 'CH', 'Europe/Vienna': 'AT', 'Europe/Stockholm': 'SE',
  'Europe/Oslo': 'NO', 'Europe/Copenhagen': 'DK', 'Europe/Helsinki': 'FI', 'Europe/Warsaw': 'PL',
  'Europe/Prague': 'CZ', 'Europe/Budapest': 'HU', 'Europe/Bucharest': 'RO', 'Europe/Sofia': 'BG',
  'Europe/Athens': 'GR', 'Europe/Kiev': 'UA', 'Europe/Kyiv': 'UA', 'Europe/Minsk': 'BY',
  'Europe/Moscow': 'RU', 'Europe/Belgrade': 'RS', 'Europe/Zagreb': 'HR', 'Europe/Ljubljana': 'SI',
  'Europe/Bratislava': 'SK', 'Europe/Vilnius': 'LT', 'Europe/Riga': 'LV', 'Europe/Tallinn': 'EE',
  'Europe/Chisinau': 'MD', 'Europe/Sarajevo': 'BA', 'Europe/Skopje': 'MK', 'Europe/Tirane': 'AL',
  'Europe/Podgorica': 'ME', 'Europe/Luxembourg': 'LU', 'Europe/Malta': 'MT', 'Asia/Nicosia': 'CY',
  'Atlantic/Reykjavik': 'IS', 'Europe/Monaco': 'MC', 'Europe/Andorra': 'AD', 'Europe/Vaduz': 'LI',
  'Europe/San_Marino': 'SM', 'Europe/Vatican': 'VA',
  // Africa
  'Africa/Cairo': 'EG', 'Africa/Lagos': 'NG', 'Africa/Nairobi': 'KE', 'Africa/Johannesburg': 'ZA',
  'Africa/Casablanca': 'MA', 'Africa/Algiers': 'DZ', 'Africa/Tunis': 'TN', 'Africa/Tripoli': 'LY',
  'Africa/Accra': 'GH', 'Africa/Addis_Ababa': 'ET', 'Africa/Dar_es_Salaam': 'TZ', 'Africa/Kampala': 'UG',
  'Africa/Kigali': 'RW', 'Africa/Khartoum': 'SD', 'Africa/Juba': 'SS', 'Africa/Dakar': 'SN',
  'Africa/Abidjan': 'CI', 'Africa/Douala': 'CM', 'Africa/Kinshasa': 'CD', 'Africa/Lubumbashi': 'CD',
  'Africa/Luanda': 'AO', 'Africa/Lusaka': 'ZM', 'Africa/Harare': 'ZW', 'Africa/Maputo': 'MZ',
  'Africa/Windhoek': 'NA', 'Africa/Gaborone': 'BW', 'Indian/Antananarivo': 'MG', 'Indian/Mauritius': 'MU',
  'Africa/Bamako': 'ML', 'Africa/Niamey': 'NE', 'Africa/Ndjamena': 'TD', 'Africa/Mogadishu': 'SO',
  'Africa/Djibouti': 'DJ', 'Africa/Asmara': 'ER', 'Africa/Conakry': 'GN', 'Africa/Freetown': 'SL',
  'Africa/Monrovia': 'LR', 'Africa/Banjul': 'GM', 'Africa/Bissau': 'GW', 'Africa/Lome': 'TG',
  'Africa/Porto-Novo': 'BJ', 'Africa/Ouagadougou': 'BF', 'Africa/Nouakchott': 'MR', 'Africa/Libreville': 'GA',
  'Africa/Malabo': 'GQ', 'Africa/Brazzaville': 'CG', 'Africa/Bangui': 'CF', 'Africa/Bujumbura': 'BI',
  'Africa/Blantyre': 'MW', 'Africa/Maseru': 'LS', 'Africa/Mbabane': 'SZ', 'Atlantic/Cape_Verde': 'CV',
  'Indian/Comoro': 'KM', 'Indian/Mahe': 'SC', 'Africa/Sao_Tome': 'ST',
  // Americas
  'America/New_York': 'US', 'America/Chicago': 'US', 'America/Denver': 'US', 'America/Los_Angeles': 'US',
  'America/Phoenix': 'US', 'America/Anchorage': 'US', 'Pacific/Honolulu': 'US', 'America/Detroit': 'US',
  'America/Toronto': 'CA', 'America/Vancouver': 'CA', 'America/Edmonton': 'CA', 'America/Winnipeg': 'CA',
  'America/Halifax': 'CA', 'America/St_Johns': 'CA', 'America/Mexico_City': 'MX', 'America/Cancun': 'MX',
  'America/Tijuana': 'MX', 'America/Guatemala': 'GT', 'America/Belize': 'BZ', 'America/El_Salvador': 'SV',
  'America/Tegucigalpa': 'HN', 'America/Managua': 'NI', 'America/Costa_Rica': 'CR', 'America/Panama': 'PA',
  'America/Havana': 'CU', 'America/Jamaica': 'JM', 'America/Port-au-Prince': 'HT', 'America/Santo_Domingo': 'DO',
  'America/Nassau': 'BS', 'America/Barbados': 'BB', 'America/Port_of_Spain': 'TT', 'America/Grenada': 'GD',
  'America/St_Lucia': 'LC', 'America/St_Vincent': 'VC', 'America/St_Kitts': 'KN', 'America/Antigua': 'AG',
  'America/Dominica': 'DM', 'America/Bogota': 'CO', 'America/Caracas': 'VE', 'America/Guyana': 'GY',
  'America/Paramaribo': 'SR', 'America/Lima': 'PE', 'America/Guayaquil': 'EC', 'America/La_Paz': 'BO',
  'America/Santiago': 'CL', 'America/Argentina/Buenos_Aires': 'AR', 'America/Buenos_Aires': 'AR',
  'America/Montevideo': 'UY', 'America/Asuncion': 'PY', 'America/Sao_Paulo': 'BR', 'America/Manaus': 'BR',
  'America/Fortaleza': 'BR', 'America/Recife': 'BR',
  // Oceania
  'Australia/Sydney': 'AU', 'Australia/Melbourne': 'AU', 'Australia/Brisbane': 'AU', 'Australia/Perth': 'AU',
  'Australia/Adelaide': 'AU', 'Australia/Darwin': 'AU', 'Australia/Hobart': 'AU', 'Pacific/Auckland': 'NZ',
  'Pacific/Fiji': 'FJ', 'Pacific/Port_Moresby': 'PG', 'Pacific/Guadalcanal': 'SB', 'Pacific/Efate': 'VU',
  'Pacific/Apia': 'WS', 'Pacific/Tongatapu': 'TO', 'Pacific/Tarawa': 'KI', 'Pacific/Majuro': 'MH',
  'Pacific/Palau': 'PW', 'Pacific/Pohnpei': 'FM', 'Pacific/Nauru': 'NR', 'Pacific/Funafuti': 'TV',
};

function detectHomeCountry(localGames = []) {
  const byCode = new Map(COUNTRIES.map(c => [c.code, c]));

  // 1. Time zone
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const c  = byCode.get(TZ_TO_ISO2[tz]);
    if (c) return { country: c, source: 'timezone' };
  } catch {}

  // 2. Language region, e.g. "hi-IN", "pt_BR"
  const tags = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || ''];
  for (const tag of tags) {
    const m = /[-_]([A-Za-z]{2})$/.exec(tag);
    const c = m && byCode.get(m[1].toUpperCase());
    if (c) return { country: c, source: 'language' };
  }

  // 3. The country this player has guessed most, across every mode
  const counts = new Map();
  for (const g of localGames) for (const name of (g.guesses || [])) counts.set(name, (counts.get(name) || 0) + 1);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  const fav = top && COUNTRIES.find(c => c.name === top[0]);
  if (fav) return { country: fav, source: 'history' };

  // 4. Home market
  return { country: COUNTRIES.find(c => c.name === 'India'), source: 'fallback' };
}
