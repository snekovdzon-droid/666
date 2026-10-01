# Zombie Survivors (voxel)

Версия: v0.18. Браузерный выживач на three.js.

- `index.html` — разметка и стили, запуск: открыть файл в браузере
- `src/game.js` — весь код игры
- `assets/models.js` — модели Meshy (base64 glb)
- `vendor/` — three.js, GLTFLoader, meshopt-декодер (не править)
- `tools/build.py` — собирает один файл `dist/zombie-voxel.html`
- `tools/smoke.js` — проверка в Chromium: `node tools/smoke.js index.html`
