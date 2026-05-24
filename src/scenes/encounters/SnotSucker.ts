import Phaser from 'phaser';
import { EncounterBase } from './EncounterBase';

type Side = 'left' | 'right' | 'top' | 'bottom';

const SIDES: Side[] = ['left', 'right', 'top', 'bottom'];
const OPPOSITE: Record<Side, Side> = { left: 'right', right: 'left', top: 'bottom', bottom: 'top' };
const SWOOPS_NEEDED = 3;

export class SnotSucker extends EncounterBase {
  private caius!: Phaser.GameObjects.Container;
  private sucker!: Phaser.GameObjects.Container;
  private swoopSide: Side = 'left';
  private swoopsLanded = 0;
  private accepting = false;
  private swipeStart: { x: number; y: number } | null = null;
  private swoopTween: Phaser.Tweens.Tween | null = null;

  constructor() {
    super('SnotSucker', 'snot-sucker');
  }

  create(): void {
    this.setupEncounter();
    this.cameras.main.setBackgroundColor('#3a2515');
    this.showLabel('Snot Sucker!', 'Swipe AWAY from the swoop');

    const W = this.scale.width;
    const H = this.scale.height;
    this.caius = this.add.container(W / 2, H / 2);
    this.caius.add(this.add.circle(0, 0, 18, 0xf7c6a3).setStrokeStyle(2, 0x402c1d));

    this.sucker = this.add.container(0, 0);
    const body = this.add.rectangle(0, 0, 40, 24, 0x6b3a1a).setStrokeStyle(2, 0xfde68a);
    const nose = this.add.triangle(28, 0, 0, -8, 0, 8, 14, 0, 0xfde68a);
    const lbl = this.add
      .text(0, 0, 'snot', { fontFamily: 'system-ui, sans-serif', fontSize: '9px', color: '#fde68a', fontStyle: 'bold' })
      .setOrigin(0.5);
    this.sucker.add([body, nose, lbl]);
    this.sucker.setVisible(false);

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.swipeStart = { x: p.x, y: p.y };
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (!this.swipeStart || !this.accepting) {
        this.swipeStart = null;
        return;
      }
      const dx = p.x - this.swipeStart.x;
      const dy = p.y - this.swipeStart.y;
      if (Math.abs(dx) < 25 && Math.abs(dy) < 25) {
        this.swipeStart = null;
        return;
      }
      const dir: Side = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'top' : 'bottom';
      this.swipeStart = null;
      this.handleSwipe(dir);
    });

    this.time.delayedCall(700, () => this.nextSwoop());
  }

  private nextSwoop(): void {
    if (this.swoopsLanded >= SWOOPS_NEEDED) {
      this.completeEncounter();
      return;
    }
    this.swoopSide = Phaser.Utils.Array.GetRandom(SIDES) as Side;
    const W = this.scale.width;
    const H = this.scale.height;
    const startPos = this.sidePosition(this.swoopSide, true);
    const endPos = { x: W / 2, y: H / 2 };
    this.sucker.setVisible(true);
    this.sucker.setPosition(startPos.x, startPos.y);
    this.accepting = true;

    this.swoopTween?.stop();
    this.swoopTween = this.tweens.add({
      targets: this.sucker,
      x: endPos.x,
      y: endPos.y,
      duration: 1300,
      ease: 'Sine.easeIn',
      onComplete: () => {
        if (!this.accepting) return;
        this.accepting = false;
        this.softFail('caught', 'Caught! Try again.');
        this.sucker.setVisible(false);
        this.time.delayedCall(700, () => this.nextSwoop());
      },
    });
  }

  private handleSwipe(dir: Side): void {
    if (!this.accepting) return;
    this.accepting = false;
    this.swoopTween?.stop();
    if (dir === OPPOSITE[this.swoopSide]) {
      this.swoopsLanded++;
      const escape = this.sidePosition(OPPOSITE[this.swoopSide], true);
      this.tweens.add({
        targets: this.sucker,
        x: escape.x,
        y: escape.y,
        alpha: 0,
        duration: 350,
        onComplete: () => {
          this.sucker.setVisible(false);
          this.sucker.setAlpha(1);
          this.time.delayedCall(500, () => this.nextSwoop());
        },
      });
    } else {
      this.softFail('wrong-direction', 'That was the wrong way!');
      this.sucker.setVisible(false);
      this.time.delayedCall(700, () => this.nextSwoop());
    }
  }

  private sidePosition(side: Side, outside: boolean): { x: number; y: number } {
    const W = this.scale.width;
    const H = this.scale.height;
    const margin = outside ? 60 : 80;
    switch (side) {
      case 'left':
        return { x: -margin, y: H / 2 };
      case 'right':
        return { x: W + margin, y: H / 2 };
      case 'top':
        return { x: W / 2, y: -margin };
      case 'bottom':
        return { x: W / 2, y: H + margin };
    }
  }
}
