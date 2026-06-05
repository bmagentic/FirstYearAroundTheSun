import Phaser from 'phaser';
import { ChapterBase } from './ChapterBase';
import { SoundBank } from '../../systems/SoundBank';
import { SpriteBank } from '../../systems/SpriteBank';
import { RetryPopup } from '../../ui/RetryPopup';

type Phase = 'p1' | 'p2';

const PHASE1_DURATION_MS = 20_000;
const TILT_INTERVAL_MS = 2_400;
const SLIDE_SPEED = 38;
const RECOVERY_PUSH = 60;
const MAX_FALLS = 3;

export class Ch05_HoliDadInn extends ChapterBase {
  private phase: Phase = 'p1';

  // Phase 1
  private bedTilt = 0; // -1..1, sign = low edge direction
  private caiusX = 0;
  private caiusY = 0;
  private bedX = 0;
  private bedY = 0;
  private bedW = 360;
  private bedH = 220;
  private caius!: Phaser.GameObjects.Container;
  private bedRect!: Phaser.GameObjects.Image;
  private chelsea!: Phaser.GameObjects.Image;
  private timerText!: Phaser.GameObjects.Text;
  private phase1StartMs = 0;
  private nextTiltAt = 0;
  private p1Active = false;
  private falls = 0;
  private retryPopup!: RetryPopup;

  // Phase 2
  private p2Active = false;
  private p2Progress = 0; // 0..1
  private lastHand: 'L' | 'R' | null = null;
  private dad!: Phaser.GameObjects.Image;
  private progressBar!: Phaser.GameObjects.Rectangle;
  private leftBtn!: Phaser.GameObjects.Arc;
  private rightBtn!: Phaser.GameObjects.Arc;
  private hintText!: Phaser.GameObjects.Text;

  constructor() {
    super('Ch05_HoliDadInn', 5);
  }

  preload(): void {
    SpriteBank.preloadInto(this, ['bed', 'chelsea-asleep', 'dad-airplane', 'brandon-idle', 'caius', 'caius-crawl-l', 'caius-crawl-r']);
    SoundBank.preload('lullaby');
  }

  create(): void {
    this.setup();
    this.retryPopup = new RetryPopup(this);
    this.cameras.main.setBackgroundColor('#1a1430');

    const W = this.scale.width;
    const H = this.scale.height;

    // Bed
    this.bedX = W / 2;
    this.bedY = H / 2 - 40;
    this.bedRect = this.add.image(this.bedX, this.bedY, 'bed').setDisplaySize(this.bedW, this.bedH);

    // Chelsea standing beside the bed (a present parent, not floating in the middle of it).
    // FLAG: chelsea-asleep maps to chelsea_rocking.png — no true sleeping pose on disk
    const chelX = this.bedX - this.bedW / 2 - 16;
    const chelY = this.bedY + 24;
    this.chelsea = this.add.image(chelX, chelY, 'chelsea-asleep').setDisplaySize(64, 104);
    // Gentle breathing
    this.tweens.add({
      targets: this.chelsea,
      scaleY: 1.04,
      duration: 2200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Caius
    this.caiusX = this.bedX + 40;
    this.caiusY = this.bedY + 10;
    this.caius = this.add.container(this.caiusX, this.caiusY);
    const caiusKey = SpriteBank.has(this, 'caius-crawl-l') ? 'caius-crawl-l' : 'caius';
    this.caius.add(this.add.image(0, 0, caiusKey).setDisplaySize(56, 56)); // ~2x bigger, crawling pose

    this.timerText = this.add
      .text(W / 2, 60, '20', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '24px',
        color: '#fde68a',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setAlpha(0.85);

    this.hintText = this.add
      .text(W / 2, H - 60, 'Tap the high side to push him back', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '13px',
        color: '#fde68a',
      })
      .setOrigin(0.5)
      .setAlpha(0.55);

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.handlePhase1Tap(p));

    void this.intro('HoliDad Inn', 'The bed tilts. Tap the high side to push him back to the middle.').then(() => {
      this.startPhase1();
    });
  }

  // ---- Phase 1 ----

  private startPhase1(): void {
    this.phase = 'p1';
    this.p1Active = true;
    this.phase1StartMs = this.time.now;
    this.nextTiltAt = this.time.now + 1200;
  }

  private handlePhase1Tap(p: Phaser.Input.Pointer): void {
    if (!this.p1Active) return;
    // Tap on the left half pushes Caius right; right half pushes left.
    const left = p.x < this.scale.width / 2;
    const push = left ? RECOVERY_PUSH : -RECOVERY_PUSH;
    this.caiusX += push;
  }

  private maybeTilt(): void {
    if (this.time.now < this.nextTiltAt) return;
    // Bias new tilt away from current (so the bed swings)
    const dir = this.bedTilt >= 0 ? -1 : 1;
    const mag = Phaser.Math.FloatBetween(0.6, 1);
    this.bedTilt = dir * mag;
    this.nextTiltAt = this.time.now + TILT_INTERVAL_MS;
    // Visual cue
    this.tweens.add({
      targets: this.bedRect,
      angle: this.bedTilt * 4,
      duration: 700,
      ease: 'Sine.easeInOut',
    });
  }

  // ---- Phase 2 ----

  private startPhase2(): void {
    this.phase = 'p2';
    this.p1Active = false;
    this.input.removeAllListeners('pointerdown');

    // Fade transition into phase 2
    this.cameras.main.flash(360, 250, 230, 200);
    this.bedRect.setAngle(0);

    // Dad on the right side — WAITING (arms open, no baby) until Caius arrives. The
    // airplane/held pose (dad-airplane already has a baby baked in) appears only after the
    // crawl completes, so there's never a second baby on screen.
    const dadX = this.bedX + this.bedW / 2 - 60;
    const dadKey = SpriteBank.has(this, 'brandon-idle') ? 'brandon-idle' : 'dad-airplane';
    this.dad = this.add.image(dadX, this.bedY, dadKey).setDisplaySize(60, 100);

    // Move Caius back to start of crawl
    this.caiusX = this.bedX - this.bedW / 2 + 100;
    this.caiusY = this.bedY + 10;
    this.caius.setPosition(this.caiusX, this.caiusY);

    // Progress bar
    const barY = this.scale.height - 200;
    this.add.rectangle(this.scale.width / 2, barY, 280, 8, 0x3a2a1a);
    this.progressBar = this.add.rectangle(
      this.scale.width / 2 - 140,
      barY,
      4,
      8,
      0xfde68a,
    );
    this.progressBar.setOrigin(0, 0.5);

    // L / R hand buttons
    const cy = this.scale.height - 130;
    this.leftBtn = this.add.circle(this.scale.width * 0.3, cy, 44, 0x3a2a1a, 0.7).setStrokeStyle(2, 0xfde68a, 0.7);
    this.rightBtn = this.add.circle(this.scale.width * 0.7, cy, 44, 0x3a2a1a, 0.7).setStrokeStyle(2, 0xfde68a, 0.7);
    this.leftBtn.setInteractive({ useHandCursor: true });
    this.rightBtn.setInteractive({ useHandCursor: true });
    this.leftBtn.on('pointerdown', () => this.handCrawl('L'));
    this.rightBtn.on('pointerdown', () => this.handCrawl('R'));
    this.add
      .text(this.leftBtn.x, this.leftBtn.y, 'L', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '22px',
        color: '#fde68a',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.add
      .text(this.rightBtn.x, this.rightBtn.y, 'R', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '22px',
        color: '#fde68a',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.hintText.setText('Alternate L and R to crawl to Dad');
    this.timerText.setText('crawl');
    this.timerText.setColor('#fef3c7');

    void this.intro("Crawl to Dad's shoulder", 'Tap L and R, alternating hands, to crawl across the bed.').then(() => {
      this.p2Active = true;
    });
  }

  private handCrawl(hand: 'L' | 'R'): void {
    if (!this.p2Active) return;
    if (hand === this.lastHand) {
      this.softFail('same-hand-twice', 'Switch hands, bubbaman');
      return;
    }
    this.lastHand = hand;
    this.p2Progress = Math.min(1, this.p2Progress + 0.08);

    // Visual pulse on the tapped button
    const btn = hand === 'L' ? this.leftBtn : this.rightBtn;
    this.tweens.add({ targets: btn, scale: 1.2, duration: 110, yoyo: true });

    if (this.p2Progress >= 1) {
      this.p2Active = false;
      SoundBank.play('lullaby');
      this.tweens.add({
        targets: this.caius,
        x: this.dad.x - 32,
        duration: 600,
        ease: 'Sine.easeInOut',
        onComplete: () => {
          // Reunion: dad scoops him into the airplane/held pose; the crawling baby is now
          // the one in dad's arms, so hide the separate sprite. One baby on screen.
          if (this.textures.exists('dad-airplane')) this.dad.setTexture('dad-airplane');
          this.caius.setVisible(false);
          this.cameras.main.fadeOut(900, 250, 230, 180);
          this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
            this.completeChapter();
          });
        },
      });
    }
  }

  // ---- Update loop ----

  override update(_t: number, delta: number): void {
    if (this.phase === 'p1' && this.p1Active) {
      const dt = delta / 1000;
      this.maybeTilt();
      // Slide toward low edge
      this.caiusX += -this.bedTilt * SLIDE_SPEED * dt;
      // Clamp Caius to bed area
      const minX = this.bedX - this.bedW / 2 + 28;
      const maxX = this.bedX + this.bedW / 2 - 28;
      if (this.caiusX < minX) {
        this.failPhase1('rolled-off-left');
        return;
      }
      if (this.caiusX > maxX) {
        this.failPhase1('rolled-off-right');
        return;
      }
      this.caius.setPosition(this.caiusX, this.caiusY);

      // Update timer
      const elapsed = this.time.now - this.phase1StartMs;
      const remaining = Math.max(0, Math.ceil((PHASE1_DURATION_MS - elapsed) / 1000));
      this.timerText.setText(String(remaining));

      if (elapsed >= PHASE1_DURATION_MS) {
        this.startPhase2();
      }
    } else if (this.phase === 'p2' && this.p2Active) {
      // Animate progress bar
      const targetW = 280 * this.p2Progress;
      this.progressBar.width = Phaser.Math.Linear(this.progressBar.width, targetW, 0.2);
      // Caius position follows progress
      const startX = this.bedX - this.bedW / 2 + 100;
      const endX = this.dad.x - 32;
      this.caius.setPosition(Phaser.Math.Linear(startX, endX, this.p2Progress), this.caiusY);
    }
  }

  private failPhase1(reason: string): void {
    if (!this.p1Active) return;
    this.p1Active = false;
    this.falls++;
    this.softFail(reason, 'Dad caught him. Try again!');
    const airplane = this.add
      .text(this.bedX, this.bedY - this.bedH / 2 - 40, '✈ Super Baby!', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '18px',
        color: '#fde68a',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.tweens.add({
      targets: airplane,
      y: '-=20',
      alpha: 0,
      duration: 900,
      onComplete: () => airplane.destroy(),
    });
    if (this.falls >= MAX_FALLS) {
      this.time.delayedCall(900, () => {
        this.retryPopup.show(() => this.resetPhase1(), 'Too many tumbles! Try again!');
      });
    } else {
      this.time.delayedCall(900, () => this.resumePhase1());
    }
  }

  private resumePhase1(): void {
    this.caiusX = this.bedX + 10;
    this.caius.setPosition(this.caiusX, this.caiusY);
    this.bedTilt = 0;
    this.tweens.add({ targets: this.bedRect, angle: 0, duration: 200 });
    this.phase1StartMs = this.time.now;
    this.nextTiltAt = this.time.now + 1200;
    this.p1Active = true;
  }

  private resetPhase1(): void {
    this.falls = 0;
    this.resumePhase1();
  }
}
