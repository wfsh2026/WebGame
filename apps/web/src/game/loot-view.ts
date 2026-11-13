import Phaser from 'phaser';
import type { LootItemData, LootPickupData, Snapshot } from '@web-game-world/contracts';
import type { BattleViewport } from './battle-entities';
import type { SceneBridge } from './online-scene';
import flameAtlas from '../../../../content/packs/forest-survival/assets/runtime/loot-flame-loop.png';
import inventoryAtlas from '../../../../content/packs/forest-survival/assets/runtime/loot-symbols.png';

export function preloadLootArt(scene: Phaser.Scene): void { scene.load.image('loot-symbols', inventoryAtlas); scene.load.image('loot-flame-loop', flameAtlas); }
interface LootSprite { glow: Phaser.GameObjects.Image; sparks: Phaser.GameObjects.Image[]; born: number; shine: Phaser.GameObjects.Image; image: Phaser.GameObjects.Image; aura: Phaser.GameObjects.Image; motes: Phaser.GameObjects.Image; phase: number }
export class LootView {
  private ground = new Map<string, LootSprite>();
  private claimed = new Map<string, number>();
  private flights = 0;
  private firstSeen = new Map<string, number>();
  constructor(private scene: Phaser.Scene, private bridge: SceneBridge) {
    for (const key of ['loot-symbols', 'loot-flame-loop']) {
    const texture = scene.textures.get(key); const source = texture.getSourceImage();
    const width = Math.floor(source.width / 4); const height = Math.floor(source.height / 4);
    for (let index = 0; index < 16; index += 1) { const row = Math.floor(index / 4); const x = index % 4 * width; const y = row * height; texture.add(index, 0, x, y, width, height); }
    }
  }
  private grade(item: LootItemData): number { return item.level >= 12 ? 3 : item.level >= 8 ? 2 : item.level >= 4 ? 1 : 0; }
  private art(item: LootItemData): { texture: string; frame: number } {
    const tier = this.grade(item);
    const consumables: Record<string, number> = { life: 0, mana: 1, energy: 2, haste: 13, shield: 14, focus: 15 };
    const frame = item.category === 'consumable' ? consumables[item.effect] ?? 2 : item.kind === 'skill' ? 4 + tier : item.kind === 'weapon' ? 8 + tier : item.kind === 'heart' ? 3 : 12;
    return { texture: 'loot-symbols', frame };
  }

  render(state: Snapshot, viewport: BattleViewport): void {
    const arrivals = this.bridge.pickups.splice(0);
    for (const event of arrivals) {
      if (this.claimed.has(event.item.id)) continue;
      this.claimed.set(event.item.id, this.scene.time.now + 3000); this.fly(event, viewport);
    }
    const retained = new Set<string>();
    const time = this.scene.time.now / 1000;
    const player = state.players.find(entry => entry.id === this.bridge.playerId);
    const loot = state.loot ?? [];
    const ids = loot.map(item => item.id); const existing = new Set(ids);
    for (const id of this.firstSeen.keys()) if (!existing.has(id)) this.firstSeen.delete(id);
    const ordered = [...loot];
    if (player) ordered.sort((a, b) => (a.x - player.x) ** 2 + (a.y - player.y) ** 2 - (b.x - player.x) ** 2 - (b.y - player.y) ** 2);
    for (const item of ordered) {
      if (!this.firstSeen.has(item.id)) this.firstSeen.set(item.id, time);
      if (this.claimed.has(item.id)) continue;
      const x = viewport.ox + item.x * viewport.unit; const y = viewport.oy + item.y * viewport.unit;
      if (x < -100 || y < -80 || x > this.scene.scale.width + 100 || y > this.scene.scale.height + 80) continue;
      retained.add(item.id); let sprite = this.ground.get(item.id);
      if (!sprite) {
        const art = this.art(item); const image = this.scene.add.image(x, y, art.texture, art.frame); image.setDisplaySize(42, 42); image.setDepth(5);
        const aura = this.scene.add.image(x, y, 'ability-animation', 14); aura.setDepth(4); aura.setBlendMode(Phaser.BlendModes.ADD);
        const motes = this.scene.add.image(x, y, 'ability-animation', 15); motes.setDepth(6); motes.setBlendMode(Phaser.BlendModes.ADD);
        const shine = this.scene.add.image(x, y, art.texture, art.frame); shine.setDepth(6); shine.setBlendMode(Phaser.BlendModes.ADD); shine.setDisplaySize(42, 42);
        const glow = this.scene.add.image(x, y, art.texture, art.frame); glow.setDepth(4); glow.setBlendMode(Phaser.BlendModes.ADD);
        let seed = 0; for (const char of item.id) seed += char.charCodeAt(0);
        const born = this.firstSeen.get(item.id) ?? time;
        sprite = { image, glow, sparks: [], born, shine, aura, motes, phase: seed * .73 }; this.ground.set(item.id, sprite);
      }
      const dx = item.x - (player?.x ?? item.x); const dy = item.y - (player?.y ?? item.y);
      const distance = Math.sqrt(dx * dx + dy * dy);
      const context = { x, y, time, distance, detailed: retained.size <= 80 && distance < 12 };
      this.animate(sprite, item, context);
    }
    for (const [id, sprite] of this.ground) if (!retained.has(id)) { const picked = this.claimed.has(id); this.remove(sprite, picked); this.ground.delete(id); }
    for (const [id, expiry] of this.claimed) if (expiry < this.scene.time.now) this.claimed.delete(id);
  }
  private animate(sprite: LootSprite, item: LootItemData, view: { x: number; y: number; time: number; distance: number; detailed: boolean }): void {
    const { x, y, time } = view;
    const tier = item.category === 'consumable' ? 0 : this.grade(item);
    const colors: Record<string, number> = { life: 0xff5555, mana: 0x559dff, energy: 0x65ffdd, haste: 0xbaff81, shield: 0xffdc81, focus: 0xce8fff };
    const grades = [0xfff1d2, 0x70caff, 0xcd80ff, 0xffcf69];
    const tint = item.category === 'consumable' ? colors[item.effect] ?? 0xffffff : grades[tier];
    const cycle = time * Math.PI + sprite.phase;
    const bob = Math.sin(cycle) * 6;
    const breath = .5 + .5 * Math.sin(time * Math.PI * 4 / 3 + sprite.phase);
    const age = time - sprite.born; const arrival = Math.max(0, 1 - age / .55);
    const entryProgress = Math.min(1, age / .55);
    const bounce = Math.sin(entryProgress * Math.PI) * 9;
    const near = Math.max(0, 1 - view.distance / 3);
    const lift = 16 + bob + bounce; const sy = y - lift;
    const flame = item.kind === 'skill' && item.category !== 'consumable';
    const bottle = item.category === 'consumable' && (item.effect === 'life' || item.effect === 'mana');
    const angle = Math.sin(cycle * .6) * (item.kind === 'support' ? .16 : .07);
    const flicker = flame ? Math.sin(time * 9 + sprite.phase) : 0;
    const width = 42 + flicker * 2; const height = 44 - flicker * 3;
    if (flame) { const frame = Math.floor(time * 12 + sprite.phase) % 16; sprite.image.setTexture('loot-flame-loop', frame); sprite.image.setTint(tint); }
    sprite.image.setPosition(x, sy); sprite.image.setRotation(angle); sprite.image.setDisplaySize(width, height);
    // Enlarged colored silhouette follows the actual animation frame, behind the crisp icon.
    sprite.glow.setTexture(sprite.image.texture.key, sprite.image.frame.name); sprite.glow.setTintFill(tint); sprite.glow.setPosition(x, sy); sprite.glow.setRotation(angle);
    const glowSize = 49 + breath * 5 + tier * 2 + arrival * 7;
    const glowAlpha = .22 + breath * .18 + near * .18 + arrival * .2;
    sprite.glow.setDisplaySize(glowSize, glowSize + 2); sprite.glow.setAlpha(glowAlpha);
    const poolWidth = 62 + breath * 9 + tier * 4 - bob * .4;
    const poolHeight = 22 + breath * 4 - bob * .15;
    const poolAlpha = .3 + breath * .2 + near * .12 + arrival * .2;
    sprite.aura.setPosition(x, y + 4); sprite.aura.setDisplaySize(poolWidth, poolHeight); sprite.aura.setAlpha(poolAlpha); sprite.aura.setTintFill(tint);
    const sweep = (time * .65 + sprite.phase) % 1;
    const shining = item.kind === 'weapon' || bottle || item.kind === 'support';
    sprite.shine.setVisible(shining); sprite.shine.setPosition(x, sy); sprite.shine.setRotation(angle); sprite.shine.setDisplaySize(width, height);
    if (shining) {
      const cell = sprite.shine.frame; const band = cell.height * (bottle ? .1 : .12);
      const top = bottle ? cell.height * (.45 + sweep * .35) : (cell.height - band) * (1 - sweep);
      const alpha = Math.sin(sweep * Math.PI) * .85;
      sprite.shine.setCrop(0, top, cell.width, band); sprite.shine.setAlpha(alpha);
    }
    const wave = (time * .45 + sprite.phase) % 1;
    const corona = 48 + wave * 32;
    const coronaAlpha = Math.sin(wave * Math.PI) * (tier === 3 ? .55 : .28);
    sprite.motes.setVisible(view.detailed); sprite.motes.setPosition(x, sy); sprite.motes.setTintFill(tint);
    sprite.motes.setDisplaySize(corona, corona); sprite.motes.setAlpha(coronaAlpha);
    const orbit = time * (item.category === 'insured' ? -.8 : .5) + sprite.phase; sprite.motes.setRotation(orbit);
    const count = view.detailed ? (item.category === 'consumable' ? 3 : 2 + tier) : 0;
    while (sprite.sparks.length > count) { const spark = sprite.sparks.pop(); spark?.destroy(); }
    while (sprite.sparks.length < count) {
      const spark = this.scene.add.image(x, sy, 'ability-animation', 15); spark.setDepth(6); spark.setBlendMode(Phaser.BlendModes.ADD); sprite.sparks.push(spark);
    }
    for (let index = 0; index < sprite.sparks.length; index += 1) {
      const spark = sprite.sparks[index]; const phase = sprite.phase + index * 1.7;
      const progress = (time * (flame ? .85 : .5) + index / count + sprite.phase) % 1;
      const turn = time * 1.6 + phase;
      let px = x + Math.sin(turn) * 13; let py = sy + 14 - progress * 42;
      if (item.kind === 'heart' || item.kind === 'support' || item.effect === 'mana') { px = x + Math.cos(turn) * 23; py = sy + Math.sin(turn) * 12 - progress * 14; }
      if (item.kind === 'weapon') { px = x - 13 + progress * 25; py = sy + 16 - progress * 32; }
      const size = (item.kind === 'heart' ? 14 : 9) + Math.sin(progress * Math.PI) * 3;
      const alpha = Math.sin(progress * Math.PI) * .85;
      spark.setPosition(px, py); spark.setDisplaySize(size, size); spark.setAlpha(alpha); spark.setTintFill(tint); spark.setRotation(turn);
    }
  }
  private remove(sprite: LootSprite, picked: boolean): void {
    const parts = [sprite.image, sprite.shine, sprite.glow, sprite.aura, sprite.motes, ...sprite.sparks];
    if (!picked) { for (const part of parts) part.destroy(); return; }
    const tween = { targets: parts, x: sprite.image.x, y: sprite.image.y, alpha: 0, scaleX: 0, scaleY: 0, duration: 150, ease: 'Cubic.In', onComplete: () => { for (const part of parts) part.destroy(); } };
    this.scene.tweens.add(tween);
  }
  private fly(event: LootPickupData, viewport: BattleViewport): void {
    if (this.flights >= 80) return;
    const mine = event.playerId === this.bridge.playerId;
    const consumed = event.item.category === 'consumable';
    const destination = event.item.category === 'insured' ? 'safe' : 'bag';
    const target = mine && !consumed ? this.bridge.lootTarget(destination) : undefined;
    const player = this.bridge.current?.players.find(item => item.id === event.playerId);
    if (!target && !player) return;
    const canvas = this.scene.game.canvas.getBoundingClientRect();
    const endX = target ? (target.x - canvas.left) * this.scene.scale.width / canvas.width : viewport.ox + (player?.x ?? 0) * viewport.unit;
    const endY = target ? (target.y - canvas.top) * this.scene.scale.height / canvas.height : viewport.oy + (player?.y ?? 0) * viewport.unit;
    const worldX = viewport.ox + event.item.x * viewport.unit; const worldY = viewport.oy + event.item.y * viewport.unit - 16;
    const x = Phaser.Math.Clamp(worldX, 0, this.scene.scale.width); const y = Phaser.Math.Clamp(worldY, 0, this.scene.scale.height);
    const art = this.art(event.item); const sprite = this.scene.add.image(x, y, art.texture, art.frame); sprite.setDisplaySize(36, 36); sprite.setDepth(100);
    const width = sprite.scaleX; const height = sprite.scaleY; this.flights += 1;
    const tween = { targets: sprite, x: endX, y: endY, scaleX: width * .5, scaleY: height * .5, delay: 100, duration: mine && !consumed ? 550 : 220, ease: 'Cubic.In', onComplete: () => { sprite.destroy(); this.flights -= 1; if (mine && !consumed) this.bridge.lootLanded(destination); } };
    this.scene.tweens.add(tween);
  }
}
