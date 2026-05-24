import Phaser from 'phaser';

/**
 * Reusable intro card shown at the start of a chapter or interlude.
 * Pattern: full-bleed scrim, centered heading + subhead, tap to dismiss.
 */
export class ChapterCard {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private resolver: (() => void) | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0).setDepth(500).setVisible(false);

    const scrim = scene.add.rectangle(
      scene.scale.width / 2,
      scene.scale.height / 2,
      scene.scale.width,
      scene.scale.height,
      0x000000,
      0.78,
    );
    scrim.setInteractive();
    scrim.on('pointerdown', () => this.dismiss());
    this.container.add(scrim);
  }

  show(heading: string, subhead?: string): Promise<void> {
    return new Promise((resolve) => {
      this.resolver = resolve;
      // Clear any previous text
      this.container.list
        .filter((c) => c instanceof Phaser.GameObjects.Text)
        .forEach((c) => c.destroy());

      const cx = this.scene.scale.width / 2;
      const cy = this.scene.scale.height / 2;

      const head = this.scene.add
        .text(cx, cy - (subhead ? 18 : 0), heading, {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '24px',
          color: '#fde68a',
          fontStyle: 'bold',
          align: 'center',
          wordWrap: { width: this.scene.scale.width - 80 },
        })
        .setOrigin(0.5);
      this.container.add(head);

      if (subhead) {
        const sub = this.scene.add
          .text(cx, cy + 24, subhead, {
            fontFamily: 'system-ui, sans-serif',
            fontSize: '16px',
            color: '#fef3c7',
            align: 'center',
            wordWrap: { width: this.scene.scale.width - 80 },
          })
          .setOrigin(0.5)
          .setAlpha(0.85);
        this.container.add(sub);
      }

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

      this.container.setAlpha(0).setVisible(true);
      this.scene.tweens.add({
        targets: this.container,
        alpha: 1,
        duration: 240,
        ease: 'Sine.easeOut',
      });
    });
  }

  private dismiss(): void {
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: 180,
      ease: 'Sine.easeIn',
      onComplete: () => {
        this.container.setVisible(false);
        const r = this.resolver;
        this.resolver = null;
        r?.();
      },
    });
  }

  destroy(): void {
    this.container.destroy();
  }
}
