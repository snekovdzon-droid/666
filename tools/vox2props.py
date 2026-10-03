#!/usr/bin/env python3
"""Бочки (assets/props/barrel_old.vox, red_barrel.vox, рисуются в MagicaVoxel) → src/02e_prop_assets.js.
Закрытые со всех сторон воксели выкидываем (на вид не влияют). Запуск: python3 tools/vox2props.py"""
import struct, base64, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
FILES = {'barrel': 'barrel_old.vox', 'redbarrel': 'red_barrel.vox'}
def load(path):
    d = path.read_bytes(); vox = []; st = {'size': None, 'pal': None}
    def walk(o, end):
        while o < end:
            cid = d[o:o+4]; cn, ch = struct.unpack('<II', d[o+4:o+12]); s = o + 12
            if cid == b'SIZE' and st['size'] is None: st['size'] = struct.unpack('<III', d[s:s+12])
            elif cid == b'XYZI' and not vox:
                n = struct.unpack('<I', d[s:s+4])[0]; vox.extend(tuple(d[s+4+i*4:s+8+i*4]) for i in range(n))
            elif cid == b'RGBA': st['pal'] = d[s:s+1024]
            elif cid == b'MAIN': walk(s + cn, s + cn + ch)
            o = s + cn + ch
    walk(8, len(d)); return st['size'], vox, st['pal']
def chunk(i, data, kids=b''): return i + struct.pack('<II', len(data), len(kids)) + data + kids
lines = ['/* Автогенерация: tools/vox2props.py (assets/props) — бочки, base64 .vox без внутренних вокселей */', 'const PROP_VOX = {']
for key, fn in FILES.items():
    size, vox, pal = load(root / 'assets' / 'props' / fn)
    occ = {(v[0], v[1], v[2]) for v in vox}
    keep = [v for v in vox if not all((v[0]+a, v[1]+b, v[2]+c) in occ for a, b, c in ((1,0,0),(-1,0,0),(0,1,0),(0,-1,0),(0,0,1),(0,0,-1)))]
    main = chunk(b'MAIN', b'', chunk(b'SIZE', struct.pack('<III', *size)) + chunk(b'XYZI', struct.pack('<I', len(keep)) + b''.join(bytes(v) for v in keep)) + chunk(b'RGBA', pal))
    lines.append("  %s: '%s'," % (key, base64.b64encode(b'VOX ' + struct.pack('<I', 150) + main).decode()))
    print(key, size, len(vox), '->', len(keep))
lines.append('};'); (root / 'src' / '02e_prop_assets.js').write_text('\n'.join(lines) + '\n')
