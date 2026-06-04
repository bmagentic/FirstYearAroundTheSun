import Phaser from 'phaser';
import { InterludeBase } from './InterludeBase';
import { SoundBank } from '../../systems/SoundBank';
import { SpriteBank } from '../../systems/SpriteBank';

type Task = { label: string; icon: string };

const TASKS: Task[] = [
  { label: 'folding laundry', icon: '👚' },
  { label: 'on a call', icon: '📞' },
  { label: 'washing dishes', icon: '🍽' },
  { label: 'soothing Soka', icon: '🐶' },
  { label: 'making coffee', icon: '☕' },
  { label: 'just sitting nearby', icon: '🤍' },
];

const TOTAL_ROUNDS = 6;
const PATIENCE_DECAY_PER_SEC = 0.2;

export class Interlude02_Mama extends InterludeBase {
  private round = 0;
  private chelsea!: Phaser.GameObjects.Container;
  private chelseaTaskX = 0;
  private chelseaTaskY = 0;
  private chelseaCaiusX = 0;
  private chelseaCaiusY = 0;
  private chelseaState: 'task' | 'walking-to' | 'holding' | 'walking-back' = 'task';
  private callBtn!: Phaser.GameObjects.Container;
  private callRing!: Phaser.GameObjects.Arc;
  private taskLabel!: Phaser.GameObjects.Text;
  private patience = 1;
  private patienceBar!: Phaser.GameObjects.Rectangle;
  private patienceBarMaxW = 180;
  private callPending = true;
  private acceptingTap = false;
  private statusText!: Phaser.GameObjects.Text;
  private caius!: Phaser.GameObjects.Container;

  constructor() {
    super('Interlude02_Mama', 'mama');
  }

  preload(): void {
    SpriteBank.preloadInto(this, ['chelsea-idle', 'caius']);
    SoundBank.preload('lullaby');
  }

  create(): void {
    this.setupInterlude();
    this.cameras.main.setBackgroundColor('#2a2030');

    const W = this.scale.width;
    const H = this.scale.height;

    // Top half: Chelsea's area (adjacent rooms)
    this.add.rectangle(W / 2, H * 0.28, W - 30, H * 0.42, 0x3a2a40).setStrokeStyle(1, 0xfde68a, 0.25);
    this.add
      .text(W / 2, 80, 'in another room', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '10px',
        color: '#fde68a',
        letterSpacing: 2,
      } as Phaser.Types.GameObjects.Text.TextStyle)
      .setOrigin(0.5)
      .setAlpha(0.5);

    this.taskLabel = this.add
      .text(W / 2, 110, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '13px',
        color: '#fde68a',
        fontStyle: 'italic',
      })
      .setOrigin(0.5);

    // Bottom half: play mat
    const matY = H * 0.72;
    this.add.ellipse(W / 2, matY, 220, 90, 0x6b8e5a).setStrokeStyle(2, 0xfde68a, 0.3);
    this.caius = this.add.container(W / 2, matY - 8);
    if (SpriteBank.has(this, 'caius')) {
      this.caius.add(this.add.image(0, 0, 'caius').setDisplaySize(28, 28));
    } else {
      this.caius.add(this.add.circle(0, 0, 14, 0xf7c6a3).setStrokeStyle(2, 0x402c1d));
    }

    // Chelsea position anchors
    this.chelseaTaskX = W / 2;
    this.chelseaTaskY = 160;
    this.chelseaCaiusX = W / 2;
    this.chelseaCaiusY = matY - 30;

    this.chelsea = this.add.container(this.chelseaTaskX, this.chelseaTaskY);
    if (SpriteBank.has(this, 'chelsea-idle')) {
      this.chelsea.add(this.add.image(0, -6, 'chelsea-idle').setDisplaySize(32, 82));
    } else {
      const head = this.add.circle(0, -22, 14, 0xf5c7a3).setStrokeStyle(2, 0x6b4530);
      const torso = this.add.rectangle(0, 10, 32, 50, 0x7c5fb0).setStrokeStyle(2, 0xfde68a, 0.7);
      this.chelsea.add([torso, head]);
    }

    // Call button
    this.callBtn = this.add.container(W / 2, H - 130);
    this.callRing = this.add.circle(0, 0, 40, 0xfde68a, 0.4).setStrokeStyle(2, 0xfde68a, 0.85);
    const callLabel = this.add
      .text(0, 0, 'call\nmama', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '11px',
        color: '#1c1410',
        fontStyle: 'bold',
        align: 'center',
      })
      .setOrigin(0.5);
    this.callBtn.add([this.callRing, callLabel]);
    this.callRing.setInteractive({ useHandCursor: true });
    this.callRing.on('pointerdown', () => this.handleCall());

    // Patience bar
    this.add.rectangle(W / 2, H - 60, this.patienceBarMaxW + 4, 8, 0x3a2a1a);
    this.patienceBar = this.add
      .rectangle(W / 2 - this.patienceBarMaxW / 2, H - 60, this.patienceBarMaxW, 6, 0x9ec3e6)
      .setOrigin(0, 0.5);

    this.statusText = this.add
      .text(W / 2, 50, `Round 1 of ${TOTAL_ROUNDS}`, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '12px',
        color: '#fde68a',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.nextRound();
  }

  private nextRound(): void {
    this.round++;
    if (this.round > TOTAL_ROUNDS) {
      this.finish();
      return;
    }
    const task = TASKS[this.round - 1]!;
    this.taskLabel.setText(`${task.icon}  ${task.label}`);
    this.statusText.setText(`Round ${this.round} of ${TOTAL_ROUNDS}`);
    this.chelseaState = 'task';
    this.patience = 1;
    this.callPending = true;
    this.acceptingTap = true;

    // Reposition Chelsea to task anchor
    this.tweens.add({
      targets: this.chelsea,
      x: this.chelseaTaskX,
      y: this.chelseaTaskY,
      duration: 360,
      ease: 'Sine.easeInOut',
    });

    // Pulse call button
    this.tweens.killTweensOf(this.callRing);
    this.tweens.add({
      targets: this.callRing,
      scale: 1.15,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private handleCall(): void {
    if (!this.acceptingTap || !this.callPending) return;
    this.callPending = false;
    this.acceptingTap = false;
    this.tweens.killTweensOf(this.callRing);
    this.callRing.setScale(1);

    // Chelsea walks to Caius
    this.chelseaState = 'walking-to';
    this.tweens.add({
      targets: this.chelsea,
      x: this.chelseaCaiusX,
      y: this.chelseaCaiusY,
      duration: 700,
      ease: 'Sine.easeInOut',
      onComplete: () => this.hold(),
    });
  }

  private hold(): void {
    this.chelseaState = 'holding';
    SoundBank.play('lullaby');
    // Lift Caius briefly (visual: scale + pulse together)
    this.tweens.add({ targets: [this.chelsea, this.caius], scale: 1.08, duration: 800, yoyo: true, hold: 600 });

    const holdMs = 1800;
    this.time.delayedCall(holdMs, () => {
      if (this.round >= TOTAL_ROUNDS) {
        // Round 6: she stays
        void this.showCaption('She stays.', 2400).then(() => this.finish());
        return;
      }
      this.walkBack();
    });
  }

  private walkBack(): void {
    this.chelseaState = 'walking-back';
    this.tweens.add({
      targets: this.chelsea,
      x: this.chelseaTaskX,
      y: this.chelseaTaskY,
      duration: 700,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.time.delayedCall(700, () => this.nextRound());
      },
    });
  }

  override update(_t: number, delta: number): void {
    if (this.chelseaState === 'task' && this.callPending) {
      this.patience = Math.max(0, this.patience - (PATIENCE_DECAY_PER_SEC * delta) / 1000);
      this.patienceBar.width = this.patienceBarMaxW * this.patience;
      // Patience zero: failure isn't real, she still comes
      if (this.patience <= 0) {
        this.handleCall();
      }
    }
  }

  private finish(): void {
    this.cameras.main.fadeOut(900, 30, 25, 40);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.cameras.main.setBackgroundColor('#050409');
      this.cameras.main.fadeIn(800, 0, 0, 0);
      const card = this.add
        .text(this.scale.width / 2, this.scale.height / 2, 'She always comes.', {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '22px',
          color: '#fde68a',
          fontStyle: 'bold',
          align: 'center',
        })
        .setOrigin(0.5)
        .setAlpha(0);
      this.tweens.add({
        targets: card,
        alpha: 1,
        duration: 900,
        onComplete: () => {
          this.time.delayedCall(2800, () => this.completeInterlude());
        },
      });
    });
  }
}
