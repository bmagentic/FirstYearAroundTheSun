import Phaser from 'phaser';
import { ChapterBase } from './ChapterBase';
import { SoundBank } from '../../systems/SoundBank';
import { SpriteBank } from '../../systems/SpriteBank';
import { RetryPopup } from '../../ui/RetryPopup';

type Phase = 'stuffies' | 'night';

// 7-stuffie roster — win condition derives from length, not a hard-coded 6.
const STUFFIES: Array<{ key: string }> = [
  { key: 'obj-plush-francois' },
  { key: 'obj-plush-foxamillion' },
  { key: 'obj-plush-deeno' },
  { key: 'obj-plush-persephone' },
  { key: 'obj-plush-moomoo' },
  { key: 'obj-plush-ribbie' },
  { key: 'obj-plush-poe' },
];

const STUFFY_COUNT = STUFFIES.length; // 7

const NIGHT_DURATION_MS = 45_000;
const URGE_INTERVAL_MS = 7_500;
const MAX_URGE_MISSES = 3;

// Layout constants — computed from roster so adding a stuffie never needs coord surgery.
const DISPLAY = 90;  // sprite display px (square; setDisplaySize keeps it uniform)
const STEP    = 112; // center-to-center spacing (px)
const HIT     = 120; // tap zone size (px) — project rule: generous, never pixel-perfect

export class Ch08_SleepTraining extends ChapterBase {
  private phase: Phase = 'stuffies';

  // Phase 1
  private stuffies: Phaser.GameObjects.Container[] = [];
  private tucked = 0;

  // Phase 2
  private nightStartMs = 0;
  private p2Active = false;
  private clockText!: Phaser.GameObjects.Text;
  private urgeButton: Phaser.GameObjects.Container | null = null;
  private urgeDeadline = 0;
  private chelseaIcon: Phaser.GameObjects.Container | null = null;
  private nextUrgeAt = 0;
  private statusText!: Phaser.GameObjects.Text;
  private urgeMisses = 0;
  private retryPopup!: RetryPopup;

  constructor() {
    super('Ch08_SleepTraining', 8);
  }

  preload(): void {
    SoundBank.preload('lullaby');
    SpriteBank.preloadInto(this, [...STUFFIES.map(s => s.key), 'chelsea-idle', 'caius-sleeping']);
  }

  create(): void {
    this.setup();
    this.retryPopup = new RetryPopup(this);
    this.cameras.main.setBackgroundColor('#0a0a1f');
    this.statusText = this.add
      .text(this.scale.width / 2, 50, 'Goodnight to the stuffies', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        color: '#fde68a',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    void this.intro('Sleep Training', 'Say goodnight to each one.').then(() => {
      this.startStuffies();
    });
  }

  private startStuffies(): void {
    this.phase = 'stuffies';
    const W = this.scale.width;
    const H = this.scale.height;

    // 4 / 3 layout — both rows horizontally centered on screen.
    // Row 1: first 4 stuffies. Row 2: remaining 3, centered under the row-1 gap.
    const row1Count = 4;
    const row2Count = STUFFY_COUNT - row1Count; // 3
    const row1Y = Math.round(H * 0.36);
    const row2Y = row1Y + STEP + 14;

    const positions: Array<{ x: number; y: number }> = [
      ...Array.from({ length: row1Count }, (_, i) => ({
        x: Math.round(W / 2 + (i - (row1Count - 1) / 2) * STEP),
        y: row1Y,
      })),
      ...Array.from({ length: row2Count }, (_, i) => ({
        x: Math.round(W / 2 + (i - (row2Count - 1) / 2) * STEP),
        y: row2Y,
      })),
    ];

    STUFFIES.forEach(({ key }, i) => {
      const pos = positions[i]!;
      const c = this.add.container(pos.x, pos.y);

      // Real sprite scaled to DISPLAY×DISPLAY; aspect is square so setDisplaySize is safe.
      const sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle =
        SpriteBank.has(this, key)
          ? this.add.image(0, 0, key).setDisplaySize(DISPLAY, DISPLAY)
          : this.add.rectangle(0, 0, DISPLAY, DISPLAY, 0xfde68a).setStrokeStyle(2, 0x2a1410);

      // Transparent Rectangle hit zone — project rule: interactive Rectangle with
      // origin 0.5, sized to the tap target, never pixel-perfect on the sprite itself.
      const hitZone = this.add
        .rectangle(0, 0, HIT, HIT, 0xffffff, 0)
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      hitZone.on('pointerdown', () => this.tuck(c));

      c.add([sprite, hitZone]);
      this.stuffies.push(c);
    });
  }

  private tuck(c: Phaser.GameObjects.Container): void {
    if (c.getData('tucked')) return;
    c.setData('tucked', true);
    // Dim the stuffie sprite to show it's asleep (dark tint + shrink + fade).
    const sprite = c.list.find(o => o instanceof Phaser.GameObjects.Image) as
      | Phaser.GameObjects.Image
      | undefined;
    if (sprite) sprite.setTint(0x3a4055);
    this.tweens.add({ targets: c, scale: 0.88, alpha: 0.55, duration: 220 });
    this.tucked++;
    if (this.tucked >= STUFFY_COUNT) {
      this.time.delayedCall(700, () => this.startNight());
    }
  }

  private startNight(): void {
    this.phase = 'night';
    this.statusText.setText('Make it to morning');
    this.stuffies.forEach((s) => s.destroy());
    this.stuffies = [];

    const W = this.scale.width;
    const H = this.scale.height;
    this.cameras.main.flash(450, 5, 5, 20);

    // Sleeping Caius — real sprite (star blanket baked in reads as crib; no code box needed).
    if (SpriteBank.has(this, 'caius-sleeping')) {
      this.add.image(W / 2, H / 2, 'caius-sleeping').setDisplaySize(88, 88);
    } else {
      this.add.rectangle(W / 2, H / 2, 200, 140).setStrokeStyle(3, 0x4a3a26, 0.85);
      this.add.circle(W / 2, H / 2, 18, 0xf7c6a3).setStrokeStyle(2, 0x402c1d);
    }

    // Clock display
    this.clockText = this.add
      .text(W / 2, 100, '8:00 pm', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '22px',
        color: '#fde68a',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.add
      .text(W / 2, H - 80, 'When the urge appears, tap Mama to soothe', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '11px',
        color: '#fde68a',
        align: 'center',
        wordWrap: { width: W - 60 },
      })
      .setOrigin(0.5)
      .setAlpha(0.55);

    this.nightStartMs = this.time.now;
    this.nextUrgeAt = this.time.now + 3000;
    this.p2Active = true;
  }

  override update(_t: number, _delta: number): void {
    if (this.phase !== 'night' || !this.p2Active) return;
    const elapsed = this.time.now - this.nightStartMs;
    const progress = Math.min(1, elapsed / NIGHT_DURATION_MS);

    // Clock 8pm → 6am
    const startH = 20; // 8pm in 24h
    const endH = 30;   // 6am next day
    const hour = Phaser.Math.Linear(startH, endH, progress);
    const display = this.formatHour(hour);
    this.clockText.setText(display);

    if (elapsed >= NIGHT_DURATION_MS) {
      this.p2Active = false;
      this.completeChapter();
      return;
    }

    // Urge timing
    if (!this.urgeButton && this.time.now >= this.nextUrgeAt) {
      this.spawnUrge();
    }

    if (this.urgeButton && this.time.now > this.urgeDeadline) {
      this.urgeButton.destroy();
      this.urgeButton = null;
      this.chelseaIcon?.destroy();
      this.chelseaIcon = null;
      this.urgeMisses++;
      this.softFail('urge-missed', 'He cried out. Mama settled him.');
      if (this.urgeMisses >= MAX_URGE_MISSES) {
        this.p2Active = false;
        this.retryPopup.show(() => this.resetNight(), 'Baby woke up! Try again!');
      } else {
        this.nextUrgeAt = this.time.now + URGE_INTERVAL_MS;
      }
    }
  }

  private resetNight(): void {
    this.urgeMisses = 0;
    this.nightStartMs = this.time.now;
    this.nextUrgeAt = this.time.now + 3000;
    this.p2Active = true;
  }

  private formatHour(h: number): string {
    let hh = h;
    while (hh >= 24) hh -= 24;
    const isPm = hh >= 12 && hh < 24;
    const display = hh % 12 === 0 ? 12 : Math.floor(hh) % 12;
    return `${display}:00 ${isPm ? 'pm' : 'am'}`;
  }

  private spawnUrge(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    const x = W / 2;
    const y = H / 2 + 150;

    // Glowing pill — outer soft glow + solid inner fill + highlight stroke.
    const urge = this.add.container(x, y);
    const pill = this.add.graphics();
    pill.fillStyle(0xff3333, 0.22);
    pill.fillRoundedRect(-56, -28, 112, 56, 18);
    pill.fillStyle(0xb91c1c, 0.92);
    pill.fillRoundedRect(-46, -22, 92, 44, 13);
    pill.lineStyle(2, 0xff8888, 0.75);
    pill.strokeRoundedRect(-46, -22, 92, 44, 13);
    const lbl = this.add
      .text(0, 0, 'urge!', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '13px',
        color: '#fde68a',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    urge.add([pill, lbl]);
    this.tweens.add({ targets: urge, scale: 1.15, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.urgeButton = urge;

    // Chelsea soothe target — real sprite if available, fallback circle.
    // Project rule: hit zone is a transparent Rectangle, not the sprite itself.
    const cx = W / 2 - 120;
    const ci = this.add.container(cx, y);
    if (SpriteBank.has(this, 'chelsea-idle')) {
      const img = this.add.image(0, 0, 'chelsea-idle').setDisplaySize(68, 68);
      const hitZone = this.add
        .rectangle(0, 0, 84, 84, 0xffffff, 0)
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      hitZone.on('pointerdown', () => this.soothe());
      ci.add([img, hitZone]);
    } else {
      const cring = this.add.circle(0, 0, 28, 0xa855f7, 0.8).setStrokeStyle(2, 0xfde68a);
      const clbl = this.add
        .text(0, 0, 'Mama', {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '10px',
          color: '#fde68a',
          fontStyle: 'bold',
        })
        .setOrigin(0.5);
      ci.add([cring, clbl]);
      cring.setInteractive({ useHandCursor: true });
      cring.on('pointerdown', () => this.soothe());
    }
    this.chelseaIcon = ci;

    this.urgeDeadline = this.time.now + 2500;
  }

  private soothe(): void {
    if (!this.urgeButton) return;
    SoundBank.play('lullaby');
    this.urgeButton.destroy();
    this.urgeButton = null;
    this.chelseaIcon?.destroy();
    this.chelseaIcon = null;
    this.nextUrgeAt = this.time.now + URGE_INTERVAL_MS;
    const flash = this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0xa855f7, 0.2);
    this.tweens.add({ targets: flash, alpha: 0, duration: 600, onComplete: () => flash.destroy() });
  }

}
