import Phaser from 'phaser';
import { ChapterBase } from './ChapterBase';
import { SpriteBank } from '../../systems/SpriteBank';
import { TouchControls } from '../../ui/TouchControls';

const SPEED = 150; // D-pad move speed (px/s)
const CAIUS_RADIUS = 24; // collision radius (fits the corridors with margin)
const CAIUS_SIZE = 66; // ~2.5x the previous 26px
const CUBE_SIZE = 40;
const WALL = 16; // maze wall thickness
const GAP_FRAC = 0.3; // fraction of width left open at each divider

type Wall = { cx: number; cy: number; w: number; h: number };

export class Ch04_RollOut extends ChapterBase {
  private caius!: Phaser.GameObjects.Container;
  private cube!: Phaser.GameObjects.Image;
  private walls: Wall[] = [];
  private playArea!: { x: number; y: number; w: number; h: number };
  private controls!: TouchControls;
  private active = false;

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

    // Rug / play area
    this.playArea = { x: 28, y: 90, w: W - 56, h: H - 240 };
    const pa = this.playArea;
    this.add.rectangle(pa.x + pa.w / 2, pa.y + pa.h / 2, pa.w, pa.h, 0xb98c5a);
    this.add.rectangle(pa.x + pa.w / 2, pa.y + pa.h / 2, pa.w - 16, pa.h - 16).setStrokeStyle(2, 0x8a6540, 0.6);

    // Hand-authored maze: a serpentine of horizontal dividers with alternating gaps,
    // so the player must turn right→up→left→up→right→up→left→up to reach the cube.
    // Guaranteed solvable, ~15-20s once the path is seen, no procedural generation.
    const dividers: Array<{ fy: number; gap: 'left' | 'right' }> = [
      { fy: 0.8, gap: 'right' },
      { fy: 0.62, gap: 'left' },
      { fy: 0.44, gap: 'right' },
      { fy: 0.26, gap: 'left' },
    ];
    const wallW = pa.w * (1 - GAP_FRAC);
    for (const d of dividers) {
      const cx = d.gap === 'right' ? pa.x + wallW / 2 : pa.x + pa.w - wallW / 2;
      const cy = pa.y + pa.h * d.fy;
      this.walls.push({ cx, cy, w: wallW, h: WALL });
    }
    for (const wall of this.walls) {
      this.add.rectangle(wall.cx, wall.cy, wall.w, wall.h, 0x6e553f).setStrokeStyle(1, 0xfde68a, 0.3);
    }

    // Cube goal (top-right)
    const cubeX = pa.x + pa.w - CUBE_SIZE;
    const cubeY = pa.y + CUBE_SIZE;
    this.cube = this.add.image(cubeX, cubeY, 'vtech-cube').setDisplaySize(CUBE_SIZE, CUBE_SIZE);
    this.tweens.add({ targets: this.cube, scale: 1.1, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // Caius (bottom-left), 2.5x bigger
    this.caius = this.add.container(pa.x + 48, pa.y + pa.h - 48);
    const key = SpriteBank.has(this, 'caius-roll') ? 'caius-roll' : 'caius';
    this.caius.add(this.add.image(0, 0, key).setDisplaySize(CAIUS_SIZE, CAIUS_SIZE));

    // D-pad movement (replaces the old swipe mechanic)
    this.controls = new TouchControls(this);

    this.add
      .text(W / 2, H - 80, 'Use the D-pad to roll Caius to the cube', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '13px',
        color: '#fde68a',
      })
      .setOrigin(0.5)
      .setAlpha(0.6);

    void this.intro('Roll Out', 'Use the D-pad to roll Caius through the maze to the cube.').then(() => {
      this.active = true;
    });
  }

  /** True if Caius (a circle) can occupy (x, y) without hitting a wall or the edges. */
  private canMove(x: number, y: number): boolean {
    const pa = this.playArea;
    if (x < pa.x + CAIUS_RADIUS || x > pa.x + pa.w - CAIUS_RADIUS) return false;
    if (y < pa.y + CAIUS_RADIUS || y > pa.y + pa.h - CAIUS_RADIUS) return false;
    for (const wall of this.walls) {
      const closestX = Phaser.Math.Clamp(x, wall.cx - wall.w / 2, wall.cx + wall.w / 2);
      const closestY = Phaser.Math.Clamp(y, wall.cy - wall.h / 2, wall.cy + wall.h / 2);
      const ddx = x - closestX;
      const ddy = y - closestY;
      if (ddx * ddx + ddy * ddy < CAIUS_RADIUS * CAIUS_RADIUS) return false;
    }
    return true;
  }

  override update(_t: number, delta: number): void {
    if (!this.active) return;
    const v = this.controls.getVector();
    const step = SPEED * (delta / 1000);

    // Axis-separated so Caius slides along walls instead of sticking.
    let cx = this.caius.x;
    let cy = this.caius.y;
    const tryX = cx + v.x * step;
    if (this.canMove(tryX, cy)) cx = tryX;
    const tryY = cy + v.y * step;
    if (this.canMove(cx, tryY)) cy = tryY;
    this.caius.setPosition(cx, cy);

    // Reached the cube?
    const dx = cx - this.cube.x;
    const dy = cy - this.cube.y;
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
