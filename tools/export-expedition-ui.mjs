import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const assets = [{ name: 'portal', width: 800, height: 500, trim: false }, { name: 'row', width: 1000, height: 150, trim: true }];
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage();
  for (const asset of assets) {
    const sourceUrl = new URL(`../development/features/expedition-ui/content/${asset.name}-source.png`, import.meta.url);
    const outputUrl = new URL(`../content/common/lobby/expedition-ui-${asset.name}.webp`, import.meta.url);
    const source = await readFile(sourceUrl);
    const encoded = source.toString('base64');
    const input = { ...asset, src: `data:image/png;base64,${encoded}` };
    const result = await page.evaluate(async data => {
      const image = new Image(); image.src = data.src; await image.decode();
      let left = 0; let top = 0; let width = image.width; let height = image.height;
      if (data.trim) {
        const mask = document.createElement('canvas'); mask.width = width; mask.height = height;
        const maskContext = mask.getContext('2d');
        if (!maskContext) throw new Error('无法读取秘境边框');
        maskContext.drawImage(image, 0, 0);
        const pixels = maskContext.getImageData(0, 0, width, height);
        left = width; top = height; let right = 0; let bottom = 0;
        for (let y = 0; y < height; y += 1) {
          for (let x = 0; x < width; x += 1) {
            if (pixels.data[(y * width + x) * 4 + 3] < 20) continue;
            left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
          }
        }
        width = right - left + 1; height = bottom - top + 1;
      }
      const canvas = document.createElement('canvas'); canvas.width = data.width; canvas.height = data.height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('无法导出秘境插画');
      context.imageSmoothingQuality = 'high';
      context.drawImage(image, left, top, width, height, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/webp', .94);
    }, input);
    const encodedImage = result.split(',')[1];
    const bytes = Buffer.from(encodedImage, 'base64');
    await writeFile(outputUrl, bytes);
  }
} finally { await browser.close(); }
