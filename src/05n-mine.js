// ============================================================ MOLTEN MINE — mine carts on one rail, three laps over lava.
// This course has its own track graph (rail lanes on a closed loop), its own cart physics and its own rules.
// It plugs into the shell through MINE.newRace / stepRace / camera / hud; the other courses never touch it.
const MINE = {
  L: 1800, LAPS: 3, lanes: [], junc: [], LIM: 11, LEN: 1.75, cps: [10, 310, 735, 970, 1232, 1397, 1580, 1720], tunnels: [[0, 200], [760, 975], [1585, 1800]],
  lavaY: -4, lapLead: 0, slowT: 0, proj: [], slicks: [], ramps: [], picks: [], rocks: [], buckets: [], beams: [], vents: [], trestles: [], loco: { prog: -160, lane: 0, u: 0, v: 0, stun: 0 },
  bendK: 0, steamK: 0, pairS: new Float32Array(36), pairCD: new Float32Array(36)
};
window.MINE = MINE;
const MGRAV = 18;
const MITEMS = [['dynamite', '🧨', 'DYNAMITE'], ['ghost', '👻', 'GHOST CART'], ['grapple', '🪝', 'GRAPPLE HOOK'], ['surge', '🔥', 'COAL SURGE'], ['oil', '🛢', 'OIL SLICK'], ['spare', '🛤', 'SPARE RAIL'], ['lock', '🔒', 'BRAKE LOCK'], ['whistle', '📯', 'STEAM WHISTLE']];

COURSES.push({
  name: 'MOLTEN MINE', sub: 'Mine carts · one rail · three laps over lava', icon: '⛏', root: 2, tempo: 116, mine: true,
  sky: { type: 6, cA: [.016, .007, .006], cB: [.42, .11, .025], cC: [1.6, .55, .1], cD: [1.5, .5, .08] },
  fog: [.13, .04, .016], fogD: .0016, bend: { flat: 1, R: 240, twist: 0, lift: 0 },
  sun: [.2, .9, .3], lightT: [.2, .13, .1], shadowT: [1, .42, .12],
  pal: { road: [.1, .07, .05], road2: [.12, .08, .06], edge: [1.6, .6, .1], edge2: [1.6, .6, .1], ramp: [1.5, 1, .3], sh: [.1, .06, .05], cliff: [.1, .06, .05], deep: [.3, .08, .02], deepGlow: .4, wall: [.1, .07, .06], wall2: [.12, .08, .07], branch: [.1, .07, .05], lava: [1.8, .55, .08] },
  far: { drop: 0, hill: 0, mtn: 0, lo: [0, 0, 0], hi: [0, 0, 0] },
  sc: { tree: { n: 0, near: 0 }, rocks: 0, lights: { n: 0, col: [1, 1, 1] }, clouds: 0, lantern: [2, 1, .3] },
  amb: { col: [1.7, .6, .1], fall: -.7, size: .07 }, hl: [1, .6, .3],
  build() { }
});

// ---------------------------------------------------------------- PHASE 1/2: the track — a closed centre line plus rail lanes offset from it
function mineTrack() {
  const M = MINE; if (M.cx) return; const L = M.L, N = L, EA = 330, EB = 230, NP = 24;
  const dR = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 13, -15, 7, 0, 0, 0, 0, 0, 0, 0, 0, 11, -10];              // radial kinks = the tunnel S-bends
  const H = [30, 30, 28, 24, 20, 17, 15, 14, 14, 13, 13, 12, 12, 12, 11, 11, 12, 12, 12, 12, 13, 17, 22, 27]; // descend out of the start tunnel, climb back at the end
  let sc = 1, smp, len = 0;
  for (let it = 0; it < 4; it++) {
    const fine = []; let acc = 0, lx = EA * sc, lz = 0;
    for (let k = 0; k <= 2400; k++) { const th = k / 2400 * TAU, x = EA * sc * Math.cos(th), z = EB * sc * Math.sin(th); acc += Math.hypot(x - lx, z - lz); lx = x; lz = z; fine.push([x, z, acc, th]); }
    const pts = []; let q = 0;
    for (let i = 0; i < NP; i++) { const tg = i / NP * acc; while (fine[q][2] < tg) q++; const f = fine[q], nx = EB * Math.cos(f[3]), nz = EA * Math.sin(f[3]), nl = Math.hypot(nx, nz); pts.push([f[0] + nx / nl * dR[i], f[1] + nz / nl * dR[i], H[i]]); }
    smp = []; len = 0; let px = 0, py = 0, pz = 0;
    for (let i = 0; i < NP; i++) {
      const p0 = pts[(i + NP - 1) % NP], p1 = pts[i], p2 = pts[(i + 1) % NP], p3 = pts[(i + 2) % NP];
      for (let s = 0; s < 60; s++) {
        const t = s / 60, t2 = t * t, t3 = t2 * t, o = [0, 1, 2].map(a => .5 * (2 * p1[a] + (-p0[a] + p2[a]) * t + (2 * p0[a] - 5 * p1[a] + 4 * p2[a] - p3[a]) * t2 + (-p0[a] + 3 * p1[a] - 3 * p2[a] + p3[a]) * t3));
        if (smp.length) len += Math.hypot(o[0] - px, o[1] - py, o[2] - pz); px = o[0]; py = o[1]; pz = o[2]; smp.push([o[0], o[1], o[2], len]);
      }
    }
    len += Math.hypot(smp[0][0] - px, smp[0][1] - py, smp[0][2] - pz); smp.push([smp[0][0], smp[0][1], smp[0][2], len]);
    if (it < 3) sc *= L / len;
  }
  const cx = M.cx = new Float32Array(N + 1), cy = M.cy = new Float32Array(N + 1), cz = M.cz = new Float32Array(N + 1);
  const hx = M.hx = new Float32Array(N + 1), hz = M.hz = new Float32Array(N + 1), rx = M.rx = new Float32Array(N + 1), rz = M.rz = new Float32Array(N + 1);
  for (let i = 0, q = 0; i <= N; i++) { const tg = i / N * len; while (q < smp.length - 2 && smp[q + 1][3] < tg) q++; const a = smp[q], b = smp[q + 1], t = clamp((tg - a[3]) / Math.max(1e-6, b[3] - a[3]), 0, 1); cx[i] = lerp(a[0], b[0], t); cz[i] = lerp(a[1], b[1], t); cy[i] = lerp(a[2], b[2], t); }
  cx[N] = cx[0]; cy[N] = cy[0]; cz[N] = cz[0];
  for (let i = 0; i <= N; i++) { const ip = (i + 1) % N, im = (i + N - 1) % N, tx = cx[ip] - cx[im], tz = cz[ip] - cz[im], h = Math.hypot(tx, tz); hx[i] = tx / h; hz[i] = tz / h; rx[i] = -tz / h; rz[i] = tx / h; }
  M.ext = [0, 0]; for (let i = 0; i < N; i++) { M.ext[0] = Math.max(M.ext[0], Math.abs(cx[i])); M.ext[1] = Math.max(M.ext[1], Math.abs(cz[i])); }
  M.env = new Uint8Array(N + 1).fill(1); for (const [a, b] of M.tunnels) for (let i = a; i <= b; i++) M.env[i] = 0; // 0 tunnel, 1 open cavern
  // --- lanes: [u, lateral offset (+ = rider's right), height offset] keys, smooth-stepped between
  const LD = [
    { keys: [[350, 0, 0], [395, -5, 0], [400, -5, 0], [440, -2.5, 0], [470, -2.5, 0], [500, -2.5, -3.5], [535, -2.5, -3.5], [565, -2.5, 0], [660, -2.5, 0], [700, 0, 0], [990, 0, 0], [1040, 0, -2], [1170, 0, -2], [1215, 0, 0], [1410, 0, 0], [1455, 0, -3], [1530, 0, -3], [1570, 0, 0]],
      gaps: [[512, 519, 0], [905, 911, 1], [1316, 1322, 0], [1660, 1666, 2]] },
    { a: 350, b: 720, from: 0, to: 0, keys: [[395, 5, 0], [400, 5, 0], [440, 2.5, 0], [470, 2.5, 0], [495, 6, 0], [525, 1.5, 0], [555, 4.5, 0], [580, 2.5, 0], [680, 2.5, 0]] },
    { a: 400, b: 590, from: 0, to: 0, keys: [[440, -9, 0], [495, -17, 0], [545, -9, 0]] },
    { a: 400, b: 650, from: 1, to: 1, keys: [[440, 9, 0], [500, 15, 2.5], [560, 9, 0], [600, 9, 0]] },
    { a: 990, b: 1220, from: 0, to: 0, keys: [[1040, 0, 6.5], [1170, 0, 6.5]], gaps: [[1090, 1098, 0, 1], [1140, 1148, 0, 1]] },
    { a: 1410, b: 1575, from: 0, to: 0, keys: [[1455, 0, 6], [1530, 0, 6]], gaps: [[1485, 1493, 0, 1]] },
    { a: 1250, b: 1390, from: 0, to: 0, keys: [[1310, -14, 0], [1330, -14, 0]] }
  ];
  const offAt = (l, u) => { const K = l.K; if (u <= K[0][0]) return [K[0][1], K[0][2]]; const e = K[K.length - 1]; if (u >= e[0]) return [e[1], e[2]]; let i = 0; while (K[i + 1][0] < u) i++; const a = K[i], b = K[i + 1], t = sstep(a[0], b[0], u); return [lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; };
  M.lanes = LD.map((d, id) => ({ id, a: d.a || 0, b: d.b || L, from: d.from ?? -1, to: d.to ?? -1, keys: d.keys, gaps: (d.gaps || []).map(g => ({ a: g[0], b: g[1], lap: g[2], drop: !!g[3], bridgeT: 0, dyn: false, open: true })) }));
  for (const l of M.lanes) {
    l.K = l.keys.slice(); if (l.id) { l.K.unshift([l.a, ...offAt(M.lanes[l.from], l.a)]); l.K.push([l.b, ...offAt(M.lanes[l.to], l.b)]); }
    const n = l.n = l.b - l.a + 1, F = () => new Float32Array(n);
    l.px = F(); l.py = F(); l.pz = F(); l.tx = F(); l.ty = F(); l.tz = F(); l.k = F(); l.sc = F(); l.ox = F(); l.oy = F();
    for (let j = 0; j < n; j++) { const u = l.a + j, i = u % N, o = offAt(l, u); l.ox[j] = o[0]; l.oy[j] = o[1]; l.px[j] = cx[i] + rx[i] * o[0]; l.py[j] = cy[i] + o[1]; l.pz[j] = cz[i] + rz[i] * o[0]; }
    const hd = F(), W = l.id === 0;
    for (let j = 0; j < n; j++) {
      const jp = W ? (j + 1) % (n - 1) : Math.min(n - 1, j + 1), jm = W ? (j + n - 2) % (n - 1) : Math.max(0, j - 1);
      const dx = l.px[jp] - l.px[jm], dy = l.py[jp] - l.py[jm], dz = l.pz[jp] - l.pz[jm], d = Math.hypot(dx, dy, dz), st = (W || (j > 0 && j < n - 1)) ? 2 : 1;
      l.tx[j] = dx / d; l.ty[j] = dy / d; l.tz[j] = dz / d; l.sc[j] = d / st; hd[j] = Math.atan2(dx, -dz);
    }
    for (let j = 0; j < n; j++) { const jp = W ? (j + 1) % (n - 1) : Math.min(n - 1, j + 1), jm = W ? (j + n - 2) % (n - 1) : Math.max(0, j - 1); l.k[j] = jp === jm ? 0 : angDiff(hd[jp], hd[jm]) / (l.sc[j] * (W || (j > 0 && j < n - 1) ? 2 : 1)); }
    l.len = l.sc.reduce((a, b) => a + b, 0);
  }
  // tunnel gaps sit on the straightest stretch of their window (a gap on a curve cannot be jumped fairly)
  { const l = M.lanes[0], place = (g, lo, hi) => { let best = lo, bk = 1e9; for (let u = lo; u <= hi; u++) { let km = 0; for (let j = u - 3; j < u + 26; j++) km = Math.max(km, Math.abs(l.k[j])); if (km < bk) { bk = km; best = u; } } const len = g.b - g.a; g.a = best; g.b = best + len; };
