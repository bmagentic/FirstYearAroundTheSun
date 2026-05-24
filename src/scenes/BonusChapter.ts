import Phaser from 'phaser';
import { ChapterBase } from './chapters/ChapterBase';
import { SaveManager } from '../systems/SaveManager';
import { track } from '../systems/Analytics';

const DURATION_MS = 60_000;
const SPAWN_INTERVAL_MS = 900;
const WIN = 15;

type Toy = {
  obj: Phaser.GameObjects.Container;
  vy: number;
  alive: boolean;
};

export class BonusChapter extends ChapterBase {
  private toys: Toy[] = [];
  private caught = 0;
  private caius!: Phaser.GameObjects.Container;
  private dragX = 0;
  private active = false;
  private endsAt = 0;
  private nextSpawnAt = 0;
  private scoreText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private combo = 0;
  private maxCombo = 0;

  constructor() {
    // Use chapter id 0 to indicate bonus (we'll mark completion via SaveManager.markBonusComplete)
    super('BonusChapter', 0);
  }

  create(): void {
    this.setup();
    this.cameras.main.setBackgroundColor('#7aa8d8');

    const W = this.scale.width;
    const H = this.scale.height;

    // City below
    for (let i = 0; i < 6; i++) {
      const x = (i + 0.5) * (W / 6);
      const h = 40 + Math.random() * 40;
      this.add.rectangle(x, H - 60, W / 6 - 6, h, 0x2a3a55).setStrokeStyle(1, 0x6b8eb6, 0.4);
    }
    this.add.rectangle(W / 2, H - 30, W, 40, 0x6b8e5a);

    // Caius with cape + Dad's airplane arms
    this.caius = this.add.container(W / 2, H - 150);
    const dadArms = this.add.rectangle(0, 22, 120, 16, 0xe6c4a0).setStrokeStyle(1, 0x6b4530);
    const cape = this.add.triangle(0, -4, -20, 0, 20, 0, 0, 36, 0xb91c1c).setStrokeStyle(1, 0xfde68a);
    const body = this.add.circle(0, 0, 16, 0xf7c6a3).setStrokeStyle(2, 0x402c1d);
    this.caius.add([dadArms, cape, body]);
    this.dragX = W / 2;

    this.scoreText = this.add
      .text(W / 2, 60, '0 caught', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '16px',
        color: '#fde68a',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.timerText = this.add
      .text(W / 2, 86, '60', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '12px',
        color: '#fde68a',
      })
      .setOrigin(0.5);

    this.add
      .text(W / 2, H - 90, 'Drag to move. Catch the toys.', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '11px',
        color: '#fde68a',
      })
      .setOrigin(0.5)
      .setAlpha(0.55);

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.isDown) this.dragX = p.x;
    });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.dragX = p.x;
    });

    void this.intro('Crime Fighting Super Baby', 'Catch the falling toys.').then(() => {
      this.active = true;
      this.endsAt = this.time.now + DURATION_MS;
      this.nextSpawnAt = this.time.now + 400;
    });
  }

  override update(_t: number, delta: number): void {
    if (!this.active) return;
    const dt = delta / 1000;

    // Smooth caius x
    const W = this.scale.width;
    const clamped = Phaser.Math.Clamp(this.dragX, 50, W - 50);
    this.caius.x = Phaser.Math.Linear(this.caius.x, clamped, 0.2);

    // Spawn toys
    if (this.time.now >= this.nextSpawnAt) {
      this.spawnToy();
      this.nextSpawnAt = this.time.now + SPAWN_INTERVAL_MS - Math.min(450, this.caught * 22);
    }

    // Update toys
    for (const t of this.toys) {
      if (!t.alive) continue;
      t.obj.y += t.vy * dt;
      // Catch detection
      const dx = t.obj.x - this.caius.x;
      const dy = t.obj.y - this.caius.y;
      if (Math.abs(dx) < 36 && Math.abs(dy) < 22) {
        this.catch(t);
      } else if (t.obj.y > this.scale.height - 50) {
        t.alive = false;
        this.combo = 0;
        this.tweens.add({ targets: t.obj, alpha: 0, duration: 200, onComplete: () => t.obj.destroy() });
      }
    }
    this.toys = this.toys.filter((t) => t.alive);

    const remaining = Math.max(0, this.endsAt - this.time.now);
    this.timerText.setText(String(Math.ceil(remaining / 1000)));
    if (remaining <= 0) {
      this.active = false;
      this.evaluate();
    }
  }

  private spawnToy(): void {
    const W = this.scale.width;
    const x = Phaser.Math.Between(40, W - 40);
    const colors = [0xfde68a, 0xfbbf24, 0xa855f7, 0xeb9a8a, 0x4ade80, 0x9ec3e6];
    const color = colors[Phaser.Math.Between(0, colors.length - 1)] ?? 0xfde68a;
    const c = this.add.container(x, 60);
    const r = this.add.circle(0, 0, 14, color).setStrokeStyle(2, 0xfff3c7);
    c.add(r);
    const vy = Phaser.Math.Between(140, 220);
    this.toys.push({ obj: c, vy, alive: true });
  }

  private catch(t: Toy): void {
    t.alive = false;
    this.caught++;
    this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.scoreText.setText(this.combo >= 3 ? `${this.caught} caught (x${this.combo})` : `${this.caught} caught`);
    this.tweens.add({ targets: t.obj, scale: 1.8, alpha: 0, duration: 220, onComplete: () => t.obj.destroy() });
  }

  private evaluate(): void {
    if (this.caught >= WIN) {
      SaveManager.markBonusComplete();
      track('bonus_chapter_completed', { caught: this.caught, max_combo: this.maxCombo });
      track('brutus_unlocked', { path: 'bonus' });
      this.scoreText.setText(`★ ${this.caught} caught!`);
      this.time.delayedCall(900, () => this.fadeToHouse());
    } else {
      this.softFail('not-enough', `${this.caught} of ${WIN}. Try again, super baby!`);
      this.time.delayedCall(1400, () => this.scene.restart());
    }
  }

  private fadeToHouse(): void {
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('HouseScene', { profile: SaveManager.getActiveProfile() });
    });
  }
}
