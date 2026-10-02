'use strict';
/* ---------- Интерфейс «досье»: пиксельные иконки, сердца, радар, подсказки у ящиков и предметов, стрелка к боссу ---------- */

/* --- пиксельные иконки 10×10: буква = цвет из PIX_PAL --- */
const PIX_PAL = { k: '#1a1612', g: '#a6a69c', G: '#5e5e58', w: '#ece4d0', r: '#c8402a', o: '#e8a050', y: '#ecd060', b: '#5a8ac8', B: '#2e4a78', n: '#9a6a36', N: '#5e3c20', l: '#6aa04a', L: '#3e6228', c: '#7cd8e8', t: '#cdb585', p: '#e070b0' };
const PIX = {
  grenade: ['....kk....', '...kGk....', '..kkkkk...', '.kllLllk..', '.klLllLlk.', '.kllLllLk.', '.klLllLlk.', '.kllLllk..', '..kkkkk...', '..........'],
  molotov: ['...oy.....', '..oyyo....', '...kk.....', '...kk.....', '..kllk....', '.klllLk...', '.klllLk...', '.klLllk...', '.klllLk...', '..kkkk....'],
  turret: ['..........', '...kGGk...', '..kGggGk..', '.kGggGggk.', '..kGGGGk..', '...kGGk...', '..kGGGGk..', '.kGkkkkGk.', '.kk....kk.', '..........'],
  wire: ['..........', '.k.k.k.k..', 'kgkgkgkgk.', '.k.k.k.k..', 'kgkgkgkgk.', '.k.k.k.k..', 'kgkgkgkgk.', '.k.k.k.k..', '..........', '..........'],
  flash: ['..y..y..y.', '...y..y...', '.yykkkky..', '..kwwwwk..', '..kwGGwk..', '..kwGGwk..', '..kwwwwk..', '..kGGGGk..', '..kkkkkk..', '..........'],
  claymore: ['..........', '..........', '.kkkkkkkk.', 'kGgggggGGk', 'kGrgrgrgGk', 'kGgggggGGk', '.kkkkkkkk.', '.k..kk..k.', '..........', '..........'],
  trap: ['..........', '..........', '.k.k.k.k..', 'kgkgkgkgk.', '.kgGGGGgk.', 'kgkgkgkgk.', '.k.k.k.k..', '.kkkkkkk..', '..........', '..........'],
  sandbags: ['..........', '..........', '..kkkkkk..', '.kttttttk.', 'kttNttNttk', 'kttttttttk', '.kkkkkkkk.', 'kttNttNttk', 'kttttttttk', '.kkkkkkkk.'],
  smoke: ['..kk.kk...', '.kgggggk..', 'kgggwggGk.', '.kGGGGGk..', '..kBBBk...', '..kBbBk...', '..kBbBk...', '..kBBBk...', '..kkkkk...', '..........'],
  canister: ['...kkk....', '..kkrkk...', '.krrrrrk..', '.krwwwrk..', '.krrrrrk..', '.krwwwrk..', '.krrrrrk..', '.krrrrrk..', '.kkkkkkk..', '..........'],
  medkit: ['..........', '..kkkkk...', '.kwwwwwk..', '.kwwrwwk..', '.kwrrrwk..', '.kwwrwwk..', '.kwwwwwk..', '..kkkkk...', '..........', '..........'],
  armor: ['..........', '.kkk..kkk.', '.kBBkkBBk.', '.kBBBBBBk.', '.kBbBBbBk.', '.kBBBBBBk.', '..kBBBBk..', '...kBBk...', '....kk....', '..........'],
  drone: ['..........', 'k.kk..kk.k', 'kkkkkkkkkk', '.k.GGGG.k.', '...GccG...', '...GGGG...', '..k....k..', '..........', '..........', '..........'],
  dog: ['..........', '.kk....kk.', '.knk..knk.', '.knnkknnk.', '.knwnnwnk.', '.knnnnnnk.', '..knkknk..', '..kkNNkk..', '...kkkk...', '..........'],
  magnet: ['..........', '.rr....bb.', '.rr....bb.', '.rr....bb.', '.rr....bb.', '.gg....gg.', '.ggg..ggg.', '..gggggg..', '...gggg...', '..........'],
  inject: ['......kk..', '.....kwwk.', '....kwwk..', '...kccwk..', '..kccwk...', '.kccwk....', 'kGkwk.....', 'kk.k......', '..........', '..........'],
  hook: ['...kk.....', '..kggk....', '.kg..k....', '.k..kg....', '...kg.....', '...kG.....', '..kGk.....', '.kGk......', 'kGk.......', '..........'],
  tesla: ['....kyyk..', '...kyyk...', '..kyyk....', '.kyyyyyk..', '...kyyk...', '..kyyk....', '..kyk.....', '.kyk......', '.kk.......', '..........'],
  laser: ['..........', '..........', '.kk.......', 'kGGkrrrrrr', 'kGGkrrrrrr', '.kk.......', '..........', '..........', '..........', '..........'],
  light: ['..........', '.kk.......', 'kGGk.yyyy.', 'kGGGkyyyyy', 'kGGGkyyyy.', 'kGGk.yyyy.', '.kk.......', '..........', '..........', '..........'],
  barrel: ['..........', '..........', '.kkkkkkkkk', 'kGGGGGGGGk', 'kGggggggGk', '.kkkkkkkkk', '..........', '..........', '..........', '..........'],
  crate: ['..........', '.kkkkkkkk.', 'kNtttttNk.', 'kNtNttNtk.', 'kNtttttNk.', 'kNtNttNtk.', 'kNtttttNk.', '.kkkkkkkk.', '..........', '..........'],
  gate: ['..........', 'rr......rr', 'rgggggggr.', 'rgGgGgGgr.', 'rgggggggr.', 'rgGgGgGgr.', 'rgggggggr.', 'rr......rr', '..........', '..........'],
  ubgl: ['..........', '...kk.....', '..kllk....', '.kllLlkkkk', '.klLllkGgk', '.kllLlkGgk', '..kllk.kkk', '...kk.....', '..........', '..........'],
  skull: ['..........', '..kkkkkk..', '.kwwwwwwk.', '.kwkwwkwk.', '.kwkwwkwk.', '.kwwwwwwk.', '..kwkkwk..', '..kwkwkk..', '...kkkk...', '..........'],
};
const _pixC = {};
function pixIcon(id, size = 24) {
  const key = id + size; if (_pixC[key]) return _pixC[key];
  const rows = PIX[id]; if (!rows) return '';
  let r = ''; rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) { const c = PIX_PAL[row[x]]; if (c) r += `<rect x="${x}" y="${y}" width="1" height="1" fill="${c}"/>`; } });
  return _pixC[key] = `<svg class="pix" viewBox="0 0 10 10" width="${size}" height="${size}" shape-rendering="crispEdges">${r}</svg>`;
}
// сердце 9×8: полное, пустое, синее (броня), серое (щит стойки)
const HEART = ['.xx...xx.', 'xxxx.xxxx', 'xxxxxxxxx', 'xxxxxxxxx', '.xxxxxxx.', '..xxxxx..', '...xxx...', '....x....'];
const HEART_COL = { f: ['#e04a3a', '#ff9a80'], e: ['#3a3028', '#4a4036'], a: ['#5a8aff', '#a8c4ff'], s: ['#b8bcc4', '#eef0f4'] };
const _heartC = {};
function heartSvg(kind) {
  if (_heartC[kind]) return _heartC[kind];
  const [c, hi] = HEART_COL[kind]; let r = '';
  HEART.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (row[x] === 'x') r += `<rect x="${x}" y="${y}" width="1" height="1" fill="${kind !== 'e' && ((x === 1 || x === 2) && y === 1 || (x === 1 && y === 2)) ? hi : c}"/>`; });
  return _heartC[kind] = `<svg viewBox="0 0 9 8" width="19" height="17" shape-rendering="crispEdges">${r}</svg>`;
}
const heartsHtml = p => heartSvg('f').repeat(Math.max(0, p.hp)) + heartSvg('e').repeat(Math.max(0, p.maxHp - p.hp)) + heartSvg('a').repeat(Math.max(0, p.armor || 0)) + (p.shield ? heartSvg('s') : '');
const pips = (n, max) => `<span class="pips">${'<i class="on"></i>'.repeat(Math.min(n, max))}${'<i></i>'.repeat(Math.max(0, max - n))}</span>`;
// способности с кнопкой под плашкой игрока: подствольник и крюк — иконка, заряды, кольцо перезарядки, клавиша
function abilKeys(p) {
  if (IS_TOUCH) return { ubgl: '', hook: '' };
  const pad = p.ctrl === 'pad' || (p.ctrl === 'all' && PAD.active), k2 = p.ctrl === 'keys2';
  return { ubgl: pad ? 'LT' : k2 ? "'" : 'ПКМ', hook: pad ? 'A' : k2 ? '/' : 'G' };
}
function abilHtml(p) {
  const K = abilKeys(p), out = [];
  const chip = (id, name, key, ready, frac, sec, n, mx) => {
    const deg = Math.round(clamp(frac, 0, 1) * 180) * 2;                       // шаг 2°, чтобы строка не менялась каждый кадр
    out.push(`<div class="ab${ready ? ' rdy' : ''}" style="--p:${deg}deg" title="${name}">${key ? `<u>${key}</u>` : ''}${pixIcon(id, 26)}${sec ? `<em>${sec}</em>` : ''}${mx > 1 || n > 0 ? pips(n, mx) : ''}</div>`);
  };
  if (L(p, 'ri_ubgl') && p.gun === 'rifle') {
    const mx = ubglMax(p), n = p.ubglC == null ? 1 : p.ubglC, cd = ubglCd(p), rc = p.ubglRc || 0;
    chip('ubgl', 'Подствольник', K.ubgl, n > 0, n < mx ? 1 - rc / cd : 0, n < mx ? Math.ceil(cd - rc) : '', n, mx);
  }
  const hl = devLv(p, 'hook');
  if (hl) { const cd = HOOK_CD[hl - 1], left = Math.max(0, p.hookCd || 0); chip('hook', 'Крюк-кошка', K.hook, left <= 0, left / cd, left > 0 ? Math.ceil(left) : '', 0, 0); }
  return out.join('');
}
const devState = (p, id) => id === 'hook' ? '' : id === 'inject' ? (p.injReady ? '✓' : '—') : '';
const __devStateOld = (p, id) => id === 'hook' ? (p.hookCd > 0 ? Math.ceil(p.hookCd) + '' : '✓') : id === 'inject' ? (p.injReady ? '✓' : p.injT > 0 ? Math.ceil(p.injT) + '' : '—') : '';

/* --- радар: вид сверху, повёрнут как камера --- */
const RADAR = { R: 26, S: 118, n: 0 };
const RADAR_COL = { walker: ['#b8382a', 1.5], runner: ['#e0603a', 1.6], armored: ['#8aa0b0', 2.3], fat: ['#d8802a', 2.7], hound: ['#c09a6a', 1.5], screamer: ['#ff6ad0', 3], spitter: ['#8ae03a', 3], brute: ['#ff8a1a', 3.6], riot: ['#5aa0ff', 3], warden: ['#ff2a2a', 4.5] };
function radarDraw(T) {
  const cv = $('radar'); if (!cv) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1), S = RADAR.S;
  if (cv.width !== Math.round(S * dpr)) { cv.width = cv.height = Math.round(S * dpr); cv.style.width = cv.style.height = S + 'px'; }
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, S, S);
  const C = camCenter(); RADAR.R = 26; if (SPLIT.on) for (const p of players) RADAR.R = Math.max(RADAR.R, Math.min(70, Math.hypot(p.x - C.x, p.z - C.z) * 1.6 + 8));   // раздельный экран: охватить всех игроков
  const c = S / 2, rad = c - 5, k = rad / RADAR.R;
  const pt = (x, z) => { const [ox, od] = scrOff(x - C.x, z - C.z); return [c + ox * k, c + od * k]; };
  g.save(); g.beginPath(); g.arc(c, c, rad, 0, TAU); g.clip();
  g.fillStyle = 'rgba(12,10,8,0.8)'; g.fillRect(0, 0, S, S);
  g.strokeStyle = 'rgba(232,160,80,0.14)'; g.lineWidth = 1;
  for (const f of [1 / 3, 2 / 3]) { g.beginPath(); g.arc(c, c, rad * f, 0, TAU); g.stroke(); }
  g.beginPath(); g.moveTo(c - rad, c); g.lineTo(c + rad, c); g.moveTo(c, c - rad); g.lineTo(c, c + rad); g.stroke();
  const dot = (x, z, r, col, sq) => { const [px, py] = pt(x, z); if ((px - c) ** 2 + (py - c) ** 2 > rad * rad) return; g.fillStyle = col; if (sq) g.fillRect(px - r, py - r, r * 2, r * 2); else { g.beginPath(); g.arc(px, py, r, 0, TAU); g.fill(); } };
  for (const cr of CRATES) dot(cr.x, cr.z, cr.big ? 3 : 2.2, '#ecd060', true);
  for (const it of GITEMS) dot(it.x, it.z, 2.2, '#7cd8e8', true);
  for (const z of zombies) { if (z.dead) continue; const rc = RADAR_COL[z.type] || RADAR_COL.walker; dot(z.x, z.z, rc[1], rc[0]); }
  const B = G.boss;
  if (B && !B.dead) { const [px, py] = pt(B.x, B.z), pu = 5.5 + Math.sin(T * 6) * 1.5; g.strokeStyle = 'rgba(255,50,40,0.9)'; g.lineWidth = 1.5; g.beginPath(); g.arc(px, py, pu, 0, TAU); g.stroke(); }
  for (const p of players) { const [px, py] = pt(p.x, p.z); if (p.down && Math.floor(T * 3) % 2) continue; g.fillStyle = PLAYER_CSS[p.idx]; g.strokeStyle = '#000'; g.lineWidth = 1.5; g.beginPath(); g.arc(px, py, 3.2, 0, TAU); g.stroke(); g.fill(); }
  evRadar(g, pt, dot, T, rad, c);
  g.restore();
  g.strokeStyle = '#4a4032'; g.lineWidth = 3; g.beginPath(); g.arc(c, c, rad, 0, TAU); g.stroke();
  g.strokeStyle = '#e8a050'; g.lineWidth = 1; g.beginPath(); g.arc(c, c, rad + 1.5, 0, TAU); g.stroke();
  if (B && !B.dead) {                                                      // босс за краем радара — красный треугольник на ободе
    const [px, py] = pt(B.x, B.z), dx = px - c, dy = py - c, d = Math.hypot(dx, dy);
    if (d > rad) { const a = Math.atan2(dy, dx); g.save(); g.translate(c + Math.cos(a) * (rad + 1), c + Math.sin(a) * (rad + 1)); g.rotate(a); g.fillStyle = '#ff2a2a'; g.beginPath(); g.moveTo(5, 0); g.lineTo(-4, -5); g.lineTo(-4, 5); g.closePath(); g.fill(); g.restore(); }
  }
}

/* --- виды экрана для HUD: один (общий) или по одному на игрока (раздельный) --- */
function uiViews() {
  if (SPLIT.on) return SPLIT.views.map(v => ({ rect: v.rect, vm: v.vm, pm: v.pm, ps: [v.p] }));
  cam.updateMatrixWorld(); return [{ rect: { x: 0, y: 0, w: innerWidth, h: innerHeight }, vm: cam.matrixWorldInverse, pm: cam.projectionMatrix, ps: alivePlayers() }];
}
// мировая точка → пиксели вида; null, если за краем вида
function toView(V, x, y, z, m = 1) {
  _pv.set(x, y, z).applyMatrix4(V.vm).applyMatrix4(V.pm);
  if (Math.abs(_pv.x) > m || Math.abs(_pv.y) > m) return null;
  return [V.rect.x + (_pv.x + 1) / 2 * V.rect.w, V.rect.y + (1 - _pv.y) / 2 * V.rect.h];
}

/* --- подсказки над ящиками и предметами рядом с игроком --- */
const HINT_RANGE = 8, HINT_MAX = 6, hintEls = [];
function hintsUpdate() {
  const box = $('hints'); if (!box) return;
  const live = G.state === 'play' && !G.paused, list = [];
  if (live) for (const V of uiViews()) {
    const near = (x, z) => { let d = 99; for (const p of V.ps) d = Math.min(d, Math.hypot(p.x - x, p.z - z)); return d; }, mine = [];
    for (const c of CRATES) { const d = near(c.x, c.z); if (d < HINT_RANGE) mine.push({ d, x: c.x, y: c.y + (c.big ? 0.85 : 0.65), z: c.z, ico: 'crate', tx: c.label || (c.big ? 'Большой ящик' : 'Ящик'), cls: 'crate' }); }
    for (const g of GITEMS) {
      const d = near(g.x, g.z); if (d >= HINT_RANGE) continue;
      const on = V.ps.find(p => Math.hypot(p.x - g.x, p.z - g.z) < 0.8 && pouchN(p) >= pouchCap(p));
      mine.push({ d, x: g.x, y: g.y + 0.7, z: g.z, ico: g.id, tx: ITEMS[g.id].name, sub: on ? `${swapKey(on)} — обменять` : '', cls: 'item' });
    }
    for (const Gt of GATES) { const d = near((Gt.x1 + Gt.x2) / 2, (Gt.z1 + Gt.z2) / 2); if (d < 4.5) { const p = V.ps[0]; mine.push({ d, x: (Gt.x1 + Gt.x2) / 2, y: 2.5, z: (Gt.z1 + Gt.z2) / 2, ico: 'gate', tx: Gt.locked ? 'Оружейка заперта' : Gt.open ? 'Ворота открыты' : 'Ворота закрыты', sub: d < 2.4 && p ? (Gt.locked ? (EV.hasKey ? `${swapKey(p)} — открыть картой` : 'нужна ключ-карта') : `${swapKey(p)} — ${Gt.open ? 'закрыть' : 'открыть'}`) : '', cls: 'item' }); } }
    mine.sort((a, b) => a.d - b.d);
    for (const h of mine.slice(0, HINT_MAX)) { const pos = toView(V, h.x, h.y, h.z); if (pos) { h.px = pos; list.push(h); } }
  }
  const merged = [];                                    // ящики рядом на экране — одна подсказка «Ящик ×N»
  for (const h of list) {
    const m = h.cls === 'crate' && merged.find(o => o.cls === 'crate' && o.tx === h.tx && Math.hypot(o.px[0] - h.px[0], o.px[1] - h.px[1]) < 80);
    if (m) m.cnt = (m.cnt || 1) + 1; else merged.push(h);
  }
  const n = Math.min(HINT_MAX * 4, merged.length), placed = [];
  while (hintEls.length < n) { const e = document.createElement('div'); e.className = 'ghint'; box.appendChild(e); hintEls.push(e); }
  for (let i = 0; i < hintEls.length; i++) {
    const e = hintEls[i], h = merged[i];
    if (i >= n) { e.style.display = 'none'; continue; }
    const tx = h.tx + (h.cnt > 1 ? ' ×' + h.cnt : '');
    const html = `${pixIcon(h.ico, 20)}<span><b>${tx}</b>${h.sub ? `<em>${h.sub}</em>` : ''}</span>`, key = h.cls + tx + h.sub;
    if (e._k !== key) { e._k = key; e.className = 'ghint ' + h.cls; e.innerHTML = html; e._w = 0; }
    e.style.display = 'flex';
    if (!e._w) { e._w = e.offsetWidth || 100; e._h = e.offsetHeight || 28; }
    // ближние ставятся первыми на своё место, дальние поднимаются над ними, пока не перестанут налезать
    const w = e._w + 6, hh = e._h + 4, x = h.px[0]; let y = h.px[1];
    for (let k = 0; k < 8; k++) {
      const r = placed.find(r => Math.abs(r.x - x) < (r.w + w) / 2 && y > r.y - r.h && y - hh < r.y);
      if (!r) break; y = r.y - r.h;
    }
    placed.push({ x, y, w, h: hh });
    e.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-100%)`;
  }
}

/* --- стрелка к боссу, когда он за краем вида (в раздельном экране — своя в каждой половине) --- */
const arrowEls = [];
function bossArrowUpdate() {
  const base = $('bossArrow'), B = G.boss; if (!base) return;
  const views = !B || B.dead || G.state !== 'play' ? [] : uiViews();
  while (arrowEls.length < views.length) { const e = arrowEls.length ? base.cloneNode(true) : base; if (arrowEls.length) { e.removeAttribute('id'); document.body.appendChild(e); } arrowEls.push(e); }
  arrowEls.forEach((el, i) => {
    const V = views[i]; if (!V) { el.style.display = 'none'; return; }
    _pv.set(B.x, B.y + 1, B.z).applyMatrix4(V.vm).applyMatrix4(V.pm);
    const nx = _pv.x, ny = _pv.y;
    if (Math.abs(nx) < 0.95 && Math.abs(ny) < 0.9) { el.style.display = 'none'; return; }
    const k = Math.max(Math.abs(nx) / 0.9, Math.abs(ny) / 0.84);
    let d = 99; for (const p of V.ps) d = Math.min(d, Math.hypot(p.x - B.x, p.z - B.z));
    el.style.display = 'flex'; el.style.left = (V.rect.x + (nx / k + 1) / 2 * V.rect.w).toFixed(1) + 'px'; el.style.top = (V.rect.y + (1 - ny / k) / 2 * V.rect.h).toFixed(1) + 'px';
    el.querySelector('i').style.transform = `rotate(${Math.atan2(-ny, nx).toFixed(3)}rad)`;
    el.querySelector('b').textContent = Math.round(d) + ' м';
  });
}

// каждый кадр из render(): всё, что рисуется поверх игры
function hudExtra(T) {
  const play = G.state === 'play' || G.state === 'levelup';
  const on = play || HUDL.on, rd = $('radarBox'); if (rd) rd.style.display = on ? 'block' : 'none';
  if (on && (RADAR.n++ & 1) === 0) radarDraw(T);
  hintsUpdate(); bossArrowUpdate(); evHud(T);
}
