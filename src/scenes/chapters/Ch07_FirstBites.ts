import Phaser from 'phaser';
import { ChapterBase } from './ChapterBase';
import { SpriteBank } from '../../systems/SpriteBank';

type FoodKind = 'good' | 'bad';
type Food = {
  key: string;
  kind: FoodKind;
  color: number;
  label: string;
};

const FOODS: Food[] = [
  { key: 'strawberry', kind: 'good', color: 0xdc2626, label: 'berry' },
  { key: 'blueberry', kind: 'good', color: 0x4a3a8f, label: 'berry' },
  { key: 'blackberry', kind: 'good', color: 0x2a1530, label: 'berry' },
  { key: 'cheerio', kind: 'good', color: 0xfde68a, label: 'Cheerio' },
  { key: 'chicken', kind: 'good', color: 0xe6c4a0, label: 'chicken' },
  { key: 'puree', kind: 'bad', color: 0x8a6540, label: 'purée' },
  { key: 'mush', kind: 'bad', color: 0x6b4530, label: 'mush' },
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

  constructor() {
    super('Ch07_FirstBites', 7);
  }

  preload(): void {
    SpriteBank.preloadInto(this, ['caius', 'chelsea-idle', 'obj-dining-highchair']);
  }

  create(): void {
    this.setup();
    this.cameras.main.setBackgroundColor('#3a2515');

    const W = this.scale.width;
    const H = this.scale.height;

    // Kitchen
    this.add.rectangle(W / 2, H / 2 - 60, W - 40, 200, 0x6b4530).setStrokeStyle(2, 0xb88c5a, 0.4);

    // Caius in high chair
    if (SpriteBank.has(this, 'obj-dining-highchair')) {
      this.add.image(W / 2, H / 2 + 60, 'obj-dining-highchair').setDisplaySize(160, 200);
    } else {
      this.add.rectangle(W / 2, H / 2 + 60, 160, 200, 0x4f6a3d).setStrokeStyle(2, 0xfde68a, 0.4);
    }
    const tray = this.add.rectangle(W / 2, H / 2 + 10, 180, 16, 0x8a6540);
    if (SpriteBank.has(this, 'caius')) {
      this.add.image(W / 2, H / 2 - 20, 'caius').setDisplaySize(48, 48);
    } else {
      this.add.circle(W / 2, H / 2 - 20, 24, 0xf7c6a3).setStrokeStyle(2, 0x402c1d);
    }

    // Chelsea on left side (the spoon holder)
    if (SpriteBank.has(this, 'chelsea-idle')) {
      this.add.image(60, H / 2, 'chelsea-idle').setDisplaySize(50, 120);
    } else {
      const chelsea = this.add.rectangle(60, H / 2, 50, 90, 0x7c5fb0).setStrokeStyle(2, 0xfde68a, 0.7);
      this.add
        .text(chelsea.x, chelsea.y - 50, 'Mama', {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '10px',
          color: '#fde68a',
          fontStyle: 'bold',
        })
        .setOrigin(0.5);
    }

    this.chelseaReact = this.add
      .text(60, H / 2 + 60, '', {
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

    void tray;
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
    const head = this.add.circle(50, 0, 16, food.color).setStrokeStyle(2, 0x2a1410);
    const lbl = this.add
      .text(50, 0, food.label, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '9px',
        color: '#1c1410',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.spoonContainer.add([handle, head, lbl]);
    head.setInteractive({ useHandCursor: true });
    head.on('pointerdown', () => this.handleTap());

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
      this.time.delayedCall(500, () => this.nextSpoon());
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
      this.time.delayedCall(500, () => this.nextSpoon());
    }
  }

  private evaluate(): void {
    if (this.correct >= WIN) {
      this.completeChapter();
    } else {
      this.softFail('not-enough', `Got ${this.correct} of ${TOTAL_SPOONS}. Need ${WIN}+. Try again.`);
      this.time.delayedCall(1400, () => this.scene.restart());
    }
  }
}
