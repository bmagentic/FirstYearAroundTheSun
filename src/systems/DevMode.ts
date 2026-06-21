const KEY = 'caius-dev-mode';

/**
 * DevMode is fully INERT in production builds. In the deployed/`npm run build`
 * bundle (import.meta.env.PROD === true) the trigger does nothing, the badge is
 * never installed (see main.ts), and any stale `caius-dev-mode: true` left in a
 * guest's localStorage is ignored — so a party guest can't accidentally unlock
 * progression or suppress their analytics. In local dev it works as normal.
 */
const PROD = import.meta.env.PROD;

type Listener = (enabled: boolean) => void;

class DevModeImpl {
  private enabled = false;
  private listeners: Listener[] = [];
  private loaded = false;

  load(): void {
    if (this.loaded) return;
    if (PROD) {
      // Ignore any persisted flag in production; DevMode stays off.
      this.enabled = false;
      this.loaded = true;
      return;
    }
    try {
      this.enabled = localStorage.getItem(KEY) === 'true';
    } catch {
      this.enabled = false;
    }
    this.loaded = true;
  }

  isEnabled(): boolean {
    // Belt-and-suspenders: always false in production regardless of stored state.
    if (PROD) return false;
    return this.enabled;
  }

  toggle(): boolean {
    if (PROD) return false;
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
