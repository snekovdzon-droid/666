#!/usr/bin/env python3
"""Вшивает машину (assets/cars/car.vox, рисуется в MagicaVoxel) в src/02d_car_asset.js: внутренние воксели (закрытые со всех сторон) выкидываем —
на вид это ничего не меняет, а файл в ~3 раза меньше. Запуск: python3 tools/vox2js.py"""
import struct, base64, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
d = (root / 'assets' / 'cars' / 'car.vox').read_bytes()
vox, size, pal = [], None, None
def walk(o, end):
    global size, pal
    while o < end:
        cid = d[o:o+4]; cn, ch = struct.unpack('<II', d[o+4:o+12]); s = o + 12
        if cid == b'SIZE': size = struct.unpack('<III', d[s:s+12])
        elif cid == b'XYZI':
            n = struct.unpack('<I', d[s:s+4])[0]
            vox.extend(tuple(d[s+4+i*4:s+8+i*4]) for i in range(n))
        elif cid == b'RGBA': pal = d[s:s+1024]
        elif cid == b'MAIN': walk(s + cn, s + cn + ch)
        o = s + cn + ch
walk(8, len(d))
occ = {(v[0], v[1], v[2]) for v in vox}
keep = [v for v in vox if not all((v[0]+a, v[1]+b, v[2]+c) in occ for a, b, c in ((1,0,0),(-1,0,0),(0,1,0),(0,-1,0),(0,0,1),(0,0,-1)))]
def chunk(i, data, kids=b''): return i + struct.pack('<II', len(data), len(kids)) + data + kids
xyzi = struct.pack('<I', len(keep)) + b''.join(bytes(v) for v in keep)
main = chunk(b'MAIN', b'', chunk(b'SIZE', struct.pack('<III', *size)) + chunk(b'XYZI', xyzi) + chunk(b'RGBA', pal))
out = b'VOX ' + struct.pack('<I', 150) + main
(root / 'src' / '02d_car_asset.js').write_text("/* Автогенерация: tools/vox2js.py (assets/cars/car.vox) */\nconst CAR_VOX = '" + base64.b64encode(out).decode() + "';\n")
print(len(vox), '->', len(keep), 'вокселей;', len(out), 'байт')
