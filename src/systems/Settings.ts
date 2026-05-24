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
