from pathlib import Path
from PIL import Image
import json

root = Path(__file__).resolve().parents[1]
assets = root / 'content/packs/forest-survival/assets'
source = Image.open(assets / 'monster-vfx-source.png').convert('RGBA')
names = ['roots', 'sweep', 'furrow', 'claw', 'cracks', 'hammer', 'smash', 'shield', 'collision', 'thorn', 'leaves', 'amber', 'blast', 'mycelium', 'break', 'hurt', 'block', 'absorb', 'dust', 'crystal']
sheet = Image.new('RGBA', (1040, 1300))
frames = {}
for index, name in enumerate(names):
    col, row = index % 4, index // 4
    box = (round(col * source.width / 4), round(row * source.height / 5), round((col + 1) * source.width / 4), round((row + 1) * source.height / 5))
    cell = source.crop(box)
    cell = cell.resize((256, 256), Image.Resampling.LANCZOS)
    x, y = col * 260 + 2, row * 260 + 2
    sheet.paste(cell, (x, y))
    frames[name] = {'frame': {'x': x, 'y': y, 'w': 256, 'h': 256}, 'rotated': False, 'trimmed': False, 'spriteSourceSize': {'x': 0, 'y': 0, 'w': 256, 'h': 256}, 'sourceSize': {'w': 256, 'h': 256}}
target = assets / 'runtime/monster-vfx.webp'
sheet.save(target, lossless=True, method=6)
metadata = json.dumps({'frames': frames}, separators=(',', ':'))
target = assets / 'runtime/monster-vfx.json'
target.write_text(metadata, encoding='utf-8')
