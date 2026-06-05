import Phaser from 'phaser';

const OFF_WHITE = '#F5EFE0';

/**
 * Shared caption treatment for interludes / cutscene beats. Single source of truth so
 * no beat renders bare text on the background:
 *  - a semi-opaque dark band pinned to the lower third (full width, safe-area aware)
 *    holding the caption and an in-band "Tap to continue" prompt;
 *  - a small matching dark pill at top-center for the time-of-day / setting label.
 *
 * The band's own tweens are used for fades; this component never calls tweens.pauseAll().
 */
export class CaptionBand {
  private scene: Phaser.Scene;
  private band: Phaser.GameObjects.Container;
  private caption: Phaser.GameObjects.Text;
  private prompt: Phaser.GameObjects.Text;
  private promptTween: Phaser.Tweens.Tween | null = null;
  private pill: Phaser.GameObjects.Container;
  private pillBg: Phaser.GameObjects.Graphics;
  private pillText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, depth = 200) {
    this.scene = scene;
    const W = scene.scale.width;
    const H = scene.scale.height;

    const safeBottom = 28;
    const bandTop = Math.round(H * 0.7);
    const bandBottom = H - safeBottom;
    const bandH = bandBottom - bandTop;
    const bandCY = (bandTop + bandBottom) / 2;

    this.band = scene.add.container(0, 0).setDepth(depth).setAlpha(0);

    const rect = scene.add.rectangle(W / 2, bandCY, W, bandH, 0x000000, 0.55);
    this.band.add(rect);

    this.caption = scene.add
      .text(W / 2, bandCY - 8, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '18px',
        color: OFF_WHITE,
        align: 'center',
        wordWrap: { width: W - 56 },
      })
      .setOrigin(0.5);
    this.caption.setShadow(1, 2, 'rgba(0,0,0,0.85)', 3, false, true);
    this.band.add(this.caption);

    this.prompt = scene.add
      .text(W / 2, bandBottom - 18, 'Tap to continue', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '12px',
        color: OFF_WHITE,
      })
      .setOrigin(0.5)
      .setAlpha(0)
      .setVisible(false);
    this.band.add(this.prompt);

    // Top-center setting pill.
    this.pill = scene.add.container(W / 2, 24 + 16).setDepth(depth).setAlpha(0);
    this.pillBg = scene.add.graphics();
    this.pillText = scene.add
      .text(0, 0, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '12px',
        color: OFF_WHITE,
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.pill.add([this.pillBg, this.pillText]);
  }

  /** Set the top-center time-of-day / setting pill. Pass '' to hide it. */
  setSetting(label: string): void {
    if (!label) {
      this.scene.tweens.add({ targets: this.pill, alpha: 0, duration: 200 });
      return;
    }
    this.pillText.setText(label.toUpperCase());
    const w = Math.ceil(this.pillText.width) + 28;
    const h = 26;
    this.pillBg.clear();
    this.pillBg.fillStyle(0x000000, 0.55);
    this.pillBg.fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    this.scene.tweens.add({ targets: this.pill, alpha: 1, duration: 260 });
  }

  /** Show a caption persistently (band stays up until cleared / replaced). */
  setCaption(text: string): void {
    this.caption.setText(text);
    this.setPrompt(false);
    this.scene.tweens.add({ targets: this.band, alpha: 1, duration: 320, ease: 'Sine.easeOut' });
  }

  /** Toggle the in-band "Tap to continue" prompt (pulses while visible). */
  setPrompt(visible: boolean): void {
    this.promptTween?.stop();
    this.promptTween = null;
    if (visible) {
      this.prompt.setVisible(true).setAlpha(0.6);
      this.promptTween = this.scene.tweens.add({
        targets: this.prompt,
        alpha: 0.2,
        duration: 1100,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    } else {
      this.prompt.setAlpha(0).setVisible(false);
    }
  }

  /** Transient caption: fade the band in, hold, fade out. Resolves when gone. */
  flashCaption(text: string, holdMs = 1800): Promise<void> {
    return new Promise((resolve) => {
      this.setPrompt(false);
      this.caption.setText(text);
      this.scene.tweens.add({
        targets: this.band,
        alpha: 1,
        duration: 380,
        ease: 'Sine.easeOut',
        onComplete: () => {
          this.scene.time.delayedCall(holdMs, () => {
            this.scene.tweens.add({
              targets: this.band,
              alpha: 0,
              duration: 380,
              ease: 'Sine.easeIn',
              onComplete: () => resolve(),
            });
          });
        },
      });
    });
  }

  destroy(): void {
    this.promptTween?.stop();
    this.band.destroy();
    this.pill.destroy();
  }
}

/**
 * Small dark pill behind a short label, for interactive beats whose layout can't use the
 * lower-third band. Returns the container (label centered on a rounded dark rect).
 */
export function makePill(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  fontSize = 12,
): Phaser.GameObjects.Container {
  const label = scene.add
    .text(0, 0, text, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: `${fontSize}px`,
      color: OFF_WHITE,
      align: 'center',
    })
    .setOrigin(0.5);
  const w = Math.ceil(label.width) + 24;
  const h = Math.ceil(label.height) + 12;
  const bg = scene.add.graphics();
  bg.fillStyle(0x000000, 0.55);
  bg.fillRoundedRect(-w / 2, -h / 2, w, h, Math.min(h / 2, 14));
  return scene.add.container(x, y, [bg, label]);
}
