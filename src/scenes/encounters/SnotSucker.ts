import Phaser from 'phaser';
import { EncounterBase } from './EncounterBase';
import { SpriteBank } from '../../systems/SpriteBank';
import { RetryPopup } from '../../ui/RetryPopup';

type Side = 'left' | 'right' | 'top' | 'bottom';

const SIDES: Side[] = ['left', 'right', 'top', 'bottom'];
const OPPOSITE: Record<Side, Side> = { left: 'right', right: 'left', top: 'bottom', bottom: 'top' };
const SWOOPS_TOTAL = 3;
const DODGES_NEEDED = 2;
const SWOOP_DURATION_MS = 1800;
const TELEGRAPH_MS = 500;

export class SnotSucker extends EncounterBase {
  private caius!: Phaser.GameObjects.Container;
  private sucker!: Phaser.GameObjects.Container;
  private swoopSide: Side = 'left';
  private swoopIndex = 0;
  private dodged = 0;
  private hits = 0;
  private accepting = false;
  private swipeStart: { x: number; y: number } | null = null;
  private swoopTween: Phaser.Tweens.Tween | null = null;
  private retryPopup!: RetryPopup;

  constructor() {
    super('SnotSucker', 'snot-sucker');
  }

  preload(): void {
    SpriteBank.preloadInto(this, ['caius']);
  }

  create(): void {
    this.setupEncounter();
    this.retryPopup = new RetryPopup(this);
    this.cameras.main.setBackgroundColor('#3a2515');
    this.showLabel('Snot Sucker!', 'Dodge the snot sucker');

    const W = this.scale.width;
    const H = this.scale.height;
    this.caius = this.add.container(W / 2, H / 2);
    this.caius.add(this.add.image(0, 0, 'caius').setDisplaySize(36, 36));

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
      if (Math.abs(dx) < 15 && Math.abs(dy) < 15) {
        this.swipeStart = null;
        return;
      }
      const dir: Side = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'top' : 'bottom';
      this.swipeStart = null;
      this.handleSwipe(dir);
    });

    void this.intro('Snot Sucker!', 'Swipe away from the snot sucker to dodge!').then(() => {
      this.time.delayedCall(400, () => this.nextSwoop());
    });
  }

  private nextSwoop(): void {
    if (this.swoopIndex >= SWOOPS_TOTAL) {
      if (this.dodged >= DODGES_NEEDED) {
        this.completeEncounter();
      } else {
        this.retryPopup.show(() => this.resetRound(), 'That snot sucker got you! Try again!');
      }
      return;
    }
    this.swoopSide = Phaser.Utils.Array.GetRandom(SIDES) as Side;
    const startPos = this.sidePosition(this.swoopSide, true);
    this.sucker.setVisible(true);
    this.sucker.setPosition(startPos.x, startPos.y);
    this.accepting = true;

    // Telegraph: wiggle at origin for 500ms
    this.tweens.add({
      targets: this.sucker,
      x: startPos.x + (this.swoopSide === 'left' ? 12 : this.swoopSide === 'right' ? -12 : 0),
      y: startPos.y + (this.swoopSide === 'top' ? 12 : this.swoopSide === 'bottom' ? -12 : 0),
      duration: 120,
      yoyo: true,
      repeat: 1,
    });

    // After telegraph, swoop toward Caius
    this.time.delayedCall(TELEGRAPH_MS, () => {
      if (!this.accepting) return;
      const W = this.scale.width;
      const H = this.scale.height;
      this.swoopTween?.stop();
      this.swoopTween = this.tweens.add({
        targets: this.sucker,
        x: W / 2,
        y: H / 2,
        duration: SWOOP_DURATION_MS,
        ease: 'Sine.easeIn',
        onComplete: () => {
          if (!this.accepting) return;
          this.accepting = false;
          this.swoopIndex++;
          this.hits++;
          this.softFail('caught', 'Caught!');
          this.sucker.setVisible(false);
          if (this.hits >= SWOOPS_TOTAL - DODGES_NEEDED + 1) {
            this.retryPopup.show(() => this.resetRound(), 'That snot sucker got you! Try again!');
          } else {
            this.time.delayedCall(700, () => this.nextSwoop());
          }
        },
      });
    });
  }

  private handleSwipe(dir: Side): void {
    if (!this.accepting) return;
    this.accepting = false;
    this.swoopTween?.stop();
    this.swoopIndex++;
    if (dir === OPPOSITE[this.swoopSide]) {
      this.dodged++;
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
      this.hits++;
      this.softFail('wrong-direction', 'That was the wrong way!');
      this.sucker.setVisible(false);
      if (this.hits >= SWOOPS_TOTAL - DODGES_NEEDED + 1) {
        this.retryPopup.show(() => this.resetRound(), 'That snot sucker got you! Try again!');
      } else {
        this.time.delayedCall(700, () => this.nextSwoop());
      }
    }
  }

  private resetRound(): void {
    // Kill any pending delayedCall (e.g. the 700ms nextSwoop after a non-fatal hit
    // that was frozen mid-countdown by the RetryPopup) so thaw doesn't double-fire.
    this.time.removeAllEvents();
    this.swoopTween?.stop();
    this.swoopIndex = 0;
    this.dodged = 0;
    this.hits = 0;
    this.accepting = false;
    this.sucker.setVisible(false);
    this.sucker.setAlpha(1);
    this.time.delayedCall(400, () => this.nextSwoop());
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
