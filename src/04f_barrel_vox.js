'use strict';
/* ---------- Бочки из воксельных моделей (assets/props → src/02e_prop_assets.js): обычная и красная взрывная ---------- */
const PROPG = {}, PROP_MAT = new THREE.MeshLambertMaterial({ vertexColors: true });
function propGeo(id, height) {                                       // геометрия вокруг вертикальной оси: ноль — центр основания, высота height (м)
  if (PROPG[id]) return PROPG[id];
  const m = parseGunVox(PROP_VOX[id]), [sx, sy, sz] = m.size, vs = height / sz, occ = new Set(m.vox.map(v => v[0] + sx * (v[1] + sy * v[2])));
  const has = (x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < sx && y < sy && z < sz && occ.has(x + sx * (y + sy * z));
  const P = [], N = [], C = [], I = [], col = new THREE.Color(), toG = (x, y, z) => [(x - sx / 2) * vs, z * vs, -(y - sy / 2) * vs];
  for (const [x, y, z, ci] of m.vox) {
    const p4 = (ci - 1) * 4; col.setRGB(m.pal[p4] / 255, m.pal[p4 + 1] / 255, m.pal[p4 + 2] / 255).convertSRGBToLinear();
    for (let a = 0; a < 3; a++) for (const sg of [-1, 1]) {
      const n = [0, 0, 0]; n[a] = sg; if (has(x + n[0], y + n[1], z + n[2])) continue;
      const u = (a + 1) % 3, v = (a + 2) % 3, base = P.length / 3, pos = [x, y, z], cs = sg > 0 ? [[0, 0], [1, 0], [1, 1], [0, 1]] : [[0, 0], [0, 1], [1, 1], [1, 0]];
      for (const [cu, cv] of cs) { const q = pos.slice(); q[a] += sg > 0 ? 1 : 0; q[u] += cu; q[v] += cv; P.push(...toG(q[0], q[1], q[2])); N.push(n[0], n[2], -n[1]); C.push(col.r, col.g, col.b); }
      I.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setIndex(I); g.computeBoundingSphere();
  return PROPG[id] = g;
}
// бочка в (x, z): как у кодовой — 0,6 × 0,6, высота 0,9; id — 'barrel' или 'redbarrel'
function barrelVox(x, z, id) {
  const mesh = new THREE.Mesh(propGeo(id, 0.9), PROP_MAT); mesh.position.set(x, 0, z); mesh.rotation.y = ((x * 7.3 + z * 3.1) % 6.28); mesh.castShadow = mesh.receiveShadow = true;
  (BOX_PARENT || staticGroup).add(mesh);
  solids.push({ x1: x - 0.3, y1: 0, z1: z - 0.3, x2: x + 0.3, y2: 0.9, z2: z + 0.3, mat: 'metal', group: null });
}
