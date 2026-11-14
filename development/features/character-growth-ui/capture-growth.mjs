import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const output = new URL('./previews/', import.meta.url);
const launch = { channel: 'msedge', headless: true };
const browser = await chromium.launch(launch);
const page = await browser.newPage();
const errors = []; const missingAssets = []; const layouts = []; const interactions = [];
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => { if (response.status() >= 400) missingAssets.push(response.url()); });
const url = 'http://127.0.0.1:5174/character-growth-review.html';

async function screenshot(name) {
  const file = new URL(`character-growth-actual-${name}.png`, output);
  const path = fileURLToPath(file);
  await page.mouse.move(0, 0);
  const options = { path, fullPage: true };
  await page.screenshot(options);
}

async function measure(label) {
  const metrics = await page.evaluate(() => {
    const panel = document.querySelector('dialog');
    const title = document.querySelector('h1');
    const bounds = panel.getBoundingClientRect();
    const titleBounds = title.getBoundingClientRect();
    const text = Array.from(document.querySelectorAll('button, [class*="attributeName"] small, [class*="points"], [class*="purchase"] small'));
    const clipped = text.filter(item => item.scrollWidth > item.clientWidth + 1);
    const outside = bounds.x < 0 || bounds.right > innerWidth || bounds.bottom > innerHeight || titleBounds.top < 0;
    return { panel: bounds.toJSON(), outside, horizontalScroll: document.documentElement.scrollWidth > innerWidth, verticalScroll: document.documentElement.scrollHeight > innerHeight, clippedText: clipped.map(item => item.textContent) };
  });
  layouts.push({ label, ...metrics });
  assert.equal(metrics.outside, false, `${label}面板或标题超出窗口`);
  assert.equal(metrics.horizontalScroll, false, `${label}存在页面横向滚动`);
  assert.equal(metrics.verticalScroll, false, `${label}存在页面纵向滚动`);
  assert.deepEqual(metrics.clippedText, [], `${label}关键文字被截断`);
}

async function open(query = '') {
  await page.goto(`${url}${query}`);
  const heading = page.getByRole('heading', { name: '角色成长', exact: true });
  await heading.waitFor();
  await page.evaluate(async () => { await document.fonts.ready; });
}

try {
  const viewports = [{ name: 'desktop', width: 1024, height: 683 }, { name: 'large-desktop', width: 1536, height: 1024 }, { name: 'tablet', width: 820, height: 760 }, { name: 'phone', width: 390, height: 844 }, { name: 'small-phone', width: 320, height: 568 }, { name: 'landscape', width: 920, height: 420 }, { name: 'small-landscape', width: 667, height: 375 }];
  for (const viewport of viewports) {
    const size = { width: viewport.width, height: viewport.height };
    await page.setViewportSize(size);
    await open();
    const increase = page.getByRole('button', { name: '增加力量', exact: true });
    await increase.click();
    await measure(viewport.name);
    await screenshot(viewport.name);
    const milestone = page.getByLabel('成长里程碑', { exact: true });
    await milestone.locator('summary').click();
    await measure(`${viewport.name}-milestones`);
  }

  await page.setViewportSize({ width: 1024, height: 683 });
  await open();
  const allocation = page.locator('section').filter({ has: page.getByRole('heading', { name: '属性分配', exact: true }) }).last();
  const statRow = page.locator('dl > div').filter({ has: page.getByText('物理攻击', { exact: true }) });
  const increase = page.getByRole('button', { name: '增加力量', exact: true });
  await increase.click();
  assert.match(await statRow.textContent(), /40.*42/, '加点后属性预览没有更新');
  await page.getByRole('button', { name: '减少力量', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: '保存分配', exact: true }).isDisabled(), true, '撤销加点后保存状态不正确');
  await increase.click();
  await page.getByRole('button', { name: '保存分配', exact: true }).click();
  const workingSave = page.getByRole('button', { name: '正在保存…', exact: true });
  await workingSave.waitFor();
  assert.equal(await page.getByRole('button', { name: '关闭角色成长', exact: true }).isDisabled(), true, '保存时未锁定关闭按钮');
  await page.getByText('分配已保存', { exact: true }).waitFor();
  assert.equal(await statRow.locator('del').count(), 0, '保存后仍显示未保存预览');
  interactions.push('加减成长点、即时属性预览、撤销与保存状态');
  await page.getByRole('button', { name: '免费重置', exact: true }).click();
  assert.match(await allocation.textContent(), /已分配\s*0\s*\/\s*6/, '免费重置没有清空成长点草稿');
  await page.getByRole('button', { name: '保存分配', exact: true }).click();
  await page.getByText('分配已保存', { exact: true }).waitFor();
  interactions.push('免费重置并保存');

  await open();
  await page.getByRole('button', { name: '升级至 Lv.8，消耗 200 金币', exact: true }).click();
  await page.getByText('升级成功，成长点 +1', { exact: true }).waitFor();
  assert.equal(await page.getByLabel('金币余额', { exact: true }).textContent(), '560', '升级后金币没有更新');
  const capacity = page.locator('dl > div').filter({ has: page.getByText('可配置技能', { exact: true }) });
  assert.equal(await capacity.locator('dd').textContent(), '3', '升级后技能槽没有更新');
  interactions.push('升级后的等级、余额、成长点及技能槽');

  for (const state of [{ name: 'insufficient', query: '?coins=10' }, { name: 'level-one', query: '?level=1' }, { name: 'support-unlock', query: '?level=4' }, { name: 'last-unlock', query: '?level=19' }, { name: 'maxed', query: '?level=20' }, { name: 'long-name-talents', query: '?name=这是一位拥有很长名字的林间冒险旅人&talents=1' }]) {
    await open(state.query);
    await measure(state.name);
    await screenshot(state.name);
    if (state.name === 'insufficient') assert.equal(await page.getByRole('button', { name: '升级至 Lv.8，消耗 200 金币', exact: true }).isDisabled(), true, '金币不足仍可升级');
    if (state.name === 'maxed') assert.equal(await page.getByText('已满级', { exact: true }).count(), 1, '满级提示缺失');
  }
  interactions.push('金币不足、初始等级、辅助格解锁、满级及长名字天赋展示');

  await page.setViewportSize({ width: 390, height: 844 });
  await open();
  const stats = page.locator('details').filter({ has: page.getByRole('heading', { name: '战斗属性', exact: true }) });
  assert.equal(await stats.getAttribute('open'), null, '手机战斗属性未默认收起');
  await stats.locator('summary').click();
  await statRow.waitFor();
  await measure('phone-stats-open');
  await screenshot('phone-stats');
  interactions.push('手机属性展开与里程碑展开');

  await open('?fail=1');
  await increase.click();
  await page.getByRole('button', { name: '保存分配', exact: true }).click();
  await page.getByRole('alert').waitFor();
  assert.equal(await page.getByRole('button', { name: '保存分配', exact: true }).isDisabled(), false, '保存失败后未保留重试操作');
  await screenshot('save-error');
  interactions.push('保存失败提示及草稿保留');
  await page.getByRole('button', { name: '关闭角色成长', exact: true }).click();
  assert.equal(await page.locator('dialog[open]').count(), 0, '关闭按钮未关闭界面');
  await open();
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('dialog[open]').count(), 0, 'Esc 未关闭界面');
  interactions.push('关闭按钮与 Esc');

  assert.deepEqual(errors, [], '页面运行错误');
  assert.deepEqual(missingAssets, [], '缺失网页或美术资源');
  console.log(`通过：${viewports.length}种窗口、${layouts.length}组显示状态、${interactions.length}组前端交互；无运行错误或缺失资源。`);
} finally {
  const report = { layouts, interactions, errors, missingAssets, scope: '真实角色成长组件与正式营地样式；隔离示例数据，不连接账号、数据库或线上资产' };
  const serialized = JSON.stringify(report, null, 2);
  const reportPath = new URL('implementation-review.json', output);
  await writeFile(reportPath, serialized);
  await browser.close();
}
