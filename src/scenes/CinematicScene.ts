import Phaser from 'phaser';
import { SettingsManager } from '../systems/Settings';
import { MusicManager } from '../systems/MusicManager';
import { SaveManager } from '../systems/SaveManager';
import { track } from '../systems/Analytics';
import type { SaveProfile } from '../types';

// Hosted on Vercel Blob — streamed at runtime, never committed to the repo.
// NOTE: the cinematic's audio respects the global mute flag at the moment playback
// starts (video.muted = SettingsManager.get().muted). Mid-film muting via the HUD
// is not synced to the video element (the overlay is above the HUD in z-order).
// Brandon: if you want the finale to ALWAYS play with sound regardless of mute, set
// video.muted = false unconditionally below and remove the flag check.
const CINEMATIC_URL =
  'https://wgqhihidrvpc9azl.private.blob.vercel-storage.com/CaiusFinale2.mp4' +
  '?vercel-blob-delegation=eyJzdG9yZUlkIjoic3RvcmVfd0dxSGlIaWRSdnBjOUFabCIsIm93bmVySWQiOiJ0ZWFtX1hDTWpTYkk5WGNUOHZkbEFheHZobnFqQSIsInBhdGhuYW1lIjoiKiIsIm9wZXJhdGlvbnMiOlsiZ2V0IiwiaGVhZCJdLCJ2YWxpZFVudGlsIjoxNzgyMDM3OTAwMzA1LCJpYXQiOjE3ODE5OTQ3MDAzNDd9.ep92G-PrV6FboVKTJnXxT1utDyp1Vnb3h35JfwaNch8' +
  '&vercel-blob-signature=xam05NyPvFigPkuj72SGcFNs6mIC_SFeiyo85ZqEpg8';

// Seconds before the skip button fades in — give them the opening before skipping.
const SKIP_DELAY_S = 5;

export class CinematicScene extends Phaser.Scene {
  private containerEl: HTMLDivElement | null = null;
  private profile: SaveProfile | null = null;
  private exited = false;

  constructor() {
    super({ key: 'CinematicScene' });
  }

  init(data: { profile?: SaveProfile }): void {
    this.profile = data?.profile ?? SaveManager.getActiveProfile();
    if (this.profile) {
      track('game_completed', {
        profile_name: this.profile.name,
        total_play_time_seconds: this.profile.totalPlayTimeSeconds,
      });
    }
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#000000');
    // Cinematic owns its audio — stop game music before it starts.
    MusicManager.stop(300);

    // Full-screen container overlaid on top of everything (above HUD at z-40).
    const container = document.createElement('div');
    container.id = 'cinematic-container';
    container.style.cssText =
      'position:fixed;top:0;left:0;width:100%;height:100%;z-index:100;' +
      'background:#000;display:flex;align-items:center;justify-content:center;overflow:hidden';
    this.containerEl = container;

    // Video element — playsinline prevents iOS fullscreen-native takeover.
    const video = document.createElement('video');
    video.src = CINEMATIC_URL;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', ''); // legacy iOS < 10
    video.setAttribute('preload', 'auto');
    video.muted = SettingsManager.get().muted;
    video.style.cssText = 'width:100%;height:100%;object-fit:contain';
    container.appendChild(video);

    // Subtle skip button — hidden for SKIP_DELAY_S so they see the opening.
    const skipBtn = document.createElement('button');
    skipBtn.textContent = 'Skip ›';
    skipBtn.style.cssText =
      'position:absolute;bottom:24px;right:24px;' +
      'background:rgba(0,0,0,0.45);color:rgba(255,255,255,0.7);' +
      'border:1px solid rgba(255,255,255,0.25);' +
      'padding:7px 18px;border-radius:24px;font-family:system-ui,sans-serif;font-size:14px;' +
      'cursor:pointer;opacity:0;transition:opacity 0.8s;pointer-events:none';
    container.appendChild(skipBtn);
    setTimeout(() => {
      skipBtn.style.opacity = '0.55';
      skipBtn.style.pointerEvents = 'auto';
    }, SKIP_DELAY_S * 1000);
    skipBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.exit();
    });

    document.body.appendChild(container);

    // End → home screen.
    video.addEventListener('ended', () => this.exit(), { once: true });

    // Network/decode error → brief message, then home (no hanging black screen).
    video.addEventListener('error', () => {
      console.error('[cinematic] video failed to load');
      this.showError();
    }, { once: true });

    // Attempt autoplay. On iOS Safari, <video> audio may be blocked even after
    // AudioContext is unlocked — fall back to a tap-to-play prompt.
    void video.play().catch(() => this.showTapToPlay(video));

    // Cleanup DOM on scene shutdown (handles both normal exit and mid-scene teardown).
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
  }

  /** iOS autoplay blocked — show a tap prompt before starting the film. */
  private showTapToPlay(video: HTMLVideoElement): void {
    const container = this.containerEl;
    if (!container) return;

    const style = document.createElement('style');
    style.textContent = '@keyframes cinPulse{0%,100%{opacity:1}50%{opacity:0.4}}';
    document.head.appendChild(style);

    const prompt = document.createElement('div');
    prompt.style.cssText =
      'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);' +
      'color:#fde68a;font-size:26px;font-weight:bold;font-family:system-ui,sans-serif;' +
      'text-align:center;pointer-events:none;animation:cinPulse 1.2s ease-in-out infinite';
    prompt.textContent = 'Tap to play';
    container.appendChild(prompt);

    const handler = (): void => {
      prompt.remove();
      style.remove();
      void video.play().catch(() => this.exit()); // still blocked → skip to home
      container.removeEventListener('pointerdown', handler);
    };
    container.addEventListener('pointerdown', handler, { once: true });
  }

  /** Video failed to load — brief message, then send the player home. */
  private showError(): void {
    const container = this.containerEl;
    if (!container) return;
    const msg = document.createElement('div');
    msg.style.cssText =
      'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);' +
      'color:#fde68a;font-size:18px;font-family:system-ui,sans-serif;' +
      'text-align:center;line-height:1.6;padding:0 48px;white-space:pre-line';
    msg.textContent = 'Could not load the cinematic.\nReturning home…';
    container.appendChild(msg);
    setTimeout(() => this.exit(), 2500);
  }

  private exit(): void {
    if (this.exited) return;
    this.exited = true;
    this.cleanup();
    MusicManager.play('homescreen');
    this.scene.start('MenuScene');
  }

  private cleanup(): void {
    if (this.containerEl) {
      const video = this.containerEl.querySelector('video');
      if (video) {
        video.pause();
        video.src = ''; // release media resource
      }
      this.containerEl.remove();
      this.containerEl = null;
    }
  }
}
