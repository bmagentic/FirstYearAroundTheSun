import Phaser from 'phaser';
import { EncounterBase } from './EncounterBase';
import { SpriteBank } from '../../systems/SpriteBank';
import { RetryPopup } from '../../ui/RetryPopup';

const SURVIVE_MS = 20_000;
const TILT_INTERVAL_MS = 1_400;
const SLIDE_SPEED = 60;
const RECOVERY_PUSH = 70;

export class ChangingTable extends EncounterBase {
  private caiusX = 0;
  private caius!: Phaser.GameObjects.Container;
  private table!: Phaser.GameObjects.Image;
  private tableX = 0;
  private tableY = 0;
  private tableW = 280;
  private tilt = 0;
  private nextTiltAt = 0;
  private active = false;
  private startMs = 0;
  private timerText!: Phaser.GameObjects.Text;
  private retryPopup!: RetryPopup;

  constructor() {
    super('ChangingTable', 'changing-table');
  }

  preload(): void {
    SpriteBank.preloadInto(this, ['caius', 'obj-master-changingtable']);
  }

  create(): void {
    this.setupEncounter();
    this.retryPopup = new RetryPopup(this);
    this.cameras.main.setBackgroundColor('#2a1410');
    this.showLabel('Changing Table', 'Tap the higher side to keep him centered');

    const W = this.scale.width;
    const H = this.scale.height;

    this.tableX = W / 2;
    this.tableY = H / 2;
    this.table = this.add.image(this.tableX, this.tableY, 'obj-master-changingtable').setDisplaySize(this.tableW, 100);
    this.add.rectangle(this.tableX - 120, this.tableY + 90, 10, 90, 0x6b4530);
    this.add.rectangle(this.tableX + 120, this.tableY + 90, 10, 90, 0x6b4530);

    this.caiusX = this.tableX;
    this.caius = this.add.container(this.caiusX, this.tableY - 12);
    this.caius.add(this.add.image(0, 0, 'caius').setDisplaySize(28, 28));

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

    void this.intro('Changing Table', 'Tap the higher side to keep him from rolling off!').then(() => {
      this.startMs = this.time.now;
      this.nextTiltAt = this.time.now + 900;
      this.active = true;
    });
  }

  private resetRound(): void {
    this.caiusX = this.tableX;
    this.caius.setPosition(this.caiusX, this.tableY - 12);
    this.tilt = 0;
    this.tweens.add({ targets: this.table, angle: 0, duration: 200 });
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
      this.retryPopup.show(() => this.resetRound(), 'Whoa! Catch him quicker!');
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
