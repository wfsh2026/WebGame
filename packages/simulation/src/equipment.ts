import { activationSlotLevels, activationSlots, characterSlots } from './adventure-progression';
export interface EquipmentLoadout { heart: string | null; slots: (EquipmentBranch | null)[] }
export interface EquipmentBranch { itemId: string; supports: (string | null)[] }
export interface EquipmentItem { skillType?: 'melee' | 'ranged'; experience?: number; damage?: number; coefficient?: number; speed?: number; range?: number; projectiles?: number; requiresProjectile?: boolean; delivery?: 'projectile' | 'nova' | 'melee'; description?: string; effect?: string; level?: number; baseLevel?: number; definitionId?: string; capacityGrowth?: number; recoveryGrowth?: number; angle?: number; width?: number; knockback?: number; id: string; name: string; kind: 'heart' | 'skill' | 'support'; slots: number; capacity: number; recovery: number; interval: number; cost: number; supportSlots: number; costMultiplier: number; damageMultiplier: number; host: string }
export interface EquipmentSupport { id: string; name: string; host: 'melee' | 'ranged'; costMultiplier: number; damageMultiplier: number }
export interface EquipmentConfig { equipmentDefinitions?: EquipmentItem[]; supportDefinitions?: EquipmentSupport[]; heart: { slots?: number; capacity: number; recovery: number; interval: number }; meleeSkill: { interval: number; cost: number; supportSlots?: number; coefficient?: number; speed?: number; range?: number }; rangedSkill: { interval: number; cost: number; supportSlots?: number; coefficient?: number; range?: number }; support: { costMultiplier: number; damageMultiplier: number; host?: string } }

export const equipmentIds = { heart: 'forest-survival:heart/wind', melee: 'forest-survival:skill/melee-starter', ranged: 'forest-survival:skill/ranged-starter', support: 'forest-survival:support/energy-saving', overload: 'forest-survival:support/overload' };

export const starterEquipmentIds = ['forest-survival:heart/stream', 'forest-survival:skill/longblade', 'forest-survival:support/economy'];

// 首包原有的起始装备，各一件；拆卸只解除绑定，不创建或销毁物品。
export function equipmentCatalog(config: EquipmentConfig): EquipmentItem[] {
  const base = { slots: 0, capacity: 0, recovery: 0, interval: 0, cost: 0, supportSlots: 0, costMultiplier: 1, damageMultiplier: 1, host: '' };
  if (config.equipmentDefinitions?.some(item => item.effect === 'slash')) return config.equipmentDefinitions.map(item => itemAtLevel(item, 1));
  const additional: EquipmentItem[] = (config.supportDefinitions ?? []).map((item): EquipmentItem => ({ ...base, ...item, kind: 'support' }));
  return [
    { ...base, ...config.heart, slots: config.heart.slots ?? 2, id: equipmentIds.heart, name: '逐风心法', kind: 'heart' },
    { ...base, ...config.meleeSkill, supportSlots: config.meleeSkill.supportSlots ?? 1, id: equipmentIds.melee, name: '近战技能', kind: 'skill', skillType: 'melee', delivery: 'melee' },
    { ...base, ...config.rangedSkill, supportSlots: config.rangedSkill.supportSlots ?? 1, id: equipmentIds.ranged, name: '回风震', delivery: 'nova', kind: 'skill', skillType: 'ranged' },
    { ...base, ...config.support, host: config.support.host ?? 'melee', id: equipmentIds.support, name: '节能辅助', kind: 'support' },
    ...additional,
    ...(config.equipmentDefinitions ?? [])
  ];
}

export function defaultEquipment(config: EquipmentConfig): EquipmentLoadout {
  if (config.equipmentDefinitions?.some(item => item.effect === 'slash')) return { heart: starterEquipmentIds[0], slots: [{ itemId: starterEquipmentIds[1], supports: [starterEquipmentIds[2]] }] };
  const slots: EquipmentLoadout['slots'] = [];
  const count = config.heart.slots ?? 2;
  for (let index = 0; index < count; index += 1) {
    if (index > 1) { slots.push(null); continue; }
    const ability = index === 0 ? config.meleeSkill : config.rangedSkill;
    const supports: (string | null)[] = [];
    const host = index === 0 ? 'melee' : 'ranged';
    const supportHost = config.support.host ?? 'melee';
    const supportCount = ability.supportSlots ?? 1;
    for (let socket = 0; socket < supportCount; socket += 1) supports.push(socket === 0 && host === supportHost ? equipmentIds.support : null);
    const itemId = index === 0 ? equipmentIds.melee : equipmentIds.ranged;
    slots.push({ itemId, supports });
  }
  return { heart: equipmentIds.heart, slots };
}

export function equippedIds(loadout: EquipmentLoadout): string[] {
  const ids: string[] = [];
  if (loadout.heart) ids.push(loadout.heart);
  for (const slot of loadout.slots) {
    if (!slot) continue;
    ids.push(slot.itemId);
    for (const id of slot.supports) if (id) ids.push(id);
  }
  return ids;
}

export function equipmentError(loadout: EquipmentLoadout, context: { catalog: EquipmentItem[]; ownedIds: string[]; characterLevel?: number }): string {
  if (!loadout.heart) return loadout.slots.length ? '未装备心法时不能连接能力' : '';
  const capacity = context.characterLevel === undefined ? undefined : characterSlots(context.characterLevel);
  const heart = context.catalog.find(item => item.id === loadout.heart && item.kind === 'heart');
  if (!heart || loadout.slots.length !== (capacity?.abilities ?? heart.slots)) return '能力槽数量与心法不符';
  const ids = equippedIds(loadout);
  const unique = new Set(ids);
  if (unique.size !== ids.length) return '同一件装备不能重复装配';
  if (ids.some(id => !context.ownedIds.includes(id))) return '包含未拥有的装备';
  for (const slot of loadout.slots) {
    if (!slot) continue;
    const ability = context.catalog.find(item => item.id === slot.itemId);
    if (!ability || (ability.kind !== 'skill')) return '能力槽只能装备技能';
    if (slot.supports.length !== (capacity?.supports ?? ability.supportSlots)) return '辅助槽数量与所属能力不符';
    const definitions = new Set<string>();
    for (const id of slot.supports) {
      if (!id) continue;
      const support = context.catalog.find(item => item.id === id && item.kind === 'support');
      if (!support || !supportAssignable(support, ability)) return '辅助与所属能力不兼容';
      const definition = support.definitionId ?? support.id;
      if (definitions.has(definition)) return '同一能力不能装配同名辅助';
      definitions.add(definition);
    }
  }
  return '';
}

export function equipmentRuntime(loadout: EquipmentLoadout, config?: EquipmentConfig, instances?: BuildItem[]) {
  const catalog = config ? buildCatalog(config, instances) : [];
  const heartItem = catalog.find(item => item.id === loadout.heart && item.kind === 'heart');
  const branches = [];
  for (const [branchIndex, slot] of loadout.slots.entries()) {
    if (!slot || !heartItem || branchIndex >= heartItem.slots) continue;
    const item = catalog.find(entry => entry.id === slot.itemId);
    if (!item || (item.kind !== 'skill')) continue;
    let costMultiplier = heartCostMultiplier(heartItem); let damageMultiplier = 1; let projectiles = 1; let intervalMultiplier = 1; let areaMultiplier = 1; let knockback = item.knockback ?? 0; const supportLevels: Record<string, number> = {}; const accents: string[] = []; const accentLevels: Record<string, number> = {}; let resonance = 0; let fork = 0; let unleash = 0; let echo = 0; let spread = 0;
    const activeSupports = slot.supports.slice(0, item.supportSlots);
    const supportIds: string[] = [];
    for (const id of activeSupports) {
      const support = catalog.find(entry => entry.id === id && entry.kind === 'support');
      if (support && supportCompatible(support, item)) {
        supportIds.push(support.id);
        if (support.effect) supportLevels[support.effect] = support.level ?? 1;
        if (support.effect && ['economy', 'overload', 'haste', 'knockback'].includes(support.effect)) { accents.push(support.effect); accentLevels[support.effect] = support.level ?? 1; }
        costMultiplier *= support.costMultiplier; damageMultiplier *= support.damageMultiplier; projectiles *= support.projectiles ?? 1;
        const level = support.level ?? 1; const progress = supportProgress(level);
        if (support.effect === 'fork') fork = level;
        if (support.effect === 'unleash') unleash = level;
        if (support.effect === 'aftershock') echo = level;
        if (support.effect === 'execution-spread') spread = level;
        if (support.effect === 'resonance') resonance = .15 + .15 * progress;
        if (support.effect === 'haste') intervalMultiplier *= .9 - .15 * progress;
        if (support.effect === 'area') areaMultiplier *= 1.15 + .2 * progress;
        if (support.effect === 'concentrate') areaMultiplier *= .75 - .05 * progress;
        if (support.effect === 'knockback') knockback += .25 + .25 * progress;
      }
    }
    branches.push({ item, supportIds, costMultiplier, damageMultiplier, projectiles, intervalMultiplier, areaMultiplier, knockback, supportLevels, accents, accentLevels, resonance, fork, unleash, echo, spread });
  }
  return { heartItem, branches, heart: Boolean(heartItem) || loadout.heart === equipmentIds.heart };
}

export interface BuildItem { experience?: number; id: string; definitionId: string; level: number; bonus: number }

const legacyIds: Record<string, string> = {
  'forest-survival:heart/wind': 'forest-survival:heart/stream',
  'forest-survival:weapon/wind-arrow': 'forest-survival:skill/longblade',
  'forest-survival:skill/wind-nova': 'forest-survival:skill/fireball',
  'forest-survival:weapon/blade': 'forest-survival:skill/flying-blade',
  'forest-survival:weapon/swift-blade': 'forest-survival:skill/dual-blades',
  'forest-survival:support/energy-saving': 'forest-survival:support/economy',
  'forest-survival:support/weapon-economy': 'forest-survival:support/economy',
  'forest-survival:support/spell-economy': 'forest-survival:support/economy'
};
export function canonicalEquipmentId(id: string): string { const resolved = legacyIds[id] ?? id; return resolved.replace(':weapon/', ':skill/'); }
export function itemAtLevel(item: EquipmentItem, requested: number): EquipmentItem {
  const maximum = 20;
  const bounded = Math.min(maximum, requested); const level = Math.max(1, bounded);
  const result = { ...item, level, baseLevel: level };
  const extra = level - 1;
  if (item.kind === 'heart') {
    result.slots = activationSlots(level);
    result.capacity += (item.capacityGrowth ?? 0) * extra;
    result.recovery += (item.recoveryGrowth ?? 0) * extra;
    if (item.id.endsWith('/spring')) result.interval *= level >= 10 ? .8 : level >= 5 ? .9 : 1;
    if (item.id.endsWith('/ocean')) result.capacity *= level >= 10 ? 1.25 : level >= 5 ? 1.12 : 1;
  } else if (item.kind === 'skill') {
    result.supportSlots = activationSlots(level);
    result.coefficient = (item.coefficient ?? 0) * (1 + .08 * Math.min(extra, 9) + .04 * Math.max(0, extra - 9));
    result.damage = (item.damage ?? 0) * (1 + .08 * Math.min(extra, 9) + .04 * Math.max(0, extra - 9));
  } else {
    const progress = supportProgress(level);
    if (item.effect === 'economy') { result.costMultiplier = .8 - .15 * progress; result.damageMultiplier = .9 + .05 * progress; }
    if (item.effect === 'overload') { result.costMultiplier = 1.5; result.damageMultiplier = 1.3 + .2 * progress; }
    if (item.effect === 'area') result.damageMultiplier = .9 + .05 * progress;
    if (item.effect === 'multiple') { result.projectiles = level >= 5 ? 5 : level >= 3 ? 4 : 3; result.costMultiplier = level >= 5 ? 2 : level >= 3 ? 1.8 : 1.6; result.damageMultiplier = .55 + .15 * progress; }
    if (item.effect === 'fork') { result.costMultiplier = 1.3; result.damageMultiplier = .85 + .04 * progress; }
    if (item.effect === 'unleash') { result.costMultiplier = 1.25; result.damageMultiplier = .95 + .02 * progress; }
    if (item.effect === 'aftershock') { result.costMultiplier = 1.3; result.damageMultiplier = .8 + .05 * progress; }
    if (item.effect === 'execution-spread') { result.costMultiplier = 1.15; result.damageMultiplier = .9 + .04 * progress; }
    if (item.effect === 'knockback') result.costMultiplier = 1.1;
    if (item.effect === 'concentrate') { result.costMultiplier = 1.2; result.damageMultiplier = 1.25 + .15 * progress; }
    if (item.effect === 'duration') result.costMultiplier = 1.2;
    if (item.effect === 'linger') result.costMultiplier = 1.15;
  }
  return result;
}
export function isBanner(effect?: string): boolean { return Boolean(effect?.startsWith('banner-')); }
export function supportAssignable(support: EquipmentItem, ability: EquipmentItem): boolean {
  const future = { ...ability, level: 20 };
  return supportCompatible(support, future);
}

export function supportCompatible(support: EquipmentItem, ability: EquipmentItem): boolean {
  if (isBanner(ability.effect)) return ['economy', 'overload', 'area', 'haste', 'duration', 'linger', 'twin', 'concentrate'].includes(support.effect ?? '') && (support.host === 'both' || support.host === 'ranged');
  if (['duration', 'linger', 'twin'].includes(support.effect ?? '')) return false;
  if (support.effect === 'homing') {
    const effects = ['fireball', 'frost', 'thunder-seal', 'blade', 'sword-array'];
    const compatible = effects.includes(ability.effect ?? '');
    return ability.skillType === 'ranged' && ability.delivery === 'projectile' && compatible;
  }
  if (support.effect === 'unleash' && ability.effect === 'sword-array') return false;
  if (support.effect === 'fork' && !['blade', 'star', 'frost', 'sword-array'].includes(ability.effect ?? '')) return false;
  if (support.effect === 'unleash' && (ability.skillType !== 'ranged' || ability.delivery !== 'projectile')) return false;
  if (support.effect === 'aftershock' && !['hammer', 'fireball', 'binding-trap'].includes(ability.effect ?? '')) return false;
  if (support.effect === 'execution-spread' && !['frost', 'thunder-seal', 'decay-curse'].includes(ability.effect ?? '')) return false;
  if (support.host !== 'both' && support.host !== ability.skillType) return false;
  if ((support.requiresProjectile || support.effect === 'multiple') && ability.delivery !== 'projectile') return false;
  if (support.effect === 'area' || support.effect === 'concentrate') {
    const conditional = ['dual', 'frost'].includes(ability.effect ?? '');
    if (conditional && (ability.level ?? 1) < 5) return false;
    if (!conditional && !['slash', 'spear', 'hammer', 'fireball', 'thunder-staff', 'star-beam', 'binding-trap'].includes(ability.effect ?? '')) return false;
  }
  return true;
}
export function buildCatalog(config: EquipmentConfig, instances?: BuildItem[]): EquipmentItem[] {
  const catalog = equipmentCatalog(config);
  if (!instances) return catalog;
  const result: EquipmentItem[] = [];
  for (const instance of instances) {
    const definitionId = canonicalEquipmentId(instance.definitionId);
    const definition = config.equipmentDefinitions?.find(item => item.id === definitionId) ?? catalog.find(item => item.id === definitionId);
    if (!definition) continue;
    const level = instance.level + instance.bonus;
    const item = itemAtLevel(definition, level);
    result.push({ ...item, id: instance.id, definitionId, baseLevel: instance.level, experience: instance.experience ?? 0 });
  }
  return result;
}
export function fitLoadout(loadout: EquipmentLoadout, catalog: EquipmentItem[], characterLevel?: number): EquipmentLoadout {
  const capacity = characterLevel === undefined ? undefined : characterSlots(characterLevel);
  return fitEquipment(loadout, catalog, capacity);
}

export function fitBuildLoadout(loadout: EquipmentLoadout, catalog: EquipmentItem[]): EquipmentLoadout {
  const capacity = { abilities: activationSlotLevels.length, supports: activationSlotLevels.length };
  return fitEquipment(loadout, catalog, capacity);
}

function fitEquipment(loadout: EquipmentLoadout, catalog: EquipmentItem[], capacity?: { abilities: number; supports: number }): EquipmentLoadout {
  const heart = catalog.find(item => item.id === loadout.heart && item.kind === 'heart');
  if (!heart) return { heart: null, slots: [] };
  const occupied = new Set<string>([heart.id]); const slots: EquipmentLoadout['slots'] = [];
  for (let index = 0; index < (capacity?.abilities ?? heart.slots); index += 1) {
    const original = loadout.slots[index]; const ability = catalog.find(item => item.id === original?.itemId);
    if (!ability || !original || ability.kind !== 'skill' || occupied.has(ability.id)) { slots.push(null); continue; }
    occupied.add(ability.id); const supports: (string | null)[] = []; const definitions = new Set<string>();
    for (let socket = 0; socket < (capacity?.supports ?? ability.supportSlots); socket += 1) {
      const id = original.supports[socket]; const support = catalog.find(item => item.id === id && item.kind === 'support');
      const definitionId = support?.definitionId ?? support?.id ?? '';
      if (support && !occupied.has(support.id) && !definitions.has(definitionId) && supportAssignable(support, ability)) {
        supports.push(support.id); occupied.add(support.id); definitions.add(definitionId);
      } else supports.push(null);
    }
    slots.push({ itemId: ability.id, supports });
  }
  return { heart: heart.id, slots };
}
export function migrateLoadout(loadout: EquipmentLoadout, config: EquipmentConfig, options?: { items?: BuildItem[]; characterLevel?: number }): EquipmentLoadout {
  const savedIds = options?.items?.map(item => item.id) ?? [];
  const instanceIds = new Set(savedIds);
  const normalize = (id: string): string => instanceIds.has(id) ? id : canonicalEquipmentId(id);
  const heart = loadout.heart ? normalize(loadout.heart) : null;
  const slots = loadout.slots.map(slot => {
    if (!slot) return null;
    const itemId = normalize(slot.itemId);
    const supports = slot.supports.map(id => id ? normalize(id) : null);
    return { itemId, supports };
  });
  const catalog = buildCatalog(config, options?.items); const migrated = { heart, slots };
  return fitLoadout(migrated, catalog, options?.characterLevel);
}

export function supportProgress(level: number): number { return Math.min(level - 1, 4) / 4 + Math.max(0, level - 5) / 60; }
export function itemExperienceNeeded(level: number): number { return level >= 20 ? 0 : level < 12 ? 200 : level < 15 ? 300 : level < 18 ? 400 : 500; }
export function trainBuildItem(item: BuildItem): void {
  const level = item.level + item.bonus;
  if (level >= 20) return;
  if (level < 10) { item.bonus += 1; return; }
  item.experience = (item.experience ?? 0) + 100;
  let required = itemExperienceNeeded(item.level + item.bonus);
  while (item.level + item.bonus < 20 && item.experience >= required) {
    item.experience -= required; item.bonus += 1; required = itemExperienceNeeded(item.level + item.bonus);
  }
  if (item.level + item.bonus >= 20) item.experience = 0;
}
export function trainingLabel(item: EquipmentItem): string {
  const level = item.level ?? 1;
  if (level >= 20) return '已满级';
  if (level < 10) return `Lv.${level} → Lv.${level + 1}`;
  const required = itemExperienceNeeded(level); const current = item.experience ?? 0; const next = current + 100;
  return `修习 +100 · ${current}/${required} → ${Math.min(next, required)}/${required}${next >= required ? ` · 升至 Lv.${level + 1}` : ''}`;
}

export function abilityDemand(branch: ReturnType<typeof equipmentRuntime>['branches'][number], speed: number): number {
  const interval = branch.item.interval * branch.intervalMultiplier / speed;
  if (branch.item.effect === 'star-beam') { const cycle = Math.max(1.2, interval); return branch.item.cost * branch.costMultiplier * 5 / cycle; }
  return branch.item.cost * branch.costMultiplier / interval;
}

export function heartCapacity(heart: EquipmentItem | undefined, bonus = 0): number {
  if (!heart) return 0;
  return Math.max(1, heart.capacity + bonus);
}
export function heartSupply(heart: EquipmentItem | undefined, bonus = 0): number {
  return heart ? heart.recovery / heart.interval + bonus : 0;
}
export function heartCostMultiplier(heart: EquipmentItem | undefined): number {
  if (!heart) return 1;
  const id = heart.definitionId ?? heart.id; const level = heart.level ?? 1;
  return id.endsWith('/stream') ? level >= 10 ? .85 : level >= 5 ? .92 : 1 : 1;
}

export function equipmentKindName(item: EquipmentItem): string {
  if (item.kind === 'skill') return item.skillType === 'melee' ? '近战技能' : '远程技能';
  return item.kind === 'heart' ? '心法' : '辅助宝石';
}

export function canonicalLoadout(loadout: EquipmentLoadout): EquipmentLoadout {
  const heart = loadout.heart ? canonicalEquipmentId(loadout.heart) : null;
  const slots = loadout.slots.map(slot => {
    if (!slot) return null;
    const itemId = canonicalEquipmentId(slot.itemId);
    const supports = slot.supports.map(id => id ? canonicalEquipmentId(id) : null);
    return { itemId, supports };
  });
  return { heart, slots };
}
