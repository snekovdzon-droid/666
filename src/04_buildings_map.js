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
  if (gap) { para(x1, H, z2 - 0.18, gap[0], H + PH, z2, 0, { material: pm, parent: grp }); para(gap[1], H, z2 - 0.18, x2, H + PH, z2, 0, { material: pm, parent: grp }); }
  else para(x1, H, z2 - 0.18, x2, H + PH, z2, 0, { material: pm, parent: grp });
  if (o.gapN) { para(x1, H, z1, o.gapN[0], H + PH, z1 + 0.18, 0, { material: pm, parent: grp }); para(o.gapN[1], H, z1, x2, H + PH, z1 + 0.18, 0, { material: pm, parent: grp }); } else para(x1, H, z1, x2, H + PH, z1 + 0.18, 0, { material: pm, parent: grp });
  if (o.gapW) { para(x1, H, z1, x1 + 0.18, H + PH, o.gapW[0], 0, { material: pm, parent: grp }); para(x1, H, o.gapW[1], x1 + 0.18, H + PH, z2, 0, { material: pm, parent: grp }); } else para(x1, H, z1, x1 + 0.18, H + PH, z2, 0, { material: pm, parent: grp });
  if (o.gapE) { para(x2 - 0.18, H, z1, x2, H + PH, o.gapE[0], 0, { material: pm, parent: grp }); para(x2 - 0.18, H, o.gapE[1], x2, H + PH, z2, 0, { material: pm, parent: grp }); } else para(x2 - 0.18, H, z1, x2, H + PH, z2, 0, { material: pm, parent: grp });
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
  if (typeof CAR_VOX !== 'undefined') return voxCar(x, z, alongX, col, wreck, burn);          // машина из assets/cars/car.vox
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
  if (MODELS.m_barrel) modelPut('m_barrel', x, z, (x * 7.3 + z * 3.1) % 6.28, 0.9, 0.9, 0.9, { shrink: 0.03, h: 0.9 });          // бочка Meshy (сжатая, с текстурой)
  else {
    const c = fire ? 0x7a4630 : 0x48607a;
    box(x - 0.3, 0, z - 0.3, x + 0.3, 0.9, z + 0.3, c, { hit: 'metal' });
    box(x - 0.33, 0.28, z - 0.33, x + 0.33, 0.34, z + 0.33, 0x3a2a20, { solid: false }); box(x - 0.33, 0.62, z - 0.33, x + 0.33, 0.68, z + 0.33, 0x3a2a20, { solid: false });
  }
  if (fire) { addFire(x, 0.92, z, 1); SCORCHES.push([x, z, 1.1]); scorch(x, z, 1.1); }
}
// Свет огней — пул из 4 ламп у ближайших к камере огней (раньше у каждого огня своя: на большой карте это десяток лишних источников)
const FIRE_LIGHTS = Array.from({ length: QS.fire }, () => { const l = new THREE.PointLight(0xff8a3a, 0, 9, 1.6); scene.add(l); return l; });
function addFire(x, y, z, s) {
  fires.push({ x, y, z, s, acc: 0, seed: Math.random() * 10 });
}
const lamps = [];
function lamp(x, z) {
  if (useModel('m_lamp')) return lampModel(x, z);
  box(x - 0.08, 0, z - 0.08, x + 0.08, 4.2, z + 0.08, 0x5a5c60, { hit: 'metal' });
  box(x - 0.08, 4.1, z - 0.08, x + 0.7, 4.2, z + 0.08, 0x5a5c60, { solid: false });
  const bulb = box(x + 0.45, 3.98, z - 0.1, x + 0.75, 4.1, z + 0.1, 0xfff0c0, { solid: false, cast: false, material: new THREE.MeshBasicMaterial({ color: 0x6a6450 }) });
  lamps.push({ x, z, bulb });
}
// Фонари светят пулом из 3 прожекторов — у ближайших к камере
const LAMP_LIGHTS = Array.from({ length: QS.lamps }, () => { const sp = new THREE.SpotLight(0xffe2a8, 0, 14, 0.75, 0.5, 1.2); scene.add(sp); scene.add(sp.target); return sp; });
function tree(x, z) {
  box(x - 0.15, 0, z - 0.15, x + 0.15, 1.6, z + 0.15, 0x6a4a30, { hit: 'wood' });
  const G = [0x4c6a34, 0x587a3a, 0x3e5a2c];
  for (let i = 0; i < 9; i++) { const s = rnd(0.6, 1.0), cx = x + rnd(-0.6, 0.6), cz = z + rnd(-0.6, 0.6), cy = rnd(1.5, 2.6);
    box(cx - s / 2, cy, cz - s / 2, cx + s / 2, cy + s, cz + s / 2, G[i % 3], { solid: false }); }
  solids.push({ x1: x - 1, y1: 1.6, z1: z - 1, x2: x + 1, y2: 3.2, z2: z + 1, mat: 'wood', leaves: true });   // крона ловит пули
}

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
  if (useModel('m_bench')) return benchModel(x, z, faceX);
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
