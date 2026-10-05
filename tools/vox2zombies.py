#!/usr/bin/env python3
"""assets/zombies/prison_*.vox (MagicaVoxel) → src/02f_prison_zombies.js: минимальный .vox (SIZE, XYZI, RGBA) в base64.
Тюремные варианты обычных зомби и бегунов (карта «Тюрьма»). После правок: python3 tools/vox2zombies.py, затем python3 tools/build.py."""
import base64, glob, pathlib, struct
root = pathlib.Path(__file__).resolve().parent.parent
def chunk(cid, body): return cid + struct.pack('<II', len(body), 0) + body
def minimal(d):
    i = d.find(b'SIZE'); size = d[i + 12:i + 24]
    i = d.find(b'XYZI'); n = struct.unpack('<I', d[i + 12:i + 16])[0]; xyzi = d[i + 12:i + 16 + 4 * n]
    i = d.find(b'RGBA'); rgba = d[i + 12:i + 12 + 1024]
    main = chunk(b'SIZE', size) + chunk(b'XYZI', xyzi) + chunk(b'RGBA', rgba)
    return b'VOX ' + struct.pack('<I', 150) + b'MAIN' + struct.pack('<II', 0, len(main)) + main
out = ["'use strict';", "/* Автогенерация: tools/vox2zombies.py (assets/zombies/prison_*.vox) — тюремные ходоки и бегуны, base64 .vox */", "const PRISON_ZED = {"]
for n, f in enumerate(sorted(glob.glob(str(root / 'assets' / 'zombies' / 'prison_*.vox')))):
    out.append("  p%d: '%s'," % (n + 1, base64.b64encode(minimal(open(f, 'rb').read())).decode()))
out.append("};")
(root / 'src' / '02f_prison_zombies.js').write_text('\n'.join(out) + '\n', encoding='utf-8')
print('src/02f_prison_zombies.js', len(out) - 4, 'моделей')
