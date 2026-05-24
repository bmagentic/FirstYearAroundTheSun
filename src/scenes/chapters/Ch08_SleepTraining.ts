import Phaser from 'phaser';
import { ChapterBase } from './ChapterBase';
import { SoundBank } from '../../systems/SoundBank';

type Phase = 'stuffies' | 'night';

const STUFFY_COUNT = 6;
const NIGHT_DURATION_MS = 45_000;
const URGE_INTERVAL_MS = 7_500;
const SUCKER_TIMES_MS = [16_000, 32_000];

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
  private suckerScheduled = [...SUCKER_TIMES_MS];
  private statusText!: Phaser.GameObjects.Text;

  constructor() {
    super('Ch08_SleepTraining', 8);
  }

  preload(): void {
    SoundBank.preload('lullaby');
  }

  create(): void {
    this.setup();
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
    // 6 stuffies on a soft mat
    const colors = [0xeb9a8a, 0xfde68a, 0x4ade80, 0x9ec3e6, 0xa855f7, 0xfb923c];
    const labels = ['poe', 'bear', 'bunny', 'whale', 'puppy', 'star'];
    for (let i = 0; i < STUFFY_COUNT; i++) {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = W / 2 + (col - 1) * 110;
      const y = H / 2 - 30 + row * 110;
      const c = this.add.container(x, y);
      const body = this.add.circle(0, 0, 28, colors[i] ?? 0xfde68a).setStrokeStyle(2, 0x2a1410);
      const lbl = this.add
        .text(0, 0, labels[i] ?? '', {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '11px',
          color: '#1c1410',
          fontStyle: 'bold',
        })
        .setOrigin(0.5);
      body.setInteractive({ useHandCursor: true });
      body.on('pointerdown', () => this.tuck(c, body));
      c.add([body, lbl]);
      this.stuffies.push(c);
    }
  }

  private tuck(c: Phaser.GameObjects.Container, body: Phaser.GameObjects.Arc): void {
    if (c.getData('tucked')) return;
    c.setData('tucked', true);
    body.setFillStyle(0x3a2a1a, 0.7);
    this.tweens.add({ targets: c, scale: 0.9, alpha: 0.55, duration: 220 });
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

    // Crib + Caius
    this.add.rectangle(W / 2, H / 2, 200, 140).setStrokeStyle(3, 0x4a3a26, 0.85);
    this.add.circle(W / 2, H / 2, 18, 0xf7c6a3).setStrokeStyle(2, 0x402c1d);

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
    const endH = 30; // 6am next day
    const hour = Phaser.Math.Linear(startH, endH, progress);
    const display = this.formatHour(hour);
    this.clockText.setText(display);

    if (elapsed >= NIGHT_DURATION_MS) {
      this.p2Active = false;
      this.completeChapter();
      return;
    }

    // Snot sucker schedule
    if (this.suckerScheduled.length > 0 && elapsed >= (this.suckerScheduled[0] ?? Infinity)) {
      this.suckerScheduled.shift();
      this.swoopSucker();
    }

    // Urge timing
    if (!this.urgeButton && this.time.now >= this.nextUrgeAt) {
      this.spawnUrge();
    }

    if (this.urgeButton && this.time.now > this.urgeDeadline) {
      // Missed
      this.urgeButton.destroy();
      this.urgeButton = null;
      this.chelseaIcon?.destroy();
      this.chelseaIcon = null;
      this.softFail('urge-missed', 'He cried out. Mama settled him.');
      this.nextUrgeAt = this.time.now + URGE_INTERVAL_MS;
    }
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

    const urge = this.add.container(x, y);
    const ring = this.add.circle(0, 0, 38, 0xb91c1c, 0.8).setStrokeStyle(3, 0xfde68a);
    const lbl = this.add
      .text(0, 0, 'urge!', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '12px',
        color: '#fde68a',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    urge.add([ring, lbl]);
    this.tweens.add({ targets: ring, scale: 1.2, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.urgeButton = urge;

    // Chelsea calming icon appears
    const cx = W / 2 - 120;
    const ci = this.add.container(cx, y);
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
    // Brief glow
    const flash = this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0xa855f7, 0.2);
    this.tweens.add({ targets: flash, alpha: 0, duration: 600, onComplete: () => flash.destroy() });
  }

  private swoopSucker(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    const c = this.add.container(-40, H / 2);
    const body = this.add.rectangle(0, 0, 40, 24, 0x6b3a1a).setStrokeStyle(2, 0xfde68a);
    const lbl = this.add
      .text(0, 0, 'snot', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '9px',
        color: '#fde68a',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    c.add([body, lbl]);
    body.setInteractive({ useHandCursor: true });
    let dodged = false;
    body.on('pointerdown', () => {
      dodged = true;
      this.tweens.add({ targets: c, y: c.y + 80, alpha: 0, duration: 300, onComplete: () => c.destroy() });
    });

    this.tweens.add({
      targets: c,
      x: W + 60,
      duration: 1600,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        if (!dodged) this.softFail('sucker-hit', 'Snot sucker got him! Keep going.');
        c.destroy();
      },
    });
  }
}
