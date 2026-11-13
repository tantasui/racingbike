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
        const d = ((u - a) % 24) - 12, gl = Math.exp(-d * d / 50) * (fl ? .5 : 1), bb = (.1 + .1 * hash2(u, j * 3.1)) * (fl ? .7 : 1) * dark; C.push(bb + .5 * gl * dark, bb * .72 + .23 * gl * dark, bb * .6 + .06 * gl * dark); }); };
      ring(a, 4.2, .5); for (const u of rows) ring(u, 1, 1); ring(b, 4.2, .5);
      const nr = rows.length + 2, nc = PR.length; for (let r = 0; r < nr - 1; r++) for (let j = 0; j < nc - 1; j++) { const p0 = r * nc + j, p1 = p0 + nc; I.push(p0, p1, p0 + 1, p0 + 1, p1, p1 + 1); }
      addMesh(mineGeo(P, I, C), T.tun);
      for (let u = a + 6; u < b - 2; u += 8) { const i = u % L, ry = Math.atan2(-M.hx[i], -M.hz[i]), y = M.cy[i];
        for (const sd of [-1, 1]) posts.push({ x: M.cx[i] + M.rx[i] * sd * 2.95, y: y + 1.6, z: M.cz[i] + M.rz[i] * sd * 2.95, ry, sx: .3, sy: 4.1, sz: .3 });
        posts.push({ x: M.cx[i], y: y + 3.75, z: M.cz[i], ry, sx: 6.4, sy: .32, sz: .32 });
        if ((u - a - 6) % 24 === 0) { const sd = (u / 24 | 0) % 2 ? 1 : -1; lamps.push({ x: M.cx[i] + M.rx[i] * sd * 2.2, y: y + 3.3, z: M.cz[i] + M.rz[i] * sd * 2.2, sx: .22, sy: .3, sz: .22 }); }
        if (rnd() < .45) { const sd = rnd() < .5 ? -1 : 1, s = R(.5, 1.1); ore.push({ x: M.cx[i] + M.rx[i] * sd * 2.5, y: y - .3, z: M.cz[i] + M.rz[i] * sd * 2.5, sx: s, sy: s * .7, sz: s, ry: R(0, 6) }); if (rnd() < .6) gems.push({ x: M.cx[i] + M.rx[i] * sd * 2.4, y: y + s * .3, z: M.cz[i] + M.rz[i] * sd * 2.4, sx: .14, ry: R(0, 6), rx: R(0, 3) }); } }
    }
    inst(new THREE.BoxGeometry(1, 1, 1), T.timber, posts); inst(new THREE.BoxGeometry(1, 1, 1), MB(2.6, 1.35, .4), lamps); inst(new THREE.DodecahedronGeometry(1, 0), T.rock, ore); inst(new THREE.OctahedronGeometry(1, 0), MB(.35, 1.5, 1.7), gems); }
  // --- the cavern: outer wall leaning in to a roof, a central rock mass, both lit from below by the lava
  { const ax = M.ext[0], az = M.ext[1], seg = 84, rows = 11, H = 190, y0 = -18;
    const shell = fn => { const P = [], C = [], I = [];
      for (let r = 0; r <= rows; r++) for (let s = 0; s <= seg; s++) { const t = r / rows, th = (s % seg) / seg * TAU, k = fn(t) * (1 + (fbm(Math.cos(th) * 1.9 + 3 + r * .21, Math.sin(th) * 1.9 + 7, 3) - .5) * .3), y = y0 + t * H + (hash2(r, s) - .5) * 8;
        P.push(ax * k * Math.cos(th), y, az * k * Math.sin(th)); const gl = Math.exp(-Math.max(0, y + 2) / 34), b = .035 + .05 * hash2(s * 1.7, r * 2.9); C.push(b + 1.05 * gl, b * .7 + .3 * gl, b * .55 + .045 * gl); }
      for (let r = 0; r < rows; r++) for (let s = 0; s < seg; s++) { const p0 = r * (seg + 1) + s, p1 = p0 + seg + 1; I.push(p0, p1, p0 + 1, p0 + 1, p1, p1 + 1); }
      addMesh(mineGeo(P, I, C), T.cav); };
    shell(t => 1.55 * (1 - .6 * t * t)); shell(t => .5 + .55 * t * t);
    const pil = [], stal = [], far = (x, z) => { let m = 1e9; for (let i = 0; i < L; i += 12) m = Math.min(m, Math.hypot(x - M.cx[i], z - M.cz[i])); return m; };
    for (let n = 0; n < 400 && pil.length < 46; n++) { const th = R(0, TAU), k = R(.62, 1.4), x = ax * k * Math.cos(th), z = az * k * Math.sin(th); if (far(x, z) < 36) continue; const h = R(34, 105); pil.push({ x, y: y0 + h / 2, z, sx: R(7, 20), sy: h, sz: R(7, 20), ry: R(0, 6) }); }
    for (let n = 0; n < 70; n++) { const th = R(0, TAU), k = R(.6, 1.25), h = R(25, 70); stal.push({ x: ax * k * Math.cos(th), y: R(95, 150), z: az * k * Math.sin(th), sx: R(4, 11), sy: h, sz: R(4, 11), rx: PI, ry: R(0, 6) }); }
    inst(new THREE.ConeGeometry(1, 1, 6), T.rock, pil.concat(stal));
    const lg = new THREE.PlaneGeometry(ax * 4, az * 4.4, 64, 64); lg.rotateX(-PI / 2); V.lava = addMesh(lg, T.lava); }
  // --- junction signals: a gantry with one lamp per branch, readable from far back
  V.sig = M.junc.map(J => { const l = M.lanes[J.lane], q = mineLP(l, J.u - 5, MQ), ry = mineYaw(q), h = Math.hypot(q.tx, q.tz) || 1, rx = -q.tz / h, rz = q.tx / h, parts = [];
    for (const sd of [-1, 1]) parts.push({ x: q.x + rx * sd * 2.3, y: q.y + 2.4, z: q.z + rz * sd * 2.3, ry, sx: .22, sy: 5.6, sz: .22 }); parts.push({ x: q.x, y: q.y + 5.2, z: q.z, ry, sx: 5, sy: .24, sz: .24 });
    inst(new THREE.BoxGeometry(1, 1, 1), T.iron, parts);
    const lamps = [0, 1].map(k => { const m = new THREE.MeshBasicMaterial(); patch(m); const me = new THREE.Mesh(new THREE.IcosahedronGeometry(.42, 1), m); me.frustumCulled = false; const sd = k ? 1 : -1; if (J.vert) me.position.set(q.x, q.y + (k ? 3.7 : 4.65), q.z); else me.position.set(q.x + rx * sd * 1.15, q.y + 4.6, q.z + rz * sd * 1.15); world.add(me); worldGeos.push(me.geometry); return m; });
    return { J, lamps }; });
  // --- warning signs before every gap, beams, vents, buckets, rocks, pickups
  { const signs = [], sp = [];
    for (const l of M.lanes) for (const g of l.gaps) { const q = mineLP(l, g.a - 16, MQ), h = Math.hypot(q.tx, q.tz) || 1, rx = -q.tz / h, rz = q.tx / h; sp.push({ x: q.x + rx * 1.5, y: q.y + .9, z: q.z + rz * 1.5, sx: .1, sy: 2, sz: .1 }); signs.push({ x: q.x + rx * 1.5, y: q.y + 2.1, z: q.z + rz * 1.5, ry: mineYaw(q), rz: PI / 4, sx: .62, sy: .62, sz: .06 }); }
    inst(new THREE.BoxGeometry(1, 1, 1), T.iron, sp); inst(new THREE.BoxGeometry(1, 1, 1), M_(0xd9a400, 0x5a3c00), signs); }
  const sideOf = (lane, u, lat, up) => { const q = mineLP(M.lanes[lane], u, MQ), h = Math.hypot(q.tx, q.tz) || 1; return { x: q.x - q.tz / h * lat, y: q.y + up, z: q.z + q.tx / h * lat, ry: mineYaw(q), q }; };
  const head = (M.A ? M.A.cart.floorY : .29) + 1.2;                                                    // seated rider's head height above the rail
  V.beams = M.beamDef.map(b => { const p = sideOf(b.lane, b.u, 0, head + .12), me = new THREE.Mesh(new THREE.BoxGeometry(6.6, .34, .34), M_(0x6a4a22, 0x2a1800)); me.position.set(p.x, p.y, p.z); me.rotation.y = p.ry; me.frustumCulled = false; world.add(me); worldGeos.push(me.geometry); return { b, me }; });
  V.vents = M.ventDef.map(v => { const p = sideOf(v.lane, v.u, v.side * 2.3, .7), g = new THREE.CylinderGeometry(.22, .28, 1.2, 8); g.rotateZ(PI / 2); const me = new THREE.Mesh(g, T.rust); me.position.set(p.x, p.y, p.z); me.rotation.y = p.ry; me.frustumCulled = false; world.add(me); worldGeos.push(g); return { v, p }; });
  V.buckets = M.bucketDef.map(b => { const p = sideOf(b.lane, b.u, 0, 8.2), piv = new THREE.Group(); piv.position.set(p.x, p.y, p.z); piv.rotation.y = p.ry;
    const rope = new THREE.Mesh(new THREE.BoxGeometry(.07, 6, .07), T.iron); rope.position.y = -3; const bk = new THREE.Mesh(new THREE.CylinderGeometry(.75, .5, 1.1, 10), T.rust); bk.position.y = -6.3; const sw = new THREE.Group(); sw.add(rope, bk); piv.add(sw);
    const fr = new THREE.Mesh(new THREE.BoxGeometry(7, .3, .3), T.timber); piv.add(fr); for (const o of [rope, bk, fr]) { o.frustumCulled = false; worldGeos.push(o.geometry); } world.add(piv); return { b, sw }; });
  V.rocks = M.rockDef.map(k => { const p = sideOf(k.lane, k.u, 0, 0), me = new THREE.Mesh(new THREE.IcosahedronGeometry(1.05, 0), T.rock); me.frustumCulled = false; world.add(me); worldGeos.push(me.geometry); return { k, p, me }; });
  { const cm = new THREE.MeshBasicMaterial(); cm.color.setRGB(2.4, 1.5, .25); patch(cm); const cg = new THREE.BoxGeometry(.62, .62, .62); worldGeos.push(cg);
    V.picks = M.pickDef.map(([lane, u]) => { const p = sideOf(lane, u, 0, .95), me = new THREE.Mesh(cg, cm); me.position.set(p.x, p.y, p.z); me.frustumCulled = false; world.add(me); return me; }); }
  // --- pooled dynamic props: dynamite, oil slicks, spare-rail ramps
  const pool = (n, geo, mat) => Array.from({ length: n }, () => { const me = new THREE.Mesh(geo, mat); me.visible = false; me.frustumCulled = false; world.add(me); return me; });
  { const dg = new THREE.CylinderGeometry(.09, .09, .5, 8); dg.rotateX(PI / 2); const og = new THREE.CircleGeometry(1.3, 14); og.rotateX(-PI / 2); const rg = new THREE.BoxGeometry(G * 2 + .3, .1, 3.2); worldGeos.push(dg, og, rg);
    const om = new THREE.MeshBasicMaterial({ transparent: true, opacity: .85, depthWrite: false }); om.color.setRGB(.28, .1, .5); patch(om);
    V.proj = pool(4, dg, MB(2.6, .3, .2)); V.slick = pool(5, og, om); V.ramp = pool(3, rg, M_(0xb0b6c0, 0x202428)); }
  // --- the locomotive
  { const g = new THREE.Group(), add = (geo, mat, x, y, z, rx = 0, rz = 0) => { const me = new THREE.Mesh(geo, mat); me.position.set(x, y, z); me.rotation.set(rx, 0, rz); me.frustumCulled = false; g.add(me); worldGeos.push(geo); return me; };
    const blk = M_(0x16161a), red = M_(0x5a1410, 0x1a0402);
    add(new THREE.CylinderGeometry(1.05, 1.05, 4.6, 14), blk, 0, 2.05, -1.2, PI / 2); add(new THREE.BoxGeometry(2.5, 2.6, 2.3), blk, 0, 2.5, 2.1); add(new THREE.BoxGeometry(2.7, .16, 2.6), red, 0, 3.86, 2.1);
    add(new THREE.CylinderGeometry(.34, .26, 1.3, 10), blk, 0, 3.6, -2.7); add(new THREE.CylinderGeometry(.4, .4, .5, 10), blk, 0, 3.3, -.9); add(new THREE.BoxGeometry(2.3, .5, 7), red, 0, .95, 0);
    add(new THREE.ConeGeometry(1.5, 1.6, 4), red, 0, .75, -4.1, -PI / 2, PI / 4);
    V.locoWheels = []; for (const z of [-2.4, -.6, 1.2, 2.6]) for (const sd of [-1, 1]) { const wg = new THREE.CylinderGeometry(.62, .62, .14, 12); V.locoWheels.push(add(wg, red, sd * (G + .04), .62, z, 0, PI / 2)); }
    const hm = new THREE.MeshBasicMaterial(); hm.color.setRGB(3.4, 2.8, 1.6); patch(hm); add(new THREE.CircleGeometry(.42, 12), hm, 0, 2.05, -3.52, 0, 0).rotation.y = PI;
    const fm = new THREE.MeshBasicMaterial(); fm.color.setRGB(2.6, .6, .1); patch(fm); add(new THREE.BoxGeometry(1, .5, .1), fm, 0, 1.5, 3.27);
    const bm = new THREE.MeshBasicMaterial({ transparent: true, opacity: .1, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }); bm.color.setRGB(1, .8, .45); patch(bm);
    const cone = new THREE.ConeGeometry(5, 34, 12, 1, true); cone.translate(0, -17, 0); cone.rotateX(PI / 2); V.beam = add(cone, bm, 0, 2.05, -3.6);
    V.locoLight = new THREE.PointLight(0xffd6a0, 2.4, 80, 1.3); V.locoLight.position.set(0, 2.6, -7); g.add(V.locoLight);
    g.scale.setScalar(1.12); world.add(g); V.loco = g; }
  V.lavaBurst = 0;
};
function M_(c, e) { return M(c, e); }
MINE.reset = function () {
  const V = MV; if (!V.built) return; V.built = false; hemi.intensity = .85; sunL.intensity = .9; V.loco = null; V.lava = null; V.gapMesh = []; V.decks = []; V.sig = [];
  mComp.uniforms.uHeat.value = 0; mComp.uniforms.uLines.value = 0; $('hud').classList.remove('mine'); MINE.silence();
};
// ---------------------------------------------------------------- per-frame visuals
function mineRaceVis() {
  const M = MINE, V = MV; for (const d of V.decks) { for (const b of d.base) b.fall = 0; d.dirty = true; }
  const b = $('hProg'); b.innerHTML = '<i class="fin"></i><i style="left:33.3%"></i><i style="left:66.6%"></i>';
  GM.racers.forEach((r, i) => { const d = document.createElement('b'); d.style.background = d.style.color = RCSS[i]; if (i === 0) d.className = 'me'; b.appendChild(d); r.dot = d; });
  const k = document.createElement('b'); k.className = 'loco'; b.appendChild(k); V.locoDot = k; V.clk = 0; V.whT = 5;
  for (const r of GM.racers) mineCartVis(r, 0);
}
function mineFrameVis(dt) {
  const M = MINE, V = MV, t = GM.time, pl = GM.demo ? (GM.order[0] || GM.player) : GM.player; if (!V.built) return;
  for (const r of GM.racers) { r.onTrestle = r.mode === 0 ? (M.trestles.find(q => q.lane === r.lane && r.u > q.a && r.u < q.b) || { dmg: 0 }).dmg : 0; mineCartVis(r, dt); }
  if (V.lava) V.lava.position.y = M.lavaY;
  for (const g of V.gapMesh) g.me.visible = !mineGapOn(g.g);
  // switch signals: red blinking = that branch is closed to you; green = open (brighter = where the switch rests)
  for (const s of V.sig) { const J = s.J, lock = J.lockT > 0, bl = Math.sin(GM.t * 14) > 0; for (let k = 0; k < 2; k++) { const c = s.lamps[k].color; if (lock) { if (k === J.forced) c.setRGB(.4, 3, .7); else c.setRGB(bl ? 3.4 : .5, .15, .08); } else c.setRGB(.25, k === J.rest ? 2.2 : .7, k === J.rest ? .5 : .16); } }
