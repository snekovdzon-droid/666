'use strict';
/* ---------- Бочки из воксельных моделей (assets/props → src/02e_prop_assets.js): обычная и красная взрывная ---------- */
const PROPG = {}, PROP_MAT = new THREE.MeshLambertMaterial({ vertexColors: true });
function propGeo(id, height) {                                       // геометрия вокруг вертикальной оси: ноль — центр основания, высота height (м)
  if (PROPG[id]) return PROPG[id];
  const m = parseGunVox(PROP_VOX[id]), [sx, sy, sz] = m.size, vs = height / sz, occ = new Set(m.vox.map(v => v[0] + sx * (v[1] + sy * v[2])));
  const has = (x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < sx && y < sy && z < sz && occ.has(x + sx * (y + sy * z));
  const P = [], N = [], C = [], I = [], col = new THREE.Color(), toG = (x, y, z) => [(x - sx / 2) * vs, z * vs, -(y - sy / 2) * vs];
  // v0.46: жадное слияние граней одного цвета в прямоугольники — в разы меньше треугольников (вид тот же)
  const S3 = [sx, sy, sz], cmap = new Map(); for (const [x, y, z, ci] of m.vox) cmap.set(x + sx * (y + sy * z), ci);
  const cAt = (x, y, z) => cmap.get(x + sx * (y + sy * z)) || 0, lin = [];
  for (let i = 0; i < 256; i++) { const p4 = i * 4; col.setRGB(m.pal[p4] / 255, m.pal[p4 + 1] / 255, m.pal[p4 + 2] / 255).convertSRGBToLinear(); lin.push([col.r, col.g, col.b]); }
  for (let a = 0; a < 3; a++) for (const sg of [-1, 1]) {
    const u = (a + 1) % 3, v = (a + 2) % 3, U = S3[u], V = S3[v], mask = new Int32Array(U * V), n = [0, 0, 0]; n[a] = sg;
    for (let d = 0; d < S3[a]; d++) {
      mask.fill(0);
      for (let j = 0; j < V; j++) for (let i = 0; i < U; i++) { const p = [0, 0, 0]; p[a] = d; p[u] = i; p[v] = j; const c = cAt(p[0], p[1], p[2]); if (c && !has(p[0] + n[0], p[1] + n[1], p[2] + n[2])) mask[i + j * U] = c; }
      for (let j = 0; j < V; j++) for (let i = 0; i < U;) {
        const c = mask[i + j * U]; if (!c) { i++; continue; }
        let w = 1; while (i + w < U && mask[i + w + j * U] === c) w++;
        let h = 1; grow: while (j + h < V) { for (let k = 0; k < w; k++) if (mask[i + k + (j + h) * U] !== c) break grow; h++; }
        for (let jj = 0; jj < h; jj++) for (let k = 0; k < w; k++) mask[i + k + (j + jj) * U] = 0;
        const base = P.length / 3, cs = sg > 0 ? [[0, 0], [w, 0], [w, h], [0, h]] : [[0, 0], [0, h], [w, h], [w, 0]], L = lin[c - 1];
        for (const [cu, cv] of cs) { const q = [0, 0, 0]; q[a] = d + (sg > 0 ? 1 : 0); q[u] = i + cu; q[v] = j + cv; P.push(...toG(q[0], q[1], q[2])); N.push(n[0], n[2], -n[1]); C.push(L[0], L[1], L[2]); }
        I.push(base, base + 1, base + 2, base, base + 2, base + 3);
        i += w;
      }
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
