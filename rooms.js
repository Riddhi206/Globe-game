// rooms.js — "Play with friends": the hub, rooms with a Daily league, live
// game nights and 5-country room challenges. Server side: supabase/009_rooms.sql
// and 011_rooms_hub.sql (every rule is enforced there; this file only shows
// things and calls the functions).
//
// Shares the global scope with cloud.js / game.js (sb, cloudStatus,
// cloudUser, cloudUsername, cloudFriends, hasFeature, isGuest, openUsername,
// openFriends, showToast, escHtml, track, showScreen, startNightRound,
// startChallengeRound, gameMode, guesses, …): only used inside functions,
// which run after everything has loaded.

const ROOM_ERRORS = {
  'pick a name first':   'Pick a leaderboard name first.',
  'room is full':        'That room is full (50 members).',
  'room limit':          'You’re in 10 rooms already. Leave one to join another.',
  'room not found':      'No room with that code.',
  'not allowed':         'Only the room’s host can do that.',
  'owner cannot leave':  'You run this room. Close it instead.',
  'night is over':       'That game night has ended.',
  'round is closed':     'Too late, that round is over.',
  'room name must':      'Room names are 2–40 characters.',
  'too many rooms':      'You run 3 rooms already. Close one to start another.',
  'not a member':        'Join the room first.',
  'too many challenges': 'This room has 3 open challenges. Finish those first!',
  'slow down':           'That’s a lot of challenges today. Try again tomorrow.',
  'challenge is over':   'That challenge has ended.',
  'already played':      'You’ve played every country in this one.',
  'challenge not found': 'That challenge doesn’t exist any more.',
  'no countries left':   'Couldn’t pick countries for that. Try another region.',
  'night already on':    'A game night is already on in this room. Join that one!',
  'need two players':    'Wait for at least one more player to join.',
};

function roomErrorText(e) {
  const msg = String((e && e.message) || e || '');
  for (const [k, v] of Object.entries(ROOM_ERRORS)) if (msg.includes(k)) return v;
  if (msg === 'offline') return 'Rooms need an internet connection.';
  if (/PGRST20[0-9]|schema cache|does not exist/.test(msg + ((e && e.code) || ''))) return 'Rooms aren’t switched on yet.';
  return 'Something went wrong. Try again.';
}

async function roomRpc(fn, args = {}) {
  if (typeof sb === 'undefined' || !sb || cloudStatus !== 'ready') throw new Error('offline');
  const { data, error } = await sb.rpc(fn, args);
  if (error) throw error;
  return data;
}

function roomInviteUrl(code, challengeId = null) {
  const url = `${location.origin}${location.pathname}?room=${encodeURIComponent(code)}` + (challengeId ? `&ch=${encodeURIComponent(challengeId)}` : '');
  return tagLink(url, challengeId ? 'challenge' : 'room');
}

const rq = id => document.getElementById(id);

// Challenge regions: label and icon
const THEMES = {
  world:    { icon: '🌍', label: 'World' },
  europe:   { icon: '🏰', label: 'Europe' },
  asia:     { icon: '🏯', label: 'Asia' },
  africa:   { icon: '🦁', label: 'Africa' },
  americas: { icon: '🗽', label: 'Americas' },
  oceania:  { icon: '🏝️', label: 'Oceania' },
};
const ROOM_EMOJIS = ['🌍', '🔥', '🏆', '🎲', '🚀', '🦁', '🍕', '🎉', '⚡', '🧭', '👑', '🐙'];
const ROOM_IDEAS = [['🏡', 'Family'], ['💼', 'Office'], ['🎲', 'Board game club'], ['✈️', 'Travel buddies'], ['🎓', 'Classmates'], ['💪', 'Gym crew']];

// "2h", "3d": how long ago; "18h left": how long until
function ago(ts) {
  const m = Math.max(0, Math.round((Date.now() - new Date(ts).getTime()) / 60000));
  return m < 1 ? 'now' : m < 60 ? `${m}m` : m < 1440 ? `${Math.floor(m / 60)}h` : `${Math.floor(m / 1440)}d`;
}
function left(ts) {
  const m = Math.max(0, Math.round((new Date(ts).getTime() - Date.now()) / 60000));
  return m < 60 ? `${m}m left` : `${Math.floor(m / 60)}h left`;
}
// A room's colour, from its name: the same room always gets the same gradient
function roomHue(name) {
  let h = 0;
  for (const ch of String(name)) h = (h * 31 + ch.codePointAt(0)) % 360;
  return h;
}
function roomTile(r, size = '') {
  const h = roomHue(r.name);
  return `<span class="room-tile ${size}" style="--h1:${h};--h2:${(h + 50) % 360}" aria-hidden="true">${escHtml(r.emoji || '🌍')}</span>`;
}
const flagOf = name => (COUNTRIES.find(c => c.name === name) || {}).flag || '';

const Rooms = {
  list: [],          // my_rooms()
  room: null,        // room_view() of the open room
  challenges: [],    // room_challenges() of the open room
  feed: [],          // room_feed() of the open room
  period: 'today',
  _listAt: 0,

  // ---------------------------------------------------------------- list
  async refresh(force = false) {
    if (!force && Date.now() - this._listAt < 20000) return;
    this._listAt = Date.now();
    try { this.list = (await roomRpc('my_rooms')) || []; }
    catch { /* offline / not set up: keep what we had */ }
    this.renderHomeCard();
    if (!rq('hub-screen').hidden) this.renderHub();
  },

  // The home tile always leads to the hub; its line says what's happening
  renderHomeCard() {
    const card = rq('rooms-card');
    if (!card) return;
    card.hidden = !this.list.length && typeof settledPlayer === 'function' && !settledPlayer();   // new players: in a room already, or not yet
    if (typeof renderBanner === 'function' && !rq('home-screen').hidden) renderBanner();   // the rooms tip depends on the list
    const live = this.list.find(r => r.live_night);
    const move = this.list.filter(r => r.challenge && r.challenge.my_done < 5);
    rq('rooms-live').hidden = !live;
    rq('rooms-move').hidden = !move.length || !!live;
    rq('rooms-move').textContent = `⚡ ${move.length}`;
    const desc = rq('rooms-desc');
    if (live) desc.textContent = `Game night in ${live.name}. Tap to join`;
    else if (move.length) desc.textContent = `${move[0].challenge.by || 'Someone'} challenged ${move[0].name}. Your move`;
    else if (this.list.length) {
      const ranked = this.list.find(r => r.my_rank_today);
      desc.textContent = `${this.list.length} room${this.list.length === 1 ? '' : 's'}` +
        (ranked ? ` · you’re #${ranked.my_rank_today} in ${ranked.name} today` : ` · ${this.list[0].played_today}/${this.list[0].members} played today in ${this.list[0].name}`);
    } else desc.textContent = t('Make a room, send the code, race your crew');
  },

  open() { this.openHub(); },

  // ---------------------------------------------------------------- the hub
  openHub() {
    this.closeSheets();
    showScreen('hub');
    this.renderHub();
    this.refresh(true);
    if (cloudStatus === 'ready' && typeof loadFriends === 'function') loadFriends().then(() => this.renderHub()).catch(() => {});
    track('rooms_open', { rooms: this.list.length });
  },

  renderHub() {
    const offline = cloudStatus !== 'ready';
    rq('hub-offline').hidden = !offline;
    rq('hub-offline').textContent = cloudStatus === 'connecting' ? 'Connecting…' : 'Rooms need an internet connection.';

    // Happening now: live game nights, and challenges waiting on me
    const now = rq('hub-now');
    now.innerHTML = '';
    for (const r of this.list) {
      if (r.live_night) now.append(this._nowCard('live', `${roomTile(r, 'sm')}<div class="now-text"><span class="now-kicker">🔴 Live now</span><b>Game night in ${escHtml(r.name)}</b></div>`, 'Join', () => this.enterNight(r.live_night)));
      const c = r.challenge;
      if (c && c.my_done < 5) {
        const t = THEMES[c.theme] || THEMES.world;
        now.append(this._nowCard('move', `${roomTile(r, 'sm')}<div class="now-text"><span class="now-kicker">⚡ Your move · ${escHtml(left(c.ends_at))}</span>
          <b>${escHtml(c.by || 'Someone')}’s ${t.icon} ${t.label}${c.speed ? ' speed' : ''} challenge</b><span class="muted">${escHtml(r.name)} · ${c.players} playing${c.my_done ? ` · you’re ${c.my_done}/5 in` : ''}</span></div>`,
          c.my_done ? 'Continue' : 'Play', () => Challenge.open(c.id)));
      }
    }

    // Your rooms, or ideas to start one
    const box = rq('hub-rooms');
    box.innerHTML = '';
    if (!this.list.length) {
      const empty = document.createElement('div');
      empty.className = 'hub-empty';
      empty.innerHTML = `<p>No rooms yet. Start one for your people:</p><div class="rc-ideas">${ROOM_IDEAS.map(([e, n]) =>
        `<button type="button" class="hub-chip" data-name="${escHtml(n)}" data-emoji="${e}">${e} ${escHtml(n)}</button>`).join('')}</div>`;
      empty.querySelectorAll('[data-name]').forEach(b => b.addEventListener('click', () => this.openCreate(b.dataset.name, b.dataset.emoji)));
      box.append(empty);
    }
    for (const r of this.list) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'hub-room';
      const tags = [];
      if (r.live_night) tags.push('<span class="mode-badge-live">LIVE</span>');
      if (r.challenge && r.challenge.my_done < 5) tags.push('<span class="tag hot">⚡ challenge</span>');
      if (r.my_rank_today) tags.push(`<span class="tag">#${r.my_rank_today} today</span>`);
      b.innerHTML = `${roomTile(r)}<span class="hub-room-text"><b>${escHtml(r.name)}</b>
        <span class="muted">${r.members} member${r.members === 1 ? '' : 's'} · ${r.played_today}/${r.members} played today</span>
        ${tags.length ? `<span class="hub-room-tags">${tags.join('')}</span>` : ''}</span>
        <svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>`;
      b.addEventListener('click', () => this.openRoom(r.id));
      box.append(b);
    }

    // Friends
    const friends = (typeof cloudFriends !== 'undefined' ? cloudFriends : []) || [];
    const mine = friends.filter(f => f.status === 'friend');
    const incoming = friends.filter(f => f.status === 'incoming');
    rq('hub-friends-count').textContent = mine.length ? `· ${mine.length}` : '';
    const fb = rq('hub-friends');
    fb.innerHTML = (incoming.length ? `<button type="button" class="hub-requests" id="hub-requests">🔔 ${incoming.length} friend request${incoming.length === 1 ? '' : 's'} · Review</button>` : '') +
      (mine.length ? `<div class="hub-friend-chips">${mine.slice(0, 12).map(f => `<span class="hub-chip">${escHtml(f.username)}</span>`).join('')}</div>`
                   : `<p class="muted hub-friends-empty">Add friends by their leaderboard name to see them on your Daily board.</p>`);
    const req = rq('hub-requests');
    if (req) req.addEventListener('click', () => openFriends());
  },

  _nowCard(kind, html, label, onClick) {
    const d = document.createElement('div');
    d.className = `now-card ${kind}`;
    d.innerHTML = html;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn small primary';
    b.textContent = label;
    b.addEventListener('click', onClick);
    d.append(b);
    return d;
  },

  // ---------------------------------------------------------------- join / create
  openJoin() {
    rq('rooms-error').hidden = true;
    rq('room-code-input').value = '';
    if (!rq('rooms-dialog').open) rq('rooms-dialog').showModal();
    rq('room-code-input').focus();
  },

  async joinWithCode(code) {
    code = String(code || '').trim().toUpperCase();
    if (!/^[A-Z2-9]{6}$/.test(code)) { this._listError('Room codes are 6 letters and numbers.'); return; }
    try {
      const preview = await roomRpc('room_preview', { p_code: code });
      if (!preview) { this._listError(ROOM_ERRORS['room not found']); return; }
      rq('rooms-dialog').close();
      if (preview.member) { this.openRoom(preview.id); return; }
      this.showJoin(code, preview, 'code');
    } catch (e) { this._listError(roomErrorText(e)); }
  },

  _listError(text) { const el = rq('rooms-error'); el.textContent = text; el.hidden = false; },

  _createEmoji: '🌍',
  openCreate(name = '', emoji = null) {
    this._createEmoji = emoji || ROOM_EMOJIS[Math.floor(Math.random() * ROOM_EMOJIS.length)];
    rq('rc-error').hidden = true;
    rq('room-name-input').value = name;
    const pick = e => {
      this._createEmoji = e;
      rq('rc-emoji-big').textContent = e;
      rq('rc-emojis').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.e === e));
      const big = rq('rc-emoji-big'); big.classList.remove('pop'); void big.offsetWidth; big.classList.add('pop');
    };
    rq('rc-emojis').innerHTML = ROOM_EMOJIS.map(e => `<button type="button" class="rc-emoji" data-e="${e}">${e}</button>`).join('');
    rq('rc-emojis').querySelectorAll('button').forEach(b => b.addEventListener('click', () => pick(b.dataset.e)));
    rq('rc-ideas').innerHTML = ROOM_IDEAS.map(([e, n]) => `<button type="button" class="hub-chip" data-name="${escHtml(n)}" data-e="${e}">${e} ${escHtml(n)}</button>`).join('');
    rq('rc-ideas').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { rq('room-name-input').value = b.dataset.name; pick(b.dataset.e); }));
    pick(this._createEmoji);
    if (!rq('room-create-dialog').open) rq('room-create-dialog').showModal();
    if (!name) rq('room-name-input').focus();
  },

  async create(name) {
    name = String(name || '').trim();
    const fail = t => { rq('rc-error').textContent = t; rq('rc-error').hidden = false; };
    if (name.length < 2) { fail(ROOM_ERRORS['room name must']); return; }
    const emoji = this._createEmoji;
    const go = async () => {
      try {
        const r = await roomRpc('create_room', { p_name: name, p_emoji: emoji });
        track('room_create', { emoji });
        if (typeof Notify !== 'undefined') Notify.afterRoom();
        rq('room-create-dialog').close();
        await this.refresh(true);
        await this.openRoom(r.id);
        celebrate();
        showToast(`${emoji} ${name} is ready. Invite your crew!`);
      } catch (e) {
        if (!rq('room-create-dialog').open) rq('room-create-dialog').showModal();
        fail(roomErrorText(e));
      }
    };
    if (!cloudUsername) { rq('room-create-dialog').close(); openUsername(go, { forced: true, reason: 'room', skipLabel: 'Not now' }); return; }
    go();
  },

  // ---------------------------------------------------------------- invite links
  // ?room=CODE (and &ch=ID for a challenge): remember them, act once online
  captureInvite() {
    const params = new URLSearchParams(location.search);
    const code = params.get('room');
    if (!code) return;
    try {
      sessionStorage.setItem('pancake_room_invite', code);
      if (params.get('ch')) sessionStorage.setItem('pancake_challenge_invite', params.get('ch'));
    } catch {}
    params.delete('room'); params.delete('ch');
    const qs = params.toString();
    history.replaceState(null, '', location.pathname + (qs ? `?${qs}` : '') + location.hash);
  },

  _takeChallengeInvite() {
    let ch = null;
    try { ch = sessionStorage.getItem('pancake_challenge_invite'); sessionStorage.removeItem('pancake_challenge_invite'); } catch {}
    return ch;
  },

  async handlePendingInvite() {
    let code = null;
    try { code = sessionStorage.getItem('pancake_room_invite'); } catch {}
    if (!code || cloudStatus !== 'ready') return;
    try { sessionStorage.removeItem('pancake_room_invite'); } catch {}
    try {
      const preview = await roomRpc('room_preview', { p_code: code });
      if (!preview) { showToast('That room link has expired.'); return; }
      if (preview.member) {
        const ch = this._takeChallengeInvite();
        if (ch) { showScreen('hub'); this.renderHub(); Challenge.open(ch); } else this.openRoom(preview.id);
        return;
      }
      this.showJoin(code, preview, 'link');
    } catch (e) { showToast(roomErrorText(e)); }
  },

  showJoin(code, preview, via) {
    rq('room-join-name').textContent = `${preview.emoji || ''} ${preview.name}`.trim();
    let ch = null; try { ch = sessionStorage.getItem('pancake_challenge_invite'); } catch {}
    rq('room-join-meta').textContent = `${preview.members} member${preview.members === 1 ? '' : 's'}` + (preview.full ? ' · full' : '') +
      (ch ? ' · a challenge is waiting for you ⚡' : '');
    rq('room-join-guest').hidden = !isGuest();
    rq('room-join-error').hidden = true;
    rq('room-join-ok').disabled = !!preview.full;
    this._joinCode = code;
    this._joinVia = via;
    if (!rq('room-join-dialog').open) rq('room-join-dialog').showModal();
  },

  async confirmJoin() {
    const code = this._joinCode;
    const go = async () => {
      try {
        const r = await roomRpc('join_room', { p_code: code });
        track('room_join', { via: this._joinVia || 'code' });
        if (typeof Notify !== 'undefined') Notify.afterRoom();
        rq('room-join-dialog').close();
        await this.refresh(true);
        celebrate();
        const ch = this._takeChallengeInvite();
        if (ch) { showScreen('hub'); this.renderHub(); Challenge.open(ch); }
        else this.openRoom(r.id);
        showToast(`You joined ${r.name}`);
      } catch (e) {
        if (!rq('room-join-dialog').open) rq('room-join-dialog').showModal();
        rq('room-join-error').textContent = roomErrorText(e);
        rq('room-join-error').hidden = false;
      }
    };
    // A room leaderboard needs names, not a Google account
    if (!cloudUsername) {
      rq('room-join-dialog').close();
      openUsername(go, { forced: true, reason: 'room', skipLabel: 'Not now' });
      return;
    }
    go();
  },

  // ---------------------------------------------------------------- one room
  async openRoom(id, period = this.room && this.room.room.id === id ? this.period : 'today') {
    this.period = period;
    rq('room-error').hidden = true;
    if (rq('hub-screen').hidden) showScreen('hub');   // rooms always open over the hub
    try {
      const [data, challenges, feed] = await Promise.all([
        roomRpc('room_view', { p_room: id, p_period: period === 'nights' ? 'today' : period }),
        roomRpc('room_challenges', { p_room: id }).catch(() => []),
        roomRpc('room_feed', { p_room: id }).catch(() => []),
      ]);
      this.room = data;
      this.challenges = challenges || [];
      this.feed = feed || [];
      this.renderRoom();
      if (!rq('room-dialog').open) rq('room-dialog').showModal();
    } catch (e) { showToast(roomErrorText(e)); this.refresh(true); }
  },

  renderRoom() {
    const d = this.room, r = d.room;
    const meta = this.list.find(x => x.id === r.id) || {};
    rq('room-emoji').innerHTML = roomTile({ name: r.name, emoji: meta.emoji }, 'md');
    rq('room-name').textContent = r.name;
    rq('room-meta').textContent = `${d.members.length} member${d.members.length === 1 ? '' : 's'} · plays the Daily together`;
    rq('room-code').textContent = r.code;
    rq('room-live').hidden = !d.live_night;
    rq('room-manage').hidden = !r.can_manage;
    rq('room-night-btn').hidden = false;          // any member can start one (014_rooms_fixes.sql)
    rq('room-leave-btn').hidden = !!r.is_owner;
    rq('room-leave-btn').textContent = 'Leave room';
    rq('room-close-room-btn').textContent = 'Close room';
    document.querySelectorAll('#room-dialog [data-period]').forEach(b => b.setAttribute('aria-pressed', b.dataset.period === this.period));

    // Challenges: open ones to play, then the last few results
    const cbox = rq('room-challenges');
    cbox.innerHTML = '';
    const open = this.challenges.filter(c => c.open);
    const past = this.challenges.filter(c => !c.open).slice(0, 2);
    for (const c of [...open, ...past]) {
      const t = THEMES[c.theme] || THEMES.world;
      const row = document.createElement('div');
      row.className = `room-ch${c.open ? ' open' : ''}`;
      const status = c.open
        ? (c.my_done === 5 ? `You scored ${c.my_points.toLocaleString()} · ${left(c.ends_at)}` : c.my_done ? `You’re ${c.my_done}/5 in · ${left(c.ends_at)}` : `${c.players} playing · ${left(c.ends_at)}`)
        : (c.leader ? `🏆 ${c.leader} won · ${Number(c.leader_points || 0).toLocaleString()} pts` : 'Nobody played');
      row.innerHTML = `<span class="room-ch-icon" aria-hidden="true">${t.icon}</span>
        <span class="room-ch-text"><b>${t.label}${c.speed ? ' ⚡ speed' : ''} challenge</b><span class="muted">by ${escHtml(c.by || '?')} · ${escHtml(status)}</span></span>`;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `btn small${c.open && c.my_done < 5 ? ' primary' : ''}`;
      b.textContent = c.open ? (c.my_done === 5 ? 'Results' : c.my_done ? 'Continue' : 'Play') : 'Results';
      b.addEventListener('click', () => { rq('room-dialog').close(); Challenge.open(c.id); });
      row.append(b);
      cbox.append(row);
    }

    // Activity
    const feed = rq('room-feed');
    feed.innerHTML = '';
    const today = utcDay();
    for (const ev of this.feed) {                 // the last 3 days; the list scrolls on its own
      const who = `<b>${escHtml(ev.who || 'Someone')}</b>`;
      const t = THEMES[(ev.data || {}).theme] || THEMES.world;
      const dayWord = utcDay(new Date(ev.at)) === today ? 'today’s' : 'yesterday’s';
      const text = ev.type === 'daily'
          ? (ev.data.won ? `🟢 ${who} found ${dayWord} Daily in ${ev.data.guesses}` : `🔴 ${who} missed ${dayWord} Daily`)
        : ev.type === 'joined' ? `👋 ${who} joined the room`
        : ev.type === 'challenge' ? `⚡ ${who} started a ${t.icon} ${t.label}${ev.data.speed ? ' speed' : ''} challenge`
        : ev.type === 'challenge_done' ? `🏁 ${who} finished the ${t.label} challenge · ${Number(ev.data.points).toLocaleString()} pts`
        : ev.type === 'night' ? `🎉 ${who} won game night · ${Number(ev.data.points).toLocaleString()} pts`
        : '';
      if (!text) continue;
      const li = document.createElement('li');
      li.innerHTML = `<span class="feed-text">${text}</span><span class="feed-ago">${ago(ev.at)}</span>`;
      feed.append(li);
    }
    if (!feed.children.length) feed.innerHTML = '<li class="muted feed-empty">Quiet so far. Start a challenge and get things going!</li>';

    const board = rq('room-board');
    const empty = rq('room-board-empty');
    board.innerHTML = '';
    let rows = [];
    if (this.period === 'nights') {
      rows = d.night_standings.map((s, i) => ({ rank: i + 1, name: s.username, me: s.is_me,
        result: `${s.wins} win${s.wins === 1 ? '' : 's'}`, score: `${s.points.toLocaleString()} pts` }));
      empty.textContent = 'No game nights yet. The host can start one.';
    } else {
      rows = d.league.map(l => ({ rank: l.rank, name: l.username, me: l.is_me,
        result: this.period === 'today' ? (l.won_today ? `${l.guess_count}/10` : 'X/10') : `${l.played} day${l.played === 1 ? '' : 's'}`,
        score: `${Number(l.score).toLocaleString()}` }));
      empty.textContent = this.period === 'today' ? 'Nobody has played today’s Daily yet.' : 'No Daily results in this range yet.';
    }
    for (const row of rows) {
      const li = document.createElement('li');
      li.className = `lb-row${row.me ? ' me' : ''}`;
      li.innerHTML = `<span class="lb-rank">${row.rank}</span><span class="lb-name">${escHtml(row.name)}${row.me ? ' (you)' : ''}</span>
        <span class="lb-result">${escHtml(row.result)}</span><span class="lb-score">${escHtml(row.score)}</span>`;
      board.appendChild(li);
    }
    empty.hidden = rows.length > 0;
    const playedToday = d.members.find(m => m.is_me)?.played_today;
    rq('room-play-btn').hidden = this.period !== 'today' || !!playedToday;

    const mem = rq('room-members');
    mem.innerHTML = '';
    for (const m of d.members) {
      const li = document.createElement('li');
      li.className = 'room-member';
      li.innerHTML = `<span class="room-member-name">${escHtml(m.username || 'Player')}${m.is_me ? ' (you)' : ''}${m.is_owner ? ' <span class="room-host">host</span>' : ''}</span>
        <span class="muted">${m.streak ? `🔥 ${m.streak}` : ''} ${m.played_today ? '✓ today' : ''}</span>`;
      if (r.can_manage && !m.is_owner && !m.is_me) {
        const x = document.createElement('button');
        x.type = 'button';
        x.className = 'btn small ghost room-remove';
        x.textContent = 'Remove';
        x.addEventListener('click', () => this._confirmTwice(x, 'Tap again', () => this.manage('remove_room_member', { p_room: r.id, p_username: m.username })));
        li.appendChild(x);
      }
      mem.appendChild(li);
    }
  },

  // Destructive buttons ask for a second tap instead of a dialog
  _confirmTwice(btn, again, action) {
    if (btn.dataset.armed) { delete btn.dataset.armed; action(); return; }
    btn.dataset.armed = '1';
    const label = btn.textContent;
    btn.textContent = again;
    setTimeout(() => { if (btn.dataset.armed) { delete btn.dataset.armed; btn.textContent = label; } }, 3000);
  },

  async manage(fn, args, after) {
    try {
      const out = await roomRpc(fn, args);
      if (after) await after(out);
      else await this.openRoom(this.room.room.id);
      this.refresh(true);
    } catch (e) { rq('room-error').textContent = roomErrorText(e); rq('room-error').hidden = false; }
  },

  shareInvite() {
    const r = this.room.room;
    const url = roomInviteUrl(r.code);
    const text = `Join my room “${r.name}” on Borderline 🌍 We race the Daily, run 5-country challenges and game nights. Code ${r.code}`;
    track('room_invite_share', {});
    if (navigator.share) { navigator.share({ text, url }).catch(() => {}); return; }
    navigator.clipboard.writeText(`${text}\n${url}`).then(() => showToast('Invite link copied')).catch(() => showToast(url));
  },

  // ---------------------------------------------------------------- game night
  night: null,   // { id, state, offset, timer, poll, playingRound, tv }

  async startNight() {
    const r = this.room.room;
    const rounds  = Number(rq('night-rounds').value);
    const seconds = Number(rq('night-seconds').value);
    try {
      const id = await roomRpc('start_night', { p_room: r.id, p_rounds: rounds, p_seconds: seconds });
      track('night_start', { rounds, seconds });
      rq('room-dialog').close();
      this.enterNight(id);
    } catch (e) { rq('room-error').textContent = roomErrorText(e); rq('room-error').hidden = false; }
  },

  closeSheets() {
    for (const id of ['rooms-dialog', 'room-dialog', 'room-join-dialog', 'room-create-dialog', 'challenge-new-dialog']) if (rq(id).open) rq(id).close();
  },

  async enterNight(id, { tv = false } = {}) {
    this.leaveNightView();
    this.closeSheets();
    this.night = { id, state: null, offset: 0, poll: null, tick: null, playingRound: 0, tv };
    rq('night').classList.toggle('tv', tv);
    if (!tv) {
      try { await roomRpc('join_night', { p_night: id }); track('night_join', {}); }
      catch (e) { showToast(roomErrorText(e)); this.night = null; return; }
    }
    rq('night').hidden = false;
    await this.pollNight();
    this.night.poll = setInterval(() => this.pollNight(), 2000);
  },

  async pollNight() {
    const n = this.night;
    if (!n) return;
    let s;
    try { s = await roomRpc('night_state', { p_night: n.id }); }
    catch { return; } // a dropped poll is fine; the next one catches up
    if (!this.night || this.night.id !== n.id) return;
    n.state = s;
    n.offset = s.server_now - Date.now();
    // A round is on and I haven't played it: go to the globe
    const mine = s.players.find(p => p.is_me);
    if (!n.tv && s.phase === 'playing' && s.mystery && !(mine && mine.this_round) && n.playingRound !== s.round) {
      this.playRound(s);
      return;
    }
    if (n.playingRound === s.round && s.phase === 'playing' && !(mine && mine.this_round)) return; // still playing it
    this.renderNight();
  },

  serverNow() { return Date.now() + (this.night ? this.night.offset : 0); },

  roundEndsAt(s) { return s.round_started_at + s.round_seconds * 1000; },

  playRound(s) {
    const n = this.night;
    n.playingRound = s.round;
    const country = COUNTRIES.find(c => c.name === s.mystery);
    if (!country) return;
    rq('night').hidden = true;
    this.closeSheets();   // a sheet left open would sit on top of the globe
    let saved = null;
    try { const x = JSON.parse(sessionStorage.getItem('pancake_night_round') || 'null'); if (x && x.night === n.id && x.round === s.round) saved = x.guesses; } catch {}
    startNightRound(country, saved);
    track('night_round_start', { round: s.round });
    clearInterval(n.tick);
    n.tick = setInterval(() => this.tickRound(), 250);
    this.tickRound();
  },

  chipLabel() {
    const s = this.night && this.night.state;
    return s ? `Round ${s.round}/${s.rounds}` : 'Game night';
  },

  renderHud() {
    const s = this.night && this.night.state;
    if (!s) { guessChip.textContent = ''; return; }
    const left = Math.max(0, Math.ceil((this.roundEndsAt(s) - this.serverNow()) / 1000));
    guessChip.textContent = `⏱ ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    guessChip.classList.toggle('night-low', left <= 15);
  },

  tickRound() {
    const n = this.night;
    if (!n || gameMode !== 'night') { clearInterval(n && n.tick); return; }
    this.renderHud();
    if (!gameOver && this.serverNow() >= this.roundEndsAt(n.state)) this.finishRound(false);
  },

  // Saved after every guess, so a refresh mid-round picks up where it was
  persist() {
    const n = this.night;
    if (!n) return;
    try { sessionStorage.setItem('pancake_night_round', JSON.stringify({ night: n.id, round: n.playingRound, guesses: guesses.map(g => g.country.name) })); } catch {}
  },

  onFound() { this.finishRound(true); },

  async finishRound(found) {
    const n = this.night;
    if (!n || n.submitted === n.playingRound) return;
    n.submitted = n.playingRound;
    clearInterval(n.tick);
    gameOver = true;
    inputEl.disabled = true;
    guessForm.hidden = true;
    const seconds = Math.round((this.serverNow() - n.state.round_started_at) / 1000);
    let points = 0;
    try { points = await roomRpc('submit_round', { p_night: n.id, p_round: n.playingRound, p_guesses: guesses.map(g => g.country.name), p_seconds: seconds }); }
    catch (e) { showToast(roomErrorText(e)); }
    track('night_round_submit', { found, guesses: guesses.length });
    try { sessionStorage.removeItem('pancake_night_round'); } catch {}
    showToast(found ? `Found it! +${points} points` : 'Time’s up!');
    setTimeout(() => {
      if (!this.night || this.night.id !== n.id) return;
      document.getElementById('game-screen').hidden = true;
      rq('night').hidden = false;
      this.pollNight();
    }, found ? 1200 : 600);
  },

  // Back button mid-round: what you have counts, and you're out of this round
  onLeaveRound() {
    if (this.night && gameMode === 'night' && !gameOver) this.finishRound(false);
  },

  // Back from the globe during a night: back to the night board, still in the night
  backToNight() {
    const n = this.night;
    if (!n) { showScreen('hub'); this.renderHub(); return; }
    if (gameMode === 'night' && !gameOver) { this.finishRound(false); return; }   // shows the board when submitted
    clearInterval(n.tick);
    document.getElementById('game-screen').hidden = true;
    rq('night').hidden = false;
    this.pollNight();
  },

  // Leave the night (not the room): off the list, back to the room
  async leaveNight() {
    const n = this.night;
    if (!n) return;
    const roomId = n.state && n.state.room_id;
    if (!n.tv) {
      try { await roomRpc('leave_night', { p_night: n.id }); track('night_leave', { phase: n.state && n.state.phase }); }
      catch (e) { console.warn('leave_night:', e); }
    }
    try { sessionStorage.removeItem('pancake_night_round'); } catch {}
    this.leaveNightView();
    if (roomId && !n.tv) this.openRoom(roomId);
    else { showScreen('hub'); this.renderHub(); }
  },

  renderNight() {
    const n = this.night, s = n && n.state;
    if (!s) return;
    const host = s.is_host && !n.tv;
    const flag = name => (COUNTRIES.find(c => c.name === name) || {}).flag || '';
    rq('night-room').textContent = s.room_name;
    const reveal = rq('night-reveal');
    reveal.hidden = true;
    const primary = rq('night-primary');
    primary.hidden = true;
    primary.disabled = false;   // the lobby disables it until there are 2 players
    rq('night-tv').hidden = !host || s.phase === 'ended';
    rq('night-leave').hidden = n.tv || s.phase === 'ended';
    if (!rq('night-leave').dataset.armed) rq('night-leave').textContent = 'Leave game night';
    let title = '', sub = '';
    const done = s.players.filter(p => p.this_round).length;
    const playing = s.players.filter(p => !p.left).length;

    if (s.phase === 'lobby') {
      title = 'Game night';
      const here = s.present != null ? s.present : s.players.length;
      sub = `${s.rounds} rounds of ${Math.round(s.round_seconds / 60 * 10) / 10} min · ${here} here`;
      const enough = here >= 2;
      if (host) {
        primary.hidden = false;
        primary.disabled = !enough;
        primary.textContent = enough ? 'Start round 1' : 'Waiting for players…';
        primary.onclick = () => this.hostAction('start_round');
        if (!enough) sub += ' · needs at least 2 players. Share the room code!';
      }
      else if (!n.tv) sub += enough ? ' · waiting for the host' : ' · waiting for more players';
    } else if (s.phase === 'playing') {
      title = `Round ${s.round} of ${s.rounds}`;
      const left = Math.max(0, Math.ceil((this.roundEndsAt(s) - this.serverNow()) / 1000));
      sub = `${done} of ${playing} done · ${left}s left`;
    } else if (s.phase === 'between' || s.phase === 'final' || s.phase === 'ended') {
      title = s.phase === 'between' ? `Round ${s.round} of ${s.rounds}` : 'Final results';
      if (s.last_mystery) {
        reveal.hidden = false;
        reveal.innerHTML = `It was <b>${flag(s.last_mystery)} ${escHtml(s.last_mystery)}</b>`;
      }
      if (s.phase === 'between') {
        sub = host ? 'Ready when you are' : 'Next round soon';
        if (host) { primary.hidden = false; primary.textContent = `Start round ${s.round + 1}`; primary.onclick = () => this.hostAction('start_round'); }
      } else if (s.phase === 'final') {
        sub = host ? 'That was the last round' : 'That was the last round. Well played!';
        if (host) { primary.hidden = false; primary.textContent = 'Finish the night'; primary.onclick = () => this.hostAction('end_night'); }
      } else {
        sub = 'Well played, everyone!';
        if (!n.tv) { primary.hidden = false; primary.textContent = 'Back to the room'; primary.onclick = () => { const id = s.room_id; this.leaveNightView(); this.openRoom(id, 'nights'); }; }
      }
    }
    rq('night-title').textContent = title;
    rq('night-sub').textContent = sub;

    const board = rq('night-board');
    board.innerHTML = '';
    const podium = s.phase === 'final' || s.phase === 'ended';
    s.players.forEach((p, i) => {
      const li = document.createElement('li');
      li.className = `night-row${p.is_me && !n.tv ? ' me' : ''}${p.left ? ' left' : ''}${podium && i < 3 ? ` podium p${i + 1}` : ''}`;
      const r = p.this_round;
      const status = s.phase === 'lobby' ? (p.is_host ? 'host' : 'ready')
        : podium ? ''                                   // final standings: totals only
        : r ? (r.found ? `+${r.points} · ${r.guesses} guess${r.guesses === 1 ? '' : 'es'}` : 'missed')
        : p.left ? 'left'
        : s.phase === 'playing' ? 'hunting…' : '—';
      li.innerHTML = `<span class="night-rank">${podium && i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</span>
        <span class="night-name">${escHtml(p.username || 'Player')}${p.is_me && !n.tv ? ' (you)' : ''}</span>
        <span class="night-status">${escHtml(status)}</span>
        <span class="night-points">${p.points.toLocaleString()}</span>`;
      board.appendChild(li);
    });
  },

  async hostAction(fn) {
    const n = this.night;
    rq('night-primary').disabled = true;
    try {
      await roomRpc(fn, { p_night: n.id });
      if (fn === 'end_night') track('night_end', { players: n.state.players.length });
    } catch (e) { showToast(roomErrorText(e)); }
    rq('night-primary').disabled = false;
    this.pollNight();
  },

  showTvLink() {
    const url = `${location.origin}${location.pathname}?tv=${this.night.id}`;
    navigator.clipboard.writeText(url).then(() => showToast('TV link copied. Open it on the big screen')).catch(() => showToast(url));
  },

  leaveNightView() {
    const n = this.night;
    if (n) { clearInterval(n.poll); clearInterval(n.tick); }
    this.night = null;
    rq('night').hidden = true;
    rq('night').classList.remove('tv');
  },

  // ---------------------------------------------------------------- boot
  init() {
    this.captureInvite();
    // ?tv=<night id>: the big-screen scoreboard
    const tv = new URLSearchParams(location.search).get('tv');
    if (tv) this._tvNight = tv;
    if (typeof onCloudChange === 'function') onCloudChange(() => {
      if (cloudStatus !== 'ready') return;
      this.refresh(true);
      this.handlePendingInvite();
      if (this._tvNight) { const id = this._tvNight; this._tvNight = null; this.enterNight(id, { tv: true }); }
    });
    this.renderHomeCard();
  },
};

// ================================================================== challenges
// 5 countries picked by the server for a room, open 24 hours. Each round runs
// on the real globe: 10 guesses (relaxed) or 60 seconds (speed). The server
// starts the clock and scores every round.
const Challenge = {
  id: null,
  s: null,          // challenge_state()
  round: null,      // { round, country, speed, started_at }
  offset: 0,        // server clock − local clock
  tick: null,
  last: null,       // the round just played: { round, country, found, points, guesses }
  submitting: false,
  _newRoom: null,

  // ------------------------------------------------ new challenge sheet
  openNew(room) {
    this._newRoom = room;
    this._theme = 'world';
    this._speed = false;
    rq('cn-room').textContent = room.name;
    rq('cn-error').hidden = true;
    const grid = (el, items, isOn, onPick) => {
      el.innerHTML = items.map(([k, icon, label, sub]) =>
        `<button type="button" class="cn-opt" data-k="${k}"><span class="cn-icon">${icon}</span><b>${label}</b>${sub ? `<span class="muted">${sub}</span>` : ''}</button>`).join('');
      const sync = () => el.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', isOn(b.dataset.k)));
      el.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { onPick(b.dataset.k); sync(); }));
      sync();
    };
    grid(rq('cn-themes'), Object.entries(THEMES).map(([k, t]) => [k, t.icon, t.label]), k => k === this._theme, k => { this._theme = k; });
    grid(rq('cn-modes'), [['relaxed', '🧭', 'Relaxed', '10 guesses a country'], ['speed', '⚡', 'Speed', '60 seconds a country']],
      k => (k === 'speed') === this._speed, k => { this._speed = k === 'speed'; });
    if (!rq('challenge-new-dialog').open) rq('challenge-new-dialog').showModal();
  },

  async create(rematchOf = null, theme = this._theme, speed = this._speed, roomId = this._newRoom && this._newRoom.id) {
    const btn = rq('cn-go');
    btn.disabled = true;
    try {
      const id = await roomRpc('create_challenge', { p_room: roomId, p_theme: theme, p_speed: speed, p_rematch: rematchOf });
      track('challenge_create', { theme, speed, rematch: !!rematchOf });
      if (rq('challenge-new-dialog').open) rq('challenge-new-dialog').close();
      Rooms.closeSheets();
      Rooms.refresh(true);
      await this.open(id);
    } catch (e) {
      if (rematchOf) showToast(roomErrorText(e));
      else { rq('cn-error').textContent = roomErrorText(e); rq('cn-error').hidden = false; }
    }
    btn.disabled = false;
  },

  // ------------------------------------------------ the panel
  async open(id) {
    this.id = id;
    Rooms.closeSheets();
    try { this.s = await roomRpc('challenge_state', { p_challenge: id }); }
    catch (e) { showToast(roomErrorText(e)); return; }
    this.offset = this.s.server_now - Date.now();
    // A round left mid-way (refresh, crash): jump straight back into it
    let saved = null;
    try { saved = JSON.parse(sessionStorage.getItem('pancake_challenge_round') || 'null'); } catch {}
    if (saved && saved.id === id && this.s.open && saved.round === this.s.my_done + 1) { this.play(); return; }   // the round in progress
    this.render();
    rq('challenge').hidden = false;
    track('challenge_open', { theme: this.s.theme, done: this.s.my_done });
  },

  render() {
    const s = this.s, t = THEMES[s.theme] || THEMES.world;
    const done = s.my_done, finished = done === 5 || !s.open;
    rq('ch-room').innerHTML = `${escHtml(s.room_emoji || '')} ${escHtml(s.room_name)}`;
    const pace = s.speed ? '⚡ Speed · 60 s a country' : '🧭 Relaxed · 10 guesses a country';

    // progress dots: one per country, coloured by how it went
    rq('ch-dots').innerHTML = [1, 2, 3, 4, 5].map(i => {
      const m = s.mine.find(x => x.round === i);
      return `<span class="ch-dot${m ? (m.found ? ' found' : ' missed') : ''}${!m && i === done + 1 && !finished ? ' next' : ''}">${m ? (m.found ? '✓' : '✕') : i}</span>`;
    }).join('');

    const reveal = rq('ch-reveal');
    reveal.hidden = !this.last && (done || finished);
    if (!this.last && !done && !finished) {          // before the first country: how it scores
      reveal.innerHTML = '<span class="ch-rules">🎯 Same 5 countries for everyone. Fewer guesses and faster finds score more. Up to 1,300 a country.</span>';
      reveal.classList.remove('pop');
    } else if (this.last) {
      const L = this.last;
      reveal.innerHTML = L.found
        ? `It was <b>${flagOf(L.country)} ${escHtml(L.country)}</b><span class="ch-pts">+${L.points.toLocaleString()}</span>`
        : `It was <b>${flagOf(L.country)} ${escHtml(L.country)}</b><span class="ch-pts miss">missed</span>`;
      reveal.classList.remove('pop'); void reveal.offsetWidth; reveal.classList.add('pop');
    }

    let title, sub;
    const primary = rq('ch-primary');
    primary.hidden = false;
    if (finished) {
      title = done === 5 ? 'Final results' : 'Challenge over';
      sub = `${t.icon} ${t.label} challenge by ${s.by || '?'} · ${s.open ? left(s.ends_at) : 'ended'}`;
      primary.hidden = true;
    } else if (!done) {
      title = `${t.icon} ${t.label} challenge`;
      sub = `by ${s.by || '?'} · ${pace} · ${left(s.ends_at)}`;
      primary.textContent = 'Start ▶';
    } else {
      title = `${done} of 5 done`;
      sub = `${pace} · ${left(s.ends_at)}`;
      primary.textContent = `Next country ▶  (${done + 1}/5)`;
    }
    primary.onclick = () => this.play();
    rq('ch-title').textContent = title;
    rq('ch-sub').textContent = sub;

    // the board; when you're done, your countries too
    const board = rq('ch-board');
    board.innerHTML = '';
    const rows = s.board.slice();
    if (!rows.length) board.innerHTML = '<li class="muted ch-empty">Nobody has played yet. Be the first!</li>';
    rows.forEach((p, i) => {
      const li = document.createElement('li');
      const podium = finished && i < 3;
      li.className = `night-row${p.is_me ? ' me' : ''}${podium ? ` podium p${i + 1}` : ''}`;
      const dots = [1, 2, 3, 4, 5].map(k => { const r = p.rounds_detail.find(x => x.round === k); return r ? (r.found ? '🟢' : '⚫') : '◦'; }).join('');
      li.innerHTML = `<span class="night-rank">${podium ? ['🥇', '🥈', '🥉'][i] : i + 1}</span>
        <span class="night-name">${escHtml(p.username)}${p.is_me ? ' (you)' : ''}</span>
        <span class="night-status ch-row-dots">${dots}</span>
        <span class="night-points">${Number(p.points).toLocaleString()}</span>`;
      board.appendChild(li);
    });
    if (finished && s.mine.length) {
      const recap = document.createElement('li');
      recap.className = 'ch-recap';
      recap.innerHTML = `<b>Your countries</b>` + s.mine.map(m =>
        `<span>${flagOf(m.country)} ${escHtml(m.country)} · ${m.found ? `${m.guesses} guess${m.guesses === 1 ? '' : 'es'} · +${m.points}` : 'missed'}</span>`).join('');
      board.appendChild(recap);
    }

    // rivalry: who's just ahead of you
    const riv = rq('ch-rivalry');
    const meIdx = rows.findIndex(p => p.is_me);
    riv.hidden = true;
    if (meIdx > 0) {
      const ahead = rows[meIdx - 1], gap = ahead.points - rows[meIdx].points;
      riv.hidden = false;
      riv.textContent = finished
        ? `${gap.toLocaleString()} points behind ${ahead.username}. So close! Ask for a rematch 😤`
        : `${gap.toLocaleString()} behind ${ahead.username} with ${5 - done} to go. Catch them!`;
    } else if (meIdx === 0 && rows.length > 1) {
      riv.hidden = false;
      riv.textContent = finished ? `You beat ${rows.length - 1} player${rows.length === 2 ? '' : 's'}. Crown secured 👑` : `You’re leading! ${rows[1].username} is ${(rows[0].points - rows[1].points).toLocaleString()} behind.`;
    }

    rq('ch-share').hidden = done === 0;
    rq('ch-rematch').hidden = !finished;
    if (finished && meIdx === 0 && rows.length > 1 && !this._celebrated) { this._celebrated = true; celebrate(); }
  },

  // ------------------------------------------------ playing a round
  async play() {
    if (this.submitting) return;
    let r;
    try { r = await roomRpc('start_challenge_round', { p_challenge: this.id }); }
    catch (e) { showToast(roomErrorText(e)); return this.refreshPanel(); }
    this.round = r;
    this.offset = r.server_now - Date.now();
    const country = COUNTRIES.find(c => c.name === r.country);
    if (!country) { showToast('That country isn’t in this version of the game. Refresh.'); return; }
    rq('challenge').hidden = true;
    Rooms.closeSheets();
    let saved = null;   // guesses from before a refresh, for this exact round only
    try { const x = JSON.parse(sessionStorage.getItem('pancake_challenge_round') || 'null'); if (x && x.id === this.id && x.round === r.round) saved = x.guesses; } catch {}
    startChallengeRound(country, saved);
    track('challenge_round_start', { round: r.round, speed: r.speed });
    clearInterval(this.tick);
    if (r.speed) { this.tick = setInterval(() => this.onTick(), 250); this.onTick(); }
  },

  endsAt() { return this.round.started_at + 60000; },
  serverNow() { return Date.now() + this.offset; },
  limit() { return this.round && this.round.speed ? Infinity : 10; },

  chipLabel() {
    const t = THEMES[this.s && this.s.theme] || THEMES.world;
    return this.round ? `${t.icon} ${this.round.round}/5` : 'Challenge';
  },

  renderHud() {
    if (!this.round) return;
    if (this.round.speed) {
      const leftS = Math.max(0, Math.ceil((this.endsAt() - this.serverNow()) / 1000));
      guessChip.textContent = `⏱ 0:${String(leftS).padStart(2, '0')}`;
      guessChip.classList.toggle('night-low', leftS <= 10);
    } else {
      guessChip.textContent = `${guesses.length} / 10`;
      guessChip.classList.remove('night-low');
    }
  },

  onTick() {
    if (gameMode !== 'challenge' || !this.round) { clearInterval(this.tick); return; }
    this.renderHud();
    if (!gameOver && this.serverNow() >= this.endsAt()) {
      gameOver = true; inputEl.disabled = true; guessForm.hidden = true;
      this.finishRound(false);
    }
  },

  persist() {
    if (!this.round) return;
    try { sessionStorage.setItem('pancake_challenge_round', JSON.stringify({ id: this.id, round: this.round.round, guesses: guesses.map(g => g.country.name) })); } catch {}
  },

  onRoundEnd(found) { this.finishRound(found); },

  // Back mid-round: what you have counts, and the panel comes back
  onLeaveRound() {
    if (!gameOver) { gameOver = true; inputEl.disabled = true; guessForm.hidden = true; this.finishRound(false); }
    else this.backToPanel();
  },

  async finishRound(found) {
    if (this.submitting || !this.round) return;
    this.submitting = true;
    clearInterval(this.tick);
    const r = this.round;
    let res = null;
    try { res = await roomRpc('submit_challenge_round', { p_challenge: this.id, p_round: r.round, p_guesses: guesses.map(g => g.country.name) }); }
    catch (e) { showToast(roomErrorText(e)); }
    try { sessionStorage.removeItem('pancake_challenge_round'); } catch {}
    this.submitting = false;
    if (res) {
      this.last = { round: r.round, country: res.country, found: res.found, points: res.points, guesses: guesses.length };
      track('challenge_round_submit', { round: r.round, found: res.found, points: res.points });
    }
    this.round = null;
    setTimeout(() => this.backToPanel(), found ? 1100 : 500);
  },

  async backToPanel() {
    showScreen('hub');
    await this.refreshPanel();
  },

  async refreshPanel() {
    try { this.s = await roomRpc('challenge_state', { p_challenge: this.id }); } catch {}
    if (this.s && this.s.my_done === 5 && !this._finishedTracked) { this._finishedTracked = true; Rooms.refresh(true); }
    this.render();
    rq('challenge').hidden = false;
  },

  close() {
    rq('challenge').hidden = true;
    const roomId = this.s && this.s.room_id;
    this.id = null; this.s = null; this.last = null; this._celebrated = false; this._finishedTracked = false;
    Rooms.refresh(true);
    if (roomId) Rooms.openRoom(roomId);
  },

  share() {
    const s = this.s, t = THEMES[s.theme] || THEMES.world;
    const me = s.board.find(p => p.is_me) || { points: 0, found: 0 };
    const rank = s.board.indexOf(me) + 1;
    const text = s.my_done === 5
      ? `I scored ${Number(me.points).toLocaleString()} in the ${t.icon} ${t.label}${s.speed ? ' speed' : ''} challenge on Borderline (${me.found}/5 found${rank === 1 && s.board.length > 1 ? ', #1 so far 👑' : ''}). Think you can beat me?`
      : `I’m playing a ${t.icon} ${t.label} challenge on Borderline. 5 mystery countries, 24 hours. Join in:`;
    const url = roomInviteUrl(s.room_code, s.id);
    track('challenge_share', { done: s.my_done });
    if (navigator.share) { navigator.share({ text, url }).catch(() => {}); return; }
    navigator.clipboard.writeText(`${text}\n${url}`).then(() => showToast('Link copied')).catch(() => showToast(url));
  },

  rematch() {
    const s = this.s;
    rq('challenge').hidden = true;
    this.last = null; this._celebrated = false; this._finishedTracked = false;
    this.create(s.id, s.theme, s.speed, s.room_id);
  },
};

// ================================================================== confetti
// A short burst over everything: new room, joining one, winning a challenge
function celebrate() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const c = rq('ch-confetti');
  if (!c) return;
  const host = document.body;
  if (c.parentElement !== host) host.append(c);
  c.width = innerWidth * devicePixelRatio; c.height = innerHeight * devicePixelRatio;
  c.style.display = 'block';
  const g = c.getContext('2d');
  const colours = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#f5c451'];
  const bits = Array.from({ length: 140 }, () => ({
    x: c.width / 2 + (Math.random() - 0.5) * c.width * 0.3, y: c.height * 0.35,
    vx: (Math.random() - 0.5) * 22 * devicePixelRatio, vy: (-8 - Math.random() * 14) * devicePixelRatio,
    s: (5 + Math.random() * 7) * devicePixelRatio, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
    col: colours[Math.floor(Math.random() * colours.length)],
  }));
  const t0 = performance.now();
  (function frame(now) {
    const k = (now - t0) / 1000;
    g.clearRect(0, 0, c.width, c.height);
    for (const b of bits) {
      b.vy += 0.5 * devicePixelRatio; b.x += b.vx; b.y += b.vy; b.vx *= 0.99; b.r += b.vr;
      g.save(); g.translate(b.x, b.y); g.rotate(b.r); g.globalAlpha = Math.max(0, 1 - k / 2.4);
      g.fillStyle = b.col; g.fillRect(-b.s / 2, -b.s / 3, b.s, b.s * 0.66); g.restore();
    }
    if (k < 2.4) requestAnimationFrame(frame); else { g.clearRect(0, 0, c.width, c.height); c.style.display = 'none'; }
  })(t0);
}

// ---------------------------------------------------------------- wiring
rq('hub-create-btn').addEventListener('click', () => Rooms.openCreate());
rq('hub-join-btn').addEventListener('click', () => Rooms.openJoin());
rq('hub-duel-btn').addEventListener('click', () => { track('duel_click', {}); challengeFriend(); });
rq('hub-friends-btn').addEventListener('click', () => openFriends());
rq('rooms-close-btn').addEventListener('click', () => rq('rooms-dialog').close());
rq('room-join-form').addEventListener('submit', e => { e.preventDefault(); Rooms.joinWithCode(rq('room-code-input').value); });
rq('room-create-form').addEventListener('submit', e => { e.preventDefault(); Rooms.create(rq('room-name-input').value); });
rq('rc-cancel').addEventListener('click', () => rq('room-create-dialog').close());
rq('room-close-btn').addEventListener('click', () => rq('room-dialog').close());
rq('room-share-btn').addEventListener('click', () => Rooms.shareInvite());
rq('room-invite-btn').addEventListener('click', () => Rooms.shareInvite());
rq('room-challenge-btn').addEventListener('click', () => { const r = Rooms.room.room; rq('room-dialog').close(); Challenge.openNew(r); });
rq('room-night-btn').addEventListener('click', () => {
  const form = document.querySelector('#room-dialog .room-night-form');
  form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  form.classList.remove('flash'); void form.offsetWidth; form.classList.add('flash');
});
rq('room-live-btn').addEventListener('click', () => { const id = Rooms.room.live_night.id; rq('room-dialog').close(); Rooms.enterNight(id); });
rq('room-play-btn').addEventListener('click', () => { rq('room-dialog').close(); chooseMode('daily'); });
document.querySelectorAll('#room-dialog [data-period]').forEach(b =>
  b.addEventListener('click', () => Rooms.openRoom(Rooms.room.room.id, b.dataset.period)));
rq('night-start-btn').addEventListener('click', () => Rooms.startNight());
rq('room-reset-btn').addEventListener('click', e => Rooms._confirmTwice(e.currentTarget, 'Old link stops working. Tap again', () =>
  Rooms.manage('reset_room_code', { p_room: Rooms.room.room.id })));
rq('room-rename-btn').addEventListener('click', () => {
  const name = window.prompt ? window.prompt('New room name', Rooms.room.room.name) : null;
  if (name && name.trim()) Rooms.manage('rename_room', { p_room: Rooms.room.room.id, p_name: name.trim() });
});
rq('room-close-room-btn').addEventListener('click', e => Rooms._confirmTwice(e.currentTarget, 'Close for everyone? Tap again', () =>
  Rooms.manage('close_room', { p_room: Rooms.room.room.id }, () => { rq('room-dialog').close(); showToast('Room closed'); })));
rq('room-leave-btn').addEventListener('click', e => Rooms._confirmTwice(e.currentTarget, 'Tap again to leave', () =>
  Rooms.manage('leave_room', { p_room: Rooms.room.room.id }, () => { track('room_leave', {}); rq('room-dialog').close(); showToast('You left the room'); })));
rq('room-join-ok').addEventListener('click', () => Rooms.confirmJoin());
rq('room-join-cancel').addEventListener('click', () => rq('room-join-dialog').close());
// Leaving mid-game asks for a second tap: your spot in the rounds still to come is gone
rq('night-leave').addEventListener('click', e => {
  const s = Rooms.night && Rooms.night.state;
  if (s && (s.phase === 'playing' || s.phase === 'between')) Rooms._confirmTwice(e.currentTarget, 'Tap again to leave the night', () => Rooms.leaveNight());
  else Rooms.leaveNight();
});
rq('night-tv').addEventListener('click', () => Rooms.showTvLink());
rq('cn-cancel').addEventListener('click', () => rq('challenge-new-dialog').close());
rq('cn-go').addEventListener('click', () => Challenge.create());
rq('ch-leave').addEventListener('click', () => Challenge.close());
rq('ch-share').addEventListener('click', () => Challenge.share());
rq('ch-rematch').addEventListener('click', () => Challenge.rematch());
for (const id of ['rooms-dialog', 'room-dialog', 'room-join-dialog', 'room-create-dialog', 'challenge-new-dialog']) {
  const d = rq(id);
  d.addEventListener('click', e => { if (e.target === d) d.close(); });
}
