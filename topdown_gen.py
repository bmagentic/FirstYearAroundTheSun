#!/usr/bin/env python3
"""
topdown_gen.py — Caius birthday game, true top-down room background generator.

Generates one flat-colour PNG per game room: solid floor fill, thin wall border,
door gaps on the walls that match the room-connectivity model in rooms.ts.

Output size: 208×282 px (matches game room aspect ratio 416:564 at 2× scale).
  ROOM_SCALE = game_room_width / BG_W = 416/208 = 2.0  (uniform both axes)

Run from repo root:
  python3 topdown_gen.py

Outputs go directly to public/assets/sprites/rooms/ and overwrite any existing
side-on PNGs for those rooms. _sideon/ backup must be done before running.
"""
import os
from PIL import Image, ImageDraw

REPO = os.path.expanduser("~/Claude-Projects/Caius-Birthday-Game")
OUT  = os.path.join(REPO, "public/assets/sprites/rooms")

# ── Canvas ────────────────────────────────────────────────────────────────────
# 208×282 → uniform 2× scale to game's 416×564 room bounds.
BG_W, BG_H = 208, 282

# Wall border thickness in bg-px  (2× → 20 game px).
WALL = 10

# Door gap width in bg-px  (game DOOR_WIDTH=72 / 2 = 36).
DOOR_W = 36

# ── Room definitions ─────────────────────────────────────────────────────────
# Key   : matches rooms.ts id with hyphens → underscores (file naming).
# Tuple : (floor_rgb, wall_rgb, [(side, fractional_position), ...])
# Door positions and sides match rooms.ts doorways exactly.
# Colors match rooms.ts FLOOR/WALL constants (hex → RGB).

ROOMS = {
    "nursery": (
        (230, 211, 163),  # FLOOR.cream
        (196, 168, 106),  # WALL.cream
        [("bottom", 0.5)],
    ),
    "master_bedroom": (
        (92,  124, 154),  # FLOOR.blue
        (57,   85, 109),  # WALL.blue
        [("bottom", 0.5)],
    ),
    "hallway_upper": (
        (109,  76,  65),  # FLOOR.warm
        (78,   52,  46),  # WALL.brown
        [("top", 0.25), ("top", 0.75), ("right", 0.5), ("bottom", 0.5)],  # +bathroom
    ),
    "hallway_lower": (
        (109,  76,  65),  # FLOOR.warm
        (78,   52,  46),  # WALL.brown
        [("top", 0.5), ("bottom", 0.25), ("bottom", 0.75)],
    ),
    "kitchen": (
        (161, 136, 127),  # FLOOR.light
        (196, 168, 106),  # WALL.cream
        [("top", 0.5), ("left", 0.5), ("right", 0.5), ("bottom", 0.5)],  # +dining
    ),
    "living_room": (
        (139, 111,  90),  # FLOOR.dusty
        (94,   74,  58),  # WALL.dusty
        [("top", 0.5), ("left", 0.5), ("right", 0.5)],  # backyard removed
    ),
    "garage": (
        (138, 126, 110),  # FLOOR.rocky
        (78,   70,  58),  # WALL.rocky
        [("left", 0.5)],
    ),
    "play_area": (
        (107, 142,  90),  # FLOOR.green
        (76,  107,  62),  # WALL.green
        [("top", 0.5)],
    ),
    "dining": (
        (178, 168, 152),  # FLOOR.lvp  (0xb2a898)
        (196, 168, 106),  # WALL.cream (0xc4a86a)
        [("right", 0.5)],  # → kitchen
    ),
    "bathroom": (
        (178, 168, 152),  # FLOOR.lvp  (0xb2a898)
        (216, 216, 208),  # WALL.white (0xd8d8d0)
        [("left", 0.5)],   # → hallway-upper
    ),
}

# ── Generator ─────────────────────────────────────────────────────────────────

def door_rect(side: str, pos: float) -> tuple[int, int, int, int]:
    """Pixel rect (x0, y0, x1, y1) for one door gap in the wall border."""
    half = DOOR_W // 2
    if side == "top":
        cx = int(BG_W * pos)
        return (cx - half, 0, cx + half, WALL)
    if side == "bottom":
        cx = int(BG_W * pos)
        return (cx - half, BG_H - WALL, cx + half, BG_H)
    if side == "left":
        cy = int(BG_H * pos)
        return (0, cy - half, WALL, cy + half)
    # right
    cy = int(BG_H * pos)
    return (BG_W - WALL, cy - half, BG_W, cy + half)


def generate(room_id: str, floor_rgb, wall_rgb, doors) -> None:
    img = Image.new("RGB", (BG_W, BG_H), wall_rgb)
    draw = ImageDraw.Draw(img)

    # Floor fill (inset by wall thickness on all four sides)
    draw.rectangle([WALL, WALL, BG_W - WALL - 1, BG_H - WALL - 1], fill=floor_rgb)

    # Door gaps — repaint floor colour into the wall border at each doorway
    for side, pos in doors:
        draw.rectangle(door_rect(side, pos), fill=floor_rgb)

    fname = f"room_{room_id}_bg.png"
    img.save(os.path.join(OUT, fname))
    print(f"  {fname}  {BG_W}×{BG_H}  doors={[s for s,_ in doors]}")


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    print(f"Top-down generator → {OUT}")
    for room_id, (floor, wall, doors) in ROOMS.items():
        generate(room_id, floor, wall, doors)
    print(f"\nDone. {len(ROOMS)} rooms generated.")
    print("Next: python3 texture_pass.py")
