import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';

const webPackageUrl = new URL('../apps/web/package.json', import.meta.url); const webRequire = createRequire(webPackageUrl);
const sdkPath = webRequire.resolve('colyseus.js'); const sdkRequire = createRequire(sdkPath);
const { decode } = sdkRequire('@colyseus/schema'); const { unpack } = sdkRequire('@colyseus/msgpackr');
const address = process.env.GAME_TEST_URL ?? 'http://47.117.185.109:8080/online/';
const output = new URL('../.cache/online-test/', import.meta.url); await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const stamp = Date.now().toString(36); const records = []; const errors = []; const states = [null, null]; const stageEvents = [];
function capture(page, index) {
  page.on('pageerror', error => { const item = { index, error: error.message, stack: error.stack }; errors.push(item); console.error(item); });
  page.on('websocket', socket => { socket.on('framereceived', event => {
    const payload = event.payload; if (typeof payload === 'string') return;
    const bytes = new Uint8Array(payload); if (bytes[0] !== 13) return;
    const iterator = { offset: 1 }; const type = decode.string(bytes, iterator); if (type !== 'snapshot') return;
    const value = unpack(bytes, { start: iterator.offset }); const previous = states[index]; states[index] = value;
    if (!previous || previous.stage !== value.stage || previous.round !== value.round) { const item = { client: index, stage: value.stage, round: value.round, at: Date.now() }; stageEvents.push(item); const report = JSON.stringify(item); console.log(report); }
  }); });
}
async function waitForState(predicate, seconds = 30) {
  const deadline = Date.now() + seconds * 1000;
  while (Date.now() < deadline) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 200)); }
  const summaries = states.map(state => state && ({ stage: state.stage, round: state.round, error: state.error }));
  throw new Error(`状态等待超时：${JSON.stringify(summaries)}`);
}
try {
  for (let index = 0; index < 2; index += 1) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } }); const page = await context.newPage(); capture(page, index);
    await page.goto(address); const username = `test_${stamp}_${index}`; const password = `Forest-${stamp}-test`;
    await page.getByLabel('账号', { exact: true }).fill(username); await page.getByLabel('密码', { exact: true }).fill(password); await page.getByRole('button', { name: '创建账号', exact: true }).click();
    await page.getByRole('button', { name: '选择逐风者，进入大厅' }).click(); await page.getByRole('button', { name: '创建房间', exact: true }).waitFor(); records.push({ context, page, username });
  }
  await records[0].page.getByRole('button', { name: '创建房间', exact: true }).click(); await waitForState(() => states[0]?.stage === 'waiting');
  const roomId = states[0].roomId; await records[1].page.getByLabel('房间编号').fill(roomId); await records[1].page.getByRole('button', { name: '加入', exact: true }).first().click();
  await waitForState(() => states.every(state => state?.players.length === 2));
  for (const item of records) await item.page.getByRole('button', { name: '准备', exact: true }).click();
  await records[0].page.getByRole('button', { name: '开启秘境', exact: true }).click(); await waitForState(() => states.every(state => state?.stage === 'rest'));
  await records[0].page.screenshot({ path: new URL('hall.png', output).pathname.replace(/^\/(\w:)/, '$1') });
  await waitForState(() => states.every(state => state?.stage === 'combat'), 30);
  for (const item of records) await item.page.locator('canvas').click();
  const initialPlayer = states[0].players.find(player => player.name === records[0].username); const initialX = initialPlayer.x;
  await records[0].page.keyboard.down('d'); await new Promise(resolve => setTimeout(resolve, 500)); await records[0].page.keyboard.up('d');
  await waitForState(() => { const player = states[0].players.find(item => item.name === records[0].username); return player.x > initialX + 0.5; }, 5);
  const combatPath = new URL('combat.png', output).pathname.replace(/^\/(\w:)/, '$1'); await records[0].page.locator('canvas').screenshot({ path: combatPath });
  let selectedGrowth = false; let reconnectChecked = false; let blockChecked = false; let dashChecked = false;
  const pressed = [new Set(), new Set()]; const focusedRounds = [1, 1]; const deadline = Date.now() + 520000;
  const shortMode = process.env.GAME_TEST_SHORT === '1';
  while (Date.now() < deadline) {
    if (states.every(state => state?.stage === 'final-result')) break;
    for (let index = 0; index < 2; index += 1) {
      const state = states[index]; if (!state || state.stage !== 'combat') continue;
      if (focusedRounds[index] !== state.round) { await records[index].page.locator('canvas').click(); pressed[index].clear(); focusedRounds[index] = state.round; }
      const player = state.players.find(item => item.name === records[index].username); if (!player) continue;
      const enemy = state.enemies.find(item => item.state === 'windup');
      if (!blockChecked && index === 0 && enemy && state.seconds < 172) {
        await records[0].page.keyboard.down('Space'); await new Promise(resolve => setTimeout(resolve, 250)); await records[0].page.keyboard.up('Space'); blockChecked = true;
      }
      if (!dashChecked && index === 0 && state.seconds < 174) { await records[0].page.keyboard.press('Shift'); dashChecked = true; }
      const angle = (180 - state.seconds) * 0.18 + index * 0.3; let x = (15 + Math.cos(angle) * 8 - player.x) * 0.3; let y = (11 + Math.sin(angle) * 6 - player.y) * 0.3;
      for (const threat of state.enemies) { const dx = player.x - threat.x; const dy = player.y - threat.y; const squared = dx * dx + dy * dy; if (squared < 16) { const force = 3 / Math.max(0.1, squared); x += dx * force; y += dy * force; } }
      const next = new Set(); if (x > 0.15) next.add('d'); if (x < -0.15) next.add('a'); if (y > 0.15) next.add('s'); if (y < -0.15) next.add('w');
      for (const key of pressed[index]) if (!next.has(key)) await records[index].page.keyboard.up(key);
      for (const key of next) if (!pressed[index].has(key)) await records[index].page.keyboard.down(key);
      pressed[index] = next;
    }
    if (!reconnectChecked && states[1]?.stage === 'combat' && states[1].seconds < 165) {
      await records[1].context.setOffline(true); await new Promise(resolve => setTimeout(resolve, 1500)); await records[1].context.setOffline(false);
      await records[1].page.reload(); await waitForState(() => states[1]?.players.every(player => player.connected), 35);
      await records[1].page.locator('canvas').click(); pressed[1].clear(); reconnectChecked = true;
    }
    if (!selectedGrowth && states.every(state => state?.stage === 'rest' && state.round === 1)) {
      for (const item of records) await item.page.getByRole('button', { name: '锋芒 · 能力伤害 +20%', exact: true }).click(); selectedGrowth = true;
    }
    if (shortMode && reconnectChecked) { for (const item of records) { await item.page.keyboard.down('Space'); } await waitForState(() => states.every(state => state?.stage === 'final-result'), 180); break; }
    await new Promise(resolve => setTimeout(resolve, 120));
  }
  const bothFinished = states.every(state => state?.stage === 'final-result'); assert.ok(bothFinished, '两端必须到达最终结算');
  if (!shortMode) { assert.ok(states[0].results.length === 2 && states[0].results.every(result => result.success), '两轮必须成功'); assert.ok(selectedGrowth, '轮间成长必须生效'); }
  assert.ok(reconnectChecked, '必须覆盖重连');
  await records[0].page.screenshot({ path: new URL('final-result.png', output).pathname.replace(/^\/(\w:)/, '$1') });
  for (const item of records) { await item.page.getByRole('button', { name: '返回游戏大厅', exact: true }).click(); await item.page.getByText(/金币 \d+ · 经营素材 \d+/).first().waitFor(); }
  const report = { address, roomId, users: records.map(item => item.username), stages: stageEvents, browserErrors: errors, reconnectChecked, blockChecked, dashChecked, selectedGrowth, result: states[0].results };
  const serialized = JSON.stringify(report, null, 2); const reportUrl = new URL('report.json', output); await writeFile(reportUrl, serialized); console.log(serialized);
  assert.equal(errors.length, 0, '浏览器不应出现运行异常');
} finally { await browser.close(); }
