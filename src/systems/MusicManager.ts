import { SettingsManager } from './Settings';

export type TrackId = 'homescreen' | 'free-roam';
export type MusicTier = 'FULL' | 'DUCKED' | 'OFF';

// Per-track base volume (background level — present but not overpowering SFX).
const TRACK_VOLUME: Record<TrackId, number> = {
  homescreen:  0.40,
  'free-roam': 0.45,
};

const TIER_MULTIPLIER: Record<MusicTier, number> = {
  FULL:   1.0,
  DUCKED: 0.28,
  OFF:    0.0,
};

// Track map — extend this to add per-chapter songs without touching scene code.
// null track = silence (chapters/interludes/encounters own their own audio).
export type SceneMusicConfig = { track: TrackId | null; tier: MusicTier };
export const SCENE_MUSIC_MAP: Partial<Record<string, SceneMusicConfig>> = {
  BootScene:        { track: 'homescreen', tier: 'FULL' },
  SoundNoticeScene: { track: 'homescreen', tier: 'FULL' },
  MenuScene:        { track: 'homescreen', tier: 'FULL' },
  HouseScene:       { track: 'free-roam',  tier: 'FULL' },
  // Chapter / interlude / encounter / cinematic scenes → not listed = silent
};

const FADE_STEP_MS = 16; // ~60 fps fade ticks

function trackFile(id: TrackId): string {
  const map: Record<TrackId, string> = {
    homescreen:  'GameAudio_Homescreen.mp3',
    'free-roam': 'GameAudio_FreeRoam.mp3',
  };
  return map[id];
}

class MusicManagerImpl {
  private currentId: TrackId | null = null;
  private el: HTMLAudioElement | null = null;
  private fadeTimer: ReturnType<typeof setInterval> | null = null;
  private tier: MusicTier = 'FULL';

  /**
   * Preload both tracks so first play() starts without a buffering pause.
   * Call once from main.ts after the Phaser game READY event.
   * Preload does NOT require a user gesture — only .play() does.
   */
  preload(): void {
    for (const id of Object.keys(TRACK_VOLUME) as TrackId[]) {
      const a = new Audio(`/assets/audio/music/${trackFile(id)}`);
      a.preload = 'auto';
      a.load();
    }
  }

  /**
   * Start playing a track, looping.
   * If the track is already playing, no-ops.
   * If muted, records intent and starts when setMuted(false) is called.
   */
  play(id: TrackId): void {
    if (this.currentId === id && this.el && !this.el.paused) return;
    this.killFade();
    this.stopImmediate();
    this.currentId = id;
    if (!SettingsManager.get().muted) {
      this.startEl(id, this.targetVol(id));
    }
  }

  /**
   * Crossfade from the current track to a new one.
   * fadeMs = total window; current out in the first half, new in during the second.
   * If muted or nothing is playing, falls back to plain play().
   */
  crossfadeTo(id: TrackId, fadeMs = 500): void {
    if (this.currentId === id && this.el && !this.el.paused) return;
    if (SettingsManager.get().muted || !this.el || this.el.paused) {
      this.play(id);
      return;
    }
    const half = Math.max(50, fadeMs / 2);
    this.fadeOut(half, () => {
      this.currentId = id;
      this.stopImmediate();
      this.startEl(id, 0);
      this.fadeIn(half, this.targetVol(id));
    });
  }

  /**
   * Stop music with an optional fade.
   * fadeMs = 0 stops immediately.
   */
  stop(fadeMs = 0): void {
    this.currentId = null;
    if (fadeMs > 0 && this.el && !this.el.paused) {
      this.fadeOut(fadeMs, () => this.stopImmediate());
    } else {
      this.killFade();
      this.stopImmediate();
    }
  }

  /** Called from main.ts onMuteChange. Pauses/resumes the active track. */
  setMuted(muted: boolean): void {
    if (muted) {
      this.killFade();
      this.el?.pause();
    } else if (this.currentId) {
      if (this.el) {
        // Resume a paused (was-muted) element; restart if the element lost its src.
        void this.el.play().catch(() => {
          if (this.currentId) this.startEl(this.currentId, this.targetVol(this.currentId));
        });
      } else {
        this.startEl(this.currentId, this.targetVol(this.currentId));
      }
    }
  }

  /** Adjust volume tier immediately (FULL / DUCKED / OFF). */
  setTier(tier: MusicTier): void {
    this.tier = tier;
    if (this.el && this.currentId) {
      this.el.volume = this.targetVol(this.currentId);
    }
  }

  // ── private ──────────────────────────────────────────────────────────────────

  private targetVol(id: TrackId): number {
    return TRACK_VOLUME[id] * TIER_MULTIPLIER[this.tier];
  }

  private startEl(id: TrackId, vol: number): void {
    const el = new Audio(`/assets/audio/music/${trackFile(id)}`);
    el.loop = true;
    el.volume = Math.max(0, Math.min(1, vol));
    this.el = el;
    void el.play().catch(() => {
      // Autoplay blocked — only possible if called before a user gesture; safe to ignore.
    });
  }

  private stopImmediate(): void {
    if (this.el) {
      this.el.pause();
      this.el.src = '';
      this.el = null;
    }
  }

  private killFade(): void {
    if (this.fadeTimer !== null) {
      clearInterval(this.fadeTimer);
      this.fadeTimer = null;
    }
  }

  private fadeOut(durationMs: number, onComplete: () => void): void {
    this.killFade();
    const el = this.el;
    if (!el || el.paused) { onComplete(); return; }
    const startVol = el.volume;
    const steps = Math.max(1, Math.round(durationMs / FADE_STEP_MS));
    const dec = startVol / steps;
    let step = 0;
    this.fadeTimer = setInterval(() => {
      step++;
      if (step >= steps) {
        el.volume = 0;
        this.killFade();
        onComplete();
      } else {
        el.volume = Math.max(0, startVol - dec * step);
      }
    }, FADE_STEP_MS);
  }

  private fadeIn(durationMs: number, targetVol: number): void {
    this.killFade();
    const el = this.el;
    if (!el) return;
    const steps = Math.max(1, Math.round(durationMs / FADE_STEP_MS));
    const inc = targetVol / steps;
    let step = 0;
    this.fadeTimer = setInterval(() => {
      step++;
      if (step >= steps) {
        el.volume = targetVol;
        this.killFade();
      } else {
        el.volume = Math.min(targetVol, inc * step);
      }
    }, FADE_STEP_MS);
  }
}

export const MusicManager = new MusicManagerImpl();
