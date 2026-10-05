// Проверка арбалета (v0.68): база, общие карточки, три пути. Запуск: node tools/crossbow_test.js [index.html]
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; p.on('pageerror', e => errs.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.goto('file://' + path.resolve(process.argv[2] || 'index.html')); await p.waitForTimeout(3500);
  await p.evaluate(() => { G.nPlayers = 1; G.gun = 'crossbow'; G.guns = ['crossbow']; startRun(); }); await p.waitForTimeout(2500);
  await p.evaluate(() => { G.god = true; G.noSpawn = true; zombies.length = 0; debugGun('crossbow'); });
  const out = await p.evaluate(async () => {
    const r = {}, pk = id => givePerk(player, PERKS.find(u => u.id === id)), st = () => { const w = wStat(player); return { dmg: +w.dmg.toFixed(1), pellets: w.pellets, pierce: w.pierce, mag: w.mag, reload: +w.reload.toFixed(2), rate: +w.rate.toFixed(2) }; };
    r.base = st();
    ['cb_multi', 'cb_multi', 'cb_heavy', 'cb_taut', 'cb_quick'].forEach(pk); r.common = st();
    r.cardsOld = PERKS.filter(u => u.gun === 'crossbow').map(u => u.id).join(',');
    // выстрел по зомби: 3 болта, у боковых 60%
    player.yaw = 0; player.x = 20; player.z = 20; player.ammo = wStat(player).mag; player.cool = 0; player.reloadT = 0;
    const n0 = bullets.length; shoot(player, wStat(player), null, 1, 1); r.bolts = bullets.slice(n0).map(b => Math.round(b.dmg));
    // пути
    for (const [br, perks] of [['fire', ['cb_fire', 'cb_fire', 'cb_fire', 'cb_trail']], ['boom', ['cb_boom', 'cb_boom', 'cb_charge', 'cb_sticky']], ['drum', ['cb_mag', 'cb_vol', 'cb_vol', 'cb_vol', 'cb_swap', 'cb_spin', 'cb_last']]]) {
      player.lv = {}; player.branch = br; perks.forEach(pk); player.ammo = wStat(player).mag; r[br] = st();
      const ids = PERKS.filter(u => u.gun === 'crossbow' && perkAllowed(player, u)).map(u => u.id); r[br + 'Allowed'] = ids.length;
    }
    return r;
  });
  console.log(JSON.stringify(out, null, 1));
  // боевой прогон по каждому пути: стрельба в толпу
  for (const br of ['fire', 'boom', 'drum']) {
    await p.evaluate(br => { player.lv = {}; player.branch = br; const pk = id => givePerk(player, PERKS.find(u => u.id === id));
      ({ fire: ['cb_fire', 'cb_fire', 'cb_fire', 'cb_trail', 'cb_multi', 'cb_multi', 'cb_crit', 'cb_silver', 'cb_fletch'], boom: ['cb_boom', 'cb_boom', 'cb_charge', 'cb_sticky', 'cb_multi'], drum: ['cb_mag', 'cb_vol', 'cb_vol', 'cb_vol', 'cb_spin', 'cb_last'] })[br].forEach(pk); player.ammo = wStat(player).mag; }, br);
    await p.evaluate(() => { G.noSpawn = false; G.t = 60; });
    await p.keyboard.down('d'); await p.mouse.move(800, 300); await p.mouse.down(); await p.waitForTimeout(5000); await p.mouse.up(); await p.keyboard.up('d');
    console.log(br, 'ok, fireStrips', await p.evaluate(() => fireStrips.length), 'kills', await p.evaluate(() => G.kills));
    await p.screenshot({ path: (process.env.SHOTDIR || '.') + '/crossbow_' + br + '.png' });
  }
  console.log(errs.length ? errs.join('\n') : 'OK: ошибок нет'); await b.close();
})();
