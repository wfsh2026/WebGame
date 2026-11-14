import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const sourceDirectory = new URL('../development/features/battle-banners/content/art/', import.meta.url);
const runtimeDirectory = new URL('../content/packs/forest-survival/assets/runtime/', import.meta.url);
const kinds = ['power', 'tempo', 'wind', 'energy', 'guard'];

// Extract generated raster layers, align cloth attachment points, and pack padded runtime frames.
async function exportSprites(options) {
  const image = new Image(); image.src = options.source; await image.decode();
  const source = document.createElement('canvas'); source.width = image.width; source.height = image.height;
  const sourceContext = source.getContext('2d');
  if (!sourceContext) throw new Error('无法创建战旗原稿画布');
  sourceContext.drawImage(image, 0, 0);
  const pixels = sourceContext.getImageData(0, 0, image.width, image.height).data;
  const bands = [];
  if (!options.cloth) {
    let start = -1; let last = -1;
    for (let y = 0; y <= image.height; y += 1) {
      let count = 0;
      if (y < image.height) for (let x = 0; x < image.width; x += 1) if (pixels[(y * image.width + x) * 4 + 3] > 192) count += 1;
      if (count > image.width * .02) { if (start < 0) start = y; last = y; }
      if (start >= 0 && (y - last > 30 || y === image.height)) { bands.push({ top: start, bottom: last + 1 }); start = -1; }
    }
    if (bands.length !== 5) throw new Error(`战旗特效原稿应有5行素材，实际识别到${bands.length}行`);
  }
  function bounds(region) {
    let left = region.right; let right = region.left; let top = region.bottom; let bottom = region.top;
    for (let y = region.top; y < region.bottom; y += 1) for (let x = region.left; x < region.right; x += 1) {
      if (pixels[(y * image.width + x) * 4 + 3] < 192) continue;
      left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
    if (right <= left || bottom <= top) throw new Error('战旗原稿单元缺少可导出的主体');
    return { left, right: right + 1, top, bottom: bottom + 1, width: right - left + 1, height: bottom - top + 1 };
  }
  const regions = [];
  for (let row = 0; row < 5; row += 1) for (let column = 0; column < options.columns; column += 1) {
    const region = { left: Math.round(column * image.width / options.columns), right: Math.round((column + 1) * image.width / options.columns), top: Math.round(row * image.height / 5), bottom: Math.round((row + 1) * image.height / 5) };
    if (bands.length) {
      region.top = row === 0 ? 0 : Math.round((bands[row - 1].bottom + bands[row].top) / 2);
      region.bottom = row === 4 ? image.height : Math.round((bands[row].bottom + bands[row + 1].top) / 2);
    }
    const body = bounds(region);
    regions.push({ ...region, body, row, column });
  }
  const canvas = document.createElement('canvas'); canvas.width = options.columns * 260; canvas.height = 1300;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('无法创建战旗图集画布');
  const frames = {};
  for (const region of regions) {
    const { row, column, body } = region;
    const tile = document.createElement('canvas'); tile.width = 256; tile.height = 256;
    const tileContext = tile.getContext('2d');
    if (!tileContext) throw new Error('无法创建战旗素材切片');
    let scale = 224 / Math.max(body.width, body.height);
    let x = 128 - (body.left + body.right) / 2 * scale;
    let y = 128 - (body.top + body.bottom) / 2 * scale;
    let suffix = options.layers[column];
    if (options.cloth && column === 0) {
      x = 128 - (body.left + body.right) / 2 * scale;
      y = 240 - body.bottom * scale;
    }
    if (options.cloth && column > 0) {
      const rowFrames = regions.filter(entry => entry.row === row && entry.column > 0);
      const widths = rowFrames.map(entry => entry.body.width);
      const maximum = Math.max(...widths);
      scale = 216 / maximum;
      const attachmentWidth = Math.round(body.width * .08); const bandWidth = Math.max(4, attachmentWidth);
      const attachmentRegion = { left: body.left, right: body.left + bandWidth, top: body.top, bottom: body.bottom };
      const attachment = bounds(attachmentRegion);
      x = 20 - body.left * scale;
      y = 64 - attachment.top * scale;
      suffix = `cloth-${column - 1}`;
    }
    const left = Math.max(region.left, body.left - 6); const right = Math.min(region.right, body.right + 6);
    const top = Math.max(region.top, body.top - 6); const bottom = Math.min(region.bottom, body.bottom + 6);
    const dx = x + left * scale; const dy = y + top * scale;
    const width = (right - left) * scale; const height = (bottom - top) * scale;
    tileContext.drawImage(image, left, top, right - left, bottom - top, dx, dy, width, height);
    const frameX = column * 260 + 2; const frameY = row * 260 + 2;
    context.drawImage(tile, frameX, frameY);
    const name = `${options.kinds[row]}-${suffix}`;
    frames[name] = { frame: { x: frameX, y: frameY, w: 256, h: 256 }, rotated: false, trimmed: false, spriteSourceSize: { x: 0, y: 0, w: 256, h: 256 }, sourceSize: { w: 256, h: 256 } };
  }
  const encoded = canvas.toDataURL('image/webp', .94);
  return { image: encoded.split(',')[1], metadata: { frames, meta: { image: options.filename, size: { w: canvas.width, h: canvas.height } } } };
}

const jobs = [
  { name: 'banner-cloth-v2', source: 'banner-cloth-v2-source.png', columns: 7, cloth: true, layers: ['pole'] },
  { name: 'banner-vfx-v2', source: 'banner-vfx-v2-source.png', columns: 5, cloth: false, layers: ['edge', 'wave', 'mote', 'bolt', 'hit'] }
];
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage();
  for (const job of jobs) {
    const sourceUrl = new URL(job.source, sourceDirectory); const bytes = await readFile(sourceUrl);
    const encoded = bytes.toString('base64');
    const filename = `${job.name}.webp`;
    const options = { ...job, filename, kinds, source: `data:image/png;base64,${encoded}` };
    const result = await page.evaluate(exportSprites, options);
    const image = Buffer.from(result.image, 'base64');
    const imageUrl = new URL(filename, runtimeDirectory); const metadataUrl = new URL(`${job.name}.json`, runtimeDirectory);
    const metadata = JSON.stringify(result.metadata);
    await writeFile(imageUrl, image); await writeFile(metadataUrl, metadata);
    console.log(`${filename} ${image.length} bytes`);
  }
} finally { await browser.close(); }
