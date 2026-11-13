import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
const packageUrl = new URL('../apps/web/package.json', import.meta.url); const webRequire = createRequire(packageUrl); const { Client } = webRequire('colyseus.js');
const base = 'http://47.117.185.109:8080/online/';
async function post(path, data, token = '') { const body = JSON.stringify(data); const response = await fetch(`${base}api/${path}`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body }); const result = await response.json(); assert.ok(response.ok, result.error); return result; }
const name = `test_guard_${Date.now().toString(36)}`; const credentials = { name, password: 'Forest-test-only-3814' }; const auth = await post('register', credentials); await post('character', { role: 'forest-survival:character/ranger' }, auth.token);
const client = new Client('ws://47.117.185.109:8080/online/room'); const room = await client.create('expedition', { token: auth.token, protocol: '1' }); let state;
room.onMessage('snapshot', value => { if (state?.stage !== value.stage) console.log(value.stage); state = value; });
async function wait(predicate, timeout = 30000) { const deadline = Date.now() + timeout; while (Date.now() < deadline) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 100)); } throw new Error('协议测试等待超时'); }
try {
  await wait(() => Boolean(state)); room.send('ready', true); await wait(() => state.players[0].ready); room.send('start'); await wait(() => state.stage === 'combat');
  const before = state.players[0].x; room.send('input', { sequence: 1, x: 1000000, y: 0, block: false, dash: false }); await new Promise(resolve => setTimeout(resolve, 500)); assert.equal(state.players[0].x, before, '越界输入必须被拒绝');
  room.send('input', { sequence: 2, x: 1, y: 0, block: false, dash: false }); await new Promise(resolve => setTimeout(resolve, 350)); const moved = state.players[0].x - before; assert.ok(moved > 0 && moved < 1.6, '服务端移动必须受速度限制');
  room.send('input', { sequence: 1, x: -1, y: 0, block: false, dash: false }); await new Promise(resolve => setTimeout(resolve, 700)); const stopped = state.players[0].x; await new Promise(resolve => setTimeout(resolve, 400)); assert.equal(state.players[0].x, stopped, '输入超时必须停止移动，过期序号不能覆盖新输入');
  let sequence = 3; const interval = setInterval(() => { sequence += 1; room.send('input', { sequence, x: 0, y: 0, block: true, dash: false }); }, 100);
  await wait(() => state.stage === 'final-result', 240000); clearInterval(interval);
  assert.equal(state.results.length, 1); assert.equal(state.results[0].success, false); assert.equal(state.players[0].hp, 0);
  await room.leave(); const meResponse = await fetch(`${base}api/me`, { headers: { authorization: `Bearer ${auth.token}` } }); const me = await meResponse.json(); assert.equal(me.coins, 0); assert.equal(me.materials, 0);
  const output = new URL('../.cache/online-test/', import.meta.url); await mkdir(output, { recursive: true }); const report = JSON.stringify({ name, moved, invalidInputRejected: true, staleSequenceRejected: true, inputTimeoutStops: true, failureSettled: true, coins: me.coins, materials: me.materials }, null, 2); const reportUrl = new URL('protocol-report.json', output); await writeFile(reportUrl, report); console.log(report);
} finally { if (room.connection.isOpen) await room.leave(); }
