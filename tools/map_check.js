// Проверка проходимости карты: достижимость ключевых точек от старта (ворота как есть и все открыты)
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 800, height: 500 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve(process.argv[2] || 'index.html')); await p.waitForTimeout(3500);
  const res = await p.evaluate(() => {
    const R = 0.34, S = 0.5, N = Math.round(MAP / S);
    const flood = (sx, sz) => {
      const seen = new Uint8Array(N * N), q = [[Math.round(sx / S), Math.round(sz / S)]]; seen[q[0][1] * N + q[0][0]] = 1;
      while (q.length) { const [i, j] = q.pop(); for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di, c = j + dj; if (a < 0 || c < 0 || a >= N || c >= N || seen[c * N + a]) continue; if (blocked(a * S, c * S, 0, R)) continue; seen[c * N + a] = 1; q.push([a, c]); } }
      return (x, z) => seen[Math.round(z / S) * N + Math.round(x / S)] === 1;
    };
    const st = MAP_PRISON.start, pts = {};
    pts['старт свободен'] = !blocked(st.x, st.z, 0, R);
    const named = { 'пролом С': [47.5, 1.4], 'ворота З': [1.4, 57], 'ворота В': [94.6, 57], 'ворота Ю': [48, 94.6], 'кладбище': [10, 12], 'склеп внутри': [15, 21], 'котельная внутри': [84, 9], 'топливо': [84, 22], 'спортплощадка': [84, 44], 'мастерские внутри': [14, 77], 'карцер внутри': [80, 78], 'беседка': [48, 52], 'склад во дворе': [30, 59], 'проход лазарет-столовая': [13, 43.5], 'коридор З': [10, 57], 'коридор В': [85, 57], 'клетка 1 З': [27, 27], 'клетка 3 В': [69, 27], 'проход между крылом и забором': [74.6, 14], 'стоянка': [60, 80], 'КПП': [48, 90] };
    const run = label => { const f = flood(st.x, st.z), bad = []; for (const k in named) { const [x, z] = named[k]; if (blocked(x, z, 0, R)) bad.push(k + ' (занято)'); else if (!f(x, z)) bad.push(k); } for (const c of MAP_PRISON.crates) { if (blocked(c[0], c[1], 0, R)) bad.push('ящик ' + c + ' (занято)'); else if (!f(c[0], c[1])) bad.push('ящик ' + c); } for (const d of MAP_PRISON.doors) if (blocked(d[0], d[1], 0, R)) bad.push('дверь ' + d + ' (занято)'); return label + ': недостижимо/занято → ' + (bad.join(', ') || 'нет'); };
    const out = [JSON.stringify(pts), run('ворота как есть')];
    for (const g of GATES) if (!g.open) gateSetOpen(g, true);
    out.push(run('все ворота открыты'));
    out.push('ворот: ' + GATES.length + ', прожекторов: ' + SEARCH.length + ', точек выхода: ' + SPAWNS.length);
    return out;
  });
  console.log(res.join('\n')); console.log(errs.join('\n') || 'OK'); await b.close();
})();
