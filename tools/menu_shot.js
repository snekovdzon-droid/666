// Скриншоты главного меню: покой и кулак. node tools/menu_shot.js [файл.html] [ширина] [высота] [префикс]
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const [file, W, H, pre] = [path.resolve(process.argv[2] || 'dist/zombie-voxel.html'), +(process.argv[3] || 1280), +(process.argv[4] || 720), process.argv[5] || '/tmp/menu'];
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: W, height: H } }); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'warning' || m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + file); await p.waitForTimeout(5000);
  await p.screenshot({ path: pre + '_idle.png' });
  await p.evaluate(() => { MH.fistT = 0; MH.cb = null; }); await p.waitForFunction(() => MH.fistT > 0.7, null, { timeout: 60000, polling: 100 }); await p.evaluate(() => { MH.fistT = 0.8; }); await p.waitForTimeout(600);
  await p.screenshot({ path: pre + '_fist.png' });
  console.log(await p.evaluate(() => JSON.stringify({ fail: MH.fail, fingers: MH.fingers.length })), errs.join('|') || 'no errors'); await b.close();
})();
