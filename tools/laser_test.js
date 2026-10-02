// ЛЦУ на крыше и на лестнице: где луч, куда смотрит
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const dir = process.env.SHOTDIR || '.';
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1000, height: 640 } }); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + path.resolve(process.argv[2] || 'index.html')); await p.waitForTimeout(3500);
  await p.click('[data-a=single]'); await p.click('#goBtn'); await p.evaluate(() => { const m = document.getElementById('mapPick'); if (m && getComputedStyle(m).display !== 'none') document.querySelector('#mpList .mp').click(); }); await p.waitForTimeout(1500);
  const info = async tag => p.evaluate(tag => { const v = ATTV.get(player), bm = v && v.beam; return { tag, vis: bm && bm.visible, len: bm && +bm.scale.z.toFixed(2), pitch: +(player.pitch || 0).toFixed(2), py: +player.y.toFixed(2), yaw: +player.yaw.toFixed(2), climb: !!player.climb, mzy: +muzzleOf(player).y.toFixed(2) }; }, tag);
  await p.evaluate(() => { G.god = true; G.noSpawn = true; zombies.length = 0; G.timeScale = 3; giveAttach(player, 'laser'); const L = LADS[0]; window.TL = L; player.x = L.lx - L.nx * 2; player.z = L.lz - L.nz * 2; player.y = L.H; player.vy = 0; CAM.zoomT = 4;
    const z = spawnZombie('walker', { x: L.bx + L.nx * 5, z: L.bz + L.nz * 5 }); z.y = 0; z.speed = 0; });
  await p.waitForTimeout(2500); console.log(JSON.stringify(await info('roof')));
  await p.screenshot({ path: dir + '/laser_roof.png' });
  await p.evaluate(() => { const L = TL; player.x = L.bx; player.z = L.bz; player.y = 0; player.climb = { L, dir: 1 }; player.y = 2; });
  await p.waitForTimeout(800); console.log(JSON.stringify(await info('ladder')));
  await p.screenshot({ path: dir + '/laser_ladder.png' });
  console.log(errs.join('\n') || 'OK'); await b.close();
})();
