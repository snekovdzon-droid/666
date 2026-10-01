'use strict';
/* ---------- Сборка воксельного героя из частей для редактора персонажа ----------
   Каждая часть (тело, причёска, борода, верх, низ, обувь, шляпа, очки, рюкзак) — отдельный файл .vox в assets/parts/
   на одной сетке 15×11×64 (лицо смотрит на y = 0). Редактор накладывает части друг на друга в таком порядке:
   тело → низ → обувь → верх → рюкзак → причёска → борода → головной убор → очки; позже наложенное перекрывает раннее.
   Цвет-«метка» (см. ROLES) игра заменяет на выбранный в редакторе цвет, любой другой цвет остаётся как нарисован.
   Файлы собирает в assets/parts.js скрипт tools/build_parts.py (PART_FILES — base64 файлов, PART_LIST — порядок и названия). */
const HERO_SIZE = [15, 11, 64];
const HERO_ROLES = ['skin', 'hair', 'brow', 'eye', 'mouth', 'stubble', 'beard', 'top', 'topDark', 'trim', 'strap', 'pack', 'pants', 'belt', 'buckle', 'shoe', 'sole', 'hat', 'hatBand', 'glass'];
const ROLE_RGB = [[205, 160, 125], [100, 70, 40], [90, 62, 36], [28, 24, 22], [200, 110, 105], [160, 128, 104], [120, 84, 48], [56, 86, 112], [44, 68, 90], [135, 131, 118],
  [80, 60, 38], [107, 84, 53], [78, 82, 60], [50, 38, 26], [170, 150, 90], [58, 44, 34], [34, 28, 24], [122, 58, 52], [86, 40, 36], [22, 22, 26]];
const ROLE_BY_RGB = new Map(ROLE_RGB.map((c, i) => [(c[0] << 16) | (c[1] << 8) | c[2], i]));

// Категории частей: поле героя, папка в assets/parts, подпись, есть ли отдельные файлы для мужского и женского (_m / _f), вариант «без этого»
const HERO_CATS = [
  { k: 'hairStyle', dir: 'hair', label: 'Причёска', none: ['bald', 'Лысый'] },
  { k: 'beard', dir: 'beard', label: 'Борода и усы', none: ['none', 'Нет'] },
  { k: 'topStyle', dir: 'tops', label: 'Верх', gender: true },
  { k: 'legs', dir: 'legs', label: 'Низ' },
  { k: 'shoesStyle', dir: 'shoes', label: 'Обувь' },
  { k: 'hat', dir: 'hats', label: 'Головной убор', none: ['none', 'Нет'] },
  { k: 'glasses', dir: 'glasses', label: 'Очки', none: ['none', 'Нет'] },
  { k: 'pack', dir: 'pack', label: 'Рюкзак', gender: true, none: ['none', 'Нет'] },
];
const GENDERS = [['m', 'Мужской'], ['f', 'Женский']];
const HERO_SWATCH = {
  skin: ['#f6d5b8', '#eec39e', '#d9a77c', '#cd9d77', '#b57d56', '#8d5a3a', '#6b4129', '#4a2c1c'],
  hair: ['#1a1412', '#432c1c', '#6b4528', '#9a6a38', '#c8a050', '#e0c878', '#b0452a', '#8a8a8a', '#e8e8e8', '#3a6aa8', '#8a3aa8', '#d84a8a'],
  cloth: ['#385670', '#9a5040', '#4e7a44', '#b08c34', '#2e3648', '#5a5e62', '#d8d2c4', '#d8702a', '#7a3a34', '#3c4e6e', '#1c1c1e', '#6e7a3a'],
  pants: ['#4e523c', '#2a2e3a', '#3a4a6a', '#5a4a38', '#2c3a2e', '#6a6e72', '#1c1c1e', '#8a7a58'],
  shoes: ['#3a2c22', '#1c1c1e', '#5a3a22', '#d8d2c4', '#6a1a1a'],
};
// Новый герой — «Классика» (похожа на базового героя игры)
const HERO_DEFAULT = {
  name: 'Новый герой', gender: 'm', skin: '#cd9d77', hair: '#432c1c', hairStyle: 'short', beard: 'none', beardCol: '',
  top: '#385670', topStyle: 'jacket', trim: '#878376', pants: '#4e523c', legs: 'long', shoesStyle: 'shoes', shoes: '#3a2c22',
  hat: 'none', hatCol: '#7a3a34', glasses: 'none', pack: 'pack', packCol: '#6b5435',
};
const HERO_PRESETS = [
  { name: 'Классика' },
  { name: 'Рыжая', gender: 'f', skin: '#eec39e', hair: '#b0452a', hairStyle: 'long', top: '#d8d2c4', topStyle: 'tee', pants: '#3a4a6a', shoesStyle: 'boots', shoes: '#5a3a22', pack: 'none' },
  { name: 'Бородач', skin: '#d9a77c', hair: '#6b4528', hairStyle: 'short', beard: 'full', top: '#4e7a44', topStyle: 'hoodie', hat: 'beanie', hatCol: '#2e3648', pants: '#2a2e3a', shoesStyle: 'boots', shoes: '#1c1c1e' },
  { name: 'Байкерша', gender: 'f', skin: '#b57d56', hair: '#1a1412', hairStyle: 'bob', top: '#7a3a34', topStyle: 'jacket', trim: '#1c1c1e', glasses: 'dark', pants: '#1c1c1e', shoesStyle: 'boots', shoes: '#1c1c1e', pack: 'none' },
  { name: 'Ковбой', skin: '#d9a77c', hair: '#9a6a38', hairStyle: 'short', beard: 'mustache', top: '#b08c34', topStyle: 'long', hat: 'cowboy', hatCol: '#5a3a22', pants: '#3a4a6a', shoesStyle: 'boots', shoes: '#5a3a22', pack: 'none' },
  { name: 'Панк', skin: '#f6d5b8', hair: '#d84a8a', hairStyle: 'mohawk', top: '#1c1c1e', topStyle: 'tank', pants: '#5a5e62', legs: 'shorts', shoesStyle: 'boots', shoes: '#1c1c1e', glasses: 'round', pack: 'none' },
].map(p => Object.assign({}, HERO_DEFAULT, p));
// герои, сохранённые прежней версией редактора (boots / pack как да-нет), приводим к нынешним полям
function heroNorm(h) {
  const a = Object.assign({}, HERO_DEFAULT, h);
  if (typeof a.pack === 'boolean') a.pack = a.pack ? 'pack' : 'none';
  if ('boots' in a) { if (!h.shoesStyle) a.shoesStyle = a.boots ? 'boots' : 'shoes'; delete a.boots; }
  return a;
}

const hexRGB = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mixRGB = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const mulRGB = (a, k) => a.map(v => clamp(Math.round(v * k), 0, 255));
const HERO_SHADE = [0.95, 1, 1.05, 0.98];     // лёгкая «рябь» цвета по вокселям — как в нарисованных моделях

/* ---------- части: встроенные (PART_FILES) и свои, загруженные в редакторе (хранятся в браузере) ---------- */
const CUSTOM_PARTS = lsGet('customParts', {});     // { 'hair/curly': { name, b64 } }
const PART_CACHE = {};
const partB64 = key => PART_FILES[key] || (CUSTOM_PARTS[key] && CUSTOM_PARTS[key].b64) || null;
// воксели части: [x, y, z, номер роли или −1, [r,g,b] для обычного цвета]
function partVox(key) {
  if (PART_CACHE[key]) return PART_CACHE[key];
  let out = [];
  try {
    const M = parseVox(partB64(key));
    out = M.vox.map(([x, y, z, c]) => { const p = M.pal[c - 1], role = ROLE_BY_RGB.get((p[0] << 16) | (p[1] << 8) | p[2]); return [x, y, z, role === undefined ? -1 : role, p]; });
  } catch (e) { console.warn('Не прочитана часть героя', key, e); }
  return PART_CACHE[key] = out;
}
// какой файл взять для категории: у одежды сначала _m / _f по полу героя
function partKey(cat, id, gender) {
  if (!id || (cat.none && id === cat.none[0])) return null;
  const tries = cat.gender ? [`${cat.dir}/${id}_${gender}`, `${cat.dir}/${id}_m`, `${cat.dir}/${id}`] : [`${cat.dir}/${id}`];
  return tries.find(partB64) || null;
}
// варианты для кнопок редактора: [[id, название], …]
function heroOptions(cat) {
  const list = [...(cat.none ? [cat.none] : []), ...(PART_LIST[cat.dir] || [])];
  for (const key in CUSTOM_PARTS) {
    if (!key.startsWith(cat.dir + '/')) continue;
    const id = key.slice(cat.dir.length + 1).replace(/_[mf]$/, '');
    if (!list.some(o => o[0] === id)) list.push([id, '★ ' + CUSTOM_PARTS[key].name]);
  }
  return list;
}
// загрузить свой .vox в категорию (в имени файла _f / _m — для женского / мужского тела)
function heroAddCustom(cat, fileName, buf) {
  let b64 = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 8192) b64 += String.fromCharCode.apply(null, u.subarray(i, i + 8192));
  b64 = btoa(b64); parseVox(b64);                                   // проверка: если файл не .vox — бросит ошибку
  const base = fileName.replace(/\.vox$/i, '').replace(/[^\wа-яё-]+/gi, '_'), g = base.match(/_([mf])$/), stem = base.replace(/_[mf]$/, ''), id = 'c_' + stem;
  const key = cat.gender ? `${cat.dir}/${id}_${g ? g[1] : 'm'}` : `${cat.dir}/${id}`;
  CUSTOM_PARTS[key] = { name: stem, b64 }; delete PART_CACHE[key]; lsSet('customParts', CUSTOM_PARTS);
  return id;
}
function heroRemoveCustom(cat, id) {
  for (const key of [`${cat.dir}/${id}`, `${cat.dir}/${id}_m`, `${cat.dir}/${id}_f`]) { delete CUSTOM_PARTS[key]; delete PART_CACHE[key]; }
  lsSet('customParts', CUSTOM_PARTS);
}

// Собрать данные модели (как после parseVox): { size, vox: [[x,y,z,цвет]], pal }
function genHeroVox(h) {
  const a = heroNorm(h), F = a.gender === 'f', V = new Map();
  const lay = key => { if (key) for (const v of partVox(key)) V.set(v[0] + ',' + v[1] + ',' + v[2], v); };
  const cat = k => HERO_CATS.find(c => c.k === k);
  lay(`body/${F ? 'female' : 'male'}`);
  lay(partKey({ dir: 'legs' }, a.legs)); lay(partKey({ dir: 'shoes' }, a.shoesStyle));
  for (const k of ['topStyle', 'pack', 'hairStyle', 'beard', 'hat', 'glasses']) lay(partKey(cat(k), a[k], a.gender));
  /* палитра: каждая роль × 4 оттенка (индексы 1…80), дальше — обычные цвета из файлов */
  const sk = hexRGB(a.skin), hr = hexRGB(a.hair), bd = hexRGB(a.beardCol || a.hair), tp = hexRGB(a.top), pn = hexRGB(a.pants), sh = hexRGB(a.shoes), ht = hexRGB(a.hatCol), pk = hexRGB(a.packCol);
  const base = {
    skin: sk, hair: hr, brow: mulRGB(hr, 0.85), eye: [28, 24, 22], mouth: F ? mixRGB(sk, [196, 72, 84], 0.55) : mixRGB(sk, [150, 70, 60], 0.5),
    stubble: mixRGB(sk, bd, 0.5), beard: bd, top: tp, topDark: mulRGB(tp, 0.78), trim: hexRGB(a.trim), strap: mulRGB(pk, 0.75), pack: pk,
    pants: pn, belt: mixRGB(mulRGB(pn, 0.55), [63, 48, 32], 0.4), buckle: [170, 150, 90], shoe: sh, sole: mulRGB(sh, 0.55),
    hat: ht, hatBand: mulRGB(ht, 0.7), glass: a.glasses === 'round' ? [48, 44, 40] : [22, 22, 26],
  };
  const pal = Array.from({ length: 256 }, () => [180, 180, 180]), lit = new Map(); let nLit = HERO_ROLES.length * 4;
  HERO_ROLES.forEach((r, i) => HERO_SHADE.forEach((k, s) => { pal[i * 4 + s] = mulRGB(base[r], k); }));
  const litIndex = c => {
    const key = c.join(','); let i = lit.get(key); if (i !== undefined) return i;
    if (nLit < 255) { pal[nLit] = c; i = ++nLit; }
    else { let best = 1e9; for (const [k2, j] of lit) { const d = k2.split(',').reduce((s, v, t) => s + (v - c[t]) ** 2, 0); if (d < best) { best = d; i = j; } } }
    lit.set(key, i); return i;
  };
  const vox = [];
  for (const v of V.values()) vox.push([v[0], v[1], v[2], v[3] >= 0 ? v[3] * 4 + ((v[0] * 7 + v[1] * 13 + v[2] * 5) & 3) + 1 : litIndex(v[4])]);
  const size = HERO_SIZE.slice(); size.armL = F ? 3 : 2.1; size.armR = F ? 11 : 12.9;     // где проходит граница рук
  return { size, vox, pal };
}

// Герой как файл MagicaVoxel (.vox) — можно открыть, дорисовать и вернуть в игру
function heroToVoxFile(data) {
  const n = data.vox.length;
  const u32 = v => [v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255];
  const tag = s => [...s].map(c => c.charCodeAt(0));
  const chunk = (id, content, children = []) => [...tag(id), ...u32(content.length), ...u32(children.length), ...content, ...children];
  const size = chunk('SIZE', [...u32(data.size[0]), ...u32(data.size[1]), ...u32(data.size[2])]);
  const xyzi = chunk('XYZI', [...u32(n), ...data.vox.flatMap(v => [v[0], v[1], v[2], v[3]])]);
  const rgba = chunk('RGBA', data.pal.flatMap(c => [c[0], c[1], c[2], 255]));
  return new Uint8Array([...tag('VOX '), ...u32(150), ...chunk('MAIN', [], [...size, ...xyzi, ...rgba])]);
}

/* ---------- Хранилище героев: список в браузере, выбор для каждого игрока ---------- */
const HEROES = { list: [], sel: lsGet('heroSel', ['', '', '', '']) };
{
  const saved = lsGet('heroes', null);
  HEROES.list = (saved && saved.length ? saved : HERO_PRESETS.map((p, i) => Object.assign({ id: 'p' + i }, p))).map(heroNorm);
  if (!saved) lsSet('heroes', HEROES.list);
}
const heroById = id => HEROES.list.find(h => h.id === id) || null;
function heroSave() { lsSet('heroes', HEROES.list); lsSet('heroSel', HEROES.sel); }
