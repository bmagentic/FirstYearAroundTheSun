import Phaser from 'phaser';
import { ChapterBase } from './ChapterBase';
import { SpriteBank } from '../../systems/SpriteBank';

const DRAG = 0.94; // velocity multiplier per frame
const SWIPE_FORCE = 380;
const MAX_SPEED = 280;
const CAIUS_RADIUS = 14;
const CUBE_SIZE = 38;

export class Ch04_RollOut extends ChapterBase {
  private caius!: Phaser.GameObjects.Container;
  private vx = 0;
  private vy = 0;
  private cube!: Phaser.GameObjects.Rectangle;
  private obstacles: Phaser.GameObjects.Rectangle[] = [];
  private playArea!: { x: number; y: number; w: number; h: number };
  private active = false;
  private swipeStart: { x: number; y: number; t: number } | null = null;

  constructor() {
    super('Ch04_RollOut', 4);
  }

  preload(): void {
    SpriteBank.preloadInto(this, ['caius-roll', 'vtech-cube']);
  }

  create(): void {
    this.setup();
    this.cameras.main.setBackgroundColor('#5e4a3a');

    const W = this.scale.width;
    const H = this.scale.height;

    // Rug
    this.playArea = { x: 28, y: 90, w: W - 56, h: H - 240 };
    const { x, y, w, h } = this.playArea;
    this.add.rectangle(x + w / 2, y + h / 2, w, h, 0xb98c5a);
    this.add.rectangle(x + w / 2, y + h / 2, w - 16, h - 16).setStrokeStyle(2, 0x8a6540, 0.6);

    // Cube goal
    const cubeX = x + w - CUBE_SIZE;
    const cubeY = y + CUBE_SIZE;
    this.cube = this.add
      .rectangle(cubeX, cubeY, CUBE_SIZE, CUBE_SIZE, 0xe24a4a)
      .setStrokeStyle(2, 0xfde68a, 0.9);
    this.add
      .text(cubeX, cubeY, 'CUBE', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '9px',
        color: '#fde68a',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.tweens.add({
      targets: this.cube,
      scale: 1.1,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Obstacles
    const obs = [
      { x: x + w * 0.35, y: y + h * 0.3, w: 60, h: 18 },
      { x: x + w * 0.65, y: y + h * 0.55, w: 18, h: 80 },
      { x: x + w * 0.3, y: y + h * 0.75, w: 90, h: 18 },
    ];
    for (const o of obs) {
      const r = this.add.rectangle(o.x, o.y, o.w, o.h, 0x6e553f).setStrokeStyle(1, 0xfde68a, 0.3);
      this.obstacles.push(r);
    }

    // Caius
    this.caius = this.add.container(x + 50, y + h - 60);
    const body = SpriteBank.has(this, 'caius-roll')
      ? this.add.image(0, 0, 'caius-roll').setDisplaySize(26, 26)
      : (this.add.circle(0, 0, CAIUS_RADIUS, 0xf7c6a3).setStrokeStyle(2, 0x402c1d) as unknown as Phaser.GameObjects.Image);
    this.caius.add(body);

    // Swipe handlers on the play area
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!this.active) return;
      this.swipeStart = { x: p.x, y: p.y, t: p.downTime };
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (!this.active || !this.swipeStart) return;
      const dx = p.x - this.swipeStart.x;
      const dy = p.y - this.swipeStart.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 18) {
        // Treat short flick as a directional nudge toward the tap
        const tx = p.x - this.caius.x;
        const ty = p.y - this.caius.y;
        const tlen = Math.sqrt(tx * tx + ty * ty) || 1;
        this.applyForce((tx / tlen) * SWIPE_FORCE * 0.6, (ty / tlen) * SWIPE_FORCE * 0.6);
      } else {
        this.applyForce((dx / dist) * SWIPE_FORCE, (dy / dist) * SWIPE_FORCE);
      }
      this.swipeStart = null;
    });

    // Hint
    this.add
      .text(W / 2, H - 80, 'Swipe to roll toward the cube', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '13px',
        color: '#fde68a',
      })
      .setOrigin(0.5)
      .setAlpha(0.6);

    void this.intro('Roll Out', 'Swipe Caius across the rug to the cube.').then(() => {
      this.active = true;
    });
  }

  private applyForce(fx: number, fy: number): void {
    this.vx = Phaser.Math.Clamp(this.vx + fx, -MAX_SPEED, MAX_SPEED);
    this.vy = Phaser.Math.Clamp(this.vy + fy, -MAX_SPEED, MAX_SPEED);
  }

  override update(_t: number, delta: number): void {
    if (!this.active) return;
    const dt = delta / 1000;

    const nx = this.caius.x + this.vx * dt;
    const ny = this.caius.y + this.vy * dt;

    // Clamp to rug bounds
    const { x, y, w, h } = this.playArea;
    const cx = Phaser.Math.Clamp(nx, x + CAIUS_RADIUS, x + w - CAIUS_RADIUS);
    const cy = Phaser.Math.Clamp(ny, y + CAIUS_RADIUS, y + h - CAIUS_RADIUS);
    if (cx !== nx) this.vx = -this.vx * 0.4;
    if (cy !== ny) this.vy = -this.vy * 0.4;
    this.caius.setPosition(cx, cy);

    // Obstacle collisions (rect vs circle)
    for (const o of this.obstacles) {
      const ox = o.x;
      const oy = o.y;
      const ow = (o.width as number) / 2;
      const oh = (o.height as number) / 2;
      const closestX = Phaser.Math.Clamp(cx, ox - ow, ox + ow);
      const closestY = Phaser.Math.Clamp(cy, oy - oh, oy + oh);
      const ddx = cx - closestX;
      const ddy = cy - closestY;
      if (ddx * ddx + ddy * ddy < CAIUS_RADIUS * CAIUS_RADIUS) {
        // Push out
        const overlap = CAIUS_RADIUS - Math.sqrt(ddx * ddx + ddy * ddy);
        const dist = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
        this.caius.x += (ddx / dist) * overlap;
        this.caius.y += (ddy / dist) * overlap;
        if (Math.abs(ddx) > Math.abs(ddy)) this.vx = -this.vx * 0.4;
        else this.vy = -this.vy * 0.4;
      }
    }

    // Friction
    this.vx *= DRAG;
    this.vy *= DRAG;
    if (Math.abs(this.vx) < 4) this.vx = 0;
    if (Math.abs(this.vy) < 4) this.vy = 0;

    // Cube check
    const dx = this.caius.x - this.cube.x;
    const dy = this.caius.y - this.cube.y;
    if (dx * dx + dy * dy < (CAIUS_RADIUS + CUBE_SIZE / 2) * (CAIUS_RADIUS + CUBE_SIZE / 2)) {
      this.active = false;
      this.tweens.add({
        targets: this.cube,
        scale: 1.4,
        duration: 240,
        yoyo: true,
        onComplete: () => this.completeChapter(),
      });
    }
  }
}
