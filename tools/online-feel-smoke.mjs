import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';

const packageUrl = new URL('../apps/web/package.json', import.meta.url); const require = createRequire(packageUrl); const sdk = require.resolve('colyseus.js'); const sdkRequire = createRequire(sdk);
const { decode } = sdkRequire('@colyseus/schema'); const { unpack } = sdkRequire('@colyseus/msgpackr');
const output = new URL('../.cache/online-feel/', import.meta.url); await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const clients = []; const states = [null, null]; const errors = []; let delay = 0;
function installNetworkDelay() {
  const NativeSocket = window.WebSocket; window.__gameNetworkDelay = 0;
  class DelayedSocket extends NativeSocket {
    constructor(url, protocols) {
      super(url, protocols); const replayed = new WeakSet();
      this.addEventListener('message', event => {
        if (replayed.has(event) || !window.__gameNetworkDelay) return;
        event.stopImmediatePropagation();
        setTimeout(() => { const message = new MessageEvent('message', { data: event.data, origin: event.origin }); replayed.add(message); this.dispatchEvent(message); }, window.__gameNetworkDelay);
      }, true);
    }
    send(data) {
      let copy = data;
      if (ArrayBuffer.isView(data)) { const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength); copy = bytes.slice(); }
      else if (data instanceof ArrayBuffer) copy = data.slice(0);
      if (!window.__gameNetworkDelay) { super.send(copy); return; }
      setTimeout(() => { if (this.readyState === NativeSocket.OPEN) super.send(copy); }, window.__gameNetworkDelay);
    }
  }
  window.WebSocket = DelayedSocket;
}
function parseSnapshot(message) { if (typeof message === 'string') return null; const bytes = new Uint8Array(message); if (bytes[0] !== 13) return null; const iterator = { offset: 1 }; const type = decode.string(bytes, iterator); if (type !== 'snapshot') return null; return unpack(bytes, { start: iterator.offset }); }
async function waitFor(predicate, duration = 30000) { const deadline = Date.now() + duration; while (Date.now() < deadline) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 50)); } throw new Error('手感测试等待超时'); }
function measureMovement() {
  const canvas = document.querySelector('canvas'); const initial = Number(canvas.dataset.localX); const start = performance.now();
  return new Promise((resolve, reject) => { function sample() { const x = Number(canvas.dataset.localX); const duration = performance.now() - start; if (x > initial + 0.01) { resolve({ responseMs: duration, initial, x }); return; } if (duration > 1500) { reject(new Error('输入没有响应')); return; } requestAnimationFrame(sample); } requestAnimationFrame(sample); });
}
function sampleFrames() {
  const canvas = document.querySelector('canvas'); const frames = []; const start = performance.now();
  return new Promise(resolve => { function sample(now) { const data = canvas.dataset; frames.push({ time: now, frame: Number(data.frameCount), server: data.serverTime, enemy: data.enemyId, enemyX: Number(data.enemyX), enemyY: Number(data.enemyY), shot: data.shotId, shotX: Number(data.shotX), shotY: Number(data.shotY) }); if (now - start >= 3000) resolve(frames); else requestAnimationFrame(sample); } requestAnimationFrame(sample); });
}
try {
  const stamp = Date.now().toString(36);
  for (let index = 0; index < 2; index += 1) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } }); const page = await context.newPage(); const name = `test_feel_${stamp}${index}`;
    page.on('pageerror', error => { errors.push(error.message); console.error(error); });
    await page.addInitScript(installNetworkDelay);
    page.on('websocket', socket => { socket.on('framereceived', event => { const state = parseSnapshot(event.payload); if (state) states[index] = state; }); });
    await page.goto('http://47.117.185.109:8080/online/?diagnostics=1');
    await page.getByLabel('账号', { exact: true }).fill(name); await page.getByLabel('密码', { exact: true }).fill(`Forest-feel-${stamp}`); await page.getByRole('button', { name: '创建账号', exact: true }).click(); await page.getByRole('button', { name: '选择逐风者，进入大厅' }).click(); await page.getByRole('button', { name: '创建房间', exact: true }).waitFor(); clients.push({ page, name });
  }
  await clients[0].page.getByRole('button', { name: '创建房间', exact: true }).click(); await waitFor(() => Boolean(states[0]));
  await clients[1].page.getByLabel('房间编号').fill(states[0].roomId); await clients[1].page.getByRole('button', { name: '加入', exact: true }).first().click(); await waitFor(() => states.every(state => state?.players.length === 2));
  for (const client of clients) await client.page.getByRole('button', { name: '准备', exact: true }).click();
  await clients[0].page.getByRole('button', { name: '开启秘境', exact: true }).click(); await waitFor(() => states.every(state => state?.stage === 'combat'));
  const page = clients[0].page; await page.locator('canvas').click(); await page.waitForFunction(() => Number(document.querySelector('canvas')?.dataset.frameCount) > 5);
  const baselinePromise = page.evaluate(measureMovement); await page.keyboard.down('d'); const baseline = await baselinePromise; await page.keyboard.up('d');
  delay = 200; for (const client of clients) await client.page.evaluate(value => { window.__gameNetworkDelay = value; }, delay); await new Promise(resolve => setTimeout(resolve, 800));
  const delayedPromise = page.evaluate(measureMovement); await page.keyboard.down('d'); const delayed = await delayedPromise; await page.keyboard.up('d');
  assert.ok(delayed.responseMs < 100, '增加 400ms 网络往返后，按键应在 100ms 内本地响应');
  const frames = await page.evaluate(sampleFrames); const intervals = []; let enemySteps = 0; let projectileSteps = 0;
  for (let index = 1; index < frames.length; index += 1) { const previous = frames[index - 1]; const current = frames[index]; intervals.push(current.time - previous.time); if (previous.server !== current.server) continue; if (current.enemy && previous.enemy === current.enemy && (previous.enemyX !== current.enemyX || previous.enemyY !== current.enemyY)) enemySteps += 1; if (current.shot && previous.shot === current.shot && (previous.shotX !== current.shotX || previous.shotY !== current.shotY)) projectileSteps += 1; }
  assert.ok(enemySteps > 10, '怪物在回包之间应连续运动'); assert.ok(projectileSteps > 5, '投射物在回包之间应连续运动');
  const total = intervals.reduce((sum, value) => sum + value, 0); const gameFrames = frames.at(-1).frame - frames[0].frame; const fps = gameFrames * 1000 / total; const sorted = [...intervals].sort((a, b) => a - b); const p95 = sorted[Math.floor(sorted.length * 0.95)];
  assert.ok(fps > 45, '后台测试浏览器应保持基本流畅'); assert.equal(errors.length, 0);
  const screenshotPath = new URL('combat.png', output).pathname.replace(/^\/(\w:)/, '$1'); await page.screenshot({ path: screenshotPath });
  const report = { artificialOneWayDelayMs: delay, baselineResponseMs: baseline.responseMs, delayedResponseMs: delayed.responseMs, fps, frameP95Ms: p95, continuousEnemyFrames: enemySteps, continuousProjectileFrames: projectileSteps, browserErrors: errors };
  const text = JSON.stringify(report, null, 2); const reportUrl = new URL('report.json', output); await writeFile(reportUrl, text); console.log(text);
} catch (error) { for (const client of clients) console.error(await client.page.locator('body').innerText()); throw error; }
finally { await browser.close(); }
