// Procedural anime-style dusk sky above a sea of clouds. Raw WebGL (no three.js), one full-screen triangle.
// Rendered at a reduced internal resolution and upscaled by the browser. Pauses off-screen / hidden tab.
const VERT = `attribute vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }`;
const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes, uSun; uniform float uTime, uWarm, uFlash, uHz, uScale;
float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
void main(){
  // subtle extras on top of the painted sky: sun glow pulse, a faint horizon shimmer, a few twinkling stars. Premultiplied output.
  vec2 uv = gl_FragCoord.xy / uRes; float asp = uRes.x/uRes.y;
  vec2 p = vec2(uv.x*asp, uv.y), sp = vec2(uSun.x*asp, uSun.y);
  vec2 d = p - sp; float r = length(d*vec2(1.0, 1.25)) / max(uScale, .3);
  float pulse = 1.0 + .12*sin(uTime*.7) + .05*sin(uTime*1.9+1.);
  float glow = (exp(-r*6.0)*.5 + exp(-r*17.0)*.55) * pulse * (1.0 + 1.0*uWarm);
  float shim = .85 + .15*sin(uTime*.9 + uv.x*7.0 + sin(uTime*.4)*2.0);
  float flare = exp(-abs(d.y)*70.)*exp(-abs(d.x)*1.2/max(uScale,.3))*.35*shim*(1.0+.6*uWarm);
  float above = smoothstep(uHz-.01, uHz+.015, uv.y);
  vec2 g = vec2(p.x*90., p.y*90.); vec2 cell = floor(g); float sh = hash(cell);
  float tw = .5+.5*sin(uTime*(1.1+sh*3.)+sh*40.);
  float h = (uv.y-uHz)/(1.0-uHz);
  float star = step(.994, sh) * smoothstep(.25,.0,length(fract(g)-.5)) * tw * smoothstep(.55,.85,h) * .8;
  vec3 col = (vec3(1.0,.70,.36)*glow*above + vec3(1.0,.82,.52)*flare*above) + vec3(.95,.93,1.0)*star;
  col += vec3(1.0,.93,.76) * uFlash * above * .5;
  float a = clamp(max(col.r, max(col.g, col.b)), 0., 1.);
  gl_FragColor = vec4(col, a);
}`;

export function createSky(canvas, { scale = 0.7, horizon = 0.42 } = {}) {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: true, premultipliedAlpha: true, powerPreference: 'low-power', preserveDrawingBuffer: false });
  if (!gl) return null;
  const mk = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const prog = gl.createProgram();
  gl.attachShader(prog, mk(gl.VERTEX_SHADER, VERT)); gl.attachShader(prog, mk(gl.FRAGMENT_SHADER, FRAG)); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog); gl.clearColor(0, 0, 0, 0);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'a'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = {}; for (const n of ['uRes', 'uTime', 'uWarm', 'uFlash', 'uSun', 'uHz', 'uScale']) U[n] = gl.getUniformLocation(prog, n);
  const st = { sunU: .5, sunV: .42, hz: .42, sc: 1, warm: 0, flash: 0, t: 0, raf: 0, paused: new Set(), last: performance.now(), W: 0, H: 0, scale, horizon, dead: false };

  function resize() {
    const r = canvas.getBoundingClientRect(); const w = Math.max(2, Math.round(r.width * st.scale)), h = Math.max(2, Math.round(r.height * st.scale));
    if (w !== canvas.width || h !== canvas.height) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }
    st.W = w; st.H = h;
  }
  function draw() {
    resize();
    gl.uniform2f(U.uRes, st.W, st.H); gl.uniform1f(U.uTime, st.t); gl.uniform1f(U.uWarm, st.warm); gl.uniform1f(U.uFlash, st.flash);
    gl.uniform2f(U.uSun, st.sunU, st.sunV); gl.uniform1f(U.uHz, st.hz); gl.uniform1f(U.uScale, st.sc);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  function frame(now) {
    st.raf = 0; if (st.dead || st.paused.size) return;
    st.t += Math.min(0.1, (now - st.last) / 1000); st.last = now;
    draw(); st.raf = requestAnimationFrame(frame);
  }
  const wake = () => { if (!st.raf && !st.paused.size && !st.dead) { st.last = performance.now(); st.raf = requestAnimationFrame(frame); } };
  const onVis = () => api.setPaused('hidden', document.hidden);
  document.addEventListener('visibilitychange', onVis);
  const io = new IntersectionObserver((es) => api.setPaused('offscreen', !es[es.length - 1].isIntersecting)); io.observe(canvas);
  const api = {
    setPaused(r, on) { on ? st.paused.add(r) : st.paused.delete(r); if (!on) wake(); },
    setLook(warm, flash) { st.warm = warm; st.flash = flash; },
    setScale(s) { st.scale = s; },
    setHorizon(h) { st.horizon = h; },
    setSun(u, v, hz, sc) { st.sunU = u; st.sunV = v; st.hz = hz; st.sc = sc; },
    start() { wake(); }, drawOnce() { draw(); },
    dispose() { st.dead = true; cancelAnimationFrame(st.raf); io.disconnect(); document.removeEventListener('visibilitychange', onVis); gl.getExtension('WEBGL_lose_context')?.loseContext(); },
  };
  return api;
}
