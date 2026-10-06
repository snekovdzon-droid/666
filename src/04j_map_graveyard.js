'use strict';
/* ---------- v0.47: карта «Кладбище» 128×128 — хеллоуин, вечная ночь под полной луной ----------
   Юг: вход, каменная сторожка, дом смотрителя, свежие могилы. Главная аллея (старый асфальт) плавно поднимается террасами
   к площади с часовней на холме. Запад: старая часть — тесные кривые могилы, сухие деревья, круг для ритуала.
   Восток: новые ряды, семейные участки в кованых оградках, колумбарий. Север: склепы (из открытых выходят зомби).
   Протоптанные тропы, кованые ограды вдоль аллей (местами сломаны). Собирается генератором с фиксированным зерном. */
const MAP_CEMETERY = (() => {
  let seed = 7713; const R = () => (seed = (seed * 16807) % 2147483647) / 2147483647, J = a => (R() - 0.5) * a;
  const S = 128, ops = [], zones = [], spawnPts = [];
  const Z = (t, x1, z1, x2, z2) => zones.push([t, x1, z1, x2, z2]);
  Z('grass', 0.5, 0.5, S - 0.5, S - 0.5);
  Z('gravel', 8, 15.5, 120, 20);                                  // дорожка у склепов
  Z('gravel', 30, 20, 33, 112); Z('gravel', 95, 20, 98, 96);      // боковые дорожки
  Z('asphalt', 61, 58, 67, 126);                                  // главная аллея (старый асфальт) — от входа до площади
  Z('asphalt', 6, 70, 122, 75);                                   // поперечная аллея
  Z('dirt', 6, 96, 30, 124); Z('dirt', 36, 96, 56, 112);          // двор смотрителя, свежие могилы
  Z('dirt', 98, 95, 124.6, 125);                                  // v0.78: двор морга → большое поле свежих могил (коричневая земля)
  Z('asphalt', 52, 113, 76, 127.5);                               // площадка у входа
  Z('asphalt', 50, 32, 78, 58);                                   // площадь в центре — пока пустая (под храм)
  // протоптанные тропы (ломаные): между могилами, к склепам, к дому, к кругу ритуала
  const trails = [
    [[33, 30], [26, 35], [18, 42], [12, 54], [16, 64], [24, 68]], [[33, 62], [40, 65], [48, 66], [55, 69]], [[22, 44], [27, 50], [31, 57]],
    [[8, 22], [14, 28], [20, 36]], [[46, 22], [42, 30], [44, 40], [52, 46]], [[10, 78], [18, 84], [28, 88], [33, 92]], [[40, 78], [46, 84], [54, 88], [56, 93]],
    [[98, 30], [106, 36], [114, 44], [120, 56]], [[74, 40], [82, 46], [90, 50], [95, 52]], [[98, 80], [106, 84], [116, 88], [122, 92]], [[74, 82], [82, 86], [90, 90], [95, 88]],
    [[30, 96], [24, 100], [19, 104]], [[60, 100], [54, 96], [46, 94], [38, 93]], [[68, 92], [76, 94], [88, 95], [98, 98]], [[112, 20], [116, 30], [122, 40]],
  ];
  const segD = (x, z, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz))); return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t); };
  const trailD = (x, z) => { let d = 99; for (const p of trails) for (let i = 1; i < p.length; i++) d = Math.min(d, segD(x, z, p[i - 1], p[i])); return d; };
  const free = [], keep = (x1, z1, x2, z2) => free.push([x1, z1, x2, z2]);
  keep(57, 58, 71, 128); keep(4, 67, 124, 78); keep(48, 30, 80, 60); keep(4, 94, 58, 128); keep(96, 94, 128, 128);
  keep(0, 0, 128, 22); keep(28.5, 18, 34.5, 114); keep(93.5, 18, 99.5, 98); keep(14, 36, 30, 52); keep(75, 60, 113, 64);
  const ok = (x, z, m = 0) => x > 3 + m && z > 3 + m && x < S - 3 - m && z < S - 3 - m && !free.some(r => x > r[0] - m && x < r[2] + m && z > r[1] - m && z < r[3] + m) && trailD(x, z) > 1.1 + m;
  // ограда по периметру, ворота на юге, каменная сторожка у входа
  ops.push(['cemwall', 0, 0, S, 0.6], ['cemwall', 0, 0.6, 0.6, S - 0.6], ['cemwall', S - 0.6, 0.6, S, S - 0.6], ['cemwall', 0, S - 0.6, 59, S], ['cemwall', 69, S - 0.6, S, S]);
  ops.push(['cemgate', 59, 69, S - 0.3], ['gatehouse', 52.6, 116.2, 56.8, 119.8]);
  // склепы на севере, у части дверь открыта — оттуда идут зомби
  for (let i = 0; i < 8; i++) { const x = 10 + i * 14.5, open = i % 3 !== 1; ops.push(['crypt', x, 5, x + 6, 13, open ? 1 : 0]); if (open) spawnPts.push({ x: x + 3, z: 15 }); }
  // часовня на площади (поднята на высоту площади), колокольня
  // морг с трубой, сарай и дом смотрителя
  ops.push(['none'], ['none'], ['none']);   // v0.78: морг (здание из тюрьмы) убран — пустые операции держат номера правок редактора
  ops.push(['vhouse', 9, 99], ['none']);   // v0.78: гараж-сарай убран
  ops.push(['none'], ['ritual', 22, 44]);   // v0.78: колумбарий (стена для праха) убран
  for (const [x, z] of [[40, 99], [45, 99], [50, 99], [40, 106], [47, 106]]) ops.push(['pit', x, z]);
  // кованые ограды вдоль аллей: где их пересекают тропы — проход, где аллеи и дорожки — открытые кованые ворота (можно закрыть)
  const crossGaps = (a1, a2, at, axis) => { const g = []; for (const p of trails) for (let i = 1; i < p.length; i++) { const A = p[i - 1], B = p[i], ka = axis === 'z' ? 0 : 1, kb = 1 - ka;
    if ((A[ka] - at) * (B[ka] - at) > 0 || A[ka] === B[ka]) continue; const t = (at - A[ka]) / (B[ka] - A[ka]), u = A[kb] + (B[kb] - A[kb]) * t; if (u > a1 && u < a2) g.push([u - 1.4, u + 1.4]); } return g; };
  const iron = (a1, a2, at, axis, br, gates = []) => { ops.push(['ironline', a1, a2, at, axis, br, crossGaps(a1, a2, at, axis).concat(gates.map(g => [g[0] - 0.1, g[1] + 0.1]))]);
    for (const [g1, g2] of gates) ops.push(axis === 'z' ? ['gate', at, g1, at, g2, 'z', true, 'iron'] : ['gate', g1, at, g2, at, 'x', true, 'iron']); };
  for (const x of [59, 69]) iron(59, 112, x, 'z', 1, [[69.6, 75.4]]);
  for (const z of [68.6, 76.4]) { iron(6, 58.6, z, 'x', 1, [[29.4, 33.6]]); iron(69.4, 122, z, 'x', 1, [[94.4, 98.6]]); }
  iron(36, 56, 95, 'x', 0); ops.push(['ironline', 98, 124.6, 94.5, 'x', 0, crossGaps(98, 124.6, 94.5, 'x').concat([[110, 113.2]])]);   // v0.78: северный вход на поле могил (та же одна операция — номера не сдвигаются)
  // фонари (старые кованые): вдоль аллеи — за ступенями террас, на площади — по углам
  for (let z = 20; z <= 112; z += 12) { if (z < 60) continue; ops.push(['lantern', z % 24 === 8 ? 60.2 : 67.8, z]); }
  for (let x = 12; x <= 118; x += 14) if (Math.abs(x - 64) > 6) ops.push(['lantern', x, x % 28 === 12 ? 69.8 : 75.2]);
  for (const [x, z] of [[46.4, 28.4], [81.6, 28.4], [46.4, 63.6], [81.6, 63.6], [58, 115], [20, 100], [110, 97], [31.5, 30], [96.5, 40], [96.5, 88], [31.5, 88]]) ops.push(['lantern', x, z]);
  // старая часть (запад): тесные кривые ряды; новая (восток): ровные ряды и семейные участки
  const OLD = ['tomb1', 'tomb2', 'tomb3', 'c_cross', 'c_cross', 'c_slab', 'c_broken', 'c_obelisk'], NEW = ['tomb1', 'tomb3', 'c_cross', 'c_slab'];
  for (let x = 6; x < 54; x += 2.6) for (let z = 24; z < 94; z += 3.0) {
    const gx = x + J(1.2), gz = z + J(1.1); if (!ok(gx, gz, 0.6) || R() < 0.2) continue;
    ops.push(['tomb', OLD[Math.floor(R() * OLD.length)], gx, gz, -Math.PI / 2 + J(0.8), J(0.22), R() < 0.14 ? 1 : 0]);
    if (R() < 0.06) ops.push(['bones', gx + 0.8 + J(0.4), gz + J(0.6)]);
  }
  for (let x = 76; x < 124; x += 3.4) for (let z = 24; z < 94; z += 4) {
    if (!ok(x, z, 0.8) || R() < 0.16) continue;
    if (R() < 0.14 && ok(x + 2.4, z, 0.8)) { ops.push(['plot', x - 0.9, z - 1.3, x + 3.3, z + 1.5]); ops.push(['tomb', NEW[Math.floor(R() * NEW.length)], x, z, -Math.PI / 2, 0, 1], ['tomb', NEW[Math.floor(R() * NEW.length)], x + 2.4, z, -Math.PI / 2, 0, 1]); x += 3.4; continue; }
    if (R() < 0.08) { ops.push(['plot', x - 0.8, z - 1.2, x + 0.8, z + 1.3]); }
    ops.push(['tomb', NEW[Math.floor(R() * NEW.length)], x + J(0.2), z, -Math.PI / 2 + J(0.12), J(0.05), R() < 0.25 ? 1 : 0]);
  }
  // деревья, пни, кусты, сухая трава
  const tryPut = (n, m, f) => { for (let i = 0, k = 0; i < n * 20 && k < n; i++) { const x = 4 + R() * (S - 8), z = 22 + R() * (S - 30); if (!ok(x, z, m)) continue; f(x, z); k++; } };
  tryPut(22, 1.2, (x, z) => ops.push(['deadwood', x, z]));
  tryPut(5, 2.4, (x, z) => ops.push(['oak', x, z]));
  tryPut(9, 1.6, (x, z) => ops.push(['log', x, z, R() < 0.5 ? 0 : 1]));
  tryPut(16, 0.8, (x, z) => ops.push(['vox', 'mx_stump', x, z, R() * 6.28, 1]));
  tryPut(40, 0.5, (x, z) => ops.push(['vox', ['cs_vegetation2', 'cs_vegetation3', 'cs_vegetation4', 'cs_vegetation5'][Math.floor(R() * 4)], x, z, R() * 6.28, 0]));
  tryPut(50, 0.3, (x, z) => ops.push(['vox', R() < 0.6 ? 'ky_dead_grass' : 'ky_dead_flower', x, z, R() * 6.28, 0]));
  // v0.49: больше зелени — кусты (модель из тюрьмы), сухие массивы кустарника, скрюченные деревья из пака Graveyard, высокая трава, заросли у стен
  tryPut(45, 0.8, (x, z) => ops.push(['bush', x, z]));
  tryPut(10, 1.6, (x, z) => ops.push(['vox', 'cs_vegetation1', x, z, R() * 6.28, 0]));
  tryPut(7, 2.2, (x, z) => ops.push(['gytree', x, z]));
  tryPut(520, 0.15, (x, z) => ops.push(['tallgrass', x, z]));
  for (let i = 0; i < 70; i++) {                                  // заросли вдоль ограды и в углах
    const side = i % 4, t = 0.04 + R() * 0.92, x = side === 0 ? 2.5 + R() * 3 : side === 1 ? S - 2.5 - R() * 3 : 4 + t * (S - 8), z = side === 2 ? 22 + R() * 3 : side === 3 ? S - 2.5 - R() * 3 : 22 + t * (S - 28);
    if (side === 3 && x > 50 && x < 78) continue;
    const r = R(); ops.push(r < 0.35 ? ['bush', x, z] : r < 0.5 ? ['vox', ['cs_vegetation2', 'cs_vegetation3', 'cs_vegetation5'][Math.floor(R() * 3)], x, z, R() * 6.28, 0] : ['tallgrass', x, z]);
    if (R() < 0.5) ops.push(['tallgrass', x + J(1.4), z + J(1.4)]);
  }
  for (const [x, z] of [[24, 106], [26, 120], [12, 92], [52, 92], [44, 118], [100, 120], [124, 98], [34, 60], [90, 58], [6, 30], [122, 30], [108, 86], [116, 80]]) ops.push(['deadwood', x, z]);
  for (let x = 10; x < S; x += 14) for (let z = 26; z < 96; z += 14) spawnPts.push({ x, z });
  spawnPts.push({ x: 44, z: 103 }, { x: 4, z: 60 }, { x: 124, z: 60 }, { x: 64, z: 24 });
  ops.push(['vchurch', 64, 45], ['lantern', 61.6, 53.2], ['lantern', 66.4, 53.2]);
  { // v0.78: мёртвые деревья (модели Meshy → воксели) — по свободным местам, гуще в старой западной части и на месте убранных зданий
    const taken = ops.filter(o => typeof o[1] === 'number' && typeof o[2] === 'number' && o[0] !== 'ironline' && o[0] !== 'cemwall').map(o => [o[1], o[2]]);
    const clear = (x, z, d) => taken.every(([a, b]) => Math.hypot(a - x, b - z) > d), KINDS = ['dead', 'pix', 'sent'];
    const put = (x, z) => { ops.push(['mtree', +x.toFixed(2), +z.toFixed(2), KINDS[Math.floor(R() * 3)], +(4.5 + R() * 3).toFixed(2)]); taken.push([x, z]); };
    let n = 0; for (let k = 0; k < 900 && n < 46; k++) { const x = 6 + R() * 116, z = 24 + R() * 72, west = x < 56; if ((!west && R() < 0.45) || !ok(x, z, 1.2) || !clear(x, z, 2.2)) continue; put(x, z); n++; }
    for (const [x, z] of [[12, 116], [17, 122], [8, 124]]) put(x + J(1.5), z + J(1.5));
  }
  { // v0.78: поле свежих могил (бывший двор морга): кованая ограда с воротами, внутри ряды открытых могил, у изголовья — крест или надгробие
    const X1 = 99.4, X2 = 124.6, Z1 = 94.5, Z2 = 125.2;
    iron(Z1, Z2, X1, 'z', 0, [[107.6, 111.2]]);                      // запад: ворота к аллее
    iron(X1, X2, Z2, 'x', 0, [[110, 113.2]]);                        // юг: ворота
    iron(Z1, Z2, X2, 'z', 0, [[107.6, 111.2]]);                      // восток: ворота
    for (let k = ops.length - 6; k < ops.length; k++) if (ops[k][0] === 'gate') ops[k] = ['none'];   // v0.78: створки ворот убраны — остаются открытые проходы (пустая операция держит номера)
    const HEAD = ['c_cross', 'c_cross', 'tomb1', 'c_cross', 'c_broken', 'c_obelisk', 'tomb1'];
    let col = 0;
    for (let x = 101.4; x < 123; x += 3.0, col++) {
      if (col === 3) continue;                                       // проход север—юг
      let row = 0;
      for (let z = 97.9; z < 124; z += 3.6, row++) {
        if (row === 3) continue;                                     // проход запад—восток
        const gx = x + J(0.15), gz = z + J(0.15);
        ops.push(['pit', gx, gz]);
        ops.push(['tomb', HEAD[Math.floor(R() * HEAD.length)], gx, gz - 1.45, -Math.PI / 2 + J(0.1), J(0.06), R() < 0.3 ? 1 : 0]);
      }
    }
    ops.push(['lantern', 111.6, 109.4]);                               // фонарь на перекрёстке проходов
  }
  { // v0.78: «старое кладбище» на западе — густо деревья (с листвой и сухие) и кусты; на востоке — реже
    const taken = ops.filter(o => typeof o[1] === 'number' && typeof o[2] === 'number' && !/ironline|cemwall|zone|gate|none/.test(o[0])).map(o => [o[1], o[2], o[0] === 'pit' ? 1.5 : o[0] === 'tomb' ? 1.05 : /tree|oak|deadwood/.test(o[0]) ? 2.2 : 0.8, /tree|oak|deadwood/.test(o[0])]);
    const clear = (x, z, d) => taken.every(([a, b, r, big]) => Math.hypot(a - x, b - z) > (big ? Math.max(d, r) : r));   // деревья держат дистанцию друг от друга, от могил — только чтобы не влезть в плиту
    const place = (n, x0, x1, z0, z1, d, mk) => { for (let k = 0, c = 0; k < n * 40 && c < n; k++) { const x = x0 + R() * (x1 - x0), z = z0 + R() * (z1 - z0); if (!ok(x, z, 0.8) || !clear(x, z, d)) continue; const o = mk(x, z); ops.push(o); taken.push([x, z, d > 1.5 ? d : 0.8, d > 1.5]); c++; } };
    const DRY = ['dead', 'pix', 'sent'], fx = v => +v.toFixed(2);
    // запад: старое кладбище (x 4…56, z 22…94) и двор смотрителя (z 94…126)
    place(30, 4, 56, 22, 94, 2.2, (x, z) => ['tree', fx(x), fx(z)]);
    place(14, 4, 56, 22, 126, 2.6, (x, z) => ['oak', fx(x), fx(z)]);
    place(10, 4, 56, 22, 94, 2.0, (x, z) => ['gytree', fx(x), fx(z)]);
    place(22, 4, 56, 22, 126, 2.0, (x, z) => R() < 0.5 ? ['deadwood', fx(x), fx(z)] : ['mtree', fx(x), fx(z), DRY[Math.floor(R() * 3)], +(4.5 + R() * 3).toFixed(2)]);
    place(60, 4, 56, 22, 126, 0.9, (x, z) => R() < 0.55 ? ['bush', fx(x), fx(z)] : ['vox', ['cs_vegetation2', 'cs_vegetation3', 'cs_vegetation4', 'cs_vegetation5'][Math.floor(R() * 4)], fx(x), fx(z), +(R() * 6.28).toFixed(2), 0]);
    // восток: немного зелени между новыми рядами
    place(10, 72, 124, 22, 92, 2.4, (x, z) => R() < 0.6 ? ['tree', fx(x), fx(z)] : ['oak', fx(x), fx(z)]);
    place(20, 72, 124, 22, 92, 0.9, (x, z) => ['bush', fx(x), fx(z)]);
  }   // церковь на площади + фонари у входа (в конце списка — индексы правок редактора не сдвигаются)
  const crates = [[64, 55.5, 0], [20, 106, 0], [112, 97, 0], [40, 30, 0], [88, 30, 0], [24, 82, 0], [104, 76, 0], [46, 114, 0], [84, 52, 0]];
  return {
    name: 'Кладбище', start: { x: 64, z: 118 }, zones, ops, crates, doors: [], noSpawn: [[52, 110, 76, 128]], spawnPts, trails,
    menu: { cam: { x: 64, z: 100 }, zoom: 6.8, x0: 62, x1: 66, Z0: 96, Z1: 124 },
    events: { gen: null, pad: null, arm: null },
  };
})();
/* ---------- Карты: базовые (Тюрьма, Город) и пустая основа для своих; правки редактора лежат поверх («оверлей») ---------- */
const gridPts = size => { const a = []; for (let x = 4; x <= size - 4; x += 8) for (let z = 4; z <= size - 4; z += 8) a.push({ x, z }); return a; };
const MAP_BLANK = (size, name) => ({
  name: name || 'Новая карта', start: { x: size / 2, z: size / 2 }, zones: [['paving', 0.5, 0.5, size - 0.5, size - 0.5]],
  ops: [['wall', 0, 0, size, 0.5], ['wall', 0, size - 0.5, size, size], ['wall', 0, 0.5, 0.5, size - 0.5], ['wall', size - 0.5, 0.5, size, size - 0.5]],
  crates: [[size / 2 + 4, size / 2, 0]], doors: [], noSpawn: [], spawnPts: gridPts(size),
  menu: { cam: { x: size / 2, z: size / 2 }, zoom: 6.8, x0: 0, x1: 0, Z0: 0, Z1: 0, empty: true }, events: { gen: null, pad: null, arm: null },
});
const BASE_DEF = MAPID === 'cemetery' ? MAP_CEMETERY : CMAP ? MAP_BLANK(CMAP.size, CMAP.name) : MAP_PRISON;
const OV = (CMAP ? CMAP.ov : lsGet('ov_' + MAPID, null)) || {};
function effectiveDef(base, ov) {
  const rm = new Set(ov.removed || []), all = base.ops.filter((o, i) => !rm.has(i) || o[0] === 'vchurch').concat(ov.added || []) /* v0.78: церковь не пропадает из-за старых правок редактора */, rc = new Set(ov.removedCrates || []);
  return Object.assign({}, base, {
    ops: all.filter(o => o[0] !== 'zone' && o[0] !== 'crate'),
    zones: base.zones.concat(all.filter(o => o[0] === 'zone').map(o => [o[1], o[2], o[3], o[4], o[5]])),
    crates: (base.crates || []).filter((_, i) => !rc.has(i)).concat(all.filter(o => o[0] === 'crate').map(o => [o[1], o[2], o[3] || 0])),
    start: ov.start || base.start, events: Object.assign({}, base.events || {}, ov.events || {}),
  });
}
const MAPDEF = effectiveDef(BASE_DEF, OV);

/* v0.46: карта «Город» удалена целиком */
