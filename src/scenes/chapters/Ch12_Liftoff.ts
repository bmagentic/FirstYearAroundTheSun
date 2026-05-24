import Phaser from 'phaser';
import { ChapterBase } from './ChapterBase';
import { SoundBank } from '../../systems/SoundBank';

type SubsystemKind = 'tap-rhythm' | 'tap-targets' | 'swipe' | 'tap-alt' | 'hold' | 'drag-target';

type Subsystem = {
  id: string;
  label: string;
  kind: SubsystemKind;
  /** kind-dependent parameter (target count / hold seconds / etc.) */
  param: number;
};

const SUBSYSTEMS: Subsystem[] = [
  { id: 'smile', label: 'Smile fuels engines', kind: 'tap-rhythm', param: 3 },
  { id: 'eyes', label: 'Eyes calibrate nav', kind: 'tap-targets', param: 3 },
  { id: 'roll', label: 'Roll loads boosters', kind: 'swipe', param: 1 },
  { id: 'crawl', label: 'Crawl docks fuel line', kind: 'tap-alt', param: 4 },
  { id: 'grab', label: 'Grab loads cargo', kind: 'tap-targets', param: 5 },
  { id: 'bites', label: 'Bites fill snack drawer', kind: 'tap-targets', param: 3 },
  { id: 'sleep', label: 'Sleep autopilot', kind: 'hold', param: 3 },
  { id: 'walker', label: 'Walker positions gantry', kind: 'drag-target', param: 1 },
  { id: 'words', label: 'Words activate comms', kind: 'tap-targets', param: 3 },
  { id: 'ledges', label: 'Ledges grip tower', kind: 'hold', param: 3 },
];

export class Ch12_Liftoff extends ChapterBase {
  private nodes: Phaser.GameObjects.Container[] = [];
  private completed = new Set<number>();
  private rocketY = 0;
  private launchBtn!: Phaser.GameObjects.Arc;
  private launchLabel!: Phaser.GameObjects.Text;
  private launchPressed = false;
  private statusText!: Phaser.GameObjects.Text;

  constructor() {
    super('Ch12_Liftoff', 12);
  }

  create(): void {
    this.setup();
    this.cameras.main.setBackgroundColor('#0a1024');

    const W = this.scale.width;
    const H = this.scale.height;

    // Rocket silhouette (just background context)
    const rocketX = W * 0.22;
    this.rocketY = H * 0.55;
    this.drawRocket(rocketX, this.rocketY);

    this.statusText = this.add
      .text(W / 2, 60, '0 / 10 systems', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        color: '#fde68a',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    // Subsystem nodes — 5 rows x 2 cols on the right of the rocket
    const startX = W * 0.52;
    const colSpacing = 88;
    const startY = 110;
    const rowSpacing = 64;
    SUBSYSTEMS.forEach((sub, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = startX + col * colSpacing;
      const y = startY + row * rowSpacing;
      this.nodes.push(this.buildNode(sub, i, x, y));
    });

    // Launch button (disabled until all green)
    this.launchBtn = this.add.circle(W / 2, H - 110, 56, 0x3a2a1a, 0.65).setStrokeStyle(3, 0xfde68a, 0.4);
    this.launchLabel = this.add
      .text(W / 2, H - 110, 'LAUNCH', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        color: '#fde68a',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setAlpha(0.4);
    this.launchBtn.setInteractive({ useHandCursor: true });
    this.launchBtn.on('pointerdown', () => this.tryLaunch());

    void this.intro('Liftoff', 'Bring every system online, then press LAUNCH.');
  }

  private drawRocket(x: number, y: number): void {
    // Body
    this.add.rectangle(x, y, 42, 160, 0xd4d4d4).setStrokeStyle(2, 0x999999);
    // Nose
    this.add.triangle(x, y - 100, -21, 28, 21, 28, 0, -20, 0xfde68a).setStrokeStyle(2, 0xd4d4d4);
    // Window
    this.add.circle(x, y - 30, 10, 0x6ab0e0).setStrokeStyle(2, 0xffffff, 0.8);
    // Fins
    this.add.triangle(x - 28, y + 60, 0, 0, 14, -28, 14, 28, 0xb91c1c);
    this.add.triangle(x + 28, y + 60, 0, 0, -14, -28, -14, 28, 0xb91c1c);
    // Flame placeholder
    const flame = this.add.triangle(x, y + 110, -12, 0, 12, 0, 0, 30, 0xfb923c);
    flame.setAlpha(0.4);
    this.tweens.add({
      targets: flame,
      scaleY: 1.3,
      alpha: 0.7,
      duration: 280,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private buildNode(sub: Subsystem, idx: number, x: number, y: number): Phaser.GameObjects.Container {
    const c = this.add.container(x, y);
    const ring = this.add.circle(0, 0, 26, 0x1c1a30).setStrokeStyle(2, 0xfde68a, 0.7);
    const status = this.add.circle(0, 0, 8, 0xc66a3a);
    const label = this.add
      .text(0, 32, sub.label, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '9px',
        color: '#fde68a',
        align: 'center',
        wordWrap: { width: 80 },
      })
      .setOrigin(0.5, 0);

    ring.setInteractive({ useHandCursor: true });
    ring.on('pointerdown', () => this.engageSubsystem(sub, idx, c, ring, status));

    c.add([ring, status, label]);
    return c;
  }

  private engageSubsystem(
    sub: Subsystem,
    idx: number,
    container: Phaser.GameObjects.Container,
    ring: Phaser.GameObjects.Arc,
    status: Phaser.GameObjects.Arc,
  ): void {
    if (this.completed.has(idx)) return;
    // Open a tiny modal-ish overlay
    const dim = this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0x000000, 0.7).setDepth(50);
    const panel = this.add
      .rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width - 60, 220, 0x1c1410)
      .setStrokeStyle(2, 0xfde68a, 0.6)
      .setDepth(51);
    const title = this.add
      .text(this.scale.width / 2, this.scale.height / 2 - 80, sub.label, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        color: '#fde68a',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(52);

    let progress = 0;
    let target = sub.param;
    let altLast: 'L' | 'R' | null = null;
    let holdStart = 0;
    let holding = false;

    const instructionText = this.add
      .text(this.scale.width / 2, this.scale.height / 2 - 40, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '12px',
        color: '#fef3c7',
      })
      .setOrigin(0.5)
      .setDepth(52);

    const progressText = this.add
      .text(this.scale.width / 2, this.scale.height / 2 + 50, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '12px',
        color: '#fde68a',
      })
      .setOrigin(0.5)
      .setDepth(52);

    const interactives: Phaser.GameObjects.GameObject[] = [];
    const cleanup = () => {
      dim.destroy();
      panel.destroy();
      title.destroy();
      instructionText.destroy();
      progressText.destroy();
      interactives.forEach((o) => o.destroy());
    };

    const updateProgress = () => {
      progressText.setText(`${progress} / ${target}`);
      if (progress >= target) {
        this.completed.add(idx);
        status.setFillStyle(0x4ade80);
        ring.setStrokeStyle(2, 0x4ade80, 0.9);
        this.tweens.add({ targets: container, scale: 1.15, duration: 160, yoyo: true });
        this.refreshStatus();
        this.time.delayedCall(220, cleanup);
      }
    };

    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2 + 10;

    switch (sub.kind) {
      case 'tap-rhythm': {
        instructionText.setText('Tap the orb to the beat');
        const orb = this.add.circle(cx, cy, 30, 0xfde68a, 0.5).setStrokeStyle(2, 0xfde68a, 0.9).setDepth(52);
        this.tweens.add({ targets: orb, scale: 1.2, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        orb.setInteractive({ useHandCursor: true });
        orb.on('pointerdown', () => {
          progress++;
          updateProgress();
        });
        interactives.push(orb);
        break;
      }
      case 'tap-targets': {
        instructionText.setText(`Tap ${target} targets`);
        // Spawn 5 dots; only `target` matter, others are decoy (visual)
        const count = Math.max(target, 5);
        for (let i = 0; i < count; i++) {
          const x = cx - 100 + (i % 5) * 50 + (Math.floor(i / 5) ? 16 : 0);
          const y = cy + (i < 5 ? -10 : 30);
          const dot = this.add.circle(x, y, 14, 0xc66a3a, 0.85).setStrokeStyle(1, 0xfde68a, 0.7).setDepth(52);
          dot.setInteractive({ useHandCursor: true });
          dot.on('pointerdown', () => {
            dot.setFillStyle(0x4ade80, 0.9);
            dot.disableInteractive();
            progress++;
            updateProgress();
          });
          interactives.push(dot);
        }
        break;
      }
      case 'swipe': {
        instructionText.setText('Swipe right →');
        const start = this.add.circle(cx - 80, cy, 22, 0xfde68a, 0.4).setStrokeStyle(2, 0xfde68a).setDepth(52);
        const end = this.add.circle(cx + 80, cy, 22, 0x4ade80, 0.2).setStrokeStyle(2, 0x4ade80).setDepth(52);
        interactives.push(start, end);
        let downX = 0;
        const zone = this.add.zone(cx, cy, 280, 80).setOrigin(0.5).setInteractive().setDepth(52);
        zone.on('pointerdown', (p: Phaser.Input.Pointer) => (downX = p.x));
        zone.on('pointerup', (p: Phaser.Input.Pointer) => {
          if (p.x - downX > 70) {
            progress = target;
            updateProgress();
          }
        });
        interactives.push(zone);
        break;
      }
      case 'tap-alt': {
        instructionText.setText('Alternate L and R');
        const L = this.add.circle(cx - 70, cy, 30, 0x3a2a1a, 0.85).setStrokeStyle(2, 0xfde68a).setDepth(52);
        const R = this.add.circle(cx + 70, cy, 30, 0x3a2a1a, 0.85).setStrokeStyle(2, 0xfde68a).setDepth(52);
        const Lt = this.add.text(L.x, L.y, 'L', { fontSize: '18px', color: '#fde68a', fontStyle: 'bold' }).setOrigin(0.5).setDepth(53);
        const Rt = this.add.text(R.x, R.y, 'R', { fontSize: '18px', color: '#fde68a', fontStyle: 'bold' }).setOrigin(0.5).setDepth(53);
        L.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
          if (altLast === 'L') return;
          altLast = 'L';
          progress++;
          updateProgress();
        });
        R.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
          if (altLast === 'R') return;
          altLast = 'R';
          progress++;
          updateProgress();
        });
        interactives.push(L, R, Lt, Rt);
        break;
      }
      case 'hold': {
        instructionText.setText(`Hold for ${target} seconds`);
        const pad = this.add.circle(cx, cy, 40, 0x3a2a1a, 0.85).setStrokeStyle(2, 0xfde68a).setDepth(52);
        const fill = this.add.circle(cx, cy, 40, 0xfde68a, 0.0).setDepth(52);
        pad.setInteractive({ useHandCursor: true });
        pad.on('pointerdown', () => {
          holding = true;
          holdStart = this.time.now;
        });
        const releaseHold = () => {
          if (!holding) return;
          const seconds = (this.time.now - holdStart) / 1000;
          holding = false;
          if (seconds >= target) {
            progress = target;
            updateProgress();
          } else {
            fill.fillAlpha = 0;
          }
        };
        pad.on('pointerup', releaseHold);
        pad.on('pointerout', releaseHold);
        // Update fill alpha during hold
        const updater = this.time.addEvent({
          delay: 50,
          loop: true,
          callback: () => {
            if (holding) {
              const seconds = (this.time.now - holdStart) / 1000;
              fill.fillAlpha = Math.min(0.7, seconds / target);
            }
          },
        });
        interactives.push(pad, fill, { destroy: () => updater.destroy() } as unknown as Phaser.GameObjects.GameObject);
        break;
      }
      case 'drag-target': {
        instructionText.setText('Drag handle to target');
        const targetZone = this.add.circle(cx + 80, cy, 24, 0x4ade80, 0.25).setStrokeStyle(2, 0x4ade80).setDepth(52);
        const handle = this.add.circle(cx - 80, cy, 22, 0xfde68a, 0.85).setStrokeStyle(2, 0xfde68a).setDepth(53);
        handle.setInteractive({ useHandCursor: true, draggable: true });
        this.input.setDraggable(handle);
        const dragHandler = (_p: Phaser.Input.Pointer, obj: Phaser.GameObjects.GameObject, dx: number, dy: number) => {
          if (obj === handle) {
            handle.x = Phaser.Math.Clamp(dx, cx - 120, cx + 120);
            handle.y = Phaser.Math.Clamp(dy, cy - 40, cy + 40);
            if (Phaser.Math.Distance.Between(handle.x, handle.y, targetZone.x, targetZone.y) < 26) {
              progress = target;
              updateProgress();
              this.input.off('drag', dragHandler);
            }
          }
        };
        this.input.on('drag', dragHandler);
        interactives.push(targetZone, handle);
        break;
      }
    }

    progressText.setText(`0 / ${target}`);
  }

  private refreshStatus(): void {
    const n = this.completed.size;
    this.statusText.setText(`${n} / 10 systems`);
    if (n >= 10) {
      this.launchBtn.setFillStyle(0xb91c1c, 0.95);
      this.launchBtn.setStrokeStyle(3, 0xfde68a, 1);
      this.launchLabel.setAlpha(1);
      this.tweens.add({
        targets: this.launchBtn,
        scale: 1.1,
        duration: 600,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  private tryLaunch(): void {
    if (this.launchPressed) return;
    if (this.completed.size < 10) {
      this.softFail('not-all-green', 'Bring every system online first');
      return;
    }
    this.launchPressed = true;
    SoundBank.play('rocket-launch');

    // Ignition: shake camera, rocket lifts up
    this.cameras.main.shake(900, 0.01);
    const flame = this.add.triangle(0.22 * this.scale.width, this.rocketY + 110, -16, 0, 16, 0, 0, 60, 0xfb923c);
    this.tweens.add({
      targets: flame,
      scaleY: 3,
      alpha: 0,
      duration: 1400,
      ease: 'Sine.easeOut',
    });

    // Fade to space-black after liftoff, then drop into the post-credits sequence
    this.time.delayedCall(900, () => {
      this.cameras.main.fadeOut(900, 0, 0, 10);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.completeChapter({ nextScene: 'PostCreditsScene' });
      });
    });
  }
}
