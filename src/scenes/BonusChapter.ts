import Phaser from 'phaser';
import { ChapterBase } from './chapters/ChapterBase';
import { SaveManager } from '../systems/SaveManager';
import { track } from '../systems/Analytics';
import { SpriteBank } from '../systems/SpriteBank';
import { RetryPopup } from '../ui/RetryPopup';

const TOTAL_DROPS = 20;
const SPAWN_INTERVAL_MS = 900;
const WIN = Math.ceil(0.7 * TOTAL_DROPS); // 14
const MAX_MISSES = TOTAL_DROPS - WIN; // 6

type Toy = {
  obj: Phaser.GameObjects.Container;
  vy: number;
  alive: boolean;
};

export class BonusChapter extends ChapterBase {
  private toys: Toy[] = [];
  private caught = 0;
  private missed = 0;
  private spawned = 0;
  private caius!: Phaser.GameObjects.Container;
  private dragX = 0;
  private active = false;
  private nextSpawnAt = 0;
  private scoreText!: Phaser.GameObjects.Text;
  private combo = 0;
  private maxCombo = 0;
  private retryPopup!: RetryPopup;

  constructor() {
    // Use chapter id 0 to indicate bonus (we'll mark completion via SaveManager.markBonusComplete)
    super('BonusChapter', 0);
  }

  preload(): void {
    SpriteBank.preloadInto(this, ['caius', 'obj-cape-red']);
  }

  create(): void {
    this.setup();
    this.retryPopup = new RetryPopup(this);
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
    const cape = SpriteBank.has(this, 'obj-cape-red')
      ? this.add.image(0, 6, 'obj-cape-red').setDisplaySize(38, 42)
      : this.add.triangle(0, -4, -20, 0, 20, 0, 0, 36, 0xb91c1c).setStrokeStyle(1, 0xfde68a);
    const body = this.add.image(0, 0, 'caius').setDisplaySize(32, 32);
    this.caius.add([dadArms, cape, body]);
    this.dragX = W / 2;

    this.scoreText = this.add
      .text(W / 2, 60, `0 / ${WIN}`, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '16px',
        color: '#fde68a',
        fontStyle: 'bold',
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
      this.nextSpawnAt = this.time.now + 400;
    });
  }

  override update(_t: number, delta: number): void {
    if (!this.active) return;
    const dt = delta / 1000;

    const W = this.scale.width;
    const clamped = Phaser.Math.Clamp(this.dragX, 50, W - 50);
    this.caius.x = Phaser.Math.Linear(this.caius.x, clamped, 0.2);

    if (this.spawned < TOTAL_DROPS && this.time.now >= this.nextSpawnAt) {
      this.spawnToy();
      this.spawned++;
      this.nextSpawnAt = this.time.now + SPAWN_INTERVAL_MS - Math.min(450, this.caught * 22);
    }

    for (const t of this.toys) {
      if (!t.alive) continue;
      t.obj.y += t.vy * dt;
      const dx = t.obj.x - this.caius.x;
      const dy = t.obj.y - this.caius.y;
      if (Math.abs(dx) < 36 && Math.abs(dy) < 22) {
        this.catchToy(t);
      } else if (t.obj.y > this.scale.height - 50) {
        t.alive = false;
        this.missed++;
        this.combo = 0;
        this.tweens.add({ targets: t.obj, alpha: 0, duration: 200, onComplete: () => t.obj.destroy() });
      }
    }
    this.toys = this.toys.filter((t) => t.alive);

    this.scoreText.setText(this.combo >= 3 ? `${this.caught} / ${WIN} (x${this.combo})` : `${this.caught} / ${WIN}`);

    if (this.missed > MAX_MISSES) {
      this.active = false;
      this.softFail('too-many-misses', 'Too many misses!');
      this.retryPopup.show(() => this.resetRound(), 'So close, Super Baby! Try again!');
      return;
    }

    if (this.caught >= WIN) {
      this.active = false;
      this.win();
      return;
    }

    if (this.spawned >= TOTAL_DROPS && this.toys.length === 0) {
      this.active = false;
      if (this.caught >= WIN) {
        this.win();
      } else {
        this.softFail('not-enough', `${this.caught} of ${WIN}`);
        this.retryPopup.show(() => this.resetRound(), 'So close, Super Baby! Try again!');
      }
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

  private catchToy(t: Toy): void {
    t.alive = false;
    this.caught++;
    this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.tweens.add({ targets: t.obj, scale: 1.8, alpha: 0, duration: 220, onComplete: () => t.obj.destroy() });
  }

  private win(): void {
    SaveManager.markBonusComplete();
    track('bonus_chapter_completed', { caught: this.caught, max_combo: this.maxCombo });
    track('brutus_unlocked', { path: 'bonus' });
    this.scoreText.setText(`★ ${this.caught} caught!`);
    this.time.delayedCall(900, () => this.fadeToHouse());
  }

  private resetRound(): void {
    for (const t of this.toys) t.obj.destroy();
    this.toys = [];
    this.caught = 0;
    this.missed = 0;
    this.spawned = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.active = true;
    this.nextSpawnAt = this.time.now + 400;
    this.scoreText.setText(`0 / ${WIN}`);
  }

  private fadeToHouse(): void {
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('HouseScene', { profile: SaveManager.getActiveProfile() });
    });
  }
}
