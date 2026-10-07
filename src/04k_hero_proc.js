'use strict';
/* ---------- Герой-человек, собранный кодом на скелете зомби (v0.80) ----------
   Сетка 15×9×70, рост тела 64 вокселя — размеры и положение частей взяты с модели зомби (торс 9×5, плечи 15, руки и ноги по 2–3).
   Лицо смотрит на y = 0. Нет файлов-частей и цветов-меток: у каждого вокселя своя «роль» (кожа, майка, штаны…),
   цвет роли берётся прямо из героя. Одежда (майка, футболка, лонгслив, штаны, обувь) — перекраска самого тела, без наружных слоёв. */
const HP_SIZE = [15, 9, 70], HP_UNIT = 64;
// варианты для кнопок редактора: [[id, название]]
const HERO_STYLES = {
  hairStyle: [['bald', 'Лысый'], ['short', 'Короткая'], ['buzz', 'Бокс'], ['spiky', 'Ёжик'], ['long', 'Длинные'], ['bob', 'Каре'], ['tail', 'Хвост'], ['bun', 'Пучок'], ['mohawk', 'Ирокез'], ['afro', 'Афро']],
  beard: [['none', 'Нет'], ['stubble', 'Щетина'], ['mustache', 'Усы'], ['goatee', 'Эспаньолка'], ['short', 'Короткая'], ['full', 'Полная'], ['long', 'Длинная'], ['chops', 'Бакенбарды']],
  topStyle: [['tee', 'Футболка'], ['long', 'Лонгслив'], ['tank', 'Майка']],
  legs: [['long', 'Брюки'], ['shorts', 'Шорты']],
  shoesStyle: [['shoes', 'Ботинки'], ['boots', 'Высокие ботинки']],
  glasses: [['none', 'Нет'], ['dark', 'Тёмные'], ['round', 'Круглые']],
};
const HP_FLAT = new Set(['eye', 'mouth', 'glass']);                     // без «ряби» цвета
function genHeroProc(h) {
  const a = heroNorm(h), V = new Map();
  const K = (x, y, z) => x + ',' + y + ',' + z;
  const put = (x, y, z, role) => { V.set(K(x, y, z), role); };
  const box = (x0, x1, y0, y1, z0, z1, role) => { for (let z = z0; z <= z1; z++) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) put(x, y, z, role); };
  const paint = (x0, x1, y0, y1, z0, z1, role) => { for (let z = z0; z <= z1; z++) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (V.has(K(x, y, z))) put(x, y, z, role); };   // только по уже стоящим вокселям тела

  /* ---- тело по размерам зомби ---- */
  box(3, 5, 3, 5, 24, 31, 'skin'); box(9, 11, 3, 5, 24, 31, 'skin');                 // бёдра 3×3
  box(3, 4, 4, 5, 3, 23, 'skin'); box(10, 11, 4, 5, 3, 23, 'skin');                  // голени 2×2
  box(3, 4, 0, 5, 0, 2, 'skin'); box(10, 11, 0, 5, 0, 2, 'skin');                    // стопы вперёд
  box(3, 11, 3, 7, 32, 43, 'skin');                                                   // таз и торс 9×5
  box(2, 12, 3, 7, 44, 48, 'skin'); box(2, 12, 3, 7, 49, 49, 'skin'); box(3, 11, 3, 7, 50, 50, 'skin');   // плечи, грудь
  box(0, 1, 3, 6, 22, 48, 'skin'); box(13, 14, 3, 6, 22, 48, 'skin');                // руки 2×4
  box(6, 8, 4, 6, 51, 52, 'skin');                                                    // шея
  box(5, 9, 2, 7, 53, 62, 'skin');                                                    // голова 5×6×10
  for (const x of [4, 10]) for (const y of [4, 5]) for (const z of [57, 58]) put(x, y, z, 'skin');   // уши
  put(7, 1, 57, 'nose');                                                              // нос
  put(6, 2, 59, 'eye'); put(8, 2, 59, 'eye');                                         // глаза
  put(6, 2, 60, 'brow'); put(8, 2, 60, 'brow'); put(5, 2, 60, 'brow'); put(9, 2, 60, 'brow');
  box(6, 8, 2, 2, 55, 55, 'mouth');                                                   // рот

  /* ---- штаны и обувь: перекраска ног ---- */
  const short = a.legs === 'shorts';
  paint(3, 11, 3, 7, 32, 35, 'pants');                                                // таз
  for (const [x0, x1] of [[3, 5], [9, 11]]) paint(x0, x1, 3, 5, short ? 24 : 24, 31, 'pants');
  if (!short) { paint(3, 4, 4, 5, 3, 23, 'pants'); paint(10, 11, 4, 5, 3, 23, 'pants'); }
  else { paint(3, 5, 3, 5, 20, 23, 'pants'); paint(9, 11, 3, 5, 20, 23, 'pants'); paint(3, 4, 4, 5, 20, 23, 'pants'); paint(10, 11, 4, 5, 20, 23, 'pants'); }
  const boots = a.shoesStyle === 'boots';
  paint(3, 4, 0, 5, 0, boots ? 9 : 2, 'shoe'); paint(10, 11, 0, 5, 0, boots ? 9 : 2, 'shoe');
  paint(3, 4, 0, 5, 0, 0, 'sole'); paint(10, 11, 0, 5, 0, 0, 'sole');
  for (let y = 3; y <= 7; y++) for (let x = 3; x <= 11; x++) if (x === 3 || x === 11 || y === 3 || y === 7) put(x, y, 35, 'belt');   // ремень
  put(6, 3, 35, 'buckle'); put(7, 3, 35, 'buckle'); put(8, 3, 35, 'buckle');

  /* ---- верх: майка / футболка / лонгслив — перекраска торса и рукавов ---- */
  const tee = 'tee';
  paint(3, 11, 3, 7, 36, 43, tee); paint(2, 12, 3, 7, 44, 49, tee); paint(3, 11, 3, 7, 50, 50, tee);
  if (a.topStyle === 'long') { paint(0, 1, 3, 6, 26, 48, tee); paint(13, 14, 3, 6, 26, 48, tee); }
  else if (a.topStyle === 'tee') { paint(0, 1, 3, 6, 40, 48, tee); paint(13, 14, 3, 6, 40, 48, tee); }
  else {                                                                              // майка: плечи и вырез открыты
    paint(2, 2, 3, 7, 44, 49, 'skin'); paint(12, 12, 3, 7, 44, 49, 'skin'); paint(3, 3, 3, 7, 47, 50, 'skin'); paint(11, 11, 3, 7, 47, 50, 'skin');
    paint(5, 9, 3, 4, 46, 50, 'skin');
  }

  /* ---- причёска ---- */
  const cap = () => { box(4, 10, 1, 8, 63, 63, 'hair'); box(4, 4, 2, 7, 59, 62, 'hair'); box(10, 10, 2, 7, 59, 62, 'hair'); box(5, 9, 8, 8, 58, 63, 'hair'); box(5, 9, 2, 2, 62, 62, 'hair'); box(5, 9, 7, 7, 59, 62, 'hair'); };
  const hs = a.hairStyle;
  if (hs === 'short') cap();
  else if (hs === 'buzz') { paint(5, 9, 2, 7, 62, 62, 'hair'); paint(5, 9, 7, 7, 60, 62, 'hair'); paint(5, 5, 3, 7, 61, 62, 'hair'); paint(9, 9, 3, 7, 61, 62, 'hair'); }
  else if (hs === 'spiky') { cap(); for (let y = 1; y <= 8; y++) for (let x = 4; x <= 10; x++) if ((x + y) % 2 === 0) put(x, y, 64, 'hair'); box(6, 8, 3, 6, 65, 65, 'hair'); }
  else if (hs === 'long') { cap(); box(4, 10, 8, 8, 47, 62, 'hair'); box(4, 4, 3, 8, 50, 58, 'hair'); box(10, 10, 3, 8, 50, 58, 'hair'); }
  else if (hs === 'bob') { cap(); box(4, 10, 8, 8, 54, 62, 'hair'); box(4, 4, 3, 8, 54, 57, 'hair'); box(10, 10, 3, 8, 54, 57, 'hair'); }
  else if (hs === 'tail') { cap(); box(6, 8, 8, 9, 56, 61, 'hair'); box(6, 8, 8, 9, 61, 61, 'brow'); }
  else if (hs === 'bun') { cap(); box(6, 8, 4, 6, 64, 66, 'hair'); box(5, 9, 4, 6, 64, 64, 'hair'); }
  else if (hs === 'mohawk') { box(6, 8, 1, 8, 63, 65, 'hair'); box(6, 8, 2, 8, 62, 62, 'hair'); box(6, 8, 8, 8, 58, 62, 'hair'); }
  else if (hs === 'afro') {
    for (let z = 52; z <= 67; z++) for (let y = 0; y <= 8; y++) for (let x = 2; x <= 12; x++) {
      const dx = (x - 7) / 5.6, dy = (y - 4.5) / 4.8, dz = (z - 59.5) / 8; if (dx * dx + dy * dy + dz * dz > 1) continue;
      if (x >= 5 && x <= 9 && y <= 3 && z <= 61) continue; if (x >= 5 && x <= 9 && y <= 1 && z <= 62) continue;   // лицо открыто
      if (z < 56 && y < 6) continue; if ((x === 4 || x === 10) && z >= 56 && z <= 59 && y <= 5) continue;     // уши и шея
      put(x, y, z, 'hair');
    }
  }

  /* ---- борода ---- */
  const bd = a.beard;
  if (bd === 'stubble') { paint(5, 9, 2, 2, 53, 56, 'stubble'); paint(5, 5, 3, 4, 53, 57, 'stubble'); paint(9, 9, 3, 4, 53, 57, 'stubble'); }
  else if (bd === 'mustache') box(6, 8, 1, 2, 56, 56, 'beard');
  else if (bd === 'goatee') { box(6, 8, 1, 2, 56, 56, 'beard'); box(7, 7, 1, 2, 53, 54, 'beard'); }
  else if (bd === 'short' || bd === 'full' || bd === 'long') {
    paint(5, 9, 2, 2, 53, 56, 'beard'); paint(5, 5, 2, 5, 53, 58, 'beard'); paint(9, 9, 2, 5, 53, 58, 'beard'); box(6, 8, 1, 1, 56, 56, 'beard');
    if (bd !== 'short') box(5, 9, 1, 1, 53, 55, 'beard');
    if (bd === 'long') { box(6, 8, 1, 1, 49, 52, 'beard'); box(6, 8, 2, 2, 51, 52, 'beard'); box(7, 7, 1, 1, 47, 48, 'beard'); }
    box(6, 8, 2, 2, 55, 55, 'mouth');
  }
  else if (bd === 'chops') { paint(5, 5, 2, 4, 55, 60, 'beard'); paint(9, 9, 2, 4, 55, 60, 'beard'); }

  /* ---- очки ---- */
  if (a.glasses === 'dark') { box(5, 9, 1, 1, 59, 60, 'glass'); box(4, 4, 2, 4, 59, 59, 'glass'); box(10, 10, 2, 4, 59, 59, 'glass'); }
  else if (a.glasses === 'round') { box(5, 6, 1, 1, 58, 60, 'glass'); box(8, 9, 1, 1, 58, 60, 'glass'); put(7, 1, 59, 'glass'); put(6, 1, 59, 'eye'); put(8, 1, 59, 'eye'); box(4, 4, 2, 3, 59, 59, 'glass'); box(10, 10, 2, 3, 59, 59, 'glass'); }

  /* ---- цвета ролей ---- */
  const sk = hexRGB(a.skin), hr = hexRGB(a.hair), bdc = hexRGB(a.beardCol || a.hair), pn = hexRGB(a.pants), sc = hexRGB(a.shoes);
  const base = {
    skin: sk, nose: mulRGB(sk, 0.9), hair: hr, brow: mulRGB(hr, 0.8), eye: [26, 22, 20], mouth: mixRGB(sk, [150, 70, 60], 0.5),
    stubble: mixRGB(sk, bdc, 0.45), beard: bdc, tee: hexRGB(a.top2 || '#385670'),
    pants: pn, belt: mixRGB(mulRGB(pn, 0.55), [63, 48, 32], 0.4), buckle: [170, 150, 90], shoe: sc, sole: mulRGB(sc, 0.5),
    glass: a.glasses === 'round' ? [48, 44, 40] : [20, 20, 24],
  };
  const pal = Array.from({ length: 256 }, () => [180, 180, 180]), idx = new Map(); let n = 0;
  const vox = [], part = new Map();
  for (const [key, role] of V) {
    const [x, y, z] = key.split(',').map(Number);
    let rgb = base[role]; if (!rgb) continue;
    if (!HP_FLAT.has(role)) rgb = mulRGB(rgb, HERO_SHADE[(x * 7 + y * 13 + z * 5) & 3]);
    const ck = rgb.join(','); let i = idx.get(ck);
    if (i === undefined) { if (n < 255) { pal[n] = rgb; i = ++n; } else { i = 1; } idx.set(ck, i); }
    vox.push([x, y, z, i]);
    part.set(key, z >= 51 ? 'head' : (x <= 1 && z >= 22) ? 'armA' : (x >= 13 && z >= 22) ? 'armB' : z <= 31 ? (x < 7.5 ? 'legA' : 'legB') : 'body');
  }
  const size = HP_SIZE.slice(); size.unit = HP_UNIT;
  return { size, vox, pal, part };
}
