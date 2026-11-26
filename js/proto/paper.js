// The HTML paper sheet: lifts off the desk (matrix3d homography from the projected paper corners to a centred sheet),
// page flip to question 1, and the reverse. Needs no three.js.
import { homography, matrix3d, rectCorners, lerpQuad, easeOut, easeInOut } from '../scene/camera-math.js?v=bcf57cddb0';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function createPaper({ layer, sheet, page1, page2, title, qTitle, reduced }) {
  let geo = { x: 0, y: 0, w: 560, h: 700 };
  let flipped = false;

  function measure(W, H) {
    const w = Math.min(560, W - 32);
    sheet.style.setProperty('--sw', w + 'px');
    sheet.style.setProperty('--sh', '10px');
    sheet.style.visibility = 'hidden';
    layer.hidden = false;
    const content = page1.scrollHeight;
    const h = Math.round(Math.min(H - 32, Math.max(content, w * 1.2)));
    sheet.style.setProperty('--sh', h + 'px');
    sheet.style.visibility = '';
    geo = { w, h, x: Math.round((W - w) / 2), y: Math.round((H - h) / 2) };
    return geo;
  }
  const put = (quad) => { sheet.style.transform = matrix3d(homography(rectCorners(0, 0, geo.w, geo.h), quad)); };
  const settle = () => { sheet.style.transform = `translate(${geo.x}px,${geo.y}px)`; sheet.style.setProperty('--content', 1); };

  function animate(dur, fn) {
    return new Promise((res) => {
      const t0 = performance.now();
      const step = (now) => { const k = Math.min(1, (now - t0) / dur); fn(k); k < 1 ? requestAnimationFrame(step) : res(); };
      requestAnimationFrame(step);
    });
  }

  // from: projected paper corners (px in the hero box)
  async function lift(from, W, H, { instant = false } = {}) {
    measure(W, H);
    const end = rectCorners(geo.x, geo.y, geo.w, geo.h);
    sheet.style.setProperty('--content', 0);
    sheet.style.opacity = 1;
    if (instant) { settle(); return; }
    if (reduced) {
      settle(); sheet.style.opacity = 0; sheet.style.transition = 'opacity .2s';
      await wait(20); sheet.style.opacity = 1; await wait(220); sheet.style.transition = ''; return;
    }
    put(from);
    await animate(900, (k) => {
      const e = easeOut(k);
      put(lerpQuad(from, end, e));
      sheet.style.setProperty('--content', Math.max(0, Math.min(1, (k - 0.4) / 0.5)).toFixed(3));
    });
    settle();
  }

  async function lower(to, { instant = false } = {}) {
    const start = rectCorners(geo.x, geo.y, geo.w, geo.h);
    if (!instant && !reduced) {
      await animate(600, (k) => {
        const e = easeInOut(k);
        put(lerpQuad(start, to, e));
        sheet.style.setProperty('--content', Math.max(0, 1 - k * 2.2).toFixed(3));
      });
    } else if (reduced) {
      sheet.style.transition = 'opacity .2s'; sheet.style.opacity = 0; await wait(220); sheet.style.transition = '';
    }
    layer.hidden = true;
    resetFlip();
  }

  function resetFlip() {
    sheet.classList.remove('flipped', 'flipping', 'flip-done');
    page1.inert = false; page2.inert = true; flipped = false;
  }

  async function flip(to2, { instant = false } = {}) {
    if (to2 === flipped) return;
    flipped = to2;
    if (to2) {
      page2.inert = false;
      if (instant || reduced) { sheet.classList.add('flipped', 'flip-done'); } else {
        sheet.classList.add('flipping', 'flipped'); await wait(620);
        sheet.classList.remove('flipping'); sheet.classList.add('flip-done');
      }
      page1.inert = true; qTitle.focus({ preventScroll: true });
    } else {
      sheet.classList.remove('flip-done'); void sheet.offsetWidth;
      page1.inert = false;
      if (instant || reduced) { sheet.classList.remove('flipped'); } else {
        sheet.classList.add('flipping'); sheet.classList.remove('flipped'); await wait(620); sheet.classList.remove('flipping');
      }
      page2.inert = true; title.focus({ preventScroll: true });
    }
  }

  function trap(e) {
    if (e.key !== 'Tab') return;
    const els = [...sheet.querySelectorAll(FOCUSABLE)].filter((el) => !el.closest('[inert]') && el.offsetParent !== null);
    if (!els.length) return;
    const first = els[0], last = els[els.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === sheet || document.activeElement === title)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  return { measure, lift, lower, flip, trap, get geo() { return geo; }, get flipped() { return flipped; } };
}
