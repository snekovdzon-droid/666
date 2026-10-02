// Проверка: записи оружия декодируются и проигрываются без ошибок
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + path.resolve(process.argv[2] || 'index.html')); await p.waitForTimeout(3000);
  await p.click('[data-a=single]'); await p.waitForTimeout(1500);
  const r = await p.evaluate(async () => { audioInit(); await new Promise(r => setTimeout(r, 2500)); const n = Object.keys(Sound.buf).length, st = Sound.ctx.state;
    const ok = []; for (const g of ['rifle', 'mg', 'smg', 'pistol', 'revolver', 'shotgun', 'sawnoff', 'crossbow']) { SFX.shot(g); ok.push(g); } for (const g of ['rifle', 'revolver', 'shotgun', 'sawnoff', 'smg', 'mg']) { SFX.reload(true, g); SFX.reload(false, g); } SFX.dry(); SFX.shellLoad();
    return { n, st, ok: ok.length, shotgunBuf: !!Sound.buf.shotgun_1 }; });
  console.log(JSON.stringify(r)); console.log(errs.join('\n') || 'OK'); await b.close();
})();
