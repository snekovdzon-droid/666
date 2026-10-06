'use strict';
/* ---------- За забором: земля, деревья, кусты и камни вокруг карты ----------
   Доступа туда нет (граница карты не пускает), но с края карты через забор видно не пропасть, а продолжение местности. */
const OUTSIDE = { g: null, R: 64 };
function buildOutsideOld(def) {
  if (OUTSIDE.g) { scene.remove(OUTSIDE.g); OUTSIDE.g = null; }
  const R = OUTSIDE.R, T = MAP + 2 * R, PPM = 5, W = T * PPM, g = new THREE.Group(); scene.add(g); OUTSIDE.g = g;
  // земля: земля и трава пятнами, серые россыпи, блоками по 3 пикселя
  const cv = document.createElement('canvas'); cv.width = cv.height = W; const cx = cv.getContext('2d'), img = cx.createImageData(W, W), d = img.data;
  for (let py = 0; py < W; py++) for (let px = 0; px < W; px++) {
    const x = px / PPM - R, z = py / PPM - R, n = hash2(px / 3 | 0, py / 3 | 0, 51), big = vnoise(x / 16, z / 16, 61), mid = vnoise(x / 5, z / 5, 67);
    let c = big > 0.52 ? (n < 0.5 ? [84, 108, 60] : [78, 100, 56]) : (n < 0.5 ? [124, 90, 58] : [118, 86, 55]);
    if (mid > 0.7 && big <= 0.52) c = n < 0.5 ? [112, 106, 96] : [104, 98, 88];                             // каменистые проплешины
    if (hash2(px, py, 71) < 0.03) c = [c[0] * 0.8, c[1] * 0.8, c[2] * 0.8];
    const k = 1 + (vnoise(x / 3, z / 3, 73) - 0.5) * 0.14, o = (py * W + px) * 4; d[o] = c[0] * k; d[o + 1] = c[1] * k; d[o + 2] = c[2] * k; d[o + 3] = 255;
  }
  cx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv); tex.magFilter = THREE.NearestFilter; tex.encoding = THREE.sRGBEncoding;
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(T, T).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: tex })); plane.position.set(MAP / 2, -0.012, MAP / 2); plane.receiveShadow = true; g.add(plane);
  // деревья, кусты и камни — только вне карты, не ближе 2,5 м к забору
  let s = 8871 + (def.name || '').length * 131; const rnd1 = () => (s = (s * 16807) % 2147483647) / 2147483647, spots = [];
  const spot = (min, minD, maxD) => {
    for (let i = 0; i < 60; i++) {
      const x = -R + rnd1() * T, z = -R + rnd1() * T, dx = Math.max(-x, 0, x - MAP), dz = Math.max(-z, 0, z - MAP), dist = Math.hypot(dx, dz);
      if (dist < minD || dist > maxD || (dx === 0 && dz === 0)) continue;
      if (spots.some(p => (p[0] - x) ** 2 + (p[1] - z) ** 2 < min * min)) continue;
      spots.push([x, z]); return [x, z];
    }
    return null;
  };
  const clone = (name, x, z, sc) => { const src = MODELS[name], D = MODEL_DEF[name] || { scale: 1, oy: 0 }; if (!src) return; const m = src.clone(), k = D.scale * sc; m.scale.setScalar(k); m.rotation.y = rnd1() * 6.28; m.position.set(x, D.oy * k, z); m.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = true; }); g.add(m); };
  const nT = Math.round(T * T / 90), nB = Math.round(T * T / 55);
  for (let i = 0; i < nT; i++) { const p = spot(4.5, 3, R - 3); if (p) clone('tree', p[0], p[1], 0.9 + rnd1() * 0.7); }
  for (let i = 0; i < nB; i++) { const p = spot(2.2, 2.5, R - 2); if (p) clone('bush', p[0], p[1], 0.8 + rnd1() * 0.9); }
  // камни из кубиков: кучки по 3–6 штук
  const B = newBatch(), RC = [[112, 108, 102], [128, 124, 116], [98, 94, 90]];
  for (let i = 0; i < Math.round(T * T / 140); i++) {
    const p = spot(3, 2.5, R - 2); if (!p) continue; const n = 3 + Math.floor(rnd1() * 4);
    for (let k = 0; k < n; k++) { const sz = 0.3 + rnd1() * 0.7, c = RC[Math.floor(rnd1() * 3)]; pushBox(B, p[0] + (rnd1() - 0.5) * 1.6, sz * 0.4 * (k > 2 ? 1.6 : 1), p[1] + (rnd1() - 0.5) * 1.6, sz, sz * 0.8, sz * (0.7 + rnd1() * 0.5), rnd1() * 3, (c[0] << 16) | (c[1] << 8) | c[2]); }
  }
  if (B.pos.length) { const m = batchMesh(B, true); staticGroup.remove(m); g.add(m); }
}
/* ---------- v0.35: за забором (тюрьма и свои карты; город — по-старому) ----------
   Земля той же плотности, что внутри (16 пикс/м) в полосе 20 м у забора, дальше — грубее и темнее, уходит в туман.
   Тюрьма: служебная полоса, контрольно-следовая полоса (разрыхлённый песок), второй забор с колючей спиралью, канава с лужами,
   дорога от КПП на юг с остовами машин и разбитыми фонарями, тропы от проломов, бурьян. Всё вне карты — туда не попасть. */
const OUT_SS = (a, b, v) => { v = clamp((v - a) / (b - a), 0, 1); return v * v * (3 - 2 * v); };
function outsideSpec() {
  const prison = MAPID === 'prison';
  return {
    ksp: prison, F2: 6.0, ditch: prison ? 11.5 : 0,
    road: prison ? { c: 48, hw: 2 } : null,
    trails: prison ? [['N', 47.5], ['W', 57], ['E', 57]] : [],
  };
}
// отклонение тропы от прямой (одно и то же для земли и проёма в заборе)
const trailWig = (along, at) => (vnoise(along / 9, at, 83) - 0.5) * 8 * Math.min(1, along / 12);
function outTrailD(O, x, z) {
  let best = 99;
  for (const [s, at] of O.trails) {
    let along, across;
    if (s === 'N') { if (z > 0.5) continue; along = -z; across = x - at; }
    else if (s === 'W') { if (x > 0.5) continue; along = -x; across = z - at; }
    else { if (x < MAP - 0.5) continue; along = x - MAP; across = z - at; }
    if (Math.abs(across) > 7) continue;
    best = Math.min(best, Math.abs(across - trailWig(along, at)));
  }
  return best;
}
const outRoadD = (O, x, z) => O.road && z > MAP - 0.5 ? Math.abs(x - O.road.c) : 99;
function outColor(O, x, z, px, pz, ppm) {
  const dx = Math.max(-x, 0, x - MAP), dz = Math.max(-z, 0, z - MAP), dc = Math.max(dx, dz);
  const n = hash2(px, pz, 51), big = vnoise(x / 14, z / 14, 61);
  let c, soft = true;
  if (dc < 1.5) c = n < 0.5 ? [128, 92, 60] : n < 0.85 ? [122, 88, 57] : [136, 99, 65];             // служебная полоса — как земля внутри
  else if (O.ksp && dc < 5.4) {                                                                      // КСП: светлый разрыхлённый песок, борозды вдоль забора
    c = n < 0.5 ? [158, 134, 96] : n < 0.85 ? [151, 128, 91] : [164, 141, 102];
    if ((dc / 0.3) % 1 < 0.34) c = [c[0] * 0.86, c[1] * 0.86, c[2] * 0.86];
    if (dc < 1.75 || dc > 5.15) c = [c[0] * 0.9, c[1] * 0.9, c[2] * 0.9];
  } else {
    const mid = vnoise(x / 4, z / 4, 67);
    if (big > 0.56) c = n < 0.5 ? [94, 104, 58] : n < 0.85 ? [86, 96, 53] : [104, 112, 64];          // трава с зеленью
    else if (big > 0.4) c = n < 0.5 ? [124, 115, 70] : n < 0.85 ? [116, 107, 64] : [132, 122, 76];   // сухая трава
    else c = n < 0.5 ? [122, 90, 58] : n < 0.85 ? [114, 85, 55] : [130, 96, 62];                     // земля
    if (mid > 0.72 && big < 0.5) c = n < 0.5 ? [112, 106, 96] : [104, 98, 88];                       // каменистые проплешины
    if (O.ksp && dc < 7.2 && big < 0.56) c = n < 0.5 ? [122, 90, 58] : [114, 85, 55];                // у второго забора вытоптано
    if (O.ditch) {                                                                                     // канава: сырая земля, в низинах лужи
      const dd = Math.abs(dc - O.ditch);
      if (dd < 1.15) {
        const k = OUT_SS(0, 0.7, 1 - dd / 1.15), m = [72, 58, 43];
        c = [c[0] + (m[0] - c[0]) * k, c[1] + (m[1] - c[1]) * k, c[2] + (m[2] - c[2]) * k];
        if (dd < 0.5 && vnoise(x / 3.5, z / 3.5, 91) > 0.52) { c = n > 0.96 ? [84, 94, 96] : [48, 56, 58]; soft = false; }
      }
    }
  }
  if (O.trails.length && dc > 0.2) {                                                                 // тропы от проломов: вытоптанная земля и следы
    const td = outTrailD(O, x, z);
    if (td < 1.4) {
      const onKsp = O.ksp && dc >= 1.5 && dc < 5.4;
      c = onKsp ? (n < 0.5 ? [134, 113, 81] : [126, 106, 76]) : (n < 0.5 ? [108, 81, 53] : [102, 77, 50]);
      if (hash2(px >> 2, pz >> 2, 77) < 0.1) c = [c[0] * 0.8, c[1] * 0.8, c[2] * 0.8];
      soft = true;
    } else if (O.ksp && dc >= 1.5 && dc < 5.4 && td < 5 && hash2(px >> 2, pz >> 2, 78) < 0.05) c = [c[0] * 0.84, c[1] * 0.84, c[2] * 0.84];   // следы на песке
  }
  const rd = outRoadD(O, x, z);
  if (rd < 3.2) {                                                                                    // дорога от КПП
    const edge = O.road.hw + (vnoise(z / 1.5, 3, 97) - 0.5) * 0.5;
    if (rd < edge) {
      c = n < 0.6 ? [62, 60, 58] : n < 0.9 ? [56, 54, 52] : [74, 72, 68];
      if (vnoise(x / 1.1, z / 1.1, 99) > 0.8) c = [44, 42, 40];                                    // выбоины
      if (Math.abs(x - O.road.c) < Math.max(0.08, 0.5 / ppm) && z % 3 < 1.6 && hash2(z / 3 | 0, 7, 5) > 0.3) { c = [190, 160, 56]; soft = false; }
    } else if (rd < edge + 0.7) c = n < 0.5 ? [112, 106, 96] : [104, 98, 88];                      // обочина
  }
  if (soft) {
    let k = 1 + (vnoise(x / 2.2, z / 2.2, 11) - 0.5) * 0.16 + (vnoise(x / 0.5, z / 0.5, 29) - 0.5) * 0.1;
    const h2 = hash2(px >> 1, pz >> 1, 17);
    if (big > 0.4 && dc > 5.4 && h2 < 0.08) k *= 0.82;                                               // пучки травы
    else if (h2 > 0.98) k *= 1.15;
    c = [c[0] * k, c[1] * k, c[2] * k];
  }
  const far = 1 - 0.3 * OUT_SS(12, 56, dc);                                                          // к горизонту темнее
  if (MAPID === 'cemetery') c = [c[0] * 0.5, c[1] * 0.68, c[2] * 0.86];
  const q = gradeRGB(c[0] / 255, c[1] / 255, c[2] / 255);                                         // та же цветокоррекция, что и внутри
  return [q[0] * 255 * far, q[1] * 255 * far, q[2] * 255 * far];
}
function outPlane(O, g, x0, z0, w, h, ppm, y) {
  const W = Math.round(w * ppm), H = Math.round(h * ppm), cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const cx = cv.getContext('2d'), img = cx.createImageData(W, H), d = img.data;
  for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
    const x = x0 + (px + 0.5) / ppm, z = z0 + (py + 0.5) / ppm, c = outColor(O, x, z, Math.floor(x * 16), Math.floor(z * 16), ppm), o = (py * W + px) * 4;
    d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
  }
  cx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv); tex.magFilter = THREE.NearestFilter; tex.encoding = THREE.sRGBEncoding;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: tex }));
  m.position.set(x0 + w / 2, y, z0 + h / 2); m.receiveShadow = true; g.add(m);
}
// проёмы второго забора: на каждой стороне — по тропам и дороге
function outGaps(O, side) {
  const G = [];
  for (const [s, at] of O.trails) if (s === side) G.push([at + trailWig(O.F2, at) - 2.2, at + trailWig(O.F2, at) + 2.2]);
  if (O.road && side === 'S') G.push([O.road.c - 3.4, O.road.c + 3.4]);
  return G;
}
// остов машины: обгоревший кузов без колёс (длина вдоль локальной z)
function outWreck(B, x, z, a, col) {
  const c = Math.cos(a), s = Math.sin(a), put = (ox, y, oz, sx, sy, sz, hex) => pushBox(B, x + ox * c + oz * s, y, z - ox * s + oz * c, sx, sy, sz, a, hex);
  put(0, 0.42, 0, 1.76, 0.42, 3.9, col); put(0, 0.86, -0.25, 1.58, 0.48, 1.9, col); put(0, 0.66, 1.45, 1.7, 0.08, 0.9, col);
  put(0, 0.88, -0.25, 1.6, 0.34, 1.6, 0x1c1c1e); put(0, 0.12, 1.25, 1.6, 0.24, 0.3, 0x2a2826); put(0, 0.12, -1.3, 1.6, 0.24, 0.3, 0x2a2826);   // окна, оси
  for (const [ox, oz] of [[0.6, 1.2], [-0.5, -0.9], [0.2, -1.7], [-0.7, 0.6]]) put(ox, 0.64, oz, 0.42, 0.04, 0.36, 0x6e4026);              // ржавчина
  put(0.95, 0.2, 1.25, 0.18, 0.4, 0.5, 0x1e1e1e);                                                                                         // одно спущенное колесо
}
function buildOutside(def) {
  if (MAPID === 'city') return buildOutsideOld(def);
  if (OUTSIDE.g) { scene.remove(OUTSIDE.g); OUTSIDE.g = null; }
  const O = outsideSpec(), R = OUTSIDE.R, T = MAP + 2 * R, NB = 20, g = new THREE.Group(); scene.add(g); OUTSIDE.g = g;
  outPlane(O, g, -R, -R, T, T, 4, -0.03);                                                            // дальняя земля, грубо
  outPlane(O, g, -150, -150, MAP + 300, MAP + 300, 2, -0.06);                                        // v0.40: совсем дальняя — края карты не обрываются
  outPlane(O, g, -NB, -NB, MAP + 2 * NB, NB, 16, -0.012); outPlane(O, g, -NB, MAP, MAP + 2 * NB, NB, 16, -0.012);   // полоса у забора, как внутри
  outPlane(O, g, -NB, 0, NB, MAP, 16, -0.012); outPlane(O, g, MAP, 0, NB, MAP, 16, -0.012);
  let s = 8871 + (def.name || '').length * 131; const rnd1 = () => (s = (s * 16807) % 2147483647) / 2147483647, spots = [];
  const dcOf = (x, z) => Math.max(-x, 0, x - MAP, -z, 0, z - MAP);
  const free = (x, z, m) => {                                                                        // не на дороге, тропе, КСП, в канаве
    const dc = dcOf(x, z);
    if (O.ksp && dc < 8.2) return false;
    if (O.ditch && Math.abs(dc - O.ditch) < 1.4 + m) return false;
    if (outRoadD(O, x, z) < 3.6 + m || outTrailD(O, x, z) < 1.6 + m) return false;
    return true;
  };
  const spot = (min, minD, maxD, m = 0.5) => {
    for (let i = 0; i < 60; i++) {
      const x = -R + rnd1() * T, z = -R + rnd1() * T, dc = dcOf(x, z);
      if (dc < minD || dc > maxD || dc === 0 || !free(x, z, m)) continue;
      if (spots.some(p => (p[0] - x) ** 2 + (p[1] - z) ** 2 < min * min)) continue;
      spots.push([x, z]); return [x, z];
    }
    return null;
  };
  const clone = (name, x, z, sc) => { if (MAPID === 'cemetery') { const r = rnd1(); if (name === 'tree') { if (r < 0.035) gyPut(DEAD_TREES[Math.floor(rnd1() * 5)], x, 0, z, x + z, sc * 0.8); } else if (r < 0.035) gyPut(rnd1() < 0.6 ? 'cs_vegetation2' : 'mx_stump', x, 0, z, x * z); return; } const src = MODELS[name], D = MODEL_DEF[name] || { scale: 1, oy: 0 }; if (!src) return; const m = src.clone(), k = D.scale * sc; m.scale.setScalar(k); m.rotation.y = rnd1() * 6.28; m.position.set(x, D.oy * k, z); m.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = true; }); g.add(m); };
  // деревья реже у забора, гуще вдали — опушка
  const nT = Math.round(T * T / 90), nB = Math.round(T * T / 55), t0 = O.ksp ? 9 : 3;
  for (let i = 0; i < nT; i++) { const p = spot(4.5, t0, R - 3, 1.5); if (p && rnd1() < 0.35 + 0.65 * OUT_SS(t0, t0 + 14, dcOf(p[0], p[1]))) clone('tree', p[0], p[1], 0.9 + rnd1() * 0.7); }
  for (let i = 0; i < nB; i++) { const p = spot(2.2, O.ksp ? 8.2 : 2.5, R - 2); if (p) clone('bush', p[0], p[1], 0.8 + rnd1() * 0.9); }
  const B = newBatch(), RC = [0x4a4844, 0x56534e, 0x403e3b];
  for (let i = 0; i < Math.round(T * T / 140); i++) {                                                 // камни кучками
    const p = spot(3, O.ksp ? 8.2 : 2.5, R - 2); if (!p) continue; const n = 3 + Math.floor(rnd1() * 4);
    for (let k = 0; k < n; k++) { const sz = 0.3 + rnd1() * 0.7; pushBox(B, p[0] + (rnd1() - 0.5) * 1.6, sz * 0.4 * (k > 2 ? 1.6 : 1), p[1] + (rnd1() - 0.5) * 1.6, sz, sz * 0.8, sz * (0.7 + rnd1() * 0.5), rnd1() * 3, RC[Math.floor(rnd1() * 3)]); }
  }
  if (O.ksp) {
    // второй забор: бетонные столбы, проволока, колючая спираль поверху; таблички «Запретная зона»
    const F = O.F2, lo = -F, hi = MAP + F, sides = [['N', 'x', -F], ['S', 'x', MAP + F], ['W', 'z', -F], ['E', 'z', MAP + F]];
    for (const [side, ax, at] of sides) {
      const gaps = outGaps(O, side), segs = []; let a = lo;
      for (const [g1, g2] of gaps.sort((p, q) => p[0] - q[0])) { segs.push([a, g1]); a = g2; }
      segs.push([a, hi]);
      const P = (u, y, sx, sy, sz, hex, off = 0) => ax === 'x' ? pushBox(B, u, y, at + off, sx, sy, sz, 0, hex) : pushBox(B, at + off, y, u, sz, sy, sx, 0, hex);
      const inward = side === 'N' || side === 'W' ? 1 : -1;
      let sign = 0;
      for (const [s1, s2] of segs) {
        if (s2 - s1 < 0.5) continue;
        const L = s2 - s1, np = Math.max(1, Math.round(L / 2.6));
        for (let i = 0; i <= np; i++) { const u = s1 + L * i / np, end = i === 0 || i === np; P(u, 1.15, end ? 0.2 : 0.14, 2.3, end ? 0.2 : 0.14, 0x5e5a54); P(u, 2.34, 0.1, 0.1, 0.24, 0x524e48); }
        for (const y of [0.45, 0.95, 1.45, 1.95]) P((s1 + s2) / 2, y, L, 0.02, 0.02, 0x4a4c4e);
        for (let u = s1 + 0.2; u < s2 - 0.1; u += 0.42) {                                                   // спираль: кольца поперёк забора
          const j = (hash2(u * 10 | 0, at | 0, 3) - 0.5) * 0.06, y0 = 2.6 + j, r = 0.22;
          P(u, y0 + r, 0.025, 0.025, 2 * r, 0x5c5e60); P(u, y0 - r, 0.025, 0.025, 2 * r, 0x5c5e60);
          P(u, y0, 0.025, 2 * r, 0.025, 0x5c5e60, -r); P(u, y0, 0.025, 2 * r, 0.025, 0x5c5e60, r);
        }
        for (let u = s1 + 6; u < s2 - 3; u += 26) {                                                         // табличка на внутренней стороне
          sign++; P(u, 1.5, 0.62, 0.42, 0.03, 0x9a968c, inward * 0.09); P(u, 1.64, 0.62, 0.1, 0.035, 0x962a20, inward * 0.09);
          if (sign % 3 === 0) P(u + 0.2, 1.38, 0.2, 0.12, 0.036, 0x6e4026, inward * 0.09);                // ржавое пятно
        }
      }
    }
    // дорога: бетонные блоки у проезда, труба под дорогой в канаве, остовы машин, разбитые фонари
    const c = O.road.c, S0 = MAP;
    pushBox(B, c - 3.9, 0.42, S0 + F + 0.2, 0.8, 0.84, 1.6, 0.1, 0x5a564e); pushBox(B, c + 3.9, 0.42, S0 + F - 0.1, 0.8, 0.84, 1.6, -0.15, 0x524e48);
    for (const sx of [-1, 1]) { const x = c + sx * (O.road.hw + 0.7); pushBox(B, x, 0.35, S0 + O.ditch, 0.5, 0.9, 1.5, 0, 0x56524a); pushBox(B, x + sx * 0.26, 0.28, S0 + O.ditch, 0.04, 0.5, 0.6, 0, 0x1a1a1a); }
    outWreck(B, c + 3.4, S0 + 15, 0.1, 0x2c2420); outWreck(B, c - 3.2, S0 + 27, Math.PI - 0.2, 0x3a2c22); outWreck(B, c + 0.6, S0 + 38, 1.25, 0x282420);
    outWreck(B, -15, 30, 0.7, 0x2e2822); outWreck(B, MAP + 17, 82, 2.1, 0x342a22); outWreck(B, 28, -19, 0.3, 0x2a241e);
    lampGeo(B, c + 2.9, S0 + 10, Math.PI, 'cobra', true, null); lampGeo(B, c - 2.9, S0 + 33, 0, 'cobra', true, null);
    // упавший столб на обочине
    const fx = c + 3.1, fz = S0 + 22; pushBox(B, fx, 0.12, fz, 0.2, 0.2, 0.36, 0, 0x7c776e); pushBox(B, fx + 0.1, 0.1, fz + 2.2, 0.17, 0.17, 4.1, 0.04, 0x56605a);
    pushBox(B, fx + 0.22, 0.11, fz + 4.5, 0.3, 0.16, 0.56, 0.04, 0x3c3e40); pushBox(B, fx - 0.4, 0.04, fz + 4.9, 0.12, 0.04, 0.1, 0.6, 0x8a9294);
  }
  if (B.pos.length) { const m = batchMesh(B, true); staticGroup.remove(m); g.add(m); }
  // бурьян: пучки тонких травинок; без теней (дёшево), число — по пресету графики
  const WB = [newBatch(), newBatch(), newBatch(), newBatch()], WC = [[0x8a804c, 0x7a7444, 0x6c6c3e], [0x6a7840, 0x5e6c3a, 0x768446]];   // v0.50: бурьян четырьмя кусками — отсекается по кадру
  const nW = Math.round(1500 * (QS.fx || 1));
  for (let i = 0; i < nW; i++) {
    let x = 0, z = 0, ok = false, dc = 0;
    for (let tr = 0; tr < 8 && !ok; tr++) {
      x = -36 + rnd1() * (MAP + 72); z = -36 + rnd1() * (MAP + 72); dc = dcOf(x, z);
      if (dc < 0.5 || dc > 36) continue;
      if (O.ksp && dc >= 1.5 && dc < 5.6) continue;
      if (O.ditch && Math.abs(dc - O.ditch) < 0.55) continue;
      if (outRoadD(O, x, z) < 2.9 || outTrailD(O, x, z) < 1.1) continue;
      const want = dc < 1.5 ? 0.25 : (O.ksp && dc < 8) ? 1 : 0.35 + 0.65 * (1 - OUT_SS(10, 36, dc));
      ok = rnd1() < want;
    }
    if (!ok) continue;
    const W = WB[(x < MAP / 2 ? 0 : 1) + (z < MAP / 2 ? 0 : 2)], big = vnoise(x / 14, z / 14, 61), pal = WC[big > 0.56 ? 1 : 0], hm = dc < 1.5 ? 0.45 : 1, nb = 4 + Math.floor(rnd1() * 4);
    for (let k = 0; k < nb; k++) { const h = (0.25 + rnd1() * 0.7) * hm, w = 0.06 + rnd1() * 0.03; pushBox(W, x + (rnd1() - 0.5) * 0.55, h / 2, z + (rnd1() - 0.5) * 0.55, w, h, w, rnd1() * 3, pal[Math.floor(rnd1() * 3)]); }
  }
  for (const W of WB) if (W.pos.length) { const m = batchMesh(W, false); staticGroup.remove(m); g.add(m); }
  // v0.40: дальнее кольцо (за 60 м) — простые деревья и кусты одной пачкой
  const FT = newBatch(), TRK = [0x4a3424, 0x56402c], LV = MAPID === 'cemetery' ? [0x3a3040, 0x2e2a36, 0x423848, 0x34303c] : [0x3e5a2c, 0x4a6632, 0x56703a, 0x5e6a34];
  for (let i = 0; i < 520; i++) {
    const x = -140 + rnd1() * (MAP + 280), z = -140 + rnd1() * (MAP + 280), dc = dcOf(x, z);
    if (dc < 58 || dc > 140 || (O.road && Math.abs(x - O.road.c) < 5 && z > MAP)) continue;
    const s = 0.8 + rnd1() * 0.8, lv = LV[Math.floor(rnd1() * 4)];
    if (rnd1() < 0.3) { pushBox(FT, x, 0.35 * s, z, 1.1 * s, 0.7 * s, 1.0 * s, rnd1() * 3, lv); continue; }   // куст
    pushBox(FT, x, 0.9 * s, z, 0.32 * s, 1.8 * s, 0.32 * s, 0, TRK[i & 1]);
    pushBox(FT, x, 2.2 * s, z, 1.7 * s, 1.1 * s, 1.7 * s, rnd1() * 3, lv); pushBox(FT, x + 0.1, 3.0 * s, z - 0.1, 1.1 * s, 0.7 * s, 1.1 * s, rnd1() * 3, lv);
  }
  if (FT.pos.length) { const m = batchMesh(FT, true); staticGroup.remove(m); g.add(m); }
  if (MAPID === 'cemetery') finishGraveyard();                                       // сухие деревья и пни снаружи — инстансами
}
