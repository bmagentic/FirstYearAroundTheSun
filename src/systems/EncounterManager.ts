import type { EncounterId, SaveProfile } from '../types';
import { DevMode } from './DevMode';

const ALL_ENCOUNTERS: EncounterId[] = [
  'snot-sucker',
  'face-wash',
  'bottle-wait',
  'changing-table',
  'roomba',
];

const ENCOUNTER_SCENES: Record<EncounterId, string> = {
  'snot-sucker': 'SnotSucker',
  'face-wash': 'FaceWash',
  'bottle-wait': 'BottleWait',
  'changing-table': 'ChangingTable',
  roomba: 'Roomba',
};

const GLOBAL_COOLDOWN_MS = 60_000;
const ROLL_INTERVAL_MS = 3_000;
const FIRST_ROLL_DELAY_MS = 2_500;
const MAX_CHANCE = 0.10;

/**
 * Wild encounter manager.
 *
 * Per build-notes §12: chance ramps 3% → 10% in hallway/backyard tiles, with
 * a 60-second global cooldown after any encounter clears.
 *
 * - Rolls every ROLL_INTERVAL_MS while in an eligible room
 * - Uses room.encounterChance as the per-roll probability (clamped to 10%)
 * - Skips when on cooldown, when no uncompleted encounters remain, or in dev mode
 */
export class EncounterManager {
  private nextRollAt = Number.POSITIVE_INFINITY;
  private cooldownUntil = 0;
  private armed = false;

  /** Call when player enters a new room. */
  onEnterRoom(roomEncounterChance: number, now: number): void {
    if (roomEncounterChance > 0) {
      this.armed = true;
      this.nextRollAt = Math.max(now + FIRST_ROLL_DELAY_MS, this.cooldownUntil);
    } else {
      this.armed = false;
      this.nextRollAt = Number.POSITIVE_INFINITY;
    }
  }

  /** Call after the player returns from a completed encounter. */
  onEncounterCleared(now: number): void {
    this.cooldownUntil = now + GLOBAL_COOLDOWN_MS;
    this.armed = false;
    this.nextRollAt = Number.POSITIVE_INFINITY;
  }

  /** Returns the scene key of the encounter to launch, or null. */
  tick(profile: SaveProfile, roomEncounterChance: number, now: number): string | null {
    if (DevMode.isEnabled()) return null;
    if (!this.armed) return null;
    if (now < this.cooldownUntil) return null;
    if (now < this.nextRollAt) return null;

    const available = ALL_ENCOUNTERS.filter((id) => !profile.completedEncounters.includes(id));
    if (available.length === 0) {
      this.armed = false;
      return null;
    }

    const chance = Math.min(MAX_CHANCE, roomEncounterChance);
    if (Math.random() < chance) {
      // Disarm until next room change to prevent repeat rolls during fade
      this.armed = false;
      const choice = available[Math.floor(Math.random() * available.length)]!;
      return ENCOUNTER_SCENES[choice];
    }
    this.nextRollAt = now + ROLL_INTERVAL_MS;
    return null;
  }
}
