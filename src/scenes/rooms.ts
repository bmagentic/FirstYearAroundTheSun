import type { RoomId, SaveProfile } from '../types';
import { DevMode } from '../systems/DevMode';

export type Side = 'top' | 'bottom' | 'left' | 'right';

export type Doorway = {
  side: Side;
  /** Fractional position along the side, 0..1. */
  position: number;
  to: RoomId;
  locked?: (profile: SaveProfile) => boolean;
  lockMessage?: string;
};

export type ChapterMarker = {
  chapter: number;
  x: number;
  y: number;
};

export type RoomDef = {
  id: RoomId;
  label: string;
  floorColor: number;
  wallColor: number;
  accentColor: number;
  markers: ChapterMarker[];
  doorways: Doorway[];
  encounterChance: number;
};

const FLOOR = {
  warm:  0x6d4c41,
  light: 0xa1887f,
  blue:  0x5c7c9a,
  green: 0x6b8e5a,
  cream: 0xe6d3a3,
  dusty: 0x8b6f5a,
  rocky: 0x8a7e6e,
  lvp:   0xb2a898, // light grey wide-plank LVP (main floor + dining)
};

const WALL = {
  brown: 0x4e342e,
  blue:  0x39556d,
  green: 0x4c6b3e,
  cream: 0xc4a86a,
  dusty: 0x5e4a3a,
  rocky: 0x4e463a,
  white: 0xd8d8d0, // off-white (bathroom)
};

export const ROOMS: Record<RoomId, RoomDef> = {
  // ── Upstairs ─────────────────────────────────────────────────────────────
  nursery: {
    id: 'nursery',
    label: 'Nursery',
    floorColor: FLOOR.cream,
    wallColor: WALL.cream,
    accentColor: 0xf6c87d,
    markers: [
      { chapter: 1, x: 0.30, y: 0.30 },
      { chapter: 2, x: 0.70, y: 0.30 },
      { chapter: 3, x: 0.30, y: 0.65 },
      { chapter: 4, x: 0.70, y: 0.65 },
      { chapter: 8, x: 0.50, y: 0.45 },
    ],
    doorways: [{ side: 'bottom', position: 0.5, to: 'hallway-upper' }],
    encounterChance: 0,
  },

  'master-bedroom': {
    id: 'master-bedroom',
    label: 'Master Bedroom',
    floorColor: FLOOR.blue,
    wallColor: WALL.blue,
    accentColor: 0x9ec3e6,
    markers: [{ chapter: 5, x: 0.50, y: 0.45 }],
    doorways: [{ side: 'bottom', position: 0.5, to: 'hallway-upper' }],
    encounterChance: 0,
  },

  bathroom: {
    id: 'bathroom',
    label: 'Bathroom',
    floorColor: FLOOR.lvp,
    wallColor: WALL.white,
    accentColor: 0x9ec3d8,
    markers: [],
    doorways: [{ side: 'left', position: 0.5, to: 'hallway-upper' }],
    encounterChance: 0,
  },

  'hallway-upper': {
    id: 'hallway-upper',
    label: 'Hallway',
    floorColor: FLOOR.warm,
    wallColor: WALL.brown,
    accentColor: 0xd6b88a,
    markers: [],
    doorways: [
      { side: 'top',    position: 0.25, to: 'nursery' },
      { side: 'top',    position: 0.75, to: 'master-bedroom' },
      { side: 'right',  position: 0.5,  to: 'bathroom' },
      { side: 'bottom', position: 0.5,  to: 'hallway-lower' },
    ],
    encounterChance: 0.08,
  },

  // ── Stairs / transition ───────────────────────────────────────────────────
  'hallway-lower': {
    id: 'hallway-lower',
    label: 'Hallway',
    floorColor: FLOOR.warm,
    wallColor: WALL.brown,
    accentColor: 0xd6b88a,
    markers: [],
    doorways: [
      { side: 'top',    position: 0.5,  to: 'hallway-upper' },
      { side: 'bottom', position: 0.25, to: 'kitchen' },
      { side: 'bottom', position: 0.75, to: 'living-room' },
    ],
    encounterChance: 0.08,
  },

  // ── Main floor ────────────────────────────────────────────────────────────
  kitchen: {
    id: 'kitchen',
    label: 'Kitchen',
    floorColor: FLOOR.light,
    wallColor: WALL.cream,
    accentColor: 0xfff3c4,
    markers: [],
    doorways: [
      { side: 'top',    position: 0.5, to: 'hallway-lower' },
      { side: 'left',   position: 0.5, to: 'dining' },
      { side: 'right',  position: 0.5, to: 'living-room' },
      { side: 'bottom', position: 0.5, to: 'play-area' },
    ],
    encounterChance: 0,
  },

  dining: {
    id: 'dining',
    label: 'Dining Room',
    floorColor: FLOOR.lvp,
    wallColor: WALL.cream,
    accentColor: 0xd4b87a,
    markers: [{ chapter: 7, x: 0.50, y: 0.75 }],
    doorways: [{ side: 'right', position: 0.5, to: 'kitchen' }],
    encounterChance: 0,
  },

  'living-room': {
    id: 'living-room',
    label: 'Living Room',
    floorColor: FLOOR.dusty,
    wallColor: WALL.dusty,
    accentColor: 0xf7e3c0,
    markers: [
      { chapter: 6,  x: 0.28, y: 0.35 },
      { chapter: 9,  x: 0.72, y: 0.35 },
      { chapter: 11, x: 0.80, y: 0.55 },
    ],
    doorways: [
      { side: 'top',  position: 0.5, to: 'hallway-lower' },
      { side: 'left', position: 0.5, to: 'kitchen' },
      {
        side: 'right',
        position: 0.5,
        to: 'garage',
        locked: (p) => !DevMode.isEnabled() && !p.completedChapters.includes(11),
        lockMessage: 'The garage door is closed.',
      },
    ],
    encounterChance: 0,
  },

  garage: {
    id: 'garage',
    label: 'Garage',
    floorColor: FLOOR.rocky,
    wallColor: WALL.rocky,
    accentColor: 0xcccccc,
    markers: [{ chapter: 12, x: 0.5, y: 0.5 }],
    doorways: [{ side: 'left', position: 0.5, to: 'living-room' }],
    encounterChance: 0,
  },

  'play-area': {
    id: 'play-area',
    label: 'Play Area',
    floorColor: FLOOR.green,
    wallColor: WALL.green,
    accentColor: 0xfff3a8,
    markers: [{ chapter: 10, x: 0.5, y: 0.5 }],
    doorways: [{ side: 'top', position: 0.5, to: 'kitchen' }],
    encounterChance: 0,
  },
};

export function oppositeSide(side: Side): Side {
  return { top: 'bottom', bottom: 'top', left: 'right', right: 'left' }[side] as Side;
}
