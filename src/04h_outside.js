'use strict';
/* ---------- За забором: земля, деревья, кусты и камни вокруг карты ----------
   Доступа туда нет (граница карты не пускает), но с края карты через забор видно не пропасть, а продолжение местности. */
const OUTSIDE = { g: null, R: 64 };
function buildOutside(def) {
  if (OUTSIDE.g) { scene.remove(OUTSIDE.g); OUTSIDE.g = null; }
  const R = OUTSIDE.R, T = MAP + 2 * R, PPM = 5, W = T * PPM, g = new THREE.Group(); scene.add(g); OUTSIDE.g = g;
  // земля: земля и трава пятнами, серые россыпи, блоками по 3 пикселя
  const cv = document.createElement('canvas'); cv.width = cv.height = W; const cx = cv.getContext('2d'), img = cx.createImageData(W, W), d = img.data;
  for (let py = 0; py < W; py++) for (let px = 0; px < W; px++) {
    const x = px / PPM - R, z = py / PPM - R, n = hash2(px / 3 | 0, py / 3 | 0, 51), big = vnoise(x / 16, z / 16, 61), mid = vnoise(x / 5, z / 5, 67);
    let c = big > 0.52 ? (n < 0.5 ? [84, 108, 60] : [78, 100, 56]) : (n < 0.5 ? [124, 90, 58] : [118, 86, 55]);
    if (mid > 0.7 && big <= 0.52) c = n < 0.5 ? [112, 106, 96] : [104, 98, 88];                             // каменистые проплешины
    if (hash2(px, py, 71) < 0.03) c = [c[0] * 0.8, c[1] * 0.8, c[2] * 0.8];
    const k = 1 + (vnoise(x / 3, z / 3, 73) - 0.5) * 0.14, o = (py * W + px) * 4; d[o] = c[0] * k; d[o + 1] = c[1] * k; d[o + 2] = c[2] * k; d[o + 3] = 255;
  }
  cx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv); tex.magFilter = THREE.NearestFilter; tex.encoding = THREE.sRGBEncoding;
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(T, T).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: tex })); plane.position.set(MAP / 2, -0.012, MAP / 2); plane.receiveShadow = true; g.add(plane);
  // деревья, кусты и камни — только вне карты, не ближе 2,5 м к забору
  let s = 8871 + (def.name || '').length * 131; const rnd1 = () => (s = (s * 16807) % 2147483647) / 2147483647, spots = [];
  const spot = (min, minD, maxD) => {
    for (let i = 0; i < 60; i++) {
      const x = -R + rnd1() * T, z = -R + rnd1() * T, dx = Math.max(-x, 0, x - MAP), dz = Math.max(-z, 0, z - MAP), dist = Math.hypot(dx, dz);
      if (dist < minD || dist > maxD || (dx === 0 && dz === 0)) continue;
      if (spots.some(p => (p[0] - x) ** 2 + (p[1] - z) ** 2 < min * min)) continue;
      spots.push([x, z]); return [x, z];
    }
    return null;
  };
  const clone = (name, x, z, sc) => { const src = MODELS[name], D = MODEL_DEF[name] || { scale: 1, oy: 0 }; if (!src) return; const m = src.clone(), k = D.scale * sc; m.scale.setScalar(k); m.rotation.y = rnd1() * 6.28; m.position.set(x, D.oy * k, z); m.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = true; }); g.add(m); };
  const nT = Math.round(T * T / 90), nB = Math.round(T * T / 55);
  for (let i = 0; i < nT; i++) { const p = spot(4.5, 3, R - 3); if (p) clone('tree', p[0], p[1], 0.9 + rnd1() * 0.7); }
  for (let i = 0; i < nB; i++) { const p = spot(2.2, 2.5, R - 2); if (p) clone('bush', p[0], p[1], 0.8 + rnd1() * 0.9); }
  // камни из кубиков: кучки по 3–6 штук
  const B = newBatch(), RC = [[112, 108, 102], [128, 124, 116], [98, 94, 90]];
  for (let i = 0; i < Math.round(T * T / 140); i++) {
    const p = spot(3, 2.5, R - 2); if (!p) continue; const n = 3 + Math.floor(rnd1() * 4);
    for (let k = 0; k < n; k++) { const sz = 0.3 + rnd1() * 0.7, c = RC[Math.floor(rnd1() * 3)]; pushBox(B, p[0] + (rnd1() - 0.5) * 1.6, sz * 0.4 * (k > 2 ? 1.6 : 1), p[1] + (rnd1() - 0.5) * 1.6, sz, sz * 0.8, sz * (0.7 + rnd1() * 0.5), rnd1() * 3, (c[0] << 16) | (c[1] << 8) | c[2]); }
  }
  if (B.pos.length) { const m = batchMesh(B, true); staticGroup.remove(m); g.add(m); }
}
