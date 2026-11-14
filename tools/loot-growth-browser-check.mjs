import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';

const output = new URL('../output/loot-growth/', import.meta.url); await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1050 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:5173/online.html?effects=loot');
  const status = page.locator('[data-ground-experience]'); await page.waitForFunction(() => document.querySelector('[data-level]')?.getAttribute('data-level') === '9');
  await page.screenshot({ path: new URL('01-five-colors.png', output).pathname.slice(1), fullPage: true });
  await page.getByRole('button', { name: '击杀怪物', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[data-experience]')?.getAttribute('data-experience') === '4');
  assert.equal(await status.getAttribute('data-ground-experience'), '4');
  await page.getByRole('button', { name: '自动移动拾取者', exact: true }).click();
  await page.getByRole('button', { name: '吸取全部', exact: true }).click();
  await page.waitForTimeout(180);
  await page.screenshot({ path: new URL('02-moving-pickup.png', output).pathname.slice(1), fullPage: true });
  await page.waitForFunction(() => document.querySelector('[data-landed]')?.getAttribute('data-landed') === '5');
  await page.waitForFunction(() => document.querySelector('[data-experience]')?.getAttribute('data-experience') === '8');
  assert.equal(await status.getAttribute('data-ground-experience'), '0');
  const distance = Number(await status.getAttribute('data-distance')); assert.ok(distance > 0);
  await page.getByRole('button', { name: '停止自动移动', exact: true }).click();
  await page.getByRole('button', { name: '升一级', exact: true }).click();
  await page.waitForTimeout(210);
  await page.screenshot({ path: new URL('03-level-up.png', output).pathname.slice(1), fullPage: true });
  await page.waitForFunction(() => document.querySelector('[data-level]')?.getAttribute('data-level') === '10');
  const select = page.getByLabel('角色等级', { exact: true });
  for (const level of [1, 20, 40, 60, 80, 100]) { const value = String(level); await select.selectOption(value); await page.waitForTimeout(130); await page.screenshot({ path: new URL(`frame-${level}.png`, output).pathname.slice(1), fullPage: true }); }
  await page.getByRole('button', { name: '重置五色掉落', exact: true }).click();
  await page.getByRole('button', { name: '密集拾取（100件）', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[data-landed]')?.getAttribute('data-landed') === '100');
  await page.waitForFunction(() => document.querySelector('[data-flights]')?.getAttribute('data-flights') === '0');
  const typeSelect = page.getByLabel('物品类型', { exact: true });
  for (const kind of ['ranged', 'heart', 'support', 'life', 'energy']) {
    await typeSelect.selectOption(kind); await page.getByRole('button', { name: '吸取全部', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('[data-landed]')?.getAttribute('data-landed') === '5');
    await page.waitForFunction(() => document.querySelector('[data-flights]')?.getAttribute('data-flights') === '0');
  }
  await typeSelect.selectOption('melee');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '重置五色掉落', exact: true }).click(); await page.waitForTimeout(600);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth); assert.equal(overflow, false);
  await page.screenshot({ path: new URL('04-mobile.png', output).pathname.slice(1), fullPage: true });
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, killImmediate: 4, groundExperience: 4, afterAbsorption: 8, itemsAbsorbed: 5, burstItems: 100, movingDistance: distance, consoleErrors: errors, screenshots: output.pathname }));
} finally { await browser.close(); }
