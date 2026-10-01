// Проверка особых мобов: запускает бой, расставляет мобов рядом с игроком и смотрит на их поведение
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const dir = process.env.SHOTDIR || '.';
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; p.on('pageerror', e => errs.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.goto('file://' + path.resolve(process.argv[2] || 'index.html')); await p.waitForTimeout(3000);
  await p.click('[data-a=single]'); await p.click('#goBtn'); await p.waitForTimeout(1500);
  const E = f => p.evaluate(f);
  const sim = async sec => { const t0 = await E(() => G.t); await p.waitForFunction(([t0, sec]) => G.t > t0 + sec, [t0, sec], { timeout: 120000, polling: 200 }); };   // ждём игровое время, а не реальное
  await E(() => { G.god = true; G.noSpawn = true; G.timeScale = 3; zombies.length = 0; });
  const out = {};
  // 1. бунтарь: щит спереди и сзади
  out.shield = await E(() => {
    const z = spawnZombie('riot', { x: player.x + 3, z: player.z }); z.yaw = 0; z.hp = 1e6; const h0 = z.hp;
    damageZombie(z, 100, 0, -1, 0);   // пуля летит на -z, зомби смотрит на +z: удар в лицо (щит)
    const front = h0 - z.hp; const h1 = z.hp;
    damageZombie(z, 100, 0, 1, 0);    // удар в спину
    const back = h1 - z.hp; const h2 = z.hp;
    damageZombie(z, 100, 0, -1, 0, undefined, true);  // взрыв/жакан в лицо
    const pierce = h2 - z.hp; z.dead = true; zombies.splice(zombies.indexOf(z), 1);
    return { front, back, pierce };
  });
  // 2. остальные: по одному
  await E(() => { for (const [t, dx, dz] of [['brute', 7, 0], ['screamer', -8, 3], ['spitter', 0, 8], ['riot', 4, -6]]) spawnZombie(t, { x: player.x + dx, z: player.z + dz }); });
  const seen = { chg: new Set(), spit: 0, puddle: 0, rage: 0 };
  for (let i = 0; i < 40; i++) {
    await sim(0.5);
    const s = await E(() => ({ chg: zombies.filter(z => z.type === 'brute').map(z => z.chg || 0)[0], spits: SPITS.length, pud: PUDDLES.length, rage: zombies.filter(z => z.rageT > 0).length, alive: zombies.filter(z => !z.dead).length,
      scWind: zombies.filter(z => z.type === 'screamer').map(z => z.scWind > 0)[0] }));
    seen.chg.add(s.chg); seen.spit = Math.max(seen.spit, s.spits); seen.puddle = Math.max(seen.puddle, s.pud); seen.rage = Math.max(seen.rage, s.rage); seen.alive = s.alive;
    if (i === 20) await p.screenshot({ path: dir + '/mob1.png' });
  }
  out.seen = { chg: [...seen.chg], spit: seen.spit, puddle: seen.puddle, rage: seen.rage, alive: seen.alive };
  // 3. стая псов и их вид
  await E(() => { zombies.length = 0; for (let i = 0; i < 5; i++) spawnZombie('hound', { x: player.x + 5 + i * 0.4, z: player.z + 3 }); });
  await sim(1.5); await p.screenshot({ path: dir + '/mob2_hounds.png' });
  out.hounds = await E(() => zombies.filter(z => z.type === 'hound' && !z.dead).length);
  // 4. колючка, мешки и турель на пути громилы
  out.smash = await E(() => {
    zombies.length = 0;
    const b0 = BAGS.length, w0 = WIRES.length;
    const z = spawnZombie('brute', { x: player.x + 5, z: player.z }); window.__brute = z;
    return { b0, w0, hasBags: typeof BAGS !== 'undefined', hasWires: typeof WIRES !== 'undefined' };
  });
  // 5. босс
  await E(() => { zombies.length = 0; G.noSpawn = false; G.spawnAcc = -999; G.t = 599.5; });
  await sim(1.5);
  out.boss = await E(() => ({ boss: !!G.boss, hp: G.boss && Math.round(G.boss.hp), guards: zombies.filter(z => z.guard).length, bar: getComputedStyle(document.getElementById('bossBar')).display }));
  await E(() => { const z = G.boss; if (z) { z.x = player.x + 3; z.z = player.z; z.slamCd = 0; } });
  await sim(2); await p.screenshot({ path: dir + '/mob3_boss.png' });
  out.slam = await E(() => ({ slamWindOrCd: G.boss && [G.boss.slamWind, G.boss.slamCd] }));
  console.log(JSON.stringify(out));
  console.log(errs.length ? errs.join('\n') : 'OK: ошибок нет'); await b.close();
})();
