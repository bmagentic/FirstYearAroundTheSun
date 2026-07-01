import Phaser from 'phaser';
import { SettingsManager } from '../systems/Settings';
import { MusicManager } from '../systems/MusicManager';
import { SaveManager } from '../systems/SaveManager';
import { track } from '../systems/Analytics';
import type { SaveProfile } from '../types';

// Finale film, hosted on Vercel Blob — streamed at runtime, never committed.
//
// IMPORTANT (why the finale broke for guests): this MUST be a PUBLIC Vercel Blob
// URL — i.e. `https://<store>.public.blob.vercel-storage.com/<file>` with NO
// query token. A *private* blob is only reachable via a signed URL whose
// delegation token EXPIRES (Vercel's default lifetime is ~12h). The old build
// used exactly such a signed private URL; its token expired 2026-06-21, so after
// that ~12h window every guest (and eventually Brandon) got HTTP 403 and hit the
// error/recovery path. A public blob has no token and never expires.
//
// The URL is read from VITE_CINEMATIC_URL so it can be swapped without a code
// change: set it in Vercel → Settings → Environment Variables (Production) to the
// public blob URL, then REDEPLOY (Vite inlines env vars at build time). If unset,
// the scene skips straight to the graceful "couldn't load → home" recovery
// instead of trying a dead URL.
const CINEMATIC_URL = import.meta.env.VITE_CINEMATIC_URL as string | undefined;

// Seconds before the skip button fades in — give them the opening before skipping.
const SKIP_DELAY_S = 5;
// If playing hasn't fired within this many ms, show the error/recovery UI.
const LOAD_TIMEOUT_MS = 15_000;

export class CinematicScene extends Phaser.Scene {
  private containerEl: HTMLDivElement | null = null;
  private loadingEl: HTMLDivElement | null = null;
  private stallTimer: ReturnType<typeof setTimeout> | null = null;
  private profile: SaveProfile | null = null;
  private exited = false;
  private recovering = false;

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
    // Reset per-run state in case the scene is ever restarted.
    this.exited = false;
    this.recovering = false;
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

    // No URL configured (VITE_CINEMATIC_URL unset in this build) — don't attempt a
    // dead request; go straight to the graceful recovery so nobody hits a black hang.
    if (!CINEMATIC_URL) {
      document.body.appendChild(container);
      this.showError();
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
      return;
    }

    // Video element — playsinline prevents iOS fullscreen-native takeover.
    const video = document.createElement('video');
    video.src = CINEMATIC_URL;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', ''); // legacy iOS < 10
    video.setAttribute('preload', 'auto');
    video.muted = SettingsManager.get().muted;
    video.style.cssText = 'width:100%;height:100%;object-fit:contain';
    container.appendChild(video);

    // Loading indicator — visible while video buffers, fades out on first frame.
    const loadingEl = document.createElement('div');
    loadingEl.style.cssText =
      'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);' +
      'color:rgba(253,230,138,0.65);font-size:15px;font-family:system-ui,sans-serif;' +
      'letter-spacing:0.08em;pointer-events:none;transition:opacity 0.5s';
    loadingEl.textContent = 'Loading…';
    container.appendChild(loadingEl);
    this.loadingEl = loadingEl;

    // Stall guard — if playing hasn't fired in time, recover gracefully.
    this.stallTimer = setTimeout(() => {
      this.stallTimer = null;
      this.showError();
    }, LOAD_TIMEOUT_MS);

    // Subtle skip button — hidden until SKIP_DELAY_S so they see the opening.
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

    // First frame playing → dismiss loading state.
    video.addEventListener('playing', () => this.clearLoadState(), { once: true });

    // End → home screen.
    video.addEventListener('ended', () => this.exit(), { once: true });

    // Network/decode error → clear load state, recover gracefully.
    video.addEventListener('error', () => {
      this.clearLoadState();
      this.showError();
    }, { once: true });

    // Attempt autoplay. On iOS Safari, <video> audio may be blocked even after
    // AudioContext is unlocked — fall back to a tap-to-play prompt.
    void video.play().catch(() => {
      this.clearLoadState();
      this.showTapToPlay(video);
    });

    // Cleanup DOM on scene shutdown (handles both normal exit and mid-scene teardown).
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
  }

  /** Dismiss the loading indicator and cancel the stall timer. Idempotent. */
  private clearLoadState(): void {
    if (this.stallTimer !== null) {
      clearTimeout(this.stallTimer);
      this.stallTimer = null;
    }
    if (this.loadingEl) {
      this.loadingEl.style.opacity = '0';
      const el = this.loadingEl;
      this.loadingEl = null;
      // Remove after fade completes; safe on a detached element.
      setTimeout(() => el.remove(), 600);
    }
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

  /** Video failed to load or timed out — brief message, then send the player home. */
  private showError(): void {
    if (this.recovering || this.exited) return;
    this.recovering = true;
    this.clearLoadState();
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
    this.clearLoadState();
    this.cleanup();
    MusicManager.play('homescreen');
    this.scene.start('MenuScene');
  }

  private cleanup(): void {
    if (this.stallTimer !== null) {
      clearTimeout(this.stallTimer);
      this.stallTimer = null;
    }
    if (this.loadingEl) {
      this.loadingEl.remove();
      this.loadingEl = null;
    }
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
