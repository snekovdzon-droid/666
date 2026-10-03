// Бочки (и другие предметы вокруг вертикальной оси) GLB → воксели: node tools/glb2prop.js <папка с g_<имя>.glb>
// Результат: assets/props/<имя>.vox и src/02e_prop_assets.js (PROP_VOX: base64 без внутренних вокселей)
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'assets', 'props'); fs.mkdirSync(out, { recursive: true });
const SRC = process.argv[2] || '/tmp/claude-0';
// pal — тона по яркости кластеров (от тёмного к светлому): грязная текстура Meshy заменяется чистыми оттенками одного цвета
const PROPS = { barrel: { N: 40, K: 4, pal: [[0x40, 0x44, 0x4b], [0x58, 0x5d, 0x66], [0x70, 0x76, 0x80], [0x8a, 0x90, 0x9a]] }, redbarrel: { N: 40, K: 4, pal: [[0x72, 0x16, 0x1a], [0xa0, 0x20, 0x24], [0xc6, 0x2a, 0x2c], [0xe0, 0x36, 0x32]] } };          // N — вокселей по высоте
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function kmeans(pts, K, it = 14) {
  let cs = []; for (let i = 0; i < K; i++) cs.push(pts[Math.floor((i + 0.5) * pts.length / K)].slice(0, 3));
  for (let t = 0; t < it; t++) { const sum = cs.map(() => [0, 0, 0, 0]); for (const p of pts) { let b = 0, bd = 1e9; cs.forEach((c, i) => { const d = (c[0] - p[0]) ** 2 + (c[1] - p[1]) ** 2 + (c[2] - p[2]) ** 2; if (d < bd) { bd = d; b = i; } }); sum[b][0] += p[0]; sum[b][1] += p[1]; sum[b][2] += p[2]; sum[b][3]++; } cs = cs.map((c, i) => sum[i][3] ? [sum[i][0] / sum[i][3], sum[i][1] / sum[i][3], sum[i][2] / sum[i][3]] : c); }
  return cs;
}
function writeVox(size, voxels, pal) {
  const chunk = (id, data, kids = Buffer.alloc(0)) => { const h = Buffer.alloc(12); h.write(id, 0); h.writeUInt32LE(data.length, 4); h.writeUInt32LE(kids.length, 8); return Buffer.concat([h, data, kids]); };
  const sz = Buffer.alloc(12); size.forEach((v, i) => sz.writeUInt32LE(v, i * 4));
  const xy = Buffer.alloc(4 + voxels.length * 4); xy.writeUInt32LE(voxels.length, 0); voxels.forEach((v, i) => { for (let k = 0; k < 4; k++) xy[4 + i * 4 + k] = v[k]; });
  const rg = Buffer.alloc(1024); pal.forEach((c, i) => { rg[i * 4] = c[0]; rg[i * 4 + 1] = c[1]; rg[i * 4 + 2] = c[2]; rg[i * 4 + 3] = 255; });
  const main = chunk('MAIN', Buffer.alloc(0), Buffer.concat([chunk('SIZE', sz), chunk('XYZI', xy), chunk('RGBA', rg)]));
  return Buffer.concat([Buffer.from('VOX '), Buffer.from(new Uint32Array([150]).buffer), main]);
}
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files'] });
  const p = await b.newPage(); p.on('pageerror', e => console.log('ERR', e.message)); await p.goto('file://' + path.join(__dirname, 'glb2vox.html'));
  const js = ['/* Автогенерация: tools/glb2prop.js — воксельные предметы (бочки) без внутренних вокселей, base64 .vox */', 'const PROP_VOX = {'];
  for (const id in PROPS) {
    const M = PROPS[id], r = await p.evaluate(([u, N]) => voxelize(u, N, 'y'), ['file://' + path.join(SRC, 'g_' + id + '.glb'), M.N]);
    let vox = r.vox.map(v => ({ x: v[0], y: v[1], z: v[2], c: [v[3], v[4], v[5]] }));
    // цвета: кластеры (чуть ярче и насыщеннее), потом сглаживание большинством соседей
    const cs = kmeans(vox.map(v => v.c), M.K).map(c => { const l = c[0] * .3 + c[1] * .59 + c[2] * .11; return c.map(x => clamp(Math.round((x - l) * 1.2 + l * 1.12 + 6), 16, 245)); });
    const order = cs.map((c, i) => [c[0] * .3 + c[1] * .59 + c[2] * .11, i]).sort((a, b) => a[0] - b[0]).map(e => e[1]);       // индексы по возрастанию яркости
    vox.forEach(v => { let bi = 0, bd = 1e9; cs.forEach((c, i) => { const d = (c[0] - v.c[0]) ** 2 + (c[1] - v.c[1]) ** 2 + (c[2] - v.c[2]) ** 2; if (d < bd) { bd = d; bi = i; } }); v.i = bi; });
    const key = (x, y, z) => x + ',' + y + ',' + z;
    for (let pass = 0; pass < 3; pass++) { const mp = new Map(vox.map(v => [key(v.x, v.y, v.z), v])); for (const v of vox) { const cnt = new Array(M.K).fill(0); cnt[v.i] += 4; for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) for (let dz = -2; dz <= 2; dz++) { if (!dx && !dy && !dz) continue; const n = mp.get(key(v.x + dx, v.y + dy, v.z + dz)); if (n) cnt[n.i]++; } v.j = cnt.indexOf(Math.max(...cnt)); } for (const v of vox) v.i = v.j; }
    // в .vox: X, Y — горизонталь, Z — вверх (у glb вверх Y)
    const sx = Math.max(...vox.map(v => v.x)) + 1, sy = Math.max(...vox.map(v => v.z)) + 1, sz = Math.max(...vox.map(v => v.y)) + 1;
    for (const v of vox) v.i = order.indexOf(v.i); const pal4 = M.pal;
    const all = vox.map(v => [v.x, v.z, v.y, v.i + 1]); fs.writeFileSync(path.join(out, id + '.vox'), writeVox([sx, sy, sz], all, pal4));
    const occ = new Set(all.map(v => key(v[0], v[1], v[2]))), keep = all.filter(v => ![[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].every(([a, b2, c]) => occ.has(key(v[0] + a, v[1] + b2, v[2] + c))));
    const small = writeVox([sx, sy, sz], keep, pal4); js.push('  ' + id + ": '" + small.toString('base64') + "',");
    console.log(id, 'size', [sx, sy, sz], 'voxels', all.length, '->', keep.length, 'pal', cs.map(c => c.map(x => x.toString(16).padStart(2, '0')).join('')).join(' '));
  }
  js.push('};'); fs.writeFileSync(path.join(root, 'src', '02e_prop_assets.js'), js.join('\n') + '\n'); await b.close();
})();
