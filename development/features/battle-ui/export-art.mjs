import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const source = new URL('./content/hud-icons-source.png', import.meta.url);
const bytes = await readFile(source);
const encoded = bytes.toString('base64');
const input = `data:image/png;base64,${encoded}`;
const titleSource = new URL('./content/wave-title-source.png', import.meta.url);
const titleBytes = await readFile(titleSource); const titleEncoded = titleBytes.toString('base64');
const titleInput = `data:image/png;base64,${titleEncoded}`;
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage();
  const exportAtlas = async url => {
    const image = new Image(); image.src = url; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 256;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('无法导出战斗图标');
    const width = image.width / 4; const height = image.height / 2;
    for (let index = 0; index < 8; index += 1) {
      const column = index % 4; const row = Math.floor(index / 4);
      context.drawImage(image, column * width, row * height, width, height, column * 128, row * 128, 128, 128);
    }
    return canvas.toDataURL('image/webp', .96);
  };
  const image = await page.evaluate(exportAtlas, input);
  const data = image.split(',')[1]; const output = Buffer.from(data, 'base64');
  const destination = new URL('../../../content/common/hud/battle-controls.webp', import.meta.url);
  await writeFile(destination, output);
  console.log(`战斗图标 512×256，${output.length} 字节`);
  const exportTitle = async url => {
    const image = new Image(); image.src = url; await image.decode();
    const source = document.createElement('canvas'); source.width = image.width; source.height = image.height;
    const sourceContext = source.getContext('2d');
    if (!sourceContext) throw new Error('无法读取波次标题');
    sourceContext.drawImage(image, 0, 0);
    const pixels = sourceContext.getImageData(0, 0, source.width, source.height);
    let left = source.width; let right = 0; let top = source.height; let bottom = 0;
    for (let y = 0; y < source.height; y += 1) for (let x = 0; x < source.width; x += 1) {
      if (pixels.data[(y * source.width + x) * 4 + 3] < 48) continue;
      left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
    const width = right - left + 1; const height = bottom - top + 1;
    const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = Math.round(height / width * 640);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('无法导出波次标题');
    context.drawImage(image, left, top, width, height, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/webp', .96);
  };
  const titleImage = await page.evaluate(exportTitle, titleInput);
  const titleData = titleImage.split(',')[1]; const titleOutput = Buffer.from(titleData, 'base64');
  const titleDestination = new URL('../../../content/common/hud/wave-title.webp', import.meta.url);
  await writeFile(titleDestination, titleOutput);
  console.log(`波次标题 ${titleOutput.length} 字节`);
} finally { await browser.close(); }
