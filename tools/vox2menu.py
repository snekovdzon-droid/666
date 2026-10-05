#!/usr/bin/env python3
"""assets/menu/hand.vox → src/02g_menu_hand.js (минимальный .vox в base64). Рука из земли для главного меню.
Исходник: Meshy .glb → node tools/glb2vox_faithful.js <hand.glb> assets/menu/hand.vox 60 24. После правок: python3 tools/vox2menu.py, затем python3 tools/build.py."""
import base64, pathlib, struct
root = pathlib.Path(__file__).resolve().parent.parent
def chunk(cid, body): return cid + struct.pack('<II', len(body), 0) + body
d = (root / 'assets' / 'menu' / 'hand.vox').read_bytes()
i = d.find(b'SIZE'); size = d[i + 12:i + 24]
i = d.find(b'XYZI'); n = struct.unpack('<I', d[i + 12:i + 16])[0]; xyzi = d[i + 12:i + 16 + 4 * n]
i = d.find(b'RGBA'); rgba = d[i + 12:i + 12 + 1024]
main = chunk(b'SIZE', size) + chunk(b'XYZI', xyzi) + chunk(b'RGBA', rgba)
b = b'VOX ' + struct.pack('<I', 150) + b'MAIN' + struct.pack('<II', 0, len(main)) + main
(root / 'src' / '02g_menu_hand.js').write_text("'use strict';\n/* Автогенерация: tools/vox2menu.py (assets/menu/hand.vox) */\nconst MENU_HAND_B64 = '" + base64.b64encode(b).decode() + "';\n", encoding='utf-8')
print('src/02g_menu_hand.js', len(b), 'байт .vox')
