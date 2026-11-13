import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createSimulation, makePlayer, beginRound, step, survivalScore } from '@web-game-world/simulation';
import { contentSchema } from '@web-game-world/content-schema';

const url = new URL('../content/packs/forest-survival/manifest.json', import.meta.url);
const text = await readFile(url, 'utf8');
const raw: unknown = JSON.parse(text);
const config = contentSchema.parse(raw);
const arena = { width: 30, height: 22, spawns: [{ x: 15, y: 11 }], enemySpawns: [{ x: 2, y: 2 }], obstacles: [] };
function sample() {
  const random = () => .5;
  const sim = createSimulation({ config, arena, random });
  const identity = { id: 'survivor', name: '生存验证' };
  const player = makePlayer(identity, config);
  sim.players.push(player); beginRound(sim, 1);
  return sim;
}
const deadline = sample(); deadline.elapsed = 179.98; deadline.players[0].survivalSeconds = 179.98;
const definition = config.enemies[0];
deadline.enemies.push({ id: 'remaining-enemy', kind: definition.kind, x: 2, y: 2, radius: definition.radius, hp: 45, maxHp: 45, state: 'chase', facingX: 0, facingY: 1, timer: 0, targetId: 'survivor', definition });
step(deadline, .05);
assert.equal(deadline.success, true); assert.equal(deadline.elapsed, 180); assert.equal(deadline.enemies.length, 0);
assert.equal(deadline.players[0].survivalSeconds, 180);
const endedTime = deadline.elapsed; step(deadline, .05); assert.equal(deadline.elapsed, endedTime);
const dead = sample(); dead.players[0].hp = 0; dead.players[0].survivalSeconds = 45;
step(dead, .05); assert.equal(dead.success, false); assert.equal(dead.finished, true); assert.equal(dead.players[0].survivalSeconds, 45);
const personal = sample(); const second = makePlayer({ id: 'fallen', name: '倒下验证' }, config);
second.hp = 0; second.survivalSeconds = 30; personal.players.push(second); step(personal, .05);
assert.equal(second.survivalSeconds, 30); assert.equal(personal.players[0].survivalSeconds, .05);
const predicted = sample(); predicted.presentationOnly = true; step(predicted, .05);
assert.equal(predicted.players[0].survivalSeconds, 0); assert.equal(predicted.finished, false);
const first = survivalScore(60); const secondMinute = survivalScore(120) - first; const thirdMinute = survivalScore(180) - survivalScore(120);
assert.ok(secondMinute > first); assert.ok(thirdMinute > secondMinute);
console.log('通过：到时无需清场、存活时长封顶、倒下停表、个人计时独立、预测不决定成果、后期生存成绩递增');
