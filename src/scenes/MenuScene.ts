import Phaser from 'phaser';
import { identify, track } from '../systems/Analytics';
import { ProfilePicker } from '../ui/ProfilePicker';
import { MusicManager } from '../systems/MusicManager';

export class MenuScene extends Phaser.Scene {
  private picker: ProfilePicker | null = null;

  constructor() {
    super({ key: 'MenuScene' });
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#1c1410');
    this.cameras.main.fadeIn(300, 0, 0, 0);
    MusicManager.play('homescreen');

    const overlay = document.getElementById('profile-picker');
    if (!overlay) {
      console.error('Missing #profile-picker overlay element');
      return;
    }

    this.picker = new ProfilePicker(overlay, {
      onProfileSelected: (profile) => {
        console.log('[menu] profile selected:', profile.name, 'room=', profile.currentRoom);
        try {
          identify(profile.name);
          track('profile_selected', {
            profile_name: profile.name,
            is_new_profile: profile.completedChapters.length === 0,
            chapters_done: profile.completedChapters.length,
          });
        } catch (err) {
          console.warn('[menu] analytics call failed', err);
        }
        this.cameras.main.fadeOut(180, 0, 0, 0);
        this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
          console.log('[menu] fade out done, starting HouseScene');
          this.scene.start('HouseScene', { profile });
        });
      },
    });

    this.picker.show();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.picker?.hide();
    });
  }
}
