// Сравнение: сколько зомби из разбросанных по карте доходят до игрока за фиксированное время
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 600, height: 400 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(i => { window.__mi = i; }, +(process.env.MI || 0)); await p.goto('file://' + path.resolve(process.argv[2])); await p.waitForTimeout(3500);
  await p.click('[data-a=single]'); await p.click('#goBtn'); await p.evaluate(() => { const m = document.getElementById('mapPick'); if (m && getComputedStyle(m).display !== 'none') document.querySelectorAll('#mpList .mp')[+(window.__mi||0)].click(); }); await p.waitForTimeout(1500);
  await p.evaluate(() => {
    G.god = true; G.noSpawn = true; zombies.length = 0; G.timeScale = 8; Math.seedrandom;
    let s = 12345; const R = () => (s = (s * 16807) % 2147483647) / 2147483647; let n = 0, tries = 0;
    while (n < 40 && tries++ < 4000) { const x = 3 + R() * (MAP - 6), z = 3 + R() * (MAP - 6); if (Math.hypot(x - player.x, z - player.z) < 25) continue; if (blocked(x, z, 0, 0.4) || floorAt(x, z, 0.5) > 0.01) continue; const z0 = spawnZombie('walker', { x, z }); z0.y = 0; z0.speed = 2.2; n++; }
    window.T0 = G.t; window.D0 = zombies.map(z => Math.hypot(z.x - player.x, z.z - player.z));
  });
  let r; for (let k = 0; k < 60; k++) { await p.waitForTimeout(1000); r = await p.evaluate(() => ({ t: G.t - T0, near: zombies.filter(z => Math.hypot(z.x - player.x, z.z - player.z) < 4).length, n: zombies.length })); if (r.t > 70) break; }
  console.log(process.argv[2].slice(-30), JSON.stringify(r), errs.join('') || 'OK'); await b.close();
})();
