'use strict';
/* ---------- Разлёт частей: при мощном убийстве (дробь в упор, крупный калибр, взрыв) зомби разлетается на части тела ----------
   Голова, торс, руки и ноги — настоящие части воксельной модели: летят, кувыркаются, отскакивают, оставляют кровавый след и лужи,
   лежат на земле ~15 с и уходят в землю. Шанс растёт с «перебором» урона за последние 0,3 с относительно здоровья зомби. Включается в Настройках. */
const GIBS = [], GIBF = { boom: false };
let GIBS_ON = lsGet('gibs', true);
const GIB_MAX = IS_TOUCH ? 36 : 80, _gq = new THREE.Quaternion(), _gdq = new THREE.Quaternion(), _gax = new THREE.Vector3(), _gz = new THREE.Matrix4().makeScale(0, 0, 0), _gtr = new THREE.Matrix4();

// копим урон за короткое окно (вызывается из damageZombie)
function gibTrack(z, dmg) { z.rw = (G.t - (z.rwT === undefined ? -9 : z.rwT) < 0.3 ? (z.rw || 0) : 0) + dmg; z.rwT = G.t; }
// решение при смерти: true — тело разлетелось
function maybeGib(z, dx, dz, knock) {
  if (!GIBS_ON || z.gone) return false;
  const T = ZOMBIES[z.type]; if (T.boss || T.fat) return false;
  const ratio = (z.rw || 0) / Math.max(1, z.mhp || 1);
  const chance = GIBF.boom ? (ratio > 0.4 ? 1 : 0.35) : clamp((ratio - 1.15) * 1.1, 0, 0.9);
  if (Math.random() >= chance) return false;
  gibZombie(z, dx, dz, clamp(ratio, 0.8, 3)); return true;
}
function formScale(z) {
  const arm = z.form === 'armored', run = z.form === 'run';
  return { H: VZ.H * (run ? 0.95 : arm ? 1.04 : FORM_H[z.form] || 1), w: arm ? 1.12 : FORM_W[z.form] || 1 };
}
function gibZombie(z, dx, dz, ratio) {
  z.gone = true; z.sinkT = 9; z.sink = 9;                                  // тело убираем, остаются части
  const dl = Math.hypot(dx, dz) || 1, ux = dx ? dx / dl : Math.cos(z.yaw + 1.57), uz = dz ? dz / dl : Math.sin(z.yaw + 1.57), spd = clamp(2.5 + ratio * 2.6, 3.5, 9.5);
  blood(z.x, z.y + 0.7, z.z, ux, uz, 22); bloodDecal(z.x, z.z, 0.55, ux, uz);
  SFX.gib(); shake = Math.max(shake, 0.12);
  for (let i = 0; i < 9; i++) spawnP({ x: z.x, y: z.y + 0.7, z: z.z, vx: ux * rnd(2, 7) + rnd(-2, 2), vy: rnd(2, 6), vz: uz * rnd(2, 7) + rnd(-2, 2), g: 16, s: rnd(0.07, 0.13), col: z.look[i % 3] ?? 0x8a1010, life: 10, bounce: 1, rx: rnd(0, 3) });   // мелкие куски
  if (!isVoxZ(z)) return;                                                  // собака и прочие «из коробок» — только мелкие куски
  const M = VOXMS[z.vm % VOXMS.length], { H, w } = formScale(z), W = VZ.W * w, c = Math.cos(z.yaw), s = Math.sin(z.yaw);
  for (const k of VOX_PARTS) {
    if (k !== 'body' && Math.random() < (k === 'head' ? 0.2 : 0.3)) continue;                    // часть «испарилась» в кровь
    const pv = M.parts[k].pivot, B = M.box[k], lx = (pv[0] + B.c.x) * W * H, ly = (pv[1] + B.c.y) * H, lz = (pv[2] + B.c.z) * W * H;
    const g = { M, k, H, W, c: B.c, r: Math.max(0.12, Math.max(B.s.x * W, B.s.y, B.s.z * W) * H * 0.4),
      pos: new THREE.Vector3(z.x + lx * c + lz * s, z.y + ly, z.z - lx * s + lz * c), q: new THREE.Quaternion().setFromAxisAngle(_gax.set(0, 1, 0), z.yaw),
      vel: new THREE.Vector3(ux * spd * rnd(0.6, 1.2) + rnd(-2, 2), rnd(2.5, 6.5) * (k === 'body' ? 0.7 : 1), uz * spd * rnd(0.6, 1.2) + rnd(-2, 2)),
      av: new THREE.Vector3(rnd(-12, 12), rnd(-12, 12), rnd(-12, 12)), t: 0, life: rnd(13, 18), rest: 0, bounces: 0, sink: 0 };
    GIBS.push(g);
  }
  while (GIBS.length > GIB_MAX) GIBS.shift();
}
function updateGibs(dt) {
  for (let i = GIBS.length - 1; i >= 0; i--) {
    const g = GIBS[i]; g.t += dt;
    if (g.t > g.life) { g.sink += dt * 0.6; if (g.sink > 0.5) { GIBS.splice(i, 1); continue; } }
    if (g.rest > 0.6) continue;                                            // улеглась
    g.vel.y -= 15 * dt;
    const nx = g.pos.x + g.vel.x * dt, nz = g.pos.z + g.vel.z * dt;
    if (!blocked(nx, g.pos.z, g.pos.y - g.r * 0.5, 0.12)) g.pos.x = nx; else g.vel.x *= -0.3;
    if (!blocked(g.pos.x, nz, g.pos.y - g.r * 0.5, 0.12)) g.pos.z = nz; else g.vel.z *= -0.3;
    g.pos.y += g.vel.y * dt;
    const fl = floorAt(g.pos.x, g.pos.z, g.pos.y + g.r), low = fl + g.r * 0.8;
    const sp = g.vel.length();
    if (g.pos.y < low) {
      g.pos.y = low;
      if (g.vel.y < -1.5) {                                                // удар о землю: отскок, брызги, пятно
        g.vel.y *= -0.32; g.vel.x *= 0.65; g.vel.z *= 0.65; g.av.multiplyScalar(0.55); g.bounces++;
        if (g.bounces <= 2) { bloodDecal(g.pos.x, g.pos.z, 0.28 + 0.1 * Math.random(), g.vel.x, g.vel.z); blood(g.pos.x, fl + 0.15, g.pos.z, g.vel.x * 0.1, g.vel.z * 0.1, 5); }
      } else {
        g.vel.y = 0; const f = Math.exp(-7 * dt); g.vel.x *= f; g.vel.z *= f; g.av.multiplyScalar(Math.exp(-6 * dt));
        if (Math.hypot(g.vel.x, g.vel.z) + g.av.length() * 0.1 < 0.5) g.rest += dt; else g.rest = 0;
      }
    } else if (sp > 2.5 && Math.random() < dt * 28) spawnP({ x: g.pos.x, y: g.pos.y, z: g.pos.z, vx: rnd(-0.4, 0.4), vy: rnd(-0.2, 0.5), vz: rnd(-0.4, 0.4), g: 14, s: rnd(0.04, 0.07), col: 0x8a1010, life: 0.6 });   // капает кровь
    const w = g.av.length(); if (w > 0.01) { _gdq.setFromAxisAngle(_gax.copy(g.av).normalize(), w * dt); g.q.premultiply(_gdq); }
  }
}
// вывод частей в те же InstancedMesh, что и у зомби (рисуется одна часть из шести, остальные схлопнуты)
function drawGibs() {
  for (const g of GIBS) {
    const M = g.M; if (M.n >= MAX_VZ) continue;
    const n = M.n++;
    _vm.compose(_v.set(g.pos.x, g.pos.y - g.sink, g.pos.z), g.q, _s.set(g.H * g.W, g.H, g.H * g.W)); _vm.multiply(_gtr.makeTranslation(-g.c.x, -g.c.y, -g.c.z));
    for (const k of VOX_PARTS) { M.mesh[k].setMatrixAt(n, k === g.k ? _vm : _gz); _c.setRGB(1, 1, 1); M.mesh[k].setColorAt(n, _c); }
    if (!VZ.fullShadow) { const B = M.box[g.k]; _vb.compose(B.c, _gq.identity(), B.s); _vb.premultiply(_vm); voxShadow.setMatrixAt(VZ.pn++, _vb); }
  }
}
function clearGibs() { GIBS.length = 0; }
Object.assign(SFX, {
  gib() { if (!soundOn() || !canPlay('gib', 60)) return; noiseHit({ dur: 0.3, type: 'lowpass', freq: 650, vol: 0.45, sweep: 200 }); thud(70, 0.5, 0, 0.12); noiseHit({ dur: 0.12, type: 'bandpass', freq: 1800, q: 1, vol: 0.12 }); },
});
