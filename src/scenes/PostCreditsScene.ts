import Phaser from 'phaser';
import { SaveManager } from '../systems/SaveManager';
import { SoundBank } from '../systems/SoundBank';
import { SpriteBank } from '../systems/SpriteBank';
import { track } from '../systems/Analytics';
import type { SaveProfile } from '../types';

const PHASE_TIMES = {
  spacePullback: 4500,
  orbit: 7500,
  duckieGlow: 3500,
  landing: 3500,
  doorwayLinger: 3500,
  familyPour: 2500,
  titleCard: 4000,
  creditsRoll: 6500,
  madeByDad: 3500,
  dedication: 6000,
};

export class PostCreditsScene extends Phaser.Scene {
  private profile: SaveProfile | null = null;

  constructor() {
    super({ key: 'PostCreditsScene' });
  }

  init(data: { profile?: SaveProfile }): void {
    this.profile = data?.profile ?? SaveManager.getActiveProfile();
    if (this.profile) {
      track('game_completed', {
        profile_name: this.profile.name,
        total_play_time_seconds: this.profile.totalPlayTimeSeconds,
      });
    }
  }

  preload(): void {
    SpriteBank.preloadInto(this, ['obj-garage-rocket-ready']);
    SoundBank.preload('rocket-launch');
    SoundBank.preload('lullaby');
    SoundBank.preload('caius-laugh');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#02030a');
    this.cameras.main.fadeIn(900, 0, 0, 0);
    this.runSequence().catch((err) => {
      console.error('[post-credits] sequence error:', err);
      this.scene.start('HouseScene', { profile: SaveManager.getActiveProfile() });
    });
  }

  private async runSequence(): Promise<void> {
    await this.phaseSpacePullback();
    await this.phaseOrbit();
    await this.phaseLanding();
    await this.phaseDoorwayMoment();
    await this.phaseFamilyPour();
    await this.phaseTitleCard();
    await this.phaseCreditsRoll();
    await this.phaseMadeByDad();
    await this.phaseDedication();
    this.scene.start('HouseScene', { profile: SaveManager.getActiveProfile() });
  }

  // Phase 1: rocket exits atmosphere, camera pulls back, Earth visible
  private async phaseSpacePullback(): Promise<void> {
    const W = this.scale.width;
    const H = this.scale.height;
    const stars = this.spawnStars(60);
    const earth = this.add.circle(W / 2, H + 40, 220, 0x4a7ab8).setStrokeStyle(3, 0x6b8eb6, 0.85);
    const earthHighlight = this.add.circle(W / 2 - 50, H, 220, 0x9ec3e6, 0.3);
    const rocket = this.drawRocket(W / 2, H - 220);

    SoundBank.play('rocket-launch');

    await this.tween({
      targets: [earth, earthHighlight],
      y: '+=160',
      duration: PHASE_TIMES.spacePullback,
      ease: 'Sine.easeInOut',
    });
    await this.tween({
      targets: rocket,
      y: H * 0.35,
      scale: 0.55,
      duration: PHASE_TIMES.spacePullback,
      ease: 'Sine.easeOut',
    });

    // Keep stars + earth + rocket for next phase
    void stars;
  }

  // Phase 2: orbital arc + Duckie constellation
  private async phaseOrbit(): Promise<void> {
    const W = this.scale.width;
    const H = this.scale.height;
    const sun = this.add.circle(W + 80, H / 2 - 40, 90, 0xfde68a, 0.9).setStrokeStyle(8, 0xfbbf24, 0.5);
    this.tweens.add({
      targets: sun,
      scale: 1.06,
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Wait briefly, then form Duckie
    await this.delay(PHASE_TIMES.orbit * 0.45);

    const duckie = this.spawnDuckieConstellation();
    // Glow
    await this.tween({
      targets: duckie,
      alpha: 1,
      duration: PHASE_TIMES.duckieGlow * 0.3,
      ease: 'Sine.easeIn',
    });
    await this.delay(PHASE_TIMES.duckieGlow * 0.5);

    const label = this.add
      .text(W / 2, H * 0.78, 'Duckie says hi.', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '13px',
        color: '#fde68a',
        fontStyle: 'italic',
      })
      .setOrigin(0.5)
      .setAlpha(0);
    await this.tween({ targets: label, alpha: 1, duration: 600 });
    await this.delay(1400);
    await this.tween({ targets: [duckie, label], alpha: 0, duration: 800 });
    duckie.destroy();
    label.destroy();
    sun.destroy();
  }

  // Phase 3: rocket lands in backyard
  private async phaseLanding(): Promise<void> {
    await this.fadeOutTo(0x6b8e5a, 700);
    this.cameras.main.setBackgroundColor('#6b8e5a');

    const W = this.scale.width;
    const H = this.scale.height;
    // Backyard
    this.add.rectangle(W / 2, H * 0.75, W, H * 0.5, 0x6b8e5a);
    // House silhouette in background
    this.add.rectangle(W / 2, H * 0.35, W * 0.7, H * 0.35, 0xc4a86a).setStrokeStyle(2, 0x6b4530);
    this.add.triangle(W / 2, H * 0.18, -W * 0.4, 50, W * 0.4, 50, 0, -40, 0x8a5a3a);

    const rocket = this.drawRocket(W * 0.3, -120);
    rocket.setScale(0.4);

    await this.fadeInFrom(0x6b8e5a, 700);
    await this.tween({
      targets: rocket,
      y: H * 0.62,
      duration: PHASE_TIMES.landing,
      ease: 'Sine.easeIn',
    });
    // Puff
    const puff = this.add.circle(W * 0.3, H * 0.7, 24, 0xfff3c7, 0.85);
    await this.tween({ targets: puff, scale: 2.5, alpha: 0, duration: 700 });
    puff.destroy();
  }

  // Phase 4: Chelsea alone in doorway for 3 sec
  private async phaseDoorwayMoment(): Promise<void> {
    const W = this.scale.width;
    const H = this.scale.height;

    // Doorway
    const door = this.add.rectangle(W / 2 + 80, H * 0.4, 60, 130, 0x3a2a1a).setStrokeStyle(3, 0x6b4530);
    void door;
    const doorGlow = this.add.rectangle(W / 2 + 80, H * 0.4, 56, 126, 0xfde68a, 0.35);
    this.tweens.add({
      targets: doorGlow,
      alpha: 0.55,
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Chelsea standing alone
    const chelsea = this.add.container(W / 2 + 80, H * 0.45);
    const torso = this.add.rectangle(0, 0, 28, 56, 0x7c5fb0).setStrokeStyle(2, 0xfde68a, 0.9);
    const head = this.add.circle(0, -38, 14, 0xf5c7a3).setStrokeStyle(2, 0x6b4530);
    chelsea.add([torso, head]);
    chelsea.setAlpha(0);
    await this.tween({ targets: chelsea, alpha: 1, duration: 700 });

    const caption = this.add
      .text(W / 2, H - 110, 'She\'s the first one he sees.', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        color: '#fde68a',
        fontStyle: 'italic',
      })
      .setOrigin(0.5)
      .setAlpha(0);
    await this.tween({ targets: caption, alpha: 1, duration: 600 });

    SoundBank.play('caius-laugh');
    await this.delay(PHASE_TIMES.doorwayLinger);
    await this.tween({ targets: caption, alpha: 0, duration: 500 });
    caption.destroy();
  }

  // Phase 5: family pours out behind her
  private async phaseFamilyPour(): Promise<void> {
    const W = this.scale.width;
    const H = this.scale.height;
    const positions = [
      { x: W / 2 + 130, y: H * 0.5, color: 0x4f6a3d, label: 'Dad' },
      { x: W / 2 + 30, y: H * 0.52, color: 0x8b5a2a, label: 'Finn' },
      { x: W / 2 + 160, y: H * 0.55, color: 0xc9a35d, label: 'Nugget' },
      { x: W / 2 + 50, y: H * 0.56, color: 0xa67449, label: 'Eevee' },
      { x: W / 2 + 110, y: H * 0.58, color: 0xe6e6e6, label: 'Soka' },
    ];
    const figures: Phaser.GameObjects.Container[] = [];
    for (const p of positions) {
      const f = this.add.container(W / 2 + 80, H * 0.4); // Start from doorway
      const r = this.add.rectangle(0, 0, 20, 30, p.color).setStrokeStyle(1, 0xfde68a, 0.8);
      const lbl = this.add
        .text(0, 22, p.label, {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '8px',
          color: '#fde68a',
          fontStyle: 'bold',
        })
        .setOrigin(0.5);
      f.add([r, lbl]);
      f.setAlpha(0);
      figures.push(f);
      this.tweens.add({
        targets: f,
        x: p.x,
        y: p.y,
        alpha: 1,
        duration: 700,
        delay: Math.random() * 400,
        ease: 'Sine.easeOut',
      });
    }
    await this.delay(PHASE_TIMES.familyPour);
  }

  // Phase 6: Big title
  private async phaseTitleCard(): Promise<void> {
    await this.fadeOutTo(0x050409, 800);
    this.cameras.main.setBackgroundColor('#050409');
    await this.fadeInFrom(0x050409, 600);

    const title = this.add
      .text(this.scale.width / 2, this.scale.height / 2 - 20, 'Caius, one year around the sun.', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '20px',
        color: '#fde68a',
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: this.scale.width - 60 },
      })
      .setOrigin(0.5)
      .setAlpha(0);
    const sub = this.add
      .text(this.scale.width / 2, this.scale.height / 2 + 24, 'Happy birthday.', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '16px',
        color: '#fef3c7',
      })
      .setOrigin(0.5)
      .setAlpha(0);

    await this.tween({ targets: title, alpha: 1, duration: 800 });
    await this.tween({ targets: sub, alpha: 1, duration: 600 });
    await this.delay(PHASE_TIMES.titleCard);
    await this.tween({ targets: [title, sub], alpha: 0, duration: 700 });
    title.destroy();
    sub.destroy();
  }

  // Phase 7: credits roll
  private async phaseCreditsRoll(): Promise<void> {
    const W = this.scale.width;
    const H = this.scale.height;
    const lines = [
      'A pixel love letter for Caius',
      '',
      'Mechanics, code, words',
      'by Dad',
      '',
      'Care, patience, lullabies',
      'by Mama',
      '',
      'Companions',
      'Finn · Nugget · Eevee · Soka',
      '',
      'And one little dude',
      'Caius',
    ];
    const roll = this.add.container(W / 2, H + 40);
    lines.forEach((line, i) => {
      roll.add(
        this.add
          .text(0, i * 26, line, {
            fontFamily: 'system-ui, sans-serif',
            fontSize: '13px',
            color: '#fde68a',
            align: 'center',
            fontStyle: line.startsWith('by') ? 'bold' : 'normal',
          })
          .setOrigin(0.5),
      );
    });
    SoundBank.play('lullaby');
    await this.tween({
      targets: roll,
      y: -lines.length * 26 - 40,
      duration: PHASE_TIMES.creditsRoll,
      ease: 'Linear',
    });
    roll.destroy();
  }

  // Phase 8
  private async phaseMadeByDad(): Promise<void> {
    const t = this.add
      .text(this.scale.width / 2, this.scale.height / 2, 'Made with love by Dad.', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '17px',
        color: '#fde68a',
        fontStyle: 'italic',
      })
      .setOrigin(0.5)
      .setAlpha(0);
    await this.tween({ targets: t, alpha: 1, duration: 900 });
    await this.delay(PHASE_TIMES.madeByDad);
    await this.tween({ targets: t, alpha: 0, duration: 700 });
    t.destroy();
  }

  // Phase 9: dedication
  private async phaseDedication(): Promise<void> {
    const W = this.scale.width;
    const H = this.scale.height;
    const heading = this.add
      .text(W / 2, H / 2 - 30, 'For Chelsea,', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '20px',
        color: '#fde68a',
        fontStyle: 'bold',
        align: 'center',
      })
      .setOrigin(0.5)
      .setAlpha(0);
    const body = this.add
      .text(W / 2, H / 2 + 10, 'who made all of this possible.', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '15px',
        color: '#fef3c7',
        align: 'center',
        wordWrap: { width: W - 60 },
      })
      .setOrigin(0.5)
      .setAlpha(0);
    const sig = this.add
      .text(W / 2, H / 2 + 56, 'He knows. We both know.', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '13px',
        color: '#fde68a',
        fontStyle: 'italic',
        align: 'center',
      })
      .setOrigin(0.5)
      .setAlpha(0);

    await this.tween({ targets: heading, alpha: 1, duration: 900 });
    await this.tween({ targets: body, alpha: 1, duration: 900 });
    await this.tween({ targets: sig, alpha: 1, duration: 1100 });
    await this.delay(PHASE_TIMES.dedication);
  }

  // ---- helpers ----

  private drawRocket(x: number, y: number): Phaser.GameObjects.Container {
    const c = this.add.container(x, y);
    const flame = this.add.triangle(0, 76, -10, 0, 10, 0, 0, 28, 0xfb923c).setAlpha(0.7);
    this.tweens.add({ targets: flame, scaleY: 1.5, alpha: 0.4, duration: 220, yoyo: true, repeat: -1 });

    if (SpriteBank.has(this, 'obj-garage-rocket-ready')) {
      const img = this.add.image(0, 0, 'obj-garage-rocket-ready').setDisplaySize(96, 128);
      c.add([flame, img]);
    } else {
      const body = this.add.rectangle(0, 0, 28, 100, 0xd4d4d4).setStrokeStyle(1, 0x999999);
      c.add([flame, body]);
    }
    return c;
  }

  private spawnStars(count: number): Phaser.GameObjects.Arc[] {
    const stars: Phaser.GameObjects.Arc[] = [];
    for (let i = 0; i < count; i++) {
      const x = Phaser.Math.Between(0, this.scale.width);
      const y = Phaser.Math.Between(0, this.scale.height * 0.7);
      const r = Phaser.Math.Between(1, 2);
      const s = this.add.circle(x, y, r, 0xffffff, Phaser.Math.FloatBetween(0.3, 0.95));
      this.tweens.add({
        targets: s,
        alpha: 0.2,
        duration: Phaser.Math.Between(1200, 2400),
        yoyo: true,
        repeat: -1,
        delay: Phaser.Math.Between(0, 1500),
      });
      stars.push(s);
    }
    return stars;
  }

  private spawnDuckieConstellation(): Phaser.GameObjects.Container {
    const c = this.add.container(this.scale.width * 0.5, this.scale.height * 0.45);
    // Approximate duckie shape with dots
    const points: Array<[number, number]> = [
      [-30, -20], [-22, -32], [-8, -36], [8, -28], // head
      [-26, -2], [-10, 0], [10, 0], [30, -4], // body top
      [-20, 18], [-2, 22], [16, 20], [32, 12], // body bottom
      [42, -8], // tail
      [-36, -22], [22, -34], // beak
    ];
    for (const [px, py] of points) {
      const dot = this.add.circle(px, py, 2.4, 0xfde68a, 1);
      c.add(dot);
    }
    // Connecting halo glow
    const halo = this.add.circle(0, 0, 60, 0xfde68a, 0.15);
    c.add(halo);
    c.setAlpha(0);
    return c;
  }

  private async fadeOutTo(color: number, ms: number): Promise<void> {
    return new Promise((res) => {
      this.cameras.main.fadeOut(ms, (color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => res());
    });
  }

  private async fadeInFrom(color: number, ms: number): Promise<void> {
    return new Promise((res) => {
      this.cameras.main.fadeIn(ms, (color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_IN_COMPLETE, () => res());
    });
  }

  private tween(config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return new Promise((res) => {
      this.tweens.add({ ...config, onComplete: () => res() });
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((res) => this.time.delayedCall(ms, () => res()));
  }
}
