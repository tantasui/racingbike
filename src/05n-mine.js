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
