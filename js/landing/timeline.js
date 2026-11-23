// Tiny scroll timeline: maps scroll position inside a tall section to progress 0..1, with frame-rate independent smoothing.
export const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const seg = (p, a, b) => clamp01((p - a) / (b - a));
export const smooth = (t) => t * t * (3 - 2 * t);
export const easeSine = (t) => 0.5 - 0.5 * Math.cos(Math.PI * t);
export const lerp = (a, b, t) => a + (b - a) * t;

// tail(): px at the end of the section that belong to the next section sliding in, not to the story itself
export function createTimeline(section, { tail = () => 0 } = {}) {
  let cur = 0, target = 0, frozen = false;
  const span = (r) => Math.max(1, r.height - innerHeight - tail());
  const measure = () => {
    const r = section.getBoundingClientRect();
    return clamp01(-r.top / span(r));
  };
  return {
    read() { if (!frozen) target = measure(); return target; },
    step(dt) { this.read(); cur += (target - cur) * (1 - Math.exp(-dt * 9)); if (Math.abs(target - cur) < 0.0004) cur = target; return cur; },
    snap() { target = cur = measure(); return cur; },
    set(p) { target = cur = p; },
    freeze(on) { frozen = on; },
    get value() { return cur; },
    // scrollY that puts the pinned story at progress p
    scrollYFor(p) { const r = section.getBoundingClientRect(); return scrollY + r.top + p * span(r); },
  };
}
