'use strict';
/* ---------- Главное меню: кнопки слева, справа — ночная дорога, по которой бредут зомби ---------- */
const MM = { z: [], cam: { x: 48, z: 40 }, zoom: 6.8, sel: 0, panel: '', Z0: 8, Z1: 66 };
// форма зомби, шанс, скорость (клеток/с)
const MM_FORMS = [['walk', 0.6, 0.72], ['run', 0.1, 1.8], ['fat', 0.1, 0.5], ['armored', 0.1, 0.62], ['crawl', 0.1, 0.3]];
const MM_BTNS = [['single', 'Одиночная игра'], ['coop', 'Кооп'], ['hero', 'Редактор персонажа'], ['map', 'Редактор карты', 'скоро'], ['settings', 'Настройки'], ['exit', 'Выйти']];

function mmSpawnZ(initial) {
  let r = Math.random(), form = 'walk', spd = 0.72;
  for (const [f, p, s] of MM_FORMS) { if (r < p) { form = f; spd = s; break; } r -= p; }
  return { zombie: true, form, vm: Math.floor(Math.random() * VOXMS.length), x: rnd(43.5, 52.5), y: 0, z: initial ? rnd(MM.Z0, MM.Z1) : MM.Z0 - rnd(0, 5),
    spd: spd * rnd(0.85, 1.15), yaw: 0, base: rnd(-0.12, 0.12), phase: rnd(0, 6), moving: true, nod: 0 };
}
function mmUpdate(dt) {
  if (!MM.z.length) for (let i = 0; i < 46; i++) MM.z.push(mmSpawnZ(true));
  for (const c of MM.z) {
    const moved = c.spd * dt; c.z += moved; c.phase += moved * (c.form === 'run' ? 5 : 6.5);
    c.yaw = c.base + Math.sin(c.phase * 0.5) * 0.08; c.nod = Math.sin(c.phase * 0.7) * 0.15;
    if (c.z > MM.Z1) Object.assign(c, mmSpawnZ(false));
  }
}
function mmDraw() { for (const c of MM.z) drawVoxZombie(c); }

function mmBuild() {
  $('mmBtns').innerHTML = MM_BTNS.map(([a, n, tag], i) => `<button data-a="${a}" style="animation-delay:${0.15 + i * 0.07}s"${tag || (a === 'coop' && IS_TOUCH) ? ' disabled' : ''}>${n}${tag ? ` <small>${tag}</small>` : ''}</button>`).join('');
  $('mmBtns').querySelectorAll('button').forEach((b, i) => {
    b.onclick = e => { e.stopPropagation(); mmAct(b.dataset.a); };
    b.onmouseenter = () => { if (!b.disabled) { MM.sel = i; mmMark(); } };
  });
  mmMark();
}
function mmMark() { $('mmBtns').querySelectorAll('button').forEach((b, i) => b.classList.toggle('sel', i === MM.sel)); }
function mmEnter() {
  G.state = 'main'; MM.panel = ''; G.nightT = 1; $('lvlUp').style.display = 'none'; $('editor').style.display = 'none';
  showScreen('main'); mmPanel('');
}
function mmLeave() { G.nightT = 0; }
function mmPanel(name) {
  MM.panel = name; const el = $('mmPanel'); $('mmBtns').style.display = name ? 'none' : 'block'; el.style.display = name ? 'block' : 'none';
  if (name === 'settings') {
    el.innerHTML = `<h3>Настройки</h3><button data-s="sound">Звук: ${Sound.on ? 'вкл' : 'выкл'}</button><button data-s="full">Полный экран</button><button data-s="split">Кооп: ${G.split ? 'раздельный экран' : 'общий экран'}</button><button data-s="hud">Настроить HUD</button><button data-s="reset">Сбросить героев и свои модели</button><button data-s="back">← Назад</button>`;
  } else if (name === 'exit') {
    el.innerHTML = `<h3>Спасибо за игру!</h3><p>Браузер не даёт игре закрыть вкладку сам — закройте её, когда захотите.</p><button data-s="back">В меню</button>`;
  }
  el.querySelectorAll('button').forEach(b => b.onclick = e => { e.stopPropagation(); mmSetting(b.dataset.s); });
}
function mmSetting(s) {
  SFX.click();
  if (s === 'sound') { setSound(!Sound.on); $('optSound').checked = Sound.on; mmPanel('settings'); }
  else if (s === 'full') goFullscreen();
  else if (s === 'hud') heOpen();
  else if (s === 'split') { G.split = !G.split; lsSet('split', G.split); mmPanel('settings'); }
  else if (s === 'reset') { if (confirm('Удалить всех сохранённых героев и загруженные модели?')) { for (const k of ['heroes', 'heroSel', 'customParts']) { try { localStorage.removeItem('zsv_' + k); } catch (e) {} } location.reload(); } }
  else if (s === 'back') mmPanel('');
}
function mmAct(a) {
  SFX.click();
  if (a === 'single') { G.nPlayers = 1; mmClass(); }
  else if (a === 'coop') { if (IS_TOUCH) return; G.nPlayers = Math.max(2, Math.min(G.nPlayers, maxPlayers())); mmClass(); }
  else if (a === 'hero') { G.pick = 0; mmLeave(); edOpen(); }
  else if (a === 'settings') mmPanel('settings');
  else if (a === 'exit') mmPanel('exit');
}
function mmClass() { mmLeave(); G.pick = 0; menuSel = Math.max(0, MAIN_IDS.indexOf(G.guns[0])); G.state = 'menu'; showScreen('menu'); menuMark(); }
function mainKey(code) {
  if (HUDL.on) { if (code === 'Escape') heClose(); return; }
  if (MM.panel) { if (code === 'Escape' || code === 'Backspace') mmPanel(''); return; }
  const on = MM_BTNS.map((b, i) => (b[2] || (b[0] === 'coop' && IS_TOUCH)) ? -1 : i).filter(i => i >= 0);
  let k = on.indexOf(MM.sel); if (k < 0) k = 0;
  if (code === 'ArrowDown' || code === 'KeyS') k = (k + 1) % on.length;
  else if (code === 'ArrowUp' || code === 'KeyW') k = (k + on.length - 1) % on.length;
  else if (code === 'Enter' || code === 'Space' || code === 'NumpadEnter') { mmAct(MM_BTNS[MM.sel][0]); return; }
  else return;
  MM.sel = on[k]; mmMark(); SFX.click();
}
