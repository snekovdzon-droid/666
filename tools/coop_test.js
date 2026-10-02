// Кооп: лестница работает для каждого игрока отдельно; поворот экрана — только у своего игрока (раздельный экран); броня-карточка, инжектор
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1000, height: 600 } }); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + path.resolve(process.argv[2] || 'index.html')); await p.waitForTimeout(3000);
  const E = f => p.evaluate(f);
  await p.click('[data-a=coop]'); await p.click('#splitBtn');
  await p.click('#goBtn'); await p.evaluate(() => { const m = document.getElementById('mapPick'); if (m && getComputedStyle(m).display !== 'none') document.querySelector('#mpList .mp').click(); }); await p.click('#goBtn'); await p.evaluate(() => { const m = document.getElementById('mapPick'); if (m && getComputedStyle(m).display !== 'none') document.querySelector('#mpList .mp').click(); }); await p.waitForTimeout(1500);
  const out = {};
  out.split = await E(() => SPLIT.on);
  out.rot = await E(async () => { G.god = true; G.noSpawn = true; zombies.length = 0; const y0 = SPLIT.views.map(v => v.yawT); rotCam(players[1], 1); await new Promise(r => setTimeout(r, 2500)); return { before: y0, after: SPLIT.views.map(v => +v.yaw.toFixed(2)), camYaw: +CAM.yaw.toFixed(2) }; });
  out.ladder = await E(async () => {
    const L = LADS[0]; G.timeScale = 3; players[0].x = 5; players[0].z = 5; players[1].x = L.bx; players[1].z = L.bz; players[1].y = 0;   // первый далеко, второй у лестницы
    const p1 = players[1], orig = readControl; readControl = q => q === p1 ? Object.assign(orig(q), { wx: -L.nx, wz: -L.nz, move: 1 }) : orig(q);   // второй игрок идёт в стену у лестницы, первый далеко
    for (let k = 0; k < 40 && !p1.climb; k++) { p1.x = L.bx; p1.z = L.bz; await new Promise(r => setTimeout(r, 200)); }
    readControl = orig;
    return { climbing: !!p1.climb, y: +p1.y.toFixed(2) };
  });
  out.inject = await E(() => { const q = players[0]; giveDevice(q, 'inject'); giveDevice(q, 'inject'); return { lv: devLv(q, 'inject'), ready: q.injReady, max: devMaxOf('inject') }; });
  out.armorCard = await E(() => { const q = players[0]; q.armor = 0; givePerk(q, PERK.armor); return { armor: q.armor, left: perkAllowed(q, PERK.armor), hasItem: !!ITEMS.armor, hasMagnet: !!DEVICES.magnet }; });
  console.log(JSON.stringify(out)); console.log(errs.join('\n') || 'OK'); await b.close();
})();
