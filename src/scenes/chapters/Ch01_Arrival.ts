import Phaser from 'phaser';
import { ChapterBase } from './ChapterBase';
import { SoundBank } from '../../systems/SoundBank';

type Direction = 'left' | 'top' | 'right';
type SoundId = 'chelsea-heartbeat' | 'dad-voice' | 'dog-bark';

const ROUND_SOUNDS: SoundId[] = ['chelsea-heartbeat', 'dad-voice', 'dog-bark'];
const DIRECTIONS: Direction[] = ['left', 'top', 'right'];
const SOUND_LABEL: Record<SoundId, string> = {
  'chelsea-heartbeat': "Mama's heartbeat",
  'dad-voice': "Dad's voice",
  'dog-bark': 'A puppy barked',
};

export class Ch01_Arrival extends ChapterBase {
  private round = 0;
  private targetDir: Direction = 'left';
  private accepting = false;
  private dots: Record<Direction, Phaser.GameObjects.Arc> = {} as Record<
    Direction,
    Phaser.GameObjects.Arc
  >;
  private dotPositions: Record<Direction, { x: number; y: number }> = {} as Record<
    Direction,
    { x: number; y: number }
  >;
  private statusText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;

  constructor() {
    super('Ch01_Arrival', 1);
  }

  preload(): void {
    // Try to load real audio if dropped into /public/assets/audio/.
    SoundBank.preload('chelsea-heartbeat');
    SoundBank.preload('dad-voice');
    SoundBank.preload('dog-bark');
  }

  create(): void {
    this.setup();
    this.cameras.main.setBackgroundColor('#070612');

    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;

    // Soft spotlight ring (nursery night feeling)
    const haloOuter = this.add.circle(cx, cy, 180, 0x140e1a, 0.7);
    const haloInner = this.add.circle(cx, cy, 100, 0x2a1f3a, 0.55);
    this.tweens.add({
      targets: [haloInner, haloOuter],
      alpha: { from: 0.8, to: 0.45 },
      duration: 2400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Crib outline
    this.add.rectangle(cx, cy, 110, 88).setStrokeStyle(2, 0x4a3a26, 0.65);

    // Caius in crib
    const body = this.add.circle(cx, cy + 4, 12, 0xf7c6a3).setStrokeStyle(2, 0x402c1d);
    const cheekL = this.add.circle(cx - 4, cy + 6, 2, 0xe89a8a);
    const cheekR = this.add.circle(cx + 4, cy + 6, 2, 0xe89a8a);
    this.tweens.add({
      targets: [body, cheekL, cheekR],
      y: '+=1.5',
      duration: 1800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Direction zones
    const offset = 150;
    this.dotPositions = {
      left: { x: cx - offset, y: cy },
      top: { x: cx, y: cy - offset },
      right: { x: cx + offset, y: cy },
    };

    for (const dir of DIRECTIONS) {
      const pos = this.dotPositions[dir];
      const dot = this.add.circle(pos.x, pos.y, 34, 0x1a0f24, 0.6).setStrokeStyle(2, 0xfde68a, 0.4);
      dot.setInteractive({ useHandCursor: true });
      dot.on('pointerdown', () => this.handleTap(dir));
      this.dots[dir] = dot;
    }

    // Status / hint
    this.statusText = this.add
      .text(cx, 70, 'Listen…', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '18px',
        color: '#fde68a',
      })
      .setOrigin(0.5);

    this.hintText = this.add
      .text(cx, this.scale.height - 90, 'Tap where the sound came from', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '13px',
        color: '#c9b9a0',
      })
      .setOrigin(0.5)
      .setAlpha(0.6);

    void this.intro('The first sound he ever knew.', "Listen for the call, then tap where it came from.").then(() =>
      this.nextRound(),
    );
  }

  private nextRound(): void {
    if (this.round >= ROUND_SOUNDS.length) {
      this.win();
      return;
    }
    const sound = ROUND_SOUNDS[this.round]!;
    this.targetDir = Phaser.Utils.Array.GetRandom([...DIRECTIONS]) as Direction;
    this.statusText.setText('…');
    this.statusText.setAlpha(0.6);

    this.time.delayedCall(550, () => {
      this.playRound(sound);
    });
  }

  private playRound(sound: SoundId): void {
    SoundBank.play(sound);
    this.emitRipple(this.targetDir);
    this.time.delayedCall(900, () => {
      this.accepting = true;
      this.hintText.setAlpha(1);
    });
  }

  private emitRipple(dir: Direction): void {
    const pos = this.dotPositions[dir];
    const center = { x: this.scale.width / 2, y: this.scale.height / 2 };

    // Pulse the source dot
    this.tweens.add({
      targets: this.dots[dir],
      scale: 1.3,
      alpha: 1,
      duration: 350,
      yoyo: true,
      ease: 'Sine.easeOut',
    });

    // 3 expanding rings traveling toward Caius
    for (let i = 0; i < 3; i++) {
      const ring = this.add
        .circle(pos.x, pos.y, 18, 0xfde68a, 0)
        .setStrokeStyle(2, 0xfde68a, 0.7)
        .setDepth(5);
      this.tweens.add({
        targets: ring,
        x: center.x,
        y: center.y,
        alpha: { from: 0.7, to: 0 },
        scale: { from: 1, to: 2.2 },
        duration: 1100,
        delay: i * 180,
        ease: 'Sine.easeOut',
        onComplete: () => ring.destroy(),
      });
    }
  }

  private handleTap(dir: Direction): void {
    if (!this.accepting) return;
    this.accepting = false;

    if (dir === this.targetDir) {
      this.flashDot(dir, 0xfde68a, true);
      this.statusText.setText(SOUND_LABEL[ROUND_SOUNDS[this.round]!]);
      this.statusText.setAlpha(1);
      this.round++;
      this.time.delayedCall(900, () => this.nextRound());
    } else {
      this.flashDot(dir, 0x8a4a3a, false);
      this.softFail('wrong-direction');
      // Replay same round
      this.time.delayedCall(900, () => {
        const sound = ROUND_SOUNDS[this.round]!;
        this.targetDir = Phaser.Utils.Array.GetRandom([...DIRECTIONS]) as Direction;
        this.playRound(sound);
      });
    }
  }

  private flashDot(dir: Direction, color: number, success: boolean): void {
    const dot = this.dots[dir];
    const original = 0x1a0f24;
    dot.setFillStyle(color, 0.9);
    this.tweens.add({
      targets: dot,
      scale: success ? 1.4 : 1.0,
      duration: 220,
      yoyo: true,
      ease: 'Sine.easeOut',
      onComplete: () => dot.setFillStyle(original, 0.6),
    });
  }

  private win(): void {
    this.statusText.setText('Welcome, little one.');
    this.statusText.setColor('#fff3c7');
    this.statusText.setAlpha(1);
    const alreadyDone = this.profile.completedInterludes.includes('first-days');
    this.time.delayedCall(1400, () =>
      this.completeChapter(alreadyDone ? {} : { nextScene: 'Interlude01_FirstDays' }),
    );
  }
}
