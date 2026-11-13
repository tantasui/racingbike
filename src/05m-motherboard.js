// ============================================================ MOTHERBOARD course
// A sixth course built on the same engine. Everything here is gated on course.mb so the other five courses are untouched.
// Assets come from public/assets (needs the game served over http: `npm run dev`). Without them it falls back to primitives.
const MB_ZONES = ['BATTERY HEIGHTS', 'POWER WORKS', 'CAPACITOR FOREST', 'PROCESSOR CITY', 'MEMORY LANES', 'PORT RUN'];
const MOBO = {
  A: null, loading: null, failed: false, lanes: null, zb: [], vias: [], caps: [], chips: [], towers: [], logs: [], hot: [], solderZ: [],
  blobs: [], ramps: [], pow: -1, black: 0, blackP: new THREE.Vector3(), slowT: 0, fp: false, zone: -1, fan: 0, leds: null, arcs: null, cards: [],
  snd: { raw: {}, buf: {}, nodes: null, music: null },
};
window.MOBO = MOBO;

// ---------------------------------------------------------------- course definition
COURSES.push({
  name: 'MOTHERBOARD', sub: 'Circuit night · current pulses · vias · capacitor launches', icon: '▦', root: 4, tempo: 128, mb: true,
  sky: { type: 5, cA: [.012, .016, .022], cB: [.035, .06, .068], cC: [1.1, .82, .5], cD: [.25, 1.3, 1.15] },
  fog: [.03, .06, .065], fogD: .0011, bend: { flat: 1 }, // flat world: no tube wrap on the Motherboard
  sun: [-.45, .75, -.5], lightT: [1.05, 1.0, .92], shadowT: [.18, .32, .36],
  pal: { road: [.03, .16, .08], road2: [.04, .2, .1], edge: [1.6, 1.1, .35], edge2: [.4, 1.4, 1.3], ramp: [1.5, 1.0, .3], sh: [.05, .2, .12], cliff: [.06, .14, .12], deep: [.02, .2, .22], deepGlow: .4, wall: [.08, .12, .12], wall2: [.12, .18, .16], branch: [.05, .2, .1], lava: [1.6, .7, .15] },
  far: { flat: 1.2, drop: 0, hill: 0, mtn: 0, lo: [.012, .07, .04], hi: [.012, .07, .04], pcb: 1 },
  sc: { tree: { n: 0, near: 0 }, rocks: 0, lights: { n: 0, col: [.3, .9, .7], clustered: 1 }, clouds: 0, lantern: [.4, 2, 1.8] },
  amb: { col: [.45, 1.5, 1.35], fall: .35, size: .085 }, hl: [.7, 1, .95],
  build(T) {
    // Six zones, one continuous descent. Wide road = open board; the main traces run along it as lanes.
    // sides: 0 board edge (cliff), 1 component wall, 2 live copper bus, 3 open flat board
    const F = { L: 3, R: 3 };
    T.zone('mb0', 640).s(150, 0, -.10, { w: 15 }).s(170, -25, -.14, { w: 15 }).ramp(16, 3, 0).s(150, -25, -.12, { w: 14, ...F }).drop(7).s(170, 10, -.11, { w: 15, ...F }).s(80, 10, -.11, { w: 15, ...F });
    T.cp().zone('mb1', 650).short(-1, 260, 24, 4.5).s(220, 40, -.11, { w: 14, L: 3, R: 2 }).s(120, 40, -.15, { w: 14, L: 3, R: 2 }).zone('solder', 300).s(160, 0, -.11, { w: 15, L: 3, R: 2 }).ramp(14, 2.6).s(150, -30, -.12, { w: 15, ...F }).s(80, -30, -.12, { w: 15, ...F });
    T.cp().zone('mb2', 650).s(170, -30, -.12, { w: 15, ...F }).s(160, 15, -.13, { w: 15, ...F }).ramp(16, 3.2, 16).s(160, 15, -.11, { w: 15, ...F }).s(160, -20, -.12, { w: 15, ...F }).s(80, -20, -.12, { w: 15, ...F });
    T.cp().zone('mb3', 650).s(160, -20, -.10, { w: 15, ...F }).s(170, 25, -.12, { w: 15, ...F }).s(160, 25, -.11, { w: 15, ...F }).drop(8).s(160, 0, -.12, { w: 15, ...F }).s(80, 0, -.12, { w: 15, ...F });
    T.cp().zone('mb4', 650).short(1, 240, 20, 3.4).zone('solder', 260).s(220, 0, -.10, { w: 15, L: 1, R: 3 }).s(160, -30, -.13, { w: 14, ...F }).ramp(16, 3.4, 20).s(120, -30, -.11, { w: 15, ...F }).s(150, 10, -.12, { w: 15, ...F }).s(80, 10, -.12, { w: 15, ...F });
    T.cp().zone('mb5', 760).s(160, 10, -.13, { w: 15, ...F }).drop(9).s(170, -15, -.12, { w: 15 }).ramp(18, 4, 22).s(150, 0, -.10, { w: 15, ...F }).s(110, 0, -.10, { w: 15, ...F }).s(280, 0, -.07, { w: 15, ...F });
  }
});

// ---------------------------------------------------------------- per-track setup (called from buildTerrain, after loadTrack)
function moboSetupTrack() {
  const T = track, N = T.N, rnd = RNG(4242); T.mb = true;
  MOBO.zb = T.zones.filter(z => z.kind.startsWith('mb')).map(z => z.s0); MOBO.zb.push(T.len);
  // --- main traces: 3 lanes per zone, right-angled jogs at 45° with rounded corners, kept in order and apart
  const L = [new Float32Array(N), new Float32Array(N), new Float32Array(N)], LW = [2.3, 1.9, 2.1];
  for (let z = 0; z < 6; z++) {
    const a = Math.round(MOBO.zb[z] / DS), b = Math.min(N - 1, Math.round(MOBO.zb[z + 1] / DS)), zr = RNG(900 + z * 31);
    let cur = [-8, 0, 8], i = a;
    while (i <= b) {
      const hold = Math.round((60 + zr() * 110) / DS);
      for (let q = 0; q < hold && i <= b; q++, i++) for (let k = 0; k < 3; k++) L[k][i] = cur[k];
      const nx = cur.slice(), k = (zr() * 3) | 0, step = (zr() < .5 ? -1 : 1) * (3 + ((zr() * 3) | 0) * 2);
      nx[k] = clamp(nx[k] + step, k === 0 ? -11.5 : nx[k - 1] + 6.5, k === 2 ? 11.5 : nx[k + 1] - 6.5);
      const jl = Math.max(1, Math.round(Math.abs(nx[k] - cur[k]) / DS)); // 45 degrees: lateral change == distance travelled
      for (let q = 1; q <= jl && i <= b; q++, i++) for (let kk = 0; kk < 3; kk++) L[kk][i] = lerp(cur[kk], nx[kk], q / jl);
      cur = nx;
    }
  }
  for (let pass = 0; pass < 2; pass++) for (const l of L) { const c = l.slice(); for (let i = 2; i < N - 2; i++) l[i] = (c[i - 2] + c[i - 1] + c[i] + c[i + 1] + c[i + 2]) / 5; } // round the corners
  for (let i = 0; i < N; i++) { const sc = Math.min(1, (T.wid[i] - 3) / 12); for (const l of L) l[i] *= sc; }
  MOBO.lanes = L; MOBO.laneW = LW;
  const laneAt = (k, s) => arrAt(L[k], s);
  MOBO.laneAt = laneAt;
  const freeD = (s, avoid = 1.4) => { // a spot on open board between traces
    const w = arrAt(T.wid, s) - 1.4, opts = [];
    for (let d = -w; d <= w; d += .5) { let ok = true; for (let k = 0; k < 3; k++) if (Math.abs(d - laneAt(k, s)) < LW[k] + avoid) ok = false; if (ok) opts.push(d); }
    return opts.length ? opts[(rnd() * opts.length) | 0] : 0;
  };
  // --- features (explicit positions, then checked against ramps / gaps / drops)
  const clear = (s, r) => { for (let q = -r; q <= r; q += 2) { const j = clamp(Math.round((s + q) / DS), 0, N - 1); if (T.gap[j] || T.rampF[j]) return false; } for (const l of T.lips) if (Math.abs(l - s) < r) return false; return true; };
  const zs = z => MOBO.zb[z];
  MOBO.vias = []; for (const [s0, s1] of [[zs(3) + 190, zs(3) + 380], [zs(4) + 60, zs(4) + 250]]) if (clear(s0, 10) && clear(s1, 10)) MOBO.vias.push({ s0, d0: freeD(s0, 1.6), s1, d1: freeD(s1, 1.6), r: 2.5 });
  MOBO.caps = []; for (const s of [zs(0) + 420, zs(1) + 560, zs(2) + 70, zs(2) + 250, zs(2) + 540, zs(4) + 430, zs(5) + 120]) if (clear(s, 14)) MOBO.caps.push({ s, d: freeD(s, 1.5), r: 2.4, ch: 1 });
  MOBO.chips = []; for (const s of [zs(3) + 95, zs(3) + 560, zs(5) + 430]) if (clear(s, 26)) MOBO.chips.push({ s });
  MOBO.towers = [];
  for (let s = zs(2) + 30; s < zs(3) - 20; s += 38 + rnd() * 30) if (clear(s, 6) && !MOBO.caps.some(c => Math.abs(c.s - s) < 18)) { const d = freeD(s, 2.6); if (Math.abs(d) < arrAt(T.wid, s) - 3) MOBO.towers.push({ s, d, r: 1.5 + rnd() * .5 }); }
  MOBO.logs = []; for (let s = zs(0) + 80; s < T.fin - 60; s += 120 + rnd() * 140) if (clear(s, 6)) { const d = freeD(s, 1.2); MOBO.logs.push({ s, d, len: 3 + rnd() * 2, r: .32 }); }
  MOBO.hot = T.shorts.filter(sh => !sh.hidden && sh.s0 >= zs(1) - 5 && sh.s0 < zs(2)).map(sh => ({ s0: sh.s0, s1: sh.s1, side: sh.side }));
  MOBO.solderZ = T.zones.filter(z => z.kind === 'solder');
  // speed pads / kicks from the generic placer must not land on top of the new features
  const busy = s => MOBO.caps.some(c => Math.abs(c.s - s) < 20) || MOBO.chips.some(c => Math.abs(c.s - s) < 40) || MOBO.vias.some(v => Math.abs(v.s0 - s) < 15 || Math.abs(v.s1 - s) < 15);
  T.pads = T.pads.filter(p => !busy(p.s)); T.kicks = T.kicks.filter(k => !busy(k.s0 + k.len));
  T.fixedKicks = T.kicks.length;
