from pathlib import Path
from PIL import Image, ImageDraw
import json
import math

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'content/packs/forest-survival/assets'
OUTPUT = ASSETS / 'runtime'
OUTPUT.mkdir(exist_ok=True)

# Preserve source artwork; bake the same circular crops at their existing display resolution.
def opened(path):
    source = Image.open(path)
    return source.convert('RGBA')

def atlas(cells, options):
    size, columns, name = options
    stride = size + 4
    rows = math.ceil(len(cells) / columns)
    sheet = Image.new('RGBA', (columns * stride, rows * stride))
    frames = {}
    for index, (key, cell) in enumerate(cells):
        x = index % columns * stride + 2
        y = index // columns * stride + 2
        sheet.paste(cell, (x, y))
        frames[key] = {'frame': {'x': x, 'y': y, 'w': size, 'h': size}, 'rotated': False, 'trimmed': False, 'spriteSourceSize': {'x': 0, 'y': 0, 'w': size, 'h': size}, 'sourceSize': {'w': size, 'h': size}}
    target = OUTPUT / f'{name}.webp'
    sheet.save(target, lossless=True, method=6)
    metadata = json.dumps({'frames': frames}, separators=(',', ':'))
    target = OUTPUT / f'{name}.json'
    target.write_text(metadata, encoding='utf-8')

mask = Image.new('L', (512, 512))
draw = ImageDraw.Draw(mask)
draw.ellipse((4, 4, 508, 508), fill=255)
mask = mask.resize((128, 128), Image.Resampling.LANCZOS)
portraits = []
source = opened(ROOT / 'apps/web/src/character-creator/assets/adventurer.webp')
cell = source.crop((source.width * .13, 0, source.width * .87, source.width * .74))
cell = cell.resize((128, 128), Image.Resampling.LANCZOS)
cell.putalpha(mask)
portraits.append(('ranger', cell))
for file, families in [('monster-atlas.png', ['tree', 'wolf', 'hammer', 'shield', 'archer', 'bomb']), ('monster-tactics-atlas.png', ['sower', 'protector', 'brood', 'moth', 'squirrel'])]:
    source = opened(ASSETS / file)
    width, height = source.width / 3, source.height / len(families)
    for row, family in enumerate(families):
        for column, rank in enumerate(['normal', 'elite', 'boss']):
            box = (column * width + 2, row * height + 2, (column + 1) * width - 2, (row + 1) * height - 2)
            cell = source.crop(box)
            cell = cell.resize((128, 128), Image.Resampling.LANCZOS)
            background = Image.new('RGBA', (128, 128), '#263e2c')
            background.alpha_composite(cell)
            background.putalpha(mask)
            portraits.append((f'{family}-{rank}', background))
for name, index in [('normal', 1), ('swift', 4), ('elite', 8)]:
    portraits.append((name, portraits[index][1]))
atlas(portraits, (128, 8, 'portraits'))

source = opened(ASSETS / 'monster-tactics-effects.png')
names = ['spore', 'poison', 'protection', 'vine', 'egg', 'hatch', 'echo', 'warning', 'acorn', 'escape', 'heal', 'frame-normal', 'frame-elite', 'frame-boss', 'rays', 'crystal']
effects = []
for index, name in enumerate(names):
    x, y = index % 4 * source.width / 4, index // 4 * source.height / 4
    box = (x, y, x + source.width / 4, y + source.height / 4)
    cell = source.crop(box)
    cell = cell.resize((256, 256), Image.Resampling.LANCZOS)
    if name == 'echo':
        ring = Image.new('L', (256, 256))
        draw = ImageDraw.Draw(ring)
        draw.ellipse((8, 8, 248, 248), fill=255)
        draw.ellipse((32, 32, 224, 224), fill=0)
        transparent = Image.new('RGBA', (256, 256))
        transparent.paste(cell, (0, 0), ring)
        cell = transparent
    effects.append((f'tactic-{name}', cell))
    if name in ['echo', 'warning']:
        cut = cell.copy()
        draw = ImageDraw.Draw(cut)
        draw.pieslice((-62, -62, 318, 318), -35, 35, fill=(0, 0, 0, 0))
        effects.append((f'tactic-{name}-open', cut))
atlas(effects, (256, 4, 'tactics'))
for filename, dimensions in [('ability-atlas.png', (1024, 1024)), ('resonance-atlas.webp', (1024, 512))]:
    source = opened(ASSETS / filename)
    source = source.resize(dimensions, Image.Resampling.LANCZOS)
    target = OUTPUT / (Path(filename).stem + '.webp')
    source.save(target, lossless=True, method=6)
source = opened(ROOT / 'content/common/inventory/item-atlas.png')
source = source.resize((384, 384), Image.Resampling.LANCZOS)
target = OUTPUT / 'loot.webp'
source.save(target, lossless=True, method=6)
for target in OUTPUT.iterdir():
    print(target.name, target.stat().st_size)
