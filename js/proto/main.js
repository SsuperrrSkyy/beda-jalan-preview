// Page glue: poster stage (no three.js), lazy 3D, copy layout, CTA -> desk -> paper flow, debug params.
import { MOBILE_MQ, heroPose, posterPose, deskPose, projectAll, boardCorners, paperCorners, reprojectMatrix } from '../scene/camera-math.js?v=bcf57cddb0';
import { createHeroLayout, invalidateMetrics } from './hero-layout.js?v=bcf57cddb0';
import { createPaper } from './paper.js?v=bcf57cddb0';

const qs = new URLSearchParams(location.search);
const $ = (id) => document.getElementById(id);
const hero = $('hero'), stage = $('stage'), poster = $('poster'), canvas = $('gl'), posterDesk = $('posterDesk');
const h1 = $('h1'), copy = $('copy'), heroUi = $('heroUi'), nav = $('nav');
const layer = $('sheetLayer'), sheet = $('sheet');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const raf = () => new Promise((r) => requestAnimationFrame(r));

const reducedMotion = qs.get('reduced') === '1' || matchMedia('(prefers-reduced-motion: reduce)').matches;
const DOLLY_MS = +qs.get('dur') || 1800; // debug: slow the camera move for screenshots
const wantedState = qs.get('state') || 'hero';
const S = { scene: null, c3d: null, state: 'hero', canvasOn: false, W: 0, H: 0, opener: null, busy: false };
if (reducedMotion) document.documentElement.classList.add('reduced');
if (wantedState !== 'hero') hero.classList.add('instant'); // debug: no transitions

const paper = createPaper({ layer, sheet, page1: $('page1'), page2: $('page2'), title: $('sheetTitle'), qTitle: $('qTitle'), reduced: reducedMotion });
const placeCopy = createHeroLayout({ h1, copy, hero });

// ------------------------------------------------------------------ 3D gating
function skipReason() {
  if (qs.get('nowebgl') === '1') return 'nowebgl (param)';
  if (reducedMotion) return 'prefers-reduced-motion';
  const c = navigator.connection;
  if (c && c.saveData) return 'saveData';
  if (c && /^(slow-)?2g$/.test(c.effectiveType || '')) return '2g';
  if (navigator.deviceMemory && navigator.deviceMemory < 2) return 'deviceMemory<2';
  try {
    const cv = document.createElement('canvas');
    const gl = cv.getContext('webgl2') || cv.getContext('webgl');
    if (!gl) return 'no webgl';
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  } catch { return 'no webgl'; }
  return '';
}

// ------------------------------------------------------------------ poster-stage geometry (pure maths)
function size() { const r = stage.getBoundingClientRect(); S.W = Math.round(r.width); S.H = Math.round(r.height); }
const isMobilePoster = () => matchMedia(MOBILE_MQ).matches;

function layoutPoster() {
  if (!S.scene) return;
  size();
  const hp = heroPose(S.scene, S.W, S.H, isMobilePoster());
  // portrait camera differs from the poster camera by a pure rotation + zoom: re-project the poster so the board is big enough
  poster.style.transform = hp.portrait ? reprojectMatrix(posterPose(S.scene, S.W, S.H, true), hp, S.W, S.H) : '';
  if (!S.canvasOn || S.state !== 'hero') {
    if (S.state === 'hero') placeCopy(projectAll(hp, S.W, S.H, boardCorners(S.scene)), S.W, S.H);
  }
}

function paperQuad() {
  if (S.c3d && S.canvasOn) return S.c3d.projectPaperCorners();
  return projectAll(deskPose(S.scene, S.W, S.H), S.W, S.H, paperCorners(S.scene));
}

// ------------------------------------------------------------------ 3D lifecycle
function afterLoadIdle(cb) {
  const run = () => ('requestIdleCallback' in window ? requestIdleCallback(cb, { timeout: 2500 }) : setTimeout(cb, 200));
  document.readyState === 'complete' ? run() : addEventListener('load', run, { once: true });
}

async function start3D() {
  try {
    const mod = await import('../scene/classroom3d.js?v=bcf57cddb0');   // pulls three via the import map
    const startAt = wantedState === 'hero' ? 'hero' : 'desk';
    S.c3d = await mod.init({
      container: stage, canvas, sceneData: S.scene, startAt,
      glbUrl: 'assets/3d/classroom.glb', dracoPath: 'vendor/three/addons/libs/draco/gltf/',
      onFrame: ({ mode }) => { if (S.canvasOn && S.state === 'hero' && mode === 'hero') placeCopy(S.c3d.projectBoard(), S.W, S.H); },
    });
    S.c3d.renderOnce();
    await raf(); await raf();                               // first frame is on screen, camera == poster camera
    S.canvasOn = true;
    hero.classList.add('canvas-on');
    if (!reducedMotion) setTimeout(() => S.c3d && S.c3d.setBreath(S.state === 'hero' ? 1 : 0), 900);
    document.documentElement.dataset.mode = '3d';
  } catch (err) {
    console.warn('3D unavailable, staying on poster:', err);
    S.c3d = null; S.canvasOn = false; document.documentElement.dataset.mode = 'poster';
  }
}

const loadDeskPoster = () => { if (!posterDesk.src) posterDesk.src = posterDesk.dataset.src; };

// ------------------------------------------------------------------ CTA -> desk -> paper
async function openPaper({ instant = false } = {}) {
  if (S.busy || S.state !== 'hero') return;
  S.busy = true; S.opener = document.activeElement;
  hero.classList.add('away'); document.body.classList.add('leaving');   // copy + nav fade out (<= 200 ms) while the camera starts moving
  nav.inert = true; heroUi.inert = true;
  S.state = 'flying';
  if (S.c3d && S.canvasOn) await S.c3d.goToDesk(instant ? 1 : DOLLY_MS);
  // the desk poster is aligned with Cam_Desk: crossfade to it (sharper than the low-res baked desk texture; also the no-WebGL path)
  loadDeskPoster();
  try { await posterDesk.decode(); } catch { /* fall through */ }
  hero.classList.add('desk-poster');
  await wait(instant ? 0 : reducedMotion ? 220 : 650);
  size();
  const quad = paperQuad();
  hero.classList.add('dim');
  document.body.classList.add('sheet-open');
  await paper.lift(quad, S.W, S.H, { instant });
  S.state = 'paper';
  $('sheetTitle').focus({ preventScroll: true });
  S.busy = false;
}

async function closePaper() {
  if (S.busy || (S.state !== 'paper' && S.state !== 'page2')) return;
  S.busy = true;
  hero.classList.remove('dim');
  document.body.classList.remove('sheet-open');
  size();
  await paper.lower(paperQuad());
  S.state = 'flying';
  hero.classList.remove('desk-poster');
  if (S.c3d && S.canvasOn) await S.c3d.goToHero(DOLLY_MS);
  else await wait(reducedMotion ? 220 : 650);
  S.state = 'hero';
  nav.inert = false; heroUi.inert = false;
  hero.classList.remove('away'); document.body.classList.remove('leaving');
  (S.opener && S.opener.isConnected ? S.opener : $('hero-cta')).focus({ preventScroll: true });
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
$('hero').addEventListener('click', (e) => { if (e.target.closest('a[href="#privasi"]')) e.preventDefault(); });

// ------------------------------------------------------------------ boot
async function boot() {
  document.fonts.load('700 40px Caveat').then(() => { invalidateMetrics(); layoutPoster(); }).catch(() => {});
  S.scene = await (await fetch('assets/3d/scene.json')).json();
  layoutPoster();
  performance.mark('copy-ready'); hero.classList.add('ready');   // copy shows right away; it re-lays out when the font arrives
  new ResizeObserver(() => { layoutPoster(); if (S.state === 'paper' || S.state === 'page2') { /* sheet re-centres on next open */ } }).observe(stage);
  document.fonts.ready.then(() => { invalidateMetrics(); layoutPoster(); });

  const reason = skipReason();
  document.documentElement.dataset.mode = reason ? 'poster' : 'pending';
  if (reason) console.info('3D skipped:', reason);
  afterLoadIdle(loadDeskPoster);
  if (!reason) afterLoadIdle(async () => { await start3D(); await applyDebug(); });
  else await applyDebug();
}

async function applyDebug() {
  if (wantedState === 'hero') { document.documentElement.dataset.ready = '1'; return; }
  if (S.c3d) S.c3d.jumpTo('desk');
  if (wantedState === 'desk') {
    hero.classList.add('away'); document.body.classList.add('leaving'); S.state = 'desk';
    loadDeskPoster(); try { await posterDesk.decode(); } catch {}
    hero.classList.add('desk-poster');
    await wait(300); hero.classList.remove('instant'); document.documentElement.dataset.ready = '1'; return;
  }
  await openPaper({ instant: true });
  if (wantedState === 'page2') { await paper.flip(true, { instant: true }); S.state = 'page2'; }
  await wait(300);
  hero.classList.remove('instant');
  document.documentElement.dataset.ready = '1';
}

boot();
