import Phaser from 'phaser';
import { ROOMS, oppositeSide } from './rooms';
import type { Doorway, RoomDef, Side } from './rooms';
import { SaveManager } from '../systems/SaveManager';
import { deriveMobility, speedFor, bonusChapterReady } from '../systems/PlayerState';
import { track } from '../systems/Analytics';
import { DevMode } from '../systems/DevMode';
import { TouchControls } from '../ui/TouchControls';
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
};

// Positions are tuned for the nursery's top-down floor plan.
// Objects against the top wall (crib, dresser, lamp) have small fy so they sort behind
// objects in the middle. Character sorts above all when walking toward the bottom.
const NURSERY_OBJECTS: RoomObject[] = [
  { key: 'obj-nursery-crib',        fx: 0.30, fy: 0.08, displayW: 80,  displayH: 80  },
  { key: 'obj-nursery-dresser',      fx: 0.72, fy: 0.08, displayW: 72,  displayH: 72  },
  { key: 'obj-nursery-bookshelf',    fx: 0.06, fy: 0.22, displayW: 80,  displayH: 80  },
  { key: 'obj-nursery-chair',        fx: 0.55, fy: 0.42, displayW: 44,  displayH: 56  },
  { key: 'obj-nursery-toychest',     fx: 0.26, fy: 0.22, displayW: 56,  displayH: 42  },
  // Wall art and tall items against the back wall — always render behind floor objects
  { key: 'obj-nursery-floorlamp',    fx: 0.88, fy: 0.04, displayW: 24,  displayH: 72,  wallArt: true },
  { key: 'obj-nursery-foxpainting',  fx: 0.58, fy: 0.02, displayW: 40,  displayH: 40,  wallArt: true },
];

// ── Misc constants ────────────────────────────────────────────────────────────
const ROOM_PADDING   = 32;
const DOOR_WIDTH     = 72;
const PLAYER_RADIUS  = 12;
const TRANSITION_MS  = 220;
const TOAST_MS       = 1600;

export class HouseScene extends Phaser.Scene {
  private profile!: SaveProfile;
  private currentRoom!: RoomDef;
  private currentFloorZone!: FloorZone;
  private bgLayer!: Phaser.GameObjects.Container;
  private worldLayer!: Phaser.GameObjects.Container;
  private hudLayer!: Phaser.GameObjects.Container;
  private player!: Phaser.GameObjects.Container;
  private playerBody: Phaser.GameObjects.Arc | null = null;
  private controls!: TouchControls;
  private roomLabel!: Phaser.GameObjects.Text;
  private transitioning = false;
  private markers: Array<{ chapter: number; x: number; y: number }> = [];
  private capeMarker: { x: number; y: number } | null = null;
  private toastText: Phaser.GameObjects.Text | null = null;
  private devModeUnsub: (() => void) | null = null;
  private encounters = new EncounterManager();
  private fromEncounter = false;
  /** Scene-level sprites placed for depth sorting; cleared on every room change. */
  private roomSprites: Phaser.GameObjects.Image[] = [];

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
      // Nursery object sprites (reference room)
      'obj-nursery-crib',
      'obj-nursery-dresser',
      'obj-nursery-bookshelf',
      'obj-nursery-chair',
      'obj-nursery-floorlamp',
      'obj-nursery-foxpainting',
      'obj-nursery-toychest',
    ]);
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#0a0a1f');
    this.cameras.main.fadeIn(180, 0, 0, 0);

    this.bgLayer    = this.add.container(0, 0).setDepth(0);
    this.worldLayer = this.add.container(0, 0).setDepth(1);
    this.hudLayer   = this.add.container(0, 0).setDepth(100);

    this.player = this.add.container(0, 0);
    if (SpriteBank.has(this, 'caius')) {
      const sprite = this.add.image(0, 0, 'caius').setDisplaySize(PLAYER_RADIUS * 2.5, PLAYER_RADIUS * 3.5);
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
    if (this.transitioning) return;

    const mobility = deriveMobility(this.profile);
    const speed    = speedFor(mobility);
    if (speed > 0) {
      const v  = this.controls.getVector();
      const dt = delta / 1000;
      const nx = this.player.x + v.x * speed * dt;
      const ny = this.player.y + v.y * speed * dt;

      const fz = this.currentFloorZone;
      const clampedX = Phaser.Math.Clamp(nx, fz.x + PLAYER_RADIUS, fz.x + fz.w - PLAYER_RADIUS);
      const clampedY = Phaser.Math.Clamp(ny, fz.y + PLAYER_RADIUS, fz.y + fz.h - PLAYER_RADIUS);
      this.player.setPosition(clampedX, clampedY);
    }

    // Depth-sort player by foot position each frame
    this.player.setDepth(footDepth(this.player.y));

    this.checkMarkerProximity();
    this.checkDoorways();
    this.maybeTriggerEncounter();
  }

  // ── Room entry ──────────────────────────────────────────────────────────────

  private enterRoom(roomId: RoomId, opts: { fromSide?: Side; firstLoad?: boolean }): void {
    const def = ROOMS[roomId];
    this.currentRoom = def;

    SaveManager.setCurrentRoom(roomId);
    const fresh = SaveManager.getActiveProfile();
    if (fresh) this.profile = fresh;

    // Clear previous room
    this.bgLayer.removeAll(true);
    this.worldLayer.removeAll(true);
    for (const s of this.roomSprites) s.destroy();
    this.roomSprites = [];
    this.markers     = [];
    this.capeMarker  = null;

    this.drawRoom(def);
    this.currentFloorZone = this.computeFloorZone(def);
    this.placeRoomObjects(def);
    this.drawMarkers(def);
    this.drawBonusCape(def);
    this.roomLabel.setText(def.label);

    const fz = this.currentFloorZone;
    let px   = fz.x + fz.w / 2;
    let py   = fz.y + fz.h / 2;
    if (opts.fromSide) {
      const entry = def.doorways.find((d) => d.side === opts.fromSide);
      if (entry) {
        const pos  = this.doorwayCenter(entry);
        const back = PLAYER_RADIUS * 2;
        px = pos.x + (entry.side === 'left' ? back : entry.side === 'right' ? -back : 0);
        py = pos.y + (entry.side === 'top'  ? back : entry.side === 'bottom' ? -back : 0);
      }
    }
    this.player.setPosition(px, py);
    this.player.setDepth(footDepth(py));

    this.encounters.onEnterRoom(def.encounterChance, performance.now());
    if (!opts.firstLoad) this.cameras.main.fadeIn(TRANSITION_MS, 0, 0, 0);
    this.transitioning = false;
  }

  // ── Floor zone ───────────────────────────────────────────────────────────────

  private computeFloorZone(def: RoomDef): FloorZone {
    const b      = this.roomBounds();
    const scaleX = b.width  / BG_NATIVE_W;
    const scaleY = b.height / BG_NATIVE_H;
    const wallX  = Math.round(BG_WALL_PX * scaleX);
    const wallY  = Math.round(BG_WALL_PX * scaleY);

    // Nursery (and future fully-wired rooms) get wall inset; others use full bounds.
    if (def.id === 'nursery') {
      return { x: b.x + wallX, y: b.y + wallY, w: b.width - wallX * 2, h: b.height - wallY * 2 };
    }
    return { x: b.x, y: b.y, w: b.width, h: b.height };
  }

  // ── Nursery render system ─────────────────────────────────────────────────────

  private placeRoomObjects(def: RoomDef): void {
    if (def.id !== 'nursery') return;

    const fz     = this.currentFloorZone;
    const scaleX = this.roomBounds().width  / BG_NATIVE_W;
    const scaleY = this.roomBounds().height / BG_NATIVE_H;

    // Correction: display sizes in the NURSERY_OBJECTS array are already in game px
    // (native px × 2.0 ROOM_SCALE). scaleX/scaleY are the same 2.0 — no need to
    // re-apply. We use them here only for sub-pixel corrections if the canvas shifts.
    void scaleX; void scaleY;

    for (const obj of NURSERY_OBJECTS) {
      if (!SpriteBank.has(this, obj.key)) continue;

      // Foot position in game px (bottom-centre of sprite in floor zone)
      const footX = fz.x + fz.w * obj.fx;
      const footY = fz.y + fz.h * obj.fy + obj.displayH;

      const sprite = this.add
        .image(footX, footY, obj.key)
        .setDisplaySize(obj.displayW, obj.displayH)
        .setOrigin(0.5, 1.0);  // foot-anchored: centre-bottom

      sprite.setDepth(obj.wallArt ? 2 : footDepth(footY));
      this.roomSprites.push(sprite);
    }
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

  private drawBonusCape(def: RoomDef): void {
    if (def.id !== 'play-area') return;
    if (!bonusChapterReady(this.profile)) return;

    const bounds = this.roomBounds();
    const x      = bounds.x + bounds.width  * 0.25;
    const y      = bounds.y + bounds.height * 0.35;

    const cape   = this.add.rectangle(x, y, 22, 26, 0xdc2626).setStrokeStyle(2, 0xfde047);
    const collar = this.add.rectangle(x, y - 12, 12, 4, 0xfde047);
    const label  = this.add
      .text(x, y + 22, 'CAPE', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '10px',
        color: '#fde047',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.tweens.add({
      targets: cape,
      scaleX: 1.15,
      scaleY: 1.15,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.worldLayer.add([cape, collar, label]);
    this.capeMarker = { x, y };
  }

  // ── Interaction ──────────────────────────────────────────────────────────────

  private checkMarkerProximity(): void {
    for (const marker of this.markers) {
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, marker.x, marker.y);
      if (dist < 26) {
        this.attemptLaunchChapter(marker.chapter);
        return;
      }
    }
    if (this.capeMarker) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.capeMarker.x, this.capeMarker.y);
      if (d < 26) this.attemptLaunchBonus();
    }
  }

  private attemptLaunchBonus(): void {
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

  private checkDoorways(): void {
    for (const door of this.currentRoom.doorways) {
      const center = this.doorwayCenter(door);
      const dx     = Math.abs(this.player.x - center.x);
      const dy     = Math.abs(this.player.y - center.y);
      const isHorizontal = door.side === 'top' || door.side === 'bottom';
      const halfW  = isHorizontal ? DOOR_WIDTH / 2 : 24;
      const halfH  = isHorizontal ? 24 : DOOR_WIDTH / 2;
      if (dx < halfW && dy < halfH) {
        if (door.locked?.(this.profile)) {
          this.showToast(door.lockMessage ?? 'Locked.');
          if      (door.side === 'right')  this.player.x -= 24;
          else if (door.side === 'left')   this.player.x += 24;
          else if (door.side === 'bottom') this.player.y -= 24;
          else                             this.player.y += 24;
          return;
        }
        this.transition(door);
        return;
      }
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
    track('room_changed', { from: this.currentRoom.id, to: door.to, via: door.side });
    this.cameras.main.fadeOut(TRANSITION_MS, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.enterRoom(door.to, { fromSide: oppositeSide(door.side) });
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
