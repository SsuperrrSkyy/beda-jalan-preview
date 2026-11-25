import { deskPhotoPose, deskSheetHeight, homography, matrix3d, paperCorners, projectAll, rectCorners } from '../scene/camera-math.js?v=55928db09c';

// The photograph and the DOM sheet share the same camera projection. Resize the
// photograph first, then apply that exact screen-space mapping to its paper corners.
export function createDeskPaper({ hero, poster, layer, sheet }) {
  let anchor;

  function layout() {
    if (layer.hidden) return;
    const { clientWidth: width, clientHeight: height } = layer;
    if (!width || !height) return;
    const { quad, photoW, photoH, scene } = anchor;
    const { x: left, y: top } = quad[0];
    const { x: right, y: bottom } = quad[2];
    const widest = right - quad[3].x;
    // The photo is taken from straight above, so the sheet is a plain rectangle. One scale for both axes,
    // shared with the 3D desk camera (deskSheetHeight) so the live view and the photo line up exactly.
    const scale = deskSheetHeight(scene, width, height) / (bottom - top);
    const paperH = (bottom - top) * scale;
    const paperW = widest * scale;
    const centerX = width / 2;
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

  // show one page of the sheet (kop, question or Peta Minat); the others stay hidden and inert
  function showPage(page, title) {
    for (const p of sheet.querySelectorAll(':scope > .page:not(.ghost)')) p.hidden = p.inert = p !== page;
    page.scrollTop = 0;
    sheet.setAttribute('aria-labelledby', title.id);
  }

  function open(scene) {
    const photoW = poster.naturalWidth || poster.width;
    const photoH = poster.naturalHeight || poster.height;
    anchor = { scene, photoW, photoH, quad: projectAll(deskPhotoPose(scene, photoW, photoH), photoW, photoH, paperCorners(scene)) };
    hero.classList.add('paper-on-desk');
    layer.hidden = false;
    layout();
  }

  function close() {
    layer.hidden = true;
    hero.classList.remove('paper-on-desk');
  }

  function trap(event) {
    if (event.key !== 'Tab') return;
    const page = sheet.querySelector(':scope > .page:not([hidden]):not(.ghost)');
    if (!page) return;
    const controls = [...page.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), details > summary:first-child')].filter(el => !el.closest('[hidden]'));
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
  return { open, close, showPage, trap };
}
