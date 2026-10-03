'use strict';
/* ---------- Карта «Тюрьма» 96×96 — описана данными ----------
   Север: два крыла камерного блока, между ними «расстрельный» проход (пролом в стене) с мостиком между крышами;
          прогулочные клетки; слева кладбище, справа котельная и склад топлива (за воротами).
   Центр: администрация (3 этажа), большой двор с беседкой, прачечная, склад.
   Запад: лазарет и столовая с узким проходом между ними, «собачий» коридор от западных ворот.
   Восток: спортплощадка в клетке с двумя воротами, коридор от восточных ворот.
   Юг: за внутренней сеткой — КПП, дорога, стоянка с автобусами, мастерские (3 стены) и карцер (одна дверь).
   Ворота открывает и закрывает игрок (F / Y), зомби их ломают; Громила и босс сносят сразу.
   Формат: массивы «операций» — позже их сможет читать и писать редактор карты. */
const MAP_PRISON = {
  name: 'Тюрьма',
  start: { x: 48, z: 45 },
  // типы земли; позже в списке — сверху. [тип, x1, z1, x2, z2, {lines}]
  zones: [
    ['paving', 22, 20, 74, 64], ['paving', 44, 0, 52, 24], ['paving', 3, 30, 24, 62], ['paving', 34, 82, 46, 94],
    ['grass', 3, 3, 20.5, 30], ['gravel', 76, 3, 95.5, 32], ['dark', 77, 4, 91, 14], ['gravel', 0.5, 54.5, 22, 59.5], ['gravel', 74, 54.5, 95.5, 59.5],
    ['court', 76, 36, 92, 52], ['road', 46, 64, 50, 96], ['asphalt', 54, 68, 74, 92, { lines: true }], ['dark', 6, 70, 26, 84], ['dark', 74, 74, 86, 83],
  ],
  noSpawn: [[28, 66.5, 40.5, 76.5], [3, 3, 20.5, 30], [76, 3, 95.5, 32], [76, 36, 92, 52], [23, 22, 43, 31], [53, 22, 73, 31], [6, 70, 26, 84], [74, 74, 86, 83]],
  crates: [[15, 21], [84, 9], [13, 43.5], [80, 78], [14, 77], [48, 52], [84, 44], [30, 59], [68, 22], [40, 93.5]],     // фиксированные места больших ящиков
  doors: [[33.5, 22.6], [62.5, 22.6], [48, 43.3], [18, 53.7], [13, 43.5], [64.5, 52.3], [40, 93.5]],                              // двери корпусов: отсюда выходят зомби
  ops: [
    // --- периметр: стена, вышки, проломы (север 45.5–49.5, запад и восток z 54.5–59.5, КПП на юге 44–52) ---
    ['wall', 0, 0, 45.5, 0.5], ['wall', 49.5, 0, 96, 0.5], ['wall', 0, 95.5, 44, 96], ['wall', 52, 95.5, 96, 96],
    ['wall', 0, 0.5, 0.5, 54.5], ['wall', 0, 59.5, 0.5, 95.5], ['wall', 95.5, 0.5, 96, 54.5], ['wall', 95.5, 59.5, 96, 95.5],
    ...[[1, 1], [95, 1], [1, 95], [95, 95], [24, 1], [72, 1], [42.5, 95], [53.5, 95]].map(p => ['tower', ...p]),
    ...[[1, 30], [95, 30], [1, 80], [95, 80]].map(p => ['tower', ...p]),
    ['search', 1, 30, 0.1], ['search', 95, 30, Math.PI - 0.1], ['search', 1, 80, -0.15], ['search', 95, 80, Math.PI + 0.15],
    // --- север: камерные крылья, проход между ними, мостик над ним ---
    ['block', 23, 8, 44, 20, 1, { gap: [39.8, 41.4], esc: 35, gapE: [13.2, 15.2], col: 0xc8b8a0 }],
    ['block', 52, 8, 73, 20, 1, { gap: [60, 61.6], esc: 55, gapW: [13.2, 15.2], col: 0xbcac94 }],
    ['bridge', 44, 52, 13.2, 15.2, 2.6, 'x'],
    ['pens', 24, 42, 24, 30, 2, true], ['pens', 54, 72, 24, 30, 2, true],
    // --- кладбище (северо-запад) ---
    ['fenceZ', 0.5, 30, 20.5], ['fenceX', 6.5, 10, 30], ['gate', 10, 30, 12.4, 30, 'x', false], ['fenceX', 12.4, 20.5, 30],
    ['shed', 12, 17, 19, 24, { h: 2.6, door: { side: 'S', at: [14.6, 16.4] }, col: 0x8e8a80 }],
    ...[[6, 8], [9.5, 8], [13, 8], [16.5, 8], [6, 13], [9.5, 13], [13, 13], [16.5, 13], [5, 27], [8, 27.5], [17, 27]].map(p => ['grave', ...p]),
    // --- северо-восток: котельная и склад топлива за воротами ---
    ['fenceZ', 0.5, 20, 76], ['fenceZ', 28, 32, 76], ['fenceX', 76, 82.5, 32], ['gate', 82.5, 32, 85.5, 32, 'x', false], ['fenceX', 85.5, 95.5, 32],
    ['shed', 78, 5, 90, 14, { h: 2.6, open: 'S', open2: 'E', col: 0x7a7468 }],
    ['xtank', 79.5, 19], ['xtank', 84.5, 19], ['xtank', 89.5, 19], ['barrel', 78, 28, true], ['barrel', 92, 27, false], ['barrel', 80.5, 24, false], ['barrel', 91, 15.5, false],
    ['waterTower', 86, 27],
    // --- центр: администрация, двор, прачечная, склад ---
    ['block', 39, 32, 57, 41, 2, { gap: [52, 53.6], esc: 40, col: 0xbcac94 }],
    ['gazebo', 48, 52],
    ['block', 60, 44, 69, 50, 1, { gap: [65, 66.6], esc: 60.6, col: 0xc0b098 }],
    // --- запад: лазарет и столовая, проход между ними ---
    ['block', 5, 34, 21, 42, 1, { gap: [10, 12], col: 0xd8d2c4, cross: true }],
    ['block', 5, 45, 21, 53, 1, { gap: [14, 15.6], esc: 8, gapN: [10, 12], col: 0xb4a48a }],
    ['bridge', 42, 45, 10, 12, 2.6, 'z'],
    ['gate', 21.2, 42, 21.2, 45, 'z', true],
    ['fenceX', 14, 22, 54.5], ['fenceX', 14, 22, 59.5], ['gate', 22, 54.5, 22, 59.5, 'z', true],
    // --- восток: спортплощадка в клетке с двумя воротами, коридор от восточных ворот ---
    ['fenceZ', 36, 42, 76], ['fenceZ', 48, 52, 76],
    ['fenceX', 76, 80.5, 52], ['fenceX', 86.5, 92, 52], ['fenceZ', 36, 52, 92], ['fenceX', 76, 92, 36],
    ['hoop', 77.6, 44], ['hoop', 90.4, 44], ['shed', 87.5, 37.2, 91, 40.4, { h: 2.6, door: { side: 'W', at: [38.2, 39.4] }, col: 0x7a7a70 }],
    ['fenceX', 74, 80, 54.5], ['fenceX', 89, 95.5, 54.5], ['fenceX', 74, 80, 59.5], ['fenceX', 89, 95.5, 59.5], ['gate', 74, 54.5, 74, 59.5, 'z', true],
    // --- юг: внутренняя сетка с воротами на дороге ---
    ['fenceX', 0.5, 18, 64], ['fenceX', 24, 46, 64], ['gate', 46, 64, 50, 64, 'x', true], ['fenceX', 50, 69, 64], ['fenceX', 75, 95.5, 64], ['post', 45.9, 64], ['post', 50.1, 64],
    ['post', 18, 64], ['post', 24, 64], ['post', 69, 64], ['post', 75, 64], ['car', 14.8, 65.6, true, 0x6e7a50, true], ['car', 76.4, 65.6, true, 0x8c3a30, true, true],
    ['block', 36, 84, 44, 92, 1, { col: 0xa8a294 }],
    ['booth', 45.1, 94], ['barrier', 50.4, 93.4],
    // мастерские: три стены, открыты на восток (к дороге)
    ['shed', 6, 70, 26, 84, { h: 2.6, open: 'E', open2: 'N', gap: [15, 16.6], esc: 10, col: 0x86806e }],
    ['barrel', 8, 82, false], ['barrel', 8.9, 82.6, true], ['barrel', 20, 71.4, false],
    ['car', 15, 76.5, true, 0x3e5270, true], ['car', 15, 80.2, true, 0x8c3a30, true, true],
    // карцер: одна дверь с запада, лестница на крышу
    ['shed', 74, 74, 86, 83, { h: 2.6, door: { side: 'W', at: [77, 78.8] }, gap: [80, 81.6], esc: 75, col: 0x7a7468 }],
    // стоянка: машины и автобусы как укрытия
    ['car', 56, 70, true, 0xc8c4ba], ['car', 62, 70, true, 0x60707e, true, true], ['car', 56, 74.4, true, 0x6e7a50], ['car', 62, 74.4, true, 0x8c3a30, true],
    ['car', 58, 78.5, false, 0xd8b030, true], ['car', 70, 70, false, 0x3e5270], ['car', 28, 88, false, 0x8c3a30, true, true], ['car', 56, 92, true, 0x60707e, true],
    // --- общее: скамейки, бочки, фонари, зелень ---
    ...[70, 74, 78, 82].flatMap(z => [['bench', 44.6, z, 1], ['bench', 51.4, z, -1]]),
    ['barrel', 26, 40, true], ['barrel', 70, 36, true], ['barrel', 40, 58, true], ['barrel', 64, 58, false], ['barrel', 30, 66, true], ['barrel', 88, 68, false], ['barrel', 4, 40, false],
    ...[[48, 4], [46.5, 17.6], [48, 24], [30, 22], [66, 22], [36, 36], [60, 36], [30, 46], [69.6, 46], [35.6, 60], [62, 60], [48, 62], [12, 31], [24, 56], [78, 56], [88, 56], [14, 57], [47.2, 68], [50.8, 76], [47.2, 84], [20, 66], [70, 66], [80, 86], [10, 90], [86, 40], [86, 16], [12, 4]].map(p => ['lamp', ...p]),
    ...[[4, 4], [18, 5], [5, 27], [19.5, 26], [24, 4], [72, 4], [3, 66], [92, 66], [4, 92], [92, 92], [30, 94], [84, 94], [4, 48], [92, 48], [4, 36]].map(p => ['tree', ...p]),
    ...[[6, 10], [86, 36], [6, 88], [90, 88], [86, 62], [30, 90], [80, 90], [92, 50], [20, 12]].map(p => ['bush', ...p]),
    ...[[45.2, 66], [50.8, 66], [46, 90], [50, 90], [47, 82]].map(p => ['cone', ...p]),
    // --- события v0.21: генератор в котельной, вертолётная площадка на крыше администрации, оружейка, взрывные бочки ---
    ['generator', 86.8, 8.0], ['helipad'], ['armory'],
    ['ladder', 45, 32, 0, -1], ['ladder', 57, 36, 1, 0], ['ladder', 33, 8, 0, -1], ['ladder', 23, 14, -1, 0], ['ladder', 63, 8, 0, -1], ['ladder', 73, 14, 1, 0], ['ladder', 69, 47, 1, 0], ['ladder', 13, 34, 0, -1], ['ladder', 21, 49, 1, 0], ['ladder', 6, 77, -1, 0], ['ladder', 16, 84, 0, 1], ['ladder', 86, 78, 1, 0], ['ladder', 80, 74, 0, -1],
    // --- v0.34: мусорные баки (только на свободном месте) и мешки с мусором ---
    ...[[72.5, 79, 0], [22.7, 50, 1.571], [42, 42, 0], [55.5, 42, 0], [70.5, 48, 1.571], [26.5, 21.6, 0], [69.5, 21.6, 0], [43.2, 76, 1.571], [35, 85.5, 1.571], [20, 74, 0]].map(p => ['trashbin', ...p]),
    ...[[73.6, 80.6], [23.3, 51.9], [43.3, 42.7], [56.9, 42.5], [71.1, 50], [28.1, 21.5], [67.9, 21.7], [43.1, 78], [35.3, 87.6], [21.6, 74.6], [8, 80.6], [58.2, 80.6], [84, 72.8], [30.5, 62.2], [64, 62.6], [12, 62.2], [88, 62.2]].map(p => ['trashbag', ...p]),
    ['xbarrel', 82.2, 23], ['xbarrel', 87.3, 23.5], ['xbarrel', 92.5, 21], ['xbarrel', 10, 80], ['xbarrel', 24, 78], ['xbarrel', 22, 73.5], ['xbarrel', 66, 76], ['xbarrel', 72, 88], ['xbarrel', 38, 50], ['xbarrel', 58, 48], ['xbarrel', 14, 56], ['xbarrel', 26, 48], ['xbarrel', 47.5, 27], ['xbarrel', 92, 70], ['xbarrel', 42, 66], ['xbarrel', 36, 62], ['xbarrel', 80, 70], ['xbarrel', 30, 47], ['xbarrel', 64, 40],
  ],
};

/* ---------- Ворота: раздвижные, открываются и закрываются игроком, зомби их ломают ---------- */
const GATES = [];
function addGate(x1, z1, x2, z2, axis, open) {
  if (!GATE_START.some(a => a[0] === x1 && a[1] === z1 && a[2] === x2 && a[3] === z2)) GATE_START.push([x1, z1, x2, z2, axis, open]);
  const L = axis === 'x' ? x2 - x1 : z2 - z1, t = 0.2, g = new THREE.Group(); staticGroup.add(g);
  const cx = (x1 + x2) / 2, cz = (z1 + z2) / 2, bx = axis === 'x' ? L / 2 : t / 2, bz = axis === 'x' ? t / 2 : L / 2;
  const P = (ax, ay, az, bxx, byy, bzz, col, o = {}) => { const m = new THREE.Mesh(boxGeo, o.material || mat(col)); m.scale.set(bxx - ax, byy - ay, bzz - az); m.position.set((ax + bxx) / 2, (ay + byy) / 2, (az + bzz) / 2); m.castShadow = o.cast !== false; g.add(m); };
  const net = mat(0x8a9090, { transparent: true, opacity: 0.55 });
  P(cx - bx, 0.1, cz - bz, cx + bx, 2.2, cz + bz, 0, { material: net, cast: false });
  for (const [dx, dz] of axis === 'x' ? [[-bx, 0], [bx, 0]] : [[0, -bz], [0, bz]]) P(cx + dx - 0.07, 0, cz + dz - 0.07, cx + dx + 0.07, 2.4, cz + dz + 0.07, 0x7a2e24);
  P(cx - bx, 2.2, cz - bz, cx + bx, 2.3, cz + bz, 0x7a2e24); P(cx - bx, 0.1, cz - bz, cx + bx, 0.18, cz + bz, 0x7a2e24);
  const G = { x1: axis === 'x' ? x1 : cx - t / 2, z1: axis === 'x' ? cz - t / 2 : z1, x2: axis === 'x' ? x2 : cx + t / 2, z2: axis === 'x' ? cz + t / 2 : z2, axis, L, open, hp: 300, max: 300, g, slide: open ? 1 : 0 };
  G.s = { x1: G.x1, y1: 0, z1: G.z1, x2: G.x2, y2: 2.3, z2: G.z2, mat: 'metal', group: null, gate: G };
  if (!open) solids.push(G.s);
  GATES.push(G); applyGatePos(G); return G;
}
function applyGatePos(G) { const d = G.slide * (G.L + 0.15); G.g.position.set(G.axis === 'x' ? d : 0, 0, G.axis === 'z' ? d : 0); }
function gateSetOpen(G, open) {
  G.open = open; const i = solids.indexOf(G.s);
  if (open && i >= 0) solids.splice(i, 1); if (!open && i < 0) solids.push(G.s);
  indexSolids(); navRebuild(G.x1, G.z1, G.x2, G.z2); SFX.crate();
}
// F / Y рядом с воротами
function gateNear(p, r = 2.4) {
  let best = null, bd = r;
  for (const G of GATES) { const dx = Math.max(G.x1 - p.x, 0, p.x - G.x2), dz = Math.max(G.z1 - p.z, 0, p.z - G.z2), d = Math.hypot(dx, dz); if (d < bd) { bd = d; best = G; } }
  return best;
}
function tryGate(p) {
  const G = gateNear(p); if (!G) return false;
  if (G.locked && !G.open) { if (!EV.hasKey) { toast(p, 'Заперто — нужна ключ-карта охранника', '#ffb080'); return true; } G.locked = false; toast(p, 'Карта подошла — оружейка открыта', '#8fd46a'); }
  if (!G.open) { gateSetOpen(G, true); toast(p, 'Ворота открыты', '#8fd46a'); return true; }
  const busy = zombies.some(z => !z.dead && z.x > G.x1 - 0.6 && z.x < G.x2 + 0.6 && z.z > G.z1 - 0.6 && z.z < G.z2 + 0.6) || players.some(q => q.x > G.x1 - 0.5 && q.x < G.x2 + 0.5 && q.z > G.z1 - 0.5 && q.z < G.z2 + 0.5);
  if (busy) { toast(p, 'Что-то мешает закрыть', '#ffb080'); return true; }
  gateSetOpen(G, false); toast(p, 'Ворота закрыты', '#ffd76a'); return true;
}
function updateGates(dt) {
  for (let i = GATES.length - 1; i >= 0; i--) {
    const G = GATES[i], want = G.open ? 1 : 0;
    if (G.slide !== want) { G.slide += clamp(want - G.slide, -dt * 2.5, dt * 2.5); applyGatePos(G); }
    if (G.open || G.locked) continue;
    forNear((G.x1 + G.x2) / 2, (G.z1 + G.z2) / 2, z => {                                 // зомби вплотную — ломают
      if (z.dead || Math.abs(z.y) > 0.5) return;
      const ex = Math.max(G.x1 - z.x, 0, z.x - G.x2), ez = Math.max(G.z1 - z.z, 0, z.z - G.z2);
      if (ex * ex + ez * ez < (z.r + 0.15) ** 2) { G.hp -= (z.type === 'fat' ? 16 : 8) * dt; if (!(z.atkT > 0)) z.atkT = 0.45; }
    }, Math.max(3, G.L / 2 + 1));
    if (G.hp <= 0) {
      dust((G.x1 + G.x2) / 2, 1, (G.z1 + G.z2) / 2, 0x8a9090, 14); SFX.crate(); scene.remove(G.g); staticGroup.remove(G.g);
      const k = solids.indexOf(G.s); if (k >= 0) solids.splice(k, 1); indexSolids(); navRebuild(G.x1, G.z1, G.x2, G.z2); GATES.splice(i, 1);
    }
  }
}
// новый забег: сломанные ворота возвращаются, остальные — в исходное состояние
const GATE_START = [];
function resetGates() {
  for (const G of GATES) { staticGroup.remove(G.g); const k = solids.indexOf(G.s); if (k >= 0) solids.splice(k, 1); }
  GATES.length = 0;
  for (const a of GATE_START) addGate(...a);
  indexSolids(); navRebuild(0, 0, MAP, MAP);
}

/* ---------- Прожекторы на вышках: пара ламп на игрока/вид, ближайшие вышки; лучи видны ночью ---------- */
const SEARCH = [];
const SEARCH_LIGHTS = Array.from({ length: QS.search }, () => { const sp = new THREE.SpotLight(0xdce8ff, 0, 46, 0.3, 0.6, 1.1); scene.add(sp); scene.add(sp.target); return sp; });
const BEAM_GEO = new THREE.CylinderGeometry(0.15, 3.2, 1, 14, 1, true); BEAM_GEO.translate(0, -0.5, 0);
const BEAM_MAT = new THREE.MeshBasicMaterial({ color: 0xcfe0ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
function addSearch(x, z, base) {
  const beam = new THREE.Mesh(BEAM_GEO, BEAM_MAT); beam.frustumCulled = false; scene.add(beam);
  SEARCH.push({ x, y: 7.9, z, base, phase: Math.random() * 6, beam, ax: 0, az: 0, d: 0 });
}
const SEARCH_RANGE = 24;
function updateSearch(T) {
  for (const S of SEARCH) {
    const a = S.base + Math.sin(T * 0.35 + S.phase) * 0.95;
    S.ax = S.x + Math.cos(a) * SEARCH_RANGE; S.az = S.z + Math.sin(a) * SEARCH_RANGE;
    const dx = S.ax - S.x, dy = -S.y, dz = S.az - S.z, len = Math.hypot(dx, dy, dz);
    S.beam.position.set(S.x, S.y, S.z); S.beam.scale.set(1, len, 1);
    S.beam.quaternion.setFromUnitVectors(_vUp, _vTmp.set(dx, dy, dz).normalize());
  }
  BEAM_MAT.opacity = 0.07 * clamp((G.night - 0.3) / 0.7, 0, 1) * evLights();
}
const _vUp = new THREE.Vector3(0, -1, 0), _vTmp = new THREE.Vector3();
function setSearchLights(cx, cz) {
  for (const S of SEARCH) S.d = Math.hypot(S.x - cx, S.z - cz);
  const ls = SEARCH.slice().sort((a, b) => a.d - b.d);
  SEARCH_LIGHTS.forEach((sp, i) => { const S = ls[i]; sp.intensity = S && G.night > 0.3 ? 9 * clamp((G.night - 0.3) / 0.7, 0, 1) * evLights() : 0; if (S) { sp.position.set(S.x, S.y, S.z); sp.target.position.set(S.ax, 0, S.az); sp.target.updateMatrixWorld(); } });
}

/* ---------- Постройки карты ---------- */
function blockOp(x1, z1, x2, z2, floors, o = {}) {              // здание с лестницей на крышу
  const B = building(x1, z1, x2, z2, floors, o);
  if (o.gap && o.esc !== undefined) { fireEscape(o.esc, o.gap[0], z2, z2 + 1.3, B.H, B.grp); box(o.gap[0], B.H - 0.1, z2, o.gap[1], B.H, z2 + 1.3, RED, { parent: B.grp, hit: 'metal' }); }
  if (o.cross) { const cx = (x1 + x2) / 2; box(cx - 0.6, 1.6, z2, cx + 0.6, 1.9, z2 + 0.08, 0xc83030, { solid: false }); box(cx - 0.15, 1.15, z2, cx + 0.15, 2.35, z2 + 0.08, 0xc83030, { solid: false }); }
  return B;
}
// Полуоткрытое здание: стены без одной стороны (open), дверной проём (door), плоская крыша — ходовая, если есть лестница
function shedOp(x1, z1, x2, z2, o = {}) {
  const H = o.h || 3.2, T = 0.5, grp = new THREE.Group(), col = o.col || 0x86806e; staticGroup.add(grp);
  const B = { x1, z1, x2, z2, H, grp, mats: [] }, wm = mat(col).clone(); B.mats.push(wm);
  const W = (a1, b1, a2, b2) => box(a1, 0, b1, a2, H, b2, 0, { material: wm, parent: grp });
  const door = o.door || null, sides = { N: [x1, z1, x2, z1 + T], S: [x1, z2 - T, x2, z2], W: [x1, z1, x1 + T, z2], E: [x2 - T, z1, x2, z2] };
  for (const k of ['N', 'S', 'W', 'E']) {
    if (o.open === k || o.open2 === k) continue; const [a1, b1, a2, b2] = sides[k];
    if (door && door.side === k) { const [d1, d2] = door.at; if (k === 'N' || k === 'S') { W(a1, b1, d1, b2); W(d2, b1, a2, b2); box(d1, 2.1, b1, d2, H, b2, 0, { material: wm, parent: grp }); } else { W(a1, b1, a2, d1); W(a1, d2, a2, b2); box(a1, 2.1, d1, a2, H, d2, 0, { material: wm, parent: grp }); } }
    else W(a1, b1, a2, b2);
  }
  const rm = mat(ROOF).clone(); B.mats.push(rm);
  box(x1, H - 0.25, z1, x2, H, z2, 0, { material: rm, parent: grp });                                   // крыша: под ней ходят, по ней — если есть лестница
  const PH = 0.4, pm = mat(0xc8b69a).clone(); B.mats.push(pm);
  const gap = o.gap;
  if (gap) { para(x1, H, z2 - 0.16, gap[0], H + PH, z2, 0, { material: pm, parent: grp }); para(gap[1], H, z2 - 0.16, x2, H + PH, z2, 0, { material: pm, parent: grp }); } else para(x1, H, z2 - 0.16, x2, H + PH, z2, 0, { material: pm, parent: grp });
  para(x1, H, z1, x2, H + PH, z1 + 0.16, 0, { material: pm, parent: grp }); para(x1, H, z1, x1 + 0.16, H + PH, z2, 0, { material: pm, parent: grp }); para(x2 - 0.16, H, z1, x2, H + PH, z2, 0, { material: pm, parent: grp });
  if (gap && o.esc !== undefined) { fireEscape(o.esc, gap[0], z2, z2 + 1.3, H, grp); box(gap[0], H - 0.1, z2, gap[1], H, z2 + 1.3, RED, { parent: grp, hit: 'metal' }); }
  buildings.push(B);
  B.finish = () => { const cache = new Map(); B.mats = []; grp.traverse(m => { if (!m.isMesh) return; let c = cache.get(m.material); if (!c) { c = m.material.clone(); cache.set(m.material, c); B.mats.push(c); } m.material = c; }); };
  return B;
}
function fenceZ(z1, z2, x) {                       // сетка-рабица вдоль z
  const net = mat(0x8a9090, { transparent: true, opacity: 0.45 });
  box(x - 0.04, 0, z1, x + 0.04, 2.2, z2, 0, { material: net, cast: false });
  for (let z = z1; z <= z2 + 0.01; z += 2) box(x - 0.06, 0, Math.min(z, z2) - 0.06, x + 0.06, 2.35, Math.min(z, z2) + 0.06, 0x5a5e5e, { solid: false });
  box(x - 0.03, 2.2, z1, x + 0.03, 2.26, z2, 0x5a5e5e, { solid: false });
}
function bridgeOp(a1, a2, b1, b2, H, axis) {         // мостик между крышами: узкий настил с перилами
  const x1 = axis === 'x' ? a1 : b1, x2 = axis === 'x' ? a2 : b2, z1 = axis === 'x' ? b1 : a1, z2 = axis === 'x' ? b2 : a2;
  box(x1, H - 0.18, z1, x2, H, z2, 0x6e6a60, { hit: 'metal' });
  for (const [ax, az, bx, bz] of axis === 'x' ? [[x1, z1, x2, z1 + 0.08], [x1, z2 - 0.08, x2, z2]] : [[x1, z1, x1 + 0.08, z2], [x2 - 0.08, z1, x2, z2]]) box(ax, H, az, bx, H + 0.9, bz, 0x5a5e5e, { solid: false });
  box(x1, H - 0.9, z1, x2, H - 0.18, z2, 0x4a4844, { solid: false, cast: false });
}
function pensOp(x1, x2, z1, z2, n, both) {           // прогулочные клетки: проём к югу (both — и к северу: второй выход)
  const w = (x2 - x1) / n, gapW = both ? 2.4 : 1.8;
  if (both) for (let i = 0; i < n; i++) { const a = x1 + i * w, m = a + w / 2; fenceX(a, m - gapW / 2, z1); fenceX(m + gapW / 2, a + w, z1); } else fenceX(x1, x2, z1);
  for (let i = 0; i <= n; i++) fenceZ(z1, z2, x1 + i * w);
  for (let i = 0; i < n; i++) { const a = x1 + i * w, m = a + w / 2; fenceX(a, m - gapW / 2, z2); fenceX(m + gapW / 2, a + w, z2); }
}
function graveOp(x, z) {
  box(x - 0.35, 0, z - 0.2, x + 0.35, 0.18, z + 0.2, 0x6e6a60, { solid: false });
  box(x - 0.06, 0.18, z - 0.06, x + 0.06, 1.0, z + 0.06, 0x7a7468, { hit: 'concrete' }); box(x - 0.28, 0.66, z - 0.06, x + 0.28, 0.78, z + 0.06, 0x7a7468, { solid: false });
}
function tankOp(x, z) {                              // топливный бак: жёлтый цилиндр из коробок с красными полосами
  box(x - 1.1, 0, z - 1.1, x + 1.1, 2.6, z + 1.1, 0xb8a040, { hit: 'metal' });
  for (const y of [0.5, 2.0]) box(x - 1.14, y, z - 1.14, x + 1.14, y + 0.14, z + 1.14, 0x8a2e22, { solid: false });
  box(x - 0.4, 2.6, z - 0.4, x + 0.4, 3.0, z + 0.4, 0x5a5448, { solid: false });
}
function gazeboOp(x, z) {                            // беседка во дворе: низкая стена с проёмами с четырёх сторон и крыша на столбах
  const c = 0x9c968a, h = 0.9, a = 3.6, g = 1.1;
  for (const s of [-1, 1]) { box(x - a, 0, z + s * a - 0.15, x - g, h, z + s * a + 0.15, c); box(x + g, 0, z + s * a - 0.15, x + a, h, z + s * a + 0.15, c); box(x + s * a - 0.15, 0, z - a, x + s * a + 0.15, h, z - g, c); box(x + s * a - 0.15, 0, z + g, x + s * a + 0.15, h, z + a, c); }
  for (const [dx, dz] of [[-a, -a], [a, -a], [-a, a], [a, a]]) box(x + dx - 0.25, 0, z + dz - 0.25, x + dx + 0.25, 3.2, z + dz + 0.25, 0x7a766c);
  box(x - a - 0.5, 3.2, z - a - 0.5, x + a + 0.5, 3.45, z + a + 0.5, 0x6a6458);
  for (const dx of [-1.6, 1.6]) bench(x + dx, z, 1);
}
function hoopOp(x, z) {                              // баскетбольный щит
  if (useModel('m_hoop')) return hoopModel(x, z);
  const s = x < 84 ? 1 : -1;
  box(x - 0.08, 0, z - 0.08, x + 0.08, 3.1, z + 0.08, 0x5a5e5e); box(x + s * 0.1 - 0.04, 2.6, z - 0.6, x + s * 0.1 + 0.04, 3.4, z + 0.6, 0xe8e4d8, { solid: false });
  box(x + s * 0.1, 2.6, z - 0.2, x + s * 0.5, 2.66, z + 0.2, 0xd8702a, { solid: false });
}
function busOp() {}                                // автобусы убраны из игры; операция оставлена, чтобы старые сохранённые карты не ломались
function boothOp(x, z) { box(x, 0, z - 1.2, x + 1.0, 2.6, z + 0.2, 0x8a8a84); }
function barrierOp(x, z) { box(x, 0.9, z, x + 3.6, 1.0, z + 0.1, 0xc84a2a, { solid: false }); }
function postOp(x, z) { box(x - 0.15, 0, z - 0.15, x + 0.15, 2.6, z + 0.15, 0x5a5e5e); }

// Беседка, вышки, баки, автобусы, деревья, мостики: тоже прозрачнеют, когда закрывают героя (как дома)
function fadeWrap(fn) {
  return (...a) => {
    const grp = new THREE.Group(); staticGroup.add(grp);
    const prev = BOX_PARENT; BOX_PARENT = grp; try { fn(...a); } finally { BOX_PARENT = prev; }
    if (!grp.children.length) { staticGroup.remove(grp); return; }
    const bb = new THREE.Box3().setFromObject(grp);
    const B = { x1: bb.min.x, z1: bb.min.z, x2: bb.max.x, z2: bb.max.z, H: bb.max.y, grp, mats: [] };
    B.finish = () => { const cache = new Map(); B.mats = []; grp.traverse(m => { if (!m.isMesh) return; let c = cache.get(m.material); if (!c) { c = m.material.clone(); cache.set(m.material, c); B.mats.push(c); } m.material = c; }); };
    buildings.push(B);
  };
}
const MAP_OPS = {
  wall: (...a) => wallSeg(...a), tower: fadeWrap((x, z) => tower(x, z)), fenceX: (...a) => fenceX(...a), fenceZ: (...a) => fenceZ(...a),
  gate: (x1, z1, x2, z2, axis, open) => addGate(x1, z1, x2, z2, axis, open), search: (x, z, a) => addSearch(x, z, a),
  block: blockOp, shed: shedOp, bridge: fadeWrap(bridgeOp), pens: pensOp, grave: graveOp, tank: fadeWrap(tankOp), gazebo: fadeWrap(gazeboOp), hoop: hoopOp, bus: fadeWrap(busOp), booth: fadeWrap(boothOp), barrier: barrierOp, post: postOp,
  barrel, lamp, car, bench, waterTower: fadeWrap(waterTower), tree: fadeWrap((x, z) => (MODELS.tree ? model('tree', x, z, x * 1.7) : tree(x, z))),
  trashbin: (x, z, rot) => trashBinOp(x, z, rot), trashbag: (x, z) => trashBagOp(x, z),
  bush: (x, z) => MODELS.bush && model('bush', x, z, x * 2.3, 0.9 + (x % 1) * 0.3), cone: (x, z) => MODELS.cone && model('cone', x, z, x),
};
// Стена по границе карты заменяется внутренним забором-рабицей: полупрозрачный, за ним видна земля (см. 04h_outside.js)
function borderFence(op) {
  if (op[0] !== 'wall') return op;
  const [, x1, z1, x2, z2] = op, thin = 0.6, e = 0.05;
  if (x2 - x1 > z2 - z1 && z2 - z1 <= thin && (z1 <= e || z2 >= MAP - e)) return ['fenceX', x1, x2, z1 <= e ? 0.3 : MAP - 0.3];
  if (z2 - z1 > x2 - x1 && x2 - x1 <= thin && (x1 <= e || x2 >= MAP - e)) return ['fenceZ', z1, z2, x1 <= e ? 0.3 : MAP - 0.3];
  return op;
}
function buildMap() {
  paintGround(MAPDEF.zones); groundTex.needsUpdate = true;
  window.EDFOOT = [];                                                              // для редактора: из каких коробок состоит каждый объект
  for (const op0 of MAPDEF.ops) { const op = borderFence(op0), f = MAP_OPS[op[0]], s0 = solids.length; if (f) f(...op.slice(1)); else console.warn('Неизвестная операция карты', op[0]); EDFOOT.push(solids.slice(s0).map(q => [q.x1, q.z1, q.x2, q.z2, q.y2])); }
  for (const B of buildings) B.finish();
  indexSolids();
  buildRelief(MAPDEF);                                                              // серые бордюры
  buildOutside(MAPDEF);                                                             // земля и деревья за забором
  buildDetails(MAPDEF);                                                             // мелочи на земле: трещины, лужи, трава, камни
}
// Точки выхода зомби: проломы, ворота, двери зданий и пустыри по сетке (кроме огороженных участков)
function mapSpawns() {
  if (MAPDEF.spawnPts) return MAPDEF.spawnPts.filter(p => !blocked(p.x, p.z, 0, 0.5) && floorAt(p.x, p.z, 0) === 0).map(p => ({ x: p.x, z: p.z, kind: 'field' }));   // город: точки на улицах
  const S = [{ x: 47.5, z: 1.4, kind: 'breach' }, { x: 1.4, z: 57, kind: 'gate' }, { x: MAP - 1.4, z: 57, kind: 'gate' }, { x: 48, z: MAP - 1.4, kind: 'gate' }];
  for (const [x, z] of MAPDEF.doors) S.push({ x, z, kind: 'bld' });
  const bad = (x, z) => MAPDEF.noSpawn.some(r => x > r[0] && x < r[2] && z > r[1] && z < r[3]);
  for (let x = 8; x < MAP; x += 12) for (let z = 8; z < MAP; z += 12) if (!bad(x, z) && !blocked(x, z, 0, 0.6) && floorAt(x, z, 0) === 0) S.push({ x, z, kind: 'field' });
  return S;
}
