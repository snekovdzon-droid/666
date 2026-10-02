// Скриншоты интерфейса в бою: одиночная игра и кооп. SHOTDIR=папка
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const dir = process.env.SHOTDIR || '.';
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; p.on('pageerror', e => errs.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.goto('file://' + path.resolve(process.argv[2] || 'index.html')); await p.waitForTimeout(3000);
  const E = f => p.evaluate(f);
  await p.click('[data-a=single]'); await p.click('#goBtn'); await p.evaluate(() => { const m = document.getElementById('mapPick'); if (m && getComputedStyle(m).display !== 'none') document.querySelector('#mpList .mp').click(); }); await p.waitForTimeout(1200);
  await E(() => {
    G.god = true; zombies.length = 0; G.noSpawn = true;
    for (const id of ['grenade', 'molotov', 'turret', 'wire', 'flash', 'claymore']) for (let i = 0; i < 2; i++) giveItem(player, id);
    giveDevice(player, 'drone'); giveDevice(player, 'hook'); giveDevice(player, 'inject'); giveDevice(player, 'dog'); giveAttach(player, 'laser'); giveAttach(player, 'light');
    player.hp = 3; player.armor = 1; player.hand = 'grenade';
    spawnCrate(player.x + 3, player.z - 1, true); spawnCrate(player.x - 2, player.z + 2, false); dropItem('medkit', player.x + 1, player.y, player.z + 3);
    for (let i = 0; i < 25; i++) spawnZombie(['walker', 'runner', 'fat', 'armored', 'brute', 'spitter'][i % 6], { x: player.x + rnd(-14, 14), z: player.z + rnd(-14, 14) });
    G.t = 599.9; G.noSpawn = false; G.spawnAcc = -999;
  });
  await p.waitForTimeout(3500);
  await E(() => { const B = G.boss; if (B) { B.x = player.x + 20; B.z = player.z - 18; } });
  await p.waitForTimeout(1200);
  await p.screenshot({ path: dir + '/h1_single.png' });
  // кооп
  await E(() => { toMenu(); });
  await p.waitForTimeout(300);
  await E(() => { mmEnter(); });
  await p.click('[data-a=coop]'); await p.click('#goBtn'); await p.evaluate(() => { const m = document.getElementById('mapPick'); if (m && getComputedStyle(m).display !== 'none') document.querySelector('#mpList .mp').click(); }); await p.click('#goBtn'); await p.evaluate(() => { const m = document.getElementById('mapPick'); if (m && getComputedStyle(m).display !== 'none') document.querySelector('#mpList .mp').click(); }); await p.waitForTimeout(1500);
  await E(() => { G.god = true; G.noSpawn = true; for (const q of players) { giveItem(q, 'grenade'); giveItem(q, 'sandbags'); giveDevice(q, 'magnet'); q.hp = 2; } });
  await p.waitForTimeout(800); await p.screenshot({ path: dir + '/h2_coop.png' });
  console.log(errs.length ? errs.join('\n') : 'OK: ошибок нет'); await b.close();
})();
