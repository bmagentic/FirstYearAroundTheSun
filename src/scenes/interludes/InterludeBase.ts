import Phaser from 'phaser';
import { SaveManager } from '../../systems/SaveManager';
import { track } from '../../systems/Analytics';
import type { InterludeId, SaveProfile } from '../../types';

export abstract class InterludeBase extends Phaser.Scene {
  protected profile!: SaveProfile;
  protected interludeId: InterludeId;
  protected startedAt = 0;

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

  /** Show a centered caption that fades after a delay. Returns when fade-out completes. */
  protected showCaption(text: string, holdMs = 1800): Promise<void> {
    return new Promise((resolve) => {
      const t = this.add
        .text(this.scale.width / 2, this.scale.height - 90, text, {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '16px',
          color: '#fef3c7',
          align: 'center',
          wordWrap: { width: this.scale.width - 60 },
          fontStyle: 'italic',
        })
        .setOrigin(0.5)
        .setAlpha(0)
        .setDepth(50);
      this.tweens.add({
        targets: t,
        alpha: 1,
        duration: 380,
        ease: 'Sine.easeOut',
        onComplete: () => {
          this.time.delayedCall(holdMs, () => {
            this.tweens.add({
              targets: t,
              alpha: 0,
              duration: 380,
              ease: 'Sine.easeIn',
              onComplete: () => {
                t.destroy();
                resolve();
              },
            });
          });
        },
      });
    });
  }
}
