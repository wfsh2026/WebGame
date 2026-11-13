import { equipmentCatalog, grantBuildItem } from '@web-game-world/simulation';
import type { Enemy, EquipmentItem, Player, Simulation } from '@web-game-world/simulation';
import type { LootItemData, LootPickupData, LootStateData } from '@web-game-world/contracts';

const consumables = [
  { id: 'life', name: '生命精华', weight: 35 }, { id: 'energy', name: '灵力结晶', weight: 25 },
  { id: 'mana', name: '魔法露滴', weight: 20 }, { id: 'haste', name: '疾行果实', weight: 8 },
  { id: 'shield', name: '护身符', weight: 7 }, { id: 'focus', name: '聚灵符', weight: 5 }
];
const mechanism: Record<string, number[]> = { tree: [1, 1, 1], wolf: [1.1, 1.1, 1.1], archer: [1, 1.15, 1.15], bomb: [1.2, 1, 1.1], shield: [1.1, 1.25, 1.2], hammer: [1.2, 1.35, 1.3], sower: [1.1, 1.3, 1.4], protector: [1.1, 1.4, 1.4], brood: [1.1, 1.4, 1.4], moth: [1.1, 1.35, 1.4] };

export class GroundLoot {
  ground: LootItemData[] = [];
  pockets = new Map<string, LootStateData>();
  sequence = 0;
  catalog: EquipmentItem[];
  constructor(private sim: Simulation, private picked: (event: LootPickupData) => void) { this.catalog = equipmentCatalog(sim.config); }
  state(id: string): LootStateData {
    let state = this.pockets.get(id);
    if (!state) { state = { revision: 0, safe: [], consumables: [] }; this.pockets.set(id, state); }
    return state;
  }
  tick(): void {
    const defeated = this.sim.defeated.splice(0);
    for (const enemy of defeated) this.drop(enemy);
    if (this.sim.finished) return;
    for (const player of this.sim.players) this.pickup(player);
  }
  private weighted<T>(entries: { value: T; weight: number }[]): T {
    const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = this.sim.random() * total;
    for (const entry of entries) { roll -= entry.weight; if (roll < 0) return entry.value; }
    return entries[entries.length - 1].value;
  }
  private drop(enemy: Enemy): void {
    if (enemy.parentId) return;
    if (enemy.definition.behavior === 'squirrel') {
      this.addConsumable(enemy, 'life'); this.addConsumable(enemy, 'energy'); return;
    }
    const rank = enemy.definition.rank ?? 'normal';
    const base = rank === 'boss' ? [.85, .45, .65] : rank === 'elite' ? [.70, .18, .45] : [.25, .02, .06];
    const multipliers = mechanism[enemy.definition.behavior ?? 'tree'] ?? [1, 1, 1];
    const wave = enemy.bornWave ?? this.sim.round;
    const growth = 1 + .8 * (1 - Math.exp(-(wave - 1) / 40));
    const categories: LootItemData['category'][] = ['consumable', 'insured', 'temporary'];
    for (let index = 0; index < categories.length; index += 1) {
      const chance = Math.min(.90, base[index] * multipliers[index] * growth);
      if (this.sim.random() >= chance) continue;
      if (index === 0) this.addConsumable(enemy);
      else this.addEquipment(enemy, categories[index]);
    }
  }
  private addConsumable(enemy: Enemy, fixed?: string): void {
    const wave = enemy.bornWave ?? this.sim.round; const supplies = (wave - 1) % 10 === 5;
    const entries = consumables.filter(item => !supplies || ['life', 'energy', 'mana'].includes(item.id)).map(item => ({ value: item, weight: item.weight }));
    const selected = fixed ? consumables.find(item => item.id === fixed) : this.weighted(entries);
    if (!selected) return;
    const rank = enemy.definition.rank ?? 'normal'; const level = enemy.definition.behavior === 'squirrel' ? 3 : rank === 'normal' ? 1 : 2;
    const data = { definitionId: `consumable:${selected.id}`, name: selected.name, category: 'consumable' as const, kind: 'consumable', effect: selected.id, level };
    this.place(enemy, data);
  }
  private addEquipment(enemy: Enemy, category: LootItemData['category']): void {
    if (!this.catalog.length) return;
    const behavior = enemy.definition.behavior;
    const favored = behavior === 'hammer' || behavior === 'shield' ? 'weapon' : behavior === 'archer' || behavior === 'moth' ? 'skill' : behavior === 'sower' || behavior === 'protector' ? 'support' : behavior === 'brood' ? 'heart' : '';
    const kinds = [{ value: 'heart', weight: 15 }, { value: 'weapon', weight: 25 }, { value: 'skill', weight: 30 }, { value: 'support', weight: 30 }];
    const weighted = kinds.map(item => ({ ...item, weight: item.weight * (item.value === favored ? 1.5 : 1) }));
    const kind = this.weighted(weighted); const candidates = this.catalog.filter(item => item.kind === kind);
    if (!candidates.length) return;
    const roll = this.sim.random(); const index = Math.floor(roll * candidates.length); const item = candidates[index];
    const wave = enemy.bornWave ?? this.sim.round; const stage = Math.floor((wave - 1) / 10) + 1; const anchor = Math.min(8, stage);
    const grade = this.sim.random(); const rank = enemy.definition.rank;
    const extra = rank === 'boss' ? grade < .5 ? 1 : 2 : rank === 'elite' ? grade < .2 ? 0 : grade < .8 ? 1 : 2 : grade < .8 ? 0 : 1;
    const rawLevel = anchor + extra + (category === 'temporary' ? 1 : 0);
    const scaled = item.kind === 'support' ? Math.ceil(rawLevel / 2) : rawLevel; const cap = 20; const level = Math.min(cap, scaled);
    const data = { definitionId: item.id, name: item.name, category, kind: item.kind, effect: item.effect ?? '', level };
    this.place(enemy, data);
  }
  private place(enemy: Enemy, data: Omit<LootItemData, 'id' | 'wave' | 'x' | 'y'>): void {
    this.sequence += 1;
    const item = { ...data, id: `loot-${this.sequence}`, wave: enemy.bornWave ?? this.sim.round, x: enemy.x, y: enemy.y };
    this.ground.push(item);
  }
  pickup(player: Player): void {
    if (this.sim.finished || player.hp <= 0 || !player.connected) return;
    const state = this.state(player.id); const retained: LootItemData[] = [];
    for (const item of this.ground) {
      const dx = item.x - player.x; const dy = item.y - player.y;
      if (dx * dx + dy * dy > .85 * .85) { retained.push(item); continue; }
      if (item.category === 'temporary') {
        const option = { kind: 'item' as const, itemId: item.definitionId, level: item.level };
        const granted = grantBuildItem(player, option, this.sim.config);
        if (!granted) { retained.push(item); continue; }
      } else if (item.category === 'insured') state.safe.push(item);
      else this.applyConsumable(player, item);
      state.revision += 1;
      const event = { item, playerId: player.id }; this.picked(event);
    }
    this.ground = retained;
  }
  consume(player: Player, id: string): string {
    if (this.sim.finished || player.hp <= 0) return '灵魂状态无法使用消耗品';
    const state = this.state(player.id); const index = state.consumables.findIndex(item => item.id === id);
    if (index < 0) return '物品不存在或已使用';
    const item = state.consumables[index];
    const error = this.applyConsumable(player, item);
    if (error) return error;
    state.consumables.splice(index, 1); state.revision += 1;
    return '';
  }
  private applyConsumable(player: Player, item: LootItemData): string {
    const strong = item.level === 2 ? 1.5 : 1;
    if (item.effect === 'life') {
      const ratio = item.level === 3 ? .25 : .15 * strong;
      player.hp = Math.min(player.maxHp, player.hp + player.maxHp * ratio);
    } else if (item.effect === 'energy') {
      const ratio = item.level === 3 ? .5 : .3 * strong;
      player.energy = Math.min(player.capacity, player.energy + player.capacity * ratio);
    } else if (item.effect === 'mana') {
      player.mp = Math.min(player.maxMp, player.mp + player.maxMp * .2 * strong);
    } else if (item.effect === 'haste') player.hasteLeft = 10;
    else if (item.effect === 'shield') { player.shieldLeft = 10; player.lootShield = player.maxHp * .15; }
    else if (item.effect === 'focus') player.focusLeft = 10;
    else return '未知消耗品';
    return '';
  }
}
