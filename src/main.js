// DREAMFALL — Pass 1: the mountain. Vite + Three.js + Rapier.
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { PI, TAU, clamp, lerp, sstep, HALF_W, LEN, FINISH_D, GATE_HALF, gates, mainX, buildGrid, hAt, normalAt, buildTerrainMeshes, collisionMesh } from './terrain.js';
import { loadScenery, buildScenery } from './scenery.js';

const $ = id => document.getElementById(id);
const keys = {}, pressed = {};
addEventListener('keydown', e => { if (!keys[e.code]) pressed[e.code] = true; keys[e.code] = true; if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault(); });
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

// ---------------------------------------------------------------- gamepad (basic driving; full Pass 3 mapping comes later)
const pad = { on: false, steer: 0, acc: 0, brake: 0, jump: false, prev: [] , hit: {} };
function pollPad() {
  const gp = [...(navigator.getGamepads ? navigator.getGamepads() : [])].find(g => g && g.connected && g.mapping === 'standard') || [...(navigator.getGamepads ? navigator.getGamepads() : [])].find(g => g && g.connected);
  pad.hit = {};
  if (!gp) { if (pad.on) { pad.on = false; toast('CONTROLLER DISCONNECTED'); } pad.steer = pad.acc = pad.brake = 0; pad.jump = false; return; }
  if (!pad.on) { pad.on = true; toast('CONTROLLER CONNECTED'); }
  const x = gp.axes[0] || 0, dz = .15; pad.steer = Math.abs(x) < dz ? 0 : Math.sign(x) * (Math.abs(x) - dz) / (1 - dz);
  const b = i => gp.buttons[i] ? gp.buttons[i].value || (gp.buttons[i].pressed ? 1 : 0) : 0;
  pad.acc = b(7); pad.brake = b(6); pad.jump = b(0) > .5;
  for (const i of [0, 8, 9]) { const d = b(i) > .5; if (d && !pad.prev[i]) pad.hit[i] = true; pad.prev[i] = d; }
}
function toast(t) { const e = $('toast'); e.textContent = t; e.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => e.classList.remove('on'), 2500); }
addEventListener('gamepadconnected', () => pollPad());

// ---------------------------------------------------------------- renderer / scene
const renderer = new THREE.WebGLRenderer({ canvas: $('c'), antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const FOG = new THREE.Color(0xf2b27a);
scene.fog = new THREE.Fog(FOG, 90, 1500);
const camera = new THREE.PerspectiveCamera(68, 1, .25, 9000);
const hemi = new THREE.HemisphereLight(0xbcd4ff, 0x5a4630, 1.15); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffd9a8, 2.4); scene.add(sun, sun.target);
const SUN_DIR = new THREE.Vector3(-.55, .5, -.42).normalize();
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -.0006; sun.shadow.normalBias = .06;
Object.assign(sun.shadow.camera, { left: -75, right: 75, top: 75, bottom: -75, near: 10, far: 420 }); sun.shadow.camera.updateProjectionMatrix();
// golden-hour sky dome
const sky = new THREE.Mesh(new THREE.SphereGeometry(8000, 24, 16), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { sunDir: { value: SUN_DIR } },
  vertexShader: 'varying vec3 vD; void main(){ vD=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: `varying vec3 vD; uniform vec3 sunDir;
  void main(){ vec3 d=normalize(vD); float h=clamp(d.y,-.2,1.); vec3 top=vec3(.13,.36,.82), hor=vec3(1.,.69,.45);
    vec3 c=mix(hor,top,pow(smoothstep(-.05,.75,h),.6)); float s=max(dot(d,sunDir),0.); c+=vec3(1.,.72,.38)*pow(s,6.)*.55+vec3(1.,.9,.7)*pow(s,400.)*3.;
    gl_FragColor=vec4(c,1.); }` }));
sky.renderOrder = -10; scene.add(sky);
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

// ---------------------------------------------------------------- bike (placeholder model for Pass 1 — replaced by an animated rider in Pass 2)
function buildBike() {
  const g = new THREE.Group(), M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .6, ...o });
  const box = new THREE.BoxGeometry(1, 1, 1), tor = new THREE.TorusGeometry(.34, .055, 6, 16), wheels = [];
  const bx = (p, w, h, d, m, x, y, z, rx = 0) => { const o = new THREE.Mesh(box, m); o.scale.set(w, h, d); o.position.set(x, y, z); o.rotation.x = rx; o.castShadow = true; p.add(o); return o; };
  const frame = M(0xffc93c, { metalness: .4 }), dark = M(0x16161d), suit = M(0xe23a4e), skin = M(0xffd9b0);
  for (const z of [-.58, .58]) { const w = new THREE.Group(); w.position.set(0, .39, z); w.rotation.y = PI / 2; const sp = new THREE.Group(); const t = new THREE.Mesh(tor, dark); t.castShadow = true; sp.add(t); bx(sp, .62, .03, .03, frame, 0, 0, 0); bx(sp, .03, .62, .03, frame, 0, 0, 0); w.add(sp); g.add(w); wheels.push(sp); }
  bx(g, .07, .07, .95, frame, 0, .72, .02, .28); bx(g, .07, .62, .07, frame, 0, .68, .3, .25); bx(g, .06, .75, .06, frame, 0, .74, -.5, -.3);
  bx(g, .56, .05, .05, dark, 0, 1.1, -.4); bx(g, .16, .05, .3, dark, 0, 1.0, .28);
  const r = new THREE.Group(); r.position.set(0, 1.0, .14); g.add(r);
  const torso = new THREE.Group(); torso.position.y = .1; torso.rotation.x = -.5; r.add(torso);
  bx(torso, .42, .56, .26, suit, 0, .3, 0); const head = new THREE.Mesh(new THREE.SphereGeometry(.17, 12, 10), M(0xffffff)); head.position.set(0, .74, -.02); head.castShadow = true; torso.add(head);
  for (const x of [-.26, .26]) { bx(torso, .11, .52, .11, suit, x, .28, -.1, .9); }
  for (const x of [-.14, .14]) { bx(r, .15, .55, .15, dark, x, -.16, -.08, .35); }
  return { g, wheels, torso };
}

// ---------------------------------------------------------------- game state
const S = { state: 'load', t: 0, time: 0, count: 0, gate: 1, missed: false, crashT: 0, msgT: 0 };
const bike = { yaw: 0, steer: 0, hold: 0, charge: 0, grounded: false, airT: 0, lean: 0, pitch: 0, wheel: 0, speed: 0, vis: null, body: null };
let world, beacon;
const R_BALL = .42, GRAV = 24;
const _f = new THREE.Vector3(), _r = new THREE.Vector3(), _n = new THREE.Vector3(), _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _up = new THREE.Vector3();

function msg(t, sec = 1.6) { $('hMsg').textContent = t; S.msgT = sec; }
function placeBike(x, z, yaw, speed = 0) {
  const y = hAt(x, z) + R_BALL + .02; bike.body.setTranslation({ x, y, z }, true);
  bike.yaw = yaw; bike.body.setLinvel({ x: Math.sin(yaw) * speed, y: 0, z: -Math.cos(yaw) * speed }, true); bike.steer = 0; bike.charge = 0; bike.airT = 0;
}
function respawn(toGate) {
  const p = bike.body.translation(); let d = clamp(-p.z, 0, FINISH_D + 30);
  if (toGate) { const g = gates[S.gate]; d = Math.max(0, g.d - 45); S.missed = false; $('hWarn').textContent = ''; }
  const x = mainX(d), x2 = mainX(d + 6); placeBike(x, -d, Math.atan2(x2 - x, 6), 7);
  S.crashT = 0; cam.init = false;
}
window.startRace = () => {
  placeBike(0, 7, 0, 0); S.state = 'race'; S.time = 0; S.count = 3.4; S.lastBeep = 9; S.gate = 1; S.missed = false; S.crashT = 0; cam.init = false;
  $('hWarn').textContent = ''; $('hMsg').textContent = ''; show(null);
};
window.resume = () => { if (S.state === 'paused') { S.state = 'race'; show(null); } };
function show(id) { document.querySelectorAll('.scr').forEach(s => s.classList.toggle('on', s.id === id)); $('hud').classList.toggle('on', !id || id === 'scrPause'); }
addEventListener('keydown', e => {
  if (e.code === 'Enter') { if (S.state === 'menu' || S.state === 'done') startRace(); else if (S.state === 'paused') resume(); }
  if (e.code === 'Escape') { if (S.state === 'race') { S.state = 'paused'; show('scrPause'); } else if (S.state === 'paused') resume(); }
});

// ---------------------------------------------------------------- bike physics: a Rapier rigid body driven by an arcade controller
function control() {
  const c = { steer: 0, acc: 0, brake: 0, jump: false };
  if (window.AUTO) { // test autopilot: follow the main trail
    const p = bike.body.translation(), d = -p.z + 22, tx = d < FINISH_D ? mainX(d) : gates[gates.length - 1].x, want = Math.atan2(tx - p.x, 22);
    let e = want - bike.yaw; while (e > PI) e -= TAU; while (e < -PI) e += TAU;
    c.steer = clamp(e * 3, -1, 1); c.acc = 1; if (Math.abs(e) > .5 && bike.speed > 14) { c.acc = 0; c.brake = 1; } if (bike.speed > (window.AUTO_V || 26)) c.acc = 0;
    return c;
  }
  c.steer = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  c.acc = keys.KeyW || keys.ArrowUp ? 1 : 0; c.brake = keys.KeyS || keys.ArrowDown ? 1 : 0; c.jump = !!keys.Space;
  if (pad.on) { if (pad.steer) c.steer = pad.steer; c.acc = Math.max(c.acc, pad.acc > .05 ? 1 : 0); c.brake = Math.max(c.brake, pad.brake > .2 ? 1 : 0); c.jump = c.jump || pad.jump; }
  return c;
}
function stepBike(dt, c) {
  const b = bike.body, p = b.translation(), v = b.linvel();
  const gy = hAt(p.x, p.z); normalAt(p.x, p.z, _n);
  const gap = p.y - R_BALL - gy; bike.grounded = gap < .14;
  _v.set(v.x, v.y, v.z);
  if (S.count > .4 || S.crashT > 0 || S.state === 'done') { // held on the line / down / finished: brake to a stop
    if (bike.grounded) { const k = Math.exp(-(S.state === 'done' ? 1.6 : 6) * dt); b.setLinvel({ x: v.x * k, y: v.y, z: v.z * k }, true); }
    bike.speed = Math.hypot(v.x, v.z); return;
  }
  bike.steer += (c.steer - bike.steer) * Math.min(1, dt * 10);
  bike.hold = c.steer ? Math.min(1, bike.hold + dt / .35) : 0;
  if (bike.grounded) {
    bike.airT = 0;
    const sp = _v.length(), rate = 2.3 / (1 + sp / 42);
    bike.yaw += bike.steer * rate * (.5 + .5 * bike.hold) * dt * Math.min(1, sp / 3);
    _f.set(Math.sin(bike.yaw), 0, -Math.cos(bike.yaw)); _f.addScaledVector(_n, -_f.dot(_n)).normalize(); _r.crossVectors(_f, _n).normalize();
    let vf = _v.dot(_f), vr = _v.dot(_r), vn = _v.dot(_n);
    // grip: side-slip is bled off and mostly carried into forward speed (carving); braking in a turn lets the rear step out
    const grip = c.brake ? 3.5 : 9, vr2 = vr * Math.exp(-grip * dt);
    vf = Math.sign(vf || 1) * Math.sqrt(vf * vf + .75 * (vr * vr - vr2 * vr2)); vr = vr2;
    let acc = -.0066 * vf * Math.abs(vf) - .35 * Math.sign(vf);
    if (c.acc) acc += 7.5 * Math.max(0, 1 - vf / 22);
    if (c.brake) acc -= 15 * Math.sign(vf);
    if (vf > 37) acc -= (vf - 37) * 1.6;
    vf += acc * dt; if (c.brake && Math.abs(vf) < .4) vf = 0;
    if (vn > 0 && gap < .03) vn *= Math.exp(-4 * dt); // settle small bounces, keep real launches
    _v.copy(_f).multiplyScalar(vf).addScaledVector(_r, vr).addScaledVector(_n, vn);
    if (c.jump) bike.charge = Math.min(1, bike.charge + dt / .5);
    else if (bike.charge > 0) { _v.y += 4.5 + 5 * bike.charge; bike.charge = 0; }
    b.setLinvel(_v, true);
  } else { bike.airT += dt; bike.charge = 0; const k = 1 - .004 * _v.length() * dt; b.setLinvel({ x: v.x * k, y: v.y, z: v.z * k }, true); }
  bike.speed = _v.length();
}
function afterStep(dt, prevSpeed) {
  const b = bike.body, v = b.linvel(), p = b.translation(), sp = Math.hypot(v.x, v.y, v.z);
  // hard impact with a tree / rock / gate post: wipe out
  if (S.crashT <= 0 && S.count <= 0 && S.state === 'race' && prevSpeed - sp > 9 && prevSpeed > 12) { S.crashT = 1.5; msg('WIPEOUT!'); }
  if (S.crashT > 0) { S.crashT -= dt; if (S.crashT <= 0) respawn(false); }
  if (Math.abs(p.x) > HALF_W - 4 || p.y < hAt(p.x, p.z) - 3) respawn(false);
}
function gatesLogic(prevZ) {
  const p = bike.body.translation(), g = gates[S.gate]; if (!g || S.state !== 'race') return;
  if (prevZ > g.z && p.z <= g.z) {
    if (Math.abs(p.x - g.x) < GATE_HALF) {
      if (g.finish) { S.state = 'done'; $('resT').textContent = fmtT(S.time); $('resSub').textContent = 'ROCKY MOUNTAIN · ' + (gates.length - 1) + ' GATES'; setTimeout(() => { if (S.state === 'done') show('scrRes'); }, 2200); msg('FINISH!', 2.2); }
      else { msg('CHECKPOINT ' + S.gate, 1.2); }
      S.gate++; S.missed = false; $('hWarn').textContent = '';
    } else { S.missed = true; $('hWarn').textContent = 'MISSED GATE — PRESS R TO RETURN'; }
  }
}

// ---------------------------------------------------------------- camera
const cam = { yaw: 0, y: 0, ly: 0, fov: 68, roll: 0, init: false };
function updCamera(dt) {
  const p = bike.body.translation(), v = bike.body.linvel(), sp = Math.hypot(v.x, v.z), k = clamp(sp / 34, 0, 1.3);
  const yawT = sp > 3 ? lerp(bike.yaw, Math.atan2(v.x, -v.z), .5) : bike.yaw;
  if (!cam.init) { cam.yaw = bike.yaw; cam.y = p.y + 2; cam.ly = p.y + .8; cam.init = true; }
  let dy = yawT - cam.yaw; while (dy > PI) dy -= TAU; while (dy < -PI) dy += TAU;
  cam.yaw += dy * (1 - Math.exp(-dt * 5));
  const fx = Math.sin(cam.yaw), fz = -Math.cos(cam.yaw), dist = 4.6 + k * 1.6, cx = p.x - fx * dist, cz = p.z - fz * dist;
  const gy = hAt(cx, cz);
  cam.y += (p.y + 1.55 + k * .25 - cam.y) * (1 - Math.exp(-dt * (bike.grounded ? 10 : 5)));
  if (cam.y < gy + .9) cam.y = gy + .9;
  const ahead = hAt(p.x + fx * 10, p.z + fz * 10), lyT = lerp(p.y + .7, ahead + 1.6, .5); cam.ly += (lyT - cam.ly) * (1 - Math.exp(-dt * 8));
  const shake = Math.max(0, k - .55) * .05, t = S.t * 40;
  camera.position.set(cx + Math.sin(t) * shake, cam.y + Math.sin(t * 1.3) * shake, cz);
  camera.up.set(0, 1, 0); camera.lookAt(p.x + fx * 10, cam.ly, p.z + fz * 10);
  cam.roll += (clamp(bike.steer * .3 * Math.min(1, sp / 16), -.4, .4) - cam.roll) * (1 - Math.exp(-dt * 5)); camera.rotateZ(-cam.roll);
  cam.fov += (66 + k * 22 - cam.fov) * (1 - Math.exp(-dt * 4)); camera.fov = cam.fov; camera.updateProjectionMatrix();
  sky.position.copy(camera.position);
  sun.target.position.set(p.x + fx * 30, p.y, p.z + fz * 30); sun.position.copy(sun.target.position).addScaledVector(SUN_DIR, 200);
}
function updBikeVisual(dt) {
  const b = bike.body, p = b.translation(), v = b.linvel(), g = bike.vis.g;
  g.position.set(p.x, p.y - R_BALL, p.z);
  // align to the ground when riding, to the flight path in the air
  if (bike.grounded) normalAt(p.x, p.z, _up); else _up.set(0, 1, 0);
  _f.set(Math.sin(bike.yaw), 0, -Math.cos(bike.yaw)); _f.addScaledVector(_up, -_f.dot(_up)).normalize(); _r.crossVectors(_f, _up).normalize(); _n.crossVectors(_r, _f);
  _m.makeBasis(_r, _n, _f.clone().negate()); _q.setFromRotationMatrix(_m);
  const down = S.crashT > 0, leanT = down ? 1.4 : -bike.steer * .42 * Math.min(1, bike.speed / 14); bike.lean += (leanT - bike.lean) * Math.min(1, dt * 8);
  const pitchT = bike.grounded ? 0 : clamp(v.y / Math.max(8, bike.speed), -.6, .6) * .6; bike.pitch += (pitchT - bike.pitch) * Math.min(1, dt * 5);
  g.quaternion.slerp(_q, Math.min(1, dt * 16)); g.rotateX(bike.pitch); g.rotateZ(bike.lean);
  bike.wheel += bike.speed * dt; for (const w of bike.vis.wheels) w.rotation.z = -bike.wheel / .39;
  bike.vis.torso.rotation.x = -.5 - bike.charge * .35 + (bike.grounded ? 0 : .25);
}

// ---------------------------------------------------------------- HUD
const fmtT = t => { const m = t / 60 | 0, s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(2); };
const hc = {}; const setTxt = (id, v) => { if (hc[id] !== v) { hc[id] = v; $(id).textContent = v; } };
function updHUD(dt) {
  const p = bike.body.translation(), g = gates[Math.min(S.gate, gates.length - 1)];
  setTxt('hTime', fmtT(S.time)); setTxt('hSpeed', Math.round(bike.speed * 2.237)); setTxt('hGate', Math.min(S.gate, gates.length - 1) + ' / ' + (gates.length - 1));
  let a = Math.atan2(g.x - p.x, -(g.z - p.z)) - bike.yaw; while (a > PI) a -= TAU; while (a < -PI) a += TAU;
  $('hArrow').style.transform = `rotate(${a}rad)`; setTxt('hDist', (g.finish ? 'FINISH ' : 'GATE ') + Math.max(0, Math.round(Math.hypot(g.x - p.x, g.z - p.z))) + ' m');
  $('hCharge').firstChild.style.width = Math.round(bike.charge * 100) + '%'; $('hCharge').style.opacity = bike.charge > .03 ? 1 : 0;
  if (S.msgT > 0) { S.msgT -= dt; if (S.msgT <= 0) $('hMsg').textContent = ''; }
  beacon.position.set(g.x, g.top + 40, g.z); beacon.visible = S.state === 'race';
}

// ---------------------------------------------------------------- main loop (fixed 120 Hz physics)
let last = 0, accT = 0;
const STEP = 1 / 120;
function tick(dt) {
  S.t += dt;
  if (S.state === 'race' || S.state === 'done' || S.state === 'menu') {
    if (S.state === 'race') {
      if (S.count > 0) { S.count -= dt; const n = Math.ceil(S.count - .4); if (n !== S.lastBeep) { S.lastBeep = n; msg(n > 0 ? String(n) : 'GO!', .9); } }
      else S.time += dt;
      if ((pressed.KeyR || pad.hit[8]) && S.count <= 0) respawn(S.missed);
    }
    const c = S.state === 'race' ? control() : { steer: 0, acc: 0, brake: 1, jump: false };
    accT += dt; let n = 0;
    while (accT >= STEP && n++ < 6) {
      accT -= STEP; const pz = bike.body.translation().z, ps = bike.speed;
      stepBike(STEP, c); world.step(); afterStep(STEP, ps); gatesLogic(pz);
    }
    if (n >= 6) accT = 0;
  }
  updBikeVisual(dt); updCamera(dt); updHUD(dt);
}
function frame(t) {
  requestAnimationFrame(frame);
  const dt = Math.min(.05, (t - last) / 1000 || .016); last = t;
  pollPad();
  if (pad.hit[9]) { if (S.state === 'race') { S.state = 'paused'; show('scrPause'); } else if (S.state === 'paused') resume(); else if (S.state === 'menu' || S.state === 'done') startRace(); }
  else if (pad.hit[0] && (S.state === 'menu' || S.state === 'done')) startRace(); else if (pad.hit[0] && S.state === 'paused') resume();
  if (S.state !== 'load' && S.state !== 'paused') tick(dt);
  if (S.state !== 'load') renderer.render(scene, camera);
  for (const k in pressed) delete pressed[k];
}

// ---------------------------------------------------------------- boot
async function boot() {
  const say = t => { $('loadMsg').textContent = t; return new Promise(r => setTimeout(r, 20)); };
  await say('physics'); await RAPIER.init();
  await say('textures & models');
  const tl = new THREE.TextureLoader(), tex = async n => { const t = await tl.loadAsync(`assets/textures/${n}.jpg`); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  const [grass, dirt, rock] = await Promise.all([tex('aerial_grass_rock'), tex('brown_mud_dry'), tex('rock_face'), loadScenery()]);
  await say('terrain'); buildGrid(); scene.add(buildTerrainMeshes({ grass, dirt, rock }));
  await say('forest & course'); const sc = new THREE.Group(); scene.add(sc); const { colliders, nTrees } = buildScenery(sc);
  await say('colliders');
  world = new RAPIER.World({ x: 0, y: -GRAV, z: 0 }); world.timestep = STEP;
  const cm = collisionMesh(); world.createCollider(RAPIER.ColliderDesc.trimesh(cm.verts, cm.idx, RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES).setFriction(0));
  for (const c of colliders) {
    const d = c.type === 'cyl' ? RAPIER.ColliderDesc.cylinder(c.h, c.r) : c.type === 'ball' ? RAPIER.ColliderDesc.ball(c.r) : RAPIER.ColliderDesc.cuboid(c.hx, c.hy, c.hz).setRotation({ x: 0, y: Math.sin((c.ry || 0) / 2), z: 0, w: Math.cos((c.ry || 0) / 2) });
    world.createCollider(d.setTranslation(c.x, c.y, c.z).setFriction(0).setRestitution(.1));
  }
  bike.body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, hAt(0, -1) + 1, -1).lockRotations().setCcdEnabled(true).setCanSleep(false));
  world.createCollider(RAPIER.ColliderDesc.ball(R_BALL).setFriction(0).setRestitution(0).setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min).setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Min).setDensity(80), bike.body);
  bike.vis = buildBike(); scene.add(bike.vis.g);
  beacon = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 90, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0x66ffaa, transparent: true, opacity: .28, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide })); scene.add(beacon);
  placeBike(0, -1, 0, 0);
  console.log(`mountain ready: ${gates.length - 1} gates, ${nTrees} trees, ${colliders.length} colliders`);
  S.state = 'menu'; show('scrMain');
  Object.assign(window, { pad, S, bike, gates, hAt, mainX, tick, renderer, scene, camera }); // debug / test hooks
}
requestAnimationFrame(frame);
boot();
