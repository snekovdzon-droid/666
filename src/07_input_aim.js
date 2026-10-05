'use strict';
/* ---------- 10. Управление: клавиатура, мышь, палец, несколько геймпадов → «пульт» каждого игрока ---------- */
const keys = new Set(); const mouse = { x: 0, y: 0, down: false, has: false };
const act = { reload: false, reload2: false, slot: -1, slot2: -1, swap: false, swap2: false, slotT: -1, swapT: false, hook: false, hook2: false, hookT: false, alt: false, alt2: false, altT: false, melee: false, melee2: false, meleeT: false, fireT: false, sprintT: false };   // alt — подствольник   // + слоты предметов и «обменять»        // разовые нажатия за кадр: R (игрок 1 / один игрок), Enter (игрок на стрелках)
addEventListener('keydown', e => {
  if (G.state === 'editor') return;                  // редактор персонажа: клавиши (имя героя) игре не нужны
  if (e.code === 'Tab') e.preventDefault();
  keys.add(e.code);
  if (G.state === 'main') { mainKey(e.code); return; }
  if (G.state === 'mapedit') { edKey(e); return; }
  if (G.state === 'maps') { mapPickKey(e.code); return; }
  if (G.state === 'menu') { menuKey(e.code); return; }
  if (G.state === 'levelup') { lvKey(e.code); return; }
  if (G.state === 'end') { if (e.code === 'Enter' || e.code === 'Space') restartRun(); if (e.code === 'Escape') toMenu(); return; }
  if (e.code === 'KeyQ') rotCam(players.find(q => q.ctrl === 'kbm' || q.ctrl === 'all'), 1);
  if (e.code === 'KeyE') rotCam(players.find(q => q.ctrl === 'kbm' || q.ctrl === 'all'), -1);
  if (e.code === 'KeyN') G.nightT = G.nightT > 0.5 ? 0 : 1;
  if (e.code === 'KeyR') act.reload = true;
  if (e.code === 'Enter' || e.code === 'NumpadEnter') act.reload2 = true;
  if (e.code === 'Escape' || e.code === 'KeyP') G.paused = !G.paused;
  if (DBG.on && e.altKey && /^Digit[1-7]$/.test(e.code)) { e.preventDefault(); debugGun(MAIN_IDS[+e.code.slice(5) - 1]); return; }   // отладка: Alt+1–7 — ствол
  if (/^Digit[1-6]$/.test(e.code)) act.slot = +e.code.slice(5) - 1;                     // предметы: 1–6 (игрок на мыши)
  const k2 = ['Digit7', 'Digit8', 'Digit9', 'Digit0', 'Minus', 'Equal'].indexOf(e.code); if (k2 >= 0) act.slot2 = k2;   // игрок на стрелках: 7–0
  if (e.code === 'Quote') act.alt2 = true;
  if (e.code === 'KeyG') act.hook = true; if (e.code === 'Slash') act.hook2 = true;
  if (e.code === 'Space') { act.melee = true; e.preventDefault(); } if (e.code === 'Comma') act.melee2 = true;      // ближний бой      // крюк-кошка
  if (e.code === 'KeyF') act.swap = true; if (e.code === 'Period') act.swap2 = true;
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => { keys.clear(); mouse.down = false; });
addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; mouse.has = true; });
addEventListener('mousedown', e => { if (e.button === 0 && !e.target.closest('button,#menu,#dbg')) mouse.down = true; if (e.button === 2 && !e.target.closest('button,#menu,#dbg')) act.alt = true; });
addEventListener('mouseup', e => { if (e.button === 0) mouse.down = false; });
addEventListener('wheel', e => { CAM.zoomT = clamp(CAM.zoomT * (e.deltaY > 0 ? 1.12 : 0.89), ZMIN, 20); }, { passive: true });
addEventListener('contextmenu', e => e.preventDefault());
// Телефон: левая часть экрана — стик (двойной тап и держать — бег), стрельба сама по ближайшему
const ZMIN = IS_TOUCH ? 3.2 : 6;                  // ближе всего камера: на телефоне можно приблизить сильнее
const touch = { id: null, ox: 0, oy: 0, dx: 0, dy: 0, run: false, upT: -9 };
if (IS_TOUCH) {
  addEventListener('touchstart', e => { for (const t of e.changedTouches) if (touch.id === null && t.clientX < innerWidth * 0.6 && !t.target.closest('button,#menu,#dbg')) {
    touch.id = t.identifier; touch.ox = t.clientX; touch.oy = t.clientY; touch.dx = touch.dy = 0; touch.run = performance.now() - touch.upT < 320; } }, { passive: true });
  addEventListener('touchmove', e => { for (const t of e.changedTouches) if (t.identifier === touch.id) { touch.dx = clamp((t.clientX - touch.ox) / 50, -1, 1); touch.dy = clamp((t.clientY - touch.oy) / 50, -1, 1); } }, { passive: true });
  const end = e => { for (const t of e.changedTouches) if (t.identifier === touch.id) { touch.id = null; touch.dx = touch.dy = 0; touch.run = false; touch.upT = performance.now(); } };
  addEventListener('touchend', end); addEventListener('touchcancel', end);
  // щипок двумя пальцами (не стиком) — зум камеры
  const pinch = new Map(); let pinchD = 0;
  const pd = () => { const a = [...pinch.values()]; return a.length >= 2 ? Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) : 0; };
  addEventListener('touchstart', e => { for (const t of e.changedTouches) if (t.identifier !== touch.id && !t.target.closest('button,#menu,#dbg,#lvlUp')) pinch.set(t.identifier, { x: t.clientX, y: t.clientY }); pinchD = pd(); }, { passive: true });
  addEventListener('touchmove', e => { let ch = false; for (const t of e.changedTouches) if (pinch.has(t.identifier)) { pinch.set(t.identifier, { x: t.clientX, y: t.clientY }); ch = true; }
    if (ch && pinch.size >= 2) { const d = pd(); if (pinchD > 0 && d > 0) CAM.zoomT = clamp(CAM.zoomT * pinchD / d, ZMIN, 20); pinchD = d; } }, { passive: true });
  const pend = e => { for (const t of e.changedTouches) pinch.delete(t.identifier); pinchD = pd(); };
  addEventListener('touchend', pend); addEventListener('touchcancel', pend);
}
// Кнопки на телефоне, пока зажаты: огонь (авто-огня нет, авто-прицел остаётся) и бег
function holdBtn(id, key) { const el = document.getElementById(id), ids = new Set(), upd = () => { act[key] = ids.size > 0; el.classList.toggle('on', act[key]); };
  el.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); for (const t of e.changedTouches) ids.add(t.identifier); upd(); }, { passive: false });
  const fe = e => { e.stopPropagation(); for (const t of e.changedTouches) ids.delete(t.identifier); upd(); };
  el.addEventListener('touchend', fe); el.addEventListener('touchcancel', fe); }
if (IS_TOUCH) { holdBtn('fireBtn', 'fireT'); holdBtn('sprintBtn', 'sprintT'); }
// Полный экран (телефон: убрать адресную строку). iPhone в Safari не умеет — подсказка «На экран Домой»
function goFullscreen(force) {
  const d = document.documentElement, on = document.fullscreenElement || document.webkitFullscreenElement;
  if (on && force !== true) { (document.exitFullscreen || document.webkitExitFullscreen || (() => {})).call(document); return; }
  if (on) return;
  const req = d.requestFullscreen || d.webkitRequestFullscreen;
  if (!req) { if (force !== true) alert('Этот браузер не умеет полный экран. На iPhone: «Поделиться» → «На экран Домой» — игра откроется без адресной строки.'); return; }
  try { const r = req.call(d, { navigationUI: 'hide' }); if (r && r.then) r.then(() => { try { screen.orientation.lock('landscape').catch(() => {}); } catch (e) {} }).catch(() => {}); } catch (e) {}
}
document.querySelectorAll('[data-k]').forEach(b => b.addEventListener('click', ev => { ev.stopPropagation(); const k = b.dataset.k;
  if (k === 'ql') CAM.yawT += Math.PI / 2; if (k === 'qr') CAM.yawT -= Math.PI / 2; if (k === 'n') G.nightT = G.nightT > 0.5 ? 0 : 1;
  if (k === 'zi') CAM.zoomT = clamp(CAM.zoomT * 0.85, ZMIN, 20); if (k === 'zo') CAM.zoomT = clamp(CAM.zoomT * 1.18, ZMIN, 20); if (k === 'r') act.reload = true; if (k === 'fs') goFullscreen(); }));

// Геймпады: у каждого своё состояние. Кнопки: RT огонь, R3 ближний бой, X перезарядка, L3 или B бег, LB/RB камера (любой игрок),
// Back крюк-кошка, Start пауза (ночь — только клавиша N). В меню: крестовина/стик — выбор, A — дальше, Y — число игроков.
const PADS = new Map();                                // индекс геймпада → { lx, ly, rx, ry, pr[], just[], gp }
const PAD = { active: false, navT: 0 };                // active — последний ввод был с геймпада (для одиночной игры)
function pollPad(dt) {
  const list = navigator.getGamepads ? navigator.getGamepads() : [];
  const seen = new Set();
  for (const gp of list) {
    if (!gp || !gp.connected) continue;
    seen.add(gp.index);
    let s = PADS.get(gp.index); if (!s) PADS.set(gp.index, s = { pr: [], just: [] });
    const dz = v => Math.abs(v) < 0.18 ? 0 : v;
    const pr = gp.buttons.map(b => !!b.pressed);
    s.just = pr.map((v, i) => v && !s.pr[i]); s.pr = pr; s.gp = gp;
    s.lx = dz(gp.axes[0] || 0); s.ly = dz(gp.axes[1] || 0); s.rx = dz(gp.axes[2] || 0); s.ry = dz(gp.axes[3] || 0);
    s.fire = pr[7] || (gp.buttons[7] && gp.buttons[7].value > 0.3);
    if (s.lx || s.ly || s.rx || s.ry || pr.some(Boolean)) PAD.active = true;
  }
  for (const k of [...PADS.keys()]) if (!seen.has(k)) PADS.delete(k);
  const any = i => [...PADS.values()].some(s => s.just[i]);
  if (G.state === 'main' || G.state === 'menu' || G.state === 'maps' || G.state === 'end' || G.state === 'levelup') {
    PAD.navT -= dt;
    let h = 0, v = 0;
    for (const s of PADS.values()) {
      if (s.just[15] || (s.lx > 0.5 && PAD.navT <= 0)) h = 1; if (s.just[14] || (s.lx < -0.5 && PAD.navT <= 0)) h = -1;
      if (s.just[13] || (s.ly > 0.5 && PAD.navT <= 0)) v = 1; if (s.just[12] || (s.ly < -0.5 && PAD.navT <= 0)) v = -1;
    }
    if (h || v) PAD.navT = 0.25;
    if (G.state === 'levelup') { if (h || v) lvKey((h || v) > 0 ? 'ArrowRight' : 'ArrowLeft'); if (any(0)) lvKey('Enter'); }
    else if (G.state === 'main') { if (v) mainKey(v > 0 ? 'ArrowDown' : 'ArrowUp'); if (any(0) || any(9)) mainKey('Enter'); if (any(1)) mainKey('Escape'); }
    else if (G.state === 'menu') { if (h) menuKey(h > 0 ? 'ArrowRight' : 'ArrowLeft'); if (v) menuKey(v > 0 ? 'ArrowDown' : 'ArrowUp'); if (any(0) || any(9)) menuKey('Enter'); if (any(3)) menuKey('Tab'); if (any(1)) menuKey('Backspace'); }
    else if (G.state === 'maps') { if (v) mapPickKey(v > 0 ? 'ArrowDown' : 'ArrowUp'); if (any(0) || any(9)) mapPickKey('Enter'); if (any(1)) mapPickKey('Escape'); }
    else { if (any(0) || any(9)) restartRun(); if (any(1)) toMenu(); }
  } else {
    for (const [gi, s] of PADS) { const own = players.find(q => (q.ctrl === 'pad' && q.pad === gi) || q.ctrl === 'all'); if (s.just[4]) rotCam(own, 1); if (s.just[5]) rotCam(own, -1); }   // у каждого геймпада — свой экран
    if (any(9)) G.paused = !G.paused;
  }
}
function padOf(p) { return p.ctrl === 'pad' ? PADS.get(p.pad) : p.ctrl === 'all' && PAD.active ? [...PADS.values()][0] : null; }
function rumble(p, s = 0.6, ms = 120) {
  const P = padOf(p); if (!P || !P.gp || !P.gp.vibrationActuator) return;
  try { P.gp.vibrationActuator.playEffect('dual-rumble', { duration: ms, strongMagnitude: s, weakMagnitude: s * 0.6 }); } catch (e) {}
}
addEventListener('mousemove', () => { PAD.active = false; });
addEventListener('keydown', () => { PAD.active = false; });
// экранное направление → мировое (с учётом поворота камеры)
function screenToWorld(ix, iz, yaw = CAM.yaw) { const cy = Math.cos(yaw), sy = Math.sin(yaw); return [ix * cy + iz * sy, -ix * sy + iz * cy]; }
// Кто чем управляет: 1 игрок — всё сразу; в коопе — геймпады, а если их не хватает — клавиатура+мышь и стрелки
function assignControls(n) {
  if (n === 1) return [{ ctrl: 'all' }];
  const pads = [...PADS.keys()].sort((a, b) => a - b), out = [];
  if (pads.length >= n) return pads.slice(0, n).map(i => ({ ctrl: 'pad', pad: i }));
  out.push({ ctrl: 'kbm' });
  if (pads.length < n - 1) out.push({ ctrl: 'keys2' });
  for (const i of pads) if (out.length < n) out.push({ ctrl: 'pad', pad: i });
  return out;
}
const maxPlayers = () => IS_TOUCH ? 1 : Math.min(4, 2 + PADS.size);
const CTRL_NAME = { all: 'всё сразу', kbm: 'WASD + мышь, Shift — бег, R — перезарядка, 1–4 — предметы, F — обменять', keys2: 'стрелки, автоприцел, правый Ctrl — бег, Enter — перезарядка, 7–0 — предметы, «.» — обменять', pad: 'геймпад (крестовина — предметы, Y — обменять/к стволу)' };
// «Пульт» игрока на этот кадр
function readControl(p) {
  let ix = 0, iz = 0, sprint = false, fire = false, reload = false, auto = true, manual = false, aim = null, slot = -1, swap = false, back = false, hook = false, alt = false, melee = false;
  const K = (a, b, c, d) => { if (keys.has(a)) ix -= 1; if (keys.has(b)) ix += 1; if (keys.has(c)) iz -= 1; if (keys.has(d)) iz += 1; };
  const t = p.ctrl;
  if (t === 'all' || t === 'kbm') { K('KeyA', 'KeyD', 'KeyW', 'KeyS'); sprint = keys.has('ShiftLeft') || (t === 'all' && keys.has('ShiftRight')); reload = act.reload; slot = act.slot; swap = act.swap; hook = act.hook; alt = act.alt;
    if (!IS_TOUCH && mouse.has && !(t === 'all' && PAD.active)) { auto = false; fire = mouse.down; } }
  if (t === 'all' || t === 'keys2') { K('ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown');
    if (t === 'keys2') { sprint = keys.has('ControlRight') || keys.has('ShiftRight'); reload = act.reload2; slot = act.slot2; swap = act.swap2; hook = act.hook2; alt = act.alt2; } }
  if (t === 'all' && act.hookT) hook = true;
  if ((t === 'all' || t === 'kbm') && act.melee) melee = true; if (t === 'keys2' && act.melee2) melee = true; if (t === 'all' && act.meleeT) melee = true;
  if (t === 'all' && act.altT) alt = true;
  if (t === 'all' && (act.slotT >= 0 || act.swapT)) { if (act.slotT >= 0) slot = act.slotT; if (act.swapT) swap = true; }   // кнопки на экране
  if (t === 'all' && touch.id !== null) { ix = touch.dx; iz = touch.dy; sprint = touch.run; }
  if (t === 'all' && act.sprintT) sprint = true;                      // кнопка бега на телефоне
  const pads = t === 'pad' ? [PADS.get(p.pad)] : t === 'all' && PAD.active ? [...PADS.values()] : [];
  for (const s of pads) {
    if (!s) continue;
    ix += s.lx; iz += s.ly;                                              // крестовина больше не двигает героя — на ней предметы
    const dp = [12, 15, 13, 14].findIndex(b => s.just[b]); if (dp >= 0) slot = dp;   // ↑ → ↓ ← — слоты 1–4
    if (s.just[3]) { swap = true; back = true; }                           // Y — обменять / обратно к стволу / листать слоты
    if (s.just[8]) hook = true;                                            // Back/Select — крюк-кошка (не A: на A берут карточки уровня)
    if (s.just[11]) melee = true;                                          // R3 — ближний бой
    if (s.just[6]) alt = true;                                           // LT — подствольник
    if (s.just[2]) reload = true; if (s.pr[10] || s.pr[1]) sprint = true;
    manual = true; auto = true; fire = fire || s.fire;
    if (Math.hypot(s.rx, s.ry) > 0.35) { const [wx, wz] = screenToWorld(s.rx, s.ry, yawOf(p)), l = Math.hypot(wx, wz); aim = [wx / l, wz / l]; }
  }
  const l = Math.hypot(ix, iz); if (l > 1) { ix /= l; iz /= l; }
  const [wx, wz] = screenToWorld(ix, iz, yawOf(p));
  return { wx, wz, move: Math.min(1, l), sprint, auto, manual, fire: IS_TOUCH && t === 'all' ? act.fireT : fire, touchBtn: IS_TOUCH && t === 'all', reload, aim, pad: manual, slot, swap, back, hook, alt, melee };
}

/* ---------- 11. Прицел: луч из-под курсора в мир / автоприцел ---------- */
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
const zAimY = z => z.y + (z.form === 'crawl' ? 0.3 : z.form === 'hound' ? 0.28 : z.form === 'fat' ? 0.75 : isVoxZ(z) ? VZ.H * 0.6 : 0.65);
const AIM_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), _aimV = new THREE.Vector3();
// Возвращает { pt, target }: точку прицела и зомби под прицелом (если есть)
function aimPoint(p, c) {
  if (c.auto) {                                          // автоприцел: телефон, геймпад, ПК без мыши
    let best = null, bd = 1e9, dir = null;
    if (c.aim) dir = c.aim;                             // правый стик геймпада
    const range = c.pad ? 10 : CFG.AUTO_AIM_RANGE;
    forNear(p.x, p.z, z => {
      if (z.dead || z.swell) return; const dx = z.x - p.x, dz = z.z - p.z, d = Math.hypot(dx, dz); if (d > range) return;
      if (SMOKES.length && inSmoke(z)) return;                          // сквозь дым автоприцел не берёт
      let score = d + Math.abs(z.y - p.y) * 2;
      if (dir) { const cc = (dx * dir[0] + dz * dir[1]) / (d || 1); if (cc < 0.75) return; score = d * (2 - cc); }   // в конусе ±40° от стика
      if (score < bd) { bd = score; best = z; }
    }, range);
    if (best) return { pt: new THREE.Vector3(best.x, zAimY(best), best.z), target: best };
    if (dir) return { pt: new THREE.Vector3(p.x + dir[0] * 6, p.y + 0.7, p.z + dir[1] * 6), target: null };   // никого — стреляем по стику
    return { pt: null, target: null };
  }
  let nx = mouse.x / innerWidth * 2 - 1, ny = -(mouse.y / innerHeight) * 2 + 1;
  const V = SPLIT.on ? viewFor(p) : null;                // раздельный экран: курсор считается внутри своей половины
  if (V) { placeViewCam(V); nx = clamp((mouse.x - V.rect.x) / V.rect.w * 2 - 1, -1, 1); ny = clamp(-((mouse.y - V.rect.y) / V.rect.h) * 2 + 1, -1, 1); }
  ndc.set(nx, ny);
  ray.setFromCamera(ndc, cam);
  // курсор на зомби — целимся в него
  let best = null, bt = 1e9;
  const o = ray.ray.origin, rd = ray.ray.direction;
  for (const z of zombies) {
    if (z.dead || z.swell) continue; _v.set(z.x, zAimY(z), z.z);
    const along = (_v.x - o.x) * rd.x + (_v.y - o.y) * rd.y + (_v.z - o.z) * rd.z;
    const qx = o.x + rd.x * along - _v.x, qy = o.y + rd.y * along - _v.y, qz = o.z + rd.z * along - _v.z;
    if (qx * qx + qy * qy + qz * qz < 0.25 && along < bt) { bt = along; best = z; }
  }
  if (best) return { pt: new THREE.Vector3(best.x, zAimY(best), best.z), target: best };
  // курсор не на зомби: целимся в плоскость на уровне ног героя (на крыше и лестнице — своя), а не в первую попавшуюся стену или край крыши —
  // от неё считался угол наклона, из-за этого ЛЦУ и пули на зданиях улетали вверх и вниз
  AIM_PLANE.constant = -p.y;
  const hit = ray.ray.intersectPlane(AIM_PLANE, _aimV);
  if (hit) return { pt: new THREE.Vector3(hit.x, p.y + 0.6, hit.z), target: null };
  return { pt: null, target: null };
}
const groundHit = new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ visible: false }));
groundHit.position.set(MAP / 2, 0, MAP / 2); scene.add(groundHit);
