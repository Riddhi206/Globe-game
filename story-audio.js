// story-audio.js — THE UNMAKING's sound, all synthesised with WebAudio: no
// audio files, no licensing (03-animation-audio.md §6).
//
// Sound is off until the player opts in. The AudioContext is only ever
// created by unlock(), which runs from a user gesture once sound is on —
// with sound off, nothing here touches WebAudio at all.

const StoryAudio = (() => {
  let ac = null, master = null, on = false;
  let drone = null; // { gain, stop() } while ambience plays

  function unlock() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return; // no WebAudio at all: stay silent, never throw
    if (!ac) {
      try {
        ac = new AC();
        master = ac.createGain();
        master.gain.value = 0.5;
        master.connect(ac.destination);
      } catch { ac = null; return; }
    }
    if (ac.state === 'suspended') ac.resume().catch(() => {});
  }

  // A saved "on" from an earlier visit can't start audio until the player
  // touches the page, so the first gesture after load unlocks it.
  function armUnlockOnGesture() {
    const go = () => { if (on) unlock(); };
    document.addEventListener('pointerdown', go, { once: true, capture: true });
    document.addEventListener('keydown', go, { once: true, capture: true });
  }

  function setOn(v, { fromGesture = true } = {}) {
    on = !!v;
    if (!on) { stopAmbience(); return; }
    if (fromGesture) unlock(); else armUnlockOnGesture();
  }

  function ready() { return on && ac && ac.state !== 'closed'; }

  function tone(freq, dur, { type = 'sine', gain = .2, attack = .005, glideTo = null, at = 0 } = {}) {
    if (!ready()) return;
    const t = ac.currentTime + at, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master); o.start(t); o.stop(t + dur + .02);
  }

  function noise(dur, { gain = .2, filter = 'lowpass', freq = 1200, freqTo = null, q = 1, at = 0 } = {}) {
    if (!ready()) return;
    const t = ac.currentTime + at, len = Math.ceil(ac.sampleRate * dur);
    const buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource(); src.buffer = buf;
    const f = ac.createBiquadFilter(); f.type = filter; f.Q.value = q; f.frequency.setValueAtTime(freq, t);
    if (freqTo) f.frequency.exponentialRampToValueAtTime(freqTo, t + dur);
    const g = ac.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(master); src.start(t);
  }

  // Ambience (§6, optional): two detuned saws through a slowly swept lowpass.
  function startAmbience() {
    if (!ready() || drone) return;
    const t = ac.currentTime;
    const gain = ac.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.04, t + 2);
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 400;
    const lfo = ac.createOscillator(), lfoGain = ac.createGain();
    lfo.frequency.value = 0.05; lfoGain.gain.value = 150;
    lfo.connect(lfoGain).connect(lp.frequency);
    const oscs = [55, 55.4].map(f => { const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(lp); return o; });
    lp.connect(gain).connect(master);
    [...oscs, lfo].forEach(o => o.start(t));
    drone = {
      oscs,
      stop() {
        const now = ac.currentTime;
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(gain.gain.value, now);
        gain.gain.linearRampToValueAtTime(0.0001, now + 2);
        [...oscs, lfo].forEach(o => o.stop(now + 2.05));
      },
    };
  }
  function stopAmbience() { if (drone) { drone.stop(); drone = null; } }
  // ch 7: the drone drifts out of tune as Needle glitches
  function detune(cents) { if (drone) drone.oscs.forEach((o, i) => o.detune.setTargetAtTime(cents * (i ? -1 : 1), ac.currentTime, 0.8)); }

  return {
    unlock, setOn, startAmbience, stopAmbience, detune,
    isOn: () => on,
    type:     () => tone(1800 + Math.random() * 400, .025, { type: 'square', gain: .02 }),
    drip:     () => tone(700, .14, { glideTo: 140, gain: .18 }),
    erase:    () => { noise(.5, { freq: 400, freqTo: 120, gain: .15 }); tone(90, .5, { type: 'triangle', gain: .12 }); },
    heartbeat:() => { tone(55, .16, { type: 'sine', gain: .35 }); tone(50, .16, { type: 'sine', gain: .28, at: .22 }); },
    charge:   p  => tone(160 + p * 440, .22, { type: 'sawtooth', gain: .03 + p * .04 }),
    burn:     () => { noise(1.2, { filter: 'bandpass', freq: 300, freqTo: 4000, q: .8, gain: .35 }); tone(70, 1.2, { type: 'sawtooth', glideTo: 35, gain: .2 }); },
    restore:  () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, .9, { type: 'triangle', gain: .12, at: i * .14 })),
    star:     i  => tone(880 * Math.pow(1.26, i), .35, { type: 'triangle', gain: .14 }),
    pen:      () => noise(.6, { filter: 'highpass', freq: 3000, gain: .03 }),
    glitch:   () => { for (let i = 0; i < 6; i++) tone(200 + Math.random() * 1800, .04, { type: 'square', gain: .05, at: i * .05 }); },
    shatter:  () => { noise(.8, { filter: 'highpass', freq: 2500, gain: .3 }); [2093, 2637, 3136].forEach((f, i) => tone(f, .6, { gain: .06, at: i * .05 })); },
  };
})();
