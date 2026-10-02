// Картинка-обзор воксельных стволов: node tools/gunview.js out.png id1,id2,... [столбцов=3]
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const ids = (process.argv[3] || 'revolver').split(','), cols = +(process.argv[4] || 3);
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 300 * cols, height: 300 * ids.length } }); p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('file://' + path.join(__dirname, 'gunview.html')); await p.evaluate(([i, c]) => show(i, c), [ids, cols]);
  await p.screenshot({ path: process.argv[2] }); await b.close();
})();
