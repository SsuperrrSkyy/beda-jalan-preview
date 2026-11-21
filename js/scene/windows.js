// Window plane helper shared by shafts and dust. Works for any wall: uses each window's corners (TL,TR,BR,BL) and normal.
// Only sunlit windows (or all, when the "sunlit" flag is missing) emit light.
import * as THREE from 'three';

export function sunWindows(windows, sunDir) {
  const d = new THREE.Vector3(...sunDir).normalize();
  const out = [];
  for (const w of windows) {
    if (w.sunlit === false) continue;
    const c = w.corners_TL_TR_BR_BL.map((p) => new THREE.Vector3(...p));
    const rVec = c[1].clone().sub(c[0]), uVec = c[0].clone().sub(c[3]);
    const r = rVec.clone().normalize(), u = uVec.clone().normalize();
    let n = w.normal ? new THREE.Vector3(...w.normal).normalize() : new THREE.Vector3().crossVectors(r, u).normalize();
    let dn = d.dot(n);
    if (dn < 0 && !w.normal) { n.negate(); dn = -dn; }
    if (dn < 0.05) continue; // light does not travel into the room through this plane
    const center = c.reduce((a, p) => a.add(p), new THREE.Vector3()).multiplyScalar(0.25);
    out.push({ name: w.name, c, d, center, r, u, n, dn, hw: rVec.length() / 2, hh: uVec.length() / 2 });
  }
  return out;
}
