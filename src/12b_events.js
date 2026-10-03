'use strict';
/* ---------- События и объекты карты (v0.21): сирена и генератор, вертолёт-эвакуация, взрывные баки и бочки,
   оружейка с ключ-картой, склад в карцере. Подключается последним; в основной код вшиты только вызовы-крючки. ---------- */
const EVC = {
  SIREN: 660, DARK: 690, HOLD: 20,                       // сирена на 11:00, свет гаснет на 11:30, генератор запускается за 20 с
  GEN: { x: 86.8, z: 8.0 },                              // котельная (северо-восток, за воротами)
  PADC: { x: 45, z: 36.5, hw: 4, hd: 3.3 },              // вертолётная площадка на крыше администрации (самая высокая ходовая крыша)
  CALL: 1020, LEAVE: 120, BOARD: 3,                      // вызов вертолёта на 17:00, посадка в конце забега, ждёт 2 минуты, на борту 3 с
  ARM: { x1: 29, z1: 67.5, x2: 39, z2: 75.5 }, ARM_DOOR: [70.8, 72.4],
  GUARD_T: 150, PADH: 5.2,                                          // охранник с ключ-картой появляется на 2:30
};
if (MAPDEF.events) {                                      // у каждой карты свои точки: генератор, площадка, оружейка
  const e = MAPDEF.events;
  if ('gen' in e) EVC.GEN = e.gen; if ('pad' in e) { if (e.pad) { EVC.PADC = { x: e.pad.x, z: e.pad.z, hw: e.pad.hw, hd: e.pad.hd }; EVC.PADH = e.pad.h; } else EVC.PADC = null; } if ('arm' in e) EVC.ARM = e.arm;
}
const EV = { clock: 0, blackout: false, alarm: false, restored: false, hold: 0, flickT: 0, sirenS: 0, pressT: 0,
  hasKey: false, guard: null, keyItem: null, armGate: null, trap: false, evac: 0, board: 0, lift: 0, heliS: 0, fx: [], banner: null };

/* ---- вёрстка: баннер, полоса, метки целей ---- */
{
  const st = document.createElement('style');
  st.textContent = `
  #evBanner{position:fixed;left:50%;top:15%;transform:translateX(-50%);text-align:center;pointer-events:none;z-index:6;opacity:0;transition:opacity .4s;text-shadow:0 2px 8px #000}
  #evBanner b{display:block;font-size:clamp(22px,4vw,38px);letter-spacing:3px;font-weight:800}
  #evBanner span{display:block;margin-top:6px;font-size:clamp(13px,1.8vw,17px);color:#f2ead6}
  #evBar{position:fixed;left:50%;top:26%;transform:translateX(-50%);width:min(340px,70vw);display:none;pointer-events:none;z-index:6;color:#f2ead6;font-size:13px;text-align:center;text-shadow:0 1px 3px #000}
  #evBar div{margin-top:4px;height:10px;background:rgba(14,11,8,.85);border:1px solid #6a5a3a} #evBar i{display:block;height:100%;width:0;background:#ffd040}
  #evAlarm{position:fixed;inset:0;pointer-events:none;z-index:2;opacity:0;background:radial-gradient(ellipse at center,rgba(255,30,20,0) 35%,rgba(255,30,20,.55) 100%)}
  #evObjs{position:fixed;inset:0;pointer-events:none;z-index:3}
  .evObj{position:absolute;left:0;top:0;display:none;flex-direction:column;align-items:center;font-size:12px;font-weight:700;white-space:nowrap;text-shadow:0 1px 3px #000}
  .evObj .pill{padding:2px 8px;background:rgba(14,11,8,.88);border:1px solid currentColor}
  .evObj .pill small{font-weight:400;margin-left:6px;opacity:.85}
  .evObj i{display:none;width:0;height:0;border-left:14px solid currentColor;border-top:9px solid transparent;border-bottom:9px solid transparent;margin-bottom:3px;filter:drop-shadow(0 0 5px currentColor)}
  .evObj.edge i{display:block}`;
  document.head.appendChild(st);
  for (const [id, html] of [['evBanner', '<b></b><span></span>'], ['evBar', '<span></span><div><i></i></div>'], ['evAlarm', ''], ['evObjs', '']]) { const e = document.createElement('div'); e.id = id; e.innerHTML = html; document.body.appendChild(e); }
}
function evSay(title, sub, col = '#ffd040') {
  const b = document.getElementById('evBanner'); if (!b) return;
  b.querySelector('b').textContent = title; b.querySelector('b').style.color = col; b.querySelector('span').textContent = sub || '';
  b.style.opacity = 1; clearTimeout(EV.banner); EV.banner = setTimeout(() => { b.style.opacity = 0; }, 6500);
}
function evBar(txt, k) { const e = document.getElementById('evBar'); if (k === null) { e.style.display = 'none'; return; } e.style.display = 'block'; e.querySelector('span').textContent = txt; e.querySelector('i').style.width = Math.round(clamp(k, 0, 1) * 100) + '%'; }

/* ---- взрывные бочки и топливные баки: стреляй или взрывай — цепная реакция, ранят и зомби, и своих ---- */
const EXPL = [];
function regExpl(s0, o) {
  const E = Object.assign({ hp: o.max, gone: false, fuse: 0, solids: solids.slice(s0) }, o);
  for (const s of E.solids) s.expl = E;
  EXPL.push(E); return E;
}
function inGroup(fn) {                                    // всё, что строит fn, складывается в свою группу (её можно спрятать при взрыве)
  const grp = new THREE.Group(); staticGroup.add(grp);
  const prev = BOX_PARENT, s0 = solids.length; BOX_PARENT = grp;
  try { fn(); } finally { BOX_PARENT = prev; }
  return { grp, s0 };
}
function xBarrelOp(x, z) {
  const { grp, s0 } = inGroup(() => {
    if (typeof PROP_VOX !== 'undefined') barrelVox(x, z, 'redbarrel');                  // красная бочка из assets/props/redbarrel.vox
    else {
      box(x - 0.3, 0, z - 0.3, x + 0.3, 0.9, z + 0.3, 0xa8342a, { hit: 'metal' });
      for (const y of [0.28, 0.62]) box(x - 0.33, y, z - 0.33, x + 0.33, y + 0.06, z + 0.33, 0x2a1a14, { solid: false });
      box(x - 0.34, 0.4, z - 0.14, x + 0.34, 0.54, z + 0.14, 0xe8c030, { solid: false }); box(x - 0.14, 0.4, z - 0.34, x + 0.14, 0.54, z + 0.34, 0xe8c030, { solid: false });   // жёлтая полоса: «взрывоопасно»
    }
  });
  regExpl(s0, { kind: 'barrel', x, z, y: 0.5, max: 22, dmg: 140, R: 2.7, grp });
}
function xTankOp(x, z) {
  const { grp, s0 } = inGroup(() => {
    tankOp(x, z);
    box(x - 0.5, 1.2, z - 1.16, x + 0.5, 1.8, z - 1.12, 0xe8c030, { solid: false }); box(x - 0.12, 1.3, z - 1.17, x + 0.12, 1.7, z - 1.13, 0xa02a1e, { solid: false });
  });
  regExpl(s0, { kind: 'tank', x, z, y: 1.3, max: 70, dmg: 230, R: 4.6, grp, fire: 9 });
  const bb = new THREE.Box3().setFromObject(grp), B = { x1: bb.min.x, z1: bb.min.z, x2: bb.max.x, z2: bb.max.z, H: bb.max.y, grp, mats: [] };   // прозрачнеет, если закрывает героя
  B.finish = () => { const cache = new Map(); B.mats = []; grp.traverse(m => { if (!m.isMesh) return; let c = cache.get(m.material); if (!c) { c = m.material.clone(); cache.set(m.material, c); B.mats.push(c); } m.material = c; }); };
  buildings.push(B);
}
function explDamage(E, d) {
  if (E.gone) return; E.hp -= d; if (ATTR) E.owner = ATTR;
  sparks(E.x + rnd(-0.2, 0.2), E.kind === 'tank' ? 1.4 : 0.6, E.z + rnd(-0.2, 0.2));
  if (E.hp <= 0) E.fuse = Math.max(E.fuse, 0.03);
}
function explHit(x, z, R) {                               // чужой взрыв рядом: поджигаем с задержкой — получается цепочка
  for (const E of EXPL) if (!E.gone && !E.fuse && Math.hypot(E.x - x, E.z - z) < R + 0.6) { E.fuse = rnd(0.12, 0.3); if (!E.owner && ATTR) E.owner = ATTR; }
}
function boomExpl(E) {
  E.gone = true; E.fuse = 0; E.grp.visible = false;
  for (const s of E.solids) { const k = solids.indexOf(s); if (k >= 0) solids.splice(k, 1); }
  indexSolids(); navRebuild(E.x - 2, E.z - 2, E.x + 2, E.z + 2);
  explode(E.x, E.y, E.z, E.dmg, E.R, { hurts: true, knock: 2.2, gore: true, owner: E.owner });
  scorch(E.x, E.z, E.R * 0.55); shake = Math.max(shake, E.kind === 'tank' ? 0.9 : 0.5);
  for (let i = 0; i < (E.kind === 'tank' ? 36 : 16); i++) spawnP({ x: E.x, y: 0.6, z: E.z, vx: rnd(-6, 6), vy: rnd(3, 8), vz: rnd(-6, 6), g: 14, s: rnd(0.07, 0.15), col: E.kind === 'tank' ? 0xb8a040 : 0xa8342a, life: rnd(0.8, 1.6) });
  if (E.fire) { const f = { x: E.x, y: 0.1, z: E.z, s: 1.6, R: E.R * 0.45, acc: 0, seed: Math.random() * 10 }; fires.push(f); EV.fx.push({ f, x: E.x, z: E.z, R: f.R, t: E.fire, tick: 0, owner: E.owner }); }
}
function explRestore() {                                  // новый забег: всё на месте
  for (const f of EV.fx) { const k = fires.indexOf(f.f); if (k >= 0) fires.splice(k, 1); } EV.fx.length = 0;
  let any = false;
  for (const E of EXPL) { E.hp = E.max; E.fuse = 0; if (E.gone) { E.gone = false; E.grp.visible = true; for (const s of E.solids) if (!solids.includes(s)) solids.push(s); any = true; } }
  if (any) { indexSolids(); navRebuild(0, 0, MAP, MAP); }
}
function explTick(dt) {
  for (const E of EXPL) {
    if (E.gone) continue;
    if (E.fuse > 0 && (E.fuse -= dt) <= 0) { boomExpl(E); continue; }
    if (E.hp < E.max * 0.6 && Math.hypot(E.x - CAM.x, E.z - CAM.z) < 28 && Math.random() < dt * 10)
      spawnP({ x: E.x + rnd(-0.2, 0.2), y: E.kind === 'tank' ? 2.8 : 0.95, z: E.z + rnd(-0.2, 0.2), vx: rnd(-0.2, 0.2), vy: rnd(0.8, 1.4), vz: rnd(-0.2, 0.2), s: 0.12, s1: 0.55, col: 0x3a3632, col1: 0x6a6660, life: 1.0 });
  }
  for (let i = EV.fx.length - 1; i >= 0; i--) {           // пожар после взрыва бака жжёт всех вокруг
    const F = EV.fx[i]; F.t -= dt; F.tick -= dt;
    if (F.t <= 0) { const k = fires.indexOf(F.f); if (k >= 0) fires.splice(k, 1); EV.fx.splice(i, 1); continue; }
    if (F.tick <= 0) {
      F.tick = 0.5;
      forNear(F.x, F.z, e => { if (!e.dead && Math.hypot(e.x - F.x, e.z - F.z) < F.R) dzBy(F.owner, e, 7, 0, 0, 0, undefined, true); }, F.R + 1);
      for (const p of players) if (!p.down && p.inv <= 0 && Math.abs(p.y) < 1.5 && Math.hypot(p.x - F.x, p.z - F.z) < F.R && !L(p, 'fireproof') && Math.random() < 0.5) hurtPlayer(p);
    }
  }
}

/* ---- генератор (котельная), вертолётная площадка (крыша администрации), оружейка (юг) ---- */
function generatorOp(x, z, y0 = 0) {
  const gb = (a1, y1, b1, a2, y2, b2, c, o) => box(a1, y1 + y0, b1, a2, y2 + y0, b2, c, o);
  const { grp } = inGroup(() => {
    gb(x - 1.3, 0, z - 0.8, x + 1.3, 0.12, z + 0.8, 0x4a4844, { solid: false });
    gb(x - 1.0, 0.12, z - 0.55, x + 1.0, 1.0, z + 0.55, 0x5a7040, { hit: 'metal' });
    gb(x - 1.02, 1.0, z - 0.57, x + 1.02, 1.08, z + 0.57, 0x3a4a2c, { solid: false });
    gb(x - 0.8, 0.2, z + 0.55, x + 0.8, 0.85, z + 0.62, 0x26282a, { solid: false });
    gb(x + 0.7, 1.08, z - 0.4, x + 0.86, 1.8, z - 0.24, 0x2e2e2e, { solid: false });
    for (const dz of [-0.3, 0.3]) gb(x - 1.3, 0.12, z + dz - 0.05, x - 1.0, 0.2, z + dz + 0.05, 0x181818, { solid: false });
    EV.genLamp = gb(x - 0.9, 1.08, z - 0.12, x - 0.6, 1.3, z + 0.18, 0, { solid: false, cast: false, material: new THREE.MeshBasicMaterial({ color: 0x401010 }) });
  });
  EV.genGrp = grp;
}
function helipadOp() {
  if (!EVC.PADC) return;
  const P = EVC.PADC, Bd = buildings.find(b => P.x > b.x1 && P.x < b.x2 && P.z > b.z1 && P.z < b.z2 && Math.abs(b.H - EVC.PADH) < 0.1); if (!Bd) return;
  const y0 = Bd.H + 0.02;
  const bx = (x1, z1, x2, z2, y, h, c, o = {}) => box(x1, y, z1, x2, y + h, z2, c, Object.assign({ parent: Bd.grp, solid: false, cast: false }, o));
  bx(P.x - P.hw, P.z - P.hd, P.x + P.hw, P.z + P.hd, y0, 0.03, 0x34383a);
  const e = 0.14, yy = y0 + 0.03;
  for (const [a, b, c2, d] of [[P.x - P.hw, P.z - P.hd, P.x + P.hw, P.z - P.hd + e], [P.x - P.hw, P.z + P.hd - e, P.x + P.hw, P.z + P.hd], [P.x - P.hw, P.z - P.hd, P.x - P.hw + e, P.z + P.hd], [P.x + P.hw - e, P.z - P.hd, P.x + P.hw, P.z + P.hd]]) bx(a, b, c2, d, yy, 0.012, 0xe8c030);
  bx(P.x - 1.0, P.z - 1.2, P.x - 0.7, P.z + 1.2, yy, 0.012, 0xe8e4d8); bx(P.x + 0.7, P.z - 1.2, P.x + 1.0, P.z + 1.2, yy, 0.012, 0xe8e4d8); bx(P.x - 0.7, P.z - 0.15, P.x + 0.7, P.z + 0.15, yy, 0.012, 0xe8e4d8);   // «H»
  for (let i = 0; i < 24; i++) { const a = i / 24 * TAU, cx = P.x + Math.cos(a) * 2.7, cz = P.z + Math.sin(a) * 2.7; bx(cx - 0.08, cz - 0.08, cx + 0.08, cz + 0.08, yy, 0.012, 0xe8e4d8); }
  EV.beacons = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const cx = P.x + sx * (P.hw - 0.35), cz = P.z + sz * (P.hd - 0.35);
    EV.beacons.push(bx(cx - 0.11, cz - 0.11, cx + 0.11, cz + 0.11, yy, 0.22, 0, { material: new THREE.MeshBasicMaterial({ color: 0x501010 }) }));
  }
}
function armoryOp() {
  const A = EVC.ARM, d = EVC.ARM_DOOR;
  const B = shedOp(A.x1, A.z1, A.x2, A.z2, { h: 2.6, door: { side: 'E', at: d }, col: 0x6e7468 });
  const g = addGate(A.x2 - 0.25, d[0], A.x2 - 0.25, d[1], 'z', false); g.locked = true; g.hp = g.max = 600; EV.armGate = g;
  const rack = (x1, z1, x2, z2) => { box(x1, 0, z1, x2, 1.5, z2, 0x3a3c3c, { parent: B.grp, solid: false }); for (let x = x1 + 0.3; x < x2 - 0.2; x += 0.55) box(x, 0.2, z1 - 0.06, x + 0.07, 1.25, z1 + 0.04, 0x26282a, { parent: B.grp, solid: false, cast: false }); box(x1, 1.5, z1, x2, 1.56, z2, 0x2a2c2c, { parent: B.grp, solid: false }); };
  rack(A.x1 + 0.7, A.z1 + 0.55, A.x2 - 1.4, A.z1 + 1.15); rack(A.x1 + 0.7, A.z2 - 1.2, A.x2 - 1.4, A.z2 - 0.6);
}
Object.assign(MAP_OPS, { xbarrel: xBarrelOp, xtank: xTankOp, generator: generatorOp, helipad: helipadOp, armory: armoryOp });

/* ---- ящики: оружейные (нужна ключ-карта) и склад в карцере (засада) ---- */
const LOOT = !EVC.ARM ? [] : [{ x: 31.6, z: 70.2, loot: 'armory', label: 'Оружейный ящик' }, { x: 31.6, z: 73.6, loot: 'armory', label: 'Оружейный ящик' },
  { x: 83.4, z: 76.2, loot: 'carcer', label: 'Склад' }, { x: 83.4, z: 80.8, loot: 'carcer', label: 'Склад' }, { x: 78.4, z: 75.6, loot: 'carcer', label: 'Склад' }];
function lootItems(p, c, n, pref) {
  const got = [];
  for (let i = 0; i < n; i++) {
    const base = itemPool(p), pool = pref && Math.random() < 0.7 ? itemPool(p, pref) : base, id = pool[Math.floor(Math.random() * pool.length)];
    if (giveItem(p, id)) got.push(ITEMS[id].name); else dropItem(id, c.x + rnd(-0.6, 0.6), c.y, c.z + rnd(-0.6, 0.6));
  }
  if (got.length) toast(p, '+ ' + got.join(', '));
}
function openLootCrate(p, c) {
  SFX.crate(); dust(c.x, c.y + 0.3, c.z, 0xc9a45a, 14);
  if (c.loot === 'armory') {
    const fa = freeAttach(p); if (fa.length) giveAttach(p, fa[Math.floor(Math.random() * fa.length)]);
    lootItems(p, c, fa.length ? 2 : 4, ['grenade', 'claymore', 'molotov', 'turret', 'flash']);
  } else {
    lootItems(p, c, 4, null);
    if (!EV.trap) { EV.trap = true; ambush(); }
  }
}
function ambush() {                                       // склад в карцере: одна дверь — вся орда идёт на неё
  evSay('ЗАСАДА!', 'В карцере одна дверь — уходи по лестнице на крышу', '#ff6a5a');
  const door = { x: 71, z: 77.9 }, cells = { x: 84.4, z: 75.2 };
  for (let i = 0; i < 12; i++) spawnZombie(i % 4 === 3 ? 'runner' : 'walker', door, undefined, true);
  for (let i = 0; i < 2; i++) spawnZombie('armored', door, undefined, true);
  for (let i = 0; i < 4; i++) spawnZombie('walker', cells, undefined, true);
}
function spawnLoot() {
  for (const L0 of LOOT) { spawnCrate(L0.x, L0.z, true); const c = CRATES[CRATES.length - 1]; c.keep = true; c.loot = L0.loot; c.label = L0.label; c.g.scale.setScalar(1.25); }
}

/* ---- объекты-цели: метки на экране, на радаре и столбы света ---- */
function objectives() {
  const out = [], G0 = EVC.GEN, P = EVC.PADC;
  if (EV.blackout) out.push({ id: 'gen', x: G0.x, y: (G0.y || 0) + 1.8, z: G0.z, label: 'ГЕНЕРАТОР', col: '#ffd040' });
  if (EV.guard && !EV.guard.dead) out.push({ id: 'guard', x: EV.guard.x, y: EV.guard.y + 1.9, z: EV.guard.z, label: 'ОХРАННИК', col: '#ffb040' });
  if (EV.keyItem) out.push({ id: 'key', x: EV.keyItem.x, y: EV.keyItem.y + 0.9, z: EV.keyItem.z, label: 'КЛЮЧ-КАРТА', col: '#ffe060' });
  if (EV.hasKey && EV.armGate && EV.armGate.locked) out.push({ id: 'arm', x: EV.armGate.x1, y: 2.6, z: (EV.armGate.z1 + EV.armGate.z2) / 2, label: 'ОРУЖЕЙКА', col: '#8fd46a' });
  if (EV.evac === 1 || EV.evac === 2) out.push({ id: 'pad', x: P.x, y: EVC.PADH + 2, z: P.z, label: EV.evac === 2 ? 'ПОСАДКА' : 'ВЕРТОЛЁТ', col: '#60e890' });
  return out;
}
const evBeams = {};
function beamFor(o) {
  if (!evBeams[o.id]) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1, 12, 1, true).translate(0, 0.5, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(o.col), transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false })); m.frustumCulled = false; scene.add(m); evBeams[o.id] = m; }
  return evBeams[o.id];
}
const evEls = [];
function evHud(T) {
  const objs = EV.on === false ? [] : (G.state === 'play' || G.state === 'end' ? objectives() : []);
  for (const id in evBeams) evBeams[id].visible = false;
  for (const o of objs) {
    const b = beamFor(o), base = o.id === 'pad' ? EVC.PADH + 0.1 : o.id === 'guard' ? o.y - 1.9 : Math.max(0, o.y - 1.8);
    b.visible = true; b.position.set(o.x, base, o.z); b.scale.set(o.id === 'guard' || o.id === 'key' ? 0.5 : 1, o.id === 'pad' ? 22 : o.id === 'guard' || o.id === 'key' ? 5 : 16, o.id === 'guard' || o.id === 'key' ? 0.5 : 1); b.material.opacity = 0.16 + 0.08 * Math.sin(T * 4);
  }
  const root = document.getElementById('evObjs'); let n = 0;
  if (objs.length && (G.state === 'play')) for (const V of uiViews()) for (const o of objs) {
    let d = 99; for (const p of V.ps) d = Math.min(d, Math.hypot(p.x - o.x, p.z - o.z));
    _pv.set(o.x, o.y, o.z).applyMatrix4(V.vm).applyMatrix4(V.pm);
    const nx = _pv.x, ny = _pv.y, inside = Math.abs(nx) < 0.92 && Math.abs(ny) < 0.88 && _pv.z < 1;
    while (evEls.length <= n) { const e = document.createElement('div'); e.className = 'evObj'; e.innerHTML = '<i></i><div class="pill"><span></span><small></small></div>'; root.appendChild(e); evEls.push(e); }
    const e = evEls[n++]; e.style.display = 'flex'; e.style.color = o.col; e.classList.toggle('edge', !inside);
    e.querySelector('span').textContent = o.label; e.querySelector('small').textContent = Math.round(d) + ' м';
    if (inside) { e.style.transform = `translate(${(V.rect.x + (nx + 1) / 2 * V.rect.w).toFixed(1)}px,${(V.rect.y + (1 - ny) / 2 * V.rect.h).toFixed(1)}px) translate(-50%,-100%)`; e.firstChild.style.transform = ''; }
    else {
      const k = Math.max(Math.abs(nx) / 0.9, Math.abs(ny) / 0.84, 1e-3), fx = nx / k, fy = ny / k;
      e.style.transform = `translate(${(V.rect.x + (fx + 1) / 2 * V.rect.w).toFixed(1)}px,${(V.rect.y + (1 - fy) / 2 * V.rect.h).toFixed(1)}px) translate(-50%,-50%)`;
      e.firstChild.style.transform = `rotate(${Math.atan2(-ny, nx).toFixed(3)}rad)`;
    }
  }
  for (let i = n; i < evEls.length; i++) evEls[i].style.display = 'none';
  const al = document.getElementById('evAlarm'); if (al) al.style.opacity = EV.alarm ? (0.35 + 0.35 * Math.sin(EV.clock * 7)).toFixed(2) : 0;
}
function evRadar(g, pt, dot, T, rad, c) {
  for (const o of objectives()) {
    const [px, py] = pt(o.x, o.z); let x = px, y = py; const dx = px - c, dy = py - c, d = Math.hypot(dx, dy), lim = rad - 6, out = d > lim;
    if (out) { x = c + dx / d * lim; y = c + dy / d * lim; }
    const pu = 4.5 + Math.sin(T * 6) * 1.2;
    g.strokeStyle = o.col; g.fillStyle = o.col; g.lineWidth = 2;
    if (out) { const a = Math.atan2(dy, dx); g.save(); g.translate(x, y); g.rotate(a); g.beginPath(); g.moveTo(6, 0); g.lineTo(-4, -5); g.lineTo(-4, 5); g.closePath(); g.fill(); g.restore(); }
    else { g.beginPath(); g.arc(x, y, pu, 0, TAU); g.stroke(); g.fillRect(x - 1.5, y - 1.5, 3, 3); }
  }
}

/* ---- свет: сирена мигает, потом тьма; поправки к фонарям, окнам и прожекторам ---- */
function lampOn(L) {
  const ph = L.x * 7.3 + L.z * 3.1;
  if (EV.alarm) return (Math.sin(EV.clock * 11 + ph) + Math.sin(EV.clock * 17.3 + ph * 2) > 0.3) ? 1 : 0.08;
  if (EV.blackout) return 0;
  if (EV.flickT > 0) return Math.random() < 1 - EV.flickT / 3 ? 1 : 0.1;
  return 1;
}
const evLights = () => EV.blackout ? 0 : EV.alarm ? 0.5 : 1;   // окна и прожекторы вышек: тьма — совсем выключены, тревога — мерцают
function evSkyFx(n) {
  if (EV.alarm) { const p = 0.5 + 0.5 * Math.sin(EV.clock * 7); hemi.color.lerp(_evRed, 0.3 * p); sun.color.lerp(_evRed, 0.2 * p); }
}
const _evRed = new THREE.Color(1, 0.18, 0.12);
function evGenLamp(on) { if (EV.genLamp) EV.genLamp.material.color.setHex(on ? (Math.sin(EV.clock * 14) > -0.3 ? 0x40ff60 : 0x208030) : 0x401010); }

/* ---- вертолёт ---- */
const HELI = { g: null, rotor: null, tail: null, beam: null };
function buildHeli() {
  const g = new THREE.Group(), M = (c, o = {}) => new THREE.MeshLambertMaterial(Object.assign({ color: c, transparent: true }, o));
  const part = (x, y, z, w, h, d, col, parent = g, o) => { const m = new THREE.Mesh(boxGeo, M(col, o)); m.scale.set(w, h, d); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
  part(0, 0.75, 0, 2.6, 1.0, 1.15, 0x4a5a48); part(1.25, 0.7, 0, 0.9, 0.7, 0.95, 0x1c2a36);                 // кабина и стекло (нос к +x)
  part(-2.3, 0.95, 0, 2.4, 0.3, 0.35, 0x425240); part(-3.4, 1.3, 0, 0.3, 0.8, 0.12, 0x425240);                // хвост и киль
  part(0, 1.35, 0, 0.3, 0.3, 0.3, 0x2a2e2a);                                                                   // втулка
  for (const s of [-1, 1]) { part(0, 0.05, s * 0.62, 2.8, 0.09, 0.1, 0x2a2a2a); part(0.7, 0.3, s * 0.6, 0.08, 0.6, 0.08, 0x2a2a2a); part(-0.7, 0.3, s * 0.6, 0.08, 0.6, 0.08, 0x2a2a2a); }   // полозья
  const rotor = new THREE.Group(); rotor.position.set(0, 1.55, 0); g.add(rotor);
  part(0, 0, 0, 5.8, 0.04, 0.22, 0x1e1e1e, rotor); part(0, 0, 0, 0.22, 0.04, 5.8, 0x1e1e1e, rotor);
  const tail = new THREE.Group(); tail.position.set(-3.45, 1.2, 0.1); g.add(tail); part(0, 0, 0, 0.9, 0.05, 0.1, 0x1e1e1e, tail); part(0, 0, 0, 0.1, 0.05, 0.9, 0x1e1e1e, tail);
  g.scale.setScalar(1.25); g.visible = false; scene.add(g);
  const beam = new THREE.Mesh(BEAM_GEO, new THREE.MeshBasicMaterial({ color: 0xfff0d0, transparent: true, opacity: 0.1, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false })); beam.visible = false; beam.frustumCulled = false; scene.add(beam);
  HELI.g = g; HELI.rotor = rotor; HELI.tail = tail; HELI.beam = beam; g.userData.mats = []; g.traverse(m => { if (m.isMesh) g.userData.mats.push(m.material); });
}
function heliTick(dt) {
  if (!EVC.PADC) return;
  if (!HELI.g) buildHeli();
  const P = EVC.PADC, g = HELI.g, show = EV.evac >= 1 && G.t >= RUN_TIME - 60 && EV.evac < 4;
  const y0 = EVC.PADH + 0.07, A0 = y0 + 10.2;
  if (!show && !(EV.evac === 3 && EV.lift < 8)) { g.visible = false; HELI.beam.visible = false; return; }
  g.visible = true;
  const tt = RUN_TIME - G.t, ang = EV.clock * 0.5; let R, alt, yaw;
  if (EV.evac === 3) { R = 0; alt = y0 + EV.lift * EV.lift * 0.6; EV.lift += dt; yaw = (EV.lift) * 0.4; }
  else if (tt > 12) { R = 30; alt = A0; yaw = Math.atan2(-Math.cos(ang), -Math.sin(ang)); }
  else if (tt > 0) { const u = 1 - tt / 12, e = u * u * (3 - 2 * u); R = 30 * Math.pow(1 - u, 1.3); alt = A0 + (y0 - A0) * e; yaw = Math.atan2(-Math.cos(ang), -Math.sin(ang)) * (1 - u) + 0 * u; }
  else { R = 0; alt = y0; yaw = 0; }
  g.position.set(P.x + Math.cos(ang) * R, alt, P.z + Math.sin(ang) * R); g.rotation.set(0, yaw, tt > 0 && tt > 12 ? -0.12 : 0);
  const spin = (EV.evac === 2 || EV.evac === 3 || tt < 12) ? 34 : 28; HELI.rotor.rotation.y += dt * spin; HELI.tail.rotation.z += dt * 40;
  const low = alt < y0 + 6.2; HELI.beam.visible = low; if (low) { HELI.beam.position.set(g.position.x, alt + 0.2, g.position.z); HELI.beam.scale.set(0.6, alt - (EVC.PADH - 0.1) > 0.5 ? alt - (EVC.PADH - 0.1) : 0.5, 0.6); HELI.beam.material.opacity = 0.09 + 0.03 * Math.sin(EV.clock * 5); }
  const op = EV.evac === 2 ? 0.55 : 1; for (const m of g.userData.mats) m.opacity += (op - m.opacity) * Math.min(1, dt * 4);
  EV.heliS -= dt;                                          // стук винта
  if (EV.heliS <= 0 && soundOn()) { EV.heliS = 0.11; const dist = Math.hypot(g.position.x - CAM.x, g.position.z - CAM.z); tone({ f0: 85, f1: 58, dur: 0.1, vol: 0.14 * clamp(1 - dist / 70, 0.12, 1), type: 'square' }); }
}

/* ---- главный цикл событий ---- */
function eventsReset() {
  EV.clock = 0; EV.blackout = EV.alarm = EV.restored = false; EV.hold = 0; EV.flickT = 0; EV.sirenS = 0; EV.pressT = 0; EV.hasKey = false; EV.trap = false;
  EV.evac = 0; EV.board = 0; EV.lift = 0;
  if (EV.keyItem) { scene.remove(EV.keyItem.m); EV.keyItem = null; } EV.guard = null;
  const A = EVC.ARM, d = EVC.ARM_DOOR; EV.armGate = A ? (GATES.find(g => Math.abs(g.x1 - (A.x2 - 0.25 - 0.1)) < 0.4 && Math.abs(g.z1 - d[0]) < 0.4) || null) : null; if (EV.armGate) { EV.armGate.locked = true; EV.armGate.hp = EV.armGate.max = 600; }
  explRestore(); spawnLoot(); evGenLamp(false); meleeReset();
  evBar(null, null); const b = document.getElementById('evBanner'); if (b) b.style.opacity = 0;
}
function eventsTick(dt) {
  EV.clock += dt; moodTick(dt);
  explTick(dt);
  if (G.state === 'play' && !G.paused) {
    const t = G.t, al = alivePlayers();
    // сирена → тьма → генератор
    if (EVC.GEN && !EV.alarm && !EV.blackout && !EV.restored && t >= EVC.SIREN && t < EVC.DARK) { EV.alarm = true; evSay('ТРЕВОГА!', 'Сирена привлекает зомби. Скоро погаснет свет', '#ff6a5a'); spawnHorde(); }
    if (EVC.GEN && (EV.alarm || (!EV.blackout && !EV.restored)) && t >= EVC.DARK) { EV.alarm = false; EV.blackout = true; EV.hold = 0; evSay('СВЕТ ОТКЛЮЧЁН', 'Запусти генератор в котельной на северо-востоке — следуй за меткой', '#ffd040'); spawnHorde(); }
    if (EV.alarm) { EV.sirenS -= dt; if (EV.sirenS <= 0 && soundOn()) { EV.sirenS = 0.95; tone({ f0: 520, f1: 900, dur: 0.45, vol: 0.2, type: 'sawtooth' }); tone({ f0: 900, f1: 520, dur: 0.45, vol: 0.2, type: 'sawtooth', delay: 0.47 }); } }
    if (EV.blackout) {
      const G0 = EVC.GEN, near = al.filter(p => Math.hypot(p.x - G0.x, p.z - G0.z) < 2.8 && Math.abs(p.y - (G0.y || 0)) < 1.5).length;
      if (near) {
        EV.hold += dt; if (Math.random() < dt * 12) sparks(G0.x + rnd(-0.8, 0.8), (G0.y || 0) + 1.1, G0.z + rnd(-0.4, 0.4));
        EV.pressT -= dt; if (EV.pressT <= 0) { EV.pressT = 1.6; spawnZombie(); }
      } else EV.hold = Math.max(0, EV.hold - dt * 0.5);
      evGenLamp(near > 0); evBar('Запуск генератора', EV.hold > 0.05 ? EV.hold / EVC.HOLD : null);
      if (EV.hold >= EVC.HOLD) {
        EV.blackout = false; EV.restored = true; EV.flickT = 3; evBar(null, null); evGenLamp(true); SFX.pickup();
        evSay('СВЕТ ВЕРНУЛСЯ', 'Генератор запущен. Рядом лежит ящик с припасами', '#8fd46a');
        for (const [dx, dz] of [[-2.6, 3], [-3.4, 2], [-2, 4], [0, 4.2]]) if (!blocked(G0.x + dx, G0.z + dz, G0.y || 0, 0.5)) { spawnCrate(G0.x + dx, G0.z + dz, true, G0.y || 0); break; }
      }
    } else if (EV.restored) { if (EV.flickT > 0) EV.flickT -= dt; evGenLamp(true); }
    // охранник с ключ-картой
    if (EVC.ARM && !EV.guard && !EV.hasKey && !EV.keyItem && t >= EVC.GUARD_T) {
      const z = spawnZombie('armored', undefined, false, true);
      if (z) { z.hp *= 2.2; z.keyCarrier = true; EV.guard = z; evSay('ОХРАННИК ПО ТЮРЬМЕ', 'У него ключ-карта от оружейки на юге. Метка на радаре', '#ffb040'); }
    }
    if (EV.guard && EV.guard.dead && !EV.keyItem) {
      const z = EV.guard; EV.guard = null; const m = new THREE.Mesh(boxGeo, new THREE.MeshBasicMaterial({ color: 0xffe060, toneMapped: false })); m.scale.set(0.34, 0.05, 0.22); scene.add(m);
      EV.keyItem = { x: z.x, y: floorAt(z.x, z.z, 0.3), z: z.z, m, t: 0 }; evSay('КЛЮЧ-КАРТА ВЫПАЛА', 'Подбери её и открой оружейку на юге', '#ffe060');
    }
    if (EV.keyItem) {
      const K = EV.keyItem; K.t += dt; K.m.position.set(K.x, K.y + 0.35 + Math.sin(K.t * 3) * 0.06, K.z); K.m.rotation.y += dt * 2;
      const p = al.find(q => Math.hypot(q.x - K.x, q.z - K.z) < 0.9 && Math.abs(q.y - K.y) < 1.2);
      if (p) { EV.hasKey = true; scene.remove(K.m); EV.keyItem = null; SFX.pickup(); evSay('КЛЮЧ-КАРТА ПОЛУЧЕНА', 'Оружейка на юге у дороги — открой дверь (F / Y)', '#8fd46a'); }
    }
    // эвакуация
    if (!EVC.PADC && t >= RUN_TIME) endRun(true);                            // без вертолётной площадки — забег кончается на рассвете
    if (EVC.PADC && EV.evac === 0 && t >= EVC.CALL) { EV.evac = 1; evSay('ЭВАКУАЦИЯ', 'Вертолёт сядет на крышу администрации в конце ночи. Заберись на площадку и держись', '#60e890'); }
    if (EV.evac === 1 && t >= RUN_TIME) { EV.evac = 2; evSay('ВЕРТОЛЁТ САДИТСЯ!', 'Все на площадку — на борту 3 секунды. Он ждёт 2 минуты', '#60e890'); spawnHorde(); spawnHorde(); }
    if (EV.evac === 2) {
      const P = EVC.PADC, live = al.filter(p => !p.down), on = p => Math.abs(p.x - P.x) < P.hw && Math.abs(p.z - P.z) < P.hd && p.y > EVC.PADH - 1;
      if (live.length && live.every(on)) { EV.board += dt; evBar('Посадка на борт', EV.board / EVC.BOARD); } else { EV.board = Math.max(0, EV.board - dt * 2); evBar('Посадка на борт', EV.board > 0.05 ? EV.board / EVC.BOARD : null); }
      if (EV.board >= EVC.BOARD) { EV.evac = 3; evBar(null, null); endRun(true); }
      else if (t > RUN_TIME + EVC.LEAVE) { EV.evac = 4; evBar(null, null); endRun(false); $('overTitle').textContent = 'Вертолёт улетел без вас'; $('overKick').textContent = 'Эвакуация сорвана'; }
      else if (Math.floor(t) % 30 === 0 && Math.floor(t) !== EV.lastHorde) { EV.lastHorde = Math.floor(t); spawnHorde(); }
    }
  }
  if (EV.beacons) for (const b of EV.beacons) b.material.color.setHex(EV.evac >= 1 ? (Math.sin(EV.clock * 8) > 0 ? 0xff3030 : 0x501010) : 0x501010);
  heliTick(dt);
}
