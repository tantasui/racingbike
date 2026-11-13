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
    place(l.gaps[1], 890, 925); place(l.gaps[3], 1648, 1690); }
  // --- switches. opts = [lane taken by leaning left, lane taken by leaning right]; star = that branch carries power-ups
  M.junc = [
    { u: 350, lane: 0, opts: [0, 1], lab: ['LEFT', 'RIGHT'], star: [0, 0] }, { u: 400, lane: 0, opts: [2, 0], lab: ['LONG', 'SHORT'], star: [0, 1] }, { u: 400, lane: 1, opts: [1, 3], lab: ['SHORT', 'LONG'], star: [1, 0] },
    { u: 990, lane: 0, opts: [4, 0], lab: ['UPPER', 'LOWER'], star: [0, 1], vert: 1 }, { u: 1250, lane: 0, opts: [6, 0], lab: ['LONG', 'SHORT'], star: [0, 1] }, { u: 1410, lane: 0, opts: [5, 0], lab: ['UPPER', 'LOWER'], star: [0, 1], vert: 1 }
  ].map((j, id) => Object.assign(j, { id, rest: 1, lockT: 0, forced: 0, last: j.opts[1] }));
  M.merges = M.lanes.filter(l => l.id).map(l => ({ u: l.b, lane: l.id, to: l.to }));
  // --- collapsing trestles (each owns a gap that opens when the bridge fails)
  const dynGap = (lane, a, b) => { const g = { a, b, lap: 0, drop: false, bridgeT: 0, dyn: true, open: false }; M.lanes[lane].gaps.push(g); return g; };
  M.trestles = [{ lane: 0, a: 225, b: 300, gap: dynGap(0, 262, 269) }, { lane: 1, a: 585, b: 640, gap: dynGap(1, 612, 619) }, { lane: 0, a: 1262, b: 1378, gap: dynGap(0, 1345, 1352) }].map(t => Object.assign(t, { dmg: 0, lastT: -99 }));
  M.pickDef = [[0, 478], [0, 548], [1, 470], [1, 565], [1, 628], [0, 1062], [0, 1112], [0, 1160], [0, 1288], [0, 1365], [0, 1470], [0, 1522]];
  M.rockDef = [[820, 0, 0], [950, 0, 0], [1620, 0, 1], [880, 0, 1], [1700, 0, 2], [1760, 0, 2]].map(([u, lane, lap], i) => ({ u, lane, lap, ph: i * 2.3 }));
  M.bucketDef = [[1075, 0], [1128, 0], [1500, 0]].map(([u, lane], i) => ({ u, lane, ph: i * 1.3 }));
  M.beamDef = [[780, 0, 0], [540, 1, 0], [1640, 0, 0], [935, 0, 1], [1745, 0, 2], [1190, 0, 1]].map(([u, lane, lap]) => ({ u, lane, lap }));
  M.ventDef = [[850, 0, 1, 0], [1600, 0, -1, 0], [530, 0, 1, 1], [1340, 0, -1, 1], [1730, 0, 1, 2]].map(([u, lane, side, lap], i) => ({ u, lane, side, lap, ph: i * 1.7 }));
}
function mineLP(l, u, o) {
  let j = u - l.a; const n = l.n - 1; if (j < 0) j = 0; else if (j > n) j = n; const i = Math.min(n - 1, j | 0), f = j - i, g = 1 - f;
  o.x = l.px[i] * g + l.px[i + 1] * f; o.y = l.py[i] * g + l.py[i + 1] * f; o.z = l.pz[i] * g + l.pz[i + 1] * f;
  o.tx = l.tx[i] * g + l.tx[i + 1] * f; o.ty = l.ty[i] * g + l.ty[i + 1] * f; o.tz = l.tz[i] * g + l.tz[i + 1] * f;
  o.k = l.k[i] * g + l.k[i + 1] * f; o.sc = l.sc[i] * g + l.sc[i + 1] * f; o.ox = l.ox[i] * g + l.ox[i + 1] * f; o.oy = l.oy[i] * g + l.oy[i + 1] * f; return o;
}
// like mineLP but follows the rails backwards / forwards through junctions and merges and across the lap line
function mineLPx(li, u, o) {
  const M = MINE; let l = M.lanes[li], g = 0;
  while (g++ < 6) { if (li === 0) { u = ((u % M.L) + M.L) % M.L; break; } if (u < l.a) li = l.from; else if (u > l.b) li = l.to; else break; l = M.lanes[li]; }
  mineLP(M.lanes[li], u, o); o.lane = li; o.u = u; return o;
}
const mineGapOn = g => g.bridgeT <= 0 && (g.dyn ? g.open : MINE.lapLead >= g.lap);
function mineGapAt(li, u) { for (const g of MINE.lanes[li].gaps) if (u >= g.a && u < g.b && mineGapOn(g)) return g; return null; }
function mineNextGap(li, u, range) { let best = null; for (const g of MINE.lanes[li].gaps) if (mineGapOn(g) && g.a > u - .5 && g.a - u < range && (!best || g.a < best.a)) best = g; return best; }
const mineDU = (a, b) => { const L = MINE.L; return ((b - a) % L + L * 1.5) % L - L / 2; }; // signed distance a -> b along the loop
const MQ = {}, MQ2 = {}, MQ3 = {};

// ---------------------------------------------------------------- the cart: on the rail it is (lane, u, speed, tip); off the rail it is a free body
class MineCart {
  constructor(i, ride, isP) {
    this.i = i; this.isP = isP; this.ride = ride; this.st = { hp: 100 };
    this.stt = [{ acc: 1.1, top: 1, mass: .85, stab: .95 }, { acc: 1, top: 1, mass: 1, stab: 1 }, { acc: .92, top: 1.02, mass: 1.25, stab: 1.08 }][ride];
    this.c = { acc: 0, brake: 0, lean: 0, jumpHit: false, duck: false, use: false, boostHit: false, pL: false, kR: false, choice: null };
    this.pts = { trick: 0, hit: 0, ko: 0 }; this.best = 0; this.bestN = 0; this.kos = 0; this.charge = 0;
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3();
    this.ai = { plan: {}, stuck: 0, err: 0, drop: null, useT: 2 + Math.random() * 4, rjCD: 3 + Math.random() * 3, side: 1 };
    this.lane = 0; this.u = 0; this.v = 0; this.lap = 0; this.prog = 0; this.mode = 0; this.tip = 0; this.tipImp = 0; this.ox = 0; this.ci = 0;
    this.health = 100; this.boost = 1; this.boostT = 0; this.item = null; this.fin = false; this.finT = 0; this.rb = 1;
    this.ghostT = 0; this.oilT = 0; this.lockT = 0; this.blindT = 0; this.surgeT = 0; this.invT = 0; this.stunT = 0; this.hazCD = 0; this.draft = 0; this.grap = null; this.duck = 0;
    this.airT = 0; this.rj = false; this.tumble = false; this.wt = 0; this.wk = ''; this.heat = 0; this.aLat = 0; this.lastBy = null; this.lastByT = 0; this.wheel = 0; this.rock = 0; this.spin = 0; this.sparkT = 0;
    this.fw = new THREE.Vector3(0, 0, -1); this.kNow = 0;
    if (window.mineCartMake) mineCartMake(this);
  }
  dispose() { if (window.mineCartKill) mineCartKill(this); }
  place(lane, u) { this.lane = lane; this.u = u; this.prog = this.lap * MINE.L + u; this.mode = 0; this.v = 0; this.tip = 0; mineLP(MINE.lanes[lane], u, MQ); this.pos.set(MQ.x, MQ.y, MQ.z); this.fw.set(MQ.tx, MQ.ty, MQ.tz); this.ox = MQ.ox; this.ci = Math.round(u) % MINE.L; }
  hurt(d, by) { if (this.invT > 0 || this.mode === 2 || this.fin) return; this.health -= d; if (by) { this.lastBy = by; this.lastByT = 2.5; } if (this.health <= 0) this.derail(Math.random() < .5 ? -1 : 1, 'hp'); }
  // leave the rail under control (hop / rail jump / rolling off a gap)
  launch(vy, lean, kick) {
    const P = mineLP(MINE.lanes[this.lane], this.u, MQ), i = this.ci = Math.round(this.u) % MINE.L, v = this.v + kick;
    this.pos.set(P.x, P.y, P.z); this.vel.set(P.tx * v + MINE.rx[i] * lean * 3.4, P.ty * v + vy, P.tz * v + MINE.rz[i] * lean * 3.4);
    this.mode = 1; this.airT = 0; this.tumble = false; this.rj = kick > 0; this.ai.aim = this.lane; this.tip = 0;
    if (this.rj) { this.rjAhead = GM.racers.filter(o => o !== this && o.prog > this.prog && o.prog - this.prog < 14); }
  }
  // thrown off: tumbling, cannot re-rail
  derail(dir, why, up = 3.2) {
    if (this.mode === 2 || this.invT > 0) return;
    if (this.mode === 0) { const P = mineLP(MINE.lanes[this.lane], this.u, MQ), i = this.ci = Math.round(this.u) % MINE.L; this.pos.set(P.x, P.y + .1, P.z); this.vel.set(P.tx * this.v * .8 + MINE.rx[i] * dir * 4.5, up, P.tz * this.v * .8 + MINE.rz[i] * dir * 4.5); }
    else this.vel.y = Math.max(this.vel.y, up);
    this.mode = 1; this.tumble = true; this.airT = 0; this.spin = dir * (5 + Math.random() * 4); this.grap = null; this.surgeT = 0;
    mineFx('derail', this, why);
    if (this.lastBy && this.lastByT > 0 && this.lastBy !== this) { this.lastBy.kos++; this.lastBy.pts.ko += 300; mineFx('ko', this.lastBy, this); this.lastBy = null; }
  }
  wreck(kind) {
    if (this.mode === 2) return; this.mode = 2; this.wk = kind; this.wt = kind === 'lava' ? 2.4 : kind === 'crush' ? 2.2 : 1.5; this.v = 0; this.grap = null;
    mineFx('wreck', this, kind);
  }
  respawn() {
    const M = MINE, L = M.L; let u = this.u, lane = 0;
    if (this.wk === 'lava') { let best = -1; for (const c of M.cps) if (c <= u && c > best) best = c; u = best < 0 ? Math.min(u, 10) : best; }
    else if (this.wk === 'crush') { u = M.loco.u + 75; if (u >= L) { u -= L; if (this.u > L / 2) this.lap++; } }
    else { let bd = 1e9; for (const l of M.lanes) if (l.id === 0 || (u >= l.a + 2 && u <= l.b - 2)) { mineLP(l, u, MQ); const d = Math.abs(MQ.ox - this.ox) + Math.abs(MQ.y - this.pos.y) * .5; if (d < bd) { bd = d; lane = l.id; } } }
    if (lane === 0) u = ((u % L) + L) % L;
    for (let g = 0; g < 30 && mineGapAt(lane, u); g++) u += 1.5; for (let g = 0; g < 30 && mineGapAt(lane, u + 4); g++) u += 1.5;
    if (lane && u > M.lanes[lane].b - 1) { lane = M.lanes[lane].to; }
    this.lane = lane; this.u = u; this.prog = this.lap * L + u; this.mode = 0; this.v = this.wk === 'crush' ? 20 : 17; this.tip = 0; this.tipImp = 0; this.tumble = false; this.health = 100; this.invT = 2.4; this.spin = 0;
