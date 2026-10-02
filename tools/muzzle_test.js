// Проверка вспышки, дыма и гильз: снимки с разных стволов
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const dir = process.env.SHOTDIR || '.';
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1000, height: 640 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + path.resolve(process.argv[2] || 'index.html')); await p.waitForTimeout(3500);
  await p.click('[data-a=single]'); await p.click('#goBtn'); await p.evaluate(() => { const m = document.getElementById('mapPick'); if (m && getComputedStyle(m).display !== 'none') document.querySelector('#mpList .mp').click(); }); await p.waitForTimeout(1500);
  await p.evaluate(() => { G.god = true; G.noSpawn = true; zombies.length = 0; CAM.zoomT = 3; });
  for (const gun of ['shotgun', 'rifle', 'smg', 'revolver']) {
    await p.evaluate(g => { G.timeScale = 1; const pl = player; pl.gun = g; shotFeel(pl, pl.yaw, 1); G.timeScale = 0.0005; }, gun);
    await p.waitForTimeout(1800); await p.screenshot({ path: `${dir}/muz_${gun}.png`, clip: { x: 300, y: 120, width: 400, height: 400 } });
    await p.evaluate(() => { G.timeScale = 1; }); await p.waitForTimeout(1500);
  }
  console.log(errs.join('\n') || 'OK'); await b.close();
})();
