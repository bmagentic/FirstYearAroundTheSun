import Phaser from 'phaser';
import { EncounterBase } from './EncounterBase';

type Side = 'left' | 'right' | 'top' | 'bottom';
const SIDES: Side[] = ['left', 'right', 'top', 'bottom'];
const OPPOSITE: Record<Side, Side> = { left: 'right', right: 'left', top: 'bottom', bottom: 'top' };
const AVOIDS_NEEDED = 4;

export class FaceWash extends EncounterBase {
  private caius!: Phaser.GameObjects.Container;
  private cloth!: Phaser.GameObjects.Rectangle;
  private direction: Side = 'left';
  private buttons: Record<Side, Phaser.GameObjects.Container> = {} as Record<Side, Phaser.GameObjects.Container>;
  private accepting = false;
  private avoided = 0;
  private clothTween: Phaser.Tweens.Tween | null = null;

  constructor() {
    super('FaceWash', 'face-wash');
  }

  create(): void {
    this.setupEncounter();
    this.cameras.main.setBackgroundColor('#2e3b54');
    this.showLabel('Face & Hands Wash', 'Tap the OPPOSITE direction to dodge');

    const W = this.scale.width;
    const H = this.scale.height;

    this.caius = this.add.container(W / 2, H / 2);
    this.caius.add(this.add.circle(0, 0, 22, 0xf7c6a3).setStrokeStyle(2, 0x402c1d));

    // 4 cardinal buttons around Caius
    const offset = 120;
    const layout: Record<Side, { x: number; y: number; arrow: string }> = {
      left: { x: W / 2 - offset, y: H / 2, arrow: '←' },
      right: { x: W / 2 + offset, y: H / 2, arrow: '→' },
      top: { x: W / 2, y: H / 2 - offset, arrow: '↑' },
      bottom: { x: W / 2, y: H / 2 + offset, arrow: '↓' },
    };
    for (const s of SIDES) {
      const l = layout[s];
      const c = this.add.container(l.x, l.y);
      const ring = this.add.circle(0, 0, 32, 0x1c1410, 0.85).setStrokeStyle(2, 0x9ec3e6, 0.7);
      const lbl = this.add.text(0, 0, l.arrow, { fontFamily: 'system-ui, sans-serif', fontSize: '22px', color: '#fde68a', fontStyle: 'bold' }).setOrigin(0.5);
      c.add([ring, lbl]);
      ring.setInteractive({ useHandCursor: true });
      ring.on('pointerdown', () => this.handleTap(s));
      this.buttons[s] = c;
    }

    this.cloth = this.add.rectangle(0, 0, 36, 36, 0xe6e6f5).setStrokeStyle(2, 0x6b8eb6);
    this.cloth.setVisible(false);

    this.time.delayedCall(700, () => this.nextSwipe());
  }

  private nextSwipe(): void {
    if (this.avoided >= AVOIDS_NEEDED) {
      this.completeEncounter();
      return;
    }
    this.direction = Phaser.Utils.Array.GetRandom(SIDES) as Side;
    const startPos = this.sidePosition(this.direction);
    const center = { x: this.scale.width / 2, y: this.scale.height / 2 };
    this.cloth.setPosition(startPos.x, startPos.y).setVisible(true);
    this.accepting = true;

    this.clothTween?.stop();
    this.clothTween = this.tweens.add({
      targets: this.cloth,
      x: center.x,
      y: center.y,
      duration: 1400,
      ease: 'Sine.easeIn',
      onComplete: () => {
        if (!this.accepting) return;
        this.accepting = false;
        this.softFail('washed', 'Got him!');
        this.cloth.setVisible(false);
        this.time.delayedCall(600, () => this.nextSwipe());
      },
    });
  }

  private handleTap(s: Side): void {
    if (!this.accepting) return;
    this.accepting = false;
    this.clothTween?.stop();
    if (s === OPPOSITE[this.direction]) {
      this.avoided++;
      const out = this.sidePosition(OPPOSITE[this.direction]);
      this.tweens.add({
        targets: this.cloth,
        x: out.x,
        y: out.y,
        alpha: 0,
        duration: 320,
        onComplete: () => {
          this.cloth.setVisible(false);
          this.cloth.setAlpha(1);
          this.time.delayedCall(450, () => this.nextSwipe());
        },
      });
    } else {
      this.softFail('wrong-tap', 'Wrong side!');
      this.cloth.setVisible(false);
      this.time.delayedCall(600, () => this.nextSwipe());
    }
  }

  private sidePosition(s: Side): { x: number; y: number } {
    const W = this.scale.width;
    const H = this.scale.height;
    switch (s) {
      case 'left':
        return { x: -40, y: H / 2 };
      case 'right':
        return { x: W + 40, y: H / 2 };
      case 'top':
        return { x: W / 2, y: -40 };
      case 'bottom':
        return { x: W / 2, y: H + 40 };
    }
  }
}
