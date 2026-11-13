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
