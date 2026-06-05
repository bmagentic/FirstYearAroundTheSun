import Phaser from 'phaser';
import { EncounterBase } from './EncounterBase';
import { SpriteBank } from '../../systems/SpriteBank';
import { RetryPopup } from '../../ui/RetryPopup';

type Side = 'left' | 'right' | 'top' | 'bottom';
const SIDES: Side[] = ['left', 'right', 'top', 'bottom'];
const OPPOSITE: Record<Side, Side> = { left: 'right', right: 'left', top: 'bottom', bottom: 'top' };
// Dodge perpendicular to the wipe's axis: a horizontal wipe (from left/right) is dodged
// up or down; a vertical wipe (from top/bottom) is dodged left or right.
const PERPENDICULAR: Record<Side, Side[]> = {
  left: ['top', 'bottom'],
  right: ['top', 'bottom'],
  top: ['left', 'right'],
  bottom: ['left', 'right'],
};
const DODGE_STEP = 72; // one "space" Caius steps aside before auto-returning
const DODGE_OFFSET: Record<Side, { dx: number; dy: number }> = {
  left: { dx: -DODGE_STEP, dy: 0 },
  right: { dx: DODGE_STEP, dy: 0 },
  top: { dx: 0, dy: -DODGE_STEP },
  bottom: { dx: 0, dy: DODGE_STEP },
};
const AVOIDS_NEEDED = 4;
const MAX_MISSES = 2;

export class FaceWash extends EncounterBase {
  private caius!: Phaser.GameObjects.Container;
  private cloth!: Phaser.GameObjects.Rectangle;
  private direction: Side = 'left';
  private buttons: Record<Side, Phaser.GameObjects.Container> = {} as Record<Side, Phaser.GameObjects.Container>;
  private accepting = false;
  private avoided = 0;
  private misses = 0;
  private clothTween: Phaser.Tweens.Tween | null = null;
  private retryPopup!: RetryPopup;

  constructor() {
    super('FaceWash', 'face-wash');
  }

  preload(): void {
    SpriteBank.preloadInto(this, ['caius']);
  }

  create(): void {
    this.setupEncounter();
    this.retryPopup = new RetryPopup(this);
    this.cameras.main.setBackgroundColor('#2e3b54');
    this.showLabel('Face & Hands Wash', 'Step across the wipe to dodge!');

    const W = this.scale.width;
    const H = this.scale.height;

    this.caius = this.add.container(W / 2, H / 2);
    this.caius.add(this.add.image(0, 0, 'caius').setDisplaySize(44, 44));

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

    void this.intro('Face & Hands Wash', 'A wipe comes in — step ACROSS it (up/down for a side wipe, left/right for a top/bottom wipe) to dodge!').then(() => {
      this.time.delayedCall(700, () => this.nextSwipe());
    });
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
        this.misses++;
        this.softFail('washed', 'Got him!');
        this.cloth.setVisible(false);
        if (this.misses >= MAX_MISSES) {
          this.retryPopup.show(() => this.resetRound(), 'That washcloth is fast! Try again!');
        } else {
          this.time.delayedCall(600, () => this.nextSwipe());
        }
      },
    });
  }

  private handleTap(s: Side): void {
    if (!this.accepting) return;
    this.accepting = false;
    this.clothTween?.stop();

    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;

    if (PERPENDICULAR[this.direction].includes(s)) {
      // Dodge: Caius steps one space aside (perpendicular), the wipe sweeps on through the
      // now-empty center and exits the far side, then Caius auto-returns to center.
      this.avoided++;
      const off = DODGE_OFFSET[s];
      this.tweens.add({ targets: this.caius, x: cx + off.dx, y: cy + off.dy, duration: 150, ease: 'Back.easeOut' });
      const exit = this.sidePosition(OPPOSITE[this.direction]);
      this.tweens.add({
        targets: this.cloth,
        x: exit.x,
        y: exit.y,
        duration: 420,
        ease: 'Sine.easeIn',
        onComplete: () => {
          this.cloth.setVisible(false);
          this.tweens.add({
            targets: this.caius,
            x: cx,
            y: cy,
            duration: 200,
            ease: 'Sine.easeOut',
            onComplete: () => this.time.delayedCall(350, () => this.nextSwipe()),
          });
        },
      });
    } else {
      // Stepped along the wipe's axis (into/with it) → it gets him.
      this.misses++;
      this.softFail('wrong-dir', 'Dodge across the wipe!');
      this.cloth.setVisible(false);
      if (this.misses >= MAX_MISSES) {
        this.retryPopup.show(() => this.resetRound(), 'That washcloth is fast! Try again!');
      } else {
        this.time.delayedCall(600, () => this.nextSwipe());
      }
    }
  }

  private resetRound(): void {
    this.avoided = 0;
    this.misses = 0;
    this.accepting = false;
    this.cloth.setVisible(false);
    this.cloth.setAlpha(1);
    this.caius.setPosition(this.scale.width / 2, this.scale.height / 2);
    this.time.delayedCall(400, () => this.nextSwipe());
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
