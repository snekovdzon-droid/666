#!/usr/bin/env python3
"""Режет и сжимает звуки из пака (assets/sounds_src или папка из аргумента) в короткие моно-mp3,
кладёт их в assets/sounds/ и собирает src/02b_sound_assets.js (base64), чтобы игра оставалась одним файлом.
Запуск: python3 tools/gen_sounds.py [папка_с_паком]   — без аргумента просто пересобирает JS из assets/sounds/*.mp3"""
import sys, subprocess, base64, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
out = root / 'assets' / 'sounds'; out.mkdir(parents=True, exist_ok=True)
S1 = "Snake's Authentic Gun Sounds"; S2 = "Snake's SECOND Authentic Gun Sounds"
R1 = S1 + "/Reloads, Cycling & More/WAV/"
# имя: (файл, начало, длина, затухание в конце)
M = {
  'rifle_1': (S1 + "/Isolated/5.56/WAV/556 Single Isolated WAV.wav", 0, 0.6, 0.3),
  'rifle_2': (S1 + "/Isolated/5.56/WAV/556 Spray Isolated WAV.wav", 0, 0.6, 0.3),
  'rifle_3': (S1 + "/Isolated/5.56/WAV/556 Burst Isolated WAV.wav", 0, 0.6, 0.3),
  'mg_1': (S1 + "/Isolated/7.62x39/WAV/762x39 Single Isolated WAV.wav", 0, 0.55, 0.3),
  'mg_2': (S1 + "/Isolated/7.62x39/WAV/762x39 Spray Isolated WAV.wav", 0, 0.55, 0.3),
  'mg_3': (S1 + "/Isolated/7.62x39/WAV/762x39 Burst Isolated WAV.wav", 0, 0.55, 0.3),
  'smg_1': (S2 + "/Isolated/9mm/WAV/9mm Single Isolated.wav", 0, 0.45, 0.25),
  'smg_2': (S2 + "/Isolated/9mm/WAV/9mm Spray Isolated.wav", 0, 0.45, 0.25),
  'smg_3': (S2 + "/Isolated/9mm/WAV/9mm Burst Isolated.wav", 0, 0.45, 0.25),
  'revolver_1': (S1 + "/Isolated/7.62x54R/WAV/762x54r Single Isolated WAV.wav", 0, 0.95, 0.5),
  'revolver_2': (S2 + "/Isolated/.308 (7.62x51)/WAV/308 Single Isolated.wav", 0, 0.95, 0.5),
  'shotgun_1': (S2 + "/Isolated/20 Gauge/WAV/20 Gauge Single Isolated.wav", 0, 1.0, 0.5),
  'shotgun_2': (S2 + "/Isolated/20 Gauge/WAV/20 Gauge Slow Burst Isolated.wav", 0, 1.0, 0.5),
  'sawnoff_1': (S2 + "/Isolated/20 Gauge/WAV/20 Gauge Double Tap Isolated.wav", 0, 1.3, 0.6),
  'dry': ("assault rifle/pistol-dry-fire.wav", 0, 0.4, 0.1),
  'rifle_start': (R1 + "AR Reload Part 1 WAV.wav", 0, 0.56, 0.05),
  'rifle_end': (R1 + "AR Reload Part 2 WAV.wav", 0, 1.06, 0.05),
  'mg_start': (R1 + "Angel Mag Reload Part 1 WAV.wav", 0, 0.75, 0.05),
  'mg_end': (R1 + "Angel Mag Reload Part 2 WAV.wav", 0, 1.1, 0.05),
  'smg_start': (S2 + "/& More/Mag Pack/WAV/9mm Magazine Unpack.wav", 0, 0.65, 0.05),
  'smg_end': (S2 + "/& More/Mag Pack/WAV/9mm Magazine Pack.wav", 0, 1.0, 0.05),
  'revolver_start': (S2 + "/& More/Revolver/44 Magnum/WAV/44 Magnum Open Cylinder.wav", 0, 0.62, 0.05),
  'revolver_load': (S2 + "/& More/Revolver/44 Magnum/WAV/44 Magnum Single Load.wav", 0, 0.37, 0.05),
  'revolver_end': (S2 + "/& More/Revolver/44 Magnum/WAV/44 Magnum Close Cylinder.wav", 0, 0.34, 0.05),
  'shotgun_start': (R1 + "Pump Shell Load WAV.wav", 0, 0.8, 0.05),
  'shotgun_end': (R1 + "Pump Reload Part 2 WAV.wav", 0, 0.68, 0.05),
  'sawnoff_start': (R1 + "Single Shot Reload Part 1 WAV.wav", 0, 0.56, 0.05),
  'sawnoff_end': (R1 + "Single Shot Reload Part 2 WAV.wav", 0, 0.93, 0.05),
}
if len(sys.argv) > 1:
    src = pathlib.Path(sys.argv[1])
    for name, (f, t0, d, fade) in M.items():
        af = f"highpass=f=35,afade=t=out:st={d - fade}:d={fade},loudnorm=I=-16:TP=-1.5:LRA=7"
        subprocess.run(['ffmpeg', '-y', '-v', 'error', '-ss', str(t0), '-t', str(d), '-i', str(src / f), '-af', af, '-ac', '1', '-ar', '32000',
                        '-c:a', 'libmp3lame', '-b:a', '64k', str(out / (name + '.mp3'))], check=True)
js = ['/* Автогенерация: tools/gen_sounds.py. Звуки оружия (Snake / F8 Studios, itch.io) — короткие моно-mp3 в base64 */', 'const SND_B64 = {']
for f in sorted(out.glob('*.mp3')):
    js.append("  %s: '%s'," % (f.stem, base64.b64encode(f.read_bytes()).decode()))
js.append('};')
(root / 'src' / '02b_sound_assets.js').write_text('\n'.join(js) + '\n')
print(len(list(out.glob('*.mp3'))), 'files,', sum(f.stat().st_size for f in out.glob('*.mp3')) // 1024, 'KB')
