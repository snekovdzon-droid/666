'use strict';
/* ---------- v0.27: тюрьма — вертикальные лестницы, низкий туман, пепел и тела на карте. Карту города модуль не трогает ---------- */
const MOOD = { on: MAPID !== 'city', bodiesOn: MAPID === 'prison', built: false };
const moodRnd = (() => { let s = 7741; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
const dimHex = (hex, k) => { const c = new THREE.Color(hex); return c.multiplyScalar(k).getHex(); };

/* ---- склейка коробок в один меш (тела, лестницы): одна отрисовка вместо сотен ---- */
const FACES = [[[1, 0, 0], [0, 0, -1], [0, 1, 0]], [[-1, 0, 0], [0, 0, 1], [0, 1, 0]], [[0, 1, 0], [1, 0, 0], [0, 0, -1]], [[0, -1, 0], [1, 0, 0], [0, 0, 1]], [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [-1, 0, 0], [0, 1, 0]]];
const newBatch = () => ({ pos: [], nor: [], col: [], idx: [] });
function pushBox(B, cx, cy, cz, sx, sy, sz, yaw, hex) {
  const c = Math.cos(yaw), s = Math.sin(yaw), col = new THREE.Color(hex), hx = sx / 2, hy = sy / 2, hz = sz / 2;
  for (const [n, u, v] of FACES) {
    const base = B.pos.length / 3;
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const lx = n[0] * hx + u[0] * a * hx + v[0] * b * hx, ly = n[1] * hy + u[1] * a * hy + v[1] * b * hy, lz = n[2] * hz + u[2] * a * hz + v[2] * b * hz;
      B.pos.push(cx + lx * c + lz * s, cy + ly, cz - lx * s + lz * c);
      B.nor.push(n[0] * c + n[2] * s, n[1], -n[0] * s + n[2] * c);
      B.col.push(col.r, col.g, col.b);
    }
    B.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
}
function batchMesh(B, shadow = true) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(B.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(B.nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(B.col, 3));
  g.setIndex(B.idx); g.computeBoundingSphere();
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true })); m.castShadow = shadow; m.receiveShadow = true; staticGroup.add(m); return m;
}

/* ---- вертикальные лестницы: упёрся в стену у основания — лезешь вверх; у края крыши напротив лестницы — вниз. Зомби их не используют ---- */
const LADS = [], LAD_B = newBatch();
function ladderOp(x, z, nx, nz) {                            // (x, z) — точка на стене, (nx, nz) — наружная нормаль
  const Bd = buildings.find(b => x - nx * 0.6 > b.x1 && x - nx * 0.6 < b.x2 && z - nz * 0.6 > b.z1 && z - nz * 0.6 < b.z2); if (!Bd) return;
  const H = Bd.H, tx = nz !== 0 ? 1 : 0, tz = nx !== 0 ? 1 : 0, rail = 0x4c5052, rung = 0x6c7072;
  const at = (lat, dn) => [x + nx * dn + tx * lat, z + nz * dn + tz * lat];                   // точка на плоскости лестницы: поперёк и от стены
  for (const sd of [-0.3, 0.3]) { const [px, pz] = at(sd, 0.07); pushBox(LAD_B, px, (H + 0.8) / 2, pz, 0.07, H + 0.8, 0.07, 0, rail); }
  for (let y = 0.35; y < H + 0.6; y += 0.4) { const [px, pz] = at(0, 0.07); pushBox(LAD_B, px, y, pz, tx ? 0.62 : 0.05, 0.05, tz ? 0.62 : 0.05, 0, rung); }
  LADS.push({ x, z, nx, nz, H, bx: x + nx * 0.5, bz: z + nz * 0.5, lx: x - nx * 0.9, lz: z - nz * 0.9, seen: false, hold: 0 });
}
Object.assign(MAP_OPS, { ladder: ladderOp });
function updateClimb(p, c, dt) {
  if (!LADS.length) return false;
  const mv = c.move > 0.35, dl = Math.hypot(c.wx, c.wz) || 1, dx = c.wx / dl, dz = c.wz / dl;
  if (p.climb) {
    const L = p.climb.L, up = mv ? dx * -L.nx + dz * -L.nz : 0, down = mv ? dx * L.nx + dz * L.nz : 0;
    p.climb.dir = up > 0.4 ? 1 : down > 0.4 ? -1 : 0;
    p.y += p.climb.dir * 3.4 * dt; p.x = L.x + L.nx * 0.38; p.z = L.z + L.nz * 0.38; p.yaw = p.yawT = Math.atan2(-L.nx, -L.nz); p.moving = false; p.still = true;
    if (p.y >= L.H) { p.x = L.lx; p.z = L.lz; p.y = L.H; p.vy = 0; p.climb = null; p.inv = Math.max(p.inv, 0.2); }
    else if (p.y <= 0) { p.x = L.bx; p.z = L.bz; p.y = 0; p.vy = 0; p.climb = null; }
    return true;
  }
  for (const L of LADS) {
    const onTop = Math.abs(p.y - L.H) < 0.15 && Math.hypot(p.x - L.lx, p.z - L.lz) < 0.7, onBase = p.y < 0.3 && Math.hypot(p.x - L.bx, p.z - L.bz) < 0.65;
    if (!onTop && !onBase) continue;
    if (onBase && !p.ladSeen && !(p.msgT > 0)) { p.ladSeen = true; toast(p, 'Лестница: иди к стене, чтобы залезть', '#bfe0ff'); }
    const want = onBase ? dx * -L.nx + dz * -L.nz : dx * L.nx + dz * L.nz;       // вверх — в стену; вниз — к краю крыши у лестницы
    if (mv && want > 0.65) {
      if (p.lhL !== L) { p.lhL = L; p.lhold = 0; }                              // удержание у лестницы — у каждого игрока своё
      p.lhold = (p.lhold || 0) + dt;
      if (p.lhold > (onBase ? 0.12 : 0.25)) { p.lhold = 0; p.climb = { L, dir: onBase ? 1 : -1 }; if (!onBase) p.y = L.H - 0.05; return true; }
    } else p.lhold = 0;
  }
  return false;
}

/* ---- низкий туман (два слоя над землёй) и пепел ---- */
let FOGL = null;
function fogTexture() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256; const g = cv.getContext('2d');
  for (let i = 0; i < 70; i++) {
    const x = moodRnd() * 256, y = moodRnd() * 256, r = 24 + moodRnd() * 50, a = 0.1 + moodRnd() * 0.16;
    for (const ox of [-256, 0, 256]) for (const oy of [-256, 0, 256]) {                  // бесшовно: рисуем со сдвигом на период
      const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r); gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
    }
  }
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
function initFog() {
  return;                                              // туман убран: на экране его не было видно
  if (!MOOD.on || QID === 'low' || FOGL) return;
  const base = fogTexture(); FOGL = [];
  const defs = [{ y: 0.32, rep: 3, op: 0.2, sp: [0.006, 0.002] }, { y: 0.85, rep: 2, op: 0.14, sp: [-0.004, 0.005] }];
  defs.forEach((d, i) => {
    if (i === 1 && QID === 'medium') return;
    const tex = base.clone(); tex.needsUpdate = true; tex.repeat.set(d.rep, d.rep);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(130, 130).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: d.op, depthWrite: false, color: 0xd8c8b0, fog: false }));
    m.position.y = d.y; m.renderOrder = 1; m.frustumCulled = false; scene.add(m); FOGL.push({ m, tex, d, sx: 0, sz: 0 });
  });
}
let ashAcc = 0;
function moodTick(dt) {
  if (!MOOD.on) return;
  if (!FOGL) initFog();
  const px = CAM.x, pz = CAM.z, n = G.night || 0;
  if (FOGL) for (const L of FOGL) {
    L.sx += L.d.sp[0] * dt; L.sz += L.d.sp[1] * dt; L.m.position.x = px; L.m.position.z = pz;
    L.tex.offset.set(px / 130 * L.d.rep + L.sx, -pz / 130 * L.d.rep + L.sz);          // туман привязан к миру, а не к камере
    L.m.material.color.setRGB(0.85 - 0.5 * n, 0.78 - 0.45 * n, 0.69 - 0.38 * n); L.m.material.opacity = L.d.op * (1 - 0.35 * n);
  }
  return;                                              // летающая пыль и пепел убраны
  ashAcc += (QID === 'low' ? 6 : QID === 'medium' ? 14 : 22) * dt;
  while (ashAcc >= 1) {
    ashAcc -= 1;
    const y = 3 + Math.random() * 4, vy = -(0.25 + Math.random() * 0.35);
    spawnP({ x: px + (Math.random() - 0.5) * 30, y, z: pz + (Math.random() - 0.5) * 26, vx: 0.45 + Math.random() * 0.35, vy, vz: (Math.random() - 0.5) * 0.25, s: 0.035 + Math.random() * 0.03, s1: 0.03, col: dimHex(Math.random() < 0.6 ? 0x8d8984 : 0x4a4743, 1 - 0.55 * n), life: y / -vy * 0.98 });
  }
}

/* ---- мёртвые тела: лежат всё время забега (одним мешем), рядом пятна крови на земле ---- */
const BODY_POS = [
  [46.4, 62.2, 'g'], [49.8, 62.8, 'i'], [48, 66.4, 's'], [47.2, 68.6, 'z'], [48.6, 72.5, 'i'], [46.9, 77, 's'], [49.3, 81.2, 'c'], [47.6, 88, 'z'], [50.2, 91.5, 'g'],
  [57, 72, 's'], [64.5, 72.8, 'c'], [58.5, 77, 'z'], [66, 80, 's'], [63, 85.6, 'i'], [68.2, 89, 'c'], [72, 84.5, 'z'], [57.5, 90.5, 's'],
  [10, 75, 'i'], [18, 73.4, 'z'], [22, 79, 'i'], [9, 81, 'c'], [14, 83, 'z'], [72, 77.5, 'g'], [73.5, 81.5, 'i'], [88, 77, 'z'], [80, 85, 'c'], [41.8, 72, 's'], [33, 77.5, 'g'], [36, 65.5, 'z'],
  [44, 47, 's'], [52, 48.4, 'z'], [48, 55.8, 'g'], [40, 50, 'c'], [56, 52, 'i'], [45, 43.2, 'g'], [51, 43.6, 'z'], [10, 43.7, 'i'], [16, 43.3, 'c'],
  [6, 57, 'i'], [12, 56.6, 'z'], [18, 58, 's'], [82, 57, 's'], [87, 56.4, 'z'], [91, 58.2, 'c'],
  [8, 20, 'g'], [14, 27, 'z'], [4, 12, 'c'], [30, 22.6, 'i'], [38, 21.8, 'z'], [58, 22.6, 'i'], [66, 22.2, 'g'], [47, 26.5, 's'], [49, 17.5, 'z'],
  [80, 25.5, 'g'], [88, 25, 'z'], [84, 30, 'i'], [85, 17, 's'], [80, 48, 'i'], [86, 42, 'z'], [90, 47.5, 'c'],
  [30, 4, 's'], [60, 4.5, 'g'], [48, 8.5, 'z'], [2.6, 56.8, 'i'], [93, 57.6, 's'], [47.4, 13, 'c'], [49, 20.5, 'z'],
];
const BODY_KIND = {                                          // торс, ноги, кожа, шапка
  g: { t: 0x2c3a5a, l: 0x262e44, sk: 0xc8a082, cap: 0x1c2438 },        // охранник
  i: { t: 0xc8601e, l: 0xb8581a, sk: 0xb08868, cap: null },            // заключённый
  s: { t: 0x4a5230, l: 0x3e4628, sk: 0xb89878, cap: 0x363c24 },        // солдат
  c: { t: 0xd4d0c4, l: 0x5a6a7c, sk: 0xc8a888, cap: null },            // врач или гражданский
  z: { t: 0x4c4e44, l: 0x3a3c36, sk: 0x6c8a54, cap: null },            // обычный зомби
};
const BODY_BLOOD = [];
function addBody(B, x, z, kind) {
  const K = BODY_KIND[kind], yaw = moodRnd() * TAU, c = Math.cos(yaw), s = Math.sin(yaw), P = (ox, oz) => [x + ox * c + oz * s, z - ox * s + oz * c];
  const box = (ox, oy, oz, w, h, l, ly, col) => { const [wx, wz] = P(ox, oz); pushBox(B, wx, oy, wz, w, h, l, yaw + ly, col); };
  const bend = (moodRnd() - 0.5) * 0.9, arm = 0.6 + moodRnd() * 1.6, side = moodRnd() < 0.5 ? 1 : -1;
  for (const rot of [0, Math.PI / 4]) { const [px, pz] = P(0, 0.05); pushBox(B, px, 0.006, pz, 0.95, 0.012, 0.95, yaw + rot, 0x4e100c); }     // лужа крови (восьмиугольник из двух квадратов)
  box(0, 0.1, 0.05, 0.44, 0.18, 0.5, 0, K.t);                                          // торс
  box(0.02 * side, 0.09, 0.42, 0.2, 0.17, 0.2, 0.2 * bend, K.sk);                      // голова
  if (K.cap) box(0.02 * side, 0.2, 0.42, 0.22, 0.05, 0.22, 0.2 * bend, K.cap);
  for (const sd of [-1, 1]) {
    const ly = sd * 0.12 + bend * sd, sl = Math.sin(ly), cl = Math.cos(ly), hx = sd * 0.12, hz = -0.28;          // нога: длинная ось уходит от таза к ступне
    box(hx - sl * 0.31, 0.07, hz - cl * 0.31, 0.15, 0.14, 0.62, ly, K.l);
    box(hx - sl * 0.66, 0.05, hz - cl * 0.66, 0.14, 0.1, 0.2, ly, 0x1e1a16);                                       // ботинок
    const a = arm + (sd > 0 ? (moodRnd() - 0.5) * 1.2 : 0), dx = sd * Math.sin(a), dz = Math.cos(a);               // рука: от плеча под углом (над головой, в сторону или вдоль тела)
    box(sd * 0.28 + dx * 0.25, 0.06, 0.2 + dz * 0.25, 0.11, 0.11, 0.5, Math.atan2(dx, dz), kind === 'z' ? K.sk : K.t);
  }
  BODY_BLOOD.push([x, z]);
}
function buildBodies() {
  if (MOOD.built || !MOOD.on || !MOOD.bodiesOn) return; MOOD.built = true;
  const B = newBatch(); let n = 0;
  for (const [bx, bz, kind] of BODY_POS) {
    let x = bx, z = bz, ok = false;                                                   // ближайшая свободная точка (не в стене, не на крыше, не на воротах)
    for (let r = 0; r <= 2.4 && !ok; r += 0.4) for (let a = 0; a < 6.28 && !ok; a += 0.9) { x = bx + Math.cos(a) * r; z = bz + Math.sin(a) * r; ok = !blocked(x, z, 0, 0.55) && floorAt(x, z, 0, 0.4) === 0 && !nearGate(x, z); }
    if (!ok) continue; addBody(B, x, z, kind); n++;
  }
  batchMesh(B); MOOD.bodies = n;
}
function nearGate(x, z) { for (const g of GATES) if (x > g.x1 - 0.8 && x < g.x2 + 0.8 && z > g.z1 - 0.8 && z < g.z2 + 0.8) return true; return false; }
function bodiesBlood() { for (const [x, z] of BODY_BLOOD) bloodDecal(x, z, 0.5 + moodRnd() * 0.3, moodRnd() - 0.5, moodRnd() - 0.5); }
function moodStart() {                                         // начало забега: лестницы строятся один раз, тела тоже, кровь под ними перерисовывается каждый забег
  if (!LAD_B.done && LAD_B.pos.length) { LAD_B.done = true; batchMesh(LAD_B, false); }
  for (const L of LADS) L.seen = false;
  if (!MOOD.on) return;
  buildBodies(); if (MOOD.bodiesOn) bodiesBlood();
}
