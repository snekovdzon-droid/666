// GLB ствола → PNG для карточки класса. node tools/gunshot.js <папка с <id>.glb> <папка вывода> [опции json по id]
// Опции на ствол: {"rifle":{"flip":true,"yaw":0.3,"pitch":0.2,"roll":0,"axis":"x"}}; png — прозрачный, дуло вправо.
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const [inDir, outDir, optJson] = [process.argv[2], process.argv[3], JSON.parse(process.argv[4] || '{}')];
(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files'] });
  const p = await b.newPage(); p.on('pageerror', e => console.log('ERR', e.message)); await p.goto('file://' + path.join(__dirname, 'gunshot.html'));
  for (const f of fs.readdirSync(inDir).filter(f => f.endsWith('.glb'))) {
    const id = f.replace('.glb', '');
    const r = await p.evaluate(([u, o]) => shoot(u, o), ['file://' + path.resolve(inDir, f), optJson[id] || {}]);
    fs.writeFileSync(path.join(outDir, id + '.png'), Buffer.from(r.url.split(',')[1], 'base64')); console.log(id, 'ось', r.ax, 'размер', r.size.join('×'));
  }
  await b.close();
})();
