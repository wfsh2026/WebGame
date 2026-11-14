import Phaser from 'phaser';
import type { Vec } from '@web-game-world/simulation';
import type { BattleViewport } from './battle-entities';
import type { CombatSound } from './combat-sound';

export interface PickupFlight { id: string; playerId: string; origin: Vec; frame: number; color: number; size: number; duration?: number; experience?: boolean; label?: string; landed?: () => void }
interface Flight { request: PickupFlight; born: number; icon: Phaser.GameObjects.Image; halo: Phaser.GameObjects.Image; trails: Phaser.GameObjects.Image[]; history: Vec[] }
interface Pulse { playerId: string; born: number; color: number; image: Phaser.GameObjects.Image; label?: Phaser.GameObjects.Text }

export class PickupEffects {
  sound?: CombatSound;
  private flights = new Map<string, Flight>();
  private pending = new Map<string, PickupFlight>();
  private pulses: Pulse[] = [];
  private seen = new Set<string>();
  private labelTotals = new Map<string, { text: Phaser.GameObjects.Text; amount: number; at: number }>();
  constructor(private scene: Phaser.Scene) {}
  get activeFlights(): number { return this.flights.size + this.pending.size; }
  start(request: PickupFlight): void {
    if (this.seen.has(request.id)) return;
    if (this.flights.size >= 80) { this.pending.set(request.id, request); return; }
    this.seen.add(request.id);
    if (this.seen.size > 4096) { const first = this.seen.values().next().value; if (first) this.seen.delete(first); }
    const icon = this.scene.add.image(0, 0, 'loot-symbols', request.frame); icon.setDepth(12);
    const halo = this.scene.add.image(0, 0, 'loot-growth', 8); halo.setTint(request.color); halo.setDepth(11); halo.setBlendMode(Phaser.BlendModes.ADD);
    const trails: Phaser.GameObjects.Image[] = [];
    for (let index = 0; index < 6; index += 1) { const trail = this.scene.add.image(0, 0, 'loot-growth', 10); trail.setDepth(11); trail.setTint(request.color); trail.setBlendMode(Phaser.BlendModes.ADD); trails.push(trail); }
    this.flights.set(request.id, { request, born: this.scene.time.now, icon, halo, trails, history: [] });
  }
  absorb(playerId: string, color: number, label?: string): void {
    if (label) for (const pulse of this.pulses) {
      if (pulse.playerId === playerId && pulse.label?.text.startsWith('经验') === label.startsWith('经验')) { pulse.label?.destroy(); pulse.label = undefined; }
    }
    const image = this.scene.add.image(0, 0, 'loot-growth', 12); image.setTint(color); image.setBlendMode(Phaser.BlendModes.ADD); image.setDepth(13);
    const style = { fontSize: '15px', color: '#f4f4df', stroke: '#14251e', strokeThickness: 4, fontFamily: 'Microsoft YaHei, sans-serif' };
    const text = label ? this.scene.add.text(0, 0, label, style) : undefined; text?.setOrigin(.5); text?.setDepth(14); text?.setTint(color);
    this.pulses.push({ playerId, born: this.scene.time.now, color, image, label: text });
    this.sound?.play('pickup', .7, 0);
  }
  experience(playerId: string, amount: number): void {
    const now = this.scene.time.now; const previous = this.labelTotals.get(playerId);
    if (previous && now - previous.at < 240 && previous.text.active) { previous.amount += amount; previous.at = now; previous.text.setText(`经验 +${previous.amount}`); return; }
    this.absorb(playerId, 0x76f6e6, `经验 +${amount}`);
    const text = this.pulses[this.pulses.length - 1].label;
    if (text) this.labelTotals.set(playerId, { text, amount, at: now });
  }
  render(players: readonly (Vec & { id: string })[], viewport: BattleViewport): void {
    const now = this.scene.time.now;
    for (const [id, flight] of this.flights) {
      const target = players.find(player => player.id === flight.request.playerId);
      if (!target) { this.remove(flight); this.flights.delete(id); continue; }
      const age = now - flight.born; const duration = flight.request.duration ?? 420;
      const progress = Math.min(1, age / duration); const acceleration = progress * progress;
      const { origin } = flight.request; const dx = target.x - origin.x; const dy = target.y - origin.y;
      const distance = Math.hypot(dx, dy); const bend = Math.sin(progress * Math.PI) * Math.min(.7, distance * .2);
      const point = { x: origin.x + dx * acceleration - dy / (distance || 1) * bend, y: origin.y + dy * acceleration + dx / (distance || 1) * bend - (1 - progress) * .2 };
      flight.history.unshift(point); if (flight.history.length > 7) flight.history.pop();
      const x = viewport.ox + point.x * viewport.unit; const y = viewport.oy + point.y * viewport.unit;
      const size = flight.request.size * (1 - acceleration * .65);
      const fade = Math.max(0, progress - .85);
      flight.icon.setPosition(x, y); flight.icon.setDisplaySize(size, size); flight.icon.setAlpha(1 - fade * 3);
      flight.halo.setPosition(x, y); flight.halo.setDisplaySize(size * 1.65, size * 1.65); flight.halo.setAlpha(.6);
      for (let index = 0; index < flight.trails.length; index += 1) {
        const head = flight.history[index]; const tail = flight.history[index + 1]; const trail = flight.trails[index];
        if (!head || !tail) { trail.setVisible(false); continue; }
        const length = Math.hypot(head.x - tail.x, head.y - tail.y) * viewport.unit;
        const rotation = Math.atan2(head.y - tail.y, head.x - tail.x);
        const tx = viewport.ox + (head.x + tail.x) * .5 * viewport.unit; const ty = viewport.oy + (head.y + tail.y) * .5 * viewport.unit;
        trail.setVisible(true); trail.setPosition(tx, ty); trail.setRotation(rotation); trail.setDisplaySize(length + 20, 18 - index * 1.5); trail.setAlpha(.8 - index * .1);
      }
      if (progress < 1) continue;
      if (!flight.request.experience) this.absorb(target.id, flight.request.color, flight.request.label);
      flight.request.landed?.(); this.remove(flight); this.flights.delete(id);
    }
    this.pulses = this.pulses.filter(pulse => {
      const target = players.find(player => player.id === pulse.playerId); const age = now - pulse.born;
      if (!target || age > 750) { pulse.image.destroy(); pulse.label?.destroy(); return false; }
      const x = viewport.ox + target.x * viewport.unit; const y = viewport.oy + target.y * viewport.unit;
      const fraction = Math.min(1, age / 230); const opacity = Math.max(0, 1 - age / 300);
      const size = viewport.unit * (.65 + fraction * .65);
      pulse.image.setPosition(x, y); pulse.image.setDisplaySize(size, size); pulse.image.setAlpha(opacity);
      const labelOffset = pulse.label?.text.startsWith('经验') ? 1.1 : .75;
      const labelAlpha = Math.min(1, (750 - age) / 180);
      pulse.label?.setPosition(x, y - viewport.unit * labelOffset - age * .025); pulse.label?.setAlpha(labelAlpha);
      return true;
    });
    for (const [id, total] of this.labelTotals) if (!total.text.active) this.labelTotals.delete(id);
    for (const [id, request] of this.pending) {
      if (this.flights.size >= 80) break;
      this.pending.delete(id); this.start(request);
    }
  }
  private remove(flight: Flight): void { flight.icon.destroy(); flight.halo.destroy(); for (const trail of flight.trails) trail.destroy(); }
  reset(): void {
    for (const flight of this.flights.values()) this.remove(flight);
    for (const pulse of this.pulses) { pulse.image.destroy(); pulse.label?.destroy(); }
    this.flights.clear(); this.pending.clear(); this.pulses = []; this.seen.clear(); this.labelTotals.clear();
  }
}
