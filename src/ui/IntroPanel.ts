import Phaser from 'phaser';

/**
 * Pre-play gate shown when a chapter or encounter launches. Renders a full-bleed
 * scrim with the scene title, a one/two-line instruction, and a single large
 * Start button. While it's up the scene's tweens and clock are paused, so nothing
 * moves and no timers run until the button is tapped.
 *
 * Sibling to RetryPopup / MonthCard; styling mirrors them (amber palette).
 */
export class IntroPanel {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container | null = null;
  private showing = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  get isShowing(): boolean {
    return this.showing;
  }

  /** @param onStart called once the player taps Start (after the scene un-freezes). */
  show(title: string, instruction: string, onStart: () => void): void {
    if (this.showing) return;
    this.showing = true;

    // Freeze the scene. pauseAll() only affects tweens that already exist, so the
    // panel's own tweens (added below) still animate.
    this.scene.tweens.pauseAll();
    this.scene.time.paused = true;

    const W = this.scene.scale.width;
    const H = this.scene.scale.height;

    const container = this.scene.add.container(0, 0).setDepth(550);

    const scrim = this.scene.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.78);
    scrim.setInteractive(); // swallow taps so the gameplay underneath stays inert
    container.add(scrim);

    const heading = this.scene.add
      .text(W / 2, H * 0.38, title, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '24px',
        color: '#fde68a',
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: W - 80 },
      })
      .setOrigin(0.5);
    container.add(heading);

    if (instruction) {
      const sub = this.scene.add
        .text(W / 2, H * 0.38 + 48, instruction, {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '16px',
          color: '#fef3c7',
          align: 'center',
          wordWrap: { width: W - 80 },
        })
        .setOrigin(0.5)
        .setAlpha(0.9);
      container.add(sub);
    }

    // Large Start button (rounded amber, matching the pause-menu primary button).
    const btnW = 240;
    const btnH = 60;
    const btn = this.scene.add.container(W / 2, H * 0.62);
    const g = this.scene.add.graphics();
    g.fillStyle(0xfbbf24, 1);
    g.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 18);
    const btnLabel = this.scene.add
      .text(0, 0, 'Start playing!', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '20px',
        color: '#1c1410',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    btn.add([g, btnLabel]);
    btn.setSize(btnW, btnH);
    btn.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(-btnW / 2, -btnH / 2, btnW, btnH),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true,
    });
    btn.on('pointerdown', () => this.dismiss(onStart));
    container.add(btn);

    // Gentle breathing pulse on the button.
    this.scene.tweens.add({
      targets: btn,
      scaleX: 1.04,
      scaleY: 1.04,
      duration: 750,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    container.setAlpha(0);
    this.scene.tweens.add({
      targets: container,
      alpha: 1,
      duration: 240,
      ease: 'Sine.easeOut',
    });

    this.container = container;
  }

  private dismiss(onStart: () => void): void {
    if (!this.container) return;
    const c = this.container;
    this.container = null;
    this.scene.tweens.add({
      targets: c,
      alpha: 0,
      duration: 180,
      ease: 'Sine.easeIn',
      onComplete: () => {
        c.destroy();
        this.showing = false;
        // Un-freeze the scene, then hand control to gameplay.
        this.scene.time.paused = false;
        this.scene.tweens.resumeAll();
        onStart();
      },
    });
  }

  destroy(): void {
    this.container?.destroy();
    this.container = null;
    this.showing = false;
  }
}
