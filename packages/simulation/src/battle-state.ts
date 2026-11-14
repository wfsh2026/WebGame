import type { Simulation } from './index';

export type BattleState = Omit<Simulation, 'config' | 'arena' | 'random' | 'presentationOnly'>;
export interface BattleTransfer { epoch: number; sequence: number; state: BattleState }
export function battleState(sim: Simulation): BattleState {
  const { config, arena, random, presentationOnly, ...state } = sim;
  return state;
}
function record(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function numbers(value: Record<string, unknown>, keys: string): boolean {
  for (const key of keys.split(' ')) if (typeof value[key] !== 'number' || !Number.isFinite(value[key])) return false;
  return true;
}
function strings(value: Record<string, unknown>, keys: string): boolean {
  for (const key of keys.split(' ')) if (typeof value[key] !== 'string') return false;
  return true;
}
function list(value: unknown, check: (entry: unknown) => boolean): boolean { return Array.isArray(value) && value.every(check); }
function point(value: unknown): boolean { return record(value) && numbers(value, 'x y'); }
function enemyAbility(value: unknown): boolean {
  if (value === undefined) return true;
  if (!record(value) || !numbers(value, 'tier phase cycle step windup supportWait') || !strings(value, 'mode')) return false;
  const tier = value.tier; const phase = value.phase;
  return typeof tier === 'number' && tier >= 0 && tier <= 3 && typeof phase === 'number' && phase >= 0 && phase <= 1 && Array.isArray(value.links) && value.links.length <= 2 && value.links.every(id => typeof id === 'string');
}
function enemy(value: unknown): boolean {
  if (!record(value) || !numbers(value, 'x y radius hp maxHp facingX facingY timer') || !strings(value, 'id kind state targetId')) return false;
  const abilities = enemyAbility(value.abilities);
  return abilities && record(value.definition) && numbers(value.definition, 'hp speed radius damage windup recovery reach') && strings(value.definition, 'kind');
}
function guard(value: unknown): boolean {
  if (value === undefined) return true;
  if (!record(value) || !numbers(value, 'windowLeft counterLeft press')) return false;
  const window = value.windowLeft; const counter = value.counterLeft; const press = value.press;
  if (typeof window !== 'number' || typeof counter !== 'number' || typeof press !== 'number') return false;
  const validPress = Number.isInteger(press) && press >= 0 && press <= 2147483647;
  return validPress && window >= 0 && window <= .25 && counter >= 0 && counter <= 10 && typeof value.held === 'boolean' && typeof value.triggered === 'boolean';
}
function player(value: unknown): boolean {
  if (!record(value) || !numbers(value, 'x y hasteLeft focusLeft shieldLeft lootShield energyRecoveryBonus buildRevision level experience upgradeCredits waveCredits choiceSequence facingX facingY hp maxHp energy capacity meleeWait rangedWait dashCooldown heartWait sequence meleeCount rangedCount survivalSeconds reviveRemaining assists kills damage blocked dashLeft dashX dashY')) return false;
  const validGuard = guard(value.guard);
  if (!validGuard) return false;
  if (!strings(value, 'id name meleeState rangedState') || typeof value.connected !== 'boolean' || typeof value.ready !== 'boolean' || typeof value.blocking !== 'boolean' || typeof value.clientDriven !== 'boolean') return false;
  if (!record(value.stats) || !record(value.baseStats) || !record(value.input) || !record(value.loadout) || !record(value.equipment) || !record(value.characterRanks)) return false;
  const statKeys = 'maxHp energyCapacityBonus physicalAttack magicalAttack physicalDefense magicalDefense movementSpeed attackSpeed castingSpeed luck';
  if (!numbers(value.stats, statKeys) || !numbers(value.baseStats, statKeys) || !numbers(value.input, 'x y sequence') || !numbers(value, 'inputAt')) return false;
  const press = value.input.blockPress;
  if (press !== undefined && (typeof press !== 'number' || !Number.isInteger(press) || press < 0 || press > 2147483647)) return false;
  if (!Array.isArray(value.loadout.slots) || !Array.isArray(value.equipment.branches) || !Array.isArray(value.growth)) return false;
  const items = list(value.buildItems, entry => record(entry) && strings(entry, 'id definitionId') && numbers(entry, 'level bonus'));
  const abilities = list(value.abilityStates, entry => record(entry) && strings(entry, 'itemId state') && numbers(entry, 'remaining count'));
  const choices = list(value.choices, entry => record(entry) && numbers(entry, 'id') && Array.isArray(entry.options));
  return items && abilities && choices;
}
function safeValue(value: unknown, depth: number): boolean {
  if (depth > 24) return false;
  if (value === null || value === undefined || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'string') return value.length <= 2048;
  if (Array.isArray(value)) return value.every(item => safeValue(item, depth + 1));
  if (!record(value)) return false;
  for (const key in value) {
    const entry = value[key];
    if (key === '__proto__' || key === 'constructor' || key === 'prototype' || !safeValue(entry, depth + 1)) return false;
  }
  return true;
}
function compositionBatch(value: unknown): boolean {
  if (!record(value) || !strings(value, 'kind mode') || !numbers(value, 'at count angle tier sector') || typeof value.priority !== 'boolean') return false;
  const count = value.count; const tier = value.tier; const at = value.at;
  return typeof count === 'number' && Number.isInteger(count) && count >= 1 && typeof tier === 'number' && tier >= 0 && tier <= 3 && typeof at === 'number' && at >= 0 && at <= 300;
}
function composition(value: unknown): boolean {
  if (value === undefined) return true;
  if (!record(value) || !numbers(value, 'round duration budget spent') || !strings(value, 'name hint signature roster formation')) return false;
  return list(value.batches, compositionBatch);
}
function director(value: unknown): boolean {
  if (value === undefined) return true;
  if (!record(value) || !numbers(value, 'seed') || !record(value.seen) || !Array.isArray(value.history) || value.history.length > 128) return false;
  const seen = Object.values(value.seen);
  if (seen.length > 128 || !seen.every(entry => record(entry) && numbers(entry, 'wave count'))) return false;
  const history = value.history.every(entry => record(entry) && strings(entry, 'signature roster formation') && numbers(entry, 'position'));
  const current = composition(value.current); const next = composition(value.next);
  return history && current && next;
}
/** Validate transport shape, not combat legality; the selected client owns combat. */
export function isBattleTransfer(value: unknown): value is BattleTransfer {
  if (!record(value) || !numbers(value, 'epoch sequence') || !record(value.state) || !safeValue(value, 0)) return false;
  const state = value.state;
  if ('config' in state || 'arena' in state || 'random' in state || 'presentationOnly' in state) return false;
  if (!numbers(state, 'elapsed clock spawnWait spawned nextId round partySize spawnIssued') || typeof state.finished !== 'boolean' || typeof state.success !== 'boolean' || typeof state.waveBossPlanned !== 'boolean') return false;
  if (!record(state.poisonWait) || !record(state.castHits)) return false;
  const waveDirector = director(state.waveDirector);
  if (!waveDirector) return false;
  const experience = list(state.experienceOrbs, entry => record(entry) && strings(entry, 'id playerId') && numbers(entry, 'amount wave bornAt x y') && typeof entry.amount === 'number' && entry.amount > 0 && entry.amount <= 100000 && (entry.flyingAt === undefined || typeof entry.flyingAt === 'number'));
  if (!experience) return false;
  const players = list(state.players, player); const enemies = list(state.enemies, enemy); const defeated = list(state.defeated, enemy);
  const shots = list(state.projectiles, item => record(item) && numbers(item, 'x y vx vy ttl damage') && strings(item, 'id owner'));
  const effects = list(state.effects, item => record(item) && numbers(item, 'x y ttl radius') && strings(item, 'id kind'));
  const hazards = list(state.hazards, item => record(item) && numbers(item, 'x y age delay duration radius damage') && strings(item, 'id kind') && Array.isArray(item.hitIds));
  const queue = list(state.waveQueue, item => record(item) && record(item.definition) && numbers(item, 'at wave healthScale damageScale group expires duration angle'));
  const schedules = list(state.waveSchedules, item => {
    if (!record(item) || !record(item.group) || !numbers(item, 'next interval remaining')) return false;
    return item.batch === undefined || compositionBatch(item.batch);
  });
  const history = list(state.spawnHistory, point);
  return players && enemies && defeated && shots && effects && hazards && queue && schedules && history;
}

export function expandBattleTransfer(value: unknown, previous: Simulation): BattleTransfer | undefined {
  if (!record(value) || !record(value.state) || !Array.isArray(value.state.players) || !Array.isArray(value.state.enemies)) return;
  const players = value.state.players.map(entry => {
    if (!record(entry)) return entry;
    const before = previous.players.find(player => player.id === entry.id);
    if (!before || before.buildRevision !== entry.buildRevision) return entry;
    return { ...entry, equipment: entry.equipment ?? before.equipment, loadout: entry.loadout ?? before.loadout, buildItems: entry.buildItems ?? before.buildItems };
  });
  const entries = previous.enemies.map(enemy => [enemy.id, enemy.definition] as const);
  const definitions = new Map(entries);
  const enemies = value.state.enemies.map(entry => {
    if (!record(entry) || entry.definition) return entry;
    const definition = typeof entry.id === 'string' ? definitions.get(entry.id) : undefined;
    return { ...entry, definition };
  });
  const incoming = value.state.waveDirector;
  const waveDirector = incoming === undefined ? previous.waveDirector : record(incoming) ? { ...previous.waveDirector, ...incoming } : incoming;
  const waveSchedules = value.state.waveSchedules ?? previous.waveSchedules;
  const expanded = { ...value, state: { ...value.state, waveDirector, waveSchedules, players, enemies } };
  return isBattleTransfer(expanded) ? expanded : undefined;
}
