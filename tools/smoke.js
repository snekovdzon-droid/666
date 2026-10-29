// Запуск: node tools/smoke.js [файл.html]  — открывает игру в Chromium, печатает ошибки консоли
const { launchBrowser } = require('./browser');
const path = require('path');
(async () => {
  const file = path.resolve(process.argv[2] || 'index.html');
  const b = await launchBrowser();
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.goto('file://' + file);
  await p.waitForTimeout(3000);
  await p.screenshot({ path: process.env.SHOT || 'menu.png' });
  console.log(errs.length ? errs.join('\n') : 'OK: ошибок нет');
  if (errs.length) process.exitCode = 1;
  await b.close();
})().catch(e => { console.error(e); process.exitCode = 1; });
