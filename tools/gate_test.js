// Проверка ворот, ящиков на фиксированных местах и наступления ночи
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1000, height: 600 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('index.html')); await p.waitForTimeout(3500);
  await p.click('[data-a=single]'); await p.click('#goBtn'); await p.evaluate(() => { const m = document.getElementById('mapPick'); if (m && getComputedStyle(m).display !== 'none') document.querySelector('#mpList .mp').click(); }); await p.waitForTimeout(1200);
  const out = await p.evaluate(async () => {
    G.god = true; G.noSpawn = true; G.timeScale = 3; zombies.length = 0; const o = {};
    const road = GATES.find(g => g.z1 > 63 && g.z1 < 65 && g.x1 === 46);
    player.x = 48; player.z = 62.2; player.y = 0;
    const open0 = road.open, blocked0 = blocked(48, 64, 0, 0.3);
    o.road_start = { open: open0, solid: blocked0 };
    o.near = !!gateNear(player);
    tryGate(player); o.after_close = { open: road.open, solid: blocked(48, 64, 0, 0.3) };
    // зомби ломают закрытые ворота
    for (let i = 0; i < 6; i++) { const z = spawnZombie('walker', { x: 47 + i * 0.5, z: 66 }); if (z) { z.x = 46.5 + i * 0.6; z.z = 64.8; z.hp = 1e5; } }
    const hp0 = road.hp; await new Promise(r => setTimeout(r, 4000));
    o.gate_hp = [Math.round(hp0), Math.round(road.hp)];
    // громила сносит ворота сразу
    const g2 = GATES.find(g => Math.abs(g.x1 - 75.9) < 0.2 && Math.abs(g.z1 - 43.5) < 0.05); o.sport_closed = !g2.open;
    zombies.length = 0; const br = spawnZombie('brute', { x: 73.5, z: 45 }); br.x = 74.6; br.z = 45; br.hp = 1e5;
    await new Promise(r => setTimeout(r, 1500)); o.sport_gate_exists_after_brute = GATES.includes(g2);
    // ночь
    const nightAt = t => { G.t = t; G.nightT = 0; for (let i = 0; i < 400; i++) updateSky(0.1); return +G.night.toFixed(2); };
    o.night = { m9: nightAt(540), m10: nightAt(600), m10_30: nightAt(630), m11: nightAt(660) };
    // фиксированные ящики
    zombies.length = 0; while (CRATES.length) removeCrate(0); G.t = 100;
    let fixed = 0, total = 0; for (let i = 0; i < 40; i++) { G.crateT = 0; CRATE.max = 99; crateTimer(0.1); }
    for (const c of CRATES) { total++; if (MAP_PRISON.crates.some(([x, z]) => Math.hypot(c.x - x, c.z - z) < 1.5)) fixed++; }
    o.crates = { total, fixed }; return o;
  });
  console.log(JSON.stringify(out, null, 1)); console.log(errs.join('\n') || 'OK'); await b.close();
})();
