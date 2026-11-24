// spyglass.js — country names on the globe.
//
//   · Atlas (the 🗺️ on the home screen): spin the globe with every country named. Any time, no game.
//   · 🔭 Spyglass: in a Daily, spend one to see every country's name for the rest of that Daily.
//     Earn one for every 5 Dailies in a row; hold up to 3. While full, the count toward the
//     next one waits (it starts again after one is spent). A missed day resets the count.
//     New players start with 2.
//
// game.js draws the names (drawCountryLabels) whenever Spyglass.labelsOn() is true.
// State lives on this device only: pancake_spyglass
//   { have, progress, lastDay, usedDay, hidden, starter, earnedDay }

const Spyglass = (() => {
  const KEY = 'pancake_spyglass';
  const EVERY = 5, MAX = 3, STARTER = 2;

  let st = null;
  function load() {
    if (st) return st;
    try { st = JSON.parse(localStorage.getItem(KEY)); } catch {}
    if (!st || typeof st.have !== 'number') {
      // First run on this device: brand-new players get a head start; everyone else's
      // current streak counts toward their first one
      const fresh = loadStore().games.length === 0;
      const streak = currentDailyStreak();
      st = { have: fresh ? STARTER : 0, progress: fresh ? 0 : streak % EVERY, lastDay: loadStore().daily.lastDay || null,
             usedDay: null, hidden: false, starter: fresh, earnedDay: null };
      save();
    }
    return st;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch {} }

  const usedToday = () => gameMode === 'daily' && load().usedDay === gameDay;

  // ---------------------------------------------------------------- earning (called after each finished Daily)
  function onDaily(day) {
    const s = load();
    if (s.lastDay === day) return;
    const streak = loadStore().daily.streak;            // already updated by recordGame()
    if (s.have >= MAX) s.progress = 0;                  // full: nothing builds until one is spent
    else {
      s.progress = streak <= 1 ? 1 : s.progress + 1;
      if (s.progress >= EVERY) {
        s.have++;
        s.progress = 0;
        s.earnedDay = day;
        track('spyglass_earn', { have: s.have, streak });
      }
    }
    s.lastDay = day;
    save();
    renderButton();
  }

  // The line on the Daily result sheet
  function resultLine(day) {
    const s = load();
    if (s.earnedDay === day) return t('🔭 +1 spyglass for your streak! You have {n}.', { n: s.have });
    if (s.have >= MAX) return t('🔭 Spyglasses full ({n}). Use one to earn more.', { n: MAX });
    return t('🔭 {p}/{every} days toward your next spyglass', { p: s.progress, every: EVERY });
  }

  // ---------------------------------------------------------------- names on the globe
  function labelsOn() {
    if (gameMode === 'atlas') return true;
    return usedToday() && !load().hidden;
  }

  // ---------------------------------------------------------------- the 🔭 button on the Daily globe
  const btn = document.getElementById('spy-btn');
  function renderButton() {
    if (!btn) return;
    const s = load();
    const used = usedToday();
    btn.hidden = gameMode !== 'daily' || (gameOver && !used);
    btn.classList.toggle('on', used && !s.hidden);
    btn.classList.toggle('empty', !used && s.have === 0);
    btn.querySelector('.spy-count').textContent = used ? (s.hidden ? t('Show') : t('Hide')) : s.have;
    btn.setAttribute('aria-label', used ? t('Show or hide country names') : t('Spyglass: see every country name ({n} left)', { n: s.have }));
  }

  const dlg = document.getElementById('spy-dialog');
  function open() {
    const s = load();
    if (usedToday()) {                                  // already spent today: just show / hide the names
      s.hidden = !s.hidden;
      save(); renderButton(); dirty = true;
      track('spyglass_toggle', { hidden: s.hidden });
      return;
    }
    const can = s.have > 0 && !gameOver;
    dlg.querySelector('.spy-title').textContent = can ? t('Use a spyglass?') : t('No spyglass yet');
    dlg.querySelector('.spy-body').textContent = can
      ? t('Shows every country’s name for the rest of today’s Daily.')
      : t('Play {every} Dailies in a row to earn one (keep up to {max}).', { every: EVERY, max: MAX });
    dlg.querySelector('.spy-meta').textContent = can
      ? t('You have {n} · +1 per {every}-day streak (max {max})', { n: s.have, every: EVERY, max: MAX })
      : t('{p}/{every} so far', { p: s.progress, every: EVERY });
    dlg.querySelector('.spy-use').hidden = !can;
    dlg.querySelector('.spy-cancel').textContent = can ? t('Not now') : t('OK');
    track('spyglass_open', { have: s.have });
    dlg.showModal();
  }
  function use() {
    const s = load();
    if (s.have <= 0 || gameMode !== 'daily' || gameOver) return;
    s.have--;
    s.usedDay = gameDay;
    s.hidden = false;
    save();
    track('spyglass_use', { have: s.have, guesses: guesses.length });
    dlg.close();
    renderButton();
    dirty = true;
    showToast(t('🔭 Every country is named!'));
  }

  if (btn) btn.addEventListener('click', open);
  if (dlg) {
    dlg.querySelector('.spy-use').addEventListener('click', use);
    dlg.querySelector('.spy-cancel').addEventListener('click', () => dlg.close());
  }

  // ---------------------------------------------------------------- home: the Daily card's 🔭 count
  function renderHomeBadge() {
    const el = document.getElementById('daily-spy');
    if (!el) return;
    const s = load();
    el.hidden = s.have === 0;
    el.textContent = `🔭 ${s.have}`;
    el.title = t('{n} spyglasses', { n: s.have });
  }

  return {
    onDaily, resultLine, labelsOn, renderButton, renderHomeBadge,
    have: () => load().have,
    usedOn: day => !!day && load().usedDay === day,
    starter: () => load().starter,
    EVERY, MAX,
  };
})();
