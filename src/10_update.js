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
const FALL_V = 9.5;                                    // скорость приземления, с которой больно (~2 м падения: с крыши этажа и выше)
function fallHurt(p) {
  dust(p.x, p.y + 0.1, p.z, 0xb0a690, 8); SFX.thump(); shake = Math.max(shake, 0.2); rumble(p, 0.6, 140);
  if (p.inv <= 0) { hurtPlayer(p); p.inv = Math.max(p.inv, 0.6); }
}
function gravity(e, dt, r) {
  const fl = floorAt(e.x, e.z, e.y, r * 0.6);
  if (e.y > fl + 1e-3 || e.vy > 0) { e.vy -= 22 * dt; e.y = Math.max(fl, e.y + e.vy * dt); if (e.y <= fl) { if (e.vy < -FALL_V && e.idx !== undefined && !e.down && G.state === 'play') fallHurt(e); e.vy = 0; } } else { e.y = fl; e.vy = 0; }
}
let shake = 0;
function unstickPlayer(p, dt) {                                       // v0.60: застрял в геометрии (упал с крыши у лестницы и т. п.) — выталкиваем
  if (p.down || p.climb || p.ladder) { p.stuckT = 0; return; }
  if (!blocked(p.x, p.z, p.y, 0.28)) { p.stuckT = 0; return; }
  p.stuckT = (p.stuckT || 0) + dt; if (p.stuckT < 0.25) return;
  for (let r = 0.3; r <= 6; r += 0.3) for (let k = 0; k < 16; k++) {
    const a = k / 16 * Math.PI * 2, x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r; if (x < 0.6 || z < 0.6 || x > MAP - 0.6 || z > MAP - 0.6) continue;
    const y = floorAt(x, z, p.y + 0.4); if (!blocked(x, z, y, 0.3)) { p.x = x; p.z = z; p.y = y; p.vy = 0; p.stuckT = 0; return; }
  }
}
function updatePlayer(p, dt) {
  unstickPlayer(p, dt);
  if (p.inv > 0) p.inv -= dt;
  animPlayer(p, dt);                                                     // скорость, ноги, приземление для анимации
  if (p.down) { p.fall = Math.max(-Math.PI / 2, (p.fall || 0) - dt * 6); p.moving = false; gravity(p, dt, p.r); if (players.length > 1 && G.state === 'play') updateDownPistol(p, dt); return; }
  const c = readControl(p), B = WEAPONS[p.gun];
  if (updateClimb(p, c, dt)) return;                                     // лестница: лезем, остальное ждёт
  updateMelee(p, c, dt);
  if (c.hook) useHook(p);                                                // крюк-кошка
  if (updateHookAnim(p, dt)) { p.moving = true; p.yawT = p.yaw; return; }   // летим на тросе — остальное ждёт
  p.still = c.move < 0.1;
  p.stillT = p.still ? (p.stillT || 0) + dt : 0;         // для «Выцеливания»
  if (p.adrenT > 0) p.adrenT -= dt;
  if (p.slowT > 0) p.slowT -= dt;
  if (p.slowAcid > 0) p.slowAcid -= dt;
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
  const sp = CFG.PLAYER_SPEED * p.st.speed * walk * fireSlow * (p.slowT > 0 ? 0.5 : 1) * (p.slowAcid > 0 ? 0.78 : 1) * (p.trapT > 0 ? 0 : 1) * (p.sprinting ? sprintMul * (1 + [0, 0.1, 0.15, 0.2][L(p, 'so_light')]) : 1) * (p.adrenT > 0 ? 1.25 : 1) * c.move;
  const l = Math.hypot(c.wx, c.wz) || 1, wx = c.wx / l, wz = c.wz / l;
  moveEntity(p, (p.still ? 0 : wx * sp) * dt + p.kx * dt, (p.still ? 0 : wz * sp) * dt + p.kz * dt, p.r);
  const kd = Math.exp(-7 * dt); p.kx *= kd; p.kz *= kd;
  if (!p.still) { p.mvx = wx; p.mvz = wz; }
  p.moving = !p.still;
  if (p.moving) p.phase += dt * 11 * (p.sprinting ? 1.3 : 1) * Math.max(0.5, c.move);
  gravity(p, dt, p.r);
  if (p.moving && (p.stepT = (p.stepT || 0) - dt) <= 0) {             // пыль из-под ног
    p.stepT = p.sprinting ? 0.15 : 0.26;
    { const soft = MAPID === 'cemetery' && p.y < 0.05 && ['grass', 'dirt'].includes(zoneTypeAt(MAPDEF.zones, p.x, p.z));   // v0.61: шаги (на траве и земле — глуше)
      if (G.t - (p.sndT || -9) >= (p.sprinting ? 0.3 : 0.42)) { p.sndT = G.t; fxPlay('fx_step', p.x, p.z, (soft ? 0.08 : 0.13) * (p.sprinting ? 0.9 : 1), soft ? 0.82 : 1, { near: 5, hear: 14, vary: 0.1 }); } }   // v0.64: свой темп звука шагов — ходьба реже, бег чаще
    if (p.y < 0.05) spawnP({ x: p.x - wx * 0.15, y: 0.06, z: p.z - wz * 0.15, vx: -wx * 0.3, vy: 0.4, vz: -wz * 0.3, s: 0.08, s1: p.sprinting ? 0.34 : 0.22, col: 0xa08466, col1: 0x8a7a68, life: p.sprinting ? 0.6 : 0.45, drag: 0.9, soft: true });   // пыль из-под ног — тоже полупрозрачная
  }
  updatePlayerWeapon(p, c, dt);
  updateRam(p, dt);
  p.kick *= Math.exp(-14 * dt);
  p.reloadK = p.reloadT > 0 ? 1 - p.reloadT / p.reloadMax : 0;
}
let BURN_K = 1;                                            // искры горящих: при толпе горящих — реже у каждого
const ZCLIMB_UP = 0.85, ZCLIMB_DOWN = 1.4;                    // скорость по лестнице, м/с: игрок лезет 3,4 — зомби втрое-вчетверо медленнее
const canClimbZ = z => { const T = ZOMBIES[z.type]; return !(T.boss || T.fat || z.type === 'hound' || z.form === 'crawl'); };
function zLadderStart(z) {
  if (!canClimbZ(z)) return;
  for (const L of LADS) {
    if (!L.A || !L.B) continue;
    const atBase = z.y < 0.3 && Math.hypot(z.x - L.bx, z.z - L.bz) < 0.6, atTop = Math.abs(z.y - L.H) < 0.2 && Math.hypot(z.x - L.lx, z.z - L.lz) < 0.6;
    if (atBase && L.B.d < 1e9 && L.B.d + LAD_COST <= L.A.d + 0.01) { z.climb = { L, dir: 1 }; return; }
    if (atTop && L.A.d < 1e9 && L.A.d + LAD_COST <= L.B.d + 0.01) { z.climb = { L, dir: -1 }; return; }
  }
}
// прямая линия без стен (для рывка к игроку вплотную)
function clearLine(x0, z0, x1, z1, y) {
  const d = Math.hypot(x1 - x0, z1 - z0), n = Math.ceil(d / 0.4);
  for (let i = 1; i < n; i++) { const t = i / n; if (blocked(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, y, 0.22)) return false; }
  return true;
}
function updateZombies(dt) {
  { let nb = 0; for (const z of zombies) if (!z.dead && z.burnT > 0) nb++; BURN_K = Math.min(1, 15 / Math.max(1, nb)); }
  G.navT -= dt;
  if (G.navT <= 0) { G.navT = 0.3; navField(alivePlayers()); }
  const decay = Math.exp(-9 * dt);
  let corpses = 0;
  for (let i = zombies.length - 1; i >= 0; i--) {
    const z = zombies[i];
    if (!z.dead) continue;
    z.climb = null;
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
    let lure = null;
    if (SMOKES.length && !(target && Math.hypot(target.x - z.x, target.z - z.z) < 1.8 && Math.abs(target.y - z.y) < 1)) for (const s of SMOKES) {   // v0.52: дым — приманка
      if (s.t < 0.3 || s.t > s.dur - 0.5) continue; const d = Math.hypot(s.x - z.x, s.z - z.z); if (d > s.lure || Math.abs(s.y - z.y) > 2.5) continue;
      if (d < s.R * 0.75) { z.confT = Math.max(z.confT || 0, 0.25); target = null; } else { lure = s; target = null; }   // в облаке — топчутся, вокруг — идут к нему
      break;
    }
    let dx = 0, dz = 0, dist = 99;
    if (target) {
      let gx = target.x, gz = target.z;
      dist = Math.hypot(target.x - z.x, target.z - z.z);
      if (!(dist < 2.5 && Math.abs(target.y - z.y) < 0.5 && clearLine(z.x, z.z, target.x, target.z, z.y))) { const nd = navDir(z); if (nd) { gx = nd[0]; gz = nd[1]; } }   // перепад высот, далеко или за стеной — по полю пути
      dx = gx - z.x; dz = gz - z.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    }
    if (z.flank && target && !lure && dist > 6 && Math.abs(target.y - z.y) < 1) {        // обходчик: заходит сбоку или со спины, вблизи — обычная атака
      const ax = z.x - target.x, az = z.z - target.z, al2 = Math.hypot(ax, az) || 1, c = Math.cos(z.flank), s = Math.sin(z.flank), R2 = Math.min(dist * 0.75, 10);
      const fx = target.x + (ax * c - az * s) / al2 * R2, fz = target.z + (ax * s + az * c) / al2 * R2;
      if (fx > 1 && fz > 1 && fx < MAP - 1 && fz < MAP - 1 && clearLine(z.x, z.z, fx, fz, z.y)) { const ex = fx - z.x, ez = fz - z.z, el = Math.hypot(ex, ez) || 1; dx = dx * 0.25 + ex / el * 0.75; dz = dz * 0.25 + ez / el * 0.75; const l2 = Math.hypot(dx, dz) || 1; dx /= l2; dz /= l2; }
    }
    if (lure) { dx = lure.x - z.x; dz = lure.z - z.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l; dist = 99; target = z; }
    if (z.slideT > 0) {                                                  // уткнулся — обходит боком
      z.slideT -= dt; const sx = -dz * z.side, sz = dx * z.side;
      dx = dx * 0.35 + sx; dz = dz * 0.35 + sz; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    }
    if (z.panicT > 0) { z.panicT -= dt; const ex = z.panicX - z.x, ez = z.panicZ - z.z, el = Math.hypot(ex, ez) || 1; dx = ex / el; dz = ez / el; target = target || z; }   // «Паника»: бежит в толпу
    if (z.confT > 0) {                                                   // дым: бродит без цели
      z.confT -= dt; z.wanderT = (z.wanderT || 0) - dt; if (z.wanderT <= 0) { z.wanderT = rnd(0.6, 1.4); z.wanderA = Math.random() * TAU; }
      dx = Math.sin(z.wanderA) * 0.5; dz = Math.cos(z.wanderA) * 0.5;
    }
    let mobMul = 1;
    if (MOB_AI[z.type]) { const r = MOB_AI[z.type](z, dt, target, dist, dx, dz); if (r) { dx = r[0]; dz = r[1]; mobMul = r[2]; } }   // особые мобы: свои повадки
    if (z.rageT > 0) z.rageT -= dt;                                      // крик: ускорение
    if (z.slowT > 0) z.slowT -= dt; else z.slowMul = 1;
    if (z.stunT > 0) { z.stunT -= dt; if (Math.random() < dt * 4) spawnP({ x: z.x + rnd(-0.2, 0.2), y: z.y + zHeight(z) + 0.15, z: z.z + rnd(-0.2, 0.2), vy: 0.15, s: 0.06, s1: 0.02, col: 0xfff2a0, glow: true, life: 0.5 }); }   // v0.52: «звёздочки» у оглушённых
    if (z.supT > 0) z.supT -= dt;                                        // «Прижать огнём»
    if (z.markT > 0) { z.markT -= dt; if (Math.random() < dt * 6) spawnP({ x: z.x, y: z.y + zHeight(z) + 0.1, z: z.z, vy: 0.3, s: 0.07, s1: 0.02, col: 0xff3a2a, glow: true, life: 0.3 }); }   // метка трассера
    if (!z.climb && LADS.length) zLadderStart(z);                        // зомби лезут по лестницам, если иначе не добраться (медленно)
    let ox = z.x, oz = z.z, step = 0, moved = 0;
    if (z.climb) {
      const C = z.climb, L = C.L; let v = C.dir > 0 ? ZCLIMB_UP : ZCLIMB_DOWN;
      if (z.stunT > 0 || z.trapT > 0) v = 0; else if (z.slowT > 0) v *= z.slowMul;
      z.y += C.dir * v * dt; z.x = L.x + L.nx * 0.4; z.z = L.z + L.nz * 0.4; z.vy = 0; dx = -L.nx; dz = -L.nz; moved = v * dt * 0.6;
      if (z.stunT > 0) z.stunT -= dt;
      if (z.y >= L.H && C.dir > 0) { z.x = L.lx; z.z = L.lz; z.y = L.H; z.climb = null; }
      else if (z.y <= 0 && C.dir < 0) { z.x = L.bx; z.z = L.bz; z.y = 0; z.climb = null; }
    } else {
    step = (!target && !(z.confT > 0)) || z.stunT > 0 || z.trapT > 0 ? 0 : z.speed * (z.slowT > 0 ? z.slowMul : 1) * (z.burnT > 0 && z.burnSlow ? 0.8 : 1) * (z.supT > 0 ? 1 - z.supK : 1) * (z.panicT > 0 ? 1.8 : 1) * (z.rageT > 0 ? 1.5 : 1) * mobMul * dt;
    const kv = Math.hypot(z.kx, z.kz); if (kv > 60) { z.kx *= 60 / kv; z.kz *= 60 / kv; }                 // потолок отталкивания (иначе на ×4 вылетали бы за стены)
    const wx0 = dx * step + z.kx * dt, wz0 = dz * step + z.kz * dt, nsub = Math.max(1, Math.ceil(Math.hypot(wx0, wz0) / 0.3));
    for (let q = 0; q < nsub; q++) moveEntity(z, wx0 / nsub, wz0 / nsub, z.r);
    if (z.wallT > 0) { z.wallT -= dt; const want = Math.hypot(wx0, wz0); if (want > 0.03 && Math.hypot(z.x - ox, z.z - oz) < want * 0.4) { z.wallT = 0; dzBy(z.wallOwner, z, z.wallDmg, 0, 0, 0); dust(z.x, z.y + 0.6, z.z, 0xb0a690, 6); } }   // «В стену»
    z.kx *= decay; z.kz *= decay;
    if (z.domT > 0) dominoStep(z, dt);                                    // «Домино» обреза
    let sx = 0, sz = 0;                                                  // расталкиваются с соседями на той же высоте
    forNear(z.x, z.z, n => {
      if (n === z || n.dead || Math.abs(n.y - z.y) > 0.6) return;
      const ex = z.x - n.x, ez = z.z - n.z, rr = (z.r + n.r) * 0.9, d2 = ex * ex + ez * ez;
      if (d2 < rr * rr && d2 > 1e-6) { const d = Math.sqrt(d2), k = (rr - d) / d * 0.5; sx += ex * k; sz += ez * k; }
    });
    if (sx || sz) moveEntity(z, clamp(sx, -0.1, 0.1), clamp(sz, -0.1, 0.1), z.r);
    gravity(z, dt, z.r);
    moved = Math.hypot(z.x - ox, z.z - oz);
    }
    if (step > 0 && z.slideT <= 0 && moved < step * 0.4 && dist > 0.8) { z.slideT = 0.7; z.side = Math.random() < 0.5 ? 1 : -1; }
    if (z.flash > 0) z.flash -= dt;
    if (z.atkT > 0) z.atkT -= dt;
    if (z.hurtT > 0) z.hurtT -= dt;
    z.moving = moved > 1e-4;
    z.phase += moved * (z.form === 'run' ? 5 : 6.5);
    z.nod = Math.sin(z.phase * 0.5) * 0.12;
    if (dx || dz) { let a = Math.atan2(dx, dz) - z.yaw; a = Math.atan2(Math.sin(a), Math.cos(a)); z.yaw += a * Math.min(1, dt * (z.turn || 8)); }
    // горение и кровотечение (перки и снаряжение подключатся на этапах 4–5)
    if (z.burnT > 0) { z.burnT -= dt; if (Math.random() < dt * 14 * BURN_K) spawnP({ x: z.x + rnd(-0.15, 0.15), y: z.y + rnd(0.4, 1.2), z: z.z + rnd(-0.15, 0.15), vy: 1.5, s: rnd(0.07, 0.13), s1: 0.02, col: 0xffc040, col1: 0xd03010, glow: true, life: 0.45 }); }
    if (z.bleedT > 0) z.bleedT -= dt;
    if ((z.dotT -= dt) <= 0) { z.dotT = 0.25; const d = (z.burnT > 0 ? z.burnDps : 0) + (z.bleedT > 0 ? z.bleedDps : 0); if (d > 0) dzBy(z.dotOwner, z, d * 0.25, 0, 0, 0); if (z.burnT > 0) burnSpread(z); }
    if (z.dead) continue;
    for (const p of players) {                                           // укус
      if (p.down || Math.abs(p.y - z.y) > 0.6) continue;
      const cx = p.x - z.x, cz = p.z - z.z, rr = p.r + z.r, d2 = cx * cx + cz * cz;
      if (d2 < (rr + 0.35) ** 2 && !(z.atkT > 0)) { z.atkT = 0.45; zvAttack(z); }
      if (d2 < rr * rr) { const d = Math.sqrt(d2) || 0.001, k = (rr - d) / d; moveEntity(z, -cx * k, -cz * k, z.r); if (p.inv <= 0 && G.state === 'play') hurtPlayer(p, z); }
    }
    if (bt && dist < z.r + 0.45) { bt.hp -= 12 * dt; if (!(z.atkT > 0)) z.atkT = 0.45; }   // грызут турель
    if (target && !bt && dist > spawnDist + 10 + (MAP > 100 ? 16 : 0) && !onScreen(z.x, z.z)) { z.farT = (z.farT || 0) + dt; if (z.farT > 6) { z.farT = 0; relocate(z); } } else z.farT = 0;   // v0.60: переносим только тех, кто долго далеко и не на экране
  }
}
const CORPSE_MAX = IS_TOUCH ? 30 : 60;
// огоньки-лампы у костров, ближайших к точке обзора (в раздельном экране — свои для каждой половины)
function setFireLights(cx, cz, T) {
  const near = CAM.zoom * 2 + 5, lit = fires.filter(f => Math.hypot(f.x - cx, f.z - cz) < near + 6).sort((a, b) => Math.hypot(a.x - cx, a.z - cz) - Math.hypot(b.x - cx, b.z - cz));
  FIRE_LIGHTS.forEach((l, i) => { const f = lit[i]; if (!f) { l.intensity = 0; return; }
    const fl = 0.8 + 0.2 * Math.sin(T * 13 + f.seed) * Math.sin(T * 7.3 + f.seed * 2);
    l.position.set(f.x, f.y + 0.6, f.z); l.distance = 9 * f.s; l.intensity = (SUNSET ? 0.6 + G.night * 3.0 : 1.4 + G.night * 2.2) * fl * f.s; });   // днём огонь не высвечивает землю вокруг (иначе пропадает тень бочки)
}
function updateFires(dt, T) {
  const near = CAM.zoom * 2 + 5, pts = SPLIT.on ? SPLIT.views : [CAM];
  for (const f of fires) { let d = 1e9; for (const v of pts) d = Math.min(d, Math.hypot(f.x - v.x, f.z - v.z)); f.d = d; }
  setFireLights(CAM.x, CAM.z, T);
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
  const k = clamp((G.t - 60) / (RUN_TIME * 0.85 - 60), 0, 1), target = MAPID === 'cemetery' ? 1 : Math.max(G.nightT, k * k * (3 - 2 * k), EV.blackout ? 0.95 : 0);   // первая минута — закат, дальше плавно темнеет, полная ночь к ~17-й минуте
  G.night += (target - G.night) * Math.min(1, dt * 1.5);
  const n = G.night;
  if (SUNSET) skySunset(n); else {                                              // город — прежний свет
  sun.intensity = 1.15 * (1 - n) + 0.06 * n;
  sun.color.setRGB(1, 0.8 - n * 0.2, 0.58 + n * 0.3);
  hemi.intensity = 0.5 - n * 0.37; hemi.color.setRGB(1 - n * 0.6, 0.88 - n * 0.5, 0.75 - n * 0.2); hemi.groundColor.setHex(0x3a3028).multiplyScalar(1 - 0.5 * n);   // ночь темнее: почти только лампы, фонари и огонь
  renderer.toneMappingExposure = 1 - 0.08 * n;
  scene.background.setRGB(0.13 - n * 0.115, 0.1 - n * 0.087, 0.09 - n * 0.065); scene.fog.color.copy(scene.background);
  }
  for (const m of winMats) m.emissiveIntensity = 0.25 + n * 1.1 * evLights();
  for (const L of lamps) { if (L.dead) continue; const nl = n * lampOn(L); L.bulb.material.color.setRGB(0.4 + nl * 0.6, 0.39 + nl * 0.55, 0.3 + nl * 0.45); }
  setLampLights(CAM.x, CAM.z); evSkyFx(n);
}
// прожекторы фонарей, ближайших к точке обзора (в раздельном экране — для каждой половины свои)
function setLampLights(cx, cz) {
  const n = G.night;
  for (const L of lamps) L.d = Math.hypot(L.x - cx, L.z - cz);
  const ls = lamps.filter(L => !L.dead).sort((a, b) => a.d - b.d);
  setSearchLights(cx, cz);
  LAMP_LIGHTS.forEach((sp, i) => {
    const L = ls[i]; sp.intensity = L && n > 0.01 ? n * 2.4 * (L.pow || 1) * lampOn(L) : 0; if (!L) return;
    const lx = L.lx !== undefined ? L.lx : L.x + 0.6, lz = L.lz !== undefined ? L.lz : L.z;
    sp.position.set(lx, L.ly || 3.95, lz); sp.distance = L.dist || 14; sp.angle = L.ang || 0.75;                       // мачта светит дальше и шире
    sp.target.position.set(L.tx !== undefined ? L.tx : lx + 0.6, 0, L.tz !== undefined ? L.tz : lz); sp.target.updateMatrixWorld();
  });
}
// Здание между камерой и героем — полупрозрачное
const camDir = new THREE.Vector3();
function updateFade() {
  const toShared = cam.position;
  for (const B of buildings) {
    const bb = new THREE.Box3(new THREE.Vector3(B.x1, 0, B.z1), new THREE.Vector3(B.x2, B.H + 0.5, B.z2));
    let hit = false;
    for (const p of (MAPID === 'city' && G.state === 'main' ? [{ x: MM.cam.x, y: 0, z: MM.cam.z }] : players)) {                           // здание закрывает хоть одного игрока — полупрозрачное
      const to = SPLIT.on && viewFor(p) ? viewFor(p).cp : toShared, from = new THREE.Vector3(p.x, p.y + 0.6, p.z); camDir.copy(to).sub(from).normalize();
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
function scrOff(dx, dz, yaw = CAM.yaw) { const c = Math.cos(yaw), s = Math.sin(yaw); return [dx * c - dz * s, dx * s + dz * c]; }
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
        p.down = false; p.reviveT = 0; p.hp = L(helper, 'firstaid') ? 2 : 1; p.inv = 2; p.ammo = wStat(p).mag; if (helper.rs) helper.rs.revives++;
        for (let i = 0; i < 16; i++) spawnP({ x: p.x, y: p.y + 0.5, z: p.z, vx: rnd(-1.5, 1.5), vy: rnd(1, 3), vz: rnd(-1.5, 1.5), s: 0.07, s1: 0.01, col: 0x9ff0a0, glow: true, life: 0.7, drag: 0.95 });
        SFX.level();
      }
    } else p.reviveT = Math.max(0, p.reviveT - dt * 0.5);
  }
}
/* ---------- Раздельный экран (кооп): у каждого игрока своя камера и своя часть окна ---------- */
const SPLIT = { on: false, views: [], hs: 1 };
// поворот камеры игрока: в раздельном экране — только его вид, иначе общий
const yawOf = p => { const v = SPLIT.on && p ? viewFor(p) : null; return v ? v.yaw : CAM.yaw; };
function rotCam(p, dir) { const v = SPLIT.on && p && G.state === 'play' ? viewFor(p) : null; if (v) v.yawT += dir * Math.PI / 2; else CAM.yawT += dir * Math.PI / 2; }
function viewFor(p) { return SPLIT.views.find(v => v.p === p) || null; }
function splitStart() {
  SPLIT.on = !!G.split && players.length > 1 && !IS_TOUCH;
  SPLIT.views = SPLIT.on ? players.map(p => ({ p, yaw: CAM.yaw, yawT: CAM.yawT, x: p.x, z: p.z, y: p.y * 0.5, kx: 0, kz: 0, rect: null, cp: new THREE.Vector3(), vm: new THREE.Matrix4(), pm: new THREE.Matrix4() })) : [];
  document.body.classList.toggle('split', SPLIT.on); splitLayout();
}
function splitEnd() { SPLIT.on = false; SPLIT.views = []; document.body.classList.remove('split'); const el = $('splitLines'); if (el) el.style.display = 'none'; }
function splitLayout() {
  if (!SPLIT.on) return;
  const W = innerWidth, H = innerHeight, g = 4, v = SPLIT.views, n = v.length, hw = W / 2 - g / 2, hh = H / 2 - g / 2;
  const set = (i, x, y, w, h) => { v[i].rect = { x, y, w, h }; };
  if (n === 2) { set(0, 0, 0, hw, H); set(1, W / 2 + g / 2, 0, hw, H); SPLIT.hs = 1; }
  else { set(0, 0, 0, hw, hh); set(1, W / 2 + g / 2, 0, hw, hh); set(2, 0, H / 2 + g / 2, n === 3 ? W : hw, hh); if (n > 3) set(3, W / 2 + g / 2, H / 2 + g / 2, hw, hh); SPLIT.hs = 0.78; }
  const el = $('splitLines'); if (el) { el.style.display = 'block'; el.className = n === 2 ? 'two' : n === 3 ? 'three' : 'four'; }
}
addEventListener('resize', splitLayout);
// камера по виду: кадр, свет, тени
function placeCam(cx, cy, cz, sx, sz, aspect, h, shift, yaw = CAM.yaw) {
  const D = 40, cp = Math.cos(CAM.pitch), sp = Math.sin(CAM.pitch);
  cam.position.set(cx + Math.sin(yaw) * cp * D + sx, cy + sp * D, cz + Math.cos(yaw) * cp * D + sz);
  cam.lookAt(cx + sx, cy, cz + sz);
  cam.left = -h * aspect - shift; cam.right = h * aspect - shift; cam.top = h; cam.bottom = -h; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  sun.position.set(cx + SUN_OFF[0], SUN_OFF[1], cz + SUN_OFF[2]); sun.target.position.set(cx, 0, cz);
}
// Камера смещается от героя в сторону прицела (курсор, стик, цель автоприцела): чем дальше цель, тем сильнее, но не больше ~2,6 м
const CAMLEAD = [0, 0.22, 0.4], CAMLEAD_NAME = ['выкл', 'лёгкое', 'сильное'];
let CAM_LEAD_I = lsGet('camLead', 1);
function leadStep(p, dt) {
  const f = CAMLEAD[CAM_LEAD_I] || 0; let tx = 0, tz = 0;
  if (f && !p.down && p.aim && G.state === 'play') {
    const dx = p.aim.x - p.x, dz = p.aim.z - p.z, d = Math.hypot(dx, dz), c = p.lastC, auto = c && c.auto && !c.manual, m = Math.min(d * f * (auto ? 0.5 : 1), 2.6);
    if (d > 0.01) { tx = dx / d * m; tz = dz / d * m; }
  }
  const k = Math.min(1, dt * 4); p.lx = (p.lx || 0) + (tx - (p.lx || 0)) * k; p.lz = (p.lz || 0) + (tz - (p.lz || 0)) * k;
}
function placeViewCam(v) {
  let sx = v.kx + (v.p.lx || 0), sz = v.kz + (v.p.lz || 0); if (shake > 0) { sx += rnd(-1, 1) * shake * 0.6; sz += rnd(-1, 1) * shake * 0.6; }
  placeCam(v.x, v.y, v.z, sx, sz, v.rect.w / v.rect.h, CAM.zoom * SPLIT.hs, 0, v.yaw); v.cp.copy(cam.position);
}
function updateSplitCams(dt) {
  CAM.zoom += (CAM.zoomT - CAM.zoom) * Math.min(1, dt * 4);
  if (shake > 0) shake -= dt;
  for (const p of players) leadStep(p, dt);
  for (const v of SPLIT.views) v.yaw += (v.yawT - v.yaw) * Math.min(1, dt * 8);                // у каждого игрока свой поворот экрана
  const kd = Math.exp(-16 * dt), k = Math.min(1, dt * 6); let ax = 0, az = 0, sd = 0;
  for (const v of SPLIT.views) {
    v.x += (v.p.x - v.x) * k; v.z += (v.p.z - v.z) * k; v.y += (v.p.y * 0.5 - v.y) * k; v.kx *= kd; v.kz *= kd; ax += v.p.x; az += v.p.z;
    const sh = shake; shake = 0; placeViewCam(v); shake = sh;                // для кэша матриц без дрожания
    v.vm.copy(cam.matrixWorldInverse); v.pm.copy(cam.projectionMatrix);
    sd = Math.max(sd, Math.hypot(CAM.zoom * SPLIT.hs * v.rect.w / v.rect.h, CAM.zoom * SPLIT.hs * 1.6) + 1.5);
  }
  CAM.x = ax / SPLIT.views.length; CAM.z = az / SPLIT.views.length; CAM.y = 0; spawnDist = sd;
}
function updateCamera(dt) {
  CAM.yaw += (CAM.yawT - CAM.yaw) * Math.min(1, dt * 8);
  if (SPLIT.on && G.state !== 'main') {
    updateSplitCams(dt);
    if (muzzleT > 0) { muzzleT -= dt; if (muzzleT <= 0) muzzleLight.intensity = 0; }
    updateBoomLight(dt); return;
  }
  const MAIN = G.state === 'main', C = MAIN ? { x: MM.cam.x, z: MM.cam.z, y: 0 } : players.length ? camCenter() : { x: CAM.x, z: CAM.z, y: 0 };
  let need = 0;                                          // кооп: насколько отдалить, чтобы все были на экране
  if (players.length > 1) { const a = innerWidth / innerHeight, sp = Math.sin(CAM.pitch);
    for (const p of players) { const [ox, od] = scrOff(p.x - C.x, p.z - C.z); need = Math.max(need, (Math.abs(ox) + 2.6) / a, Math.abs(od) * sp + 2.4); } }
  const zt = MAIN ? MM.zoom : Math.max(CAM.zoomT, Math.min(CAM_MAX, need));
  CAM.zoom += (zt - CAM.zoom) * Math.min(1, dt * 4);
  CAM.x += (C.x - CAM.x) * Math.min(1, dt * 6); CAM.z += (C.z - CAM.z) * Math.min(1, dt * 6); CAM.y = (CAM.y || 0) + (C.y * 0.5 - (CAM.y || 0)) * Math.min(1, dt * 6);
  let sx = CAM.kx, sz = CAM.kz;
  if (!MAIN && players.length) { let lx = 0, lz = 0; for (const p of players) { leadStep(p, dt); lx += p.lx || 0; lz += p.lz || 0; } sx += lx / players.length; sz += lz / players.length; }
  if (shake > 0) { shake -= dt; sx += rnd(-1, 1) * shake * 0.6; sz += rnd(-1, 1) * shake * 0.6; }
  const kd = Math.exp(-16 * dt); CAM.kx *= kd; CAM.kz *= kd;
  const a = innerWidth / innerHeight, h = CAM.zoom; const sh = MAIN && a > 1.1 ? h * a * 0.34 : 0;   // главное меню: сцена смещена вправо, слева — кнопки
  placeCam(CAM.x, CAM.y, CAM.z, sx, sz, a, h, sh);
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
