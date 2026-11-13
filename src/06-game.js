// ============================================================ GAME: events, hazards, camera, HUD, flow
function popup(text, cls) {
  const box = $('hPop'), e = document.createElement('div'); e.className = 'pop ' + (cls || ''); e.textContent = text; box.appendChild(e);
  while (box.children.length > 4) box.removeChild(box.firstChild);
  setTimeout(() => e.remove(), 1700);
}
function evt(type, r, a) {
  if (course.mb && MOBO.evt(type, r, a)) return;
  const P = r.isP && !GM.demo, pl = GM.player, near = pl && Math.abs(r.s - pl.s) < 70 && !GM.demo;
  tpos(r.s, r.d, TP1); const x = TP1.x, y = r.y, z = TP1.z, tc = RIDES[r.ride].trail, ac = course.amb.col;
  switch (type) {
    case 'jump': burst(x, y + .2, z, 8, 4, .5, .25, ac); if (P) { AU.jump(); if (a) popup('PERFECT LAUNCH!', 'good'); } break;
    case 'land': burst(x, y + .2, z, 8 + a * 16 | 0, 4 + a * 7, .7, .3, ac); if (P) { AU.land(a); cam.shake = Math.max(cam.shake, a * .9); PAD.rumble(a * .8, a * .4, 140 + a * 160); } break;
    case 'pad': burst(x, y + .5, z, 22, 9, .6, .35, [.5, 2.2, 1], 0); if (P) { AU.pad(); popup('SPEED BOOST!', 'good'); cam.shake = Math.max(cam.shake, .5); PAD.rumble(.3, .9, 450); } break;
    case 'trick': if (P) { popup(a.names.join(' + ') + '  +' + a.pts, 'trick'); if (a.n > 1) popup('TRICK COMBO x' + a.n + '!', 'combo'); AU.trick(a.n); } burst(x, y + 1, z, 14, 6, .8, .3, [tc[0] + .3, tc[1] + .3, tc[2] + .3], 2); break;
    case 'clean': if (P) popup('CLEAN LANDING!', 'good'); break;
    case 'sloppy': if (P) { popup('SLOPPY LANDING', 'bad'); cam.shake = Math.max(cam.shake, .7); } break;
    case 'crash':
      burst(x, y + 1, z, 30, 10, 1, .4, [tc[0] + .4, tc[1] + .4, tc[2] + .4]); burst(x, y + .5, z, 18, 7, .9, .5, a === 'lava' ? [2, .6, .1] : ac);
      if (P) { a === 'lava' ? AU.splash() : AU.crash(); cam.shake = 1.5; cam.flash = .5; PAD.rumble(1, 1, 550); popup({ ko: 'KNOCKED OUT!', fall: 'OFF COURSE!', lava: course.mb ? 'SHORTED!' : 'BURNED!', avalanche: 'SWEPT AWAY!', boulder: 'BOULDER!', shock: 'SHORTED!', solder: 'SOLDERED!' }[a] || 'WIPEOUT!', 'bad'); }
      else if (near) AU.noise(.3, { f: 700, to: 150, vol: .12, type: 'lowpass' });
      break;
    case 'bounce': burst(TP1.x, r.ry, TP1.z, 6, 3, .5, .3, ac); break;
    case 'hit': { tpos(a.s, a.d, TP1); burst(TP1.x, a.y + 1.2, TP1.z, 18, 9, .45, .3, [2.2, 1.8, .8], 4);
      if (P) { AU.hit(); popup('HIT! +100', 'hit'); cam.shake = Math.max(cam.shake, .5); PAD.rumble(.4, .8, 140); } else if (a.isP && !GM.demo) { AU.hit(); cam.shake = 1; cam.flash = .35; PAD.rumble(1, .6, 260); } else if (near) AU.noise(.1, { f: 1500, to: 400, vol: .1 }); break; }
    case 'ko': if (P) { AU.ko(); popup('KNOCKOUT! +500', 'ko'); } break;
    case 'boost': if (P) { AU.boost(); cam.shake = Math.max(cam.shake, .6); PAD.rumble(.3, .9, 600); } burst(x, y + .6, z, 16, 8, .5, .35, [tc[0] + .5, tc[1] + .5, tc[2] + .3], 0); break;
    case 'wall': burst(x, y + .6, z, 8, 6, .35, .2, [2, 1.4, .6], 5); if (P) { AU.thump(); cam.shake = Math.max(cam.shake, .3 + a); PAD.rumble(.6, .3, 150); } break;
    case 'cp': if (P) { AU.cp(); popup('CHECKPOINT ' + r.cpI + '/' + (track.cps.length - 1), 'info'); } break;
    case 'geyser': if (P) { AU.geyser(); popup('GEYSER LAUNCH!', 'info'); } break;
    case 'swing': if (P) AU.swing(); break;
    case 'respawn': if (P && a === 'fall') popup('BACK TO CHECKPOINT', 'info'); break;
    case 'finish': if (P) { AU.win(); popup('FINISH!', 'ko'); GM.finWait = 2.6; } break;
  }
}

// ---------------------------------------------------------------- hazards
function initHazards() {
  for (const b of GM.boulders) scene.remove(b.m); for (const a of GM.aval) scene.remove(a.m);
  GM.boulders = []; GM.aval = [];
  const rock = patch(new THREE.MeshLambertMaterial({ color: new THREE.Color(...course.pal.cliff).multiplyScalar(1.3), flatShading: true }));
  for (const z of track.zones) {
    if (z.kind === 'boulder') for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(geo('boulder', () => new THREE.IcosahedronGeometry(1.6, 0)), rock); m.frustumCulled = false; m.visible = false; scene.add(m); GM.boulders.push({ z, m, on: false, wait: .4 + i * .7, s: 0, d: 0, y: 0, vy: 0, dir: 1 }); }
    if (z.kind === 'avalanche') {
      const m = new THREE.InstancedMesh(geo('ico', () => new THREE.IcosahedronGeometry(1, 1)), MB(1.0, 1.08, 1.3, .3), 46); m.frustumCulled = false; m.visible = false; scene.add(m);
      const off = []; for (let i = 0; i < 46; i++) off.push([Math.random() * 34, (Math.random() - .5) * 46, 2.5 + Math.random() * 4.5, Math.random() * 9]);
      GM.aval.push({ z, m, off, on: false, done: false, front: 0, sp: 31 });
    }
  }
}
function updHazards(dt) {
  const T = track, lead = GM.demo ? GM.racers[0] : GM.player; let rumble = 0;
  for (const b of GM.boulders) {
    if (!b.on) {
      b.m.visible = false; b.wait -= dt;
      if (b.wait <= 0 && lead.s > b.z.s0 - 220 && lead.s < b.z.s1 - 20) {
        b.s = clamp(lead.s + 50 + Math.random() * 170, b.z.s0 + 8, b.z.s1 - 8); const i = Math.round(b.s / DS), wl = T.sL[i] === 1, wr = T.sR[i] === 1;
        b.dir = wl && !wr ? 1 : wr && !wl ? -1 : Math.random() < .5 ? 1 : -1; b.d = -b.dir * (T.wid[i] + 9); b.on = true; b.vy = 0; b.y = ground(b.s, -b.dir * (T.wid[i] - 1), G1).y + 14; b.fall = 0;
      } else if (b.wait <= 0) b.wait = .5;
      continue;
    }
    b.s += 5 * dt; b.d += b.dir * 8.5 * dt; ground(b.s, b.d, G1);
    const w = G1.w, over = b.dir * b.d > w + 2.5;
    b.vy -= 26 * dt; b.y += b.vy * dt;
    const gy = (over ? -1e9 : ground(b.s, clamp(b.d, -w, w), G1).y) + 1.5;
    if (b.y < gy) { b.y = gy; b.vy = 7.5; tpos(b.s, b.d, TP1); burst(TP1.x, gy - 1.3, TP1.z, 8, 5, .6, .4, course.amb.col); if (Math.abs(b.s - lead.s) < 60 && !GM.demo) AU.thump(); }
    if (over) { b.fall += dt; if (b.fall > 1.6) { b.on = false; b.wait = .6 + Math.random() * 2; } }
    tpos(b.s, b.d, TP1); b.m.visible = true; b.m.position.set(TP1.x, b.y, TP1.z); b.m.rotation.x += dt * 4; b.m.rotation.z -= b.dir * dt * 5;
    if (Math.abs(b.s - lead.s) < 50) rumble = Math.max(rumble, .25);
    if (!over) for (const r of GM.racers) if (!r.state && Math.abs(r.s - b.s) < 2.4 && Math.abs(r.d - b.d) < 2.4 && r.y < b.y + 1.5 && r.y > b.y - 4) r.crash('boulder');
  }
  for (const a of GM.aval) {
    if (a.done) continue;
    if (!a.on) { if (lead.s > a.z.s0 + 25 && lead.s < a.z.s1 - 150) { a.on = true; a.front = a.z.s0 - 75; a.sp = 30; a.m.visible = true; if (!GM.demo) { popup('AVALANCHE!', 'bad'); $('hWarn').textContent = '▲ AVALANCHE — OUTRUN IT ▲'; } } continue; }
    a.sp = Math.min(36.5, a.sp + 1.2 * dt); a.front += a.sp * dt;
    for (const r of GM.racers) if (!r.state && r.s < a.front && r.s > a.front - 45) r.crash('avalanche');
    const gap = lead.s - a.front; if (gap < 160) rumble = Math.max(rumble, clamp(1 - gap / 160, 0, 1));
    if (!GM.demo && gap < 60 && gap > -50) cam.shake = Math.max(cam.shake, .5 * (1 - Math.abs(gap) / 60));
    a.off.forEach((o, i) => {
      const s = a.front - o[0] + Math.sin(GM.t * 3 + o[3]) * 2, d = o[1]; tpos(s, d, TP1); const gy = arrAt(T.cy, s);
      _o3.position.set(TP1.x, gy + o[2] * .7 + Math.abs(Math.sin(GM.t * 4 + o[3])) * 3, TP1.z); _o3.scale.setScalar(o[2]); _o3.rotation.set(GM.t * 3 + o[3], o[3], 0); _o3.updateMatrix(); a.m.setMatrixAt(i, _o3.matrix);
      if (Math.random() < dt * 5) spawnP(TP1.x, gy + 2 + Math.random() * 6, TP1.z, (Math.random() - .5) * 14, 4 + Math.random() * 8, (Math.random() - .5) * 14, 1.2, 1.2, .8, .9, 1.2, 5);
    });
    a.m.instanceMatrix.needsUpdate = true;
    if (a.front > a.z.s1 + 70) { a.on = false; a.done = true; a.m.visible = false; $('hWarn').textContent = ''; }
  }
  // geysers
  T.geysers.forEach(g => {
    const ph = (GM.t + g.ph) % 3.6, act = ph < 1.0; tpos(g.s, g.d, TP1); const gy = arrAt(T.cy, g.s);
    if (Math.abs(g.s - lead.s) < 400) {
      if (act) for (let n = 0; n < 3; n++) spawnP(TP1.x + (Math.random() - .5), gy + .3, TP1.z + (Math.random() - .5), (Math.random() - .5) * 3, 16 + Math.random() * 12, (Math.random() - .5) * 3, .9, .7, .6, 1.5, 1.8, 14);
      else if (ph > 2.7 && Math.random() < .5) spawnP(TP1.x + (Math.random() - .5) * 2, gy + .2, TP1.z + (Math.random() - .5) * 2, 0, 3, 0, .5, .3, .5, 1.3, 1.6, 0);
    }
    if (act) for (const r of GM.racers) if (!r.state && !r.air && Math.abs(r.s - g.s) < 2.6 && Math.abs(r.d - g.d) < 2.6) { r.vy = 19 + r.v * .12; r.air = true; r.airT = 0; r.y += .1; r.takeoff(); evt('geyser', r); }
  });
  return rumble;
}

// ---------------------------------------------------------------- race setup
function newRace(demo) {
  if (course.mine) return MINE.newRace(demo);
  GM.demo = demo;
  for (const r of GM.racers) r.dispose(); GM.racers = [];
  const rides = [GM.ride]; const pool = [0, 1, 2, 0, 1, 2].filter((x, i) => !(x === GM.ride && i < 3)); // 5 rivals: a mix of all three rides
  pool.sort(() => Math.random() - .5); for (let i = 0; i < 5; i++) rides.push(pool[i % pool.length]);
  if (!rides.slice(1).includes(0)) rides[1] = 0; if (!rides.slice(1).includes(1)) rides[2] = 1; if (!rides.slice(1).includes(2)) rides[3] = 2;
  const slots = [3, 0, 1, 2, 4, 5];
  for (let i = 0; i < 6; i++) { const r = new Racer(i, rides[i], i === 0); const sl = slots[i]; r.place(34 - (sl >> 1) * 5.5, (sl & 1 ? 1 : -1) * 3.2); GM.racers.push(r); }
  GM.player = GM.racers[0]; GM.time = 0; GM.count = demo ? 0 : 3.4; GM.lastBeep = 4; GM.finWait = 0; GM.white = 0; GM.pairCD.fill(0); GM.order = GM.racers.slice();
  initHazards(); clearFX(); cam.init = false; cam.shake = 0; cam.flash = 0; $('hWarn').textContent = ''; $('hPop').innerHTML = ''; $('hCount').textContent = '';
  buildProg();
}
function ensureWorld(ci, then) {
  if (GM.built === ci) { then(); return; }
  $('loading').classList.add('on');
  const go = () => { buildWorld(ci); GM.built = ci; $('loading').classList.remove('on'); then(); };
  if (COURSES[ci].mb) MOBO.load().then(() => setTimeout(go, 20)); else if (COURSES[ci].mine) MINE.load().then(() => setTimeout(go, 20)); else setTimeout(go, 40);
}
function playerCtl(c) {
  const up = keys.KeyW || keys.ArrowUp, dn = keys.KeyS || keys.ArrowDown;
  c.steer = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  c.acc = up ? 1 : 0; c.brake = dn ? 1 : 0; c.jump = !!keys.Space; c.flipF = !!up; c.flipB = !!dn; c.spec = !!(keys.ShiftLeft || keys.ShiftRight);
  c.pL = !!pressed.KeyQ; c.kR = !!pressed.KeyE; c.boost = !!(pressed.ControlLeft || pressed.KeyF); c.reset = !!pressed.KeyR;
  if (PAD.on) {
    if (PAD.steer) c.steer = PAD.steer;
    if (PAD.acc > .06) c.acc = 1; if (PAD.brake > .15) c.brake = 1;
    c.jump = c.jump || !!PAD.b[0];
    c.flipF = c.flipF || PAD.sy < -.45; c.flipB = c.flipB || PAD.sy > .45; // stick forward = front flip, back = back flip (air only)
    c.spec = c.spec || !!PAD.b[3];
    c.pL = c.pL || !!PAD.hit[2]; c.kR = c.kR || !!PAD.hit[1]; c.boost = c.boost || !!PAD.hit[5]; c.reset = c.reset || !!PAD.hit[8];
  }
  return c;
}
function collide() {
  const R = GM.racers;
  for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) {
    const a = R[i], b = R[j]; if (a.state || b.state) continue;
    const ds = b.s - a.s; if (Math.abs(ds) > 2) continue; const dd = b.d - a.d; if (Math.abs(dd) > 1.15 || Math.abs(a.y - b.y) > 1.6) continue;
    const sg = dd >= 0 ? 1 : -1, ov = 1.15 - Math.abs(dd); a.d -= sg * ov * .5; b.d += sg * ov * .5;
    const key = i * 6 + j; if (GM.pairCD[key] > 0) continue;
    const am = a.ride === 2 && a.v > 12, bm = b.ride === 2 && b.v > 12; // the Machination damages by ramming
    GM.pairCD[key] = am || bm ? .9 : .4; a.push -= sg * 2; b.push += sg * 2;
    if (am) b.hitBy(a, a.st.dmg * .5, sg); if (bm && !a.state) a.hitBy(b, b.st.dmg * .5, -sg);
  }
}
function stepRace(dt) {
  if (course.mine) return MINE.stepRace(dt);
  GM.t += dt; const R = GM.racers, pl = GM.player;
  if (GM.count > 0) {
    GM.count -= dt; const n = Math.ceil(GM.count - .4);
    if (n !== GM.lastBeep) { GM.lastBeep = n; const el = $('hCount'); el.textContent = n > 0 ? n : 'GO!'; el.classList.remove('zap'); void el.offsetWidth; el.classList.add('zap'); AU.beep(n <= 0); }
    if (GM.count > .4) { for (const r of R) r.vis(dt); return; }
  } else if ($('hCount').textContent && GM.count < -.6) $('hCount').textContent = '';
  if (GM.count <= 0) GM.count -= dt;
  GM.time += dt;
  for (let i = 0; i < 36; i++) if (GM.pairCD[i] > 0) GM.pairCD[i] -= dt;
  const D = DIFFS[GM.diff], ref = GM.demo ? R.reduce((a, r) => a + r.s, 0) / 6 : pl.s;
  for (const r of R) {
    if (r.isP && !GM.demo) { r.rb = 1; r.update(dt, r.fin || GM.auto ? aiCtl(r, dt) : playerCtl(r.c)); continue; }
    const gap = r.s - ref; // light rubber-banding
    r.rb = D.skill * (gap < -50 ? 1 + Math.min(.1, (-gap - 50) / 900) : gap > 70 ? 1 - Math.min(.08, (gap - 70) / 1000) : 1);
    r.update(dt, aiCtl(r, dt));
  }
  collide();
  const rumble = updHazards(dt);
  GM.order = R.slice().sort((a, b) => a.fin && b.fin ? a.finT - b.finT : a.fin ? -1 : b.fin ? 1 : b.s - a.s);
  for (const r of R) r.vis(dt);
  // ambient + speed fx around the camera target
  const p = pl, T = track; tpos(p.s, p.d, TP0); const th = TP0.th, fx = Math.sin(th), fz = -Math.cos(th), rx = Math.cos(th), rz = Math.sin(th), A = course.amb;
  const white = (p.zf & 4) ? 1 : 0; GM.white += (white - GM.white) * Math.min(1, dt * 1.5);
  let n = (1.2 + p.v * .09) * dt * 60 * (.5 + GM.white * 2.5) * .5; n = (n | 0) + (Math.random() < n % 1 ? 1 : 0);
  for (let i = 0; i < n; i++) { const f = 6 + Math.random() * 75, l = (Math.random() - .5) * 46, c = GM.white > .3 ? [1, 1.05, 1.2] : A.col; spawnP(TP0.x + fx * f + rx * l, p.y - 2 + Math.random() * 13, TP0.z + fz * f + rz * l, (Math.random() - .5) * 2, A.fall + (Math.random() - .5), (Math.random() - .5) * 2, 1 + Math.random() * .8, A.size * (.6 + Math.random()), c[0], c[1], c[2], 0); }
  let ns = p.v * dt * (p.boostT > 0 ? 2.6 : 1.1) * (p.v > 14 ? 1 : 0); ns = (ns | 0) + (Math.random() < ns % 1 ? 1 : 0);
  for (let i = 0; i < ns; i++) { const s = p.s + 12 + Math.random() * 70, d = p.d + (Math.random() - .5) * 20; ground(s, d, G1); if (G1.void || G1.reg > 1) continue; tpos(s, d, TP1); const o = Math.random() < .5; decal(TP1.x, G1.y, TP1.z, TP1.th, slopeAt(s, d, 2), .16, 3 + p.v * .14, o ? 2.2 : 1.9, o ? .35 : .85, o ? .1 : .12, .8); }
  if (course.mb) MOBO.step(dt);
  if (!GM.demo) { AU.frame(p.state ? 0 : p.v, p.ride, p.air, p.boostT > 0, rumble); if (p.ride === 1 && !p.air && !p.state && p.v > 3) { GM.gal = (GM.gal || 0) + p.v * dt; if (GM.gal > 3.2) { GM.gal = 0; AU.thump(); } } if (course.mb) MOBO.audio(p); else AU.music(course.root, course.tempo, clamp(p.v / 36, 0, 1)); }
  else AU.silence();
  // flow
  if (!GM.demo && GM.finWait > 0) { GM.finWait -= dt; if (GM.finWait <= 0) showResults(); }
  if (GM.demo && (R.every(r => r.fin) || GM.time > 240)) newRace(true);
}

// ---------------------------------------------------------------- camera
function updCamera(dt) {
  if (course.mine) return MINE.camera(dt);
  const p = GM.player, T = track; tpos(p.s, p.d, TP0);
  const sp = clamp(p.v / 38, 0, 1.3), boost = p.boostT > 0 ? 1 : 0;
  let yawT = TP0.th + p.beta * .55 + p.a * .15;
  if (GM.demo) { cam.orbit += dt * .12; yawT += Math.sin(cam.orbit) * .9; }
  if (!cam.init) { cam.yaw = yawT; cam.y = p.y + 2.4; cam.init = true; cam.roll = 0; cam.fov = 66; cam.ly = p.y + 1.2; }
  cam.yaw += angDiff(yawT, cam.yaw) * (1 - Math.exp(-dt * 4.2));
  const dist = (GM.demo ? 7.5 : 5.3) + sp * 2.3 + boost * .8, h = 2.15 + sp * .45;
  const fx = Math.sin(cam.yaw), fz = -Math.cos(cam.yaw);
  let cx = TP0.x - fx * dist, cz = TP0.z - fz * dist;
  cam.y += (p.y + h - cam.y) * (1 - Math.exp(-dt * (p.air ? 5 : 9)));
  const rel = cam.yaw - TP0.th; ground(p.s - dist * Math.cos(rel), p.d - dist * Math.sin(rel), G1);
  if (!G1.void && cam.y < G1.y + 1.1) cam.y = G1.y + 1.1;
  if (G1.reg === 3 && cam.y < G1.y + 1.1) cam.y = G1.y + 1.1;
  cam.shake *= Math.exp(-5.5 * dt); cam.flash *= Math.exp(-4 * dt);
  const sh = cam.shake + boost * .05 + (sp > 1 ? (sp - 1) * .2 : 0), t = GM.t * 47;
  camera.position.set(cx + Math.sin(t) * sh * .22, cam.y + Math.sin(t * 1.31 + 1) * sh * .22, cz + Math.sin(t * .77 + 2) * sh * .22);
  ground(p.s + 9, p.d, G1); const ahead = G1.void ? p.y : G1.y;
  const lyT = lerp(p.y + 1.25, ahead + 2.0, .45); cam.ly += (lyT - cam.ly) * (1 - Math.exp(-dt * 8));
  camera.up.set(0, 1, 0); camera.lookAt(TP0.x + fx * 9, cam.ly, TP0.z + fz * 9);
  const rollT = GM.demo ? 0 : clamp(p.steerSm * .44 * Math.min(1, p.v / 18) + (p.a - p.beta) * .5, -.44, .44) * (p.state ? 0 : 1);
  cam.roll += (rollT - cam.roll) * (1 - Math.exp(-dt * 5)); camera.rotateZ(-cam.roll);
  const fovT = 64 + sp * 19 + boost * 11; cam.fov += (fovT - cam.fov) * (1 - Math.exp(-dt * 4));
  camera.fov = cam.fov; camera.updateProjectionMatrix();
  setBend(fx, fz);
  const U = mComp.uniforms;
  U.uBlur.value = GM.demo ? .15 : clamp((p.v - 16) / 24, 0, 1) * .75 + boost * .55;
  U.uWhite.value = GM.white * .62; U.uFlash.value = cam.flash + boost * .12; U.uBloom.value = (course.mb ? .2 : .55) + boost * (course.mb ? .1 : .2);
  uFogD.value = scene.fog.density = course.fogD * (1 + GM.white * 5);
  if (course.mb) MOBO.camera(dt);
}

// ---------------------------------------------------------------- HUD
const hc = {};
function setTxt(id, v) { if (hc[id] !== v) { hc[id] = v; $(id).textContent = v; } }
const fmtT = t => { const m = t / 60 | 0, s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(2); };
const ORD = ['1st', '2nd', '3rd', '4th', '5th', '6th'];
function buildProg() { const b = $('hProg'); b.innerHTML = '<i class="fin"></i>'; GM.racers.forEach((r, i) => { const d = document.createElement('b'); d.style.background = d.style.color = RCSS[i]; if (i === 0) d.className = 'me'; b.appendChild(d); r.dot = d; }); track.cps.slice(1).forEach(s => { const c = document.createElement('i'); c.style.left = (s / track.fin * 100) + '%'; b.appendChild(c); }); }
function updHUD() {
  if (course.mine) return MINE.hud();
  const p = GM.player;
  setTxt('hTime', fmtT(p.fin ? p.finT : GM.time));
  setTxt('hPos', ORD[GM.order.indexOf(p)]);
  setTxt('hSpeed', Math.round(p.v * 2.237));
  const segs = $('hBoost').children; for (let i = 0; i < 5; i++) { const f = clamp(p.boost - i, 0, 1), k = 'bs' + i; if (hc[k] !== f) { hc[k] = f; segs[i].style.setProperty('--f', f); segs[i].classList.toggle('on', f >= 1); } }
  const full = p.boost >= 5, act = p.boostT > 0; if (hc.bf !== full) { hc.bf = full; $('hBoost').classList.toggle('full', full); } if (hc.ba !== act) { hc.ba = act; $('hBoost').classList.toggle('act', act); }
  const hp = Math.round(clamp(p.health / p.st.hp, 0, 1) * 100); if (hc.hp !== hp) { hc.hp = hp; $('hHealthFill').style.width = hp + '%'; $('hHealth').classList.toggle('low', hp < 35); }
  if (course.mb) MOBO.hud(p);
  for (const r of GM.racers) r.dot.style.left = clamp(r.s / track.fin, 0, 1) * 100 + '%';
  const ch = p.charge > .05 ? Math.round(p.charge * 100) : 0; if (hc.ch !== ch) { hc.ch = ch; $('hCharge').style.width = ch + '%'; $('hChargeBox').style.opacity = ch ? 1 : 0; }
}

// ---------------------------------------------------------------- screens / flow
function show(id) { document.querySelectorAll('.scr').forEach(s => s.classList.toggle('on', s.id === id)); $('hud').classList.toggle('on', !id || id === 'scrPause'); }
function toMenu() { GM.state = 'menu'; show('scrMain'); ensureWorld(GM.course, () => newRace(true)); }
function toRide() { GM.state = 'ride'; show('scrRide'); AU.ui(); }
function toCourse() { GM.state = 'course'; show('scrCourse'); AU.ui(); }
function pickRide(i) { GM.ride = i; document.querySelectorAll('#rideCards .card').forEach((c, k) => c.classList.toggle('sel', k === i)); AU.ui(); if (GM.built >= 0) newRace(true); }
function pickCourse(i) { GM.course = i; document.querySelectorAll('#courseCards .card').forEach((c, k) => c.classList.toggle('sel', k === i)); AU.ui(); ensureWorld(i, () => newRace(true)); }
function pickDiff(i) { GM.diff = i; document.querySelectorAll('#diffBtns button').forEach((c, k) => c.classList.toggle('sel', k === i)); AU.ui(); }
function startRace() { AU.init(); ensureWorld(GM.course, () => { newRace(false); GM.state = 'race'; show(null); for (const k in hc) delete hc[k]; $('hud').classList.toggle('mb', !!course.mb); $('hud').classList.toggle('mine', !!course.mine); if (course.mb) MOBO.raceStart(); if (course.mine) MINE.raceStart(); }); }
function pause() { if (GM.state !== 'race') return; GM.state = 'paused'; show('scrPause'); AU.silence(); }
function resume() { if (GM.state !== 'paused') return; GM.state = 'race'; show(null); }
function showResults() {
  GM.state = 'results'; const p = GM.player, pos = GM.order.indexOf(p), tot = p.pts.trick + p.pts.hit + p.pts.ko;
  $('resTitle').textContent = pos === 0 ? 'VICTORY!' : ORD[pos] + ' PLACE';
  $('resBody').innerHTML = [['POSITION', ORD[pos] + ' / 6'], ['RACE TIME', fmtT(p.finT)], ['TOTAL POINTS', tot], ['· tricks', p.pts.trick], ['· hits', p.pts.hit], ['· knockouts', p.pts.ko], ['BEST TRICK COMBO', p.best ? p.best + ' pts' + (p.bestN > 1 ? ' (x' + p.bestN + ')' : '') : '—'], ['KNOCKOUTS', p.kos]].map(r => `<div class="row${r[0][0] === '·' ? ' sub' : ''}"><span>${r[0]}</span><b>${r[1]}</b></div>`).join('')
    + '<div class="stand">' + GM.order.map((r, i) => `<span style="color:${RCSS[r.i]}">${i + 1}. ${r.isP ? 'YOU' : RIDES[r.ride].name.split(' ').pop()}${r.fin ? ' ' + fmtT(r.finT) : ''}</span>`).join('') + '</div>';
  show('scrRes'); AU.silence();
}
function initUI() {
  const ctl = [['W / ↑', 'Pedal / accelerate'], ['S / ↓', 'Brake'], ['A D / ← →', 'Steer · spin in the air'], ['SPACE', 'Jump — hold to charge, release at a lip'], ['W / S in air', 'Front flip / back flip'], ['SHIFT in air', 'Whip · rear · barrel roll'], ['Q / E', 'Punch left / kick right'], ['L-CTRL or F', 'Spend boost'], ['R', 'Reset to track'], ['ESC', 'Pause'], ['M', 'Mute']];
  document.querySelectorAll('.controls').forEach(el => el.innerHTML = ctl.map(c => `<div><kbd>${c[0]}</kbd><span>${c[1]}</span></div>`).join(''));
  $('rideCards').innerHTML = RIDES.map((r, i) => `<div class="card" style="--c:${r.css}" onclick="pickRide(${i})"><h3>${r.name}</h3><p>${r.desc}</p>${r.stats.map((s, k) => `<div class="stat"><span>${STAT_NAMES[k]}</span><div class="bar"><i style="width:${s * 10}%"></i></div><em>${s}</em></div>`).join('')}<small>Signature trick: ${r.spec}</small></div>`).join('');
  $('courseCards').innerHTML = COURSES.map((c, i) => `<div class="card" style="--c:rgb(${c.fog.map(v => Math.min(255, v * 255 + 60 | 0))})" onclick="pickCourse(${i})"><div class="ico">${c.icon}</div><h3>${c.name}</h3><p>${c.sub}</p></div>`).join('');
  $('diffBtns').innerHTML = DIFFS.map((d, i) => `<button onclick="pickDiff(${i})">${d.name}</button>`).join('');
  pickRide(0); document.querySelectorAll('#courseCards .card')[0].classList.add('sel'); pickDiff(1);
  addEventListener('keydown', e => {
    const k = e.code, st = GM.state, enter = k === 'Enter' || k === 'NumpadEnter', L = k === 'ArrowLeft' || k === 'KeyA', Rk = k === 'ArrowRight' || k === 'KeyD';
    if (k === 'KeyM') { AU.muted = !AU.muted; if (AU.muted) AU.silence(); }
    if (st === 'menu' && (enter || k === 'Space')) toRide();
    else if (st === 'ride') { if (L) pickRide((GM.ride + 2) % 3); else if (Rk) pickRide((GM.ride + 1) % 3); else if (enter) toCourse(); else if (k === 'Escape') toMenu(); }
    else if (st === 'course') { if (L) pickCourse((GM.course + 4) % 5); else if (Rk) pickCourse((GM.course + 1) % 5); else if (k === 'ArrowUp' || k === 'KeyW') pickDiff(Math.min(2, GM.diff + 1)); else if (k === 'ArrowDown' || k === 'KeyS') pickDiff(Math.max(0, GM.diff - 1)); else if (enter) startRace(); else if (k === 'Escape') toRide(); }
    else if (st === 'race' && k === 'Escape') pause();
    else if (st === 'paused' && (k === 'Escape' || enter)) resume();
    else if (st === 'results') { if (enter) startRace(); else if (k === 'Escape') toMenu(); }
  });
  addEventListener('blur', () => pause());
  window.onbeforeunload = e => { if (GM.state === 'race') { e.preventDefault(); return e.returnValue = 'Race in progress'; } }; // guards against Ctrl+W while boosting
}

// ---------------------------------------------------------------- main loop
let lastT = 0, fAvg = 17, fPrev = 0, fAdj = 0;
function frame(t) {
  requestAnimationFrame(frame);
  let dt = Math.min(.05, (t - lastT) / 1000 || .016); lastT = t;
  if (GM.state === 'race') { fAvg += ((t - fPrev) - fAvg) * .03; if (fAvg > 24 && t - fAdj > 2500 && QS > .5) { QS *= .85; fAdj = t; fAvg = 17; resize(); } } fPrev = t;
  if (GM.built >= 0 && GM.racers.length) {
    if (GM.state !== 'paused') {
      const n = dt > .022 ? 2 : 1; for (let i = 0; i < n; i++) stepRace(dt / n);
      uTime.value += dt; updateFX(dt); updCamera(dt); if (!GM.demo) updHUD();
    }
    renderFrame();
  }
  for (const k in pressed) delete pressed[k];
}
function boot() { initRender(); initUI(); toMenu(); requestAnimationFrame(frame); }
boot();
