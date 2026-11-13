// ============================================================ RENDER: curved-world shader, post FX, sky vortex, terrain, scenery, particles
let QS = 1; // resolution scale, lowered automatically if the frame rate drops
let renderer, scene, camera, world, hemi, sunL, skyMat, terrMat, farMat, rtScene, postMesh, postScene, postCam, RW = 1, RH = 1;
const bloomA = [], bloomB = [];
const BU = { uBC: { value: new THREE.Vector3() }, uBD: { value: new THREE.Vector4(0, -1, 1900, 0) }, uBP: { value: new THREE.Vector4(1 / 260, 1, -3e-5, 260) } };
const uTime = { value: 0 }, uFogC = { value: new THREE.Color() }, uFogD = { value: .0008 };
const uHL = { value: [] }, uHLC = { value: new THREE.Color(1, .8, .5) };
for (let i = 0; i < 6; i++) uHL.value.push(new THREE.Vector4());

// The world bend: tube-wrap (growing with distance), twist around the forward axis, vertical curl. Applied to every vertex in the scene.
const BEND_GLSL = `
uniform vec3 uBC; uniform vec4 uBD; uniform vec4 uBP;
varying float vBA; varying float vBZ;
vec3 bendW(vec3 p){
  vec3 r=p-uBC; float z=r.x*uBD.x+r.z*uBD.y; float x=-r.x*uBD.y+r.z*uBD.x; float y=r.y;
  float zf=max(z,0.); vBZ=z;
  float t=smoothstep(30.,1150.,zf);
  float c=t*uBP.x; float a=clamp(x*c,-3.6,3.6); vBA=abs(x*c);
  float ah=a*.5;
  float sc=abs(a)<.02?1.-a*a/6.:sin(a)/a; float sch=abs(ah)<.02?1.-ah*ah/6.:sin(ah)/ah;
  float x2=x*sc-y*sin(a); float y2=y*cos(a)+x*ah*sch*sch;
  float ph=uBP.y*t; float sp=sin(ph), cp=cos(ph); float yy=y2-uBP.w;
  float x3=x2*cp-yy*sp; float y3=x2*sp+yy*cp+uBP.w;
  y3+=uBP.z*zf*zf;
  return uBC+vec3(-uBD.y*x3+uBD.x*z, y3, uBD.x*x3+uBD.y*z);
}
`;
const NOISE_GLSL = `
float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float n2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}
float fb(vec2 p){float s=0.,a=.5;for(int i=0;i<4;i++){s+=a*n2(p);p=p*2.03+7.1;a*=.5;}return s;}
`;
const FOG_GLSL = `
uniform vec3 uFogC; uniform float uFogD; uniform vec4 uBD; varying float vBA; varying float vBZ; varying float vFD;
float fogF(){ float ff=1.-exp(-uFogD*uFogD*vFD*vFD); ff=max(ff,smoothstep(uBD.z*.62,uBD.z*.97,vBZ)); return max(ff,smoothstep(2.3,3.05,vBA)); }
`;
function patch(m, fs = 1) {
  m.onBeforeCompile = sh => {
    sh.uniforms.uBC = BU.uBC; sh.uniforms.uBD = BU.uBD; sh.uniforms.uBP = BU.uBP;
    sh.vertexShader = BEND_GLSL + sh.vertexShader.replace('#include <project_vertex>', `vec4 mvPosition=vec4(transformed,1.0);
#ifdef USE_INSTANCING
mvPosition=instanceMatrix*mvPosition;
#endif
mvPosition=modelMatrix*mvPosition; mvPosition.xyz=bendW(mvPosition.xyz); mvPosition=viewMatrix*mvPosition; gl_Position=projectionMatrix*mvPosition;`);
    sh.fragmentShader = 'uniform vec4 uBD;varying float vBA;varying float vBZ;\n' + sh.fragmentShader.replace('#include <fog_fragment>', `if(vBZ>uBD.z||vBA>3.1416)discard;
#ifdef USE_FOG
float ff=1.0-exp(-fogDensity*fogDensity*vFogDepth*vFogDepth*${fs.toFixed(3)});
ff=max(ff,smoothstep(uBD.z*.62,uBD.z*.97,vBZ)); ff=max(ff,smoothstep(2.3,3.05,vBA));
gl_FragColor.rgb=mix(gl_FragColor.rgb,fogColor,ff*${fs < 1 ? '.85' : '1.'});
#endif`);
  };
  m.customProgramCacheKey = () => 'bend' + fs;
  return m;
}
const matCache = {};
function M(c, e) { const k = c + '|' + (e || 0); return matCache[k] || (matCache[k] = patch(new THREE.MeshLambertMaterial({ color: c, emissive: e || 0, flatShading: true }))); }
function MB(r, g, b, fs = 1) { const k = 'B' + r + ',' + g + ',' + b + ',' + fs; if (matCache[k]) return matCache[k]; const m = new THREE.MeshBasicMaterial(); m.color.setRGB(r, g, b); return matCache[k] = patch(m, fs); }

const POST_VS = 'varying vec2 vUv; void main(){ vUv=position.xy*.5+.5; gl_Position=vec4(position.xy,0.,1.); }';
function postMat(fs, u) { return new THREE.ShaderMaterial({ vertexShader: POST_VS, fragmentShader: fs, uniforms: u, depthTest: false, depthWrite: false }); }
let mPre, mDown, mUp, mComp;

function initRender() {
  renderer = new THREE.WebGLRenderer({ canvas: $('c'), antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  scene = new THREE.Scene(); scene.fog = new THREE.FogExp2(0, .0008);
  camera = new THREE.PerspectiveCamera(70, 1, .3, 9000);
  hemi = new THREE.HemisphereLight(0xffffff, 0x444466, .85); scene.add(hemi);
  sunL = new THREE.DirectionalLight(0xffffff, .9); scene.add(sunL);
  world = new THREE.Group(); scene.add(world);
  // --- sky with focal vortex (fullscreen)
  skyMat = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false,
    uniforms: { uVC: { value: new THREE.Vector2() }, uAsp: { value: 1 }, uTime, uType: { value: 0 }, uFan: { value: 0 }, uFanP: { value: 0 }, uPow: { value: 0 }, cA: { value: new THREE.Color() }, cB: { value: new THREE.Color() }, cC: { value: new THREE.Color() }, cD: { value: new THREE.Color() } },
    vertexShader: 'varying vec2 vN; void main(){ vN=position.xy; gl_Position=vec4(position.xy,1.,1.); }',
    fragmentShader: NOISE_GLSL + `
varying vec2 vN; uniform vec2 uVC; uniform float uAsp,uTime,uType,uFan,uFanP,uPow; uniform vec3 cA,cB,cC,cD;
mat2 rt(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
float starf(vec2 g,float th){ vec2 id=floor(g),f=fract(g)-.5; float h=h21(id); vec2 o=(vec2(h21(id+3.7),h21(id+7.3))-.5)*.6; return step(th,h)*smoothstep(.2,.0,length(f-o))*(.55+.45*sin(uTime*3.+h*50.)); }
void main(){
  vec2 p=(vN-uVC)*vec2(uAsp,1.); float r=length(p)+1e-4; float lr=log(r);
  vec2 q=rt(lr*2.4-uTime*.06)*p/pow(r,.55);
  float cl=fb(q*2.2+vec2(0.,uTime*.03)); float cl2=fb(q*5.+3.);
  vec3 col=mix(cB,cA,smoothstep(.12,1.3,r));
  if(uType<.5){
    col=mix(col,cC,exp(-r*4.));
    float m=smoothstep(.4,.7,cl)*smoothstep(.06,.32,r);
    col=mix(col,cD*(.78+.4*cl2),m*.92);
    col+=cC*.3*exp(-r*2.2)*cl;
  } else if(uType<1.5){
    col+=vec3(.8,.9,1.)*starf(q*38.,.88)*1.6*smoothstep(.28,.5,r);
    float au=pow(abs(sin(q.x*3.+fb(q*1.4)*5.+uTime*.25)),7.)*smoothstep(.28,.55,r)*smoothstep(1.7,.6,r);
    col+=cD*au*1.25; col+=cD.bgr*au*.25;
    float md=smoothstep(.275,.262,r); float cr=fb(p*8.+2.)*.6+fb(p*21.)*.4;
    col+=cC*.4*exp(-max(r-.26,0.)*6.);
    col=mix(col,cC*(.7+.5*cr),md);
  } else if(uType<2.5){
    float sm=smoothstep(.36,.7,cl);
    col=mix(col,cA*.5,sm*.85*smoothstep(.08,.5,r));
    col+=cC*exp(-r*3.2)*(.5+.9*cl2);
    col+=cD*(.3+.7*cl)*smoothstep(.55,.2,r)*.35;
    float em=starf(q*20.+vec2(uTime*.5,uTime*.2),.86)+starf(q*44.-vec2(uTime*.7,0.),.9);
    col+=cD*em*2.2;
  } else if(uType<3.5){
    col=mix(col,cC*.55,exp(-r*2.6));
    float sd=smoothstep(.335,.322,r);
    float bar=smoothstep(.0,.03,sin(p.y*46.+uTime*.4)+p.y*7.+.9);
    col=mix(col,cC*mix(.6,1.,clamp(p.y*1.6+.6,0.,1.)),sd*bar);
    float m=smoothstep(.48,.76,cl)*smoothstep(.36,.62,r);
    col=mix(col,cD*(.8+.4*cl2),m*.8);
  } else if(uType>5.5){
    // MOLTEN MINE: black rock overhead, lava glow welling up from below the horizon
    float hy=p.y; col=mix(cB,cA,smoothstep(-.4,.22,hy));
    col+=cC*.2*exp(-abs(hy+.3)*5.)*(.7+.3*cl);
    col+=cD*starf(q*30.+vec2(0.,uTime*.4),.93)*.45*smoothstep(.15,-.3,hy);
  } else if(uType>4.5){
    // MOTHERBOARD: a dark room seen from the board; a desk lamp up-left, blurred room lights, a monitor glow ahead
    vec2 sp=p; float hy=sp.y;
    col=mix(cB,cA,smoothstep(-.02,.9,hy));                                                   // wall darkens upward from the horizon
    col+=vec3(.02,.035,.04)*smoothstep(.25,-.05,hy);                                          // haze at the horizon
    for(int i=0;i<10;i++){ float fi=float(i); vec2 c=vec2(h21(vec2(fi,1.))*4.4-2.2,h21(vec2(fi,7.))*.7+.08); float bk=smoothstep(.09,.03,length(sp-c)); col+=mix(vec3(.3,.7,.6),vec3(1.,.65,.35),h21(vec2(fi,3.)))*bk*.05; } // soft bokeh
    vec2 lp=sp-vec2(-1.15,.58); col+=cC*(exp(-length(lp)*2.6)*.28+exp(-length(lp)*14.)*.9);          // desk lamp = the sun
    col+=cC*.07*exp(-abs(sp.x+1.15+sp.y*.3)*4.)*smoothstep(.58,0.,hy);                             // its light cone
    vec2 mp=sp-vec2(.25,.32); float mon=smoothstep(.02,0.,max(abs(mp.x)-.55,abs(mp.y)-.22));       // monitor out of focus
    col=mix(col,vec3(.05,.08,.1)+vec3(.04,.07,.09)*smoothstep(.3,0.,length(mp*vec2(.5,1.))),mon*.8);
    col+=cD*.25*uPow*exp(-length(sp)*2.);
  } else {
    float st=starf(q*40.,.8)*1.8+starf(q*95.+11.,.86)*1.1+starf(q*17.,.93)*2.6;
    col+=vec3(1.,.95,.85)*st*smoothstep(.03,.22,r);
    col+=cD*smoothstep(.38,.8,cl)*.4;
    col+=cC*exp(-r*6.)*1.4; col+=cB*exp(-r*2.)*.6;
  }
  gl_FragColor=vec4(col,1.);
}` });
  const tri = new THREE.BufferGeometry(); tri.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  const sky = new THREE.Mesh(tri, skyMat); sky.frustumCulled = false; sky.renderOrder = -100; scene.add(sky);
  // --- terrain materials (near strip + far landscape)
  const terrU = { uBC: BU.uBC, uBD: BU.uBD, uBP: BU.uBP, uTime, uFogC, uFogD, uHL, uHLC, uPat: { value: 0 }, uLava: { value: new THREE.Color(1.5, .45, .07) } };
  const TV = BEND_GLSL + `attribute vec3 aCol; attribute float aGlow; varying vec3 vC,vW; varying float vG,vFD;
void main(){ vec4 wp=modelMatrix*vec4(position,1.); vW=wp.xyz; vec4 mv=viewMatrix*vec4(bendW(wp.xyz),1.); vFD=-mv.z; gl_Position=projectionMatrix*mv; vC=aCol; vG=aGlow; }`;
  const TF = far => NOISE_GLSL + FOG_GLSL + `uniform float uTime,uPat; uniform vec4 uHL[6]; uniform vec3 uHLC,uLava; varying vec3 vC,vW; varying float vG;
void main(){
  if(vBZ>uBD.z||vBA>3.1416)discard;
  float g=n2(vW.xz*${far ? '.02' : '.35'})*.6+n2(vW.xz*${far ? '.09' : '1.7'})*.4;
  vec3 col=vC*(.8+.4*g); float gl=0.;
  ${far ? `
  if(uPat>.5&&uPat<1.5){ float v=1.-abs(n2(vW.xz*.0045)*2.-1.); float v2=1.-abs(n2(vW.xz*.013+5.)*2.-1.); gl=smoothstep(.9,.985,v)+smoothstep(.93,.99,v2)*.7; col=mix(col,uLava,clamp(gl,0.,1.)); gl*=1.4+.4*sin(uTime*1.5+vW.x*.01); }
  else if(uPat>1.5&&uPat<2.5){ float dxr=abs(vG*2200.)-(440.+90.*sin(vW.z*.0035)); gl=smoothstep(30.,12.,abs(dxr)); col=mix(col,vec3(.35,1.25,1.5),gl); gl*=.9+.3*n2(vW.xz*.05+uTime*.5); col*=.85+.3*sin(vW.y*.11+g*2.); }
  else if(uPat>3.5){ vec2 g=vW.xz/22.; vec2 id=floor(g),f=fract(g); float h=h21(id); float ln=step(h,.5)*smoothstep(.05,.0,abs(f.y-.5))+step(.4,h)*step(h,.9)*smoothstep(.05,.0,abs(f.x-.5)); float pad=smoothstep(.12,.08,length(f-.5))*step(.7,h);
    col=mix(col,vec3(.05,.2,.09),clamp(ln,0.,1.)*.8); col=mix(col,vec3(.55,.53,.48),pad); col=mix(col,vec3(.02,.025,.03),step(.965,h)*step(abs(f.x-.5),.42)*step(abs(f.y-.5),.42)); gl=0.; } // Motherboard: plain PCB, no glow
  else if(uPat>2.5){ float w=sin(vW.x*.02+n2(vW.xz*.003)*7.+vW.z*.007); gl=smoothstep(.9,1.,w)*.9; col=mix(col,vec3(1.5,1.05,.3),gl); }
  ` : `
  float hl=0.; for(int i=0;i<6;i++){ vec3 d=vW-uHL[i].xyz; hl+=uHL[i].w*exp(-dot(d,d)*.035); }
  col+=(col*.5+uHLC*.07)*min(hl,1.3);
  gl=vG; col+=vC*vG*(1.5+.5*sin(uTime*2.+vW.x*.13+vW.z*.11));`}
  col=mix(col,uFogC,fogF()*(1.-.4*clamp(gl,0.,1.)));
  gl_FragColor=vec4(col,1.);
}`;
  terrMat = new THREE.ShaderMaterial({ uniforms: terrU, vertexShader: TV, fragmentShader: TF(false), side: THREE.DoubleSide });
  farMat = new THREE.ShaderMaterial({ uniforms: terrU, vertexShader: TV, fragmentShader: TF(true), side: THREE.DoubleSide });
  // --- post
  postScene = new THREE.Scene(); postCam = new THREE.Camera();
  postMesh = new THREE.Mesh(tri, null); postMesh.frustumCulled = false; postScene.add(postMesh);
  mPre = postMat('varying vec2 vUv; uniform sampler2D t; void main(){ vec3 c=texture2D(t,vUv).rgb; float m=max(c.r,max(c.g,c.b)); gl_FragColor=vec4(min(c,vec3(8.))*smoothstep(.92,1.6,m),1.); }', { t: { value: null } });
  mDown = postMat('varying vec2 vUv; uniform sampler2D t; uniform vec2 px; void main(){ vec3 c=texture2D(t,vUv+px*vec2(-1,-1)).rgb+texture2D(t,vUv+px*vec2(1,-1)).rgb+texture2D(t,vUv+px*vec2(-1,1)).rgb+texture2D(t,vUv+px*vec2(1,1)).rgb; gl_FragColor=vec4(c*.25,1.); }', { t: { value: null }, px: { value: new THREE.Vector2() } });
  mUp = postMat('varying vec2 vUv; uniform sampler2D t,h; uniform vec2 px; void main(){ vec3 c=texture2D(t,vUv+px*vec2(-1,-1)).rgb+texture2D(t,vUv+px*vec2(1,-1)).rgb+texture2D(t,vUv+px*vec2(-1,1)).rgb+texture2D(t,vUv+px*vec2(1,1)).rgb; gl_FragColor=vec4(c*.25+texture2D(h,vUv).rgb,1.); }', { t: { value: null }, h: { value: null }, px: { value: new THREE.Vector2() } });
  mComp = postMat(`varying vec2 vUv; uniform sampler2D tS,tB; uniform float uBloom,uBlur,uWhite,uFlash,uAsp,uSat,uStretch,uLines,uTimeP,uHeat; uniform vec2 uC; uniform vec3 uTint,uGrade,uLift;
float hh(float n){return fract(sin(n)*43758.5453);}
void main(){
  vec2 uv=uC+(vUv-uC)*vec2(1.-uStretch,1.+uStretch*.35);   // slight screen stretch at speed (0 = off)
  uv.x+=sin(uv.y*64.+uTimeP*5.)*uHeat*.0022*smoothstep(.8,.15,uv.y);   // heat shimmer (0 = off)
  vec2 dir=uv-uC; float r=length(dir*vec2(uAsp,1.));
  float amt=uBlur*smoothstep(.16,.62,r);
  vec3 col=vec3(0.); for(int i=0;i<8;i++){ col+=texture2D(tS,uv-dir*amt*float(i)*.02).rgb; } col*=.125;
  vec3 bl=texture2D(tB,uv).rgb; col+=bl*uBloom;
  col+=uTint*uFlash*(.35+r*.9);
  float l=dot(col,vec3(.3,.59,.11)); col=mix(vec3(l),col,uSat);
  col=mix(col,vec3(.92,.96,1.05),uWhite*(.55+.45*smoothstep(.0,.7,r)));
  vec3 x=max(col,0.); col=mix(x,.72+.28*(1.-exp(-(x-.72)/.28)),step(.72,x));
  if(uLines>0.){ float an=atan(dir.y,dir.x*uAsp); float k=floor(an*60.); float ln=step(.82,hh(k+floor(uTimeP*14.)*.37))*smoothstep(.22,.7,r)*smoothstep(.02,.0,abs(fract(an*60.)-.5)-.18); col+=vec3(.75,1.,.95)*ln*uLines*.55; } // speed lines
  col=col*uGrade+uLift;                                                        // per-world grade (identity unless set)
  vec2 v=vUv-.5; col*=1.-dot(v,v)*.75;
  gl_FragColor=vec4(col,1.);
}`, { tS: { value: null }, tB: { value: null }, uBloom: { value: .5 }, uStretch: { value: 0 }, uHeat: { value: 0 }, uLines: { value: 0 }, uTimeP: uTime, uGrade: { value: new THREE.Vector3(1, 1, 1) }, uLift: { value: new THREE.Vector3(0, 0, 0) }, uBlur: { value: 0 }, uWhite: { value: 0 }, uFlash: { value: 0 }, uAsp: { value: 1 }, uSat: { value: 1.12 }, uC: { value: new THREE.Vector2(.5, .5) }, uTint: { value: new THREE.Color(1, .6, .2) } });
  initFX();
  resize(); addEventListener('resize', resize);
}
function resize() {
  const w = innerWidth, h = innerHeight, k = Math.min(1, 1080 / h, 1920 / w) * QS;
  RW = Math.max(2, Math.round(w * k)); RH = Math.max(2, Math.round(h * k));
  renderer.setSize(RW, RH, false);
  camera.aspect = RW / RH; camera.updateProjectionMatrix();
  if (rtScene) rtScene.dispose(); bloomA.concat(bloomB).forEach(t => t.dispose()); bloomA.length = bloomB.length = 0;
  const o = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false };
  rtScene = new THREE.WebGLRenderTarget(RW, RH, { ...o, depthBuffer: true, samples: 4 });
  for (let i = 0; i < 4; i++) { const d = 2 << i; bloomA.push(new THREE.WebGLRenderTarget(Math.max(1, RW / d | 0), Math.max(1, RH / d | 0), o)); bloomB.push(new THREE.WebGLRenderTarget(Math.max(1, RW / d | 0), Math.max(1, RH / d | 0), o)); }
  skyMat.uniforms.uAsp.value = mComp.uniforms.uAsp.value = RW / RH;
}
function pass(m, target) { postMesh.material = m; renderer.setRenderTarget(target); renderer.render(postScene, postCam); }
const _v3 = new THREE.Vector3();
function setBend(fx, fz) {
  BU.uBC.value.copy(camera.position); BU.uBD.value.x = fx; BU.uBD.value.y = fz;
  const Z = BU.uBD.value.z, R = BU.uBP.value.w, k = BU.uBP.value.z;
  _v3.set(camera.position.x + fx * Z, camera.position.y + R + k * Z * Z, camera.position.z + fz * Z).project(camera);
  skyMat.uniforms.uVC.value.set(clamp(_v3.x, -1.5, 1.5), clamp(_v3.y, -1.5, 1.5));
  mComp.uniforms.uC.value.set(.5 + clamp(_v3.x, -.6, .6) * .25, .5 + clamp(_v3.y, -.6, .6) * .25);
}
function renderFrame() {
  FXP.mat.uniforms.uPS.value = RH / (2 * Math.tan(camera.fov * PI / 360));
  renderer.setRenderTarget(rtScene); renderer.render(scene, camera);
  mPre.uniforms.t.value = rtScene.texture; pass(mPre, bloomA[0]);
  for (let i = 1; i < 4; i++) { mDown.uniforms.t.value = bloomA[i - 1].texture; mDown.uniforms.px.value.set(.5 / bloomA[i - 1].width, .5 / bloomA[i - 1].height); pass(mDown, bloomA[i]); }
  let low = bloomA[3];
  for (let i = 2; i >= 0; i--) { mUp.uniforms.t.value = low.texture; mUp.uniforms.h.value = bloomA[i].texture; mUp.uniforms.px.value.set(1 / low.width, 1 / low.height); pass(mUp, bloomB[i]); low = bloomB[i]; }
  mComp.uniforms.tS.value = rtScene.texture; mComp.uniforms.tB.value = low.texture; pass(mComp, null);
}

// ============================================================ WORLD BUILD
const worldGeos = [];
function clearWorld() { for (const g of worldGeos) g.dispose(); worldGeos.length = 0; while (world.children.length) world.remove(world.children[0]); }
function addMesh(geo, mat) { const m = new THREE.Mesh(geo, mat); m.frustumCulled = false; world.add(m); worldGeos.push(geo); return m; }
const _o3 = new THREE.Object3D(), _col = new THREE.Color();
function inst(geo, mat, items) {
  if (!items.length) return null;
  const m = new THREE.InstancedMesh(geo, mat, items.length);
  items.forEach((it, i) => {
    _o3.position.set(it.x, it.y, it.z); _o3.scale.set(it.sx || 1, it.sy || it.sx || 1, it.sz || it.sx || 1); _o3.rotation.set(it.rx || 0, it.ry || 0, it.rz || 0, 'YXZ'); _o3.updateMatrix(); m.setMatrixAt(i, _o3.matrix);
    if (it.c) { _col.setRGB(it.c[0], it.c[1], it.c[2]); m.setColorAt(i, _col); }
  });
  m.frustumCulled = false; world.add(m); worldGeos.push(geo); return m;
}
const GV = {}, TP = {};
function visY(G, x, z) { // visual height = physics ground + decorative ruggedness where nobody rides
  let y = G.y;
  if (G.reg === 2 && G.void) y -= fbm(x * .07, z * .07, 3) * 8 * Math.min(1, (G.e - 2.5) / 8);
  else if (G.reg === 3) y += fbm(x * .09, z * .09, 3) * 6 * Math.min(1, G.e / 6);
  else if (G.reg === 5) y -= fbm(x * .1, z * .1, 2) * 6;
  return y;
}
function colorAt(G, s, d, y, i, out) {
  const T = track, P = course.pal; let c, g = 0; const n = vnoise(s * .07, d * .21);
  if (G.reg === 0) {
    c = mix3(P.road, P.road2, n);
    if (G.surf === 1) { c = mix3(P.ice, [1.2, 1.3, 1.4], n * .3); g = .22; } else if (G.surf === 2) c = mix3(P.sand, P.road2, n * .4);
    if (T.crest[i] && P.crest) { c = mix3(c, P.crest, .55); g = .35; }
    if (T.rampF[i]) { const k = ((s / 4) | 0) % 2; c = mix3(c, P.ramp, k ? .75 : .3); g = k ? .7 : .15; }
    if (G.edge < 1.3) { c = mix3(c, P.edge, .75); g = .4; }
    for (const k of T.kicks) if (s > k.s0 - .5 && s < k.s0 + k.len + .5 && Math.abs(d - k.d) < k.hw + .6) { const st = ((s - k.s0) / 3 | 0) % 2; c = mix3(c, P.ramp, st ? .9 : .45); g = st ? .9 : .3; }
    for (const p of T.pads) if (Math.abs(s - p.s) < 4.2 && Math.abs(d - p.d) < 2.6) { const st = (((s - p.s + 8) / 2) | 0) % 2; c = st ? [.35, 1.7, .75] : [.1, .55, .3]; g = st ? 1.1 : .3; }
    for (const p of T.pools) { const q = Math.hypot(s - p.s, d - p.d); if (q < p.r + 1.2) { c = q < p.r ? P.lava : mix3(P.lava, c, .6); g = q < p.r ? 1.1 : .4; } }
    for (const p of T.geysers) { const q = Math.hypot(s - p.s, d - p.d); if (q < 3.4) { c = [.5, 1.3, 1.5]; g = q > 1.8 ? .9 : .25; } }
  } else if (G.reg === 1) { c = mix3(P.branch, P.road2, n * .4); if (G.edge < 1.1) { c = P.edge2; g = .45; } }
  else if (G.reg === 2 || G.reg === 5) { const dep = Math.max(0, G.h - y), t = clamp(dep / 42, 0, 1); c = mix3(mix3(P.sh, P.cliff, Math.min(1, dep / 5)), P.deep, t); g = t * t * P.deepGlow * (G.reg === 5 ? 1.5 : 1); }
  else if (G.reg === 3) { c = mix3(P.wall, P.wall2, .5 + .5 * Math.sin(y * .55 + n * 3)); }
  else { c = P.lava || [1.5, .45, .07]; g = .4 + .2 * n; }
  out[0] = c[0]; out[1] = c[1]; out[2] = c[2]; out[3] = g;
}
function shadeGrid(pos, col, rows, cols) { // bake painterly light: lit side warm, shadow side cool
  const S = course.sun, sl = Math.hypot(S[0], S[1], S[2]), sx = S[0] / sl, sy = S[1] / sl, sz = S[2] / sl, LT = course.lightT, ST = course.shadowT;
  for (let r = 0; r < rows; r++) for (let j = 0; j < cols; j++) {
    const a = (r * cols + Math.min(cols - 1, j + 1)) * 3, b = (r * cols + Math.max(0, j - 1)) * 3, c = (Math.min(rows - 1, r + 1) * cols + j) * 3, e = (Math.max(0, r - 1) * cols + j) * 3;
    const ax = pos[a] - pos[b], ay = pos[a + 1] - pos[b + 1], az = pos[a + 2] - pos[b + 2], bx = pos[c] - pos[e], by = pos[c + 1] - pos[e + 1], bz = pos[c + 2] - pos[e + 2];
    let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx; const l = Math.hypot(nx, ny, nz) || 1; if (ny < 0) { nx = -nx; ny = -ny; nz = -nz; }
    const ndl = clamp((nx * sx + ny * sy + nz * sz) / l * .75 + .3, 0, 1), v = (r * cols + j) * 3;
    col[v] *= lerp(ST[0], LT[0], ndl) * .86; col[v + 1] *= lerp(ST[1], LT[1], ndl) * .86; col[v + 2] *= lerp(ST[2], LT[2], ndl) * .86;
  }
}
function gridGeo(pos, col, glo, rows, cols) {
  const idx = new (rows * cols > 65535 ? Uint32Array : Uint16Array)((rows - 1) * (cols - 1) * 6); let k = 0;
  for (let r = 0; r < rows - 1; r++) for (let j = 0; j < cols - 1; j++) { const a = r * cols + j, b = a + 1, c = a + cols, d = c + 1; idx[k++] = a; idx[k++] = c; idx[k++] = b; idx[k++] = b; idx[k++] = c; idx[k++] = d; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aCol', new THREE.BufferAttribute(col, 3)); g.setAttribute('aGlow', new THREE.BufferAttribute(glo, 1)); g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}
function buildTerrain() {
  const T = track, NC = 44, HW = 44, CH = 64, cols = NC + 1, C = [0, 0, 0, 0];
  for (let c0 = 0; c0 < T.N - 1; c0 += CH) {
    const c1 = Math.min(c0 + CH, T.N - 1), rows = c1 - c0 + 1, nv = rows * cols;
    const pos = new Float32Array(nv * 3), col = new Float32Array(nv * 3), glo = new Float32Array(nv); let v = 0;
    for (let r = 0; r < rows; r++) {
      const i = c0 + r, s = i * DS, th = T.th[i], k = T.kap[i], ct = Math.cos(th), st = Math.sin(th);
      for (let j = 0; j <= NC; j++, v++) {
        const d = -HW + j * 2; let dd = d; if (k * d > .8) dd = .8 / k;
        ground(s, d, GV); const x = T.cx[i] + ct * dd, z = T.cz[i] + st * dd, y = visY(GV, x, z);
        pos[v * 3] = x; pos[v * 3 + 1] = y; pos[v * 3 + 2] = z;
        colorAt(GV, s, d, y, i, C); col[v * 3] = C[0]; col[v * 3 + 1] = C[1]; col[v * 3 + 2] = C[2]; glo[v] = C[3];
      }
    }
    shadeGrid(pos, col, rows, cols);
    addMesh(gridGeo(pos, col, glo, rows, cols), terrMat);
  }
}
// rows of the far landscape (beyond the track ends it continues straight so the tunnel never runs out)
function farRow(z) {
  const T = track, e = T.N - 1;
  if (z < T.cz[e]) return { x: T.cx[e], base: T.cyS[e] - (T.cz[e] - z) * .07 };
  if (z > T.cz[0]) return { x: T.cx[0], base: T.cyS[0] + (z - T.cz[0]) * .07 };
  const i = idxAtZ(z); return { x: T.cx[i], base: T.cyS[i] };
}
function farHb(base, dx, x, z) {
  const a = Math.abs(dx), F = course.far;
  if (F.flat) return base - F.flat; // Motherboard: the far board is flat
  let y = base - 24 - F.drop * sstep(60, 300, a);
  y += (fbm(x * .004 + 3.1, z * .004 + 1.7) - .5) * F.hill * sstep(110, 500, a);
  y += ridged(x * .0016 + 9.2, z * .0016) * F.mtn * sstep(380, 950, a) * (1 - .6 * sstep(1500, 2200, a));
  return y;
}
function farAt(x, z) { const r = farRow(z); return farHb(r.base, x - r.x, x, z); }
function buildFar() {
  const T = track, F = course.far, FX = [60, 90, 125, 165, 210, 260, 320, 390, 470, 560, 660, 780, 920, 1080, 1260, 1460, 1680, 1920, 2200];
  const zs = []; for (let k = 12; k >= 1; k--) zs.push(T.cz[0] + k * 16);
  for (let i = 0; i < T.N; i += 8) zs.push(T.cz[i]);
  const zEnd = T.cz[T.N - 1]; for (let k = 1; k <= 130; k++) zs.push(zEnd - k * 16);
  const span = F.hill * .5 + F.mtn * .55 + 30;
  for (let side = -1; side <= 1; side++) {
    const xs = side === 0 ? [-60, -30, 0, 30, 60] : FX.map(v => v * side), cols = xs.length;
    for (let r0 = 0; r0 < zs.length - 1; r0 += 24) {
      const r1 = Math.min(r0 + 24, zs.length - 1), rows = r1 - r0 + 1, nv = rows * cols;
      if (side === 0 && zs[r1] > zEnd - 1 && zs[r0] < T.cz[0] + 1) continue; // centre strip only where there is no track
      const pos = new Float32Array(nv * 3), col = new Float32Array(nv * 3), glo = new Float32Array(nv); let v = 0;
      for (let r = 0; r < rows; r++) {
        const z = zs[r0 + r], row = farRow(z);
        for (let j = 0; j < cols; j++, v++) {
          const dx = xs[j], x = row.x + dx, y = farHb(row.base, dx, x, z);
          pos[v * 3] = x; pos[v * 3 + 1] = y; pos[v * 3 + 2] = z;
          const t = clamp((y - (row.base - 24 - F.drop)) / span, 0, 1), c = mix3(F.lo, F.hi, t * t * (3 - 2 * t));
          col[v * 3] = c[0]; col[v * 3 + 1] = c[1]; col[v * 3 + 2] = c[2]; glo[v] = dx / 2200;
        }
      }
      shadeGrid(pos, col, rows, cols);
      addMesh(gridGeo(pos, col, glo, rows, cols), farMat);
    }
  }
}
function buildScenery() {
  const T = track, S = course.sc, rnd = RNG(1234 + COURSES.indexOf(course) * 77), R = (a, b) => a + (b - a) * rnd();
  const zA = T.cz[0] + 150, zB = T.cz[T.N - 1] - 1900;
  const farSpot = (dmin, dmax, pw = 1) => { const z = R(zB, zA), row = farRow(z), dx = (rnd() < .5 ? -1 : 1) * (dmin + Math.pow(rnd(), pw) * (dmax - dmin)), x = row.x + dx; return { x, z, y: farHb(row.base, dx, x, z), dx, base: row.base }; };
  // --- trees / spires
  if (S.tree.n) {
    const geo = S.tree.spire ? new THREE.ConeGeometry(1, 4.5, 5) : new THREE.ConeGeometry(1, 3.2, 6); geo.translate(0, S.tree.spire ? 2.1 : 1.5, 0);
    const items = [];
    for (let i = 0; i < S.tree.n; i++) { const p = farSpot(75, 1900, 1.5), sc = R(3, 7.5) * (1 + Math.abs(p.dx) / 1500), k = rnd(); items.push({ x: p.x, y: p.y - 1, z: p.z, sx: sc * R(.8, 1.2), sy: sc * R(.9, 1.6), sz: sc, ry: R(0, 6), c: mix3(S.tree.c1, S.tree.c2, k * k) }); }
    for (let i = 0; i < S.tree.near; i++) {
      const s = R(40, T.len - 20), sd = rnd() < .5 ? -1 : 1, w = arrAt(T.wid, s), d = sd * (w + R(3.5, 30));
      ground(s, d, GV); if (GV.reg !== 3 && !(GV.reg === 2 && GV.void)) continue;
      if (Math.abs(kapAt(s) * d) > .6) continue;
      tpos(s, d, TP); const sc = R(1.6, 3.4), k = rnd();
      items.push({ x: TP.x, y: visY(GV, TP.x, TP.z) - .5, z: TP.z, sx: sc, sy: sc * R(1, 1.5), sz: sc, ry: R(0, 6), c: mix3(S.tree.c1, S.tree.c2, k * k) });
    }
    inst(geo, patch(new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true })), items);
  }
  // --- rocks
  { const items = [], P = course.pal;
    for (let i = 0; i < S.rocks; i++) {
      const s = R(40, T.len - 20), sd = rnd() < .5 ? -1 : 1, w = arrAt(T.wid, s), d = sd * (w + R(1.6, 14));
      ground(s, d, GV); if (GV.reg === 0 || GV.reg === 1 || GV.reg === 5 || GV.reg === 4) continue; if (GV.reg === 2 && GV.e < 1.5) continue;
      tpos(s, d, TP); const sc = R(.6, 2.2); items.push({ x: TP.x, y: visY(GV, TP.x, TP.z), z: TP.z, sx: sc, sy: sc * R(.6, 1.3), sz: sc * R(.7, 1.3), ry: R(0, 6), rx: R(0, 1), c: mix3(P.cliff, P.wall, rnd()) });
    }
    inst(new THREE.IcosahedronGeometry(1, 0), patch(new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true })), items); }
  // --- far lights (towns, villages, embers, lantern seas)
  { const items = [], L = S.lights, cl = [];
    for (let i = 0; i < 26; i++) cl.push(farSpot(160, 1500, 1.3));
    for (let i = 0; i < L.n; i++) {
      let p;
      if (L.clustered && rnd() < .85) { const c = cl[(rnd() * cl.length) | 0], x = c.x + (rnd() + rnd() + rnd() - 1.5) * 190, z = c.z + (rnd() + rnd() + rnd() - 1.5) * 190; p = { x, z, y: farAt(x, z) }; }
      else p = farSpot(130, 2000, 1.2);
      const sc = R(2.2, 5.5), b = R(.5, 1.25);
      items.push({ x: p.x, y: p.y + R(1, 9), z: p.z, sx: sc, sy: sc * R(.6, 1.6), sz: sc, c: [b, b * R(.75, 1), b * R(.6, 1)] });
    }
    inst(new THREE.BoxGeometry(1, 1, 1), MB(L.col[0], L.col[1], L.col[2], .22), items); }
  // --- clouds (day courses)
  if (S.clouds) {
    const items = [];
    for (let i = 0; i < S.clouds; i++) { const p = farSpot(260, 1500, 1), y0 = p.base + R(-20, 230); for (let k = 0; k < 5; k++) { const sc = R(35, 95); items.push({ x: p.x + R(-90, 90), y: y0 + R(-18, 30), z: p.z + R(-90, 90), sx: sc, sy: sc * .55, sz: sc, c: [R(.9, 1), R(.9, 1), R(.9, 1)] }); } }
    inst(new THREE.IcosahedronGeometry(1, 1), MB(S.cloudCol[0], S.cloudCol[1], S.cloudCol[2], .45), items);
  }
  // --- ruins: pillars and a line of lantern-lit arches running to the horizon
  if (S.pillars) {
    const items = [], lit = [], stone = patch(new THREE.MeshLambertMaterial({ color: 0x5a4fb0, flatShading: true }));
    for (let i = 0; i < S.pillars; i++) { const p = farSpot(70, 1700, 1.6), h = R(12, 46), r = R(2, 4.5); items.push({ x: p.x, y: p.y + h / 2 - 2, z: p.z, sx: r, sy: h, sz: r, ry: R(0, 3) }); if (rnd() < .6) lit.push({ x: p.x, y: p.y + h, z: p.z, sx: R(2, 3.4) }); }
    inst(new THREE.CylinderGeometry(.5, .6, 1, 6), stone, items);
    const box = [];
    for (let i = 0; i < S.arches; i++) for (const sd of [-1, 1]) {
      const z = T.cz[0] - i * 62, row = farRow(z), dx = sd * 150, x = row.x + dx, y = farHb(row.base, dx, x, z), H = 46;
      box.push({ x: x - 15, y: y + H / 2 - 3, z, sx: 7, sy: H, sz: 7 }, { x: x + 15, y: y + H / 2 - 3, z, sx: 7, sy: H, sz: 7 }, { x, y: y + H, z, sx: 44, sy: 7, sz: 8 });
      lit.push({ x, y: y + H - 9, z, sx: 3.2 });
    }
    inst(new THREE.BoxGeometry(1, 1, 1), stone, box);
    inst(new THREE.IcosahedronGeometry(1, 0), MB(S.lantern[0], S.lantern[1], S.lantern[2], .3), lit);
  }
  // --- trackside lanterns
  if (!course.mb) { const poles = [], bulbs = [];
    for (let i = 6; i < T.N - 4; i += 12) {
      const s = i * DS, sd = (i / 12) % 2 ? 1 : -1, side = sd > 0 ? T.sR[i] : T.sL[i]; if (T.gap[i] || T.gap[i + 2] || T.gap[i - 2]) continue;
      let d = sd * (T.wid[i] + (side === 2 ? .2 : 1.3)); if (T.bw[i] > 0 && Math.sign(T.bo[i]) === sd) continue;
      ground(s, d, GV); tpos(s, d, TP);
      poles.push({ x: TP.x, y: GV.y + 1.2, z: TP.z, sx: .12, sy: 2.6, sz: .12 }); bulbs.push({ x: TP.x, y: GV.y + 2.6, z: TP.z, sx: .32 });
    }
    inst(new THREE.BoxGeometry(1, 1, 1), M(0x221a33), poles);
    inst(new THREE.IcosahedronGeometry(1, 0), MB(S.lantern[0], S.lantern[1], S.lantern[2], .3), bulbs); }
  // --- gates: checkpoints, finish, shortcut signs
  { const cy = [], fin = [], dark = [], sign = [];
    const gate = (s, arr, hh) => { const w = arrAt(T.wid, s) + .8; ground(s, 0, GV); const y = GV.h, a = tpos(s, -w, {}), b = tpos(s, w, {}), m = tpos(s, 0, {});
      arr.push({ x: a.x, y: y + hh / 2, z: a.z, sx: .7, sy: hh, sz: .7, ry: -m.th }, { x: b.x, y: y + hh / 2, z: b.z, sx: .7, sy: hh, sz: .7, ry: -m.th }, { x: m.x, y: y + hh, z: m.z, sx: w * 2 + .7, sy: .9, sz: .7, ry: -m.th }); };
    for (let i = 1; i < T.cps.length; i++) gate(T.cps[i], cy, 8);
    gate(T.fin, fin, 10); gate(T.fin + 1.2, dark, 10.6); gate(26, fin, 9);
    for (const sh of T.shorts) if (!sh.hidden) { const s = sh.s0 + (sh.s1 - sh.s0) * .1, w = arrAt(T.wid, s), p = tpos(s, sh.side * (w + 2.4), {}); ground(s, sh.side * w, GV); sign.push({ x: p.x, y: GV.h + 3.4, z: p.z, sx: 1.1, sy: 2.4, sz: 1.1, rx: -PI / 2, ry: -p.th - sh.side * .5 }); dark.push({ x: p.x, y: GV.h + 1.2, z: p.z, sx: .2, sy: 3.4, sz: .2 }); }
    const arrows = [], posts = [];
    for (const p of T.pads) for (let q = -1; q <= 1; q++) { const a = tpos(p.s + q * 2.6, p.d, {}); ground(p.s + q * 2.6, p.d, GV); arrows.push({ x: a.x, y: GV.y + 1.5 + (q + 1) * .5, z: a.z, sx: 1.5, sy: 1.6, sz: .5, rx: -PI / 2, ry: -a.th }); }
    for (const k of T.kicks) for (const sd of [-1, 1]) { const a = tpos(k.s0 + k.len, k.d + sd * (k.hw + .5), {}); ground(k.s0 + k.len - .5, k.d, GV); posts.push({ x: a.x, y: GV.y + .6, z: a.z, sx: .22, sy: 2.4, sz: .22 }); }
    inst(new THREE.ConeGeometry(.6, 1, 3), MB(.5, 2.6, 1.1), arrows); inst(new THREE.BoxGeometry(1, 1, 1), MB(2.4, 1.5, .4), posts);
    inst(new THREE.BoxGeometry(1, 1, 1), MB(.4, 1.9, 2.2), cy); inst(new THREE.BoxGeometry(1, 1, 1), MB(2.4, 2.2, 2.0), fin);
    inst(new THREE.BoxGeometry(1, 1, 1), M(0x1a1626), dark); inst(new THREE.ConeGeometry(.6, 1, 4), MB(2.4, .5, 1.8), sign); }
}
function buildWorld(ci) {
  clearWorld(); if (window.MINE) MINE.reset(); if (COURSES[ci].mine) course = COURSES[ci]; else loadTrack(ci);
  const c = course, B = c.bend;
  BU.uBP.value.set(1 / B.R, B.twist, B.lift, B.R);
  uFogC.value.setRGB(c.fog[0], c.fog[1], c.fog[2]); uFogD.value = c.fogD; scene.fog.color.copy(uFogC.value); scene.fog.density = c.fogD;
  const U = skyMat.uniforms; U.uType.value = c.sky.type; U.cA.value.setRGB(...c.sky.cA); U.cB.value.setRGB(...c.sky.cB); U.cC.value.setRGB(...c.sky.cC); U.cD.value.setRGB(...c.sky.cD);
  terrMat.uniforms.uPat.value = c.far.veins ? 1 : c.far.river ? 2 : c.far.crests ? 3 : 0;
  uHLC.value.setRGB(...c.hl);
  hemi.color.setRGB(c.lightT[0] * .8 + .25, c.lightT[1] * .8 + .25, c.lightT[2] * .8 + .25); hemi.groundColor.setRGB(...c.shadowT);
  sunL.color.setRGB(...c.lightT); sunL.position.set(...c.sun);
  mComp.uniforms.uTint.value.setRGB(...c.hl);
  buildTerrain(); buildFar(); buildScenery();
}

// ============================================================ FX: particles, ground decals (streaks / hoofprints), light trails
const PMAX = 2400, FXP = {}, DMAX = 320, FXD = {};
function initFX() {
  const g = new THREE.BufferGeometry();
  FXP.pos = new Float32Array(PMAX * 3); FXP.col = new Float32Array(PMAX * 4); FXP.size = new Float32Array(PMAX);
  FXP.vel = new Float32Array(PMAX * 3); FXP.life = new Float32Array(PMAX); FXP.max = new Float32Array(PMAX); FXP.grav = new Float32Array(PMAX); FXP.s0 = new Float32Array(PMAX); FXP.n = 0;
  g.setAttribute('position', new THREE.BufferAttribute(FXP.pos, 3)); g.setAttribute('aCol', new THREE.BufferAttribute(FXP.col, 4)); g.setAttribute('aSize', new THREE.BufferAttribute(FXP.size, 1));
  FXP.mat = new THREE.ShaderMaterial({
    uniforms: { ...BU, uPS: { value: 500 }, uFogC, uFogD }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: BEND_GLSL + 'attribute vec4 aCol; attribute float aSize; varying vec4 vCol; void main(){ vec4 mv=viewMatrix*vec4(bendW(position),1.); gl_Position=projectionMatrix*mv; gl_PointSize=min(aSize*uPS/max(-mv.z,.2),220.); vCol=aCol; } '.replace('void main', 'uniform float uPS; void main'),
    fragmentShader: 'varying vec4 vCol; void main(){ float a=smoothstep(.5,.05,length(gl_PointCoord-.5)); gl_FragColor=vec4(vCol.rgb*a*vCol.a,1.); }'
  });
  FXP.pts = new THREE.Points(g, FXP.mat); FXP.pts.frustumCulled = false; FXP.pts.renderOrder = 20; scene.add(FXP.pts);
  // decals
  const pg = new THREE.PlaneGeometry(1, 1); pg.rotateX(-PI / 2);
  FXD.mat = new THREE.ShaderMaterial({
    uniforms: { ...BU }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: BEND_GLSL + 'varying vec2 vU; varying vec3 vIC; void main(){ vU=uv; vIC=instanceColor; vec4 wp=modelMatrix*instanceMatrix*vec4(position,1.); gl_Position=projectionMatrix*viewMatrix*vec4(bendW(wp.xyz),1.); }',
    fragmentShader: 'varying vec2 vU; varying vec3 vIC; void main(){ vec2 c=vU*2.-1.; float a=(1.-c.x*c.x)*(1.-c.y*c.y); gl_FragColor=vec4(vIC*a*a,1.); }'
  });
  FXD.mesh = new THREE.InstancedMesh(pg, FXD.mat, DMAX); FXD.mesh.frustumCulled = false; FXD.mesh.renderOrder = 10;
  FXD.life = new Float32Array(DMAX); FXD.max = new Float32Array(DMAX); FXD.c = new Float32Array(DMAX * 3); FXD.n = 0;
  _o3.position.set(0, -9999, 0); _o3.scale.set(0, 0, 0); _o3.updateMatrix(); _col.setRGB(0, 0, 0);
  for (let i = 0; i < DMAX; i++) { FXD.mesh.setMatrixAt(i, _o3.matrix); FXD.mesh.setColorAt(i, _col); }
  scene.add(FXD.mesh);
}
function spawnP(x, y, z, vx, vy, vz, life, size, r, g, b, grav = 0) {
  const i = FXP.n; FXP.n = (i + 1) % PMAX;
  FXP.pos[i * 3] = x; FXP.pos[i * 3 + 1] = y; FXP.pos[i * 3 + 2] = z; FXP.vel[i * 3] = vx; FXP.vel[i * 3 + 1] = vy; FXP.vel[i * 3 + 2] = vz;
  FXP.life[i] = FXP.max[i] = life; FXP.s0[i] = size; FXP.grav[i] = grav; FXP.col[i * 4] = r; FXP.col[i * 4 + 1] = g; FXP.col[i * 4 + 2] = b;
}
function burst(x, y, z, n, sp, life, size, c, grav = 6, up = .5) { for (let i = 0; i < n; i++) { const a = Math.random() * TAU, e = Math.random(), v = sp * (.3 + Math.random() * .7); spawnP(x, y, z, Math.cos(a) * v * (1 - e * up), v * e * 1.2 + sp * up * .4, Math.sin(a) * v * (1 - e * up), life * (.5 + Math.random() * .5), size * (.5 + Math.random()), c[0], c[1], c[2], grav); } }
function decal(x, y, z, yaw, slope, sx, sz, r, g, b, life) {
  const i = FXD.n; FXD.n = (i + 1) % DMAX;
  _o3.position.set(x, y + .07, z); _o3.rotation.set(Math.atan(slope), -yaw, 0, 'YXZ'); _o3.scale.set(sx, 1, sz); _o3.updateMatrix(); FXD.mesh.setMatrixAt(i, _o3.matrix);
  FXD.life[i] = FXD.max[i] = life; FXD.c[i * 3] = r; FXD.c[i * 3 + 1] = g; FXD.c[i * 3 + 2] = b; FXD.mesh.instanceMatrix.needsUpdate = true;
}
function clearFX() { FXP.life.fill(0); FXD.life.fill(0); }
function updateFX(dt) {
  const P = FXP;
  for (let i = 0; i < PMAX; i++) {
    if (P.life[i] <= 0) { P.size[i] = 0; continue; }
    P.life[i] -= dt; const k = i * 3;
    P.vel[k + 1] -= P.grav[i] * dt; P.pos[k] += P.vel[k] * dt; P.pos[k + 1] += P.vel[k + 1] * dt; P.pos[k + 2] += P.vel[k + 2] * dt;
    const t = Math.max(0, P.life[i] / P.max[i]); P.col[i * 4 + 3] = Math.min(1, t * 2.2) * Math.min(1, (1 - t) * 8 + .25); P.size[i] = P.s0[i] * (.6 + .4 * t);
  }
  const a = P.pts.geometry.attributes; a.position.needsUpdate = a.aCol.needsUpdate = a.aSize.needsUpdate = true;
  const D = FXD;
  for (let i = 0; i < DMAX; i++) { if (D.life[i] <= 0) continue; D.life[i] -= dt; const t = Math.max(0, D.life[i] / D.max[i]), f = Math.min(1, t * 1.6) * Math.min(1, (1 - t) * 6 + .1); _col.setRGB(D.c[i * 3] * f, D.c[i * 3 + 1] * f, D.c[i * 3 + 2] * f); D.mesh.setColorAt(i, _col); }
  D.mesh.instanceColor.needsUpdate = true;
}
class Trail {
  constructor(c) {
    this.N = 30; const n = this.N; this.pos = new Float32Array(n * 6); const al = new Float32Array(n * 2), idx = [];
    for (let i = 0; i < n; i++) { al[i * 2] = al[i * 2 + 1] = Math.pow(1 - i / (n - 1), 1.5); if (i < n - 1) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('aA', new THREE.BufferAttribute(al, 1)); g.setIndex(idx);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { ...BU, uCol: { value: new THREE.Color(c[0], c[1], c[2]) }, uI: { value: 1 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: BEND_GLSL + 'attribute float aA; varying float vA; void main(){ vA=aA; gl_Position=projectionMatrix*viewMatrix*vec4(bendW(position),1.); }',
      fragmentShader: 'uniform vec3 uCol; uniform float uI; varying float vA; void main(){ gl_FragColor=vec4(uCol*vA*uI,1.); }'
    });
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 12; scene.add(this.mesh); this.acc = 0;
  }
  reset(x, y, z) { for (let i = 0; i < this.N * 2; i++) { this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z; } }
  push(ax, ay, az, bx, by, bz, dt) {
    const p = this.pos; this.acc += dt;
    if (this.acc > .022) { this.acc = 0; p.copyWithin(6, 0, (this.N - 1) * 6); }
    p[0] = ax; p[1] = ay; p[2] = az; p[3] = bx; p[4] = by; p[5] = bz;
    this.mesh.geometry.attributes.position.needsUpdate = true;
  }
  dispose() { scene.remove(this.mesh); this.mesh.geometry.dispose(); this.mat.dispose(); }
}
