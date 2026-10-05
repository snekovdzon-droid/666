# MANY DEAD (voxel)

Версия: v0.77. Браузерный выживач на three.js.

- `index.html` — разметка и стили, запуск: открыть файл в браузере
- Редактор персонажа: `src/04b_hero_gen.js` (сборка героя из частей), `src/11b_hero_editor.js` (окно редактора). Кнопка — в меню выбора класса. Герои хранятся в браузере.
- `assets/parts/` — модели частей героя в `.vox` (тело, причёски, бороды, одежда, обувь, шляпы, очки, рюкзак), правила и цвета-метки — в `assets/parts/README.md`. После правки: `python3 tools/build_parts.py`, затем `python3 tools/build.py`.
- `src/*.js` — код игры по разделам, грузятся по порядку номеров: 00 ядро, 01 данные (классы, зомби, перки), 02 воксельные модели, 03 мир и рендер, 04 постройки и карта, 05 персонажи и частицы, 06 состояние, 07 управление, 08 бой, 09 перки/предметы/девайсы, 10 обновление кадра, 11 звук и отладка, 12 меню и главный цикл
- `assets/models.js` — модели Meshy (base64 glb)
- `vendor/` — three.js, GLTFLoader, meshopt-декодер (не править)
- `tools/build.py` — собирает один файл `dist/zombie-voxel.html`
- `tools/smoke.js` — проверка в Chromium: `node tools/smoke.js index.html` (меню) и `node tools/play.js index.html` (запуск боя)

## Арбалет (v0.68)
Спека — `CROSSBOW_REDESIGN.md`. Карточки в `src/01_data.js` (`cb_*`, пути fire / boom / drum), статы — `wStat` в `src/06_state.js`, выстрел и наконечники — `src/08_combat.js`. Проверки: `node tools/crossbow_test.js`, `node tools/crossbow_hits.js`.

## Оптимизация (v0.74)
Телефон по умолчанию — качество «Авто» (старт со «Средней»). Звуки распаковываются по одному после первого касания, музыка кладбища — только на кладбище (−22 МБ памяти на тюрьме). Замер: `node tools/perf_test.js dist/zombie-voxel.html prison` (или `cemetery`). Дальше по списку: лампы и тени на телефоне, вынос звуков и моделей из одного файла.

## Тюремные зомби (v0.75)
`assets/zombies/prison_1..4.vox` (рисуются в MagicaVoxel, геометрия как у Zed_1–4, другие цвета). После правок: `python3 tools/vox2zombies.py`, затем `python3 tools/build.py`. На карте «Тюрьма» 70% ходоков и бегунов — тюремные (`pickVm` в `src/05_characters_fx.js`), на других картах их нет.

## Главное меню (v0.77)
Сцена «кладбище и рука из земли», рисуется в маленький буфер (≈270 строк) и растягивается без сглаживания — пиксель-арт, с шейдером цвета и виньеткой — `src/12i_menu_graveyard.js` (рука разрезана на ладонь и 5 пальцев по вокселям, пальцы вздрагивают, «Одиночная игра»/«Кооп» сжимают кулак перед выбором класса, пиксельный логотип рисуется кодом). Рука: `assets/menu/hand.vox` ← Meshy `.glb` через `node tools/glb2vox_faithful.js hand.glb assets/menu/hand.vox 60 24`, затем `python3 tools/vox2menu.py` и `python3 tools/build.py`. Скриншоты: `node tools/menu_shot.js dist/zombie-voxel.html 1280 720 /tmp/menu`.

## Особые мобы
Данные (здоровье, скорость, время появления) — `ZOMBIES` в `src/01_data.js`; поведение, вид и звуки — `src/11d_mobs.js`.
Громила, Кричащий, Плевун, Бунтарь со щитом, Тюремный пёс (стаи), Начальник тюрьмы (босс на 10-й и 18-й минутах).
Проверка: `node tools/mobs_test.js index.html`.

## Интерфейс («досье»)
- `src/11e_hud.js` — пиксельные иконки (`PIX`), сердца, радар, подсказки у ящиков и предметов, стрелка к боссу.
- `src/11f_screens.js` — карточки перков, пауза, экран итогов.
- Окна в одном стиле: плашка с оранжевым акцентом слева, кнопки как в главном меню (стили — в конце `<style>` в `index.html`).
- Проверка: `node tools/hud_test.js`, `node tools/screens_test.js` (скриншоты).
- Настройка HUD: `src/11g_hud_layout.js` (Настройки → Настроить HUD: перетаскивание и размер каждого элемента, хранится в браузере). Проверка: `node tools/hudedit_test.js`.
- Раздельный экран в коопе: `src/10_update.js` (SPLIT: камеры по игрокам), включается кнопкой «Экран» при выборе класса или в Настройках. Проверка: `node tools/split_test.js`.

## Карта «Тюрьма»
Описана данными в `src/04c_map_prison.js` (`MAP_PRISON`: зоны земли, список операций, точки выхода зомби, фиксированные места ящиков). Ворота (F / Y, зомби ломают), прожекторы на вышках, полуоткрытые здания (`shed`).
Проверки: `node tools/map_check.js` (проходимость), `node tools/map_view.js` (вид всей карты), `node tools/map_tour.js` (экскурсия), `node tools/gate_test.js`.

## Звуки оружия
Записи выстрелов и перезарядок — Snake's Authentic Gun Sounds (1 и 2), автор Snake / F8 Studios, itch.io (https://f8studios.itch.io/snakes-authentic-gun-sounds), свободная лицензия. Нарезаны и сжаты скриптом `tools/gen_sounds.py` (`assets/sounds/*.mp3` → `src/02b_sound_assets.js`). В настройках можно вернуться к синтезированным звукам.

## Воксельные стволы
Модели из Meshy (`.glb`) превращаются в маленькие `.vox` скриптом `node tools/glb2vox.js <папка с g_<id>.glb>`: вокселизация, палитра игры (4 тона стали, 2 тона дерева), сглаживание пятен. Результат: `assets/guns/<id>.vox` (открываются в MagicaVoxel) и `src/02c_gun_assets.js` (вшит в игру). Точки хвата, цевья, дула и выброса гильз, размер и длина ствола лежат в `assets/guns/guns.json`; предпросмотр — `node tools/gunview.js out.png revolver,rifle`. Загрузка и хват — `src/11k_guns.js`.

## Машины
Модель машины — `assets/cars/car.vox` (рисуется в MagicaVoxel; синие тона — краска кузова, перекрашиваются в красный, синий, зелёный или светлый). После правок: `python3 tools/vox2js.py`, затем `python3 tools/build.py`. Автобусы из игры убраны.

## Бочки
`assets/props/barrel_old.vox` (обычная) и `red_barrel.vox` (красная взрывная) — рисуются в MagicaVoxel (исходно получены из Meshy `.glb` скриптом `tools/glb2vox_faithful.js`). После правок: `python3 tools/vox2props.py`, затем `python3 tools/build.py`. Код — `src/04f_barrel_vox.js`.
