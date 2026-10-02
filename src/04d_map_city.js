'use strict';
/* ---------- Карта «Город» 128×128 (v0.22) ----------
   Сетка 5×5 кварталов 22×22, улицы по 4 м — тесные «каньоны». Крыши плоские и просторные, у кварталов разная высота (1–5 этажей).
   Связи между крышами: мосты (одинаковая высота), лестницы-пандусы через улицу (разница в один этаж), лестницы внутри квартала,
   с земли — лестницы вдоль стен на низкие крыши. В центре башня в 5 этажей: на ней вертолётная площадка. Генератор — на крыше на западе.
   Карта собирается генератором с фиксированным зерном и отдаёт те же «операции», что и MAP_PRISON. */
const MAP_CITY = (() => {
  let seed = 90417; const R = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const N = 5, X0 = 1, BW = 22, SW = 4, PITCH = BW + SW, FH = 2.6, RUN = 0.5, RISE = 0.34;   // шаг лестницы = клетка навигации (0,5): иначе зомби не поднимутся
  const bs = i => X0 + i * PITCH;                         // начало квартала i
  const sc = k => X0 + k * PITCH + BW + SW / 2;           // центр улицы k (между кварталами k и k+1)
  const FL = [[2, 3, 3, 2, 1], [3, 4, 4, 3, 2], [3, 4, 5, 4, 3], [2, 3, 4, 3, 2], [1, 2, 3, 2, 2]];   // этажи кварталов [ряд][колонка]
  const TOWER = { r: 2, c: 2 }, GENB = { r: 2, c: 0 };
  const snap = v => Math.round(v * 2) / 2;                // центры проходов — по сетке навигации 0,5
  const layouts = [];
  for (let r = 0; r < N; r++) { layouts.push([]); for (let c = 0; c < N; c++) {
    const forced = (r === TOWER.r && c === TOWER.c) || (r === GENB.r && c === GENB.c), q = R();
    layouts[r].push({ type: forced || q < 0.4 ? 'single' : q < 0.7 ? 'x' : 'z', ratio: 0.42 + R() * 0.16, flip: R() < 0.5, df: R() < 0.5 ? -1 : 1 });
  } }

  function plan() {
    const rooms = [], conns = [], ground = [], busy = [];
    const add = (x1, z1, x2, z2, f, r, c) => { const m = { id: rooms.length, x1, z1, x2, z2, f, r, c, H: f * FH, gaps: { N: [], S: [], E: [], W: [] }, skip: [], props: [] }; rooms.push(m); return m; };
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const x = bs(c), z = bs(r), h = FL[r][c], L = layouts[r][c];
      if (L.type === 'single') { add(x, z, x + BW, z + BW, h, r, c); continue; }
      const f2 = h > 1 ? h - 1 : 2, fa = L.flip ? h : f2, fb = L.flip ? f2 : h, s = Math.round(BW * L.ratio);
      if (L.type === 'x') { add(x, z, x + s, z + BW, fa, r, c); add(x + s, z, x + BW, z + BW, fb, r, c); }
      else { add(x, z, x + BW, z + s, fa, r, c); add(x, z + s, x + BW, z + BW, fb, r, c); }
    }
    const ops = [];
    // --- связи внутри квартала: лестница на крыше нижней части к стене верхней ---
    for (let i = 0; i < rooms.length; i++) for (let j = i + 1; j < rooms.length; j++) {
      const A = rooms[i], B = rooms[j]; if (A.r !== B.r || A.c !== B.c) continue;
      const lo = A.f < B.f ? A : B, hi = lo === A ? B : A, alongX = A.x2 === B.x1;     // общая стена: x (alongX) или z
      const len = alongX ? A.z2 - A.z1 : A.x2 - A.x1, zc = snap((alongX ? A.z1 : A.x1) + 4 + R() * (len - 8)), n = Math.ceil((hi.H - lo.H) / RISE), run = n * RUN;
      if (alongX) {
        const xs = A.x2, dir = lo === A ? 1 : -1, xa = dir > 0 ? xs - run : xs, xb = dir > 0 ? xs : xs + run;
        ops.push(['cstair', xa, zc - 1.2, xb, zc + 1.2, lo.H, hi.H, 'x', dir, 0]);
        hi.gaps[dir > 0 ? 'W' : 'E'].push([zc - 1.2, zc + 1.2]); lo.skip.push(dir > 0 ? 'E' : 'W');
        busy.push([lo.id, xa, zc - 1.2, xb, zc + 1.2]);
      } else {
        const zs = A.z2, dir = lo === A ? 1 : -1, za = dir > 0 ? zs - run : zs, zb = dir > 0 ? zs : zs + run;
        ops.push(['cstair', zc - 1.2, za, zc + 1.2, zb, lo.H, hi.H, 'z', dir, 0]);
        hi.gaps[dir > 0 ? 'N' : 'S'].push([zc - 1.2, zc + 1.2]); lo.skip.push(dir > 0 ? 'S' : 'N');
        busy.push([lo.id, zc - 1.2, za, zc + 1.2, zb]);
      }
      conns.push([A.id, B.id]);
    }
    // --- кандидаты через улицу: пары комнат лицом к лицу ---
    const cand = [];
    const facing = (A, B, alongX) => {                               // A западнее/севернее B
      const a1 = alongX ? Math.max(A.z1, B.z1) : Math.max(A.x1, B.x1), a2 = alongX ? Math.min(A.z2, B.z2) : Math.min(A.x2, B.x2);
      if (a2 - a1 < 5.5 || Math.abs(A.f - B.f) > 1) return;
      cand.push({ A, B, alongX, a1, a2 });
    };
    for (const A of rooms) for (const B of rooms) {
      if (A.c + 1 === B.c && A.r === B.r && Math.abs(A.x2 - bs(A.c) - BW) < 0.01 && Math.abs(B.x1 - bs(B.c)) < 0.01) facing(A, B, true);
      if (A.r + 1 === B.r && A.c === B.c && Math.abs(A.z2 - bs(A.r) - BW) < 0.01 && Math.abs(B.z1 - bs(B.r)) < 0.01) facing(A, B, false);
    }
    for (let i = cand.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [cand[i], cand[j]] = [cand[j], cand[i]]; }
    const uf = rooms.map((_, i) => i), find = i => uf[i] === i ? i : (uf[i] = find(uf[i]));
    for (const [a, b] of conns) uf[find(a)] = find(b);
    const streetRects = [];
    const place = (cd, k) => {
      const { A, B, alongX, a1, a2 } = cd, span = a2 - a1, zc = snap(k === 0 ? a1 + 2.5 + R() * (span - 5) : k === 1 ? a1 + 2.5 + (span - 5) * 0.2 : a1 + 2.5 + (span - 5) * 0.8);
      const lo = A.f <= B.f ? A : B, hi = lo === A ? B : A;
      streetRects.push(alongX ? [A.x2, zc - 1.2, B.x1, zc + 1.2] : [zc - 1.2, A.z2, zc + 1.2, B.z1]);
      if (A.f === B.f) {
        if (alongX) { ops.push(['cbridge', A.x2, zc - 1.2, B.x1, zc + 1.2, A.H, 'x']); A.gaps.E.push([zc - 1.2, zc + 1.2]); B.gaps.W.push([zc - 1.2, zc + 1.2]); }
        else { ops.push(['cbridge', zc - 1.2, A.z2, zc + 1.2, B.z1, A.H, 'z']); A.gaps.S.push([zc - 1.2, zc + 1.2]); B.gaps.N.push([zc - 1.2, zc + 1.2]); }
      } else {
        const dir = lo === A ? 1 : -1;
        if (alongX) {
          ops.push(['cstair', A.x2, zc - 1.2, B.x1, zc + 1.2, lo.H, hi.H, 'x', dir, 1]);
          A.gaps.E.push([zc - 1.2, zc + 1.2]); B.gaps.W.push([zc - 1.2, zc + 1.2]);
        } else {
          ops.push(['cstair', zc - 1.2, A.z2, zc + 1.2, B.z1, lo.H, hi.H, 'z', dir, 1]);
          A.gaps.S.push([zc - 1.2, zc + 1.2]); B.gaps.N.push([zc - 1.2, zc + 1.2]);
        }
      }
    };
    const used = new Map();
    for (const cd of cand) { const a = find(cd.A.id), b = find(cd.B.id); if (a !== b) { uf[a] = b; place(cd, 0); used.set(cd, 1); } }
    for (const cd of cand) {                                           // сверх остова: дополнительные переходы
      if (used.has(cd)) { if (cd.a2 - cd.a1 >= 15 && R() < 0.5 && cd.A.f === cd.B.f) place(cd, 1); continue; }
      if (R() < 0.4) { place(cd, 0); if (cd.a2 - cd.a1 >= 15 && cd.A.f === cd.B.f && R() < 0.4) place(cd, 2); }
    }
    const comps = new Set(rooms.map(r => find(r.id)));
    // --- лестницы с земли на низкие крыши (1–2 этажа): вдоль стены, на улице ---
    const gs = [];
    for (const A of rooms) {
      if (A.f > 2) continue;
      const n = Math.ceil(A.H / RISE), run = n * RUN, sides = [];
      const edgeW = A.x1 <= bs(A.c) + 0.01 && A.c > 0, edgeE = A.x2 >= bs(A.c) + BW - 0.01 && A.c < N - 1, edgeN = A.z1 <= bs(A.r) + 0.01 && A.r > 0, edgeS = A.z2 >= bs(A.r) + BW - 0.01 && A.r < N - 1;
      if (edgeW && A.z2 - A.z1 >= run + 5) sides.push('W'); if (edgeE && A.z2 - A.z1 >= run + 5) sides.push('E');
      if (edgeN && A.x2 - A.x1 >= run + 5) sides.push('N'); if (edgeS && A.x2 - A.x1 >= run + 5) sides.push('S');
      if (!sides.length) continue;
      const side = sides[Math.floor(R() * sides.length)], up = R() < 0.5 ? 1 : -1, W = 1.4;
      const along = (side === 'W' || side === 'E') ? [A.z1, A.z2] : [A.x1, A.x2], lo = along[0] + 2.5, hi = along[1] - 2.5 - run, s0 = snap(lo + R() * Math.max(0, hi - lo));
      const a = s0, b = s0 + run, gp = up > 0 ? [b - 1.8, b] : [a, a + 1.8];
      const rc = side === 'W' ? [A.x1 - W, a, A.x1, b] : side === 'E' ? [A.x2, a, A.x2 + W, b] : side === 'N' ? [a, A.z1 - W, b, A.z1] : [a, A.z2, b, A.z2 + W];
      if (gs.concat(streetRects).some(q => rc[0] < q[2] + 2.4 && rc[2] > q[0] - 2.4 && rc[1] < q[3] + 2.4 && rc[3] > q[1] - 2.4)) continue;
      gs.push(rc);
      if (side === 'W') { ops.push(['cstair', A.x1 - W, a, A.x1, b, 0, A.H, 'z', up, 2]); A.gaps.W.push(gp); busy.push([-1, A.x1 - W, a, A.x1, b]); }
      if (side === 'E') { ops.push(['cstair', A.x2, a, A.x2 + W, b, 0, A.H, 'z', up, 2]); A.gaps.E.push(gp); busy.push([-1, A.x2, a, A.x2 + W, b]); }
      if (side === 'N') { ops.push(['cstair', a, A.z1 - W, b, A.z1, 0, A.H, 'x', up, 2]); A.gaps.N.push(gp); busy.push([-1, a, A.z1 - W, b, A.z1]); }
      if (side === 'S') { ops.push(['cstair', a, A.z2, b, A.z2 + W, 0, A.H, 'x', up, 2]); A.gaps.S.push(gp); busy.push([-1, a, A.z2, b, A.z2 + W]); }
      ground.push(A.id);
    }
    return { rooms, ops, busy, comps: comps.size, ground };
  }
  let P = plan(), guard = 0;
  while (P.comps > 1 && guard++ < 6) { for (const row of layouts) for (const L of row) L.type = R() < 0.5 ? 'single' : L.type; seed = 90417 + guard; P = plan(); }
  const rooms = P.rooms, ops = [];

  // --- здания и крыши ---
  const T = rooms.find(m => m.r === TOWER.r && m.c === TOWER.c), PAD = { x: (T.x1 + T.x2) / 2, z: (T.z1 + T.z2) / 2, hw: 4.5, hd: 3.6 };
  const GR = rooms.find(m => m.r === GENB.r && m.c === GENB.c), GEN = { x: snap((GR.x1 + GR.x2) / 2) + 0.5, z: snap((GR.z1 + GR.z2) / 2), y: GR.H };
  const cols = [0xc8b8a0, 0xbcac94, 0xb4a48a, 0xc0b098, 0xa8a294, 0xd0c4ac, 0xb0a08a, 0xc4b49c];
  const roofCrates = [];
  rooms.forEach((m, i) => {
    ops.push(['cbuild', m.x1, m.z1, m.x2, m.z2, m.f, { gaps: m.gaps, skip: m.skip, col: cols[(i * 5 + m.r * 3 + m.c) % cols.length] }]);
    // простые предметы на крыше: кондиционеры, трубы, будки, баки, низкие стенки — только в глубине крыши, чтобы не перекрывать проходы
    const ix1 = m.x1 + 5, ix2 = m.x2 - 5, iz1 = m.z1 + 5, iz2 = m.z2 - 5;
    if (ix2 - ix1 < 1.5 || iz2 - iz1 < 1.5) return;
    const cnt = m === T ? 4 : 2 + Math.floor(R() * 3), kinds = ['ac', 'ac', 'ac', 'vent', 'hut', 'tank', 'wall', 'wall'];
    for (let k = 0; k < cnt; k++) {
      const kind = kinds[Math.floor(R() * kinds.length)], x = snap(ix1 + R() * (ix2 - ix1)), z = snap(iz1 + R() * (iz2 - iz1));
      if (m === T && Math.abs(x - PAD.x) < PAD.hw + 3 && Math.abs(z - PAD.z) < PAD.hd + 3) continue;
      if (m === GR && Math.hypot(x - GEN.x, z - GEN.z) < 4) continue;
      if (P.busy.some(b => b[0] === m.id && x > b[1] - 2.5 && x < b[3] + 2.5 && z > b[2] - 2.5 && z < b[4] + 2.5)) continue;
      ops.push(['cprop', kind, x, z, m.H, m.id]);
    }
    if (m !== T && m !== GR && (m.id * 7 + m.r) % 3 !== 1) { const x = snap((m.x1 + m.x2) / 2 + (R() - 0.5) * 4), z = snap((m.z1 + m.z2) / 2 + (R() - 0.5) * 4); roofCrates.push([x, z, m.H]); }
  });
  ops.push(...P.ops);
  ops.push(['generator', GEN.x, GEN.z, GEN.y], ['helipad']);
  // --- границы карты ---
  ops.push(['cwall']);
  // --- улицы: земля, фонари, машины, бочки ---
  const zones = [['dark', 0, 0, 128, 128]];
  for (let k = 0; k < N - 1; k++) zones.push(['road', sc(k) - SW / 2, 0, sc(k) + SW / 2, 128]);
  for (let k = 0; k < N - 1; k++) zones.push(['asphalt', 0, sc(k) - SW / 2, 128, sc(k) + SW / 2]);
  const stairRects = P.busy.filter(b => b[0] === -1);
  const nearStair = (x, z, d = 1.4) => stairRects.some(b => x > b[1] - d && x < b[3] + d && z > b[2] - d && z < b[4] + d);
  const nearInter = (v, d = 3.4) => { for (let k = 0; k < N - 1; k++) if (Math.abs(v - sc(k)) < d) return true; return false; };
  const spawnPts = [];
  for (let k = 0; k < N - 1; k++) {
    const sx = sc(k), sz = sc(k);
    for (let t = 8; t < 124; t += 9) { spawnPts.push({ x: sx, z: t }); spawnPts.push({ x: t, z: sz }); }
    for (let t = 12 + k * 3; t < 120; t += 15) {
      if (!nearInter(t) && !nearStair(sx - SW / 2 + 0.3, t, 2)) ops.push(['lamp', sx - SW / 2 + 0.3, t]);
      if (!nearInter(t + 7) && !nearStair(t + 7, sz - SW / 2 + 0.3, 2)) ops.push(['lamp', t + 7, sz - SW / 2 + 0.3]);
    }
  }
  const carCols = [0x3e5270, 0x8c3a30, 0x60707e, 0x6e7a50, 0xc8c4ba, 0x8a8a3a];
  for (let i = 0; i < 16; i++) {
    const vertical = i % 2 === 0, k = Math.floor(R() * (N - 1)), t = 10 + R() * 108;
    if (nearInter(t, 4.5)) continue;
    const x = vertical ? sc(k) - SW / 2 + 0.3 : t, z = vertical ? t : sc(k) - SW / 2 + 0.3;      // (x, z) у машины — её угол
    if (nearStair(x, z, 2.5) || nearStair(x + (vertical ? 1.5 : 3.2), z + (vertical ? 3.2 : 1.5), 2.5)) continue;
    ops.push(['car', x, z, !vertical, carCols[i % carCols.length], R() < 0.7, R() < 0.2]);
  }
  for (let i = 0; i < 26; i++) {
    const vertical = R() < 0.5, k = Math.floor(R() * (N - 1)), t = 9 + R() * 110, side = R() < 0.5 ? 1 : -1;
    if (nearInter(t, 4)) continue;
    const x = vertical ? sc(k) + side * (SW / 2 - 0.5) : t, z = vertical ? t : sc(k) + side * (SW / 2 - 0.5);
    if (nearStair(x, z, 1.2)) continue;
    ops.push(['xbarrel', x, z]);
  }
  const crates = [[sc(0), sc(0), 0], [sc(3), sc(0), 0], [sc(0), sc(3), 0], [sc(3), sc(3), 0], [sc(1), sc(2), 0], [sc(2), sc(1), 0], [sc(1), 20, 0], [20, sc(2), 0], [sc(2), 108, 0], [108, sc(1), 0], ...roofCrates];
  return {
    name: 'Город', start: { x: sc(1), z: sc(1) }, zones, ops, crates, doors: [], noSpawn: [], spawnPts,
    menu: { cam: { x: sc(0), z: 108 }, zoom: 6.8, x0: sc(0) - 1.5, x1: sc(0) + 1.5, Z0: 90, Z1: 124 },
    events: { gen: GEN, pad: { x: PAD.x, z: PAD.z, hw: PAD.hw, hd: PAD.hd, h: T.H }, arm: null },
    info: { rooms: rooms.length, comps: P.comps, ground: P.ground.length },
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
const BASE_DEF = MAPID === 'city' ? MAP_CITY : CMAP ? MAP_BLANK(CMAP.size, CMAP.name) : MAP_PRISON;
const OV = (CMAP ? CMAP.ov : lsGet('ov_' + MAPID, null)) || {};
function effectiveDef(base, ov) {
  const rm = new Set(ov.removed || []), all = base.ops.filter((_, i) => !rm.has(i)).concat(ov.added || []), rc = new Set(ov.removedCrates || []);
  return Object.assign({}, base, {
    ops: all.filter(o => o[0] !== 'zone' && o[0] !== 'crate'),
    zones: base.zones.concat(all.filter(o => o[0] === 'zone').map(o => [o[1], o[2], o[3], o[4], o[5]])),
    crates: (base.crates || []).filter((_, i) => !rc.has(i)).concat(all.filter(o => o[0] === 'crate').map(o => [o[1], o[2], o[3] || 0])),
    start: ov.start || base.start, events: Object.assign({}, base.events || {}, ov.events || {}),
  });
}
const MAPDEF = effectiveDef(BASE_DEF, OV);

/* ---------- Операции карты «Город» ---------- */
let _facade = null;
function facadeTex() {                                    // фасад: 8 колонок × 4 этажа окон; светящаяся карта — отдельно
  if (_facade) return _facade;
  const mk = (glow) => {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128; const g = cv.getContext('2d');
    g.fillStyle = glow ? '#000' : '#f4f0e8'; g.fillRect(0, 0, 256, 128);
    let s = 31; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let j = 0; j < 4; j++) for (let i = 0; i < 8; i++) {
      const x = i * 32, y = j * 32, lit = r() < 0.38;
      if (glow) { if (lit) { g.fillStyle = r() < 0.5 ? '#ffd890' : '#ffc070'; g.fillRect(x + 9, y + 7, 14, 17); } continue; }
      g.fillStyle = 'rgba(0,0,0,.06)'; g.fillRect(x, y + 28, 32, 4);
      g.fillStyle = '#566472'; g.fillRect(x + 8, y + 6, 16, 19); g.fillStyle = '#6e7e8c'; g.fillRect(x + 9, y + 7, 14, 8);
      g.fillStyle = '#4a4640'; g.fillRect(x + 7, y + 25, 18, 2); g.fillRect(x + 15, y + 6, 2, 19);
    }
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestMipmapLinearFilter; t.encoding = THREE.sRGBEncoding; return t;
  };
  return (_facade = { map: mk(false), glow: mk(true) });
}
function parapetSegs(a0, a1, gaps) {
  const g = gaps.slice().sort((p, q) => p[0] - q[0]), out = []; let cur = a0;
  for (const [s, e] of g) { if (s > cur + 0.01) out.push([cur, Math.min(s, a1)]); cur = Math.max(cur, e); }
  if (cur < a1 - 0.01) out.push([cur, a1]); return out;
}
function cbuild(x1, z1, x2, z2, floors, o = {}) {
  const H = floors * 2.6, w = x2 - x1, d = z2 - z1, grp = new THREE.Group(); staticGroup.add(grp);
  const F = facadeTex(), geo = new THREE.BoxGeometry(w, H, d), uv = geo.attributes.uv;
  const kz = Math.max(1, Math.round(d / 3.2)) / 8, kx = Math.max(1, Math.round(w / 3.2)) / 8, kv = floors / 4;
  for (let i = 0; i < uv.count; i++) { const f = Math.floor(i / 4); if (f >= 2) { if (f === 2 || f === 3) continue; uv.setXY(i, uv.getX(i) * kx, uv.getY(i) * kv); } else uv.setXY(i, uv.getX(i) * kz, uv.getY(i) * kv); }
  const fm = new THREE.MeshLambertMaterial({ color: o.col || 0xc0b098, map: F.map, emissive: 0xffd890, emissiveMap: F.glow, emissiveIntensity: 0.25 });
  const rm = new THREE.MeshLambertMaterial({ color: 0x77726a }), pm = new THREE.MeshLambertMaterial({ color: 0xc8b69a });
  const m = new THREE.Mesh(geo, [fm, fm, rm, rm, fm, fm]); m.position.set((x1 + x2) / 2, H / 2, (z1 + z2) / 2); m.castShadow = m.receiveShadow = true; grp.add(m);
  solids.push({ x1, y1: 0, z1, x2, y2: H, z2, mat: 'concrete', group: grp });
  winMats.push(fm);
  const B = { x1, z1, x2, z2, H, grp, mats: [fm, rm, pm], pm, props: {} }; buildings.push(B); B.finish = () => {                                       // всё, что добавили на крышу позже (площадка), получает свои материалы и тоже прозрачнеет вместе с домом
    const own = new Set(B.mats), cache = new Map(), cl = m0 => { if (own.has(m0)) return m0; let c = cache.get(m0); if (!c) { c = m0.clone(); cache.set(m0, c); B.mats.push(c); } return c; };
    grp.traverse(mesh => { if (!mesh.isMesh) return; mesh.material = Array.isArray(mesh.material) ? mesh.material.map(cl) : cl(mesh.material); });
  };
  const PH = 0.45, T = 0.2, G = o.gaps || { N: [], S: [], E: [], W: [] }, skip = o.skip || [];
  const seg = (side, a0, a1) => { if (skip.includes(side)) return; for (const [s, e] of parapetSegs(a0, a1, G[side])) {
    if (side === 'N') box(s, H, z1, e, H + PH, z1 + T, 0, { material: pm, parent: grp }); if (side === 'S') box(s, H, z2 - T, e, H + PH, z2, 0, { material: pm, parent: grp });
    if (side === 'W') box(x1, H, s, x1 + T, H + PH, e, 0, { material: pm, parent: grp }); if (side === 'E') box(x2 - T, H, s, x2, H + PH, e, 0, { material: pm, parent: grp }); } };
  seg('N', x1, x2); seg('S', x1, x2); seg('W', z1, z2); seg('E', z1, z2);
  return B;
}
function cstair(x1, z1, x2, z2, y0, y1, axis, dir, kind) {   // kind: 0 — на крыше (колонны), 1 — через улицу (настил с бортами), 2 — с земли
  const n = Math.ceil((y1 - y0) / 0.34), rise = (y1 - y0) / n, a0 = axis === 'x' ? x1 : z1, a1 = axis === 'x' ? x2 : z2, run = (a1 - a0) / n;
  const c1 = new THREE.Color(0x8a867c), c2 = new THREE.Color(0x77736a), span = kind === 1, rail = span || (kind === 0);
  const sm = mat(0x8a867c), sm2 = mat(0x77736a), rl = mat(0x5a5e5e);
  for (let i = 0; i < n; i++) {
    const t0 = dir > 0 ? a0 + i * run : a1 - (i + 1) * run, t1 = t0 + run, top = y0 + (i + 1) * rise;
    const bx1 = axis === 'x' ? t0 : x1, bx2 = axis === 'x' ? t1 : x2, bz1 = axis === 'z' ? t0 : z1, bz2 = axis === 'z' ? t1 : z2;
    box(bx1, span ? top - 0.3 : y0, bz1, bx2, top, bz2, 0, { material: i & 1 ? sm2 : sm, hit: 'concrete' });
    if (rail) {
      const wd = 0.1;
      if (axis === 'x') { box(bx1, top, z1, bx2, top + 0.55, z1 + wd, 0, { material: rl, hit: 'metal' }); box(bx1, top, z2 - wd, bx2, top + 0.55, z2, 0, { material: rl, hit: 'metal' }); }
      else { box(x1, top, bz1, x1 + wd, top + 0.55, bz2, 0, { material: rl, hit: 'metal' }); box(x2 - wd, top, bz1, x2, top + 0.55, bz2, 0, { material: rl, hit: 'metal' }); }
    }
  }
}
function cbridge(x1, z1, x2, z2, H, axis) {
  const rl = mat(0x5a5e5e);
  box(x1, H - 0.25, z1, x2, H, z2, 0x6e6a60, { hit: 'metal' });
  if (axis === 'x') { box(x1, H, z1, x2, H + 0.55, z1 + 0.1, 0, { material: rl, hit: 'metal' }); box(x1, H, z2 - 0.1, x2, H + 0.55, z2, 0, { material: rl, hit: 'metal' }); }
  else { box(x1, H, z1, x1 + 0.1, H + 0.55, z2, 0, { material: rl, hit: 'metal' }); box(x2 - 0.1, H, z1, x2, H + 0.55, z2, 0, { material: rl, hit: 'metal' }); }
  box(x1, H - 0.9, z1, x2, H - 0.25, z2, 0x4a4844, { solid: false, cast: false });
}
function cprop(kind, x, z, H, id) {
  const B = buildings.find(b => b.x1 < x && b.x2 > x && b.z1 < z && b.z2 > z && Math.abs(b.H - H) < 0.01 && b.pm); if (!B) return;
  const M = B.props, get = (k, c) => M[k] || (M[k] = (B.mats.push(M[k] = new THREE.MeshLambertMaterial({ color: c })), M[k])), g = B.grp;
  const grey = get('g', 0x8a8e90), sand = get('s', 0x7a7468), rust = get('r', 0x7a5a44), dark = get('d', 0x3a3c3e);
  const bx = (a, y, b, c, yy, d, m, solid = true) => box(a, H + y, b, c, H + yy, d, 0, { material: m, parent: g, solid, hit: 'metal' });
  if (kind === 'ac') { bx(x - 0.8, 0, z - 0.5, x + 0.8, 1.0, z + 0.5, grey); bx(x - 0.55, 1.0, z - 0.3, x + 0.55, 1.06, z + 0.3, dark, false); }
  else if (kind === 'vent') { bx(x - 0.35, 0, z - 0.35, x + 0.35, 1.5, z + 0.35, grey); bx(x - 0.5, 1.5, z - 0.5, x + 0.5, 1.62, z + 0.5, dark, false); }
  else if (kind === 'hut') { bx(x - 1.3, 0, z - 1.3, x + 1.3, 2.2, z + 1.3, sand); bx(x - 1.4, 2.2, z - 1.4, x + 1.4, 2.34, z + 1.4, dark, false); bx(x - 0.4, 0, z + 1.3, x + 0.4, 1.6, z + 1.34, dark, false); }
  else if (kind === 'tank') { for (const [dx, dz] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) bx(x + dx - 0.07, 0, z + dz - 0.07, x + dx + 0.07, 1.2, z + dz + 0.07, dark, false); bx(x - 1.1, 1.2, z - 1.1, x + 1.1, 2.8, z + 1.1, rust); bx(x - 1.0, 2.8, z - 1.0, x + 1.0, 2.9, z + 1.0, dark, false); }
  else bx(x - 1.6, 0, z - 0.18, x + 1.6, 1.0, z + 0.18, sand);
}
function cwall() { const c = 0x8a867c; box(0, 0, 0, 128, 3.2, 0.5, c); box(0, 0, 127.5, 128, 3.2, 128, c); box(0, 0, 0.5, 0.5, 3.2, 127.5, c); box(127.5, 0, 0.5, 128, 3.2, 127.5, c); }
Object.assign(MAP_OPS, { cbuild, cstair, cbridge, cprop, cwall });
