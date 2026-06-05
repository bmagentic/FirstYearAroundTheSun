import Phaser from 'phaser';
import { ChapterBase } from './ChapterBase';

type PageDef = {
  label: string;
  color: number;
  shape: 'circle' | 'square' | 'triangle';
};

const PAGES: PageDef[] = [
  { label: 'soft cloud', color: 0xe6e6f5, shape: 'circle' },
  { label: 'bumpy ball', color: 0xfb923c, shape: 'circle' },
  { label: 'silky leaf', color: 0x4ade80, shape: 'triangle' },
  { label: 'crinkly star', color: 0xfde68a, shape: 'triangle' },
  { label: 'fuzzy block', color: 0xa855f7, shape: 'square' },
  { label: 'shiny moon', color: 0xfbbf24, shape: 'circle' },
];

const FLIP_MS = 4000;
const WIN_TAPS = 5;

export class Ch03_EyesOpen extends ChapterBase {
  private pageIndex = 0;
  private successes = 0;
  private bookFrame!: Phaser.GameObjects.Rectangle;
  private pageVisual: Phaser.GameObjects.GameObject | null = null;
  private pageHit: Phaser.GameObjects.Rectangle | null = null;
  private label!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private timerBar!: Phaser.GameObjects.Rectangle;
  private timerBarMaxW = 220;
  private flipAt = 0;
  private accepting = false;

  constructor() {
    super('Ch03_EyesOpen', 3);
  }

  create(): void {
    this.setup();
    this.cameras.main.setBackgroundColor('#0f0a1f');

    const W = this.scale.width;
    const H = this.scale.height;

    // Mobile overhead
    const mobile = this.add.container(W / 2, 80);
    mobile.add(this.add.circle(0, 0, 4, 0xfde68a, 0.7));
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const x = Math.cos(angle) * 22;
      const y = Math.sin(angle) * 22;
      mobile.add(this.add.line(0, 0, 0, 0, x, y, 0xfde68a, 0.4));
      mobile.add(this.add.circle(x, y, 6, [0xeb9a8a, 0x9ec3e6, 0xfde68a, 0x4ade80][i % 4]!, 0.8));
    }
    this.tweens.add({ targets: mobile, angle: 360, duration: 16_000, repeat: -1 });

    // Book frame
    this.bookFrame = this.add
      .rectangle(W / 2, H / 2 + 40, W - 80, 280, 0xf5e6c4)
      .setStrokeStyle(4, 0x6b4530);

    this.label = this.add
      .text(W / 2, H / 2 - 100, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '16px',
        color: '#6b4530',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.statusText = this.add
      .text(W / 2, 200, '0 / 6 pages', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '13px',
        color: '#fde68a',
      })
      .setOrigin(0.5);

    // Timer bar
    this.add.rectangle(W / 2, H - 130, this.timerBarMaxW + 4, 8, 0x3a2a1a);
    this.timerBar = this.add.rectangle(W / 2 - this.timerBarMaxW / 2, H - 130, this.timerBarMaxW, 6, 0xfde68a).setOrigin(0, 0.5);

    void this.intro('Eyes Open', 'Tap the texture before the page turns.').then(() => {
      this.showPage();
    });
  }

  private showPage(): void {
    if (this.pageIndex >= PAGES.length) {
      this.evaluate();
      return;
    }
    const page = PAGES[this.pageIndex]!;
    this.label.setText(page.label);

    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2 + 40;

    if (this.pageVisual) this.pageVisual.destroy();
    if (this.pageHit) this.pageHit.destroy();
    if (page.shape === 'circle') {
      this.pageVisual = this.add.circle(cx, cy, 50, page.color).setStrokeStyle(2, 0x6b4530);
    } else if (page.shape === 'square') {
      this.pageVisual = this.add.rectangle(cx, cy, 90, 90, page.color).setStrokeStyle(2, 0x6b4530);
    } else {
      // Triangle (silky leaf / crinkly star): its irregular silhouette gives a poor
      // default hit area, so we don't make the shape itself interactive.
      this.pageVisual = this.add.triangle(cx, cy, 0, 50, 50, -45, -50, -45, page.color).setStrokeStyle(2, 0x6b4530);
    }

    // One generous, consistent hit target centered on the shape for ALL pages, so the
    // star/triangle registers across its whole body just like the circle and square.
    this.pageHit = this.add
      .rectangle(cx, cy, 130, 130, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });
    this.pageHit.on('pointerdown', () => this.handleTap());

    this.flipAt = this.time.now + FLIP_MS;
    this.accepting = true;
  }

  private handleTap(): void {
    if (!this.accepting) return;
    this.accepting = false;
    this.successes++;
    this.statusText.setText(`${this.successes} / ${PAGES.length} pages`);
    this.tweens.add({
      targets: this.pageVisual,
      scale: 1.3,
      duration: 180,
      yoyo: true,
      onComplete: () => this.advance(),
    });
  }

  private advance(): void {
    this.pageIndex++;
    this.tweens.add({
      targets: this.bookFrame,
      scaleX: 0.92,
      duration: 200,
      yoyo: true,
      onComplete: () => this.showPage(),
    });
  }

  override update(_t: number, _delta: number): void {
    if (!this.accepting) return;
    const remaining = Math.max(0, this.flipAt - this.time.now);
    const ratio = remaining / FLIP_MS;
    this.timerBar.width = this.timerBarMaxW * ratio;
    if (remaining <= 0) {
      this.accepting = false;
      this.softFail('page-flipped', 'The page flipped — keep going!');
      this.advance();
    }
  }

  private evaluate(): void {
    this.statusText.setText(`${this.successes} / ${PAGES.length} pages`);
    if (this.successes >= WIN_TAPS) {
      this.completeChapter();
    } else {
      // Restart instead of game-over
      this.softFail('not-enough', `Try again — needed ${WIN_TAPS}+`);
      this.pageIndex = 0;
      this.successes = 0;
      this.statusText.setText('0 / 6 pages');
      this.time.delayedCall(1000, () => this.showPage());
    }
  }
}
