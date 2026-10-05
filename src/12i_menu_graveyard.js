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
    const [x, y, z, ci] = v, col = pal[ci - 1] || [128, 128, 128]; { let r = col[0], g2 = col[1], b2 = col[2]; if (!(r > g2 * 1.45 && r > 90)) { const L = 0.3 * r + 0.59 * g2 + 0.11 * b2; r = L * 0.98; g2 = L * 1.1; b2 = L * 0.88; } else { r *= 0.85; g2 *= 0.8; b2 *= 0.8; }   // кожа серо-зелёная, кровь остаётся красной
      _mhLin.setRGB(r / 255, g2 / 255, b2 / 255).convertSRGBToLinear(); }
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
// Небо под размер кадра (луна — круглая при любом соотношении сторон): тёмный градиент, звёзды, облачка, пиксельная луна с ореолом
function mhSkyTex(w, h) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d'); let s = 31; const R = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#050816'); gr.addColorStop(0.18, '#0a1330'); gr.addColorStop(0.33, '#1f2f58'); gr.addColorStop(1, '#1f2f58'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(220,230,255,${0.25 + R() * 0.55})`; g.fillRect(Math.floor(R() * w), Math.floor(R() * h * 0.28), 1, 1); }
  const mx = Math.round(w * 0.70), my = Math.round(h * 0.14), mr = Math.round(h * 0.07);
  for (const [k, a] of [[3.6, 0.05], [2.7, 0.08], [2.0, 0.12], [1.5, 0.2]]) { g.fillStyle = `rgba(150,175,235,${a})`; g.beginPath(); g.arc(mx, my, mr * k, 0, 7); g.fill(); }
  g.fillStyle = '#e4eaf6'; g.beginPath(); g.arc(mx, my, mr, 0, 7); g.fill();
  g.fillStyle = '#b7c3dc'; for (const [cx, cy, r] of [[-0.35, -0.3, 0.26], [0.3, 0.2, 0.2], [-0.1, 0.5, 0.14], [0.42, -0.45, 0.1], [-0.55, 0.15, 0.1]]) { g.beginPath(); g.arc(mx + cx * mr, my + cy * mr, r * mr, 0, 7); g.fill(); }
  for (let i = 0; i < 9; i++) { g.fillStyle = `rgba(90,110,170,${0.08 + R() * 0.08})`; const cw = w * (0.12 + R() * 0.2), cy = h * (0.08 + R() * 0.24); g.fillRect(R() * w, cy, cw, 2 + R() * 3); }   // полосы облаков
  const t = new THREE.CanvasTexture(cv); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.encoding = THREE.sRGBEncoding; return t;
}
// мягкий тёплый ореол (свечение фонаря и окна церкви): спрайт с аддитивным смешиванием
function mhGlow(sc, op) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,190,90,1)'); gr.addColorStop(0.35, 'rgba(255,140,50,0.45)'); gr.addColorStop(1, 'rgba(255,100,20,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: op, fog: false, toneMapped: false })); sp.scale.setScalar(sc); return sp;
}
function mhBuild() {
  const S = MH.scene = new THREE.Scene(); S.fog = new THREE.Fog(0x000000, 16, 90); S.fog.color.setRGB(0.016, 0.03, 0.09);    // цвета в «линейном» виде — как горизонт у неба
  MH.cam = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 220);
  S.add(new THREE.HemisphereLight(0x3a4a88, 0x0c0e18, 0.55));
  const moonL = new THREE.DirectionalLight(0x7f96e8, 0.65); moonL.position.set(-7, 9, -8); S.add(moonL);           // луна сзади-слева: холодная кайма
  const fill = new THREE.DirectionalLight(0x6a78b8, 0.5); fill.position.set(2, 3, 9); S.add(fill);
  const lan = MH.lanternL = new THREE.PointLight(0xff7a22, 1.6, 8, 1.6); S.add(lan);                                  // тёплый свет фонаря: отсвет на руке и плите
  // земля
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const gx = cv.getContext('2d'), im = gx.createImageData(128, 128);
  for (let i = 0; i < 128 * 128; i++) { const h = hash2(i % 128, i >> 7, 9), k = 0.7 + vnoise((i % 128) / 20, (i >> 7) / 20, 5) * 0.5; im.data[i * 4] = (14 + h * 8) * k; im.data[i * 4 + 1] = (22 + h * 9) * k; im.data[i * 4 + 2] = (22 + h * 8) * k; im.data[i * 4 + 3] = 255; }
  gx.putImageData(im, 0, 0); const gt = new THREE.CanvasTexture(cv); gt.magFilter = THREE.NearestFilter; gt.wrapS = gt.wrapT = THREE.RepeatWrapping; gt.repeat.set(20, 20); gt.encoding = THREE.sRGBEncoding;
  S.add(new THREE.Mesh(new THREE.PlaneGeometry(200, 200).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: gt })));
  let sd = 21; const R = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  // церковь вдали: маленькая, тёмная, в дымке; свечение окон — спрайтами
  MH.church = mhChurch(); MH.church.scale.setScalar(0.7); MH.church.rotation.y = 0.3; S.add(MH.church);
  MH.churchGlow = mhGlow(6, 0.55); MH.church.add(MH.churchGlow);
  MH.churchGlow.position.set(0, 8.3, 9.4);
  // всё, что стоит рядом с рукой (двигается вместе с ней): холм, рука, фонарь, плита, крест
  const near = MH.near = new THREE.Group(); S.add(near);
  const hand = mhBuildHand(); hand.position.y = 0.25; near.add(hand);
  const dirt = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial(), 110), dc = [0x3a2a20, 0x4a352a, 0x2c2019, 0x5a4432, 0x33261d, 0x241a15], m4 = new THREE.Matrix4(), cc = new THREE.Color();
  for (let i = 0; i < 110; i++) { const a = R() * 6.283, r = 0.2 + Math.pow(R(), 0.6) * 1.8, sz = 0.2 + R() * 0.3, hy = Math.max(0.05, (1.9 - r) * 0.3) * (0.5 + R() * 0.7); m4.compose(new THREE.Vector3(Math.cos(a) * r, hy * 0.5, Math.sin(a) * r * 0.9), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, R() * 3, 0)), new THREE.Vector3(sz, hy + sz * 0.3, sz)); dirt.setMatrixAt(i, m4); dirt.setColorAt(i, cc.setHex(dc[i % 6]).convertSRGBToLinear()); }
  near.add(dirt);
  const gn = 230, grass = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial(), gn), gcol = [0x24381a, 0x2e4a20, 0x1c2e15, 0x3a5a26];
  for (let i = 0; i < gn; i++) { const nr = i < 70, a = R() * 6.283, r = nr ? 1.4 + R() * 2.4 : 4 + R() * 20, h = 0.15 + R() * (nr ? 0.45 : 0.7); m4.compose(new THREE.Vector3(Math.cos(a) * r, h / 2, Math.sin(a) * r * (nr ? 0.8 : 0.9) - (nr ? 0 : 2)), new THREE.Quaternion(), new THREE.Vector3(0.07, h, 0.07)); grass.setMatrixAt(i, m4); grass.setColorAt(i, cc.setHex(gcol[i % 4]).convertSRGBToLinear()); }
  near.add(grass);
  const add = (id, x, z, rot = 0, sc = 1, mt = GY_MAT, parent = S) => { const m = new THREE.Mesh(gyGeo(id), mt); m.position.set(x, 0, z); m.rotation.y = rot; m.scale.setScalar(sc); parent.add(m); return m; };
  const dark = new THREE.MeshLambertMaterial({ vertexColors: true, color: new THREE.Color(0.85, 0.9, 1.15) });         // тёмные «ночные» силуэты деревьев и плит
  { const st = new THREE.MeshLambertMaterial({ color: 0x0d0f16 }), cr = new THREE.MeshLambertMaterial({ color: 0x050609 }), g = new THREE.Group();   // большая плита справа: широкая, наклонена, с крестом
    const a = new THREE.Mesh(new THREE.BoxGeometry(2.6, 3.0, 0.55), st); a.position.y = 1.5; g.add(a);
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.35, 0.5), st); top.position.set(0.1, 3.15, 0); g.add(top);
    for (const [w, h, y] of [[0.22, 1.2, 1.7], [0.8, 0.22, 2.0]]) { const c = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.1), cr); c.position.set(0, y, 0.3); g.add(c); }
    g.position.set(3.7, 0, -2.8); g.scale.setScalar(0.8); g.rotation.set(0, -0.5, 0.1); near.add(g); }
  const wood = new THREE.MeshLambertMaterial({ color: 0x120a08 }), cross = new THREE.Group(); { const a = new THREE.Mesh(new THREE.BoxGeometry(0.42, 3.8, 0.42), wood), b = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.42, 0.42), wood); a.position.y = 1.9; b.position.y = 2.9; cross.add(a, b); cross.position.set(-3.6, 0, -2.2); cross.rotation.set(0, 0.25, 0.07); near.add(cross); }
  // фонарь у холма (стекло горит, свет и ореол — от него)
  const lg = new THREE.Group(), dk = new THREE.MeshLambertMaterial({ color: 0x1c1816 }), gl = new THREE.MeshBasicMaterial({ color: 0xff7a18, toneMapped: false });
  { const b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.09, 0.5), dk), c = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.54, 0.36), gl), t = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.09, 0.56), dk), r = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), dk); b.position.y = 0.045; c.position.y = 0.36; t.position.y = 0.68; r.position.y = 0.8; lg.add(b, c, t, r); lg.position.set(2.0, 0, 1.3); near.add(lg); MH.lantern = lg; }
  const glow = MH.lanternGlow = mhGlow(2.3, 0.55); glow.position.set(2.0, 0.4, 1.4); near.add(glow);
  lan.position.set(1.5, 1.2, 1.3); near.add(lan);
  // кладбище на среднем плане: надгробия, обломки ограды, тёмные деревья-силуэты
  for (let i = 0; i < 26; i++) add(['tomb1', 'tomb2', 'tomb3'][i % 3], -14 + R() * 30, -4 - R() * 9, (R() - 0.5) * 0.9, 1.3 + R() * 0.9, GY_MAT);
  const W = 21 * 0.06 * 1.6; for (let i = -24; i < 24; i++) { if (R() < 0.12) continue; add('gfence', i * W + W / 2, -11.5, (R() - 0.5) * 0.08, 1.6, dark); if (i % 2 === 0) add('gpillar', i * W, -11.5, 0, 1.6, dark); }
  for (const [x, z, sc, r] of [[-7, -6, 3.4, 1.2], [13, -7, 3.6, 2.2], [-15, -14, 3.2, 3.1], [19, -15, 3.4, 4.0]]) add('deadtree', x, z, r, sc, dark);
  // ползущий туман у земли
  const fm = new THREE.MeshBasicMaterial({ color: 0x2a3560, transparent: true, opacity: 0.05, depthWrite: false }); MH.fogs = [];
  for (let i = 0; i < 12; i++) { const f = new THREE.Mesh(new THREE.CircleGeometry(4 + R() * 4, 20).rotateX(-Math.PI / 2), fm); f.position.set(-22 + R() * 44, 0.2 + R() * 0.5, -2 - R() * 20); S.add(f); MH.fogs.push({ m: f, v: 0.12 + R() * 0.2 }); }
  // пиксельная картинка: сцену рисуем в маленький буфер, растягиваем без сглаживания, красим и затемняем края
  const T = THREE, f16 = renderer.capabilities.isWebGL2;
  MH.rt = new T.WebGLRenderTarget(4, 4, { type: f16 ? T.HalfFloatType : T.UnsignedByteType, minFilter: T.NearestFilter, magFilter: T.NearestFilter, depthBuffer: true });
  MH.pp = new T.ShaderMaterial({ depthTest: false, depthWrite: false, uniforms: { t: { value: null }, aspect: { value: 1 }, ex: { value: 0.95 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `uniform sampler2D t; uniform float aspect, ex; varying vec2 vUv;
      vec3 aces(vec3 x){ x *= ex; return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
      void main(){
        vec3 c = aces(texture2D(t, vUv).rgb);
        c = pow(c, vec3(1.0 / 2.2));
        float L = dot(c, vec3(0.299, 0.587, 0.114));
        c += mix(vec3(-0.01, 0.012, 0.045), vec3(0.04, 0.012, -0.03), smoothstep(0.2, 0.75, L));      // синие тени, тёплые света
        c = (c - 0.42) * 1.12 + 0.42;
        vec2 d = (vUv - 0.5) * vec2(aspect, 1.0); c *= 1.0 - 0.55 * smoothstep(0.3, 1.0, length(d));   // виньетка
        c = floor(clamp(c, 0.0, 1.0) * 30.0 + 0.5) / 30.0;                                              // ограниченная палитра, как в пиксель-арте
        gl_FragColor = vec4(c, 1.0);
      }` });
  MH.ppS = new T.Scene(); MH.ppC = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1); const q = new T.Mesh(new T.PlaneGeometry(2, 2), MH.pp); q.frustumCulled = false; MH.ppS.add(q);
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
  // размер маленького буфера: ~270 строк (на телефоне крупнее пиксели), небо перерисовывается под соотношение сторон
  const rh = clamp(Math.round(innerHeight / (IS_TOUCH ? 2.8 : 3.4)), 160, 300), rw = Math.round(rh * A);
  if (MH.rt.width !== rw || MH.rt.height !== rh) { MH.rt.setSize(rw, rh); MH.pp.uniforms.aspect.value = A; if (MH.scene.background && MH.scene.background.dispose) MH.scene.background.dispose(); MH.scene.background = mhSkyTex(rw, rh); }
  // кадр: рука в нижней трети правее центра (слева кнопки); на узком экране — по центру и дальше
  const wide = A >= 1.15, dist = wide ? 9.5 : 13, xf = wide ? 0.70 : 0.5, tn = Math.tan(20 * Math.PI / 180) * A, sx = (xf, d) => (2 * xf - 1) * tn * d;
  cam.position.set(0, wide ? 3.2 : 3.6, dist); cam.lookAt(0, wide ? 1.9 : 2.3, 0);
  MH.near.position.set(sx(xf, dist), 0, 0); MH.near.scale.setScalar(wide ? 1 : 0.9);
  MH.church.position.set(sx(wide ? 0.52 : 0.5, dist + 46), 0, -46);
  MH.hand.rotation.y = Math.sin(now * 0.35) * 0.05;
  // пальцы: лёгкое подёргивание (изредка один палец чуть сгибается и возвращается) или кулак
  if (MH.fistT >= 0) { MH.fistT += dt; if (MH.fistT > 0.95 && MH.cb) { const cb = MH.cb; MH.cb = null; cb(); } }
  for (const f of MH.fingers) {
    let a = 0.04 * Math.sin(now * 0.9 + f.F.ph) + 0.03;                                            // еле заметное «дыхание»
    if (f.tw >= 0) { f.tw += dt; a += f.amp * Math.sin(Math.min(1, f.tw / 0.28) * Math.PI); if (f.tw > 0.28) { f.tw = -1; f.next = 1.3 + Math.random() * 3.2; } }
    else if ((f.next -= dt) <= 0) { f.tw = 0; f.amp = 0.12 + Math.random() * 0.1; }
    if (MH.fistT >= 0) a = a * (1 - _mhE(MH.fistT / 0.4)) + f.F.curl * _mhE((MH.fistT - f.F.delay) / 0.4);
    f.g.rotation.x = a;
  }
  MH.hand.scale.setScalar(wide ? 0.95 : 0.95); if (MH.fistT >= 0) MH.hand.scale.multiplyScalar(1 - 0.03 * _mhE((MH.fistT - 0.35) / 0.2));
  const fl = 1 + Math.sin(now * 7.1) * 0.05 + Math.sin(now * 13.3) * 0.03;                       // мерцание фонаря
  MH.lanternL.intensity = 1.6 * fl; MH.lanternGlow.material.opacity = 0.55 * fl;
  for (const f of MH.fogs) { f.m.position.x -= f.v * dt; if (f.m.position.x < -26) f.m.position.x = 26; }
  renderer.setRenderTarget(MH.rt); renderer.setScissorTest(false); renderer.setViewport(0, 0, rw, rh); renderer.toneMapping = THREE.NoToneMapping; renderer.render(MH.scene, cam);
  renderer.setRenderTarget(null); renderer.setViewport(0, 0, innerWidth, innerHeight); MH.pp.uniforms.t.value = MH.rt.texture; renderer.render(MH.ppS, MH.ppC);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  return true;
}
// пиксельный логотип вместо текстового заголовка
{ const h = document.querySelector('.mmTitle'); if (h) { const cv = mhLogo(); cv.className = 'mmLogo'; h.setAttribute('aria-label', 'MANY DEAD'); h.textContent = ''; h.appendChild(cv); } }
