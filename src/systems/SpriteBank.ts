import type Phaser from 'phaser';

/**
 * Sprite swap-in helper. Each chapter calls `preloadInto(this, ids)` in its
 * preload(), and `hasSprite(key)` in create() to decide whether to use a real
 * sprite or fall back to placeholder shapes.
 *
 * Per build-notes §8 (same convention as SoundBank): swapping in real art is
 * a filename-only operation — drop the PNG at /public/assets/sprites/{id}.png.
 */
export const SpriteBank = {
  /** Queue sprite loads. Phaser silently records errors for missing files. */
  preloadInto(scene: Phaser.Scene, ids: readonly string[]): void {
    for (const id of ids) {
      if (scene.textures.exists(id)) continue;
      scene.load.image(id, `/assets/sprites/${id}.png`);
    }
  },

  /** True only if the sprite finished loading (real PNG present). */
  has(scene: Phaser.Scene, id: string): boolean {
    return scene.textures.exists(id);
  },
};
