// Warm additive spark with rays: a camera-facing sprite, sun colour. Intensity 0..1 grows at the meeting point.
import * as THREE from 'three';

const FRAG = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform float uI, uTime;
uniform vec3 uColor;
void main(){
  vec2 q = (vUv - 0.5) * 2.0;
  float r = length(q), a = atan(q.y, q.x);
  float core = exp(-r*r*22.0) * 0.55;
  float halo = exp(-r*3.2) * 0.35;
  float rays = pow(abs(cos(a*6.0 + uTime*0.25)), 18.0) * exp(-r*2.4) * 0.9
             + pow(abs(cos(a*3.0 - uTime*0.15 + 0.7)), 40.0) * exp(-r*1.8) * 0.7;
  float ring = smoothstep(0.03, 0.0, abs(r - 0.38 - 0.02*sin(uTime*1.2))) * 0.25;
  float I = (core + halo*0.8 + rays*0.8 + ring) * smoothstep(1.0, 0.82, r) * uI;
  gl_FragColor = vec4(uColor * I, 1.0);
}`;
const VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;

export function createSpark(scene, { colorHex }) {
  const c = new THREE.Color(colorHex).convertLinearToSRGB();
  const U = { uI: { value: 0 }, uTime: { value: 0 }, uColor: { value: new THREE.Vector3(c.r, c.g, c.b).multiplyScalar(1.05) } };
  const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: U, transparent: true,
    blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
  mesh.renderOrder = 13; mesh.frustumCulled = false; mesh.visible = false;
  scene.add(mesh);
  return {
    mesh, uniforms: U,
    update(t, camera, pos, size, intensity) {
      U.uTime.value = t; U.uI.value = intensity; mesh.visible = intensity > 0.002;
      mesh.position.copy(pos); mesh.quaternion.copy(camera.quaternion); mesh.scale.setScalar(size);
    },
    dispose() { mesh.geometry.dispose(); mat.dispose(); scene.remove(mesh); },
  };
}
