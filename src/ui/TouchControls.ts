import Phaser from 'phaser';

type Direction = 'up' | 'down' | 'left' | 'right';

export class TouchControls {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private vec = new Phaser.Math.Vector2(0, 0);
  private active: Set<Direction> = new Set();
  private keyW?: Phaser.Input.Keyboard.Key;
  private keyA?: Phaser.Input.Keyboard.Key;
  private keyS?: Phaser.Input.Keyboard.Key;
  private keyD?: Phaser.Input.Keyboard.Key;
  private cursorUp?: Phaser.Input.Keyboard.Key;
  private cursorDown?: Phaser.Input.Keyboard.Key;
  private cursorLeft?: Phaser.Input.Keyboard.Key;
  private cursorRight?: Phaser.Input.Keyboard.Key;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0).setDepth(1000).setScrollFactor(0);

    const baseX = 70;
    const baseY = scene.scale.height - 140;
    const r = 36;
    const offset = r + 4;

    const ring = scene.add.circle(baseX, baseY, r * 2.2, 0xffffff, 0.06).setStrokeStyle(2, 0xffffff, 0.15);
    this.container.add(ring);

    this.addPad('up', baseX, baseY - offset, r);
    this.addPad('down', baseX, baseY + offset, r);
    this.addPad('left', baseX - offset, baseY, r);
    this.addPad('right', baseX + offset, baseY, r);

    if (scene.input.keyboard) {
      // enableCapture=false: do NOT preventDefault these keys globally. Phaser's
      // keyboard manager listens on window, so capturing W/A/S/D would swallow them
      // from focused DOM inputs (e.g. the profile-name field). isDown is still tracked,
      // so in-game movement is unaffected.
      const kb = scene.input.keyboard;
      this.keyW = kb.addKey('W', false);
      this.keyA = kb.addKey('A', false);
      this.keyS = kb.addKey('S', false);
      this.keyD = kb.addKey('D', false);
      this.cursorUp = kb.addKey('UP', false);
      this.cursorDown = kb.addKey('DOWN', false);
      this.cursorLeft = kb.addKey('LEFT', false);
      this.cursorRight = kb.addKey('RIGHT', false);
    }
  }

  private addPad(dir: Direction, x: number, y: number, r: number): void {
    const pad = this.scene.add
      .circle(x, y, r, 0xfde68a, 0.18)
      .setStrokeStyle(2, 0xfde68a, 0.5);

    const glyph = this.scene.add
      .text(x, y, this.arrowFor(dir), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '24px',
        color: '#fde68a',
      })
      .setOrigin(0.5);

    pad.setInteractive({ useHandCursor: true });
    pad.on('pointerdown', () => {
      this.active.add(dir);
      pad.fillAlpha = 0.4;
    });
    const release = () => {
      this.active.delete(dir);
      pad.fillAlpha = 0.18;
    };
    pad.on('pointerup', release);
    pad.on('pointerout', release);
    pad.on('pointerupoutside', release);

    this.container.add([pad, glyph]);
  }

  private arrowFor(dir: Direction): string {
    return { up: '↑', down: '↓', left: '←', right: '→' }[dir];
  }

  setVisible(visible: boolean): void {
    this.container.setVisible(visible);
  }

  /** Returns a unit-ish vector in [-1, 1] for x and y. */
  getVector(): Phaser.Math.Vector2 {
    // Keyboard
    const kbUp = this.keyW?.isDown || this.cursorUp?.isDown;
    const kbDown = this.keyS?.isDown || this.cursorDown?.isDown;
    const kbLeft = this.keyA?.isDown || this.cursorLeft?.isDown;
    const kbRight = this.keyD?.isDown || this.cursorRight?.isDown;

    let x = 0;
    let y = 0;
    if (this.active.has('up') || kbUp) y -= 1;
    if (this.active.has('down') || kbDown) y += 1;
    if (this.active.has('left') || kbLeft) x -= 1;
    if (this.active.has('right') || kbRight) x += 1;
    this.vec.set(x, y);
    if (this.vec.lengthSq() > 0) this.vec.normalize();
    return this.vec;
  }

  destroy(): void {
    this.container.destroy();
  }
}
