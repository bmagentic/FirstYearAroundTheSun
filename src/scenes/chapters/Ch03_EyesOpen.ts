import Phaser from 'phaser';
import { ChapterBase } from './ChapterBase';
import { SpriteBank } from '../../systems/SpriteBank';
import { SoundBank } from '../../systems/SoundBank';

// "First Touch" — Month 3 discovery game (replaces the retired "soft cloud / 6 pages"
// card-flip texture game, which named textures the screen couldn't show). Texture is
// conveyed through REACTION: tap an object → it animates + plays its sound. Discover all
// five to win. No fail state, no timer.
//
// DUCKED CHAPTER: the five reaction sfx are mechanic sounds — tag this chapter
// music-ducked when the music system lands so the clips sit under the score.

const FRAME = 64; // each react sheet is 448x64 = 7 frames of 64x64
const FRAMES = 7;
const REACT_FPS = 14;
const OBJ_DISPLAY = 104;

type ObjDef = {
  id: string;
  fx: number; // arc position (fraction of width / height)
  fy: number;
};

// Single source of truth (the scene "manifest"): sheet key = `obj-<id>-react`, sheet at
// /assets/sprites/objects/obj_<id>_react.png, sound id = `sfx-<id>` at /assets/audio/sfx/<id>.m4a.
const OBJECTS: ObjDef[] = [
  { id: 'crinklebook', fx: 0.16, fy: 0.42 },
  { id: 'rattle', fx: 0.33, fy: 0.32 },
  { id: 'poe', fx: 0.5, fy: 0.29 },
  { id: 'bumpyball', fx: 0.67, fy: 0.32 },
  { id: 'oball', fx: 0.84, fy: 0.42 },
];

const sheetKey = (id: string) => `obj-${id}-react`;
const soundId = (id: string) => `sfx-${id}`;

export class Ch03_EyesOpen extends ChapterBase {
  private active = false;
  private discovered = new Set<string>();
  private animating = new Set<string>();
  private dots: Phaser.GameObjects.Arc[] = [];

  constructor() {
    super('Ch03_EyesOpen', 3);
  }

  preload(): void {
    SpriteBank.preloadInto(this, ['caius', 'emote-sparkle', 'emote-heart']);
    for (const o of OBJECTS) {
      this.load.spritesheet(sheetKey(o.id), `/assets/sprites/objects/obj_${o.id}_react.png`, {
        frameWidth: FRAME,
        frameHeight: FRAME,
      });
      // Reaction sfx route through SoundBank (respects the global mute flag).
      SoundBank.preload(soundId(o.id), `/assets/audio/sfx/${o.id}.m4a`);
    }
  }

  create(): void {
    this.setup();
    const W = this.scale.width;
    const H = this.scale.height;
    this.cameras.main.setBackgroundColor('#221d30');

    // Simple play-mat ground.
    this.add.ellipse(W / 2, H * 0.42, W * 0.92, H * 0.46, 0x3a3550, 0.55);

    // Discovery counter — 5 small dots, fill as objects are discovered (no number).
    this.dots = [];
    for (let i = 0; i < OBJECTS.length; i++) {
      const dx = W / 2 + (i - (OBJECTS.length - 1) / 2) * 26;
      this.dots.push(this.add.circle(dx, 56, 7, 0x3a3a4a).setStrokeStyle(2, 0xfde68a, 0.5));
    }

    // Reaction anims (play once, return to rest frame 0).
    for (const o of OBJECTS) {
      if (this.textures.exists(sheetKey(o.id)) && !this.anims.exists(`${o.id}-react`)) {
        this.anims.create({
          key: `${o.id}-react`,
          frames: this.anims.generateFrameNumbers(sheetKey(o.id), { start: 0, end: FRAMES - 1 }),
          frameRate: REACT_FPS,
          repeat: 0,
        });
      }
    }

    // The 5 objects in a loose arc in front of Caius.
    OBJECTS.forEach((o, i) => {
      const x = W * o.fx;
      const y = H * o.fy;
      let spr: Phaser.GameObjects.Sprite | Phaser.GameObjects.Arc;
      if (this.textures.exists(sheetKey(o.id))) {
        spr = this.add.sprite(x, y, sheetKey(o.id), 0).setDisplaySize(OBJ_DISPLAY, OBJ_DISPLAY);
      } else {
        spr = this.add.circle(x, y, OBJ_DISPLAY / 2, 0xfde68a, 0.5);
      }
      // Gentle idle bob (varied phase).
      this.tweens.add({
        targets: spr,
        y: y - 5,
        duration: 1500 + i * 130,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });

      // Generous, explicit centered hit area (Ch03 lesson — never default texture bounds).
      const hit = this.add.rectangle(x, y, 128, 128, 0xffffff, 0).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => this.tapObject(o, spr, x, y));
    });

    // Caius observing from the bottom.
    const caiusKey = SpriteBank.has(this, 'caius') ? 'caius' : '';
    if (caiusKey) {
      this.add.image(W / 2, H * 0.82, caiusKey).setDisplaySize(84, 84);
    } else {
      this.add.circle(W / 2, H * 0.82, 30, 0xf7c6a3).setStrokeStyle(2, 0x402c1d);
    }

    void this.intro('First Touch', 'Touch everything!').then(() => {
      this.active = true;
    });
  }

  private tapObject(o: ObjDef, spr: Phaser.GameObjects.Sprite | Phaser.GameObjects.Arc, x: number, y: number): void {
    if (!this.active) return;
    if (this.animating.has(o.id)) return; // ignore taps mid-reaction

    // Sound + animation fire together (sound gated by global mute; anim plays regardless).
    SoundBank.play(soundId(o.id));

    if (spr instanceof Phaser.GameObjects.Sprite && this.anims.exists(`${o.id}-react`)) {
      this.animating.add(o.id);
      spr.play(`${o.id}-react`);
      spr.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
        spr.setFrame(0);
        this.animating.delete(o.id);
      });
    } else {
      // Fallback flourish if the sheet is missing.
      this.animating.add(o.id);
      this.tweens.add({
        targets: spr,
        scale: (spr.scaleX || 1) * 1.2,
        duration: 220,
        yoyo: true,
        onComplete: () => this.animating.delete(o.id),
      });
    }

    // Discovery (first tap only).
    if (!this.discovered.has(o.id)) {
      this.discovered.add(o.id);
      this.sparkleAt(x, y);
      this.fillDot(this.discovered.size - 1);
      if (this.discovered.size >= OBJECTS.length) this.win();
    }
  }

  private sparkleAt(x: number, y: number): void {
    const s = this.add.image(x, y - 24, 'emote-sparkle').setDisplaySize(38, 38).setAlpha(0).setDepth(20);
    this.tweens.add({
      targets: s,
      alpha: { from: 1, to: 0 },
      scale: 1.5,
      y: y - 64,
      duration: 720,
      ease: 'Sine.easeOut',
      onComplete: () => s.destroy(),
    });
  }

  private fillDot(i: number): void {
    const dot = this.dots[i];
    if (!dot) return;
    dot.setFillStyle(0xfde68a, 1);
    this.tweens.add({ targets: dot, scale: 1.5, duration: 200, yoyo: true });
  }

  private win(): void {
    this.active = false;
    const W = this.scale.width;
    const H = this.scale.height;

    // Celebration consistent with Ch02: heart bloom + rising sparkles.
    const heart = this.add.image(W / 2, H * 0.5, 'emote-heart').setDisplaySize(76, 76).setDepth(40).setAlpha(0);
    const full = heart.scaleX;
    heart.setScale(full * 0.4);
    this.tweens.add({ targets: heart, alpha: 1, scale: full, duration: 500, ease: 'Back.easeOut' });
    for (let i = 0; i < 5; i++) {
      const sp = this.add
        .image(W / 2 + Phaser.Math.Between(-60, 60), H * 0.5, 'emote-sparkle')
        .setDisplaySize(30, 30)
        .setDepth(40)
        .setAlpha(0);
      this.tweens.add({
        targets: sp,
        y: H * 0.5 - Phaser.Math.Between(70, 130),
        alpha: { from: 0.9, to: 0 },
        duration: 1000,
        delay: i * 110,
        ease: 'Sine.easeOut',
        onComplete: () => sp.destroy(),
      });
    }

    this.time.delayedCall(1300, () => this.completeChapter());
  }
}
