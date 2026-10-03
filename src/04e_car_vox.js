'use strict';
/* ---------- Машина из воксельной модели (assets/cars/car.vox → src/02d_car_asset.js) ----------
   Краска кузова (синие тона модели) перекрашивается в один из нескольких цветов; битая — темнее. Грани только снаружи, цвета в вершинах. */
const CAR_PAINTS = [0x8c3a30, 0x3e5270, 0x6e7a50, 0xc8c4ba];          // красный, синий, зелёный, светлый — «цвет» из карты подбирается ближайший
const CAR_LEN = 3.3, CARV = {};
let CAR_DATA = null;
const paintOf = col => { const c = new THREE.Color(col); let best = CAR_PAINTS[0], bd = 1e9; for (const p of CAR_PAINTS) { const q = new THREE.Color(p), d = (q.r - c.r) ** 2 + (q.g - c.g) ** 2 + (q.b - c.b) ** 2; if (d < bd) { bd = d; best = p; } } return best; };
function carData() {
  if (CAR_DATA) return CAR_DATA;
  const m = parseGunVox(CAR_VOX), [sx, sy, sz] = m.size, vs = CAR_LEN / sx, occ = new Set(m.vox.map(v => v[0] + sx * (v[1] + sy * v[2])));
  let cmin = 1e9, cmax = -1; for (const v of m.vox) if (v[2] >= sz * 0.55) { cmin = Math.min(cmin, v[0]); cmax = Math.max(cmax, v[0]); }
  return CAR_DATA = { m, sx, sy, sz, vs, occ, cab: [(cmin - sx / 2) * vs, (cmax + 1 - sx / 2) * vs] };
}
// геометрия под краску: 'p' — цвет кузова, wreck — битая (темнее). Ноль — центр по длине и ширине, на земле; длина вдоль +X, перед — в +X
function carGeo(paint, wreck) {
  const key = paint + ':' + (wreck ? 1 : 0); if (CARV[key]) return CARV[key];
  const { m, sx, sy, sz, vs, occ } = carData(), has = (x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < sx && y < sy && z < sz && occ.has(x + sx * (y + sy * z));
  const body = new THREE.Color(paint).multiplyScalar(wreck ? 0.55 : 1), body2 = body.clone().multiplyScalar(0.74), dim = wreck ? 0.8 : 1, c = new THREE.Color();
  const colOf = ci => { const p4 = (ci - 1) * 4; if (ci === 3) c.copy(body); else if (ci === 6) c.copy(body2); else c.setRGB(m.pal[p4] / 255, m.pal[p4 + 1] / 255, m.pal[p4 + 2] / 255).multiplyScalar(dim); return c.clone().convertSRGBToLinear(); };
  const toG = (x, y, z) => [(x - sx / 2) * vs, z * vs, -(y - sy / 2) * vs];                  // поворот без зеркала: X = x, Y = z (вверх), Z = -y
  const P = [], N = [], C = [], I = [];
  for (const [x, y, z, ci] of m.vox) {
    const col = colOf(ci);
    for (let a = 0; a < 3; a++) for (const sg of [-1, 1]) {
      const n = [0, 0, 0]; n[a] = sg; if (has(x + n[0], y + n[1], z + n[2])) continue;
      const u = (a + 1) % 3, v = (a + 2) % 3, base = P.length / 3, pos = [x, y, z], cs = sg > 0 ? [[0, 0], [1, 0], [1, 1], [0, 1]] : [[0, 0], [0, 1], [1, 1], [1, 0]];
      for (const [cu, cv] of cs) { const q = pos.slice(); q[a] += sg > 0 ? 1 : 0; q[u] += cu; q[v] += cv; P.push(...toG(q[0], q[1], q[2])); N.push(n[0], n[2], -n[1]); C.push(col.r, col.g, col.b); }
      I.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setIndex(I); g.computeBoundingSphere();
  return CARV[key] = g;
}
const CAR_MAT = new THREE.MeshLambertMaterial({ vertexColors: true });
// как у кодовой машины: (x, z) — угол места, alongX — длиной вдоль x; место 3,2 × 1,5, модель по центру
function voxCar(x, z, alongX, col, wreck, burn) {
  const L = 3.2, Wd = 1.5, cx = alongX ? x + L / 2 : x + Wd / 2, cz = alongX ? z + Wd / 2 : z + L / 2, D = carData(), hw = D.sy * D.vs / 2, H = D.sz * D.vs;
  const mesh = new THREE.Mesh(carGeo(paintOf(col), wreck), CAR_MAT); mesh.position.set(cx, 0, cz); mesh.rotation.y = alongX ? 0 : Math.PI / 2; mesh.castShadow = mesh.receiveShadow = true;
  (BOX_PARENT || staticGroup).add(mesh);
  const hl = CAR_LEN / 2 - 0.03, w = hw - 0.03, sol = (u1, u2, v1, v2, y1, y2) => solids.push(alongX ? { x1: cx + u1, y1, z1: cz + v1, x2: cx + u2, y2, z2: cz + v2, mat: 'metal', group: null } : { x1: cx + v1, y1, z1: cz + u1, x2: cx + v2, y2, z2: cz + u2, mat: 'metal', group: null });
  sol(-hl, hl, -w, w, 0, 0.78);                                                         // корпус (поверх капота и багажника можно стрелять)
  sol(D.cab[0] + 0.05, D.cab[1] - 0.05, -w + 0.08, w - 0.08, 0.78, H - 0.05);          // кабина
  if (burn) addFire(alongX ? x + L - 0.7 : x + Wd / 2, 0.85, alongX ? z + Wd / 2 : z + L - 0.7, 1.4);
}
