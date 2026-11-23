// Tiny scroll timeline: maps scroll position inside a tall section to progress 0..1, with frame-rate independent smoothing.
export const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const seg = (p, a, b) => clamp01((p - a) / (b - a));
export const smooth = (t) => t * t * (3 - 2 * t);
export const easeSine = (t) => 0.5 - 0.5 * Math.cos(Math.PI * t);
export const lerp = (a, b, t) => a + (b - a) * t;

export function createTimeline(section) {
  let cur = 0, target = 0, frozen = false, rate = 9;
  const measure = () => {
    const r = section.getBoundingClientRect();
    const span = Math.max(1, r.height - innerHeight);
    return clamp01(-r.top / span);
  };
  return {
    read() { if (!frozen) target = measure(); return target; },
    step(dt) { this.read(); cur += (target - cur) * (1 - Math.exp(-dt * rate)); if (Math.abs(target - cur) < 0.0004) cur = target; return cur; },
    // how fast the story catches up with the scroll position (per second); higher = closer to the finger
    get rate() { return rate; },
    set rate(v) { rate = v; },
    snap() { target = cur = measure(); return cur; },
    set(p) { target = cur = p; },
    freeze(on) { frozen = on; },
    get value() { return cur; },
    // scrollY that puts the pinned story at progress p
    scrollYFor(p) { const r = section.getBoundingClientRect(); return scrollY + r.top + p * (r.height - innerHeight); },
  };
}
