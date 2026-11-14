import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const source = new URL('./content/frames-source.png', import.meta.url);
const bytes = await readFile(source); const encoded = bytes.toString('base64');
const input = `data:image/png;base64,${encoded}`;
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage();
  const exportFrames = async url => {
    const image = new Image(); image.src = url; await image.decode();
    const frames = [
      { name: 'player-frame', x: .006, y: .072, width: .499, height: .165, size: 640 },
      { name: 'team-frame', x: .64, y: .025, width: .23, height: .275, size: 288 },
      { name: 'utility-frame', x: .014, y: .38, width: .48, height: .105, size: 512 },
      { name: 'skill-frame', x: .505, y: .38, width: .493, height: .12, size: 1024 },
      { name: 'income-frame', x: .10, y: .57, width: .30, height: .15, size: 320 },
      { name: 'actions-frame', x: .52, y: .58, width: .46, height: .16, size: 480 },
      { name: 'buff-frame', x: .02, y: .84, width: .47, height: .095, size: 640 },
      { name: 'team-heading', x: .57, y: .835, width: .36, height: .095, size: 384 }
    ];
    const source = document.createElement('canvas'); source.width = image.width; source.height = image.height;
    const sourceContext = source.getContext('2d');
    if (!sourceContext) throw new Error('无法读取背景框原稿');
    sourceContext.drawImage(image, 0, 0);
    const sourcePixels = sourceContext.getImageData(0, 0, source.width, source.height);
    const points = [[0, 0], [.25, .15], [.25, .33], [.75, .44]].map(point => {
      const x = Math.floor(point[0] * source.width); const y = Math.floor(point[1] * source.height);
      const index = (y * source.width + x) * 4; return [...sourcePixels.data.slice(index, index + 4)];
    });
    const output = frames.map(frame => {
      const crop = document.createElement('canvas'); crop.width = Math.round(frame.width * image.width); crop.height = Math.round(frame.height * image.height);
      const context = crop.getContext('2d'); if (!context) throw new Error('无法裁切背景框');
      context.drawImage(image, frame.x * image.width, frame.y * image.height, crop.width, crop.height, 0, 0, crop.width, crop.height);
      const pixels = context.getImageData(0, 0, crop.width, crop.height);
      let left = crop.width; let top = crop.height; let right = 0; let bottom = 0;
      for (let y = 0; y < crop.height; y += 1) for (let x = 0; x < crop.width; x += 1) {
        const offset = (y * crop.width + x) * 4; const alpha = pixels.data[offset + 3];
        if (alpha < 72) { pixels.data[offset + 3] = 0; continue; }
        const red = pixels.data[offset]; const green = pixels.data[offset + 1]; const blue = pixels.data[offset + 2];
        const maximum = Math.max(red, green, blue); const minimum = Math.min(red, green, blue);
        if (frame.name !== 'team-heading' && maximum < 105 && maximum - minimum < 38) {
          pixels.data[offset] = 0; pixels.data[offset + 1] = 0; pixels.data[offset + 2] = 0;
          pixels.data[offset + 3] = Math.min(alpha, 120);
        }
        if (pixels.data[offset + 3] < 96) continue;
        left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
      }
      context.putImageData(pixels, 0, 0);
      left = Math.max(0, left - 2); top = Math.max(0, top - 2); right = Math.min(crop.width - 1, right + 2); bottom = Math.min(crop.height - 1, bottom + 2);
      const width = right - left + 1; const height = bottom - top + 1;
      const canvas = document.createElement('canvas'); canvas.width = frame.size; canvas.height = Math.round(frame.size * height / width);
      const target = canvas.getContext('2d'); if (!target) throw new Error('无法导出背景框');
      target.imageSmoothingQuality = 'high'; target.drawImage(crop, left, top, width, height, 0, 0, canvas.width, canvas.height);
      return { name: frame.name, width: canvas.width, height: canvas.height, image: canvas.toDataURL('image/webp', .96) };
    });
    return { output, points, size: [image.width, image.height] };
  };
  const result = await page.evaluate(exportFrames, input);
  for (const frame of result.output) {
    const encoded = frame.image.split(',')[1]; const bytes = Buffer.from(encoded, 'base64');
    const target = new URL(`../../../content/common/hud/${frame.name}.webp`, import.meta.url); await writeFile(target, bytes);
    console.log(`${frame.name}: ${frame.width}×${frame.height}, ${bytes.length} bytes`);
  }
  console.log(JSON.stringify({ source: result.size, pixels: result.points }));
} finally { await browser.close(); }
