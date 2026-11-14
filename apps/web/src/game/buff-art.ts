import type Phaser from 'phaser';

export const buffTexture = 'player-buffs-v2';
const frames = [
  { name: 'wind-tail', texture: 'banner-vfx-v2', frame: 'wind-bolt', brightness: 1.7 },
  { name: 'wind-feather', texture: 'banner-vfx-v2', frame: 'wind-mote', brightness: 1.55 },
  { name: 'energy-flow', texture: 'banner-vfx-v2', frame: 'energy-wave', brightness: 1.6 },
  { name: 'energy-curl', texture: 'resonance-atlas', frame: 4, brightness: 1.4 },
  { name: 'energy-mote', texture: 'banner-vfx-v2', frame: 'energy-mote', brightness: 2.1 },
  { name: 'shield', texture: 'battle-tactics', frame: 'tactic-protection', brightness: 1.8, hole: .284 },
  { name: 'shield-plates', texture: 'banner-vfx-v2', frame: 'guard-edge', brightness: 1.5, hole: .284 },
  { name: 'shield-hit', texture: 'banner-vfx-v2', frame: 'guard-hit', brightness: 1.7 },
  { name: 'resonance-aura', texture: 'resonance-atlas', frame: 1, brightness: 1.8 },
  { name: 'resonance-mark', texture: 'resonance-atlas', frame: 7, brightness: 1.55 },
  { name: 'resonance-spark', texture: 'resonance-atlas', frame: 3, brightness: 1.5 },
  { name: 'resonance-slash', texture: 'resonance-atlas', frame: 2, brightness: 1.7 },
  { name: 'acquire-haste', texture: 'banner-vfx-v2', frame: 'wind-edge', brightness: 1.8 },
  { name: 'acquire-focus', texture: 'banner-vfx-v2', frame: 'energy-edge', brightness: 1.8 },
  { name: 'acquire-shield', texture: 'banner-vfx-v2', frame: 'guard-edge', brightness: 1.8 },
  { name: 'shield-shard', texture: 'banner-vfx-v2', frame: 'guard-mote', brightness: 1.8 },
  { name: 'guard-wave', texture: 'banner-vfx-v2', frame: 'guard-wave', brightness: 2, hole: .29 },
  { name: 'counter-aura', texture: 'banner-vfx-v2', frame: 'power-edge', brightness: 1.8, hole: .29 },
  { name: 'counter-mote', texture: 'banner-vfx-v2', frame: 'power-mote', brightness: 1.9 },
  { name: 'counter-mark', texture: 'banner-vfx-v2', frame: 'power-bolt', brightness: 1.65 }
];

// Reuse the approved painted art. Brightness and the portrait cutout are baked once,
// so neither filters nor per-player masks are needed during battle.
export function prepareBuffArt(scene: Phaser.Scene): void {
  if (scene.textures.exists(buffTexture)) return;
  const atlas = scene.textures.createCanvas(buffTexture, 1024, 1536);
  if (!atlas) return;
  const context = atlas.getContext();
  for (let index = 0; index < frames.length; index += 1) {
    const spec = frames[index]; const source = scene.textures.getFrame(spec.texture, spec.frame);
    const image = source.source.image;
    if (!(image instanceof HTMLImageElement || image instanceof HTMLCanvasElement)) continue;
    const x = index % 4 * 256 + 2; const y = Math.floor(index / 4) * 256 + 2;
    context.save(); context.filter = `brightness(${spec.brightness}) saturate(1.25)`;
    context.drawImage(image, source.cutX, source.cutY, source.cutWidth, source.cutHeight, x, y, 252, 252);
    const hole = spec.hole ?? 0;
    if (hole > 0) {
      context.filter = 'none'; context.globalCompositeOperation = 'destination-out';
      const radius = 252 * hole;
      context.beginPath(); context.arc(x + 126, y + 126, radius, 0, Math.PI * 2); context.fill();
    }
    context.restore(); atlas.add(spec.name, 0, x, y, 252, 252);
  }
  atlas.refresh();
}
