import type Phaser from 'phaser';

/**
 * Sprite swap-in helper. Each scene calls `preloadInto(this, ids)` in preload(),
 * and `has(scene, key)` in create() to decide whether to use a real sprite or a
 * placeholder shape.
 *
 * MANIFEST resolves the name mismatches between game keys and on-disk paths.
 * Dropping a PNG at the mapped path is the only step needed to activate a sprite.
 *
 * MISSING lists keys we know have no file yet — preloadInto skips the HTTP request
 * and has() returns false immediately for them.
 */

const MANIFEST: Record<string, string> = {
  // ── Characters ──────────────────────────────────────────────────────────────
  'caius':              '/assets/sprites/caius/south.png',
  'chelsea-idle':       '/assets/sprites/chelsea/south.png',
  'chelsea-asleep':     '/assets/sprites/chelsea_scrubs/chelsea_rocking.png',

  // ── Ch04 ────────────────────────────────────────────────────────────────────
  'vtech-cube':         '/assets/sprites/portable/obj_portable_vtechcube.png',

  // ── Ch05 ────────────────────────────────────────────────────────────────────
  'bed':                '/assets/sprites/rooms/master/obj_master_bed.png',
  'dad-airplane':       '/assets/sprites/brandon/brandon_airplane.png',

  // ── Ch11 furniture (reconciled to available sprites) ────────────────────────
  'furniture-sectional':   '/assets/sprites/rooms/living_kitchen/obj_livingroom_sectional.png',
  'furniture-coffeetable': '/assets/sprites/rooms/living_kitchen/obj_livingroom_coffeetable.png',
  'furniture-sidetable':   '/assets/sprites/rooms/living_kitchen/obj_livingroom_sidetable.png',
  'furniture-barstool':    '/assets/sprites/rooms/living_kitchen/obj_kitchen_barstool.png',

  // ── Room backgrounds ────────────────────────────────────────────────────────
  'room-nursery-bg':    '/assets/sprites/rooms/room_nursery_bg.png',
};

// Keys with no file on disk — preloadInto skips the request, has() returns false.
const MISSING = new Set(['caius-roll', 'caius-crawl-l', 'caius-crawl-r']);

export const SpriteBank = {
  preloadInto(scene: Phaser.Scene, ids: readonly string[]): void {
    for (const id of ids) {
      if (MISSING.has(id)) continue;
      if (scene.textures.exists(id)) continue;
      const path = MANIFEST[id] ?? `/assets/sprites/${id}.png`;
      scene.load.image(id, path);
    }
  },

  has(scene: Phaser.Scene, id: string): boolean {
    if (MISSING.has(id)) return false;
    return scene.textures.exists(id);
  },
};
