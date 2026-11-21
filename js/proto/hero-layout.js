// Places the chalk H1 on the projected chalkboard rect and the copy card below it. Pure DOM + the shared projection maths.
let metrics = null;
const LINES = { l1: 'IPA atau IPS?', l2: 'Biar Minatmu yang Jawab.', l2a: 'Biar Minatmu', l2b: 'yang Jawab.' };

function measure() {
  const ctx = document.createElement('canvas').getContext('2d');
  ctx.font = '700 100px Caveat, cursive';
  metrics = {};
  for (const k in LINES) metrics[k] = ctx.measureText(LINES[k]).width / 100; // em
}
export const invalidateMetrics = () => { metrics = null; };

export function createHeroLayout({ h1, copy, hero }) {
  let lastFont = 0, lastLines = '';
  return function layout(corners, W, H) {
    if (!metrics) measure();
    const xs = corners.map((c) => c.x), ys = corners.map((c) => c.y);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const bw = x1 - x0, bh = y1 - y0, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const innerW = bw * 0.92, innerH = bh * 0.74;
    const L1 = 1.22, LH = 0.94;
    const f2 = Math.min(innerW / Math.max(L1 * metrics.l1, metrics.l2), innerH / ((L1 + 1) * LH));
    const f3 = Math.min(innerW / Math.max(L1 * metrics.l1, metrics.l2a, metrics.l2b), innerH / ((L1 + 2) * LH));
    const lines = f2 >= f3 ? '2' : '3';
    const cap = W > 700 ? 76 : 64;
    const font = Math.min(cap, Math.max(f2, f3));
    if (lines !== lastLines) { h1.dataset.lines = lines; lastLines = lines; }
    if (Math.abs(font - lastFont) > 0.25) { h1.style.fontSize = font.toFixed(2) + 'px'; lastFont = font; }
    h1.style.transform = `translate(${cx.toFixed(2)}px,${(cy + bh * 0.015).toFixed(2)}px) translate(-50%,-50%)`;

    // copy card: below the board, centred on it; kept inside the viewport
    const cw = copy.offsetWidth, ch = copy.offsetHeight;
    const gap = W > 700 ? 22 : 16;
    let top = y1 + gap;
    top = Math.min(top, H - ch - 12);
    top = Math.max(top, y1 + 6);
    const left = Math.min(Math.max(cx, cw / 2 + 12), W - cw / 2 - 12);
    copy.style.transform = `translate(${left.toFixed(2)}px,${top.toFixed(2)}px) translateX(-50%)`;
    return { font, lines, board: { x0, y0, x1, y1 } };
  };
}
