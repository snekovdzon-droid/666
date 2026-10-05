// Замер CPU-части кадра и ленивой загрузки звуков. node tools/perf_test.js [файл.html] [карта: prison|cemetery] [число зомби]
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const file = path.resolve(process.argv[2] || 'dist/zombie-voxel.html'), map = process.argv[3] || 'prison', N = +(process.argv[4] || 120);
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(m => { try { localStorage.setItem('zsv_map', JSON.stringify(m)); } catch (e) {} }, map);
  await p.goto('file://' + file); await p.waitForTimeout(4000);
  await p.mouse.click(300, 300); await p.waitForTimeout(500);
  const early = await p.evaluate(() => Object.keys(Sound.buf).length);
  await p.evaluate(() => { G.nPlayers = 1; G.gun = 'rifle'; G.guns = ['rifle']; startRun(); }); await p.waitForTimeout(6000);
  const r = await p.evaluate(async () => { G.god = true; for (let i = 0; i < 120; i++) spawnZombie(null, null, false, true); await new Promise(r => setTimeout(r, 5000));
    return { zombies: zombies.length, tickMs: +PERF.tick.toFixed(2), sounds: Object.keys(Sound.buf).length, music: !!Sound.buf.mus_cem, amb: AMB.on, heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null, quality: QS.name, musicMB: Sound.buf.mus_cem ? Math.round(Sound.buf.mus_cem.duration * Sound.buf.mus_cem.sampleRate * Sound.buf.mus_cem.numberOfChannels * 4 / 1048576) : 0, allSoundsMB: Math.round(Object.values(Sound.buf).reduce((a, x) => a + x.length * x.numberOfChannels * 4, 0) / 1048576) }; });
  console.log(map, 'sounds after click(0.5s):', early, JSON.stringify(r), errs.join('|') || 'no errors'); await b.close();
})();
