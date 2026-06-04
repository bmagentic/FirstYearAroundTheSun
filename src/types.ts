export type RoomId =
  | 'nursery'
  | 'master-bedroom'
  | 'hallway-upper'
  | 'hallway-lower'
  | 'kitchen'
  | 'living-room'
  | 'dining'
  | 'bathroom'
  | 'garage'
  | 'play-area';

export type InterludeId = 'first-days' | 'mama';

export type EncounterId =
  | 'snot-sucker'
  | 'face-wash'
  | 'bottle-wait'
  | 'changing-table'
  | 'roomba';

export type Nickname =
  | 'bubbaman'
  | 'pumpkin-head'
  | 'bing-bot'
  | 'caius-mcbuttersworth'
  | 'super-baby';

export type SaveProfile = {
  id: string;
  name: string;
  createdAt: number;
  lastPlayedAt: number;
  completedChapters: number[];
  completedInterludes: InterludeId[];
  completedEncounters: EncounterId[];
  nicknamesCollected: Nickname[];
  brutusUnlocked: boolean;
  brutusActive: boolean;
  bonusChapterUnlocked: boolean;
  bonusChapterCompleted: boolean;
  currentRoom: RoomId;
  visitedRooms: RoomId[];
  totalPlayTimeSeconds: number;
};

export type GameSaves = {
  profiles: SaveProfile[];
  activeProfileId: string | null;
};

export type MobilityState =
  | 'stationary'
  | 'eyes-only'
  | 'rolling'
  | 'crawling'
  | 'walker'
  | 'cruising'
  | 'walking';

export type Settings = {
  muted: boolean;
};
