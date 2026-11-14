import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const sourceUrl = new URL('../development/features/shop-ui/content/shop-ui-source.png', import.meta.url);
const previewUrl = new URL('../development/features/shop-ui/content/shop-ui-approved.png', import.meta.url);
const titleUrl = new URL('../development/features/shop-ui/content/shop-ui-title-source.png', import.meta.url);
const iconsUrl = new URL('../development/features/shop-ui/content/shop-icons-source.png', import.meta.url);
const runtimeUrl = new URL('../content/common/lobby/', import.meta.url);
const source = await readFile(sourceUrl); const preview = await readFile(previewUrl);
const titleSource = await readFile(titleUrl);
const iconsSource = await readFile(iconsUrl);
const encodedSource = source.toString('base64'); const encodedPreview = preview.toString('base64');
const encodedTitle = titleSource.toString('base64');
const encodedIcons = iconsSource.toString('base64');
const input = { source: `data:image/png;base64,${encodedSource}`, preview: `data:image/png;base64,${encodedPreview}`, title: `data:image/png;base64,${encodedTitle}`, icons: `data:image/png;base64,${encodedIcons}` };
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage();
  const images = await page.evaluate(async data => {
    const atlas = new Image(); atlas.src = data.source; await atlas.decode();
    const preview = new Image(); preview.src = data.preview; await preview.decode();
    const title = new Image(); title.src = data.title; await title.decode();
    const shopIcons = new Image(); shopIcons.src = data.icons; await shopIcons.decode();
    const titleCanvas = document.createElement('canvas'); titleCanvas.width = title.width; titleCanvas.height = title.height;
    const titleContext = titleCanvas.getContext('2d');
    if (!titleContext) throw new Error('无法读取商店标题素材');
    titleContext.drawImage(title, 0, 0);
    const pixels = titleContext.getImageData(0, 0, title.width, title.height);
    let left = title.width; let top = title.height; let right = 0; let bottom = 0;
    for (let y = 0; y < title.height; y += 1) {
      for (let x = 0; x < title.width; x += 1) {
        const alpha = pixels.data[(y * title.width + x) * 4 + 3];
        if (alpha < 12) continue;
        left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
      }
    }
    const titleWidth = right - left + 1; const titleHeight = bottom - top + 1;
    const cellWidth = atlas.width / 2; const cellHeight = atlas.height / 2;
    const frames = [
      { name: 'title', image: title, x: left, y: top, width: titleWidth, height: titleHeight, scale: 640 / titleWidth },
      { name: 'coin', image: preview, x: 1167, y: 155, width: 46, height: 46, scale: 1 }
    ];
    const output = frames.map(frame => {
      const canvas = document.createElement('canvas'); canvas.width = frame.width * frame.scale; canvas.height = frame.height * frame.scale;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('无法创建商店素材导出画布');
      context.imageSmoothingQuality = 'high';
      if (frame.name === 'coin') { context.beginPath(); context.arc(23, 23, 21, 0, Math.PI * 2); context.clip(); }
      context.drawImage(frame.image, frame.x, frame.y, frame.width, frame.height, 0, 0, canvas.width, canvas.height);
      const image = canvas.toDataURL('image/webp', .94);
      return { name: frame.name, image, width: canvas.width, height: canvas.height };
    });
    function surface(width, height) {
      const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('无法导出商店参考素材');
      context.imageSmoothingQuality = 'high';
      return { canvas, context };
    }
    function crop(target, image, rect) { target.context.drawImage(image, rect.x, rect.y, rect.width, rect.height, rect.dx ?? 0, rect.dy ?? 0, rect.dw ?? rect.width, rect.dh ?? rect.height); }
    function feather(target, image, rect) {
      const tile = surface(rect.width, rect.height);
      crop(tile, image, { x: rect.x, y: rect.y, width: rect.width, height: rect.height });
      const pixels = tile.context.getImageData(0, 0, rect.width, rect.height);
      for (let y = 0; y < rect.height; y += 1) {
        for (let x = 0; x < rect.width; x += 1) {
          const horizontal = rect.fadeLeft ? x : rect.fadeRight ? rect.width - x - 1 : 24;
          const vertical = rect.fadeTop ? y : rect.fadeBottom ? rect.height - y - 1 : 24;
          const distance = Math.min(horizontal, vertical); const alpha = Math.min(1, distance / 24);
          pixels.data[(y * rect.width + x) * 4 + 3] *= alpha;
        }
      }
      tile.context.putImageData(pixels, 0, 0);
      target.context.drawImage(tile.canvas, rect.dx ?? 0, rect.dy ?? 0);
    }
    function save(name, target) { const image = target.canvas.toDataURL('image/webp', .96); output.push({ name, image, width: target.canvas.width, height: target.canvas.height }); }
    const panel = surface(1432, 776);
    crop(panel, preview, { x: 840, y: 215, width: 220, height: 98, dw: 1432, dh: 776 });
    feather(panel, preview, { x: 52, y: 132, width: 36, height: 776, fadeRight: true });
    feather(panel, preview, { x: 1448, y: 132, width: 36, height: 776, dx: 1396, fadeLeft: true });
    crop(panel, preview, { x: 52, y: 132, width: 1432, height: 9 });
    crop(panel, preview, { x: 350, y: 132, width: 100, height: 9, dx: 470, dw: 500 });
    feather(panel, preview, { x: 52, y: 870, width: 1432, height: 38, dy: 738, fadeTop: true });
    feather(panel, preview, { x: 52, y: 132, width: 100, height: 100, fadeRight: true, fadeBottom: true });
    feather(panel, preview, { x: 1436, y: 132, width: 48, height: 100, dx: 1384, fadeLeft: true, fadeBottom: true });
    feather(panel, preview, { x: 52, y: 860, width: 112, height: 48, dy: 728, fadeRight: true, fadeTop: true });
    feather(panel, preview, { x: 1372, y: 860, width: 112, height: 48, dx: 1320, dy: 728, fadeLeft: true, fadeTop: true });
    save('panel', panel);
    const card = surface(448, 256);
    crop(card, atlas, { x: 840, y: 70, width: 600, height: 350, dw: 448, dh: 256 });
    crop(card, preview, { x: 88, y: 324, width: 448, height: 12 });
    crop(card, preview, { x: 88, y: 568, width: 448, height: 12, dy: 244 });
    crop(card, preview, { x: 88, y: 324, width: 14, height: 256 });
    crop(card, preview, { x: 522, y: 324, width: 14, height: 256, dx: 434 });
    save('card', card);
    const control = surface(166, 58);
    crop(control, preview, { x: 345, y: 507, width: 166, height: 58 });
    crop(control, atlas, { x: 1000, y: 650, width: 300, height: 150, dx: 17, dy: 9, dw: 132, dh: 40 });
    save('control', control);
    const icons = surface(444, 296);
    for (let index = 0; index < 6; index += 1) {
      const column = index % 3; const row = Math.floor(index / 3);
      const x = [100, 556, 1010][column]; const y = row === 0 ? 342 : 614;
      icons.context.save(); icons.context.beginPath(); icons.context.arc(column * 148 + 74, row * 148 + 74, 73, 0, Math.PI * 2); icons.context.clip();
      crop(icons, preview, { x, y, width: 148, height: 148, dx: column * 148, dy: row * 148 });
      icons.context.restore();
    }
    save('skills', icons);
    const close = surface(64, 60);
    crop(close, preview, { x: 1370, y: 151, width: 64, height: 60 });
    save('close', close);
    const goods = surface(1024, 640);
    crop(goods, shopIcons, { x: 0, y: 0, width: shopIcons.width, height: shopIcons.height, dw: 1024, dh: 640 });
    save('icons', goods);
    const tabIcons = surface(144, 48);
    for (let index = 0; index < 3; index += 1) {
      const tile = surface(48, 48);
      crop(tile, preview, { x: [150, 387, 596][index], y: 246, width: 48, height: 44, dy: 2 });
      const pixels = tile.context.getImageData(0, 0, 48, 48);
      for (let y = 0; y < 48; y += 1) {
        for (let x = 0; x < 48; x += 1) {
          const offset = (y * 48 + x) * 4;
          const red = pixels.data[offset]; const green = pixels.data[offset + 1]; const blue = pixels.data[offset + 2];
          const glyph = index === 1 ? red > 170 && green > 150 && blue > 80 : red < 150 && green < 130 && blue < 100;
          const inside = x > 3 && x < 45 && y > 3 && y < 42;
          pixels.data[offset] = 86; pixels.data[offset + 1] = 62; pixels.data[offset + 2] = 36; pixels.data[offset + 3] = glyph && inside ? 255 : 0;
        }
      }
      tile.context.putImageData(pixels, 0, 0);
      tabIcons.context.drawImage(tile.canvas, index * 48, 0);
    }
    save('tabs', tabIcons);
    return output;
  }, input);
  for (const image of images) {
    const target = new URL(`shop-ui-${image.name}.webp`, runtimeUrl);
    const encoded = image.image.split(',')[1]; const bytes = Buffer.from(encoded, 'base64');
    await writeFile(target, bytes);
    console.log(`${image.name}: ${image.width}x${image.height}, ${bytes.length} bytes`);
  }
} finally { await browser.close(); }
