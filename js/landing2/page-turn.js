// Page turn for the exam sheet. The sheets are stapled at the top-left: the bottom-right corner lifts, the page rolls
// over toward the staple and uncovers the next page. Turning back plays the same motion in reverse.
// Everything is drawn in the sheet's own pixel space, so it rides the matrix3d that lays the sheet on the desk.
//   top page   : the page that turns, clipped to the part still lying flat
//   flap       : the back of the lifted part (the folded region mirrored across the fold line), with a curl gradient
//   shade      : the shadow the lifted paper throws on the page beneath, strongest at the fold
const NS = 'http://www.w3.org/2000/svg';
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const f = (n) => n.toFixed(1);

// keep the part of polygon `poly` where side(p) has the wanted sign (Sutherland-Hodgman against one line)
function clipHalf(poly, side, keepPos) {
  const out = [], sgn = keepPos ? 1 : -1;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const da = side(a) * sgn, db = side(b) * sgn;
    if (da >= 0) out.push(a);
    if ((da >= 0) !== (db >= 0)) { const k = da / (da - db); out.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]); }
  }
  return out;
}
const pts = (poly) => poly.map((p) => `${f(p[0])},${f(p[1])}`).join(' ');

function svg(cls) {
  const s = document.createElementNS(NS, 'svg');
  s.setAttribute('class', `turn-fx ${cls}`);
  s.setAttribute('aria-hidden', 'true');
  s.setAttribute('focusable', 'false');
  s.style.display = 'none';
  return s;
}

export function createPageTurn(sheet, { reduced = false } = {}) {
  const shade = svg('turn-shade'), flap = svg('turn-flap');
  shade.innerHTML = `<defs><linearGradient id="ptShadeG" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#3c2a12" stop-opacity=".34"/><stop offset=".35" stop-color="#3c2a12" stop-opacity=".12"/><stop offset="1" stop-color="#3c2a12" stop-opacity="0"/>
    </linearGradient></defs><polygon fill="url(#ptShadeG)"/>`;
  // the back of the paper: a crease shadow right at the fold, a bright roll, then the plain back, a touch darker at the edge
  flap.innerHTML = `<defs><linearGradient id="ptFlapG" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#cfc5b1"/><stop offset=".035" stop-color="#fffdf7"/><stop offset=".16" stop-color="#f4eee1"/>
      <stop offset=".6" stop-color="#ebe4d4"/><stop offset="1" stop-color="#ddd4c1"/>
    </linearGradient></defs><polygon fill="url(#ptFlapG)"/>`;
  sheet.append(shade, flap);
  const shadeG = shade.querySelector('linearGradient'), shadeP = shade.querySelector('polygon');
  const flapG = flap.querySelector('linearGradient'), flapP = flap.querySelector('polygon');
  let busy = false;

  const activePage = () => sheet.querySelector(':scope > .page:not([hidden]):not(.ghost)');
  function snapshot(page) {
    const g = page.cloneNode(true);          // cloning keeps typed values and checked radios
    g.removeAttribute('id');
    g.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
    g.classList.add('ghost');
    g.hidden = false; g.inert = true; g.setAttribute('aria-hidden', 'true');
    return g;
  }

  // corner path: up first (the bottom edge rolls up), then over toward the staple. It ends with the page mirrored
  // across the staple's diagonal, i.e. fully turned. |P| never exceeds the corner's distance to the staple.
  function frame(t, W, H, top) {
    const C = [W, H], Q = [W * 0.78, -H * 0.2], E = [-H, -W];
    const u = 1 - t;
    const P = [u * u * C[0] + 2 * u * t * Q[0] + t * t * E[0], u * u * C[1] + 2 * u * t * Q[1] + t * t * E[1]];
    const d = [C[0] - P[0], C[1] - P[1]], len = Math.hypot(d[0], d[1]) || 1e-6;
    const n = [d[0] / len, d[1] / len], M = [(C[0] + P[0]) / 2, (C[1] + P[1]) / 2];
    const side = (p) => (p[0] - M[0]) * n[0] + (p[1] - M[1]) * n[1];
    const rect = [[0, 0], [W, 0], [W, H], [0, H]];
    const flat = clipHalf(rect, side, false), lifted = clipHalf(rect, side, true);
    const mirrored = lifted.map((p) => { const s = 2 * side(p); return [p[0] - s * n[0], p[1] - s * n[1]]; });
    const reach = Math.max(1, ...lifted.map(side));

    top.style.clipPath = flat.length > 2 ? `polygon(${flat.map((p) => `${f(p[0])}px ${f(p[1])}px`).join(',')})` : 'polygon(0 0,0 0,0 0)';
    flapP.setAttribute('points', pts(mirrored));
    flapG.setAttribute('x1', f(M[0])); flapG.setAttribute('y1', f(M[1]));
    flapG.setAttribute('x2', f(M[0] - n[0] * reach)); flapG.setAttribute('y2', f(M[1] - n[1] * reach));
    shadeP.setAttribute('points', pts(lifted));
    const sw = Math.min(W * 0.22, 26 + len * 0.18);
    shadeG.setAttribute('x1', f(M[0])); shadeG.setAttribute('y1', f(M[1]));
    shadeG.setAttribute('x2', f(M[0] + n[0] * sw)); shadeG.setAttribute('y2', f(M[1] + n[1] * sw));
    // the fully turned page leaves the frame: fade it over the last stretch
    const fade = Math.min(1, Math.max(0, (1 - t) / 0.28));
    flap.style.opacity = fade.toFixed(3);
    shade.style.opacity = Math.min(1, t / 0.08, fade).toFixed(3);
  }

  function run(dur, fn) {
    return new Promise((res) => {
      const t0 = performance.now();
      const step = (now) => { const k = Math.min(1, (now - t0) / dur); fn(k); k < 1 ? requestAnimationFrame(step) : res(); };
      requestAnimationFrame(step);
    });
  }

  // update() swaps the sheet to the new page; dir 1 = forward (the old page turns away), -1 = back (the page comes back)
  // hold (debug, ?turnhold=0.4): stop at that point of the turn and leave it on screen
  async function turn(update, dir = 1, { dur = 760, hold = null } = {}) {
    if (busy) return false;
    busy = true;
    const from = activePage();
    const ghost = from ? snapshot(from) : null, scroll = from ? from.scrollTop : 0;
    update();
    const to = activePage();
    if (!ghost || !to || sheet.closest('[hidden]')) { busy = false; return true; }
    sheet.classList.add('turning');
    if (reduced) {
      sheet.append(ghost); ghost.scrollTop = scroll;
      await run(200, (k) => { ghost.style.opacity = (1 - k).toFixed(3); });
    } else {
      const W = sheet.offsetWidth, H = sheet.offsetHeight;
      const top = dir > 0 ? ghost : to;
      dir > 0 ? sheet.insertBefore(ghost, shade) : sheet.prepend(ghost);
      ghost.scrollTop = scroll;
      top.classList.add('turn-top');
      for (const s of [shade, flap]) { s.setAttribute('viewBox', `0 0 ${W} ${H}`); s.style.display = ''; }
      frame(dir > 0 ? 0 : 1, W, H, top);
      if (hold != null) { frame(dir > 0 ? hold : 1 - hold, W, H, top); return true; }
      await run(dur, (k) => { const e = easeInOut(k); frame(dir > 0 ? e : 1 - e, W, H, top); });
      top.classList.remove('turn-top');
      top.style.clipPath = '';
      for (const s of [shade, flap]) s.style.display = 'none';
    }
    ghost.remove();
    sheet.classList.remove('turning');
    busy = false;
    return true;
  }

  return { turn, get busy() { return busy; } };
}
