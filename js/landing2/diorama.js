// Live 3D "mini town" dioramas (built by 3d/build_diorama.py).
//   const d = await createDiorama({ canvas, reduced, url? });
//   await d.show(url);       // load (cached) and switch scene: old island sinks/fades, new one rises
//   d.highlight('st'|'sh'|null);   // pin + ring on every character with that role (userData.role)
//   d.dispose();
// Moving parts are found by node-name prefix: Char_ Swing_ Sway_ Spin_ Float_ Wave_ (+ Water, Ripples).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

const D2R = Math.PI / 180;
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const ROLE_COLOR = { st: 0x2fb8c0, sh: 0xf5b14a };
const OUT_S = 0.35, IN_S = 0.45, SINK = 1.3;

export async function createDiorama({ canvas, reduced = false, url = null }) {
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
  const el = 30 * D2R, az = 45 * D2R, DIST = 40;
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 200);
  camera.position.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).multiplyScalar(DIST);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const camRight = new THREE.Vector3(Math.cos(az), 0, -Math.sin(az));
  const UP = new THREE.Vector3(0, 1, 0);

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

  // soft blob shadow
  const radial = (stops) => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 256;
    const cx = cv.getContext('2d');
    const g = cx.createRadialGradient(128, 128, 0, 128, 128, 128);
    stops.forEach(([o, c]) => g.addColorStop(o, c));
    cx.fillStyle = g;
    cx.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const blobTex = radial([[0, 'rgba(20,24,34,0.30)'], [0.55, 'rgba(20,24,34,0.14)'], [1, 'rgba(20,24,34,0)']]);
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = -3.4;
  blob.scale.set(10.5, 10.5, 1);
  blob.renderOrder = -1;
  scene.add(blob);

  // shared marker resources (soft ring texture, pin geometry)
  const ringTex = radial([[0, 'rgba(255,255,255,0)'], [0.45, 'rgba(255,255,255,0)'], [0.62, 'rgba(255,255,255,0.85)'], [0.8, 'rgba(255,255,255,0.35)'], [1, 'rgba(255,255,255,0)']]);
  const ringGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const coneGeo = new THREE.ConeGeometry(0.17, 0.4, 20).rotateX(Math.PI).translate(0, 0.2, 0);
  const ballGeo = new THREE.SphereGeometry(0.17, 20, 14).translate(0, 0.52, 0);
  const dotGeo = new THREE.SphereGeometry(0.065, 12, 8).translate(0, 0.52, 0.13);

  const island = new THREE.Group(); // posed group (float, sway, tilt)
  scene.add(island);

  const draco = new DRACOLoader();
  draco.setDecoderPath(new URL('../../vendor/three/addons/libs/draco/gltf/', import.meta.url).href);
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);
  const cache = new Map(); // url -> Promise<entry>

  // ---------------------------------------------------------------- scene entries
  function prepare(gltf) {
    const root = gltf.scene;
    const e = { root, chars: [], swings: [], sways: [], spins: [], floats: [], waves: [], water: null, ripples: null, rip2: null, ripU: [], mats: new Set(), base: new Map(), markers: [], fit: null };
    root.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = o.name !== 'Water' && o.name !== 'Ripples';
        o.receiveShadow = true;
      }
      const n = o.name || '';
      if (n.startsWith('Char_')) e.chars.push(o);
      else if (n.startsWith('Swing_')) e.swings.push(o);
      else if (n.startsWith('Sway_')) e.sways.push(o);
      else if (n.startsWith('Spin_')) e.spins.push(o);
      else if (n.startsWith('Float_')) e.floats.push(o);
      else if (n.startsWith('Wave_')) e.waves.push(o);
      else if (n === 'Water') e.water = o;
      else if (n === 'Ripples') e.ripples = o;
    });
    if (e.water?.material) e.water.material.roughness = 0.3;
    if (e.ripples) {
      const clip = (mat, uOff) => {
        mat.onBeforeCompile = (sh) => {
          sh.uniforms.uOff = uOff;
          sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vRx;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvRx = position.x;');
          sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vRx;\nuniform float uOff;').replace('void main() {', 'void main() {\n if (abs(vRx + uOff) > 4.6) discard;');
        };
        mat.customProgramCacheKey = () => 'rip' + uOff.id;
      };
      const u1 = { value: 0, id: 1 }, u2 = { value: -3, id: 2 };
      e.ripples.material = e.ripples.material.clone();
      clip(e.ripples.material, u1);
      e.rip2 = e.ripples.clone();
      e.rip2.material = e.ripples.material.clone();
      clip(e.rip2.material, u2);
      e.ripples.parent.add(e.rip2);
      e.ripU = [u1, u2];
    }
    root.traverse((o) => { if (o.isMesh) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => e.mats.add(m)); });
    [...e.chars, ...e.swings, ...e.sways, ...e.spins, ...e.floats, ...e.waves].forEach((o) => e.base.set(o, { p: o.position.clone(), q: o.quaternion.clone(), s: o.scale.clone() }));

    // markers (pin + ring) for characters that carry a role
    e.chars.forEach((c, i) => {
      const role = c.userData.role;
      if (!ROLE_COLOR[role]) return;
      let top = 1.8, ext = 0.7;
      if (c.geometry) { c.geometry.computeBoundingBox(); top = c.geometry.boundingBox.max.y; const b = c.geometry.boundingBox; ext = Math.max(b.max.x - b.min.x, b.max.z - b.min.z) * 0.62; }
      const g = new THREE.Group();
      const col = ROLE_COLOR[role];
      const pm = new THREE.MeshBasicMaterial({ color: col, transparent: true });
      const pin = new THREE.Group();
      pin.add(new THREE.Mesh(coneGeo, pm), new THREE.Mesh(ballGeo, pm), new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true })));
      pin.userData.mats = pin.children.map((m) => m.material);
      const rm = new THREE.MeshBasicMaterial({ color: col, map: ringTex, transparent: true, depthWrite: false });
      const ring = new THREE.Mesh(ringGeo, rm);
      ring.scale.set(ext * 2.4, 1, ext * 2.4);
      ring.renderOrder = 2;
      g.add(pin, ring);
      g.visible = false;
      root.add(g);
      e.markers.push({ c, g, pin, ring, rm, ext: ext * 3.0, v: 0, top: top + 0.3, phase: i * 1.7, role });
    });

    // fit box in camera space (rest pose)
    root.updateMatrixWorld(true);
    const inv = camera.matrixWorldInverse, v = new THREE.Vector3();
    let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    root.traverse((o) => {
      if (!o.isMesh || e.markers.some((m) => m.g === o.parent || m.pin === o.parent)) return;
      const pos = o.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).applyMatrix4(inv);
        if (v.x < minX) minX = v.x; if (v.x > maxX) maxX = v.x;
        if (v.y < minY) minY = v.y; if (v.y > maxY) maxY = v.y;
      }
    });
    e.fit = { bw: maxX - minX, bh: maxY - minY, cx: (maxX + minX) / 2, cy: (maxY + minY) / 2 };
    return e;
  }

  function load(u) {
    if (!cache.has(u)) cache.set(u, loader.loadAsync(u).then(prepare).catch((err) => { cache.delete(u); throw err; }));
    return cache.get(u);
  }

  function setOpacity(e, a) {
    e.mats.forEach((m) => { m.transparent = a < 0.999; m.opacity = a; });
  }

  // ---------------------------------------------------------------- state
  let cur = null;           // entry on stage
  let trOff = 0;            // vertical sink offset during transitions
  let trAlpha = 1;
  let tr = null;            // { phase: 'out'|'in', t, next }
  let wantUrl = null;
  let hlRole = null;
  let fitFor = null;

  function applyFit(e) {
    fitFor = e;
    resize();
  }

  function mount(e) {
    if (cur) island.remove(cur.root);
    cur = e;
    island.add(e.root);
    applyFit(e);
  }

  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  let scrollYaw = 0, scrollTarget = 0;
  const fine = window.matchMedia('(pointer: fine)').matches;
  const q = new THREE.Quaternion(), q2 = new THREE.Quaternion(), ax = new THREE.Vector3();

  function updateScrollTarget() {
    const r = canvas.getBoundingClientRect();
    const p = clamp(1 - r.bottom / ((window.innerHeight || 1) + r.height), 0, 1);
    scrollTarget = (-12 + 24 * p) * D2R;
  }

  function animate(e, t, dt) {
    e.chars.forEach((c, i) => {
      const b = e.base.get(c);
      const w = Math.sin((t / 1.7) * TAU + i * 1.3);
      c.scale.set(b.s.x * (1 - 0.012 * w), b.s.y * (1 + 0.025 * w), b.s.z * (1 - 0.012 * w));
      c.position.y = b.p.y + 0.012 * (w * 0.5 + 0.5);
      if (c.userData.nod) {
        const yaw = c.userData.yaw || 0;
        ax.set(Math.cos(yaw), 0, -Math.sin(yaw));
        c.quaternion.setFromAxisAngle(ax, Math.max(0, Math.sin((t / 2.6) * TAU + i * 1.9)) * 5 * D2R);
      } else c.quaternion.copy(b.q);
    });
    e.sways.forEach((o, i) => { o.rotation.y = Math.sin((t / 10) * TAU + i) * 15 * D2R; });
    e.swings.forEach((o, i) => {
      const a = 4 * D2R;
      o.rotation.x = Math.sin((t / 3.2) * TAU + i) * a;
      o.rotation.z = Math.sin((t / 3.2) * TAU + 1.4 + i) * a * 0.8;
    });
    e.spins.forEach((o, i) => { o.rotation.y = t * (0.9 + 0.2 * i); });
    e.floats.forEach((o, i) => {
      const b = e.base.get(o);
      o.position.y = b.p.y + 0.09 * Math.sin((t / 2.4) * TAU + i * 1.7);
      o.rotation.y = Math.sin((t / 5) * TAU + i) * 4 * D2R;
    });
    e.waves.forEach((o, i) => {
      const mega = /Mega/i.test(o.name);
      o.rotation.y = Math.sin(t * (mega ? 0.8 : 1.2) * TAU + i) * (mega ? 9 : 20) * D2R;
    });
    if (e.water?.material) e.water.material.color.setScalar(0.97 + 0.03 * Math.sin((t / 3.5) * TAU));
    if (e.ripU.length) {
      const off = (t * 0.35) % 3;
      e.ripples.position.x = off; e.ripU[0].value = off;
      e.rip2.position.x = off - 3; e.ripU[1].value = off - 3;
    }
    // highlight markers
    e.markers.forEach((m) => {
      const target = m.role === hlRole ? 1 : 0;
      m.v += clamp(target - m.v, -dt * 4, dt * 4);
      m.g.visible = m.v > 0.003;
      if (!m.g.visible) return;
      const v = m.v, c = m.c;
      m.g.position.set(c.position.x, c.position.y, c.position.z);
      m.pin.position.y = m.top + 0.12 * Math.sin(t * 3 + m.phase) + (1 - v) * 0.4;
      m.pin.scale.setScalar(1.5 * (0.3 + 0.7 * v));
      m.pin.userData.mats.forEach((mm) => { mm.opacity = v; });
      m.ring.position.y = 0.04;
      m.rm.opacity = v * (0.75 + 0.2 * Math.sin(t * 3 + m.phase));
      const s = (1.0 + 0.06 * Math.sin(t * 3 + m.phase)) * (0.85 + 0.15 * v);
      m.ring.scale.set(m.ext * s, 1, m.ext * s);
    });
  }

  function pose(t, dt) {
    const k = still ? 1 : 1 - Math.exp(-dt * 5);
    pointer.x += (pointer.tx - pointer.x) * k;
    pointer.y += (pointer.ty - pointer.y) * k;
    scrollYaw += (scrollTarget - scrollYaw) * k;
    const bob = Math.sin((t / 6) * TAU) * 0.1;
    const sway = Math.sin((t / 14) * TAU) * 6 * D2R;
    q.setFromAxisAngle(UP, sway + scrollYaw + pointer.x * 10 * D2R);
    q2.setFromAxisAngle(camRight, pointer.y * 4 * D2R);
    island.quaternion.copy(q2).multiply(q);
    island.position.y = bob + trOff;
    const s = 10.5 * (1 - bob * 0.03);
    blob.scale.set(s, s, 1);
    blob.material.opacity = (1 - bob * 0.25) * trAlpha;
    if (cur) animate(cur, t, dt);
  }

  // transitions
  const ease = (x) => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
  function stepTransition(dt) {
    if (!tr) return;
    tr.t += dt;
    if (tr.phase === 'out') {
      const p = tr.t / OUT_S;
      trOff = -SINK * p * p; trAlpha = 1 - clamp(p, 0, 1);
      if (cur) setOpacity(cur, trAlpha);
      if (p >= 1) {
        if (cur) setOpacity(cur, 1);
        mount(tr.next);
        tr = { phase: 'in', t: 0 };
        trOff = -SINK; trAlpha = 0;
        setOpacity(cur, 0);
      }
    } else {
      const p = tr.t / IN_S, e = ease(p);
      trOff = -SINK * (1 - e); trAlpha = e;
      setOpacity(cur, trAlpha);
      if (p >= 1) { tr = null; trOff = 0; trAlpha = 1; setOpacity(cur, 1); }
    }
  }

  // ---------------------------------------------------------------- sizing + loop
  const fitBase = { w: 1, h: 1 };
  function resize() {
    const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    const f = fitFor?.fit;
    if (!f) { renderer.render(scene, camera); return; }
    const aspect = w / h;
    const halfH = Math.max(f.bw / 0.88 / aspect, f.bh / 0.9) / 2;
    camera.left = -halfH * aspect + f.cx;
    camera.right = halfH * aspect + f.cx;
    camera.top = halfH + f.cy;
    camera.bottom = -halfH + f.cy;
    camera.updateProjectionMatrix();
  }

  let last = performance.now(), clock = 0, raf = 0, visible = true, running = false;
  const tNow = () => (frozen !== null ? frozen : clock);
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    clock += dt;
    stepTransition(dt);
    pose(tNow(), dt);
    renderer.render(scene, camera);
  }
  const loop = (now) => { raf = requestAnimationFrame(loop); frame(now); };
  function sync() {
    const want = !still && visible && !document.hidden;
    if (want && !running) { running = true; last = performance.now(); raf = requestAnimationFrame(loop); }
    else if (!want && running) { running = false; cancelAnimationFrame(raf); }
  }
  const renderOnce = () => { pose(frozen ?? 0, 1); renderer.render(scene, camera); };
  const io = new IntersectionObserver((en) => { visible = en[en.length - 1].isIntersecting; sync(); }, { threshold: 0 });
  io.observe(canvas);
  const onVis = () => sync();
  document.addEventListener('visibilitychange', onVis);
  const ro = new ResizeObserver(() => { resize(); if (!running) renderOnce(); });
  ro.observe(canvas);

  const onMove = (ev) => {
    if (still || !fine || ev.pointerType !== 'mouse') return;
    const r = canvas.getBoundingClientRect();
    const nx = ((ev.clientX - r.left) / r.width) * 2 - 1, ny = ((ev.clientY - r.top) / r.height) * 2 - 1;
    if (Math.abs(nx) <= 1.15 && Math.abs(ny) <= 1.15) { pointer.tx = clamp(nx, -1, 1); pointer.ty = clamp(ny, -1, 1); }
    else pointer.tx = pointer.ty = 0;
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

  // ---------------------------------------------------------------- API
  async function show(u) {
    wantUrl = u;
    const next = await load(u);
    if (wantUrl !== u) return; // a newer show() superseded this one
    if (cur === next && !tr) return;
    if (!cur || still || !running) {
      tr = null; trOff = 0; trAlpha = 1;
      if (cur) setOpacity(cur, 1);
      setOpacity(next, 1);
      mount(next);
      if (!running) renderOnce();
      return;
    }
    if (tr && tr.phase === 'out') { tr.next = next; return; }
    if (tr && tr.phase === 'in') { setOpacity(cur, 1); tr = { phase: 'out', t: 0, next }; return; }
    tr = { phase: 'out', t: 0, next };
  }
  function highlight(role) {
    hlRole = role === 'st' || role === 'sh' ? role : null;
    if (still || !running) {
      // still frame: apply immediately
      if (cur) cur.markers.forEach((m) => { m.v = m.role === hlRole ? 1 : 0; });
      renderOnce();
    }
  }

  resize();
  if (url) await show(url);
  sync();
  if (!url) renderer.render(scene, camera);

  if (frozen !== null) {
    window.__diorama = { setT(t) { stepTransition(1); pose(t, 1); renderer.render(scene, camera); } };
  }

  return {
    show,
    highlight,
    dispose() {
      running = false;
      cancelAnimationFrame(raf);
      io.disconnect(); ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('scroll', onScroll);
      cache.forEach((p) => p.then((e) => e.root.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose?.(); } })).catch(() => {}));
      [blobTex, ringTex, ringGeo, coneGeo, ballGeo, dotGeo, blob.geometry, blob.material].forEach((r) => r.dispose?.());
      draco.dispose();
      renderer.dispose();
    },
  };
}
