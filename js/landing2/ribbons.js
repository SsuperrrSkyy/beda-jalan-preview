// Two ribbons (teal = IPA, gold = IPS) that fly in from the sides as the students move together: each wraps its
// own student, then the two tie a single bow where their backs meet (two roads, one knot).
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
      const k1 = p1[3] ?? 1, k2 = p2[3] ?? 1;
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1]), p1[2] + (p2[2] - p1[2]) * t, k1 + (k2 - k1) * t]);
    }
  }
  const last = pts[pts.length - 1];
  out.push([last[0], last[1], last[2], last[3] ?? 1]);
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
  // both then run to where their backs meet and tie one bow: each ribbon's loop opens on the other's side ("satu tujuan").
  function path(rb, bodies) {
    const { boy, girl } = bodies;
    const s = rb.from, own = s < 0 ? boy : girl;
    const X = { x: (boy.back + girl.back) / 2, y: (boy.chest.y + girl.chest.y) / 2 };
    const R = Math.max(boy.height, girl.height);
    const c = own.chest, r = own.halfW * 1.3, ry = R * 0.06 * rb.ry;
    const out = c.x + s * r, inn = c.x - s * r;
    const W = st.W, bw = R * 0.12, bh = R * 0.042;          // bow loop reach and height
    const K = { x: X.x, y: X.y - R * 0.022 };                 // the knot, high on their backs where they meet
    const cy = c.y + R * 0.035;                               // its own wrap sits a little lower, clear of the bow
    // [x, y, depth, flutter]: flutter 1 = free ribbon, near 0 = the bow's crisp, flat loops
    const k = (dx, dy, fl) => [K.x + s * bw * dx, K.y + bh * dy, 1, fl];
    const pts = [
      [s < 0 ? -0.12 * W : 1.12 * W, cy + R * 0.28, 1], [out + s * r * 1.3, cy + R * 0.13, 1],
      // one loop around its own student, rising: front, inner side, behind, outer side, front
      [out, cy + ry, 0.8], [c.x, cy + ry * 1.3, 1], [inn, cy + ry * 0.4, 0.55], [c.x, cy - ry * 0.3, 0],
      [out, cy - ry * 0.7, 0.4], [c.x, cy - ry * 1.1, 1, 0.8],
      // up into the knot from its own side, then its bow loop opens on the OTHER student's side...
      k(0.62, 1.7, 0.45), k(0.22, 0.5, 0.12), k(0, 0, 0.04), k(-0.3, -0.62, 0.03), k(-0.72, -1.02, 0.03), k(-1.06, -0.66, 0.03),
      k(-1.12, 0.12, 0.03), k(-0.72, 0.56, 0.03), k(-0.2, 0.26, 0.04), k(0, 0.06, 0.05),
      // ...and its tail falls back on its own side: each carries a piece of the other, tied as one
      k(0.3, 1.25, 0.25), k(0.5, 2.7, 0.6), k(0.4, 4.2, 0.9),
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
        const wave = Math.sin(L[i] * 0.008 - t * 1.8 * rb.speed) * width * 0.45 * p[i][3];
        pts.push({ x: p[i][0] + nx * wave, y: p[i][1] + ny * wave, d: p[i][2], s: L[i], nx, ny, k: p[i][3] });
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
        // bow loops stay flat and broad; free ribbon twists
        const tw = (phi, kk) => { const m = Math.min(1, kk * 2.5); return 1 - m + m * (0.22 + 0.78 * Math.abs(Math.cos(phi))); };
        const w0 = width * tw(phi0, q0.k) * taper(q0.s), w1 = width * tw(phi1, q1.k) * taper(q1.s);
        const face = Math.cos((phi0 + phi1) / 2);
        const shade = 0.5 + 0.5 * Math.abs(face);
        let c = face > 0 ? mixc(rb.base, rb.light, Math.pow(shade, 3) * 0.8) : mixc(rb.dark, rb.base, shade * 0.7);
        // the flat bow loops get a smooth satin sheen instead of twist banding
        const flat = 1 - Math.min(1, q0.k * 2.5);
        if (flat > 0) {
          const sheen = 0.5 + 0.5 * Math.sin(q0.s * 0.011 + t * 0.6 * rb.speed);
          c = mixc(c, mixc(mixc(rb.dark, rb.base, 0.75), rb.light, sheen * 0.55), flat);
        }
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
    // the knot that binds them: half teal, half gold, tied once both bows are complete
    const ka = alpha * Math.max(0, Math.min(1, (progress - 0.9) / 0.1));
    if (ka > 0) {
      const { boy, girl } = bodies, R = Math.max(boy.height, girl.height);
      const kx = (boy.back + girl.back) / 2, ky = (boy.chest.y + girl.chest.y) / 2 - R * 0.022;
      const w = Math.max(9, Math.min(22, boy.height * 0.03)), rx = w * 0.55, ry = w * 0.78;
      const [a, b] = RIBBONS, g = cf.createLinearGradient(kx - rx, ky - ry, kx + rx, ky + ry);
      g.addColorStop(0, rgba(mixc(a.base, a.light, 0.35 + 0.4 * light), ka)); g.addColorStop(0.48, rgba(mixc(a.base, a.dark, 0.2), ka));
      g.addColorStop(0.52, rgba(mixc(b.base, b.dark, 0.2), ka)); g.addColorStop(1, rgba(mixc(b.base, b.light, 0.35 + 0.4 * light), ka));
      cf.save();
      cf.shadowColor = rgba([255, 236, 200], 0.6 * ka); cf.shadowBlur = 10 * (1 + light);
      cf.fillStyle = g; cf.beginPath(); cf.roundRect(kx - rx, ky - ry, rx * 2, ry * 2, rx * 0.8); cf.fill();
      cf.shadowBlur = 0; cf.strokeStyle = rgba([255, 250, 235], 0.6 * ka); cf.lineWidth = 1.1; cf.lineCap = 'round';
      // two soft creases where the ribbon is pulled tight
      cf.beginPath(); cf.moveTo(kx - rx * 0.45, ky - ry * 0.55); cf.quadraticCurveTo(kx - rx * 0.1, ky, kx - rx * 0.4, ky + ry * 0.55);
      cf.moveTo(kx + rx * 0.4, ky - ry * 0.5); cf.quadraticCurveTo(kx + rx * 0.12, ky, kx + rx * 0.45, ky + ry * 0.55); cf.stroke();
      cf.restore();
    }
  }
  return { draw, resize };
}
