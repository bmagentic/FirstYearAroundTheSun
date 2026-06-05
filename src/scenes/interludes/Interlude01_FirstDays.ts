import Phaser from 'phaser';
import { InterludeBase } from './InterludeBase';
import { SoundBank } from '../../systems/SoundBank';
import { SpriteBank } from '../../systems/SpriteBank';

// Each beat gets its own Chelsea pose (baby-in-arms sprites) so the figure varies, not
// just the room. Closest-match notes: 'Welcome home' and 'I've got you' have no dedicated
// pose, so they use holding (cradling) and rocking (comforting) respectively.
type Pose = 'holding' | 'feeding' | 'rocking' | 'bath' | 'shoulder';

const POSE_SPRITE: Record<Pose, string> = {
  holding: 'chelsea-holding', // chelsea_holding.png
  feeding: 'chelsea-feeding', // chelsea_feeding.png
  rocking: 'chelsea-asleep', // chelsea_rocking.png (single 64x64 frame → sway, not animated)
  bath: 'chelsea-bath', // chelsea_bath.png (tub baked in)
  shoulder: 'chelsea-shoulder', // chelsea_shoulder.png (quiet finale)
};

type Beat = {
  setting: string;
  caption: string;
  /** Day beats get a warm spotlight; night beats a cool one. */
  warm: boolean;
  /** Baked, already-manifested room texture dimmed behind the spotlight. */
  room: string;
  pose: Pose;
};

// Every beat is grounded in a dimmed baked room (no lone-sprite-on-flat-fill beats).
const BEATS: Beat[] = [
  { setting: '3 AM', caption: 'Welcome home.', warm: false, room: 'room-nursery-bg', pose: 'holding' },
  { setting: 'Sunrise', caption: "I've got you.", warm: true, room: 'room-master-bedroom-bg', pose: 'rocking' },
  { setting: 'Noon', caption: 'We figured out the swaddle.', warm: true, room: 'room-living-room-bg', pose: 'holding' },
  { setting: 'Sunset', caption: 'First bath, we both cried.', warm: true, room: 'room-bathroom-bg', pose: 'bath' },
  { setting: 'NIGHT', caption: 'Every two hours. Around the clock.', warm: false, room: 'room-nursery-bg', pose: 'feeding' },
  { setting: 'Late night', caption: 'She got him through the first weeks.', warm: false, room: 'room-nursery-bg', pose: 'shoulder' },
];

const CLOSING_ROOM = 'room-nursery-bg';

export class Interlude01_FirstDays extends InterludeBase {
  private beatIndex = -1;
  private beatLayer: Phaser.GameObjects.Container | null = null;
  private accepting = false;

  constructor() {
    super('Interlude01_FirstDays', 'first-days');
  }

  preload(): void {
    SpriteBank.preloadInto(this, [
      'chelsea-asleep', // chelsea_rocking.png — Chelsea rocking with the baby baked in
      'chelsea-bath', // chelsea_bath.png — Chelsea + tub baked in (bath beat)
      'chelsea-holding', // chelsea_holding.png — cradling
      'chelsea-feeding', // chelsea_feeding.png — feeding beat
      'chelsea-shoulder', // chelsea_shoulder.png — over-the-shoulder, quiet finale
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
    layer.add(this.drawPose(cx, cy, beat.pose));

    return layer;
  }

  /**
   * Draw the beat's Chelsea pose (each is a single 64x64 baby-in-arms sprite, square aspect
   * preserved). Rocking sways (no animation frames in the file); the others get a gentle bob;
   * the shoulder finale bobs very subtly.
   */
  private drawPose(cx: number, cy: number, pose: Pose): Phaser.GameObjects.GameObject[] {
    const key = POSE_SPRITE[pose];
    let mom: Phaser.GameObjects.GameObject;
    if (SpriteBank.has(this, key)) {
      mom = this.add.image(cx, cy, key).setDisplaySize(230, 230).setOrigin(0.5);
    } else {
      mom = this.add.circle(cx, cy, 70, 0x7c5fb0).setStrokeStyle(2, 0xfde68a, 0.6);
    }

    if (pose === 'rocking') {
      this.tweens.add({
        targets: mom,
        angle: { from: -2.5, to: 2.5 },
        duration: 1900,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    } else {
      // Gentle vertical bob — subtler for the shoulder finale, no rotation for the tub.
      const dy = pose === 'shoulder' ? 2 : pose === 'bath' ? 4 : 3;
      this.tweens.add({
        targets: mom,
        y: cy - dy,
        duration: pose === 'feeding' ? 2400 : 2000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    return [mom];
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
