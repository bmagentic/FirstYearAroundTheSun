import type Phaser from 'phaser';

/**
 * Sprite swap-in helper. Each scene calls `preloadInto(this, ids)` in preload(),
 * and `has(scene, key)` in create() to decide whether to use a real sprite or a
 * placeholder shape.
 *
 * MANIFEST resolves name mismatches between game keys and on-disk paths.
 * Dropping a PNG at the mapped path is the only step needed to activate a sprite.
 *
 * MISSING lists keys we know have no file yet — preloadInto skips the HTTP request
 * and has() returns false immediately for them.
 */

const MANIFEST: Record<string, string> = {
  // ── Characters ──────────────────────────────────────────────────────────────
  'caius':              '/assets/sprites/caius-blue/south.png',
  'caius-crawl-l':      '/assets/sprites/caius-crawl-l.png',
  'caius-crawl-r':      '/assets/sprites/caius-crawl-r.png',
  'caius-crawl-up':     '/assets/sprites/caius-crawl-up.png',
  'caius-crawl-down':   '/assets/sprites/caius-crawl-down.png',
  'chelsea-idle':       '/assets/sprites/chelsea/south.png',
  'chelsea-asleep':     '/assets/sprites/chelsea_scrubs/chelsea_rocking.png',
  'chelsea-bath':       '/assets/sprites/chelsea_scrubs/chelsea_bath.png',
  'chelsea-holding':    '/assets/sprites/chelsea_scrubs/chelsea_holding.png',
  'chelsea-feeding':    '/assets/sprites/chelsea_scrubs/chelsea_feeding.png',
  'chelsea-shoulder':   '/assets/sprites/chelsea_scrubs/chelsea_shoulder.png',
  'chelsea-encouraging-standing': '/assets/sprites/chelsea_scrubs/chelsea_encouraging_standing.png',
  'chelsea-doorway':    '/assets/sprites/chelsea/chelsea-doorway.png',

  // ── Emotes (32x32) ────────────────────────────────────────────────────────────
  'emote-heart':        '/assets/sprites/emotes/emote-heart.png',
  'emote-sparkle':      '/assets/sprites/emotes/emote-sparkle.png',

  // ── Portables ───────────────────────────────────────────────────────────────
  'obj-cape-red':       '/assets/sprites/portables/obj-cape-red.png',

  // ── Dogs (south-facing idle) ───────────────────────────────────────────────
  'finn-south':         '/assets/sprites/finn/south.png',
  'nugget-south':       '/assets/sprites/nugget/south.png',
  'eevee-south':        '/assets/sprites/eevee/south.png',
  'soka-south':         '/assets/sprites/soka/south.png',

  // ── Ch04 ────────────────────────────────────────────────────────────────────
  'vtech-cube':         '/assets/sprites/portable/obj_portable_vtechcube.png',

  // ── Ch05 ────────────────────────────────────────────────────────────────────
  'bed':                '/assets/sprites/rooms/master/obj_master_bed.png',
  'obj-master-dresser':       '/assets/sprites/rooms/master/obj_master_dresser.png',
  'obj-master-changingtable': '/assets/sprites/rooms/master/obj_master_changingtable.png',
  'obj-master-floormattress': '/assets/sprites/rooms/master/obj_master_floormattress.png',
  'dad-airplane':       '/assets/sprites/brandon/brandon_airplane.png',
  'brandon-idle':       '/assets/sprites/brandon/south.png',

  // ── Garage object sprites ─────────────────────────────────────────────────
  'obj-garage-smeg':          '/assets/sprites/signature/obj_signature_smegfridge.png',
  'obj-garage-cabinets':      '/assets/sprites/rooms/garage/obj_garage_cabinets.png',
  'obj-garage-workbench':     '/assets/sprites/rooms/garage/obj_garage_workbench.png',
  'obj-garage-bike':          '/assets/sprites/rooms/garage/obj_garage_bike.png',
  'obj-garage-rocket-ready':  '/assets/sprites/rooms/garage/obj_garage_rocket_ready.png',

  // ── Kitchen object sprites ────────────────────────────────────────────────
  'obj-kitchen-fridge':       '/assets/sprites/rooms/living_kitchen/obj_kitchen_fridge.png',
  'obj-kitchen-range':        '/assets/sprites/rooms/living_kitchen/obj_kitchen_range.png',
  'obj-kitchen-barstool':     '/assets/sprites/rooms/living_kitchen/obj_kitchen_barstool.png',
  'obj-kitchen-chandelier':   '/assets/sprites/rooms/living_kitchen/obj_kitchen_chandelier.png',

  // ── Bathroom object sprites ───────────────────────────────────────────────
  'obj-bathroom-showercurtain': '/assets/sprites/rooms/bathroom/obj_bathroom_showercurtain.png',
  'obj-bathroom-bathproducts':  '/assets/sprites/rooms/bathroom/obj_bathroom_bathproducts.png',
  'obj-bathroom-rubberduck':    '/assets/sprites/rooms/bathroom/obj_bathroom_rubberduck.png',
  'obj-bathroom-tubwater':      '/assets/sprites/rooms/bathroom/obj_bathroom_tubwater.png',

  // ── Play-area portables ───────────────────────────────────────────────────
  'obj-portable-snackcup':    '/assets/sprites/portable/obj_portable_snackcup.png',
  'obj-portable-roomba':      '/assets/sprites/portable/obj_portable_roomba.png',
  'obj-portable-bottle-filled': '/assets/sprites/portable/obj_portable_bottle_filled.png',

  // ── Ch11 furniture (reconciled to available sprites) ────────────────────────
  'furniture-sectional':   '/assets/sprites/rooms/living_kitchen/obj_livingroom_sectional.png',
  'furniture-coffeetable': '/assets/sprites/rooms/living_kitchen/obj_livingroom_coffeetable.png',
  'furniture-sidetable':   '/assets/sprites/rooms/living_kitchen/obj_livingroom_sidetable.png',
  'furniture-barstool':    '/assets/sprites/rooms/living_kitchen/obj_kitchen_barstool.png',

  // ── Dining room object sprites ─────────────────────────────────────────────
  'obj-dining-table':          '/assets/sprites/rooms/dining/obj_dining_table.png',
  'obj-dining-chair':          '/assets/sprites/rooms/dining/obj_dining_chair.png',
  'obj-dining-chair-east':     '/assets/sprites/rooms/dining/obj_dining_chair_east.png',
  'obj-dining-chair-west':     '/assets/sprites/rooms/dining/obj_dining_chair_west.png',
  'obj-dining-highchair':      '/assets/sprites/rooms/dining/obj_dining_highchair.png',
  'obj-dining-hutch':          '/assets/sprites/rooms/dining/obj_dining_hutch.png',
  'obj-dining-basketstand':    '/assets/sprites/rooms/dining/obj_dining_basketstand.png',
  'obj-dining-familylamp':     '/assets/sprites/rooms/dining/obj_dining_familylamp.png',
  'obj-dining-familypicture':  '/assets/sprites/rooms/dining/obj_dining_familypicture.png',
  'obj-dining-floorplant':     '/assets/sprites/rooms/dining/obj_dining_floorplant.png',
  'obj-dining-planterwall':    '/assets/sprites/rooms/dining/obj_dining_planterwall.png',
  'obj-dining-wineglassrack':  '/assets/sprites/rooms/dining/obj_dining_wineglassrack.png',

  // ── Room backgrounds (top-down, 208×282, ROOM_SCALE=2.0) ────────────────────
  'room-nursery-bg':         '/assets/sprites/rooms/room_nursery_bg.png',
  'room-master-bedroom-bg':  '/assets/sprites/rooms/room_master_bedroom_bg.png',
  'room-hallway-upper-bg':   '/assets/sprites/rooms/room_hallway_upper_bg.png',
  'room-hallway-lower-bg':   '/assets/sprites/rooms/room_hallway_lower_bg.png',
  'room-kitchen-bg':         '/assets/sprites/rooms/room_kitchen_bg.png',
  'room-living-room-bg':     '/assets/sprites/rooms/room_living_room_bg.png',
  'room-garage-bg':          '/assets/sprites/rooms/room_garage_bg.png',
  'room-play-area-bg':       '/assets/sprites/rooms/room_play_area_bg.png',
  'room-dining-bg':          '/assets/sprites/rooms/room_dining_bg.png',
  'room-bathroom-bg':        '/assets/sprites/rooms/room_bathroom_bg.png',

  // ── Plushies ─────────────────────────────────────────────────────────────
  'obj-plush-francois':    '/assets/sprites/plushies/obj_plush_francois.png',
  'obj-plush-foxamillion': '/assets/sprites/plushies/obj_plush_foxamillion.png',
  'obj-plush-deeno':       '/assets/sprites/plushies/obj_plush_deeno.png',
  'obj-plush-persephone':  '/assets/sprites/plushies/obj_plush_persephone.png',
  'obj-plush-moomoo':      '/assets/sprites/plushies/obj_plush_moomoo.png',
  'obj-plush-ribbie':      '/assets/sprites/plushies/obj_plush_ribbie.png',
  'obj-plush-poe':         '/assets/sprites/poe/poe_base_down.png',

  // ── Caius highchair pose (Ch07) ────────────────────────────────────────────
  'caius-highchair': '/assets/sprites/caius-highchair.png',

  // ── Ch07 food sprites ─────────────────────────────────────────────────────
  'food-puree':        '/assets/sprites/food/food_puree.png',
  'food-banana':       '/assets/sprites/food/food_banana.png',
  'food-cheerios':     '/assets/sprites/food/food_cheerios.png',
  'food-avocado':      '/assets/sprites/food/food_avocado.png',
  'food-sweetpotato':  '/assets/sprites/food/food_sweetpotato.png',
  'food-chili':        '/assets/sprites/food/food_chili.png',
  'food-lemon':        '/assets/sprites/food/food_lemon.png',
  'food-broccoli-raw': '/assets/sprites/food/food_broccoli_raw.png',

  // ── Ch06 toy sprites (GrabBag targets) ────────────────────────────────────
  'toy-block':      '/assets/sprites/toys/toy_block.png',
  'toy-ball':       '/assets/sprites/toys/toy_ball.png',
  'toy-duck':       '/assets/sprites/toys/toy_duck.png',
  'toy-star':       '/assets/sprites/toys/toy_star.png',
  'toy-rattle':     '/assets/sprites/toys/toy_rattle.png',
  'toy-car':        '/assets/sprites/toys/toy_car.png',
  'toy-teether':    '/assets/sprites/toys/toy_teether.png',
  'toy-blocktower': '/assets/sprites/toys/toy_blocktower.png',

  // ── Living room object sprites ─────────────────────────────────────────────
  'obj-livingroom-sectional':      '/assets/sprites/rooms/living_kitchen/obj_livingroom_sectional.png',
  'obj-livingroom-sectional-west': '/assets/sprites/rooms/living_kitchen/obj_livingroom_sectional_west.png',
  'obj-livingroom-coffeetable':  '/assets/sprites/rooms/living_kitchen/obj_livingroom_coffeetable.png',
  'obj-livingroom-sidetable':    '/assets/sprites/rooms/living_kitchen/obj_livingroom_sidetable.png',
  'obj-livingroom-tv':           '/assets/sprites/rooms/living_kitchen/obj_livingroom_tv.png',
  'obj-livingroom-coffeehutch':  '/assets/sprites/rooms/living_kitchen/obj_livingroom_coffeehutch.png',
  'obj-livingroom-gallerywall':  '/assets/sprites/rooms/living_kitchen/obj_livingroom_gallerywall.png',
  'obj-livingroom-horsepainting':'/assets/sprites/rooms/living_kitchen/obj_livingroom_horsepainting.png',
  'obj-livingroom-clock':        '/assets/sprites/rooms/living_kitchen/obj_livingroom_clock.png',

  // ── Nursery object sprites ────────────────────────────────────────────────
  'obj-nursery-crib':       '/assets/sprites/rooms/nursery/obj_nursery_crib.png',
  'obj-nursery-dresser':    '/assets/sprites/rooms/nursery/obj_nursery_dresser.png',
  'obj-nursery-bookshelf':  '/assets/sprites/rooms/nursery/obj_nursery_bookshelf.png',
  'obj-nursery-chair':      '/assets/sprites/rooms/nursery/obj_nursery_chair.png',
  'obj-nursery-floorlamp':  '/assets/sprites/rooms/nursery/obj_nursery_floorlamp.png',
  'obj-nursery-foxpainting':'/assets/sprites/rooms/nursery/obj_nursery_foxpainting.png',
  'obj-nursery-toychest':   '/assets/sprites/rooms/nursery/obj_nursery_toychest.png',
};

// Keys with no file on disk — preloadInto skips the request, has() returns false.
const MISSING = new Set<string>([]);

// In dev mode, append a per-session cache-bust so the browser never serves a
// stale PNG after a regeneration run. No-ops in production (Vite fingerprints assets).
const BUST = import.meta.env.DEV ? `?v=${Date.now()}` : '';

export const SpriteBank = {
  preloadInto(scene: Phaser.Scene, ids: readonly string[]): void {
    for (const id of ids) {
      if (MISSING.has(id)) continue;
      if (scene.textures.exists(id)) continue;
      const path = MANIFEST[id] ?? `/assets/sprites/${id}.png`;
      scene.load.image(id, path + BUST);
    }
  },

  has(scene: Phaser.Scene, id: string): boolean {
    if (MISSING.has(id)) return false;
    return scene.textures.exists(id);
  },
};
