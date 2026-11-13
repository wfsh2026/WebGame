import type { Room } from 'colyseus.js';
import { inputSchema } from '@web-game-world/contracts';
import { battleState, isBattleTransfer } from '@web-game-world/simulation';
import type { BattleTransfer, Controls, Enemy, Simulation } from '@web-game-world/simulation';

export interface Ownership extends BattleTransfer { owner: string; ack: number }
export class ClientBattle {
  pending?: Ownership;
  inputs: { id: string; input: Controls }[] = [];
  owner = '';
  epoch = -1;
  sequence = 0;
  heartbeat = -1000;
  submitted = new Map<number, Simulation['players']>();
  private clock = 0;
  private round = 0;
  private enemies = new Set<string>();
  private builds = new Map<string, number>();
  private defeated = new Map<string, Enemy>();
  private deathsSent = new Map<number, string[]>();
  private timer: number;
  error = '';
  constructor(private room: Room, report: (message: string) => void) {
    room.onMessage('battle-owner', (raw: unknown) => {
      if (!isBattleTransfer(raw) || !('owner' in raw) || typeof raw.owner !== 'string' || !('ack' in raw) || typeof raw.ack !== 'number') return;
      if (raw.epoch <= this.epoch) return;
      this.acknowledge(raw.ack);
      const ack = this.pending && this.pending.owner === raw.owner && raw.ack < 0 ? this.pending.ack : raw.ack;
      if (raw.owner !== this.owner || raw.state.round !== this.round) this.defeated.clear();
      this.round = raw.state.round;
      this.pending = { ...raw, owner: raw.owner, ack };
      this.owner = raw.owner; this.epoch = raw.epoch; this.sequence = 0; this.builds.clear(); this.enemies.clear();
      this.deathsSent.clear(); this.inputs = [];
    });
    room.onMessage('battle-input', (raw: unknown) => {
      if (!raw || typeof raw !== 'object' || !('epoch' in raw) || raw.epoch !== this.epoch || !('id' in raw) || typeof raw.id !== 'string' || !('input' in raw)) return;
      const parsed = inputSchema.safeParse(raw.input);
      if (parsed.success) {
        const previous = this.inputs.find(entry => entry.id === raw.id);
        if (previous) { const dash = previous.input.dash || parsed.data.dash; previous.input = { ...parsed.data, dash }; }
        else this.inputs.push({ id: raw.id, input: parsed.data });
      }
    });
    room.onMessage('battle-ack', (raw: unknown) => {
      if (!raw || typeof raw !== 'object' || !('epoch' in raw) || raw.epoch !== this.epoch || !('sequence' in raw) || typeof raw.sequence !== 'number') return;
      this.acknowledge(raw.sequence);
    });
    room.onMessage('battle-rejected', (raw: unknown) => { if (typeof raw === 'string') { this.error = raw; report(raw); } });
    this.timer = window.setInterval(() => { const now = performance.now(); this.pulse(now); }, 700);
    document.addEventListener('visibilitychange', this.visibility);
    room.send('battle-sync');
  }
  private visibility = (): void => { this.heartbeat = -1000; const now = performance.now(); this.pulse(now); };
  dispose(): void { window.clearInterval(this.timer); document.removeEventListener('visibilitychange', this.visibility); }
  private acknowledge(sequence: number): void {
    for (const [key, ids] of this.deathsSent) {
      if (key > sequence) continue;
      for (const id of ids) this.defeated.delete(id);
      this.deathsSent.delete(key);
    }
  }
  pulse(now: number): void {
    if (now - this.heartbeat < 700) return;
    this.heartbeat = now;
    const active = !document.hidden; this.room.send('battle-active', active);
  }
  submit(sim: Simulation, delta: number): void {
    this.clock += delta;
    const teammates = sim.players.some(player => player.connected && player.id !== this.owner);
    const interval = teammates || sim.defeated.length > 0 || sim.finished ? 100 : 250;
    if (this.clock < interval) return;
    this.clock = 0; this.sequence += 1;
    const players = structuredClone(sim.players); this.submitted.set(this.sequence, players);
    for (const key of this.submitted.keys()) if (key < this.sequence - 20) this.submitted.delete(key);
    const full = battleState(sim);
    for (const enemy of sim.defeated) this.defeated.set(enemy.id, enemy);
    const defeated = [...this.defeated.values()]; const deathIds = defeated.map(enemy => enemy.id);
    this.deathsSent.set(this.sequence, deathIds);
    const moving = sim.players.map(player => {
      const old = this.builds.get(player.id); this.builds.set(player.id, player.buildRevision);
      if (old !== player.buildRevision) return player;
      const { equipment, loadout, buildItems, ...state } = player;
      return state;
    });
    const enemies = sim.enemies.map(enemy => {
      if (!this.enemies.has(enemy.id)) return enemy;
      const { definition, ...moving } = enemy; return moving;
    });
    this.enemies.clear(); for (const enemy of sim.enemies) this.enemies.add(enemy.id);
    const state = { ...full, players: moving, enemies, defeated }; const packet = { epoch: this.epoch, sequence: this.sequence, state };
    this.room.send('battle-frame', packet);
    sim.defeated = [];
    for (const player of sim.players) { player.growthNotices = []; player.fusionNotices = []; }
  }
}
