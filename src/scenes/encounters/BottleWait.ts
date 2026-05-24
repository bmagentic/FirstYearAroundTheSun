import Phaser from 'phaser';
import { EncounterBase } from './EncounterBase';

const FILL_TIME_MS = 30_000;
const PATIENCE_DRAIN_PER_SEC = 0.18;
const PACIFIER_BOOST = 0.32;

export class BottleWait extends EncounterBase {
  private patience = 1;
  private bottleFill = 0;
  private patienceBar!: Phaser.GameObjects.Rectangle;
  private patienceBarMaxW = 220;
  private bottleLiquid!: Phaser.GameObjects.Rectangle;
  private bottleHeight = 0;
  private bottleY = 0;
  private pacifier!: Phaser.GameObjects.Container;
  private active = false;
  private startMs = 0;

  constructor() {
    super('BottleWait', 'bottle-wait');
  }

  create(): void {
    this.setupEncounter();
    this.cameras.main.setBackgroundColor('#352840');
    this.showLabel('Bottle Wait', 'Tap the pacifier to stay calm while it fills');

    const W = this.scale.width;
    const H = this.scale.height;

    // Bottle shape at top
    const bottleX = W / 2;
    const bottleTop = 120;
    this.bottleHeight = 200;
    this.bottleY = bottleTop + this.bottleHeight / 2;
    this.add.rectangle(bottleX, bottleTop - 10, 30, 20, 0xe6c4a0).setStrokeStyle(2, 0x6b4530);
    const bottleShell = this.add.rectangle(bottleX, this.bottleY, 80, this.bottleHeight).setStrokeStyle(3, 0xe6e6f5);
    void bottleShell;
    this.bottleLiquid = this.add
      .rectangle(bottleX, this.bottleY + this.bottleHeight / 2, 74, 0, 0xfff3c7)
      .setOrigin(0.5, 1);

    // Caius
    this.add.circle(W / 2, H * 0.66, 22, 0xf7c6a3).setStrokeStyle(2, 0x402c1d);

    // Patience bar
    this.add
      .text(W / 2, H * 0.66 + 40, 'patience', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '10px',
        color: '#fde68a',
      })
      .setOrigin(0.5)
      .setAlpha(0.5);
    this.add.rectangle(W / 2, H * 0.66 + 60, this.patienceBarMaxW + 4, 10, 0x3a2a1a);
    this.patienceBar = this.add
      .rectangle(W / 2 - this.patienceBarMaxW / 2, H * 0.66 + 60, this.patienceBarMaxW, 8, 0x4ade80)
      .setOrigin(0, 0.5);

    // Pacifier button
    this.pacifier = this.add.container(W / 2, H - 130);
    const ring = this.add.circle(0, 0, 46, 0xeb9a8a, 0.85).setStrokeStyle(2, 0xfde68a);
    const lbl = this.add
      .text(0, 0, 'paci', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '12px',
        color: '#1c1410',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.pacifier.add([ring, lbl]);
    ring.setInteractive({ useHandCursor: true });
    ring.on('pointerdown', () => this.suck());

    this.active = true;
    this.startMs = this.time.now;
  }

  private suck(): void {
    if (!this.active) return;
    this.patience = Math.min(1, this.patience + PACIFIER_BOOST);
    this.tweens.add({ targets: this.pacifier, scale: 1.2, duration: 130, yoyo: true });
  }

  override update(_t: number, delta: number): void {
    if (!this.active) return;
    const dt = delta / 1000;

    // Patience drain
    this.patience = Math.max(0, this.patience - PATIENCE_DRAIN_PER_SEC * dt);
    this.patienceBar.width = this.patienceBarMaxW * this.patience;
    if (this.patience <= 0.5) this.patienceBar.fillColor = 0xfbbf24;
    if (this.patience <= 0.25) this.patienceBar.fillColor = 0xdc2626;
    else if (this.patience > 0.5) this.patienceBar.fillColor = 0x4ade80;

    if (this.patience <= 0) {
      this.active = false;
      this.softFail('cried-out', 'Tears! Try the pacifier sooner.');
      this.time.delayedCall(1100, () => this.scene.restart());
      return;
    }

    // Bottle fill
    const elapsed = this.time.now - this.startMs;
    this.bottleFill = Math.min(1, elapsed / FILL_TIME_MS);
    const fillH = this.bottleHeight * this.bottleFill;
    this.bottleLiquid.height = fillH;

    if (this.bottleFill >= 1) {
      this.active = false;
      this.completeEncounter();
    }
  }
}
