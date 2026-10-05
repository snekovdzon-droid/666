'use strict';
/* ---------- Главное меню v0.76: ночное кладбище, рука из земли ----------
   Рука (assets/menu/hand.vox) разрезана по вокселям на ладонь и пять пальцев; пальцы изредка слегка вздрагивают,
   по «Одиночная игра» / «Кооп» сжимаются в кулак, и только потом открывается выбор класса.
   Сцена лёгкая: один тёплый свет (фонарь), без теней — на телефоне идёт так же, как на ПК. */
const MH = { scene: null, cam: null, hand: null, fingers: [], fistT: -1, cb: null, t0: 0, fail: false, lantern: null, lanternL: null, moonM: null };
const MH_S = 0.05;                                                    // размер вокселя руки в метрах (рука ≈ 3 м)
// Какой частью руки является воксель (x, z — по осям .vox; пальцы смотрят вверх по z, ладонь обращена к +y)
function mhPartOf(x, y, z) {
  if (z >= 47) return x <= 9 ? 'A' : x <= 15 ? 'B' : 'C';             // три длинных пальца
  if (z >= 38 && z <= 46 && x <= 5) return 'T';                        // большой палец (слева, торчит в сторону)
  if (z >= 39 && z <= 46 && x >= 21) return 'P';                       // мизинец справа
  return 'palm';
}
// свои пальцы: центр сгиба в осях .vox [x, z], на сколько сгибается в кулаке, пауза до начала сжатия, тик-частота вздрагивания
const MH_FING = {
  A: { piv: [5.5, 46.5], curl: 1.65, delay: 0.00, ph: 0.3 }, B: { piv: [12, 46.5], curl: 1.7, delay: 0.05, ph: 1.7 }, C: { piv: [18.5, 46.5], curl: 1.65, delay: 0.10, ph: 2.9 },
  T: { piv: [3, 40], curl: 1.1, delay: 0.16, ph: 4.1 }, P: { piv: [23.5, 40], curl: 1.45, delay: 0.12, ph: 5.3 },
};
const _mhLin = new THREE.Color();
const MH_FACES = [   // нормаль, углы (против часовой снаружи)
  [[1, 0, 0], [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]]], [[-1, 0, 0], [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]]],
  [[0, 1, 0], [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]]], [[0, -1, 0], [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]]],
  [[0, 0, 1], [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]]], [[0, 0, -1], [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]]],
];
// Воксели → геометрия без внутренних граней. В мире: X = −x (зеркало), Y = z (вверх), Z = y (ладонь смотрит на зрителя)
function mhGeo(list, occ, pal, org, mid) {
  const P = [], N = [], C = [], I = [], K = (x, y, z) => x + y * 64 + z * 4096;
  for (const v of list) {
    const [x, y, z, ci] = v, col = pal[ci - 1] || [128, 128, 128]; _mhLin.setRGB(col[0] / 255, col[1] / 255, col[2] / 255).convertSRGBToLinear();
    for (const [n, cs] of MH_FACES) {
      if (occ.has(K(x + n[0], y + n[1], z + n[2]))) continue;
      const b = P.length / 3;
      for (const c of cs) { P.push(-(x + c[0] - mid[0]) * MH_S - org[0], (z + c[2] - mid[2]) * MH_S - org[1], (y + c[1] - mid[1]) * MH_S - org[2]); C.push(_mhLin.r, _mhLin.g, _mhLin.b); N.push(-n[0], n[2], n[1]); }
      I.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setIndex(I);
  return g;
}
function mhBuildHand() {
  const M = parseVox(MENU_HAND_B64), vox = M.vox, occ = new Set(), K = (x, y, z) => x + y * 64 + z * 4096;
  let x0 = 99, x1 = -1, y0 = 99, y1 = -1, z0 = 99; for (const v of vox) { occ.add(K(v[0], v[1], v[2])); x0 = Math.min(x0, v[0]); x1 = Math.max(x1, v[0]); y0 = Math.min(y0, v[1]); y1 = Math.max(y1, v[1]); z0 = Math.min(z0, v[2]); }
  const mid = [(x0 + x1 + 1) / 2, (y0 + y1 + 1) / 2, z0];             // середина основания руки
  const root = new THREE.Group(), mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const parts = { palm: [], A: [], B: [], C: [], T: [], P: [] };
  for (const v of vox) parts[mhPartOf(v[0], v[1], v[2])].push(v);
  const palm = new THREE.Mesh(mhGeo(parts.palm, occ, M.pal, [0, 0, 0], mid), mat); root.add(palm);
  MH.fingers = [];
  for (const k of ['A', 'B', 'C', 'T', 'P']) {
    const F = MH_FING[k], org = [-(F.piv[0] - mid[0]) * MH_S, (F.piv[1] - mid[2]) * MH_S, 0];   // сустав пальца в мире
    const g = new THREE.Group(), m = new THREE.Mesh(mhGeo(parts[k], occ, M.pal, org, mid), mat); g.position.set(org[0], org[1], org[2]); g.add(m); root.add(g);
    MH.fingers.push({ k, g, F, next: 1 + Math.random() * 2.5, tw: -1, amp: 0 });
  }
  MH.hand = root; return root;
}
// Пиксельный логотип «MANY DEAD»: красные кубические буквы с чёрной подложкой и кровавыми подтёками
function mhLogo() {
  const G = { M: ['1100011', '1110111', '1111111', '1101011', '1100011', '1100011', '1100011'], A: ['0111110', '1100011', '1100011', '1111111', '1100011', '1100011', '1100011'],
    N: ['1100011', '1110011', '1111011', '1101111', '1100111', '1100011', '1100011'], Y: ['1100011', '1100011', '0110110', '0011100', '0011100', '0011100', '0011100'],
    D: ['1111100', '1100110', '1100011', '1100011', '1100011', '1100110', '1111100'], E: ['1111111', '1100000', '1100000', '1111100', '1100000', '1100000', '1111111'] };   // жирные буквы 7×7
  const CELL = 6, rows = ['MANY', 'DEAD'], W = (4 * 7 + 3) * CELL + 6, H = (7 * 2 + 2 + 4) * CELL + 6, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d'); let s = 5; const R = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const shade = (x, y) => { g.fillStyle = '#12040a'; g.fillRect(x + 3, y + 3, CELL, CELL); };
  const cell = (x, y, face, hi, lo) => { g.fillStyle = face; g.fillRect(x, y, CELL, CELL); g.fillStyle = hi; g.fillRect(x, y, CELL, 1); g.fillRect(x, y, 1, CELL); g.fillStyle = lo; g.fillRect(x, y + CELL - 1, CELL, 1); g.fillRect(x + CELL - 1, y, 1, CELL); };
  const cells = [], drips = [];
  rows.forEach((word, ri) => {
    const oy = ri * 9 * CELL;
    [...word].forEach((ch, li) => {
      const ox = li * 8 * CELL;
      drips.push(...G[ch][6].split('').map((b, gx) => b === '1' && R() > 0.45 ? [ox + gx * CELL + 1, oy + 7 * CELL, 1 + Math.floor(R() * (ri ? 3 : 2))] : null).filter(Boolean));   // подтёки с нижнего ряда
      G[ch].forEach((line, gy) => [...line].forEach((b, gx) => { if (b === '1') cells.push([ox + gx * CELL, oy + gy * CELL]); }));
    });
  });
  for (const [x, y] of cells) shade(x, y);                                                    // сначала все тени, потом лицевые грани — иначе тень закрывает соседние клетки
  for (const [x, y, n] of drips) for (let k = 0; k < n; k++) { g.fillStyle = '#12040a'; g.fillRect(x + 3, y + k * CELL + 3, CELL - 2, CELL); }
  for (const [x, y] of cells) cell(x, y, '#c0281c', '#e8503a', '#6e100c');
  for (const [x, y, n] of drips) for (let k = 0; k < n; k++) { g.fillStyle = k === n - 1 ? '#8a1810' : '#a81e14'; g.fillRect(x, y + k * CELL, CELL - 2, CELL); }
  return cv;
}
// Небо: тёмный градиент, звёзды, пиксельная луна с кратерами и ореолом
function mhSkyTex() {
  const w = 512, h = 256, cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d'); let s = 31; const R = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#070b1c'); gr.addColorStop(0.55, '#101a3a'); gr.addColorStop(1, '#2a3558'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(220,230,255,${0.25 + R() * 0.5})`; const sz = R() < 0.15 ? 2 : 1; g.fillRect(Math.floor(R() * w), Math.floor(R() * h * 0.7), sz, sz); }
  const mx = 372, my = 62; for (const [r, a] of [[46, 0.07], [36, 0.1], [28, 0.14]]) { g.fillStyle = `rgba(150,170,230,${a})`; g.beginPath(); g.arc(mx, my, r, 0, 7); g.fill(); }
  g.fillStyle = '#dfe6f4'; for (let yy = -20; yy <= 20; yy++) for (let xx = -20; xx <= 20; xx++) if (xx * xx + yy * yy <= 400) g.fillRect(mx + xx, my + yy, 1, 1);
  g.fillStyle = '#b4bfd8'; for (const [cx, cy, r] of [[-7, -6, 5], [6, 4, 4], [-2, 10, 3], [9, -9, 2]]) for (let yy = -r; yy <= r; yy++) for (let xx = -r; xx <= r; xx++) if (xx * xx + yy * yy <= r * r) g.fillRect(mx + cx + xx, my + cy + yy, 1, 1);
  const t = new THREE.CanvasTexture(cv); t.magFilter = THREE.NearestFilter; t.encoding = THREE.sRGBEncoding; return t;
}
function mhChurch() {
  const G = new THREE.Group(), wall = new THREE.MeshLambertMaterial({ color: 0x4a5070 }), roof = new THREE.MeshLambertMaterial({ color: 0x2c3048 }), glow = new THREE.MeshBasicMaterial({ color: 0xff8a1e, fog: false, toneMapped: false });
  const box = (w, h, d, x, y, z, m) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); G.add(b); return b; };
  box(7, 5, 12, 0, 2.5, 0, wall);                                                            // нава
  for (const sg of [-1, 1]) { const r = box(5.2, 0.5, 12.6, sg * 1.9, 5.7, 0, roof); r.rotation.z = -sg * 0.62; }   // двускатная крыша
  box(3.4, 10, 3.4, 0, 5, 7.4, wall);                                                        // колокольня
  const sp = new THREE.Mesh(new THREE.ConeGeometry(2.7, 5.5, 4), roof); sp.rotation.y = Math.PI / 4; sp.position.set(0, 12.7, 7.4); G.add(sp);
  box(0.25, 1.8, 0.25, 0, 16.3, 7.4, roof); box(1.1, 0.25, 0.25, 0, 16.6, 7.4, roof);            // крест
  box(1.0, 1.9, 0.2, 0, 8.3, 9.15, glow);                                                    // тёплое окно колокольни
  for (const x of [-2.2, 2.2]) box(0.9, 1.7, 0.2, x, 2.7, 6.05, glow);                       // окна нефа
  return G;
}
function mhBuild() {
  const S = MH.scene = new THREE.Scene(); S.background = new THREE.Color(0x0a1022); S.fog = new THREE.Fog(0x141b34, 16, 70);
  MH.cam = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 220);
  S.add(new THREE.HemisphereLight(0x6a78b8, 0x1a1822, 0.95));
  const moonL = new THREE.DirectionalLight(0xaabcff, 0.95); moonL.position.set(-6, 10, -9); S.add(moonL);
  const fill = new THREE.DirectionalLight(0x6a78b0, 0.5); fill.position.set(2, 3, 9); S.add(fill);
  const lan = MH.lanternL = new THREE.PointLight(0xff9a40, 1.5, 8, 1.5); lan.position.set(2.5, 0.8, 0.9); S.add(lan);
  // небо
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(190, 95), new THREE.MeshBasicMaterial({ map: mhSkyTex(), fog: false })); sky.position.set(0, 30, -95); S.add(sky);
  // земля
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const gx = cv.getContext('2d'), im = gx.createImageData(128, 128);
  for (let i = 0; i < 128 * 128; i++) { const h = hash2(i % 128, i >> 7, 9), k = 0.75 + vnoise((i % 128) / 20, (i >> 7) / 20, 5) * 0.5; im.data[i * 4] = (22 + h * 12) * k; im.data[i * 4 + 1] = (38 + h * 14) * k; im.data[i * 4 + 2] = (34 + h * 12) * k; im.data[i * 4 + 3] = 255; }
  gx.putImageData(im, 0, 0); const gt = new THREE.CanvasTexture(cv); gt.magFilter = THREE.NearestFilter; gt.wrapS = gt.wrapT = THREE.RepeatWrapping; gt.repeat.set(16, 16); gt.encoding = THREE.sRGBEncoding;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(160, 160).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: gt })); S.add(ground);
  let sd = 21; const R = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  // церковь вдали
  const ch = mhChurch(); ch.position.set(-1, 0, -46); ch.scale.setScalar(1.1); ch.rotation.y = 0.3; S.add(ch);
  // рука и земляной холм
  const hand = mhBuildHand(); hand.scale.setScalar(1); S.add(hand);
  const dirt = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial(), 70), dc = [0x3a2a20, 0x4a352a, 0x2c2019, 0x54402f, 0x33261d], m4 = new THREE.Matrix4(), cc = new THREE.Color();
  for (let i = 0; i < 70; i++) { const a = R() * 6.283, r = 0.25 + Math.pow(R(), 0.7) * 1.15, sz = 0.14 + R() * 0.2; m4.compose(new THREE.Vector3(Math.cos(a) * r, sz * 0.4 * (1.3 - r * 0.6), Math.sin(a) * r), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, R() * 3, 0)), new THREE.Vector3(sz, sz * 0.8, sz)); dirt.setMatrixAt(i, m4); dirt.setColorAt(i, cc.setHex(dc[i % 5]).convertSRGBToLinear()); }
  S.add(dirt);
  // трава пучками (зелёные столбики)
  const gn = 260, grass = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial(), gn), gc = [0x2f4a22, 0x3b5a28, 0x26401c, 0x4a6a30];
  for (let i = 0; i < gn; i++) { const near = i < 90, a = R() * 6.283, r = near ? 0.9 + R() * 2.2 : 3 + R() * 22, h = 0.18 + R() * 0.5; m4.compose(new THREE.Vector3(Math.cos(a) * r + 0.2, h / 2, Math.sin(a) * r * (near ? 1 : 0.8) - (near ? 0 : 3)), new THREE.Quaternion(), new THREE.Vector3(0.07, h, 0.07)); grass.setMatrixAt(i, m4); grass.setColorAt(i, cc.setHex(gc[i % 4]).convertSRGBToLinear()); }
  S.add(grass);
  // кладбище: надгробия, крест, ограда, деревья (модели из ассетов кладбища)
  const add = (id, x, z, rot = 0, sc = 1, mt = GY_MAT) => { const m = new THREE.Mesh(gyGeo(id), mt); m.position.set(x, 0, z); m.rotation.y = rot; m.scale.setScalar(sc); S.add(m); return m; };
  add('tomb3', 3.6, -1.2, -0.35, 2.4); add('tomb1', -3.4, -1.0, 0.3, 1.9); add('tomb2', 5.4, 0.8, -0.5, 1.5); add('tomb1', -5.8, -3.2, 0.2, 1.6);
  const wood = new THREE.MeshLambertMaterial({ color: 0x3a2a24 }), cross = new THREE.Group(); { const a = new THREE.Mesh(new THREE.BoxGeometry(0.34, 3.1, 0.34), wood), b = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.34, 0.34), wood); a.position.y = 1.55; b.position.y = 2.3; cross.add(a, b); cross.position.set(-3.6, 0, -2.4); cross.rotation.set(0, 0.2, 0.06); S.add(cross); }
  const W = 21 * 0.06; for (let i = -22; i < 22; i++) { add('gfence', i * W * 1.6 + W / 2, -11, 0, 1.6); add('gpillar', i * W * 1.6, -11, 0, 1.6); }
  for (let i = 0; i < 20; i++) add(['tomb1', 'tomb2', 'tomb3'][i % 3], -22 + R() * 44, -7 - R() * 12, (R() - 0.5) * 0.8, 1 + R() * 0.5);
  const DT = typeof DEAD_TREES !== 'undefined' ? DEAD_TREES : ['deadtree'], TM = typeof MX_MAT !== 'undefined' ? MX_MAT : GY_MAT;
  add('deadtree', -8.5, -3.5, 1.0, 2.4); add('deadtree', 9.5, -5, 2.0, 2.6);
  for (let i = 0; i < 16; i++) add(R() < 0.3 ? 'deadtree' : DT[Math.floor(R() * DT.length)], -30 + i * 4 + R() * 3, -16 - R() * 14, R() * 6, 2 + R() * 1.4, TM);
  // фонарь у холма
  const lg = new THREE.Group(), dk = new THREE.MeshLambertMaterial({ color: 0x1c1816 }), gl = new THREE.MeshBasicMaterial({ color: 0xff9a2a, toneMapped: false });
  { const b = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.08, 0.46), dk), c = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.5, 0.34), gl), t = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.5), dk), r = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.14), dk); b.position.y = 0.04; c.position.y = 0.33; t.position.y = 0.62; r.position.y = 0.72; lg.add(b, c, t, r); lg.position.set(2.5, 0, 0.9); S.add(lg); MH.lantern = lg; }
  // ползущий туман
  const fm = new THREE.MeshBasicMaterial({ color: 0x8a96c8, transparent: true, opacity: 0.06, depthWrite: false }); MH.fogs = [];
  for (let i = 0; i < 12; i++) { const f = new THREE.Mesh(new THREE.CircleGeometry(4 + R() * 4, 20).rotateX(-Math.PI / 2), fm); f.position.set(-22 + R() * 44, 0.2 + R() * 0.5, -2 - R() * 20); S.add(f); MH.fogs.push({ m: f, v: 0.12 + R() * 0.2 }); }
}
// «Играть»: пальцы сжимаются в кулак, затем вызывается cb (открывается выбор класса)
function menuFist(cb) {
  if (!MH.scene || MH.fail || MH.fistT >= 0) { cb(); return; }
  MH.fistT = 0; MH.cb = cb;
}
function mhReset() { MH.fistT = -1; MH.cb = null; for (const f of MH.fingers) { f.tw = -1; f.next = 1 + Math.random() * 2; } }
const _mhE = t => t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t);
function mhRender(T) {
  if (!MH.scene && !MH.fail) { try { mhBuild(); } catch (e) { console.warn('menu scene', e); MH.fail = true; } }
  if (MH.fail) { renderer.setRenderTarget(null); renderer.setScissorTest(false); renderer.setViewport(0, 0, innerWidth, innerHeight); renderer.setClearColor(0x000000, 1); renderer.clear(); return true; }
  const now = performance.now() / 1000, dt = Math.min(0.1, now - (MH.t0 || now)); MH.t0 = now;
  const cam = MH.cam, A = innerWidth / innerHeight; if (cam.aspect !== A) { cam.aspect = A; cam.updateProjectionMatrix(); }
  // кадр: рука правее центра (слева кнопки); на узком экране — по центру и чуть дальше
  const wide = A >= 1.15, dist = wide ? 8.2 : 11.5, xf = wide ? 0.68 : 0.5, halfW = Math.tan(20 * Math.PI / 180) * A * dist;
  cam.position.set(0, wide ? 1.55 : 2.2, dist); cam.lookAt(0, wide ? 1.65 : 1.9, 0);
  MH.hand.position.set((2 * xf - 1) * halfW, 0, 0); MH.hand.rotation.y = Math.sin(now * 0.35) * 0.05;
  // пальцы: лёгкое подёргивание (изредка один палец чуть сгибается и возвращается) или кулак
  if (MH.fistT >= 0) { MH.fistT += dt; if (MH.fistT > 0.95 && MH.cb) { const cb = MH.cb; MH.cb = null; cb(); } }
  for (const f of MH.fingers) {
    let a = 0.04 * Math.sin(now * 0.9 + f.F.ph) + 0.03;                                            // еле заметное «дыхание»
    if (f.tw >= 0) { f.tw += dt; a += f.amp * Math.sin(Math.min(1, f.tw / 0.28) * Math.PI); if (f.tw > 0.28) { f.tw = -1; f.next = 1.3 + Math.random() * 3.2; } }
    else if ((f.next -= dt) <= 0) { f.tw = 0; f.amp = 0.12 + Math.random() * 0.1; }
    if (MH.fistT >= 0) a = a * (1 - _mhE(MH.fistT / 0.4)) + f.F.curl * _mhE((MH.fistT - f.F.delay) / 0.4);
    f.g.rotation.x = a;
  }
  if (MH.fistT >= 0) { const sq = 1 - 0.03 * _mhE((MH.fistT - 0.35) / 0.2); MH.hand.scale.setScalar(sq); }
  else MH.hand.scale.setScalar(1);
  if (MH.lanternL) MH.lanternL.intensity = 1.35 + Math.sin(now * 7.1) * 0.08 + Math.sin(now * 13.3) * 0.05;
  for (const f of MH.fogs) { f.m.position.x -= f.v * dt; if (f.m.position.x < -26) f.m.position.x = 26; }
  renderer.setRenderTarget(null); renderer.setScissorTest(false); renderer.setViewport(0, 0, innerWidth, innerHeight);
  renderer.toneMappingExposure = 1.15; renderer.render(MH.scene, cam);
  return true;
}
// пиксельный логотип вместо текстового заголовка
{ const h = document.querySelector('.mmTitle'); if (h) { const cv = mhLogo(); cv.className = 'mmLogo'; h.setAttribute('aria-label', 'MANY DEAD'); h.textContent = ''; h.appendChild(cv); } }
