// Dust motes: a few hundred soft additive points. In the vertex shader each point is projected back along the sun
// direction onto each sunlit window plane and tested against that window's rect; it is only bright inside a shaft.
import * as THREE from 'three';
import { sunWindows } from './windows.js?v=bcf57cddb0';

const MAXW = 6;
const VERT = /* glsl */`
attribute vec4 aSeed;
uniform float uTime, uScale, uPx;
uniform vec3 uSunDir;
uniform vec3 uP0[${MAXW}], uN[${MAXW}], uR[${MAXW}], uU[${MAXW}];
uniform vec2 uHalf[${MAXW}];
uniform float uDn[${MAXW}];
varying float vA;
void main(){
  vec3 p = position;
  float t = uTime;
  p += vec3(sin(t*0.07 + aSeed.x*6.2831)*0.55 + sin(t*0.19 + aSeed.w*9.0)*0.06,
            sin(t*0.05 + aSeed.y*6.2831)*0.30,
            cos(t*0.06 + aSeed.z*6.2831)*0.55);
  float best = 0.0;
  for(int i=0;i<${MAXW};i++){
    if(uHalf[i].x <= 0.0) continue;
    float s = dot(p - uP0[i], uN[i]) / uDn[i];           // distance back along the sun ray to the window plane
    vec3 q = p - uSunDir * s - uP0[i];                    // where that ray crosses the plane, relative to the window centre
    vec2 W = vec2(dot(q, uR[i]), dot(q, uU[i]));
    float e = min(uHalf[i].x - abs(W.x), uHalf[i].y - abs(W.y));
    float inside = smoothstep(0.0, 0.07, e);
    float along = smoothstep(0.05, 0.8, s) * exp(-s*0.16);
    best = max(best, inside * along);
  }
  float fl = smoothstep(0.05, 0.9, p.y);
  float tw = 0.65 + 0.35*sin(t*(0.6+aSeed.w) + aSeed.x*40.0);
  vA = best * fl * tw;
  vec4 mv = viewMatrix * vec4(p,1.0);
  float size = mix(0.010, 0.026, aSeed.z);
  gl_PointSize = max(1.6*uPx, size * uScale / -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = /* glsl */`
precision mediump float;
varying float vA;
uniform vec3 uColor;
uniform float uFade;
void main(){
  float r = length(gl_PointCoord - 0.5) * 2.0;
  float a = smoothstep(1.0, 0.2, r);
  gl_FragColor = vec4(uColor * a * vA * 0.9 * uFade, 1.0);
}`;

export function createDust(scene, { windows, sun, count = 320, pixelRatio = 1 }) {
  const wins = sunWindows(windows, sun.direction).slice(0, MAXW);
  const d = new THREE.Vector3(...sun.direction).normalize();
  const arr = (f, fill) => Array.from({ length: MAXW }, (_, i) => (wins[i] ? f(wins[i]) : fill()));
  const pos = new Float32Array(count * 3), seed = new Float32Array(count * 4);
  let s = 12345; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); // deterministic
  for (let i = 0; i < count; i++) {
    const w = wins[i % Math.max(1, wins.length)];
    if (!w) break;
    const lx = (rnd() * 2 - 1) * w.hw, ly = (rnd() * 2 - 1) * w.hh;
    const base = w.center.clone().addScaledVector(w.r, lx).addScaledVector(w.u, ly);
    const tMax = Math.max(0.4, (base.y - 0.1) / -d.y * 0.95);
    const t = 0.2 + rnd() * (tMax - 0.2);
    base.addScaledVector(d, t);
    pos.set([base.x, base.y, base.z], i * 3);
    seed.set([rnd(), rnd(), rnd(), rnd()], i * 4);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  const c = new THREE.Color(sun.colorHex).convertLinearToSRGB();
  const v3 = () => new THREE.Vector3();
  const uniforms = {
    uTime: { value: 0 }, uScale: { value: 800 }, uPx: { value: pixelRatio }, uSunDir: { value: d },
    uP0: { value: arr((w) => w.center, v3) }, uN: { value: arr((w) => w.n, v3) }, uR: { value: arr((w) => w.r, v3) }, uU: { value: arr((w) => w.u, v3) },
    uHalf: { value: arr((w) => new THREE.Vector2(w.hw, w.hh), () => new THREE.Vector2(0, 0)) }, uDn: { value: arr((w) => w.dn, () => 1) },
    uColor: { value: new THREE.Vector3(c.r, c.g, c.b).multiplyScalar(1.15) }, uFade: { value: 1 },
  };
  const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms, transparent: true,
    blending: THREE.AdditiveBlending, depthTest: true, depthWrite: false });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false; pts.renderOrder = 11; pts.name = 'Dust';
  scene.add(pts);
  return {
    points: pts, uniforms,
    update(t) { uniforms.uTime.value = t; },
    setView(heightPx, fovDeg, pr) { uniforms.uScale.value = heightPx / (2 * Math.tan(fovDeg * Math.PI / 360)); uniforms.uPx.value = pr; },
    dispose() { geo.dispose(); mat.dispose(); scene.remove(pts); },
  };
}
