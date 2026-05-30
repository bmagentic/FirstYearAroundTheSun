#!/usr/bin/env python3
"""
texture_pass.py — Caius birthday game, room background texture pass.

Adds light pixel-art texture (edge outlines, surface dither, corner shadow,
floor pattern) to the flat top-down room backgrounds produced by topdown_gen.py.

Safe to re-run: backs up originals to rooms/_original/ on first run and always
processes from those, so passes never stack. Tune with --strength (default 1.0).
Process one room: pass its key as an argument.

Usage:
  python3 texture_pass.py                # all rooms
  python3 texture_pass.py nursery        # one room
  python3 texture_pass.py --strength 0.7 # lighter pass

Backgrounds are 208×282 top-down: floor fills most of the frame (wall border
is ~10px). floor_top is set small (0.04–0.06) so texture covers the whole floor.
"""
import os, sys, shutil
import numpy as np
from PIL import Image, ImageFilter

BASE   = os.path.expanduser("~/Claude-Projects/Caius-Birthday-Game/public/assets/sprites/rooms")
BACKUP = os.path.join(BASE, "_original")

# ── Room table ────────────────────────────────────────────────────────────────
# floor_top: fraction of image height where floor starts.
# For top-down 208×282 with WALL=10: 10/282 ≈ 0.035 — use 0.04 to clear the
# border and texture only the floor area.
# interior: True suppresses sky-protection logic (all rooms are interiors now).

ROOMS = {
    "nursery":        dict(file="room_nursery_bg.png",        floor_top=0.04, floor="carpet",   interior=True),
    "master_bedroom": dict(file="room_master_bedroom_bg.png", floor_top=0.04, floor="carpet",   interior=True),
    "hallway_upper":  dict(file="room_hallway_upper_bg.png",  floor_top=0.04, floor="carpet",   interior=True),
    "hallway_lower":  dict(file="room_hallway_lower_bg.png",  floor_top=0.04, floor="carpet",   interior=True),
    "kitchen":        dict(file="room_kitchen_bg.png",        floor_top=0.04, floor="tile",     interior=True),
    "living_room":    dict(file="room_living_room_bg.png",    floor_top=0.04, floor="lvp",      interior=True),
    "garage":         dict(file="room_garage_bg.png",         floor_top=0.04, floor="concrete", interior=True),
    "play_area":      dict(file="room_play_area_bg.png",      floor_top=0.04, floor="lvp",      interior=True),
    "dining":         dict(file="room_dining_bg.png",         floor_top=0.04, floor="lvp",      interior=True),
    "bathroom":       dict(file="room_bathroom_bg.png",       floor_top=0.04, floor="tile",     interior=True),
}

# ── Processing ────────────────────────────────────────────────────────────────

def process(img: Image.Image, cfg: dict, strength: float = 1.0) -> Image.Image:
    im = img.convert("RGB")
    W, H = im.size
    arr = np.asarray(im).astype(np.float32)

    # Edge detection for outlines
    e = np.asarray(im.filter(ImageFilter.FIND_EDGES).convert("L")).astype(np.float32)
    e = np.clip(e / 40.0, 0, 1)
    flat = (1 - e)[..., None]
    out = arr.copy()

    # Edge outlines
    out *= (1 - 0.45 * strength * e[..., None])

    # Surface dither (noise on flat areas)
    rng = np.random.default_rng(7)
    noise = rng.integers(-10, 11, size=(H, W)).astype(np.float32)[..., None]
    dith = noise * 0.6 * strength * flat
    out += dith

    # Corner vignette (interior rooms only)
    if cfg["interior"]:
        yy, xx = np.mgrid[0:H, 0:W]
        d = np.sqrt(((xx - W / 2) / (W / 2)) ** 2 + ((yy - H / 2) / (H / 2)) ** 2)
        out *= np.clip(1 - 0.18 * strength * np.clip(d - 0.6, 0, 1) / 0.4, 0.80, 1.0)[..., None]

    # Floor pattern
    ft = int(H * cfg["floor_top"])
    f  = cfg["floor"]

    def drows(step: int, amt: float) -> None:
        for y in range(ft, H, step):
            out[y, :] *= amt

    if f == "tile":
        out[ft:H, ::16] *= (1 - 0.07 * strength)
        drows(16, 1 - 0.07 * strength)
    elif f == "lvp":
        drows(12, 1 - 0.06 * strength)
        for i, y in enumerate(range(ft, H, 12)):
            out[y : y + 12, (24 if i % 2 else 0) :: 48] *= (1 - 0.05 * strength)
    elif f == "concrete":
        out[ft:H, ::48] *= (1 - 0.05 * strength)
        drows(48, 1 - 0.05 * strength)
        out[ft:H] += rng.integers(-6, 7, size=(H - ft, W))[..., None] * 0.5 * strength
    elif f == "carpet":
        out[ft:H] += rng.integers(-7, 8, size=(H - ft, W))[..., None] * 0.8 * strength
    elif f == "grass":
        out[ft:H] += rng.integers(-9, 10, size=(H - ft, W))[..., None] * 0.9 * strength

    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGB")


def run(keys: list[str], strength: float) -> None:
    os.makedirs(BACKUP, exist_ok=True)
    for k in keys:
        cfg  = ROOMS[k]
        live = os.path.join(BASE, cfg["file"])
        orig = os.path.join(BACKUP, cfg["file"])
        if not os.path.exists(live):
            print(f"  skip {k}: {cfg['file']} not found")
            continue
        if not os.path.exists(orig):
            shutil.copy2(live, orig)
        result = process(Image.open(orig), cfg, strength)
        result.save(live)
        print(f"  textured {k:16s} → {cfg['file']}")


if __name__ == "__main__":
    args     = sys.argv[1:]
    strength = 1.0
    if "--strength" in args:
        i        = args.index("--strength")
        strength = float(args[i + 1])
        del args[i : i + 2]
    keys = [a for a in args if a in ROOMS] or list(ROOMS.keys())
    print(f"Texture pass (strength={strength}) on: {', '.join(keys)}")
    run(keys, strength)
    print("Done. Originals in rooms/_original/ — restore from there to revert.")
