// Экскурсия по карте: игрок телепортируется в ключевые места, скриншоты в SHOTDIR (ночью — с прожекторами)
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const dir = process.env.SHOTDIR || '.';
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('index.html')); await p.waitForTimeout(3500);
  await p.click('[data-a=single]'); await p.click('#goBtn'); await p.waitForTimeout(1200);
  const E = f => p.evaluate(f);
  await p.evaluate(n => { G.god = true; G.noSpawn = true; zombies.length = 0; G.nightT = n; }, +(process.env.NIGHT || 0));
  const spots = JSON.parse(process.env.SPOTS || '[["yard",48,46],["alley",48,14],["wcorr",10,57],["garage",16,77],["carzer",70,78],["boiler",84,12],["sport",84,44]]');
  for (const [name, x, z] of spots) {
    await p.evaluate(([x, z]) => { player.x = x; player.z = z; player.y = floorAt(x, z, 0); CAM.x = x; CAM.z = z; }, [x, z]);
    await p.waitForTimeout(1500); await p.screenshot({ path: `${dir}/tour_${name}.png` });
  }
  console.log(errs.join('\n') || 'OK'); await b.close();
})();
