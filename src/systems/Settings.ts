import type { Settings } from '../types';

const KEY = 'caius-game-settings';

const DEFAULT: Settings = { muted: true };

class SettingsManagerImpl {
  private state: Settings = { ...DEFAULT };

  load(): Settings {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) this.state = { ...DEFAULT, ...(JSON.parse(raw) as Partial<Settings>) };
    } catch {
      this.state = { ...DEFAULT };
    }
    // Sound always starts OFF each session — the title screen promises "Sound starts off.
    // Unmute anytime." So we never restore an "unmuted" preference across a restart; the
    // mute toggle controls the current session only. Guarantees a silent fresh start.
    this.state.muted = true;
    return this.state;
  }

  get(): Settings {
    return this.state;
  }

  setMuted(muted: boolean): void {
    this.state.muted = muted;
    localStorage.setItem(KEY, JSON.stringify(this.state));
  }
}

export const SettingsManager = new SettingsManagerImpl();
