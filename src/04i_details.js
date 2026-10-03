'use strict';
/* ---------- Мелочи на земле ----------
   В текстуру земли: трещины, заплатки на асфальте, лужи, масляные пятна, листья и мусор. Объёмные: пучки травы, камешки, обломки (не мешают ходить).
   Расстановка детерминирована названием карты; в зданиях и у стен не рисуется. */
function buildDetails(def) {
  let seed = 4021 + (def.name || '').length * 313; const R = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const zs = def.zones, tAt = (x, z) => zoneTypeAt(zs, x, z), px = v => Math.round(v * TPX);
  const inSolid = (x, z, m = 0.2) => solidsNear(x, z, m).some(s => s.y2 > 0.05 && x > s.x1 - m && x < s.x2 + m && z > s.z1 - m && z < s.z2 + m);
  const dot = (x, z, c, w = 1) => { gctx.fillStyle = `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`; gctx.fillRect(px(x), px(z), w, w); };
  const hard = t => t === 'asphalt' || t === 'road' || t === 'dark' || t === 'paving';
  const dark = (x, z) => { const d = gctx.getImageData(px(x), px(z), 1, 1).data; return d[0] * 0.3 + d[1] * 0.59 + d[2] * 0.11 < 150; };   // не рисуем поверх разметки и светлых линий
  // трещины: ломаная блуждает по 1 пикселю; иногда ветвится; на плитке и асфальте
  const crack = (x, z, len, a, depth = 0) => {
    for (let i = 0; i < len; i++) {
      a += (R() - 0.5) * 0.9; x += Math.cos(a) / TPX; z += Math.sin(a) / TPX;
      if (x < 1 || z < 1 || x > MAP - 1 || z > MAP - 1 || !hard(tAt(x, z)) || !dark(x, z)) break;
      dot(x, z, [34, 32, 30]); if (R() < 0.12) dot(x + 1 / TPX, z, [48, 46, 42]);
      if (depth < 2 && R() < 0.04) crack(x, z, 6 + R() * 14, a + (R() < 0.5 ? 0.8 : -0.8), depth + 1);
    }
  };
  const area = (Z) => Math.max(0, (Z[3] - Z[1]) * (Z[4] - Z[2]));
  for (const Z of zs) {
    const t = Z[0], A = Math.min(area(Z), MAP * MAP * 0.5);
    if (hard(t)) {
      for (let i = 0, n = A / 30; i < n; i++) { const x = Z[1] + 1 + R() * (Z[3] - Z[1] - 2), z = Z[2] + 1 + R() * (Z[4] - Z[2] - 2); if (tAt(x, z) === t && !inSolid(x, z, 0.1)) crack(x, z, 10 + R() * 40, R() * 6.28); }
      if (t === 'asphalt' || t === 'road') {
        for (let i = 0, n = A / 80; i < n; i++) {                       // заплатки: прямоугольник другого тона с тёмной окантовкой
          const w = 0.8 + R() * 1.6, d = 0.6 + R() * 1.2, x = Z[1] + 1 + R() * (Z[3] - Z[1] - 2 - w), z = Z[2] + 1 + R() * (Z[4] - Z[2] - 2 - d); if (tAt(x, z) !== t || !dark(x, z)) continue;
          const k = R() < 0.5 ? 0.8 : 1.18;
          for (let yy = px(z); yy < px(z + d); yy++) for (let xx = px(x); xx < px(x + w); xx++) { const edge = xx === px(x) || yy === px(z) || xx === px(x + w) - 1 || yy === px(z + d) - 1, v = (edge ? 0.62 : k) * (0.96 + hash2(xx, yy, 5) * 0.08); gctx.fillStyle = `rgb(${60 * v | 0},${58 * v | 0},${56 * v | 0})`; gctx.fillRect(xx, yy, 1, 1); }
        }
        for (let i = 0, n = A / 140; i < n; i++) {                      // масляные пятна: тёмные блоки
          const x = Z[1] + 1 + R() * (Z[3] - Z[1] - 2), z = Z[2] + 1 + R() * (Z[4] - Z[2] - 2); if (tAt(x, z) !== t) continue;
          for (let k = 0; k < 14; k++) dot(x + (R() - 0.5) * 0.9, z + (R() - 0.5) * 0.9, [30 + R() * 10, 28 + R() * 8, 28], 2);
        }
      }
    }
    if (t === 'asphalt' || t === 'road' || t === 'paving' || t === 'dirt') for (let i = 0, n = A / 110; i < n; i++) {         // лужи: на твёрдом и грязи; блоки, светлый край и блики
      const x = Z[1] + 1 + R() * (Z[3] - Z[1] - 2), z = Z[2] + 1 + R() * (Z[4] - Z[2] - 2), r = 0.4 + R() * 0.7; if (tAt(x, z) !== t || inSolid(x, z, 0.5) || !dark(x, z)) continue;
      for (let yy = -r; yy <= r; yy += 1 / TPX) for (let xx = -r * 1.4; xx <= r * 1.4; xx += 1 / TPX) {
        const q = (xx / (r * 1.4)) ** 2 + (yy / r) ** 2 + (hash2(Math.round((x + xx) * 8), Math.round((z + yy) * 8), 3) - 0.5) * 0.5;
        if (q < 0.85) dot(x + xx, z + yy, t === 'dirt' ? (q > 0.62 ? [96, 74, 52] : [78, 66, 52]) : (q > 0.62 ? [74, 82, 90] : [52, 64, 78])); else if (q < 1.0 && hash2(Math.round((x + xx) * 16), Math.round((z + yy) * 16), 4) < 0.5) dot(x + xx, z + yy, t === 'dirt' ? [104, 80, 56] : [88, 90, 92]);
      }
      dot(x - r * 0.4, z - r * 0.3, [190, 208, 220]); dot(x - r * 0.4 + 1 / TPX, z - r * 0.3, [150, 172, 190]); dot(x + r * 0.5, z + r * 0.2, [150, 172, 190]);
    }
    if (t === 'grass' || t === 'dirt' || t === 'paving' || t === 'gravel') for (let i = 0, n = A / 14; i < n; i++) {   // листья и мусор
      const x = Z[1] + 0.5 + R() * (Z[3] - Z[1] - 1), z = Z[2] + 0.5 + R() * (Z[4] - Z[2] - 1); if (tAt(x, z) !== t) continue;
      const k = R(), c = k < 0.4 ? [150, 100, 40] : k < 0.7 ? [170, 140, 50] : k < 0.85 ? [120, 80, 40] : [196, 194, 184];
      dot(x, z, c); if (R() < 0.5) dot(x + 1 / TPX, z, c); if (R() < 0.3) dot(x, z + 1 / TPX, [c[0] * 0.8, c[1] * 0.8, c[2] * 0.8]);
    }
  }
  groundTex.needsUpdate = true;
  // ---- объёмные мелочи: один меш, без коллизий и теней ----
  const B = newBatch(), col = (r, g, b) => (r << 16) | (g << 8) | b;
  const G = [col(70, 104, 46), col(82, 120, 52), col(60, 92, 42), col(104, 128, 60)], DRY = [col(150, 130, 70), col(130, 110, 60)], ST = [col(120, 116, 108), col(138, 132, 122), col(104, 100, 94)];
  const tuft = (x, z, big, dry) => {
    const n = 3 + Math.floor(R() * 3), h0 = big ? 0.14 : 0.08;
    for (let i = 0; i < n; i++) { const hh = h0 * (0.6 + R() * 0.9); pushBox(B, x + (R() - 0.5) * 0.14, hh / 2, z + (R() - 0.5) * 0.14, 0.035, hh, 0.035, R() * 3, dry ? DRY[i % 2] : G[Math.floor(R() * 4)]); }
  };
  const stone = (x, z) => { const n = 1 + Math.floor(R() * 3); for (let i = 0; i < n; i++) { const s = 0.05 + R() * 0.1; pushBox(B, x + (R() - 0.5) * 0.25, s * 0.4, z + (R() - 0.5) * 0.25, s, s * 0.8, s * (0.8 + R() * 0.5), R() * 3, ST[Math.floor(R() * 3)]); } };
  const debris = (x, z) => {
    const k = R();
    if (k < 0.3) pushBox(B, x, 0.04, z, 0.22, 0.08, 0.1, R() * 3, col(138, 74, 54));                                          // кирпич
    else if (k < 0.55) pushBox(B, x, 0.015, z, 0.6, 0.03, 0.1, R() * 3, col(120, 90, 56));                                    // доска
    else if (k < 0.7) pushBox(B, x, 0.02, z, 0.3, 0.04, 0.22, R() * 3, col(110, 112, 116));                                   // лист железа
    else if (k < 0.85) pushBox(B, x, 0.04, z, 0.06, 0.08, 0.06, R() * 3, col(190, 60, 50));                                   // банка
    else pushBox(B, x, 0.005, z, 0.14, 0.012, 0.18, R() * 3, col(206, 204, 194));                                              // бумага
  };
  let nb = 0;
  for (const Z of zs) {
    const t = Z[0], A = Math.min(area(Z), MAP * MAP * 0.5);
    if (t === 'grass') for (let i = 0, n = A * 0.5; i < n; i++) { const x = Z[1] + 0.3 + R() * (Z[3] - Z[1] - 0.6), z = Z[2] + 0.3 + R() * (Z[4] - Z[2] - 0.6); if (tAt(x, z) === 'grass' && !inSolid(x, z, 0.3)) { tuft(x, z, R() < 0.3, R() < 0.12); nb++; } }
    if (t === 'dirt' || t === 'gravel') for (let i = 0, n = A * 0.08; i < n; i++) { const x = Z[1] + 0.3 + R() * (Z[3] - Z[1] - 0.6), z = Z[2] + 0.3 + R() * (Z[4] - Z[2] - 0.6); if (tAt(x, z) === t && !inSolid(x, z, 0.3)) { R() < 0.5 ? tuft(x, z, false, true) : stone(x, z); nb++; } }
    if (hard(t) && t !== 'dark') for (let i = 0, n = A * 0.012; i < n; i++) { const x = Z[1] + 0.5 + R() * (Z[3] - Z[1] - 1), z = Z[2] + 0.5 + R() * (Z[4] - Z[2] - 1); if (tAt(x, z) === t && !inSolid(x, z, 0.4)) { debris(x, z); nb++; } }
  }
  // «пустая» земля вне зон (по умолчанию грязь): редкие кустики и камни
  for (let i = 0; i < MAP * MAP * 0.04; i++) { const x = 1 + R() * (MAP - 2), z = 1 + R() * (MAP - 2); if (tAt(x, z) === 'dirt' && !inSolid(x, z, 0.35)) { R() < 0.6 ? tuft(x, z, false, true) : stone(x, z); nb++; } }
  if (B.pos.length) { const m = batchMesh(B, false); m.castShadow = false; m.receiveShadow = true; }
}
