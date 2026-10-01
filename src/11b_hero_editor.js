'use strict';
/* ---------- Редактор персонажа: пол, причёска, борода, одежда, цвета; предпросмотр с поворотом и ходьбой ---------- */
const SLOT_KEY = ['', '', '', ''];
// поставить героя в слот игрока i (если выбор изменился)
function heroApplySlot(i) {
  const h = heroById(HEROES.sel[i]), key = h ? JSON.stringify(h) : '';
  if (SLOT_KEY[i] === key) return; SLOT_KEY[i] = key;
  setHeroModel(i, h ? buildVoxModel(genHeroVox(h)) : buildDefaultHero(i));
}
const heroApplyAll = () => { for (let i = 0; i < 4; i++) heroApplySlot(i); };

// строка «Внешность» в меню выбора класса
function lookMark() {
  const h = heroById(HEROES.sel[G.pick]);
  $('lookWho').innerHTML = G.nPlayers > 1 ? `<b style="color:${PLAYER_CSS[G.pick]}">Игрок ${G.pick + 1}</b>` : 'Внешность';
  $('lookName').textContent = h ? h.name : 'Стандартный';
}
function lookCycle(d) {
  const ids = ['', ...HEROES.list.map(h => h.id)], i = Math.max(0, ids.indexOf(HEROES.sel[G.pick]));
  HEROES.sel[G.pick] = ids[(i + d + ids.length) % ids.length]; heroSave(); heroApplySlot(G.pick); lookMark(); SFX.click();
}

const ED = { cur: null, ready: false, open: false, yaw: 0.5, walk: true, spin: true, drag: null, M: null, parts: {}, dirty: true };
const ED_UI = [
  ['opt', 'gender', 'Пол', GENDERS],
  ['col', 'skin', 'Кожа', 'skin'],
  ['opt', 'hairStyle', 'Причёска', HAIR_STYLES],
  ['col', 'hair', 'Цвет волос', 'hair'],
  ['opt', 'beard', 'Борода и усы', BEARDS],
  ['col', 'beardCol', 'Цвет бороды', 'hair', 'как у волос'],
  ['opt', 'topStyle', 'Верх', TOPS],
  ['col', 'top', 'Цвет верха', 'cloth'],
  ['col', 'trim', 'Отделка верха', 'cloth'],
  ['opt', 'legs', 'Низ', LEGS],
  ['col', 'pants', 'Цвет низа', 'pants'],
  ['tog', 'boots', 'Высокие ботинки'],
  ['col', 'shoes', 'Обувь', 'shoes'],
  ['opt', 'hat', 'Головной убор', HATS],
  ['col', 'hatCol', 'Цвет головного убора', 'cloth'],
  ['opt', 'glasses', 'Очки', GLASSES],
  ['tog', 'pack', 'Рюкзак'],
  ['col', 'packCol', 'Цвет рюкзака', 'cloth'],
];
const edClone = h => JSON.parse(JSON.stringify(h));
const edPick = a => a[Math.floor(Math.random() * a.length)];

function edBuildPanel() {
  $('edPanel').innerHTML = ED_UI.map(([t, k, label, src, none]) => {
    if (t === 'opt') return `<div class="edRow" data-row="${k}"><label>${label}</label><div class="edOpts">${src.map(([v, n]) => `<button data-k="${k}" data-v="${v}">${n}</button>`).join('')}</div></div>`;
    if (t === 'tog') return `<div class="edRow" data-row="${k}"><div class="edOpts"><button data-k="${k}" data-t="1">${label}</button></div></div>`;
    return `<div class="edRow" data-row="${k}"><label>${label}</label><div class="edSw">${none ? `<button class="sw none" data-k="${k}" data-c="" title="${none}">${none}</button>` : ''}${HERO_SWATCH[src].map(c => `<button class="sw" data-k="${k}" data-c="${c}" style="background:${c}"></button>`).join('')}<input type="color" data-k="${k}"></div></div>`;
  }).join('');
}
// показать выбранные кнопки и значения
function edSync() {
  const c = ED.cur;
  $('edName').value = c.name;
  $('edPanel').querySelectorAll('[data-k]').forEach(b => {
    const k = b.dataset.k;
    if (b.tagName === 'INPUT') b.value = c[k] || c.hair;
    else if (b.dataset.t) b.classList.toggle('on', !!c[k]);
    else if (b.dataset.v !== undefined) b.classList.toggle('on', c[k] === b.dataset.v);
    else b.classList.toggle('on', (c[k] || '') === b.dataset.c);
  });
  // женское тело: бороду можно, но это решает игрок; рюкзак выключен — его цвет не нужен
  $('edPanel').querySelector('[data-row="packCol"]').style.opacity = c.pack ? 1 : 0.4;
  $('edPanel').querySelector('[data-row="hatCol"]').style.opacity = c.hat !== 'none' ? 1 : 0.4;
  $('edPanel').querySelector('[data-row="beardCol"]').style.opacity = c.beard !== 'none' ? 1 : 0.4;
  const sel = $('edList'); sel.innerHTML = HEROES.list.map(h => `<option value="${h.id}">${h.name}</option>`).join('') + (c.id ? '' : '<option value="" selected>— новый (не сохранён) —</option>');
  if (c.id) sel.value = c.id;
}
function edSet(k, v) { ED.cur[k] = v; ED.dirty = true; edSync(); }

function edPreviewInit() {
  const cv = $('edCanvas');
  ED.r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true }); ED.r.outputEncoding = THREE.sRGBEncoding;
  ED.scene = new THREE.Scene(); ED.cam = new THREE.PerspectiveCamera(28, 1, 0.1, 30);
  ED.scene.add(new THREE.HemisphereLight(0xfff4e0, 0x6a6a7a, 0.8));
  const dl = new THREE.DirectionalLight(0xffffff, 0.55); dl.position.set(2, 4, 5); ED.scene.add(dl);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(0.75, 40), new THREE.MeshBasicMaterial({ color: 0x1e1a16, transparent: true, opacity: 0.55 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = 0.002; ED.scene.add(floor);
  ED.root = new THREE.Group(); ED.scene.add(ED.root);
  cv.addEventListener('pointerdown', e => { ED.drag = { x: e.clientX, yaw: ED.yaw }; cv.setPointerCapture(e.pointerId); ED.spin = false; });
  cv.addEventListener('pointermove', e => { if (ED.drag) ED.yaw = ED.drag.yaw + (e.clientX - ED.drag.x) * 0.012; });
  cv.addEventListener('pointerup', () => { ED.drag = null; });
}
function edBuildModel() {
  if (ED.M) { ED.root.clear(); for (const k of VOX_PARTS) ED.M.parts[k].geo.dispose(); ED.M.tex.dispose(); ED.mat.dispose(); }
  const M = ED.M = buildVoxModel(genHeroVox(ED.cur)), W = VZ.W;
  ED.mat = new THREE.MeshLambertMaterial({ map: M.tex }); ED.parts = {};
  const body = new THREE.Group(); body.scale.set(1, VZ.H, 1); ED.root.add(body);       // как в игре: рост ×H, ширина ×W
  for (const k of VOX_PARTS) {
    const g = new THREE.Group(), m = new THREE.Mesh(M.parts[k].geo, ED.mat), pv = M.parts[k].pivot;
    g.position.set(pv[0] * W, pv[1], pv[2] * W); g.scale.set(W, 1, W); g.add(m); body.add(g); ED.parts[k] = g;
  }
  ED.dirty = false;
}
function edLoop(now) {
  if (!ED.open) return;
  requestAnimationFrame(edLoop);
  const cv = $('edCanvas'), w = cv.clientWidth, h = cv.clientHeight;
  if (w && h && (cv.width !== Math.round(w * devicePixelRatio) || cv.height !== Math.round(h * devicePixelRatio))) { ED.r.setPixelRatio(devicePixelRatio); ED.r.setSize(w, h, false); ED.cam.aspect = w / h; ED.cam.updateProjectionMatrix(); }
  if (ED.dirty) edBuildModel();
  const t = now / 1000, s = ED.walk ? Math.sin(t * 5) * 0.6 : 0;
  if (ED.spin) ED.yaw += 0.008;
  ED.root.rotation.y = ED.yaw;
  ED.parts.legA.rotation.x = s; ED.parts.legB.rotation.x = -s; ED.parts.armA.rotation.x = -s * 0.8; ED.parts.armB.rotation.x = s * 0.8;
  ED.root.position.y = ED.walk ? Math.abs(Math.sin(t * 5)) * 0.015 : Math.sin(t * 1.6) * 0.004;
  ED.cam.position.set(0, 0.95, w / h < 0.8 ? 5.4 : 4.3); ED.cam.lookAt(0, 0.66, 0);
  ED.r.render(ED.scene, ED.cam);
}

function edLoad(h) { ED.cur = edClone(h); ED.dirty = true; edSync(); }
function edOpen() {
  if (!ED.ready) {
    edBuildPanel(); edPreviewInit(); ED.ready = true;
    $('edPanel').addEventListener('click', e => {
      const b = e.target.closest('button[data-k]'); if (!b) return;
      const k = b.dataset.k;
      if (b.dataset.t) edSet(k, !ED.cur[k]); else if (b.dataset.v !== undefined) edSet(k, b.dataset.v); else edSet(k, b.dataset.c);
      SFX.click();
    });
    $('edPanel').addEventListener('input', e => { if (e.target.tagName === 'INPUT') { ED.cur[e.target.dataset.k] = e.target.value; ED.dirty = true; edSyncSwatches(); } });
    $('edName').oninput = e => { ED.cur.name = e.target.value; };
    $('edList').onchange = e => { const h = heroById(e.target.value); if (h) edLoad(h); };
    $('edNew').onclick = () => edLoad(Object.assign(edClone(HERO_DEFAULT), { name: 'Новый герой' }));
    $('edCopy').onclick = () => { const c = edClone(ED.cur); delete c.id; c.name += ' (копия)'; edLoad(c); };
    $('edDel').onclick = () => {
      if (!ED.cur.id) { edLoad(HEROES.list[0] || HERO_DEFAULT); return; }
      HEROES.list = HEROES.list.filter(h => h.id !== ED.cur.id); HEROES.sel = HEROES.sel.map(s => s === ED.cur.id ? '' : s); heroSave(); heroApplyAll();
      edLoad(HEROES.list[0] || HERO_DEFAULT);
    };
    $('edRand').onclick = () => {
      const c = ED.cur, f = Math.random() < 0.5;
      Object.assign(c, { gender: f ? 'f' : 'm', skin: edPick(HERO_SWATCH.skin), hair: edPick(HERO_SWATCH.hair), hairStyle: edPick(HAIR_STYLES)[0], beard: f || Math.random() < 0.5 ? 'none' : edPick(BEARDS)[0], beardCol: '',
        top: edPick(HERO_SWATCH.cloth), topStyle: edPick(TOPS)[0], trim: edPick(HERO_SWATCH.cloth), pants: edPick(HERO_SWATCH.pants), legs: Math.random() < 0.2 ? 'shorts' : 'long', boots: Math.random() < 0.5, shoes: edPick(HERO_SWATCH.shoes),
        hat: Math.random() < 0.4 ? edPick(HATS)[0] : 'none', hatCol: edPick(HERO_SWATCH.cloth), glasses: Math.random() < 0.25 ? edPick(GLASSES)[0] : 'none', pack: Math.random() < 0.5, packCol: edPick(HERO_SWATCH.cloth) });
      ED.dirty = true; edSync(); SFX.click();
    };
    $('edVox').onclick = () => {
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([heroToVoxFile(genHeroVox(ED.cur))], { type: 'application/octet-stream' }));
      a.download = (ED.cur.name || 'hero').replace(/[^\wа-яё-]+/gi, '_') + '.vox'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    };
    $('edWalk').onclick = () => { ED.walk = !ED.walk; $('edWalk').classList.toggle('on', ED.walk); };
    $('edTurn').onclick = () => { ED.spin = !ED.spin; $('edTurn').classList.toggle('on', ED.spin); };
    $('edSave').onclick = () => { edSaveCur(); SFX.click(); };
    $('edDone').onclick = () => { edSaveCur(); HEROES.sel[G.pick] = ED.cur.id; heroSave(); edClose(); };
    $('edBack').onclick = () => edClose();
  }
  const h = heroById(HEROES.sel[G.pick]);
  ED.cur = edClone(h || HERO_PRESETS[0]); if (!h) delete ED.cur.id;
  ED.dirty = true; ED.open = true; ED.spin = true;
  G.state = 'editor'; showScreen(null); $('huds').style.display = $('top').style.display = $('help').style.display = 'none'; $('editor').style.display = 'flex';
  edSync(); requestAnimationFrame(edLoop);
}
function edSyncSwatches() { $('edPanel').querySelectorAll('button.sw').forEach(b => b.classList.toggle('on', (ED.cur[b.dataset.k] || '') === b.dataset.c)); }
function edSaveCur() {
  const c = ED.cur; c.name = (c.name || '').trim() || 'Герой';
  if (!c.id) { c.id = 'h' + Date.now().toString(36); HEROES.list.push(edClone(c)); }
  else { const i = HEROES.list.findIndex(h => h.id === c.id); if (i >= 0) HEROES.list[i] = edClone(c); else HEROES.list.push(edClone(c)); }
  heroSave(); heroApplyAll(); edSync();
}
function edClose() {
  ED.open = false; $('editor').style.display = 'none'; G.state = 'menu'; showScreen('menu'); menuMark(); heroApplyAll(); lookMark();
}
