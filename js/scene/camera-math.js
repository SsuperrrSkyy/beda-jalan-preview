// Pure camera / projection maths. No three.js: shared by the WebGL path and the poster-only path.
// Conventions: glTF/three.js (Y up, camera looks down -Z). Poses are {pos:[x,y,z], quat:[x,y,z,w], fov} (fov = vertical, degrees).
const DEG = Math.PI / 180;

export const MOBILE_MQ = '(orientation: portrait), (max-width: 600px)';
export const PORTRAIT_ASPECT = 0.8; // below this the dedicated portrait camera is used

// ---- quaternion helpers -------------------------------------------------
export function qRotate(q, v) {
  const [x, y, z, w] = q, [vx, vy, vz] = v;
  const tx = 2 * (y * vz - z * vy), ty = 2 * (z * vx - x * vz), tz = 2 * (x * vy - y * vx);
  return [vx + w * tx + (y * tz - z * ty), vy + w * ty + (z * tx - x * tz), vz + w * tz + (x * ty - y * tx)];
}
export const qConj = (q) => [-q[0], -q[1], -q[2], q[3]];
export const pitchQuat = (downDeg) => { const h = -downDeg * DEG / 2; return [Math.sin(h), 0, 0, Math.cos(h)]; };

// ---- field of view, object-fit: cover equivalent ------------------------
// Poster has aspect P and vertical fov F. Container aspect A.
// A > P: image fits width, top/bottom cropped -> vertical fov shrinks by P/A. A <= P: fits height, fov unchanged.
export function coverFov(fovY, posterAspect, aspect) {
  return 2 * Math.atan(Math.tan(fovY * DEG / 2) * Math.min(1, posterAspect / aspect)) / DEG;
}

export function camPose(def, aspect) {
  return { pos: def.position.slice(), quat: def.quaternion.slice(), fov: coverFov(def.fovY, def.aspect, aspect), cam: def };
}

// ---- projection ----------------------------------------------------------
export function project(pose, W, H, p) {
  const v = qRotate(qConj(pose.quat), [p[0] - pose.pos[0], p[1] - pose.pos[1], p[2] - pose.pos[2]]);
  const th = Math.tan(pose.fov * DEG / 2), A = W / H, d = -v[2];
  return { x: (v[0] / d / (th * A) * 0.5 + 0.5) * W, y: (0.5 - v[1] / d / th * 0.5) * H, depth: d };
}
export function ray(pose, W, H, x, y) {
  const th = Math.tan(pose.fov * DEG / 2), A = W / H;
  const nx = (x / W - 0.5) * 2, ny = (0.5 - y / H) * 2;
  return qRotate(pose.quat, [nx * th * A, ny * th, -1]);
}

// ---- hero cameras ---------------------------------------------------------
// Portrait camera: same position as Cam_Hero_Square, narrower FOV and pitched down so the board
// fills ~boardFrac of the viewport width and sits in the upper third; sub/CTA fit below it.
// Rotation-only change from the square poster camera => the poster can be re-projected exactly by a homography.
export function portraitPose(scene, aspect, boardFrac = 0.6, boardY = 0.3) {
  const sq = scene.cameras.Cam_Hero_Square, bd = scene.chalkboard;
  const dz = sq.position[2] - bd.center[2];
  let tanHalf = bd.size[0] / (2 * dz * aspect * boardFrac);
  let fov = 2 * Math.atan(tanHalf) / DEG;
  fov = Math.min(fov, 71.5);
  tanHalf = Math.tan(fov * DEG / 2);
  const boardElev = Math.atan2(bd.center[1] - sq.position[1], dz);
  let down = Math.atan((0.5 - boardY) * 2 * tanHalf) / DEG + boardElev / DEG;
  // keep the view inside the square poster's coverage (so the poster stays a valid LCP stand-in)
  const sqDown = 2 * Math.asin(-sq.quaternion[0]) / DEG;
  const maxDown = sqDown + sq.fovY / 2 - fov / 2 - 0.6;
  down = Math.max(0, Math.min(down, maxDown));
  return { pos: sq.position.slice(), quat: pitchQuat(down), fov, portrait: true, downDeg: down, cam: sq };
}

export function heroPose(scene, W, H, mobilePoster) {
  const A = W / H;
  if (A < PORTRAIT_ASPECT) return portraitPose(scene, A);
  return camPose(scene.cameras[mobilePoster ? 'Cam_Hero_Square' : 'Cam_Hero'], A);
}
// the camera the *poster image itself* was rendered with, for the same container
export function posterPose(scene, W, H, mobilePoster) {
  return camPose(scene.cameras[mobilePoster ? 'Cam_Hero_Square' : 'Cam_Hero'], W / H);
}
export const deskPose = (scene, W, H) => camPose(scene.cameras.Cam_Desk, W / H);

export const boardCorners = (scene) => scene.chalkboard.corners_TL_TR_BR_BL;
export const paperCorners = (scene) => scene.paperAnchor.corners_TL_TR_BR_BL;
export const projectAll = (pose, W, H, pts) => pts.map((p) => project(pose, W, H, p));

// ---- homography (4 points) -> CSS matrix3d --------------------------------
export function homography(src, dst) {
  const A = [], b = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i], { x: u, y: v } = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  for (let c = 0; c < 8; c++) { // gauss-jordan with partial pivoting
    let m = c;
    for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[m][c])) m = r;
    [A[c], A[m]] = [A[m], A[c]]; [b[c], b[m]] = [b[m], b[c]];
    for (let r = 0; r < 8; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let k = c; k < 8; k++) A[r][k] -= f * A[c][k];
      b[r] -= f * b[c];
    }
  }
  const h = b.map((v, i) => v / A[i][i]);
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
}
export function matrix3d(h) { // transform-origin must be 0 0
  const f = (n) => +n.toFixed(6);
  return `matrix3d(${[h[0], h[3], 0, h[6], h[1], h[4], 0, h[7], 0, 0, 1, 0, h[2], h[5], 0, h[8]].map(f).join(',')})`;
}
export const rectCorners = (x, y, w, h) => [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];
export const lerpQuad = (a, b, t) => a.map((p, i) => ({ x: p.x + (b[i].x - p.x) * t, y: p.y + (b[i].y - p.y) * t }));

// Poster re-projection: matrix3d that maps the poster box (as drawn for `from`) onto how `to` would see it.
export function reprojectMatrix(from, to, W, H) {
  const src = rectCorners(0, 0, W, H);
  const dst = src.map((c) => {
    const d = ray(from, W, H, c.x, c.y);
    return project(to, W, H, [to.pos[0] + d[0], to.pos[1] + d[1], to.pos[2] + d[2]]);
  });
  return matrix3d(homography(src, dst));
}

export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOut = (t) => 1 - Math.pow(1 - t, 3);
