import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const output = new URL('previews/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [];
const report = { samples: [], errors };
try {
  const page = await browser.newPage({ viewport: { width: 1148, height: 1080 }, deviceScaleFactor: 1.5 });
  page.on('pageerror', error => { errors.push(error.message); });
  await page.goto('http://127.0.0.1:5173/online.html?effects=loot', { waitUntil: 'networkidle' });
  const combo = page.getByRole('button', { name: '获得提示组合', exact: true });
  await combo.waitFor();
  await page.waitForFunction(() => !document.querySelector('button')?.disabled);
  const area = page.locator('div').filter({ has: page.locator(':scope > [data-pickup-notices]') }).last();
  const reset = page.getByRole('button', { name: '重置五色掉落', exact: true });
  const trigger = page.getByRole('button', { name: '触发获得提示', exact: true });
  const kind = page.getByLabel('获得类型', { exact: true });
  const level = page.getByLabel('物品等级', { exact: true });
  async function inspect(label) {
    await page.waitForTimeout(240);
    const sample = await page.locator('[data-pickup-notices]').evaluate(element => {
      const parent = element.parentElement.getBoundingClientRect();
      const rect = element.getBoundingClientRect();
      const rows = [...element.querySelectorAll('[data-pickup-notice]')].map(row => {
        const detail = row.querySelector('[data-pickup-detail]');
        const rect = row.getBoundingClientRect();
        const style = getComputedStyle(detail);
        return { text: row.textContent, color: style.color, top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right };
      });
      return { rows, centerOffset: rect.left + rect.width / 2 - parent.left - parent.width / 2, bottomRatio: (parent.bottom - rect.bottom) / parent.height, overflow: document.documentElement.scrollWidth > innerWidth };
    });
    report.samples.push({ label, ...sample });
    return sample;
  }
  await combo.click(); await page.waitForTimeout(480);
  await inspect('桌面组合');
  const desktopUrl = new URL('pickup-runtime-desktop.png', output); const desktopPath = fileURLToPath(desktopUrl);
  await area.screenshot({ path: desktopPath });
  for (const value of ['3', '8', '12', '15', '20']) {
    await reset.click(); await kind.selectOption('skill'); await level.selectOption(value); await trigger.click();
    await inspect(`技能 Lv.${value}`);
  }
  for (const value of ['haste', 'focus', 'shield', 'life', 'energy', 'mana', 'fullLife', 'fullEnergy']) {
    await reset.click(); await kind.selectOption(value); await trigger.click();
    await inspect(value);
  }
  await reset.click(); await kind.selectOption('haste');
  await trigger.click(); await trigger.click(); await trigger.click();
  await inspect('相同收益合并');
  await reset.click(); await trigger.click(); await page.waitForTimeout(1900); await trigger.click();
  await inspect('淡出时再次获得');
  await reset.click();
  for (const value of ['haste', 'focus', 'shield', 'life']) { await kind.selectOption(value); await trigger.click(); }
  await inspect('四种连续拾取');
  await page.waitForFunction(() => [...document.querySelectorAll('[data-pickup-notice]')].some(row => row.textContent.includes('生命精华')));
  await inspect('排队显示');
  await page.waitForFunction(() => document.querySelectorAll('[data-pickup-notice]').length === 0);
  await inspect('自动消失');
  await page.setViewportSize({ width: 390, height: 844 });
  await reset.click();
  await combo.click(); await page.waitForTimeout(480); await inspect('手机组合');
  const mobileUrl = new URL('pickup-runtime-mobile.png', output); const mobilePath = fileURLToPath(mobileUrl);
  await page.screenshot({ path: mobilePath, fullPage: true });
  await page.setViewportSize({ width: 320, height: 740 });
  await reset.click();
  await combo.click(); await page.waitForTimeout(350); await inspect('窄屏组合');
  const narrowUrl = new URL('pickup-runtime-narrow.png', output); const narrowPath = fileURLToPath(narrowUrl);
  await page.screenshot({ path: narrowPath, fullPage: true });
  const reportUrl = new URL('pickup-runtime-report.json', output); const data = JSON.stringify(report, null, 2);
  await writeFile(reportUrl, data);
  const summary = report.samples.map(sample => ({ label: sample.label, texts: sample.rows.map(row => row.text), centered: Math.abs(sample.centerOffset) < 1, overflow: sample.overflow }));
  console.log(JSON.stringify({ samples: summary, errors }));
  console.log(desktopPath); console.log(mobilePath); console.log(narrowPath);
} finally { await browser.close(); }
