// Scenery: instanced CC0 models (Kenney Nature Kit) plus built course furniture — gates, tape, banners, fences.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RNG, clamp, sstep, fbm, PI, TAU, HALF_W, LEN, TOP, FINISH_D, GATE_HALF, gates, mainX, directX, hAt, normalAt, kickers } from './terrain.js';

const loader = new GLTFLoader();
const MODELS = ['tree_pineTallA', 'tree_pineTallB', 'tree_pineTallC', 'tree_pineTallD', 'tree_pineDefaultA', 'tree_pineDefaultB', 'tree_pineRoundA', 'tree_pineRoundC', 'tree_pineSmallA', 'tree_pineSmallB',
  'rock_largeA', 'rock_largeC', 'rock_largeD', 'rock_largeF', 'rock_tallB', 'rock_tallE', 'rock_tallH', 'stone_largeA', 'stone_largeD', 'stump_roundDetailed', 'log', 'log_large', 'log_stack', 'fence_planks', 'fence_simple', 'sign', 'tent_smallOpen', 'plant_bushLarge', 'plant_bushDetailed'];
const lib = {};
// Load a model and normalise it: base on y=0, centred, height 1 (or longest side 1 for flat things). Returns [{geometry, material}]
async function loadModel(name) {
  const g = await loader.loadAsync(`assets/models/${name}.glb`);
  g.scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(g.scene), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  const s = 1 / (name.startsWith('fence') || name.startsWith('log') ? Math.max(size.x, size.z) : size.y);
  const fix = new THREE.Matrix4().makeScale(s, s, s).multiply(new THREE.Matrix4().makeTranslation(-c.x, -box.min.y, -c.z));
  const parts = [];
  g.scene.traverse(o => { if (o.isMesh) { const geo = o.geometry.clone(); geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(fix, o.matrixWorld)); o.material.roughness = 1; o.material.metalness = 0; if ((name.startsWith('tree') || name.startsWith('plant')) && o.material.color.g > o.material.color.r * 1.15) o.material.color.setRGB(.045 + .02 * (name.length % 3), .2 + .03 * (name.length % 4), .075); // pine green instead of the kit's teal
    parts.push({ geometry: geo, material: o.material }); } });
  lib[name] = { parts, aspect: Math.max(size.x, size.z) / size.y };
}
export async function loadScenery() { await Promise.all(MODELS.map(loadModel)); }

const _o = new THREE.Object3D();
// Instanced placement, split into bands down the mountain so off-screen bands are frustum-culled.
function place(group, name, items, shadow = true) {
  const BAND = 200, bands = {};
  for (const it of items) (bands[Math.floor(-it.z / BAND)] ||= []).push(it);
  for (const b in bands) for (const p of lib[name].parts) {
    const arr = bands[b], m = new THREE.InstancedMesh(p.geometry, p.material, arr.length);
    arr.forEach((it, i) => { _o.position.set(it.x, it.y, it.z); _o.rotation.set(it.rx || 0, it.ry || 0, it.rz || 0, 'YXZ'); _o.scale.set(it.sx ?? it.s, it.sy ?? it.s, it.sz ?? it.s); _o.updateMatrix(); m.setMatrixAt(i, _o.matrix); });
    m.computeBoundingSphere(); m.castShadow = shadow; m.receiveShadow = true; group.add(m);
  }
}
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
// fictional sponsor boards
const SPONSORS = [['GRAVITY CO.', '#ff3b5c', '#fff'], ['RIDGELINE', '#ffc93c', '#1a1030'], ['APEX VOLT', '#22d3ee', '#081530'], ['PINE PEAK', '#3ce07a', '#06281a'], ['DROPLINE', '#fff', '#e11d48'], ['SUMMIT FUEL', '#ff7a1a', '#fff'], ['HUCK BROS', '#a56bff', '#fff'], ['DREAMFALL', '#1a1030', '#ffc93c']];
function bannerTex(text, bg, fg, sub) {
  return canvasTex(512, 128, (c, w, h) => { c.fillStyle = bg; c.fillRect(0, 0, w, h); c.fillStyle = fg; c.globalAlpha = .18; for (let i = -1; i < 12; i++) { c.beginPath(); c.moveTo(i * 60, h); c.lineTo(i * 60 + 30, h); c.lineTo(i * 60 + 80, 0); c.lineTo(i * 60 + 50, 0); c.fill(); } c.globalAlpha = 1; c.font = `italic 900 ${sub ? 64 : 78}px "Arial Black",Impact,sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, w / 2, sub ? h * .42 : h / 2 + 4); if (sub) { c.font = '700 26px Arial'; c.fillText(sub, w / 2, h * .82); } });
}

// colliders: {type:'cyl'|'ball'|'box', x,y,z, r,h | hx,hy,hz, ry}
export function buildScenery(group) {
  const rnd = RNG(777), R = (a, b) => a + (b - a) * rnd(), colliders = [];
  const trailDist = (x, d) => Math.min(Math.abs(x - mainX(d)) - 9, Math.abs(x - directX(d)) - 5.5);
  const nearGate = (x, d) => gates.some(g => Math.abs(d - g.d) < 14 && Math.abs(x - g.x) < GATE_HALF + 4);
  const nearKicker = (x, d) => kickers.some(k => d > k.d - k.len - 6 && d < k.d + 45 && Math.abs(x - k.x) < k.w + 3);
  // --- forest: dense stands with open glades, thinning near the trails
  const trees = {}, treeNames = MODELS.filter(n => n.startsWith('tree'));
  let nTrees = 0;
  for (let n = 0; n < 34000; n++) {
    const x = R(-HALF_W - 30, HALF_W + 30), d = R(-TOP - 20, LEN - 20), z = -d;
    const td = trailDist(x, d); if (td < 0 || nearGate(x, d) || nearKicker(x, d)) continue;
    const edge = sstep(HALF_W - 70, HALF_W - 10, Math.abs(x)), dens = Math.max(edge, sstep(.42, .62, fbm(x / 90 + 2, d / 90, 2)) * .9 + .06);
    if (rnd() > dens * (.35 + .65 * sstep(0, 14, td))) continue;
    if (normalAt(x, z).y < .8) continue;
    const big = rnd(), name = treeNames[(rnd() * (big > .25 ? 8 : 10)) | 0], hgt = (name.includes('Small') ? R(4, 7) : R(9, 19)) * (1 + edge * .4), wd = hgt * lib[name].aspect * R(.85, 1.2);
    (trees[name] ||= []).push({ x, y: hAt(x, z) - .25, z, ry: R(0, TAU), sx: wd, sy: hgt, sz: wd });
    if (Math.abs(x) < HALF_W + 5) colliders.push({ type: 'cyl', x, y: hAt(x, z) + 2, z, r: Math.max(.28, wd * .055), h: 2.2 });
    nTrees++;
  }
  for (const n in trees) place(group, n, trees[n]);
  // --- boulders, stumps, logs, bushes
  const rocks = {}, rockNames = MODELS.filter(n => n.startsWith('rock') || n.startsWith('stone'));
  for (let n = 0; n < 2200; n++) {
    const x = R(-HALF_W, HALF_W), d = R(-20, LEN - 60), z = -d, td = trailDist(x, d); if (td < 1 || nearGate(x, d) || nearKicker(x, d)) continue;
    const name = rockNames[(rnd() * rockNames.length) | 0], s = (name.includes('tall') ? R(2.5, 6) : R(1, 3.6) * (rnd() < .08 ? 2.2 : 1)) * (td < 7 ? .4 : 1), // only small rocks right beside the trails
      w = s * Math.max(1, lib[name].aspect) * .5;
    (rocks[name] ||= []).push({ x, y: hAt(x, z) - s * .12, z, ry: R(0, TAU), s });
    colliders.push({ type: 'ball', x, y: hAt(x, z) + w * .35, z, r: w * .78 });
  }
  for (const n in rocks) place(group, n, rocks[n]);
  const misc = { stump_roundDetailed: [], log: [], log_large: [], plant_bushLarge: [], plant_bushDetailed: [] };
  for (let n = 0; n < 2400; n++) {
    const x = R(-HALF_W, HALF_W), d = R(-20, LEN - 40), z = -d, td = trailDist(x, d); if (td < .5 || nearKicker(x, d)) continue;
    const k = rnd(), y = hAt(x, z);
    if (k < .5) misc[rnd() < .5 ? 'plant_bushLarge' : 'plant_bushDetailed'].push({ x, y: y - .1, z, ry: R(0, TAU), s: R(.8, 1.9) });
    else if (k < .75) { misc.stump_roundDetailed.push({ x, y: y - .05, z, ry: R(0, TAU), s: R(.5, .9) }); colliders.push({ type: 'cyl', x, y: y + .3, z, r: .35, h: .35 }); }
    else { const s = R(3, 6), ry = R(0, TAU); misc[rnd() < .5 ? 'log' : 'log_large'].push({ x, y: y - .05, z, ry, s }); }
  }
  for (const n in misc) place(group, n, misc[n]);

  // --- course furniture
  const fenceItems = [], poles = [], tapeGeo = { pos: [], uv: [], idx: [] }, boards = [];
  const tapeMat = new THREE.MeshBasicMaterial({ map: canvasTex(128, 16, (c, w, h) => { c.fillStyle = '#ffd400'; c.fillRect(0, 0, w, h); c.fillStyle = '#111'; for (let i = -1; i < 9; i++) { c.beginPath(); c.moveTo(i * 16, h); c.lineTo(i * 16 + 8, h); c.lineTo(i * 16 + 16, 0); c.lineTo(i * 16 + 8, 0); c.fill(); } }), side: THREE.DoubleSide });
  tapeMat.map.wrapS = THREE.RepeatWrapping;
  const addTape = (pts) => { // pts: [{x,z}] — poles with striped tape strung between them
    pts.forEach((p, i) => {
      const y = hAt(p.x, p.z); poles.push({ x: p.x, y: y + .6, z: p.z });
      if (i === 0) return; const q = pts[i - 1], qy = hAt(q.x, q.z), b = tapeGeo.pos.length / 3, L = Math.hypot(p.x - q.x, p.z - q.z);
      tapeGeo.pos.push(q.x, qy + 1.05, q.z, q.x, qy + .9, q.z, p.x, y + 1.05, p.z, p.x, y + .9, p.z); tapeGeo.uv.push(0, 1, 0, 0, L * 1.5, 1, L * 1.5, 0); tapeGeo.idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
    });
  };
  const board = (x, z, ry, i, w = 7, h = 1.5, lift = .2) => boards.push({ x, z, ry, i, w, h, lift });
  // tape funnels into every gate, fences + sponsor boards on the outside of the big bends
  for (const g of gates) {
    if (g.start) continue;
    for (const sd of [-1, 1]) { const pts = []; for (let q = 42; q >= -8; q -= 5) { const d = g.d - q; pts.push({ x: g.x + sd * (GATE_HALF + .6 + Math.max(0, q) * .28), z: -d }); } addTape(pts); }
  }
  for (let i = 0; i < gates.length - 1; i++) {
    const a = gates[i], b = gates[i + 1], dm = (a.d + b.d) / 2, out = a.side;
    for (let d = dm - 45; d <= dm + 45; d += 3.2) { const x = mainX(d) + out * 11.5, x2 = mainX(d + 3.2) + out * 11.5, ry = -Math.atan2(x2 - x, 3.2); fenceItems.push({ x, y: hAt(x, -d) - .1, z: -d, ry: ry + PI / 2, sx: 3.5, sy: 3.5, sz: 3.5 }); colliders.push({ type: 'box', x, y: hAt(x, -d) + .5, z: -d, hx: .15, hy: .6, hz: 1.7, ry }); }
    for (let k = -1; k <= 1; k++) { const d = dm + k * 26, x = mainX(d) + out * 13.2, x2 = mainX(d + 4) + out * 13.2; board(x, -d, -Math.atan2(x2 - x, 4) - out * PI / 2, (i * 3 + k + 1) % SPONSORS.length); }
    // tape along the inside of the bend and along the direct line entrance
    const pts = []; for (let d = dm - 40; d <= dm + 40; d += 6) pts.push({ x: mainX(d) - out * 10.2, z: -d }); addTape(pts);
  }
  place(group, 'fence_planks', fenceItems);
  { const pg = new THREE.CylinderGeometry(.045, .045, 1.3, 5), m = new THREE.InstancedMesh(pg, new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: .8 }), poles.length);
    poles.forEach((p, i) => { _o.position.set(p.x, p.y, p.z); _o.rotation.set(0, 0, 0); _o.scale.set(1, 1, 1); _o.updateMatrix(); m.setMatrixAt(i, _o.matrix); }); m.frustumCulled = false; group.add(m);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(tapeGeo.pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(tapeGeo.uv, 2)); g.setIndex(tapeGeo.idx);
    const tm = new THREE.Mesh(g, tapeMat); tm.frustumCulled = false; group.add(tm); }
  const sponsorMats = SPONSORS.map(s => new THREE.MeshStandardMaterial({ map: bannerTex(s[0], s[1], s[2]), roughness: .7, side: THREE.DoubleSide }));
  const legMat = new THREE.MeshStandardMaterial({ color: 0x2a2a33, roughness: .6 }), boardGeo = new THREE.PlaneGeometry(1, 1), boxGeo = new THREE.BoxGeometry(1, 1, 1);
  for (const b of boards) { const y = hAt(b.x, b.z), m = new THREE.Mesh(boardGeo, sponsorMats[b.i]); m.position.set(b.x, y + b.lift + b.h / 2, b.z); m.rotation.y = b.ry; m.scale.set(b.w, b.h, 1); m.castShadow = true; group.add(m); }

  // --- gates: truss arches with banners; start gate and finish line
  const trussMat = new THREE.MeshStandardMaterial({ color: 0xd9dde6, metalness: .6, roughness: .35 }), accent = new THREE.MeshStandardMaterial({ color: 0xff3b5c, roughness: .5, emissive: 0x330008 });
  const cyl = new THREE.CylinderGeometry(.5, .5, 1, 8);
  gates.forEach((g, gi) => {
    const G = new THREE.Group(), y0 = Math.min(hAt(g.x - GATE_HALF, g.z), hAt(g.x + GATE_HALF, g.z)), yc = hAt(g.x, g.z), top = Math.max(yc, hAt(g.x - GATE_HALF, g.z), hAt(g.x + GATE_HALF, g.z)) + 6.5;
    for (const sd of [-1, 1]) {
      const px = g.x + sd * GATE_HALF, py = hAt(px, g.z), hgt = top - py + 1;
      for (const [ox, oz] of [[-.35, -.35], [.35, -.35], [-.35, .35], [.35, .35]]) { const m = new THREE.Mesh(cyl, trussMat); m.scale.set(.12, hgt, .12); m.position.set(px + ox, py + hgt / 2 - .5, g.z + oz); m.castShadow = true; G.add(m); }
      for (let q = 0; q < hgt - 1; q += 1.1) { const m = new THREE.Mesh(boxGeo, trussMat); m.scale.set(.82, .06, .82); m.position.set(px, py + q, g.z); G.add(m); }
      const base = new THREE.Mesh(boxGeo, accent); base.scale.set(1.3, 1.1, 1.3); base.position.set(px, py + .3, g.z); base.castShadow = true; G.add(base);
      colliders.push({ type: 'cyl', x: px, y: py + 2, z: g.z, r: .65, h: 2.5 });
      // feather flags
      const fl = new THREE.Mesh(boardGeo, sponsorMats[(gi + (sd > 0 ? 3 : 0)) % SPONSORS.length]); fl.scale.set(1.1, 4.2, 1); fl.position.set(px + sd * 2.2, py + 2.6, g.z + .5); fl.rotation.y = sd * .5; G.add(fl);
      const fp = new THREE.Mesh(cyl, legMat); fp.scale.set(.07, 5, .07); fp.position.set(px + sd * 2.2 - sd * .58, py + 2.3, g.z + .5); G.add(fp);
    }
    for (const oy of [0, .8]) for (const oz of [-.35, .35]) { const m = new THREE.Mesh(cyl, trussMat); m.scale.set(.12, GATE_HALF * 2 + .8, .12); m.rotation.z = PI / 2; m.position.set(g.x, top + oy, g.z + oz); G.add(m); }
    const label = g.start ? 'START' : g.finish ? 'FINISH' : 'CHECKPOINT ' + gi, bt = bannerTex(label, g.finish ? '#111' : g.start ? '#ffc93c' : '#ff3b5c', g.finish ? '#fff' : g.start ? '#1a1030' : '#fff', 'DREAMFALL DOWNHILL SERIES');
    const ban = new THREE.Mesh(boardGeo, new THREE.MeshStandardMaterial({ map: bt, side: THREE.DoubleSide, roughness: .7, emissive: 0xffffff, emissiveMap: bt, emissiveIntensity: .25 })); ban.scale.set(14, 3.2, 1); ban.position.set(g.x, top - 1.5, g.z + .42); ban.castShadow = true; G.add(ban);
    for (const sx of [-10.5, 10.5]) { const sb = new THREE.Mesh(boardGeo, sponsorMats[(gi * 2 + (sx > 0 ? 1 : 0)) % SPONSORS.length]); sb.scale.set(6.5, 1.5, 1); sb.position.set(g.x + sx, top - 1.5, g.z + .42); G.add(sb); }
    if (g.finish) { // chequered line on the ground, crowd barriers and tents
      const ct = canvasTex(256, 32, (c, w, h) => { for (let i = 0; i < 16; i++) for (let j = 0; j < 2; j++) { c.fillStyle = (i + j) % 2 ? '#111' : '#fff'; c.fillRect(i * 16, j * 16, 16, 16); } });
      const seg = 24, lg = new THREE.PlaneGeometry(GATE_HALF * 2, 3, seg, 1); lg.rotateX(-PI / 2); const p = lg.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, hAt(g.x + p.getX(i), g.z + p.getZ(i)) + .06 - 0);
      const line = new THREE.Mesh(lg, new THREE.MeshBasicMaterial({ map: ct, polygonOffset: true, polygonOffsetFactor: -2 })); line.position.set(g.x, 0, g.z); G.add(line);
    }
    group.add(G);
    g.top = top;
  });
  // finish paddock + start tents
  const tents = [], fin = gates[gates.length - 1];
  for (let i = 0; i < 6; i++) { const sd = i % 2 ? 1 : -1, x = fin.x + sd * (GATE_HALF + 9 + (i >> 1) * 1.5), z = fin.z - 18 - (i >> 1) * 14; tents.push({ x, y: hAt(x, z), z, ry: sd * PI / 2, s: 5.5 }); colliders.push({ type: 'ball', x, y: hAt(x, z) + 1.5, z, r: 2.6 }); }
  for (const sd of [-1, 1]) { const x = sd * 13, z = 8; tents.push({ x, y: hAt(x, z), z, ry: sd * PI / 2, s: 5 }); }
  place(group, 'tent_smallOpen', tents);
  // --- distant ranges so the descent reads as a real mountain
  { const cone = new THREE.ConeGeometry(1, 1, 7, 1), m1 = new THREE.MeshBasicMaterial({ color: 0x8a6a8f, fog: false }), m2 = new THREE.MeshBasicMaterial({ color: 0xc08a84, fog: false }), n = 70;
    const a = new THREE.InstancedMesh(cone, m1, n), b = new THREE.InstancedMesh(cone, m2, n);
    for (let i = 0; i < n; i++) for (const [im, rad, hh] of [[a, 2300, 900], [b, 3600, 1500]]) { const sd = i % 2 ? 1 : -1, z = 600 - (i / n) * (LEN + 4200), x = sd * (rad + R(-300, 500)) * (z < -LEN - 1500 ? R(0, 1) : 1), h = hh * R(.5, 1.2), w = h * R(.8, 1.5); _o.position.set(x, -LEN * .25 * R(.2, .9) + h * .25, z); _o.rotation.set(0, R(0, 6), 0); _o.scale.set(w, h, w); _o.updateMatrix(); im.setMatrixAt(i, _o.matrix); }
    a.frustumCulled = b.frustumCulled = false; b.renderOrder = -6; a.renderOrder = -5; group.add(b, a); }
  return { colliders, nTrees };
}
