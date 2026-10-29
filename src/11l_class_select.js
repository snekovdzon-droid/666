'use strict';
/* ---------- Меню выбора класса: герой слева, карточки справа; в коопе второй герой справа, карточки по центру ----------
   Герой — тот же воксельный (внешность из редактора), поверх него вещи выбранного класса (GEAR в 01_data — как в бою).
   Один общий рендерер рисует обоих героев и копирует кадр в canvas каждой панели. */
const CV = { r: null, slots: [], pl: [0, 1], run: false, last: 0 };
const CV_BOX = new THREE.BoxGeometry(1, 1, 1), CV_MATS = new Map();
const cvMat = col => { let m = CV_MATS.get(col); if (!m) CV_MATS.set(col, m = new THREE.MeshLambertMaterial({ color: col })); return m; };
function cvSlot(s) {
  if (CV.slots[s]) return CV.slots[s];
  const cv = $('cmH' + s).querySelector('canvas'), sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(28, 1, 0.1, 30);
  sc.add(new THREE.HemisphereLight(0xfff4e0, 0x6a6a7a, 0.85));
  const dl = new THREE.DirectionalLight(0xffffff, 0.6); dl.position.set(2, 4, 5); sc.add(dl);
  const rim = new THREE.DirectionalLight(0x7a9cff, 0.35); rim.position.set(-3, 2, -3); sc.add(rim);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(0.7, 40), new THREE.MeshBasicMaterial({ color: 0x0a0806, transparent: true, opacity: 0.6 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = 0.002; sc.add(floor);
  const root = new THREE.Group(); sc.add(root);
  const S = CV.slots[s] = { cv, sc, cam, root, key: '', M: null, mat: null, parts: {}, gear: [], cls: null, yaw: s ? -0.5 : 0.5, base: s ? -0.5 : 0.5, drag: null, idle: 0 };
  cv.addEventListener('pointerdown', e => { S.drag = { x: e.clientX, yaw: S.yaw }; cv.setPointerCapture(e.pointerId); cv.style.cursor = 'grabbing'; });
  cv.addEventListener('pointermove', e => { if (S.drag) { S.yaw = S.drag.yaw + (e.clientX - S.drag.x) * 0.012; S.idle = 3; } });
  const up = () => { S.drag = null; cv.style.cursor = ''; }; cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  return S;
}
function cvHero(pl) {
  const h = heroById(HEROES.sel[pl]);
  return h || Object.assign({}, HERO_PRESETS[0], { top2: '#' + PLAYER_COL[pl].map(v => v.toString(16).padStart(2, '0')).join('') });
}
function cvBuild(s) {                                   // внешность героя игрока CV.pl[s] + вещи его класса
  const S = cvSlot(s), pl = CV.pl[s], hero = cvHero(pl), key = JSON.stringify(hero);
  if (S.key !== key) {
    S.key = key; S.cls = null;
    if (S.M) { S.root.clear(); for (const k of VOX_PARTS) S.M.parts[k].geo.dispose(); S.M.tex.dispose(); S.mat.dispose(); }
    const M = S.M = buildVoxModel(genHeroVox(hero)), W = VZ.W;
    S.mat = new THREE.MeshLambertMaterial({ map: M.tex }); S.parts = {};
    const body = new THREE.Group(); body.scale.set(1, VZ.H, 1); S.root.add(body);   // как в игре: рост ×H, ширина ×W
    for (const k of VOX_PARTS) {
      const g = new THREE.Group(), m = new THREE.Mesh(M.parts[k].geo, S.mat), pv = M.parts[k].pivot;
      g.position.set(pv[0] * W, pv[1], pv[2] * W); g.scale.set(W, 1, W); g.add(m); body.add(g); S.parts[k] = g;
    }
    S.gear = [];
  }
  const cls = CLASSES[G.guns[pl]] ? CLASSES[G.guns[pl]].id : '';
  if (S.cls !== cls || !S.gear.length && GEAR[cls]) {
    for (const m of S.gear) m.parent.remove(m); S.gear = []; S.cls = cls;
    for (const [k, col, sx, sy, sz, ox, oy, oz] of GEAR[cls] || []) {   // те же коробки, что рисует drawGear в бою
      const m = new THREE.Mesh(CV_BOX, cvMat(col)); m.scale.set(sx, sy, sz); m.position.set(ox, oy, oz); S.parts[k].add(m); S.gear.push(m);
    }
  }
}
function cvUpdate() {                                   // вызывается из menuMark: слоты, подписи, подсветка активного героя
  if (!$('cmH0')) return;
  const co = G.nPlayers > 1; document.body.classList.toggle('cmCoop', co); $('cmH1').classList.toggle('empty', !co);
  CV.pl = [0, co ? Math.max(1, G.pick) : 1];
  for (let s = 0; s < (co ? 2 : 1); s++) {
    const pl = CV.pl[s], C = CLASSES[G.guns[pl]], W = WEAPONS[G.guns[pl]], el = $('cmH' + s), act = !co || pl === G.pick || G.state === 'maps';
    cvBuild(s);
    el.classList.toggle('off', !act); el.style.borderLeftColor = co ? PLAYER_CSS[pl] : '';
    $('cmCls' + s).innerHTML = C ? `${C.name}<small>${W.name}</small>` : '';
  }
  if (!CV.run && (G.state === 'menu' || G.state === 'maps')) { CV.run = true; CV.last = performance.now(); requestAnimationFrame(cvLoop); }
}
function cvLoop(now) {
  if ((G.state !== 'menu' && G.state !== 'maps') || $('menu').style.display === 'none') { CV.run = false; return; }
  requestAnimationFrame(cvLoop);
  const dt = Math.min(0.05, (now - CV.last) / 1000); CV.last = now; const t = now / 1000;
  if (!CV.r) { CV.r = new THREE.WebGLRenderer({ alpha: true, antialias: true }); CV.r.outputEncoding = THREE.sRGBEncoding; }
  const dpr = Math.min(2, devicePixelRatio || 1);
  for (let s = 0; s < (G.nPlayers > 1 ? 2 : 1); s++) {
    const S = CV.slots[s]; if (!S || !S.M) continue;
    const w = Math.round(S.cv.clientWidth * dpr), h = Math.round(S.cv.clientHeight * dpr); if (!w || !h) continue;
    if (S.cv.width !== w || S.cv.height !== h) { S.cv.width = w; S.cv.height = h; }
    const r = CV.r; r.setPixelRatio(1); if (r.domElement.width !== w || r.domElement.height !== h) r.setSize(w, h, false);
    S.cam.aspect = w / h; S.cam.updateProjectionMatrix();
    if (S.idle > 0) S.idle -= dt; else if (!S.drag) S.yaw += (S.base + Math.sin(t * 0.7) * 0.55 - S.yaw) * Math.min(1, dt * 1.5);   // лёгкое покачивание, видно спереди и сбоку
    S.root.rotation.y = S.yaw; S.root.position.y = Math.sin(t * 1.6) * 0.004;
    const sw = Math.sin(t * 1.3) * 0.05; S.parts.armA.rotation.x = sw; S.parts.armB.rotation.x = -sw;
    S.cam.position.set(0, 0.95, w / h < 0.9 ? 3.7 : 3.2); S.cam.lookAt(0, 0.62, 0);
    r.setClearColor(0, 0); r.render(S.sc, S.cam);
    const g2 = S.cv.getContext('2d'); g2.clearRect(0, 0, w, h); g2.drawImage(r.domElement, 0, 0);
  }
}

/* ---------- карточки классов: уменьшенная модель ствола сверху, подпись снизу ---------- */
const CARD_TXT = {   // [название ствола, строки: [текст, '+' зелёный | '-' красный | '' обычный]]
  shotgun:  ['Дробовик', [['Укусивший зомби отталкивается', '+']]],
  sawnoff:  ['Обрез', [['Быстрый', '+'], ['−1 сердце', '-']]],
  rifle:    ['Автомат', []],
  mg:       ['Пулемёт', [['Медленный', '-'], ['+1 сердце', '+']]],
  revolver: ['Револьвер', [['Повышенный урон по особым зомби', '+']]],
  crossbow: ['Арбалет', [['Выше радиус сбора опыта', '+']]],
  smg:      ['Пистолет-пулемёт', [['Увеличенный подсумок', '+'], ['+1 слот под девайс', '+']]],
};
const CV_GUNIMG = {};
function cvGunImg(id) {                                  // картинка ствола сбоку (дуло вправо), рисуется один раз общим рендерером
  if (typeof GUN_CARD_IMG !== 'undefined' && GUN_CARD_IMG[id]) return GUN_CARD_IMG[id];   // детальный рендер из оригинальной модели
  if (CV_GUNIMG[id] !== undefined) return CV_GUNIMG[id];
  const G = gunModel(id); if (!G) return CV_GUNIMG[id] = '';
  if (!CV.r) { CV.r = new THREE.WebGLRenderer({ alpha: true, antialias: true }); CV.r.outputEncoding = THREE.sRGBEncoding; }
  const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight(0xfff4e0, 0x5a5a6a, 1.0)); const dl = new THREE.DirectionalLight(0xffffff, 0.7); dl.position.set(-2, 3, 1.5); sc.add(dl);
  const m = new THREE.Mesh(G.geo, GUN_MAT); sc.add(m);
  const bb = new THREE.Box3().setFromBufferAttribute(G.geo.attributes.position), c = bb.getCenter(new THREE.Vector3()), sz = bb.getSize(new THREE.Vector3());
  const W = 320, H = 160, cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 20), asp = W / H;
  const hw = Math.max(sz.z * 0.62, sz.y * 0.62 * asp), hh = hw / asp;                 // с запасом по краям
  cam.left = -hw; cam.right = hw; cam.top = hh; cam.bottom = -hh; cam.updateProjectionMatrix();
  const dir = new THREE.Vector3(-1, 0.32, -0.28).normalize();                           // слева-сверху-чуть спереди: дуло смотрит вправо
  cam.position.copy(c).addScaledVector(dir, 3); cam.lookAt(c);
  const r = CV.r; r.setPixelRatio(1); r.setSize(W, H, false); r.setClearColor(0, 0); r.render(sc, cam);
  return CV_GUNIMG[id] = r.domElement.toDataURL('image/png');
}
