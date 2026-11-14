import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { contentSchema } from '@web-game-world/content-schema';
import { awardCombatGrowth, battleState, canCollectDrop, createSimulation, dropCombatExperience, experienceFlightSeconds, isBattleTransfer, makePlayer, settleClaimedExperience, step, stepExperience } from '@web-game-world/simulation';
import type { Enemy, Obstacle } from '@web-game-world/simulation';
import { experienceOrbSchema, lootPickupSchema, protocolVersion, snapshotSchema } from '@web-game-world/contracts';
import type { LootPickupData } from '@web-game-world/contracts';
import { GroundLoot } from './loot';

const manifestUrl = new URL('../../../content/packs/forest-survival/manifest.json', import.meta.url);
const source = await readFile(manifestUrl, 'utf8'); const raw: unknown = JSON.parse(source); const config = contentSchema.parse(raw);
const obstacles: Obstacle[] = [];
const arena = { width: 30, height: 22, spawns: [{ x: 5, y: 5 }], enemySpawns: [], obstacles };
const random = () => .5; const options = { config, arena, random }; const sim = createSimulation(options);
const owner = makePlayer({ id: 'owner', name: '击杀者' }, config); const helper = makePlayer({ id: 'helper', name: '助攻者' }, config);
owner.x = 5; owner.y = 5; helper.x = 5; helper.y = 5; owner.energy = 0; helper.energy = 0; sim.players = [owner, helper]; sim.spawnWait = 100;
const definition = config.enemies[0];
const enemy: Enemy = { id: 'kill-check', kind: definition.kind, x: 9, y: 5, radius: definition.radius, hp: 1, maxHp: 1, state: 'recovery', facingX: 0, facingY: 1, timer: 100, targetId: '', definition, contributors: { helper: 0 } };
sim.enemies.push(enemy); sim.projectiles.push({ id: 'shot-check', owner: owner.id, x: 9, y: 5, vx: 0, vy: 0, damage: 100, ttl: 1 }); step(sim, .01);
assert.equal(owner.kills, 1); assert.equal(helper.assists, 1);
assert.equal(owner.experience, 4); assert.equal(helper.experience, 2); assert.equal(sim.experienceOrbs.length, 2);
for (const orb of sim.experienceOrbs) { const parsed = experienceOrbSchema.safeParse(orb); assert.ok(parsed.success); }
// Kill and assist entitlement stay separate; another player cannot collect the owner's orb.
owner.x = 20; helper.x = 9; sim.clock = 1; stepExperience(sim);
const ownOrb = sim.experienceOrbs.find(orb => orb.playerId === owner.id); const assistOrb = sim.experienceOrbs.find(orb => orb.playerId === helper.id);
assert.equal(ownOrb?.flyingAt, undefined); assert.equal(assistOrb?.flyingAt, 1);
sim.clock += experienceFlightSeconds + .01; stepExperience(sim); assert.equal(helper.experience, 4); assert.equal(owner.experience, 4);
// A claimed orb follows the recipient through movement and grants its amount once.
owner.x = 9; sim.clock += .1; stepExperience(sim); owner.x = 15;
sim.clock += experienceFlightSeconds + .01; stepExperience(sim); stepExperience(sim); assert.equal(owner.experience, 8);
// Souls cannot trigger a new pickup. Revival can collect the retained drop.
const reward = { enemy: { ...enemy, id: 'soul-check', x: 15 }, kill: true }; dropCombatExperience(sim, owner, reward);
owner.hp = 0; sim.clock += 1; stepExperience(sim); assert.equal(sim.experienceOrbs[0].flyingAt, undefined);
owner.hp = owner.maxHp; stepExperience(sim); assert.notEqual(sim.experienceOrbs[0].flyingAt, undefined);
sim.clock += 1; stepExperience(sim); assert.equal(owner.experience, 12);
// Upgrade threshold conserves the pre-change total (two full kills = 16 XP).
awardCombatGrowth(sim, owner, true); assert.equal(owner.level, 2); assert.equal(owner.experience, 0); assert.equal(owner.upgradeCredits, 1);
// A wall blocks both experience attraction and shared item pickup.
arena.obstacles.push({ x: 5.4, y: 4, width: .2, height: 2 });
const left = { x: 5, y: 5 }; const right = { x: 5.8, y: 5 }; const blocked = canCollectDrop(arena, left, right); assert.equal(blocked, false);
const clear = canCollectDrop(arena, left, { x: 5, y: 7 }); assert.equal(clear, true);
owner.x = 5; owner.y = 5; helper.x = 5; helper.y = 5;
const receipts: LootPickupData[] = []; const picked = (event: LootPickupData) => { receipts.push(event); }; const loot = new GroundLoot(sim, picked);
const item = { id: 'shared-check', definitionId: 'consumable:life', name: '生命精华', category: 'consumable' as const, kind: 'consumable', effect: 'life', level: 1, wave: 1, x: 5.8, y: 5 };
loot.ground = [item]; loot.pickup(owner); assert.equal(receipts.length, 0); assert.equal(loot.ground.length, 1);
arena.obstacles = []; owner.hp = owner.maxHp / 2; loot.pickup(owner); loot.pickup(helper);
assert.equal(receipts.length, 1); assert.equal(loot.ground.length, 0); assert.equal(receipts[0].recoveredHp, owner.maxHp * .15);
const parsedReceipt = lootPickupSchema.safeParse(receipts[0]); assert.ok(parsedReceipt.success);
// A checkpoint retains uncollected XP during ownership transfer and validates its shape.
const checkpoint = battleState(sim); const packet = { epoch: 1, sequence: 1, state: checkpoint }; const valid = isBattleTransfer(packet); assert.ok(valid);
const invalid = structuredClone(packet); invalid.state.experienceOrbs = [{ id: 'bad', playerId: owner.id, amount: -1, wave: 1, bornAt: 0, x: 1, y: 1 }]; const rejected = isBattleTransfer(invalid); assert.equal(rejected, false);
const view = { protocol: protocolVersion, roomId: 'transport-check', hostId: owner.id, stage: 'combat', round: 1, seconds: 0, width: 30, height: 22, players: sim.players, enemies: [], projectiles: [], effects: [], results: [], error: '', serverTime: 1, battleClock: sim.clock, experienceOrbs: sim.experienceOrbs };
const snapshot = snapshotSchema.parse(view); assert.equal(snapshot.players[0].level, 2); assert.equal(snapshot.players[0].experience, 0);
// Scene termination settles claimed XP once, without awarding ground drops.
sim.experienceOrbs = [{ id: 'claimed', playerId: owner.id, amount: 4, wave: 1, bornAt: 0, flyingAt: sim.clock, x: 5, y: 5 }, { id: 'unclaimed', playerId: owner.id, amount: 4, wave: 1, bornAt: 0, x: 5, y: 5 }];
settleClaimedExperience(sim); settleClaimedExperience(sim); assert.equal(owner.experience, 4); assert.equal(sim.experienceOrbs.length, 0);
console.log('loot-growth checks passed: real kill/assist, personal XP, absorption, duplicate prevention, revival, upgrade, obstacles, shared pickup and transport');
