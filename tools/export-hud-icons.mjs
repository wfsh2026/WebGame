import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const sourceUrl = new URL('../content/packs/forest-survival/assets/hud-buffs-source.png', import.meta.url);
const runtimeUrl = new URL('../content/packs/forest-survival/assets/runtime/', import.meta.url);
const previewUrl = new URL('../content/packs/forest-survival/assets/hud-buffs-preview.png', import.meta.url);
const names = ['冲刺', '疾行', '聚灵', '护盾', '破军战旗', '催锋战旗', '疾羽战旗', '归元战旗', '镇岳战旗', '近战共鸣', '远程共鸣', '周天回灵', '归流强化', '涌泉强化', '藏海强化', '周天强化', '迅捷连击', '节能蓄能', '过载蓄能', '雷杖蓄能'];
const source = await readFile(sourceUrl);
const encoded = source.toString('base64');
const options = { source: `data:image/png;base64,${encoded}`, names };
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage();
  const result = await page.evaluate(async data => {
    const image = new Image(); image.src = data.source; await image.decode();
    function surface(width, height) {
      const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('无法创建图标导出画布');
      context.imageSmoothingQuality = 'high';
      return { canvas, context };
    }
    function drawCell(context, index, target) {
      const sourceWidth = image.width / 4; const sourceHeight = image.height / 5;
      const x = index % 4 * sourceWidth; const y = Math.floor(index / 4) * sourceHeight;
      context.drawImage(image, x + 1, y + 1, sourceWidth - 2, sourceHeight - 2, target.x, target.y, target.size, target.size);
    }
    const atlas = surface(256, 320);
    for (let index = 0; index < 20; index += 1) {
      const target = { x: index % 4 * 64 + 3, y: Math.floor(index / 4) * 64 + 3, size: 58 };
      drawCell(atlas.context, index, target);
    }
    const dash = surface(128, 128);
    drawCell(dash.context, 0, { x: 5, y: 5, size: 118 });
    const preview = surface(800, 1092);
    preview.context.fillStyle = '#10251f'; preview.context.fillRect(0, 0, 800, 1092);
    preview.context.textAlign = 'center'; preview.context.fillStyle = '#f1dfb1';
    preview.context.font = 'bold 26px "Microsoft YaHei", sans-serif';
    preview.context.fillText('冲刺与战斗增益图标', 400, 43);
    for (let index = 0; index < 20; index += 1) {
      const column = index % 4; const row = Math.floor(index / 4);
      const target = { x: column * 200 + 24, y: row * 202 + 67, size: 152 };
      drawCell(preview.context, index, target);
      preview.context.font = '18px "Microsoft YaHei", sans-serif';
      preview.context.fillText(data.names[index], column * 200 + 100, row * 202 + 244);
    }
    return { atlas: atlas.canvas.toDataURL('image/webp', .96), dash: dash.canvas.toDataURL('image/webp', .96), preview: preview.canvas.toDataURL('image/png') };
  }, options);
  for (const name of ['atlas', 'dash', 'preview']) {
    const target = name === 'preview' ? previewUrl : new URL(name === 'atlas' ? 'hud-buffs.webp' : 'dash-icon.webp', runtimeUrl);
    const base64 = result[name].split(',')[1]; const bytes = Buffer.from(base64, 'base64');
    await writeFile(target, bytes);
    console.log(`${target.pathname}: ${bytes.length} bytes`);
  }
} finally { await browser.close(); }
