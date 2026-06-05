import Phaser from 'phaser';
import { InterludeBase } from './InterludeBase';
import { SoundBank } from '../../systems/SoundBank';
import { SpriteBank } from '../../systems/SpriteBank';

type Beat = {
  setting: string;
  caption: string;
  /** Day beats get a warm spotlight; night beats a cool one. */
  warm: boolean;
  /** Baked, already-manifested room texture dimmed behind the spotlight. */
  room: string;
};

// Every beat is grounded in a dimmed baked room (no lone-sprite-on-flat-fill beats).
const BEATS: Beat[] = [
  { setting: '3 AM', caption: 'Welcome home.', warm: false, room: 'room-nursery-bg' },
  { setting: 'Sunrise', caption: "I've got you.", warm: true, room: 'room-master-bedroom-bg' },
  { setting: 'Noon', caption: 'We figured out the swaddle.', warm: true, room: 'room-living-room-bg' },
  { setting: 'Sunset', caption: 'First bath, we both cried.', warm: true, room: 'room-bathroom-bg' },
  { setting: 'Late night', caption: 'She got him through the first weeks.', warm: false, room: 'room-nursery-bg' },
];

const CLOSING_ROOM = 'room-nursery-bg';
// One shared offset so the baby is always cradled at chest height (in front of her torso,
// below her face) on every beat — never composited onto her head.
const BABY_CHEST_DY = 30;

export class Interlude01_FirstDays extends InterludeBase {
  private beatIndex = -1;
  private beatLayer: Phaser.GameObjects.Container | null = null;
  private accepting = false;

  constructor() {
    super('Interlude01_FirstDays', 'first-days');
  }

  preload(): void {
    SpriteBank.preloadInto(this, [
      'chelsea-idle',
      'caius',
      'room-nursery-bg',
      'room-master-bedroom-bg',
      'room-living-room-bg',
      'room-bathroom-bg',
    ]);
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

    // Dimmed baked room behind, spotlight on top, then the figures.
    if (this.textures.exists(beat.room)) {
      layer.add(this.dimmedRoomBackdrop(beat.room));
    } else {
      layer.add(this.backdrop(beat.warm));
    }
    layer.add(this.addSpotlight(cx, cy, 560, beat.warm ? 0xffe6b0 : 0xb8c4e8));
    layer.add(this.drawMotherAndChild(cx, cy));

    return layer;
  }

  private drawMotherAndChild(cx: number, cy: number): Phaser.GameObjects.GameObject[] {
    const parts: Phaser.GameObjects.GameObject[] = [];

    if (SpriteBank.has(this, 'chelsea-idle')) {
      parts.push(this.add.image(cx, cy, 'chelsea-idle').setDisplaySize(150, 250).setOrigin(0.5));
    } else {
      parts.push(this.add.circle(cx, cy, 60, 0x7c5fb0).setStrokeStyle(2, 0xfde68a, 0.6));
    }

    // Caius cradled at chest height, added AFTER her so he's in front of the torso.
    const babyY = cy + BABY_CHEST_DY;
    let baby: Phaser.GameObjects.GameObject;
    if (SpriteBank.has(this, 'caius')) {
      baby = this.add.image(cx - 4, babyY, 'caius').setDisplaySize(56, 56);
    } else {
      baby = this.add.circle(cx - 4, babyY, 26, 0xf7c6a3).setStrokeStyle(2, 0x402c1d);
    }
    parts.push(baby);

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
    // Clear the lingering beat caption so it doesn't render under the closing line.
    this.captionBand.hide();
    this.cameras.main.fadeOut(700, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.beatLayer?.destroy();

      // Text-only closing beat is still grounded in a dimmed room (never bare black).
      const layer = this.add.container(0, 0);
      if (this.textures.exists(CLOSING_ROOM)) {
        layer.add(this.dimmedRoomBackdrop(CLOSING_ROOM));
      } else {
        layer.add(this.backdrop(false));
      }
      this.beatLayer = layer;

      this.cameras.main.setBackgroundColor('#0c0e1a');
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
        .setAlpha(0)
        .setDepth(10);
      final.setShadow(1, 2, 'rgba(0,0,0,0.9)', 5, false, true);
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
