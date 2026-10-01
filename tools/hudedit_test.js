// Проверка настройки HUD: открыть редактор, перетащить элемент, изменить размер, выйти, начать бой и убедиться, что раскладка применилась
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const dir = process.env.SHOTDIR || '.';
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; p.on('pageerror', e => errs.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.goto('file://' + path.resolve(process.argv[2] || 'index.html')); await p.waitForTimeout(3000);
  await p.click('[data-a=settings]'); await p.click('[data-s=hud]'); await p.waitForTimeout(800);
  await p.screenshot({ path: dir + '/e1_open.png' });
  const box = async id => (await p.locator('#' + id).boundingBox());
  const r0 = await box('radarBox');
  await p.mouse.move(r0.x + 20, r0.y + 20); await p.mouse.down(); await p.mouse.move(r0.x - 300, r0.y + 200, { steps: 6 }); await p.mouse.up();
  await p.mouse.wheel(0, -300);                                   // увеличить радар
  const r1 = await box('radarBox');
  const h0 = await box('hud0'); await p.mouse.move(h0.x + 30, h0.y + 30); await p.mouse.down(); await p.mouse.move(h0.x + 400, h0.y + 60, { steps: 6 }); await p.mouse.up();
  await p.click('#hpMinus');
  await p.waitForTimeout(400); await p.screenshot({ path: dir + '/e2_moved.png' });
  console.log('радар до/после:', Math.round(r0.x), Math.round(r0.y), Math.round(r0.width), '→', Math.round(r1.x), Math.round(r1.y), Math.round(r1.width));
  console.log('сохранено:', await p.evaluate(() => JSON.stringify(HUDL.map)));
  await p.click('#hpDone'); await p.waitForTimeout(500);
  console.log('после «Готово»:', await p.evaluate(() => G.state + ' / панель ' + getComputedStyle($('hudPanel')).display));
  await p.click('[data-s=back]'); await p.click('[data-a=single]'); await p.click('#goBtn'); await p.waitForTimeout(1500);
  const r2 = await box('radarBox'); console.log('радар в бою:', Math.round(r2.x), Math.round(r2.y), Math.round(r2.width));
  await p.screenshot({ path: dir + '/e3_game.png' });
  console.log(errs.length ? errs.join('\n') : 'OK: ошибок нет'); await b.close();
})();
