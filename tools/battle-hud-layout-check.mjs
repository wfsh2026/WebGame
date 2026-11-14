import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';

const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const page = await browser.newPage(); const errors = []; const checks = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto('http://127.0.0.1:5317/online.html');
  await page.getByLabel('账号', { exact: true }).waitFor();
  await page.evaluate(async () => {
    const react = await import('/node_modules/.vite/deps/react.js');
    const dom = await import('/node_modules/.vite/deps/react-dom_client.js');
    const { CombatHud } = await import('/src/hud/combat-hud.tsx');
    const parent = document.getElementById('root'); parent.style.display = 'none';
    const fixture = document.createElement('div'); document.body.appendChild(fixture);
    const player = { id: 'layout-player', name: '技能布局验证', hp: 186, maxHp: 250, energy: 22, capacity: 30 };
    const abilities = Array.from({ length: 8 }, (_, index) => ({ id: `ability-${index}`, name: `技能 ${index + 1}`, kind: 'skill', skillType: index === 0 ? 'melee' : 'ranged', icon: index === 0 ? 'arrow' : 'wind', interval: 6, remaining: index * .6, cost: 8, state: index === 0 ? '等待供能' : '计时中', triggers: 1 }));
    const root = dom.default.createRoot(fixture); const element = react.default.createElement(CombatHud, { player, players: [player], abilities }); root.render(element);
  });
  const slots = page.getByRole('region', { name: '已装备近战与远程技能' }).getByRole('img');
  await slots.first().waitFor(); const slotCount = await slots.count(); assert.equal(slotCount, 8);
  for (const width of [1536, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    const boxes = await slots.evaluateAll(elements => elements.map(element => { const rect = element.getBoundingClientRect(); return { left: rect.left, right: rect.right, bottom: rect.bottom, top: rect.top }; }));
    for (const box of boxes) { assert.ok(box.left >= 0); assert.ok(box.right <= width); assert.ok(box.bottom <= 844); }
    for (let index = 1; index < boxes.length; index += 1) {
      const before = boxes[index - 1]; const current = boxes[index];
      assert.ok(current.left >= before.right || current.top >= before.bottom, '技能槽不能重叠');
    }
    checks.push({ width, slots: boxes.length, overflow: false, overlap: false });
    if (width === 390) await page.screenshot({ path: '.cache/battle-ui/eight-abilities-mobile.png' });
  }
  const waitingCount = await page.getByText('等待供能', { exact: true }).count(); assert.equal(waitingCount, 1);
  assert.deepEqual(errors, []);
  const report = JSON.stringify({ checks, errors }, null, 2); await writeFile('.cache/battle-ui/hud-layout-report.json', report); console.log(report);
} finally { await browser.close(); }
