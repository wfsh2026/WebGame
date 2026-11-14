import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const source = new URL('../development/features/skill-ui/content/skill-ui-source.png', import.meta.url);
const target = new URL('../content/common/lobby/', import.meta.url);
const bytes = await readFile(source);
const encoded = bytes.toString('base64');
const url = `data:image/png;base64,${encoded}`;
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage();
  const frames = await page.evaluate(async url => {
    const image = new Image(); image.src = url; await image.decode();
    const width = image.width / 2; const height = image.height / 2;
    const entries = [{ name: 'dial', column: 0, row: 0, size: 768 }, { name: 'frame', column: 1, row: 0, size: 192 }, { name: 'gem', column: 0, row: 1, size: 128 }, { name: 'locked', column: 1, row: 1, size: 192 }];
    return entries.map(entry => {
      const canvas = document.createElement('canvas'); canvas.width = entry.size; canvas.height = entry.size;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('无法创建技能界面素材导出画布');
      context.imageSmoothingQuality = 'high';
      context.drawImage(image, entry.column * width, entry.row * height, width, height, 0, 0, entry.size, entry.size);
      const output = canvas.toDataURL('image/webp', .94);
      return { name: entry.name, output };
    });
  }, url);
  for (const frame of frames) {
    const path = new URL(`skill-ui-${frame.name}.webp`, target);
    const encoded = frame.output.split(',')[1];
    const output = Buffer.from(encoded, 'base64');
    await writeFile(path, output);
  }
  process.stdout.write('技能搭配素材已导出\n');
} finally { await browser.close(); }
