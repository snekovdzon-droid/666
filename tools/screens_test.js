// Скриншоты окон: повышение уровня, пауза, итоги забега
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const dir = process.env.SHOTDIR || '.';
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; p.on('pageerror', e => errs.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.goto('file://' + path.resolve(process.argv[2] || 'index.html')); await p.waitForTimeout(3000);
  const E = f => p.evaluate(f);
  await p.click('[data-a=single]'); await p.click('#goBtn'); await p.evaluate(() => { const m = document.getElementById('mapPick'); if (m && getComputedStyle(m).display !== 'none') document.querySelector('#mpList .mp').click(); }); await p.waitForTimeout(1200);
  await E(() => { G.god = true; G.noSpawn = true; zombies.length = 0; for (const id of ['grenade', 'turret', 'medkit']) giveItem(player, id); giveDevice(player, 'drone'); giveAttach(player, 'laser'); G.level = 7; player.known.grenade = 2; });
  for (let k = 0; k < 3; k++) { await E(() => { G.pickQueue.push(0); }); await p.waitForTimeout(900); if (k === 0) await p.screenshot({ path: dir + '/s1_levelup.png' }); await E(() => { pickCard(0); }); }
  await E(() => { G.pickQueue.push(0); }); await p.waitForTimeout(700); await E(() => { LV.readyAt = 0; pickCard(0); });
  await E(() => { G.paused = true; }); await p.waitForTimeout(700); await p.screenshot({ path: dir + '/s2_pause.png' });
  await E(() => { G.paused = false; G.t = 733; G.kills = 241; G.killsBy = { walker: 150, runner: 41, fat: 20, armored: 14, brute: 6, spitter: 5, screamer: 3, hound: 2 }; G.bossKills = 1; G.bossN = 1; endRun(false); });
  await p.waitForTimeout(2000); await p.screenshot({ path: dir + '/s3_over.png' });
  await p.click('#mainBtn'); await p.waitForTimeout(600);
  console.log('после «Главное меню»:', await E(() => G.state));
  console.log(errs.length ? errs.join('\n') : 'OK: ошибок нет'); await b.close();
})();
