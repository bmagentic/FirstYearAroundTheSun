import Phaser from 'phaser';
import { SaveManager } from '../../systems/SaveManager';
import { track } from '../../systems/Analytics';
import { IntroPanel } from '../../ui/IntroPanel';
import { MonthCard } from '../../ui/MonthCard';
import { SoundBank } from '../../systems/SoundBank';
import type { SaveProfile } from '../../types';

export abstract class ChapterBase extends Phaser.Scene {
  protected profile!: SaveProfile;
  protected chapterId: number;
  protected introPanel!: IntroPanel;
  protected startedAt = 0;
  protected attempts = 0;
  /**
   * Set by retry() and consumed by the next intro(): a retry restarts the scene to
   * reset gameplay directly, without re-showing the Month card or IntroPanel. Phaser
   * re-sends the original scene data on restart(), so an instance flag — not scene
   * data — is what distinguishes a retry from a fresh entry.
   */
  private skipIntroOnce = false;

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
    this.introPanel = new IntroPanel(this);
    this.cameras.main.fadeIn(220, 0, 0, 0);
    track('chapter_started', {
      chapter_id: this.chapterId,
      profile_name: this.profile.name,
    });
  }

  /**
   * Pre-play gate. On a fresh entry the scene is frozen behind a "Month N" title card
   * and then an instruction panel with a Start button; resolves once the player taps
   * Start. On a retry (see retry()) the card and panel are skipped so gameplay resets
   * directly.
   */
  protected intro(heading: string, subhead?: string): Promise<void> {
    if (this.skipIntroOnce) {
      this.skipIntroOnce = false;
      return Promise.resolve();
    }
    // Freeze up front so nothing runs behind the card or panel — including bespoke
    // flows (e.g. Ch12) that build gameplay around intro() rather than inside .then().
    // The card/panel animate on their own tweens, which pauseAll() leaves alone.
    this.tweens.pauseAll();
    this.time.paused = true;
    return this.showMonthCard().then(
      () =>
        new Promise<void>((resolve) => {
          this.introPanel.show(heading, subhead ?? '', () => resolve());
        }),
    );
  }

  private showMonthCard(): Promise<void> {
    const card = new MonthCard(this);
    const seen = (this.profile.seenChapterCards ?? []).includes(this.chapterId);
    if (seen) {
      return card.show(this.chapterId, { mode: 'tap' });
    }
    return card.show(this.chapterId, { mode: 'timed', holdMs: 2000 }).then(() => {
      const updated = SaveManager.markChapterCardSeen(this.chapterId);
      if (updated) this.profile = updated;
    });
  }

  /**
   * Restart the scene to retry, resetting gameplay without re-showing the Month card
   * or IntroPanel. Chapters should call this instead of this.scene.restart() from
   * their RetryPopup handlers.
   */
  protected retry(): void {
    this.skipIntroOnce = true;
    this.scene.restart();
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
