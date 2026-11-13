import { bannerKinds } from '@web-game-world/simulation';
import type { BannerState } from '@web-game-world/simulation';
import Phaser from 'phaser';
import type { CombatFeedback } from './combat-feedback';
import portraitsUrl from '../../../../content/packs/forest-survival/assets/runtime/portraits.webp';
import portraitsData from '../../../../content/packs/forest-survival/assets/runtime/portraits.json';
import { preloadTacticArt } from './tactic-effects';

interface EntityAppearance { texture: string; radius: number; label: string; color: number; elite?: boolean; rank?: string; glow?: number; mine?: boolean }
interface EntityState { banners?: BannerState; id: string; x: number; y: number; hp: number; maxHp: number; facingX: number; facingY: number; state?: string; originX?: number; originY?: number }
interface Portrait { buffHalo?: Phaser.GameObjects.Image; buffIcons?: Phaser.GameObjects.Image[]; container: Phaser.GameObjects.Container; graphics: Phaser.GameObjects.Graphics; image: Phaser.GameObjects.Image; label: Phaser.GameObjects.Text; hp: number; trailHp?: number; damageAt?: number; deathAt?: number; deathScale?: number; deathFrameScale?: number; worldX?: number; worldY?: number; frame?: Phaser.GameObjects.Image; trails?: Phaser.GameObjects.Image[] }
export interface BattleViewport { unit: number; ox: number; oy: number }

// 所有秘境共用的实体图像、生命、身份与朝向表现。
export class BattleEntities {
  feedback?: CombatFeedback;
  private spare: Portrait[] = [];
  private portraits = new Map<string, Portrait>();
  private retained = new Set<string>();
  private scene: Phaser.Scene;
  viewport: BattleViewport = { unit: 32, ox: 0, oy: 0 };

  constructor(scene: Phaser.Scene) { this.scene = scene; }

  static preload(scene: Phaser.Scene): void {
    scene.load.atlas('battle-portraits', portraitsUrl, portraitsData);
    preloadTacticArt(scene);
  }

  begin(viewport: BattleViewport): void { this.viewport = viewport; this.retained.clear(); }

  render(entity: EntityState, appearance: EntityAppearance): void {
    this.retained.add(entity.id);
    const { unit, ox, oy } = this.viewport;
    const reaction = this.feedback?.entity(entity.id);
    const x = ox + (entity.x + (reaction?.x ?? 0)) * unit; const y = oy + (entity.y + (reaction?.y ?? 0)) * unit; const radius = appearance.radius * unit;
    const margin = radius + 100;
    const visible = x >= -margin && y >= -margin && x <= this.scene.scale.width + margin && y <= this.scene.scale.height + margin;
    let portrait = this.portraits.get(entity.id);
    if (!visible) {
      if (portrait) {
        portrait.container.setVisible(false);
        for (const trail of portrait.trails ?? []) trail.setVisible(false);
        portrait.hp = entity.hp;
      }
      return;
    }
    if (!portrait) {
      portrait = this.spare.pop();
      if (portrait) {
        portrait.hp = entity.hp; portrait.trailHp = entity.hp; portrait.damageAt = undefined;
        portrait.deathAt = undefined; portrait.deathScale = undefined; portrait.deathFrameScale = undefined;
        portrait.image.setTexture('battle-portraits', appearance.texture); portrait.image.setVisible(true);
        portrait.label.setVisible(true); portrait.frame?.setAlpha(1);
        for (const trail of portrait.trails ?? []) trail.setTexture('battle-portraits', appearance.texture);
        this.portraits.set(entity.id, portrait);
      }
    }
    if (portrait) portrait.container.setVisible(true);
    if (!portrait) {
      const container = this.scene.add.container(0, 0);
      const image = this.scene.add.image(x, y, 'battle-portraits', appearance.texture);
      const graphics = this.scene.add.graphics();
      const label = this.scene.add.text(x, y, appearance.label, { fontSize: '12px', color: '#fff2d5', fontFamily: 'Microsoft YaHei, sans-serif', stroke: '#132218', strokeThickness: 3 });
      label.setOrigin(.5, 1);
      const children = [image, graphics, label]; container.add(children);
      portrait = { container, graphics, image, label, hp: entity.hp }; this.portraits.set(entity.id, portrait);
    }
    // 每个实体作为完整图层排序，限定在地面与技能层之间。
    const absoluteY = Math.abs(entity.y); const depth = 2 + .5 * entity.y / (1 + absoluteY);
    portrait.container.setDepth(depth); portrait.graphics.clear();
    portrait.worldX = entity.x; portrait.worldY = entity.y;
    const pulse = appearance.glow ? 1 + Math.sin(this.scene.time.now / 65) * .025 : 1;
    const display = radius * 2 * (reaction?.scale ?? 1) * pulse;
    portrait.image.setPosition(x, y); portrait.image.setDisplaySize(display, display);
    if (entity.state === 'charge' || entity.state === 'flee') {
      if (!portrait.trails) {
        portrait.trails = [];
        for (let index = 0; index < 2; index += 1) {
          const trail = this.scene.add.image(x, y, 'battle-portraits', appearance.texture); portrait.container.addAt(trail, 0); portrait.trails.push(trail);
        }
      }
      const dx = entity.x - (entity.originX ?? entity.x); const dy = entity.y - (entity.originY ?? entity.y);
      const squared = dx * dx + dy * dy; const travelled = Math.sqrt(squared);
      for (const [index, trail] of portrait.trails.entries()) {
        const offset = Math.min(travelled, (index + 1) * .55) * unit;
        trail.setPosition(x - entity.facingX * offset, y - entity.facingY * offset);
        trail.setDisplaySize(radius * 2, radius * 2); trail.setAlpha(.25 - index * .08); trail.setVisible(true);
      }
    } else for (const trail of portrait.trails ?? []) trail.setVisible(false);
    const buffs = entity.hp > 0 ? entity.banners?.buffs.filter(buff => buff.remaining > 0 && buff.strength > 0) ?? [] : [];
    if (buffs.length && this.scene.textures.exists('battle-banners')) {
      portrait.buffIcons ??= [];
      if (!portrait.buffHalo) { portrait.buffHalo = this.scene.add.image(0, 0, 'battle-banners', 3); portrait.container.addAt(portrait.buffHalo, 0); }
      const beat = Math.floor(this.scene.time.now / 1800); const dominant = buffs[beat % buffs.length]; const row = bannerKinds.indexOf(dominant.kind);
      const haloSize = radius * 3.1; const empowered = dominant.charge > 0 || dominant.resist > 0 || dominant.shield > 0; const pulse = (empowered ? .85 : .6) + Math.sin(this.scene.time.now / (empowered ? 100 : 180)) * .12;
      portrait.buffHalo.setTexture('battle-banners', row * 4 + 3); portrait.buffHalo.setPosition(x, y); portrait.buffHalo.setDisplaySize(haloSize, haloSize); portrait.buffHalo.setAlpha(pulse); portrait.buffHalo.setVisible(true);
      for (let index = 0; index < buffs.length; index += 1) {
        const buff = buffs[index]; const frame = bannerKinds.indexOf(buff.kind) * 4 + 3; let icon = portrait.buffIcons[index];
        if (!icon) { icon = this.scene.add.image(0, 0, 'battle-banners', frame); portrait.container.add(icon); portrait.buffIcons.push(icon); }
        const iconX = x + (index - (buffs.length - 1) / 2) * 11; const iconY = y + radius + 17;
        icon.setTexture('battle-banners', frame); icon.setPosition(iconX, iconY); icon.setDisplaySize(13, 13); icon.setAlpha(buff.inside ? 1 : .45 + .2 * pulse); icon.setVisible(true);
      }
    } else portrait.buffHalo?.setVisible(false);
    for (let index = buffs.length; index < (portrait.buffIcons?.length ?? 0); index += 1) portrait.buffIcons?.[index].setVisible(false);
    const alpha = entity.hp <= 0 ? .3 : 1; portrait.image.setAlpha(alpha);
    if (entity.hp < portrait.hp) { const previousTrail = this.scene.time.now - (portrait.damageAt ?? -1000) < 320 ? portrait.trailHp ?? portrait.hp : portrait.hp; portrait.trailHp = Math.max(previousTrail, portrait.hp); portrait.damageAt = this.scene.time.now; }
    if ((reaction?.flash ?? 0) > .2) { portrait.image.setTintFill(0xffeee0); } else if (appearance.glow) portrait.image.setTint(0xffe1a0); else portrait.image.clearTint();
    portrait.hp = entity.hp;
    if (portrait.label.text !== appearance.label) portrait.label.setText(appearance.label);
    const ranked = appearance.rank === 'elite' || appearance.rank === 'boss';
    const overhead = ranked ? 22 : 8;
    const labelY = y - radius - overhead - 4; portrait.label.setPosition(x, labelY);
    const g = portrait.graphics;
    portrait.frame?.setVisible(Boolean(appearance.rank));
    if (appearance.rank) {
      const texture = `tactic-frame-${appearance.rank}`;
      if (!portrait.frame) {
        portrait.frame = this.scene.add.image(x, y, 'battle-tactics', texture);
        const frameIndex = portrait.container.getIndex(portrait.image) + 1; portrait.container.addAt(portrait.frame, frameIndex);
      }
      portrait.frame.setTexture('battle-tactics', texture); portrait.frame.setPosition(x, y); portrait.frame.setDisplaySize(radius * 2 / .75, radius * 2 / .75);
    }
    else { g.lineStyle(2, appearance.color, alpha); g.strokeCircle(x, y, radius); }
    if (appearance.mine) { g.lineStyle(1, 0xf8e3a0, .7); g.strokeCircle(x, y, radius + 3); }
    const tipX = x + entity.facingX * (radius + 6); const tipY = y + entity.facingY * (radius + 6);
    g.fillStyle(appearance.color, alpha);
    g.fillTriangle(tipX + entity.facingX * 4, tipY + entity.facingY * 4, tipX - entity.facingY * 3, tipY + entity.facingX * 3, tipX + entity.facingY * 3, tipY - entity.facingX * 3);
    const healthWidth = radius * 2;
    g.fillStyle(0x12251a, .95); g.fillRoundedRect(x - radius, y - radius - overhead, healthWidth, 5, 2);
    const age = this.scene.time.now - (portrait.damageAt ?? -1000);
    const trailAge = Math.max(0, age - 100);
    const fraction = Math.max(0, 1 - trailAge / 220);
    const trailing = entity.hp + Math.max(0, (portrait.trailHp ?? entity.hp) - entity.hp) * fraction;
    const trailWidth = healthWidth * Math.min(1, trailing / entity.maxHp);
    g.fillStyle(0xffd8a0); g.fillRoundedRect(x - radius, y - radius - overhead, trailWidth, 5, 2);
    const health = Math.max(0, entity.hp / entity.maxHp); const width = healthWidth * health;
    const healthColor = 0xe5484d;
    g.fillStyle(healthColor); g.fillRoundedRect(x - radius, y - radius - overhead, width, 5, 2);
    
  }

  end(): void {
    for (const [id, portrait] of this.portraits) {
      if (this.retained.has(id)) continue;
      portrait.graphics.clear();
      const reaction = this.feedback?.entity(id);
      if (reaction?.killed && portrait.deathAt === undefined) { portrait.deathAt = this.scene.time.now; portrait.deathScale = portrait.image.scaleX; portrait.deathFrameScale = portrait.frame?.scaleX; }
      if (portrait.deathAt !== undefined) {
        const age = this.scene.time.now - portrait.deathAt;
        if (age < 220) {
          const alpha = 1 - age / 220; const scale = (portrait.deathScale ?? 1) * (1 - age / 1100);
          const x = this.viewport.ox + (portrait.worldX ?? 0) * this.viewport.unit; const y = this.viewport.oy + (portrait.worldY ?? 0) * this.viewport.unit;
          portrait.container.setVisible(true);
          portrait.image.setPosition(x, y); portrait.image.setAlpha(alpha); portrait.image.setScale(scale); portrait.image.setVisible(true);
          portrait.label.setVisible(false);
          if (portrait.frame) {
            const frameScale = (portrait.deathFrameScale ?? 1) * (1 - age / 1100);
            portrait.frame.setPosition(x, y); portrait.frame.setScale(frameScale); portrait.frame.setAlpha(alpha); portrait.frame.setVisible(true);
          }
          for (const trail of portrait.trails ?? []) trail.setVisible(false);
          continue;
        }
      }
      portrait.container.setVisible(false);
      if (this.spare.length < 96) this.spare.push(portrait); else portrait.container.destroy();
      this.portraits.delete(id);
    }
  }
}
