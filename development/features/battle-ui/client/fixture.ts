import { makePlayer, experienceNeeded } from '@web-game-world/simulation';
import type { AbilityView, BuildStateData, LootItemData, LootStateData, PlayerView, Snapshot } from '../../../../packages/contracts/src/index';
import { protocolVersion } from '../../../../packages/contracts/src/index';
import content from '../../../../apps/web/src/network/content';

export function battleFixture(scenario: string) {
  const definitions = content.equipmentDefinitions ?? []; const effects = ['slash', 'blade', 'fireball', 'frost', 'chain-lightning'];
  const heart = definitions.find(item => item.id === 'forest-survival:heart/stream');
  if (!heart) throw new Error('缺少心法展示数据');
  const selected = effects.map(effect => { const item = definitions.find(entry => entry.effect === effect); if (!item) throw new Error(`缺少技能 ${effect}`); return item; });
  const items = [heart, ...selected].map((item, index) => ({ id: `review-item-${index}`, definitionId: item.id, level: index === 0 ? 20 : 3 + index, bonus: 0 }));
  const slots = selected.map((_, index) => ({ itemId: items[index + 1].id, supports: [null, null, null, null, null] })); const loadout = { heart: items[0].id, slots };
  const abilities: AbilityView[] = selected.map((item, index) => ({ id: items[index + 1].id, name: item.name, kind: 'skill', skillType: item.skillType ?? 'ranged', icon: item.effect ?? '', interval: item.interval, remaining: index === 0 ? .4 : index === 3 ? 1.2 : 0, cost: item.cost, state: index === 2 ? '等待供能' : index === 0 || index === 3 ? '计时中' : '就绪', triggers: 2 }));
  const identity = { id: 'review-player', name: '林地冒险者' }; const local = makePlayer(identity, content);
  const player: PlayerView = { ...local, hp: 186, maxHp: 250, energy: 12, capacity: 40, level: 12, experience: 68, loadout, buildItems: items, buildRevision: 1, abilities, dashCooldown: 1.4, x: 15, y: 13, hasteLeft: 8, focusLeft: 5, lootShield: 40, shieldLeft: 9, survivalSeconds: 436 };
  if (scenario === 'blocked') player.blocking = true;
  if (scenario === 'soul') { player.hp = 0; player.reviveRemaining = 12; }
  if (scenario === 'long') player.name = '林地冒险者与很长很长的角色名称';
  if (scenario === 'empty') { player.abilities = []; player.loadout = { heart: null, slots: [] }; }
  const names = ['青羽', '星萝', '岩守'];
  const teammates = Array.from({ length: scenario === 'solo' ? 0 : scenario === 'crowded' ? 19 : 3 }, (_, index) => {
    const teammate: PlayerView = { ...player, id: `review-team-${index}`, name: names[index] ?? `同行者${index + 1}`, hp: index === 1 ? 0 : 156 + index * 27, maxHp: 220 + index * 30, x: 11 + index % 3 * 4, y: index === 1 ? 13 : 11.5, reviveRemaining: index === 1 ? 12 : 0, blocking: false, dashCooldown: 0, abilities: [] }; return teammate;
  });
  const players = [player, ...teammates]; const round = scenario === 'hell' ? 23 : 7;
  const enemies = Array.from({ length: 15 }, (_, index) => {
    const rank = index === 0 ? 'boss' : index === 1 || index === 2 ? 'elite' : 'normal';
    const definition = content.enemies.find(enemy => enemy.rank === rank) ?? content.enemies[0];
    return { id: `enemy-review-${index}`, kind: definition.kind, x: index === 0 ? 15 : 5 + index * 1.7 % 21, y: index === 0 ? 8.5 : 6 + index % 4 * 3.5, radius: definition.radius, hp: definition.hp * .7, maxHp: definition.hp, state: index === 0 ? 'windup' : 'recovery', facingX: 0, facingY: 1, timer: index === 0 ? .6 : 5, targetId: player.id, attackX: 15, attackY: 13 };
  });
  const preparation = scenario === 'rest' ? { participantIds: players.map(entry => entry.id), readyIds: [], countdown: 0, startedAt: 0, reminded: false } : undefined;
  const snapshot: Snapshot = { protocol: protocolVersion, roomId: 'battle-ui-local', hostId: player.id, stage: 'combat', round, seconds: 45, width: 30, height: 22, players, enemies, projectiles: [], effects: [], results: [], error: '', serverTime: 0, spawnWarnings: [], pendingSpawns: 16, resting: scenario === 'rest', preparation };
  if (scenario === 'hell') snapshot.expedition = { difficulty: 'nightmare', stages: 20, hellStages: 20, hellFloor: 3, baseCleared: true, decision: false, saving: false, continuedIds: [], gifts: {} };
  const options: BuildStateData['choices'][number]['options'] = selected.slice(0, 3).map(item => ({ kind: 'item', itemId: item.id, level: 3 }));
  const build: BuildStateData = { characterLevel: 20, coinsEarned: 120, coinsSpent: 10, characterRanks: {}, revision: 1, level: 12, experience: 68, required: experienceNeeded(12), upgradeCredits: 1, waveCredits: 1, items, loadout, choices: [{ id: 1, source: 'wave', wave: 6, refreshCount: 0, options }, { id: 2, source: 'level', refreshCount: 0, options }] };
  const safe: LootItemData[] = selected.slice(0, 3).map((item, index) => ({ id: `safe-${index}`, definitionId: item.id, name: item.name, category: 'insured', kind: 'skill', effect: item.effect ?? '', skillType: item.skillType, level: 3, wave: 6, x: 8 + index * 3, y: 15 }));
  const loot: LootStateData = { revision: 1, safe, consumables: [] }; snapshot.loot = safe;
  return { snapshot, build, loot };
}
