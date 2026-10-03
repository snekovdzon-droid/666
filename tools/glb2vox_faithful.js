// GLB → .vox «как есть»: цвета из текстуры без упрощения (до 64 цветов), чтобы поправить в MagicaVoxel.
// node tools/glb2vox_faithful.js <файл.glb> <выход.vox> <вокселей по высоте> [цветов=64]
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const [inp, outp, N, K = 64] = [process.argv[2], process.argv[3], +process.argv[4], +(process.argv[5] || 64)];
function kmeans(pts, K, it = 10) {
  let cs = []; for (let i = 0; i < K; i++) cs.push(pts[Math.floor((i + 0.5) * pts.length / K)].slice(0, 3));
  for (let t = 0; t < it; t++) { const sum = cs.map(() => [0, 0, 0, 0]); for (const p of pts) { let b = 0, bd = 1e9; cs.forEach((c, i) => { const d = (c[0] - p[0]) ** 2 + (c[1] - p[1]) ** 2 + (c[2] - p[2]) ** 2; if (d < bd) { bd = d; b = i; } }); sum[b][0] += p[0]; sum[b][1] += p[1]; sum[b][2] += p[2]; sum[b][3]++; } cs = cs.map((c, i) => sum[i][3] ? [sum[i][0] / sum[i][3], sum[i][1] / sum[i][3], sum[i][2] / sum[i][3]] : c); }
  return cs.map(c => c.map(Math.round));
}
function writeVox(size, voxels, pal) {
  const chunk = (id, data, kids = Buffer.alloc(0)) => { const h = Buffer.alloc(12); h.write(id, 0); h.writeUInt32LE(data.length, 4); h.writeUInt32LE(kids.length, 8); return Buffer.concat([h, data, kids]); };
  const sz = Buffer.alloc(12); size.forEach((v, i) => sz.writeUInt32LE(v, i * 4));
  const xy = Buffer.alloc(4 + voxels.length * 4); xy.writeUInt32LE(voxels.length, 0); voxels.forEach((v, i) => { for (let k = 0; k < 4; k++) xy[4 + i * 4 + k] = v[k]; });
  const rg = Buffer.alloc(1024); pal.forEach((c, i) => { rg[i * 4] = c[0]; rg[i * 4 + 1] = c[1]; rg[i * 4 + 2] = c[2]; rg[i * 4 + 3] = 255; });
  return Buffer.concat([Buffer.from('VOX '), Buffer.from(new Uint32Array([150]).buffer), chunk('MAIN', Buffer.alloc(0), Buffer.concat([chunk('SIZE', sz), chunk('XYZI', xy), chunk('RGBA', rg)]))]);
}
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files'] });
  const p = await b.newPage(); p.on('pageerror', e => console.log('ERR', e.message)); await p.goto('file://' + path.join(__dirname, 'glb2vox.html'));
  const r = await p.evaluate(([u, n]) => voxelize(u, n, 'y'), ['file://' + path.resolve(inp), N]);
  const vox = r.vox, cs = kmeans(vox.map(v => [v[3], v[4], v[5]]), K);
  const out = vox.map(v => { let bi = 0, bd = 1e9; cs.forEach((c, i) => { const d = (c[0] - v[3]) ** 2 + (c[1] - v[4]) ** 2 + (c[2] - v[5]) ** 2; if (d < bd) { bd = d; bi = i; } }); return [v[0], v[2], v[1], bi + 1]; });   // .vox: Z — вверх
  const sx = Math.max(...out.map(v => v[0])) + 1, sy = Math.max(...out.map(v => v[1])) + 1, sz = Math.max(...out.map(v => v[2])) + 1;
  fs.writeFileSync(outp, writeVox([sx, sy, sz], out, cs)); console.log(outp, 'size', [sx, sy, sz], 'voxels', out.length, 'colors', cs.length); await b.close();
})();
