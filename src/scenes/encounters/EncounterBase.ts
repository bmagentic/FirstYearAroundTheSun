import Phaser from 'phaser';
import { SaveManager } from '../../systems/SaveManager';
import { track } from '../../systems/Analytics';
import { SoundBank } from '../../systems/SoundBank';
import { IntroPanel } from '../../ui/IntroPanel';
import type { EncounterId, SaveProfile } from '../../types';

export abstract class EncounterBase extends Phaser.Scene {
  protected profile!: SaveProfile;
  protected encounterId: EncounterId;
  protected introPanel!: IntroPanel;
  protected startedAt = 0;
  protected attempts = 0;

  constructor(key: string, encounterId: EncounterId) {
    super({ key });
    this.encounterId = encounterId;
  }

  init(data: { profile?: SaveProfile }): void {
    const profile = data?.profile ?? SaveManager.getActiveProfile();
    if (!profile) throw new Error(`${this.scene.key} started without a profile`);
    this.profile = profile;
    this.startedAt = Date.now();
    this.attempts = 0;
  }

  protected setupEncounter(): void {
    this.introPanel = new IntroPanel(this);
    this.cameras.main.fadeIn(220, 0, 0, 0);
    track('encounter_triggered', {
      encounter_id: this.encounterId,
      profile_name: this.profile.name,
    });
  }

  /**
   * Pre-play gate: the encounter is built but held frozen behind a title +
   * instruction panel with a Start button. Resolves once the player taps Start.
   */
  protected intro(title: string, instruction: string): Promise<void> {
    return new Promise((resolve) => {
      this.introPanel.show(title, instruction, () => resolve());
    });
  }

  protected showLabel(title: string, subtitle?: string): void {
    const t = this.add
      .text(this.scale.width / 2, 60, title, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '16px',
        color: '#fde68a',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    if (subtitle) {
      this.add
        .text(this.scale.width / 2, 86, subtitle, {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '11px',
          color: '#fde68a',
        })
        .setOrigin(0.5)
        .setAlpha(0.6);
    }
    this.tweens.add({ targets: t, alpha: 0.7, duration: 1200, yoyo: true, repeat: -1 });
  }

  protected completeEncounter(): void {
    const elapsed = Math.floor((Date.now() - this.startedAt) / 1000);
    const result = SaveManager.markEncounterComplete(this.encounterId);
    track('encounter_completed', {
      encounter_id: this.encounterId,
      profile_name: this.profile.name,
      time_seconds: elapsed,
      attempts: this.attempts,
      first_clear: result.firstClear,
    });
    if (result.allFive && result.firstClear) {
      track('cape_cosmetic_earned', { profile_name: this.profile.name });
    }
    SoundBank.play('success-chime');

    // Show cape award toast on top of the fade-out for the 5th clear
    if (result.allFive && result.firstClear) {
      this.showCapeAward(() => this.returnHome());
    } else {
      this.returnHome();
    }
  }

  private showCapeAward(then: () => void): void {
    const dim = this.add
      .rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0x000000, 0.75)
      .setDepth(200);
    const card = this.add
      .text(this.scale.width / 2, this.scale.height / 2, 'Cape cosmetic earned!\nAll 5 wild encounters cleared.', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '16px',
        color: '#fde68a',
        align: 'center',
        fontStyle: 'bold',
        wordWrap: { width: this.scale.width - 80 },
      })
      .setOrigin(0.5)
      .setDepth(201)
      .setAlpha(0);
    this.tweens.add({
      targets: card,
      alpha: 1,
      duration: 400,
      onComplete: () => {
        this.time.delayedCall(2400, () => {
          dim.destroy();
          card.destroy();
          then();
        });
      },
    });
  }

  private returnHome(): void {
    this.cameras.main.fadeOut(320, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      const refreshed = SaveManager.getActiveProfile() ?? this.profile;
      this.scene.start('HouseScene', { profile: refreshed, fromEncounter: true });
    });
  }

  protected softFail(reason: string, message = 'Try again, bubbaman'): void {
    this.attempts++;
    track('encounter_failed', {
      encounter_id: this.encounterId,
      profile_name: this.profile.name,
      fail_reason: reason,
    });
    SoundBank.play('soft-fail');
    this.cameras.main.shake(200, 0.004);
    const t = this.add
      .text(this.scale.width / 2, this.scale.height - 90, message, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '15px',
        color: '#fde68a',
        backgroundColor: '#1c1410',
        padding: { x: 10, y: 6 },
      })
      .setOrigin(0.5)
      .setDepth(300);
    this.tweens.add({
      targets: t,
      alpha: 0,
      duration: 500,
      delay: 900,
      onComplete: () => t.destroy(),
    });
  }
}
