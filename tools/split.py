#!/usr/bin/env python3
"""Обратная операция к build.py: разбирает собранный zombie-voxel.html на index.html + файлы скриптов.
Использование: python3 tools/split.py <собранный.html>
Файлы берутся по порядку из <script src=...> текущего index.html."""
import re, sys, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
built = pathlib.Path(sys.argv[1]).read_text(encoding='utf-8')
idx = (root / 'index.html').read_text(encoding='utf-8')
tags = re.findall(r'<script src="([^"]+)"></script>|<script>(?:(?!</script>).)*?</script>', idx, re.S)
pat = re.compile(r'<script>(.*?)</script>', re.S)
bodies = pat.findall(built)
if len(bodies) != len(tags):
    sys.exit(f'скриптов в сборке {len(bodies)}, в index.html {len(tags)}')
# новый index.html: оболочка из сборки, скрипты — теги из старого index.html
it2 = iter(re.findall(r'<script src="[^"]+"></script>|<script>(?:(?!</script>).)*?</script>', idx, re.S))
newidx = pat.sub(lambda m: next(it2), built)
for t, b in zip(tags, bodies):
    if t:
        p = root / t; p.parent.mkdir(parents=True, exist_ok=True); p.write_text(b, encoding='utf-8')
(root / 'index.html').write_text(newidx, encoding='utf-8')
print('готово:', sum(1 for t in tags if t), 'файлов')
