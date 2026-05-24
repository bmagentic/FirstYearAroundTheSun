import Phaser from 'phaser';
import { SaveManager } from '../../systems/SaveManager';
import { track } from '../../systems/Analytics';
import { ChapterCard } from '../../ui/ChapterCard';
import { SoundBank } from '../../systems/SoundBank';
import type { SaveProfile } from '../../types';

export abstract class ChapterBase extends Phaser.Scene {
  protected profile!: SaveProfile;
  protected chapterId: number;
  protected card!: ChapterCard;
  protected startedAt = 0;
  protected attempts = 0;

  constructor(key: string, chapterId: number) {
    super({ key });
    this.chapterId = chapterId;
  }

  init(data: { profile?: SaveProfile }): void {
    const profile = data?.profile ?? SaveManager.getActiveProfile();
    if (!profile) throw new Error(`${this.scene.key} started without a profile`);
    this.profile = profile;
    this.startedAt = Date.now();
    this.attempts = 0;
  }

  protected setup(): void {
    this.card = new ChapterCard(this);
    this.cameras.main.fadeIn(220, 0, 0, 0);
    track('chapter_started', {
      chapter_id: this.chapterId,
      profile_name: this.profile.name,
    });
  }

  protected intro(heading: string, subhead?: string): Promise<void> {
    return this.card.show(heading, subhead);
  }

  protected completeChapter(opts: { nextScene?: string } = {}): void {
    SaveManager.markChapterComplete(this.chapterId);
    const elapsed = Math.floor((Date.now() - this.startedAt) / 1000);
    track('chapter_completed', {
      chapter_id: this.chapterId,
      profile_name: this.profile.name,
      time_seconds: elapsed,
      attempts: this.attempts,
    });
    SoundBank.play('success-chime');
    this.cameras.main.fadeOut(320, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      const refreshed = SaveManager.getActiveProfile() ?? this.profile;
      this.scene.start(opts.nextScene ?? 'HouseScene', { profile: refreshed });
    });
  }

  protected softFail(reason: string, message = 'Try again, bubbaman'): void {
    this.attempts++;
    track('chapter_failed', {
      chapter_id: this.chapterId,
      profile_name: this.profile.name,
      fail_reason: reason,
    });
    SoundBank.play('soft-fail');
    this.cameras.main.shake(220, 0.005);

    const t = this.add
      .text(this.scale.width / 2, this.scale.height / 2 + 160, message, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '16px',
        color: '#fde68a',
        backgroundColor: '#1c1410',
        padding: { x: 12, y: 8 },
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
