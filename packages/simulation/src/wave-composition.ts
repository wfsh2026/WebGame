import { expeditionBudget, expeditionFloor, expeditionWave } from './expedition';
import type { EnemyDefinition, SimConfig, Simulation } from './index';

export type WavePattern = 'sweep' | 'alternating' | 'surge' | 'formation' | 'elite' | 'supplies' | 'boss';
export interface CompositionRules { pattern: WavePattern; budget: number; batches: number; recovery: number }
export interface CompositionBatch { at: number; kind: string; count: number; angle: number; tier: number; priority: boolean; mode: 'scattered' | 'edge' | 'special'; sector: number }
export interface WaveComposition { round: number; name: string; hint: string; duration: number; budget: number; spent: number; signature: string; roster: string; formation: string; batches: CompositionBatch[] }
export interface EnemyCoverage { wave: number; count: number }
export interface CompositionHistory { signature: string; roster: string; formation: string; position: number }
export interface WaveDirector { seed: number; seen: Record<string, EnemyCoverage>; history: CompositionHistory[]; current?: WaveComposition; next?: WaveComposition }
interface CandidateContext { config: SimConfig; director: WaveDirector; round: number; partySize: number; attempt: number }
interface RosterEntry { definition: EnemyDefinition; count: number; tier: number; cost: number }

export const waveSpawnCountMultiplier = 1.8;

const costs: Record<string, number> = { tree: 1, wolf: 2, hammer: 4, shield: 3, archer: 2, bomb: 3, sower: 4, protector: 4, brood: 5, moth: 4, squirrel: 0 };
const patternHints: Record<WavePattern, string> = {
  sweep: '两侧分批进入，留意最后一批切入', alternating: '左右交替进攻，横向避开已锁定的攻击',
  surge: '三批敌潮递进，清出路线后拾取成长', formation: '前后两层进场，从侧面接近远程与机制目标',
  elite: '精英提前登场，增援与精英攻击错峰', supplies: '松鼠提供补给，少量敌人分批进入',
  boss: '首领先登场，随从分段加入，末段集中输出'
};

export function waveCycleLength(config: SimConfig): number {
  if (config.expedition) return config.expedition.stages;
  return config.cycleWaves ? config.waves?.length || 10 : 10;
}

function hash(seed: number, value: string): number {
  let result = seed >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    result = Math.imul(result ^ code, 16777619) >>> 0;
  }
  return result;
}

function compositionId(value: string): string {
  const first = hash(2166136261, value); const second = hash(2246822519, value);
  return `${first}-${second}`;
}

function orderedPool(context: CandidateContext, rank: string): EnemyDefinition[] {
  const pool = context.config.enemies.filter(enemy => enemy.behavior !== 'squirrel' && (enemy.rank ?? 'normal') === rank);
  pool.sort((first, second) => {
    const a = context.director.seen[first.kind]; const b = context.director.seen[second.kind];
    const age = (a?.wave ?? 0) - (b?.wave ?? 0);
    if (age) return age;
    const count = (a?.count ?? 0) - (b?.count ?? 0);
    if (count) return count;
    const firstKey = `${context.round}:${context.attempt}:${first.kind}`;
    const secondKey = `${context.round}:${context.attempt}:${second.kind}`;
    const firstHash = hash(context.director.seed, firstKey); const secondHash = hash(context.director.seed, secondKey);
    return firstHash - secondHash;
  });
  return pool;
}

function entryCost(definition: EnemyDefinition): number {
  const base = costs[definition.behavior ?? 'tree'] ?? 3;
  const factor = definition.rank === 'boss' ? 5 : definition.rank === 'elite' ? 2.5 : 1;
  return base * factor;
}

function synergyCost(roster: RosterEntry[]): number {
  const behaviors = roster.map(entry => entry.definition.behavior);
  let cost = Math.max(0, roster.length - 3) * .5;
  if (behaviors.includes('shield') && behaviors.includes('archer')) cost += 2;
  if (behaviors.includes('protector')) cost += 2;
  if (behaviors.includes('sower') && (behaviors.includes('wolf') || behaviors.includes('bomb'))) cost += 2;
  if (behaviors.includes('brood') && behaviors.includes('moth')) cost += 2;
  return cost;
}

function buildRoster(context: CandidateContext, rules: CompositionRules): { roster: RosterEntry[]; budget: number; spent: number } {
  const length = waveCycleLength(context.config);
  const selectedWave = expeditionWave(context.config, context.round);
  const maximum = selectedWave?.count ?? 80;
  const divisor = context.config.expedition ? 5 : length;
  const cycle = Math.floor((context.round - 1) / divisor);
  const progress = 1 + .06 * (context.round - 1);
  const growth = Math.sqrt(progress);
  const population = 1 + (context.partySize - 1) * .3;
  const reserved = rules.pattern === 'supplies' ? 1 : 0;
  const limit = Math.floor(maximum * growth * population);
  const difficultyBudget = expeditionBudget(context.config, context.round);
  const budget = rules.budget * growth * population * difficultyBudget;
  const unitBudget = budget / 1.15;
  const pool = orderedPool(context, 'normal');
  const key = `${cycle}:${rules.pattern}:${context.attempt}`;
  const variation = hash(context.director.seed, key);
  const diversityRange = Math.max(1, pool.length);
  const desired = Math.min(pool.length, 1 + (variation + cycle * 3) % diversityRange);
  const tier = Math.min(3, cycle);
  const roster: RosterEntry[] = [];
  let spent = 0;
  if (rules.pattern === 'elite' || rules.pattern === 'boss') {
    const rank = rules.pattern === 'boss' ? 'boss' : 'elite';
    const ranked = orderedPool(context, rank);
    const specials = ranked.filter(enemy => { const cost = entryCost(enemy); return cost <= unitBudget; });
    const introductory = rules.pattern === 'boss' ? 'tree' : 'hammer';
    const first = cycle === 0 ? specials.find(enemy => enemy.behavior === introductory) : undefined;
    const definition = first ?? specials[0];
    if (definition && limit > 0) {
      const cost = entryCost(definition);
      roster.push({ definition, count: 1, tier, cost }); spent += cost;
    }
  }
  const floor = expeditionFloor(context.config, context.round);
  const setting = context.config.difficulty;
  const hellProgress = Math.max(0, floor - 1); const hellShare = Math.min(.3, .2 + hellProgress * .01);
  const eliteShare = floor > 0 ? hellShare : setting === 'nightmare' ? .15 : setting === 'hard' ? .08 : 0;
  const eliteBudget = unitBudget * eliteShare; let eliteSpent = 0;
  const elites = orderedPool(context, 'elite');
  for (const definition of elites) {
    const cost = entryCost(definition);
    if (eliteSpent + cost > eliteBudget || spent + cost > unitBudget || roster.length >= limit) continue;
    roster.push({ definition, count: 1, tier, cost }); eliteSpent += cost; spent += cost;
  }
  // Coverage is selected before filling quantities, so small mixed rosters remain possible.
  for (const definition of pool) {
    const normalCount = roster.filter(entry => entry.definition.rank !== 'boss' && entry.definition.rank !== 'elite').length;
    if (normalCount >= desired || roster.length >= limit) break;
    const base = entryCost(definition);
    const cost = rules.pattern === 'surge' ? base * .65 : base;
    const enhanced = cycle > 0 && roster.length % 3 === 0 ? tier : 0;
    const candidate = { definition, count: 1, tier: enhanced, cost: cost * (enhanced > 0 ? 1.2 : 1) };
    const entries = [...roster, candidate]; const surcharge = synergyCost(entries);
    if (spent + candidate.cost + surcharge > unitBudget) continue;
    roster.push(candidate); spent += candidate.cost;
  }
  const surcharge = synergyCost(roster); spent += surcharge;
  const normal = roster.filter(entry => entry.definition.rank !== 'elite' && entry.definition.rank !== 'boss');
  let total = roster.length;
  // The cycle also varies concentrated and diverse quantity distributions.
  const concentrated = variation % 3 === 0;
  const favored = variation % Math.max(1, normal.length);
  while (total < limit && normal.length) {
    let selected: RosterEntry | undefined; let best = Infinity;
    for (const [index, entry] of normal.entries()) {
      if (spent + entry.cost > unitBudget) continue;
      const weight = concentrated && index === favored ? 4 : 1;
      const score = entry.count * entry.cost / weight;
      if (score < best) { selected = entry; best = score; }
    }
    if (!selected) break;
    selected.count += 1; total += 1; spent += selected.cost;
  }
  // 按完成后的整波总量扩充普通增援，保底目标计入原始总量。
  const originalCounts = normal.map(entry => entry.count);
  const target = Math.ceil((total + reserved) * waveSpawnCountMultiplier) - reserved;
  while (total < target && normal.length) {
    let selected = normal[0]; let lowestRatio = Infinity;
    for (const [index, entry] of normal.entries()) {
      const ratio = entry.count / originalCounts[index];
      if (ratio < lowestRatio) { selected = entry; lowestRatio = ratio; }
    }
    selected.count += 1; spent += selected.cost; total += 1;
  }
  const expandedBudget = budget * waveSpawnCountMultiplier;
  const requiredBudget = spent * 1.15;
  const finalBudget = Math.max(expandedBudget, requiredBudget);
  return { roster, budget: finalBudget, spent };
}

function buildBatches(context: CandidateContext, data: { roster: RosterEntry[]; rules: CompositionRules; duration: number }): CompositionBatch[] {
  const { roster, rules, duration } = data;
  const key = `${context.round}:${context.attempt}:formation`;
  const variation = hash(context.director.seed, key);
  const orientation = variation % 4;
  const cutoff = duration - rules.recovery;
  const batches: CompositionBatch[] = [];
  const ordinary = roster.filter(entry => entry.definition.rank !== 'elite' && entry.definition.rank !== 'boss');
  for (const entry of roster) {
    const special = entry.definition.rank === 'elite' || entry.definition.rank === 'boss';
    if (!special) continue;
    const at = rules.pattern === 'boss' ? 0 : 2;
    batches.push({ at, kind: entry.definition.kind, count: entry.count, angle: -Math.PI / 2, tier: entry.tier, priority: true, mode: 'special', sector: 0 });
  }
  // Each lane shares an anchor and orientation. Formation support enters behind its front line.
  for (let batch = 0; batch < rules.batches; batch += 1) {
    const fraction = rules.batches === 1 ? 0 : batch / (rules.batches - 1);
    const opening = rules.pattern === 'boss' || rules.pattern === 'elite' ? 5 : 0;
    const at = opening + fraction * Math.max(0, cutoff - opening - 3);
    const side = (orientation + (batch % 2) * 2) % 4;
    const angle = side * Math.PI / 2;
    for (const [index, entry] of ordinary.entries()) {
      const portion = Math.floor(entry.count / rules.batches);
      const remainder = entry.count % rules.batches;
      const firstBatch = index % rules.batches;
      const distance = (batch - firstBatch + rules.batches) % rules.batches;
      const count = portion + (distance < remainder ? 1 : 0);
      if (!count) continue;
      const behavior = entry.definition.behavior;
      const support = behavior === 'archer' || behavior === 'protector' || behavior === 'brood' || behavior === 'moth' || behavior === 'sower';
      const offset = rules.pattern === 'formation' && support ? 1.5 : index * .25;
      const time = Math.min(cutoff - 1, at + offset);
      const mode = rules.pattern === 'surge' || rules.pattern === 'alternating' ? 'edge' : 'scattered';
      const sector = rules.pattern === 'formation' ? batch : batch * 2 + index % 2;
      batches.push({ at: time, kind: entry.definition.kind, count, angle, tier: entry.tier, priority: distance === 0, mode, sector });
    }
  }
  if (rules.pattern === 'supplies') {
    const squirrel = context.config.enemies.find(enemy => enemy.behavior === 'squirrel' && enemy.rank === 'normal');
    if (squirrel) batches.push({ at: 2, kind: squirrel.kind, count: 1, angle: orientation * Math.PI / 2, tier: 0, priority: true, mode: 'special', sector: 0 });
  }
  batches.sort((first, second) => first.at - second.at);
  return batches;
}

function simultaneousCost(batches: CompositionBatch[], roster: RosterEntry[]): number {
  const entries = roster.map(entry => [entry.definition.kind, entry.cost] as const);
  const costsByKind = new Map(entries);
  let peak = 0;
  for (const first of batches) {
    let nearby = 0;
    for (const second of batches) {
      const difference = second.at - first.at;
      if (difference < 0 || difference > 3 || second.sector !== first.sector) continue;
      const cost = costsByKind.get(second.kind) ?? 0;
      nearby += second.count * cost;
    }
    peak = Math.max(peak, nearby);
  }
  return peak * .15;
}

function candidatePlan(context: CandidateContext): WaveComposition | undefined {
  const wave = expeditionWave(context.config, context.round); const rules = wave?.composition;
  if (!wave || !rules) return;
  const result = buildRoster(context, rules);
  const data = { roster: result.roster, rules, duration: wave.interval };
  const batches = buildBatches(context, data);
  const overlap = simultaneousCost(batches, result.roster);
  const spent = result.spent + overlap;
  const rosterParts = result.roster.map(entry => `${entry.definition.kind}:${entry.count}:${entry.tier}`);
  rosterParts.sort(); const roster = rosterParts.join('|');
  const parts = batches.map(batch => `${batch.kind}:${batch.count}:${batch.at}:${batch.angle}:${batch.tier}`);
  const script = parts.join('|');
  const signature = compositionId(script);
  const positions = batches.map(batch => `${batch.at}:${batch.angle}:${batch.sector}`);
  const placement = positions.join('|'); const formation = compositionId(placement);
  const title = wave.name ?? '混合进攻';
  const hint = patternHints[rules.pattern];
  const kinds = batches.map(batch => batch.kind); const unique = new Set(kinds);
  const name = `${title} · ${unique.size}种组合`;
  return { round: context.round, name, hint, duration: wave.interval, budget: result.budget, spent, signature, roster, formation, batches };
}

export function composeWave(sim: Simulation, data: { director: WaveDirector; round: number }): WaveComposition | undefined {
  const length = waveCycleLength(sim.config); const position = (data.round - 1) % length;
  const history = [...data.director.history]; history.reverse();
  const previous = history.find(entry => entry.position === position);
  let result: WaveComposition | undefined;
  for (let attempt = 0; attempt < 32; attempt += 1) {
    const context = { config: sim.config, director: data.director, round: data.round, partySize: sim.partySize, attempt };
    result = candidatePlan(context);
    if (!result) return;
    const duplicate = data.director.history.some(entry => entry.signature === result?.signature);
    if (!duplicate && result.roster !== previous?.roster && result.formation !== previous?.formation) return result;
  }
  return result;
}

export function recordCompositionSpawn(sim: Simulation, definition: EnemyDefinition): void {
  const director = sim.waveDirector;
  if (!director) return;
  const previous = director.seen[definition.kind];
  director.seen[definition.kind] = { wave: sim.round, count: (previous?.count ?? 0) + 1 };
}

export function refreshCompositionPreview(sim: Simulation): void {
  const director = sim.waveDirector;
  if (!director?.current) return;
  const options = { director, round: sim.round + 1 };
  const maximum = sim.config.expedition ? sim.config.expedition.stages + sim.config.expedition.hellStages : Infinity;
  director.next = options.round <= maximum ? composeWave(sim, options) : undefined;
}

export function waveCompositionView(plan?: WaveComposition): (Omit<WaveComposition, 'signature' | 'roster' | 'formation'> & { id: string }) | undefined {
  if (!plan) return;
  const { signature, roster, formation, ...view } = plan;
  return { ...view, id: signature };
}

export function prepareComposition(sim: Simulation): WaveComposition | undefined {
  if (!sim.waveDirector) {
    const roll = sim.random(); const seed = Math.floor(roll * 0xffffffff);
    sim.waveDirector = { seed, seen: {}, history: [] };
  }
  const director = sim.waveDirector;
  const options = { director, round: sim.round };
  const maximum = sim.config.expedition ? sim.config.expedition.stages + sim.config.expedition.hellStages : Infinity;
  if (sim.round > maximum) return;
  const current = director.next?.round === sim.round ? director.next : composeWave(sim, options);
  if (!current) return;
  director.current = current;
  const length = waveCycleLength(sim.config); const position = (sim.round - 1) % length;
  director.history.push({ signature: current.signature, roster: current.roster, formation: current.formation, position });
  if (director.history.length > 128) director.history.shift();
  const seen = { ...director.seen };
  for (const batch of current.batches) {
    const previous = seen[batch.kind];
    seen[batch.kind] = { wave: sim.round, count: (previous?.count ?? 0) + batch.count };
  }
  const projected = { ...director, seen };
  const nextOptions = { director: projected, round: sim.round + 1 };
  director.next = nextOptions.round <= maximum ? composeWave(sim, nextOptions) : undefined;
  return current;
}
