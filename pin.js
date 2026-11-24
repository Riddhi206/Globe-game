// pin.js — Pin Drop: place a pin on the globe where you think a place is.
//
// Mode-agnostic: the story (signal.js) uses it today, a daily city mode can
// use it later. A caller hands over a target and callbacks; this file owns the
// pin, the Lock in button, distance scoring and the reveal line. It draws
// through game.js (drawGlobe calls PinDrop.draw; taps on the globe come in
// through PinDrop.tap) and reads its globals (canvas, view, CX, CY, W).
//
//   PinDrop.start({
//     target: { name, lat, lon },         // where the right answer is
//     chip: 'Episode 1', lockLabel: 'Lock in',
//     panel: el => {},                    // fill the panel under the globe
//     onLock: async result => ({ done, reveal }),
//                                         // result: { lat, lon, km, points, attempt }
//                                         // done: stop taking pins; reveal: show the answer
//     onBack: () => {},                   // the back button / "Chat" button
//   });

// Points for a pin `km` away: 1000 inside `perfectKm`, falling smoothly to 0 by `zeroKm`
function pinPoints(km, { perfectKm = 25, zeroKm = 3000 } = {}) {
  if (km <= perfectKm) return 1000;
  if (km >= zeroKm) return 0;
  const t = (km - perfectKm) / (zeroKm - perfectKm);
  return Math.round(1000 * Math.pow(1 - t, 2.2));
}

// Colour band for a pin `km` away, on the game's heat scale (tighter than countries)
function pinTemp(km) {
  return km <= 150 ? 'correct' : km <= 500 ? 'hot' : km <= 1500 ? 'warm' : km <= 4000 ? 'cool' : 'cold';
}

const PinDrop = {
  active: false,
  opts: null,
  pin: null,          // { lat, lon, at } the pin being placed
  pins: [],           // locked pins: { lat, lon, km, temp, n }
  reveal: null,       // { lat, lon, at } the answer, once shown
  busy: false,

  start(opts) {
    this.opts = opts;
    this.active = true;
    this.pin = null;
    this.pins = [];
    this.reveal = null;
    this.busy = false;
    startPinMode(opts.chip || '');
    this.render();
    dirty = true;
  },

  stop() {
    this.active = false;
    this.opts = null;
    this.pin = null;
    dirty = true;
  },

  // The screen point under a tap → latitude/longitude on the globe, or null off the globe
  pointToLatLon(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const px = (clientX - rect.left) * (W / rect.width);
    const py = (clientY - rect.top) * (H / rect.height);
    updateView();
    const { cg, sg, ct, st, R } = view;
    const x = (px - CX) / (R * view.mx), yS = (CY - py) / R;
    const rr = x * x + yS * yS;
    if (rr > 1) return null;
    const z2 = Math.sqrt(1 - rr);
    const Z = yS * ct - z2 * st, z = yS * st + z2 * ct;
    const X = z * cg - x * sg, Y = x * cg + z * sg;
    return { lat: toDeg(Math.asin(Math.max(-1, Math.min(1, Z)))), lon: toDeg(Math.atan2(Y, X)) };
  },

  tap(clientX, clientY) {
    if (!this.active || this.busy || this.reveal) return;
    const p = this.pointToLatLon(clientX, clientY);
    if (!p) return;
    this.pin = { ...p, at: performance.now() };
    if (navigator.vibrate) navigator.vibrate(12);
    this.render();
    dirty = true;
  },

  async lock() {
    if (!this.pin || this.busy) return;
    this.busy = true;
    const t = this.opts.target;
    const km = Math.round(haversine(t.lat, t.lon, this.pin.lat, this.pin.lon));
    const result = { lat: this.pin.lat, lon: this.pin.lon, km, points: pinPoints(km, this.opts.scoring), attempt: this.pins.length + 1 };
    this.pins.push({ lat: this.pin.lat, lon: this.pin.lon, km, temp: pinTemp(km), n: result.attempt });
    this.pin = null;
    dirty = true;
    const out = (await this.opts.onLock(result)) || {};
    if (out.reveal) this.showAnswer();
    this.busy = !!out.done;
    this.render();
  },

  showAnswer() {
    const t = this.opts.target;
    this.reveal = { lat: t.lat, lon: t.lon, at: performance.now() };
    flyTo({ lat: t.lat, lon: t.lon });
    dirty = true;
  },

  // Panel under the globe + the action bar
  render() {
    if (!this.active) return;
    const o = this.opts;
    if (o.panel) o.panel($('pin-panel'));
    const lockBtn = $('pin-lock');
    lockBtn.disabled = !this.pin || this.busy || !!this.reveal;
    lockBtn.textContent = this.reveal ? 'Found' : this.pin ? (o.lockLabel || 'Lock in') : 'Tap the globe to drop a pin';
    guessChip.textContent = o.attempts ? `📍 ${this.pins.length} / ${o.attempts}` : `📍 ${this.pins.length}`;
  },

  // ---------------------------------------------------------------- drawing (called from drawGlobe)
  _anim: false,      // still animating: game.js keeps redrawing while true

  draw(c) {
    this._anim = false;
    if (!this.active) return;
    const now = performance.now();
    let animating = false;
    // Earlier pins, small and coloured by how close they were
    for (const p of this.pins) {
      const s = projectVec(...toVec(p.lat, p.lon));
      if (!s) continue;
      c.beginPath(); c.arc(s.x, s.y, 5, 0, Math.PI * 2);
      c.fillStyle = tempStroke(p.temp, p.km); c.fill();
      c.lineWidth = 1.5; c.strokeStyle = 'rgba(255,255,255,0.9)'; c.stroke();
    }
    // The answer: a line from the last pin, and rings
    if (this.reveal) {
      const k = Math.min(1, (now - this.reveal.at) / 900);
      const last = this.pins[this.pins.length - 1];
      const tv = toVec(this.reveal.lat, this.reveal.lon);
      if (last && k > 0) {
        const a = toVec(last.lat, last.lon);
        c.save(); c.setLineDash([5, 6]); c.lineWidth = 2; c.strokeStyle = 'rgba(255,255,255,0.85)'; c.beginPath();
        let pen = false;
        for (let i = 0; i <= 40 * k; i++) {
          const q = arcPoint(a, tv, i / 40), s = projectVec(q[0], q[1], q[2]);
          if (!s) { pen = false; continue; }
          pen ? c.lineTo(s.x, s.y) : c.moveTo(s.x, s.y); pen = true;
        }
        c.stroke(); c.restore();
      }
      const s = projectVec(...tv);
      if (s) {
        const t = (now - this.reveal.at) / 1000;
        for (let i = 0; i < 3; i++) {
          const ph = (t * 0.7 - i / 3) % 1;
          if (ph < 0) continue;
          c.beginPath(); c.arc(s.x, s.y, 7 + 30 * ph, 0, Math.PI * 2);
          c.strokeStyle = `rgba(34,197,94,${(1 - ph) * 0.8})`; c.lineWidth = 2; c.stroke();
        }
        c.beginPath(); c.arc(s.x, s.y, 6, 0, Math.PI * 2); c.fillStyle = '#22c55e'; c.fill();
        c.lineWidth = 2; c.strokeStyle = '#fff'; c.stroke();
      }
      animating = (now - this.reveal.at) < 6000;
    }
    // The pin being placed: drops in with a bounce, with a shadow
    if (this.pin) {
      const s = projectVec(...toVec(this.pin.lat, this.pin.lon));
      if (s) {
        const t = Math.min(1, (now - this.pin.at) / 420);
        const drop = (1 - t) * (1 - t) * 26 * Math.abs(Math.cos(t * Math.PI * 1.5));
        animating = animating || t < 1;
        c.beginPath(); c.ellipse(s.x, s.y + 1, 5 * (0.6 + 0.4 * t), 2, 0, 0, Math.PI * 2);
        c.fillStyle = 'rgba(0,0,0,0.35)'; c.fill();
        const y = s.y - drop;
        c.beginPath(); c.moveTo(s.x, y); c.lineTo(s.x, y - 16); c.lineWidth = 2.5; c.strokeStyle = '#f2f2f7'; c.stroke();
        c.beginPath(); c.arc(s.x, y - 20, 6.5, 0, Math.PI * 2); c.fillStyle = '#ef4444'; c.fill();
        c.lineWidth = 2; c.strokeStyle = '#fff'; c.stroke();
      }
    }
    this._anim = animating;
  },
};

$('pin-lock').addEventListener('click', () => PinDrop.lock());
$('pin-back').addEventListener('click', () => { if (PinDrop.opts && PinDrop.opts.onBack) PinDrop.opts.onBack(); });
