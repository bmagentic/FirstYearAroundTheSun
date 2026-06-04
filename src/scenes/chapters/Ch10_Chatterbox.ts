import Phaser from 'phaser';
import { ChapterBase } from './ChapterBase';
import { SaveManager } from '../../systems/SaveManager';
import { track } from '../../systems/Analytics';
import { RetryPopup } from '../../ui/RetryPopup';
import type { Nickname } from '../../types';

type Target = { id: string; label: string; color: number; x: number; y: number };

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

const WIN_BASE = 5;
const BRUTUS_TAPS_NEEDED = 5;

export class Ch10_Chatterbox extends ChapterBase {
  private targets: Target[] = [];
  private bubbles: Bubble[] = [];
  private spawnQueue: BubbleDef[] = [];
  private nextSpawnAt = 0;
  private selected: Bubble | null = null;
  private matchedBaseIds = new Set<string>();
  private active = false;
  private statusText!: Phaser.GameObjects.Text;
  private nicknameText!: Phaser.GameObjects.Text;

  private retryPopup!: RetryPopup;

  // Brutus secret
  private brutusSpeck: Phaser.GameObjects.Arc | null = null;
  private brutusTaps = 0;

  constructor() {
    super('Ch10_Chatterbox', 10);
  }

  create(): void {
    this.setup();
    this.retryPopup = new RetryPopup(this);
    this.cameras.main.setBackgroundColor('#1f140e');

    const W = this.scale.width;
    const H = this.scale.height;

    // Targets row at top
    const labels: Array<{ id: string; label: string; color: number }> = [
      { id: 'mama', label: 'Mama', color: 0xa855f7 },
      { id: 'dada', label: 'Dad', color: 0x4f6a3d },
      { id: 'finn', label: 'Finn', color: 0x6b3a1a },
      { id: 'nugget', label: 'Nugget', color: 0xc9a35d },
      { id: 'eevee', label: 'Eevee', color: 0xa67449 },
      { id: 'soka', label: 'Soka', color: 0xe6e6e6 },
    ];
    const spacing = (W - 40) / labels.length;
    labels.forEach((def, i) => {
      const x = 20 + spacing / 2 + i * spacing;
      const y = 130;
      const r = this.add.rectangle(x, y, spacing - 8, 56, def.color).setStrokeStyle(2, 0xfde68a, 0.6);
      this.add
        .text(x, y, def.label, {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '11px',
          color: '#fde68a',
          fontStyle: 'bold',
        })
        .setOrigin(0.5);
      r.setInteractive({ useHandCursor: true });
      r.on('pointerdown', () => this.handleTargetTap(def.id));
      this.targets.push({ ...def, x, y });
    });

    this.statusText = this.add
      .text(W / 2, 60, `0 / ${WIN_BASE} matched`, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        color: '#fde68a',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.nicknameText = this.add
      .text(W / 2, 85, '', {
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

    // Build spawn queue: mix of base words (repeated a couple times) and nicknames
    const queue: BubbleDef[] = [];
    queue.push(...BASE_BUBBLES);
    queue.push(...NICKNAME_BUBBLES);
    queue.push(...BASE_BUBBLES.slice(0, 3));
    Phaser.Utils.Array.Shuffle(queue);
    this.spawnQueue = queue;

    void this.intro('Chatterbox', 'Match each word to the right family member or dog.').then(() => {
      this.active = true;
      this.nextSpawnAt = this.time.now + 600;
    });
  }

  override update(_t: number, delta: number): void {
    if (!this.active) return;

    if (this.spawnQueue.length > 0 && this.time.now >= this.nextSpawnAt) {
      const next = this.spawnQueue.shift();
      if (next) this.spawnBubble(next);
      this.nextSpawnAt = this.time.now + 1900;
    }

    const dt = delta / 1000;
    for (const b of this.bubbles) {
      if (!b.alive) continue;
      b.container.y -= 30 * dt;
      if (b.container.y < 180) {
        b.alive = false;
        this.tweens.add({ targets: b.container, alpha: 0, duration: 200, onComplete: () => b.container.destroy() });
      }
    }
    this.bubbles = this.bubbles.filter((b) => b.alive);

    if (this.matchedBaseIds.size >= WIN_BASE && this.active) {
      this.active = false;
      this.win();
      return;
    }

    if (this.spawnQueue.length === 0 && this.bubbles.length === 0 && this.active) {
      this.active = false;
      this.softFail('round-incomplete', 'Not enough matches');
      this.retryPopup.show(() => this.resetRound());
    }
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
    if (!bubble.alive) return;
    if (bubble.def.kind === 'nickname' && bubble.def.nickname) {
      const isNew = SaveManager.collectNickname(bubble.def.nickname);
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
      this.tweens.add({ targets: this.selected.container, alpha: 1, duration: 120 });
    }
    this.selected = bubble;
    this.tweens.add({ targets: bubble.container, alpha: 0.65, scale: 1.1, duration: 120 });
  }

  private handleTargetTap(targetId: string): void {
    if (!this.selected) return;
    const def = this.selected.def;
    if (def.kind !== 'base' || !def.targetId) return;

    if (def.targetId === targetId) {
      if (!this.matchedBaseIds.has(targetId)) {
        this.matchedBaseIds.add(targetId);
        this.statusText.setText(`${this.matchedBaseIds.size} / ${WIN_BASE} matched`);
      }
      this.selected.alive = false;
      this.tweens.add({ targets: this.selected.container, scale: 1.4, alpha: 0, duration: 220, onComplete: () => this.selected?.container.destroy() });
      this.selected = null;
    } else {
      this.softFail('wrong-match', 'Not that one — try again');
      this.tweens.add({ targets: this.selected.container, scale: 1, alpha: 1, duration: 120 });
      this.selected = null;
    }
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
    this.matchedBaseIds.clear();
    this.statusText.setText(`0 / ${WIN_BASE} matched`);
    this.nicknameText.setText('');

    const queue: BubbleDef[] = [];
    queue.push(...BASE_BUBBLES);
    queue.push(...NICKNAME_BUBBLES);
    queue.push(...BASE_BUBBLES.slice(0, 3));
    Phaser.Utils.Array.Shuffle(queue);
    this.spawnQueue = queue;

    this.nextSpawnAt = this.time.now + 600;
    this.active = true;
  }

  private win(): void {
    this.completeChapter();
  }
}
