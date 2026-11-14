import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const output = new URL('./previews/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage();
const errors = [];
const missingAssets = [];
const results = [];
const interactions = [];
const base = 'http://127.0.0.1:5186/?view=expeditions';
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => { const status = response.status(); if (status >= 400) { const url = response.url(); missingAssets.push({ status, url }); } });

async function capture(name) {
  const target = new URL(`${name}.png`, output);
  const path = fileURLToPath(target);
  await page.mouse.move(0, 0);
  await page.screenshot({ path, fullPage: true });
}

async function measure(label) {
  const metrics = await page.evaluate(() => {
    const dialog = document.querySelector('dialog');
    const heading = document.querySelector('h1');
    const bounds = dialog.getBoundingClientRect();
    const title = heading.getBoundingClientRect();
    const overflow = document.documentElement.scrollWidth > innerWidth;
    const outside = bounds.left < 0 || bounds.right > innerWidth || bounds.bottom > innerHeight || title.top < 0;
    const clippedButtons = [...dialog.querySelectorAll('button')].filter(button => button.scrollWidth > button.clientWidth + 1).map(button => button.textContent);
    const image = dialog.querySelector('img');
    return { panel: bounds.toJSON(), title: title.toJSON(), overflow, outside, clippedButtons, imageLoaded: image.complete && image.naturalWidth > 0 };
  });
  results.push({ label, ...metrics });
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
    await page.goto(base);
    await page.getByRole('heading', { name: '秘境探索', exact: true }).waitFor();
    await page.evaluate(async () => { await document.fonts.ready; const images = [...document.images]; await Promise.all(images.map(image => image.decode())); });
    await capture(`expedition-${viewport.name}`);
    await measure(viewport.name);
  }
  await page.setViewportSize({ width: 1024, height: 683 });
  for (const scenario of ['empty', 'many', 'full', 'busy', 'error', 'long']) {
    await page.goto(`${base}&case=${scenario}`);
    await page.getByRole('heading', { name: '秘境探索', exact: true }).waitFor();
    await capture(`expedition-${scenario}`);
    await measure(scenario);
  }
  const full = page.getByRole('button', { name: '加入房间 k7mP2xQ9a', exact: true });
  await page.goto(`${base}&case=full`);
  const fullDisabled = await full.isDisabled();
  if (!fullDisabled) throw new Error('满员房间未禁用加入按钮');
  interactions.push('满员房间禁用加入');

  await page.goto(base);
  const input = page.getByRole('textbox', { name: '房间编号', exact: true });
  const join = page.getByRole('button', { name: '加入', exact: true });
  await input.fill('   ');
  const emptyDisabled = await join.isDisabled();
  if (!emptyDisabled) throw new Error('空白编号未禁用加入按钮');
  await input.fill('  ABcd-12  ');
  await input.press('Enter');
  await page.waitForFunction(() => document.querySelector('main').dataset.lastRequest === 'ABcd-12');
  await join.waitFor({ state: 'visible' });
  await page.waitForFunction(() => !document.querySelector('input').disabled);
  interactions.push('编号回车加入，去除首尾空格并保留大小写');
  const create = page.getByRole('button', { name: '创建房间', exact: true });
  await create.click();
  await page.getByRole('button', { name: '正在创建…', exact: true }).waitFor();
  const joiningDisabled = await input.isDisabled();
  if (!joiningDisabled) throw new Error('连接中未禁用重复加入');
  await page.waitForFunction(() => document.querySelector('main').dataset.lastRequest === 'create');
  await create.waitFor();
  interactions.push('创建房间沿用回调，连接中禁用重复操作');
  const room = page.getByRole('button', { name: '加入房间 p6hT3wK5d', exact: true });
  await room.click();
  await page.waitForFunction(() => document.querySelector('main').dataset.lastRequest === 'p6hT3wK5d');
  await page.waitForFunction(() => !document.querySelector('input').disabled);
  interactions.push('列表加入传递对应房间编号');

  await page.getByRole('button', { name: '玩法详情' }).click();
  await page.getByRole('heading', { name: '林地围猎 · 玩法详情', exact: true }).waitFor();
  await capture('expedition-details');
  await page.keyboard.press('Escape');
  const detailCount = await page.getByRole('heading', { name: '林地围猎 · 玩法详情', exact: true }).count();
  const parentVisible = await page.getByRole('heading', { name: '秘境探索', exact: true }).isVisible();
  if (detailCount !== 0 || !parentVisible) throw new Error('Esc 关闭详情时影响了秘境主界面');
  await page.getByRole('button', { name: '玩法详情' }).click();
  await page.mouse.click(3, 3);
  const parentAfterBackdrop = await page.getByRole('heading', { name: '秘境探索', exact: true }).isVisible();
  if (!parentAfterBackdrop) throw new Error('详情遮罩点击误关主界面');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '打开秘境界面', exact: true }).waitFor();
  interactions.push('玩法详情和主界面的 Esc、遮罩关闭互不干扰');

  await page.goto(`${base}&case=request-error`);
  await page.getByRole('button', { name: '创建房间', exact: true }).click();
  await page.getByRole('alert').waitFor();
  await capture('expedition-request-error');
  await measure('request-error');
  interactions.push('连接错误在界面中显示，操作恢复可用');

  for (const width of [1024, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(`${base}&case=many`);
    await page.getByRole('heading', { name: '秘境探索', exact: true }).waitFor();
    const ids = new Set();
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const buttons = page.getByRole('button', { name: /^加入房间 / });
      const labels = await buttons.evaluateAll(items => items.map(item => item.getAttribute('aria-label')));
      labels.forEach(label => ids.add(label));
      const next = page.getByRole('button', { name: '下一页房间', exact: true });
      const enabled = await next.isEnabled();
      if (!enabled) break;
      await next.click();
    }
    if (ids.size !== 11) throw new Error(`${width}px 分页遗漏房间`);
  }
  interactions.push('桌面和手机分页均可访问全部 11 个示例房间');

  await page.setViewportSize({ width: 1024, height: 683 });
  await page.goto('http://127.0.0.1:5186/');
  await page.getByText('正在加载大厅场景', { exact: true }).waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: '打开秘境', exact: true }).click();
  await page.getByRole('heading', { name: '秘境探索', exact: true }).waitFor();
  await page.evaluate(async () => { const images = [...document.images]; await Promise.all(images.map(image => image.decode())); });
  await capture('expedition-camp');
  await measure('camp-integration');
  await page.getByRole('button', { name: '创建房间', exact: true }).click();
  await page.getByRole('alert').waitFor();
  interactions.push('真实营地入口使用同一组件，场景预览保留账号模式提示');

  const report = { results, interactions, errors, missingAssets };
  const serialized = JSON.stringify(report, null, 2);
  const destination = new URL('verification.json', output);
  await writeFile(destination, serialized);
  console.log(serialized);
  const failed = results.filter(result => result.overflow || result.outside || result.clippedButtons.length || !result.imageLoaded);
  if (failed.length || errors.length || missingAssets.length) throw new Error('秘境效果页面仍有布局或资源问题，详见 verification.json');
} finally { await browser.close(); }
