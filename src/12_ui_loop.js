'use strict';
/* ---------- 16. Интерфейс: меню (число игроков, ствол каждому), HUD каждого игрока со своей стороны, пауза, конец ---------- */
const $ = id => document.getElementById(id);
const fmtT = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
G.guns[0] = G.gun;
let menuSel = Math.max(0, MAIN_IDS.indexOf(G.gun));
function menuBuild() {
  $('cards').innerHTML = MAIN_IDS.map((id, i) => { const W = WEAPONS[id], C = CLASSES[id];
    const rate = W.rateMax ? `${W.rate}→${W.rateMax}` : W.rate;
    return `<button class="card" data-i="${i}"><span class="k">${i + 1}</span><b>${C.name}</b><span class="gn">${W.name}</span><p>${W.desc}</p><div class="cl"><span class="pl">+ ${C.plus}</span>${C.minus ? `<br><span class="mi">− ${C.minus}</span>` : ''}</div>
      <div class="st">урон <span>${W.dmg}${W.pellets > 1 ? '×' + W.pellets : ''}</span> · выстр./с <span>${rate}</span><br>магазин <span>${W.mag}</span> · перезарядка <span>${W.reload} с</span>${W.pierce ? `<br>пробивает <span>${W.pierce}</span>` : ''}${W.quiver ? ` · колчан <span>${W.quiver}</span>` : ''}</div><div class="who"></div></button>`; }).join('');
  $('cards').querySelectorAll('.card').forEach(b => {
    b.addEventListener('click', e => { e.stopPropagation(); const i = +b.dataset.i; if (i === menuSel) menuConfirm(); else { menuSel = i; menuMark(); SFX.click(); } });
    b.addEventListener('mouseenter', () => { menuSel = +b.dataset.i; menuMark(); });
  });
  $('goBtn').onclick = e => { e.stopPropagation(); menuConfirm(); };
  $('plBtn').onclick = e => { e.stopPropagation(); menuKey('Tab'); };
  $('backMain').onclick = e => { e.stopPropagation(); mmEnter(); };
  $('lookPrev').onclick = e => { e.stopPropagation(); lookCycle(-1); }; $('lookNext').onclick = e => { e.stopPropagation(); lookCycle(1); };
  $('lookEdit').onclick = e => { e.stopPropagation(); edOpen(); };
  heroApplyAll();
  $('optSound').checked = Sound.on; $('optSound').onchange = e => setSound(e.target.checked);
  $('againBtn').onclick = e => { e.stopPropagation(); restartRun(); };
  $('menuBtn').onclick = e => { e.stopPropagation(); toMenu(); };
  $('resumeBtn').onclick = e => { e.stopPropagation(); G.paused = false; };
  $('quitBtn').onclick = e => { e.stopPropagation(); G.paused = false; toMenu(); };
  if (IS_TOUCH) $('plBtn').style.display = 'none';
  menuMark();
}
function menuMark() {
  G.nPlayers = Math.min(G.nPlayers, maxPlayers());
  G.guns[G.pick] = MAIN_IDS[menuSel]; G.gun = G.guns[0];
  $('cards').querySelectorAll('.card').forEach((b, i) => {
    b.classList.toggle('sel', i === menuSel); b.style.borderColor = i === menuSel && G.nPlayers > 1 ? PLAYER_CSS[G.pick] : '';
    b.querySelector('.who').innerHTML = G.nPlayers > 1 ? G.guns.slice(0, G.pick).map((g, k) => g === MAIN_IDS[i] ? `<i style="background:${PLAYER_CSS[k]}">И${k + 1}</i>` : '').join('') : '';
  });
  $('plBtn').textContent = 'Игроков: ' + G.nPlayers;
  const ctr = assignControls(G.nPlayers);
  $('pickWho').innerHTML = G.nPlayers > 1 ? `<b style="color:${PLAYER_CSS[G.pick]}">Игрок ${G.pick + 1}</b> выбирает класс` + ctr.map((c, k) => `<br><span style="color:${PLAYER_CSS[k]}">И${k + 1}</span>: ${CTRL_NAME[c.ctrl]}${c.ctrl === 'pad' ? ' ' + (c.pad + 1) : ''}`).join('') : '';
  $('goBtn').textContent = G.nPlayers > 1 && G.pick < G.nPlayers - 1 ? 'Дальше — игрок ' + (G.pick + 2) : 'В бой';
  lookMark();
  if (player && G.state === 'menu') { player.idx = G.pick; debugGun(G.guns[G.pick]); }
}
function menuConfirm() {
  SFX.click();
  if (G.pick < G.nPlayers - 1) { G.pick++; menuSel = Math.max(0, MAIN_IDS.indexOf(G.guns[G.pick])); menuMark(); return; }
  startRun();
}
function menuKey(code) {
  const cols = Math.max(1, Math.round($('cards').clientWidth / 170));
  if (code === 'ArrowRight' || code === 'KeyD') menuSel = (menuSel + 1) % MAIN_IDS.length;
  else if (code === 'ArrowLeft' || code === 'KeyA') menuSel = (menuSel + MAIN_IDS.length - 1) % MAIN_IDS.length;
  else if (code === 'ArrowDown' || code === 'KeyS') menuSel = Math.min(MAIN_IDS.length - 1, menuSel + cols);
  else if (code === 'ArrowUp' || code === 'KeyW') menuSel = Math.max(0, menuSel - cols);
  else if (/^Digit[1-7]$/.test(code) && +code.slice(5) <= MAIN_IDS.length) menuSel = +code.slice(5) - 1;
  else if (code === 'Tab') { G.nPlayers = G.nPlayers >= maxPlayers() ? 1 : G.nPlayers + 1; G.pick = 0; menuSel = Math.max(0, MAIN_IDS.indexOf(G.guns[0])); }
  else if (code === 'Backspace' || code === 'Escape') { if (G.pick > 0) { G.pick--; menuSel = Math.max(0, MAIN_IDS.indexOf(G.guns[G.pick])); } else { mmEnter(); return; } }
  else if (code === 'Enter' || code === 'Space' || code === 'NumpadEnter') { menuConfirm(); return; }
  else return;
  menuMark(); SFX.click();
}
function showScreen(id) { document.body.classList.toggle('mainScr', id === 'main'); for (const s of ['main', 'menu', 'over', 'pause']) $(s).style.display = s === id ? 'flex' : 'none';
  const play = id === null || id === 'pause'; $('huds').style.display = $('top').style.display = play ? 'block' : 'none';
  $('help').style.display = play && !IS_TOUCH && players.length < 2 ? 'block' : 'none'; }
// HUD: у каждого игрока свой блок в своём углу (И1 слева сверху, И2 справа сверху, И3/И4 снизу)
// Телефон: кнопки предметов (тап — в руку, стрельба сама бросит по цели) и «обменять»
let tItemsKey = '';
function touchItems(p, sl) {
  const near = GITEMS.some(g => Math.hypot(g.x - p.x, g.z - p.z) < 0.8) || (L(p, 'tu_port') && TURRETS.some(t => t.owner === p && Math.hypot(t.x - p.x, t.z - p.z) < 1.5));
  const key = sl.map(id => id + p.pouch[id]).join() + '|' + p.hand + '|' + near + '|' + devLv(p, 'hook') + '|' + (L(p, 'ri_ubgl') ? p.ubglC || 0 : -1);
  if (key === tItemsKey) return; tItemsKey = key;
  const el = $('tItems'); if (!el) return;
  el.innerHTML = sl.slice(0, 6).map((id, i) => `<button data-s="${i}" class="${p.hand === id ? 'on' : ''}">${ITEM_SHORT[id]}<br>×${p.pouch[id]}</button>`).join('') + (near ? '<button data-s="swap">⇄</button>' : '') + (devLv(p, 'hook') ? '<button data-s="hook">КРЮК</button>' : '') + (L(p, 'ri_ubgl') && p.gun === 'rifle' ? `<button data-s="alt">ГРАН ${p.ubglC || 0}</button>` : '');
  el.querySelectorAll('button').forEach(b => b.addEventListener('touchstart', ev => { ev.preventDefault(); ev.stopPropagation(); if (b.dataset.s === 'swap') act.swapT = true; else if (b.dataset.s === 'hook') act.hookT = true; else if (b.dataset.s === 'alt') act.altT = true; else act.slotT = +b.dataset.s; }, { passive: false }));
}
function hudBuild() {
  tItemsKey = ''; if ($('tItems')) $('tItems').innerHTML = '';
  $('huds').innerHTML = players.map((p, i) => `<div class="hud c${i}" id="hud${i}" style="--pc:${PLAYER_CSS[i]}"><div class="plate"><div class="ph"><span class="pn">${players.length > 1 ? 'ИГРОК ' + (i + 1) : 'ДОСЬЕ'}</span></div><div class="cls"></div><div class="gun"></div><div class="hp"></div><div class="bar stam"><i></i></div><div class="ammoRow"><span class="am"></span><div class="ammo"></div></div><div class="bar rel"><i></i></div><div class="items"></div><div class="devs"></div><div class="msg"></div><div class="down"></div></div></div>`).join('');
  hudLast = {};
}
let hudLast = {};
function hudSet(el, key, v, prop = 'textContent') { if (hudLast[key] !== v) { hudLast[key] = v; if (prop === 'width') el.firstElementChild.style.width = v; else el[prop] = v; } }
function hud() {
  if (!players.length) return;
  for (const p of players) {
    const box = $('hud' + p.idx); if (!box) { hudBuild(); return; }
    const q = s => box.querySelector(s), K = 'p' + p.idx, ws = wStat(p);
    hudSet(q('.hp'), K + 'hp', heartsHtml(p), 'innerHTML');
    hudSet(q('.stam'), K + 'st', (p.stam * 100).toFixed(0) + '%', 'width'); q('.stam').classList.toggle('lock', p.stamLock);
    hudSet(q('.cls'), K + 'cls', `${CLASSES[p.gun].name}<small>${WEAPONS[p.gun].name}</small>`, 'innerHTML');
    hudSet(q('.gun'), K + 'gun', [p.gun === 'mg' && p.spin > 0.05 ? `раскрутка ${Math.round(p.spin * 100)}%` : '', L(p, 'ri_ubgl') ? `подствольник ${'●'.repeat(p.ubglC || 0)}${'○'.repeat(ubglMax(p) - (p.ubglC || 0))}` : '', p.handN > 0 ? `ловкость ×${p.handN}` : '',
      p.gun === 'crossbow' ? `колчан ${p.quiver}${p.quiver <= 0 && p.ammo <= 0 ? ' (болт через ' + Math.ceil(3 - p.boltT) + ' с)' : ''}` : ''].filter(Boolean).join(' · '));
    const key = p.ammo + '/' + ws.mag;
    if (hudLast[K + 'am'] !== key) { hudLast[K + 'am'] = key; const el = q('.ammo'); el.classList.toggle('many', ws.mag > 40); q('.am').textContent = key;
      el.innerHTML = ws.mag > 40 ? '' : Array.from({ length: ws.mag }, (_, i) => `<b class="${i < p.ammo ? '' : 'e'}"></b>`).join(''); }
    q('.rel').style.display = p.reloadT > 0 ? 'block' : 'none';
    if (p.reloadT > 0) hudSet(q('.rel'), K + 'rl', (p.reloadK * 100).toFixed(0) + '%', 'width');
    // подсумок: слоты 1–4 (у игрока на стрелках — 7–0), в руке — подсвечен; сообщения о находках и обмене
    const keysOf = p.ctrl === 'keys2' ? ['7', '8', '9', '0', '-', '='] : p.ctrl === 'pad' || (p.ctrl === 'all' && PAD.active) ? ['↑', '→', '↓', '←', 'Y', 'Y'] : ['1', '2', '3', '4', '5', '6'];
    const sl = slotTypes(p);
    const itemsHtml = sl.length || pouchN(p) || p.fuel != null ? sl.slice(0, 6).map((id, i) => `<div class="slot${p.hand === id ? ' on' : ''}" title="${ITEMS[id].name}">${IS_TOUCH ? '' : `<u>${keysOf[i]}</u>`}${pixIcon(id, 26)}<b>×${p.pouch[id]}</b>${pips(itemLv(p, id), 5)}</div>`).join('')
      + (p.fuel != null ? `<div class="chip">${pixIcon('canister', 16)} ${p.fuel.toFixed(1)} с</div>` : '') + `<span class="cap">${pouchN(p)}/${pouchCap(p)}</span>` : '';
    hudSet(q('.items'), K + 'it', itemsHtml, 'innerHTML');
    const devHtml = Object.keys(p.dev || {}).map(id => { const st = devState(p, id); return `<div class="dev" title="${DEVICES[id].name} ур.${p.dev[id]}">${pixIcon(id, 22)}${pips(p.dev[id], 3)}${st ? `<em>${st}</em>` : ''}</div>`; }).join('')
      + Object.keys(p.att || {}).map(id => `<div class="dev att" title="${ATTACH[id].name}">${pixIcon(id, 20)}</div>`).join('');
    hudSet(q('.devs'), K + 'dv', devHtml, 'innerHTML');
    hudSet(q('.msg'), K + 'ms', p.msgT > 0 ? `<span style="color:${p.msgCol}">${p.msg}</span>` : '', 'innerHTML');
    if (IS_TOUCH && p.idx === 0) touchItems(p, sl);
    hudSet(q('.down'), K + 'dn', p.down ? (players.length > 1 ? `ЛЕЖИТ — отстреливается, подними! ${Math.round(p.reviveT / CFG.REVIVE_TIME * 100)}%` : '') : '');
  }
  hudSet($('xpbar'), 'xp', (G.xp / xpNeed(G.level) * 100).toFixed(1) + '%', 'width');
  hudSet($('timer'), 'tm', fmtT(Math.max(0, RUN_TIME - G.t))); hudSet($('lvl'), 'lv', String(G.level)); hudSet($('kills'), 'k', String(G.kills));
  $('fps').textContent = G.fps + ' FPS' + (G.night > 0.5 ? ' · ночь' : ' · закат');
  const low = players.some(p => !p.down && p.hp === 1);
  if ($('flashFx')) $('flashFx').style.opacity = (G.flashFx || 0).toFixed(2);   // вспышка светошумовой
  $('hurt').style.opacity = Math.max(G.hurtFx, low ? 0.35 + Math.sin(G.t * 6) * 0.1 : 0).toFixed(2);
  const ps = G.paused && G.state === 'play'; $('pause').style.display = ps ? 'flex' : 'none';
  if (ps) hudSet($('pausePerks'), 'pp', players.map(p => (players.length > 1 ? `<b style="color:${PLAYER_CSS[p.idx]}">Игрок ${p.idx + 1}</b> ` : '') + (buildText(p) || 'Перков пока нет')).join('<br>'), 'innerHTML');
}

/* ---------- 17. Забег и главный цикл ---------- */
let lastT = performance.now(), fpsAcc = 0, fpsN = 0;
const START = { x: 48, z: 44 };                   // двор перед главным корпусом
function clearRun() {
  zombies.length = 0; bullets.length = 0; gems.length = 0; parts.length = 0; fireStrips.length = 0; UBGL.length = 0; clearBolts(); clearItems(); clearDevices();
  dctx.clearRect(0, 0, GW, GW); for (const s of SCORCHES) scorch(s[0], s[1], s[2]); decalMarkAll();
  clearMobs();
  Object.assign(G, { nextPack: 200, bossN: 0, boss: null, pickQueue: [], t: 0, kills: 0, spawnAcc: 0, nextHorde: 60, xp: 0, level: 1, win: false, hurtFx: 0, lvlFx: 0, nightT: 0, paused: false });
  players.length = 0; players.push(player = makePlayer(0, G.gun, START.x, START.z));
  CAM.x = START.x; CAM.z = START.z;
}
// Игроки забега: стволы из меню, пульты по геймпадам, стартуют рядом друг с другом
function makePlayers() {
  const n = Math.min(G.nPlayers, maxPlayers()), ctr = assignControls(n);
  players.length = 0;
  for (let i = 0; i < n; i++) { const a = n === 1 ? 0 : i / n * TAU; players.push(makePlayer(i, G.guns[i] || 'shotgun', START.x + Math.cos(a) * 0.8 * (n > 1), START.z + Math.sin(a) * 0.8 * (n > 1), ctr[i])); }
  player = players[0]; hudBuild(); updateMarkers();
}
function startRun() {
  if (IS_TOUCH) goFullscreen(true);                                    // телефон: с первого забега — полный экран
  lsSet('gun', G.gun); lsSet('guns', G.guns); $('lvlUp').style.display = 'none'; clearRun(); makePlayers(); G.state = 'play'; G.pick = 0; showScreen(null);
  updateCamera(0.016);
  for (let i = 0; i < 6; i++) spawnZombie();
}
function restartRun() { startRun(); }
function toMenu() { $('lvlUp').style.display = 'none'; clearRun(); G.pick = 0; menuSel = Math.max(0, MAIN_IDS.indexOf(G.guns[0])); hudBuild(); updateMarkers(); G.state = 'menu'; showScreen('menu'); menuMark(); }
function endRun(win) {
  if (G.state !== 'play') return;
  G.state = 'end'; G.win = win; mouse.down = false;
  $('over').classList.toggle('win', win);
  const co = players.length > 1;
  $('overTitle').textContent = win ? (co ? 'Вы пережили эту ночь!' : 'Ты пережил эту ночь!') : (co ? 'Вас съели' : 'Тебя съели');
  $('overTxt').innerHTML = `${co ? 'Продержались' : 'Продержался'}: <b>${fmtT(G.t)}</b> из ${fmtT(RUN_TIME)}<br>Уровень: <b>${G.level}</b> · Убито зомби: <b>${G.kills}</b><br>${players.map(p => `${co ? `<span style="color:${PLAYER_CSS[p.idx]}">И${p.idx + 1}</span>: ` : 'Класс: '}${CLASSES[p.gun].name} · ${WEAPONS[p.gun].name}`).join(' · ')}`;
  setTimeout(() => { if (G.state === 'end') showScreen('over'); }, win ? 300 : 1200);
}
const coopMul = () => 1 + 0.6 * (players.length - 1);     // в коопе зомби больше (в 2D на двоих ×1.6)
// Метки игроков на земле (в коопе): цветное кольцо, у упавшего — кольцо подъёма растёт
const markers = [];
function updateMarkers() {
  for (const m of markers) { scene.remove(m.ring); scene.remove(m.rev); } markers.length = 0;
  if (players.length < 2) return;
  for (const p of players) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.52, 28).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: PLAYER_CSS[p.idx], transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false }));
    const rev = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.74, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x9ff0a0, transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false }));
    scene.add(ring); scene.add(rev); markers.push({ p, ring, rev });
  }
}
function drawMarkers(T) {
  for (const m of markers) {
    const p = m.p; m.ring.position.set(p.x, p.y + 0.03, p.z); m.ring.material.opacity = p.down ? 0.4 + Math.sin(T * 8) * 0.3 : 0.85;
    m.rev.visible = p.down; if (p.down) { const k = 0.3 + 0.7 * p.reviveT / CFG.REVIVE_TIME; m.rev.position.set(p.x, p.y + 0.04, p.z); m.rev.scale.set(k, 1, k); }
  }
}
// Орда раз в минуту: одни ходоки из двух выходов сразу (как в 2D)
function spawnHorde() {
  const n = Math.round((10 + (G.nextHorde / 60) * 4) * SPAWN_MUL * coopMul());
  const w1 = spawnPoint(), w2 = spawnPoint();
  for (let i = 0; i < n; i++) { const w = i % 2 ? w2 : w1; spawnZombie('walker', w || undefined); }
}
function frame(now) {
  let dt = Math.min(0.05, (now - lastT) / 1000) * (G.timeScale || 1); lastT = now;
  pollPad(dt);
  fpsAcc += dt; fpsN++; if (fpsAcc > 0.5) { G.fps = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; }
  tick(dt, now / 1000);
  render(now / 1000);
  requestAnimationFrame(frame);
}
function tick(dt, T) {
  if (G.state === 'main') mmUpdate(dt);
  const run = G.state === 'play' && !G.paused, live = (G.state === 'play' || G.state === 'end') && !G.paused;
  if (run) {
    G.t += dt;
    if (G.t >= RUN_TIME) endRun(true);
    if (!G.noSpawn) {
      G.spawnAcc += (0.9 + G.t * 0.045) * SPAWN_MUL * coopMul() * dt;
      while (G.spawnAcc >= 1) { G.spawnAcc -= 1; spawnZombie(); }
      if (G.t >= G.nextHorde) { spawnHorde(); G.nextHorde += 60; }
      mobTimers();                                                    // стаи псов и начальник тюрьмы
    }
  }
  if (live) {
    zgridBuild();
    if (run) { for (const p of players) updatePlayer(p, dt); tether(); updateRevive(dt); }
    else for (const p of players) { if (p.inv > 0) p.inv -= dt; if (p.down) updatePlayer(p, dt); p.moving = false; }
    updateBullets(dt); updateZombies(dt); updateSwells(dt); updateFireStrips(dt); updateUbglFlight(dt); updateBolts(dt); updateItems(dt); updateDevices(dt); updateMobFx(dt);
  } else if (G.state === 'menu' && player) {                // в меню герой крутится на месте и показывает ствол
    player.yaw += dt * 0.6; player.pitch = 0; player.kick *= 0.9;
  }
  act.reload = false; act.reload2 = false; act.slot = act.slot2 = act.slotT = -1; act.swap = act.swap2 = act.swapT = false; act.hook = act.hook2 = act.hookT = false; act.alt = act.alt2 = act.altT = false;
  if (G.state === 'play' && G.pickQueue.length) openLevelUp();
  G.hurtFx = Math.max(0, G.hurtFx - dt * 2.5); if (G.lvlFx > 0) G.lvlFx -= dt;
  if (!G.paused) { updateFires(dt, T); updateParts(dt); updateGems(dt, T); }
  updateSky(dt); updateCamera(dt);
  flushDecals(dt);
}
function render(T) {
  updateFade();
  chN = 0; voxFrameBegin();
  for (const p of G.state === 'main' ? [] : players) if (!(p.inv > 0 && !p.down && Math.floor(p.inv * 12) % 2)) { if (VZ.hero) { drawVoxHero(p); drawHeroGunOnly(p); } else drawChar(p, T); if (p.down && players.length > 1) drawDownPistol(p); }
  for (const z of zombies) if (isVoxZ(z)) drawVoxZombie(z); else drawChar(z, T);
  if (G.state === 'main') mmDraw();
  voxFrameEnd(); drawMarkers(T);
  charMesh.count = chN; charMesh.instanceMatrix.needsUpdate = true; charMesh.instanceColor.needsUpdate = true;
  renderer.render(scene, cam);
  hud(); hudExtra(T); debugUpdate();
}
// старт: сначала модели Meshy, потом карта (коллизии моделей нужны навигации)
loadModels().then(() => {
  buildMap(); SPAWNS = mapSpawns(); buildNav(); resize(); debugInit(); menuBuild(); mmBuild();
  toMenu(); mmEnter();
  $('loading') && $('loading').remove();
  requestAnimationFrame(frame);
});
window.__cam = cam; window.__hurt = hurtPlayer; window.__renderer = renderer; window.THREE = THREE; window.__G = { G, get player() { return player; }, players, zombies, bullets, gems, CAM, parts, keys, mouse, moveEntity, blocked, floorAt, solids, solidsNear, spawnZombie, damageZombie, startRun, endRun, debugGun, spawnHorde, tick, act };

