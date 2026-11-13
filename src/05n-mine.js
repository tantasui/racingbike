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
