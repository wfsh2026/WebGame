import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const assetsUrl = new URL('../content/packs/forest-survival/assets/', import.meta.url);
const sourceUrl = new URL('monster-skills-source.png', assetsUrl);
const source = await readFile(sourceUrl); const encoded = source.toString('base64');
const names = ['roots', 'sweep', 'furrow', 'claw', 'cracks', 'hammer', 'smash', 'shield', 'collision', 'thorn', 'trail', 'amber', 'blast', 'poison', 'spore', 'crystal', 'vine', 'protection', 'egg', 'hatch'];

// Crop and pack generated raster artwork; the exporter does not draw replacement art.
async function exportAtlas(options) {
  const image = new Image(); image.src = options.source; await image.decode();
  const sourceCanvas = document.createElement('canvas'); sourceCanvas.width = image.width; sourceCanvas.height = image.height;
  const sourceContext = sourceCanvas.getContext('2d'); if (!sourceContext) throw new Error('无法创建原稿画布');
  sourceContext.drawImage(image, 0, 0);
  const pixels = sourceContext.getImageData(0, 0, image.width, image.height).data;
  const strength = [];
  for (let y = 0; y < image.height; y += 1) {
    let count = 0;
    for (let x = 0; x < image.width; x += 1) if (pixels[(y * image.width + x) * 4 + 3] > 192) count += 1;
    strength.push(count);
  }
  const bands = []; let start = -1; let last = -1;
  for (let y = 0; y <= image.height; y += 1) {
    const occupied = y < image.height && strength[y] > image.width * .02;
    if (occupied) { if (start < 0) start = y; last = y; }
    if (start >= 0 && (y - last > 12 || y === image.height)) {
      if (last - start > 20) bands.push({ start, end: last + 1 });
      start = -1;
    }
  }
  if (bands.length !== 5) throw new Error(`技能原稿应包含五行独立素材，实际识别到 ${bands.length} 行`);
  const core = document.createElement('canvas'); core.width = 1040; core.height = 1300;
  const glow = document.createElement('canvas'); glow.width = core.width; glow.height = core.height;
  const context = core.getContext('2d'); const glowContext = glow.getContext('2d');
  if (!context || !glowContext) throw new Error('无法创建技能图集画布');
  const frames = {}; const display = {};
  for (const [index, name] of options.names.entries()) {
    const row = Math.floor(index / 4); const column = index % 4;
    const left = Math.round(column * image.width / 4); const right = Math.round((column + 1) * image.width / 4);
    const top = row === 0 ? 0 : Math.round((bands[row - 1].end + bands[row].start) / 2);
    const bottom = row === 4 ? image.height : Math.round((bands[row].end + bands[row + 1].start) / 2);
    let minX = right; let maxX = left; let minY = bottom; let maxY = top;
    for (let y = top; y < bottom; y += 1) for (let x = left; x < right; x += 1) {
      if (pixels[(y * image.width + x) * 4 + 3] < 192) continue;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    if (maxX <= minX || maxY <= minY) throw new Error(`技能素材缺少有效透明主体: ${name}`);
    const bodyWidth = maxX - minX + 1; const bodyHeight = maxY - minY + 1;
    const longest = Math.max(bodyWidth, bodyHeight); const scale = 208 / longest;
    const tile = document.createElement('canvas'); tile.width = 256; tile.height = 256;
    const tileContext = tile.getContext('2d'); if (!tileContext) throw new Error('无法创建技能切片');
    const dx = 128 + (left - (minX + maxX + 1) / 2) * scale;
    const dy = 128 + (top - (minY + maxY + 1) / 2) * scale;
    const width = (right - left) * scale; const height = (bottom - top) * scale;
    tileContext.drawImage(image, left, top, right - left, bottom - top, dx, dy, width, height);
    const x = column * 260 + 2; const y = row * 260 + 2;
    context.drawImage(tile, x, y);
    const halo = document.createElement('canvas'); halo.width = 256; halo.height = 256;
    const haloContext = halo.getContext('2d'); if (!haloContext) throw new Error('无法创建外光切片');
    haloContext.filter = 'blur(6px)'; haloContext.drawImage(tile, 0, 0); glowContext.drawImage(halo, x, y);
    frames[name] = { frame: { x, y, w: 256, h: 256 }, rotated: false, trimmed: false, spriteSourceSize: { x: 0, y: 0, w: 256, h: 256 }, sourceSize: { w: 256, h: 256 } };
    display[name] = { width: 256 / (bodyWidth * scale), height: 256 / (bodyHeight * scale) };
  }
  const coreUrl = core.toDataURL('image/png'); const glowUrl = glow.toDataURL('image/png');
  return { core: coreUrl.split(',')[1], glow: glowUrl.split(',')[1], metadata: { frames, meta: { display } }, bands, width: image.width, height: image.height };
}

const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage(); const input = { source: `data:image/png;base64,${encoded}`, names };
  const result = await page.evaluate(exportAtlas, input);
  for (const [filename, value] of [['monster-skills.png', result.core], ['monster-skills-glow.png', result.glow]]) {
    const target = new URL(`runtime/${filename}`, assetsUrl); const buffer = Buffer.from(value, 'base64');
    await writeFile(target, buffer); const path = fileURLToPath(target); console.log(`${path}: ${buffer.length} bytes`);
  }
  const metadataUrl = new URL('runtime/monster-skills.json', assetsUrl); const metadata = JSON.stringify(result.metadata);
  await writeFile(metadataUrl, metadata);
  const summary = JSON.stringify({ source: [result.width, result.height], rows: result.bands, sprites: names.length }); console.log(summary);
} finally { await browser.close(); }
