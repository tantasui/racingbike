// ============================================================ RIDES: stats + low-poly models (all facing -Z)
// stats: [top speed, acceleration, handling, health, attack, trick speed]
const RIDES = [
  { name: 'MOUNTAIN BIKE', stats: [7, 8, 10, 4, 4, 10], trail: [.15, 1.1, 1.6], css: '#3df', spec: 'TAILWHIP', gm: 1.0, seat: .98, rv: 10, desc: 'Agile and precise. Fastest trick rotation, fragile in a fight.' },
  { name: 'WILD STALLION', stats: [9, 6, 5, 10, 10, 5], trail: [1.5, .25, 1.5], css: '#f5f', spec: 'REAR UP', gm: 1.15, seat: 1.62, rv: 9, desc: 'Toughest ride with the strongest kick. Rapid on straights, drifts wide in turns.' },
  { name: 'STEAMPUNK MACHINATION', stats: [10, 3, 4, 8, 9, 3], trail: [1.7, .6, .08], css: '#fa3', spec: 'BARREL ROLL', gm: 1.35, seat: 1.5, rv: 5, desc: 'Heavy furnace-driven wheel. Rams rivals on contact, fastest down drops, slow to recover.' }
];
const STAT_NAMES = ['TOP SPEED', 'ACCEL', 'HANDLING', 'HEALTH', 'ATTACK', 'TRICK SPD'];
const RCOL = [0xffc93c, 0xff3b5c, 0x3ce07a, 0x3c8cff, 0xff7ad9, 0xa56bff];
const RCSS = ['#ffc93c', '#ff3b5c', '#3ce07a', '#3c8cff', '#ff7ad9', '#a56bff'];
const GEO = {};
function geo(k, f) { return GEO[k] || (GEO[k] = f()); }
function part(p, g, mat, x, y, z, sx = 1, sy = 1, sz = 1) { const m = new THREE.Mesh(g, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.frustumCulled = false; p.add(m); return m; }
const bx = (p, w, h, d, mat, x, y, z) => part(p, geo('box', () => new THREE.BoxGeometry(1, 1, 1)), mat, x, y, z, w, h, d);
const ball = (p, r, mat, x, y, z) => part(p, geo('ico', () => new THREE.IcosahedronGeometry(1, 1)), mat, x, y, z, r, r, r);
function grp(p, x = 0, y = 0, z = 0) { const g = new THREE.Group(); g.position.set(x, y, z); p.add(g); return g; }

function buildRider(col) {
  const g = new THREE.Group(), suit = M(col), dark = M(0x23203a), skin = M(0xffd9b0);
  const torso = grp(g, 0, .1, 0); torso.rotation.x = -.45;
  bx(torso, .42, .56, .26, suit, 0, .3, 0);
  ball(torso, .17, M(0xffffff, col), 0, .74, -.02); bx(torso, .3, .1, .12, dark, 0, .72, -.15);
  const armL = grp(torso, -.26, .5, 0), armR = grp(torso, .26, .5, 0);
  for (const a of [armL, armR]) { const m = bx(a, .11, .52, .11, suit, 0, -.22, -.1); m.rotation.x = .9; bx(a, .13, .13, .13, skin, 0, -.42, -.3); }
  const legL = grp(g, -.14, .08, 0), legR = grp(g, .14, .08, 0);
  for (const l of [legL, legR]) { const m = bx(l, .15, .55, .15, dark, 0, -.24, -.08); m.rotation.x = .35; bx(l, .16, .12, .3, suit, 0, -.5, -.2); }
  return { g, torso, armL, armR, legL, legR };
}
function buildMount(ride, col) {
  const g = new THREE.Group(), o = { g, wheels: [], legs: [], gears: [], seat: RIDES[ride].seat };
  const T = RIDES[ride].trail, glow = MB(T[0] * 1.5, T[1] * 1.5, T[2] * 1.5), tail = MB(3, .25, .15), head = MB(2.6, 2.4, 1.8);
  if (ride === 0) {
    const tg = geo('wheel', () => new THREE.TorusGeometry(.34, .055, 5, 14)), frame = M(col), dark = M(0x18162a);
    for (const z of [-.58, .58]) { const w = grp(g, 0, .39, z); w.rotation.y = PI / 2; const sp = grp(w); part(sp, tg, dark, 0, 0, 0); part(sp, tg, glow, 0, 0, 0, .8, .8, .5); bx(sp, .66, .03, .03, frame, 0, 0, 0); bx(sp, .03, .66, .03, frame, 0, 0, 0); o.wheels.push(sp); }
    let m = bx(g, .07, .07, .95, frame, 0, .72, .02); m.rotation.x = .28;
    m = bx(g, .07, .62, .07, frame, 0, .68, .3); m.rotation.x = .25;
    m = bx(g, .06, .75, .06, frame, 0, .74, -.5); m.rotation.x = -.3;
    bx(g, .56, .05, .05, dark, 0, 1.1, -.4); bx(g, .16, .05, .3, dark, 0, 1.0, .28);
    ball(g, .07, head, 0, 1.0, -.5); ball(g, .07, tail, 0, .88, .5);
  } else if (ride === 1) {
    const hide = M(0x2a1840), mane = glow, hoof = MB(T[0] * 1.3, T[1] * 1.3, T[2] * 1.3);
    o.body = grp(g, 0, 0, 0);
    bx(o.body, .56, .62, 1.55, hide, 0, 1.24, .05);
    let m = bx(o.body, .3, .8, .34, hide, 0, 1.78, -.78); m.rotation.x = -.6;
    m = bx(o.body, .26, .3, .62, hide, 0, 2.12, -1.2); m.rotation.x = .25;
    bx(o.body, .08, .5, .5, mane, 0, 2.0, -.62).rotation.x = -.6;
    m = bx(o.body, .12, .12, .7, mane, 0, 1.3, 1.05); m.rotation.x = -.6;
    bx(o.body, .6, .12, .5, M(col), 0, 1.58, .05);
    ball(o.body, .06, head, .1, 2.2, -1.42); ball(o.body, .06, head, -.1, 2.2, -1.42);
    for (const [x, z] of [[-.2, -.55], [.2, -.55], [-.2, .68], [.2, .68]]) { const l = grp(o.body, x, 1.0, z); bx(l, .14, .9, .14, hide, 0, -.45, 0); bx(l, .17, .14, .2, hoof, 0, -.93, 0); o.legs.push(l); }
    ball(o.body, .06, tail, 0, 1.45, .85);
  } else {
    const brass = M(0xc8862a, 0x3a1c00), iron = M(0x2a2233), fire = MB(3, 1.1, .2);
    const wg = grp(g, 0, 1.3, 0); wg.rotation.y = PI / 2; const sp = grp(wg);
    part(sp, geo('bigwheel', () => new THREE.TorusGeometry(1.2, .13, 6, 22)), brass, 0, 0, 0);
    part(sp, geo('bigwheel2', () => new THREE.TorusGeometry(1.2, .05, 4, 22)), fire, 0, 0, 0, 1, 1, 3.2);
    for (let i = 0; i < 6; i++) { const t = bx(sp, .2, .3, .34, iron, Math.cos(i * PI / 3) * 1.32, Math.sin(i * PI / 3) * 1.32, 0); t.rotation.z = i * PI / 3; }
    o.wheels.push(sp); o.wheelR = 1.3;
    bx(g, .5, .22, 1.2, iron, 0, 1.12, .05); bx(g, .46, .5, .44, brass, 0, 1.0, .62);
    bx(g, .5, .1, .08, fire, 0, .95, .86); bx(g, .5, .1, .08, fire, 0, 1.12, .86); bx(g, .08, .34, .08, fire, .25, 1.0, .7); bx(g, .08, .34, .08, fire, -.25, 1.0, .7);
    const st = part(g, geo('cyl', () => new THREE.CylinderGeometry(.5, .5, 1, 8)), iron, .2, 1.75, .66, .2, .9, .2); o.stack = st;
    for (const x of [-.34, .34]) { const gg = grp(g, x, 1.25, .1); gg.rotation.z = PI / 2; const gm = grp(gg); part(gm, geo('cyl'), brass, 0, 0, 0, .56, .08, .56); for (let i = 0; i < 4; i++) { const t = bx(gm, .78, .07, .12, brass, 0, 0, 0); t.rotation.y = i * PI / 4; } o.gears.push(gm); }
    for (const x of [-.8, .8]) { bx(g, .5, .08, .08, iron, x * .7, .7, .5).rotation.z = x > 0 ? -.7 : .7; const w = grp(g, x, .26, .55); w.rotation.y = PI / 2; const s2 = grp(w); part(s2, geo('wheel', () => new THREE.TorusGeometry(.34, .055, 5, 14)), iron, 0, 0, 0, .7, .7, 1.4); o.wheels.push(s2); }
    ball(g, .09, head, 0, 1.3, -.7); ball(g, .08, tail, 0, 1.3, .88);
  }
  return o;
}
