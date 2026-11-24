// name-step.js — the player's leaderboard name, asked once before their first game.
//
//   NameStep.ask(onDone, { kind, title, text, save })  → a full-screen card: name (required), 🎲, save
//   NameStep.randomName()                              → a pre-filled name
//
// The name is saved with setUsername() (cloud.js) as soon as the cloud is ready; until then
// it waits in localStorage and goes up on the next cloud change.
// Analytics keep the older captain_* event names so activation stays comparable.

const NameStep = (() => {
  const PENDING_KEY = 'pancake_pending_name';
  const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

  const COPY = {
    first: {
      title: 'Pick a name',
      text: 'A new mystery country every day, the same one for everyone. Find it in the fewest guesses.',
      save: 'Let’s play',
    },
    welcome: {
      title: 'Nice one! Pick a name',
      text: 'Put today’s score on the leaderboard. A new country comes tomorrow.',
      save: 'Put me on the board',
    },
    label: 'Your name',
    hint: 'Shown on the leaderboard.',
    roll: 'Roll a random name',
    invalid: '3–20 letters, numbers or _.',
    taken: 'Taken. Try another, or roll 🎲.',
  };

  // Pre-filled names: adjective + noun + 2 digits, max 20 characters
  const PARTS = {
    a: ['Salty', 'Soggy', 'Barnacle', 'Stormy', 'Plucky', 'Crusty', 'Scurvy', 'Jolly', 'Sneaky', 'Grumpy',
        'Dizzy', 'Briny', 'Rusty', 'Mighty', 'Cheeky', 'Sandy', 'Swashy', 'Peggy', 'Gusty', 'Foggy'],
    b: ['Navigator', 'Kraken', 'Compass', 'Anchor', 'Seagull', 'Corsair', 'Squid', 'Mapmaker', 'Seadog',
        'Matey', 'Cannon', 'Lobster', 'Parrot', 'Plank', 'Buccaneer', 'Pelican', 'Tide', 'Cutlass', 'Walrus'],
  };

  function randomName() {
    const pick = list => list[Math.floor(Math.random() * list.length)];
    return `${pick(PARTS.a)}${pick(PARTS.b)}${10 + Math.floor(Math.random() * 90)}`;
  }

  function ask(onDone, { kind = 'first' } = {}) {
    const copy = COPY[kind] || COPY.first;
    track('captain_intro_start', { kind });
    const startedAt = performance.now();
    let rolls = 0, rolledName = '';
    const root = document.createElement('div');
    root.className = 'name-step';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-labelledby', 'name-step-title');
    root.innerHTML = `
      <form class="name-step-card" autocomplete="off">
        <h2 id="name-step-title">${esc(t(copy.title))}</h2>
        <p class="name-step-text">${esc(t(copy.text))}</p>
        <label class="name-step-label" for="name-step-input">${esc(t(COPY.label))}</label>
        <div class="name-step-row">
          <input id="name-step-input" maxlength="20" autocapitalize="off" spellcheck="false" enterkeyhint="go" />
          <button type="button" class="name-step-dice" aria-label="${esc(t(COPY.roll))}" title="${esc(t(COPY.roll))}">🎲</button>
        </div>
        <p class="name-step-hint">${esc(t(COPY.hint))}</p>
        <p class="name-step-error" hidden></p>
        <button type="submit" class="btn primary name-step-save">${esc(t(copy.save))}</button>
      </form>`;
    document.body.appendChild(root);
    requestAnimationFrame(() => root.classList.add('in'));

    const q = s => root.querySelector(s);
    const form = q('form'), input = q('#name-step-input'), err = q('.name-step-error'), save = q('.name-step-save');
    input.value = rolledName = randomName();
    if (window.matchMedia('(pointer: fine)').matches) input.focus();

    q('.name-step-dice').addEventListener('click', () => {
      input.value = rolledName = randomName();
      rolls++;
      err.hidden = true;
    });
    input.addEventListener('input', () => { err.hidden = true; });
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const v = input.value.trim();
      if (!USERNAME_RE.test(v)) return nameError(t(COPY.invalid));
      save.disabled = true;
      const problem = await claimName(v);
      save.disabled = false;
      if (problem) return nameError(problem === 'That name is taken' ? t(COPY.taken) : problem);
      track('captain_name_set', { kept_rolled: v === rolledName, rolls, seconds: Math.round((performance.now() - startedAt) / 1000) });
      close();
    });
    function nameError(msg) {
      err.textContent = msg;
      err.hidden = false;
      if (typeof shake === 'function') shake(input);
    }
    function close() {
      track('captain_intro_done', { kind });
      root.classList.remove('in');
      setTimeout(() => { root.remove(); onDone && onDone(); }, reduceMotion() ? 0 : 250);
    }
  }

  // Save now if we can; otherwise keep it until the cloud is ready. Returns an error message or null.
  async function claimName(v) {
    if (cloudStatus === 'ready' && cloudUser) {
      if (cloudUsername) return null;                    // already has one (e.g. signed in elsewhere)
      const problem = await setUsername(v);
      if (problem === 'That name is taken') return problem;
      if (!problem) { if (typeof renderAccount === 'function') renderAccount(); return null; }
    }
    try { localStorage.setItem(PENDING_KEY, v); } catch {}
    return null;
  }
  let _claiming = false;
  async function applyPendingName() {
    let v = null;
    try { v = localStorage.getItem(PENDING_KEY); } catch {}
    if (!v || _claiming || cloudStatus !== 'ready' || !cloudUser) return;
    const clear = () => { try { localStorage.removeItem(PENDING_KEY); } catch {} };
    if (cloudUsername) return clear();
    _claiming = true;
    // Taken while we were offline: add digits, a few tries
    for (const name of [v, ...[1, 2, 3].map(() => v.replace(/\d*$/, '').slice(0, 17) + (100 + Math.floor(Math.random() * 900)))]) {
      const problem = await setUsername(name);
      if (!problem) { clear(); track('captain_name_set_later'); break; }
      if (problem !== 'That name is taken') break;       // offline again: retry next time
    }
    _claiming = false;
  }
  onCloudChange(applyPendingName);

  return { ask, randomName, applyPendingName };
})();
