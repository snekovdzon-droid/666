// Проверка раздельного экрана: 2 игрока, потом принудительно 3 и 4
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const dir = process.env.SHOTDIR || '.';
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; p.on('pageerror', e => errs.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.goto('file://' + path.resolve(process.argv[2] || 'index.html')); await p.waitForTimeout(3000);
  const E = f => p.evaluate(f);
  await p.click('[data-a=coop]'); await p.click('#splitBtn');
  console.log('кнопка:', await p.textContent('#splitBtn'));
  await p.click('#goBtn'); await p.evaluate(() => { const m = document.getElementById('mapPick'); if (m && getComputedStyle(m).display !== 'none') document.querySelector('#mpList .mp').click(); }); await p.click('#goBtn'); await p.evaluate(() => { const m = document.getElementById('mapPick'); if (m && getComputedStyle(m).display !== 'none') document.querySelector('#mpList .mp').click(); }); await p.waitForTimeout(1500);
  await E(() => { G.god = true; G.noSpawn = true; zombies.length = 0; players[1].x += 12; players[1].z -= 8; for (let i = 0; i < 20; i++) spawnZombie('walker', { x: players[i % 2].x + rnd(-6, 6), z: players[i % 2].z + rnd(-6, 6) }); });
  await p.waitForTimeout(1500);
  console.log('split:', await E(() => SPLIT.on + ' views=' + SPLIT.views.length));
  const r = await E(() => { const V = SPLIT.views[0].rect; mouse.x = V.x + V.w / 2; mouse.y = V.y + V.h / 2; const a = aimPoint(players[0], { auto: false }); return a.pt ? Math.hypot(a.pt.x - players[0].x, a.pt.z - players[0].z).toFixed(2) : 'нет'; });
  console.log('прицел курсора в центре левой половины → расстояние до игрока 1:', r);
  await p.screenshot({ path: dir + '/sp2.png' });
  await E(() => { players.push(makePlayer(2, 'rifle', players[0].x + 3, players[0].z + 3, { ctrl: 'pad', pad: 0 })); players.push(makePlayer(3, 'mg', players[1].x - 3, players[1].z + 3, { ctrl: 'pad', pad: 1 })); hudBuild(); splitStart(); });
  await p.waitForTimeout(1500); await p.screenshot({ path: dir + '/sp4.png' });
  await E(() => { players.pop(); hudBuild(); splitStart(); }); await p.waitForTimeout(1200); await p.screenshot({ path: dir + '/sp3.png' });
  console.log(errs.length ? errs.join('\n') : 'OK: ошибок нет'); await b.close();
})();
