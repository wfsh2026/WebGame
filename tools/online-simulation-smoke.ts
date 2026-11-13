import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { contentSchema } from '@web-game-world/content-schema';
import { createSimulation, makePlayer, beginRound, recoverInHall, setInput, step } from '@web-game-world/simulation';

const url = new URL('../content/packs/forest-survival/manifest.json', import.meta.url); const text = await readFile(url, 'utf8'); const raw: unknown = JSON.parse(text); const config = contentSchema.parse(raw);
const arena = { width: 30, height: 22, spawns: [{ x: 14, y: 10 }, { x: 16, y: 12 }], enemySpawns: [{ x: 2, y: 2 }, { x: 15, y: 2 }, { x: 28, y: 2 }, { x: 28, y: 20 }, { x: 15, y: 20 }, { x: 2, y: 20 }], obstacles: [] };
function isolatedCombat() {
  const random = () => 0.5; const sample = createSimulation({ config, arena, random }); const identity = { id: 'probe', name: 'probe' }; const player = makePlayer(identity, config); sample.players.push(player); sample.spawnWait = 100; return sample;
}
function addElite(sample: ReturnType<typeof createSimulation>, mode: 'windup' | 'recovery'): void {
  const definition = config.enemies[2]; const enemy = { id: 'elite-probe', kind: definition.kind, x: 15, y: mode === 'windup' ? 12 : 13.5, radius: definition.radius, hp: definition.hp, maxHp: definition.hp, state: mode, facingX: 0, facingY: -1, timer: mode === 'windup' ? 0.01 : 100, targetId: 'probe', definition }; sample.enemies.push(enemy);
}
const frontal = isolatedCombat(); addElite(frontal, 'windup'); frontal.players[0].input.block = true; step(frontal, 0.05);
const frontalDamage = 250 - frontal.players[0].hp; const expectedBlocked = 30 * 100 / 105 * 0.3; const blockDifference = Math.abs(frontalDamage - expectedBlocked); assert.ok(blockDifference < 0.00001, '正面格挡应减免 70% 伤害');
const rear = isolatedCombat(); addElite(rear, 'windup'); rear.players[0].facingY = -1; rear.players[0].input.block = true; step(rear, 0.05);
const rearDamage = 250 - rear.players[0].hp; assert.ok(rearDamage > frontalDamage * 3, '背后攻击不能被格挡');
const emptyPool = isolatedCombat(); addElite(emptyPool, 'recovery'); emptyPool.players[0].energy = 2; step(emptyPool, 0.05); assert.equal(emptyPool.projectiles.length, 0); assert.equal(emptyPool.players[0].weaponState, '等待供能'); assert.equal(emptyPool.players[0].skillState, '等待供能');
const concurrent = isolatedCombat(); addElite(concurrent, 'recovery'); step(concurrent, 0.05); assert.equal(concurrent.projectiles.length, 1); assert.equal(concurrent.enemies[0].hp, 200, '武器辅助不能影响技能伤害'); const nova = concurrent.effects.find(effect => effect.kind === 'nova'); assert.ok(nova, '武器与技能应该能在同一时刻独立触发');
const border = isolatedCombat(); border.players[0].x = 0.41; border.players[0].facingX = -1; border.players[0].facingY = 0; border.players[0].input.x = -1; border.players[0].input.dash = true; for (let index = 0; index < 8; index += 1) step(border, 0.05); assert.ok(border.players[0].x >= 0.4, '冲刺不能穿过边界');
let seed = 1234; const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const sim = createSimulation({ config, arena, random });
for (const name of ['甲', '乙']) { const identity = { id: name, name }; const player = makePlayer(identity, config); sim.players.push(player); }
assert.equal(sim.players[0].maxHp, 250); assert.equal(sim.players[0].maxMp, 110);
let sequence = 0;
for (let round = 1; round <= 2; round += 1) {
  beginRound(sim, round);
  for (let frame = 0; frame < 8000 && !sim.finished; frame += 1) {
    sequence += 1;
    for (const [index, player] of sim.players.entries()) {
      const angle = sim.elapsed * 0.18 + index * 0.3; const targetX = 15 + Math.cos(angle) * 8; const targetY = 11 + Math.sin(angle) * 6;
      let x = (targetX - player.x) * 0.3; let y = (targetY - player.y) * 0.3;
      for (const enemy of sim.enemies) { const dx = player.x - enemy.x; const dy = player.y - enemy.y; const squared = dx * dx + dy * dy; if (squared < 16) { const force = 3 / Math.max(0.1, squared); x += dx * force; y += dy * force; } }
      const magnitude = Math.hypot(x, y); if (magnitude > 1) { x /= magnitude; y /= magnitude; }
      const input = { sequence, x, y, block: false, dash: false }; const data = { id: player.id, input }; setInput(sim, data);
    }
    step(sim, 0.05);
    for (const player of sim.players) { assert.ok(player.energy >= 0 && player.energy <= player.capacity); assert.ok(player.mp >= 0 && player.mp <= player.maxMp); assert.ok(player.x >= 0.4 && player.x <= 29.6); }
    assert.ok(sim.enemies.length <= config.maxAlive);
  }
  const players = sim.players.map(player => ({ hp: player.hp, kills: player.kills, energy: player.energy })); const report = JSON.stringify({ round, success: sim.success, seconds: sim.elapsed, spawned: sim.spawned, players }); console.log(report);
  assert.ok(sim.finished, '小秘境必须结束'); assert.ok(sim.success, '自动走位队伍应能完成当前难度');
  recoverInHall(sim); sim.players[0].growth.push('power'); sim.players[1].growth.push('energy');
}
console.log('simulation smoke passed');
