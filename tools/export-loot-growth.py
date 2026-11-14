from pathlib import Path
from PIL import Image
import json
import sys

root = Path(__file__).resolve().parent.parent
source = Path(sys.argv[1])
art = root / 'development/features/loot-growth/content/art'
art.mkdir(parents=True, exist_ok=True)
original = Image.open(source).convert('RGBA')
original.save(art / 'loot-growth-source.png')
atlas = Image.new('RGBA', (1024, 1024))
width, height = original.size
for index in range(16):
    column, row = index % 4, index // 4
    bounds = (round(column * width / 4), round(row * height / 4), round((column + 1) * width / 4), round((row + 1) * height / 4))
    cell = original.crop(bounds)
    resized = cell.resize((248, 248), Image.Resampling.LANCZOS)
    atlas.paste(resized, (column * 256 + 4, row * 256 + 4))
target = root / 'content/packs/forest-survival/assets/runtime/loot-growth.webp'
atlas.save(target, lossless=True, method=6)
provenance = {'source': 'AI-generated using built-in image_gen, 2026-11-14', 'usage': 'Seven transparent character level frames, a level plaque and eight neutral tintable VFX; 4x4 atlas, 256px cells', 'display': 'Player frames 40–96px; loot VFX 12–90px, independent transforms with shared textures', 'layout': ['bronze', 'iron', 'silver', 'gold', 'crystal', 'starlight', 'maximum', 'plaque', 'halo', 'spark', 'trail', 'level-up', 'absorb', 'motes', 'ground', 'wisp']}
serialized = json.dumps(provenance, ensure_ascii=False, indent=2)
(art / 'loot-growth.provenance.json').write_text(serialized, encoding='utf-8')
print(target)
print(f'{width}x{height} -> 1024x1024; {target.stat().st_size} bytes')
