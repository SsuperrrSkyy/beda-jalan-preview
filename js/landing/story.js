// The 3D side of the pinned story: two skinned characters, a spark, and the scroll-driven camera dolly.
// Everything is a pure function of progress p (0..1) so scrubbing backwards just works.
import { GIRL, BOY } from '../scene/rigs.js?v=55928db09c';
import { createCharacter } from '../scene/characters.js?v=55928db09c';
import { createSpark } from '../scene/spark.js?v=55928db09c';
import { heroPose, MOBILE_MQ, PORTRAIT_ASPECT } from '../scene/camera-math.js?v=55928db09c';
import { seg, easeSine, smooth, lerp } from './timeline.js?v=55928db09c';

const DEG = Math.PI / 180;

export async function createStory({ c3d, sceneData, rigDebug = false }) {
  const { THREE, scene, camera } = c3d.getContext();
  const loader = new THREE.TextureLoader();
  const load = (url) => new Promise((res, rej) => loader.load(url, (t) => {
    t.colorSpace = THREE.NoColorSpace; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = 4; res(t);
  }, undefined, rej));
  const [tg, tb] = await Promise.all([load(GIRL.url), load(BOY.url)]);
  const girl = createCharacter(scene, { ...GIRL, id: 'girl' }, tg, { rigDebug });
  const boy = createCharacter(scene, { ...BOY, id: 'boy' }, tb, { rigDebug });
  const spark = createSpark(scene, { colorHex: sceneData.sun.colorHex });

  const st = { p: 0, alpha: 1, W: 1, H: 1, layoutKey: '', M: new THREE.Vector3(), Wd: 1.5, Hd: 1, s: 0.001, portrait: false };
  const v = (x, y, z) => new THREE.Vector3(x, y, z);
  const tmpCam = new THREE.PerspectiveCamera();

  // --- camera dolly (applied to the hero pose through the pose hook) ---
  const dollyOf = (portrait) => (portrait ? { dz: 0.8, dy: -0.04 } : { dz: 1.5, dy: -0.12 });
  function storyPose(base, W, H) {
    const portrait = W / H < PORTRAIT_ASPECT, d = dollyOf(portrait), e = smooth(Math.min(1, st.p / 0.95));
    return { ...base, pos: [base.pos[0], base.pos[1] + d.dy * e, base.pos[2] - d.dz * e] };
  }
  c3d.setPoseHook(storyPose);

  // --- layout: where the meeting point is, how big the characters are ---
  function layout() {
    const { W, H, THREE: T } = c3d.getContext();
    const key = W + 'x' + H;
    if (key === st.layoutKey) return;
    st.layoutKey = key; st.W = W; st.H = H;
    const portrait = W / H < PORTRAIT_ASPECT; st.portrait = portrait;
    const mobile = matchMedia(MOBILE_MQ).matches;
    const base = heroPose(sceneData, W, H, mobile);
    const fin = (function () { const old = st.p; st.p = 1; const p = storyPose(base, W, H); st.p = old; return p; })();
    tmpCam.position.set(...fin.pos); tmpCam.quaternion.set(...fin.quat); tmpCam.fov = fin.fov; tmpCam.aspect = W / H; tmpCam.updateProjectionMatrix(); tmpCam.updateMatrixWorld(true);
    const depth = 4.3, ndc = portrait ? [0.0, 0.06] : [0.0, -0.02];
    const dir = new T.Vector3(ndc[0], ndc[1], 0.5).unproject(tmpCam).sub(tmpCam.position).normalize();
    // depth measured along the optical axis
    const fwd = new T.Vector3(0, 0, -1).applyQuaternion(tmpCam.quaternion);
    st.M.copy(tmpCam.position).addScaledVector(dir, depth / dir.dot(fwd));
    const th = Math.tan(fin.fov * DEG / 2);
    st.Hd = depth * th; st.Wd = st.Hd * (W / H);
    const targetW = (portrait ? 0.41 : 0.4) * 2 * st.Wd;       // girl width in metres
    st.s = Math.min(portrait ? 9 : 1.55, targetW) / GIRL.size[0];
  }

  const bez = (a, b, c, t) => a.clone().multiplyScalar((1 - t) * (1 - t)).addScaledVector(b, 2 * (1 - t) * t).addScaledVector(c, t * t);
  const qRoll = new THREE.Quaternion(), qYaw = new THREE.Quaternion(), qAll = new THREE.Quaternion(), zAxis = v(0, 0, 1), yAxis = v(0, 1, 0);

  function place(ch, rig, side, u, t, speed) {
    const { M, Wd, Hd, s, portrait } = st;
    const k = side; // -1 girl (left), +1 boy (right)
    const gap = lerp(0.55, 0.07, easeSine(seg(u, 0.55, 1)));
    let S, C;
    if (!portrait) {
      S = k < 0 ? v(-1.7 * Wd, 0.5 * Hd, -0.5) : v(1.7 * Wd, 0.62 * Hd, 0.1);
      C = k < 0 ? v(-0.75 * Wd, 0.85 * Hd, 0.1) : v(0.75 * Wd, 0.2 * Hd, 0.3);
    } else {
      S = k < 0 ? v(-1.5 * Wd, -1.6 * Hd, -0.5) : v(1.5 * Wd, 1.7 * Hd, 0.2);
      C = k < 0 ? v(-0.9 * Wd, -0.95 * Hd, -0.1) : v(0.9 * Wd, 1.0 * Hd, 0.0);
    }
    S.add(M); C.add(M);
    const E = M.clone().add(v(k * gap / 2, 0, 0.35));
    const tip = bez(S, C, E, u);
    // idle float, fades slightly as they meet but never stops
    tip.x += Math.sin(t * 0.55 + k) * 0.03; tip.y += Math.sin(t * 0.9 + k * 1.7) * 0.05 + Math.sin(t * 1.9 + k) * 0.008; // bob + breathing
    const tan = bez(S, C, E, Math.min(1, u + 0.02)).sub(bez(S, C, E, Math.max(0, u - 0.02)));
    const baseRoll = Math.atan2(tan.y, Math.abs(tan.x) + 1e-3) * (k < 0 ? 0.35 : -0.35) * (portrait ? 0.3 : 1);
    const arrive = easeSine(seg(u, 0.5, 1));
    const endRoll = portrait ? (k < 0 ? 24 : 34) * DEG : (k < 0 ? 3 : -3) * DEG;
    const roll = baseRoll * (1 - arrive) + endRoll * arrive + Math.sin(t * 0.7 + k * 2) * 1.6 * DEG;
    qRoll.setFromAxisAngle(zAxis, roll); qYaw.setFromAxisAngle(yAxis, -k * 0.12);
    qAll.copy(qYaw).multiply(qRoll);
    const off = ch.tipLocal(s).applyQuaternion(qAll);
    ch.group.quaternion.copy(qAll);
    ch.group.position.copy(tip).sub(off);
    return tip;
  }

  const tmp = new THREE.Vector3();
  function update(t) {
    layout();
    const p = st.p;
    const u = easeSine(seg(p, 0.02, 0.62));
    const speed = Math.sin(Math.PI * Math.min(1, u * 1.05)) * (1 - seg(p, 0.55, 0.65));
    const reach = seg(p, 0.42, 0.66);
    const visible = p > 0.004 && st.alpha > 0.003;
    girl.group.visible = boy.group.visible = visible;
    girl.update(t, { reach, trail: speed, scale: st.s });
    boy.update(t, { reach, trail: speed, scale: st.s });
    girl.setAlpha(st.alpha); boy.setAlpha(st.alpha);
    const tg_ = place(girl, GIRL, -1, u, t, speed);
    const tb_ = place(boy, BOY, +1, u, t, speed);
    tmp.copy(tg_).add(tb_).multiplyScalar(0.5);
    const grow = smooth(seg(p, 0.5, 0.66)), settle = smooth(seg(p, 0.7, 0.88));
    const I = (0.8 * grow - 0.25 * settle) * st.alpha;
    spark.update(t, camera, tmp, lerp(0.25, 2.0 * st.Wd * 0.55, grow) * (1 - 0.3 * settle), I);
  }
  c3d.addUpdater(update);
  layout();

  return {
    st, girl, boy, spark,
    setProgress(p) { st.p = p; },
    setAlpha(a) { st.alpha = a; },
    get alpha() { return st.alpha; },
    dispose() { girl.dispose(); boy.dispose(); spark.dispose(); },
  };
}
