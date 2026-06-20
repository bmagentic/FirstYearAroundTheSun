import Phaser from 'phaser';
import { freezeScene } from './sceneFreeze';

export class RetryPopup {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container | null = null;
  private showing = false;
  private dismissing = false;
  private thaw: (() => void) | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  get isShowing(): boolean {
    return this.showing;
  }

  show(onRetry: () => void, message = 'Try again!'): void {
    if (this.showing) return;
    this.showing = true;

    this.thaw = freezeScene(this.scene);

    const W = this.scene.scale.width;
    const H = this.scene.scale.height;

    const container = this.scene.add.container(0, 0).setDepth(600);

    const scrim = this.scene.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.78);
    scrim.setInteractive();
    container.add(scrim);

    const heading = this.scene.add
      .text(W / 2, H / 2 - 18, message, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '24px',
        color: '#fde68a',
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: W - 80 },
      })
      .setOrigin(0.5);
    container.add(heading);

    const hint = this.scene.add
      .text(W / 2, H - 80, 'Tap to retry', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '12px',
        color: '#fef3c7',
      })
      .setOrigin(0.5)
      .setAlpha(0.5);
    container.add(hint);

    this.scene.tweens.add({
      targets: hint,
      alpha: 0.15,
      duration: 1000,
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

    scrim.on('pointerdown', () => this.dismiss(onRetry));
  }

  private dismiss(onRetry: () => void): void {
    if (!this.container || this.dismissing) return;
    this.dismissing = true;
    const c = this.container;
    this.scene.tweens.add({
      targets: c,
      alpha: 0,
      duration: 180,
      ease: 'Sine.easeIn',
      onComplete: () => {
        c.destroy();
        this.container = null;
        this.showing = false;
        this.dismissing = false;
        this.thaw?.();
        this.thaw = null;
        onRetry();
      },
    });
  }

  destroy(): void {
    this.container?.destroy();
    this.container = null;
    this.showing = false;
    this.dismissing = false;
  }
}
