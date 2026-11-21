// Editorial sections: reveal on scroll, FAQ accordion, floating cards (tiny scroll parallax). No libraries.
export function initSections({ reduced }) {
  const els = document.querySelectorAll('[data-reveal]');
  if (reduced || !('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('in')); }
  else {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -4% 0px', threshold: 0 });
    els.forEach((e, i) => { e.style.setProperty('--d', (i % 3) * 50 + 'ms'); io.observe(e); });
  }
  for (const b of document.querySelectorAll('.faq button')) {
    b.addEventListener('click', () => {
      const open = b.getAttribute('aria-expanded') === 'true';
      b.setAttribute('aria-expanded', String(!open));
      document.getElementById(b.getAttribute('aria-controls')).hidden = open;
    });
  }
  const floats = [...document.querySelectorAll('[data-float]')];
  if (!reduced && floats.length) {
    let ticking = false;
    const run = () => {
      ticking = false;
      for (const f of floats) {
        const r = f.getBoundingClientRect(); if (r.bottom < -100 || r.top > innerHeight + 100) continue;
        const k = ((r.top + r.height / 2) / innerHeight - 0.5) * +f.dataset.float;
        f.style.transform = `translate3d(0,${k.toFixed(1)}px,0) rotate(${(f.classList.contains('ui-chip') ? 3 : -2.5) + k * 0.05}deg)`;
      }
    };
    addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(run); } }, { passive: true });
    run();
  }
}
