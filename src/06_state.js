'use strict';
/* ---------- 9. Состояние игры: игроки, стволы, зомби, появление ---------- */
let MAX_ENEMIES = Math.round((IS_TOUCH ? CFG.MAX_ENEMIES_MOBILE : CFG.MAX_ENEMIES_PC) * QS.cap);   // потолок врагов зависит от качества графики
const HERO_LOOK = [0xd8a880, 0x3c6a8a, 0x3a3630, 0x4a3020];
const players = [];                                  // закладка под кооп (этап 3): пока один игрок
let player = null;
function makePlayer(idx, gun, x, z, ctl = { ctrl: 'all' }) {
  const p = { kind: 'player', idx, ctrl: ctl.ctrl, pad: ctl.pad, reviveT: 0, secondUsed: false, x, y: 0, z, vy: 0, yaw: 0, look: [HERO_LOOK[0], [0x3c6a8a, 0x9a5040, 0x4e7a44, 0xb08c34][idx % 4], HERO_LOOK[2], HERO_LOOK[3]], r: CFG.PLAYER_R, phase: 0, moving: false,
    hp: CFG.PLAYER_HP, maxHp: CFG.PLAYER_HP, inv: 0, down: false, gun, ammo: 0, cool: 0, reloadT: 0, reloadMax: 1, kick: 0, pitch: 0,
    kx: 0, kz: 0, still: true, spin: 0, bloom: 0, firing: false, pump: 0, lastShot: -9, burstN: 0, fanShots: 0, shotN: 0,
    stam: 1, stamLock: false, stamRegenT: 0, sprinting: false, breathT: 0, slowT: 0, aim: null,
    lv: {}, evo: {}, items: [], branch: null, sub: null, stillT: 0, adrenT: 0, pbKills: 0,
    shield: false, shieldT: 0, shieldCd: 1, ubglN: 0, ubglQ: 0, ubglT: 0, fanN: 0, handN: 0, serN: 0, twinN: 0, known: {}, pouch: {}, slots: [], hand: null, dev: {}, hookCd: 0, injReady: false, att: {}, itemCool: 0, msg: '', msgT: 0,
    st: { dmg: 1, rate: 1, mag: 1, reload: 1, speed: 1, pierce: 0, proj: 0, pickup: 1, knock: 1, stam: 1, stamRegen: 1 } };
  applyClass(p);
  p.ammo = wStat(p).mag;
  return p;
}
// Пассивки классов (класс = ствол)
function applyClass(p) {
  p.cls = CLS(p); p.devSlots = 1; p.pouchBonus = 0; p.melee = null; p.meleeLv = {}; p.meleeCd = 0; p.meleeSw = null; p.curse = null; if (!p.rs) p.rs = newRunStats();
  if (p.cls === 'soldier') p.st.reload *= 0.85;
  if (p.cls === 'gunner') p.maxHp = p.hp = CFG.PLAYER_HP + 1;
  if (p.cls === 'biker') { p.st.speed *= 1.1; p.st.stamRegen *= 1.35; p.maxHp = p.hp = CFG.PLAYER_HP - 1; }
  if (p.cls === 'hunter') p.st.pickup *= 1.6;
  if (p.cls === 'tech') { p.devSlots = 2; p.pouchBonus = 1; }
}
// Характеристики ствола с учётом перков (перки подключатся на этапе 4 — формулы уже как в 2D v33)
function wStat(p) {
  const id = p.gun, b = WEAPONS[id], s = p.st;
  let pellets = b.pellets + s.proj, dmg = b.dmg * s.dmg, spread = b.spread, life = b.life, speed = b.speed;
  let pierce = b.pierce + s.pierce, knock = b.knock * s.knock, mag = b.mag, reload = b.reload * s.reload;
  let rate = b.rateMax ? b.rate + (b.rateMax - b.rate) * p.spin : b.rate;
  const rateMul = s.rate;                            // исключение для пулемёта убрано (решение автора)
  if (id === 'shotgun') {
    if (L(p, 'sg_slug')) {                           // «Жакан»: одна тяжёлая пуля
      pellets = 1 + s.proj; dmg *= 5; pierce += 3; spread = 0.03; speed = 16; life = 0.6; knock *= 1.6;
      if (p.evo.sg_elephant) pierce = 99;
      if (L(p, 'sg_aim') && p.stillT >= 0.4) { dmg *= 1.5; pierce += 2; }
    } else pellets += 2 * L(p, 'sg_buck');
    life *= 1 + 0.4 * L(p, 'sg_long'); spread *= 1 - 0.25 * L(p, 'sg_long');
    mag += 2 * L(p, 'sg_drum');
    if (p.evo.sg_auto) { rate = 1.9; mag *= 1.5; }   // «Автоматический дробовик»: помповый ритм всегда на максимуме
    const pump = p.evo.sg_auto ? 3 : p.pump;
    if (L(p, 'sg_pump') || p.evo.sg_auto) rate *= 1 + (0.1 + 0.05 * Math.max(1, L(p, 'sg_pump'))) * pump;
    if (L(p, 'sg_fire')) dmg *= 0.8;                 // «Зажигательная дробь»: энергия уходит в огонь
    if (L(p, 'sg_cone')) { life *= 1 + 0.3 * L(p, 'sg_cone'); pierce += 1; }
  }
  if (id === 'sawnoff') {
    reload *= 1 - 0.25 * L(p, 'so_break');
    if (L(p, 'so_grip')) knock *= 0.5;
    knock *= Math.pow(1.4, L(p, 'so_charge'));                                   // «Мощный заряд»: +40% за уровень (сложением множителей)
    if (p.evo.so_berserk && p.hp === 1) dmg *= 2;
  }
  if (id === 'rifle') {
    mag *= 1 + 0.5 * L(p, 'ri_drum');                                    // Штурмовик
    if (p.evo.ri_pierce) pierce += 3;                                    // «Прошивка»
    if (L(p, 'ri_burst')) { dmg *= 1.2; spread = 0; }                    // Стрелок: «Отсечка» — без разброса
    life *= 1 + 0.25 * L(p, 'ri_scope');                                 // «Выдержка»
    if (p.evo.ri_marks) spread = 0;                                      // «Марксман» (и рост разброса отключён в стрельбе)
  }
  if (id === 'mg') {
    let rMin = b.rate, rMax = b.rateMax;
    if (L(p, 'mg_small')) { dmg *= 0.7; rMax = p.evo.mg_mower ? 20 : 16; }                       // мелкий калибр: 5 → 3,5
    if (L(p, 'mg_big')) { dmg *= 2.5; rMax = 5; mag = 50; pierce += 1; }                        // ДШК: 5 → 12,5
    dmg *= 1 + 0.2 * L(p, 'mg_heavy');
    if (L(p, 'mg_core')) pierce += 1;
    if (p.evo.mg_127) pierce += 1;                                       // «12.7»: итого пробивает троих (калибр + сердечники + финал)
    mag += 75 * L(p, 'mg_belt');
    if (L(p, 'mg_mag')) { mag = 75; reload = 2.2 * s.reload; }
    if (p.evo.mg_rpk) rMin = Math.min(9, rMax);                          // «РПК»: сразу раскрутка до 9
    rate = rMin + (rMax - rMin) * p.spin;
    if (L(p, 'mg_bipod') && p.still) { spread *= 0.5; dmg *= 1 + 0.2 * L(p, 'mg_bipod'); }
    if (L(p, 'mg_flow') && p.spin >= 0.95) spread *= 1 - 0.25 * L(p, 'mg_flow');
    if (L(p, 'mg_hip') && !p.still) spread *= 1 - 0.2 * L(p, 'mg_hip');
  }
  if (id === 'revolver') {
    reload *= 1 - 0.3 * L(p, 'rv_speed');
    if (p.evo.rv_twin) { mag *= 2; rate *= 1.5; }                        // «Два кольта»: барабан 12, стволы по очереди
    if (L(p, 'rv_fan') && p.fanOn) { rate *= 3; spread += Math.min(6, p.fanN) * (L(p, 'rv_fan') >= 2 ? 0.035 : 0.07); }   // разброс растёт до 6-го выстрела   // «Веер»
    pierce += L(p, 'rv_44');
    if (L(p, 'rv_long')) { life *= 1.4 / 1.25; speed *= 1.25; }         // «Нарезка»: +40% дальности, пуля быстрее
    if (p.evo.rv_500) pierce = 99;
  }
  if (id === 'crossbow') {
    pierce += L(p, 'cb_heavy');                                          // «Тяжёлый наконечник»: 2 → 3 зомби
    dmg *= 1 + 0.2 * L(p, 'cb_taut');                                    // «Тугая тетива»
    pellets += L(p, 'cb_multi');                                         // «Двойной / Тройной болт»
    const qk = Math.pow(0.85, L(p, 'cb_quick'));                         // «Быстрая рука»: −15% за уровень
    reload *= qk;
    if (L(p, 'cb_fletch')) { speed *= 1.3; life *= 1.3; }                // «Оперение»
    if (L(p, 'cb_mag')) {                                                // «Барабанный магазин»: 5 → 7 → 9 → 12
      mag = [5, 7, 9, 12][Math.min(3, L(p, 'cb_vol'))]; dmg *= 0.75;
      rate = 2.5 / qk * (1 + 0.5 * p.spin * L(p, 'cb_spin'));            // «Раскрутка»: до +50%
      reload = 3 * s.reload * (L(p, 'cb_swap') ? 0.75 : 1);
    }
  }
  if (id === 'smg') {
    if (L(p, 'smg_mp5')) { mag = 30; rate = 9; spread *= 0.5; dmg *= 5.5 / 4; }   // MP5
    life *= 1 + 0.25 * L(p, 'smg_rail');                                  // «Прицельная планка»
    if (L(p, 'smg_uzi')) { rate *= 2; spread *= 1.5; reload *= 1.3; }     // «Второй узи»
    mag *= 1 + 0.5 * L(p, 'smg_long');                                    // «Длинные магазины»
  }
  if (p.cls === 'bouncer') spread *= 1.1;                                 // Вышибала: разброс +10%
  if (p.cls === 'tech') dmg *= 0.9;                                      // Техник: урон ПП −10%
  if (L(p, 'shoulder') && players.some(q => q !== p && !q.down && Math.hypot(q.x - p.x, q.z - p.z) < 3)) dmg *= 1 + 0.15 * L(p, 'shoulder');
  dmg *= rageMul(p);                                                      // «Ярость»
  if (p.y >= 2) life *= 1.3;                         // с крыши видно дальше: дальность +30%
  if (p.att && p.att.laser) spread *= 0.7;                                // ЛЦУ
  if (p.att && p.att.barrel) { life *= 1.3; speed *= 1.15; dmg *= 1.1; }  // удлинённый ствол
  return { dmg, rate: rate * rateMul, mag: Math.max(1, Math.round(mag * s.mag)), reload, pellets,
    spread: spread + p.bloom + (p.sprinting && !p.evo.mg_rpk && !p.evo.smg_storm ? CFG.SPRINT_SPREAD : 0), speed, life, pierce, knock, fan: b.fan, heavy: !!b.heavy };
}
// двойное оружие: «Два кольта» и «Второй узи» — по стволу в каждой руке
const twinGuns = p => !p.hand && ((p.gun === 'revolver' && !!p.evo.rv_twin) || (p.gun === 'smg' && L(p, 'smg_uzi') > 0));
const oneHand = p => !!p.hand || p.gun === 'revolver' || (p.gun === 'smg' && L(p, 'smg_uzi') > 0);   // предмет в руке — одной рукой
const xpNeed = lvl => Math.round(5 * Math.pow(1.13, lvl - 1) + (lvl - 1) * 3);   // v0.60: каждый уровень заметно дороже предыдущего
function aliveZombies() { let n = 0; for (const z of zombies) if (!z.dead) n++; return n; }   // без временных массивов
const alivePlayers = () => players.filter(p => !p.down);
function nearestAlive(x, z) { let best = null, bd = Infinity; for (const p of players) { if (p.down) continue; const d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < bd) { bd = d; best = p; } } return best; }

const zombies = [], bullets = [], gems = [];
const G = { state: 'menu', t: 0, kills: 0, spawnAcc: 0, nextHorde: 60, xp: 0, level: 1, over: false, win: false,
  night: 0, nightT: 0, fps: 60, navT: 0, zId: 1, hurtFx: 0, gun: lsGet('gun', 'shotgun'), nPlayers: 1, split: lsGet('split', false), guns: lsGet('guns', ['shotgun', 'rifle', 'mg', 'revolver']), pick: 0 };
if (!WEAPONS[G.gun]) G.gun = 'shotgun';
G.guns = G.guns.map(g => WEAPONS[g] ? g : 'shotgun');

/* ---- Зомби: типы, внешность, появление ---- */
// Внешности по типу: 40% тюремные (из них ~1/4 охрана), остальные гражданские. Ползун — вариант ходока (как в 2D).
function lookFor(type) {
  const r = Math.random();
  const a = type === 'armored' ? (r < 0.5 ? LOOKS.guard : LOOKS.civ) : r < 0.3 ? LOOKS.pris : r < 0.4 ? LOOKS.guard : LOOKS.civ;
  const lk = a[Math.floor(Math.random() * a.length)].slice();
  if (type === 'runner') lk[0] = 0xb4b27a;                    // бегуны желтоватые и худые
  if (type === 'fat') { lk[0] = 0x96a874; if (lk[4]) lk.length = 4; }
  return lk;
}
// Точки выхода зомби на тестовой карте: пролом в стене, дорога, края, двери корпусов
let SPAWNS = [];                                   // точки выхода — из карты (mapSpawns в 35_map), заполняются после buildMap
let spawnDist = 16;
const _pv = new THREE.Vector3();
function onScreen(x, z, y = 0) {
  if (SPLIT.on) { for (const v of SPLIT.views) { _pv.set(x, y + 0.6, z).applyMatrix4(v.vm).applyMatrix4(v.pm); if (Math.abs(_pv.x) < 1.08 && Math.abs(_pv.y) < 1.12) return true; } return false; }
  _pv.set(x, y + 0.6, z).project(cam); return Math.abs(_pv.x) < 1.08 && Math.abs(_pv.y) < 1.12;
}
function spawnPoint(allowVisible) {
  const al = alivePlayers(); if (!al.length) return null;
  const cand = [];
  // v0.60: со всех сторон — вокруг игроков 8 секторов; чем больше зомби уже в секторе, тем реже там появляются новые
  const cx = al.reduce((a, p) => a + p.x, 0) / al.length, cz = al.reduce((a, p) => a + p.z, 0) / al.length, SEC = new Array(8).fill(0);
  const secOf = (x, z) => ((Math.floor((Math.atan2(z - cz, x - cx) + Math.PI) / (Math.PI / 4)) % 8) + 8) % 8;
  for (const z of zombies) if (!z.dead) SEC[secOf(z.x, z.z)]++;
  const avg = SEC.reduce((a, b) => a + b, 0) / 8 + 1;
  for (const sp of SPAWNS) {
    const d = Math.min(...al.map(p => Math.hypot(p.x - sp.x, p.z - sp.z)));
    if (allowVisible ? d < 8 : d < spawnDist * 0.85 || onScreen(sp.x, sp.z)) continue;
    const w = d < spawnDist + 12 ? 1 : 0.02, crowd = (SEC[secOf(sp.x, sp.z)] + 1) / avg;
    cand.push([sp, w * (sp.kind === 'bld' ? 0.8 : sp.kind === 'field' ? 0.7 : 1.2) / (crowd * crowd)]);
  }
  if (!cand.length) return allowVisible ? null : spawnPoint(true);   // маленькая карта: выходят из дверей и пролома на виду
  let r = Math.random() * cand.reduce((a, c) => a + c[1], 0);
  for (const [sp, w] of cand) if ((r -= w) <= 0) return sp;
  return cand[cand.length - 1][0];
}
function jitterAt(sp, rad) {
  for (let i = 0; i < 8; i++) {
    const x = sp.x + rnd(-rad, rad), z = sp.z + rnd(-rad, rad);
    if (x > 0.6 && z > 0.6 && x < MAP - 0.6 && z < MAP - 0.6 && !blocked(x, z, 0, 0.35) && floorAt(x, z, 0) === 0) return { x, z };
  }
  return { x: sp.x, z: sp.z };
}
function findSpawnPos(at) {
  if (at) return jitterAt(at, 1.6);
  const sp = spawnPoint(); if (sp) return jitterAt(sp, 1);
  return null;
}
function pickZombieType(t) {
  const sp = pickSpecial(t); if (sp) return sp;
  const r = Math.random();
  if (t >= ZOMBIES.fat.from && r < 0.07) return 'fat';
  if (t >= ZOMBIES.armored.from && r < 0.07 + Math.min(0.2, 0.08 + (t - ZOMBIES.armored.from) / 1500)) return 'armored';
  const runnerChance = t < ZOMBIES.runner.from ? 0 : Math.min(0.4, 0.12 + (t - ZOMBIES.runner.from) / 600);
  return Math.random() < runnerChance ? 'runner' : 'walker';
}
const FORM = { walker: 'walk', runner: 'run', armored: 'armored', fat: 'fat', hound: 'hound', screamer: 'screamer', spitter: 'spitter', brute: 'brute', riot: 'riot', warden: 'warden' };
function spawnZombie(forceType, at, crawl, ignoreCap) {
  if (!ignoreCap && aliveZombies() >= MAX_ENEMIES) return null;
  const t = G.t, type = forceType || pickZombieType(t);
  const pos = findSpawnPos(at); if (!pos) return null;
  const T = ZOMBIES[type];
  let form = FORM[type];
  if (type === 'walker' && (crawl || (crawl === undefined && Math.random() < 0.2))) form = 'crawl';   // 1 из 5 ходоков — ползун
  const z = { id: G.zId++, zombie: true, type, form, x: pos.x, y: floorAt(pos.x, pos.z, 0), z: pos.z, vy: 0, yaw: Math.random() * TAU, look: lookFor(type),
    hp: T.hp * (1 + t / HP_GROWTH), r: T.r, speed: T.speed * rnd(0.92, 1.08), scale: type === 'runner' ? 0.9 : 1,
    phase: Math.random() * 6, moving: true, flash: 0, kx: 0, kz: 0, dead: false, deadT: 0, fall: 0, atkT: 0, hurtT: 0, nod: 0,
    slideT: 0, side: 1, slowT: 0, slowMul: 1, stunT: 0, burnT: 0, bleedT: 0, dotT: 0 };
  if (MOB_INIT[type]) MOB_INIT[type](z);                                  // особые мобы: свои поля (щит, масть, запасы)
  z.mhp = z.hp; z.born = G.t; z.gait = Math.floor(Math.random() * 4); z.flank = Math.random() < 0.33 ? (Math.random() < 0.5 ? 1 : -1) * (0.9 + Math.random() * 0.5) : 0;   // v0.60: обходчики                                                           // начальное здоровье — для расчёта «перебора» урона (разлёт частей)
  zombies.push(z);
  return z;
}
function relocate(z) { const pos = findSpawnPos(); if (pos) { z.x = pos.x; z.z = pos.z; z.y = floorAt(pos.x, pos.z, 0); z.kx = z.kz = 0; } }
// Сетка зомби для быстрого поиска соседей (обновляется каждый кадр)
const ZG = 1.5, zgrid = new Map();
function zgridBuild() {
  zgrid.clear();
  for (const z of zombies) { if (z.dead) continue; const k = Math.floor(z.x / ZG) * 1000 + Math.floor(z.z / ZG); let a = zgrid.get(k); if (!a) zgrid.set(k, a = []); a.push(z); }
}
function forNear(x, z, fn, r = 1) {
  const gx = Math.floor(x / ZG), gz = Math.floor(z / ZG), n = Math.ceil(r / ZG);
  for (let i = gx - n; i <= gx + n; i++) for (let j = gz - n; j <= gz + n; j++) { const a = zgrid.get(i * 1000 + j); if (a) for (const o of a) if (fn(o) === false) return; }
}
function nearestZombie(x, z, range, except) {
  let best = null, bd = range * range;
  for (const o of zombies) { if (o.dead || (except && except.includes(o.id))) continue; const d = (o.x - x) ** 2 + (o.z - z) ** 2; if (d < bd) { bd = d; best = o; } }
  return best;
}
