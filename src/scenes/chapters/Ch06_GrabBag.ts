import Phaser from 'phaser';
import { ChapterBase } from './ChapterBase';
import { SpriteBank } from '../../systems/SpriteBank';
import { RetryPopup } from '../../ui/RetryPopup';

type DogId = 'finn' | 'nugget' | 'eevee' | 'soka';

type Dog = {
  id: DogId;
  obj: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
  vx: number;
  vy: number;
  nextActionAt: number;
  color: number;
  label: string;
};

type Toy = {
  obj: Phaser.GameObjects.Image | Phaser.GameObjects.Arc;
  x: number;
  y: number;
};

const TOY_KEYS = [
  'toy-block', 'toy-ball', 'toy-duck', 'toy-star',
  'toy-rattle', 'toy-car', 'toy-teether', 'toy-blocktower',
] as const;
const TOY_DISPLAY = 36; // display px — slightly larger than native 32 for better tappability

const DURATION_MS = 60_000;
const SPAWN_INTERVAL_MS = 1800;
const WIN = 6;
const STAR = 10;

const DOG_SPRITE_KEYS: Record<DogId, string> = {
  finn: 'finn-south',
  nugget: 'nugget-south',
  eevee: 'eevee-south',
  soka: 'soka-south',
};

// All four dogs get a real walk cycle (fixes the static-sprite "slide"); Soka now glides
// toward toys via velocity instead of teleporting.
const DOG_WALK_IDS: DogId[] = ['finn', 'nugget', 'eevee', 'soka'];
const WALK_FRAME_COUNT = 9; // each dog has walk/<dir>/0..8 (64x64)
const DOG_WALK_FPS = 12; // brisk Gen-3-ish stride
const DOG_SIZE = 72; // ~3x the previous tiny dogs

export class Ch06_GrabBag extends ChapterBase {
  private toys: Toy[] = [];
  private dogs: Dog[] = [];
  private grabbed = 0;
  private endsAt = 0;
  private active = false;
  private scoreText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private playArea = { x: 30, y: 110, w: 0, h: 0 };
  private nextSpawnAt = 0;
  private retryPopup!: RetryPopup;

  constructor() {
    super('Ch06_GrabBag', 6);
  }

  preload(): void {
    SpriteBank.preloadInto(this, [...Object.values(DOG_SPRITE_KEYS), ...TOY_KEYS]);
    // Walk-cycle frames are a 9-frame sequence per dog (not a single manifest sprite), so
    // load them directly. South-facing frames; flipX handles left/right while moving.
    for (const id of DOG_WALK_IDS) {
      for (let i = 0; i < WALK_FRAME_COUNT; i++) {
        this.load.image(`dog-${id}-walk-${i}`, `/assets/sprites/${id}/walk/south/${i}.png`);
      }
    }
  }

  private createDogAnims(): void {
    for (const id of DOG_WALK_IDS) {
      if (this.textures.exists(`dog-${id}-walk-0`) && !this.anims.exists(`dog-${id}-walk`)) {
        this.anims.create({
          key: `dog-${id}-walk`,
          frames: Array.from({ length: WALK_FRAME_COUNT }, (_, i) => ({ key: `dog-${id}-walk-${i}` })),
          frameRate: DOG_WALK_FPS,
          repeat: -1,
        });
      }
    }
  }

  create(): void {
    // scene.restart() reuses the class instance — reset all mutable fields before use.
    this.grabbed = 0;
    this.dogs = [];
    this.toys = [];

    this.setup();
    this.retryPopup = new RetryPopup(this);
    this.cameras.main.setBackgroundColor('#2a1a0e');

    const W = this.scale.width;
    const H = this.scale.height;
    this.playArea.w = W - 60;
    this.playArea.h = H - 280;

    // Floor
    this.add.rectangle(W / 2, this.playArea.y + this.playArea.h / 2, this.playArea.w, this.playArea.h, 0x8a6540);

    // Score centered, timer in the top-right — distinct, non-overlapping.
    this.scoreText = this.add
      .text(W / 2, 60, '0 grabbed', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '16px',
        color: '#fde68a',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.timerText = this.add
      .text(W - 18, 60, '60', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '13px',
        color: '#fde68a',
      })
      .setOrigin(1, 0.5)
      .setAlpha(0.7);

    // Spawn dogs
    this.createDogAnims();
    const dogDefs: Array<{ id: DogId; color: number; label: string }> = [
      { id: 'finn', color: 0x6b3a1a, label: 'Finn' },
      { id: 'nugget', color: 0xc9a35d, label: 'Nugget' },
      { id: 'eevee', color: 0xa67449, label: 'Eevee' },
      { id: 'soka', color: 0xe6e6e6, label: 'Soka' },
    ];
    for (const def of dogDefs) {
      const sx = Phaser.Math.Between(this.playArea.x + 30, this.playArea.x + this.playArea.w - 30);
      const sy = Phaser.Math.Between(this.playArea.y + 30, this.playArea.y + this.playArea.h - 30);
      const spriteKey = DOG_SPRITE_KEYS[def.id];
      let obj: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;

      if (this.anims.exists(`dog-${def.id}-walk`)) {
        // Square aspect (64x64 frames) preserved; walk anim driven in driveDog().
        obj = this.add.sprite(sx, sy, `dog-${def.id}-walk-0`).setDisplaySize(DOG_SIZE, DOG_SIZE);
      } else if (SpriteBank.has(this, spriteKey)) {
        obj = this.add.image(sx, sy, spriteKey).setDisplaySize(DOG_SIZE, DOG_SIZE * 0.82);
      } else {
        obj = this.add.rectangle(sx, sy, 22, 18, def.color).setStrokeStyle(1, 0xfde68a, 0.4);
        this.add.text(sx, sy, def.label[0]!, {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '9px',
          color: '#fde68a',
          fontStyle: 'bold',
        }).setOrigin(0.5);
      }

      this.dogs.push({ id: def.id, obj, vx: 0, vy: 0, nextActionAt: 0, color: def.color, label: def.label });
    }

    void this.intro('Grab Bag', 'Tap toys before a dog snags them.').then(() => {
      this.endsAt = this.time.now + DURATION_MS;
      this.nextSpawnAt = this.time.now + 400;
      this.active = true;
    });
  }

  private spawnToy(): void {
    const { x, y, w, h } = this.playArea;
    const tx = Phaser.Math.Between(x + 24, x + w - 24);
    const ty = Phaser.Math.Between(y + 24, y + h - 24);

    // Pick a random toy sprite; fall back to the yellow dot if not loaded.
    const key = Phaser.Utils.Array.GetRandom([...TOY_KEYS]) as string;
    const toyObj: Phaser.GameObjects.Image | Phaser.GameObjects.Arc = SpriteBank.has(this, key)
      ? this.add.image(tx, ty, key).setDisplaySize(TOY_DISPLAY, TOY_DISPLAY)
      : this.add.circle(tx, ty, 12, 0xfde68a).setStrokeStyle(2, 0xfb923c);

    toyObj.setInteractive({ useHandCursor: true });
    toyObj.on('pointerdown', () => {
      this.grabbed++;
      this.scoreText.setText(`${this.grabbed} grabbed`);
      this.tweens.add({ targets: toyObj, scale: 1.6, alpha: 0, duration: 180, onComplete: () => toyObj.destroy() });
      this.toys = this.toys.filter((t) => t.obj !== toyObj);
    });
    this.toys.push({ obj: toyObj, x: tx, y: ty });
    // Auto-decay if not grabbed in 4 sec
    this.time.delayedCall(4000, () => {
      if (toyObj.active) {
        toyObj.destroy();
        this.toys = this.toys.filter((t) => t.obj !== toyObj);
      }
    });
  }

  override update(_t: number, delta: number): void {
    if (!this.active) return;
    const remaining = Math.max(0, this.endsAt - this.time.now);
    this.timerText.setText(String(Math.ceil(remaining / 1000)));

    if (this.time.now > this.nextSpawnAt) {
      this.spawnToy();
      this.nextSpawnAt = this.time.now + SPAWN_INTERVAL_MS - Math.min(800, this.grabbed * 60);
    }

    // Dogs move
    const dt = delta / 1000;
    for (const dog of this.dogs) {
      this.driveDog(dog, dt);
    }

    if (remaining <= 0) {
      this.active = false;
      this.evaluate();
    }
  }

  private driveDog(dog: Dog, dt: number): void {
    const obj = dog.obj;
    // Set behavior based on ID
    if (this.time.now > dog.nextActionAt) {
      const closest = this.closestToy(obj.x, obj.y);
      switch (dog.id) {
        case 'finn': {
          // Fast straight run toward closest toy
          if (closest) {
            const dx = closest.x - obj.x;
            const dy = closest.y - obj.y;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            dog.vx = (dx / len) * 140;
            dog.vy = (dy / len) * 140;
          } else {
            dog.vx = Phaser.Math.Between(-60, 60);
            dog.vy = Phaser.Math.Between(-60, 60);
          }
          dog.nextActionAt = this.time.now + 900;
          break;
        }
        case 'nugget': {
          // Slow, greedy — meanders toward closest
          if (closest) {
            const dx = closest.x - obj.x;
            const dy = closest.y - obj.y;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            dog.vx = (dx / len) * 50;
            dog.vy = (dy / len) * 50;
          } else {
            dog.vx = Phaser.Math.Between(-30, 30);
            dog.vy = Phaser.Math.Between(-30, 30);
          }
          dog.nextActionAt = this.time.now + 1400;
          break;
        }
        case 'eevee': {
          // Diagonal pounces
          const angle = Phaser.Math.Between(0, 7) * (Math.PI / 4);
          dog.vx = Math.cos(angle) * 110;
          dog.vy = Math.sin(angle) * 110;
          dog.nextActionAt = this.time.now + 700;
          break;
        }
        case 'soka': {
          // Glide toward the closest toy (no more teleport snapping)
          if (closest) {
            const dx = closest.x - obj.x;
            const dy = closest.y - obj.y;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            dog.vx = (dx / len) * 85;
            dog.vy = (dy / len) * 85;
          } else {
            dog.vx = Phaser.Math.Between(-40, 40);
            dog.vy = Phaser.Math.Between(-40, 40);
          }
          dog.nextActionAt = this.time.now + 1100;
          break;
        }
      }
    }

    obj.x += dog.vx * dt;
    obj.y += dog.vy * dt;

    // Walk cycle: legs move while translating (no slide); idle freezes on frame 0.
    if (obj instanceof Phaser.GameObjects.Sprite) {
      const moving = Math.abs(dog.vx) + Math.abs(dog.vy) > 8;
      if (moving) {
        if (!obj.anims.isPlaying) obj.play(`dog-${dog.id}-walk`);
        obj.setFlipX(dog.vx < 0);
      } else if (obj.anims.isPlaying) {
        obj.anims.stop();
        obj.setTexture(`dog-${dog.id}-walk-0`);
      }
    }

    const minX = this.playArea.x + 16;
    const maxX = this.playArea.x + this.playArea.w - 16;
    const minY = this.playArea.y + 16;
    const maxY = this.playArea.y + this.playArea.h - 16;
    if (obj.x < minX || obj.x > maxX) dog.vx = -dog.vx;
    if (obj.y < minY || obj.y > maxY) dog.vy = -dog.vy;
    obj.x = Phaser.Math.Clamp(obj.x, minX, maxX);
    obj.y = Phaser.Math.Clamp(obj.y, minY, maxY);

    // Toy collision (dog steals)
    this.toys = this.toys.filter((t) => {
      const dx = obj.x - t.obj.x;
      const dy = obj.y - t.obj.y;
      if (dx * dx + dy * dy < 22 * 22) {
        this.tweens.add({ targets: t.obj, scale: 0.5, alpha: 0, duration: 200, onComplete: () => t.obj.destroy() });
        return false;
      }
      return true;
    });
  }

  private closestToy(x: number, y: number): Toy | null {
    let best: Toy | null = null;
    let bestD = Infinity;
    for (const t of this.toys) {
      const dx = t.x - x;
      const dy = t.y - y;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    }
    return best;
  }

  private evaluate(): void {
    if (this.grabbed >= WIN) {
      const star = this.grabbed >= STAR;
      this.scoreText.setText(star ? '★ STAR!' : 'Got enough!');
      this.completeChapter();
    } else {
      this.softFail('not-enough', `${this.grabbed} grabbed. Need ${WIN}+.`);
      this.retryPopup.show(() => this.retry(), `Only ${this.grabbed} toys! Need ${WIN}. Try again!`);
    }
  }
}
