import Phaser from 'phaser';
import type { Player } from '@web-game-world/simulation';
import type { BattleViewport } from './battle-entities';
import type { CombatSound } from './combat-sound';
import { playerFrameGrade } from './loot-art';

interface UpgradeEffect { id: string; from: number; to: number; born: number; image: Phaser.GameObjects.Image; sparks: Phaser.GameObjects.Image; label: Phaser.GameObjects.Text }
export class LevelEffects {
  sound?: CombatSound;
  private levels = new Map<string, number>();
  private effects = new Map<string, UpgradeEffect>();
  constructor(private scene: Phaser.Scene) {}
  reset(): void {
    for (const effect of this.effects.values()) this.remove(effect);
    this.effects.clear(); this.levels.clear();
  }
  render(players: readonly Pick<Player, 'id' | 'level' | 'x' | 'y'>[], viewport: BattleViewport, playerId: string): void {
    const now = this.scene.time.now;
    for (const player of players) {
      const previous = this.levels.get(player.id); this.levels.set(player.id, player.level);
      if (previous === undefined || player.level <= previous) continue;
      const active = this.effects.get(player.id); const from = active && now - active.born < 180 ? active.from : previous;
      if (active) this.remove(active);
      const image = this.scene.add.image(0, 0, 'loot-growth', 11); image.setDepth(10); image.setTint(0xffe4a0); image.setBlendMode(Phaser.BlendModes.ADD);
      const sparks = this.scene.add.image(0, 0, 'loot-growth', 13); sparks.setDepth(10); sparks.setTint(0xffe4a0); sparks.setBlendMode(Phaser.BlendModes.ADD);
      const style = { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: player.id === playerId ? '19px' : '14px', color: '#ffe4a0', stroke: '#18291e', strokeThickness: 4, fontStyle: 'bold' };
      const label = this.scene.add.text(0, 0, `Lv.${from} → Lv.${player.level}`, style); label.setOrigin(.5); label.setDepth(15);
      this.effects.set(player.id, { id: player.id, from, to: player.level, born: now, image, sparks, label });
      if (player.id === playerId) this.sound?.play('level-up', 1, 0);
    }
    for (const [id, effect] of this.effects) {
      const player = players.find(entry => entry.id === id); const age = now - effect.born;
      if (!player || age >= 950) { this.remove(effect); this.effects.delete(id); continue; }
      const x = viewport.ox + player.x * viewport.unit; const y = viewport.oy + player.y * viewport.unit;
      const progress = age / 950; const fadeIn = Math.min(1, age / 90); const fadeOut = Math.min(1, (950 - age) / 300); const alpha = fadeIn * fadeOut;
      const before = playerFrameGrade(effect.from); const after = playerFrameGrade(effect.to); const milestone = before !== after;
      const strength = player.id === playerId ? 1 : .55; const size = viewport.unit * (milestone ? 1.75 : 1.35);
      effect.image.setPosition(x, y - progress * viewport.unit * .3); effect.image.setDisplaySize(size, size * 1.3); effect.image.setAlpha(alpha * strength);
      effect.sparks.setPosition(x, y); effect.sparks.setDisplaySize(size * 1.3, size * 1.3); effect.sparks.setAlpha(alpha * strength); effect.sparks.setRotation(progress * .3);
      effect.label.setPosition(x, y - viewport.unit * 1.5 - progress * 15); effect.label.setAlpha(alpha);
    }
    const liveIds = players.map(player => player.id); const live = new Set(liveIds);
    for (const id of this.levels.keys()) if (!live.has(id)) this.levels.delete(id);
  }
  private remove(effect: UpgradeEffect): void { effect.image.destroy(); effect.sparks.destroy(); effect.label.destroy(); }
}
