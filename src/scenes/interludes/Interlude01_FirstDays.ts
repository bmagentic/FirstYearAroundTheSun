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
  /** Use the chelsea_bath sprite (Chelsea + tub baked in) instead of the rocking pose. */
  bath?: boolean;
};

// Every beat is grounded in a dimmed baked room (no lone-sprite-on-flat-fill beats).
const BEATS: Beat[] = [
  { setting: '3 AM', caption: 'Welcome home.', warm: false, room: 'room-nursery-bg' },
  { setting: 'Sunrise', caption: "I've got you.", warm: true, room: 'room-master-bedroom-bg' },
  { setting: 'Noon', caption: 'We figured out the swaddle.', warm: true, room: 'room-living-room-bg' },
  { setting: 'Sunset', caption: 'First bath, we both cried.', warm: true, room: 'room-bathroom-bg', bath: true },
  { setting: 'Late night', caption: 'She got him through the first weeks.', warm: false, room: 'room-nursery-bg' },
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
    layer.add(beat.bath ? this.drawBathScene(cx, cy) : this.drawRockingMother(cx, cy));

    return layer;
  }

  /** Bath beat: the chelsea_bath sprite (Chelsea + tub baked in) over the dimmed bathroom. */
  private drawBathScene(cx: number, cy: number): Phaser.GameObjects.GameObject[] {
    let scene: Phaser.GameObjects.GameObject;
    if (SpriteBank.has(this, 'chelsea-bath')) {
      // Square aspect (64x64) preserved — no crop/stretch.
      scene = this.add.image(cx, cy, 'chelsea-bath').setDisplaySize(230, 230).setOrigin(0.5);
    } else {
      scene = this.add.circle(cx, cy, 70, 0x7c5fb0).setStrokeStyle(2, 0xfde68a, 0.6);
    }
    // Gentle bob (no rotation — a tilting tub looks wrong).
    this.tweens.add({
      targets: scene,
      y: cy - 4,
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    return [scene];
  }

  /**
   * Chelsea rocking with Caius already cradled in her arms — the baby is baked into the
   * chelsea_rocking sprite, so there is no separate composited Caius (no more baby-on-face,
   * no double-baby). The file is a single 64x64 frame, so we add a gentle sway tween rather
   * than playing animation frames.
   */
  private drawRockingMother(cx: number, cy: number): Phaser.GameObjects.GameObject[] {
    const parts: Phaser.GameObjects.GameObject[] = [];

    let mom: Phaser.GameObjects.GameObject;
    if (SpriteBank.has(this, 'chelsea-asleep')) {
      // Keep the sprite's square aspect (64x64) — do not crop or stretch.
      mom = this.add.image(cx, cy, 'chelsea-asleep').setDisplaySize(230, 230).setOrigin(0.5);
    } else {
      mom = this.add.circle(cx, cy, 70, 0x7c5fb0).setStrokeStyle(2, 0xfde68a, 0.6);
    }
    parts.push(mom);

    // Gentle rocking sway.
    this.tweens.add({
      targets: mom,
      angle: { from: -2.5, to: 2.5 },
      duration: 1900,
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
