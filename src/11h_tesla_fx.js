'use strict';
/* ---------- Тесла-ранец: ранец на спине героя и заметные молнии ----------
   Ранец рисуется коробками на теле героя (катушек столько, какой уровень девайса). Молния — ломаная из светящихся
   брусков от верхушки катушки к зомби и дальше по цепочке, мерцает ~0,3 с; на цели вспышка света, искры и треск. */
const TBOLTS = [];
const TESLA_LIGHT = new THREE.PointLight(0x9fe8ff, 0, 7, 1.4); scene.add(TESLA_LIGHT);
let teslaLightK = 0;
const _tbA = new THREE.Vector3(), _tbB = new THREE.Vector3();

// верхушка катушки i в мире (для начала молнии и искр)
function teslaTip(p, i, lv) {
  const H = VZ.H, W = VZ.W, pv = VOXHERO.parts.body.pivot, ox = (i - (lv - 1) / 2) * 0.046 * W * H, oz = -0.095 * W * H, c = Math.cos(p.yaw), s = Math.sin(p.yaw);
  return { x: p.x + ox * c + oz * s, y: p.y + (pv[1] + 0.305) * H, z: p.z - ox * s + oz * c };
}
// ранец на спине (вызывается из drawVoxHero после модели героя: корень _vr уже выставлен)
function drawTeslaPack(p) {
  const lv = devLv(p, 'tesla'); if (!lv) return;
  const pv = VOXHERO.parts.body.pivot;
  _gs.makeScale(VZ.W, 1, VZ.W); _gt.makeRotationX(0); _gt.setPosition(pv[0] * VZ.W, pv[1], pv[2] * VZ.W);
  _root.multiplyMatrices(_vr, _gt); _root.multiply(_gs);
  const P = (col, sx, sy, sz, ox, oy, oz) => part(lin(col), 0, 0, 0, 0, sx, sy, sz, oy, oz, 0, ox);
  P(0x3c424a, 0.125, 0.165, 0.07, 0, 0.115, -0.095);                       // корпус
  P(0x6a727c, 0.112, 0.012, 0.062, 0, 0.2, -0.095);                        // крышка
  P(0xd8b030, 0.1, 0.012, 0.004, 0, 0.075, -0.1325);                       // полоса опасности
  for (const x of [-0.03, 0, 0.03]) P(0x9ff8ff, 0.014, 0.014, 0.004, x, 0.14, -0.1335);   // огоньки
  for (let i = 0; i < lv; i++) {
    const x = (i - (lv - 1) / 2) * 0.046;
    P(0x2c3036, 0.028, 0.03, 0.028, x, 0.215, -0.095);                     // основание катушки
    P(0xc07a38, 0.036, 0.01, 0.036, x, 0.245, -0.095); P(0x8a5428, 0.036, 0.01, 0.036, x, 0.262, -0.095); P(0xc07a38, 0.036, 0.01, 0.036, x, 0.279, -0.095);
    P(0xcffcff, 0.016, 0.02, 0.016, x, 0.305, -0.095);                     // светящийся шар
  }
  for (const x of [-0.056, 0.056]) { P(0x9aa0a8, 0.006, 0.12, 0.006, x, 0.28, -0.12); P(0x9ff8ff, 0.012, 0.012, 0.012, x, 0.345, -0.12); }   // антенны
  // тихое свечение на шарах; когда рядом зомби — потрескивает
  const near = p.down ? null : nearestZombie(p.x, p.z, 6);
  if (!p.down) for (let i = 0; i < lv; i++) {
    const t = teslaTip(p, i, lv);
    if (Math.random() < 0.25) spawnP({ x: t.x, y: t.y, z: t.z, s: 0.1, s1: 0.03, col: 0xa8f4ff, glow: true, life: 0.12 });
    if (near && Math.random() < 0.06) spawnP({ x: t.x + rnd(-0.08, 0.08), y: t.y + rnd(-0.04, 0.12), z: t.z + rnd(-0.08, 0.08), vy: 0.6, s: 0.04, col: 0xffffff, glow: true, life: 0.1 });
  }
}

// ломаная молния от a к b: ядро (белое) и ореол (голубой, сложение)
function addBolt(a, b, thin) {
  const len = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z), n = clamp(Math.ceil(len / 0.4), 4, 14);
  const core = new THREE.MeshBasicMaterial({ color: 0xf6feff, transparent: true, depthWrite: false }), glow = new THREE.MeshBasicMaterial({ color: 0x4cc4ff, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending });
  const B = { a, b, n, thin, t: 0, jt: 0, life: thin ? 0.2 : 0.34, core, glow, cm: [], gm: [], amp: Math.min(0.22, 0.06 + len * 0.04) };
  for (let i = 0; i < n; i++) {
    const c = new THREE.Mesh(boxGeo, core), g = new THREE.Mesh(boxGeo, glow);
    for (const m of [c, g]) { m.frustumCulled = false; m.renderOrder = 7; scene.add(m); }
    B.cm.push(c); B.gm.push(g);
  }
  layoutBolt(B); TBOLTS.push(B);
  if (!thin && B.n > 5) for (let k = 0; k < 2; k++) {                     // боковые ответвления
    const f = 0.3 + 0.4 * Math.random(), s = B.pts[Math.floor(f * B.n)] || a;
    addBolt(s, { x: s.x + rnd(-0.9, 0.9), y: s.y + rnd(-0.5, 0.5), z: s.z + rnd(-0.9, 0.9) }, true);
  }
}
function layoutBolt(B) {
  const pts = [{ x: B.a.x, y: B.a.y, z: B.a.z }];
  for (let i = 1; i < B.n; i++) { const f = i / B.n, k = B.amp * (1 - Math.abs(f - 0.5) * 0.6); pts.push({ x: B.a.x + (B.b.x - B.a.x) * f + rnd(-k, k), y: B.a.y + (B.b.y - B.a.y) * f + rnd(-k, k), z: B.a.z + (B.b.z - B.a.z) * f + rnd(-k, k) }); }
  pts.push({ x: B.b.x, y: B.b.y, z: B.b.z }); B.pts = pts;
  const wc = B.thin ? 0.03 : 0.045, wg = B.thin ? 0.09 : 0.15;
  for (let i = 0; i < B.n; i++) {
    _tbA.set(pts[i].x, pts[i].y, pts[i].z); _tbB.set(pts[i + 1].x, pts[i + 1].y, pts[i + 1].z);
    const len = _tbA.distanceTo(_tbB) + 0.02;
    for (const [m, w] of [[B.cm[i], wc], [B.gm[i], wg]]) { m.position.copy(_tbA).add(_tbB).multiplyScalar(0.5); m.lookAt(_tbB); m.scale.set(w, w, len); }
  }
}
function updateTeslaFx(dt) {
  for (let i = TBOLTS.length - 1; i >= 0; i--) {
    const B = TBOLTS[i]; B.t += dt; B.jt += dt;
    if (B.t >= B.life) { for (const m of [...B.cm, ...B.gm]) scene.remove(m); B.core.dispose(); B.glow.dispose(); TBOLTS.splice(i, 1); continue; }
    if (B.jt > 0.045) { B.jt = 0; layoutBolt(B); }                                   // мерцает: каждые ~45 мс форма новая
    const k = 1 - B.t / B.life; B.core.opacity = Math.min(1, 0.35 + k * 1.2); B.glow.opacity = 0.55 * k + 0.1;
  }
  teslaLightK = Math.max(0, teslaLightK - dt * 4); TESLA_LIGHT.intensity = teslaLightK * 6;
}
function teslaFlash(t) { for (let i = 0; i < 8; i++) spawnP({ x: t.x, y: t.y, z: t.z, vx: rnd(-1.5, 1.5), vy: rnd(0, 2), vz: rnd(-1.5, 1.5), s: 0.07, s1: 0.01, col: 0xcffcff, glow: true, life: 0.25, drag: 0.9 }); }
function teslaImpact(z) {
  const y = z.y + 0.75; sparks(z.x, y, z.z);
  for (let i = 0; i < 8; i++) spawnP({ x: z.x, y, z: z.z, vx: rnd(-2.5, 2.5), vy: rnd(0.5, 3), vz: rnd(-2.5, 2.5), s: 0.06, s1: 0.01, col: 0xbff4ff, glow: true, life: 0.3, drag: 0.92 });
  TESLA_LIGHT.position.set(z.x, y + 0.2, z.z); teslaLightK = 1; z.flash = 0.25;
}
function clearTeslaFx() { for (const B of TBOLTS) { for (const m of [...B.cm, ...B.gm]) scene.remove(m); B.core.dispose(); B.glow.dispose(); } TBOLTS.length = 0; teslaLightK = 0; TESLA_LIGHT.intensity = 0; }
Object.assign(SFX, {
  zap() { if (!soundOn() || !canPlay('zap', 90)) return; noiseHit({ dur: 0.18, type: 'highpass', freq: 3200, q: 0.8, vol: 0.28 }); tone({ f0: 2400, f1: 260, dur: 0.22, vol: 0.2, type: 'sawtooth' }); tone({ f0: 90, f1: 60, dur: 0.25, vol: 0.25 }); },
});
