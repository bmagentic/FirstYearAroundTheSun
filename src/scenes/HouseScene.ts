import Phaser from 'phaser';
import { ROOMS, oppositeSide } from './rooms';
import type { Doorway, RoomDef, Side } from './rooms';
import { SaveManager } from '../systems/SaveManager';
import { deriveMobility, speedFor, bonusChapterReady } from '../systems/PlayerState';
import { track } from '../systems/Analytics';
import { DevMode } from '../systems/DevMode';
import { TouchControls } from '../ui/TouchControls';
import { freezeScene } from '../ui/sceneFreeze';
import { CHAPTER_SCENES } from './chapters/registry';
import { EncounterManager } from '../systems/EncounterManager';
import { SpriteBank } from '../systems/SpriteBank';
import type { RoomId, SaveProfile } from '../types';

// ── Scale constants ──────────────────────────────────────────────────────────
// Background images are authored at this width/height (topdown_gen.py output).
// ROOM_SCALE = game_room_width / BG_NATIVE_W = 416 / 208 = 2.0 (uniform both axes).
// All room-object display sizes are expressed in game px (native_px × ROOM_SCALE).
const BG_NATIVE_W = 208;
const BG_NATIVE_H = 282;
// Wall border thickness in bg-image px (must match topdown_gen.py WALL constant).
const BG_WALL_PX = 10;

// ── Floor zone ───────────────────────────────────────────────────────────────
type FloorZone = { x: number; y: number; w: number; h: number };

// ── Depth helpers ────────────────────────────────────────────────────────────
// Maps a sprite's foot Y (game px) to a Phaser depth value.
// Keeps all room content between worldLayer (depth 1) and hudLayer (depth 100).
function footDepth(footY: number): number {
  return Phaser.Math.Clamp(2 + (footY / 800) * 47, 2, 49);
}

// ── Nursery layout ───────────────────────────────────────────────────────────
type Rect = { x: number; y: number; w: number; h: number };

type RoomObject = {
  key: string;
  /** Fractional x in floor zone (0 = left wall, 1 = right wall). */
  fx: number;
  /** Fractional y in floor zone (0 = top wall, 1 = bottom wall). */
  fy: number;
  /** Display width in game px (native sprite px × ROOM_SCALE). */
  displayW: number;
  /** Display height in game px. */
  displayH: number;
  /** Wall art renders at back depth and is not depth-sorted with floor objects. */
  wallArt?: boolean;
  /** Override collision footprint width (defaults to displayW). */
  footprintW?: number;
  /** Override collision footprint height (defaults to displayH × 0.30). */
  footprintH?: number;
  /** Multiple footprint rects for complex shapes (e.g. L-shaped sectional).
   *  Each rect is { dx, dy, w, h } relative to the sprite's foot anchor. */
  footprintRects?: Array<{ dx: number; dy: number; w: number; h: number }>;
  /** Only render when this returns true. Always visible in DevMode. */
  conditional?: (profile: SaveProfile) => boolean;
  /** Touching this object launches the given chapter (replaces a marker). */
  chapterTrigger?: number;
  /** Touching this object launches the bonus chapter (when bonusChapterReady). */
  bonusTrigger?: boolean;
};

// Positions are tuned for the nursery's top-down floor plan.
// Objects against the top wall have small fy so they sort behind floor objects.
// Drag in DevMode to tune; dropping prints fx/fy + a full paste-ready array.
const NURSERY_OBJECTS: RoomObject[] = [
  { key: 'obj-nursery-crib',        fx: 0.876, fy: 0.804,  displayW: 120, displayH: 120 },
  { key: 'obj-nursery-dresser',     fx: 0.062, fy: 0.408,  displayW: 86,  displayH: 86  },
  { key: 'obj-nursery-bookshelf',   fx: 0.193, fy: -0.144, displayW: 179, displayH: 179 },
  { key: 'obj-nursery-chair',       fx: 0.936, fy: -0.076, displayW: 79,  displayH: 101 },
  { key: 'obj-nursery-toychest',    fx: 0.091, fy: 0.897,  displayW: 94,  displayH: 70  },
  { key: 'obj-nursery-foxpainting', fx: 0.051, fy: 0.342,  displayW: 48,  displayH: 48,  wallArt: true },
  { key: 'obj-plush-francois',      fx: 0.724, fy: -0.051, displayW: 50,  displayH: 50  },
  { key: 'obj-plush-foxamillion',   fx: 0.587, fy: -0.055, displayW: 50,  displayH: 50  },
  { key: 'obj-plush-deeno',         fx: 0.812, fy: 0.013,  displayW: 50,  displayH: 50  },
  { key: 'obj-plush-persephone',    fx: 0.668, fy: 0.015,  displayW: 50,  displayH: 50  },
  { key: 'obj-plush-moomoo',        fx: 0.434, fy: -0.059, displayW: 50,  displayH: 50  },
  { key: 'obj-plush-ribbie',        fx: 0.501, fy: 0.014,  displayW: 50,  displayH: 50  },
];

// ── Living room layout ──────────────────────────────────────────────────────
const LIVINGROOM_OBJECTS: RoomObject[] = [
  { key: 'obj-livingroom-sectional-west', fx: 0.185, fy: 0.455, displayW: 288, displayH: 173,
    footprintRects: [
      { dx: -144, dy: -173, w: 80, h: 173 },
      { dx: -144, dy: -52,  w: 288, h: 52 },
    ] },
  { key: 'obj-livingroom-sidetable',      fx: 0.611, fy: 0.504, displayW: 106, displayH: 106 },
  { key: 'obj-livingroom-tv',             fx: 0.225, fy: 0.946, displayW: 128, displayH: 64,  wallArt: true },
  { key: 'obj-livingroom-coffeehutch',    fx: 0.915, fy: 0.631, displayW: 153, displayH: 229 },
];

// ── Dining room layout ─────────────────────────────────────────────────────
const DINING_OBJECTS: RoomObject[] = [
  { key: 'obj-dining-table',          fx: 0.450, fy: 0.448, displayW: 256, displayH: 128 },
  { key: 'obj-dining-chair-east',     fx: 0.172, fy: 0.439, displayW: 64,  displayH: 128 },
  { key: 'obj-dining-chair-west',     fx: 0.724, fy: 0.441, displayW: 64,  displayH: 128 },
  { key: 'obj-dining-highchair',      fx: 0.441, fy: 0.355, displayW: 64,  displayH: 128 },
  { key: 'obj-dining-hutch',          fx: 0.091, fy: -0.124, displayW: 77,  displayH: 115 },
  { key: 'obj-dining-basketstand',    fx: 0.898, fy: 0.644, displayW: 64,  displayH: 192 },
  { key: 'obj-dining-familypicture',  fx: 0.275, fy: -0.109, displayW: 90,  displayH: 67,  wallArt: true },
  { key: 'obj-dining-planterwall',    fx: 0.840, fy: -0.118, displayW: 92,  displayH: 92,  wallArt: true },
  { key: 'obj-dining-floorplant',     fx: 0.063, fy: 0.737, displayW: 64,  displayH: 128 },
];

// ── Master bedroom layout ──────────────────────────────────────────────────
// Bed is the M5 centerpiece (crawl stage); Soka's bed-curl sprite goes at ~(0.65, 0.15) later.
const MASTER_OBJECTS: RoomObject[] = [
  { key: 'bed',                       fx: 0.611, fy: -0.092, displayW: 282, displayH: 211 },
  { key: 'obj-master-dresser',        fx: 0.019, fy: 0.310, displayW: 128, displayH: 192 },
  { key: 'obj-master-changingtable',  fx: 0.969, fy: 0.395, displayW: 106, displayH: 141 },
  { key: 'obj-master-floormattress',  fx: 0.163, fy: -0.019, displayW: 171, displayH: 85  },
];

// ── Garage layout ──────────────────────────────────────────────────────────
// SMEG is the reveal centerpiece. Rocket appears only after garage unlocks (Ch11 complete).
const GARAGE_OBJECTS: RoomObject[] = [
  { key: 'obj-garage-smeg',      fx: 0.075, fy: -0.023, displayW: 72,  displayH: 144 },
  { key: 'obj-garage-cabinets',  fx: 0.893, fy: -0.032, displayW: 115, displayH: 173 },
  { key: 'obj-garage-workbench', fx: 0.494, fy: 0.877,  displayW: 192, displayH: 96  },
  { key: 'obj-garage-bike',      fx: 0.922, fy: 0.804,  displayW: 91,  displayH: 122 },
  { key: 'obj-garage-rocket-ready', fx: 0.467, fy: 0.353, displayW: 115, displayH: 154,
    footprintW: 58, footprintH: 48,
    conditional: (p) => p.completedChapters.includes(11),
    chapterTrigger: 12 },
];

// ── Kitchen layout ─────────────────────────────────────────────────────────
const KITCHEN_OBJECTS: RoomObject[] = [
  { key: 'obj-kitchen-fridge',     fx: 0.095, fy: -0.112, displayW: 128, displayH: 192 },
  { key: 'obj-kitchen-range',      fx: 0.827, fy: -0.155, displayW: 96,  displayH: 192 },
  { key: 'obj-kitchen-barstool',   fx: 0.197, fy: 0.800,  displayW: 64,  displayH: 128 },
  { key: 'obj-kitchen-barstool',   fx: 0.064, fy: 0.807,  displayW: 64,  displayH: 128 },
];

// ── Bathroom layout ────────────────────────────────────────────────────────
const BATHROOM_OBJECTS: RoomObject[] = [
  { key: 'obj-bathroom-showercurtain', fx: 0.709, fy: -0.086, displayW: 128, displayH: 192 },
  { key: 'obj-bathroom-rubberduck',    fx: 0.920, fy: 0.053,  displayW: 64,  displayH: 64  },
  { key: 'obj-bathroom-bathproducts',  fx: 0.970, fy: 0.491,  displayW: 64,  displayH: 64  },
];

// ── Play area layout ───────────────────────────────────────────────────────
const PLAYAREA_OBJECTS: RoomObject[] = [
  { key: 'obj-nursery-toychest',    fx: 0.906, fy: -0.023, displayW: 94,  displayH: 70, bonusTrigger: true },
  { key: 'vtech-cube',              fx: 0.729, fy: 0.518,  displayW: 67,  displayH: 67  },
  { key: 'obj-portable-roomba',     fx: 0.067, fy: 0.892,  displayW: 64,  displayH: 64  },
  { key: 'obj-plush-francois',      fx: 0.237, fy: 0.378,  displayW: 60,  displayH: 60  },
  { key: 'obj-plush-foxamillion',   fx: 0.325, fy: 0.270,  displayW: 60,  displayH: 60  },
  { key: 'obj-plush-deeno',         fx: 0.742, fy: 0.317,  displayW: 60,  displayH: 60  },
  { key: 'obj-plush-persephone',    fx: 0.285, fy: 0.557,  displayW: 60,  displayH: 60  },
  { key: 'obj-plush-moomoo',        fx: 0.813, fy: 0.678,  displayW: 60,  displayH: 60  },
  { key: 'obj-plush-ribbie',        fx: 0.201, fy: 0.682,  displayW: 60,  displayH: 60  },
];

// ── Misc constants ────────────────────────────────────────────────────────────
const ROOM_PADDING   = 32;
const DOOR_WIDTH     = 72;
const PLAYER_RADIUS  = 12;
const TRANSITION_MS  = 220;
const TOAST_MS       = 1600;
// Newborn sequence: establishing hold, then the attention pull toward the marker.
const NEWBORN_BEAT_MS = 1500;
const NEWBORN_PULL_MS = 550;

export class HouseScene extends Phaser.Scene {
  private profile!: SaveProfile;
  private currentRoom!: RoomDef;
  private currentFloorZone!: FloorZone;
  private bgLayer!: Phaser.GameObjects.Container;
  private worldLayer!: Phaser.GameObjects.Container;
  private hudLayer!: Phaser.GameObjects.Container;
  private player!: Phaser.GameObjects.Container;
  private playerBody: Phaser.GameObjects.Arc | null = null;
  /** Caius's crawl sprite (early-mobility overworld); animated while moving. */
  private playerSprite: Phaser.GameObjects.Sprite | null = null;
  private controls!: TouchControls;
  private roomLabel!: Phaser.GameObjects.Text;
  private transitioning = false;
  private markers: Array<{ chapter: number; x: number; y: number }> = [];
  private toastText: Phaser.GameObjects.Text | null = null;
  private devModeUnsub: (() => void) | null = null;
  private encounters = new EncounterManager();
  private fromEncounter = false;
  /** Scene-level sprites placed for depth sorting; cleared on every room change. */
  private roomSprites: Phaser.GameObjects.Image[] = [];
  /** Walkable extensions through wall insets toward each doorway, paired with doorway index. */
  private doorNotches: Array<{ rect: Rect; doorIdx: number }> = [];
  /** Collision footprints at the base of floor objects; blocks player movement. */
  private footprints: Rect[] = [];
  /** Footprint key names for debug logging. */
  private footprintKeys: string[] = [];
  /** DevMode debug overlay container. */
  private debugLayer: Phaser.GameObjects.Container | null = null;
  /** Throttle debug rejection logs (ms). */
  private lastRejectLog = 0;
  /** Per-door arm state (indexed to currentRoom.doorways). Each door re-arms only
   *  once the player leaves *that* door's trigger zone — so two doors on the same
   *  wall can't disarm or re-trigger each other. */
  private doorArmed: boolean[] = [];
  /** Markers disarmed until player exits all marker/trigger radii after spawn. */
  private markersArmed = true;
  /** True during the newborn-sequence establishing beat; freezes update() until launch. */
  private newbornBeat = false;
  /** DevMode only: live fx/fy per object index in the room array, updated on every drop. */
  private devDragPositions = new Map<number, { fx: number; fy: number }>();
  /** Objects that launch a chapter when touched (replaces numbered markers). */
  private chapterTriggerObjects: Array<{ chapter: number; x: number; y: number; radius: number }> = [];
  /** Bonus chapter trigger (toy chest with cape). */
  private bonusTriggerObject: { x: number; y: number; radius: number } | null = null;
  /** True after the cape reveal animation has played; prevents re-triggering chest tap. */
  private bonusRevealed = false;
  /** False until cape landing animation completes AND player exits the cape's radius. */
  private bonusLaunchArmed = false;

  constructor() {
    super({ key: 'HouseScene' });
  }

  init(data: { profile?: SaveProfile; fromEncounter?: boolean }): void {
    const profile = data.profile ?? SaveManager.getActiveProfile();
    if (!profile) throw new Error('HouseScene started without an active profile');
    this.profile = profile;
    this.fromEncounter = !!data.fromEncounter;
  }

  preload(): void {
    SpriteBank.preloadInto(this, [
      // Player
      'caius',
      'caius-crawl-l',
      'caius-crawl-r',
      // All room backgrounds (top-down, 208×282)
      'room-nursery-bg',
      'room-master-bedroom-bg',
      'room-hallway-upper-bg',
      'room-hallway-lower-bg',
      'room-kitchen-bg',
      'room-living-room-bg',
      'room-garage-bg',
      'room-play-area-bg',
      'room-dining-bg',
      'room-bathroom-bg',
      // Living room object sprites
      'obj-livingroom-sectional-west',
      'obj-livingroom-sidetable',
      'obj-livingroom-tv',
      'obj-livingroom-coffeehutch',
      // Dining room object sprites
      'obj-dining-table',
      'obj-dining-chair-east',
      'obj-dining-chair-west',
      'obj-dining-highchair',
      'obj-dining-hutch',
      'obj-dining-basketstand',
      'obj-dining-familylamp',
      'obj-dining-familypicture',
      'obj-dining-floorplant',
      'obj-dining-planterwall',
      'obj-dining-wineglassrack',
      // Master bedroom object sprites
      'bed',
      'obj-master-dresser',
      'obj-master-changingtable',
      'obj-master-floormattress',
      // Garage object sprites
      'obj-garage-smeg',
      'obj-garage-cabinets',
      'obj-garage-workbench',
      'obj-garage-bike',
      'obj-garage-rocket-ready',
      // Kitchen object sprites
      'obj-kitchen-fridge',
      'obj-kitchen-range',
      'obj-kitchen-barstool',
      'obj-kitchen-chandelier',
      // Bathroom object sprites
      'obj-bathroom-showercurtain',
      'obj-bathroom-bathproducts',
      'obj-bathroom-rubberduck',
      'obj-bathroom-tubwater',
      // Play-area object sprites
      'vtech-cube',
      'obj-portable-roomba',
      // Nursery object sprites (reference room)
      'obj-nursery-crib',
      'obj-nursery-dresser',
      'obj-nursery-bookshelf',
      'obj-nursery-chair',
      'obj-nursery-foxpainting',
      'obj-nursery-toychest',
      // Plushies (nursery cluster)
      'obj-plush-francois',
      'obj-plush-foxamillion',
      'obj-plush-deeno',
      'obj-plush-persephone',
      'obj-plush-moomoo',
      'obj-plush-ribbie',
      // Bonus chest reveal cape
      'obj-cape-red',
    ]);
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#0a0a1f');
    // Reset any zoom/scroll left over from a prior newborn-sequence attention pull.
    this.cameras.main.setZoom(1).setScroll(0, 0);
    this.cameras.main.fadeIn(180, 0, 0, 0);

    this.bgLayer    = this.add.container(0, 0).setDepth(0);
    this.worldLayer = this.add.container(0, 0).setDepth(1);
    this.hudLayer   = this.add.container(0, 0).setDepth(100);

    // 2-frame crawl cycle (alternating hands). The overworld Caius crawls in the
    // early-mobility phase rather than sliding a static sprite.
    if (
      this.textures.exists('caius-crawl-l') &&
      this.textures.exists('caius-crawl-r') &&
      !this.anims.exists('caius-crawl')
    ) {
      this.anims.create({
        key: 'caius-crawl',
        frames: [{ key: 'caius-crawl-l' }, { key: 'caius-crawl-r' }],
        frameRate: 5, // slow — "but slowly at first"
        repeat: -1,
      });
    }

    this.player = this.add.container(0, 0);
    this.playerSprite = null;
    if (this.textures.exists('caius-crawl-l')) {
      this.playerSprite = this.add.sprite(0, 0, 'caius-crawl-l').setDisplaySize(64, 64);
      this.player.add(this.playerSprite);
    } else if (SpriteBank.has(this, 'caius')) {
      const sprite = this.add.image(0, 0, 'caius').setDisplaySize(64, 64);
      this.player.add(sprite);
    } else {
      this.playerBody = this.add.circle(0, 0, PLAYER_RADIUS, 0xf7c6a3).setStrokeStyle(2, 0x402c1d);
      const cheekL   = this.add.circle(-4, 2, 2, 0xe89a8a);
      const cheekR   = this.add.circle(4,  2, 2, 0xe89a8a);
      this.player.add([this.playerBody, cheekL, cheekR]);
    }

    this.roomLabel = this.add
      .text(this.scale.width / 2, 18, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '16px',
        color: '#fde68a',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0)
      .setDepth(101);
    this.hudLayer.add(this.roomLabel);

    this.controls = new TouchControls(this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);

    this.devModeUnsub = DevMode.onChange(() => {
      if (this.currentRoom) this.enterRoom(this.currentRoom.id, { firstLoad: true });
    });

    if (this.fromEncounter) this.encounters.onEncounterCleared(performance.now());

    this.enterRoom(this.profile.currentRoom, { firstLoad: true });
  }

  override update(_time: number, delta: number): void {
    if (this.transitioning || this.newbornBeat) return;

    const mobility = deriveMobility(this.profile);
    const speed    = speedFor(mobility);
    const v        = this.controls.getVector();
    if (speed > 0) {
      const dt = delta / 1000;
      const nx = this.player.x + v.x * speed * dt;
      const ny = this.player.y + v.y * speed * dt;

      if (this.isWalkable(nx, ny)) {
        this.player.setPosition(nx, ny);
      } else if (this.isWalkable(nx, this.player.y)) {
        this.player.setPosition(nx, this.player.y);
      } else if (this.isWalkable(this.player.x, ny)) {
        this.player.setPosition(this.player.x, ny);
      } else if (DevMode.isEnabled()) {
        this.logWalkRejection(this.player.x, this.player.y, nx, ny);
      }
    }

    // Crawl animation: play while actually moving, freeze on a frame when idle.
    if (this.playerSprite && this.anims.exists('caius-crawl')) {
      const moving = speed > 0 && (v.x !== 0 || v.y !== 0);
      if (moving) {
        if (!this.playerSprite.anims.isPlaying) this.playerSprite.play('caius-crawl');
        if (v.x !== 0) this.playerSprite.setFlipX(v.x < 0);
      } else if (this.playerSprite.anims.isPlaying) {
        this.playerSprite.anims.stop();
        this.playerSprite.setTexture('caius-crawl-l');
      }
    }

    this.player.setDepth(footDepth(this.player.y));

    this.checkMarkerProximity();
    this.checkDoorways();
    this.maybeTriggerEncounter();
  }

  // ── Room entry ──────────────────────────────────────────────────────────────

  private enterRoom(roomId: RoomId, opts: { fromSide?: Side; fromRoom?: RoomId; firstLoad?: boolean }): void {
    const def = ROOMS[roomId];
    this.currentRoom = def;

    SaveManager.setCurrentRoom(roomId);
    const fresh = SaveManager.getActiveProfile();
    if (fresh) this.profile = fresh;

    // Clear previous room
    this.bgLayer.removeAll(true);
    this.worldLayer.removeAll(true);
    for (const s of this.roomSprites) s.destroy();
    this.roomSprites  = [];
    this.markers      = [];
    this.chapterTriggerObjects = [];
    this.bonusTriggerObject = null;
    this.doorNotches  = [];
    this.footprints   = [];
    this.footprintKeys = [];
    if (this.debugLayer) { this.debugLayer.destroy(); this.debugLayer = null; }

    this.drawRoom(def);
    this.currentFloorZone = this.computeFloorZone(def);
    this.doorNotches      = this.computeDoorNotches(def);
    this.footprints       = [];
    this.footprintKeys    = [];
    this.placeRoomObjects(def);
    this.clipFootprintsAroundDoors();
    this.drawDebugOverlays();
    this.drawMarkers(def);
    this.roomLabel.setText(def.label);

    const fz = this.currentFloorZone;
    let px   = fz.x + fz.w / 2;
    let py   = fz.y + fz.h / 2;
    if (opts.fromRoom || opts.fromSide) {
      // Match the specific doorway we came through by destination room id. Side is
      // only a fallback — it's ambiguous when a wall has two doors (hallway-lower).
      const entry =
        (opts.fromRoom != null ? def.doorways.find((d) => d.to === opts.fromRoom) : undefined) ??
        (opts.fromSide != null ? def.doorways.find((d) => d.side === opts.fromSide) : undefined);
      if (entry) {
        const pos  = this.doorwayCenter(entry);
        const clearance = DOOR_WIDTH / 2 + PLAYER_RADIUS + 12;
        px = pos.x + (entry.side === 'left' ? clearance : entry.side === 'right' ? -clearance : 0);
        py = pos.y + (entry.side === 'top'  ? clearance : entry.side === 'bottom' ? -clearance : 0);
      }
    }
    const r = PLAYER_RADIUS;
    px = Phaser.Math.Clamp(px, fz.x + r, fz.x + fz.w - r);
    py = Phaser.Math.Clamp(py, fz.y + r, fz.y + fz.h - r);
    this.player.setPosition(px, py);
    this.player.setDepth(footDepth(py));

    this.doorArmed = def.doorways.map(() => false);
    this.markersArmed = false;
    this.encounters.onEnterRoom(def.encounterChance, performance.now());
    if (!opts.firstLoad) this.cameras.main.fadeIn(TRANSITION_MS, 0, 0, 0);
    this.transitioning = false;

    this.maybeRunNewbornSequence();
  }

  // ── Newborn sequence (immobile auto-launch) ──────────────────────────────────
  //
  // Until rolling unlocks (Ch4 complete → speed > 0) the player can't move, so the
  // pre-mobility chapters can't be walked to. Instead, on each entry to a room with
  // an incomplete chapter marker we hold a short establishing beat, pull attention to
  // the marker, and auto-launch it. The IntroPanel still gates each one (tap Start),
  // which is the player's agency during the immobile stretch. DevMode (always walking)
  // is exempt.

  private maybeRunNewbornSequence(): void {
    if (DevMode.isEnabled()) return;
    const speed = speedFor(deriveMobility(this.profile));

    if (speed > 0) {
      // Mobility just unlocked (rolling from Ch4). Show the one-time full-screen hint.
      if (this.profile.completedChapters.includes(4) && !this.profile.movementHintShown) {
        this.showMobilityOverlay();
        const updated = SaveManager.markMovementHintShown();
        if (updated) this.profile = updated;
      }
      return;
    }

    // Immobile: auto-launch the lowest incomplete launchable chapter marked here.
    const next = this.markers
      .filter((m) => CHAPTER_SCENES[m.chapter] && !this.profile.completedChapters.includes(m.chapter))
      .sort((a, b) => a.chapter - b.chapter)[0];
    if (!next) return;

    this.beatThenAutoLaunch(next);
  }

  private beatThenAutoLaunch(marker: { chapter: number; x: number; y: number }): void {
    // Freeze room logic (encounters/markers/doors) during the beat; the player is
    // immobile anyway. newbornBeat is checked in update().
    this.newbornBeat = true;
    this.time.delayedCall(NEWBORN_BEAT_MS, () => {
      // Attention pull: zoom + pan toward the marker so it still reads as a "place".
      // Zooming in crops, so no out-of-bounds edges are revealed.
      this.cameras.main.pan(marker.x, marker.y, NEWBORN_PULL_MS, 'Sine.easeInOut');
      this.cameras.main.zoomTo(1.5, NEWBORN_PULL_MS, 'Sine.easeInOut');
      this.time.delayedCall(NEWBORN_PULL_MS + 120, () => {
        this.newbornBeat = false; // release; attemptLaunchChapter gates on transitioning
        this.attemptLaunchChapter(marker.chapter);
      });
    });
  }

  // ── Floor zone ───────────────────────────────────────────────────────────────

  private computeFloorZone(def: RoomDef): FloorZone {
    const b      = this.roomBounds();
    const scaleX = b.width  / BG_NATIVE_W;
    const scaleY = b.height / BG_NATIVE_H;
    const wallX  = Math.round(BG_WALL_PX * scaleX);
    const wallY  = Math.round(BG_WALL_PX * scaleY);

    const wiredRooms: RoomId[] = [
      'nursery', 'living-room', 'dining', 'master-bedroom',
      'garage', 'kitchen', 'bathroom', 'play-area',
    ];
    if (wiredRooms.includes(def.id)) {
      return { x: b.x + wallX, y: b.y + wallY, w: b.width - wallX * 2, h: b.height - wallY * 2 };
    }
    return { x: b.x, y: b.y, w: b.width, h: b.height };
  }

  // ── Walkability ──────────────────────────────────────────────────────────────

  private computeDoorNotches(def: RoomDef): Array<{ rect: Rect; doorIdx: number }> {
    const fz = this.currentFloorZone;
    const notches: Array<{ rect: Rect; doorIdx: number }> = [];
    const overlap = 10;
    for (let i = 0; i < def.doorways.length; i++) {
      const door = def.doorways[i]!;
      const c  = this.doorwayCenter(door);
      const hw = DOOR_WIDTH / 2;
      switch (door.side) {
        case 'bottom': {
          const top = fz.y + fz.h - overlap;
          notches.push({ rect: { x: c.x - hw, y: top, w: DOOR_WIDTH, h: (c.y + PLAYER_RADIUS) - top }, doorIdx: i });
          break;
        }
        case 'top': {
          const bot = fz.y + overlap;
          notches.push({ rect: { x: c.x - hw, y: c.y - PLAYER_RADIUS, w: DOOR_WIDTH, h: bot - (c.y - PLAYER_RADIUS) }, doorIdx: i });
          break;
        }
        case 'right': {
          const left = fz.x + fz.w - overlap;
          notches.push({ rect: { x: left, y: c.y - hw, w: (c.x + PLAYER_RADIUS) - left, h: DOOR_WIDTH }, doorIdx: i });
          break;
        }
        case 'left': {
          const right = fz.x + overlap;
          notches.push({ rect: { x: c.x - PLAYER_RADIUS, y: c.y - hw, w: right - (c.x - PLAYER_RADIUS), h: DOOR_WIDTH }, doorIdx: i });
          break;
        }
      }
    }
    return notches;
  }

  private isWalkable(px: number, py: number): boolean {
    const r  = PLAYER_RADIUS;
    const fz = this.currentFloorZone;

    const inFloor = px >= fz.x + r && px <= fz.x + fz.w - r &&
                    py >= fz.y + r && py <= fz.y + fz.h - r;
    const inNotch = this.doorNotches.some(({ rect: n }) =>
      px >= n.x && px <= n.x + n.w &&
      py >= n.y && py <= n.y + n.h,
    );
    if (!inFloor && !inNotch) return false;

    const doorClear = r + 6;
    const inDoorApproach = this.doorNotches.some(({ rect: n }) =>
      px >= n.x - doorClear && px <= n.x + n.w + doorClear &&
      py >= n.y - doorClear && py <= n.y + n.h + doorClear,
    );
    if (inDoorApproach) return true;

    for (const fp of this.footprints) {
      if (px + r > fp.x && px - r < fp.x + fp.w &&
          py + r > fp.y && py - r < fp.y + fp.h) {
        return false;
      }
    }
    return true;
  }

  private clipFootprintsAroundDoors(): void {
    const m = PLAYER_RADIUS + 6;
    const zones = this.doorNotches.map(({ rect: n }) => ({
      x: n.x - m, y: n.y - m, w: n.w + m * 2, h: n.h + m * 2,
    }));
    const keep = this.footprints.map((fp, i) => ({
      fp, key: this.footprintKeys[i],
      ok: !zones.some(z =>
        fp.x + fp.w > z.x && fp.x < z.x + z.w &&
        fp.y + fp.h > z.y && fp.y < z.y + z.h,
      ),
    }));
    if (DevMode.isEnabled()) {
      for (const k of keep) {
        if (!k.ok) console.log(`[DevMode] clipped footprint "${k.key}" — overlaps door clearance`);
      }
    }
    const kept = keep.filter(k => k.ok);
    this.footprints = kept.map(k => k.fp);
    this.footprintKeys = kept.map(k => k.key ?? '?');
  }

  // ── DevMode: collision debug ────────────────────────────────────────────────

  private drawDebugOverlays(): void {
    if (this.debugLayer) { this.debugLayer.destroy(); this.debugLayer = null; }
    if (!DevMode.isEnabled()) return;

    this.debugLayer = this.add.container(0, 0).setDepth(90);

    // Floor zone — green
    const fz = this.currentFloorZone;
    this.debugLayer.add(
      this.add.rectangle(fz.x + fz.w / 2, fz.y + fz.h / 2, fz.w, fz.h, 0x00ff00, 0.12)
        .setStrokeStyle(1, 0x00ff00, 0.6),
    );

    // Door notches — blue
    for (const { rect: n } of this.doorNotches) {
      this.debugLayer.add(
        this.add.rectangle(n.x + n.w / 2, n.y + n.h / 2, n.w, n.h, 0x0088ff, 0.25)
          .setStrokeStyle(1, 0x0088ff, 0.8),
      );
    }

    // Footprints — red
    for (const fp of this.footprints) {
      this.debugLayer.add(
        this.add.rectangle(fp.x + fp.w / 2, fp.y + fp.h / 2, fp.w, fp.h, 0xff0000, 0.18)
          .setStrokeStyle(1, 0xff0000, 0.7),
      );
    }

    // Door trigger zones — yellow circle (matches checkDoorways radial threshold)
    const radialThreshold = DOOR_WIDTH / 2 + PLAYER_RADIUS;
    for (const door of this.currentRoom.doorways) {
      const c = this.doorwayCenter(door);
      this.debugLayer.add(
        this.add.circle(c.x, c.y, radialThreshold, 0xffff00, 0.0)
          .setStrokeStyle(2, 0xffff00, 0.9),
      );
    }
  }

  private logWalkRejection(cx: number, cy: number, nx: number, ny: number): void {
    const now = performance.now();
    if (now - this.lastRejectLog < 300) return;
    this.lastRejectLog = now;

    const r  = PLAYER_RADIUS;
    const fz = this.currentFloorZone;
    const inFloor = nx >= fz.x + r && nx <= fz.x + fz.w - r &&
                    ny >= fz.y + r && ny <= fz.y + fz.h - r;
    const inNotch = this.doorNotches.some(({ rect: n }) =>
      nx >= n.x && nx <= n.x + n.w &&
      ny >= n.y && ny <= n.y + n.h,
    );
    const doorClear = r + 6;
    const inDoorApproach = this.doorNotches.some(({ rect: n }) =>
      nx >= n.x - doorClear && nx <= n.x + n.w + doorClear &&
      ny >= n.y - doorClear && ny <= n.y + n.h + doorClear,
    );

    let reason: string;
    if (!inFloor && !inNotch) {
      reason = `OUTSIDE bounds (inFloor=${inFloor}, inNotch=${inNotch})`;
      const edges = [];
      if (nx < fz.x + r) edges.push(`left: need x>=${(fz.x + r).toFixed(1)}`);
      if (nx > fz.x + fz.w - r) edges.push(`right: need x<=${(fz.x + fz.w - r).toFixed(1)}`);
      if (ny < fz.y + r) edges.push(`top: need y>=${(fz.y + r).toFixed(1)}`);
      if (ny > fz.y + fz.h - r) edges.push(`bottom: need y<=${(fz.y + fz.h - r).toFixed(1)}`);
      reason += ` [${edges.join(', ')}]`;
    } else if (inDoorApproach) {
      reason = 'IN door approach but still rejected (should not happen!)';
    } else {
      const blocked = this.footprints.findIndex(fp =>
        nx + r > fp.x && nx - r < fp.x + fp.w &&
        ny + r > fp.y && ny - r < fp.y + fp.h,
      );
      reason = blocked >= 0
        ? `FOOTPRINT #${blocked} (${this.footprintKeys[blocked] ?? '?'}) rect=(${this.footprints[blocked]!.x.toFixed(0)},${this.footprints[blocked]!.y.toFixed(0)},${this.footprints[blocked]!.w.toFixed(0)}×${this.footprints[blocked]!.h.toFixed(0)})`
        : 'unknown (all axes rejected individually)';
    }

    console.log(
      `[Walk BLOCKED] pos=(${cx.toFixed(1)},${cy.toFixed(1)}) → (${nx.toFixed(1)},${ny.toFixed(1)}) | ${reason}`,
    );
  }

  // ── Room object system ──────────────────────────────────────────────────────

  private roomObjectsFor(def: RoomDef): { objects: RoomObject[]; label: string } | null {
    switch (def.id) {
      case 'nursery':     return { objects: NURSERY_OBJECTS,    label: 'NURSERY_OBJECTS' };
      case 'living-room': return { objects: LIVINGROOM_OBJECTS, label: 'LIVINGROOM_OBJECTS' };
      case 'dining':          return { objects: DINING_OBJECTS,     label: 'DINING_OBJECTS' };
      case 'master-bedroom': return { objects: MASTER_OBJECTS,    label: 'MASTER_OBJECTS' };
      case 'garage':         return { objects: GARAGE_OBJECTS,    label: 'GARAGE_OBJECTS' };
      case 'kitchen':        return { objects: KITCHEN_OBJECTS,   label: 'KITCHEN_OBJECTS' };
      case 'bathroom':       return { objects: BATHROOM_OBJECTS,  label: 'BATHROOM_OBJECTS' };
      case 'play-area':      return { objects: PLAYAREA_OBJECTS,  label: 'PLAYAREA_OBJECTS' };
      default:               return null;
    }
  }

  private placeRoomObjects(def: RoomDef): void {
    const cfg = this.roomObjectsFor(def);
    if (!cfg) return;

    const fz      = this.currentFloorZone;
    const devMode = DevMode.isEnabled();

    if (devMode) {
      this.devDragPositions = new Map(
        cfg.objects.map((o, i) => [i, { fx: o.fx, fy: o.fy }]),
      );
    }

    for (let oi = 0; oi < cfg.objects.length; oi++) {
      const obj = cfg.objects[oi]!;
      if (!SpriteBank.has(this, obj.key)) continue;

      // Conditional objects: skip if condition fails (always show in DevMode)
      if (obj.conditional && !obj.conditional(this.profile) && !devMode) continue;

      const footX = fz.x + fz.w * obj.fx;
      const footY = fz.y + fz.h * obj.fy + obj.displayH;

      const sprite = this.add
        .image(footX, footY, obj.key)
        .setDisplaySize(obj.displayW, obj.displayH)
        .setOrigin(0.5, 1.0);

      // In DevMode, show conditional-hidden objects as ghosts
      if (obj.conditional && !obj.conditional(this.profile) && devMode) {
        sprite.setAlpha(0.35);
      }

      sprite.setDepth(obj.wallArt ? 2 : footDepth(footY));
      this.roomSprites.push(sprite);

      if (!obj.wallArt) {
        if (obj.footprintRects) {
          for (const fr of obj.footprintRects) {
            this.footprints.push({ x: footX + fr.dx, y: footY + fr.dy, w: fr.w, h: fr.h });
            this.footprintKeys.push(obj.key);
          }
        } else {
          const fpW = obj.footprintW ?? obj.displayW;
          const fpH = obj.footprintH ?? Math.round(obj.displayH * 0.30);
          this.footprints.push({ x: footX - fpW / 2, y: footY - fpH, w: fpW, h: fpH });
          this.footprintKeys.push(obj.key);
        }
      }

      // Chapter trigger objects: register trigger zone + pulse tween
      if (obj.chapterTrigger != null && (obj.conditional ? obj.conditional(this.profile) : true)) {
        const triggerRadius = Math.max(obj.displayW, obj.displayH) * 0.6;
        this.chapterTriggerObjects.push({
          chapter: obj.chapterTrigger,
          x: footX,
          y: footY - obj.displayH / 2,
          radius: triggerRadius,
        });
        this.tweens.add({
          targets: sprite,
          scale: 1.08,
          duration: 1200,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      }

      // Bonus trigger: toy chest glows after Ch10 complete
      if (obj.bonusTrigger && bonusChapterReady(this.profile)) {
        const triggerRadius = Math.max(obj.displayW, obj.displayH) * 0.6;
        this.bonusTriggerObject = {
          x: footX,
          y: footY - obj.displayH / 2,
          radius: triggerRadius,
        };
        this.tweens.add({
          targets: sprite,
          scale: 1.08,
          duration: 900,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      }

      if (devMode) {
        const objIndex    = oi;
        const objKey      = obj.key;
        const objDisplayH = obj.displayH;
        const isWallArt   = !!obj.wallArt;

        sprite.setInteractive();
        this.input.setDraggable(sprite);

        sprite.on('drag', (_ptr: Phaser.Input.Pointer, dragX: number, dragY: number) => {
          sprite.setPosition(dragX, dragY);
          if (!isWallArt) sprite.setDepth(footDepth(dragY));
        });

        sprite.on('dragend', () => {
          const newFx = parseFloat(((sprite.x - fz.x) / fz.w).toFixed(3));
          const newFy = parseFloat(((sprite.y - objDisplayH - fz.y) / fz.h).toFixed(3));
          this.devDragPositions.set(objIndex, { fx: newFx, fy: newFy });
          console.log(`[DevMode] dropped ${objKey}[${objIndex}]: fx=${newFx.toFixed(3)}, fy=${newFy.toFixed(3)}`);
          this.printRoomArray(cfg);
        });
      }
    }
  }

  // ── DevMode: room position tool ──────────────────────────────────────────────

  private printRoomArray(cfg: { objects: RoomObject[]; label: string }): void {
    const lines = cfg.objects.map((o, i) => {
      const { fx, fy } = this.devDragPositions.get(i) ?? o;
      const wallArtStr = o.wallArt ? ', wallArt: true' : '';
      return `  { key: '${o.key}', fx: ${fx.toFixed(3)}, fy: ${fy.toFixed(3)}, displayW: ${o.displayW}, displayH: ${o.displayH}${wallArtStr} },`;
    });
    console.log(
      `[DevMode] ${cfg.label} paste-ready:\nconst ${cfg.label}: RoomObject[] = [\n` +
      lines.join('\n') +
      '\n];',
    );
  }

  // ── Room drawing ─────────────────────────────────────────────────────────────

  private drawRoom(def: RoomDef): void {
    const bounds  = this.roomBounds();
    const wallPad = 8;
    const cx      = bounds.x + bounds.width  / 2;
    const cy      = bounds.y + bounds.height / 2;

    const bgKey = `room-${def.id}-bg`;
    if (SpriteBank.has(this, bgKey)) {
      const bg = this.add
        .image(cx, cy, bgKey)
        .setDisplaySize(bounds.width + wallPad * 2, bounds.height + wallPad * 2);
      this.bgLayer.add(bg);
    } else {
      const wall  = this.add.rectangle(cx, cy, bounds.width + wallPad * 2, bounds.height + wallPad * 2, def.wallColor);
      const floor = this.add.rectangle(cx, cy, bounds.width, bounds.height, def.floorColor);
      this.bgLayer.add(wall);
      this.bgLayer.add(floor);
    }

    for (const door of def.doorways) {
      const pos          = this.doorwayCenter(door);
      const isHorizontal = door.side === 'top' || door.side === 'bottom';
      const isLocked     = door.locked?.(this.profile) ?? false;
      const color        = isLocked ? 0x3a2a1a : 0x2a1a0e;
      const gap          = this.add.rectangle(
        pos.x, pos.y,
        isHorizontal ? DOOR_WIDTH : wallPad * 2 + 4,
        isHorizontal ? wallPad * 2 + 4 : DOOR_WIDTH,
        color,
      );
      const arrow = this.add
        .text(pos.x, pos.y, this.doorGlyph(door.side), {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '14px',
          color: isLocked ? '#7a6651' : '#fde68a',
        })
        .setOrigin(0.5);
      this.bgLayer.add(gap);
      this.bgLayer.add(arrow);

      if (isLocked) {
        const lockGlyph = this.add
          .text(pos.x, pos.y - 14, '\u{1F512}', {
            fontFamily: 'system-ui, sans-serif',
            fontSize: '12px',
          })
          .setOrigin(0.5);
        this.bgLayer.add(lockGlyph);
      }

      // Door label for visited destinations
      const visited = this.profile.visitedRooms ?? [];
      if (visited.includes(door.to)) {
        const destLabel = ROOMS[door.to].label;
        let lx = pos.x;
        let ly = pos.y;
        switch (door.side) {
          case 'top':    ly -= 18; break;
          case 'bottom': ly += 18; break;
          case 'left':   lx += 28; break;
          case 'right':  lx -= 28; break;
        }
        const doorLabel = this.add
          .text(lx, ly, destLabel, {
            fontFamily: 'system-ui, sans-serif',
            fontSize: '9px',
            color: '#fde68a',
          })
          .setOrigin(0.5)
          .setAlpha(0.45);
        this.bgLayer.add(doorLabel);
      }
    }
  }

  private drawMarkers(def: RoomDef): void {
    const bounds = this.roomBounds();
    for (const marker of def.markers) {
      const x    = bounds.x + bounds.width  * marker.x;
      const y    = bounds.y + bounds.height * marker.y;
      const done = this.profile.completedChapters.includes(marker.chapter);
      const color = done ? 0xfde68a : def.accentColor;
      const ring  = this.add.circle(x, y, 18, color, done ? 0.5 : 0.25).setStrokeStyle(2, color, 0.9);
      const label = this.add
        .text(x, y, done ? '★' : String(marker.chapter), {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '14px',
          color: '#3a2a1a',
          fontStyle: 'bold',
        })
        .setOrigin(0.5);
      this.tweens.add({
        targets: ring,
        scale: 1.15,
        duration: 900 + marker.chapter * 50,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      this.worldLayer.add([ring, label]);
      this.markers.push({ chapter: marker.chapter, x, y });
    }
  }

  // ── Interaction ──────────────────────────────────────────────────────────────

  private checkMarkerProximity(): void {
    let anyActive = false;

    for (const marker of this.markers) {
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, marker.x, marker.y);
      if (dist < 26) {
        anyActive = true;
        if (this.markersArmed) { this.attemptLaunchChapter(marker.chapter); return; }
      }
    }
    for (const trigger of this.chapterTriggerObjects) {
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, trigger.x, trigger.y);
      if (dist < trigger.radius) {
        anyActive = true;
        if (this.markersArmed) { this.attemptLaunchChapter(trigger.chapter); return; }
      }
    }
    if (this.bonusTriggerObject) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.bonusTriggerObject.x, this.bonusTriggerObject.y);
      if (d < this.bonusTriggerObject.radius) {
        anyActive = true;
        if (!this.bonusRevealed && this.markersArmed) {
          this.revealBonusCape();
          return;
        }
        if (this.bonusRevealed && this.bonusLaunchArmed) {
          this.launchBonusChapter();
          return;
        }
      } else if (this.bonusRevealed && !this.bonusLaunchArmed) {
        this.bonusLaunchArmed = true;
      }
    }

    if (!this.markersArmed && !anyActive) {
      this.markersArmed = true;
    }
  }

  private revealBonusCape(): void {
    if (this.transitioning || this.bonusRevealed) return;
    this.bonusRevealed = true;
    track('bonus_chest_opened', { room: this.currentRoom.id });

    const bt = this.bonusTriggerObject;
    if (!bt) return;

    const fz = this.currentFloorZone;
    const centerX = fz.x + fz.w * 0.35;
    const centerY = fz.y + fz.h * 0.55;
    let landX = centerX;
    let landY = centerY;
    const dToPlayer = Phaser.Math.Distance.Between(this.player.x, this.player.y, landX, landY);
    if (dToPlayer < 40) {
      landX = this.player.x < centerX ? centerX + 50 : centerX - 50;
    }
    landX = Phaser.Math.Clamp(landX, fz.x + PLAYER_RADIUS + 10, fz.x + fz.w - PLAYER_RADIUS - 10);
    landY = Phaser.Math.Clamp(landY, fz.y + PLAYER_RADIUS + 10, fz.y + fz.h - PLAYER_RADIUS - 10);

    // Cape rises from the chest, arcs to the floor, and settles as the bonus trigger.
    const useCapeSprite = SpriteBank.has(this, 'obj-cape-red');
    const cape: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle = useCapeSprite
      ? this.add.image(bt.x, bt.y - 10, 'obj-cape-red').setDisplaySize(28, 34).setAlpha(0).setDepth(50)
      : this.add.rectangle(bt.x, bt.y - 10, 22, 28, 0xdc2626).setStrokeStyle(2, 0xfde047).setAlpha(0).setDepth(50);
    // Collar accent only shows for the programmatic fallback; the sprite includes its own.
    const collar = this.add.rectangle(bt.x, bt.y - 24, 14, 5, 0xfde047)
      .setAlpha(0).setDepth(50).setVisible(!useCapeSprite);

    // Phase 1: cape rises out of chest
    this.tweens.add({
      targets: [cape, collar],
      y: '-=40',
      alpha: 1,
      duration: 500,
      ease: 'Back.easeOut',
    });

    // Phase 2: arc to landing spot
    this.tweens.add({
      targets: cape,
      x: landX,
      y: landY,
      duration: 600,
      delay: 550,
      ease: 'Sine.easeInOut',
    });
    this.tweens.add({
      targets: collar,
      x: landX,
      y: landY - 14,
      duration: 600,
      delay: 550,
      ease: 'Sine.easeInOut',
    });

    // Phase 3: settle beat + pulse at landing spot
    this.time.delayedCall(1250, () => {
      this.tweens.add({
        targets: cape,
        scaleX: 1.2,
        scaleY: 1.2,
        duration: 300,
        yoyo: true,
        ease: 'Sine.easeInOut',
      });

      this.tweens.add({
        targets: cape,
        alpha: 0.7,
        duration: 800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });

      bt.x = landX;
      bt.y = landY;
      bt.radius = 26;
      this.bonusLaunchArmed = false;
    });
  }

  private launchBonusChapter(): void {
    if (this.transitioning) return;
    track('bonus_marker_touched', { room: this.currentRoom.id });
    this.transitioning = true;
    SaveManager.flushSessionTime();

    this.cameras.main.fadeOut(260, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('BonusChapter', { profile: this.profile });
    });
  }

  private attemptLaunchChapter(chapter: number): void {
    if (this.transitioning) return;
    track('chapter_marker_touched', { chapter_id: chapter, room: this.currentRoom.id });

    const sceneKey = CHAPTER_SCENES[chapter];
    if (!sceneKey) {
      this.showToast(`Chapter ${chapter} — coming soon`);
      this.player.x += this.player.x < this.scale.width / 2 ? -32 : 32;
      this.player.y += this.player.y < this.scale.height / 2 ? -32 : 32;
      return;
    }

    this.transitioning = true;
    SaveManager.flushSessionTime();
    this.cameras.main.fadeOut(260, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(sceneKey, { profile: this.profile });
    });
  }

  private lastDoorDebug = 0;

  private checkDoorways(): void {
    const px = this.player.x;
    const py = this.player.y;
    const fz = this.currentFloorZone;
    const r  = PLAYER_RADIUS;
    const devMode = DevMode.isEnabled();
    const radialThreshold = DOOR_WIDTH / 2 + r; // 36 + 12 = 48

    for (let di = 0; di < this.currentRoom.doorways.length; di++) {
      const door   = this.currentRoom.doorways[di]!;
      const center = this.doorwayCenter(door);

      // Notch-based trigger — circle-vs-rect
      const notch = this.doorNotches.find(dn => dn.doorIdx === di);
      let insideNotch = false;
      let pastEdge    = false;
      if (notch) {
        const n = notch.rect;
        insideNotch = px >= n.x && px <= n.x + n.w &&
                      py >= n.y && py <= n.y + n.h;
        pastEdge =
          (door.side === 'bottom' && py > fz.y + fz.h) ||
          (door.side === 'top'    && py < fz.y) ||
          (door.side === 'right'  && px > fz.x + fz.w) ||
          (door.side === 'left'   && px < fz.x);
      }

      // Radial trigger — true Euclidean distance
      const dist = Phaser.Math.Distance.Between(px, py, center.x, center.y);
      const radialHit = dist < radialThreshold;

      const triggered = (insideNotch && pastEdge) || radialHit;
      // Re-arm this specific door the moment the player is clear of its zone.
      if (!triggered) this.doorArmed[di] = true;

      // DevMode instrumentation
      if (devMode && dist < 80) {
        const now = performance.now();
        if (now - this.lastDoorDebug > 1000) {
          this.lastDoorDebug = now;
          const n = notch?.rect;
          const edgeVal = door.side === 'bottom' ? fz.y + fz.h :
                          door.side === 'top'    ? fz.y :
                          door.side === 'right'  ? fz.x + fz.w : fz.x;
          console.log(
            `[DoorDebug] ${door.side}→${door.to} | player=(${px.toFixed(1)},${py.toFixed(1)})` +
            ` | center=(${center.x.toFixed(1)},${center.y.toFixed(1)})` +
            ` | notch=${n ? `(${n.x.toFixed(0)},${n.y.toFixed(0)},${n.w.toFixed(0)}×${n.h.toFixed(0)})` : 'none'}` +
            ` | fzEdge=${edgeVal.toFixed(1)}` +
            ` | dist=${dist.toFixed(1)} radialThresh=${radialThreshold}` +
            ` | insideNotch=${insideNotch} pastEdge=${pastEdge} radialHit=${radialHit}` +
            ` | armed=${this.doorArmed[di]} transitioning=${this.transitioning}`,
          );
        }
      }

      if (!triggered || !this.doorArmed[di]) continue;

      if (door.locked?.(this.profile)) {
        this.showToast(door.lockMessage ?? 'Locked.');
        if      (door.side === 'right')  this.player.x = fz.x + fz.w - r;
        else if (door.side === 'left')   this.player.x = fz.x + r;
        else if (door.side === 'bottom') this.player.y = fz.y + fz.h - r;
        else                             this.player.y = fz.y + r;
        return;
      }
      this.transition(door);
      return;
    }
  }

  private maybeTriggerEncounter(): void {
    if (this.transitioning) return;
    const sceneKey = this.encounters.tick(this.profile, this.currentRoom.encounterChance, performance.now());
    if (!sceneKey) return;
    this.transitioning = true;
    SaveManager.flushSessionTime();
    track('encounter_marker_touched', { room: this.currentRoom.id, encounter_scene: sceneKey });
    this.showToast('!');
    this.cameras.main.fadeOut(280, 80, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(sceneKey, { profile: this.profile });
    });
  }

  private transition(door: Doorway): void {
    if (this.transitioning) return;
    this.transitioning = true;
    SaveManager.flushSessionTime();
    const fromRoom = this.currentRoom.id;
    track('room_changed', { from: fromRoom, to: door.to, via: door.side });
    this.cameras.main.fadeOut(TRANSITION_MS, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.enterRoom(door.to, { fromSide: oppositeSide(door.side), fromRoom });
    });
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private roomBounds(): { x: number; y: number; width: number; height: number } {
    const reserveBottom = 180;
    return {
      x:      ROOM_PADDING,
      y:      ROOM_PADDING + 24,
      width:  this.scale.width  - ROOM_PADDING * 2,
      height: this.scale.height - reserveBottom - ROOM_PADDING - 24,
    };
  }

  private doorGlyph(side: Side): string {
    return { top: '↑', bottom: '↓', left: '←', right: '→' }[side];
  }

  private doorwayCenter(door: Doorway): { x: number; y: number } {
    const bounds  = this.roomBounds();
    const wallPad = 8;
    switch (door.side) {
      case 'top':    return { x: bounds.x + bounds.width  * door.position, y: bounds.y - wallPad };
      case 'bottom': return { x: bounds.x + bounds.width  * door.position, y: bounds.y + bounds.height + wallPad };
      case 'left':   return { x: bounds.x - wallPad,                       y: bounds.y + bounds.height * door.position };
      case 'right':  return { x: bounds.x + bounds.width  + wallPad,       y: bounds.y + bounds.height * door.position };
    }
  }

  /** One-time full-screen overlay (IntroPanel-styled) when Caius first gains mobility. */
  private showMobilityOverlay(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    const thaw = freezeScene(this); // project rule: never tweens.pauseAll()

    const c = this.add.container(0, 0).setDepth(600);
    const scrim = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.8).setInteractive();
    c.add(scrim);

    const body = this.add
      .text(W / 2, H * 0.4, 'Caius has learned how to move now... but slowly at first.', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '20px',
        color: '#fde68a',
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: W - 80 },
      })
      .setOrigin(0.5);
    c.add(body);

    const btnW = 280;
    const btnH = 64;
    const btn = this.add.container(W / 2, H * 0.62);
    const g = this.add.graphics();
    g.fillStyle(0xfbbf24, 1);
    g.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 18);
    const label = this.add
      .text(0, 0, "Let's get crawling!", {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '20px',
        color: '#1c1410',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    const hit = this.add.rectangle(0, 0, btnW, btnH, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => {
      thaw();
      c.destroy();
    });
    btn.add([g, label, hit]);
    c.add(btn);

    this.tweens.add({ targets: btn, scaleX: 1.04, scaleY: 1.04, duration: 750, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  private showToast(message: string): void {
    if (this.toastText) { this.toastText.destroy(); this.toastText = null; }
    const t = this.add
      .text(this.scale.width / 2, this.scale.height - 220, message, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '16px',
        color: '#fde68a',
        backgroundColor: '#1c1410',
        padding: { x: 12, y: 8 },
      })
      .setOrigin(0.5)
      .setDepth(200);
    this.toastText = t;
    this.tweens.add({
      targets: t,
      alpha: 0,
      duration: 400,
      delay: TOAST_MS - 400,
      onComplete: () => { t.destroy(); if (this.toastText === t) this.toastText = null; },
    });
  }

  private onShutdown(): void {
    SaveManager.flushSessionTime();
    this.controls?.destroy();
    this.devModeUnsub?.();
    this.devModeUnsub = null;
    for (const s of this.roomSprites) s.destroy();
    this.roomSprites = [];
  }
}
