#!/usr/bin/env node
// Разовый «семенной» скрипт: создаёт стартовые модели частей героя (.vox) в assets/parts/.
// После этого файлы живут своей жизнью — их правят в MagicaVoxel. Скрипт НЕ перезаписывает существующие файлы без --force.
//   node tools/gen_parts.js [--force]      затем      python3 tools/build_parts.py
const fs = require('fs'), path = require('path');
const FORCE = process.argv.includes('--force');
const OUT = path.join(__dirname, '..', 'assets', 'parts');

// Цвета-«метки» ролей. Воксель ровно такого цвета игра перекрашивает в выбранный игроком цвет; любой другой цвет остаётся как нарисован.
const ROLES = {
  skin: [205, 160, 125], hair: [100, 70, 40], brow: [90, 62, 36], eye: [28, 24, 22], mouth: [200, 110, 105], stubble: [160, 128, 104],
  beard: [120, 84, 48], top: [56, 86, 112], topDark: [44, 68, 90], trim: [135, 131, 118], strap: [80, 60, 38], pack: [107, 84, 53],
  pants: [78, 82, 60], belt: [50, 38, 26], buckle: [170, 150, 90], shoe: [58, 44, 34], sole: [34, 28, 24], hat: [122, 58, 52],
  hatBand: [86, 40, 36], glass: [22, 22, 26],
};
const ROLE_NAMES = Object.keys(ROLES);

function newPart() {
  const V = new Map();                                      // координаты сетки 15×11×64: y уже со сдвигом +1 (лицо смотрит на y = 1…)
  const put = (x, y, z, r) => { y += 1; if (x < 0 || x > 14 || y < 0 || y > 10 || z < 0 || z > 63) return; V.set(x + ',' + y + ',' + z, r); };
  const box = (x1, x2, y1, y2, z1, z2, r) => { for (let x = x1; x <= x2; x++) for (let y = y1; y <= y2; y++) for (let z = z1; z <= z2; z++) put(x, y, z, r); };
  const del = (x, y, z) => V.delete(x + ',' + (y + 1) + ',' + z);
  return { V, put, box, del };
}
const MOUTH = [6, 7, 8];

/* ---------- тело (без одежды): кожа + лицо ---------- */
function body(F) {
  const { V, put, box } = newPart();
  const tx = F ? [4, 10] : [3, 11], arms = F ? [[1, 2], [12, 13]] : [[0, 1], [13, 14]];
  for (const [x1, x2] of [[3, 5], [9, 11]]) { box(x1, x2, 1, 5, 0, 1, 'skin'); box(x1, x2, 2, 5, 2, 4, 'skin'); box(x1, x2, 3, 5, 5, 25, 'skin'); }   // ноги и ступни
  box(3, 11, 3, 7, 26, 32, 'skin');                                       // таз
  box(tx[0], tx[1], 3, 7, 33, 44, 'skin');                                // торс
  for (const [x1, x2] of arms) box(x1, x2, 4, 6, 24, 44, 'skin');
  box(arms[0][0], arms[1][1], 3, 7, 45, 47, 'skin');                      // плечи
  box(6, 8, 4, 6, 48, 50, 'skin');                                        // шея
  box(4, 10, 2, 7, 51, 61, 'skin'); box(5, 9, 2, 7, 62, 62, 'skin');     // голова
  put(5, 2, 57, 'eye'); put(9, 2, 57, 'eye');
  for (const x of [5, 6, 8, 9]) put(x, 2, 59, 'brow');
  for (const x of MOUTH) put(x, 2, 53, 'mouth');
  return V;
}

/* ---------- низ и обувь ---------- */
function legs(kind) {
  const { V, box, put } = newPart();
  for (const [x1, x2] of [[3, 5], [9, 11]]) box(x1, x2, 3, 5, kind === 'shorts' ? 18 : 5, 25, 'pants');
  box(3, 11, 3, 7, 26, 30, 'pants'); box(3, 11, 3, 7, 31, 32, 'belt'); put(7, 3, 31, 'buckle'); put(7, 3, 32, 'buckle');
  return V;
}
function shoes(kind) {
  const { V, box } = newPart();
  for (const [x1, x2] of [[3, 5], [9, 11]]) { box(x1, x2, 1, 5, 0, 1, 'sole'); box(x1, x2, 2, 5, 2, 4, 'shoe'); if (kind === 'boots') box(x1, x2, 3, 5, 5, 9, 'shoe'); }
  return V;
}

/* ---------- верх ---------- */
function top(style, F) {
  const { V, box, put } = newPart();
  const tx = F ? [4, 10] : [3, 11], arms = F ? [[1, 2], [12, 13]] : [[0, 1], [13, 14]];
  const sleeve = { jacket: 34, long: 34, hoodie: 34, tee: 40, tank: 99 }[style];
  box(tx[0], tx[1], 3, 7, 33, 44, 'top');
  for (const [x1, x2] of arms) if (sleeve <= 44) box(x1, x2, 4, 6, sleeve, 44, 'top');
  if (style === 'tank') box(tx[0], tx[1], 3, 7, 45, 47, 'top'); else box(arms[0][0], arms[1][1], 3, 7, 45, 47, 'top');
  if (style === 'jacket') box(6, 8, 3, 3, 35, 44, 'trim');
  if (style === 'hoodie') {
    box(4, 10, 7, 8, 46, 50, 'top'); box(5, 9, 2, 2, 34, 37, 'topDark');
    for (const [x, z] of [[6, 42], [6, 43], [8, 42], [8, 43]]) put(x, 3, z, 'trim');
  }
  if (F) { box(5, 6, 2, 2, 40, 42, 'top'); box(8, 9, 2, 2, 40, 42, 'top'); }
  return V;
}
function pack(F) {
  const { V, box } = newPart();
  const tx = F ? [4, 10] : [3, 11];
  box(4, 10, 8, 8, 34, 44, 'pack');
  for (const x of [tx[0] + 1, tx[1] - 1]) box(x, x, 3, 7, 39, 46, 'strap');
  return V;
}

/* ---------- голова: волосы, бороды, головные уборы, очки ---------- */
function hair(style) {
  const { V, box, put } = newPart(), H = (...a) => box(...a, 'hair');
  const cap = () => { H(4, 10, 3, 7, 60, 60); H(4, 10, 2, 7, 61, 61); H(5, 9, 2, 7, 62, 62); };
  const sidesBack = () => { H(4, 4, 3, 6, 56, 59); H(10, 10, 3, 6, 56, 59); H(4, 10, 7, 7, 52, 60); };
  switch (style) {
    case 'buzz': H(4, 10, 3, 7, 60, 60); H(5, 9, 3, 6, 61, 61); H(4, 4, 4, 6, 58, 59); H(10, 10, 4, 6, 58, 59); H(4, 10, 7, 7, 57, 60); break;
    case 'short': cap(); sidesBack(); break;
    case 'spiky': H(4, 10, 3, 7, 60, 60); H(4, 10, 2, 7, 61, 61); H(5, 9, 3, 7, 62, 62); sidesBack(); for (const [x, y] of [[5, 4], [7, 3], [7, 5], [9, 4], [6, 6], [8, 6]]) H(x, x, y, y, 63, 63); break;
    case 'long': cap(); sidesBack(); H(3, 3, 3, 7, 48, 60); H(11, 11, 3, 7, 48, 60); H(4, 4, 4, 7, 48, 55); H(10, 10, 4, 7, 48, 55); H(4, 10, 7, 7, 46, 51); H(4, 10, 8, 8, 46, 60); break;
    case 'bob': cap(); sidesBack(); H(4, 10, 2, 2, 58, 60); H(3, 3, 3, 7, 50, 59); H(11, 11, 3, 7, 50, 59); H(4, 10, 7, 7, 50, 51); H(4, 10, 8, 8, 50, 60); break;
    case 'tail': cap(); sidesBack(); H(7, 7, 8, 8, 55, 60); H(7, 7, 9, 9, 49, 56); put(7, 8, 55, 'trim'); break;
    case 'bun': cap(); sidesBack(); H(6, 8, 5, 7, 62, 63); break;
    case 'mohawk': H(7, 7, 2, 7, 60, 63); H(6, 8, 3, 6, 61, 62); H(7, 7, 7, 8, 55, 60); break;
    case 'afro': H(3, 11, 1, 8, 59, 63); H(2, 12, 2, 7, 56, 62); H(3, 11, 7, 8, 52, 58); break;
  }
  return V;
}
function beard(style) {
  const { V, box, del } = newPart(), B = (x1, x2, y1, y2, z1, z2, r = 'beard') => box(x1, x2, y1, y2, z1, z2, r);
  switch (style) {
    case 'stubble': B(4, 10, 2, 2, 51, 54, 'stubble'); B(4, 4, 3, 5, 51, 54, 'stubble'); B(10, 10, 3, 5, 51, 54, 'stubble'); break;
    case 'mustache': B(5, 9, 2, 2, 54, 54); B(6, 8, 1, 1, 54, 54); break;
    case 'goatee': B(5, 9, 2, 2, 54, 54); B(6, 8, 1, 1, 54, 54); B(6, 8, 2, 2, 51, 52); B(6, 8, 1, 1, 50, 52); break;
    case 'short': B(4, 10, 2, 2, 51, 55); B(4, 4, 3, 6, 51, 55); B(10, 10, 3, 6, 51, 55); B(5, 9, 1, 1, 51, 52); break;
    case 'full': B(4, 10, 2, 2, 51, 56); B(4, 4, 3, 6, 51, 57); B(10, 10, 3, 6, 51, 57); B(5, 9, 1, 1, 50, 55); B(3, 3, 3, 5, 51, 54); B(11, 11, 3, 5, 51, 54); break;
    case 'long': B(4, 10, 2, 2, 49, 56); B(4, 4, 3, 6, 51, 57); B(10, 10, 3, 6, 51, 57); B(5, 9, 1, 1, 48, 55); B(6, 8, 0, 0, 45, 49); B(5, 9, 2, 2, 46, 48); break;
    case 'chops': B(4, 4, 2, 4, 53, 58); B(10, 10, 2, 4, 53, 58); break;
  }
  for (const x of MOUTH) { del(x, 2, 53); del(x, 1, 53); }               // рот остаётся открытым
  return V;
}
function hat(style) {
  const { V, box, del } = newPart(), T = (...a) => box(...a, 'hat');
  switch (style) {
    case 'cap': T(4, 10, 2, 7, 60, 61); T(5, 9, 3, 7, 62, 62); T(4, 10, 3, 7, 59, 59); T(4, 10, 0, 1, 60, 60); break;
    case 'beanie': T(3, 11, 1, 8, 58, 60); T(4, 10, 2, 7, 61, 62); T(6, 8, 3, 6, 63, 63); box(3, 11, 1, 8, 58, 58, 'hatBand'); break;
    case 'bandana': T(3, 11, 1, 8, 60, 61); T(6, 8, 9, 9, 59, 61); T(5, 9, 8, 8, 58, 59); break;
    case 'cowboy': T(1, 13, -1, 9, 60, 60); for (const [x, y] of [[1, -1], [13, -1], [1, 9], [13, 9]]) del(x, y, 60); T(4, 10, 2, 7, 61, 62); T(5, 9, 3, 6, 63, 63); box(4, 10, 2, 7, 61, 61, 'hatBand'); break;
  }
  return V;
}
function glasses(kind) {
  const { V, box, put, del } = newPart();
  for (const [x1, x2] of [[4, 6], [8, 10]]) { box(x1, x2, 1, 1, 56, 58, 'glass'); if (kind === 'round') del((x1 + x2) / 2, 1, 57); }
  put(7, 1, 58, 'glass'); box(4, 4, 2, 4, 58, 58, 'glass'); box(10, 10, 2, 4, 58, 58, 'glass');
  return V;
}

/* ---------- запись .vox ---------- */
function toVox(V) {
  const u32 = v => [v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255], tag = s => [...s].map(c => c.charCodeAt(0));
  const chunk = (id, content, children = []) => [...tag(id), ...u32(content.length), ...u32(children.length), ...content, ...children];
  const vox = [...V].map(([k, r]) => { const [x, y, z] = k.split(',').map(Number); return [x, y, z, ROLE_NAMES.indexOf(r) + 1]; });
  const pal = Array.from({ length: 256 }, (_, i) => i < ROLE_NAMES.length ? ROLES[ROLE_NAMES[i]] : [150 + (i % 8) * 4, 150 + (i % 8) * 4, 150 + (i % 8) * 4]);
  const size = chunk('SIZE', [...u32(15), ...u32(11), ...u32(64)]);
  const xyzi = chunk('XYZI', [...u32(vox.length), ...vox.flatMap(v => v)]);
  const rgba = chunk('RGBA', pal.flatMap(c => [c[0], c[1], c[2], 255]));
  return Buffer.from([...tag('VOX '), ...u32(150), ...chunk('MAIN', [], [...size, ...xyzi, ...rgba])]);
}
let wrote = 0, kept = 0;
function emit(dir, name, V) {
  const f = path.join(OUT, dir, name + '.vox');
  if (fs.existsSync(f) && !FORCE) { kept++; return; }
  fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, toVox(V)); wrote++;
}

emit('body', 'male', body(false)); emit('body', 'female', body(true));
for (const k of ['long', 'shorts']) emit('legs', k, legs(k));
for (const k of ['shoes', 'boots']) emit('shoes', k, shoes(k));
for (const k of ['jacket', 'tee', 'long', 'hoodie', 'tank']) { emit('tops', k + '_m', top(k, false)); emit('tops', k + '_f', top(k, true)); }
emit('pack', 'pack_m', pack(false)); emit('pack', 'pack_f', pack(true));
for (const k of ['buzz', 'short', 'spiky', 'long', 'bob', 'tail', 'bun', 'mohawk', 'afro']) emit('hair', k, hair(k));
for (const k of ['stubble', 'mustache', 'goatee', 'short', 'full', 'long', 'chops']) emit('beard', k, beard(k));
for (const k of ['cap', 'beanie', 'bandana', 'cowboy']) emit('hats', k, hat(k));
for (const k of ['dark', 'round']) emit('glasses', k, glasses(k));

// порядок и русские названия в редакторе (новые файлы, которых тут нет, добавляются в конец под именем файла)
const names = path.join(OUT, 'names.json');
if (!fs.existsSync(names) || FORCE) fs.writeFileSync(names, JSON.stringify({
  hair: [['short', 'Короткая'], ['buzz', 'Бокс'], ['spiky', 'Ёжик'], ['long', 'Длинные'], ['bob', 'Каре'], ['tail', 'Хвост'], ['bun', 'Пучок'], ['mohawk', 'Ирокез'], ['afro', 'Афро']],
  beard: [['stubble', 'Щетина'], ['mustache', 'Усы'], ['goatee', 'Эспаньолка'], ['short', 'Короткая'], ['full', 'Полная'], ['long', 'Длинная'], ['chops', 'Бакенбарды']],
  tops: [['jacket', 'Куртка'], ['tee', 'Футболка'], ['long', 'Лонгслив'], ['hoodie', 'Худи'], ['tank', 'Майка']],
  legs: [['long', 'Брюки'], ['shorts', 'Шорты']],
  shoes: [['shoes', 'Ботинки'], ['boots', 'Высокие ботинки']],
  hats: [['cap', 'Кепка'], ['beanie', 'Шапка'], ['bandana', 'Повязка'], ['cowboy', 'Ковбойская']],
  glasses: [['dark', 'Тёмные'], ['round', 'Круглые']],
  pack: [['pack', 'Рюкзак']],
}, null, 1));
console.log(`создано файлов: ${wrote}, оставлено как есть: ${kept}`);
