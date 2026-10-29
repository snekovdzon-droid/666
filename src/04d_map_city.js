'use strict';
/* ---------- Герой: данные (цвета, наборы, пресеты) и хранилище героев для редактора. Сама модель собирается кодом в 04k_hero_proc.js ---------- */
// Категории частей: поле героя, папка в assets/parts, подпись, есть ли отдельные файлы для мужского и женского (_m / _f), вариант «без этого»
const HERO_CATS = [
  { k: 'hairStyle', dir: 'hair', label: 'Причёска', none: ['bald', 'Лысый'] },
  { k: 'beard', dir: 'beard', label: 'Борода и усы', none: ['none', 'Нет'] },
  { k: 'topStyle', dir: 'tops', label: 'Нижний верх', gender: true },
  { k: 'legs', dir: 'legs', label: 'Низ' },
  { k: 'shoesStyle', dir: 'shoes', label: 'Обувь' },
  { k: 'glasses', dir: 'glasses', label: 'Очки', none: ['none', 'Нет'] },
];
const GENDERS = [['m', 'Мужской'], ['f', 'Женский']];
// варианты для кнопок редактора: [[id, название], …]
const heroOptions = cat => HERO_STYLES[cat.k];
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
  top: '#385670', topStyle: 'tee', outer: 'jacket', top2: '#385670', trim: '#878376', pants: '#4e523c', legs: 'long', shoesStyle: 'shoes', shoes: '#3a2c22',
  hat: 'none', hatCol: '#7a3a34', glasses: 'none', pack: 'pack', packCol: '#6b5435',
};
const HERO_PRESETS = [
  { name: 'Классика' },
  { name: 'Рыжая', gender: 'f', skin: '#eec39e', hair: '#b0452a', hairStyle: 'long', top2: '#d8d2c4', topStyle: 'tee', outer: 'none', pants: '#3a4a6a', shoesStyle: 'boots', shoes: '#5a3a22', pack: 'none' },
  { name: 'Бородач', skin: '#d9a77c', hair: '#6b4528', hairStyle: 'short', beard: 'full', top2: '#4e7a44', top: '#4e7a44', topStyle: 'tee', outer: 'hoodie', hat: 'beanie', hatCol: '#2e3648', pants: '#2a2e3a', shoesStyle: 'boots', shoes: '#1c1c1e' },
  { name: 'Байкерша', gender: 'f', skin: '#b57d56', hair: '#1a1412', hairStyle: 'bob', top: '#7a3a34', topStyle: 'tank', top2: '#1c1c1e', outer: 'jacket', trim: '#1c1c1e', glasses: 'dark', pants: '#1c1c1e', shoesStyle: 'boots', shoes: '#1c1c1e', pack: 'none' },
  { name: 'Ковбой', skin: '#d9a77c', hair: '#9a6a38', hairStyle: 'short', beard: 'mustache', top2: '#b08c34', topStyle: 'long', outer: 'vest', top: '#5a3a22', hat: 'cowboy', hatCol: '#5a3a22', pants: '#3a4a6a', shoesStyle: 'boots', shoes: '#5a3a22', pack: 'none' },
  { name: 'Панк', skin: '#f6d5b8', hair: '#d84a8a', hairStyle: 'mohawk', top2: '#1c1c1e', topStyle: 'tank', outer: 'none', pants: '#5a5e62', legs: 'shorts', shoesStyle: 'boots', shoes: '#1c1c1e', glasses: 'round', pack: 'none' },
].map(p => Object.assign({}, HERO_DEFAULT, p));
// герои, сохранённые прежней версией редактора (boots / pack как да-нет), приводим к нынешним полям
function heroNorm(h) {
  const a = Object.assign({}, HERO_DEFAULT, h);
  if (typeof a.pack === 'boolean') a.pack = a.pack ? 'pack' : 'none';
  if ('boots' in a) { if (!h.shoesStyle) a.shoesStyle = a.boots ? 'boots' : 'shoes'; delete a.boots; }
  if (!('outer' in h)) { const t = h.topStyle || 'jacket'; if (t === 'jacket' || t === 'hoodie') { a.outer = t; a.topStyle = 'tee'; } else { a.outer = 'none'; a.top2 = h.top || a.top2; } }   // v0.51: верх разделён на два слоя
  return a;
}

const hexRGB = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mixRGB = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const mulRGB = (a, k) => a.map(v => clamp(Math.round(v * k), 0, 255));
const HERO_SHADE = [0.95, 1, 1.05, 0.98];     // лёгкая «рябь» цвета по вокселям — как в нарисованных моделях

// Собрать данные модели (как после parseVox): { size, vox: [[x,y,z,цвет]], pal, part }
const genHeroVox = h => genHeroProc(h);

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
