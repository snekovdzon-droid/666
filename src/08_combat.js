'use strict';
/* ---------- 12. Стволы: стрельба, перезарядка, пули, урон, взрывы (логика из 2D v33) ---------- */
const muzzleLight = new THREE.PointLight(0xffd090, 0, 6, 2); scene.add(muzzleLight);
let muzzleT = 0;
function muzzleOf(p) {
  const gp0 = gunPoint(p, 'muz'); if (gp0) return gp0;
  const V = gunVis(p), gx = oneHand(p) ? REV_X * (p.twinSide || 1) : HAND_X, m = (V.muz + (p.att && p.att.barrel && !p.hand ? 0.17 : 0)) * 1.1 - p.kick * 0.1;   // удлинённый ствол — срез дальше
  const lx = gx, ly = HAND_Y + Math.sin(p.pitch) * m, lz = HAND_Z + Math.cos(p.pitch) * m, c = Math.cos(p.yaw), s = Math.sin(p.yaw);
  return { x: p.x + lx * c + lz * s, y: p.y + ly, z: p.z - lx * s + lz * c };
}
function updatePlayerWeapon(p, c, dt) {
  p.lastC = c;
  const A = aimPoint(p, c);
  p.aim = A.pt;
  if (A.pt) { p.yaw = Math.atan2(A.pt.x - p.x, A.pt.z - p.z); const hy = p.y + HAND_Y, d = Math.hypot(A.pt.x - p.x, A.pt.z - p.z), ty = !A.target && A.pt.y < p.y - 0.5 ? hy : A.pt.y;   // v0.53: с крыши без цели под курсором — ствол ровно, не в землю под ногами
    p.pitch = clamp(Math.atan2(ty - hy, Math.max(0.3, d)), -1.2, 0.6); }
  else if (!p.still) { p.yaw = Math.atan2(p.mvx, p.mvz); p.pitch = 0; }
  let fire = c.fire;
  if (fire === null || (c.auto && !c.manual)) fire = !!A.target;          // телефон и ПК без мыши — сами по цели
  const B = WEAPONS[p.gun], id = p.gun;
  if (G.t - p.lastShot > 1.2) p.pump = 0;
  p.fanOn = !!fire; if (!fire) p.fanN = 0;                             // «Веер» (револьвер): пока спуск зажат
  updateUbgl(p, A, dt);                                                // подствольник: очередь гранат
  if (updateHand(p, c, A, fire, dt)) { if (B.rateMax) p.spin = Math.max(0, p.spin - dt); if (B.bloom) p.bloom = Math.max(0, p.bloom - dt * 0.6); p.cool = Math.max(0, p.cool - dt); return; }   // предмет в руке — ствол ждёт
  const ws = wStat(p);
  p.firing = fire && p.ammo > 0 && p.reloadT <= 0;
  if (fire && !p.firing && (c.manual || !c.auto) && SFX.ok('dry', 300)) SFX.dry();
  if (id === 'crossbow') p.spin = L(p, 'cb_spin') && p.firing ? Math.min(1, p.spin + dt / 2.5) : Math.max(0, p.spin - dt * 1.5);   // «Раскрутка» барабана
  else if (B.rateMax) p.spin = p.firing ? Math.min(1, p.spin + dt / (B.spinUp * (L(p, 'mg_grease') ? 0.5 : 1))) : Math.max(0, p.spin - dt);
  if (B.bloom && !p.firing) p.bloom = Math.max(0, p.bloom - dt * 0.6);
  p.cool = Math.max(0, p.cool - dt);
  if (p.ammo > ws.mag) p.ammo = ws.mag;
  if (p.reloadT > 0) {
    if (p.shellMode) {                                 // «Поштучная зарядка»: по патрону, стрелять можно в любой момент
      p.reloadT -= dt;
      if (p.reloadT <= 0) { p.ammo++; SFX.shellLoad(); if (p.ammo < ws.mag) p.reloadT = p.reloadMax; else { p.reloadT = 0; p.shellMode = false; SFX.reload(false, id); } }
      if (fire && p.ammo > 0 && p.cool <= 0) { p.reloadT = 0; p.shellMode = false; } else return;
    } else {
      p.reloadT -= dt;
      if (p.reloadT <= 0) { p.reloadT = 0; loadMag(p, ws); }
      return;
    }
  }
  if (c.reload && p.ammo < ws.mag) { startReload(p, ws); return; }
  if (B.bolt && p.ammo <= 0) { startReload(p, ws); return; }                          // арбалет: взвод
  if (!(fire && p.cool <= 0 && p.ammo > 0)) return;
  let use = 1, pelletMul = 1, mul = 1, ap = A.pt;
  if (id === 'sawnoff' && L(p, 'so_double') && p.ammo >= 2) { use = 2; pelletMul = 2; }
  if (twinGuns(p)) {                                                   // «Два кольта» / «Второй узи»: стволы по очереди
    p.twinN++; p.twinSide = p.twinN % 2 ? -1 : 1;
    const split = id === 'revolver' || L(p, 'smg_split') > 0;           // у узи своя цель — только с «Раздельным огнём»
    if (id === 'smg' && p.evo.smg_storm && p.sprinting) { const t2 = sideTarget(p, p.twinSide); ap = t2 ? new THREE.Vector3(t2.x, zAimY(t2), t2.z) : sidePoint(p, p.twinSide); }   // «Ураган»: на бегу — в обе стороны
    else if (split && p.twinSide < 0 && c.auto && A.target) { const t2 = secondTarget(p, A.target); if (t2) ap = new THREE.Vector3(t2.x, zAimY(t2), t2.z); }
  } else p.twinSide = 1;
  if (id === 'smg' && L(p, 'smg_burst')) { p.burstN = (p.burstN + 1) % 2; if (p.burstN === 0) mul = 1.5; }   // «Отсечка по 2»: вторая ×1,5
  p.cocked = id === 'revolver' && L(p, 'rv_cock') > 0 && G.t - p.lastShot >= 1;   // «Взвод курка»
  const dir = shoot(p, ws, ap, mul, pelletMul);
  if (id === 'sawnoff') sawBlast(p, dir, use);                         // ударная волна обреза
  shotFeel(p, dir, use);
  if (B.selfKnock) {                                   // отдача обреза отбрасывает стрелка
    const k = B.selfKnock * (1 + 0.4 * L(p, 'so_jet')) * (p.evo.so_liveram ? 2 : 1) * (use === 2 ? 1.4 : 1) * (L(p, 'so_grip') ? 0.4 : 1);
    p.kx -= Math.sin(dir) * k; p.kz -= Math.cos(dir) * k; p.ramT = 0.35;
    if (L(p, 'so_jet')) p.inv = Math.max(p.inv, 0.3);
  }
  if (id === 'revolver' && p.evo.rv_500) { p.kx -= Math.sin(dir) * 2.8; p.kz -= Math.cos(dir) * 2.8; }   // «.500 Магнум»: отдача на полшага
   // подствольник: заряд копится, выстрел — по кнопке
  if (id === 'revolver') p.fanN++;
  if (B.bloom && !L(p, 'ri_burst') && !p.evo.ri_marks && !p.evo.smg_spec) p.bloom = Math.min(B.bloomMax, p.bloom + B.bloom * Math.pow(0.5, L(p, 'ri_recoil')));
  if (id === 'shotgun' && L(p, 'sg_aim')) p.stillT = 0;   // «Выцеливание» потрачено — снова постой
  p.pump = G.t - p.lastShot < 1.2 ? Math.min(3, p.pump + 1) : 0;
  p.lastShot = G.t;
  p.ammo -= use;
  let cool = 1 / ws.rate;
  if (id === 'rifle' && L(p, 'ri_burst')) { p.burstN = (p.burstN + 1) % 3; cool = p.burstN === 0 ? 0.3 : cool * 0.75; }
  if (id === 'revolver' && p.handN > 0) { p.handN--; cool *= 0.75; }   // «Ловкость рук»
  if (id === 'smg' && L(p, 'smg_burst')) cool = p.burstN === 0 ? 0.22 : cool * 0.6;
  p.cool = cool;
  if (p.ammo <= 0) startReload(p, wStat(p));           // пустой — перезаряжаем этот же ствол (смены оружия нет)
}
// Выстрел: возвращает горизонтальный угол выстрела
function shoot(p, ws, ap, mul, pelletMul) {
  const mz = muzzleOf(p), id = p.gun, n = ws.pellets * pelletMul;
  let ang = p.yaw, elev = 0;
  if (ap) { const dx = ap.x - mz.x, dz = ap.z - mz.z, hd = Math.hypot(dx, dz); if (hd > 0.25) ang = Math.atan2(dx, dz); elev = clamp(Math.atan2(ap.y - mz.y, Math.max(0.5, hd)), -0.9, 0.9); }
  p.shotN++;
  const tr = L(p, 'ri_tracer'), mark = id === 'rifle' && tr > 0 && p.shotN % (tr >= 2 ? 3 : 5) === 0;   // «Трассеры»: метка, не огонь
  const ignite = id === 'shotgun' && L(p, 'sg_fire') > 0;
  const burn = ignite ? fireOf(p) : null;
  let third = false; if (id === 'rifle') { p.serN++; third = p.serN % 3 === 0; }   // каждая 3-я пуля (у «Отсечки» — 3-я в очереди)
  let smul = 1, xp = 0;
  if (third && L(p, 'ri_series')) smul = L(p, 'ri_series') >= 2 ? 2 : 1.5;        // «Прицельная серия»
  if (third && p.evo.ri_marks) xp = 99;                                           // «Марксман»: 3-я пуля пробивает всех
  if (id === 'mg' && p.evo.mg_mower && p.shotN % 4 === 0) xp = 1;                 // «Косилка»: каждая 4-я пробивает одного
  if (id === 'smg' && p.evo.smg_spec && p.shotN % 5 === 0) xp = 1;                // «Спецназ»: каждая 5-я пробивает одного
  const bolt = !!WEAPONS[id].bolt, tip = bolt ? boltTip(p) : null;
  const last = bolt && L(p, 'cb_mag') > 0 && L(p, 'cb_last') > 0 && p.ammo === 1;   // «Последний болт»: веер из 5
  const rv = id === 'revolver', rico = rv ? L(p, 'rv_rico') : 0;
  const nn = last ? 5 : n;
  for (let i = 0; i < nn; i++) {
    let a = ang, sp = ws.speed;
    if (ws.fan) a += (i - (nn - 1) / 2) * (bolt ? (last ? 0.12 : 0.14) : 0.12) + (Math.random() - 0.5) * ws.spread;   // болты веером: ~8° между соседними
    else { a += (Math.random() - 0.5) * ws.spread * (pelletMul > 1 ? 1.3 : 1); sp *= 0.85 + Math.random() * 0.3; }
    let d = ws.dmg * mul * smul, crit = smul > 1, bcrit = false;
    if (bolt) {
      if (nn === 3 && i !== 1) d *= 0.6;                                                    // «Тройной болт»: боковые — 60%
      if (L(p, 'cb_crit') > 0 && Math.random() < 0.15) { d *= 2; crit = bcrit = true; }     // «Меткий выстрел»
    }
    const e = elev + (ws.fan ? 0 : rnd(-0.03, 0.03)), ch = Math.cos(e);
    bullets.push({ owner: p, x0: p.x, z0: p.z, x: mz.x, y: mz.y, z: mz.z, vx: Math.sin(a) * ch * sp, vy: Math.sin(e) * sp, vz: Math.cos(a) * ch * sp,
      slug: id === 'shotgun' && L(p, 'sg_slug') > 0, life: ws.life, dmg: d, pierce: Math.min(99, ws.pierce + xp), knock: ws.knock, hits: [], big: mul > 1 || crit, heavy: ws.heavy || (id === 'shotgun' && L(p, 'sg_slug') > 0),
      pb: id === 'sawnoff' ? L(p, 'so_pb') : 0, ignite, burn, core: id === 'shotgun' ? L(p, 'sg_core') : 0, thin: id === 'shotgun' && !!p.evo.sg_elephant && L(p, 'sg_slug') > 0, grow: rv ? L(p, 'rv_grow') : 0,
      mark, tracer: mark, supp: id === 'rifle' ? L(p, 'ri_supp') : 0, under: id === 'rifle' && L(p, 'ri_under') > 0, far: id === 'rifle' && L(p, 'ri_scope') > 0,
      helm: id === 'mg' && L(p, 'mg_core') > 0, stag: id === 'mg' && L(p, 'mg_stag') > 0, pop: id === 'mg' && !!p.evo.mg_127,
      rico, trick: rv && !!p.evo.rv_trick, cock: rv && !!p.cocked, knee: rv && L(p, 'rv_knee') > 0, bounceN: 0 });
    if (bolt) Object.assign(bullets[bullets.length - 1], { bolt: true, heavy: true, ignite: !!tip.burn, burn: tip.burn, boom: tip.boom, pool: tip.pool, trail: tip.trail, silver: L(p, 'cb_silver') > 0, fletch: L(p, 'cb_fletch') > 0, bcrit, noFF: true });
  }
  if (id === 'shotgun' && p.evo.sg_dragon) addFireStrip(p, mz, ang, Math.min(5, ws.speed * ws.life), burn);
  return ang;
}
// Огонь патронов: 5 урона/с на 2 с; «Белый фосфор» +50% и +0,5 с за уровень; растёт только от перков урона, не от времени
function fireOf(p) {
  const ph = L(p, 'sg_phos');
  return { t: 2 + 0.5 * ph, dps: 5 * (1 + 0.5 * ph) * p.st.dmg, spread: L(p, 'sg_blaze') > 0, slow: !!p.evo.sg_dragon, owner: p };
}
// «Драконье дыхание»: узкая горящая полоса на 2 с, у каждого игрока не больше трёх
const fireStrips = [];
function addFireStrip(p, mz, ang, len, burn) {
  const own = fireStrips.filter(f => f.owner === p); if (own.length >= 3) fireStrips.splice(fireStrips.indexOf(own[0]), 1);
  const y = floorAt(mz.x, mz.z, p.y + 0.3), x1 = mz.x + Math.sin(ang) * len, z1 = mz.z + Math.cos(ang) * len;
  fireStrips.push({ owner: p, x0: mz.x, z0: mz.z, x1, z1, y, t: 2, burn: burn || fireOf(p), acc: 0 });
  for (let k = 0; k <= 6; k++) scorch(mz.x + (x1 - mz.x) * k / 6, mz.z + (z1 - mz.z) * k / 6, 0.18);
}
const segDist = (x, z, f) => { const dx = f.x1 - f.x0, dz = f.z1 - f.z0, l2 = dx * dx + dz * dz || 1, t = clamp(((x - f.x0) * dx + (z - f.z0) * dz) / l2, 0, 1); return Math.hypot(x - f.x0 - dx * t, z - f.z0 - dz * t); };
function updateFireStrips(dt) {
  for (let i = fireStrips.length - 1; i >= 0; i--) {
    const f = fireStrips[i]; f.t -= dt;
    if (f.t <= 0) { fireStrips.splice(i, 1); continue; }
    f.acc += dt * 30 * (f.rad ? f.rad * f.rad * 2 : 1);
    while (f.acc > 1) { f.acc--; const k = Math.random(), jr = f.rad || 0.12; spawnP({ x: f.x0 + (f.x1 - f.x0) * k + rnd(-jr, jr), y: f.y + 0.05, z: f.z0 + (f.z1 - f.z0) * k + rnd(-jr, jr), vx: rnd(-0.2, 0.2), vy: rnd(0.8, 1.6), vz: rnd(-0.2, 0.2), s: rnd(0.1, 0.18), s1: 0.02, col: 0xffd060, col1: 0xd02808, glow: true, life: rnd(0.3, 0.55), drag: 0.97 }); }
    forNear((f.x0 + f.x1) / 2, (f.z0 + f.z1) / 2, z => { if (!z.dead && Math.abs(z.y - f.y) < 0.6 && segDist(z.x, z.z, f) < (f.rad || 0.35) + z.r * 0.5) setBurn(z, f.burn.t, f.burn.dps, false, 1, f.burn.slow); }, 3.5);
    if (!f.noFF) for (const q of players) if (q !== f.owner && !q.down && q.inv <= 0 && Math.abs(q.y - f.y) < 0.6 && segDist(q.x, q.z, f) < 0.3 && !L(q, 'fireproof') && G.state === 'play') hurtPlayer(q);   // огонь по своим включён
  }
}
// Всё, что делает выстрел ощутимым: звук, отдача, толчок камеры, вибрация, вспышка, дым, гильза
function shotFeel(p, ang, use) {
  const F = FEEL[p.gun], mz = muzzleOf(p), dx = Math.sin(ang), dz = Math.cos(ang);
  SFX.shot(p.gun, p.gun === 'crossbow' ? p.branch : undefined);
  p.kick = Math.min(3, p.kick * 0.6 + F.kick * 0.55);                 // откат ствола в руках; в очереди копится
  p.kx -= dx * F.push; p.kz -= dz * F.push;                            // героя слегка сдвигает назад
  p.leadT = 0.45;                                                     // камера уходит вперёд, куда смотрит ствол, пока идёт стрельба
  const KV = (SPLIT.on && viewFor(p)) || CAM; KV.kx -= dx * F.cam * 0.08; KV.kz -= dz * F.cam * 0.08;   // короткий толчок камеры назад
  shake = Math.max(shake, F.shake);
  rumble(p, F.rumble[0] * (p.gun === 'mg' ? 0.5 + 0.5 * p.spin : 1), F.rumble[1]);
  const W = p.gun;
  // дым у каждого оружия свой: дробовики — густое облако веером, винтовка — тонкая струйка, пулемёт — короткие клубки, ПП — лёгкая дымка, револьвер — круглый клуб
  const SM = { shotgun: [7, 0.12, 0.8, 1.3, 2.6, 0.5, 0xd8d4cc, 0x8e8a84], sawnoff: [9, 0.14, 0.95, 1.5, 2.8, 0.7, 0xdcd8d0, 0x8a8680], rifle: [3, 0.07, 0.35, 1.5, 1.6, 0.1, 0xb4bcc4, 0x7c848c],
    mg: [1, 0.09, 0.4, 0.7, 1.3, 0.35, 0xc0bcb4, 0x7a7670], smg: [1, 0.07, 0.3, 0.55, 1.0, 0.3, 0xc4c0b8, 0x84807a], revolver: [5, 0.16, 0.75, 1.1, 1.2, 0.2, 0xe0dcd4, 0x908c86] }[W];
  if (SM && !(W === 'smg' && Math.random() < 0.5) && !(W === 'mg' && Math.random() < 0.4)) {
    const [n, s0, s1, life, spd, spread, c0, c1] = SM;   // soft — полупрозрачный дым (~30%)
    for (let i = 0; i < n; i++) { const a = ang + rnd(-spread, spread), v = spd * rnd(0.4, 1) * (W === 'rifle' ? 1 + i * 0.5 : 1);
      spawnP({ x: mz.x + dx * 0.15, y: mz.y, z: mz.z + dz * 0.15, vx: Math.sin(a) * v, vy: rnd(0.2, 0.8), vz: Math.cos(a) * v, s: s0, s1: s1 * rnd(0.7, 1.1), col: c0, col1: c1, life: life * rnd(0.8, 1.15), drag: 0.9, soft: true }); }
    if (W === 'shotgun' || W === 'sawnoff') for (let i = 0; i < 4; i++) spawnP({ x: mz.x, y: mz.y, z: mz.z, vx: rnd(-0.2, 0.2), vy: rnd(0.4, 0.9), vz: rnd(-0.2, 0.2), s: 0.1, s1: 0.5, col: 0xb8b4ac, col1: 0x7a7670, life: 1.6, drag: 0.96, soft: true });   // стелется у ствола
  }
  if (W === 'crossbow') {                                                                              // вспышка у тетивы по пути
    const col = p.branch === 'fire' ? [0xffc050, 0xd02808] : p.branch === 'boom' ? [0xff4a3a, 0x8a1810] : null;
    if (col) for (let i = 0; i < 4; i++) spawnP({ x: mz.x + dx * 0.1, y: mz.y, z: mz.z + dz * 0.1, vx: dx * rnd(0.5, 2) + rnd(-0.6, 0.6), vy: rnd(0.2, 1.2), vz: dz * rnd(0.5, 2) + rnd(-0.6, 0.6), s: 0.12, s1: 0.02, col: col[0], col1: col[1], glow: true, life: rnd(0.15, 0.3) });
    if (p.branch === 'drum') { const ej = gunPoint(p, 'eject'); spawnP({ x: ej ? ej.x : mz.x, y: ej ? ej.y : mz.y, z: ej ? ej.z : mz.z, vx: Math.sin(p.yaw - 1.4) * 1.2, vy: 1.8, vz: Math.cos(p.yaw - 1.4) * 1.2, g: 14, s: 0.04, col: 0xd8b050, life: 0.5, bounce: 1 }); }   // вылетает капсюль барабана
  }
  if (F.shell) for (let i = 0; i < use; i++) spawnCasing(p, F.shell, 1);
}
function spawnCasing(p, type, side) {
  const ej = gunPoint(p, 'eject');
  const a = p.yaw - Math.PI / 2 * side + rnd(-0.4, 0.4), hy = p.y + HAND_Y + 0.05, shell = type === 'shell';
  spawnP({ x: ej ? ej.x : p.x + Math.sin(a) * 0.2, y: ej ? ej.y : hy, z: ej ? ej.z : p.z + Math.cos(a) * 0.2, vx: Math.sin(a) * rnd(1.8, 3.2), vy: rnd(2.5, 4.2), vz: Math.cos(a) * rnd(1.8, 3.2), g: 16,
    s: shell ? 0.12 : 0.085, sx: 0.8, sz: shell ? 1.8 : 1.6, ry: Math.random() * 3, rx: Math.random() * 3, col: shell ? 0xe03a24 : 0xffd23c, life: 30, bounce: 1, stay: true, snd: type });
}
// Перезарядка закончилась: магазин полон (у арбалета болты бесконечные)
function loadMag(p, ws) {
  p.ammo = ws.mag;
  SFX.reload(false, p.gun);
}
function startReload(p, ws) {
  SFX.reload(true, p.gun, p.branch);
  if (p.gun === 'sawnoff') for (let i = 0; i < 2; i++) spawnCasing(p, 'shell', -1);                          // переломил — гильзы выпали
  if (p.gun === 'revolver') for (let i = 0; i < ws.mag - p.ammo; i++) spawnCasing(p, 'brass', Math.random() < 0.5 ? 1 : -1);   // высыпал барабан
  let t = ws.reload;
  if (p.gun === 'rifle' && L(p, 'ri_tact') && p.ammo > 0) t *= 0.6;
  if (p.evo.so_berserk && p.hp === 1) t = 0.05;         // «Берсерк»: при 1 сердце перезарядка мгновенная
  p.shellMode = p.gun === 'shotgun' && L(p, 'sg_shell') > 0 && t > 0.05;
  if (p.shellMode) t = ws.reload / 4;                    // по одному патрону
  p.reloadT = p.reloadMax = t; p.burstN = 0; p.fanShots = 0; p.fanN = 0;
}
/* ---- Пули ---- */
const zHeight = z => z.form === 'crawl' ? 0.8 : z.form === 'hound' ? 0.55 : z.form === 'fat' ? 1.35 : isVoxZ(z) ? VZ.H * (FORM_H[z.form] || 1) + 0.05 : BODY_H * (z.scale || 1) + 0.1;
function updateBullets(dt) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i]; b.life -= dt;
    const sp = Math.hypot(b.vx, b.vy, b.vz), steps = Math.max(1, Math.ceil(sp * dt / 0.15));
    let dead = b.life <= 0;
    for (let s = 0; s < steps && !dead; s++) {
      b.x += b.vx * dt / steps; b.y += b.vy * dt / steps; b.z += b.vz * dt / steps;
      if (b.x < 0 || b.z < 0 || b.x > MAP || b.z > MAP) { dead = true; b.lost = true; break; }
      if (b.y <= 0.02) { dust(b.x, 0.03, b.z, 0x8a6a44, 3); SFX.impact('dirt'); dead = true; b.y = 0.05; break; }
      let so = pointSolid(b.x, b.y, b.z); if (so && so.rail) so = null;   // v0.60: сквозь перила пули пролетают
      if (so && b.thin && (so.y2 - so.y1 < 1.4 || Math.min(so.x2 - so.x1, so.z2 - so.z1) < 0.3)) so = null;   // «Слонобой» проходит тонкие преграды
      if (so) { const bx = b.x - b.vx / sp * 0.06, bz = b.z - b.vz / sp * 0.06;
        if (so.mat === 'metal') sparks(bx, b.y, bz); else dust(bx, b.y, bz, so.mat === 'wood' ? 0x7a5a36 : 0xb0a690, so.leaves ? 2 : 5);
        SFX.impact(so.mat); if (so.expl) { const pv = ATTR; ATTR = b.owner || b.src || null; explDamage(so.expl, b.dmg || 8); ATTR = pv; } dead = true; b.x = bx; b.z = bz; b.wallHit = true; break; }
      forNear(b.x, b.z, z => {
        if (z.dead || b.hits.includes(z.id)) return;
        const r = z.r + 0.08 + (b.fletch ? 0.07 : 0); if ((z.x - b.x) ** 2 + (z.z - b.z) ** 2 > r * r || b.y < z.y - 0.05 || b.y > z.y + zHeight(z)) return;
        if (hitByBullet(z, b) === false) { dead = true; b.inZ = z; return false; }
      });
    }
    if (dead) { if (b.bolt) boltEnd(b); bullets.splice(i, 1); }
    else if (b.bolt && bulletTrailFx(b, dt)) { /* хвост арбалетного болта нарисован */ }
    else if (Math.random() < 0.7) spawnP({ x: b.x, y: b.y, z: b.z, s: b.heavy ? 0.08 : 0.05, sz: b.heavy ? 5 : 3, ry: Math.atan2(b.vx, b.vz), col: b.ignite ? 0xff8030 : b.tracer ? 0xff3a2a : b.heavy ? 0xfff0c0 : 0xffe2a0, glow: true, life: b.ignite || b.tracer ? 0.07 : 0.03 });
  }
}
// Вид болта по пути: огненный хвост с искрами, красная мигалка на наконечнике разрывного, барабанный — латунный отблеск
function bulletTrailFx(b, dt) {
  const ry = Math.atan2(b.vx, b.vz);
  spawnP({ x: b.x, y: b.y, z: b.z, s: 0.08, sz: 5, ry, col: 0xfff0c0, glow: true, life: 0.04 });          // сам болт
  if (b.burn) {                                                                                           // зажигательный: языки пламени и угольки позади
    spawnP({ x: b.x - b.vx * 0.012, y: b.y, z: b.z - b.vz * 0.012, vy: rnd(0.3, 0.9), s: 0.17, s1: 0.03, col: 0xffc050, col1: 0xd02808, glow: true, life: rnd(0.18, 0.3) });
    if (Math.random() < 0.6) spawnP({ x: b.x, y: b.y, z: b.z, vx: rnd(-0.6, 0.6), vy: rnd(0.4, 1.4), vz: rnd(-0.6, 0.6), g: 3, s: 0.05, s1: 0.01, col: 0xff8a2a, glow: true, life: rnd(0.3, 0.55) });
  } else if (b.boom) {                                                                                    // разрывной: красная мигалка
    if (Math.floor(G.t * 16) % 2 === 0) spawnP({ x: b.x, y: b.y + 0.02, z: b.z, s: 0.2, s1: 0.12, col: 0xff2a1a, glow: true, life: 0.07 });
    spawnP({ x: b.x, y: b.y, z: b.z, s: 0.05, col: 0xc84a3a, life: 0.06 });
  } else return false;
  return true;
}
function hitByBullet(z, b) {
  b.hits.push(z.id);
  const s = Math.hypot(b.vx, b.vz) || 1;
  let d = b.dmg;
  const close = Math.hypot(z.x - b.x0, z.z - b.z0) < 1.5;
  if (b.pb && close) d *= 1.5 + 0.25 * (b.pb - 1);
  if (b.core && (z.type === 'armored' || z.type === 'fat')) d *= 1 + 0.5 * b.core;   // «Бронебойный сердечник»
  if (b.helm && z.type === 'armored') d *= 1.5;
  if (b.silver && (z.type === 'armored' || z.type === 'fat')) d *= 2;                   // «Серебряный наконечник»
  if (b.owner && b.owner.att && b.owner.att.light && inBeam(b.owner, z)) d *= 1.15;   // подствольный фонарь: +15% в луче
  if (b.owner && b.owner.cls === 'cowboy' && (z.type === 'runner' || z.type === 'armored')) d *= 1.15;   // Ковбой                                        // пулемёт: «Бронебойные сердечники»
  if (b.far && Math.hypot(z.x - b.x0, z.z - b.z0) > 5) d *= 1.15;                     // «Выдержка»: дальше 5 клеток
  if (b.under && (z.supT > 0 || z.slowT > 0 || z.stunT > 0 || (z.burnT > 0 && z.burnSlow))) d *= 1.2;   // «Под обстрелом»
  if (b.pop && z.type === 'fat') { z.safeBoom = true; z.popNow = true; }              // «12.7»: толстяк лопается на месте
  if (b.thin && z.type === 'fat') z.safeBoom = true;                                   // «Слонобой»: толстяк лопается, не раня игроков
  if (z.form === 'armored' && b.y > z.y + 0.95) sparks(b.x, b.y, b.z);               // пуля звякнула о каску
  dzBy(b.owner || b.src, z, d, b.vx / s, b.vz / s, b.knock, b.y, b.slug || b.boom);
  SFX.hit();
  if (b.bcrit) { SFX.hit(); blood(z.x, b.y, z.z, b.vx / s, b.vz / s, 10); sparks(b.x, b.y, b.z); shake = Math.max(shake, 0.1); }   // хруст «Меткого выстрела»
  if (b.ignite) { const f = b.burn || { t: 2.5, dps: 6 * (b.owner ? b.owner.st.dmg : 1) }; setBurn(z, f.t, f.dps, f.spread, 0, f.slow); }
  if (z.dead && b.owner && close) onCloseKill(b.owner);
  if (!z.dead) {
    if (b.mark) z.markT = 3;                                                            // «Трассеры»: +15% урона от всех
    if (b.supp) { z.supK = Math.min(b.supp >= 2 ? 0.4 : 0.3, (z.supT > 0 ? z.supK : 0) + 0.1); z.supT = 1; }   // «Прижать огнём»
    if (b.stag && z.type === 'runner') z.stunT = Math.max(z.stunT || 0, 0.3);           // «Отдача калибра»
    if (b.knee) kneeShot(z);                                                            // «Выстрел в колено»
  }
  if (b.bolt && b.boom) return false;                                                    // разрывной болт рвётся на первом
  if (z.dead && b.owner && L(b.owner, 'rv_hand')) b.owner.handN = Math.min(3, b.owner.handN + 1);   // «Ловкость рук»
  if (b.rico !== undefined && b.bounceN < 30 && ((z.dead && (b.rico > 0 || b.trick || b.cock)) || (!z.dead && b.cock)) && ricochet(b, z)) {
    if (z.dead && b.rico > 0) b.rico--; else if (!(z.dead && b.trick)) b.cock = false;
    if (b.trick) b.dmg *= 1.2;                                                          // «Трюкач»: +20% за отскок
    return;                                                                              // отскок не тратит пробитие
  }
  if (b.wall) { z.wallT = 0.45; z.wallDmg = d * b.wall; z.wallOwner = b.owner || b.src || null; }                               // «В стену»
  if (b.grow) b.dmg *= 1 + 0.1 * b.grow;
  if (b.pierce-- <= 0) return false;
}
/* ---- Урон зомби: вздрагивание, кровь, отлёт трупа, кристалл опыта ---- */
function damageZombie(z, dmg, dx, dz, knock, hy, pierce) {
  if (z.dead) return;
  if (z.shield && !pierce && (dx || dz)) {                                              // щит бунтаря: спереди почти не берёт; взрывы и «Жакан» пробивают, огонь и колючка идут мимо щита
    const fx = Math.sin(z.yaw), fz = Math.cos(z.yaw);
    if (dx * fx + dz * fz < -0.35) { dmg *= 0.06; knock *= 0.3; sparks(z.x + fx * 0.35, z.y + 0.9, z.z + fz * 0.35); SFX.impact('metal'); }
  }
  if (z.kres) knock *= z.kres;
  if (z.markT > 0) dmg *= 1.15;                                                         // метка трассера
  const _rs = ATTR && ATTR.rs; if (_rs) _rs.dmg += Math.min(dmg, Math.max(0, z.hp));           // нанесённый урон — реально снятое здоровье
  gibTrack(z, dmg); z.hp -= dmg; z.flash = 0.08; if (dmg >= 3) z.hurtT = 0.16;
  z.kx += dx * knock * 8; z.kz += dz * knock * 8;
  const by = hy !== undefined ? hy : z.y + 0.6;
  if (dx || dz) { blood(z.x, by, z.z, dx, dz, 4); if (Math.random() < 0.5) bloodDecal(z.x + dx * 0.3, z.z + dz * 0.3, 0.2, dx, dz); }
  if (z.hp > 0) return;
  z.dead = true; z.deadT = 0; G.kills++; if (_rs) { _rs.kills++; const _m = Math.floor(G.t / 60); _rs.kpm[_m] = (_rs.kpm[_m] || 0) + 1; } (G.killsBy || (G.killsBy = {}))[z.type] = (G.killsBy[z.type] || 0) + 1;
  if (z.bolts) dropBolts(z);                                                              // болты, застрявшие в зомби, остаются в трупе
  SFX.death(); zvDeath(z); dropFromZombie(z);                                                          // редкий малый ящик
  const T = ZOMBIES[z.type];
  bloodDecal(z.x + dx * 0.35, z.z + dz * 0.35, 0.3 + Math.random() * 0.1, dx, dz);          // лужа меньше, чем была (правка из плейтеста)
  blood(z.x, z.y + 0.6, z.z, dx, dz, 12);
  gems.push({ x: z.x, y: z.y, z: z.z, v: T.xp * backMul(), pull: false, t: Math.random() * 6, vy: 2.5 });
  if (z.type === 'warden') wardenDown(z);
  if (T.fat) { z.swell = z.popNow ? 0.999 : 0.001; z.flash = 0; return; }                                    // толстяк раздувается и взрывается
  if (maybeGib(z, dx, dz, knock)) return;                                                 // мощное убийство — тело разлетается на части
  const sp = Math.min(7, 1.5 + knock * 10) * rnd(0.8, 1.2) * 0.35;                        // труп отлетает по направлению удара
  z.cvx = dx * sp; z.cvz = dz * sp; z.vy = 1.2 + knock * 3;
  z.yaw = Math.atan2(-dx, -dz); z.flip = Math.random() < 0.25 ? 1 : -1;
  for (let i = 0; i < 3; i++) spawnP({ x: z.x, y: z.y + 0.7, z: z.z, vx: dx * rnd(2, 5) + rnd(-1, 1), vy: rnd(2, 5), vz: dz * rnd(2, 5) + rnd(-1, 1), g: 16, s: rnd(0.08, 0.13), col: z.look[i % 3], life: 12, bounce: 1, rx: rnd(0, 3) });
}
function updateSwells(dt) {
  for (const z of zombies) {
    if (!z.swell || z.boomed) continue;
    z.swell = Math.min(1, z.swell + dt / FAT_BOOM.delay);
    z.roll = Math.sin(G.t * 40) * 0.05 * z.swell;
    if (z.swell >= 1) { z.boomed = true; z.deadT = 99; explode(z.x, z.y, z.z, FAT_BOOM.dmg, FAT_BOOM.R, { hurts: !z.safeBoom, gore: true }); }
  }
}
// Взрыв: ранит зомби рядом (и игроков, если hurts), на той же высоте ±1.5
function explode(x, y, z, dmg, R, o = {}) {
  if (typeof ravenScare === 'function') ravenScare(x, z, 22); const pv = ATTR; if (o.owner) ATTR = o.owner; try { explodeBase(x, y, z, dmg, R, o); } finally { ATTR = pv; } }
function explodeBase(x, y, z, dmg, R, o = {}) {
  explHit(x, z, R);                                                                        // рядом бочки и баки — цепная реакция
  if (GAS.length) igniteGasAt(x, z, R);                                                    // взрыв поджигает бензин
  boomFx(x, y, z, R, o.gore); SFX.boom(R / 1.5, x, z);
  if (o.hurts) for (const p of players) if (p !== o.skip && !p.down && p.inv <= 0 && Math.abs(p.y - y) < 1.5 && Math.hypot(p.x - x, p.z - z) < R && !(o.owner && L(p, 'fireproof'))) hurtPlayer(p);   // костюм спасает и от снаряжения напарника
  GIBF.boom = true;
  forNear(x, z, e => {
    if (e.dead || Math.abs(e.y - y) > 1.5) return;
    const dx = e.x - x, dz = e.z - z, d = Math.hypot(dx, dz); if (d >= R) return;
    damageZombie(e, dmg, dx / (d || 1), dz / (d || 1), 0.35 * (o.knock || 1), undefined, true);
    if (o.stun) e.stunT = Math.max(e.stunT || 0, o.stun);
  }, R + 1);
  GIBF.boom = false;
}
function hurtPlayer(p, src) {
  if (src && p.shield) {                                                                 // «Тяжёлая стойка»: щит поглощает укус, укусивший отлетает
    p.shield = false; p.shieldCd = 8; p.shieldT = 0; p.inv = Math.max(p.inv, 0.5); SFX.shield(); rumble(p, 0.5, 120);
    const dx = src.x - p.x, dz = src.z - p.z, d = Math.hypot(dx, dz) || 1;
    src.kx += dx / d * 7; src.kz += dz / d * 7; src.stunT = Math.max(src.stunT || 0, 0.4);
    for (let k = 0; k < 8; k++) spawnP({ x: p.x + dx / d * 0.3, y: p.y + 0.8, z: p.z + dz / d * 0.3, vx: dx / d * rnd(1, 3) + rnd(-1, 1), vy: rnd(0.5, 2), vz: dz / d * rnd(1, 3) + rnd(-1, 1), s: 0.06, s1: 0.01, col: 0xc8ccd0, glow: true, life: 0.35, drag: 0.9 });
    return;
  }
  if (G.god) return;
  if (p.armor > 0) {                                                                       // бронежилет: синее сердце принимает удар первым
    p.armor--; p.inv = CFG.INVULN * (1 + 0.5 * L(p, 'skin')); SFX.shield(); shake = Math.max(shake, 0.15); rumble(p, 0.6, 120);
    for (let k = 0; k < 6; k++) spawnP({ x: p.x, y: p.y + 0.8, z: p.z, vx: rnd(-1.5, 1.5), vy: rnd(0.5, 2), vz: rnd(-1.5, 1.5), s: 0.06, s1: 0.01, col: 0x7aa8ff, life: 0.4 });
    return;
  }
  SFX.hurt(); p.hurtA = 0.3;
  p.hp--; if (p.rs) p.rs.taken++; p.inv = CFG.INVULN * (1 + 0.5 * L(p, 'skin')); G.hurtFx = 1; shake = Math.max(shake, 0.25); rumble(p, 0.9, 200);
  blood(p.x, p.y + 0.7, p.z, 0, 0, 6);
  if (src && p.cls === 'bouncer') { const dx = src.x - p.x, dz = src.z - p.z, d = Math.hypot(dx, dz) || 1; src.kx += dx / d * 7; src.kz += dz / d * 7; src.stunT = Math.max(src.stunT || 0, 0.4); }   // Вышибала: укусивший отлетает
  if (p.hp > 0) return;
  if (tryInject(p)) return;                                                                // «Автоинжектор»
  p.hp = 0; p.down = true; p.reloadT = 0; p.fall = 0; if (p.rs) p.rs.downs++; rumble(p, 1, 400);
  if (!alivePlayers().length) endRun(false);
}
/* ---- Кооп: упавший игрок отстреливается из пистолета лёжа, пока его поднимают ---- */
const PISTOL = { dmg: 8, rate: 2.2, speed: 18, life: 0.45, knock: 0.2 };
function updateDownPistol(p, dt) {
  const c = readControl(p), A = aimPoint(p, c);
  if (A.pt) p.yaw = Math.atan2(A.pt.x - p.x, A.pt.z - p.z);
  p.pcool = (p.pcool || 0) - dt;
  let fire = c.fire; if (fire === null || (c.auto && !c.manual)) fire = !!A.target;
  if (!fire || p.pcool > 0) return;
  p.pcool = 1 / PISTOL.rate;
  const mx = p.x + Math.sin(p.yaw) * 0.45, my = p.y + 0.35, mzz = p.z + Math.cos(p.yaw) * 0.45;
  let ang = p.yaw, e = 0;
  if (A.pt) { const dx = A.pt.x - mx, dz = A.pt.z - mzz, hd = Math.hypot(dx, dz); ang = Math.atan2(dx, dz); e = clamp(Math.atan2(A.pt.y - my, Math.max(0.5, hd)), -0.6, 0.6); }
  ang += rnd(-0.05, 0.05);
  bullets.push({ owner: p, x0: p.x, z0: p.z, x: mx, y: my, z: mzz, vx: Math.sin(ang) * Math.cos(e) * PISTOL.speed, vy: Math.sin(e) * PISTOL.speed, vz: Math.cos(ang) * Math.cos(e) * PISTOL.speed,
    life: PISTOL.life, dmg: PISTOL.dmg * p.st.dmg, pierce: 0, knock: PISTOL.knock, hits: [] });
  SFX.shot('pistol');
  for (let i = 0; i < 3; i++) spawnP({ x: mx, y: my, z: mzz, vx: Math.sin(ang) * rnd(1, 3), vy: rnd(0, 0.5), vz: Math.cos(ang) * rnd(1, 3), s: 0.06, s1: 0.01, col: 0xfff0a0, col1: 0xff7020, glow: true, life: 0.07, drag: 0.8 });
  spawnCasing(p, 'brass', 1);
}
/* ---- Батч 2: перки автомата, пулемёта, револьвера, которым нужен свой код ---- */
// «Выстрел в колено»: ходок и бегун падают и ползут (бегун теряет скорость), толстяк и бронированный падают на 1 с
function kneeShot(z) {
  if (z.form === 'crawl') return;
  if (z.type === 'walker' || z.type === 'runner') {
    z.form = 'crawl'; z.scale = 1; z.stunT = Math.max(z.stunT || 0, 0.4);
    if (z.type === 'runner') z.speed = ZOMBIES.walker.speed * rnd(0.92, 1.08);
  } else z.stunT = Math.max(z.stunT || 0, 1);
  dust(z.x, z.y + 0.1, z.z, 0x8a6a44, 4);
}
// Рикошет: пуля от зомби z летит в ближайшего в 4 клетках, которого ещё не задела
function ricochet(b, z) {
  let best = null, bd = 16;
  forNear(z.x, z.z, n => { if (n.dead || n === z || n.swell || b.hits.includes(n.id) || Math.abs(n.y - z.y) > 1.5) return; const d = (n.x - z.x) ** 2 + (n.z - z.z) ** 2; if (d < bd) { bd = d; best = n; } }, 4);
  if (!best) return false;
  const sp = Math.hypot(b.vx, b.vy, b.vz), tx = best.x - b.x, ty = zAimY(best) - b.y, tz = best.z - b.z, l = Math.hypot(tx, ty, tz) || 1;
  b.vx = tx / l * sp; b.vy = ty / l * sp; b.vz = tz / l * sp; b.life = Math.max(b.life, l / sp + 0.15); b.bounceN++; b.big = true;
  sparks(b.x, b.y, b.z); SFX.rico();
  return true;
}
// «Два кольта»: вторая цель для левого ствола (с автоприцелом)
function secondTarget(p, first) {
  let best = null, bd = 100;
  forNear(p.x, p.z, z => { if (z.dead || z.swell || z === first) return; const d = (z.x - p.x) ** 2 + (z.z - p.z) ** 2; if (d < bd) { bd = d; best = z; } }, 10);
  return best;
}
// Подствольник (автомат): граната летит дугой в точку прицела (2–8 клеток), рвётся о зомби, стену или землю
const UBGL = [];
// Заряды подствольника копятся по времени: 1 заряд на «Подствольнике», 2 и 3 — на «Быстрой подаче»; каждый заряд готовится 30 с, минус 5 с за уровень «Быстрой подачи»
const ubglMax = p => 1 + L(p, 'ri_feed'), ubglCd = p => 30 - 5 * L(p, 'ri_feed');
function updateUbgl(p, A, dt) {
  const c = p.lastC;
  if (L(p, 'ri_ubgl')) {
    if (p.ubglC == null) p.ubglC = 1;                                 // первый заряд готов сразу
    if (p.ubglC < ubglMax(p)) { if ((p.ubglRc = (p.ubglRc || 0) + dt) >= ubglCd(p)) { p.ubglRc = 0; p.ubglC++; SFX.click(); toast(p, 'Подствольник заряжен', '#9fe88a'); } } else p.ubglRc = 0;
  }
  if (c && c.alt && L(p, 'ri_ubgl') && p.gun === 'rifle' && !p.hand && !(p.ubglQ > 0)) {     // ПКМ / LT / кнопка — выстрел из подствольника
    if (p.ubglC > 0) { p.ubglC--; p.ubglQ = p.evo.ri_gl ? 2 : 1; p.ubglT = 0; p.ubglAt = A.pt; } else toast(p, `Подствольник: заряд через ${Math.ceil(ubglCd(p) - (p.ubglRc || 0))} с`, '#aaa');
  }
  if (!(p.ubglQ > 0) || (p.ubglT -= dt) > 0) return;
  p.ubglQ--; p.ubglT = 0.18;
  const mz = muzzleOf(p), ap = A.pt || p.ubglAt, fr = L(p, 'ri_frag');
  let tx = mz.x + Math.sin(p.yaw) * 6, tz = mz.z + Math.cos(p.yaw) * 6, ty = p.y;
  if (ap) { tx = ap.x; tz = ap.z; ty = ap.y - 0.6; }
  let dx = tx - mz.x, dz = tz - mz.z, D = Math.hypot(dx, dz) || 1;
  const Dc = clamp(D, 2, 8); dx = dx / D * Dc; dz = dz / D * Dc; if (p.ubglQ > 0) { dx *= 0.85; dz *= 0.85; }   // вторая граната чуть ближе
  const T = Math.hypot(dx, dz) / 11, g = 14;
  UBGL.push({ owner: p, x: mz.x, y: mz.y, z: mz.z, vx: dx / T, vz: dz / T, vy: (ty - mz.y) / T + 0.5 * g * T, g, t: T + 0.6,
    dmg: 25 * (1 + 0.25 * fr) * p.st.dmg, R: 1.2 * (1 + 0.2 * fr), stun: p.evo.ri_gl ? 0.5 : 0 });
  SFX.thump(); rumble(p, 0.5, 90);
  for (let i = 0; i < 5; i++) spawnP({ x: mz.x, y: mz.y, z: mz.z, vx: dx / T * 0.15 + rnd(-0.4, 0.4), vy: rnd(0.2, 0.8), vz: dz / T * 0.15 + rnd(-0.4, 0.4), s: 0.12, s1: 0.45, col: 0xc8c4bc, col1: 0x8a8680, life: 0.7, drag: 0.92 });
}
function updateUbglFlight(dt) {
  for (let i = UBGL.length - 1; i >= 0; i--) {
    const g = UBGL[i]; g.t -= dt; g.vy -= g.g * dt;
    g.x += g.vx * dt; g.y += g.vy * dt; g.z += g.vz * dt;
    let hit = g.t <= 0 || g.x < 0 || g.z < 0 || g.x > MAP || g.z > MAP || g.y <= floorAt(g.x, g.z, g.y + 0.2) + 0.02 || !!pointSolid(g.x, g.y, g.z);
    if (!hit) forNear(g.x, g.z, z => { if (!z.dead && (z.x - g.x) ** 2 + (z.z - g.z) ** 2 < (z.r + 0.1) ** 2 && g.y > z.y && g.y < z.y + zHeight(z)) { hit = true; return false; } });
    if (hit) { UBGL.splice(i, 1); explode(g.x, Math.max(g.y, floorAt(g.x, g.z, g.y + 0.2)), g.z, g.dmg, g.R, { hurts: true, owner: g.owner, skip: g.owner, stun: g.stun }); scorch(g.x, g.z, g.R * 0.45); continue; }
    spawnP({ x: g.x, y: g.y, z: g.z, s: 0.16, col: 0x5a6238, life: 0.04 });                                   // сама граната — крупнее
    spawnP({ x: g.x, y: g.y, z: g.z, s: 0.09, col: 0xffb040, glow: true, life: 0.06 });                       // огонёк сзади
    spawnP({ x: g.x, y: g.y, z: g.z, vy: 0.3, s: 0.1, s1: 0.32, col: 0xd0ccc4, col1: 0x8a8680, life: 0.6, drag: 0.95 });   // дымный след
  }
}

/* ---------- 12б. Арбалет: наконечники, болты на земле и в трупах, подбор; «Ураган» узи ---------- */
// Наконечник болта: зажигательный или разрывной (тип выбирается один раз за забег)
function boltTip(p) {
  const f = L(p, 'cb_fire'), bm = L(p, 'cb_boom'), dps = 6 * p.st.dmg;
  const burn = f ? { t: 3, dps, spread: f >= 3, slow: false } : null;                       // 3-й ур.: подожжённые зомби поджигают соседей
  return {
    burn,
    pool: f ? { rad: f >= 2 ? 1.25 : 0.8, t: f >= 2 ? 6 : 3.5, burn } : null,              // лужа смолы: 2-й ур. — больше и дольше
    trail: L(p, 'cb_trail') > 0,
    boom: bm ? { R: bm >= 2 ? 1.9 : 1.3, mul: bm >= 2 ? 0.9 : 0.7, cluster: L(p, 'cb_charge') > 0, sticky: L(p, 'cb_sticky') > 0 } : null,
  };
}
const BOLTS = [], BOOMQ = [], BOLT_MAX = 80;
const boltShaft = new THREE.BoxGeometry(0.035, 0.035, 0.46), boltFletch = new THREE.BoxGeometry(0.1, 0.012, 0.1);
const boltMatS = new THREE.MeshLambertMaterial({ color: 0x8a6a44 }), boltMatF = new THREE.MeshLambertMaterial({ color: 0xc8b89a });
function addStuck(x, y, z, yaw, pitch) {
  if (BOLTS.length >= BOLT_MAX) removeBolt(0);
  const g = new THREE.Group(), s = new THREE.Mesh(boltShaft, boltMatS), f = new THREE.Mesh(boltFletch, boltMatF);
  s.position.z = -0.12; f.position.z = -0.32; g.add(s); g.add(f);
  g.position.set(x, y, z); g.rotation.set(-pitch, yaw, 0, 'YXZ'); scene.add(g);
  BOLTS.push({ x, y, z, g, fly: false });
}
function removeBolt(i) { scene.remove(BOLTS[i].g); BOLTS.splice(i, 1); }
function clearBolts() { while (BOLTS.length) removeBolt(0); BOOMQ.length = 0; }
// Взрыв болта своих не ранит; зомби разлетаются; «Кассета» — 4 осколка с маленькими взрывами
function boltBoom(x, y, z, dmg, R, owner, cluster) {
  explode(x, y, z, dmg, R, { hurts: false, owner, knock: 1.6 }); scorch(x, z, R * 0.4); shake = Math.max(shake, 0.12);
  if (cluster) for (let k = 0; k < 4; k++) {
    const a = k * TAU / 4 + rnd(-0.4, 0.4), r = R * rnd(0.9, 1.4), cx = x + Math.cos(a) * r, cz = z + Math.sin(a) * r;
    for (let s = 1; s <= 4; s++) spawnP({ x: x + (cx - x) * s / 4, y: y + 0.3 + Math.sin(s / 4 * Math.PI) * 0.5, z: z + (cz - z) * s / 4, s: 0.05, col: 0xffb040, glow: true, life: 0.15 });
    later(0.15 + k * 0.05, () => explode(cx, floorAt(cx, cz, y + 0.5), cz, dmg * 0.35, 0.65, { hurts: false, owner, knock: 1.2 }));
  }
}
function densestNear(z0, R) { let best = null, bn = 0; forNear(z0.x, z0.z, a => { if (a === z0 || a.dead) return; let n = 0; forNear(a.x, a.z, b => { if (!b.dead && (a.x - b.x) ** 2 + (a.z - b.z) ** 2 < 2.25) n++; }, 2); if (n > bn) { bn = n; best = a; } }, R); return best; }
// Болт закончил полёт: взрыв, застрял в зомби, воткнулся в землю/стену или упал
function boltEnd(b) {
  if (b.lost) return;
  const Z = b.inZ, x = Z ? Z.x : b.x, zz = Z ? Z.z : b.z, y = Z ? Z.y + 0.6 : b.y;
  if (b.boom) {
    const dmg = b.dmg * b.boom.mul;
    if (b.boom.sticky && Z && !Z.dead) BOOMQ.push({ Z, x, y, z: zz, t: 1, dmg: dmg * 1.5, R: b.boom.R * 1.25, owner: b.owner, cluster: b.boom.cluster });   // «Липкий болт»: рвётся через секунду, сильнее
     else boltBoom(x, y, zz, dmg, b.boom.R, b.owner, b.boom.cluster);
    return;
  }
  const fy = floorAt(x, zz, y + 0.2);
  if (b.pool && fireStrips.length < 60) {                                                    // «Зажигательный наконечник»: лужа смолы
    const P = b.pool; fireStrips.push({ owner: b.owner, x0: x, z0: zz, x1: x + 0.01, z1: zz, y: fy, t: P.t, burn: P.burn, acc: 0, noFF: true, rad: P.rad }); scorch(x, zz, P.rad * 0.7);
  }
  if (b.trail && fireStrips.length < 60) {                                                   // «Огненный след»: горящая линия вдоль полёта
    const x0 = b.x0, z0 = b.z0, ty = floorAt(x, zz, (b.owner ? b.owner.y : 0) + 0.3);
    fireStrips.push({ owner: b.owner, x0, z0, x1: x, z1: zz, y: ty, t: 2.5, burn: b.burn, acc: 0, noFF: true });
    for (let k = 0; k <= 6; k++) scorch(x0 + (x - x0) * k / 6, z0 + (zz - z0) * k / 6, 0.18);
  }
  if (b.nopick) return;
  if (Z && !Z.dead) { Z.bolts = (Z.bolts || 0) + 1; return; }                        // торчит в живом — выпадет с трупом
  const yaw = Math.atan2(b.vx, b.vz), pitch = Math.atan2(b.vy, Math.hypot(b.vx, b.vz));
  if (Z) addStuck(x + rnd(-0.2, 0.2), fy + 0.12, zz + rnd(-0.2, 0.2), yaw, -0.5);     // в трупе
  else if (b.wallHit) addStuck(b.x, b.y, b.z, yaw, pitch);                             // в стене
  else addStuck(b.x, Math.max(fy, b.y <= 0.06 ? 0 : fy) + 0.1, b.z, yaw, b.y <= 0.06 ? Math.min(pitch, -0.45) : -0.9);   // в земле или упал
}
function dropBolts(z) {
  const fy = floorAt(z.x, z.z, z.y + 0.2);
  for (let i = 0; i < z.bolts; i++) addStuck(z.x + rnd(-0.25, 0.25), fy + 0.12, z.z + rnd(-0.25, 0.25), Math.random() * TAU, -0.5);
  z.bolts = 0;
}
// Болты бесконечные: воткнувшиеся в землю — просто декор; здесь тикают отложенные взрывы «Липкого болта»
function updateBolts(dt) {
  for (let i = BOOMQ.length - 1; i >= 0; i--) {
    const q = BOOMQ[i]; if (q.Z && !q.Z.dead) { q.x = q.Z.x; q.z = q.Z.z; q.y = q.Z.y + 0.6; }
    if (Math.random() < dt * 20) spawnP({ x: q.x, y: q.y + 0.2, z: q.z, s: 0.06, col: 0xff4020, glow: true, life: 0.08 });
    if ((q.t -= dt) <= 0) { BOOMQ.splice(i, 1); boltBoom(q.x, q.y, q.z, q.dmg, q.R, q.owner, q.cluster); }
  }
}
// «Ураган»: на бегу узи бьют в обе стороны от направления бега
function sideVec(p, side) { const fx = p.mvx || 0, fz = p.mvz || 1; return [fz * side, -fx * side]; }
function sideTarget(p, side) {
  const [sx, sz] = sideVec(p, side); let best = null, bd = 49;
  forNear(p.x, p.z, z => { if (z.dead || z.swell) return; const dx = z.x - p.x, dz = z.z - p.z, d = dx * dx + dz * dz; if (d < bd && dx * sx + dz * sz > 0.3 * Math.sqrt(d)) { bd = d; best = z; } }, 7);
  return best;
}
function sidePoint(p, side) { const [sx, sz] = sideVec(p, side); return new THREE.Vector3(p.x + sx * 4, p.y + 0.6, p.z + sz * 4); }

/* ---------- 13. Кристаллы опыта: вылетают из зомби, притягиваются к игроку ---------- */
const MAX_GEMS = 600;
const gemMesh = new THREE.InstancedMesh(boxGeo, new THREE.MeshBasicMaterial({ toneMapped: false }), MAX_GEMS);
gemMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); gemMesh.frustumCulled = false;
gemMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_GEMS * 3), 3); scene.add(gemMesh);
const GEM_COL = [0x59c0ff, 0x7cf08a, 0xffd23a, 0xff7a4a];
function updateGems(dt, T) {
  if (gems.length > MAX_GEMS - 20) {                   // слишком много — сливаем старые в соседние
    const a = gems.shift(); const b = gems[0]; b.v += a.v;
  }
  let n = 0;
  for (let i = gems.length - 1; i >= 0; i--) {
    const g = gems[i]; g.t += dt;
    const fl = floorAt(g.x, g.z, g.y + 0.3, 0);
    if (g.vy !== 0 || g.y > fl + 0.001) { g.vy -= 18 * dt; g.y += g.vy * dt; if (g.y <= fl) { g.y = fl; g.vy = 0; } }
    const p = nearestAlive(g.x, g.z);
    if (p && G.state === 'play') {
      const dx = p.x - g.x, dz = p.z - g.z, dy = p.y + 0.4 - g.y, d = Math.hypot(dx, dz);
      if (d < CFG.PICKUP_R * p.st.pickup && Math.abs(dy) < 1.6) g.pull = true;   // «Магнитный пояс» +50% / +100%
      if (g.pull && d > 0.001) { const s = Math.min(d, 9 * dt); g.x += dx / d * s; g.z += dz / d * s; g.y += dy * Math.min(1, 9 * dt); g.vy = 0; }
      if (d < 0.35 && Math.abs(dy) < 1) { gems.splice(i, 1); addXp(g.v); SFX.pickup(); continue; }
    }
    if (n >= MAX_GEMS) continue;
    const s = 0.14 + Math.min(0.12, (g.v - 1) * 0.03), bob = g.pull ? 0 : 0.12 + Math.sin(g.t * 3) * 0.05;
    _q.setFromEuler(_e.set(0.62, g.t * 2, 0.62));
    _m.compose(_v.set(g.x, g.y + bob + s / 2, g.z), _q, _s.set(s, s, s)); gemMesh.setMatrixAt(n, _m);
    _c.setHex(GEM_COL[g.v <= 1 ? 0 : g.v <= 3 ? 1 : g.v <= 8 ? 2 : 3]); gemMesh.setColorAt(n, _c); n++;
  }
  gemMesh.count = n; gemMesh.instanceMatrix.needsUpdate = true; if (gemMesh.instanceColor) gemMesh.instanceColor.needsUpdate = true;
}
function addXp(v) {
  G.xp += v;
  while (G.xp >= xpNeed(G.level)) { G.xp -= xpNeed(G.level); G.level++; for (const p of players) G.pickQueue.push(p.idx); }   // каждый игрок выбирает свою карточку
}
