import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';

const address = process.env.GAME_TEST_URL ?? 'http://127.0.0.1:5317/online.html?diagnostics';
const output = process.env.GAME_TEST_OUTPUT ?? '.cache/battle-ui';
await mkdir(output, { recursive: true });
const packageUrl = new URL('../apps/web/package.json', import.meta.url);
const webRequire = createRequire(packageUrl);
const sdkPath = webRequire.resolve('colyseus.js');
const sdkRequire = createRequire(sdkPath);
const { decode } = sdkRequire('@colyseus/schema');
const { unpack } = sdkRequire('@colyseus/msgpackr');
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const records = []; const states = [null, null]; const errors = []; const stages = [];
const stamp = Date.now().toString(36);
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
async function waitState(predicate, timeout = 30000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) { if (predicate()) return; await delay(100); }
  const summary = states.map(state => state && ({ stage: state.stage, round: state.round, error: state.error }));
  const detail = JSON.stringify(summary); throw new Error(`状态超时 ${detail}`);
}
function capture(page, index) {
  page.on('pageerror', error => errors.push(error.message));
  page.on('websocket', socket => socket.on('framereceived', event => {
    if (typeof event.payload === 'string') return;
    const bytes = new Uint8Array(event.payload); if (bytes[0] !== 13) return;
    const iterator = { offset: 1 }; const type = decode.string(bytes, iterator); if (type !== 'snapshot') return;
    const value = unpack(bytes, { start: iterator.offset }); const previous = states[index]; states[index] = value;
    if (!previous || previous.stage !== value.stage || previous.round !== value.round) {
      const entry = { index, stage: value.stage, round: value.round }; stages.push(entry);
      const line = JSON.stringify(entry); console.log(line);
    }
  }));
}
try {
  for (let index = 0; index < 2; index += 1) {
    const context = await browser.newContext({ viewport: { width: 1536, height: 960 } });
    const page = await context.newPage(); capture(page, index);
    const origin = new URL(address).origin; const name = `battle_${stamp}_${index}`;
    const registered = await page.request.post(`${origin}/api/register`, { data: { name, password: `Battle-${stamp}-check` } });
    const registrationStatus = registered.status(); assert.equal(registrationStatus, 200); const account = await registered.json();
    const headers = { authorization: `Bearer ${account.token}` };
    const created = await page.request.post(`${origin}/api/character`, { headers, data: { role: 'forest-survival:character/ranger' } });
    const creationStatus = created.status(); assert.equal(creationStatus, 200);
    await page.addInitScript(token => sessionStorage.setItem('web-game-world.online-token.v1', token), account.token);
    await page.goto(address); await page.getByRole('button', { name: '打开秘境', exact: true }).click();
    records.push({ page, context, account, headers });
  }
  await records[0].page.getByRole('button', { name: '创建房间', exact: true }).click();
  await waitState(() => states[0]?.stage === 'waiting');
  const roomId = states[0].roomId;
  await records[1].page.getByLabel('房间编号').fill(roomId);
  await records[1].page.getByRole('button', { name: '加入', exact: true }).first().click();
  await waitState(() => states.every(state => state?.players.length === 2));
  for (const record of records) await record.page.getByRole('button', { name: '准备', exact: true }).click();
  await records[0].page.getByRole('button', { name: '开启秘境', exact: true }).click();
  await waitState(() => states.every(state => state?.stage === 'combat'));
  const page = records[0].page;
  await page.getByRole('heading', { name: '生存奖励' }).waitFor();
  await page.screenshot({ path: `${output}/combat-entry.png` });
  await page.getByRole('heading', { name: '生存奖励' }).waitFor({ state: 'hidden', timeout: 8000 });
  const reward = page.getByRole('button', { name: /存活/ });
  await reward.hover(); await page.getByRole('heading', { name: '生存奖励' }).waitFor();
  await page.mouse.move(750, 600); await page.getByRole('heading', { name: '生存奖励' }).waitFor({ state: 'hidden' });
  const equipped = page.getByRole('region', { name: '已装备近战与远程技能' });
  const equippedCount = await equipped.getByRole('img').count(); assert.equal(equippedCount, 2);
  const dashHints = await page.getByText('Shift 冲刺', { exact: true }).count(); assert.equal(dashHints, 0);
  const movementHints = await page.getByText('WASD 移动 · 自动攻击', { exact: true }).count(); assert.equal(movementHints, 0);
  for (const record of records) await record.page.locator('canvas').click();
  const pressed = [new Set(), new Set()]; let grown = false; let screenshot = false; let intervalsSeen = false; let controlsChecked = false;
  const focusedRounds = [1, 1]; const deadline = Date.now() + 440000;
  while (Date.now() < deadline) {
    if (states.every(state => state?.stage === 'final-result')) break;
    for (let index = 0; index < records.length; index += 1) {
      const state = states[index]; if (state?.stage !== 'combat') continue;
      const record = records[index]; const player = state.players.find(item => item.id === record.account.profile.id);
      if (focusedRounds[index] !== state.round) { await record.page.locator('canvas').click(); focusedRounds[index] = state.round; pressed[index].clear(); }
      if (!controlsChecked && index === 0 && state.seconds < 166) {
        await record.page.keyboard.press('Shift'); await delay(150);
        await record.page.keyboard.down('Space'); await delay(150); await record.page.keyboard.up('Space'); controlsChecked = true;
      }
      intervalsSeen ||= player.abilities.some(ability => ability.remaining > 0 && ability.triggers > 0);
      const angle = (180 - state.seconds) * .18 + index * .3;
      let x = (15 + Math.cos(angle) * 8 - player.x) * .3; let y = (11 + Math.sin(angle) * 6 - player.y) * .3;
      for (const enemy of state.enemies) {
        const dx = player.x - enemy.x; const dy = player.y - enemy.y; const squared = dx * dx + dy * dy;
        if (squared < 16) { const bounded = Math.max(.1, squared); const force = 3 / bounded; x += dx * force; y += dy * force; }
      }
      const next = new Set(); if (x > .15) next.add('d'); if (x < -.15) next.add('a'); if (y > .15) next.add('s'); if (y < -.15) next.add('w');
      for (const key of pressed[index]) if (!next.has(key)) await record.page.keyboard.up(key);
      for (const key of next) if (!pressed[index].has(key)) await record.page.keyboard.down(key);
      pressed[index] = next;
    }
    if (!screenshot && states[0]?.stage === 'combat' && states[0].seconds < 150) {
      await page.screenshot({ path: `${output}/combat-playing.png` });
      await page.setViewportSize({ width: 390, height: 844 }); await delay(250);
      await page.screenshot({ path: `${output}/combat-mobile.png` });
      const dimensions = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: innerWidth }));
      assert.equal(dimensions.width, dimensions.viewport);
      await page.setViewportSize({ width: 1536, height: 960 }); await page.locator('canvas').click(); screenshot = true;
    }
    if (!grown && states.every(state => state?.stage === 'rest' && state.round === 1)) {
      for (const record of records) await record.page.getByRole('button', { name: '锋芒 · 能力伤害 +20%', exact: true }).click();
      grown = true;
    }
    await delay(100);
  }
  const finished = states.every(state => state?.stage === 'final-result'); assert.ok(finished, '必须进入最终结算');
  const completed = states[0].results.every(result => result.success);
  assert.equal(states[0].results.length, 2); assert.ok(completed);
  assert.ok(grown); assert.ok(intervalsSeen); assert.ok(controlsChecked);
  for (const result of states[0].results) for (const player of result.players) assert.ok(player.survivalSeconds <= 180.001);
  await page.screenshot({ path: `${output}/final-result.png` });
  const rewards = states[0].rewards;
  const origin = new URL(address).origin;
  await records[0].page.getByRole('button', { name: '返回游戏大厅', exact: true }).click();
  await records[0].page.getByRole('button', { name: '打开秘境', exact: true }).waitFor();
  const otherResultVisible = await records[1].page.getByRole('button', { name: '返回游戏大厅', exact: true }).isVisible(); assert.ok(otherResultVisible);
  for (const record of records) {
    const response = await record.page.request.get(`${origin}/api/me`, { headers: record.headers }); const profile = await response.json();
    const reward = rewards.find(item => item.id === profile.id); assert.equal(profile.coins, reward.coins); assert.equal(profile.materials, reward.materials);
  }
  assert.deepEqual(errors, []);
  const report = { address, roomId, stages, rewards, results: states[0].results, intervalsSeen, controlsChecked, rewardHover: true, mobileOverflow: false, independentReturn: true, errors };
  const serialized = JSON.stringify(report, null, 2); await writeFile(`${output}/browser-report.json`, serialized); console.log(serialized);
} finally { await browser.close(); }
