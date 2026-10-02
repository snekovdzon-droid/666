'use strict';
/* ---------- v0.28: оружие ближнего боя. Карточка даёт лом или топор (одно на игрока), отдельная кнопка, удар дугой вперёд ---------- */
const MELEE = {
  crowbar: { name: 'Лом', desc: 'Широкий взмах вперёд: толпа в дуге отлетает на 5–6 клеток и оглушена. Урона немного' },
  axe:     { name: 'Топор', desc: 'Широкий взмах вперёд: слабых рубит насмерть, сильным срезает долю здоровья (боссам меньше)' },
};
const MELEE_IDS = Object.keys(MELEE);
const MELEE_UPS = {
  reach: { name: 'Длинный замах', max: 3 }, power: { name: 'Сила удара', max: 3 }, cool: { name: 'Быстрая рука', max: 4 },
  fx: { name: 'Эффект', max: 2 }, whirl: { name: 'Вихрь', max: 1 },
};
const MELEE_CD = 10, MELEE_REACH = 2.6, MELEE_ARC = 140 * Math.PI / 180;
const fmt1 = v => String(+v.toFixed(1)).replace('.', ',');
function meleeStat(p, lvOverride) {
  const lv = lvOverride || p.meleeLv || {}, id = p.melee, pw = lv.power || 0, fx = lv.fx || 0, dmg = (p.st ? p.st.dmg : 1) * rageMul(p);
  const S = { cd: Math.max(4, MELEE_CD - 1.5 * (lv.cool || 0)), reach: MELEE_REACH + 0.35 * (lv.reach || 0), arc: lv.whirl ? Math.PI * 2 : MELEE_ARC, barrel: 30 };
  if (id === 'crowbar') Object.assign(S, { push: 48 * (1 + 0.25 * pw), dmg: 10 * (1 + 0.3 * pw) * dmg, stun: 1.5 + 0.5 * fx });
  else Object.assign(S, { push: 8, dmg: 60 * (1 + 0.3 * pw) * dmg, frac: 0.35 + 0.08 * pw, bleed: fx ? 4 + 3 * (fx - 1) + 1 : 0 });
  return S;
}
function meleeKey(p) { return p.ctrl === 'keys2' ? ',' : (p.ctrl === 'pad' || (p.ctrl === 'all' && PAD.active)) ? 'R3' : IS_TOUCH ? 'УДАР' : 'Пробел'; }

/* ---- карточки ---- */
function meleeCardPool(p) {
  const out = [];
  if (!p.melee) { for (const id of MELEE_IDS) out.push({ type: 'melee', id }); return out; }
  const lv = p.meleeLv;
  for (const id in MELEE_UPS) {
    if ((lv[id] || 0) >= MELEE_UPS[id].max) continue;
    if (id === 'whirl' && !((lv.reach || 0) >= 1 && (lv.power || 0) >= 1 && (lv.cool || 0) >= 1)) continue;       // «Вихрь» — финал: сначала дальность, сила и скорость
    out.push({ type: 'meleeup', id });
  }
  return out;
}
function meleeCardHtml(p, ch, key) {
  if (ch.type === 'melee') return { cls: 'wpn', html: `<span class="tag">ОРУЖИЕ БЛИЖНЕГО БОЯ</span><b>${MELEE[ch.id].name}</b><span>${MELEE[ch.id].desc}</span><i>отдельная кнопка (${meleeKey(p)}) · раз в ${MELEE_CD} с · не занимает подсумок · ${key}</i>` };
  const id = ch.id, lv = (p.meleeLv[id] || 0), a = meleeStat(p), nl = Object.assign({}, p.meleeLv, { [id]: lv + 1 }), b = meleeStat(p, nl), crow = p.melee === 'crowbar';
  const txt = id === 'reach' ? `Дальность ${fmt1(a.reach)} → ${fmt1(b.reach)} клетки`
    : id === 'power' ? (crow ? `Отбрасывание +25%, урон +30%` : `Урон по сильным ${Math.round(a.frac * 100)}% → ${Math.round(b.frac * 100)}% здоровья`)
    : id === 'cool' ? `Перезарядка ${fmt1(a.cd)} → ${fmt1(b.cd)} с`
    : id === 'fx' ? (crow ? `Оглушение ${fmt1(a.stun)} → ${fmt1(b.stun)} с` : `Кровотечение у сильных: ${a.bleed ? a.bleed + ' → ' + b.bleed : b.bleed} с`)
    : 'Удар на 360° вокруг тебя вместо дуги вперёд';
  const nm = id === 'fx' ? (crow ? 'Оглушение' : 'Кровотечение') : MELEE_UPS[id].name;
  return { cls: 'wpn', html: `<span class="tag">${MELEE[p.melee].name.toUpperCase()}${id === 'whirl' ? ' · ФИНАЛ' : ''}</span><b>${nm}</b><span>${txt}</span><i>ур. ${lv} → ${lv + 1} из ${MELEE_UPS[id].max} · ${key}</i>` };
}
function meleePick(p, ch) {
  if (ch.type === 'melee') { p.melee = ch.id; p.meleeLv = { reach: 0, power: 0, cool: 0, fx: 0, whirl: 0 }; p.meleeCd = 3; toast(p, `${MELEE[ch.id].name}: ${meleeKey(p)}`, '#ffd890'); }
  else p.meleeLv[ch.id] = (p.meleeLv[ch.id] || 0) + 1;
}

/* ---- удар ---- */
function meleeDir(p, c, st) {
  if (c.auto && !c.aim) {                                                       // телефон и автоприцел: бьём в самую плотную группу вокруг
    let best = p.yaw, bn = 0;
    for (let k = 0; k < 16; k++) {
      const a = k * Math.PI / 8, fx = Math.sin(a), fz = Math.cos(a); let n = 0;
      forNear(p.x, p.z, z => { if (z.dead || Math.abs(z.y - p.y) > 1.3) return; const dx = z.x - p.x, dz = z.z - p.z, d = Math.hypot(dx, dz); if (d < st.reach && (dx * fx + dz * fz) / (d || 1) > Math.cos(st.arc / 2)) n++; }, st.reach + 1);
      if (n > bn) { bn = n; best = a; }
    }
    return best;
  }
  const A = aimPoint(p, c);                                                     // мышь или правый стик: берём прицел этого кадра (p.yaw обновляется позже и отстаёт на кадр)
  return A && A.pt ? Math.atan2(A.pt.x - p.x, A.pt.z - p.z) : p.yaw;
}
function updateMelee(p, c, dt) {
  if (!p.melee) return;
  if (p.meleeCd > 0) p.meleeCd -= dt;
  const sw = p.meleeSw;
  if (sw) {
    sw.t += dt;
    if (!sw.hit && sw.t >= 0.1) { sw.hit = true; meleeHit(p, sw); }
    if (sw.t >= sw.dur) { p.meleeSw = null; hideSwing(p); } else animSwing(p, sw);
  }
  if (c.melee && !p.meleeSw && p.meleeCd <= 0 && !p.down && G.state === 'play') {
    const st = meleeStat(p), dir = meleeDir(p, c, st); p.meleeCd = st.cd; p.meleeSw = { t: 0, dur: 0.3, hit: false, dir, st }; SFX.swing(); animSwing(p, p.meleeSw);
  }
}
function meleeStrike(p, z, st, dx, dz, d) {
  const boss = isBossZ(z), k = boss ? 0.15 : kresOf(z), fx = Math.sin(p.meleeSw ? p.meleeSw.dir : p.yaw), fz = Math.cos(p.meleeSw ? p.meleeSw.dir : p.yaw);
  let ux = dx / (d || 1) * 0.5 + fx * 0.5, uz = dz / (d || 1) * 0.5 + fz * 0.5; const ul = Math.hypot(ux, uz) || 1; ux /= ul; uz /= ul;
  const v = st.push * k * (1 - 0.3 * Math.min(1, d / st.reach));
  z.kx += ux * v; z.kz += uz * v;
  if (p.melee === 'crowbar') {
    if (!boss) z.stunT = Math.max(z.stunT || 0, st.stun * (k < 0.7 ? 0.5 : 1));
    dzBy(p, z, st.dmg, ux, uz, 0);
    if (L(p, 'so_domino')) { z.domT = 0.7; z.domLv = L(p, 'so_domino'); z.domOwner = p; z.domHit = [z.id]; }            // лом + «Домино» обреза: летящие сбивают остальных
  } else {
    if (DOG_WEAK[z.type]) dzBy(p, z, 1e9, ux, uz, 0.3, undefined, true);
    else {
      const frac = boss ? 0.04 : st.frac, dmg = Math.max(st.dmg, (z.maxHp || z.hp) * frac); dzBy(p, z, dmg, ux, uz, 0.2);
      if (st.bleed && !boss && !z.dead) { z.bleedT = Math.max(z.bleedT || 0, st.bleed); z.dotOwner = p; z.bleedDps = Math.max(z.bleedDps || 0, 8 * (p.st ? p.st.dmg : 1), (z.hp || 0) * 0.05); }
    }
  }
  blood(z.x, z.y + 0.5, z.z, ux, uz, 3);
}
function meleeHit(p, sw) {
  const st = sw.st, fx = Math.sin(sw.dir), fz = Math.cos(sw.dir), cosH = Math.cos(st.arc / 2), full = st.arc > 6.2; let n = 0;
  forNear(p.x, p.z, z => {
    if (z.dead || Math.abs(z.y - p.y) > 1.3) return;
    const dx = z.x - p.x, dz = z.z - p.z, d = Math.hypot(dx, dz); if (d > st.reach + z.r) return;
    if (!full && d > 0.3 && (dx * fx + dz * fz) / d < cosH) return;
    meleeStrike(p, z, st, dx, dz, d); n++;
  }, st.reach + 1);
  for (const E of EXPL) {                                                                 // бочки и баки тоже бьются — цепная реакция
    if (E.gone) continue; const dx = E.x - p.x, dz = E.z - p.z, d = Math.hypot(dx, dz);
    if (d < st.reach + 0.7 && (full || d < 0.4 || (dx * fx + dz * fz) / d > cosH)) { const pv = ATTR; ATTR = p; explDamage(E, st.barrel); ATTR = pv; }
  }
  for (let i = 0; i < 10; i++) { const a = sw.dir + (full ? rnd(-Math.PI, Math.PI) : rnd(-st.arc / 2, st.arc / 2)), r = rnd(0.8, st.reach); spawnP({ x: p.x + Math.sin(a) * r, y: p.y + rnd(0.1, 0.5), z: p.z + Math.cos(a) * r, vx: Math.sin(a) * rnd(1, 3), vy: rnd(0, 1), vz: Math.cos(a) * rnd(1, 3), s: 0.09, s1: 0.4, col: 0xcfc6b2, col1: 0x8a8272, life: 0.3 }); }
  if (n) { shake = Math.max(shake, Math.min(0.6, 0.2 + 0.03 * n)); SFX.impact(p.melee === 'crowbar' ? 'metal' : 'wood'); }
}

/* ---- визуал: оружие пролетает по дуге, на земле вспыхивает сектор удара ---- */
const MSW = new Map(), MARC = new THREE.RingGeometry(0.4, 1, 28, 1, -MELEE_ARC / 2, MELEE_ARC).rotateX(-Math.PI / 2), MFULL = new THREE.RingGeometry(0.4, 1, 40).rotateX(-Math.PI / 2);
function swingOf(p) {
  let s = MSW.get(p); if (s && s.melee === p.melee) return s; if (s) scene.remove(s.g);
  const g = new THREE.Group(), piv = new THREE.Group(); g.add(piv);
  const part = (c, x, y, z, w, h, l) => { const m = new THREE.Mesh(boxGeo, tuMat(c)); m.scale.set(w, h, l); m.position.set(x, y, z); m.castShadow = true; piv.add(m); return m; };
  if (p.melee === 'crowbar') { part(0x8a8e90, 0.85, 0.9, 0, 1.2, 0.07, 0.07); part(0x8a8e90, 1.45, 0.82, 0, 0.14, 0.2, 0.07); part(0xc8402a, 0.3, 0.9, 0, 0.3, 0.09, 0.09); }
  else { part(0x7a4e2a, 0.7, 0.9, 0, 1.0, 0.07, 0.07); part(0x9a9e9a, 1.12, 0.92, 0, 0.18, 0.2, 0.05); part(0xcfd2cf, 1.2, 0.92, 0, 0.1, 0.3, 0.04); }
  const am = new THREE.MeshBasicMaterial({ color: 0xf4ecd8, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }), arc = new THREE.Mesh(MARC, am), full = new THREE.Mesh(MFULL, am);
  arc.position.y = full.position.y = 0.06; g.add(arc, full); g.visible = false; scene.add(g);
  s = { g, piv, arc, full, am, melee: p.melee }; MSW.set(p, s); return s;
}
function animSwing(p, sw) {
  const s = swingOf(p), k = Math.min(1, sw.t / sw.dur), st = sw.st, whirl = st.arc > 6.2, al = sw.dir - Math.PI / 2;
  s.g.visible = true; s.g.position.set(p.x, p.y, p.z);
  s.arc.visible = !whirl; s.full.visible = whirl; const R = st.reach; s.arc.scale.set(R, 1, R); s.full.scale.set(R, 1, R); s.arc.rotation.y = al;
  s.am.opacity = 0.6 * (1 - k * 0.85) * Math.min(1, k / 0.1);
  const sweep = whirl ? -Math.PI * 2 * k : (st.arc / 2) * (1 - 2 * k);
  s.piv.rotation.y = al + sweep; s.piv.scale.set(R / MELEE_REACH, 1, R / MELEE_REACH); s.piv.visible = k < 0.9;
}
function hideSwing(p) { const s = MSW.get(p); if (s) s.g.visible = false; }
function meleeReset() { for (const s of MSW.values()) scene.remove(s.g); MSW.clear(); }
SFX.swing = () => { if (!soundOn()) return; noiseHit({ dur: 0.2, type: 'bandpass', freq: 800, q: 0.9, vol: 0.2, attack: 0.03, sweep: 1900 }); };

/* ---- иконки ---- */
PIX.crowbar = ['.ggg......', 'g...g.....', 'g....G....', '.....gG...', '......gG..', '.......gG.', '........gG', '.........r', '.........r', '..........'];
PIX.axe = ['...ggg....', '..gggGg...', '..ggGGg...', '...gnGg...', '....nn....', '....nn....', '...nn.....', '...nn.....', '..nn......', '..n.......'];
