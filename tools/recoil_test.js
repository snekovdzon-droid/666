// Отдача: сдвиг героя, толчок и увод камеры, откат модели, рост разброса
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 700, height: 450 } }); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + path.resolve(process.argv[2] || 'index.html')); await p.waitForTimeout(3500);
  await p.click('[data-a=single]'); await p.click('#goBtn'); await p.evaluate(() => { const m = document.getElementById('mapPick'); if (m && getComputedStyle(m).display !== 'none') document.querySelector('#mpList .mp').click(); }); await p.waitForTimeout(1500);
  const out = {};
  for (const g of ['shotgun', 'rifle', 'revolver']) {
    out[g] = await p.evaluate(async g => {
      G.god = true; G.noSpawn = true; zombies.length = 0; G.timeScale = 4; let fx = 0, fz = 0; for (let x = 10; x < 90 && !fx; x++) for (let z = 10; z < 90; z++) if (!blocked(x, z, 0, 1.2) && floorAt(x, z, 8, 0.3) < 0.01) { fx = x; fz = z; break; }
      player.x = fx; player.z = fz; player.y = 0; player.gun = g; player.yaw = Math.PI / 2; player.kx = player.kz = 0; player.bloom = 0; CAM.x = fx; CAM.z = fz;
      await new Promise(r => setTimeout(r, 1500)); const x0 = player.x;
      shotFeel(player, player.yaw, 1); const kick = player.kick, camk = CAM.kx;
      const t0 = G.t; let lead = 0; for (let k = 0; k < 40 && G.t < t0 + 1.2; k++) { await new Promise(r => setTimeout(r, 120)); lead = Math.max(lead, player.lx || 0); }
      return { moved: +(x0 - player.x).toFixed(2), kick: +kick.toFixed(2), camkx: +camk.toFixed(2), leadMax: +lead.toFixed(2) };
    }, g);
  }
  console.log(JSON.stringify(out)); console.log(errs.join('\n') || 'OK'); await b.close();
})();
