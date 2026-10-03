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
// Земля: сначала карта зон (какая зона в каждом пикселе), потом цвет. Границы мягких зон (земля, трава, гравий, асфальт, дорога, тёмная плитка)
// размываются: тип берётся из соседнего пикселя со случайным сдвигом до ~0,5 м, блоками по 3 пикселя — рваный край «из кубиков». Корты и плитка остаются резкими.
// Поверх шума — пятна побольше (светлее/темнее), пучки травы и камешки.
const SOFT_T = new Set(['dirt', 'grass', 'gravel', 'asphalt', 'road', 'dark']);
function hash2(x, y, s = 0) { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise(x, y, s) {                                          // гладкий шум по решётке
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function paintGround(zones) {
  const img = gctx.createImageData(GW, GW), d = img.data, Zi = new Int16Array(GW * GW);
  for (let k = 0; k < zones.length; k++) {                          // позже в списке — сверху
    const Z = zones[k], x1 = Math.max(0, Math.round(Z[1] * TPX)), x2 = Math.min(GW, Math.round(Z[3] * TPX)), y1 = Math.max(0, Math.round(Z[2] * TPX)), y2 = Math.min(GW, Math.round(Z[4] * TPX));
    for (let py = y1; py < y2; py++) Zi.fill(k + 1, py * GW + x1, py * GW + x2);
  }
  const typeOf = i => i ? zones[i - 1][0] : 'dirt';
  let seed = 7; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647, J = 8, CELL = 3;
  for (let py = 0; py < GW; py++) for (let px = 0; px < GW; px++) {
    const zi = Zi[py * GW + px], Z = zi ? zones[zi - 1] : null, own = Z ? Z[0] : 'dirt', x = px / TPX, z = py / TPX, n = r();
    let t = own;
    if (SOFT_T.has(own)) {                                           // размытая граница: тип из соседнего пикселя
      const hh = hash2(px / CELL | 0, py / CELL | 0, 3), ox = Math.round(((hh * 256) % 1 - 0.5) * 2 * J), oy = Math.round((hh - 0.5) * 2 * J);
      const nx = Math.min(GW - 1, Math.max(0, px + ox)), ny = Math.min(GW - 1, Math.max(0, py + oy)), nt = typeOf(Zi[ny * GW + nx]);
      if (SOFT_T.has(nt)) t = nt;
    }
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
    if (own === 'asphalt' && Z[5] && Z[5].lines && z >= Z[2] + 2 && z < Z[2] + 12 && (Math.abs(x - Math.round(x / 3) * 3) < 0.07 && z % 6 < 4.5)) c = [214, 208, 190];   // разметка парковки
    if (own === 'road' && Math.abs(x - (Z[1] + Z[3]) / 2) < 0.08 && z % 3 < 1.6) c = [214, 180, 60];
    else if (t !== 'court' && !(c[0] > 200)) {                      // пятна: крупные (по ~2 м) и средние (по ~0,5 м) светлее/темнее, мелкие детали по типу
      const k = 1 + (vnoise(x / 2.2, z / 2.2, 11) - 0.5) * 0.16 + (vnoise(x / 0.5, z / 0.5, 29) - 0.5) * 0.1;
      let rr = c[0] * k, gg = c[1] * k, bb = c[2] * k;
      const h2 = hash2(px >> 1, py >> 1, 17);
      if (t === 'grass' && h2 < 0.07) { rr *= 0.8; gg *= 0.88; bb *= 0.8; }                         // тёмные пучки травы
      else if (t === 'grass' && h2 > 0.975) { rr *= 1.12; gg *= 1.1; bb *= 0.9; }                   // светлая сухая травинка
      else if (t === 'dirt' && h2 < 0.04) { rr *= 0.78; gg *= 0.78; bb *= 0.78; }                   // тёмные комки
      else if (t === 'dirt' && h2 > 0.98) { rr *= 1.2; gg *= 1.18; bb *= 1.15; }                    // камешки
      else if (t === 'gravel' && h2 > 0.94) { rr *= 1.12; gg *= 1.12; bb *= 1.12; }
      else if ((t === 'asphalt' || t === 'road') && h2 < 0.015) { rr *= 0.7; gg *= 0.7; bb *= 0.7; } // трещинки
      c = [Math.min(255, rr), Math.min(255, gg), Math.min(255, bb)];
    }
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
        if (!o.geometry.attributes.normal) o.geometry.computeVertexNormals();   // колючка пришла без нормалей и материала
        o.material = new THREE.MeshLambertMaterial(map ? { map } : { color: 0x8a8a84 }); o.castShadow = o.receiveShadow = true; } });
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
/* ---------- v0.34: модели Meshy вместо кодовых объектов — машина, автобус, фонарь, щит, скамейка; мусорные баки и мешки;
   ящик с лутом; спираль колючки. На тюрьме и своих картах; город не трогаем (MESHY_MAP). Нет модели — старый код. ---------- */
const MESHY_MAP = MAPID !== 'city';
const useModel = n => MESHY_MAP && !!MODELS[n];
// поставить модель центром в cx,cz; sx/sy/sz — масштаб по осям модели; коллизия — габарит (o.solid=false — без неё, o.h — своя высота)
function modelPut(name, cx, cz, rot, sx, sy = sx, sz = sx, o = {}) {
  const m = MODELS[name].clone(); m.scale.set(sx, sy, sz); m.rotation.y = rot; m.position.set(cx, o.y || 0, cz);
  if (o.mat) m.traverse(q => { if (q.isMesh) q.material = o.mat; });
  (BOX_PARENT || staticGroup).add(m);
  if (o.solid !== false) {
    m.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(m), sh = o.shrink || 0;
    solids.push({ x1: b.min.x + sh, y1: 0, z1: b.min.z + sh, x2: b.max.x - sh, y2: o.h || b.max.y, z2: b.max.z - sh, mat: o.hit || 'metal', group: null });
  }
  return m;
}
const modelMap = name => { let t = null; MODELS[name].traverse(q => { if (!t && q.isMesh && q.material.map) t = q.material.map; }); return t; };
// Перекраска синей краски кузова в цвет col: окна, шины, хром и фары другого цвета или темнее — не трогаются
const RECOLOR = new Map();
function recolorMat(name, col, wreck) {
  const key = name + ':' + col + ':' + (wreck ? 1 : 0); if (RECOLOR.has(key)) return RECOLOR.get(key);
  const src = modelMap(name); if (!src || !src.image) return null;
  const img = src.image, cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
  const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0);
  const d = cx.getImageData(0, 0, cv.width, cv.height), a = d.data;
  const isBody = (r, g, b) => { const mx = Math.max(r, g, b), c = mx - Math.min(r, g, b); if (mx < 0.22 || c / mx < 0.22) return -1;
    let h = mx === r ? ((g - b) / c) % 6 : mx === g ? (b - r) / c + 2 : (r - g) / c + 4; h *= 60; if (h < 0) h += 360; return h >= 190 && h <= 235 ? c / mx : -1; };
  let sS = 0, sV = 0, n = 0;                                          // средняя насыщенность и яркость краски — от неё меряем новый цвет
  for (let i = 0; i < a.length; i += 16) { const r = a[i] / 255, g = a[i + 1] / 255, b = a[i + 2] / 255, s = isBody(r, g, b); if (s >= 0) { sS += s; sV += Math.max(r, g, b); n++; } }
  const refS = n ? sS / n : 0.45, refV = n ? sV / n : 0.55;
  const C = new THREE.Color(col), hsl = {}; C.getHSL(hsl);
  const tv = Math.max(C.r, C.g, C.b), ts = tv > 0 ? (tv - Math.min(C.r, C.g, C.b)) / tv : 0, th = hsl.h * 6;
  const kS = (ts * (wreck ? 0.6 : 1)) / refS, kV = (tv * (wreck ? 0.6 : 1)) / refV, dim = wreck ? 0.78 : 1;
  for (let i = 0; i < a.length; i += 4) {
    const r = a[i] / 255, g = a[i + 1] / 255, b = a[i + 2] / 255, s0 = isBody(r, g, b);
    if (s0 < 0) { if (wreck) { a[i] *= dim; a[i + 1] *= dim; a[i + 2] *= dim; } continue; }
    const v = Math.min(1, Math.max(r, g, b) * kV), s = Math.min(1, s0 * kS), c = v * s, X = c * (1 - Math.abs(th % 2 - 1)), m = v - c;
    const [rr, gg, bb] = th < 1 ? [c, X, 0] : th < 2 ? [X, c, 0] : th < 3 ? [0, c, X] : th < 4 ? [0, X, c] : th < 5 ? [X, 0, c] : [c, 0, X];
    a[i] = (rr + m) * 255; a[i + 1] = (gg + m) * 255; a[i + 2] = (bb + m) * 255;
  }
  cx.putImageData(d, 0, 0);
  const t = new THREE.CanvasTexture(cv); t.flipY = src.flipY; t.encoding = THREE.sRGBEncoding; t.wrapS = src.wrapS; t.wrapT = src.wrapT;
  const mt = new THREE.MeshLambertMaterial({ map: t }); RECOLOR.set(key, mt); return mt;
}
// Фонарь: столб в x,z, плафон смотрит в +x (как у кодового); свет — из плафона
function lampModel(x, z) {
  const S = 1.9;
  modelPut('m_lamp', x + 0.15 * S, z, Math.PI, S, S, S, { solid: false });
  solids.push({ x1: x - 0.12, y1: 0, z1: z - 0.12, x2: x + 0.12, y2: 3.6, z2: z + 0.12, mat: 'metal', group: null });
  const lx = x + 0.15 * S + 0.25 * S;
  const bulb = box(lx - 0.1, 2.46, z - 0.1, lx + 0.1, 2.52, z + 0.1, 0xfff0c0, { solid: false, cast: false, material: new THREE.MeshBasicMaterial({ color: 0x6a6450 }) });
  lamps.push({ x, z, bulb, lx, ly: 2.45 });
}
// Баскетбольный щит: кольцо смотрит к центру площадки (как у кодового)
function hoopModel(x, z) {
  const s = x < 84 ? 1 : -1;
  modelPut('m_hoop', x + 0.3 * s, z, s * Math.PI / 2, 2, 2, 2, { solid: false });
  solids.push({ x1: x - 0.1, y1: 0, z1: z - 0.1, x2: x + 0.1, y2: 3.4, z2: z + 0.1, mat: 'metal', group: null });
}
// Скамейка: длиной вдоль z, сидящий смотрит в +faceX; коллизия низкая, как у кодовой
function benchModel(x, z, faceX) {
  const s = faceX || 1;
  modelPut('m_bench', x, z, s * Math.PI / 2, 0.8, 0.8, 0.8, { h: 0.45, hit: 'wood', shrink: 0.04 });
}
// Мусорный бак: ставится, только если место свободно (rot — поворот)
function trashBinOp(x, z, rot = 0) {
  if (!useModel('m_bin')) return;
  const hx = Math.abs(Math.cos(rot)) * 0.62 + Math.abs(Math.sin(rot)) * 0.41, hz = Math.abs(Math.sin(rot)) * 0.62 + Math.abs(Math.cos(rot)) * 0.41;
  for (const q of solids) if (q.y1 < 1 && q.x1 < x + hx && q.x2 > x - hx && q.z1 < z + hz && q.z2 > z - hz) return;
  modelPut('m_bin', x, z, rot, 1, 1, 1, { hit: 'metal' });
}
// Мешки с мусором: 1–3 штуки кучкой, без коллизии
function trashBagOp(x, z) {
  if (!useModel('m_bag')) return;
  let sd = Math.abs(Math.sin(x * 12.9898 + z * 78.233)) * 43758.5453; const r = () => (sd = (sd * 9301 + 49297) % 233280) / 233280;
  const n = 1 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) { const a = r() * TAU, d = i ? 0.3 + r() * 0.15 : 0, s = 0.9 + r() * 0.4;
    modelPut('m_bag', x + Math.cos(a) * d, z + Math.sin(a) * d, r() * TAU, s, s * (0.8 + r() * 0.3), s, { solid: false }); }
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
