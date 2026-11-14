import assert from 'node:assert/strict';
import { createSimulation, makePlayer, setInput, step } from '@web-game-world/simulation';
import type { Simulation } from '@web-game-world/simulation';
import { PresentationWorld } from '../apps/web/src/game/presentation-world';
import config from '../content/packs/forest-survival/manifest.json';

const arena = { width: 30, height: 22, spawns: [{ x: 15, y: 11 }], enemySpawns: [], obstacles: [] };
const random = () => 0;
const server = createSimulation({ config, arena, random });
const player = makePlayer({ id: 'local', name: 'local' }, config); server.players.push(player); server.spawnWait = 1000;
const definition = config.enemies[2];
server.enemies.push({ id: 'enemy', kind: 'elite', x: 22, y: 11, radius: definition.radius, hp: 230, maxHp: 230, state: 'chase', facingX: -1, facingY: 0, timer: 0, targetId: player.id, definition });
function snapshot(sim: Simulation): Parameters<PresentationWorld['receive']>[0] {
  const players = sim.players.map(item => ({ ...item, growth: [...item.growth] }));
  const enemies = sim.enemies.map(item => ({ ...item })); const projectiles = sim.projectiles.map(item => ({ ...item })); const effects = sim.effects.map(item => ({ ...item }));
  return { protocol: '1', roomId: 'prediction-test', hostId: player.id, stage: 'combat', round: 1, seconds: 180 - sim.elapsed, width: 30, height: 22, players, enemies, projectiles, effects, results: [], error: '', serverTime: sim.clock * 1000 };
}
const world = new PresentationWorld(player.id); const initial = snapshot(server); world.receive(initial, 0);
const input = { sequence: 1, x: 1, y: 0, block: false, dash: false };
world.update(input, 1000 / 60);
assert.ok((world.localPlayer?.x ?? 0) > 15, '没有回包也必须在第一帧响应移动');
assert.equal(world.localPlayer?.meleeCount, 1, '自动攻击不等待服务器回包');
const firstShot = world.simulation.projectiles[0]; const firstShotX = firstShot.x; const firstEnemyX = world.simulation.enemies[0].x;
for (let frame = 0; frame < 5; frame += 1) world.update(input, 1000 / 60);
assert.ok(world.simulation.projectiles[0].x > firstShotX + 0.5, '投射物必须在两次网络快照之间持续移动');
assert.ok(world.simulation.enemies[0].x < firstEnemyX, '怪物必须在两次网络快照之间持续移动');
assert.equal(world.simulation.enemies[0].hp, 230, '预测不能扣除正式生命值');
assert.equal(player.x, 15, '客户端预测不能直接修改服务器模型');
const predictedX = world.localPlayer?.x; const stale = snapshot(server); stale.serverTime = 100; world.receive(stale, 100);
assert.equal(world.localPlayer?.x, predictedX, '旧位置回包不能把本地角色拉回');
step(server, 0.05); const confirmed = snapshot(server); world.receive(confirmed, 110);
assert.equal(world.simulation.projectiles.length, 1, '服务器确认后不能重复生成同一发投射物');
for (let frame = 0; frame < 40; frame += 1) world.update(input, 1000 / 60);
assert.equal(world.simulation.enemies[0].hp, confirmed.enemies[0].hp, '预测命中不能改变服务器生命值');
const hit = snapshot(server); hit.players[0].hp = 123; hit.serverTime = 200; world.receive(hit, 700); assert.equal(world.localPlayer?.hp, 123, '正式生命值必须跟随服务器结果');
const position = { x: 25, y: 10, facingX: 1, facingY: 0 }; const reported = { id: player.id, input: { ...input, sequence: 2, position } }; setInput(server, reported); step(server, 0.05);
assert.equal(player.x, 25, '服务器应接受客户端位置且不再重复推进一次移动');
const beforeDeath = snapshot(server); beforeDeath.players[0].hp = 0; beforeDeath.serverTime = 300; world.receive(beforeDeath, 710); const deadX = world.localPlayer?.x; world.update(input, 100); assert.equal(world.localPlayer?.x, deadX, '死亡后不能继续本地移动');
console.log('prediction passed: first-frame motion, local attacks, continuous projectiles/enemies, no duplicate shots, server-only HP, accepted client movement');
