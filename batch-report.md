# Batch Report — Top-Down Switch + Nursery Render System
**Date:** 2026-05-30

---

## What changed

### Safety
- Committed restore point `513ac85` ("side-on nursery slice") — pushed to `origin/main`.
- All 10 existing PixelLab side-on room PNGs backed up to `public/assets/sprites/rooms/_sideon/`. Restore any file from there to revert.
- `caius-house-map.md` copied from `Desktop/Claude-Projects/MDs/house-sprites-prompt.md` into repo root (has canvas dimensions, connectivity notes, and room recognition specs used for the PixelLab generation run).

### Top-down background generator (`topdown_gen.py`)
New script at repo root. Generates 9 room PNGs from scratch using PIL:
- **Output size:** 208×282 px for all rooms — matches game room aspect ratio (416:564) at uniform 2× scale.
- **Structure:** solid wall-colour fill → floor-colour rectangle inset by 10 px wall border → door gaps (36 px wide) cut into the wall at positions derived from `rooms.ts` doorways.
- **Door connectivity wired:** all 9 rooms match the game's room graph (nursery → hallway-upper, hallway-upper → nursery(×2) + hallway-lower, etc.).

### Texture pass (`texture_pass.py`)
Updated copy saved to repo root (original stays on Desktop):
- `BASE` now points to `~/Claude-Projects/Caius-Birthday-Game/public/assets/sprites/rooms`.
- `ROOMS` dict rebuilt for the 9 game rooms (old entries for dining, bathroom, front_day, front_dawn, garage_closed, garage_open removed — those aren't game rooms in `rooms.ts`).
- `floor_top` set to `0.04` for all rooms (top-down: floor fills ~96% of image; tiny top wall strip excluded from floor-pattern noise).
- Auto-backup to `rooms/_original/` still active.
- Ran on all 9 rooms with `strength=1.0`.

### `SpriteBank.ts`
- Added 9 room bg keys: `room-nursery-bg` through `room-backyard-bg` → mapped to new `room_{id}_bg.png` files.
- Added 7 nursery object keys: `obj-nursery-{crib,dresser,bookshelf,chair,floorlamp,foxpainting,toychest}` → `rooms/nursery/obj_nursery_*.png`.

### `HouseScene.ts` — render system
Complete rewrite structured around the new constants:

#### Scale constant (one source of truth)
```
BG_NATIVE_W = 208   // bg image width in px
BG_NATIVE_H = 282   // bg image height in px
BG_WALL_PX  = 10    // wall border thickness in bg px (must match topdown_gen.py)
```
`ROOM_SCALE` is derived on demand: `bounds.width / BG_NATIVE_W` (= 2.0).
Lives at the **top of `HouseScene.ts`** as module-level constants.

#### `FloorZone` format
```typescript
type FloorZone = { x: number; y: number; w: number; h: number };
```
`x`, `y` — top-left corner in game px.
`w`, `h` — width/height in game px.
Computed by `computeFloorZone(def)`:
- **Nursery**: insets by `BG_WALL_PX × ROOM_SCALE` on each axis (~20 px horizontal, ~28 px vertical).
- **All other rooms**: returns full `roomBounds()` (no inset) — they remain on default full-rect floor.

#### Depth sorting
`footDepth(footY)` maps foot position to Phaser depth value in range 2..49:
- `bgLayer` container: depth 0
- `worldLayer` container (chapter markers): depth 1
- Room objects: depth = `footDepth(footY)` at creation — static
- Wall art (`wallArt: true`): depth 2 (always behind floor objects)
- Player: depth = `footDepth(player.y)` — updated every frame in `update()`
- `hudLayer` (HUD, pause, mute): depth 100

#### Foot-anchored sprites
All nursery objects placed with `setOrigin(0.5, 1.0)` (centre-bottom = foot point).
Position = `(fz.x + fz.w × fx, fz.y + fz.h × fy + displayH)` — foot lands at `fy` fraction down the floor zone.
Player container is positioned at foot coordinates (same as before, works because player origin defaults to top-left of the container which is visually the body centre).

#### Nursery wired, others drafted
`placeRoomObjects(def)` exits immediately for all rooms except `nursery`.
Other 8 rooms: top-down bg renders, door arrows render, chapter markers render — no furniture objects placed. Nothing breaks.

---

## Rooms: wired vs draft

| Room | BG | Floor zone | Objects | Depth sort |
|---|---|---|---|---|
| **nursery** | ✅ top-down | ✅ wall-inset | ✅ 7 sprites | ✅ |
| master-bedroom | ✅ top-down | draft (full bounds) | — | player only |
| hallway-upper | ✅ top-down | draft | — | player only |
| hallway-lower | ✅ top-down | draft | — | player only |
| kitchen | ✅ top-down | draft | — | player only |
| living-room | ✅ top-down | draft | — | player only |
| garage | ✅ top-down | draft | — | player only |
| play-area | ✅ top-down | draft | — | player only |
| backyard | ✅ top-down | draft | — | player only |

---

## Flags and issues to review

### 1. Object sprite orientation (most important)
The nursery object sprites (`obj_nursery_*.png`) were generated via PixelLab using the `house-sprites-prompt.md` spec, which called for **"Mostly top-down with slight 3/4 angle"**. On a pure top-down floor they may look slightly front-facing or awkward — objects designed for 3/4 view have visible front faces that read strangely when placed on a flat floor seen from directly above. **Open the nursery in the browser and check:**
- Crib: does it read as a crib seen from above, or does the headboard/railing look like it's facing the camera?
- Bookshelf: does it look like a shelf footprint, or like a shelf seen from the side?
- Chair (rocker): probably the most likely to look wrong — a rocking chair seen from the side vs from above are completely different shapes.
This is the strongest candidate for a re-generation pass with a "strict top-down, view from directly above" prompt override if the sprites look off.

### 2. Side-on nursery bg replaced
The PixelLab-generated `room_nursery_bg.png` (320×240, terracotta accent wall, grey carpet — very detailed) has been replaced by the programmatic top-down version (208×282, flat cream floor, cream/tan wall border). The PixelLab version is preserved in `_sideon/room_nursery_bg.png`. If you prefer the PixelLab art even in top-down view, the restore is `cp public/assets/sprites/rooms/_sideon/room_nursery_bg.png public/assets/sprites/rooms/`.

### 3. New rooms have no PixelLab art
Rooms that didn't have PixelLab backgrounds (hallway-upper, hallway-lower, kitchen, living-room, garage, play-area) now have programmatic top-down PNGs for the first time. These are minimal (flat colour + texture dither) but functional.

### 4. `room_livingkitchen_bg.png` is now orphaned
The game uses separate `kitchen` and `living-room` room IDs. The old `room_livingkitchen_bg.png` (480×240 PixelLab art) is still in `public/assets/sprites/rooms/` but no game key references it. It's also preserved in `_sideon/`. Safe to leave or delete.

### 5. `room-garage-bg` replaces `room_garage_bg_closed/open`
The game only has one `garage` room ID — the new key is `room-garage-bg`. The old `_closed` / `_open` variants are in `_sideon/` if needed for a future state-variant system.

### 6. `footDepth` for chapter markers
Chapter markers (in `worldLayer` at depth 1) always render below all floor content. A marker at the bottom of the room will appear under objects near that position. This is usually fine but could be addressed by giving markers scene-level depth if markers need to pop above furniture.

### 7. Player width on Caius sprite
Player is rendered at `PLAYER_RADIUS * 2.5 × PLAYER_RADIUS * 3.5` = 30×42 px. At 2× room scale, Caius in the nursery looks a bit small relative to the furniture. Consider bumping to `PLAYER_RADIUS * 3 × PLAYER_RADIUS * 4.2` (36×50 px) if the character reads too small in the browser.

---

## Dev server
Running at `http://localhost:5173`. TypeScript: 0 errors. All 9 room bg URLs and all 7 nursery object sprite URLs return HTTP 200.
