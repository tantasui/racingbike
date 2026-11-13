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
    this.oilT = this.lockT = this.blindT = this.stunT = 0; mineLP(M.lanes[lane], u, MQ); this.pos.set(MQ.x, MQ.y, MQ.z); this.ci = Math.round(u) % L; mineFx('respawn', this);
  }
  update(dt, c) {
    const M = MINE, L = M.L;
    for (const k of ['ghostT', 'oilT', 'lockT', 'blindT', 'surgeT', 'invT', 'stunT', 'hazCD', 'boostT', 'lastByT']) if (this[k] > 0) this[k] -= dt;
    for (const g of [this]) if (g.ai.rjCD > 0) g.ai.rjCD -= dt;
    if (this.mode === 2) {
      this.wt -= dt; this.vel.y -= MGRAV * dt; this.pos.addScaledVector(this.vel, dt);
      const fl = M.env[this.ci] === 0 ? M.cy[this.ci] - .45 : -1e9; if (this.pos.y < fl) { this.pos.y = fl; this.vel.y = 0; this.vel.multiplyScalar(Math.max(0, 1 - dt * 5)); }
      if (this.pos.y < M.lavaY - .6) { this.pos.y = M.lavaY - .6; this.vel.set(0, 0, 0); }
      if (this.wt <= 0) this.respawn(); return;
    }
    let acc = c.acc, brake = c.brake, lean = c.lean;
    if (this.lockT > 0) { brake = 0; acc = 1; } if (this.oilT > 0) { brake *= .12; lean = 0; } if (this.stunT > 0) { acc = 0; lean = 0; }
    if (this.fin) { acc = this.v < 12 ? .6 : 0; brake = this.v > 16 ? .4 : 0; }
    this.duck += ((c.duck ? 1 : 0) - this.duck) * Math.min(1, dt * 14);
    if (c.boostHit && this.boost >= 1 && this.boostT <= 0 && this.mode === 0) { this.boost -= 1; this.boostT = 1.7; mineFx('boost', this); }
    if (c.use && this.item) mineUse(this);
    if (c.pL || c.kR) mineShove(this, c.pL ? -1 : 1);
    if (this.mode === 0) this.rail(dt, acc, brake, lean, c); else this.air(dt, lean);
  }
  rail(dt, acc, brake, lean, c) {
    const M = MINE, L = M.L, l = M.lanes[this.lane], P = mineLP(l, this.u, MQ), st = this.stt, v0 = this.v;
    const surge = this.surgeT > 0, boosting = this.boostT > 0, dr = this.draft > .8 ? 1 : 0;
    const vmax = surge ? 42 : boosting ? 37 : (30 + dr * 3) * st.top * this.rb, A0 = surge ? 17 : boosting ? 14 : (9 + dr * 2.5) * st.acc;
    let a = acc * Math.max(0, A0 * (1 - this.v / vmax)) - brake * 15 - MGRAV * P.ty - (.25 + .0006 * this.v * this.v * (dr ? .45 : 1)) - .07 * Math.abs(P.k) * this.v * this.v;
    if (this.v > vmax + 1) a -= 3;
    this.v = Math.max(0, this.v + a * dt); if (acc > 0 && this.v < 2.5 && GM.count <= 0) this.v = 2.5;
    if (this.grap) mineGrapStep(this, dt);
    this.heat += ((brake > .3 && this.v > 5 ? 1 : 0) - this.heat) * Math.min(1, dt * (brake > .3 ? 5 : 1.2));
    let u = this.u + this.v * dt / P.sc; const u0 = this.u;
    for (const J of M.junc) if (J.lane === this.lane && u0 < J.u && u >= J.u) { this.lane = mineSwitch(J, this, c.choice != null ? c.choice : lean < -.3 ? 0 : lean > .3 ? 1 : -1); break; }
    const l2 = M.lanes[this.lane]; if (this.lane !== 0 && u >= l2.b) { this.lane = l2.to; }
    if (this.lane === 0 && u >= L) { u -= L; this.lap++; mineLap(this); }
    this.u = u; this.prog = this.lap * L + u; this.ci = Math.round(u) % L;
    const Q = mineLP(M.lanes[this.lane], u, MQ); this.pos.set(Q.x, Q.y, Q.z); this.fw.set(Q.tx, Q.ty, Q.tz); this.ox = Q.ox; this.kNow = Q.k;
    this.wheel += this.v * dt; this.c0 = v0;
    // tipping: lateral load beyond the limit builds tip; leaning into the curve raises the limit
    const aLat = this.aLat = Q.k * this.v * this.v, lim = M.LIM * st.stab * (this.isP ? 1.4 : 1) + 5 * lean * Math.sign(Q.k || 1) * (Math.abs(aLat) > 2 ? 1 : 0), ex = Math.abs(aLat) - lim;
    if (ex > 0) this.tip -= Math.sign(Q.k) * ex * .2 * dt; else this.tip -= this.tip * Math.min(1, dt * 2.4);
    this.tip += this.tipImp; this.tipImp = 0;
    if (Math.abs(this.tip) >= 1) { this.derail(Math.sign(this.tip), 'tip'); return; }
    // heat from the lava below
    if (M.env[this.ci] && Q.y - M.lavaY < 4.2) this.hurt(9 * dt);
    if (Q.y - M.lavaY < .2) { this.pos.y = Q.y; this.wreck('lava'); return; }
    if (mineGapAt(this.lane, u)) { this.launch(0, 0, 0); return; }
    if (c.jumpHit && this.stunT <= 0 && GM.count <= 0) { const side = Math.abs(lean) > .3 ? Math.sign(lean) : 0; this.launch(8.4, side, side ? 6 : 0); mineFx('jump', this, side); }
  }
  air(dt, lean) {
    const M = MINE, L = M.L, N = L; this.airT += dt; this.vel.y -= MGRAV * dt;
    let bi = this.ci, bd = 1e9; for (let d = -4; d <= 8; d++) { const j = ((this.ci + d) % N + N) % N, dx = this.pos.x - M.cx[j], dz = this.pos.z - M.cz[j], q = dx * dx + dz * dz; if (q < bd) { bd = q; bi = j; } }
    const wrapped = this.ci > N - 40 && bi < 40; this.ci = bi;
    if (!this.tumble) { // in the air, lean sets sideways speed directly; with no lean the cart keeps following the line of the track
      const al = this.vel.x * M.hx[bi] + this.vel.z * M.hz[bi]; let la = this.vel.x * M.rx[bi] + this.vel.z * M.rz[bi]; la += (lean * 4.6 - la) * Math.min(1, dt * 9);
      this.vel.x = M.hx[bi] * al + M.rx[bi] * la; this.vel.z = M.hz[bi] * al + M.rz[bi] * la; }
    this.pos.addScaledVector(this.vel, dt);
    const ex = this.pos.x - M.cx[bi], ez = this.pos.z - M.cz[bi]; this.ox = ex * M.rx[bi] + ez * M.rz[bi]; let uu = bi + ex * M.hx[bi] + ez * M.hz[bi];
    if (wrapped) { this.lap++; mineLap(this); } if (uu < 0) uu += L; if (uu >= L) uu -= L;
    this.u = uu; this.prog = this.lap * L + uu; const hv = Math.hypot(this.vel.x, this.vel.z) || 1; this.fw.set(this.vel.x / hv, 0, this.vel.z / hv); this.v = hv;
    if (!this.tumble && this.vel.y <= 2 && this.airT > .08) {
      let best = -1, bdx = 9, bdd = 0;
      for (const l of M.lanes) { if (l.id && (uu < l.a || uu > l.b)) continue; if (mineGapAt(l.id, uu)) continue; const P = mineLP(l, uu, MQ2), dy = this.pos.y - P.y, dx = this.ox - P.ox; if (dy <= .06 && dy > -.8 && Math.abs(dx) < Math.abs(bdx)) { bdx = dx; best = l.id; bdd = dy; } }
      if (best >= 0 && Math.abs(bdx) < 1.0) {
        if (Math.abs(bdx) < .62) {
          const P = mineLP(M.lanes[best], uu, MQ2); this.mode = 0; this.lane = best; this.u = uu; this.v = Math.max(4, this.vel.x * P.tx + this.vel.y * P.ty * .3 + this.vel.z * P.tz); this.tipImp += clamp(bdx * .55, -.5, .5);
          this.pos.set(P.x, P.y, P.z); const perfect = this.rj && Math.abs(bdx) < .2;
          if (perfect) { this.boost = Math.min(5, this.boost + 1); this.v += 3; }
          if (this.rj) { const n = (this.rjAhead || []).filter(o => o.prog < this.prog).length; if (n) { this.pts.trick += 200 * n; this.best = Math.max(this.best, 200 * n); this.bestN = Math.max(this.bestN, n); } mineFx('land', this, { perfect, passed: n }); } else mineFx('land', this, { hard: this.airT > .5 });
          this.rj = false; return;
        }
        this.tumble = true; this.spin = Math.sign(bdx) * 7; this.vel.y = 3; this.vel.multiplyScalar(.8); mineFx('derail', this, 'land');
      }
    }
    if (M.env[bi] === 0) { if (this.pos.y < M.cy[bi] - .45 || Math.abs(this.ox) > 2.9) { this.pos.y = Math.max(this.pos.y, M.cy[bi] - .45); this.wreck('floor'); return; } }
    if (this.pos.y < M.lavaY + .25 || this.airT > 7) this.wreck('lava');
  }
}

// ---------------------------------------------------------------- PHASE 2: switches & merges
function mineSwitch(J, r, want) {
  let idx;
  if (r.ai) r.ai.plan[J.id] = null;
  if (J.lockT > 0 && r.ghostT <= 0) { idx = J.forced; if (want >= 0 && want !== idx) mineFx('switched', r, J); }
  else {
    idx = r.oilT > 0 ? J.rest : want >= 0 ? want : J.rest;
    if (J.lockT > 0) mineFx('ghostsw', r, J);
    else { J.lockT = 4.5; J.forced = 1 - idx; J.rest = 1 - idx; J.by = r; mineFx('throw', r, J); }
  }
  J.last = J.opts[idx]; return J.opts[idx];
}
function mineLap(r) {
  const M = MINE; if (r.lap >= M.LAPS && !r.fin) { r.fin = true; r.finT = GM.time; mineFx('finish', r); } else if (!r.fin) mineFx('lap', r);
}
MINE.collide = function (dt) {
  const M = MINE, R = GM.racers;
  for (let i = 0; i < R.length; i++) for (let j = i + 1; j < R.length; j++) {
    const a = R[i], b = R[j], key = i * 6 + j; if (M.pairCD[key] > 0) M.pairCD[key] -= dt;
    const d = mineDU(a.u, b.u), sgn = Math.sign(b.prog - a.prog), prev = M.pairS[key]; M.pairS[key] = sgn;
    if (a.mode !== 0 || b.mode !== 0) continue;
    const ghost = a.ghostT > 0 || b.ghostT > 0 || a.invT > 0 || b.invT > 0;
    if (a.lane === b.lane) {
      if (ghost) { if (prev && sgn && prev !== sgn && Math.abs(d) < 4) { const g = sgn > 0 ? b : a; if (g.ghostT > 0) mineFx('ghostpass', g); } continue; }
      if (Math.abs(d) >= M.LEN) continue;
      const f = d >= 0 ? b : a, r = d >= 0 ? a : b, ov = M.LEN - Math.abs(d), rel = r.v - f.v, mf = f.stt.mass, mr = r.stt.mass * (r.surgeT > 0 ? 2.5 : 1);
      r.u -= ov * .5; f.u += ov * .5; if (r.u < 0) r.u += M.L; if (f.lane === 0 && f.u >= M.L) f.u -= .01;
      if (rel > 0) {
        const e = .25, vf = (mf * f.v + mr * r.v + mr * e * rel) / (mf + mr), vr = (mf * f.v + mr * r.v - mf * e * rel) / (mf + mr); f.v = vf; r.v = Math.max(0, vr);
        if (rel > 1.2 && M.pairCD[key] <= 0) {
          M.pairCD[key] = .35; f.lastBy = r; f.lastByT = 2.5;
          if (Math.abs(f.kNow) > .006) f.tipImp -= Math.sign(f.kNow) * Math.min(.7, rel * .09 * mr / mf);   // a shove on a curve tips the cart in front outward
          if (r.surgeT > 0 && rel > 2.5) f.derail(Math.random() < .5 ? -1 : 1, 'ram'); else f.hurt(rel * 1.5, r);
          r.pts.hit += 25; mineFx('ram', r, { f, rel });
        }
      }
    } else if (!ghost && Math.abs(d) < 2 && a.pos.distanceToSquared(b.pos) < 1.7) {
      // merge point: two rails become one and both carts are there — momentum decides who keeps the rail
      const pa = a.stt.mass * a.v * (a.surgeT > 0 ? 2 : 1), pb = b.stt.mass * b.v * (b.surgeT > 0 ? 2 : 1), w = pa >= pb ? a : b, lo = w === a ? b : a;
      mineLP(M.lanes[lo.lane], lo.u, MQ); mineLP(M.lanes[w.lane], w.u, MQ2); lo.lastBy = w; lo.lastByT = 2.5; mineFx('merge', w, lo);
      lo.derail(Math.sign(MQ.ox - MQ2.ox) || 1, 'merge', 4.5); w.v *= .93;
    }
  }
};
function mineShove(r, side) {
  if (r.mode === 2 || r.shCD > GM.time) return; r.shCD = GM.time + .45; const M = MINE, i = r.ci, hit = [];
  for (const o of GM.racers) { if (o === r || o.mode === 2 || o.invT > 0) continue; const dx = o.pos.x - r.pos.x, dy = o.pos.y - r.pos.y, dz = o.pos.z - r.pos.z, al = dx * M.hx[i] + dz * M.hz[i], la = (dx * M.rx[i] + dz * M.rz[i]) * side; if (Math.abs(al) < 2.4 && la > .8 && la < 5 && Math.abs(dy) < 1.8) hit.push(o); }
  for (const o of hit) { o.lastBy = r; o.lastByT = 2.5; if (o.mode === 0) { o.tipImp += side * .62; o.v *= .93; } else { o.vel.x += M.rx[i] * side * 4; o.vel.z += M.rz[i] * side * 4; } o.hurt(12, r); r.pts.hit += 50; }
  mineFx('shove', r, { side, hit: hit.length });
}

// ---------------------------------------------------------------- PHASE 4: power-ups
function mineAhead(r, range, sameLane) { let best = null, bd = range; for (const o of GM.racers) { if (o === r || o.mode === 2 || o.fin) continue; const d = o.prog - r.prog; if (d > .5 && d < bd && (!sameLane || o.lane === r.lane)) { bd = d; best = o; } } return best; }
function mineUse(r) {
  const M = MINE, it = r.item; if (r.mode === 2) return;
  if (it === 'dynamite') { if (r.mode !== 0) return; M.proj.push({ lane: r.lane, u: r.u + 1.6, v: r.v + 24, t: 2.4, by: r, y: 0 }); }
  else if (it === 'ghost') r.ghostT = 5.5;
  else if (it === 'grapple') { const t = mineAhead(r, 48, true); if (!t || r.mode !== 0) { mineFx('nouse', r); return; } r.grap = { t, T: 0 }; t.grapBy = r; }
  else if (it === 'surge') { if (r.mode !== 0) return; r.surgeT = 2.8; }
  else if (it === 'oil') { if (r.mode !== 0) return; M.slicks.push({ lane: r.lane, u: r.u - 2.6, t: 14, by: r }); }
  else if (it === 'spare') { if (r.mode !== 0) return; const g = mineNextGap(r.lane, r.u, 170) || (r.lane ? mineNextGap(0, r.u, 170) : null); if (g) g.bridgeT = 9; else M.ramps.push({ lane: r.lane, u: r.u + Math.max(12, r.v * .65), t: 7, by: r }); }
  else if (it === 'lock') { const t = mineAhead(r, 70, false); if (!t) { mineFx('nouse', r); return; } t.lockT = 4; t.lastBy = r; t.lastByT = 5; mineFx('locked', t, r); }
  else if (it === 'whistle') { for (const o of GM.racers) if (o !== r && o.mode !== 2 && o.pos.distanceTo(r.pos) < 38) { o.blindT = 2; o.stunT = .55; o.tipImp += (Math.random() < .5 ? -1 : 1) * .38; o.lastBy = r; o.lastByT = 2.5; } }
  r.item = null; mineFx('use', r, it);
}
function mineGrapStep(r, dt) {
  const g = r.grap, t = g.t; g.T += dt;
  if (t.mode !== 0 || r.mode !== 0 || g.T > 3.2 || t.prog < r.prog) { r.grap = null; return; }
  if (g.T > .3 && t.c.brake > .5 && t.lockT <= 0) { r.grap = null; t.lastBy = null; r.derail(1, 'grapple'); t.derail(-1, 'grapple'); return; } // they braked while hooked: both wreck
  r.v = Math.max(r.v, Math.min(40, t.v + 10));
  if (t.prog - r.prog < 3.4) { r.grap = null; r.ghostT = Math.max(r.ghostT, 1.1); r.v = t.v + 9; r.boostT = Math.max(r.boostT, 1); mineFx('sling', r, t); }
}
function mineRoll(r) {
  const pos = GM.order.indexOf(r), w = pos <= 0 ? [1, .3, 0, .3, 3, 2, 0, 2.5] : pos >= 4 ? [2, 3, 2.5, 3, .3, 1.5, 2, 1] : [2.5, 1.5, 2, 2, 1.2, 1.5, 2, 1.5];
  let s = w.reduce((a, b) => a + b, 0) * Math.random(); for (let i = 0; i < 8; i++) { s -= w[i]; if (s <= 0) return MITEMS[i][0]; } return 'surge';
}
MINE.stepItems = function (dt) {
  const M = MINE, R = GM.racers;
  for (const p of M.picks) { if (p.t > 0) { p.t -= dt; continue; } for (const r of R) if (r.mode === 0 && r.lane === p.lane && !r.item && Math.abs(r.u - p.u) < 1.4) { r.item = mineRoll(r); p.t = 7; mineFx('pick', r, p); break; } }
  for (let i = M.proj.length - 1; i >= 0; i--) {
    const p = M.proj[i]; p.t -= dt; const l = M.lanes[p.lane], P = mineLP(l, p.u, MQ); let u = p.u + p.v * dt / P.sc;
    for (const J of M.junc) if (J.lane === p.lane && p.u < J.u && u >= J.u) p.lane = J.last;
    if (p.lane && u >= M.lanes[p.lane].b) p.lane = M.lanes[p.lane].to; if (p.lane === 0 && u >= M.L) u -= M.L; p.u = u;
    let hit = null; for (const r of R) if (r !== p.by && r.mode === 0 && r.lane === p.lane && r.ghostT <= 0 && Math.abs(mineDU(p.u, r.u)) < 1.6) hit = r;
    if (hit || p.t <= 0) {
      mineLP(M.lanes[p.lane], p.u, MQ); mineFx('boom', null, MQ);
