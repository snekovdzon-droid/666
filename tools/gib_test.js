// Проверка разлёта частей: сильное убийство и взрыв; снимки в полёте и на земле; выключение в настройках
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const dir = process.env.SHOTDIR || '.';
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; p.on('pageerror', e => errs.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.goto('file://' + path.resolve(process.argv[2] || 'index.html')); await p.waitForTimeout(3500);
  await p.click('[data-a=single]'); await p.click('#goBtn'); await p.evaluate(() => { const m = document.getElementById('mapPick'); if (m && getComputedStyle(m).display !== 'none') document.querySelector('#mpList .mp').click(); }); await p.waitForTimeout(1500);
  const sim = async sec => { const t0 = await p.evaluate(() => G.t); await p.waitForFunction(([t0, sec]) => G.t > t0 + sec, [t0, sec], { timeout: 120000, polling: 100 }); };
  const out = {};
  await p.evaluate(() => { G.god = true; G.noSpawn = true; G.timeScale = 3; zombies.length = 0; CAM.zoomT = 4; for (let i = 0; i < 5; i++) { const z = spawnZombie('walker', { x: player.x - 2.5 - i * 0.6, z: player.z - 2 + (i % 2) }); z.speed = 0; z.form = 'walk'; } });
  await p.waitForTimeout(1200);
  out.weak = await p.evaluate(() => { const z = zombies.find(q => !q.dead); damageZombie(z, z.mhp * 1.05, -1, -1, 0.1); return { dead: z.dead, gibs: GIBS.length, gone: !!z.gone }; });   // слабый перебор — тело остаётся
  out.strong = await p.evaluate(() => { let n = 0, gib = 0; for (const z of zombies.filter(q => !q.dead).slice(0, 2)) { z.rwT = G.t; damageZombie(z, z.mhp * 3, -0.7, -0.7, 0.4); n++; if (z.gone) gib++; } return { kills: n, gibbed: gib, parts: GIBS.length }; });
  await sim(0.25); await p.evaluate(() => { G.timeScale = 0.0005; }); await p.waitForTimeout(2500); await p.screenshot({ path: dir + '/gib_air.png' });
  await p.evaluate(() => { G.timeScale = 3; }); await sim(4); await p.evaluate(() => { G.timeScale = 0.0005; }); await p.waitForTimeout(2500); await p.screenshot({ path: dir + '/gib_ground.png' });
  out.landed = await p.evaluate(() => ({ parts: GIBS.length, resting: GIBS.filter(g => g.rest > 0.6).length, st: GIBS.map(g => [g.k, +g.pos.y.toFixed(2), +g.t.toFixed(1), +g.life.toFixed(1), +(g.rest||0).toFixed(1), +g.sink.toFixed(2)]) }));
  // взрыв
  await p.evaluate(() => { G.timeScale = 3; clearGibs(); zombies.length = 0; for (let i = 0; i < 4; i++) { const z = spawnZombie('walker', { x: player.x - 3 - i * 0.5, z: player.z - 2 }); z.speed = 0; z.form = 'walk'; } });
  await p.waitForTimeout(800);
  out.boom = await p.evaluate(() => { const z0 = zombies.find(q => !q.dead); explode(z0.x, z0.y, z0.z, 200, 3, { hurts: false }); return { dead: zombies.filter(q => q.dead).length, parts: GIBS.length }; });
  // выключено в настройках
  out.off = await p.evaluate(() => { GIBS_ON = false; clearGibs(); const z = spawnZombie('walker', { x: player.x - 3, z: player.z - 3 }); z.rwT = G.t; damageZombie(z, z.mhp * 4, -1, -1, 0.4); GIBS_ON = true; return { parts: GIBS.length, bodyStays: !z.gone }; });
  console.log(JSON.stringify(out)); console.log(errs.join('\n') || 'OK'); await b.close();
})();
