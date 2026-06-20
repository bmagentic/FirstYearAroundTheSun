import type { MobilityState, SaveProfile } from '../types';
import { DevMode } from './DevMode';

const MOBILITY_BY_CHAPTER: Array<{ chapter: number; state: MobilityState }> = [
  { chapter: 11, state: 'walking' },
  { chapter: 9, state: 'walker' },
  { chapter: 5, state: 'crawling' },
  { chapter: 4, state: 'rolling' },
  { chapter: 3, state: 'eyes-only' },
];

export function deriveMobility(profile: SaveProfile): MobilityState {
  if (DevMode.isEnabled()) return 'walking';
  const completed = new Set(profile.completedChapters);
  for (const { chapter, state } of MOBILITY_BY_CHAPTER) {
    if (completed.has(chapter)) return state;
  }
  return 'stationary';
}

// All non-zero speeds bumped +15% (2026-06-20 — movement felt too slow).
// Values in px/s; relative progression (rolling < crawling < walker < walking) preserved.
export function speedFor(state: MobilityState): number {
  switch (state) {
    case 'stationary':
    case 'eyes-only':
      return 0;
    case 'rolling':
      return 69;
    case 'crawling':
      return 115;
    case 'walker':
      return 161;
    case 'cruising':
      return 92;
    case 'walking':
      return 184;
  }
}

export function garageUnlocked(profile: SaveProfile): boolean {
  if (DevMode.isEnabled()) return true;
  return profile.completedChapters.includes(11);
}

export function bonusChapterReady(profile: SaveProfile): boolean {
  if (DevMode.isEnabled()) return !profile.bonusChapterCompleted;
  return profile.bonusChapterUnlocked && !profile.bonusChapterCompleted;
}
