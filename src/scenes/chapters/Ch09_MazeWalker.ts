import Phaser from 'phaser';
import { ChapterBase } from './ChapterBase';
import { SpriteBank } from '../../systems/SpriteBank';
import { TouchControls } from '../../ui/TouchControls';
import { RetryPopup } from '../../ui/RetryPopup';

const WALKER_RADIUS = 14;
const SPEED = 130;
const DRIFT = 0.88;
const STAR_TIME_S = 90;
const MAX_COLLISIONS = 5;
const WALKER_DISPLAY = 52;   // px — walker-Caius sprite display size
const WALK_FPS = 9;
const WALK_DIRS = ['south', 'north', 'east', 'west'] as const;
type WalkDir = (typeof WALK_DIRS)[number];

type Obstacle = { x: number; y: number; w: number; h: number };

export class Ch09_MazeWalker extends ChapterBase {
  private walker!: Phaser.GameObjects.Container;
  private walkerSprite: Phaser.GameObjects.Sprite | null = null;
  private walkerFacing: WalkDir = 'south';
  private controls!: TouchControls;
  private vx = 0;
  private vy = 0;
  private obstacles: Obstacle[] = [];
  // Chelsea position for win check; visual stored separately for tween target.
  private chelseaGoal = { x: 0, y: 0 };
  private chelseaVis!: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
  private active = false;
  private startMs = 0;
  private timerText!: Phaser.GameObjects.Text;
  private playArea = { x: 24, y: 100, w: 0, h: 0 };
  private collisions = 0;
  private collisionCooldown = 0;
  private retryPopup!: RetryPopup;

  constructor() {
    super('Ch09_MazeWalker', 9);
  }

  preload(): void {
    SpriteBank.preloadInto(this, [
      'caius-walker-south', 'caius-walker-north',
      'caius-walker-east',  'caius-walker-west',
      'chelsea-encouraging-standing',
    ]);
    // Walk cycle: 5 frames × 4 directions = 20 images (loaded directly, same
    // pattern as the dog-walk cycle in Ch06_GrabBag).
    for (const dir of WALK_DIRS) {
      for (let i = 0; i < 5; i++) {
        if (!this.textures.exists(`caius-walker-walk-${dir}-${i}`)) {
          this.load.image(
            `caius-walker-walk-${dir}-${i}`,
            `/assets/sprites/caius-walker/walk/${dir}/${i}.png`,
          );
        }
      }
    }
  }

  create(): void {
    this.setup();
    this.retryPopup = new RetryPopup(this);
    this.cameras.main.setBackgroundColor('#3a2515');

    const W = this.scale.width;
    const H = this.scale.height;
    this.playArea.w = W - 48;
    this.playArea.h = H - 280;

    // Create walk-cycle animations (4 cardinal directions).
    for (const dir of WALK_DIRS) {
      const key = `caius-walker-walk-${dir}`;
      if (!this.anims.exists(key) && this.textures.exists(`caius-walker-walk-${dir}-0`)) {
        this.anims.create({
          key,
          frames: Array.from({ length: 5 }, (_, i) => ({ key: `caius-walker-walk-${dir}-${i}` })),
          frameRate: WALK_FPS,
          repeat: -1,
        });
      }
    }

    // Floor
    this.add.rectangle(W / 2, this.playArea.y + this.playArea.h / 2, this.playArea.w, this.playArea.h, 0x8a6540);

    // Obstacle layout — positions and collision rects are UNCHANGED.
    // Visuals: styled rounded rects (warm leather/cushion look) replacing flat code rects.
    const oa = this.playArea;
    this.obstacles = [
      { x: oa.x + 80, y: oa.y + 90, w: 90, h: 18 },
      { x: oa.x + 200, y: oa.y + 60, w: 18, h: 80 },
      { x: oa.x + 90, y: oa.y + 180, w: 18, h: 90 },
      { x: oa.x + 220, y: oa.y + 220, w: 90, h: 18 },
      { x: oa.x + 60, y: oa.y + 320, w: 80, h: 60 },
      { x: oa.x + 220, y: oa.y + 360, w: 18, h: 60 },
    ];
    const wallGfx = this.add.graphics();
    for (const o of this.obstacles) {
      // Warm dark-brown fill
      wallGfx.fillStyle(0x6b4a28, 1);
      wallGfx.fillRoundedRect(o.x, o.y, o.w, o.h, 4);
      // Subtle inner shadow (slightly darker inset)
      if (o.w > 6 && o.h > 6) {
        wallGfx.fillStyle(0x432e14, 0.45);
        wallGfx.fillRoundedRect(o.x + 2, o.y + 2, o.w - 4, o.h - 4, 3);
      }
      // Light edge highlight
      wallGfx.lineStyle(1.5, 0xd4a870, 0.45);
      wallGfx.strokeRoundedRect(o.x, o.y, o.w, o.h, 4);
    }

    // Chelsea at the goal — real sprite (no purple rect, no text label).
    const chx = oa.x + oa.w - 50;
    const chy = oa.y + oa.h - 50;
    this.chelseaGoal = { x: chx, y: chy };
    if (SpriteBank.has(this, 'chelsea-encouraging-standing')) {
      this.chelseaVis = this.add
        .image(chx, chy, 'chelsea-encouraging-standing')
        .setDisplaySize(80, 80);
    } else {
      this.chelseaVis = this.add
        .rectangle(chx, chy, 40, 50, 0x7c5fb0)
        .setStrokeStyle(2, 0xfde68a, 0.85);
      this.add
        .text(chx, chy - 36, 'Mama', {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '10px',
          color: '#fde68a',
          fontStyle: 'bold',
        })
        .setOrigin(0.5);
    }

    // Walker — real directional sprite (circle fallback if textures not ready).
    this.walker = this.add.container(oa.x + 40, oa.y + 40);
    this.walkerFacing = 'south';
    if (this.textures.exists('caius-walker-south')) {
      this.walkerSprite = this.add
        .sprite(0, 0, 'caius-walker-south')
        .setDisplaySize(WALKER_DISPLAY, WALKER_DISPLAY);
      this.walker.add(this.walkerSprite);
    } else {
      const body = this.add.circle(0, 0, WALKER_RADIUS, 0xf7c6a3).setStrokeStyle(2, 0x402c1d);
      const frame = this.add.rectangle(0, 8, 36, 12, 0xfde68a, 0.5).setStrokeStyle(1, 0x402c1d);
      this.walker.add([body, frame]);
    }

    this.controls = new TouchControls(this);

    this.timerText = this.add
      .text(W / 2, 60, '0.0s', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        color: '#fde68a',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.add
      .text(W / 2, H - 50, `Reach Mama. Under ${STAR_TIME_S}s for a star.`, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '11px',
        color: '#fde68a',
      })
      .setOrigin(0.5)
      .setAlpha(0.5);

    void this.intro('Maze Walker', 'Wobble through the room to Mama.').then(() => {
      this.startMs = this.time.now;
      this.active = true;
    });
  }

  private resetRound(): void {
    const oa = this.playArea;
    this.walker.setPosition(oa.x + 40, oa.y + 40);
    this.vx = 0;
    this.vy = 0;
    this.collisions = 0;
    this.collisionCooldown = 0;
    this.startMs = this.time.now;
    this.active = true;
    // Reset walker sprite to idle south on retry
    if (this.walkerSprite) {
      this.walkerFacing = 'south';
      this.walkerSprite.anims.stop();
      if (this.textures.exists('caius-walker-south')) {
        this.walkerSprite.setTexture('caius-walker-south');
      }
    }
  }

  override update(_t: number, delta: number): void {
    if (!this.active) return;
    const dt = delta / 1000;
    const v = this.controls.getVector();
    this.vx = this.vx * DRIFT + v.x * SPEED * 0.5;
    this.vy = this.vy * DRIFT + v.y * SPEED * 0.5;
    this.vx = Phaser.Math.Clamp(this.vx, -SPEED, SPEED);
    this.vy = Phaser.Math.Clamp(this.vy, -SPEED, SPEED);

    let nx = this.walker.x + this.vx * dt;
    let ny = this.walker.y + this.vy * dt;

    // Clamp to play area
    const minX = this.playArea.x + WALKER_RADIUS;
    const maxX = this.playArea.x + this.playArea.w - WALKER_RADIUS;
    const minY = this.playArea.y + WALKER_RADIUS;
    const maxY = this.playArea.y + this.playArea.h - WALKER_RADIUS;
    if (nx < minX) { nx = minX; this.vx = 0; }
    if (nx > maxX) { nx = maxX; this.vx = 0; }
    if (ny < minY) { ny = minY; this.vy = 0; }
    if (ny > maxY) { ny = maxY; this.vy = 0; }

    // Obstacle collisions
    if (this.collisionCooldown > 0) this.collisionCooldown -= delta;
    for (const o of this.obstacles) {
      const cx = Phaser.Math.Clamp(nx, o.x, o.x + o.w);
      const cy = Phaser.Math.Clamp(ny, o.y, o.y + o.h);
      const ddx = nx - cx;
      const ddy = ny - cy;
      const d2 = ddx * ddx + ddy * ddy;
      if (d2 < WALKER_RADIUS * WALKER_RADIUS) {
        const d = Math.sqrt(d2) || 1;
        const push = WALKER_RADIUS - d;
        nx += (ddx / d) * push;
        ny += (ddy / d) * push;
        if (Math.abs(ddx) > Math.abs(ddy)) this.vx = -this.vx * 0.3;
        else this.vy = -this.vy * 0.3;
        if (this.collisionCooldown <= 0) {
          this.collisions++;
          this.collisionCooldown = 500;
          this.softFail('obstacle-hit', `Bump! (${this.collisions}/${MAX_COLLISIONS})`);
          if (this.collisions >= MAX_COLLISIONS) {
            this.active = false;
            this.walker.setPosition(nx, ny);
            this.retryPopup.show(() => this.resetRound(), 'Too many bumps! Try again!');
            return;
          }
        }
      }
    }

    this.walker.setPosition(nx, ny);

    // Walker sprite animation — direction from D-pad dominant axis (same rule as crawl sprites).
    if (this.walkerSprite) {
      const absVx = Math.abs(v.x);
      const absVy = Math.abs(v.y);
      const isInputting = v.x !== 0 || v.y !== 0;
      const isMoving = Math.abs(this.vx) > 8 || Math.abs(this.vy) > 8;

      if (isInputting) {
        let wantFacing: WalkDir;
        if (absVx >= absVy && v.x !== 0) {
          wantFacing = v.x > 0 ? 'east' : 'west';
        } else {
          wantFacing = v.y > 0 ? 'south' : 'north';
        }
        const animKey = `caius-walker-walk-${wantFacing}`;
        if (wantFacing !== this.walkerFacing || !this.walkerSprite.anims.isPlaying) {
          this.walkerFacing = wantFacing;
          if (this.anims.exists(animKey)) {
            this.walkerSprite.play(animKey, true);
          }
        }
      } else if (!isMoving && this.walkerSprite.anims.isPlaying) {
        // No input + nearly stopped → idle frame for current facing
        this.walkerSprite.anims.stop();
        if (this.textures.exists(`caius-walker-${this.walkerFacing}`)) {
          this.walkerSprite.setTexture(`caius-walker-${this.walkerFacing}`);
        }
      }
    }

    const elapsed = (this.time.now - this.startMs) / 1000;
    this.timerText.setText(`${elapsed.toFixed(1)}s`);

    // Reached Chelsea?
    if (
      Math.abs(nx - this.chelseaGoal.x) < 30 &&
      Math.abs(ny - this.chelseaGoal.y) < 36
    ) {
      this.active = false;
      const star = elapsed <= STAR_TIME_S;
      this.timerText.setText(star ? `★ ${elapsed.toFixed(1)}s` : `${elapsed.toFixed(1)}s`);
      const alreadyDone = this.profile.completedInterludes.includes('mama');
      this.tweens.add({
        targets: this.chelseaVis,
        scale: 1.15,
        duration: 300,
        yoyo: true,
        onComplete: () =>
          this.completeChapter(alreadyDone ? {} : { nextScene: 'Interlude02_Mama' }),
      });
    }
  }
}
