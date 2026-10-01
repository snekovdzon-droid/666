#!/usr/bin/env python3
"""Собирает все .vox из assets/parts/ в один скрипт assets/parts.js (игра открывается просто из файла, без сервера).
Запуск после правки любого .vox или names.json:   python3 tools/build_parts.py"""
import base64, json, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
src = root / 'assets' / 'parts'
names = json.loads((src / 'names.json').read_text(encoding='utf-8'))
files, order = {}, {}
for d in sorted(p for p in src.iterdir() if p.is_dir()):
    ids = []
    for f in sorted(d.glob('*.vox')):
        files[f'{d.name}/{f.stem}'] = base64.b64encode(f.read_bytes()).decode()
        base = f.stem[:-2] if f.stem[-2:] in ('_m', '_f') else f.stem       # tops/jacket_m и jacket_f — один вариант «jacket»
        if base not in ids: ids.append(base)
    listed = [(i, n) for i, n in names.get(d.name, []) if i in ids]
    rest = [(i, i) for i in ids if i not in [x for x, _ in listed]]
    order[d.name] = listed + rest
out = root / 'assets' / 'parts.js'
out.write_text('// Собрано tools/build_parts.py из assets/parts/*.vox — руками не править\nconst PART_FILES = ' + json.dumps(files, ensure_ascii=False) +
               ';\nconst PART_LIST = ' + json.dumps(order, ensure_ascii=False) + ';\n', encoding='utf-8')
print(out, out.stat().st_size // 1024, 'KB,', len(files), 'файлов')
