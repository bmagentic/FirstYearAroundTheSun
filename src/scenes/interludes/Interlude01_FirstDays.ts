import Phaser from 'phaser';
import { InterludeBase } from './InterludeBase';
import { SoundBank } from '../../systems/SoundBank';
import { SpriteBank } from '../../systems/SpriteBank';

type Beat = {
  setting: string;
  caption: string;
  /** Day beats use a warm dark backdrop; night beats stay cool. */
  warm: boolean;
  /** Caius nestled asleep on her chest vs. cradled in arms. */
  asleep: boolean;
  /** Located beat: dim a baked room background behind the spotlight instead of a vignette. */
  room?: string;
};

const BEATS: Beat[] = [
  { setting: '3 AM', caption: 'Welcome home.', warm: false, asleep: false },
  { setting: 'Sunrise', caption: "I've got you.", warm: true, asleep: false },
  { setting: 'Noon', caption: 'We figured out the swaddle.', warm: true, asleep: true },
  { setting: 'Sunset', caption: 'First bath, we both cried.', warm: true, asleep: false, room: 'room-bathroom-bg' },
  { setting: 'Late night', caption: 'She got him through the first weeks.', warm: false, asleep: true },
];

export class Interlude01_FirstDays extends InterludeBase {
  private beatIndex = -1;
  private beatLayer: Phaser.GameObjects.Container | null = null;
  private accepting = false;

  constructor() {
    super('Interlude01_FirstDays', 'first-days');
  }

  preload(): void {
    SpriteBank.preloadInto(this, ['chelsea-idle', 'caius', 'room-bathroom-bg']);
    SoundBank.preload('lullaby');
  }

  create(): void {
    this.setupInterlude();
    this.cameras.main.setBackgroundColor('#0c0e1a');

    this.input.on('pointerdown', () => {
      if (this.accepting) this.next();
    });

    // Soft lullaby throughout.
    SoundBank.play('lullaby');

    this.next();
  }

  private next(): void {
    this.accepting = false;
    this.captionBand.setPrompt(false);
    this.beatIndex++;
    if (this.beatIndex >= BEATS.length) {
      this.finish();
      return;
    }
    const beat = BEATS[this.beatIndex]!;
    const fade = beat.warm ? { r: 0x1a, g: 0x12, b: 0x08 } : { r: 0x0c, g: 0x0e, b: 0x1a };

    this.cameras.main.fadeOut(360, fade.r, fade.g, fade.b);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.beatLayer?.destroy();
      this.beatLayer = this.buildBeat(beat);
      this.captionBand.setSetting(beat.setting);
      this.captionBand.setCaption(beat.caption);
      this.cameras.main.fadeIn(420, fade.r, fade.g, fade.b);
      this.time.delayedCall(650, () => {
        this.captionBand.setPrompt(true);
        this.accepting = true;
      });
    });
  }

  private buildBeat(beat: Beat): Phaser.GameObjects.Container {
    const W = this.scale.width;
    const H = this.scale.height;
    const cx = W / 2;
    const cy = H * 0.44;
    const layer = this.add.container(0, 0);

    // Backdrop: located room (dimmed) or a flat near-black vignette base.
    if (beat.room && this.textures.exists(beat.room)) {
      layer.add(this.dimmedRoomBackdrop(beat.room));
    } else {
      layer.add(this.backdrop(beat.warm));
    }

    // Soft spotlight on the figures.
    layer.add(this.addSpotlight(cx, cy, 560, beat.warm ? 0xffe6b0 : 0xb8c4e8));

    // Mother + child, centered in the spotlight, ~2x previous interlude scale.
    layer.add(this.drawMotherAndChild(cx, cy, beat.asleep));

    return layer;
  }

  private drawMotherAndChild(cx: number, cy: number, asleep: boolean): Phaser.GameObjects.GameObject[] {
    const parts: Phaser.GameObjects.GameObject[] = [];

    if (SpriteBank.has(this, 'chelsea-idle')) {
      parts.push(this.add.image(cx, cy, 'chelsea-idle').setDisplaySize(150, 250).setOrigin(0.5));
    } else {
      parts.push(this.add.circle(cx, cy, 60, 0x7c5fb0).setStrokeStyle(2, 0xfde68a, 0.6));
    }

    const babyY = asleep ? cy - 44 : cy + 30;
    const babyX = asleep ? cx : cx - 8;
    let baby: Phaser.GameObjects.GameObject;
    if (SpriteBank.has(this, 'caius')) {
      baby = this.add.image(babyX, babyY, 'caius').setDisplaySize(56, 56);
    } else {
      baby = this.add.circle(babyX, babyY, 26, 0xf7c6a3).setStrokeStyle(2, 0x402c1d);
    }
    parts.push(baby);

    // Gentle breathing.
    this.tweens.add({
      targets: baby,
      y: babyY - 2,
      duration: 1600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    return parts;
  }

  private finish(): void {
    this.captionBand.setPrompt(false);
    this.captionBand.setSetting('');
    this.cameras.main.fadeOut(700, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.beatLayer?.destroy();
      this.cameras.main.setBackgroundColor('#050409');
      this.cameras.main.fadeIn(800, 0, 0, 0);
      const final = this.add
        .text(this.scale.width / 2, this.scale.height / 2, 'She did the first shift.\nAll of them.', {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '20px',
          color: '#F5EFE0',
          fontStyle: 'bold',
          align: 'center',
          wordWrap: { width: this.scale.width - 80 },
        })
        .setOrigin(0.5)
        .setAlpha(0);
      final.setShadow(1, 2, 'rgba(0,0,0,0.85)', 4, false, true);
      this.tweens.add({
        targets: final,
        alpha: 1,
        duration: 900,
        onComplete: () => {
          this.time.delayedCall(3000, () => this.completeInterlude());
        },
      });
    });
  }
}
