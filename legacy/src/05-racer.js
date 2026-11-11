// ============================================================ RACER: physics, tricks, combat (shared by player and AI)
const GRAV = 18;
const GM = { state: 'boot', demo: true, racers: [], player: null, time: 0, count: 0, ride: 0, course: 0, diff: 1, built: -1, order: [], finWait: 0, white: 0, pairCD: new Float32Array(36), boulders: [], aval: [], t: 0 };
const cam = { yaw: 0, y: 0, roll: 0, fov: 70, shake: 0, flash: 0, init: false, orbit: 0 };
const G0 = {}, G1 = {}, G2 = {}, TP0 = {}, TP1 = {};
let shadowMat = null;

function slopeAt(s, d, span = 1.2) {
  ground(s + span, d, G1); ground(s - span, d, G2);
  const sl = (G1.void || G2.void) ? (arrAt(track.cy, s + span) - arrAt(track.cy, s - span)) / (2 * span) : (G1.y - G2.y) / (2 * span);
  return clamp(sl, -.9, .9);
}
function nearLip(s) { for (const l of track.lips) { if (l > s + 9) return false; if (l >= s - 1) return true; } return false; }
function estAir(r) { // ballistic look-ahead: how long until this racer touches down
  let y = r.y, vy = r.vy, s = r.s; const ds = r.v * Math.cos(r.beta) * .1;
  for (let t = .1; t < 5; t += .1) { vy -= GRAV * .1; y += vy * .1; s += ds; ground(s, r.d, G1); if (!G1.void && y <= G1.y) return t; if (y < G1.h - 14) return t; }
  return 5;
}

class Racer {
  constructor(i, ride, isP) {
    this.i = i; this.isP = isP; this.ride = ride; const R = RIDES[ride], S = R.stats;
    this.st = { vmax: 30 + S[0], acc: 2.5 + .75 * S[1], hand: S[2], hp: 40 + 12 * S[3], dmg: 4 * S[4], trick: S[5], gm: R.gm, rv: R.rv };
    this.c = { steer: 0, acc: 0, brake: 0, jump: false, flipF: false, flipB: false, spec: false, pL: false, kR: false, boost: false, reset: false };
    this.ai = { lane: (Math.random() - .5) * 5, ph: Math.random() * 9, plan: null, sh: null, take: false, jumper: Math.random() < .6 };
    this.root = new THREE.Group(); this.root.rotation.order = 'YXZ'; this.pivot = grp(this.root, 0, 1, 0); this.pivot.rotation.order = 'YXZ'; this.body = grp(this.pivot, 0, -1, 0);
    this.mount = buildMount(ride, RCOL[i]); this.body.add(this.mount.g);
    this.rider = buildRider(RCOL[i]); this.seatZ = ride === 0 ? .14 : .05; this.rider.g.position.set(0, this.mount.seat, this.seatZ); this.body.add(this.rider.g);
    scene.add(this.root);
    if (!shadowMat) shadowMat = patch(new THREE.MeshBasicMaterial({ color: 0x05030f, transparent: true, opacity: .42, depthWrite: false }));
    this.shadow = new THREE.Mesh(geo('disc', () => { const g = new THREE.CircleGeometry(1, 12); g.rotateX(-PI / 2); return g; }), shadowMat); this.shadow.frustumCulled = false; this.shadow.renderOrder = 5; scene.add(this.shadow);
    this.trail = new Trail(R.trail);
    this.rag = new THREE.Group(); this.rag.rotation.order = 'YXZ'; scene.add(this.rag);
  }
  dispose() { scene.remove(this.root); scene.remove(this.shadow); scene.remove(this.rag); this.trail.dispose(); }
  place(s, d) {
    Object.assign(this, { s, d, vy: 0, v: 0, a: 0, beta: 0, air: false, airT: 0, spin: 0, flip: 0, spec: 0, charge: 0, boost: 0, boostT: 0, health: this.st.hp, state: 0, downT: 0, cool: 0, inv: 0, atkT: 0, atkSide: 0, flash: 0, push: 0, fin: false, finT: 0, pts: { trick: 0, hit: 0, ko: 0 }, best: 0, bestN: 0, kos: 0, crashes: 0, cpI: 0, cpS: s, rb: 1, wheel: 0, lean: 0, pitch: 0, hoof: 0, steerSm: 0, crashKind: '', surf: 0, zf: 0, hadTrick: false });
    this.y = ground(s, d, G0).y; this.unrag();
    tpos(s, d, TP0); this.trail.reset(TP0.x, this.y, TP0.z);
  }
  addBoost(n) { this.boost = Math.min(5, this.boost + n); }
  // ------------------------------------------------------------ main step
  update(dt, c) {
    const T = track, st = this.st;
    this.cool = Math.max(0, this.cool - dt); this.inv = Math.max(0, this.inv - dt); this.atkT = Math.max(0, this.atkT - dt); this.flash = Math.max(0, this.flash - dt);
    if (this.state === 1) { this.downUpdate(dt); return; }
    this.health = Math.min(st.hp, this.health + 3 * dt);
    if (c.reset && !this.air) { this.crashKind = 'reset'; this.respawn(); return; }
    if (c.boost && this.boost >= 1 && this.boostT < .3) { this.boost -= 1; this.boostT += 2; evt('boost', this); }
    if (this.boostT > 0) this.boostT -= dt;
    const boosting = this.boostT > 0, vmax = st.vmax * this.rb * (boosting ? 1.3 : 1);
    this.steerSm += (c.steer - this.steerSm) * Math.min(1, dt * 9);
    ground(this.s, this.d, G0); this.surf = G0.surf; this.zf = T.zf[G0.i];
    if (!this.air) {
      const sl = slopeAt(this.s, this.d), sn = sl / Math.sqrt(1 + sl * sl);
      let acc = -13 * st.gm * sn - .0021 * this.v * this.v - .3;
      const soft = this.surf === 2 ? .55 : 1;
      if (c.acc) acc += st.acc * this.rb * soft * Math.max(0, 1 - this.v / vmax) * (this.v < 6 ? 1.6 : 1);
      if (this.surf === 2) acc -= this.v * .035;
      if (boosting && this.v < vmax) acc += 12;
      if (c.brake) acc -= 16;
      if (this.v > vmax) acc -= (this.v - vmax) * 2;
      this.v = Math.max(0, this.v + acc * dt);
      const rate = (1 + st.hand * .14) / (1 + this.v / 50);
      // progressive steering: taps make small corrections, holding builds to full lock; gentle self-alignment with the trail when released
      this.hold = c.steer ? Math.min(1, (this.hold || 0) + dt / .38) : 0;
      this.a += this.steerSm * rate * (.5 + .5 * this.hold) * dt * Math.min(1, this.v / 4);
      if (!c.steer && this.isP) this.a -= this.a * Math.min(1, 1.1 * dt);
      const grip = (2.5 + st.hand * .9) * (this.surf === 1 ? .12 : 1);
      this.beta += (this.a - this.beta) * (1 - Math.exp(-grip * dt));
      this.a = clamp(this.a, this.beta - .9, this.beta + .9);
      // attacks
      if (c.pL) this.attack(-1); else if (c.kR) this.attack(1);
    }
    this.a = clamp(this.a, -1.35, 1.35); this.beta = clamp(this.beta, -1.35, 1.35);
    // --- move in track space
    const k = kapAt(this.s), den = Math.max(.3, 1 - this.d * k);
    const ds = this.v * Math.cos(this.beta) / den * dt;
    this.s = Math.min(T.len - 8, this.s + ds); this.d += (this.v * Math.sin(this.beta) + this.push) * dt; this.a -= k * ds; this.beta -= k * ds;
    this.push *= Math.exp(-6 * dt);
    if (this.s >= T.len - 8.5) this.v = 0;
    ground(this.s, this.d, G0);
    if (G0.wall) {
      this.d -= G0.wall * (G0.e - 1);
      if (G0.wall * this.beta > 0) { const hitA = Math.abs(Math.sin(this.beta)); this.v *= 1 - Math.min(.45, hitA * .9); this.beta = -this.beta * .25; this.a *= .4; if (hitA > .12) evt('wall', this, hitA); }
      this.push = 0; ground(this.s, this.d, G0);
    }
    // --- vertical
    if (!this.air) {
      if (G0.lava) { this.crash('lava'); return; }
      for (const p of T.pools) if (Math.abs(p.s - this.s) < p.r && Math.hypot(p.s - this.s, p.d - this.d) < p.r) { this.crash('lava'); return; }
      const yb = this.y + this.vy * dt - .5 * GRAV * dt * dt;
      if (G0.void || G0.y < yb - .12) { this.air = true; this.airT = 0; this.y = yb; this.vy -= GRAV * dt; this.takeoff(); }
      else { this.vy = clamp((G0.y - this.y) / dt, -45, 45); this.y = G0.y; }
      if (!this.air) {
        if (c.jump) this.charge = Math.min(1, this.charge + dt / .55);
        else if (this.charge > 0) {
          const lip = nearLip(this.s) && this.v > 12;
          this.vy = Math.max(this.vy, -2) + 5.5 + 6 * this.charge + (lip ? 4.5 : 0); this.charge = 0; this.air = true; this.airT = 0; this.y += .05;
          evt('jump', this, lip); this.takeoff();
        }
      }
    } else {
      this.airT += dt; this.vy -= GRAV * dt; this.y += this.vy * dt; this.charge = 0;
      const ts = st.trick, sr = 2.6 + ts * .5, fr = 2.2 + ts * .42, pr = .5 + ts * .09;
      if (c.steer) this.spin += c.steer * sr * dt; else this.spin = approach(this.spin, Math.round(this.spin / PI) * PI, sr * .45 * dt);
      const fd = (c.flipB ? 1 : 0) - (c.flipF ? 1 : 0);
      if (fd) this.flip += fd * fr * dt; else this.flip = approach(this.flip, Math.round(this.flip / TAU) * TAU, fr * .45 * dt);
      if (c.spec) this.spec += pr * dt; else { const fpart = this.spec - Math.floor(this.spec); if (fpart > .001) this.spec = approach(this.spec, fpart > .25 ? Math.ceil(this.spec) : Math.floor(this.spec), pr * .6 * dt); }
      if (!G0.void && this.y <= G0.y) this.land();
      else if (this.y < G0.h - 15) this.crash('fall');
    }
    // --- progress: checkpoints / finish
    while (this.cpI + 1 < T.cps.length && this.s >= T.cps[this.cpI + 1]) { this.cpI++; this.cpS = T.cps[this.cpI]; evt('cp', this); }
    if (!this.fin && this.s >= T.fin) { this.fin = true; this.finT = GM.time; evt('finish', this); }
  }
  takeoff() { this.ai.plan = null; this.hadTrick = false; if (!this.isP || GM.demo) planTrick(this); }
  tally() {
    const names = []; let pts = 0, n = 0;
    const sp = Math.round(Math.abs(this.spin) / PI), fl = Math.round(Math.abs(this.flip) / TAU), sc = Math.round(this.spec);
    if (sp > 0) { names.push(sp * 180 + ' SPIN'); pts += 100 * sp * (1 + .25 * (sp - 1)); n++; }
    if (fl > 0) { names.push((fl > 1 ? ['', '', 'DOUBLE ', 'TRIPLE '][Math.min(3, fl)] : '') + (this.flip < 0 ? 'FRONT FLIP' : 'BACK FLIP')); pts += 350 * fl * (1 + .3 * (fl - 1)); n += fl; }
    if (sc > 0) { names.push((sc > 1 ? sc + 'x ' : '') + RIDES[this.ride].spec); pts += 250 * sc; n += sc; }
    if (n && this.airT > 2.2) { names.push('BIG AIR'); pts += 150; }
    return { names, n, pts: Math.round(pts * (1 + .5 * Math.max(0, n - 1))) };
  }
  land() {
    const sl = slopeAt(this.s + 1.5, this.d, 1.5), vn = this.vy - this.v * Math.cos(this.beta) * sl;
    const sr = Math.abs(this.spin - Math.round(this.spin / PI) * PI), fr = Math.abs(this.flip - Math.round(this.flip / TAU) * TAU), pr = Math.abs(this.spec - Math.round(this.spec));
    const bad = (fr > .61 || sr > .9 || pr > .28) ? 2 : (fr > .32 || sr > .5 || pr > .13 || vn < -34) ? 1 : 0;
    const t = this.tally(), big = this.airT > .45;
    this.air = false; this.y = G0.y; this.vy = this.v * sl;
    if (bad === 2) { this.spin = this.flip = this.spec = 0; this.crash('wipeout'); return; }
    this.spin = this.flip = this.spec = 0;
    if (big) evt('land', this, clamp(-vn / 22, .15, 1));
    if (t.pts > 0) { this.pts.trick += t.pts; if (t.pts > this.best) { this.best = t.pts; this.bestN = t.n; } this.addBoost(t.pts / 300); evt('trick', this, t); }
    if (bad === 1) { this.v *= .7; evt('sloppy', this); } else if (t.pts > 0 || this.airT > .9) evt('clean', this, t);
  }
  attack(side) {
    if (this.cool > 0) return; this.cool = .5; this.atkT = .3; this.atkSide = side; evt('swing', this);
    if (this.ride === 2) this.push += side * 4;
    let best = null, bd = 9;
    for (const o of GM.racers) { if (o === this || o.state) continue; const ds = Math.abs(o.s - this.s), dd = (o.d - this.d) * side; if (ds < 2.8 && dd > .15 && dd < 3.1 && Math.abs(o.y - this.y) < 2 && dd < bd) { bd = dd; best = o; } }
    if (best) best.hitBy(this, this.st.dmg, side);
  }
  hitBy(att, dmg, side) {
    if (this.inv > 0 || this.state) return;
    this.health -= dmg; this.v *= .82; this.push += side * 5; this.flash = .3; att.pts.hit += 100; att.addBoost(1); evt('hit', att, this);
    if (this.health <= 0) { att.pts.ko += 500; att.kos++; att.boost = 5; this.crash('ko'); evt('ko', att, this); }
  }
  crash(kind) {
    if (this.state) return;
    if (this.inv > 0 && kind !== 'fall' && kind !== 'lava') return;
    this.state = 1; this.crashKind = kind; this.downT = kind === 'ko' ? 3 : kind === 'fall' ? 2.6 : kind === 'lava' ? 1.7 : 2;
    this.boost = Math.max(0, Math.floor(this.boost) - 1); this.boostT = 0; this.spin = this.flip = this.spec = 0; this.charge = 0; this.crashes++; this.crashS = this.s;
    // rider is a separate body: throw it clear of the mount
    tpos(this.s, this.d, TP0);
    this.rs = this.s; this.rd = this.d; this.ry = this.y + 1.2; this.rvs = this.v * Math.cos(this.beta) * .8; this.rvd = this.v * Math.sin(this.beta) + (Math.random() - .5) * 6; this.rvy = 6 + Math.random() * 3; this.rspin = 7 + Math.random() * 6;
    this.rag.add(this.rider.g); this.rider.g.position.set(0, -.3, 0); this.rag.visible = true;
    evt('crash', this, kind);
  }
  unrag() { this.body.add(this.rider.g); this.rider.g.position.set(0, this.mount.seat, this.seatZ); this.rider.g.rotation.set(0, 0, 0); this.rag.visible = false; }
  downUpdate(dt) {
    this.downT -= dt; this.v *= Math.exp(-2.5 * dt);
    this.s = Math.min(track.len - 8, this.s + this.v * Math.cos(this.beta) * dt); this.d += this.v * Math.sin(this.beta) * dt;
    ground(this.s, this.d, G0);
    if (G0.wall) { this.d -= G0.wall * (G0.e - 1); this.beta = 0; ground(this.s, this.d, G0); }
    if (this.air || G0.void) { this.vy -= GRAV * dt; this.y += this.vy * dt; this.air = true; if (!G0.void && this.y <= G0.y) { this.y = G0.y; this.air = false; this.vy = 0; } if (this.y < G0.h - 70) { this.y = G0.h - 70; this.vy = 0; } }
    else this.y = G0.y;
    this.rs += this.rvs * dt; this.rd += this.rvd * dt; this.rvy -= GRAV * dt; this.ry += this.rvy * dt;
    ground(this.rs, this.rd, G1);
    if (G1.wall) { this.rd -= G1.wall * (G1.e - 1); this.rvd *= -.4; }
    if (!G1.void && this.ry < G1.y + .35) { this.ry = G1.y + .35; if (this.rvy < -4) { this.rvy *= -.42; evt('bounce', this); } else this.rvy = 0; const f = Math.exp(-3 * dt); this.rvs *= f; this.rvd *= f; this.rspin *= f; }
    if (this.downT <= 0) this.respawn();
  }
  respawn() {
    const T = track, kind = this.crashKind; let s = this.s;
    if (kind === 'fall' && this.lastFallCp === this.cpI) { // mercy rule: second fall from the same checkpoint -> set down past the obstacle
      for (s = this.crashS + 30; s < T.len - 120; s += 3) { ground(s, 0, G0); let ok = !G0.void && !T.rampF[G0.i]; for (let q = 0; ok && q < 70; q += 4) if (T.gap[clamp(Math.round((s + q) / DS), 0, T.N - 1)]) ok = false; if (ok) break; }
      this.lastFallCp = -1;
    }
    else if (kind === 'fall') { s = this.cpS + 4; this.lastFallCp = this.cpI; this.ai.noSh = this.ai.sh; }
    else { // nearest solid, hazard-free ground at or behind the crash point
      s = Math.max(this.cpS + 2, this.crashS !== undefined && kind !== 'reset' ? Math.min(this.s, this.crashS + 30) : this.s);
      for (let n = 0; n < 60; n++) { ground(s, 0, G0); let ok = !G0.void && !T.rampF[G0.i]; for (const p of T.pools) if (Math.abs(p.s - s) < p.r + 3 && Math.abs(p.d) < p.r + 1.5) ok = false; if (ok) break; s -= 3; }
      s = Math.max(4, s);
    }
    this.s = s; this.d = 0; this.a = this.beta = 0; this.v = this.st.rv; this.y = ground(s, 0, G0).y; this.vy = 0; this.air = false; this.airT = 0;
    this.health = this.st.hp; this.inv = 2; this.state = 0; this.push = 0; this.steerSm = 0; this.unrag();
    tpos(s, 0, TP0); this.trail.reset(TP0.x, this.y, TP0.z);
    evt('respawn', this, kind);
  }
  // ------------------------------------------------------------ visuals
  vis(dt) {
    const T = track, down = this.state === 1; tpos(this.s, this.d, TP0);
    const yaw = TP0.th + this.a, fx = Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = Math.sin(yaw);
    this.root.position.set(TP0.x, this.y, TP0.z);
    ground(this.s, this.d, G0);
    const sl = this.air ? clamp(this.vy / Math.max(this.v, 8), -.7, .7) * .5 : slopeAt(this.s, this.d, 1.6);
    this.pitch += (Math.atan(sl) - this.pitch) * Math.min(1, dt * (this.air ? 4 : 14));
    const leanT = down ? 1.35 : -this.steerSm * .38 * Math.min(1, this.v / 15) - clamp((this.a - this.beta) * .8, -.4, .4);
    this.lean += (leanT - this.lean) * Math.min(1, dt * (down ? 6 : 8));
    this.root.rotation.set(this.pitch, -yaw, 0);
    const sp = this.spec, m = this.mount;
    let roll = this.lean, flip = this.flip;
    m.g.rotation.set(0, 0, 0);
    if (this.ride === 0) m.g.rotation.y = sp * TAU;
    else if (this.ride === 1) { const q = Math.sin((sp - Math.floor(sp)) * PI); m.g.rotation.x = q * .9; this.rider.g.rotation.x = down ? 0 : q * .5; if (!down) this.rider.g.position.set(0, m.seat + q * .25, this.seatZ + q * .7); }
    else roll += sp * TAU;
    this.pivot.rotation.set(flip, -this.spin, roll);
    // mount animation
    const dist = this.v * dt; this.wheel += dist;
    if (this.ride === 0) for (const w of m.wheels) w.rotation.z = -this.wheel / .39;
    else if (this.ride === 2) { m.wheels[0].rotation.z = -this.wheel / 1.3; m.wheels[1].rotation.z = m.wheels[2].rotation.z = -this.wheel / .3; for (const g of m.gears) g.rotation.y = this.wheel * 1.2; }
    else { const ph = this.wheel * .85, amp = this.air ? .5 : Math.min(.95, this.v / 14); m.legs.forEach((l, i) => { l.rotation.x = Math.sin(ph + [0, .9, PI, PI + .9][i]) * amp; }); m.body.position.y = this.air ? 0 : Math.abs(Math.sin(ph)) * .12 * Math.min(1, this.v / 10); }
    // rider pose
    const R = this.rider;
    if (!down) {
      const k = this.atkT > 0 ? Math.sin((1 - this.atkT / .3) * PI) : 0;
      R.armL.rotation.z = this.atkSide < 0 ? -1.5 * k : 0; R.armL.rotation.x = this.atkSide < 0 ? -.8 * k : 0;
      R.legR.rotation.z = this.atkSide > 0 ? 1.35 * k : 0;
      R.torso.rotation.x = -.45 - this.charge * .35 + (this.air ? .2 : 0); R.torso.rotation.z = -this.atkSide * k * .3;
      if (this.ride !== 1) R.g.position.y = m.seat - this.charge * .12;
      this.root.visible = !(this.inv > 0 && Math.sin(GM.t * 40) > .3);
    } else {
      this.root.visible = true; tpos(this.rs, this.rd, TP1);
      this.rag.position.set(TP1.x, this.ry, TP1.z); this.rag.rotation.x += this.rspin * dt; this.rag.rotation.z += this.rspin * .6 * dt; this.rag.rotation.y = -TP1.th;
      const fl = Math.sin(GM.t * 18) * .9; R.armL.rotation.z = -1 + fl; R.legR.rotation.z = 1 - fl;
    }
    // shadow
    if (G0.void || down) this.shadow.visible = false;
    else { this.shadow.visible = true; const hgt = this.y - G0.y, sc = Math.max(.25, 1 - hgt * .05); this.shadow.position.set(TP0.x, G0.y + .06, TP0.z); this.shadow.rotation.set(Math.atan(slopeAt(this.s, this.d, 1.6)), -yaw, 0, 'YXZ'); this.shadow.scale.set(.75 * sc, 1, 1.25 * sc); }
    // light trail (per-ride colour)
    const hw = this.ride === 2 ? .5 : this.ride === 1 ? .32 : .16, bxp = TP0.x - fx * .7, bzp = TP0.z - fz * .7, ty = this.y + .14;
    this.trail.push(bxp - rx * hw, ty, bzp - rz * hw, bxp + rx * hw, ty, bzp + rz * hw, dt);
    this.trail.mat.uniforms.uI.value = down ? 0 : clamp(this.v / 22, 0, 1.2) * (this.boostT > 0 ? 1.5 : .55);
    // headlight pool
    const hl = uHL.value[this.i]; ground(this.s + 7, this.d, G1);
    hl.set(TP0.x + fx * 7, (G1.void ? this.y : G1.y), TP0.z + fz * 7, down ? 0 : (this.isP ? 1 : .55));
    // ground fx
    const tc = RIDES[this.ride].trail, ac = course.amb.col;
    if (!down && !this.air && this.v > 6) {
      if (this.ride === 1) { this.hoof += dist; if (this.hoof > 2.1) { this.hoof = 0; this.hoofSide = -(this.hoofSide || 1); decal(TP0.x - fx * .4 + rx * .28 * this.hoofSide, this.y, TP0.z - fz * .4 + rz * .28 * this.hoofSide, yaw, sl, .5, .6, tc[0] * 1.4, tc[1] * 1.4, tc[2] * 1.4, 2.4); } }
      if (Math.random() < dt * (10 + this.v * .6)) spawnP(bxp + rx * (Math.random() - .5) * .6, this.y + .15, bzp + rz * (Math.random() - .5) * .6, -fx * this.v * .15 + (Math.random() - .5) * 2, 1 + Math.random() * 2, -fz * this.v * .15 + (Math.random() - .5) * 2, .5 + Math.random() * .4, .22 + (this.zf & 8 ? .3 : 0), ac[0] * .7, ac[1] * .7, ac[2] * .7, 3);
      if (this.surf === 1 && Math.abs(this.a - this.beta) > .08 && Math.random() < dt * 40) spawnP(bxp, this.y + .1, bzp, (Math.random() - .5) * 4, 2, (Math.random() - .5) * 4, .4, .15, .8, 1.4, 1.6, 6);
    }
    if (this.boostT > 0 && !down) for (let n = 0; n < 2; n++) spawnP(bxp + (Math.random() - .5) * .4, this.y + .5 + Math.random() * .5, bzp + (Math.random() - .5) * .4, -fx * 6 + (Math.random() - .5) * 3, Math.random() * 2, -fz * 6 + (Math.random() - .5) * 3, .45, .32, tc[0] * 1.6 + .4, tc[1] * 1.6 + .2, tc[2] * 1.6, -1);
    if (this.ride === 2 && !down && Math.random() < dt * 14) spawnP(TP0.x + fx * -.66 + rx * .2, this.y + 2.3, TP0.z + fz * -.66 + rz * .2, -fx * 2, 2.5, -fz * 2, .8, .5, .5, .3, .25, -1.5);
  }
}
function approach(x, t, st) { return Math.abs(t - x) <= st ? t : x + Math.sign(t - x) * st; }

// ============================================================ AI
const DIFFS = [
  { name: 'EASY', skill: .9, corner: .8, aggr: .2, pShort: .15, pHid: 0, trickP: .3 },
  { name: 'NORMAL', skill: .965, corner: .9, aggr: .5, pShort: .4, pHid: .1, trickP: .55 },
  { name: 'HARD', skill: 1.03, corner: .97, aggr: .85, pShort: .7, pHid: .15, trickP: .8 }
];
function planTrick(r) {
  const D = DIFFS[GM.diff], st = r.st; if (Math.random() > D.trickP) return;
  const t = estAir(r) * .78, ts = st.trick, opts = [];
  const sr = 2.6 + ts * .5, fr = 2.2 + ts * .42, pr = .5 + ts * .09;
  if (PI / sr < t) opts.push({ t: 'spin', amt: PI, dir: Math.random() < .5 ? -1 : 1 });
  if (TAU / sr < t) opts.push({ t: 'spin', amt: TAU, dir: Math.random() < .5 ? -1 : 1 });
  if (TAU / fr < t) opts.push({ t: 'flip', amt: TAU, dir: Math.random() < .5 ? -1 : 1 });
  if (1 / pr < t) opts.push({ t: 'spec', amt: 1 });
  if (2 * TAU / sr < t) opts.push({ t: 'spin', amt: 2 * TAU, dir: 1 });
  if (opts.length) r.ai.plan = opts[Math.max(0, opts.length - 1 - ((Math.random() * 2) | 0))];
}
function aiCtl(r, dt) {
  const T = track, c = r.c, A = r.ai, st = r.st, D = DIFFS[GM.diff];
  c.steer = 0; c.acc = 1; c.brake = 0; c.jump = false; c.flipF = c.flipB = c.spec = false; c.pL = c.kR = false; c.boost = false; c.reset = false;
  if (r.air) {
    const p = A.plan;
    if (p) { if (p.t === 'spin') { if (Math.abs(r.spin) < p.amt - .3) c.steer = p.dir; } else if (p.t === 'flip') { if (Math.abs(r.flip) < p.amt - .25) { if (p.dir < 0) c.flipF = true; else c.flipB = true; } } else if (r.spec < p.amt - .1) c.spec = true; }
    return c;
  }
  const v = r.v, look = 10 + v * .55, sA = r.s + look, w = arrAt(T.wid, sA);
  if (r.fin) { c.acc = 0; c.brake = v > 1 ? 1 : 0; c.steer = clamp((-r.d / 20 - r.a) * 3, -1, 1); return c; }
  let tgt = clamp((kapAt(r.s + look * .6) + kapAt(sA + look * .5)) * 110, -.6, .6) * w + A.lane * (w / 10) + Math.sin(r.s * .013 + A.ph) * 1.2;
  tgt = clamp(tgt, -w + 1.8, w - 1.8);
  // shortcuts
  ground(r.s, r.d, G0);
  const onBranch = G0.reg === 1;
  for (const sh of T.shorts) if (r.s > sh.s0 - 40 && r.s < sh.s1) {
    if (A.sh !== sh) { A.sh = sh; A.take = A.noSh !== sh && Math.random() < (sh.hidden ? D.pHid : D.pShort); }
    if (A.noSh === sh) A.take = false;
    const sB = r.s + 5 + v * .22, ia = clamp(Math.round(sB / DS), 0, T.N - 1), bo = T.bo[ia], u = (sB - sh.s0) / (sh.s1 - sh.s0);
    if (onBranch && T.bw[ia] > 0 && !(sh.hidden && u > .9)) tgt = bo;
    else if (A.take && T.bw[ia] > 0 && Math.abs(bo) > 1 && !(sh.hidden && u > .5)) tgt = bo;
    else if (onBranch) tgt = sh.side * (w - 2);
  }
  let slow = (onBranch || A.take && A.sh && r.s > A.sh.s0 - 20 && r.s < A.sh.s1) && st.hand < 7 ? 26 : 99;
  // hazards
  for (const p of T.geysers) if (p.s > r.s - 2 && p.s < r.s + look * 1.6 && Math.abs(p.d - tgt) < 4) { tgt = p.d + (tgt >= p.d ? 1 : -1) * 4.6; if (Math.abs(tgt) > w - 1.5) tgt = p.d - Math.sign(tgt) * 4.6; }
  for (const p of T.pools) if (p.s > r.s - 2 && p.s < r.s + look * 1.6 && Math.abs(p.d - tgt) < p.r + 2) { tgt = p.d + (tgt >= p.d ? 1 : -1) * (p.r + 2.4); if (Math.abs(tgt) > w - 1.5) tgt = p.d - Math.sign(tgt) * (p.r + 2.4); }
  for (const b of GM.boulders) if (b.on && b.s > r.s - 3 && b.s < r.s + 30 && Math.abs(b.d + b.dir * 4 - r.d) < 4.5) { tgt = clamp(r.d - b.dir * 5, -w + 1.5, w - 1.5); if (b.s - r.s < 14) c.acc = 0; }
  for (const o of GM.racers) if (o !== r && !o.state) { const ds = o.s - r.s; if (ds > 0 && ds < 7 && Math.abs(o.d - r.d) < 1.4 && o.v < v) tgt += (r.d >= o.d ? 1 : -1) * 2; }
  for (const l of T.lips) { const q = l - r.s; if (q > v * 1.3 + 6) break; if (q > -2) { tgt = clamp(r.d, -w + 2, w - 2); break; } } // square up before a launch
  // steering with curvature feed-forward
  const rate = (1 + st.hand * .14) / (1 + v / 50), aDes = clamp((tgt - r.d) / (look * .55), -.55, .55);
  c.steer = clamp((aDes - r.a) * 4.5 + kapAt(r.s + v * .15) * v / rate, -1, 1);
  // corner speed
  let km = 0; for (let q = 0; q <= v * 1.3 + 8; q += 5) km = Math.max(km, Math.abs(kapAt(r.s + q)));
  if (km > 1e-4) { const C = (1 + st.hand * .14) * D.corner * (r.surf === 1 ? .7 : 1), aq = km / 50, vs = (-km + Math.sqrt(km * km + 4 * aq * C)) / (2 * aq); if (v > vs) { c.acc = 0; if (v > vs + 2.5) c.brake = 1; } }
  if (v > slow) { c.acc = 0; if (v > slow + 3) c.brake = 1; }
  for (const av of GM.aval) if (av.on && r.s > av.front - 70 && r.s < av.front + 6) { c.acc = 0; c.brake = 1; }
  if (r.boost >= 1 && r.boostT <= 0 && km < .007 && Math.random() < dt * .7) c.boost = true;
  if (r.cool <= 0 && GM.time > 6 && Math.random() < D.aggr * dt * 7) for (const o of GM.racers) { if (o === r || o.state || o.inv > 0) continue; const dd = o.d - r.d; if (Math.abs(o.s - r.s) < 2.6 && Math.abs(dd) > .3 && Math.abs(dd) < 2.9) { if (dd < 0) c.pL = true; else c.kR = true; break; } }
  if (A.jumper) for (const l of T.lips) { const q = l - r.s; if (q > v * .32) break; if (q > v * .04) c.jump = true; }
  return c;
}
