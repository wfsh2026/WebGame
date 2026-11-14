import { makePlayer } from '@web-game-world/simulation';
import type { Enemy, EnemyHazard, Player } from '@web-game-world/simulation';
import type { AbilityView, PlayerView, Snapshot } from '@web-game-world/contracts';
import { protocolVersion } from '@web-game-world/contracts';
import content from '../../../../apps/web/src/network/content';
import { OnlineScene } from '../../../../apps/web/src/game/online-scene';
import type { SceneBridge } from '../../../../apps/web/src/game/online-scene';

export type ReviewMode = 'auto' | 'manual';
export interface GuardReviewFrame { player: PlayerView; phase: string; incoming: string; outgoing: string; clock: number; events: string[] }

function abilities(player: Player): AbilityView[] {
  return player.equipment.branches.map(branch => {
    const state = player.abilityStates.find(entry => entry.itemId === branch.item.id);
    const item = branch.item;
    return { id: item.id, name: item.name, kind: 'skill', skillType: item.skillType ?? 'ranged', icon: item.effect ?? '', interval: item.interval, remaining: state?.remaining ?? 0, cost: item.cost, state: state?.state ?? '就绪', triggers: state?.count ?? 0 };
  });
}

export function guardReviewSnapshot(): Snapshot {
  const identity = { id: 'guard-review-player', name: '格挡与精防体验' };
  const player = makePlayer(identity, content);
  return { protocol: protocolVersion, roomId: 'perfect-guard-local', hostId: player.id, stage: 'combat', round: 1, seconds: 60, width: 30, height: 22, players: [player], enemies: [], projectiles: [], effects: [], results: [], error: '', serverTime: 0 };
}

export class GuardReviewScene extends OnlineScene {
  mode: ReviewMode = 'auto';
  private start = 0;
  private nextReport = 0;
  private issued = new Set<string>();
  private observed = new Set<string>();
  private incoming = '等待命中';
  private outgoing = '等待攻击';
  private history: string[] = [];
  private serial = 0;
  private previousBlock = false;

  constructor(bridge: SceneBridge, private report: (frame: GuardReviewFrame) => void) { super(bridge); }

  create(): void {
    super.create();
    if (this.load.totalFailed > 0) return;
    const sim = this.world.simulation;
    sim.config = { ...content, expedition: undefined, waves: [], cycleWaves: false, roundDuration: 3600 };
    sim.arena.obstacles = []; sim.round = 1; sim.presentationOnly = false;
    this.world.authoritative = true; this.world.lastSnapshot = this.bridge.current;
    this.resetRun(); this.focusActive = true;
  }

  resetRun(): void {
    const sim = this.world.simulation;
    const identity = { id: this.bridge.playerId, name: '格挡与精防体验' };
    const player = makePlayer(identity, content);
    player.x = 15; player.y = 13; player.maxHp = 1000; player.hp = 1000; player.stats.physicalDefense = 0;
    const base = content.enemies.find(enemy => enemy.kind === 'wolf-normal') ?? content.enemies[0];
    const definition = { ...base, speed: 0, hp: 1000000, damage: 100 };
    const target: Enemy = { id: 'guard-review-target', x: 16.7, y: 13, kind: base.kind, radius: base.radius, hp: definition.hp, maxHp: definition.hp, state: 'recovery', facingX: -1, facingY: 0, timer: 100000, targetId: player.id, definition };
    sim.players = [player]; sim.enemies = [target]; sim.effects = []; sim.projectiles = []; sim.hazards = []; sim.poisonWait = {};
    sim.waveSchedules = []; sim.waveQueue = []; sim.finished = false; sim.preparing = false;
    this.start = sim.clock; this.issued.clear(); this.observed.clear(); this.history = []; this.previousBlock = false;
    this.incoming = '等待命中'; this.outgoing = '等待攻击'; this.world.feedbackReset = true;
    this.focusActive = true;
  }

  setMode(mode: ReviewMode): void {
    this.mode = mode; this.keys.SPACE.isDown = false; this.resetRun();
  }

  attack(options: { delay: number; poison?: boolean }): void {
    const player = this.world.localPlayer;
    if (!player) return;
    this.serial += 1;
    const hazard: EnemyHazard = { id: `guard-review-hazard-${this.serial}`, owner: 'guard-review-target', kind: options.poison ? 'poison' : 'root', x: player.x, y: player.y, age: 0, delay: options.delay, duration: options.poison ? .3 : .12, radius: .9, damage: 100, angle: 0, gap: 0, sourceX: player.x, sourceY: player.y - 3, hitIds: [], persistent: true, length: 1.5, width: .5 };
    this.world.simulation.poisonWait[player.id] = 0;
    this.world.simulation.hazards.push(hazard);
  }

  private demonstration(age: number): void {
    const block = age >= .8 && age < 2.3 || age >= 3 && age < 3.7;
    this.keys.SPACE.isDown = block;
    if (block && !this.previousBlock) this.blockPress += 1;
    this.previousBlock = block;
    const hits = [{ id: 'normal', at: 1.5 }, { id: 'perfect', at: 3.12 }, { id: 'same-window', at: 3.16 }, { id: 'after-window', at: 3.5 }, { id: 'poison', at: 6 }];
    for (const hit of hits) {
      if (age < hit.at || this.issued.has(hit.id)) continue;
      this.issued.add(hit.id);
      const options = { delay: 0, poison: hit.id === 'poison' };
      this.attack(options);
    }
  }

  update(time: number, delta: number): void {
    if (!this.entities) return;
    let age = this.world.simulation.clock - this.start;
    if (this.mode === 'auto' && age >= 16) { this.resetRun(); age = 0; }
    if (this.mode === 'auto') { this.focusActive = true; this.demonstration(age); }
    super.update(time, delta);
    const sim = this.world.simulation; const player = this.world.localPlayer;
    if (!player) return;
    for (const effect of sim.effects) {
      if (!effect.targetId || this.observed.has(effect.id)) continue;
      this.observed.add(effect.id);
      const amount = Math.round(effect.damage ?? 0);
      if (effect.targetKind === 'player') {
        this.incoming = effect.kind === 'perfect-block' ? '精防成功 · 伤害 0' : effect.kind === 'block' ? `全方位格挡 · 伤害 ${amount}` : `未格挡 · 伤害 ${amount}`;
        this.history = [this.incoming, ...this.history].slice(0, 4);
      } else if (effect.owner === player.id) this.outgoing = `实际伤害 ${amount}${(player.guard?.counterLeft ?? 0) > 0 ? ' · 反击 ×2' : ''}`;
    }
    if (time < this.nextReport) return;
    this.nextReport = time + 100;
    const currentAbilities = abilities(player);
    const view: PlayerView = { ...player, guard: player.guard ? { ...player.guard } : undefined, abilities: currentAbilities };
    const phase = player.blocking ? (player.guard?.windowLeft ?? 0) > 0 ? '精防窗口' : '全方位格挡 · 减伤50%' : (player.guard?.counterLeft ?? 0) > 0 ? '反击 · 伤害×2' : '自动攻击';
    const frame = { player: view, phase, incoming: this.incoming, outgoing: this.outgoing, clock: sim.clock - this.start, events: [...this.history] };
    this.report(frame);
  }
}
