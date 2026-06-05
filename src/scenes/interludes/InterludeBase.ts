import Phaser from 'phaser';
import { SaveManager } from '../../systems/SaveManager';
import { track } from '../../systems/Analytics';
import { CaptionBand } from '../../ui/CaptionBand';
import type { InterludeId, SaveProfile } from '../../types';

const SPOTLIGHT_KEY = 'interlude-spotlight';

export abstract class InterludeBase extends Phaser.Scene {
  protected profile!: SaveProfile;
  protected interludeId: InterludeId;
  protected startedAt = 0;
  protected captionBand!: CaptionBand;

  constructor(key: string, interludeId: InterludeId) {
    super({ key });
    this.interludeId = interludeId;
  }

  init(data: { profile?: SaveProfile }): void {
    const profile = data?.profile ?? SaveManager.getActiveProfile();
    if (!profile) throw new Error(`${this.scene.key} started without a profile`);
    this.profile = profile;
    this.startedAt = Date.now();
  }

  protected setupInterlude(): void {
    this.cameras.main.fadeIn(450, 0, 0, 0);
    this.captionBand = new CaptionBand(this);
    track('interlude_started', {
      interlude_id: this.interludeId,
      profile_name: this.profile.name,
    });
  }

  protected completeInterlude(nextScene = 'HouseScene'): void {
    SaveManager.markInterludeComplete(this.interludeId);
    const elapsed = Math.floor((Date.now() - this.startedAt) / 1000);
    track('interlude_completed', {
      interlude_id: this.interludeId,
      profile_name: this.profile.name,
      time_seconds: elapsed,
    });
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      const refreshed = SaveManager.getActiveProfile() ?? this.profile;
      this.scene.start(nextScene, { profile: refreshed });
    });
  }

  /** Transient centered caption via the shared band. Resolves when it fades out. */
  protected showCaption(text: string, holdMs = 1800): Promise<void> {
    return this.captionBand.flashCaption(text, holdMs);
  }

  // ── Vignette spotlight framing ──────────────────────────────────────────────

  /** Lazily build a soft (non-banded) white radial-gradient spotlight texture. */
  private ensureSpotlightTexture(): void {
    if (this.textures.exists(SPOTLIGHT_KEY)) return;
    const size = 512;
    const tex = this.textures.createCanvas(SPOTLIGHT_KEY, size, size);
    if (!tex) return;
    const ctx = tex.getContext();
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,0.60)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.16)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    tex.refresh();
  }

  /** A soft spotlight glow centered at (cx, cy), tinted warm or cool. */
  protected addSpotlight(cx: number, cy: number, diameter: number, tint: number): Phaser.GameObjects.Image {
    this.ensureSpotlightTexture();
    return this.add
      .image(cx, cy, SPOTLIGHT_KEY)
      .setDisplaySize(diameter, diameter)
      .setTint(tint)
      .setBlendMode(Phaser.BlendModes.SCREEN);
  }

  /** Full-screen near-black backdrop rectangle (cool by default, warm for day beats). */
  protected backdrop(warm: boolean): Phaser.GameObjects.Rectangle {
    return this.add.rectangle(
      this.scale.width / 2,
      this.scale.height / 2,
      this.scale.width,
      this.scale.height,
      warm ? 0x1a1208 : 0x0c0e1a,
    );
  }

  /**
   * A baked room background scaled to cover the viewport and dimmed (~40% brightness),
   * for located beats. Reuses an already-loaded room texture key.
   */
  protected dimmedRoomBackdrop(textureKey: string): Phaser.GameObjects.GameObject[] {
    const W = this.scale.width;
    const H = this.scale.height;
    const img = this.add.image(W / 2, H / 2, textureKey);
    const cover = Math.max(W / img.width, H / img.height);
    img.setScale(cover).setTint(0x5a5a5a); // ~35-40% brightness
    return [img];
  }
}
