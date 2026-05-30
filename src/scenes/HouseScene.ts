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

const ROOM_PADDING = 32;
const DOOR_WIDTH = 72;
const PLAYER_RADIUS = 12;
const TRANSITION_MS = 220;
const TOAST_MS = 1600;

export class HouseScene extends Phaser.Scene {
  private profile!: SaveProfile;
  private currentRoom!: RoomDef;
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

  constructor() {
    super({ key: 'HouseScene' });
  }

  init(data: { profile?: SaveProfile; fromEncounter?: boolean }): void {
    console.log('[house] init', { hasData: !!data, hasProfile: !!data?.profile, fromEncounter: !!data?.fromEncounter });
    const profile = data.profile ?? SaveManager.getActiveProfile();
    if (!profile) {
      throw new Error('HouseScene started without an active profile');
    }
    this.profile = profile;
    this.fromEncounter = !!data.fromEncounter;
  }

  preload(): void {
    SpriteBank.preloadInto(this, ['caius', 'room-nursery-bg']);
  }

  create(): void {
    console.log('[house] create, profile=', this.profile.name, 'room=', this.profile.currentRoom);
    this.cameras.main.setBackgroundColor('#0a0a1f');
    this.cameras.main.fadeIn(180, 0, 0, 0);

    this.bgLayer = this.add.container(0, 0);
    this.worldLayer = this.add.container(0, 0);
    this.hudLayer = this.add.container(0, 0).setDepth(100);

    this.player = this.add.container(0, 0).setDepth(50);
    if (SpriteBank.has(this, 'caius')) {
      const sprite = this.add.image(0, 0, 'caius').setDisplaySize(PLAYER_RADIUS * 2.5, PLAYER_RADIUS * 3.5);
      this.player.add(sprite);
    } else {
      this.playerBody = this.add.circle(0, 0, PLAYER_RADIUS, 0xf7c6a3).setStrokeStyle(2, 0x402c1d);
      const cheekL = this.add.circle(-4, 2, 2, 0xe89a8a);
      const cheekR = this.add.circle(4, 2, 2, 0xe89a8a);
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
      if (this.currentRoom) {
        this.enterRoom(this.currentRoom.id, { firstLoad: true });
      }
    });

    if (this.fromEncounter) {
      this.encounters.onEncounterCleared(performance.now());
    }

    this.enterRoom(this.profile.currentRoom, { firstLoad: true });
  }

  override update(_time: number, delta: number): void {
    if (this.transitioning) return;

    const mobility = deriveMobility(this.profile);
    const speed = speedFor(mobility);
    if (speed > 0) {
      const v = this.controls.getVector();
      const dt = delta / 1000;
      const nx = this.player.x + v.x * speed * dt;
      const ny = this.player.y + v.y * speed * dt;

      const bounds = this.roomBounds();
      const clampedX = Phaser.Math.Clamp(nx, bounds.x + PLAYER_RADIUS, bounds.x + bounds.width - PLAYER_RADIUS);
      const clampedY = Phaser.Math.Clamp(ny, bounds.y + PLAYER_RADIUS, bounds.y + bounds.height - PLAYER_RADIUS);
      this.player.setPosition(clampedX, clampedY);
    }

    this.checkMarkerProximity();
    this.checkDoorways();
    this.maybeTriggerEncounter();
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

  private roomBounds(): { x: number; y: number; width: number; height: number } {
    const reserveBottom = 180;
    return {
      x: ROOM_PADDING,
      y: ROOM_PADDING + 24,
      width: this.scale.width - ROOM_PADDING * 2,
      height: this.scale.height - reserveBottom - ROOM_PADDING - 24,
    };
  }

  private enterRoom(roomId: RoomId, opts: { fromSide?: Side; firstLoad?: boolean }): void {
    const def = ROOMS[roomId];
    this.currentRoom = def;

    SaveManager.setCurrentRoom(roomId);
    const fresh = SaveManager.getActiveProfile();
    if (fresh) this.profile = fresh;

    this.bgLayer.removeAll(true);
    this.worldLayer.removeAll(true);
    this.markers = [];
    this.capeMarker = null;

    this.drawRoom(def);
    this.drawMarkers(def);
    this.drawBonusCape(def);
    this.roomLabel.setText(def.label);

    const bounds = this.roomBounds();
    let px = bounds.x + bounds.width / 2;
    let py = bounds.y + bounds.height / 2;
    if (opts.fromSide) {
      const entry = def.doorways.find((d) => d.side === opts.fromSide);
      if (entry) {
        const pos = this.doorwayCenter(entry);
        const back = PLAYER_RADIUS * 2;
        px = pos.x + (entry.side === 'left' ? back : entry.side === 'right' ? -back : 0);
        py = pos.y + (entry.side === 'top' ? back : entry.side === 'bottom' ? -back : 0);
      }
    }
    this.player.setPosition(px, py);
    this.player.setDepth(50);

    this.encounters.onEnterRoom(def.encounterChance, performance.now());

    if (!opts.firstLoad) {
      this.cameras.main.fadeIn(TRANSITION_MS, 0, 0, 0);
    }
    this.transitioning = false;
  }

  private drawRoom(def: RoomDef): void {
    const bounds = this.roomBounds();
    const wallPad = 8;
    const cx = bounds.x + bounds.width / 2;
    const cy = bounds.y + bounds.height / 2;

    const bgKey = `room-${def.id}-bg` as const;
    if (SpriteBank.has(this, bgKey)) {
      const bg = this.add
        .image(cx, cy, bgKey)
        .setDisplaySize(bounds.width + wallPad * 2, bounds.height + wallPad * 2);
      this.bgLayer.add(bg);
    } else {
      const wall = this.add.rectangle(cx, cy, bounds.width + wallPad * 2, bounds.height + wallPad * 2, def.wallColor);
      this.bgLayer.add(wall);
      const floor = this.add.rectangle(cx, cy, bounds.width, bounds.height, def.floorColor);
      this.bgLayer.add(floor);
    }

    for (const door of def.doorways) {
      const pos = this.doorwayCenter(door);
      const isHorizontal = door.side === 'top' || door.side === 'bottom';
      const isLocked = door.locked?.(this.profile) ?? false;
      const color = isLocked ? 0x3a2a1a : 0x2a1a0e;
      const gap = this.add.rectangle(
        pos.x,
        pos.y,
        isHorizontal ? DOOR_WIDTH : wallPad * 2 + 4,
        isHorizontal ? wallPad * 2 + 4 : DOOR_WIDTH,
        color,
      );
      this.bgLayer.add(gap);

      const arrow = this.add
        .text(pos.x, pos.y, this.doorGlyph(door.side), {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '14px',
          color: isLocked ? '#7a6651' : '#fde68a',
        })
        .setOrigin(0.5);
      this.bgLayer.add(arrow);
    }
  }

  private doorGlyph(side: Side): string {
    return { top: '↑', bottom: '↓', left: '←', right: '→' }[side];
  }

  private doorwayCenter(door: Doorway): { x: number; y: number } {
    const bounds = this.roomBounds();
    const wallPad = 8;
    switch (door.side) {
      case 'top':
        return { x: bounds.x + bounds.width * door.position, y: bounds.y - wallPad };
      case 'bottom':
        return { x: bounds.x + bounds.width * door.position, y: bounds.y + bounds.height + wallPad };
      case 'left':
        return { x: bounds.x - wallPad, y: bounds.y + bounds.height * door.position };
      case 'right':
        return { x: bounds.x + bounds.width + wallPad, y: bounds.y + bounds.height * door.position };
    }
  }

  private drawMarkers(def: RoomDef): void {
    const bounds = this.roomBounds();
    for (const marker of def.markers) {
      const x = bounds.x + bounds.width * marker.x;
      const y = bounds.y + bounds.height * marker.y;
      const done = this.profile.completedChapters.includes(marker.chapter);
      const color = done ? 0xfde68a : def.accentColor;
      const ring = this.add.circle(x, y, 18, color, done ? 0.5 : 0.25).setStrokeStyle(2, color, 0.9);
      const labelGlyph = done ? '★' : String(marker.chapter);
      const label = this.add
        .text(x, y, labelGlyph, {
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

  private checkMarkerProximity(): void {
    for (const marker of this.markers) {
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, marker.x, marker.y);
      if (dist < 26) {
        this.attemptLaunchChapter(marker.chapter);
        return;
      }
    }
    if (this.capeMarker) {
      const d = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        this.capeMarker.x,
        this.capeMarker.y,
      );
      if (d < 26) {
        this.attemptLaunchBonus();
      }
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

  private drawBonusCape(def: RoomDef): void {
    if (def.id !== 'play-area') return;
    if (!bonusChapterReady(this.profile)) return;

    const bounds = this.roomBounds();
    const x = bounds.x + bounds.width * 0.25;
    const y = bounds.y + bounds.height * 0.35;

    // Cape glyph: simple red shape — colored rectangle for now
    const cape = this.add.rectangle(x, y, 22, 26, 0xdc2626).setStrokeStyle(2, 0xfde047);
    // Tiny collar
    const collar = this.add.rectangle(x, y - 12, 12, 4, 0xfde047);
    const label = this.add
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
      const dx = Math.abs(this.player.x - center.x);
      const dy = Math.abs(this.player.y - center.y);
      const isHorizontal = door.side === 'top' || door.side === 'bottom';
      const halfW = isHorizontal ? DOOR_WIDTH / 2 : 24;
      const halfH = isHorizontal ? 24 : DOOR_WIDTH / 2;
      if (dx < halfW && dy < halfH) {
        if (door.locked?.(this.profile)) {
          this.showToast(door.lockMessage ?? 'Locked.');
          if (door.side === 'right') this.player.x -= 24;
          else if (door.side === 'left') this.player.x += 24;
          else if (door.side === 'bottom') this.player.y -= 24;
          else this.player.y += 24;
          return;
        }
        this.transition(door);
        return;
      }
    }
  }

  private transition(door: Doorway): void {
    if (this.transitioning) return;
    this.transitioning = true;
    SaveManager.flushSessionTime();

    track('room_changed', {
      from: this.currentRoom.id,
      to: door.to,
      via: door.side,
    });

    this.cameras.main.fadeOut(TRANSITION_MS, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.enterRoom(door.to, { fromSide: oppositeSide(door.side) });
    });
  }

  private showToast(message: string): void {
    if (this.toastText) {
      this.toastText.destroy();
      this.toastText = null;
    }
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
      onComplete: () => {
        t.destroy();
        if (this.toastText === t) this.toastText = null;
      },
    });
  }

  private onShutdown(): void {
    SaveManager.flushSessionTime();
    this.controls?.destroy();
    this.devModeUnsub?.();
    this.devModeUnsub = null;
  }
}
