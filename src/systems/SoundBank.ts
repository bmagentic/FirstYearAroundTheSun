import { SettingsManager } from './Settings';

type Status = 'pending' | 'ready' | 'missing';

type Entry = {
  status: Status;
  audio?: HTMLAudioElement;
};

/**
 * Sound bank with a file → synthesis fallback.
 *
 * Each sound has a canonical id (e.g. "chelsea-heartbeat"). At preload, we
 * try to fetch /assets/audio/{id}.ogg. If it loads, we use it. If it 404s
 * or fails to decode, we fall back to a synthesised placeholder. Per
 * build-notes §8, swapping a real recording in only requires dropping a
 * file at that path — no code changes.
 */
class SoundBankImpl {
  private entries = new Map<string, Entry>();
  private ctx: AudioContext | null = null;
  private unlocked = false;
  private activeClones = new Set<HTMLAudioElement>();

  /** Reuse an already-unlocked AudioContext (e.g. Phaser's) so iOS audio works without re-priming. */
  useContext(ctx: AudioContext): void {
    this.ctx = ctx;
    this.unlocked = ctx.state === 'running';
    console.log('[SoundBank] using shared context, state=', ctx.state);
  }

  /** Call from a user-gesture handler (e.g. BootScene tap) to unlock audio on iOS/Safari. */
  unlock(): void {
    const ctx = this.getContext();
    if (ctx.state === 'suspended') {
      void ctx.resume().then(() => {
        console.log('[SoundBank] context resumed:', ctx.state);
      });
    }
    // Play a silent buffer to fully prime the context on iOS
    const buffer = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    src.start(0);
    this.unlocked = true;
    console.log('[SoundBank] unlocked, state=', ctx.state);
  }

  /**
   * Preload a sampled clip. Defaults to `/assets/audio/{id}.ogg`; pass an explicit `url`
   * for clips that live elsewhere or use a different format (e.g. the First Touch sfx in
   * `/assets/audio/sfx/*.m4a`). Either way play(id) routes through the global mute gate.
   */
  preload(id: string, url?: string): void {
    if (this.entries.has(id)) return;
    const entry: Entry = { status: 'pending' };
    this.entries.set(id, entry);

    const audio = new Audio(url ?? `/assets/audio/${id}.ogg`);
    audio.preload = 'auto';
    audio.addEventListener(
      'canplaythrough',
      () => {
        entry.status = 'ready';
        entry.audio = audio;
      },
      { once: true },
    );
    audio.addEventListener(
      'error',
      () => {
        entry.status = 'missing';
      },
      { once: true },
    );
    audio.load();
  }

  play(id: string): void {
    const muted = SettingsManager.get().muted;
    console.log('[SoundBank] play', id, 'muted=', muted, 'unlocked=', this.unlocked);
    if (muted) return;

    const entry = this.entries.get(id);
    if (entry?.status === 'ready' && entry.audio) {
      const clone = entry.audio.cloneNode(true) as HTMLAudioElement;
      clone.volume = 0.75;
      this.activeClones.add(clone);
      clone.addEventListener('ended', () => this.activeClones.delete(clone), { once: true });
      clone.play().catch(() => {
        this.activeClones.delete(clone);
        this.playSynth(id);
      });
      return;
    }
    this.playSynth(id);
  }

  /** Stop any in-flight sampled clips (e.g. lullaby) so audio never leaks across a scene exit. */
  stopAll(): void {
    for (const clone of this.activeClones) {
      try {
        clone.pause();
        clone.currentTime = 0;
      } catch {
        /* ignore */
      }
    }
    this.activeClones.clear();
  }

  private getContext(): AudioContext {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  getState(): string {
    return this.ctx?.state ?? 'not-created';
  }

  private playSynth(id: string): void {
    const ctx = this.getContext();
    switch (id) {
      case 'chelsea-heartbeat':
        this.synthHeartbeat(ctx);
        return;
      case 'dad-voice':
        this.synthDadVoice(ctx);
        return;
      case 'dog-bark':
        this.synthDogBark(ctx);
        return;
      case 'success-chime':
        this.synthChime(ctx);
        return;
      case 'soft-fail':
        this.synthSoftFail(ctx);
        return;
      default:
        this.synthTone(ctx, 440, 0.25);
    }
  }

  private synthHeartbeat(ctx: AudioContext): void {
    const now = ctx.currentTime;
    for (let beat = 0; beat < 2; beat++) {
      const t = now + beat * 0.22;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(85, t);
      osc.frequency.exponentialRampToValueAtTime(45, t + 0.18);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.6, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.22);
    }
  }

  private synthDadVoice(ctx: AudioContext): void {
    // Warm "hey buddy" style hum
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.linearRampToValueAtTime(130, now + 0.4);
    osc.frequency.linearRampToValueAtTime(190, now + 0.65);
    osc.frequency.linearRampToValueAtTime(150, now + 0.85);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.4, now + 0.08);
    gain.gain.linearRampToValueAtTime(0.3, now + 0.7);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.95);

    // Slight harmonic
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(80, now);
    osc2.frequency.linearRampToValueAtTime(75, now + 0.85);
    const gain2 = ctx.createGain();
    gain2.gain.setValueAtTime(0.0001, now);
    gain2.gain.exponentialRampToValueAtTime(0.2, now + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.95);

    osc.connect(gain).connect(ctx.destination);
    osc2.connect(gain2).connect(ctx.destination);
    osc.start(now);
    osc2.start(now);
    osc.stop(now + 1);
    osc2.stop(now + 1);
  }

  private synthDogBark(ctx: AudioContext): void {
    const now = ctx.currentTime;
    for (let i = 0; i < 2; i++) {
      const t = now + i * 0.22;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(420, t);
      osc.frequency.exponentialRampToValueAtTime(180, t + 0.14);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.18);
    }
  }

  private synthChime(ctx: AudioContext): void {
    const now = ctx.currentTime;
    [880, 1320].forEach((freq, i) => {
      const t = now + i * 0.08;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.5);
    });
  }

  private synthSoftFail(ctx: AudioContext): void {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(330, now);
    osc.frequency.linearRampToValueAtTime(220, now + 0.25);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.32);
  }

  private synthTone(ctx: AudioContext, freq: number, duration: number): void {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.3, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(now + duration);
  }
}

export const SoundBank = new SoundBankImpl();
