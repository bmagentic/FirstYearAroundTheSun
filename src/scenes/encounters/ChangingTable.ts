import Phaser from 'phaser';
import { EncounterBase } from './EncounterBase';

const SURVIVE_MS = 20_000;
const TILT_INTERVAL_MS = 1_400;
const SLIDE_SPEED = 60;
const RECOVERY_PUSH = 70;

export class ChangingTable extends EncounterBase {
  private caiusX = 0;
  private caius!: Phaser.GameObjects.Container;
  private table!: Phaser.GameObjects.Rectangle;
  private tableX = 0;
  private tableY = 0;
  private tableW = 280;
  private tilt = 0;
  private nextTiltAt = 0;
  private active = false;
  private startMs = 0;
  private timerText!: Phaser.GameObjects.Text;

  constructor() {
    super('ChangingTable', 'changing-table');
  }

  create(): void {
    this.setupEncounter();
    this.cameras.main.setBackgroundColor('#2a1410');
    this.showLabel('Changing Table', 'Tap the higher side to keep him centered');

    const W = this.scale.width;
    const H = this.scale.height;

    this.tableX = W / 2;
    this.tableY = H / 2;
    this.table = this.add.rectangle(this.tableX, this.tableY, this.tableW, 100, 0xc9a35d).setStrokeStyle(2, 0x6b4530);
    this.add.rectangle(this.tableX - 120, this.tableY + 90, 10, 90, 0x6b4530);
    this.add.rectangle(this.tableX + 120, this.tableY + 90, 10, 90, 0x6b4530);

    this.caiusX = this.tableX;
    this.caius = this.add.container(this.caiusX, this.tableY - 12);
    this.caius.add(this.add.circle(0, 0, 14, 0xf7c6a3).setStrokeStyle(2, 0x402c1d));

    this.timerText = this.add
      .text(W / 2, 60, '20', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '20px',
        color: '#fde68a',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!this.active) return;
      // Tap on side opposite to where he's leaning to push him back
      const left = p.x < this.scale.width / 2;
      this.caiusX += left ? RECOVERY_PUSH : -RECOVERY_PUSH;
    });

    this.startMs = this.time.now;
    this.nextTiltAt = this.time.now + 900;
    this.active = true;
  }

  override update(_t: number, delta: number): void {
    if (!this.active) return;
    if (this.time.now > this.nextTiltAt) {
      const dir = this.tilt >= 0 ? -1 : 1;
      this.tilt = dir * Phaser.Math.FloatBetween(0.6, 1.0);
      this.nextTiltAt = this.time.now + TILT_INTERVAL_MS;
      this.tweens.add({ targets: this.table, angle: this.tilt * 4, duration: 600, ease: 'Sine.easeInOut' });
    }
    const dt = delta / 1000;
    this.caiusX += -this.tilt * SLIDE_SPEED * dt;
    const minX = this.tableX - this.tableW / 2 + 18;
    const maxX = this.tableX + this.tableW / 2 - 18;
    if (this.caiusX < minX || this.caiusX > maxX) {
      this.active = false;
      this.softFail('rolled-off', 'Whoa! Catch him quicker.');
      this.time.delayedCall(900, () => this.scene.restart());
      return;
    }
    this.caius.setPosition(this.caiusX, this.tableY - 12);

    const elapsed = this.time.now - this.startMs;
    const remaining = Math.max(0, Math.ceil((SURVIVE_MS - elapsed) / 1000));
    this.timerText.setText(String(remaining));
    if (elapsed >= SURVIVE_MS) {
      this.active = false;
      this.completeEncounter();
    }
  }
}
