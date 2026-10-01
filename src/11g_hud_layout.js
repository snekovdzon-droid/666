'use strict';
/* ---------- Настройка HUD: каждый элемент можно сдвинуть и изменить в размере (Настройки → Настроить HUD) ----------
   Положение хранится как доля экрана (не зависит от разрешения), масштаб — число. Применяется свойствами CSS translate и scale. */
const HUD_ITEMS = [                      // id элемента, название, откуда растёт при увеличении
  ['hud0', 'Плашка игрока 1', 'top left'], ['hud1', 'Плашка игрока 2', 'top right'], ['hud2', 'Плашка игрока 3', 'bottom left'], ['hud3', 'Плашка игрока 4', 'bottom right'],
  ['top', 'Таймер', 'top center'], ['radarBox', 'Радар', 'top right'], ['bossBar', 'Полоса босса', 'top center'],
  ['btns', 'Кнопки камеры', 'bottom right'], ['tItems', 'Кнопки предметов', 'bottom right'], ['help', 'Подсказка по клавишам', 'bottom left'],
];
const HUDL = { map: lsGet('hudLayout', {}), on: false, sel: null, drag: null };
const hudCur = id => HUDL.map[id] || { x: 0, y: 0, s: 1 };
function hudApplyLayout() {
  for (const [id, , org] of HUD_ITEMS) {
    const el = $(id); if (!el) continue; const L = HUDL.map[id];
    el.style.transformOrigin = org;
    if (L) { el.style.translate = `${(L.x * innerWidth).toFixed(1)}px ${(L.y * innerHeight).toFixed(1)}px`; el.style.scale = L.s; } else { el.style.translate = ''; el.style.scale = ''; }
  }
}
const hudSaveLayout = () => lsSet('hudLayout', HUDL.map);
addEventListener('resize', hudApplyLayout);

function heSelect(id) {
  HUDL.sel = id;
  document.querySelectorAll('.hudItem').forEach(e => e.classList.toggle('hudSel', e.id === id));
  const it = HUD_ITEMS.find(x => x[0] === id);
  $('hpSel').textContent = it ? it[1] : 'Выберите элемент и перетащите'; $('hpScale').textContent = it ? Math.round(hudCur(id).s * 100) + '%' : '';
}
function heScale(d) {
  const id = HUDL.sel; if (!id) return;
  const L = Object.assign({}, hudCur(id)); L.s = clamp(Math.round((L.s + d) * 100) / 100, 0.5, 2); HUDL.map[id] = L;
  hudApplyLayout(); hudSaveLayout(); heSelect(id);
}
function heOpen() {
  HUDL.on = true; $('main').style.display = 'none'; showScreen(null);
  const h0 = $('hud0');
  for (let i = 1; i < 4; i++) if (h0 && !$('hud' + i)) {                      // макеты плашек остальных игроков (в бою они появляются в коопе)
    const d = h0.cloneNode(true); d.id = 'hud' + i; d.className = 'hud demo c' + i; d.style.setProperty('--pc', PLAYER_CSS[i]);
    d.querySelector('.plate').insertAdjacentHTML('afterbegin', `<div class="ph"><span class="pn">ИГРОК ${i + 1}</span></div>`); $('huds').appendChild(d);
  }
  if (h0 && !h0.querySelector('.ph')) h0.querySelector('.plate').insertAdjacentHTML('afterbegin', '<div class="ph demoph"><span class="pn">ИГРОК 1</span></div>');
  document.body.classList.add('hudEdit');
  for (const [id, name] of HUD_ITEMS) { const el = $(id); if (el) { el.classList.add('hudItem'); el.dataset.hl = name; } }
  if (!IS_TOUCH && $('tItems')) $('tItems').dataset.hl = 'Кнопки предметов';
  hudApplyLayout(); $('hudPanel').style.display = 'block'; heSelect(null);
}
function heClose() {
  HUDL.on = false; hudSaveLayout(); document.body.classList.remove('hudEdit'); $('hudPanel').style.display = 'none';
  document.querySelectorAll('.hudItem').forEach(e => e.classList.remove('hudItem', 'hudSel'));
  document.querySelectorAll('.hud.demo').forEach(e => e.remove()); document.querySelectorAll('.demoph').forEach(e => e.remove());
  hudBuild(); mmEnter(); mmPanel('settings');
}
addEventListener('pointerdown', e => {
  if (!HUDL.on) return;
  const t = e.target.closest && e.target.closest('.hudItem'); if (!t) return;
  e.preventDefault(); heSelect(t.id); const L = hudCur(t.id);
  HUDL.drag = { id: t.id, px: e.clientX, py: e.clientY, x: L.x, y: L.y, s: L.s };
}, true);
addEventListener('pointermove', e => {
  const d = HUDL.drag; if (!d) return;
  HUDL.map[d.id] = { x: d.x + (e.clientX - d.px) / innerWidth, y: d.y + (e.clientY - d.py) / innerHeight, s: d.s }; hudApplyLayout();
});
addEventListener('pointerup', () => { if (HUDL.drag) { HUDL.drag = null; hudSaveLayout(); } });
addEventListener('wheel', e => { if (!HUDL.on) return; e.preventDefault(); e.stopImmediatePropagation(); heScale(e.deltaY < 0 ? 0.05 : -0.05); }, { capture: true, passive: false });
addEventListener('DOMContentLoaded', () => {
  $('hpMinus').onclick = () => heScale(-0.05); $('hpPlus').onclick = () => heScale(0.05);
  $('hpOne').onclick = () => { if (HUDL.sel) { delete HUDL.map[HUDL.sel]; hudApplyLayout(); hudSaveLayout(); heSelect(HUDL.sel); } };
  $('hpAll').onclick = () => { HUDL.map = {}; hudApplyLayout(); hudSaveLayout(); heSelect(HUDL.sel); };
  $('hpDone').onclick = heClose;
});
