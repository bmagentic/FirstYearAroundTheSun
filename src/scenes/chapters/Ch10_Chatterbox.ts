import Phaser from 'phaser';
import { ChapterBase } from './ChapterBase';
import { SaveManager } from '../../systems/SaveManager';
import { SpriteBank } from '../../systems/SpriteBank';
import { track } from '../../systems/Analytics';
import { RetryPopup } from '../../ui/RetryPopup';
import type { Nickname } from '../../types';

type Target = {
  id: string;
  label: string;
  color: number;
  spriteKey: string;
  x: number;
  y: number;
  container: Phaser.GameObjects.Container;
};

type BubbleKind = 'base' | 'nickname';

type BubbleDef = {
  word: string;
  kind: BubbleKind;
  targetId?: string; // for base words
  nickname?: Nickname; // for nicknames
};

type Bubble = {
  def: BubbleDef;
  container: Phaser.GameObjects.Container;
  alive: boolean;
};

const BASE_BUBBLES: BubbleDef[] = [
  { word: 'mama', kind: 'base', targetId: 'mama' },
  { word: 'dada', kind: 'base', targetId: 'dada' },
  { word: 'Finn', kind: 'base', targetId: 'finn' },
  { word: 'Nugget', kind: 'base', targetId: 'nugget' },
  { word: 'Eevee', kind: 'base', targetId: 'eevee' },
  { word: 'Soka', kind: 'base', targetId: 'soka' },
];

const NICKNAME_BUBBLES: BubbleDef[] = [
  { word: 'bubbaman', kind: 'nickname', nickname: 'bubbaman' },
  { word: 'pumpkin head', kind: 'nickname', nickname: 'pumpkin-head' },
  { word: 'bing bot', kind: 'nickname', nickname: 'bing-bot' },
  { word: 'McButtersworth', kind: 'nickname', nickname: 'caius-mcbuttersworth' },
  { word: 'super baby', kind: 'nickname', nickname: 'super-baby' },
];

const TARGET_DEFS: Array<{ id: string; label: string; color: number; spriteKey: string }> = [
  { id: 'mama', label: 'Mama', color: 0xa855f7, spriteKey: 'chelsea-idle' },
  { id: 'dada', label: 'Dad', color: 0x4f6a3d, spriteKey: 'brandon-idle' },
  { id: 'finn', label: 'Finn', color: 0x6b3a1a, spriteKey: 'finn-south' },
  { id: 'nugget', label: 'Nugget', color: 0xc9a35d, spriteKey: 'nugget-south' },
  { id: 'eevee', label: 'Eevee', color: 0xa67449, spriteKey: 'eevee-south' },
  { id: 'soka', label: 'Soka', color: 0xe6e6e6, spriteKey: 'soka-south' },
];

const WIN_TOTAL = 15; // total correct matches
const MAX_MISSES = 5; // wrong pairings + escaped base words
const SPAWN_INTERVAL_MS = 1400;
const TARGET_SPRITE_H = 54;
const BRUTUS_TAPS_NEEDED = 5;

export class Ch10_Chatterbox extends ChapterBase {
  private targets: Target[] = [];
  private bubbles: Bubble[] = [];
  private spawnQueue: BubbleDef[] = [];
  private nextSpawnAt = 0;
  private selected: Bubble | null = null;
  private matchedCount = 0;
  private misses = 0;
  private collectedNicknames = new Set<Nickname>();
  private active = false;
  private statusText!: Phaser.GameObjects.Text;
  private hearts: Phaser.GameObjects.Image[] = [];
  private nicknameText!: Phaser.GameObjects.Text;

  private retryPopup!: RetryPopup;

  // Brutus secret
  private brutusSpeck: Phaser.GameObjects.Arc | null = null;
  private brutusTaps = 0;

  constructor() {
    super('Ch10_Chatterbox', 10);
  }

  preload(): void {
    SpriteBank.preloadInto(this, [
      'chelsea-idle',
      'brandon-idle',
      'finn-south',
      'nugget-south',
      'eevee-south',
      'soka-south',
      'emote-heart',
    ]);
  }

  create(): void {
    this.setup();
    this.retryPopup = new RetryPopup(this);
    this.cameras.main.setBackgroundColor('#1f140e');

    const W = this.scale.width;
    const H = this.scale.height;

    // Targets row — sprites with a name label underneath each.
    const spacing = (W - 40) / TARGET_DEFS.length;
    TARGET_DEFS.forEach((def, i) => {
      const x = 20 + spacing / 2 + i * spacing;
      const y = 140;
      const container = this.add.container(x, y);

      if (SpriteBank.has(this, def.spriteKey)) {
        const img = this.add.image(0, -8, def.spriteKey);
        img.setScale(TARGET_SPRITE_H / img.height);
        container.add(img);
      } else {
        // Fallback to the original colored box if a sprite is missing.
        container.add(
          this.add.rectangle(0, -8, spacing - 8, TARGET_SPRITE_H, def.color).setStrokeStyle(2, 0xfde68a, 0.6),
        );
      }

      container.add(
        this.add
          .text(0, 28, def.label, {
            fontFamily: 'system-ui, sans-serif',
            fontSize: '11px',
            color: '#fde68a',
            fontStyle: 'bold',
          })
          .setOrigin(0.5),
      );

      // Invisible hit-area, never smaller than the original colored box.
      const hitW = Math.max(spacing - 4, 56);
      const zone = this.add
        .zone(x, y, hitW, 86)
        .setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => this.handleTargetTap(def.id));

      this.targets.push({ ...def, x, y, container });
    });

    this.statusText = this.add
      .text(W / 2, 48, `Matched: 0/${WIN_TOTAL}`, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '15px',
        color: '#fde68a',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    // Lives = a row of emote-heart sprites (full = life left, dim = lost).
    const HEART_GAP = 24;
    this.hearts = [];
    for (let i = 0; i < MAX_MISSES; i++) {
      const hx = W / 2 + (i - (MAX_MISSES - 1) / 2) * HEART_GAP;
      this.hearts.push(this.add.image(hx, 72, 'emote-heart').setDisplaySize(20, 20));
    }
    this.updateHearts();

    this.nicknameText = this.add
      .text(W / 2, 94, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '11px',
        color: '#fbbf24',
        fontStyle: 'italic',
      })
      .setOrigin(0.5);

    this.add
      .text(W / 2, H - 60, 'Tap a word, then tap the matching person/dog above.', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '11px',
        color: '#fde68a',
        align: 'center',
        wordWrap: { width: W - 40 },
      })
      .setOrigin(0.5)
      .setAlpha(0.55);

    this.refillQueue();

    void this.intro('Chatterbox', 'Match each word to the right family member or dog.').then(() => {
      this.active = true;
      this.nextSpawnAt = this.time.now + 600;
    });
  }

  override update(_t: number, delta: number): void {
    if (!this.active) return;

    if (this.time.now >= this.nextSpawnAt) {
      if (this.spawnQueue.length === 0) this.refillQueue();
      const next = this.spawnQueue.shift();
      if (next) this.spawnBubble(next);
      this.nextSpawnAt = this.time.now + SPAWN_INTERVAL_MS;
    }

    const dt = delta / 1000;
    for (const b of this.bubbles) {
      if (!b.alive) continue;
      b.container.y -= 30 * dt;
      if (b.container.y < 180) {
        b.alive = false;
        this.tweens.add({ targets: b.container, alpha: 0, duration: 200, onComplete: () => b.container.destroy() });
        // An escaped base word counts as a miss; escaped nicknames are just lost collectibles.
        if (b.def.kind === 'base') {
          if (this.selected === b) this.selected = null;
          this.registerMiss('escaped-bubble');
        }
      }
    }
    this.bubbles = this.bubbles.filter((b) => b.alive);
  }

  /** Refills the spawn bag: all six base words cycle continuously; uncollected nicknames mix in. */
  private refillQueue(): void {
    const bag: BubbleDef[] = [...BASE_BUBBLES];
    for (const n of NICKNAME_BUBBLES) {
      if (n.nickname && !this.collectedNicknames.has(n.nickname)) bag.push(n);
    }
    Phaser.Utils.Array.Shuffle(bag);
    this.spawnQueue = bag;
  }

  private spawnBubble(def: BubbleDef): void {
    const W = this.scale.width;
    const H = this.scale.height;
    const x = Phaser.Math.Between(60, W - 60);
    const y = H - 100;

    const c = this.add.container(x, y);
    const isNick = def.kind === 'nickname';
    const ring = this.add
      .circle(0, 0, 36, isNick ? 0xfbbf24 : 0xfde68a, isNick ? 0.6 : 0.25)
      .setStrokeStyle(2, isNick ? 0xfbbf24 : 0xfde68a, 0.85);
    const lbl = this.add
      .text(0, 0, def.word, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '11px',
        color: isNick ? '#1c1410' : '#fde68a',
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: 60 },
      })
      .setOrigin(0.5);
    c.add([ring, lbl]);
    ring.setInteractive({ useHandCursor: true });
    const bubble: Bubble = { def, container: c, alive: true };
    ring.on('pointerdown', () => this.handleBubbleTap(bubble));
    this.bubbles.push(bubble);
  }

  private handleBubbleTap(bubble: Bubble): void {
    if (!bubble.alive || !this.active) return;
    if (bubble.def.kind === 'nickname' && bubble.def.nickname) {
      const isNew = SaveManager.collectNickname(bubble.def.nickname);
      this.collectedNicknames.add(bubble.def.nickname);
      bubble.alive = false;
      this.tweens.add({ targets: bubble.container, scale: 1.5, alpha: 0, duration: 280, onComplete: () => bubble.container.destroy() });
      if (isNew) {
        track('nickname_collected', { nickname: bubble.def.nickname });
        this.nicknameText.setText(`+ ${bubble.def.word}`);
        this.time.delayedCall(1300, () => this.nicknameText.setText(''));
      }
      // Super-baby secret
      if (bubble.def.nickname === 'super-baby') {
        this.dropBrutusSpeck(bubble.container.x, bubble.container.y);
      }
      return;
    }

    // Base word — select
    if (this.selected) {
      // Deselect previous
      this.tweens.add({ targets: this.selected.container, alpha: 1, scale: 1, duration: 120 });
    }
    this.selected = bubble;
    this.tweens.add({ targets: bubble.container, alpha: 0.65, scale: 1.1, duration: 120 });
  }

  private handleTargetTap(targetId: string): void {
    if (!this.active || !this.selected) return;
    const def = this.selected.def;
    if (def.kind !== 'base' || !def.targetId) return;

    const target = this.targets.find((t) => t.id === targetId);

    if (def.targetId === targetId) {
      this.matchedCount++;
      this.statusText.setText(`Matched: ${this.matchedCount}/${WIN_TOTAL}`);
      if (target) this.flashTarget(target);
      this.selected.alive = false;
      this.tweens.add({ targets: this.selected.container, scale: 1.4, alpha: 0, duration: 220, onComplete: () => this.selected?.container.destroy() });
      this.selected = null;

      if (this.matchedCount >= WIN_TOTAL) {
        this.active = false;
        this.win();
      }
    } else {
      if (target) this.flashWrong(target);
      this.tweens.add({ targets: this.selected.container, scale: 1, alpha: 1, duration: 120 });
      this.selected = null;
      this.registerMiss('wrong-match');
    }
  }

  /** Brief flash + bounce on a correct match (targets no longer dim permanently). */
  private flashTarget(t: Target): void {
    this.tweens.add({ targets: t.container, scaleX: 1.2, scaleY: 1.2, duration: 140, yoyo: true, ease: 'Sine.easeInOut' });
    const ring = this.add.circle(t.x, t.y - 4, 28, 0xfde68a, 0).setStrokeStyle(3, 0xfde047, 0.9).setDepth(150);
    this.tweens.add({ targets: ring, scale: 1.7, alpha: 0, duration: 380, onComplete: () => ring.destroy() });
  }

  private flashWrong(t: Target): void {
    const ring = this.add.circle(t.x, t.y - 4, 28, 0xdc2626, 0).setStrokeStyle(3, 0xf87171, 0.9).setDepth(150);
    this.tweens.add({ targets: ring, scale: 1.5, alpha: 0, duration: 340, onComplete: () => ring.destroy() });
  }

  private registerMiss(reason: string): void {
    if (!this.active) return;
    this.misses++;
    this.updateHearts();
    if (this.misses >= MAX_MISSES) {
      this.active = false;
      this.softFail(reason, 'Too many misses! Try again!');
      this.retryPopup.show(() => this.resetRound());
    }
  }

  private updateHearts(): void {
    const remaining = Math.max(0, MAX_MISSES - this.misses);
    this.hearts.forEach((h, i) => {
      const alive = i < remaining;
      h.setAlpha(alive ? 1 : 0.25);
      h.setTint(alive ? 0xffffff : 0x555555); // lost = dark/desaturated
    });
  }

  private dropBrutusSpeck(x: number, y: number): void {
    if (this.brutusSpeck) return;
    const speck = this.add.circle(x, y, 5, 0xfde68a, 0.9).setStrokeStyle(1, 0xffffff);
    speck.setInteractive({ useHandCursor: true });
    this.tweens.add({ targets: speck, alpha: 0.5, scale: 1.4, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    speck.on('pointerdown', () => this.tapSpeck());
    this.brutusSpeck = speck;
  }

  private tapSpeck(): void {
    this.brutusTaps++;
    if (this.brutusTaps >= BRUTUS_TAPS_NEEDED) {
      SaveManager.unlockBrutus();
      track('brutus_unlocked', { path: 'secret' });
      const W = this.scale.width;
      const dialog = this.add
        .text(W / 2, this.scale.height / 2, "Poe: \"Psst... they almost called him Brutus.\"", {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '12px',
          color: '#fde68a',
          backgroundColor: '#1c1410',
          padding: { x: 10, y: 6 },
          align: 'center',
          wordWrap: { width: W - 60 },
        })
        .setOrigin(0.5)
        .setDepth(200);
      this.tweens.add({ targets: dialog, alpha: 0, duration: 800, delay: 2200, onComplete: () => dialog.destroy() });
      this.brutusSpeck?.destroy();
      this.brutusSpeck = null;
    }
  }

  private resetRound(): void {
    for (const b of this.bubbles) {
      b.alive = false;
      b.container.destroy();
    }
    this.bubbles = [];
    this.selected = null;
    this.matchedCount = 0;
    this.misses = 0;
    this.collectedNicknames.clear();
    this.statusText.setText(`Matched: 0/${WIN_TOTAL}`);
    this.updateHearts();
    this.nicknameText.setText('');

    this.refillQueue();
    this.nextSpawnAt = this.time.now + 600;
    this.active = true;
  }

  private win(): void {
    this.completeChapter();
  }
}
