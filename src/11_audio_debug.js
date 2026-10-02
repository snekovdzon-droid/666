'use strict';
/* ---------- 15. Звук: синтез, перенесён из 2D v33 (свои звуки у каждого ствола) ---------- */
const Sound = { ctx: null, master: null, noise: null, last: {}, on: lsGet('sound', true), real: lsGet('realsnd', true), buf: {} };
// Настоящие записи оружия (src/02b_sound_assets.js): декодируем один раз при старте звука
function loadRealSounds() {
  if (typeof SND_B64 === 'undefined') return;
  for (const k in SND_B64) {
    const bin = atob(SND_B64[k]), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    try { Sound.ctx.decodeAudioData(u.buffer, b => { Sound.buf[k] = b; }, () => {}); } catch (e) {}
  }
}
// Играет запись: vol — громкость, rate — высота тона (1 = как есть), у вариантов name_1..name_n берётся случайный
function playReal(name, vol = 1, rate = 1, vary = 0.05) {
  if (!Sound.real || !Sound.ctx) return false;
  let b = Sound.buf[name];
  if (!b) { const n = []; for (let i = 1; Sound.buf[name + '_' + i]; i++) n.push(name + '_' + i); if (n.length) b = Sound.buf[n[Math.floor(Math.random() * n.length)]]; }
  if (!b) return false;
  const c = Sound.ctx, src = c.createBufferSource(), g = c.createGain();
  src.buffer = b; src.playbackRate.value = rate * (1 + (Math.random() * 2 - 1) * vary); g.gain.value = vol;
  src.connect(g); g.connect(Sound.master); src.start(); return true;
}
function audioInit() {
  if (Sound.ctx) { if (Sound.ctx.state === 'suspended') Sound.ctx.resume(); return; }
  try {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const c = new AC(); Sound.ctx = c;
    Sound.master = c.createGain(); Sound.master.gain.value = Sound.on ? 0.5 : 0; Sound.master.connect(c.destination);
    const buf = c.createBuffer(1, c.sampleRate, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    Sound.noise = buf; loadRealSounds();
  } catch (e) { Sound.ctx = null; }
}
addEventListener('pointerdown', audioInit, true); addEventListener('keydown', audioInit, true);
const soundOn = () => Sound.ctx && Sound.on && Sound.ctx.state === 'running';
function sfxOut() { const g = Sound.ctx.createGain(); g.connect(Sound.master); return g; }
function noiseHit({ dur, type = 'lowpass', freq = 1000, q = 1, vol = 0.5, attack = 0.002, sweep }) {
  const c = Sound.ctx, t = c.currentTime;
  const src = c.createBufferSource(); src.buffer = Sound.noise; src.playbackRate.value = 0.8 + Math.random() * 0.4;
  const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + dur);
  const g = sfxOut();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
}
function tone({ f0, f1, dur, vol = 0.4, type = 'sine', delay = 0 }) {
  const c = Sound.ctx, t = c.currentTime + delay;
  const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = sfxOut();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); o.start(t); o.stop(t + dur + 0.05);
}
function click(freq, vol, delay = 0, q = 9, dur = 0.025) {
  const c = Sound.ctx, t = c.currentTime + delay;
  const src = c.createBufferSource(); src.buffer = Sound.noise;
  const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq * (0.95 + Math.random() * 0.1); f.Q.value = q;
  const g = sfxOut();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.001); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
}
function thud(freq, vol, delay = 0, dur = 0.08) {
  const c = Sound.ctx, t = c.currentTime + delay;
  const src = c.createBufferSource(); src.buffer = Sound.noise;
  const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq * 3; f.Q.value = 0.7;
  const g = sfxOut();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
  const o = c.createOscillator(), og = sfxOut(); o.type = 'sine';
  o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(freq * 0.5, t + dur);
  og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(vol * 0.8, t + 0.003); og.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(og); o.start(t); o.stop(t + dur + 0.02);
}
function ring(base, vol, dur = 0.12, delay = 0) {
  const c = Sound.ctx, t = c.currentTime + delay;
  for (const [mul, v] of [[1, 1], [2.4, 0.45], [3.9, 0.2]]) {
    const o = c.createOscillator(), g = sfxOut(); o.type = 'sine'; o.frequency.value = base * mul;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol * v, t + 0.001); g.gain.exponentialRampToValueAtTime(0.0001, t + dur / mul);
    o.connect(g); o.start(t); o.stop(t + dur + 0.02);
  }
}
function canPlay(key, gapMs) { const now = performance.now(); if ((Sound.last[key] || 0) + gapMs > now) return false; Sound.last[key] = now; return true; }
const SFX = {
  ok: canPlay,
  dry() { if (!soundOn()) return; if (playReal('dry', 0.7)) return; click(2400, 0.22, 0, 7, 0.02); click(1500, 0.12, 0.03, 6, 0.02); },
  breath() { if (!soundOn()) return; noiseHit({ dur: 0.32, type: 'bandpass', freq: 1100, q: 0.8, vol: 0.07, attack: 0.09, sweep: 700 });
    setTimeout(() => { if (soundOn()) noiseHit({ dur: 0.28, type: 'bandpass', freq: 1600, q: 1, vol: 0.045, attack: 0.12, sweep: 1900 }); }, 380); },
  shot(id) {
    if (!soundOn()) return;
    const RS = { rifle: [30, 0.8, 1], mg: [25, 0.75, 1], smg: [30, 0.7, 1], pistol: [0, 0.7, 1.1, 'smg'], revolver: [0, 1, 1], shotgun: [0, 1, 1], sawnoff: [0, 1, 0.92] }[id];
    if (RS && Sound.real && (RS[3] || id) && (Sound.buf[(RS[3] || id) + '_1'])) { if (RS[0] && !canPlay(id, RS[0])) return; playReal(RS[3] || id, RS[1], RS[2]); return; }
    switch (id) {
      case 'shotgun': noiseHit({ dur: 0.28, freq: 2200, sweep: 400, vol: 0.7 }); tone({ f0: 110, f1: 40, dur: 0.18, vol: 0.6 }); break;
      case 'sawnoff': noiseHit({ dur: 0.38, freq: 2600, sweep: 300, vol: 0.85 }); tone({ f0: 90, f1: 35, dur: 0.25, vol: 0.8 }); break;
      case 'rifle': if (!canPlay('rifle', 30)) return; noiseHit({ dur: 0.09, type: 'bandpass', freq: 2400, q: 0.8, vol: 0.45 }); tone({ f0: 180, f1: 70, dur: 0.06, vol: 0.3 }); break;
      case 'mg': if (!canPlay('mg', 25)) return; noiseHit({ dur: 0.08, type: 'bandpass', freq: 1600, q: 0.7, vol: 0.45 }); tone({ f0: 140, f1: 60, dur: 0.06, vol: 0.35 }); break;
      case 'pistol': noiseHit({ dur: 0.14, type: 'bandpass', freq: 2600, q: 0.8, vol: 0.4 }); tone({ f0: 160, f1: 60, dur: 0.08, vol: 0.3 }); break;
      case 'revolver': noiseHit({ dur: 0.35, type: 'bandpass', freq: 3000, q: 0.6, sweep: 600, vol: 0.75 }); tone({ f0: 80, f1: 30, dur: 0.3, vol: 0.7 }); break;
      case 'crossbow': if (!canPlay('crossbow', 60)) return; tone({ f0: 320, f1: 140, dur: 0.12, vol: 0.28 }); noiseHit({ dur: 0.06, type: 'bandpass', freq: 1200, q: 2, vol: 0.12 }); break;   // тихий щелчок тетивы
      case 'smg': if (!canPlay('smg', 30)) return; noiseHit({ dur: 0.06, type: 'bandpass', freq: 3200, q: 0.9, vol: 0.32 }); tone({ f0: 220, f1: 90, dur: 0.04, vol: 0.2 }); break;
    }
  },
  hit() { if (!soundOn() || !canPlay('hit', 40)) return; noiseHit({ dur: 0.07, freq: 900 + Math.random() * 300, sweep: 250, vol: 0.16 }); thud(110 + Math.random() * 30, 0.1, 0, 0.05); },
  death() { if (!soundOn() || !canPlay('death', 60)) return; noiseHit({ dur: 0.12, freq: 700, sweep: 200, vol: 0.18 }); thud(75 + Math.random() * 15, 0.3, 0.09 + Math.random() * 0.05, 0.16); },
  boom(big = 1) { if (!soundOn() || !canPlay('boom', 60)) return; noiseHit({ dur: 0.9 * big, freq: 900, sweep: 80, vol: 0.9, attack: 0.005 }); tone({ f0: 70, f1: 25, dur: 0.7 * big, vol: 0.9 }); },
  impact(mat) {
    if (!soundOn() || !canPlay('imp' + mat, 55)) return;
    if (mat === 'metal') { ring(1800 + Math.random() * 900, 0.05, 0.1); click(3200, 0.08, 0, 5, 0.015); }
    else if (mat === 'wood') thud(220, 0.1, 0, 0.05);
    else noiseHit({ dur: 0.06, freq: 1800, sweep: 600, vol: 0.08 });
  },
  reload(start, id) {
    if (!soundOn()) return;
    if (Sound.buf[id + (start ? '_start' : '_end')] && playReal(id + (start ? '_start' : '_end'), 0.8, 1, 0.02)) return;
    if (start) {
      if (id === 'sawnoff') { click(2200, 0.25, 0, 6, 0.04); thud(180, 0.12, 0.02, 0.06); }
      else if (id === 'revolver') { click(3000, 0.18, 0); noiseHit({ dur: 0.18, type: 'bandpass', freq: 2500, q: 3, vol: 0.05 }); }
      else if (id === 'shotgun') click(2600, 0.14, 0);
      else if (id === 'crossbow') { click(1400, 0.16, 0, 6, 0.03); click(1200, 0.16, 0.25, 6, 0.03); }   // взвод рычагом
      else { click(2800, 0.2, 0); thud(160, 0.12, 0.03, 0.05); }
    } else {
      if (id === 'shotgun') { noiseHit({ dur: 0.08, type: 'bandpass', freq: 1400, q: 2, vol: 0.12 }); click(2000, 0.22, 0.07, 7); noiseHit({ dur: 0.07, type: 'bandpass', freq: 1600, q: 2, vol: 0.12 }); click(2400, 0.25, 0.2, 7); }
      else if (id === 'sawnoff') { thud(150, 0.2, 0, 0.05); click(1800, 0.3, 0.01, 6, 0.04); }
      else if (id === 'revolver') { click(2600, 0.18, 0); click(3400, 0.14, 0.06); }
      else if (id === 'crossbow') { thud(200, 0.12, 0, 0.04); click(2200, 0.2, 0.03); }
      else { thud(140, 0.18, 0, 0.05); click(2600, 0.2, 0.01); click(1900, 0.2, 0.14, 8, 0.03); click(2900, 0.22, 0.21, 8, 0.03); }
    }
  },
  hurt() { if (!soundOn()) return; tone({ f0: 200, f1: 60, dur: 0.25, vol: 0.5, type: 'sawtooth' }); noiseHit({ dur: 0.15, freq: 500, vol: 0.3 }); },
  throwIt() { if (!soundOn()) return; noiseHit({ dur: 0.18, type: 'bandpass', freq: 900, q: 0.8, vol: 0.12, sweep: 400 }); },
  crate() { if (!soundOn()) return; thud(160, 0.25, 0, 0.06); click(1800, 0.14, 0.05, 6, 0.03); },
  glass() { if (!soundOn()) return; click(4200, 0.2, 0, 4, 0.04); click(3100, 0.16, 0.03, 4, 0.05); noiseHit({ dur: 0.3, freq: 1400, sweep: 300, vol: 0.3 }); },
  pickup() { if (!soundOn() || !canPlay('pick', 40)) return; tone({ f0: 900 + Math.random() * 200, f1: 1400, dur: 0.06, vol: 0.07 }); },
  level() { if (!soundOn()) return; [523, 659, 784, 1046].forEach((f, i) => tone({ f0: f, dur: 0.18, vol: 0.18, type: 'triangle', delay: i * 0.07 })); },
  thump() { if (!soundOn()) return; tone({ f0: 260, f1: 55, dur: 0.16, vol: 0.7 }); noiseHit({ dur: 0.12, type: 'lowpass', freq: 900, q: 0.7, vol: 0.45 }); click(1600, 0.2, 0.02, 6, 0.03); },   // подствольник
  rico() { if (!soundOn() || !canPlay('rico', 60)) return; tone({ f0: 2600, f1: 900, dur: 0.18, vol: 0.15 }); },                                            // рикошет
  shield() { if (!soundOn()) return; click(900, 0.25, 0, 5, 0.05); tone({ f0: 500, f1: 300, dur: 0.2, vol: 0.25 }); },                                   // щит стойки
  shellLoad() { if (!soundOn()) return; if (!playReal('shotgun_start', 0.8, 1, 0.04)) click(2200, 0.12, 0, 6, 0.02); },
  click() { if (!soundOn()) return; click(2200, 0.12, 0, 6, 0.02); },
  casing(type) {
    if (!soundOn() || !canPlay('casing', 45)) return;
    if (type === 'shell') click(1300 + Math.random() * 300, 0.05, 0, 3, 0.03);
    else ring(2600 + Math.random() * 600, 0.03, 0.1);
  },
};
function setRealSnd(on) { Sound.real = on; lsSet('realsnd', on); }
function setSound(on) { Sound.on = on; lsSet('sound', on); if (Sound.master) Sound.master.gain.value = on ? 0.5 : 0; }

/* ---------- Отладочная панель: F3 или ` (на телефоне — кнопка «dbg») ---------- */
const DBG = { on: false, el: null };
function debugGun(id) { if (!player || !WEAPONS[id]) return; Object.assign(player, { gun: id, cls: CLS({ gun: id }), spin: 0, bloom: 0, reloadT: 0, branch: null, sub: null }); player.ammo = wStat(player).mag; player.quiver = WEAPONS[id].bolt ? quiverMax(player) - player.ammo : 0; }
function spawnNear(type, crawl) { const p = player, a = Math.random() * TAU; return spawnZombie(type, { x: clamp(p.x + Math.cos(a) * 7, 2, MAP - 2), z: clamp(p.z + Math.sin(a) * 7, 2, MAP - 2) }, crawl); }
function debugInit() {
  const el = document.createElement('div'); el.id = 'dbg'; DBG.el = el;
  el.innerHTML = `<div id="dbgStats"></div>
    <label><input type="checkbox" id="dbgGod"> бессмертие</label>
    <label><input type="checkbox" id="dbgSpawn" checked> спавн зомби</label>
    <div>+ рядом: <button data-d="s_walker">ходок</button><button data-d="s_crawl">ползун</button><button data-d="s_runner">бегун</button><button data-d="s_armored">броня</button><button data-d="s_fat">толстяк</button></div>
    <div><button data-d="z20">+20 зомби</button><button data-d="horde">орда</button><button data-d="kill">убить всех</button><button data-d="night">ночь/закат</button></div>
    <div>время: <button data-d="m1">+1 мин</button><button data-d="m5">+5 мин</button> · <button data-d="xp">+10 опыта</button><button data-d="heal">лечить</button></div>
    <div>ствол (1–7): ${MAIN_IDS.map(id => `<button data-d="g_${id}">${WEAPONS[id].name}</button>`).join('')}</div>
    <div>герой: <button data-d="vx_hero">воксельный/старый</button> · зомби из пака: <button data-d="vx_on">вкл/выкл</button> · тени: <button data-d="vx_sh">простые/точные</button> · рост: <button data-d="vh_1.15">1.15</button><button data-d="vh_1.35">1.35</button><button data-d="vh_1.6">1.6</button> · ширина: <button data-d="vw_1">×1</button><button data-d="vw_1.5">×1.5</button><button data-d="vw_2">×2</button> · <button data-d="z300">300 по карте</button></div>
    <div>перк игроку 1: <select id="dbgPerk"></select><button data-d="perk">дать</button><button data-d="fin">финал пути</button><button data-d="lvup">уровень</button></div>
    <div>предметы: <button data-d="items">по заряду каждого</button><button data-d="ilv">+1 ур. всем</button><button data-d="crate">ящик рядом</button><button data-d="pouch">подсумок +2</button></div>
    <div>девайсы: <button data-d="devall">+1 ур. всем (слоты без лимита)</button><button data-d="attall">все обвесы</button></div>
    <div>скорость: <button data-d="t05">×0.5</button><button data-d="t1">×1</button><button data-d="t2">×2</button></div>`;
  document.body.appendChild(el);
  el.addEventListener('click', e => {
    const d = e.target.dataset && e.target.dataset.d; if (!d) return; e.stopPropagation();
    if (d === 'z20') for (let i = 0; i < 20; i++) spawnZombie();
    if (d.startsWith('s_')) { const t = d.slice(2); spawnNear(t === 'crawl' ? 'walker' : t, t === 'crawl' ? true : t === 'walker' ? false : undefined); }
    if (d === 'horde') spawnHorde();
    if (d === 'vx_on') { VZ.on = !VZ.on; lsSet('voxZ', VZ.on); }
    if (d === 'vx_hero') { VZ.hero = !VZ.hero; lsSet('voxHero', VZ.hero); if (!VZ.hero) { HAND_Y = 0.76; HAND_X = 0.08; HAND_Z = 0.1; REV_X = 0.2; } }
    if (d === 'vx_sh') setVoxShadow(!VZ.fullShadow);
    if (d.startsWith('vw_')) { VZ.W = +d.slice(3); lsSet('voxW', VZ.W); }
    if (d.startsWith('vh_')) { VZ.H = +d.slice(3); lsSet('voxH', VZ.H); }
    if (d === 'z300') { G.noSpawn = true; $('dbgSpawn').checked = false; for (let i = 0; i < 300; i++) spawnZombie(Math.random() < 0.85 ? 'walker' : 'runner', { x: rnd(3, MAP - 3), z: rnd(3, MAP - 3) }); }
    if (d === 'kill') for (const z of zombies) if (!z.dead) damageZombie(z, 1e6, rnd(-1, 1), rnd(-1, 1), 0.3);
    if (d === 'night') G.nightT = G.nightT > 0.5 ? 0 : 1;
    if (d === 'm1' || d === 'm5') { G.t += d === 'm1' ? 60 : 300; G.nextHorde = Math.floor(G.t / 60) * 60 + 60; }
    if (d === 'xp') addXp(10);
    if (d === 'perk') { const u = PERK[$('dbgPerk').value]; if (u && L(player, u.id) < perkMax(player, u)) givePerk(player, u); }
    if (d === 'fin') { const b = branchOf(player); if (b && b.sub && !player.sub) player.sub = b.sub[0].id; const f = pathOf(player); if (f) p1Finale(f); }
    if (d === 'items') { player.pouch = {}; player.slots = []; player.hand = null; for (const id of ITEM_IDS) { player.pouch[id] = 0; } for (let k = 0; k < 8; k++) { const id = ITEM_IDS[k % ITEM_IDS.length]; if (!giveItem(player, id)) break; } }
    if (d === 'ilv') for (const id of ITEM_IDS) player.known[id] = Math.min(ITEM_MAX_LV, (player.known[id] || 0) + 1);
    if (d === 'crate') spawnCrate(clamp(player.x + 2, 2, MAP - 2), player.z, true);
    if (d === 'attall') for (const id of ATT_IDS) giveAttach(player, id);
    if (d === 'devall') { player.devSlots = 9; for (const id of DEV_IDS) giveDevice(player, id); }
    if (d === 'pouch') player.pouchBonus = (player.pouchBonus || 0) + 2;
    if (d === 'lvup') addXp(xpNeed(G.level) - G.xp);
    if (d === 'heal') { player.hp = player.maxHp; player.down = false; player.fall = 0; }
    if (d.startsWith('g_')) debugGun(d.slice(2));
    if (d[0] === 't' && d[1] !== 'o') G.timeScale = d === 't05' ? 0.5 : d === 't2' ? 2 : 1;
  });
  $('dbgPerk').innerHTML = PERKS.filter(u => !PERK_LATER.has(u.id)).map(u => `<option value="${u.id}">${u.gun ? WEAPONS[u.gun].name + (u.branch === 'neutral' ? ' · любой путь' : u.branch ? ' · ' + BRANCHES[u.gun].find(b => b.id === u.branch).name + (u.sub ? ' → ' + BRANCHES[u.gun].find(b => b.id === u.branch).sub.find(x => x.id === u.sub).name : '') : '') + ': ' : ''}${u.name}</option>`).join('');
  $('dbgGod').onchange = e => { G.god = e.target.checked; };
  $('dbgSpawn').onchange = e => { G.noSpawn = !e.target.checked; };
  const tog = () => { DBG.on = !DBG.on; el.style.display = DBG.on ? 'block' : 'none'; };
  addEventListener('keydown', e => { if (e.code === 'F3' || e.code === 'Backquote') { e.preventDefault(); tog(); } });
  const b = $('dbgBtn'); if (b) b.onclick = ev => { ev.stopPropagation(); tog(); };
}
function debugUpdate() {
  if (!DBG.on) return;
  const r = renderer.info.render, alive = zombies.filter(z => !z.dead);
  const by = {}; for (const z of alive) by[z.form] = (by[z.form] || 0) + 1;
  $('dbgStats').textContent = `${G.fps} FPS · логика ${PERF.tick.toFixed(1)} мс · отрисовка ${PERF.render.toFixed(1)} мс · ${qualityTag()} · зомби до ${MAX_ENEMIES} · вызовов ${r.calls} · треуг. ${(r.triangles / 1000).toFixed(0)}k · пак ${VZ.on ? 'вкл' : 'выкл'} (${VOXMS.length} моделей, ${VOXMS.map(M => M.tris).join('/')} треуг., тени ${VZ.fullShadow ? 'точные' : 'простые'}, рост ${VZ.H}, ширина ×${VZ.W}) · зомби ${alive.length} (${Object.entries(by).map(([k, v]) => k + ' ' + v).join(', ')}) · трупов ${zombies.length - alive.length}` +
    ` · пуль ${bullets.length} · частиц ${parts.length} · опыта ${gems.length} · игрок ${player.x.toFixed(1)}, ${player.z.toFixed(1)}, h ${player.y.toFixed(2)}${PAD.active ? ' · геймпад' : ''} · геймпадов ${PADS.size} · игроков ${players.length}`;
}
function p1Finale(b) { player.evo[b.fin.id] = true; }
