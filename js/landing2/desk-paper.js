import { deskPose, homography, matrix3d, paperCorners, projectAll, rectCorners } from '../scene/camera-math.js';

// The photograph and the DOM sheet share the same camera projection. Resize the
// photograph first, then apply that exact screen-space mapping to its paper corners.
export function createDeskPaper({ hero, poster, layer, sheet, page1, page2, title, qTitle }) {
  let anchor;

  function layout() {
    if (layer.hidden) return;
    const { clientWidth: width, clientHeight: height } = layer;
    if (!width || !height) return;
    const { quad, photoW, photoH } = anchor;
    const { x: left, y: top } = quad[0];
    const { x: right, y: bottom } = quad[2];
    const widest = right - quad[3].x;
    const narrow = width < 640;
    // One scale for both axes: preserve the proportions of the physical paper.
    const scale = Math.min(816 / (bottom - top), height * .94 / (bottom - top),
      680 / widest, (width - (narrow ? 30 : 70)) / widest);
    const paperH = (bottom - top) * scale;
    const paperW = widest * scale;
    const centerX = width / 2 - (narrow ? 5 : 0);
    const x = centerX - photoW / 2 * scale;
    const y = height / 2 - (top + bottom) / 2 * scale;
    const projected = quad.map(p => ({ x: x + p.x * scale, y: y + p.y * scale }));
    const topWidth = (quad[1].x - left) * scale;
    const contentW = Math.round((topWidth + paperW) / 2);
    const contentH = Math.round(paperH);

    poster.style.setProperty('--desk-x', `${x}px`);
    poster.style.setProperty('--desk-y', `${y}px`);
    poster.style.setProperty('--desk-w', `${photoW * scale}px`);
    poster.style.setProperty('--desk-h', `${photoH * scale}px`);
    sheet.style.setProperty('--sw', `${contentW}px`);
    sheet.style.setProperty('--sh', `${contentH}px`);
    sheet.style.transform = matrix3d(homography(rectCorners(0, 0, contentW, contentH), projected));
  }

  function showQuestion(question) {
    const activeTitle = question ? qTitle : title;
    page1.hidden = page1.inert = question;
    page2.hidden = page2.inert = !question;
    (question ? page2 : page1).scrollTop = 0;
    sheet.setAttribute('aria-labelledby', activeTitle.id);
    activeTitle.focus({ preventScroll: true });
  }

  function open(scene) {
    const photoW = poster.naturalWidth || poster.width;
    const photoH = poster.naturalHeight || poster.height;
    anchor = { photoW, photoH, quad: projectAll(deskPose(scene, photoW, photoH), photoW, photoH, paperCorners(scene)) };
    hero.classList.add('paper-on-desk');
    layer.hidden = false;
    layout();
    showQuestion(false);
  }

  function close() {
    layer.hidden = true;
    hero.classList.remove('paper-on-desk');
    showQuestion(false);
  }

  function trap(event) {
    if (event.key !== 'Tab') return;
    const page = page1.hidden ? page2 : page1;
    const controls = [...page.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), details > summary:first-child')];
    const radios = controls.filter(el => el.type === 'radio');
    const activeRadio = radios.find(el => el.checked) || radios[0];
    const stops = controls.filter(el => el.type !== 'radio' || el === activeRadio);
    const focused = document.activeElement;
    const boundary = event.shiftKey ? stops.at(-1) : stops[0];
    if (!stops.includes(focused) || focused === (event.shiftKey ? stops[0] : stops.at(-1))) {
      event.preventDefault();
      boundary?.focus();
    }
  }

  new ResizeObserver(layout).observe(hero);
  return { open, close, showQuestion, trap };
}
