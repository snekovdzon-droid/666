'use strict';
/* ---------- 14. Обновление: игроки, зомби, небо, камера ---------- */
function moveEntity(e, dx, dz, r) {
  let moved = false;
  if (dx && !blocked(e.x + dx, e.z, e.y, r)) { e.x += dx; moved = true; }
  if (dz && !blocked(e.x, e.z + dz, e.y, r)) { e.z += dz; moved = true; }
  const fl = floorAt(e.x, e.z, e.y, r * 0.6);
  if (fl > e.y) { e.y = fl; e.vy = 0; }                          // шаг на ступеньку
  return moved;
}
function gravity(e, dt, r) {
  const fl = floorAt(e.x, e.z, e.y, r * 0.6);
  if (e.y > fl + 1e-3 || e.vy > 0) { e.vy -= 22 * dt; e.y = Math.max(fl, e.y + e.vy * dt); if (e.y <= fl) e.vy = 0; } else { e.y = fl; e.vy = 0; }
}
let shake = 0;
function updatePlayer(p, dt) {
  if (p.inv > 0) p.inv -= dt;
  if (p.down) { p.fall = Math.max(-Math.PI / 2, (p.fall || 0) - dt * 6); p.moving = false; gravity(p, dt, p.r); if (players.length > 1 && G.state === 'play') updateDownPistol(p, dt); return; }
  const c = readControl(p), B = WEAPONS[p.gun];
  if (c.hook) useHook(p);                                                // крюк-кошка
  if (updateHookAnim(p, dt)) { p.moving = true; p.yawT = p.yaw; return; }   // летим на тросе — остальное ждёт
  p.still = c.move < 0.1;
  p.stillT = p.still ? (p.stillT || 0) + dt : 0;         // для «Выцеливания»
  if (p.adrenT > 0) p.adrenT -= dt;
  if (p.slowT > 0) p.slowT -= dt;
  if (p.trapT > 0) p.trapT -= dt;                                       // попал в капкан
  const fireSlow = B.fireSlow && p.firing && !p.evo.mg_rpk ? (L(p, 'mg_strap') ? 0.85 : B.fireSlow) : 1;
  // пулемёт: база без рывка и ходьба −15%; «Облегчённая коробка» даёт рывок 70% и убирает замедление; «РПК» — полный рывок
  const box = L(p, 'mg_box') > 0 || !!p.evo.mg_rpk, noSprint = B.noSprint && !box;
  const walk = (B.walk && !box ? B.walk : 1) * (L(p, 'mg_stance') ? 0.85 : 1);
  const sprintMul = B.noSprint && !p.evo.mg_rpk ? 1 + (CFG.SPRINT_MUL - 1) * 0.7 : CFG.SPRINT_MUL;
  updateShield(p, dt);
  // бег и выносливость: ~3 с бега, восстановление через 1 с, полностью за ~4 с; выдохся — ждём 30%
  p.sprinting = c.sprint && !noSprint && !p.still && !p.stamLock && p.stam > 0;
  if (p.sprinting) {
    p.stam -= dt / (CFG.STAM_TIME * p.st.stam); p.stamRegenT = CFG.STAM_DELAY;
    if (p.stam <= 0) { p.stam = 0; p.stamLock = true; p.sprinting = false; }
  } else if ((p.stamRegenT -= dt) <= 0) {
    p.stam = Math.min(1, p.stam + dt * p.st.stamRegen / (CFG.STAM_REGEN * Math.sqrt(p.st.stam)));
    if (p.stamLock && p.stam >= CFG.STAM_LOCK) p.stamLock = false;
  }
  if (p.stamLock && (p.breathT -= dt) <= 0) { p.breathT = 0.85; SFX.breath(); }
  const sp = CFG.PLAYER_SPEED * p.st.speed * walk * fireSlow * (p.slowT > 0 ? 0.5 : 1) * (p.trapT > 0 ? 0 : 1) * (p.sprinting ? sprintMul * (1 + [0, 0.1, 0.15, 0.2][L(p, 'so_light')]) : 1) * (p.adrenT > 0 ? 1.25 : 1) * c.move;
  const l = Math.hypot(c.wx, c.wz) || 1, wx = c.wx / l, wz = c.wz / l;
  moveEntity(p, (p.still ? 0 : wx * sp) * dt + p.kx * dt, (p.still ? 0 : wz * sp) * dt + p.kz * dt, p.r);
  const kd = Math.exp(-7 * dt); p.kx *= kd; p.kz *= kd;
  if (!p.still) { p.mvx = wx; p.mvz = wz; }
  p.moving = !p.still;
  if (p.moving) p.phase += dt * 11 * (p.sprinting ? 1.3 : 1) * Math.max(0.5, c.move);
  gravity(p, dt, p.r);
  if (p.moving && (p.stepT = (p.stepT || 0) - dt) <= 0) {             // пыль из-под ног
    p.stepT = p.sprinting ? 0.15 : 0.26;
    if (p.y < 0.05) spawnP({ x: p.x - wx * 0.15, y: 0.06, z: p.z - wz * 0.15, vx: -wx * 0.3, vy: 0.4, vz: -wz * 0.3, s: 0.08, s1: p.sprinting ? 0.34 : 0.22, col: 0xa08466, col1: 0x8a7a68, life: p.sprinting ? 0.6 : 0.45, drag: 0.9 });
  }
  updatePlayerWeapon(p, c, dt);
  updateRam(p, dt);
  p.kick *= Math.exp(-14 * dt);
  p.reloadK = p.reloadT > 0 ? 1 - p.reloadT / p.reloadMax : 0;
}
let BURN_K = 1;                                            // искры горящих: при толпе горящих — реже у каждого
function updateZombies(dt) {
  { let nb = 0; for (const z of zombies) if (!z.dead && z.burnT > 0) nb++; BURN_K = Math.min(1, 15 / Math.max(1, nb)); }
  G.navT -= dt;
  if (G.navT <= 0) { G.navT = 0.3; navField(alivePlayers()); }
  const decay = Math.exp(-9 * dt);
  let corpses = 0;
  for (let i = zombies.length - 1; i >= 0; i--) {
    const z = zombies[i];
    if (!z.dead) continue;
    if (z.swell) { if (z.boomed) zombies.splice(i, 1); continue; }
    z.deadT += dt; corpses++; if (z.flash > 0) z.flash -= dt;
    z.fall = z.form === 'crawl' ? 0 : z.flip * Math.min(Math.PI / 2, z.deadT * 7);   // падает на спину (иногда ничком)
    if (z.form === 'crawl') z.roll = Math.min(0.5, z.deadT * 3);
    if (z.cvx || z.cvz) { moveEntity(z, z.cvx * dt, z.cvz * dt, 0.2); const f = z.y <= floorAt(z.x, z.z, z.y) + 0.01 ? Math.exp(-6 * dt) : 1; z.cvx *= f; z.cvz *= f; if (Math.abs(z.cvx) + Math.abs(z.cvz) < 0.02) z.cvx = z.cvz = 0; }
    gravity(z, dt, 0.2);
    if (corpses > CORPSE_MAX) z.sinkT = (z.sinkT || 0) + dt;              // старые трупы уходят в землю
    if (z.sinkT) { z.sink = z.sinkT * 0.35; if (z.sink > 0.5) zombies.splice(i, 1); }
  }
  for (const z of zombies) {
    if (z.dead) continue;
    let target = nearestAlive(z.x, z.z);
    if (target && SMOKES.length && inSmoke(target) && Math.hypot(target.x - z.x, target.z - z.z) > 1.5) { target = null; z.confT = Math.max(z.confT || 0, 0.3); }   // в дыму игрока не видно издалека
    const bt = TURRETS.length ? baitTurret(z, target) : null; if (bt) target = bt;       // «Приманка»: турель ближе игрока
    let dx = 0, dz = 0, dist = 99;
    if (target) {
      let gx = target.x, gz = target.z;
      dist = Math.hypot(target.x - z.x, target.z - z.z);
      if (!(dist < 2.5 && Math.abs(target.y - z.y) < 0.5)) { const nd = navDir(z); if (nd) { gx = nd[0]; gz = nd[1]; } }   // перепад высот или далеко — по полю пути
      dx = gx - z.x; dz = gz - z.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    }
    if (z.slideT > 0) {                                                  // уткнулся — обходит боком
      z.slideT -= dt; const sx = -dz * z.side, sz = dx * z.side;
      dx = dx * 0.35 + sx; dz = dz * 0.35 + sz; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    }
    if (z.panicT > 0) { z.panicT -= dt; const ex = z.panicX - z.x, ez = z.panicZ - z.z, el = Math.hypot(ex, ez) || 1; dx = ex / el; dz = ez / el; target = target || z; }   // «Паника»: бежит в толпу
    if (z.confT > 0) {                                                   // дым: бродит без цели
      z.confT -= dt; z.wanderT = (z.wanderT || 0) - dt; if (z.wanderT <= 0) { z.wanderT = rnd(0.6, 1.4); z.wanderA = Math.random() * TAU; }
      dx = Math.sin(z.wanderA) * 0.5; dz = Math.cos(z.wanderA) * 0.5;
    }
    if (z.slowT > 0) z.slowT -= dt; else z.slowMul = 1;
    if (z.stunT > 0) z.stunT -= dt;
    if (z.supT > 0) z.supT -= dt;                                        // «Прижать огнём»
    if (z.markT > 0) { z.markT -= dt; if (Math.random() < dt * 6) spawnP({ x: z.x, y: z.y + zHeight(z) + 0.1, z: z.z, vy: 0.3, s: 0.07, s1: 0.02, col: 0xff3a2a, glow: true, life: 0.3 }); }   // метка трассера
    const ox = z.x, oz = z.z;
    const step = (!target && !(z.confT > 0)) || z.stunT > 0 || z.trapT > 0 ? 0 : z.speed * (z.slowT > 0 ? z.slowMul : 1) * (z.burnT > 0 && z.burnSlow ? 0.8 : 1) * (z.supT > 0 ? 1 - z.supK : 1) * (z.panicT > 0 ? 1.8 : 1) * dt;
    const wx0 = dx * step + z.kx * dt, wz0 = dz * step + z.kz * dt;
    moveEntity(z, wx0, wz0, z.r);
    if (z.wallT > 0) { z.wallT -= dt; const want = Math.hypot(wx0, wz0); if (want > 0.03 && Math.hypot(z.x - ox, z.z - oz) < want * 0.4) { z.wallT = 0; damageZombie(z, z.wallDmg, 0, 0, 0); dust(z.x, z.y + 0.6, z.z, 0xb0a690, 6); } }   // «В стену»
    z.kx *= decay; z.kz *= decay;
    let sx = 0, sz = 0;                                                  // расталкиваются с соседями на той же высоте
    forNear(z.x, z.z, n => {
      if (n === z || n.dead || Math.abs(n.y - z.y) > 0.6) return;
      const ex = z.x - n.x, ez = z.z - n.z, rr = (z.r + n.r) * 0.9, d2 = ex * ex + ez * ez;
      if (d2 < rr * rr && d2 > 1e-6) { const d = Math.sqrt(d2), k = (rr - d) / d * 0.5; sx += ex * k; sz += ez * k; }
    });
    if (sx || sz) moveEntity(z, clamp(sx, -0.1, 0.1), clamp(sz, -0.1, 0.1), z.r);
    gravity(z, dt, z.r);
    const moved = Math.hypot(z.x - ox, z.z - oz);
    if (step > 0 && z.slideT <= 0 && moved < step * 0.4 && dist > 0.8) { z.slideT = 0.7; z.side = Math.random() < 0.5 ? 1 : -1; }
    if (z.flash > 0) z.flash -= dt;
    if (z.atkT > 0) z.atkT -= dt;
    if (z.hurtT > 0) z.hurtT -= dt;
    z.moving = moved > 1e-4;
    z.phase += moved * (z.form === 'run' ? 5 : 6.5);
    z.nod = Math.sin(z.phase * 0.5) * 0.12;
    if (dx || dz) { let a = Math.atan2(dx, dz) - z.yaw; a = Math.atan2(Math.sin(a), Math.cos(a)); z.yaw += a * Math.min(1, dt * 8); }
    // горение и кровотечение (перки и снаряжение подключатся на этапах 4–5)
    if (z.burnT > 0) { z.burnT -= dt; if (Math.random() < dt * 14 * BURN_K) spawnP({ x: z.x + rnd(-0.15, 0.15), y: z.y + rnd(0.4, 1.2), z: z.z + rnd(-0.15, 0.15), vy: 1.5, s: rnd(0.07, 0.13), s1: 0.02, col: 0xffc040, col1: 0xd03010, glow: true, life: 0.45 }); }
    if (z.bleedT > 0) z.bleedT -= dt;
    if ((z.dotT -= dt) <= 0) { z.dotT = 0.25; const d = (z.burnT > 0 ? z.burnDps : 0) + (z.bleedT > 0 ? z.bleedDps : 0); if (d > 0) damageZombie(z, d * 0.25, 0, 0, 0); if (z.burnT > 0) burnSpread(z); }
    if (z.dead) continue;
    for (const p of players) {                                           // укус
      if (p.down || Math.abs(p.y - z.y) > 0.6) continue;
      const cx = p.x - z.x, cz = p.z - z.z, rr = p.r + z.r, d2 = cx * cx + cz * cz;
      if (d2 < (rr + 0.35) ** 2 && !(z.atkT > 0)) z.atkT = 0.45;
      if (d2 < rr * rr) { const d = Math.sqrt(d2) || 0.001, k = (rr - d) / d; moveEntity(z, -cx * k, -cz * k, z.r); if (p.inv <= 0 && G.state === 'play') hurtPlayer(p, z); }
    }
    if (bt && dist < z.r + 0.45) { bt.hp -= 12 * dt; if (!(z.atkT > 0)) z.atkT = 0.45; }   // грызут турель
    if (target && !bt && dist > spawnDist + 10) relocate(z);
  }
}
const CORPSE_MAX = IS_TOUCH ? 30 : 60;
function updateFires(dt, T) {
  const near = CAM.zoom * 2 + 5, cx = CAM.x, cz = CAM.z;
  for (const f of fires) f.d = Math.hypot(f.x - cx, f.z - cz);
  const lit = fires.filter(f => f.d < near + 6).sort((a, b) => a.d - b.d);
  FIRE_LIGHTS.forEach((l, i) => { const f = lit[i]; if (!f) { l.intensity = 0; return; }
    const fl = 0.8 + 0.2 * Math.sin(T * 13 + f.seed) * Math.sin(T * 7.3 + f.seed * 2);
    l.position.set(f.x, f.y + 0.6, f.z); l.distance = 9 * f.s; l.intensity = (1.4 + G.night * 2.2) * fl * f.s; });
  for (const f of fires) {
    if (f.d > near) { f.acc = 0; continue; }                     // огонь далеко за экраном — не дымит
    f.acc += dt * 34 * f.s;
    while (f.acc > 1) {
      f.acc--;
      const r = f.R || 0.2 * f.s;                            // лужа молотова — по всему кругу
      spawnP({ x: f.x + rnd(-r, r), y: f.y, z: f.z + rnd(-r, r), vx: rnd(-0.25, 0.25), vy: rnd(1.0, 2.0), vz: rnd(-0.25, 0.25), s: rnd(0.16, 0.26) * f.s, s1: 0.03, col: 0xffd060, col1: 0xd02808, glow: true, life: rnd(0.4, 0.7), drag: 0.97, ry: rnd(0, 1.5) });
      if (Math.random() < 0.3) spawnP({ x: f.x + rnd(-r, r), y: f.y + 0.6 * f.s, z: f.z + rnd(-r, r), vx: 0.35 + rnd(-0.1, 0.1), vy: rnd(0.9, 1.4), vz: -0.2, s: 0.18 * f.s, s1: 0.7 * f.s, col: 0x2e2a28, col1: 0x6a6660, life: rnd(3, 4.5), drag: 0.995 });
      if (Math.random() < 0.08) spawnP({ x: f.x, y: f.y + 0.3, z: f.z, vx: rnd(-0.6, 0.6), vy: rnd(2, 3.5), vz: rnd(-0.6, 0.6), s: 0.03, col: 0xffb040, glow: true, life: 1.2, drag: 0.99 });
    }
  }
}
// Смена времени: закат → ночь (N — сразу)
function updateSky(dt) {
  const target = Math.max(G.nightT, clamp((G.t - 60) / (RUN_TIME * 0.8), 0, 1));   // закат → ночь к 17-й минуте
  G.night += (target - G.night) * Math.min(1, dt * 1.5);
  const n = G.night;
  sun.intensity = 1.15 * (1 - n) + 0.1 * n;
  sun.color.setRGB(1, 0.8 - n * 0.2, 0.58 + n * 0.3);
  hemi.intensity = 0.5 - n * 0.34; hemi.color.setRGB(1 - n * 0.55, 0.88 - n * 0.45, 0.75 - n * 0.2);
  scene.background.setRGB(0.13 - n * 0.09, 0.1 - n * 0.06, 0.09 - n * 0.03); scene.fog.color.copy(scene.background);
  for (const m of winMats) m.emissiveIntensity = 0.25 + n * 1.1;
  for (const L of lamps) { L.bulb.material.color.setRGB(0.4 + n * 0.6, 0.39 + n * 0.55, 0.3 + n * 0.45); L.d = Math.hypot(L.x - CAM.x, L.z - CAM.z); }
  const ls = lamps.slice().sort((a, b) => a.d - b.d);
  LAMP_LIGHTS.forEach((sp, i) => { const L = ls[i]; sp.intensity = L && n > 0.01 ? n * 2.4 : 0; if (L) { sp.position.set(L.x + 0.6, 3.95, L.z); sp.target.position.set(L.x + 1.2, 0, L.z); sp.target.updateMatrixWorld(); } });
}
// Здание между камерой и героем — полупрозрачное
const camDir = new THREE.Vector3();
function updateFade() {
  const to = cam.position;
  for (const B of buildings) {
    const bb = new THREE.Box3(new THREE.Vector3(B.x1, 0, B.z1), new THREE.Vector3(B.x2, B.H + 0.5, B.z2));
    let hit = false;
    for (const p of players) {                           // здание закрывает хоть одного игрока — полупрозрачное
      const from = new THREE.Vector3(p.x, p.y + 0.6, p.z); camDir.copy(to).sub(from).normalize();
      if (new THREE.Ray(from, camDir).intersectsBox(bb) && !(p.y >= B.H - 0.1 && p.x > B.x1 && p.x < B.x2 && p.z > B.z1 && p.z < B.z2)) { hit = true; break; }
    }
    const target = hit ? 0.28 : 1;
    for (const m of B.mats) { m.transparent = true; m.opacity += (target - m.opacity) * 0.2; m.depthWrite = m.opacity > 0.95; }
  }
}
/* ---- Кооп: общая камера отдаляется, «поводок» не даёт разойтись за край экрана, упавшего поднимают ---- */
const CAM_MAX = 12;                                      // дальше этого камера не отдаляется — дальше держит поводок
function camTargets() { return players; }               // и упавших держим в кадре — чтобы напарник мог поднять
function camCenter() { const f = camTargets(); let x = 0, z = 0, y = 0; for (const p of f) { x += p.x; z += p.z; y += p.y; } return { x: x / f.length, z: z / f.length, y: y / f.length }; }
// экранные оси на земле: вправо (cos, −sin), в глубину (sin, cos)
function scrOff(dx, dz) { const c = Math.cos(CAM.yaw), s = Math.sin(CAM.yaw); return [dx * c - dz * s, dx * s + dz * c]; }
function tether() {
  if (players.length < 2) return;
  const C = camCenter(), a = innerWidth / innerHeight, sp = Math.sin(CAM.pitch);
  const LX = CAM_MAX * a - 2.6, LD = (CAM_MAX - 2.4) / sp, c = Math.cos(CAM.yaw), s = Math.sin(CAM.yaw);
  for (const p of players) {
    if (p.down) continue;
    const [ox, od] = scrOff(p.x - C.x, p.z - C.z), nx = clamp(ox, -LX, LX), nd = clamp(od, -LD, LD);
    if (nx === ox && nd === od) continue;
    const tx = C.x + nx * c + nd * s, tz = C.z - nx * s + nd * c;
    moveEntity(p, tx - p.x, tz - p.z, p.r);
  }
}
function updateRevive(dt) {
  for (const p of players) {
    if (!p.down) { p.reviveT = 0; continue; }
    const helper = players.find(q => !q.down && Math.abs(q.y - p.y) < 0.8 && Math.hypot(q.x - p.x, q.z - p.z) < CFG.REVIVE_R);
    if (helper) {
      p.reviveT += dt * (L(helper, 'medic') ? 2 : 1);
      if (p.reviveT >= CFG.REVIVE_TIME) {
        p.down = false; p.reviveT = 0; p.fall = 0; p.hp = Math.max(2, Math.ceil(p.maxHp / 2)); p.inv = 2; p.ammo = wStat(p).mag;
        for (let i = 0; i < 16; i++) spawnP({ x: p.x, y: p.y + 0.5, z: p.z, vx: rnd(-1.5, 1.5), vy: rnd(1, 3), vz: rnd(-1.5, 1.5), s: 0.07, s1: 0.01, col: 0x9ff0a0, glow: true, life: 0.7, drag: 0.95 });
        SFX.level();
      }
    } else p.reviveT = Math.max(0, p.reviveT - dt * 0.5);
  }
}
function updateCamera(dt) {
  CAM.yaw += (CAM.yawT - CAM.yaw) * Math.min(1, dt * 8);
  const MAIN = G.state === 'main', C = MAIN ? { x: MM.cam.x, z: MM.cam.z, y: 0 } : players.length ? camCenter() : { x: CAM.x, z: CAM.z, y: 0 };
  let need = 0;                                          // кооп: насколько отдалить, чтобы все были на экране
  if (players.length > 1) { const a = innerWidth / innerHeight, sp = Math.sin(CAM.pitch);
    for (const p of players) { const [ox, od] = scrOff(p.x - C.x, p.z - C.z); need = Math.max(need, (Math.abs(ox) + 2.6) / a, Math.abs(od) * sp + 2.4); } }
  const zt = MAIN ? MM.zoom : Math.max(CAM.zoomT, Math.min(CAM_MAX, need));
  CAM.zoom += (zt - CAM.zoom) * Math.min(1, dt * 4);
  CAM.x += (C.x - CAM.x) * Math.min(1, dt * 6); CAM.z += (C.z - CAM.z) * Math.min(1, dt * 6); CAM.y = (CAM.y || 0) + (C.y * 0.5 - (CAM.y || 0)) * Math.min(1, dt * 6);
  const D = 40, cp = Math.cos(CAM.pitch), sp = Math.sin(CAM.pitch);
  let sx = CAM.kx, sz = CAM.kz; if (shake > 0) { shake -= dt; sx += rnd(-1, 1) * shake * 0.6; sz += rnd(-1, 1) * shake * 0.6; }
  const kd = Math.exp(-16 * dt); CAM.kx *= kd; CAM.kz *= kd;
  cam.position.set(CAM.x + Math.sin(CAM.yaw) * cp * D + sx, CAM.y + sp * D, CAM.z + Math.cos(CAM.yaw) * cp * D + sz);
  cam.lookAt(CAM.x + sx, CAM.y, CAM.z + sz);
  const a = innerWidth / innerHeight, h = CAM.zoom; const sh = MAIN && a > 1.1 ? h * a * 0.34 : 0;   // главное меню: сцена смещена вправо, слева — кнопки
  cam.left = -h * a - sh; cam.right = h * a - sh; cam.top = h; cam.bottom = -h; cam.updateProjectionMatrix();
  cam.updateMatrixWorld();
  sun.position.set(CAM.x - 14, 26, CAM.z - 10); sun.target.position.set(CAM.x, 0, CAM.z);
  if (muzzleT > 0) { muzzleT -= dt; if (muzzleT <= 0) muzzleLight.intensity = 0; }
  updateBoomLight(dt);
  spawnDist = Math.hypot(CAM.zoom * innerWidth / innerHeight, CAM.zoom * 1.6) + 1.5;
}

// «Тяжёлая стойка» (пулемёт, Позиция): простоял 1 с — серое сердце-щит; после укуса снова — за 8 с стояния; пошёл — щит опущен
function updateShield(p, dt) {
  if (!L(p, 'mg_stance')) { p.shield = false; return; }
  if (!p.still) { p.shield = false; p.shieldT = 0; return; }
  p.shieldT += dt;
  if (!p.shield && p.shieldT >= p.shieldCd) { p.shield = true; p.shieldCd = 1; SFX.click(); }
}

