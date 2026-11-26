// Static sky fallback: still frames of the shader sky (back sky + clouds, front clouds) that share one horizon/sun alignment.
// Each layer drifts sideways, ping-ponging with easing, and rises slightly on scroll (front faster). Transform-only.
// Layers are optional: give a layer `url: null` and it is skipped, so any layer can be swapped or added via this config.
export const SKY = {
  geom: { w: 1536, h: 1024, horizonY: 594, sunX: 768, sunY: 582, zoom: 1.2, bottomMargin: 70 },   // stills rendered from sky-sea.js
  layers: [
    { id: 'back',  el: 'layerBack',  drift: 0.003, rise: 0 },
    { id: 'front', el: 'layerFront', drift: 0.016, rise: 60 },
  ],
};

export function createSkyLayers(container, { animate = true } = {}) {
  const g = SKY.geom;
  const layers = SKY.layers.map((l) => ({ ...l, node: document.getElementById(l.el) })).filter((l) => l.node);
  const st = { W: 1, H: 1, scale: 1, top: 0, left0: 0, width: 0, height: 0, horizonT: 0.58, animate };

  function layout() {
    const r = container.getBoundingClientRect(); const W = Math.max(1, r.width), H = Math.max(1, r.height);
    const portrait = W / H < 0.8;
    st.W = W; st.H = H;
    st.horizonT = portrait ? 0.565 : 0.58;                          // where the horizon sits on screen (fraction of height)
    const cover = Math.max(W / g.w, H / g.h) * g.zoom;               // cover + room to drift
    st.scale = cover; st.width = g.w * cover; st.height = g.h * cover;
    st.top = Math.min(0, Math.max(H + g.bottomMargin - st.height, st.horizonT * H - g.horizonY * cover));
    st.left0 = (W - st.width) / 2;                                    // centred: the sun stays at the horizontal centre
    for (const l of layers) {
      const s = l.node.style;
      s.width = st.width + 'px'; s.height = st.height + 'px'; s.left = st.left0 + 'px'; s.top = st.top + 'px'; s.objectFit = 'fill';
      l.node.classList.add('placed');
      l.slack = Math.max(0, st.width - W);
    }
  }
  // returns the sun's screen position in px for the shader
  function update(t, p) {
    let sunX = st.W / 2;
    for (const l of layers) {
      let dx = 0;
      if (st.animate && l.slack > 1) {
        const A = l.slack / 2, v = l.drift * st.width;                 // peak travel, target average speed (px/s)
        const w = Math.PI * v / (2 * A);                                // cosine ping-pong: eased at both ends
        dx = -A * Math.cos(w * t + (l.id === 'mid' ? 1.3 : l.id === 'front' ? 2.4 : 0.4)) * 0.92;
      }
      const dy = -l.rise * Math.min(1, p / 0.8);
      l.node.style.transform = `translate3d(${dx.toFixed(2)}px,${dy.toFixed(2)}px,0)`;
      if (l.id === 'back') sunX = st.W / 2 + dx + (g.sunX - g.w / 2) * st.scale;
    }
    return { x: sunX, y: st.top + g.sunY * st.scale, hz: st.top + g.horizonY * st.scale, scale: st.scale };
  }
  function load(ids) { for (const l of layers) { if (ids.includes(l.id) && !l.node.src && l.node.dataset.src) { l.node.src = l.node.dataset.src; l.node.decode?.().then(() => l.node.classList.add('on')).catch(() => l.node.classList.add('on')); } } }
  function setAnimate(on) { st.animate = on; }
  return { layout, update, load, setAnimate, get state() { return st; } };
}
