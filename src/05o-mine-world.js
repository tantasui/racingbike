// ============================================================ MOLTEN MINE — cart model, world, effects, sound, camera, HUD
const MV = { built: false, mat: null, gapMesh: [], sig: [], picks: [], rocks: [], buckets: [], beams: [], vents: [], decks: [], proj: [], slick: [], ramp: [], loco: null, lava: null, clk: 0, chf: 0, whT: 4, bubT: 0, scr: null };
const _mR = new THREE.Vector3(), _mU = new THREE.Vector3(), _mB = new THREE.Vector3(), _mM = new THREE.Matrix4(), _mV = new THREE.Vector3();
function mineOrient(o, fw) { const h = Math.hypot(fw.x, fw.z) || 1; _mR.set(-fw.z / h, 0, fw.x / h); _mU.crossVectors(_mR, fw).normalize(); _mB.copy(fw).negate().normalize(); _mM.makeBasis(_mR, _mU, _mB); o.quaternion.setFromRotationMatrix(_mM); }

// ---------------------------------------------------------------- asset loading: the cart GLB (+ the rider if the Motherboard has not loaded it already)
MINE.load = function () {
  const M = MINE; if (M.loading) return M.loading;
  M.loading = (async () => {
    try {
      const EX = window.THREE_EX || {}; if (location.protocol === 'file:' || !EX.GLTFLoader) throw new Error('served from file://');
      const gl = new EX.GLTFLoader(), own = !(window.MOBO && MOBO.A && MOBO.A.rider);
      const [cart, rider] = await Promise.all([gl.loadAsync('assets/models/rides/minecart.glb'), own ? gl.loadAsync('assets/models/rider/rider.glb') : MOBO.A.rider]);
      for (const c of rider.animations) for (const tr of c.tracks) if (/Hips\.position$/.test(tr.name)) { const v = tr.values; for (let i = 3; i < v.length; i += 3) { v[i] = v[0]; v[i + 2] = v[2]; } }
      const A = { rider, cart: minePrepCart(cart) };
      { const tmp = EX.SkeletonUtils.clone(rider.scene), mx = new THREE.AnimationMixer(tmp); mx.clipAction(rider.animations.find(c => c.name === 'riding')).play(); mx.update(0); tmp.updateMatrixWorld(true);
        let hips = null; tmp.traverse(o => { if (o.isBone && /Hips$/.test(o.name)) hips = o; }); const hp = new THREE.Vector3(); hips.getWorldPosition(hp); A.hipY = hp.y; A.hipZ = hp.z; }
      M.A = A;
    } catch (e) { M.A = null; M.loadErr = String(e && e.stack || e); console.warn('Molten Mine assets unavailable, using primitives:', e.message || e); setTimeout(() => toast('MOLTEN MINE: RUN "npm run dev" FOR THE CART MODEL'), 300); }
  })();
  return M.loading;
};
// split a geometry into its connected pieces (the wheels are fused into one mesh in this model)
function mineSplit(g) {
  const pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv, idx = g.index, nv = pos.count, key = new Map(), id = new Int32Array(nv);
  for (let i = 0; i < nv; i++) { const k = pos.getX(i).toFixed(3) + ',' + pos.getY(i).toFixed(3) + ',' + pos.getZ(i).toFixed(3); let v = key.get(k); if (v === undefined) { v = key.size; key.set(k, v); } id[i] = v; }
  const par = new Int32Array(key.size); for (let i = 0; i < par.length; i++) par[i] = i; const f = x => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
  const nt = idx ? idx.count : nv, ix = i => idx ? idx.getX(i) : i;
  for (let t = 0; t < nt; t += 3) { const a = f(id[ix(t)]), b = f(id[ix(t + 1)]), c = f(id[ix(t + 2)]); par[a] = b; par[f(b)] = f(c); }
  const groups = new Map(); for (let t = 0; t < nt; t += 3) { const r = f(id[ix(t)]); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(ix(t), ix(t + 1), ix(t + 2)); }
  return [...groups.values()].map(list => {
    const P = new Float32Array(list.length * 3), Nn = new Float32Array(list.length * 3), U = new Float32Array(list.length * 2);
    list.forEach((v, i) => { P[i * 3] = pos.getX(v); P[i * 3 + 1] = pos.getY(v); P[i * 3 + 2] = pos.getZ(v); if (nor) { Nn[i * 3] = nor.getX(v); Nn[i * 3 + 1] = nor.getY(v); Nn[i * 3 + 2] = nor.getZ(v); } if (uv) { U[i * 2] = uv.getX(v); U[i * 2 + 1] = uv.getY(v); } });
    const o = new THREE.BufferGeometry(); o.setAttribute('position', new THREE.BufferAttribute(P, 3)); if (nor) o.setAttribute('normal', new THREE.BufferAttribute(Nn, 3)); if (uv) o.setAttribute('uv', new THREE.BufferAttribute(U, 2)); o.computeBoundingBox(); return o;
  });
}
function mineMerge(list) { // merge non-indexed pieces back together
  const n = list.reduce((a, g) => a + g.attributes.position.count, 0), P = new Float32Array(n * 3), Nn = new Float32Array(n * 3), U = new Float32Array(n * 2); let o = 0;
  for (const g of list) { P.set(g.attributes.position.array, o * 3); if (g.attributes.normal) Nn.set(g.attributes.normal.array, o * 3); if (g.attributes.uv) U.set(g.attributes.uv.array, o * 2); o += g.attributes.position.count; }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(P, 3)); out.setAttribute('normal', new THREE.BufferAttribute(Nn, 3)); out.setAttribute('uv', new THREE.BufferAttribute(U, 2)); return out;
}
// scale to 1.5 m long, pivot where the wheels meet the rail, wheels separated so they can spin
function minePrepCart(gltf) {
  const root = gltf.scene; root.updateMatrixWorld(true); const parts = [], box = new THREE.Box3();
  root.traverse(o => { if (o.isMesh) { const g = o.geometry.clone(); g.applyMatrix4(o.matrixWorld); g.computeBoundingBox(); box.union(g.boundingBox); parts.push({ g, m: o.material }); } });
  const sz = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3()), len = Math.max(sz.x, sz.z), k = 1.5 / len;
  const fix = new THREE.Matrix4().makeScale(k, k, k).multiply(new THREE.Matrix4().makeTranslation(-c.x, -box.min.y, -c.z)); if (sz.x > sz.z) fix.premultiply(new THREE.Matrix4().makeRotationY(PI / 2));
  const body = [], wheels = []; let floorY = .29, topY = sz.y * k;
  for (const p of parts) {
    p.g.applyMatrix4(fix); const comps = mineSplit(p.g), wood = /wood/i.test(p.m.name || '');
    const disc = comps.filter(q => { const s = q.boundingBox.getSize(new THREE.Vector3()); return s.x < s.y * .5 && Math.abs(s.y - s.z) < s.y * .25 && s.y > .2; });
    if (disc.length === 4 && !wheels.length) {
      for (const q of disc) { const cc = q.boundingBox.getCenter(new THREE.Vector3()), s = q.boundingBox.getSize(new THREE.Vector3()); q.translate(-cc.x, -cc.y, -cc.z); wheels.push({ g: q, c: cc, r: s.y / 2, m: p.m }); }
      const rest = comps.filter(q => !disc.includes(q)); if (rest.length) body.push({ g: mineMerge(rest), m: p.m, wood });
    } else {
      body.push({ g: mineMerge(comps), m: p.m, wood });
      if (wood) for (const q of comps) { const s = q.boundingBox.getSize(new THREE.Vector3()); if (s.y < .03 && s.x > .5) floorY = q.boundingBox.max.y; }
    }
  }
  const info = { origLen: len, origW: Math.min(sz.x, sz.z), origH: sz.y, origLift: box.min.y, scale: k, wheelsFused: true, wheelsSplit: wheels.length, wheelR: wheels[0] ? wheels[0].r : 0, floorY, topY };
  console.info('minecart.glb:', JSON.stringify(info));
  return { body, wheels, info, gauge: wheels[0] ? Math.abs(wheels[0].c.x) : .6, floorY, topY };
}
// one paint colour per racer over the model's wood texture; noise-masked chips and dark grain keep the wear showing through
function minePaintTex(src, col, seed) {
  const im = src.image, w = Math.min(512, im.width), h = Math.round(w * im.height / im.width), cv = document.createElement('canvas'); cv.width = w; cv.height = h; const x = cv.getContext('2d'); x.drawImage(im, 0, 0, w, h);
  const d = x.getImageData(0, 0, w, h), p = d.data, cr = (col >> 16 & 255) / 255, cg = (col >> 8 & 255) / 255, cb = (col & 255) / 255;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const o = (j * w + i) * 4, r = p[o] / 255, g = p[o + 1] / 255, b = p[o + 2] / 255, lum = r * .3 + g * .59 + b * .11;
    const n = vnoise(i * .045 + seed * 13, j * .09) * .6 + vnoise(i * .16, j * .3 + seed * 7) * .4, wear = clamp((n - .56) * 9, 0, 1), grain = clamp((.2 - lum) * 9, 0, 1), k = 1 - Math.max(wear, grain), sh = .38 + lum * 1.25;
    p[o] = 255 * clamp(lerp(r * (1 + wear * .25), cr * sh, k * .88), 0, 1); p[o + 1] = 255 * clamp(lerp(g * (1 - wear * .1), cg * sh, k * .88), 0, 1); p[o + 2] = 255 * clamp(lerp(b * (1 - wear * .2), cb * sh, k * .88), 0, 1);
  }
  x.putImageData(d, 0, 0); const t = new THREE.CanvasTexture(cv); t.flipY = src.flipY; t.encoding = THREE.sRGBEncoding; t.wrapS = src.wrapS; t.wrapT = src.wrapT; t.anisotropy = 4; return t;
}
const MPAINT = [0xe0a516, 0xc22a2a, 0x2f9a4e, 0x2a62c4, 0xd9d2c0, 0x8a44b8];
function mineCartMake(r) {
  const A = MINE.A, g = r.g = new THREE.Group(), tilt = r.tiltG = new THREE.Group(); g.add(tilt); scene.add(g); r.mats = []; r.wheels = [];
  const std = (src, o) => { const m = patch(new THREE.MeshStandardMaterial(Object.assign({ map: src.map, roughnessMap: src.roughnessMap, normalMap: src.normalMap, roughness: 1, metalness: .15, side: THREE.DoubleSide }, o))); r.mats.push(m); return m; };
  if (A) {
    const C = A.cart;
    for (const p of C.body) { let m; if (p.wood) { r.paintTex = minePaintTex(p.m.map, MPAINT[r.i], r.i + 1); m = std(p.m, { map: r.paintTex, emissiveMap: r.paintTex }); m.emissive.setRGB(.55, .55, .55); m.color.setRGB(.6, .6, .6); } else m = std(p.m, { color: 0xc9a48c }); const me = new THREE.Mesh(p.g, m); me.frustumCulled = false; tilt.add(me); }
    r.wheelMat = C.wheels[0] ? std(C.wheels[0].m, { color: 0xb89a88, emissive: 0x000000 }) : null;
    for (const w of C.wheels) { const me = new THREE.Mesh(w.g, r.wheelMat); me.position.copy(w.c); me.frustumCulled = false; tilt.add(me); r.wheels.push(me); r.wheelR = w.r; }
  } else {
    const bm = patch(new THREE.MeshLambertMaterial({ color: MPAINT[r.i] })); r.mats.push(bm); const b = new THREE.Mesh(new THREE.BoxGeometry(1.2, .8, 1.5), bm); b.position.y = .72; tilt.add(b);
    r.wheelMat = patch(new THREE.MeshLambertMaterial({ color: 0x55443a })); r.mats.push(r.wheelMat); const wg = new THREE.CylinderGeometry(.19, .19, .08, 12); wg.rotateZ(PI / 2);
    for (const [x, z] of [[-.6, -.4], [.6, -.4], [-.6, .4], [.6, .4]]) { const me = new THREE.Mesh(wg, r.wheelMat); me.position.set(x, .19, z); tilt.add(me); r.wheels.push(me); } r.wheelR = .19;
  }
  const top = A ? A.cart.topY : 1.12;
  // front lantern on a short iron arm; the player's also carries a real light down the tunnel
  const arm = new THREE.Mesh(new THREE.BoxGeometry(.04, .34, .04), M(0x1c1c20)); arm.position.set(.42, top + .12, -.74); tilt.add(arm);
  r.lampMat = new THREE.MeshBasicMaterial(); r.lampMat.color.setRGB(2.6, 1.5, .45); patch(r.lampMat); r.mats.push(r.lampMat);
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(.13, .17, .13), r.lampMat); lamp.position.set(.42, top + .34, -.74); tilt.add(lamp);
  if (r.isP) { r.light = new THREE.PointLight(0xffb060, 1.5, 36, 1.4); r.light.position.set(0, top + .5, -1.6); g.add(r.light); }
  if (A) {
    const m = THREE_EX.SkeletonUtils.clone(A.rider.scene), s = .9;
    const body = patch(new THREE.MeshLambertMaterial({ color: new THREE.Color(RCOL[r.i]).multiplyScalar(.5), emissive: new THREE.Color(RCOL[r.i]).multiplyScalar(.6) })), joints = patch(new THREE.MeshLambertMaterial({ color: 0x15171c })); r.mats.push(body, joints);
    m.traverse(o => { if (o.isMesh) { o.frustumCulled = false; o.material = /Joint/i.test(o.name) ? joints : body; } });
    const hold = r.riderG = new THREE.Group(); m.scale.setScalar(s); m.rotation.y = PI; m.position.set(0, -A.hipY * s, A.hipZ * s); hold.add(m); hold.position.set(0, A.cart.floorY + .56, .1); tilt.add(hold);
    r.mixer = new THREE.AnimationMixer(m); r.act = {}; for (const c of A.rider.animations) { const a = r.mixer.clipAction(c); r.act[c.name] = a; if (c.name !== 'riding' && c.name !== 'idle') { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; } }
    r.act.riding.play(); r.clip = 'riding';
  }
  r.tum = 0; r.ghostOn = false;
}
function mineCartKill(r) { if (!r.g) return; scene.remove(r.g); for (const m of r.mats) m.dispose(); if (r.paintTex) r.paintTex.dispose(); r.g = null; }
function mineClip(r, name, fade = .1) { if (!r.act || r.clip === name) return; const a = r.act[name], b = r.act[r.clip]; if (!a) return; a.reset(); a.setEffectiveWeight(1); a.play(); if (b) b.crossFadeTo(a, fade, false); r.clip = name; }
function mineCartVis(r, dt) {
  const M = MINE, g = r.g; if (!g) return;
  g.position.copy(r.pos); mineOrient(g, r.fw);
  const down = r.mode === 2 || r.tumble;
  if (down) { r.tum += r.spin * dt * (r.mode === 2 && r.wk !== 'lava' ? .25 : 1); r.tiltG.rotation.set(r.tum * .6, 0, r.tum); r.tiltG.position.y = .5; }
  else {
    const rock = Math.sin(r.wheel * 1.35) * .018 * Math.min(1, r.v / 9) + Math.sin(GM.t * 31 + r.i) * (r.onTrestle || 0) * .06 * (r.mode === 0 ? 1 : 0);
    const tgt = r.mode === 0 ? -(r.tip * .62 + r.c.lean * .07) + rock : -r.c.lean * .22; r.tiltG.rotation.z += (tgt - r.tiltG.rotation.z) * Math.min(1, dt * 14);
    r.tiltG.rotation.x = r.mode === 1 ? clamp(r.vel.y * .018, -.25, .25) : 0; r.tiltG.position.y = 0; r.tum = 0;
  }
  g.visible = !(r.mode === 2 && (r.wk === 'crush' || (r.wk === 'lava' && r.wt < 1.2))) && !(r.invT > 0 && (GM.t * 11 | 0) % 2 === 0);
  for (const w of r.wheels) w.rotation.x = -r.wheel / (r.wheelR || .19);
  if (r.wheelMat) r.wheelMat.emissive.setRGB(1.6 * r.heat, .32 * r.heat, .03 * r.heat);              // wheels glow when braking hard
  const gh = r.ghostT > 0; if (gh !== r.ghostOn) { r.ghostOn = gh; for (const m of r.mats) { m.transparent = gh; m.opacity = gh ? .32 : 1; m.depthWrite = !gh; } }
  r.lampMat.color.setRGB(2.6, 1.5, .45).multiplyScalar(.85 + .15 * Math.sin(GM.t * 23 + r.i * 3));
  if (r.mixer) {
    if (down) mineClip(r, 'crash', .08); else if (r.atkT > GM.t) mineClip(r, r.atkSide < 0 ? 'punch' : 'kick', .06); else mineClip(r, 'riding', .2);
    r.mixer.update(dt); r.riderG.position.y = M.A.cart.floorY + .56 - r.duck * .42; r.riderG.rotation.x = -r.duck * .55; r.riderG.rotation.z = r.mode === 0 ? r.c.lean * .16 : r.c.lean * .3;
  }
  // sparks: hard braking, tipping on two wheels, scraping
  if (r.mode === 0 && r.v > 4 && (r.heat > .35 || Math.abs(r.tip) > .45) && Math.random() < dt * 60) { const sd = Math.abs(r.tip) > .45 ? Math.sign(r.tip) : (Math.random() < .5 ? -1 : 1), i = r.ci; spawnP(r.pos.x + M.rx[i] * sd * .6, r.pos.y + .05, r.pos.z + M.rz[i] * sd * .6, -r.fw.x * r.v * .3 + (Math.random() - .5) * 3, 1 + Math.random() * 3, -r.fw.z * r.v * .3 + (Math.random() - .5) * 3, .25 + Math.random() * .3, .12, 2.6, 1.3, .3, 14); }
  if (r.surgeT > 0 || r.boostT > 0) for (let k = 0; k < 2; k++) spawnP(r.pos.x - r.fw.x * .8, r.pos.y + .7 + Math.random() * .5, r.pos.z - r.fw.z * .8, -r.fw.x * 6 + (Math.random() - .5) * 2, 1 + Math.random() * 2, -r.fw.z * 6 + (Math.random() - .5) * 2, .4, r.surgeT > 0 ? .5 : .28, 2.4, r.surgeT > 0 ? .7 : 1.2, .12, -2);
  if (r.draft > .8 && Math.random() < dt * 30) spawnP(r.pos.x + (Math.random() - .5), r.pos.y + .6 + Math.random(), r.pos.z + (Math.random() - .5), r.fw.x * r.v * .5, 0, r.fw.z * r.v * .5, .25, .1, .7, 1.2, 1.6, 0);
}

// ---------------------------------------------------------------- world
function mineRailStrip(li, a, b, P, I, G) {
  const l = MINE.lanes[li], w = .045, hh = .13; let prev = -1;
  for (let u = a; u < b + .999; u += 1) {
    const q = mineLP(l, Math.min(u, b), MQ), h = Math.hypot(q.tx, q.tz) || 1, rx = -q.tz / h, rz = q.tx / h, cur = P.length / 3;
    for (const sd of [-1, 1]) { const x = q.x + rx * sd * G, z = q.z + rz * sd * G; P.push(x - rx * w, q.y, z - rz * w, x + rx * w, q.y, z + rz * w, x - rx * w * 1.6, q.y - hh, z - rz * w * 1.6, x + rx * w * 1.6, q.y - hh, z + rz * w * 1.6); }
    if (prev >= 0) for (let r = 0; r < 2; r++) { const p0 = prev + r * 4, p1 = cur + r * 4; I.push(p0, p1, p0 + 1, p0 + 1, p1, p1 + 1, p0 + 2, p1 + 2, p0, p0, p1 + 2, p1, p0 + 1, p1 + 1, p0 + 3, p0 + 3, p1 + 1, p1 + 3); }
    prev = cur;
  }
}
function mineGeo(P, I, C) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); if (C) g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setIndex(I); return g; }
const mineYaw = q => Math.atan2(-q.tx, -q.tz); // rotation.y that points a box's -Z down the rail
MINE.build = function () {
  const M = MINE, V = MV; mineTrack(); const L = M.L, rnd = RNG(4242), R = (a, b) => a + (b - a) * rnd(), G = M.A ? M.A.cart.gauge : .6;
  V.built = true; hemi.color.setRGB(.1, .075, .075); hemi.groundColor.setRGB(1, .4, .11); hemi.intensity = 1.05; sunL.intensity = .1;
  if (!V.mat) V.mat = {
    rail: M_(0xa88a78, 0x3a2414), sleeper: M_(0x3d2817), timber: M_(0x4d341f), rock: M_(0x17100c), iron: M_(0x222228), rust: M_(0x5a3524),
    tun: patch(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide })), cav: patch(new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })),
    lava: new THREE.ShaderMaterial({
      uniforms: { uBC: BU.uBC, uBD: BU.uBD, uBP: BU.uBP, uTime, uFogC, uFogD },
      vertexShader: BEND_GLSL + 'varying vec3 vW; varying float vFD; void main(){ vec4 wp=modelMatrix*vec4(position,1.); vW=wp.xyz; vec4 mv=viewMatrix*vec4(bendW(wp.xyz),1.); vFD=-mv.z; gl_Position=projectionMatrix*mv; }',
      fragmentShader: NOISE_GLSL + FOG_GLSL + `uniform float uTime; varying vec3 vW;
void main(){ if(vBZ>uBD.z||vBA>3.1416)discard;
  vec2 p=vW.xz*.011; float f1=fb(p+vec2(uTime*.012,0.)); float f2=fb(p*2.4-vec2(0.,uTime*.02)+f1*1.6);
  float crack=1.-abs(f2*2.-1.); float glow=smoothstep(.5,.93,crack); float hot=smoothstep(.42,.75,f1);
  vec3 col=mix(vec3(.06,.014,.004),vec3(2.6,.8,.1),glow*(.3+.7*hot)); col+=vec3(.55,.12,.02)*hot*(.6+.25*sin(uTime*1.3+f1*11.));
  col+=vec3(1.4,.9,.3)*smoothstep(.93,1.,crack)*hot;
  col=mix(col,uFogC,fogF()*.5); gl_FragColor=vec4(col,1.); }`
    })
  };
  const T = V.mat;
  // --- rails: one merged mesh, plus a separate piece for every gap so it can appear / vanish (missing rail, spare rail, collapsed trestle)
  { const P = [], I = []; V.gapMesh = [];
    for (const l of M.lanes) { let cur = l.a; const gs = l.gaps.slice().sort((a, b) => a.a - b.a);
      for (const g of gs) { mineRailStrip(l.id, cur, g.a, P, I, G); const p2 = [], i2 = []; mineRailStrip(l.id, g.a, g.b, p2, i2, G); const me = addMesh(mineGeo(p2, i2), T.rail); V.gapMesh.push({ g, me }); cur = g.b; }
      mineRailStrip(l.id, cur, l.b, P, I, G); }
    addMesh(mineGeo(P, I), T.rail); }
  // --- sleepers (the collapsing trestles carry their own, which can fall)
  const inTrestle = (li, u) => M.trestles.some(t => t.lane === li && u >= t.a && u <= t.b);
  { const items = [];
    for (const l of M.lanes) for (let u = l.a + .4; u < l.b; u += .9) {
      if (inTrestle(l.id, u) || l.gaps.some(g => !g.dyn && g.lap === 0 && u > g.a - .3 && u < g.b + .3)) continue;
      const q = mineLP(l, u, MQ); if (l.id) { const o = mineLP(M.lanes[u < (l.a + l.b) / 2 ? l.from : l.to], u, MQ2); if (Math.abs(o.ox - q.ox) < 1.1 && Math.abs(o.oy - q.oy) < .4) continue; }
      items.push({ x: q.x, y: q.y - .2, z: q.z, ry: mineYaw(q), rx: Math.asin(clamp(q.ty, -1, 1)), sx: G * 2 + .55, sy: .14, sz: .24 });
    }
    inst(new THREE.BoxGeometry(1, 1, 1), T.sleeper, items); }
  // --- trestle supports under every open-air rail: A-frames down into the lava
  { const legs = [], beams = [];
    for (const l of M.lanes) for (let u = l.a + 2; u < l.b; u += 9) {
      const i = Math.round(u) % L; if (!M.env[i]) continue; const q = mineLP(l, u, MQ), hi = q.oy > 4, hw = hi ? 2.0 : .8, top = q.y - .32, bot = -16, H = top - bot, ry = mineYaw(q), rx = -q.tz / (Math.hypot(q.tx, q.tz) || 1), rz = q.tx / (Math.hypot(q.tx, q.tz) || 1);
      for (const sd of [-1, 1]) legs.push({ x: q.x + rx * sd * (hw + H * .04), y: (top + bot) / 2, z: q.z + rz * sd * (hw + H * .04), ry, rz: sd * .08, sx: .26, sy: H, sz: .26 });
      beams.push({ x: q.x, y: top - .12, z: q.z, ry, sx: hw * 2 + .7, sy: .22, sz: .26 }); if (H > 14 && !hi) beams.push({ x: q.x, y: top - 7, z: q.z, ry, sx: hw * 2 + 1.5, sy: .2, sz: .22 });
    }
    inst(new THREE.BoxGeometry(1, 1, 1), T.timber, legs.concat(beams)); }
  // --- collapsing trestle decks
  V.decks = M.trestles.map(t => {
    const l = M.lanes[t.lane], n = Math.floor((t.b - t.a) / .9), m = new THREE.InstancedMesh(new THREE.BoxGeometry(G * 2 + .9, .16, .3), T.timber, n), base = [];
    for (let j = 0; j < n; j++) { const u = t.a + j * .9, q = mineLP(l, u, MQ); base.push({ x: q.x, y: q.y - .21, z: q.z, ry: mineYaw(q), th: hash2(j, t.a), gap: u > t.gap.a - .5 && u < t.gap.b + .5, fall: 0 }); }
    m.frustumCulled = false; world.add(m); worldGeos.push(m.geometry); const d = { t, m, base, dirty: true }; return d;
  });
  // --- tunnels: rock tube with baked lantern light, timber frames, lanterns, ore
  { const PR = [[-3.3, -.45], [-3.7, 1.3], [-3.1, 3.3], [-1.6, 4.5], [0, 4.9], [1.6, 4.5], [3.1, 3.3], [3.7, 1.3], [3.3, -.45], [-3.3, -.45]], posts = [], lamps = [], ore = [], gems = [];
    for (const [a, b] of M.tunnels) {
      const P = [], C = [], I = [], rows = []; for (let u = a; u <= b; u += 4) rows.push(u); if (rows[rows.length - 1] !== b) rows.push(b);
      const ring = (u, sc, dark) => { const i = u % L; PR.forEach((p, j) => { const fl = j === 0 || j >= 8, jr = fl && sc === 1 ? 0 : (hash2(u * .37, j) - .5) * .8 * sc, jy = fl && sc === 1 ? 0 : (hash2(u * .91, j + 9) - .5) * .6 * sc, lat = p[0] * sc + jr;
        P.push(M.cx[i] + M.rx[i] * lat, M.cy[i] + (sc === 1 ? p[1] : p[1] * sc - 1.5) + jy, M.cz[i] + M.rz[i] * lat);
