// Back-to-back 3D student figurines + contact glow, drawn on a transparent canvas over the sky. Lazy-loaded (imports three).
// The figures are lit like the sky behind them: low sun at their backs (warm rim), lavender sky from above,
// warm bounce from the clouds below and a soft fill from the viewer so the front still reads.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { FIGURES, LAYOUT, TOUCH_M } from './characters-config.js';

const FOV = 30, CAMZ = 8, HD = CAMZ * Math.tan(FOV * Math.PI / 360);

const GLOW_V = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }';
const GLOW_F = /* glsl */`
precision highp float;
varying vec2 vUv; uniform float uI, uTime; uniform vec3 uColor;
void main(){
  vec2 q = (vUv - .5)*2.; float r = length(q), a = atan(q.y, q.x);
  float core = exp(-r*r*18.) * .9;
  float halo = exp(-r*3.0) * .55;
  float rays = pow(abs(cos(a*7. + uTime*.3)), 22.)*exp(-r*2.2)*.9 + pow(abs(cos(a*4. - uTime*.2 + .6)), 40.)*exp(-r*1.6)*.8;
  float ring = smoothstep(.03, 0., abs(r - .42 - .03*sin(uTime*1.3))) * .3;
  float I = (core + halo + rays + ring) * smoothstep(1., .75, r) * uI;
  vec3 c = uColor * I;
  gl_FragColor = vec4(c, clamp(max(c.r, max(c.g, c.b)), 0., 1.));   // premultiplied
}`;
const SPK_V = /* glsl */`
attribute vec4 aSeed; uniform float uI, uTime, uPx, uScale;
varying float vA;
void main(){
  float ang = aSeed.x*6.2831 + uTime*(.1+aSeed.w*.2);
  float rad = (.15 + aSeed.y*1.15) * uScale * (.35 + .65*uI);
  vec3 p = position + vec3(cos(ang), sin(ang)*.8, 0.)*rad;
  float tw = .5 + .5*sin(uTime*(2.+aSeed.z*4.) + aSeed.w*30.);
  vA = uI * tw * (.4+.6*aSeed.z);
  vec4 mv = modelViewMatrix * vec4(p,1.);
  gl_PointSize = (6. + 18.*aSeed.z) * uPx * (.5 + uI);
  gl_Position = projectionMatrix * mv;
}`;
const SPK_F = /* glsl */`
precision highp float; varying float vA; uniform vec3 uColor;
void main(){
  vec2 q = gl_PointCoord - .5;
  float star = max(exp(-abs(q.x)*26.)*exp(-abs(q.y)*5.), exp(-abs(q.y)*26.)*exp(-abs(q.x)*5.)) + exp(-length(q)*9.)*.6;
  vec3 c = uColor * star * vA;
  gl_FragColor = vec4(c, clamp(max(c.r, max(c.g, c.b)), 0., 1.));
}`;

// ---- anime cel material, after the usual anime 3D recipe (Guilty Gear Xrd, Genshin-style toon shaders):
// two-tone cel shading with lavender shadows; face shaded with sphere normals so it never blotches; bangs cast a
// soft shadow on the forehead; a jagged highlight band on the hair; ink outlines (inverted hull) plus ink where
// hair locks meet; eyes, brows, mouth, blush and the OSIS badge are painted in the shader.
const FIG_V = /* glsl */`
uniform float uTime, uSway, uHairLen, uOutline; uniform vec2 uRes; uniform vec3 uHeadC;
varying vec3 vWN, vWP, vOP, vON, vSN; varying float vAO;
void main(){
  vec3 p = position;
#ifdef HAIR_SWAY
  float w = clamp(-p.y / uHairLen, 0., 1.); w *= w;
  p.x += (sin(uTime*1.15 + p.y*6.) * .55 + sin(uTime*.63 + 1.7) * .45) * .016 * w * uSway;
  p.z += sin(uTime*.82 + 1.3 + p.y*4.) * .010 * w * uSway;
#endif
#if defined(USE_COLOR_ALPHA) || defined(USE_COLOR)
  vAO = color.r;
#else
  vAO = 1.;
#endif
  vOP = p; vON = normal;
  vec4 wp = modelMatrix * vec4(p, 1.);
  vWP = wp.xyz;
  vWN = normalize(mat3(modelMatrix) * normal);
#ifdef FACE
  vSN = normalize(mat3(modelMatrix) * normalize(p - uHeadC));
#else
  vSN = vWN;
#endif
  vec4 clip = projectionMatrix * viewMatrix * wp;
#ifdef OUTLINE
  vec2 nc = (projectionMatrix * viewMatrix * vec4(vWN, 0.)).xy;
  clip.xy += normalize(nc + 1e-5) * uOutline * clip.w * 2. / uRes;
  clip.z += .003 * clip.w;                                   // tuck the hull behind nearby surfaces (no ink through cheeks)
#endif
  gl_Position = clip;
}`;
const FIG_F = /* glsl */`
uniform vec3 uAlbedo, uShade, uShadeSkin, uKey, uKeyDir, uSun, uSunDir, uSky, uLine, uIrisA, uIrisB, uBC, uBT, uBB;
uniform float uRim, uLight, uAlpha, uFade0, uFade1, uPitch, uHS, uAOk, uBang, uGirl, uSoft;
uniform vec2 uBS;
varying vec3 vWN, vWP, vOP, vON, vSN; varying float vAO;
float fill(float d, float aa){ return clamp(.5 - d / aa, 0., 1.); }   // d < 0 inside
float ell(vec2 p, vec2 r){ return (length(p / r) - 1.) * min(r.x, r.y); }
vec4 over(vec4 dst, vec3 c, float a){ return vec4(mix(dst.rgb, c, a), max(dst.a, a)); }
vec3 headDir(vec3 o){ vec3 b = vec3(o.x, -o.z, o.y); float a = -uPitch, c = cos(a), s = sin(a); return vec3(b.x, b.y*c - b.z*s, b.y*s + b.z*c); }
vec3 headPos(vec3 o){ return headDir(o) / uHS; }   // head units: x across, y back, z up (3d/build_figures.py)
// anime face: eyes, brows, mouth (rgb/a), blush (returned separately)
vec4 face(vec3 h, float facing, float facing2, float nd2y, out float blush){
  vec4 f = vec4(0.); blush = 0.;
  float front = smoothstep(-.03, -.055, h.y) * smoothstep(.15, .4, facing);
  float aa = .0006;
  vec2 q = vec2(abs(h.x), h.z);
  blush = front * smoothstep(1., .15, length((q - vec2(.044, .05)) / vec2(.016, .0085)));
  // eye: white, iris (dark top, warm bottom, darker rim), pupil, two highlights, heavy upper lash with a flick
  vec2 e = q - vec2(.031, .071);
  vec2 er = mix(vec2(.0158, .0162), vec2(.0166, .0176), uGirl);                     // her eyes: bigger and rounder
  float topY = mix(.0124, .0136, uGirl) - .0026 * (e.x / .016) * (e.x / .016) + mix(.0008, -.0009, uGirl) * e.x / .016;   // her outer corners droop: softer
  float white = max(ell(e, er), e.y - topY);
  f = over(f, vec3(.99, .97, .95), fill(white, aa));
  f = over(f, vec3(.84, .8, .9), fill(max(white, -(e.y - topY + .0022)), aa) * .6);    // lash shadow on the white
  vec2 ic = e - vec2(-.0012, -.0006);
  vec2 irr = mix(vec2(.0098, .0136), vec2(.0106, .0148), uGirl);
  float iris = max(ell(ic, irr), white);
  vec3 ir = mix(uIrisB, uIrisA, smoothstep(-.011, .007, ic.y));
  ir = mix(ir, uIrisA * .55, smoothstep(-.0025, 0., ell(ic, irr)) * .8);
  f = over(f, ir, fill(iris, aa));
  f = over(f, uIrisA * .45, fill(max(ell(ic - vec2(0., .001), vec2(.0036, .0058)), white), aa));
  f = over(f, mix(uIrisB, vec3(1.), .35), .7 * fill(max(ell(ic - vec2(.001, -.0075), vec2(.006, .0028)), iris), aa));   // glow in the lower iris
  f = over(f, vec3(1.), fill(ell(e - vec2(-.0045, .0048), vec2(.0032, .0034)), aa));
  f = over(f, vec3(1.), .85 * fill(ell(e - vec2(.0035, -.0068), vec2(.0016, .0016)), aa));
  float lash = max(abs(e.y - topY) - mix(.0022, .0018, uGirl), abs(e.x) - er.x - .002);
  float flick = max(abs(e.y - (topY - .0015 + (e.x - .016) * -.6)) - .0013 * (1. - (e.x - .015) / .008), max(.015 - e.x, e.x - .023));
  vec3 ink = vec3(.11, .065, .085);
  f = over(f, ink, fill(min(lash, flick), aa));
  f = over(f, ink * 1.6, .65 * fill(max(abs(e.y + .0135 - .0005 * e.x / .016) - .0006, abs(e.x - .006) - .008), aa));   // lower lash, outer half
  // brow: thin, tapering
  float bx = (q.x - .031) / .017;
  float brow = max(abs(q.y - (mix(.098, .1025, uGirl) + mix(.0032, .0052, uGirl) * (1. - bx * bx) - mix(.0, .0012, uGirl) * bx)) - mix(.0014, .0008, uGirl) * (1. - .7 * abs(bx)), abs(bx) - 1.);
  f = over(f, ink * 1.5, mix(.9, .6, uGirl) * fill(brow, aa));
  // nose: a small shadow tick on the side away from the light
  f = over(f, vec3(.62, .38, .36), .6 * fill(ell(vec2(h.x + .0035, h.z - .061), vec2(.0011, .0042)), aa));
  // mouth: a small soft smile, thicker in the middle; the girl gets a hint of a lower lip
  float mw = mix(.0042, .0048, uGirl), mx = h.x / mw;
  float mouth = max(abs(h.z - (.0275 + .0012 * mx * mx)) - (.0003 + .0008 * sqrt(max(1. - mx * mx, 0.))), abs(mx) - 1.);
  f = over(f, vec3(.36, .12, .13), .9 * fill(mouth, aa));
  f = over(f, vec3(.86, .46, .46), uGirl * .45 * fill(ell(vec2(h.x, h.z - .0252), vec2(.0024, .0008)), aa));
  f.a *= front;
  // ear: concha shadow and the curve inside the rim (seen from the side)
  vec2 eq = vec2(h.y - .016, h.z - .07);
  float side = smoothstep(.072, .08, abs(h.x)) * smoothstep(.45, .7, facing2) * smoothstep(.25, -.05, nd2y);   // the outer face of the ear only
  f = over(f, vec3(.86, .52, .5), .45 * side * fill(ell(eq - vec2(-.002, -.003), vec2(.0055, .009)), aa * 2.));
  float rimL = max(abs(ell(eq, vec2(.0105, .0165))) - .0007, -(eq.x + .002));
  f = over(f, vec3(.62, .32, .3), .8 * side * fill(rimL, aa));
  return f;
}
// OSIS badge (SMA version: brown tones) on a 2D patch, uv in -1..1
vec3 osis(vec2 uv, vec3 base){
  float aa = .03;
  vec3 khaki = vec3(.62, .42, .18), brown = vec3(.2, .1, .04), red = vec3(.78, .06, .05), cream = vec3(.95, .9, .78);
  vec3 c = mix(base, brown, fill(.86 - max(abs(uv.x), abs(uv.y)), aa));             // stitched brown border
  c = mix(c, khaki, fill(max(abs(uv.x), abs(uv.y)) - .8, aa));
  float r = length(uv - vec2(0., -.05));                                               // red and white arch
  float arch = max(max(.62 - r, r - .82), -uv.y - .05);
  c = mix(c, mix(cream, red, step(.72, r)), fill(arch, aa));
  vec2 fq = uv - vec2(0., .1); float th = atan(fq.x, fq.y);                           // five-petal star flower
  c = mix(c, brown, fill(length(fq) - .3 * (.72 + .28 * cos(5. * th)), aa));
  c = mix(c, khaki * 1.3, fill(length(fq) - .07, aa));
  c = mix(c, brown, fill(max(abs(uv.x) - .04, max(uv.y + .32, -uv.y - .2)), aa));   // stem
  vec2 hq = vec2(abs(uv.x), uv.y + .14);                                              // two open hands holding it
  c = mix(c, vec3(.42, .14, .08), fill(max(abs(hq.y - .5 * (hq.x - .12)) - .06, max(.08 - hq.x, hq.x - .3)), aa));
  vec2 sq = vec2(abs(uv.x) - .58, uv.y + .1);                                         // rice and cotton stalks
  c = mix(c, brown, fill(max(abs(sq.x + .04 * sin(sq.y * 9.)) - .05, abs(sq.y) - .42), aa));
  c = mix(c, cream, fill(max(abs(uv.x) - .34, abs(uv.y + .45 + .1 * abs(uv.x)) - .1), aa));   // open book
  c = mix(c, brown, fill(max(abs(uv.x) - .02, abs(uv.y + .45) - .1), aa));
  c = mix(c, vec3(.45, .25, .1), fill(max(abs(uv.x) - .7, abs(uv.y + .74) - .1), aa)); // ribbon
  return c;
}
void main(){
  vec3 n = normalize(vWN), v = normalize(cameraPosition - vWP);
  float a = uAlpha * smoothstep(uFade1, uFade0, vWP.y);
#ifdef OUTLINE
  vec3 lc = mix(uLine, uSun, uLight * .8);
  gl_FragColor = linearToOutputTexel(vec4(lc, 1.)) * vec4(vec3(a), a);
  return;
#endif
  vec3 alb = uAlbedo;
#ifdef BADGE
  vec3 bo = vOP - uBC;
  alb = osis(vec2(dot(bo, uBT) / uBS.x, dot(bo, uBB) / uBS.y), alb);
#endif
  vec3 ns = n;
#ifdef FACE
  ns = normalize(mix(n, normalize(vSN), .8 * smoothstep(-.005, .03, headPos(vOP).z)));   // sphere normals above the jaw: clean anime face shading
#endif
  float t = dot(ns, uKeyDir) * .5 + .5 - (1. - clamp(vAO, 0., 1.)) * uAOk;
  float lit = smoothstep(.45 - uSoft, .45 + uSoft, t);   // cloth gets a softer terminator
#ifdef FACE
  lit = smoothstep(.33, .37, t);                           // faces stay mostly lit
#endif
#if defined(FACE) || defined(HEADHAIR)
  vec3 h = headPos(vOP);
#endif
#ifdef FACE
  float bang = smoothstep(.0, .002, h.z - (uBang + .004 * cos(h.x * 150.))) * smoothstep(-.02, -.05, h.y);   // shadow of the bangs
  lit = min(lit, 1. - bang * .85);
#endif
  vec3 col = mix(alb * uShadeSkin, alb * uKey, lit);
  col *= mix(.86, 1., smoothstep(.12, .2, t + (.9 - uAOk)));                       // deep shadow band in creases
  col += alb * uSky * .12 * clamp(n.y, 0., 1.);
  float fres = 1. - clamp(dot(n, v), 0., 1.);
  float rim = smoothstep(.8, .84, fres) * smoothstep(-.05, .25, dot(n, uSunDir));
  col = mix(col, uSun * .9 + alb * .3, rim * uRim * .85);
#ifdef HAIR
  col *= mix(1., 1.18, smoothstep(.2, -.6, n.y));                                    // bounce light under the locks
  float crease = smoothstep(.3, .55, length(fwidth(n)));                           // ink where locks meet
  col = mix(col, uLine * 1.3, crease * .75);
#endif
#ifdef HEADHAIR
  float ang = atan(h.x, -(h.y - .012));
  float zc = .17 - .01 * abs(ang) / 3.1416 + .003 * sin(ang * 9.);                // a soft ring with a few gentle waves
  float hw = .0035 * (.55 + .45 * cos(ang * 4.5));
  float band = smoothstep(.001, .0, abs(h.z - zc) - hw) * smoothstep(.25, .5, dot(n, v));
  col = mix(col, alb * 2.6 + vec3(.1, .09, .16), band * (.28 + .3 * lit));
#elif defined(HAIR)
  vec3 nv = normalize((viewMatrix * vec4(n, 0.)).xyz);
  float ring = smoothstep(.36, .4, nv.y) * smoothstep(.5, .46, nv.y) * smoothstep(.3, .5, dot(n, v));
  col = mix(col, alb * 2.4 + vec3(.07, .06, .1), ring * .35 * (.4 + .6 * lit));
#endif
#ifdef FACE
  float blush;
  vec3 nd = headDir(normalize(vON));
  vec4 fc = face(h, -nd.y, nd.x * sign(h.x), nd.y, blush);
  col *= mix(vec3(1.), vec3(1.0, .72, .74), blush * .5);
  col = mix(col, fc.rgb * mix(.88, 1., lit), fc.a);
#endif
  col = mix(col, uSun * 1.15 + alb * .2, uLight * (.35 + .65 * fres));   // the flash floods them with light
  gl_FragColor = linearToOutputTexel(vec4(col, 1.)) * vec4(vec3(a), a);   // premultiplied
}`;

// per-material look (names come from 3d/build_figures.py): rim strength and ink colour of the outline
const LOOK = {
  shirt: { rim: 1, line: '#4a4468' }, pocket: { rim: 1, line: '#4a4468' }, skin: { rim: 0.9, line: '#7a3f3a' },
  hair: { rim: 0.8, line: '#120c1a' }, grey: { rim: 0.8, line: '#24243a' }, belt: { rim: 0.5, line: '#08080c' },
  nametag: { rim: 0.4, line: '#08080c' }, badge: { rim: 0.6, line: '#4a2e0c' }, bow: { rim: 1, line: '#4a4468' },
};

async function loadGLB(url, draco) {
  const loader = new GLTFLoader().setDRACOLoader(new DRACOLoader().setDecoderPath(draco));
  if (!url.endsWith('.txt')) return loader.loadAsync(url);
  const b64 = await (await fetch(url)).text();             // some hosts only serve text: base64-packed GLB
  const bin = atob(b64.trim()); const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return loader.parseAsync(buf.buffer, '');
}

export async function createHeroScene({ canvas, container, isMobile, sunHex = '#FFD6A8', glbUrl = FIGURES.url }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, premultipliedAlpha: true, powerPreference: 'low-power' });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NoToneMapping;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 50); camera.position.set(0, 0, CAMZ);
  const maxDpr = isMobile ? 1.5 : 1.75;

  const gltf = await loadGLB(glbUrl, FIGURES.draco);
  const lin = (hex, k = 1) => new THREE.Color(hex).multiplyScalar(k);
  const sunDir = new THREE.Vector3(0, 0.32, -1).normalize();          // the sun sits low, behind them: rim light
  const keyDir = new THREE.Vector3(-0.45, 0.62, 0.65).normalize();     // soft sky light from the front-left: the lit tone
  const shared = {
    uTime: { value: 0 }, uLight: { value: 0 }, uAlpha: { value: 1 }, uFade0: { value: -1 }, uFade1: { value: -2 },
    uSun: { value: lin(sunHex, 1.25) }, uSunDir: { value: sunDir }, uKeyDir: { value: keyDir },
    uKey: { value: lin('#fff3ea', 1.0) }, uShade: { value: lin('#b7a0d4') }, uSky: { value: lin('#8d89d8') },
    uOutline: { value: 1.5 }, uRes: { value: new THREE.Vector2(1, 1) },
  };
  const mats = new Map();
  // opts: hair (sways), outline, face / headHair (figure def: head-space painting), badge (patch frame)
  function figMat(src, { hair = false, face = null, headHair = null, badge = null, outline = false } = {}) {
    const fig = face || headHair || (badge && badge.def);
    const key = [src.name, hair ? 'sway' : '', face ? 'face' : '', headHair ? 'hh' : '', fig ? fig.id : '', outline ? 'line' : ''].join(':');
    if (mats.has(key)) return mats.get(key);
    const look = LOOK[src.name] || LOOK.shirt;
    const defines = {};
    if (hair) defines.HAIR_SWAY = 1;
    if (src.name === 'hair') defines.HAIR = 1;
    if (face) defines.FACE = 1;
    if (headHair) defines.HEADHAIR = 1;
    if (badge) defines.BADGE = 1;
    if (outline) defines.OUTLINE = 1;
    const hs = FIGURES.headScale, pitch = fig ? fig.pitch : 0;
    // head centre in head-mesh space (posed): Blender (0, .012, .10) * hs, pitched, then to three axes (x, z, -y)
    const by = 0.012 * hs, bz = 0.10 * hs, c = Math.cos(pitch), sn = Math.sin(pitch);
    const headC = new THREE.Vector3(0, by * sn + bz * c, -(by * c - bz * sn));
    const m = new THREE.ShaderMaterial({
      vertexShader: FIG_V, fragmentShader: FIG_F, vertexColors: true, defines, side: outline ? THREE.BackSide : THREE.FrontSide,
      uniforms: { ...shared, uAlbedo: { value: src.color.clone() }, uRim: { value: look.rim }, uAOk: { value: src.name === 'skin' ? (face ? 0.12 : 0.4) : (src.name === 'shirt' || src.name === 'pocket' ? 0.5 : 0.9) },
        uSoft: { value: src.name === 'shirt' || src.name === 'pocket' || src.name === 'grey' ? 0.05 : 0.02 },
        uLine: { value: lin(look.line) }, uShadeSkin: { value: src.name === 'skin' ? lin('#eab3ad') : lin('#b7a0d4') }, uSway: { value: 1 }, uHairLen: { value: 0.46 }, uPitch: { value: pitch }, uHS: { value: hs },
        uHeadC: { value: headC }, uBang: { value: fig ? fig.bang : 0.1 }, uGirl: { value: fig && fig.id === 'girl' ? 1 : 0 },
        uIrisA: { value: lin(fig ? fig.iris[0] : '#000') }, uIrisB: { value: lin(fig ? fig.iris[1] : '#000') },
        uBC: { value: badge ? badge.c : new THREE.Vector3() }, uBT: { value: badge ? badge.t : new THREE.Vector3(1, 0, 0) },
        uBB: { value: badge ? badge.b : new THREE.Vector3(0, 1, 0) }, uBS: { value: badge ? badge.s : new THREE.Vector2(1, 1) } },
    });
    mats.set(key, m); return m;
  }
  // frame of a flat patch (centre, across, up, half sizes) from its own vertices, in mesh space
  function patchFrame(geo) {
    const P = geo.attributes.position, N = geo.attributes.normal, c = new THREE.Vector3(), n = new THREE.Vector3(), v = new THREE.Vector3();
    for (let i = 0; i < P.count; i++) { c.add(v.fromBufferAttribute(P, i)); v.fromBufferAttribute(N, i); if (v.z > 0.2) n.add(v); }   // front faces only (the patch is a thin shell)
    c.divideScalar(P.count); n.normalize();
    const t = new THREE.Vector3(0, 1, 0).cross(n).normalize(), b = new THREE.Vector3().crossVectors(n, t);
    let sx = 0, sy = 0;
    for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i).sub(c); sx = Math.max(sx, Math.abs(v.dot(t))); sy = Math.max(sy, Math.abs(v.dot(b))); }
    return { c, t, b, s: new THREE.Vector2(sx, sy) };
  }

  const figs = [];
  for (const def of [FIGURES.boy, FIGURES.girl]) {
    const root = gltf.scene.getObjectByName(def.id);
    if (!root) throw new Error('figure missing: ' + def.id);
    const node = (n) => root.getObjectByName(`${def.id}_${n}`);
    const meshes = []; root.traverse((o) => { if (o.isMesh) meshes.push(o); });
    for (const o of meshes) {
      let p = o, hair = false, head = false;
      while (p && p !== root) { if (p.name === 'girl_hairlong') hair = true; if (p.name.startsWith(`${def.id}_headmesh`)) head = true; p = p.parent; }
      const src = o.material;
      const badge = src.name === 'badge' ? { def, ...patchFrame(o.geometry) } : null;
      o.material = figMat(src, { hair, badge, face: head && src.name === 'skin' ? def : null, headHair: head && src.name === 'hair' ? def : null });
      o.frustumCulled = false;
      const line = new THREE.Mesh(o.geometry, figMat(src, { hair, outline: true }));   // ink outline: inflated back faces
      line.frustumCulled = false; o.add(line);
    }
    const f = { def, root, body: node('body'), head: node('head'), tie: node('tie'), hairlong: node('hairlong'), bow: node('bow') };
    f.base = {};
    for (const k of ['body', 'head', 'tie', 'hairlong', 'bow']) if (f[k]) f.base[k] = { p: f[k].position.clone(), q: f[k].quaternion.clone() };
    // extents in the posed (yawed) frame: back = edge facing the other student, outer = the far edge
    root.position.set(0, 0, 0); root.rotation.set(0, def.yaw, 0); root.scale.setScalar(1); root.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(root, true);
    f.back = def.side < 0 ? bb.max.x : -bb.min.x;         // distance from the root to the back edge (m)
    f.outer = def.side < 0 ? -bb.min.x : bb.max.x;
    f.depth = (bb.max.z + bb.min.z) / 2;
    scene.add(root);
    figs.push(f);
  }

  const col = new THREE.Color(sunHex).convertLinearToSRGB();
  const gu = { uI: { value: 0 }, uTime: { value: 0 }, uColor: { value: new THREE.Vector3(col.r, col.g, col.b).multiplyScalar(1.1) } };
  const premult = { transparent: true, depthTest: false, depthWrite: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor };
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({ vertexShader: GLOW_V, fragmentShader: GLOW_F, uniforms: gu, ...premult }));
  glow.renderOrder = 13; glow.frustumCulled = false; glow.visible = false; scene.add(glow);

  const N = 70, pos = new Float32Array(N * 3), seed = new Float32Array(N * 4);
  let r = 99; const rnd = () => ((r = (r * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < N; i++) seed.set([rnd(), rnd(), rnd(), rnd()], i * 4);
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); sg.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  const su = { uI: gu.uI, uTime: gu.uTime, uPx: { value: 1 }, uScale: { value: 1 }, uColor: gu.uColor };
  const sparkles = new THREE.Points(sg, new THREE.ShaderMaterial({ vertexShader: SPK_V, fragmentShader: SPK_F, uniforms: su, ...premult }));
  sparkles.renderOrder = 14; sparkles.frustumCulled = false; sparkles.visible = false; scene.add(sparkles);

  const S = { W: 1, H: 1, A: 1, mobile: false, k: 1, g0: 2, footY: 0, contactY: 0, Wd: 1 };
  const yOf = (frac) => HD - frac * 2 * HD;                 // screen fraction from the top -> world y at z = 0

  function resize() {
    const rc = container.getBoundingClientRect(); S.W = Math.max(1, Math.round(rc.width)); S.H = Math.max(1, Math.round(rc.height)); S.A = S.W / S.H;
    const dpr = Math.min(devicePixelRatio || 1, maxDpr);
    renderer.setPixelRatio(dpr); renderer.setSize(S.W, S.H, false); camera.aspect = S.A; camera.updateProjectionMatrix(); su.uPx.value = dpr;
    S.mobile = S.A < 0.8; S.Wd = HD * S.A;
    const L = S.mobile ? LAYOUT.mobile : LAYOUT.desktop, boy = FIGURES.boy;
    const top = yOf(L.topFrac), waist = yOf(L.waistFrac);
    S.k = (top - waist) / (boy.height - boy.waist);
    S.footY = top - boy.height * S.k;
    const ext = Math.max(...figs.map((f) => f.back + f.outer)) * S.k;
    S.g0 = Math.max(2 * (L.edge * S.Wd - ext), 0.15 * S.Wd);
    S.contactY = S.footY + (boy.chest + FIGURES.girl.chest) / 2 * S.k;
    shared.uFade0.value = yOf(L.fade[0]); shared.uFade1.value = yOf(L.fade[1]);
    const pxPerM = S.H / (2 * HD) * S.k;
    shared.uOutline.value = Math.min(3, Math.max(1, 0.0026 * pxPerM)) * dpr;
    renderer.getDrawingBufferSize(shared.uRes.value);
  }

  const q = new THREE.Quaternion(), e = new THREE.Euler();
  // close: 0 (far apart) .. 1 (backs touching); light: 0..1 glow at the contact point
  function update(t, { close = 0, light = 0, alpha = 1 }) {
    const gap = S.g0 * (1 - close) + TOUCH_M * S.k * close;
    const near = close * close * (3 - 2 * close);
    const wind = 0.65 + 0.35 * Math.sin(t * 0.23) * Math.sin(t * 0.61 + 1);
    for (const f of figs) {
      const { def } = f, s = def.side, ph = def.ph, k = S.k;
      // stand: slow sway and, near the end, a lean back against each other
      f.root.scale.setScalar(k);
      e.set(-0.012 * near + 0.004 * Math.sin(t * 0.41 + ph), def.yaw + s * 0.02 * Math.sin(t * 0.31 + ph), 0.006 * Math.sin(t * 0.55 + ph), 'YXZ');
      f.root.quaternion.setFromEuler(e);
      f.root.position.set(s * (gap / 2 + f.back * k), S.footY, -f.depth * k * 0.2);
      // breathing: the chest lifts, everything above it follows
      const br = Math.sin(t * 1.45 + ph), sy = 1 + 0.0055 * br;
      f.body.scale.set(1 + 0.0025 * br, sy, 1 + 0.004 * br);
      for (const n of ['head', 'tie', 'hairlong']) if (f[n]) f[n].position.copy(f.base[n].p).setY(f.base[n].p.y * sy);
      // head: idle drift; as they meet they half-turn toward each other and relax the gaze
      const turn = -s * 0.34 * near, pitch = (s < 0 ? 0.11 : -0.07) * near;
      e.set(0.035 * Math.sin(t * 0.47 + ph) + pitch, 0.06 * Math.sin(t * 0.29 + ph * 1.7) + turn, 0.02 * Math.sin(t * 0.38 + ph), 'YXZ');
      f.head.quaternion.copy(f.base.head.q).multiply(q.setFromEuler(e));
      // tie and bow flutter in the breeze; long hair sways in the vertex shader
      if (f.tie) { e.set(0.05 * wind * Math.sin(t * 1.3 + ph), 0, 0.07 * wind * Math.sin(t * 1.7 + ph + 0.4)); f.tie.quaternion.copy(f.base.tie.q).multiply(q.setFromEuler(e)); }
      if (f.bow) { e.set(0.06 * Math.sin(t * 2.2), 0, 0.09 * wind * Math.sin(t * 2.7 + 0.5)); f.bow.quaternion.copy(f.base.bow.q).multiply(q.setFromEuler(e)); }
      f.root.visible = alpha > 0.003;
    }
    shared.uTime.value = t; shared.uLight.value = light * 0.85; shared.uAlpha.value = alpha;
    for (const m of mats.values()) if (m.defines.HAIR_SWAY) m.uniforms.uSway.value = wind;
    gu.uTime.value = t; gu.uI.value = light;
    glow.visible = sparkles.visible = light > 0.004;
    const size = (0.35 + 3.6 * Math.pow(light, 0.8)) * HD;
    glow.position.set(0, S.contactY, 1.2); glow.scale.setScalar(size);
    sparkles.position.set(0, S.contactY, 1.2); su.uScale.value = HD * 1.15;
  }
  function render() { renderer.render(scene, camera); }
  const tmp = new THREE.Vector3();
  const toPx = (v) => { v.project(camera); return { x: (v.x * 0.5 + 0.5) * S.W, y: (0.5 - v.y * 0.5) * S.H }; };
  // contact point on screen (px) for the flash overlay
  function contactPx() { return toPx(tmp.set(0, S.contactY, 0)); }
  // screen positions (px) of each student for the ribbons: chest centre, the back edge where they meet, half width, full height
  function bodiesPx() {
    const out = {};
    for (const f of figs) {
      const { def, root } = f, k = S.k;
      const cy = S.footY + def.chest * k;
      const chest = toPx(tmp.set(root.position.x - def.side * 0.02 * k, cy, root.position.z));
      const back = toPx(tmp.set(root.position.x - def.side * f.back * k, cy, root.position.z)).x;
      const outer = toPx(tmp.set(root.position.x + def.side * f.outer * k, cy, root.position.z)).x;
      const top = toPx(tmp.set(0, S.footY + def.height * k, 0)).y, foot = toPx(tmp.set(0, S.footY, 0)).y;
      out[def.id] = { chest, back, halfW: Math.abs(back - outer) / 2 * 0.8, height: Math.abs(foot - top) };
    }
    return out;
  }
  resize();
  const ro = new ResizeObserver(resize); ro.observe(container);
  return { update, render, resize, contactPx, bodiesPx, get state() { return S; }, camera, figures: figs,   // camera/figures: for src/figure-lab.html
    dispose() {
      ro.disconnect();
      scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
      for (const m of mats.values()) m.dispose();
      renderer.dispose(); renderer.forceContextLoss();
    } };
}
