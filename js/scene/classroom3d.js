// Reusable 3D classroom: loads the baked GLB, runs the "living classroom" loops, owns the camera.
// API: init(opts) / goToDesk() / goToHero() / projectPaperCorners() / dispose()  (+ small helpers).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { createShafts } from './shafts.js?v=bcf57cddb0';
import { createDust } from './dust.js?v=bcf57cddb0';
import { heroPose, deskPose, project, easeInOut, MOBILE_MQ } from './camera-math.js?v=bcf57cddb0';

const DEG = Math.PI / 180;
let S = null; // singleton state

const mq = (q) => matchMedia(q).matches;

export async function init({ container, canvas, sceneData, glbUrl, dracoPath, onFrame, startAt = 'hero', quality } = {}) {
  if (S) dispose();
  const isMobile = mq('(pointer: coarse)') || mq('(max-width: 600px)');
  const maxDpr = isMobile ? 1.5 : 1.75;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.toneMapping = THREE.NoToneMapping;       // textures are baked + already tone-mapped
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0xe9e2d4, 1);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 120);

  const draco = new DRACOLoader().setDecoderPath(dracoPath);
  const loader = new GLTFLoader().setDRACOLoader(draco);
  const gltf = await loader.loadAsync(glbUrl);
  scene.add(gltf.scene);
  draco.dispose();

  const byName = {};
  gltf.scene.traverse((o) => { if (o.name) byName[o.name] = o; });
  // the paper is baked into the desk texture: hide the helper plane (avoids a second, z-fighting sheet)
  if (byName.Paper_Anchor) byName.Paper_Anchor.visible = false;
  gltf.scene.traverse((o) => { if (o.isMesh && o.material) o.material.toneMapped = false; });

  const fan = byName.Fan_Blades, hand = byName.Clock_SecondHand, curL = byName.Curtain_L, curR = byName.Curtain_R;
  const fanBase = fan ? fan.rotation.y : 0;

  const gainParam = parseFloat(new URLSearchParams(location.search).get('sg')); // debug: shaft gain
  const shafts = createShafts(scene, { windows: sceneData.windows, sun: sceneData.sun, ...(gainParam ? { gain: gainParam } : {}) });
  const dust = createDust(scene, { windows: sceneData.windows, sun: sceneData.sun, count: isMobile ? 220 : 340, pixelRatio: 1 });

  S = {
    THREE, renderer, scene, camera, gltf, shafts, dust, sceneData, container, canvas, onFrame, isMobile, maxDpr,
    W: 1, H: 1, mode: startAt, tween: null, breath: 0, breathTarget: 0, pointer: { x: 0, y: 0, sx: 0, sy: 0 },
    paused: new Set(), raf: 0, t0: performance.now(), last: performance.now(), clock: 0, disposed: false,
    fan, hand, curL, curR, fanBase, mobilePoster: mq(MOBILE_MQ), parallax: !isMobile && mq('(hover: hover) and (pointer: fine)'),
    handLast: -1, handT0: 0,
  };
  resize();
  placeCamera(performance.now(), 0);
  const ro = new ResizeObserver(resize); ro.observe(container); S.ro = ro;
  S.onPointer = (e) => { const r = container.getBoundingClientRect(); S.pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1; S.pointer.y = ((e.clientY - r.top) / r.height) * 2 - 1; };
  if (S.parallax) addEventListener('pointermove', S.onPointer, { passive: true });
  S.onVis = () => setPaused('hidden', document.hidden);
  document.addEventListener('visibilitychange', S.onVis);
  S.io = new IntersectionObserver((es) => setPaused('offscreen', !es[es.length - 1].isIntersecting));
  S.io.observe(container);
  animate();
  return api();
}

function api() {
  return { projectWorld, getContext, addUpdater, setPoseHook, goToDesk, goToHero, projectPaperCorners, projectBoard, jumpTo, setPaused, setBreath, renderOnce, resize, dispose,
    get canvas() { return S.canvas; }, get mode() { return S.mode; }, getPose };
}

// ---- poses --------------------------------------------------------------
function basePose(which) {
  const { W, H, sceneData, mobilePoster } = S;
  if (which === 'desk') return deskPose(sceneData, W, H);
  const p = heroPose(sceneData, W, H, mobilePoster);
  return S.poseHook ? S.poseHook(p, W, H) : p;   // landing page: scroll-driven dolly
}
// extension points for page-level scenes (characters, sparks) that live in the same THREE.Scene
export function getContext() { return { THREE, scene: S.scene, camera: S.camera, renderer: S.renderer, sceneData: S.sceneData, isMobile: S.isMobile, get W() { return S.W; }, get H() { return S.H; }, maxDpr: S.maxDpr }; }
export function addUpdater(fn) { (S.updaters ||= []).push(fn); }
export function setPoseHook(fn) { S.poseHook = fn; S.dirty = true; }
export function getPose() {
  const { camera } = S;
  return { pos: camera.position.toArray(), quat: camera.quaternion.toArray(), fov: camera.fov };
}

function resize() {
  if (!S) return;
  const r = S.container.getBoundingClientRect();
  S.W = Math.max(1, Math.round(r.width)); S.H = Math.max(1, Math.round(r.height));
  S.mobilePoster = mq(MOBILE_MQ);
  const dpr = Math.min(window.devicePixelRatio || 1, S.maxDpr);
  S.renderer.setPixelRatio(dpr);
  S.renderer.setSize(S.W, S.H, false);
  S.camera.aspect = S.W / S.H;
  S.shafts.setGainScale(S.W / S.H < 0.8 ? 1.5 : 1); // portrait: windows sit at the edges, make the beams read
  S.dust.setView(S.H * dpr, 50, dpr);
  S.dirty = true;
}

const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _e = new THREE.Euler();
function applyPose(p) {
  S.camera.position.set(...p.pos);
  S.camera.quaternion.set(...p.quat);
  S.camera.fov = p.fov;
  S.camera.updateProjectionMatrix();
}

function placeCamera(now, dt) {
  const t = (now - S.t0) / 1000;
  if (S.tween) {
    const tw = S.tween, k = Math.min(1, (now - tw.start) / tw.dur), e = easeInOut(k);
    const to = basePose(tw.to);
    const pos = tw.from.pos.map((v, i) => v + (to.pos[i] - v) * e);
    pos[1] += Math.sin(Math.PI * e) * tw.arc;                 // slight arc
    _q.set(...tw.from.quat); _q2.set(...to.quat); _q.slerp(_q2, e);
    S.camera.position.set(...pos); S.camera.quaternion.copy(_q);
    S.camera.fov = tw.from.fov + (to.fov - tw.from.fov) * e;
    S.camera.updateProjectionMatrix();
    if (k >= 1) { S.mode = tw.to; const done = tw.resolve; S.tween = null; done(); }
    return;
  }
  const p = basePose(S.mode);
  applyPose(p);
  // breathing + pointer parallax (hero only, and only once the canvas is showing; ramps in/out smoothly)
  S.breath += (S.breathTarget - S.breath) * Math.min(1, dt * 2.5);
  const b = S.breath * (S.mode === 'hero' ? 1 : 0);
  if (b > 0.001) {
    const px = S.pointer, k = Math.min(1, dt * 3);
    px.sx += (px.x - px.sx) * k; px.sy += (px.y - px.sy) * k;
    const lim = 1.5 * DEG;
    const yaw = -px.sx * lim * (S.parallax ? 1 : 0), pitch = -px.sy * lim * 0.6 * (S.parallax ? 1 : 0);
    S.camera.position.x += Math.sin(t * 0.55) * 0.018 * b + (S.parallax ? px.sx * 0.03 * b : 0);
    S.camera.position.y += Math.sin(t * 0.43 + 1.3) * 0.014 * b;
    S.camera.position.z += Math.sin(t * 0.31) * 0.02 * b;
    _e.set(pitch * b + Math.sin(t * 0.37) * 0.12 * DEG * b, yaw * b, Math.sin(t * 0.29) * 0.08 * DEG * b, 'YXZ');
    _q.setFromEuler(_e); S.camera.quaternion.multiply(_q);
  }
}

// ---- tweens ---------------------------------------------------------------
function tweenTo(to, dur) {
  return new Promise((resolve) => {
    const from = getPose();
    S.tween = { from, to, start: performance.now(), dur, arc: to === 'desk' ? 0.22 : 0.16, resolve };
    S.breathTarget = 0; S.breath = 0;
    wake();
  });
}
export function goToDesk(dur = 1800) { if (S.mode === 'desk' && !S.tween) return Promise.resolve(); return tweenTo('desk', dur); }
export function goToHero(dur = 1800) {
  if (S.mode === 'hero' && !S.tween) return Promise.resolve();
  return tweenTo('hero', dur).then(() => { S.breathTarget = 1; });
}
export function jumpTo(which) { S.tween = null; S.mode = which; S.breath = 0; S.breathTarget = which === 'hero' ? 1 : 0; placeCamera(performance.now(), 0); renderOnce(); }
export function setBreath(v) { S.breathTarget = v; }

// ---- projection (px relative to the container) -------------------------------
const toPx = (v3) => { const v = v3.clone().project(S.camera); return { x: (v.x * 0.5 + 0.5) * S.W, y: (0.5 - v.y * 0.5) * S.H }; };
function projectPoints(arr) {
  S.camera.updateMatrixWorld(true);
  return arr.map((p) => toPx(new THREE.Vector3(...p)));
}
export function projectPaperCorners() { return projectPoints(S.sceneData.paperAnchor.corners_TL_TR_BR_BL); }
export function projectWorld(pts) { return projectPoints(pts); }
export function projectBoard() { return projectPoints(S.sceneData.chalkboard.corners_TL_TR_BR_BL); }

// ---- loop ------------------------------------------------------------------
function setPaused(reason, on) { on ? S.paused.add(reason) : S.paused.delete(reason); if (!on) wake(); }
function wake() { if (S && !S.raf && !S.paused.size) { S.last = performance.now(); S.raf = requestAnimationFrame(animate); } }

const _sq = new THREE.Quaternion(), _se = new THREE.Euler();
function swayCurtain(node, aboutZ, aboutX) {
  if (!node) return;
  if (!node.userData.rest) node.userData.rest = node.quaternion.clone();
  _se.set(aboutX, 0, aboutZ, 'XYZ'); _sq.setFromEuler(_se);          // billow towards the room (world X) and along the wall (world Z)
  node.quaternion.copy(_sq).multiply(node.userData.rest);
}

function updateAnimated(now) {
  const t = (now - S.t0) / 1000;
  if (S.fan) S.fan.rotation.y = S.fanBase + (t / 2.4) * Math.PI * 2;
  if (S.hand) {
    const d = new Date(), sec = d.getSeconds(), ms = d.getMilliseconds();
    const e = 1 - Math.pow(1 - Math.min(1, ms / 140), 3); // quick tick, then rest (like a quartz movement)
    S.hand.rotation.z = -(sec + e) * 6 * DEG;
  }
  const sway = (ph, a) => Math.sin(t * 0.55 + ph) * 0.6 + Math.sin(t * 0.93 + ph * 2.1) * 0.3 + Math.sin(t * 0.21 + ph * 0.7) * 0.4;
  // curtains hang on the side walls and their nodes carry a 90 deg turn: sway about WORLD axes on top of the rest orientation
  swayCurtain(S.curL, sway(0.0) * 1.4 * DEG, sway(1.7) * 0.9 * DEG);
  swayCurtain(S.curR, sway(3.1) * 1.4 * DEG, sway(4.6) * 0.9 * DEG);
  S.shafts.update(t); S.dust.update(t);
  if (S.updaters) for (const u of S.updaters) u(t, now);
}

function animate() {
  if (!S || S.disposed) return;
  S.raf = 0;
  if (S.paused.size) return;
  const now = performance.now(), dt = Math.min(0.1, (now - S.last) / 1000); S.last = now;
  updateAnimated(now);
  placeCamera(now, dt);
  S.renderer.render(S.scene, S.camera);
  if (S.onFrame) S.onFrame({ camera: S.camera, mode: S.mode, tweening: !!S.tween });
  S.raf = requestAnimationFrame(animate);
}
export function renderOnce() {
  updateAnimated(performance.now());
  S.renderer.render(S.scene, S.camera);
  if (S.onFrame) S.onFrame({ camera: S.camera, mode: S.mode, tweening: !!S.tween });
}

export function dispose() {
  if (!S) return;
  S.disposed = true; cancelAnimationFrame(S.raf);
  S.ro?.disconnect(); S.io?.disconnect();
  removeEventListener('pointermove', S.onPointer); document.removeEventListener('visibilitychange', S.onVis);
  S.shafts.dispose(); S.dust.dispose();
  S.scene.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) { for (const k of Object.keys(o.material)) { const v = o.material[k]; if (v && v.isTexture) v.dispose(); } o.material.dispose(); }
  });
  S.renderer.dispose(); S.renderer.forceContextLoss();
  S = null;
}
