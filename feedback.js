// feedback.js — "Feedback" in the home footer: a short sheet that sends a bug
// report, an idea or anything else to the feedback table (019_feedback.sql).
// The device details sent with it are listed in the sheet itself.

(() => {
  const DRAFT_KEY = 'borderline_feedback_draft';
  const HINTS = {
    bug:   'What happened, and what did you expect? Which screen were you on?',
    idea:  'What would make GlobeGame more fun for you?',
    other: 'Anything at all. We read every message.',
  };
  const dialog = $('feedback-dialog'), text = $('feedback-text'), contact = $('feedback-contact');
  const err = $('feedback-error'), send = $('feedback-send');
  let kind = 'bug';

  function setKind(k) {
    kind = k;
    dialog.querySelectorAll('[data-kind]').forEach(b => b.setAttribute('aria-pressed', b.dataset.kind === k));
    text.placeholder = HINTS[k];
  }

  function open(source = 'footer') {
    let draft = {};
    try { draft = JSON.parse(localStorage.getItem(DRAFT_KEY)) || {}; } catch {}
    setKind(draft.kind || 'bug');
    text.value = draft.message || '';
    contact.value = draft.contact || '';
    err.hidden = true;
    send.disabled = false;
    send.textContent = 'Send';
    dialog.showModal();
    track('feedback_open', { source });
    setTimeout(() => text.focus(), 50);
  }

  function saveDraft() {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ kind, message: text.value, contact: contact.value })); } catch {}
  }

  // What helps reproduce a bug: no names, no location
  function meta() {
    const store = loadStore();
    return {
      platform: typeof Notify !== 'undefined' ? Notify.platform() : '',
      installed: isStandalone(),
      screen: `${screen.width}x${screen.height}`,
      viewport: `${innerWidth}x${innerHeight}`,
      lang: navigator.language,
      tz: (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return ''; } })(),
      ua: navigator.userAgent.slice(0, 300),
      games: store.games.length,
      username: typeof cloudUsername !== 'undefined' ? cloudUsername || '' : '',
      theme: document.documentElement.dataset.theme || '',
    };
  }

  async function submit(e) {
    e.preventDefault();
    const message = text.value.trim();
    if (message.length < 3) { err.textContent = 'Write a few words first.'; err.hidden = false; text.focus(); return; }
    const email = contact.value.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { err.textContent = 'That email doesn’t look right. Leave it empty if you don’t want a reply.'; err.hidden = false; contact.focus(); return; }
    if (typeof cloudStatus === 'undefined' || cloudStatus !== 'ready' || !sb) {
      saveDraft();
      err.textContent = 'You’re offline. Your message is saved here; send it when you’re back online.';
      err.hidden = false;
      return;
    }
    send.disabled = true;
    send.textContent = 'Sending…';
    const { error } = await sb.rpc('send_feedback', { p_kind: kind, p_message: message.slice(0, 2000), p_contact: email || null, p_meta: meta() });
    if (error) {
      saveDraft();
      err.textContent = /too many/.test(error.message) ? 'Thanks, that’s plenty for now. Try again in an hour.' : 'Couldn’t send it. Your message is saved; try again in a moment.';
      err.hidden = false;
      send.disabled = false;
      send.textContent = 'Send';
      return;
    }
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
    track('feedback_sent', { kind, contact: !!email, length: message.length });
    dialog.close();
    showToast('Thanks! We read every message 🙏');
  }

  dialog.querySelectorAll('[data-kind]').forEach(b => b.addEventListener('click', () => setKind(b.dataset.kind)));
  $('feedback-form').addEventListener('submit', submit);
  $('feedback-cancel').addEventListener('click', () => { if (text.value.trim()) saveDraft(); dialog.close(); });
  text.addEventListener('input', () => { err.hidden = true; });
  $('feedback-btn').addEventListener('click', () => open('footer'));
})();
