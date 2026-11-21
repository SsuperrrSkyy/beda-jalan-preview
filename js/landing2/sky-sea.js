// Procedural dusk sky above a sea of volumetric clouds (no images, no libraries).
// Two canvases share one look: `back` draws the sky, the sun optics and the clouds beyond a split distance (opaque);
// `front` draws only the nearest clouds (transparent elsewhere), so they can sit in front of the characters' feet.
// Each canvas renders in two passes: soft volumetric clouds into a small offscreen texture (they tolerate low
// resolution), then a sharper pass that paints the sky and sun and composites the clouds on top.
const VERT = 'attribute vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }';

const COMMON = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes;
uniform float uTime, uHz, uSunX, uWarm, uFlash, uScroll, uLayer, uSplit, uAsp;
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm2(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ s += a * vnoise(p); p = p * 2.03 + vec2(17.1, 9.2); a *= 0.5; } return s; }
`;

// ---------- pass 1: volumetric clouds (premultiplied colour + coverage) ----------
const FRAG_CLOUD = COMMON + `
float hash3(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float noise3(vec3 x){
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash3(i), hash3(i + vec3(1.0, 0.0, 0.0)), f.x), mix(hash3(i + vec3(0.0, 1.0, 0.0)), hash3(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
             mix(mix(hash3(i + vec3(0.0, 0.0, 1.0)), hash3(i + vec3(1.0, 0.0, 1.0)), f.x), mix(hash3(i + vec3(0.0, 1.0, 1.0)), hash3(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
}
const mat3 M3 = mat3(0.00, 0.80, 0.60, -0.80, 0.36, -0.48, -0.60, -0.48, 0.64);
// density of the cloud sea: cumulus lumps whose tops billow up to ~1.6
float den(vec3 p, int oct){
  vec3 q = p + vec3(uTime * 0.10, 0.0, uTime * 0.035);
  float lump = smoothstep(0.2, 0.85, noise3(vec3(q.x * 0.11, 0.3, q.z * 0.11)));
  float top = 0.25 + 1.55 * lump;
  float f = 0.0, a = 0.5; vec3 r = q * 0.75;
  for (int i = 0; i < 5; i++){ if (i >= oct) break; f += a * noise3(r); r = M3 * r * 2.03; a *= 0.5; }
  float d = (top - p.y) * 1.5 + (f - 0.5) * 2.3;
  return clamp(d, 0.0, 1.0) * smoothstep(-0.3, 0.3, p.y);
}
float hg(float mu, float g){ float g2 = g * g; return (1.0 - g2) / pow(1.0 + g2 - 2.0 * g * mu, 1.5) * 0.0796; }

void main(){
  vec2 frag = gl_FragCoord.xy;
  float v = 1.0 - frag.y / uRes.y;
  float x = (frag.x / uRes.x - 0.5) * uAsp;
  vec3 ro = vec3(0.0, 2.0, uScroll * 2.4);
  vec3 rd = normalize(vec3(x, uHz - v, 1.3));
  vec4 acc = vec4(0.0);
  if (rd.y < -0.0005){
    vec3 sunDir = normalize(vec3((uSunX - 0.5) * uAsp, 0.035, 1.3));
    float mu = dot(rd, sunDir);
    float phase = hg(mu, 0.72) * 0.85 + hg(mu, -0.15) * 0.4;
    float sunNear = exp(-abs(x - (uSunX - 0.5) * uAsp) * 2.2);
    float tTop = (ro.y - 1.85) / -rd.y, tBot = (ro.y + 0.3) / -rd.y;
    bool front = uLayer > 0.5;
    float t0 = front ? tTop : max(tTop, uSplit);
    float t1 = min(front ? min(tBot, uSplit) : tBot, 70.0);
    float t = t0 + 0.02 * h21(frag);                       // jitter against banding
    for (int i = 0; i < 84; i++){
      if (t > t1 || acc.a > 0.985) break;
      vec3 p = ro + rd * t;
      int oct = t < 7.0 ? 5 : (t < 18.0 ? 4 : 3);
      float d = den(p, oct);
      float dt = max(0.045, 0.034 * t);
      if (d > 0.002){
        float dl = den(p + sunDir * 0.32, 3);
        float dif = clamp((d - dl) / 0.45, 0.0, 1.0);
        float hgt = clamp(p.y / 1.7, 0.0, 1.0);
        vec3 amb = mix(vec3(0.25, 0.12, 0.37), vec3(0.72, 0.44, 0.70), hgt * hgt);
        vec3 sunC = mix(vec3(1.0, 0.44, 0.30), vec3(1.0, 0.74, 0.44), sunNear) * 1.15;
        vec3 lin = amb + sunC * dif * (0.6 + 1.9 * phase) + sunC * phase * 0.4 * (1.0 - d);
        vec3 c = lin * mix(vec3(1.0), vec3(0.86, 0.80, 0.95), d);
        float fg = 1.0 - exp(-t * 0.03);
        vec3 haze = mix(vec3(0.98, 0.58, 0.68), vec3(1.0, 0.78, 0.52), sunNear);
        c = mix(c, haze, fg * 0.8);
        c = c / (1.0 + 0.3 * max(c.r, max(c.g, c.b)));       // soft shoulder: no blown-out patch under the sun
        c = max(mix(vec3(dot(c, vec3(0.299, 0.587, 0.114))), c, 1.3), 0.0);   // painted, saturated look
        float a = 1.0 - exp(-d * dt * 4.2);
        acc.rgb += (1.0 - acc.a) * a * c;
        acc.a += (1.0 - acc.a) * a;
      }
      t += dt;
    }
  }
  gl_FragColor = acc;
}`;

// ---------- pass 2: sky, sun optics, composite ----------
const FRAG_COMP = COMMON + `
uniform sampler2D uCloud;
vec3 spectral(float x){
  float h = (1.0 - clamp(x, 0.0, 1.0)) * 0.78;
  return clamp(vec3(abs(h * 6.0 - 3.0) - 1.0, 2.0 - abs(h * 6.0 - 2.0), 2.0 - abs(h * 6.0 - 4.0)), 0.0, 1.0);
}
void main(){
  vec2 frag = gl_FragCoord.xy, uv = frag / uRes;
  float v = 1.0 - uv.y;
  float x = (uv.x - 0.5) * uAsp;
  float sunX = (uSunX - 0.5) * uAsp, sunV = uHz - 0.012;
  float dxs = x - sunX, sunNear = exp(-abs(dxs) * 2.3);
  bool back = uLayer < 0.5;
  vec4 cl = texture2D(uCloud, uv);
  vec3 col = vec3(0.0);

  if (back){
    float t = clamp((uHz - v) / max(uHz, 0.01), 0.0, 1.0);
    vec3 cHz  = mix(vec3(0.99, 0.54, 0.44), vec3(1.0, 0.72, 0.42), sunNear);
    col = mix(cHz, vec3(0.80, 0.50, 0.64), smoothstep(0.0, 0.09, t));
    col = mix(col, vec3(0.42, 0.48, 0.82), smoothstep(0.06, 0.36, t));
    col = mix(col, vec3(0.17, 0.28, 0.66), smoothstep(0.30, 0.72, t));
    col = mix(col, vec3(0.07, 0.13, 0.42), smoothstep(0.66, 1.0, t));
    col = mix(col, vec3(1.0, 0.82, 0.52), exp(-abs(dxs) * 2.6) * exp(-t * 10.0) * 0.85);
    float drift = uTime * 0.006;
    float n1 = fbm2(vec2(x * 2.6 + drift, t * 16.0)) * fbm2(vec2(x * 6.5 - drift * 2.0 + 3.0, t * 34.0));
    float m1 = smoothstep(0.30, 0.46, n1) * smoothstep(0.015, 0.06, t) * (1.0 - smoothstep(0.22, 0.42, t));
    vec3 c1 = mix(vec3(1.0, 0.66, 0.54), vec3(0.96, 0.75, 0.86), smoothstep(0.05, 0.3, t));
    col = mix(col, mix(c1, vec3(1.0, 0.88, 0.66), sunNear * 0.6), m1 * 0.8);
    float n2 = fbm2(vec2(x * 1.3 - drift * 0.6, t * 5.5 + 11.0));
    col = mix(col, vec3(0.62, 0.62, 0.90), smoothstep(0.56, 0.74, n2) * smoothstep(0.28, 0.5, t) * (1.0 - smoothstep(0.8, 0.98, t)) * 0.28);
    col = col * (1.0 - cl.a) + cl.rgb;                        // clouds over the sky

    vec2 d = vec2(dxs, sunV - v); float r = length(d);
    float pulse = 1.0 + 0.06 * sin(uTime * 0.8);
    float core = exp(-r * r * 5000.0) * 2.2 + exp(-r * 55.0) * 0.8;
    float bloom = (exp(-r * 9.0) * 0.5 + exp(-r * 2.8) * 0.16) * (1.0 + 0.8 * uWarm) * pulse;
    float pillar = exp(-abs(d.x) * 90.0) * exp(-abs(d.y) * 2.3) * 0.55 * (0.9 + 0.1 * sin(uTime * 1.7 + v * 40.0));
    float hstreak = exp(-abs(d.y) * 170.0) * exp(-abs(d.x) * 2.4) * 0.55;
    float rays = pow(max(0.0, cos(atan(d.y, d.x) * 7.0 + uTime * 0.03)), 26.0) * exp(-r * 7.0) * 0.22;
    col += vec3(1.0, 0.95, 0.84) * core + vec3(1.0, 0.70, 0.40) * bloom + vec3(1.0, 0.92, 0.74) * (pillar + rays) + vec3(1.0, 0.86, 0.62) * hstreak;
    float k = (r - 0.215) / 0.034;
    col += spectral(0.5 + k * 0.45) * exp(-k * k * 1.8) * 0.11 * smoothstep(-0.03, 0.08, d.y);
    vec2 dir = normalize(vec2(0.55, -0.85));
    for (int g = 0; g < 4; g++){
      float kk = 0.17 + 0.13 * float(g), rad = 0.006 + 0.005 * float(g);
      float gr = length(d - dir * kk);
      col += vec3(1.0, 0.62, 0.32) * (smoothstep(rad, rad * 0.35, gr) * 0.2 + exp(-gr * 70.0) * 0.05);
    }
    col = mix(col, vec3(1.0, 0.95, 0.86), uFlash * 0.55);
    col *= 1.0 + uWarm * 0.1;
    gl_FragColor = vec4(col, 1.0);
  } else {
    vec2 d = vec2(dxs, sunV - v);
    vec3 c = cl.rgb + vec3(1.0, 0.9, 0.7) * exp(-abs(d.x) * 90.0) * exp(-abs(d.y) * 2.3) * 0.3 * cl.a;
    gl_FragColor = vec4(c * (1.0 + uWarm * 0.1), cl.a);
  }
}`;

function program(gl, fsrc) {
  const mk = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const p = gl.createProgram();
  gl.attachShader(p, mk(gl.VERTEX_SHADER, VERT)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fsrc)); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const U = {}; for (const n of ['uRes', 'uTime', 'uHz', 'uSunX', 'uWarm', 'uFlash', 'uScroll', 'uLayer', 'uSplit', 'uAsp', 'uCloud']) U[n] = gl.getUniformLocation(p, n);
  return { p, U };
}

function makeGL(canvas, opaque) {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: !opaque, premultipliedAlpha: true, powerPreference: 'default', preserveDrawingBuffer: true });
  if (!gl) return null;
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const cloud = program(gl, FRAG_CLOUD), comp = program(gl, FRAG_COMP);
  for (const pr of [cloud, comp]) { const loc = gl.getAttribLocation(pr.p, 'a'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0); }
  const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fbo = gl.createFramebuffer();
  return { gl, canvas, cloud, comp, tex, fbo, tw: 0, th: 0 };
}

// horizon position (fraction of height from the top)
export const horizonFor = (W, H) => (W / H < 0.8 ? 0.565 : 0.58);

export function createSkySea({ back, front }, { scale = 0.75, cloudScale = 0.42, split = 8.5 } = {}) {
  const B = makeGL(back, true); if (!B) return null;
  const F = front ? makeGL(front, false) : null;
  const st = { t: 0, warm: 0, flash: 0, scroll: 0, scale, cloudScale, split, raf: 0, paused: new Set(), last: performance.now(), dead: false,
    hz: 0.58, sunX: 0.5, W: 1, H: 1, frames: 0, acc: 0 };

  function setUniforms(gl, U, w, h, layer) {
    gl.uniform2f(U.uRes, w, h); gl.uniform1f(U.uTime, st.t); gl.uniform1f(U.uHz, st.hz); gl.uniform1f(U.uSunX, st.sunX);
    gl.uniform1f(U.uWarm, st.warm); gl.uniform1f(U.uFlash, st.flash); gl.uniform1f(U.uScroll, st.scroll);
    gl.uniform1f(U.uLayer, layer); gl.uniform1f(U.uSplit, st.split); gl.uniform1f(U.uAsp, st.W / st.H);
  }
  function drawOne(ctx, layer) {
    const { gl, canvas } = ctx;
    const r = canvas.getBoundingClientRect();
    const W = Math.max(2, r.width), H = Math.max(2, r.height);
    if (layer === 0) { st.W = W; st.H = H; st.hz = horizonFor(W, H); }
    const w = Math.max(2, Math.round(W * st.scale)), h = Math.max(2, Math.round(H * st.scale));
    if (w !== canvas.width || h !== canvas.height) { canvas.width = w; canvas.height = h; }
    const tw = Math.max(2, Math.round(W * st.cloudScale)), th = Math.max(2, Math.round(H * st.cloudScale));
    if (tw !== ctx.tw || th !== ctx.th) {
      ctx.tw = tw; ctx.th = th;
      gl.bindTexture(gl.TEXTURE_2D, ctx.tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, tw, th, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, ctx.fbo); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, ctx.tex, 0);
    }
    // pass 1: clouds into the small texture
    gl.bindFramebuffer(gl.FRAMEBUFFER, ctx.fbo); gl.viewport(0, 0, tw, th);
    gl.useProgram(ctx.cloud.p); setUniforms(gl, ctx.cloud.U, tw, th, layer);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLES, 0, 3);
    // pass 2: sky + optics + composite at canvas resolution
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, w, h);
    gl.useProgram(ctx.comp.p); setUniforms(gl, ctx.comp.U, w, h, layer);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, ctx.tex); gl.uniform1i(ctx.comp.U.uCloud, 0);
    gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  function draw() { drawOne(B, 0); if (F) drawOne(F, 1); }
  function frame(now) {
    st.raf = 0; if (st.dead || st.paused.size) return;
    const dt = Math.min(0.1, (now - st.last) / 1000); st.t += dt; st.last = now;
    // adaptive quality: when frames run long, render the clouds at a lower resolution
    st.acc += dt; st.frames++;
    if (st.acc > 1.5) { const avg = st.acc / st.frames; if (avg > 0.028 && st.cloudScale > 0.22) st.cloudScale *= 0.85; st.acc = 0; st.frames = 0; }
    draw(); st.raf = requestAnimationFrame(frame);
  }
  const wake = () => { if (!st.raf && !st.paused.size && !st.dead) { st.last = performance.now(); st.raf = requestAnimationFrame(frame); } };
  const onVis = () => api.setPaused('hidden', document.hidden);
  document.addEventListener('visibilitychange', onVis);
  const io = new IntersectionObserver((es) => api.setPaused('offscreen', !es[es.length - 1].isIntersecting)); io.observe(back);

  const api = {
    setPaused(r, on) { on ? st.paused.add(r) : st.paused.delete(r); if (!on) wake(); },
    setLook(warm, flash) { st.warm = warm; st.flash = flash; },
    setScroll(p) { st.scroll = p; },
    setScale(s) { st.scale = Math.max(s, 0.5); },
    setTime(t) { st.t = t; },
    sun() { return { x: st.W * st.sunX, y: st.H * (st.hz - 0.012), hz: st.H * st.hz }; },
    start() { wake(); },
    drawOnce() { draw(); },
    dispose() { st.dead = true; cancelAnimationFrame(st.raf); io.disconnect(); document.removeEventListener('visibilitychange', onVis); for (const c of [B, F]) c?.gl.getExtension('WEBGL_lose_context')?.loseContext(); },
  };
  return api;
}
