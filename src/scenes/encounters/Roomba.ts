import Phaser from 'phaser';
import { EncounterBase } from './EncounterBase';

const DURATION_MS = 60_000;
const ROOMBA_SPEED = 75;
const CAIUS_SPEED = 110;

type SafeZone = {
  x: number;
  y: number;
  r: number;
  label: string;
  reached: boolean;
  obj: Phaser.GameObjects.Container;
};

export class Roomba extends EncounterBase {
  private caius!: Phaser.GameObjects.Container;
  private caiusX = 0;
  private caiusY = 0;
  private targetX = 0;
  private targetY = 0;
  private roomba!: Phaser.GameObjects.Container;
  private rvx = ROOMBA_SPEED;
  private rvy = 0;
  private playArea = { x: 30, y: 110, w: 0, h: 0 };
  private zones: SafeZone[] = [];
  private reachedCount = 0;
  private active = false;
  private startMs = 0;
  private timerText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;

  constructor() {
    super('Roomba', 'roomba');
  }

  create(): void {
    this.setupEncounter();
    this.cameras.main.setBackgroundColor('#5b4530');
    this.showLabel('Roomba!', 'Tap to move. Reach 3 safe spots.');

    const W = this.scale.width;
    const H = this.scale.height;
    this.playArea.w = W - 60;
    this.playArea.h = H - 280;
    this.add.rectangle(W / 2, this.playArea.y + this.playArea.h / 2, this.playArea.w, this.playArea.h, 0x7a5e44);

    // Safe zones
    const pa = this.playArea;
    const zoneDefs = [
      { x: pa.x + 60, y: pa.y + 60, label: 'under table' },
      { x: pa.x + pa.w - 60, y: pa.y + 60, label: 'dog bed' },
      { x: pa.x + pa.w / 2, y: pa.y + pa.h - 70, label: 'behind couch' },
    ];
    for (const def of zoneDefs) {
      const c = this.add.container(def.x, def.y);
      const ring = this.add.circle(0, 0, 30, 0x4ade80, 0.4).setStrokeStyle(2, 0x4ade80, 0.85);
      const lbl = this.add
        .text(0, 38, def.label, {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '9px',
          color: '#fde68a',
          fontStyle: 'bold',
        })
        .setOrigin(0.5);
      c.add([ring, lbl]);
      this.zones.push({ x: def.x, y: def.y, r: 30, label: def.label, reached: false, obj: c });
    }

    // Caius
    this.caiusX = pa.x + pa.w / 2;
    this.caiusY = pa.y + pa.h / 2;
    this.targetX = this.caiusX;
    this.targetY = this.caiusY;
    this.caius = this.add.container(this.caiusX, this.caiusY);
    this.caius.add(this.add.circle(0, 0, 12, 0xf7c6a3).setStrokeStyle(2, 0x402c1d));

    // Roomba
    this.roomba = this.add.container(pa.x + 50, pa.y + pa.h - 50);
    const disc = this.add.circle(0, 0, 22, 0x222222).setStrokeStyle(2, 0x666666);
    const sensor = this.add.circle(0, -16, 4, 0xfde68a);
    this.roomba.add([disc, sensor]);
    this.tweens.add({ targets: disc, angle: 360, duration: 1200, repeat: -1 });

    this.timerText = this.add
      .text(W / 2, 60, '60', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '18px',
        color: '#fde68a',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.statusText = this.add
      .text(W / 2, 86, '0 of 3 safe spots', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '11px',
        color: '#fde68a',
      })
      .setOrigin(0.5);

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!this.active) return;
      // Only respond to taps inside play area
      if (
        p.x >= pa.x &&
        p.x <= pa.x + pa.w &&
        p.y >= pa.y &&
        p.y <= pa.y + pa.h
      ) {
        this.targetX = p.x;
        this.targetY = p.y;
      }
    });

    this.startMs = this.time.now;
    this.active = true;
  }

  override update(_t: number, delta: number): void {
    if (!this.active) return;
    const dt = delta / 1000;

    // Move Caius toward target
    const dx = this.targetX - this.caiusX;
    const dy = this.targetY - this.caiusY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 2) {
      const step = Math.min(dist, CAIUS_SPEED * dt);
      this.caiusX += (dx / dist) * step;
      this.caiusY += (dy / dist) * step;
      this.caius.setPosition(this.caiusX, this.caiusY);
    }

    // Move roomba
    this.roomba.x += this.rvx * dt;
    this.roomba.y += this.rvy * dt;
    // Bounce off play area
    const minX = this.playArea.x + 22;
    const maxX = this.playArea.x + this.playArea.w - 22;
    const minY = this.playArea.y + 22;
    const maxY = this.playArea.y + this.playArea.h - 22;
    if (this.roomba.x < minX || this.roomba.x > maxX) {
      this.rvx = -this.rvx;
      // Occasionally turn perpendicular
      if (Math.random() < 0.4) {
        this.rvy = (Math.random() < 0.5 ? -1 : 1) * ROOMBA_SPEED * 0.7;
      }
    }
    if (this.roomba.y < minY || this.roomba.y > maxY) {
      this.rvy = -this.rvy;
      if (Math.random() < 0.4) {
        this.rvx = (Math.random() < 0.5 ? -1 : 1) * ROOMBA_SPEED * 0.7;
      }
    }
    this.roomba.x = Phaser.Math.Clamp(this.roomba.x, minX, maxX);
    this.roomba.y = Phaser.Math.Clamp(this.roomba.y, minY, maxY);

    // Roomba hit Caius?
    const rdx = this.roomba.x - this.caiusX;
    const rdy = this.roomba.y - this.caiusY;
    if (rdx * rdx + rdy * rdy < 30 * 30) {
      this.active = false;
      this.softFail('roomba-hit', 'The roomba got him! Try again.');
      this.time.delayedCall(900, () => this.scene.restart());
      return;
    }

    // Reach safe zone
    for (const z of this.zones) {
      if (z.reached) continue;
      const ddx = this.caiusX - z.x;
      const ddy = this.caiusY - z.y;
      if (ddx * ddx + ddy * ddy < (z.r + 4) * (z.r + 4)) {
        z.reached = true;
        this.reachedCount++;
        this.statusText.setText(`${this.reachedCount} of 3 safe spots`);
        const ring = z.obj.list[0] as Phaser.GameObjects.Arc;
        ring.setFillStyle(0xfde68a, 0.7);
        this.tweens.add({ targets: z.obj, scale: 1.2, duration: 200, yoyo: true });
      }
    }
    if (this.reachedCount >= 3) {
      this.active = false;
      this.completeEncounter();
      return;
    }

    // Timer
    const remaining = Math.max(0, DURATION_MS - (this.time.now - this.startMs));
    this.timerText.setText(String(Math.ceil(remaining / 1000)));
    if (remaining <= 0) {
      this.active = false;
      this.softFail('timeout', 'Time! Try again.');
      this.time.delayedCall(900, () => this.scene.restart());
    }
  }
}
