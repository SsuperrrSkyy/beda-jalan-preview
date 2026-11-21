// Constellation ornaments around the two headline words (IPA: science, IPS: social studies).
// Each word gets two SVG layers in em units centred on it: `.orn-back` (behind the letters) and `.orn-front` (over them).
// Coordinates: 1em = 100 units, (0,0) = centre of the word; capitals span roughly y -36..36.
// Two layouts are available while the owner compares them: ?orn=1 (halo arc) and ?orn=2 (orbit ring). Default 1.

// ---- one icon set, all drawn on a 40-unit box: lines + star nodes
const E = (rx, ry, rot = 0) => ({ d: `M${-rx} 0a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0`, t: rot ? `rotate(${rot})` : '' });
const rot = (x, y, a) => { const r = (a * Math.PI) / 180; return [x * Math.cos(r) - y * Math.sin(r), x * Math.sin(r) + y * Math.cos(r)]; };
const dnaStrand = (ph) => { let d = ''; for (let i = 0; i <= 16; i++) { const y = -19 + (38 * i) / 16, x = 7.5 * Math.sin((y / 19) * Math.PI * 1.15 + ph); d += `${i ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`; } return d; };
const dnaX = (y, ph) => 7.5 * Math.sin((y / 19) * Math.PI * 1.15 + ph);

const ICONS = {
  atom: {
    lines: [E(18, 6.5), E(18, 6.5, 60), E(18, 6.5, -60)],
    stars: [[0, 0, 3.6], [...rot(18, 0, 0), 2.2], [...rot(-18, 0, 60), 2.2], [...rot(18, 0, -60), 2.2]],
  },
  dna: {
    lines: [{ d: dnaStrand(0) }, { d: dnaStrand(Math.PI) },
      { d: [-13, -6.5, 0, 6.5, 13].map((y) => `M${dnaX(y, 0).toFixed(2)} ${y}L${dnaX(y, Math.PI).toFixed(2)} ${y}`).join('') }],
    stars: [[dnaX(-19, 0), -19, 2.6], [dnaX(-19, Math.PI), -19, 2], [dnaX(19, 0), 19, 2], [dnaX(19, Math.PI), 19, 2.6], [0, 0, 1.8]],
  },
  flask: {
    lines: [{ d: 'M-6 -19H6M-3.5 -19V-6L-15 13.5Q-16.5 18 -12 18H12Q16.5 18 15 13.5L3.5 -6V-19' }, { d: 'M-9.6 4.5H9.6' }],
    stars: [[-6, -19, 2.2], [6, -19, 2.2], [-15, 14, 2.4], [15, 14, 2.4], [-2.5, 11, 1.5], [3.5, 8, 1.2]],
  },
  globe: {
    lines: [E(17, 17), E(7.5, 17), { d: 'M-17 0H17M-14.4 -9H14.4M-14.4 9H14.4' }],
    stars: [[0, -17, 2.4], [0, 17, 2.4], [-17, 0, 2.2], [17, 0, 2.2], [7.5, 0, 1.4], [-7.5, 0, 1.4]],
  },
  compass: {
    lines: [{ d: 'M0 -19L4.5 -4.5L19 0L4.5 4.5L0 19L-4.5 4.5L-19 0L-4.5 -4.5Z' }, E(9.5, 9.5), { d: 'M0 -4.5V4.5' }],
    stars: [[0, -19, 2.8], [19, 0, 2], [0, 19, 2], [-19, 0, 2], [0, 0, 1.6]],
  },
  book: {
    lines: [{ d: 'M0 -10Q-9 -15 -18 -12V13Q-9 10 0 15Q9 10 18 13V-12Q9 -15 0 -10ZM0 -10V15' },
      { d: 'M-14 -5Q-8.5 -7.5 -4 -4.5M-14 1Q-8.5 -1.5 -4 1.5M4 -4.5Q8.5 -7.5 14 -5M4 1.5Q8.5 -1.5 14 1' }],
    stars: [[-18, -12, 2.2], [18, -12, 2.2], [-18, 13, 2], [18, 13, 2], [0, 15, 2.4], [0, -10, 1.8]],
  },
};
const SETS = { ipa: ['dna', 'atom', 'flask'], ips: ['compass', 'globe', 'book'] };

const f = (n) => +n.toFixed(2);
function icon(name, x, y, s, delay, cls = '') {
  const ic = ICONS[name];
  const lines = ic.lines.map((l, i) => `<path class="ln" pathLength="1" d="${l.d}"${l.t ? ` transform="${l.t}"` : ''} style="--d:${(delay + i * 0.18).toFixed(2)}s"/>`).join('');
  const stars = ic.stars.map(([sx, sy, r], i) => `<circle class="st" cx="${f(sx)}" cy="${f(sy)}" r="${r}" style="--d:${(delay + 0.4 + i * 0.23).toFixed(2)}s"/>`).join('');
  return `<g class="oi ${cls}" transform="translate(${f(x)} ${f(y)}) scale(${s})" style="--sc:${s}">${lines}<g class="sts">${stars}</g></g>`;
}
// a four-point sparkle
const spark = (x, y, r, d) => `<path class="sp" d="M${f(x)} ${f(y - r)}Q${f(x + r * 0.18)} ${f(y - r * 0.18)} ${f(x + r)} ${f(y)}Q${f(x + r * 0.18)} ${f(y + r * 0.18)} ${f(x)} ${f(y + r)}Q${f(x - r * 0.18)} ${f(y + r * 0.18)} ${f(x - r)} ${f(y)}Q${f(x - r * 0.18)} ${f(y - r * 0.18)} ${f(x)} ${f(y - r)}Z" style="--d:${d}s"/>`;
const svg = (cls, body) => `<svg class="orn ${cls}" viewBox="-180 -110 360 220" aria-hidden="true" focusable="false">${body}</svg>`;

// ---- Plan 1: a constellation halo over each word, icons set into the arc
function halo(word, hw, side, compact) {
  // compact (phones): the side icons climb to the word's shoulders so nothing crowds "atau"
  const rx = hw + (compact ? 18 : 36), ry = compact ? 72 : 68, cy = 6;
  const P = (deg) => { const a = (deg * Math.PI) / 180; return [rx * Math.cos(a), cy - ry * Math.sin(a)]; };
  const at = compact ? [141, 90, 39] : [160, 90, 20], gap = compact ? 17 : 15, ends = compact ? [196, -16] : [212, -32];
  const cuts = [ends[0], at[0] + gap, at[0] - gap, at[1] + gap, at[1] - gap, at[2] + gap, at[2] - gap, ends[1]];
  let arcs = '', nodes = '';
  for (let i = 0; i < cuts.length; i += 2) {
    const [a, b] = [cuts[i], cuts[i + 1]], p = P(a), q = P(b);
    arcs += `<path class="ln arc" pathLength="1" d="M${f(p[0])} ${f(p[1])}A${rx} ${ry} 0 0 1 ${f(q[0])} ${f(q[1])}" style="--d:${(0.15 + i * 0.12).toFixed(2)}s"/>`;
    for (let g = a; g >= b - 0.01; g -= (a - b) / Math.max(1, Math.round((a - b) / 13))) {
      const [x, y] = P(g); const edge = g === a || Math.abs(g - b) < 0.5;
      nodes += `<circle class="st" cx="${f(x)}" cy="${f(y)}" r="${edge ? 2.6 : 1.5}" style="--d:${(0.5 + (212 - g) / 90).toFixed(2)}s"/>`;
    }
  }
  // an outer dotted echo of the arc, a touch wider
  const o1 = P(205), o2 = P(-25);
  const echo = `<path class="dots" d="M${f(o1[0] * 1.08)} ${f(o1[1] - 6)}A${f(rx * 1.08)} ${ry + 12} 0 1 1 ${f(o2[0] * 1.08)} ${f(o2[1] - 6)}"/>`;
  const icons = SETS[word].map((n, i) => { const [x, y] = P(at[i]); return icon(n, x, y, (i === 1 ? 0.95 : 0.82) * (compact ? 1.08 : 1), 0.6 + i * 0.35); }).join('');
  const sx = compact ? 4 : 22;
  const sparks = [spark(-hw - sx, 38 + (compact ? 14 : 0), 5, 1.1), spark(hw + sx + 2, 40 + (compact ? 14 : 0), 4, 2.3), spark(-hw * 0.45, -86, 3.6, 0.4), spark(hw * 0.5, -84, 4.4, 1.7)].join('');
  return { back: '', front: `<g class="halo">${echo}${arcs}<g class="sts">${nodes}</g>${icons}${sparks}</g>` };
}

// ---- Plan 2: a tilted orbit ring through each word; the icons ride it, passing behind and in front of the letters
function ring(word, hw, side, compact) {
  const rx = hw + (compact ? 24 : 44), ry = compact ? 27 : 30, cy = 8, tilt = side * (compact ? 9 : 10);
  const G = (body) => `<g transform="rotate(${tilt} 0 ${cy})">${body}</g>`;
  const ell = (k) => `M${-rx * k} ${cy}a${rx * k} ${ry * k} 0 1 0 ${2 * rx * k} 0a${rx * k} ${ry * k} 0 1 0 ${-2 * rx * k} 0`;
  const node = (deg, r, d) => { const a = (deg * Math.PI) / 180; return `<circle class="st" cx="${f(rx * Math.cos(a))}" cy="${f(cy - ry * Math.sin(a))}" r="${r}" style="--d:${d}s"/>`; };
  const backNodes = [30, 70, 110, 150].map((g, i) => node(g, 1.6, 0.6 + i * 0.4)).join('');
  const frontNodes = [200, 235, 270, 305, 340].map((g, i) => node(g, g === 270 ? 2.8 : 2, 0.9 + i * 0.3)).join('');
  const orbit = `M${rx} ${cy}A${rx} ${ry} 0 1 0 ${-rx} ${cy}A${rx} ${ry} 0 1 0 ${rx} ${cy}`;   // starts right, goes over the top (behind) first
  const dur = 27, keys = '0;0.47;0.53;0.97;1';
  const rider = (n, i, front) => {
    const begin = -(dur * i) / 3 - dur * 0.18;
    const op = front ? '0;0;1;1;0' : '0.7;0.7;0;0;0.7';
    return `<g class="rider"><g><animateMotion dur="${dur}s" begin="${begin}s" repeatCount="indefinite" path="${orbit}"/>`
      + `<animate attributeName="opacity" values="${op}" keyTimes="${keys}" dur="${dur}s" begin="${begin}s" repeatCount="indefinite"/>`
      + `<g transform="rotate(${-tilt})">${icon(n, 0, 0, (front ? 0.64 : 0.54) * (compact ? 1.25 : 1), 0, 'still')}</g></g></g>`;
  };
  const back = G(`<path class="ln ringb" pathLength="1" d="${ell(1)}" style="--d:.1s"/><path class="dots" d="${ell(0.86)}"/><g class="sts">${backNodes}</g>`
    + SETS[word].map((n, i) => rider(n, i, false)).join(''));
  const front = G(`<path class="ln ringf" pathLength="1" d="M${-rx} ${cy}A${rx} ${ry} 0 0 0 ${rx} ${cy}" style="--d:.35s"/><g class="sts">${frontNodes}</g>`
    + SETS[word].map((n, i) => rider(n, i, true)).join(''))
    + [spark(-hw - (compact ? 10 : 34), -44, 4.6, 0.8), spark(hw + (compact ? 8 : 30), -50, 3.8, 2), spark(0, -88, 3.4, 1.4)].join('');
  return { back, front };
}

const isCompact = () => matchMedia('(max-width: 600px), (orientation: portrait)').matches;
export function mountTitleOrnaments(plan = '1', { reduced = false } = {}) {
  const build = plan === '2' ? ring : halo, compact = isCompact();
  for (const w of document.querySelectorAll('#h1Words .w')) {
    w.querySelectorAll('.orn').forEach((n) => n.remove());
    const word = w.classList.contains('w-ipa') ? 'ipa' : 'ips';
    const t = w.querySelector('.wt'), fs = parseFloat(getComputedStyle(w).fontSize) || 100;
    w.style.setProperty('--upx', (100 / fs).toFixed(4));   // SVG units per CSS pixel, so lines keep a fixed pixel width
    const hw = (t.getBoundingClientRect().width / fs) * 50;   // half the word's width in units
    const { back, front } = build(word, hw, word === 'ipa' ? -1 : 1, compact);
    w.insertAdjacentHTML('afterbegin', svg('orn-back', back));
    w.insertAdjacentHTML('beforeend', svg('orn-front', front));
  }
  document.getElementById('h1Words')?.setAttribute('data-orn', plan === '2' ? '2' : '1');
  if (reduced) document.querySelectorAll('#h1Words .orn').forEach((s) => s.pauseAnimations && s.pauseAnimations());
}

// self-start: wait for the headline font so the word widths are right
const qs = new URLSearchParams(location.search);
const plan = qs.get('orn') || '1';
const reduced = qs.get('reduced') === '1' || matchMedia('(prefers-reduced-motion: reduce)').matches;
(document.fonts ? document.fonts.ready : Promise.resolve()).then(() => mountTitleOrnaments(plan, { reduced }));
// the headline size follows the viewport, so keep the pixel line widths right on resize
let wasCompact = isCompact();
addEventListener('resize', () => {
  if (isCompact() !== wasCompact) { wasCompact = isCompact(); mountTitleOrnaments(plan, { reduced }); return; }
  for (const w of document.querySelectorAll('#h1Words .w')) w.style.setProperty('--upx', (100 / (parseFloat(getComputedStyle(w).fontSize) || 100)).toFixed(4));
});
