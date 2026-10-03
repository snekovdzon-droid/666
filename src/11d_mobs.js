'use strict';
/* ---------- Особые мобы: у каждого своя задача, которую обычный зомби не ставит ----------
   Громила      — сносит мешки, турели и колючку, таранит по прямой (против «окопался в углу»)
   Кричащий     — держится позади, его крик ускоряет зомби и зовёт новых (цель номер один)
   Плевун       — плюёт кислотными лужами издалека (против «стою на месте»)
   Бунтарь      — щит спереди почти не пробить; берут бок, спина, огонь, взрывы и «Жакан»
   Тюремный пёс — быстрые, стаями по 4–6
   Начальник    — босс с охраной из бронированных (10-я и 18-я минуты)
   Данные (здоровье, скорость, время появления) — в ZOMBIES в 01_data.js; поведение — в MOB_AI ниже. */
const FORM_H = { brute: 1.15, screamer: 0.97, spitter: 1, riot: 1.02, warden: 1.28 };      // рост относительно обычного зомби
const FORM_W = { brute: 1.5, screamer: 0.82, spitter: 1.05, riot: 1.12, warden: 1.3 };      // ширина
const MOB_CAP = { brute: [2, 3], riot: [3, 4], spitter: [2, 3], screamer: [2, 3] };          // сколько таких одновременно (до 15-й минуты / позже)
const MOB_CHANCE = { brute: 0.03, riot: 0.035, spitter: 0.035, screamer: 0.025 };            // шанс на каждое появление зомби после их времени
const BOSS_AT = [600, 1080];                                                                  // секунды забега
const COATS = [0x6a5a48, 0x3a3430, 0x8a7a5a, 0x2e2c2a, 0x9a8a70];
const SPITS = [], PUDDLES = [];

// появление особых мобов вместо обычных (с потолком, чтобы не заполонили карту)
function pickSpecial(t) {
  for (const type of ['brute', 'riot', 'spitter', 'screamer']) {
    if (t < ZOMBIES[type].from || Math.random() > MOB_CHANCE[type]) continue;
    let n = 0; for (const z of zombies) if (!z.dead && z.type === type) n++;
    if (n < MOB_CAP[type][t > 900 ? 1 : 0] + (players.length > 1 ? 1 : 0)) return type;
  }
  return null;
}
const MOB_INIT = {
  hound: z => { const c = COATS[Math.floor(Math.random() * COATS.length)]; z.look = [c, c, c, null]; },
  riot: z => { z.shield = true; z.turn = 2.6; },
  brute: z => { z.kres = 0.3; z.chgCd = rnd(2, 4); },
  screamer: z => { z.scCd = rnd(3, 6); },
  spitter: z => { z.spCd = rnd(3, 5); },
  warden: z => { z.kres = 0.15; z.boss = true; z.slamCd = 6; z.callCd = 12; },
};
const faceDir = (z, t) => { const dx = t.x - z.x, dz = t.z - z.z, l = Math.hypot(dx, dz) || 1; return [dx / l, dz / l]; };
const sameLevel = (z, t) => Math.abs(t.y - z.y) < 0.6;
const ringFx = (x, y, z, R, col, n = 14) => { for (let i = 0; i < n; i++) { const a = i / n * TAU; spawnP({ x: x + Math.cos(a) * R, y, z: z + Math.sin(a) * R, vy: 0.3, s: 0.1, s1: 0.02, col, glow: true, life: 0.3 }); } };

// Все особые мобы получают (z, dt, цель, дистанция, dx, dz) и возвращают null или [dx, dz, множитель скорости]
const MOB_AI = {
  brute(z, dt, target, dist, dx, dz) {
    smashStructures(z, 0.35);
    const moved = Math.hypot(z.x - (z.px ?? z.x), z.z - (z.pz ?? z.z)); z.px = z.x; z.pz = z.z;
    z.raise = Math.max(0, (z.raise || 0) - dt * 3); z.lean = 0;
    if (z.chg === 'wind') {                                          // замер и набирает ярость
      z.chgT -= dt; z.raise = Math.min(1, 1.2 - z.chgT);
      if (target) { const f = faceDir(z, target); dx = f[0]; dz = f[1]; }
      if (Math.random() < dt * 40) spawnP({ x: z.x + rnd(-0.3, 0.3), y: z.y + 0.1, z: z.z + rnd(-0.3, 0.3), vy: 1.2, s: 0.09, s1: 0.02, col: 0xff5a2a, glow: true, life: 0.4 });
      if (z.chgT <= 0) { z.chg = 'dash'; z.chgT = 1.0; z.dashed = 0; z.cdx = dx; z.cdz = dz; SFX.thump(); }
      return [dx, dz, 0];
    }
    if (z.chg === 'dash') {                                          // рывок по прямой, сносит всё
      z.chgT -= dt; z.dashed += dt; z.lean = 0.35;
      if (Math.random() < dt * 25) dust(z.x, z.y + 0.1, z.z, 0xb0a690, 2);
      if (z.dashed > 0.2 && moved < z.speed * 10 * dt * 0.35) {      // врезался в стену — оглушён
        z.chg = 0; z.chgCd = rnd(5, 7); z.stunT = 1.4; shake = Math.max(shake, 0.4); SFX.thump(); dust(z.x + z.cdx * 0.5, z.y + 0.8, z.z + z.cdz * 0.5, 0xb0a690, 10);
        return [dx, dz, 0];
      }
      if (z.chgT <= 0) { z.chg = 0; z.chgCd = rnd(5, 7); }
      return [z.cdx, z.cdz, 10];
    }
    z.chgCd -= dt;
    if (target && z.stunT <= 0 && z.chgCd <= 0 && dist > 3 && dist < 9 && sameLevel(z, target)) { z.chg = 'wind'; z.chgT = 0.9; SFX.roar(z); }
    return null;
  },
  screamer(z, dt, target, dist, dx, dz) {
    z.raise = Math.max(0, (z.raise || 0) - dt * 3);
    if ((z.markP = (z.markP || 0) - dt) <= 0) { z.markP = 0.18; spawnP({ x: z.x, y: z.y + VZ.H * 1.0 + 0.4, z: z.z, vy: 0.5, s: 0.09, s1: 0.02, col: 0xff3a2a, glow: true, life: 0.5 }); }   // красная метка над головой
    if (z.scWind > 0) { z.scWind -= dt; z.raise = 1; if (z.scWind <= 0) doScream(z); return [dx, dz, 0]; }
    z.scCd -= dt;
    if (!target) return null;
    if (z.scCd <= 0 && dist < 18) { z.scWind = 0.8; return [dx, dz, 0]; }
    if (dist < 7.5) { const f = faceDir(z, target); return [-f[0], -f[1], 1.1]; }       // пятится — держится позади толпы
    if (dist < 10.5) return [dx, dz, 0];
    return null;
  },
  spitter(z, dt, target, dist, dx, dz) {
    z.raise = Math.max(0, (z.raise || 0) - dt * 3);
    if (z.spWind > 0) { z.spWind -= dt; z.raise = 0.8; if (z.spWind <= 0) spitAt(z, z.spRef); return [dx, dz, 0]; }
    z.spCd -= dt;
    if (!target) return null;
    if (z.spCd <= 0 && dist > 3.5 && dist < 8 && Math.abs(target.y - z.y) < 1.5 && onScreen(z.x, z.z, z.y)) { z.spWind = 0.55; z.spRef = target; return [dx, dz, 0]; }
    if (dist < 5) { const f = faceDir(z, target); return [-f[0], -f[1], 0.9]; }
    if (dist < 8) return [dx, dz, 0];
    return null;
  },
  warden(z, dt, target, dist, dx, dz) {
    if (z.stunT > 0.3) z.stunT = 0.3;                                // босса почти не оглушить
    smashStructures(z, 0.5);
    const enr = z.hp < z.maxHp * 0.3;
    z.raise = Math.max(0, (z.raise || 0) - dt * 3);
    if (z.slamWind > 0) {
      z.slamWind -= dt; z.raise = Math.min(1, 1.1 - z.slamWind);
      if (Math.random() < dt * 14) ringFx(z.x, z.y + 0.1, z.z, 3.4, 0xff3a2a, 10);       // красное кольцо на земле — туда прилетит удар
      if (z.slamWind <= 0) doSlam(z, enr);
      return [dx, dz, 0];
    }
    z.slamCd -= dt; z.callCd -= dt;
    if (z.callCd <= 0) { callGuards(z, enr); z.callCd = enr ? 14 : 20; }
    if (target && z.slamCd <= 0 && dist < 4.2 && sameLevel(z, target)) { z.slamWind = 1.0; SFX.roar(z); }
    return [dx, dz, enr ? 1.35 : 1];
  },
};

// Громила и босс ломают всё, что стоит на пути: мешки, турели, колючую проволоку
function smashStructures(z, reach) {
  for (const B of BAGS) {
    const s = B.s; if (B.hp <= 0 || Math.abs(z.y - s.y1) > 0.6) continue;
    const ex = Math.max(s.x1 - z.x, 0, z.x - s.x2), ez = Math.max(s.z1 - z.z, 0, z.z - s.z2);
    if (ex * ex + ez * ez < (z.r + reach) ** 2) { B.hp = 0; shake = Math.max(shake, 0.2); }
  }
  for (const Gt of GATES) if (!Gt.open) { const ex = Math.max(Gt.x1 - z.x, 0, z.x - Gt.x2), ez = Math.max(Gt.z1 - z.z, 0, z.z - Gt.z2); if (ex * ex + ez * ez < (z.r + reach) ** 2) { Gt.hp = 0; shake = Math.max(shake, 0.2); } }
  for (const t of TURRETS) if (t.life > 0 && Math.abs(t.y - z.y) < 0.8 && Math.hypot(t.x - z.x, t.z - z.z) < z.r + reach + 0.2) { t.life = 0; t.hp = 0; shake = Math.max(shake, 0.2); }
  for (const w of WIRES) if (w.uses > 0 && Math.abs(w.y - z.y) < 0.8 && inWire(w, z.x, z.z, z.r + reach)) { w.uses = 0; shake = Math.max(shake, 0.1); }
}

/* ---------- Кричащий: крик ускоряет зомби вокруг и зовёт новых ---------- */
function doScream(z) {
  z.scCd = 10; SFX.scream(z); shake = Math.max(shake, 0.25);
  ringFx(z.x, z.y + 0.9, z.z, 1.2, 0xff6a4a, 16); ringFx(z.x, z.y + 0.9, z.z, 2.4, 0xff6a4a, 20);
  forNear(z.x, z.z, o => { if (!o.dead && o !== z) o.rageT = 5; }, 8);
  let alive = 0, sum = 0;
  for (const o of zombies) if (!o.dead) { alive++; if (o.summoned) sum++; }
  const n = Math.min(3, MAX_ENEMIES - alive - 4, 14 - sum);                    // зовёт до 3 за раз, всего не больше 14 «зов» живых
  for (let k = 0; k < n; k++) { const w = spawnZombie('walker', { x: z.x, z: z.z }); if (w) { w.summoned = true; w.rageT = 5; } }
}

/* ---------- Плевун: плевок дугой, кислотная лужа ---------- */
function spitAt(z, tg) {
  z.spCd = rnd(5, 7); if (!tg || tg.down) return;
  const T = 1.1, g = 14, y0 = z.y + 1.1, y1 = floorAt(tg.x, tg.z, tg.y) + 0.05;
  SPITS.push({ x: z.x, y: y0, z: z.z, vx: (tg.x - z.x) / T, vz: (tg.z - z.z) / T, vy: (y1 - y0) / T + 0.5 * g * T, g, t: 0, T, y1, mark: spitMark(tg.x, tg.z, y1) });
  SFX.spit();
}
// Метка падения плевка: пульсирующее кольцо на земле с момента выстрела — видно, куда не надо вставать
const MARK_RING = new THREE.RingGeometry(0.72, 0.9, 32).rotateX(-Math.PI / 2), MARK_DISC = new THREE.CircleGeometry(0.9, 24).rotateX(-Math.PI / 2);
const MARK_M1 = new THREE.MeshBasicMaterial({ color: 0xb6ff3a, transparent: true, opacity: 0.8, depthWrite: false }), MARK_M2 = new THREE.MeshBasicMaterial({ color: 0x7be02a, transparent: true, opacity: 0.18, depthWrite: false });
function spitMark(x, z, y) { const g = new THREE.Group(); g.add(new THREE.Mesh(MARK_RING, MARK_M1), new THREE.Mesh(MARK_DISC, MARK_M2)); g.position.set(x, y + 0.07, z); g.renderOrder = 3; scene.add(g); return g; }
function addPuddle(x, z, y) {
  const m = new THREE.Mesh(PUD_GEO, PUD_MAT); m.position.set(x, y + 0.04, z); m.renderOrder = 2; scene.add(m);
  PUDDLES.push({ x, z, y, R: 0.9, t: 4, max: 4, m });
  if (PUDDLES.length > 8) { const o = PUDDLES.shift(); scene.remove(o.m); }
}
const PUD_GEO = new THREE.CircleGeometry(1, 24); PUD_GEO.rotateX(-Math.PI / 2);
const PUD_MAT = new THREE.MeshBasicMaterial({ color: 0x7be02a, transparent: true, opacity: 0.5, depthWrite: false });

/* ---------- Босс ---------- */
function doSlam(z, enr) {
  z.slamCd = enr ? 5 : 8; shake = Math.max(shake, 0.6); SFX.slam();
  ringFx(z.x, z.y + 0.15, z.z, 1.2, 0xe8d8b0, 14); ringFx(z.x, z.y + 0.15, z.z, 2.4, 0xe8d8b0, 18); ringFx(z.x, z.y + 0.15, z.z, 3.4, 0xe8d8b0, 22);
  dust(z.x, z.y + 0.2, z.z, 0xb0a690, 14);
  for (const p of players) {
    if (p.down || p.inv > 0 || Math.abs(p.y - z.y) > 0.8 || Math.hypot(p.x - z.x, p.z - z.z) > 3.4) continue;
    hurtPlayer(p, null); p.trapT = Math.max(p.trapT || 0, 0.5);
  }
  smashStructures(z, 3.2);
}
function callGuards(z, enr) {
  let g = 0; for (const o of zombies) if (!o.dead && o.guard) g++;
  const n = Math.min(enr ? 3 : 2, 6 - g); if (n <= 0) return;
  SFX.scream(z);
  for (let k = 0; k < n; k++) { const w = spawnZombie('armored', { x: z.x, z: z.z }, undefined, true); if (w) { w.guard = true; w.rageT = 4; } }
}
function spawnWarden() {
  const sp = spawnPoint(); if (!sp) return;
  const n = G.bossN, z = spawnZombie('warden', sp, undefined, true); if (!z) return;
  G.bossN++; z.hp *= (1 + 0.5 * n) * coopMul(); z.maxHp = z.hp; G.boss = z;
  for (let k = 0; k < 4 + 2 * n; k++) { const g = spawnZombie('armored', sp, undefined, true); if (g) g.guard = true; }
  banner(n ? 'Начальник тюрьмы вернулся' : 'Начальник тюрьмы идёт за вами'); SFX.roar();
}
function wardenDown(z) {
  if (G.boss === z) G.boss = null; G.bossKills = (G.bossKills || 0) + 1;
  banner('Начальник тюрьмы повержен'); SFX.level();
  spawnCrate(z.x + 0.8, z.z, true); spawnCrate(z.x - 0.8, z.z, true);
}
function banner(text) {
  const el = $('lvlMsg'); if (!el) return; el.textContent = text; el.style.opacity = 1;
  clearTimeout(banner.t); banner.t = setTimeout(() => { el.style.opacity = 0; }, 3000);
}

/* ---------- Стаи псов и расписание боссов ---------- */
function spawnPack() {
  const sp = spawnPoint(); if (!sp) return;
  const n = Math.min(8, Math.round(Math.min(6, 4 + (G.t - 200) / 300) * (1 + 0.3 * (players.length - 1))));
  for (let i = 0; i < n; i++) spawnZombie('hound', sp);
  SFX.bark();
}
function mobTimers() {
  if (G.t >= G.nextPack) { spawnPack(); G.nextPack = G.t + rnd(70, 95); }
  if (G.bossN < BOSS_AT.length && G.t >= BOSS_AT[G.bossN]) spawnWarden();
}

/* ---------- Каждый кадр: плевки, лужи, полоса босса ---------- */
function updateMobFx(dt) {
  for (let i = SPITS.length - 1; i >= 0; i--) {
    const s = SPITS[i]; s.t += dt; s.vy -= s.g * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
    spawnP({ x: s.x, y: s.y, z: s.z, s: 0.12, s1: 0.03, col: 0x9ae03a, glow: true, life: 0.3 });
    if (s.mark) { const k = 0.82 + 0.18 * Math.sin(s.t * 14); s.mark.scale.set(k, 1, k); }
    if (s.t >= s.T) { if (s.mark) scene.remove(s.mark); addPuddle(s.x, s.z, floorAt(s.x, s.z, s.y1)); dust(s.x, s.y1 + 0.1, s.z, 0x7be02a, 6); SPITS.splice(i, 1); }
  }
  for (let i = PUDDLES.length - 1; i >= 0; i--) {
    const P = PUDDLES[i]; P.t -= dt;
    if (P.t <= 0) { scene.remove(P.m); PUDDLES.splice(i, 1); continue; }
    const k = Math.min(1, P.t / 1.2, (P.max - P.t) / 0.25 + 0.2);                // появляется быстро, гаснет за последнюю секунду
    P.m.scale.set(P.R * k, 1, P.R * k);
    if (Math.random() < dt * 4) spawnP({ x: P.x + rnd(-P.R, P.R) * 0.7, y: P.y + 0.1, z: P.z + rnd(-P.R, P.R) * 0.7, vy: 0.6, s: 0.07, s1: 0.02, col: 0x9ae03a, glow: true, life: 0.5 });
  }
  for (const p of players) {
    let inside = false;
    for (const P of PUDDLES) if (!p.down && Math.abs(p.y - P.y) < 0.6 && Math.hypot(p.x - P.x, p.z - P.z) < P.R * 0.9) { inside = true; break; }
    if (inside) {
      p.slowAcid = 0.35; p.acidT = (p.acidT || 0) + dt;                                              // кислота: слабое замедление, жжёт после 1,2 с стояния
      if (p.acidT >= 1.2 && p.inv <= 0 && G.state === 'play') { hurtPlayer(p, null); p.acidT = -0.8; }       // жжёт, если стоять в луже
    } else if (p.acidT > 0) p.acidT = Math.max(0, p.acidT - dt);
  }
  const bar = $('bossBar'), B = G.boss;
  if (bar) { const on = B && !B.dead && G.state === 'play'; bar.style.display = on ? 'block' : 'none'; if (on) bar.querySelector('i').style.width = Math.max(0, B.hp / B.maxHp * 100).toFixed(1) + '%'; }
}
function clearMobs() {
  for (const s of SPITS) if (s.mark) scene.remove(s.mark); SPITS.length = 0; for (const P of PUDDLES) scene.remove(P.m); PUDDLES.length = 0;
  G.boss = null; const bar = $('bossBar'); if (bar) bar.style.display = 'none';
}

/* ---------- Вид: вещи на моделях зомби из пака и пёс из коробок ---------- */
function mobGear(c, at, M) {
  const P = (col, b, sx, sy, sz, oy, oz, ox = 0) => part(lin(col), 0, 0, 0, 0, b.s.x * sx, b.s.y * sy, b.s.z * sz, b.c.y + b.s.y * oy, b.c.z + b.s.z * oz, 0, b.c.x + b.s.x * ox);
  switch (c.form) {
    case 'brute': {
      let b = at('body'); P(0xb5601d, b, 1.06, 0.6, 1.1, 0.1, 0);                           // оранжевая тюремная жилетка
      b = at('armA'); P(0x555555, b, 1.3, 0.12, 1.3, -0.35, 0); b = at('armB'); P(0x555555, b, 1.3, 0.12, 1.3, -0.35, 0);   // кандалы на запястьях
      break; }
    case 'screamer': {
      const h = at('head'); P(0x120808, h, 0.5, 0.3, 0.12, -0.18, 0.5); break; }           // распахнутый рот
    case 'spitter': {
      const h = at('head'); P(0x86c43a, h, 0.8, 0.35, 0.7, -0.5, 0.1); P(0x5a8a22, h, 0.4, 0.2, 0.1, -0.12, 0.5); break; }   // зоб с кислотой
    case 'riot': {
      let h = at('head'); P(0x1f2a44, h, 1.18, 0.42, 1.18, 0.38, 0); P(0x9ac8e0, h, 1.05, 0.22, 0.1, 0.05, 0.55);      // шлем с забралом
      let b = at('body'); P(0x2a3a52, b, 1.12, 0.7, 1.2, 0.1, 0);                          // жилет
      if (!c.dead) { b = at('body'); P(0x2a3a52, b, 1.68, 1.28, 0.1, 0, 0.85); P(0xa8d0e8, b, 1.5, 1.14, 0.12, 0, 0.9); }   // щит: рамка и стекло
      break; }
    case 'warden': {
      let h = at('head'); P(0x1a2238, h, 1.2, 0.34, 1.2, 0.4, 0); P(0x1a2238, h, 1.1, 0.07, 1.5, 0.18, 0.3); P(0xd8b040, h, 1.22, 0.06, 1.22, 0.27, 0);   // фуражка с козырьком и околышем
      let b = at('body'); P(0x1c2440, b, 1.14, 0.8, 1.28, 0.08, 0); P(0xd8b040, b, 0.18, 0.8, 1.3, 0.08, 0); P(0x1c2440, b, 1.45, 0.12, 1.1, 0.46, 0);   // жилет, золотая полоса, погоны
      break; }
  }
}
function drawHound(c, f) {
  const col = c.look[0], a = Math.sin(c.phase * 0.7) * (c.moving ? 0.9 : 0), body = c.moving ? Math.abs(Math.sin(c.phase * 0.7)) * 0.03 : 0;
  part(col, 0, 0.3 + body, 0, 0, 0.2, 0.2, 0.56, 0, 0, f);                                                  // туловище
  for (const [x, z, s] of [[-0.07, 0.2, 1], [0.07, 0.2, -1], [-0.07, -0.2, -1], [0.07, -0.2, 1]]) part(col, x, 0.26 + body, z, a * s, 0.07, 0.27, 0.07, -0.13, 0, f);   // лапы
  part(col, 0, 0.38 + body, 0.3, c.nod || 0, 0.16, 0.16, 0.2, 0.02, 0.08, f);                                // голова
  part(0x2a2420, 0, 0.36 + body, 0.3, c.nod || 0, 0.08, 0.08, 0.1, 0, 0.22, f);                              // морда
  part(col, -0.06, 0.46 + body, 0.28, 0, 0.04, 0.08, 0.04, 0, 0, f); part(col, 0.06, 0.46 + body, 0.28, 0, 0.04, 0.08, 0.04, 0, 0, f);   // уши
  part(col, 0, 0.4 + body, -0.28, -0.7 + a * 0.15, 0.05, 0.05, 0.22, 0, -0.1, f);                            // хвост
}

Object.assign(SFX, {
  roar() { if (!soundOn()) return; tone({ f0: 130, f1: 55, dur: 0.7, vol: 0.4, type: 'sawtooth' }); noiseHit({ dur: 0.6, type: 'lowpass', freq: 600, vol: 0.25 }); },
  scream() { if (!soundOn() || !canPlay('scream', 300)) return; tone({ f0: 520, f1: 1500, dur: 0.9, vol: 0.22, type: 'sawtooth' }); tone({ f0: 760, f1: 2000, dur: 0.8, vol: 0.12, type: 'square', delay: 0.05 }); noiseHit({ dur: 0.8, type: 'bandpass', freq: 2600, q: 1, vol: 0.12 }); },
  spit() { if (!soundOn() || !canPlay('spit', 80)) return; noiseHit({ dur: 0.25, type: 'bandpass', freq: 1200, q: 0.8, vol: 0.2, sweep: 500 }); tone({ f0: 300, f1: 700, dur: 0.2, vol: 0.12 }); },
  bark() { if (!soundOn() || !canPlay('bark', 200)) return; for (let i = 0; i < 3; i++) { tone({ f0: 420, f1: 200, dur: 0.13, vol: 0.2, type: 'square', delay: i * 0.18 }); noiseHit({ dur: 0.08, type: 'bandpass', freq: 1400, q: 1, vol: 0.1 }); } },
  slam() { if (!soundOn()) return; SFX.thump(); noiseHit({ dur: 0.6, type: 'lowpass', freq: 500, vol: 0.5 }); tone({ f0: 70, f1: 28, dur: 0.5, vol: 0.6 }); },
});
