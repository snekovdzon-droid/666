// Телефон: кнопка огня (нет авто-стрельбы) и сильное приближение. node tools/touch_test.js [index.html]
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const c = await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve(process.argv[2] || 'index.html')); await p.waitForTimeout(3500);
  console.log('touch:', await p.evaluate(() => IS_TOUCH), await p.evaluate(() => QS.name));
  await p.evaluate(() => { G.nPlayers = 1; G.gun = 'rifle'; G.guns = ['rifle']; startRun(); }); await p.waitForTimeout(2000);
  const r = await p.evaluate(async () => {
    G.god = true; G.noSpawn = true; G.timeScale = 3; zombies.length = 0; const o = {};
    spawnZombie('walker', { x: player.x + 3, z: player.z }, false, true); zombies.forEach(z => { z.speed = 0; });
    const w = ms => new Promise(r => setTimeout(r, ms));
    const t0 = G.t; while (G.t < t0 + 1.5) await w(30); o.shotsNoBtn = player.shotN;
    act.fireT = true; const t1 = G.t; while (G.t < t1 + 1.5) await w(30); o.shotsBtn = player.shotN;
    act.fireT = false; o.btn = getComputedStyle(document.getElementById('fireBtn')).display;
    CAM.zoomT = 1; await w(50); o.zoomT = CAM.zoomT; document.querySelector('[data-k=zi]').click(); o.zoomT2 = CAM.zoomT; act.sprintT = true; o.sprint = readControl(player).sprint; act.sprintT = false; o.reloadBtn = getComputedStyle(document.getElementById('rldBtn')).display; o.hidden = ['dbgBtn','n','fs'].map(k => { const e = document.getElementById(k) || document.querySelector('[data-k=' + k + ']'); return getComputedStyle(e).display; });
    return o;
  });
  console.log(JSON.stringify(r), errs.join('|') || 'no errors'); await p.screenshot({ path: process.env.SHOT || 'touch.png' }); await b.close();
})();
