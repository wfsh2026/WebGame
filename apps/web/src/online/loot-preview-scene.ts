import Phaser from 'phaser';
import { awardCombatGrowth, createSimulation, dropCombatExperience, experienceNeeded, grantExperience, makePlayer, stepExperience } from '@web-game-world/simulation';
import type { Player, Simulation } from '@web-game-world/simulation';
import { protocolVersion } from '@web-game-world/contracts';
import type { LootItemData, LootPickupData, Snapshot } from '@web-game-world/contracts';
import content from '../network/content';
import arenaUrl from '../../../../content/packs/forest-survival/assets/arena-readable.webp';
import { BattleEntities } from '../game/battle-entities';
import { LootView } from '../game/loot-view';
import { lootColorNames } from '../game/loot-art';
import { LevelEffects } from '../game/level-effects';
import { CombatSound } from '../game/combat-sound';
import type { SceneBridge } from '../game/online-scene';

export interface PreviewState { level: number; experience: number; required: number; groundExperience: number; flights: number; landed: number; distance: number }
export class LootPreviewScene extends Phaser.Scene {
  private sim!: Simulation;
  private bridge!: SceneBridge;
  private state!: Snapshot;
  private loot!: LootView;
  private entities!: BattleEntities;
  private levels!: LevelEffects;
  private terrain!: Phaser.GameObjects.Image;
  private labels: Phaser.GameObjects.Text[] = [];
  private keys: Record<string, Phaser.Input.Keyboard.Key> = {};
  private soundEffects = new CombatSound();
  private sequence = 0;
  private collected = 0;
  private movement = false;
  private defeated = false;
  private lootKind = 'melee';
  private published = 0;
  private distance = 0;
  constructor(private report: (state: PreviewState) => void, private picked?: (event: LootPickupData) => void) { super({ key: 'loot-preview' }); }
  preload(): void { BattleEntities.preload(this); this.load.image('preview-arena', arenaUrl); }
  create(): void {
    const arena = { width: 18, height: 10, spawns: [{ x: 9, y: 6 }], enemySpawns: [], obstacles: [] };
    const random = () => .5; const options = { config: content, arena, random }; this.sim = createSimulation(options);
    const identity = { id: 'preview-player', name: '你' }; const player = makePlayer(identity, content); player.x = 9; player.y = 6.5; this.sim.players = [player];
    this.state = { protocol: protocolVersion, roomId: 'loot-preview', hostId: player.id, stage: 'combat', round: 1, seconds: 0, width: 18, height: 10, players: this.sim.players, enemies: [], projectiles: [], effects: [], results: [], error: '', serverTime: 0, loot: [] };
    this.bridge = { current: this.state, playerId: player.id, pickups: [], lootTarget: () => undefined, lootLanded: () => { this.collected += 1; }, send: () => {} };
    this.terrain = this.add.image(0, 0, 'preview-arena'); this.terrain.setOrigin(0); this.terrain.setDepth(-2);
    this.loot = new LootView(this, this.bridge); this.loot.pickups.sound = this.soundEffects;
    this.entities = new BattleEntities(this); this.levels = new LevelEffects(this); this.levels.sound = this.soundEffects;
    for (let index = 0; index < 5; index += 1) { const text = `${lootColorNames[index]} · Lv.${index * 4 + 1}`; const label = this.add.text(0, 0, text, { fontFamily: 'Microsoft YaHei', fontSize: '14px', color: '#fff0ca', stroke: '#14251c', strokeThickness: 4 }); label.setOrigin(.5); label.setDepth(15); this.labels.push(label); }
    const keyboard = this.input.keyboard;
    if (keyboard) for (const code of ['W', 'A', 'S', 'D', 'SHIFT']) this.keys[code] = keyboard.addKey(code, false);
    this.game.canvas.tabIndex = 0; this.game.canvas.setAttribute('aria-label', '掉落效果测试区域，WASD移动，Shift加速');
    this.input.on('pointerdown', () => { this.game.canvas.focus(); this.soundEffects.unlock(); });
    this.resetDemo();
    this.events.once('shutdown', () => { this.loot.reset(); this.levels.reset(); this.entities.dispose(); this.soundEffects.dispose(); });
  }
  private player(): Player { return this.sim.players[0]; }
  private position(index: number) {
    return this.scale.width < 600 ? { x: 1.7 + index % 3 * 3.8, y: index < 3 ? 2 : 4.7 } : { x: 2.5 + index * 3.25, y: 2.8 };
  }
  private item(index: number): LootItemData {
    this.sequence += 1; const position = this.position(index);
    const supplies = this.lootKind === 'life' || this.lootKind === 'energy';
    const kind = supplies ? 'consumable' : this.lootKind === 'melee' || this.lootKind === 'ranged' ? 'skill' : this.lootKind;
    const skillType = this.lootKind === 'melee' ? 'melee' : this.lootKind === 'ranged' ? 'ranged' : undefined;
    const names: Record<string, string> = { melee: '回旋斩', ranged: '远程技能', heart: '心法', support: '辅助宝石', life: '生命精华', energy: '灵力结晶' };
    return { ...position, id: `preview-loot-${this.sequence}`, definitionId: `preview:${this.lootKind}`, name: names[this.lootKind], category: supplies ? 'consumable' : 'temporary', kind, skillType, effect: this.lootKind, level: index * 4 + 1, wave: 1 };
  }
  setLootKind(kind: string): void { this.lootKind = kind; this.resetDemo(); }
  resetDemo(): void {
    if (!this.loot) return;
    this.loot.reset(); this.levels.reset(); this.bridge.pickups = []; this.sim.experienceOrbs = []; this.sim.effects = [];
    const player = this.player(); player.level = 9; player.experience = 0; player.upgradeCredits = 0; player.choices = []; player.x = this.scale.width < 600 ? this.scale.width / 64 : 9; player.y = this.scale.width < 600 ? 8.4 : 6.5;
    this.collected = 0; this.distance = 0; this.movement = false;
    this.defeated = false;
    this.state.loot = [];
    for (let index = 0; index < 5; index += 1) { const item = this.item(index); this.state.loot.push(item); }
    this.publish();
  }
  collectAll(): void {
    this.soundEffects.unlock();
    const playerId = this.player().id;
    for (const item of this.state.loot ?? []) {
      const event = { item, playerId, recoveredHp: item.effect === 'life' ? 38 : 0, recoveredEnergy: item.effect === 'energy' ? 24 : 0 };
      this.receivePickup(event);
    }
    this.state.loot = [];
    for (const orb of this.sim.experienceOrbs) orb.flyingAt ??= this.sim.clock;
  }
  collectBurst(): void {
    if (!this.sim) return;
    const playerId = this.player().id;
    for (let index = 0; index < 100; index += 1) {
      const item = this.item(index % 5); item.y += Math.floor(index / 5) * .03;
      const event = { item, playerId, recoveredHp: item.effect === 'life' ? 38 : 0, recoveredEnergy: item.effect === 'energy' ? 24 : 0 };
      this.receivePickup(event);
    }
  }
  private receivePickup(event: LootPickupData): void { this.bridge.pickups.push(event); this.picked?.(event); }
  previewNotice(kind: string, level = 15): void {
    if (!this.sim) return;
    const names: Record<string, string> = { skill: '奔雷链', heart: '周天诀', support: '多重投射', haste: '疾行果实', focus: '聚灵符', shield: '护身符', life: '生命精华', energy: '灵力结晶', mana: '灵力露滴', fullLife: '生命精华', fullEnergy: '灵力结晶' };
    const equipment = ['skill', 'heart', 'support'].includes(kind);
    const effect = kind === 'fullLife' ? 'life' : kind === 'fullEnergy' ? 'energy' : kind;
    const base = this.item(2); const player = this.player();
    const item: LootItemData = { ...base, x: player.x - 2.2, y: player.y - .8, definitionId: `preview:${effect}`, name: names[kind], kind: equipment ? kind : 'consumable', skillType: kind === 'skill' ? 'ranged' : undefined, category: equipment ? 'temporary' : 'consumable', effect, level: equipment ? level : 1 };
    const event = { item, playerId: player.id, recoveredHp: kind === 'life' ? 38 : 0, recoveredEnergy: kind === 'energy' || kind === 'mana' ? 24 : 0, grantedShield: kind === 'shield' ? 45 : undefined };
    this.receivePickup(event);
  }
  defeat(): void {
    this.soundEffects.unlock(); this.sequence += 1;
    this.defeated = true;
    const definition = content.enemies[0]; const player = this.player();
    const enemy = { id: `preview-enemy-${this.sequence}`, kind: definition.kind, x: player.x - 2.7, y: player.y + .2, radius: definition.radius, hp: 0, maxHp: definition.hp, state: 'dead', facingX: 0, facingY: 1, timer: 0, targetId: '', definition };
    awardCombatGrowth(this.sim, player, true); const reward = { enemy, kill: true }; dropCombatExperience(this.sim, player, reward);
    this.publish();
  }
  upgrade(): void { const player = this.player(); const amount = experienceNeeded(player.level) - player.experience; this.soundEffects.unlock(); grantExperience(this.sim, player, amount); this.publish(); }
  setLevel(level: number): void { const player = this.player(); player.level = level; player.experience = 0; player.choices = []; player.upgradeCredits = 0; this.levels.reset(); this.publish(); }
  toggleMovement(): void { this.movement = !this.movement; }
  private publish(): void {
    const player = this.player(); const required = experienceNeeded(player.level); const groundExperience = this.sim.experienceOrbs.reduce((sum, orb) => sum + orb.amount, 0);
    this.report({ level: player.level, experience: player.experience, required, groundExperience, flights: this.loot.pickups.activeFlights, landed: this.collected, distance: this.distance });
  }
  update(time: number, delta: number): void {
    if (!this.sim) return;
    const player = this.player(); const before = { x: player.x, y: player.y };
    const dt = Math.min(.05, delta / 1000); this.sim.clock += dt;
    const mobile = this.scale.width < 600; const center = mobile ? this.scale.width / 64 : 9; const baseY = mobile ? 8.4 : 6.5;
    if (this.movement) { player.x = center + Math.sin(time / 420) * 2; player.y = baseY + Math.cos(time / 650) * .8; }
    else {
      const focused = document.activeElement === this.game.canvas;
      const dx = focused ? Number(this.keys.D?.isDown) - Number(this.keys.A?.isDown) : 0; const dy = focused ? Number(this.keys.S?.isDown) - Number(this.keys.W?.isDown) : 0;
      const speed = this.keys.SHIFT?.isDown ? 9 : 3;
      player.x = Phaser.Math.Clamp(player.x + dx * dt * speed, .5, 17.5); player.y = Phaser.Math.Clamp(player.y + dy * dt * speed, .5, 9.5);
    }
    const travelled = Math.hypot(player.x - before.x, player.y - before.y); this.distance += travelled;
    stepExperience(this.sim);
    for (const effect of this.sim.effects) effect.ttl -= dt;
    this.sim.effects = this.sim.effects.filter(effect => effect.ttl > 0);
    const width = this.scale.width; const height = this.scale.height; const unit = Math.max(32, width / 18);
    const viewport = { unit, ox: 0, oy: Math.max(0, (height - unit * 10) / 2) };
    this.terrain.setDisplaySize(width, height); this.loot.render(this.state, viewport, this.sim); this.entities.begin(viewport);
    const appearance = { texture: 'ranger', radius: .4, label: '你', color: 0xf0d68a, mine: true }; this.entities.render(player, appearance);
    const enemies = [{ id: 'tree-left', texture: 'tree-normal', x: mobile ? 1.6 : 3, y: 7.2 }, { id: 'wolf-right', texture: 'wolf-normal', x: mobile ? 10 : 15.2, y: 7.5 }];
    for (const enemy of enemies) {
      if (enemy.id === 'tree-left' && this.defeated) continue;
      const entity = { ...enemy, hp: 100, maxHp: 100, facingX: 0, facingY: 1 };
      const appearance = { texture: enemy.texture, radius: .4, label: '', color: 0xa6adb3, rank: 'normal' }; this.entities.render(entity, appearance);
    }
    this.entities.end();
    this.levels.render(this.sim.players, viewport, player.id);
    for (let index = 0; index < this.labels.length; index += 1) { const position = this.position(index); this.labels[index].setPosition(position.x * unit, viewport.oy + (position.y + .8) * unit); }
    if (time - this.published >= 100) { this.published = time; this.publish(); }
  }
}
