'use strict';
/* ---------- 4. Постройки ---------- */
const WALL = 0xb8a488, WALL2 = 0xa48f74, ROOF = 0x8a8072, RED = 0xa8382a, DARK = 0x221c1a;
const winMat = new THREE.MeshLambertMaterial({ color: 0x241e1c, emissive: 0xffb050, emissiveIntensity: 0 }), winMats = [winMat];
/* ---------- v0.39: фасады зданий (тюрьма и свои карты; город — как было) ----------
   Цоколь, грязь у земли, бортик по краю крыши, рамы и отливы окон, потёки под окнами, водосточные трубы,
   кондиционеры и щитки, кирпич под отбитой штукатуркой, заплатки на крыше, номера корпусов краской.
   Всё одной пачкой на здание (внутри группы здания — становится полупрозрачным вместе с ним). Коллизий не добавляет. */
const FACADE_ON = GRADE_ON;
const FONT35 = { '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001111001111', '4': '101101111001001', '5': '111100111001111', '6': '111100111101111', '7': '111001010010010', '8': '111101111101111', '9': '111101111001111' };
const darkHex = (hex, k) => { const c = new THREE.Color(hex); return c.multiplyScalar(k).getHex(); };
// грань стены: сторона, плоскость, наружу (±1), вдоль x или z
function faceOf(side, x1, z1, x2, z2) {
  return side === 'N' ? { side, alongX: true, p: z1, out: -1, a: x1, b: x2 } : side === 'S' ? { side, alongX: true, p: z2, out: 1, a: x1, b: x2 }
    : side === 'W' ? { side, alongX: false, p: x1, out: -1, a: z1, b: z2 } : { side, alongX: false, p: x2, out: 1, a: z1, b: z2 };
}
// коробка на грани: u1..u2 вдоль стены, y1..y2, отступ от стены d0, толщина dep
function fPut(FB, F, u1, u2, y1, y2, d0, dep, hex) {
  if (u2 - u1 < 0.005 || y2 - y1 < 0.005) return;
  const c = F.p + F.out * (d0 + dep / 2);
  if (F.alongX) pushBox(FB, (u1 + u2) / 2, (y1 + y2) / 2, c, u2 - u1, y2 - y1, dep, 0, hex);
  else pushBox(FB, c, (y1 + y2) / 2, (u1 + u2) / 2, dep, y2 - y1, u2 - u1, 0, hex);
}
// места на стене, которые заняты (лестницы, мостики, пожарные марши, двери): [u1, u2]
function facadeAvoid(F, extra) {
  const A = (extra || []).slice();
  const ops = typeof MAPDEF !== 'undefined' ? MAPDEF.ops : (typeof BASE_DEF !== 'undefined' ? BASE_DEF.ops : []);
  for (const op of ops || []) {
    if (op[0] === 'ladder') { const [, x, z] = op; if (F.alongX ? Math.abs(z - F.p) < 0.4 : Math.abs(x - F.p) < 0.4) { const u = F.alongX ? x : z; A.push([u - 0.9, u + 0.9]); } }
    else if (op[0] === 'bridge') { const [, a1, a2, b1, b2, , axis] = op; if (axis === 'x' && !F.alongX && F.p >= a1 - 0.3 && F.p <= a2 + 0.3) A.push([b1 - 0.6, b2 + 0.6]); if (axis === 'z' && F.alongX && F.p >= a1 - 0.3 && F.p <= a2 + 0.3) A.push([b1 - 0.6, b2 + 0.6]); }
  }
  return A;
}
const fFree = (A, u1, u2) => !A.some(([a, b]) => u2 > a && u1 < b);
// цоколь и грязь по низу стены (с пропусками), бортик крыши
function facadeBase(FB, F, H, col, skip, R, roofTop) {
  const plinth = 0x645c52, cap = 0x7a7266, dirt = darkHex(col, 0.8), trim = 0x6e665a;
  const segs = []; let a = F.a;
  for (const [s1, s2] of skip.slice().sort((p, q) => p[0] - q[0])) { if (s1 > a) segs.push([a, Math.min(s1, F.b)]); a = Math.max(a, s2); }
  if (a < F.b) segs.push([a, F.b]);
  for (const [u1, u2] of segs) {
    fPut(FB, F, u1, u2, 0, 0.5, 0, 0.05, plinth); fPut(FB, F, u1, u2, 0.5, 0.55, 0, 0.075, cap);
    for (let u = u1; u < u2 - 0.05; u += 0.35) { const h = 0.12 + R() * 0.38; fPut(FB, F, u, Math.min(u + 0.35, u2), 0.55, 0.55 + h, 0, 0.007, R() < 0.5 ? dirt : darkHex(col, 0.86)); }
  }
  const e = F.alongX ? 0 : 0.003;                                                     // торцевые бортики чуть ниже — углы не мерцают
  fPut(FB, F, F.a - (F.alongX ? 0.07 : 0), F.b + (F.alongX ? 0.07 : 0), roofTop - 0.18 + e, roofTop + 0.05 - e, 0, 0.07 - e, trim);   // бортик по краю крыши
  fPut(FB, F, F.a + e, F.b - e, roofTop - 0.22, roofTop - 0.18, 0, 0.03, darkHex(trim, 0.7));
}
// кирпич под отбитой штукатуркой
let BRK_N = 0;
function brickPatch(FB, F, uc, yc, w, h, R) {
  const dd = 0.012 + (BRK_N++ % 4) * 0.003;                                            // у каждой заплатки своя глубина
  fPut(FB, F, uc - w / 2, uc + w / 2, yc - h / 2, yc + h / 2, 0, dd, 0x5e5248);
  const BR = [0x8a4a34, 0x7a422e, 0x96543a, 0x6e3c2a];
  for (let r = 0, y = yc - h / 2 + 0.01; y < yc + h / 2 - 0.08; y += 0.1, r++) {
    const off = r & 1 ? 0.13 : 0, wr = w * (0.6 + 0.4 * Math.sin(r * 1.7 + uc));                 // рваный край: ряды разной длины
    for (let u = uc - wr / 2 + off; u < uc + wr / 2 - 0.12; u += 0.26) fPut(FB, F, u, u + 0.24, y, y + 0.08, dd, 0.012, BR[Math.floor(R() * 4)]);
  }
}
function drainPipe(FB, F, u, H, R) {
  const pc = R() < 0.4 ? 0x6e5040 : 0x6a6e70, br = 0x4a4c4e;
  fPut(FB, F, u - 0.06, u + 0.06, 0.25, H - 0.3, 0.03, 0.12, pc);
  fPut(FB, F, u - 0.12, u + 0.12, H - 0.42, H - 0.2, 0.02, 0.22, pc);                              // воронка
  for (let y = 0.9; y < H - 0.5; y += 1.25) fPut(FB, F, u - 0.09, u + 0.09, y, y + 0.05, 0, 0.08, br);   // хомуты
  fPut(FB, F, u - 0.06, u + 0.06, 0.08, 0.25, 0.03, 0.3, pc);                                       // колено
  if (R() < 0.5) fPut(FB, F, u - 0.065, u + 0.065, 1.4 + R(), 1.6 + R(), 0.025, 0.13, 0x7a4a30);    // ржавое пятно
}
function acUnit(FB, F, u, y) {
  fPut(FB, F, u - 0.32, u + 0.32, y, y + 0.46, 0, 0.26, 0x767a72);
  for (let k = 0; k < 4; k++) fPut(FB, F, u - 0.26, u + 0.1, y + 0.08 + k * 0.09, y + 0.12 + k * 0.09, 0.26, 0.01, 0x44463f);   // решётка
  fPut(FB, F, u + 0.14, u + 0.27, y + 0.1, y + 0.36, 0.26, 0.012, 0x4a4a46);
  fPut(FB, F, u - 0.36, u - 0.32, y - 0.04, y + 0.02, 0, 0.3, 0x5a5c5e); fPut(FB, F, u + 0.32, u + 0.36, y - 0.04, y + 0.02, 0, 0.3, 0x5a5c5e);   // кронштейны
  fPut(FB, F, u - 0.02, u + 0.02, y - 0.6, y, 0.02, 0.03, 0x2a2a28);                                 // трубка-слив
  pxStreak(FB, F, u + 0.2, y - 0.02, 0.1875, 4, 0x7a4a2a);                                           // ржавый потёк
}
function elecBox(FB, F, u, y) {
  fPut(FB, F, u - 0.22, u + 0.22, y, y + 0.6, 0, 0.12, 0x5c6458); fPut(FB, F, u - 0.08, u + 0.08, y + 0.38, y + 0.5, 0.12, 0.008, 0xc8a020);
  fPut(FB, F, u - 0.025, u + 0.025, y + 0.6, y + 1.6, 0.03, 0.04, 0x2a2a28);                         // кабель вверх
}
// номер краской из пиксельного шрифта 3×5: на стене (F) или на крыше (F = null, по центру cx, cz)
function paintDigits(FB, str, F, uc, yc, px, col, R, roof, flip) {
  const n = str.length, W = n * 4 - 1;
  for (let k = 0; k < n; k++) { const g = FONT35[str[k]]; if (!g) continue;
    for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) { if (g[r * 3 + c] !== '1' || R() < 0.12) continue;     // краска местами облезла
      const ux = flip ? -(k * 4 + c - W / 2) * px - px : (k * 4 + c - W / 2) * px;
      if (roof) pushBox(FB, roof.cx + ux + px / 2, roof.y + 0.006, roof.cz + (r - 2.5) * px + px / 2, px * 0.96, 0.01, px * 0.96, 0, col);
      else fPut(FB, F, uc + ux, uc + ux + px * 0.96, yc + (2 - r) * px, yc + (3 - r) * px - px * 0.04, 0, 0.012, col); }
  }
}
/* ---------- v0.40: вышки и КПП (тюрьма и свои карты; город — как было) ----------
   Вышка: четыре опоры с раскосами «лесенкой» из кубиков, площадки-кольца, лестница, будка с панелями и окнами, крыша в три ступени,
   прожектор на крыше. Коллизия прежняя (ствол 1,2×1,2 и будка). Всё — одной пачкой на вышку. */
function towerNew(x, z) {
  const B = newBatch(), P = (cx, cy, cz, sx, sy, sz, c) => pushBox(B, cx, cy, cz, sx, sy, sz, 0, c);
  const leg = 0x5e6062, brace = 0x4e5052, h = (x * 13 + z * 7) | 0, rust = 0x6e4630;
  P(x, 0.12, z, 1.7, 0.24, 1.7, 0x6a645a);                                                           // бетонная подушка
  for (const [dx, dz] of [[-0.62, -0.62], [0.62, -0.62], [-0.62, 0.62], [0.62, 0.62]]) {
    P(x + dx, 3.3, z + dz, 0.18, 6.2, 0.18, leg); P(x + dx, 0.3, z + dz, 0.3, 0.12, 0.3, 0x4a4c4e);   // опора и башмак
  }
  for (let y = 1.6; y < 6.3; y += 1.6) for (const s of [-1, 1]) { P(x, y, z + s * 0.62, 1.4, 0.1, 0.1, brace); P(x + s * 0.62, y, z, 0.1, 0.1, 1.4, brace); }   // кольца
  // раскосы: диагональ из кубиков на каждой грани и в каждом пролёте
  for (let y = 0.6; y < 6.3; y += 0.35) P(x + 0.18, y, z + 0.66, 0.4, 0.04, 0.05, 0x3e4042);          // ступени лестницы (южная грань)
  P(x - 0.02, 3.3, z + 0.66, 0.04, 6.2, 0.05, 0x3e4042); P(x + 0.38, 3.3, z + 0.66, 0.04, 6.2, 0.05, 0x3e4042);
  if (h % 3 === 0) P(x - 0.62, 2.4, z - 0.62, 0.2, 0.5, 0.2, rust);                                    // ржавчина на опоре
  // будка
  const cb = 0x58605a, cb2 = 0x4c544e, glass = 0x1e2426, post = 0x3e4240;
  P(x, 6.5, z, 2.1, 0.16, 2.1, 0x55585a);                                                              // пол
  for (const s of [-1, 1]) { P(x, 6.95, z + s * 0.9, 1.8, 0.74, 0.08, cb); P(x + s * 0.9, 6.95, z, 0.08, 0.74, 1.8, cb2); }   // нижние панели
  for (let k = -2; k <= 2; k++) for (const s of [-1, 1]) { P(x + k * 0.36, 6.95, z + s * 0.95, 0.03, 0.7, 0.02, 0x3e4642); P(x + s * 0.95, 6.95, z + k * 0.36, 0.02, 0.7, 0.03, 0x3e4642); }   // рёбра обшивки
  for (const s of [-1, 1]) { P(x, 7.48, z + s * 0.86, 1.7, 0.36, 0.04, glass); P(x + s * 0.86, 7.48, z, 0.04, 0.36, 1.7, glass); }   // окна (тёмное стекло)
  for (const [dx, dz] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) P(x + dx, 7.3, z + dz, 0.1, 1.0, 0.1, post);
  for (const s of [-1, 1]) for (const k of [-0.3, 0.3]) { P(x + k, 7.48, z + s * 0.9, 0.05, 0.4, 0.06, post); P(x + s * 0.9, 7.48, z + k, 0.06, 0.4, 0.05, post); }   // переплёты
  P(x, 7.31, z, 1.9, 0.04, 1.9, 0x4a524c);                                                             // подоконник по кругу
  P(x, 7.86, z, 2.4, 0.12, 2.4, 0x3e4042); P(x, 7.97, z, 1.8, 0.1, 1.8, 0x464a4c); P(x, 8.06, z, 1.0, 0.08, 1.0, 0x4e5254);   // крыша ступенями
  P(x + 0.6, 8.18, z - 0.6, 0.3, 0.24, 0.3, 0x2e3032); P(x + 0.6, 8.18, z - 0.42, 0.24, 0.18, 0.04, 0xb8b0a0);   // прожектор
  if (h % 2 === 0) { P(x - 0.7, 8.6, z + 0.7, 0.04, 1.1, 0.04, 0x2a2a2a); P(x - 0.7, 9.12, z + 0.7, 0.16, 0.03, 0.03, 0x2a2a2a); }   // антенна
  const m = batchMesh(B, true); staticGroup.remove(m); (BOX_PARENT || staticGroup).add(m);
  solids.push({ x1: x - 0.6, y1: 0, z1: z - 0.6, x2: x + 0.6, y2: 6.5, z2: z + 0.6, mat: 'metal', group: null });
  solids.push({ x1: x - 0.9, y1: 6.5, z1: z - 0.9, x2: x + 0.9, y2: 7.8, z2: z + 0.9, mat: 'metal', group: null });
}
// КПП: будка охраны с окнами, дверью, козырьком, кондиционером и вывеской «КПП»
FONT35['К'] = '101101110101101'; FONT35['П'] = '111101101101101';
const BLOCK_MESHES = [];
function boothNew(x, z) {
  const B = newBatch(), P = (cx, cy, cz, sx, sy, sz, c) => pushBox(B, cx, cy, cz, sx, sy, sz, 0, c);
  const x1 = x, x2 = x + 1.0, z1 = z - 1.2, z2 = z + 0.2, cx = (x1 + x2) / 2, cz = (z1 + z2) / 2, wc = 0x8c8a80;
  P(cx, 0.1, cz, 1.3, 0.2, 1.7, 0x6a645a);                                                              // фундамент
  P(cx, 0.6, cz, 1.0, 0.8, 1.4, wc); P(cx, 2.3, cz, 1.0, 0.6, 1.4, wc);                                   // низ и верх стен
  for (const [a, b] of [[x1 + 0.08, z1 + 0.08], [x2 - 0.08, z1 + 0.08], [x1 + 0.08, z2 - 0.08], [x2 - 0.08, z2 - 0.08]]) P(a, 1.5, b, 0.16, 1.0, 0.16, wc);
  P(cx, 1.5, cz, 0.9, 1.0, 1.3, 0x1c2224);                                                               // стекло по кругу
  for (const zz of [z1 + 0.35, cz, z2 - 0.35]) { P(x2 + 0.01, 1.5, zz, 0.03, 1.0, 0.05, 0x4a4a46); P(x1 - 0.01, 1.5, zz, 0.03, 1.0, 0.05, 0x4a4a46); }
  P(x2 + 0.02, 1.0, cz, 0.04, 0.05, 1.4, 0x6a6a64);                                                      // подоконник окна к дороге
  P(cx, 1.05, z2 + 0.01, 0.55, 1.9, 0.04, 0x4e5a56); P(cx + 0.18, 1.0, z2 + 0.04, 0.06, 0.04, 0.04, 0xb0a890);   // дверь с ручкой
  P(cx + 0.15, 2.72, cz, 1.6, 0.1, 2.0, 0x5a5c5e); P(cx + 0.15, 2.8, cz, 1.4, 0.06, 1.8, 0x4a4c4e);         // крыша с козырьком к дороге
  P(x1 - 0.14, 2.2, cz + 0.3, 0.26, 0.4, 0.55, 0x767a72);                                                 // кондиционер на задней стене
  P(x2 + 0.03, 2.38, cz, 0.04, 0.36, 1.0, 0x2a4a6e);                                                       // синяя вывеска к дороге
  paintDigits(B, 'КПП', { alongX: false, p: x2 + 0.05, out: 1 }, cz, 2.25, 0.065, 0xe8e4d8, () => 0.9, null, true);
  P(x2 + 0.35, 0.5, z2 - 0.15, 0.06, 1.0, 0.06, 0x3a3c3c); P(x2 + 0.35, 1.1, z2 - 0.15, 0.3, 0.22, 0.06, 0xc8c4b8); P(x2 + 0.35, 1.1, z2 - 0.12, 0.2, 0.06, 0.01, 0xa02820);   // знак «стоп» у дороги
  const m = batchMesh(B, true); staticGroup.remove(m); (BOX_PARENT || staticGroup).add(m); m.material = m.material.clone(); m.material.userData.blocks = true; BLOCK_MESHES.push(m);
  solids.push({ x1, y1: 0, z1, x2, y2: 2.6, z2, mat: 'concrete', group: null });
}
// шлагбаум: тумба с противовесом и поднятая полосатая стрела
function barrierNew(x, z) {
  const B = newBatch(), P = (cx, cy, cz, sx, sy, sz, c) => pushBox(B, cx, cy, cz, sx, sy, sz, 0, c);
  P(x + 0.2, 0.5, z + 0.05, 0.36, 1.0, 0.36, 0x5a5c5e); P(x + 0.2, 1.05, z + 0.05, 0.42, 0.1, 0.42, 0x4a4c4e); P(x + 0.2, 0.75, z + 0.24, 0.2, 0.14, 0.02, 0xc8a020);
  P(x + 0.62, 1.0, z + 0.05, 0.5, 0.3, 0.24, 0x3a3c3c);                                                  // противовес
  const L = 3.6, a = 1.15;                                                                                 // стрела поднята на ~66°
  for (let i = 0; i < 30; i++) { const t = (i + 0.5) / 30, px = x + 0.2 - Math.cos(a) * L * t, py = 1.1 + Math.sin(a) * L * t; P(px, py, z + 0.05, 0.13, 0.13, 0.1, Math.floor(t * 9) & 1 ? 0xe0dcd0 : 0xb83a2a); }
  const m = batchMesh(B, true); staticGroup.remove(m); (BOX_PARENT || staticGroup).add(m);
  solids.push({ x1: x, y1: 0, z1: z - 0.15, x2: x + 0.4, y2: 1.1, z2: z + 0.25, mat: 'metal', group: null });
}
/* ---------- v0.44: воксельный стиль зданий ----------
   Шейдер (только материалы зданий): пиксельная «штукатурка» 16 пикс/м по мировым координатам грани + крупные пятна,
   на крышах — гравий; у отдельных построек (карцер, котельная, КПП) — кладка из блоков 0,4×0,2 м. Плюс AO у земли, как у всех. */
const AOPX_COMPILE = sh => {
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vAoY; varying vec3 vWP; varying vec3 vWN;')
    .replace('#include <project_vertex>', '#include <project_vertex>\n{ vec4 aoW = vec4(transformed, 1.0); vec3 aoN = objectNormal;\n#ifdef USE_INSTANCING\naoW = instanceMatrix * aoW; aoN = mat3(instanceMatrix) * aoN;\n#endif\nvec4 wp = modelMatrix * aoW; vAoY = wp.y; vWP = wp.xyz; vWN = normalize(mat3(modelMatrix) * aoN); }');
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vAoY; varying vec3 vWP; varying vec3 vWN;\nfloat pxH(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }')
    .replace('#include <color_fragment>', `#include <color_fragment>
      { vec3 an = abs(vWN); bool up = an.y > 0.5; vec2 uv = an.x > 0.5 ? vWP.zy : (an.z > 0.5 ? vWP.xy : vWP.xz);
        float n1 = pxH(floor(uv * 16.0 + 0.0013)), n2 = pxH(floor(uv * 4.0 + 0.0013) + 17.0);
        float k = 1.0 + (n1 - 0.5) * (up ? 0.16 : 0.09) + (n2 - 0.5) * 0.07;
#ifdef PX_BLOCKS
        if (!up) { vec2 b = uv / vec2(0.4, 0.2); float row = floor(b.y); b.x += mod(row, 2.0) * 0.5; vec2 bf = fract(b);
          k *= (bf.x < 0.08 || bf.y < 0.16) ? 0.78 : 1.0 + (pxH(floor(b) + 3.0) - 0.5) * 0.16; }
#endif
        diffuseColor.rgb *= k * mix(0.64, 1.0, smoothstep(0.0, 0.85, vAoY)); }`);
};
const AOPXB_COMPILE = sh => { sh.defines = Object.assign(sh.defines || {}, { PX_BLOCKS: 1 }); AOPX_COMPILE(sh); };   // кладка из блоков
// материалы зданий (стены, крыши, детали фасадов): пиксели; остальное — как раньше, только AO
function applyBuildingPixels() {
  if (!AO_ON) return;
  for (const B of buildings) if (B.grp) B.grp.traverse(m => {
    if (!m.isMesh) return;
    for (const mt of [].concat(m.material)) {
      if (!mt || !mt.isMeshLambertMaterial || (mt.transparent && !mt.depthWrite) || mt._px) continue;
      mt._px = true; mt.onBeforeCompile = (B.blocks || mt.userData.blocks) ? AOPXB_COMPILE : AOPX_COMPILE; mt.needsUpdate = true;
    }
  });
}
// пиксельные кластеры на грани: случайное блуждание по сетке 1/16 м
function pxCluster(FB, F, u0, y0, n, d0, col, R, cols) {
  const s = 0.0625, seen = new Set(); let u = Math.round(u0 / s), y = Math.round(y0 / s);
  for (let i = 0; i < n; i++) {
    const k = u + ',' + y;
    if (!seen.has(k)) { seen.add(k); const uu = u * s, yy = y * s; if (uu > F.a + 0.02 && uu < F.b - 0.08 && yy > 0.02) fPut(FB, F, uu, uu + s, yy, yy + s, d0, 0.004, cols ? cols[Math.floor(R() * cols.length)] : col); }
    const r = R(); if (r < 0.3) u++; else if (r < 0.6) u--; else if (r < 0.8) y--; else y++;
  }
}
// ступенчатый потёк вниз (пиксельная «лесенка», сужается)
function pxStreak(FB, F, u, ytop, w, steps, col, d0 = 0.009) {
  let y = ytop, ww = w;
  for (let i = 0; i < steps; i++) { const h = 0.125; fPut(FB, F, u - ww / 2, u + ww / 2, y - h, y, d0, 0.005, col); y -= h; ww = Math.max(0.0625, ww - 0.0625); }
}
// общий набор воксельных деталей для грани: светлая кромка углов и верха, сколы-кубики, выбоины, мох, пиксельная грязь
function facadeVoxel(FB, F, H, col, R, A) {
  const s = 0.0625, light = darkHex(col, 1.12), hole = darkHex(col, 0.55), L = F.b - F.a;
  fPut(FB, F, F.a, F.a + s, 0.55, H - 0.22, 0, 0.004, light); fPut(FB, F, F.b - s, F.b, 0.55, H - 0.22, 0, 0.004, light);    // светлые рёбра углов
  fPut(FB, F, F.a - (F.alongX ? 0.07 : 0), F.b + (F.alongX ? 0.07 : 0), H + 0.025, H + 0.05, 0.07, 0.004, 0x8e8676);      // светлая кромка бортика
  const n = Math.max(2, Math.round(L / 2.2));
  for (let i = 0; i < n; i++) {                                                                    // сколы: торчащие кубики штукатурки
    const u = F.a + 0.2 + R() * (L - 0.4), y = 0.6 + R() * R() * (H - 1.1); if (!fFree(A, u - 0.2, u + 0.2)) continue;
    const sz = s * (1 + Math.floor(R() * 2)); fPut(FB, F, u, u + sz, y, y + sz, 0, 0.03 + R() * 0.03, darkHex(col, 0.9 + R() * 0.16));
  }
  for (let i = 0; i < n; i++) {                                                                    // выбоины: тёмные пиксельные дыры
    const corner = R() < 0.35, u = corner ? (R() < 0.5 ? F.a + 0.05 : F.b - 0.25) : F.a + 0.3 + R() * (L - 0.6), y = corner ? (R() < 0.6 ? 0.6 + R() * 0.4 : H - 0.5 - R() * 0.3) : 0.7 + R() * (H - 1.3);
    if (!fFree(A, u - 0.2, u + 0.2)) continue; pxCluster(FB, F, u, y, 3 + Math.floor(R() * 5), 0, hole, R);
  }
  if (F.side === 'N' || F.side === 'W') for (let i = 0; i < Math.round(L / 3); i++) {              // мох с теневой стороны: на цоколе и над ним
    const u = F.a + 0.3 + R() * (L - 0.6); if (!fFree(A, u - 0.3, u + 0.3)) continue;
    pxCluster(FB, F, u, 0.3 + R() * 0.25, 8 + Math.floor(R() * 12), 0.05, 0, R, [0x4e5a30, 0x5a6838, 0x46522a]);
    if (R() < 0.5) pxCluster(FB, F, u, 0.6 + R() * 0.2, 4 + Math.floor(R() * 6), 0.01, 0, R, [0x4e5a30, 0x5a6838]);
  }
  for (let i = 0; i < Math.round(L / 4); i++) { const u = F.a + 0.3 + R() * (L - 0.6); if (fFree(A, u - 0.3, u + 0.3)) pxCluster(FB, F, u, 0.62 + R() * 0.3, 6 + Math.floor(R() * 8), 0.013, 0, R, [darkHex(col, 0.72), darkHex(col, 0.8)]); }   // грязь пикселями
}
// крыша: мусор-кубики, лужи пикселями, тёмная полоса грязи у бортика (всё без теней, в «плоской» пачке)
function roofVoxel(FB, x1, z1, x2, z2, top, R) {
  const RB = roofB(FB), s = 0.0625, pad = typeof EVC !== 'undefined' && EVC.PADC ? EVC.PADC : null;
  const onPad = (x, z) => pad && Math.abs(x - pad.x) < pad.hw + 0.4 && Math.abs(z - pad.z) < pad.hd + 0.4;
  for (const [a1, b1, a2, b2] of [[x1, z1, x2, z1 + 0.3], [x1, z2 - 0.3, x2, z2], [x1, z1 + 0.3, x1 + 0.3, z2 - 0.3], [x2 - 0.3, z1 + 0.3, x2, z2 - 0.3]]) pushBox(RB, (a1 + a2) / 2, top + 0.001, (b1 + b2) / 2, a2 - a1, 0.002, b2 - b1, 0, darkHex(ROOF, 0.86));
  const W = x2 - x1, D = z2 - z1;
  for (let i = 0; i < Math.round(W * D / 18); i++) {                                               // мусор
    const x = x1 + 0.6 + R() * (W - 1.2), z = z1 + 0.6 + R() * (D - 1.2); if (onPad(x, z)) continue; const h = s * (1 + Math.floor(R() * 2));
    pushBox(RB, x, top + h / 2, z, s * (1 + Math.floor(R() * 3)), h, s * (1 + Math.floor(R() * 2)), R() * 3, [0x5a544c, 0x6a6258, 0x4a3a2c][Math.floor(R() * 3)]);
  }
  for (let i = 0; i < Math.round(W * D / 70) + 1; i++) {                                            // лужи
    const cx = x1 + 1.5 + R() * Math.max(0.1, W - 3), cz = z1 + 1.5 + R() * Math.max(0.1, D - 3); if (onPad(cx, cz)) continue;
    let u = Math.round(cx / s), v = Math.round(cz / s); const seen = new Set();
    for (let k = 0; k < 40; k++) { const key = u + ',' + v; if (!seen.has(key)) { seen.add(key); pushBox(RB, u * s + s / 2, top + 0.0015, v * s + s / 2, s, 0.003, s, 0, R() < 0.85 ? 0x3e4448 : 0x5a646a); } const r = R(); if (r < 0.25) u++; else if (r < 0.5) u--; else if (r < 0.75) v++; else v--; }
  }
}
// плац на месте кладбища: разметка, флагшток, турники, пара шин
function placOp(x1, z1, x2, z2) {
  if (!FACADE_ON) return;
  const B = newBatch(), cx = (x1 + x2) / 2, cz = (z1 + z2) / 2, W = 0xb8b4a8, Y = 0xb89a40, line = (a1, b1, a2, b2, c) => pushBox(B, (a1 + a2) / 2, 0.003, (b1 + b2) / 2, a2 - a1, 0.004, b2 - b1, 0, c);
  void line; void W; void Y;                                                       // v0.45: разметки на асфальте нет
  const fx = cx, fz = z1 + 2.2;                                                                     // флагшток
  pushBox(B, fx, 0.15, fz, 0.9, 0.3, 0.9, 0, 0x6a645a); pushBox(B, fx, 3.3, fz, 0.12, 6.0, 0.12, 0, 0x8a8c8e); pushBox(B, fx, 6.36, fz, 0.2, 0.12, 0.2, 0, 0xb09040);
  for (let i = 0; i < 6; i++) pushBox(B, fx + 0.12 + i * 0.16, 5.7 - (i % 2) * 0.03, fz, 0.16, 0.62 - i * 0.03, 0.03, 0, i < 2 ? 0x8a2a20 : 0x9a3024);   // флаг, чуть провис
  solids.push({ x1: fx - 0.45, y1: 0, z1: fz - 0.45, x2: fx + 0.45, y2: 0.3, z2: fz + 0.45, mat: 'concrete', group: null }, { x1: fx - 0.08, y1: 0, z1: fz - 0.08, x2: fx + 0.08, y2: 6, z2: fz + 0.08, mat: 'metal', group: null });
  for (const z of [z1 + 9, z1 + 12.5, z1 + 16]) {                                                   // турники у западного края
    const x = x1 + 1.6; for (const dz of [-0.75, 0.75]) { pushBox(B, x, 1.1, z + dz, 0.1, 2.2, 0.1, 0, 0x3e4042); solids.push({ x1: x - 0.06, y1: 0, z1: z + dz - 0.06, x2: x + 0.06, y2: 2.2, z2: z + dz + 0.06, mat: 'metal', group: null }); }
    pushBox(B, x, 2.12, z, 0.05, 0.05, 1.55, 0, 0x6a6c6e);
  }
  batchMesh(B, true); const fl = B; void fl;
  tiresOp(x1 + 1.6, z2 - 2.2); tiresOp(x2 - 1.4, z1 + 1.6);
}
// v0.43: открытая сторона сарая: несущие столбы и балка-ригель под крышей (крыша больше не висит в воздухе)
function shedPortal(FB, x1, z1, x2, z2, H, o, grp, wm) {
  const ops = typeof MAPDEF !== 'undefined' ? MAPDEF.ops : [], busy = [];
  for (const op of ops) {                                                                  // что стоит внутри: машины, бочки — столб их не протыкает
    if (op[0] === 'car') { const [, cx, cz, ax] = op; busy.push(ax ? [cx - 0.3, cz - 0.3, cx + 3.6, cz + 1.9] : [cx - 0.3, cz - 0.3, cx + 1.9, cz + 3.6]); }
    else if (op[0] === 'barrel' || op[0] === 'xbarrel' || op[0] === 'crates' || op[0] === 'tires' || op[0] === 'pallets') busy.push([op[1] - 0.9, op[2] - 0.9, op[1] + 0.9, op[2] + 0.9]);
  }
  const hit = (a1, b1, a2, b2) => busy.some(q => a2 > q[0] && a1 < q[2] && b2 > q[1] && b1 < q[3]);
  const cs = 0.36, beam = 0.3, cc = darkHex(o.col || 0x86806e, 0.9);
  for (const side of [o.open, o.open2]) {
    if (!side) continue;
    const alongX = side === 'N' || side === 'S', at = side === 'N' ? z1 + cs / 2 : side === 'S' ? z2 - cs / 2 : side === 'W' ? x1 + cs / 2 : x2 - cs / 2;
    const a = alongX ? x1 : z1, b = alongX ? x2 : z2, n = Math.max(1, Math.ceil((b - a) / 4.6));
    // ригель под крышей по всей открытой стороне
    if (alongX) box(a, H - 0.25 - beam, at - cs / 2, b, H - 0.25, at + cs / 2, 0, { material: wm, parent: grp, solid: false });
    else box(at - cs / 2, H - 0.25 - beam, a, at + cs / 2, H - 0.25, b, 0, { material: wm, parent: grp, solid: false });
    for (let i = 0; i <= n; i++) {
      let u0 = a + (b - a) * i / n; u0 = Math.min(b - cs / 2, Math.max(a + cs / 2, u0));
      let u = null;
      for (const du of [0, 0.8, -0.8, 1.6, -1.6]) { const v = Math.min(b - cs / 2, Math.max(a + cs / 2, u0 + du)), r = alongX ? [v - cs / 2, at - cs / 2, v + cs / 2, at + cs / 2] : [at - cs / 2, v - cs / 2, at + cs / 2, v + cs / 2]; if (!hit(...r)) { u = v; break; } }
      if (u === null) continue;
      const [px1, pz1, px2, pz2] = alongX ? [u - cs / 2, at - cs / 2, u + cs / 2, at + cs / 2] : [at - cs / 2, u - cs / 2, at + cs / 2, u + cs / 2];
      box(px1, 0, pz1, px2, H - 0.25 - beam, pz2, 0, { material: wm, parent: grp, hit: 'concrete' });
      pushBox(FB, (px1 + px2) / 2, 0.25, (pz1 + pz2) / 2, cs + 0.1, 0.5, cs + 0.1, 0, 0x645c52);               // цоколь столба
      pushBox(FB, (px1 + px2) / 2, H - 0.25 - beam - 0.05, (pz1 + pz2) / 2, cs + 0.08, 0.1, cs + 0.08, 0, cc);  // капитель
    }
  }
}
/* ---------- v0.45: мостики, пожарные лестницы, порядок лестниц и окон ---------- */
// мостик между крышами: стальной настил-решётка на двух балках, перила со стойками, бортик, кронштейны у краёв
function bridgeNew(x1, x2, z1, z2, H, alongX) {
  const B = newBatch(), P = (cx, cy, cz, sx, sy, sz, c) => pushBox(B, cx, cy, cz, sx, sy, sz, 0, c);
  const L = alongX ? x2 - x1 : z2 - z1, Wd = alongX ? z2 - z1 : x2 - x1, cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
  const put = (u, y, v, su, sy, sv, c) => alongX ? P(x1 + u, y, cz + v, su, sy, sv, c) : P(cx + v, y, z1 + u, sv, sy, su, c);
  const fr = 0x4a4c4e, gr = 0x5e6062, rl = 0x7a3a2a, rs = 0x6e4630;
  put(L / 2, H - 0.03, 0, L, 0.06, Wd, 0x2c2e30);                                                          // тёмный низ решётки
  for (let u = 0.05; u < L; u += 0.16) put(u + 0.04, H - 0.01, 0, 0.08, 0.025, Wd - 0.12, gr);             // поперечные полосы решётки
  for (const v of [-Wd / 2 + 0.05, Wd / 2 - 0.05]) put(L / 2, H - 0.04, v, L, 0.1, 0.1, fr);               // окантовка
  for (const v of [-Wd / 2 + 0.35, Wd / 2 - 0.35]) { put(L / 2, H - 0.2, v, L, 0.24, 0.12, fr); put(L / 2, H - 0.32, v, L, 0.04, 0.26, fr); }   // две балки (двутавр)
  for (let u = 0.6; u < L - 0.3; u += 1.6) put(u, H - 0.2, 0, 0.08, 0.08, Wd - 0.7, fr);                   // поперечины между балками
  for (const v of [-Wd / 2 + 0.04, Wd / 2 - 0.04]) {
    put(L / 2, H + 0.06, v, L, 0.12, 0.03, fr);                                                              // бортик
    put(L / 2, H + 1.0, v, L, 0.06, 0.06, rl); put(L / 2, H + 0.52, v, L, 0.04, 0.04, rl);                   // поручень и средняя перекладина
    const np = Math.max(2, Math.round(L / 1.1)); for (let k = 0; k <= np; k++) put(0.04 + (L - 0.08) * k / np, H + 0.5, v, 0.06, 1.0, 0.06, rl);   // v0.53: стойки ровно от края до края
    for (const u of [0.04, L - 0.04]) { put(u, H + 1.06, v, 0.1, 0.06, 0.1, rl); put(u, H + 0.08, v, 0.12, 0.16, 0.12, fr); }   // одинаковые торцевые стойки с навершием и башмаком на обоих концах
  }
  for (const u of [0.25, L - 0.25]) for (const v of [-Wd / 2 + 0.35, Wd / 2 - 0.35]) { put(u, H - 0.55, v, 0.1, 0.5, 0.1, fr); put(u + (u < 1 ? 0.18 : -0.18), H - 0.75, v, 0.4, 0.08, 0.1, fr); }   // кронштейны к стенам
  for (const u of [0.1, L - 0.1]) put(u, H + 0.004, 0, 0.12, 0.012, Wd - 0.2, 0xb8a030);                   // жёлтые края
  put(L * 0.3, H - 0.2, Wd / 2 - 0.35, 0.4, 0.25, 0.13, rs); put(L * 0.7, H + 1.0, -Wd / 2 + 0.04, 0.5, 0.065, 0.065, rs);   // ржавчина
  batchMesh(B, true);
  solids.push({ x1, y1: H - 0.18, z1, x2, y2: H, z2, mat: 'metal', group: null });                           // настил — как раньше
  for (const v of [-Wd / 2 + 0.04, Wd / 2 - 0.04]) solids.push(alongX ? { x1, y1: H, z1: cz + v - 0.05, x2, y2: H + 1.1, z2: cz + v + 0.05, mat: 'metal', group: null, rail: true } : { x1: cx + v - 0.05, y1: H, z1, x2: cx + v + 0.05, y2: H + 1.1, z2, mat: 'metal', group: null, rail: true });   // v0.60: перила держат
}
// пожарная лестница: поверх прежней — решётка на ступенях, средняя перекладина, стойки, ограждение площадки, подкос снизу
function fireEscapeExtra(xs, xe, z1, z2, H, grp, y0) {
  const B = newBatch(), n = Math.ceil(H / 0.3), run = (xe - xs) / n, rise = H / n, dk = 0x4a1a14;
  for (let i = 0; i < n; i++) { const x = xs + i * run, top = y0 + (i + 1) * rise; for (let k = 1; k < 4; k++) pushBox(B, x + run * k / 4, top + 0.002, (z1 + z2) / 2, 0.02, 0.004, z2 - z1 - 0.2, 0, dk); }   // щели решётки
  for (let i = 1; i < n; i += 2) { const x = xs + i * run, top = y0 + (i + 1) * rise; pushBox(B, x + 0.02, top + 0.45, z2 - 0.03, 0.04, 0.9, 0.04, 0, 0x962f24); }   // частые стойки перил
  if (Math.abs(xe - xs) > 1) { const m = new THREE.Mesh(boxGeo, mat(0x962f24)), len = Math.hypot(xe - xs, H); m.scale.set(len, 0.04, 0.04); m.position.set((xs + xe) / 2, y0 + H / 2 + 0.45, z2 - 0.03); m.rotation.z = Math.atan2(H, xe - xs); grp.add(m); }   // средняя перекладина
  const br = new THREE.Mesh(boxGeo, mat(0x6e241c)), bl = Math.hypot((xe - xs) * 0.45, H * 0.5); br.scale.set(bl, 0.08, 0.08);                        // подкос
  br.position.set(xs + (xe - xs) * 0.75, y0 + H * 0.25, z2 - 0.1); br.rotation.z = -Math.atan2(H * 0.5, (xe - xs) * 0.45); br.castShadow = true; grp.add(br);
  const m = batchMesh(B, false); staticGroup.remove(m); grp.add(m);
  for (let i = 0; i < n; i++) { const a = xs + i * run, b = a + run, top = y0 + (i + 1) * rise; solids.push({ x1: Math.min(a, b), y1: top, z1: z2 - 0.1, x2: Math.max(a, b), y2: top + 1.0, z2: z2, mat: 'metal', group: null, rail: true }); }   // v0.60: перила марша держат
}
function landingRail(g1, g2, z2, H, grp) {                                                                   // ограждение площадки наверху
  const B = newBatch(), c = 0x962f24, zo = z2 + 1.27;
  pushBox(B, (g1 + g2) / 2, H + 0.95, zo, g2 - g1, 0.05, 0.05, 0, c); pushBox(B, (g1 + g2) / 2, H + 0.5, zo, g2 - g1, 0.04, 0.04, 0, c); pushBox(B, (g1 + g2) / 2, H + 0.06, zo, g2 - g1, 0.12, 0.03, 0, 0x7a2a20);
  for (let x = g1 + 0.03; x <= g2; x += (g2 - g1) / 3) pushBox(B, Math.min(x, g2 - 0.03), H + 0.5, zo, 0.05, 1.0, 0.05, 0, c);
  pushBox(B, g2 - 0.03, H + 0.5, z2 + 0.65, 0.05, 1.0, 0.05, 0, c); pushBox(B, g2 - 0.03, H + 0.95, z2 + 0.65, 0.05, 0.05, 1.3, 0, c);   // торец со стороны крыши
  solids.push({ x1: g1, y1: H, z1: zo - 0.05, x2: g2, y2: H + 1.0, z2: zo + 0.05, mat: 'metal', group: null, rail: true }, { x1: g2 - 0.08, y1: H, z1: z2, x2: g2, y2: H + 1.0, z2: z2 + 1.3, mat: 'metal', group: null, rail: true });   // v0.60: площадка держит
  const m = batchMesh(B, true); staticGroup.remove(m); grp.add(m);
}
// лестница не ставится в пожарный марш и его площадку (они налезали друг на друга)
function ladderClash(op) {
  if (op[0] !== 'ladder' || !FACADE_ON || typeof MAPDEF === 'undefined') return false;
  const [, x, z] = op;
  for (const o of MAPDEF.ops) {
    if (o[0] !== 'block' && o[0] !== 'shed') continue;
    const opt = (o[0] === 'block' ? o[6] : o[5]) || {}; if (!opt.gap || opt.esc === undefined) continue;
    const z2 = o[4]; if (x > opt.esc - 0.6 && x < opt.gap[1] + 0.6 && z > z2 - 0.6 && z < z2 + 1.9) return true;
  }
  return false;
}
// окна под вертикальными лестницами не делаем
function winUnderLadder(cx, cz, alongX) {
  if (!FACADE_ON || typeof MAPDEF === 'undefined') return false;
  return MAPDEF.ops.some(o => o[0] === 'ladder' && !ladderClash(o) && (alongX ? Math.abs(o[2] - cz) < 0.5 && Math.abs(o[1] - cx) < 0.95 : Math.abs(o[1] - cx) < 0.5 && Math.abs(o[2] - cz) < 0.95));
}
function finishFacade(FB, grp) {
  if (!FB) return;
  if (FB.pos.length) { const m = batchMesh(FB, true); staticGroup.remove(m); grp.add(m); }
  if (FB.flat && FB.flat.pos.length) {                                         // v0.40: краска и заплатки на крыше — без теней и поверх крыши (мерцали)
    const m = batchMesh(FB.flat, false); m.renderOrder = 1; Object.assign(m.material, { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }); staticGroup.remove(m); grp.add(m);
  }
}
const roofB = FB => FB.flat || (FB.flat = newBatch());
// корпус (building): все четыре стены
function facadeBlock(FB, x1, z1, x2, z2, floors, H, o) {
  const R = (() => { let s = Math.round(x1 * 131 + z1 * 977) % 2147483647 || 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  const col = o.col || WALL, dx = (x1 + x2) / 2;
  for (const side of ['N', 'S', 'W', 'E']) {
    const F = faceOf(side, x1, z1, x2, z2), skip = [];
    if (side === 'S') { skip.push([dx - 0.6, dx + 0.6]); if (o.gap && o.esc !== undefined) skip.push([o.esc - 0.2, o.gap[1] + 0.2]); }
    if (o.cross && side === 'S') skip.push([dx - 0.7, dx + 0.7]);
    const A = facadeAvoid(F, skip); facadeBase(FB, F, H, col, side === 'S' ? skip.filter(s => s[1] - s[0] < 1.3) : [], R, H);
    const L = F.b - F.a, wins = []; for (let u = F.a + 1; u < F.b - 0.5; u += 1.6) wins.push(u);
    // трубы по краям длинных стен
    if (F.alongX) for (const u of [F.a + 0.3, F.b - 0.3]) if (fFree(A, u - 0.3, u + 0.3)) drainPipe(FB, F, u, H, R);
    // кирпич: 1–2 заплатки между окнами
    for (let k = 0, n = 1 + (R() < 0.5 ? 1 : 0); k < n && wins.length > 1; k++) {
      const i = Math.floor(R() * (wins.length - 1)), uc = wins[i] + 0.8, f = Math.floor(R() * floors);
      if (fFree(A, uc - 0.5, uc + 0.5)) brickPatch(FB, F, uc, f * 2.6 + 0.9 + R() * 0.8, 0.55 + R() * 0.3, 0.5 + R() * 0.5, R);
    }
    // кондиционеры и щиток (не на южной стороне с лестницами)
    if (side !== 'S' && !o.chapel) for (let f = 0; f < floors; f++) if (wins.length > 2 && R() < 0.4) {
      const i = Math.floor(R() * (wins.length - 1)), uc = wins[i] + 0.8;
      if (fFree(A, uc - 0.5, uc + 0.5)) acUnit(FB, F, uc, f * 2.6 + 1.25);
    }
    if (side === 'S' && !o.chapel && fFree(A, dx + 0.8, dx + 1.4)) elecBox(FB, F, dx + 1.05, 0.9);
    facadeVoxel(FB, F, H, col, R, A);
    if (L < 0) break;
  }
  // крыша: заплатки битума, номер корпуса краской; номер над дверью
  const pad = typeof EVC !== 'undefined' && EVC.PADC ? EVC.PADC : null;
  for (let k = 0; k < 3; k++) { const w = 1.2 + R() * 2.5, d = 1 + R() * 2, cx = x1 + 1 + R() * (x2 - x1 - 2 - w), cz = z1 + 1 + R() * (z2 - z1 - 2 - d);
    if (pad && cx < pad.x + pad.hw + 0.5 && cx + w > pad.x - pad.hw - 0.5 && cz < pad.z + pad.hd + 0.5 && cz + d > pad.z - pad.hd - 0.5) continue;   // не под вертолётной площадкой
    pushBox(roofB(FB), cx + w / 2, H + 0.024 + k * 0.006, cz + d / 2, w, 0.004, d, 0, R() < 0.5 ? darkHex(ROOF, 0.82) : darkHex(ROOF, 1.1)); }   // у каждой заплатки своя высота — перекрываясь, не мерцают
  roofVoxel(FB, x1 + 0.05, z1 + 0.05, x2 - 0.05, z2 - 0.05, H + 0.02, R);
  if (o.num) {
    paintDigits(roofB(FB), String(o.num), null, 0, 0, 0.5, 0xb4ae9e, R, { cx: (x1 + x2) / 2, cz: (z1 + z2) / 2, y: H + 0.044 });
    paintDigits(FB, String(o.num), faceOf('S', x1, z1, x2, z2), dx, 1.95, 0.1, 0xd8d2c0, R);
  }
}
// окно: рама, отлив, иногда потёк вниз
function facadeWin(FB, cx, cy, cz, alongX, out, R) {
  const w = 0.55, h = 0.8, F = alongX ? { alongX: true, p: cz + out * 0.06, out } : { alongX: false, p: cx + out * 0.06, out }, u = alongX ? cx : cz, fc = 0x4e4842;
  fPut(FB, F, u - w / 2 - 0.06, u + w / 2 + 0.06, cy + h / 2, cy + h / 2 + 0.07, 0, 0.03, fc);                // верх рамы
  fPut(FB, F, u - w / 2 - 0.06, u - w / 2, cy - h / 2, cy + h / 2, 0, 0.03, fc); fPut(FB, F, u + w / 2, u + w / 2 + 0.06, cy - h / 2, cy + h / 2, 0, 0.03, fc);
  fPut(FB, F, u - w / 2 - 0.1, u + w / 2 + 0.1, cy - h / 2 - 0.06, cy - h / 2, 0, 0.1, 0x7a7c7e);              // отлив
  if (R() < 0.4) pxStreak(FB, { alongX, p: alongX ? cz : cx, out, a: -1e9, b: 1e9 }, u - w / 2 + 0.1 + R() * (w - 0.2), cy - h / 2 - 0.06, 0.125 + Math.floor(R() * 2) * 0.0625, 3 + Math.floor(R() * 4), 0x6e6658, 0.066);   // потёк лесенкой
}
// сарай/мастерские (shedOp): стены как есть, детали только на существующих стенах
function facadeShed(FB, x1, z1, x2, z2, H, o) {
  const R = (() => { let s = Math.round(x1 * 157 + z1 * 911) % 2147483647 || 11; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  const col = o.col || 0x86806e;
  for (const side of ['N', 'S', 'W', 'E']) {
    if (o.open === side || o.open2 === side) continue;
    const F = faceOf(side, x1, z1, x2, z2), skip = [];
    if (o.door && o.door.side === side) skip.push([o.door.at[0] - 0.05, o.door.at[1] + 0.05]);
    if (side === 'S' && o.gap && o.esc !== undefined) skip.push([o.esc - 0.2, o.gap[1] + 0.2]);
    const A = facadeAvoid(F, skip); facadeBase(FB, F, H, col, skip, R, H);
    if (F.b - F.a > 4) { const u = R() < 0.5 ? F.a + 0.3 : F.b - 0.3; if (fFree(A, u - 0.3, u + 0.3)) drainPipe(FB, F, u, H, R); }
    if (F.b - F.a > 3 && R() < 0.6) { const uc = F.a + 1 + R() * (F.b - F.a - 2); if (fFree(A, uc - 0.5, uc + 0.5)) brickPatch(FB, F, uc, 0.9 + R() * 1.0, 0.5 + R() * 0.4, 0.4 + R() * 0.5, R); }
    facadeVoxel(FB, F, H, col, R, A);
  }
  roofVoxel(FB, x1, z1, x2, z2, H, R);
  for (let k = 0; k < 2; k++) { const w = 1 + R() * 2, d = 1 + R() * 1.5; if (x2 - x1 < w + 2 || z2 - z1 < d + 2) continue; const cx = x1 + 1 + R() * (x2 - x1 - 2 - w), cz = z1 + 1 + R() * (z2 - z1 - 2 - d); pushBox(roofB(FB), cx + w / 2, H + 0.008 + k * 0.006, cz + d / 2, w, 0.004, d, 0, darkHex(ROOF, R() < 0.5 ? 0.82 : 1.1)); }
}
const buildings = [];
function building(x1, z1, x2, z2, floors, o = {}) {
  const H = floors * 2.6, grp = new THREE.Group(); staticGroup.add(grp); const s0b = solids.length, c0b = staticGroup.children.length;
  const B = { x1, z1, x2, z2, H, grp, mats: [] }, FB = FACADE_ON ? newBatch() : null;
  const RW = (() => { let s = Math.round(x1 * 71 + z1 * 313) % 2147483647 || 5; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  const wm = mat(o.col || WALL).clone(); B.mats.push(wm);
  box(x1, 0, z1, x2, H, z2, 0, { material: wm, parent: grp });
  const rm = mat(ROOF).clone(); B.mats.push(rm);
  box(x1 + 0.05, H, z1 + 0.05, x2 - 0.05, H + 0.02, z2 - 0.05, 0, { material: rm, parent: grp, solid: false, cast: false });
  // парапет (ограда крыши) — кроме проёма к лестнице
  const PH = 0.45, pm = mat(0xc8b69a).clone(); B.mats.push(pm);
  const gap = o.gap;                                   // [x1, x2] проём на южной стороне
  if (gap) { para(x1, H, z2 - 0.18, gap[0], H + PH, z2, 0, { material: pm, parent: grp }); para(gap[1], H, z2 - 0.18, x2, H + PH, z2, 0, { material: pm, parent: grp }); }
  else para(x1, H, z2 - 0.18, x2, H + PH, z2, 0, { material: pm, parent: grp });
  if (o.gapN) { para(x1, H, z1, o.gapN[0], H + PH, z1 + 0.18, 0, { material: pm, parent: grp }); para(o.gapN[1], H, z1, x2, H + PH, z1 + 0.18, 0, { material: pm, parent: grp }); } else para(x1, H, z1, x2, H + PH, z1 + 0.18, 0, { material: pm, parent: grp });
  if (o.gapW) { para(x1, H, z1, x1 + 0.18, H + PH, o.gapW[0], 0, { material: pm, parent: grp }); para(x1, H, o.gapW[1], x1 + 0.18, H + PH, z2, 0, { material: pm, parent: grp }); } else para(x1, H, z1, x1 + 0.18, H + PH, z2, 0, { material: pm, parent: grp });
  if (o.gapE) { para(x2 - 0.18, H, z1, x2, H + PH, o.gapE[0], 0, { material: pm, parent: grp }); para(x2 - 0.18, H, o.gapE[1], x2, H + PH, z2, 0, { material: pm, parent: grp }); } else para(x2 - 0.18, H, z1, x2, H + PH, z2, 0, { material: pm, parent: grp });
  // окна с решётками на все стороны, часть горит светом
  const win = (cx, cy, cz, alongX) => {
    if (winUnderLadder(cx, cz, alongX)) return;                                   // v0.45: под вертикальной лестницей окон нет
    const w = 0.55, h = 0.8, t = 0.06, m = Math.random() < 0.25 ? winMat : mat(DARK);
    const bars = mat(0x5a544c);
    if (alongX) { box(cx - w / 2, cy - h / 2, cz - t, cx + w / 2, cy + h / 2, cz + t, 0, { material: m, parent: grp, solid: false, cast: false });
      if (!o.chapel) for (let i = 1; i < 4; i++) box(cx - w / 2 + i * w / 4 - 0.02, cy - h / 2, cz - t - 0.01, cx - w / 2 + i * w / 4 + 0.02, cy + h / 2, cz + t + 0.01, 0, { material: bars, parent: grp, solid: false, cast: false }); }
    else { box(cx - t, cy - h / 2, cz - w / 2, cx + t, cy + h / 2, cz + w / 2, 0, { material: m, parent: grp, solid: false, cast: false });
      if (!o.chapel) for (let i = 1; i < 4; i++) box(cx - t - 0.01, cy - h / 2, cz - w / 2 + i * w / 4 - 0.02, cx + t + 0.01, cy + h / 2, cz - w / 2 + i * w / 4 + 0.02, 0, { material: bars, parent: grp, solid: false, cast: false }); }
    if (FB) facadeWin(FB, cx, cy, cz, alongX, alongX ? (cz > (z1 + z2) / 2 ? 1 : -1) : (cx > (x1 + x2) / 2 ? 1 : -1), RW);
  };
  for (let f = 0; f < floors; f++) {
    const cy = f * 2.6 + 1.5;
    for (let x = x1 + 1; x < x2 - 0.5; x += 1.6) { if (!(f === 0 && Math.abs(x - (x1 + x2) / 2) < 0.9)) win(x, cy, z2, true); win(x, cy, z1, true); }
    for (let z = z1 + 1; z < z2 - 0.5; z += 1.6) { win(x1, cy, z, false); win(x2, cy, z, false); }
    if (f > 0) { box(x1 - 0.02, f * 2.6 - 0.06, z1 - 0.02, x2 + 0.02, f * 2.6 + 0.06, z2 + 0.02, 0, { material: mat(WALL2), parent: grp, solid: false, cast: false }); }
  }
  const dx = (x1 + x2) / 2;                             // дверь
  box(dx - 0.5, 0, z2 - 0.04, dx + 0.5, 1.5, z2 + 0.06, 0, { material: mat(0x4e5a56), parent: grp, solid: false, cast: false });
  box(dx - 0.2, 1.62, z2, dx + 0.2, 1.72, z2 + 0.2, 0, { material: new THREE.MeshBasicMaterial({ color: 0xffe0a0 }), parent: grp, solid: false, cast: false });
  if (FB) { facadeBlock(FB, x1, z1, x2, z2, floors, H, o); finishFacade(FB, grp); }
  if (o.y0) {                                                                       // v0.47: здание на возвышении (часовня на площади-террасе)
    for (const ch of staticGroup.children.slice(c0b)) if (ch !== grp) { staticGroup.remove(ch); grp.add(ch); }
    grp.position.y = o.y0; for (let i = s0b; i < solids.length; i++) { solids[i].y1 += o.y0; solids[i].y2 += o.y0; } B.H += o.y0; B.y0 = o.y0;
  }
  buildings.push(B);
  B.finish = () => { const cache = new Map(); B.mats = [];
    grp.traverse(m => { if (!m.isMesh) return; let c = cache.get(m.material); if (!c) { c = m.material.clone(); cache.set(m.material, c); B.mats.push(c); if (m.material === winMat) winMats.push(c); } m.material = c; }); };
  return B;
}
// Пожарная лестница: марш вдоль x от (xs, z) до высоты H, площадка наверху. Ступени — сплошные (по ним ходят)
function fireEscape(xs, xe, z1, z2, H, grp, y0 = 0) {      // y0 — откуда начинается марш (с крыши на крышу)
  if (FACADE_ON) fireEscapeExtra(xs, xe, z1, z2, H, grp, y0);
  const n = Math.ceil(H / 0.3), run = (xe - xs) / n, rise = H / n, sm = mat(RED, {}), dk = mat(0x6e241c);
  for (let i = 0; i < n; i++) {
    const x = xs + i * run, top = y0 + (i + 1) * rise;
    box(x, top - 0.07, z1 + 0.06, x + run + 0.01, top, z2 - 0.06, 0, { material: i & 1 ? sm : mat(0x962f24), parent: grp, solid: false });   // ступень-решётка
    box(x - 0.01, top - rise, z1 + 0.06, x + 0.03, top - 0.07, z2 - 0.06, 0, { material: dk, parent: grp, solid: false, cast: false });       // подступенок
    solids.push({ x1: x, y1: y0, z1, x2: x + run, y2: top, z2, mat: 'metal', group: grp, stair: true });      // для ходьбы — сплошная
  }
  box(xs, y0, z2 - 0.06, xe, y0 + 0.06, z2, 0, { material: dk, parent: grp, solid: false });
  for (const zz of [z1, z2 - 0.07]) {                                                                          // косоуры
    const len = Math.hypot(xe - xs, H), m = new THREE.Mesh(boxGeo, sm); m.scale.set(len, 0.18, 0.07);
    m.position.set((xs + xe) / 2, y0 + H / 2 - 0.12, zz + 0.035); m.rotation.z = Math.atan2(H, xe - xs); m.castShadow = true; grp.add(m);
  }
  for (const x of [xs + (xe - xs) * 0.5, xe]) box(x - 0.05, y0, z2 - 0.1, x + 0.05, y0 + (x === xe ? H : H * 0.5), z2, 0, { material: dk, parent: grp, solid: false });   // стойки
  const rl = new THREE.Mesh(boxGeo, sm), len = Math.hypot(xe - xs, H); rl.scale.set(len, 0.06, 0.06);           // перила
  rl.position.set((xs + xe) / 2, y0 + H / 2 + 0.9, z2 - 0.03); rl.rotation.z = Math.atan2(H, xe - xs); grp.add(rl);
  for (let i = 2; i < n; i += 4) { const x = xs + i * run, top = y0 + (i + 1) * rise; box(x, top, z2 - 0.06, x + 0.05, top + 0.9, z2, 0, { material: sm, parent: grp, solid: false }); }   // балясины
}


/* ---------- 5. Машины, бочки, фонари, деревья, стена ---------- */
const fires = [];                                     // источники огня: { x, y, z, light, s }
const underRoof = (x, z) => buildings.some(B => B.H > 1.5 && x > B.x1 && x < B.x2 && z > B.z1 && z < B.z2);   // v0.43: под крышей не горит (дым шёл сквозь крышу)
function car(x, z, alongX, col, wreck, burn) {
  if (burn && FACADE_ON && (underRoof(x, z) || underRoof(x + (alongX ? 1.6 : 0.75), z + (alongX ? 0.75 : 1.6)))) burn = false;
  if (typeof CAR_VOX !== 'undefined') return voxCar(x, z, alongX, col, wreck, burn);          // машина из assets/cars/car.vox
  const g = new THREE.Group(); staticGroup.add(g);
  const L = 3.2, Wd = 1.5, P = (u1, u2, v1, v2, y1, y2, c, o = {}) => alongX ? box(x + u1, y1, z + v1, x + u2, y2, z + v2, c, Object.assign({ parent: g, hit: 'metal' }, o)) : box(x + v1, y1, z + u1, x + v2, y2, z + u2, c, Object.assign({ parent: g, hit: 'metal' }, o));
  const body = wreck ? new THREE.Color(col).multiplyScalar(0.55).getHex() : col;
  P(0, L, 0, Wd, 0.25, 0.75, body);
  P(0.85, 2.3, 0.08, Wd - 0.08, 0.75, 1.2, body);
  P(0.9, 2.25, 0.05, Wd - 0.05, 0.8, 1.13, 0x2c3a44, { solid: false, cast: false });
  for (const [u, v] of [[0.45, -0.04], [L - 0.95, -0.04], [0.45, Wd - 0.18], [L - 0.95, Wd - 0.18]]) P(u, u + 0.5, v, v + 0.22, 0, 0.45, 0x1c1c1c, { solid: false });
  P(L - 0.04, L + 0.02, 0.15, 0.4, 0.5, 0.65, wreck ? 0x303030 : 0xf0e6b0, { solid: false, cast: false, m: wreck ? {} : { emissive: 0x806030 } });
  P(L - 0.04, L + 0.02, Wd - 0.4, Wd - 0.15, 0.5, 0.65, 0xf0e6b0, { solid: false, cast: false, m: { emissive: 0x806030 } });
  P(-0.02, 0.04, 0.15, 0.4, 0.5, 0.65, 0xb02a22, { solid: false, cast: false }); P(-0.02, 0.04, Wd - 0.4, Wd - 0.15, 0.5, 0.65, 0xb02a22, { solid: false, cast: false });
  if (burn) addFire(alongX ? x + L - 0.7 : x + Wd / 2, 0.78, alongX ? z + Wd / 2 : z + L - 0.7, 1.4);
}
function barrel(x, z, fire) {
  if (fire && FACADE_ON && underRoof(x, z)) fire = false;
  if (typeof PROP_VOX !== 'undefined') barrelVox(x, z, 'barrel');                    // бочка из assets/props/barrel_old.vox
  else {
    const c = fire ? 0x7a4630 : 0x48607a;
    box(x - 0.3, 0, z - 0.3, x + 0.3, 0.9, z + 0.3, c, { hit: 'metal' });
    box(x - 0.33, 0.28, z - 0.33, x + 0.33, 0.34, z + 0.33, 0x3a2a20, { solid: false }); box(x - 0.33, 0.62, z - 0.33, x + 0.33, 0.68, z + 0.33, 0x3a2a20, { solid: false });
  }
  if (fire) { addFire(x, 0.92, z, 1); SCORCHES.push([x, z, 0.8, 1]); scorchSoft(x, z, 0.8); }
}
// Свет огней — пул из 4 ламп у ближайших к камере огней (раньше у каждого огня своя: на большой карте это десяток лишних источников)
const FIRE_LIGHTS = Array.from({ length: QS.fire }, () => { const l = new THREE.PointLight(0xff8a3a, 0, 9, 1.6); scene.add(l); return l; });
function addFire(x, y, z, s) {
  fires.push({ x, y, z, s, acc: 0, seed: Math.random() * 10 });
}
const lamps = [];
/* v0.35: кодовые фонари вместо модели Meshy (тюрьма и свои карты; в городе — старый простой фонарь).
   'cobra' — столб с изогнутой «коброй» и плоским плафоном; 'mast' — мачта с тремя прожекторами (op 'mast').
   Часть столбов разбита (не светит, плафон тёмный), часть мигает. Геометрия — одной пачкой на все фонари. */
let LAMP_B = null;
const LAMP_UNLIT = 0x6a6450;
function lampKind(x, z) { const h = hash2(Math.round(x * 10), Math.round(z * 10), 91); return h < 0.11 ? 'broken' : h < 0.22 ? 'flick' : 'ok'; }
// геометрия в пачку B; yaw a — куда смотрит плафон (0 — +x); bulbMat — материал плафона (null — тёмный кубик в пачке). Возвращает меши плафонов
function lampGeo(B, x, z, a, type, broken, bulbMat) {
  const c = Math.cos(a), s = Math.sin(a), W = (ox, oz) => [x + ox * c + oz * s, z - ox * s + oz * c], bulbs = [];
  const put = (ox, y, oz, sx, sy, sz, hex) => { const [wx, wz] = W(ox, oz); pushBox(B, wx, y, wz, sx, sy, sz, a, hex); };
  const bulb = (ox, y, oz, sx, sy, sz) => {
    if (!bulbMat) { put(ox, y, oz, sx, sy, sz, 0x262624); return; }
    const [wx, wz] = W(ox, oz), m = new THREE.Mesh(boxGeo, bulbMat); m.scale.set(sx, sy, sz); m.position.set(wx, y, wz); m.rotation.y = a; m.castShadow = false;
    (BOX_PARENT || staticGroup).add(m); bulbs.push(m);
  };
  if (type === 'lantern') {                                                                            // v0.46: старый кованый фонарь (кладбище)
    const ir = 0x26242c;
    put(0, 0.12, 0, 0.42, 0.24, 0.42, 0x4e4a58); put(0, 0.32, 0, 0.24, 0.16, 0.24, ir);
    put(0, 1.5, 0, 0.1, 2.3, 0.1, ir); for (const y of [0.6, 1.4, 2.2]) put(0, y, 0, 0.16, 0.06, 0.16, ir);
    put(0, 2.68, 0, 0.36, 0.06, 0.36, ir); put(0, 3.08, 0, 0.42, 0.06, 0.42, ir); put(0, 3.18, 0, 0.28, 0.12, 0.28, ir); put(0, 3.3, 0, 0.12, 0.14, 0.12, ir);
    for (const [dx, dz] of [[-0.16, -0.16], [0.16, -0.16], [-0.16, 0.16], [0.16, 0.16]]) put(dx, 2.88, dz, 0.04, 0.36, 0.04, ir);
    bulb(0, 2.88, 0, 0.28, 0.34, 0.28);
    return bulbs;
  }
  if (type === 'mast') {
    put(0, 0.2, 0, 0.5, 0.4, 0.5, 0x7c776e); put(0, 0.43, 0, 0.3, 0.06, 0.3, 0x6e4228);                  // бетон, ржавый пояс
    put(0, 2.05, 0, 0.24, 3.2, 0.24, 0x5c5e60); put(0, 4.55, 0, 0.18, 1.8, 0.18, 0x646668); put(0, 3.68, 0, 0.27, 0.08, 0.27, 0x4c4e50);
    for (let y = 0.9; y < 5.3; y += 0.42) put(-0.15, y, 0, 0.06, 0.04, 0.2, 0x46484a);                   // скобы-ступени
    put(0, 1.45, 0.16, 0.22, 0.38, 0.08, 0x4c5650); put(0, 1.45, 0.205, 0.08, 0.06, 0.01, 0xa89020);   // щиток с жёлтой меткой
    put(0, 5.5, 0, 0.22, 0.1, 0.22, 0x4c4e50); put(0, 5.95, 0, 0.1, 0.1, 1.55, 0x4c4e50);               // фланец, поперечина
    for (const oz of [-0.52, 0, 0.52]) {
      put(0.1, 5.86, oz, 0.12, 0.08, 0.08, 0x4c4e50); put(0.26, 5.76, oz, 0.22, 0.26, 0.3, 0x34363a); put(0.21, 5.92, oz, 0.3, 0.04, 0.34, 0x2c2e30);
      bulb(0.38, 5.74, oz, 0.03, 0.2, 0.24);
    }
  } else {
    put(0, 0.15, 0, 0.36, 0.3, 0.36, 0x7c776e); put(0, 0.33, 0, 0.2, 0.06, 0.2, 0x6e4228);               // бетон, ржавый пояс
    put(0, 1.45, 0, 0.18, 2.3, 0.18, 0x56605a); put(0, 3.5, 0, 0.13, 1.8, 0.13, 0x5e6862);               // труба в два колена
    put(0.095, 1.05, 0, 0.02, 0.34, 0.11, 0x444c48); put(0, 2.62, 0, 0.2, 0.05, 0.2, 0x4e5852);          // лючок, стык
    put(0, 4.42, 0, 0.15, 0.06, 0.15, 0x4e5852); put(0.12, 4.5, 0, 0.14, 0.1, 0.08, 0x5e6862);            // изгиб «кобры»
    put(0.32, 4.56, 0, 0.28, 0.08, 0.08, 0x5e6862); put(0.62, 4.58, 0, 0.36, 0.07, 0.07, 0x5e6862);
    put(0.98, 4.56, 0, 0.56, 0.15, 0.28, 0x3c3e40);                                                       // корпус плафона
    if (broken) { put(1.04, 4.25, 0.05, 0.02, 0.4, 0.02, 0x1c1c1c); put(1.0, 4.46, -0.06, 0.12, 0.03, 0.08, 0x8a9294); }   // оборванный провод, осколок стекла
    else put(1.27, 4.53, 0, 0.05, 0.11, 0.22, 0x34363a);                                                  // козырёк
    bulb(0.98, 4.47, 0, 0.4, 0.03, 0.2);
  }
  return bulbs;
}
// v0.43: куда смотрит плафон — туда, где свободно и где дорога/площадка; не в стену и не за забор
const scanSolids = (x, z, r) => solids.filter(q => x + r > q.x1 && x - r < q.x2 && z + r > q.z1 && z - r < q.z2);   // при постройке карты сетка коробок ещё пуста
function lampYaw(x, z) {
  const dirs = [[1, 0, 0], [0, -1, Math.PI / 2], [-1, 0, Math.PI], [0, 1, -Math.PI / 2]]; let best = 0, bs = -1e9;
  for (const [dx, dz, a] of dirs) {
    let s = 0;
    for (const d of [0.6, 1.1, 2, 3, 4, 5.5]) {
      const px = x + dx * d, pz = z + dz * d;
      if (px < 0.6 || pz < 0.6 || px > MAP - 0.6 || pz > MAP - 0.6) { s -= d < 1.5 ? 50 : 3; continue; }
      if (scanSolids(px, pz, 0.3).some(q => q.y2 > 0.4 && q.y1 < 4.8 && px > q.x1 - 0.15 && px < q.x2 + 0.15 && pz > q.z1 - 0.15 && pz < q.z2 + 0.15)) { s -= d < 1.5 ? 50 : 2; continue; }
      const t = zoneTypeAt(MAPDEF.zones, px, pz);
      s += t === 'road' || t === 'asphalt' ? 1.5 : t === 'paving' || t === 'court' || t === 'dark' ? 1 : 0.4;
    }
    if (s > bs + 0.01) { bs = s; best = a; }
  }
  return best;
}
function lamp(x, z, type) {
  if (!MESHY_MAP) {                                                                                       // город: прежний простой фонарь
    box(x - 0.08, 0, z - 0.08, x + 0.08, 4.2, z + 0.08, 0x5a5c60, { hit: 'metal' });
    box(x - 0.08, 4.1, z - 0.08, x + 0.7, 4.2, z + 0.08, 0x5a5c60, { solid: false });
    const bulb = box(x + 0.45, 3.98, z - 0.1, x + 0.75, 4.1, z + 0.1, 0xfff0c0, { solid: false, cast: false, material: new THREE.MeshBasicMaterial({ color: 0x6a6450 }) });
    lamps.push({ x, z, bulb }); return;
  }
  if (!LAMP_B) LAMP_B = newBatch();
  const mast = type === 'mast', lant = type === 'lantern', k = lampKind(x, z), dead = !mast && !lant && k === 'broken', flick = k === 'flick' || ((mast || lant) && k === 'broken');
  const bm = new THREE.MeshBasicMaterial({ color: dead ? 0x242422 : LAMP_UNLIT });
  const a = lant ? 0 : lampYaw(x, z), c = Math.cos(a), s = -Math.sin(a), at = d => [x + c * d, z + s * d];     // локальная +x → мир (cos a, −sin a)
  const bulbs = lampGeo(LAMP_B, x, z, a, lant ? 'lantern' : mast ? 'mast' : 'cobra', dead, bm), r = mast ? 0.12 : 0.1;
  solids.push({ x1: x - r, y1: 0, z1: z - r, x2: x + r, y2: mast ? 6.0 : 4.6, z2: z + r, mat: 'metal', group: null });
  if (lant) lamps.push({ x, z, bulb: bulbs[0], lx: x, lz: z, ly: 2.7, tx: x + 0.01, tz: z + 0.01, dist: 12, ang: 1.2, pow: 0.9, dead, flick });
  else if (mast) { const [lx, lz] = at(0.42), [tx, tz] = at(3.4); lamps.push({ x, z, bulb: bulbs[0], lx, lz, ly: 5.7, tx, tz, dist: 22, ang: 0.88, pow: 1.6, dead, flick }); }
  else { const [lx, lz] = at(0.98), [tx, tz] = at(1.4); lamps.push({ x, z, bulb: bulbs[0], lx, lz, ly: 4.4, tx, tz, dead, flick }); }
}
function finishLamps() { if (LAMP_B && LAMP_B.pos.length) batchMesh(LAMP_B, true); LAMP_B = null; }
// Фонари светят пулом из 3 прожекторов — у ближайших к камере
const LAMP_LIGHTS = Array.from({ length: QS.lamps }, () => { const sp = new THREE.SpotLight(0xffe2a8, 0, 14, 0.75, 0.5, 1.2); scene.add(sp); scene.add(sp.target); return sp; });
function tree(x, z) {
  box(x - 0.15, 0, z - 0.15, x + 0.15, 1.6, z + 0.15, 0x6a4a30, { hit: 'wood' });
  const G = [0x4c6a34, 0x587a3a, 0x3e5a2c];
  for (let i = 0; i < 9; i++) { const s = rnd(0.6, 1.0), cx = x + rnd(-0.6, 0.6), cz = z + rnd(-0.6, 0.6), cy = rnd(1.5, 2.6);
    box(cx - s / 2, cy, cz - s / 2, cx + s / 2, cy + s, cz + s / 2, G[i % 3], { solid: false }); }
  solids.push({ x1: x - 1, y1: 1.6, z1: z - 1, x2: x + 1, y2: 3.2, z2: z + 1, mat: 'wood', leaves: true });   // крона ловит пули
}

function tower(x, z) {                            // вышка на стене
  if (FACADE_ON) return towerNew(x, z);
  box(x - 0.6, 0, z - 0.6, x + 0.6, 6.5, z + 0.6, 0x686a68); box(x - 0.9, 6.5, z - 0.9, x + 0.9, 7.6, z + 0.9, 0x55585a);
  box(x - 1, 7.6, z - 1, x + 1, 7.8, z + 1, 0x3e4042, { solid: false });
}
function wallSeg(x1, z1, x2, z2) {                 // стена из плит, чуть разного цвета
  const alongX = Math.abs(x2 - x1) > Math.abs(z2 - z1), n = Math.ceil(alongX ? x2 - x1 : z2 - z1);
  for (let i = 0; i < n; i++) { const c = (i & 1) ? 0x9c968a : 0x948e82;
    if (alongX) box(x1 + i, 0, z1, Math.min(x2, x1 + i + 1), 3.2, z2, c); else box(x1, 0, z1 + i, x2, 3.2, Math.min(z2, z1 + i + 1), c); }
}
function fenceX(x1, x2, z) {                       // сетка-рабица вдоль x: столбы и полупрозрачное полотно, концы не торчат
  const net = mat(0x8a9090, { transparent: true, opacity: 0.45 });
  box(x1, 0, z - 0.04, x2, 2.2, z + 0.04, 0, { material: net, cast: false });
  for (let x = x1; x <= x2 + 0.01; x += 2) box(Math.min(x, x2) - 0.06, 0, z - 0.06, Math.min(x, x2) + 0.06, 2.35, z + 0.06, 0x5a5e5e, { solid: false });
  box(x1, 2.2, z - 0.03, x2, 2.26, z + 0.03, 0x5a5e5e, { solid: false });
}
function bench(x, z, faceX) {                      // скамейка; faceX — смотрит вдоль ±x (к дороге)
  if (useModel('m_bench')) return benchModel(x, z, faceX);
  const wood = 0x8a6a44, iron = 0x3a3c3c, s = faceX;
  if (s) { box(x - 0.22, 0.38, z - 0.7, x + 0.22, 0.45, z + 0.7, wood, { solid: false }); box(x - s * 0.24 - 0.04, 0.45, z - 0.7, x - s * 0.24 + 0.04, 0.85, z + 0.7, wood, { solid: false });
    for (const dz of [-0.6, 0.6]) box(x - 0.2, 0, z + dz - 0.04, x + 0.2, 0.38, z + dz + 0.04, iron, { solid: false });
    solids.push({ x1: x - 0.25, y1: 0, z1: z - 0.7, x2: x + 0.25, y2: 0.45, z2: z + 0.7, mat: 'wood', group: null }); }
}
function waterTower(x, z) {                        // водонапорная башня: тёмный низ, ржавый бак
  if (FACADE_ON) return waterTowerNew(x, z);
  box(x - 1.8, 0, z - 1.8, x + 1.8, 0.12, z + 1.8, 0x6a645a, { solid: false });
  for (const [dx, dz] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) box(x + dx - 0.14, 0, z + dz - 0.14, x + dx + 0.14, 6.2, z + dz + 0.14, 0x4a4844);
  for (const y of [2, 4]) { box(x - 1.3, y, z - 1.26, x + 1.3, y + 0.1, z - 1.14, 0x4a4844, { solid: false }); box(x - 1.3, y, z + 1.14, x + 1.3, y + 0.1, z + 1.26, 0x4a4844, { solid: false }); }
  box(x - 1.6, 6.2, z - 1.6, x + 1.6, 8.6, z + 1.6, 0x7a6450); box(x - 1.3, 8.6, z - 1.3, x + 1.3, 9.1, z + 1.3, 0x6a5444);
  for (let i = 0; i < 4; i++) box(x - 1.62, 6.6 + i * 0.55, z - 1.62, x + 1.62, 6.66 + i * 0.55, z + 1.62, 0x5e4c3c, { solid: false });
}
