import { SettingsManager } from './Settings';

export type TrackId = 'homescreen' | 'free-roam' | 'tender' | 'playful' | 'tension' | 'triumphant' | 'finale';
export type MusicTier = 'FULL' | 'DUCKED' | 'OFF';

// Per-track base volume (background level — present but not overpowering SFX).
const TRACK_VOLUME: Record<TrackId, number> = {
  homescreen:   0.40,
  'free-roam':  0.45,
  tender:       0.40,
  playful:      0.45,
  tension:      0.42,
  triumphant:   0.45,
  finale:       0.48,
};

const TIER_MULTIPLIER: Record<MusicTier, number> = {
  FULL:   1.0,
  DUCKED: 0.28,
  OFF:    0.0,
};

// ── Track map ───────────────────────────────────────────────────────────────────
// Single place to configure music for every scene. Add an entry here to give a
// scene its own track without touching any scene code.
// null track  = silence (interludes/PostCredits own their audio; not listed here).
// tier DUCKED = ~28% volume so SFX reads clearly over the music.
export type SceneMusicConfig = { track: TrackId | null; tier: MusicTier };
export const SCENE_MUSIC_MAP: Partial<Record<string, SceneMusicConfig>> = {
  // ── Home screens ─────────────────────────────────────────────────────────────
  BootScene:          { track: 'homescreen',  tier: 'FULL' },
  SoundNoticeScene:   { track: 'homescreen',  tier: 'FULL' },
  MenuScene:          { track: 'homescreen',  tier: 'FULL' },
  // ── Free roam ────────────────────────────────────────────────────────────────
  HouseScene:         { track: 'free-roam',   tier: 'FULL' },
  // ── Chapters ─────────────────────────────────────────────────────────────────
  // Ch01 = sound-localization (dark nursery, heartbeat/voice/bark rings) — tender mood,
  // DUCKED so the directional audio cues read clearly over the music.
  Ch01_Arrival:       { track: 'tender',      tier: 'DUCKED' },
  // Ch02 First Focus: holding focus on mama — tender + DUCKED (blur/focus mechanic).
  Ch02_FirstSmile:    { track: 'tender',      tier: 'DUCKED' },
  // Ch03 First Touch: texture discovery — tender + DUCKED (object SFX must dominate).
  Ch03_EyesOpen:      { track: 'tender',      tier: 'DUCKED' },
  // Ch04 maze roll — tension (obstacle course).
  Ch04_RollOut:       { track: 'tension',     tier: 'FULL' },
  // Ch05 HoliDad Inn: tilting bed silliness + crawl — playful.
  Ch05_HoliDadInn:    { track: 'playful',     tier: 'FULL' },
  // Ch06 dog toy grab: chaotic dog-filled mini-game — playful.
  Ch06_GrabBag:       { track: 'playful',     tier: 'FULL' },
  // Ch07 First Bites: warm family meal with Chelsea — tender.
  Ch07_FirstBites:    { track: 'tender',      tier: 'FULL' },
  // Ch08 sleep training: gentle night-time rhythm — tender.
  Ch08_SleepTraining: { track: 'tender',      tier: 'FULL' },
  // Ch09 MazeWalker: obstacle-dodge maze to Mama — tension.
  Ch09_MazeWalker:    { track: 'tension',     tier: 'FULL' },
  // Ch10 Chatterbox: first words, triumphant milestone — triumphant.
  Ch10_Chatterbox:    { track: 'triumphant',  tier: 'FULL' },
  // Ch11 Ledges: cruising → first steps — triumphant.
  Ch11_Ledges:        { track: 'triumphant',  tier: 'FULL' },
  // Ch12 Liftoff: finale only — its own dedicated track.
  Ch12_Liftoff:       { track: 'finale',      tier: 'FULL' },
  // Bonus Crime Fighting Super Baby — triumphant (heroic + cape).
  BonusChapter:       { track: 'triumphant',  tier: 'FULL' },
  // ── Wild encounters ──────────────────────────────────────────────────────────
  SnotSucker:         { track: 'tension',     tier: 'FULL' },
  FaceWash:           { track: 'playful',     tier: 'FULL' },
  BottleWait:         { track: 'playful',     tier: 'FULL' },
  ChangingTable:      { track: 'tension',     tier: 'FULL' },
  Roomba:             { track: 'tension',     tier: 'FULL' },
  // Interludes / PostCredits → not listed = handled by InterludeBase / PostCreditsScene stop()
};

const FADE_STEP_MS = 16; // ~60 fps fade ticks

function trackFile(id: TrackId): string {
  const map: Record<TrackId, string> = {
    homescreen:   'GameAudio_Homescreen.mp3',
    'free-roam':  'GameAudio_FreeRoam.mp3',
    tender:       'game_tender.mp3',
    playful:      'game_playful.mp3',
    tension:      'game_tension.mp3',
    triumphant:   'game_triumphant.mp3',
    finale:       'finale.mp3',
  };
  return map[id];
}

class MusicManagerImpl {
  private currentId: TrackId | null = null;
  private el: HTMLAudioElement | null = null;
  private fadeTimer: ReturnType<typeof setInterval> | null = null;
  private tier: MusicTier = 'FULL';

  /**
   * Preload all tracks so first play() starts without a buffering pause.
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
   * If the track is already playing at the same tier, no-ops.
   * If muted, records intent and starts when setMuted(false) is called.
   * Pass `tier` to set volume tier before starting (defaults to current tier).
   */
  play(id: TrackId, tier?: MusicTier): void {
    if (tier !== undefined) this.tier = tier;
    if (this.currentId === id && this.el && !this.el.paused) {
      // Track already playing — just sync tier in case it changed.
      if (tier !== undefined) this.el.volume = this.targetVol(id);
      return;
    }
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
   * Pass `tier` to set the new track's volume tier (defaults to current tier).
   * If muted or nothing is playing, falls back to plain play().
   */
  crossfadeTo(id: TrackId, fadeMs = 500, tier?: MusicTier): void {
    if (tier !== undefined) this.tier = tier;
    if (this.currentId === id && this.el && !this.el.paused) {
      if (tier !== undefined) this.el.volume = this.targetVol(id);
      return;
    }
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
