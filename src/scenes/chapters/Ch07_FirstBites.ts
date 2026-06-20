import Phaser from 'phaser';
import { ChapterBase } from './ChapterBase';
import { SpriteBank } from '../../systems/SpriteBank';
import { RetryPopup } from '../../ui/RetryPopup';

type FoodKind = 'good' | 'bad';
type Food = {
  key: string;
  kind: FoodKind;
};

const FOODS: Food[] = [
  { key: 'food-puree',        kind: 'good' },
  { key: 'food-banana',       kind: 'good' },
  { key: 'food-cheerios',     kind: 'good' },
  { key: 'food-avocado',      kind: 'good' },
  { key: 'food-sweetpotato',  kind: 'good' },
  { key: 'food-chili',        kind: 'bad'  },
  { key: 'food-lemon',        kind: 'bad'  },
  { key: 'food-broccoli-raw', kind: 'bad'  },
];

const TOTAL_SPOONS = 12;
const WIN = 10;
const SPOON_TRAVEL_MS = 1600;

export class Ch07_FirstBites extends ChapterBase {
  private spoonIndex = 0;
  private correct = 0;
  private chelseaReact!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private spoonContainer: Phaser.GameObjects.Container | null = null;
  private spoonTween: Phaser.Tweens.Tween | null = null;
  private currentFood: Food | null = null;
  private accepting = false;
  private swipeStart: { x: number; y: number } | null = null;
  private retryPopup!: RetryPopup;

  constructor() {
    super('Ch07_FirstBites', 7);
  }

  preload(): void {
    SpriteBank.preloadInto(this, [
      'caius-highchair',
      'chelsea-feeding',
      'obj-dining-highchair',
      'room-dining-bg',
      ...FOODS.map(f => f.key),
    ]);
  }

  create(): void {
    // scene.restart() reuses the class instance — field initializers don't re-run.
    // Reset every field that mutates during play before any logic reads them.
    this.spoonIndex = 0;
    this.correct = 0;
    this.accepting = false;
    this.currentFood = null;
    this.spoonContainer = null;
    this.spoonTween = null;
    this.swipeStart = null;

    this.setup();
    this.retryPopup = new RetryPopup(this);
    this.cameras.main.setBackgroundColor('#1c1008');

    const W = this.scale.width;
    const H = this.scale.height;

    // Dimmed dining-room background — same treatment as interlude room backdrops.
    if (SpriteBank.has(this, 'room-dining-bg')) {
      const bg = this.add.image(W / 2, H / 2, 'room-dining-bg');
      const cover = Math.max(W / bg.width, H / bg.height);
      bg.setScale(cover).setTint(0x555555);
    }

    // High chair — drawn behind Caius so he composites inside it.
    this.add.image(W / 2, H / 2 + 60, 'obj-dining-highchair').setDisplaySize(160, 200);

    // Caius seated in the chair — highchair pose (52x52 sprite, upscaled).
    const chairCaiusX = W / 2;
    const chairCaiusY = H / 2 + 14;
    if (SpriteBank.has(this, 'caius-highchair')) {
      this.add.image(chairCaiusX, chairCaiusY, 'caius-highchair').setDisplaySize(82, 82);
    } else {
      this.add.circle(chairCaiusX, chairCaiusY, 24, 0xf7c6a3).setStrokeStyle(2, 0x402c1d);
    }

    // Chelsea in feeding pose — positioned at the chair side, offering the spoon.
    const chelseaX = 72;
    const chelseaY = H / 2 + 30;
    if (SpriteBank.has(this, 'chelsea-feeding')) {
      this.add.image(chelseaX, chelseaY, 'chelsea-feeding').setDisplaySize(110, 110);
    } else {
      this.add.image(chelseaX, chelseaY, 'chelsea-idle').setDisplaySize(50, 120);
    }

    this.chelseaReact = this.add
      .text(72, H / 2 + 92, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '10px',
        color: '#fde68a',
        fontStyle: 'italic',
        align: 'center',
        wordWrap: { width: 90 },
      })
      .setOrigin(0.5);

    this.statusText = this.add
      .text(W / 2, 50, '0 of 12', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        color: '#fde68a',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.add
      .text(W / 2, H - 80, 'Tap good food · Swipe bad food away', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '12px',
        color: '#fde68a',
      })
      .setOrigin(0.5)
      .setAlpha(0.55);

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.swipeStart = { x: p.x, y: p.y };
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (!this.swipeStart) return;
      const dx = p.x - this.swipeStart.x;
      const dy = p.y - this.swipeStart.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 35) this.handleSwipe();
      this.swipeStart = null;
    });

    void this.intro('First Bites', 'Tap to eat the good stuff. Swipe the bad stuff away.').then(() => {
      this.nextSpoon();
    });
  }

  private nextSpoon(): void {
    if (this.spoonIndex >= TOTAL_SPOONS) {
      this.evaluate();
      return;
    }
    this.spoonIndex++;
    // 70/30 split good/bad with some random
    const good = Math.random() < 0.7;
    const pool = FOODS.filter((f) => f.kind === (good ? 'good' : 'bad'));
    const food = Phaser.Utils.Array.GetRandom(pool) as Food;
    this.currentFood = food;
    this.statusText.setText(`${this.correct} of ${TOTAL_SPOONS}`);

    this.spoonContainer?.destroy();
    const startX = 60 + 18;
    const startY = this.scale.height / 2;
    const targetX = this.scale.width / 2 - 60;
    const targetY = this.scale.height / 2 - 14;

    this.spoonContainer = this.add.container(startX, startY);
    const handle = this.add.rectangle(20, 0, 60, 8, 0xc9a35d);
    // Real food sprite (or fallback circle if not loaded).
    const foodVisual: Phaser.GameObjects.Image | Phaser.GameObjects.Arc = SpriteBank.has(this, food.key)
      ? this.add.image(50, 0, food.key).setDisplaySize(34, 34)
      : this.add.circle(50, 0, 16, 0xfde68a).setStrokeStyle(2, 0x2a1410);
    // Hit zone: project rule — interactive Rectangle with origin 0.5, never pixel-perfect.
    const hitZone = this.add.rectangle(50, 0, 44, 44, 0xffffff, 0).setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    hitZone.on('pointerdown', () => this.handleTap());
    this.spoonContainer.add([handle, foodVisual, hitZone]);

    this.accepting = true;

    this.spoonTween?.stop();
    this.spoonTween = this.tweens.add({
      targets: this.spoonContainer,
      x: targetX,
      y: targetY,
      duration: SPOON_TRAVEL_MS,
      ease: 'Sine.easeInOut',
      yoyo: true,
      hold: 200,
      onComplete: () => {
        if (!this.accepting) return;
        // Missed: counts as wrong if it was a good food (didn't tap), correct if bad (didn't tap)
        this.accepting = false;
        if (this.currentFood?.kind === 'good') {
          this.chelseaReact.setText('"Aw, missed it"');
        } else {
          this.correct++; // ignoring bad is fine
          this.chelseaReact.setText('"Good — skipped it"');
        }
        this.time.delayedCall(500, () => this.nextSpoon());
      },
    });
  }

  private handleTap(): void {
    if (!this.accepting || !this.currentFood) return;
    this.accepting = false;
    if (this.currentFood.kind === 'good') {
      this.correct++;
      this.chelseaReact.setText('"Yum! 😊"');
      this.statusText.setText(`${this.correct} of ${TOTAL_SPOONS}`);
      this.tweens.add({
        targets: this.spoonContainer,
        scale: 0,
        duration: 240,
        onComplete: () => this.nextSpoon(),
      });
    } else {
      this.chelseaReact.setText('"Oh no, that one!"');
      this.softFail('ate-bad', 'Ick — try to swipe that away');
      if (this.cannotWin()) {
        this.retryPopup.show(() => this.retry(), 'Too many wrong bites! Try again!');
      } else {
        this.time.delayedCall(500, () => this.nextSpoon());
      }
    }
  }

  private handleSwipe(): void {
    if (!this.accepting || !this.currentFood) return;
    this.accepting = false;
    if (this.currentFood.kind === 'bad') {
      this.correct++;
      this.chelseaReact.setText('"Hah! Good call"');
      this.statusText.setText(`${this.correct} of ${TOTAL_SPOONS}`);
      this.tweens.add({
        targets: this.spoonContainer,
        angle: 90,
        alpha: 0,
        duration: 300,
        onComplete: () => this.nextSpoon(),
      });
    } else {
      this.chelseaReact.setText('"Wait, that was a good one"');
      this.softFail('rejected-good', 'That was a good one!');
      if (this.cannotWin()) {
        this.retryPopup.show(() => this.retry(), 'Too many wrong bites! Try again!');
      } else {
        this.time.delayedCall(500, () => this.nextSpoon());
      }
    }
  }

  private cannotWin(): boolean {
    const remaining = TOTAL_SPOONS - this.spoonIndex;
    return this.correct + remaining < WIN;
  }

  private evaluate(): void {
    if (this.correct >= WIN) {
      this.completeChapter();
    } else {
      this.softFail('not-enough', `Got ${this.correct}. Need ${WIN}+.`);
      this.retryPopup.show(() => this.retry(), `Only ${this.correct} right! Need ${WIN}. Try again!`);
    }
  }
}
