// ============================================================ TRACK: curvilinear course model (s = distance, d = lateral offset)
const DS = 2;
let track = null, course = null;

class TrackBuilder {
  constructor() { this.segs = []; this.len = 0; this.feat = []; this.w = 9; }
  // straight / curve segment: length, target heading (deg), slope (rise/run), opts {w, L, R} (side: 0 cliff, 1 wall, 2 lava)
  s(len, hd, slope, o = {}) { this.w = o.w ?? this.w; this.segs.push({ s0: this.len, len, hd: hd * PI / 180, slope, w: this.w, L: o.L ?? 0, R: o.R ?? 0 }); this.len += len; return this; }
  ramp(len, H, gap = 0) { this.feat.push({ t: 'ramp', s: this.len - len, len, H, gap }); return this; }
  drop(H) { this.feat.push({ t: 'drop', s: this.len, H }); return this; }
  short(side, len, off, hw, o = {}) { this.feat.push({ t: 'short', s: this.len, len, side, off, hw, dropH: o.dropH || 0, hidden: !!o.hidden }); return this; }
  zone(kind, len) { this.feat.push({ t: 'zone', kind, s: this.len, len }); return this; }
  dunes(len, amp, wl) { this.feat.push({ t: 'dunes', s: this.len, len, amp, wl }); return this; }
  cp() { this.feat.push({ t: 'cp', s: this.len }); return this; }
  geyser(ahead, d) { this.feat.push({ t: 'geyser', s: this.len + ahead, d }); return this; }
  pool(ahead, d, r) { this.feat.push({ t: 'pool', s: this.len + ahead, d, r }); return this; }
  finish() {
    const N = Math.floor(this.len / DS) + 1, A = () => new Float32Array(N), U = () => new Uint8Array(N);
    const T = { N, len: (N - 1) * DS, cx: A(), cz: A(), cy: A(), th: A(), kap: A(), wid: A(), sL: U(), sR: U(), gap: U(), zf: U(), rampF: U(), crest: U(), bo: A(), bw: A(), bh: A(), cyS: A(), cps: [0], zones: [], geysers: [], pools: [], shorts: [], lips: [], rough: .1 };
    let x = 0, z = 0, y = 0, si = 0, ph = this.segs[0].hd, psl = this.segs[0].slope, pw = this.segs[0].w;
    for (let i = 0; i < N; i++) {
      const s = i * DS;
      while (si < this.segs.length - 1 && s >= this.segs[si].s0 + this.segs[si].len) { ph = this.segs[si].hd; psl = this.segs[si].slope; pw = this.segs[si].w; si++; }
      const g = this.segs[si], u = (s - g.s0) / g.len;
      const th = lerp(ph, g.hd, sstep(0, 1, u)), sl = lerp(psl, g.slope, sstep(0, Math.min(24, g.len), s - g.s0));
      T.th[i] = th; T.wid[i] = lerp(pw, g.w, sstep(0, Math.min(30, g.len), s - g.s0)); T.sL[i] = g.L; T.sR[i] = g.R;
      T.cx[i] = x; T.cz[i] = z; T.cy[i] = y;
      x += Math.sin(th) * DS; z -= Math.cos(th) * DS; y += sl * DS;
    }
    for (let i = 0; i < N; i++) T.kap[i] = (T.th[Math.min(N - 1, i + 1)] - T.th[Math.max(0, i - 1)]) / (2 * DS);
    const I = s => clamp(Math.round(s / DS), 0, N - 1);
    for (const f of this.feat) {
      if (f.t === 'drop') { for (let i = I(f.s); i < N; i++) T.cy[i] -= f.H * sstep(0, 4, i * DS - f.s + 1); T.lips.push(f.s); }
      else if (f.t === 'ramp') {
        const i0 = I(f.s), i1 = I(f.s + f.len);
        for (let i = i0; i <= i1; i++) { const u = (i - i0) / (i1 - i0); T.cy[i] += f.H * u * u; T.rampF[i] = 1; }
        for (let i = i1 + 1; i <= i1 + Math.round(f.gap / DS); i++) T.gap[i] = 1;
        T.lips.push(i1 * DS);
      }
      else if (f.t === 'dunes') { for (let i = I(f.s); i <= I(f.s + f.len); i++) { const q = i * DS - f.s; T.cy[i] += f.amp * Math.sin(q * TAU / f.wl) * sstep(0, 25, q) * (1 - sstep(f.len - 25, f.len, q)); } }
      else if (f.t === 'short') {
        const i0 = I(f.s), i1 = I(f.s + f.len);
        for (let i = i0; i <= i1; i++) {
          const u = (i - i0) / (i1 - i0);
          if (f.hidden) {
            if (u < .03 || u > .97) continue;
            T.bo[i] = f.side * (T.wid[i] + 1 + f.hw); T.bw[i] = f.hw; T.bh[i] = -f.dropH * (1 - sstep(.5, .86, u));
          } else {
            T.bo[i] = f.side * f.off * sstep(0, .3, u) * (1 - sstep(.7, 1, u)); T.bw[i] = f.hw;
          }
        }
        T.shorts.push({ s0: f.s, s1: f.s + f.len, side: f.side, hidden: f.hidden });
      }
      else if (f.t === 'zone') {
        const bit = { ice: 1, sand: 2, white: 4, dust: 8 }[f.kind] || 0;
        if (bit) for (let i = I(f.s); i <= I(f.s + f.len); i++) T.zf[i] |= bit;
        T.zones.push({ kind: f.kind, s0: f.s, s1: f.s + f.len });
      }
      else if (f.t === 'cp') T.cps.push(f.s);
      else if (f.t === 'geyser') T.geysers.push({ s: f.s, d: f.d, ph: T.geysers.length * 1.3 });
      else if (f.t === 'pool') T.pools.push({ s: f.s, d: f.d, r: f.r });
    }
    T.lips.sort((a, b) => a - b);
    // a checkpoint must never sit just before a gap jump (respawning there at low speed would be a death loop)
    T.cps = T.cps.map(c => { for (let i = Math.max(0, I(c) - 3); i < Math.min(N, I(c + 150)); i++) if (T.gap[i]) { while (i < N && T.gap[i]) i++; return i * DS + 16; } return c; });
    for (let i = 0; i < N; i++) { let a = 0, n = 0; for (let k = -30; k <= 30; k += 3) { a += T.cy[clamp(i + k, 0, N - 1)]; n++; } T.cyS[i] = a / n; }
    for (let i = 8; i < N - 8; i++) if (T.cy[i] - (T.cy[i - 8] + T.cy[i + 8]) / 2 > .55) T.crest[i] = 1;
    T.fin = T.len - 100;
    return T;
  }
}

// --- ground query. reg: 0 road, 1 branch, 2 shoulder/cliff, 3 wall, 4 lava, 5 chasm
function ground(s, d, o) {
  const T = track; let fi = s / DS; if (fi < 0) fi = 0; else if (fi > T.N - 1.001) fi = T.N - 1.001;
  const i = fi | 0, f = fi - i, j = f < .5 ? i : i + 1;
  const h = T.cy[i] + (T.cy[i + 1] - T.cy[i]) * f, w = T.wid[i] + (T.wid[i + 1] - T.wid[i]) * f;
  o.h = h; o.w = w; o.void = false; o.wall = 0; o.lava = false; o.e = 0; o.i = j; o.surf = 0; o.edge = 9;
  if (d >= -w && d <= w) {
    o.reg = 0; o.edge = w - Math.abs(d);
    if (T.gap[j]) { o.void = true; o.reg = 5; o.y = h - 45; return o; }
    const zf = T.zf[j];
    if (zf & 1) { if (vnoise(s * .045 + 9.3, d * .13 + 2.1) > .42) o.surf = 1; } else if (zf & 2) o.surf = 2;
    o.y = h + (vnoise(s * .05, d * .15) - .5) * T.rough; return o;
  }
  const bw = T.bw[j]; let side = -1, e = 0, base = h;
  if (bw > 0) {
    const bo = T.bo[i] + (T.bo[i + 1] - T.bo[i]) * f, bh = T.bh[i] + (T.bh[i + 1] - T.bh[i]) * f, lo = bo - bw, hi = bo + bw;
    if (d >= lo && d <= hi) { o.reg = 1; o.edge = Math.min(d - lo, hi - d); o.y = h + bh; return o; }
    if (bo > 0 ? (d > w && d < lo) : (d < -w && d > hi)) {
      const sep = bo > 0 ? lo - w : -w - hi;
      if (sep < 1.6) { o.reg = 0; o.edge = 2; o.y = h + bh * ((bo > 0 ? d - w : -w - d) / Math.max(sep, .01)); return o; }
      o.void = true; o.reg = 5; o.y = h - 30; return o;
    }
    if (bo > 0 && d > hi && hi > w) { e = d - hi; base = h + bh; side = T.sR[j]; }
    else if (bo < 0 && d < lo && lo < -w) { e = lo - d; base = h + bh; side = T.sL[j]; }
  }
  if (side < 0) { if (d > 0) { e = d - w; side = T.sR[j]; } else { e = -w - d; side = T.sL[j]; } }
  o.e = e;
  if (side === 1) { o.reg = 3; o.y = base + Math.min(e, 1.5) * .5 + Math.max(0, e - 1.5) * 2.6; if (e > 1) o.wall = d > 0 ? 1 : -1; }
  else if (side === 2) { o.reg = 4; o.y = base - .4; if (e > .5) o.lava = true; }
  else { o.reg = 2; if (e <= 2.5) o.y = base - e * e * .07; else { o.void = true; o.y = base - .45 - (e - 2.5) * 1.9; } }
  return o;
}
function tpos(s, d, o) {
  const T = track; let fi = s / DS; if (fi < 0) fi = 0; else if (fi > T.N - 1.001) fi = T.N - 1.001;
  const i = fi | 0, f = fi - i, th = T.th[i] + (T.th[i + 1] - T.th[i]) * f;
  o.x = T.cx[i] + (T.cx[i + 1] - T.cx[i]) * f + Math.cos(th) * d; o.z = T.cz[i] + (T.cz[i + 1] - T.cz[i]) * f + Math.sin(th) * d; o.th = th; return o;
}
function arrAt(a, s) { let fi = s / DS; if (fi < 0) fi = 0; else if (fi > track.N - 1.001) fi = track.N - 1.001; const i = fi | 0; return a[i] + (a[i + 1] - a[i]) * (fi - i); }
const kapAt = s => arrAt(track.kap, s);
// index of track sample whose world z matches (track z is monotonic)
function idxAtZ(z) { const T = track; let a = 0, b = T.N - 1; while (b - a > 1) { const m = (a + b) >> 1; if (T.cz[m] > z) a = m; else b = m; } return a; }
function farH(i, dx, x, z) {
  const a = Math.abs(dx), F = course.far;
  let y = track.cyS[i] - 24 - F.drop * sstep(60, 300, a);
  y += (fbm(x * .004 + 3.1, z * .004 + 1.7) - .5) * F.hill * sstep(110, 500, a);
  y += ridged(x * .0016 + 9.2, z * .0016) * F.mtn * sstep(380, 950, a) * (1 - .6 * sstep(1500, 2100, a));
  return y;
}

// ============================================================ COURSES
const COURSES = [
  {
    name: 'ROCKY MOUNTAIN', sub: 'Golden hour · switchbacks · falling boulders', icon: '⛰', root: 5, tempo: 132,
    sky: { type: 0, cA: [.14, .40, .88], cB: [1.0, .66, .38], cC: [1.25, 1.02, .68], cD: [.97, .9, .82] },
    fog: [.98, .68, .45], fogD: .00075, bend: { R: 280, twist: 1.0, lift: 1.5e-5 },
    sun: [-.5, .5, -.7], lightT: [1.15, .95, .7], shadowT: [.45, .4, .72],
    pal: { road: [.93, .62, .25], road2: [.78, .45, .18], edge: [.3, 1.25, 1.2], edge2: [1.3, .5, 1.1], ramp: [1.4, 1.2, .6], sh: [.6, .75, .3], cliff: [.62, .3, .22], deep: [.3, .12, .5], deepGlow: .25, wall: [.74, .43, .25], wall2: [.5, .26, .22], branch: [.86, .74, .42] },
    far: { drop: 140, hill: 70, mtn: 260, lo: [.1, .3, .36], hi: [.98, .62, .3] },
    sc: { tree: { n: 5200, c1: [.1, .42, .3], c2: [.75, .5, .15], near: 260 }, rocks: 300, lights: { n: 3500, col: [2.4, 1.3, .45], clustered: 1 }, clouds: 70, cloudCol: [1.05, .97, .9], lantern: [2.2, 1.4, .5] },
    amb: { col: [1.2, .9, .5], fall: -.2, size: .12 }, hl: [1.0, .8, .5],
    build(T) {
      T.s(160, 0, -.09, { w: 10 }).s(140, 25, -.13).s(100, 25, -.11).ramp(14, 2.4).s(110, 25, -.10).cp();
      T.short(-1, 230, 20, 3.4).s(210, -45, -.11, { w: 9, R: 1 }).s(110, -45, -.15, { R: 1 });
      T.zone('boulder', 300).s(80, 55, -.11, { w: 8.5, L: 1 }).s(160, 55, -.14, { L: 1 }).ramp(16, 3, 16).s(100, 55, -.09, { w: 9 });
      T.s(75, -50, -.11, { w: 8.5, R: 1 }).s(140, -50, -.15, { R: 1 }).cp().drop(7).s(120, -50, -.12, { w: 10 });
      T.short(1, 240, 0, 5.5, { dropH: 11, hidden: 1 }).s(220, 20, -.10, { w: 9, L: 1 }).s(140, 20, -.16).ramp(18, 3.6, 22).s(150, 20, -.08, { w: 11 }).cp();
      T.zone('boulder', 260).s(70, -55, -.12, { w: 8.5, R: 1 }).s(120, -55, -.13, { R: 1 }).s(70, 50, -.12, { L: 1 }).s(150, 50, -.14, { L: 1 }).ramp(14, 2.6).s(110, 50, -.10, { w: 10 });
      T.short(-1, 220, 19, 3.4).s(200, -30, -.12, { w: 9, R: 1 }).cp().s(170, -30, -.18, { w: 8.5 }).drop(9).s(110, -30, -.10, { w: 10 }).s(100, 0, -.10).s(110, 0, -.10).ramp(16, 3.2, 18).s(100, 0, -.11).s(130, 30, -.12);
      T.zone('boulder', 200).s(80, -45, -.11, { w: 8.5, R: 1 }).s(110, -45, -.14, { R: 1 }).cp().s(90, 40, -.11, { L: 1 }).s(170, 40, -.15, { w: 9 }).ramp(18, 4, 24);
      T.s(110, 40, -.10, { w: 11 }).s(160, 0, -.10).s(240, 0, -.07, { w: 12 });
    }
  },
  {
    name: 'SNOWY PEAK', sub: 'Moonlit night · ice · whiteout · avalanche', icon: '❄', root: 2, tempo: 124,
    sky: { type: 1, cA: [.02, .04, .2], cB: [.1, .17, .58], cC: [1.25, 1.3, 1.5], cD: [.25, 1.2, .8] },
    fog: [.11, .19, .6], fogD: .0008, bend: { R: 270, twist: -1.1, lift: 1.5e-5 },
    sun: [.4, .6, -.6], lightT: [.8, .9, 1.25], shadowT: [.22, .28, .7],
    pal: { road: [.36, .52, .98], road2: [.52, .68, 1.05], edge: [1.6, .8, .22], edge2: [.4, 1.3, 1.0], ramp: [1.5, .75, .2], sh: [.62, .74, 1.05], cliff: [.18, .26, .62], deep: [.06, .1, .4], deepGlow: .2, wall: [.3, .42, .88], wall2: [.58, .7, 1.05], branch: [.46, .58, .95], ice: [.55, 1.05, 1.2] },
    far: { drop: 150, hill: 80, mtn: 300, lo: [.05, .1, .4], hi: [.55, .7, 1.05] },
    sc: { tree: { n: 4200, c1: [.08, .22, .5], c2: [.6, .75, 1.0], near: 240 }, rocks: 150, lights: { n: 6500, col: [2.5, 1.2, .35], clustered: 0 }, clouds: 0, lantern: [2.4, 1.2, .35] },
    amb: { col: [.9, 1.0, 1.3], fall: -2.5, size: .1 }, hl: [.7, .85, 1.2],
    build(T) {
      T.s(170, 0, -.10, { w: 10 }).s(150, -30, -.13).s(90, -30, -.11).ramp(14, 2.6).zone('ice', 220).s(200, -30, -.09).cp();
      T.short(1, 240, 20, 3.4).s(220, 40, -.11, { w: 9, L: 1 }).s(100, 40, -.15).zone('white', 300).s(160, 40, -.10, { w: 10 });
      T.s(90, -40, -.11, { w: 9, R: 1 }).s(170, -40, -.13, { R: 1 }).ramp(16, 3, 18).s(60, -40, -.12, { w: 11, R: 1 }).cp();
      T.zone('avalanche', 640).s(120, -40, -.15, { w: 11, R: 1 }).s(200, -10, -.14, { R: 1 }).s(240, 20, -.15, { L: 1 }).drop(8).s(140, 20, -.09, { w: 10 }).cp();
      T.zone('ice', 260).short(-1, 250, 0, 5.5, { dropH: 10, hidden: 1 }).s(230, -50, -.10, { w: 9, R: 1 }).s(150, -50, -.14).ramp(18, 3.6, 22).s(130, -50, -.09);
      T.s(80, 45, -.12, { w: 8.5, L: 1 }).s(150, 45, -.13, { L: 1 }).cp().zone('white', 240).s(170, 10, -.11, { w: 10 });
      T.zone('ice', 200).short(1, 220, 19, 3.4).s(210, 65, -.10, { w: 9, L: 1 }).s(120, 65, -.16).drop(10).s(110, 65, -.10, { w: 10 }).s(120, 20, -.10).cp().s(170, -20, -.12).s(100, -20, -.12).ramp(16, 3.2, 18);
      T.s(120, -20, -.11).s(80, -60, -.11, { w: 8.5, R: 1 }).s(170, -60, -.14).ramp(18, 4, 24).s(110, -60, -.10, { w: 11 }).s(170, 0, -.10).s(240, 0, -.07, { w: 12 });
    }
  },
  {
    name: 'LAVA VOLCANIC ZONE', sub: 'Night · molten rivers · geysers', icon: '🌋', root: 0, tempo: 140,
    sky: { type: 2, cA: [.06, .01, .1], cB: [.45, .06, .03], cC: [2.2, .9, .2], cD: [1.6, .6, .15] },
    fog: [.36, .05, .04], fogD: .0008, bend: { R: 260, twist: 1.2, lift: 1.5e-5 },
    sun: [.3, .7, .5], lightT: [1.1, .6, .45], shadowT: [.35, .22, .5],
    pal: { road: [.17, .14, .22], road2: [.26, .2, .27], edge: [1.7, .55, .1], edge2: [.3, 1.2, 1.3], ramp: [1.6, .3, .7], sh: [.22, .15, .18], cliff: [.14, .07, .12], deep: [1.3, .32, .05], deepGlow: 1.3, wall: [.18, .11, .16], wall2: [.34, .13, .11], branch: [.26, .2, .32], lava: [1.5, .45, .07] },
    far: { drop: 130, hill: 60, mtn: 280, lo: [.07, .03, .09], hi: [.3, .11, .13], veins: 1 },
    sc: { tree: { n: 2600, c1: [.1, .05, .1], c2: [.28, .1, .12], near: 160, spire: 1 }, rocks: 300, lights: { n: 1800, col: [2.6, .8, .15], clustered: 0 }, clouds: 0, lantern: [2.6, .9, .2] },
    amb: { col: [1.8, .7, .15], fall: 2.2, size: .1 }, hl: [1.1, .8, .6],
    build(T) {
      const B = { L: 2, R: 2 };
      T.s(160, 0, -.09, { w: 10, ...B }).s(150, 35, -.12, B).pool(60, -4, 3.2).geyser(130, 3).s(190, 35, -.10, { w: 11, ...B }).cp();
      T.short(-1, 240, 20, 3.4).s(220, -35, -.11, { w: 10, R: 2 }).s(150, -35, -.13, B).ramp(16, 3, 18);
      T.pool(70, 4, 3.4).pool(125, -3, 3).geyser(175, 2).s(220, -35, -.09, { w: 11, ...B }).s(85, 50, -.11, { w: 9, L: 1, R: 2 }).s(140, 50, -.14, { L: 1, R: 2 }).cp().drop(8);
      T.geyser(70, -3).geyser(130, 3).s(180, 50, -.10, { w: 11, ...B }).short(-1, 250, 0, 5.5, { dropH: 10, hidden: 1 }).s(230, -20, -.10, { w: 10, R: 2 }).s(150, -20, -.12, B).ramp(18, 3.6, 22).s(120, -20, -.11, B).cp();
      T.pool(50, 0, 3.4).pool(105, 5, 3).pool(160, -5, 3).s(210, -20, -.10, { w: 12, ...B }).s(80, -70, -.11, { w: 9, R: 1, L: 2 }).s(120, -70, -.14, { R: 1, L: 2 });
      T.short(1, 240, 20, 3.4).s(220, 10, -.10, { w: 10, L: 2 }).cp().s(140, 10, -.16, B).drop(10);
      T.pool(60, -4, 3.2).geyser(115, 3).pool(165, 4, 3).s(210, 10, -.09, { w: 12, ...B }).s(85, 60, -.11, { w: 9, L: 1, R: 2 }).s(170, 60, -.13, { L: 1, R: 2 }).ramp(18, 4, 24);
      T.s(100, 60, -.10, { w: 11, ...B }).s(150, 20, -.10, B).cp().geyser(60, 0).s(200, 0, -.08, { w: 12, ...B }).s(240, 0, -.07, { w: 13, ...B });
    }
  },
  {
    name: 'GRAND CANYON', sub: 'Sunset · gap jumps · vertical drops', icon: '🏜', root: 7, tempo: 128,
    sky: { type: 3, cA: [.36, .1, .52], cB: [1.0, .42, .15], cC: [2.0, 1.3, .45], cD: [1.0, .4, .58] },
    fog: [.96, .43, .2], fogD: .00075, bend: { R: 290, twist: -1.0, lift: 1.5e-5 },
    sun: [.1, .35, -.9], lightT: [1.2, .85, .6], shadowT: [.5, .25, .62],
    pal: { road: [.86, .42, .23], road2: [.7, .29, .19], edge: [.3, 1.2, 1.35], edge2: [1.5, 1.1, .3], ramp: [1.5, 1.1, .3], sh: [.76, .36, .2], cliff: [.62, .2, .19], deep: [.22, .05, .32], deepGlow: .3, wall: [.84, .37, .2], wall2: [.52, .15, .22], branch: [.92, .58, .32] },
    far: { drop: 170, hill: 50, mtn: 330, lo: [.36, .08, .27], hi: [.98, .47, .2], river: 1, strata: 1 },
    sc: { tree: { n: 2400, c1: [.55, .16, .2], c2: [.95, .45, .22], near: 140, spire: 1 }, rocks: 350, lights: { n: 900, col: [2.4, 1.4, .5], clustered: 1 }, clouds: 45, cloudCol: [1.05, .55, .6], lantern: [.5, 2.0, 2.2] },
    amb: { col: [1.3, .7, .35], fall: .2, size: .13 }, hl: [1.0, .75, .5],
    build(T) {
      const W = { L: 1, R: 1 };
      T.s(170, 0, -.09, { w: 12, ...W }).s(160, -30, -.13, { w: 10, ...W }).s(110, -30, -.12, W).ramp(18, 4, 30).s(150, -30, -.10, { w: 11, ...W }).cp();
      T.zone('dust', 260).s(260, 10, -.07, { w: 18, ...W }).short(1, 240, 20, 3.4).s(220, 60, -.11, { w: 10, L: 1 }).s(110, 60, -.16, { w: 9, L: 1 }).drop(12).s(130, 60, -.09, { w: 11, ...W });
      T.s(85, -45, -.11, { w: 9, R: 1 }).s(190, -45, -.14, { R: 1 }).ramp(20, 5, 38).s(170, -45, -.10, { w: 12 }).cp();
      T.short(1, 250, 0, 5.5, { dropH: 11, hidden: 1 }).s(230, 25, -.10, { w: 10, L: 1 }).s(120, 25, -.17, W).drop(14).zone('dust', 240).s(240, 0, -.06, { w: 18, ...W }).cp();
      T.s(90, -60, -.12, { w: 9, R: 1 }).s(180, -60, -.14, { R: 1 }).ramp(18, 4.2, 30).s(160, -60, -.09, { w: 11 }).short(1, 230, 20, 3.4).s(210, 10, -.11, { w: 10, L: 1 }).s(130, 10, -.15, W).cp();
      T.drop(10).s(120, 10, -.10, { w: 11, ...W }).s(85, 65, -.11, { w: 9, L: 1 }).s(190, 65, -.14, { L: 1 }).ramp(20, 5, 36).s(110, 65, -.10, { w: 12, ...W }).s(150, 20, -.10, W);
      T.zone('dust', 200).s(220, 0, -.07, { w: 16, ...W }).cp().s(120, 0, -.08, W).ramp(16, 3).s(240, 0, -.07, { w: 13, ...W });
    }
  },
  {
    name: 'SAHARA DUNES', sub: 'Starry night · soft sand · dune-crest combos', icon: '✦', root: 9, tempo: 120,
    sky: { type: 4, cA: [.02, .02, .17], cB: [.2, .1, .52], cC: [1.3, 1.1, .8], cD: [.5, .3, .95] },
    fog: [.14, .09, .44], fogD: .00075, bend: { R: 280, twist: 1.1, lift: 1.5e-5 },
    sun: [-.3, .6, -.5], lightT: [.8, .75, 1.2], shadowT: [.25, .2, .65],
    pal: { road: [.24, .21, .64], road2: [.33, .28, .76], edge: [1.7, 1.15, .3], edge2: [.3, 1.2, 1.3], ramp: [1.6, 1.2, .4], sh: [.32, .27, .7], cliff: [.15, .11, .45], deep: [.06, .04, .28], deepGlow: .2, wall: [.27, .22, .64], wall2: [.42, .32, .8], branch: [.37, .32, .8], sand: [.36, .27, .62], crest: [1.5, 1.05, .3] },
    far: { drop: 110, hill: 90, mtn: 150, lo: [.06, .04, .32], hi: [.34, .25, .78], crests: 1 },
    sc: { tree: { n: 0, near: 0 }, rocks: 120, pillars: 700, arches: 90, lights: { n: 3200, col: [2.4, 1.5, .45], clustered: 0 }, clouds: 0, lantern: [2.4, 1.5, .45] },
    amb: { col: [1.2, .95, .55], fall: .3, size: .08 }, hl: [1.0, .85, .6],
    build(T) {
      T.s(170, 0, -.08, { w: 11 }).zone('sand', 200).s(180, 25, -.11).dunes(260, 2.6, 64).s(260, 25, -.09, { w: 12 }).cp();
      T.short(-1, 240, 20, 3.4).s(220, -45, -.10, { w: 10, R: 1 }).s(150, -45, -.15).ramp(16, 3.2, 20).zone('sand', 240).s(240, -45, -.08, { w: 12 });
      T.s(85, 50, -.11, { w: 9, L: 1 }).s(140, 50, -.13, { L: 1 }).cp().dunes(300, 3.2, 72).s(300, 30, -.10, { w: 12 });
      T.short(-1, 250, 0, 5.5, { dropH: 10, hidden: 1 }).s(230, -40, -.10, { w: 10, R: 1 }).s(60, -40, -.11).drop(8).s(140, -40, -.12, { w: 11 }).cp();
      T.zone('sand', 200).s(200, -10, -.08, { w: 12 }).dunes(280, 3.4, 66).s(280, -10, -.10).s(80, -65, -.12, { w: 9, R: 1 }).s(130, -65, -.14, { R: 1 });
      T.short(1, 240, 20, 3.4).s(220, 15, -.10, { w: 10, L: 1 }).cp().s(200, 15, -.12).ramp(18, 4, 24).s(100, 15, -.11).dunes(240, 3, 60).s(240, 45, -.10, { w: 12 });
      T.s(90, -20, -.11, { w: 9, R: 1 }).s(190, -20, -.15).ramp(18, 3.6, 22).s(60, -20, -.1).cp().s(200, 0, -.09, { w: 12 }).s(240, 0, -.07, { w: 13 });
    }
  }
];
function loadTrack(ci) { course = COURSES[ci]; const b = new TrackBuilder(); course.build(b); track = b.finish(); return track; }
