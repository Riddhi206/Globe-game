// coach.js — the first-game walkthrough: one short tip under the globe per guess
// (none before the first), the first time someone plays (Daily or Classic); never again after.
// Returning players never see it. "How to play" stays available from the ?.
//
// Shares game.js's global scope (gameMode, guesses, trendEl, inputEl, track):
// only touched inside functions, which run after game.js has loaded.

const COACH_KEY = 'pancake_coach'; // 'active' while the first game is being coached, then 'done'

// One line per guess. Small HTML (<b>, colour spans) is allowed; {guess} = the guessed country.
const COACH_LINES = {
  first: {
    cold:     '<span class="c-cold">Blue</span>: far away. <b>Red means close.</b>',
    cool:     '<span class="c-cool">Yellow</span>: getting there. <b>Follow the arrow.</b>',
    warm:     '<span class="c-warm">Orange</span>: warm! <b>Red is even closer.</b>',
    hot:      '<span class="c-hot">Red</span>: really close!',
    adjacent: '<span class="c-adjacent">Purple</span>: {guess} borders it!',
  },
  warmer: '<b>Warmer!</b> Keep going this way.',
  colder: '<b>Colder.</b> Turn around!',
  second: '<b>Follow the arrows.</b> They point toward it.',
  tip:    '<b>Drag</b> to spin, <b>pinch</b> to zoom.',
};

const Coach = {
  step: 0,

  active() {
    try { return localStorage.getItem(COACH_KEY) === 'active'; } catch { return false; }
  },

  // Called once, on a brand-new player's first visit
  begin() {
    try { localStorage.setItem(COACH_KEY, 'active'); } catch {}
  },

  finish(reason) {
    if (!this.active()) return;
    try { localStorage.setItem(COACH_KEY, 'done'); } catch {}
    track('tutorial_done', { reason, guesses: guesses.length, mode: gameMode });
  },

  el() { return document.getElementById('coach'); },

  // line: a string from COACH_LINES
  show(line, { autoHideMs = 0, vars = {} } = {}) {
    const el = this.el();
    if (!el) return;
    el.classList.add('coach-strip');
    el.innerHTML = line.replace(/\{(\w+)\}/g, (m, k) => vars[k] != null ? vars[k] : m);
    el.hidden = false;
    historyEmpty.hidden = true;                       // the tip says it better
    el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
    clearTimeout(this._timer);
    if (autoHideMs) this._timer = setTimeout(() => this.hide(), autoHideMs);
  },

  hide() {
    clearTimeout(this._timer);
    const el = this.el();
    if (el && !el.hidden) { el.hidden = true; if (typeof guesses !== 'undefined' && gameMode !== 'atlas') historyEmpty.hidden = guesses.length > 0; }
    inputEl.classList.remove('coach-glow');
  },

  // A game screen has just been set up (fresh or resumed)
  onStart() {
    this.hide();
    if (!this.active() || !['daily', 'classic'].includes(gameMode)) return;
    if (guesses.length) { this.step = Math.min(guesses.length, 3); return; } // resumed: carry on quietly
    this.step = 0;
    // Nothing to read before the first guess: the starter picks and the glowing search bar
    // say it. The tips start once there's a guess to talk about.
    inputEl.classList.add('coach-glow');
    track('tutorial_step', { step: 0, mode: gameMode });
  },

  onGuess(entry) {
    if (!this.active() || !['daily', 'classic'].includes(gameMode)) return;
    inputEl.classList.remove('coach-glow');
    if (entry.correct) { this.hide(); this.finish('found'); return; }

    this.step = guesses.length;
    const K = COACH_LINES;
    let line = null;
    if (this.step === 1) {
      line = K.first[entry.temp] || K.first.cold;
    } else if (this.step === 2) {
      const trend = trendEl.hidden ? null : (trendEl.classList.contains('warmer') ? 'warmer' : 'colder');
      line = trend ? K[trend] : K.second;
    } else if (this.step === 3) {
      line = K.tip;
    }
    if (line) {
      this.show(line, { autoHideMs: this.step === 1 ? 12000 : 8000, vars: { guess: coachEsc(cname(entry.country.name)) } });
      track('tutorial_step', { step: this.step, mode: gameMode });
    }
    if (this.step >= 3) this.finish('completed');
  },

  // Out of guesses before the walkthrough ended
  onEnd() {
    if (!this.active()) return;
    this.hide();
    this.finish('ended');
  },
};

function coachEsc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

document.addEventListener('click', e => { if (e.target.closest('#coach')) Coach.hide(); });

// ============================================================
// Tips: small callouts that point at one thing on screen, for the
// parts of the game that aren't obvious the first time:
//   · the first guess: its distance, then (Next) its direction arrow
// Each shows once per device. Players with a few games already behind
// them skip the guess tips: they know.
// ============================================================
const TIP_KEYS = { dist: 'pancake_tip_dist', dir: 'pancake_dir_tip' };
const BEARING_DEG  = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };

const Tips = {
  cur: null,   // { el, anchor, place }

  seen(k)  { try { return !!localStorage.getItem(TIP_KEYS[k]); } catch { return true; } },
  mark(k)  { try { localStorage.setItem(TIP_KEYS[k], '1'); } catch {} },
  veteran() { return loadStore().games.length >= 5; },

  // Point a tip at `anchor`, above ('top') or below ('bottom') it
  show(anchor, html, { place = 'bottom', step = null, button = t('Got it'), onButton = null, id = 'tip' } = {}) {
    this.hide();
    const el = document.createElement('div');
    el.className = `tut-tip ${place}`;
    el.setAttribute('role', 'note');
    el.innerHTML = `<div class="tut-tip-body">${html}</div>
      <div class="tut-tip-foot">${step ? `<span class="tut-tip-step">${step}</span>` : ''}<button type="button" class="tut-tip-btn">${button}</button></div>`;
    el.querySelector('.tut-tip-btn').addEventListener('click', e => {
      e.stopPropagation();
      track('tip_action', { tip: id, action: onButton ? 'next' : 'ok' });
      onButton ? onButton() : this.hide();
    });
    document.body.appendChild(el);
    anchor.classList.add('tut-anchor');
    this.cur = { el, anchor, place };
    this.position();
    setTimeout(() => this.position(), 280);   // a new guess row slides in: aim again once it lands
    return el;
  },

  position() {
    const c = this.cur;
    if (!c) return;
    if (!c.anchor.isConnected || !c.anchor.offsetParent) return this.hide();
    const r  = c.anchor.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const w  = Math.min(330, vw - 32);
    const cx = r.left + r.width / 2;
    const left = Math.max(16, Math.min(vw - 16 - w, cx - w / 2));
    c.el.style.width = `${w}px`;
    c.el.style.left  = `${left}px`;
    c.el.style.setProperty('--caret-x', `${Math.max(18, Math.min(w - 18, cx - left))}px`);
    c.el.style.top = c.place === 'bottom' ? `${r.bottom + 10}px` : `${r.top - 10 - c.el.offsetHeight}px`;
  },

  hide() {
    if (!this.cur) return;
    this.cur.anchor.classList.remove('tut-anchor');
    this.cur.el.remove();
    this.cur = null;
  },

  // ---------------------------------------------------------------- the 🔭 spyglass button (spyglass.js), once
  spyglass() {
    const btn = document.getElementById('spy-btn');
    if (this.seen('spy') || !btn || btn.hidden || !btn.offsetParent) return;
    this.mark('spy');
    const fresh = Spyglass.starter() && Spyglass.have() > 0;
    this.show(btn, fresh
      ? t('<b>🔭 {n} free spyglasses!</b> Tap to see every country’s name. Earn more with a {every}-day streak.', { n: Spyglass.have(), every: Spyglass.EVERY })
      : t('<b>🔭 New: spyglasses.</b> Tap to see every country’s name. Earn one per {every}-day streak.', { every: Spyglass.EVERY }),
      { place: 'top', id: 'spyglass' });
    track('tip_shown', { tip: 'spyglass', fresh });
  },

  // ---------------------------------------------------------------- the first guess: distance, then direction
  afterGuess({ country, temp, distEl, arrowEl }) {
    if (this.veteran()) return;
    const name = coachEsc(cname(country.name));
    const showDir = () => {
      if (this.seen('dir') || !arrowEl.textContent) return this.hide();
      this.mark('dir');
      const bearing = Object.keys(ARROWS).find(k => ARROWS[k] === arrowEl.textContent);
      const deg = BEARING_DEG[bearing];
      this.show(arrowEl, `
        <div class="tut-tip-row">
          <svg class="dir-tip-map" viewBox="0 0 64 64" aria-hidden="true">
            <circle cx="32" cy="32" r="27" class="dt-ring"/>
            <text x="32" y="9.5" class="dt-n">N</text>
            <g transform="rotate(${deg} 32 32)"><path d="M32 23 L32 12" class="dt-line"/><path d="M27.5 14.5 L32 9 L36.5 14.5" class="dt-head"/></g>
            <g transform="rotate(${deg} 32 32) translate(32 5.5) rotate(${-deg})"><path d="M-3.5 -3.5 L3.5 3.5 M3.5 -3.5 L-3.5 3.5" class="dt-x"/></g>
            <circle cx="32" cy="32" r="8.5" class="dt-you" style="--c:${arrowEl.closest('li').style.getPropertyValue('--c')}"/>
            <text x="32" y="36" class="dt-flag">${country.flag || ''}</text>
          </svg>
          <span><b>${t('{arrow} The mystery country is {dir} of {name}.', { arrow: ARROWS[bearing], dir: bearingWord(bearing).replace('-', '‑'), name })}</b>
          ${t('Arrows point toward it. North is up.')}</span>
        </div>`, { step: distShown ? '2 / 2' : null, id: 'direction' });
      track('tip_shown', { tip: 'direction', bearing });
    };
    let distShown = false;
    if (!this.seen('dist')) {
      this.mark('dist');
      distShown = true;
      const html = temp === 'adjacent'
        ? t('<b>🟣 Borders it!</b> The mystery country is next door.')
        : t('<b>📏 {km}</b> from the mystery country. Smaller is closer.', { km: distEl.textContent });
      const hasDir = !this.seen('dir') && !!arrowEl.textContent;
      this.show(distEl, html, hasDir ? { step: '1 / 2', button: t('Next'), onButton: showDir, id: 'distance' } : { id: 'distance' });
      track('tip_shown', { tip: 'distance' });
    } else {
      showDir();
    }
  },
};

window.addEventListener('resize', () => Tips.position());
if (window.visualViewport) visualViewport.addEventListener('resize', () => Tips.position());
document.getElementById('history-wrap').addEventListener('scroll', () => Tips.position(), { passive: true });
