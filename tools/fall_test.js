// Спрыгиваем с крыши: парапета нет, падение ранит на 1 сердце; дробовик убивает ходока одним выстрелом
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 700, height: 450 } }); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + path.resolve(process.argv[2] || 'index.html')); await p.waitForTimeout(3500);
  await p.click('[data-a=single]'); await p.click('#goBtn'); await p.evaluate(() => { const m = document.getElementById('mapPick'); if (m && getComputedStyle(m).display !== 'none') document.querySelector('#mpList .mp').click(); }); await p.waitForTimeout(1500);
  const out = await p.evaluate(async () => {
    G.noSpawn = true; zombies.length = 0; const L = LADS[0], Bd = buildings.find(b => b.H === L.H) || buildings[0];
    const hp0 = player.hp; player.x = L.lx; player.z = L.lz; player.y = L.H; player.vy = 0; player.inv = 0; G.timeScale = 1;
    let fx = 0, fz = 0; for (let x = 10; x < 90 && !fx; x += 1) for (let z = 10; z < 90; z += 1) if (floorAt(x, z, 8, 0.3) < 0.01 && !blocked(x, z, 0, 0.6)) { fx = x; fz = z; break; }
    player.x = fx; player.z = fz; player.y = 5; player.vy = 0; G.timeScale = 3; for (let k = 0; k < 60 && player.y > 0.01; k++) await new Promise(r => setTimeout(r, 250));
    const fell = { y: +player.y.toFixed(2), hp: player.hp, hp0, st: G.state, fx, fz };
    // дробовик
    const out2 = {}; player.hp = 5; G.timeScale = 1; zombies.length = 0; let killed = 0, n = 0;
    for (let t = 0; t < 10; t++) { zombies.length = 0; player.x = fx; player.z = fz; player.y = 0; const z = spawnZombie('walker', { x: fx, z: fz + 3 }); z.y = 0; z.speed = 0; z.hp = 25; z.mhp = 25;
      player.gun = 'shotgun'; player.yaw = 0; shoot(player, wStat(player), null, 1, 1); n++; const t0 = G.t; for (let k = 0; k < 80 && G.t < t0 + 1; k++) await new Promise(r => setTimeout(r, 150)); if (z.dead) killed++; }
    out2.killed = killed; out2.n = n;
    return { fell, ...out2 };
  });
  console.log(JSON.stringify(out)); console.log(errs.join('\n') || 'OK'); await b.close();
})();
