import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const output = new URL('./previews/', import.meta.url);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1585, height: 992 } });
const errors = []; const missing = []; const layouts = [];
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => { if (response.status() >= 400) missing.push(response.url()); });
async function capture(name) {
  const destination = new URL(`${name}.png`, output); const path = fileURLToPath(destination);
  await page.mouse.move(0, 0); await page.screenshot({ path });
  const measure = () => {
    const labels = ['当前战况', '角色与队伍', '已装备近战与远程技能及冲刺格挡', '局内成长', '本局收获'];
    const groups = labels.map(label => { const node = document.querySelector(`[aria-label="${label}"]`); return { label, box: node?.getBoundingClientRect().toJSON() }; });
    const controls = [...document.querySelectorAll('[aria-label^="Shift 冲刺"], [aria-label^="Space 格挡"]')].map(node => ({ name: node.getAttribute('aria-label'), box: node.getBoundingClientRect().toJSON() }));
    const character = document.querySelector('[aria-label="角色与队伍"]')?.textContent ?? '';
    const skills = document.querySelector('[aria-label="已装备近战与远程技能及冲刺格挡"]')?.textContent ?? '';
    const income = document.querySelector('[aria-label="本局收获"]')?.textContent ?? '';
    const information = document.querySelector('button[aria-haspopup="dialog"][aria-expanded]')?.closest('aside')?.textContent ?? '';
    const removedCopy = [skills.includes('自动攻击') ? '自动攻击' : '', character.includes('归流心法') ? '归流心法' : '', income.includes('获得') || income.includes('已用') ? '金币收支说明' : '', information.includes('下一波') || information.includes('下一关') ? '下一波预告' : ''].filter(Boolean);
    return { viewport: { width: innerWidth, height: innerHeight }, overflow: document.documentElement.scrollWidth > innerWidth, groups, controls, removedCopy };
  };
  const metrics = await page.evaluate(measure); layouts.push({ name, ...metrics });
}
async function open(scenario) {
  await page.goto(`http://127.0.0.1:5186/?view=battle-ui&case=${scenario}`);
  await page.locator('[data-battle-review][data-ready="true"]').waitFor({ timeout: 30000 });
  await page.waitForTimeout(700);
}
try {
  await open('default'); await capture('battle-desktop');
  await page.getByRole('button', { name: '波次情报', exact: true }).click(); await capture('battle-wave-details');
  await page.getByRole('button', { name: '关闭波次情报' }).click();
  await page.getByRole('button', { name: '菜单', exact: true }).click(); await capture('battle-menu');
  await page.getByRole('button', { name: '返回战斗', exact: true }).click();
  await page.getByRole('button', { name: /选择奖励/ }).click(); await capture('battle-rewards');
  await page.getByRole('button', { name: /收起面板|收起本波收获/ }).click();
  await page.getByRole('button', { name: '查看保险箱' }).click(); await capture('battle-inventory');
  await page.getByRole('button', { name: /收起面板|收起本波收获/ }).click();
  await page.setViewportSize({ width: 1280, height: 720 }); await capture('battle-desktop-1280');
  await page.setViewportSize({ width: 1366, height: 768 }); await capture('battle-desktop-1366');
  await page.setViewportSize({ width: 1920, height: 1080 }); await capture('battle-desktop-1920');
  await page.setViewportSize({ width: 1585, height: 992 });
  for (const scenario of ['blocked', 'soul', 'crowded', 'solo', 'hell', 'rest', 'empty', 'long']) { await open(scenario); await capture(`battle-${scenario}`); }
  const report = JSON.stringify({ errors, missing, layouts }, null, 2);
  const destination = new URL('layout-report.json', output); await writeFile(destination, report);
  console.log(JSON.stringify({ errors, missing, screenshots: layouts.length, overflow: layouts.filter(entry => entry.overflow).map(entry => entry.name) }));
} catch (error) { console.log(JSON.stringify({ errors, missing, message: error.message })); throw error; } finally { await browser.close(); }
