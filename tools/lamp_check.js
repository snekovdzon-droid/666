// Ищет фонари, торчащие из зданий (столб внутри чего-то или лапа с лампой внутри стены), и предлагает ближайшие свободные места
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 800, height: 500 } });
  await p.goto('file://' + path.resolve(process.argv[2] || 'index.html')); await p.waitForTimeout(3500);
  const res = await p.evaluate(() => {
    const own = (s, x, z) => Math.abs(s.x1 - (x - 0.08)) < 0.01 && Math.abs(s.z1 - (z - 0.08)) < 0.01 && s.y2 > 4;
    const hit = (x, z, lamps) => {
      for (const s of solids) {
        if (own(s, x, z)) continue;
        if (s.stair) continue;
        if (s.y2 > 0.3 && s.y1 < 4.3 && s.x2 > x - 0.35 && s.x1 < x + 0.35 && s.z2 > z - 0.35 && s.z1 < z + 0.35) return 'столб в ' + [s.x1, s.z1, s.x2, s.z2].map(v => +v.toFixed(1)).join(',');
        if (s.y2 > 3.9 && s.y1 < 4.3 && s.x2 > x - 0.1 && s.x1 < x + 0.95 && s.z2 > z - 0.25 && s.z1 < z + 0.25) return 'лапа в ' + [s.x1, s.z1, s.x2, s.z2].map(v => +v.toFixed(1)).join(',');
      }
      if (x < 1 || z < 1 || x > MAP - 1 || z > MAP - 1) return 'у края';
      return null;
    };
    const bad = [], lamps = MAP_PRISON.ops.filter(o => o[0] === 'lamp').map(o => [o[1], o[2]]);
    for (const [x, z] of lamps) { const why = hit(x, z); if (why) {
      let best = null, bd = 1e9;
      for (let dx = -4; dx <= 4; dx += 0.25) for (let dz = -4; dz <= 4; dz += 0.25) { const d = Math.hypot(dx, dz); if (d >= bd) continue; if (hit(x + dx, z + dz)) continue; if (lamps.some(([a, c]) => (a !== x || c !== z) && Math.hypot(a - x - dx, c - z - dz) < 3)) continue; bd = d; best = [+(x + dx).toFixed(2), +(z + dz).toFixed(2)]; }
      bad.push({ lamp: [x, z], why, suggest: best }); } }
    return { total: lamps.length, bad };
  });
  console.log(JSON.stringify(res, null, 1)); await b.close();
})();
