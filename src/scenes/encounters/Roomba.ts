import Phaser from 'phaser';
import { EncounterBase } from './EncounterBase';
import { SpriteBank } from '../../systems/SpriteBank';
import { RetryPopup } from '../../ui/RetryPopup';
import { TouchControls } from '../../ui/TouchControls';

const DURATION_MS = 60_000;
const ROOMBA_SPEED = 75; // base roomba speed
// Difficulty: the roomba accelerates over the round (1x → RAMP_MAX). Starts easy, gets
// tense — but stays winnable on a first casual try. Tune here.
const ROOMBA_SPEED_RAMP_MAX = 1.9;
const CAIUS_SPEED = 130;

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
  private controls!: TouchControls;
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
  private retryPopup!: RetryPopup;

  constructor() {
    super('Roomba', 'roomba');
  }

  preload(): void {
    SpriteBank.preloadInto(this, ['caius', 'obj-portable-roomba']);
  }

  create(): void {
    this.setupEncounter();
    this.retryPopup = new RetryPopup(this);
    this.cameras.main.setBackgroundColor('#5b4530');
    // (No showLabel: its title/subtitle at y=60/86 collided with the timer/status texts.
    // The intro() pre-play gate already shows the title + instruction.)

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
    this.caius = this.add.container(this.caiusX, this.caiusY);
    this.caius.add(this.add.image(0, 0, 'caius').setDisplaySize(24, 24));

    // Roomba
    this.roomba = this.add.container(pa.x + 50, pa.y + pa.h - 50);
    const disc = this.add.image(0, 0, 'obj-portable-roomba').setDisplaySize(44, 44);
    this.roomba.add(disc);
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

    // D-pad movement (reactive — dodge the roomba while reaching the safe spots).
    this.controls = new TouchControls(this);

    void this.intro('Roomba!', 'Use the D-pad to scoot Caius to a safe spot — reach all three, dodge the roomba!').then(() => {
      this.startMs = this.time.now;
      this.active = true;
    });
  }

  private resetRound(): void {
    const pa = this.playArea;
    this.caiusX = pa.x + pa.w / 2;
    this.caiusY = pa.y + pa.h / 2;
    this.caius.setPosition(this.caiusX, this.caiusY);
    this.roomba.setPosition(pa.x + 50, pa.y + pa.h - 50);
    this.rvx = ROOMBA_SPEED;
    this.rvy = 0;
    this.reachedCount = 0;
    for (const z of this.zones) {
      z.reached = false;
      const ring = z.obj.list[0] as Phaser.GameObjects.Arc;
      ring.setFillStyle(0x4ade80, 0.4);
      z.obj.setScale(1);
    }
    this.statusText.setText('0 of 3 safe spots');
    this.startMs = this.time.now;
    this.active = true;
  }

  override update(_t: number, delta: number): void {
    if (!this.active) return;
    const dt = delta / 1000;

    // Move Caius with the D-pad
    const v = this.controls.getVector();
    if (v.x !== 0 || v.y !== 0) {
      this.caiusX = Phaser.Math.Clamp(this.caiusX + v.x * CAIUS_SPEED * dt, this.playArea.x + 16, this.playArea.x + this.playArea.w - 16);
      this.caiusY = Phaser.Math.Clamp(this.caiusY + v.y * CAIUS_SPEED * dt, this.playArea.y + 16, this.playArea.y + this.playArea.h - 16);
      this.caius.setPosition(this.caiusX, this.caiusY);
    }

    // Move roomba — ramps up to ROOMBA_SPEED_RAMP_MAX over the round.
    const ramp = 1 + (ROOMBA_SPEED_RAMP_MAX - 1) * Math.min(1, (this.time.now - this.startMs) / DURATION_MS);
    this.roomba.x += this.rvx * ramp * dt;
    this.roomba.y += this.rvy * ramp * dt;
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
      this.softFail('roomba-hit', 'The roomba got him!');
      this.retryPopup.show(() => this.resetRound(), 'The roomba got him! Try again!');
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
      this.softFail('timeout', 'Time!');
      this.retryPopup.show(() => this.resetRound(), "Time's up! Try again!");
    }
  }
}
