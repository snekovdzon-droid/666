'use strict';
/* ---------- v0.29: статистика забега по игрокам, проклятые карточки, командные карточки ---------- */
let ATTR = null, LASTOWN = null;                              // ATTR — кому сейчас приписывается урон; LASTOWN — владелец последнего удара (для поджога и кровотечения)
function dzBy(o, ...a) { const pv = ATTR; ATTR = o || null; LASTOWN = ATTR; try { return damageZombie(...a); } finally { ATTR = pv; } }
const newRunStats = () => ({ kills: 0, dmg: 0, taken: 0, revives: 0, downs: 0, kpm: [] });

/* ---- командные карточки (только в коопе) ---- */
const mateDown = p => players.some(q => q !== p && q.down);
const rageMul = p => (L(p, 'rage') && mateDown(p)) ? 1.3 : 1;                                  // «Ярость»
const backMul = () => (ATTR && L(ATTR, 'backtoback') && players.some(q => q !== ATTR && !q.down && Math.abs(q.y - ATTR.y) < 1.5 && Math.hypot(q.x - ATTR.x, q.z - ATTR.z) < 2)) ? 1.2 : 1;   // «Спина к спине»: больше опыта с убитых тобой

/* ---- проклятия: сильный плюс и жёсткий минус, шанс ~8% на повышение, заменяют одну из трёх карточек, одно за забег ---- */
const CURSE_P = 0.08;
const CURSES = {
  edge:   { name: 'На грани',             plus: 'Урон +50%',                  minus: 'Максимум здоровья −1 сердце',     ok: p => p.maxHp > 2,
            apply: p => { p.st.dmg *= 1.5; p.maxHp -= 1; p.hp = Math.min(p.hp, p.maxHp); } },
  belt:   { name: 'Очень длинная лента',  plus: 'Магазин в 2 раза больше',    minus: 'Перезарядка дольше на 40%',
            apply: p => { p.st.mag *= 2; p.st.reload *= 1.4; } },
  weight: { name: 'Гиря к ноге',          plus: 'Скорострельность +40%',      minus: 'Скорость передвижения −30%',
            apply: p => { p.st.rate *= 1.4; p.st.speed *= 0.7; } },
};
function maybeCurse(p, out) {
  if (p.curse || out.length < 2 || Math.random() >= CURSE_P) return;
  const opts = Object.keys(CURSES).filter(id => !CURSES[id].ok || CURSES[id].ok(p)); if (!opts.length) return;
  const idx = out.map((c, i) => i).filter(i => !['branch', 'finale', 'fork', 'back'].includes(out[i].type)); if (!idx.length) return;
  out[idx[Math.floor(Math.random() * idx.length)]] = { type: 'curse', id: opts[Math.floor(Math.random() * opts.length)] };
}
function curseCardHtml(ch, key) {
  const C = CURSES[ch.id];
  return { cls: 'curse', html: `<span class="tag">ПРОКЛЯТИЕ</span><b>${C.name}</b><span class="pl">▲ ${C.plus}</span><span class="mi">▼ ${C.minus}</span><i>только одно за забег · ${key}</i>` };
}
function applyCurse(p, id) { p.curse = id; CURSES[id].apply(p); toast(p, 'Проклятие: ' + CURSES[id].name, '#ff6a5a'); SFX.hurt(); }

/* ---- экран итогов: таблица игроков, награды, график убийств по минутам ---- */
function statsHtml() {
  const P = players, co = P.length > 1, col = i => PLAYER_CSS[i] || '#ccc';
  const nm = (p, i) => (co ? `Игрок ${i + 1}` : 'Ты') + ` · ${CLASSES[p.gun].name}`;
  const rows = P.map((p, i) => `<tr><td style="color:${col(i)}">${nm(p, i)}${p.curse ? ` <em class="cs">☠ ${CURSES[p.curse].name}</em>` : ''}</td><td>${p.rs.kills}</td><td>${Math.round(p.rs.dmg)}</td><td>${p.rs.taken}</td>${co ? `<td>${p.rs.revives}</td><td>${p.rs.downs}</td>` : ''}</tr>`).join('');
  const table = `<table class="rs-tbl"><tr><th></th><th>Убито</th><th>Урон</th><th>Получено ♥</th>${co ? '<th>Подняты</th><th>Падений</th>' : ''}</tr>${rows}</table>`;
  let awards = '';
  if (co) {
    const top = (f) => { const m = Math.max(...P.map(f)); return m > 0 ? P.map((p, i) => f(p) === m ? i : -1).filter(i => i >= 0) : []; };
    const aw = [['★', 'Больше всего убийств', top(p => p.rs.kills)], ['✚', 'Спасатель', top(p => p.rs.revives)], ['↓', 'Часто падал', top(p => p.rs.downs)]]
      .filter(a => a[2].length).map(([ic, t, who]) => `<div class="rs-aw"><span>${ic}</span><b>${t}</b><em>${who.map(i => `<i style="color:${col(i)}">Игрок ${i + 1}</i>`).join(', ')}</em></div>`).join('');
    if (aw) awards = `<div class="rs-awards">${aw}</div>`;
  }
  const full = Math.floor(G.t / 60), M = Math.max(1, full + (G.t / 60 - full >= 0.5 ? 1 : 0)), W = 520, H = 120, pad = 22, series = P.map(p => Array.from({ length: M }, (_, m) => p.rs.kpm[m] || 0));
  const mx = Math.max(5, ...series.flat()), X = m => pad + (M > 1 ? m / (M - 1) : 0.5) * (W - pad * 2), Y = v => H - 18 - v / mx * (H - 34);
  const lines = series.map((s, i) => `<polyline fill="none" stroke="${col(i)}" stroke-width="2" points="${s.map((v, m) => X(m).toFixed(1) + ',' + Y(v).toFixed(1)).join(' ')}"/>`).join('');
  const ticks = Array.from({ length: M }, (_, m) => (m % Math.max(1, Math.round(M / 10)) === 0) ? `<text x="${X(m).toFixed(1)}" y="${H - 4}" text-anchor="middle">${m + 1}</text>` : '').join('');
  const graph = `<svg class="rs-graph" viewBox="0 0 ${W} ${H}"><line x1="${pad}" y1="${H - 18}" x2="${W - pad}" y2="${H - 18}" stroke="#4a4032"/><text x="2" y="12">${mx}</text>${lines}${ticks}</svg>`
    + (co ? `<div class="rs-leg">${P.map((p, i) => `<span style="color:${col(i)}">━ Игрок ${i + 1}</span>`).join('')}</div>` : '');
  return `<div class="rs-h">${co ? 'Игроки' : 'Твой забег'}</div>${table}${awards}<div class="rs-h">Убийств по минутам</div>${graph}`;
}

PIX.curse = ['..kkkkkk..', '.kwwwwwwk.', 'kwwwwwwwwk', 'kwkkwwkkwk', 'kwkkwwkkwk', 'kwwwrrwwwk', '.kwwwwwwk.', '..kwkwkwk.', '..kwkwkwk.', '...kkkkk..'];
