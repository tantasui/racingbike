'use strict';
// ============================================================ CORE: math, input, audio
const PI = Math.PI, TAU = Math.PI * 2;
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { x = clamp((x - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); };
const angDiff = (a, b) => { let d = (a - b) % TAU; if (d > PI) d -= TAU; if (d < -PI) d += TAU; return d; };
const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
function RNG(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hash2(x, y) { const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n); }
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return lerp(lerp(hash2(xi, yi), hash2(xi + 1, yi), u), lerp(hash2(xi, yi + 1), hash2(xi + 1, yi + 1), u), v);
}
function fbm(x, y, o = 4) { let a = .5, s = 0, f = 1; for (let i = 0; i < o; i++) { s += a * vnoise(x * f, y * f); f *= 2.03; a *= .5; } return s; }
const ridged = (x, y) => { let s = 0, a = .5, f = 1; for (let i = 0; i < 3; i++) { s += a * (1 - Math.abs(vnoise(x * f, y * f) * 2 - 1)); f *= 2.1; a *= .5; } return s; };
const $ = id => document.getElementById(id);

// ---------------------------------------------------------------- input
const keys = {}, pressed = {};
addEventListener('keydown', e => {
  if (!keys[e.code]) pressed[e.code] = true;
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
  if (e.ctrlKey && ['KeyS', 'KeyD', 'KeyA', 'KeyE', 'KeyR', 'KeyQ', 'KeyF'].includes(e.code)) e.preventDefault();
  AU.init();
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
addEventListener('pointerdown', () => AU.init());

// ---------------------------------------------------------------- gamepad (standard mapping; keyboard keeps working)
// Left stick steer / air spin + flips · RT pedal · LT brake · A jump · X punch · B kick · RB boost · Y trick · Start pause
const PAD = {
  on: false, steer: 0, sy: 0, acc: 0, brake: 0, b: [], hit: {}, nav: {}, pn: {}, gp: null,
  poll() {
    const list = navigator.getGamepads ? [...navigator.getGamepads()] : [];
    const gp = list.find(g => g && g.connected && g.mapping === 'standard') || list.find(g => g && g.connected);
    this.hit = {}; this.nav = {};
    if (!gp) { if (this.on) { this.on = false; toast('CONTROLLER DISCONNECTED'); } this.steer = this.sy = this.acc = this.brake = 0; this.b = []; this.gp = null; return; }
    if (!this.on) { this.on = true; toast('🎮 CONTROLLER CONNECTED'); }
    this.gp = gp;
    const dz = v => Math.abs(v) < .15 ? 0 : Math.sign(v) * (Math.abs(v) - .15) / .85; // 0.15 deadzone
    const val = i => gp.buttons[i] ? (gp.buttons[i].value || (gp.buttons[i].pressed ? 1 : 0)) : 0;
    this.steer = dz(gp.axes[0] || 0); this.sy = dz(gp.axes[1] || 0); this.acc = val(7); this.brake = val(6);
    for (let i = 0; i < 16; i++) { const d = val(i) > .5; if (d && !this.b[i]) { this.hit[i] = true; AU.init(); } this.b[i] = d; }
    const dirs = { left: this.steer < -.5 || this.b[14], right: this.steer > .5 || this.b[15], up: this.sy < -.5 || this.b[12], down: this.sy > .5 || this.b[13] };
    for (const k in dirs) { if (dirs[k] && !this.pn[k]) this.nav[k] = true; this.pn[k] = dirs[k]; }
  },
  rumble(strong, weak, ms) { const a = this.gp && this.gp.vibrationActuator; if (a && a.playEffect) { try { const p = a.playEffect('dual-rumble', { duration: ms, strongMagnitude: clamp(strong, 0, 1), weakMagnitude: clamp(weak, 0, 1) }); if (p && p.catch) p.catch(() => { }); } catch (e) { } } }
};
function toast(t) { const e = $('toast'); if (!e) return; e.textContent = t; e.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => e.classList.remove('on'), 2600); }

// ---------------------------------------------------------------- audio (all synthesized)
const AU = {
  ctx: null, muted: false, musicOn: true,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
    const c = this.ctx = new C();
    this.master = c.createGain(); this.master.gain.value = .55;
    const comp = c.createDynamicsCompressor(); this.master.connect(comp); comp.connect(c.destination);
    const b = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.nb = b;
    // wind loop
    this.windF = c.createBiquadFilter(); this.windF.type = 'bandpass'; this.windF.frequency.value = 500; this.windF.Q.value = .6;
    this.windG = c.createGain(); this.windG.gain.value = 0;
    const ws = c.createBufferSource(); ws.buffer = b; ws.loop = true; ws.connect(this.windF); this.windF.connect(this.windG); this.windG.connect(this.master); ws.start();
    // rumble loop (avalanche / boulders)
    this.rumF = c.createBiquadFilter(); this.rumF.type = 'lowpass'; this.rumF.frequency.value = 110;
    this.rumG = c.createGain(); this.rumG.gain.value = 0;
    const rs = c.createBufferSource(); rs.buffer = b; rs.loop = true; rs.playbackRate.value = .5; rs.connect(this.rumF); this.rumF.connect(this.rumG); this.rumG.connect(this.master); rs.start();
    // engine
    this.eng = c.createOscillator(); this.eng.type = 'sawtooth'; this.eng.frequency.value = 60;
    this.engF = c.createBiquadFilter(); this.engF.type = 'lowpass'; this.engF.frequency.value = 400;
    this.engG = c.createGain(); this.engG.gain.value = 0;
    this.eng.connect(this.engF); this.engF.connect(this.engG); this.engG.connect(this.master); this.eng.start();
    // music bus with echo
    this.mus = c.createGain(); this.mus.gain.value = .5;
    const dl = c.createDelay(1); dl.delayTime.value = .33; const fb = c.createGain(); fb.gain.value = .35;
    this.mus.connect(this.master); this.mus.connect(dl); dl.connect(fb); fb.connect(dl); fb.connect(this.master);
    this.mNext = 0; this.mStep = 0;
  },
  tone(f, dur, o = {}) {
    const c = this.ctx; if (!c || this.muted) return;
    const t = c.currentTime + (o.delay || 0), os = c.createOscillator(), g = c.createGain();
    os.type = o.type || 'sine'; os.frequency.setValueAtTime(f, t);
    if (o.to) os.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + dur);
    const v = o.vol || .2; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + (o.att || .005)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    os.connect(g); g.connect(o.bus || this.master); os.start(t); os.stop(t + dur + .05);
  },
  noise(dur, o = {}) {
    const c = this.ctx; if (!c || this.muted) return;
    const t = c.currentTime + (o.delay || 0), s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.nb; s.loop = true; f.type = o.type || 'bandpass'; f.Q.value = o.q || .8;
    f.frequency.setValueAtTime(o.f || 800, t); if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    const v = o.vol || .2; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + (o.att || .005)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t, Math.random()); s.stop(t + dur + .05);
  },
  // --- sfx
  jump() { this.tone(180, .22, { to: 520, type: 'triangle', vol: .16 }); this.noise(.15, { f: 1200, vol: .06 }); },
  land(p) { p = clamp(p, .2, 1); this.tone(110, .22, { to: 40, vol: .35 * p }); this.noise(.2, { f: 500, to: 120, vol: .25 * p, type: 'lowpass' }); },
  hit() { this.noise(.12, { f: 1800, to: 300, vol: .4 }); this.tone(160, .14, { to: 60, type: 'square', vol: .22 }); },
  ko() { this.hit(); this.tone(660, .5, { to: 110, type: 'sawtooth', vol: .2 }); this.tone(880, .12, { delay: .1, type: 'square', vol: .12 }); this.tone(1320, .2, { delay: .2, type: 'square', vol: .12 }); },
  boost() { this.tone(120, .9, { to: 900, type: 'sawtooth', vol: .16 }); this.noise(1.1, { f: 300, to: 5000, vol: .22, q: .5 }); },
  crash() { this.noise(.7, { f: 900, to: 80, vol: .5, type: 'lowpass' }); this.tone(90, .5, { to: 30, type: 'square', vol: .25 }); this.noise(.15, { f: 3000, vol: .2, delay: .12 }); },
  cp() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, .22, { delay: i * .07, type: 'triangle', vol: .14 })); },
  beep(hi) { this.tone(hi ? 1046 : 523, hi ? .6 : .2, { type: 'square', vol: .16 }); },
  trick(n) { for (let i = 0; i < Math.min(5, n + 1); i++) this.tone(660 * Math.pow(1.189, i * 2), .16, { delay: i * .06, type: 'triangle', vol: .15 }); },
  ui() { this.tone(880, .07, { type: 'square', vol: .08 }); },
  pad() { this.tone(300, .5, { to: 1400, type: 'sawtooth', vol: .14 }); this.noise(.5, { f: 600, to: 4500, vol: .16, q: .5 }); },
  swing() { this.noise(.12, { f: 700, to: 2400, vol: .12 }); },
  splash() { this.noise(.6, { f: 2500, to: 200, vol: .35 }); this.tone(70, .5, { to: 35, vol: .3 }); },
  geyser() { this.noise(.9, { f: 400, to: 3500, vol: .2, q: .4 }); },
  thump() { this.tone(75, .09, { to: 45, vol: .2 }); this.noise(.05, { f: 300, vol: .08, type: 'lowpass' }); },
  win() { [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, .4, { delay: i * .11, type: 'sawtooth', vol: .1 })); },
  // --- continuous
  frame(v, ride, air, boost, rumble) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime, m = this.muted ? 0 : 1, k = clamp(v / 40, 0, 1.4);
    this.windG.gain.setTargetAtTime(m * (.02 + k * k * .22 + (air ? .05 : 0)), t, .1);
    this.windF.frequency.setTargetAtTime(350 + k * 1400 + (boost ? 900 : 0), t, .1);
    this.rumG.gain.setTargetAtTime(m * rumble * .9, t, .15);
    let f = 50, g = 0, cf = 300;
    if (ride === 0) { f = 70 + v * 5; g = .012 + k * .02; cf = 500 + v * 30; }
    else if (ride === 2) { f = 34 + v * 2.2 + (Math.sin(t * 22) > 0 ? 6 : 0); g = .05 + k * .05; cf = 220 + v * 12; }
    if (air) g *= .5;
    this.eng.frequency.setTargetAtTime(f, t, .05); this.engG.gain.setTargetAtTime(m * g, t, .08); this.engF.frequency.setTargetAtTime(cf, t, .1);
  },
  silence() { if (!this.ctx) return; const t = this.ctx.currentTime; this.windG.gain.setTargetAtTime(0, t, .1); this.engG.gain.setTargetAtTime(0, t, .1); this.rumG.gain.setTargetAtTime(0, t, .1); },
  // --- generative music: bass + pentatonic arp
  music(root, tempo, intensity) {
    const c = this.ctx; if (!c || this.muted || !this.musicOn) return;
    const sd = 60 / tempo / 4;
    if (this.mNext < c.currentTime) this.mNext = c.currentTime + .05;
    const sc = [0, 3, 5, 7, 10, 12, 15, 17];
    while (this.mNext < c.currentTime + .2) {
      const st = this.mStep++, d = this.mNext - c.currentTime, bar = (st >> 4) % 4, rt = root + [0, 0, -4, -2][bar];
      const fr = n => 55 * Math.pow(2, (rt + n) / 12);
      if (st % 8 === 0 || st % 16 === 6 || st % 16 === 11) this.tone(fr(0), sd * 2.5, { delay: d, type: 'sawtooth', vol: .09, bus: this.mus });
      if (st % 4 === 2) this.noise(.03, { delay: d, f: 7000, vol: .025 * intensity, type: 'highpass' });
      const h = hash2(st % 32, bar + root);
      if (h < .35 + intensity * .4) this.tone(fr(12 + sc[(st * 3 + (h * 8 | 0)) % 8]) * (h > .2 ? 1 : 2), sd * 1.6, { delay: d, type: 'triangle', vol: .05, bus: this.mus });
      this.mNext += sd;
    }
  }
};
