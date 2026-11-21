// Landing v2 glue: dusk sky -> back-to-back characters -> flash -> 3D classroom -> desk paper quiz flow.
import { MOBILE_MQ, heroPose, posterPose, deskPose, projectAll, boardCorners, paperCorners, reprojectMatrix } from '../scene/camera-math.js';
import { createPaper } from '../proto/paper.js';
import { createTimeline, seg, smooth, easeSine } from '../landing/timeline.js';
import { initSections } from '../landing/sections.js';
import { createSkySea } from './sky-sea.js';
import { createSkyLayers } from './sky-layers.js';
import { CTA_LABEL, CTA_MICRO } from './config.js';

const qs = new URLSearchParams(location.search);
const $ = (id) => document.getElementById(id);
const html = document.documentElement;
const hero = $('hero'), stage = $('stage'), poster = $('poster'), canvasGL = $('gl'), posterDesk = $('posterDesk');
const story = $('story'), nav = $('nav'), heroText = $('heroText'), boardTag = $('boardTag'), deskCta = $('deskCta');
const layer = $('sheetLayer'), sheet = $('sheet');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const raf = () => new Promise((r) => requestAnimationFrame(r));

const reducedMotion = qs.get('reduced') === '1' || matchMedia('(prefers-reduced-motion: reduce)').matches;
const DOLLY_MS = +qs.get('dur') || 1800;
const rigDebug = qs.get('rig') === '1';
const debugP = qs.has('p') ? +qs.get('p') : null;
const wantedState = qs.get('state') || 'hero';
const S = { layers: null, scene: null, c3d: null, hs: null, sky: null, state: 'story', canvasOn: false, W: 0, H: 0, opener: null, busy: false, p: 0, last: performance.now(), t0: performance.now() };
if (reducedMotion) html.classList.add('reduced');
if (wantedState !== 'hero') hero.classList.add('instant');

const paper = createPaper({ layer, sheet, page1: $('page1'), page2: $('page2'), title: $('sheetTitle'), qTitle: $('qTitle'), reduced: reducedMotion });
const tl = createTimeline(story);

// ---- copy that may still change lives in config.js
document.querySelectorAll('[data-start]').forEach((b) => { b.textContent = CTA_LABEL; });
document.querySelectorAll('.hero-micro').forEach((m) => { m.textContent = CTA_MICRO; });
if (reducedMotion) document.querySelectorAll('.thread').forEach((s) => s.pauseAnimations && s.pauseAnimations());

// ---- 3D gating (same rules as before)
function skipReason() {
  if (qs.get('nowebgl') === '1') return 'nowebgl (param)';
  if (reducedMotion) return 'prefers-reduced-motion';
  const c = navigator.connection;
  if (c && c.saveData) return 'saveData';
  if (c && /^(slow-)?2g$/.test(c.effectiveType || '')) return '2g';
  if (navigator.deviceMemory && navigator.deviceMemory < 2) return 'deviceMemory<2';
  try { const cv = document.createElement('canvas'); const gl = cv.getContext('webgl2') || cv.getContext('webgl'); if (!gl) return 'no webgl'; gl.getExtension('WEBGL_lose_context')?.loseContext(); } catch { return 'no webgl'; }
  return '';
}
const isMobileView = () => matchMedia(MOBILE_MQ).matches;
function size() { const r = stage.getBoundingClientRect(); S.W = Math.round(r.width); S.H = Math.round(r.height); }

// ---- classroom geometry (poster maths; used until / alongside the canvas)
function layoutPoster() {
  if (!S.scene) return;
  size();
  const hp = heroPose(S.scene, S.W, S.H, isMobileView());
  poster.style.transform = hp.portrait ? reprojectMatrix(posterPose(S.scene, S.W, S.H, true), hp, S.W, S.H) : '';
}
const boardPx = () => (S.c3d && S.canvasOn ? S.c3d.projectBoard() : projectAll(heroPose(S.scene, S.W, S.H, isMobileView()), S.W, S.H, boardCorners(S.scene)));
const paperPx = () => (S.c3d && S.canvasOn ? S.c3d.projectPaperCorners() : projectAll(deskPose(S.scene, S.W, S.H), S.W, S.H, paperCorners(S.scene)));
const paperQuad = () => (S.c3d && S.canvasOn ? S.c3d.projectPaperCorners() : projectAll(deskPose(S.scene, S.W, S.H), S.W, S.H, paperCorners(S.scene)));

let tagMetrics = null, lastTagFont = 0;
function placeBoardTag() {
  if (!tagMetrics) { const ctx = document.createElement('canvas').getContext('2d'); ctx.font = '700 100px Caveat, cursive'; tagMetrics = [ctx.measureText('Beda Jalan,').width / 100, ctx.measureText('Satu').width / 100 + 0.2 + ctx.measureText('Tujuan').width / 100 * 1.12]; }
  const c = boardPx(), xs = c.map((q) => q.x), ys = c.map((q) => q.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), bw = x1 - x0, bh = y1 - y0;
  const font = Math.min(0.9 * bw / Math.max(...tagMetrics), 0.74 * bh / (2 * 0.95 * 1.1), 84);
  if (Math.abs(font - lastTagFont) > 0.25) { boardTag.style.fontSize = font.toFixed(2) + 'px'; lastTagFont = font; }
  boardTag.style.transform = `translate(${((x0 + x1) / 2).toFixed(1)}px,${((y0 + y1) / 2 + bh * 0.02).toFixed(1)}px) translate(-50%,-50%)`;
}
function placeDeskCta() {
  const c = paperPx(), cx = c.reduce((a, q) => a + q.x, 0) / 4, top = Math.min(...c.map((q) => q.y));
  const y = Math.max(96, top - 20);
  deskCta.style.transform = `translate(${cx.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-100%)`;
}

// ---- scroll story
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
function beats(p, t) {
  const st = hero.style, v = (k, x) => st.setProperty(k, typeof x === 'number' ? x.toFixed(3) : x);
  const close = ease(seg(p, 0.02, 0.5)), light = smooth(seg(p, 0.46, 0.74));
  v('--txtO', 1 - smooth(seg(p, 0.06, 0.3))); v('--txtY', (-seg(p, 0.05, 0.3) * 70).toFixed(1) + 'px');
  v('--tagO', smooth(seg(p, 0.16, 0.28)) * (1 - smooth(seg(p, 0.4, 0.48))));
  v('--cueO', 1 - seg(p, 0, 0.04));
  const fr = smooth(seg(p, 0.56, 0.8)) * 135;
  v('--fr', fr.toFixed(1) + '%');
  v('--flashO', p < 0.82 ? smooth(seg(p, 0.6, 0.7)) : 1 - smooth(seg(p, 0.84, 0.98)));
  v('--fillO', p < 0.82 ? smooth(seg(p, 0.72, 0.8)) : 1 - smooth(seg(p, 0.84, 0.95)));
  const roomO = smooth(seg(p, 0.79, 0.82));
  v('--roomO', roomO); hero.classList.toggle('room-on', roomO > 0.001);
  v('--btO', smooth(seg(p, 0.88, 1))); v('--dcO', smooth(seg(p, 0.93, 1)));
  deskCta.inert = p < 0.95; heroText.inert = p > 0.2;
  const gone = p > 0.83;
  hero.classList.toggle('sky-gone', gone);
  document.body.classList.toggle('flashing', p > 0.52 && p < 0.88);
  if (S.sky) { S.sky.setLook(smooth(seg(p, 0, 0.7)), smooth(seg(p, 0.5, 0.78)) * 0.55); S.sky.setPaused('room', gone); }
  if (S.hs && !gone) {
    S.hs.update(t, { close, light, alpha: 1 });
    S.hs.render();
    const c = S.hs.contactPx(); v('--fx', c.x.toFixed(1) + 'px'); v('--fy', c.y.toFixed(1) + 'px');
  }
  if (S.c3d) S.c3d.setPaused('story', S.state === 'story' && p < 0.78);
  if (p > 0.78 && S.state === 'story') { placeBoardTag(); placeDeskCta(); }
}
function navTheme(p) {
  const r = story.getBoundingClientRect();
  const past = html.dataset.mode === 'poster' ? scrollY > innerHeight * 0.7 : r.bottom < 90;
  const th = past ? 'light' : (html.dataset.mode !== 'poster' && p >= 0.9 ? 'room' : 'sky');
  if (nav.dataset.theme !== th) nav.dataset.theme = th;
}
function tick(now) {
  const dt = Math.min(0.1, (now - S.last) / 1000); S.last = now;
  const t = (now - S.t0) / 1000;
  if (html.dataset.mode !== 'poster') {
    S.p = S.state === 'story' ? tl.step(dt) : tl.value;
    if (S.layers && S.p < 0.84) {
      const sun = S.layers.update(t, S.p);
    }
    if (S.sky) S.sky.setScroll(Math.min(S.p, 0.84));
    beats(S.p, t);
  }
  navTheme(S.p);
  requestAnimationFrame(tick);
}

// ---- lazy 3D: sky first (tiny), then characters, then the classroom
function afterLoadIdle(cb, timeout = 2500) {
  const run = () => ('requestIdleCallback' in window ? requestIdleCallback(cb, { timeout }) : setTimeout(cb, 200));
  document.readyState === 'complete' ? run() : addEventListener('load', run, { once: true });
}
const isMob = () => innerWidth <= 600 || innerWidth < innerHeight;
function startSky() {
  try {
    S.sky = createSkySea({ back: $('sky'), front: $('skyFront') }, { scale: isMob() ? 0.6 : 0.75, cloudScale: isMob() ? 0.36 : 0.42 });
    if (!S.sky) throw new Error('no webgl');
    S.sky.drawOnce(); S.sky.start(); hero.classList.add('sky-on');
    addEventListener('resize', () => S.sky.setScale(isMob() ? 0.6 : 0.75));
  } catch (e) { console.warn('sky unavailable', e); S.sky = null; }
}
async function startCharacters() {
  const m = await import('./hero-scene.js');
  S.hs = await m.createHeroScene({ canvas: $('chars'), container: stage, isMobile: isMob(), rigDebug, sunHex: S.scene.sun.colorHex });
  S.hs.update(0, { close: 0, light: 0 }); S.hs.render(); await raf();
  hero.classList.add('chars-on');
}
async function startClassroom() {
  const mod = await import('../scene/classroom3d.js');
  S.c3d = await mod.init({ container: stage, canvas: canvasGL, sceneData: S.scene, startAt: wantedState === 'hero' ? 'hero' : 'desk',
    glbUrl: 'assets/3d/classroom.glb', dracoPath: 'vendor/three/addons/libs/draco/gltf/', onFrame: () => {} });
  S.c3d.setPaused('story', S.state === 'story' && S.p < 0.78);
  S.c3d.renderOnce(); await raf(); await raf();
  S.canvasOn = true; hero.classList.add('canvas-on');
  if (!reducedMotion) setTimeout(() => S.c3d && S.c3d.setBreath(S.state === 'story' ? 1 : 0), 900);
}
async function start3D() {
  try {
    startSky();
    if (!S.sky) throw new Error('sky');
    await startCharacters();
    html.dataset.mode = '3d';
    await wait(200);
    await startClassroom();
  } catch (err) {
    console.warn('3D unavailable, static hero:', err);
    S.hs?.dispose(); S.hs = null; S.c3d = null; S.canvasOn = false; html.dataset.mode = 'poster'; hero.classList.remove('sky-on', 'chars-on');
    S.layers?.load(['front']);
  }
}

// ---- CTA -> classroom -> desk -> paper
const loadDeskPoster = () => { if (!posterDesk.src) posterDesk.src = posterDesk.dataset.src; };
async function toClassroom() {
  if (html.dataset.mode === 'poster' || S.p >= 0.97) return;
  tl.freeze(false);
  scrollTo({ top: tl.scrollYFor(1), behavior: reducedMotion ? 'instant' : 'smooth' });
  const t0 = performance.now();
  while (tl.value < 0.97 && performance.now() - t0 < 5000) await wait(80);
  if (tl.value < 0.97) { scrollTo({ top: tl.scrollYFor(1), behavior: 'instant' }); tl.snap(); await raf(); }
}
async function openPaper({ instant = false } = {}) {
  if (S.busy || S.state !== 'story') return;
  S.busy = true; S.opener = document.activeElement;
  if (!instant) await toClassroom();
  const r = story.getBoundingClientRect();
  if (html.dataset.mode === 'poster' && (r.bottom < innerHeight * 0.5 || r.top > innerHeight * 0.3)) { scrollTo({ top: scrollY + r.top, behavior: 'instant' }); await raf(); }
  if (html.dataset.mode !== 'poster' && (r.bottom < innerHeight * 0.6 || r.top > innerHeight * 0.4)) { scrollTo({ top: tl.scrollYFor(1), behavior: 'instant' }); tl.snap(); await raf(); }
  tl.freeze(true); html.classList.add('lock');
  hero.classList.add('away'); document.body.classList.add('leaving');
  nav.inert = true; heroText.inert = true; $('mbar').inert = true;
  S.state = 'flying';
  if (html.dataset.mode === 'poster') { hero.style.setProperty('--roomO', 1); hero.classList.add('room-on'); }
  if (S.c3d && S.canvasOn) await S.c3d.goToDesk(instant ? 1 : DOLLY_MS);
  loadDeskPoster(); try { await posterDesk.decode(); } catch { /* ignore */ }
  hero.classList.add('desk-poster');
  await wait(instant ? 0 : reducedMotion ? 220 : 650);
  size();
  hero.classList.add('dim'); document.body.classList.add('sheet-open');
  await paper.lift(paperQuad(), S.W, S.H, { instant });
  S.state = 'paper'; $('sheetTitle').focus({ preventScroll: true }); S.busy = false;
}
async function closePaper() {
  if (S.busy || (S.state !== 'paper' && S.state !== 'page2')) return;
  S.busy = true;
  hero.classList.remove('dim'); document.body.classList.remove('sheet-open');
  size(); await paper.lower(paperQuad());
  S.state = 'flying';
  hero.classList.remove('desk-poster');
  if (S.c3d && S.canvasOn) await S.c3d.goToHero(DOLLY_MS); else await wait(reducedMotion ? 220 : 650);
  if (html.dataset.mode === 'poster') { hero.style.setProperty('--roomO', 0); hero.classList.remove('room-on'); }
  S.state = 'story';
  nav.inert = false; heroText.inert = false; $('mbar').inert = false;
  hero.classList.remove('away'); document.body.classList.remove('leaving');
  html.classList.remove('lock'); tl.freeze(false); tl.snap();
  (S.opener && S.opener.isConnected ? S.opener : $('desk-btn')).focus({ preventScroll: true });
  S.busy = false;
}
for (const b of document.querySelectorAll('[data-start]')) b.addEventListener('click', () => openPaper());
for (const b of document.querySelectorAll('[data-close]')) b.addEventListener('click', closePaper);
$('kopForm').addEventListener('submit', async (e) => { e.preventDefault(); await paper.flip(true); S.state = 'page2'; });
$('backToKop').addEventListener('click', async () => { await paper.flip(false); S.state = 'paper'; });
$('qForm').addEventListener('submit', (e) => e.preventDefault());
document.addEventListener('keydown', (e) => {
  if (S.state !== 'paper' && S.state !== 'page2') return;
  if (e.key === 'Escape') { e.preventDefault(); closePaper(); } else paper.trap(e);
});
document.addEventListener('click', (e) => { if (e.target.closest('a[href="#privasi"],a[href="#syarat"],a[href="#kontak"]')) e.preventDefault(); });

// ---- nav menu (mobile)
const hamb = $('hamb'), menu = $('navMenu');
hamb.addEventListener('click', () => { const open = hamb.getAttribute('aria-expanded') !== 'true'; hamb.setAttribute('aria-expanded', String(open)); menu.hidden = !open; });
menu.addEventListener('click', (e) => { if (e.target.closest('a')) { hamb.setAttribute('aria-expanded', 'false'); menu.hidden = true; } });
addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) { hamb.setAttribute('aria-expanded', 'false'); menu.hidden = true; hamb.focus(); } });

// ---- boot
async function boot() {
  initSections({ reduced: reducedMotion });
  S.scene = await (await fetch('assets/3d/scene.json')).json();
  const reason = skipReason();
  html.dataset.mode = reason ? 'poster' : 'pending';
  layoutPoster(); size();
  S.layers = createSkyLayers(stage, { animate: !reason });
  S.layers.layout(); S.layers.update(0, 0);
  if (reason) setTimeout(() => S.layers.load(['front']), 0);   // the still front clouds are only needed without the shader
  hero.classList.add('ready');
  new ResizeObserver(() => { layoutPoster(); tl.read(); S.layers.layout(); if (html.dataset.mode === 'poster') S.layers.update(0, 0); }).observe(stage);
  afterLoadIdle(loadDeskPoster, 4000);
  requestAnimationFrame(tick);
  if (reason) { console.info('3D skipped:', reason); await applyDebug(); }
  else afterLoadIdle(async () => { await start3D(); await applyDebug(); });
}
async function applyDebug() {
  if (debugP != null && html.dataset.mode !== 'poster') { scrollTo({ top: tl.scrollYFor(debugP), behavior: 'instant' }); tl.snap(); S.p = tl.value; beats(S.p, 1); }
  if (wantedState !== 'hero') {
    if (S.c3d) S.c3d.jumpTo('desk');
    if (html.dataset.mode !== 'poster') { scrollTo({ top: tl.scrollYFor(1), behavior: 'instant' }); tl.snap(); S.p = 1; beats(1, 1); }
    if (wantedState === 'desk') { hero.classList.add('away'); document.body.classList.add('leaving'); S.state = 'desk'; if (html.dataset.mode === 'poster') { hero.style.setProperty('--roomO', 1); hero.classList.add('room-on'); } loadDeskPoster(); try { await posterDesk.decode(); } catch {} hero.classList.add('desk-poster'); }
    else { await openPaper({ instant: true }); if (wantedState === 'page2') { await paper.flip(true, { instant: true }); S.state = 'page2'; } }
    await wait(300); hero.classList.remove('instant');
  }
  window.__story = { jump(p) { scrollTo({ top: tl.scrollYFor(p), behavior: 'instant' }); tl.snap(); S.p = tl.value; beats(S.p, (performance.now() - S.t0) / 1000); return S.p; }, tl, S };
  html.dataset.ready = '1';
}
boot();
