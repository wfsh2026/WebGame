import Phaser from 'phaser';
import { collectionTarget } from '../app/demo-data';

interface DemoGameOptions {
  theme: string;
  partySize: number;
  onProgress: (count: number) => void;
  onComplete: () => void;
}

export function createDemoGame(parent: HTMLElement, options: DemoGameOptions): Phaser.Game {
  class DemoScene extends Phaser.Scene {
    private player!: Phaser.GameObjects.Container;
    private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
    private keys?: { up: Phaser.Input.Keyboard.Key; down: Phaser.Input.Keyboard.Key; left: Phaser.Input.Keyboard.Key; right: Phaser.Input.Keyboard.Key };
    private target: { x: number; y: number } | null = null;
    private shards: Phaser.GameObjects.Container[] = [];
    private friends: Phaser.GameObjects.Container[] = [];
    private collected = 0;
    private completed = false;

    constructor() { super('local-demo'); }

    create() {
      const desert = options.theme === 'sand';
      const water = options.theme === 'tide';
      const ground = desert ? 0xead9bb : water ? 0xd9e8e8 : 0xdce5cc;
      const grid = desert ? 0xddc8a5 : water ? 0xc3d9da : 0xcbd7b9;
      const tree = desert ? 0xb48c62 : water ? 0x719e9d : 0x63866a;
      const graphics = this.add.graphics();
      graphics.fillStyle(ground);
      graphics.fillRect(0, 0, 960, 540);
      graphics.lineStyle(1, grid, 0.65);
      for (let x = 0; x < 960; x += 48) { graphics.lineBetween(x, 0, x, 540); }
      for (let y = 0; y < 540; y += 48) { graphics.lineBetween(0, y, 960, y); }
      graphics.fillStyle(0xf2efdc);
      graphics.fillRoundedRect(130, 235, 700, 68, 28);
      graphics.fillRoundedRect(440, 95, 80, 345, 28);
      graphics.fillStyle(0xc0cdb1);
      graphics.fillCircle(480, 270, 71);
      graphics.lineStyle(3, 0xf6f5e9);
      graphics.strokeCircle(480, 270, 58);
      const scenery = [[65, 80], [180, 90], [315, 60], [640, 82], [820, 75], [901, 160], [65, 410], [220, 460], [350, 435], [640, 465], [835, 428], [901, 330]];
      for (const [x, y] of scenery) {
        graphics.fillStyle(0x264b38, 0.08);
        graphics.fillEllipse(x + 8, y + 26, 62, 24);
        graphics.fillStyle(0x9c8f70);
        graphics.fillRoundedRect(x - 4, y, 8, 34, 3);
        graphics.fillStyle(tree);
        graphics.fillCircle(x, y - 5, 26);
        graphics.fillStyle(tree, 0.6);
        graphics.fillCircle(x + 16, y + 5, 20);
      }
      const shardPoints = [[220, 165], [740, 180], [760, 360], [230, 365], [480, 110]];
      for (const [x, y] of shardPoints) {
        const shard = this.add.container(x, y);
        const halo = this.add.circle(0, 0, 24, 0xfdfaf0, 0.55);
        const diamond = this.add.rectangle(0, 0, 17, 17, 0xd5a557);
        diamond.setAngle(45);
        diamond.setStrokeStyle(3, 0xfff5ce);
        shard.add([halo, diamond]);
        this.shards.push(shard);
      }
      for (let index = 1; index < options.partySize; index += 1) {
        const friend = this.makePerson({ x: 440 + index * 36, y: 330, color: 0xa69d86 });
        friend.setAlpha(0.7);
        this.friends.push(friend);
      }
      this.player = this.makePerson({ x: 480, y: 290, color: 0x315e4f });
      if (this.input.keyboard) {
        this.cursors = this.input.keyboard.createCursorKeys();
        const codes = Phaser.Input.Keyboard.KeyCodes;
        this.keys = {
          up: this.input.keyboard.addKey(codes.W), down: this.input.keyboard.addKey(codes.S),
          left: this.input.keyboard.addKey(codes.A), right: this.input.keyboard.addKey(codes.D),
        };
      }
      this.input.on('pointerdown', this.pointTo, this);
      options.onProgress(0);
    }

    private makePerson(config: { x: number; y: number; color: number }): Phaser.GameObjects.Container {
      const body = this.add.container(config.x, config.y);
      const shadow = this.add.ellipse(0, 13, 29, 11, 0x223e34, 0.17);
      const cloak = this.add.rectangle(0, 4, 23, 25, config.color);
      const head = this.add.circle(0, -12, 11, 0xe9c4a2);
      const hair = this.add.arc(0, -15, 12, 180, 360, false, 0x334e43);
      body.add([shadow, cloak, head, hair]);
      return body;
    }

    private pointTo(pointer: Phaser.Input.Pointer) {
      if (this.completed) return;
      parent.focus({ preventScroll: true });
      this.target = { x: pointer.worldX, y: pointer.worldY };
    }

    update(time: number, delta: number) {
      if (!this.player || this.completed) return;
      let dx = 0;
      let dy = 0;
      if (this.cursors?.left.isDown || this.keys?.left.isDown) dx -= 1;
      if (this.cursors?.right.isDown || this.keys?.right.isDown) dx += 1;
      if (this.cursors?.up.isDown || this.keys?.up.isDown) dy -= 1;
      if (this.cursors?.down.isDown || this.keys?.down.isDown) dy += 1;
      if (dx !== 0 || dy !== 0) this.target = null;
      else if (this.target) {
        dx = this.target.x - this.player.x;
        dy = this.target.y - this.player.y;
        const remaining = Math.hypot(dx, dy);
        if (remaining < 5) { this.target = null; dx = 0; dy = 0; }
      }
      const length = Math.hypot(dx, dy);
      if (length > 0) {
        const step = Math.min(delta, 45) * 0.22;
        const x = Phaser.Math.Clamp(this.player.x + dx / length * step, 35, 925);
        const y = Phaser.Math.Clamp(this.player.y + dy / length * step, 35, 505);
        this.player.setPosition(x, y);
      }
      this.friends.forEach((friend, index) => {
        const angle = time * 0.0006 + index * 2;
        const x = 480 + Math.cos(angle) * 95;
        const y = 290 + Math.sin(angle) * 70;
        friend.setPosition(x, y);
      });
      for (const shard of this.shards) {
        if (!shard.active) continue;
        const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, shard.x, shard.y);
        if (distance > 30) continue;
        shard.setActive(false);
        shard.setVisible(false);
        this.collected += 1;
        options.onProgress(this.collected);
      }
      if (this.collected >= collectionTarget) {
        this.completed = true;
        this.time.delayedCall(500, options.onComplete);
      }
    }
  }

  const game = new Phaser.Game({
    type: Phaser.AUTO, parent, width: 960, height: 540, backgroundColor: '#dce5cc',
    scene: DemoScene, scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    render: { antialias: true }, input: { keyboard: { target: parent } },
  });
  return game;
}
