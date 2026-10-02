// Крупный план всех особых мобов в ряд (для проверки внешности): SHOT=файл.png
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 500 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('index.html')); await p.waitForTimeout(3000);
  await p.click('[data-a=single]'); await p.click('#goBtn'); await p.evaluate(() => { const m = document.getElementById('mapPick'); if (m && getComputedStyle(m).display !== 'none') document.querySelector('#mpList .mp').click(); }); await p.waitForTimeout(1000);
  await p.evaluate(() => {
    G.god = true; G.noSpawn = true; zombies.length = 0; CAM.zoomT = 2.6; CAM.zoom = 2.6;
    const types = ['walker', 'brute', 'screamer', 'spitter', 'riot', 'warden', 'hound'];
    types.forEach((t, i) => { const z = spawnZombie(t, { x: player.x + 3 + (i - 3) * 0.9, z: player.z - 3 - (i - 3) * 0.9 }); z.yaw = Math.PI * 0.75; z.speed = 0; z.moving = false; });
  });
  await p.evaluate(() => { for (const z of zombies) { z.stunT = 99; } G.paused = false; });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: process.env.SHOT || 'mobs_look.png' });
  console.log(errs.join('\n') || 'OK'); await b.close();
})();
