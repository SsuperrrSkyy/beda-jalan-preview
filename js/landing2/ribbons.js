// Two ribbons (teal = IPA, gold = IPS) that fly in from the sides as the students move together: each wraps its
// own student, then the two braid together where their backs meet and rise into the light.
// Drawn with Canvas 2D on two canvases: segments that pass behind the students go to `back` (under the characters canvas), segments in front go to `front` (over it).
const RIBBONS = [
  { from: -1, base: [46, 181, 192], light: [190, 250, 246], dark: [16, 104, 118], ry: 1.0, dy: -0.04, twist: 0.021, speed: 1.15 },
  { from: +1, base: [243, 181, 74], light: [255, 243, 200], dark: [168, 102, 30], ry: 0.82, dy: 0.07, twist: 0.018, speed: -0.95 },
];
const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a.toFixed(3)})`;
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// Catmull-Rom through control points; each point carries [x, y, depth] (depth 1 = in front of the students)
function spline(pts, perSeg) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 0; k < perSeg; k++) {
      const t = k / perSeg, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1]), p1[2] + (p2[2] - p1[2]) * t]);
    }
  }
  out.push(pts[pts.length - 1].slice());
  return out;
}

export function createRibbons({ back, front }) {
  const cb = back.getContext('2d'), cf = front.getContext('2d');
  const st = { W: 1, H: 1, dpr: 1 };

  function resize() {
    const r = back.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = Math.max(2, Math.round(r.width * dpr)), h = Math.max(2, Math.round(r.height * dpr));
    for (const c of [back, front]) if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    st.W = r.width; st.H = r.height; st.dpr = dpr;
  }

  // control points for one ribbon (each point is [x, y, depth]). The story it tells:
  // teal (IPA) flies in from the left and wraps the boy, gold (IPS) from the right wraps the girl ("beda jalan");
  // both then run to the point where their backs meet and braid together, rising into the light ("satu tujuan").
  function path(rb, bodies) {
    const { boy, girl } = bodies;
    const s = rb.from, own = s < 0 ? boy : girl;
    const X = { x: (boy.back + girl.back) / 2, y: (boy.chest.y + girl.chest.y) / 2 };
    const R = Math.max(boy.height, girl.height);
    const c = own.chest, r = own.halfW * 1.3, ry = R * 0.06 * rb.ry;
    const out = c.x + s * r, inn = c.x - s * r;
    const W = st.W, b = R * 0.032, f = s < 0 ? 1 : 0;      // braid width; which ribbon is in front at each crossing
    const pts = [
      [s < 0 ? -0.12 * W : 1.12 * W, c.y + R * 0.28, 1], [out + s * r * 1.3, c.y + R * 0.13, 1],
      // one loop around its own student, rising: front, inner side, behind, outer side, front
      [out, c.y + ry, 0.8], [c.x, c.y + ry * 1.3, 1], [inn, c.y + ry * 0.4, 0.55], [c.x, c.y - ry * 0.3, 0],
      [out, c.y - ry * 0.7, 0.4], [c.x, c.y - ry * 1.2, 1],
      // to where their backs meet, then braid upward together
      [X.x + s * b * 1.2, X.y - R * 0.05, 0.8],
      [X.x - s * b, X.y - R * 0.11, f], [X.x + s * b, X.y - R * 0.17, 1 - f], [X.x - s * b * 0.8, X.y - R * 0.23, f],
      [X.x + s * b * 0.55, X.y - R * 0.29, 1 - f], [X.x - s * b * 0.25, X.y - R * 0.34, f], [X.x, X.y - R * 0.38, 0.5],
    ];
    return spline(pts, 18);
  }

  // progress 0..1 reveals the ribbon from its entry end; light brightens it; fade 0..1 hides it in the flash
  function draw(t, { progress = 0, light = 0, fade = 0, bodies }) {
    resize();
    const { dpr } = st;
    for (const c of [cb, cf]) { c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, back.width, back.height); c.setTransform(dpr, 0, 0, dpr, 0, 0); }
    if (!bodies || progress <= 0.001 || fade >= 0.999) return;
    const alpha = 1 - fade;
    for (const rb of RIBBONS) {
      const p = path(rb, bodies);
      // arclength
      const L = [0]; for (let i = 1; i < p.length; i++) L.push(L[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]));
      const total = L[L.length - 1], head = total * Math.min(1, progress * 1.02);
      const width = Math.max(9, Math.min(22, bodies.boy.height * 0.03));
      // flutter: a travelling wave across the ribbon
      const pts = [];
      for (let i = 0; i < p.length && L[i] <= head; i++) {
        const a = p[Math.max(0, i - 1)], b = p[Math.min(p.length - 1, i + 1)];
        let nx = -(b[1] - a[1]), ny = b[0] - a[0]; const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
        const wave = Math.sin(L[i] * 0.008 - t * 1.8 * rb.speed) * width * 0.45;
        pts.push({ x: p[i][0] + nx * wave, y: p[i][1] + ny * wave, d: p[i][2], s: L[i], nx, ny });
      }
      if (pts.length < 2) continue;
      // soft glow under the whole ribbon (one stroke per canvas)
      for (const [ctx, isFront] of [[cb, false], [cf, true]]) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.shadowColor = rgba(rb.base, 0.55 * alpha); ctx.shadowBlur = 18 * (1 + light);
        ctx.strokeStyle = rgba(rb.light, (0.10 + 0.25 * light) * alpha); ctx.lineWidth = width * 1.6;
        ctx.beginPath(); let on = false;
        for (const q of pts) { const f = q.d > 0.5; if (f === isFront) { on ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); on = true; } else on = false; }
        ctx.stroke(); ctx.restore();
      }
      // the ribbon body: twisting quads, tapered at both ends
      for (let i = 0; i < pts.length - 1; i++) {
        const q0 = pts[i], q1 = pts[i + 1];
        const ctx = q0.d > 0.5 ? cf : cb;
        const phi0 = q0.s * rb.twist + t * 1.3 * rb.speed, phi1 = q1.s * rb.twist + t * 1.3 * rb.speed;
        const taper = (s) => Math.min(1, s / 60, (head - s) / 45 + 0.15);
        const w0 = width * (0.22 + 0.78 * Math.abs(Math.cos(phi0))) * taper(q0.s), w1 = width * (0.22 + 0.78 * Math.abs(Math.cos(phi1))) * taper(q1.s);
        const face = Math.cos((phi0 + phi1) / 2);
        const shade = 0.5 + 0.5 * Math.abs(face);
        let c = face > 0 ? mixc(rb.base, rb.light, Math.pow(shade, 3) * 0.8) : mixc(rb.dark, rb.base, shade * 0.7);
        c = mixc(c, rb.light, light * 0.5);
        ctx.fillStyle = rgba(c, alpha * (q0.d > 0.5 ? 1 : 0.92));
        ctx.beginPath();
        ctx.moveTo(q0.x + q0.nx * w0 / 2, q0.y + q0.ny * w0 / 2); ctx.lineTo(q1.x + q1.nx * w1 / 2, q1.y + q1.ny * w1 / 2);
        ctx.lineTo(q1.x - q1.nx * w1 / 2, q1.y - q1.ny * w1 / 2); ctx.lineTo(q0.x - q0.nx * w0 / 2, q0.y - q0.ny * w0 / 2);
        ctx.closePath(); ctx.fill();
      }
      // a few sparkles chasing the leading end
      const tip = pts[pts.length - 1];
      cf.save(); cf.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 5; k++) {
        const j = Math.max(0, pts.length - 1 - k * 6), q = pts[j];
        const tw = 0.5 + 0.5 * Math.sin(t * 6 + k * 1.7);
        const r = (2 + 2.5 * tw) * (1 - k * 0.15);
        cf.fillStyle = rgba(rb.light, 0.75 * tw * alpha * (progress < 1 ? 1 : 0.4));
        cf.beginPath(); cf.arc(q.x + Math.sin(t * 3 + k) * 6, q.y + Math.cos(t * 2.5 + k) * 6, r, 0, Math.PI * 2); cf.fill();
      }
      cf.fillStyle = rgba(rb.light, 0.9 * alpha * (progress < 1 ? 1 : 0)); cf.beginPath(); cf.arc(tip.x, tip.y, width * 0.45, 0, Math.PI * 2); cf.fill();
      cf.restore();
    }
  }
  return { draw, resize };
}
