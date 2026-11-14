import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const output = new URL('./previews/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage();
const errors = []; const missingAssets = []; const results = [];
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => { if (response.status() >= 400) missingAssets.push(response.url()); });
const url = 'http://127.0.0.1:5174/shop-review.html';

async function screenshot(name) {
  const target = new URL(`${name}.png`, output); const path = fileURLToPath(target);
  await page.mouse.move(0, 0);
  await page.screenshot({ path, fullPage: true });
}

async function measure(label) {
  const metrics = await page.evaluate(() => {
    const panel = document.querySelector('dialog'); const title = document.querySelector('h1'); const cards = [...document.querySelectorAll('article')];
    const bounds = panel.getBoundingClientRect(); const titleBounds = title.getBoundingClientRect();
    const text = [...document.querySelectorAll('article p, article button')];
    const clippedText = text.filter(item => item.scrollWidth > item.clientWidth + 1).map(item => item.textContent);
    const outside = bounds.x < 0 || bounds.right > innerWidth || bounds.bottom > innerHeight || titleBounds.top < 0;
    return { panel: bounds.toJSON(), cards: cards.map(card => card.getBoundingClientRect().toJSON()), clippedText, outside, horizontalScroll: document.documentElement.scrollWidth > innerWidth, verticalScroll: document.documentElement.scrollHeight > innerHeight };
  });
  results.push({ label, ...metrics });
  assert.equal(metrics.outside, false, `${label}界面超出视口`);
  assert.equal(metrics.horizontalScroll, false, `${label}存在横向滚动`);
  assert.equal(metrics.verticalScroll, false, `${label}存在纵向滚动`);
  assert.deepEqual(metrics.clippedText, [], `${label}商品文字被截断`);
}

async function category(name, expected) {
  await page.getByRole('tab', { name, exact: true }).click();
  const found = new Set();
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const cards = page.locator('article button[aria-label^="查看"]');
    const labels = await cards.evaluateAll(items => items.map(item => item.getAttribute('aria-label')));
    labels.forEach(label => found.add(label));
    const next = page.getByRole('button', { name: '下一页商品' });
    if (!await next.count() || await next.isDisabled()) break;
    await next.click();
  }
  assert.equal(found.size, expected, `${name}分页遗漏商品`);
}

try {
  const viewports = [
    { name: 'desktop', width: 1536, height: 1024 },
    { name: 'reference-size', width: 1024, height: 683 },
    { name: 'tablet', width: 820, height: 760 },
    { name: 'phone', width: 390, height: 844 },
    { name: 'small-phone', width: 320, height: 568 },
    { name: 'landscape', width: 920, height: 420 },
    { name: 'small-landscape', width: 667, height: 375 }
  ];
  for (const viewport of viewports) {
    const size = { width: viewport.width, height: viewport.height };
    await page.setViewportSize(size);
    await page.goto(url);
    await page.getByRole('tab', { name: '技能', exact: true }).click();
    await page.evaluate(async () => { await document.fonts.ready; });
    await measure(`${viewport.name}-skills`);
    await screenshot(`shop-${viewport.name}`);
    await category('心法', 4); await measure(`${viewport.name}-hearts`);
    if (viewport.name === 'reference-size') await screenshot('shop-hearts');
    await category('辅助宝石', 6); await measure(`${viewport.name}-supports`);
    if (viewport.name === 'reference-size') await screenshot('shop-supports');
    await category('技能', 6);
  }
  await page.setViewportSize({ width: 1024, height: 683 });
  for (let batch = 1; batch <= 3; batch += 1) {
    await page.goto(`${url}?batch=${batch}`);
    for (const name of ['心法', '技能', '辅助宝石']) {
      await page.getByRole('tab', { name, exact: true }).click();
      await measure(`additional-batch-${batch}-${name}`);
    }
  }
  await page.setViewportSize({ width: 1024, height: 683 });
  await page.goto(url);
  await page.getByRole('tab', { name: '技能', exact: true }).click();
  const details = page.getByRole('button', { name: '查看火球术详情' });
  await details.click();
  assert.equal(await page.locator('dialog[open]').count(), 2, '详情未打开');
  await screenshot('shop-details');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('dialog[open]').count(), 1, '关闭详情时误关商店');
  const fireCard = page.locator('article').filter({ has: details });
  await fireCard.getByRole('button', { name: '购买', exact: true }).click();
  assert.equal(await page.getByLabel('金币余额', { exact: true }).textContent(), '170', '购买后余额未更新');
  assert.equal(await fireCard.getByRole('button', { name: '已购买', exact: true }).isDisabled(), true, '购买后未售罄');
  await page.getByRole('button', { name: '随机技能货架，10 金币', exact: true }).click();
  assert.equal(await page.getByLabel('金币余额', { exact: true }).textContent(), '160', '随机后余额未更新');
  assert.equal(await page.getByRole('button', { name: '随机技能货架，15 金币', exact: true }).count(), 1, '随机费用未更新');
  await page.goto(`${url}?coins=2`);
  await page.getByRole('tab', { name: '技能', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: '金币不足', exact: true }).count(), 6, '金币不足状态缺失');
  await screenshot('shop-insufficient-coins');
  assert.deepEqual(errors, [], '页面发生运行错误');
  assert.deepEqual(missingAssets, [], '存在缺失的网页或美术资源');
  const report = { viewports: viewports.length, layouts: results.length, results, interactions: ['分类与全量分页', '详情打开与Esc关闭', '购买后余额和售罄', '随机后余额和递增费用', '金币不足禁用'], errors, missingAssets, backend: '隔离夹具，仅验证真实商店前端；不连接账号、数据库或线上资产' };
  const serialized = JSON.stringify(report, null, 2); const reportUrl = new URL('verification.json', output);
  await writeFile(reportUrl, serialized);
  console.log(`通过：${report.viewports}种窗口、${report.layouts}组布局、${report.interactions.length}项前端交互；无运行错误或缺失资源。`);
} finally {
  await browser.close();
  if (results.length) { const value = JSON.stringify({ results, errors, missingAssets }, null, 2); const path = new URL('layout-results.json', output); await writeFile(path, value); }
}
