import Phaser from 'phaser';

/**
 * Full-screen beat shown immediately after the title-screen tap that unlocks
 * audio, and before profile selection. Audio is already unlocked by BootScene's
 * first tap — this screen only delivers the sound notice and waits for a second
 * tap to advance. It must NOT touch the audio-unlock path.
 */
export class SoundNoticeScene extends Phaser.Scene {
  constructor() {
    super({ key: 'SoundNoticeScene' });
  }

  create(): void {
    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor('#0a0a1f');
    this.cameras.main.fadeIn(300, 0, 0, 0);

    // Soft glow, matching the title screen.
    const glow = this.add.circle(width / 2, height / 2 - 20, 180, 0xf5c542, 0.08);
    this.tweens.add({
      targets: glow,
      alpha: 0.18,
      duration: 1600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Same size + color as the "Caius's First Year" title on the first screen.
    this.add
      .text(width / 2, height / 2 - 20, 'This game is recommended to be played with sound.', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '28px',
        color: '#fcd34d',
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: width - 60 },
      })
      .setOrigin(0.5);

    const prompt = this.add
      .text(width / 2, height / 2 + 80, 'Tap to continue', {
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

    // Second tap (anywhere) advances to profile selection/creation.
    this.input.once('pointerdown', () => {
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.scene.start('MenuScene');
      });
    });
  }
}
