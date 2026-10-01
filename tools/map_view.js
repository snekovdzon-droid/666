// Вид всей карты сверху (изометрия) для проверки раскладки: SHOT=файл.png [YAW=0.785] [NIGHT=1]
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1700, height: 1100 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + path.resolve('index.html')); await p.waitForTimeout(3500);
  await p.click('[data-a=single]'); await p.click('#goBtn'); await p.waitForTimeout(1200);
  await p.evaluate(([yaw, night]) => {
    G.god = true; G.noSpawn = true; zombies.length = 0; scene.fog.near = 1000; scene.fog.far = 2000;
    for (const id of ['huds', 'top', 'help', 'btns', 'fps', 'ver']) { const e = document.getElementById(id); if (e) e.style.display = 'none'; }
    document.getElementById('radarBox').style.display = 'none';
    CAM.yawT = CAM.yaw = yaw; CAM.zoomT = CAM.zoom = 40; CAM.pitch = 0.9; G.nightT = night; player.x = 48; player.z = 48;
    window.CAM_MAX = 99;
  }, [+(process.env.YAW || Math.PI / 4), +(process.env.NIGHT || 0)]);
  await p.waitForTimeout(2500);
  await p.screenshot({ path: process.env.SHOT || 'map.png' });
  console.log(errs.join('\n') || 'OK'); await b.close();
})();
