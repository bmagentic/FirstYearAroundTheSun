import type { EncounterId, GameSaves, Nickname, RoomId, SaveProfile } from '../types';

const STORAGE_KEY = 'caius-game-saves';
const MAX_PROFILES = 8;

const EMPTY_SAVES: GameSaves = { profiles: [], activeProfileId: null };

function genId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for non-secure contexts (LAN IP over plain HTTP).
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function newProfile(name: string): SaveProfile {
  const now = Date.now();
  return {
    id: genId(),
    name: name.trim().slice(0, 16),
    createdAt: now,
    lastPlayedAt: now,
    completedChapters: [],
    completedInterludes: [],
    completedEncounters: [],
    nicknamesCollected: [],
    brutusUnlocked: false,
    brutusActive: false,
    bonusChapterUnlocked: false,
    bonusChapterCompleted: false,
    currentRoom: 'nursery',
    visitedRooms: ['nursery'],
    totalPlayTimeSeconds: 0,
  };
}

class SaveManagerImpl {
  private state: GameSaves = EMPTY_SAVES;
  private sessionStart = Date.now();

  load(): GameSaves {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        this.state = { ...EMPTY_SAVES };
        return this.state;
      }
      const parsed = JSON.parse(raw) as GameSaves;
      this.state = {
        profiles: Array.isArray(parsed.profiles) ? parsed.profiles : [],
        activeProfileId: parsed.activeProfileId ?? null,
      };
    } catch {
      this.state = { ...EMPTY_SAVES };
    }
    return this.state;
  }

  private persist(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
  }

  getAllProfiles(): SaveProfile[] {
    return [...this.state.profiles].sort((a, b) => b.lastPlayedAt - a.lastPlayedAt);
  }

  getActiveProfile(): SaveProfile | null {
    if (!this.state.activeProfileId) return null;
    return this.state.profiles.find((p) => p.id === this.state.activeProfileId) ?? null;
  }

  canCreateProfile(): boolean {
    return this.state.profiles.length < MAX_PROFILES;
  }

  createProfile(name: string): SaveProfile {
    if (!this.canCreateProfile()) {
      throw new Error('Profile limit reached');
    }
    const profile = newProfile(name);
    this.state.profiles.push(profile);
    this.state.activeProfileId = profile.id;
    this.sessionStart = Date.now();
    this.persist();
    return profile;
  }

  selectProfile(id: string): SaveProfile | null {
    const profile = this.state.profiles.find((p) => p.id === id);
    if (!profile) return null;
    this.state.activeProfileId = id;
    profile.lastPlayedAt = Date.now();
    this.sessionStart = Date.now();
    this.persist();
    return profile;
  }

  deleteProfile(id: string): void {
    this.state.profiles = this.state.profiles.filter((p) => p.id !== id);
    if (this.state.activeProfileId === id) {
      this.state.activeProfileId = null;
    }
    this.persist();
  }

  update(mutator: (profile: SaveProfile) => void): SaveProfile | null {
    const profile = this.getActiveProfile();
    if (!profile) return null;
    mutator(profile);
    profile.lastPlayedAt = Date.now();
    this.persist();
    return profile;
  }

  markChapterComplete(chapterId: number): void {
    this.update((p) => {
      if (!p.completedChapters.includes(chapterId)) {
        p.completedChapters.push(chapterId);
        p.completedChapters.sort((a, b) => a - b);
      }
    });
  }

  markInterludeComplete(interludeId: 'first-days' | 'mama'): void {
    this.update((p) => {
      if (!p.completedInterludes.includes(interludeId)) {
        p.completedInterludes.push(interludeId);
      }
    });
  }

  setCurrentRoom(room: RoomId): void {
    this.update((p) => {
      p.currentRoom = room;
      if (!p.visitedRooms) p.visitedRooms = [];
      if (!p.visitedRooms.includes(room)) p.visitedRooms.push(room);
    });
  }

  collectNickname(nickname: Nickname): boolean {
    let isNew = false;
    this.update((p) => {
      if (!p.nicknamesCollected.includes(nickname)) {
        p.nicknamesCollected.push(nickname);
        isNew = true;
        if (p.nicknamesCollected.length >= 5) {
          p.bonusChapterUnlocked = true;
        }
      }
    });
    return isNew;
  }

  unlockBrutus(): void {
    this.update((p) => {
      p.brutusUnlocked = true;
    });
  }

  markBonusComplete(): void {
    this.update((p) => {
      p.bonusChapterCompleted = true;
      p.brutusUnlocked = true;
    });
  }

  markEncounterComplete(id: EncounterId): { firstClear: boolean; allFive: boolean } {
    let firstClear = false;
    let allFive = false;
    this.update((p) => {
      if (!p.completedEncounters.includes(id)) {
        p.completedEncounters.push(id);
        firstClear = true;
      }
      allFive = p.completedEncounters.length >= 5;
    });
    return { firstClear, allFive };
  }

  flushSessionTime(): void {
    const elapsed = Math.floor((Date.now() - this.sessionStart) / 1000);
    if (elapsed <= 0) return;
    this.sessionStart = Date.now();
    this.update((p) => {
      p.totalPlayTimeSeconds += elapsed;
    });
  }
}

export const SaveManager = new SaveManagerImpl();
