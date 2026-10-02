// Проверка подствольника (заряды по времени), крюка (перезарядка по уровням) и тесла-ранца (виден на спине, молнии)
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const dir = process.env.SHOTDIR || '.';
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; p.on('pageerror', e => errs.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.goto('file://' + path.resolve(process.argv[2] || 'index.html')); await p.waitForTimeout(3500);
  await p.click('[data-a=single]'); await p.click('#goBtn'); await p.evaluate(() => { const m = document.getElementById('mapPick'); if (m && getComputedStyle(m).display !== 'none') document.querySelector('#mpList .mp').click(); }); await p.waitForTimeout(1500);
  const sim = async sec => { const t0 = await p.evaluate(() => G.t); await p.waitForFunction(([t0, sec]) => G.t > t0 + sec, [t0, sec], { timeout: 120000, polling: 200 }); };
  const out = {};
  await p.evaluate(() => { G.god = true; G.noSpawn = true; G.timeScale = 3; zombies.length = 0; debugGun('rifle'); });
  // подствольник
  out.ubgl = await p.evaluate(async () => {
    const r = {}; givePerk(player, PERKS.find(u => u.id === 'ri_ubgl'));
    await new Promise(x => setTimeout(x, 400)); r.start = { c: player.ubglC, max: ubglMax(player), cd: ubglCd(player) };
    player.ubglC = 0; player.ubglRc = ubglCd(player) - 0.3; await new Promise(x => setTimeout(x, 900)); r.recharged = player.ubglC;
    givePerk(player, PERKS.find(u => u.id === 'ri_feed')); r.lv2 = { max: ubglMax(player), cd: ubglCd(player) };
    givePerk(player, PERKS.find(u => u.id === 'ri_feed')); r.lv3 = { max: ubglMax(player), cd: ubglCd(player) };
    return r;
  });
  // крюк
  out.hook = await p.evaluate(() => {
    const r = [];
    for (const lv of [1, 2, 3]) { player.dev = { hook: lv }; player.hookCd = 0; player.hookAnim = null; useHook(player); r.push(player.hookCd); }
    player.hookCd = 0; player.hookAnim = null; player.dev = {}; return r;
  });
  // тесла
  await p.evaluate(() => { G.nightT = 1; player.dev = {}; giveDevice(player, 'tesla'); giveDevice(player, 'tesla'); giveDevice(player, 'tesla'); giveDevice(player, 'hook'); player.ubglC = 2; player.ubglRc = 8; player.hookCd = 20; player.yaw = -2.356; CAM.zoomT = 3.2; for (let i = 0; i < 6; i++) { const z = spawnZombie('walker', { x: player.x - 3 - i * 0.7, z: player.z - 2 - (i % 3) * 0.8 }); z.speed = 0; z.hp = 1e5; } });
  await p.waitForTimeout(2500);
  await p.mouse.move(640, 30);                        // курсор вверх по экрану → герой стоит к камере спиной
  let seen = 0, shot = false;
  for (let i = 0; i < 60 && !shot; i++) { const n = await p.evaluate(() => TBOLTS.length); seen = Math.max(seen, n); if (n >= 2) { await p.evaluate(() => { G.timeScale = 0.0005; for (const B of TBOLTS) B.life = 99; }); await p.waitForTimeout(2500); await p.screenshot({ path: dir + '/tesla_zap.png' }); await p.evaluate(() => { G.timeScale = 3; }); shot = true; } else await p.waitForTimeout(120); }
  out.tesla = { maxBolts: seen, shot };
  await p.evaluate(() => { for (const z of zombies) z.x += 40; });
  await p.waitForTimeout(800); await p.screenshot({ path: dir + '/tesla_pack.png' });
  console.log(JSON.stringify(out)); console.log(errs.join('\n') || 'OK'); await b.close();
})();
