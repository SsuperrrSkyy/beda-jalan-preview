// Back-to-back characters + contact glow, drawn on a transparent canvas over the sky. Lazy-loaded (imports three).
import * as THREE from 'three';
import { createCharacter } from '../scene/characters.js';
import { CHARACTERS, LAYOUT, TOUCH_PX } from './characters-config.js';

const FOV = 30, CAMZ = 8, HD = CAMZ * Math.tan(FOV * Math.PI / 360);
const DEG = Math.PI / 180;

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

export async function createHeroScene({ canvas, container, isMobile, rigDebug = false, sunHex = '#FFD6A8' }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, premultipliedAlpha: true, powerPreference: 'low-power' });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NoToneMapping;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 50); camera.position.set(0, 0, CAMZ);
  const maxDpr = isMobile ? 1.5 : 1.75;

  const loader = new THREE.TextureLoader();
  const load = (url) => new Promise((res, rej) => loader.load(url, (t) => { t.colorSpace = THREE.NoColorSpace; t.anisotropy = 4; res(t); }, undefined, rej));
  const defs = Object.values(CHARACTERS);
  const texs = await Promise.all(defs.map((d) => load(d.url)));
  const chars = defs.map((d, i) => ({ def: d, ch: createCharacter(scene, d, texs[i], { rigDebug }) }));

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

  const S = { W: 1, H: 1, A: 1, mobile: false, s: 0.001, g0: 2, contactY: 0, Wd: 1, alpha: 1 };
  const qr = new THREE.Quaternion(), qy = new THREE.Quaternion(), qa = new THREE.Quaternion(), zA = new THREE.Vector3(0, 0, 1), yA = new THREE.Vector3(0, 1, 0);

  function resize() {
    const rc = container.getBoundingClientRect(); S.W = Math.max(1, Math.round(rc.width)); S.H = Math.max(1, Math.round(rc.height)); S.A = S.W / S.H;
    const dpr = Math.min(devicePixelRatio || 1, maxDpr);
    renderer.setPixelRatio(dpr); renderer.setSize(S.W, S.H, false); camera.aspect = S.A; camera.updateProjectionMatrix(); su.uPx.value = dpr;
    S.mobile = S.A < 0.8; S.Wd = HD * S.A;
    const L = S.mobile ? LAYOUT.mobile : LAYOUT.desktop, boy = CHARACTERS.boy, girl = CHARACTERS.girl;
    S.s = L.heightFrac * 2 * HD / (boy.foot[1] - boy.top);
    const ext = Math.max(boy.contact[0] - boy.left, girl.right - girl.contact[0]) * S.s;
    S.g0 = Math.max(2 * (L.edge * S.Wd - ext), (L.minGap || 0.5) * S.Wd);
    S.footY = L.footY * HD;
    S.contactY = S.footY + (boy.foot[1] - boy.contact[1]) * S.s;     // chest height: where the light starts
  }

  // close: 0 (far apart) .. 1 (backs touching); light: 0..1 glow at the contact point
  function update(t, { close = 0, light = 0, alpha = 1 }) {
    const gap = S.g0 * (1 - close) + TOUCH_PX * S.s * close;
    for (const { def, ch } of chars) {
      const side = def.side, s = S.s;
      qy.setFromAxisAngle(yA, side * 0.06); qa.copy(qy);
      const ac = ch.anchorLocal(s, 'contact').applyQuaternion(qa), af = ch.anchorLocal(s, 'foot').applyQuaternion(qa);
      ch.group.quaternion.copy(qa);
      ch.group.position.set(side * gap / 2 - ac.x, S.footY - af.y, side * 0.05);   // x from the contact point, y from the shared sole baseline
      ch.group.visible = alpha > 0.003;
      ch.update(t, { reach: 0, trail: 0.2 + 0.1 * Math.sin(t * 0.5 + side * 2), scale: s });
      ch.setAlpha(alpha);
    }
    gu.uTime.value = t; gu.uI.value = light;
    glow.visible = sparkles.visible = light > 0.004;
    const size = (0.35 + 3.6 * Math.pow(light, 0.8)) * HD;
    glow.position.set(0, S.contactY, 0.6); glow.scale.setScalar(size);
    sparkles.position.set(0, S.contactY, 0.6); su.uScale.value = HD * 1.15;
  }
  function render() { renderer.render(scene, camera); }
  // contact point on screen (px) for the flash overlay
  function contactPx() { const v = new THREE.Vector3(0, S.contactY, 0).project(camera); return { x: (v.x * 0.5 + 0.5) * S.W, y: (0.5 - v.y * 0.5) * S.H }; }
  resize();
  const ro = new ResizeObserver(resize); ro.observe(container);
  return { update, render, resize, contactPx, get state() { return S; },
    dispose() { ro.disconnect(); chars.forEach((c) => c.ch.dispose()); renderer.dispose(); renderer.forceContextLoss(); } };
}
