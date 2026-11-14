import Phaser from 'phaser';
import type { Player, Simulation } from '@web-game-world/simulation';
import type { BattleEntities, BattleViewport, BuffLayers } from './battle-entities';
import { buffTexture, prepareBuffArt } from './buff-art';

interface BuffState { blocking: boolean; perfect: boolean; counter: number; x: number; y: number; haste: boolean; focus: boolean; shield: number; ready: boolean; resonanceLeft: number; kind: string; casts: Map<string, number>; windUntil: number; angle: number }
interface Burst { owner: string; kind: string; start: number; duration: number; angle: number; melee?: boolean }
interface Paint { frame: string; x?: number; y?: number; width: number; height?: number; alpha: number; angle?: number; back?: boolean; normal?: boolean }
interface PlayerPaint { layers: BuffLayers; radius: number; alpha: number; time: number }
interface RenderContext { entities: BattleEntities; playerId: string; reset: boolean }

export class BuffEffects {
  private sprites: Phaser.GameObjects.Image[] = [];
  private used = 0;
  private players = new Map<string, BuffState>();
  private seen = new Map<string, number>();
  private bursts: Burst[] = [];
  private previousClock = -1;
  private round = -1;

  constructor(private scene: Phaser.Scene) { prepareBuffArt(scene); }

  private draw(paint: Paint, context: PlayerPaint): void {
    const alpha = paint.alpha * context.alpha;
    if (this.used >= 384 || alpha <= .01) return;
    let sprite = this.sprites[this.used];
    if (!sprite || !sprite.scene) { sprite = this.scene.add.image(0, 0, buffTexture, paint.frame); this.sprites[this.used] = sprite; }
    this.used += 1;
    const layer = paint.back ? context.layers.back : context.layers.front;
    if (sprite.parentContainer !== layer) layer.add(sprite);
    sprite.setTexture(buffTexture, paint.frame); sprite.setPosition(paint.x ?? 0, paint.y ?? 0);
    sprite.setDisplaySize(paint.width, paint.height ?? paint.width); sprite.setRotation(paint.angle ?? 0);
    sprite.setAlpha(alpha); sprite.setVisible(true);
    const blend = paint.normal ? Phaser.BlendModes.NORMAL : Phaser.BlendModes.SCREEN;
    sprite.setBlendMode(blend);
  }

  private burst(owner: string, kind: string, options: { now: number; angle?: number; melee?: boolean }): void {
    if (this.bursts.length >= 64) return;
    const duration = kind === 'perfect-block' ? .8 : kind === 'shield-hit' || kind === 'guard-hit' ? .38 : kind === 'release' ? .63 : .6;
    this.bursts.push({ owner, kind, start: options.now, duration, angle: options.angle ?? 0, melee: options.melee });
  }

  private shieldAmount(player: Player): number {
    let amount = player.shieldLeft > 0 ? player.lootShield : 0;
    for (const buff of player.banners?.buffs ?? []) if (buff.kind === 'banner-guard' && buff.remaining > 0) amount += buff.shield;
    return amount;
  }

  private observe(player: Player, sim: Simulation): BuffState {
    const now = sim.clock; const shield = this.shieldAmount(player);
    const haste = player.hasteLeft > 0; const focus = player.focusLeft > 0;
    const resonance = player.resonance;
    const source = player.equipment.branches.some(branch => branch.item.id === resonance?.buffSource && branch.resonance > 0);
    const ready = (resonance?.buffLeft ?? 0) > 0 && source;
    const counts = player.abilityStates.map(ability => [ability.itemId, ability.count] as const);
    const casts = new Map(counts);
    const previous = this.players.get(player.id);
    const state: BuffState = { blocking: player.blocking, perfect: player.blocking && (player.guard?.windowLeft ?? 0) > 0, counter: player.guard?.counterLeft ?? 0, x: player.x, y: player.y, haste, focus, shield, ready, resonanceLeft: resonance?.buffLeft ?? 0, kind: resonance?.buffKind ?? '', casts, windUntil: previous?.windUntil ?? now, angle: previous?.angle ?? 0 };
    if (previous) {
      const elapsed = now - this.previousClock;
      const dx = player.x - previous.x; const dy = player.y - previous.y; const distance = Math.hypot(dx, dy);
      if (elapsed > 0 && distance > .0005 && distance < Math.max(.5, player.stats.movementSpeed * elapsed * 4)) {
        state.windUntil = now + .45; state.angle = Math.atan2(dy, dx);
      }
      const options = { now };
      if (state.blocking && !previous.blocking) this.burst(player.id, 'guard-start', options);
      if (state.counter > 0 && previous.counter <= 0) this.burst(player.id, 'counter-acquire', options);
      if (haste && !previous.haste) this.burst(player.id, 'acquire-haste', options);
      if (focus && !previous.focus) this.burst(player.id, 'acquire-focus', options);
      if (shield > 0 && previous.shield <= 0) this.burst(player.id, 'acquire-shield', options);
      if (shield <= 0 && previous.shield > 0) this.burst(player.id, 'shield-break', options);
      if (ready && !previous.ready) this.burst(player.id, 'ready', options);
      let focused = false;
      for (const ability of player.abilityStates) {
        const count = previous.casts.get(ability.itemId);
        if (count === undefined || ability.count <= count) continue;
        const focusKey = `focus-${player.id}-${ability.itemId}-${ability.count}`;
        focused ||= focus && !this.seen.has(focusKey);
        if (focus) this.seen.set(focusKey, now + 2);
        const branch = player.equipment.branches.find(entry => entry.item.id === ability.itemId);
        if (!previous.ready || branch?.item.skillType !== previous.kind) continue;
        // Novel fields do not carry an empowered marker. A live resonance plus
        // a matching cast confirms consumption; standard attacks use their events below.
        const castId = `${player.id}-${ability.itemId}-${ability.count}`;
        const effect = sim.effects.find(entry => entry.owner === player.id && entry.sourceId === ability.itemId && entry.kind.startsWith('ability-novel-') && entry.ttl > 0 && entry.groupId === castId);
        if (!effect || previous.resonanceLeft <= elapsed) continue;
        let dx = effect.facingX ?? player.facingX;
        let dy = effect.facingY ?? player.facingY;
        if (effect?.kind === 'ability-novel-chain' || effect?.kind === 'ability-novel-transfer') { dx -= effect.x; dy -= effect.y; }
        const angle = Math.atan2(dy, dx); const release = { now, angle, melee: previous.kind === 'melee' };
        this.burst(player.id, 'release', release);
        const key = `release-${castId}`; this.seen.set(key, now + 2);
        break;
      }
      if (focused) this.burst(player.id, 'focus-cast', options);
    }
    this.players.set(player.id, state);
    return state;
  }

  private hits(sim: Simulation, reset: boolean): void {
    const now = sim.clock;
    for (const effect of sim.effects) {
      if ((effect.kind !== 'perfect-block' && effect.kind !== 'block') || !effect.targetId || effect.ttl <= 0) continue;
      const key = `guard-${effect.id}`;
      const known = this.seen.has(key); this.seen.set(key, now + 2);
      if (reset || known) continue;
      const angle = Math.atan2(-(effect.facingY ?? 0), -(effect.facingX ?? 1));
      const options = { now, angle };
      const kind = effect.kind === 'perfect-block' ? 'perfect-block' : 'guard-hit';
      this.burst(effect.targetId, kind, options);
    }
    for (const effect of sim.effects) {
      if ((effect.absorbed ?? 0) <= 0 || effect.targetKind !== 'player' || !effect.targetId || effect.ttl <= 0) continue;
      const known = this.seen.has(effect.id); this.seen.set(effect.id, now + 2);
      if (reset || known) continue;
      const angle = Math.atan2(-(effect.facingY ?? 0), -(effect.facingX ?? 1));
      const options = { now, angle };
      this.burst(effect.targetId, 'shield-hit', options);
    }
    for (const effect of sim.effects) {
      if (!effect.empowered || !effect.owner || !effect.id.startsWith('melee-') || effect.ttl <= 0) continue;
      const key = `release-${effect.id.slice(6)}`;
      const known = this.seen.has(key); this.seen.set(key, now + 2);
      if (reset || known) continue;
      const angle = Math.atan2(effect.facingY ?? 0, effect.facingX ?? 1);
      const options = { now, angle, melee: true };
      this.burst(effect.owner, 'release', options);
    }
    for (const shot of sim.projectiles) {
      if (!shot.empowered || shot.hostile || shot.secondary || shot.ttl <= 0 || (shot.delay ?? 0) > 0) continue;
      const key = `release-${shot.castId ?? shot.id}`;
      const known = this.seen.has(key); this.seen.set(key, now + 2);
      if (reset || known) continue;
      const angle = Math.atan2(shot.vy, shot.vx); const options = { now, angle, melee: false };
      this.burst(shot.owner, 'release', options);
    }
    for (const [id, until] of this.seen) if (until < now) this.seen.delete(id);
  }

  private wind(state: BuffState, context: PlayerPaint): void {
    const { radius: r, time: t } = context;
    const fade = Math.min(1, (state.windUntil - t) / .45);
    if (fade <= 0) return;
    const cosine = Math.cos(state.angle); const sine = Math.sin(state.angle);
    for (let index = 0; index < 5; index += 1) {
      const phase = (t * 1.8 + index / 5) % 1; const alpha = Math.sin(phase * Math.PI) * fade * .95;
      const along = -r * (1.2 + phase * 1.7); const across = (index - 2) * r * .31;
      const paint = { frame: 'wind-tail', x: cosine * along - sine * across, y: sine * along + cosine * across, width: r * (3.35 - phase * .6), height: r * 1.2, alpha, angle: state.angle, back: true };
      this.draw(paint, context);
    }
    for (const side of [-1, 1]) {
      const along = -r * .65; const across = side * r * (1.02 + Math.sin(t * 9) * .12);
      const paint = { frame: 'wind-feather', x: cosine * along - sine * across, y: sine * along + cosine * across, width: r * 1.4, height: r * .8, angle: state.angle + side * .25 - .7, alpha: fade * .9, back: true, normal: true };
      this.draw(paint, context);
    }
  }

  private focus(context: PlayerPaint): void {
    const { radius: r, time: t } = context;
    const flow = { frame: 'energy-flow', y: r * .45, width: r * 4.5, height: r * 2.55, angle: Math.sin(t * 2) * .14, alpha: .78, back: true };
    this.draw(flow, context);
    const curl = { frame: 'energy-curl', y: r * .45, width: r * 3.9, height: r * 1.85, angle: -t * .8, alpha: .55, back: true };
    this.draw(curl, context);
    for (let index = 0; index < 8; index += 1) {
      const phase = (t * .95 + index / 8) % 1; const angle = index * Math.PI * 2 / 8 + t * .75;
      const distance = r * (2.55 - phase * 1.9); const size = r * (1 - phase * .4);
      const paint = { frame: 'energy-mote', x: Math.cos(angle) * distance, y: Math.sin(angle) * distance * .65, width: size, height: size * 1.45, angle: angle - .8, alpha: Math.sin(phase * Math.PI), back: true };
      this.draw(paint, context);
    }
  }

  private shield(context: PlayerPaint): void {
    const { radius: r, time: t } = context; const wave = Math.sin(t * 4);
    const bubble = { frame: 'shield', width: r * (3.45 + wave * .16), alpha: .9 + wave * .08 };
    this.draw(bubble, context);
    const plates = { frame: 'shield-plates', width: r * (3.5 + wave * .1), alpha: .78, angle: t * .42, normal: true };
    this.draw(plates, context);
  }

  private resonance(context: PlayerPaint): void {
    const { radius: r, time: t } = context;
    const aura = { frame: 'resonance-aura', width: r * (3.3 + Math.sin(t * 6) * .18), angle: Math.sin(t * 3) * .15, alpha: .9, back: true };
    this.draw(aura, context);
    for (const side of [-1, 1]) {
      const angle = t * 2.5 + side * Math.PI / 2;
      const mote = { frame: 'resonance-spark', x: Math.cos(angle) * r * 1.5, y: Math.sin(angle) * r * 1.15, width: r * .75, alpha: .8, back: true };
      this.draw(mote, context);
    }
    const pulse = 1 + Math.sin(t * 6) * .16;
    const mark = { frame: 'resonance-mark', x: r * 1.58, y: r * .55 + Math.sin(t * 4) * r * .15, width: r * 1.5 * pulse, alpha: 1, normal: true };
    this.draw(mark, context);
  }

  private guard(state: BuffState, context: PlayerPaint): void {
    const { radius: r, time: t } = context;
    const pulse = Math.sin(t * (state.perfect ? 18 : 5));
    const shell = { frame: 'shield', width: r * (3.65 + pulse * .12), alpha: state.perfect ? 1 : .82 };
    this.draw(shell, context);
    const plates = { frame: 'shield-plates', width: r * 3.9, angle: -t * .65, alpha: .88, normal: true };
    this.draw(plates, context);
    const wave = { frame: 'guard-wave', width: r * (4.2 + pulse * .16), angle: t * .9, alpha: state.perfect ? .95 : .42, back: true };
    this.draw(wave, context);
    if (state.perfect) {
      const flash = { frame: 'guard-wave', width: r * (4.7 + pulse * .2), angle: -t * 2, alpha: .75 };
      this.draw(flash, context);
    }
  }

  private counter(state: BuffState, context: PlayerPaint): void {
    const { radius: r, time: t } = context;
    const fade = Math.min(1, state.counter / .6);
    const aura = { frame: 'counter-aura', width: r * (4.25 + Math.sin(t * 7) * .22), angle: t * .8, alpha: .88 * fade, back: true };
    this.draw(aura, context);
    for (let index = 0; index < 5; index += 1) {
      const phase = (t * .8 + index / 5) % 1;
      const angle = t * 2.2 + index * Math.PI * 2 / 5;
      const distance = r * (1.55 + phase * .6);
      const mote = { frame: 'counter-mote', x: Math.cos(angle) * distance, y: Math.sin(angle) * distance * .85, width: r * (1.1 - phase * .35), angle: angle + Math.PI / 2, alpha: (.6 + .35 * Math.sin(phase * Math.PI)) * fade, back: index % 2 === 0 };
      this.draw(mote, context);
    }
    const mark = { frame: 'counter-mark', x: -r * 1.65, y: r * .6 + Math.sin(t * 5) * r * .14, width: r * (1.7 + Math.sin(t * 6) * .12), angle: -.75, alpha: fade, normal: true };
    this.draw(mark, context);
  }

  private transient(burst: Burst, context: PlayerPaint): void {
    const p = (context.time - burst.start) / burst.duration;
    const r = context.radius; const alpha = Math.sin(p * Math.PI);
    if (burst.kind === 'perfect-block') {
      for (let index = 0; index < 2; index += 1) {
        const progress = Math.max(0, p - index * .16);
        const ripple = { frame: 'guard-wave', width: r * (3.3 + progress * 7), angle: progress * (index ? -2 : 2), alpha: (1 - p) * (index ? .7 : 1) };
        this.draw(ripple, context);
      }
      for (let index = 0; index < 6; index += 1) {
        const angle = index * Math.PI / 3 + burst.angle;
        const spark = { frame: 'shield-shard', x: Math.cos(angle) * r * (1.4 + p * 3.4), y: Math.sin(angle) * r * (1.4 + p * 3.4), width: r * (1.25 - p * .75), angle: angle + p, alpha: 1 - p };
        this.draw(spark, context);
      }
    } else if (burst.kind === 'guard-start' || burst.kind === 'guard-hit') {
      const wave = { frame: 'guard-wave', width: r * (burst.kind === 'guard-start' ? 5.3 - p * 1.6 : 3.7 + p * 2.1), angle: p * 1.5, alpha: (1 - p) * .85 };
      this.draw(wave, context);
    } else if (burst.kind === 'counter-acquire') {
      const aura = { frame: 'counter-aura', width: r * (6.3 - p * 2), angle: -p * 2, alpha, back: true };
      this.draw(aura, context);
    } else if (burst.kind.startsWith('acquire-') || burst.kind === 'ready') {
      const frame = burst.kind === 'ready' ? 'resonance-aura' : burst.kind;
      const paint = { frame, width: r * (5 - p * 1.5), alpha: alpha * .95, angle: p * .6, back: true };
      this.draw(paint, context);
    } else if (burst.kind === 'shield-hit') {
      const paint = { frame: 'shield-hit', x: Math.cos(burst.angle) * r * 1.2, y: Math.sin(burst.angle) * r * 1.2, width: r * (1.8 + p * 1.8), alpha, angle: burst.angle, back: true };
      this.draw(paint, context);
      const ripple = { frame: 'shield', width: r * (3.3 + p * 1.55), alpha: (1 - p) * .95 };
      this.draw(ripple, context);
    } else if (burst.kind === 'shield-break') {
      for (let index = 0; index < 9; index += 1) {
        const angle = index * Math.PI * 2 / 9;
        const paint = { frame: 'shield-shard', x: Math.cos(angle) * r * (1.5 + p * .9), y: Math.sin(angle) * r * (1.5 + p * .6), width: r * .9 * (1 - p), alpha: 1 - p, angle: angle + p, back: true };
        this.draw(paint, context);
      }
    } else if (burst.kind === 'focus-cast') {
      const paint = { frame: 'energy-curl', y: r * .65, width: r * (4.7 - p * 3.8), height: r * (2.2 - p * 1.7), alpha, angle: p * 2.5, back: true };
      this.draw(paint, context);
    } else if (burst.kind === 'release') {
      const dx = Math.cos(burst.angle); const dy = Math.sin(burst.angle);
      const paint = { frame: 'resonance-mark', x: dx * r * (1.58 + p * 1.35), y: dy * r * (1.58 + p * 1.35), width: r * 1.5 * (1 - p * .65), alpha: 1 - p };
      this.draw(paint, context);
      if (!burst.melee) {
        const spark = { frame: 'resonance-spark', x: dx * r * 2.2, y: dy * r * 2.2, width: r * (1.7 + p), alpha: alpha * .9, back: true };
        this.draw(spark, context);
      }
    }
  }

  render(sim: Simulation, viewport: BattleViewport, context: RenderContext): void {
    const now = sim.clock;
    const reset = context.reset || sim.round !== this.round || now < this.previousClock || now - this.previousClock > .8;
    if (reset) { this.players.clear(); this.seen.clear(); this.bursts = []; }
    this.used = 0;
    const alive = new Set<string>();
    for (const player of sim.players) {
      if (player.hp <= 0) continue;
      alive.add(player.id); this.observe(player, sim);
    }
    this.hits(sim, reset);
    this.bursts = this.bursts.filter(burst => alive.has(burst.owner) && now - burst.start < burst.duration);
    for (const id of this.players.keys()) if (!alive.has(id)) this.players.delete(id);
    // Local effects reserve the object budget before teammate decoration.
    for (const mine of [true, false]) for (const player of sim.players) {
      if ((player.id === context.playerId) !== mine || !alive.has(player.id)) continue;
      const layers = context.entities.buffLayers(player.id); const state = this.players.get(player.id);
      if (!layers || !state) continue;
      const paint = { layers, radius: .4 * viewport.unit, alpha: mine ? 1 : .65, time: now };
      if (state.haste) this.wind(state, paint);
      if (state.focus) this.focus(paint);
      if (state.shield > 0) this.shield(paint);
      if (state.ready) this.resonance(paint);
      if (state.counter > 0) this.counter(state, paint);
      if (state.blocking) this.guard(state, paint);
      for (const burst of this.bursts) if (burst.owner === player.id) this.transient(burst, paint);
    }
    for (let index = this.used; index < this.sprites.length; index += 1) if (this.sprites[index].scene) this.sprites[index].setVisible(false);
    this.previousClock = now; this.round = sim.round;
  }

  dispose(): void {
    for (const sprite of this.sprites) if (sprite.scene) sprite.destroy();
    this.sprites = []; this.players.clear(); this.seen.clear(); this.bursts = [];
  }
}
