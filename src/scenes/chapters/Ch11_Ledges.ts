import Phaser from 'phaser';
import { ChapterBase } from './ChapterBase';
import { SoundBank } from '../../systems/SoundBank';
import { SpriteBank } from '../../systems/SpriteBank';
import { RetryPopup } from '../../ui/RetryPopup';

type StationId = 'sectional' | 'sidetable' | 'coffeetable' | 'barstool' | 'floor';

const HOLD_SECONDS = 1.2;
const FLOOR_STEPS = 6;
const MAX_SLIPS = 3;

type Station = {
  id: StationId;
  x: number;
  width: number;
  height: number;
  label: string;
  color: number;
};

export class Ch11_Ledges extends ChapterBase {
  private stations: Station[] = [];
  private stationIndex = 0;
  private caius!: Phaser.GameObjects.Container;
  private gripBtn!: Phaser.GameObjects.Arc;
  private gripLabel!: Phaser.GameObjects.Text;
  private gauge!: Phaser.GameObjects.Arc;
  private hint!: Phaser.GameObjects.Text;
  private chelseaSprite!: Phaser.GameObjects.Image;

  private holding = false;
  private holdProgress = 0;
  private active = false;
  private floorWalkStep = 0;
  private inFloorWalk = false;

  private baseY = 0;
  private slips = 0;
  private retryPopup!: RetryPopup;

  constructor() {
    super('Ch11_Ledges', 11);
  }

  preload(): void {
    SpriteBank.preloadInto(this, [
      'caius',
      'furniture-sectional',
      'furniture-coffeetable',
      'furniture-sidetable',
      'furniture-barstool',
      'chelsea-idle',
    ]);
  }

  create(): void {
    this.setup();
    this.retryPopup = new RetryPopup(this);
    this.cameras.main.setBackgroundColor('#1f140e');

    const W = this.scale.width;
    const H = this.scale.height;
    this.baseY = H / 2 + 10;

    // Floor "lava" glow
    const floorGlow = this.add.rectangle(W / 2, this.baseY + 90, W, 60, 0xc26a2e, 0.6);
    this.tweens.add({
      targets: floorGlow,
      alpha: 0.4,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Furniture row (the "ledges")
    this.stations = [
      { id: 'sectional', x: 70, width: 96, height: 56, label: 'sectional', color: 0x8a5a3a },
      { id: 'sidetable', x: 180, width: 60, height: 40, label: 'side table', color: 0xa67449 },
      { id: 'coffeetable', x: 260, width: 80, height: 32, label: 'coffee', color: 0x6d4e36 },
      { id: 'barstool', x: 360, width: 80, height: 60, label: 'barstool', color: 0x8a5a3a },
      { id: 'floor', x: W / 2 + 60, width: 0, height: 0, label: 'floor', color: 0 },
    ];

    const SPRITE_KEY: Record<string, string> = {
      sectional: 'furniture-sectional',
      sidetable: 'furniture-sidetable',
      coffeetable: 'furniture-coffeetable',
      barstool: 'furniture-barstool',
    };
    for (const st of this.stations.slice(0, 4)) {
      const top = this.baseY - st.height / 2;
      this.add.image(st.x, top, SPRITE_KEY[st.id]!).setDisplaySize(st.width, st.height);
    }

    // Chelsea on the floor at far right
    this.chelseaSprite = this.add.image(W - 60, this.baseY + 16, 'chelsea-idle').setDisplaySize(40, 64);
    this.tweens.add({
      targets: this.chelseaSprite,
      y: this.chelseaSprite.y - 4,
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Caius on first station
    const first = this.stations[0]!;
    this.caius = this.add.container(first.x, this.baseY - first.height - 8);
    this.caius.add(this.add.image(0, 0, 'caius').setDisplaySize(24, 24));

    // Grip button + gauge
    this.gauge = this.add.circle(W / 2, H - 130, 60, 0xfde68a, 0).setStrokeStyle(6, 0xfde68a, 0.3);
    this.gripBtn = this.add.circle(W / 2, H - 130, 52, 0x3a2a1a, 0.8).setStrokeStyle(2, 0xfde68a, 0.7);
    this.gripBtn.setInteractive({ useHandCursor: true });
    this.gripBtn.on('pointerdown', () => this.startGrip());
    this.gripBtn.on('pointerup', () => this.endGrip());
    this.gripBtn.on('pointerout', () => this.endGrip());
    this.gripLabel = this.add
      .text(W / 2, H - 130, 'GRIP', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        color: '#fde68a',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.hint = this.add
      .text(W / 2, H - 60, 'Hold GRIP until the gauge fills, then release to step.', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '12px',
        color: '#fde68a',
        align: 'center',
        wordWrap: { width: W - 60 },
      })
      .setOrigin(0.5)
      .setAlpha(0.55);

    void this.intro('Ledges', 'The floor is lava. Make your way to Mama.').then(() => {
      this.active = true;
    });
  }

  private startGrip(): void {
    if (!this.active) return;
    this.holding = true;
    this.gripBtn.setFillStyle(0xfde68a, 0.85);
    this.gripLabel.setColor('#3a2a1a');
  }

  private endGrip(): void {
    if (!this.active || !this.holding) return;
    const wasFull = this.holdProgress >= 0.999;
    this.holding = false;
    this.gripBtn.setFillStyle(0x3a2a1a, 0.8);
    this.gripLabel.setColor('#fde68a');

    if (wasFull) {
      this.step();
    } else {
      this.holdProgress = 0;
      this.updateGauge();
      this.slips++;
      this.softFail('released-too-early', `Slipped! (${this.slips}/${MAX_SLIPS})`);
      if (this.slips >= MAX_SLIPS) {
        this.active = false;
        this.retryPopup.show(() => this.resetRound(), 'Too many slips! Try again!');
      }
    }
  }

  private step(): void {
    this.holdProgress = 0;
    this.updateGauge();

    if (this.inFloorWalk) {
      this.floorWalkStep++;
      const total = FLOOR_STEPS;
      const startX = (this.stations[3]?.x ?? 0) + 30;
      const endX = this.chelseaSprite.x - 30;
      const t = this.floorWalkStep / total;
      const nextX = Phaser.Math.Linear(startX, endX, t);
      this.tweens.add({
        targets: this.caius,
        x: nextX,
        duration: 220,
        ease: 'Sine.easeOut',
      });
      this.hint.setText(`Step ${this.floorWalkStep} of ${total}`);
      if (this.floorWalkStep >= total) {
        this.finishToChelsea();
      }
      return;
    }

    // Furniture step
    this.stationIndex++;
    const next = this.stations[this.stationIndex];
    if (!next) {
      this.beginFloorWalk();
      return;
    }
    if (next.id === 'floor') {
      this.beginFloorWalk();
      return;
    }
    const top = this.baseY - next.height - 8;
    this.tweens.add({
      targets: this.caius,
      x: next.x,
      y: top,
      duration: 260,
      ease: 'Sine.easeOut',
    });

    if (this.stationIndex === this.stations.length - 2) {
      this.hint.setText('Last ledge. Take the first steps to Mama.');
    }
  }

  private beginFloorWalk(): void {
    this.inFloorWalk = true;
    this.hint.setText('Release GRIP each time to take a step');
    // Move Caius onto the floor at armchair edge
    const armchair = this.stations[3]!;
    this.tweens.add({
      targets: this.caius,
      x: armchair.x + 30,
      y: this.baseY + 16,
      duration: 280,
    });
  }

  private resetRound(): void {
    this.slips = 0;
    this.stationIndex = 0;
    this.holdProgress = 0;
    this.inFloorWalk = false;
    this.floorWalkStep = 0;
    this.updateGauge();
    const first = this.stations[0]!;
    this.caius.setPosition(first.x, this.baseY - first.height - 8);
    this.hint.setText('Hold GRIP until the gauge fills, then release to step.');
    this.active = true;
  }

  private finishToChelsea(): void {
    this.active = false;
    SoundBank.play('lullaby');
    this.tweens.add({
      targets: this.caius,
      x: this.chelseaSprite.x,
      duration: 400,
      onComplete: () => {
        this.tweens.add({
          targets: this.chelseaSprite,
          scale: 1.1,
          duration: 300,
          yoyo: true,
          onComplete: () => this.completeChapter(),
        });
      },
    });
  }

  private updateGauge(): void {
    const arc = this.gauge;
    // Use the circle's scale to visualise fill progress
    arc.fillAlpha = this.holdProgress * 0.6;
  }

  override update(_t: number, delta: number): void {
    if (!this.active) return;
    if (this.holding) {
      this.holdProgress = Math.min(1, this.holdProgress + delta / 1000 / HOLD_SECONDS);
      this.updateGauge();
    }
  }
}
