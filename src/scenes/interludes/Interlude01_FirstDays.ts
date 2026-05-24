import Phaser from 'phaser';
import { InterludeBase } from './InterludeBase';
import { SoundBank } from '../../systems/SoundBank';

type Pose = {
  bgColor: number;
  caption: string;
  setting: string;
  /** Custom Chelsea+Caius layout for this pose. */
  draw: (scene: Interlude01_FirstDays) => Phaser.GameObjects.Container;
};

const POSES: Pose[] = [
  {
    bgColor: 0x10101c,
    setting: '3 AM',
    caption: 'Welcome home.',
    draw: (s) => s.drawRockerPose(false),
  },
  {
    bgColor: 0xfde9c0,
    setting: 'Sunrise',
    caption: "I've got you.",
    draw: (s) => s.drawWindowPose(),
  },
  {
    bgColor: 0xe8d3a0,
    setting: 'Noon',
    caption: 'We figured out the swaddle.',
    draw: (s) => s.drawCouchPose(),
  },
  {
    bgColor: 0xc97a5a,
    setting: 'Sunset',
    caption: 'First bath, we both cried.',
    draw: (s) => s.drawSwaddlePose(),
  },
  {
    bgColor: 0x10101c,
    setting: 'Late night',
    caption: 'She got him through the first weeks.',
    draw: (s) => s.drawRockerPose(true),
  },
];

export class Interlude01_FirstDays extends InterludeBase {
  private poseIndex = -1;
  private poseContainer: Phaser.GameObjects.Container | null = null;
  private settingText!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  private accepting = false;

  constructor() {
    super('Interlude01_FirstDays', 'first-days');
  }

  preload(): void {
    SoundBank.preload('lullaby');
  }

  create(): void {
    this.setupInterlude();
    this.cameras.main.setBackgroundColor('#10101c');

    this.settingText = this.add
      .text(this.scale.width / 2, 40, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '13px',
        color: '#fde68a',
        fontStyle: 'bold',
        letterSpacing: 4,
      } as Phaser.Types.GameObjects.Text.TextStyle)
      .setOrigin(0.5)
      .setAlpha(0.6);

    this.hint = this.add
      .text(this.scale.width / 2, this.scale.height - 40, 'Tap to continue', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '11px',
        color: '#fde68a',
      })
      .setOrigin(0.5)
      .setAlpha(0.4);
    this.tweens.add({
      targets: this.hint,
      alpha: 0.15,
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.input.on('pointerdown', () => {
      if (this.accepting) this.next();
    });

    // Play the lullaby softly throughout (placeholder synthesises a soft chime)
    SoundBank.play('lullaby');

    this.next();
  }

  private next(): void {
    this.accepting = false;
    this.poseIndex++;
    if (this.poseIndex >= POSES.length) {
      this.finish();
      return;
    }
    const pose = POSES[this.poseIndex]!;

    // Fade transition
    this.cameras.main.fadeOut(360, (pose.bgColor >> 16) & 0xff, (pose.bgColor >> 8) & 0xff, pose.bgColor & 0xff);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.cameras.main.setBackgroundColor(pose.bgColor);
      this.poseContainer?.destroy();
      this.poseContainer = pose.draw(this);
      this.settingText.setText(pose.setting);
      this.cameras.main.fadeIn(420, (pose.bgColor >> 16) & 0xff, (pose.bgColor >> 8) & 0xff, pose.bgColor & 0xff);
      void this.showCaption(pose.caption, 2200).then(() => {
        this.accepting = true;
      });
    });
  }

  private finish(): void {
    this.cameras.main.fadeOut(700, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.cameras.main.setBackgroundColor('#050409');
      this.cameras.main.fadeIn(800, 0, 0, 0);
      const final = this.add
        .text(this.scale.width / 2, this.scale.height / 2, 'She did the first shift.\nAll of them.', {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '20px',
          color: '#fde68a',
          fontStyle: 'bold',
          align: 'center',
          wordWrap: { width: this.scale.width - 80 },
        })
        .setOrigin(0.5)
        .setAlpha(0);
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

  // ---- Pose composers ----

  drawRockerPose(asleep: boolean): Phaser.GameObjects.Container {
    const W = this.scale.width;
    const H = this.scale.height;
    const c = this.add.container(W / 2, H / 2);

    // Spotlight haze
    const haze = this.add.circle(0, 0, 220, asleep ? 0x2a1a3a : 0xfde68a, asleep ? 0.18 : 0.1);
    c.add(haze);

    // Rocker chair
    const chair = this.add.rectangle(0, 30, 100, 130, 0x4f3a2a).setStrokeStyle(2, 0x8a6540);
    const rockers = this.add.rectangle(0, 100, 130, 8, 0x4f3a2a);
    c.add([chair, rockers]);
    if (!asleep) {
      this.tweens.add({
        targets: c,
        angle: 3,
        duration: 1800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    // Chelsea
    const chel = this.add.rectangle(0, -10, 70, 80, 0x7c5fb0).setStrokeStyle(2, 0xfde68a, 0.6);
    const head = this.add.circle(0, -56, 18, 0xf5c7a3).setStrokeStyle(2, 0x6b4530);
    // Eyes (half-closed)
    const eyeL = this.add.rectangle(-7, -56, 5, asleep ? 1 : 2, 0x2a1a0e);
    const eyeR = this.add.rectangle(7, -56, 5, asleep ? 1 : 2, 0x2a1a0e);
    c.add([chel, head, eyeL, eyeR]);

    // Caius (small, on her chest if asleep, in arms otherwise)
    const caius = this.add.circle(0, asleep ? -28 : 4, 11, 0xf7c6a3).setStrokeStyle(2, 0x402c1d);
    c.add(caius);

    // Slow breathing
    this.tweens.add({
      targets: caius,
      y: caius.y - 1.5,
      duration: 1600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    return c;
  }

  drawWindowPose(): Phaser.GameObjects.Container {
    const W = this.scale.width;
    const H = this.scale.height;
    const c = this.add.container(W / 2, H / 2);

    // Window light
    const window = this.add.rectangle(70, -40, 120, 160, 0xfff3c7, 0.85).setStrokeStyle(3, 0x6b4530);
    const sash = this.add.line(70, -40, -60, 0, 60, 0, 0x6b4530).setLineWidth(2);
    const sashV = this.add.line(70, -40, 0, -80, 0, 80, 0x6b4530).setLineWidth(2);
    c.add([window, sash, sashV]);
    // Sun glow
    const sun = this.add.circle(70, -80, 22, 0xfde68a, 0.7);
    c.add(sun);
    this.tweens.add({ targets: sun, scale: 1.1, duration: 2000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // Chelsea
    const chel = this.add.rectangle(-50, 20, 60, 90, 0x7c5fb0).setStrokeStyle(2, 0xfde68a, 0.6);
    const head = this.add.circle(-50, -36, 18, 0xf5c7a3).setStrokeStyle(2, 0x6b4530);
    c.add([chel, head]);
    // Caius
    const caius = this.add.circle(-30, 0, 11, 0xf7c6a3).setStrokeStyle(2, 0x402c1d);
    c.add(caius);

    return c;
  }

  drawCouchPose(): Phaser.GameObjects.Container {
    const W = this.scale.width;
    const H = this.scale.height;
    const c = this.add.container(W / 2, H / 2);

    const couch = this.add.rectangle(0, 40, 280, 100, 0x6b4530).setStrokeStyle(2, 0x4a2f1c);
    const back = this.add.rectangle(0, -10, 280, 40, 0x4a2f1c);
    c.add([couch, back]);

    const chel = this.add.rectangle(-40, 0, 60, 80, 0x7c5fb0).setStrokeStyle(2, 0xfde68a, 0.6);
    const head = this.add.circle(-40, -46, 18, 0xf5c7a3).setStrokeStyle(2, 0x6b4530);
    // Slight smile via mouth arc
    const smile = this.add.arc(-40, -38, 6, 0, 180, false, 0x6b4530).setStrokeStyle(2, 0x6b4530);
    c.add([chel, head, smile]);

    const caius = this.add.circle(-20, 10, 11, 0xf7c6a3).setStrokeStyle(2, 0x402c1d);
    c.add(caius);

    return c;
  }

  drawSwaddlePose(): Phaser.GameObjects.Container {
    const W = this.scale.width;
    const H = this.scale.height;
    const c = this.add.container(W / 2, H / 2);

    // Changing table
    const table = this.add.rectangle(0, 30, 220, 30, 0xc9a35d).setStrokeStyle(2, 0x6b4530);
    const legs1 = this.add.rectangle(-90, 80, 10, 90, 0x6b4530);
    const legs2 = this.add.rectangle(90, 80, 10, 90, 0x6b4530);
    c.add([table, legs1, legs2]);

    // Swaddled Caius (oval)
    const swaddle = this.add.ellipse(0, 10, 100, 36, 0xfde9c0).setStrokeStyle(2, 0xfff3c7);
    const face = this.add.circle(-30, 10, 10, 0xf7c6a3).setStrokeStyle(1, 0x402c1d);
    c.add([swaddle, face]);

    // Chelsea leaning over
    const chel = this.add.rectangle(20, -40, 60, 80, 0x7c5fb0).setStrokeStyle(2, 0xfde68a, 0.6);
    const head = this.add.circle(20, -82, 16, 0xf5c7a3).setStrokeStyle(2, 0x6b4530);
    c.add([chel, head]);

    return c;
  }
}
