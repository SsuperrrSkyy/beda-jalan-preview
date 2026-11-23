// Live 3D version of the procedural "mini town" diorama (see 3d/build_diorama.py).
// createDiorama({ canvas, url, reduced }) -> { dispose() }.  Resolves after the first frame is drawn.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

const D2R = Math.PI / 180;
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export async function createDiorama({ canvas, url, reduced = false }) {
  const params = new URL(location.href).searchParams;
  const frozen = params.has('t') ? parseFloat(params.get('t')) || 0 : null;
  const still = reduced || frozen !== null;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();

  // Camera: same view as the Blender render (30 deg elevation, 45 deg azimuth), orthographic.
  const el = 30 * D2R, az = 45 * D2R, DIST = 40;
  const camDir = new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 200);
  camera.position.copy(camDir).multiplyScalar(DIST);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const camRight = new THREE.Vector3(Math.cos(az), 0, -Math.sin(az));

  // Light: matches the Blender sun (warm key + cool sky fill).
  scene.add(new THREE.HemisphereLight(0xc8e0ff, 0xd6c9b4, 2.9));
  const sun = new THREE.DirectionalLight(0xfff2db, 3.2);
  sun.position.set(-0.417, 0.61, 0.674).multiplyScalar(22);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 60 });
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.04;
  sun.shadow.radius = 3;
  scene.add(sun);

  // Soft blob shadow under the island (radial gradient, no real shadow map).
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const cx = cv.getContext('2d');
  const g = cx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(20,24,34,0.30)');
  g.addColorStop(0.55, 'rgba(20,24,34,0.14)');
  g.addColorStop(1, 'rgba(20,24,34,0)');
  cx.fillStyle = g;
  cx.fillRect(0, 0, 256, 256);
  const blobTex = new THREE.CanvasTexture(cv);
  blobTex.colorSpace = THREE.SRGBColorSpace;
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = -3.4;
  blob.scale.set(10.5, 10.5, 1);
  blob.renderOrder = -1;
  scene.add(blob);

  // Model
  const draco = new DRACOLoader();
  draco.setDecoderPath(new URL('../../vendor/three/addons/libs/draco/gltf/', import.meta.url).href);
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);
  let gltf;
  try {
    gltf = await loader.loadAsync(url);
  } catch (e) {
    draco.dispose();
    renderer.dispose();
    throw e;
  }
  const island = new THREE.Group();
  island.add(gltf.scene);
  scene.add(island);
  const byName = (n) => gltf.scene.getObjectByName(n);
  const jib = byName('Crane_Jib'), hook = byName('Crane_Hook'), water = byName('Water'), ripples = byName('Ripples'), broom = byName('Broom');
  const chars = ['Char_Engineer', 'Char_Planner', 'Char_Resident', 'Char_Sweeper'].map(byName);
  gltf.scene.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = o.name !== 'Water' && o.name !== 'Ripples';
      o.receiveShadow = true;
    }
  });
  if (jib && hook) jib.attach(hook); // the hanging block follows the jib

  // water look + shimmer
  const waterMat = water?.material;
  if (waterMat) { waterMat.roughness = 0.3; }
  // drifting ripples: two identical copies, wrapped, clipped to the river length
  const RIP_L = 3.0;
  let rip2 = null, ripMats = [];
  if (ripples) {
    const clip = (mat, uOff) => {
      mat.onBeforeCompile = (sh) => {
        sh.uniforms.uOff = uOff;
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vRx;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvRx = position.x;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vRx;\nuniform float uOff;').replace('void main() {', 'void main() {\n if (abs(vRx + uOff) > 4.6) discard;');
      };
      mat.customProgramCacheKey = () => 'rip' + Math.random();
    };
    const u1 = { value: 0 }, u2 = { value: -RIP_L };
    ripples.material = ripples.material.clone();
    ripples.material.vertexColors = true;
    clip(ripples.material, u1);
    rip2 = ripples.clone();
    rip2.material = ripples.material.clone();
    clip(rip2.material, u2);
    ripples.parent.add(rip2);
    ripples.castShadow = rip2.castShadow = false;
    ripMats = [u1, u2];
  }

  // remember base transforms
  const base = new Map();
  [jib, hook, broom, ...chars].forEach((o) => o && base.set(o, { p: o.position.clone(), q: o.quaternion.clone(), s: o.scale.clone() }));
  const yawOf = (o) => o?.userData?.yaw ?? 0;

  // Fit the island in the frame (about 86% of the width) at rest orientation.
  gltf.scene.updateMatrixWorld(true);
  const inv = camera.matrixWorldInverse;
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
  const v = new THREE.Vector3();
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).applyMatrix4(inv);
      if (v.x < minX) minX = v.x; if (v.x > maxX) maxX = v.x;
      if (v.y < minY) minY = v.y; if (v.y > maxY) maxY = v.y;
    }
  });
  const bw = maxX - minX, bh = maxY - minY, bcx = (maxX + minX) / 2, bcy = (maxY + minY) / 2;

  function resize() {
    const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    const aspect = w / h;
    const halfH = Math.max(bw / 0.88 / aspect, bh / 0.9) / 2;
    camera.left = -halfH * aspect + bcx;
    camera.right = halfH * aspect + bcx;
    camera.top = halfH + bcy;
    camera.bottom = -halfH + bcy;
    camera.updateProjectionMatrix();
  }

  // ---- animation state
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  let scrollYaw = 0, scrollTarget = 0;
  const fine = window.matchMedia('(pointer: fine)').matches;
  const q = new THREE.Quaternion(), q2 = new THREE.Quaternion(), ax = new THREE.Vector3();

  function updateScrollTarget() {
    const r = canvas.getBoundingClientRect();
    const vh = window.innerHeight || 1;
    const p = clamp(1 - r.bottom / (vh + r.height), 0, 1);
    scrollTarget = (-12 + 24 * p) * D2R;
  }

  function pose(t, dt) {
    const k = still ? 1 : 1 - Math.exp(-dt * 5);
    pointer.x += (pointer.tx - pointer.x) * k;
    pointer.y += (pointer.ty - pointer.y) * k;
    scrollYaw += (scrollTarget - scrollYaw) * k;
    const bob = Math.sin((t / 6) * TAU) * 0.1;
    const sway = Math.sin((t / 14) * TAU) * 6 * D2R;
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), sway + scrollYaw + pointer.x * 10 * D2R);
    q2.setFromAxisAngle(camRight, pointer.y * 4 * D2R);
    island.quaternion.copy(q2).multiply(q);
    island.position.y = bob;
    const s = 10.5 * (1 - bob * 0.03);
    blob.scale.set(s, s, 1);
    blob.material.opacity = 1 - bob * 0.25;

    if (jib) jib.rotation.y = Math.sin((t / 10) * TAU) * 15 * D2R;
    if (hook) {
      const a = 4 * D2R;
      hook.rotation.x = Math.sin((t / 3.2) * TAU) * a;
      hook.rotation.z = Math.sin((t / 3.2) * TAU + 1.4) * a * 0.8;
    }
    chars.forEach((c, i) => {
      if (!c) return;
      const b = base.get(c);
      const ph = i * 1.3;
      const w = Math.sin((t / 1.7) * TAU + ph);
      c.scale.set(b.s.x * (1 - 0.012 * w), b.s.y * (1 + 0.025 * w), b.s.z * (1 - 0.012 * w));
      c.position.y = b.p.y + 0.012 * (w * 0.5 + 0.5);
      c.quaternion.copy(b.q);
    });
    // planner and resident nod towards each other (pitch about the body's right axis)
    const nod = (c, ph) => {
      if (!c) return;
      const yaw = yawOf(c);
      ax.set(Math.cos(yaw), 0, -Math.sin(yaw));
      const a = Math.max(0, Math.sin((t / 2.6) * TAU + ph)) * 5 * D2R;
      c.quaternion.setFromAxisAngle(ax, a);
    };
    nod(chars[1], 0);
    nod(chars[2], Math.PI * 0.55);
    if (broom) broom.rotation.y = Math.sin(t * 1.2 * TAU) * 20 * D2R;
    if (water?.material) {
      const sh = 0.97 + 0.03 * Math.sin((t / 3.5) * TAU);
      water.material.color.setScalar(sh);
    }
    if (ripMats.length) {
      const off = (t * 0.35) % RIP_L;
      ripples.position.x = off; ripMats[0].value = off;
      rip2.position.x = off - RIP_L; ripMats[1].value = off - RIP_L;
    }
  }

  let last = performance.now(), clock = 0;
  const tNow = (now) => (frozen !== null ? frozen : clock);
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    clock += dt;
    pose(tNow(now), dt);
    renderer.render(scene, camera);
  }

  // ---- loop control
  let raf = 0, visible = true, running = false;
  const loop = (now) => { raf = requestAnimationFrame(loop); frame(now); };
  function sync() {
    const want = !still && visible && !document.hidden;
    if (want && !running) { running = true; last = performance.now(); raf = requestAnimationFrame(loop); }
    else if (!want && running) { running = false; cancelAnimationFrame(raf); }
  }
  const io = new IntersectionObserver((e) => { visible = e[e.length - 1].isIntersecting; sync(); }, { threshold: 0 });
  io.observe(canvas);
  const onVis = () => sync();
  document.addEventListener('visibilitychange', onVis);
  const ro = new ResizeObserver(() => { resize(); if (!running) { pose(frozen ?? 0, 0); renderer.render(scene, camera); } });
  ro.observe(canvas);

  const onMove = (ev) => {
    if (still || !fine || ev.pointerType !== 'mouse') return;
    const r = canvas.getBoundingClientRect();
    const nx = ((ev.clientX - r.left) / r.width) * 2 - 1, ny = ((ev.clientY - r.top) / r.height) * 2 - 1;
    if (Math.abs(nx) <= 1.15 && Math.abs(ny) <= 1.15) { pointer.tx = clamp(nx, -1, 1); pointer.ty = clamp(ny, -1, 1); }
    else { pointer.tx = pointer.ty = 0; }
  };
  const onLeave = () => { pointer.tx = pointer.ty = 0; };
  const onScroll = () => updateScrollTarget();
  if (!still) {
    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeave);
    window.addEventListener('scroll', onScroll, { passive: true });
    updateScrollTarget();
    scrollYaw = scrollTarget;
  }

  resize();
  pose(frozen ?? 0, 1);
  renderer.render(scene, camera);
  sync();

  if (frozen !== null) {
    window.__diorama = { setT(t) { pose(t, 1); renderer.render(scene, camera); } };
  }

  return {
    dispose() {
      running = false;
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('scroll', onScroll);
      gltf.scene.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose?.(); } });
      blobTex.dispose();
      blob.geometry.dispose();
      blob.material.dispose();
      draco.dispose();
      renderer.dispose();
    },
  };
}
