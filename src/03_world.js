'use strict';
/* ---------- 1. Рендер, камера, свет ---------- */
// Качество графики (меню → Настройки → Графика; смена перезапускает страницу — сглаживание задаётся при создании контекста)
const QPRE = {
  high:   { name: 'Высокая', pr: 2,    scale: 1,    shadow: 2048, soft: true,  aa: true,  lamps: 3, search: 2, fire: 4, fx: 1,   cap: 1 },
  medium: { name: 'Средняя', pr: 1.25, scale: 0.85, shadow: 1024, soft: false, aa: true,  lamps: 2, search: 1, fire: 3, fx: 0.7, cap: 0.66 },
  low:    { name: 'Низкая',  pr: 1,    scale: 0.6,  shadow: 0,    soft: false, aa: false, lamps: 1, search: 1, fire: 2, fx: 0.4, cap: 0.4 },
};
QPRE.auto = Object.assign({}, QPRE.high, { name: 'Авто' });
const QDESC = {
  high: 'Полное разрешение, мягкие тени, сглаживание, до 900 зомби. Для мощных компьютеров.',
  medium: 'Около 85% разрешения, тени попроще, меньше света и частиц, до 600 зомби.',
  low: '60% разрешения, без теней и сглаживания, минимум света и частиц, до 360 зомби. Для слабых ноутбуков.',
  auto: 'Старт как «Высокая»; если FPS падает ниже 40 — игра сама снижает разрешение до 50%, затем отключает тени.',
};
document.body.classList.toggle('touch', IS_TOUCH);
const QID = (() => { const v = lsGet('quality', 'high'); return QPRE[v] ? v : 'high'; })();
const QS = Object.assign({}, QPRE[QID], { auto: QID === 'auto' });      // живые значения: у «Авто» разрешение подстраивается на ходу
const qPixelRatio = () => Math.min(devicePixelRatio, IS_TOUCH ? Math.min(1.5, QS.pr) : QS.pr) * QS.scale;
const renderer = new THREE.WebGLRenderer({ antialias: !IS_TOUCH && QS.aa, powerPreference: 'high-performance' });
renderer.setPixelRatio(qPixelRatio());
renderer.shadowMap.enabled = QS.shadow > 0;
renderer.shadowMap.type = QS.soft ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x201a18);
scene.fog = new THREE.Fog(0x201a18, 40, 80);

const cam = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 200);
const CAM = { yaw: Math.PI / 4, yawT: Math.PI / 4, zoom: 8, zoomT: 8, pitch: 0.62, x: 20, z: 20, kx: 0, kz: 0 };
function resize() {
  renderer.setSize(innerWidth, innerHeight);
  const a = innerWidth / innerHeight, h = CAM.zoom;
  cam.left = -h * a; cam.right = h * a; cam.top = h; cam.bottom = -h; cam.updateProjectionMatrix();
}
addEventListener('resize', resize);

const hemi = new THREE.HemisphereLight(0xffe2c0, 0x3a3028, 0.5); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffc890, 1.1);
sun.castShadow = QS.shadow > 0; sun.shadow.mapSize.set(QS.shadow || 1024, QS.shadow || 1024);
Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 120 });
sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
scene.add(sun); scene.add(sun.target);
// Замеры кадра и автоподстройка разрешения («Авто»): логика и отправка отрисовки в мс, при FPS < 40 разрешение падает до 50%, затем гаснут тени
const PERF = { tick: 0, render: 0 }, QA = { age: 0, low: 0, high: 0 };
const qualityTag = () => QS.name + ' ' + Math.round(QS.scale * 100) + '%' + (QS.shadow > 0 && !renderer.shadowMap.enabled ? ' · без теней' : '');
function setShadows(on) {
  if (renderer.shadowMap.enabled === on) return;
  renderer.shadowMap.enabled = on; sun.castShadow = on;
  scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => { m.needsUpdate = true; }); });
}
function qApplyScale() { renderer.setPixelRatio(qPixelRatio()); resize(); }
function perfSample(tickMs, renderMs, dt) {
  PERF.tick += (tickMs - PERF.tick) * 0.05; PERF.render += (renderMs - PERF.render) * 0.05;
  if (!QS.auto) return;
  if (G.state !== 'play' || G.paused || document.hidden) { QA.low = QA.high = 0; if (G.state === 'main' || G.state === 'menu') QA.age = 0; return; }
  QA.age += dt; if (QA.age < 6) return;                                  // прогрев: первые кадры после старта не считаем
  const fps = G.fps;
  if (fps < 40) { QA.low += dt; QA.high = 0; } else if (fps > 100) { QA.high += dt; QA.low = 0; } else { QA.low = Math.max(0, QA.low - dt); QA.high = 0; }
  if (QA.low > 2.5) {
    QA.low = 0;
    if (QS.scale > 0.5) { QS.scale = Math.max(0.5, +(QS.scale - 0.1).toFixed(2)); qApplyScale(); }
    else if (renderer.shadowMap.enabled) { setShadows(false); QS.fx = 0.5; MAX_ENEMIES = Math.max(300, Math.round(MAX_ENEMIES * 0.7)); }
  } else if (QA.high > 12 && QS.scale < 1) { QA.high = 0; QS.scale = Math.min(1, +(QS.scale + 0.05).toFixed(2)); qApplyScale(); }
}


/* ---------- 2. Мир: твёрдые коробки (AABB) + их отрисовка ---------- */
const solids = [];                    // { x1,y1,z1,x2,y2,z2, mat, group }
const staticGroup = new THREE.Group(); scene.add(staticGroup);
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const lamb = {};                      // кэш материалов по цвету
function mat(col, o = {}) {
  const k = col + JSON.stringify(o);
  return lamb[k] || (lamb[k] = new THREE.MeshLambertMaterial(Object.assign({ color: col }, o)));
}
// Коробка: x1..x2, y1..y2 (высота), z1..z2. solid — участвует в столкновениях
let BOX_PARENT = null;                // куда складывать коробки (группа для полупрозрачности), иначе staticGroup
function box(x1, y1, z1, x2, y2, z2, col, o = {}) {
  const m = new THREE.Mesh(boxGeo, o.material || mat(col, o.m || {}));
  m.scale.set(x2 - x1, y2 - y1, z2 - z1); m.position.set((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2);
  m.castShadow = o.cast !== false; m.receiveShadow = true;
  (o.parent || BOX_PARENT || staticGroup).add(m);
  if (o.solid !== false) solids.push({ x1, y1, z1, x2, y2, z2, mat: o.hit || 'concrete', group: o.parent || null });
  return m;
}
// Ограды крыш (парапеты) убраны: с крыши можно спрыгнуть (падение с высоты ранит на 1 сердце)
const PARAPETS = false;
function para(...a) { return PARAPETS ? box(...a) : null; }
// Сетка для быстрого поиска коробок
const SG = 2, sgrid = new Map();
function indexSolids() {
  sgrid.clear();
  for (const s of solids) for (let gx = Math.floor(s.x1 / SG); gx <= Math.floor(s.x2 / SG); gx++) for (let gz = Math.floor(s.z1 / SG); gz <= Math.floor(s.z2 / SG); gz++) {
    const k = gx * 1000 + gz; if (!sgrid.has(k)) sgrid.set(k, []); sgrid.get(k).push(s);
  }
}
// без нового Set на каждый вызов (его звали тысячи раз за кадр: частицы, зомби, пули): кольцо из 8 массивов + метка «уже добавлен»
const _snBuf = Array.from({ length: 8 }, () => []); let _snI = 0, _snQ = 0;
function solidsNear(x, z, r = 0) {
  const out = _snBuf[_snI = (_snI + 1) & 7], q = ++_snQ; out.length = 0;
  for (let gx = Math.floor((x - r) / SG); gx <= Math.floor((x + r) / SG); gx++) for (let gz = Math.floor((z - r) / SG); gz <= Math.floor((z + r) / SG); gz++) {
    const a = sgrid.get(gx * 1000 + gz); if (a) for (const s of a) if (s._q !== q) { s._q = q; out.push(s); }
  }
  return out;
}
// Высота опоры под точкой: самая высокая крыша коробки не выше y+STEP (0 — земля)
function floorAt(x, z, y, r = 0.18) {
  let f = 0;
  for (const s of solidsNear(x, z, r)) if (x + r > s.x1 && x - r < s.x2 && z + r > s.z1 && z - r < s.z2 && s.y2 <= y + STEP + 1e-4 && s.y2 > f) f = s.y2;
  return f;
}
// Мешает ли коробка стоять в круге (x,z,r) на высоте y
function blocked(x, z, y, r) {
  if (x < r || z < r || x > MAP - r || z > MAP - r) return true;
  for (const s of solidsNear(x, z, r)) {
    if (s.y2 <= y + STEP + 1e-4 || s.y1 >= y + BODY_H) continue;
    const cx = clamp(x, s.x1, s.x2), cz = clamp(z, s.z1, s.z2);
    if ((x - cx) ** 2 + (z - cz) ** 2 < r * r) return true;
  }
  return false;
}
function pointSolid(x, y, z) {
  for (const s of solidsNear(x, z)) if (x > s.x1 && x < s.x2 && z > s.z1 && z < s.z2 && y > s.y1 && y < s.y2) return s;
  return null;
}


/* ---------- 3. Земля: пиксельная текстура зон + слой крови ---------- */
const TPX = 16, GW = MAP * TPX;
const groundCv = document.createElement('canvas'); groundCv.width = groundCv.height = GW;
const gctx = groundCv.getContext('2d');
const decalCv = document.createElement('canvas'); decalCv.width = decalCv.height = GW;
const dctx = decalCv.getContext('2d');
function paintGround(zones) {
  const img = gctx.createImageData(GW, GW), d = img.data;
  const zoneAt = (x, z) => { let r = null; for (const Z of zones) if (x >= Z[1] && x < Z[3] && z >= Z[2] && z < Z[4]) r = Z; return r; };     // позже в списке — сверху
  let seed = 7; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let py = 0; py < GW; py++) for (let px = 0; px < GW; px++) {
    const x = px / TPX, z = py / TPX, Z = zoneAt(x, z), t = Z ? Z[0] : 'dirt', n = r();
    let c;
    if (t === 'dirt') c = n < 0.5 ? [128, 92, 60] : n < 0.85 ? [122, 88, 57] : [136, 99, 65];
    else if (t === 'asphalt' || t === 'road') c = n < 0.6 ? [62, 60, 58] : n < 0.9 ? [56, 54, 52] : [74, 72, 68];
    else if (t === 'grass') c = n < 0.5 ? [88, 112, 62] : n < 0.85 ? [80, 104, 56] : [98, 122, 70];
    else if (t === 'gravel') c = n < 0.5 ? [122, 116, 106] : n < 0.85 ? [112, 106, 96] : [132, 126, 116];
    else if (t === 'dark') c = n < 0.6 ? [92, 88, 84] : n < 0.9 ? [84, 80, 76] : [102, 98, 94];
    else if (t === 'court') {
      c = n < 0.6 ? [150, 78, 58] : [142, 72, 54];
      const bx = Math.min(x - (Z[1] + 0.5), Z[3] - 0.5 - x), bz = Math.min(z - (Z[2] + 0.5), Z[4] - 0.5 - z);
      if (Math.abs(bx) < 0.07 && bz > -0.07 || Math.abs(bz) < 0.07 && bx > -0.07 || Math.abs(x - (Z[1] + Z[3]) / 2) < 0.07 && bz > 0) c = [220, 214, 200];
    } else { c = n < 0.6 ? [170, 162, 146] : [160, 152, 138]; if (px % 32 === 0 || py % 32 === 0) c = [138, 130, 118]; }
    if (t === 'asphalt' && Z[5] && Z[5].lines && z >= Z[2] + 2 && z < Z[2] + 12 && (Math.abs(x - Math.round(x / 3) * 3) < 0.07 && z % 6 < 4.5)) c = [214, 208, 190];   // разметка парковки
    if (t === 'road' && Math.abs(x - (Z[1] + Z[3]) / 2) < 0.08 && z % 3 < 1.6) c = [214, 180, 60];
    const o = (py * GW + px) * 4; d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
  }
  gctx.putImageData(img, 0, 0);
}
const groundTex = new THREE.CanvasTexture(groundCv); groundTex.magFilter = THREE.NearestFilter; groundTex.encoding = THREE.sRGBEncoding;
// Слой крови и следов — плитками 4×4: меняется только плитка, где упала капля (раньше вся текстура 1536² каждые 0,25 с)
const DT = MAP / 4, DTP = DT * TPX, decalTiles = [];
for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
  const cv = document.createElement('canvas'); cv.width = cv.height = DTP;
  const tex = new THREE.CanvasTexture(cv); tex.magFilter = THREE.NearestFilter; tex.encoding = THREE.sRGBEncoding;
  decalTiles.push({ i, j, cv, ctx: cv.getContext('2d'), tex, dirty: false });
}
function decalMark(x, z, r = 0.5) {                 // клетки карты: пометить плитки под пятном
  const i1 = clamp(Math.floor((x - r) / DT), 0, 3), i2 = clamp(Math.floor((x + r) / DT), 0, 3), j1 = clamp(Math.floor((z - r) / DT), 0, 3), j2 = clamp(Math.floor((z + r) / DT), 0, 3);
  for (let j = j1; j <= j2; j++) for (let i = i1; i <= i2; i++) decalTiles[j * 4 + i].dirty = true;
}
function decalMarkAll() { for (const t of decalTiles) t.dirty = true; }
let decalAcc = 0;
function flushDecals(dt) {
  if ((decalAcc += dt) < 0.12) return; decalAcc = 0;
  for (const t of decalTiles) if (t.dirty) { t.dirty = false; t.ctx.clearRect(0, 0, DTP, DTP); t.ctx.drawImage(decalCv, t.i * DTP, t.j * DTP, DTP, DTP, 0, 0, DTP, DTP); t.tex.needsUpdate = true; }
}
{
  const g = new THREE.PlaneGeometry(MAP, MAP); g.rotateX(-Math.PI / 2);
  const gm = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: groundTex })); gm.position.set(MAP / 2, 0, MAP / 2); gm.receiveShadow = true; scene.add(gm);
  const tg = new THREE.PlaneGeometry(DT, DT); tg.rotateX(-Math.PI / 2);
  for (const t of decalTiles) { const dm = new THREE.Mesh(tg, new THREE.MeshLambertMaterial({ map: t.tex, transparent: true, depthWrite: false }));
    dm.position.set((t.i + 0.5) * DT, 0.01, (t.j + 0.5) * DT); dm.receiveShadow = true; scene.add(dm); }
  const out = new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x7a5a3c }));
  out.position.set(MAP / 2, -0.02, MAP / 2); out.receiveShadow = true; scene.add(out);
}
const SCORCHES = [];                  // подпалины карты: восстанавливаются после нового забега
function bloodDecal(x, z, r, dx = 0, dz = 0) {
  const px = x * TPX, pz = z * TPX, R = r * TPX;
  for (let i = 0; i < 5; i++) {
    const t = i === 0 ? 0 : rnd(0.5, 2.2), sx = px + dx * R * t + rnd(-R, R) * 0.4, sz = pz + dz * R * t + rnd(-R, R) * 0.4, s = Math.max(1, Math.round(R * (i ? rnd(0.15, 0.4) : rnd(0.5, 0.8))));
    dctx.fillStyle = ['#6e1410', '#861c16', '#561009'][i % 3];
    dctx.fillRect(Math.round(sx - s / 2), Math.round(sz - s / 2), s, s);
  }
  decalMark(x, z, r * 3);
}
function scorch(x, z, r) { dctx.fillStyle = 'rgba(20,16,12,.55)'; const s = r * TPX; dctx.beginPath(); dctx.arc(x * TPX, z * TPX, s, 0, TAU); dctx.fill(); decalMark(x, z, r); }


/* ---------- Модели из Meshy (GLB, сжатые meshopt + webp) ---------- */
// Параметры моделей: масштаб, сдвиг по высоте (у дерева центр модели посередине), коллизия
const MODEL_DEF = {
  tree:         { scale: 1.7, oy: 0.95, solid: { r: 0.2, h: 1.7 }, leaves: { r: 0.8, y1: 1.6, y2: 3.2 } },
  bush:         { scale: 1.0, oy: 0,    solid: null },
  cone:         { scale: 1.0, oy: 0,    solid: { r: 0.12, h: 0.35 }, hit: 'wood' },
};
const MODELS = {};
function loadModels() {
  if (!window.GLTFLoader || !window.MESHY_ASSETS) return Promise.resolve();
  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
  return Promise.all(Object.entries(MESHY_ASSETS).map(([k, url]) => new Promise(res => {
    loader.load(url, g => {
      g.scene.traverse(o => { if (o.isMesh) {                // единый стиль освещения: матовый Lambert с той же текстурой
        const map = o.material.map; if (map) map.encoding = THREE.sRGBEncoding;
        o.material = new THREE.MeshLambertMaterial({ map }); o.castShadow = o.receiveShadow = true; } });
      MODELS[k] = g.scene; res();
    }, undefined, e => { console.warn('модель', k, e); res(); });
  })));
}
// Поставить модель: x, z — центр основания, rot — поворот в радианах
function model(name, x, z, rot = 0, sc = 1) {
  const src = MODELS[name], D = MODEL_DEF[name] || { scale: 1, oy: 0 }; if (!src) return null;
  const m = src.clone(), s = D.scale * sc;
  m.scale.setScalar(s); m.rotation.y = rot; m.position.set(x, D.oy * s, z);
  (BOX_PARENT || staticGroup).add(m);
  if (D.solid === 'bbox') {
    const b = new THREE.Box3().setFromObject(m);
    solids.push({ x1: b.min.x, y1: 0, z1: b.min.z, x2: b.max.x, y2: b.max.y, z2: b.max.z, mat: D.hit || 'wood' });
  } else if (D.solid) {
    const r = D.solid.r * sc; solids.push({ x1: x - r, y1: 0, z1: z - r, x2: x + r, y2: D.solid.h * sc, z2: z + r, mat: D.hit || 'wood' });
  }
  if (D.leaves) { const r = D.leaves.r * sc; solids.push({ x1: x - r, y1: D.leaves.y1 * sc, z1: z - r, x2: x + r, y2: D.leaves.y2 * sc, z2: z + r, mat: 'wood', leaves: true }); }
  return m;
}

/* ---------- Воксельные модели персонажей: .vox → части тела → склеенные грани + текстура ----------
   1) читаем .vox; 2) режем на голову, тело, руки, ноги по координатам (у модели руки висят с просветом);
   3) склеиваем соседние грани в большие прямоугольники, цвета уходят в маленькую текстуру (вид не меняется);
   4) каждая часть — своя геометрия с точкой вращения (плечо, бедро, шея). Модель нормирована: рост = 1. */
function parseVox(b64) {
  const bin = atob(b64), d = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) d[i] = bin.charCodeAt(i);
  const dv = new DataView(d.buffer), tag = i => String.fromCharCode(d[i], d[i + 1], d[i + 2], d[i + 3]);
  let i = 8, size = null, vox = null, pal = null;
  while (i < d.length) {
    const id = tag(i), n = dv.getUint32(i + 4, true), m = dv.getUint32(i + 8, true), b = i + 12;
    if (id === 'MAIN') { i += 12; continue; }
    if (id === 'SIZE' && !size) size = [dv.getUint32(b, true), dv.getUint32(b + 4, true), dv.getUint32(b + 8, true)];
    if (id === 'XYZI' && !vox) { const c = dv.getUint32(b, true); vox = []; for (let j = 0; j < c; j++) vox.push([d[b + 4 + j * 4], d[b + 5 + j * 4], d[b + 6 + j * 4], d[b + 7 + j * 4]]); }
    if (id === 'RGBA') { pal = []; for (let j = 0; j < 256; j++) pal.push([d[b + j * 4], d[b + j * 4 + 1], d[b + j * 4 + 2]]); }
    i = b + n + m;
  }
  if (!pal) pal = Array.from({ length: 256 }, () => [180, 180, 180]);
  return { size, vox, pal };
}
// Части тела по долям размера (подходит для гуманоида в позе «руки вдоль тела»)
function voxPartOf(x, y, z, S) {
  const [sx, , sz] = S, aL = S.armL || sx * 0.14, aR = S.armR || sx * 0.86;     // у героев из редактора границы рук свои
  if (z >= sz * 0.78) return 'head';
  if (z <= sz * 0.765 && x < aL) return 'armA';
  if (z <= sz * 0.765 && x > aR) return 'armB';
  if (z < sz * 0.5) return x < sx / 2 ? 'legA' : 'legB';
  return 'body';
}
const VOX_PARTS = ['legA', 'legB', 'body', 'head', 'armA', 'armB'];
function buildVoxModel(src, recolor) {               // src — base64 .vox или готовые данные { size, vox, pal } из genHeroVox
  const M = typeof src === 'string' ? parseVox(src) : { size: src.size, vox: src.vox, pal: src.pal.slice() }; if (recolor) M.pal = M.pal.map(recolor);
  const S = M.size, s = 1 / S[2], cx = S[0] / 2, cy = S[1] / 2;
  const groups = {}; for (const k of VOX_PARTS) groups[k] = new Map();
  for (const [x, y, z, c] of M.vox) groups[voxPartOf(x, y, z, S)].set(x + ',' + y + ',' + z, c);
  // точки вращения (в вокселях): плечи — верх руки, бёдра — верх ноги, шея — низ головы
  const pivots = {};
  for (const k of VOX_PARTS) {
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (const key of groups[k].keys()) { const [x, y, z] = key.split(',').map(Number); x0 = Math.min(x0, x); x1 = Math.max(x1, x + 1); y0 = Math.min(y0, y); y1 = Math.max(y1, y + 1); z0 = Math.min(z0, z); z1 = Math.max(z1, z + 1); }
    const pz = k === 'head' ? z0 : k === 'body' ? z0 : z1 - (k.startsWith('arm') ? 1.5 : 0);
    pivots[k] = [(x0 + x1) / 2, (y0 + y1) / 2, pz];
  }
  // атлас: каждый склеенный прямоугольник — кусочек текстуры с рамкой в 1 пиксель
  const quads = [];
  const DIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  const geo = {};
  for (const k of VOX_PARTS) {
    const G = groups[k], list = [];
    for (const dir of DIRS) {
      const ax = dir.findIndex(v => v !== 0), [u, v] = [0, 1, 2].filter(a => a !== ax), layers = new Map();
      for (const [key, c] of G) {
        const p = key.split(',').map(Number), q = p.slice(); q[ax] += dir[ax];
        if (G.has(q.join(','))) continue;
        let L = layers.get(p[ax]); if (!L) layers.set(p[ax], L = new Map());
        L.set(p[u] + ',' + p[v], c);
      }
      for (const [layer, L] of layers) {
        const used = new Set(), cells = [...L.keys()].map(s => s.split(',').map(Number)).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
        for (const [a, b] of cells) {
          if (used.has(a + ',' + b)) continue;
          let w = 1; while (L.has((a + w) + ',' + b) && !used.has((a + w) + ',' + b)) w++;
          let h = 1; for (;;) { let ok = true; for (let t = 0; t < w; t++) if (!L.has((a + t) + ',' + (b + h)) || used.has((a + t) + ',' + (b + h))) { ok = false; break; } if (!ok) break; h++; }
          const px = [];
          for (let j = 0; j < h; j++) for (let t = 0; t < w; t++) { used.add((a + t) + ',' + (b + j)); px.push(L.get((a + t) + ',' + (b + j))); }
          const q = { part: k, ax, u, v, dir, layer: layer + (dir[ax] > 0 ? 1 : 0), a, b, w, h, px };
          list.push(q); quads.push(q);
        }
      }
    }
    geo[k] = list;
  }
  // упаковка в атлас полками
  const AW = 256; let ax0 = 0, ay0 = 0, rowH = 0;
  for (const q of quads) { const W = q.w + 2, H = q.h + 2; if (ax0 + W > AW) { ax0 = 0; ay0 += rowH; rowH = 0; } q.tx = ax0 + 1; q.ty = ay0 + 1; ax0 += W; rowH = Math.max(rowH, H); }
  const AH = Math.pow(2, Math.ceil(Math.log2(ay0 + rowH)));
  const cv = document.createElement('canvas'); cv.width = AW; cv.height = AH;
  const cx2 = cv.getContext('2d'), img = cx2.createImageData(AW, AH);
  const put = (x, y, c) => { const o = (y * AW + x) * 4, p = M.pal[c - 1]; img.data[o] = p[0]; img.data[o + 1] = p[1]; img.data[o + 2] = p[2]; img.data[o + 3] = 255; };
  for (const q of quads) for (let j = -1; j <= q.h; j++) for (let t = -1; t <= q.w; t++) put(q.tx + t, q.ty + j, q.px[clamp(j, 0, q.h - 1) * q.w + clamp(t, 0, q.w - 1)]);
  cx2.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv); tex.magFilter = tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false; tex.encoding = THREE.sRGBEncoding; tex.flipY = false;
  // вокселы → мир: x → x, z(верх) → y, y → −z (модель смотрит на −Y, у нас «вперёд» = +z)
  const W3 = (p, pv) => [(p[0] - pv[0]) * s, (p[2] - pv[2]) * s, -(p[1] - pv[1]) * s];
  const out = {};
  let tris = 0;
  for (const k of VOX_PARTS) {
    const pos = [], nor = [], uv = [], idx = [], pv = pivots[k];
    for (const q of geo[k]) {
      const corner = (du, dv) => { const p = [0, 0, 0]; p[q.ax] = q.layer; p[q.u] = q.a + du; p[q.v] = q.b + dv; return W3(p, pv); };
      const cs = [corner(0, 0), corner(q.w, 0), corner(q.w, q.h), corner(0, q.h)];
      const uvs = [[q.tx, q.ty], [q.tx + q.w, q.ty], [q.tx + q.w, q.ty + q.h], [q.tx, q.ty + q.h]].map(([x, y]) => [x / AW, y / AH]);
      const n = W3([q.dir[0], q.dir[1], q.dir[2]], [0, 0, 0]).map(v => Math.sign(v));
      const e1 = cs[1].map((v, i) => v - cs[0][i]), e2 = cs[2].map((v, i) => v - cs[0][i]);
      const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      const flip = cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2] < 0, base = pos.length / 3;
      for (let i = 0; i < 4; i++) { pos.push(...cs[i]); nor.push(...n); uv.push(...uvs[i]); }
      if (flip) idx.push(base, base + 2, base + 1, base, base + 3, base + 2); else idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
    g.computeBoundingSphere(); tris += idx.length / 3;
    out[k] = { geo: g, pivot: W3(pv, [cx, cy, 0]) };
  }
  return { parts: out, tex, tris, size: S };
}
