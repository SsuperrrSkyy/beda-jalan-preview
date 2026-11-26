// Volumetric-looking sun shafts: one beam volume per window, extruded along sun.direction down to the floor.
// Each pixel analytically finds the ray's entry into the (convex) volume, then integrates a few samples of a
// density made of crisp window-plane edges, louvre/mullion stripes and a slow shimmer. Additive, depthTest on, depthWrite off.
import * as THREE from 'three';
import { sunWindows } from './windows.js?v=bcf57cddb0';

const VERT = /* glsl */`
varying vec3 vWorld;
void main(){
  vec4 w = modelMatrix * vec4(position,1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const FRAG = /* glsl */`
precision highp float;
varying vec3 vWorld;
uniform vec3 uSunDir;      // direction the light travels
uniform vec3 uColor;
uniform vec3 uP0, uN, uR, uU;  // window centre, normal (into the room), right, up
uniform vec2 uHalf;            // half width / half height of the window
uniform float uDn;             // dot(sunDir, normal)
uniform float uTime;
uniform float uGain;
uniform float uFade;       // 0..1 master fade
const int STEPS = 14;

float hash(vec3 p){ p = fract(p*0.3183099+0.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float noise(vec3 x){
  vec3 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x), mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x), mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y), f.z);
}
float tOf(vec3 P){ return dot(P - uP0, uN) / uDn; }          // metres travelled from the window plane
vec2 loc(vec3 P){ vec3 q = P - uSunDir * tOf(P) - uP0; return vec2(dot(q, uR), dot(q, uU)); } // back-projected window coords
// linear function f_k(P) >= 0 describing the 6 faces of the volume
float face(int k, vec3 P){
  vec2 W = loc(P);
  if(k==0) return W.x + uHalf.x;
  if(k==1) return uHalf.x - W.x;
  if(k==2) return W.y + uHalf.y;
  if(k==3) return uHalf.y - W.y;
  if(k==4) return tOf(P);
  return P.y;
}
float density(vec3 P){
  float t = tOf(P);
  vec2 W = loc(P);
  float ex = uHalf.x - abs(W.x), ey = uHalf.y - abs(W.y);
  float pen = 0.022 + 0.010*t;                            // crisp edge, penumbra grows slowly with distance
  float edge = smoothstep(0.0, pen, min(ex,ey));
  float along = smoothstep(0.12, 1.1, t) * (1.0 - smoothstep(1.6, 4.9, t));
  float floorF = smoothstep(0.02, 1.0, P.y);
  float blades = 0.5 + 0.5*cos(6.2831853*W.y/0.115);     // nako louvre blades
  blades = smoothstep(0.15, 0.85, blades);
  float mull = 1.0 - 0.55*(1.0 - smoothstep(0.012, 0.045, abs(W.x))); // centre mullion
  float contrast = 0.55*exp(-t*0.28);
  float stripes = mix(1.0, 0.45 + 0.55*blades, contrast) * mull;
  float shim = 1.0 + 0.07*sin(uTime*0.55 + W.y*4.0 + W.x*2.3);
  float n = noise(vec3(W*2.1, t*0.9) + vec3(0.0, uTime*0.03, uTime*0.02));
  float body = mix(0.86, 1.12, n);
  return edge * along * floorF * stripes * shim * body;
}
void main(){
  vec3 O = cameraPosition;
  vec3 D = vWorld - O;
  float sExit = length(D);
  D /= sExit;
  float sEnter = 0.0;
  for(int k=0;k<6;k++){
    float a = face(k, O);
    float b = face(k, O + D) - a;
    float s = -a / (abs(b) < 1e-6 ? 1e-6 : b);
    if(b > 0.0) sEnter = max(sEnter, s);
    else sExit = min(sExit, s);
  }
  if(sEnter >= sExit) discard;
  float ds = (sExit - sEnter) / float(STEPS);
  float acc = 0.0;
  float jitter = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898,78.233))) * 43758.5453);
  for(int i=0;i<STEPS;i++){
    float s = sEnter + (float(i) + 0.15 + 0.7*jitter) * ds;
    acc += density(O + D*s) * ds;
  }
  float phase = 1.0 - 0.62 * smoothstep(0.72, 0.96, dot(D, -uSunDir)); // tame the glare when looking straight down a beam
  float I = acc * uGain * uFade * phase;
  gl_FragColor = vec4(uColor * I, 1.0);
}`;

export function createShafts(scene, { windows, sun, gain = 0.2 }) {
  const group = new THREE.Group();
  group.name = 'Shafts';
  const color = new THREE.Color(sun.colorHex).convertLinearToSRGB(); // shader works in display space
  const col = new THREE.Vector3(color.r, color.g, color.b);
  const uniforms = { uTime: { value: 0 }, uFade: { value: 1 } };
  const mats = [];
  for (const w of sunWindows(windows, sun.direction)) {
    const d = w.d;
    const far = w.c.map((p) => p.clone().addScaledVector(d, p.y / -d.y)); // along d until y = 0
    const V = [...w.c, ...far]; // 0..3 window, 4..7 floor
    const q = [[0,1,2,3],[7,6,5,4],[0,4,5,1],[3,2,6,7],[0,3,7,4],[1,5,6,2]];
    const pos = [];
    for (const f of q) for (const i of [0,1,2,0,2,3]) pos.push(V[f[i]].x, V[f[i]].y, V[f[i]].z);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.computeBoundingSphere();
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG,
      uniforms: {
        uSunDir: { value: d.clone() }, uColor: { value: col.clone() }, uP0: { value: w.center }, uN: { value: w.n }, uR: { value: w.r },
        uU: { value: w.u }, uHalf: { value: new THREE.Vector2(w.hw, w.hh) }, uDn: { value: w.dn },
        uGain: { value: gain }, uTime: uniforms.uTime, uFade: uniforms.uFade,
      },
      side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending,
      depthTest: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false; mesh.renderOrder = 10; mesh.name = 'Shaft_' + w.name;
    group.add(mesh); mats.push(mat);
  }
  scene.add(group);
  return {
    group, uniforms, count: mats.length,
    update(t) { uniforms.uTime.value = t; },
    setGainScale(k) { for (const m of mats) m.uniforms.uGain.value = gain * k; },
    setFade(v) { uniforms.uFade.value = v; },
    dispose() { group.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); scene.remove(group); },
  };
}
