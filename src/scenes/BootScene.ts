import Phaser from 'phaser';
import { initAnalytics, track } from '../systems/Analytics';
import { SaveManager } from '../systems/SaveManager';
import { SettingsManager } from '../systems/Settings';
import { SoundBank } from '../systems/SoundBank';
import { MusicManager } from '../systems/MusicManager';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  create(): void {
    SaveManager.load();
    SettingsManager.load();
    initAnalytics();
    // Notify main.ts so it can sync game.sound.mute, MusicManager, and the HUD glyph
    // to whatever SettingsManager.load() resolved (persisted pref or fresh default).
    this.game.events.emit('settings-loaded');
    MusicManager.play('homescreen');

    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor('#0a0a1f');

    // Soft glow circle behind the title
    const glow = this.add.circle(width / 2, height / 2 - 40, 180, 0xf5c542, 0.08);
    this.tweens.add({
      targets: glow,
      alpha: 0.18,
      duration: 1600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    const title = this.add
      .text(width / 2, height / 2 - 80, "Caius's First Year", {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '34px',
        color: '#fcd34d',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    const subtitle = this.add
      .text(width / 2, height / 2 - 32, 'A year around the sun', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '16px',
        color: '#fde68a',
      })
      .setOrigin(0.5)
      .setAlpha(0.7);

    const prompt = this.add
      .text(width / 2, height / 2 + 80, 'Tap to begin', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '20px',
        color: '#fef3c7',
      })
      .setOrigin(0.5);

    this.tweens.add({
      targets: prompt,
      alpha: 0.3,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Hint about audio (with iOS silent-switch nudge when applicable)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const audioHint = isIOS
      ? 'Best experienced with sound on. iPhone: silent switch must be off.'
      : 'Best experienced with sound on. You can mute anytime.';
    this.add
      .text(width / 2, height - 60, audioHint, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '12px',
        color: '#fde68a',
        align: 'center',
        wordWrap: { width: width - 60 },
      })
      .setOrigin(0.5)
      .setAlpha(0.45);

    this.input.once('pointerdown', () => {
      this.unlockAudio();
      track('game_started', {
        active_profile_id: SaveManager.getActiveProfile()?.id ?? null,
        had_existing_profiles: SaveManager.getAllProfiles().length > 0,
      });
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        // Audio is unlocked above on this first tap; the sound-notice beat sits
        // between unlock and profile selection.
        this.scene.start('SoundNoticeScene');
      });
      // Prevent further taps from queuing transitions
      void title;
      void subtitle;
    });
  }

  private unlockAudio(): void {
    const sound = this.sound;
    // Force WebAudio resume — Phaser does this on first input, but explicit is safer for iOS.
    const ctx = (sound as Phaser.Sound.WebAudioSoundManager).context;
    if (ctx && ctx.state === 'suspended') {
      void ctx.resume();
    }
    sound.mute = SettingsManager.get().muted;
    // Unlock SoundBank's separate AudioContext within this user gesture
    SoundBank.unlock();
  }
}
