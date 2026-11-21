// Landing page glue: poster stage, lazy 3D + characters, scroll story, CTA -> desk -> paper flow.
import { MOBILE_MQ, heroPose, posterPose, deskPose, projectAll, boardCorners, paperCorners, reprojectMatrix } from '../scene/camera-math.js';
import { createHeroLayout, invalidateMetrics } from '../proto/hero-layout.js';
import { createPaper } from '../proto/paper.js';
import { createTimeline, seg, smooth } from './timeline.js';
import { initSections } from './sections.js';

const qs = new URLSearchParams(location.search);
const $ = (id) => document.getElementById(id);
const html = document.documentElement;
const hero = $('hero'), stage = $('stage'), poster = $('poster'), canvas = $('gl'), posterDesk = $('posterDesk');
const h1 = $('h1'), copy = $('copy'), heroUi = $('heroUi'), nav = $('nav'), story = $('story'), finale = $('finale');
const layer = $('sheetLayer'), sheet = $('sheet'), guideG = $('guideLines');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const raf = () => new Promise((r) => requestAnimationFrame(r));

const reducedMotion = qs.get('reduced') === '1' || matchMedia('(prefers-reduced-motion: reduce)').matches;
const DOLLY_MS = +qs.get('dur') || 1800;
const rigDebug = qs.get('rig') === '1';
const debugP = qs.has('p') ? +qs.get('p') : (rigDebug ? 0.62 : null);
const wantedState = qs.get('state') || 'hero';
const S = { scene: null, c3d: null, story: null, state: 'story', canvasOn: false, W: 0, H: 0, opener: null, busy: false, last: performance.now() };
if (reducedMotion) html.classList.add('reduced');
if (wantedState !== 'hero') hero.classList.add('instant');

const paper = createPaper({ layer, sheet, page1: $('page1'), page2: $('page2'), title: $('sheetTitle'), qTitle: $('qTitle'), reduced: reducedMotion });
const placeCopy = createHeroLayout({ h1, copy, hero });
const tl = createTimeline(story);

// ---------------------------------------------------------------- guides (one-point perspective lines)
for (let i = 0; i < 24; i++) {
  const a = (i * 15 + 7.5) * Math.PI / 180, l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  l.setAttribute('x1', (Math.cos(a) * 46).toFixed(1)); l.setAttribute('y1', (Math.sin(a) * 46).toFixed(1));
  l.setAttribute('x2', (Math.cos(a) * 1500).toFixed(1)); l.setAttribute('y2', (Math.sin(a) * 1500).toFixed(1));
  guideG.appendChild(l);
}
const gradId = $('gfade');
function placeGuides(corners) {
  const x = (corners[0].x + corners[2].x) / 2, y = (corners[0].y + corners[2].y) / 2;
  guideG.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
}

// ---------------------------------------------------------------- 3D gating (same rules as the prototype)
function skipReason() {
  if (qs.get('nowebgl') === '1') return 'nowebgl (param)';
  if (reducedMotion) return 'prefers-reduced-motion';
  const c = navigator.connection;
  if (c && c.saveData) return 'saveData';
  if (c && /^(slow-)?2g$/.test(c.effectiveType || '')) return '2g';
  if (navigator.deviceMemory && navigator.deviceMemory < 2) return 'deviceMemory<2';
  try {
    const cv = document.createElement('canvas'); const gl = cv.getContext('webgl2') || cv.getContext('webgl');
    if (!gl) return 'no webgl'; gl.getExtension('WEBGL_lose_context')?.loseContext();
  } catch { return 'no webgl'; }
  return '';
}

// ---------------------------------------------------------------- poster-stage geometry
function size() { const r = stage.getBoundingClientRect(); S.W = Math.round(r.width); S.H = Math.round(r.height); }
const isMobilePoster = () => matchMedia(MOBILE_MQ).matches;
function layoutPoster() {
  if (!S.scene) return;
  size();
  const hp = heroPose(S.scene, S.W, S.H, isMobilePoster());
  poster.style.transform = hp.portrait ? reprojectMatrix(posterPose(S.scene, S.W, S.H, true), hp, S.W, S.H) : '';
  if (!S.canvasOn && S.state === 'story') {
    const c = projectAll(hp, S.W, S.H, boardCorners(S.scene));
    placeCopy(c, S.W, S.H); placeGuides(c);
    beats(html.dataset.mode === 'poster' ? 1 : tl.read());
  }
}
const paperQuad = () => (S.c3d && S.canvasOn ? S.c3d.projectPaperCorners() : projectAll(deskPose(S.scene, S.W, S.H), S.W, S.H, paperCorners(S.scene)));

// ---------------------------------------------------------------- beats: DOM layers as a function of story progress
function beats(p) {
  const st = hero.style;
  const poster1 = html.dataset.mode === 'poster';   // static composition: H1 stays on the board
  const copyO = 1 - seg(p, 0, 0.08), h1O = poster1 ? 1 : 1 - smooth(seg(p, 0.16, 0.32));
  const tagO = smooth(seg(p, 0.46, 0.6)), ctaO = smooth(seg(p, 0.7, 0.84));
  st.setProperty('--copyO', copyO.toFixed(3)); st.setProperty('--h1O', h1O.toFixed(3));
  st.setProperty('--tagO', tagO.toFixed(3)); st.setProperty('--tagY', ((1 - tagO) * 22).toFixed(1) + 'px');
  st.setProperty('--ctaO', ctaO.toFixed(3)); st.setProperty('--ctaY', ((1 - ctaO) * 18).toFixed(1) + 'px');
  st.setProperty('--gradO', smooth(seg(p, 0.4, 0.62)).toFixed(3));
  st.setProperty('--idxO', (1 - seg(p, 0.05, 0.2)).toFixed(3));
  copy.style.pointerEvents = copyO > 0.5 ? '' : 'none'; copy.inert = copyO < 0.05;
  finale.querySelector('.finale-cta').inert = ctaO < 0.5;
}

// ---------------------------------------------------------------- per-frame (3D)
function onFrame({ mode }) {
  const now = performance.now(), dt = Math.min(0.1, (now - S.last) / 1000); S.last = now;
  if (S.state === 'story') {
    const p = tl.step(dt);
    S.story?.setProgress(p);
    beats(p);
  } else S.story?.setProgress(tl.value);
  if (S.canvasOn && S.state === 'story' && mode === 'hero') {
    const c = S.c3d.projectBoard();
    placeCopy(c, S.W, S.H); placeGuides(c);
  }
}

// ---------------------------------------------------------------- 3D lifecycle
function afterLoadIdle(cb) {
  const run = () => ('requestIdleCallback' in window ? requestIdleCallback(cb, { timeout: 2500 }) : setTimeout(cb, 200));
  document.readyState === 'complete' ? run() : addEventListener('load', run, { once: true });
}
async function start3D() {
  try {
    const mod = await import('../scene/classroom3d.js');
    S.c3d = await mod.init({
      container: stage, canvas, sceneData: S.scene, startAt: wantedState === 'hero' ? 'hero' : 'desk',
      glbUrl: 'assets/3d/classroom.glb', dracoPath: 'vendor/three/addons/libs/draco/gltf/', onFrame,
    });
    S.c3d.renderOnce(); await raf(); await raf();       // first frame == poster camera (progress 0 adds no dolly)
    S.canvasOn = true; hero.classList.add('canvas-on'); html.dataset.mode = '3d';
    if (!reducedMotion) setTimeout(() => S.c3d && S.c3d.setBreath(S.state === 'story' ? 1 : 0), 900);
    // characters lazy-load with the 3D, off the critical path
    const sm = await import('./story.js');
    S.story = await sm.createStory({ c3d: S.c3d, sceneData: S.scene, rigDebug });
    S.story.setProgress(tl.value);
  } catch (err) {
    console.warn('3D unavailable, staying on poster:', err);
    S.c3d = null; S.canvasOn = false; html.dataset.mode = 'poster'; layoutPoster();
  }
}

// ---------------------------------------------------------------- CTA -> desk -> paper
const loadDeskPoster = () => { if (!posterDesk.src) posterDesk.src = posterDesk.dataset.src; };
function fadeChars(to, ms = 260) {
  const sm = S.story; if (!sm) return Promise.resolve();
  const from = sm.alpha, t0 = performance.now();
  return new Promise((res) => { const f = (n) => { const k = Math.min(1, (n - t0) / ms); sm.setAlpha(from + (to - from) * k); k < 1 ? requestAnimationFrame(f) : res(); }; requestAnimationFrame(f); });
}
async function openPaper({ instant = false } = {}) {
  if (S.busy || S.state !== 'story') return;
  S.busy = true; S.opener = document.activeElement;
  const r = story.getBoundingClientRect();
  if (r.bottom < innerHeight * 0.6 || r.top > innerHeight * 0.4 && html.dataset.mode === 'poster') {   // opened from a section below the pin: go back to the stage
    const y = html.dataset.mode === '3d' ? tl.scrollYFor(1) : scrollY + r.top;
    scrollTo({ top: y, behavior: 'instant' }); tl.snap(); await raf(); await raf();
  }
  tl.freeze(true); html.classList.add('lock');
  hero.classList.add('away'); document.body.classList.add('leaving');
  nav.inert = true; heroUi.inert = true; finale.inert = true;
  S.state = 'flying';
  const chars = fadeChars(0, instant ? 1 : 260);                    // characters leave first
  if (S.c3d && S.canvasOn) { await (instant ? chars : wait(120)); await S.c3d.goToDesk(instant ? 1 : DOLLY_MS); }
  await chars;
  loadDeskPoster(); try { await posterDesk.decode(); } catch { /* ignore */ }
  hero.classList.add('desk-poster');
  await wait(instant ? 0 : reducedMotion ? 220 : 650);
  size();
  const quad = paperQuad();
  hero.classList.add('dim'); document.body.classList.add('sheet-open');
  await paper.lift(quad, S.W, S.H, { instant });
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
  S.state = 'story';
  nav.inert = false; heroUi.inert = false; finale.inert = false;
  hero.classList.remove('away'); document.body.classList.remove('leaving');
  await fadeChars(1, 300);
  html.classList.remove('lock'); tl.freeze(false); tl.snap();
  (S.opener && S.opener.isConnected ? S.opener : $('finale-btn')).focus({ preventScroll: true });
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

// ---------------------------------------------------------------- boot
async function boot() {
  initSections({ reduced: reducedMotion });
  document.fonts.load('700 40px Caveat').then(() => { invalidateMetrics(); layoutPoster(); }).catch(() => {});
  S.scene = await (await fetch('assets/3d/scene.json')).json();
  const reason = skipReason();
  html.dataset.mode = reason ? 'poster' : 'pending';
  layoutPoster();
  performance.mark('copy-ready'); hero.classList.add('ready');
  new ResizeObserver(() => { layoutPoster(); tl.read(); }).observe(stage);
  document.fonts.ready.then(() => { invalidateMetrics(); layoutPoster(); });
  addEventListener('scroll', () => { if (html.dataset.mode !== '3d' && S.state === 'story') layoutPoster(); }, { passive: true });
  afterLoadIdle(loadDeskPoster);
  if (reason) console.info('3D skipped:', reason);
  else afterLoadIdle(async () => { await start3D(); await applyDebug(); });
  if (reason) await applyDebug();
}
async function applyDebug() {
  if (debugP != null && html.dataset.mode !== 'poster') {
    scrollTo({ top: tl.scrollYFor(debugP), behavior: 'instant' }); tl.snap();
    S.story?.setProgress(tl.value);
  }
  if (wantedState !== 'hero') {
    if (S.c3d) S.c3d.jumpTo('desk');
    if (wantedState === 'desk') { hero.classList.add('away'); document.body.classList.add('leaving'); S.state = 'desk'; loadDeskPoster(); try { await posterDesk.decode(); } catch {} hero.classList.add('desk-poster'); }
    else { await openPaper({ instant: true }); if (wantedState === 'page2') { await paper.flip(true, { instant: true }); S.state = 'page2'; } }
    await wait(300); hero.classList.remove('instant');
  }
  window.__story = { jump(p) { scrollTo({ top: tl.scrollYFor(p), behavior: 'instant' }); tl.snap(); S.story?.setProgress(tl.value); beats(tl.value); return tl.value; }, tl, S };
  html.dataset.ready = '1';
}
boot();
