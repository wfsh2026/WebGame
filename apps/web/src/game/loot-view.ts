import Phaser from 'phaser';
import { experienceFlightSeconds } from '@web-game-world/simulation';
import type { Simulation, Vec } from '@web-game-world/simulation';
import type { Snapshot } from '@web-game-world/contracts';
import type { BattleViewport } from './battle-entities';
import type { SceneBridge } from './online-scene';
import { lootColor, lootFrame, lootGrade, prepareLootArt } from './loot-art';
import { PickupEffects } from './pickup-effects';
export { preloadLootArt } from './loot-art';

interface GroundSprite { image: Phaser.GameObjects.Image; halo: Phaser.GameObjects.Image; pool: Phaser.GameObjects.Image; sparks: Phaser.GameObjects.Image[]; born: number; phase: number }
interface GroundAppearance { frame: number; color: number; size: number; grade: number; experience?: boolean }

export class LootView {
  readonly pickups: PickupEffects;
  private ground = new Map<string, GroundSprite>();
  private claimed = new Set<string>();
  private absorbed = new Set<string>();
  private firstSeen = new Map<string, number>();
  private room = '';
  constructor(private scene: Phaser.Scene, private bridge: SceneBridge) { prepareLootArt(scene); this.pickups = new PickupEffects(scene); }
  reset(): void {
    for (const sprite of this.ground.values()) this.remove(sprite);
    this.ground.clear(); this.claimed.clear(); this.absorbed.clear(); this.firstSeen.clear(); this.pickups.reset();
  }
  render(state: Snapshot, viewport: BattleViewport, world?: Simulation): void {
    if (state.roomId !== this.room) { this.reset(); this.room = state.roomId; }
    const players = world?.players ?? state.players;
    const size = Math.min(42, viewport.unit * .7); const itemSize = Math.max(26, size);
    const arrivals = this.bridge.pickups.splice(0);
    for (const event of arrivals) {
      if (this.claimed.has(event.item.id)) continue;
      this.claimed.add(event.item.id);
      const color = lootColor(event.item.level); const frame = lootFrame(event.item);
      const mine = event.playerId === this.bridge.playerId;
      const destination = event.item.category === 'insured' ? 'safe' : 'bag';
      const landed = mine ? () => this.bridge.lootLanded(destination) : undefined;
      const request = { id: event.item.id, playerId: event.playerId, origin: event.item, frame, color, size: itemSize, landed };
      this.pickups.start(request);
    }
    const retained = new Set<string>();
    const loot = state.loot ?? [];
    for (const item of loot) {
      if (this.claimed.has(item.id)) continue;
      retained.add(item.id);
      const frame = lootFrame(item); const color = lootColor(item.level); const grade = lootGrade(item.level);
      const appearance = { frame, color, size: itemSize, grade };
      this.drawGround(item, appearance, viewport);
    }
    if (world) {
      for (const orb of world.experienceOrbs) {
        if (orb.playerId !== this.bridge.playerId) continue;
        const radius = Math.sqrt(orb.amount); const orbSize = Math.min(25, 12 + radius * 1.3);
        if (orb.flyingAt !== undefined) {
          if (!this.claimed.has(orb.id)) {
            this.claimed.add(orb.id);
            const elapsed = world.clock - orb.flyingAt; const duration = Math.max(100, (experienceFlightSeconds - elapsed) * 1000);
            const request = { id: orb.id, playerId: orb.playerId, origin: orb, frame: 2, color: 0x76f6e6, size: orbSize, duration, experience: true };
            this.pickups.start(request);
          }
          continue;
        }
        retained.add(orb.id);
        const appearance = { frame: 2, color: 0x76f6e6, size: orbSize, grade: 0, experience: true };
        this.drawGround(orb, appearance, viewport);
      }
      for (const effect of world.effects) {
        if (effect.kind !== 'experience-absorb' || !effect.owner || this.absorbed.has(effect.id)) continue;
        this.absorbed.add(effect.id);
        if (effect.owner === this.bridge.playerId) this.pickups.experience(effect.owner, effect.amount ?? 0);
        else this.pickups.absorb(effect.owner, 0x76f6e6);
      }
    }
    for (const [id, sprite] of this.ground) if (!retained.has(id)) { this.remove(sprite); this.ground.delete(id); }
    for (const id of this.firstSeen.keys()) if (!retained.has(id)) this.firstSeen.delete(id);
    this.pickups.render(players, viewport);
    if (this.claimed.size > 4096) { const live = new Set(retained); for (const id of this.claimed) if (!live.has(id)) this.claimed.delete(id); }
    if (this.absorbed.size > 4096) this.absorbed.clear();
  }
  private drawGround(item: Vec & { id: string }, art: GroundAppearance, viewport: BattleViewport): void {
    const x = viewport.ox + item.x * viewport.unit; const y = viewport.oy + item.y * viewport.unit;
    const visible = x >= -80 && y >= -80 && x <= this.scene.scale.width + 80 && y <= this.scene.scale.height + 80;
    let sprite = this.ground.get(item.id);
    if (!visible) { if (sprite) { this.remove(sprite); this.ground.delete(item.id); } return; }
    if (!sprite) {
      const known = this.firstSeen.get(item.id); const born = known ?? this.scene.time.now; this.firstSeen.set(item.id, born);
      if (known === undefined && !art.experience && art.grade >= 2) this.pickups.sound?.play(`drop-${art.grade}`, .7 + art.grade * .1, 0);
      const image = this.scene.add.image(0, 0, 'loot-symbols', art.frame); image.setDepth(5);
      const halo = this.scene.add.image(0, 0, 'loot-growth', 8); halo.setTint(art.color); halo.setDepth(4); halo.setBlendMode(Phaser.BlendModes.ADD);
      const pool = this.scene.add.image(0, 0, 'loot-growth', 14); pool.setTint(art.color); pool.setDepth(1.8); pool.setBlendMode(Phaser.BlendModes.ADD);
      const sparks: Phaser.GameObjects.Image[] = [];
      const count = this.ground.size > 120 ? 0 : art.experience ? 1 : 3;
      for (let index = 0; index < count; index += 1) { const spark = this.scene.add.image(0, 0, 'loot-growth', 9); spark.setTint(art.color); spark.setDepth(6); spark.setBlendMode(Phaser.BlendModes.ADD); sparks.push(spark); }
      let seed = 0; for (const char of item.id) seed += char.charCodeAt(0);
      sprite = { image, halo, pool, sparks, born, phase: seed * .73 }; this.ground.set(item.id, sprite);
    }
    const age = (this.scene.time.now - sprite.born) / 1000; const time = this.scene.time.now / 1000;
    const arrival = Math.max(0, 1 - age / .45); const entry = Math.min(1, age / .45);
    const bob = Math.sin(time * 2.8 + sprite.phase) * 3; const bounce = Math.sin(entry * Math.PI) * 15;
    const sy = y - 10 - bob - bounce;
    const breath = .5 + .5 * Math.sin(time * 3 + sprite.phase);
    sprite.image.setPosition(x, sy); sprite.image.setDisplaySize(art.size, art.size); sprite.image.clearTint();
    const haloSize = art.size * (1.75 + breath * .16 + arrival * .5);
    sprite.halo.setPosition(x, sy); sprite.halo.setDisplaySize(haloSize, haloSize); sprite.halo.setRotation(time * .3 + sprite.phase); sprite.halo.setAlpha(.16 + breath * .1 + arrival * .25 + art.grade * .025);
    const poolWidth = art.size * (1.7 + arrival * .7);
    sprite.pool.setPosition(x, y + 3); sprite.pool.setDisplaySize(poolWidth, art.size * .7); sprite.pool.setAlpha(.35 + breath * .12);
    for (let index = 0; index < sprite.sparks.length; index += 1) {
      const phase = time * 1.8 + sprite.phase + index * 2.1; const spark = sprite.sparks[index];
      const px = x + Math.cos(phase) * art.size * .63; const py = sy + Math.sin(phase * .8) * art.size * .6;
      const sparkle = .5 + Math.sin(phase * 2) * .4; const sparkSize = art.experience ? 5 : 7 + art.grade * .7;
      spark.setPosition(px, py); spark.setDisplaySize(sparkSize, sparkSize); spark.setAlpha(sparkle);
    }
  }
  private remove(sprite: GroundSprite): void { sprite.image.destroy(); sprite.halo.destroy(); sprite.pool.destroy(); for (const spark of sprite.sparks) spark.destroy(); }
}
