import Phaser from 'phaser';
import { ChapterBase } from './ChapterBase';
import { SpriteBank } from '../../systems/SpriteBank';

// ── Tunables (easy to adjust) ────────────────────────────────────────────────
const FOCUS_FILL_RATE = 0.085; // meter/sec while the reticle holds on her (~12s to fill)
const FOCUS_DECAY_RATE = 0.04; // meter/sec while off her — slow + forgiving, never a loss
const MAX_BLUR = 6; // postFX blur offset at an empty meter (0 = fully sharp)
// chelsea_encouraging_standing is a 64x64 square sprite; display it square (no stretch).
// 290 ≈ +16% over the previous 250-tall framing.
const MOM_DISPLAY = 290;
// Overlap radius scaled with her rendered size (was 80 for ~250) so focus-fill feels identical.
const FOCUS_RADIUS = Math.round(MOM_DISPLAY * 0.32); // ≈93
const RETICLE_RADIUS = 64;

/**
 * Month 2 — "First Focus" (replaces the retired "tap when her smile peaks" game).
 * Caius's newborn POV: Chelsea drifts by, heavily blurred. The player holds + drags a
 * soft focus reticle over her; holding on her fills a focus meter and the blur resolves
 * toward sharp. Filling the meter is the win — her face snaps sharp, then his own smile
 * (hearts) blooms. No fail state, fill-to-win only.
 */
export class Ch02_FirstSmile extends ChapterBase {
  private chelsea!: Phaser.GameObjects.Image;
  private blurFX: Phaser.FX.Blur | null = null;
  private hazeFallback: Phaser.GameObjects.Rectangle | null = null;
  private reticle!: Phaser.GameObjects.Container;
  private meterArc!: Phaser.GameObjects.Graphics;
  private meter = 0;
  private won = false;
  private started = false;
  private pointerDown = false;
  private driftT = 0;
  private cx = 0;
  private cy = 0;
  private ampX = 0;
  private ampY = 0;

  constructor() {
    super('Ch02_FirstSmile', 2);
  }

  preload(): void {
    SpriteBank.preloadInto(this, ['chelsea-encouraging-standing', 'emote-heart', 'emote-sparkle']);
  }

  /** Emote sprite (32x32) at a target pixel size, falling back to the text glyph. */
  private emote(x: number, y: number, key: string, sizePx: number, glyph: string): Phaser.GameObjects.Image | Phaser.GameObjects.Text {
    if (SpriteBank.has(this, key)) {
      return this.add.image(x, y, key).setDisplaySize(sizePx, sizePx).setOrigin(0.5);
    }
    return this.add
      .text(x, y, glyph, { fontFamily: 'system-ui, sans-serif', fontSize: `${sizePx}px`, color: '#ff8fa3' })
      .setOrigin(0.5);
  }

  create(): void {
    this.setup();
    this.cameras.main.setBackgroundColor('#1a1a24'); // soft dark — newborn vision

    const W = this.scale.width;
    const H = this.scale.height;
    this.cx = W / 2;
    this.cy = H * 0.42;
    this.ampX = W * 0.26;
    this.ampY = H * 0.15;

    // Mom = the real Chelsea sprite (encouraging/standing), starts heavily blurred.
    this.chelsea = this.add
      .image(this.cx, this.cy, 'chelsea-encouraging-standing')
      .setDisplaySize(MOM_DISPLAY, MOM_DISPLAY);

    // Blur path: the game is Phaser.AUTO, which resolves to WebGL on every target
    // device (modern phones / iOS Safari), so we use postFX blur and drive its offset
    // from the focus meter. Fallback for the rare Canvas case: a soft haze overlay that
    // clears as focus fills (no true blur, but conveys unfocused → focused).
    if (this.renderer.type === Phaser.WEBGL && this.chelsea.postFX) {
      this.blurFX = this.chelsea.postFX.addBlur(1, MAX_BLUR, MAX_BLUR, 1, 0xffffff, 4);
    } else {
      this.hazeFallback = this.add.rectangle(this.cx, this.cy, 190, 300, 0xb9bccb, 0.55).setDepth(5);
    }

    // Soft focus reticle — follows the finger while pressed.
    this.reticle = this.add.container(this.cx, H * 0.72).setDepth(20);
    const ring = this.add.circle(0, 0, RETICLE_RADIUS, 0xffffff, 0.04).setStrokeStyle(3, 0xfde68a, 0.7);
    const inner = this.add.circle(0, 0, RETICLE_RADIUS * 0.45, 0xffffff, 0).setStrokeStyle(1, 0xfde68a, 0.4);
    this.meterArc = this.add.graphics();
    this.reticle.add([ring, inner, this.meterArc]);

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!this.started) return;
      this.pointerDown = true;
      this.reticle.setPosition(p.x, p.y);
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.started && this.pointerDown) this.reticle.setPosition(p.x, p.y);
    });
    this.input.on('pointerup', () => {
      this.pointerDown = false;
    });
    this.input.on('pointerupoutside', () => {
      this.pointerDown = false;
    });

    void this.intro('First Focus', 'Find her face.').then(() => {
      this.started = true;
    });
  }

  override update(_time: number, delta: number): void {
    if (!this.started || this.won) return;
    const dt = delta / 1000;

    // Lazy, gentle drift (two slow sines → a wandering path, never twitchy).
    this.driftT += dt;
    this.chelsea.x = this.cx + Math.sin(this.driftT * 0.5) * this.ampX;
    this.chelsea.y = this.cy + Math.sin(this.driftT * 0.37 + 1.3) * this.ampY;
    this.hazeFallback?.setPosition(this.chelsea.x, this.chelsea.y);

    const onTarget =
      this.pointerDown &&
      Phaser.Math.Distance.Between(this.reticle.x, this.reticle.y, this.chelsea.x, this.chelsea.y) < FOCUS_RADIUS;

    this.meter = Phaser.Math.Clamp(
      this.meter + (onTarget ? FOCUS_FILL_RATE : -FOCUS_DECAY_RATE) * dt,
      0,
      1,
    );
    this.applyBlur(1 - this.meter);
    this.drawMeter();

    if (this.meter >= 1) this.win();
  }

  /** amount: 0 = fully sharp, 1 = maximum blur. */
  private applyBlur(amount: number): void {
    if (this.blurFX) {
      this.blurFX.x = MAX_BLUR * amount;
      this.blurFX.y = MAX_BLUR * amount;
    } else if (this.hazeFallback) {
      this.hazeFallback.setAlpha(0.55 * amount);
    }
  }

  private drawMeter(): void {
    this.meterArc.clear();
    if (this.meter <= 0.001) return;
    this.meterArc.lineStyle(5, 0xfde68a, 0.95);
    this.meterArc.beginPath();
    this.meterArc.arc(0, 0, RETICLE_RADIUS + 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * this.meter);
    this.meterArc.strokePath();
  }

  private win(): void {
    this.won = true;
    this.pointerDown = false;
    this.meterArc.clear();
    this.applyBlur(0); // snap fully sharp

    // She "smiles": a warm pulse + hearts rising from her.
    const sx = this.chelsea.scaleX;
    const sy = this.chelsea.scaleY;
    this.tweens.add({ targets: this.chelsea, scaleX: sx * 1.06, scaleY: sy * 1.06, duration: 500, yoyo: true });
    this.emitHearts(this.chelsea.x, this.chelsea.y - 20);

    // Hold a beat, then Caius's own smile blooms (his POV reward).
    this.time.delayedCall(1000, () => this.caiusSmile());
  }

  private emitHearts(x: number, y: number): void {
    for (let i = 0; i < 4; i++) {
      const heart = this.emote(x + Phaser.Math.Between(-40, 40), y, 'emote-heart', Phaser.Math.Between(24, 32), '♥')
        .setDepth(30)
        .setAlpha(0);
      this.tweens.add({
        targets: heart,
        y: y - Phaser.Math.Between(80, 140),
        alpha: { from: 0.9, to: 0 },
        duration: 1400,
        delay: i * 160,
        ease: 'Sine.easeOut',
        onComplete: () => heart.destroy(),
      });
    }
  }

  /** Caius's smile reward: emote heart + sparkle bloom (no caius_happy sprite in manifest). */
  private caiusSmile(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    const bloom = this.emote(W / 2, H * 0.74, 'emote-heart', 72, '♥').setDepth(40).setAlpha(0);
    const full = bloom.scaleX;
    bloom.setScale(full * 0.4); // pop-in
    const sparkles = this.emote(W / 2, H * 0.74, 'emote-sparkle', 48, '✨').setDepth(40).setAlpha(0);
    this.tweens.add({ targets: bloom, alpha: 1, scale: full, duration: 500, ease: 'Back.easeOut' });
    this.tweens.add({ targets: sparkles, alpha: { from: 0, to: 0.9 }, duration: 600, delay: 200, yoyo: true });
    this.time.delayedCall(1100, () => this.completeChapter());
  }
}
