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
