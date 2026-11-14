import type { BuildStateData, LootStateData, Snapshot } from '@web-game-world/contracts';
import { awardHellGrowth, awardWaveGrowth, chooseGrowth, createSimulation, expeditionBaseReward, expeditionCoinMultiplier, experienceNeeded, initializeBuild, makePlayer, prepareComposition, waveCompositionView } from '@web-game-world/simulation';
import type { Player, Simulation } from '@web-game-world/simulation';
import content from '../../../../apps/web/src/network/content';
import { rewardPreview } from '../../../../apps/web/src/online/reward-preview';

export interface PreviewState {
  sim: Simulation;
  solo: boolean;
  connected: boolean;
  saving: boolean;
  readyIds: string[];
  reminded: boolean;
  continued: boolean;
  gifts: number;
  countdown: number;
  phase: 'rest' | 'combat' | 'result' | 'lobby';
  loot: LootStateData;
  before: Map<string, number>;
  receipts: { title: string; source: string }[];
}

export function createPreview(scenario: string): PreviewState {
  const round = ['decision', 'hell', 'hell-layer'].includes(scenario) ? scenario === 'hell-layer' ? 23 : 20 : 6;
  let seed = 71;
  const random = (): number => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const arena = { width: 30, height: 22, spawns: [{ x: 15, y: 11 }], enemySpawns: [], obstacles: [] };
  const config = { ...content, difficulty: 'normal' as const };
  const options = { config, arena, random };
  const sim = createSimulation(options);
  const identity = { id: 'growth-design', name: '旅行者' };
  const player = makePlayer(identity, content);
  const ids = ['forest-survival:heart/stream', 'forest-survival:skill/fireball', 'forest-survival:skill/flying-blade', 'forest-survival:support/economy'];
  const items = ids.map(id => ({ id, definitionId: id, level: 4, bonus: 0 }));
  player.loadout = { heart: ids[0], slots: [{ itemId: ids[1], supports: [ids[3]] }, { itemId: ids[2], supports: [] }] };
  const setup = { ids, items, config: content };
  initializeBuild(player, setup);
  player.level = 8; player.hp = 175; player.coinsEarned = round >= 20 ? 360 : 120; player.coinsSpent = 0;
  player.upgradeCredits = 2; player.choiceSequence = 2;
  player.choices = [
    { id: 1, source: 'level', earnedLevel: 7, options: [{ kind: 'upgrade', itemId: ids[0], level: 5 }, { kind: 'character', itemId: 'vitality', level: 1 }, { kind: 'upgrade', itemId: ids[1], level: 5 }] },
    { id: 2, source: 'level', earnedLevel: 8, options: [{ kind: 'upgrade', itemId: ids[1], level: 5 }, { kind: 'character', itemId: 'mana', level: 1 }, { kind: 'upgrade', itemId: ids[2], level: 5 }] }
  ];
  sim.players = [player]; sim.round = round; sim.preparing = true;
  awardWaveGrowth(sim);
  const wave = player.choices.find(choice => choice.source === 'wave');
  if (wave && round === 6) wave.options = [{ kind: 'item', itemId: 'forest-survival:skill/chain-lightning', level: 2 }, { kind: 'item', itemId: 'forest-survival:support/homing', level: 3 }, { kind: 'refine', itemId: 'skill', level: 1 }];
  const solo = scenario === 'solo';
  if (!solo) {
    const companions = ['青岚', '林间客'].map((name, index) => { const identity = { id: `companion-${index}`, name }; return makePlayer(identity, content); });
    sim.players.push(...companions);
  }
  sim.partySize = sim.players.length;
  prepareComposition(sim);
  const safe: LootStateData['safe'] = [
    { id: 'insured-heart', definitionId: 'forest-survival:heart/ocean', name: '沧海心法', category: 'insured', kind: 'heart', effect: '', level: 2, wave: round, x: 0, y: 0 },
    { id: 'insured-skill', definitionId: 'forest-survival:skill/frost', name: '寒棘术', category: 'insured', kind: 'skill', effect: 'frost', level: 3, wave: 5, x: 0, y: 0 }
  ];
  const before = new Map(player.buildItems.map(item => [item.id, item.level + item.bonus]));
  const model: PreviewState = { sim, solo, connected: scenario !== 'reconnect', saving: scenario === 'saving', readyIds: solo ? [] : ['companion-0'], reminded: false, continued: false, gifts: 0, countdown: 0, phase: 'rest', loot: { revision: 1, safe, consumables: [] }, before, receipts: [] };
  if (scenario === 'poor') player.coinsSpent = 118;
  if (['done', 'hell', 'hell-layer'].includes(scenario)) {
    while (player.choices.length) {
      const choice = player.choices[0];
      const state = buildView(player);
      const context = { state, player, choice };
      const view = rewardPreview(choice.options[0], context);
      const request = { choiceId: choice.id, index: 0 };
      const error = chooseGrowth(sim, player, request);
      if (error) break;
      const title = choice.options[0].kind === 'item' ? `${view.title}已领取到储备` : `${view.title} · ${view.headline}`;
      model.receipts.push({ title, source: choice.source === 'wave' ? '波次奖励' : '等级成长' });
    }
  }
  if (scenario === 'hell') { model.continued = true; model.gifts = 5; awardHellGrowth(sim, player); }
  return model;
}

export function buildView(player: Player): BuildStateData {
  const required = experienceNeeded(player.level);
  return { characterLevel: 8, coinsEarned: player.coinsEarned ?? 0, coinsSpent: player.coinsSpent ?? 0, characterRanks: { ...player.characterRanks }, revision: player.buildRevision, level: player.level, experience: player.experience, required, upgradeCredits: player.upgradeCredits, waveCredits: player.waveCredits, items: player.buildItems.map(item => ({ ...item })), loadout: player.loadout, choices: [...player.choices] };
}

export function snapshotView(model: PreviewState): Snapshot {
  const player = model.sim.players[0];
  const round = model.sim.round;
  const saving = model.saving;
  const current = waveCompositionView(model.sim.waveDirector?.current);
  const next = waveCompositionView(model.sim.waveDirector?.next);
  const preparation = { readyIds: model.readyIds, participantIds: model.sim.players.map(player => player.id), countdown: model.countdown, startedAt: 0, reminded: model.reminded };
  const gifts = { [player.id]: model.gifts };
  const expedition = { difficulty: 'normal' as const, stages: 20, hellStages: 20, hellFloor: Math.max(0, round - 20), baseCleared: round >= 20, decision: round >= 20 && model.phase === 'rest', saving, continuedIds: model.continued ? [player.id] : [], gifts };
  const baseReward = expeditionBaseReward(round);
  const multiplier = expeditionCoinMultiplier(model.sim.config, round);
  const income = Math.floor(baseReward * multiplier + 16);
  const earned = player.coinsEarned ?? 0;
  const previous = { id: player.id, kills: 8, damage: 980, survivalSeconds: 45, assists: 4, coinsEarned: earned - income, coinsSpent: 0, safe: model.loot.safe.slice(1) };
  const latest = { id: player.id, kills: 12, damage: 1860, survivalSeconds: 45, assists: 7, coinsEarned: earned, coinsSpent: 0, safe: model.loot.safe };
  return { protocol: 'preview', roomId: 'local-design', hostId: player.id, stage: model.phase === 'result' ? 'final-result' : 'combat', round, seconds: model.countdown, width: 30, height: 22, players: model.sim.players, enemies: [], projectiles: [], effects: [], results: [{ round: round - 1, success: true, players: [previous] }, { round, success: true, players: [latest] }], error: '', serverTime: 0, resting: model.phase === 'rest', preparation, expedition, wavePlans: { current, next } };
}
