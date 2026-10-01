'use strict';
/* ---------- 4. Постройки ---------- */
const WALL = 0xb8a488, WALL2 = 0xa48f74, ROOF = 0x8a8072, RED = 0xa8382a, DARK = 0x221c1a;
const winMat = new THREE.MeshLambertMaterial({ color: 0x241e1c, emissive: 0xffb050, emissiveIntensity: 0 }), winMats = [winMat];
const buildings = [];
function building(x1, z1, x2, z2, floors, o = {}) {
  const H = floors * 2.6, grp = new THREE.Group(); staticGroup.add(grp);
  const B = { x1, z1, x2, z2, H, grp, mats: [] };
  const wm = mat(o.col || WALL).clone(); B.mats.push(wm);
  box(x1, 0, z1, x2, H, z2, 0, { material: wm, parent: grp });
  const rm = mat(ROOF).clone(); B.mats.push(rm);
  box(x1 + 0.05, H, z1 + 0.05, x2 - 0.05, H + 0.02, z2 - 0.05, 0, { material: rm, parent: grp, solid: false, cast: false });
  // парапет (ограда крыши) — кроме проёма к лестнице
  const PH = 0.45, pm = mat(0xc8b69a).clone(); B.mats.push(pm);
  const gap = o.gap;                                   // [x1, x2] проём на южной стороне
  if (gap) { box(x1, H, z2 - 0.18, gap[0], H + PH, z2, 0, { material: pm, parent: grp }); box(gap[1], H, z2 - 0.18, x2, H + PH, z2, 0, { material: pm, parent: grp }); }
  else box(x1, H, z2 - 0.18, x2, H + PH, z2, 0, { material: pm, parent: grp });
  box(x1, H, z1, x2, H + PH, z1 + 0.18, 0, { material: pm, parent: grp });
  box(x1, H, z1, x1 + 0.18, H + PH, z2, 0, { material: pm, parent: grp });
  box(x2 - 0.18, H, z1, x2, H + PH, z2, 0, { material: pm, parent: grp });
  // окна с решётками на все стороны, часть горит светом
  const win = (cx, cy, cz, alongX) => {
    const w = 0.55, h = 0.8, t = 0.06, m = Math.random() < 0.25 ? winMat : mat(DARK);
    const bars = mat(0x5a544c);
    if (alongX) { box(cx - w / 2, cy - h / 2, cz - t, cx + w / 2, cy + h / 2, cz + t, 0, { material: m, parent: grp, solid: false, cast: false });
      for (let i = 1; i < 4; i++) box(cx - w / 2 + i * w / 4 - 0.02, cy - h / 2, cz - t - 0.01, cx - w / 2 + i * w / 4 + 0.02, cy + h / 2, cz + t + 0.01, 0, { material: bars, parent: grp, solid: false, cast: false }); }
    else { box(cx - t, cy - h / 2, cz - w / 2, cx + t, cy + h / 2, cz + w / 2, 0, { material: m, parent: grp, solid: false, cast: false });
      for (let i = 1; i < 4; i++) box(cx - t - 0.01, cy - h / 2, cz - w / 2 + i * w / 4 - 0.02, cx + t + 0.01, cy + h / 2, cz - w / 2 + i * w / 4 + 0.02, 0, { material: bars, parent: grp, solid: false, cast: false }); }
  };
  for (let f = 0; f < floors; f++) {
    const cy = f * 2.6 + 1.5;
    for (let x = x1 + 1; x < x2 - 0.5; x += 1.6) { if (!(f === 0 && Math.abs(x - (x1 + x2) / 2) < 0.9)) win(x, cy, z2, true); win(x, cy, z1, true); }
    for (let z = z1 + 1; z < z2 - 0.5; z += 1.6) { win(x1, cy, z, false); win(x2, cy, z, false); }
    if (f > 0) { box(x1 - 0.02, f * 2.6 - 0.06, z1 - 0.02, x2 + 0.02, f * 2.6 + 0.06, z2 + 0.02, 0, { material: mat(WALL2), parent: grp, solid: false, cast: false }); }
  }
  const dx = (x1 + x2) / 2;                             // дверь
  box(dx - 0.5, 0, z2 - 0.04, dx + 0.5, 1.5, z2 + 0.06, 0, { material: mat(0x4e5a56), parent: grp, solid: false, cast: false });
  box(dx - 0.2, 1.62, z2, dx + 0.2, 1.72, z2 + 0.2, 0, { material: new THREE.MeshBasicMaterial({ color: 0xffe0a0 }), parent: grp, solid: false, cast: false });
  buildings.push(B);
  B.finish = () => { const cache = new Map(); B.mats = [];
    grp.traverse(m => { if (!m.isMesh) return; let c = cache.get(m.material); if (!c) { c = m.material.clone(); cache.set(m.material, c); B.mats.push(c); if (m.material === winMat) winMats.push(c); } m.material = c; }); };
  return B;
}
// Пожарная лестница: марш вдоль x от (xs, z) до высоты H, площадка наверху. Ступени — сплошные (по ним ходят)
function fireEscape(xs, xe, z1, z2, H, grp, y0 = 0) {      // y0 — откуда начинается марш (с крыши на крышу)
  const n = Math.ceil(H / 0.3), run = (xe - xs) / n, rise = H / n, sm = mat(RED, {}), dk = mat(0x6e241c);
  for (let i = 0; i < n; i++) {
    const x = xs + i * run, top = y0 + (i + 1) * rise;
    box(x, top - 0.07, z1 + 0.06, x + run + 0.01, top, z2 - 0.06, 0, { material: i & 1 ? sm : mat(0x962f24), parent: grp, solid: false });   // ступень-решётка
    box(x - 0.01, top - rise, z1 + 0.06, x + 0.03, top - 0.07, z2 - 0.06, 0, { material: dk, parent: grp, solid: false, cast: false });       // подступенок
    solids.push({ x1: x, y1: y0, z1, x2: x + run, y2: top, z2, mat: 'metal', group: grp, stair: true });      // для ходьбы — сплошная
  }
  box(xs, y0, z2 - 0.06, xe, y0 + 0.06, z2, 0, { material: dk, parent: grp, solid: false });
  for (const zz of [z1, z2 - 0.07]) {                                                                          // косоуры
    const len = Math.hypot(xe - xs, H), m = new THREE.Mesh(boxGeo, sm); m.scale.set(len, 0.18, 0.07);
    m.position.set((xs + xe) / 2, y0 + H / 2 - 0.12, zz + 0.035); m.rotation.z = Math.atan2(H, xe - xs); m.castShadow = true; grp.add(m);
  }
  for (const x of [xs + (xe - xs) * 0.5, xe]) box(x - 0.05, y0, z2 - 0.1, x + 0.05, y0 + (x === xe ? H : H * 0.5), z2, 0, { material: dk, parent: grp, solid: false });   // стойки
  const rl = new THREE.Mesh(boxGeo, sm), len = Math.hypot(xe - xs, H); rl.scale.set(len, 0.06, 0.06);           // перила
  rl.position.set((xs + xe) / 2, y0 + H / 2 + 0.9, z2 - 0.03); rl.rotation.z = Math.atan2(H, xe - xs); grp.add(rl);
  for (let i = 2; i < n; i += 4) { const x = xs + i * run, top = y0 + (i + 1) * rise; box(x, top, z2 - 0.06, x + 0.05, top + 0.9, z2, 0, { material: sm, parent: grp, solid: false }); }   // балясины
}


/* ---------- 5. Машины, бочки, фонари, деревья, стена ---------- */
const fires = [];                                     // источники огня: { x, y, z, light, s }
function car(x, z, alongX, col, wreck, burn) {
  const g = new THREE.Group(); staticGroup.add(g);
  const L = 3.2, Wd = 1.5, P = (u1, u2, v1, v2, y1, y2, c, o = {}) => alongX ? box(x + u1, y1, z + v1, x + u2, y2, z + v2, c, Object.assign({ parent: g, hit: 'metal' }, o)) : box(x + v1, y1, z + u1, x + v2, y2, z + u2, c, Object.assign({ parent: g, hit: 'metal' }, o));
  const body = wreck ? new THREE.Color(col).multiplyScalar(0.55).getHex() : col;
  P(0, L, 0, Wd, 0.25, 0.75, body);
  P(0.85, 2.3, 0.08, Wd - 0.08, 0.75, 1.2, body);
  P(0.9, 2.25, 0.05, Wd - 0.05, 0.8, 1.13, 0x2c3a44, { solid: false, cast: false });
  for (const [u, v] of [[0.45, -0.04], [L - 0.95, -0.04], [0.45, Wd - 0.18], [L - 0.95, Wd - 0.18]]) P(u, u + 0.5, v, v + 0.22, 0, 0.45, 0x1c1c1c, { solid: false });
  P(L - 0.04, L + 0.02, 0.15, 0.4, 0.5, 0.65, wreck ? 0x303030 : 0xf0e6b0, { solid: false, cast: false, m: wreck ? {} : { emissive: 0x806030 } });
  P(L - 0.04, L + 0.02, Wd - 0.4, Wd - 0.15, 0.5, 0.65, 0xf0e6b0, { solid: false, cast: false, m: { emissive: 0x806030 } });
  P(-0.02, 0.04, 0.15, 0.4, 0.5, 0.65, 0xb02a22, { solid: false, cast: false }); P(-0.02, 0.04, Wd - 0.4, Wd - 0.15, 0.5, 0.65, 0xb02a22, { solid: false, cast: false });
  if (burn) addFire(alongX ? x + L - 0.7 : x + Wd / 2, 0.78, alongX ? z + Wd / 2 : z + L - 0.7, 1.4);
}
function barrel(x, z, fire) {
  const c = fire ? 0x7a4630 : 0x48607a;
  box(x - 0.3, 0, z - 0.3, x + 0.3, 0.9, z + 0.3, c, { hit: 'metal' });
  box(x - 0.33, 0.28, z - 0.33, x + 0.33, 0.34, z + 0.33, 0x3a2a20, { solid: false }); box(x - 0.33, 0.62, z - 0.33, x + 0.33, 0.68, z + 0.33, 0x3a2a20, { solid: false });
  if (fire) { addFire(x, 0.92, z, 1); SCORCHES.push([x, z, 1.1]); scorch(x, z, 1.1); }
}
// Свет огней — пул из 4 ламп у ближайших к камере огней (раньше у каждого огня своя: на большой карте это десяток лишних источников)
const FIRE_LIGHTS = Array.from({ length: 4 }, () => { const l = new THREE.PointLight(0xff8a3a, 0, 9, 1.6); scene.add(l); return l; });
function addFire(x, y, z, s) {
  fires.push({ x, y, z, s, acc: 0, seed: Math.random() * 10 });
}
const lamps = [];
function lamp(x, z) {
  box(x - 0.08, 0, z - 0.08, x + 0.08, 4.2, z + 0.08, 0x5a5c60, { hit: 'metal' });
  box(x - 0.08, 4.1, z - 0.08, x + 0.7, 4.2, z + 0.08, 0x5a5c60, { solid: false });
  const bulb = box(x + 0.45, 3.98, z - 0.1, x + 0.75, 4.1, z + 0.1, 0xfff0c0, { solid: false, cast: false, material: new THREE.MeshBasicMaterial({ color: 0x6a6450 }) });
  lamps.push({ x, z, bulb });
}
// Фонари светят пулом из 3 прожекторов — у ближайших к камере
const LAMP_LIGHTS = Array.from({ length: 3 }, () => { const sp = new THREE.SpotLight(0xffe2a8, 0, 14, 0.75, 0.5, 1.2); scene.add(sp); scene.add(sp.target); return sp; });
function tree(x, z) {
  box(x - 0.15, 0, z - 0.15, x + 0.15, 1.6, z + 0.15, 0x6a4a30, { hit: 'wood' });
  const G = [0x4c6a34, 0x587a3a, 0x3e5a2c];
  for (let i = 0; i < 9; i++) { const s = rnd(0.6, 1.0), cx = x + rnd(-0.6, 0.6), cz = z + rnd(-0.6, 0.6), cy = rnd(1.5, 2.6);
    box(cx - s / 2, cy, cz - s / 2, cx + s / 2, cy + s, cz + s / 2, G[i % 3], { solid: false }); }
  solids.push({ x1: x - 1, y1: 1.6, z1: z - 1, x2: x + 1, y2: 3.2, z2: z + 1, mat: 'wood', leaves: true });   // крона ловит пули
}

/* ---------- Карта тюрьмы 96×96 (батч 9, без редактора) ----------
   Север — главный корпус (2 этажа, в середине башня в 3 этажа; крыши ходовые, наверх только по красным пожарным лестницам).
   Запад — лазарет и столовая (на крышу столовой — лестница), восток — водонапорная башня и спортплощадка,
   юг за внутренней сеткой — КПП с воротами, стоянка и брошенные машины. Периметр — стена с вышками, проломы на севере, западе и востоке. */
const ROAD = { x1: 46, x2: 50, zFence: 64 };     // дорога от КПП к корпусу, внутренняя сетка по z = 64
function tower(x, z) {                            // вышка на стене
  box(x - 0.6, 0, z - 0.6, x + 0.6, 6.5, z + 0.6, 0x686a68); box(x - 0.9, 6.5, z - 0.9, x + 0.9, 7.6, z + 0.9, 0x55585a);
  box(x - 1, 7.6, z - 1, x + 1, 7.8, z + 1, 0x3e4042, { solid: false });
}
function wallSeg(x1, z1, x2, z2) {                 // стена из плит, чуть разного цвета
  const alongX = Math.abs(x2 - x1) > Math.abs(z2 - z1), n = Math.ceil(alongX ? x2 - x1 : z2 - z1);
  for (let i = 0; i < n; i++) { const c = (i & 1) ? 0x9c968a : 0x948e82;
    if (alongX) box(x1 + i, 0, z1, Math.min(x2, x1 + i + 1), 3.2, z2, c); else box(x1, 0, z1 + i, x2, 3.2, Math.min(z2, z1 + i + 1), c); }
}
function fenceX(x1, x2, z) {                       // сетка-рабица вдоль x: столбы и полупрозрачное полотно, концы не торчат
  const net = mat(0x8a9090, { transparent: true, opacity: 0.45 });
  box(x1, 0, z - 0.04, x2, 2.2, z + 0.04, 0, { material: net, cast: false });
  for (let x = x1; x <= x2 + 0.01; x += 2) box(Math.min(x, x2) - 0.06, 0, z - 0.06, Math.min(x, x2) + 0.06, 2.35, z + 0.06, 0x5a5e5e, { solid: false });
  box(x1, 2.2, z - 0.03, x2, 2.26, z + 0.03, 0x5a5e5e, { solid: false });
}
function bench(x, z, faceX) {                      // скамейка; faceX — смотрит вдоль ±x (к дороге)
  const wood = 0x8a6a44, iron = 0x3a3c3c, s = faceX;
  if (s) { box(x - 0.22, 0.38, z - 0.7, x + 0.22, 0.45, z + 0.7, wood, { solid: false }); box(x - s * 0.24 - 0.04, 0.45, z - 0.7, x - s * 0.24 + 0.04, 0.85, z + 0.7, wood, { solid: false });
    for (const dz of [-0.6, 0.6]) box(x - 0.2, 0, z + dz - 0.04, x + 0.2, 0.38, z + dz + 0.04, iron, { solid: false });
    solids.push({ x1: x - 0.25, y1: 0, z1: z - 0.7, x2: x + 0.25, y2: 0.45, z2: z + 0.7, mat: 'wood', group: null }); }
}
function waterTower(x, z) {                        // водонапорная башня: тёмный низ, ржавый бак
  box(x - 1.8, 0, z - 1.8, x + 1.8, 0.12, z + 1.8, 0x6a645a, { solid: false });
  for (const [dx, dz] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) box(x + dx - 0.14, 0, z + dz - 0.14, x + dx + 0.14, 6.2, z + dz + 0.14, 0x4a4844);
  for (const y of [2, 4]) { box(x - 1.3, y, z - 1.26, x + 1.3, y + 0.1, z - 1.14, 0x4a4844, { solid: false }); box(x - 1.3, y, z + 1.14, x + 1.3, y + 0.1, z + 1.26, 0x4a4844, { solid: false }); }
  box(x - 1.6, 6.2, z - 1.6, x + 1.6, 8.6, z + 1.6, 0x7a6450); box(x - 1.3, 8.6, z - 1.3, x + 1.3, 9.1, z + 1.3, 0x6a5444);
  for (let i = 0; i < 4; i++) box(x - 1.62, 6.6 + i * 0.55, z - 1.62, x + 1.62, 6.66 + i * 0.55, z + 1.62, 0x5e4c3c, { solid: false });
}
function buildMap() {
  // ---- периметр: стена 0.5, проломы на севере (45.5–49.5), западе и востоке (z 55–59), КПП на юге (44–52) ----
  wallSeg(0, 0, 45.5, 0.5); wallSeg(49.5, 0, MAP, 0.5);
  wallSeg(0, MAP - 0.5, 44, MAP); wallSeg(52, MAP - 0.5, MAP, MAP);
  wallSeg(0, 0.5, 0.5, 54.5); wallSeg(0, 59.5, 0.5, MAP - 0.5);
  wallSeg(MAP - 0.5, 0.5, MAP, 54.5); wallSeg(MAP - 0.5, 59.5, MAP, MAP - 0.5);
  for (const [x, z] of [[1, 1], [MAP - 1, 1], [1, MAP - 1], [MAP - 1, MAP - 1], [24, 1], [72, 1], [1, 30], [MAP - 1, 30], [1, 80], [MAP - 1, 80], [42.5, MAP - 1], [53.5, MAP - 1]]) tower(x, z);
  // ---- главный корпус: крылья в 2 этажа, башня в 3; лестницы — земля → крыша крыльев → крыша башни ----
  const main = building(28, 16, 68, 36, 2, { gap: [37.8, 39.4], col: 0xc8b8a0 });
  fireEscape(28.3, 37.8, 36, 37.3, main.H, main.grp);                                   // пологий марш: зомби тоже поднимаются (по полю пути)
  box(37.8, main.H - 0.1, 36, 39.4, main.H, 37.3, RED, { parent: main.grp, hit: 'metal' });
  const top = building(42, 20, 54, 30, 3, { gap: [49.5, 51.1], col: 0xbcac94 });
  fireEscape(44.4, 49.5, 30, 31.3, top.H - main.H, top.grp, main.H);
  box(49.5, top.H - 0.1, 30, 51.1, top.H, 31.3, RED, { parent: top.grp, hit: 'metal' });
  const main2 = building(58, 36, 66, 44, 1, { col: 0xc0b098 });                          // пристройка (прачечная)
  // ---- запад: лазарет и столовая ----
  const inf = building(8, 18, 20, 28, 1, { col: 0xd8d2c4 });
  box(13.4, 1.6, 28, 14.6, 1.9, 28.08, 0xc83030, { solid: false }); box(13.85, 1.15, 28, 14.15, 2.35, 28.08, 0xc83030, { solid: false });   // красный крест
  const can = building(8, 40, 24, 52, 1, { gap: [16.3, 17.9], col: 0xb4a48a });
  fireEscape(11.2, 16.3, 52, 53.3, can.H, can.grp); box(16.3, can.H - 0.1, 52, 17.9, can.H, 53.3, RED, { parent: can.grp, hit: 'metal' });
  // ---- восток: водонапорка и спортплощадка ----
  waterTower(84, 14);
  for (const z of [44, 48, 52]) bench(68.4, z, 1);                                       // скамейки смотрят на площадку
  // ---- юг: внутренняя сетка с воротами, КПП, стоянка ----
  fenceX(0.5, ROAD.x1 - 1, ROAD.zFence); fenceX(ROAD.x2 + 1, MAP - 0.5, ROAD.zFence);
  box(ROAD.x1 - 1.1, 0, ROAD.zFence - 0.15, ROAD.x1 - 0.8, 2.6, ROAD.zFence + 0.15, 0x5a5e5e); box(ROAD.x2 + 0.8, 0, ROAD.zFence - 0.15, ROAD.x2 + 1.1, 2.6, ROAD.zFence + 0.15, 0x5a5e5e);
  const kpp = building(36, 84, 44, 92, 1, { col: 0xa8a294 });
  box(44.6, 0, MAP - 3.5, 45.6, 2.6, MAP - 1.5, 0x8a8a84);                               // будка
  box(50.4, 0.9, MAP - 2.6, 54, 1.0, MAP - 2.5, 0xc84a2a, { solid: false });            // шлагбаум (поднят)
  for (const z of [70, 74, 78]) { bench(44.6, z, 1); bench(51.4, z, -1); }               // вдоль дороги, лицом к ней
  const CC = [0xc8c4ba, 0x60707e, 0x6e7a50, 0x8c3a30, 0x3e5270, 0xd8b030];
  car(60, 74, true, CC[0]); car(60, 77.2, true, CC[1], true, true); car(66, 74, true, CC[2]); car(66, 77.2, true, CC[3], true);
  car(72, 80.5, true, CC[5], true); car(62, 86, false, CC[4]); car(28, 80, false, CC[3], true, true); car(56, 92, true, CC[1], true);
  // ---- двор: бочки, фонари, немного зелени ----
  barrel(26, 40, true); barrel(70, 30, true); barrel(40, 56, true); barrel(56, 58, false); barrel(30, 70, true); barrel(80, 70, false); barrel(14, 60, true); barrel(88, 40, false);
  for (const [x, z] of [[44, 40], [52, 40], [44, 50], [52, 50], [44, 60], [52, 60], [44, 70], [52, 80], [24, 36], [72, 36], [16, 34], [62, 70]]) lamp(x, z);
  const has = n => !!MODELS[n];
  for (const [x, z] of [[4, 6], [90, 6], [4, 90], [92, 92], [26, 58], [88, 60], [6, 66], [34, 92], [78, 92], [90, 28]]) has('tree') ? model('tree', x, z, x * 1.7) : tree(x, z);
  if (has('bush')) for (const [x, z] of [[6, 10], [86, 10], [6, 88], [90, 88], [24, 60], [86, 62], [30, 90], [80, 90], [92, 50]]) model('bush', x, z, x * 2.3, 0.9 + (x % 1) * 0.3);
  if (has('cone')) for (const [x, z] of [[45.2, 66], [50.8, 66], [46, 90], [50, 90], [47, 82]]) model('cone', x, z, x);
  for (const B of buildings) B.finish();
  indexSolids();
}
// Точки выхода зомби: проломы, ворота, двери корпусов и пустыри по сетке
function mapSpawns() {
  const S = [{ x: 47.5, z: 1.4, kind: 'breach' }, { x: 1.4, z: 57, kind: 'gate' }, { x: MAP - 1.4, z: 57, kind: 'gate' }, { x: 48, z: MAP - 1.4, kind: 'gate' },
    { x: 48, z: 36.8, kind: 'bld' }, { x: 62, z: 44.8, kind: 'bld' }, { x: 14, z: 28.8, kind: 'bld' }, { x: 16, z: 52.8, kind: 'bld' }, { x: 40, z: 92.8, kind: 'bld' }];
  for (let x = 8; x < MAP; x += 16) for (let z = 8; z < MAP; z += 16) if (!blocked(x, z, 0, 0.6) && floorAt(x, z, 0) === 0) S.push({ x, z, kind: 'field' });
  return S;
}

