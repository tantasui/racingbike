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
  sc: { tree: { n: 0, near: 0 }, rocks: 0, lights: { n: 0, col: [.3, .9, .7], clustered: 1 }, clouds: 0, lantern: [.4, 2, 1.8] },
  amb: { col: [.45, 1.5, 1.35], fall: .35, size: .085 }, hl: [.7, 1, .95],
  build(T) {
    // Six zones, one continuous descent. Wide road = open board; the main traces run along it as lanes.
    // sides: 0 board edge (cliff), 1 component wall, 2 live copper bus, 3 open flat board
    const F = { L: 3, R: 3 };
    T.zone('mb0', 640).s(150, 0, -.10, { w: 15 }).s(170, -25, -.14, { w: 15 }).ramp(16, 3, 0).s(150, -25, -.12, { w: 14, ...F }).drop(7).s(170, 10, -.11, { w: 15, ...F }).s(80, 10, -.11, { w: 15, ...F });
    T.cp().zone('mb1', 650).short(-1, 260, 24, 4.5).s(220, 40, -.11, { w: 14, L: 3, R: 2 }).s(120, 40, -.15, { w: 14, L: 3, R: 2 }).zone('solder', 300).s(160, 0, -.11, { w: 15, L: 3, R: 2 }).ramp(14, 2.6).s(150, -30, -.12, { w: 15, ...F }).s(80, -30, -.12, { w: 15, ...F });
    T.cp().zone('mb2', 650).s(170, -30, -.12, { w: 15, ...F }).s(160, 15, -.13, { w: 15, ...F }).ramp(16, 3.2, 16).s(160, 15, -.11, { w: 15, ...F }).s(160, -20, -.12, { w: 15, ...F }).s(80, -20, -.12, { w: 15, ...F });
    T.cp().zone('mb3', 650).s(160, -20, -.10, { w: 15, ...F }).s(170, 25, -.12, { w: 15, ...F }).s(160, 25, -.11, { w: 15, ...F }).drop(8).s(160, 0, -.12, { w: 15, ...F }).s(80, 0, -.12, { w: 15, ...F });
    T.cp().zone('mb4', 650).short(1, 240, 20, 3.4).zone('solder', 260).s(220, 0, -.10, { w: 15, L: 1, R: 3 }).s(160, -30, -.13, { w: 14, ...F }).ramp(16, 3.4, 20).s(120, -30, -.11, { w: 15, ...F }).s(150, 10, -.12, { w: 15, ...F }).s(80, 10, -.12, { w: 15, ...F });
    T.cp().zone('mb5', 760).s(160, 10, -.13, { w: 15, ...F }).drop(9).s(170, -15, -.12, { w: 15 }).ramp(18, 4, 22).s(150, 0, -.10, { w: 15, ...F }).s(110, 0, -.10, { w: 15, ...F }).s(280, 0, -.07, { w: 15, ...F });
  }
});

// ---------------------------------------------------------------- per-track setup (called from buildTerrain, after loadTrack)
function moboSetupTrack() {
  const T = track, N = T.N, rnd = RNG(4242); T.mb = true;
  MOBO.zb = T.zones.filter(z => z.kind.startsWith('mb')).map(z => z.s0); MOBO.zb.push(T.len);
  // --- main traces: 3 lanes per zone, right-angled jogs at 45° with rounded corners, kept in order and apart
  const L = [new Float32Array(N), new Float32Array(N), new Float32Array(N)], LW = [2.3, 1.9, 2.1];
  for (let z = 0; z < 6; z++) {
    const a = Math.round(MOBO.zb[z] / DS), b = Math.min(N - 1, Math.round(MOBO.zb[z + 1] / DS)), zr = RNG(900 + z * 31);
    let cur = [-8, 0, 8], i = a;
    while (i <= b) {
      const hold = Math.round((60 + zr() * 110) / DS);
      for (let q = 0; q < hold && i <= b; q++, i++) for (let k = 0; k < 3; k++) L[k][i] = cur[k];
      const nx = cur.slice(), k = (zr() * 3) | 0, step = (zr() < .5 ? -1 : 1) * (3 + ((zr() * 3) | 0) * 2);
      nx[k] = clamp(nx[k] + step, k === 0 ? -11.5 : nx[k - 1] + 6.5, k === 2 ? 11.5 : nx[k + 1] - 6.5);
      const jl = Math.max(1, Math.round(Math.abs(nx[k] - cur[k]) / DS)); // 45 degrees: lateral change == distance travelled
      for (let q = 1; q <= jl && i <= b; q++, i++) for (let kk = 0; kk < 3; kk++) L[kk][i] = lerp(cur[kk], nx[kk], q / jl);
      cur = nx;
    }
  }
  for (let pass = 0; pass < 2; pass++) for (const l of L) { const c = l.slice(); for (let i = 2; i < N - 2; i++) l[i] = (c[i - 2] + c[i - 1] + c[i] + c[i + 1] + c[i + 2]) / 5; } // round the corners
  for (let i = 0; i < N; i++) { const sc = Math.min(1, (T.wid[i] - 3) / 12); for (const l of L) l[i] *= sc; }
  MOBO.lanes = L; MOBO.laneW = LW;
  const laneAt = (k, s) => arrAt(L[k], s);
  MOBO.laneAt = laneAt;
  const freeD = (s, avoid = 1.4) => { // a spot on open board between traces
    const w = arrAt(T.wid, s) - 1.4, opts = [];
    for (let d = -w; d <= w; d += .5) { let ok = true; for (let k = 0; k < 3; k++) if (Math.abs(d - laneAt(k, s)) < LW[k] + avoid) ok = false; if (ok) opts.push(d); }
    return opts.length ? opts[(rnd() * opts.length) | 0] : 0;
  };
  // --- features (explicit positions, then checked against ramps / gaps / drops)
  const clear = (s, r) => { for (let q = -r; q <= r; q += 2) { const j = clamp(Math.round((s + q) / DS), 0, N - 1); if (T.gap[j] || T.rampF[j]) return false; } for (const l of T.lips) if (Math.abs(l - s) < r) return false; return true; };
  const zs = z => MOBO.zb[z];
  MOBO.vias = []; for (const [s0, s1] of [[zs(3) + 190, zs(3) + 380], [zs(4) + 60, zs(4) + 250]]) if (clear(s0, 10) && clear(s1, 10)) MOBO.vias.push({ s0, d0: freeD(s0, 1.6), s1, d1: freeD(s1, 1.6), r: 2.5 });
  MOBO.caps = []; for (const s of [zs(0) + 420, zs(1) + 560, zs(2) + 70, zs(2) + 250, zs(2) + 540, zs(4) + 430, zs(5) + 120]) if (clear(s, 14)) MOBO.caps.push({ s, d: freeD(s, 1.5), r: 2.4, ch: 1 });
  MOBO.chips = []; for (const s of [zs(3) + 95, zs(3) + 560, zs(5) + 430]) if (clear(s, 26)) MOBO.chips.push({ s });
  MOBO.towers = [];
  for (let s = zs(2) + 30; s < zs(3) - 20; s += 38 + rnd() * 30) if (clear(s, 6) && !MOBO.caps.some(c => Math.abs(c.s - s) < 18)) { const d = freeD(s, 2.6); if (Math.abs(d) < arrAt(T.wid, s) - 3) MOBO.towers.push({ s, d, r: 1.5 + rnd() * .5 }); }
  MOBO.logs = []; for (let s = zs(0) + 80; s < T.fin - 60; s += 120 + rnd() * 140) if (clear(s, 6)) { const d = freeD(s, 1.2); MOBO.logs.push({ s, d, len: 3 + rnd() * 2, r: .32 }); }
  MOBO.hot = T.shorts.filter(sh => !sh.hidden && sh.s0 >= zs(1) - 5 && sh.s0 < zs(2)).map(sh => ({ s0: sh.s0, s1: sh.s1, side: sh.side }));
  MOBO.solderZ = T.zones.filter(z => z.kind === 'solder');
  // speed pads / kicks from the generic placer must not land on top of the new features
  const busy = s => MOBO.caps.some(c => Math.abs(c.s - s) < 20) || MOBO.chips.some(c => Math.abs(c.s - s) < 40) || MOBO.vias.some(v => Math.abs(v.s0 - s) < 15 || Math.abs(v.s1 - s) < 15);
  T.pads = T.pads.filter(p => !busy(p.s)); T.kicks = T.kicks.filter(k => !busy(k.s0 + k.len));
  T.fixedKicks = T.kicks.length;
  MOBO.blobs = []; MOBO.ramps = []; MOBO.pow = -1; MOBO.black = 0; MOBO.zone = -1;
}
// small bumps on the board: seams every 48 m, solder joints, and resistor "logs" lying across the board
function moboBump(s, d) {
  let y = 0; const q = s % 48; if (q < 1.2) y += .09 * Math.sin(q / 1.2 * PI);
  const gi = Math.floor(s / 5), gj = Math.floor(d / 4); if (hash2(gi, gj) < .14) { const cs = (gi + .5) * 5, cd = (gj + .5) * 4, r2 = (s - cs) * (s - cs) + (d - cd) * (d - cd); if (r2 < .36) y += .13 * (1 - r2 / .36); }
  for (const L of MOBO.logs) { const ds = s - L.s; if (ds > -.5 && ds < .5 && Math.abs(d - L.d) < L.len / 2) y += L.r * Math.sqrt(Math.max(0, 1 - (ds / .5) ** 2)); }
  return y;
}

// ---------------------------------------------------------------- asset loading (GLB / textures / audio)
MOBO.load = function () {
  if (MOBO.loading) return MOBO.loading;
  const EX = window.THREE_EX || {};
  MOBO.loading = (async () => {
    const A = {}, base = 'assets/';
    try {
      if (location.protocol === 'file:' || !EX.GLTFLoader) throw new Error('served from file://');
      const gl = new EX.GLTFLoader(), tl = new THREE.TextureLoader();
      const glb = n => gl.loadAsync(base + 'models/' + n + '.glb');
      const tex = (n, srgb) => tl.loadAsync(base + 'textures/' + n).then(t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; if (srgb) t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t; });
      [A.chip, A.chipS, A.card, A.cpu, A.capD, A.trans, A.rider, A.bmx, A.m51c, A.m51n, A.m51r, A.m08c, A.m08n, A.m08r, A.spark] = await Promise.all([
        glb('components/microchip'), glb('components/microchip_small'), glb('components/graphics_card'), glb('components/cpu'), glb('components/capacitor'), glb('components/transistor'),
        glb('rider/rider'), glb('rides/bmx'),
        tex('metal/metal051a_color.jpg', 1), tex('metal/metal051a_normal.jpg'), tex('metal/metal051a_rough.jpg'), tex('metal/metal008_color.jpg', 1), tex('metal/metal008_normal.jpg'), tex('metal/metal008_rough.jpg'), tex('particles/spark_05.png', 1)]);
      // Metal008 is worn and rust-brown: desaturate and cool-tint it so it reads as manufactured, not old
      A.m08clean = (() => { const im = A.m08c.image, c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0); const d = x.getImageData(0, 0, c.width, c.height), p = d.data;
        for (let i = 0; i < p.length; i += 4) { const l = (p[i] * .3 + p[i + 1] * .59 + p[i + 2] * .11) / 255, v = 40 + l * 150; p[i] = v * .86; p[i + 1] = v * .93; p[i + 2] = v; } x.putImageData(d, 0, 0);
        const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.encoding = THREE.sRGBEncoding; return t; })();
      // rider: strip horizontal root motion so clips play in place on the bike
      for (const c of A.rider.animations) for (const tr of c.tracks) if (/Hips\.position$/.test(tr.name)) { const v = tr.values; for (let i = 3; i < v.length; i += 3) { v[i] = v[0]; v[i + 2] = v[2]; } }
      { const tmp = EX.SkeletonUtils.clone(A.rider.scene), mx = new THREE.AnimationMixer(tmp), clip = A.rider.animations.find(c => c.name === 'riding');
        mx.clipAction(clip).play(); mx.update(0); tmp.updateMatrixWorld(true); let hips = null; tmp.traverse(o => { if (o.isBone && /Hips$/.test(o.name)) hips = o; });
        const hp = new THREE.Vector3(); hips.getWorldPosition(hp); A.hipY = hp.y; const bb = new THREE.Box3().setFromObject(tmp); A.footY = bb.min.y; }
      // environment for metal: a soft room
      const pm = new THREE.PMREMGenerator(renderer); A.env = pm.fromScene(new EX.RoomEnvironment(), .04).texture; pm.dispose();
      // audio files (decoded once the audio context exists)
      const au = ['music/dark_synthwave', 'sfx/electric_zap', 'sfx/electric_whoosh', 'sfx/whoosh_bright_panning', 'sfx/wind_loop'];
      await Promise.all(au.map(n => fetch(base + 'audio/' + n + '.ogg').then(r => r.ok ? r.arrayBuffer() : null).then(b => { if (b) MOBO.snd.raw[n.split('/')[1]] = b; }).catch(() => { })));
      MOBO.A = A;
    } catch (e) {
      MOBO.failed = true; MOBO.A = null; console.warn('Motherboard assets unavailable, using primitives:', e.message || e);
      setTimeout(() => toast('MOTHERBOARD: RUN "npm run dev" FOR FULL ASSETS'), 300);
    }
  })();
  return MOBO.loading;
};

// ---------------------------------------------------------------- PHASE 1: the board, drawn entirely in a shader
const PCB_FS = NOISE_GLSL + FOG_GLSL + `
uniform float uTime,uPow,uPS,uPL,uFin; uniform vec3 uTI,uPh,uLW,uSun,uBC; uniform vec4 uVia[4],uCap[8],uBlack; uniform float uZB[7]; uniform vec4 uHL[6]; uniform vec3 uHLC; uniform vec4 uHot;
varying vec2 vSD; varying vec4 vInfo; varying vec3 vLane,vW;
void main(){
  if(vBZ>uBD.z||vBA>3.1416)discard;
  float s=vSD.x, d=vSD.y, reg=vInfo.x, zone=mod(vInfo.w,10.), flag=floor(vInfo.w/10.+.01);
  vec3 col=vec3(.016,.1,.048); vec3 ec=vec3(0.); float em=0.;
  bool under=uBC.y<vW.y-.25;
  float weave=(step(.5,fract(s*1.6))*2.-1.)*(step(.5,fract(d*1.6))*2.-1.)*.5+.5;               // fibreglass weave
  if(reg<1.5){
    col*=.9+.14*weave*(.6+.4*n2(vec2(s,d)*.3));
    // ---- fine traces under the solder mask (lighter green), denser in busy zones
    float busy=zone<.5?.35:zone<1.5?.55:zone<2.5?.4:zone<3.5?.92:zone<4.5?.75:.5;
    float ft=0., cu=0.;
    for(int L=0;L<2;L++){
      float sc=L==0?3.2:1.4; vec2 g=vec2(s,d)/sc; vec2 id=floor(g),f=fract(g); float h=h21(id+zone*17.+float(L)*5.);
      float wdt=L==0?.07:.11;
      if(h<busy*.45) ft=max(ft,smoothstep(wdt,wdt*.4,abs(f.y-.5)));
      else if(h<busy*.8) ft=max(ft,smoothstep(wdt,wdt*.4,abs(f.x-.5)));
      else if(h>.93&&L==0) cu=max(cu,smoothstep(.2,.14,length(f-.5)));                       // exposed pad
    }
    if(zone>3.5&&zone<4.5) ft=max(ft,smoothstep(.09,.04,abs(fract(d/1.1)-.5))*step(.35,n2(vec2(s*.02,d*.9))));   // memory: parallel bus lines
    if(zone>2.5&&zone<3.5){ vec2 bg=fract(vec2(s,d)/1.5)-.5; cu=max(cu,smoothstep(.19,.13,length(bg))*step(.55,n2(floor(vec2(s,d)/9.)*1.7))); } // BGA pad fields
    col=mix(col,vec3(.06,.24,.1),ft*.9); col=mix(col,vec3(.7,.68,.62),cu);
    // ---- main traces: wide, bright copper with per-trace intensity and current pulses
    float gapM=1., padD=1e3;
    for(int i=0;i<7;i++){ float dz=s-uZB[i]; if(abs(dz)<9.) gapM=0.; }
    for(int k=0;k<3;k++){
      float lc=k==0?vLane.x:k==1?vLane.y:vLane.z, wd=k==0?uLW.x:k==1?uLW.y:uLW.z, I=k==0?uTI.x:k==1?uTI.y:uTI.z, ph=k==0?uPh.x:k==1?uPh.y:uPh.z;
      float dist=abs(d-lc);
      for(int i=0;i<7;i++){ float dz=s-uZB[i]; padD=min(padD, length(vec2(abs(dz)-10.5, d-lc))); }
      float on=smoothstep(wd+.06,wd-.06,dist)*gapM;
      float pm=(fract((s-uTime*uPS-ph)/uPL)-.5)*uPL, pulse=exp(-pm*pm/10.);
      float edgeL=smoothstep(wd-.32,wd-.12,dist)*on;                                             // tin-plated rim so the path edges read
      float grain=.85+.15*n2(vec2(s*.8,d*3.));
      vec3 cuC=vec3(.62,.36,.15)*grain; cuC=mix(cuC,vec3(.78,.74,.66),edgeL*.8);                 // copper body, silver rim
      col=mix(col,cuC,on);
      float ii=I*(1.+uPow*2.), e1=on*(.035*ii+edgeL*.05)+uPow*on*.25;
      em+=e1; ec+=vec3(1.,.55,.2)*e1;
      float core=smoothstep(wd*.55,wd*.2,dist);
      float e2=on*core*.75*pulse; em+=e2; ec+=vec3(.55,.95,1.)*e2;
    }
    float pad=smoothstep(2.65,2.45,padD)*(1.-smoothstep(1.,.85,padD)*.6);                          // round pads where traces end
    col=mix(col,vec3(.72,.66,.55),pad); em+=pad*.04; ec+=vec3(1.,.8,.5)*pad*.04;
    // ---- board edge plating
    float ed=smoothstep(1.25,.95,vInfo.y)*step(reg,.5); col=mix(col,vec3(.8,.62,.3),ed); em+=ed*.06; ec+=vec3(1.,.7,.3)*ed*.06;
    // ---- ramps (gold chevrons) and speed pads (green chevrons)
    if(flag>.5&&flag<1.5){ float ch=step(.5,fract(s*.33+abs(d)*.16)); col=mix(col,vec3(1.,.75,.25),.55+.3*ch); em+=.12+.25*ch; ec+=vec3(1.,.7,.25)*(.12+.25*ch); }
    if(flag>1.5){ float ch=step(.5,fract(s*.45-abs(d)*.3-uTime*2.)); col=mix(col,vec3(.2,1.,.5),.6); em+=.15+.4*ch; ec+=vec3(.3,1.2,.6)*(.15+.4*ch); }
    // ---- vias: real holes (entry) and capped outlets (exit)
    for(int i=0;i<4;i++){ vec4 v=uVia[i]; if(v.z<=0.) continue; float vd=length(vec2(s-v.x,d-v.y));
      if(v.w<.5&&vd<v.z) discard;
      if(v.w>.5&&vd<v.z){ col=vec3(.02,.03,.03)+vec3(.5,.4,.2)*step(.5,fract((s-v.x)*1.4))*.4; }
      float ring=smoothstep(.75,.2,abs(vd-v.z-.45)); col=mix(col,vec3(.9,.7,.3),ring); float vg=ring*(.35+.25*sin(uTime*6.-vd*2.)); em+=vg; ec+=(v.w<.5?vec3(.3,1.2,1.3):vec3(1.,.7,.3))*vg; }
    // ---- capacitor launch pads: ring fills with charge
    for(int i=0;i<8;i++){ vec4 c=uCap[i]; if(c.z<=0.) continue; vec2 o=vec2(s-c.x,d-c.y); float cd=length(o); if(cd>c.z+1.5) continue;
      float a=atan(o.y,o.x)/6.2832+.5, fill=step(a,c.w); float ring=smoothstep(.55,.25,abs(cd-c.z));
      vec3 cc=mix(vec3(1.,.15,.1),vec3(.3,1.2,1.4),step(.999,c.w));
      col=mix(col,vec3(.72,.75,.78),smoothstep(c.z-.2,c.z-.5,cd));                                          // aluminium can top
      float kv=smoothstep(.12,.0,min(abs(o.x),abs(o.y)))*smoothstep(c.z-.4,c.z-.8,cd); col=mix(col,vec3(.35,.38,.4),kv); // K-shaped vent
      float g=ring*(fill*(.55+.3*step(.999,c.w)*sin(uTime*10.))+.05); em+=g; ec+=cc*g;
      col=mix(col,cc*.6,ring*fill); }
    // ---- hot zone (power section shortcut): branch traces glow red-hot
    if(reg>.5&&s>uHot.x&&s<uHot.y){ float ht=smoothstep(1.1,.6,abs(d-uHot.z))*(.75+.25*sin(uTime*9.+s*.4)); col=mix(col,vec3(1.,.25,.05),.35+ht*.5); em+=.12+ht*.6; ec+=vec3(1.,.3,.06)*(.12+ht*.6); }
    // ---- gold edge-connector fingers at the finish
    if(s>uFin-42.&&s<uFin+20.){ float gf=step(.32,fract(d/1.7))*smoothstep(uFin-42.,uFin-38.,s); col=mix(col,vec3(1.,.78,.32),gf); em+=gf*.3; ec+=vec3(1.,.75,.3)*gf*.3; }
  } else if(reg<2.5||reg>4.5){
    // board edge in cross-section: copper layers between fibreglass, falling away into a teal abyss
    float dep=vInfo.z, band=fract(dep*.55);
    col=mix(vec3(.025,.08,.055),vec3(.55,.36,.12),step(.84,band));
    em+=step(.86,band)*.06*smoothstep(30.,2.,dep); ec+=vec3(1.,.6,.2)*step(.86,band)*.06*smoothstep(30.,2.,dep);
    float ab=smoothstep(6.,45.,dep); col=mix(col,vec3(.0,.1,.11),ab); em+=ab*.05; ec+=vec3(.1,.55,.5)*ab*.05;
  } else if(reg<3.5){
    // component wall: stacked chip packages with status LEDs
    float row=floor(vW.y/2.2), cs=floor(s/7.+row*.37); float h=h21(vec2(cs,row));
    col=mix(vec3(.04,.05,.06),vec3(.1,.13,.15),h); col*=.75+.5*step(.12,fract(vW.y/2.2))*step(.06,fract(s/7.+row*.37));
    float led=smoothstep(.12,.0,length(vec2(fract(s/7.+row*.37)-.85,fract(vW.y/2.2)-.5)*vec2(7.,2.2)))*step(.55,h);
    vec3 lc=mix(vec3(.3,1.2,1.),vec3(1.,.5,.15),step(.8,h)); em+=led*(1.+.5*sin(uTime*3.+h*40.)); ec+=lc*led*(1.+.5*sin(uTime*3.+h*40.));
  } else {
    // exposed live copper bus bar: touching it shorts you out
    col=vec3(.8,.42,.14); float cr=pow(n2(vec2(s*.5-uTime*7.,vW.y*2.)),6.)*2.; em+=.35+cr; ec+=vec3(1.,.55,.2)*.35+vec3(.6,.9,1.)*cr;
  }
  if(under){ // bottom layer: darker, magenta traces
    col=vec3(.012,.045,.03); vec2 g=vec2(s,d)/2.6; float h=h21(floor(g)+3.); vec2 f=fract(g);
    float bt=h<.5?smoothstep(.08,.03,abs(f.y-.5)):smoothstep(.08,.03,abs(f.x-.5)); em=bt*.3; ec=vec3(1.,.25,.75)*bt*.3;
  }
  // gloss + light
  vec3 N=normalize(cross(dFdx(vW),dFdy(vW))); if(N.y<0.) N=-N; if(under) N=-N;
  vec3 V=normalize(uBC-vW), H=normalize(uSun+V);
  float dif=.32+.8*max(dot(N,uSun),0.), spec=pow(max(dot(N,H),0.),70.)*.55+pow(1.-max(dot(N,V),0.),5.)*.12;
  float hl=0.; for(int i=0;i<6;i++){ vec3 q=vW-uHL[i].xyz; hl+=uHL[i].w*exp(-dot(q,q)*.03); }
  vec3 c=col*dif+vec3(.75,.95,1.)*spec*(reg<1.5?1.:.3)+(col*.6+uHLC*.06)*min(hl,1.4);
  float bk=uBlack.w*exp(-length(vW-uBlack.xyz)/45.); ec*=1.-clamp(bk,0.,.95);
  c+=ec;
  c=mix(c,uFogC,fogF()*(1.-.35*clamp(em,0.,1.)));
  gl_FragColor=vec4(c,1.);
}`;
const PCB_VS = BEND_GLSL + `attribute vec2 aSD; attribute vec4 aInfo; attribute vec3 aLane; varying vec2 vSD; varying vec4 vInfo; varying vec3 vLane,vW; varying float vFD;
void main(){ vec4 wp=modelMatrix*vec4(position,1.); vW=wp.xyz; vec4 mv=viewMatrix*vec4(bendW(wp.xyz),1.); vFD=-mv.z; gl_Position=projectionMatrix*mv; vSD=aSD; vInfo=aInfo; vLane=aLane; }`;
MOBO.U = {
  uTI: { value: new THREE.Vector3(1, 1, 1) }, uPh: { value: new THREE.Vector3(0, 90, 170) }, uLW: { value: new THREE.Vector3(2.3, 1.9, 2.1) }, uPS: { value: 78 }, uPL: { value: 250 }, uPow: { value: 0 }, uFin: { value: 0 },
  uSun: { value: new THREE.Vector3(-.45, .75, -.5).normalize() }, uVia: { value: [0, 1, 2, 3].map(() => new THREE.Vector4()) }, uCap: { value: [0, 1, 2, 3, 4, 5, 6, 7].map(() => new THREE.Vector4()) },
  uBlack: { value: new THREE.Vector4() }, uZB: { value: [0, 0, 0, 0, 0, 0, 0] }, uHot: { value: new THREE.Vector4(-1, -1, 0, 0) }
};
let pcbMat = null;
MOBO.buildTerrain = function () {
  moboSetupTrack();
  const T = track, HW = 62, NC = HW, CH = 64, cols = NC + 1, U = MOBO.U;
  if (!pcbMat) pcbMat = new THREE.ShaderMaterial({ uniforms: Object.assign({ uBC: BU.uBC, uBD: BU.uBD, uBP: BU.uBP, uTime, uFogC, uFogD, uHL, uHLC }, U), vertexShader: PCB_VS, fragmentShader: PCB_FS, side: THREE.DoubleSide, extensions: { derivatives: true } });
  U.uZB.value = MOBO.zb.slice(0, 7).map((v, i) => i === 0 ? -99 : v); while (U.uZB.value.length < 7) U.uZB.value.push(-99);
  U.uFin.value = T.fin; U.uLW.value.set(...MOBO.laneW);
  MOBO.vias.forEach((v, i) => { if (i < 2) { U.uVia.value[i * 2].set(v.s0, v.d0, v.r, 0); U.uVia.value[i * 2 + 1].set(v.s1, v.d1, v.r, 1); } });
  const h = MOBO.hot[0]; if (h) U.uHot.value.set(h.s0, h.s1, h.side * (arrAt(T.wid, (h.s0 + h.s1) / 2) + 1 + 4.5), 0);
  const fl = new Uint8Array(T.N); // ramp / pad flags per row & lateral range (stored per vertex below)
  for (let c0 = 0; c0 < T.N - 1; c0 += CH) {
    const c1 = Math.min(c0 + CH, T.N - 1), rows = c1 - c0 + 1, nv = rows * cols;
    const pos = new Float32Array(nv * 3), sd = new Float32Array(nv * 2), info = new Float32Array(nv * 4), lane = new Float32Array(nv * 3); let v = 0;
    for (let r = 0; r < rows; r++) {
      const i = c0 + r, s = i * DS, th = T.th[i], k = T.kap[i], ct = Math.cos(th), st = Math.sin(th);
      let zone = 0; while (zone < 5 && s >= MOBO.zb[zone + 1]) zone++;
      for (let j = 0; j <= NC; j++, v++) {
        const d = -HW + j * 2; let dd = d; if (k * d > .8) dd = .8 / k;
        ground(s, d, GV); const x = T.cx[i] + ct * dd, z = T.cz[i] + st * dd;
        let y = GV.y;
        if (GV.reg === 3) y += Math.floor(GV.e / 3) * .6;                         // stepped component walls
        pos[v * 3] = x; pos[v * 3 + 1] = y; pos[v * 3 + 2] = z; sd[v * 2] = s; sd[v * 2 + 1] = d;
        let flag = 0;
        if (GV.reg === 0) { if (T.rampF[i]) flag = 1; for (const kk of T.kicks) if (s > kk.s0 - 1 && s < kk.s0 + kk.len + 1 && Math.abs(d - kk.d) < kk.hw + .5) flag = 1; for (const p of T.pads) if (Math.abs(s - p.s) < 4.5 && Math.abs(d - p.d) < 2.8) flag = 2; }
        const flat = GV.reg === 2 && !GV.void && (d > 0 ? T.sR[i] : T.sL[i]) === 3;
        info[v * 4] = flat ? .2 : GV.reg; info[v * 4 + 1] = GV.edge; info[v * 4 + 2] = Math.max(0, GV.h - y); info[v * 4 + 3] = zone + flag * 10;
        lane[v * 3] = MOBO.lanes[0][i]; lane[v * 3 + 1] = MOBO.lanes[1][i]; lane[v * 3 + 2] = MOBO.lanes[2][i];
      }
    }
    const idx = new Uint32Array((rows - 1) * (cols - 1) * 6); let q = 0;
    for (let r = 0; r < rows - 1; r++) for (let j = 0; j < cols - 1; j++) { const a = r * cols + j, b = a + 1, c = a + cols, e = c + 1; idx[q++] = a; idx[q++] = c; idx[q++] = b; idx[q++] = b; idx[q++] = c; idx[q++] = e; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSD', new THREE.BufferAttribute(sd, 2)); g.setAttribute('aInfo', new THREE.BufferAttribute(info, 4)); g.setAttribute('aLane', new THREE.BufferAttribute(lane, 3)); g.setIndex(new THREE.BufferAttribute(idx, 1));
    addMesh(g, pcbMat);
  }
};

// ---------------------------------------------------------------- PHASE 2: scenery & look
// A GLB becomes a list of parts (geometry baked with its node transform, normalised so its base sits on y=0 and centred).
function moboParts(gltf, opts = {}) {
  const root = gltf.scene; root.updateMatrixWorld(true);
  const box = new THREE.Box3(); root.traverse(o => { if (o.isMesh && (!opts.only || opts.only.test(o.name))) box.expandByObject(o); });
  const c = box.getCenter(new THREE.Vector3()), parts = [];
  const fix = new THREE.Matrix4().makeTranslation(-c.x, -box.min.y, -c.z);
  root.traverse(o => { if (!o.isMesh || (opts.only && !opts.only.test(o.name))) return; const g = o.geometry.clone(); g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(fix, o.matrixWorld)); parts.push({ g, m: o.material, name: o.name }); });
  return { parts, size: box.getSize(new THREE.Vector3()) };
}
const moboMats = new Map();
function moboMat(m, swap) { // clone + bend-patch a material once
  const key = m.uuid + (swap || ''); if (moboMats.has(key)) return moboMats.get(key);
  const A = MOBO.A; let out;
  if (swap === 'casing') out = new THREE.MeshStandardMaterial({ color: 0x24272d, map: A.m08clean, normalMap: A.m08n, roughnessMap: A.m08r, metalness: .35, roughness: .8 });
  else if (swap === 'silver') out = new THREE.MeshStandardMaterial({ color: 0xc8d2dc, map: A.m51c, normalMap: A.m51n, roughnessMap: A.m51r, metalness: .95, roughness: .45 });
  else { out = m.clone(); if (out.metalness !== undefined) out.envMapIntensity = .9; }
  out.envMap = A.env; patch(out); moboMats.set(key, out); return out;
}
// instance a parts list: items = [{x,y,z,ry,rx,s|sx,sy,sz}]; matSwap(part) -> 'casing' | 'silver' | undefined
function moboInst(P, items, matSwap) {
  if (!items.length) return [];
  const out = [];
  for (const p of P.parts) {
    const m = new THREE.InstancedMesh(p.g, moboMat(p.m, matSwap && matSwap(p)), items.length);
    items.forEach((it, i) => { _o3.position.set(it.x, it.y, it.z); _o3.rotation.set(it.rx || 0, it.ry || 0, it.rz || 0, 'YXZ'); _o3.scale.set(it.sx ?? it.s, it.sy ?? it.s, it.sz ?? it.s); _o3.updateMatrix(); m.setMatrixAt(i, _o3.matrix); });
    m.frustumCulled = false; world.add(m); worldGeos.push(p.g); out.push(m);
  }
  return out;
}
const chipSwap = p => /black|Material/i.test(p.m.name) ? 'casing' : 'silver';
function canvasT(w, h, f) { const c = document.createElement('canvas'); c.width = w; c.height = h; f(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t; }
// place something flat on the track at (s,d)
function onTrack(s, d) { ground(s, d, GV); const p = tpos(s, d, {}); return { x: p.x, y: GV.y, z: p.z, th: p.th, reg: GV.reg, void: GV.void, e: GV.e }; }

MOBO.buildScenery = function () {
  const T = track, A = MOBO.A, rnd = RNG(777), R = (a, b) => a + (b - a) * rnd(), zs = z => MOBO.zb[z];
  scene.environment = A ? A.env : null;
  MOBO.solids = [];
  const onBranch = (s, d, m) => { for (let q = -m; q <= m; q += 2) { const j = clamp(Math.round((s + q) / DS), 0, T.N - 1); if (T.bw[j] > 0 && Math.abs(d - T.bo[j]) < T.bw[j] + m) return true; } return false; };
  const sideSpot = (s, e0, e1, sd = rnd() < .5 ? -1 : 1, m = 3) => { const w = arrAt(T.wid, s), d = sd * (w + R(e0, e1)); const p = onTrack(s, d); if (p.void || p.reg === 3 && p.e > 6 || p.reg === 1 || onBranch(s, d, m)) return null; return Object.assign(p, { d, sd, s }); };
  const solid = (s, d, r) => { if (Math.abs(d) - r < arrAt(T.wid, s) + 30) MOBO.solids.push({ s, d, r }); };
  // --- silkscreen labels printed on the board
  { const words = ['R12', 'C7', 'U3', 'R47', 'C22', 'Q4', 'D1', 'L3', 'J5', 'U12', 'C101', 'R8', '+', '−', '→', '→'];
    const pg = new THREE.PlaneGeometry(1, 1); pg.rotateX(-PI / 2); worldGeos.push(pg);
    words.forEach((w, wi) => {
      const tex = canvasT(256, 128, (c, W, H) => { c.fillStyle = '#fff'; c.font = `900 ${w.length > 2 ? 78 : 104}px "Arial Black",Arial,sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(w, W / 2, H / 2 + 4); if (w === 'U3' || w === 'U12') { c.lineWidth = 6; c.strokeStyle = '#fff'; c.strokeRect(8, 8, W - 16, H - 16); } });
      const mat = patch(new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, color: new THREE.Color(.75, .85, .8), polygonOffset: true, polygonOffsetFactor: -2 }));
      const items = [];
      for (let n = 0; n < 46; n++) {
        const s = R(30, T.fin), w2 = arrAt(T.wid, s) - 1.5; let d = R(-w2, w2), ok = true;
        for (let k = 0; k < 3; k++) if (Math.abs(d - MOBO.laneAt(k, s)) < MOBO.laneW[k] + 1.6) ok = false; if (!ok) continue;
        const p = onTrack(s, d), sc = R(1.4, 2.6), arrow = w === '→';
        items.push({ x: p.x, y: p.y + .04, z: p.z, ry: -p.th + (arrow ? PI / 2 : (rnd() < .5 ? 0 : PI / 2)), rx: Math.atan(slopeAt(s, d, 1.5)), sx: sc * 2, sy: 1, sz: sc });
      }
      const m = inst(pg, mat, items); if (m) m.renderOrder = 3;
    }); }
  // --- LEDs along both board edges (they light in sequence when the board powers up)
  { const items = [], ss = [];
    for (let s = 20; s < T.len - 20; s += 6) for (const sd of [-1, 1]) { const w = arrAt(T.wid, s), j = Math.round(s / DS); if (T.gap[j] || (T.bw[j] > 0 && Math.sign(T.bo[j]) === sd)) continue; const p = onTrack(s, sd * (w + .55)); if (p.void && p.e > 3) continue; items.push({ x: p.x, y: p.y + .22, z: p.z, ry: -p.th, sx: .5, sy: .32, sz: .8, c: [1, 1, 1] }); ss.push(s); }
    const mat = patch(new THREE.MeshBasicMaterial({ color: 0xffffff }));
    const m = inst(new THREE.BoxGeometry(1, 1, 1), mat, items);
    MOBO.leds = { m, s: ss, n: ss.length, hue: ss.map((_, i) => hash2(i, 3)) }; }
  // --- close scenery that whips past: SMD resistors / capacitors / small chips on the shoulders
  { const smd = [], smdC = [], tiny = [];
    for (let s = 12; s < T.len - 30; s += 4 + rnd() * 5) { const p = sideSpot(s, .9, 2.4); if (!p) continue; const k = rnd();
      if (k < .45) smd.push({ x: p.x, y: p.y + .25, z: p.z, ry: -p.th + R(-.3, .3), sx: 1.6, sy: .5, sz: .8, c: [.08, .08, .09] });
      else if (k < .8) smdC.push({ x: p.x, y: p.y + .35, z: p.z, ry: -p.th, sx: 1.3, sy: .7, sz: .9, c: [.62, .5, .3] });
      else tiny.push({ x: p.x, y: p.y, z: p.z, ry: -p.th + PI / 2 + R(-.2, .2), s: R(1.2, 1.8) }); }
    inst(new THREE.BoxGeometry(1, 1, 1), patch(new THREE.MeshLambertMaterial({ color: 0xffffff })), smd.concat(smdC));
    if (A) moboInst(moboParts(A.chipS), tiny, chipSwap); }
  // --- capacitor towers: Capacitor Forest is dense with them, sparse elsewhere; a few stand on the board as obstacles
  { const sleeve = [], tops = [], stripes = [], cols = [[.08, .1, .32], [.05, .05, .07], [.3, .06, .3], [.02, .2, .22]];
    const add = (x, y, z, r, h, ci) => { const c = cols[ci % 4]; sleeve.push({ x, y: y + h / 2 - .3, z, sx: r, sy: h, sz: r, c }); tops.push({ x, y: y + h - .3, z, sx: r * .98, sy: .25, sz: r * .98 }); stripes.push({ x: x + r * .02, y: y + h / 2 - .3, z: z + r * .02, sx: r * 1.01, sy: h * .98, sz: r * 1.01, ry: rnd() * TAU }); };
    for (let s = zs(2) - 20; s < zs(3) + 30; s += 7 + rnd() * 6) for (const sd of [-1, 1]) { const p = sideSpot(s, 3, 40, sd); if (!p) continue; const h = R(8, 26) * (1 + p.e / 40), r = R(2.2, 5); add(p.x, p.y, p.z, r, h, (rnd() * 4) | 0); solid(s, p.d, r); }
    for (let s = 60; s < T.len - 60; s += 60 + rnd() * 80) { const p = sideSpot(s, 4, 26); if (p) { const r = R(2, 4); add(p.x, p.y, p.z, r, R(7, 18), (rnd() * 4) | 0); solid(s, p.d, r); } }
    for (const t of MOBO.towers) { const p = onTrack(t.s, t.d); add(p.x, p.y, p.z, t.r, R(9, 16), 0); }
    for (const c of MOBO.caps) { const w = arrAt(T.wid, c.s), sd = c.d > 0 ? 1 : -1, p = onTrack(c.s, sd * (w + 2.2)); if (!p.void || p.e < 3) add(p.x, p.y, p.z, 1.6, 6, 3); }
    const cyl = new THREE.CylinderGeometry(1, 1, 1, 20), stripeG = new THREE.CylinderGeometry(1, 1, 1, 20, 1, true, 0, .7);
    inst(cyl, patch(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .35, metalness: .1, envMap: A && A.env })), sleeve);
    inst(cyl, A ? moboMat({ uuid: 'cap-top', name: 'cap-top' }, 'silver') : M(0xbbbbbb), tops);
    inst(stripeG, patch(new THREE.MeshLambertMaterial({ color: 0xd8dde6, side: THREE.DoubleSide })), stripes); }
  // --- resistors as fallen logs (the ones on the board are bumps you ride over)
  { const body = [], band = [], lead = [], bc = [[.05, .05, .05], [.5, .25, .08], [1, .1, .05], [1, .6, .05], [1, 1, .1], [.1, .6, .2], [.85, .7, .3]];
    const add = (x, y, z, ry, len, r) => { body.push({ x, y: y + r, z, ry, rz: PI / 2, sx: r, sy: len, sz: r, c: [.82, .7, .5] }); for (let b = 0; b < 4; b++) band.push({ x: x + Math.cos(-ry) * 0, y: y + r, z, ry, rz: PI / 2, sx: r * 1.04, sy: len * .07, sz: r * 1.04, c: bc[(rnd() * bc.length) | 0], off: (b - 1.5) * len * .2 }); lead.push({ x, y: y + r, z, ry, rz: PI / 2, sx: r * .18, sy: len * 2.2, sz: r * .18 }); };
    for (const L of MOBO.logs) { const p = onTrack(L.s, L.d); add(p.x, p.y, p.z, -p.th + PI / 2, L.len, L.r); }
    for (let s = 40; s < T.len - 40; s += 25 + rnd() * 40) { const p = sideSpot(s, 2, 14); if (p) add(p.x, p.y, p.z, R(0, TAU), R(3, 8), R(.4, .9)); }
    band.forEach(b => { const dx = Math.cos(b.ry) * b.off, dz = -Math.sin(b.ry) * b.off; b.x += dx; b.z += dz; });
    const cyl = new THREE.CylinderGeometry(1, 1, 1, 12);
    inst(cyl, patch(new THREE.MeshLambertMaterial({ color: 0xffffff })), body); inst(cyl, patch(new THREE.MeshLambertMaterial({ color: 0xffffff })), band); inst(cyl, M(0xb0b8c0), lead); }
  if (A) {
    // --- chips as city blocks (Processor City is a downtown of them) and chips scattered on the far board / ceiling
    const big = moboParts(A.chip), small = moboParts(A.chipS), city = [], citySm = [], lights = [];
    for (let s = zs(3) - 30; s < zs(4) + 20; s += 26 + rnd() * 16) for (const sd of [-1, 1]) {
      const sc = R(4, 8), r = rnd() < .65, hw = .8 * sc * (r ? 1 : 1.6), hl = (r ? 2.44 * sc : 1.1 * sc); const p = sideSpot(s, hw + 3, hw + 30, sd, hl); if (!p) continue;
      (r ? city : citySm).push({ x: p.x, y: p.y, z: p.z, ry: -p.th + PI / 2, s: sc * (r ? 1 : 1.6) }); for (const o of [-.66, 0, .66]) solid(s + o * hl, p.d, hw);
      if (rnd() < .5) lights.push({ x: p.x + R(-3, 3), y: p.y + sc * 1.25, z: p.z + R(-3, 3), sx: .3, sy: .2, sz: .3, c: rnd() < .6 ? [.3, 1.1, .5] : [1.1, .3, .15] });
    }
    moboInst(big, city, chipSwap); moboInst(small, citySm, chipSwap);
    // far board / ceiling: cheap box chips with glowing pin rows (the full models cost ~2.3k triangles each)
    const fb = [], fp = [];
    for (let n = 0; n < 1400; n++) { const z = R(T.cz[T.N - 1] - 1500, T.cz[0] + 100), row = farRow(z), dx = (rnd() < .5 ? -1 : 1) * R(70, 1300), x = row.x + dx, y = farHb(row.base, dx, x, z), k = R(8, 30) * (1 + Math.abs(dx) / 900), L = k * (rnd() < .5 ? 4.8 : 1.4), ry = R(0, TAU);
      fb.push({ x, y: y + k * .45, z, ry, sx: k * 1.6, sy: k * .9, sz: L, c: [.05, .055, .065] });
      for (const sd of [-1, 1]) fp.push({ x: x + Math.cos(ry) * sd * k * .85, y: y + k * .2, z: z - Math.sin(ry) * sd * k * .85, ry, sx: k * .18, sy: k * .4, sz: L * .92, c: [.5, .52, .55] }); }
    inst(new THREE.BoxGeometry(1, 1, 1), patch(new THREE.MeshLambertMaterial({ color: 0xffffff })), fb); inst(new THREE.BoxGeometry(1, 1, 1), patch(new THREE.MeshLambertMaterial({ color: 0xffffff })), fp);
    inst(new THREE.BoxGeometry(1, 1, 1), MB(1, 1, 1, .3), lights);
    // --- chip bridges: a giant DIP-8 straddles the road; you ride through the gaps between its pins
    const pins = moboPins(A.chipS), K = 22;
    for (const c of MOBO.chips) {
      const p = onTrack(c.s, 0); c.K = K; c.rowZ = pins.rowZ * K; c.pinD = pins.x.map(x => x * K); c.pinW = pins.w * K * .5;
      c.rows = [c.s - c.rowZ, c.s + c.rowZ]; c.gaps = [];
      const ed = [-arrAt(T.wid, c.s) - 1].concat(c.pinD, [arrAt(T.wid, c.s) + 1]);
      for (let g = 0; g < ed.length - 1; g++) c.gaps.push({ d0: ed[g] + (g ? c.pinW : 0), d1: ed[g + 1] - (g < ed.length - 2 ? c.pinW : 0) });
      moboInst(small, [{ x: p.x, y: Math.min(...[-1, 1].map(sd => onTrack(c.s + sd * c.rowZ, 0).y)) - .3, z: p.z, ry: -p.th, s: K }], chipSwap);
    }
    // --- heat sinks as fin ridges along Power Works and Port Run (fins from the graphics card, in clean brushed metal)
    const fins = moboParts(A.card, { only: /fins/ }), fItems = [];
    for (const [a, b] of [[zs(1), zs(2)], [zs(5), T.len - 40]]) for (let s = a; s < b; s += 30) for (const sd of [-1, 1]) { const p = sideSpot(s, 2.6, 3.4, sd); if (!p) continue; const sz = fins.size; fItems.push({ x: p.x, y: p.y - .2, z: p.z, ry: -p.th + PI / 2, sx: 30 / sz.x, sy: 6 / sz.y, sz: 4 / sz.z }); }
    moboInst(fins, fItems, () => 'silver');
    // --- whole graphics cards, CPUs, transistor & capacitor dioramas as giant set pieces off the road
    MOBO.cards = [];
    const big3 = (g, s, sd, sc, ry = 0) => { const p = sideSpot(s, 30, 40, sd); if (!p) return null; const o = EX_clone(g.scene); o.scale.setScalar(sc); o.position.set(p.x, p.y - .5, p.z); o.rotation.y = -p.th + ry; o.traverse(m => { if (m.isMesh) { m.material = moboMat(m.material); m.frustumCulled = false; } }); world.add(o); return o; };
    for (const [s, sd] of [[zs(1) + 120, 1], [zs(1) + 420, -1], [zs(5) + 260, 1]]) { const o = big3(A.card, s, sd, 120, PI / 2); if (o) { const rot = []; o.traverse(m => { if (/rotor/.test(m.name)) rot.push(m); }); MOBO.cards.push(rot); } }
    big3(A.cpu, zs(3) + 300, -1, 300); big3(A.cpu, zs(3) + 470, 1, 260, 1.2); big3(A.trans, zs(1) + 300, 1, 260); big3(A.capD, zs(2) + 330, -1, 320); big3(A.capD, zs(2) + 120, 1, 280, 2);
  }
  // --- DIMM slots in Memory Lanes: long latched sockets beside the road
  { const slot = [], latch = [];
    for (let s = zs(4) + 10; s < zs(5) - 30; s += 64) for (const sd of [-1, 1]) for (let k = 0; k < 3; k++) { const p = sideSpot(s + 26, 2.5 + k * 3.2, 2.6 + k * 3.2, sd); if (!p) continue; slot.push({ x: p.x, y: p.y + 1.2, z: p.z, ry: -p.th, sx: 1.6, sy: 2.4, sz: 50, c: [.08, .09, .12] }); for (const e of [-26, 26]) { const q = onTrack(s + 26 + e, p.d); latch.push({ x: q.x, y: q.y + 1.6, z: q.z, ry: -q.th, sx: 1.8, sy: 3.2, sz: 1.2, c: [.95, .95, .9] }); } }
    inst(new THREE.BoxGeometry(1, 1, 1), patch(new THREE.MeshLambertMaterial({ color: 0xffffff })), slot.concat(latch)); }
  // --- battery at the top: Battery Heights starts beside a giant cell
  { const p = onTrack(60, -arrAt(T.wid, 60) - 14); const g = new THREE.CylinderGeometry(9, 9, 46, 32); worldGeos.push(g);
    const can = new THREE.Mesh(g, patch(new THREE.MeshStandardMaterial({ color: 0x1b3a8f, roughness: .3, metalness: .4, envMap: A && A.env }))); can.rotation.set(PI / 2, 0, 0); can.rotation.order = 'YXZ'; can.rotation.y = -p.th; can.position.set(p.x, p.y + 6, p.z); can.frustumCulled = false; world.add(can);
    const capG = new THREE.CylinderGeometry(3, 3, 3, 24); worldGeos.push(capG); const cap = new THREE.Mesh(capG, A ? moboMat({ uuid: 'bat', name: 'bat' }, 'silver') : M(0xcccccc)); cap.rotation.copy(can.rotation); const f = tpos(60 - 24, -arrAt(T.wid, 60) - 14, {}); cap.position.set(f.x, p.y + 6, f.z); cap.frustumCulled = false; world.add(cap);
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(30, 10), patch(new THREE.MeshBasicMaterial({ map: canvasT(512, 170, (c, W, H) => { c.fillStyle = '#ffc93c'; c.font = '900 120px Arial Black'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('+ 3V −', W / 2, H / 2); }), transparent: true, side: THREE.DoubleSide })));
    lab.position.set(p.x + Math.cos(p.th) * 9.2, p.y + 6, p.z + Math.sin(p.th) * 9.2); lab.rotation.y = -p.th + PI / 2; lab.frustumCulled = false; world.add(lab); worldGeos.push(lab.geometry); }
  // --- connector finish tunnel: a giant edge connector shell the racers dive into
  { const s0 = T.fin - 8, L = 30, w = arrAt(T.wid, T.fin) + 2, H = 10, shell = A ? moboMat({ uuid: 'conn', name: 'conn' }, 'silver') : M(0xaaaaaa), gold = MB(2.2, 1.5, .5), parts = [], contacts = [];
    for (let q = 0; q < L; q += 2) { const s = s0 + q, p = onTrack(s, 0), y = p.y; parts.push({ x: p.x, y: y + H, z: p.z, ry: -p.th, sx: w * 2 + 2, sy: 1, sz: 2.05 }); for (const sd of [-1, 1]) { const e = onTrack(s, sd * (w + .5)); parts.push({ x: e.x, y: y + H / 2, z: e.z, ry: -p.th, sx: 1, sy: H, sz: 2.05 }); if (q % 4 === 0) contacts.push({ x: e.x - Math.cos(p.th) * sd * .6, y: y + H * .55, z: e.z - Math.sin(p.th) * sd * .6, ry: -p.th, sx: .2, sy: H * .7, sz: .9 }); } }
    inst(new THREE.BoxGeometry(1, 1, 1), shell, parts); inst(new THREE.BoxGeometry(1, 1, 1), gold, contacts); }
  // --- spark arcs (chip pins) and solder blobs live in the world group too
  MOBO.arcs = inst(new THREE.BoxGeometry(1, 1, 1), MB(1.6, 2.4, 2.6), Array.from({ length: 200 }, () => ({ x: 0, y: -1e4, z: 0, s: 0 })));
  const bg = new THREE.IcosahedronGeometry(1, 2); worldGeos.push(bg);
  MOBO.blobMat = patch(new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xff7a1a, roughness: .25, metalness: .9, envMap: A && A.env }));
  MOBO.blobMesh = new THREE.InstancedMesh(bg, MOBO.blobMat, 24); MOBO.blobMesh.frustumCulled = false; MOBO.blobMesh.count = 0; world.add(MOBO.blobMesh);
  MOBO.blobMesh.setColorAt(0, new THREE.Color(1, 1, 1));
  // --- post look: cool blue-green grade
  const C = mComp.uniforms; C.uGrade.value.set(.97, 1.02, 1.0); C.uLift.value.set(0, .004, .006);
};
function EX_clone(o) { return window.THREE_EX && THREE_EX.SkeletonUtils ? THREE_EX.SkeletonUtils.clone(o) : o.clone(); }
// pin positions of a DIP chip, measured from its geometry (feet below the body)
function moboPins(gltf) {
  const P = moboParts(gltf), H = P.size.y, pts = [];
  for (const p of P.parts) { if (/black/i.test(p.m.name)) continue; const a = p.g.attributes.position; for (let i = 0; i < a.count; i++) if (a.getY(i) < H * .12) pts.push([a.getX(i), a.getZ(i)]); }
  if (!pts.length) return { x: [-.53, -.18, .18, .53], w: .09, rowZ: .7 };
  pts.sort((a, b) => a[0] - b[0]); const cl = []; let cur = [pts[0]];
  for (let i = 1; i < pts.length; i++) { if (pts[i][0] - pts[i - 1][0] > .1) { cl.push(cur); cur = []; } cur.push(pts[i]); } cl.push(cur);
  const xs = cl.map(c => (c[0][0] + c[c.length - 1][0]) / 2), w = Math.max(...cl.map(c => c[c.length - 1][0] - c[0][0]));
  const rowZ = pts.reduce((a, p) => a + Math.abs(p[1]), 0) / pts.length;
  return { x: xs, w, rowZ };
}
MOBO.reset = function () {
  scene.environment = null; const C = mComp.uniforms; C.uGrade.value.set(1, 1, 1); C.uLift.value.set(0, 0, 0); C.uStretch.value = 0; C.uLines.value = 0;
  skyMat.uniforms.uFan.value = 0; skyMat.uniforms.uPow.value = 0; MOBO.fp = false; MOBO.slowT = 0; $('hud').classList.remove('mb');
};

// ---------------------------------------------------------------- PHASE 3: mechanics
const pulseAt = (k, s) => { const U = MOBO.U, ph = [U.uPh.value.x, U.uPh.value.y, U.uPh.value.z][k], L = U.uPL.value; return ((((s - uTime.value * U.uPS.value - ph) / L) % 1) + 1) % 1 * L - L / 2; };
function onLane(r) { for (let k = 0; k < 3; k++) if (Math.abs(r.d - MOBO.laneAt(k, r.s)) < MOBO.laneW[k] + .25 && Math.abs(r.d) < arrAt(track.wid, r.s)) return k; return -1; }
function arcState(c, row, g) { const per = 2.7, ph = (c * 1.7 + g * .83 + row * .45) % per, t = ((uTime.value + ph) % per + per) % per; return t < .95 ? 2 : t > per - .4 ? 1 : 0; } // 2 live, 1 warning, 0 safe
// returns true when it fully handled this racer's movement (inside a via)
MOBO.racerPre = function (r, dt, c) {
  r.mbPrevS = r.s;
  const v = r.via; if (!v) return false;
  v.t += dt; const L = v.s1 - v.s0, sp = v.sp || (v.sp = Math.min(Math.max(r.v, 24) * 1.18, r.st.vmax * 1.25));
  r.v = sp; r.s = Math.min(v.s1, r.s + sp * dt); const u = clamp((r.s - v.s0) / L, 0, 1);
  r.d = lerp(v.d0, v.d1, sstep(0, 1, u)); r.a = r.beta = 0;
  ground(r.s, r.d, G0); const under = G0.h - 2.6, dropIn = Math.min(1, v.t / .35);
  r.y = lerp(ground(v.s0, v.d0, G1).y, under, dropIn); r.viaRoll = PI * dropIn; r.air = false; r.vy = 0;
  if (r.s >= v.s1 - .5) { // pop out through the exit via
    r.via = null; r.y = ground(r.s, r.d, G0).y + .2; r.vy = 12; r.air = true; r.airT = 0; r.takeoff(); r.inv = Math.max(r.inv, .6); evt('viaOut', r);
  }
  while (r.cpI + 1 < track.cps.length && r.s >= track.cps[r.cpI + 1]) { r.cpI++; r.cpS = track.cps[r.cpI]; evt('cp', r); }
  return true;
};
MOBO.racerPost = function (r, dt) {
  const T = track, s = r.s, d = r.d, ps = r.mbPrevS ?? s;
  if (r.viaRoll) r.viaRoll = Math.max(0, r.viaRoll - dt * 9);
  r.pulseCD = Math.max(0, (r.pulseCD || 0) - dt);
  // current pulses: riding a trace as a pulse passes = free boost (the racing line)
  if (!r.air && r.pulseCD <= 0) { const k = onLane(r); if (k >= 0 && Math.abs(pulseAt(k, s)) < 4.5) { r.pulseCD = 2.2; r.boostT = Math.max(r.boostT, 1.6); r.v += 4; evt('pulse', r); } }
  if (r.isP && !GM.demo && r.air && r.airT === 0 && estAir(r) > 1.6) MOBO.slow(.75); // big launches go slow-motion
  if (r.air || r.state) return;
  // vias: drop in, ride the underside, pop out further down
  for (const v of MOBO.vias) if (Math.abs(s - v.s0) < v.r && Math.hypot(s - v.s0, d - v.d0) < v.r * .85) { r.via = { s0: v.s0, d0: v.d0, s1: v.s1, d1: v.d1, t: 0 }; r.charge = 0; evt('viaIn', r); return; }
  // capacitor launch pads
  for (const cp of MOBO.caps) if (cp.ch >= 1 && Math.abs(s - cp.s) < cp.r && Math.hypot(s - cp.s, d - cp.d) < cp.r) { cp.ch = 0; r.vy = 20 + r.v * .12; r.v *= 1.05; r.air = true; r.airT = 0; r.y += .1; r.takeoff(); evt('cap', r); return; }
  // chip pin gaps
  for (let ci = 0; ci < MOBO.chips.length; ci++) { const c = MOBO.chips[ci]; if (!c.rows) continue; for (let row = 0; row < 2; row++) { const rs = c.rows[row]; if (ps < rs && s >= rs) {
    for (const pd of c.pinD) if (Math.abs(d - pd) < c.pinW + .35) { r.crash('pin'); return; }
    const g = c.gaps.findIndex(G => d > G.d0 && d < G.d1); if (g >= 0 && arcState(ci, row, g) === 2) { r.crash('shock'); return; } } } }
  // capacitor towers on the board and solid architecture beside it
  for (const t of MOBO.towers) if (Math.abs(s - t.s) < t.r + .6 && Math.hypot(s - t.s, d - t.d) < t.r + .2) { r.crash('wall'); return; }
  if (MOBO.solids) for (const o of MOBO.solids) if (Math.abs(s - o.s) < o.r + .5 && Math.hypot(s - o.s, d - o.d) < o.r + .3) { r.crash('wall'); return; }
  // hot zone: the power-section shortcut drains health but runs hot (faster)
  r.hot = false;
  for (const h of MOBO.hot) if (s > h.s0 && s < h.s1) { ground(s, d, G0); if (G0.reg === 1) { r.hot = true; r.health -= 11 * dt; r.v = Math.min(r.v + 5 * dt, r.st.vmax * 1.2); r.flash = .1; if (r.health <= 0) { r.crash('shock'); return; } } }
  // molten solder
  for (const b of MOBO.blobs) if (b.st === 1 && Math.abs(s - b.s) < 1.8 && Math.abs(d - b.d) < 1.8) { r.crash('solder'); return; }
};
MOBO.slow = t => { MOBO.slowT = Math.max(MOBO.slowT, t); };
MOBO.timeScale = function (dt) { if (MOBO.slowT <= 0 || GM.state !== 'race') { MOBO.slowT = 0; return 1; } MOBO.slowT -= dt; return MOBO.slowT < .15 ? lerp(1, .35, MOBO.slowT / .15) : .35; };
// per-frame world update
MOBO.step = function (dt) {
  const T = track, lead = GM.demo ? GM.racers[0] : GM.player, U = MOBO.U;
  for (const c of MOBO.caps) c.ch = Math.min(1, c.ch + dt / 7);
  MOBO.caps.slice(0, 8).forEach((c, i) => U.uCap.value[i].set(c.s, c.d, c.r, c.ch));
  // trace intensity: steady glow with a slow per-trace flicker; power-up overdrives it
  const t = uTime.value; U.uTI.value.set(1 + .12 * Math.sin(t * 2.3), 1 + .12 * Math.sin(t * 1.7 + 2), 1 + .12 * Math.sin(t * 2.9 + 4));
  // zone banner
  let z = 0; while (z < 5 && lead.s >= MOBO.zb[z + 1]) z++;
  if (z !== MOBO.zone) { MOBO.zone = z; if (!GM.demo) { $('mbZone').textContent = MB_ZONES[z]; $('mbZone').classList.remove('in'); void $('mbZone').offsetWidth; $('mbZone').classList.add('in'); } }
  $('hWarn').textContent = !GM.demo && GM.player.hot ? '⚠ HOT ZONE — DRAINING HEALTH ⚠' : ($('hWarn').textContent.startsWith('⚠ HOT') ? '' : $('hWarn').textContent);
  // chip pin arcs
  if (MOBO.arcs) { let n = 0; const m = MOBO.arcs;
    MOBO.chips.forEach((c, ci) => { if (!c.rows || Math.abs(c.s - lead.s) > 380) return; for (let row = 0; row < 2; row++) c.gaps.forEach((G, g) => {
      const stt = arcState(ci, row, g); if (!stt) return; const rs = c.rows[row], live = stt === 2;
      const segs = live ? 6 : 2, a0 = G.d0, a1 = G.d1;
      for (let q = 0; q < segs && n < 200; q++) { const u0 = q / segs, u1 = (q + 1) / segs, j0 = (Math.random() - .5) * (live ? 1.6 : .5), j1 = (Math.random() - .5) * (live ? 1.6 : .5);
        const p0 = onTrack(rs, lerp(a0, a1, u0)), p1 = onTrack(rs, lerp(a0, a1, u1)), y0 = p0.y + 1.6 + j0 + Math.sin(u0 * PI) * 1.5, y1 = p1.y + 1.6 + j1 + Math.sin(u1 * PI) * 1.5;
        const dx = p1.x - p0.x, dy = y1 - y0, dz = p1.z - p0.z, L = Math.hypot(dx, dy, dz);
        _o3.position.set((p0.x + p1.x) / 2, (y0 + y1) / 2, (p0.z + p1.z) / 2); _o3.lookAt(p1.x, y1, p1.z); _o3.scale.set(live ? .16 : .07, live ? .16 : .07, L); _o3.updateMatrix(); m.setMatrixAt(n++, _o3.matrix); }
      if (live && Math.random() < dt * 20) { const p = onTrack(rs, lerp(a0, a1, Math.random())); spawnP(p.x, p.y + 1.8, p.z, (Math.random() - .5) * 6, Math.random() * 5, (Math.random() - .5) * 6, .35, .25, 1.2, 2, 2.4, 9); }
    }); });
    _o3.scale.set(0, 0, 0); _o3.position.set(0, -1e4, 0); _o3.updateMatrix(); for (let i = n; i < 200; i++) m.setMatrixAt(i, _o3.matrix); m.instanceMatrix.needsUpdate = true; }
  // solder drops: fall, roll as hazards, then harden into new ramps
  for (const zz of MOBO.solderZ) if (lead.s > zz.s0 - 60 && lead.s < zz.s1 && MOBO.blobs.filter(b => b.st < 2).length < 4) { MOBO.spawnT = (MOBO.spawnT || 0) - dt; if (MOBO.spawnT <= 0) { MOBO.spawnT = 1.4 + Math.random() * 1.6; const s = lead.s + 45 + Math.random() * 70; if (s < zz.s1 + 40) { const w = arrAt(T.wid, s) - 2; MOBO.blobs.push({ s, d: (Math.random() * 2 - 1) * w, y: ground(s, 0, G1).y + 34, vy: 0, st: 0, t: 0, vd: (Math.random() - .5) * 2 }); } } }
  for (const b of MOBO.blobs) {
    if (b.st === 0) { b.vy -= 32 * dt; b.y += b.vy * dt; const gy = ground(b.s, b.d, G1).y + 1; if (b.y <= gy) { b.y = gy; b.st = 1; b.t = 0; tpos(b.s, b.d, TP1); burst(TP1.x, gy, TP1.z, 26, 8, .7, .35, [2.2, 1.1, .35], 9); if (!GM.demo && Math.abs(b.s - lead.s) < 90) AU.thump(); }
      else if (Math.random() < dt * 12) { tpos(b.s, b.d, TP1); decal(TP1.x, ground(b.s, b.d, G1).y, TP1.z, TP1.th, 0, 2.6, 2.6, 2.2, .3, .05, .3); } }
    else if (b.st === 1) { b.t += dt; b.s += 12 * dt * (1 - b.t / 4); b.d = clamp(b.d + b.vd * dt, -arrAt(T.wid, b.s) + 2, arrAt(T.wid, b.s) - 2); b.y = ground(b.s, b.d, G1).y + 1;
      if (Math.random() < dt * 14) { tpos(b.s, b.d, TP1); spawnP(TP1.x, b.y, TP1.z, (Math.random() - .5) * 3, 2 + Math.random() * 3, (Math.random() - .5) * 3, .5, .25, 2, 1, .3, 8); }
      if (b.t > 3) { b.st = 2; b.t = 0; } }
    else if (b.st === 2) { b.t += dt; if (b.t > 1) { b.st = 3; T.kicks.push(b.k = { s0: b.s - 4.5, len: 5, H: 1.4, d: b.d, hw: 2.3, dyn: 1 }); MOBO.ramps.push(b); } }
  }
  while (MOBO.ramps.length > 10) { const o = MOBO.ramps.shift(); const i = T.kicks.indexOf(o.k); if (i >= 0) T.kicks.splice(i, 1); o.dead = 1; }
  MOBO.blobs = MOBO.blobs.filter(b => !b.dead);
  { const m = MOBO.blobMesh; let n = 0; const col = new THREE.Color();
    for (const b of MOBO.blobs) { if (n >= 24) break; tpos(b.s, b.d, TP1); const hard = b.st >= 2 ? Math.min(1, b.t + (b.st === 3 ? 1 : 0)) : 0;
      _o3.position.set(TP1.x, b.st === 3 ? b.y - 1 : b.y, TP1.z); _o3.rotation.set(b.st === 1 ? b.t * 6 : 0, -TP1.th, 0, 'YXZ'); if (b.st === 3) _o3.scale.set(2.3, 1.45, 3.2); else _o3.scale.setScalar(1.6); _o3.updateMatrix(); m.setMatrixAt(n, _o3.matrix);
      col.setRGB(lerp(2.4, .75, hard), lerp(1.1, .78, hard), lerp(.3, .8, hard)); m.setColorAt(n, col); n++; }
    m.count = n; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; MOBO.blobMat.emissiveIntensity = 1.6; }
  // blackout after a knockout
  if (MOBO.black > 0) MOBO.black = Math.max(0, MOBO.black - dt * .7); U.uBlack.value.set(MOBO.blackP.x, MOBO.blackP.y, MOBO.blackP.z, Math.min(1, MOBO.black));
  // power-up after the winner crosses the line
  if (MOBO.pow >= 0) { MOBO.pow += dt; U.uPow.value = Math.min(1, MOBO.pow / 1.5); skyMat.uniforms.uPow.value = U.uPow.value; }
  // LEDs: twinkle; sweep on at power-up; dark inside a blackout
  if (MOBO.leds && MOBO.leds.m && (GM.t * 60 | 0) % 2 === 0) { const L = MOBO.leds, m = L.m, col = new THREE.Color(), sweep = MOBO.pow >= 0 ? MOBO.pow / 2.6 * T.len : -1;
    for (let i = 0; i < L.n; i++) { const s = L.s[i], h = L.hue[i]; let k = .25 + .35 * (Math.sin(t * (2 + h * 3) + h * 40) > .6 ? 1 : 0);
      if (sweep >= 0 && s < sweep) k = 2.2 + .4 * Math.sin(t * 8 - s * .05);
      if (MOBO.black > 0) { tpos(s, 0, TP1); const dd = Math.hypot(TP1.x - MOBO.blackP.x, TP1.z - MOBO.blackP.z); if (dd < 80) k *= 1 - Math.min(1, MOBO.black) * (1 - dd / 80); }
      if (h < .5) col.setRGB(.25 * k, 1.1 * k, 1 * k); else if (h < .8) col.setRGB(1.2 * k, .55 * k, .12 * k); else col.setRGB(1 * k, .2 * k, .7 * k); m.setColorAt(i, col); }
    m.instanceColor.needsUpdate = true; }
  // graphics-card fans spin; the vortex fan speeds up with the player's speed
  for (const rot of MOBO.cards) for (const f of rot) f.rotation.y += dt * 9;
  const fanT = 3 + (GM.player ? GM.player.v * .3 : 0) + (MOBO.pow >= 0 ? 30 : 0); MOBO.fan += (fanT - MOBO.fan) * Math.min(1, dt * 1.5);
  skyMat.uniforms.uFan.value = MOBO.fan; skyMat.uniforms.uFanP.value += MOBO.fan * dt * .25;
};
// ---- events (return true to replace the default handling)
MOBO.evt = function (type, r, a) {
  const P = r.isP && !GM.demo; tpos(r.s, r.d, TP1); const x = TP1.x, y = r.y, z = TP1.z;
  switch (type) {
    case 'pulse': burst(x, y + .6, z, 18, 8, .5, .3, [1.2, 2.4, 2.6], 0); if (P) { popup('OVERCLOCKED!', 'good'); moboSfx('electric_whoosh', .7, 1.2); AU.pad(); cam.shake = Math.max(cam.shake, .45); PAD.rumble(.3, .9, 350); } return true;
    case 'full': if (P) { popup('FULL CHARGE!', 'combo'); moboSfx('electric_whoosh', .5, .8); } return true;
    case 'cap': burst(x, y, z, 40, 12, .8, .4, [1.2, 2.2, 2.6], 4); if (P) { popup('CAPACITOR LAUNCH!', 'info'); AU.tone(55, .45, { to: 30, vol: .55 }); AU.noise(.25, { f: 300, to: 60, vol: .4, type: 'lowpass' }); moboSfx('electric_whoosh', .8, .7); cam.shake = Math.max(cam.shake, 1); PAD.rumble(1, .6, 300); MOBO.slow(.7); } return true;
    case 'viaIn': burst(x, y, z, 24, 6, .6, .3, [.4, 2, 2.2], -4); if (P) { popup('VIA SHORTCUT!', 'info'); moboSfx('whoosh_bright_panning', .6, 1.4); } return true;
    case 'viaOut': burst(x, y, z, 28, 9, .6, .35, [.4, 2, 2.2], 6); if (P) { moboSfx('electric_whoosh', .6, 1); cam.shake = Math.max(cam.shake, .6); } return true;
    case 'hit': moboSfx('electric_zap', P || (a && a.isP && !GM.demo) ? .55 : 0, 1 + Math.random() * .3, .45); return false;
    case 'crash': if (a === 'shock' || a === 'lava') { burst(x, y + 1, z, 50, 12, .7, .35, [1.4, 2.2, 2.6], 7); if (P) moboSfx('electric_zap', .9, .85); } return false;
    case 'boost': if (P) moboSfx('whoosh_bright_panning', .55, 1.1); return false;
    case 'ko': { tpos(a.s, a.d, TP1); MOBO.blackP.set(TP1.x, a.y, TP1.z); MOBO.black = 1.6; burst(TP1.x, a.y + 1, TP1.z, 80, 16, 1, .45, [2.4, 2, 1], 8); burst(TP1.x, a.y + 1, TP1.z, 40, 10, 1.2, .4, [.6, 2.2, 2.6], 4); moboSfx('electric_zap', (P || a.isP) && !GM.demo ? 1 : 0, .7); if ((P || a.isP) && !GM.demo) MOBO.slow(.9); return false; }
    case 'finish': if (MOBO.pow < 0) MOBO.powerUp(); return false;
  }
  return false;
};
MOBO.powerUp = function () {
  MOBO.pow = 0; if (GM.demo) return;
  const el = $('mbPower'); el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
  AU.tone(110, 1.6, { to: 880, type: 'sawtooth', vol: .16 }); AU.tone(220, 1.8, { to: 1760, type: 'square', vol: .06, delay: .3 }); cam.flash = .5;
};
// ---- AI: ride the traces, chase pulses, use vias / capacitors, avoid the hazards
MOBO.aiLane = function (r, sA, tgt, w) {
  const A = r.ai; if (A.mbK === undefined) { A.mbK = (Math.random() * 3) | 0; A.mbVia = Math.random() < [.2, .45, .7][GM.diff]; A.mbCap = Math.random() < DIFFS[GM.diff].trickP; }
  if ((GM.t * 10 | 0) % 37 === r.i) A.mbK = (A.mbK + (Math.random() < .5 ? 1 : 2)) % 3;
  let t = MOBO.laneAt(A.mbK, sA);
  if (A.mbVia) for (const v of MOBO.vias) if (v.s0 > r.s && v.s0 - r.s < 70) t = v.d0;
  if (A.mbCap) for (const c of MOBO.caps) if (c.ch > .95 && c.s > r.s && c.s - r.s < 60) t = c.d;
  return t;
};
MOBO.aiAvoid = function (r, tgt, look, w, c) {
  const s = r.s, v = r.v, dodge = (o, rad) => { const nt = o + (tgt >= o ? 1 : -1) * rad; return Math.abs(nt) > w - 1.5 ? o - Math.sign(nt) * rad : nt; };
  for (const t of MOBO.towers) if (t.s > s - 2 && t.s < s + look * 1.8 + 10 && (Math.abs(t.d - tgt) < t.r + 2 || Math.abs(t.d - r.d) < t.r + 2)) { tgt = dodge(t.d, t.r + 2.6); if (t.s - s < 18 && Math.abs(t.d - r.d) < t.r + 1) c.acc = 0; }
  for (const b of MOBO.blobs) if (b.st === 1 && b.s > s - 2 && b.s < s + look * 1.4 && Math.abs(b.d - tgt) < 3) tgt = dodge(b.d, 3.5);
  MOBO.chips.forEach((ch, ci) => { if (!ch.rows) return; for (let row = 0; row < 2; row++) { const q = ch.rows[row] - s; if (q < 0 || q > v * 1.6 + 12) continue;
    let best = null, bd = 1e9; ch.gaps.forEach((G, g) => { if (G.d1 - G.d0 < 1.6) return; const mid = (G.d0 + G.d1) / 2, cost = Math.abs(mid - r.d) + (arcState(ci, row, g) ? 6 : 0); if (cost < bd) { bd = cost; best = mid; } });
    if (best !== null) tgt = best; if (q < v * .6 && ch.gaps.some((G, g) => r.d > G.d0 && r.d < G.d1 && arcState(ci, row, g) === 2)) { c.acc = 0; c.brake = 1; } return; } });
  const wr = arrAt(track.wid, r.s); ground(r.s, r.d, G0);
  if (Math.abs(r.d) > wr - 1.5 && G0.reg !== 1) { tgt = Math.sign(r.d) * (wr - 5); if (Math.abs(r.d) > wr + 3 && r.v > 18) { c.acc = 0; c.brake = 1; } } // drifted wide onto the open board: get back on the road
  for (const h of MOBO.hot) if (r.s > h.s0 - 60 && r.s < h.s1 && r.health < r.st.hp * .7) { const w2 = arrAt(track.wid, r.s); tgt = clamp(tgt, -w2 + 2, w2 - 2); }
  return tgt;
};

// ---------------------------------------------------------------- PHASE 4: rider, bike, feel
const riderMats = {};
MOBO.dressRacer = function (r) {
  const A = MOBO.A; if (!A) return;
  // rider.glb: one skinned character, clips idle / riding / punch / kick / crash
  for (const ch of r.rider.g.children) ch.visible = false;
  const m = THREE_EX.SkeletonUtils.clone(A.rider.scene);
  const body = riderMats[r.i] || (riderMats[r.i] = patch(new THREE.MeshLambertMaterial({ color: RCOL[r.i] })));
  const joints = riderMats.j || (riderMats.j = patch(new THREE.MeshLambertMaterial({ color: 0x15171c, emissive: 0x0a2a2a })));
  m.traverse(o => { if (o.isMesh) { o.frustumCulled = false; o.material = /Joint/i.test(o.name) ? joints : body; } });
  m.rotation.y = PI; m.position.set(0, -A.hipY + .05, -.05); r.rider.g.add(m);
  const mixer = new THREE.AnimationMixer(m), act = {};
  for (const c of A.rider.animations) { const a = mixer.clipAction(c); act[c.name] = a; if (c.name !== 'riding' && c.name !== 'idle') { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; } }
  act.riding.play();
  let spine = null, armL = null, armR = null; m.traverse(o => { if (o.isBone) { if (/Spine1$/.test(o.name)) spine = o; if (/LeftArm$/.test(o.name)) armL = o; if (/RightArm$/.test(o.name)) armR = o; } });
  r.mb = { m, mixer, act, cur: 'riding', spine, armL, armR, susp: 0, suspV: 0, lastGy: null, turn: 0 };
  // ride: the BMX model replaces the primitive mountain bike
  if (r.ride === 0 && A.bmx) {
    for (const ch of r.mount.g.children) ch.visible = false;
    const b = A.bmx.scene.clone(); const box = new THREE.Box3().setFromObject(b), sz = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    const long = Math.max(sz.x, sz.z), k = 1.75 / long; b.scale.setScalar(k); b.position.set(-c.x * k, -box.min.y * k, -c.z * k);
    if (sz.x > sz.z) b.rotation.y = PI / 2;
    b.traverse(o => { if (o.isMesh) { o.frustumCulled = false; o.material = moboMat(o.material); } });
    const holder = new THREE.Group(); holder.add(b); r.mount.g.add(holder); r.mb.bike = holder;
  }
};
function playClip(r, name, fade = .12) { const M = r.mb; if (!M || M.cur === name) return; const a = M.act[name], b = M.act[M.cur]; if (!a) return; a.reset(); a.setEffectiveWeight(1); a.play(); if (b) b.crossFadeTo(a, fade, false); M.cur = name; }
MOBO.racerVis = function (r, dt) {
  const M = r.mb; if (!M) { if (r.viaRoll) r.pivot.rotation.z += r.viaRoll; return; }
  // clip choice
  const down = r.state === 1;
  if (down) playClip(r, 'crash', .08);
  else if (r.atkT > 0) playClip(r, r.atkSide < 0 ? 'punch' : 'kick', .06);
  else if (M.cur !== 'riding' && (M.cur === 'crash' || !M.act[M.cur].isRunning() || M.act[M.cur].time > M.act[M.cur].getClip().duration * .75)) playClip(r, 'riding', .25);
  M.mixer.update(dt);
  // attacks face the side being hit; lean forward with speed; flinch when hit
  const turnT = r.atkT > 0 && !down ? (r.atkSide < 0 ? .9 : -1.2) : 0; M.turn += (turnT - M.turn) * Math.min(1, dt * 14); M.m.rotation.y = PI + M.turn;
  if (M.spine && !down) { M.spine.rotation.x += .25 + Math.min(.35, r.v / 90) + r.charge * .3; M.spine.rotation.z += -r.steerSm * .25 + (r.flash > 0 ? Math.sin(GM.t * 60) * .25 : 0); }
  // suspension: a spring on the body reacting to bumps, seams and solder joints
  ground(r.s, r.d, G0); const gy = G0.y;
  if (!r.air && !down && M.lastGy !== null) { const dv = (gy - M.lastGy) / Math.max(dt, 1e-3) - r.vy; M.suspV -= clamp(dv, -30, 30) * .02; }
  M.lastGy = gy; M.suspV += (-M.susp * 220 - M.suspV * 14) * dt; M.susp = clamp(M.susp + M.suspV * dt, -.16, .12);
  r.body.position.y = -1 + M.susp; r.rider.g.position.y += M.susp * .6;
  if (r.viaRoll) r.pivot.rotation.z += r.viaRoll; // upside down on the underside of the board
  if (r.isP) { const hide = MOBO.fp && !down; M.m.visible = !hide; }
  if (down) r.rag.rotation.set(r.rag.rotation.x * .9, r.rag.rotation.y, r.rag.rotation.z * .9); // let the fall clip carry the tumble
};
// camera extras: first-person handlebar view (V / R3), underside via cam, slow-mo zoom, speed feel
const _fp = new THREE.Vector3(), _fq = new THREE.Vector3();
MOBO.camera = function (dt) {
  const p = GM.player; if (!p) return;
  if (pressed.KeyV || PAD.hit[11] || PAD.hit[10]) { MOBO.fp = !MOBO.fp; toast(MOBO.fp ? 'FIRST-PERSON VIEW' : 'CHASE VIEW'); }
  const C = mComp.uniforms, sp = clamp(p.v / 38, 0, 1.3), boost = p.boostT > 0 ? 1 : 0, slow = MOBO.slowT > 0 ? 1 : 0;
  tpos(p.s, p.d, TP0);
  if (p.via) { // follow underneath, upside down
    const yaw = TP0.th, fx = Math.sin(yaw), fz = -Math.cos(yaw);
    camera.position.set(TP0.x - fx * 5.5, p.y - 1.6, TP0.z - fz * 5.5); camera.up.set(0, -1, 0); camera.lookAt(TP0.x + fx * 10, p.y - .4, TP0.z + fz * 10);
    setBend(fx, fz);
  } else if (MOBO.fp && !GM.demo && p.state !== 1) {
    const yaw = TP0.th + p.a, fx = Math.sin(yaw), fz = -Math.cos(yaw);
    p.rider.g.getWorldPosition(_fp); const bob = Math.sin(GM.t * (6 + p.v * .25)) * .025 * Math.min(1, p.v / 10);
    camera.position.set(_fp.x + fx * .05, _fp.y + .48 + bob + (p.mb ? p.mb.susp * .5 : 0), _fp.z + fz * .05);
    ground(p.s + 9, p.d, G1); camera.up.set(0, 1, 0); camera.lookAt(TP0.x + fx * 9, (G1.void ? p.y : G1.y) - .35, TP0.z + fz * 9);
    camera.rotateZ(-p.lean * .55 - cam.roll * .3); setBend(fx, fz);
  }
  // slow-motion zoom on big launches and knockouts
  const fovT = cam.fov - slow * 13; camera.fov += (fovT - camera.fov) * Math.min(1, dt * 8); camera.updateProjectionMatrix();
  // speed feel: speed lines + slight screen stretch on top of the radial blur and FOV widening
  C.uLines.value = GM.demo || MOBO.pow >= 0 ? 0 : clamp((p.v - 30) / 14, 0, 1) * (.25 + boost * .35) * (1 - slow * .6);
  C.uStretch.value = GM.demo ? 0 : clamp((p.v - 30) / 14, 0, 1) * .03 + boost * .015;
  if (sp > 1) cam.shake = Math.max(cam.shake, (sp - 1) * .4);
};
// ---------------------------------------------------------------- sound: electrical hum bed, speed whine, samples, music with a filter that opens on boost
function moboSfx(name, vol = .6, rate = 1, dur) {
  const S = MOBO.snd, c = AU.ctx; if (!c || AU.muted || !vol) return; const b = S.buf[name]; if (!b) return;
  const src = c.createBufferSource(), g = c.createGain(); src.buffer = b; src.playbackRate.value = rate; g.gain.value = vol; src.connect(g); g.connect(AU.master); src.start(0, 0, dur); }
function moboAudioInit() {
  const S = MOBO.snd, c = AU.ctx; if (!c || S.nodes) return;
  S.nodes = {}; const N = S.nodes;
  for (const k in S.raw) { const raw = S.raw[k]; delete S.raw[k]; c.decodeAudioData(raw).then(b => { S.buf[k] = b; if (k === 'dark_synthwave' && MOBO.wantMusic) MOBO.startMusic(); if (k === 'wind_loop') { const s = c.createBufferSource(); s.buffer = b; s.loop = true; s.connect(N.windG); s.start(); } }).catch(() => { }); }
  N.humG = c.createGain(); N.humG.gain.value = 0; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
  for (const [f, v] of [[60, .5], [120, .35], [180, .18], [240, .08]]) { const o = c.createOscillator(); o.type = f === 60 ? 'sawtooth' : 'sine'; o.frequency.value = f; const g = c.createGain(); g.gain.value = v; o.connect(g); g.connect(lp); o.start(); }
  lp.connect(N.humG); N.humG.connect(AU.master);
