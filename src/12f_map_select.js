'use strict';
/* ---------- v0.30: выбор карты списком (после класса), свои карты и редактор карты (ПК) ---------- */
const BASE_MAPS = [
  { id: 'prison', name: 'Тюрьма', size: 96, info: 'Корпуса, дворы с воротами, карцер и оружейка. Вертолёт на крыше администрации' },
  { id: 'city', name: 'Город', size: 128, info: 'Тесные улицы, много крыш с мостами и лестницами. Вертолёт на центральной башне' },
];
const customMaps = () => lsGet('cmaps', []);
const allMaps = () => BASE_MAPS.concat(customMaps().map(m => ({ id: 'c:' + m.id, name: m.name, size: m.size, info: 'Своя карта', custom: true })));
const $m = id => document.getElementById(id);
MAP_OPS.zone = () => {}; MAP_OPS.crate = () => {};                 // служебные «операции» редактора: покрытие и ящики собираются в данные карты заранее

/* ---- вёрстка ---- */
{
  const st = document.createElement('style');
  st.textContent = `
  #mapLoad{position:fixed;inset:0;z-index:50;background:#0e0b08;color:#e8dcc0;display:flex;align-items:center;justify-content:center;font-size:22px;letter-spacing:3px}
  #mapPick{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(10,8,6,.9);z-index:8;flex-direction:column;color:#e8dcc0}
  #mapPick h2{margin:0 0 6px;letter-spacing:4px;font-size:clamp(22px,4vw,34px);text-transform:uppercase}#mapPick .sub{opacity:.7;font-size:13px;margin-bottom:14px}
  #mpList{display:flex;flex-direction:column;gap:8px;width:min(620px,92vw);max-height:62vh;overflow:auto}
  .mp{display:grid;grid-template-columns:1fr auto;gap:2px 12px;text-align:left;font:inherit;padding:12px 16px;border:0;border-left:4px solid #4a4032;background:rgba(24,19,14,.9);color:#d8d0bc;cursor:pointer}
  .mp b{font-size:19px;letter-spacing:1px}.mp small{opacity:.7;align-self:center}.mp span{grid-column:1/3;font-size:12.5px;opacity:.75}
  .mp.sel,.mp:hover{border-left-color:#ffb040;background:rgba(48,36,22,.95);color:#fff}
  #mpBack{margin-top:14px;font:inherit;padding:9px 20px;border:1px solid #4a4032;background:transparent;color:#d8d0bc;cursor:pointer}
  #mapEd{position:fixed;inset:0;display:none;flex-direction:column;background:#14110e;color:#e8dcc0;z-index:20;font-size:13px;user-select:none}
  #meTop{display:flex;align-items:center;gap:6px;padding:6px 8px;background:#1f1a14;border-bottom:1px solid #3a3025;flex-wrap:wrap}
  #meTop button,#meSide button,#meSide select{font:inherit;color:#e8dcc0;background:#2a2218;border:1px solid #4a3c2a;padding:6px 10px;cursor:pointer}
  #meTop button:hover,#meSide button:hover{background:#3a2e1e}#meTop button:disabled{opacity:.35;cursor:default}
  #meName{margin:0 10px;font-weight:700;letter-spacing:1px;color:#ffd890}#meTop .sp{flex:1}
  #meBody{flex:1;display:flex;min-height:0}#meSide{width:178px;padding:8px;background:#1b1611;border-right:1px solid #3a3025;overflow:auto;display:flex;flex-direction:column;gap:4px}
  #meSide button{text-align:left}#meSide button.on{background:#5a3a1a;border-color:#ffb040;color:#fff}
  #meSide .hd{font-size:10.5px;letter-spacing:2px;color:#8a806c;margin:8px 0 2px}#meSide .opt{display:flex;gap:4px;flex-wrap:wrap}#meSide .opt button{padding:4px 8px}
  #meCvW{flex:1;position:relative;min-width:0}#meCv{position:absolute;inset:0;width:100%;height:100%;cursor:crosshair}
  #meInfo{padding:4px 10px;background:#1f1a14;border-top:1px solid #3a3025;color:#a89a80;display:flex;gap:16px}
  #meSide .help{font-size:11.5px;color:#8a806c;line-height:1.45;margin-top:8px}`;
  document.head.appendChild(st);
  const mp = document.createElement('div'); mp.id = 'mapPick';
  mp.innerHTML = '<h2>Выбор карты</h2><div class="sub" id="mpWho"></div><div id="mpList"></div><button id="mpBack">← К выбору класса</button>';
  document.body.appendChild(mp);
  const ed = document.createElement('div'); ed.id = 'mapEd';
  ed.innerHTML = `<div id="meTop"><button id="meExit">← Выйти</button><span id="meName"></span><button id="meUndo">⟲ Отменить</button><button id="meRedo">⟳ Вернуть</button><span class="sp"></span>
    <button id="meCopy">Копировать код</button><button id="mePaste">Вставить код</button><button id="meReset">Сбросить правки</button><button id="mePlay">▶ Играть</button></div>
    <div id="meBody"><div id="meSide"></div><div id="meCvW"><canvas id="meCv"></canvas></div></div><div id="meInfo"><span id="meCoord"></span><span id="meHint"></span><span id="meCount"></span></div>`;
  document.body.appendChild(ed);
  $m('mpBack').onclick = () => mapPickKey('Escape');
}

/* ---- запуск на выбранной карте: если карта другая — запоминаем настройки забега, перезагружаем страницу и стартуем сами ---- */
function showLoadingFx(txt) { if ($m('mapLoad')) return; const el = document.createElement('div'); el.id = 'mapLoad'; el.textContent = txt; document.body.appendChild(el); }
function launchOnMap(id) {
  $m('mapPick').style.display = 'none';
  if (id === MAPID) { startRun(); return; }
  try { sessionStorage.setItem('zsv_pending', JSON.stringify({ run: true, n: G.nPlayers, guns: G.guns.slice(), split: !!G.split })); } catch (e) {}
  lsSet('map', id); showLoadingFx('Загрузка карты…'); setTimeout(() => location.reload(), 40);
}
function bootPending() {
  let p = null; try { p = JSON.parse(sessionStorage.getItem('zsv_pending')); sessionStorage.removeItem('zsv_pending'); } catch (e) {}
  if (!p) return;
  if (p.editor) { openEditor(); return; }
  if (p.run) { G.nPlayers = p.n || 1; if (p.guns && p.guns.length) G.guns = p.guns; G.gun = G.guns[0]; G.split = !!p.split; startRun(); }
}
const MP = { sel: 0, list: [] };
function openMapPick() {
  MP.list = allMaps(); MP.sel = Math.max(0, MP.list.findIndex(m => m.id === MAPID));
  G.state = 'maps'; showScreen('maps'); $m('mapPick').style.display = 'flex';
  $m('mpWho').textContent = G.nPlayers > 1 ? `Игроков: ${G.nPlayers}` : 'Одиночная игра';
  renderMapPick();
}
function renderMapPick() {
  const el = $m('mpList');
  el.innerHTML = MP.list.map((m, i) => `<button class="mp${i === MP.sel ? ' sel' : ''}" data-i="${i}"><b>${m.name}</b><small>${m.size}×${m.size}${m.id === MAPID ? ' · сейчас загружена' : ''}</small><span>${m.info}</span></button>`).join('');
  el.querySelectorAll('button').forEach(b => { b.onclick = e => { e.stopPropagation(); MP.sel = +b.dataset.i; launchOnMap(MP.list[MP.sel].id); }; b.onmouseenter = () => { MP.sel = +b.dataset.i; markMapPick(); }; });
}
function markMapPick() { $m('mpList').querySelectorAll('.mp').forEach((b, i) => b.classList.toggle('sel', i === MP.sel)); const s = $m('mpList').querySelector('.mp.sel'); if (s && s.scrollIntoView) s.scrollIntoView({ block: 'nearest' }); }
function mapPickKey(code) {
  if (code === 'ArrowDown' || code === 'KeyS') MP.sel = (MP.sel + 1) % MP.list.length;
  else if (code === 'ArrowUp' || code === 'KeyW') MP.sel = (MP.sel + MP.list.length - 1) % MP.list.length;
  else if (code === 'Enter' || code === 'Space' || code === 'NumpadEnter') { launchOnMap(MP.list[MP.sel].id); return; }
  else if (code === 'Escape' || code === 'Backspace') { $m('mapPick').style.display = 'none'; G.state = 'menu'; showScreen('menu'); G.pick = Math.max(0, G.nPlayers - 1); menuSel = Math.max(0, MAIN_IDS.indexOf(G.guns[G.pick])); menuMark(); return; }
  else return;
  markMapPick(); SFX.click();
}

/* ---- меню «Редактор карты»: выбор карты для правки, создание и удаление своих ---- */
function mapEditPanelHtml() {
  const c = customMaps();
  return `<h3>Редактор карты</h3><p style="opacity:.7;font-size:12px;margin:0 0 8px">Правки хранятся поверх карты — их можно сбросить. Только для компьютера.</p>
    <button data-s="ed:prison">Тюрьма — править</button><button data-s="ed:city">Город — править</button>`
    + c.map(m => `<div style="display:flex;gap:4px"><button data-s="ed:c:${m.id}" style="flex:1">${m.name} (${m.size}×${m.size}) — править</button><button data-s="delmap:${m.id}" title="Удалить карту" style="width:44px">✕</button></div>`).join('')
    + `<p style="opacity:.7;font-size:12px;margin:10px 0 4px">Создать новую (пустую):</p>
    <button data-s="newmap:64">Маленькая 64×64</button><button data-s="newmap:96">Средняя 96×96</button><button data-s="newmap:128">Большая 128×128</button><button data-s="back">← Назад</button>`;
}
function mapEditAction(s) {
  if (s.startsWith('ed:')) startEditorFor(s.slice(3));
  else if (s.startsWith('newmap:')) {
    const size = +s.slice(7), name = prompt('Название карты', 'Моя карта ' + (customMaps().length + 1)); if (!name) return;
    startEditorFor('c:' + createCustomMap(size, name.trim().slice(0, 30) || 'Моя карта'));
  } else if (s.startsWith('delmap:')) {
    const id = s.slice(7); if (!confirm('Удалить эту карту насовсем?')) return;
    lsSet('cmaps', customMaps().filter(m => m.id !== id)); try { localStorage.removeItem('zsv_cmap_' + id); } catch (e) {}
    if (MAPID === 'c:' + id) lsSet('map', 'prison');
    mmPanel('mapedit');
  }
}
function createCustomMap(size, name, ov) {
  const id = Date.now().toString(36) + Math.floor(Math.random() * 99);
  const list = customMaps(); list.push({ id, name, size }); lsSet('cmaps', list); lsSet('cmap_' + id, { id, name, size, ov: ov || {} }); return id;
}
function startEditorFor(id) {
  if (id === MAPID) { openEditor(); return; }
  try { sessionStorage.setItem('zsv_pending', JSON.stringify({ editor: true })); } catch (e) {}
  lsSet('map', id); showLoadingFx('Загрузка карты…'); setTimeout(() => location.reload(), 40);
}

/* ================= Редактор карты ================= */
const EDM = { added: [], removed: new Set(), removedCrates: new Set(), start: null, events: {}, undo: [], redo: [], changed: false, nid: 1, foot: new Map(), cache: null, init: false };
const EDV = { cx: 0, cz: 0, s: 6 };
const EDO = { floors: 1, zone: 'asphalt', rot: false, tool: 'erase' };
const MEd = { mouse: null, drag: null, pan: null, hover: null };
const EDCOL = { block: '#d2b078', cbuild: '#d2b078', shed: '#b8a070', wall: '#c4bcac', fenceX: '#6cc4f0', fenceZ: '#6cc4f0', gate: '#ffb030', car: '#8ab0e0', barrel: '#d86a44', xbarrel: '#ff5a20', lamp: '#fff090', tree: '#58c058', bush: '#78d060', cone: '#ffa030', bench: '#b88a58', trashbin: '#7a8a6a', trashbag: '#3a3a3a', crate: '#e8b860', ladder: '#ffffff', generator: '#60ff80', helipad: '#40ffa0', post: '#9aa0a0', tank: '#e0c030', xtank: '#ffc020' };
const EDZ = { asphalt: '#2c2a28', road: '#36342f', paving: '#5e5a52', grass: '#44602e', gravel: '#6a645a', dark: '#4a4642', court: '#2e5878', dirt: '#6a4a30' };
const EDZN = { asphalt: 'Асфальт', paving: 'Бетон', grass: 'Трава', gravel: 'Гравий', dark: 'Тёмная земля', court: 'Площадка', road: 'Дорога', dirt: 'Грунт' };
const BLOCK_COLS = [0xc8b8a0, 0xbcac94, 0xb4a48a, 0xc0b098, 0xa8a294, 0xd0c4ac, 0xb0a08a];
const CAR_COLS = [0x3e5270, 0x8c3a30, 0x60707e, 0x6e7a50, 0xc8c4ba, 0x8a8a3a];
const EDTOOLS = [
  ['erase', 'Ластик', 'Клик по объекту — удалить'], ['fence', 'Забор', 'Тяни линию: сетка-рабица'], ['wall', 'Стена', 'Тяни линию: бетонная стена'], ['gate', 'Ворота', 'Тяни линию по забору: ворота (открывает игрок)'],
  ['block', 'Здание', 'Тяни прямоугольник: здание с лестницей на крышу (если влезет)'], ['shed', 'Сарай', 'Тяни прямоугольник: стены с открытой южной стороной'], ['zone', 'Покрытие', 'Тяни прямоугольник: асфальт, трава и т.д.'],
  ['car', 'Машина', 'Клик: машина (R — повернуть)'], ['barrel', 'Бочка', 'Клик'], ['xbarrel', 'Взрывная бочка', 'Клик'], ['lamp', 'Фонарь', 'Клик'], ['tree', 'Дерево', 'Клик'], ['bush', 'Куст', 'Клик'], ['cone', 'Конус', 'Клик'], ['bench', 'Скамейка', 'Клик'], ['trashbin', 'Мусорный бак', 'Клик (R — повернуть)'], ['trashbag', 'Мешки с мусором', 'Клик'],
  ['crate', 'Ящик (точка)', 'Клик: здесь будут появляться ящики'], ['ladder', 'Лестница верт.', 'Клик у стены здания: вертикальная лестница на крышу'], ['start', 'Старт игроков', 'Клик: где начинается забег'],
  ['gen', 'Генератор', 'Клик: генератор для события «Свет отключён»'], ['pad', 'Вертолётная площадка', 'Клик внутри здания (от 10×8): вертолёт-эвакуация'],
];
const edSn = v => Math.round(v * 2) / 2;
const edCl = (v, a, b) => Math.max(a, Math.min(b, v));

function edInit() {
  if (EDM.init) return; EDM.init = true;
  EDM.removed = new Set(OV.removed || []); EDM.removedCrates = new Set(OV.removedCrates || []);
  EDM.added = (OV.added || []).map(op => ({ id: EDM.nid++, op: op.slice() }));
  let k = 0; EDM.foot = new Map();
  BASE_DEF.ops.forEach((op, bi) => { if (!EDM.removed.has(bi)) EDM.foot.set('b' + bi, (window.EDFOOT || [])[k++]); });
  EDM.added.forEach(a => { if (a.op[0] !== 'zone' && a.op[0] !== 'crate') EDM.foot.set('a' + a.id, (window.EDFOOT || [])[k++]); });
  EDM.start = OV.start ? Object.assign({}, OV.start) : null; EDM.events = Object.assign({}, OV.events || {});
}
function edBounds(op) {
  const k = op[0], a = op.slice(1), r = (x1, z1, x2, z2, h = 1) => ({ x1: Math.min(x1, x2), z1: Math.min(z1, z2), x2: Math.max(x1, x2), z2: Math.max(z1, z2), h });
  switch (k) {
    case 'block': return r(a[0], a[1], a[2], a[3], a[4] * 2.6); case 'shed': return r(a[0], a[1], a[2], a[3], (a[4] && a[4].h) || 3);
    case 'cbuild': return r(a[0], a[1], a[2], a[3], a[4] * 2.6); case 'wall': return r(a[0], a[1], a[2], a[3], 3);
    case 'fenceX': return r(a[0], a[2] - 0.15, a[1], a[2] + 0.15, 2); case 'fenceZ': return r(a[2] - 0.15, a[0], a[2] + 0.15, a[1], 2);
    case 'gate': return r(a[0] - 0.2, a[1] - 0.2, a[2] + 0.2, a[3] + 0.2, 2); case 'zone': return r(a[1], a[2], a[3], a[4], 0);
    case 'car': return a[2] ? r(a[0], a[1], a[0] + 3.2, a[1] + 1.5) : r(a[0], a[1], a[0] + 1.5, a[1] + 3.2);
    case 'bridge': return r(a[0], a[2], a[1], a[3]);
    case 'helipad': { const P = EVC.PADC; return P ? r(P.x - P.hw, P.z - P.hd, P.x + P.hw, P.z + P.hd, 5) : r(0, 0, 0.1, 0.1, 0); }
    default: return r(a[0] - 0.3, a[1] - 0.3, a[0] + 0.3, a[1] + 0.3);
  }
}
function edItems() {
  if (EDM.cache) return EDM.cache;
  const items = [];
  BASE_DEF.ops.forEach((op, bi) => { if (!EDM.removed.has(bi)) items.push({ key: 'b' + bi, kind: 'op', base: bi, op }); });
  EDM.added.forEach(a => items.push({ key: 'a' + a.id, kind: a.op[0] === 'zone' ? 'zone' : a.op[0] === 'crate' ? 'crate' : 'op', id: a.id, op: a.op }));
  (BASE_DEF.crates || []).forEach((c, ci) => { if (!EDM.removedCrates.has(ci)) items.push({ key: 'c' + ci, kind: 'crate', crate: ci, op: ['crate', c[0], c[1], c[2] || 0] }); });
  for (const it of items) {
    const f = it.kind === 'op' ? EDM.foot.get(it.key) : null;
    it.rects = f && f.length ? f.map(r => ({ x1: r[0], z1: r[1], x2: r[2], z2: r[3], h: r[4] })) : [edBounds(it.op)];
    let x1 = 1e9, z1 = 1e9, x2 = -1e9, z2 = -1e9; for (const r of it.rects) { x1 = Math.min(x1, r.x1); z1 = Math.min(z1, r.z1); x2 = Math.max(x2, r.x2); z2 = Math.max(z2, r.z2); }
    it.box = { x1, z1, x2, z2 }; it.area = Math.max(0.2, (x2 - x1) * (z2 - z1));
  }
  return (EDM.cache = items);
}
function mePick(x, z) {
  const m = Math.max(0.25, 7 / EDV.s); let best = null;
  for (const it of edItems()) {
    if (it.box.x1 - m > x || it.box.x2 + m < x || it.box.z1 - m > z || it.box.z2 + m < z) continue;
    let hit = false; for (const r of it.rects) if (x >= r.x1 - m && x <= r.x2 + m && z >= r.z1 - m && z <= r.z2 + m) { hit = true; break; }
    if (!hit) continue;
    const pr = it.kind === 'zone' ? 1e6 : it.area;                                  // мелкое выбирается раньше крупного, покрытие — в последнюю очередь
    if (!best || pr < best.pr) best = { it, pr };
  }
  return best && best.it;
}

/* ---- команды (отмена / возврат) ---- */
function edAfter() { EDM.cache = null; EDM.changed = true; edSave(); edButtons(); edDraw(); }
function edExec(cmd) { cmd.do(); EDM.undo.push(cmd); EDM.redo.length = 0; edAfter(); }
function edUndo() { const c = EDM.undo.pop(); if (!c) return; c.undo(); EDM.redo.push(c); edAfter(); SFX.click(); }
function edRedo() { const c = EDM.redo.pop(); if (!c) return; c.do(); EDM.undo.push(c); edAfter(); SFX.click(); }
const cmdGroup = list => ({ do: () => list.forEach(c => c.do()), undo: () => list.slice().reverse().forEach(c => c.undo()) });
function cmdAdd(op) { const a = { id: EDM.nid++, op }; return { do: () => { EDM.added.push(a); }, undo: () => { const i = EDM.added.indexOf(a); if (i >= 0) EDM.added.splice(i, 1); } }; }
function cmdSetEv(key, val) { let prev, had; return { do: () => { had = key in EDM.events; prev = EDM.events[key]; EDM.events[key] = val; }, undo: () => { if (had) EDM.events[key] = prev; else delete EDM.events[key]; } }; }
function cmdStart(p) { let prev; return { do: () => { prev = EDM.start; EDM.start = p; }, undo: () => { EDM.start = prev; } }; }
function cmdDel(it) {
  const cmds = [];
  if (it.base !== undefined) cmds.push({ do: () => EDM.removed.add(it.base), undo: () => EDM.removed.delete(it.base) });
  else if (it.crate !== undefined) cmds.push({ do: () => EDM.removedCrates.add(it.crate), undo: () => EDM.removedCrates.delete(it.crate) });
  else { const a = EDM.added.find(q => q.id === it.id); let pos = -1; cmds.push({ do: () => { pos = EDM.added.indexOf(a); if (pos >= 0) EDM.added.splice(pos, 1); }, undo: () => { if (pos >= 0) EDM.added.splice(pos, 0, a); } }); }
  if (it.op[0] === 'helipad') cmds.push(cmdSetEv('pad', null));
  if (it.op[0] === 'generator') cmds.push(cmdSetEv('gen', null));
  return cmds.length > 1 ? cmdGroup(cmds) : cmds[0];
}
function edOverlay() { return { removed: [...EDM.removed], removedCrates: [...EDM.removedCrates], added: EDM.added.map(a => a.op), start: EDM.start, events: EDM.events }; }
function edSave() { const ov = edOverlay(); if (CMAP) { CMAP.ov = ov; lsSet('cmap_' + CMAP.id, CMAP); } else lsSet('ov_' + MAPID, ov); }

/* ---- инструменты: что создаёт клик или рамка ---- */
function edMake(tool, x0, z0, x1, z1) {
  const xa = Math.min(x0, x1), xb = Math.max(x0, x1), za = Math.min(z0, z1), zb = Math.max(z0, z1), horiz = Math.abs(x1 - x0) >= Math.abs(z1 - z0);
  const size = MAP, inb = (x, z) => x > 0.5 && z > 0.5 && x < size - 0.5 && z < size - 0.5;
  switch (tool) {
    case 'fence': if (Math.max(xb - xa, zb - za) < 1) return null; return horiz ? [cmdAdd(['fenceX', xa, xb, z0])] : [cmdAdd(['fenceZ', za, zb, x0])];
    case 'wall': if (Math.max(xb - xa, zb - za) < 1) return null; return horiz ? [cmdAdd(['wall', xa, z0 - 0.25, xb, z0 + 0.25])] : [cmdAdd(['wall', x0 - 0.25, za, x0 + 0.25, zb])];
    case 'gate': if (Math.max(xb - xa, zb - za) < 2) return null; return horiz ? [cmdAdd(['gate', xa, z0, xb, z0, 'x', false])] : [cmdAdd(['gate', x0, za, x0, zb, 'z', false])];
    case 'block': {
      if (xb - xa < 4 || zb - za < 4) return null; const f = EDO.floors, run = f === 1 ? 5.5 : f === 2 ? 11 : 16, o = { col: BLOCK_COLS[EDM.nid % BLOCK_COLS.length] };
      if (xb - xa >= run + 4.2) { const g0 = xb - 3.2; o.gap = [g0, g0 + 1.6]; o.esc = g0 - run; }
      return [cmdAdd(['block', xa, za, xb, zb, f, o])];
    }
    case 'shed': if (xb - xa < 3 || zb - za < 3) return null; return [cmdAdd(['shed', xa, za, xb, zb, { h: 2.6, open: 'S', col: 0x86806e }])];
    case 'zone': if (xb - xa < 1 || zb - za < 1) return null; return [cmdAdd(['zone', EDO.zone, xa, za, xb, zb])];
    case 'car': { if (!inb(x1, z1)) return null; const al = !EDO.rot; return [cmdAdd(['car', al ? x1 - 1.6 : x1 - 0.75, al ? z1 - 0.75 : z1 - 1.6, al, CAR_COLS[EDM.nid % CAR_COLS.length], true, false])]; }
    case 'barrel': return inb(x1, z1) ? [cmdAdd(['barrel', x1, z1, false])] : null;
    case 'xbarrel': case 'lamp': case 'tree': case 'bush': case 'cone': return inb(x1, z1) ? [cmdAdd([tool, x1, z1])] : null;
    case 'bench': return inb(x1, z1) ? [cmdAdd(['bench', x1, z1, true])] : null;
    case 'trashbin': return inb(x1, z1) ? [cmdAdd(['trashbin', x1, z1, EDO.rot ? Math.PI / 2 : 0])] : null;
    case 'trashbag': return inb(x1, z1) ? [cmdAdd(['trashbag', x1, z1])] : null;
    case 'crate': return inb(x1, z1) ? [cmdAdd(['crate', x1, z1, 0])] : null;
    case 'start': return inb(x1, z1) ? [cmdStart({ x: x1, z: z1 })] : null;
    case 'gen': {
      if (!inb(x1, z1)) return null; const cl = edItems().filter(i => i.op[0] === 'generator').map(cmdDel);                        // генератор один: старый убираем
      return [...cl, cmdAdd(['generator', x1, z1, 0]), cmdSetEv('gen', { x: x1, z: z1, y: 0 })];
    }
    case 'pad': {
      const b = edItems().filter(i => i.kind === 'op' && (i.op[0] === 'block' || i.op[0] === 'cbuild')).map(i => ({ i, r: edBounds(i.op) })).filter(o => x1 > o.r.x1 && x1 < o.r.x2 && z1 > o.r.z1 && z1 < o.r.z2).sort((a, c) => (a.r.x2 - a.r.x1) * (a.r.z2 - a.r.z1) - (c.r.x2 - c.r.x1) * (c.r.z2 - c.r.z1))[0];
      if (!b) { edHint('Площадка ставится на крышу здания: кликни внутри здания'); return null; }
      if (b.r.x2 - b.r.x1 < 10 || b.r.z2 - b.r.z1 < 8) { edHint('Здание мало: нужно от 10×8'); return null; }
      const cl = edItems().filter(i => i.op[0] === 'helipad').map(cmdDel);
      return [...cl, cmdAdd(['helipad']), cmdSetEv('pad', { x: (b.r.x1 + b.r.x2) / 2, z: (b.r.z1 + b.r.z2) / 2, hw: 4, hd: 3.3, h: b.r.h })];
    }
    case 'ladder': {
      let best = null;
      for (const it of edItems()) {
        if (it.kind !== 'op' || !['block', 'shed', 'cbuild'].includes(it.op[0])) continue; const r = edBounds(it.op);
        const sides = [[Math.abs(x1 - r.x1), -1, 0, r.x1, edCl(z1, r.z1 + 0.8, r.z2 - 0.8), z1 > r.z1 && z1 < r.z2], [Math.abs(x1 - r.x2), 1, 0, r.x2, edCl(z1, r.z1 + 0.8, r.z2 - 0.8), z1 > r.z1 && z1 < r.z2],
          [Math.abs(z1 - r.z1), 0, -1, edCl(x1, r.x1 + 0.8, r.x2 - 0.8), r.z1, x1 > r.x1 && x1 < r.x2], [Math.abs(z1 - r.z2), 0, 1, edCl(x1, r.x1 + 0.8, r.x2 - 0.8), r.z2, x1 > r.x1 && x1 < r.x2]];
        for (const s of sides) if (s[5] && s[0] < 1.4 && (!best || s[0] < best[0])) best = s;
      }
      if (!best) { edHint('Лестница ставится у стены здания: кликни рядом со стеной'); return null; }
      return [cmdAdd(['ladder', edSn(best[3]), edSn(best[4]), best[1], best[2]])];
    }
  }
  return null;
}
function edAct(tool, x0, z0, x1, z1) {
  if (tool === 'erase') { const it = mePick(x1, z1); if (it) edExec(cmdDel(it)); return; }
  const cmds = edMake(tool, x0, z0, x1, z1); if (cmds) edExec(cmds.length > 1 ? cmdGroup(cmds) : cmds[0]);
}

/* ---- отрисовка плана ---- */
function edResize() { const cv = $m('meCv'), d = devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight; if (cv.width !== Math.round(w * d) || cv.height !== Math.round(h * d)) { cv.width = Math.round(w * d); cv.height = Math.round(h * d); } edDraw(); }
function edFit() { const cv = $m('meCv'); EDV.s = Math.min(cv.clientWidth, cv.clientHeight) / MAP * 0.92; EDV.cx = MAP / 2; EDV.cz = MAP / 2; }
function edDraw() {
  if (G.state !== 'mapedit') return;
  const cv = $m('meCv'), g = cv.getContext('2d'), d = devicePixelRatio || 1, W = cv.clientWidth, H = cv.clientHeight;
  g.setTransform(d, 0, 0, d, 0, 0); g.fillStyle = '#100d0a'; g.fillRect(0, 0, W, H);
  const X = x => (x - EDV.cx) * EDV.s + W / 2, Z = z => (z - EDV.cz) * EDV.s + H / 2, rect = (x1, z1, x2, z2) => g.fillRect(X(x1), Z(z1), (x2 - x1) * EDV.s, (z2 - z1) * EDV.s);
  g.fillStyle = EDZ.dirt; rect(0, 0, MAP, MAP);
  for (const z of BASE_DEF.zones) { g.fillStyle = EDZ[z[0]] || '#777'; rect(z[1], z[2], z[3], z[4]); }
  for (const a of EDM.added) if (a.op[0] === 'zone') { g.fillStyle = EDZ[a.op[1]] || '#777'; rect(a.op[2], a.op[3], a.op[4], a.op[5]); }
  g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = 1; const step = EDV.s > 14 ? 1 : EDV.s > 6 ? 4 : 8;
  g.beginPath(); for (let v = 0; v <= MAP; v += step) { g.moveTo(X(v), Z(0)); g.lineTo(X(v), Z(MAP)); g.moveTo(X(0), Z(v)); g.lineTo(X(MAP), Z(v)); } g.stroke();
  const items = edItems(), hov = MEd.hover;
  for (const it of items) {
    if (it.kind === 'zone') continue; const col = EDCOL[it.op[0]] || '#9a9a9a'; g.fillStyle = col;
    const tiny = it.rects.length === 1 && Math.max(it.rects[0].x2 - it.rects[0].x1, it.rects[0].z2 - it.rects[0].z1) * EDV.s < 7 && !['fenceX', 'fenceZ', 'wall', 'gate'].includes(it.op[0]);
    if (tiny) { const r = it.rects[0]; g.beginPath(); g.arc(X((r.x1 + r.x2) / 2), Z((r.z1 + r.z2) / 2), 4, 0, 7); g.fill(); g.strokeStyle = 'rgba(0,0,0,.8)'; g.lineWidth = 1; g.stroke(); continue; }
    g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 1;
    for (const r of it.rects) { const w2 = Math.max(1.5, (r.x2 - r.x1) * EDV.s), h2 = Math.max(1.5, (r.z2 - r.z1) * EDV.s); g.fillRect(X(r.x1), Z(r.z1), w2, h2); if (w2 > 3 && h2 > 3) g.strokeRect(X(r.x1) + 0.5, Z(r.z1) + 0.5, w2 - 1, h2 - 1); }
  }
  if (MEd.hover && EDO.tool === 'erase') { g.fillStyle = 'rgba(255,60,40,.75)'; for (const r of MEd.hover.rects) g.fillRect(X(r.x1) - 1, Z(r.z1) - 1, Math.max(3, (r.x2 - r.x1) * EDV.s + 2), Math.max(3, (r.z2 - r.z1) * EDV.s + 2)); }
  for (const it of items) if (it.kind === 'crate') { g.fillStyle = '#d0a050'; g.fillRect(X(it.op[1]) - 4, Z(it.op[2]) - 4, 8, 8); g.strokeStyle = '#000'; g.strokeRect(X(it.op[1]) - 4, Z(it.op[2]) - 4, 8, 8); }
  const st = EDM.start || MAPDEF.start; if (st) { g.fillStyle = '#4ae06a'; g.beginPath(); g.arc(X(st.x), Z(st.z), 7, 0, 7); g.fill(); g.fillStyle = '#000'; g.font = 'bold 10px sans-serif'; g.textAlign = 'center'; g.fillText('С', X(st.x), Z(st.z) + 3.5); }
  // рамка карты
  g.strokeStyle = '#ffb040'; g.lineWidth = 2; g.strokeRect(X(0), Z(0), MAP * EDV.s, MAP * EDV.s);
  // предпросмотр
  const m = MEd.mouse; if (m) {
    g.strokeStyle = '#ffe080'; g.fillStyle = 'rgba(255,224,128,.25)'; g.lineWidth = 1.5; const t = EDO.tool, dg = MEd.drag;
    if (dg && ['fence', 'wall', 'gate'].includes(t)) { const horiz = Math.abs(dg.x1 - dg.x0) >= Math.abs(dg.z1 - dg.z0); g.beginPath(); g.moveTo(X(dg.x0), Z(dg.z0)); g.lineTo(X(horiz ? dg.x1 : dg.x0), Z(horiz ? dg.z0 : dg.z1)); g.stroke(); }
    else if (dg && ['block', 'shed', 'zone'].includes(t)) { const x1 = Math.min(dg.x0, dg.x1), z1 = Math.min(dg.z0, dg.z1), w2 = Math.abs(dg.x1 - dg.x0), h2 = Math.abs(dg.z1 - dg.z0); g.fillRect(X(x1), Z(z1), w2 * EDV.s, h2 * EDV.s); g.strokeRect(X(x1), Z(z1), w2 * EDV.s, h2 * EDV.s); g.fillStyle = '#ffe080'; g.font = '12px sans-serif'; g.textAlign = 'left'; g.fillText(`${w2.toFixed(1)} × ${h2.toFixed(1)}`, X(x1) + 4, Z(z1) - 5); }
    else if (!['erase', 'fence', 'wall', 'gate', 'block', 'shed', 'zone'].includes(t)) { g.beginPath(); g.arc(X(m.x), Z(m.z), Math.max(4, EDV.s * 0.6), 0, 7); g.fill(); g.stroke(); }
  }
}
function edHint(txt) { const h = $m('meHint'); if (h) { h.textContent = txt; clearTimeout(edHint.t); edHint.t = setTimeout(edToolHint, 3500); } }
function edToolHint() { const t = EDTOOLS.find(q => q[0] === EDO.tool); $m('meHint').textContent = t ? t[2] : ''; }
function edButtons() {
  $m('meUndo').disabled = !EDM.undo.length; $m('meRedo').disabled = !EDM.redo.length;
  $m('meUndo').textContent = '⟲ Отменить' + (EDM.undo.length ? ` (${EDM.undo.length})` : ''); $m('meRedo').textContent = '⟳ Вернуть' + (EDM.redo.length ? ` (${EDM.redo.length})` : '');
  $m('meCount').textContent = `объектов: ${edItems().filter(i => i.kind !== 'zone').length}`;
}
function edSide() {
  const side = $m('meSide');
  side.innerHTML = '<div class="hd">ИНСТРУМЕНТЫ</div>' + EDTOOLS.map(([id, n]) => `<button data-t="${id}" class="${EDO.tool === id ? 'on' : ''}">${n}</button>`).join('')
    + '<div class="hd">ЭТАЖИ ЗДАНИЯ</div><div class="opt">' + [1, 2, 3].map(f => `<button data-f="${f}" class="${EDO.floors === f ? 'on' : ''}">${f}</button>`).join('') + '</div>'
    + `<div class="hd">ПОКРЫТИЕ</div><select id="meZone">${Object.keys(EDZN).map(k => `<option value="${k}"${EDO.zone === k ? ' selected' : ''}>${EDZN[k]}</option>`).join('')}</select>`
    + '<div class="help">Колёсико — масштаб<br>Правая кнопка или Пробел+мышь — двигать<br>R — повернуть машину<br>Ctrl+Z — отменить, Ctrl+Y — вернуть<br>Все правки сохраняются сами</div>';
  side.querySelectorAll('button[data-t]').forEach(b => b.onclick = () => { EDO.tool = b.dataset.t; edSide(); edToolHint(); });
  side.querySelectorAll('button[data-f]').forEach(b => b.onclick = () => { EDO.floors = +b.dataset.f; edSide(); });
  $m('meZone').onchange = e => { EDO.zone = e.target.value; };
}

/* ---- открытие и закрытие ---- */
let EDBOUND = false;
function openEditor() {
  edInit(); G.state = 'mapedit'; showScreen('mapedit'); $m('mapEd').style.display = 'flex';
  $m('meName').textContent = (CMAP ? CMAP.name : MAPDEF.name) + ` · ${MAP}×${MAP}`;
  if (!EDBOUND) { EDBOUND = true; edBind(); }
  edSide(); edToolHint(); edButtons(); edResize(); edFit(); edDraw();
}
function edExit() {
  $m('mapEd').style.display = 'none';
  if (EDM.changed) { showLoadingFx('Применяю правки…'); setTimeout(() => location.reload(), 40); return; }       // мир построен по старым данным — перестраиваем
  mmEnter();
}
function edPlay() {
  if (EDM.changed) { try { sessionStorage.setItem('zsv_pending', JSON.stringify({ run: true, n: 1, guns: G.guns.slice(0, 1), split: false })); } catch (e) {} showLoadingFx('Запускаю…'); setTimeout(() => location.reload(), 40); return; }
  $m('mapEd').style.display = 'none'; G.nPlayers = 1; startRun();
}
function edBind() {
  const cv = $m('meCv');
  const w2p = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left - r.width / 2) / EDV.s + EDV.cx, z: (e.clientY - r.top - r.height / 2) / EDV.s + EDV.cz }; };
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('mousedown', e => {
    const p = w2p(e);
    if (e.button === 1 || e.button === 2 || (e.button === 0 && keys.has('Space'))) { MEd.pan = { sx: e.clientX, sz: e.clientY, cx: EDV.cx, cz: EDV.cz }; return; }
    if (e.button !== 0) return;
    const t = EDO.tool, x = edSn(p.x), z = edSn(p.z);
    if (t === 'erase') { const it = mePick(p.x, p.z); if (it) { edExec(cmdDel(it)); MEd.hover = null; edDraw(); } return; }
    if (['fence', 'wall', 'gate', 'block', 'shed', 'zone'].includes(t)) MEd.drag = { x0: x, z0: z, x1: x, z1: z }; else edAct(t, x, z, x, z);
  });
  addEventListener('mousemove', e => {
    if (G.state !== 'mapedit') return;
    if (MEd.pan) { EDV.cx = MEd.pan.cx - (e.clientX - MEd.pan.sx) / EDV.s; EDV.cz = MEd.pan.cz - (e.clientY - MEd.pan.sz) / EDV.s; edDraw(); return; }
    const r = cv.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) { if (MEd.mouse) { MEd.mouse = null; MEd.hover = null; edDraw(); } return; }
    const p = w2p(e); MEd.mouse = { x: edSn(p.x), z: edSn(p.z), rx: p.x, rz: p.z };
    $m('meCoord').textContent = `x ${MEd.mouse.x.toFixed(1)}  z ${MEd.mouse.z.toFixed(1)}`;
    if (MEd.drag) { MEd.drag.x1 = MEd.mouse.x; MEd.drag.z1 = MEd.mouse.z; } if (EDO.tool === 'erase') MEd.hover = mePick(p.x, p.z); else MEd.hover = null;
    edDraw();
  });
  addEventListener('mouseup', e => {
    if (G.state !== 'mapedit') return;
    if (MEd.pan) { MEd.pan = null; return; }
    if (e.button === 0 && MEd.drag) { const d = MEd.drag; MEd.drag = null; edAct(EDO.tool, d.x0, d.z0, d.x1, d.z1); }
  });
  cv.addEventListener('wheel', e => {
    e.preventDefault(); const p = w2p(e), f = e.deltaY < 0 ? 1.15 : 1 / 1.15, ns = edCl(EDV.s * f, 2, 60); EDV.s = ns;
    const r = cv.getBoundingClientRect(); EDV.cx = p.x - (e.clientX - r.left - r.width / 2) / ns; EDV.cz = p.z - (e.clientY - r.top - r.height / 2) / ns; edDraw();
  }, { passive: false });
  addEventListener('resize', () => { if (G.state === 'mapedit') edResize(); });
  $m('meUndo').onclick = edUndo; $m('meRedo').onclick = edRedo; $m('meExit').onclick = edExit; $m('mePlay').onclick = edPlay;
  $m('meCopy').onclick = edCopy; $m('mePaste').onclick = edPaste; $m('meReset').onclick = edReset;
}
function edKey(e) {
  const c = e.code, ctrl = e.ctrlKey || e.metaKey;
  if (ctrl && c === 'KeyZ') { e.preventDefault(); if (e.shiftKey) edRedo(); else edUndo(); }
  else if (ctrl && c === 'KeyY') { e.preventDefault(); edRedo(); }
  else if (c === 'Escape') { if (MEd.drag) { MEd.drag = null; edDraw(); } }
  else if (c === 'KeyR') { EDO.rot = !EDO.rot; edHint(EDO.rot ? 'Машина: вдоль оси Z' : 'Машина: вдоль оси X'); }
  else if (c === 'Space') e.preventDefault();
  else if ((c === 'Delete' || c === 'Backspace') && MEd.hover) edExec(cmdDel(MEd.hover));
}

/* ---- код карты: копировать / вставить; сброс правок ---- */
function edCode() { return 'MD1:' + btoa(unescape(encodeURIComponent(JSON.stringify({ v: 1, base: CMAP ? 'blank' : MAPID, size: MAP, name: CMAP ? CMAP.name : null, ov: edOverlay() })))); }
function edCopy() {
  const code = edCode();
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code).then(() => edHint('Код карты скопирован'), () => prompt('Скопируй код карты', code)); else prompt('Скопируй код карты', code);
}
function edPaste() {
  const s = prompt('Вставь код карты'); if (!s) return;
  let d; try { d = JSON.parse(decodeURIComponent(escape(atob(s.trim().replace(/^MD1:/, ''))))); } catch (e) { alert('Не получилось прочитать код'); return; }
  if (!d || d.v !== 1 || !d.ov) { alert('Это не код карты'); return; }
  if (d.base === 'blank') { const id = createCustomMap(d.size || 96, (d.name || 'Чужая карта').slice(0, 30), d.ov); startEditorFor('c:' + id); return; }
  if (d.base !== 'prison' && d.base !== 'city') { alert('Неизвестная карта в коде'); return; }
  if (!confirm('Заменить твои правки карты «' + (d.base === 'city' ? 'Город' : 'Тюрьма') + '» этим кодом?')) return;
  lsSet('ov_' + d.base, d.ov); lsSet('map', d.base);
  try { sessionStorage.setItem('zsv_pending', JSON.stringify({ editor: true })); } catch (e) {} showLoadingFx('Применяю код…'); setTimeout(() => location.reload(), 40);
}
function edReset() {
  if (!confirm(CMAP ? 'Убрать всё с карты и начать заново?' : 'Сбросить все твои правки и вернуть исходную карту?')) return;
  if (CMAP) { CMAP.ov = {}; lsSet('cmap_' + CMAP.id, CMAP); } else { try { localStorage.removeItem('zsv_ov_' + MAPID); } catch (e) {} }
  try { sessionStorage.setItem('zsv_pending', JSON.stringify({ editor: true })); } catch (e) {} showLoadingFx('Сбрасываю…'); setTimeout(() => location.reload(), 40);
}
