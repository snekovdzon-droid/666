// Запуск: node tools/play.js [файл.html] — нажимает «В бой», играет ~8 с, печатает ошибки, делает скриншот
const { launchBrowser } = require('./browser'); const path = require('path');
(async () => {
  const file = path.resolve(process.argv[2] || 'index.html');
  const b = await launchBrowser();
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.goto('file://' + file); await p.waitForTimeout(2500);
  await p.click('[data-a=single]'); await p.click('#goBtn'); await p.evaluate(() => { const m = document.getElementById('mapPick'); if (m && getComputedStyle(m).display !== 'none') document.querySelector('#mpList .mp').click(); }); await p.waitForTimeout(1500);
  await p.keyboard.down('d'); await p.mouse.move(800, 300); await p.mouse.down();
  await p.waitForTimeout(6000); await p.mouse.up(); await p.keyboard.up('d');
  await p.screenshot({ path: process.env.SHOT || 'play.png' });
  console.log(errs.length ? errs.join('\n') : 'OK: игра запущена, ошибок нет'); if (errs.length) process.exitCode = 1;
  await b.close();
})().catch(e => { console.error(e); process.exitCode = 1; });
