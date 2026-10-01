// Проверка главного меню: скриншот, переходы по кнопкам
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const dir = process.env.SHOTDIR || '.';
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; p.on('pageerror', e => errs.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.goto('file://' + path.resolve(process.argv[2] || 'index.html')); await p.waitForTimeout(4000);
  await p.screenshot({ path: dir + '/m1_main.png' });
  const st = () => p.evaluate(() => __G.G.state);
  const log = [await st()];
  await p.click('[data-a=single]'); await p.waitForTimeout(500); log.push(await st());
  await p.click('#backMain'); await p.waitForTimeout(500); log.push(await st());
  await p.click('[data-a=hero]'); await p.waitForTimeout(800); log.push(await st());
  await p.click('#edBack'); await p.waitForTimeout(500); log.push(await st());
  await p.click('[data-a=settings]'); await p.waitForTimeout(300); await p.screenshot({ path: dir + '/m2_settings.png' });
  await p.click('[data-s=back]'); await p.keyboard.press('ArrowDown'); await p.keyboard.press('Enter'); await p.waitForTimeout(500); log.push(await st());
  await p.keyboard.press('Escape'); await p.waitForTimeout(500); log.push(await st());
  await p.click('[data-a=single]'); await p.click('#goBtn'); await p.waitForTimeout(2000); log.push(await st());
  console.log('состояния:', log.join(' → '));
  console.log(errs.length ? errs.join('\n') : 'OK: ошибок нет'); await b.close();
})();
