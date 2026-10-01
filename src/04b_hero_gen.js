'use strict';
/* ---------- Генератор воксельного героя для редактора персонажа ----------
   Герой собирается из коробок на сетке 15×11×64 (как базовый герой, только на 2 слоя глубже: волосы, борода, шляпа).
   Внутри: x — вправо, y — вглубь (лицо смотрит на y = 0), z — вверх. В коде ниже y считается «логически» от −1 до 9,
   перед записью в модель сдвигается на +1.
   Части тела режет buildVoxModel по координатам (голова z ≥ 50, руки по краям, ноги ниже z = 32) —
   поэтому новые причёски, бороды и одежда сразу двигаются вместе с телом. */
const HERO_SIZE = [15, 11, 64];
const HAIR_STYLES = [['bald', 'Лысый'], ['buzz', 'Бокс'], ['short', 'Короткая'], ['spiky', 'Ёжик'], ['long', 'Длинные'], ['bob', 'Каре'], ['tail', 'Хвост'], ['bun', 'Пучок'], ['mohawk', 'Ирокез'], ['afro', 'Афро']];
const BEARDS = [['none', 'Нет'], ['stubble', 'Щетина'], ['mustache', 'Усы'], ['goatee', 'Эспаньолка'], ['short', 'Короткая'], ['full', 'Полная'], ['long', 'Длинная'], ['chops', 'Бакенбарды']];
const TOPS = [['jacket', 'Куртка'], ['tee', 'Футболка'], ['long', 'Лонгслив'], ['hoodie', 'Худи'], ['tank', 'Майка']];
const HATS = [['none', 'Нет'], ['cap', 'Кепка'], ['beanie', 'Шапка'], ['bandana', 'Повязка'], ['cowboy', 'Ковбойская']];
const GLASSES = [['none', 'Нет'], ['dark', 'Тёмные'], ['round', 'Круглые']];
const LEGS = [['long', 'Брюки'], ['shorts', 'Шорты']];
const GENDERS = [['m', 'Мужской'], ['f', 'Женский']];
const HERO_SWATCH = {
  skin: ['#f6d5b8', '#eec39e', '#d9a77c', '#cd9d77', '#b57d56', '#8d5a3a', '#6b4129', '#4a2c1c'],
  hair: ['#1a1412', '#432c1c', '#6b4528', '#9a6a38', '#c8a050', '#e0c878', '#b0452a', '#8a8a8a', '#e8e8e8', '#3a6aa8', '#8a3aa8', '#d84a8a'],
  cloth: ['#385670', '#9a5040', '#4e7a44', '#b08c34', '#2e3648', '#5a5e62', '#d8d2c4', '#d8702a', '#7a3a34', '#3c4e6e', '#1c1c1e', '#6e7a3a'],
  pants: ['#4e523c', '#2a2e3a', '#3a4a6a', '#5a4a38', '#2c3a2e', '#6a6e72', '#1c1c1e', '#8a7a58'],
  shoes: ['#3a2c22', '#1c1c1e', '#5a3a22', '#d8d2c4', '#6a1a1a'],
};
// Новый герой — копия «Классики» (она похожа на базового героя игры)
const HERO_DEFAULT = {
  name: 'Новый герой', gender: 'm', skin: '#cd9d77', hair: '#432c1c', hairStyle: 'short', beard: 'none', beardCol: '',
  top: '#385670', topStyle: 'jacket', trim: '#878376', pants: '#4e523c', legs: 'long', boots: false, shoes: '#3a2c22',
  hat: 'none', hatCol: '#7a3a34', glasses: 'none', pack: true, packCol: '#6b5435',
};
const HERO_PRESETS = [
  { name: 'Классика' },
  { name: 'Рыжая', gender: 'f', skin: '#eec39e', hair: '#b0452a', hairStyle: 'long', top: '#d8d2c4', topStyle: 'tee', pants: '#3a4a6a', legs: 'long', boots: true, shoes: '#5a3a22', pack: false },
  { name: 'Бородач', skin: '#d9a77c', hair: '#6b4528', hairStyle: 'short', beard: 'full', top: '#4e7a44', topStyle: 'hoodie', hat: 'beanie', hatCol: '#2e3648', pants: '#2a2e3a', boots: true, shoes: '#1c1c1e' },
  { name: 'Байкерша', gender: 'f', skin: '#b57d56', hair: '#1a1412', hairStyle: 'bob', top: '#7a3a34', topStyle: 'jacket', trim: '#1c1c1e', glasses: 'dark', pants: '#1c1c1e', boots: true, shoes: '#1c1c1e', pack: false },
  { name: 'Ковбой', skin: '#d9a77c', hair: '#9a6a38', hairStyle: 'short', beard: 'mustache', top: '#b08c34', topStyle: 'long', hat: 'cowboy', hatCol: '#5a3a22', pants: '#3a4a6a', boots: true, shoes: '#5a3a22', pack: false },
  { name: 'Панк', skin: '#f6d5b8', hair: '#d84a8a', hairStyle: 'mohawk', top: '#1c1c1e', topStyle: 'tank', pants: '#5a5e62', legs: 'shorts', boots: true, shoes: '#1c1c1e', glasses: 'round', pack: false },
].map(p => Object.assign({}, HERO_DEFAULT, p));

const hexRGB = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mixRGB = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const mulRGB = (a, k) => a.map(v => clamp(Math.round(v * k), 0, 255));

const HERO_ROLES = ['skin', 'hair', 'brow', 'eye', 'mouth', 'stubble', 'beard', 'top', 'topDark', 'trim', 'strap', 'pack', 'pants', 'belt', 'buckle', 'shoe', 'sole', 'hat', 'hatBand', 'glass'];
const HERO_SHADE = [0.95, 1, 1.05, 0.98];     // лёгкая «рябь» цвета по вокселям — как в нарисованных моделях

// Собрать данные модели (как после parseVox): { size, vox: [[x,y,z,цвет]], pal }
function genHeroVox(a) {
  a = Object.assign({}, HERO_DEFAULT, a);
  const F = a.gender === 'f', V = new Map();
  const put = (x, y, z, r) => { if (x < 0 || x > 14 || y < -1 || y > 9 || z < 0 || z > 63) return; V.set(x + ',' + y + ',' + z, r); };
  const box = (x1, x2, y1, y2, z1, z2, r) => { for (let x = x1; x <= x2; x++) for (let y = y1; y <= y2; y++) for (let z = z1; z <= z2; z++) put(x, y, z, r); };
  const cut = (x1, x2, y1, y2, z1, z2) => { for (let x = x1; x <= x2; x++) for (let y = y1; y <= y2; y++) for (let z = z1; z <= z2; z++) V.delete(x + ',' + y + ',' + z); };

  /* --- ноги и обувь --- */
  for (const [x1, x2] of [[3, 5], [9, 11]]) {
    box(x1, x2, 1, 5, 0, 1, 'sole'); box(x1, x2, 2, 5, 2, 4, 'shoe');
    if (a.legs === 'shorts') { box(x1, x2, 3, 5, 5, 17, 'skin'); box(x1, x2, 3, 5, 18, 25, 'pants'); }
    else box(x1, x2, 3, 5, 5, 25, 'pants');
    if (a.boots) box(x1, x2, 3, 5, 5, 9, 'shoe');
  }
  box(3, 11, 3, 7, 26, 30, 'pants');                         // таз
  box(3, 11, 3, 7, 31, 32, 'belt'); put(7, 3, 31, 'buckle'); put(7, 3, 32, 'buckle');

  /* --- торс, руки, одежда --- */
  const tx = F ? [4, 10] : [3, 11], arms = F ? [[1, 2], [12, 13]] : [[0, 1], [13, 14]];
  const sleeve = { jacket: 34, long: 34, hoodie: 34, tee: 40, tank: 99 }[a.topStyle] || 34;
  box(tx[0], tx[1], 3, 7, 33, 44, 'top');
  for (const [x1, x2] of arms) { box(x1, x2, 4, 6, 24, 44, 'skin'); if (sleeve <= 44) box(x1, x2, 4, 6, sleeve, 44, 'top'); }
  if (a.topStyle === 'tank') {                                // плечи открыты
    box(arms[0][0], tx[0] - 1, 3, 7, 45, 47, 'skin'); box(tx[1] + 1, arms[1][1], 3, 7, 45, 47, 'skin'); box(tx[0], tx[1], 3, 7, 45, 47, 'top');
  } else box(arms[0][0], arms[1][1], 3, 7, 45, 47, 'top');
  if (a.topStyle === 'jacket') box(6, 8, 3, 3, 35, 44, 'trim');                           // нагрудная панель
  if (a.topStyle === 'hoodie') {
    box(4, 10, 7, 8, 46, 50, 'top');                                                       // капюшон за шеей
    box(5, 9, 2, 2, 34, 37, 'topDark');                                                    // карман-«кенгуру»
    put(6, 3, 42, 'trim'); put(6, 3, 43, 'trim'); put(8, 3, 42, 'trim'); put(8, 3, 43, 'trim'); // шнурки
  }
  if (F) { box(5, 6, 2, 2, 40, 42, 'top'); box(8, 9, 2, 2, 40, 42, 'top'); }              // грудь
  if (a.pack) {
    box(4, 10, 8, 8, 34, 44, 'pack');                                                      // рюкзак на спине
    if (a.topStyle !== 'tank') for (const x of [tx[0] + 1, tx[1] - 1]) box(x, x, 3, 7, 39, 46, 'strap');   // лямки
  }
  box(6, 8, 4, 6, 48, 50, 'skin');                           // шея

  /* --- голова и лицо --- */
  box(4, 10, 2, 7, 51, 61, 'skin'); box(5, 9, 2, 7, 62, 62, 'skin');
  put(5, 2, 57, 'eye'); put(9, 2, 57, 'eye');
  for (const x of [5, 6, 8, 9]) put(x, 2, 59, 'brow');
  for (const x of [6, 7, 8]) put(x, 2, 53, 'mouth');

  /* --- причёска --- */
  const H = (x1, x2, y1, y2, z1, z2) => box(x1, x2, y1, y2, z1, z2, 'hair');
  const cap = () => { H(4, 10, 3, 7, 60, 60); H(4, 10, 2, 7, 61, 61); H(5, 9, 2, 7, 62, 62); };
  const sidesBack = () => { H(4, 4, 3, 6, 56, 59); H(10, 10, 3, 6, 56, 59); H(4, 10, 7, 7, 52, 60); };
  switch (a.hairStyle) {
    case 'buzz': H(4, 10, 3, 7, 60, 60); H(5, 9, 3, 6, 61, 61); H(4, 4, 4, 6, 58, 59); H(10, 10, 4, 6, 58, 59); H(4, 10, 7, 7, 57, 60); break;
    case 'short': cap(); sidesBack(); break;
    case 'spiky': H(4, 10, 3, 7, 60, 60); H(4, 10, 2, 7, 61, 61); H(5, 9, 3, 7, 62, 62); sidesBack();
      for (const [x, y] of [[5, 4], [7, 3], [7, 5], [9, 4], [6, 6], [8, 6]]) H(x, x, y, y, 63, 63); break;
    case 'long': cap(); sidesBack(); H(3, 3, 3, 7, 48, 60); H(11, 11, 3, 7, 48, 60); H(4, 4, 4, 7, 48, 55); H(10, 10, 4, 7, 48, 55); H(4, 10, 7, 7, 46, 51); H(4, 10, 8, 8, 46, 60); break;
    case 'bob': cap(); sidesBack(); H(4, 10, 2, 2, 58, 60); H(3, 3, 3, 7, 50, 59); H(11, 11, 3, 7, 50, 59); H(4, 10, 7, 7, 50, 51); H(4, 10, 8, 8, 50, 60); break;
    case 'tail': cap(); sidesBack(); H(7, 7, 8, 8, 55, 60); H(7, 7, 9, 9, 49, 56); break;
    case 'bun': cap(); sidesBack(); H(6, 8, 5, 7, 62, 63); break;
    case 'mohawk': H(7, 7, 2, 7, 60, 63); H(6, 8, 3, 6, 61, 62); H(7, 7, 7, 8, 55, 60); break;
    case 'afro': H(3, 11, 1, 8, 59, 63); H(2, 12, 2, 7, 56, 62); H(3, 11, 7, 8, 52, 58); break;
  }
  if (a.hairStyle === 'tail') put(7, 8, 55, 'trim');

  /* --- борода --- */
  const B = (x1, x2, y1, y2, z1, z2, r = 'beard') => box(x1, x2, y1, y2, z1, z2, r);
  switch (a.beard) {
    case 'stubble': B(4, 10, 2, 2, 51, 54, 'stubble'); B(4, 4, 3, 5, 51, 54, 'stubble'); B(10, 10, 3, 5, 51, 54, 'stubble'); break;
    case 'mustache': B(5, 9, 2, 2, 54, 54); B(6, 8, 1, 1, 54, 54); break;
    case 'goatee': B(5, 9, 2, 2, 54, 54); B(6, 8, 1, 1, 54, 54); B(6, 8, 2, 2, 51, 52); B(6, 8, 1, 1, 50, 52); break;
    case 'short': B(4, 10, 2, 2, 51, 55); B(4, 4, 3, 6, 51, 55); B(10, 10, 3, 6, 51, 55); B(5, 9, 1, 1, 51, 52); break;
    case 'full': B(4, 10, 2, 2, 51, 56); B(4, 4, 3, 6, 51, 57); B(10, 10, 3, 6, 51, 57); B(5, 9, 1, 1, 50, 55); B(3, 3, 3, 5, 51, 54); B(11, 11, 3, 5, 51, 54); break;
    case 'long': B(4, 10, 2, 2, 49, 56); B(4, 4, 3, 6, 51, 57); B(10, 10, 3, 6, 51, 57); B(5, 9, 1, 1, 48, 55); B(6, 8, 0, 0, 45, 49); B(5, 9, 2, 2, 46, 48); break;
    case 'chops': B(4, 4, 2, 4, 53, 58); B(10, 10, 2, 4, 53, 58); break;
  }
  for (const x of [6, 7, 8]) put(x, 2, 53, 'mouth');
  if (a.beard === 'full' || a.beard === 'long') for (const x of [6, 7, 8]) { V.delete(x + ',1,53'); }

  /* --- головной убор --- */
  const T = (x1, x2, y1, y2, z1, z2) => box(x1, x2, y1, y2, z1, z2, 'hat');
  switch (a.hat) {
    case 'cap': T(4, 10, 2, 7, 60, 61); T(5, 9, 3, 7, 62, 62); T(4, 10, 3, 7, 59, 59); T(4, 10, 0, 1, 60, 60); break;
    case 'beanie': cut(3, 11, 1, 8, 58, 63); T(3, 11, 1, 8, 58, 60); T(4, 10, 2, 7, 61, 62); T(6, 8, 3, 6, 63, 63); box(3, 11, 1, 8, 58, 58, 'hatBand'); break;
    case 'bandana': T(3, 11, 1, 8, 60, 61); T(6, 8, 9, 9, 59, 61); T(5, 9, 8, 8, 58, 59); break;
    case 'cowboy': cut(1, 13, -1, 9, 60, 63); T(1, 13, -1, 9, 60, 60); for (const [x, y] of [[1, -1], [13, -1], [1, 9], [13, 9]]) V.delete(x + ',' + y + ',60');
      T(4, 10, 2, 7, 61, 62); T(5, 9, 3, 6, 63, 63); box(4, 10, 2, 7, 61, 61, 'hatBand'); break;
  }

  /* --- очки --- */
  if (a.glasses !== 'none') {
    for (const [x1, x2] of [[4, 6], [8, 10]]) {
      if (a.glasses === 'dark') box(x1, x2, 1, 1, 56, 58, 'glass');
      else { box(x1, x2, 1, 1, 56, 58, 'glass'); V.delete(((x1 + x2) / 2) + ',1,57'); }
    }
    put(7, 1, 58, 'glass'); box(4, 4, 2, 4, 58, 58, 'glass'); box(10, 10, 2, 4, 58, 58, 'glass');
  }

  /* --- палитра: каждая роль × 4 оттенка --- */
  const sk = hexRGB(a.skin), hr = hexRGB(a.hair), bd = hexRGB(a.beardCol || a.hair), tp = hexRGB(a.top), pn = hexRGB(a.pants), sh = hexRGB(a.shoes), ht = hexRGB(a.hatCol), pk = hexRGB(a.packCol);
  const base = {
    skin: sk, hair: hr, brow: mulRGB(hr, 0.85), eye: [28, 24, 22], mouth: F ? mixRGB(sk, [196, 72, 84], 0.55) : mixRGB(sk, [150, 70, 60], 0.5),
    stubble: mixRGB(sk, bd, 0.5), beard: bd, top: tp, topDark: mulRGB(tp, 0.78), trim: hexRGB(a.trim), strap: mulRGB(pk, 0.75), pack: pk,
    pants: pn, belt: mixRGB(mulRGB(pn, 0.55), [63, 48, 32], 0.4), buckle: [170, 150, 90], shoe: sh, sole: mulRGB(sh, 0.55),
    hat: ht, hatBand: mulRGB(ht, 0.7), glass: a.glasses === 'round' ? [48, 44, 40] : [22, 22, 26],
  };
  const pal = Array.from({ length: 256 }, () => [180, 180, 180]);
  HERO_ROLES.forEach((r, i) => HERO_SHADE.forEach((k, s) => { pal[i * 4 + s] = mulRGB(base[r], k); }));
  const vox = [];
  for (const [key, r] of V) {
    const [x, y, z] = key.split(',').map(Number);
    vox.push([x, y + 1, z, HERO_ROLES.indexOf(r) * 4 + ((x * 7 + y * 13 + z * 5) & 3) + 1]);
  }
  const size = HERO_SIZE.slice(); size.armL = F ? 3 : 2.1; size.armR = F ? 11 : 12.9;     // где проходит граница рук
  return { size, vox, pal };
}

// Герой как файл MagicaVoxel (.vox) — можно открыть, дорисовать и вернуть в игру
function heroToVoxFile(data) {
  const n = data.vox.length, parts = [];
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
  HEROES.list = (saved && saved.length ? saved : HERO_PRESETS.map((p, i) => Object.assign({ id: 'p' + i }, p)));
  if (!saved) lsSet('heroes', HEROES.list);
}
const heroById = id => HEROES.list.find(h => h.id === id) || null;
function heroSave() { lsSet('heroes', HEROES.list); lsSet('heroSel', HEROES.sel); }
