'use strict';
/* ---------- 13б. Перки и ветки стволов: карточки на повышении уровня ---------- */
// Фильтр по стволу (решения автора): общий перк не выпадает, если ломает логику ствола
const PERK_BAN = { mag: ['shotgun', 'sawnoff', 'revolver', 'mg', 'crossbow'], pierce: ['revolver'], rate: ['sawnoff'], proj: ['crossbow'] };   // арбалету: магазин и «Лишний ствол» закрыты (болты считаются)   // «Бронебойные» револьверу закрыты: пробитие — у Магнума
// Потолок уровня по стволу: «Лишний ствол» у автомата, пулемёта и револьвера — 2 уровня (3 ствола)
const PERK_MAX = { proj: { rifle: 2, mg: 2, revolver: 2 } };
// Эти общие перки — про снаряжение и девайсы, появятся вместе с ними (батчи 5 и 7)
const PERK_LATER = new Set(['gr_rig']);   // девайсы — батч 7; «Разгрузка» гранаты (+2 гранаты) не нужна — подсумок общий
const perkMax = (p, u) => (PERK_MAX[u.id] && PERK_MAX[u.id][p.gun]) || u.max;
const branchesOf = p => BRANCHES[p.gun] || null;
const branchOf = p => { const B = branchesOf(p); return B && p.branch ? B.find(b => b.id === p.branch) : null; };
const subOf = p => { const b = branchOf(p); return b && b.sub && p.sub ? b.sub.find(x => x.id === p.sub) : null; };
const pathOf = p => subOf(p) || branchOf(p);                          // текущий путь (для финала): подпуть, если он есть
// перки пути: общие перки ветки (без sub) + перки выбранного подпути
const branchPerks = (gun, id, sub) => PERKS.filter(u => u.gun === gun && u.branch === id && (!u.sub || u.sub === sub));
// какие пути предлагает карточка-развилка: сначала ветки ствола, потом (у пулемёта) подпути после перка subAfter
function forkOptions(p) {
  const B = branchesOf(p); if (!B) return null;
  if (!p.branch) return B;
  const b = branchOf(p); return b && b.sub && !p.sub && L(p, b.subAfter) ? b.sub : null;
}
function perkAllowed(p, u) {
  if (L(p, u.id) >= perkMax(p, u)) return false;
  if (u.gun && u.gun !== p.gun) return false;
  if (u.branch && u.branch !== 'neutral' && u.branch !== p.branch) return false;   // перки чужой или ещё не выбранной ветки
  if (u.sub && u.sub !== p.sub) return false;                                      // перки подпути — после второй развилки
  if (u.item && !p.known[u.item]) return false;                    // перки предмета — только если такой уже находил
  if (u.needItem && !p.known[u.needItem]) return false;
  if (PERK_LATER.has(u.id)) return false;
  if (PERK_BAN[u.id] && PERK_BAN[u.id].includes(p.gun)) return false;
  if (u.coop && players.length < 2) return false;
  if (u.excl && L(p, u.excl)) return false;
  if (u.need && !L(p, u.need)) return false;                       // арбалет: следующий наконечник — после первого своего типа
  return true;
}
// Финал ветки доступен, когда все перки ветки взяты хотя бы на 1 уровень
function finaleReady(p) {
  const b = branchOf(p); if (!b || (b.sub && !p.sub)) return null;
  const path = pathOf(p); if (p.evo[path.fin.id]) return null;
  return branchPerks(p.gun, b.id, p.sub).every(u => L(p, u.id) > 0) ? path : null;
}
// Полный рандом (просьба автора): все доступные карточки равновероятны, без весов и групп.
// Пути — тоже обычные карточки: «Путь: Подствольник» и т. п.; не взял — путь может выпасть на следующих уровнях.
function rollChoices(p) {
  const pool = [], F = forkOptions(p);
  if (F) for (const b of F) pool.push({ type: 'branch', b, sub: !!p.branch });
  const fin = finaleReady(p); if (fin) pool.push({ type: 'finale', b: fin });
  for (const u of PERKS) if (perkAllowed(p, u)) pool.push({ type: 'perk', perk: u });
  for (const id of freeAttach(p)) pool.push({ type: 'att', id });
  for (const id of DEV_IDS) { if ((id === 'dog' && devLv(p, 'drone')) || (id === 'drone' && devLv(p, 'dog'))) continue; const lv = devLv(p, id); if (lv ? lv < devMaxOf(id) : devCount(p) < devSlotsOf(p)) pool.push({ type: 'dev', id }); }
  for (const id in p.known) if (p.known[id] < ITEM_MAX_LV) pool.push({ type: 'itemlv', id });
  for (const id of ITEM_IDS) if (!p.known[id]) pool.push({ type: 'newitem', id });
  for (const c2 of meleeCardPool(p)) pool.push(c2);                                               // оружие ближнего боя и его улучшения             // новый предмет: открывает тип и даёт 1 заряд
  const out = [];
  // модули ствола (ЛЦУ, фонарь, удлинённый ствол) выпадают заметно чаще остальных карточек: ~30% на уровень, после пропусков шанс растёт, после двух подряд — наверняка
  const mods = pool.filter(c => c.type === 'att');
  if (mods.length && Math.random() < 0.3 + 0.35 * (p.modMiss || 0)) { const c = mods[Math.floor(Math.random() * mods.length)]; out.push(pool.splice(pool.indexOf(c), 1)[0]); p.modMiss = 0; }
  else if (mods.length) p.modMiss = (p.modMiss || 0) + 1;
  while (out.length < 3 && pool.length) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }   // модуль не всегда первым
  maybeCurse(p, out);                                                                  // шанс ~8%: проклятие заменяет одну из трёх карточек
  if (!out.length) out.push({ type: 'heal' });
  return out;
}
function givePerk(p, u) {
  if (u.branch && u.branch !== 'neutral' && !p.branch) p.branch = u.branch;   // (отладка) перк ветки сразу выбирает путь
  if (u.sub && !p.sub) p.sub = u.sub;
  if (u.apply) u.apply(p); p.lv[u.id] = L(p, u.id) + 1; p.ammo = Math.min(p.ammo, wStat(p).mag);
}
/* ---- Окно выбора ---- */
const LV = { choices: [], sel: 0, readyAt: 0, fork: false };
function cardHTML(p, ch, i) {
  const key = `${i + 1}`;
  if (ch.type === 'curse') return curseCardHtml(ch, key);
  if (ch.type === 'perk') {
    const u = ch.perk, lv = L(p, u.id), br = u.branch && (u.sub ? subOf(p) : branchOf(p));
    const tag = u.br === 'wpn' ? `ОРУЖИЕ · ${WEAPONS[u.gun].name}${u.branch === 'neutral' ? ' · любой путь' : br ? ' · ' + br.name : ''}` : u.br === 'item' ? `ПРЕДМЕТ · ${ITEMS[u.item].name}` : 'ОБЩЕЕ';
    return { cls: u.br, html: `<span class="tag">${tag}</span><b>${u.name}</b><span>${u.desc}</span><i>ур. ${lv} → ${lv + 1} из ${perkMax(p, u)} · ${key}</i>` };
  }
  if (ch.type === 'fork') {
    const B = forkOptions(p) || [], b = branchOf(p);
    return { cls: 'fork', html: `<span class="tag">${ch.sub ? `ПУТЬ «${b.name}» · ${WEAPONS[p.gun].name}` : `ПУТЬ СТВОЛА · ${WEAPONS[p.gun].name}`}</span><b>${ch.sub ? 'Выбрать калибр' : 'Выбрать путь'}</b><span>${B.map(b => b.name).join(' · ')}. Выбор закроет остальные. Уровень не тратится.</span><i>${key}</i>` };
  }
  if (ch.type === 'branch') {
    const b = ch.b, main = branchOf(p), isSub = ch.sub;
    const perks = isSub ? PERKS.filter(u => u.gun === p.gun && u.branch === main.id && u.sub === b.id) : branchPerks(p.gun, b.id);
    const fin = b.sub ? `дальше: ${b.sub.map(x => x.name).join(' / ')}` : `финал: ${b.fin.name}`;
    return { cls: 'wpn', html: `<span class="tag">${isSub ? `ПОДПУТЬ · ${main.name}` : `ПУТЬ · ${WEAPONS[p.gun].name}`}</span><b>${b.name}</b><span>${b.desc}${b.key ? `<br><b style="font-size:inherit">Сразу: ${PERK[b.key].name}</b> — ${PERK[b.key].desc}` : ''}</span><i>${perks.filter(u => u.id !== b.key).map(u => u.name).join(' · ')}<br>${fin} · ${key}</i>` };
  }
  if (ch.type === 'finale') {
    const b = ch.b;
    return { cls: 'evo', html: `<span class="tag">ФИНАЛ ПУТИ · ${b.name}</span><b>${b.fin.name}</b><span>${b.fin.desc}</span><i>${key}</i>` };
  }
  if (ch.type === 'melee' || ch.type === 'meleeup') return meleeCardHtml(p, ch, key);
  if (ch.type === 'newitem') return { cls: 'item', html: `<span class="tag">НОВЫЙ ПРЕДМЕТ</span><b>${ITEMS[ch.id].name}</b><span>${ITEMS[ch.id].desc}</span><i>+1 заряд · подсумок ${pouchN(p)}/${pouchCap(p)} · дальше ищи на карте · ${key}</i>` };
  if (ch.type === 'itemlv') { const lv = itemLv(p, ch.id); return { cls: 'item', html: `<span class="tag">ПРЕДМЕТ</span><b>${ITEMS[ch.id].name}</b><span>${itemLvText(ch.id, lv)}</span><i>ур. ${lv} → ${lv + 1} из ${ITEM_MAX_LV} · ${key}</i>` }; }
  if (ch.type === 'att') return { cls: 'att', html: `<span class="tag">МОДУЛЬ · ${WEAPONS[p.gun].name}</span><b>${ATTACH[ch.id].name}</b><span>${ATTACH[ch.id].desc}</span><i>ставится сразу · ${key}</i>` };
  if (ch.type === 'dev') { const lv = devLv(p, ch.id); return { cls: 'dev', html: `<span class="tag">ДЕВАЙС${lv ? '' : (ch.id === 'dog' || ch.id === 'drone') ? ' · компаньон (только один)' : ' · новый'}</span><b>${DEVICES[ch.id].name}</b><span>${devCardText(ch.id, lv)}</span><i>ур. ${lv + 1} из ${DEV_MAX} · слотов ${devCount(p) + (lv ? 0 : 1)}/${devSlotsOf(p)} · ${key}</i>` }; }
  if (ch.type === 'back') return { cls: 'gen', html: `<span class="tag">НАЗАД</span><b>Пока не выбирать</b><span>Вернуться к обычным карточкам</span><i>${key}</i>` };
  return { cls: 'gen', html: `<span class="tag">ОБЩЕЕ</span><b>Перевязка</b><span>Всё прокачано. Лечит 2 сердца.</span><i>${key}</i>` };
}
function renderCards(p, title) {
  $('lvlTitle').innerHTML = (players.length > 1 ? `<span style="color:${PLAYER_CSS[p.idx]}">Игрок ${p.idx + 1}</span>: ` : '') + title;
  $('lvlCards').innerHTML = '';
  LV.choices.forEach((ch, i) => {
    const c = cardView(p, ch, i), b = document.createElement('button');
    b.className = 'pcard ' + c.cls; b.innerHTML = c.html;
    b.addEventListener('click', e => { e.stopPropagation(); pickCard(i); });
    b.addEventListener('mouseenter', () => { LV.sel = i; lvMark(); });
    $('lvlCards').appendChild(b);
  });
  $('lvlBuild').innerHTML = buildText(p);
  LV.sel = 0; lvMark(); $('lvlUp').style.display = 'flex';
}
function openLevelUp() {
  if (G.state !== 'levelup') SFX.level();
  G.state = 'levelup'; mouse.down = false;
  const p = players[G.pickQueue[0]];
  LV.choices = rollChoices(p); LV.fork = false; LV.readyAt = performance.now() + 350;
  renderCards(p, `новый уровень ${G.level}!`);
}
function lvMark() { $('lvlCards').querySelectorAll('.pcard').forEach((b, i) => b.classList.toggle('sel', i === LV.sel)); }
function pickCard(i) {
  if (G.state !== 'levelup' || performance.now() < LV.readyAt) return;
  const ch = LV.choices[i]; if (!ch) return;
  const p = players[G.pickQueue[0]];
  SFX.click();
  if (ch.type === 'fork') {                                        // развилка: показываем пути, уровень не тратится
    LV.saved = LV.choices; LV.choices = [...forkOptions(p).map(b => ({ type: 'branch', b, sub: ch.sub })), { type: 'back' }]; LV.readyAt = performance.now() + 250;
    renderCards(p, ch.sub ? `калибр для пути «${branchOf(p).name}»` : `путь для ствола «${WEAPONS[p.gun].name}»`); return;
  }
  if (ch.type === 'back') { LV.choices = LV.saved; renderCards(p, `новый уровень ${G.level}!`); return; }
  if (ch.type === 'branch') {                                      // путь выбран — сразу новые карточки уже с перками пути
    if (ch.sub) p.sub = ch.b.id; else p.branch = ch.b.id;
    if (ch.b.key && !L(p, ch.b.key)) givePerk(p, PERK[ch.b.key]);   // главный перк пути — сразу
    SFX.level();                                                    // путь выбран — уровень потрачен
  }
  else if (ch.type === 'perk') givePerk(p, ch.perk);
  else if (ch.type === 'curse') applyCurse(p, ch.id);
  else if (ch.type === 'melee' || ch.type === 'meleeup') meleePick(p, ch);
  else if (ch.type === 'newitem') { p.known[ch.id] = 1; if (giveItem(p, ch.id)) toast(p, 'Новый предмет: ' + ITEMS[ch.id].name, '#7cc0ff'); else toast(p, 'Подсумок полон — тип открыт, заряды ищи на карте', '#ffb080'); }
  else if (ch.type === 'itemlv') p.known[ch.id] = itemLv(p, ch.id) + 1;      // уровень найденного предмета
  else if (ch.type === 'dev') giveDevice(p, ch.id);
  else if (ch.type === 'att') giveAttach(p, ch.id);                          // девайс: новый в слот или +1 уровень
  else if (ch.type === 'finale') { p.evo[ch.b.fin.id] = true; SFX.level(); for (let k = 0; k < 24; k++) spawnP({ x: p.x, y: p.y + 0.8, z: p.z, vx: rnd(-2, 2), vy: rnd(1, 4), vz: rnd(-2, 2), s: 0.08, s1: 0.01, col: 0xffd76a, glow: true, life: 0.9, drag: 0.95 }); }
  else p.hp = Math.min(p.maxHp, p.hp + 2);
  G.pickQueue.shift();
  if (G.pickQueue.length) openLevelUp(); else { $('lvlUp').style.display = 'none'; G.state = 'play'; }
}
function lvKey(code) {
  const n = LV.choices.length;
  if (/^Digit[1-4]$/.test(code)) pickCard(+code.slice(5) - 1);
  else if (code === 'ArrowRight' || code === 'KeyD' || code === 'ArrowDown') { LV.sel = (LV.sel + 1) % n; lvMark(); }
  else if (code === 'ArrowLeft' || code === 'KeyA' || code === 'ArrowUp') { LV.sel = (LV.sel + n - 1) % n; lvMark(); }
  else if (code === 'Enter' || code === 'Space' || code === 'NumpadEnter') pickCard(LV.sel);
}
// Путь, финал и взятые перки игрока (в окне уровня и на паузе)
function buildText(p) {
  const b = branchOf(p), sb = subOf(p), path = pathOf(p);
  const head = b ? `Путь: <span class="wpn">${b.name}${sb ? ' → ' + sb.name : ''}</span>${path.fin && p.evo[path.fin.id] ? ` · <span class="evo">★ ${path.fin.name}</span>` : ''}` : (branchesOf(p) ? 'Путь ствола ещё не выбран' : '');
  const got = PERKS.filter(u => L(p, u.id)).map(u => `<span class="${u.br}">${u.name}${perkMax(p, u) > 1 ? ' ' + L(p, u.id) : ''}</span>`);
  return [head, got.length ? 'Взято: ' + got.join(' · ') : ''].filter(Boolean).join('<br>');
}
/* ---- Эффекты перков, которым нужен свой код ---- */
// Огонь не складывается: повторный поджог только продлевает. gen 1 — огонь от соседа, дальше не идёт
function setBurn(z, t, dps, spread, gen = 0, slow = false) {
  if (z.dead) return;
  if (!(z.burnT > 0)) { z.burnGen = gen; z.burnSpread = !!spread && gen === 0; z.burnSlow = slow; z.burnDps = dps; }
  else { if (gen < z.burnGen) z.burnGen = gen; if (spread && gen === 0) z.burnSpread = true; if (slow) z.burnSlow = true; z.burnDps = Math.max(z.burnDps, dps); }
  z.burnT = Math.max(z.burnT || 0, t); if (gen === 0) z.dotOwner = ATTR || LASTOWN || null;
}
// «Пожар»: горящий зомби поджигает соседей вплотную, у них вдвое слабее и короче, и они дальше огонь не передают
function burnSpread(z) {
  if (!z.burnSpread || z.burnGen !== 0) return;
  forNear(z.x, z.z, n => { if (n !== z && !n.dead && !(n.burnT > 0) && (n.x - z.x) ** 2 + (n.z - z.z) ** 2 < 0.64) { setBurn(n, z.burnT * 0.5, z.burnDps * 0.5, false, 1, z.burnSlow); n.dotOwner = z.dotOwner; } });
}
// «Адреналин» и «Кровавая баня» (обрез, Берсерк): убийства ближе 1,5 клетки
function onCloseKill(p) {
  if (L(p, 'so_adren')) p.adrenT = 1.5;
  if (L(p, 'so_blood') && ++p.pbKills % 50 === 0 && p.hp < p.maxHp) {
    p.hp++; SFX.pickup();
    for (let k = 0; k < 10; k++) spawnP({ x: p.x, y: p.y + 1, z: p.z, vx: rnd(-1, 1), vy: rnd(1, 2.5), vz: rnd(-1, 1), s: 0.08, s1: 0.01, col: 0xe04a3a, glow: true, life: 0.8, drag: 0.95 });
  }
}
/* ---- Ударная волна обреза: конус ±35°, 3,5 клетки; толкает всех в конусе, даже если дробь не попала ----
   Сила падает с расстоянием; «Мощный заряд» ×1,4 за уровень; «Хватка» вдвое слабее; дуплет ×1,5; тяжёлые летят слабее, босс стоит.
   «Домино»: летящий зомби передаёт толчок и урон тем, на кого налетел. */
const SAW_KRES = { fat: 0.45, armored: 0.6, riot: 0.45, brute: 0.3, screamer: 0.8, spitter: 0.8 };
const kresOf = z => z.kres !== undefined ? Math.max(z.kres, SAW_KRES[z.type] || 0) : (SAW_KRES[z.type] || 1);
function sawBlast(p, dir, use) {
  const mz = muzzleOf(p), R = 3.5, half = 0.61, fx = Math.sin(dir), fz = Math.cos(dir);
  const mult = Math.pow(1.4, L(p, 'so_charge')) * (L(p, 'so_grip') ? 0.5 : 1) * (use === 2 ? 1.5 : 1), dom = L(p, 'so_domino');
  let n = 0;
  forNear(mz.x, mz.z, z => {
    if (z.dead || z.swell || z.boss || z.type === 'warden' || Math.abs(z.y - p.y) > 1.2) return;
    const dx = z.x - mz.x, dz = z.z - mz.z, d = Math.hypot(dx, dz); if (d > R + z.r || d < 0.01) return;
    const cs = (dx * fx + dz * fz) / d; if (cs < Math.cos(half)) return;
    const k = kresOf(z), v = 14 * (1 - 0.6 * Math.min(1, d / R)) * mult * k;
    let ux = dx / d * 0.5 + fx * 0.5, uz = dz / d * 0.5 + fz * 0.5; const ul = Math.hypot(ux, uz) || 1; ux /= ul; uz /= ul;
    z.kx += ux * v; z.kz += uz * v;
    z.stunT = Math.max(z.stunT || 0, p.evo.so_liveram ? 1 : k < 0.7 ? 0.2 : 0.35);
    if (dom) { z.domT = 0.7; z.domLv = dom; z.domOwner = p; z.domHit = [z.id]; }
    n++;
  }, R + 1);
  for (let i = 0; i < 8; i++) { const a = dir + rnd(-half, half), r = rnd(0.6, R); spawnP({ x: mz.x + Math.sin(a) * r, y: p.y + rnd(0.1, 0.6), z: mz.z + Math.cos(a) * r, vx: Math.sin(a) * rnd(2, 5), vy: rnd(0, 1), vz: Math.cos(a) * rnd(2, 5), s: 0.1, s1: 0.5, col: 0xcfc6b2, col1: 0x8a8272, life: 0.35 }); }
  if (n > 3) shake = Math.max(shake, 0.25);
}
function dominoStep(z, dt) {
  z.domT -= dt;
  const sp = Math.hypot(z.kx, z.kz); if (sp < 5) return;
  const lv = z.domLv, own = z.domOwner;
  forNear(z.x, z.z, n => {
    if (n === z || n.dead || n.boss || n.type === 'warden' || Math.abs(n.y - z.y) > 0.6 || z.domHit.includes(n.id)) return;
    const dx = n.x - z.x, dz = n.z - z.z, d = Math.hypot(dx, dz); if (d > (z.r + n.r) * 1.2) return;
    z.domHit.push(n.id); const share = (lv >= 2 ? 1 : 0.6) * kresOf(n);
    n.kx += z.kx * share; n.kz += z.kz * share; z.kx *= 0.75; z.kz *= 0.75;
    n.domT = 0.5; n.domLv = lv; n.domOwner = own; n.domHit = z.domHit;
    if (lv >= 2) n.stunT = Math.max(n.stunT || 0, 0.4);
    dzBy(own, n, (lv >= 2 ? 20 : 10) * (own && own.st ? own.st.dmg : 1), dx / (d || 1), dz / (d || 1), 0);
  }, z.r + 1.4);
}
// «Таран» (обрез): пока летишь от отдачи — сбиваешь и ранишь зомби позади
function updateRam(p, dt) {
  if (!(p.ramT > 0)) return;
  p.ramT -= dt;
  const lv = L(p, 'so_ram'), evo = p.evo.so_liveram;
  if (!lv && !evo) return;
  forNear(p.x, p.z, z => {
    if (z.dead || (z.ramT || 0) > G.t || Math.abs(z.y - p.y) > 0.6) return;
    const dx = z.x - p.x, dz = z.z - p.z, d = Math.hypot(dx, dz);
    if (d > p.r + z.r + 0.25) return;
    z.ramT = G.t + 0.4;
    dzBy(p, z, (12 * lv + (evo ? 40 : 0)) * p.st.dmg, dx / (d || 1), dz / (d || 1), 0.9);
    if (evo) z.stunT = Math.max(z.stunT || 0, 1);
  });
}

/* ---------- 13в. Предметы (этап 5, часть 1): подсумок, предмет в руке, бросок/установка, ящики, предметы на земле ----------
   «Умею» и «несу» раздельно: p.known[id] — уровень типа (с первой находки — 1, карточки поднимают до 5),
   p.pouch[id] — сколько зарядов несёшь. Подсумок общий: 2 заряда, «Расширенный подсумок» — 4 и 6, Техник +2, «Разгрузка» ПП +2.
   Предмет берётся в руку (ПК 1–4, геймпад — крестовина, телефон — кнопки), применяется огнём, после применения — снова ствол. */
const ITEM_VIS = {
  grenade: { muz: 0.1,  parts: [[0x4a5a30, 0, 0, 0.08, 0.09, 0.11, 0.09], [0x8a8a80, 0, 0.07, 0.08, 0.03, 0.03, 0.03], [0x8a8a80, 0.045, 0.04, 0.08, 0.02, 0.06, 0.02]] },
  molotov: { muz: 0.14, parts: [[0x5a7a3a, 0, 0, 0.08, 0.07, 0.15, 0.07], [0x6a5a4a, 0, 0.1, 0.08, 0.035, 0.06, 0.035], [0xe8d8b0, 0, 0.14, 0.08, 0.025, 0.03, 0.025]] },
  turret:  { muz: 0.3,  parts: [[0x5a5e56, 0, -0.02, 0.1, 0.17, 0.13, 0.19], [0x2a2a2a, 0, 0.04, 0.24, 0.035, 0.035, 0.16], [0x3a3c38, 0, -0.1, 0.1, 0.05, 0.08, 0.05]] },
  wire:    { muz: 0.2,  parts: [[0x9a9a92, 0, 0, 0.1, 0.2, 0.13, 0.13], [0x6a6a62, 0, 0, 0.1, 0.22, 0.04, 0.15], [0x5a4a36, 0, -0.08, 0.1, 0.04, 0.1, 0.04]] },
};
const ITEM_SHORT = { grenade: 'ГРАН', molotov: 'МОЛОТ', turret: 'ТУРЕЛЬ', wire: 'КОЛЮЧ' };
const pouchCap = p => 2 + 2 * L(p, 'pouch') + (p.pouchBonus || 0) + 2 * L(p, 'smg_rig');
const pouchN = p => Object.values(p.pouch).reduce((a, b) => a + b, 0);
const itemLv = (p, id) => p.known[id] || 1;
const itemStat = (p, id) => ITEMS[id].stat(itemLv(p, id));
const slotTypes = p => p.slots.filter(id => p.pouch[id] > 0);           // слоты 1–4 — типы, которые сейчас в подсумке
function toast(p, txt, col = '#ffe38a') { p.msg = txt; p.msgCol = col; p.msgT = 2.2; }
// Положить заряд в подсумок: false — места нет. Первая находка типа — «умею» на 1-м уровне
// Какие предметы может выдать ящик: только уже открытые карточкой (pref — предпочтительные из них). Пока ничего не открыто — первая находка открывает тип
function itemPool(p, pref) {
  const kn = ITEM_IDS.filter(i => p.known[i]);
  if (!kn.length) return pref && pref.length ? pref : ITEM_IDS;
  const pk = pref ? kn.filter(i => pref.includes(i)) : kn; return pk.length ? pk : kn;
}
function giveItem(p, id) {
  if (pouchN(p) >= pouchCap(p)) return false;
  if (!p.known[id]) { p.known[id] = 1; toast(p, 'Новый предмет: ' + ITEMS[id].name, '#7cc0ff'); }
  p.pouch[id] = (p.pouch[id] || 0) + 1;
  if (!p.slots.includes(id)) p.slots.push(id);
  return true;
}
function takeCharge(p, id) { if (!(p.pouch[id] > 0)) return false; p.pouch[id]--; if (!p.pouch[id]) { p.slots = p.slots.filter(s => s !== id); if (p.hand === id) p.hand = null; } return true; }

/* ---- Предмет в руке: вызывается из updatePlayerWeapon; true — ствол в этом кадре не работает ---- */
function updateHand(p, c, A, fire, dt) {
  if (p.itemCool > 0) p.itemCool -= dt;
  if (c.swap && !trySwap(p) && !tryGate(p) && c.back && !p.hand && p.slots.length > 4) { p.slots.push(p.slots.shift()); SFX.click(); }   // геймпад: Y без дела — листает слоты (5-й и 6-й на крестовину)
  if (c.slot >= 0) {                                                   // нажали слот: взять в руку / убрать
    const id = slotTypes(p)[c.slot];
    if (id && p.hand !== id) { if (p.fuel != null) endCanister(p); p.hand = id; p.itemCool = Math.max(p.itemCool || 0, 0.15); SFX.click(); }
    else if (p.hand) { if (p.hand === 'canister' && igniteGasAt(p.x, p.z, 1.1)) toast(p, 'Подожжено!', '#ffb040'); if (p.fuel != null) endCanister(p); p.hand = null; SFX.click(); }   // та же кнопка у канистры — спичка
  }
  if (!p.hand) { if (p.fuel != null) endCanister(p); return false; }
  const pouring = p.hand === 'canister' && p.fuel != null;            // канистра уже льётся — заряд потрачен
  if (!pouring && !(p.pouch[p.hand] > 0)) { p.hand = null; return false; }
  p.firing = false;
  if (c.reload || c.back) {                                            // R / Y — обратно к стволу (канистра: спичка под ноги)
    if (p.hand === 'canister' && igniteGasAt(p.x, p.z, 1.1)) { SFX.click(); toast(p, 'Подожжено!', '#ffb040'); }
    if (p.hand === 'canister') endCanister(p); p.hand = null; return true;
  }
  if (p.hand === 'canister') { if ((fire || (c.auto && !c.manual && c.move > 0.2)) && !(p.itemCool > 0)) pourGas(p, dt); return true; }   // зажал огонь — льёшь (телефон: льёшь, пока идёшь)
  const place = !ITEMS[p.hand].throw && p.hand !== 'canister' && c.auto && !c.manual;   // телефон / без мыши: ставится и применяется сразу, не ждёт цели
  if ((fire || place) && !(p.itemCool > 0)) { useItem(p, p.hand, c, A); p.hand = null; p.cool = Math.max(p.cool, 0.25); }
  return true;
}
// Куда бросить: мышью — в точку прицела, иначе — в самую плотную кучу зомби в пределах броска
function densestTarget(p, range) {
  const cand = []; forNear(p.x, p.z, z => { if (!z.dead && !z.swell && Math.abs(z.y - p.y) < 2 && Math.hypot(z.x - p.x, z.z - p.z) < range) cand.push(z); }, range);
  let best = null, bn = -1;
  for (const a of cand) { let n = 0; for (const b of cand) if ((a.x - b.x) ** 2 + (a.z - b.z) ** 2 < 2.25) n++; if (n > bn) { bn = n; best = a; } }
  return best;
}
function throwPoint(p, c, A, range) {
  let tx, ty, tz;
  if (!c.auto && A.pt) { tx = A.pt.x; tz = A.pt.z; ty = Math.max(0, A.pt.y - 0.6); }
  else { const z = densestTarget(p, range); if (z) { tx = z.x; tz = z.z; ty = z.y; } else { tx = p.x + Math.sin(p.yaw) * 4; tz = p.z + Math.cos(p.yaw) * 4; ty = floorAt(tx, tz, p.y + 0.5); } }
  const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
  if (d > range) { tx = p.x + dx / d * range; tz = p.z + dz / d * range; ty = floorAt(tx, tz, p.y + 0.5); }
  return { x: clamp(tx, 0.6, MAP - 0.6), y: ty, z: clamp(tz, 0.6, MAP - 0.6) };
}
function useItem(p, id, c, A) {
  if (!takeCharge(p, id)) return;
  const S = itemStat(p, id), nimble = L(p, 'nimble') > 0;
  rumble(p, 0.4, 80);
  if (ITEMS[id].throw) {
    const t = throwPoint(p, c, A, S.range * (nimble ? 1.3 : 1)), mz = muzzleOf(p), d = Math.hypot(t.x - mz.x, t.z - mz.z);
    THROWN.push({ id, owner: p, S, x0: mz.x, y0: mz.y, z0: mz.z, x1: t.x, y1: t.y, z1: t.z, x: mz.x, y: mz.y, z: mz.z, t: 0, dur: (0.35 + d * 0.06) * (nimble ? 0.75 : 1), arc: 0.8 + d * 0.12 });
    SFX.throwIt();
  } else if (id === 'turret') {
    let x = p.x + Math.sin(p.yaw) * 1.1, z = p.z + Math.cos(p.yaw) * 1.1;
    if (blocked(x, z, p.y, 0.2)) { x = p.x; z = p.z; }
    placeTurret(p, x, floorAt(x, z, p.y + 0.3), z, S);
  } else if (id === 'wire') placeWire(p, S);
  else if (!useItem2(p, id, S)) { p.pouch[id] = (p.pouch[id] || 0) + 1; if (!p.slots.includes(id)) p.slots.push(id); }   // не применился — заряд обратно
}

/* ---- Броски: граната и молотов летят дугой ---- */
const THROWN = [], TIMERS = [];
function later(t, fn) { TIMERS.push({ t, fn }); }
function updateThrown(dt) {
  for (let i = TIMERS.length - 1; i >= 0; i--) if ((TIMERS[i].t -= dt) <= 0) { const f = TIMERS[i].fn; TIMERS.splice(i, 1); f(); }
  for (let i = THROWN.length - 1; i >= 0; i--) {
    const o = THROWN[i]; o.t += dt;
    let k = Math.min(1, o.t / o.dur);
    o.x = o.x0 + (o.x1 - o.x0) * k; o.z = o.z0 + (o.z1 - o.z0) * k; o.y = o.y0 + (o.y1 - o.y0) * k + Math.sin(k * Math.PI) * o.arc;
    if (k < 1 && o.id === 'grenade' && L(o.owner, 'gr_sticky') && k > 0.15) {          // «Липучка»
      const z = nearestZombie(o.x, o.z, 0.5); if (z && Math.abs(z.y + 0.6 - o.y) < 1) { o.x1 = z.x; o.z1 = z.z; o.y1 = z.y + 0.3; k = 1; }
    }
    if (k < 1) {                                                                         // полёт: сам предмет и след
      spawnP({ x: o.x, y: o.y, z: o.z, s: 0.13, col: ITEM_VIS[o.id].parts[0][0], life: 0.04, ry: o.t * 12, rx: o.t * 9 });
      if (o.id === 'smoke' && Math.random() < 0.5) spawnP({ x: o.x, y: o.y, z: o.z, vy: 0.2, s: 0.08, s1: 0.25, col: 0xb4b2ac, life: 0.5, drag: 0.95 });
      if (o.id === 'molotov') spawnP({ x: o.x, y: o.y + 0.08, z: o.z, s: 0.08, s1: 0.02, col: 0xffc040, col1: 0xd03010, glow: true, life: 0.2, vy: 0.5 });
      continue;
    }
    THROWN.splice(i, 1);
    const own = o.owner, S = o.S, x = o.x1, y = o.y1, z = o.z1;
    if (o.id === 'grenade') {
      explode(x, y, z, S.dmg * own.st.dmg, S.R, { hurts: true, owner: own, stun: L(own, 'gr_stun') ? 1.5 : 0 }); scorch(x, z, S.R * 0.45);
      shake = Math.max(shake, 0.2);
      if (L(own, 'gr_cluster')) for (let j = 0; j < 3; j++) {                       // «Кассетная»
        const a = Math.random() * TAU, r = S.R * rnd(0.7, 1.2), cx = x + Math.cos(a) * r, cz = z + Math.sin(a) * r;
        later(0.2 + j * 0.1, () => explode(cx, floorAt(cx, cz, y + 0.5), cz, S.dmg * 0.4 * own.st.dmg, S.R * 0.6, { hurts: true, owner: own }));
      }
    } else if (o.id !== 'molotov') landThrown2(o, x, y, z);
    else { addPool(own, x, y, z); SFX.glass(); for (let j = 0; j < 8; j++) spawnP({ x, y: y + 0.2, z, vx: rnd(-2, 2), vy: rnd(1, 3), vz: rnd(-2, 2), g: 14, s: 0.05, col: 0x9fd3e0, life: 0.6 }); }
  }
}
/* ---- Лужа молотова: огонь с общим светом (fires в 31_props), жжёт зомби и игроков (кроме «Огнеупорного костюма») ---- */
const POOLS = [];
function addPool(own, x, y, z) {
  const S = itemStat(own, 'molotov'), dur = S.dur * (L(own, 'mo_thick') ? 1.5 : 1);
  const f = { x, y, z, s: 1.2, R: S.R * 0.85, acc: 0, seed: Math.random() * 10 };
  fires.push(f); scorch(x, z, S.R * 0.9);
  POOLS.push({ f, x, y, z, R0: S.R, R: S.R, t: 0, dur, dps: S.dps * own.st.dmg, tick: 0, owner: own, grow: !!L(own, 'mo_spread'), tar: !!L(own, 'mo_tar'), ignite: !!L(own, 'mo_ignite') });
}
function updatePools(dt) {
  for (let i = POOLS.length - 1; i >= 0; i--) {
    const P = POOLS[i]; P.t += dt; P.tick -= dt;
    if (P.t >= P.dur) { POOLS.splice(i, 1); const k = fires.indexOf(P.f); if (k >= 0) fires.splice(k, 1); continue; }
    if (P.grow) { P.R = P.R0 * (1 + 0.4 * P.t / P.dur); P.f.R = P.R * 0.85; }                 // «Растекание»
    if (P.tar) forNear(P.x, P.z, z => { if (!z.dead && Math.abs(z.y - P.y) < 0.8 && (z.x - P.x) ** 2 + (z.z - P.z) ** 2 < P.R * P.R) { z.slowT = 0.3; z.slowMul = Math.min(z.slowMul || 1, 0.5); } }, P.R + 1);   // «Смола»
    if (P.tick > 0) continue;
    P.tick = 0.25;
    forNear(P.x, P.z, z => {
      if (z.dead || Math.abs(z.y - P.y) > 0.8 || (z.x - P.x) ** 2 + (z.z - P.z) ** 2 >= P.R * P.R) return;
      dzBy(P.owner, z, P.dps * 0.25, 0, 0, 0);
      if (P.ignite) setBurn(z, 3, 5 * P.owner.st.dmg, true);                                   // «Поджог»
    }, P.R + 1);
    for (const q of players) if (!q.down && q.inv <= 0 && Math.abs(q.y - P.y) < 0.8 && (q.x - P.x) ** 2 + (q.z - P.z) ** 2 < P.R * P.R && !L(q, 'fireproof') && G.state === 'play') hurtPlayer(q);
  }
}
/* ---- Турель: стоит, крутится к ближайшему и стреляет ---- */
const TURRETS = [];
const tuMat = c => new THREE.MeshLambertMaterial({ color: c });
function placeTurret(p, x, y, z, S) {
  const mine = TURRETS.filter(t => t.owner === p), lim = 1 + L(p, 'tu_twin');
  while (mine.length >= lim) removeTurret(TURRETS.indexOf(mine.shift()));                   // лишняя (самая старая) исчезает
  const g = new THREE.Group(), head = new THREE.Group();
  for (const a of [0, 2.1, 4.2]) { const l = new THREE.Mesh(boxGeo, tuMat(0x3a3c38)); l.scale.set(0.05, 0.42, 0.05); l.position.set(Math.sin(a) * 0.16, 0.18, Math.cos(a) * 0.16); l.rotation.set(Math.cos(a) * 0.35, 0, -Math.sin(a) * 0.35); g.add(l); }
  const body = new THREE.Mesh(boxGeo, tuMat(0x5a5e56)); body.scale.set(0.26, 0.2, 0.3); head.add(body);
  const box = new THREE.Mesh(boxGeo, tuMat(0x4a5236)); box.scale.set(0.12, 0.12, 0.14); box.position.set(0.17, -0.02, -0.02); head.add(box);
  const brl = new THREE.Mesh(boxGeo, tuMat(0x222222)); brl.scale.set(0.05, 0.05, 0.3); brl.position.set(0, 0.03, 0.26); head.add(brl);
  head.position.y = 0.44; g.add(head); g.position.set(x, y, z);
  g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); scene.add(g);
  TURRETS.push({ owner: p, x, y, z, g, head, life: S.life, cool: 0.3, rate: S.rate, dmg: S.dmg * p.st.dmg, range: S.range,
    bait: !!L(p, 'tu_bait'), hp: 60, boom: !!L(p, 'tu_boom'), yaw: p.yaw });
  SFX.crate();
}
function removeTurret(i) { if (i < 0) return; scene.remove(TURRETS[i].g); TURRETS.splice(i, 1); }
function updateTurrets(dt) {
  for (let i = TURRETS.length - 1; i >= 0; i--) {
    const t = TURRETS[i]; t.life -= dt; t.cool -= dt;
    if (t.life <= 0 || (t.bait && t.hp <= 0)) {
      dust(t.x, t.y + 0.3, t.z, 0x8a8f86, 8);
      if (t.boom) explode(t.x, t.y, t.z, 40 * t.owner.st.dmg, 1.8, { hurts: false, owner: t.owner });   // «Самоликвидация» — своих не ранит
      removeTurret(i); continue;
    }
    const z = nearestZombie(t.x, t.z, t.range);
    if (z) { const want = Math.atan2(z.x - t.x, z.z - t.z); let a = want - t.yaw; a = Math.atan2(Math.sin(a), Math.cos(a)); t.yaw += a * Math.min(1, dt * 14); }
    t.head.rotation.y = t.yaw;
    if (t.life < 2 && Math.floor(t.life * 6) % 2) t.head.position.y = 0.42; else t.head.position.y = 0.44;   // мигает перед концом
    if (!z || t.cool > 0) continue;
    t.cool = 1 / t.rate;
    const hy = t.y + 0.47, a = t.yaw + rnd(-0.03, 0.03), mx = t.x + Math.sin(t.yaw) * 0.4, mz = t.z + Math.cos(t.yaw) * 0.4;
    const e = clamp(Math.atan2(zAimY(z) - hy, Math.max(0.5, Math.hypot(z.x - t.x, z.z - t.z))), -0.6, 0.6);
    bullets.push({ owner: null, src: t.owner, x0: t.x, z0: t.z, x: mx, y: hy, z: mz, vx: Math.sin(a) * Math.cos(e) * 14, vy: Math.sin(e) * 14, vz: Math.cos(a) * Math.cos(e) * 14, life: 0.55, dmg: t.dmg, pierce: 0, knock: 0.1, hits: [] });
    spawnP({ x: mx, y: hy, z: mz, vx: Math.sin(a) * 2, vy: 0.2, vz: Math.cos(a) * 2, s: 0.07, s1: 0.01, col: 0xfff0a0, col1: 0xff7020, glow: true, life: 0.06 });
    SFX.shot('smg');
  }
}
// «Приманка»: зомби рядом (5 клеток) идут на турель, если она ближе игрока
function baitTurret(z, target) {
  let best = null, bd = 25, td = target ? (target.x - z.x) ** 2 + (target.z - z.z) ** 2 : 1e9;
  for (const t of TURRETS) if (t.bait) { const d = (t.x - z.x) ** 2 + (t.z - z.z) ** 2; if (d < bd && d < td && Math.abs(t.y - z.y) < 1) { bd = d; best = t; } }
  return best;
}
/* ---- Колючка: прямоугольник перед тобой (ближний край — в 2 клетках), режет и замедляет всех, и своих ---- */
const WIRES = [];
const WIRE_NEAR = 2.0;                        // ближний край колючки от игрока (правка из плейтеста: ставилась слишком близко)
function inWire(w, x, z, m) { const dx = x - w.x, dz = z - w.z, along = dx * w.ux + dz * w.uz, across = -dx * w.uz + dz * w.ux; return Math.abs(along) < w.len / 2 + m && Math.abs(across) < w.wid / 2 + m; }
function placeWire(p, S) {
  const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw), wid = WIRE_W + 0.4, len = S.len * (L(p, 'wi_spiral') ? 2 : 1);
  let d = WIRE_NEAR + wid / 2, x = p.x + fx * d, z = p.z + fz * d;
  for (const dd of [d, d - 0.5, d - 1]) { x = p.x + fx * dd; z = p.z + fz * dd; if (!pointSolid(x, p.y + 0.3, z)) break; }
  const uses = L(p, 'wi_sturdy') ? 80 : WIRE_USES, y = floorAt(x, z, p.y + 0.3);
  const w = { x, y, z, ux: fz, uz: -fx, len, wid, dmg: S.dmg * p.st.dmg, slow: S.slow, uses, seen: new Set(), owner: p, trap: false, shock: !!L(p, 'wi_shock'), bleed: !!L(p, 'wi_bleed'), zapT: 0 };
  if (L(p, 'wi_trip') && takeCharge(p, 'grenade')) w.trap = true;                           // «Растяжка»: забирает гранату из подсумка
  const g = new THREE.Group(), post = tuMat(0x5a4a36), coil = tuMat(0x9a9a92);
  const nP = Math.max(2, Math.round(len / 0.8) + 1);
  for (let k = 0; k < nP; k++) for (const s of [-1, 1]) { const m = new THREE.Mesh(boxGeo, post); m.scale.set(0.06, 0.5, 0.06); m.position.set(s * wid / 2, 0.25, -len / 2 + len * k / (nP - 1)); g.add(m); }
  for (const s of [-0.28, 0.28]) for (let k = 0; k < Math.round(len / 0.25); k++) {                // кольца спирали
    const m = new THREE.Mesh(boxGeo, coil); m.scale.set(0.3, 0.3, 0.03); m.position.set(s * wid, 0.2 + (k % 2) * 0.03, -len / 2 + 0.12 + k * 0.25); m.rotation.z = k * 0.7; g.add(m);
  }
  if (w.trap) { const m = new THREE.Mesh(boxGeo, tuMat(0x4a5a30)); m.scale.set(0.1, 0.12, 0.1); m.position.set(0, 0.06, 0); g.add(m); }
  g.position.set(x, y, z); g.rotation.y = Math.atan2(w.ux, w.uz); g.traverse(m => { if (m.isMesh) m.castShadow = true; }); scene.add(g);
  w.g = g; WIRES.push(w); SFX.crate();
}
function updateWires(dt) {
  for (let i = WIRES.length - 1; i >= 0; i--) {
    const w = WIRES[i], R = w.len / 2 + 1.5;
    forNear(w.x, w.z, z => {
      if (z.dead || Math.abs(z.y - w.y) > 0.8 || !inWire(w, z.x, z.z, z.r * 0.5)) return;
      z.slowT = 0.3; z.slowMul = Math.min(z.slowMul || 1, 1 - w.slow);
      if (!w.seen.has(z.id)) { w.seen.add(z.id); w.uses--; }
      if ((z.wireT || 0) <= G.t) { z.wireT = G.t + 0.5; dzBy(w.owner, z, w.dmg, 0, 0, 0); if (w.bleed) { z.bleedT = 3; z.bleedDps = 4 * w.owner.st.dmg; z.dotOwner = w.owner; } }
    }, R);
    if (w.trap && w.seen.size >= 5) {                                                    // растяжка сработала
      w.trap = false; const S = itemStat(w.owner, 'grenade');
      explode(w.x, w.y, w.z, S.dmg * w.owner.st.dmg, S.R, { hurts: true, owner: w.owner }); scorch(w.x, w.z, S.R * 0.45);
    }
    if (w.shock && (w.zapT -= dt) <= 0) {                                                 // «Под током»: цепочка до 3 зомби
      w.zapT = 1; const list = [];
      forNear(w.x, w.z, z => { if (!z.dead && inWire(w, z.x, z.z, 1.5)) list.push(z); }, R + 1);
      list.sort((a, b) => Math.hypot(a.x - w.x, a.z - w.z) - Math.hypot(b.x - w.x, b.z - w.z));
      let px = w.x, py = w.y + 0.3, pz = w.z;
      for (const z of list.slice(0, 3)) {
        for (let k = 1; k <= 6; k++) spawnP({ x: px + (z.x - px) * k / 6 + rnd(-0.08, 0.08), y: py + (z.y + 0.7 - py) * k / 6 + rnd(-0.08, 0.08), z: pz + (z.z - pz) * k / 6 + rnd(-0.08, 0.08), s: 0.06, col: 0x9fe8ff, glow: true, life: 0.12 });
        dzBy(w.owner, z, 10 * w.owner.st.dmg, 0, 0, 0); z.stunT = Math.max(z.stunT || 0, 0.2); px = z.x; py = z.y + 0.7; pz = z.z;
      }
      if (list.length) SFX.rico();
    }
    for (const q of players) {                                                            // колючка режет и своих
      if (q.down || Math.abs(q.y - w.y) > 0.8 || !inWire(w, q.x, q.z, 0)) continue;
      q.slowT = 0.3;
      if (q.inv <= 0 && !L(q, 'fireproof') && G.state === 'play') hurtPlayer(q);
    }
    if (w.uses <= 0) { dust(w.x, w.y + 0.2, w.z, 0x9a9a90, 10); scene.remove(w.g); WIRES.splice(i, 1); }
  }
}
/* ---- Ящики с припасами (большие — по таймеру рядом с игроками, малые — редко из зомби) и предметы на земле ---- */
const CRATES = [], GITEMS = [];
const crateMat = tuMat(0x8a6236), crateBand = tuMat(0x5a3e22);
function crateMesh(big) {
  const g = new THREE.Group(), s = big ? 0.55 : 0.38;
  const b = new THREE.Mesh(boxGeo, crateMat); b.scale.set(s, s * 0.8, s); b.position.y = s * 0.4; g.add(b);
  for (const k of [-0.3, 0.3]) { const m = new THREE.Mesh(boxGeo, crateBand); m.scale.set(s * 1.02, s * 0.12, s * 1.02); m.position.y = s * 0.4 + k * s * 0.8; g.add(m); }
  g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); scene.add(g); return g;
}
function spawnCrate(x, z, big, y0) { const y = floorAt(x, z, (y0 || 0) + 0.3), g = crateMesh(big); g.position.set(x, y, z); g.rotation.y = Math.random() * TAU; CRATES.push({ x, y, z, big, g, t: 0 }); }
function crateTimer(dt) {
  if ((G.crateT -= dt) > 0) return;
  G.crateT = CRATE.every;
  const al = alivePlayers(); if (!al.length) return;
  const big = CRATES.filter(c => c.big && !c.keep);
  if (big.length >= CRATE.max) {                                                          // на большой карте: самый дальний ящик уступает место
    let far = null, fd = 0; for (const c of big) { const d = Math.min(...al.map(p => Math.hypot(p.x - c.x, p.z - c.z))); if (d > fd) { fd = d; far = c; } }
    if (fd < 25) return; removeCrate(CRATES.indexOf(far));
  }
  if (Math.random() < 0.6) {                                                              // фиксированные места: оружейная, кухня, склад топлива… (не на глазах и не рядом с игроком)
    const free = MAPDEF.crates.filter(([x, z]) => !CRATES.some(c => Math.hypot(c.x - x, c.z - z) < 1.5) && al.every(q => Math.hypot(q.x - x, q.z - z) > 7) && !onScreen(x, z));
    if (free.length) { const [x, z, y] = free[Math.floor(Math.random() * free.length)]; spawnCrate(x, z, true, y); return; }
  }
  const p = al[Math.floor(Math.random() * al.length)];
  for (let i = 0; i < 40; i++) {
    const a = Math.random() * TAU, d = rnd(7, 15), x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d;
    if (x < 2 || z < 2 || x > MAP - 2 || z > MAP - 2 || blocked(x, z, 0, 0.5) || floorAt(x, z, 0) > 0 || al.some(q => Math.hypot(q.x - x, q.z - z) < 6)) continue;
    spawnCrate(x, z, true); return;
  }
}
function removeCrate(i) { if (i < 0) return; scene.remove(CRATES[i].g); CRATES.splice(i, 1); }
function dropFromZombie(z) { if (Math.random() < CRATE.dropChance * (players.some(p => L(p, 'looter')) ? 2 : 1) * (players.some(p => p.cls === 'tech') ? 2 : 1)) spawnCrate(z.x, z.z, false, z.y); }   // «Мародёр» ×2, Техник ×2
function openCrate(p, c) {
  if (c.loot) return openLootCrate(p, c);
  SFX.crate(); dust(c.x, c.y + 0.3, c.z, 0xc9a45a, 10);
  const fa = c.big ? freeAttach(p) : [];
  if (fa.length && Math.random() < 0.2) { giveAttach(p, fa[Math.floor(Math.random() * fa.length)]); return; }   // большой ящик: иногда обвес
  const n = (c.big ? 1 + (Math.random() < 0.5 ? 1 : 0) : 1) + (c.big && p.cls === 'tech' ? 1 : 0), got = [];   // Техник: из большого +1
  for (let i = 0; i < n; i++) {
    const pool = itemPool(p), id = pool[Math.floor(Math.random() * pool.length)];
    if (giveItem(p, id)) got.push(ITEMS[id].name); else dropItem(id, c.x + rnd(-0.4, 0.4), c.y, c.z + rnd(-0.4, 0.4));
  }
  if (got.length) toast(p, '+ ' + got.join(', '));
  else toast(p, 'Подсумок полон — ' + swapKey(p) + ': обменять', '#ffb080');
}
function itemMesh(id) {
  const g = new THREE.Group();
  for (const [col, x, y, z, w, h, l] of ITEM_VIS[id].parts) { const m = new THREE.Mesh(boxGeo, tuMat(col)); m.scale.set(w * 1.6, h * 1.6, l * 1.6); m.position.set(x * 1.6, 0.12 + y * 1.6, (z - 0.1) * 1.6); m.castShadow = true; g.add(m); }
  scene.add(g); return g;
}
function dropItem(id, x, y, z) { const g = itemMesh(id); g.position.set(x, y, z); GITEMS.push({ id, x, y, z, g, t: 0 }); }
function removeGItem(i) { scene.remove(GITEMS[i].g); GITEMS.splice(i, 1); }
const swapKey = p => IS_TOUCH ? 'кнопка ⇄' : p.ctrl === 'pad' || (p.ctrl === 'all' && PAD.active) ? 'Y' : p.ctrl === 'keys2' ? '.' : 'F';
// Полный подсумок: стоишь на предмете и жмёшь «обменять» — кладёшь один заряд другого типа (того, что в руке, или которого больше всего)
function trySwap(p) {
  if (L(p, 'tu_port')) {                                                                   // «Переносная»: рядом своя турель — подбираем
    const k = TURRETS.findIndex(t => t.owner === p && Math.hypot(t.x - p.x, t.z - p.z) < 1.5);
    if (k >= 0 && pouchN(p) < pouchCap(p)) { removeTurret(k); giveItem(p, 'turret'); toast(p, 'Турель подобрана', '#7cc0ff'); return true; }
  }
  const gi = GITEMS.findIndex(g => Math.hypot(g.x - p.x, g.z - p.z) < 0.8 && Math.abs(g.y - p.y) < 1);
  if (gi < 0) return false;
  const G2 = GITEMS[gi]; if (!p.known[G2.id]) return false;
  let out = p.hand && p.hand !== G2.id && p.pouch[p.hand] > 0 ? p.hand : null;
  if (!out) { let bn = 0; for (const id of p.slots) if (id !== G2.id && p.pouch[id] > bn) { bn = p.pouch[id]; out = id; } }
  if (!out) return false;
  takeCharge(p, out); removeGItem(gi); giveItem(p, G2.id); dropItem(out, p.x + rnd(-0.3, 0.3), floorAt(p.x, p.z, p.y + 0.3), p.z + rnd(-0.3, 0.3));
  SFX.pickup(); toast(p, ITEMS[out].name + ' → ' + ITEMS[G2.id].name);
  return true;
}
function updateCratesItems(dt) {
  crateTimer(dt);
  for (let i = CRATES.length - 1; i >= 0; i--) {
    const c = CRATES[i]; c.t += dt;
    if (Math.random() < dt * 2) spawnP({ x: c.x + rnd(-0.2, 0.2), y: c.y + (c.big ? 0.6 : 0.45), z: c.z + rnd(-0.2, 0.2), vy: 0.4, s: 0.04, col: 0xffe38a, glow: true, life: 0.5 });   // блик — ящик видно в толпе
    const p = players.find(q => !q.down && Math.hypot(q.x - c.x, q.z - c.z) < q.r + 0.45 && Math.abs(q.y - c.y) < 1);
    if (p) { removeCrate(i); openCrate(p, c); }
  }
  for (let i = GITEMS.length - 1; i >= 0; i--) {
    const g = GITEMS[i]; g.t += dt; g.g.rotation.y += dt * 1.5; g.g.position.y = g.y + Math.sin(g.t * 3) * 0.03;
    if (g.t > 120) { removeGItem(i); continue; }
    for (const p of players) {
      if (p.down || Math.hypot(p.x - g.x, p.z - g.z) > 0.6 || Math.abs(p.y - g.y) > 1) continue;
      if (!p.known[g.id]) { if (!(p.msgT > 0.5)) toast(p, 'Нужна карточка предмета: ' + ITEMS[g.id].name, '#ffb080'); continue; }
      if (giveItem(p, g.id)) { SFX.pickup(); toast(p, '+ ' + ITEMS[g.id].name); removeGItem(i); break; }
      if (!(p.msgT > 0.5)) toast(p, 'Подсумок полон — ' + swapKey(p) + ': обменять на «' + ITEMS[g.id].name + '»', '#ffb080');
    }
  }
}
// Силуэт перед установкой: полупрозрачный, зелёный — можно ставить, красный — мешает
const GHOSTS = new Map(), ghostOk = new THREE.MeshBasicMaterial({ color: 0x60ff80, transparent: true, opacity: 0.35, depthWrite: false }), ghostBad = new THREE.MeshBasicMaterial({ color: 0xff4040, transparent: true, opacity: 0.35, depthWrite: false });
function ghostSpot(p) {
  const id = p.hand, fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
  if (id === 'turret' || id === 'claymore' || id === 'trap') {
    const d = id === 'trap' ? 1.2 : 1.1, x0 = p.x + fx * d, z0 = p.z + fz * d, bad = blocked(x0, z0, p.y, 0.25), x = bad ? p.x : x0, z = bad ? p.z : z0, y = floorAt(x, z, p.y + 0.3);
    const sz = id === 'turret' ? [0.45, 0.6, 0.45] : id === 'claymore' ? [0.3, 0.22, 0.12] : [0.4, 0.06, 0.4];
    return { x, y: y + sz[1] / 2, z, yaw: p.yaw, sx: sz[0], sy: sz[1], sz: sz[2], ok: !bad };
  }
  if (id === 'wire') {
    const S = itemStat(p, 'wire'), wid = WIRE_W + 0.4, len = S.len * (L(p, 'wi_spiral') ? 2 : 1), d0 = WIRE_NEAR + wid / 2;
    let x = p.x + fx * d0, z = p.z + fz * d0; for (const dd of [d0, d0 - 0.5, d0 - 1]) { x = p.x + fx * dd; z = p.z + fz * dd; if (!pointSolid(x, p.y + 0.3, z)) break; }
    return { x, y: floorAt(x, z, p.y + 0.3) + 0.25, z, yaw: p.yaw, sx: len, sy: 0.5, sz: wid, ok: true };
  }
  if (id === 'sandbags') { const R = bagsRect(p, itemStat(p, 'sandbags')); return { x: R.cx, y: R.y + 0.31, z: R.cz, yaw: 0, sx: R.s.x2 - R.s.x1, sy: 0.62, sz: R.s.z2 - R.s.z1, ok: R.ok }; }
  return null;
}
function updateGhosts() {
  for (const p of players) {
    let g = GHOSTS.get(p); const S = !p.down && p.hand ? ghostSpot(p) : null;
    if (!S) { if (g) g.visible = false; continue; }
    if (!g) { g = new THREE.Mesh(boxGeo, ghostOk); g.renderOrder = 5; scene.add(g); GHOSTS.set(p, g); }
    g.visible = true; g.material = S.ok ? ghostOk : ghostBad; g.position.set(S.x, S.y, S.z); g.rotation.set(0, S.yaw, 0); g.scale.set(S.sx, S.sy, S.sz);
  }
}
function updateItems(dt) { updateGhosts(); updateItems2(dt); updateThrown(dt); updatePools(dt); updateTurrets(dt); updateWires(dt); updateCratesItems(dt); for (const p of players) if (p.msgT > 0) p.msgT -= dt; }
function clearItems() {
  for (const g of GHOSTS.values()) scene.remove(g); GHOSTS.clear();
  clearItems2();
  THROWN.length = 0; TIMERS.length = 0;
  for (const P of POOLS) { const k = fires.indexOf(P.f); if (k >= 0) fires.splice(k, 1); } POOLS.length = 0;
  while (TURRETS.length) removeTurret(0);
  for (const w of WIRES) scene.remove(w.g); WIRES.length = 0;
  while (CRATES.length) removeCrate(0);
  while (GITEMS.length) removeGItem(0);
  resetGates();
  G.crateT = CRATE.first;
}
// Текст карточки уровня предмета: что даёт следующий уровень
function itemLvText(id, lv) {
  if (!['grenade', 'molotov', 'turret', 'wire'].includes(id)) return itemLvText2(id, lv);
  const a = ITEMS[id].stat(lv), b = ITEMS[id].stat(lv + 1), f = v => +v.toFixed(2);
  if (id === 'grenade') return `Урон ${f(a.dmg)} → ${f(b.dmg)}, радиус ${f(a.R)} → ${f(b.R)}`;
  if (id === 'molotov') return `Огонь ${f(a.dps)} → ${f(b.dps)} в секунду, радиус ${f(a.R)} → ${f(b.R)}, горит ${f(a.dur)} → ${f(b.dur)} с`;
  if (id === 'turret') return `Работает ${f(a.life)} → ${f(b.life)} с, урон ${f(a.dmg)} → ${f(b.dmg)}, темп ${f(a.rate)} → ${f(b.rate)}`;
  return `Длина ${f(a.len)} → ${f(b.len)}, урон ${f(a.dmg)} → ${f(b.dmg)}, замедление ${Math.round(a.slow * 100)} → ${Math.round(b.slow * 100)}%`;
}

/* ---------- 13г. Предметы, часть 2 (батч 6): светошумовая, клеймор, капкан, мешки, дымовая, канистра, аптечка, бронежилет ----------
   Все задевают и своих: светошумовая слепит, клеймор и капкан ранят, канистра жжёт, дым прячет зомби от автоприцела. */
Object.assign(ITEM_VIS, {
  flash:    { muz: 0.1,  parts: [[0x3a4a5a, 0, 0, 0.08, 0.08, 0.13, 0.08], [0xd8d8d0, 0, 0.08, 0.08, 0.05, 0.03, 0.05], [0x8a8a80, 0.045, 0.04, 0.08, 0.02, 0.06, 0.02]] },
  claymore: { muz: 0.2,  parts: [[0x4e5a30, 0, 0, 0.12, 0.2, 0.12, 0.06], [0x3a4424, 0, -0.08, 0.12, 0.03, 0.06, 0.03]] },
  trap:     { muz: 0.2,  parts: [[0x6a6a66, 0, 0, 0.12, 0.22, 0.03, 0.22], [0x8a8a84, 0, 0.03, 0.12, 0.18, 0.03, 0.03], [0x4a4a46, 0, 0, 0.24, 0.03, 0.02, 0.08]] },
  sandbags: { muz: 0.2,  parts: [[0xb8a070, 0, 0, 0.1, 0.24, 0.1, 0.14], [0x9a8458, 0, 0.06, 0.1, 0.24, 0.02, 0.15]] },
  smoke:    { muz: 0.1,  parts: [[0x8a8a8a, 0, 0, 0.08, 0.08, 0.15, 0.08], [0x5a5a5a, 0, 0.09, 0.08, 0.05, 0.03, 0.05]] },
  canister: { muz: 0.18, parts: [[0xb83a2a, 0, -0.02, 0.1, 0.14, 0.2, 0.2], [0x2a2a2a, 0, 0.1, 0.18, 0.03, 0.05, 0.03], [0x8a2a1a, 0, 0.11, 0.06, 0.1, 0.03, 0.03]] },
  medkit:   { muz: 0.1,  parts: [[0xe8e2d4, 0, 0, 0.1, 0.18, 0.13, 0.08], [0xc83030, 0, 0, 0.1, 0.12, 0.035, 0.085], [0xc83030, 0, 0, 0.1, 0.035, 0.1, 0.085]] },
  armor:    { muz: 0.1,  parts: [[0x3a4a6a, 0, 0, 0.1, 0.2, 0.22, 0.06], [0x2a3450, 0, 0.08, 0.1, 0.16, 0.03, 0.065]] },
});
Object.assign(ITEM_SHORT, { flash: 'СВЕТОШ', claymore: 'КЛЕЙМ', trap: 'КАПКАН', sandbags: 'МЕШКИ', smoke: 'ДЫМ', canister: 'КАНИСТ', medkit: 'АПТЕЧ', armor: 'БРОНЯ' });
const ahead = (p, d) => { let x = p.x + Math.sin(p.yaw) * d, z = p.z + Math.cos(p.yaw) * d; if (blocked(x, z, p.y, 0.25)) { x = p.x; z = p.z; } return [x, floorAt(x, z, p.y + 0.3), z]; };
function meshOf(parts) {                                   // группа из коробок: [цвет, x, y, z, w, h, l, rotY?]
  const g = new THREE.Group();
  for (const [c, x, y, z, w, h, l, ry] of parts) { const m = new THREE.Mesh(boxGeo, tuMat(c)); m.scale.set(w, h, l); m.position.set(x, y, z); if (ry) m.rotation.y = ry; m.castShadow = true; m.receiveShadow = true; g.add(m); }
  scene.add(g); return g;
}
// Применить новый предмет; false — не применён (заряд вернуть): аптечка при полном здоровье и т. п.
function useItem2(p, id, S) {
  if (id === 'claymore') { const [x, y, z] = ahead(p, 1.1); placeClaymore(p, x, y, z, S); return true; }
  if (id === 'trap') { const [x, y, z] = ahead(p, 1.2); placeTrap(p, x, y, z, S); return true; }
  if (id === 'sandbags') return placeBags(p, S);
  if (id === 'medkit') {
    const down = players.find(q => q !== p && q.down && Math.hypot(q.x - p.x, q.z - p.z) < 1.8);
    if (down) { down.reviveT = CFG.REVIVE_TIME; toast(p, 'Напарник поднят', '#9ff0a0'); return true; }
    if (p.hp >= p.maxHp) { toast(p, 'Здоров — аптечка не нужна', '#aaa'); return false; }
    p.hp = Math.min(p.maxHp, p.hp + S.heal); SFX.level(); healFx(p); return true;
  }
  if (id === 'armor') {
    if ((p.armor || 0) >= 3) { toast(p, 'Бронежилет и так полный', '#aaa'); return false; }
    p.armor = Math.min(3, (p.armor || 0) + S.blue); SFX.shield(); return true;
  }
  return true;
}
function healFx(p) { for (let i = 0; i < 12; i++) spawnP({ x: p.x, y: p.y + 0.5, z: p.z, vx: rnd(-1.2, 1.2), vy: rnd(1, 2.5), vz: rnd(-1.2, 1.2), s: 0.06, s1: 0.01, col: 0x9ff0a0, glow: true, life: 0.6, drag: 0.95 }); }
// Броски нового типа (THROWN в 57_items): что происходит при падении
function landThrown2(o, x, y, z) {
  const own = o.owner, S = o.S;
  if (o.id === 'flash') {
    SFX.boom(); G.flashFx = 1; shake = Math.max(shake, 0.15);
    for (let i = 0; i < 18; i++) spawnP({ x, y: y + 0.3, z, vx: rnd(-4, 4), vy: rnd(1, 4), vz: rnd(-4, 4), s: 0.08, s1: 0.01, col: 0xffffff, col1: 0xfff0b0, glow: true, life: 0.25 });
    forNear(x, z, zz => { if (!zz.dead && Math.abs(zz.y - y) < 1.5 && Math.hypot(zz.x - x, zz.z - z) < S.R) { zz.stunT = Math.max(zz.stunT || 0, S.stun); zz.flash = 0.1; } }, S.R + 1);
    for (const q of players) if (!q.down && Math.hypot(q.x - x, q.z - z) < S.R && Math.abs(q.y - y) < 1.5) { q.slowT = Math.max(q.slowT || 0, 1.5); toast(q, 'Ослеплён!', '#fff'); }
  } else if (o.id === 'smoke') {
    SFX.throwIt(); SMOKES.push({ x, y, z, R: S.R, t: 0, dur: S.dur });
  }
}
/* ---- Дым: облако; зомби внутри бродят без цели, игроков внутри не видят издалека; автоприцел сквозь дым не берёт ---- */
const SMOKES = [];
const inSmoke = e => { for (const s of SMOKES) if ((e.x - s.x) ** 2 + (e.z - s.z) ** 2 < s.R * s.R && Math.abs(e.y - s.y) < 2.5) return true; return false; };
function updateSmokes(dt) {
  for (let i = SMOKES.length - 1; i >= 0; i--) {
    const s = SMOKES[i]; s.t += dt;
    if (s.t >= s.dur) { SMOKES.splice(i, 1); continue; }
    const k = s.t < 0.6 ? s.t / 0.6 : s.t > s.dur - 1 ? s.dur - s.t : 1;
    if (Math.random() < dt * 22 * k) { const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * s.R * 0.9;
      spawnP({ x: s.x + Math.cos(a) * r, y: s.y + rnd(0.1, 1.2), z: s.z + Math.sin(a) * r, vx: rnd(-0.15, 0.15), vy: 0.12, vz: rnd(-0.15, 0.15), s: rnd(0.35, 0.6), s1: rnd(0.6, 0.9), col: 0xb4b2ac, col1: 0x8c8a86, life: rnd(1.6, 2.4), drag: 0.98 }); }
    forNear(s.x, s.z, z => { if (!z.dead && (z.x - s.x) ** 2 + (z.z - s.z) ** 2 < s.R * s.R) z.confT = 0.4; }, s.R + 1);
  }
}
/* ---- Клеймор: взводится 1 с, срабатывает от зомби в конусе ±50° впереди, бьёт конусом — и своих ---- */
const CLAYS = [];
function placeClaymore(p, x, y, z, S) {
  const g = meshOf([[0x4e5a30, 0, 0.12, 0, 0.26, 0.16, 0.06], [0x3a4424, -0.09, 0.03, 0.02, 0.02, 0.08, 0.02], [0x3a4424, 0.09, 0.03, 0.02, 0.02, 0.08, 0.02], [0xc83030, 0.1, 0.22, 0, 0.03, 0.03, 0.03]]);
  g.position.set(x, y, z); g.rotation.y = p.yaw;
  CLAYS.push({ x, y, z, yaw: p.yaw, arm: 1, owner: p, dmg: S.dmg * p.st.dmg, R: S.range, g }); SFX.crate();
}
const inCone = (c, x, z, R) => { const dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz); return d < R && d > 0.05 && (dx * Math.sin(c.yaw) + dz * Math.cos(c.yaw)) / d > 0.64; };
function updateClays(dt) {
  for (let i = CLAYS.length - 1; i >= 0; i--) {
    const c = CLAYS[i];
    if (c.arm > 0) { c.arm -= dt; continue; }
    if (Math.random() < dt * 1.5) spawnP({ x: c.x + Math.sin(c.yaw) * 0.04 + Math.cos(c.yaw) * 0.1, y: c.y + 0.22, z: c.z + Math.cos(c.yaw) * 0.04 - Math.sin(c.yaw) * 0.1, s: 0.04, col: 0xff3020, glow: true, life: 0.15 });   // мигает
    let hit = false; forNear(c.x, c.z, z => { if (!hit && !z.dead && Math.abs(z.y - c.y) < 1 && inCone(c, z.x, z.z, c.R * 0.8)) hit = true; }, c.R);
    if (!hit) continue;
    CLAYS.splice(i, 1); scene.remove(c.g);
    SFX.boom(); shake = Math.max(shake, 0.25); scorch(c.x + Math.sin(c.yaw) * 0.6, c.z + Math.cos(c.yaw) * 0.6, 0.7);
    for (let k = 0; k < 40; k++) { const a = c.yaw + rnd(-0.85, 0.85), v = rnd(5, 12); spawnP({ x: c.x, y: c.y + 0.2, z: c.z, vx: Math.sin(a) * v, vy: rnd(0, 1.5), vz: Math.cos(a) * v, s: 0.06, s1: 0.01, col: 0xffd080, col1: 0x904020, glow: true, life: 0.25 }); }
    dust(c.x, c.y + 0.2, c.z, 0x7a6a52, 10);
    forNear(c.x, c.z, z => { if (!z.dead && Math.abs(z.y - c.y) < 1.2 && inCone(c, z.x, z.z, c.R)) { const d = Math.hypot(z.x - c.x, z.z - c.z); dzBy(c.owner, z, c.dmg * (1 - d / c.R * 0.5), (z.x - c.x) / d, (z.z - c.z) / d, 6); } }, c.R + 1);
    for (const q of players) if (!q.down && q.inv <= 0 && Math.abs(q.y - c.y) < 1.2 && inCone(c, q.x, q.z, c.R) && !L(q, 'fireproof') && G.state === 'play') hurtPlayer(q);
  }
}
/* ---- Капкан: держит первого, кто наступит (зомби — на S.hold с, игрока — на 1.2 с и ранит) ---- */
const TRAPS = [];
function placeTrap(p, x, y, z, S) {
  const parts = [[0x5a5a56, 0, 0.02, 0, 0.36, 0.03, 0.36], [0x8a8a84, 0, 0.04, 0, 0.2, 0.02, 0.2]];
  for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; parts.push([0xb0b0a8, Math.cos(a) * 0.15, 0.07, Math.sin(a) * 0.15, 0.03, 0.06, 0.03]); }
  const g = meshOf(parts); g.position.set(x, y, z);
  TRAPS.push({ x, y, z, owner: p, dmg: S.dmg * p.st.dmg, hold: S.hold, uses: S.uses, held: null, cd: 0.6, g }); SFX.crate();
}
function updateTraps(dt) {
  for (let i = TRAPS.length - 1; i >= 0; i--) {
    const t = TRAPS[i];
    if (t.held) {
      const h = t.held;
      if (h.dead || h.down || (h.trapT -= dt) <= 0) { t.held = null; t.cd = 0.8; t.g.scale.y = 1; if (--t.uses <= 0) { scene.remove(t.g); TRAPS.splice(i, 1); } continue; }
      h.x += (t.x - h.x) * Math.min(1, dt * 10); h.z += (t.z - h.z) * Math.min(1, dt * 10);
      continue;
    }
    if ((t.cd -= dt) > 0) continue;
    let got = null;
    forNear(t.x, t.z, z => { if (!got && !z.dead && !z.swell && Math.abs(z.y - t.y) < 0.4 && Math.hypot(z.x - t.x, z.z - t.z) < 0.38) got = z; }, 1);
    if (got) { t.held = got; got.trapT = t.hold; dzBy(t.owner, got, t.dmg, 0, 0, 0); SFX.click(); t.g.scale.y = 1.6; blood(got.x, got.y + 0.2, got.z, 0, 0, 5); continue; }
    for (const q of players) if (!q.down && Math.abs(q.y - t.y) < 0.4 && Math.hypot(q.x - t.x, q.z - t.z) < 0.32) {   // свой тоже попадётся
      t.held = q; q.trapT = 1.2; SFX.click(); t.g.scale.y = 1.6; if (q.inv <= 0 && G.state === 'play') hurtPlayer(q); toast(q, 'Капкан!', '#ffb080'); break;
    }
  }
}
/* ---- Мешки с песком: низкая стенка (настоящая коробка в solids — зомби и игроки не проходят, пули летят поверх) ---- */
const BAGS = [];
function bagsRect(p, S) {                                 // где встанут мешки и можно ли (для установки и силуэта)
  const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw), alongX = Math.abs(fz) >= Math.abs(fx);   // стенка поперёк взгляда, по осям карты
  const cx = p.x + fx * 1.3, cz = p.z + fz * 1.3, half = S.len / 2, th = 0.22, y = floorAt(cx, cz, p.y + 0.3);
  const s = alongX ? { x1: cx - half, x2: cx + half, z1: cz - th, z2: cz + th } : { x1: cx - th, x2: cx + th, z1: cz - half, z2: cz + half };
  Object.assign(s, { y1: y, y2: y + 0.62, mat: 'dirt', group: null, bags: true });
  let ok = true;
  for (const q of players) if (q.x + q.r > s.x1 && q.x - q.r < s.x2 && q.z + q.r > s.z1 && q.z - q.r < s.z2) ok = false;
  if (ok) for (const o of solidsNear(cx, cz, half + 0.3)) if (!o.leaves && s.x1 < o.x2 && s.x2 > o.x1 && s.z1 < o.z2 && s.z2 > o.z1 && o.y2 > y + 0.05 && o.y1 < y + 0.6) ok = false;
  return { s, ok, cx, cz, y, half, th, alongX };
}
function placeBags(p, S) {
  const R = bagsRect(p, S), { s, cx, cz, y, half, th, alongX } = R;
  if (!R.ok) { toast(p, 'Нет места для мешков', '#aaa'); return false; }
  const parts = [], n = Math.max(2, Math.round(S.len / 0.4)), L2 = S.len / n;
  for (let r = 0; r < 3; r++) for (let k = 0; k < n - (r % 2); k++) {
    const a = -half + L2 * (k + 0.5 + (r % 2) * 0.5), c = (k + r) % 2 ? 0xb8a070 : 0xa8905e;
    parts.push(alongX ? [c, a, 0.11 + r * 0.2, 0, L2 * 0.96, 0.2, th * 2] : [c, 0, 0.11 + r * 0.2, a, th * 2, 0.2, L2 * 0.96]);
  }
  const g = meshOf(parts); g.position.set(cx, y, cz);
  solids.push(s); indexSolids(); navRebuild(s.x1, s.z1, s.x2, s.z2);
  BAGS.push({ s, g, hp: S.hp, max: S.hp }); SFX.crate(); return true;
}
function updateBags(dt) {
  for (let i = BAGS.length - 1; i >= 0; i--) {
    const B = BAGS[i], s = B.s;
    forNear((s.x1 + s.x2) / 2, (s.z1 + s.z2) / 2, z => {                                    // зомби вплотную — ломают
      if (z.dead || Math.abs(z.y - s.y1) > 0.5) return;
      const ex = Math.max(s.x1 - z.x, 0, z.x - s.x2), ez = Math.max(s.z1 - z.z, 0, z.z - s.z2);
      if (ex * ex + ez * ez < (z.r + 0.12) ** 2) { B.hp -= (z.type === 'fat' ? 16 : 8) * dt; if (!(z.atkT > 0)) z.atkT = 0.45; }
    }, 3);
    B.g.position.y = s.y1 - (1 - B.hp / B.max) * 0.08;
    if (B.hp <= 0) {
      dust((s.x1 + s.x2) / 2, s.y1 + 0.3, (s.z1 + s.z2) / 2, 0xb8a070, 14); SFX.crate();
      scene.remove(B.g); solids.splice(solids.indexOf(s), 1); indexSolids(); navRebuild(s.x1, s.z1, s.x2, s.z2); BAGS.splice(i, 1);
    }
  }
}
/* ---- Канистра: зажал огонь — льёшь дорожку; поджигают выстрел, огонь, взрыв или спичка (R / Y) ---- */
const GAS = [];
function pourGas(p, dt) {
  const S = itemStat(p, 'canister');
  if (p.fuel === undefined || p.fuel === null) { if (!takeCharge(p, 'canister')) return false; p.fuel = S.fuel; p.gasLv = S; p.hand = 'canister'; }   // заряд тратится с первой капли
  p.fuel -= dt;
  const last = p.gasLast;
  if (!last || Math.hypot(p.x - last.x, p.z - last.z) > 0.3 || (p.gasT = (p.gasT || 0) + dt) > 0.35) {
    p.gasT = 0; const x = p.x + Math.sin(p.yaw) * 0.25, z = p.z + Math.cos(p.yaw) * 0.25, y = floorAt(x, z, p.y + 0.3);
    const g = { x, y, z, t: 0, burn: 0, owner: p, dps: S.dps * p.st.dmg, dur: S.burn, f: null }; GAS.push(g); p.gasLast = g;
    dctx.fillStyle = 'rgba(28,22,14,.4)'; dctx.beginPath(); dctx.arc(x * TPX, z * TPX, 0.32 * TPX, 0, TAU); dctx.fill(); decalMark(x, z, 0.4);
  }
  if (Math.random() < dt * 20) spawnP({ x: p.x + Math.sin(p.yaw) * 0.3, y: p.y + 0.5, z: p.z + Math.cos(p.yaw) * 0.3, vy: -2, g: 8, s: 0.04, col: 0x8a7a40, life: 0.25 });
  if (p.fuel <= 0) { endCanister(p); toast(p, 'Канистра пуста — подожги дорожку', '#ffb080'); }
  return true;
}
function endCanister(p) { p.fuel = null; p.gasLast = null; if (p.hand === 'canister') p.hand = null; }   // недолитый бензин пропадает
function igniteGasAt(x, z, R) { let n = 0; for (const g of GAS) if (!g.burn && (g.x - x) ** 2 + (g.z - z) ** 2 < R * R) { lightGas(g); n++; } return n; }
function lightGas(g) { g.burn = g.dur; g.f = { x: g.x, y: g.y, z: g.z, s: 0.35, R: 0.25, acc: 0, seed: Math.random() * 10 }; fires.push(g.f); g.spread = 0.07; }
function updateGas(dt) {
  for (let i = GAS.length - 1; i >= 0; i--) {
    const g = GAS[i]; g.t += dt;
    if (!g.burn) {
      if (g.t > 45) { GAS.splice(i, 1); continue; }
      for (const b of bullets) if (b.y < 1.3 && (b.x - g.x) ** 2 + (b.z - g.z) ** 2 < 0.12) { lightGas(g); break; }   // выстрел по дорожке
      if (!g.burn) forNear(g.x, g.z, z => { if (!g.burn && !z.dead && z.burnT > 0 && (z.x - g.x) ** 2 + (z.z - g.z) ** 2 < 0.16) lightGas(g); }, 1);   // горящий зомби
      if (!g.burn) for (const P of POOLS) if ((P.x - g.x) ** 2 + (P.z - g.z) ** 2 < (P.R + 0.3) ** 2) { lightGas(g); break; }
      continue;
    }
    if (g.spread > 0 && (g.spread -= dt) <= 0) for (const h of GAS) if (!h.burn && (h.x - g.x) ** 2 + (h.z - g.z) ** 2 < 0.5) lightGas(h);   // огонь бежит по дорожке
    g.burn -= dt; g.tick = (g.tick || 0) - dt;
    if (g.burn <= 0) { const k = fires.indexOf(g.f); if (k >= 0) fires.splice(k, 1); scorch(g.x, g.z, 0.35); GAS.splice(i, 1); continue; }
    if (g.tick > 0) continue;
    g.tick = 0.25;
    forNear(g.x, g.z, z => { if (!z.dead && Math.abs(z.y - g.y) < 0.8 && (z.x - g.x) ** 2 + (z.z - g.z) ** 2 < 0.25) { dzBy(g.owner, z, g.dps * 0.25, 0, 0, 0); setBurn(z, 2, 4 * g.owner.st.dmg, false); } }, 1);
    for (const q of players) if (!q.down && q.inv <= 0 && Math.abs(q.y - g.y) < 0.8 && (q.x - g.x) ** 2 + (q.z - g.z) ** 2 < 0.16 && !L(q, 'fireproof') && G.state === 'play') hurtPlayer(q);
  }
}
function updateItems2(dt) { updateSmokes(dt); updateClays(dt); updateTraps(dt); updateBags(dt); updateGas(dt); if (G.flashFx > 0) G.flashFx = Math.max(0, G.flashFx - dt * 2.5); }
function clearItems2() {
  SMOKES.length = 0;
  for (const c of CLAYS) scene.remove(c.g); CLAYS.length = 0;
  for (const t of TRAPS) scene.remove(t.g); TRAPS.length = 0;
  for (const B of BAGS) { scene.remove(B.g); const k = solids.indexOf(B.s); if (k >= 0) solids.splice(k, 1); }
  if (BAGS.length) { const bs = BAGS.map(B => B.s); BAGS.length = 0; indexSolids(); for (const s of bs) navRebuild(s.x1, s.z1, s.x2, s.z2); }
  for (const g of GAS) if (g.f) { const k = fires.indexOf(g.f); if (k >= 0) fires.splice(k, 1); } GAS.length = 0;
  G.flashFx = 0;
}
function itemLvText2(id, lv) {
  const a = ITEMS[id].stat(lv), b = ITEMS[id].stat(lv + 1), f = v => +v.toFixed(2);
  if (id === 'flash') return `Радиус ${f(a.R)} → ${f(b.R)}, оглушение ${f(a.stun)} → ${f(b.stun)} с`;
  if (id === 'claymore') return `Урон ${f(a.dmg)} → ${f(b.dmg)}, дальность ${f(a.range)} → ${f(b.range)}`;
  if (id === 'trap') return `Урон ${f(a.dmg)} → ${f(b.dmg)}, держит ${f(a.hold)} → ${f(b.hold)} с, срабатываний ${a.uses} → ${b.uses}`;
  if (id === 'sandbags') return `Длина ${f(a.len)} → ${f(b.len)}, прочность ${f(a.hp)} → ${f(b.hp)}`;
  if (id === 'smoke') return `Радиус ${f(a.R)} → ${f(b.R)}, держится ${f(a.dur)} → ${f(b.dur)} с`;
  if (id === 'canister') return `Бензина ${f(a.fuel)} → ${f(b.fuel)} с, огонь ${f(a.dps)} → ${f(b.dps)} в секунду`;
  if (id === 'medkit') return `Лечит сердец: ${a.heal} → ${b.heal}`;
  return `Синих сердец: ${a.blue} → ${b.blue}`;
}

/* ---------- 13д. Девайсы (батч 7): дрон, собака, магнитный пояс, автоинжектор, крюк-кошка, тесла-ранец ----------
   p.dev[id] — уровень (1–3). Берутся карточками, пока есть свободный слот. */
const devLv = (p, id) => (p.dev && p.dev[id]) || 0;
const devSlotsOf = p => (p.devSlots || 1) + L(p, 'devslot') + L(p, 'smg_tact');
const devCount = p => Object.keys(p.dev || {}).length;
function giveDevice(p, id) {
  p.dev = p.dev || {}; if ((id === 'dog' && p.dev.drone) || (id === 'drone' && p.dev.dog)) return;               // компаньон только один
  p.dev[id] = Math.min(devMaxOf(id), (p.dev[id] || 0) + 1);
  if (id === 'inject') p.injReady = true;
  if (id === 'hook' && p.hookCd === undefined) p.hookCd = 0;
}
const HOOK_CD = [60, 45, 30];
/* ---- Дрон ---- */
const DRONES = new Map();                                 // игрок → { g, x, y, z, cool, light }
function droneOf(p) {
  let d = DRONES.get(p); if (d) return d;
  const g = meshOf([[0x3a3c40, 0, 0, 0, 0.22, 0.07, 0.22], [0x222222, 0, 0.05, 0.12, 0.04, 0.04, 0.12], [0x9a9ea4, 0.17, 0.03, 0.17, 0.12, 0.012, 0.03], [0x9a9ea4, -0.17, 0.03, 0.17, 0.12, 0.012, 0.03], [0x9a9ea4, 0.17, 0.03, -0.17, 0.12, 0.012, 0.03], [0x9a9ea4, -0.17, 0.03, -0.17, 0.12, 0.012, 0.03], [0xff4030, 0, -0.04, 0.1, 0.03, 0.03, 0.03]]);
  d = { g, x: p.x, y: p.y + 1.8, z: p.z, cool: 0.5, yaw: 0, light: null }; DRONES.set(p, d); return d;
}
function updateDrone(p, dt) {
  const lv = devLv(p, 'drone'); if (!lv) return;
  const d = droneOf(p), t = G.t + p.idx;
  const tx = p.x + Math.sin(t * 0.7) * 0.9, tz = p.z + Math.cos(t * 0.7) * 0.9, ty = p.y + 1.8 + Math.sin(t * 2.3) * 0.08;
  d.x += (tx - d.x) * Math.min(1, dt * 4); d.z += (tz - d.z) * Math.min(1, dt * 4); d.y += (ty - d.y) * Math.min(1, dt * 4);
  d.g.position.set(d.x, d.y, d.z); d.g.visible = !p.down;
  for (let k = 2; k <= 5; k++) d.g.children[k].rotation.y += dt * 40;   // винты
  const z = nearestZombie(d.x, d.z, 6);
  if (z) { const want = Math.atan2(z.x - d.x, z.z - d.z); let a = want - d.yaw; a = Math.atan2(Math.sin(a), Math.cos(a)); d.yaw += a * Math.min(1, dt * 10); }
  d.g.rotation.y = d.yaw;
  if (lv >= 2) {                                                                // прожектор
    if (!d.light) { d.light = new THREE.SpotLight(0xfff2d0, 1.6, 9, 0.5, 0.5, 1.5); scene.add(d.light); scene.add(d.light.target); }
    d.light.position.set(d.x, d.y, d.z); const fx = z ? z.x : d.x + Math.sin(d.yaw) * 3, fz = z ? z.z : d.z + Math.cos(d.yaw) * 3;
    d.light.target.position.set(fx, 0, fz); d.light.intensity = 0.6 + G.night * 2.4; d.light.visible = !p.down;
  }
  if (lv >= 3) for (const g of gems) if (!g.pull && Math.hypot(g.x - p.x, g.z - p.z) < 6 && Math.abs(g.y - p.y) < 2) g.pull = true;   // собирает опыт
  if (p.down || (d.cool -= dt) > 0 || !z) return;
  d.cool = 1 / (lv >= 2 ? 3 : 2);
  const sy = d.y - 0.05, dx = z.x - d.x, dz = z.z - d.z, dist = Math.hypot(dx, dz) || 1, dy = zAimY(z) - sy, l = Math.hypot(dist, dy);
  bullets.push({ owner: null, src: p, x0: d.x, z0: d.z, x: d.x, y: sy, z: d.z, vx: dx / l * 16, vy: dy / l * 16, vz: dz / l * 16, life: 0.5, dmg: 4 * p.st.dmg, pierce: 0, knock: 0.05, hits: [] });
  spawnP({ x: d.x + Math.sin(d.yaw) * 0.12, y: sy, z: d.z + Math.cos(d.yaw) * 0.12, s: 0.05, col: 0xfff0a0, glow: true, life: 0.05 });
  if (canPlay('drone', 90)) SFX.shot('smg');
}
/* ---- Собака (овчарка): в покое ходит справа от героя; раз в 10 с бросается на слабого зомби и убивает; с 2-го ур. подбирает опыт,
   с 3-го оглушает сильных (кроме босса), с 4-го — кровотечение у сильных; в коопе стережёт упавшего и отгоняет врагов ---- */
const DOGS = new Map(), DOG_CD = 10, DOG_WEAK = { walker: 1, runner: 1, hound: 1 };
const isBossZ = z => z.type === 'warden' || z === G.boss;
function dogOf(p) {
  let d = DOGS.get(p); if (d) return d;
  const g = new THREE.Group(), TAN = 0xb8823e, BLK = 0x1e1a16, LT = 0xd2a860, RED = 0xa03020;
  const add = (c, x, y, z, w, h, l, par = g) => { const m = new THREE.Mesh(boxGeo, tuMat(c)); m.scale.set(w, h, l); m.position.set(x, y, z); m.castShadow = true; par.add(m); return m; };
  add(TAN, 0, 0.52, 0.16, 0.34, 0.34, 0.5); add(TAN, 0, 0.47, -0.26, 0.28, 0.3, 0.42); add(LT, 0, 0.34, 0.2, 0.24, 0.1, 0.44);   // грудь, круп, светлое брюхо
  add(BLK, 0, 0.71, -0.02, 0.3, 0.09, 0.66); add(BLK, 0, 0.64, -0.34, 0.26, 0.08, 0.28);                                             // чепрак
  add(TAN, 0, 0.66, 0.46, 0.2, 0.26, 0.2); add(RED, 0, 0.6, 0.44, 0.22, 0.05, 0.22);                                                 // шея и ошейник
  const head = new THREE.Group(); head.position.set(0, 0.78, 0.6); g.add(head);
  add(TAN, 0, 0, 0, 0.2, 0.2, 0.22, head); add(BLK, 0, -0.04, 0.2, 0.11, 0.1, 0.18, head); add(BLK, 0, -0.01, 0.3, 0.06, 0.05, 0.04, head);   // голова, морда, нос
  for (const sd of [-1, 1]) { add(TAN, sd * 0.07, 0.15, -0.04, 0.06, 0.15, 0.05, head); add(BLK, sd * 0.07, 0.24, -0.04, 0.045, 0.05, 0.04, head); add(0x111111, sd * 0.06, 0.04, 0.11, 0.025, 0.025, 0.02, head); }   // уши и глаза
  const tail = new THREE.Group(); tail.position.set(0, 0.52, -0.46); tail.rotation.x = 0.5; g.add(tail); add(BLK, 0, -0.08, -0.14, 0.09, 0.09, 0.34, tail);
  const legs = [[-0.1, 0.3], [0.1, 0.3], [-0.1, -0.3], [0.1, -0.3]].map(([x, z]) => { const lg = new THREE.Group(); lg.position.set(x, 0.42, z); g.add(lg); add(TAN, 0, -0.21, 0, 0.09, 0.42, 0.09, lg); add(BLK, 0, -0.4, 0.03, 0.1, 0.05, 0.14, lg); return lg; });
  scene.add(g);
  d = { g, head, tail, legs, x: p.x + 0.9, y: p.y, z: p.z, yaw: 0, cd: 4, st: 'follow', tgt: null, t: 0, ph: 0, moving: false, guardT: 0 }; DOGS.set(p, d); return d;
}
function dogTarget(p, lv) {                                   // слабый — ходок, ползун, бегун, пёс; остальные сильные; босса не трогаем
  let weak = null, wd = 1e9, strong = null, sd = 1e9; const R = 7;
  forNear(p.x, p.z, z => {
    if (z.dead || z.swell || isBossZ(z) || Math.abs(z.y - p.y) > 1) return;
    const q = (z.x - p.x) ** 2 + (z.z - p.z) ** 2; if (q > R * R) return;
    if (DOG_WEAK[z.type]) { if (q < wd) { wd = q; weak = z; } } else if (q < sd) { sd = q; strong = z; }
  }, R);
  return lv >= 3 && strong ? strong : weak;
}
function dogStrike(p, z, lv) {
  const dx = z.x - p.x, dz = z.z - p.z, dd = Math.hypot(dx, dz) || 1;
  blood(z.x, z.y + 0.4, z.z, dx / dd, dz / dd, 4);
  if (DOG_WEAK[z.type]) dzBy(p, z, 1e9, dx / dd, dz / dd, 0.3, undefined, true);
  else {
    z.stunT = Math.max(z.stunT || 0, 2.5); z.kx += dx / dd * 3; z.kz += dz / dd * 3;
    if (lv >= 4) { z.bleedT = Math.max(z.bleedT || 0, 6); z.bleedDps = Math.max(z.bleedDps || 0, 6 * p.st.dmg, z.hp * 0.04); z.dotOwner = p; }
  }
  if (canPlay('dogbite', 150)) SFX.crate();
}
function updateDog(p, dt) {
  const lv = devLv(p, 'dog'); if (!lv) return;
  const d = dogOf(p); d.cd -= dt; d.t += dt;
  if (lv >= 2) for (const g of gems) if (!g.pull && Math.abs(g.y - p.y) < 2 && (g.x - p.x) ** 2 + (g.z - p.z) ** 2 < 36) g.pull = true;     // опыт с 6 клеток
  let tx = d.x, tz = d.z, sp = 0, down = null;
  if (players.length > 1) { let bd = 1e9; for (const q of players) if (q.down) { const k = Math.hypot(q.x - d.x, q.z - d.z); if (k < bd) { bd = k; down = q; } } }
  if (down) {                                                 // кооп: стоит у упавшего и отгоняет врагов
    d.st = 'guard'; d.tgt = null;
    const a = Math.atan2(d.x - down.x, d.z - down.z); tx = down.x + Math.sin(a) * 0.8; tz = down.z + Math.cos(a) * 0.8; sp = 8;
    if ((d.guardT -= dt) <= 0) {
      d.guardT = 0.3; let any = false;
      forNear(down.x, down.z, z => {
        if (z.dead || z.swell || isBossZ(z) || Math.abs(z.y - down.y) > 1.2) return;
        const dx = z.x - down.x, dz = z.z - down.z, dd = Math.hypot(dx, dz); if (dd > 2.8) return;
        z.kx += dx / (dd || 1) * 6; z.kz += dz / (dd || 1) * 6; z.stunT = Math.max(z.stunT || 0, 0.4); any = true;
      }, 3);
      if (any && canPlay('dogbark', 1500) && SFX.bark) SFX.bark();
    }
  } else {
    if (d.st === 'guard') d.st = 'follow';
    if (d.st === 'follow' && d.cd <= 0 && !p.down) { const tg = dogTarget(p, lv); if (tg) { d.st = 'lunge'; d.tgt = tg; d.t = 0; } }
    if (d.st === 'lunge') {
      const z = d.tgt;
      if (!z || z.dead || d.t > 2.5) { d.st = 'follow'; d.tgt = null; d.cd = 2; }
      else { tx = z.x; tz = z.z; sp = 13; if (Math.hypot(z.x - d.x, z.z - d.z) < 0.6) { dogStrike(p, z, lv); d.st = 'bite'; d.t = 0; d.cd = DOG_CD; } }
    } else if (d.st === 'bite') {
      const z = d.tgt; if (z && !z.dead) { tx = z.x; tz = z.z; sp = 3; }
      if (d.t > 0.45) { d.st = 'follow'; d.tgt = null; }
    }
    if (d.st === 'follow') {                                  // в покое: справа от героя на экране, шагом
      const c = Math.cos(CAM.yaw), s = Math.sin(CAM.yaw); tx = p.x + c * 0.95; tz = p.z - s * 0.95;
      sp = clamp(Math.hypot(tx - d.x, tz - d.z) * 4, 0, 6.5);
    }
  }
  const dx = tx - d.x, dz = tz - d.z, dist = Math.hypot(dx, dz);
  let moved = 0;
  if (dist > 14) { d.x = tx; d.z = tz; d.y = p.y; }            // отстала (крюк, крыша) — догоняет сразу
  else if (dist > 0.04 && sp > 0.05) {
    const st = Math.min(dist, sp * dt), ox = d.x, oz = d.z, e = { x: d.x, y: d.y, z: d.z, vy: 0 };
    moveEntity(e, dx / dist * st, dz / dist * st, 0.2); d.x = e.x; d.z = e.z; d.y = floorAt(d.x, d.z, d.y + 0.4);
    moved = Math.hypot(d.x - ox, d.z - oz);
  }
  d.moving = moved > 0.002; d.ph += moved * (d.st === 'follow' ? 7 : 5);
  const want = d.moving && d.st !== 'bite' ? Math.atan2(dx, dz) : d.st === 'bite' && d.tgt ? Math.atan2(d.tgt.x - d.x, d.tgt.z - d.z) : p.yaw;
  let da = want - d.yaw; da = Math.atan2(Math.sin(da), Math.cos(da)); d.yaw += da * Math.min(1, dt * 10);
  d.g.position.set(d.x, d.y + (d.st === 'lunge' ? Math.abs(Math.sin(d.ph * 0.9)) * 0.1 : 0), d.z); d.g.rotation.y = d.yaw;
  const sw = d.moving ? (d.st === 'follow' ? 0.5 : 0.9) : 0;
  d.legs.forEach((m, i) => { m.rotation.x = Math.sin(d.ph + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI : 0)) * sw; });
  d.tail.rotation.y = Math.sin(G.t * (d.moving ? 10 : 5)) * 0.4; d.head.rotation.x = d.st === 'bite' ? Math.sin(G.t * 30) * 0.2 : 0;
}
/* ---- Магнитный пояс: ящики и предметы с земли ---- */
function updateMagnet(p, dt) {
  if (devLv(p, 'magnet') < 3 || p.down) return;
  const pull = o => { const dx = p.x - o.x, dz = p.z - o.z, d = Math.hypot(dx, dz); if (d < 4 && d > 0.3 && Math.abs(o.y - p.y) < 1.5) { const s = Math.min(d, 4 * dt); o.x += dx / d * s; o.z += dz / d * s; o.g.position.x = o.x; o.g.position.z = o.z; } };
  for (const c of CRATES) pull(c);
  for (const g of GITEMS) if (pouchN(p) < pouchCap(p) && p.known[g.id]) pull(g);
}
/* ---- Автоинжектор: вызывается из hurtPlayer, когда сердца кончились ---- */
function tryInject(p) {
  const lv = devLv(p, 'inject'); if (!lv || !p.injReady) return false;
  p.injReady = false; p.injT = lv >= 3 ? 240 : -1; p.hp = lv >= 2 ? 2 : 1; p.inv = 2.5;
  SFX.level(); healFx(p); toast(p, 'Автоинжектор!', '#9ff0a0'); return true;
}
/* ---- Тесла-ранец ---- */
function updateTesla(p, dt) {
  const lv = devLv(p, 'tesla'); if (!lv || p.down) return;
  if ((p.teslaT = (p.teslaT || 0) - dt) > 0) return;
  const first = nearestZombie(p.x, p.z, 5); if (!first) return;
  p.teslaT = lv >= 3 ? 4 : 6;                                   // молнии редкие, но сильные (раньше 25 урона каждые 3 / 2 с)
  const hops = lv >= 3 ? 4 : lv >= 2 ? 2 : 0, hit = new Set();
  const tip = teslaTip(p, Math.floor(Math.random() * lv), lv);
  let a = tip, z = first, dmg = 50 * p.st.dmg;
  teslaFlash(tip);
  for (let k = 0; k <= hops && z; k++) {
    const b = { x: z.x, y: z.y + 0.75, z: z.z };
    addBolt(a, b, false); teslaImpact(z);
    hit.add(z); dzBy(p, z, dmg, 0, 0, 0); z.stunT = Math.max(z.stunT || 0, 0.25);
    a = b; dmg *= 0.7;
    let nx = null, nd = 9; forNear(z.x, z.z, q => { if (!q.dead && !hit.has(q)) { const d = (q.x - z.x) ** 2 + (q.z - z.z) ** 2; if (d < nd) { nd = d; nx = q; } } }, 3); z = nx;
  }
  SFX.zap();
}
/* ---- Крюк-кошка: рывок; на 3-м уровне цепляется за крыши ---- */
function useHook(p) {
  const lv = devLv(p, 'hook'); if (!lv || p.down || p.hookAnim) return;
  if (p.hookCd > 0) { toast(p, `Крюк через ${Math.ceil(p.hookCd)} с`, '#aaa'); return; }
  const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
  let tx = p.x + fx * 5, tz = p.z + fz * 5, ty = p.y, climb = false;
  if (lv >= 3) for (let s = 0.8; s <= 6; s += 0.25) {                           // первая стена по пути — наверх
    const x = p.x + fx * s, z = p.z + fz * s, top = floorAt(x, z, 40);
    if (top > p.y + 0.6) { const x2 = x + fx * 0.5, z2 = z + fz * 0.5, t2 = floorAt(x2, z2, 40); if (Math.abs(t2 - top) < 0.3 && !blocked(x2, z2, top, p.r)) { tx = x2; tz = z2; ty = top; climb = true; } break; }
  }
  p.hookCd = HOOK_CD[lv - 1]; p.inv = Math.max(p.inv, 0.5);
  p.hookAnim = { t: 0, dur: climb ? 0.4 : 0.28, x0: p.x, y0: p.y, z0: p.z, x1: tx, y1: ty, z1: tz, climb };
  SFX.throwIt(); rumble(p, 0.5, 120);
}
function updateHookAnim(p, dt) {
  if (p.hookCd > 0) p.hookCd -= dt;
  const h = p.hookAnim; if (!h) return false;
  h.t += dt; const k = Math.min(1, h.t / h.dur);
  for (let s = 0; s < 3; s++) spawnP({ x: p.x + (h.x1 - p.x) * Math.random(), y: p.y + 0.9 + (h.y1 - p.y) * Math.random(), z: p.z + (h.z1 - p.z) * Math.random(), s: 0.03, col: 0x8a8a84, life: 0.05 });   // трос
  if (h.climb) { p.x = h.x0 + (h.x1 - h.x0) * k; p.z = h.z0 + (h.z1 - h.z0) * k; p.y = h.y0 + (h.y1 - h.y0) * Math.min(1, k * 1.3) + Math.sin(k * Math.PI) * 0.4; p.vy = 0; }
  else { const sx = (h.x1 - h.x0) / h.dur * dt, sz = (h.z1 - h.z0) / h.dur * dt; moveEntity(p, sx, sz, p.r); }
  if (k >= 1) { if (h.climb) { p.y = h.y1; p.vy = 0; } p.hookAnim = null; dust(p.x, p.y + 0.1, p.z, 0xb0a690, 6); }
  return true;
}
function updateDevices(dt) {
  updateAttach(dt);
  for (const p of players) {
    if (!p.dev) continue;
    if (p.injT > 0 && (p.injT -= dt) <= 0) { p.injReady = true; toast(p, 'Автоинжектор заряжен', '#9ff0a0'); }
    updateDrone(p, dt); updateDog(p, dt); updateMagnet(p, dt); updateTesla(p, dt);
  }
}
function clearDevices() {
  clearAttach();
  for (const d of DRONES.values()) { scene.remove(d.g); if (d.light) { scene.remove(d.light); scene.remove(d.light.target); } }
  for (const d of DOGS.values()) scene.remove(d.g);
  DRONES.clear(); DOGS.clear();
}
function devCardText(id, lv) { return DEVICES[id].lv[lv]; }   // что даёт уровень lv+1
/* ---------- Обвесы (батч 8): ЛЦУ, подствольный фонарь, удлинённый ствол ---------- */
const ATTV = new Map();                                   // игрок → { beam, light }
const laserMat = new THREE.MeshBasicMaterial({ color: 0xff2a1a, toneMapped: false, transparent: true, opacity: 0.8 });
function giveAttach(p, id) { p.att = p.att || {}; p.att[id] = true; toast(p, 'Модуль: ' + ATTACH[id].name, '#ffd76a'); }
const freeAttach = p => ATT_IDS.filter(id => !(p.att && p.att[id]));
const inBeam = (p, z) => { const dx = z.x - p.x, dz = z.z - p.z, d = Math.hypot(dx, dz); return d < 8 && d > 0.2 && Math.abs(z.y - p.y) < 1.5 && (dx * Math.sin(p.yaw) + dz * Math.cos(p.yaw)) / d > 0.93; };
function updateAttach(dt) {
  for (const p of players) {
    if (!p.att) continue;
    let v = ATTV.get(p);
    if (!v && (p.att.laser || p.att.light)) { v = {}; ATTV.set(p, v); }
    if (!v) continue;
    const show = !p.down && !p.hand && G.state !== 'menu', mz = show ? muzzleOf(p) : null;
    if (p.att.laser) {                                                    // луч до первой цели или стены
      if (!v.beam) { v.beam = new THREE.Mesh(boxGeo, laserMat); scene.add(v.beam); }
      v.beam.visible = show;
      if (show) {
        const dx = Math.sin(p.yaw) * Math.cos(p.pitch || 0), dy = -Math.sin(p.pitch || 0), dz = Math.cos(p.yaw) * Math.cos(p.pitch || 0);
        let len = 9;
        for (let s = 0.3; s < 9; s += 0.25) { const x = mz.x + dx * s, y = mz.y + dy * s, z = mz.z + dz * s; if (y < 0.02 || pointSolid(x, y, z)) { len = s; break; } let hit = false; forNear(x, z, q => { if (!hit && !q.dead && Math.hypot(q.x - x, q.z - z) < q.r && y > q.y && y < q.y + zHeight(q)) hit = true; }, 1); if (hit) { len = s; break; } }
        v.beam.scale.set(0.018, 0.018, len); v.beam.position.set(mz.x + dx * len / 2, mz.y + dy * len / 2, mz.z + dz * len / 2);
        v.beam.rotation.set(0, 0, 0); v.beam.lookAt(mz.x + dx * len, mz.y + dy * len, mz.z + dz * len);
        if (Math.random() < dt * 30) spawnP({ x: mz.x + dx * len, y: mz.y + dy * len, z: mz.z + dz * len, s: 0.05, col: 0xff3020, glow: true, life: 0.05 });
      }
    }
    if (p.att.light) {                                                    // фонарь: свет + зомби в луче медленнее
      if (!v.light) { v.light = new THREE.SpotLight(0xfff4d8, 2, 13, 0.42, 0.4, 1); scene.add(v.light); scene.add(v.light.target); }
      v.light.visible = show;
      if (show) { v.light.position.set(mz.x, mz.y, mz.z); v.light.target.position.set(mz.x + Math.sin(p.yaw) * 6, p.y, mz.z + Math.cos(p.yaw) * 6); v.light.intensity = 1 + G.night * 7;
        forNear(p.x, p.z, z => { if (!z.dead && inBeam(p, z)) { z.slowT = Math.max(z.slowT, 0.2); z.slowMul = Math.min(z.slowMul || 1, 0.85); } }, 8); }
    }
  }
}
function clearAttach() { for (const v of ATTV.values()) { if (v.beam) scene.remove(v.beam); if (v.light) { scene.remove(v.light); scene.remove(v.light.target); } } ATTV.clear(); }
