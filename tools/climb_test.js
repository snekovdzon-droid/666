// Зомби лезут по лестнице к игроку на крыше; поле путей считается быстро; модули выпадают в карточках
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 900, height: 600 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + path.resolve(process.argv[2] || 'index.html')); await p.waitForTimeout(3500);
  await p.click('[data-a=single]'); await p.click('#goBtn'); await p.evaluate(() => { const m = document.getElementById('mapPick'); if (m && getComputedStyle(m).display !== 'none') document.querySelector('#mpList .mp').click(); }); await p.waitForTimeout(1500);
  const out = {};
  out.ladders = await p.evaluate(() => LADS.length);
  out.navMs = await p.evaluate(() => { const t = performance.now(); for (let i = 0; i < 10; i++) navField(alivePlayers()); return (performance.now() - t) / 10; });
  out.setup = await p.evaluate(() => {
    G.god = true; G.noSpawn = true; zombies.length = 0; G.timeScale = 6;
    const L = LADS.find(l => l.A && l.B) || LADS[0]; window.TL = L;
    player.x = L.lx - L.nx * 1.5; player.z = L.lz - L.nz * 1.5; player.y = L.H; player.vy = 0;
    for (let i = 0; i < 4; i++) { const z = spawnZombie('walker', { x: L.bx + L.nx * (1.5 + i * 0.8), z: L.bz + L.nz * (1.5 + i * 0.8) }); z.y = 0; }
    navField(alivePlayers());
    return { H: L.H, Ad: L.A && L.A.d, Bd: L.B && L.B.d };
  });
  let maxY = 0, climbed = 0;
  for (let k = 0; k < 80; k++) { await p.waitForTimeout(500); const r = await p.evaluate(() => ({ t: G.t, up: zombies.filter(z => !z.dead && z.climb).length, top: zombies.filter(z => !z.dead && Math.abs(z.y - TL.H) < 0.2).length, ys: zombies.map(z => +z.y.toFixed(1)) })); out.last = r; if (r.up) climbed++; if (r.top) break; }
  out.climbed = climbed;
  // карточки: модули
  out.mods = await p.evaluate(() => { let n = 0; for (let i = 0; i < 300; i++) if (rollChoices(player).some(c => c.type === 'att')) n++; return n / 300; });
  console.log(JSON.stringify(out)); console.log(errs.join('\n') || 'OK'); await b.close();
})();
