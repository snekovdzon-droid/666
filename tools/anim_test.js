// Анимации: позы героя и походки зомби в застывшем кадре
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const dir = process.env.SHOTDIR || '.';
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 700, height: 500 } }); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + path.resolve(process.argv[2] || 'index.html')); await p.waitForTimeout(3500);
  await p.click('[data-a=single]'); await p.click('#goBtn'); await p.evaluate(() => { const m = document.getElementById('mapPick'); if (m && getComputedStyle(m).display !== 'none') document.querySelector('#mpList .mp').click(); }); await p.waitForTimeout(1500);
  await p.evaluate(() => { G.god = true; G.noSpawn = true; zombies.length = 0; CAM.zoomT = 2.6; player.gun = 'rifle'; let fx = 0, fz = 0; for (let x = 10; x < 90 && !fx; x++) for (let z = 10; z < 90; z++) if (!blocked(x, z, 0, 1.6) && floorAt(x, z, 8, 0.3) < 0.01) { fx = x; fz = z; break; } window.OPEN = [fx, fz]; player.x = fx; player.z = fz; CAM.x = fx; CAM.z = fz; });
  const shot = async (name, setup) => {
    await p.evaluate(setup); await p.waitForTimeout(1500); await p.evaluate(() => { G.timeScale = 0.0005; }); await p.waitForTimeout(1800);
    await p.screenshot({ path: `${dir}/an_${name}.png`, clip: { x: 200, y: 110, width: 300, height: 280 } });
    await p.evaluate(() => { G.timeScale = 1; player.reloadK = 0; });
  };
  const force = f => `(() => { ${f} })()`;
  await shot('walk', () => { G.timeScale = 1; player.moving = true; player.phase = 1.3; player.an.spd = 1; player.reloadT = 0; });
  await shot('run', () => { player.moving = true; player.sprinting = true; player.phase = 1.3; player.an.spd = 1.2; });
  await shot('reload_mag', () => { player.sprinting = false; player.moving = false; player.an.spd = 0; player.reloadT = 1; player.reloadMax = 2; player.reloadK = 0.38; });
  await shot('reload_sg', () => { player.gun = 'shotgun'; player.reloadK = 0.4; });
  await shot('reload_rv', () => { player.gun = 'revolver'; player.reloadK = 0.4; });
  await shot('climb', () => { player.reloadK = 0; const L = LADS[0]; player.climb = { L, dir: 1 }; player.y = 2; });
  await p.evaluate(() => { player.climb = null; player.y = 0; player.x = OPEN[0]; player.z = OPEN[1]; zombies.length = 0; for (let g = 0; g < 4; g++) { const z = spawnZombie('walker', { x: player.x + 0.9 + g * 0.7, z: player.z - 0.4 + g * 0.5 }); z.gait = g; z.speed = 0; z.moving = true; z.phase = 1.4 + g; z.born = -9; } });
  await shot('zombies', () => { CAM.zoomT = 2.4; });
  console.log(errs.join('\n') || 'OK'); await b.close();
})();
