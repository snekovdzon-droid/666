'use strict';
/* ---------- Воксельные стволы (assets/guns → src/02c_gun_assets.js): модель, хват, поза «оружие опущено», дуло и выброс гильз ----------
   Ствол — один меш из вокселей с началом в точке хвата задней руки, дуло смотрит в +Z. Руки героя растягиваются по длине и тянутся
   к рукояти и цевью (IK без локтя), на кистях — кубики цвета кожи. Точки (рукоять, цевьё, дуло, выброс) заданы в tools/glb2vox.js. */
const GUNM = {}, GM_INST = new Map(); let GFRAME = 0;
const GUN_MAT = new THREE.MeshLambertMaterial({ vertexColors: true });
function parseGunVox(b64) {
  const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  const d = new DataView(u.buffer); let size = null, vox = [], pal = null;
  const walk = (o, end) => { while (o < end) { const id = String.fromCharCode(u[o], u[o + 1], u[o + 2], u[o + 3]), cn = d.getUint32(o + 4, true), ch = d.getUint32(o + 8, true), s = o + 12;
    if (id === 'SIZE') size = [d.getUint32(s, true), d.getUint32(s + 4, true), d.getUint32(s + 8, true)];
    else if (id === 'XYZI') { const n = d.getUint32(s, true); for (let i = 0; i < n; i++) vox.push([u[s + 4 + i * 4], u[s + 5 + i * 4], u[s + 6 + i * 4], u[s + 7 + i * 4]]); }
    else if (id === 'RGBA') pal = u.subarray(s, s + 1024);
    else if (id === 'MAIN') walk(s + cn, s + cn + ch);
    o = s + cn + ch; } };
  walk(8, u.length); return { size, vox, pal };
}
// модель ствола: грани только снаружи, цвета вершин; единицы — метры игры, ноль — в точке хвата задней руки
function gunModel(id) {
  if (GUNM[id] !== undefined) return GUNM[id];
  const A = typeof GUN_ASSETS !== 'undefined' ? GUN_ASSETS[id] : null; if (!A) return GUNM[id] = null;
  const { size, vox, pal } = parseGunVox(A.b64), [sx, sy, sz] = size, vs = A.len / sy, occ = new Set(vox.map(v => v[0] + sx * (v[1] + sy * v[2]))), gy = A.grip[0], gz = A.grip[1];
  const has = (x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < sx && y < sy && z < sz && occ.has(x + sx * (y + sy * z));
  const P = [], N = [], C = [], I = [], col = new THREE.Color();
  // игровые оси: X = -x_vox (поворот без зеркала), Y = z_vox (вверх), Z = y_vox (вперёд)
  const toG = (x, y, z) => [-(x - sx / 2) * vs, (z - gz) * vs, (y - gy) * vs];
  for (const [x, y, z, ci] of vox) {
    const p4 = (ci - 1) * 4; col.setRGB(pal[p4] / 255, pal[p4 + 1] / 255, pal[p4 + 2] / 255).convertSRGBToLinear();
    for (let a = 0; a < 3; a++) for (const sg of [-1, 1]) {
      const n = [0, 0, 0]; n[a] = sg; if (has(x + n[0], y + n[1], z + n[2])) continue;
      const u = (a + 1) % 3, v = (a + 2) % 3, base = P.length / 3, pos = [x, y, z];
      const corners = sg > 0 ? [[0, 0], [1, 0], [1, 1], [0, 1]] : [[0, 0], [0, 1], [1, 1], [1, 0]];
      for (const [cu, cv] of corners) { const q = pos.slice(); q[a] += sg > 0 ? 1 : 0; q[u] += cu; q[v] += cv; P.push(...toG(q[0], q[1], q[2])); N.push(-n[0], n[2], n[1]); C.push(col.r, col.g, col.b); }
      I.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); geo.setIndex(I); geo.computeBoundingSphere();
  const rel = pt => pt ? [0, (pt[1] - gz) * vs, (pt[0] - gy) * vs] : null;                       // точка относительно хвата (x, y вверх, z вперёд), м
  return GUNM[id] = { geo, vs, stance: A.stance, fore: rel(A.fore), muz: rel(A.muz), eject: rel(A.eject || A.muz) };
}
const gunIdOf = p => p.gun === 'smg' && p.lv && p.lv.smg_uzi ? 'uzi' : p.gun;
function gunModelOf(p) { return p.hand ? null : gunModel(gunIdOf(p)); }
const _gv = [0, 0, 0];
function rotX(th, y, z) { const c = Math.cos(th), s = Math.sin(th); return [y * c - z * s, y * s + z * c]; }
// рука тянется к точке: углы части, поворот вокруг вертикали и растяжение по длине (длина руки модели — 0,352 роста)
function armAim(sh, t) {
  const dx = t[0] - sh[0], dy = t[1] - sh[1], dz = t[2] - sh[2], d = Math.hypot(dx, dy, dz) || 1e-3, hz = Math.hypot(dx, dz), L = 0.352 * VZ.H;
  return { a: Math.atan2(-hz / d, -dy / d), yaw: Math.atan2(dx, dz), sc: clamp((d + 0.03) / L, 0.6, 1.5) };
}
// где ствол и руки; ready — 1 поднят, 0 опущен; pitch — наклон прицела; dip — наклон при перезарядке
function gunHold(p, ready, pitch, kick, dip) {
  const G = gunModelOf(p); if (!G) return null;
  const Mh = VOXHEROES[p.idx % VOXHEROES.length], pa = Mh.parts.armA.pivot, pb = Mh.parts.armB.pivot, H = VZ.H, W = VZ.W;
  const SA = [pa[0] * H * W, pa[1] * H, pa[2] * H * W], SB = [pb[0] * H * W, pb[1] * H, pb[2] * H * W], xc = (SA[0] + SB[0]) / 2;
  const low = 1 - ready, th = -pitch + dip + 0.95 * low - kick * 0.05, twin = twinGuns(p);
  let gx = xc, gy, gz;
  if (G.stance === 'pistol') { gy = SA[1] - 0.07 - 0.16 * low; gz = SA[2] + 0.36 - 0.06 * low; }
  else if (G.stance === 'smg') { gx = xc - 0.02; gy = SA[1] - 0.14 - 0.14 * low; gz = SA[2] + 0.26 - 0.05 * low; }
  else { gx = xc - 0.03 + 0.05 * low; gy = SA[1] - 0.19 - 0.12 * low; gz = SA[2] + 0.21 - 0.03 * low; }
  gz -= kick * 0.035;
  const tr = (off, base) => { const [oy, oz] = rotX(th, off[1], off[2]); return [base[0] + off[0], base[1] + oy, base[2] + oz]; };
  const H0 = { G, th, twin: null, handB: null };
  const mk = (gxx, sh, shB, withFore) => {
    const grip = [gxx, gy, gz], fp = withFore && G.fore ? tr(G.fore, grip) : null;
    return { grip, handA: grip, handB: fp, armA: armAim(sh, grip), armB: fp ? armAim(shB, fp) : null, muz: tr(G.muz, grip), eject: tr(G.eject, grip) };
  };
  if (twin) {                                                                                    // два ствола: в каждой руке свой
    const a = mk(SA[0] * 0.6, SA, SB, false), b = mk(SB[0] * 0.6, SB, SB, false); b.armA = armAim(SB, b.grip);
    return Object.assign(H0, a, { armB: b.armA, handB: b.grip, twin: b });
  }
  return Object.assign(H0, mk(gx, SA, SB, true));
}
// дуло и выброс гильз в мире (для пуль, дыма, гильз): ствол всегда поднят
function gunPoint(p, kind) {
  const HD = gunHold(p, 1, p.pitch || 0, 0, 0); if (!HD) return null;
  let src = kind === 'eject' ? HD.eject : HD.muz;
  if (HD.twin && (p.twinSide || 1) < 0) src = kind === 'eject' ? HD.twin.eject : HD.twin.muz;
  let [lx, ly, lz] = src; if (kind !== 'eject' && p.att && p.att.barrel) { const [dy, dz] = rotX(HD.th, 0, 0.17); ly += dy; lz += dz; }
  const c = Math.cos(p.yaw), s = Math.sin(p.yaw);
  return { x: p.x + lx * c + lz * s, y: p.y + ly, z: p.z - lx * s + lz * c };
}
function gunInst(p, slot, id) {
  const key = p.idx + ':' + slot; let m = GM_INST.get(key);
  if (!m) { m = new THREE.Mesh(GUNM[id].geo, GUN_MAT); m.matrixAutoUpdate = false; m.frustumCulled = false; m.castShadow = true; m.receiveShadow = true; scene.add(m); GM_INST.set(key, m); }
  if (m.userData.id !== id) { m.geometry = GUNM[id].geo; m.userData.id = id; }
  m.userData.f = GFRAME; m.visible = true; return m;
}
const _gM = new THREE.Matrix4(), _gR = new THREE.Matrix4();
// рисует ствол(ы) и кисти; корень _root уже стоит на герое (масштаб 1, наклон и качка корпуса)
function drawGunAndHands(c, HD) {
  const place = (grip, th, slot) => { const m = gunInst(c, slot, gunIdOf(c)); _gM.makeTranslation(grip[0], grip[1], grip[2]); _gR.makeRotationX(th); _gM.multiply(_gR); m.matrix.multiplyMatrices(_root, _gM); m.matrixWorldNeedsUpdate = true; m.matrixWorld.copy(m.matrix); };
  place(HD.grip, HD.th, 0); if (HD.twin) place(HD.twin.grip, HD.th, 1);
  const skin = lin(c.look[0]);
  const hand = h => { if (h) part(skin, h[0], h[1], h[2], 0, 0.058, 0.058, 0.07, 0, 0); };
  hand(HD.handA); hand(HD.handB);
}
function gunsFrameBegin() { GFRAME++; }
function gunsFrameEnd() { for (const m of GM_INST.values()) if (m.userData.f !== GFRAME) m.visible = false; }
