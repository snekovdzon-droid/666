// assets/graveyard/church.vox и crypt.vox (рисуются в MagicaVoxel) → записи MH_CVOX в src/12i_menu_v76.js (x, y, z, r, g, b; y — вверх).
// Цвет (1,2,3) в crypt.vox — дверь склепа (в игре: открытый — чёрный проём, закрытый — тёмное железо).
// node tools/vox2cvox.js, затем python3 tools/build.py
const fs = require('fs'), path = require('path'), root = path.resolve(__dirname, '..');
function readVox(p) {
  const d = fs.readFileSync(p), r = {};
  (function walk(o, end) { while (o < end) { const id = d.toString('latin1', o, o + 4), n = d.readInt32LE(o + 4), c = d.readInt32LE(o + 8), b = o + 12;
    if (id === 'SIZE') r.size = [d.readInt32LE(b), d.readInt32LE(b + 4), d.readInt32LE(b + 8)];
    if (id === 'XYZI') { const k = d.readInt32LE(b); r.vox = []; for (let i = 0; i < k; i++) r.vox.push([d[b + 4 + i * 4], d[b + 5 + i * 4], d[b + 6 + i * 4], d[b + 7 + i * 4]]); }
    if (id === 'RGBA') { r.pal = []; for (let i = 0; i < 256; i++) r.pal.push([d[b + i * 4], d[b + i * 4 + 1], d[b + i * 4 + 2]]); }
    if (c) walk(b + n, b + n + c); o = b + n + c; } })(8, d.length);
  return r;
}
function enc(file) {   // MagicaVoxel: z вверх → в игре y вверх; индекс цвета i → palette[i-1]
  const v = readVox(file), buf = Buffer.alloc(v.vox.length * 6);
  v.vox.forEach(([x, y, z, c], i) => { buf[i * 6] = x; buf[i * 6 + 1] = z; buf[i * 6 + 2] = y; buf.set(v.pal[c - 1], i * 6 + 3); });
  return `{ d: "${buf.toString('base64')}", n: [${v.size[0]}, ${v.size[2]}, ${v.size[1]}] }`;
}
const f = path.join(root, 'src/12i_menu_v76.js'); let s = fs.readFileSync(f, 'utf8');
for (const [key, vox] of [['church', 'church.vox'], ['crypt', 'crypt.vox']]) {
  const re = new RegExp(`(\\b${key}: )\\{ d: "[^"]+", n: \\[[^\\]]+\\]( ?, ?[^}]*)? \\}`);
  if (!re.test(s)) throw new Error('нет записи ' + key); s = s.replace(re, (_, p) => p + enc(path.join(root, 'assets/graveyard', vox)));
}
fs.writeFileSync(f, s); console.log('ok');
