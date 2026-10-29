#!/usr/bin/env python3
"""Bundle local script tags from index.html into dist/zombie-voxel.html."""
import pathlib
import re

root = pathlib.Path(__file__).resolve().parent.parent
html = (root / 'index.html').read_text(encoding='utf-8')
script_tag = re.compile(r'<script\s+src=["\']([^"\']+)["\']\s*></script>')

def inline_script(match):
    relative = match.group(1)
    if relative.startswith(('http:', 'https:', '//')):
        raise ValueError(f'External script cannot be bundled: {relative}')
    source = (root / relative).resolve()
    if not source.is_relative_to(root):
        raise ValueError(f'Script path escapes project root: {relative}')
    if not source.is_file():
        raise FileNotFoundError(f'Missing script referenced by index.html: {relative}')
    return '<script>' + source.read_text(encoding='utf-8') + '</script>'

html, count = script_tag.subn(inline_script, html)
if not count:
    raise RuntimeError('No local script tags found in index.html; refusing to produce an incomplete build')

out = root / 'dist' / 'zombie-voxel.html'
out.parent.mkdir(exist_ok=True)
out.write_text(html, encoding='utf-8')
print(f'{out} ({out.stat().st_size // 1024} KB, {count} scripts bundled)')
