// The mountain: an open, wide heightmap mountainside with checkpoint gates, a main trail, direct shortcut lines, cliffs and kickers.
import * as THREE from 'three';

export const PI = Math.PI, TAU = Math.PI * 2;
export const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
export const lerp = (a, b, t) => a + (b - a) * t;
export const sstep = (a, b, x) => { x = clamp((x - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); };
export function RNG(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hash2(x, y) { const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n); }
export function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return lerp(lerp(hash2(xi, yi), hash2(xi + 1, yi), u), lerp(hash2(xi, yi + 1), hash2(xi + 1, yi + 1), u), v);
}
export function fbm(x, y, o = 4) { let a = .5, s = 0, f = 1; for (let i = 0; i < o; i++) { s += a * vnoise(x * f, y * f); f *= 2.03; a *= .5; } return s; }

// ---------------------------------------------------------------- course layout (d = distance down the mountain = -z)
export const HALF_W = 220, LEN = 3600, TOP = 60, CELL = 2.5;
export const GATE_HALF = 15;
const rnd = RNG(20261);
export const gates = [];   // {x, d, z, name}
{
  let x = 0;
  gates.push({ x: 0, d: 0, start: true });
  for (let d = 230, i = 0; d < LEN - 330; d += 215 + rnd() * 70, i++) { x = clamp(x + (rnd() < .5 ? -1 : 1) * (60 + rnd() * 80), -100, 100); if (i === 0) x = 40; gates.push({ x, d }); }
  gates.push({ x: clamp(x * .4, -60, 60), d: LEN - 190, finish: true });
  gates.forEach((g, i) => { g.z = -g.d; g.i = i; g.side = i % 2 ? 1 : -1; g.bulge = 36 + rnd() * 26; });
}
export const FINISH_D = gates[gates.length - 1].d;
// segment index for a given d
function segAt(d) { let i = 0; while (i < gates.length - 2 && d > gates[i + 1].d) i++; return i; }
// main trail: a wide flowing line that swings out between gates. direct line: straight between gates (steeper, rougher, with drops)
export function mainX(d) {
  if (d <= 0) return gates[0].x; if (d >= FINISH_D) return gates[gates.length - 1].x;
  const i = segAt(d), a = gates[i], b = gates[i + 1], u = (d - a.d) / (b.d - a.d);
  return lerp(a.x, b.x, sstep(0, 1, u)) + a.side * a.bulge * Math.sin(PI * u) ** 2;
}
export function directX(d) {
  if (d <= 0) return gates[0].x; if (d >= FINISH_D) return gates[gates.length - 1].x;
  const i = segAt(d), a = gates[i], b = gates[i + 1], u = (d - a.d) / (b.d - a.d);
  return lerp(a.x, b.x, u) - a.side * 10 * Math.sin(PI * u);
}
// trail masks 0..1
export function mainMask(x, d) { return 1 - sstep(4.5, 9.5, Math.abs(x - mainX(d))); }
export function directMask(x, d) { return (1 - sstep(2.2, 5.5, Math.abs(x - directX(d)))) * sstep(0, 30, d) * (1 - sstep(FINISH_D - 30, FINISH_D, d)); }

// cliffs: bands of rock steps across the whole face. The main trail ramps down through them, the direct line drops off them.
export const cliffs = [];
for (let d = 330; d < LEN - 420; d += 300 + rnd() * 90) cliffs.push({ d, H: 5 + rnd() * 5, seed: rnd() * 50 });
// kickers (natural-looking ramps) on the trails and scattered on the open face
export const kickers = [];
for (let d = 120; d < FINISH_D - 120; d += 95 + rnd() * 70) {
  const onMain = rnd() < .55, x = onMain ? mainX(d) + (rnd() - .5) * 3 : rnd() < .6 ? directX(d) : mainX(d) + (rnd() < .5 ? -1 : 1) * (25 + rnd() * 45);
  if (cliffs.some(c => Math.abs(c.d - d) < 45)) continue;
  kickers.push({ x, d, len: 7 + rnd() * 5, h: 1.3 + rnd() * 1.5, w: 3.5 + rnd() * 2.5 });
}

function slopeInt(d) { // integral of the slope profile: sustained steep descent with steeper pitches and short benches
  return .25 * d - .075 * 150 * Math.cos(d / 150) + .04 * 53 * Math.sin(d / 53 + 1);
}
function rawH(x, d) {
  const dd = clamp(d, -TOP, FINISH_D + 40);
  let h = -slopeInt(dd) + slopeInt(0);
  if (d > FINISH_D + 40) h += 0; // flat run-out
  h += (fbm(x / 240 + 5, d / 240, 3) - .5) * 46;                         // big rolling shoulders and gullies
  const ax = Math.abs(x) / HALF_W; { const a4 = ax * ax * ax * ax; h += 90 * a4 * a4; }         // valley walls keep riders on the face
  return h;
}
export function heightAt(x, z) {
  const d = -z, mm = mainMask(x, d), dm = directMask(x, d);
  let h = rawH(x, d);
  // bench-cut the main trail so it is level across its width
  if (mm > 0) h = lerp(h, rawH(mainX(d), d), mm * .75);
  // cliffs
  for (const c of cliffs) {
    const line = c.d + (vnoise(x / 70 + c.seed, c.seed) - .5) * 70, wdt = lerp(1.6, 26, mm);
    if (d > line - wdt - 2) h -= c.H * (.55 + .9 * vnoise(x / 45 + c.seed, 3.3)) * sstep(line - wdt, line + wdt, d);
  }
  const rough = (1 - .9 * mm) * (1 - .55 * dm), flat = sstep(FINISH_D + 10, FINISH_D + 50, d);
  h += (fbm(x / 34, d / 34, 3) - .5) * 5.5 * rough * (1 - flat);          // moguls / rollers
  h += (vnoise(x / 7.3, d / 7.3) - .5) * .7 * rough * (1 - flat);         // chatter
  h += (vnoise(x / 2.9 + 9, d / 2.9) - .5) * .12 * (1 - flat);
  for (const k of kickers) { const u = (d - k.d) / k.len + 1; if (u > 0 && u <= 1.12) { const lat = Math.exp(-(((x - k.x) / k.w) ** 2)); h += k.h * lat * (u <= 1 ? u * u : 1 - (u - 1) / .12); } }
  if (d < 6) h = lerp(h, rawH(0, 0) + 1.2, sstep(14, 0, Math.abs(x)) * sstep(8, -4, d)); // start pad
  return h;
}

// ---------------------------------------------------------------- sampled grid (shared by rendering, physics and scenery placement)
export const NX = Math.round(HALF_W * 2 / CELL) + 1, NZ = Math.round((LEN + TOP) / CELL) + 1;
export const H = new Float32Array(NX * NZ);
export function buildGrid() { for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) H[j * NX + i] = heightAt(-HALF_W + i * CELL, TOP - j * CELL); }
export function hAt(x, z) { // bilinear on the grid, matches the rendered / collision mesh
  const fx = clamp((x + HALF_W) / CELL, 0, NX - 1.001), fz = clamp((TOP - z) / CELL, 0, NZ - 1.001), i = fx | 0, j = fz | 0, u = fx - i, v = fz - j, k = j * NX + i;
  // match the triangle split used by the mesh (a-c-b, b-c-d)
  return u + v <= 1 ? H[k] + (H[k + 1] - H[k]) * u + (H[k + NX] - H[k]) * v : H[k + NX + 1] + (H[k + NX] - H[k + NX + 1]) * (1 - u) + (H[k + 1] - H[k + NX + 1]) * (1 - v);
}
const _n = new THREE.Vector3();
export function normalAt(x, z, out = _n) { const e = 1.2; return out.set(hAt(x - e, z) - hAt(x + e, z), 2 * e, hAt(x, z - e) - hAt(x, z + e)).normalize(); }

export function buildTerrainMeshes(textures) {
  const group = new THREE.Group(), ROWS = 48;
  const mat = new THREE.MeshStandardMaterial({ roughness: .95, metalness: 0 });
  mat.onBeforeCompile = sh => {
    sh.uniforms.tGrass = { value: textures.grass }; sh.uniforms.tDirt = { value: textures.dirt }; sh.uniforms.tRock = { value: textures.rock };
    sh.vertexShader = 'attribute vec3 splat; varying vec3 vSplat; varying vec3 vWp;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vSplat=splat; vWp=position;');
    sh.fragmentShader = 'uniform sampler2D tGrass,tDirt,tRock; varying vec3 vSplat; varying vec3 vWp;\n' + sh.fragmentShader.replace('#include <map_fragment>', `
      vec2 uv0=vWp.xz;
      vec3 g=texture2D(tGrass,uv0*.11).rgb*.55+texture2D(tGrass,uv0*.017).rgb*.5;
      vec3 dt=texture2D(tDirt,uv0*.16).rgb*.7+texture2D(tDirt,uv0*.031).rgb*.45;
      vec3 rk=texture2D(tRock,vec2(uv0.x+uv0.y*.3,vWp.y*1.4+uv0.y*.5)*.09).rgb;
      g*=mix(vec3(.75,.95,.55),vec3(1.25,1.12,.7),vSplat.z);
      vec3 c=mix(g,dt*vec3(1.15,.95,.75),smoothstep(.25,.75,vSplat.x+ (dt.r-.3)*.5*step(.01,vSplat.x)));
      c=mix(c,rk*vec3(1.1,.95,.85),smoothstep(.35,.7,vSplat.y+(rk.r-.35)*.35));
      diffuseColor.rgb*=c*1.2;`);
  };
  for (let j0 = 0; j0 < NZ - 1; j0 += ROWS) {
    const j1 = Math.min(j0 + ROWS, NZ - 1), rows = j1 - j0 + 1, nv = rows * NX;
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), spl = new Float32Array(nv * 3), idx = new Uint32Array((rows - 1) * (NX - 1) * 6);
    let v = 0, k = 0;
    for (let j = j0; j <= j1; j++) for (let i = 0; i < NX; i++, v++) {
      const x = -HALF_W + i * CELL, z = TOP - j * CELL, d = -z;
      pos[v * 3] = x; pos[v * 3 + 1] = H[j * NX + i]; pos[v * 3 + 2] = z;
      const hl = H[j * NX + Math.max(0, i - 1)], hr = H[j * NX + Math.min(NX - 1, i + 1)], hu = H[Math.max(0, j - 1) * NX + i], hd = H[Math.min(NZ - 1, j + 1) * NX + i];
      _n.set(hl - hr, 2 * CELL, hd - hu).normalize(); nor[v * 3] = _n.x; nor[v * 3 + 1] = _n.y; nor[v * 3 + 2] = _n.z;
      let dirt = Math.max(mainMask(x, d), directMask(x, d) * .8);
      for (const kk of kickers) if (Math.abs(d - kk.d + kk.len * .5) < kk.len && Math.abs(x - kk.x) < kk.w) dirt = Math.max(dirt, .9);
      spl[v * 3] = dirt; spl[v * 3 + 1] = sstep(.9, .74, _n.y); spl[v * 3 + 2] = fbm(x / 60, z / 60, 2);
    }
    for (let r = 0; r < rows - 1; r++) for (let i = 0; i < NX - 1; i++) { const a = r * NX + i, b = a + 1, c = a + NX, d = c + 1; idx[k++] = a; idx[k++] = b; idx[k++] = c; idx[k++] = b; idx[k++] = d; idx[k++] = c; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('splat', new THREE.BufferAttribute(spl, 3)); g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat); m.receiveShadow = true; group.add(m);
  }
  return group;
}
// full-resolution collision mesh for the physics engine
export function collisionMesh() {
  const verts = new Float32Array(NX * NZ * 3), idx = new Uint32Array((NX - 1) * (NZ - 1) * 6); let k = 0;
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) { const v = (j * NX + i) * 3; verts[v] = -HALF_W + i * CELL; verts[v + 1] = H[j * NX + i]; verts[v + 2] = TOP - j * CELL; }
  for (let j = 0; j < NZ - 1; j++) for (let i = 0; i < NX - 1; i++) { const a = j * NX + i, b = a + 1, c = a + NX, d = c + 1; idx[k++] = a; idx[k++] = b; idx[k++] = c; idx[k++] = b; idx[k++] = d; idx[k++] = c; }
  return { verts, idx };
}
