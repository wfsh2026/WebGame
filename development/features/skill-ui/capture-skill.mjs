import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const output = new URL('./previews/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage();
await page.emulateMedia({ reducedMotion: 'reduce' });
const errors = []; const missing = []; const layouts = []; const interactions = [];
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => { const status = response.status(); if (status >= 400) missing.push(response.url()); });
const url = 'http://127.0.0.1:5174/shop-review.html?view=skills';
async function capture(name) {
  const pathUrl = new URL(`${name}.png`, output);
  const path = fileURLToPath(pathUrl);
  await page.mouse.move(0, 0);
  await page.screenshot({ path, fullPage: true });
  const metrics = await page.evaluate(() => {
    const dialog = document.querySelector('dialog');
    const title = document.querySelector('h1');
    const board = document.querySelector('[aria-label="心法与技能连接图"]');
    const bounds = dialog.getBoundingClientRect(); const heading = title.getBoundingClientRect();
    const diagram = board.getBoundingClientRect();
    const overflow = [...document.querySelectorAll('h2, dt, dd, button > b')].filter(element => element.scrollWidth > element.clientWidth + 1).map(element => element.textContent);
    return { width: innerWidth, height: innerHeight, panel: bounds.toJSON(), title: heading.toJSON(), diagram: diagram.toJSON(), overflow, horizontalScroll: document.documentElement.scrollWidth > innerWidth };
  });
  layouts.push({ name, ...metrics });
}
async function expectVisible(locator, description) {
  await locator.waitFor({ state: 'visible' });
  interactions.push(description);
}
try {
  for (const viewport of [{ name: 'desktop', width: 1536, height: 1024 }, { name: 'reference', width: 1024, height: 683 }, { name: 'landscape', width: 844, height: 390 }, { name: 'phone', width: 390, height: 844 }, { name: 'small-phone', width: 320, height: 740 }]) {
    await page.setViewportSize(viewport);
    await page.goto(url);
    await page.getByRole('heading', { name: '火球术', exact: true }).waitFor();
    await page.evaluate(() => document.fonts.ready);
    await capture(viewport.name);
  }
  await page.setViewportSize({ width: 1024, height: 683 });
  await page.goto(url);
  await page.getByRole('button', { name: /^寒棘术 Lv\.1/ }).click();
  const details = page.getByRole('region', { name: '选中装备详情' });
  await expectVisible(details.getByText('已预装 · 心法10级激活', { exact: true }), '保留预装技能并展示激活条件');
  await capture('preloaded');
  await page.getByRole('button', { name: '火球术 Lv.5', exact: true }).click();
  await page.getByRole('button', { name: '替换技能', exact: true }).click();
  await expectVisible(page.getByRole('button', { name: '下一页物品' }), '替换列表显示分页');
  await page.getByRole('button', { name: '下一页物品' }).click();
  await page.getByRole('button', { name: '近战', exact: true }).click();
  await capture('inventory');
  await page.getByRole('textbox', { name: '搜索可装备物品' }).fill('林卫长刀');
  await page.getByRole('button', { name: '装备林卫长刀 Lv.1', exact: true }).first().click();
  await expectVisible(page.getByRole('heading', { name: '确认装配变更' }), '替换有辅助的技能先显示连带拆卸确认');
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await expectVisible(page.getByRole('button', { name: '火球术 Lv.5', exact: true }), '取消替换保留原构筑');
  await page.getByRole('button', { name: '装备林卫长刀 Lv.1', exact: true }).first().click();
  await page.getByRole('button', { name: '确认变更', exact: true }).click();
  await expectVisible(page.getByRole('heading', { name: '林卫长刀', exact: true }), '确认后保存并更新选中技能');
  await page.getByRole('button', { name: '林卫长刀辅助槽1 · 添加辅助', exact: true }).click();
  await page.getByRole('textbox', { name: '搜索可装备物品' }).fill('节能');
  await page.getByRole('button', { name: '装备节能 Lv.1', exact: true }).first().click();
  await expectVisible(page.getByRole('heading', { name: '节能', exact: true }), '兼容辅助保存并展示所属技能');
  await page.getByRole('button', { name: '归流心法 · 查看心法', exact: true }).click();
  await page.getByRole('button', { name: '拆卸', exact: true }).click();
  await expectVisible(page.getByRole('heading', { name: '确认装配变更' }), '拆卸心法前提示技能与辅助返回背包');
  await capture('remove-confirm');
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await page.goto(url);
  await page.getByRole('button', { name: '↻ 复制上一局', exact: true }).click();
  await expectVisible(page.getByRole('heading', { name: '复制上一局构筑' }), '复制上一局先展示物品清单与50%快捷费用');
  await capture('copy-confirm');
  await page.getByRole('button', { name: '购买并装备', exact: true }).click();
  await expectVisible(page.getByText('上一局构筑已购买并装备，原装备已退回背包', { exact: true }), '确认复制后显示装配反馈');
  await page.getByRole('button', { name: '↻ 复制上一局', exact: true }).click();
  const copy = page.getByRole('button', { name: '购买并装备', exact: true });
  if (!await copy.isDisabled()) throw new Error('复制后余额不足时购买按钮未禁用');
  interactions.push('余额不足时禁止再次复制');
  await page.goto(`${url}&scenario=empty`);
  await page.getByRole('button', { name: '一键装配保底组合' }).click();
  await expectVisible(page.getByRole('heading', { name: '归流心法', exact: true }), '空构筑可一键装入免费保底');
  await page.goto(`${url}&scenario=save-error`);
  await page.getByRole('heading', { name: '火球术', exact: true }).waitFor();
  await page.getByRole('button', { name: '替换技能', exact: true }).click();
  await page.getByRole('textbox', { name: '搜索可装备物品' }).fill('林卫长刀');
  await page.getByRole('button', { name: '装备林卫长刀 Lv.1', exact: true }).first().click();
  await page.getByRole('button', { name: '确认变更', exact: true }).click();
  await expectVisible(page.getByRole('button', { name: '刷新装配', exact: true }), '保存失败保留构筑并提供刷新恢复入口');
  await capture('save-error');
  for (const scenario of ['full', 'poor', 'load-error']) {
    await page.goto(`${url}&scenario=${scenario}`);
    if (scenario === 'load-error') await page.getByRole('button', { name: '刷新装配', exact: true }).waitFor();
    else await page.getByRole('heading', { name: '火球术', exact: true }).waitFor();
    await capture(scenario);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${url}&scenario=full`);
  await page.getByRole('heading', { name: '火球术', exact: true }).waitFor();
  await capture('full-phone');
  await page.getByRole('button', { name: '飞刃术 Lv.20', exact: true }).click();
  await page.getByRole('heading', { name: '飞刃术', exact: true }).waitFor();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await capture('phone-details');
  const mobilePosition = await page.getByRole('complementary', { name: '装备操作' }).boundingBox();
  if (!mobilePosition || mobilePosition.y < 0 || mobilePosition.y > 300) throw new Error('手机选中节点后未滚动到详情');
  interactions.push('手机选中节点后滚动到详情');
  await page.getByRole('button', { name: '↑ 返回构筑', exact: true }).click();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const boardPosition = await page.getByRole('button', { name: '归流心法 · 查看心法', exact: true }).boundingBox();
  if (!boardPosition || boardPosition.y < 0 || boardPosition.y > 400) throw new Error('手机返回构筑未恢复可见连接图');
  interactions.push('手机可返回完整构筑盘');
  await page.getByRole('button', { name: '替换技能', exact: true }).scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: '替换技能', exact: true }).click();
  await capture('phone-inventory');
  const destination = new URL('layout.json', output);
  const source = JSON.stringify({ errors, missing, layouts, interactions }, null, 2);
  await writeFile(destination, source);
  const summary = JSON.stringify({ errors, missing, layouts: layouts.length, interactions });
  process.stdout.write(summary);
} finally { await browser.close(); }
