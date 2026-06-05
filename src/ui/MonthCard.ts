import Phaser from 'phaser';

export type MonthCardMode =
  | { mode: 'timed'; holdMs: number } // first play: mandatory hold, no skip
  | { mode: 'tap' };                  // replay: tap to continue immediately

/**
 * Full-screen "Month N" title card shown at the start of a chapter (chapters only —
 * never interludes, encounters, or the bonus). Sits between the chapter trigger and
 * the IntroPanel.
 *
 * First-ever play of a chapter: a mandatory `holdMs` showing with no skip, then it
 * auto-advances. Replays: appears as tap-to-continue with no timer.
 *
 * All timing runs on tweens (not the scene clock) so the card animates and auto-advances
 * even though the intro flow has frozen the scene clock (time.paused) behind it. The
 * tween manager is deliberately NOT globally paused — pauseAll() would halt these tweens.
 */
export class MonthCard {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private resolver: (() => void) | null = null;
  private dismissable = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const W = scene.scale.width;
    const H = scene.scale.height;

    this.container = scene.add.container(0, 0).setDepth(560).setVisible(false);

    const scrim = scene.add.rectangle(W / 2, H / 2, W, H, 0x0a0a1f, 0.94);
    scrim.setInteractive(); // swallow taps; honoured only in tap mode
    scrim.on('pointerdown', () => {
      if (this.dismissable) this.dismiss();
    });
    this.container.add(scrim);
  }

  show(monthNumber: number, opts: MonthCardMode): Promise<void> {
    return new Promise((resolve) => {
      this.resolver = resolve;
      const cx = this.scene.scale.width / 2;
      const cy = this.scene.scale.height / 2;

      const title = this.scene.add
        .text(cx, cy, `Month ${monthNumber}`, {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '46px',
          color: '#fde68a',
          fontStyle: 'bold',
          align: 'center',
        })
        .setOrigin(0.5);
      title.setShadow(0, 3, '#000000', 8, false, true);
      this.container.add(title);

      // Thin accent rule under the title for a title-card feel.
      const rule = this.scene.add
        .rectangle(cx, cy + 42, 120, 2, 0xf6c87d, 0.7)
        .setOrigin(0.5);
      this.container.add(rule);

      if (opts.mode === 'tap') {
        this.dismissable = true;
        const hint = this.scene.add
          .text(cx, this.scene.scale.height - 80, 'Tap to continue', {
            fontFamily: 'system-ui, sans-serif',
            fontSize: '12px',
            color: '#fef3c7',
          })
          .setOrigin(0.5)
          .setAlpha(0.5);
        this.container.add(hint);
        this.scene.tweens.add({
          targets: hint,
          alpha: 0.15,
          duration: 1000,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      }

      this.container.setAlpha(0).setVisible(true);
      this.scene.tweens.add({
        targets: this.container,
        alpha: 1,
        duration: 260,
        ease: 'Sine.easeOut',
        onComplete: () => {
          if (opts.mode === 'timed') {
            // Mandatory hold on a tween (survives a paused scene clock), no skip.
            this.scene.tweens.addCounter({
              from: 0,
              to: 1,
              duration: opts.holdMs,
              onComplete: () => this.dismiss(),
            });
          }
        },
      });
    });
  }

  private dismiss(): void {
    this.dismissable = false;
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: 180,
      ease: 'Sine.easeIn',
      onComplete: () => {
        const r = this.resolver;
        this.resolver = null;
        this.container.destroy();
        r?.();
      },
    });
  }
}
