import Phaser from 'phaser';
import { ChapterBase } from './ChapterBase';

type FaceMood = 'silly' | 'surprised' | 'loving';

const MOODS: FaceMood[] = ['silly', 'surprised', 'loving'];
const PEAK_WINDOW_MS = 320;

export class Ch02_FirstSmile extends ChapterBase {
  private round = 0;
  private chelsea!: Phaser.GameObjects.Container;
  private mouthArc!: Phaser.GameObjects.Arc;
  private eyeL!: Phaser.GameObjects.Arc;
  private eyeR!: Phaser.GameObjects.Arc;
  private statusText!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  private peakAt = 0;
  private acceptingTap = false;
  private moodActive: FaceMood | null = null;
  private smileCount = 0;
  private caiusFace!: Phaser.GameObjects.Container;

  constructor() {
    super('Ch02_FirstSmile', 2);
  }

  create(): void {
    this.setup();
    this.cameras.main.setBackgroundColor('#3a2515');

    const W = this.scale.width;
    const H = this.scale.height;

    // Living room ambience
    this.add.rectangle(W / 2, H / 2 + 60, W - 40, H * 0.7, 0x6b4530).setStrokeStyle(2, 0xb88c5a, 0.4);

    // Chelsea face (center, large)
    this.chelsea = this.add.container(W / 2, H / 2 - 60);
    const head = this.add.circle(0, 0, 60, 0xf5c7a3).setStrokeStyle(3, 0x6b4530);
    this.eyeL = this.add.circle(-22, -8, 6, 0x2a1a0e);
    this.eyeR = this.add.circle(22, -8, 6, 0x2a1a0e);
    const cheekL = this.add.circle(-30, 14, 6, 0xeb9a8a, 0.7);
    const cheekR = this.add.circle(30, 14, 6, 0xeb9a8a, 0.7);
    this.mouthArc = this.add.circle(0, 18, 14, 0xc66a3a, 0.85);
    this.chelsea.add([head, this.eyeL, this.eyeR, cheekL, cheekR, this.mouthArc]);

    // Caius face below, small, will smile back on success
    this.caiusFace = this.add.container(W / 2, H - 240);
    const cHead = this.add.circle(0, 0, 24, 0xf7c6a3).setStrokeStyle(2, 0x402c1d);
    const cEyeL = this.add.circle(-8, -4, 2.5, 0x2a1a0e);
    const cEyeR = this.add.circle(8, -4, 2.5, 0x2a1a0e);
    const cMouth = this.add.arc(0, 8, 6, 0, 180, false, 0x2a1a0e).setStrokeStyle(2, 0x2a1a0e);
    this.caiusFace.add([cHead, cEyeL, cEyeR, cMouth]);

    this.statusText = this.add
      .text(W / 2, 70, 'Watch her face…', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '15px',
        color: '#fde68a',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.hint = this.add
      .text(W / 2, H - 90, 'Tap anywhere when her smile peaks', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '12px',
        color: '#fde68a',
      })
      .setOrigin(0.5)
      .setAlpha(0.55);

    this.input.on('pointerdown', () => this.handleTap());

    void this.intro('His first smile was for her.', 'Tap when her smile reaches its peak.').then(() => {
      this.nextRound();
    });
  }

  private nextRound(): void {
    if (this.smileCount >= 3) {
      this.win();
      return;
    }
    const mood = MOODS[this.round % MOODS.length]!;
    this.round++;
    this.moodActive = mood;
    this.statusText.setText('Watching…');
    this.statusText.setAlpha(0.7);
    this.acceptingTap = false;

    // Wind-up
    this.tweens.add({
      targets: this.chelsea,
      scale: 0.96,
      duration: 600,
      ease: 'Sine.easeOut',
      onComplete: () => this.expressionPeak(mood),
    });
  }

  private expressionPeak(mood: FaceMood): void {
    // Apply mood and schedule peak window
    this.applyFace(mood, false);
    const ramp = 700;
    this.tweens.add({
      targets: this.chelsea,
      scale: 1.05,
      duration: ramp,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.applyFace(mood, true);
        this.peakAt = this.time.now;
        this.acceptingTap = true;
        this.statusText.setText('Now!');
        this.statusText.setColor('#fff3c7');
        this.statusText.setAlpha(1);

        // Auto-decay after peak window if no tap
        this.time.delayedCall(PEAK_WINDOW_MS + 200, () => {
          if (!this.acceptingTap) return;
          this.acceptingTap = false;
          this.softFail('missed-peak', 'Almost! Watch again.');
          this.resetFace();
          this.time.delayedCall(900, () => this.nextRound());
        });
      },
    });
  }

  private applyFace(mood: FaceMood, atPeak: boolean): void {
    if (mood === 'silly') {
      this.mouthArc.setScale(atPeak ? 1.6 : 1.2, atPeak ? 0.6 : 0.9);
      this.eyeL.setScale(0.6, 1);
      this.eyeR.setScale(1, 0.6);
    } else if (mood === 'surprised') {
      this.mouthArc.setScale(0.6, atPeak ? 1.8 : 1.2);
      this.eyeL.setScale(atPeak ? 1.4 : 1.1);
      this.eyeR.setScale(atPeak ? 1.4 : 1.1);
    } else {
      // loving
      this.mouthArc.setScale(atPeak ? 1.4 : 1.1, atPeak ? 0.8 : 0.9);
      this.eyeL.setScale(0.4, 0.4);
      this.eyeR.setScale(0.4, 0.4);
    }
  }

  private resetFace(): void {
    this.mouthArc.setScale(1, 1);
    this.eyeL.setScale(1, 1);
    this.eyeR.setScale(1, 1);
    this.chelsea.setScale(1);
  }

  private handleTap(): void {
    if (!this.acceptingTap || !this.moodActive) return;
    const dt = this.time.now - this.peakAt;
    this.acceptingTap = false;

    if (dt <= PEAK_WINDOW_MS) {
      // Hit
      this.smileCount++;
      this.statusText.setText(`Smile ${this.smileCount} / 3`);
      this.statusText.setColor('#fde68a');
      // Caius smiles back
      this.tweens.add({
        targets: this.caiusFace,
        scale: 1.25,
        duration: 200,
        yoyo: true,
        ease: 'Sine.easeOut',
      });
      this.tweens.add({
        targets: this.chelsea,
        scale: 1.15,
        duration: 250,
        yoyo: true,
      });
      this.time.delayedCall(700, () => {
        this.resetFace();
        this.nextRound();
      });
    } else {
      this.softFail('late', 'A touch late — try again');
      this.resetFace();
      this.time.delayedCall(900, () => this.nextRound());
    }
  }

  private win(): void {
    this.acceptingTap = false;
    this.statusText.setText('She melts.');
    this.statusText.setColor('#fff3c7');
    this.hint.setAlpha(0);
    this.tweens.add({
      targets: this.chelsea,
      scale: 1.1,
      duration: 500,
      yoyo: true,
      onComplete: () => this.completeChapter(),
    });
  }
}
