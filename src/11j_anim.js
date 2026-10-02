'use strict';
/* ---------- Анимации героя и зомби: всё процедурно, на тех же жёстких частях модели ----------
   Герой: шаг/бег с качкой корпуса, ноги по направлению движения (стрейф, спиной), дыхание, приземление, вздрагивание,
   перезарядка своя у каждого типа оружия, бросок, ближний бой, лестница, рывок крюком, подъём после нокдауна.
   Зомби: четыре походки у ходока, рывок при укусе, подъём из земли. */
const ss = (a, b, k) => { k = clamp((k - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };
const angDiff = a => Math.atan2(Math.sin(a), Math.cos(a));
// ключевые кадры [[k, значение], ...] со сглаживанием между ними
function kf(keys, k) {
  if (k <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (k <= keys[i][0]) { const [k0, v0] = keys[i - 1], [k1, v1] = keys[i]; return v0 + (v1 - v0) * ss(k0, k1, k); }
  return keys[keys.length - 1][1];
}
// Перезарядка: dip — наклон ствола (+ вниз), b — угол второй руки (-1.3 — держит ствол), by — разворот второй руки, mag — когда падает магазин
const RELOAD_ANIM = {
  mag:      { dip: [[0, 0], [.12, .5], [.7, .5], [.85, .25], [1, 0]], b: [[0, -1.3], [.12, -1.3], [.28, -.3], [.48, -.3], [.62, -1.4], [.75, -1.4], [.85, -.95], [.95, -1.3], [1, -1.3]], by: [[0, -.42], [.12, -.42], [.28, .12], [.48, .12], [.62, -.42], [1, -.42]], mag: 0.18 },
  shotgun:  { dip: [[0, 0], [.2, .4], [.8, .4], [1, 0]], b: [[0, -1.3], [.2, -.55], [.4, -.45], [.55, -.6], [.7, -.45], [.85, -1.0], [.92, -1.45], [1, -1.3]], by: [[0, -.42], [.2, .05], [.8, .05], [1, -.42]] },
  sawnoff:  { dip: [[0, 0], [.15, .85], [.7, .85], [.82, .05], [.9, .2], [1, 0]], b: [[0, -1.3], [.2, -.55], [.45, -.5], [.65, -1.0], [.82, -1.35], [1, -1.3]], by: [[0, -.42], [.2, .1], [.6, .1], [1, -.42]] },
  revolver: { dip: [[0, 0], [.12, -.4], [.5, -.4], [.8, .15], [.9, -.1], [1, 0]], b: [[0, -.15], [.2, -1.1], [.7, -1.1], [.85, -.9], [1, -.15]], by: [[0, 0], [.2, -.3], [.8, -.3], [1, 0]] },
  crossbow: { dip: [[0, 0], [.3, .5], [.8, .5], [1, 0]], b: [[0, -1.3], [.2, -.6], [.6, -.15], [.75, -1.3], [1, -1.3]], by: [[0, -.42], [.2, .1], [.6, .1], [.75, -.42], [1, -.42]] },
};
const RELOAD_OF = { rifle: 'mag', mg: 'mag', smg: 'mag', shotgun: 'shotgun', sawnoff: 'sawnoff', revolver: 'revolver', crossbow: 'crossbow' };

// Покадровое состояние героя: реальная скорость, куда смотрят ноги, приземление, вздрагивание
function animPlayer(p, dt) {
  const A = p.an || (p.an = { spd: 0, legYaw: 0, legDir: 1, land: 0, landMax: 0.3, hurt: 0, air: false, minVy: 0, ox: p.x, oz: p.z, magDone: false, pose: null });
  if (dt <= 0) return A;
  const mx = p.x - A.ox, mz = p.z - A.oz; A.ox = p.x; A.oz = p.z;
  const v = Math.hypot(mx, mz) / dt, want = p.moving && !p.down && !p.climb ? clamp(v / (CFG.PLAYER_SPEED * (p.st ? p.st.speed : 1)), 0.4, 1.4) : 0;
  A.spd += (want - A.spd) * Math.min(1, dt * 12);
  // ноги смотрят по движению; спиной вперёд — шагают в обратную сторону
  let ly = 0, dir = 1;
  if (want > 0 && p.moving) { const d = angDiff(Math.atan2(p.mvx || 0, p.mvz || 1) - p.yaw); if (Math.abs(d) > Math.PI / 2) { dir = -1; ly = angDiff(d - Math.PI); } else ly = d; }
  A.legYaw += angDiff(ly - A.legYaw) * Math.min(1, dt * 14); A.legDir = dir;
  // приземление
  const fl = floorAt(p.x, p.z, p.y + 0.3, p.r * 0.6), air = p.y > fl + 0.1 && !p.climb;
  if (air) A.minVy = Math.min(A.minVy, p.vy); else if (A.air) { if (A.minVy < -4) { A.landMax = clamp(-A.minVy / 36, 0.18, 0.4); A.land = A.landMax; } A.minVy = 0; }
  A.air = air; if (A.land > 0) A.land -= dt;
  if (p.hurtA > 0) { A.hurt = p.hurtA / 0.3; p.hurtA -= dt; } else A.hurt = 0;
  if (p.throwA > 0) p.throwA -= dt;
  if (!p.down && p.fall < 0) p.fall = Math.min(0, p.fall + dt * 4.5);       // встаёт после нокдауна
  const rk = p.reloadK || 0;
  if (rk <= 0 || rk > 0.9) A.magDone = false;
  // ствол поднят, пока стреляешь, перезаряжаешься, бьёшь; в остальное время и на спринте — опущен
  if (A.ready === undefined) A.ready = 1;
  const up = !p.sprinting && !p.down && (p.firing || G.t - (p.lastShot === undefined ? -9 : p.lastShot) < 1.4 || rk > 0 || p.meleeSw || p.throwA > 0);
  A.ready += ((up ? 1 : 0) - A.ready) * Math.min(1, dt * (up ? 14 : 3.5));
  return A;
}

// Поза героя на этот кадр: углы частей, наклон/качка корпуса, смещение вверх (в долях роста), наклон ствола
function heroPose(p) {
  const A = p.an || animPlayer(p, 0), gp = p.pitch || 0, kick = p.kick || 0, k = p.reloadK || 0, ph = p.phase, run = p.sprinting, spd = Math.min(1.1, A.spd);
  const amp = (run ? 0.95 : 0.62) * spd, sw = Math.sin(ph) * amp * A.legDir;
  const P = { ang: { legA: sw, legB: -sw, head: -gp * 0.3 }, yaw: {}, lean: (p.fall || 0) + (run ? 0.1 : 0.04 * spd), roll: Math.sin(ph) * 0.035 * spd * (run ? 1.4 : 1), dy: Math.abs(Math.sin(ph)) * (run ? 0.03 : 0.018) * spd, dip: 0, hideGun: false };
  const a = P.ang, y = P.yaw;
  if (Math.abs(A.legYaw) > 0.02) y.legA = y.legB = A.legYaw;
  if (spd < 0.1) { const br = Math.sin(G.t * 2.2); P.dy += br * 0.006; a.head += br * 0.02; }          // дыхание
  if (A.land > 0) { const t = Math.sin((1 - A.land / A.landMax) * Math.PI); P.dy -= 0.08 * t; P.lean += 0.14 * t; a.legA = a.legB = 0.45 * t; }   // приземление: присел
  else if (A.air && !p.hookAnim) { a.legA = 0.55; a.legB = -0.35; }
  if (p.down) { a.armA = a.armB = -0.2; P.dy = 0; return P; }
  if (A.hurt > 0) { P.lean -= 0.28 * A.hurt; a.head += 0.45 * A.hurt; }                         // вздрогнул от удара
  if (p.climb) {                                                                                  // лестница: руки и ноги по очереди
    const c = Math.sin(p.y * 7) * (p.climb.dir ? 1 : 0);
    a.armA = -2.75 + c * 0.55; a.armB = -2.75 - c * 0.55; a.legA = -0.15 - c * 0.7; a.legB = -0.15 + c * 0.7; a.head = -0.2; P.lean = 0; P.roll = 0; P.dy = 0; P.hideGun = true; y.legA = y.legB = 0; return P;
  }
  if (p.hookAnim) { a.armA = a.armB = p.hookAnim.climb ? -2.9 : -1.7; a.legA = 0.5; a.legB = 0.3; P.lean += 0.25; P.hideGun = true; return P; }
  const rm = RELOAD_ANIM[RELOAD_OF[p.gun] || 'mag'];
  let rdip = 0, bOv = null, byOv = null;
  if (k > 0 && !p.hand) {
    rdip = kf(rm.dip, k); bOv = kf(rm.b, k); byOv = kf(rm.by, k);
    if (rm.mag && !A.magDone && k > rm.mag) {                                                       // магазин выпал из ствола
      A.magDone = true; if (p.gun !== 'crossbow') spawnP({ x: p.x + Math.sin(p.yaw) * 0.25, y: p.y + HAND_Y, z: p.z + Math.cos(p.yaw) * 0.25, vx: Math.sin(p.yaw + 1.2) * 0.8, vy: 0.4, vz: Math.cos(p.yaw + 1.2) * 0.8, g: 16, s: 0.075, sx: 0.8, sy: 1.8, sz: 0.55, ry: p.yaw, col: 0x2c2c2e, life: 30, bounce: 1, stay: true, snd: 'brass' });
    }
  }
  P.dip = rdip;
  const hand = oneHand(p), tw = hand && twinGuns(p), rest = Math.sin(G.t * 2.2) * 0.015 * (spd < 0.1 ? 1 : 0);
  const HD = !p.hand ? gunHold(p, A.ready === undefined ? 1 : A.ready, gp, kick, rdip) : null;
  if (HD) {                                                                                      // воксельный ствол: руки тянутся к рукояти и цевью
    P.hold = HD; P.sc = { armA: HD.armA.sc, armB: 1 };
    const wIK = k > 0 && bOv !== null ? 1 - ss(0, 0.1, k) * (1 - ss(0.9, 1, k)) : 1;           // середина перезарядки: вторая рука занята своим делом
    a.armA = HD.armA.a + rest; y.armA = HD.armA.yaw;
    if (HD.armB) {
      a.armB = wIK < 1 ? bOv * (1 - wIK) + HD.armB.a * wIK : HD.armB.a; y.armB = wIK < 1 ? byOv * (1 - wIK) + HD.armB.yaw * wIK : HD.armB.yaw; P.sc.armB = wIK < 1 ? 1 + (HD.armB.sc - 1) * wIK : HD.armB.sc;
    } else { a.armB = bOv !== null ? bOv : -0.15 - Math.sin(ph) * 0.5 * spd * A.legDir; if (byOv !== null) y.armB = byOv; }
    P.dip = 0;
  } else if (hand) {
    a.armA = -1.5 - gp + kick * 0.3 + rdip + rest; y.armA = 0.05;
    a.armB = tw ? a.armA : (bOv !== null ? bOv : -0.15 - Math.sin(ph) * 0.5 * spd * A.legDir); if (tw) y.armB = -0.05; else if (byOv !== null) y.armB = byOv;
  } else {
    a.armA = -1.45 - gp + kick * 0.3 + rdip + rest + Math.sin(ph * 2) * 0.02 * spd; a.armB = (bOv !== null ? bOv : -1.3 - gp + kick * 0.2 + rest) + (bOv === null ? rdip : 0); y.armA = 0.18; y.armB = byOv !== null ? byOv : -0.42;
  }
  if (p.throwA > 0) {                                                                             // бросок: замах и выброс
    const t = 1 - p.throwA / 0.35;
    a.armA = kf([[0, a.armA], [.35, -2.7], [.6, -0.7], [1, a.armA]], t); y.armA = 0; P.lean += 0.16 * Math.sin(t * Math.PI); P.dip = 0; if (P.sc) P.sc.armA = 1; if (P.hold) P.hold.handA = null;
  }
  const sw2 = p.meleeSw;
  if (sw2) {                                                                                      // удар: рывок вперёд и замах
    const t = clamp(sw2.t / sw2.dur, 0, 1);
    a.armA = kf([[0, -2.5], [.3, -2.6], [.6, -0.5], [1, -1.0]], t); a.armB = kf([[0, -2.2], [.3, -2.4], [.6, -0.6], [1, -1.0]], t); y.armA = y.armB = 0; if (P.sc) P.sc.armA = P.sc.armB = 1; P.hold = null; P.lean += 0.4 * Math.sin(t * Math.PI); P.dy -= 0.03 * Math.sin(t * Math.PI);
  }
  return P;
}
