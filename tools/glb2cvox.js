// GLB → цветные воксели игры (формат MH_CVOX: x, y, z, r, g, b — 6 байт на воксель, base64), вокселизация в tools/glb2vox.html.
// node tools/glb2cvox.js <файл.glb> <выход.json> <вокселей по высоте>   → { d: base64, n: [nx, ny, nz] }
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const [inp, outp, N] = [process.argv[2], process.argv[3], +process.argv[4]];
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files'] });
  const p = await b.newPage(); p.on('pageerror', e => console.log('ERR', e.message)); await p.goto('file://' + path.join(__dirname, 'glb2vox.html'));
  const r = await p.evaluate(([u, n]) => voxelize(u, n, 'y'), ['file://' + path.resolve(inp), N]);
  const n = [0, 1, 2].map(k => Math.max(...r.vox.map(v => v[k])) + 1), buf = Buffer.alloc(r.vox.length * 6);
  r.vox.forEach((v, i) => v.forEach((c, k) => { buf[i * 6 + k] = c; }));
  fs.writeFileSync(outp, JSON.stringify({ d: buf.toString('base64'), n, ext: r.ext })); console.log(outp, 'size', n, 'voxels', r.vox.length, 'extent m', r.ext.map(e => e.toFixed(2)).join('×')); await b.close();
})();
