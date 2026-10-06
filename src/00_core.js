'use strict';
/* =====================================================================
   Zombie Survivors — ВОКСЕЛЬНЫЙ ПРОТОТИП (тест вида, света и физики)
   Мир: x — восток, z — юг, y — вверх. 1 единица = 1 клетка карты.
   ===================================================================== */
const _MAPSEL = (() => { try { const v = JSON.parse(localStorage.getItem('zsv_map')); if (v === 'cemetery') return { id: 'cemetery', c: null }; if (typeof v === 'string' && v.startsWith('c:')) { const c = JSON.parse(localStorage.getItem('zsv_cmap_' + v.slice(2))); if (c && c.size) return { id: v, c }; } } catch (e) {} return { id: 'prison', c: null }; })();
const MAPID = _MAPSEL.id, CMAP = _MAPSEL.c;   // 'prison', 'cemetery' или 'c:<id>' — своя карта   // карту выбирают в меню (перезагрузка)
const MAP = MAPID === 'cemetery' ? 128 : CMAP ? CMAP.size : 96;
const STEP = 0.36;            // на сколько можно шагнуть вверх (ступенька)
const BODY_H = 1.15;          // рост персонажа
const TAU = Math.PI * 2;
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const IS_TOUCH = matchMedia('(pointer:coarse)').matches;
const RUN_TIME = 1200;        // забег 20 минут: с заката до ночи (план переноса, этап 2)
const lsGet = (k, d) => { try { const v = localStorage.getItem('zsv_' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem('zsv_' + k, JSON.stringify(v)); } catch (e) {} };
