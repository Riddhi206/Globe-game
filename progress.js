// progress.js — the passport (countries you've found) and badges (achievements).
// Both are worked out from the stored games, so they work offline and pick up
// games synced from other devices. Story games are not in the store, so they
// don't count toward either.

const PASSPORT_CONTINENTS = ['Africa', 'Asia', 'Europe', 'North America', 'South America', 'Oceania'];

// ============================================================
// Passport
// ============================================================

// Countries the player has found, Daily and Classic alike: name → first win
function passportFound(games) {
  const found = new Map();
  for (const g of games) {
    if (!g.won) continue;
    const prev = found.get(g.mystery);
    if (!prev || g.ts < prev.ts) found.set(g.mystery, { ts: g.ts, mode: g.mode });
  }
  return found;
}

function passportProgress(games) {
  const found = passportFound(games);
  const byContinent = Object.fromEntries(PASSPORT_CONTINENTS.map(c => [c, { total: 0, found: 0 }]));
  for (const c of COUNTRIES) {
    const k = COUNTRY_CONTINENT[c.code];
    if (!byContinent[k]) continue;
    byContinent[k].total++;
    if (found.has(c.name)) byContinent[k].found++;
  }
  return { found, total: COUNTRIES.length, count: found.size, byContinent };
}

// ============================================================
// Badges
// Each badge counts toward `goal`. Coins are not in yet: when they are, an
// unlock will also pay out (see docs/BACKLOG.md).
// ============================================================
const wonOf = games => games.filter(g => g.won);
const clearedContinents = games => {
  const { byContinent } = passportProgress(games);
  return Object.values(byContinent).filter(c => c.total && c.found === c.total).length;
};

// Founding Player: a limited badge for anyone who finished a game (win or lose)
// before 15 October 2026, 00:00 UTC (when the Daily rolls over). After that it
// can't be earned, so it's hidden from players who don't have it.
const FOUNDING_CUTOFF = Date.UTC(2026, 9, 15);
const FOUNDING_LABEL  = '15 October 2026';
const foundingOpen = () => Date.now() < FOUNDING_CUTOFF;
const foundingGames = games => games.filter(g => g.ts < FOUNDING_CUTOFF);

// The Daily number of the day this player first played, for "Here since Daily #N"
function foundingSince(games) {
  const first = foundingGames(games).reduce((a, g) => (!a || g.ts < a.ts ? g : a), null);
  return first ? dailyNumber(first.day || utcDay(new Date(first.ts))) : null;
}

const BADGES = [
  { id: 'founding-player', special: true, limited: true, icon: '🏅', title: 'Founding Player',
    desc: `Played GlobeGame before ${FOUNDING_LABEL}.`,
    goal: 1,  value: g => foundingGames(g).length ? 1 : 0 },
  { id: 'first-find',  icon: '📍', title: 'First Find',     desc: 'Find your first mystery country.',
    goal: 1,  value: g => wonOf(g).length },
  { id: 'bullseye',     icon: '🎯', title: 'Bullseye',       desc: 'Find it in one guess.',
    goal: 1,  value: g => wonOf(g).filter(x => x.guessCount === 1).length },
  { id: 'bold-opener',  icon: '🦄', title: 'Bold Opener',    desc: 'Win after opening with a rare country.',
    goal: 1,  value: g => wonOf(g).filter(x => x.firstGuess && getOpenerFrequency(x.firstGuess) < 0.05).length },
  { id: 'quiz-whiz',    icon: '🧠', title: 'Quiz Whiz',      desc: 'Get 2 trivia answers right in one game.',
    goal: 1,  value: g => g.filter(x => x.triviaCorrect >= 2).length },
  { id: 'last-gasp',    icon: '⏳', title: 'Last Gasp',      desc: 'Find it on your 10th and final Daily guess.',
    goal: 1,  value: g => wonOf(g).filter(x => x.mode === 'daily' && x.guessCount === 10).length },
  { id: 'night-owl',    icon: '🦉', title: 'Night Owl',      desc: 'Win between midnight and 4am, your time.',
    goal: 1,  value: g => wonOf(g).filter(x => new Date(x.ts).getHours() < 4).length },
  { id: 'on-a-roll',    icon: '🔥', title: 'On a Roll',      desc: 'Reach a 3-day Daily streak.',
    goal: 3,  value: (g, s) => s.daily.bestStreak },
  { id: 'week-warrior', icon: '⚡', title: 'Week Warrior',   desc: 'Reach a 7-day Daily streak.',
    goal: 7,  value: (g, s) => s.daily.bestStreak },
  { id: 'month-maniac', icon: '🌙', title: 'Month Maniac',   desc: 'Reach a 30-day Daily streak.',
    goal: 30, value: (g, s) => s.daily.bestStreak },
  { id: 'regular',      icon: '📅', title: 'Regular',        desc: 'Play 10 different Dailies.',
    goal: 10, value: g => new Set(g.filter(x => x.mode === 'daily').map(x => x.day)).size },
  { id: 'stamped',      icon: '🛂', title: 'Stamped',        desc: 'Find 10 different countries.',
    goal: 10, value: g => passportFound(g).size },
  { id: 'cartographer', icon: '✈️', title: 'Cartographer',   desc: 'Find 50 different countries.',
    goal: 50, value: g => passportFound(g).size },
  { id: 'globetrotter', icon: '🌏', title: 'Globetrotter',   desc: 'Find every country on the list.',
    goal: COUNTRIES.length, value: g => passportFound(g).size },
  { id: 'continent-clear', icon: '🗺️', title: 'Continent Clear', desc: 'Find every country in one continent.',
    goal: 1,  value: g => clearedContinents(g) },
];

// Longest run of consecutive Daily days in a list of games
function bestStreakOf(games) {
  const days = [...new Set(games.filter(g => g.mode === 'daily').map(g => g.day))].sort();
  let best = 0, run = 0, prev = null;
  for (const d of days) { run = prev && dayDiff(prev, d) === 1 ? run + 1 : 1; best = Math.max(best, run); prev = d; }
  return best;
}

// [{ ...badge, value (capped at goal), unlocked }] in list order. A limited badge
// that can no longer be earned is left out unless the player has it.
function badgeStates(games, store) {
  return BADGES.map(b => {
    const v = Math.min(b.value(games, store), b.goal);
    return { ...b, value: v, unlocked: v >= b.goal };
  }).filter(b => !b.limited || b.unlocked || foundingOpen());
}

// Players who already have the Founding badge get its card on their next visit,
// not only after their next game. Called once at load.
function announceFounding() {
  const s = loadStore();
  const states = badgeStates(s.games, s);
  if (!states.some(b => b.id === 'founding-player' && b.unlocked)) return;
  // No badge history yet: everything earned so far counts as seen, so only this card shows
  if (!s.badgesSeen) s.badgesSeen = states.filter(b => b.unlocked && b.id !== 'founding-player').map(b => b.id);
  if (s.badgesSeen.includes('founding-player')) return;
  s.badgesSeen.push('founding-player');
  s.badgesPending = ['founding-player', ...(s.badgesPending || []).filter(id => id !== 'founding-player')];
  saveStore();
}

// Called after each finished game. Badges that unlock now are queued and shown
// as a card once the result card closes (see showPendingBadges). The queue is
// stored, so a badge isn't lost if the player leaves first. The first time this
// runs on a device with older games, badges those games already earned are
// recorded without cards; only badges from the game just played get one.
function announceNewBadges() {
  const s = loadStore();
  const unlocked = badgeStates(s.games, s).filter(b => b.unlocked).map(b => b.id);
  // First run on a device with older games: badges those older games had already
  // earned count as seen, so only the game just played can show a card
  let seenBefore = s.badgesSeen;
  if (!seenBefore) {
    const older = s.games.slice(0, -1);
    seenBefore = badgeStates(older, { daily: { bestStreak: bestStreakOf(older) } }).filter(b => b.unlocked).map(b => b.id);
  }
  const seen = new Set(seenBefore);
  const fresh = BADGES.filter(b => unlocked.includes(b.id) && !seen.has(b.id));
  s.badgesSeen = unlocked;
  if (fresh.length) s.badgesPending = [...new Set([...(s.badgesPending || []), ...fresh.map(b => b.id)])];
  saveStore();
}

// ============================================================
// Badge card: one unlocked badge at a time, closed with a tap
// ============================================================
const badgeDialog = $('badge-dialog');
let badgeQueue = [];   // badge ids waiting on this card
let badgeIndex = 0;

function dropPending(ids) {
  const s = loadStore();
  s.badgesPending = (s.badgesPending || []).filter(id => !ids.includes(id));
  saveStore();
}

// Shows queued badges, unless another sheet is open (it waits for that one)
function showPendingBadges() {
  const pending = (loadStore().badgesPending || []).filter(id => BADGES.some(b => b.id === id));
  if (!pending.length || document.querySelector('dialog[open]')) return;
  badgeQueue = pending;
  badgeIndex = 0;
  renderBadgeCard();
  badgeDialog.showModal();
}

function renderBadgeCard() {
  const b = BADGES.find(x => x.id === badgeQueue[badgeIndex]);
  const s = loadStore();
  const states = badgeStates(s.games, s);
  const got = states.filter(x => x.unlocked).length;
  badgeDialog.classList.toggle('special', !!b.special);
  $('bc-kicker-text').textContent = b.special ? 'Limited edition badge' : 'Badge unlocked';
  // The special badge wears the GlobeGame mark instead of an emoji
  const markSrc = document.documentElement.dataset.theme === 'light' ? 'icons/mark-light.svg' : 'icons/mark-dark.svg';
  if (b.special) $('bc-icon').innerHTML = `<img src="${markSrc}" alt="">`;
  else $('bc-icon').textContent = b.icon;
  $('bc-title').textContent = b.title;
  $('bc-desc').textContent  = b.desc;
  const since = b.id === 'founding-player' ? foundingSince(s.games) : null;
  $('bc-special').hidden = !since;
  if (since) $('bc-special').textContent = `Here since Daily #${since}` +
    (foundingOpen() ? ` · Only until ${FOUNDING_LABEL}` : ` · One of the first`);
  $('bc-count').textContent = `${got} of ${states.length} badges`;
  $('bc-step').hidden = badgeQueue.length < 2;
  $('bc-step').textContent = `${badgeIndex + 1} of ${badgeQueue.length}`;
  $('bc-next-btn').textContent = badgeIndex < badgeQueue.length - 1 ? 'Next' : 'Nice!';
  // Restart the entrance animation for each badge
  const card = badgeDialog.querySelector('.bc-medal');
  card.classList.remove('pop'); void card.offsetWidth; card.classList.add('pop');
  track('badge_card_shown', { badge: b.id });
}

$('bc-next-btn').addEventListener('click', () => {
  dropPending([badgeQueue[badgeIndex]]);
  if (badgeIndex < badgeQueue.length - 1) { badgeIndex++; renderBadgeCard(); }
  else badgeDialog.close();
});
$('bc-all-btn').addEventListener('click', () => {
  dropPending(badgeQueue);           // they're about to see them all in the list
  badgeDialog.close();
  passportTab = 'badges';
  openPassport();
});
$('bc-share-btn').addEventListener('click', () => shareBadge(BADGES.find(x => x.id === badgeQueue[badgeIndex]), 'card'));

// Shared by the unlock card and the trophy cabinet
async function shareBadge(b, from) {
  track('badge_share', { badge: b.id, from });
  if (b.id === 'founding-player') return shareFounding();
  const text = `I just unlocked ${b.icon} ${b.title} on ${APP_NAME}! ${b.desc} Can you get it?\n${shareUrl('badge')}`.trim();
  if (navigator.share) {
    try { await navigator.share({ text }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  copyText(text);
}

// Founding Player share: an image of the badge plus text that plays on the deadline
function foundingShareText(since) {
  const head = `I'm a Founding Player of ${APP_NAME} 🏅 Here since Daily #${since}.`;
  const tail = foundingOpen()
    ? `The badge is only for players who join before ${FOUNDING_LABEL}. Get yours:`
    : 'Before it was cool. Come play:';
  return `${head}\n${tail}\n${shareUrl('founding')}`.trim();
}

async function shareFounding() {
  const since = foundingSince(loadStore().games);
  const text = foundingShareText(since);
  const blob = await buildFoundingImage(since);
  const file = blob && new File([blob], 'globegame-founding-player.png', { type: 'image/png' });
  if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], text }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  if (navigator.share) {
    try { await navigator.share({ text }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  copyText(text);
}

// Square 1080×1080 badge card: gold rays, the mark in a gold ring, the title and date
async function buildFoundingImage(since) {
  if (document.fonts && document.fonts.ready) await document.fonts.ready;
  const S = 1080, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const font = (w, px) => `${w} ${px}px Outfit, system-ui, sans-serif`;
  const gold = g.createLinearGradient(0, 0, S, S);
  gold.addColorStop(0, '#fff1b8'); gold.addColorStop(0.45, '#f5c451'); gold.addColorStop(1, '#c98a1b');

  g.fillStyle = '#0c0c0d'; g.fillRect(0, 0, S, S);
  const glow = g.createRadialGradient(S / 2, 400, 40, S / 2, 400, 520);
  glow.addColorStop(0, 'rgba(245,196,81,0.35)'); glow.addColorStop(1, 'rgba(245,196,81,0)');
  g.fillStyle = glow; g.fillRect(0, 0, S, S);

  // Rays
  g.save(); g.translate(S / 2, 400); g.fillStyle = 'rgba(245,196,81,0.12)';
  for (let i = 0; i < 24; i++) {
    g.rotate(Math.PI / 12);
    g.beginPath(); g.moveTo(0, 0); g.lineTo(-36, -560); g.lineTo(36, -560); g.closePath(); g.fill();
  }
  g.restore();

  // Medal: gold ring, dark disc, the mark
  g.beginPath(); g.arc(S / 2, 400, 200, 0, Math.PI * 2); g.fillStyle = gold; g.fill();
  g.beginPath(); g.arc(S / 2, 400, 184, 0, Math.PI * 2); g.fillStyle = '#141416'; g.fill();
  const mark = await loadImage('icons/mark-dark.svg');
  if (mark) g.drawImage(mark, S / 2 - 150, 250, 300, 300);

  g.textAlign = 'center';
  g.fillStyle = '#f5c451'; g.font = font(800, 34);
  g.fillText('LIMITED EDITION', S / 2, 690);
  g.fillStyle = gold; g.font = font(900, 104);
  g.fillText('Founding Player', S / 2, 800);
  g.fillStyle = '#c9c9cf'; g.font = font(700, 42);
  g.fillText(`Here since Daily #${since} · before ${FOUNDING_LABEL}`, S / 2, 870);

  const logo = await loadImage('icons/logo-dark.svg');
  if (logo) g.drawImage(logo, S / 2 - 160, 940, 320, 320 * 172 / 860);
  return new Promise(resolve => c.toBlob(resolve, 'image/png'));
}
// Escape closes the card: the badge on screen counts as seen, any others wait for next time
badgeDialog.addEventListener('cancel', () => dropPending([badgeQueue[badgeIndex]]));

// The result card goes first; its badges follow when it closes
$('result-dialog').addEventListener('close', () => setTimeout(showPendingBadges, 250));
// Anything left over from a game the player walked away from, and the Founding badge for players who already have it
announceFounding();
setTimeout(showPendingBadges, 1200);

// ============================================================
// Passport and badges sheet
// ============================================================
const passportDialog = $('passport-dialog');
let passportTab = 'passport';

function renderPassport() {
  const games = loadStore().games;
  const p = passportProgress(games);

  $('pp-count').textContent = p.count;
  $('pp-total').textContent = p.total;
  $('pp-bar').style.width = (p.count / p.total * 100) + '%';

  $('pp-continents').innerHTML = PASSPORT_CONTINENTS.map(c => {
    const { found, total } = p.byContinent[c];
    return `<div class="pp-cont"><span>${c}</span><span class="muted">${found} / ${total}</span>` +
           `<div class="pp-track"><i style="width:${total ? found / total * 100 : 0}%"></i></div></div>`;
  }).join('');

  // Found countries show their flag and name; the rest stay as "?" so the mystery holds
  $('pp-grid').innerHTML = COUNTRIES.map(c => p.found.has(c.name)
    ? `<div class="pp-stamp found" title="${escHtml(c.name)}"><span>${flagHtml(c, 28)}</span><small>${escHtml(c.name)}</small></div>`
    : `<div class="pp-stamp"><span>?</span></div>`
  ).join('');

  const badges = badgeStates(games, loadStore());
  const got = badges.filter(b => b.unlocked).length;
  $('badge-count').textContent = `${got} of ${badges.length} unlocked`;
  const daysLeft = Math.max(1, Math.ceil((FOUNDING_CUTOFF - Date.now()) / 86400000));
  const mark = document.documentElement.dataset.theme === 'light' ? 'icons/mark-light.svg' : 'icons/mark-dark.svg';
  $('badge-list').innerHTML = badges.map((b, i) =>
    `<li class="${b.unlocked ? 'got' : ''}${b.special ? ' special' : ''}" data-i="${i}" role="button" tabindex="0" aria-label="${b.title}${b.unlocked ? '' : ', locked'}">` +
    `<span class="b-icon">${!b.unlocked ? '🔒' : b.special ? `<img src="${mark}" alt="">` : b.icon}</span>` +
    `<div class="b-text"><b>${b.title}</b><span class="muted">${b.desc}</span>` +
    (b.id === 'founding-player' && b.unlocked ? `<small class="b-special">Here since Daily #${foundingSince(games)}</small>` : '') +
    (b.id === 'founding-player' && !b.unlocked ? `<small class="b-special">Closes in ${daysLeft} day${daysLeft === 1 ? '' : 's'}</small>` : '') +
    (b.goal > 1 ? `<div class="pp-track"><i style="width:${b.value / b.goal * 100}%"></i></div><small class="muted">${b.value} / ${b.goal}</small>` : '') +
    `</div></li>`
  ).join('');
}

// ============================================================
// Trophy cabinet: a tapped badge, enlarged; swipe through the rest.
// Back returns to the list where it was.
// ============================================================
let trophyBadges = [];
let trophyIndex = 0;
let badgeListScroll = 0;

function trophySlide(b) {
  const games = loadStore().games;
  const mark = document.documentElement.dataset.theme === 'light' ? 'icons/mark-light.svg' : 'icons/mark-dark.svg';
  const icon = !b.unlocked ? `<span class="trophy-locked-icon">${b.special ? '🏅' : b.icon}</span>`
             : b.special ? `<img src="${mark}" alt="">` : b.icon;
  const kicker = b.special ? 'Limited edition' : b.unlocked ? 'Unlocked' : 'Locked';
  let extra = '';
  if (b.id === 'founding-player' && b.unlocked) extra = `<p class="bc-special">Here since Daily #${foundingSince(games)}</p>`;
  else if (b.id === 'founding-player') extra = `<p class="bc-special">Play any game before ${FOUNDING_LABEL} to earn it</p>`;
  else if (!b.unlocked && b.goal > 1) extra = `<div class="pp-track trophy-progress"><i style="width:${b.value / b.goal * 100}%"></i></div><p class="muted trophy-count">${b.value} / ${b.goal}</p>`;
  return `<section class="trophy${b.special ? ' special' : ''}${b.unlocked ? ' got' : ' locked'}" aria-label="${b.title}">
    <p class="sheet-kicker bc-kicker">${kicker}</p>
    <div class="bc-medal" aria-hidden="true">${b.unlocked ? '<span class="bc-rays"></span>' : ''}<span class="bc-icon">${icon}</span></div>
    <h3 class="bc-title">${b.title}</h3>
    <p class="bc-desc">${b.desc}</p>
    ${extra}
    ${b.unlocked ? `<button type="button" class="btn primary trophy-share" data-id="${b.id}">Share</button>` : `<p class="muted trophy-hint">Not unlocked yet</p>`}
  </section>`;
}

function openTrophy(i) {
  const s = loadStore();
  trophyBadges = badgeStates(s.games, s);
  badgeListScroll = $('badge-list').scrollTop;
  const cab = $('trophy-track');
  cab.innerHTML = trophyBadges.map(trophySlide).join('');
  $('badges-panel').hidden = true;
  passportDialog.querySelector('.seg').hidden = true;
  $('trophy-panel').hidden = false;
  cab.scrollTo({ left: i * cab.clientWidth, behavior: 'instant' });
  setTrophyIndex(i);
  cab.focus({ preventScroll: true });
  track('badge_viewed', { badge: trophyBadges[i].id });
}

function closeTrophy() {
  $('trophy-panel').hidden = true;
  passportDialog.querySelector('.seg').hidden = false;
  $('badges-panel').hidden = false;
  $('badge-list').scrollTop = badgeListScroll;
  const row = $('badge-list').querySelector(`[data-i="${trophyIndex}"]`);
  if (row) row.focus({ preventScroll: true });
}

// Marks the slide in view: only its rays turn, and the counter and arrows follow it
function setTrophyIndex(i) {
  trophyIndex = Math.max(0, Math.min(trophyBadges.length - 1, i));
  $('trophy-pos').textContent = `${trophyIndex + 1} / ${trophyBadges.length}`;
  $('trophy-prev').disabled = trophyIndex === 0;
  $('trophy-next').disabled = trophyIndex === trophyBadges.length - 1;
  $('trophy-track').querySelectorAll('.trophy').forEach((el, k) => el.classList.toggle('active', k === trophyIndex));
}

function goTrophy(i) {
  const t = $('trophy-track');
  t.scrollTo({ left: Math.max(0, Math.min(trophyBadges.length - 1, i)) * t.clientWidth, behavior: reduceMotion() ? 'instant' : 'smooth' });
}

$('badge-list').addEventListener('click', e => {
  const row = e.target.closest('li[data-i]');
  if (row) openTrophy(+row.dataset.i);
});
$('badge-list').addEventListener('keydown', e => {
  const row = e.target.closest('li[data-i]');
  if (row && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openTrophy(+row.dataset.i); }
});
$('trophy-track').addEventListener('scroll', () => {
  const t = $('trophy-track');
  const i = Math.round(t.scrollLeft / t.clientWidth);
  if (i !== trophyIndex) setTrophyIndex(i);
}, { passive: true });
$('trophy-track').addEventListener('click', e => {
  const btn = e.target.closest('.trophy-share');
  if (btn) shareBadge(BADGES.find(b => b.id === btn.dataset.id), 'cabinet');
});
$('trophy-panel').addEventListener('keydown', e => {   // arrows work wherever focus is in the cabinet
  if (e.key === 'ArrowRight') { e.preventDefault(); goTrophy(trophyIndex + 1); }
  if (e.key === 'ArrowLeft')  { e.preventDefault(); goTrophy(trophyIndex - 1); }
});
$('trophy-prev').addEventListener('click', () => goTrophy(trophyIndex - 1));
$('trophy-next').addEventListener('click', () => goTrophy(trophyIndex + 1));
$('trophy-back').addEventListener('click', closeTrophy);
// Escape steps back to the list first, instead of closing the whole passport
passportDialog.addEventListener('cancel', e => {
  if (!$('trophy-panel').hidden) { e.preventDefault(); closeTrophy(); }
});

function showPassportTab(tab) {
  passportTab = tab;
  if (!$('trophy-panel').hidden) {           // opening fresh or switching tabs leaves the cabinet
    $('trophy-panel').hidden = true;
    passportDialog.querySelector('.seg').hidden = false;
  }
  $('passport-panel').hidden = tab !== 'passport';
  $('badges-panel').hidden   = tab !== 'badges';
  passportDialog.querySelectorAll('.seg-btn').forEach(b => b.setAttribute('aria-pressed', b.dataset.ptab === tab));
}

function openPassport() {
  renderPassport();
  showPassportTab(passportTab);
  passportDialog.showModal();
  track('passport_open');
}

$('home-passport-btn').addEventListener('click', openPassport);
$('passport-close-btn').addEventListener('click', () => passportDialog.close());
passportDialog.querySelectorAll('.seg-btn').forEach(b => {
  b.addEventListener('click', () => showPassportTab(b.dataset.ptab));
});
