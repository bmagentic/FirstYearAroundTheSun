import posthog from 'posthog-js';
import { DevMode } from './DevMode';

const KEY = import.meta.env.VITE_POSTHOG_KEY;
const HOST = import.meta.env.VITE_POSTHOG_HOST ?? 'https://us.i.posthog.com';

let initialized = false;

export function initAnalytics(): void {
  if (initialized) return;
  if (!KEY) {
    if (import.meta.env.DEV) {
      console.info('[analytics] VITE_POSTHOG_KEY not set, running in no-op mode');
    }
    return;
  }
  posthog.init(KEY, {
    api_host: HOST,
    capture_pageview: true,
    autocapture: false,
    persistence: 'localStorage',
    disable_session_recording: false,
  });
  initialized = true;
}

export function identify(profileName: string): void {
  if (!initialized) return;
  posthog.identify(profileName);
}

export function track(event: string, props?: Record<string, unknown>): void {
  if (DevMode.isEnabled()) return;
  if (!initialized) {
    if (import.meta.env.DEV) {
      console.debug('[analytics:noop]', event, props);
    }
    return;
  }
  posthog.capture(event, props);
}

export function reset(): void {
  if (!initialized) return;
  posthog.reset();
}
