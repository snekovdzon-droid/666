// Проверка редактора персонажа: открывает его, листает героев, делает скриншоты в папку SHOTDIR
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const dir = process.env.SHOTDIR || '.';
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = []; p.on('pageerror', e => errs.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.goto('file://' + path.resolve('index.html')); await p.waitForTimeout(2500);
  await p.screenshot({ path: dir + '/e0_menu.png' });
  await p.click('#lookEdit'); await p.waitForTimeout(800);
  await p.screenshot({ path: dir + '/e1_editor.png' });
  const n = await p.evaluate(() => HEROES.list.length);
  for (let i = 1; i < n; i++) {
    await p.selectOption('#edList', { index: i }); await p.waitForTimeout(500);
    await p.evaluate(() => { ED.spin = false; ED.yaw = 0.35; }); await p.waitForTimeout(300);
    await p.locator('.edView').screenshot({ path: `${dir}/e_hero${i}.png` });
  }
  await p.click('#edDone'); await p.waitForTimeout(500);
  await p.screenshot({ path: dir + '/e2_menu_after.png' });
  await p.click('#goBtn'); await p.waitForTimeout(2500);
  await p.screenshot({ path: dir + '/e3_game.png' });
  console.log(errs.length ? errs.join('\n') : 'OK: редактор работает, ошибок нет');
  await b.close();
})();
