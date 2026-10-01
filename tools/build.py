#!/usr/bin/env python3
"""Собирает index.html + скрипты в один файл dist/zombie-voxel.html."""
import re, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
html = (root / 'index.html').read_text(encoding='utf-8')
html = re.sub(r'<script src="([^"]+)"></script>',
              lambda m: '<script>' + (root / m.group(1)).read_text(encoding='utf-8') + '</script>', html)
out = root / 'dist' / 'zombie-voxel.html'
out.parent.mkdir(exist_ok=True)
out.write_text(html, encoding='utf-8')
print(out, out.stat().st_size // 1024, 'KB')
