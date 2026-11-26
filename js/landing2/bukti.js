// Bukti block: three case tabs share one diorama stage; the two role cards light up their people in the mini town.
// Live 3D only where the hero also runs 3D (WebGL, no reduced motion or data saver), loaded when the block comes near.
// Everywhere else the WebP posters are the illustration.
const url = (k) => `assets/3d/diorama-${k}.glb`;
const img = (k) => `assets/img/diorama/${k}.webp`;
const html = document.documentElement;

// resolves with the final render mode once the hero has decided ('3d' or 'poster')
const finalMode = () => new Promise((res) => {
  const done = () => html.dataset.mode && html.dataset.mode !== 'pending';
  if (done()) return res(html.dataset.mode);
  const mo = new MutationObserver(() => { if (done()) { mo.disconnect(); res(html.dataset.mode); } });
  mo.observe(html, { attributes: true, attributeFilter: ['data-mode'] });
});

export function initBukti({ reduced = false } = {}) {
  const root = document.getElementById('cases');
  if (!root) return;
  const tabs = [...root.querySelectorAll('.case-tab')];
  const panels = [...root.querySelectorAll('.case-panel')];
  const stage = document.getElementById('dioStage'), poster = document.getElementById('dioPoster'), canvas = document.getElementById('dioCanvas');
  let cur = tabs.find((t) => t.getAttribute('aria-selected') === 'true')?.dataset.case || 'banjir';
  let role = null, dio = null, started = false;

  function setRole(r) {
    role = r;
    for (const b of root.querySelectorAll('.role')) b.setAttribute('aria-pressed', String(b.dataset.role === role));
    dio?.highlight(role);
  }
  function select(k, focus = false) {
    if (k === cur) return;
    cur = k;
    for (const t of tabs) {
      const on = t.dataset.case === k;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      if (on && focus) t.focus();
    }
    for (const p of panels) p.hidden = p.id !== `panel-${k}`;
    setRole(null);
    poster.alt = document.getElementById(`panel-${k}`).dataset.alt;
    if (dio) { poster.src = img(k); dio.show(url(k)).catch((e) => console.warn('diorama switch failed', e)); return; }
    stage.classList.add('swap');                                   // poster crossfade
    setTimeout(() => {
      poster.src = img(k);
      (poster.decode ? poster.decode() : Promise.resolve()).catch(() => {}).finally(() => stage.classList.remove('swap'));
    }, reduced ? 0 : 160);
  }

  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(t.dataset.case));
    t.addEventListener('keydown', (e) => {
      const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      select(tabs[(i + d + tabs.length) % tabs.length].dataset.case, true);
    });
  });
  root.addEventListener('click', (e) => {
    const b = e.target.closest('.role');
    if (b) setRole(role === b.dataset.role ? null : b.dataset.role);
  });

  async function start() {
    if (started) return;
    started = true;
    if (await finalMode() !== '3d') return;
    try {
      const m = await import('./diorama.js?v=bcf57cddb0');
      dio = await m.createDiorama({ canvas, reduced });
      await dio.show(url(cur));
      dio.highlight(role);
      stage.classList.add('live');
    } catch (e) {
      console.warn('diorama 3D skipped, posters stay:', e);
      dio = null;
    }
  }
  if (!('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); start(); } }, { rootMargin: '700px 0px' });
  io.observe(stage);
}
