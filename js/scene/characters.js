// A painted cut-out character as ONE textured plane (64x72 grid) with 2D bone skinning + flutter in the vertex shader.
// Unlit, alpha-eroded edge, depth-tested; one draw call. `?rig=1` shows bone weight regions and pivots.
import * as THREE from 'three';
import { deg } from './rigs.js?v=bcf57cddb0';

const NB = 10, NF = 6;
const VERT = /* glsl */`
attribute vec2 aPx;                       // rest pixel position (y down)
uniform vec2 uSize, uTipOff;              // image size, pivot (body centre) in px
uniform float uScale, uTime, uTrail;      // metres per pixel, wind/trail amount 0..1
uniform vec2 uP[${NB}], uA[${NB}], uB[${NB}], uC[${NB}], uRS[${NB}];   // pivot, capsule A-B-C, (radius, soft)
uniform vec2 uAng[${NB}];                  // (angle rad, stretch along A->C)
uniform vec4 uFA[${NF}], uFP[${NF}];       // flutter: (A.xy,B.xy), (radius, amp, freq, phase)
uniform vec2 uFD[${NF}];
uniform float uRig;
varying vec2 vUv;
varying vec3 vRig;

float segDist(vec2 p, vec2 a, vec2 b){ vec2 ab = b - a; float l = dot(ab,ab); float t = l > 1e-3 ? clamp(dot(p-a,ab)/l,0.0,1.0) : 0.0; return length(p - (a + ab*t)); }
vec2 rot(vec2 v, float a){ float c = cos(a), s = sin(a); return vec2(c*v.x - s*v.y, s*v.x + c*v.y); }
vec3 hue(float i){ return 0.5 + 0.5*cos(6.2831*(i*0.113 + vec3(0.0,0.33,0.67))); }

void main(){
  vec2 p0 = aPx, p = aPx;
  vec3 dbg = vec3(0.0);
  for(int i=0;i<${NB};i++){
    float d = min(segDist(p0, uA[i], uB[i]), segDist(p0, uB[i], uC[i]));
    float w = 1.0 - smoothstep(uRS[i].x, uRS[i].x + uRS[i].y, d);
    if(w <= 0.0) continue;
    vec2 ac = normalize(uC[i] - uA[i] + 1e-4);
    vec2 v = p - uP[i];
    v += ac * dot(v, ac) * uAng[i].y * w;                    // slight extension along the limb
    p = uP[i] + rot(v, uAng[i].x * w);
    dbg += hue(float(i)) * w;
  }
  for(int i=0;i<${NF};i++){
    if(uFP[i].y <= 0.0) continue;
    vec2 a = uFA[i].xy, b = uFA[i].zw, ab = b - a;
    float t = clamp(dot(p0 - a, ab) / max(dot(ab,ab), 1.0), 0.0, 1.0);
    float d = segDist(p0, a, b);
    float w = (1.0 - smoothstep(uFP[i].x, uFP[i].x*1.5, d)) * t * t;
    if(w <= 0.0) continue;
    float ph = uTime * uFP[i].z - t * 3.0 + uFP[i].w;
    vec2 dir = normalize(uFD[i]), perp = vec2(-dir.y, dir.x);
    p += (perp * sin(ph) * uFP[i].y + dir * uFP[i].y * (0.35 + 0.65 * uTrail) * (0.6 + 0.4*sin(ph*0.7 + 1.0))) * w;
    dbg += vec3(1.0, 0.9, 0.2) * w * 0.7;
  }
  vUv = vec2(aPx.x / uSize.x, 1.0 - aPx.y / uSize.y);
  vRig = dbg * uRig;
  vec2 m = (p - uTipOff) * uScale;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(m.x, -m.y, 0.0, 1.0);
}`;
const FRAG = /* glsl */`
precision highp float;
uniform sampler2D uMap;
uniform float uAlpha, uRig;
uniform vec3 uTint;
varying vec2 vUv;
varying vec3 vRig;
void main(){
  vec4 t = texture2D(uMap, vUv);
  float a = smoothstep(0.30, 0.78, t.a) * uAlpha;     // slightly eroded edge: no white halo from the cut-out
  if(a < 0.01) discard;
  vec3 c = t.rgb * uTint;
  c = mix(c, vRig, clamp(length(vRig), 0.0, 1.0) * 0.6 * step(0.5, uRig));
  gl_FragColor = vec4(c, a);
}`;

export function createCharacter(scene, rig, tex, { rigDebug = false } = {}) {
  const [W, H] = rig.size;
  const geo = new THREE.PlaneGeometry(1, 1, 64, 72);
  const uv = geo.attributes.uv, px = new Float32Array(uv.count * 2);
  for (let i = 0; i < uv.count; i++) { px[i * 2] = uv.getX(i) * W; px[i * 2 + 1] = (1 - uv.getY(i)) * H; }
  geo.setAttribute('aPx', new THREE.BufferAttribute(px, 2));
  geo.deleteAttribute('uv'); geo.deleteAttribute('normal');
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 4); geo.boundingBox = null;
  const v2 = (a) => new THREE.Vector2(...a);
  const bones = rig.bones, fl = rig.flutter;
  const pad = (arr, n, f) => Array.from({ length: n }, (_, i) => (arr[i] ? f(arr[i]) : null));
  const U = {
    uMap: { value: tex }, uAlpha: { value: 1 }, uTint: { value: new THREE.Vector3(0.96, 0.93, 0.89) }, uRig: { value: rigDebug ? 1 : 0 },
    uSize: { value: v2(rig.size) }, uTipOff: { value: new THREE.Vector2(rig.center[0], rig.center[1]) }, uScale: { value: 0.001 }, uTime: { value: 0 }, uTrail: { value: 0 },
    uP: { value: Array.from({ length: NB }, (_, i) => v2(bones[i] ? bones[i].pivot : [0, 0])) },
    uA: { value: Array.from({ length: NB }, (_, i) => v2(bones[i] ? bones[i].A : [0, 0])) },
    uB: { value: Array.from({ length: NB }, (_, i) => v2(bones[i] ? bones[i].B : [0, 0])) },
    uC: { value: Array.from({ length: NB }, (_, i) => v2(bones[i] ? bones[i].C : [0, 0])) },
    uRS: { value: Array.from({ length: NB }, (_, i) => v2(bones[i] ? [bones[i].r, bones[i].soft] : [-1, 1])) },
    uAng: { value: Array.from({ length: NB }, () => new THREE.Vector2(0, 0)) },
    uFA: { value: Array.from({ length: NF }, (_, i) => new THREE.Vector4(...(fl[i] ? [...fl[i].A, ...fl[i].B] : [0, 0, 0, 0]))) },
    uFP: { value: Array.from({ length: NF }, (_, i) => new THREE.Vector4(...(fl[i] ? [fl[i].r, fl[i].amp, fl[i].freq, fl[i].ph] : [0, 0, 0, 0]))) },
    uFD: { value: Array.from({ length: NF }, (_, i) => v2(fl[i] ? fl[i].dir : [1, 0])) },
  };
  const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: U, transparent: true, depthTest: true, depthWrite: true, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false; mesh.renderOrder = 5; mesh.name = 'Char_' + (rig.id || '');
  const group = new THREE.Group(); group.add(mesh); scene.add(group);

  let pivots = null;
  if (rigDebug) { // pivots as dots, placed in the same local space as the rest pose
    const g = new THREE.BufferGeometry(); const pts = [];
    for (const b of bones) pts.push((b.pivot[0] - rig.center[0]) * 0.001, -(b.pivot[1] - rig.center[1]) * 0.001, 0.01);
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    pivots = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 9, sizeAttenuation: false, depthTest: false }));
    pivots.renderOrder = 20; group.add(pivots);
  }

  return {
    group, mesh, uniforms: U, rig,
    // state: {reach 0..1, trail 0..1, t seconds, scale m/px}
    update(t, { reach = 0, trail = 0, scale }) {
      U.uTime.value = t; U.uTrail.value = trail;
      if (scale) { U.uScale.value = scale; if (pivots) pivots.scale.setScalar(scale / 0.001); }
      const swing = Math.sin(t * 1.3 + 1.0);
      for (let i = 0; i < bones.length; i++) {
        const b = bones[i];
        let a = Math.sin(t * (0.8 + 0.15 * i) + b.ph) * b.idle * deg;
        if (b.reach) a += b.reach * reach * deg;
        if (b.swing) a += swing * 3 * deg * reach + reach * 5 * deg * (rig.flies);   // free arm counter-swings while the other reaches
        U.uAng.value[i].set(a, b.breath ? b.breath * Math.sin(t * 1.7 + (b.ph || 0)) : (b.ext || 0) * reach);
      }
    },
    setAlpha(a) { U.uAlpha.value = a; mesh.visible = a > 0.003; },
    anchorLocal(scale, key = 'tip') { const a = rig[key] || rig.tip; return new THREE.Vector3((a[0] - rig.center[0]) * scale, -(a[1] - rig.center[1]) * scale, 0); },
    tipLocal(scale) { return new THREE.Vector3((rig.tip[0] - rig.center[0]) * scale, -(rig.tip[1] - rig.center[1]) * scale, 0); },
    dispose() { geo.dispose(); mat.dispose(); },
  };
}
