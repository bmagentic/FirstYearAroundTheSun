import Phaser from 'phaser';
import { ChapterBase } from './ChapterBase';
import { TouchControls } from '../../ui/TouchControls';

const WALKER_RADIUS = 14;
const SPEED = 130;
const DRIFT = 0.88;
const STAR_TIME_S = 90;

type Obstacle = { x: number; y: number; w: number; h: number };

export class Ch09_MazeWalker extends ChapterBase {
  private walker!: Phaser.GameObjects.Container;
  private controls!: TouchControls;
  private vx = 0;
  private vy = 0;
  private obstacles: Obstacle[] = [];
  private chelsea!: Phaser.GameObjects.Rectangle;
  private active = false;
  private startMs = 0;
  private timerText!: Phaser.GameObjects.Text;
  private playArea = { x: 24, y: 100, w: 0, h: 0 };

  constructor() {
    super('Ch09_MazeWalker', 9);
  }

  create(): void {
    this.setup();
    this.cameras.main.setBackgroundColor('#3a2515');

    const W = this.scale.width;
    const H = this.scale.height;
    this.playArea.w = W - 48;
    this.playArea.h = H - 280;

    // Floor
    this.add.rectangle(W / 2, this.playArea.y + this.playArea.h / 2, this.playArea.w, this.playArea.h, 0x8a6540);

    // Obstacle layout (cushions, ottoman, baskets, dog beds)
    const oa = this.playArea;
    this.obstacles = [
      { x: oa.x + 80, y: oa.y + 90, w: 90, h: 18 },
      { x: oa.x + 200, y: oa.y + 60, w: 18, h: 80 },
      { x: oa.x + 90, y: oa.y + 180, w: 18, h: 90 },
      { x: oa.x + 220, y: oa.y + 220, w: 90, h: 18 },
      { x: oa.x + 60, y: oa.y + 320, w: 80, h: 60 },
      { x: oa.x + 220, y: oa.y + 360, w: 18, h: 60 },
    ];
    for (const o of this.obstacles) {
      this.add.rectangle(o.x + o.w / 2, o.y + o.h / 2, o.w, o.h, 0x6e553f).setStrokeStyle(1, 0xfde68a, 0.4);
    }

    // Chelsea at end
    const chx = oa.x + oa.w - 50;
    const chy = oa.y + oa.h - 50;
    this.chelsea = this.add.rectangle(chx, chy, 40, 50, 0x7c5fb0).setStrokeStyle(2, 0xfde68a, 0.85);
    this.add
      .text(chx, chy - 36, 'Mama', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '10px',
        color: '#fde68a',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    // Walker at start
    this.walker = this.add.container(oa.x + 40, oa.y + 40);
    const body = this.add.circle(0, 0, WALKER_RADIUS, 0xf7c6a3).setStrokeStyle(2, 0x402c1d);
    // Walker frame
    const frame = this.add.rectangle(0, 8, 36, 12, 0xfde68a, 0.5).setStrokeStyle(1, 0x402c1d);
    this.walker.add([body, frame]);

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
      }
    }

    this.walker.setPosition(nx, ny);

    const elapsed = (this.time.now - this.startMs) / 1000;
    this.timerText.setText(`${elapsed.toFixed(1)}s`);

    // Reached Chelsea?
    if (
      Math.abs(nx - this.chelsea.x) < 30 &&
      Math.abs(ny - this.chelsea.y) < 36
    ) {
      this.active = false;
      const star = elapsed <= STAR_TIME_S;
      this.timerText.setText(star ? `★ ${elapsed.toFixed(1)}s` : `${elapsed.toFixed(1)}s`);
      const alreadyDone = this.profile.completedInterludes.includes('mama');
      this.tweens.add({
        targets: this.chelsea,
        scale: 1.15,
        duration: 300,
        yoyo: true,
        onComplete: () =>
          this.completeChapter(alreadyDone ? {} : { nextScene: 'Interlude02_Mama' }),
      });
    }
  }
}
