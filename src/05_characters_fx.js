'use strict';
/* ---------- 6. Персонажи: воксельные части, все сразу одним InstancedMesh ---------- */
const MAX_CH = Math.max(420, (IS_TOUCH ? CFG.MAX_ENEMIES_MOBILE : CFG.MAX_ENEMIES_PC) + 120), PARTS = 11;   // живые + трупы + игроки
const charMesh = new THREE.InstancedMesh(boxGeo, new THREE.MeshLambertMaterial(), MAX_CH * PARTS);
charMesh.castShadow = true; charMesh.receiveShadow = true; charMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
charMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_CH * PARTS * 3), 3); charMesh.frustumCulled = false;
scene.add(charMesh);
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
const _root = new THREE.Matrix4(), _loc = new THREE.Matrix4(), WHITE = new THREE.Color(0xffffff);
let chN = 0;
// одна часть тела: pivot (px,py,pz) в координатах персонажа, поворот rx, размер и смещение (ox,oy,oz) от pivot
function part(col, px, py, pz, rx, sx, sy, sz, oy, oz = 0, flash = 0, ox = 0) {
  if (chN >= MAX_CH * PARTS) return;
  _loc.makeRotationX(rx); _loc.setPosition(px, py, pz);
  _m.makeTranslation(ox, oy, oz); _loc.multiply(_m);
  _m.makeScale(sx, sy, sz); _loc.multiply(_m);
  _m.multiplyMatrices(_root, _loc); charMesh.setMatrixAt(chN, _m);
  _c.setHex(col); if (flash) _c.lerp(WHITE, flash);
  charMesh.setColorAt(chN, _c); chN++;
}
// Внешности: кожа, верх, низ, волосы/шапка (5-й элемент — фуражка)
const LOOKS = {
  civ: [[0x9aa48a, 0x3c4e6e, 0x2a2e3a, 0x2a2220], [0xa0a88c, 0xd8d2c4, 0x2c3a2e, 0x3a2a1e], [0x8e9a80, 0x6e7a3a, 0x3a4a6a, 0x1e1a18], [0xa4ac90, 0xc8a030, 0x303440, 0x4a3422],
        [0x98a286, 0x7a3a34, 0x3a3630, null], [0x9ca68c, 0x5a5e62, 0x2e3440, 0x6a5a48]],
  pris: [[0x9aa48a, 0xd8702a, 0xc0621f, 0x2a2220], [0x8e9a80, 0xe07a30, 0xc8681f, null], [0xa0a88c, 0xcf6a26, 0xb85c1c, 0x4a3422]],
  guard: [[0x9aa48a, 0x2e3648, 0x22283a, 0x1a1e2a, 1]],
};
// Стволы в руках: части [цвет, x, y, z-центр, ширина, высота, длина] вдоль ствола; muz — где дульный срез
const GUN_VIS = {
  shotgun:  { muz: 0.78, parts: [[0x2a2826, 0, 0.02, 0.42, 0.07, 0.07, 0.62], [0x6a4428, 0, -0.02, 0.02, 0.08, 0.11, 0.32], [0x5a3a22, 0, -0.05, 0.36, 0.08, 0.06, 0.16]] },
  sawnoff:  { muz: 0.5,  parts: [[0x2e2c2a, -0.035, 0.02, 0.28, 0.06, 0.06, 0.4], [0x2e2c2a, 0.035, 0.02, 0.28, 0.06, 0.06, 0.4], [0x6a4428, 0, -0.04, 0.02, 0.09, 0.12, 0.22]] },
  rifle:    { muz: 0.74, parts: [[0x262422, 0, 0, 0.3, 0.08, 0.11, 0.62], [0x1e1c1a, 0, -0.12, 0.3, 0.06, 0.16, 0.08], [0x3a3228, 0, -0.03, -0.06, 0.07, 0.12, 0.2], [0x1a1a1a, 0, 0.02, 0.66, 0.04, 0.04, 0.14]] },
  mg:       { muz: 0.92, parts: [[0x2c2e2a, 0, 0, 0.3, 0.12, 0.14, 0.62], [0x1c1c1c, 0, 0.01, 0.78, 0.05, 0.05, 0.32], [0x4a5236, 0.1, -0.06, 0.24, 0.14, 0.14, 0.16], [0x3a3a30, 0, -0.03, -0.08, 0.08, 0.12, 0.2]] },
  revolver: { muz: 0.42, parts: [[0x3a3836, 0, 0.02, 0.26, 0.05, 0.06, 0.26], [0x4a4644, 0, 0.0, 0.14, 0.08, 0.09, 0.1], [0x5a3a22, 0, -0.07, 0.06, 0.06, 0.12, 0.07]] },
  crossbow: { muz: 0.6,  parts: [[0x6a4428, 0, -0.02, 0.18, 0.07, 0.08, 0.5], [0x3a3836, 0, 0.03, 0.34, 0.04, 0.03, 0.42], [0x2a2826, 0, 0.03, 0.52, 0.56, 0.05, 0.05], [0xd8d0b8, 0, 0.045, 0.44, 0.5, 0.012, 0.012], [0x8a6a44, 0, 0.06, 0.36, 0.025, 0.025, 0.36]] },
  smg:      { muz: 0.46, parts: [[0x262422, 0, 0, 0.18, 0.07, 0.1, 0.34], [0x1e1c1a, 0, -0.12, 0.16, 0.05, 0.15, 0.06], [0x1a1a1a, 0, 0.01, 0.38, 0.035, 0.035, 0.1], [0x3a3228, 0, -0.04, -0.02, 0.05, 0.08, 0.14]] },
  uzi:      { muz: 0.3,  parts: [[0x2c2c2c, 0, 0, 0.12, 0.06, 0.08, 0.22], [0x1e1c1a, 0, -0.1, 0.07, 0.045, 0.14, 0.05], [0x1a1a1a, 0, 0.01, 0.26, 0.03, 0.03, 0.06]] },
};
const gunVis = c => c.hand ? ITEM_VIS[c.hand] : c.gun === 'smg' && c.lv && c.lv.smg_uzi ? GUN_VIS.uzi : GUN_VIS[c.gun] || GUN_VIS.rifle;   // предмет в руке — вместо ствола   // ПП с «Вторым узи» — узи
let HAND_Y = 0.76, HAND_X = 0.08, HAND_Z = 0.1, REV_X = 0.2; // точка хвата оружия в координатах героя (у воксельного героя — от плеча модели)
function drawChar(c, t) {
  const sw0 = c.moving ? Math.sin(c.phase) : 0;
  let lean = c.fall || 0;
  if (!c.dead && c.zombie) {
    if (c.form === 'run') lean += 0.28;
    if (c.hurtT > 0) lean -= 0.35 * c.hurtT / 0.16;        // отшатнулся от попадания
    if (c.atkT > 0) lean += 0.25 * Math.sin((1 - c.atkT / 0.45) * Math.PI);
  }
  const sc = c.scale || 1, ss = c.swell ? 1 + c.swell * 0.55 : 1;
  _q.setFromEuler(_e.set(lean, c.yaw, c.roll || 0, 'YXZ'));
  _root.compose(_v.set(c.x, c.y - (c.sink || 0), c.z), _q, _s.set(ss * (c.form === 'fat' ? 1.08 : 1), ss, ss));
  const [skin, top, bot, hair, cap] = c.look, f = c.flash > 0 ? 0.75 : c.swell ? c.swell * 0.6 : 0;
  if (c.form === 'hound') { drawHound(c, f); return; }
  if (c.form === 'crawl') {                                  // ползун: лежит, тянется руками, ноги волочатся
    const a = Math.sin(c.phase * 0.8) * 0.5;
    part(top, 0, 0.17, 0, 0, 0.42 * sc, 0.24, 0.52, 0, 0, f);
    part(bot, -0.1, 0.12, -0.24, Math.PI / 2 - 0.08 + a * 0.2, 0.15, 0.4, 0.16, -0.2, 0, f);
    part(bot, 0.1, 0.12, -0.24, Math.PI / 2 - 0.08 - a * 0.2, 0.15, 0.4, 0.16, -0.2, 0, f);
    part(skin, 0, 0.26 + (c.nod || 0) * 0.1, 0.36, -0.2, 0.3, 0.3, 0.3, 0, 0, f);
    if (hair !== null && hair !== undefined) part(hair, 0, 0.26, 0.36, -0.2, 0.32, 0.1, 0.32, 0.13, -0.02, f);
    part(skin, -0.24, 0.2, 0.2, -Math.PI / 2 + 0.25 + a, 0.12, 0.44, 0.13, -0.2, 0, f);
    part(skin, 0.24, 0.2, 0.2, -Math.PI / 2 + 0.25 - a, 0.12, 0.44, 0.13, -0.2, 0, f);
    return;
  }
  const fat = c.form === 'fat', run = c.form === 'run';
  const sw = sw0 * (run ? 1.0 : 0.7), H = 0.42 * sc, lx = fat ? 0.15 : 0.1, lw = fat ? 0.2 : 0.15;
  part(bot, -lx, H, 0, sw, lw, H, 0.18, -H / 2, 0, f);                                                    // ноги
  part(bot, lx, H, 0, -sw, lw, H, 0.18, -H / 2, 0, f);
  const bw = fat ? 0.62 : 0.42, bd = fat ? 0.44 : 0.26, bh = (fat ? 0.5 : 0.44) * sc;
  part(top, 0, H, 0, 0, bw, bh, bd, bh / 2, 0, f);                                                       // тело
  if (fat) part(skin, 0, H + 0.08, 0.2, 0, 0.44, 0.26, 0.12, 0.1, 0, f);                                  // пузо
  if (c.form === 'armored') part(0x3e4634, 0, H + 0.04, 0, 0, bw + 0.06, bh * 0.7, bd + 0.06, bh * 0.4, 0, f);   // бронежилет
  const hy = H + bh, nod = c.nod || 0;
  part(skin, 0, hy, 0, nod, 0.3, 0.3, 0.3, 0.15, 0, f);                                                   // голова
  if (c.form === 'armored') { part(0x3c4236, 0, hy, 0, nod, 0.36, 0.13, 0.38, 0.32, 0, f); }               // каска
  else if (hair !== null && hair !== undefined) part(hair, 0, hy, 0, nod, 0.32, cap ? 0.08 : 0.1, cap ? 0.36 : 0.32, cap ? 0.3 : 0.27, cap ? 0.04 : -0.01, f);
  const ay = hy - 0.05, ax = bw / 2 + 0.06;
  if (c.zombie) {
    let r1, r2;
    if (run) { r1 = -0.5 + sw0 * 0.9; r2 = -0.5 - sw0 * 0.9; }                              // бегун машет руками
    else { r1 = -1.35 + Math.sin(c.phase * 0.5) * 0.12; r2 = r1 + 0.1; }                     // руки вперёд
    if (c.atkT > 0) { const k = Math.sin((1 - c.atkT / 0.45) * Math.PI); r1 -= k * 0.6; r2 -= k * 0.5; }   // замах
    part(skin, -ax, ay, 0, r1, 0.12, 0.42, 0.13, -0.2, 0, f); part(skin, ax, ay, 0, r2, 0.12, 0.42, 0.13, -0.2, 0, f);
    return;
  }
  // герой: руки держат оружие, ствол наклоняется к цели и отскакивает при отдаче
  const gp = c.pitch || 0, kick = c.kick || 0, V = GUN_VIS[c.gun] || GUN_VIS.rifle;
  const rel = c.reloadK || 0, rdip = Math.sin(rel * Math.PI) * 0.6;                          // перезарядка: ствол опущен
  const rk = -1.4 - kick * 0.3 + rdip;
  if (c.lv && oneHand(c)) { part(top, -0.24, ay, 0, twinGuns(c) ? rk + 0.05 : -0.2 + sw * 0.4, 0.12, 0.38, 0.13, -0.19, 0, f); part(top, 0.24, ay, 0, rk + 0.05, 0.12, 0.42, 0.13, -0.21, 0, f); }
  else { part(top, -0.24, ay, 0, rk + 0.15, 0.12, 0.38, 0.13, -0.18, 0, f); part(top, 0.24, ay, 0, rk, 0.12, 0.4, 0.13, -0.19, 0, f); }
  drawHeroGun(c);
}
// ствол в руках героя (корень _root уже выставлен)
function drawHeroGun(c) {
  const gp = c.pitch || 0, kick = c.kick || 0, V = gunVis(c), rdip = c.an && c.an.pose ? c.an.pose.dip : Math.sin((c.reloadK || 0) * Math.PI) * 0.6;
  const back = kick * 0.1, gx = c.lv && oneHand(c) ? REV_X : HAND_X, twin = !!c.lv && twinGuns(c);
  for (const [col, x, y, z, w, h, l] of V.parts) part(col, gx, HAND_Y, HAND_Z, -gp + rdip, w * 1.1, h * 1.1, l * 1.1, y, z - back, 0, x);
  if (twin) for (const [col, x, y, z, w, h, l] of V.parts) part(col, -gx, HAND_Y, HAND_Z, -gp + rdip, w * 1.1, h * 1.1, l * 1.1, y, z - back, 0, x);   // «Два кольта»: второй в левой
  if (c.att && !c.hand) for (const [col, x, y, z, w, h, l] of attParts(c, V)) part(col, gx, HAND_Y, HAND_Z, -gp + rdip, w, h, l, y, z - back, 0, x);   // обвесы
}
// Обвесы на стволе: от дульного среза (muz) назад
function attParts(c, V) {
  const m = V.muz, out = [];
  if (c.att.barrel) out.push([0x1a1a1a, 0, 0.015, m + 0.07, 0.045, 0.045, 0.16], [0x2a2a2a, 0, 0.015, m + 0.15, 0.06, 0.06, 0.04]);
  if (c.att.laser) out.push([0x2a2c30, 0.05, -0.02, m - 0.14, 0.035, 0.04, 0.12], [0xff2010, 0.05, -0.02, m - 0.075, 0.02, 0.02, 0.01]);
  if (c.att.light) out.push([0x34363a, 0, -0.07, m - 0.12, 0.06, 0.06, 0.14], [0xfff4c8, 0, -0.07, m - 0.045, 0.05, 0.05, 0.01]);
  return out;
}
function drawHeroGunOnly(c) {                         // для воксельного героя: только ствол, корень — позиция героя
  const P = c.an && c.an.pose;
  if (P) { _q.setFromEuler(_e.set(P.lean, c.yaw, P.roll, 'YXZ')); _root.compose(_v.set(c.x, c.y + P.dy * VZ.H, c.z), _q, _s.set(1, 1, 1)); }
  else { _q.setFromEuler(_e.set((c.fall || 0) + (c.sprinting ? 0.1 : 0), c.yaw, 0, 'YXZ')); _root.compose(_v.set(c.x, c.y, c.z), _q, _s.set(1, 1, 1)); }
  if (!c.down && !(P && P.hideGun)) drawHeroGun(c);
}
function drawDownPistol(c) {                          // пистолет в руке упавшего игрока (кооп)
  _q.setFromEuler(_e.set(0, c.yaw, 0, 'YXZ'));
  _root.compose(_v.set(c.x, c.y, c.z), _q, _s.set(1, 1, 1));
  part(0x2e2c2a, 0.12, 0.35, 0.25, 0, 0.06, 0.08, 0.22, 0, 0.08); part(0x4a3a2a, 0.12, 0.3, 0.2, 0.4, 0.06, 0.12, 0.06, 0, 0);
}

/* ---------- 7. Частицы-воксели: огонь, дым, кровь, гильзы, искры ---------- */
const MAX_P = 2400;
const pLit = new THREE.InstancedMesh(boxGeo, new THREE.MeshLambertMaterial(), MAX_P);
const pGlow = new THREE.InstancedMesh(boxGeo, new THREE.MeshBasicMaterial({ toneMapped: false }), MAX_P);
for (const m of [pLit, pGlow]) { m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_P * 3), 3); m.frustumCulled = false; scene.add(m); }
const pSoft = new THREE.InstancedMesh(boxGeo, new THREE.MeshLambertMaterial({ transparent: true, opacity: 0.3, depthWrite: false }), MAX_P);   // полупрозрачный дым выстрелов
pSoft.instanceMatrix.setUsage(THREE.DynamicDrawUsage); pSoft.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_P * 3), 3); pSoft.frustumCulled = false; pSoft.castShadow = false; pSoft.renderOrder = 2; scene.add(pSoft);
pLit.castShadow = false;                              // тени от дыма и крошек дорогие, почти не видны
const parts = [], _c2 = new THREE.Color();
let pOvf = 0;
// Дым = растущая негорящая частица серого цвета: весь дым в игре рисуется полупрозрачным (30%)
function isSmoke(o) { if (o.soft !== undefined) return o.soft; if (o.glow || o.s1 == null || o.s1 < o.s * 1.7 || o.col === undefined) return false; const r = (o.col >> 16) & 255, g = (o.col >> 8) & 255, b = o.col & 255; return Math.max(r, g, b) - Math.min(r, g, b) < 40; }
function spawnP(o) { if (QS.fx < 1 && Math.random() > QS.fx) return; o.soft = isSmoke(o); if (parts.length >= MAX_P * 1.6) { parts[pOvf++ % parts.length] = parts[parts.length - 1]; parts.pop(); } parts.push(Object.assign({ vx: 0, vy: 0, vz: 0, g: 0, drag: 1, life: 1, s: 0.08, s1: null, rest: false, glow: false, t: 0 }, o)); }
function updateParts(dt) {
  let nl = 0, ng = 0, ns = 0;
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.t += dt;
    if (p.t >= p.life) { if (p.stay && !p.baked) { bakeP(p); } parts[i] = parts[parts.length - 1]; parts.pop(); continue; }
    if (!p.rest) {
      p.vy -= p.g * dt; const dr = Math.pow(p.drag, dt * 60); p.vx *= dr; p.vz *= dr; if (p.g === 0) p.vy *= dr;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.g > 0) { const fl = floorAt(p.x, p.z, p.y + 0.3, 0); if (p.y <= fl + p.s / 2) { p.y = fl + p.s / 2;
        if (p.snd && Math.abs(p.vy) > 1) SFX.casing(p.snd);
        if (Math.abs(p.vy) > 1.2 && p.bounce) { p.vy = -p.vy * 0.35; p.vx *= 0.5; p.vz *= 0.5; } else { p.rest = true; if (p.stay && fl < 0.05) { bakeP(p); p.baked = true; p.life = 0; } } } }
    }
    const k = p.t / p.life, s = p.s1 !== null ? p.s + (p.s1 - p.s) * k : p.s;
    const mesh = p.glow ? pGlow : p.soft ? pSoft : pLit, n = p.glow ? ng++ : p.soft ? ns++ : nl++;
    if (n >= MAX_P) continue;
    _q.setFromEuler(_e.set(p.rx || 0, p.ry || 0, 0));
    _m.compose(_v.set(p.x, p.y, p.z), _q, _s.set(s * (p.sx || 1), s * (p.sy || 1), s * (p.sz || 1)));
    mesh.setMatrixAt(n, _m);
    _c.setHex(p.col); if (p.col1 !== undefined) _c.lerp(_c2.setHex(p.col1), k); mesh.setColorAt(n, _c);
  }
  pLit.count = Math.min(nl, MAX_P); pGlow.count = Math.min(ng, MAX_P); pSoft.count = Math.min(ns, MAX_P); pSoft.instanceMatrix.needsUpdate = true; if (pSoft.instanceColor) pSoft.instanceColor.needsUpdate = true;
  pLit.instanceMatrix.needsUpdate = pGlow.instanceMatrix.needsUpdate = true;
  if (pLit.instanceColor) pLit.instanceColor.needsUpdate = true; if (pGlow.instanceColor) pGlow.instanceColor.needsUpdate = true;
}
function bakeP(p) {                                     // упало на землю — остаётся на слое следов
  dctx.fillStyle = '#' + (p.col >>> 0).toString(16).padStart(6, '0');
  const s = Math.max(1, Math.round(p.s * TPX)); dctx.fillRect(Math.round(p.x * TPX - s / 2), Math.round(p.z * TPX - s / 2), s, s); decalMark(p.x, p.z, 0.1);
}
function blood(x, y, z, dx, dz, n) {
  for (let i = 0; i < n; i++) spawnP({ x, y, z, vx: dx * rnd(1, 4) + rnd(-1, 1), vy: rnd(0.5, 3), vz: dz * rnd(1, 4) + rnd(-1, 1), g: 14, s: rnd(0.05, 0.1), col: [0x7a1612, 0x941e18, 0x5c100d][i % 3], life: 1.5, stay: true });
}
function dust(x, y, z, col, n = 5) {
  for (let i = 0; i < n; i++) spawnP({ x, y, z, vx: rnd(-1.5, 1.5), vy: rnd(0.5, 2.5), vz: rnd(-1.5, 1.5), g: 10, s: rnd(0.04, 0.08), col, life: 0.6, bounce: 1, stay: Math.random() < 0.4 });
  spawnP({ x, y, z, vy: 0.5, s: 0.12, s1: 0.4, col: 0xb8b0a0, col1: 0x807a70, life: 0.5, drag: 0.9 });
}
function sparks(x, y, z) { for (let i = 0; i < 6; i++) spawnP({ x, y, z, vx: rnd(-4, 4), vy: rnd(0, 4), vz: rnd(-4, 4), g: 12, s: 0.04, col: 0xffe090, glow: true, life: rnd(0.12, 0.3) }); }

// Взрыв: вспышка, огненный шар, дым, осколки, подпалина на земле
const boomLight = new THREE.PointLight(0xffa050, 0, 10, 1.6); scene.add(boomLight);
let boomT = 0;
function boomFx(x, y, z, R, gore) {
  boomLight.position.set(x, y + 1, z); boomLight.intensity = 6 * Math.min(1.5, R); boomT = 0.22;
  for (let i = 0; i < 26 * R; i++) { const a = Math.random() * TAU, v = rnd(1, 4.5) * R;
    spawnP({ x, y: y + 0.3, z, vx: Math.cos(a) * v, vy: rnd(0.5, 3), vz: Math.sin(a) * v, s: rnd(0.14, 0.3), s1: 0.02, col: 0xfff0a0, col1: 0xd04010, glow: true, life: rnd(0.25, 0.5), drag: 0.86 }); }
  for (let i = 0; i < 12 * R; i++) { const a = Math.random() * TAU, v = rnd(0.3, 1.5);
    spawnP({ x: x + Math.cos(a) * 0.3, y: y + 0.4, z: z + Math.sin(a) * 0.3, vx: Math.cos(a) * v, vy: rnd(0.6, 1.6), vz: Math.sin(a) * v, s: 0.25, s1: 0.9 * R, col: 0x3a3430, col1: 0x807a72, life: rnd(1.2, 2.2), drag: 0.97 }); }
  for (let i = 0; i < 10; i++) spawnP({ x, y: y + 0.3, z, vx: rnd(-5, 5), vy: rnd(2, 6), vz: rnd(-5, 5), g: 14, s: rnd(0.05, 0.1), col: gore ? [0x5c7a3a, 0x7a1612, 0x4a3a2a][i % 3] : 0x2a2622, life: 3, bounce: 1, stay: true });
  if (gore) for (let i = 0; i < 18; i++) spawnP({ x, y: y + 0.5, z, vx: rnd(-4, 4), vy: rnd(1, 5), vz: rnd(-4, 4), g: 14, s: rnd(0.06, 0.12), col: [0x6a8a44, 0x7a1612, 0x941e18][i % 3], life: 2, stay: true });
  scorch(x, z, R * 0.55);
  shake = Math.max(shake, 0.12 * R);
}
function updateBoomLight(dt) { if (boomT > 0) { boomT -= dt; boomLight.intensity *= Math.exp(-12 * dt); if (boomT <= 0) boomLight.intensity = 0; } }

/* ---------- 8. Навигация зомби: поле расстояний по сетке 0.5 с уровнями высоты ---------- */
const NC = 0.5, NW = MAP / NC;
let navCells = null, navAll = [];               // navAll — все опоры одним списком (сброс поля без обхода клеток)
const navQ = [];                                  // очередь обхода — переиспользуется, без новых массивов                     // для каждой клетки — список опор { y, d }
function buildNav() {
  navCells = []; navAll = [];
  for (let j = 0; j < NW; j++) for (let i = 0; i < NW; i++) navCells.push(navCellAt(i, j, true));
}
// Пересчитать клетки в прямоугольнике (мешки с песком появились или сломаны)
function navRebuild(x1, z1, x2, z2) {
  const m = 0.6, i1 = clamp(Math.floor((x1 - m) / NC), 0, NW - 1), i2 = clamp(Math.floor((x2 + m) / NC), 0, NW - 1), j1 = clamp(Math.floor((z1 - m) / NC), 0, NW - 1), j2 = clamp(Math.floor((z2 + m) / NC), 0, NW - 1);
  for (let j = j1; j <= j2; j++) for (let i = i1; i <= i2; i++) navCells[j * NW + i] = navCellAt(i, j, false);
}
function navCellAt(i, j, all) {
  {
    const x = (i + 0.5) * NC, z = (j + 0.5) * NC, tops = [0];
    for (const s of solidsNear(x, z)) if (!s.leaves && x > s.x1 && x < s.x2 && z > s.z1 && z < s.z2) tops.push(s.y2);
    const list = [];
    for (const y of [...new Set(tops.map(v => Math.round(v * 100) / 100))]) {
      let ok = true;                                   // над опорой есть место для роста
      for (const s of solidsNear(x, z)) if (x > s.x1 - 0.2 && x < s.x2 + 0.2 && z > s.z1 - 0.2 && z < s.z2 + 0.2 && s.y1 < y + BODY_H && s.y2 > y + STEP + 0.01) ok = false;
      if (y === 0 && x < 0.6 || z < 0.6 || x > MAP - 0.6 || z > MAP - 0.6) ok = false;
      if (ok) { const n = { y, d: 1e9, i, j }; list.push(n); if (all) navAll.push(n); }
    }
    return list;
  }
}
function navNode(x, z, y) {
  const i = clamp(Math.floor(x / NC), 0, NW - 1), j = clamp(Math.floor(z / NC), 0, NW - 1), L = navCells[j * NW + i];
  let best = null, bd = 1e9; for (const n of L) { const d = Math.abs(n.y - y); if (d < bd) { bd = d; best = n; } }
  return best && bd < 0.8 ? { i, j, n: best } : null;
}
// Поле расстояний от игроков (обход в ширину). На карте 96×96 — ~37 тыс. клеток, поэтому без новых массивов на каждом шаге
// и не дальше NAV_MAX шагов (40 клеток): дальше зомби идут к игроку напрямую, пока не войдут в поле.
const NAV_MAX = 700, NAV_D = [1, 0, -1, 0, 0, 1, 0, -1], NAV_D8 = [1, 0, -1, 0, 0, 1, 0, -1, 1, 1, -1, 1, 1, -1, -1, -1];
const LAD_COST = 16;                                  // лестница для поля путей «стоит» 16 шагов (8 м): зомби лезут, только если иначе не добраться или заметно дольше
// ближайшая опора рядом с точкой (лестницы стоят у стены, где сама клетка может не пройти проверку на зазор)
function navNear(x, z, y) {
  const ci = Math.floor(x / NC), cj = Math.floor(z / NC); let best = null, bd = 1e9;
  for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
    const a = ci + di, b = cj + dj; if (a < 0 || b < 0 || a >= NW || b >= NW) continue;
    for (const n of navCells[b * NW + a]) { const d = Math.hypot((a + 0.5) * NC - x, (b + 0.5) * NC - z) + Math.abs(n.y - y) * 3; if (d < bd && Math.abs(n.y - y) < 0.8) { bd = d; best = n; } }
  }
  return best;
}
function navField(srcs) {                // srcs: [{x, y, z}] — все живые игроки (кооп)
  const q = navQ; for (let h = 0; h < q.length; h++) q[h].d = 1e9;   // сбрасываем только то, что прошли в прошлый раз
  q.length = 0;
  for (const o of srcs) { const s = navNode(o.x, o.z, o.y); if (s) { s.n.d = 0; q.push(s.n); } }
  const lads = typeof LADS !== 'undefined' ? LADS : [];
  for (const L of lads) { L.A = navNear(L.bx, L.bz, 0); L.B = navNear(L.lx, L.lz, L.H); }
  let h = 0;
  for (;;) {
    for (; h < q.length; h++) {
      const n = q[h], nd = n.d + 1; if (nd > NAV_MAX) continue;
      for (let k = 0; k < 8; k += 2) {
        const a = n.i + NAV_D[k], b = n.j + NAV_D[k + 1]; if (a < 0 || b < 0 || a >= NW || b >= NW) continue;
        const L = navCells[b * NW + a];
        for (let t = 0; t < L.length; t++) { const m = L[t]; if (m.d > nd && Math.abs(m.y - n.y) <= STEP + 0.02) { m.d = nd; q.push(m); } }
      }
    }
    let any = false;                                  // лестницы: связь низ ↔ верх
    for (const L of lads) {
      if (!L.A || !L.B) continue;
      if (L.A.d + LAD_COST < L.B.d && L.A.d + LAD_COST <= NAV_MAX) { L.B.d = L.A.d + LAD_COST; q.push(L.B); any = true; }
      if (L.B.d + LAD_COST < L.A.d && L.B.d + LAD_COST <= NAV_MAX) { L.A.d = L.B.d + LAD_COST; q.push(L.A); any = true; }
    }
    if (!any) break;
  }
}
// есть ли рядом клетка, куда можно ступить (для запрета срезать углы по диагонали)
function navOpen(a, b, y) {
  if (a < 0 || b < 0 || a >= NW || b >= NW) return false;
  for (const m of navCells[b * NW + a]) if (Math.abs(m.y - y) <= STEP + 0.02) return true;
  return false;
}
function navDir(e) {
  const s = navNode(e.x, e.z, e.y); if (!s) return null;
  let best = null, bd = s.n.d;
  for (let k = 0; k < 16; k += 2) {
    const dx = NAV_D8[k], dz = NAV_D8[k + 1], a = s.i + dx, b = s.j + dz; if (a < 0 || b < 0 || a >= NW || b >= NW) continue;
    if (dx && dz && !(navOpen(s.i + dx, s.j, s.n.y) && navOpen(s.i, s.j + dz, s.n.y))) continue;   // по диагонали — только если оба соседа проходимы
    for (const m of navCells[b * NW + a]) if (Math.abs(m.y - s.n.y) <= STEP + 0.02 && m.d < bd) { bd = m.d; best = [(a + 0.5) * NC, (b + 0.5) * NC]; }
  }
  return best;
}


/* ---------- Зомби из воксельного пака: части тела — InstancedMesh, тени — от простых коробок ---------- */
const VOXMS = Object.values(VOX_ASSETS).map(b => buildVoxModel(b));          // все модели пака: Zed_1 … Zed_6
const VOXM = VOXMS[0];
const MAX_VZ = Math.max(420, (IS_TOUCH ? CFG.MAX_ENEMIES_MOBILE : CFG.MAX_ENEMIES_PC) + 120);
const VZ = { on: lsGet('voxZ', true), fullShadow: false, H: lsGet('voxH', 1.35), W: lsGet('voxW', 1.5), pn: 0, hero: lsGet('voxHero', true) };
// Цвет куртки игрока: синий, красный, зелёный, жёлтый (перекрашиваем синие цвета модели героя)
const PLAYER_COL = [[56, 86, 112], [150, 62, 50], [66, 110, 58], [176, 140, 46]];
const PLAYER_CSS = ['#6a9cc8', '#e07a64', '#8cc870', '#e8c860'];
// Стандартный герой игрока i: базовая модель, куртка перекрашена в цвет игрока
const buildDefaultHero = i => buildVoxModel(VOX_HERO, i === 0 ? null : ([r, g, b]) => {
  if (!(b > r + 30 && b > g + 10)) return [r, g, b];
  const k = b / 112; return PLAYER_COL[i].map(v => Math.min(255, Math.round(v * k)));
});
const VOXHEROES = PLAYER_COL.map((c, i) => buildDefaultHero(i));
const VOXHERO = buildVoxModel(VOX_HERO);                  // эталон для точек хвата оружия и вещей класса (в сцену не добавляется)
const VOXALL = [...VOXMS, ...VOXHEROES];
// у каждой модели свои части-InstancedMesh и своя текстура; счётчик экземпляров — на модель
function setupVoxModel(M) {
  M.mat = new THREE.MeshLambertMaterial({ map: M.tex }); M.mesh = {}; M.box = {}; M.n = 0;
  for (const k of VOX_PARTS) {
    const m = new THREE.InstancedMesh(M.parts[k].geo, M.mat, MAX_VZ);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_VZ * 3).fill(1), 3);
    m.frustumCulled = false; m.receiveShadow = true; m.castShadow = VZ.fullShadow; m.count = 0; scene.add(m); M.mesh[k] = m;
    const bb = new THREE.Box3().setFromBufferAttribute(M.parts[k].geo.attributes.position);   // коробка части — для тени
    M.box[k] = { c: bb.getCenter(new THREE.Vector3()), s: bb.getSize(new THREE.Vector3()) };
  }
}
for (const M of VOXALL) setupVoxModel(M);
// заменить модель героя в слоте игрока i (редактор персонажа)
function setHeroModel(i, M) {
  const old = VOXHEROES[i];
  for (const k of VOX_PARTS) { scene.remove(old.mesh[k]); old.mesh[k].dispose(); old.parts[k].geo.dispose(); }
  old.mat.dispose(); old.tex.dispose();
  setupVoxModel(M); VOXHEROES[i] = M; VOXALL[VOXMS.length + i] = M;
}
// невидимые коробки, которые только отбрасывают тень (в десятки раз дешевле точной тени)
const voxShadow = new THREE.InstancedMesh(boxGeo, new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }), MAX_VZ * VOX_PARTS.length);
voxShadow.castShadow = true; voxShadow.frustumCulled = false; voxShadow.instanceMatrix.setUsage(THREE.DynamicDrawUsage); voxShadow.count = 0; scene.add(voxShadow);
function setVoxShadow(full) { VZ.fullShadow = full; for (const M of VOXALL) for (const k of VOX_PARTS) M.mesh[k].castShadow = full; voxShadow.visible = !full; }
const _vs = new THREE.Matrix4(), _vr = new THREE.Matrix4(), _vl = new THREE.Matrix4(), _vm = new THREE.Matrix4(), _vb = new THREE.Matrix4();
const isVoxZ = c => VZ.on && c.zombie && (c.form === 'walk' || c.form === 'run' || c.form === 'crawl' || c.form === 'fat' || c.form === 'armored' || FORM_H[c.form] !== undefined);   // толстяк и бронированный — тоже из пака (черновые)
function drawVoxZombie(c) {
  if (c.vm === undefined) c.vm = Math.floor(Math.random() * VOXMS.length);   // какая модель из пака
  const M = VOXMS[c.vm % VOXMS.length]; if (M.n >= MAX_VZ || c.boomed) return;
  const fat = c.form === 'fat', arm = c.form === 'armored', sw1 = fat && c.swell ? 1 + c.swell * 0.55 : 1;
  const H = VZ.H * (c.form === 'run' ? 0.95 : fat ? 1.05 : arm ? 1.04 : FORM_H[c.form] || 1) * (fat ? Math.sqrt(sw1) : 1), crawl = c.form === 'crawl', run = c.form === 'run';
  const sw0 = c.moving ? Math.sin(c.phase) : 0, sw = sw0 * (run ? 1.0 : 0.6);
  let lean = c.fall || 0, x = c.x, y = c.y - (c.sink || 0), z = c.z, roll = c.roll || 0;
  const gait = fat || arm ? 0 : (c.gait || 0), age = c.born === undefined ? 9 : G.t - c.born, rise = !c.dead && !crawl && age < 0.9 ? 1 - ss(0, 0.9, age) : 0;   // gait: 0 бредёт, 1 хромает, 2 тянет руки, 3 рывками
  if (!c.dead) {
    lean += c.lean || 0; if (run) lean += 0.28; if (c.hurtT > 0) lean -= 0.35 * c.hurtT / 0.16;
    if (c.atkT > 0) { const k = Math.sin((1 - c.atkT / 0.45) * Math.PI); lean += 0.25 * k; x += Math.sin(c.yaw) * 0.22 * k; z += Math.cos(c.yaw) * 0.22 * k; }   // рывок при укусе
    if (c.moving) { roll += Math.sin(c.phase * 0.5) * (gait === 1 ? 0.1 : run ? 0.05 : 0.04); y += Math.abs(Math.sin(c.phase)) * H * (run ? 0.03 : 0.015); if (gait === 3) lean += 0.16 * Math.max(0, Math.sin(c.phase * 0.5)); if (gait === 1) lean += 0.08; }
    if (rise > 0) { y -= rise * H * 1.15; lean -= rise * 0.5; }                                                                                  // выбирается из земли
  }
  if (crawl) { lean = Math.PI / 2 - 0.08; y += 0.1; x -= Math.sin(c.yaw) * H * 0.45; z -= Math.cos(c.yaw) * H * 0.45; }
  _q.setFromEuler(_e.set(lean, c.yaw, roll, 'YXZ'));
  _vr.compose(_v.set(x, y, z), _q, _s.set(H, H, H));
  const ang = {};
  if (crawl) { const a = Math.sin(c.phase * 0.8) * 0.5; ang.armA = -Math.PI + 0.3 + a; ang.armB = -Math.PI + 0.3 - a; ang.legA = a * 0.2; ang.legB = -a * 0.2; ang.head = -0.9; }
  else {
    ang.legA = sw; ang.legB = -sw; ang.head = c.nod || 0;
    if (gait === 1 && !run) { ang.legA = sw0 * 0.75; ang.legB = -sw0 * 0.25; ang.head += 0.18; }                // хромает: вторая нога волочится
    if (gait === 2 && !run) { ang.legA = sw0 * 0.5; ang.legB = -sw0 * 0.5; ang.head -= 0.12; }
    let r1, r2;
    if (run) { r1 = -0.5 + sw0 * 0.9; r2 = -0.5 - sw0 * 0.9; }
    else if (gait === 1) { r1 = -0.9 + sw0 * 0.35; r2 = -1.55; }
    else if (gait === 2) { r1 = -1.62 + Math.sin(c.phase * 0.5) * 0.05; r2 = -1.58 - Math.sin(c.phase * 0.5) * 0.05; }
    else if (gait === 3) { r1 = -1.0 + sw0 * 0.7; r2 = -1.0 - sw0 * 0.7; }
    else { r1 = -1.35 + Math.sin(c.phase * 0.5) * 0.12; r2 = r1 + 0.1; }
    if (c.atkT > 0) { const k = Math.sin((1 - c.atkT / 0.45) * Math.PI); r1 -= k * 0.6; r2 -= k * 0.5; }
    if (rise > 0) { r1 += (-2.8 - r1) * rise; r2 += (-2.8 - r2) * rise; ang.head = -0.4 * rise; }               // руки вверх, пока вылезает
    if (c.raise > 0) { r1 += (-2.7 - r1) * c.raise; r2 += (-2.7 - r2) * c.raise; ang.head = -0.55 * c.raise; }   // замах, крик, рёв
    if (c.dead) { r1 = r2 = -0.3; }
    ang.armA = r1; ang.armB = r2;
  }
  const wMul = fat ? 1.45 * sw1 : arm ? 1.12 : FORM_W[c.form] || 1;
  voxEmit(M, ang, null, c.flash > 0 ? 3.2 : fat && c.swell ? 1 + c.swell * 1.6 : 1, wMul);
  if (fat || arm || FORM_H[c.form] !== undefined) zedGear(M, ang, wMul, fat, c);
}
const _linC = {}; const lin = c => _linC[c] ?? (_linC[c] = new THREE.Color(c).convertSRGBToLinear().getHex());
// Черновые вещи толстяка и бронированного поверх модели пака: пузо / каска и бронежилет
function zedGear(M, ang, wMul, fat, c) {
  _gs.makeScale(VZ.W * wMul, 1, VZ.W * wMul);
  const at = k => { const pv = M.parts[k].pivot; _gt.makeRotationX(ang[k] || 0); _gt.setPosition(pv[0] * VZ.W * wMul, pv[1], pv[2] * VZ.W * wMul); _root.multiplyMatrices(_vr, _gt); _root.multiply(_gs); return M.box[k]; };
  if (c && c.form !== 'armored' && !fat) { mobGear(c, at, M); return; }                                                   // особые мобы (11d_mobs.js)
  if (fat) { const b = at('body'); part(lin(0x7a8a5c), 0, 0, 0, 0, b.s.x * 0.95, b.s.y * 0.55, b.s.z * 0.7, b.c.y - b.s.y * 0.12, b.c.z + b.s.z * 0.45, 0, b.c.x); return; }
  const h = at('head'); part(lin(0x3e4632), 0, 0, 0, 0, h.s.x * 1.18, h.s.y * 0.42, h.s.z * 1.18, h.c.y + h.s.y * 0.38, h.c.z, 0, h.c.x);   // каска
  part(lin(0x343a2c), 0, 0, 0, 0, h.s.x * 1.3, h.s.y * 0.06, h.s.z * 1.3, h.c.y + h.s.y * 0.18, h.c.z, 0, h.c.x);                              // поля каски
  const b = at('body'); part(lin(0x2e3428), 0, 0, 0, 0, b.s.x * 1.12, b.s.y * 0.72, b.s.z * 1.25, b.c.y + b.s.y * 0.1, b.c.z, 0, b.c.x);        // бронежилет
}
// Вывести одну модель: корень уже в _vr; ang — поворот частей вокруг X, yaw — вокруг Y (руки к оружию)
function voxEmit(M, ang, yaw, fl, wMul = 1) {
  if (M.n >= MAX_VZ) return;
  const n = M.n++, W = VZ.W * wMul;
  _vs.makeScale(W, 1, W);
  for (const k of VOX_PARTS) {
    const pv = M.parts[k].pivot;
    if (yaw && yaw[k]) _vl.makeRotationFromEuler(_e.set(ang[k] || 0, yaw[k], 0, 'YXZ')); else _vl.makeRotationX(ang[k] || 0);
    _vl.setPosition(pv[0] * W, pv[1], pv[2] * W);   // пропорции: ширина и толщина ×W
    _vm.multiplyMatrices(_vr, _vl); _vm.multiply(_vs);
    M.mesh[k].setMatrixAt(n, _vm); _c.setRGB(fl, fl, fl); M.mesh[k].setColorAt(n, _c);
    if (!VZ.fullShadow) { const B = M.box[k]; _vb.compose(B.c, _q.identity(), B.s); _vb.premultiply(_vm); voxShadow.setMatrixAt(VZ.pn++, _vb); }
  }
}
function voxFrameBegin() { for (const M of VOXALL) M.n = 0; VZ.pn = 0; }
function voxFrameEnd() {
  for (const M of VOXALL) for (const k of VOX_PARTS) { const m = M.mesh[k]; m.count = M.n; m.visible = M.n > 0; m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; }
  voxShadow.count = VZ.pn; voxShadow.instanceMatrix.needsUpdate = true;
}
/* ---- Герой: та же сетка и те же размеры, что у зомби из пака; ствол — кодовый, в руках ---- */
function heroHands() {                                  // где хват оружия — от плеча модели и текущих пропорций
  const pv = VOXHERO.parts.armA.pivot, H = VZ.H;
  HAND_Y = pv[1] * H - 0.1; HAND_X = pv[0] * H * VZ.W * 0.5; HAND_Z = 0.1; REV_X = pv[0] * H * VZ.W;
}
function drawVoxHero(p) {
  heroHands();
  const H = VZ.H, P = heroPose(p); (p.an || (p.an = {})).pose = P;
  _q.setFromEuler(_e.set(P.lean, p.yaw, P.roll, 'YXZ'));
  _vr.compose(_v.set(p.x, p.y + P.dy * H, p.z), _q, _s.set(H, H, H));
  const ang = P.ang, yaw = P.yaw;
  voxEmit(VOXHEROES[p.idx % VOXHEROES.length], ang, yaw, 1);
  drawGear(p, ang, yaw);
  drawTeslaPack(p);
}
// Вещи класса (GEAR в 01_data) — кодовые коробки поверх воксельного героя, крепятся к голове, телу, рукам
const _gt = new THREE.Matrix4(), _gs = new THREE.Matrix4();
// цвета вещей заданы как в редакторе (sRGB), а цвет экземпляра считается линейным — иначе вещи выходят бледными
for (const k in GEAR) for (const g of GEAR[k]) g[1] = new THREE.Color(g[1]).convertSRGBToLinear().getHex();
function drawGear(p, ang, yaw) {
  const G2 = GEAR[p.cls]; if (!G2) return;
  _gs.makeScale(VZ.W, 1, VZ.W);
  let cur = null;
  for (const [k, col, sx, sy, sz, ox, oy, oz] of G2) {
    if (k !== cur) {                                   // корень части: как у модели в voxEmit
      cur = k; const pv = VOXHERO.parts[k].pivot;
      if (yaw && yaw[k]) _gt.makeRotationFromEuler(_e.set(ang[k] || 0, yaw[k], 0, 'YXZ')); else _gt.makeRotationX(ang[k] || 0);
      _gt.setPosition(pv[0] * VZ.W, pv[1], pv[2] * VZ.W);
      _root.multiplyMatrices(_vr, _gt); _root.multiply(_gs);
    }
    part(col, 0, 0, 0, 0, sx, sy, sz, oy, oz, 0, ox);
  }
}
