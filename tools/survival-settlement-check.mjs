import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';

const environmentText = await readFile('.cache/battle-ui/environment.json', 'utf8');
const environment = JSON.parse(environmentText);
const databaseUrl = new URL(environment.DATABASE_URL);
const developmentDatabase = databaseUrl.pathname.startsWith('/battle_dev_');
assert.equal(databaseUrl.hostname, '127.0.0.1'); assert.ok(developmentDatabase);
process.env.DATABASE_URL = environment.DATABASE_URL;
const packageUrl = new URL('../apps/api-server/package.json', import.meta.url);
const require = createRequire(packageUrl); const { PrismaClient } = require('@prisma/client'); const database = new PrismaClient();
const origin = 'http://127.0.0.1:3211'; const stamp = Date.now().toString(36);
async function post(path, options) {
  const body = JSON.stringify(options.body);
  const response = await fetch(origin + path, { method: 'POST', headers: { 'content-type': 'application/json', ...options.headers }, body });
  assert.equal(response.status, 200); return response.json();
}
const internalHeaders = { 'x-internal-secret': environment.INTERNAL_SECRET };
try {
  const accounts = [];
  for (let index = 0; index < 2; index += 1) {
    const account = await post('/api/register', { body: { name: `reward_${stamp}_${index}`, password: `Reward-${stamp}-test` } });
    const headers = { authorization: `Bearer ${account.token}` };
    await post('/api/character', { headers, body: { role: 'forest-survival:character/ranger' } }); accounts.push(account.profile);
  }
  const runId = randomUUID(); const players = accounts.map(account => account.id);
  await post('/internal/runs', { headers: internalHeaders, body: { id: runId, roomId: `settlement-${stamp}`, contentVersion: '1.1.0', ruleVersion: '1', players } });
  const result = { round: 1, success: false, players: [{ id: players[0], kills: 0, damage: 0, survivalSeconds: 30 }, { id: players[1], kills: 0, damage: 0, survivalSeconds: 120 }] };
  const submission = { runId, result };
  await post('/internal/rounds', { headers: internalHeaders, body: submission });
  await post('/internal/rounds', { headers: internalHeaders, body: submission });
  const first = await post('/internal/finish', { headers: internalHeaders, body: { runId } });
  const repeated = await post('/internal/finish', { headers: internalHeaders, body: { runId } });
  assert.deepEqual(first, repeated);
  const early = first.rewards.find(reward => reward.id === players[0]); const later = first.rewards.find(reward => reward.id === players[1]);
  assert.ok(later.coins > early.coins); assert.equal(early.materials, 0); assert.equal(later.materials, 0);
  const personalCount = await database.personalRoundRecord.count({ where: { runId } });
  const ledgerCount = await database.assetLedger.count({ where: { runId } });
  assert.equal(personalCount, 2); assert.equal(ledgerCount, 2);
  for (const reward of first.rewards) {
    const account = await database.account.findUniqueOrThrow({ where: { id: reward.id } }); assert.equal(account.coins, reward.coins);
  }
  const report = { failureSettled: true, longerSurvivalEarnsMore: true, personalCount, ledgerCount, repeatedSettlementSafe: true, rewards: first.rewards };
  const serialized = JSON.stringify(report, null, 2); await writeFile('.cache/battle-ui/settlement-report.json', serialized); console.log(serialized);
} finally { await database.$disconnect(); }
