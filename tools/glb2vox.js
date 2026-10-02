// GLB (Meshy) → воксельная модель оружия для игры. Запуск: node tools/glb2vox.js <папка_с_glb> [id ...]
// Результат: assets/guns/<id>.vox + src/02c_gun_assets.js (base64) и assets/guns/guns.json с метаданными хвата (правятся руками)
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'assets', 'guns'); fs.mkdirSync(out, { recursive: true });
const SRC = process.argv[2] || '/tmp/claude-0'; const only = process.argv.slice(3);
const META = JSON.parse(fs.readFileSync(path.join(out, 'guns.json'), 'utf8'));
// палитра игры: тёмная и светлая сталь, дерево и пластик (цвета снапятся к ближайшему из набора, выбранного для каждого ствола кластеризацией)
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function kmeans(pts, K, it = 12) {
  let cs = []; for (let i = 0; i < K; i++) cs.push(pts[Math.floor(i * pts.length / K)].slice(0, 3));
  for (let t = 0; t < it; t++) { const sum = cs.map(() => [0, 0, 0, 0]); for (const p of pts) { let b = 0, bd = 1e9; cs.forEach((c, i) => { const d = (c[0] - p[0]) ** 2 + (c[1] - p[1]) ** 2 + (c[2] - p[2]) ** 2; if (d < bd) { bd = d; b = i; } }); sum[b][0] += p[0]; sum[b][1] += p[1]; sum[b][2] += p[2]; sum[b][3]++; } cs = cs.map((c, i) => sum[i][3] ? [sum[i][0] / sum[i][3], sum[i][1] / sum[i][3], sum[i][2] / sum[i][3]] : c); }
  return cs;
}
function writeVox(file, size, voxels, pal) {          // MagicaVoxel .vox v150
  const chunk = (id, data, kids = Buffer.alloc(0)) => { const h = Buffer.alloc(12); h.write(id, 0); h.writeUInt32LE(data.length, 4); h.writeUInt32LE(kids.length, 8); return Buffer.concat([h, data, kids]); };
  const sz = Buffer.alloc(12); sz.writeUInt32LE(size[0], 0); sz.writeUInt32LE(size[1], 4); sz.writeUInt32LE(size[2], 8);
  const xy = Buffer.alloc(4 + voxels.length * 4); xy.writeUInt32LE(voxels.length, 0); voxels.forEach((v, i) => { xy[4 + i * 4] = v[0]; xy[5 + i * 4] = v[1]; xy[6 + i * 4] = v[2]; xy[7 + i * 4] = v[3]; });
  const rg = Buffer.alloc(1024); pal.forEach((c, i) => { rg[i * 4] = c[0]; rg[i * 4 + 1] = c[1]; rg[i * 4 + 2] = c[2]; rg[i * 4 + 3] = 255; });
  const main = chunk('MAIN', Buffer.alloc(0), Buffer.concat([chunk('SIZE', sz), chunk('XYZI', xy), chunk('RGBA', rg)]));
  fs.writeFileSync(file, Buffer.concat([Buffer.from('VOX '), Buffer.from(new Uint32Array([150]).buffer), main]));
}
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files'] });
  const p = await b.newPage(); p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('file://' + path.join(__dirname, 'glb2vox.html'));
  for (const id in META) {
    if (only.length && !only.includes(id)) continue; const M = META[id];
    const r = await p.evaluate(([u, N, ax]) => voxelize(u, N, ax), ['file://' + path.join(SRC, 'g_' + id + '.glb'), M.N, M.axis]);
    // ориентация: длинная ось → Z (дуло +Z), вверх → Y, ширина → X
    const ax = M.axis, vox = r.vox.map(v => { const o = { x: v[0], y: v[1], z: v[2] }; return { L: o[ax], U: o.y, W: ax === 'x' ? o.z : o.x, c: [v[3], v[4], v[5]] }; });
    const maxL = Math.max(...vox.map(v => v.L)), maxW = Math.max(...vox.map(v => v.W));
    for (const v of vox) { if (M.flip) { v.L = maxL - v.L; v.W = maxW - v.W; } }   // поворот на 180° вокруг вертикали (чтобы не отзеркалить)
    // палитра игры: 4 тона стали (по яркости модели: тёмный, тёмно-серый, серый, светлый) + 2 тона дерева; пятна сглаживаем большинством соседей
    const GP = [[0x24, 0x27, 0x2c], [0x3f, 0x45, 0x4d], [0x6c, 0x75, 0x7e], [0xa8, 0xb1, 0xb9], [0x6c, 0x42, 0x24], [0x9a, 0x62, 0x34]];
    const lum = c => c[0] * .3 + c[1] * .59 + c[2] * .11, ls = vox.map(v => lum(v.c)).sort((x, y) => x - y), q = f => ls[Math.floor(ls.length * f)];
    const t1 = q(0.28), t2 = q(0.72), t3 = q(0.97);
    const isWood = c => { const mx = Math.max(...c), mn = Math.min(...c); return mx > 70 && (mx - mn) / mx > 0.28 && c[0] > c[2] * 1.3 && c[0] >= c[1]; };
    for (const v of vox) v.i = isWood(v.c) ? (lum(v.c) < 105 ? 4 : 5) : lum(v.c) < t1 ? 0 : lum(v.c) < t2 ? 1 : lum(v.c) < t3 ? 2 : 3;
    const key = (x, y, z) => x + ',' + y + ',' + z;
    for (let pass = 0; pass < 3; pass++) {
      const mp = new Map(vox.map(v => [key(v.W, v.U, v.L), v]));
      for (const v of vox) { const cnt = new Array(6).fill(0); cnt[v.i] += 3; for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) { if (!dx && !dy && !dz) continue; const n = mp.get(key(v.W + dx, v.U + dy, v.L + dz)); if (n) cnt[n.i]++; } v.j = cnt.indexOf(Math.max(...cnt)); }
      for (const v of vox) v.i = v.j;
    }
    const pal = GP.map(c => c.slice()); const vv = vox.map(v => [v.W, v.U, v.L, v.i + 1]);
    // .vox: X = ширина, Y = длина (вперёд), Z = вверх — как у MagicaVoxel (у игры своя замена осей в загрузчике)
    const mx = Math.max(...vv.map(v => v[0])) + 1, my = Math.max(...vv.map(v => v[2])) + 1, mz = Math.max(...vv.map(v => v[1])) + 1;
    writeVox(path.join(out, id + '.vox'), [mx, my, mz], vv.map(v => [v[0], v[2], v[1], v[3]]), pal);
    console.log(id, 'voxels', vv.length, 'size', [mx, my, mz], 'pal', pal.map(c => c.map(x => x.toString(16).padStart(2, '0')).join('')).join(' '), fs.statSync(path.join(out, id + '.vox')).size + ' B');
  }
  await b.close();
  // сборка src/02c_gun_assets.js: base64 всех .vox + точки хвата (в метрах игры считает загрузчик)
  const lines = ['/* Автогенерация: tools/glb2vox.js (стволы из Meshy → воксели). Точки — в вокселях: [вперёд от приклада, вверх] */', 'const GUN_ASSETS = {'];
  for (const id in META) { const f = path.join(out, id + '.vox'); if (!fs.existsSync(f)) continue; const M = META[id]; lines.push('  ' + id + ': ' + JSON.stringify({ b64: fs.readFileSync(f).toString('base64'), len: M.len, stance: M.stance, grip: M.grip, fore: M.fore, muz: M.muz, eject: M.eject }) + ','); }
  lines.push('};'); fs.writeFileSync(path.join(root, 'src', '02c_gun_assets.js'), lines.join('\n') + '\n'); console.log('src/02c_gun_assets.js', fs.statSync(path.join(root, 'src', '02c_gun_assets.js')).size + ' B');
})();
