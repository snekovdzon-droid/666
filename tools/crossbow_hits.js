// Проверка арбалета на строю из 4 зомби: пробитие, лужа/след, взрывы, липкий болт, веер последнего болта. node tools/crossbow_hits.js
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 800, height: 450 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + require('path').resolve(process.argv[2] || 'index.html') + ''); await p.waitForTimeout(3500);
  await p.evaluate(() => { G.nPlayers = 1; G.gun = 'crossbow'; G.guns = ['crossbow']; startRun(); }); await p.waitForTimeout(2000);
  const res = await p.evaluate(async () => {
    G.god = true; G.noSpawn = true; G.timeScale = 3; debugGun('crossbow'); const out = {};
    const pk = id => givePerk(player, PERKS.find(u => u.id === id));
    const setup = br => { player.lv = {}; player.branch = br; zombies.length = 0; bullets.length = 0; fireStrips.length = 0; player.x = 20; player.z = 20; player.yaw = 0; player.reloadT = 0; player.cool = 0; };
    const line = () => { for (let i = 0; i < 4; i++) { spawnZombie('walker', { x: 20, z: 23 + i * 0.9 }, false, true); } zombies.forEach((z, i) => { z.x = 20; z.z = 23 + i * 0.9; z.hp = z.maxHp = 1000; z.speed = 0; z.stunT = 99; }); };
    const fire = () => { player.cool = 99; player.ammo = wStat(player).mag; shoot(player, wStat(player), null, 1, 1); };
    const run = async ms => { const t0 = G.t; while (G.t < t0 + ms / 1000 * 1.0) await new Promise(r => setTimeout(r, 30)); };
    const hp = () => zombies.map(z => Math.round(1000 - z.hp)).join(',');
    setup(null); line(); fire(); await run(100); out.dbg = bullets.map(b => ({ pierce: b.pierce, hits: b.hits.length, y: +b.y.toFixed(2), z: +b.z.toFixed(2) })); out.zy = zombies.map(z => [+z.x.toFixed(2), +z.z.toFixed(2), +z.y.toFixed(2), z.dead]);
    setup(null); line(); out.pos = zombies.map(z => z.x.toFixed(2) + ',' + z.z.toFixed(2)).join(' '); out.pl = player.x + ',' + player.z + ' ' + player.y; fire(); await run(1000); out.base = hp();
    setup(null); pk('cb_heavy'); line(); fire(); await run(1000); out.heavy = hp();
    setup('fire'); ['cb_fire', 'cb_fire', 'cb_fire', 'cb_trail'].forEach(pk); line(); fire(); await run(1000); out.fire = { hp: hp(), strips: fireStrips.length, burning: zombies.filter(z => z.burnT > 0).length };
    setup('boom'); ['cb_boom', 'cb_charge'].forEach(pk); line(); fire(); await run(1000); out.boom = hp();
    setup('boom'); ['cb_boom', 'cb_sticky'].forEach(pk); line(); fire(); await run(150); const early = hp(); await run(1000); out.sticky = { early, late: hp() };
    setup('drum'); ['cb_mag','cb_vol','cb_vol','cb_vol','cb_last'].forEach(pk); line(); player.ammo = 1; shoot(player, wStat(player), null, 1, 1); out.lastFan = bullets.length;
    return out;
  });
  console.log(JSON.stringify(res), errs.join('|') || 'no errors'); await b.close();
})();
