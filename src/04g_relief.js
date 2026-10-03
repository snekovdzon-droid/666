'use strict';
/* ---------- Рельеф: серые бордюры по краям дорог и низкая обводка площадок ----------
   Всё низкое: герой и зомби заходят как на ступеньку, пули летят поверх.
   Вид «из кубиков»: верх — клетки по 0,2 м с разбросом цвета, бока — полосы. Один меш на всю карту. */
const RELIEF = { B: null, n: 0 };
const zoneTypeAt = (zones, x, z) => { let t = 'dirt'; for (const Z of zones) if (x >= Z[1] && x < Z[3] && z >= Z[2] && z < Z[4]) t = Z[0]; return t; };
const shadeC = (c, k) => [Math.min(255, c[0] * k), Math.min(255, c[1] * k), Math.min(255, c[2] * k)];
function relQuad(p0, p1, p2, p3, n, c) {
  const B = RELIEF.B, b = B.pos.length / 3, col = new THREE.Color(c[0] / 255, c[1] / 255, c[2] / 255);
  for (const p of [p0, p1, p2, p3]) { B.pos.push(p[0], p[1], p[2]); B.nor.push(n[0], n[1], n[2]); B.col.push(col.r, col.g, col.b); }
  B.idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
}
// плита (x1,z1)-(x2,z2) от высоты y0 до h: верх клетками, бока полосами; топ-цвет c; sideK — затемнение боков; колпак noTop — без верха
function relBox(x1, z1, x2, z2, y0, h, c, o = {}) {
  const cs = o.cell || 0.2, sk = o.sideK || 0.72, v = o.var || 0.1;
  if (!o.noTop) for (let x = x1; x < x2 - 1e-6; x += cs) for (let z = z1; z < z2 - 1e-6; z += cs) {
    const xe = Math.min(x2, x + cs), ze = Math.min(z2, z + cs), k = 1 + (hash2(Math.round(x * 20), Math.round(z * 20), 5) - 0.5) * 2 * v;
    relQuad([x, h, ze], [xe, h, ze], [xe, h, z], [x, h, z], [0, 1, 0], shadeC(c, k));
  }
  const side = (ax, bx, az, bz, n, alongX, flip) => {
    const L = alongX ? bx - ax : bz - az;
    for (let t = 0; t < L - 1e-6; t += 0.4) {
      const t2 = Math.min(L, t + 0.4), k = sk * (1 + (hash2(Math.round((alongX ? ax : az) * 20 + t * 20), Math.round(h * 100), 9) - 0.5) * 0.16);
      const A = alongX ? [ax + t, 0, az] : [ax, 0, az + t], Bp = alongX ? [ax + t2, 0, az] : [ax, 0, az + t2];
      const q = [[A[0], h, A[2]], [Bp[0], h, Bp[2]], [Bp[0], y0, Bp[2]], [A[0], y0, A[2]]]; if (flip) q.reverse();
      relQuad(q[0], q[1], q[2], q[3], n, shadeC(c, k));
    }
  };
  if (h > y0 + 0.001) {
    side(x1, x2, z2, z2, [0, 0, 1], true, true); side(x1, x2, z1, z1, [0, 0, -1], true, false); side(x2, x2, z1, z2, [1, 0, 0], false, false); side(x1, x1, z1, z2, [-1, 0, 0], false, true);
  }
  if (o.solid !== false) solids.push({ x1, y1: 0, z1, x2, y2: h, z2, mat: o.mat || 'concrete', group: null });
  RELIEF.n++;
}
// свободно ли место для прямоугольника: в карте, на подходящей земле, нет коробок и «служебных» точек рядом
function relFree(def, x1, z1, x2, z2, margin, types) {
  if (x1 < 3 || z1 < 3 || x2 > MAP - 3 || z2 > MAP - 3) return false;
  for (const [px, pz] of [[x1, z1], [x2, z1], [x1, z2], [x2, z2], [(x1 + x2) / 2, (z1 + z2) / 2]]) if (!types.includes(zoneTypeAt(def.zones, px, pz))) return false;
  const cx = (x1 + x2) / 2, cz = (z1 + z2) / 2, R = Math.hypot(x2 - x1, z2 - z1) / 2 + margin + 1;
  for (const s of solidsNear(cx, cz, R)) if (s.x2 > x1 - margin && s.x1 < x2 + margin && s.z2 > z1 - margin && s.z1 < z2 + margin) return false;
  const near = (arr, r) => (arr || []).some(p => p[0] > x1 - r && p[0] < x2 + r && p[1] > z1 - r && p[1] < z2 + r);
  if (near(def.crates, 2.5) || near(def.doors, 4)) return false;
  if (def.start && def.start.x > x1 - 8 && def.start.x < x2 + 8 && def.start.z > z1 - 8 && def.start.z < z2 + 8) return false;
  if (typeof LADS !== 'undefined') for (const L of LADS) if (L.bx > x1 - 3 && L.bx < x2 + 3 && L.bz > z1 - 3 && L.bz < z2 + 3) return false;
  if (typeof GATES !== 'undefined') for (const G of GATES) if ((G.x1 + G.x2) / 2 > x1 - 4 && (G.x1 + G.x2) / 2 < x2 + 4 && (G.z1 + G.z2) / 2 > z1 - 4 && (G.z1 + G.z2) / 2 < z2 + 4) return false;
  return true;
}
const CURB_TOP = [158, 158, 160], RIM_TOP = [142, 142, 144];
// бордюры: вдоль краёв дорог и асфальта (снаружи) и низкая обводка вокруг площадок
function reliefCurbs(def) {
  const zs = def.zones, road = t => t === 'road' || t === 'asphalt';
  const seg = (x, z, w, d, h, c) => { if (!solidsNear(x + w / 2, z + d / 2, 1).some(s => s.x2 > x - 0.05 && s.x1 < x + w + 0.05 && s.z2 > z - 0.05 && s.z1 < z + d + 0.05 && s.y2 > h)) relBox(x, z, x + w, z + d, 0, h, c, { cell: 0.2, var: 0.07 }); };
  for (const Z of zs) {
    const [t, x1, z1, x2, z2] = Z;
    if (road(t)) {
      const W = 0.22, H = 0.14, step = 0.5;
      for (let x = x1; x < x2; x += step) for (const [zz, dz] of [[z1 - 0.2, -W], [z2 + 0.2, 0]]) {                  // северный и южный края
        const mx = Math.min(x + step, x2), nt = zoneTypeAt(zs, (x + mx) / 2, zz); if (!road(nt) && nt !== 'court') seg(x, dz < 0 ? z1 - W : z2, mx - x, W, H, CURB_TOP);
      }
      for (let z = z1; z < z2; z += step) for (const [xx, dx] of [[x1 - 0.2, -W], [x2 + 0.2, 0]]) {                  // западный и восточный
        const mz = Math.min(z + step, z2), nt = zoneTypeAt(zs, xx, (z + mz) / 2); if (!road(nt) && nt !== 'court') seg(dx < 0 ? x1 - W : x2, z, W, mz - z, H, CURB_TOP);
      }
    } else if ((t === 'court' || t === 'dark') && (x2 - x1) * (z2 - z1) < MAP * MAP * 0.2) {                       // площадка: низкая рамка
      const W = 0.2, H = 0.1;
      for (let x = x1; x < x2; x += 0.5) { const mx = Math.min(x + 0.5, x2); seg(x, z1 - W, mx - x, W, H, RIM_TOP); seg(x, z2, mx - x, W, H, RIM_TOP); }
      for (let z = z1; z < z2; z += 0.5) { const mz = Math.min(z + 0.5, z2); seg(x1 - W, z, W, mz - z, H, RIM_TOP); seg(x2, z, W, mz - z, H, RIM_TOP); }
    }
  }
}
function buildRelief(def) {
  RELIEF.B = newBatch(); RELIEF.n = 0; indexSolids();
  reliefCurbs(def); indexSolids();
  if (RELIEF.B.pos.length) { const m = batchMesh(RELIEF.B, true); m.receiveShadow = true; }
  groundTex.needsUpdate = true; RELIEF.B = null;
}
