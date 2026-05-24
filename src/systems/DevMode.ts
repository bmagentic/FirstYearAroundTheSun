const KEY = 'caius-dev-mode';

type Listener = (enabled: boolean) => void;

class DevModeImpl {
  private enabled = false;
  private listeners: Listener[] = [];
  private loaded = false;

  load(): void {
    if (this.loaded) return;
    try {
      this.enabled = localStorage.getItem(KEY) === 'true';
    } catch {
      this.enabled = false;
    }
    this.loaded = true;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  toggle(): boolean {
    this.enabled = !this.enabled;
    try {
      localStorage.setItem(KEY, String(this.enabled));
    } catch {
      /* ignore */
    }
    this.listeners.forEach((l) => l(this.enabled));
    return this.enabled;
  }

  onChange(l: Listener): () => void {
    this.listeners.push(l);
    return () => {
      this.listeners = this.listeners.filter((x) => x !== l);
    };
  }
}

export const DevMode = new DevModeImpl();
