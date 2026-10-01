'use strict';
/* ---------- Окна в едином стиле: карточки перков, пауза, экран итогов забега ---------- */
Object.assign(PIX, {
  gun: ['..........', '..........', '.kkkkkkkk.', 'kGGGGGGGGk', 'kGggggkkkk', '.kkkGGk...', '...kGGk...', '...kGGk...', '....kk....', '..........'],
  star: ['....kk....', '....kyk...', '...kyyyk..', 'kkkkyyykkk', '.kyyyyyyyk', '..kyyyyyk.', '..kyyykyk.', '.kyykkkyyk', '.kkk...kkk', '..........'],
  path: ['..........', '.k......k.', '.kp....pk.', '..kp..pk..', '...kppk...', '....pp....', '....pp....', '....pp....', '....kk....', '..........'],
  perkgen: ['..........', '....kk....', '...kllk...', '..kllllk..', '.kllkkllk.', 'kllk..kllk', '..........', '....kk....', '...kllk...', '..kllllk..'],
});
const cardIcon = (p, ch) => ch.type === 'perk' ? (ch.perk.br === 'item' ? ch.perk.item : ch.perk.br === 'wpn' ? 'gun' : 'perkgen')
  : ch.type === 'itemlv' || ch.type === 'dev' || ch.type === 'att' ? ch.id : ch.type === 'finale' ? 'star' : ch.type === 'fork' || ch.type === 'branch' ? 'path' : ch.type === 'back' ? 'perkgen' : 'medkit';

// Готовая карточка: берём тексты из cardHTML (09_perks_items.js) и раскладываем по новой вёрстке
function cardView(p, ch, i) {
  const c = cardHTML(p, ch, i), t = document.createElement('div'); t.innerHTML = c.html;
  const tag = t.children[0].textContent, name = t.children[1].textContent, desc = t.children[2].innerHTML, foot = t.children[3].textContent;
  const m = foot.match(/ур\. (\d+) → (\d+) из (\d+)/), key = (foot.match(/(\d)\s*$/) || [0, i + 1])[1];
  const rest = foot.replace(/\s*·?\s*\d\s*$/, '').replace(/ур\. \d+ → \d+ из \d+\s*·?\s*/, '').trim();
  let bar = '';
  if (m) { const a = +m[1], b = +m[2], mx = +m[3]; bar = `<div class="lvbar">${Array.from({ length: mx }, (_, k) => `<i class="${k < a ? 'on' : k < b ? 'nw' : ''}"></i>`).join('')}</div><span>ур. ${a} → ${b} из ${mx}</span>`; }
  const html = `<span class="pc-key">${key}</span><div class="pc-head"><div class="pc-ico">${pixIcon(cardIcon(p, ch), 34)}</div><div><div class="pc-tag">${tag}</div><div class="pc-name">${name}</div></div></div>`
    + `<div class="pc-desc">${desc}</div><div class="pc-foot">${bar}${rest ? `<span>${rest}</span>` : ''}</div>`;
  return { cls: c.cls, html };
}

// строка снаряжения игрока: предметы, девайсы, обвесы
function gearRow(p) {
  const it = Object.keys(p.known || {}).filter(id => ITEMS[id]).map(id => `<span class="gi" title="${ITEMS[id].name}">${pixIcon(id, 20)}ур.${itemLv(p, id)}</span>`);
  const dv = Object.keys(p.dev || {}).map(id => `<span class="gi dv" title="${DEVICES[id].name}">${pixIcon(id, 20)}ур.${p.dev[id]}</span>`);
  const at = Object.keys(p.att || {}).map(id => `<span class="gi at" title="${ATTACH[id].name}">${pixIcon(id, 20)}${ATTACH[id].name}</span>`);
  const all = [...it, ...dv, ...at];
  return all.length ? `<div class="gear">${all.join('')}</div>` : '';
}
const playerBlock = p => `<div class="rs-pl" style="--pc:${PLAYER_CSS[p.idx]}"><b style="color:${PLAYER_CSS[p.idx]}">${players.length > 1 ? 'ИГРОК ' + (p.idx + 1) + ' · ' : ''}${CLASSES[p.gun].name} · ${WEAPONS[p.gun].name}</b>${gearRow(p)}<div>${buildText(p)}</div></div>`;
const pauseHtml = () => players.map(playerBlock).join('');

// Экран итогов: время, уровень, убийства, рекорд, кто сколько, сборка
function resultsHtml(win) {
  const co = players.length > 1, best = lsGet('best', { t: 0, kills: 0, level: 0 });
  const rec = { t: Math.max(best.t, Math.floor(G.t)), kills: Math.max(best.kills, G.kills), level: Math.max(best.level, G.level) };
  const newRec = Math.floor(G.t) > best.t || G.kills > best.kills; lsSet('best', rec);
  const stat = (k, v, sub = '', cls = '') => `<div class="rs-stat ${cls}"><span>${k}</span><b>${v}</b><small>${sub}</small></div>`;
  const kb = Object.entries(G.killsBy || {}).sort((a, b) => b[1] - a[1]), mx = kb.length ? kb[0][1] : 1;
  const rows = kb.map(([t, n]) => `<div class="rs-row"><span>${ZOMBIES[t].name}</span><div><i style="width:${(n / mx * 100).toFixed(0)}%;background:${ZOMBIES[t].col}"></i></div><b>${n}</b></div>`).join('');
  return `<div class="rs-stats">${stat('ВРЕМЯ', fmtT(G.t), 'из ' + fmtT(RUN_TIME), newRec ? 'rec' : '')}${stat('УРОВЕНЬ', G.level, 'рекорд ' + rec.level)}${stat('УБИТО', G.kills, newRec ? 'новый рекорд!' : 'рекорд ' + rec.kills, newRec ? 'rec' : '')}${stat('НАЧАЛЬНИК', G.bossKills ? '☠ ×' + G.bossKills : '—', G.bossKills ? 'повержен' : (G.bossN ? 'не победили' : 'не вышел'))}</div>`
    + (rows ? `<div class="rs-h">Кого убили</div>${rows}` : '') + `<div class="rs-h">Сборка</div>${players.map(playerBlock).join('')}`;
}
