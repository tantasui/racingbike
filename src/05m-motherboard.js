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
